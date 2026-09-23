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
    /* Reserved ids are bookkeeping, not films. */
    return [...by.values()].filter(e => !String(e.id).startsWith('_'));
  }

  const pending = () => Object.keys(LOCAL).length;

  /* ── things that are not films ──
     Favourite actors need somewhere to live, and the room already has exactly
     one write path worth having: the Worker when it answers, this browser when
     it does not. So they ride in the same store under a reserved id, and `all()`
     keeps anything starting with an underscore out of the film list.

     They are NOT written into entertainment-data.js. That file is the list of
     films; a list of actors is not a film, and the export would have to grow a
     shape for it. Until /movies is deployed they live in this browser — same
     deal as every other edit made here. */
  const META = '_people';

  function meta() {
    const m = { ...(REMOTE[META] || {}), ...(LOCAL[META] || {}) };
    return Array.isArray(m.names) ? m.names : [];
  }

  const isFavActor = name => meta().some(n => n.toLowerCase() === name.toLowerCase());

  async function toggleActor(name) {
    const cur = meta();
    const next = isFavActor(name)
      ? cur.filter(n => n.toLowerCase() !== name.toLowerCase())
      : cur.concat([name]);
    await save(META, { names: next });
  }

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
     No <img> until pull-entertainment.py has actually put a file there. A poster that
     might not exist is 363 404s and a page full of broken-image frames; the
     plate is a designed state, so there is nothing to apologise for. */

  /* A stable hue per title, so the wall of plates reads as a set rather than as
     noise, and the same film is the same colour on every visit. */
  function hue(e, light) {
    let h = 0;
    for (let i = 0; i < e.id.length; i++) h = (h * 31 + e.id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 22% ' + light + '%)';
  }

  function artHtml(e, bare) {
    /* `bare` drops the plate's lettering, for places that already say the
       title right next to it — the detail sheet printed "The Backrooms" on
       the stand-in cover and then again as the heading underneath it. */
    if (e.poster) {
      return '<img src="assets/posters/' + esc(e.id) + '.jpg" alt="" loading="lazy" ' +
             'decoding="async" width="342" height="513">';
    }
    const sub = e.year ? e.year
      : e.count ? e.count + ' films'
      : e.series ? 'the lot'
      : e.status === 'watched' ? 'seen' : 'queued';
    if (bare) {
      return '<span class="plate is-bare" style="--plate-bg:' +
             hue(e, e.status === 'watched' ? 13 : 16) + '">' +
             '<span class="no-cover">no cover</span></span>';
    }
    return '<span class="plate" style="--plate-bg:' + hue(e, e.status === 'watched' ? 13 : 16) + '">' +
           '<b>' + esc(e.title) + '</b><span>' + esc(sub) + '</span></span>';
  }

  function badge(e) {
    /* The partner mark is off the artwork everywhere, not just on the cases —
       the poster grid was still showing it, which is the sort of thing that
       makes two views of one list look like two lists. */
    if (e.status === 'watched') return '<span class="badge seen">✓ seen</span>';
    return '';
  }

  /* The one fact worth reading off a wall of tiles without opening anything. */
  function serviceTag(e) {
    const first = (e.streams || [])[0] ||
                  places(e).find(w => !/^buy$/i.test(w)) || '';
    if (!first) return '';
    const c = tintOf(first);
    return '<span class="svc" style="--face:' + c + ';--tint:' + rgba(c, 0.9) + '">' +
      esc(first) + '</span>';
  }

  const hhmm = m => Math.floor(m / 60) + 'h ' + (m % 60) + 'm';

  /* Flex `gap` only separates flex ITEMS, and a run of concatenated text is one
     anonymous item however many facts went into it — which is how a meta line
     ends up reading "19871h 42mAction". Each fact gets its own element, with a
     real separator between them. */
  const metaLine = bits => bits.filter(Boolean)
    .map(b => '<span>' + b + '</span>')
    .join('<span class="sep" aria-hidden="true">·</span>');

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
      '<span class="art">' + artHtml(e) + badge(e) + serviceTag(e) + '</span>' +
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

  /* The list Ric starred is not a list of favourites — it is what he and his
     partner are going to watch together, which is a different thing and wants a
     different mark. The DATA still calls it `pick`: that name is in the
     committed file, in the Worker and in the export, and renaming a field to
     rename a label is how a schema gets two of everything. Only the words and
     the icon change. */
  const PARTNER_LABEL = 'Watch together';
  const PERSON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" ' +
    'aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5c0-3-4-5.5-9-5.5Z"/></svg>';

  /* One DVD case: a spine you read side-on and a cover hinged to its right
     edge, folded back out of sight until the case is pulled off the shelf. */
  /* A real Amaray case, built as a box rather than two pictures that swap.
     Six surfaces matter, and leaving any of them out is what makes a case
     read as a card:

       spine   what faces you on a full shelf
       front   the printed cover, hinged on the spine's right edge
       back    the reverse, hinged on the spine's LEFT edge — without it you
               see straight through the case as it turns
       edge    the opening side, 14mm of black plastic opposite the spine
       top     the sliver you see because you are looking slightly down at a
               shelf. This one does most of the work: it is the surface that
               says "box" rather than "picture of a box"
       bottom  the matching lower plane, visible when the case tilts upward
       under   the contact shadow where it meets the plank

     Nothing on a real shelf is identical either, so thickness, height and
     lean all vary a little, seeded off the id so a film is the same object
     every visit. */
  function caseVary(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) & 0xffff;
    return {
      /* A real case is 14mm on a 135mm cover — about a tenth of its width, so
         15px against a 148px front. 14–20px covers a single disc up to a
         double; a box set is wider than that but there are none on the shelf. */
      t: 14 + (h % 7),
      /* a couple of px of height difference is plenty to break the ruler line */
      dh: (h >> 4) % 7,
      /* leaning cases are what a used shelf looks like */
      lean: (((h >> 8) % 9) - 4) * 0.22
    };
  }

  /* `faced` builds the same box turned cover-out, for a display stand. A
     Blockbuster had both and used them for different jobs: new releases faced
     out on angled racks where the art does the selling, and the back-wall
     catalogue spine-out because that is how you fit thousands of them. */
  function dvdCase(e, mode) {
    /* mode: 'stacked' lays the case flat in a pile, anything else truthy
       faces it out on a rack, nothing stands it spine-out on a shelf. */
    const stacked = mode === 'stacked';
    const faced = !stacked && !!mode;
    const art = e.poster ? 'assets/posters/' + e.id + '.jpg' : '';
    const sub = [e.year, e.runtime ? hhmm(e.runtime) : ''].filter(Boolean).join(' · ');
    /* The mark goes on whichever face you are actually looking at: the spine
       on a catalogue shelf, the cover on a display rack. */
    /* The partner mark is off the cases for now — Ric's call. The shelf it
       names is still there, and so is the toggle in the detail sheet; it is
       only the badge on the artwork that has gone. Put it back by restoring
       `mark` here rather than rebuilding it. */
    const spineMark = '';
    const frontMark = '';
    /* The shop sticker. A rental case always carried one, and here it answers
       the only question you have about a title you half-recognise: have I
       already seen this. Goes on whichever face is showing, same as the
       partner mark. */
    const seen = e.status === 'watched'
      ? '<span class="seen-tag" aria-hidden="true">Seen</span>' : '';
    const v = caseVary(e.id);
    const bg = art ? 'background-image:url(&quot;' + esc(art) + '&quot;)' : '';
    return '<button class="case' + (faced ? ' faced' : stacked ? ' stacked' : '') +
        '" type="button" data-id="' + esc(e.id) + '"' +
        ' style="--tint:' + hue(e, 26) + ';--t:' + v.t + 'px;--dh:' + v.dh +
        'px;--lean:' + v.lean.toFixed(2) + 'deg"' +
        ' aria-label="' + esc(e.title) + (sub ? ', ' + esc(sub) : '') +
          (e.status === 'watched' ? ', seen' : '') + '">' +
      /* `lift` carries the slide, `box` carries the turn — two elements so the
         two can be timed apart, and BOTH inside the case so the case's own
         hit area never moves. Move the case itself and it slides out from
         under the cursor, un-hovers, slides back under it and re-hovers,
         forever. */
      '<span class="lift"><span class="box">' +
        '<span class="face spine">' +
          (art ? '<span class="spine-art" style="' + bg + '"></span>' : '') +
          '<span class="spine-txt">' + esc(e.title) + '</span>' +
          '<span class="spine-foot"></span>' + spineMark + (faced ? '' : seen) +

        '</span>' +
        '<span class="face front">' +
          (art
            ? '<img src="' + esc(art) + '" alt="" loading="lazy" decoding="async" width="342" height="513">'
            : '<span class="noart">' + esc(e.title) + '</span>') +
          frontMark + (faced ? seen : '') +
          '<span class="crease" aria-hidden="true"></span>' +
          '<span class="gloss" aria-hidden="true"></span>' +
          '<span class="front-tag"><b>' + esc(e.title) + '</b>' +
            (sub ? '<span>' + esc(sub) + '</span>' : '') + '</span>' +
        '</span>' +
        /* The back of the wrap. Its only real job is that you cannot see
           through the case as it turns — and a back cover generally shares the
           front's artwork and palette anyway, so it gets the same image rather
           than an invented one. */
        '<span class="face back">' +
          (art ? '<span class="back-art" style="' + bg + '"></span>' : '') +
        '</span>' +
        '<span class="face edge" aria-hidden="true"></span>' +
        '<span class="face top" aria-hidden="true"></span>' +
        '<span class="face bottom" aria-hidden="true"></span>' +
      '</span></span>' +
      '<span class="under" aria-hidden="true"></span>' +
      '</button>';
  }

  /* ── where to watch ──
     The point of the room. Opening a title should ANSWER "where is this", not
     offer to go and ask somewhere else — so what pull-entertainment.py --where
     found is printed right here, as buttons that go straight into that app.

     With the date it was true. A static page cannot re-check on load (that
     would mean shipping the API key), so the honest thing is to say when it was
     last looked at and let the reader judge. The live lookup stays as the last
     row, for when the date has gone stale or the answer is "nowhere". */
  function whereBlock(e) {
    const streams = e.streams || [];
    const rents = e.rents || [];
    /* His own note wins: if he wrote "Plex" on the row, that is his copy on his
       own box and no provider list knows about it. */
    const mine = places(e).filter(w => !/^buy$/i.test(w) && !streams.includes(w));
    const live = anywhere(plainTitle(e.title));

    const chip = (name, kind) => {
      const hit = SERVICES[name.toLowerCase()];
      const url = hit ? hit[1](encodeURIComponent(plainTitle(e.title))) : live;
      const c = tintOf(name);
      return '<a class="wchip ' + kind + '" href="' + esc(url) + '" target="_blank" ' +
        'rel="noopener noreferrer" style="--face:' + c + ';--tint:' + rgba(c, 0.22) + '">' +
        (kind === 'on' ? PLAY : '') + esc(name) + '</a>';
    };

    const rows = [];
    if (mine.length)
      rows.push('<div class="wrow"><span>Ric has it on</span><div>' +
        mine.map(n => chip(n, 'on')).join('') + '</div></div>');
    if (streams.length)
      rows.push('<div class="wrow"><span>Streaming</span><div>' +
        streams.map(n => chip(n, 'on')).join('') + '</div></div>');
    if (rents.length)
      rows.push('<div class="wrow"><span>Rent or buy</span><div>' +
        rents.map(n => chip(n, 'rent')).join('') + '</div></div>');

    if (!rows.length) {
      /* The stamp beside the heading already says whether this was looked up,
         so the row says what to DO rather than repeating it. */
      rows.push('<div class="wrow"><span>' +
        (e.checked ? 'Not streaming' : 'Have a look') +
        '</span><div>' + chip('Search everywhere', 'rent') + '</div></div>');
    }

    const stamp = e.checked
      ? 'checked ' + esc(niceDate(e.checked))
      : 'not looked up yet';

    return '<section class="where">' +
      '<h4>Where to watch <span class="stamp">' + stamp + '</span></h4>' +
      rows.join('') +
      '<a class="wlive" href="' + esc(live) + '" target="_blank" rel="noopener noreferrer">' +
        'Check it live on JustWatch →</a>' +
    '</section>';
  }

  /* One film in a run. A run holds everything in the series, which includes
     films that are not out yet — and a row marked "seen" listing a film nobody
     has seen is a small lie the page should not tell. The date decides,每 time
     it draws, so it cannot go stale the way a flag would. */
  const TODAY = new Date().toISOString().slice(0, 10);

  function runEntry(f) {
    const unreleased = f.d && f.d > TODAY;
    const when = unreleased
      ? new Date(f.d + 'T00:00:00').toLocaleDateString('en-US',
          { month: 'short', year: 'numeric' })
      : (f.y || '');
    return '<li' + (unreleased ? ' class="soon"' : '') + '>' +
      '<span class="run-art">' +
        '<img src="assets/posters/p' + f.id + '.jpg" alt="" loading="lazy" ' +
          'decoding="async" onerror="this.remove()">' +
        (unreleased ? '<span class="soon-tag">soon</span>' : '') +
      '</span>' +
      '<b>' + esc(f.t) + '</b>' +
      (when ? '<span>' + esc(when) + '</span>' : '') + '</li>';
  }

  function niceDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    const days = Math.round((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + ' days ago';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  /* ── the detail sheet ── what a title is, when the name is not enough ── */
  const el = id => document.getElementById(id);
  const HOVERS = window.matchMedia('(hover: hover)').matches;
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
    /* Who is in it is how a person actually recognises a film — Ric caught a
       wrong match by remembering one had "the guy from the office" in it. */
    /* Signed in, every name is a button: star the actor and a shelf of their
       films appears on the front page. Signed out it is just the cast. */
    const own = window.Owner && Owner.on();
    const cast = (e.cast || []).length
      ? '<p class="sheet-cast">' + e.cast.map(a => own
          ? '<button type="button" class="actor' + (isFavActor(a) ? ' on' : '') + '" ' +
            'data-actor="' + esc(a) + '" title="' +
            (isFavActor(a) ? 'Remove from your people' : 'Add to your people') + '">' +
            PERSON + esc(a) + '</button>'
          : '<span class="actor">' + esc(a) + '</span>').join('') + '</p>'
      : '';
    if (e.seen) meta.push('watched ' + esc(new Date(e.seen).toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' })));

    /* ── a franchise opens onto its films ──
       A row like "Saw(1-10)" stands for ten of them and wears the first one's
       face, because a series has no cover of its own. Opening it should show
       the run, in order, rather than pretending the first film is the whole
       thing. */
    const parts = (e.parts || []).length
      ? '<section class="run">' +
          '<h4>All ' + e.parts.length + ' of them ' +
            '<span class="stamp">in order</span></h4>' +
          '<ol class="run-list">' + e.parts.map(runEntry).join('') +
          '</ol>' +
        '</section>'
      : '';

    /* Everything that is not a franchise gets the other version of the same
       question: not "what else is in this run" but "what else is like it". */
    const like = (!(e.parts || []).length && (e.like || []).length)
      ? '<section class="run">' +
          '<h4>More like this</h4>' +
          '<ol class="run-list">' + e.like.map(f =>
            '<li><span class="run-art">' +
              '<img src="assets/posters/p' + f.id + '.jpg" alt="" loading="lazy" ' +
                'decoding="async" onerror="this.remove()">' +
            '</span>' +
            '<b>' + esc(f.t) + '</b>' +
            (f.y ? '<span>' + f.y + '</span>' : '') + '</li>').join('') +
          '</ol>' +
        '</section>'
      : '';

    const links = watchLinks(e);
    const ownBlock = own
      ? '<div class="sheet-own">' +
          (e.status === 'watchlist'
            ? '<button type="button" data-act="watched" data-id="' + esc(e.id) + '">Mark watched</button>'
            : '<button type="button" data-act="watchlist" data-id="' + esc(e.id) + '">Back to queue</button>') +
          '<button type="button" data-act="pick" data-id="' + esc(e.id) + '">' +
            (e.pick ? 'Not a together one' : 'Mark “' + PARTNER_LABEL + '”') + '</button>' +
          '<button type="button" data-act="identify" data-id="' + esc(e.id) + '">' +
            (e.wd ? 'Not the right film?' : 'Which film is this?') + '</button>' +
          '<button type="button" class="danger" data-act="remove" data-id="' + esc(e.id) + '">Remove</button>' +
        '</div>'
      : '';

    el('sheet-in').innerHTML =
      '<div class="sheet-art">' + artHtml(e, true) + '</div>' +
      '<div class="sheet-body">' +
        '<h3>' + esc(e.title) + '</h3>' +
        '<p class="sheet-meta">' + metaLine(meta) + '</p>' + cast +
        /* Where to watch comes FIRST, above the synopsis. Opening a title is
           almost always "can I put this on tonight", and the answer to that
           should not sit below three paragraphs about the plot. */
        whereBlock(e) + parts + like +
        (e.overview
          ? '<p class="blurb">' + esc(e.overview) + '</p>'
          : '<p class="thin">No synopsis for this one.</p>') +
        (e.note ? '<p class="thin">' + esc(e.note) + '</p>' : '') +
        (e.local ? '<p class="thin">This edit is saved in this browser only — not committed yet.</p>' : '') +
        ownBlock +
      '</div>';
    if (!sheet.open) sheet.showModal();
  }


  /* ── the chooser ──
     "Moments" is nine films and "The Italian Job" is two, and the only person
     who knows which one Ric watched is Ric. So the question gets asked at the
     moment he adds it, while he still remembers — not later, by a script
     guessing from a string.

     On hard rule 4: this is a fetch, but it is not a dependency. Nothing here
     runs on load, nothing a visitor does can trigger it, and the page opens off
     disk and renders all 363 titles with the network unplugged. It fires when
     the signed-in owner clicks a button, same category as "Watch on Hulu". The
     room already talks to the Worker on load, which is a stronger claim than
     this one.

     Wikipedia's thumbnails are non-free, fair-use files. They are shown HERE,
     in the owner's own panel, for the seconds it takes to tell two films apart
     — and never saved, never committed, never served to a visitor. The poster
     that ends up on the site comes from TMDB, whose terms allow it. Do not be
     tempted to write these into the repo. */
  const WIKI_API = 'https://en.wikipedia.org/w/api.php';
  const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
  const WD_DATA = 'https://www.wikidata.org/wiki/Special:EntityData/';

  const asJson = r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status));

  async function candidates(query, year) {
    const url = WIKI_API + '?' + new URLSearchParams({
      action: 'query', list: 'search',
      srsearch: query + (year ? ' ' + year : '') + ' film',
      srlimit: '6', format: 'json', origin: '*'
    });
    const hits = ((await fetch(url).then(asJson)).query || {}).search || [];
    /* Ask about all six at once — six round trips one after another is four
       seconds of staring at a spinner. */
    const pages = await Promise.all(hits.map(h =>
      fetch(WIKI_REST + encodeURIComponent(h.title.replace(/ /g, '_')))
        .then(asJson).catch(() => null)));
    /* Wikipedia's search is happy to offer the soundtrack album and the tie-in
       video game. The short description says what a thing is ("1969 British
       film", "2001 video game"), which sorts them for free — no second request.
       An article with no description at all is kept: better an extra row than a
       missing one, since the whole point is that he recognises it on sight. */
    const notFilm = /\b(album|soundtrack|video game|song|novel|book|band|magazine|comic)\b/i;
    const isFilm = /\b(film|movie|series|miniseries|television|anime|documentary)\b/i;
    return pages.filter(p => p && p.wikibase_item && p.type !== 'disambiguation')
      .filter(p => {
        const d = p.description || '';
        return !d || (!notFilm.test(d) || isFilm.test(d));
      })
      .map(p => ({
        name: p.title,
        qid: p.wikibase_item,
        extract: p.extract || '',
        thumb: (p.thumbnail || {}).source || '',
        /* The article's own first sentence dates it more reliably than
           anything else we can get without a second request. */
        year: (p.description || '').match(/\b(19|20)\d{2}\b/)?.[0] ||
              (p.extract || '').match(/\b(19|20)\d{2}\b/)?.[0] || '',
        desc: p.description || ''
      }));
  }

  function claimsOf(ent, prop) {
    const out = [];
    for (const st of ((ent.claims || {})[prop] || [])) {
      const dv = (st.mainsnak || {}).datavalue;
      if (!dv) continue;
      const v = dv.value;
      out.push(v && typeof v === 'object' ? (v.id || v.time || v.amount) : v);
    }
    return out;
  }

  /* Identity plus the cheap facts. Genres are deliberately NOT worked out here:
     the naming rules live in pull-entertainment.py and having two copies of
     them is how the two quietly stop agreeing. A row saved from this panel gets
     its `wd`, and the next --facts run fills in the rest from that id — which it
     trusts, because a hand-set id is never overwritten. */
  async function factsFor(qid) {
    const d = await fetch(WD_DATA + qid + '.json').then(asJson);
    const ent = (d.entities || {})[qid];
    /* `wdok` says a person chose this, not a script. pull-entertainment.py
       re-guesses its own matches on --refresh and never touches these. */
    if (!ent) return { wd: qid, wdok: true };
    const out = { wd: qid, wdok: true };
    const years = claimsOf(ent, 'P577')
      .map(t => parseInt(String(t).slice(1, 5), 10))
      .filter(n => n > 1800).sort();
    if (years.length) out.year = years[0];
    const mins = claimsOf(ent, 'P2047');
    if (mins.length) out.runtime = Math.round(parseFloat(String(mins[0]).replace('+', '')));
    const imdb = claimsOf(ent, 'P345');
    if (imdb.length) out.imdb = imdb[0];
    const tm = claimsOf(ent, 'P4947');
    if (tm.length && /^\d+$/.test(String(tm[0]))) out.tmdb = parseInt(tm[0], 10);
    const dirs = claimsOf(ent, 'P57').filter(q => typeof q === 'string');
    if (dirs.length) {
      try {
        const u = 'https://www.wikidata.org/w/api.php?' + new URLSearchParams({
          action: 'wbgetentities', ids: dirs.slice(0, 2).join('|'),
          props: 'labels', languages: 'en', format: 'json', origin: '*'
        });
        const got = (await fetch(u).then(asJson)).entities || {};
        const names = dirs.slice(0, 2)
          .map(q => ((got[q] || {}).labels || {}).en || {})
          .map(l => l.value).filter(Boolean);
        if (names.length) out.director = names.join(', ');
      } catch (e) { /* a missing director is not worth failing the save over */ }
    }
    return out;
  }

  /* Opens the dialog and resolves to a patch, or to null if he backs out.
     `typed` is what he actually wrote, and it is always offered as an answer —
     an obscure film that is on no one's list is still on his. */
  function chooseFilm(typed, year) {
    const dlg = el('finder');
    if (!dlg) return Promise.resolve({});         // page has no chooser; save as typed
    const body = el('finder-in');
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; dlg.close(); resolve(v); } };

      const draw = (state, list) => {
        body.innerHTML =
          '<h3>Which one?</h3>' +
          '<p class="finder-q">Searching for <b>' + esc(typed) + '</b> — pick the film you mean, ' +
            'or keep the name exactly as you typed it.</p>' +
          '<div class="finder-search">' +
            '<input id="finder-q" value="' + esc(typed) + '" aria-label="Search again">' +
            '<button class="btn" type="button" id="finder-go">Search again</button>' +
          '</div>' +
          (state === 'loading' ? '<p class="finder-note">Looking…</p>' : '') +
          (state === 'error' ? '<p class="finder-note">Could not reach Wikipedia. ' +
             'Keep the name as typed and the id can be filled in later.</p>' : '') +
          (state === 'none' ? '<p class="finder-note">Nothing came back for that. ' +
             'Try different words, or keep it as typed.</p>' : '') +
          (list && list.length ? '<ul class="finder-list">' + list.map((c, i) =>
            '<li><button type="button" data-pick="' + i + '">' +
              (c.thumb ? '<img src="' + esc(c.thumb) + '" alt="" loading="lazy">'
                       : '<span class="noart">?</span>') +
              '<span class="finder-who"><b>' + esc(c.name) + '</b>' +
                (c.desc ? '<span>' + esc(c.desc) + '</span>' : '') +
                (c.extract ? '<em>' + esc(c.extract.slice(0, 96)) + '…</em>' : '') +
              '</span></button></li>').join('') + '</ul>' : '') +
          '<div class="finder-acts">' +
            '<button class="btn" type="button" id="finder-mine">Keep “' + esc(typed) + '” as I typed it</button>' +
            '<button class="btn" type="button" id="finder-cancel">Cancel</button>' +
          '</div>';

        el('finder-mine').addEventListener('click', () => finish({}));
        el('finder-cancel').addEventListener('click', () => finish(null));
        el('finder-go').addEventListener('click', () => run(el('finder-q').value.trim()));
        el('finder-q').addEventListener('keydown', ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); run(el('finder-q').value.trim()); }
        });
        for (const b of body.querySelectorAll('[data-pick]')) {
          b.addEventListener('click', async () => {
            const c = list[Number(b.dataset.pick)];
            b.disabled = true;
            b.insertAdjacentHTML('beforeend', '<span class="finder-wait">…</span>');
            let facts = { wd: c.qid, wdok: true };
            try { facts = await factsFor(c.qid); } catch (e) { /* id alone is enough */ }
            /* The Wikipedia article title is the film's name, not Ric's — his
               stays. The id is what was missing, not the wording. */
            finish(facts);
          });
        }
      };

      const run = async q => {
        draw('loading', null);
        try {
          let list = await candidates(q, year);
          /* A year he gave is an answer, not a hint: anything from that year
             goes to the top, so the right one is the first thing he reads. */
          if (/^\d{4}$/.test(year || '')) {
            list = list.slice().sort((a, b) =>
              (b.year === year ? 1 : 0) - (a.year === year ? 1 : 0));
          }
          draw(list.length ? 'ok' : 'none', list);
        } catch (e) {
          draw('error', null);
        }
      };

      dlg.addEventListener('close', () => finish(null), { once: true });
      dlg.showModal();
      run(typed);
    });
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
        ring();
        return;
      }
      /* queued (no signal) or refused (no endpoint yet) — keep it here, and
         keep it visibly uncommitted rather than pretending it landed. */
    }
    LOCAL[id] = Object.assign({}, LOCAL[id] || {}, patch);
    writeLocal(LOCAL);
    onRender();
  }

  /* ── the doorbell ──
     A film added here is on the page immediately, because the Worker has it.
     What is NOT immediate is everything that makes it look like a film: the
     poster, the year, the director, where it streams. Those come from a script
     that talks to TMDB and commits files into the repo — neither of which a web
     page can do — run by a scheduled job on GitHub every three hours.

     So this asks the Worker to tell GitHub to run it now. The page has no
     GitHub credential and must never have one; the Worker does, where a secret
     is not readable by everyone who loads the site.

     Debounced, because ticking off six films in a row is one thing that
     happened, not six. Never queued: a doorbell rung an hour late is just the
     three-hour clock with extra steps, and the clock already covers it. And
     never awaited by a caller — nothing on screen should wait on GitHub. */
  let ringing = 0;
  let greeted = false;
  function ring(after) {
    if (!(window.Owner && Owner.on())) return;
    clearTimeout(ringing);
    ringing = setTimeout(() => {
      Owner.post('/movies/_pull', {}).catch(() => {});
    }, after == null ? 4000 : after);
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
        if (act.dataset.act === 'identify') {
          const chosen = await chooseFilm(cur.title, cur.year ? String(cur.year) : '');
          if (chosen === null) { openSheet(id); return; }
          /* Re-identifying means the old answer was wrong, so the facts that
             came with it go too — otherwise 1969's runtime sits on 2003's film.
             The poster file is left alone; --art overwrites it by id. */
          await save(id, Object.assign(
            { wd: '', wdok: false, tmdb: '', imdb: '', year: '', runtime: '',
              genres: [], director: '', overview: '', rating: '',
              poster: false, backdrop: false,
              streams: [], rents: [], checked: '' },
            chosen));
        }
        if (act.dataset.act === 'remove') {
          if (!confirm('Remove “' + cur.title + '” from the list?')) return;
          await save(id, { removed: true });
          if (sheet) sheet.close();
          return;
        }
        openSheet(id);                          // reopen showing the new state
        return;
      }
      const who = ev.target.closest('button[data-actor]');
      if (who) {
        await toggleActor(who.dataset.actor);
        const open = el('sheet-in').querySelector('[data-act]');
        if (open) openSheet(open.dataset.id);   // redraw with the new state
        return;
      }
      const t = ev.target.closest('.tile, .case, [data-more]');
      if (!t) {
        /* tapped away — put any open case back */
        for (const o of document.querySelectorAll('.case.out')) o.classList.remove('out');
        return;
      }
      /* ── two taps on a touch screen ──
         There is no hover on a phone, so the gesture is the real one: the
         first tap turns the case so you can see it, the second opens it. This
         lives here rather than on a page because it is how a CASE behaves,
         and both pages have cases. */
      if (!HOVERS && t.classList.contains('case') && !t.classList.contains('out')) {
        for (const o of document.querySelectorAll('.case.out')) o.classList.remove('out');
        t.classList.add('out');
        /* Opening one makes it taller, which in normal flow can only push the
           cases BELOW it down — nothing can move what is above. Holding the
           opened case in the middle of the screen is what makes the stack read
           as parting around it: the ones above ride up, the ones below go
           down, and the one you touched stays where your thumb left it. */
        requestAnimationFrame(() =>
          t.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        return;
      }
      openSheet(t.dataset.more || t.dataset.id);
    });

    if (!sheet) return;
    const x = el('sheet-x');
    if (x) x.addEventListener('click', () => sheet.close());
    /* Opening a title leaves the case it came from pulled out behind the
       dialog, and on the way back the browser restores focus to it — so it
       stays out, looking stuck, until something else is clicked. Reset on
       close and there is nothing to get stuck. */
    sheet.addEventListener('close', () => {
      for (const o of document.querySelectorAll('.case.out')) o.classList.remove('out');
      if (document.activeElement && document.activeElement.classList.contains('case'))
        document.activeElement.blur();
    });
    sheet.addEventListener('click', ev => {     // click the backdrop to close
      if (ev.target === sheet) sheet.close();
    });
  }

  /* ── quick add ──
     The owner panel sits at the foot of the page, behind seventeen shelves and
     four hundred odd cases. That is the right place for the panel and the wrong
     place for the one thing Ric does often: scrolling the length of the store
     to type a title is what stops a list getting kept.

     So the same add lives in a button that is always in the bar, opens onto a
     focused field, and — the part that matters for a list — stays open after
     each one with the field cleared, because titles arrive in handfuls. */
  function addDialog() {
    let d = el('quickadd-dlg');
    if (d) return d;
    d = document.createElement('dialog');
    d.className = 'sheet quick';
    d.id = 'quickadd-dlg';
    d.innerHTML =
      '<form class="quick-in" id="quickadd-form">' +
        '<h3>Add a title</h3>' +
        '<label class="wide">Title' +
          '<input id="qa-title" required autocomplete="off" placeholder="e.g. The Departed">' +
        '</label>' +
        '<label>Year <span class="hint">helps pick the right one</span>' +
          '<input id="qa-year" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="2006">' +
        '</label>' +
        '<label>List' +
          '<select id="qa-status">' +
            '<option value="watchlist">Queue it</option>' +
            '<option value="watched">Already watched</option>' +
          '</select>' +
        '</label>' +
        '<label class="check"><input type="checkbox" id="qa-pick"> ' + PARTNER_LABEL + '</label>' +
        '<p class="quick-said" id="qa-said"></p>' +
        '<div class="quick-acts">' +
          '<button class="btn btn-gold" type="submit">Add</button>' +
          '<button class="btn" type="button" id="qa-done">Done</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(d);

    d.querySelector('#qa-done').addEventListener('click', () => d.close());
    d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
    d.querySelector('#quickadd-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const title = el('qa-title').value.trim();
      if (!title) return;
      const year = (el('qa-year').value || '').trim();
      const said = el('qa-said');
      said.textContent = 'looking…';

      const id = slug(title);
      const dup = all().find(e => e.id === id);
      if (dup) {
        said.textContent = '“' + dup.title + '” is already on the ' +
          (dup.status === 'watched' ? 'watched list' : 'queue') + '.';
        el('qa-title').select();
        return;
      }

      const patch = { title: title, status: el('qa-status').value,
                      pick: el('qa-pick').checked };
      if (/^\d{4}$/.test(year)) patch.year = Number(year);
      if (patch.status === 'watched') patch.seen = today();

      const chosen = await chooseFilm(title, year);
      if (chosen === null) { said.textContent = ''; return; }
      Object.assign(patch, chosen);
      await save(id, patch);

      /* Cleared and refocused, because nobody adds exactly one. */
      said.textContent = 'Added ' + title + '.';
      el('qa-title').value = '';
      el('qa-year').value = '';
      el('qa-pick').checked = false;
      el('qa-title').focus();
    });
    return d;
  }

  function openAdd() {
    if (!(window.Owner && Owner.on())) return;
    const d = addDialog();
    el('qa-said').textContent = '';
    if (!d.open) d.showModal();
    el('qa-title').focus();
  }

  /* The button only exists for Ric, and `a` opens it from anywhere that is not
     already a text field. */
  function wireAdd() {
    const b = el('addbtn');
    if (b) {
      b.hidden = !(window.Owner && Owner.on());
      if (!b.dataset.wired) { b.dataset.wired = '1'; b.addEventListener('click', openAdd); }
    }
    if (!document.body.dataset.addKey) {
      document.body.dataset.addKey = '1';
      document.addEventListener('keydown', ev => {
        if (ev.key !== 'a' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        const t = ev.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' ||
                  t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (!(window.Owner && Owner.on())) return;
        ev.preventDefault();
        openAdd();
      });
    }
  }

  /* ── the owner panel ── */
  function paintOwner() {
    const box = el('owner-box'), tools = el('owner-tools'), blurb = el('owner-blurb');
    wireAdd();
    if (!box || !tools || !window.Owner) return;
    if (!Owner.on()) {
      tools.hidden = true;
      box.hidden = false;
      Owner.mountBox(box, { title: 'Sign in to keep the list' });
      if (blurb) blurb.textContent = "Ric's end of the page. Everyone else just gets the list.";
      greeted = false;
      onRender();
      return;
    }
    box.hidden = true;
    tools.hidden = false;
    /* Signing in is itself worth a ring: an edit made on his phone with no
       signal, or from a browser he then closed, is sitting on the Worker with
       nothing scheduled to notice it for up to three hours. Once per sign-in,
       not once per repaint — this runs again on every queue flush. The Worker
       answers "already asked" when nothing has changed, which is most of the
       time, so a quiet sign-in costs one request and starts nothing. */
    if (!greeted) { greeted = true; ring(0); }
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
        '<label>Year<input id="a-year" inputmode="numeric" maxlength="4" ' +
          'placeholder="2016" autocomplete="off"></label>' +
        '<label>Where is it<input id="a-where" placeholder="Netflix, Prime, Buy…" autocomplete="off" list="wherelist">' +
          '<datalist id="wherelist"></datalist></label>' +
        '<label class="check"><input type="checkbox" id="a-pick"> ' + PARTNER_LABEL + '</label>' +
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

      /* Ask which film this is while he still has it in mind. Backing out of
         the chooser cancels the add rather than saving a half-answered row.
         The year is the single most useful thing he can add: "Total Recall"
         is two films and "1990" settles it in one keystroke. */
      const year = (tools.querySelector('#a-year').value || '').trim();
      if (/^\d{4}$/.test(year)) patch.year = Number(year);
      const chosen = await chooseFilm(title, year);
      if (chosen === null) return;
      Object.assign(patch, chosen);

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

     FIELDS has to stay in step with FIELDS in pull-entertainment.py, in the same order:
     the script rewrites this file too, and if the two disagree then every export
     fights the last pull. `ord` is not in it — that is read-time index, not
     data. */
  const FIELDS = ['count', 'series', 'where', 'pick', 'note', 'seen',
                  'wd', 'wdok', 'tmdb', 'kind', 'imdb',
                  'year', 'runtime', 'genres', 'director', 'overview', 'rating',
                  'cast', 'parts', 'like', 'poster', 'backdrop',
                  'streams', 'rents', 'checked'];

  const FALLBACK_HEAD =
    '/* The Entertainment room\'s list — committed truth; the pages layer edits on top.\n' +
    '   Fields: id · title · status ("watched" | "watchlist") · count · series ·\n' +
    '   where · pick · note · seen, plus whatever pull-entertainment.py has filled in.\n' +
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
        /* Strict JSON, exactly what pull-entertainment.py writes. The two have
           to agree character for character or every export fights the last
           pull — and JSON is the shape because a regex reader has now eaten
           this file's data three times. */
        const out = {};
        for (const k of ['id', 'title', 'status'].concat(FIELDS)) {
          const v = e[k];
          if (v === undefined || v === null || v === '' || v === false) continue;
          if (Array.isArray(v) && !v.length) continue;
          out[k] = v;
        }
        for (const k of Object.keys(e).sort()) {      // anything hand-added
          if (k === 'ord' || k === 'local' || k in out) continue;
          const v = e[k];
          if (v === undefined || v === null || v === '' || v === false) continue;
          out[k] = v;
        }
        return '  ' + JSON.stringify(out);
      });
    return head + '\nwindow.ENTERTAINMENT_DATA = [\n' + rows.join(',\n') + '\n];\n';
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
    /* Credit what was borrowed, and only once something has been. Before
       pull-entertainment.py runs, every word on the page is Ric's. */
    const credit = el('credit');
    if (credit) credit.hidden = !all().some(e => e.wd || e.tmdb || e.overview);
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
    tile: tile, dvdCase: dvdCase, artHtml: artHtml, badge: badge, subline: subline, hue: hue,
    openSheet: openSheet, watchLinks: watchLinks, places: places,
    tintOf: tintOf, rgba: rgba, hhmm: hhmm,
    esc: esc, slug: slug, exportFile: exportFile, PLAY: PLAY, metaLine: metaLine,
    chooseFilm: chooseFilm, openAdd: openAdd,
    actors: meta, isFavActor: isFavActor, toggleActor: toggleActor,
    PERSON: PERSON, PARTNER_LABEL: PARTNER_LABEL
  };
})();
