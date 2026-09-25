/* TRAINING — the shared core
   ────────────────────────────────────────────────────────────────────────────
   The training room is four pages — home, calendar, workouts, trips — and they
   need the same things: the plan, the ticks, the runs off the watch, the board
   nights, and the session row that ties them together. This is where those
   live, once.

   The split is by RESPONSIBILITY, not by page. Anything that answers "what is
   the plan, and what happened" is here. Anything that decides "what does THIS
   page look like" stays in the page. So a session row, a run panel, the notes
   block and the tick handler are all here; the month grid is in calendar.html,
   the week tiles are in training.html, and neither knows about the other.

   ── the one thing to know before editing ──
   A tick changes state that several views are looking at. This module does not
   know which, so it does not try: every page registers one callback with
   onChange(), and everything in here that mutates state calls changed() when
   it is done. The page decides what to repaint. Before the split this was a
   direct call to render() and renderCal(), which is exactly the coupling that
   made a fourth page impossible to add.

   Load order on every page:
       assets/owner.js            Owner.*  — the sign-in and the write queue
       projects/climbing/climb-host.js
       projects/climbing/climb-media.js
       assets/training/core.js    this file
   then the page's own script, which calls Training.load().

   Owner mode is a rendering hint; assets/owner.js says why at length. The
   Worker is what refuses a write. */
(function (global) {
  'use strict';

  /* The page's repaint, registered with onChange(). Defaults to doing nothing
     so a page that only reads — or one still being written — cannot throw. */
  let ONCHANGE = () => {};
  const changed = () => ONCHANGE();

  const LOG_HOST = location.origin.includes('localhost')
    ? location.origin
    : 'https://training-log.rmbuster82.workers.dev';
  /* ── where the data lives, from wherever this page is ──
     These were plain relative paths while there was one training page, at the
     root, and they worked by luck of depth. The moment the section grew pages
     under projects/training/ they resolved against THAT directory and fetched
     four 404s, which the soft-fetch helpers below turn into an empty plan and
     a blank page rather than an error — so it failed silently, which is worse.

     The root is read off this script's own src, the same trick and for the same
     reason as assets/training/nav.js: the dev server, a file:// open and the
     deployed site disagree about what location.pathname looks like, and the
     script's own URL is the one thing correct in all three. */
  const ROOT = (document.currentScript ? document.currentScript.src : '')
    .replace(/assets\/training\/core\.js.*$/, '');
  const PLAN_URL = ROOT + 'assets/training-plan.json';
  const CLIMB_URL = ROOT + 'assets/climbing/climb-days.json';
  const BOARD_URL = ROOT + 'projects/climbing/board-data.js';

  const ICON = { climb: '🧗', run: '🏃', body: '🧘', rest: '😴' };
  const KINDNAME = { climb: 'Climb', run: 'Run', body: 'Body', rest: 'Rest' };
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isoOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayISO = () => isoOf(new Date());
  const pretty = iso => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  let PLAN = null, LOG = {}, CLIMB_STATIC = {}, CLIMB_WEB = {}, RUNS = {}, BOARD = {};
  let LOG_STALE = false;          // showing cached state because the log was unreachable
  /* Which session panels are open, keyed "date:index". Held here rather than
     in the DOM so a re-render — and a tick causes one — does not slam shut
     the list you were reading mid-session. */
  const EXPANDED = new Set();
  const RUNOPEN = new Set();

  /* ── the log cache ──
     Without this, opening the page with no signal renders every tick as
     unticked. Nothing is lost — it is all still in Cloudflare — but it looks
     exactly like data loss, which is the same alarming failure as the two
     private-note bugs, and it would arrive at the worst possible moment.

     Written after every read and every write, so it always includes anything
     still sitting in the offline queue. */
  const CACHE_KEY = 'trainingLogCache';
  const cacheLog = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(LOG)); } catch (e) {} };
  const cachedLog = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } };

  Owner.init({ host: LOG_HOST, onChange: () => changed() });

  /* ---------- data ---------- */
  async function load() {
    const plan = fetch(PLAN_URL, { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(r.status));
    /* Everything except the plan is optional. A page that shows the schedule
       with no ticks is useful; an error page is not. */
    const soft = (url, opts, fallback) => fetch(url, opts).then(r => r.ok ? r.json() : fallback).catch(() => fallback);
    /* The log is the one fetch whose failure must be TOLD APART from an empty
       result — `{}` and "could not reach it" look identical downstream and
       mean opposite things. */
    const log = fetch(LOG_HOST + '/log', { cache: 'no-store', headers: Owner.headers() })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => ({ days: j.days || {}, live: true }))
      .catch(() => ({ days: cachedLog() || {}, live: false }));
    /* The board logbook, straight from the file the Boards page already reads.
       It is a script that assigns a global rather than JSON, so it is fetched
       and the assignment sliced off — cheaper than loading 50KB of it into
       every page that only wants a few nights of it, and it keeps the
       training page from depending on load order. Soft: no boards is a page
       with less on it, not a broken one. */
    const boards = fetch(BOARD_URL, { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(t => JSON.parse(t.slice(t.indexOf('{')).trim().replace(/;\s*$/, '')))
      .catch(() => null);
    const climbWeb = soft(LOG_HOST + '/climb', { cache: 'no-store' }, { days: {} });
    /* The clips. Soft by construction — ClimbMedia.load() answers {} on any
       failure — so a day card loses a video and keeps everything else. */
    const media = ClimbMedia.load();
    const climbStatic = soft(CLIMB_URL, { cache: 'no-cache' }, { days: {} });
    /* The runs Strava has pushed. Soft like the rest: a page with the plan and
       the ticks but no run cards is a smaller loss than an error.

       Sent with the owner's token for the same reason the log is: a run marked
       private on Strava is withheld from the world, not from the person who
       ran it, and without this his own weekly mileage would be short by
       exactly the runs he chose not to publish. */
    const runs = soft(LOG_HOST + '/strava', { cache: 'no-store', headers: Owner.headers() }, { days: {} });

    try { PLAN = await plan; }
    catch (e) {
      /* Visitor-facing. "Run node projects/training/export.mjs" is a note for
         whoever maintains this, not for someone's mum reading the page on a
         phone — the same reason the placeholder card downstairs never
         explained how the feed was wired up. The detail goes to the console.
         And the sign-in box still gets drawn, or a bad deploy would lock the
         owner out of the one control that might help. */
      console.error('training-plan.json failed to load — regenerate with: node projects/training/export.mjs', e);
      $('#w-note').textContent = 'Couldn\'t load the plan just now.';
      $('#today').innerHTML = '<div class="loadfail"><strong>The training plan isn\'t loading.</strong> ' +
        'Nothing\'s broken on your end — try again in a bit.</div>';
      mountOwnerBar();
      return;
    }
    const logResult = await log;
    LOG = logResult.days || {};
    LOG_STALE = !logResult.live && Object.keys(LOG).length > 0;
    if (logResult.live) cacheLog();
    CLIMB_WEB = (await climbWeb).days || {};
    CLIMB_STATIC = (await climbStatic).days || {};

    /* Flattened to date → entries as it arrives, because every question this
       page asks of it is "what happened on this day". Each entry keeps the
       board it came from, so a night that touched both is still two lists. */
    BOARD = {};
    await media;
    const bd = await boards;
    for (const [key, b] of Object.entries((bd && bd.boards) || {})) {
      for (const e of (b.entries || [])) {
        const iso = String(e.date || '').slice(0, 10);
        if (!iso) continue;
        (BOARD[iso] = BOARD[iso] || []).push({ ...e, board: e.board || key, label: b.label || key });
      }
    }
    RUNS = (await runs).days || {};
    const pending = normalizeLegacy();
    changed();
    persistLegacy(pending);
  }

  /* ── moving old ticks onto ids ──
     Anything ticked before ids existed is keyed by index. Each one is
     resolved against the plan as it stands — index 1 means whatever sits at
     index 1 today — and copied onto that session's id.

     This runs for EVERYONE, in memory, before the first paint, because it is
     what makes an old tick render at all now that the index is no longer
     read. Writing it back needs the token, so a visitor gets the right
     picture and the owner gets the right picture made permanent.

     The resolution is only as good as the assumption that the day has not
     been reshaped since it was ticked, which is exactly the assumption ids
     exist to stop relying on. It is sound here because it happens ONCE, on
     state that predates ids, and every such day is checked against the
     current plan before anything is written. Days the plan no longer knows
     about are left alone rather than guessed at.

     Returns the writes to persist, so the caller can do that after painting.
     The old numeric keys stay in storage — the Worker merges rather than
     replaces, so they cannot be deleted from here — and they are now inert,
     because nothing reads them. */
  function normalizeLegacy() {
    const pending = [];
    for (const [iso, st] of Object.entries(LOG)) {
      const legacy = Object.keys(st.done || {}).filter(k => /^\d+$/.test(k));
      if (!legacy.length) continue;
      const d = dayOf(iso);
      if (!d) continue;                       // outside the plan; nothing to resolve against
      const done = {};
      for (const k of legacy) {
        const s = d.sessions[+k];
        /* Never overwrite an id that already has a value: a tick made since
           the change is the more recent truth. */
        if (s && st.done[s.id] === undefined) done[s.id] = !!st.done[k];
      }
      if (Object.keys(done).length) {
        Object.assign(st.done, done);
        pending.push([iso, done]);
      }
    }
    if (pending.length) cacheLog();
    return pending;
  }

  async function persistLegacy(pending) {
    if (!Owner.on()) return;
    for (const [iso, done] of pending) await save(iso, { done });
  }

  const dayOf = iso => (PLAN.days || []).find(d => d.date === iso);
  const stateOf = iso => LOG[iso] || { done: {}, auto: {}, notes: [] };

  /* ── reading a tick ──
     Ticks are stored against a session's id, which means the same session
     whatever the plan does around it. Before ids they were stored against
     the session's INDEX, and an index only means anything until the week is
     reshaped — when a Sunday and a Monday swapped, a tick on "climbed" would
     have become a tick on "ran" with nothing on screen to show it.

     The id is read and nothing else. Falling back to the index when the id
     says nothing was the obvious thing to write and it is wrong: on exactly
     the reshaped day the ids exist to protect, the fallback marks whatever
     moved into that position as done. A session with no id key is not done —
     legacy state is converted once, up front, by normalizeLegacy. */
  const doneOf = (st, s) => !!st.done[s.id];
  const doneCountOf = (st, sessions) => sessions.filter(s => doneOf(st, s)).length;

  /* Ticked, and ticked by a watch rather than a thumb. The Worker clears the
     flag the moment Ric touches that session himself, so this only ever marks
     a tick that is still Strava's. */
  /* What placed this tick, or '' if a person did. The value is a source name
     — 'strava', 'kilter', 'tension' — except on ticks written before boards
     existed, which hold `true` and can only have been Strava. */
  const SOURCE_LABEL = { strava: 'Strava', kilter: 'Kilter', tension: 'Tension' };
  const autoOf = (st, s) => {
    if (!doneOf(st, s)) return '';
    const v = st.auto && st.auto[s.id];
    if (!v) return '';
    return SOURCE_LABEL[v] || (v === true ? 'Strava' : '');
  };

  /* A climbing day is either in the committed archive or was logged from a
     phone. Either way the training page links to the climbing page's anchor
     for that date, which already exists as id="trip-YYYY-MM-DD". */
  /* The archive wins where both have the date. This page used to prefer the
     web entry and the climbing page preferred the markdown, so the moment a
     phone-logged day was written up into climbs.md properly — which is the
     documented workflow, not an edge case — the two pages disagreed about the
     area and the route count for the same day. climbs.md is the record of
     intent and the web entry is the rough note that preceded it, which is the
     rule web-trips.js already states; this now says the same thing. */
  function climbOn(iso) {
    const st = CLIMB_STATIC[iso];
    if (st) return { area: st.area, routes: st.routes, web: false };
    const web = CLIMB_WEB[iso];
    if (web) return { area: web.area || 'Climbing', routes: (web.routes || []).length, web: true };
    return null;
  }

  /* ---------- render ---------- */
  /* The protocols a session points at, minus the ones with nothing to show.
     A protocol earns its place with an exercise list OR with a dose table:
     Kilter pyramids has no list of movements because "V2 → V6 → V2, four
     sets, no rest" IS the session. Requiring `ex` used to hide those
     entirely, which only went unnoticed while the warm-up was still being
     published underneath them and the panel never looked empty. */
  const protosOf = s => (s.k || [])
    .map(k => [k, (PLAN.protocols || {})[k]])
    .filter(([, p]) => p && ((p.ex && p.ex.length) || (p.spec && Object.keys(p.spec).length)));

  /* ── one list, each thing once ──
     A session points at several protocols and they overlap. The morning is
     the worst of it: "Full morning practice" and "Daily wrist dose" both open
     with the pre-engagement drill and the quadruped rocks, so 207 mornings of
     the year listed those two twice, under two headings, as though they were
     two different jobs. Whatever you are meant to do, you do once — so the
     panel is one list and each movement appears in it once.

     Where two protocols ask for the same movement at DIFFERENT doses — the
     rocks are 20 s in the wrist dose and 30 s in the full practice, the
     Romanian deadlift is 3 × 6 to lift heavy and 3 × 8 for the knees — both
     are shown. Picking one silently would be the plan quietly deciding
     something it has not thought about, and there are only two such cases in
     the year. */
  function exercisePanel(s) {
    const list = protosOf(s);
    if (!list.length) return '<div class="nodetail">No set exercises — the session is the whole of it.</div>';

    const moves = new Map();
    for (const [, p] of list) {
      for (const [name, dose, cue] of (p.ex || [])) {
        if (!moves.has(name)) moves.set(name, { doses: [dose], cue });
        else {
          const m = moves.get(name);
          if (!m.doses.includes(dose)) m.doses.push(dose);
          if (!m.cue && cue) m.cue = cue;
        }
      }
    }

    const rows = [...moves].map(([name, m]) => `<div class="exrow">
        <span class="exn">${esc(name)}${m.cue ? `<span class="excue">${esc(m.cue)}</span>` : ''}</span>
        <span class="exd">${m.doses.map(esc).join(' / ')}</span>
      </div>`).join('');

    /* A protocol with no movements is one whose dose table IS the session —
       Kilter pyramids, ARC, the run paces. Those keep their name, because
       "Angle 30°, V2 → V6 → V2" means nothing without it. */
    const specOnly = list.filter(([, p]) => !(p.ex && p.ex.length) && p.spec && Object.keys(p.spec).length)
      .map(([, p]) => `<div class="pblock">
        <div class="pname">${esc(p.n)}</div>
        <div class="pspec">${Object.entries(p.spec)
          .map(([k, v]) => `<span>${esc(k)} <b>${esc(v)}</b></span>`).join('')}</div>
      </div>`).join('');

    return (rows ? `<div class="pblock">${rows}</div>` : '') + specOnly;
  }

  /* The title as the plan wrote it says what was meant to happen: "Long run —
     7 mi". Once a run has actually landed against that session, the number in
     it is a forecast standing where a fact should be — 7 miles on the row, 6.1
     in the run underneath it. So the distance is rewritten to what was run,
     and the planned figure moves alongside in small type rather than
     disappearing: the gap between the two is the interesting part, and a page
     that silently rounded the plan away would be lying in the other
     direction.

     Only the distance is touched, and only when a number with `mi` after it
     is actually in the title — "Easy 3 mi + strides" becomes "Easy 6.1 mi +
     strides" and a title with no distance in it is left alone. */
  /* ── a day that has happened says where it was ──
     The plan stopped naming the home crag on 2026-09-18, because a
     forward-looking file that says "Ijams, 2026-10-12" is a standing list of
     where this person will be on a given date. Those days publish as "Rope
     Day" or "Boulder Day" instead.

     That reasoning runs out the moment the day is behind us. A day he actually
     climbed is already published by name on the climbing page — climbs.md is
     the record of where he went, and being that record is the point of that
     room. Withholding it here would be the training page pretending not to
     know something the site says two tabs over.

     The swap needs both halves to be true: the title has to be one we
     genericised, and the log has to name a crag for that date. A named
     destination — the Red, the Obed — keeps its own name and never reaches
     this. A day with no logged climb keeps the generic label, which is
     correct: nothing says he went anywhere. */
  const GENERIC_TITLE = /^(rope|boulder) day$/i;
  function titleOf(iso, s) {
    if (!GENERIC_TITLE.test(s.title || '')) return s.title;
    if (iso > todayISO()) return s.title;
    const c = climbOn(iso);
    return (c && c.area) ? c.area : s.title;
  }

  function titleFor(iso, s) {
    const label = titleOf(iso, s);
    const ran = runSplit(iso).bySession[s.id] || [];
    const metres = ran.reduce((n, a) => n + (a.distance || 0), 0);
    if (!metres) return esc(label);
    const m = String(label).match(/(\d+(?:\.\d+)?)\s*mi\b/);
    const actual = miles(metres);
    if (!m || m[1] === actual) return esc(label);
    /* Non-breaking space between the number and its unit. On a phone the
       title column is narrow enough that "6.01 mi" broke across two lines,
       leaving a bare "mi" under the distance. */
    return esc(String(label).replace(m[0], actual + ' mi')) +
      `<span class="planned">${esc(m[1])} mi planned</span>`;
  }

  function sessionRow(iso, s, i) {
    const done = doneOf(stateOf(iso), s);
    const tag = s.key ? '<span class="keytag">key</span>' : '';
    /* A tick that filled itself in is a small mystery unless the page owns up
       to it — and it is also the only thing on screen that says the Strava
       link is working, on a day Ric never opened the site.

       Always rendered, hidden when it does not apply, because the tick
       handler paints in place rather than re-rendering the row: the tag has
       to be there for the tap to be able to take it away. */
    const src = autoOf(stateOf(iso), s);
    const via = `<span class="viastrava"${src ? '' : ' hidden'}>via ${esc(src || 'Strava')}</span>`;
    const body = `<span class="slot">${esc(s.slot || '')}</span>
      <span class="txt">
        <span class="t">${titleFor(iso, s)}${tag}${via}</span>
        ${s.meta ? `<div class="m">${esc(s.meta)}</div>` : ''}
      </span>`;
    /* Two targets. The big one ticks — a 30px checkbox is the wrong size for
       cold hands. The chevron opens what you are actually meant to be doing,
       and it has to be its own control because a button cannot be nested
       inside a button. */
    const ticker = Owner.on()
      ? `<button type="button" class="ticker${done ? ' is-done' : ''}" data-tick="${iso}:${esc(s.id)}" aria-pressed="${done}">
           <span class="tickbox" aria-hidden="true">${done ? '✓' : ''}</span>${body}
         </button>`
      : `<div class="ticker static${done ? ' is-done' : ''}">${body}</div>`;
    /* A flag can carry somewhere to go — the marathon entry closes on a date
       and the plan says so a fortnight out. It sits OUTSIDE the ticker on
       purpose: in owner mode the ticker IS a button, and an anchor cannot
       live inside one — the same reason the chevron is its own control.

       http(s) only. The plan is Ric's own file served from this origin, so
       this is not a trust boundary so much as a typo guard: one line stops a
       malformed entry becoming a `javascript:` URL on a public page. */
    const href = /^https?:\/\//i.test(s.url || '') ? s.url : '';
    const link = href
      ? `<a class="sesslink" href="${esc(href)}" target="_blank" rel="noopener noreferrer"
           >${esc(s.urlLabel || 'Open')} ↗</a>`
      : '';
    const id = `${iso}:${i}`;
    const open = EXPANDED.has(id);
    return `<div class="sess">
      <div class="sessrow">
        ${ticker}
        <button type="button" class="expander" data-ex="${esc(id)}" aria-expanded="${open}"
                aria-label="Show what to do">${'›'}</button>
      </div>
      ${link}
      <div class="sessex" ${open ? '' : 'hidden'}>${open ? sessionPanel(iso, s) : ''}</div>
    </div>`;
  }

  /* ── what happened outside, at the foot of the day ──
     This sits under the sessions now rather than over them, by Ric's call:
     it is the thing that ALREADY happened, and it was pushing the checkboxes
     — the only part of the card you act on — down the screen.

     It carries the clip when there is one. ClimbMedia is loaded soft, so a
     log service that is down costs a thumbnail and nothing else. */
  function climbLink(iso) {
    const c = climbOn(iso);
    const m = (window.ClimbMedia && ClimbMedia.feature(iso)) || null;
    if (!c && !m) return '';
    const head = c
      ? `<strong>Climbed at ${esc(c.area)}</strong>
         <span class="cl-sub">${c.routes} route${c.routes === 1 ? '' : 's'} logged · see the climbing page</span>`
      : `<strong>Filmed that day</strong><span class="cl-sub">see the climbing page</span>`;
    return `<div class="climbwrap">
      <a class="climblink" href="${ROOT}projects/climbing/index.html#trip-${esc(iso)}">
        <span class="cl-ico">🧗</span>
        <span class="cl-txt">${head}</span>
        <span class="cl-go">→</span>
      </a>
      ${m ? `<div class="climbclip">${
        m.kind === 'video'
          ? `<video src="${esc(m.src)}" controls playsinline preload="metadata"></video>`
          : `<img src="${esc(m.src)}" alt="${esc(m.caption || m.route || '')}">`
      }</div>${m.route || m.caption ? `<div class="climbcap">${
        [m.route ? `<strong>${esc(m.route)}</strong>` : '', esc(m.caption || '')].filter(Boolean).join(' — ')
      }</div>` : ''}` : ''}
    </div>`;
  }

  /* ── the runs off the watch ──
     Pushed here by Strava the moment one syncs, and stored as numbers only —
     the Worker's allowlist keeps every coordinate out, so there is nothing to
     draw a route with and that is deliberate.

     Miles and min/mi because that is what the plan is written in: "Long run —
     7 mi" next to a card reading 11.3 km would make the reader do the
     conversion the page should have done. */
  const MI = 1609.344;
  const miles = m => (m / MI).toFixed(2).replace(/\.?0+$/, '');
  const clock = s => {
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
             : `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  const pace = a => {
    if (!a.distance || !a.moving_time) return '';
    const sPerMi = a.moving_time / (a.distance / MI);
    return `${Math.floor(sPerMi / 60)}:${String(Math.round(sPerMi % 60)).padStart(2, '0')}`;
  };

  /* Pace from a speed in metres per second, which is how Strava sends the
     averages — the summary line computes its own from distance and time, but
     max_speed has no distance to divide. */
  const paceOf = mps => {
    if (!mps) return '';
    const s = MI / mps;
    return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  };
  const feet = m => Math.round(m * 3.28084);

  /* Google's encoded polyline, which is what Strava sends. Signed values,
     five decimal places, each one stored as a delta from the last — which is
     why this has to be walked from the start rather than indexed into. */
  function decodeRoute(s) {
    const pts = [];
    let i = 0, lat = 0, lng = 0;
    while (i < s.length) {
      let b, shift = 0, result = 0;
      do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < s.length);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0; result = 0;
      do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20 && i < s.length);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      pts.push([lat / 1e5, lng / 1e5]);
    }
    return pts;
  }

  /* ── the map ──
     Real streets under the line, which means real map tiles, which means the
     one thing this site otherwise never does: a request to somebody else's
     server. OpenStreetMap's, for images only — no map library, no API key, no
     script from anywhere. If those tiles ever stop loading the line still
     draws on the background colour, because the route is ours and only the
     basemap is borrowed.

     Web Mercator, the projection every slippy map uses. Latitude goes through
     the log-tangent business below; longitude is a straight scale. */
  const TILE = 256, MAX_Z = 17;
  /* Sized to the room actually available, not to a constant. A fixed 320px
     box is wider than the panel on a phone, and because the page's cards are
     grid items — which refuse to shrink below their contents — one oversized
     map pushed the whole layout past the viewport and put a horizontal
     scrollbar on every card above it. Measured at open, which is the only
     moment the width is knowable from inside a string of HTML. */
  const mapBox = () => {
    const w = Math.max(200, Math.min(320, (window.innerWidth || 360) - 96));
    return [Math.round(w), Math.round(w * 0.75)];
  };
  const lngToWorld = (lng, z) => (lng + 180) / 360 * Math.pow(2, z) * TILE;
  const latToWorld = (lat, z) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, z) * TILE;
  };

  function routeMap(encoded) {
    const pts = decodeRoute(encoded);
    if (pts.length < 2) return '';
    const [MAP_W, MAP_H] = mapBox();
    const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
    /* A truncated or corrupt polyline decodes to NaN, and NaN survives every
       comparison below to come out as a tile grid that never loops and a path
       reading "MNaN NaN" — an empty grey box that looks like a broken map
       rather than an absent one. Nothing is the honest output. */
    if (![...lats, ...lngs].every(Number.isFinite)) return '';
    const bounds = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];

    /* The closest zoom that still fits the whole run in the box, with a
       margin so the line never touches the edge. Zooming to fit rather than
       to a fixed level is what makes a 3 km loop and a 20 km point-to-point
       both readable in the same 320px. */
    let z = MAX_Z;
    for (; z > 1; z--) {
      const w = lngToWorld(bounds[3], z) - lngToWorld(bounds[2], z);
      const h = latToWorld(bounds[0], z) - latToWorld(bounds[1], z);
      if (w <= MAP_W - 30 && h <= MAP_H - 30) break;
    }

    const cx = (lngToWorld(bounds[2], z) + lngToWorld(bounds[3], z)) / 2;
    const cy = (latToWorld(bounds[0], z) + latToWorld(bounds[1], z)) / 2;
    const left = cx - MAP_W / 2, top = cy - MAP_H / 2;

    /* Every tile the window overlaps, placed at its own world offset. */
    const n = Math.pow(2, z);
    const tiles = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + MAP_W) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + MAP_H) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wrapped = ((tx % n) + n) % n;             // the world repeats sideways
        tiles.push(`<img src="https://tile.openstreetmap.org/${z}/${wrapped}/${ty}.png"
          alt="" loading="lazy" draggable="false"
          style="left:${tx * TILE - left}px; top:${ty * TILE - top}px">`);
      }
    }

    const at = p => [(lngToWorld(p[1], z) - left).toFixed(1), (latToWorld(p[0], z) - top).toFixed(1)];
    const d = pts.map((p, i) => (i ? 'L' : 'M') + at(p).join(' ')).join(' ');
    const s = at(pts[0]), e = at(pts[pts.length - 1]);

    return `<div class="runmap" style="width:${MAP_W}px; height:${MAP_H}px">
      <div class="tiles">${tiles.join('')}</div>
      <svg class="line" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}"
           role="img" aria-label="A map of this run's route">
        <path d="${d}" fill="none" stroke="#fff" stroke-width="6"
              stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>
        <path d="${d}" fill="none" stroke="var(--brand)" stroke-width="3.2"
              stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${s[0]}" cy="${s[1]}" r="5" fill="#1a7f37" stroke="#fff" stroke-width="2"/>
        <circle cx="${e[0]}" cy="${e[1]}" r="5" fill="var(--brand-dark)" stroke="#fff" stroke-width="2"/>
      </svg>
      <span class="mapcredit">© <a href="https://www.openstreetmap.org/copyright"
        target="_blank" rel="noopener">OpenStreetMap</a> contributors</span>
    </div>
    <p class="mapkey"><span class="s">start</span><span class="e">finish</span></p>`;
  }

  /* Everything Strava gave us for one run, minus the things this site refuses
     to hold. Each cell is dropped entirely when the field is absent rather
     than printed as a dash: not every watch records power, and a column of
     blanks reads as broken rather than as "not measured". */
  function runDetail(a) {
    if (!a) return '';
    const cell = (k, v, sub) => v === undefined || v === null || v === '' ? ''
      : `<div><span class="k">${esc(k)}</span><span class="v">${esc(String(v))}${sub ? ` <small>${esc(sub)}</small>` : ''}</span></div>`;

    /* Nine cells, all of them about the run itself. Moving time, cadence,
       calories, relative effort, kudos, PRs and the watch model all came out
       by choice: moving time is on the card's summary line anyway, and the
       rest were either trivia or numbers nobody reads twice. The Worker still
       stores every one, so any of them is a line to put back — no re-ingest,
       no deploy of the Worker at all. */
    const grid = [
      cell('Distance', a.distance ? miles(a.distance) : '', 'mi'),
      cell('Elapsed', a.elapsed_time ? clock(a.elapsed_time) : ''),
      cell('Avg pace', pace(a) || paceOf(a.average_speed), '/mi'),
      cell('Best pace', paceOf(a.max_speed), '/mi'),
      cell('Elevation', a.total_elevation_gain ? feet(a.total_elevation_gain) : '', 'ft'),
      cell('Avg HR', a.average_heartrate ? Math.round(a.average_heartrate) : '', 'bpm'),
      cell('Max HR', a.max_heartrate ? Math.round(a.max_heartrate) : '', 'bpm'),
      cell('Power', a.average_watts ? Math.round(a.average_watts) : '', 'W avg'),
      /* Strava reports it in Celsius, from the watch, and only when the watch
         recorded one. Fahrenheit here because the rest of the page is in
         miles and feet. */
      cell('Temperature', a.average_temp === undefined || a.average_temp === null
        ? '' : Math.round(a.average_temp * 9 / 5 + 32), '°F')
    ].join('');

    /* No splits panel by choice — the Worker still keeps them, so putting the
       bars back is a render away and needs no re-ingest. */

    /* No route on a run that is only hours old, because the Worker holds it
       back from visitors until it is stale. Saying so is better than a gap:
       a missing map otherwise reads as something broken. Signed in there is
       nothing to explain — the route is always there. */
    const map = a.route ? routeMap(a.route)
      : (Owner.on() ? '' : `<p class="runnote">The map turns up a few minutes after a
           run does — where Ric ran is not published while he might still be out on it.</p>`);

    return `${map}<div class="rungrid">${grid}</div>
      <a class="runout" href="https://www.strava.com/activities/${esc(a.id)}"
         target="_blank" rel="noopener">View on Strava ↗</a>`;
  }

  /* Only runs count towards run mileage — the feed holds whatever the watch
     recorded, rides and walks included, and adding those to a running target
     would flatter it. Same three sports the Worker will tick for. */
  const RUN_SPORTS = { Run: 1, TrailRun: 1, VirtualRun: 1 };
  const isRun = a => !!(RUN_SPORTS[a.sport_type] || RUN_SPORTS[a.type]);

  /* What was actually run in a plan week, from Strava, in metres.
     Signed in, this includes runs marked private on Strava: they are withheld
     from visitors, not from the person who ran them, so the number Ric reads
     is the number he ran. A visitor's copy of this page never receives those
     runs and so counts a smaller total — which is the whole point. */
  function weekMetres(week) {
    let m = 0;
    (PLAN.days || []).filter(x => x.week === week).forEach(x => {
      (RUNS[x.date] || []).forEach(a => { if (isRun(a) && a.distance) m += a.distance; });
    });
    return m;
  }

  /* Which run belongs to which session. A run that matched something on the
     plan belongs inside that session's panel — the same panel the tick and
     the workout live in, because they are all one thing: what you were meant
     to do, whether you did it, and what actually happened.

     What is left over stays a card of its own: an unplanned run the plan has
     no slot for, and anything that is not a run at all. Those still have to
     appear somewhere, and there is no session to fold them into.

     The Worker's own matcher takes the first run-kind session of the day, so
     this pairs in the same order. Extra runs land on the last run session
     rather than being dropped. */
  function runSplit(iso) {
    const d = dayOf(iso);
    const all = RUNS[iso] || [];
    const runSessions = d ? (d.sessions || []).filter(x => x.kind === 'run') : [];
    const bySession = {};
    const loose = [];
    let n = 0;
    all.forEach(a => {
      if (!isRun(a) || !runSessions.length) { loose.push(a); return; }
      const target = runSessions[Math.min(n++, runSessions.length - 1)];
      (bySession[target.id] = bySession[target.id] || []).push(a);
    });
    return { bySession, loose };
  }

  /* The run as it appears inside a session panel: its name and headline
     numbers, then the map and the rest. No button — the session's own chevron
     already opened this. */
  function runBlock(a) {
    const p = pace(a);
    return `<div class="runblock">
      <div class="runhead">
        <strong>${esc(a.name || (a.hidden ? 'Private run' : 'Run'))}</strong>${a.hidden ? '<span class="privtag">only you</span>' : ''}
        <span class="runstats">
          ${a.distance ? `<span><b>${esc(miles(a.distance))}</b> mi</span>` : ''}
          ${a.moving_time ? `<span><b>${esc(clock(a.moving_time))}</b></span>` : ''}
          ${p ? `<span><b>${esc(p)}</b> /mi</span>` : ''}
          ${a.total_elevation_gain ? `<span><b>${feet(a.total_elevation_gain)}</b> ft</span>` : ''}
        </span>
      </div>
      ${runDetail(a)}
    </div>`;
  }

  /* A night on the board, under the climbing session it answered. Grouped by
     board because a session that touched both is two different walls and two
     different grade scales, and a single merged list would imply otherwise.

     Board grades stay board grades here — no conversion, no merging with the
     outdoor ledger. That rule is older than this feature. */
  function boardBlock(iso) {
    const list = BOARD[iso] || [];
    if (!list.length) return '';
    const byBoard = {};
    list.forEach(e => { (byBoard[e.board] = byBoard[e.board] || []).push(e); });

    return Object.entries(byBoard).map(([key, entries]) => {
      const sends = entries.filter(e => e.ascent);
      const hardest = sends.map(e => e.grade).filter(Boolean).sort().pop();
      const rows = entries.map(e => `<div class="bclimb">
          <span class="bg">${esc(e.grade || '—')}</span>
          <span class="bn">${esc(e.name || 'unnamed')}${e.benchmark ? '<span class="bbm" title="benchmark">★</span>' : ''}</span>
          <span class="ba">${e.angle != null ? esc(String(e.angle)) + '°' : ''}</span>
          <span class="bt">${e.ascent ? (e.tries === 1 ? 'flash' : `${esc(String(e.tries || '?'))} tries`) : 'no send'}</span>
        </div>`).join('');
      return `<div class="runblock">
        <div class="runhead">
          <strong>${esc(entries[0].label || key)}</strong>
          <span class="runstats">
            <span><b>${sends.length}</b> sent</span>
            <span><b>${entries.length}</b> logged</span>
            ${hardest ? `<span>hardest <b>${esc(hardest)}</b></span>` : ''}
          </span>
        </div>
        <div class="bclimbs">${rows}</div>
      </div>`;
    }).join('');
  }

  /* What one chevron opens: the workout, then whatever answered it — a run
     off the watch, or a night on the board. */
  function sessionPanel(iso, s) {
    const runs = runSplit(iso).bySession[s.id] || [];
    const board = s.kind === 'climb' ? boardBlock(iso) : '';
    return exercisePanel(s) + runs.map(runBlock).join('') + board;
  }

  function runLink(iso) {
    const list = runSplit(iso).loose;
    if (!list.length) return '';
    return list.map(a => {
      const p = pace(a);
      /* Keyed by the activity's own id, not its position. This list is the
         leftovers — the runs that did NOT fold into a session — so its
         indices stopped matching RUNS[iso] the moment folding existed, and
         the panel opened whichever activity happened to sit at that position
         in the full list instead. An id cannot drift. */
      const id = `${iso}:${a.id}`;
      const open = RUNOPEN.has(id);
      return `<div class="run${open ? ' is-open' : ''}">
        <button type="button" class="runlink" data-run="${esc(id)}" aria-expanded="${open}">
          <span class="cl-ico" aria-hidden="true">🏃</span>
          <span class="cl-txt"><strong>${esc(a.name || (a.hidden ? 'Private run' : 'Run'))}</strong>${a.hidden ? '<span class="privtag">only you</span>' : ''}
            <span class="runstats">
              ${a.distance ? `<span><b>${esc(miles(a.distance))}</b> mi</span>` : ''}
              ${a.moving_time ? `<span><b>${esc(clock(a.moving_time))}</b></span>` : ''}
              ${p ? `<span><b>${esc(p)}</b> /mi</span>` : ''}
              ${a.total_elevation_gain ? `<span><b>${feet(a.total_elevation_gain)}</b> ft</span>` : ''}
            </span>
            <span class="cl-sub">${a.hidden
              ? 'private on Strava — counted here, shown to nobody else'
              : 'from Strava — tap for the detail'}</span></span>
          <span class="cl-go" aria-hidden="true">›</span>
        </button>
        <div class="rundet" ${open ? '' : 'hidden'}>${open ? runDetail(a) : ''}</div>
      </div>`;
    }).join('');
  }

  /* Which days have their notes open. A set rather than one date, so reading
     yesterday's does not shut today's — and held outside the render, because
     every tick repaints the card underneath it. */
  const NOTES_OPEN = new Set();

  function notesBlock(iso) {
    const st = stateOf(iso);
    const notes = st.notes || [];
    const form = Owner.on() ? `<div class="noteform">
        <textarea data-note="${iso}" rows="1" placeholder="How did it go?"></textarea>
        <button type="button" data-addnote="${iso}">Post</button>
        <button type="button" class="secondary" data-addnote="${iso}" data-private="1">Private</button>
      </div>` : '';
    if (!notes.length && !form) return '';

    /* Shut by default. The notes were the tallest thing on every card and
       pushed the sessions — the part with the checkboxes on it — off the
       screen. Now the card says how many there are and you ask for them. */
    const open = NOTES_OPEN.has(iso);
    const label = notes.length
      ? `${notes.length} note${notes.length === 1 ? '' : 's'}`
      : 'Add a note';
    const list = notes.map(n => `<div class="note${n.public === false ? ' is-private' : ''}">
        ${esc(n.text)}<div class="when">${esc((n.at || '').slice(0, 10))}</div>
      </div>`).join('');
    return `<div class="notes">
      <button type="button" class="notesbtn" data-notes="${iso}" aria-expanded="${open}">
        <span class="nb-ico" aria-hidden="true">${notes.length ? '💬' : '✎'}</span>
        <span class="nb-txt">${esc(label)}</span>
        <span class="nb-go" aria-hidden="true">${open ? '−' : '+'}</span>
      </button>
      <div class="noteswrap"${open ? '' : ' hidden'}>${list}${form}</div>
    </div>`;
  }

  function dayCard(iso, isToday) {
    const d = dayOf(iso);
    if (!d) return '';
    const st = stateOf(iso);
    const main = d.sessions.find(s => s.key) || d.sessions.find(s => s.kind === 'climb' || s.kind === 'run') || d.sessions[0];
    const kind = main ? main.kind : 'rest';
    const doneCount = doneCountOf(st, d.sessions);
    const all = doneCount === d.sessions.length && d.sessions.length > 0;
    const allBtn = (Owner.on() && !all && d.sessions.length > 1)
      ? `<button type="button" class="allbtn" data-all="${iso}">Did all of it</button>` : '';
    return `<div class="activity${all ? ' all-done' : ''}">
      <div class="head">
        <div class="icon">${ICON[kind] || '🏃'}</div>
        <div class="meta">
          <div class="title">${esc(isToday ? 'Today' : pretty(iso))}${all ? '<span class="donetag">done</span>' : ''}</div>
          <div class="when">${esc(d.phase)}${d.deload ? ' · deload' : ''} · week ${d.week}${doneCount ? ` · ${doneCount}/${d.sessions.length}` : ''}</div>
        </div>
        <div class="kind">${esc(KINDNAME[kind] || 'Session')}</div>
      </div>
      <div class="body">
        ${runLink(iso)}
        ${d.sessions.length ? d.sessions.map((s, i) => sessionRow(iso, s, i)).join('') : '<div class="emptyday">Nothing scheduled.</div>'}
        ${allBtn}
        ${notesBlock(iso)}
        ${climbLink(iso)}
      </div>
    </div>`;
  }

  /* ---------- calendar ----------
     Public and forward-looking. The plan file already holds all 364 days, so
     this needs no upkeep — it is a view, not a second copy of anything. */
  function mountOwnerBar() {
    const bar = $('#ownerbar');
    bar.hidden = false;
    if (Owner.on()) {
      const q = Owner.pending();
      bar.innerHTML = `<strong>Signed in.</strong> <span id="ownerstate">${q
          ? `${q} tick${q === 1 ? '' : 's'} waiting for signal — they'll send themselves.`
          : 'ticks and notes save as you tap.'}</span>
        <button type="button" class="ownerbtn" id="signout">sign out</button>`;
      $('#signout').onclick = () => Owner.signOut();
    } else {
      Owner.mountBox(bar, { title: 'Password', note: '' });
    }
  }

  const say = t => { const el = $('#ownerstate'); if (el) el.textContent = t; };

  /* ---------- writes ----------
     The local state is updated FIRST, mirroring exactly what the Worker will
     do to it. That is what makes an offline tick survive a reload: the write
     sits in the queue and the cache already shows its effect, so the page is
     not lying about anything — it is showing the state the server will hold
     as soon as there is signal.

     This merge has to match worker.mjs. If one changes, change both. */
  function applyLocal(iso, body) {
    const prev = LOG[iso] || { done: {}, ticks: {}, auto: {}, notes: [] };
    /* Touching a session takes it off Strava — the same rule the Worker
       applies, so the "via Strava" tag disappears on the tap rather than on
       the reload after it. */
    const auto = { ...(prev.auto || {}) };
    for (const k of Object.keys(body.done || {})) delete auto[k];
    LOG[iso] = {
      auto,
      done: { ...prev.done, ...(body.done || {}) },
      ticks: { ...prev.ticks, ...(body.ticks || {}) },
      notes: Array.isArray(body.notes) ? body.notes : (prev.notes || []),
      updated: new Date().toISOString()
    };
  }

  async function save(iso, body) {
    const before = LOG[iso] ? JSON.parse(JSON.stringify(LOG[iso])) : undefined;
    applyLocal(iso, body);
    cacheLog();

    const out = await Owner.post(`/log/${iso}`, body, { queue: true });

    if (out && out.queued) {
      /* No signal. The optimistic state STANDS — rolling it back here would
         be the lie, because the write is kept and will land. */
      say(`saved on this device — ${Owner.pending()} waiting for signal.`);
      return { queued: true };
    }
    if (!out) {
      /* Refused rather than unreachable: put it back the way it was. */
      if (before === undefined) delete LOG[iso]; else LOG[iso] = before;
      cacheLog();
      say('not saved — tap again.');
      return null;
    }
    LOG[iso] = { done: out.done, ticks: out.ticks, auto: out.auto || {}, notes: out.notes, updated: out.updated };
    cacheLog();
    say(Owner.pending() ? `saved — ${Owner.pending()} still waiting.` : 'saved.');
    return out;
  }

  /* Scoped to a root, because the calendar re-renders on its own — on month
     navigation and after every tick — while #today stays put. An unscoped
     wire() would add a SECOND listener to those existing rows each time, and
     one tap would toggle twice and cancel itself out.

     The Recent feed used to be the other fixed root here. It was fourteen
     copies of the calendar's own day panel stacked under it, and the calendar
     is the better way to reach any of them — so it went, by Ric's call, on
     2026-08-19. */
  function wire(root) {
    root = root || document;
    /* Open the notes. Toggled in place rather than through a re-render: a
       repaint here would rebuild the textarea and throw away whatever was
       half-typed in it. */
    root.querySelectorAll('[data-notes]').forEach(b => b.addEventListener('click', () => {
      const iso = b.dataset.notes;
      const wrap = b.parentElement.querySelector('.noteswrap');
      const open = wrap.hidden;
      wrap.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
      b.querySelector('.nb-go').textContent = open ? '−' : '+';
      if (open) { NOTES_OPEN.add(iso); const ta = wrap.querySelector('[data-note]'); if (ta) ta.focus(); }
      else NOTES_OPEN.delete(iso);
    }));
    root.querySelectorAll('[data-tick]').forEach(b => b.addEventListener('click', async () => {
      const [iso, sid] = b.dataset.tick.split(':');
      const now = b.getAttribute('aria-pressed') !== 'true';
      /* Paint first. At a crag on one bar, a checkbox that waits reads as broken. */
      b.setAttribute('aria-pressed', String(now));
      b.classList.toggle('is-done', now);
      b.querySelector('.tickbox').textContent = now ? '✓' : '';
      /* Whichever way it was tapped, the tick is Ric's now and not the
         watch's — same rule applyLocal and the Worker apply to the state. */
      const via = b.querySelector('.viastrava');
      const wasVia = via && !via.hidden;
      if (via) via.hidden = true;
      const st = stateOf(iso);
      const out = await save(iso, { done: { ...st.done, [sid]: now } });
      if (!out) {                                    // roll the optimistic paint back
        b.setAttribute('aria-pressed', String(!now));
        b.classList.toggle('is-done', !now);
        b.querySelector('.tickbox').textContent = !now ? '✓' : '';
        if (via) via.hidden = !wasVia;
      }
      /* Keep the month grid in step — a tick anywhere should turn its cell
         green, including a tick made from inside the calendar itself. */
      changed();
    }));

    /* Toggled in place rather than through a full re-render: the panel is
       static content, and re-rendering would scroll the page out from under
       a thumb that just tapped it. */
    root.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.ex;
      const panel = b.closest('.sess').querySelector('.sessex');
      const open = !EXPANDED.has(id);
      if (open) {
        const [iso, i] = id.split(':');
        const d = dayOf(iso);
        panel.innerHTML = sessionPanel(iso, d.sessions[+i]);
        EXPANDED.add(id);
      } else {
        EXPANDED.delete(id);
      }
      panel.hidden = !open;
      b.setAttribute('aria-expanded', String(open));
    }));

    /* Same in-place toggle as the session panels, for the same reason: a full
       re-render would move the card out from under the thumb that opened it. */
    root.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.run;
      const card = b.closest('.run');
      const panel = card.querySelector('.rundet');
      const open = !RUNOPEN.has(id);
      if (open) {
        /* Split once from the left: an activity id is all digits, but the
           date in front of it carries the only other colons. */
        const iso = id.slice(0, 10), rid = id.slice(11);
        const a = (RUNS[iso] || []).find(x => String(x.id) === rid);
        panel.innerHTML = a ? runDetail(a) : '';
        RUNOPEN.add(id);
      } else {
        RUNOPEN.delete(id);
      }
      panel.hidden = !open;
      card.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', String(open));
    }));

    root.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', async () => {
      const iso = b.dataset.all;
      const d = dayOf(iso);
      const done = {};
      d.sessions.forEach(s => { done[s.id] = true; });
      b.disabled = true; b.textContent = 'saving…';
      const out = await save(iso, { done });
      if (out) changed(); else { b.disabled = false; b.textContent = 'Did all of it'; }
    }));

    root.querySelectorAll('[data-addnote]').forEach(b => b.addEventListener('click', async () => {
      const iso = b.dataset.addnote;
      /* The textarea in THIS form, not the first one on the page with a
         matching date. Selecting today in the calendar puts the same date on
         screen twice — today's card and the day panel — and a document-wide
         lookup always found the card's. Typing a note in the calendar and
         pressing Post read the empty box up the page, bailed, and moved your
         cursor there. */
      const ta = b.closest('.noteform').querySelector('[data-note]');
      const text = (ta.value || '').trim();
      if (!text) { ta.focus(); return; }
      const st = stateOf(iso);
      const notes = [...(st.notes || []), {
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        text, public: !b.dataset.private, at: new Date().toISOString()
      }];
      ta.value = '';
      if (await save(iso, { notes })) changed();
    }));

    /* Enter posts a public note; Shift+Enter is a newline. */
    root.querySelectorAll('[data-note]').forEach(ta => ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        ta.closest('.noteform').querySelector('[data-addnote]:not([data-private])').click();
      }
    }));
  }


  /* ── what the pages get ──
     Grouped the way a page uses them: ask what the plan says, ask what
     happened, draw a piece of it, then wire up the taps. Everything else in
     this file is deliberately private — the state objects in particular, so a
     page cannot write to LOG behind save()'s back and leave the cache and the
     Worker holding different answers. */
  global.Training = {
    /* lifecycle */
    load, onChange(fn) { ONCHANGE = fn || (() => {}); }, changed,
    ready: () => !!PLAN,
    stale: () => LOG_STALE,

    /* the plan */
    plan: () => PLAN,
    days: () => (PLAN && PLAN.days) || [],
    weeks: () => (PLAN && PLAN.weeks) || {},
    phases: () => (PLAN && PLAN.phases) || [],
    dayOf, weekMetres,

    /* what happened */
    stateOf, doneOf, doneCountOf, autoOf, climbOn, runSplit,
    runsOn: iso => RUNS[iso] || [],
    boardOn: iso => BOARD[iso] || [],
    save,

    /* drawing — the whole panel, or the pieces it is made of. The home page's
       "last workout" card composes its own from the pieces, because it wants
       what HAPPENED first and the prescription second, where a session row
       wants the prescription first and the evidence under it. */
    dayCard, sessionRow, sessionPanel, runLink, notesBlock, climbLink,
    runBlock, boardBlock, exercisePanel,
    mountOwnerBar, wire,

    /* odds and ends the pages format with */
    /* titleOf is exported because three pages draw a session title without
       going through sessionRow, and a label that turns into a crag on one page
       and not the others would be worse than not doing it at all. */
    titleOf,
    esc, isoOf, todayISO, pretty, miles, ICON, KINDNAME
  };
})(window);
