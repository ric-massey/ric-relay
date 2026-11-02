/* ── /tmdb — every film and show, looked up live ──
   The Entertainment room's lookup (Ric, 2026-10-31: "As long as it has all the
   popular movies and says where to watch and shows the movies in order and the
   rating and my rating"). His own list is the committed file and stays that
   way; this is for everything that is NOT on it yet, and for where anything
   streams today rather than on the day the puller last looked.

   It needs TMDB's key, and the key cannot live in a public web page — so the
   page asks here and this end asks TMDB. TMDB_KEY is a Worker secret (the same
   key the puller uses; the deploy workflow copies it across from the repo's
   Actions secret). Unset, every route answers 503 "lookup is not switched on"
   and the room carries on with the list alone.

   What it is NOT: a general TMDB proxy. Seven shapes, each a fixed upstream
   path, every answer cut down to the few fields the page draws — so nothing a
   visitor sends picks the path, and nothing TMDB adds tomorrow rides through.
   Read-only, no token, no state; cached at the edge for as long as each answer
   stays true (search an hour, where-to-watch six hours, a collection a week).

     GET /tmdb/search?q=&page=          films and shows matching a name
     GET /tmdb/popular/<movie|tv>       what is trending this week
     GET /tmdb/discover/<movie|tv>?g=&gx=&on=&len=&min=&era=&sort=&page=
                                        filters, checked in discoverParams()
     GET /tmdb/title/<movie|tv>/<id>    one title, with where to watch (US)
     GET /tmdb/collection/<id>          a franchise in release order
     GET /tmdb/find?q=movie~Title~2008|tv~Loki~2021   names to ids, ≤ 12
     GET /tmdb/img/<w92|w185|w342|w780>/<file>.jpg     a poster, passed through

   Posters go through here rather than being hot-linked from TMDB's image
   host: the room's rule is that the page talks to this Worker and to nothing
   else (projects/entertainment/README.md, "Poster art …"). The list's own
   posters are still the committed files; these are only for titles a lookup
   found. */

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
/* A find is up to two searches a name, and a free-plan Worker gets fifty
   subrequests a request — twelve names is twenty-four at worst. */
export const FIND_MAX = 12;
const SIZES = new Set(['w92', 'w185', 'w342', 'w780']);
const TTL = { search: 3600, popular: 3600 * 6, discover: 3600 * 6, title: 3600 * 6, collection: 86400 * 7, find: 86400 * 7, img: 86400 * 30 };

/* TMDB's provider names are the contractual ones ("Paramount Plus Essential",
   "Netflix Standard with Ads"). The same rules as provider_name() in
   projects/entertainment/pull-entertainment.py, so a service is called the
   same thing on a lookup as it is on the list. Change one, change both. */
const PROVIDER_NAMES = {
  'amazon prime video': 'Prime Video', 'apple tv plus': 'Apple TV+', 'disney plus': 'Disney+',
  'hbo max': 'Max', 'paramount plus': 'Paramount+', 'peacock': 'Peacock', 'pluto tv': 'Pluto TV',
  'tubi tv': 'Tubi', 'fubotv': 'Fubo', 'hoopla': 'Hoopla', 'kanopy': 'Kanopy',
  'plex channel': 'Plex', 'plex player': 'Plex', 'amazon prime video with ads': 'Prime Video',
  'amazon prime video free': 'Prime Video', 'youtube free': 'YouTube', 'youtube tv': 'YouTube TV',
  'the cw': 'The CW'
};
const STOREFRONTS = new Set(['amazon video', 'apple tv', 'apple tv store', 'youtube', 'google play movies',
  'fandango at home', 'vudu', 'microsoft store', 'spectrum on demand', 'redbox', 'rakuten tv', 'buy',
  'alamo on demand']);
const JUNK = new Set(['justwatch tv', 'justwatchtv']);
const FIXUPS = [['Tv', 'TV'], ['Youtube', 'YouTube'], ['Tnt', 'TNT'], ['Tbs', 'TBS'], ['Tru TV', 'truTV'],
  ['Mgm', 'MGM'], ['Amc', 'AMC'], ['Hbo', 'HBO'], ['Fubotv', 'Fubo'], ['Fxnow', 'FXNow'], ['Fx', 'FX'],
  ['Usa', 'USA'], ['Mtv', 'MTV'], ['Pbs', 'PBS'], ['Bet', 'BET'], ['Cw', 'CW']];

export function providerName(raw) {
  let key = String(raw || '').trim().toLowerCase();
  key = key.replace(/\s+(amazon|apple tv|roku)\s+(premium\s+)?channels?$/, '');
  key = key.replace(/\s+(essential|premium|standard|basic|plus)?\s*with ads?$/, '');
  key = key.replace(/\s+(essential|premium|basic|showtime)$/, '').trim();
  if (!key || JUNK.has(key)) return null;
  if (STOREFRONTS.has(key)) return 'Buy';
  if (PROVIDER_NAMES[key]) return PROVIDER_NAMES[key];
  let out = key.replace(/\s+plus$/, '+').replace(/\b\w/g, c => c.toUpperCase());
  for (const [wrong, right] of FIXUPS) out = out.replace(new RegExp('\\b' + wrong + '\\b', 'g'), right);
  return out.trim();
}

/* ── the shapes ── one card for a film or a show, whichever half of TMDB it
   came from (title/name, release_date/first_air_date). */
const year = d => (/^\d{4}/.test(d || '') ? Number(d.slice(0, 4)) : null);
function card(x, kind) {
  const k = kind || x.media_type;
  if (k !== 'movie' && k !== 'tv') return null;
  const d = (k === 'movie' ? x.release_date : x.first_air_date) || '';
  return {
    k, id: x.id,
    t: String((k === 'movie' ? x.title : x.name) || x.title || x.name || '').slice(0, 200),
    y: year(d), d: d.slice(0, 10),
    p: /^\/[\w.-]+\.jpg$/.test(x.poster_path || '') ? x.poster_path.slice(1) : '',
    r: typeof x.vote_average === 'number' ? Math.round(x.vote_average * 10) / 10 : null,
    v: x.vote_count || 0
  };
}

function where(us) {
  us = us || {};
  const names = (...buckets) => {
    const seen = new Set(), out = [];
    for (const b of buckets) for (const p of us[b] || []) {
      const n = providerName(p.provider_name);
      if (n && !seen.has(n)) { seen.add(n); out.push(n); }
    }
    return out;
  };
  const streams = names('flatrate', 'free', 'ads');
  return { streams: streams.slice(0, 6), rents: names('rent', 'buy').filter(n => !streams.includes(n)).slice(0, 3) };
}

function title(d, kind) {
  const c = card(d, kind);
  const credits = d.credits || d.aggregate_credits || {};
  const directors = kind === 'movie'
    ? (credits.crew || []).filter(p => p.job === 'Director').map(p => p.name)
    : (d.created_by || []).map(p => p.name);
  const ext = d.external_ids || {};
  return {
    ...c,
    overview: String(d.overview || '').slice(0, 1200),
    genres: (d.genres || []).map(g => g.name).slice(0, 4),
    runtime: kind === 'movie' ? d.runtime || null : ((d.episode_run_time || [])[0] || null),
    director: directors.slice(0, 2).join(', '),
    cast: (credits.cast || []).slice(0, 8).map(p => p.name),
    imdb: /^tt\d+$/.test(d.imdb_id || ext.imdb_id || '') ? (d.imdb_id || ext.imdb_id) : '',
    collection: d.belongs_to_collection ? { id: d.belongs_to_collection.id, name: d.belongs_to_collection.name } : null,
    seasons: kind === 'tv' ? d.number_of_seasons || null : null,
    status: d.status || '',
    ...where(((d['watch/providers'] || {}).results || {}).US),
    checked: new Date().toISOString().slice(0, 10),
    like: ((d.recommendations || {}).results || []).map(x => card(x, kind)).filter(Boolean).slice(0, 10)
  };
}

/* "movie~Iron Man~2008": what the page's watch orders are written in. A
   name and a year find the right one far more often than a name alone — and
   when the year search finds nothing, a year either side is the release-date
   slop between countries. */
function parseFind(q) {
  return String(q || '').split('|').slice(0, FIND_MAX).map(s => {
    const [k, t, y] = s.split('~');
    if ((k !== 'movie' && k !== 'tv') || !t) return null;
    return { k, t: t.slice(0, 120), y: /^\d{4}$/.test(y || '') ? Number(y) : null };
  });
}
const norm = s => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
function pick(results, want, kind) {
  const cards = (results || []).map(x => card(x, kind)).filter(Boolean);
  if (!cards.length) return null;
  const exact = cards.filter(c => norm(c.t) === norm(want.t));
  const near = want.y ? (exact.length ? exact : cards).filter(c => c.y && Math.abs(c.y - want.y) <= 1) : [];
  const pool = near.length ? near : exact.length ? exact : cards;
  return pool.slice().sort((a, b) => (b.v || 0) - (a.v || 0))[0];
}

/* ── discover: finding something to watch ──
   Ric, 2026-11-02: "a website of all the movies and will help you find a
   movie to watch". The page's filters — genre, mood, length, score, decade,
   which service it streams on — become ONE fixed TMDB query here. Every value
   is checked against a list in this file and anything else is a 400, so a
   visitor picks among the room's filters and never writes TMDB's query string.
   Moods are the page's (a mood is a set of genres to include and exclude, said
   out loud on the page); this end only sees genre ids.

   Genre ids are TMDB's own and have not changed in a decade; a service is a
   name here and TMDB's US provider id there. */
export const GENRES = {
  movie: new Set([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37]),
  tv: new Set([10759, 16, 35, 80, 99, 18, 10751, 10762, 9648, 10764, 10765, 10768, 37])
};
export const PROVIDERS = {
  netflix: 8, prime: 9, disney: 337, max: 1899, hulu: 15, apple: 350, peacock: 386,
  paramount: 531, tubi: 73, pluto: 300, starz: 43, amc: 526
};
const DISCOVER_KEYS = new Set(['g', 'gx', 'on', 'len', 'min', 'era', 'sort', 'page']);
const LENGTHS = { short: [0, 99], mid: [90, 130], long: [130, 0] };
const SORTS = { popular: 'popularity.desc', rated: 'vote_average.desc', new: null };

export function discoverParams(kind, sp) {
  for (const k of sp.keys()) if (!DISCOVER_KEYS.has(k)) return null;
  const ids = v => {
    if (!v) return [];
    const out = String(v).split('.').slice(0, 6).map(Number);
    return out.every(n => GENRES[kind].has(n)) ? out : null;
  };
  const g = ids(sp.get('g')), gx = ids(sp.get('gx'));
  if (!g || !gx) return null;
  const p = { include_adult: 'false', include_video: 'false' };
  /* Dot-separated on the way in, TMDB's "|" (any of) on the way out: a mood
     is "any of these", and one genre is a mood of one. */
  if (g.length) p.with_genres = g.join('|');
  if (gx.length) p.without_genres = gx.join(',');

  const on = sp.get('on');
  if (on) {
    if (!PROVIDERS[on]) return null;
    p.with_watch_providers = String(PROVIDERS[on]);
    p.watch_region = 'US';
    p.with_watch_monetization_types = 'flatrate|free|ads';
  }
  const len = sp.get('len');
  if (len) {
    if (!LENGTHS[len]) return null;
    const [lo, hi] = LENGTHS[len];
    if (lo) p['with_runtime.gte'] = String(lo);
    if (hi) p['with_runtime.lte'] = String(hi);
  }
  const min = sp.get('min');
  if (min) {
    if (!/^[5-9]$/.test(min)) return null;
    p['vote_average.gte'] = min;
  }
  const era = sp.get('era');
  const dk = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
  if (era) {
    if (!/^(19[2-9]0|20[0-2]0)$/.test(era)) return null;
    p[dk + '.gte'] = era + '-01-01';
    p[dk + '.lte'] = (Number(era) + 9) + '-12-31';
  }
  const sort = sp.get('sort') || 'popular';
  if (!(sort in SORTS)) return null;
  /* "Newest" means out already, not announced: release date no later than
     today, and enough votes that it is a film people have seen. */
  if (sort === 'new') {
    p.sort_by = dk + '.desc';
    const today = new Date().toISOString().slice(0, 10);
    if (!p[dk + '.lte'] || p[dk + '.lte'] > today) p[dk + '.lte'] = today;
  } else p.sort_by = SORTS[sort];
  /* A 10/10 from three votes is not a great film. Best-rated wants a crowd;
     everything else a small one, so the page is not a wall of unknowns. */
  p['vote_count.gte'] = sort === 'rated' ? '300' : min ? '100' : '20';
  return p;
}

/* ── the route ── */
export async function tmdbRoute(request, env, ctx, parts, url, { json, cors }) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method not allowed' }, 405, origin);
  const key = String(env.TMDB_KEY || '').trim();
  if (!key) return json({ error: 'lookup is not switched on here (no TMDB_KEY)' }, 503, origin);

  const get = env.FETCH || ((...a) => fetch(...a));
  const edge = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const timeout = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(12000) } : {};

  /* v3 key in the query, v4 token in a header — the same either/or as
     tmdb_get() in the puller, so whichever one was pasted works. The key is
     never part of a cache key or an error message. */
  const tmdb = async (path, params = {}) => {
    const q = new URLSearchParams({ language: 'en-US', ...params });
    const bearer = key.startsWith('eyJ');
    if (!bearer) q.set('api_key', key);
    const r = await get(API + path + '?' + q, {
      headers: { accept: 'application/json', ...(bearer ? { authorization: 'Bearer ' + key } : {}) }, ...timeout
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('TMDB answered ' + r.status);
    return r.json();
  };

  const send = (data, ttl) => new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + ttl, ...cors(origin) }
  });

  /* The page's answer is cached as a whole, keyed by the page's own URL —
     a find of twenty names is one lookup the second time, not twenty. */
  const cached = async (ttl, make) => {
    const ck = new Request('https://tmdb.cache' + url.pathname + url.search);
    if (edge) {
      const hit = await edge.match(ck).catch(() => null);
      if (hit) { const body = await hit.text(); return new Response(body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + ttl, 'x-tmdb-cache': 'hit', ...cors(origin) } }); }
    }
    let data;
    try { data = await make(); } catch (e) { return json({ error: 'could not reach TMDB' }, 502, origin); }
    if (data === null) return json({ error: 'not found' }, 404, origin);
    const res = send(data, ttl);
    if (edge) {
      const put = edge.put(ck, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + ttl } })).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(put);
    }
    return res;
  };

  const what = parts[1];
  const page = Math.min(Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1), 10);

  if (what === 'search' && !parts[2]) {
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 100);
    if (q.length < 2) return json({ error: 'search for at least two letters' }, 400, origin);
    return cached(TTL.search, async () => {
      const d = await tmdb('/search/multi', { query: q, include_adult: 'false', page: String(page) });
      return { results: ((d && d.results) || []).map(x => card(x)).filter(Boolean), more: !!(d && d.page < d.total_pages) };
    });
  }

  if (what === 'popular' && (parts[2] === 'movie' || parts[2] === 'tv') && !parts[3]) {
    return cached(TTL.popular, async () => {
      const d = await tmdb('/trending/' + parts[2] + '/week', { page: String(page) });
      return { results: ((d && d.results) || []).map(x => card(x, parts[2])).filter(Boolean) };
    });
  }

  if (what === 'discover' && (parts[2] === 'movie' || parts[2] === 'tv') && !parts[3]) {
    const params = discoverParams(parts[2], url.searchParams);
    if (!params) return json({ error: 'not a filter this room offers' }, 400, origin);
    return cached(TTL.discover, async () => {
      const d = await tmdb('/discover/' + parts[2], { ...params, page: String(page) });
      return {
        results: ((d && d.results) || []).map(x => card(x, parts[2])).filter(Boolean),
        more: !!(d && d.page < Math.min(d.total_pages, 10)),
        total: (d && d.total_results) || 0
      };
    });
  }

  if (what === 'title' && (parts[2] === 'movie' || parts[2] === 'tv') && /^\d{1,9}$/.test(parts[3] || '') && !parts[4]) {
    const kind = parts[2];
    return cached(TTL.title, async () => {
      const d = await tmdb('/' + kind + '/' + parts[3], {
        append_to_response: ['watch/providers', kind === 'movie' ? 'credits' : 'aggregate_credits', 'external_ids', 'recommendations'].join(',')
      });
      return d && title(d, kind);
    });
  }

  if (what === 'collection' && /^\d{1,9}$/.test(parts[2] || '') && !parts[3]) {
    return cached(TTL.collection, async () => {
      const d = await tmdb('/collection/' + parts[2]);
      if (!d) return null;
      const all = (d.parts || []).map(x => card(x, 'movie')).filter(Boolean)
        .sort((a, b) => (a.d || '9999').localeCompare(b.d || '9999'));
      return { id: d.id, name: String(d.name || '').slice(0, 200), parts: all };
    });
  }

  if (what === 'find' && !parts[2]) {
    const want = parseFind(url.searchParams.get('q'));
    if (!want.length || want.every(w => !w)) return json({ error: 'nothing to find' }, 400, origin);
    return cached(TTL.find, async () => {
      const items = await Promise.all(want.map(async w => {
        if (!w) return null;
        try {
          const path = w.k === 'movie' ? '/search/movie' : '/search/tv';
          const yk = w.k === 'movie' ? 'primary_release_year' : 'first_air_date_year';
          let d = w.y ? await tmdb(path, { query: w.t, [yk]: String(w.y), include_adult: 'false' }) : null;
          let got = d && pick(d.results, w, w.k);
          if (!got) { d = await tmdb(path, { query: w.t, include_adult: 'false' }); got = d && pick(d.results, w, w.k); }
          return got || null;
        } catch (e) { return null; }
      }));
      return { items };
    });
  }

  if (what === 'img' && SIZES.has(parts[2]) && /^[\w-]{4,64}\.jpg$/.test(parts[3] || '') && !parts[4]) {
    const src = IMG + parts[2] + '/' + parts[3];
    const ck = new Request(src);
    let r = edge ? await edge.match(ck).catch(() => null) : null;
    if (!r) {
      try { r = await get(src, timeout); } catch (e) { return json({ error: 'could not reach TMDB' }, 502, origin); }
      if (!r.ok) return json({ error: 'not found' }, 404, origin);
      const ct = r.headers.get('content-type') || '';
      if (!/^image\//.test(ct)) return json({ error: 'not an image' }, 502, origin);
      const buf = await r.arrayBuffer();
      r = new Response(buf, { headers: { 'content-type': ct, 'cache-control': 'public, max-age=' + TTL.img } });
      if (edge) { const put = edge.put(ck, r.clone()).catch(() => {}); if (ctx && ctx.waitUntil) ctx.waitUntil(put); }
    }
    return new Response(r.body, { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'image/jpeg', 'cache-control': 'public, max-age=' + TTL.img, ...cors(origin) } });
  }

  return json({ error: 'not found' }, 404, origin);
}
