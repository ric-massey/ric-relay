/* The Entertainment room's shared core — used by entertainment.html (the app)
   and entertainment-library.html (the catalog).

   The two pages are different rooms of the same house: one is built for
   deciding, one for looking things up. What they cannot be is two copies of the
   list logic. The merge order, the tombstones, the write path and the export
   format all have exactly one definition, and it is here.

   Hard rule 3 is about not flattening the SITE into one template. Inside a
   single room, one file is how you keep two pages telling the same truth.

   What a page gets:

     Room.boot({ render })   wires the host probe, the owner panel and the
                             Worker read, then calls render() whenever the list
                             changes. Call it once, last.
     Room.all()              the merged list — committed file, then Worker,
                             then this browser's un-sent edits.
     Room.save(id, patch)    write one change, wherever it can go.
     Room.tile(e, rank)      a poster tile, ranked or not.
     Room.openSheet(id)      the detail dialog.
     Room.watchLinks(e)      where you could actually watch it.
     Room.esc / .hue / .slug / .subline / .exportFile

   The page owns its own layout and supplies #sheet, #owner-box, #owner-tools
   and #owner-blurb. Everything else is here. */
(function () {
  'use strict';

  /* ── where the service lives ──
     Same lesson climb-host.js learned and wrote down: on localhost a Worker may
     be running locally, so try the origin first — but a plain static dev server
     answers /movies with a 404, and taking that as "no data" silently is how a
     page ends up looking finished and being months stale. So localhost is a
     preference, not a rule, and the live Worker is the fallback. */
  const LIVE = 'https://training-log.rmbuster82.workers.dev';
  const LOCALHOST = location.origin.includes('localhost') || location.origin.includes('127.0.0.1');
  let HOST = LOCALHOST ? location.origin : LIVE;

  async function hostFetch(path, init) {
    if (!LOCALHOST) return fetch(LIVE + path, init);
    try {
      const r = await fetch(location.origin + path, init);
      if (r.ok) { HOST = location.origin; return r; }
    } catch (e) { /* nothing listening locally */ }
    HOST = LIVE;
    return fetch(LIVE + path, init);
  }

  /* HOST is only a guess until something has actually asked, and owner.js takes
     its host by value at init(). Sign in before the probe settles and every
     write goes at the dev server instead of the Worker — the same trap
     ClimbHost.resolved() exists for. */
  let probing = null;
  function resolvedHost() {
    if (!LOCALHOST) return Promise.resolve(LIVE);
    if (!probing) probing = hostFetch('/movies', { cache: 'no-store' })
      .then(() => HOST, () => HOST);
    return probing;
  }

  /* ── the three layers ──
     BASE is the committed file and never changes in the browser. REMOTE is what
     the Worker knows. LOCAL is what this browser has been told and could not
     send anywhere. Merged in that order at read time, so the committed list
     always renders on its own and every layer above it only ever adds.

     `ord` is BASE order, kept because it is the only clue the 238 watched rows
     carry about sequence. See recency() in the app page. */
  const BASE = (window.ENTERTAINMENT_DATA || []).map((e, i) =>
    Object.freeze(Object.assign({}, e, { ord: i })));
  const LKEY = 'entertainmentEdits';
  let REMOTE = {};
  let LOCAL = readLocal();
  let onRender = function () {};

  function readLocal() { try { return JSON.parse(localStorage.getItem(LKEY) || '{}'); } catch (e) { return {}; } }
  function writeLocal(v) {
    try {
      Object.keys(v).length ? localStorage.setItem(LKEY, JSON.stringify(v)) : localStorage.removeItem(LKEY);
    } catch (e) { /* private mode — the edit still shows this session */ }
  }

  const slug = t => t.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* One list, every layer folded in. Deleting is a tombstone rather than a
     removal, because the committed file underneath would otherwise put the row
     straight back on the next load. */
  function all() {
    const by = new Map();
    for (const e of BASE) by.set(e.id, Object.assign({}, e));
    for (const src of [REMOTE, LOCAL]) {
      for (const [id, patch] of Object.entries(src || {})) {
        if (!patch) continue;
        if (patch.removed) { by.delete(id); continue; }
        const prev = by.get(id) || { id: id, ord: 1e6 };
        by.set(id, Object.assign({}, prev, patch, { local: src === LOCAL || prev.local }));
      }
    }
    return [...by.values()];
  }

  const pending = () => Object.keys(LOCAL).length;

  /* ── where to actually watch it ──
     A link is not a dependency: nothing here loads until it is clicked, and the
     page still opens off disk with no network. So every title gets a way out.

     Title search, never a per-title deep link. Service URLs for a specific film
     rot — they get re-slugged, regionalised, pulled — and a dead link is worse
     than a search box that always works. The name is what does not change. */
  const SERVICES = {
    'netflix':      ['Netflix',      t => 'https://www.netflix.com/search?q=' + t],
    'hulu':         ['Hulu',         t => 'https://www.hulu.com/search?q=' + t],
    'disney+':      ['Disney+',      t => 'https://www.disneyplus.com/search?q=' + t],
    'disney plus':  ['Disney+',      t => 'https://www.disneyplus.com/search?q=' + t],
    'prime video':  ['Prime Video',  t => 'https://www.amazon.com/s?i=instant-video&k=' + t],
    'prime':        ['Prime Video',  t => 'https://www.amazon.com/s?i=instant-video&k=' + t],
    'max':          ['Max',          t => 'https://play.max.com/search?q=' + t],
    'hbo max':      ['Max',          t => 'https://play.max.com/search?q=' + t],
    'apple tv+':    ['Apple TV+',    t => 'https://tv.apple.com/search?term=' + t],
    'apple tv':     ['Apple TV',     t => 'https://tv.apple.com/search?term=' + t],
    'peacock':      ['Peacock',      t => 'https://www.peacocktv.com/search?q=' + t],
    'paramount+':   ['Paramount+',   t => 'https://www.paramountplus.com/search/?query=' + t],
    'pluto tv':     ['Pluto TV',     t => 'https://pluto.tv/en/search/details?query=' + t],
    'tubi':         ['Tubi',         t => 'https://tubitv.com/search/' + t],
    'starz':        ['Starz',        t => 'https://www.starz.com/us/en/search?q=' + t],
    'plex':         ['Plex',         t => 'https://watch.plex.tv/search?q=' + t],
    'showtime':     ['Showtime',     t => 'https://www.sho.com/search?q=' + t],
    'amc+':         ['AMC+',         t => 'https://www.amcplus.com/search?q=' + t]
  };

  /* The colours are the ones people recognise a service by, used as a tint dark
     enough that the name still clears 7:1 on it. */
  const TINTS = {
    'Netflix': '#e50914', 'Hulu': '#1ce783', 'Disney+': '#3ba0ff', 'Prime Video': '#00a8e1',
    'Max': '#9a6bff', 'HBO Max': '#9a6bff', 'Apple TV+': '#dedede', 'Peacock': '#ffb800',
    'Paramount+': '#4d8bff', 'Pluto TV': '#ffe300', 'Tubi': '#ff6a2b', 'Starz': '#5ab0e6',
    'Plex': '#e5a00d', 'Showtime': '#ff4d4d', 'AMC+': '#37b6ff', 'Buy': '#f5c518'
  };
  const tintOf = name => TINTS[name] || '#8a8a8a';
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',') + ',' + a + ')';
  }

  /* Availability is the one fact on this page with a shelf life — things leave
     Hulu monthly — so it is never stored, only resolved the moment someone
     asks. This link is the answer to "where is it" for all 363. */
  const anywhere = t => 'https://www.justwatch.com/us/search?q=' + encodeURIComponent(t);
  const buyUrl   = t => 'https://www.amazon.com/s?i=instant-video&k=' + encodeURIComponent(t);
  const plainTitle = t => t.replace(/\s*\((?:all|\d+\s*-\s*\d+)\)\s*$/i, '').trim();

  /* "Plex / Tubi" is one field naming two places. Split it and offer both. */
  const places = e => String(e.where || '').split(/\s*[\/,]\s*/).map(p => p.trim()).filter(Boolean);

  function watchLinks(e) {
    const t = encodeURIComponent(plainTitle(e.title));
    const out = [];
    for (const part of places(e)) {
      const hit = SERVICES[part.toLowerCase()];
      if (hit) out.push({ label: 'Watch on ' + hit[0], url: hit[1](t) });
    }
    if (/^buy$/i.test(e.where || '')) out.push({ label: 'Buy or rent it', url: buyUrl(plainTitle(e.title)) });
    out.push({ label: out.length ? 'Find it elsewhere' : "Where's it streaming?", url: anywhere(plainTitle(e.title)) });
    return out;
  }

  /* ── the art ──
     No <img> until pull-tmdb.py has actually put a file there. A poster that
     might not exist is 363 404s and a page full of broken-image frames; the
     plate is a designed state, so there is nothing to apologise for. */

  /* A stable hue per title, so the wall of plates reads as a set rather than as
     noise, and the same film is the same colour on every visit. */
  function hue(e, light) {
    let h = 0;
    for (let i = 0; i < e.id.length; i++) h = (h * 31 + e.id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 22% ' + light + '%)';
  }

  function artHtml(e) {
    if (e.poster) {
      return '<img src="assets/posters/' + esc(e.id) + '.jpg" alt="" loading="lazy" ' +
             'decoding="async" width="342" height="513">';
    }
    const sub = e.year ? e.year
      : e.count ? e.count + ' films'
      : e.series ? 'the lot'
      : e.status === 'watched' ? 'seen' : 'queued';
    return '<span class="plate" style="--plate-bg:' + hue(e, e.status === 'watched' ? 13 : 16) + '">' +
           '<b>' + esc(e.title) + '</b><span>' + esc(sub) + '</span></span>';
  }

  function badge(e) {
    if (e.pick) return '<span class="badge">★ starred</span>';
    if (e.status === 'watched') return '<span class="badge seen">✓ seen</span>';
    return '';
  }

  const hhmm = m => Math.floor(m / 60) + 'h ' + (m % 60) + 'm';

  function subline(e) {
    const bits = [];
    if (e.year) bits.push(e.year);
    if (e.runtime) bits.push(hhmm(e.runtime));
    if (!bits.length && e.count) bits.push(e.count + ' films');
    if (!bits.length && e.series) bits.push('the whole lot');
    if (!bits.length && e.where) bits.push(/^buy$/i.test(e.where) ? 'have to buy' : e.where);
    return bits.join(' · ');
  }

  function tile(e, rank) {
    /* The plate already sets the title large and says what state it is in, so a
       caption under it would print the same words twice. Captions belong to
       poster tiles, where the art cannot say the name. */
    const inner =
      '<span class="art">' + artHtml(e) + badge(e) + '</span>' +
      (e.poster
        ? '<span class="tile-name">' + esc(e.title) + '</span>' +
          '<span class="tile-sub">' + esc(subline(e)) + '</span>'
        : '');
    const cls = 'tile ' + (e.status === 'watched' ? 'is-watched' : 'is-queue') + (rank ? ' ranked' : '');
    return '<button class="' + cls + '" type="button" data-id="' + esc(e.id) + '">' +
      (rank ? '<span class="rank" aria-hidden="true">' + rank + '</span>' : '') + inner + '</button>';
  }

  const PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" ' +
    'aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  /* ── the detail sheet ── what a title is, when the name is not enough ── */
  const el = id => document.getElementById(id);
  let sheet = null;

  function openSheet(id) {
    const e = all().find(x => x.id === id);
    if (!e || !sheet) return;
    const meta = [];
    if (e.year) meta.push(esc(e.year));
    if (e.rating) meta.push('<span class="score">★ ' + esc(e.rating) + '</span>');
    if (e.runtime) meta.push(hhmm(e.runtime));
    if (e.genres && e.genres.length) meta.push(esc(e.genres.join(' · ')));
    if (e.director) meta.push(esc(e.director));
    if (e.count) meta.push(esc(e.count + ' films'));
    meta.push(e.status === 'watched' ? '✓ seen' : 'in the queue');
    if (e.seen) meta.push('watched ' + esc(new Date(e.seen).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' })));

    const links = watchLinks(e);
    const own = window.Owner && Owner.on()
      ? '<div class="sheet-own">' +
          (e.status === 'watchlist'
            ? '<button type="button" data-act="watched" data-id="' + esc(e.id) + '">Mark watched</button>'
            : '<button type="button" data-act="watchlist" data-id="' + esc(e.id) + '">Back to queue</button>') +
          '<button type="button" data-act="pick" data-id="' + esc(e.id) + '">' + (e.pick ? 'Unstar' : 'Star it') + '</button>' +
          '<button type="button" class="danger" data-act="remove" data-id="' + esc(e.id) + '">Remove</button>' +
        '</div>'
      : '';

    el('sheet-in').innerHTML =
      '<div class="sheet-art">' + artHtml(e) + '</div>' +
      '<div class="sheet-body">' +
        '<h3>' + esc(e.title) + '</h3>' +
        '<p class="sheet-meta">' + meta.join('') + '</p>' +
        (e.overview
          ? '<p class="blurb">' + esc(e.overview) + '</p>'
          : '<p class="thin">No synopsis yet — run <code>projects/entertainment/pull-tmdb.py</code> ' +
            'and this fills in with the year, the runtime, who directed it and what it is about.</p>') +
        (e.note ? '<p class="thin">' + esc(e.note) + '</p>' : '') +
        (e.local ? '<p class="thin">This edit is saved in this browser only — not committed yet.</p>' : '') +
        '<div class="sheet-acts">' +
          links.map((l, i) => '<a class="btn ' + (i === 0 ? 'btn-gold' : '') + '" href="' + esc(l.url) +
            '" target="_blank" rel="noopener noreferrer">' + (i === 0 ? PLAY : '') + esc(l.label) + '</a>').join('') +
        '</div>' + own +
      '</div>';
    if (!sheet.open) sheet.showModal();
  }

  /* ── writing ──
     Try the Worker; fall back to this browser. Either way the UI has already
     been told what happened by the time render() runs, so a tap never sits
     there looking like it did nothing. */
  async function save(id, patch) {
    const body = { id: id };
    for (const k in patch) body[k] = patch[k];
    if (window.Owner && Owner.on()) {
      const out = await Owner.post('/movies/' + id, body, { queue: true });
      if (out && !out.queued) {                 // the Worker took it
        REMOTE[id] = Object.assign({}, REMOTE[id] || {}, patch);
        delete LOCAL[id];
        writeLocal(LOCAL);
        onRender();
        return;
      }
      /* queued (no signal) or refused (no endpoint yet) — keep it here, and
         keep it visibly uncommitted rather than pretending it landed. */
    }
    LOCAL[id] = Object.assign({}, LOCAL[id] || {}, patch);
    writeLocal(LOCAL);
    onRender();
  }

  const today = () => new Date().toISOString().slice(0, 10);

  /* One click handler for both pages: tiles open the sheet, the sheet's own
     buttons write. Delegated at the document, so a page can redraw whatever it
     likes without rewiring anything. */
  function wireClicks() {
    document.addEventListener('click', async ev => {
      const act = ev.target.closest('button[data-act]');
      if (act) {
        const id = act.dataset.id;
        const cur = all().find(e => e.id === id);
        if (!cur) return;
        /* Marking something watched is the only moment this page ever learns a
           real date, so it takes one. */
        if (act.dataset.act === 'watched')
          await save(id, { status: 'watched', where: '', pick: false, seen: today() });
        if (act.dataset.act === 'watchlist') await save(id, { status: 'watchlist', seen: '' });
        if (act.dataset.act === 'pick')      await save(id, { pick: !cur.pick });
        if (act.dataset.act === 'remove') {
          if (!confirm('Remove “' + cur.title + '” from the list?')) return;
          await save(id, { removed: true });
          if (sheet) sheet.close();
          return;
        }
        openSheet(id);                          // reopen showing the new state
        return;
      }
      const t = ev.target.closest('.tile, [data-more]');
      if (!t) return;
      openSheet(t.dataset.more || t.dataset.id);
    });

    if (!sheet) return;
    const x = el('sheet-x');
    if (x) x.addEventListener('click', () => sheet.close());
    sheet.addEventListener('click', ev => {     // click the backdrop to close
      if (ev.target === sheet) sheet.close();
    });
  }

  /* ── the owner panel ── */
  function paintOwner() {
    const box = el('owner-box'), tools = el('owner-tools'), blurb = el('owner-blurb');
    if (!box || !tools || !window.Owner) return;
    if (!Owner.on()) {
      tools.hidden = true;
      box.hidden = false;
      Owner.mountBox(box, { title: 'Sign in to keep the list' });
      if (blurb) blurb.textContent = "Ric's end of the page. Everyone else just gets the list.";
      onRender();
      return;
    }
    box.hidden = true;
    tools.hidden = false;
    const n = pending();
    if (blurb) blurb.textContent =
      'Add a title below, or open any tile to move it between the two lists.';
    tools.innerHTML =
      '<div class="ownerstate">' +
        '<span class="dot ' + (n ? '' : 'off') + '"></span>' +
        '<span>' + (n
          ? n + ' edit' + (n === 1 ? '' : 's') + ' saved in this browser only — export below to commit them.'
          : 'Everything here is either committed or saved to the service.') + '</span>' +
        '<button class="btn" type="button" id="signout">Sign out</button>' +
      '</div>' +
      '<form class="addbox" id="addform">' +
        '<label class="wide">Title<input id="a-title" required placeholder="e.g. The Departed" autocomplete="off"></label>' +
        '<label>List<select id="a-status">' +
          '<option value="watchlist">Queue it</option>' +
          '<option value="watched">Already watched</option>' +
        '</select></label>' +
        '<label>Where is it<input id="a-where" placeholder="Netflix, Prime, Buy…" autocomplete="off" list="wherelist">' +
          '<datalist id="wherelist"></datalist></label>' +
        '<label class="check"><input type="checkbox" id="a-pick"> Star it</label>' +
        '<div class="wide"><button class="btn btn-gold" type="submit">Add to the list</button></div>' +
      '</form>' +
      '<button class="btn" type="button" id="doexport">Export a new entertainment-data.js</button>' +
      '<textarea class="export" id="exportbox" hidden readonly spellcheck="false"></textarea>';

    /* the services already in the list, so a second spelling of "Prime Video"
       never gets typed in */
    const seen = [...new Set(all().flatMap(places))].sort();
    tools.querySelector('#wherelist').innerHTML =
      seen.map(w => '<option value="' + esc(w) + '"></option>').join('');

    tools.querySelector('#signout').addEventListener('click', () => Owner.signOut());

    tools.querySelector('#addform').addEventListener('submit', async ev => {
      ev.preventDefault();
      const title = tools.querySelector('#a-title').value.trim();
      if (!title) return;
      const id = slug(title);
      if (!id) return;
      const dup = all().find(e => e.id === id);
      if (dup && !confirm('“' + dup.title + '” is already on the ' +
          (dup.status === 'watched' ? 'watched list' : 'queue') + '. Update it?')) return;
      const status = tools.querySelector('#a-status').value;
      const patch = {
        title: title,
        status: status,
        where: tools.querySelector('#a-where').value.trim(),
        pick: tools.querySelector('#a-pick').checked
      };
      /* Added straight to the watched list means he just saw it — the only
         honest watch date this page will ever get for free. */
      if (status === 'watched') patch.seen = today();
      await save(id, patch);
      ev.target.reset();
      tools.querySelector('#a-title').focus();
    });

    tools.querySelector('#doexport').addEventListener('click', async () => {
      const out = tools.querySelector('#exportbox');
      out.hidden = false;
      out.value = 'building…';
      out.value = await exportFile();
      out.focus();
      out.select();
    });

    onRender();
  }

  /* Writes the committed file back out with every layer folded in, in exactly
     the shape the generator produces — so it can be pasted straight over
     entertainment-data.js and the "not committed" chips all go out at once.

     The header is read back off the real file rather than kept as a second copy
     in here. Two copies of a comment is how a comment starts lying.

     FIELDS has to stay in step with FIELDS in pull-tmdb.py, in the same order:
     the script rewrites this file too, and if the two disagree then every export
     fights the last pull. `ord` is not in it — that is read-time index, not
     data. */
  const FIELDS = ['count', 'series', 'where', 'pick', 'note', 'seen', 'tmdb',
                  'year', 'runtime', 'genres', 'director', 'overview', 'rating',
                  'poster', 'backdrop'];

  const FALLBACK_HEAD =
    '/* The Entertainment room\'s list — committed truth; the pages layer edits on top.\n' +
    '   Fields: id · title · status ("watched" | "watchlist") · count · series ·\n' +
    '   where · pick · note · seen, plus whatever pull-tmdb.py has filled in.\n' +
    '   See README for the full rules. */';

  async function readHeader() {
    try {
      const r = await fetch('entertainment-data.js', { cache: 'no-store' });
      if (!r.ok) return FALLBACK_HEAD;
      const txt = await r.text();
      const cut = txt.indexOf('window.ENTERTAINMENT_DATA');
      const head = cut > 0 ? txt.slice(0, cut).trim() : '';
      return head || FALLBACK_HEAD;
    } catch (e) { return FALLBACK_HEAD; }
  }

  /* The sort here is not cosmetic. Watched rows are in the order Ric watched
     them (oldest first, confirmed 2026-09-21), so `ord` carries the only record
     of when anything happened. Sort this block by title and that record is gone
     for good — keep status first, then `ord`, and let the title only break a
     tie between two rows that never had an order to begin with. */
  async function exportFile() {
    const head = await readHeader();
    const rows = all()
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'watched' ? -1 : 1) ||
                      (a.ord || 0) - (b.ord || 0) ||
                      a.title.localeCompare(b.title))
      .map(e => {
        const parts = ['id: ' + JSON.stringify(e.id), 'title: ' + JSON.stringify(e.title),
                       'status: ' + JSON.stringify(e.status)];
        for (const k of FIELDS) {
          const v = e[k];
          if (v === undefined || v === null || v === '' || v === false) continue;
          if (Array.isArray(v) && !v.length) continue;
          parts.push(k + ': ' + JSON.stringify(v));
        }
        return '  { ' + parts.join(', ') + ' },';
      });
    return head + '\nwindow.ENTERTAINMENT_DATA = [\n' + rows.join('\n') + '\n];\n';
  }

  /* ── boot ──
     The committed list goes up first, with no network asked and nothing waited
     on. The owner panel follows once the host is settled — a visitor never
     needed it, and the sign-in box arriving a beat after the list is the right
     order anyway. */
  function boot(opts) {
    onRender = (opts && opts.render) || onRender;
    sheet = el('sheet');
    wireClicks();
    onRender();

    (async () => {
      const host = await resolvedHost();
      if (window.Owner) {
        Owner.init({ host: host, onChange: paintOwner });
        paintOwner();
      }
      try {
        const r = await hostFetch('/movies', {
          cache: 'no-store',
          headers: window.Owner ? Owner.headers() : {}
        });
        if (!r.ok) return;                     // not deployed yet — committed file stands
        const items = (await r.json()).items || {};
        REMOTE = items;
        /* A local edit the service has now caught up with is no longer pending. */
        let changed = false;
        for (const [id, patch] of Object.entries(LOCAL)) {
          const got = items[id];
          if (got && Object.entries(patch).every(([k, v]) => JSON.stringify(got[k]) === JSON.stringify(v))) {
            delete LOCAL[id]; changed = true;
          }
        }
        if (changed) writeLocal(LOCAL);
        onRender();
      } catch (e) {
        /* No signal. A list with only the committed file on it is the right
           page; an error is not. */
      }
    })();
  }

  window.Room = {
    boot: boot, all: all, save: save, pending: pending,
    tile: tile, artHtml: artHtml, badge: badge, subline: subline, hue: hue,
    openSheet: openSheet, watchLinks: watchLinks, places: places,
    tintOf: tintOf, rgba: rgba, hhmm: hhmm,
    esc: esc, slug: slug, exportFile: exportFile, PLAY: PLAY
  };
})();
