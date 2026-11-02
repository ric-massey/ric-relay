/* The finder — "help you find a movie to watch" (Ric, 2026-11-02: "i want it
   to be a website of all the movies and will help you find a movie to watch").

   The list (room.js) is the films Ric has seen or means to. This is every
   other film and show, through the Worker's /tmdb: what is trending, films
   like the ones he scored highest, and a picker — mood, genre, service,
   length, score, decade — that becomes one /tmdb/discover query. Any card
   opens the same sheet as the list does, so the tick works the same way on
   a film found here as on one already on the list.

   The filter rules live in the top half of this file with no DOM in it, so
   projects/entertainment/test/finder.mjs can hold every mood, genre and
   service to the ids the Worker accepts (worker/tmdb.mjs, discoverParams).
   Change a list here, run the test.

   A mood is only a set of genres to include and exclude, and the page says
   which ("Comedy · no horror") under the chips. It filters what TMDB has; it
   never re-sorts or re-shelves Ric's own list, which stays ordered by fact
   (projects/entertainment/README.md, "Shelves are ordered by fact"). */
(function (root) {
  'use strict';

  /* TMDB's genre ids. Shows have their own set — "Sci-Fi & Fantasy" is one
     genre there — and no horror or romance at all. */
  const GENRES = {
    movie: [[28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'],
      [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'], [14, 'Fantasy'], [36, 'History'],
      [27, 'Horror'], [10402, 'Music'], [9648, 'Mystery'], [10749, 'Romance'], [878, 'Sci-fi'],
      [53, 'Thriller'], [10752, 'War'], [37, 'Western']],
    tv: [[10759, 'Action & adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'],
      [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'], [10762, 'Kids'], [9648, 'Mystery'],
      [10764, 'Reality'], [10765, 'Sci-fi & fantasy'], [10768, 'War & politics'], [37, 'Western']]
  };
  const genreName = (kind, id) => (GENRES[kind].find(g => g[0] === id) || [0, ''])[1];

  /* [key, label, movie {g, gx}, tv {g, gx} or null when shows have nothing
     that means it]. */
  const MOODS = [
    ['laugh', 'Make me laugh', { g: [35], gx: [27] }, { g: [35] }],
    ['edge', 'Edge of my seat', { g: [53, 9648], gx: [16, 10751] }, { g: [9648, 80] }],
    ['loud', 'Big and loud', { g: [28, 12] }, { g: [10759] }],
    ['scare', 'Scare me', { g: [27] }, null],
    ['good', 'Feel good', { g: [10751, 10749, 16, 10402], gx: [27, 53, 80, 10752] }, { g: [10751, 35], gx: [80, 9648] }],
    ['bend', 'Mind-bending', { g: [878, 9648] }, { g: [10765] }],
    ['cry', 'A good cry', { g: [18, 10749], gx: [35, 28, 27] }, { g: [18], gx: [35] }],
    ['true', 'True stories', { g: [99, 36] }, { g: [99] }]
  ];

  /* The key is what the Worker knows; the name is what the room calls the
     service everywhere else (and colours it by — room.js's TINTS). */
  const SERVICES = [['netflix', 'Netflix'], ['prime', 'Prime Video'], ['disney', 'Disney+'],
    ['max', 'Max'], ['hulu', 'Hulu'], ['apple', 'Apple TV+'], ['peacock', 'Peacock'],
    ['paramount', 'Paramount+'], ['tubi', 'Tubi'], ['pluto', 'Pluto TV'], ['starz', 'Starz'], ['amc', 'AMC+']];
  const LENGTHS = [['short', 'Under 1h40'], ['mid', '1h30 to 2h10'], ['long', 'Over 2h10']];
  const SCORES = [['6', '60+'], ['7', '70+'], ['8', '80+']];
  const ERAS = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950];
  const SORTS = [['popular', 'Popular'], ['rated', 'Best rated'], ['new', 'Newest']];

  function moodFor(kind, key) {
    const m = MOODS.find(x => x[0] === key);
    return m ? (kind === 'tv' ? m[3] : m[2]) : null;
  }

  /* The picker's state → the Worker path, or '' when nothing is picked (then
     the page shows trending and "because he liked" instead of a grid). */
  function query(st, page) {
    const kind = st.kind === 'tv' ? 'tv' : 'movie';
    const q = new URLSearchParams();
    let g = [], gx = [];
    const m = st.mood && moodFor(kind, st.mood);
    if (m) { g = m.g.slice(); gx = (m.gx || []).slice(); }
    /* A genre picked on top of a mood narrows to that genre — and drops it
       from the mood's exclusions, so "Scare me" + Comedy is horror-comedy,
       not nothing. */
    if (st.genre && GENRES[kind].some(x => x[0] === Number(st.genre))) {
      g = [Number(st.genre)];
      gx = gx.filter(x => x !== Number(st.genre));
    }
    if (g.length) q.set('g', g.join('.'));
    if (gx.length) q.set('gx', gx.join('.'));
    if (st.on && SERVICES.some(s => s[0] === st.on)) q.set('on', st.on);
    if (st.len && LENGTHS.some(l => l[0] === st.len)) q.set('len', st.len);
    if (st.min && SCORES.some(s => s[0] === String(st.min))) q.set('min', String(st.min));
    if (st.era && ERAS.includes(Number(st.era))) q.set('era', String(st.era));
    const picked = [...q.keys()].length > 0;
    if (st.sort && st.sort !== 'popular' && SORTS.some(s => s[0] === st.sort)) q.set('sort', st.sort);
    if (!picked && !q.has('sort')) return '';
    if (page > 1) q.set('page', String(page));
    return '/discover/' + kind + '?' + q.toString();
  }

  /* What the picker is asking for, in words, so a mood is never a black box. */
  function said(st) {
    const kind = st.kind === 'tv' ? 'tv' : 'movie';
    const out = [];
    const m = st.mood && moodFor(kind, st.mood);
    if (st.genre) out.push(genreName(kind, Number(st.genre)));
    else if (m) out.push(m.g.map(id => genreName(kind, id)).join(' or '));
    if (m && (m.gx || []).length) out.push('no ' + m.gx.filter(x => x !== Number(st.genre))
      .map(id => genreName(kind, id).toLowerCase()).join(', '));
    const s = SERVICES.find(x => x[0] === st.on);
    if (s) out.push('on ' + s[1]);
    const l = LENGTHS.find(x => x[0] === st.len);
    if (l) out.push(l[1].toLowerCase());
    if (st.min) out.push('audience ' + st.min + '0+');
    if (st.era) out.push('the ' + st.era + 's');
    return out.filter(Boolean).join(' · ');
  }

  const Finder = { GENRES, MOODS, SERVICES, LENGTHS, SCORES, ERAS, SORTS, query, said, moodFor };
  if (typeof module === 'object' && module.exports) { module.exports = Finder; return; }
  root.Finder = Finder;

  /* ── the page half ── everything below needs a document and Room. */
  if (typeof document === 'undefined' || !root.Room) return;
  const Room = root.Room, esc = Room.esc;
  const el = id => document.getElementById(id);
  const KEY = 'entertainmentFinder';
  let st = { kind: 'movie', mood: '', genre: '', on: '', len: '', min: '', era: '', sort: 'popular', unseen: false };
  try { st = Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* this visit only */ } };

  let results = [], page = 1, more = false, seq = 0, off = false;
  const rails = { trending: null, because: [] };

  const opt = (v, label, cur) => '<option value="' + esc(v) + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(label) + '</option>';
  const select = (name, label, first, items, cur) =>
    '<label class="fsel"><span>' + esc(label) + '</span><select data-f="' + name + '">' + opt('', first, cur) +
      items.map(([v, l]) => opt(v, l, cur)).join('') + '</select></label>';

  function drawControls() {
    const kind = st.kind;
    el('fmoods').innerHTML = MOODS.filter(m => kind === 'movie' || m[3]).map(m =>
      '<button type="button" class="mood" data-mood="' + m[0] + '" aria-pressed="' + (st.mood === m[0]) + '">' +
        esc(m[1]) + '</button>').join('');
    el('fkind').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    el('ffilters').innerHTML =
      select('genre', 'Genre', 'Any genre', GENRES[kind], st.genre) +
      select('on', 'Streaming on', 'Anywhere', SERVICES, st.on) +
      select('len', 'Length', 'Any length', LENGTHS, st.len) +
      select('min', 'Audience score', 'Any score', SCORES, st.min) +
      select('era', 'Decade', 'Any decade', ERAS.map(y => [y, y + 's']), st.era) +
      select('sort', 'Sort', 'Popular', SORTS.slice(1), st.sort === 'popular' ? '' : st.sort) +
      '<label class="fcheck"><input type="checkbox" data-f="unseen"' + (st.unseen ? ' checked' : '') + '>' +
        '<span>Hide what Ric has seen</span></label>';
  }

  const visible = list => st.unseen ? list.filter(c => !Room.isSeen(c)) : list;
  const grid = list => '<ul class="look-grid">' + list.map(Room.cardHtml).join('') + '</ul>';

  function drawResults() {
    const out = el('fresults');
    const path = query(st, 1);
    el('fsaid').textContent = path ? said(st) || (SORTS.find(s => s[0] === st.sort) || [0, ''])[1] : '';
    el('fclear').hidden = !path;
    if (!path || off) { out.innerHTML = ''; drawRails(); return; }
    el('frails').innerHTML = '';
    const shown = visible(results);
    out.innerHTML = (shown.length ? grid(shown)
      : (results.length ? '<p class="thin">Ric has seen everything on this page.</p>' : '<p class="thin">Nothing matches all of that. Take one filter off.</p>')) +
      (more ? '<button type="button" class="btn fmore" id="fmore">More</button>' : '');
  }

  function rail(title, note, list) {
    const shown = visible(list);
    if (!shown.length) return '';
    return '<section class="frail"><h3>' + title + (note ? ' <span>' + esc(note) + '</span>' : '') + '</h3>' +
      '<ul class="look-rail">' + shown.map(Room.cardHtml).join('') + '</ul></section>';
  }

  function drawRails() {
    const box = el('frails');
    if (query(st, 1) && !off) { box.innerHTML = ''; return; }
    const kind = st.kind;
    let html = off ? '<p class="thin">The filters are not switched on yet — here is what everyone is watching.</p>' : '';
    if (rails.trending && rails.trending[kind]) html += rail('Trending this week', kind === 'tv' ? 'shows' : 'films', rails.trending[kind]);
    for (const b of rails.because) html += rail('Because Ric liked <i>' + esc(b.title) + '</i>', b.mine ? b.mine + '/100' : '', b.like);
    box.innerHTML = html || '<p class="thin">Asking what is on…</p>';
  }

  async function run() {
    const path = query(st, 1);
    keep();
    drawControls();
    if (!path) { drawResults(); loadRails(); return; }
    const my = ++seq;
    page = 1;
    el('fresults').innerHTML = '<p class="thin">Looking…</p>';
    try {
      const d = await Room.tmdb(path);
      if (my !== seq) return;
      off = false;
      results = d.results || []; more = !!d.more;
    } catch (err) {
      if (my !== seq) return;
      /* An older Worker has no /discover yet (404), or no key (503): the
         trending and "because" rows still work on the routes it has. */
      off = err.status === 404 || err.status === 400;
      results = []; more = false;
      if (!off) { el('fresults').innerHTML = '<p class="thin">' + (err.status === 503
        ? 'Looking up films is not switched on yet.' : 'Could not ask just now.') + '</p>'; return; }
      loadRails();
    }
    drawResults();
  }

  async function next() {
    const my = seq;
    try {
      const d = await Room.tmdb(query(st, page + 1));
      if (my !== seq) return;
      page += 1;
      const have = new Set(results.map(c => c.k + c.id));
      results = results.concat((d.results || []).filter(c => !have.has(c.k + c.id)));
      more = !!d.more;
      drawResults();
    } catch (e) { /* the button stays; try again */ }
  }

  /* "Because Ric liked": his highest scores first, then what he watched
     most recently — three of them, each with TMDB's films like it. */
  let railsLoading = false;
  async function loadRails() {
    if (railsLoading) return;
    railsLoading = true;
    const kind = st.kind;
    rails.trending = rails.trending || {};
    const jobs = [];
    if (!rails.trending[kind]) jobs.push(Room.tmdb('/popular/' + kind).then(d => { rails.trending[kind] = d.results || []; }, () => {}));
    if (!rails.because.length) {
      const seenRows = Room.all().filter(e => e.status === 'watched' && e.tmdb);
      const recent = e => e.seen ? Date.parse(e.seen) : -1e12 + (e.ord || 0);
      const seeds = seenRows.slice().sort((a, b) => (b.mine || 0) - (a.mine || 0) || recent(b) - recent(a)).slice(0, 3);
      for (const e of seeds) jobs.push(Room.tmdb('/title/' + (e.kind === 'tv' ? 'tv' : 'movie') + '/' + e.tmdb).then(d => {
        if ((d.like || []).length) rails.because.push({ title: e.title, mine: e.mine, like: d.like, at: seeds.indexOf(e) });
      }, () => {}));
    }
    drawRails();
    await Promise.all(jobs);
    rails.because.sort((a, b) => a.at - b.at);
    railsLoading = false;
    drawRails();
  }

  function surprise() {
    let pool = query(st, 1) && !off ? results : [].concat((rails.trending || {})[st.kind] || [], ...rails.because.map(b => b.like));
    pool = pool.filter(c => !Room.isSeen(c) && c.p);
    if (!pool.length) return;
    Room.openCard(pool[Math.floor(Math.random() * pool.length)]);
  }

  function wire() {
    const box = el('finder');
    box.addEventListener('click', ev => {
      const t = ev.target;
      const k = t.closest('button[data-kind]');
      if (k) { st.kind = k.dataset.kind; if (st.mood && !moodFor(st.kind, st.mood)) st.mood = ''; st.genre = ''; run(); return; }
      const m = t.closest('button[data-mood]');
      if (m) { st.mood = st.mood === m.dataset.mood ? '' : m.dataset.mood; run(); return; }
      if (t.closest('#fmore')) { next(); return; }
      if (t.closest('#fclear')) { Object.assign(st, { mood: '', genre: '', on: '', len: '', min: '', era: '', sort: 'popular' }); run(); return; }
      if (t.closest('#fsurprise')) surprise();
    });
    box.addEventListener('change', ev => {
      const f = ev.target.dataset && ev.target.dataset.f;
      if (!f) return;
      if (f === 'unseen') { st.unseen = ev.target.checked; keep(); drawResults(); drawRails(); return; }
      st[f] = f === 'sort' ? (ev.target.value || 'popular') : ev.target.value;
      run();
    });
    /* The phone has no search in the bar; this one hands its words to the
       page's own search, so there is one search with two boxes. */
    const fq = el('fq'), q = el('q');
    if (fq && q) fq.addEventListener('input', () => {
      q.value = fq.value;
      q.dispatchEvent(new Event('input'));
    });
  }

  /* The page calls this from its render(): a tick or an untick redraws the
     ✓ on every card without asking TMDB again. */
  let booted = false;
  root.Finder.render = function () {
    if (!el('finder')) return;
    if (!booted) { booted = true; wire(); run(); return; }
    drawResults();
    drawRails();
  };
})(typeof window !== 'undefined' ? window : globalThis);
