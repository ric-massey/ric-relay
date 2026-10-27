/* Weather Pro's workstation — panels on one shared place and time
   ────────────────────────────────────────────────────────────────────────────
   WORKSTATION.md's plan (Ric, 2026-10-23: "worked on at some point in time
   soon"; 2026-10-22: "finish what the AI needs to do"). Pro stays one page;
   what this adds:

     panels      more maps beside the main one, each any layer the main map
                 can show. A panel is this same page in a frame with
                 ?panel=1 — only its map (app.js) — so every product works in
                 a panel exactly as it does on the main map, with nothing
                 rewritten. Frames talk to this page by postMessage, checked
                 for origin and sender both ways, as the front door's does.
     the bus     one place and one time. Move or zoom any map and the others
                 follow; step any loop (or the sounding's hour) and the others
                 go to their frame nearest that moment. A forecast panel goes
                 to its valid hour; an observation keeps its own scan time and
                 its header says how far that is from the shared time.
     headers     every map says what it shows and when: observed, analysis,
                 or a forecast with its run and valid time.
     workspaces  the layout — the main map's layers, the panels', which
                 readout cards show and in what order, what is synced — saved
                 by name in this browser, duplicated, renamed, shared as a
                 link. A layout never holds a place: a link carries the map's
                 view only if the visitor ticks it (hard rule 1, and the
                 room's: a visitor's place stays in their own browser).
     presets     Forecast Analysis and Severe Weather. A preset never limits
                 what can be opened: Explore lists every tool, grouped by what
                 it measures, and puts any of them on the main map or in a
                 new panel.

   The pure part (the workspace's shape, the link) is exported for
   test/workstation.test.mjs; the page part runs only in a browser. */
(function (root) {
  'use strict';

  /* ── the workspace: its shape, and the only words it is written in ── */
  const MAX_PANELS = 4;
  /* the readout cards a workspace may arrange; warnings are never hidden */
  const CARDS = ['hero', 'alerts', 'nearby', 'national', 'sky', 'afd', 'meso', 'models', 'record', 'sources'];
  const LOCKED = ['alerts', 'nearby', 'national'];
  const CARD_NAMES = { hero: 'Now and the forecast', alerts: 'Official alerts', nearby: 'Warnings nearby', national: 'Warnings across the US', sky: 'The air above you (sounding)',
    afd: 'Forecast discussion', meso: 'SPC mesoanalysis', models: 'Compare the models', record: 'How accurate it has been here', sources: 'Where this comes from' };
  /* a layer string is app.js's link words: l=…&s=…&o=…&m=…&r=…&g=…&t=…&a=…&k=…
     — anything else is not one. `v` (a place) is never part of a layer. */
  const LAYER_KEYS = ['l', 's', 'o', 'm', 'r', 'g', 't', 'a', 'k', 'd'];
  function cleanLayer(str) {
    if (typeof str !== 'string' || str.length > 300) return null;
    const q = new URLSearchParams(str.replace(/^#/, '')), out = new URLSearchParams();
    for (const k of LAYER_KEYS) {
      const v = q.get(k);
      if (v != null && /^[A-Za-z0-9:._-]{0,40}$/.test(v)) out.set(k, v);
    }
    return out.get('l') ? out.toString().replace(/%3A/g, ':') : null;
  }
  /* two ways of writing the same layers say the same thing: an empty value
     and the lowest tilt (the default) are left out, the overlays' letters
     are a set, and the browser's mesoanalysis is the server's standing in
     for it (app.js falls back to it when the server has nothing recent) */
  function sameLayer(a, b) {
    const canon = (x) => {
      const q = new URLSearchParams(cleanLayer(x) || '');
      return [...q].filter(([k, v]) => v !== '' && !(k === 't' && v === '0'))
        .map(([k, v]) => [k, k === 'o' ? [...v].sort().join('') : k === 'm' ? v.replace(/^meso\./, 'smeso.') : v]).sort().map(([k, v]) => k + '=' + v).join('&');
    };
    return canon(a) === canon(b);
  }
  function sameWorkspace(a, b) {
    a = clean(a); b = clean(b);
    if (!a || !b) return false;
    /* both completed as apply() completes them, so Default is not "changed" the moment it opens */
    return (a.main == null || b.main == null || sameLayer(completeLayer(a.main), completeLayer(b.main))) && a.panels.length === b.panels.length && a.panels.every((x, i) => sameLayer(x, b.panels[i])) && a.layout === b.layout
      && a.cards.order.join() === b.cards.order.join() && a.cards.hidden.slice().sort().join() === b.cards.hidden.slice().sort().join()
      && a.sync.place === b.sync.place && a.sync.time === b.sync.time;
  }
  function cleanName(n) { return String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40); }
  function clean(ws) {
    if (!ws || typeof ws !== 'object') return null;
    const order = Array.isArray(ws.cards && ws.cards.order) ? ws.cards.order.filter((c) => CARDS.includes(c)) : [];
    for (const c of CARDS) if (!order.includes(c)) order.push(c);
    const hidden = Array.isArray(ws.cards && ws.cards.hidden) ? ws.cards.hidden.filter((c) => CARDS.includes(c) && !LOCKED.includes(c)) : [];
    return {
      v: 1,
      name: cleanName(ws.name) || 'Shared workspace',
      main: cleanLayer(ws.main),
      panels: (Array.isArray(ws.panels) ? ws.panels : []).map(cleanLayer).filter(Boolean).slice(0, MAX_PANELS),
      cards: { order, hidden: [...new Set(hidden)] },
      sync: { place: !(ws.sync && ws.sync.place === false), time: !(ws.sync && ws.sync.time === false) },
      /* the maps one under another ('stack'), or side by side filling the screen ('grid', 2026-10-23) */
      layout: ws.layout === 'grid' ? 'grid' : 'stack'
    };
  }

  /* What a workspace sets on the main map, every time (2026-10-24, after an
     outside check: Marine, then Default, left the model menu on ECMWF waves —
     "does Default restore a known configuration?"). A workspace's main map is
     completed with the page's own first-visit choices for anything it does not
     name — the national mosaic, no satellite under it, watches and the map's
     lines, and the model, satellite and MRMS menus on HRRR composite
     reflectivity, band 13 and rotation tracks — so choosing a workspace always
     ends in the same state, whatever was on screen before. */
  const DEFAULT_MAIN = { l: 'comp', s: '', o: 'w', m: 'hrrr.refc', g: 'b13.conus.auto', r: 'rot60' };
  function completeLayer(str) {
    const q = new URLSearchParams(cleanLayer(str || '') || '');
    for (const [k, v] of Object.entries(DEFAULT_MAIN)) if (!q.has(k)) q.set(k, v);
    return cleanLayer(q.toString());
  }
  const PRESETS = [
    clean({ name: 'Default', main: 'l=comp', panels: [] }),
    /* the pattern and the next days: the 500 mb trough in two models, the
       surface, and the water vapour that shows the jet's moisture */
    clean({ name: 'Forecast Analysis', main: 'l=model&o=w&m=gfs.h500', layout: 'grid',
      panels: ['l=model&o=&m=ecmwf.h500', 'l=model&o=&m=gfs.mslp', 'l=abi&o=&g=b9.conus.auto'],
      cards: { order: ['hero', 'alerts', 'nearby', 'national', 'models', 'afd', 'sky', 'record', 'sources', 'meso'], hidden: ['meso'] } }),
    /* a storm day: the radar's own reflectivity with watches, cells, reports
       and lightning; storm-relative velocity; the environment's effective
       STP; the rotation tracks */
    clean({ name: 'Severe Weather', main: 'l=l3:ref&o=wcrl', layout: 'grid',
      panels: ['l=l3:srv&o=wc', 'l=model&o=w&m=smeso.stpe', 'l=mrms&o=w&r=rot60'],
      cards: { order: ['alerts', 'nearby', 'national', 'sky', 'meso', 'hero', 'models', 'sources', 'afd', 'record'], hidden: ['afd', 'record'] } }),
    /* ── presets by the weather, not by the job (UI-REVIEW-2 item 5,
       2026-10-24): WORKSTATION.md's caution still holds — Pro is not trying
       to be ForeFlight — so each is a starting layout for a kind of day,
       made only of what the page already draws. ── */
    /* a winter storm: what falls (the HRRR's type), how much snow, where the
       850 mb freezing line runs, and the Blend's chance of an inch */
    clean({ name: 'Winter Storm', main: 'l=model&o=w&m=hrrr.ptype', layout: 'grid',
      panels: ['l=model&o=&m=hrrr.snow', 'l=model&o=&m=nam.t850', 'l=model&o=&m=nbm.p_snow1'],
      cards: { order: ['alerts', 'nearby', 'hero', 'sky', 'afd', 'models', 'national', 'record', 'sources', 'meso'], hidden: ['meso'] } }),
    /* the tropics: water vapour with the NHC's cones, the radar, the GFS's
       pressure and ECMWF's wind */
    clean({ name: 'Tropical', main: 'l=abi&o=h&g=b9.conus.auto', layout: 'grid',
      panels: ['l=comp&o=h', 'l=model&o=h&m=gfs.mslp', 'l=model&o=h&m=ecmwf.wind10'],
      cards: { order: ['alerts', 'nearby', 'national', 'hero', 'afd', 'models', 'sky', 'record', 'sources', 'meso'], hidden: ['meso', 'sky'] } }),
    /* fire weather: the hot-dry-windy index (wind and dry air together),
       gusts, smoke at the ground, GOES's fire-detection picture, lightning
       (smoke and HDW added 2026-10-24) */
    clean({ name: 'Fire Weather', main: 'l=model&o=l&m=hrrr.hdw', layout: 'grid',
      panels: ['l=model&o=&m=hrrr.gust', 'l=abi&o=l&g=fire.conus.auto', 'l=model&o=&m=hrrr.smoke'],
      cards: { order: ['alerts', 'nearby', 'hero', 'afd', 'models', 'sky', 'national', 'record', 'sources', 'meso'], hidden: ['meso'] } }),
    /* on the water (2026-10-24, after an outside review: sailors asked for
       wind and waves together): ECMWF's wave height and peak period, the
       wind, and the pressure pattern driving it. Tides, currents and buoys
       are not in it — their hosts were out of reach. */
    clean({ name: 'Marine', main: 'l=model&o=&m=ecwave.swh', layout: 'grid',
      panels: ['l=model&o=&m=ecwave.pp1d', 'l=model&o=&m=ecmwf.wind10', 'l=model&o=&m=gfs.mslp'],
      cards: { order: ['alerts', 'nearby', 'hero', 'models', 'afd', 'national', 'sky', 'record', 'sources', 'meso'], hidden: ['meso', 'sky'] } }),
    /* growing (2026-10-24): frost, the soil's warmth and water, how fast the
       ground dries, and the Blend's chance of rain — information, not a
       spray or planting verdict (the room's rule) */
    clean({ name: 'Growing', main: 'l=model&o=&m=gfs.tmin', layout: 'grid',
      panels: ['l=model&o=&m=gfs.tsoil', 'l=model&o=&m=gfs.soilw', 'l=model&o=&m=nbm.p_rain6'],
      cards: { order: ['hero', 'alerts', 'nearby', 'models', 'afd', 'record', 'national', 'sky', 'sources', 'meso'], hidden: ['meso', 'sky'] } }),
    /* flying, for a look and never as a briefing: the radar with the
       stations (ceiling and visibility in their plots), lightning and
       watches; the HRRR's visibility; the Blend's chance of a ceiling under
       1,000 ft; the 250 mb wind */
    clean({ name: 'Flying (not a briefing)', main: 'l=comp&o=slw', layout: 'grid',
      panels: ['l=model&o=&m=hrrr.vis', 'l=model&o=&m=nbm.p_ceil1k', 'l=model&o=&m=gfs.jet250'],
      cards: { order: ['alerts', 'nearby', 'hero', 'afd', 'models', 'sky', 'national', 'record', 'sources', 'meso'], hidden: ['meso'] } }),
    /* a morning briefing: today's SPC outlook and watches over the radar, the
       500 mb pattern, the HRRR's picture of the day's storms, water vapour —
       and the forecasters' discussion first among the cards */
    clean({ name: 'Morning Briefing', main: 'l=comp&o=ow', layout: 'grid',
      panels: ['l=model&o=&m=gfs.h500', 'l=model&o=&m=hrrr.refc', 'l=abi&o=&g=b9.conus.auto'],
      cards: { order: ['afd', 'alerts', 'nearby', 'hero', 'models', 'sky', 'national', 'meso', 'record', 'sources'], hidden: [] } })
  ];
  /* What each preset has, and what a professional in that line of work would
     still need that it does not (2026-10-24, after an outside check: "the
     presets are becoming broad, but many remain shallow… a problem if the
     interface presents a category as more complete than it actually is").
     Said when the preset is chosen and on its option in the menu. Keep the
     "not here" true: take a thing off it only when the page really has it. */
  const PRESET_NOTES = {
    'Default': 'The first-visit map: the national radar mosaic, with watches.',
    'Forecast Analysis': '500 mb in the GFS and ECMWF, the surface pressure and water vapour. Not here: upper-air observations (balloon soundings as maps), WPC\'s forecasts.',
    'Severe Weather': 'The nearest radar\'s reflectivity and storm-relative velocity, the environment (STP) and rotation tracks. Not here: a storm-scale ensemble (HREF is not open), spotter and mPING reports — and never a warning: those are the NWS\'s.',
    'Winter Storm': 'Precipitation type, snow, the 850 mb freezing line and the Blend\'s chance of an inch. Not here: WPC\'s winter outlooks, snow observations (NOHRSC), road conditions.',
    'Tropical': 'Water vapour and the NHC\'s cones, the radar, GFS pressure and ECMWF wind. Not here: recon flights, buoys and ships, the NHC\'s own wind-speed probabilities as a map.',
    'Fire Weather': 'The hot-dry-windy index, gusts, smoke and GOES\'s fire picture. Not here: RAWS stations, fuel moisture, the NWS\'s fire-weather forecasts and spot forecasts.',
    'Marine': 'Wave height and period, wind and pressure — a start. Not here: tides, currents, buoy observations, swell direction or marine forecasts (their sources were out of reach).',
    'Growing': 'Frost, soil warmth and water, evaporation and the chance of rain. Not here: farm observing networks (mesonets) or crop-specific guidance.',
    'Flying (not a briefing)': 'A look only: radar with airport plots, visibility, the chance of a low ceiling, the jet. Not here: METARs and TAFs in full, AIRMETs and SIGMETs, icing, turbulence or winds aloft — get an official briefing.',
    'Morning Briefing': 'SPC\'s outlook and watches over the radar, 500 mb, the HRRR\'s storms and water vapour, the forecasters\' discussion first.'
  };

  /* ── the link ──
     #ws=<the workspace, base64url JSON>, and only if asked, &v=<the main
     map's view> and &at=<the shared time>. Nothing else of the page goes in. */
  const b64 = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'); };
  function linkHash(ws, { view = null, at = null } = {}) {
    const w = clean(ws);
    let h = `ws=${b64(JSON.stringify(w))}`;
    if (view && /^-?\d{1,2}(\.\d)?,-?\d{1,3}(\.\d)?,\d{1,2}$/.test(view)) h += `&v=${view}`;
    if (Number.isFinite(at)) h += `&at=${Math.round(at / 60e3) * 60e3}`;
    return h;
  }
  function readHash(hash) {
    const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    const raw = q.get('ws');
    if (!raw || raw.length > 4000) return null;
    let ws = null;
    try { ws = clean(JSON.parse(unb64(raw))); } catch (e) { return null; }
    if (!ws) return null;
    const v = q.get('v'), at = Number(q.get('at'));
    return { ws, view: v && /^-?\d{1,2}(\.\d)?,-?\d{1,3}(\.\d)?,\d{1,2}$/.test(v) ? v : null, at: Number.isFinite(at) && at > 0 ? at : null };
  }

  /* ── what a panel's header says ── */
  function stampText(st, busT, fmt) {
    if (!st || !st.layer) return 'starting…';
    if (!Number.isFinite(st.t)) return `${st.layer} · loading`;
    const hz = (ms) => new Date(ms).toISOString().slice(11, 13) + 'Z';
    /* a week or more away, the date itself; nearer, the weekday */
    const far = (ms) => Math.abs(ms - Date.now()) > 6 * 86400e3;
    const dayOf = (ms) => (far(ms) ? fmt.ymd(ms) : fmt.day(ms)) + ' ';
    const when = fmt.time(st.t), day = fmt.ymd(st.t) !== fmt.ymd(Date.now()) ? dayOf(st.t) : '';
    /* a loop playing, with no other map to share time with: the loop's span,
       and for an observation how fresh its newest frame is — not each
       frame's age as it comes round, which read like a stale feed
       (UI-REVIEW-2 item 2) */
    if (st.loop && busT == null && st.kind !== 'archive') {
      const a = st.loop.from, b = st.loop.to, dA = fmt.ymd(a) !== fmt.ymd(Date.now()) ? dayOf(a) : '', dB = fmt.ymd(b) !== fmt.ymd(a) ? dayOf(b) : '';
      let s = `${st.layer} · ${st.kind === 'forecast' && st.run ? `run ${hz(st.run)} · ` : ''}loop ${dA}${fmt.time(a)}–${dB}${fmt.time(b)}`;
      if (st.kind !== 'forecast') {
        const age = Math.max(0, Date.now() - b);
        s += ` · newest ${age < 2 * 60e3 ? 'just now' : `${age < 3600e3 ? Math.round(age / 60e3) + ' min' : Math.round(age / 3600e3) + ' h'} ago`}`;
      }
      return s;
    }
    let s = st.layer + ' · ';
    if (st.kind === 'forecast') s += `${st.run ? `run ${hz(st.run)} ${fmt.ymd(st.run) !== fmt.ymd(st.t) ? dayOf(st.run) : ''}· ` : ''}valid ${day}${when}`;
    else if (st.kind === 'analysis') s += `analysis ${day}${when}`;
    else if (st.kind === 'archive') s += `archive ${fmt.day(st.t)} ${fmt.ymd(st.t).slice(0, 10)} ${when}`;
    else s += `observed ${day}${when}`;
    /* an observation is never "after now": a scan stamped ahead of this computer's clock is the clock's error */
    const ref = busT == null ? Date.now() : busT, d = busT == null && st.kind !== 'forecast' ? Math.min(0, st.t - ref) : st.t - ref, a = Math.abs(d);
    if (a >= 2 * 60e3 && st.kind !== 'archive' && !(busT == null && far(st.t))) {
      const amt = a < 3600e3 ? `${Math.round(a / 60e3)} min` : a < 48 * 3600e3 ? `${Math.round(a / 3600e3)} h` : `${Math.round(a / 86400e3)} days`;
      /* against the clock it is an age ("5 min ago", "in 3 h"); against another map, a gap */
      s += busT == null ? ` · ${d < 0 ? `${amt} ago` : `in ${amt}`}` : ` · ${amt} ${d < 0 ? 'before' : 'after'} the shared time`;
    }
    /* how complete what is drawn is (2026-10-24): side by side, a map still
       loading or one whose file failed must not look like the others */
    if (st.state === 'loading') s += ' · loading…';
    else if (st.state === 'failed') s += ' · did not load';
    return s;
  }

  /* The timeline's labels (2026-10-23, UI-REVIEW B2): which frames get a
     time under them, and what it says. A model's frames say their forecast
     hour (F000, F006 …) at the coarsest of 1/3/6/12/24 h that fits; anything
     else says its clock time at the first frame past each boundary of the
     smallest step (5 min … 1 day) that fits, with the weekday when the day
     changes. At most maxLabels, never two on the same frame. */
  const pad3 = (n) => String(Math.max(0, Math.round(n))).padStart(3, '0');
  function timelineMarks(frames, fmt, maxLabels) {
    const n = frames.length, max = Math.max(2, maxLabels | 0), out = [];
    if (!n) return out;
    if (frames.every((f) => Number.isFinite(f.fh))) {
      for (const step of [1, 3, 6, 12, 24, 48]) {
        const at = frames.map((f, i) => (f.fh % step === 0 ? i : -1)).filter((i) => i >= 0);
        if (at.length <= max || step === 48) { for (const i of at) out.push({ i, text: 'F' + pad3(frames[i].fh) }); return out; }
      }
    }
    const ts = frames.map((f) => f.t);
    if (!ts.every(Number.isFinite)) return out;
    for (const min of [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440]) {
      const step = min * 60e3, at = [];
      for (let i = 1; i < n; i++) if (Math.floor(ts[i] / step) !== Math.floor(ts[i - 1] / step)) at.push(i);
      if (!at.length && n) at.push(0);
      if (at.length <= max || min === 1440) {
        let lastDay = null;
        for (const i of at) {
          const day = fmt.ymd(ts[i]);
          out.push({ i, text: (lastDay !== null && day !== lastDay) || (lastDay === null && day !== fmt.ymd(Date.now())) ? `${fmt.day(ts[i])} ${fmt.time(ts[i])}` : fmt.time(ts[i]) });
          lastDay = day;
        }
        return out;
      }
    }
    return out;
  }

  /* Compare and Trend (2026-10-23, UI-REVIEW B3 — Pivotal's two modes).
     Compare: the main map's field in the other models that have it, at the
     same valid time, three at most — a storm-scale model against the others
     of its kind first (HRRR, NAM 3 km, RAP), a global one against the
     globals (ECMWF, GFS, AIFS). Trend: the same model and field from
     the runs before (the Run picker's "the one before" … "three before"),
     so the maps show how the forecast for one moment has moved. Both keep
     the main map's overlays; neither ever holds a place. null when the main
     map is not a model these apply to. */
  /* the drawer's tabs: one short word a card (B4) */
  const CARD_TABS = { hero: 'Now', alerts: 'Alerts', nearby: 'Nearby', national: 'Warnings', sky: 'Sounding', afd: 'Discussion', meso: 'Meso', models: 'Models', record: 'Record', sources: 'Sources' };
  const COMPARE_ORDER = ['hrrr', 'nam', 'rap', 'gfs', 'ecmwf', 'aifs', 'ukmet'], GLOBAL = ['ecmwf', 'gfs', 'aifs', 'ukmet'];
  const modelOf = (mainStr) => {
    const q = new URLSearchParams(cleanLayer(mainStr) || '');
    if (q.get('l') !== 'model') return null;
    const [src, field, back] = (q.get('m') || '').split('.');
    /* `back` is 1–3 runs before the newest; a picked run (YYYYMMDDHH, 2026-10-24) is not a count */
    return COMPARE_ORDER.includes(src) && field ? { q, src, field, back: /^[1-3]$/.test(back || '') ? Number(back) : 0 } : null;
  };
  const withModel = (q, m) => { const o = new URLSearchParams(q); o.set('m', m); return cleanLayer(o.toString()); };
  function compareLayers(mainStr, hasField) {
    const M = modelOf(mainStr);
    if (!M) return null;
    /* a global model is compared with the other globals first, a storm-scale one with its own kind */
    const order = GLOBAL.includes(M.src) ? [...GLOBAL, ...COMPARE_ORDER.filter((x) => !GLOBAL.includes(x))] : COMPARE_ORDER;
    return order.filter((s) => s !== M.src && hasField(s, M.field)).slice(0, MAX_PANELS - 1)
      .map((s) => withModel(M.q, `${s}.${M.field}`));
  }
  /* Compare only what shows the same thing: the same field id, the same
     quantity shaded on the same colours with the same lines (MM.signature,
     2026-10-24 — an outside check found "500 mb heights and vorticity" beside
     one model's wind and another's heights alone), and the same quantity by
     name: surface CAPE and most-unstable CAPE, or precipitable water and
     total column water, share a unit and colours but are not the same thing
     (bug review, 2026-10-25). The name is the label without its bracket. */
  function comparable(MM, src, field, other) {
    const A = MM.field(src, field), B = MM.field(other, field);
    const named = (F) => F.label.replace(/ \(.*\)$/, '');
    return !!(A && B && MM.signature(A) === MM.signature(B) && named(A) === named(B));
  }
  function trendLayers(mainStr) {
    const M = modelOf(mainStr);
    if (!M) return null;
    return [0, 1, 2, 3].filter((b) => b !== M.back).map((b) => withModel(M.q, b ? `${M.src}.${M.field}.${b}` : `${M.src}.${M.field}`));
  }

  const api = { MAX_PANELS, CARDS, LOCKED, PRESETS, PRESET_NOTES, DEFAULT_MAIN, completeLayer, cleanLayer, sameLayer, sameWorkspace, clean, linkHash, readHash, stampText, timelineMarks, compareLayers, comparable, trendLayers, CARD_TABS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.WxWorkstation = api;

  const PRO = document.body.dataset.view === 'pro';
  if (!PRO) return;
  const PANEL = new URLSearchParams(location.search).has('panel');
  const MSG = 'wxws';
  const ORIGIN = location.origin === 'null' ? '*' : location.origin;
  /* opened as a file, a frame's origin is "null" and so is nobody else's that matters here */
  const fromHere = (e, win) => e.source === win && (e.origin === location.origin || location.protocol === 'file:') && e.data && e.data[MSG] === 1;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* A shared link: the main map's layers go in the address app.js reads as
     it starts (with the view, if the link carries one); the rest waits for
     the page. This runs before app.js, which is why this file loads first. */
  let linked = null;
  if (!PANEL) {
    linked = readHash(location.hash);
    if (linked) history.replaceState(null, '', location.pathname + location.search + '#' + (linked.view ? `v=${linked.view}&` : '') + (linked.ws.main || ''));
  }
  addEventListener('DOMContentLoaded', () => { if (root.WxPro) { controlSheet(); (PANEL ? panelSide : pageSide)(root.WxPro); } });

  /* ── the map's controls as a sheet the Layers button pulls up ──
     On a phone, and in every panel at any size (2026-10-23: a panel that
     repeated the main map's whole toolbar was mostly toolbar). The button
     says what the map shows. */
  const KIND = { comp: 'Mosaic', abi: 'Satellite', mrms: 'MRMS', model: 'Models', hrrr: 'Future', replay: 'Replay' };
  function layerName(st) {
    const el = document.getElementById('layername');
    if (!el) return;
    const m = st && st.mode, NX = root.Nexrad;
    el.textContent = !m ? 'Layers' : m.startsWith('l3:') && NX && NX.PRODUCTS[m.slice(3)] ? `Radar · ${NX.PRODUCTS[m.slice(3)].short}` : KIND[m] || 'Layers';
  }
  function controlSheet() {
    const ctl = document.getElementById('radarcard'), lb = document.getElementById('layersbtn'), done = document.getElementById('ctldone');
    if (!ctl || !lb) return;
    const sheet = (on) => { ctl.classList.toggle('ctl-open', on); lb.setAttribute('aria-expanded', String(on)); };
    lb.addEventListener('click', () => sheet(!ctl.classList.contains('ctl-open')));
    if (done) done.addEventListener('click', () => { sheet(false); lb.focus(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && ctl.classList.contains('ctl-open') && !document.querySelector('dialog[open]')) sheet(false); });
    if (root.WxPro) root.WxPro.map.on((type, data) => { if (type === 'stamp') layerName(data); });
  }

  /* ── inside a panel: tell the page, and do what it says ── */
  function panelSide(Pro) {
    if (parent === root) return;
    const map = Pro.map;
    const up = (m) => parent.postMessage({ [MSG]: 1, ...m }, ORIGIN);
    /* a time asked for before this map has its frames (a panel just opened
       by Compare or Trend, say) is held and tried again as frames arrive —
       for twenty seconds, or until the visitor steps this map themselves */
    let want = null;
    const tryWant = () => { if (want && (Date.now() - want.at > 20e3 || map.setTime(want.t))) want = null; };
    map.on((type, data) => {
      if (type === 'time') want = null;
      up({ type, data, layer: map.layer });
      if (type === 'stamp' && want) setTimeout(tryWant, 0);
    });
    addEventListener('message', (e) => {
      if (!fromHere(e, parent)) return;
      const m = e.data;
      if (m.type === 'view') map.setView(m.lat, m.lon, m.z);
      /* "now": a forecast goes to the hour nearest now, anything else to its newest frame */
      else if (m.type === 'time') { const t = m.t == null ? (map.stamp.kind === 'forecast' ? Date.now() : null) : m.t; want = map.setTime(t) || t == null ? null : { t, at: Date.now() }; }
      else if (m.type === 'layer') map.setLayer(m.str);
      else if (m.type === 'tz' && Pro.setTZ) Pro.setTZ(m.tz);
      /* in a Compare or Trend: the timeline and colour key are the main map's, shared by all — a side map shows only its map */
      else if (m.type === 'compact') document.body.classList.toggle('compact', !!m.on);
    });
    up({ type: 'ready', data: map.stamp, layer: map.layer });
  }

  /* ── the page: the bus, the panels, the workspaces ── */
  function pageSide(Pro) {
    const $ = (s) => document.querySelector(s);
    const bar = $('#wsbar'), box = $('#panels'), cardsEl = $('#cards');
    if (!bar || !box) return;
    const main = Pro.map;
    /* the map card fills the screen below wherever it starts — the place
       bar, and a storm warning when there is one, decide that — so it is
       measured, not guessed (a guess went stale the day the workspace bar
       was added: the play bar and legend fell off a laptop screen) */
    const card = $('#radarcard');
    const measure = () => { if (card) document.documentElement.style.setProperty('--maptop', Math.round(card.getBoundingClientRect().top + scrollY) + 'px'); };
    measure();
    addEventListener('resize', measure);
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(measure); for (const el of [$('.placebar'), $('.stormband')]) if (el) ro.observe(el); }
    /* the workspace's controls fold behind one button, at every width: a
       menu under it (fixed, so the bar it sits in never clips it); a click
       outside or Esc puts it away */
    const wst = $('#wstoggle');
    const wsOpen = (on) => {
      bar.classList.toggle('open', on); wst.setAttribute('aria-expanded', String(on));
      if (on) { const r = wst.getBoundingClientRect(); bar.style.setProperty('--popx', Math.max(8, Math.min(r.left, innerWidth - bar.offsetWidth - 8)) + 'px'); bar.style.setProperty('--popy', Math.round(r.bottom + 6) + 'px'); }
    };
    if (wst) {
      wst.addEventListener('click', () => wsOpen(!bar.classList.contains('open')));
      document.addEventListener('click', (e) => { if (bar.classList.contains('open') && !bar.contains(e.target) && !wst.contains(e.target) && !e.target.closest('dialog')) wsOpen(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.classList.contains('open') && !document.querySelector('dialog[open]')) { wsOpen(false); wst.focus(); } });
      /* a button that opens a sheet is done with the menu */
      bar.addEventListener('click', (e) => { if (e.target.closest('button[aria-haspopup]')) wsOpen(false); });
      addEventListener('resize', () => { if (bar.classList.contains('open')) wsOpen(true); });
    }
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const W = { name: 'Default', saved: false, panels: [], cards: clean({}).cards, sync: { place: true, time: true }, layout: 'stack', busT: null, mainStamp: null, n: 0, same: null };

    /* the shared time: null is "now" */
    function setBus(t, from) {
      W.busT = t;
      if (from !== main) main.setTime(t == null ? (main.stamp.kind === 'forecast' ? Date.now() : null) : t);
      for (const p of W.panels) if (p !== from) post(p, { type: 'time', t });
      if (from !== Pro.sky) Pro.sky.setTime(t == null ? Date.now() : t);
      stamps();
    }
    const busFrom = (st) => (st.newest && st.kind !== 'forecast' && st.kind !== 'archive' ? null : st.t);
    function shareView(v, from) {
      if (!W.sync.place) return;
      if (from !== main) main.setView(v.lat, v.lon, v.z);
      for (const p of W.panels) if (p !== from) post(p, { type: 'view', lat: v.lat, lon: v.lon, z: v.z });
    }
    main.on((type, data) => {
      if (type === 'stamp') {
        W.mainStamp = data; stamps();
        /* a new place can mean a new time zone: the panels follow it */
        const tz = Pro.tz ? Pro.tz() : null;
        if (tz !== W.tz) { W.tz = tz; for (const p of W.panels) post(p, { type: 'tz', tz }); }
        if (W.mainLayer !== main.layer) { W.mainLayer = main.layer; store.set('wx:wscurrent', current()); renderSel(); }
      }
      else if (type === 'view') shareView(data, main);
      else if (type === 'time' && W.sync.time) setBus(busFrom(data), main);
    });
    Pro.sky.onHour = (ms) => { if (W.sync.time) setBus(ms, Pro.sky); };

    /* ── panels ── */
    const post = (p, m) => { if (p.ready && p.frame.contentWindow) p.frame.contentWindow.postMessage({ [MSG]: 1, ...m }, ORIGIN); };
    function addPanel(str, { quiet } = {}) {
      str = cleanLayer(str);
      if (!str) return null;
      if (W.panels.length >= MAX_PANELS) { say(`Four panels at most — each is a whole map, and a fifth would slow every one of them.`); return null; }
      const n = ++W.n, sec = document.createElement('section');
      sec.className = 'card mpanel';
      sec.innerHTML = `<h2 class="phead"><span class="pn">Map ${W.panels.length + 2}</span><span class="pst" aria-live="polite">starting…</span>
        <button type="button" data-pmain title="Swap this with the main map" aria-label="Swap with the main map"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5h9l-3-3M12 9H3l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" data-px aria-label="Remove this map">×</button></h2>`;
      const frame = document.createElement('iframe');
      frame.title = `Map panel ${n}`;
      const v = main.viewString();
      frame.src = `${location.pathname}?panel=1#v=${v}&${str}`;
      sec.appendChild(frame);
      box.appendChild(sec);
      const p = { n, str, sec, frame, ready: false, stamp: null };
      W.panels.push(p);
      sec.addEventListener('click', (e) => {
        if (e.target.closest('[data-px]')) removePanel(p);
        else if (e.target.closest('[data-pmain]')) swap(p);
      });
      if (!quiet) W.same = null;
      layout();
      if (!quiet) changed();
      return p;
    }
    function removePanel(p) {
      W.panels = W.panels.filter((x) => x !== p);
      if (!W.panels.length) W.same = null;
      p.sec.remove();
      layout(); changed();
    }
    /* the panel's layers onto the main map, and the main map's into the panel */
    async function swap(p) {
      const was = main.layer, to = p.str;
      p.str = was; post(p, { type: 'layer', str: was });
      await main.setLayer(to);
      changed();
    }
    function layout() {
      box.hidden = !W.panels.length;
      const wsEl = document.querySelector('.workspace');
      wsEl.classList.toggle('has-panels', W.panels.length > 0);
      /* side by side: every map in one grid that fills the screen, the cards below */
      wsEl.classList.toggle('ws-grid', W.layout === 'grid' && W.panels.length > 0);
      wsEl.dataset.maps = String(W.panels.length + 1);
      const lb = $('#wslayout');
      if (lb) { lb.hidden = !W.panels.length; lb.textContent = W.layout === 'grid' ? '☰ Stack' : '⊞ Side by side'; lb.setAttribute('aria-pressed', String(W.layout === 'grid')); }
      measure();
      W.panels.forEach((p, i) => { p.sec.querySelector('.pn').textContent = `Map ${i + 2}`; p.frame.title = `Map ${i + 2}: ${p.stamp ? p.stamp.layer : 'starting'}`; });
      box.dataset.n = String(W.panels.length);
      for (const p of W.panels) post(p, { type: 'compact', on: !!W.same });
    }
    addEventListener('message', (e) => {
      const p = W.panels.find((x) => x.frame.contentWindow === e.source);
      if (!p || !fromHere(e, p.frame.contentWindow)) return;
      const m = e.data;
      if (m.layer && cleanLayer(m.layer) && !sameLayer(m.layer, p.str)) { p.str = cleanLayer(m.layer); changed(); }
      if (m.type === 'ready') {
        p.ready = true;
        const v = main.view;
        post(p, { type: 'view', lat: v.lat, lon: v.lon, z: v.z });
        if (W.busT != null) post(p, { type: 'time', t: W.busT });
        /* the page's time zone, so a panel's clock says the same hour as its header */
        post(p, { type: 'tz', tz: Pro.tz ? Pro.tz() : null });
        post(p, { type: 'compact', on: !!W.same });
        p.stamp = m.data; stamps();
      } else if (m.type === 'stamp') { p.stamp = m.data; stamps(); }
      else if (m.type === 'view') shareView(m.data, p);
      else if (m.type === 'time' && W.sync.time) setBus(busFrom(m.data), p);
      else if (m.type === 'pick') {
        const d = m.data || {};
        if (d.what === 'sky') Pro.sky.at(d.lat, d.lon, d.name || 'the tapped point');
        else Pro.choose({ name: d.name || 'Map point', region: '', lat: d.lat, lon: d.lon });
      }
    });

    /* ── headers and the clock ── */
    const fmt = { time: Pro.time, day: Pro.day, ymd: Pro.ymd };
    /* The source in brackets ("(NOAA open data on AWS)") goes in its own span,
       which a phone hides: two clamped lines cut off the observed time, the
       part that matters, while the credit line already names the source
       (audit, 2026-10-27). The text read out stays whole. */
    function stampInto(el, t) {
      /* only a source: "(backup — IEM's is down or late)" is news, and stays */
      const m = /^(.*?)( \((?:NOAA open data on AWS|IEM)\))( · .*)?$/.exec(t);
      if (!m) { el.textContent = t; return; }
      const src = document.createElement('span');
      src.className = 'pstsrc'; src.textContent = m[2];
      el.replaceChildren(m[1], src, m[3] || '');
    }
    function stamps() {
      const ms = $('#mainstamp');
      /* alone, the main map's time is told against the clock: "the shared time" means nothing with no other map to share it */
      /* in a Compare or Trend every map shows one field: it is said once, above
         the maps, and each header leads with what differs — the model, the run,
         the valid time (2026-10-24, after an outside check found four headers
         truncating the same field name and the maps cramped under them) */
      /* a map changed to another field: no longer one comparison — the heading goes, each map gets its own timeline back */
      if (W.same && [W.mainStamp, ...W.panels.map((p) => p.stamp)].some((st) => st && st.layer && Number.isFinite(st.t) && !st.layer.includes(W.same))) { W.same = null; for (const p of W.panels) post(p, { type: 'compact', on: false }); }
      const short = (st) => (W.same && st && st.layer && st.layer.includes(W.same) ? { ...st, layer: st.layer.replace(W.same, '').replace(/\s+/g, ' ').trim() || st.layer } : st);
      /* the main map keeps the field's full name — it is said once, there; the side maps lead with what differs */
      if (ms) { const t = W.mainStamp ? stampText(W.mainStamp, W.panels.length ? W.busT : null, fmt) : ''; if (ms.dataset.t !== t) { ms.dataset.t = t; stampInto(ms, t); } }   // unchanged, untouched: a playing loop is not read out each frame
      for (const p of W.panels) { const el = p.sec.querySelector('.pst'); if (el) el.textContent = stampText(short(p.stamp), W.busT, fmt); }
      const c = $('#wsclock');
      /* said only when it is not "now" (the Now button beside it brings it back) */
      /* …and only when there is another map to share it with: alone, the
         main map's own clock under it already says the time */
      if (c) {
        const time = !W.panels.length ? '' : !W.sync.time ? 'each map keeps its own time' : W.busT == null ? '' : `shared time: ${fmt.ymd(W.busT) !== fmt.ymd(Date.now()) ? fmt.day(W.busT) + ' ' : ''}${fmt.time(W.busT)}`;
        /* in a comparison, short — the field and the time — so the one bar never wraps; the whole sentence is the tooltip */
        const comparing = W.same && W.panels.length;
        c.textContent = comparing ? [W.same, time.replace(/^shared time: /, '')].filter(Boolean).join(' · ') : time;
        c.title = comparing ? `Every map shows ${W.same}${time ? ` — ${time}` : ''}` : time;
        c.hidden = !c.textContent;
      }
      const live = $('#wslive');
      if (live) live.hidden = !W.panels.length || !W.sync.time || W.busT == null;
    }
    $('#wslive').addEventListener('click', () => setBus(null, null));
    for (const [id, k] of [['#wsplace', 'place'], ['#wstime', 'time']]) {
      const el = $(id);
      el.checked = W.sync[k];
      el.addEventListener('change', () => {
        W.sync[k] = el.checked;
        if (k === 'place' && el.checked) shareView(main.view, main);
        if (k === 'time') { if (el.checked) setBus(busFrom(main.stamp), main); stamps(); }
        changed();
      });
    }
    function say(text) {
      const n = $('#wsnote');
      if (!n) return;
      n.textContent = text; n.hidden = !text;
      clearTimeout(say.t); if (text) say.t = setTimeout(() => { n.hidden = true; }, 7000);
    }

    /* ── cards ── */
    function arrangeCards() {
      for (const id of W.cards.order) { const el = document.getElementById(id); if (el && el.parentNode === cardsEl) cardsEl.appendChild(el); }
      for (const id of CARDS) { const el = document.getElementById(id); if (el) el.classList.toggle('ws-off', W.cards.hidden.includes(id)); }
      renderTabs();
    }

    /* ── the drawer's index (UI-REVIEW B4, 2026-10-23): a tab for each card
       on show, in the drawer's own order, that scrolls the drawer to it; the
       tab of the card at the top is lit as the drawer scrolls. A jump, never
       a filter — the alerts above stay where they are. ── */
    const TAB = CARD_TABS;
    const tabsEl = $('#cardtabs');
    const shown = (el) => el && el.parentNode === cardsEl && !el.hidden && !el.classList.contains('ws-off') && el.offsetHeight > 0;
    function renderTabs() {
      if (!tabsEl) return;
      const ids = W.cards.order.filter((id) => TAB[id] && shown(document.getElementById(id)));
      const html = ids.map((id) => `<button type="button" data-tab="${id}"${id === 'alerts' || id === 'nearby' ? ' class="warn"' : ''}>${TAB[id]}</button>`).join('');
      if (tabsEl.dataset.html !== html) { tabsEl.dataset.html = html; tabsEl.innerHTML = html; }
      tabsEl.hidden = ids.length < 3;
      spy();
    }
    function spy() {
      if (!tabsEl || tabsEl.hidden) return;
      const top = cardsEl.scrollTop + tabsEl.offsetHeight + 8;
      let cur = null;
      for (const b of tabsEl.querySelectorAll('[data-tab]')) { const el = document.getElementById(b.dataset.tab); if (el && el.offsetTop <= top) cur = b; }
      for (const b of tabsEl.querySelectorAll('[data-tab]')) b.setAttribute('aria-current', String(b === cur));
      if (cur && cur.scrollIntoView && tabsEl.scrollWidth > tabsEl.clientWidth) tabsEl.scrollLeft = Math.max(0, cur.offsetLeft - 40);
    }
    if (tabsEl) {
      tabsEl.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tab]'), el = b && document.getElementById(b.dataset.tab);
        if (!el) return;
        cardsEl.scrollTo({ top: Math.max(0, el.offsetTop - tabsEl.offsetHeight), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      let raf = 0;
      cardsEl.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(spy); }, { passive: true });
      /* the page shows and hides cards as their data comes and goes */
      new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderTabs); }).observe(cardsEl, { attributes: true, attributeFilter: ['hidden', 'class'], subtree: false, childList: true });
      for (const el of cardsEl.children) if (el.id && TAB[el.id]) new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(renderTabs); }).observe(el, { attributes: true, attributeFilter: ['hidden'] });
    }

    /* ── the sounding, large (UI-REVIEW B4): the card itself moves into a
       panel over the map — forecasters read a skew-T full window, as NSHARP
       and SHARPpy show it — where its own wide layout puts the hodograph
       beside the skew-T; Esc or Back returns it to its place in the drawer.
       It sits under the storm warnings, never over them. ── */
    const skyEl = $('#sky'), skyOut = $('#skyout'), skyPop = $('#skypop');
    function skyLarge(on) {
      if (!skyEl || !skyOut) return;
      if (on === (skyEl.parentNode === skyOut)) return;
      if (on) {
        skyOut.appendChild(skyEl);
        skyOut.hidden = false;
        const d = $('#skyd'); if (d) d.open = true;
        document.body.classList.add('sky-large');
        /* over the map on a narrow screen, the drawer would sit on top of it */
        if (innerWidth < 1200 && document.body.classList.contains('drawer-open') && $('#databtn')) $('#databtn').click();
      } else {
        const next = W.cards.order.slice(W.cards.order.indexOf('sky') + 1).map((id) => document.getElementById(id)).find((el) => el && el.parentNode === cardsEl);
        cardsEl.insertBefore(skyEl, next || null);
        skyOut.hidden = true;
        document.body.classList.remove('sky-large');
      }
      if (skyPop) { skyPop.setAttribute('aria-pressed', String(on)); skyPop.textContent = on ? 'Back' : 'Large'; }
      renderTabs();
      dispatchEvent(new Event('resize'));
      (on ? $('#skyback') : skyPop)?.focus();
    }
    if (skyPop) skyPop.addEventListener('click', () => skyLarge(skyEl.parentNode !== skyOut));
    if ($('#skyback')) $('#skyback').addEventListener('click', () => skyLarge(false));
    /* the page hid the card (no place any more): it goes back with it */
    if (skyEl) new MutationObserver(() => { if (skyEl.hidden && skyEl.parentNode === skyOut) skyLarge(false); }).observe(skyEl, { attributes: true, attributeFilter: ['hidden'] });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && skyEl && skyEl.parentNode === skyOut && !document.querySelector('dialog[open]')) { e.preventDefault(); skyLarge(false); } });

    /* ── the workspace: now, applied, saved ── */
    const current = () => clean({ name: W.name, main: main.layer, panels: W.panels.map((p) => p.str), cards: W.cards, sync: W.sync, layout: W.layout });
    const savedList = () => (store.get('wx:workspaces', []) || []).map(clean).filter(Boolean);
    function changed() {
      store.set('wx:wscurrent', current());
      renderSel();
    }
    /* not judged until the page has put its layout back: a restore half done
       showed "· changed" for a moment on every load (2026-10-23) */
    const dirty = () => W.ready && (!W.ref || !sameWorkspace(current(), W.ref));
    async function apply(ws, { mainToo = true } = {}) {
      ws = clean(ws);
      if (!ws) return;
      W.name = ws.name; store.set('wx:wsname', ws.name);
      for (const p of W.panels.slice()) { p.sec.remove(); }
      W.panels = []; W.same = null;
      W.cards = ws.cards; arrangeCards();
      W.sync = ws.sync; $('#wsplace').checked = ws.sync.place; $('#wstime').checked = ws.sync.time; W.layout = ws.layout;
      if (mainToo) await main.setLayer(completeLayer(ws.main));
      for (const s of ws.panels) addPanel(s, { quiet: true });
      layout(); stamps();
      W.ref = clean({ ...ws, main: ws.main || null });
      store.set('wx:wscurrent', current());
      renderSel();
      if (PRESET_NOTES[ws.name] && PRESETS.some((p) => p.name === ws.name)) say(PRESET_NOTES[ws.name]);
    }
    function renderSel() {
      const sel = $('#wssel'), saved = savedList();
      const d = dirty();
      const nm = $('#wsname');
      if (nm) nm.textContent = W.name + (d ? '*' : '');
      /* what the open preset has and lacks, under the menu */
      const pn = $('#wspresetnote');
      if (pn) { const t = PRESETS.some((p) => p.name === W.name) ? PRESET_NOTES[W.name] || '' : ''; pn.textContent = t; pn.hidden = !t; }
      const opt = (n, g) => `<option value="${g}:${esc(n)}"${n === W.name ? ' selected' : ''}${g === 'p' && PRESET_NOTES[n] ? ` title="${esc(PRESET_NOTES[n])}"` : ''}>${esc(n)}${n === W.name && d ? ' · changed' : ''}</option>`;
      /* a preset sets the whole map (completeLayer): the group says so */
      sel.innerHTML = `<optgroup label="Presets — each sets the whole map">${PRESETS.map((p) => opt(p.name, 'p')).join('')}</optgroup>`
        + (saved.length ? `<optgroup label="Saved in this browser">${saved.map((s) => opt(s.name, 's')).join('')}</optgroup>` : '')
        + (![...PRESETS, ...saved].some((x) => x.name === W.name) ? `<optgroup label="Open">${opt(W.name, 'o')}</optgroup>` : '');
    }
    $('#wssel').addEventListener('change', (e) => {
      const [g, ...rest] = e.target.value.split(':'), n = rest.join(':');
      const ws = g === 'p' ? PRESETS.find((p) => p.name === n) : g === 's' ? savedList().find((s) => s.name === n) : null;
      if (ws) { apply(ws); store.set('wx:wsname', ws.name); }
    });

    /* ── one under another, or side by side ── */
    if ($('#wslayout')) $('#wslayout').addEventListener('click', () => { W.layout = W.layout === 'grid' ? 'stack' : 'grid'; layout(); changed(); });

    /* ── add a map ── */
    $('#wsadd').addEventListener('click', () => {
      /* a new panel opens on what the main map shows, ready to be changed */
      const p = addPanel(main.layer);
      if (p) p.sec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    });

    /* ── Compare and Trend: the maps beside the main one become the other
       models, or the earlier runs, at the main map's moment. They replace
       the maps already open; the shared time is pinned to the main map's
       valid hour first, so each new map opens on it. ── */
    function lineUp(kind) {
      const MM = root.ModelMaps, M = modelOf(main.layer);
      const left = [];
      const same = (s, f) => { const F = MM && MM.field(s, f); if (!F) return false; if (!comparable(MM, M.src, M.field, s)) { if (GLOBAL.includes(s) === GLOBAL.includes(M.src)) left.push(`${MM.SOURCES[s].label} (its map is “${F.label}”)`); return false; } return true; };
      const list = kind === 'compare' ? compareLayers(main.layer, same) : trendLayers(main.layer);
      if (!list) { say('Compare and Trend work on a model map: HRRR, NAM 3 km, RAP, GFS, ECMWF, AIFS or UKMET.'); return; }
      if (!list.length) { say(`No other model shows this the same way${left.length ? ' — ' + left.join(', ') : ''}. Try one the models share, like 2 m temperature or precipitable water.`); return; }
      for (const p of W.panels.slice()) { W.panels = W.panels.filter((x) => x !== p); p.sec.remove(); }
      if (!W.sync.time) { W.sync.time = true; const el = $('#wstime'); if (el) el.checked = true; }
      if (!W.sync.place) { W.sync.place = true; const el = $('#wsplace'); if (el) el.checked = true; }
      /* the global models do not all have every hour (the AIFS steps every 6,
         ECMWF and the UKMET every 6 late in their runs): a comparison of
         globals is set on the nearest 00, 06, 12 or 18Z, which all of them have */
      let t = busFrom(main.stamp);
      const globals = kind === 'compare' && M && GLOBAL.includes(M.src);
      if (globals && t != null) { const six = 6 * 3600e3, snap = Math.round(t / six) * six; if (snap !== t) { t = snap; setBus(t, null); } else setBus(t, main); }
      else setBus(t, main);
      for (const str of list) addPanel(str, { quiet: true });
      /* the maps are the point: side by side, the readouts drawer out of their way */
      W.layout = 'grid';
      const F = M && MM ? MM.field(M.src, M.field) : null;
      W.same = F ? F.label.replace(/ \(.*\)$/, '') : null;
      const drawer = document.body.classList.contains('drawer-open') && $('#databtn');
      if (drawer) $('#databtn').click();
      layout(); changed(); stamps();
      if (drawer) setTimeout(() => say('The readouts are closed to give the maps room — D, or Readouts, brings them back.'), 7200);
      say(kind === 'compare' ? `Comparing ${list.length + 1} models at the same moment${globals ? ', on a 6-hourly time all of them have' : ''} — step any map and the rest follow.${left.length ? ` Left out, as they show something else: ${left.join(', ')}.` : ''}` : 'This run and the three before it, at the same moment — how the forecast has moved.');
    }
    for (const [id, kind] of [['#mmcompare', 'compare'], ['#mmtrend', 'trend']]) { const b = $(id); if (b) b.addEventListener('click', () => lineUp(kind)); }

    /* ── share ── */
    $('#wsshare').addEventListener('click', () => openSheet('#wsshareit'));
    $('#wsmakelink').addEventListener('click', () => {
      const withView = $('#wsincview').checked, withTime = $('#wsinctime').checked && W.busT != null;
      const url = `${location.origin}${location.pathname}#${linkHash(current(), { view: withView ? main.viewString() : null, at: withTime ? W.busT : null })}`;
      const out = $('#wslinkout');
      out.value = url; out.hidden = false; out.select();
      const done = () => { $('#wslinkmsg').textContent = withView ? 'Copied. It opens this layout, looking where your main map looks.' : 'Copied. It opens this layout — no place is in it.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { $('#wslinkmsg').textContent = 'Copy the link above.'; });
      else $('#wslinkmsg').textContent = 'Copy the link above.';
    });

    /* ── save, rename, duplicate, delete ── */
    $('#wssave').addEventListener('click', () => { $('#wsnamein').value = PRESETS.some((p) => p.name === W.name) ? `${W.name} (mine)` : W.name; renderSaved(); openSheet('#wssheet'); });
    function putSaved(ws) {
      const list = savedList().filter((s) => s.name !== ws.name);
      list.push(ws); store.set('wx:workspaces', list.slice(-20));
    }
    function renderSaved() {
      const list = savedList(), ul = $('#wssavedlist');
      ul.innerHTML = list.length ? list.map((s) => `<li><span>${esc(s.name)}<small>${s.panels.length + 1} map${s.panels.length ? 's' : ''}</small></span>
        <button type="button" data-wsopen="${esc(s.name)}">Open</button><button type="button" data-wsdup="${esc(s.name)}">Duplicate</button><button type="button" data-wsdel="${esc(s.name)}" aria-label="Delete ${esc(s.name)}">Delete</button></li>`).join('')
        : '<li class="none">Nothing saved yet. Workspaces are kept in this browser only.</li>';
    }
    $('#wssaveform').addEventListener('submit', (e) => {
      e.preventDefault();
      let n = cleanName($('#wsnamein').value);
      if (!n) return;
      if (PRESETS.some((p) => p.name === n)) n += ' (mine)';
      const was = W.name;
      W.name = n; putSaved(current());
      /* renaming a saved one: the old name goes */
      if ($('#wsrename').checked && was !== n && savedList().some((s) => s.name === was)) store.set('wx:workspaces', savedList().filter((s) => s.name !== was));
      W.ref = current(); store.set('wx:wsname', n); store.set('wx:wscurrent', current());
      renderSel(); renderSaved(); say(`Saved “${n}” in this browser.`);
    });
    $('#wssavedlist').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const list = savedList();
      if (b.dataset.wsopen) { const ws = list.find((s) => s.name === b.dataset.wsopen); if (ws) { apply(ws); closeSheet('#wssheet'); } }
      else if (b.dataset.wsdup) {
        const ws = list.find((s) => s.name === b.dataset.wsdup);
        if (!ws) return;
        let n = `${ws.name} copy`, k = 2;
        while (list.some((s) => s.name === n)) n = `${ws.name} copy ${k++}`;
        putSaved({ ...ws, name: cleanName(n) }); renderSaved(); renderSel();
      } else if (b.dataset.wsdel) { store.set('wx:workspaces', list.filter((s) => s.name !== b.dataset.wsdel)); renderSaved(); renderSel(); }
    });

    /* ── arrange: the cards, and the maps ── */
    $('#wsarrange').addEventListener('click', () => { renderArrange(); openSheet('#wsarrangeit'); });
    function renderArrange() {
      $('#wscardlist').innerHTML = W.cards.order.map((id, i) => `<li><label><input type="checkbox" data-card="${id}"${W.cards.hidden.includes(id) ? '' : ' checked'}${LOCKED.includes(id) ? ' disabled' : ''}> ${esc(CARD_NAMES[id])}${LOCKED.includes(id) ? ' <small>always shown</small>' : ''}</label>
        <button type="button" data-up="${id}" aria-label="Move ${esc(CARD_NAMES[id])} up"${i ? '' : ' disabled'}>↑</button><button type="button" data-down="${id}" aria-label="Move ${esc(CARD_NAMES[id])} down"${i < W.cards.order.length - 1 ? '' : ' disabled'}>↓</button></li>`).join('');
      $('#wsmaplist').innerHTML = W.panels.length ? W.panels.map((p, i) => `<li><span>Map ${i + 2}<small>${esc(p.stamp ? p.stamp.layer : 'starting')}</small></span>
        <button type="button" data-pup="${i}" aria-label="Move map ${i + 2} up"${i ? '' : ' disabled'}>↑</button><button type="button" data-pdown="${i}" aria-label="Move map ${i + 2} down"${i < W.panels.length - 1 ? '' : ' disabled'}>↓</button><button type="button" data-prm="${i}" aria-label="Remove map ${i + 2}">×</button></li>`).join('')
        : '<li class="none">Only the main map. “+ Map” or Explore adds one beside it.</li>';
    }
    $('#wsarrangeit').addEventListener('change', (e) => {
      const id = e.target.dataset && e.target.dataset.card;
      if (!id || LOCKED.includes(id)) return;
      W.cards.hidden = e.target.checked ? W.cards.hidden.filter((x) => x !== id) : [...W.cards.hidden, id];
      arrangeCards(); changed();
    });
    $('#wsarrangeit').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const o = W.cards.order, mv = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
      if (b.dataset.up) mv(o, o.indexOf(b.dataset.up), -1);
      else if (b.dataset.down) mv(o, o.indexOf(b.dataset.down), 1);
      else if (b.dataset.pup || b.dataset.pdown) { const i = Number(b.dataset.pup || b.dataset.pdown); mv(W.panels, i, b.dataset.pup ? -1 : 1); for (const p of W.panels) box.appendChild(p.sec); layout(); }
      else if (b.dataset.prm) { const p = W.panels[Number(b.dataset.prm)]; if (p) removePanel(p); }
      else return;
      arrangeCards(); changed(); renderArrange();
    });

    /* ── Explore: every tool, by what it measures ── */
    $('#wsexplore').addEventListener('click', () => { renderExplore(); openSheet('#wsexploreit'); });
    function renderExplore() {
      const MM = root.ModelMaps, MR = root.Mrms, AB = root.Abi, NX = root.Nexrad;
      const row = (label, str, note) => `<li><span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><button type="button" data-xmain="${esc(str)}">Main map</button><button type="button" data-xpanel="${esc(str)}">New map</button></li>`;
      const pick = (label, id, opts, note) => `<li><span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}<select id="${id}" aria-label="${esc(label)}">${opts}</select></span><button type="button" data-xmain="@${id}">Main map</button><button type="button" data-xpanel="@${id}">New map</button></li>`;
      const act = (label, what, note) => `<li><span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><button type="button" data-xact="${what}">Show</button></li>`;
      const site = NX ? Object.entries(NX.PRODUCTS).map(([k, P]) => row(`${P.label} — the nearest radar`, `l=l3:${k}&o=w`, P.long.split(' — ')[0])) : [];
      const groups = [
        ['Radar', [row('US mosaic', 'l=comp&o=w', 'every NEXRAD at once, base reflectivity'), ...site,
          MR ? pick('MRMS — many radars together', 'xmrms', Object.entries(MR.PRODUCTS).map(([k, P]) => `<option value="l=mrms&o=w&r=${k}">${esc(P.label)}</option>`).join(''), 'rotation tracks, hail size, rain rates') : '']],
        ['Satellite', [AB ? pick('GOES imagery', 'xabi', Object.entries(AB.PRODUCTS).map(([k, P]) => `<option value="l=abi&o=&g=${k}.conus.auto">${esc(P.label)}</option>`).join(''), 'all 16 bands and the RGB composites') : '',
          act('Satellite under the main map', 'sat', 'infrared, visible or water vapour, beneath the radar')]],
        ['Models', [MM ? pick('A model field', 'xmodel', Object.entries(MM.SOURCES).map(([k, S]) => `<optgroup label="${esc(S.label)}">${MM.FIELDS[k].map((f) => `<option value="l=model&o=w&m=${k}.${f.id}">${esc(S.label)} · ${esc(f.label)}</option>`).join('')}</optgroup>`).join(''), 'HRRR, NAM, RAP, GFS, ECMWF, ensembles, the Blend') : '',
          row('Future radar · HRRR', 'l=hrrr&o=w', 'the next 18 hours, drawn like radar'), act('Compare the models at your place', 'card:models')]],
        ['Soundings', [act('The air above you', 'card:sky', 'Skew-T, hodograph, the storm ingredients'), act('A cross-section on the main map', 'xsec', 'tap two points'), act('Weather balloons', 'card:sky', 'the sounding card has the nearest launch')]],
        ['Observations', [act('Stations on the main map', 'ov:stations', 'airports, road, farm and gauge networks'), act('Storm reports', 'ov:reports'), act('Storm cells', 'ov:cells'), act('Fronts', 'ov:fronts'), act('Watches and discussions', 'ov:watches'), act('SPC mesoanalysis', 'card:meso')]],
        ['Lightning', [act('Lightning on the main map', 'ov:lightning', 'every flash, GOES-East and -West'), act('Flash density', 'ov:density')]],
        ['Tropics', [act('Hurricanes and tropical storms', 'ov:tropics', 'NHC: cones, tracks, coastal watches and warnings, the 7-day outlook')]],
        ['The ground', [act('Terrain under the map', 'ov:terrain', "shaded relief, and the ground's height under the pointer")]],
        ['Forecasts', [act('Now and the forecast', 'card:hero'), act('The forecast discussion', 'card:afd'), MM ? row('National Blend chances', 'l=model&o=w&m=nbm.p_rain6', 'rain, thunder, snow, ice, fog') : '', MM ? row('Storm chances · HRRR-TLE', 'l=model&o=w&m=tle.p_uh') : '', act('SPC outlook on the main map', 'outlook')]],
        ['Your way and your place', [act('Route weather', 'route', 'the forecast at each point of a drawn or opened route, when you are there'), act('Watches', 'watches', 'rain, gusts, cold, heat, warnings or lightning at your place, while the page is open'), act('Add a file to the map', 'files', 'GPX, KML, GeoJSON or a GRLevelX placefile — kept in this browser'), act('Save a picture or a video', 'save'), act('Colour tables', 'colours', 'your own colours for any product or field, or a GR .pal file'), act('Satellite recipe', 'recipe', 'an RGB of your own from GOES\'s 16 bands')]],
        ['Historical', [act('Replay any day since 2006', 'replay', 'radar, warnings, the sky and stations as they were'), act('How accurate the forecast has been here', 'card:record'), MM ? row('Mesoanalysis, the last six hours', 'l=model&o=w&m=smeso.stpe') : '']]
      ];
      $('#wsexplorelist').innerHTML = groups.map(([g, items]) => `<section><h3>${esc(g)}</h3><ul>${items.filter(Boolean).join('')}</ul></section>`).join('');
    }
    $('#wsexplorelist').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const val = (s) => (s && s[0] === '@' ? ($('#' + s.slice(1)) || {}).value : s);
      if (b.dataset.xmain) { closeSheet('#wsexploreit'); await toMain(val(b.dataset.xmain)); }
      else if (b.dataset.xpanel) { closeSheet('#wsexploreit'); toPanel(val(b.dataset.xpanel)); }
      else if (b.dataset.xact) { closeSheet('#wsexploreit'); doAct(b.dataset.xact); }
    });
    async function toMain(str) { await main.setLayer(str); changed(); $('#radarcard').scrollIntoView({ block: 'nearest' }); }
    function toPanel(str) { const p = addPanel(str); if (p) p.sec.scrollIntoView({ block: 'nearest' }); }
    /* `toggle`: from Find an overlay is switched either way; from Explore only on */
    function doAct(a, { toggle = false } = {}) {
        if (a.startsWith('card:')) {
          const id = a.slice(5), el = document.getElementById(id);
          if (root.WxOpenDrawer) root.WxOpenDrawer();
          if (W.cards.hidden.includes(id)) { W.cards.hidden = W.cards.hidden.filter((x) => x !== id); arrangeCards(); changed(); }
          if (el) { if (el.hidden) say('That card has nothing to show yet — choose a place first.'); const d = el.querySelector('details'); if (d) d.open = true; el.scrollIntoView({ block: 'start' }); }
        } else if (a.startsWith('ov:')) {
          const k = a.slice(3), btn = k === 'stations' ? $('#stationtoggle') : $(`[data-ov="${k}"]`);
          if (btn && (toggle || btn.getAttribute('aria-pressed') !== 'true')) btn.click();
          $('#radarcard').scrollIntoView({ block: 'nearest' });
        } else if (a.startsWith('outlook:')) {
          const sel = $('#outlooksel');
          if (sel) { sel.value = a.slice(8); sel.dispatchEvent(new Event('change')); }
          $('#radarcard').scrollIntoView({ block: 'nearest' });
        } else if (a === 'outlook') { const btn = $('#outlooktoggle'); if (toggle || btn.getAttribute('aria-pressed') !== 'true') btn.click(); }
        else if (a === 'xsec') { $('#zxsec').click(); $('#radarcard').scrollIntoView({ block: 'nearest' }); }
        /* the tools of 2026-10-24: each is a button the page already has */
        else if (a === 'route') { if ($('#zroute').getAttribute('aria-pressed') !== 'true') $('#zroute').click(); }
        else if (a === 'watches') $('#watchbtn').click();
        else if (a === 'files') { if ($('#ovpanel') && $('#ovpanel').hidden) $('#ovbtn').click(); $('#filesadd').click(); }
        else if (a === 'save') $('#zsave').click();
        else if (a === 'colours') $('#cmapedit').click();
        else if (a === 'recipe') { if (!document.querySelector('[data-mode="abi"][aria-pressed="true"]')) document.querySelector('[data-mode="abi"]').click(); $('#abibuild').click(); }
        else if (a === 'checked') { const d = $('#checkit'); if (d && d.showModal) d.showModal(); }
        else if (a === 'vwp') { if ($('#vwpbtn') && !$('#vwpbtn').hidden) $('#vwpbtn').click(); else say('The wind profile is a single radar\'s: choose Radar first.'); }
        else if (a === 'replay') { const t = $('#replaytoggle'); if (t.getAttribute('aria-expanded') !== 'true') t.click(); $('#radarcard').scrollIntoView({ block: 'nearest' }); }
        else if (a === 'sat') { if ($('#ovpanel') && $('#ovpanel').hidden) $('#ovbtn').click(); $('#satsel').focus(); $('#radarcard').scrollIntoView({ block: 'nearest' }); }
        else if (a.startsWith('ws:')) { const b = $('#ws' + a.slice(3)); if (b) b.click(); }
    }

    /* ── Find (Ctrl+K or /): every layer, model field, overlay, card and tool
       by name, from the same product lists Explore reads — a product added to
       nexrad.js, mrms.js, abi.js or modelmaps.js is findable without editing
       this. Enter: on the main map; Shift+Enter: a new map beside it. ── */
    let findItems = null, findHits = [], findAt = 0;
    function findIndex() {
      const MM = root.ModelMaps, MR = root.Mrms, AB = root.Abi, NX = root.Nexrad, out = [];
      const L = (label, group, str, words = '') => out.push({ label, group, str, hay: `${label} ${group} ${words}`.toLowerCase() });
      const A = (label, group, act, words = '') => out.push({ label, group, act, hay: `${label} ${group} ${words}`.toLowerCase() });
      L('US mosaic', 'Radar', 'l=comp&o=w', 'nexrad reflectivity national composite');
      L('Future radar · HRRR', 'Forecast', 'l=hrrr&o=w', 'simulated reflectivity');
      if (NX) for (const [k, P] of Object.entries(NX.PRODUCTS)) L(`${P.label} (${P.short})`, 'Radar · single site', `l=l3:${k}&o=w`, P.long);
      if (MR) for (const [k, P] of Object.entries(MR.PRODUCTS)) L(P.label, 'MRMS', `l=mrms&o=w&r=${k}`, 'mrms ' + k);
      if (AB) for (const [k, P] of Object.entries(AB.PRODUCTS)) L(P.label, 'Satellite · GOES', `l=abi&o=&g=${k}.conus.auto`, P.group + ' goes abi ' + k);
      if (MM) for (const [k, S] of Object.entries(MM.SOURCES)) for (const f of MM.FIELDS[k]) L(`${S.label} · ${f.label}`, `Models · ${f.group}`, `l=model&o=w&m=${k}.${f.id}`, `${k} ${f.id}`);
      for (const [k, n, w] of [['lines', 'Map lines', 'states counties towns borders'], ['watches', 'Watches and discussions', 'spc tornado severe mcd mpd wpc'], ['cells', 'Storm cells', 'scit hail meso tvs tracks'],
        ['lightning', 'Lightning', 'glm flashes'], ['density', 'Flash density', 'lightning glm'], ['reports', 'Storm reports', 'lsr tornado hail wind'], ['fronts', 'Fronts', 'wpc surface analysis highs lows'],
        ['stations', 'Stations', 'metar asos rwis mesonet observations obs'], ['rings', 'Range rings', 'distance circles radar'],
        ['tropics', 'Tropics', 'hurricane tropical storm nhc cone track watches warnings outlook cyclone'],
        ['terrain', 'Terrain', 'elevation height relief hillshade mountains ground topography 3dep srtm']]) A(n, 'Overlay — on or off', 'ov:' + k, w);
      for (const [k, o] of Object.entries((root.Wx && root.Wx.OUTLOOKS) || {})) A(`SPC outlook · ${o.label}`, 'Outlook', 'outlook:' + k, 'spc convective severe risk tornado wind hail probability');
      A('SPC outlook', 'Overlay — on or off', 'outlook', 'convective risk day 1');
      A('Satellite under the map', 'Overlay', 'sat', 'infrared visible water vapour underlay');
      for (const [id, words] of [['hero', 'now forecast current conditions'], ['sky', 'sounding skew-t hodograph balloon raob parcel'], ['afd', 'area forecast discussion office'], ['meso', 'spc mesoanalysis images'],
        ['models', 'compare models ensemble plumes'], ['record', 'accuracy verification scoreboard'], ['sources', 'feeds data where from']]) A(CARD_NAMES[id], 'Card', 'card:' + id, words);
      A('Replay any day since 2006', 'Tool', 'replay', 'history archive past storm');
      A('Cross-section on the main map', 'Tool', 'xsec', 'cross section vertical radar volume');
      A('Route weather — the forecast along a way', 'Tool', 'route', 'trip drive ride hike run sail fly gpx track path headwind');
      A('Watches — rain, wind, cold, warnings, lightning at your place', 'Tool', 'watches', 'alert notify notification threshold remind');
      A('Add a file to the map (GPX, KML, GeoJSON, placefile)', 'Tool', 'files', 'import upload layer track boundary placefile');
      A('Wind profile (VWP) from the radar', 'Tool', 'vwp', 'vad velocity azimuth display winds aloft radar');
      A('Save a picture of the map, or the loop as a video', 'Tool', 'save', 'export download png webm screenshot gif');
      A('Satellite recipe — an RGB of your own from the 16 bands', 'Tool', 'recipe', 'rgb composite goes abi band channel custom recipe builder');
      A('Colour tables — your own, or a GR .pal file', 'Tool', 'colours', 'color colour palette pal table scheme custom gr2analyst grlevelx radarscope');
      if (MM && MM.SOURCES.era5) L('ERA5 reanalysis — the weather of any hour since 1940', 'Models · History', 'l=model&o=w&m=era5.mslp', 'reanalysis history historic past archive climate 1940 era5 ecmwf');
      A('How this page is checked, and what it cannot do', 'About', 'checked', 'reliability accuracy verification tests limits trust');
      A('Explore every tool', 'Workspace', 'ws:explore', 'browse');
      A('Add a map beside the main one', 'Workspace', 'ws:add', 'panel new map');
      A('Save the workspace', 'Workspace', 'ws:save', 'layout');
      A('Share the workspace', 'Workspace', 'ws:share', 'link');
      return out;
    }
    /* the last few picks, by name only (a product, never a place), so an empty
       Find opens on what this visitor reaches for — then everything in the
       index's own order, radar to tools. Sorted by name length, as it was,
       an empty Find read as a random list. */
    const FIND_RECENT = 'wx:findrecent';
    function findRun(it, panel) {
      store.set(FIND_RECENT, [it.label, ...store.get(FIND_RECENT, []).filter((l) => l !== it.label)].slice(0, 5));
      closeSheet('#findit');
      if (it.str) return panel ? toPanel(it.str) : toMain(it.str);
      doAct(it.act, { toggle: true });
    }
    function findShow() {
      const q = $('#findq').value.toLowerCase().trim(), toks = q.split(/\s+/).filter(Boolean);
      findItems = findItems || findIndex();
      if (toks.length) findHits = findItems.filter((it) => toks.every((t) => it.hay.includes(t)))
        .map((it) => ({ it, w: toks.reduce((n, t) => n + (it.label.toLowerCase().startsWith(t) ? 3 : new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(it.label.toLowerCase()) ? 2 : it.label.toLowerCase().includes(t) ? 1 : 0), 0) - it.label.length / 200 }))
        .sort((a, b) => b.w - a.w).slice(0, 40).map((x) => x.it);
      else {
        const recent = store.get(FIND_RECENT, []).map((l) => findItems.find((it) => it.label === l)).filter(Boolean);
        findHits = [...recent.map((it) => ({ ...it, group: 'Recent · ' + it.group })), ...findItems.filter((it) => !recent.includes(it) && (!it.str || !/^Models/.test(it.group)))].slice(0, 40);
      }
      findAt = Math.min(findAt, Math.max(0, findHits.length - 1));
      $('#findlist').innerHTML = findHits.length ? findHits.map((it, i) => `<li role="option" id="find${i}" data-i="${i}" aria-selected="${i === findAt}"><span>${esc(it.label)}<small>${esc(it.group)}</small></span>${it.str ? '<em>⇧↵ new map</em>' : ''}</li>`).join('')
        : '<li class="none">Nothing by that name. Try a product (srv, mesh), a field (cape, helicity), or a card (sounding).</li>';
      $('#findq').setAttribute('aria-activedescendant', findHits.length ? 'find' + findAt : '');
      const on = $('#find' + findAt);
      if (on) on.scrollIntoView({ block: 'nearest' });
    }
    function findOpen() {
      if ($('#findit').open) return;
      $('#findq').value = ''; findAt = 0; findShow(); openSheet('#findit');
      setTimeout(() => $('#findq').focus(), 20);
    }
    $('#findbtn').addEventListener('click', findOpen);
    $('#findq').addEventListener('input', () => { findAt = 0; findShow(); });
    $('#findq').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); findAt = (findAt + (e.key === 'ArrowDown' ? 1 : -1) + findHits.length) % Math.max(1, findHits.length); findShow(); }
      else if (e.key === 'Enter' && findHits[findAt]) { e.preventDefault(); findRun(findHits[findAt], e.shiftKey); }
    });
    $('#findlist').addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) findRun(findHits[Number(li.dataset.i)], e.shiftKey); });
    addEventListener('keydown', (e) => {
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); findOpen(); }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('dialog[open]')) { e.preventDefault(); findOpen(); }
    });


    /* ── the readout cards fold to their heading (a tap on it); the sources
       card starts folded on Pro. Warnings never fold. Kept in this browser. ── */
    let mins = store.get('wx:cardmin', null);
    if (!Array.isArray(mins)) mins = ['sources'];
    function markCards() {
      for (const id of CARDS) {
        if (LOCKED.includes(id)) continue;
        const el = document.getElementById(id), h = el && el.firstElementChild;
        if (!h || h.tagName !== 'H2') continue;
        const min = mins.includes(id);
        if (el.classList.contains('ws-min') !== min) el.classList.toggle('ws-min', min);
        if (!h.dataset.min) { h.dataset.min = '1'; h.tabIndex = 0; h.setAttribute('role', 'button'); }
        if (h.getAttribute('aria-expanded') !== String(!min)) h.setAttribute('aria-expanded', String(!min));
      }
    }
    const foldCard = (id) => { mins = mins.includes(id) ? mins.filter((x) => x !== id) : [...mins, id]; store.set('wx:cardmin', mins); markCards(); };
    markCards();
    if (typeof MutationObserver === 'function') new MutationObserver(markCards).observe(cardsEl, { childList: true, subtree: true });
    cardsEl.addEventListener('click', (e) => { const h = e.target.closest('h2[data-min]'); if (h && !e.target.closest('a,button,select,input,label')) foldCard(h.parentElement.id); });
    cardsEl.addEventListener('keydown', (e) => { const h = e.target.closest && e.target.closest('h2[data-min]'); if (h && e.target === h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); foldCard(h.parentElement.id); } });

    /* ── sheets ── */
    function openSheet(id) { const d = $(id); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    function closeSheet(id) { const d = $(id); if (d.close) d.close(); else d.removeAttribute('open'); }
    for (const d of document.querySelectorAll('dialog.wssheet')) {
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) closeSheet('#' + d.id); });
    }

    /* ── start: a shared link, else this browser's last layout ── */
    if (linked) {
      apply(linked.ws, { mainToo: false }).then(() => {
        W.ready = true; renderSel();
        if (linked.at) setTimeout(() => setBus(linked.at, null), 1500);
        say(`Opened a shared workspace, “${linked.ws.name}”. Save it to keep it in this browser.`);
      });
    } else {
      /* the main map keeps a link's layers (#l=…) if it was opened with one */
      const last = clean(store.get('wx:wscurrent', null)), own = !location.hash || location.hash === '#';
      /* "changed" is measured against the workspace this one was opened as */
      const named = () => { const n = store.get('wx:wsname', null); return [...PRESETS, ...savedList()].find((x) => x.name === n) || null; };
      if (last && (last.panels.length || last.cards.hidden.length || last.cards.order.join() !== CARDS.join() || (own && last.main))) {
        apply(last, { mainToo: own }).then(() => { const ref = named(); W.name = ref ? ref.name : last.name; W.ref = ref || last; W.ready = true; renderSel(); });
      } else { W.ref = PRESETS[0]; W.ready = true; renderSel(); }
    }
    stamps();
  }
})(typeof window !== 'undefined' ? window : globalThis);
