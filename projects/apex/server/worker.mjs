/* APEX — the live match service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Holds what the screen watcher reads off Ric's own monitor while he plays:
   one record per match, the account-wide career panel when he opens it, and
   the per-legend banner when it comes into view. Nothing here is fetched from
   EA, because EA publishes nothing worth fetching — see the README.

       cd projects/apex/server
       npx wrangler@latest secret put APEX_TOKEN     # once, pick something long
       npx wrangler@latest deploy

   ── why this exists at all ──
   The old shape was `pull-apex.py` on a daily timer writing `apex-data.js` and
   committing it. That is a fine way to draw a slope and a hopeless way to say
   "he died forty seconds ago": a commit is a deploy, a deploy is a minute, and
   a day's play collapses into one reading. So the daily pull stays — it is
   still the only source for rank, level and online status — and everything the
   watcher sees comes here instead, where a write is live the moment it lands.

   ── why the whole security model is one token ──
   Same as the training log, for the same reason: Pages is static and the repo
   is public, so no check written in page JavaScript is worth anything. The
   gate sits here, where the public cannot read it. Reads are open — these are
   numbers Ric publishes on purpose — and every write needs the token.

   ── why a Durable Object ──
   A Worker is many isolates sharing no memory, so a match written in one would
   not exist for the next reader. This object genuinely writes to its SQLite
   storage: a match log is worth keeping. The volume is one person playing, a
   few dozen writes on a heavy night, which sits far inside the free plan. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/* ── what a match is allowed to be ────────────────────────────────────────
   The watcher reads pixels, and pixels lie: a 4 can come back a 1, a dropped
   frame can halve a number, an overlay can sit on a digit. So the shape below
   is not a convenience — it is the last place a misread can be stopped before
   it reaches the page and becomes "history".

   The columns are Ric's own. He tracked matches by hand in a spreadsheet for
   two months (Kills, Ast, Knocks, Place, Dmg, deaths, and a written note on
   what went wrong), and the point of the watcher is to stop him typing the
   half a machine can see. The half it cannot — WHY he died — stays his, and
   arrives later through the same endpoint as an edit. */
const MATCH_FIELDS = {
  /* value: [min, max] — an OCR read outside this is not "unusual", it is wrong.
     The ceilings are deliberately generous: they are there to catch a decimal
     point misread as a digit, not to have an opinion about how well he played. */
  kills:        [0, 60],
  assists:      [0, 60],
  knocks:       [0, 60],
  place:        [1, 30],
  damage:       [0, 20000],
  survival:     [0, 3600],      // seconds; a BR match cannot run an hour
  revives:      [0, 30],
  respawns:     [0, 30],
  squadSize:    [1, 3],
  rpBefore:     [0, 100000],
  rpAfter:      [0, 100000],
  level:        [1, 2000]
};

/* Free text the watcher never writes — these are Ric's, typed after the fact.
   `deathCategory` is a closed list in the spreadsheet and stays closed here:
   an open list becomes forty spellings of "third partied" and the page can no
   longer count them. */
const DEATH_CATEGORIES = new Set([
  'Third partied', 'Teammate split', 'Bad push', 'Lost 1v1', 'Overpeek',
  'Swung alone', 'Bad rotate', 'Zone', 'Missed shots', 'Focus fired',
  'No cover', 'Lost 3v1', 'Win!', 'Other'
]);

const MODES = new Set(['br', 'ranked', 'mixtape', 'ltm', 'control', 'unknown']);

/* How long two reads of the same numbers are treated as the same match.
   The watcher already debounces — one record per appearance of the summary
   screen — but a stream hiccup can make it see the screen arrive twice, and a
   duplicated match is worse than a missed one because it silently doubles a
   day's kills. Ninety seconds is longer than any flicker and far shorter than
   the gap between two real matches. */
const DUPLICATE_MS = 90 * 1000;

/* Constant-time compare. A plain === leaks the length of the matching prefix
   through timing, which is a real if slow way to recover a token. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* Reads are public by design, so the origin is echoed rather than policed —
   CORS is not what protects the writes, the token is. */
const cors = origin => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400'
});

const json = (body, status, origin, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin), ...extra }
  });

const clean = (s, max) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/* An integer, or null — and null is a real answer here. A tracker that was not
   equipped, a damage number an overlay sat on top of, a mode with no placement:
   the watcher is expected to say "I could not read this" rather than guess, and
   a zero would be a lie the page would then average. */
function intOrNull(v, field) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  const range = MATCH_FIELDS[field];
  if (range && (n < range[0] || n > range[1])) return null;
  return n;
}

export class ApexLog {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.token = env.APEX_TOKEN || '';
    /* Failed token attempts, in memory. There is exactly one instance of this
       object, so a plain array is a global counter, and losing it on eviction
       costs nothing — an attacker cannot cause an eviction. */
    this.fails = [];
  }

  /* Wrong tokens get slower: ten failures in five minutes and everything stops
     accepting them for the rest of that window. A static site cannot hide its
     API, so without a limit a short token falls in hours. */
  throttled() {
    const now = Date.now(), WINDOW = 5 * 60 * 1000, LIMIT = 10;
    this.fails = this.fails.filter(t => now - t < WINDOW);
    return this.fails.length >= LIMIT;
  }
  noteFail() { this.fails.push(Date.now()); }

  authed(request) {
    const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (this.token && sameSecret(given, this.token)) return true;
    this.noteFail();
    return false;
  }

  /* ══ MATCHES ═════════════════════════════════════════════════════════════

     Keys are `m:<iso>:<id>` so a prefix list comes back in time order and the
     newest page is a reverse list with a limit — no index to maintain and no
     scan of a season to show ten matches. */

  matchKey(at, id) { return `m:${at}:${id}`; }

  /* Everything the watcher is allowed to assert about a match. Rebuilt field by
     field rather than filtered, for the same reason the training Worker rebuilds
     a Strava activity: an allowlist survives the upstream changing shape, and
     here "upstream" is a script reading pixels that will grow fields as the OCR
     learns to see more. A blind copy is how an unreviewed field reaches a public
     page. */
  static shape(body, now) {
    const at = ISO.test(body.at || '') ? body.at : now;
    const m = {
      id: clean(body.id, 64) || crypto.randomUUID(),
      at,
      day: at.slice(0, 10),
      mode: MODES.has(body.mode) ? body.mode : 'unknown',
      legend: clean(body.legend, 40) || null,
      map: clean(body.map, 40) || null,
      playlist: clean(body.playlist, 60) || null,

      kills:    intOrNull(body.kills, 'kills'),
      assists:  intOrNull(body.assists, 'assists'),
      knocks:   intOrNull(body.knocks, 'knocks'),
      damage:   intOrNull(body.damage, 'damage'),
      place:    intOrNull(body.place, 'place'),
      survival: intOrNull(body.survival, 'survival'),
      revives:  intOrNull(body.revives, 'revives'),
      respawns: intOrNull(body.respawns, 'respawns'),

      rpBefore: intOrNull(body.rpBefore, 'rpBefore'),
      rpAfter:  intOrNull(body.rpAfter, 'rpAfter'),

      /* Ric's, not the watcher's. Absent until he writes them. */
      deathCategory: DEATH_CATEGORIES.has(body.deathCategory) ? body.deathCategory : null,
      deathNote: clean(body.deathNote, 2000) || null,

      /* ── the honesty fields ──
         `confidence` is what Tesseract said about each number it read, 0–1.
         `review` is this service's own verdict: true means something did not
         add up and a human should look before the number is trusted. The page
         renders a match under review differently rather than hiding it —
         hiding it would quietly drop the matches most worth checking. */
      /* ── what the fight was actually like ──
         Only LiveAPI can fill these; OCR of a summary screen cannot see them
         at all. Damage per weapon is the interesting one — it is the first
         thing here that says something about HOW a match went rather than how
         it scored.

         Note what is deliberately absent: no names, no positions, no account
         hashes. LiveAPI hands over every player in the lobby with live
         coordinates and a stable EA id, and none of that belongs on a public
         page. About the person who won the fight, this keeps the weapon and
         the legend — facts about the fight that identify nobody. */
      byWeapon: {},
      killedByWeapon: clean(body.killedByWeapon, 60) || null,
      killedByLegend: clean(body.killedByLegend, 40) || null,

      confidence: {},
      review: false,
      reviewWhy: [],
      /* Where the numbers came from, and it matters:

           liveapi  the game's own event stream. Exact integers out of Apex's
                    state — there is nothing to doubt and no confidence to
                    carry. This is the normal case now.
           watcher  OCR of a summary screen. A best effort at reading pixels,
                    and the reason every honesty field below exists. Still the
                    fallback for when LiveAPI is not permitted by a server.
           hand     Ric typed or corrected it. Settles the matter. */
      source: ['liveapi', 'hand', 'watcher'].includes(body.source) ? body.source : 'watcher',
      /* The filename of the frame the watcher kept, if it kept one. Not the
         image — that stays on his machine. This is so a wrong number on the
         page can be traced back to the exact pixels that produced it. */
      frame: clean(body.frame, 200) || null,
      edited: null
    };

    if (body.confidence && typeof body.confidence === 'object') {
      for (const [k, v] of Object.entries(body.confidence)) {
        if (k in MATCH_FIELDS && typeof v === 'number' && v >= 0 && v <= 1) {
          m.confidence[k] = Math.round(v * 100) / 100;
        }
      }
    }

    /* Damage per weapon. Capped at twelve because a match cannot meaningfully
       involve more than that and an unbounded map is an unbounded row. */
    if (body.byWeapon && typeof body.byWeapon === 'object') {
      for (const [weapon, amount] of Object.entries(body.byWeapon).slice(0, 12)) {
        const name = clean(weapon, 40);
        const n = intOrNull(amount, 'damage');
        if (name && n !== null) m.byWeapon[name] = n;
      }
    }

    /* ── the arithmetic that catches a misread ──
       These are not opinions about play, they are facts about Apex. A read
       that breaks one of them is a broken read, and saying so is cheaper than
       a wrong number living on the page forever.

       Deliberately NOT a rejection: the match is still stored. A rejected
       match is a match lost, and the whole point of watching the screen is
       that Apex will never tell us about it again. */
    const why = [];
    if (m.kills !== null && m.knocks !== null && m.kills > m.knocks) {
      /* Every kill is a knock first, in every mode where both are shown. */
      why.push('kills above knocks');
    }
    if (m.damage !== null && m.kills !== null && m.kills > 0 && m.damage < m.kills * 100) {
      /* A legend cannot be killed below 100 damage, so kills*100 is a floor
         the number simply cannot sit under. Assists muddy the ceiling; they
         cannot touch the floor. */
      why.push('damage below the floor its kills imply');
    }
    if (m.place !== null && m.place === 1 && m.survival !== null && m.survival < 240) {
      /* A win inside four minutes is not a win, it is a placement misread —
         except in mixtape, which has no placement at all. */
      if (m.mode === 'br' || m.mode === 'ranked') why.push('a win too short to be one');
    }
    for (const [k, c] of Object.entries(m.confidence)) {
      if (c < 0.6) why.push(`low confidence on ${k}`);
    }
    if (m.kills === null && m.damage === null && m.place === null) {
      why.push('nothing legible on the summary');
    }

    /* Two of these checks exist to catch a misread digit, and LiveAPI does not
       misread digits — its numbers are the game's own. Applying an OCR
       heuristic to an exact integer would mean flagging a legitimately strange
       match as a suspected error, which is worse than useless: it teaches the
       page's review flag to mean nothing.

       What IS worth flagging on a LiveAPI record is the listener's own
       disagreement with the game — it counts kills from combat events AND
       reads Apex's running totals, and if those two differ an event was
       missed. That arrives as `notes`. */
    if (m.source === 'liveapi') {
      const notes = Array.isArray(body.notes)
        ? body.notes.map(n => clean(n, 200)).filter(Boolean).slice(0, 8)
        : [];
      m.reviewWhy = notes;
      m.review = notes.length > 0;
      return m;
    }

    m.reviewWhy = why;
    m.review = why.length > 0 && m.source !== 'hand';
    return m;
  }

  /* The same summary screen read twice. Compared on the numbers rather than
     the id, because the watcher generates a fresh id each time it decides it
     is looking at a new match — which is exactly the decision that can go
     wrong when a stream stutters. */
  async duplicate(m) {
    const since = new Date(Date.parse(m.at) - DUPLICATE_MS).toISOString();
    const recent = await this.state.storage.list({
      prefix: 'm:', start: `m:${since}`, limit: 20
    });
    for (const prior of recent.values()) {
      if (prior.id === m.id) return prior;
      if (prior.kills === m.kills && prior.damage === m.damage &&
          prior.place === m.place && prior.legend === m.legend) return prior;
    }
    return null;
  }

  /* One row per day, so the page can draw a slope without reading a season of
     matches to do it. Rebuilt from the day's matches on every write rather
     than incremented: an increment that runs twice is silently wrong forever,
     and a day holds twenty matches, so recomputing costs nothing. */
  async rollDay(day) {
    const rows = [...(await this.state.storage.list({
      prefix: `m:${day}`, limit: 500
    })).values()];

    const sum = f => rows.reduce((a, r) => a + (r[f] ?? 0), 0);
    const seen = f => rows.filter(r => r[f] !== null).length;

    const roll = {
      d: day,
      matches: rows.length,
      kills: sum('kills'), assists: sum('assists'), knocks: sum('knocks'),
      damage: sum('damage'),
      wins: rows.filter(r => r.place === 1).length,
      top3: rows.filter(r => r.place !== null && r.place <= 3).length,
      /* Averages over the matches that could actually be read, not over all of
         them — dividing by matches whose damage came back null is how an
         unreadable frame quietly drags an average down. */
      avgKills: seen('kills') ? +(sum('kills') / seen('kills')).toFixed(2) : null,
      avgDamage: seen('damage') ? Math.round(sum('damage') / seen('damage')) : null,
      bestKills: rows.reduce((a, r) => Math.max(a, r.kills ?? 0), 0),
      bestDamage: rows.reduce((a, r) => Math.max(a, r.damage ?? 0), 0),
      review: rows.filter(r => r.review).length,
      updated: new Date().toISOString()
    };
    await this.state.storage.put(`day:${day}`, roll);
    return roll;
  }

  /* ══ SNAPSHOTS ═══════════════════════════════════════════════════════════

     The career panel and the legend banners. Both are screens Ric opens rather
     than screens that happen to him, so they arrive irregularly — which is why
     each one keeps its own `asOf` and the page says when it was last seen
     rather than implying it is current.

     Accumulate, never overwrite downward: these are lifetime counters, so a
     value that comes back lower than one already held is a misread or a stale
     frame, not lost kills. Same rule `pull-apex.py` has always followed for
     trackers; it is the one invariant that makes an unreliable reader safe. */
  async accumulate(key, incoming, now) {
    const prior = (await this.state.storage.get(key)) || { stats: {}, first: now };
    const stats = { ...prior.stats };
    const kept = [];

    for (const [name, value] of Object.entries(incoming)) {
      const n = intOrNull(value, null);
      if (n === null) continue;
      const was = stats[name];
      if (was && was.value > n) {
        /* Held. Recorded so the watcher's accuracy is inspectable rather than
           a matter of faith — if this fires constantly, the region is wrong. */
        kept.push({ name, held: was.value, saw: n });
        continue;
      }
      stats[name] = { value: n, asOf: now };
    }

    const snap = { stats, first: prior.first, updated: now, lastHeld: kept };
    await this.state.storage.put(key, snap);
    return snap;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const parts = url.pathname.split('/').filter(Boolean);
    const now = new Date().toISOString();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    /* Read the body once, here, before anything can decide to reject the
       request.

       This is not tidiness. Returning a response while a request body sits
       unread throws "Can't read from request stream after response has been
       sent" and takes the isolate down with it — so an unauthorized POST, the
       one request type this service should shrug off most cheaply, was killing
       the Worker for whoever asked next. Consuming it up front means the gate
       can refuse anything it likes and the stream is already dealt with. */
    let body = {};
    if (request.method === 'POST') {
      body = await request.json().catch(() => ({}));
      if (!body || typeof body !== 'object') body = {};
    }

    /* Every write path runs through here. Throttle first, so a flood of
       guesses costs a comparison and nothing else. */
    const gate = () => {
      if (!this.token) return json({ error: 'no token configured' }, 503, origin);
      if (this.throttled()) return json({ error: 'too many attempts' }, 429, origin);
      if (!this.authed(request)) return json({ error: 'unauthorized' }, 401, origin);
      return null;
    };

    /* ---------- POST /auth ----------
       The token IS the password; this exists only so the page can say whether
       what was typed will work, before it is used on something that matters. */
    if (parts[0] === 'auth') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      if (this.throttled()) return json({ error: 'too many attempts' }, 429, origin);
      // body already read above
      const given = clean(body.token, 200);
      if (given && this.token && sameSecret(given, this.token)) {
        return json({ ok: true }, 200, origin);
      }
      this.noteFail();
      return json({ ok: false }, 401, origin);
    }

    if (parts[0] !== 'apex') return json({ error: 'not found' }, 404, origin);

    /* ---------- POST /apex/match ----------
       The whole point. A summary screen appeared, the watcher read it, and it
       is here within a second of the numbers being on his monitor. */
    /* `!parts[2]` matters: without it this block also swallows
       POST /apex/match/<id>, and the edit endpoint below becomes unreachable
       code that silently creates a second match every time Ric corrects one. */
    if (parts[1] === 'match' && !parts[2] && request.method === 'POST') {
      const bad = gate(); if (bad) return bad;

      const m = ApexLog.shape(body, now);
      const dupe = await this.duplicate(m);
      if (dupe) {
        /* Not an error and not a write. The watcher retries when a POST times
           out, and a retry that lands after the first one succeeded must not
           double the day's kills. */
        return json({ ok: true, duplicate: true, id: dupe.id }, 200, origin);
      }

      await this.state.storage.put(this.matchKey(m.at, m.id), m);
      const day = await this.rollDay(m.day);
      return json({ ok: true, match: m, day }, 200, origin);
    }

    /* ---------- POST /apex/match/<id> ----------
       Ric correcting the record: the death category and note the watcher can
       never see, or a number it got wrong. A corrected field becomes `hand`
       and stops carrying a confidence, because there is nothing uncertain
       about it any more. */
    if (parts[1] === 'match' && parts[2] && request.method === 'POST') {
      const bad = gate(); if (bad) return bad;
      // body already read above

      const found = [...(await this.state.storage.list({ prefix: 'm:', limit: 2000 })).entries()]
        .find(([, v]) => v.id === parts[2]);
      if (!found) return json({ error: 'no such match' }, 404, origin);
      const [key, prior] = found;

      const next = { ...prior, edited: now };
      if ('deathCategory' in body) {
        next.deathCategory = DEATH_CATEGORIES.has(body.deathCategory) ? body.deathCategory : null;
      }
      if ('deathNote' in body) next.deathNote = clean(body.deathNote, 2000) || null;

      for (const f of ['kills', 'assists', 'knocks', 'damage', 'place', 'survival']) {
        if (!(f in body)) continue;
        const v = intOrNull(body[f], f);
        next[f] = v;
        delete next.confidence[f];
      }
      /* A hand edit settles it. The arithmetic checks stay useful for the
         watcher and would be an insult applied to a person reading their own
         screen. */
      if (body.resolved !== false) { next.review = false; next.reviewWhy = []; next.source = 'hand'; }

      await this.state.storage.put(key, next);
      const day = await this.rollDay(next.day);
      return json({ ok: true, match: next, day }, 200, origin);
    }

    /* ---------- POST /apex/career ----------
       The in-game career panel, which no API on earth returns. The watcher
       reads it when Ric opens it; until then the page shows the last one it
       saw, with the date it saw it. */
    if (parts[1] === 'career' && request.method === 'POST') {
      const bad = gate(); if (bad) return bad;
      // body already read above
      const snap = await this.accumulate('snap:career', body.stats || {}, now);
      return json({ ok: true, career: snap }, 200, origin);
    }

    /* ---------- POST /apex/legend ----------
       One legend's banner trackers. Same accumulator, keyed per legend, so
       twenty legends do not fight over one row. */
    if (parts[1] === 'legend' && parts[2] && request.method === 'POST') {
      const bad = gate(); if (bad) return bad;
      const name = clean(decodeURIComponent(parts[2]), 40);
      if (!name) return json({ error: 'which legend?' }, 400, origin);
      // body already read above
      const snap = await this.accumulate(`snap:legend:${name}`, body.stats || {}, now);
      return json({ ok: true, legend: name, stats: snap }, 200, origin);
    }

    /* ---------- POST /apex/status ----------
       Is he playing right now. The watcher sends this when the game window
       appears and again when it goes away; the page treats anything older
       than a few minutes as stale on its own, so a watcher killed mid-session
       leaves a page that says "not playing", not one stuck on "in a match". */
    if (parts[1] === 'status' && request.method === 'POST') {
      const bad = gate(); if (bad) return bad;
      // body already read above
      const status = {
        state: clean(body.state, 20) || 'unknown',   // playing | lobby | away
        screen: clean(body.screen, 40) || null,      // what the watcher last recognised
        legend: clean(body.legend, 40) || null,
        at: now
      };
      await this.state.storage.put('snap:status', status);
      return json({ ok: true, status }, 200, origin);
    }

    /* ---------- GET /apex/matches ----------
       Newest first. `limit` caps at 200 because a page that wants a season
       wants the day rollups, not two thousand rows. */
    if (parts[1] === 'matches' && request.method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 200);
      const day = url.searchParams.get('day');
      const opts = day && DAY.test(day)
        ? { prefix: `m:${day}`, limit }
        : { prefix: 'm:', limit, reverse: true };
      const rows = [...(await this.state.storage.list(opts)).values()];
      if (day) rows.reverse();
      return json({ matches: rows }, 200, origin);
    }

    /* ---------- GET /apex/days ----------
       The slope. One row a day, which is what the graph on the page is drawn
       from — and unlike the old `history` array in apex-data.js, a day here is
       built from real matches rather than from the difference between two
       snapshots of a cumulative counter. */
    if (parts[1] === 'days' && request.method === 'GET') {
      const rows = [...(await this.state.storage.list({ prefix: 'day:', limit: 800 })).values()];
      return json({ days: rows }, 200, origin);
    }

    /* ---------- GET /apex ----------
       Everything the page needs in one request, because the page is a static
       file on Pages and a waterfall of four fetches is four round trips before
       anything renders. */
    if (parts.length === 1 && request.method === 'GET') {
      const [status, career, days, matches, legends] = await Promise.all([
        this.state.storage.get('snap:status'),
        this.state.storage.get('snap:career'),
        this.state.storage.list({ prefix: 'day:', limit: 400 }),
        this.state.storage.list({ prefix: 'm:', limit: 25, reverse: true }),
        this.state.storage.list({ prefix: 'snap:legend:', limit: 100 })
      ]);

      const byLegend = {};
      for (const [k, v] of legends.entries()) byLegend[k.slice('snap:legend:'.length)] = v;

      return json({
        generated: now,
        /* Not one source any more. Matches arrive from Apex's LiveAPI, the
           career panel from OCR, and each record says which for itself — so a
           single label up here would be a lie about at least one of them. */
        source: 'apex-live',
        status: status || null,
        career: career || null,
        legends: byLegend,
        days: [...days.values()],
        recent: [...matches.values()]
      }, 200, origin, {
        /* Ten seconds. Long enough that a page shared around does not hammer
           the object, short enough that "instantly" survives the round trip. */
        'cache-control': 'public, max-age=10'
      });
    }

    return json({ error: 'not found' }, 404, origin);
  }
}

export default {
  async fetch(request, env) {
    /* One object, always the same one — this is a log with a single writer, so
       there is nothing to shard and a fixed name keeps it findable. */
    const id = env.APEX.idFromName('ric');
    return env.APEX.get(id).fetch(request);
  }
};
