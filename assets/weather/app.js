/* WEATHER APP — the page code for both of the weather room's pages:
   Weather (weather.html, what most people want) and Weather Pro
   (weather-pro.html, the map and the atmosphere in depth). Each page holds
   only its own cards; everything here draws what is on the page and skips
   what is not. body[data-view] is "simple" or "pro". */
(() => {
  "use strict";
  const Wx = window.Wx, Snd = window.Sounding, Draw = window.WxDraw;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* which of the two pages this is: "simple" (Weather) or "pro" (Weather Pro) */
  const PRO = document.body.dataset.view === "pro";
  /* one map panel of Weather Pro's workstation (workstation.js): the same
     page in a frame, only its map, its choices never written over the main
     page's (the parent keeps the layout) */
  const PANEL = PRO && new URLSearchParams(location.search).has("panel");
  /* the workstation's shared helpers (the timeline's labels); Pro loads workstation.js first, Weather never */
  const WS = PRO ? window.WxWorkstation || null : null;
  if (PANEL) document.body.dataset.panel = "1";
  /* each page's own title, which a storm warning takes over and gives back */
  const TITLE = document.title;

  /* ── this browser's own memory (never sent anywhere) ── */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { if (PANEL) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { if (PANEL) return; try { localStorage.removeItem(k); } catch (e) {} }
  };
  const cleanPlace = (p) => p && Wx.validLat(+p.lat) && Wx.validLon(+p.lon)
    ? { name: String(p.name || "A place").slice(0, 80), region: String(p.region || "").slice(0, 80), lat: Wx.round2(p.lat), lon: Wx.round2(p.lon), here: !!p.here, approx: !!p.approx }
    : null;

  /* The one state the whole page reads (DESIGN.md §6): a place — or none,
     which is the whole country — and a time. */
  const S = {
    place: cleanPlace(store.get("wx:place", null)),
    saved: (store.get("wx:saved", []) || []).map(cleanPlace).filter(Boolean).slice(0, 12),
    /* Pro keeps its own choice (wx:prounits), starting on its own set — kt, °C, hPa;
       Weather's °F / °C (wx:units) is never touched by it */
    units: PRO ? (["pro", "us", "metric"].includes(store.get("wx:prounits", "")) ? store.get("wx:prounits", "") : "pro") : store.get("wx:units", "us") === "metric" ? "metric" : "us",
    fc: null, fcStale: false, pt: undefined, obs: undefined, office: undefined, alerts: undefined,
    state: undefined, national: undefined, outlook: undefined, ens: undefined, rec: undefined, verdict: null, fcShown: null,
    err: {}, checked: {}, selected: null, ctl: null, loadedAt: 0, fastAt: 0, focusedStorm: null
  };
  const placeKey = (p) => `${Wx.coord(p.lat)},${Wx.coord(p.lon)}`;
  const U = () => S.units;
  const deg = (c) => Wx.fmt.temp(c, U()) + "°";
  /* Pro speaks UTC on request (2026-10-23, Ric: "do all 11" of a pass on what
     pros need): forecasters work in Z, as NWS products, runs and scans do.
     Kept in this browser; a panel follows the page through the storage event. */
  let UTC = PRO && store.get("wx:utc", false) === true;
  /* a panel has no place of its own: it tells time in the page's zone, sent down by the workstation (PANEL_TZ) */
  let PANEL_TZ = null;
  const tzNow = () => PANEL_TZ || (S.fc && S.fc.tz) || (S.pt && S.pt.tz) || undefined;
  const clk = () => UTC ? Wx.clock("UTC", true) : Wx.clock(tzNow());
  const nowSec = () => Math.floor(Date.now() / 1000);
  const dayFmtPage = (ms) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ms);
  const dist = (km) => U() !== "metric" ? `${Math.max(1, Math.round(km / 1.609344))} mi` : `${Math.max(1, Math.round(km))} km`;
  const speed = (kmh) => U() === "us" ? `${Math.round(kmh / 1.609344)} mph` : U() === "pro" ? `${Math.round(kmh / 1.852)} kt` : `${Math.round(kmh)} km/h`;
  /* undefined while asking: assume yes. null is "outside the NWS's patch" —
     but only when the NWS said so: a lookup that failed (S.err.pt) is an
     outage, not a border (a Miami visitor was told the radar covers the
     lower 48 only while api.weather.gov was down, 2026-10-23) */
  const inUS = () => !Wx.outsideUS(S.pt, !!S.err.pt);

  /* Warning types, worst first: what storm mode is ordered by and coloured by. */
  const EV = { "Tornado Warning": ["tor", 5], "Extreme Wind Warning": ["eww", 4], "Severe Thunderstorm Warning": ["svr", 3], "Flash Flood Warning": ["ffw", 2], "Snow Squall Warning": ["other", 1] };
  const evOf = (a) => EV[a.event] || ["other", 0];
  const byDanger = (a, b) => (b.emergency - a.emergency) || (evOf(b)[1] - evOf(a)[1]);

  /* ── the pictures ── */
  function icon(kind, day = true, label = "") {
    const sun = '<circle cx="16" cy="16" r="6.2" fill="#ffd166"/><g stroke="#ffd166" stroke-width="2.2" stroke-linecap="round">' +
      [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = a * Math.PI / 180; return `<line x1="${16 + Math.cos(r) * 9.5}" y1="${16 + Math.sin(r) * 9.5}" x2="${16 + Math.cos(r) * 12.5}" y2="${16 + Math.sin(r) * 12.5}"/>`; }).join("") + "</g>";
    const moon = '<path d="M20.5 6.5a9.5 9.5 0 1 0 6 13.2A8 8 0 0 1 20.5 6.5z" fill="#e9ecf5"/>';
    const cloud = (y = 0, fill = "#ffffff") => `<path transform="translate(0 ${y})" d="M9 27h15.5a5.5 5.5 0 0 0-.6-11 7.5 7.5 0 0 0-14.3 2.4A4.3 4.3 0 0 0 9 27z" fill="${fill}"/>`;
    const small = (s) => `<g transform="translate(-3 -4) scale(.78)">${s}</g>`;
    const drops = (n, col = "#7cc4ff") => `<g stroke="${col}" stroke-width="2" stroke-linecap="round">${[10, 16, 22].slice(0, n).map((x) => `<line x1="${x}" y1="27" x2="${x - 2}" y2="31"/>`).join("")}</g>`;
    const flakes = '<g fill="#fff">' + [10, 16, 22].map((x, i) => `<circle cx="${x}" cy="${29 + (i % 2) * 1.6}" r="1.6"/>`).join("") + "</g>";
    let body;
    switch (kind) {
      case "clear": body = day ? sun : moon; break;
      case "partly": body = small(day ? sun : moon) + cloud(2); break;
      case "cloudy": body = cloud(-3, "#c9d3df") + cloud(0); break;
      case "fog": body = cloud(-4, "#c9d3df") + '<g stroke="#e6ebf1" stroke-width="2" stroke-linecap="round"><line x1="6" y1="26" x2="26" y2="26"/><line x1="9" y1="30" x2="23" y2="30"/></g>'; break;
      case "drizzle": body = cloud(-4) + drops(2); break;
      case "rain": body = cloud(-4) + drops(3); break;
      case "sleet": body = cloud(-4) + drops(2) + '<circle cx="22" cy="29.5" r="1.6" fill="#fff"/>'; break;
      case "snow": body = cloud(-4) + flakes; break;
      case "storm": body = cloud(-4, "#c9d3df") + '<path d="M17 21l-4 6h4l-2 5 6-7.5h-4l2-3.5z" fill="#ffd166"/>'; break;
      default: body = cloud(0);
    }
    return `<svg viewBox="0 0 32 32" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${body}</svg>`;
  }
  const skyOf = (kind, day) => {
    const k = { clear: "clear", partly: "partly", cloudy: "cloudy", fog: "fog", drizzle: "rain", rain: "rain", sleet: "rain", snow: "snow", storm: "storm" }[kind] || "partly";
    return `${k}-${day ? "day" : "night"}`;
  };

  /* ── loading ──
     Each source arrives on its own and draws its own part (§35.1): a dead
     station never blanks the forecast, a slow NWS never holds up the hero. */
  function begin() {
    if (S.ctl) S.ctl.abort();
    return (S.ctl = new AbortController());
  }

  /* No place: the whole country (§8.3) — every storm-based warning and
     watch, SPC's outlook for today, and the national radar. */
  async function loadUS() {
    const ctl = begin();
    const live = () => !ctl.signal.aborted && !S.place;
    S.err = {};
    render();
    radar.showUS();
    const jobs = [
      Wx.national(ctl.signal).then((a) => { if (live()) { S.national = a; S.checked.national = Date.now(); render(); radar.draw(); } })
        .catch((e) => { if (live()) { S.national = null; S.err.national = e; render(); } }),
      loadOutlook(ctl.signal, live)
    ];
    await Promise.allSettled(jobs);
    if (live()) S.loadedAt = Date.now();
  }
  function loadOutlook(signal, live) {
    return Wx.outlook("day1otlk_cat", signal).then((o) => { if (live()) { S.outlook = o; S.checked.outlook = Date.now(); render(); radar.draw(); } })
      .catch((e) => { if (live()) { S.outlook = null; S.err.outlook = e; render(); } });
  }

  async function load() {
    if (!S.place) return loadUS();
    const ctl = begin();
    const { lat, lon } = S.place;
    const key = placeKey(S.place);
    const live = () => !ctl.signal.aborted && S.place && placeKey(S.place) === key;
    S.err = {};
    if (!S.fc || S.fc.key !== key) {
      Object.assign(S, { fc: null, fcStale: false, pt: undefined, obs: undefined, office: undefined, alerts: undefined, state: undefined, selected: null, focusedStorm: null,
        ens: undefined, rec: undefined, verdict: null, fcShown: null, now: undefined, plumes: undefined, afd: undefined, air: undefined, norm: undefined });
      sky.reset();
      /* The last forecast for this place, kept in this browser so a phone
         with no signal still has something to show (§34) — labelled as old. */
      const cached = store.get("wx:last", null);
      if (cached && cached.key === key && cached.fc && Array.isArray(cached.fc.hourly)) {
        S.fc = Object.assign(cached.fc, { key, via: "this browser" }); S.fcStale = true;
      }
    }
    render();
    radar.center(lat, lon);

    const fcJob = (async () => {
      try {
        const fc = await Wx.forecast(lat, lon, ctl.signal);
        if (!live()) return;
        S.fc = Object.assign(fc, { key }); S.fcStale = false;
        store.set("wx:last", { key, fc });
        applyBlend();
      } catch (e) {
        if (!live()) return;
        S.err.fc = e;
      }
      render();
    })();

    const nwsJob = (async () => {
      try {
        const pt = await Wx.point(lat, lon, ctl.signal);
        if (!live()) return;
        S.pt = pt; render();
        if (!pt) { Object.assign(S, { obs: null, office: null, state: null }); render(); return; }
        if (S.place.here && pt.city && S.place.name !== "Near " + pt.city) {
          S.place.name = "Near " + pt.city; S.place.region = ""; store.set("wx:place", S.place); renderPlace();
        }
        const near = await Wx.nearbyStations(pt, lat, lon, ctl.signal).catch(() => []);
        if (!live()) return;
        /* the place's height, from the forecast, so a station far above or
           below it is not taken as "now" here */
        const elevJob = fcJob.then(() => S.fc && S.fc.elevation);
        await Promise.all([
          loadRecord(near, ctl.signal, live),
          elevJob.then((elev) => Wx.observation(pt, lat, lon, ctl.signal, near, elev)).then((o) => { if (live()) { S.obs = o; render(); } })
            .catch((e) => { if (live()) { S.obs = null; S.err.obs = e; render(); } }),
          ($("#afd") && pt.office ? Wx.forecastDiscussion(pt.office, ctl.signal).then((d) => { if (live()) { S.afd = d; renderAfd(); renderSources(); } }).catch(() => { if (live()) { S.afd = null; renderAfd(); } }) : Promise.resolve()),
          Wx.officeForecast(pt, ctl.signal).then((f) => { if (live()) { S.office = f; render(); } })
            .catch((e) => { if (live()) { S.office = null; S.err.office = e; render(); } }),
          loadState(ctl.signal, live)
        ]);
      } catch (e) {
        if (!live()) return;
        Object.assign(S, { pt: null, obs: null, office: null, state: null }); S.err.pt = e; render();
      }
    })();

    const alertJob = loadAlerts(ctl.signal, live);
    const ensJob = Wx.ensemble(lat, lon, ctl.signal)
      .then((e) => { if (live()) { S.ens = e; judge(); applyBlend(); render(); } })
      .catch(() => { if (live()) { S.ens = null; render(); } });
    const nowJob = loadNowcast(ctl.signal, live);
    /* Weather's air quality, and the usual for the date (kept a month per place) */
    const airJob = $("#t-air") ? Wx.air(lat, lon, ctl.signal).then((a) => { if (live()) { S.air = a; renderTiles(); renderSources(); } }).catch(() => { if (live()) S.air = null; }) : Promise.resolve();
    const normJob = !$("#t-avg") ? Promise.resolve() : (async () => {
      const kept = store.get("wx:norm", null);
      if (kept && kept.key === key && Date.now() - kept.at < 30 * 86400e3 && kept.hi) { S.norm = kept; return; }
      try { const n = await Wx.normals(lat, lon, ctl.signal); if (live() && n) { S.norm = { ...n, key, at: Date.now() }; store.set("wx:norm", S.norm); } } catch (e) { if (live()) S.norm = null; }
    })().then(() => { if (live()) { renderTiles(); renderSources(); } });
    await Promise.allSettled([fcJob, nwsJob, alertJob, ensJob, nowJob, airJob, normJob, loadOutlook(ctl.signal, live)]);
    if (live()) S.loadedAt = Date.now();
  }
  /* ── the radar nowcast: our own next hour ──
     Read from the last half hour of the mosaic in this browser (nowcast.js)
     and graded every night against what the radar did next. Rain timing
     only: storm arrival comes from the warning's own motion, never this. */
  function loadNowcast(signal, live) {
    if (!$("#next") || !S.place || !Wx.inMosaic(S.place.lat, S.place.lon) || !window.WxNowcast) { S.now = null; return Promise.resolve(); }
    if (!S.nowRec) Wx.nowcastRecord(signal).then((r) => { S.nowRec = r; renderNext(); }).catch(() => { S.nowRec = null; });
    return Wx.radarTime(signal)
      .then((valid) => Wx.nowcast(S.place.lat, S.place.lon, valid, signal))
      .then((n) => { if (live()) { S.now = n; S.nowAt = Date.now(); renderNext(); } })
      .catch(() => { if (live()) { S.now = null; renderNext(); } });
  }
  function loadAlerts(signal, live) {
    const { lat, lon } = S.place;
    return Wx.alerts(lat, lon, signal)
      .then((a) => { if (live()) { S.alerts = a; S.alertsVia = "nws"; delete S.err.alerts; S.checked.alerts = Date.now(); render(); radar.draw(); stormFocus(); } })
      .catch(async (e) => {
        if (!live()) return;
        /* the NWS did not answer: never silence. The card says so, and the
           storm warnings in force here come from Iowa State's copy of the
           NWS's feed (Wx.alertsBackup) — and storm mode runs on them */
        S.err.alerts = e;
        try {
          const b = await Wx.alertsBackup(lat, lon, signal);
          if (!live()) return;
          S.alerts = b; S.alertsVia = "iem"; S.checked.alerts = Date.now();
        } catch (e2) { if (!live()) return; S.alerts = null; S.alertsVia = null; }
        render(); radar.draw(); stormFocus();
      });
  }
  function loadState(signal, live) {
    if (!S.pt || !S.pt.state) { S.state = null; return Promise.resolve(); }
    return Wx.stateAlerts(S.pt.state, signal)
      .then((a) => { if (live()) { S.state = a; S.checked.state = Date.now(); render(); radar.draw(); } })
      .catch(() => { if (live()) { S.state = null; render(); } });
  }

  /* ── the scoreboard, here ──
     The nearest scored airport stations (from the NWS's own list of stations
     around the place) and their records, from this site's published files. */
  function loadRecord(near, signal, live) {
    if (!near.length) { S.rec = null; return Promise.resolve(); }
    return Wx.stationRecords(near.slice(0, 12), signal)
      .then((r) => { if (live()) { S.rec = r; judge(); applyBlend(); render(); } })
      .catch(() => { if (live()) { S.rec = null; render(); } });
  }
  /* The forecast the page shows: the standard one, or — only where the
     nearest station's record says something else has been clearly closer —
     that one, for temperatures: our blend, our learned forecast, or one of
     the models the page holds hour by hour (the NWS National Blend, say).
     Rain and wind stay the standard forecast's. A model that stops early
     (HRRR at two days) hands back to the standard forecast where it ends. */
  /* Which forecast has earned its place, among those this place actually has
     hours of: HRRR and the National Blend stop at the lower 48's edge, so a
     station in Alaska must not pick one and then show nothing of it. */
  function judge() {
    const st = S.rec && S.rec.stations[0];
    if (!st) { S.verdict = null; return; }
    const rows = S.ens ? [...S.ens.hours.values()] : [];
    const have = S.ens ? Wx.ENSEMBLE.filter((m) => rows.some((r) => r[m] && r[m].t != null)) : Wx.ENSEMBLE;
    S.verdict = Wx.verdict(st, S.rec.index.minDays || 7, have);
  }
  function applyBlend() {
    S.fcShown = null;
    const fc = S.fc, ens = S.ens, v = S.verdict, st = S.rec && S.rec.stations[0];
    if (!fc || !ens || !v || !v.useBlend || !st || !window.WxVerify) return;
    const recs = {};
    for (const m of WxVerify.BLEND_MODELS) recs[m] = st.models[m] && st.models[m][1];
    const learned = v.use === "learn" && st.learned && st.learned.t;
    const model = Wx.ENSEMBLE.includes(v.use) ? v.use : null;
    const hourly = fc.hourly.map((h) => {
      const row = ens.hours.get(h.t);
      if (!row) return h;
      const t = model ? (row[model] ? row[model].t : null)
        : learned ? WxVerify.learnPredict(st.learned.t, { ...row, best: { t: h.temp, w: h.wind } }, "t", h.t, S.place.lon)
        : WxVerify.blend(row, recs, WxVerify.isDay(h.t, S.place.lon)).t;
      return t == null ? h : { ...h, temp: t, blended: true };
    });
    const daily = fc.daily.map((d) => {
      const hs = hourly.filter((h) => h.blended && h.t >= d.t && h.t < d.t + 86400);
      return hs.length < 20 ? d : { ...d, hi: Math.max(...hs.map((h) => h.temp)), lo: Math.min(...hs.map((h) => h.temp)), blended: true };
    });
    if (!hourly.some((h) => h.blended)) return;      // nothing of it here: say the standard is shown
    /* "now" from the same forecast as the hours, so the strip does not step
       from one forecast's 35° to another's 30° (a station, when there is one,
       still wins in currentConditions); feels-like moves with it */
    let current = fc.current;
    const i = Wx.hourIndex(hourly, nowSec()), a = hourly[i], b = hourly[i + 1];
    if (a && a.blended && fc.current.temp != null) {
      const f = b && b.blended ? Math.min(1, Math.max(0, (nowSec() - a.t) / 3600)) : 0;
      const t = a.temp + (b && b.blended ? (b.temp - a.temp) * f : 0);
      const d = t - fc.current.temp;
      current = { ...fc.current, temp: t, feels: fc.current.feels != null ? fc.current.feels + d : null };
    }
    S.fcShown = { ...fc, current, hourly, daily, blended: v.use };
  }
  const shown = () => S.fcShown || S.fc;
  /* what the shown temperatures are, in words */
  const shownName = () => {
    const u = S.verdict && S.fcShown ? S.verdict.use : "best";
    return u === "learn" ? "this page's learned forecast" : u === "blend" ? "this page's scored blend" : u === "best" ? "the standard forecast" : "the " + (Wx.MODEL_NAMES[u] || u);
  };

  /* Storm warnings that cover the place: the point query returns alerts whose
     area holds it; a storm warning's area is its polygon. */
  const stormsHere = () => (S.place && S.alerts ? S.alerts.filter((a) => a.storm && (!a.polygon || Wx.inPolygon(S.place.lat, S.place.lon, a.polygon))) : []).sort(byDanger);
  /* Storm warnings in the same state that don't, nearest first, within 250 km. */
  function stormsNear() {
    if (!S.place || !S.state) return [];
    const mine = new Set((S.alerts || []).map((a) => a.id));
    return S.state.filter((a) => a.storm && !mine.has(a.id)).map((a) => {
      const tr = a.motion ? Wx.stormTrack(a.motion, S.place.lat, S.place.lon) : null;
      const km = tr ? tr.km : a.polygon ? polyDistanceKm(a.polygon) : null;
      return { a, tr, km };
    }).filter((x) => x.km !== null && x.km < 250).sort((x, y) => x.km - y.km || byDanger(x.a, y.a));
  }
  function polyDistanceKm(poly) {
    const ring = poly[0];
    let best = Infinity;
    for (const [lon, lat] of ring) best = Math.min(best, Wx.distanceM(S.place.lat, S.place.lon, lat, lon) / 1000);
    return Wx.inPolygon(S.place.lat, S.place.lon, poly) ? 0 : best;
  }
  /* The first time a storm warning covers the place, swing the radar to it. */
  function stormFocus() {
    const s = stormsHere()[0];
    if (!s || S.focusedStorm === s.id) return;
    S.focusedStorm = s.id;
    radar.focusStorm(s);
  }

  /* ── drawing ── */
  function renderPlace() {
    const p = S.place;
    $("#placename").textContent = p ? p.name + (p.region ? ", " + p.region : "") + (p.approx ? " (approx.)" : "") : "Across the US";
    $("#units").textContent = S.units === "us" ? "°F" : S.units === "pro" ? "KT·°C" : "°C";
    $("#units").title = S.units === "us" ? "°F, mph, inHg — tap for °C" : S.units === "pro" ? "Pro units: °C, knots, hPa (rain in inches, miles) — tap for °F" : "°C, km/h, hPa, mm — tap for Pro units";
    $("#usview").setAttribute("aria-pressed", String(!p));
  }

  const PLACE_CARDS = ["#next", "#afd", "#hourly", "#daily", "#models", "#record", "#sky", "#t-wind", "#t-humid", "#t-press", "#t-vis", "#t-uv", "#t-sun", "#t-rain"];
  function render() {
    renderPlace();
    /* Pro: the alerts here, counted on the Readouts button, so a closed drawer never hides one */
    if ($("#databadge")) $("#databadge").textContent = S.place && S.alerts && S.alerts.length ? String(S.alerts.length) : "";
    const us = !S.place;
    for (const c of PLACE_CARDS) { const el = $(c); if (el) el.hidden = us || !S.fc; }   // each page holds only its own cards
    $("#national").hidden = !us;
    if (us) {
      $("#alerts").hidden = true; $("#nearby").hidden = true; $("#storms").hidden = true;
      for (const t of ["#t-air", "#t-avg"]) if ($(t)) $(t).hidden = true;
      document.body.classList.remove("storming");
      document.title = TITLE;
      renderUSHero(); renderNational(); renderSources(); radar.label();
      return;
    }
    renderStorms(); renderHero(); renderAlerts(); renderNearby(); renderNext(); renderAfd(); renderHourly(); renderDaily(); renderModels(); renderRecord(); renderTiles(); renderSources();
    if (typeof offerInstall === "function") offerInstall();
    radar.label();
  }

  /* ── the country, with no place ── */
  function renderUSHero() {
    const n = S.national;
    const count = (ev) => (n || []).filter((a) => a.event === ev).length;
    const parts = [["Tornado Warning", "tornado warning"], ["Severe Thunderstorm Warning", "severe thunderstorm warning"], ["Flash Flood Warning", "flash flood warning"], ["Extreme Wind Warning", "extreme wind warning"], ["Tornado Watch", "tornado watch"], ["Severe Thunderstorm Watch", "severe thunderstorm watch"]]
      .map(([ev, w]) => [count(ev), w, /Tornado W|Extreme/.test(ev)]).filter(([c]) => c);
    const top = (S.outlook || []).reduce((b, o) => (!b || o.rank > b.rank ? o : b), null);
    document.body.dataset.sky = "partly-day";
    $("#hero").innerHTML = `
      <div class="where">Across the US right now</div>
      ${n === undefined ? `<p class="sub">Asking the National Weather Service…</p>`
        : n === null ? `<p class="sub">The National Weather Service did not answer. The radar still works.</p>`
        : parts.length ? `<div class="counts">${parts.map(([c, w, hot]) => `<span class="${hot ? "hot" : ""}">${c} ${w}${c === 1 ? "" : "s"}</span>`).join("")}</div>`
        : `<p class="sub" style="margin-top:10px">No tornado, severe thunderstorm or flash flood warnings anywhere in the country.</p>`}
      ${top && top.rank >= 2 ? `<div><span class="risk" style="background:${esc(top.fill || "")};color:#111">SPC today: ${esc(top.name)} somewhere</span></div>` : ""}
      <p class="sub" style="margin-top:16px">For your own forecast, rain timing and the air above you:</p>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
        <button class="go" type="button" data-locate>Use my location</button>
        <button class="chip" type="button" data-open-places style="min-height:48px">Search a place</button>
      </div>`;
  }
  function renderNational() {
    const box = $("#national");
    const n = S.national;
    if (n === undefined) { box.innerHTML = `<h2>Warnings across the US</h2><p class="loading">Loading…</p>`; return; }
    if (n === null) { box.innerHTML = `<h2>Warnings across the US</h2><p class="err">The National Weather Service did not answer. Trying again in a minute.</p>`; return; }
    const list = n.slice().sort((a, b) => byDanger(a, b) || (b.sent || 0) - (a.sent || 0));
    box.innerHTML = `<h2>Warnings across the US<span class="src">NWS · tap one to see it on the radar</span></h2>` +
      (list.length ? list.slice(0, 60).map((a) => warnRow(a, null)).join("") : `<p class="dim">Nothing active. Quiet skies.</p>`) +
      (list.length > 60 ? `<p class="dim" style="margin-top:8px">…and ${list.length - 60} more.</p>` : "");
  }
  function warnRow(a, tr, km) {
    const k = clk();
    const bits = [];
    if (tr) bits.push(trackLine(tr, true));
    else if (km != null) bits.push(km === 0 ? "covers this place" : `${dist(km)} away`);
    if (a.detection) bits.push(a.detection.toLowerCase());
    if (a.hail) bits.push(`hail ${a.hail}"`);
    if (a.gust) bits.push(`gusts ${a.gust} mph`);
    return `<button class="warn" type="button" data-focus="${esc(a.id)}" data-tone="${a.tone}">
      <i></i><div><b>${a.emergency ? "⚠ " : ""}${esc(a.event)}</b><span>${esc(a.area.split(";").slice(0, 3).join(";"))}${a.area.split(";").length > 3 ? "…" : ""}</span>${bits.length ? `<span>${esc(bits.join(" · "))}</span>` : ""}</div>
      <em>${a.ends ? "until " + esc(k.time(a.ends)) : ""}</em></button>`;
  }
  /* The warning's own motion, carried forward and said plainly. `short` for a list row. */
  function trackLine(tr, short) {
    const where = tr.state === "over" ? "over this place now" : `${dist(tr.km)} ${Wx.compass(tr.bearing)}`;
    const going = `moving ${Wx.compass(tr.toward)} at ${speed(tr.kmh)}`;
    const k = clk();
    const then = tr.state === "approaching" && tr.eta ? `could reach here around ${k.time(tr.eta)}`
      : tr.state === "passing" ? `on track to pass about ${dist(tr.passKm)} away`
      : tr.state === "away" ? "moving away from here" : "";
    return short ? [where, going, then].filter(Boolean).join(", ") : { where, going, then };
  }

  /* ── storm mode ── */
  /* Pro folds a warning (2026-10-24): over a full-window map the box covered
     the storm it was warning about. Folded it is still a red bar on top of
     the map, with the warning's name and end time — never hidden. It is kept
     here only, in memory, never saved: a reload opens every warning again.
     A warning not folded before always opens, and a folded one opens again
     the moment it is upgraded — a worse event, a tornado observed, a PDS,
     an emergency, a higher damage threat. The NWS's updates arrive with new
     ids, so a warning is known by its place, event and office; once an
     answer from the NWS no longer has it, its fold is forgotten and the next
     one is new. Only an answer counts: while the alerts are being asked
     again (S.alerts undefined) or did not come (null), every fold stands. */
  const FOLD = new Map();
  const foldKey = (a) => `${S.place ? S.place.lat + "," + S.place.lon : ""}|${a.event}|${a.sender}`;
  const THREAT = { BASE: 0, CONSIDERABLE: 1, DESTRUCTIVE: 2, CATASTROPHIC: 3 };
  const dangerOf = (a) => evOf(a)[1] * 100 + (a.emergency ? 40 : 0) + (a.pds ? 20 : 0)
    + (a.detection && /observed/i.test(a.detection) ? 10 : 0) + (THREAT[String(a.threat || "").toUpperCase()] || 0);
  function folded(a) {
    if (!PRO || !FOLD.has(foldKey(a))) return false;
    if (dangerOf(a) > FOLD.get(foldKey(a))) { FOLD.delete(foldKey(a)); return false; }
    return true;
  }
  if (PRO) document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-stormfold]");
    if (!b) return;
    const a = stormsHere().find((x) => foldKey(x) === b.dataset.stormfold);
    if (!a) return;
    if (FOLD.has(b.dataset.stormfold)) FOLD.delete(b.dataset.stormfold); else FOLD.set(b.dataset.stormfold, dangerOf(a));
    renderStorms();
    const again = [...document.querySelectorAll("#storms [data-stormfold]")].find((x) => x.dataset.stormfold === b.dataset.stormfold);
    if (again) again.focus();
  });
  function renderStorms() {
    const box = $("#storms");
    const list = stormsHere();
    document.body.classList.toggle("storming", list.length > 0);
    document.title = list.length ? `⚠ ${list[0].event} — ${PRO ? "/weather pro" : "/weather"}` : TITLE;
    if (Array.isArray(S.alerts)) { const here = new Set(list.map(foldKey)); for (const key of [...FOLD.keys()]) if (!here.has(key)) FOLD.delete(key); }
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const k = clk();
    box.innerHTML = list.map((a) => {
      const key = esc(foldKey(a));
      if (folded(a)) return `<section class="storm folded${a.emergency ? " emergency" : ""}" data-ev="${evOf(a)[0]}" aria-label="${esc(a.event)}">
        <button type="button" class="stormbar" data-stormfold="${key}" aria-expanded="false"><b>⚠ ${esc(a.event)}</b><span>until ${esc(a.ends ? k.time(a.ends) : "further notice")} · you are inside it</span><span class="show">Show</span></button>
      </section>`;
      const fold = PRO ? `<button type="button" class="stormfold" data-stormfold="${key}" aria-expanded="true" aria-label="Fold this warning to a bar">Fold</button>` : "";
      const tr = a.motion ? Wx.stormTrack(a.motion, S.place.lat, S.place.lon) : null;
      const t = tr && trackLine(tr);
      const chips = [a.detection && (/observed/i.test(a.detection) ? "Tornado OBSERVED" : a.detection.toLowerCase().replace(/^./, (c) => c.toUpperCase())),
        a.threat && `${a.threat.toLowerCase()} damage threat`, a.hail && `Hail up to ${a.hail} in`, a.gust && `Gusts to ${a.gust} mph`, a.pds && "Particularly dangerous situation"].filter(Boolean);
      return `<section class="storm${a.emergency ? " emergency" : ""}" data-ev="${evOf(a)[0]}" aria-label="${esc(a.event)}">
        ${fold}<div class="kicker">${a.emergency ? "Emergency · " : ""}You are inside this warning</div>
        <h2>${esc(a.event)}</h2>
        <div class="until">Until ${esc(a.ends ? k.time(a.ends) : "further notice")} · ${esc(a.sender)}</div>
        ${chips.length ? `<div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>` : ""}
        ${t ? `<div class="track">The storm is ${esc(t.where)}, ${esc(t.going)}${t.then ? `.<br>${esc(t.then[0].toUpperCase() + t.then.slice(1))}` : ""}.
          <small>Worked out from the warning's own storm motion, issued ${esc(Wx.age(tr.age))} ago. An estimate — act on the warning, not on this time.</small></div>` : ""}
        ${a.instruction ? `<div class="todo"><b>What to do:</b> ${esc(a.instruction)}</div>` : ""}
        <div class="from">The full text is under Official alerts. Radar below follows the storm.</div>
      </section>`;
    }).join("");
  }

  function renderHero() {
    const hero = $("#hero");
    const fc = shown();
    if (!fc) {
      hero.innerHTML = S.err.fc
        ? `<div class="empty"><h1>${esc(S.place.name)}</h1><p class="dim">The forecast service did not answer. Check the connection and try again.</p><button class="go" type="button" data-retry>Try again</button></div>`
        : `<div class="empty"><h1>${esc(S.place.name)}</h1><p class="dim">Asking the sky…</p></div>`;
      return;
    }
    const c = Wx.currentConditions(fc, S.obs || null);
    document.body.dataset.sky = skyOf(c.kind, c.isDay);
    const today = Wx.upcomingDays(fc, nowSec())[0] || {};
    const k = clk();
    const rain = Wx.rainOutlook(fc, nowSec(), 3, (s) => k.time(s * 1000));
    /* A gust is said only beside a wind from the same source: a station's
       calm with the model's gust beside it would be two places talking. */
    const gust = c.gust.v != null && c.gust.src === c.wind.src && c.gust.v > c.wind.v + 5 ? c.gust.v : null;
    const wind = c.wind.v == null ? ""
      : Wx.isCalm(c.wind.v) ? `Wind calm${gust != null ? `, gusts to ${Wx.fmt.wind(gust, U())} ${Wx.UNITS[U()].wind}` : ""}`
      : `Wind ${Wx.compass(c.windDir.v)} ${Wx.fmt.wind(c.wind.v, U())}${gust != null ? `, gusting ${Wx.fmt.wind(gust, U())}` : ""} ${Wx.UNITS[U()].wind}`;
    let from;
    /* Weather says it plainly: measured at a named place, or the forecast's
       number (2026-10-23, Ric: plain words for the everyday visitor) — the
       source and age are still there, as the room's rule asks */
    const stationName = () => { const n = String(S.obs.stationName || "").split(/ - |\/|,/)[0].trim(); return n && n.length <= 40 ? n.replace(/\b(Intl|International|Airport|Arpt|Field)\b.*$/i, (m) => /field/i.test(m) ? "Field" : "").trim() || S.obs.station : S.obs.station; };
    if (c.from === "observation" && !PRO) {
      from = `<span>Measured at ${esc(stationName())}${S.obs.dist != null ? ", " + Wx.fmt.dist(S.obs.dist, U()) + " " + Wx.UNITS[U()].dist + " away" : ""} · <b data-age="${c.time}">${Wx.age(Date.now() - c.time)}</b> ago</span>`;
    } else if (c.from === "observation") {
      from = `<span>Observed at ${esc(S.obs.station)}${S.obs.dist != null ? " · " + Wx.fmt.dist(S.obs.dist, U()) + " " + Wx.UNITS[U()].dist + " away" : ""} · <b data-age="${c.time}">${Wx.age(Date.now() - c.time)}</b> ago</span>`;
    } else {
      from = `<span${S.fcStale ? ' class="delayed"' : ""}>${S.fcStale ? "Offline — saved forecast from " : PRO ? `Model estimate · ${esc(S.fcShown ? shownName().replace(/^the /, "") : "Open-Meteo")} · ` : "Forecast · updated "}<b data-age="${fc.fetchedAt}">${Wx.age(Date.now() - fc.fetchedAt)}</b> ago</span>`;
    }
    const risk = Wx.outlookAt(S.outlook, S.place.lat, S.place.lon);
    const approx = S.place.approx ? `<div class="from"><span>Approximate place, from your internet connection · <a href="#" data-open-places>set yours</a></span></div>` : "";
    hero.innerHTML = `
      <div class="where">${esc(S.place.name)}</div>
      <div class="temp num" aria-label="${esc(deg(c.temp.v))}">${Wx.fmt.temp(c.temp.v, U())}<sup>°</sup></div>
      <div class="cond">${icon(c.kind, c.isDay)}<span>${esc(c.text)}</span></div>
      <div class="sub num">Feels like ${deg(c.feels.v)} · H ${deg(today.hi)} L ${deg(today.lo)}</div>
      ${wind ? `<div class="sub num">${esc(wind)}</div>` : ""}
      ${(() => { const v = Wx.versusYesterday(fc, nowSec()); const d = v ? (U() === "us" ? v.diff * 9 / 5 : v.diff) : 0; return v && Math.abs(d) >= (U() === "us" ? 5 : 3) ? `<div class="sub">${Math.round(Math.abs(d))}° ${d > 0 ? "warmer" : "cooler"} than yesterday</div>` : ""; })()}
      <div class="rainline${["now", "stopping", "starting"].includes(rain.state) ? " wet" : ""}">${esc(rain.text)}</div>
      ${confLine()}
      ${risk && risk.rank >= 2 ? `<div><span class="risk" style="background:${esc(risk.fill || "")};color:#111">SPC: ${esc(risk.name)} of severe storms here today</span></div>` : ""}
      ${S.alerts && S.alerts.length && !stormsHere().length ? `<div class="from"><a href="#alerts"><span style="background:rgba(160,30,30,.85)">⚠ ${esc(S.alerts[0].event)}${S.alerts.length > 1 ? ` +${S.alerts.length - 1}` : ""}</span></a></div>` : ""}
      <div class="from">${from}</div>${approx}`;
  }

  /* "23° cooler than yesterday" — in the units on screen */
  function vyText(v) {
    const d = U() === "us" ? v.diff * 9 / 5 : v.diff;
    const n = Math.round(Math.abs(d));
    return n < 1 ? "About as warm as yesterday." : `Today's high is ${n}° ${d > 0 ? "warmer" : "cooler"} than yesterday's (${deg(v.yesterday)}).`;
  }

  /* ── how sure ── */
  const confWords = (c) => {
    if (!c) return "";
    const lo = deg(c.low), hi = deg(c.high);
    const rain = c.rainSplit ? ` ${c.rainModels} of ${c.rainOf} have rain.` : c.rainModels === c.rainOf && c.rainOf ? " All of them have rain." : "";
    if (c.level === "high") return `Models agree: highs ${lo === hi ? lo : lo + "–" + hi} across ${c.models} models.${rain}`;
    if (c.level === "medium") return `Models mostly agree: highs ${lo}–${hi}.${rain}`;
    return `Models disagree: highs anywhere from ${lo} to ${hi}.${rain}`;
  };
  function confLine() {
    const fc = S.fc;
    if (!fc || !S.ens) return "";
    const today = Wx.upcomingDays(fc, nowSec())[0];
    const c = today && Wx.dayConfidence(S.ens, today.t);
    if (!c || c.level === "medium") return "";
    if (!PRO) return `<div class="confline" data-l="${c.level}">${c.level === "high" ? "✓ A confident forecast today" : "≈ Less certain than usual today"}</div>`;
    return `<div class="confline" data-l="${c.level}">${c.level === "high" ? "✓ Models agree on today" : "≈ Models disagree about today — less certain than usual"}</div>`;
  }

  /* ── the models, side by side ──
     Every model the page reads for "how sure", drawn on one chart: the
     standard forecast, and the page's own when it is the one shown. No new
     request — these are the numbers the confidence lines already use.
     HRRR stops after two days; that is the model, not a gap here. */
  const CMP_COLORS = { best: "#ffffff", nbm: "#7fd3ff", hrrr: "#ffb703", gfs: "#ff7b6b", ecmwf: "#8ee59b", aifs: "#d9a6ff", shown: "#ffffff" };
  const CMP_VARS = { t: "Temperature", p: "Rain (total from now)", w: "Wind" };
  S.cmp = { v: "t", span: 72, view: "models" };
  /* the card's two views: the deterministic models side by side, or the two
     big ensembles, every run */
  const viewSeg = () => `<div class="seg" role="group" aria-label="Models or ensemble">
      <button type="button" data-cmpview="models" aria-pressed="${S.cmp.view === "models"}">Five models</button>
      <button type="button" data-cmpview="plume" aria-pressed="${S.cmp.view === "plume"}">Ensemble · 82 runs</button></div>`;
  function renderModels() {
    const box = $("#models"), body = $("#modelsbody");
    if (!box) return;
    const fc = S.fc, ens = S.ens;
    if (!S.place || !fc || !ens) { box.hidden = true; return; }
    box.hidden = false;
    if (!$("#modelsd").open) return;                          // drawn when opened
    if (S.cmp.view === "plume") { renderPlumes(body); return; }
    /* us: rain in inches (US and Pro units); tF: °F (US only); wind in the set's own unit */
    const k = clk(), now = nowSec(), { v, span } = S.cmp, us = U() !== "metric", tF = U() === "us";
    const end = now + span * 3600, start = now - (now % 3600);
    const conv = v === "t" ? (c) => tF ? Wx.cToF(c) : c : v === "w" ? (x) => U() === "us" ? x / 1.609344 : U() === "pro" ? x / 1.852 : x : (mm) => us ? mm / 25.4 : mm;
    const unit = v === "t" ? (tF ? "°F" : "°C") : v === "w" ? Wx.UNITS[U()].wind : Wx.UNITS[U()].precip;
    const hrs = [...ens.hours.keys()].filter((t) => t >= start && t <= end).sort((a, b) => a - b);
    const lines = {};
    const add = (m, t, x) => { if (x == null || !Number.isFinite(x)) return; (lines[m] || (lines[m] = [])).push([t, x]); };
    for (const m of Wx.ENSEMBLE) {
      let acc = 0;
      for (const t of hrs) { const r = ens.hours.get(t)[m]; if (!r) continue; const x = r[v]; if (x == null) continue; if (v === "p") { acc += x; add(m, t, conv(acc)); } else add(m, t, conv(x)); }
    }
    const key = { t: "temp", w: "wind", p: "precip" }[v];
    let acc = 0;
    for (const h of S.fc.hourly) { if (h.t < start || h.t > end || h[key] == null) continue; if (v === "p") { acc += h[key]; add("best", h.t, conv(acc)); } else add("best", h.t, conv(h[key])); }
    const sh = shown();
    if (v === "t" && sh.blended) for (const h of sh.hourly) if (h.t >= start && h.t <= end && h.blended) add("shown", h.t, conv(h.temp));
    const all = Object.values(lines).flat().map((p) => p[1]);
    if (all.length < 4) { body.innerHTML = viewSeg() + '<p class="dim">The models have nothing to compare here yet.</p>'; return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    if (v !== "t") lo = 0;
    if (hi - lo < (v === "t" ? 4 : v === "p" ? (us ? 0.2 : 5) : 10)) { const mid = (hi + lo) / 2, half = (v === "t" ? 4 : v === "p" ? (us ? 0.2 : 5) : 10) / 2; lo = v === "t" ? mid - half : 0; hi = v === "t" ? mid + half : Math.max(hi, half * 2); }
    /* drawn at its real width, so the 12px labels stay 12px on a phone */
    const W = Math.max(280, Math.round(body.clientWidth || 640)), H = W < 500 ? 200 : 240, L = 40, R = 8, T = 10, B = 24;
    const X = (t) => L + (t - start) / (end - start) * (W - L - R), Y = (x) => T + (1 - (x - lo) / (hi - lo)) * (H - T - B);
    const fmtY = (x) => v === "p" && us ? x.toFixed(2) : Math.round(x);
    let grid = "";
    /* tidy ticks: 1, 2 or 5 times a power of ten */
    const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
    const dec = step < 1 ? Math.min(2, Math.ceil(-Math.log10(step))) : 0;
    for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) { const y = Y(x); grid += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${x.toFixed(dec)}</text>`; }
    /* a tick at each local midnight, labelled with the day */
    for (let t = start; t <= end; t += 3600) if (k.hour(t * 1000) === "12AM") grid += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.18)"/><text x="${X(t) + 4}" y="${H - 7}">${esc(k.day(t * 1000))}</text>`;
    const path = (pts) => pts.map(([t, x], i) => `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(x).toFixed(1)}`).join("");
    const order = ["gfs", "ecmwf", "aifs", "nbm", "hrrr", "best", "shown"];
    const svgLines = order.filter((m) => lines[m]).map((m) => `<path d="${path(lines[m])}" fill="none" stroke="${CMP_COLORS[m]}" stroke-width="${m === "shown" ? 3 : m === "best" ? 2.2 : 1.8}" ${m === "best" ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`).join("");
    /* in words: where they disagree most */
    let worst = null;
    for (const t of hrs) {
      const xs = Wx.ENSEMBLE.map((m) => (lines[m] || []).find((p) => p[0] === t)).filter(Boolean).map((p) => p[1]);
      if (xs.length < 3) continue;
      const sp = Math.max(...xs) - Math.min(...xs);
      if (!worst || sp > worst.sp) worst = { t, sp, xs };
    }
    const nm = (m) => Wx.MODEL_NAMES[m] || m;
    let say = "";
    if (worst && v === "t") {
      const at = Wx.ENSEMBLE.map((m) => ({ m, p: (lines[m] || []).find((q) => q[0] === worst.t) })).filter((x) => x.p).sort((a, b) => b.p[1] - a.p[1]);
      say = worst.sp < 3 ? `The models agree within ${Math.round(worst.sp)}° the whole way.` :
        `They split most ${esc(k.dayLong(worst.t * 1000))} around ${esc(k.time(worst.t * 1000))}: ${esc(nm(at[0].m))} ${Math.round(at[0].p[1])}°, ${esc(nm(at[at.length - 1].m))} ${Math.round(at[at.length - 1].p[1])}°.`;
    } else if (v === "p") {
      const tot = Wx.ENSEMBLE.filter((m) => lines[m] && lines[m].length).map((m) => ({ m, x: lines[m][lines[m].length - 1][1] })).sort((a, b) => b.x - a.x);
      const wet = tot.filter((x) => x.x >= (us ? 0.04 : 1));
      say = !tot.length ? "" : !wet.length ? "None of the models has meaningful rain in this window." :
        `${wet.length} of ${tot.length} models have rain; ${esc(nm(tot[0].m))} the most (${fmtY(tot[0].x)} ${esc(unit)}).`;
    } else if (worst) say = `Wind: the models differ by up to ${Math.round(worst.sp)} ${esc(unit)}.`;
    const keyHtml = order.filter((m) => lines[m]).map((m) => `<span><i style="background:${CMP_COLORS[m]}${m === "best" ? ";background:repeating-linear-gradient(90deg,#fff 0 5px,transparent 5px 9px)" : ""}"></i>${m === "best" ? "Standard forecast" : m === "shown" ? "Shown on this page" : esc(nm(m))}</span>`).join("");
    const seg = (attr, val, label, on) => `<button type="button" data-${attr}="${val}" aria-pressed="${on}">${label}</button>`;
    body.innerHTML = viewSeg() + `<div class="seg" role="group" aria-label="What to compare">${Object.entries(CMP_VARS).map(([x, l]) => seg("cmpv", x, l.split(" (")[0], x === v)).join("")}
        <span class="sep"></span>${seg("cmps", 72, "3 days", span === 72)}${seg("cmps", 168, "7 days", span === 168)}</div>
      ${say ? `<p class="cmpsay">${say}</p>` : ""}
      <svg class="cmpchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(CMP_VARS[v])} from each model, ${span === 72 ? "three" : "seven"} days, in ${esc(unit)}. ${esc(say.replace(/<[^>]+>/g, ""))}">${grid}${svgLines}</svg>
      <div class="cmpkey">${keyHtml}</div>
      <p class="nextnote">${esc(CMP_VARS[v])}, ${esc(unit)}. Each line is one model's latest run, read for this spot. HRRR runs only two days ahead. The page's track record below says which of them has been closest here.</p>`;
  }
  /* ── the ensemble plume (§17.2) ──
     Every run of GEFS (31) and ECMWF ENS (51) for a week: each one the same
     model started from slightly different weather, to show what could
     happen. Faint lines for the runs, a band for the middle 80%, the middle
     run bold, the standard forecast dashed; then, per day, the share of runs
     with rain and the spread of their highs. Fetched only when opened. */
  function renderPlumes(body) {
    const place = S.place;
    if (S.plumes === undefined) {
      S.plumes = null; S.plumesBusy = true;
      const key = placeKey(place);
      Wx.plumes(place.lat, place.lon).then((p) => { if (S.place && placeKey(S.place) === key) { S.plumes = p || false; S.plumesAt = Date.now(); } })
        .catch(() => { if (S.place && placeKey(S.place) === key) S.plumes = false; })
        .finally(() => { S.plumesBusy = false; if (S.cmp.view === "plume") renderModels(); renderSources(); });
    }
    if (S.plumesBusy) { body.innerHTML = viewSeg() + `<p class="loading">Fetching 82 runs…</p>`; return; }
    if (!S.plumes) { body.innerHTML = viewSeg() + `<p class="err">The ensemble service did not answer. Try again later, or look at the five models.</p>`; return; }
    const pl = S.plumes, fc = S.fc, k = clk(), us = U() === "us", now = nowSec();
    const conv = (c) => us ? Wx.cToF(c) : c, unit = us ? "°F" : "°C";
    const days = Wx.upcomingDays(fc, now).map((d) => d.t);
    const st = Wx.plumeStats(pl, days);
    const start = now - (now % 3600), end = Math.min(start + 168 * 3600, pl.times[pl.times.length - 1]);
    const idx = pl.times.map((t, i) => t >= start && t <= end ? i : -1).filter((i) => i >= 0);
    if (idx.length < 6) { body.innerHTML = viewSeg() + `<p class="dim">The ensemble has nothing for the days ahead here yet.</p>`; return; }
    const all = pl.members.flatMap((m) => idx.map((i) => m.t[i])).filter((x) => x != null).map(conv);
    let lo = Math.min(...all), hi = Math.max(...all);
    if (hi - lo < 6) { const mid = (hi + lo) / 2; lo = mid - 3; hi = mid + 3; }
    const W = Math.max(280, Math.round(body.clientWidth || 640)), H = W < 500 ? 210 : 250, L = 40, R = 8, T = 10, B = 24;
    const X = (t) => L + (t - start) / (end - start) * (W - L - R), Y = (x) => T + (1 - (x - lo) / (hi - lo)) * (H - T - B);
    let grid = "";
    const raw = (hi - lo) / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw);
    for (let x = Math.ceil(lo / step) * step; x <= hi + 1e-9; x += step) grid += `<line x1="${L}" x2="${W - R}" y1="${Y(x)}" y2="${Y(x)}" stroke="rgba(255,255,255,.12)"/><text x="${L - 6}" y="${Y(x) + 4}" text-anchor="end">${Math.round(x)}</text>`;
    for (let t = start; t <= end; t += 3600) if (k.hour(t * 1000) === "12AM") grid += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.18)"/><text x="${X(t) + 4}" y="${H - 7}">${esc(k.day(t * 1000))}</text>`;
    const path = (pts) => pts.map(([t, x], j) => `${j ? "L" : "M"}${X(t).toFixed(1)},${Y(x).toFixed(1)}`).join("");
    const runs = pl.members.map((m) => `<path d="${path(idx.filter((i) => m.t[i] != null).map((i) => [pl.times[i], conv(m.t[i])]))}" fill="none" stroke="${m.set === "GEFS" ? "rgba(255,123,107,.22)" : "rgba(142,229,155,.22)"}" stroke-width="1"/>`).join("");
    const hrs = st.hours.filter((h) => h.t >= start && h.t <= end && h.p10 != null);
    const band = `<path d="${path(hrs.map((h) => [h.t, conv(h.p90)]))}L${hrs.slice().reverse().map((h) => `${X(h.t).toFixed(1)},${Y(conv(h.p10)).toFixed(1)}`).join("L")}Z" fill="rgba(124,196,255,.22)"/>`;
    const median = `<path d="${path(hrs.map((h) => [h.t, conv(h.p50)]))}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>`;
    const std = `<path d="${path(fc.hourly.filter((h) => h.t >= start && h.t <= end && h.temp != null).map((h) => [h.t, conv(h.temp)]))}" fill="none" stroke="#ffd166" stroke-width="2" stroke-dasharray="5 4"/>`;
    /* per day, in words and a row each */
    const D = st.days.filter((d) => d.t + 86400 > now);
    const loose = D.reduce((b, d) => !b || d.hi90 - d.hi10 > b.hi90 - b.hi10 ? d : b, null);
    const wettest = D.reduce((b, d) => d.wet != null && (!b || d.wet > b.wet) ? d : b, null);
    const dn = (d) => d.t <= now ? "today" : k.dayLong(d.t * 1000 + 43200e3).split(",")[0];
    const say = [
      wettest && wettest.wet >= 0.1 ? `${dn(wettest)[0].toUpperCase() + dn(wettest).slice(1)} is the likeliest to be wet: ${Math.round(wettest.wet * 100)}% of the ${st.runs} runs have rain.` : `None of the ${st.runs} runs has much rain this week.`,
      loose ? `They are least sure about ${dn(loose)}: the warmest tenth have a high above ${Math.round(conv(loose.hi90))}°, the coolest tenth below ${Math.round(conv(loose.hi10))}°.` : ""
    ].filter(Boolean).join(" ");
    const rows = D.map((d) => `<div class="plrow"><span class="pld">${esc(d.t <= now ? "Today" : k.day(d.t * 1000 + 43200e3))}</span>
        <span class="plbar" title="${d.wet != null ? Math.round(d.wet * 100) + "% of runs have 1 mm or more" : ""}"><i style="width:${d.wet != null ? Math.max(2, d.wet * 100) : 0}%"></i></span>
        <span class="plp num">${d.wet != null ? Math.round(d.wet * 100) + "%" : "–"}</span>
        <span class="plh num">${Math.round(conv(d.hi10))}–${Math.round(conv(d.hi90))}°</span></div>`).join("");
    body.innerHTML = viewSeg() + `<p class="cmpsay">${esc(say)}</p>
      <svg class="cmpchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperature from ${st.runs} ensemble runs for the week, in ${unit}. ${esc(say)}">${grid}${runs}${band}${median}${std}</svg>
      <div class="cmpkey"><span><i style="background:rgba(255,123,107,.8)"></i>GEFS runs (${pl.members.filter((m) => m.set === "GEFS").length})</span><span><i style="background:rgba(142,229,155,.8)"></i>ECMWF ENS runs (${pl.members.filter((m) => m.set !== "GEFS").length})</span><span><i style="background:rgba(124,196,255,.6);height:8px"></i>Middle 80%</span><span><i style="background:#fff"></i>Middle run</span><span><i style="background:repeating-linear-gradient(90deg,#ffd166 0 5px,transparent 5px 9px)"></i>Standard forecast</span></div>
      <div class="plrows"><div class="plrow plhead"><span>Day</span><span>Chance of rain</span><span></span><span title="The middle 80% of the runs' highs">Highs</span></div>${rows}</div>
      <p class="nextnote">${unit}. Each faint line is one run of an ensemble — the same model started from slightly different weather, so the spread shows how much the forecast could change. Chance of rain is the share of all ${st.runs} runs with 1 mm or more that day; highs are the middle 80% of the runs' own. The runs are the models' own, not corrected for this place, so the band can sit off the forecast above. Via Open-Meteo, fetched ${esc(Wx.age(Date.now() - S.plumesAt))} ago.</p>`;
  }
  document.addEventListener("click", (e) => {
    const vb = e.target.closest("[data-cmpview]");
    if (vb) { S.cmp.view = vb.dataset.cmpview; renderModels(); return; }
    const b = e.target.closest("[data-cmpv],[data-cmps]");
    if (!b) return;
    if (b.dataset.cmpv) S.cmp.v = b.dataset.cmpv; else S.cmp.span = Number(b.dataset.cmps);
    renderModels();
  });
  if ($("#modelsd")) $("#modelsd").addEventListener("toggle", renderModels);

  /* ── the forecast discussion (Weather Pro) ──
     The office's own reasoning, section by section, exactly as written —
     never summarised. */
  function renderAfd() {
    const box = $("#afd");
    if (!box) return;
    if (!S.place || S.pt === null) { box.hidden = true; return; }
    box.hidden = false;
    const head = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3z M10 2v3h3 M5 8h6 M5 11h6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>Forecast discussion<span class="src">${S.afd ? `NWS ${esc(S.afd.office)} · ${esc(clk().time(S.afd.issued))}` : "NWS"}</span></h2>`;
    if (S.afd === undefined) { box.innerHTML = head + `<p class="loading">Asking the forecast office…</p>`; return; }
    if (!S.afd) { box.innerHTML = head + `<p class="dim">The forecast office's discussion did not answer.</p>`; return; }
    /* sections start ".NAME..." and end at "&&"; the header before the first is the product's own boilerplate */
    const text = S.afd.text.replace(/\r/g, "");
    const parts = text.split(/\n(?=\.[A-Z][A-Z0-9 /().,-]{2,}\.\.\.)/).slice(1);
    const sections = (parts.length ? parts : [text]).map((s) => {
      const m = /^\.([^.]+(?:\.[^.]+)*?)\.\.\.\s*/.exec(s);
      return { name: m ? m[1].trim() : "Discussion", body: (m ? s.slice(m[0].length) : s).replace(/\n&&[\s\S]*$/, "").replace(/\n\$\$[\s\S]*$/, "").trim() };
    }).filter((s) => s.body);
    box.innerHTML = head + sections.map((s, i) => `<details class="afd"${i < 2 ? " open" : ""}><summary>${esc(titleCase0(s.name))}</summary><pre>${esc(Wx.reflowDiscussion(s.body))}</pre></details>`).join("") +
      `<p class="nextnote">As the forecasters wrote it, not rewritten. <a href="https://forecast.weather.gov/product.php?site=NWS&amp;issuedby=${esc(S.afd.office.replace(/^K/, ""))}&amp;product=AFD" target="_blank" rel="noopener">At the NWS ↗</a></p>`;
  }
  const titleCase0 = (s) => s.toLowerCase().replace(/(^|[\s/(])[a-z]/g, (c) => c.toUpperCase());

  /* ── SPC mesoanalysis (Weather Pro) ──
     SPC's own hourly analysis maps, as SPC draws them: a region and a
     field. Their own projection and their own map — shown, never redrawn. */
  const MESO_SECTORS = [["19", "National"], ["11", "Northwest"], ["12", "Southwest"], ["22", "Great Basin"], ["13", "Northern Plains"], ["14", "Central Plains"],
    ["15", "Southern Plains"], ["20", "Midwest"], ["21", "Great Lakes"], ["16", "Northeast"], ["17", "East Central"], ["18", "Southeast"]];
  const MESO_FIELDS = [["pmsl", "Surface pressure and wind"], ["sbcp", "Surface-based CAPE"], ["mlcp", "Mixed-layer CAPE and CIN"], ["mucp", "Most-unstable CAPE"],
    ["dcape", "Downdraft CAPE"], ["lclh", "LCL height"], ["laps", "Mid-level lapse rates"], ["pwtr", "Precipitable water"], ["shr6", "0–6 km shear"],
    ["eshr", "Effective shear"], ["srh1", "0–1 km helicity"], ["stpc", "Significant tornado (effective)"], ["scp", "Supercell composite"]];
  /* the regional sector the place sits in, until the visitor picks one
     (2026-10-23): the nearest of SPC's regional sectors by its rough middle —
     a default only, the picker still says which; outside the lower 48, National */
  const MESO_MIDS = { 11: [45.5, -117], 12: [35.5, -115.5], 13: [45, -100], 14: [39, -98], 15: [33, -99], 20: [40.5, -91], 21: [43.5, -85], 16: [42.5, -75], 17: [38, -80], 18: [32.5, -85] };
  const mesoSectorFor = (p) => {
    if (!p || p.lat < 24 || p.lat > 50 || p.lon < -125 || p.lon > -66) return "19";
    let best = "19", bd = Infinity;
    for (const [id, [la, lo]] of Object.entries(MESO_MIDS)) { const d = Math.hypot(p.lat - la, (p.lon - lo) * Math.cos(p.lat * Math.PI / 180)); if (d < bd) { bd = d; best = id; } }
    return best;
  };
  S.meso = Object.assign({ s: null, f: "mlcp" }, store.get("wx:meso", {}));
  function renderMeso() {
    const box = $("#meso");
    if (!box) return;
    const m = S.meso, hour = Math.floor(Date.now() / 1800e3);
    const field = MESO_FIELDS.find((x) => x[0] === m.f) || MESO_FIELDS[2], sector = MESO_SECTORS.find((x) => x[0] === (m.s || mesoSectorFor(S.place))) || MESO_SECTORS[0];
    const src = `https://www.spc.noaa.gov/exper/mesoanalysis/s${sector[0]}/${field[0]}/${field[0]}.gif?t=${hour}`;
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12c3-5 5 1 7-4s3-3 5-5M2 14h12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>SPC mesoanalysis<span class="src">hourly · RAP + observations</span></h2>
      <div class="mesopick"><label>Region <select id="mesos">${MESO_SECTORS.map(([v, l]) => `<option value="${v}"${v === sector[0] ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>Field <select id="mesof">${MESO_FIELDS.map(([v, l]) => `<option value="${v}"${v === field[0] ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <a class="mesoimg" href="https://www.spc.noaa.gov/exper/mesoanalysis/new/viewsector.php?sector=${sector[0]}" target="_blank" rel="noopener"><img src="${src}" alt="SPC mesoanalysis map: ${esc(field[1])}, ${esc(sector[1])}" loading="lazy" decoding="async"></a>
      <p class="nextnote">The Storm Prediction Center's own analysis, redrawn by SPC every hour from the RAP model and the latest observations — shown as SPC draws it. Tap the map to open SPC's viewer.</p>`;
  }
  document.addEventListener("change", (e) => {
    if (e.target.id !== "mesos" && e.target.id !== "mesof") return;
    S.meso = { s: $("#mesos").value, f: $("#mesof").value };
    store.set("wx:meso", S.meso);
    renderMeso();
  });

  /* ── how accurate this has been, here ── */
  function renderRecord() {
    const box = $("#record");
    if (!box) return;
    const r = S.rec, v = S.verdict, st = r && r.stations[0];
    if (!S.place || S.pt === null || r === undefined) { box.hidden = true; return; }
    box.hidden = false;
    const head = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 14h12M4 14V8M8 14V3M12 14V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>How accurate is this, here?<span class="src">scored every day</span></h2>`;
    if (!r || !st || !v || !v.rows.length) {
      box.innerHTML = head + `<p class="dim">This site holds every forecast it shows to what actually happens at about 2,500 US airport weather stations, every day. The record for the stations near here is still being built — check back soon.</p>`;
      return;
    }
    const f = U() === "us" ? 1.8 : 1;
    const max = Math.max(...v.rows.map((x) => x.mae)) * f;
    /* what is actually on the page — the pick only once its numbers arrived */
    const used = S.fcShown ? v.use : "best";
    const days = v.rows.find((x) => x.m === used)?.days || v.rows[0].days;
    const rows = v.rows.map((x) => `<div class="recrow${x.m === used ? " used" : ""}">
        <span class="rn">${esc(Wx.MODEL_NAMES[x.m] || x.m)}${x.m === used ? ' <span class="tag">shown here</span>' : ""}</span>
        <span class="rb"><i style="width:${Math.max(4, x.mae * f / max * 100)}%"></i></span>
        <span class="rv num">±${(x.mae * f).toFixed(1)}°</span></div>`).join("");
    const nat = r.index && r.index.national;
    const natLine = nat && nat.blend && nat.best && nat.blend.stations > 50
      ? `<p class="nextnote">Across ${nat.blend.stations.toLocaleString()} US stations, the blend's typical miss is ±${(nat.blend.mae * f).toFixed(1)}° against the standard forecast's ±${(nat.best.mae * f).toFixed(1)}°.</p>` : "";
    const mine = { blend: "its own blend", learn: "its own learned forecast" };
    const deg = (x) => "±" + (x.mae * f).toFixed(1) + "°";
    const why = v.pick && !S.fcShown
      ? `${(mine[v.pick.m] || "The " + (Wx.MODEL_NAMES[v.pick.m] || v.pick.m)).replace(/^its/, "This page's")} has the best record here, but its numbers ${S.ens === undefined ? "are still loading" : "did not load"} — this page shows the standard forecast meanwhile.`
      : v.pick
      ? `This page shows ${mine[v.pick.m] || "the " + (Wx.MODEL_NAMES[v.pick.m] || v.pick.m)} for temperatures here, because at this station it has been closest — ${deg(v.pick)} against the standard forecast's ${deg(v.base)}.`
        + (v.best && v.best.m !== v.pick.m ? ` (${Wx.MODEL_NAMES[v.best.m] || v.best.m} ranks above it but is not one this page can draw.)` : "")
      : v.base && (v.blend || v.learn) ? `This page shows the standard forecast here: nothing it can draw has beaten it at this station yet.`
      : "This page shows the standard forecast here until the others have a long enough record.";
    box.innerHTML = head + `<p style="margin-bottom:10px">Next-day temperature forecasts at <b>${esc(st.name)}</b> (${esc(st.id)}${st.dist != null ? `, ${Wx.fmt.dist(st.dist, U())} ${Wx.UNITS[U()].dist} away` : ""}), average miss over the last ${days} days:</p>
      <div class="recrows">${rows}</div>
      <p class="nextnote">${esc(why)}</p>${natLine}
      <p class="nextnote">Scored against the airport's own thermometer, through ${esc(r.index.through || "")}. A miss of ±1.5° is very good; most apps never show theirs.</p>
      ${v.rows.some((x) => x.m === "pangu") ? `<p class="nextnote">Pangu AI is a published AI weather model (Huawei; Bi et al., Nature 2023, weights CC BY-NC-SA 4.0) that this site runs itself every evening, from ECMWF's open data (CC BY 4.0).</p>` : ""}`;
  }

  function renderAlerts() {
    const box = $("#alerts");
    const a = S.alerts;
    /* an alert check that failed is shown, never hidden (2026-10-23) */
    const down = Wx.alertSource(!!S.err.alerts, S.alertsVia) !== "nws" && inUS();
    if ((!a || !a.length) && !down) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const k = clk();
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.id));
    const where = "Check weather.gov, a weather radio or local news";
    const banner = !down ? "" : `<p class="alertdown" role="alert"><b>The National Weather Service did not answer</b>, so not every alert here could be checked. ${
      S.alertsVia === "iem" ? `${a.length ? "The storm warnings below come from" : "No storm warning is in force here in"} Iowa State's copy of the NWS's feed. It holds the warnings and advisories the NWS draws as polygons; watches and county-wide alerts (winter, heat, wind) are not in it. ${where}. Trying the NWS again every minute.`
        : `Iowa State's copy did not answer either, so warnings may be missing. ${where}. Trying again every minute.`}</p>`;
    box.innerHTML = `<h2>Official alerts<span class="src">${S.alertsVia === "iem" ? "NWS, via Iowa State" : "National Weather Service"}</span></h2>` + banner + (a || []).map((x) => `
      <details class="alert" data-tone="${x.tone}" data-id="${esc(x.id)}"${open.has(x.id) ? " open" : ""}>
        <summary><span class="ev">${esc(x.event)}</span><span class="until">until ${esc(x.ends ? k.full(x.ends) : "further notice")}</span></summary>
        <div class="body">
          ${x.headline ? `<p><b>${esc(x.headline)}</b></p>` : ""}
          ${x.description ? `<p>${esc(x.description)}</p>` : ""}
          ${x.instruction ? `<p><b>What to do:</b> ${esc(x.instruction)}</p>` : ""}
          <p class="meta">${esc(x.sender)}${x.area ? " · " + esc(x.area) : ""}<br>Severity ${esc(x.severity)} · ${esc(x.urgency)} · ${esc(x.certainty)}${x.sent ? " · issued " + esc(k.full(x.sent)) : ""}${x.polygon ? " · area drawn on the radar" : ""}</p>
        </div>
      </details>`).join("");
  }

  function renderNearby() {
    const box = $("#nearby");
    const near = stormsNear();
    if (!near.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `<h2>Warnings nearby<span class="src">NWS · ${esc(S.pt && S.pt.state || "")} · tap for radar</span></h2>` +
      near.slice(0, 12).map(({ a, tr, km }) => warnRow(a, tr, km)).join("") +
      `<p class="nextnote">Distances and arrival times are worked out from each warning's own storm motion — estimates, not warnings.</p>`;
  }

  function renderNext() {
    const box = $("#next");
    const fc = shown();
    if (!box || !fc) return;
    const k = clk();
    const now = nowSec();
    const rain = Wx.rainOutlook(fc, now, 3, (s) => k.time(s * 1000));
    let slots = fc.minutely.filter((s) => s.t > now - 900 && s.t - 900 < now + 3 * 3600);
    const hourly = slots.length < 6;
    if (hourly) slots = fc.hourly.filter((h) => h.t + 3600 > now && h.t < now + 3 * 3600).map((h) => ({ t: h.t + 3600, precip: h.precip, snow: 0 }));
    const per = hourly ? 1 : 4;
    const max = Math.max(2, ...slots.map((s) => (s.precip || 0) * per));
    const bars = slots.map((s) => {
      const rate = (s.precip || 0) * per;
      const snow = (s.snow || 0) * 10 / 7 >= (s.precip || 0) * 0.5 && s.snow > 0;
      const h = Math.max(4, Math.sqrt(rate / max) * 100);
      return `<i class="${rate >= 0.4 ? (snow ? "s" : "w") : ""}" style="height:${rate >= 0.4 ? h : 4}%" title="${esc(k.time((s.t - (hourly ? 3600 : 900)) * 1000))}: ${Wx.fmt.precip(rate, U())} ${Wx.UNITS[U()].precip}/h"></i>`;
    }).join("");
    /* The hero already says the three-hour sentence; when it is dry, this
       card adds when the forecast next has rain, so it says something more. */
    let after = "";
    if (rain.state === "dry") {
      /* likely, or real rain with a fair chance — not a trace at 2% */
      const wet = fc.hourly.find((h) => h.t >= now + 3 * 3600 && ((h.pop ?? 0) >= 50 || ((h.precip ?? 0) >= 0.3 && (h.pop ?? 100) >= 30)));
      const dayWord = (t) => { const a = k.ymd(t * 1000), b = k.ymd(now * 1000), c = k.ymd((now + 86400) * 1000); return a === b ? "today" : a === c ? "tomorrow" : k.dayLong(t * 1000); };
      after = wet ? `Next rain in the forecast: ${dayWord(wet.t)} around ${k.hour(wet.t * 1000)}${wet.pop != null ? ` (${Math.round(wet.pop)}% chance)` : ""}.`
        : "No rain likely anywhere in the 10-day forecast.";
    }
    const radarLine = nowcastLine(k);
    /* Weather, when nothing is coming: the hero already says it is dry, so this
       card says only what is new — the radar's word and when the forecast next
       has rain — and keeps how it is worked out behind a fold */
    const radarDry = !S.now || (S.now.series && !S.now.series.some((p) => p.p != null && p.p >= 0.15));
    if (!PRO && rain.state === "dry" && radarDry) {
      box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="currentColor"/></svg>Next 3 hours<span class="src">radar and forecast</span></h2>
        <div style="font-size:17px;font-weight:600">${S.now ? "No rain on radar heading here, and none in the forecast." : esc(rain.text)}</div>
        ${after ? `<p class="nextafter">${esc(after)}</p>` : ""}
        ${radarLine ? `<details class="how"><summary>How this is worked out</summary>${radarLine}</details>` : ""}`;
      return;
    }
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="currentColor"/></svg>Next 3 hours<span class="src">${radarLine ? "radar, then " : ""}${PRO ? "model" : "forecast"} ${hourly ? "hourly" : "every 15 min"}</span></h2>
      ${radarLine}
      ${radarLine ? `<div class="who">${PRO ? "The models, 3 hours" : "The forecast, 3 hours"}</div>` : ""}
      <div style="font-size:17px;font-weight:600">${esc(rain.text)}</div>
      ${after ? `<p class="nextafter">${esc(after)}</p>` : ""}
      <div class="nextbars" role="img" aria-label="${esc(rain.text)}">${bars}</div>
      <div class="nextaxis"><span>Now</span><span>+1 h</span><span>+2 h</span><span>+3 h</span></div>
      ${rain.note ? `<p class="nextnote">${esc(rain.note)}</p>` : ""}`;
  }
  /* the radar's own next hour, above the models' three: a sentence, a strip
     of twelve five-minute cells, where the rain is heading, and how this
     estimate has done — every part of it labelled as ours */
  function nowcastLine(k) {
    const n = S.now;
    const said0 = n && WxNowcast.describe(n.series, { base: n.valid || S.nowAt, clock: (ms) => k.time(ms) });
    if (!said0) return "";
    /* Echoes near a dry station are often rain that never reaches the
       ground, or clutter. When the station here says it isn't raining, the
       radar line says both things rather than "rain is nearby" on its own. */
    const groundDry = S.obs && S.obs.text && Wx.fresh("observation", S.obs.time).stale === false && !["rain", "drizzle", "storm", "snow", "sleet"].includes(Wx.kindOfText(S.obs.text)) && !(S.obs.precipHour > 0);
    const said = said0.kind === "dry" && n.series.some((p) => p.p >= 0.15) && groundDry
      ? { ...said0, text: `Light echoes on radar nearby, none heading straight here in the next hour — and ${S.obs.station} reports no rain.` }
      : said0;
    const cells = n.series.filter((p) => p.min > 0).map((p) => {
      const lvl = p.p === null ? "x" : p.p >= 0.5 ? (p.dbz >= 45 ? "h" : p.dbz >= 35 ? "m" : "l") : p.p >= 0.15 ? "n" : "";
      return `<i class="${lvl}" title="${esc(k.time((n.valid || S.nowAt) + p.min * 60e3))}: ${p.p === null ? "no radar" : Math.round(p.p * 100) + "% chance"}"></i>`;
    }).join("");
    const head = n.moving && n.speed >= 5 ? `Rain on radar is moving ${Wx.compass(n.toward)} at ${Wx.fmt.wind(n.speed, U())} ${Wx.UNITS[U()].wind}.` : "";
    const rec = S.nowRec && S.nowRec.leads && S.nowRec.leads[30];
    const grade = rec && rec.csi != null && rec.still != null && S.nowRec.days >= 3
      ? ` Graded nightly: at 30 minutes it has caught ${Math.round(rec.csi * 100)}% of rain (shared hits), against ${Math.round(rec.still * 100)}% for assuming nothing moves.`
      : " Graded every night against what the radar did next.";
    const age = n.valid ? Wx.age(Date.now() - n.valid) + " ago" : "";
    return `<div class="nowcast">
      <div class="nowtext">${esc(said.text)}</div>
      <div class="nowstrip" role="img" aria-label="${esc(said.text)}">${cells}</div>
      <div class="nextaxis"><span>Now</span><span>+30 min</span><span>+1 h</span></div>
      <p class="nextnote">From radar${age ? " scanned " + esc(age) : ""} — our own estimate: the last half hour carried forward. ${esc(head)}${esc(grade)}</p>
    </div>`;
  }


  /* An hour's wind for the strip (§9.1): an arrow the way it blows, the
     speed, and the gust under it when it is 10 mph (16 km/h) or more above. */
  function windCell(h) {
    if (h.wind == null) return `<span class="wd"></span>`;
    if (Wx.isCalm(h.wind)) return `<span class="wd">calm</span>`;
    const arrow = h.windDir != null ? `<svg viewBox="0 0 10 10" aria-hidden="true" style="transform:rotate(${Math.round(h.windDir + 180)}deg)"><path d="M5 1l3 4H6v4H4V5H2z" fill="currentColor"/></svg>` : "";
    const g = h.gust != null && h.gust - h.wind >= 16 ? `<small>${PRO ? "g" : "gusts "}${Wx.fmt.wind(h.gust, U())}</small>` : "";
    return `<span class="wd num" title="Wind ${esc(Wx.compass(h.windDir))} ${Wx.fmt.wind(h.wind, U())} ${Wx.UNITS[U()].wind}">${arrow}${Wx.fmt.wind(h.wind, U())}${g}</span>`;
  }

  function renderHourly() {
    const box = $("#hourly");
    const fc = shown();
    if (!box || !fc) return;
    const k = clk();
    const hours = Wx.upcomingHours(fc, nowSec(), 25);
    if (S.selected && !hours.some((h) => h.t === S.selected)) S.selected = null;
    /* "Now" is the hero's number, so the two never disagree on one screen. */
    const nowC = Wx.currentConditions(fc, S.obs || null), nowTemp = nowC.temp.v;
    /* "Now" is measured when a station is near and fresh, and the hours after it
       are the forecast: on Weather it says so, so a forecast a few degrees
       cooler or warmer than the station does not read as a sudden change */
    const nowMeasured = !PRO && nowC.temp.src === "obs";
    /* sunrise and sunset sit in the strip at their own minute */
    const suns = [];
    for (const d of fc.daily) for (const [t, up] of [[d.sunrise, true], [d.sunset, false]]) if (t) suns.push({ t, up });
    const sunIcon = (up) => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 24h20" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M10 24a6 6 0 0 1 12 0" fill="#ffd166"/><path d="M16 ${up ? "15V7m-3.5 3.5L16 7l3.5 3.5" : "7v8m-3.5-3.5L16 15l3.5-3.5"}" fill="none" stroke="#ffd166" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const strip = hours.map((h, i) => {
      const c = Wx.condition(h.code);
      const sun = suns.filter((x) => x.t >= h.t && x.t < h.t + 3600 && x.t > nowSec() && i < hours.length - 1).map((x) => `<div class="hour sun" role="note">
        <span class="h">${esc(k.time(x.t * 1000))}</span>${sunIcon(x.up)}<span class="p"></span><span class="t">${x.up ? "Sunrise" : "Sunset"}</span><span class="wd"></span></div>`).join("");
      return `<button class="hour" type="button" data-hour="${h.t}" aria-pressed="${S.selected === h.t}">
        <span class="h">${i === 0 ? "Now" : esc(k.hour(h.t * 1000))}</span>
        ${icon(c.kind, h.isDay !== 0, c.text)}
        <span class="p">${h.pop >= 10 ? Math.round(h.pop) + "%" : ""}</span>
        <span class="t num">${Wx.fmt.temp(i === 0 && nowTemp != null ? nowTemp : h.temp, U())}°</span>
        ${windCell(h)}${i === 0 && nowMeasured ? `<span class="meas">measured</span>` : ""}
      </button>${sun}`;
    }).join("");
    const said = Wx.summary(fc, nowSec(), k, (c) => Wx.fmt.temp(c, U()), (w) => Wx.fmt.wind(w, U()), Wx.UNITS[U()].wind);
    let detail = "";
    const h = S.selected && hours.find((x) => x.t === S.selected);
    if (h) {
      const u = Wx.UNITS[U()];
      const row = (l, v) => v == null || v === "" ? "" : `<div><span>${l}</span><b class="num">${v}</b></div>`;
      detail = `<div class="hourdetail" aria-live="polite">
        <div class="head">${esc(k.dayLong(h.t * 1000))}, ${esc(k.time(h.t * 1000))} — ${esc(Wx.condition(h.code).text)}</div>
        ${row("Feels like", h.feels != null ? deg(h.feels) : null)}
        ${row("Dew point", h.dew != null ? deg(h.dew) : null)}
        ${row("Humidity", h.rh != null ? Math.round(h.rh) + "%" : null)}
        ${row("Chance of rain", h.pop != null ? Math.round(h.pop) + "%" : null)}
        ${row("Rain", h.precip != null ? Wx.fmt.precip(h.precip, U()) + " " + u.precip : null)}
        ${row("Wind", h.wind != null ? `${Wx.compass(h.windDir)} ${Wx.fmt.wind(h.wind, U())} ${u.wind}` : null)}
        ${row("Gusts", h.gust != null ? Wx.fmt.wind(h.gust, U()) + " " + u.wind : null)}
        ${row("Cloud", h.cloud != null ? Math.round(h.cloud) + "%" : null)}
        ${row("Visibility", h.vis != null ? Wx.fmt.dist(h.vis, U()) + " " + u.dist : null)}
        ${row("Pressure", h.pressure != null ? Wx.fmt.pressure(h.pressure, U()) + " " + u.pressure : null)}
        ${row("UV index", h.uv != null ? Math.round(h.uv) : null)}
      </div>`;
    }
    const scroll = box.querySelector(".hours") ? box.querySelector(".hours").scrollLeft : 0;
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l2.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Hourly<span class="src">tap an hour · wind in ${esc(Wx.UNITS[U()].wind)} · ${PRO ? "model" : "forecast"}</span></h2>
      ${said ? `<p class="summary">${esc(said)}</p>` : ""}<div class="hours">${strip}</div>${detail}`;
    box.querySelector(".hours").scrollLeft = scroll;
  }

  /* Cold to hot, for the bars: the same scale every day so a week reads at a glance. */
  const tempColor = (c) => {
    const stops = [[-15, [120, 160, 255]], [0, [110, 200, 255]], [10, [120, 230, 190]], [20, [255, 214, 102]], [30, [255, 146, 76]], [40, [255, 90, 90]]];
    if (c <= stops[0][0]) return `rgb(${stops[0][1]})`;
    for (let i = 1; i < stops.length; i++) {
      if (c <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (c - a) / (b - a);
        return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * f))})`;
      }
    }
    return `rgb(${stops.at(-1)[1]})`;
  };

  /* One day as a picture: the temperature through the day, the chance of rain
     under it, a mark at now. Small, and only drawn when the day is opened. */
  function dayChart(fc, d) {
    const k = clk();
    const hs = fc.hourly.filter((h) => h.t >= d.t && h.t <= d.t + 86400 && h.temp != null);
    if (hs.length < 12) return "";
    const W = 320, H = 132, top = 18, bot = 96, x0 = 6, x1 = W - 6;
    const ts = hs.map((h) => h.temp), lo = Math.min(...ts), hi = Math.max(...ts), pad = Math.max(1, (hi - lo) * 0.15);
    const X = (t) => x0 + (t - d.t) / 86400 * (x1 - x0), Y = (v) => bot - (v - lo + pad) / (hi - lo + 2 * pad) * (bot - top);
    const line = hs.map((h) => `${X(h.t).toFixed(1)},${Y(h.temp).toFixed(1)}`).join(" ");
    const area = `${X(hs[0].t).toFixed(1)},${bot} ${line} ${X(hs.at(-1).t).toFixed(1)},${bot}`;
    const bars = hs.filter((h) => h.pop >= 5).map((h) => `<rect x="${(X(h.t) - 4).toFixed(1)}" y="${(H - 14 - h.pop / 100 * 22).toFixed(1)}" width="8" height="${(h.pop / 100 * 22).toFixed(1)}" rx="2" fill="#7cc4ff" opacity=".85"/>`).join("");
    const iHi = ts.indexOf(hi), iLo = ts.indexOf(lo);
    const mark = (h, label) => `<circle cx="${X(h.t).toFixed(1)}" cy="${Y(h.temp).toFixed(1)}" r="3.5" fill="#fff"/><text x="${Math.min(x1 - 14, Math.max(x0 + 14, X(h.t))).toFixed(1)}" y="${(Y(h.temp) - 7).toFixed(1)}" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">${label}</text>`;
    const nowS = nowSec(), nowMark = nowS > d.t && nowS < d.t + 86400 ? `<line x1="${X(nowS).toFixed(1)}" x2="${X(nowS).toFixed(1)}" y1="${top - 6}" y2="${H - 14}" stroke="rgba(255,255,255,.6)" stroke-dasharray="3 3"/>` : "";
    const ticks = [0, 6, 12, 18].map((hh) => `<text x="${X(d.t + hh * 3600).toFixed(1)}" y="${H - 1}" font-size="11" fill="rgba(255,255,255,.75)">${esc(k.hour((d.t + hh * 3600) * 1000))}</text>`).join("");
    return `<svg class="daychart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Temperature through the day, from ${deg(lo)} to ${deg(hi)}, with the chance of rain each hour">
      <defs><linearGradient id="dg${d.t}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd166" stop-opacity=".45"/><stop offset="1" stop-color="#7cc4ff" stop-opacity=".05"/></linearGradient></defs>
      <polygon points="${area}" fill="url(#dg${d.t})"/><polyline points="${line}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
      ${bars}${nowMark}${mark(hs[iHi], "H " + deg(hi))}${iLo !== iHi ? mark(hs[iLo], "L " + deg(lo)) : ""}${ticks}</svg>`;
  }

  function renderDaily() {
    const box = $("#daily");
    const fc = shown();
    if (!box || !fc) return;
    const k = clk();
    const days = Wx.upcomingDays(fc, nowSec()).filter((d) => d.hi != null && d.lo != null).slice(0, 10);
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.day));
    const lo = Math.min(...days.map((d) => d.lo)), hi = Math.max(...days.map((d) => d.hi));
    const span = Math.max(1, hi - lo);
    const cur = Wx.currentConditions(fc, S.obs || null).temp.v;
    const periods = S.office ? S.office.periods : [];
    const u = Wx.UNITS[U()];
    const vy = Wx.versusYesterday(fc, nowSec());
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5"/></svg>${days.length}-day forecast<span class="src">${PRO ? `model${periods.length ? " + NWS words" : ""}` : `forecast${periods.length ? " + local forecaster's notes" : ""}`}</span></h2>` +
      days.map((d, i) => {
        const ms = d.t * 1000 + 12 * 3600e3;
        const c = Wx.condition(d.code);
        const left = (d.lo - lo) / span * 100, width = (d.hi - d.lo) / span * 100;
        const dot = i === 0 && cur != null ? `<b style="left:${Math.min(100, Math.max(0, (cur - lo) / span * 100))}%"></b>` : "";
        const ymd = k.ymd(ms);
        const words = periods.filter((p) => k.ymd(p.start + 3600e3) === ymd);
        const cf = S.ens ? Wx.dayConfidence(S.ens, d.t) : null;
        return `<details class="day" data-day="${d.t}"${open.has(String(d.t)) ? " open" : ""}>
          <summary>
            <span class="dn">${i === 0 ? "Today" : esc(k.day(ms))}${cf ? `<i class="cdot" data-l="${cf.level}" title="${esc(confWords(cf))}"></i>` : ""}</span>
            ${icon(c.kind, true, c.text)}
            <span class="pp">${d.pop >= 20 ? Math.round(d.pop) + "%" : ""}</span>
            <span class="lo num">${Wx.fmt.temp(d.lo, U())}°</span>
            <span class="range"><i style="left:${left}%;width:${Math.max(width, 3)}%;background:linear-gradient(90deg,${tempColor(d.lo)},${tempColor(d.hi)})"></i>${dot}</span>
            <span class="hi num">${Wx.fmt.temp(d.hi, U())}°</span>
          </summary>
          <div class="daybody">
            <div class="facts">
              <span>${esc(c.text)}</span>
              ${d.precip != null ? `<span>Rain <b class="num">${Wx.fmt.precip(d.precip, U())} ${u.precip}</b></span>` : ""}
              ${d.wind != null ? `<span>Wind <b class="num">${Wx.compass(d.windDir)} ${Wx.fmt.wind(d.wind, U())}</b>${d.gust != null ? ` gusts <b class="num">${Wx.fmt.wind(d.gust, U())} ${u.wind}</b>` : ""}</span>` : ""}
              ${d.uv != null ? `<span>UV <b class="num">${Math.round(d.uv)}</b></span>` : ""}
              ${d.sunrise ? `<span>Sun <b class="num">${esc(k.time(d.sunrise * 1000))}–${esc(k.time(d.sunset * 1000))}</b></span>` : ""}
            </div>
            ${dayChart(fc, d)}
            ${i === 0 && vy ? `<p class="confsay">${esc(vyText(vy))}</p>` : ""}
            ${cf ? `<p class="confsay" data-l="${cf.level}">${esc(confWords(cf))}</p>` : ""}${d.blended ? `<p class="confsay">High and low from ${esc(shownName())} — the forecast with the best record near here.</p>` : ""}
            ${words.length ? `<div class="office"><h3>Forecast office ${esc(S.pt && S.pt.office || "")}</h3>${words.map((p) => `<p><b>${esc(p.name)}:</b> ${esc(p.detailed || p.short)}</p>`).join("")}</div>` : ""}
          </div>
        </details>`;
      }).join("") +
      /* on Weather the dots say what they mean (2026-10-23) */
      (!PRO && S.ens ? `<p class="dotkey"><i class="cdot" data-l="high"></i>confident <i class="cdot" data-l="medium"></i>fairly sure <i class="cdot" data-l="low"></i>less sure — how far the forecasts agree; tap a day for more</p>` : "");
  }

  function renderTiles() {
    const fc = shown();
    if (!$("#t-wind") || !fc) return;
    const c = Wx.currentConditions(fc, S.obs || null);
    const u = Wx.UNITS[U()];
    const k = clk();
    const now = nowSec();
    const hr = fc.hourly[Wx.hourIndex(fc.hourly, now)] || {};
    const today = Wx.upcomingDays(fc, now)[0] || {};
    const srcTag = (src) => src === "obs" ? `<span class="tag">${PRO ? "station" : "measured"}</span>` : src === "derived" ? `<span class="tag">${PRO ? "computed" : "worked out"}</span>` : src === "history" ? `<span class="tag">past years</span>` : `<span class="tag">${PRO ? "model" : "forecast"}</span>`;
    const head = (svg, t, src) => `<h2>${svg}${t}<span class="src">${src ? srcTag(src) : ""}</span></h2>`;

    /* calm has no direction: a station reports 0° with 0 wind, and an arrow
       pointing north would say something that isn't so */
    const calm = Wx.isCalm(c.wind.v);
    const dir = calm ? null : c.windDir.v;
    const gust = c.gust.v != null && c.gust.src === c.wind.src ? c.gust.v : null;
    $("#t-wind").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 5.5h8a2 2 0 1 0-2-2M1.5 8.5h11a2 2 0 1 1-2 2M1.5 11.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', "Wind", c.wind.src) + `
      <div class="dial">
        <svg viewBox="0 0 74 74" role="img" aria-label="${calm ? "Calm" : dir != null ? "From the " + Wx.compass(dir) : "Direction unknown"}">
          <circle cx="37" cy="37" r="33" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"/>
          <text x="37" y="13" text-anchor="middle" font-size="11" fill="#fff" font-weight="600">N</text>
          ${dir != null ? `<g transform="rotate(${dir + 180} 37 37)"><path d="M37 8l6 14h-12z" fill="#fff"/><line x1="37" y1="20" x2="37" y2="62" stroke="#fff" stroke-width="2.5"/></g>` : calm ? `<circle cx="37" cy="37" r="5" fill="none" stroke="#fff" stroke-width="2"/>` : ""}
        </svg>
        <div><div class="big num">${calm ? "Calm" : `${Wx.fmt.wind(c.wind.v, U())} <small style="font-size:15px">${u.wind}</small>`}</div>
        <div class="say">${dir != null ? `From the <b>${Wx.compass(dir)}</b>` : calm ? "No steady wind" : ""}${gust != null ? `<br>Gusts <b class="num">${Wx.fmt.wind(gust, U())} ${u.wind}</b>` : ""}</div></div>
      </div>`;

    const dewF = c.dew.v != null ? Wx.cToF(c.dew.v) : null;
    const feel = dewF == null ? "" : dewF < 50 ? "Dry" : dewF < 60 ? "Comfortable" : dewF < 65 ? "A little sticky" : dewF < 70 ? "Muggy" : "Oppressive";
    $("#t-humid").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>', "Humidity", c.rh.src) + `
      <div class="big num">${c.rh.v != null ? Math.round(c.rh.v) + "%" : "–"}</div>
      <div class="say">Dew point <b class="num">${deg(c.dew.v)}</b>${feel ? ` — ${feel.toLowerCase()}` : ""}</div>`;

    const tr = Wx.pressureTrend(fc, now);
    $("#t-press").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 11a5.5 5.5 0 1 1 11 0" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 11l3-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', "Pressure", c.pressure.src) + `
      <div class="big num">${Wx.fmt.pressure(c.pressure.v, U())} <small style="font-size:15px">${u.pressure}</small></div>
      <div class="say">${tr ? `<b>${tr.word[0].toUpperCase() + tr.word.slice(1)}</b> over 3 hours (${PRO ? "model" : "forecast"})` : ""}</div>`;

    const vis = c.vis.v != null ? c.vis : { v: hr.vis, src: "model" };
    $("#t-vis").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>', "Visibility", vis.v != null ? vis.src : null) + `
      <div class="big num">${vis.v != null ? Wx.fmt.dist(vis.v, U()) + ` <small style="font-size:15px">${u.dist}</small>` : "–"}</div>
      <div class="say">Cloud cover <b class="num">${fc.current.cloud != null ? Math.round(fc.current.cloud) + "%" : "–"}</b></div>`;

    const uv = hr.uv;
    const uvWord = uv == null ? "" : uv < 3 ? "Low" : uv < 6 ? "Moderate" : uv < 8 ? "High" : uv < 11 ? "Very high" : "Extreme";
    $("#t-uv").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', "UV index", uv != null ? "model" : null) + `
      <div class="big num">${uv != null ? Math.round(uv) : "–"}</div>
      <div class="say">${uvWord ? `<b>${uvWord}</b> now` : ""}${today.uv != null ? ` · peak ${Math.round(today.uv)} today` : ""}</div>`;

    const rt = Wx.rainTotals(fc, now);
    $("#t-rain").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="currentColor"/></svg>', "Rain", "model") + `
      <div class="dial" style="gap:28px">
        <div><div class="say">Last 24 hours</div><div class="big num">${rt.past != null ? Wx.fmt.precip(rt.past, U()) : "–"} <small style="font-size:15px">${u.precip}</small></div></div>
        <div><div class="say">Next 24 hours</div><div class="big num">${rt.next != null ? Wx.fmt.precip(rt.next, U()) : "–"} <small style="font-size:15px">${u.precip}</small></div></div>
      </div>${S.obs && S.obs.precipHour != null && S.obs.precipHour > 0 ? `<div class="say">The station measured <b class="num">${Wx.fmt.precip(S.obs.precipHour, U())} ${u.precip}</b> in its last hour.</div>` : ""}`;

    /* the next of the two, big; the other one and the length of the day under it */
    const sunSay = (() => {
      if (!today.sunrise || !today.sunset) return { big: "–", say: "" };
      const t = (s) => `<b class="num">${esc(k.time(s * 1000))}</b>`;
      const tomorrow = Wx.upcomingDays(fc, now)[1];
      const len = (d) => d && d.sunrise && d.sunset ? d.sunset - d.sunrise : null;
      const hm = (s) => `${Math.floor(s / 3600)} h ${Math.round(s % 3600 / 60)} min`;
      const yday = fc.daily.find((d) => Math.abs(d.t - (today.t - 86400)) < 7200);
      const dl = len(today), dy = len(yday);
      const diff = dl != null && dy != null ? Math.round((dl - dy) / 60) : null;
      const day = dl != null ? `<br>Daylight <b class="num">${hm(dl)}</b>${diff ? ` · ${Math.abs(diff)} min ${diff > 0 ? "more" : "less"} than yesterday` : ""}` : "";
      if (now < today.sunrise) return { big: k.time(today.sunrise * 1000), say: `<b>Sunrise</b> · sets ${t(today.sunset)}${day}` };
      if (now < today.sunset) return { big: k.time(today.sunset * 1000), say: `<b>Sunset</b> · rose ${t(today.sunrise)}${day}` };
      if (tomorrow && tomorrow.sunrise) return { big: k.time(tomorrow.sunrise * 1000), say: `<b>Sunrise tomorrow</b> · set ${t(today.sunset)} today${day}` };
      return { big: k.time(today.sunset * 1000), say: `<b>Sunset</b>${day}` };
    })();
    $("#t-sun").innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 12h14M4 12a4 4 0 0 1 8 0M8 3v2M3 6l1.2 1.2M13 6l-1.2 1.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', "Sun", today.sunrise ? "model" : null) + `
      <div class="big num">${esc(sunSay.big)}</div>
      <div class="say">${sunSay.say}</div>`;

    /* air quality: the US AQI, the EPA's word for it and the EPA's advice — a
       model's estimate (CAMS, via Open-Meteo), labelled a forecast */
    const airEl = $("#t-air");
    if (airEl) {
      const a = S.air;
      airEl.hidden = !a;
      if (a) airEl.innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 6h8.5a2 2 0 1 0-2-2M1.5 9.5h11a2 2 0 1 1-2 2M1.5 13h6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>', "Air quality", "model") + `
        <div class="big num">${a.aqi} <small style="font-size:15px">${esc(a.word)}</small></div>
        <div class="aqibar" aria-hidden="true"><b style="left:${Math.min(100, a.aqi / 3)}%"></b></div>
        <div class="say">${esc(a.advice)}</div>`;
    }
    /* today against the usual for this date here (1991–2020) */
    const avgEl = $("#t-avg");
    if (avgEl) {
      /* the date at the place, not in this browser's timezone */
      const ymd = today.t ? clk().ymd(today.t * 1000 + 12 * 3600e3).split("-").map(Number) : null;
      const nm = S.norm, idx = nm && ymd ? Wx.dayOfYear(ymd[1], ymd[2]) : -1;
      const uh = idx >= 0 ? nm.hi[idx] : null, ul = idx >= 0 ? nm.lo[idx] : null;
      avgEl.hidden = uh == null || today.hi == null;
      if (!avgEl.hidden) {
        /* the difference of the two numbers on screen, so the sentence never contradicts itself */
        const diff = (a, b) => Number(Wx.fmt.temp(a, U())) - Number(Wx.fmt.temp(b, U()));
        const dh = diff(today.hi, uh), dl = today.lo != null && ul != null ? diff(today.lo, ul) : null;
        const word = (n) => n === 0 ? "about usual" : `${Math.abs(n)}° ${n > 0 ? "above" : "below"} average`;
        avgEl.innerHTML = head('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12l4-4 3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>', "Averages", "history") + `
          <div class="big num">${dh > 0 ? "+" : dh < 0 ? "−" : ""}${Math.abs(dh)}°</div>
          <div class="say">Today's high <b class="num">${deg(today.hi)}</b> is ${word(dh)} (usual <b class="num">${deg(uh)}</b>)${dl != null ? `.<br>Low <b class="num">${deg(today.lo)}</b>, usual <b class="num">${deg(ul)}</b>` : ""}.</div>`;
      }
    }
  }

  /* §25 and §37: every feed, how old, and whether it is answering. */
  function renderSources() {
    const now = Date.now();
    const rows = [];
    const row = (state, title, sub, at) => rows.push(`<div class="feed"><i class="${state}"></i><div class="what"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div><div class="age">${at ? `<span data-age="${at}">${Wx.age(now - at)}</span> ago` : ""}</div></div>`);
    if (!S.place) {
      if (S.national) row("", `Warnings — ${S.national.length} active`, "National Weather Service · checked", S.checked.national);
      else row("off", "Warnings", S.national === undefined ? "asking…" : "not answering", null);
    } else {
      const us = inUS();
      if (S.obs) {
        const f = Wx.fresh("observation", S.obs.time);
        row(f.stale ? "stale" : "", `Station ${esc(S.obs.station)}${f.stale ? " — delayed" : ""}`, `${esc(S.obs.stationName)}${S.obs.dist != null ? " · " + Wx.fmt.dist(S.obs.dist, U()) + " " + Wx.UNITS[U()].dist + " away" : ""} · observation`, S.obs.time);
      } else row("off", "Station observation", S.pt === undefined || S.obs === undefined ? "asking…" : us ? "no recent report nearby — showing the model" : "NWS stations cover the US only", null);
      if (S.fc) row(S.fcStale ? "stale" : "", `Forecast model${S.fcStale ? " — offline copy" : ""}`, `Open-Meteo best match (NOAA HRRR/GFS in the US) · fetched ${S.fc.via === "worker" ? "through this site" : S.fc.via === "direct" ? "directly" : "earlier"}`, S.fc.fetchedAt);
      else row("off", "Forecast model", S.err.fc ? "not answering" : "asking…", null);
      if (S.office) {
        const f = Wx.fresh("forecast", S.office.updated);
        row(f.stale ? "stale" : "", `NWS forecast office ${esc(S.pt && S.pt.office || "")}`, "the office's own words, under each day · updated", S.office.updated);
      } else row("off", "NWS forecast office", S.office === undefined ? "asking…" : us ? "not answering" : "US only", null);
      if (S.alerts && S.alertsVia === "iem") row("stale", `Storm warnings — ${S.alerts.length ? S.alerts.length + " in force here" : "none here"}`, "the NWS did not answer: Iowa State's copy of its storm warnings (no watches or county-wide alerts) · checked", S.checked.alerts);
      else if (S.alerts) row("", `Alerts — ${S.alerts.length ? S.alerts.length + " active here" : "none here"}`, "National Weather Service · checked", S.checked.alerts);
      else row("off", "Alerts", S.alerts === undefined ? "asking…" : us ? "could not be checked" : "US only", null);
    }
    if (S.outlook) {
      const o = S.outlook[0];
      row("", "SPC convective outlook, day 1", `Storm Prediction Center${o && o.forecaster ? " · " + esc(o.forecaster) : ""} · issued`, o ? o.issued : S.checked.outlook);
    } else row("off", "SPC convective outlook", S.outlook === undefined ? "asking…" : "not answering", null);
    if (S.place && S.now) row("", "Radar nowcast — this site's own", "the last half hour of the IEM mosaic, carried forward in this browser · from the scan", S.now.valid);
    if (S.place && S.air) row("", "Air quality", "Open-Meteo's air-quality model (CAMS) · US AQI and the EPA's words · for the hour", S.air.time);
    if (S.place && S.norm) row("", "Averages", `ERA5 reanalysis for this spot, ${esc(S.norm.years || "1991–2020")} · the mean of the fifteen days around each date · worked out`, S.norm.at);
    const rv = radar.valid;
    if (radar.mode === "replay") {
      const rp = radar.replay;
      row("", "Radar replay — archive", rp ? `NEXRAD mosaic (${Wx.archiveProduct(rp.from)}) and storm warnings as they stood, ${esc(dayFmtPage(rp.from))}, via IEM` : "", null);
    } else if (radar.mode === "hrrr") {
      const old = rv && Date.now() - rv > 3 * 3600e3;
      if (rv) row(old ? "stale" : "", `HRRR forecast radar${old ? " — run is late" : ""}`, "simulated reflectivity, the latest run, via IEM · run", rv);
      else row("off", "HRRR forecast radar", "not answering", null);
    } else if (radar.mode === "abi") {
      if (rv) row(Date.now() - rv > 20 * 60e3 ? "stale" : "", `Satellite — ${esc(radar.describe())}`, "GOES ABI cloud and moisture imagery, NOAA open data on AWS · newest image", rv);
      else row("off", "Satellite (GOES)", "asking NOAA…", null);
    } else if (radar.mode === "mrms") {
      if (rv) row(Date.now() - rv > 30 * 60e3 ? "stale" : "", `MRMS — ${esc(radar.describe())}`, "every NEXRAD blended by NOAA · newest file", rv);
      else row("off", "MRMS", "asking NOAA…", null);
    } else if (radar.mode === "model") {
      if (rv) row("", `Model map — ${esc(radar.describe())}`, radar.analysis === "server" ? "the RAP's one-hour forecast and NOAA's RTMA, computed hourly · newest" : radar.analysis ? "the HRRR analysis hour, NOAA open data on AWS · newest" : "a forecast, from the run's own files · run", rv);
      else row("off", "Model map", "asking NOAA for the latest run…", null);
    } else if (rv) {
      const f = Wx.fresh("radar", rv);
      if (radar.mode === "comp" && radar.backup) row("stale", "Radar — NOAA's backup mosaic", `Iowa State's mosaic is ${radar.iemValid ? Wx.age(Date.now() - radar.iemValid) + " behind" : "not answering"}, so the map shows NOAA's own (MRMS base reflectivity, from NOAA's map server) · latest`, rv);
      else row(f.stale ? "stale" : "", `Radar${f.stale ? " — delayed" : ""}`, `${esc(radar.describe())} · latest scan`, rv);
    } else row("off", "Radar", radar.started ? "scan time unknown" : "loads when you reach it", null);
    const pro = radar.pro;
    if (pro && pro.ov.tropics) row(pro.tErr ? "off" : "", "Tropics", pro.tropics ? `NHC's storms and outlook, via NOAA's map service · ${pro.tropics.storms.length} active · checked` : pro.tErr ? "NHC did not answer" : "asking…", pro.tropics ? pro.tropics.at : null);
    if (pro && pro.ov.watches && pro.wGot) row("", `Watches and discussions — ${pro.watches.length} watch${pro.watches.length === 1 ? "" : "es"}, ${pro.mcds.length + pro.mpds.length} discussion${pro.mcds.length + pro.mpds.length === 1 ? "" : "s"}`, "SPC and WPC, via IEM · checked", pro.wGot);
    if (pro && pro.ov.cells && pro.cGot) row("", `Storm cells — ${pro.cells.length}`, "every NEXRAD's own storm-tracking table, via IEM · checked", pro.cGot);
    if (pro && pro.ov.reports && pro.rGot) row("", `Storm reports — ${pro.reports.filter((r) => r.severe).length} severe, ${pro.reports.length} in all`, "the NWS's local storm reports, last 24 hours, via IEM · checked", pro.rGot);
    const lt = radar.lightning;
    if (lt) row(lt.failed ? "off" : "", `Lightning — ${lt.n} flash${lt.n === 1 ? "" : "es"} in 20 minutes`, lt.failed ? "the GOES lightning mappers did not answer" : "GOES-East and GOES-West lightning mappers, NOAA open data on AWS · checked", lt.at);
    if (pro && pro.ov.fronts && pro.surface) row(Date.now() - (pro.surface.valid || 0) > 6 * 3600e3 ? "stale" : "", "Surface analysis — fronts, highs, lows", "WPC's coded analysis, via the NWS · valid", pro.surface.valid);
    if (S.afd) row("", `Forecast discussion — NWS ${esc(S.afd.office || "")}`, "the forecasters' own words · issued", S.afd.issued);
    const stn = radar.stations;
    if (stn) row("", `Stations on the map — ${stn.n} airport stations`, "ASOS readings via IEM, the forecast offices in view · newest reading", stn.newest);
    if (radar.sat) row("", "Satellite — GOES-East and GOES-West", `${esc(Wx.SAT[radar.sat].label.toLowerCase())}, via IEM · the latest image; its scan time does not come with the map`, null);
    if (S.place && S.rec && S.rec.index) row("", "Scoreboard", `every model vs ${Object.keys(S.rec.index.stations || {}).length.toLocaleString()} US airport stations · scored through ${esc(S.rec.index.through || "")} · published`, Date.parse(S.rec.index.generated) || null);
    if (S.ens) row("", "Model agreement", "NBM, HRRR, GFS, ECMWF and ECMWF AI, via Open-Meteo", S.fc ? S.fc.fetchedAt : null);
    if (S.place && S.plumes) row("", `Ensemble — ${S.plumes.members.length} runs`, "GEFS and ECMWF ENS, every member, via Open-Meteo · fetched", S.plumesAt);
    if (sky.source) row(sky.source.stale ? "stale" : "", esc(sky.source.title), esc(sky.source.sub), sky.source.at);
    const srcHead = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 13V9M6 13V6M10 13V3M14 13V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Where this comes from`;
    /* on Weather the list of feeds starts folded: there for anyone who asks, out of everyone else's way */
    if (!PRO) {
      const was = $("#sources").querySelector("details");
      $("#sources").innerHTML = `<details class="srcfold"${was && was.open ? " open" : ""}><summary><h2>${srcHead}<span class="src">tap to see</span></h2></summary><div class="feeds">${rows.join("")}</div></details>`;
    } else $("#sources").innerHTML = `<h2>${srcHead}</h2><div class="feeds">${rows.join("")}</div>`;
  }

  /* Ages tick on their own; nothing else needs redrawing for that. */
  setInterval(() => {
    for (const el of document.querySelectorAll("[data-age]")) el.textContent = Wx.age(Date.now() - Number(el.dataset.age));
  }, 15000);

  /* ── radar ──
     A small slippy map, no library: OpenStreetMap underneath (darkened), a
     radar layer on top as a stack of frames, and the place, warning polygons,
     storm tracks and SPC's outlook drawn over both. Three layers:
       comp  the NEXRAD US mosaic, every 5 minutes for the last 50
       N0B   one radar site's super-resolution reflectivity, every scan in the last hour
       N0S   the same site's storm-relative velocity
     Weather Pro adds, all read in this browser from NOAA's own files:
       l3:*  one site's Level III products at four tilts — reflectivity,
             velocity, storm-relative velocity, CC, ZDR, KDP, the hydrometeor
             class, echo tops, VIL (nexrad.js)
       model HRRR and GFS fields hour by hour (modelmaps.js, grib2.js)
     and two overlays: GOES lightning (glm.js) and the NWS's storm reports.
     The site is the nearest NEXRAD to the middle of the map, and follows it.
     It loads only when it scrolls into view. */
  const radar = (() => {
    const TILE = 256, MINZ = 3, MAXZ = 11;
    const el = $("#radar"), baseL = $("#radarbase"), framesL = $("#radarframes"), over = $("#radarover");
    const R = { z: 7, cx: 0, cy: 0, lat: null, lon: null, frame: 0, playing: false, timer: 0, started: false, visible: false,
      mode: "comp", valid: null, frames: [], loadedOld: false, site: null, sites: null, outlook: false, us: false, frameT: null, sat: null, pin: null,
      stations: PRO && store.get("wx:stations", false) === true, obs: [],   // stations are Pro's, off until asked for
      /* Weather's map is rain and nothing else until asked (2026-10-23, Ric: "It
         should just be rain and there should be a setting that does overlays"):
         its layers menu keeps the choices in this browser. Warnings start on —
         they are the one thing on the map that can matter to someone's safety —
         and can be turned off like the rest. */
      wl: PRO ? null : Object.assign({ warn: true, outlook: false, temps: true, clouds: false }, store.get("wx:maplayers", {})),
      /* Pro's overlays, each the visitor's own choice in this browser */
      /* Pro opens on watches and its own map lines; the rest is a tap away
         (2026-10-23: five overlays at once was a busy first look). Warnings
         are always drawn. */
      ov: PRO ? Object.assign({ lines: true, watches: true, cells: false, fronts: false, lightning: false, density: false, reports: false, rings: false, tropics: false, terrain: false }, store.get("wx:ov", {})) : { lines: false, watches: false, cells: false, fronts: false, lightning: false, density: false, reports: false, rings: false, tropics: false },
      /* the flash density window, in minutes */
      densWin: [1, 5, 10, 20].includes(Number(store.get("wx:denswin", 5))) ? Number(store.get("wx:denswin", 5)) : 5,
      pro: { watches: [], mcds: [], mpds: [], cells: [], surface: null, reports: [], tropics: null }, measure: null,
      /* Pro's choice of SPC outlook (2026-10-23: days 1–8, tornado, wind, hail), and the sets loaded */
      olSel: PRO && Wx.OUTLOOKS && Wx.OUTLOOKS[store.get("wx:outlooksel", "")] ? store.get("wx:outlooksel", "d1:cat") : "d1:cat", olData: {},
      /* Pro's own radar and model maps: the tilt (0 is the lowest scan) and the model field, each kept in this browser */
      tilt: Math.min(3, Math.max(0, Number(store.get("wx:tilt", 0)) || 0)),
      /* the full volume (Level II) instead of Level III, and its tilt by angle */
      mr: { prod: store.get("wx:mrms", "rot60") },
      /* GOES imagery (abi.js): the product, the sector, and the satellite (auto picks by the map's middle) */
      ab: { prod: store.get("wx:abi", "b13"), sector: store.get("wx:abisec", "conus"), sat: store.get("wx:abisat", "auto") },
      l2: store.get("wx:l2", false) === true, l2angle: Number(store.get("wx:l2angle", 0.5)), l2vol: null,
      /* `back` is how many runs before the latest is on the map — 0 is the latest (a choice for this visit, not kept) */
      mm: { src: store.get("wx:mmsrc", "hrrr"), field: store.get("wx:mmfield", "refc"), run: null, back: 0, pin: null, newest: null, diff: "" } };
    const NX = PRO ? window.Nexrad : null, MM = PRO ? window.ModelMaps : null, GL = PRO ? window.Glm : null, GB = PRO ? window.Grib2 : null, L2 = PRO ? window.Level2 : null, MR = PRO ? window.Mrms : null, AB = PRO ? window.Abi : null;
    if (MM && !MM.SOURCES[R.mm.src]) R.mm.src = "hrrr";
    if (MM && !MM.field(R.mm.src, R.mm.field)) R.mm.field = MM.FIELDS[R.mm.src][0].id;
    /* a label inside a sentence: its first letter lowered, abbreviations (MESH, MSLP, CC) kept */
    const lc = (t) => (/^[A-Z]{2}/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
    /* a Level III mode ("l3:cc") → its product, or null */
    const l3 = (m = R.mode) => (NX && typeof m === "string" && m.startsWith("l3:") && NX.PRODUCTS[m.slice(3)]) || null;
    /* read this product from the full volume? — when the visitor asked for it,
       or when Level III does not carry it at all (spectrum width) */
    const useL2 = (m = R.mode) => { const P = l3(m); return !!(P && L2 && P.l2 && (R.l2 || !P.tilts.length)); };
    const lngX = (lng, z) => (lng + 180) / 360 * TILE * 2 ** z;
    const latY = (lat, z) => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z; };
    const xLng = (x, z) => x / (TILE * 2 ** z) * 360 - 180;
    const yLat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (TILE * 2 ** z)))) * 180 / Math.PI;
    const bucket = () => Math.floor(Date.now() / 120e3);
    const baseTiles = new Map();
    /* satellite under the radar: GOES-West first, East over it (Wx.SAT).
       IEM refreshes the image every few minutes; the tiles are re-asked
       every five. */
    const satL = $("#radarsat"), sats = [];
    const satBucket = () => Math.floor(Date.now() / 300e3);
    let satAt = satBucket();

    /* a recoloured rain tile is a blob URL: it is let go of with the tile */
    const dropTile = (img) => { if (img.dataset.rain) URL.revokeObjectURL(img.src); img.remove(); };
    function clearTiles() {
      for (const c of [baseTiles, ...sats.map((s) => s.tiles), ...R.frames.map((f) => f.tiles)]) { for (const img of c.values()) dropTile(img); c.clear(); }
    }
    function setSat(kind) {
      R.sat = Wx.SAT[kind] ? kind : null;
      /* Pro's underlay choice; Weather's clouds live in its own layers menu (wx:maplayers) */
      if (PRO) store.set("wx:sat", R.sat);
      for (const s of sats) for (const img of s.tiles.values()) img.remove();
      satL.innerHTML = ""; sats.length = 0;
      if (R.sat) for (const layer of Wx.SAT[R.sat].layers) {
        const d = document.createElement("div");
        d.className = "layer";
        satL.appendChild(d);
        sats.push({ el: d, layer, tiles: new Map() });
      }
      document.querySelectorAll("[data-sat]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.sat || null) === R.sat)));
      if ($("#satsel")) $("#satsel").value = R.sat || "";             // Pro's is a list, to keep a row of buttons off the map
      $("#satcredit").hidden = !R.sat;
      label(); draw(); renderSources();
    }
    /* ── the underlay at the radar's own time (Pro, 2026-10-22) ──
       IEM's satellite tiles are the latest image only (its WMS ignores a
       time), so a loop stepped back, or a replay, sat on the clouds of now.
       When the frame on screen is more than ten minutes old, the underlay is
       GOES's own image nearest that moment instead — the lower-48 file the
       GOES layer reads, in the band the underlay names — and the latest
       tiles step aside. Back to 2018, when the satellites with these files
       took their posts (abi.js's POSTS). */
    const SAT_BAND = { ir: "b13", vis: "b02", wv: "b09" };
    const pastSat = { el: null, f: null, want: null, gen: 0, t: null, none: false };
    const underlayTime = () => { const t = frameTime(); return t != null && Date.now() - t > 10 * 60e3 ? t : null; };
    function syncPastSat(w, h, left, top) {
      const t = PRO && AB && R.sat && R.mode !== "abi" ? underlayTime() : null;
      if (!pastSat.el && t != null) { pastSat.el = document.createElement("div"); pastSat.el.className = "layer sat"; satL.after(pastSat.el); }
      /* the latest tiles come back only if this hid them (a replay and the GOES layer hide them for their own reasons) */
      if (t == null) { if (pastSat.hid) { satL.hidden = R.mode === "abi" || R.mode === "replay"; pastSat.hid = false; } if (pastSat.el) pastSat.el.hidden = true; pastSat.t = null; pastSat.none = false; return; }
      if (!satL.hidden) { satL.hidden = true; pastSat.hid = true; }
      pastSat.el.hidden = false;
      const side = xLng(R.cx, R.z) >= AB.SPLIT_LON ? "east" : "west", sat = AB.satAt(side, t), slot = Math.round(t / 300e3) * 300e3;
      const want = `${sat}|${slot}|${R.sat}`;
      if (!sat) { pastSat.none = true; pastSat.t = null; if (pastSat.f && pastSat.f.cv) pastSat.f.cv.getContext("2d").clearRect(0, 0, pastSat.f.cv.width, pastSat.f.cv.height); return; }
      pastSat.none = false;
      if (pastSat.want !== want) {
        pastSat.want = want;
        const gen = ++pastSat.gen;
        AB.files(sat, "conus", { nowMs: t + 8 * 60e3, count: 30 }).then((list) => {
          if (gen !== pastSat.gen || !list.length) return null;
          const file = list.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), list[0]), prod = SAT_BAND[R.sat], key = `${file.url}|${prod}`;
          if (!abiCache.has(key)) abiCache.set(key, AB.load(file, prod, { memo: (abiMemo[file.sat + file.sector] = abiMemo[file.sat + file.sector] || {}) }).catch((e) => { abiCache.delete(key); throw e; }));
          return abiCache.get(key).then((L) => {
            if (gen !== pastSat.gen) return;
            const f = pastSat.f || (pastSat.f = { el: pastSat.el });
            f.abi = { prod, file, layer: L }; f.painted = null; pastSat.t = file.t; pastSat.sat = sat;
            draw(); label();
          });
        }).catch(() => { if (gen === pastSat.gen) pastSat.want = null; });
      }
      if (pastSat.f && pastSat.f.abi && pastSat.want === want) paintModel(pastSat.f, w, h, left, top);
    }

    /* ── airport stations on the map (§19.1) ──
       The forecast offices covering the view (the NWS's own answer for the
       middle and four points around it, looked up once per half-degree), and
       each office's ASOS stations from IEM, asked again every five minutes.
       Drawn from zoom 6 in; at the national view they would be a carpet. */
    const STN_MINZ = 6, officeAt = new Map(), byOffice = new Map();
    let stnTimer = 0, stnAsk = 0;
    const cell = (x) => Math.round(x * 2) / 2;
    async function officeOf(lat, lon) {
      const k = `${cell(lat)},${cell(lon)}`;
      if (!officeAt.has(k)) officeAt.set(k, Wx.point(cell(lat), cell(lon)).then((p) => p && p.office).catch(() => { officeAt.delete(k); return null; }));
      return officeAt.get(k);
    }
    function stationsSoon() { clearTimeout(stnTimer); stnTimer = setTimeout(loadStations, 500); if (!PRO) { citiesSoon(); if (R.mode === "comp") ncSoon(); } }
    async function loadStations() {
      if (!R.stations || !R.started || R.z < STN_MINZ) { if (R.obs.length) { R.obs = []; draw(); } label(); return; }
      const ask = ++stnAsk, w = el.clientWidth, h = el.clientHeight;
      const at = (fx, fy) => [yLat(R.cy + (fy - 0.5) * h, R.z), xLng(R.cx + (fx - 0.5) * w, R.z)];
      const pts = [at(0.5, 0.5), at(0.2, 0.2), at(0.8, 0.2), at(0.2, 0.8), at(0.8, 0.8)];
      const offices = [...new Set((await Promise.all(pts.map(([la, lo]) => officeOf(la, lo)))).filter(Boolean))].slice(0, 5);
      await Promise.all(offices.map(async (o) => {
        const have = byOffice.get(o);
        if (have && Date.now() - have.at < 300e3) return;
        try { byOffice.set(o, { at: Date.now(), list: await Wx.stationObs(o, undefined, PRO) }); } catch (e) { if (!have) byOffice.set(o, { at: Date.now() - 240e3, list: [] }); }
      }));
      if (ask !== stnAsk) return;
      /* a replay's stations are the airports as they read then (IEM's ASOS
         archive), never today's: the states come from the offices' own
         networks, the moment from the frame on screen, in 20-minute steps */
      const T = R.mode === "replay" ? frameTime() : null;
      if (T != null) {
        const nets = [...new Set(offices.flatMap((o) => (byOffice.get(o) || { list: [] }).list.map((s) => s.network)).filter((n) => /^[A-Z]{2}_ASOS$/.test(n || "")))].slice(0, 4);
        const slot = Math.round(T / 1200e3) * 1200e3;
        const lists = await Promise.all(nets.map((n) => {
          const k = `${n}|${slot}`;
          if (!pastObs.has(k)) { pastObs.set(k, Wx.stationObsAt(n, slot).catch(() => { pastObs.delete(k); return []; })); if (pastObs.size > 40) pastObs.delete(pastObs.keys().next().value); }
          return pastObs.get(k);
        }));
        if (ask !== stnAsk) return;
        R.obs = lists.flat(); R.obsSlot = slot; R.obsAt = Date.now();
        draw(); label(); renderSources();
        return;
      }
      R.obsSlot = null;
      const seen = new Map();
      for (const o of offices) for (const s of (byOffice.get(o) || { list: [] }).list) if (!seen.has(s.id) || seen.get(s.id).time < s.time) seen.set(s.id, s);
      R.obs = [...seen.values()];
      R.obsAt = Date.now();
      draw(); label(); renderSources();
    }
    const pastObs = new Map();
    /* ── Pro's overlays: SPC watches and discussions, WPC's, storm cells,
       and the surface analysis — each asked again on its own clock ── */
    /* the outlook drawn: Weather's is always day 1's categorical; Pro's the one picked (null while it loads) */
    const SPC_SHORT = { TSTM: "TSTM", MRGL: "MRGL", SLGT: "SLGT", ENH: "ENH", MDT: "MDT", HIGH: "HIGH" };
    function outlookList() {
      if (!PRO || R.olSel === "d1:cat") return S.outlook || null;
      const h = R.olData[R.olSel];
      return h && h.list ? h.list : null;
    }
    async function loadOverlays(force) {
      if (!PRO || !R.started || R.mode === "replay") return;
      const P = R.pro, now = Date.now(), jobs = [];
      if (R.ov.watches && (force || now - (P.wAt || 0) > 120e3)) {
        P.wAt = now;
        jobs.push(Promise.all([Wx.proOverlays.watches().catch(() => P.watches), Wx.proOverlays.mcds().catch(() => P.mcds), Wx.proOverlays.mpds().catch(() => P.mpds)])
          .then(([w, m, d]) => { P.watches = w; P.mcds = m; P.mpds = d; P.wGot = Date.now(); }));
      }
      if (R.ov.cells && (force || now - (P.cAt || 0) > 120e3)) { P.cAt = now; jobs.push(Wx.proOverlays.cells().then((c) => { P.cells = c; P.cGot = Date.now(); }).catch(() => {})); }
      if (R.ov.fronts && (force || now - (P.fAt || 0) > 1800e3)) { P.fAt = now; jobs.push(Wx.surfaceAnalysis().then((s) => { P.surface = s; }).catch(() => {})); }
      if (R.ov.reports && (force || now - (P.rAt || 0) > 120e3)) { P.rAt = now; jobs.push(Wx.proOverlays.reports().then((r) => { P.reports = r; P.rGot = Date.now(); }).catch(() => {})); }
      /* the tropics: NHC's storms and outlook, every ten minutes (advisories come every six hours, intermediates every three) */
      if (R.ov.tropics && (force || now - (P.tAt || 0) > 600e3)) { P.tAt = now; jobs.push(Wx.tropics().then((t) => { P.tropics = t; P.tErr = false; }).catch(() => { P.tErr = true; })); }
      /* the SPC outlook picked, when it is not the day-1 categorical the page already holds */
      if (R.outlook && R.olSel !== "d1:cat") {
        const have = R.olData[R.olSel];
        if (force || !have || now - have.at > 600e3) { const k = R.olSel; jobs.push(Wx.outlookSet(k).then((l) => { R.olData[k] = { at: Date.now(), list: l }; }).catch(() => { R.olData[k] = { at: Date.now(), list: null }; })); }
      }
      if (!jobs.length) return;
      await Promise.all(jobs);
      draw(); label(); renderSources();
    }
    const zoomBottom = () => { const z = el.querySelector(".zoom"); return z ? z.offsetTop + z.offsetHeight + 12 : 220; };
    function cellNear(px, py) {
      const left = R.cx - el.clientWidth / 2, top = R.cy - el.clientHeight / 2;
      let best = null, bd = 16;
      for (const c of R.cellsDrawn || []) {
        const d = Math.hypot(lngX(c.lon, R.z) - left - px, latY(c.lat, R.z) - top - py);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    }
    function reportNear(px, py) {
      const left = R.cx - el.clientWidth / 2, top = R.cy - el.clientHeight / 2;
      let best = null, bd = 14;
      for (const r of R.reportsDrawn || []) {
        const d = Math.hypot(lngX(r.lon, R.z) - left - px, latY(r.lat, R.z) - top - py);
        if (d < bd) { bd = d; best = r; }
      }
      return best;
    }
    function areaAt(lat, lon) {
      if (!R.ov.watches) return null;
      const hit = (x) => x.polys.some((poly) => Wx.inPolygon(lat, lon, poly));
      return R.pro.mcds.find(hit) || R.pro.mpds.find(hit) || R.pro.watches.find(hit) || null;
    }
    function siteNear(px, py) {
      if (!PRO || !single() || !R.sites) return null;
      const left = R.cx - el.clientWidth / 2, top = R.cy - el.clientHeight / 2;
      let best = null, bd = 14;
      for (const s of R.sites.slice(0, 15)) {
        const d = Math.hypot(lngX(s.lon, R.z) - left - px, latY(s.lat, R.z) - top - py);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }
    function stationNear(px, py) {
      const left = R.cx - el.clientWidth / 2, top = R.cy - el.clientHeight / 2;
      let best = null, bd = 22;
      for (const s of R.drawn || []) {
        const d = Math.hypot(lngX(s.lon, R.z) - left - px, latY(s.lat, R.z) - top - py);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }
    function setFrames(list) {
      for (const f of R.frames) for (const img of f.tiles.values()) dropTile(img);
      framesL.innerHTML = "";
      if ($("#radarread")) $("#radarread").hidden = true;
      /* ECMWF's open data is CC BY 4.0: its credit shows whenever its fields are on the map */
      if ($("#eccredit")) $("#eccredit").hidden = !(R.mode === "model" && (R.mm.src === "ecmwf" || R.mm.src === "aifs" || R.mm.src === "ecens"));
      /* the Met Office's licence (CC BY-SA 4.0) asks for its credit whenever its model is drawn */
      if ($("#ukcredit")) $("#ukcredit").hidden = !(R.mode === "model" && R.mm.src === "ukmet");
      R.frames = list.map((f) => {
        const d = document.createElement("div");
        d.className = "layer frame" + (f.future ? " future" : "");
        framesL.appendChild(d);
        return { ...f, el: d, tiles: new Map() };
      });
      R.frame = Math.max(0, R.frames.length - 1);
      R.loadedOld = false;
      $("#scrub").max = String(Math.max(0, R.frames.length - 1));
      draw(); show(R.frame);
    }
    /* one radar site's own products (reflectivity, velocity, the Level III set): the modes that follow a site */
    const single = () => !!Wx.SITE_PRODUCTS[R.mode] || !!l3();

    /* ── replay (§22): the mosaic and the warnings as they were ──
       Frames every 5 minutes for a 2-hour window, every 10 for longer ones;
       each warning drawn only for the minutes its polygon was in force. The
       satellite, the stations and today's warnings are hidden — they are
       now, and a replay is then. A notable storm fits the map to its own
       warnings, so no place is written into this page. */
    const dayFmt = (ms) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", ...(UTC ? { timeZone: "UTC" } : {}) }).format(ms);
    const timeFmt = (ms) => UTC ? Wx.clock("UTC", true).time(ms) : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(ms);
    async function replay(from, hours, fitToStorms) {
      R.mode = "replay"; if (R.stations) stationsSoon();
      R.modeAsk = (R.modeAsk || 0) + 1;                  // a live switch still in flight must not finish over this
      document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-pressed", "false"));
      play(false); clearTiles(); R.pin = null;
      $("#legend").classList.remove("vel");
      $("#legend").innerHTML = `<span>light</span><i aria-hidden="true"></i><span>heavy</span>`;
      const step = hours <= 2 ? 5 : 10, to = from + hours * 3600e3;
      const rp = R.replay = { from, to, step, warn: null };
      const list = [];
      for (let t = from; t <= to; t += step * 60e3) list.push({ t, archive: true, url: (z, x, y) => Wx.archiveTile(t, z, x, y) });
      R.valid = null;
      satL.hidden = true;
      $("#rplive").hidden = false;
      setFrames(list);
      label(); renderSources();
      try { rp.warn = await Wx.sbwArchive(from, to); } catch (e) { rp.warn = []; rp.err = true; }
      if (R.replay !== rp) return;
      if (fitToStorms && rp.warn.length) {
        const pts = rp.warn.flatMap((w) => w.polys.flatMap((p) => p[0]));
        fit(Math.min(...pts.map((p) => p[1])), Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), 30);
      }
      draw(); label(); renderSources();
      if (!reduced && R.visible) play(true, true);
    }
    const leaveReplay = () => setMode("comp");

    /* ── a replay of one radar, from the Level II archive ──
       Every volume the radar finished in the window (every 4–6 minutes),
       each read only as far as its lowest tilt (level2.js's stream — about a
       megabyte a frame), with the warnings as they stood, as the mosaic's
       replay has them. The radar is the one nearest the map's middle — after
       a notable storm has fitted the map to its warnings. The product buttons
       change what is shown without leaving the replay. Ric, 2026-10-22. */
    async function siteReplay(from, hours, fitToStorms) {
      const prodMode = l3() && l3().l2 ? R.mode : (R.replay && R.replay.prodMode) || "l3:ref";
      R.mode = "replay"; if (R.stations) stationsSoon();
      R.modeAsk = (R.modeAsk || 0) + 1;
      document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === prodMode)));
      play(false); clearTiles(); R.pin = null;
      const to = from + hours * 3600e3;
      const rp = R.replay = { from, to, step: null, warn: null, site: null, prodMode, vols: null };
      R.valid = null;
      satL.hidden = true;
      $("#rplive").hidden = false;
      setFrames([]); legend(); label();
      try { rp.warn = await Wx.sbwArchive(from, to); } catch (e) { rp.warn = []; rp.err = true; }
      if (R.replay !== rp) return;
      if (fitToStorms && rp.warn.length) {
        const pts = rp.warn.flatMap((w) => w.polys.flatMap((p) => p[0]));
        fit(Math.min(...pts.map((p) => p[1])), Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), 30);
      }
      await pickSite(true);
      if (R.replay !== rp) return;
      if (!R.site) { note("No radar near the middle of the map — move the map over the storm and replay again."); label(); return; }
      rp.site = L2.site4(R.site.id);
      let list = [];
      try { list = await L2.archive(rp.site, from, to); } catch (e) { rp.listErr = true; }
      if (R.replay !== rp) return;
      if (!list.length) { note(rp.listErr ? "NOAA's radar archive did not answer. Try again in a minute." : `NOAA's archive has no full-volume scans from ${rp.site} for that time.`); label(); return; }
      rp.vols = list;
      siteReplayFrames();
      draw(); label(); renderSources();
      if (!reduced && R.visible) play(true, true);
    }
    function siteReplayFrames() {
      const rp = R.replay, mom = l3(rp.prodMode).l2;
      setFrames(rp.vols.map((v) => ({ t: v.t, l3: { prod: rp.prodMode.slice(3), l2: { key: `${v.key}|${mom}`, archive: v, mom, angle: 0.5 } } })));
      legend();
    }

    /* ── a cross-section between two taps (§18) ──
       Tap A, tap B; one request brings a model's column at twelve points
       along the line for twelve hours (HRRR when both ends are in its lower
       48, GFS otherwise). Drawn under the map: humidity or wind as shading,
       potential temperature as lines (packed lines are stable layers, gaps
       are mixed air), the ground in brown. A forecast, labelled as one. */
    const X = { pick: false, a: null, b: null, data: null, hour: 0, view: "rh", busy: false, err: null, model: null, rx: null };
    const xsecEl = $("#xsec");
    function xsecStart() {
      Object.assign(X, { pick: true, a: null, b: null, data: null, err: null, rx: null });
      R.pin = null;
      $("#zxsec").setAttribute("aria-pressed", "true");
      note("Cross-section: tap where the line starts, then where it ends.");
      draw(); renderXsec();
    }
    function xsecStop() {
      Object.assign(X, { pick: false, a: null, b: null, data: null, err: null, busy: false, rx: null });
      $("#zxsec").setAttribute("aria-pressed", "false");
      note(""); draw(); renderXsec();
    }
    function xsecTap(lat, lon) {
      const p = { lat: Wx.round2(lat), lon: Wx.round2(((lon + 540) % 360) - 180) };
      if (!X.a) { X.a = p; note("Now tap where the line ends."); draw(); renderXsec(); return; }
      if (Wx.distanceM(X.a.lat, X.a.lon, p.lat, p.lon) > 1500e3) { note("Keep the line under 1,500 km (about 930 miles) — tap a closer end."); return; }
      X.b = p; X.pick = false; note(""); draw();
      loadXsec();
    }
    /* ── the radar's own cross-section (2026-10-24): on a single radar whose
       product has a full volume, the line is cut through that volume —
       the volume of the frame on screen, every tilt — instead of through a
       model. NX.crossSection does the cutting and says what it leaves out. ── */
    const radarXsecOn = () => { const P = l3(); return !!(P && P.l2 && L2 && R.site); };
    async function radarVolumeState() {
      const f = R.frames[R.frame], x = f && f.l3 && f.l3.l2;
      if (x && x.archive) return L2.stream(x.archive.url, { gz: x.archive.gz });
      const s4 = L2.site4(R.site.id);
      let v = x && !x.archive ? [...volInfo.values()].find((i) => i.sKey === x.key.split("|")[0]) : null;
      if (!v) {
        const nv = R.l2vol && R.l2vol.site === s4 ? R.l2vol : (R.l2vol = await L2.newestVolume(s4));
        if (!nv) throw new Error(`${s4} has no full volume in NOAA's archive right now`);
        v = await volume(s4, nv.number, true);
        /* the newest still sweeping: the one before it is whole */
        if (v && !v.complete) v = (await volume(s4, L2.prevNumber(nv.number, nv.numbers)).catch(() => null)) || v;
      }
      if (!v) throw new Error("the volume did not load");
      const urls = [v.sUrl, ...[...v.byN.values()].filter((c) => c.kind !== "S").sort((p, q) => p.n - q.n).map((c) => c.url)];
      const bufs = await Promise.all(urls.map(async (u) => { const r = await NX.retrying(fetch)(u); if (!r.ok) throw new Error("HTTP " + r.status); return new Uint8Array(await r.arrayBuffer()); }));
      let st = null;
      for (const b of bufs) st = L2.feed(b, st);
      return st;
    }
    async function loadRadarXsec() {
      X.busy = true; X.err = null; X.rx = { loading: true }; renderXsec();
      const ask = X.ask = {}, P = l3(), prod = R.mode.slice(3);
      try {
        const site = R.site, far = (p) => Wx.distanceM(site.lat, site.lon, p.lat, p.lon) > 460e3;
        if (far(X.a) && far(X.b)) throw new Error(`the line is out of ${site.id}'s reach — draw it within about 460 km (285 miles) of the radar`);
        const [st, ground] = await Promise.all([radarVolumeState(), PRO ? groundProfile(X.a, X.b, 300) : null]);
        if (X.ask !== ask) return;
        const sweeps = L2.angles(st, P.l2).map((t) => L2.sweep(st, t.elevNum, P.l2)).filter(Boolean).map((sw) => (R.dealias && P.l2 === "VEL" ? NX.dealias(sw) : sw));
        if (!sweeps.length) throw new Error(`this volume has no ${P.label.toLowerCase()} yet`);
        const sec = NX.crossSection(sweeps, X.a, X.b, { nx: 320, ny: 160, topKm: 15 });
        X.rx = { sec, prod, P, ground };
      } catch (e) { if (X.ask === ask) { X.rx = null; X.err = `The radar's cross-section did not load (${String(e.message || e).replace(/^nexrad: /, "")}).`; } }
      X.busy = false; renderXsec();
    }
    function paintRadarXsec(cv) {
      const { sec, P, ground } = X.rx, dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.max(280, cv.clientWidth || 600), H = W < 500 ? 220 : 280, L = 44, Rm = 8, T = 8, B = 24;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
      const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = "#0c1422"; x.fillRect(0, 0, W, H);
      /* the section at its own size, coloured from the product's palette, then laid over the plot */
      const pal = NX.paletteFor(P.pal, R.pal[P.pal]), img = new ImageData(sec.nx, sec.ny), d = img.data;
      for (let i = 0; i < sec.values.length; i++) {
        const v = sec.values[i];
        if (!Number.isFinite(v)) continue;
        const u = P.toUnit ? v * P.toUnit : v;
        if (pal.floor != null && u < pal.floor) continue;
        const c = NX.colorOf(pal, u);
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      }
      const off = document.createElement("canvas"); off.width = sec.nx; off.height = sec.ny; off.getContext("2d").putImageData(img, 0, 0);
      const pw = W - L - Rm, ph = H - T - B;
      x.imageSmoothingEnabled = false; x.drawImage(off, L, T, pw, ph);
      const Y = (km) => T + ph * (1 - km / sec.topKm);
      /* each tilt's beam centre, faint — where the radar actually looked */
      x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = 1;
      sec.tilts.forEach((_, k) => { x.beginPath(); let on = false; sec.beams.forEach((col, i) => { const h = col[k]; if (h == null || h > sec.topKm) { on = false; return; } const px = L + i / (sec.beams.length - 1) * pw; if (on) x.lineTo(px, Y(h)); else { x.moveTo(px, Y(h)); on = true; } }); x.stroke(); });
      /* the real ground under the line */
      if (ground) { x.fillStyle = "#4a3a2b"; x.beginPath(); x.moveTo(L, Y(0)); ground.forEach((m, i) => x.lineTo(L + i / (ground.length - 1) * pw, Y(Math.max(0, m) / 1000))); x.lineTo(L + pw, Y(0)); x.closePath(); x.fill(); }
      /* axes: height above sea level, and the distance along the line */
      const font = getComputedStyle(document.body).fontFamily, ft = U() !== "metric";
      x.fillStyle = "#c8d0da"; x.font = "11px " + font; x.textAlign = "right";
      for (const t of ft ? [0, 10, 20, 30, 40] : [0, 3, 6, 9, 12, 15]) { const km = ft ? t * 0.3048 : t; if (km > sec.topKm) continue; const y = Y(km); x.fillText(String(t), L - 6, y + 4); x.fillStyle = "rgba(255,255,255,.10)"; x.fillRect(L, y, pw, 1); x.fillStyle = "#c8d0da"; }
      x.textAlign = "left"; x.fillText(ft ? "kft" : "km", 4, T + 10);
      x.font = "bold 12px " + font; x.fillText("A", L, H - 7); x.textAlign = "right"; x.fillText("B", W - Rm, H - 7);
      x.textAlign = "center"; x.font = "11px " + font; x.fillText(dist(Wx.distanceM(X.a.lat, X.a.lon, X.b.lat, X.b.lon) / 1000), L + pw / 2, H - 7);
    }
    async function loadXsec() {
      if (radarXsecOn()) return loadRadarXsec();
      X.busy = true; X.err = null; renderXsec();
      const model = Wx.inMosaic(X.a.lat, X.a.lon) && Wx.inMosaic(X.b.lat, X.b.lon) ? "hrrr" : "gfs";
      const ask = X.ask = {};
      try {
        const [d, gp] = await Promise.all([Wx.xsec(model, X.a, X.b), PRO ? groundProfile(X.a, X.b) : null]);
        if (X.ask !== ask) return;
        X.data = d; X.model = model; X.ground = gp;
        const now = Date.now() / 1000;
        X.hour = Math.max(0, d ? d.times.findIndex((t) => t > now - 1800) : 0);
        if (!d) X.err = "The model sent nothing back for this line.";
      } catch (e) { if (X.ask === ask) X.err = "The model did not answer. Try again, or a shorter line."; }
      X.busy = false; renderXsec();
    }
    function renderXsec() {
      if (!X.pick && !X.a) { xsecEl.hidden = true; xsecEl.innerHTML = ""; return; }
      xsecEl.hidden = false;
      const close = `<button type="button" data-xsx aria-label="Close the cross-section">×</button>`;
      if (X.pick || !X.b) { xsecEl.innerHTML = `<div class="xh"><span>Cross-section<small>${X.a ? "Now tap where the line ends." : "Tap where the line starts on the map, then where it ends."}</small></span>${close}</div>`; return; }
      if (X.busy) { xsecEl.innerHTML = `<div class="xh"><span>Cross-section<small>${X.rx ? `Reading ${esc(R.site ? R.site.id : "the radar")}'s whole volume — every tilt, about 10–25 MB…` : "Asking the model for twelve columns along the line…"}</small></span>${close}</div>`; return; }
      if (X.rx && X.rx.sec) {
        const { sec, P } = X.rx;
        xsecEl.innerHTML = `<div class="xh"><span>Cross-section A → B · ${esc(sec.site || R.site.id)} ${esc(P.label.toLowerCase())}${P.srm ? " (velocity, not storm-relative)" : ""}<small>The volume of ${esc(clk().time(sec.time))}, ${sec.tilts.length} tilts (${sec.tilts[0].toFixed(1)}° to ${sec.tilts[sec.tilts.length - 1].toFixed(1)}°) — measured, not a model.</small></span>${close}</div>
          <canvas id="xscv" role="img" aria-label="Radar cross-section from A to B: ${esc(P.label)} by height above sea level"></canvas>
          <p class="nextnote">Each height is read from the tilt whose beam passes nearest; between two tilts less than 2.5 km apart it is blended, as GR2Analyst does. Where the tilts are further apart — far from the radar — the gap is left empty, because nothing was measured there. Faint lines are the beams; brown is the ground.</p>`;
        paintRadarXsec($("#xscv"));
        return;
      }
      if (X.err || !X.data) { xsecEl.innerHTML = `<div class="xh"><span>Cross-section<small>${esc(X.err || "Nothing to draw.")}</small></span>${close}</div>`; return; }
      const d = X.data, t = d.times[X.hour] * 1000, k = clk(), m = Wx.MODELS[X.model];
      const seg = (v, l) => `<button type="button" data-xsv="${v}" aria-pressed="${X.view === v}">${l}</button>`;
      xsecEl.innerHTML = `<div class="xh"><span>Cross-section A → B · ${dist(d.km)} · ${esc(m.label)}<small>Valid ${esc(k.dayLong(t))}, ${esc(k.time(t))} — a forecast from the model's columns, not a measurement.</small></span>${close}</div>
        <div class="seg" role="group" aria-label="Shading">${seg("rh", "Moisture")}${seg("ws", "Wind")}</div>
        <div class="hourpick"><span class="num" style="min-width:52px">${esc(k.hour(t))}</span><input type="range" id="xshour" min="0" max="${d.times.length - 1}" step="1" value="${X.hour}" aria-label="Cross-section hour"><span class="dim num">+12 h</span></div>
        <canvas id="xscv" role="img" aria-label="Cross-section from A to B: ${X.view === "rh" ? "relative humidity" : "wind speed"} shaded, potential temperature in lines, the ground in brown"></canvas>
        <p class="nextnote">${X.view === "rh" ? "Shading: humidity — white where the air is near saturation (cloud likely), clear where it is dry." : "Shading: wind speed, knots — the jet stream shows as the bright core aloft."} Lines: potential temperature every 4 K; lines packed close are stable layers, wide gaps are well-mixed air. Brown is the ground as the model sees it${X.ground ? "; the thin tan line is the real ground (USGS 3DEP and SRTM), which the model smooths" : ""}. Twelve columns from Open-Meteo, joined.</p>`;
      paintXsec($("#xscv"));
    }
    function paintXsec(cv) {
      const d = X.data, i = X.hour, n = d.cols.length, dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.max(280, cv.clientWidth || 600), H = W < 500 ? 210 : 260, L = 40, Rm = 8, T = 8, B = 22;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
      const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = "#0c1422"; x.fillRect(0, 0, W, H);
      /* 200 hPa at the top, 1050 at the bottom, log-spaced, as the atmosphere stacks */
      const P0 = 1050, P1 = 200, lnr = Math.log(P0 / P1);
      const Y = (p) => T + Math.log(p / P1) / lnr * (H - T - B);
      const lv = Wx.XSEC_LEVELS;
      /* a column's value at pressure p (linear in ln p between levels) */
      const at = (c, key, p) => {
        for (let j = 0; j + 1 < lv.length; j++) {
          if (p <= lv[j] && p >= lv[j + 1]) {
            const a = c.lv[lv[j]][key][i], b = c.lv[lv[j + 1]][key][i];
            if (a == null || b == null) return a ?? b;
            const f = Math.log(lv[j] / p) / Math.log(lv[j] / lv[j + 1]);
            return a + (b - a) * f;
          }
        }
        return p > lv[0] ? c.lv[lv[0]][key][i] : null;
      };
      const C = 4, gw = Math.ceil((W - L - Rm) / C) + 1, gh = Math.ceil((H - T - B) / C) + 1;
      const th = new Float32Array(gw * gh).fill(NaN);
      const ramp = [[0, [12, 20, 34]], [20, [31, 78, 121]], [40, [47, 143, 107]], [60, [233, 196, 106]], [80, [244, 132, 95]], [100, [208, 50, 155]]];
      const windCol = (kt) => { for (let j = 1; j < ramp.length; j++) if (kt <= ramp[j][0]) { const [a, ca] = ramp[j - 1], [b, cb] = ramp[j], f = (kt - a) / (b - a); return ca.map((v, q) => Math.round(v + (cb[q] - v) * f)); } return ramp.at(-1)[1]; };
      const groundAt = [];
      for (let gx = 0; gx < gw; gx++) {
        const fx = Math.min(1, gx / (gw - 1)) * (n - 1), c0 = Math.floor(fx), c1 = Math.min(n - 1, c0 + 1), f = fx - c0;
        const ps0 = d.cols[c0].ps[i], ps1 = d.cols[c1].ps[i];
        const ps = ps0 != null && ps1 != null ? ps0 + (ps1 - ps0) * f : ps0 ?? ps1 ?? 1013;
        groundAt.push(ps);
        for (let gy = 0; gy < gh; gy++) {
          const p = P1 * Math.exp(Math.min(1, gy / (gh - 1)) * lnr);
          if (p > ps) continue;
          const v = (key) => { const a = at(d.cols[c0], key, p), b = at(d.cols[c1], key, p); return a == null || b == null ? a ?? b : a + (b - a) * f; };
          const t = v("t");
          if (t != null) th[gy * gw + gx] = (t + 273.15) * Math.pow(1000 / p, 0.2857);
          const px = L + gx * C, py = T + gy * C;
          if (X.view === "rh") {
            const rh = v("rh");
            if (rh == null) continue;
            const a = Math.pow(Math.max(0, Math.min(1, (rh - 50) / 50)), 1.4) * 0.9;
            if (a <= 0.01) continue;
            const w = Math.max(0, Math.min(1, (rh - 75) / 25));
            x.fillStyle = `rgba(${Math.round(124 + 131 * w)},${Math.round(196 + 59 * w)},255,${a.toFixed(2)})`;
          } else {
            const ws = v("ws");
            if (ws == null) continue;
            x.fillStyle = `rgb(${windCol(ws * 1.943844)})`;
          }
          x.fillRect(px - C / 2, py - C / 2, C, C);
        }
      }
      /* potential temperature lines, by marching squares on the grid */
      x.strokeStyle = "rgba(255,255,255,.75)"; x.lineWidth = 1; x.beginPath();
      const thv = [...th].filter(Number.isFinite);
      const lo = Math.ceil(Math.min(...thv) / 4) * 4, hi = Math.max(...thv);
      for (let lev = lo; lev <= hi; lev += 4) {
        for (let gy = 0; gy + 1 < gh; gy++) for (let gx = 0; gx + 1 < gw; gx++) {
          const a = th[gy * gw + gx], b = th[gy * gw + gx + 1], c = th[(gy + 1) * gw + gx + 1], e = th[(gy + 1) * gw + gx];
          if (![a, b, c, e].every(Number.isFinite)) continue;
          const pts = [], X0 = L + gx * C, Y0 = T + gy * C;
          const cut = (p, q, x0, y0, x1, y1) => { if ((p < lev) !== (q < lev)) { const f = (lev - p) / (q - p); pts.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]); } };
          cut(a, b, X0, Y0, X0 + C, Y0); cut(b, c, X0 + C, Y0, X0 + C, Y0 + C); cut(e, c, X0, Y0 + C, X0 + C, Y0 + C); cut(a, e, X0, Y0, X0, Y0 + C);
          if (pts.length >= 2) { x.moveTo(...pts[0]); x.lineTo(...pts[1]); }
          if (pts.length === 4) { x.moveTo(...pts[2]); x.lineTo(...pts[3]); }
        }
      }
      x.stroke();
      /* the ground */
      x.fillStyle = "#4a3a2b"; x.beginPath(); x.moveTo(L - C / 2, H - B);
      groundAt.forEach((ps, gx) => x.lineTo(L + gx * C, Math.min(H - B, Y(ps))));
      x.lineTo(L + (gw - 1) * C + C / 2, H - B); x.closePath(); x.fill();
      /* the real ground (Pro): the terrain tiles' heights on the same pressure axis, through the
         standard atmosphere — a thin line over the model's own, smoother ground */
      if (X.ground) {
        x.strokeStyle = "#e0b07a"; x.lineWidth = 1.5; x.beginPath();
        X.ground.forEach((m, j) => { const px = L - C / 2 + j / (X.ground.length - 1) * ((gw - 1) * C + C), py = Math.min(H - B, Y(TR.pressureAt(m))); if (j) x.lineTo(px, py); else x.moveTo(px, py); });
        x.stroke();
      }
      /* axes */
      x.fillStyle = "#c8d0da"; x.font = "11px " + getComputedStyle(document.body).fontFamily; x.textAlign = "right";
      for (const p of [1000, 850, 700, 500, 300, 200]) { const y = Y(p); x.fillText(String(p), L - 6, y + 4); x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(L, y, W - L - Rm, 1); x.fillStyle = "#c8d0da"; }
      x.textAlign = "left"; x.fillText("hPa", 4, H - 6);
      x.font = "bold 12px " + getComputedStyle(document.body).fontFamily;
      x.fillText("A", L, H - 6); x.textAlign = "right"; x.fillText("B", W - Rm, H - 6);
      x.textAlign = "center"; x.font = "11px " + getComputedStyle(document.body).fontFamily; x.fillText(dist(d.km), (L + W - Rm) / 2, H - 6);
    }
    xsecEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-xsx]")) xsecStop();
      const v = e.target.closest("[data-xsv]");
      if (v) { X.view = v.dataset.xsv; renderXsec(); }
    });
    xsecEl.addEventListener("input", (e) => {
      if (e.target.id !== "xshour") return;
      X.hour = Number(e.target.value);
      const t = X.data.times[X.hour] * 1000, k = clk();
      e.target.previousElementSibling.textContent = k.hour(t);
      xsecEl.querySelector(".xh small").textContent = `Valid ${k.dayLong(t)}, ${k.time(t)} — a forecast from the model's columns, not a measurement.`;
      paintXsec($("#xscv"));
    });

    /* ── the HRRR's next 18 hours, drawn as radar ──
       Not tiles: one lat/lon picture of the lower 48 per step (Wx.HRRR),
       reprojected onto the map in thin strips — longitude is straight in
       both, so only latitude needs stretching. The loop starts on the step
       nearest now. A forecast, and labelled as one everywhere it shows. */
    async function hrrrFrames() {
      let run = null;
      try { run = await Wx.hrrrRun(); } catch (e) {}
      if (R.mode !== "hrrr") return;
      R.valid = run;
      setFrames(Wx.HRRR.mins.map((m) => ({ t: run ? run + m * 60e3 : null, mins: m, future: true, src: Wx.hrrrImage(m, run ? Math.round(run / 60e3) : "") })));
      if (run) {
        let best = 0;
        R.frames.forEach((f, i) => { if (Math.abs(f.t - Date.now()) < Math.abs(R.frames[best].t - Date.now())) best = i; });
        show(best);
      } else note("The HRRR forecast did not answer. Try again, or go back to the radar.");
      renderSources();
    }
    function paintHrrr(f, w, h, left, top) {
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (!f.cv) { f.cv = document.createElement("canvas"); f.cv.className = "hrrr"; f.el.appendChild(f.cv); }
      if (!f.img) {
        f.img = new Image(); f.img.decoding = "async";
        f.img.onload = () => { if (R.frames.includes(f) && R.frames[R.frame] === f) draw(); };
        f.img.src = f.src;
      }
      const cv = f.cv, W = Math.round(w * dpr), Hh = Math.round(h * dpr);
      if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; cv.style.width = w + "px"; cv.style.height = h + "px"; }
      const x = cv.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, w, h);
      if (!f.img.complete || !f.img.naturalWidth) return;
      const H = Wx.HRRR, x0 = lngX(H.west, R.z) - left, x1 = lngX(H.west + H.w * H.deg, R.z) - left, STRIP = 2;
      for (let y = 0; y < h; y += STRIP) {
        const s0 = (H.north - yLat(top + y, R.z)) / H.deg, s1 = (H.north - yLat(top + y + STRIP, R.z)) / H.deg;
        const a = Math.max(0, s0), b = Math.min(H.h, s1);
        if (b > a) x.drawImage(f.img, 0, a, H.w, b - a, x0, y, x1 - x0, STRIP);
      }
    }
    /* The mosaic's time: IEM's — or, when IEM's is late or not answering and
       NOAA's own is newer, NOAA's backup (Wx.useBackupMosaic), which the map
       then draws. Asked again on every refresh, so it goes back to IEM's the
       moment that recovers (2026-10-23). */
    async function mosaicTime() {
      const v = await Wx.radarTime();
      let bk = null;
      if (!v || Date.now() - v > Wx.STALE_MS.radar) {
        const ts = await Wx.mosaicBackup().catch(() => []);
        if (Wx.useBackupMosaic(v, ts[ts.length - 1])) bk = ts;
      }
      R.backup = bk; R.iemValid = v;
      return bk ? bk[bk.length - 1] : v;
    }
    function compFrames() {
      if ($("#noaacredit")) $("#noaacredit").hidden = !R.backup;
      /* NOAA's backup: its newest picture and the one nearest each five minutes back, as IEM's loop has.
         Drawn in the NWS's colours on both pages — its palette is not IEM's, so Weather's rain ramp is not laid on it */
      if (R.backup) {
        const ts = R.backup, last = ts[ts.length - 1], picks = [];
        for (const mins of Wx.RADAR_STEPS) {
          const want = last - mins * 60e3, t = ts.reduce((b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b), ts[0]);
          if (Math.abs(t - want) < 3 * 60e3 && !picks.includes(t)) picks.push(t);
        }
        picks.sort((a, b) => a - b);
        setFrames(picks.map((t) => ({ t, backup: true, url: (z, x, y) => Wx.backupTile(z, x, y, t) })));
        renderSources();
        return;
      }
      const b = bucket();
      setFrames(Wx.RADAR_STEPS.map((mins) => ({ t: R.valid ? R.valid - mins * 60e3 : null, mins, rain: true,
        url: (z, x, y) => Wx.radarTile(mins, z, x, y, b) })));
      if (!PRO && R.valid) { NCM.area = null; nowcastMap(); }
    }
    async function siteFrames(onlyIfNew) {
      if (!R.site) return;
      if (l3()) return l3Frames(onlyIfNew);
      let scans = [];
      const mode = R.mode;
      try { scans = await Wx.siteScans(R.site.id, mode); } catch (e) {}
      if (R.mode !== mode) return;                     // switched away while asking: the newer mode owns the frames
      /* a refresh with no new scan leaves the loop alone */
      if (onlyIfNew && (!scans.length || scans[scans.length - 1].t === R.valid)) return;
      if (!scans.length) { setFrames([]); note(`No scans from ${R.site.id} in the last hour — the radar may be down for maintenance. Try the US mosaic.`); return; }
      R.valid = scans[scans.length - 1].t;
      setFrames(scans.map((s) => ({ t: s.t, url: (z, x, y) => Wx.tileUrl(s.layer, z, x, y) })));
      renderSources();
    }

    /* ── one site's Level III products, read here (nexrad.js) ──
       The bucket lists every scan of the product at the chosen tilt in the
       last hour; the loop holds the newest twelve. A scan's file is fetched
       only when it is shown or the loop plays, and painted pixel by pixel:
       each screen pixel's range and bearing from the radar pick its gate. */
    const tiltCode = (P) => P.tilts[Math.min(R.tilt, P.tilts.length - 1)];
    async function l3Frames(onlyIfNew) {
      if (useL2()) return l2Frames(onlyIfNew);
      const mode = R.mode, P = l3(mode), site = R.site && R.site.id;
      if (!P || !site) return;
      let scans = [], failed = false;
      try { scans = await NX.scans(site, tiltCode(P), { mins: 60 }); } catch (e) { failed = true; }
      if (R.mode !== mode || !R.site || R.site.id !== site) return;
      if (onlyIfNew && (!scans.length || scans[scans.length - 1].t === R.valid)) return;
      if (!scans.length) {
        setFrames([]);
        note(failed ? "NOAA's radar archive did not answer. Try again in a minute." : `No ${P.label} scans from ${site} in the last hour — the radar may be down for maintenance, or not sending this tilt. Try the lowest tilt or the US mosaic.`);
        tilts(); return;
      }
      scans = scans.slice(-12);
      /* reflectivity: the CC scan of the same tilt, for clutter filtering —
         listed once; each file is fetched only when filtering is on */
      let ccs = [];
      if (mode === "l3:ref") try { ccs = await NX.scans(site, tiltCode(NX.PRODUCTS.cc), { mins: 70 }); } catch (e) { ccs = []; }
      if (R.mode !== mode || !R.site || R.site.id !== site) return;
      const ccFor = (t) => { const c = ccs.reduce((b, x) => (!b || Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), null); return c && Math.abs(c.t - t) < 3 * 60e3 ? c.url : null; };
      R.valid = scans[scans.length - 1].t;
      setFrames(scans.map((s) => ({ t: s.t, l3: { url: s.url, prod: mode.slice(3), ccUrl: mode === "l3:ref" ? ccFor(s.t) : null } })));
      tilts(); renderSources();
    }
    /* decoded scans, kept so a refresh that rebuilds the loop does not fetch
       them again (by URL for Level III, by volume and cut for Level II) */
    const scanCache = new Map();
    const cached = (key, make) => {
      if (!scanCache.has(key)) {
        scanCache.set(key, make().catch((e) => { scanCache.delete(key); throw e; }));
        if (scanCache.size > 40) scanCache.delete(scanCache.keys().next().value);
      }
      return scanCache.get(key);
    };
    async function loadL2(q) {
      if (q.archive) {
        const st = await L2.stream(q.archive.url, { gz: q.archive.gz, until: (s) => L2.swept(s, q.mom, q.angle) });
        const a = L2.angles(st, q.mom);
        if (!a.length) throw new Error(new Date(q.archive.t).getUTCFullYear() < 2008 ? "a volume before 2008, in an older format this page does not read" : "no " + q.mom + " in this volume");
        const best = a.reduce((b, x) => (Math.abs(x.angle - q.angle) < Math.abs(b.angle - q.angle) ? x : b), a[0]);
        return withCC(L2.sweep(st, best.elevNum, q.mom), st, best.elevNum);
      }
      const bufs = await Promise.all(q.urls.map(async (u) => { const r = await NX.retrying(fetch)(u); if (!r.ok) throw new Error("HTTP " + r.status); return new Uint8Array(await r.arrayBuffer()); }));
      let st = null;
      for (const b of bufs) st = L2.feed(b, st);
      const sw = L2.sweep(st, q.elevNum, q.mom);
      if (!sw) throw new Error("no " + q.mom + " in this cut");
      return withCC(sw, st, q.elevNum);
    }
    /* clutter filtering's evidence: reflectivity's own cut holds CC (RHO) at
       the same moment, so it costs nothing to keep beside it */
    function withCC(sw, st, elevNum) {
      if (sw && sw.moment === "REF") sw.cc = L2.sweep(st, elevNum, "RHO") || null;
      return sw;
    }
    /* The storm motion taken out of storm-relative velocity above the lowest
       tilt: the mean of the motions this radar's own storm tracking (SCIT,
       via IEM) gives its moving cells — what the NWS's own N0S uses. Live
       only: the cells are the last twenty minutes', so an archived volume
       has none. Asked at most every two minutes. */
    const srm = { at: 0, p: null, nws: new Map() };
    /* NWS's own: the motion in the radar's newest N0S file — exactly what its
       storm-relative velocity at the lowest tilt took out (2026-10-23; before
       this the page used only IEM's tracked cells, which nobody could check
       against NWS, and which an IEM outage took away) */
    /* `atMs` (a replay): the N0S nearest that moment instead of the newest —
       NOAA's bucket keeps them from 30 March 2020 (checked 2026-10-23), so a
       replay since then has NWS's own storm motion too */
    const SRM_ARCHIVE_FROM = Date.UTC(2020, 2, 30);
    async function nwsMotion(site, atMs) {
      const k = atMs ? `${site}|${Math.round(atMs / 300e3)}` : site, have = srm.nws.get(k);
      if (have && (atMs || Date.now() - have.at < 120e3)) return have.m;
      let m = null;
      try {
        const scans = atMs ? await NX.scans(site, "N0S", { mins: 20, nowMs: atMs + 8 * 60e3 }) : await NX.scans(site, "N0S", { mins: 30 });
        const s = atMs ? scans.reduce((b, x) => (!b || Math.abs(x.t - atMs) < Math.abs(b.t - atMs) ? x : b), null) : scans[scans.length - 1];
        if (s && (!atMs || Math.abs(s.t - atMs) < 12 * 60e3)) { const F = await cached(s.url, () => NX.load(s.url)); if (F.motion && F.motion.kt > 0) m = { ...F.motion, t: F.time }; }
      } catch (e) { m = null; }
      srm.nws.set(k, { at: Date.now(), m });
      if (srm.nws.size > 60) srm.nws.delete(srm.nws.keys().next().value);
      return m;
    }
    async function srmMotion(site) {
      const own = await nwsMotion(site);
      if (own) {
        const to = (own.from + 180) * Math.PI / 180, u = own.kt * Math.sin(to), v = own.kt * Math.cos(to);
        return { uE: u * 0.514444, vN: v * 0.514444, kt: own.kt, from: own.from, nws: true };
      }
      /* a feed that did not answer is said as that, never as "no storms" */
      if (!srm.p || Date.now() - srm.at > 120e3) { srm.at = Date.now(); srm.p = Wx.proOverlays.cells().catch(() => { srm.at = 0; return null; }); }
      const all = await srm.p;
      if (!all) return { down: true };
      const cells = all.filter((c) => c.site === site && c.kt > 0 && c.from != null);
      if (!cells.length) return null;
      let u = 0, v = 0;
      for (const c of cells) { const to = (c.from + 180) * Math.PI / 180; u += c.kt * Math.sin(to); v += c.kt * Math.cos(to); }
      u /= cells.length; v /= cells.length;
      const kt = Math.hypot(u, v), from = ((Math.atan2(-u, -v) * 180 / Math.PI) + 360) % 360;
      return { uE: u * 0.514444, vN: v * 0.514444, kt, from, n: cells.length };
    }
    async function srmSweep(x, file) {
      if (x.prod !== "srv" || file.code !== "L2") return file;
      const site = R.site && R.site.id;
      if (x.l2 && x.l2.archive) {
        /* a replay: NWS's own motion at that moment, from its archived N0S (2020 on) */
        if (!file.time || file.time < SRM_ARCHIVE_FROM) throw new Error("storm-relative velocity needs NWS's storm motion, which NOAA's archive holds from 30 March 2020 — use Velocity for this replay");
        const own = site && await nwsMotion(site, file.time);
        if (!own) throw new Error(`NWS wrote no storm motion for ${site || "this radar"} at this moment (no moving storms, or no file) — use Velocity`);
        const to = (own.from + 180) * Math.PI / 180;
        return Object.assign(NX.stormRelative(file, own.kt * Math.sin(to) * 0.514444, own.kt * Math.cos(to) * 0.514444),
          { motionText: `storm motion from ${Math.round(own.from)}° at ${Math.round(own.kt)} kt, the one NWS took out of ${site}'s own storm-relative velocity then` });
      }
      const m = site && await srmMotion(site);
      if (m && m.down) throw new Error("IEM's storm tracking did not answer, so the storm motion is not known — try again in a minute, or use Velocity");
      if (!m) throw new Error(`${site || "this radar"} is tracking no moving storms right now, so there is no storm motion to take out — use Velocity`);
      return Object.assign(NX.stormRelative(file, m.uE, m.vN), { motionText: m.nws
        ? `storm motion from ${Math.round(m.from)}° at ${Math.round(m.kt)} kt, the one NWS took out of ${site}'s own storm-relative velocity`
        : `storm motion from ${Math.round(m.from)}° at ${Math.round(m.kt)} kt, the mean of the ${m.n} storm${m.n === 1 ? "" : "s"} ${site} is tracking (IEM; NWS's own was not to be had)` });
    }
    function l3File(f) {
      const x = f.l3;
      /* full-volume velocity unfolded first when Dealias is on (NX.dealias), then storm-relative if asked */
      if (!x.p) x.p = (x.l2 ? cached(x.l2.key, () => loadL2(x.l2)) : cached(x.url, () => NX.load(x.url))).then((file) => srmSweep(x, R.dealias && file.code === "L2" && file.moment === "VEL" ? NX.dealias(file) : file)).then((file) => {
        x.file = file; x.colors = NX.colorTable(file, x.prod, R.pal);
        if (R.frames[R.frame] === f) { draw(); show(R.frame); tilts(); }
        return file;
      }).catch((e) => {
        /* said, and kept said (show() repeats it), and asked again twice,
           30 s apart — a corrupt file used to say "loading" for good and
           never be asked for again until a newer scan came (2026-10-23) */
        x.err = true; x.tries = (x.tries || 0) + 1;
        const srmErr = /storm motion/.test(String(e.message || ""));
        const again = x.tries < 3 && !(x.l2 && x.l2.archive && srmErr);
        x.errText = srmErr ? `Storm-relative: ${e.message}.` : x.l2 && x.l2.archive ? `This volume did not load (${String(e.message || e)}).`
          : `This scan did not load (${String(e.message || e).slice(0, 80)})${again ? " — trying it again in 30 seconds" : " — the next scan may"}.`;
        if (R.frames[R.frame] === f) show(R.frame);
        if (again) setTimeout(() => {
          if (!R.frames.includes(f) || x.file) return;
          x.p = null; x.err = false;
          if (R.frames[R.frame] === f) { l3File(f); show(R.frame); }
        }, 30e3);
      });
      return x.p;
    }
    function frameCanvas(f, w, h) {
      if (!f.cv) { f.cv = document.createElement("canvas"); f.cv.className = "hrrr"; f.el.appendChild(f.cv); }
      if (f.cv.width !== w || f.cv.height !== h) { f.cv.width = w; f.cv.height = h; f.cv.style.width = w + "px"; f.cv.style.height = h + "px"; f.painted = null; }
      return f.cv;
    }
    function paintL3(f, w, h, left, top) {
      const cv = frameCanvas(f, w, h), ctx = cv.getContext("2d"), key = `${R.z}|${left}|${top}|${R.clutter}`;
      if (!f.l3.file) { l3File(f); if (f.painted) { ctx.clearRect(0, 0, w, h); f.painted = null; } return; }
      if (f.painted === key) return;
      f.painted = key;
      const F = f.l3.file, col = f.l3.colors, img = ctx.createImageData(w, h), px = new Uint32Array(img.data.buffer);
      /* clutter filtering: a likely non-weather gate is skipped, or drawn a flat grey when marked */
      const cm = clutterOf(f), mask = cm && cm.cc ? cm.mask : null, MARK = 0x8c8c8c8c >>> 0, hide = R.clutter === "filter";
      const azi = NX.azIndex(F), gk = F.gateKm, nb = F.nBins, data = F.data, g0 = NX.gateStart(F), rmax = g0 + nb * gk;
      const lat0 = F.lat, lon0 = F.lon, rad = Math.PI / 180;
      const sx = lngX(lon0, R.z) - left, sy = latY(lat0, R.z) - top;
      const pxPerKm = lngX(lon0 + 1 / (111.32 * Math.cos(lat0 * rad)), R.z) - lngX(lon0, R.z), rpx = rmax * pxPerKm * 1.1 + 2;
      const x0 = Math.max(0, Math.floor(sx - rpx)), x1 = Math.min(w, Math.ceil(sx + rpx)), y0 = Math.max(0, Math.floor(sy - rpx)), y1 = Math.min(h, Math.ceil(sy + rpx));
      /* each pixel's slant range and bearing from the radar, on the ellipsoid
         with the beam's rise (NX.locator) — not a flat map */
      const L = NX.locator(lat0, lon0, F.elev || 0), cols = new Array(w);
      for (let x = x0; x < x1; x++) cols[x] = L.lon(xLng(left + x + 0.5, R.z));
      for (let y = y0; y < y1; y++) {
        const rowP = L.lat(yLat(top + y + 0.5, R.z)), row = y * w;
        for (let x = x0; x < x1; x++) {
          const q = L.at(rowP, cols[x]), r = q.km;
          if (r >= rmax || r < g0) continue;
          const ri = azi[(q.az * 10) | 0];                               // tenths of a degree, clockwise from north
          if (ri < 0) continue;
          const gi = ri * nb + (((r - g0) / gk) | 0), c = col[data[gi]];
          if (!c) continue;
          if (mask && mask[gi]) { if (!hide) px[row + x] = MARK; continue; }
          px[row + x] = c;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    /* ── the full volume (Level II, level2.js) ──
       The newest volume and the five before it; for each, only the chunks
       of the one cut on screen (the volume's own first chunk says which),
       about 0.3–1.5 MB a frame. The newest volume is asked again every 30
       seconds while this is showing, so a tilt appears soon after the dish
       has swept it. */
    const volInfo = new Map();
    async function volume(s4, n, live) {
      const k = `${s4}/${n}`, have = volInfo.get(k);
      if (have && have.complete && !live) return have;
      const ch = await L2.chunks(s4, n);
      const S = ch.find((c) => c.kind === "S");
      if (!S) return null;
      if (have && have.sKey === S.key && have.complete) return have;
      const meta = have && have.sKey === S.key ? have.meta : L2.feed(new Uint8Array(await (await NX.retrying(fetch)(S.url)).arrayBuffer()));
      if (!meta.vcp) return null;
      const info = { s4, n, sKey: S.key, sUrl: S.url, meta, plan: L2.plan(meta.vcp), byN: new Map(ch.map((c) => [c.n, c])), complete: ch.some((c) => c.kind === "E"), start: S.t };
      volInfo.set(k, info);
      return info;
    }
    let l2timer = 0;
    async function l2Frames(onlyIfNew) {
      clearTimeout(l2timer);
      const mode = R.mode, P = l3(mode), site = R.site && R.site.id, mom = P && P.l2;
      if (!P || !site || !mom) return;
      const s4 = L2.site4(site);
      let nv = R.l2vol && R.l2vol.site === s4 ? R.l2vol : null, failed = false, vols = [];
      try {
        if (!nv) nv = R.l2vol = await L2.newestVolume(s4);
        if (nv) {
          /* has the next volume begun since? */
          const nx = L2.nextNumber(nv.number), nc = await L2.chunks(s4, nx);
          if (nc.length && nc[0].t > Date.now() - 1800e3) { nv.number = nx; if (!nv.numbers.includes(nx)) nv.numbers = [...nv.numbers, nx].sort((a, b) => a - b); }
          const nums = [nv.number];
          while (nums.length < 6) nums.push(L2.prevNumber(nums[nums.length - 1], nv.numbers));
          vols = (await Promise.all(nums.map((n, i) => volume(s4, n, i === 0).catch(() => null)))).filter(Boolean).filter((v) => Date.now() - v.start < 3 * 3600e3);
        }
      } catch (e) { failed = true; }
      if (R.mode !== mode || !R.site || R.site.id !== site || !useL2()) return;
      const newest = vols[0];
      if (!newest) {
        setFrames([]); tilts();
        note(failed ? "NOAA's full-volume radar did not answer. Try again, or turn Full volume off for Level III." : `No full-volume data from ${s4} in the last few hours.`);
        return;
      }
      R.l2angles = L2.anglesOf(newest.plan, mom);
      if (!R.l2angles.some((a) => Math.abs(a - R.l2angle) < 0.15)) R.l2angle = R.l2angles.reduce((b, a) => (Math.abs(a - 0.5) < Math.abs(b - 0.5) ? a : b), R.l2angles[0]);
      const frames = [];
      for (const v of vols.slice().reverse()) {
        const cut = L2.cutFor(v.plan, mom, R.l2angle);
        if (!cut) continue;
        const parts = [];
        for (let n = cut.first; n <= cut.last; n++) parts.push(v.byN.get(n));
        if (parts.some((c) => !c)) continue;                   // not all swept yet, or the volume stopped short
        frames.push({ t: parts[parts.length - 1].t, l3: { prod: mode.slice(3), l2: { key: `${v.sKey}|${cut.elevNum}|${mom}`, urls: [v.sUrl, ...parts.map((c) => c.url)], elevNum: cut.elevNum, mom } } });
      }
      if (useL2() && R.visible) l2timer = setTimeout(() => { if (useL2() && R.mode === mode) l2Frames(true).then(label); }, 30e3);
      if (onlyIfNew && (!frames.length || frames[frames.length - 1].t === R.valid)) { tilts(); return; }
      if (!frames.length) { setFrames([]); tilts(); note(`${s4} has not swept ${R.l2angle.toFixed(1)}° in the volumes on hand yet — pick another tilt.`); return; }
      R.valid = frames[frames.length - 1].t;
      const was = R.frame, wasLast = !R.frames.length || was === R.frames.length - 1;
      setFrames(frames);
      if (!wasLast && onlyIfNew) show(Math.min(was, R.frames.length - 1));
      tilts(); renderSources();
    }

    /* the tilt row: four Level III tilts (labelled with the elevation the
       shown scan was made at), or every angle of the full volume; and the
       Full volume switch for the products that have one */
    function tilts() {
      const row = $("#tiltrow");
      if (!row) return;
      const P = l3();
      /* the row is the radar picker as well, so it shows for every one-radar
         product; the tilt buttons only where there is more than one tilt */
      row.hidden = !P;
      if (row.hidden) return;
      siteOptions();
      const cp = $("#clutterpick"); if (cp) { cp.hidden = R.mode !== "l3:ref"; $("#cluttersel").value = R.clutter; }
      const db = $("#dealiasbtn"); if (db) { db.hidden = !((R.mode === "l3:vel" || R.mode === "l3:srv") && useL2()); db.setAttribute("aria-pressed", String(!!R.dealias)); }
      const btns = $("#tiltbtns");
      if (P.tilts.length < 2 && !P.l2) { btns.innerHTML = ""; return; }
      const f = R.frames[R.frame], el0 = f && f.l3 && f.l3.file ? f.l3.file.elev : null, b = [];
      if (useL2()) {
        for (const a of R.l2angles || []) b.push(`<button type="button" data-angle="${a}" aria-pressed="${Math.abs(a - R.l2angle) < 0.15}">${a.toFixed(1)}°</button>`);
        if (!(R.l2angles || []).length) b.push(`<span class="seglab">reading the volume…</span>`);
      } else {
        P.tilts.forEach((_, k) => { const on = k === Math.min(R.tilt, P.tilts.length - 1); b.push(`<button type="button" data-tilt="${k}" aria-pressed="${on}">${on && el0 != null ? el0.toFixed(1) + "°" : ["Lowest", "2nd", "3rd", "4th"][k]}</button>`); });
      }
      if (P.l2 && P.tilts.length) b.push(`<button type="button" data-l2toggle aria-pressed="${useL2()}" title="Every tilt the radar scans, at full resolution, seconds after the sweep — about 1 MB a frame">Full volume</button>`);
      btns.innerHTML = `<span class="seglab">Tilt</span>${b.join("")}`;
    }
    /* the radar picker: follow the map (the nearest radar to its middle, as
       before), or keep one radar however far the map is dragged — the way a
       forecaster works one storm from one site (2026-10-23). The list is the
       nearest radars to the map's middle when it was last asked. */
    function siteOptions() {
      const sel = $("#sitesel");
      if (!sel || document.activeElement === sel) return;
      const list = (R.sites || []).slice(0, 15);
      if (R.lockId && R.site && R.site.id === R.lockId && !list.some((x) => x.id === R.lockId)) list.unshift(R.site);
      const here = { lat: yLat(R.cy, R.z), lon: xLng(R.cx, R.z) };
      sel.innerHTML = `<option value="">Nearest to the map${!R.lockId && R.site ? ` · ${esc(R.site.id)}` : ""}</option>`
        + list.map((x) => `<option value="${esc(x.id)}"${x.id === R.lockId ? " selected" : ""}>${esc(x.id)} · ${esc(x.name)} · ${dist(Wx.distanceM(here.lat, here.lon, x.lat, x.lon) / 1000)}</option>`).join("");
      sel.value = R.lockId || "";
    }

    /* ── model maps (modelmaps.js) ──
       Frames are the run's forecast hours; each loads its field when shown
       (or when the loop plays) and is painted from the model's own grid:
       shading, then contours and wind barbs on top. */
    async function modelFrames() {
      const M = R.mm, src = M.src, ask = R.modeAsk;
      M.late = 0;
      $("#mmrun").textContent = "Finding the latest run…";
      /* the mesoanalysis is a run of analysis hours, not one run's forecast */
      if (MM.SOURCES[src].analysis) {
        /* the server keeps a day; an older moment is worked out from the HRRR's archive (2014 on) */
        if (M.at && MM.SOURCES[src].server && Date.now() - M.at > 20 * 3600e3) { M.src = "meso"; if ($("#mmsrc")) $("#mmsrc").value = "meso"; if (!MM.field("meso", M.field)) M.field = "stpe"; modelOptions(); return modelFrames(); }
        let runs = [];
        try { runs = await MM.analyses(src, M.at ? { nowMs: M.at + 3600e3 } : {}); } catch (e) {}
        if (R.mode !== "model" || M.src !== src || ask !== R.modeAsk) return;
        /* the server's has nothing recent: work it out here from the HRRR instead, and say so */
        if (MM.SOURCES[src].server && !M.at && (!runs.length || Date.now() - runs[runs.length - 1] > MM.SOURCES[src].staleMs)) {
          M.src = "meso"; if ($("#mmsrc")) $("#mmsrc").value = "meso";
          if (!MM.field("meso", M.field)) M.field = "stpe";
          modelOptions();
          note("The hourly mesoanalysis is not on the server right now, so this one is worked out in your browser from the HRRR (a few fields approximated, as their names say).");
          return modelFrames();
        }
        if (!runs.length) { setFrames([]); $("#mmrun").textContent = ""; note("NOAA's HRRR archive did not answer. Try again in a minute."); return; }
        M.run = runs[runs.length - 1]; R.valid = M.run;
        setFrames(runs.map((run) => ({ t: run, model: { src, field: M.field, run, fh: 0 } })));
        show(R.frames.length - 1);
        modelRunText(); legend(); renderSources();
        return;
      }
      /* the hour on screen, kept across a change of run: the same moment, another run's say of it */
      const was = R.frames[R.frame] && R.frames[R.frame].model && R.frames[R.frame].model.src === src ? R.frames[R.frame].t : null;
      /* a listing that failed is "did not answer"; a listing that answered
         with no run far enough out is not — the runs it looked at are late,
         so the one before them is drawn and said to be late (2026-10-24) */
      let run = null, failed = false;
      try {
        run = await MM.latestRun(src, M.at ? { nowMs: M.at } : {});
        if (!run && !M.at) { const Sx = MM.SOURCES[src]; run = await MM.latestRun(src, { nowMs: Date.now() - Sx.lookBack * Sx.cycle * 3600e3 }); }
        /* the Run list: every run of the last five days back from this one */
        if (run) { M.newest = run.run; runOptions(); }
        /* a run picked by its own time (2026-10-24) — or, from a Trend panel, n runs before the newest */
        if (run && M.pin && M.pin <= run.run) {
          const r = await MM.runAt(src, M.pin);
          if (r) run = r;
          else { note(`${MM.SOURCES[src].label}'s ${new Date(M.pin).toISOString().slice(11, 13)}Z run of ${dayFmt(M.pin)} is not in NOAA's archive — showing the latest instead.`); M.pin = null; runOptions(); }
        } else for (let k = 0; run && k < M.back; k++) run = await MM.latestRun(src, { nowMs: run.run - 1 });
      } catch (e) { run = null; failed = true; }
      if (R.mode !== "model" || M.src !== src || ask !== R.modeAsk) return;
      if (!run && M.at && !failed) { setFrames([]); modelRunText(); note(`NOAA's ${MM.SOURCES[src].label} archive has no run from ${dayFmt(M.at)} — the HRRR's goes back to 2014, the GFS's to 2021, ECMWF's open data only a few days.`); return; }
      if (!run && !failed) { setFrames([]); $("#mmrun").textContent = ""; note(`${MM.SOURCES[src].label} has no run out in its archive from the last ${MM.SOURCES[src].lookBack * 2 * MM.SOURCES[src].cycle} hours — its runs are late. Pick another model for now.`); return; }
      if (!run) { setFrames([]); $("#mmrun").textContent = ""; note(src === "rap" ? "The RAP reaches this page through the site's own server, which did not answer. Try again in a minute, or pick another model." : `NOAA's ${MM.SOURCES[src].label} archive did not answer. Try again in a minute.`); return; }
      M.run = run.run; R.valid = run.run;
      M.late = !M.at && !M.back && !M.pin ? MM.lateBy(src, run.run) : 0;
      setFrames(run.hours.map((fh) => ({ t: run.run + fh * 3600e3, model: { src, field: M.field, run: run.run, fh, diff: M.diff } })));
      const aim = was != null ? was : M.at || Date.now();
      let best = 0;
      R.frames.forEach((f, i) => { if (Math.abs(f.t - aim) < Math.abs(R.frames[best].t - aim)) best = i; });
      show(best);
      modelRunText(); legend(); renderSources();
      if (C.on) chartAt(C.lat, C.lon, C.name);                  // the chart follows the run on the map
    }
    /* ── the Run list (2026-10-24, Ric: "be able to select each run
       individually"): Latest, then every run of the last five days by its
       own time, a day to a group. Latest follows new runs as they come out;
       a picked run stays put. ── */
    const runHH = (t) => new Date(t).toISOString().slice(11, 13) + "Z";
    function runOptions() {
      const sel = $("#mmback"), M = R.mm;
      if (!sel || !MM) return;
      const list = MM.runsBack(M.src, M.newest), groups = new Map();
      for (const run of list.slice(1)) {
        const d = new Date(run).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
        if (!groups.has(d)) groups.set(d, []);
        /* the HRRR's 00, 06, 12 and 18Z runs go to 48 hours, the others to 18 */
        groups.get(d).push(`<option value="${run}">${runHH(run)}${M.src === "hrrr" && new Date(run).getUTCHours() % 6 === 0 ? " · to 48 h" : ""}</option>`);
      }
      sel.innerHTML = `<option value="0">Latest${M.newest ? " · " + runHH(M.newest) : ""}</option>`
        + [...groups].map(([d, opts]) => `<optgroup label="${esc(d)} (UTC)">${opts.join("")}</optgroup>`).join("");
      sel.value = M.pin && list.includes(M.pin) ? String(M.pin) : M.back && list[M.back] ? String(list[M.back]) : "0";
    }
    function modelRunText() {
      const M = R.mm, el = $("#mmrun");
      if (!el) return;
      if (M.at) {
        el.innerHTML = `${M.run ? esc(MM.SOURCES[M.src].analysis ? `Analysis hours to ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)}` : `${MM.SOURCES[M.src].label} run ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)}`) + (MM.SOURCES[M.src].analysis ? " — the hours up to the replay's moment · " : " — the newest run that began before the replay's moment (it may have been published after it) · ") : ""}<button type="button" class="linkish" data-mmnow>Latest run instead</button>`;
        if ($("#mmbackl")) $("#mmbackl").hidden = !!MM.SOURCES[M.src].analysis;
        return;
      }
      const sv = MM.SOURCES[M.src].server && MM.serverIndex.hours.find((x) => x.valid === M.run);
      el.textContent = !M.run ? "" : sv
        ? `Mesoanalysis hours, the last ${R.frames.length} · newest ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)}, made ${clk().time(sv.made)}${sv.rtma ? "" : " (before NOAA's surface analysis was out — the model's own ground-level air)"} · not a forecast`
        : MM.SOURCES[M.src].analysis
        ? `HRRR analysis hours, the last ${R.frames.length} · newest ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)} · the model's picture of now, observations folded in — not a forecast`
        : `${MM.SOURCES[M.src].label} run ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)}${M.pin && M.newest && M.pin < M.newest ? ` — a chosen run, ${Wx.age(M.newest - M.pin)} before the latest` : M.back ? ` — ${["", "the run before the latest", "two runs before the latest", "three runs before the latest"][M.back]}` : ""} · ${R.frames.length} hours out${M.pin || M.back ? "" : " so far"} · a forecast${M.late ? " · newer runs are late" : ""}${M.diff ? ` · shown as ${M.diff === "prev" ? "the change from the run before" : `this minus ${MM.SOURCES[M.diff].label}`}, blue lower, red higher` : ""}`;
      if ($("#mmbackl")) $("#mmbackl").hidden = !!MM.SOURCES[M.src].analysis;
    }

    /* ── a model's every hour at one point (2026-10-23) ──
       Tap a point on a model map, then "Chart here": the field at that point
       through every hour of the run on the map, and — ticked — the run
       before it, over the same hours, so a forecast that is changing shows
       as two lines apart. Hours already on the map are read from what is
       loaded; the rest are fetched a few at a time, read, and let go (a GFS
       field is megabytes a hour, and nobody needs eighty of them kept). */
    const C = { on: false, gen: 0, lat: 0, lon: 0, name: "", cur: [], prev: [], prevRun: null, cmp: false, err: null, done: 0, total: 0 };
    const chartEl = $("#ptchart");
    function chartUnit(f) { return MM.unitFor(f.unit, U()); }
    /* a point's value at each of these hours, `put` as each arrives, four at a time */
    async function chartSeries(src, run, hours, field, lat, lon, gen, put, have = () => null) {
      let next = 0;
      const one = async () => {
        while (next < hours.length && gen === C.gen) {
          const fh = hours[next++];
          let v = null;
          try {
            const L = have(fh) || await MM.load(src, run, fh, field);
            v = MM.valueAt(L, lat, lon);
          } catch (e) { v = null; }
          if (gen !== C.gen) return;
          put({ t: run + fh * 3600e3, fh, v: Number.isFinite(v) ? v : null });
        }
      };
      await Promise.all([one(), one(), one(), one()]);
    }
    async function chartAt(lat, lon, name) {
      if (!chartEl || !MM || R.mode !== "model") return;
      const M = R.mm, f = MM.field(M.src, M.field), gen = ++C.gen;
      Object.assign(C, { on: true, lat, lon, name: name && name !== "This point" ? name : "the tapped point", cur: [], prev: [], prevRun: null, err: null, done: 0 });
      chartEl.hidden = false;
      if (!f || MM.PAL[f.pal].cat || f.pal === "ptype") { C.err = `${f ? f.label : "This field"} is made of categories — there is no line to draw. Pick a field with a number.`; renderChart(); return; }
      const frames = R.frames.filter((x) => x.model && x.model.run === M.run);
      const hours = frames.map((x) => x.model.fh);
      C.total = hours.length * (C.cmp && !MM.SOURCES[M.src].analysis ? 2 : 1);
      renderChart();
      const byFh = new Map(frames.map((x) => [x.model.fh, x]));
      /* a difference map's own layer is the difference: the chart wants the field itself */
      const have = (fh) => { const x = byFh.get(fh); return x && x.model.layer && x.model.field === M.field ? (x.model.layer.base || x.model.layer) : null; };
      const analysis = !!MM.SOURCES[M.src].analysis;
      const tasks = [];
      if (analysis) {
        /* the analysis hours are runs of their own, each at hour 0 */
        tasks.push((async () => {
          for (const x of frames) {
            if (gen !== C.gen) return;
            let v = null;
            try { v = MM.valueAt(x.model.layer && x.model.field === M.field ? x.model.layer : await MM.load(M.src, x.model.run, 0, M.field), lat, lon); } catch (e) {}
            if (gen !== C.gen) return;
            C.cur.push({ t: x.t, fh: 0, v: Number.isFinite(v) ? v : null }); C.done++; renderChart();
          }
        })());
      } else {
        tasks.push(chartSeries(M.src, M.run, hours, M.field, lat, lon, gen, (p) => { C.cur.push(p); C.done++; renderChart(); }, have));
        if (C.cmp) tasks.push((async () => {
          let pr = null;
          try { pr = await MM.latestRun(M.src, { nowMs: M.run - 1 }); } catch (e) {}
          if (gen !== C.gen) return;
          if (!pr) { C.err = "The run before did not answer."; renderChart(); return; }
          C.prevRun = pr.run;
          const last = M.run + Math.max(...hours) * 3600e3;
          const ph = pr.hours.filter((fh) => pr.run + fh * 3600e3 >= M.run && pr.run + fh * 3600e3 <= last);
          C.total = hours.length + ph.length; renderChart();
          await chartSeries(M.src, pr.run, ph, M.field, lat, lon, gen, (p) => { C.prev.push(p); C.done++; renderChart(); });
        })());
      }
      await Promise.all(tasks);
      if (gen === C.gen) renderChart();
    }
    function chartStop() { C.on = false; C.gen++; if (chartEl) { chartEl.hidden = true; chartEl.innerHTML = ""; } requestAnimationFrame(draw); }
    function renderChart() {
      if (!chartEl || !C.on) return;
      const M = R.mm, f = MM.field(M.src, M.field), k = clk();
      const runName = (t) => `${new Date(t).toISOString().slice(11, 13)}Z`;
      const head = `<div class="xh"><span>${esc(f ? f.label : "")} at ${esc(C.name)}<small>${esc(MM.SOURCES[M.src].label)} ${MM.SOURCES[M.src].analysis ? "analysis hours" : "run " + runName(M.run)}${C.prevRun ? ` · and the run before, ${runName(C.prevRun)}, dashed` : ""} · ${C.lat.toFixed(2)}, ${C.lon.toFixed(2)}${C.done < C.total ? ` · reading ${C.done} of ${C.total} hours…` : ""}</small></span><button type="button" data-chartx aria-label="Close the chart">×</button></div>`;
      const cmp = MM.SOURCES[M.src].analysis ? "" : `<label class="cmp"><input type="checkbox" data-chartcmp${C.cmp ? " checked" : ""}> Compare with the run before</label>`;
      if (C.err && !C.cur.length) { chartEl.innerHTML = head + `<p class="ps">${esc(C.err)}</p>`; return; }
      const [uname, conv] = chartUnit(f);
      const pts = (a) => a.filter((p) => p.v != null).sort((a, b) => a.t - b.t).map((p) => ({ t: p.t, v: conv(p.v) }));
      const A = pts(C.cur), B = pts(C.prev), all = A.concat(B);
      if (!all.length) { chartEl.innerHTML = head + cmp + `<p class="ps">${C.done < C.total ? "Reading the first hours…" : "No value at this point — it may be outside the model's grid."}</p>`; return; }
      /* drawn at the panel's own width, so its 11px type stays 11px */
      const W = Math.max(320, Math.round(chartEl.clientWidth || 640)), H = 220, pl = 46, pr = 12, pt = 12, pb = 34;
      const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t), t0 + 3600e3);
      let lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
      if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.08, floor0 = all.every((p) => p.v >= 0);   // no negative CAPE on the axis when none was read
      lo -= pad; hi += pad; if (floor0) lo = Math.max(0, lo);
      const X = (t) => pl + (t - t0) / (t1 - t0) * (W - pl - pr), Y = (v) => pt + (hi - v) / (hi - lo) * (H - pt - pb);
      const nice = (v) => Math.abs(v) >= 100 ? Math.round(v) : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
      const g = [];
      for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = Y(v); g.push(`<line x1="${pl}" x2="${W - pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="gl"/><text x="${pl - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(String(nice(v)))}</text>`); }
      /* a tick every 3, 6, 12 or 24 hours, so the axis holds about eight */
      const span = (t1 - t0) / 3600e3, step = [3, 6, 12, 24, 48].find((s) => span / s <= 8) || 48;
      for (let t = Math.ceil(t0 / (step * 3600e3)) * step * 3600e3; t <= t1; t += step * 3600e3) {
        const x = X(t);
        g.push(`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${pt}" y2="${H - pb}" class="gl"/><text x="${x.toFixed(1)}" y="${H - pb + 15}" text-anchor="middle">${esc(k.time(t))}</text><text x="${x.toFixed(1)}" y="${H - pb + 28}" text-anchor="middle" class="d">${esc(k.day(t))}</text>`);
      }
      const fr = R.frames[R.frame];
      if (fr && fr.t >= t0 && fr.t <= t1) g.push(`<line x1="${X(fr.t).toFixed(1)}" x2="${X(fr.t).toFixed(1)}" y1="${pt}" y2="${H - pb}" class="now"/>`);
      const line = (P, cls) => P.length ? `<polyline class="${cls}" points="${P.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}"/>` + (cls === "cur" ? P.map((p) => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.4"/>`).join("") : "") : "";
      const top = A.reduce((m, p) => (m && m.v >= p.v ? m : p), null), bot = A.reduce((m, p) => (m && m.v <= p.v ? m : p), null);
      const say = (p) => `${nice(p.v)} ${uname} at ${k.day(p.t)} ${k.time(p.t)}`;
      const sum = top ? `Highest ${say(top)}; lowest ${say(bot)}.` : "";
      chartEl.innerHTML = head + cmp
        + `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`${f.label} at ${C.name}, hour by hour. ${sum}`)}" data-t0="${t0}" data-t1="${t1}" data-pl="${pl}" data-pr="${pr}" data-w="${W}">${g.join("")}${line(B, "prev")}${line(A, "cur")}<text x="${pl}" y="${pt - 2}" class="u">${esc(uname)}</text></svg>`
        + `<p class="ps">${esc(sum)} Tap the chart to put that hour on the map.</p>`;
    }
    if (chartEl) chartEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-chartx]")) { chartStop(); return; }
      const cb = e.target.closest("[data-chartcmp]");
      if (cb) { C.cmp = cb.checked; chartAt(C.lat, C.lon, C.name); return; }
      const svg = e.target.closest("svg.chart");
      if (!svg || R.mode !== "model") return;
      const W = Number(svg.dataset.w), r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
      const t0 = Number(svg.dataset.t0), t1 = Number(svg.dataset.t1), pl = Number(svg.dataset.pl), pr = Number(svg.dataset.pr);
      const t = t0 + (x - pl) / (W - pl - pr) * (t1 - t0);
      let best = -1;
      R.frames.forEach((f, i) => { if (best < 0 || Math.abs(f.t - t) < Math.abs(R.frames[best].t - t)) best = i; });
      if (best >= 0) { play(false); loadOld(); userShow(best); renderChart(); }
    });
    /* ── difference maps (2026-10-24): the layer on screen minus the same
       field at the same moment from the run before, or from another model's
       newest run that began by this one's start — the information each had
       at the same time. The reference's run is found once per run. ── */
    const refRuns = new Map();
    function refRun(src, nowMs) {
      const k = `${src}|${nowMs}`;
      if (!refRuns.has(k)) { refRuns.set(k, MM.latestRun(src, { nowMs }).catch((e) => { refRuns.delete(k); throw e; })); if (refRuns.size > 40) refRuns.delete(refRuns.keys().next().value); }
      return refRuns.get(k);
    }
    async function diffLayer(m, L) {
      const valid = L.valid || m.run + m.fh * 3600e3, rsrc = m.diff === "prev" ? m.src : m.diff, S = MM.SOURCES[rsrc];
      const r = await refRun(rsrc, m.diff === "prev" ? m.run - 1 : m.run + 1);
      if (!r) throw new Error(m.diff === "prev" ? "the run before is not in the archive" : `${S.label} has no run from then`);
      const fh = Math.round((valid - r.run) / 3600e3);
      if (!r.hours.includes(fh)) throw new Error(`${S.label}'s ${new Date(r.run).toISOString().slice(11, 13)}Z run has no hour at this moment`);
      const B = await MM.load(rsrc, r.run, fh, m.field);
      return MM.difference(L, B, m.diff === "prev" ? `change from the ${new Date(r.run).toISOString().slice(11, 13)}Z run` : `minus ${S.label}'s ${new Date(r.run).toISOString().slice(11, 13)}Z run`);
    }
    function modelLayer(f) {
      const m = f.model;
      if (!m.p) m.p = MM.load(m.src, m.run, m.fh, m.field).then((L) => (m.diff ? diffLayer(m, L) : L)).then((L) => {
        m.layer = L; m.lut = lutFor(L);
        if (R.frames[R.frame] === f) { draw(); show(R.frame); if (L.field.diff) legend(); }
        return L;
      }).catch((e) => { m.err = String(e.message || e).replace(/^models: /, ""); if (R.frames[R.frame] === f) note(`This hour did not load (${m.err}).`); });
      return m.p;
    }
    /* ── MRMS (mrms.js): the newest files of the product picked — every two
       minutes for most, hourly for the rain totals — loaded when shown and
       drawn by the same painter as a model field ── */
    async function mrmsFrames(onlyIfNew) {
      const id = R.mr.prod, P = MR && MR.PRODUCTS[id];
      if (!P) return;
      let list = [], failed = false;
      try { list = await MR.files(id, { mins: P.every ? 180 : 30 }); } catch (e) { failed = true; }
      if (R.mode !== "mrms" || R.mr.prod !== id) return;
      if (!list.length) { setFrames([]); note(failed ? "NOAA's MRMS archive did not answer. Try again in a minute." : "No recent MRMS files for this product."); return; }
      list = list.slice(P.every ? -3 : -8);
      if (onlyIfNew && list[list.length - 1].t === R.valid) return;
      R.valid = list[list.length - 1].t;
      setFrames(list.map((file) => ({ t: file.t, mrms: { id, file } })));
      const el = $("#mrrun");
      if (el) el.textContent = `NOAA MRMS · newest ${clk().time(R.valid)} · every ${P.every ? "hour" : "2 minutes"} · the lower 48`;
      renderSources(); label();
    }
    function mrmsLayer(f) {
      const m = f.mrms;
      if (!m.p) m.p = cached(m.file.url, () => MR.load(m.id, m.file)).then((L) => {
        m.layer = L; m.lut = lutFor(L);
        if (R.frames[R.frame] === f) { draw(); show(R.frame); }
        return L;
      }).catch((e) => { m.err = String(e.message || e).replace(/^mrms: /, ""); if (R.frames[R.frame] === f) note(`This MRMS file did not load (${m.err}).`); });
      return m.p;
    }
    /* ── GOES imagery (abi.js): the sector's newest files — the lower 48
       every five minutes, a mesoscale sector every minute — each loaded
       when shown, only the bands its product needs. A big RGB over the
       lower 48 is four bands of 3.5 MB, so that loop is kept short. ── */
    const abiCache = new Map(), abiMemo = {};
    const abiSat = () => R.ab.sat !== "auto" ? R.ab.sat : xLng(R.cx, R.z) >= AB.SPLIT_LON ? "east" : "west";
    async function abiFrames(onlyIfNew) {
      const A = R.ab, sat = abiSat(), C = AB.SECTORS[A.sector], P = AB.PRODUCTS[A.prod];
      if (!C || !P) return;
      const count = A.sector === "conus" ? (P.bands.length > 2 ? 4 : 6) : C.frames;
      let list = [], failed = false;
      try { list = await AB.files(sat, A.sector, { count }); } catch (e) { failed = true; }
      if (R.mode !== "abi" || R.ab.prod !== A.prod || R.ab.sector !== A.sector || abiSat() !== sat) return;
      if (!list.length) { setFrames([]); note(failed ? "NOAA's GOES archive did not answer. Try again in a minute." : "No recent files for this sector."); return; }
      if (onlyIfNew && list[list.length - 1].t === R.valid) return;
      R.valid = list[list.length - 1].t;
      setFrames(list.map((file) => ({ t: file.t, abi: { prod: A.prod, file } })));
      show(R.frames.length - 1);
      abiRunText(); renderSources(); label();
    }
    function abiRunText(box) {
      const el2 = $("#abirun");
      if (!el2) return;
      const C = AB.SECTORS[R.ab.sector];
      el2.textContent = R.valid ? `${AB.SATS[abiSat()].label} · ${C.label.toLowerCase()} · newest ${clk().time(R.valid)}` : "";
      if ($("#abigo")) $("#abigo").hidden = !(R.ab.sector !== "conus" && (box || R.abiBox));
    }
    function abiLayer(f) {
      const m = f.abi, key = `${m.file.url}|${m.prod}`;
      if (!m.p) {
        if (!abiCache.has(key)) {
          abiCache.set(key, AB.load(m.file, m.prod, { memo: (abiMemo[m.file.sat + m.file.sector] = abiMemo[m.file.sat + m.file.sector] || {}) }).catch((e) => { abiCache.delete(key); throw e; }));
          /* about eight big frames at most: a CONUS RGB is 45 MB in memory */
          if (abiCache.size > 24) abiCache.delete(abiCache.keys().next().value);
        }
        m.p = abiCache.get(key).then((L) => {
          m.layer = L;
          if (L.box) {
            const first = !R.abiBox || R.abiBox.w !== L.box.w;
            R.abiBox = L.box; abiRunText(L.box);
            /* a mesoscale sector off the screen: go to it, once */
            if (first && f.abi.file.sector !== "conus") {
              const lat = yLat(R.cy, R.z), lon = xLng(R.cx, R.z);
              if (lat > L.box.n || lat < L.box.s || lon < L.box.w || lon > L.box.e) fit(L.box.s, L.box.w, L.box.n, L.box.e, 20);
            }
          }
          if (R.frames[R.frame] === f) { draw(); show(R.frame); }
          return L;
        }).catch((e) => { m.err = String(e.message || e).replace(/^(abi|glm): /, ""); if (R.frames[R.frame] === f) note(`This GOES image did not load (${m.err}).`); });
      }
      return m.p;
    }
    let shadeCv = null;
    /* a model hour or an MRMS file: shading from the grid, then contours and barbs */
    function paintModel(f, w, h, left, top) {
      const cv = frameCanvas(f, w, h), ctx = cv.getContext("2d"), m = f.model || f.mrms || f.abi, key = `${R.z}|${left}|${top}|${U()}`;
      if (!m.layer) { if (f.model) modelLayer(f); else if (f.abi) abiLayer(f); else mrmsLayer(f); if (f.painted) { ctx.clearRect(0, 0, w, h); f.painted = null; } return; }
      if (f.painted === key) return;
      f.painted = key;
      const L = m.layer, g = GB.projector(L.grid), nx = L.grid.nx, ny = L.grid.ny, v = L.values, lut = m.lut, rgba = L.rgba, near = rgba || L.field.nearest;
      const latlon = L.grid.kind === "latlon";
      /* the shading at half resolution below zoom 8 (model grids are smooth;
         it is four times less work), stretched to the screen */
      const S = R.z >= (rgba ? 6 : 8) ? 1 : 2, W = Math.ceil(w / S), H = Math.ceil(h / S);
      if (!shadeCv) shadeCv = document.createElement("canvas");
      shadeCv.width = W; shadeCv.height = H;
      const sctx = shadeCv.getContext("2d"), img = sctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
      const lons = new Float64Array(W);
      for (let x = 0; x < W; x++) lons[x] = xLng(left + (x + 0.5) * S, R.z);
      for (let y = 0; y < H; y++) {
        const lat = yLat(top + (y + 0.5) * S, R.z), row = y * W;
        for (let x = 0; x < W; x++) {
          const [fi, fj] = g.ij(lat, lons[x]);
          let val;
          if (near) {
            const i = Math.round(fi), j = Math.round(fj);
            if (!(i >= 0 && j >= 0 && i < nx && j < ny)) continue;
            if (rgba) { const c = rgba[j * nx + i]; if (c) px[row + x] = c; continue; }
            val = v[j * nx + i];
          } else {
            const i = Math.floor(fi), j = Math.floor(fj);
            if (i < 0 || j < 0 || j + 1 >= ny) continue;
            const i1 = latlon && i + 1 >= nx ? 0 : i + 1;
            if (i1 >= nx) continue;
            const a = v[j * nx + i], b = v[j * nx + i1], c = v[(j + 1) * nx + i], d = v[(j + 1) * nx + i1], tx = fi - i, ty = fj - j;
            val = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
          }
          const col = lut.lookup(val);
          if (col) px[row + x] = col;
        }
      }
      sctx.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(shadeCv, 0, 0, W, H, 0, 0, W * S, H * S);
      /* contours, labelled once per stretch of screen */
      for (const c of L.contours || []) {
        const s = c.lines.segs, lev = c.lines.levels, n = lev.length, seen = new Set();
        ctx.lineWidth = c.width || 1.3; ctx.strokeStyle = c.color; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        const labels = [];
        for (let k = 0; k < n; k++) {
          const xa = lngX(s[k * 4 + 1], R.z) - left, ya = latY(s[k * 4], R.z) - top, xb = lngX(s[k * 4 + 3], R.z) - left, yb = latY(s[k * 4 + 2], R.z) - top;
          if ((xa < 0 && xb < 0) || (ya < 0 && yb < 0) || (xa > w && xb > w) || (ya > h && yb > h) || Math.abs(xb - xa) > w / 2) continue;
          ctx.moveTo(xa, ya); ctx.lineTo(xb, yb);
          const cell = `${lev[k]}|${Math.floor(xa / 220)}|${Math.floor(ya / 160)}`;
          if (!c.nolabel && !seen.has(cell) && xa > 20 && ya > 14 && xa < w - 30 && ya < h - 8) { seen.add(cell); labels.push([xa, ya, lev[k]]); }
        }
        ctx.stroke(); ctx.globalAlpha = 1;
        ctx.font = PRO ? "600 11px \"IBM Plex Mono\",ui-monospace,Menlo,monospace" : "600 11px ui-monospace,Menlo,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (const [x, y, l] of labels) { ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,7,10,.85)"; ctx.strokeText(String(Math.round(l)), x, y); ctx.fillStyle = c.color; ctx.fillText(String(Math.round(l)), x, y); }
      }
      /* wind barbs in knots, every ~56 px, turned from the grid to the earth */
      if (L.wind) {
        const step = 56;
        ctx.strokeStyle = "#f8f9fa"; ctx.fillStyle = "#f8f9fa"; ctx.lineWidth = 1.4;
        for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
          const lat = yLat(top + y, R.z), lon = xLng(left + x, R.z);
          const u = GB.sample({ grid: L.grid, values: L.wind.u }, lat, lon), vv = GB.sample({ grid: L.grid, values: L.wind.v }, lat, lon);
          if (!Number.isFinite(u) || !Number.isFinite(vv)) continue;
          const [ue, ve] = MM.earthWind(L.grid, lat, lon, u, vv);
          barb(ctx, x, y, ue * 1.943844, ve * 1.943844);
        }
      }
    }
    /* a wind barb on a canvas: the staff points to where the wind comes
       from; a pennant is 50 kt, a full barb 10, a half barb 5 */
    function barb(ctx, x, y, u, v) {
      let kt = Math.round(Math.hypot(u, v) / 5) * 5;
      if (kt < 5) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.stroke(); return; }
      const from = Math.atan2(-u, -v), L = 22, dx = Math.sin(from), dy = -Math.cos(from), px = -dy, py = dx;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * L, y + dy * L); ctx.stroke();
      let d = L;
      while (kt >= 50) { ctx.beginPath(); ctx.moveTo(x + dx * d, y + dy * d); ctx.lineTo(x + dx * (d - 4) + px * 10, y + dy * (d - 4) + py * 10); ctx.lineTo(x + dx * (d - 8), y + dy * (d - 8)); ctx.fill(); d -= 10; kt -= 50; }
      while (kt >= 10) { ctx.beginPath(); ctx.moveTo(x + dx * d, y + dy * d); ctx.lineTo(x + dx * (d + 2) + px * 10, y + dy * (d + 2) + py * 10); ctx.stroke(); d -= 4; kt -= 10; }
      if (kt >= 5) { if (d === L) d -= 4; ctx.beginPath(); ctx.moveTo(x + dx * d, y + dy * d); ctx.lineTo(x + dx * (d + 1) + px * 5, y + dy * (d + 1) + py * 5); ctx.stroke(); }
    }

    /* ── Pro's map lines (mapgeo.js): state, county, coast and border lines
       and town names, over the data — satellite, MRMS and a model field cover
       the basemap, and with it every clue to where you are. Each layer is
       asked for the first time it is needed (counties from zoom 7) and kept.
       A dark line under each light one, so they read over red and white
       echoes alike. ── */
    const geoCv = $("#radargeo"), GEO = { layers: {}, asked: {} }, GeoOK = PRO && !!window.MapGeo;
    function geoLayer(name) {
      if (GEO.layers[name]) return GEO.layers[name];
      if (!GEO.asked[name] && GeoOK) {
        GEO.asked[name] = true;
        Wx.mapLayer(name).then((L) => { GEO.layers[name] = L; drawGeo(); })
          .catch(() => setTimeout(() => { GEO.asked[name] = false; }, 60e3));   // ask again on a later draw
      }
      return null;
    }
    function drawGeo() {
      if (!geoCv) return;
      const w = el.clientWidth, h = el.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (geoCv.width !== Math.round(w * dpr) || geoCv.height !== Math.round(h * dpr)) { geoCv.width = Math.round(w * dpr); geoCv.height = Math.round(h * dpr); }
      const ctx = geoCv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      /* while our own lines and town names are drawn, Pro sinks the tiles' (CSS: .haslines), so no town is named twice */
      /* close in (zoom 8 and up) the base map's own roads and names are the useful ones — a chaser navigates by them —
         so it draws at full strength and our coarser town names step aside (UI-REVIEW-3 item 2) */
      const close = PRO && R.z >= 8;
      el.classList.toggle("haslines", !!(GeoOK && R.ov.lines && R.started && !close));
      if (!GeoOK || !R.ov.lines || !R.started) return;
      const left = R.cx - w / 2, top = R.cy - h / 2, z = R.z, k = TILE * 2 ** z / 360;
      const W = xLng(left, z), E = xLng(left + w, z), N = yLat(top, z), Sl = yLat(top + h, z);
      const px = (lon) => (lon + 180) * k - left, py = (lat) => latY(lat, z) - top;
      const stroke = (L, style) => {
        if (!L) return;
        ctx.beginPath();
        for (const { xs, box } of L.lines) {
          if (box[2] < W || box[0] > E || box[3] < Sl || box[1] > N) continue;
          ctx.moveTo(px(xs[0]), py(xs[1]));
          for (let i = 2; i < xs.length; i += 2) ctx.lineTo(px(xs[i]), py(xs[i + 1]));
        }
        for (const [col, lw, a] of style) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = a; ctx.stroke(); }
        ctx.globalAlpha = 1;
      };
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      const want = (n) => z >= MapGeo.LAYERS[n].from ? geoLayer(n) : null;
      stroke(want("counties"), [["#05070a", 2.2, 0.35], ["#aeb8c4", 0.8, 0.55]]);
      for (const n of ["coast", "nations", "states"]) stroke(want(n), [["#05070a", 3.2, 0.55], ["#e9ecef", n === "states" ? 1.25 : 1.1, 0.85]]);
      /* Names (UI-REVIEW B8): towns, cities only, or none */
      const P = R.names === "none" || close ? null : want("places");
      if (!P) return;
      ctx.font = PRO ? "600 12px \"IBM Plex Sans\",system-ui,-apple-system,'Segoe UI',sans-serif" : "600 12px system-ui,-apple-system,'Segoe UI',sans-serif";
      ctx.textBaseline = "middle";
      const few = R.stations && z >= STN_MINZ;                     // station plots carry their own numbers
      const L = MapGeo.labels(P.places, z, w, h, (lon, lat) => [px(lon), py(lat)], (t) => ctx.measureText(t).width, { max: few ? 30 : R.names === "cities" ? 45 : 140, lift: R.names === "cities" ? 2 : 0 });
      ctx.lineWidth = 3.2; ctx.strokeStyle = "rgba(5,7,10,.9)";
      for (const t of L) {
        ctx.beginPath(); ctx.arc(t.x, t.y, 2.6, 0, 2 * Math.PI);
        ctx.fillStyle = "#f8f9fa"; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
        ctx.lineWidth = 3.2; ctx.strokeText(t.name, t.x + 6, t.y); ctx.fillText(t.name, t.x + 6, t.y);
      }
    }

    /* ── GOES lightning (glm.js) ──
       Every flash the GLM saw in the last twenty minutes, from GOES-East east
       of 105° W and GOES-West west of it, asked again every minute while
       either lightning layer is on and the page is in view. Two layers read
       them: Lightning draws the last ten minutes as dots, brighter is newer;
       Flash density counts them in 8 km squares over a window the visitor
       picks (Ric, 2026-10-22: "a density of lightning within a time frame").
       The twenty minutes are also what each storm cell's flash rate and
       lightning jump need — seven 2-minute steps and room to spare.
       `span` is the stretch of time each satellite's files cover with no gap,
       so a storm is never said to have had no flashes in minutes we never read. */
    const ltgCv = $("#radarltg");
    const LTG_KEEP = 20 * 60e3;
    const LTG = { flashes: [], last: { east: "", west: "" }, memo: { east: {}, west: {} }, span: { east: null, west: null }, busy: false, at: 0, timer: 0, failed: false, dens: null, cell: new Map(), gen: 0 };
    const ltgOn = () => PRO && (R.ov.lightning || R.ov.density);
    async function loadLightning() {
      if (!GL || !ltgOn() || !R.started || R.mode === "replay" || LTG.busy || document.hidden) return;
      LTG.busy = true;
      const gen = LTG.gen;                                           // turned off meanwhile: stop, and keep nothing
      try {
        const w = el.clientWidth, left = R.cx - w / 2, west = xLng(left, R.z), east = xLng(left + w, R.z);
        const sats = [];
        if (east >= GL.SPLIT_LON || R.z <= 4) sats.push("east");
        if (west < GL.SPLIT_LON || R.z <= 4) sats.push("west");
        let any = false, fail = false;
        /* both satellites at once, eight files at a time. A first fill (or one
           after a gap) goes newest first, so the last few minutes are on the
           map in seconds and the older ones fill in behind them; `span.from`
           follows it back. After that, each minute's new files go in order. */
        await Promise.all(sats.map(async (sat) => {
          let list = [];
          try { list = await GL.files(sat, { mins: LTG_KEEP / 60e3, after: LTG.last[sat] }); } catch (e) { fail = true; return; }
          const fresh = list.filter((f) => f.key > LTG.last[sat]);
          if (!fresh.length || gen !== LTG.gen) return;
          const sp = LTG.span[sat], back = !sp || fresh[0].t > sp.to + 40e3, newest = fresh[fresh.length - 1];
          const order = back ? fresh.slice().reverse() : fresh;
          if (back) { LTG.span[sat] = { from: newest.t, to: newest.t + 20e3 }; LTG.last[sat] = newest.key; }
          for (let i = 0; i < order.length; i += 8) {
            const batch = order.slice(i, i + 8);
            const got = await Promise.all(batch.map((f) => GL.flashes(GL.fromUrl(f.url), f.key, LTG.memo[sat]).catch(() => null)));
            if (gen !== LTG.gen) return;
            for (const fl of got) if (fl) { any = true; for (const x of fl) if (x.good && (sat === "east" ? x.lon >= GL.SPLIT_LON : x.lon < GL.SPLIT_LON)) LTG.flashes.push(x); }
            if (back) LTG.span[sat].from = batch[batch.length - 1].t;
            else { LTG.last[sat] = batch[batch.length - 1].key; LTG.span[sat].to = batch[batch.length - 1].t + 20e3; }
            LTG.at = LTG.at || Date.now();                           // the count shows as it fills
            LTG.dens = null; LTG.cell.clear();
            drawLightning(); label();
          }
        }));
        if (gen !== LTG.gen) return;
        const cut = Date.now() - LTG_KEEP;
        LTG.flashes = LTG.flashes.filter((x) => x.t >= cut);
        for (const sat of ["east", "west"]) if (LTG.span[sat]) LTG.span[sat].from = Math.max(LTG.span[sat].from, cut);
        LTG.failed = fail && !any && !LTG.flashes.length;
        LTG.at = Date.now();
      } finally {
        LTG.busy = false;
        if (gen !== LTG.gen && ltgOn()) setTimeout(loadLightning, 0);  // turned off and on again while this one read
      }
      LTG.dens = null; LTG.cell.clear();
      drawLightning(); label(); renderSources();
      if (R.ov.cells && R.cellsDrawn && R.cellsDrawn.length) draw();   // the jump rings
    }
    function lightningClock() {
      clearInterval(LTG.timer);
      if ($("#densbar")) $("#densbar").hidden = !(PRO && R.ov.density);
      if (ltgOn()) { loadLightning(); LTG.timer = setInterval(loadLightning, 60e3); }
      else { LTG.gen++; LTG.flashes = []; LTG.last = { east: "", west: "" }; LTG.span = { east: null, west: null }; LTG.at = 0; LTG.dens = null; LTG.cell.clear(); drawLightning(); }
    }
    /* the newest moment both satellites in use have been read up to */
    function ltgThrough(lon) {
      const sp = lon == null ? [LTG.span.east, LTG.span.west].filter(Boolean) : [LTG.span[lon >= GL.SPLIT_LON ? "east" : "west"]].filter(Boolean);
      return sp.length ? { from: Math.max(...sp.map((s) => s.from)), to: Math.min(...sp.map((s) => s.to)) } : null;
    }
    /* flash density over the chosen window, ending where the files end */
    const DENS_COLS = [[1, "#4c6ef5"], [2, "#15aabf"], [4, "#40c057"], [8, "#fab005"], [16, "#fd7e14"], [32, "#f03e3e"], [64, "#e64980"], [128, "#f8f0fc"]];
    function ltgDensity() {
      const th = ltgThrough();
      if (!th) return null;
      const end = Math.min(th.to, ltgRef());                                      // the window ends at the frame on screen
      if (LTG.dens && LTG.dens.windowMs === R.densWin * 60e3 && LTG.dens.end === end) return LTG.dens;
      LTG.dens = GL.density(LTG.flashes, { nowMs: end, windowMs: R.densWin * 60e3 });
      LTG.dens.end = end;
      LTG.dens.short = end - th.from < R.densWin * 60e3 - 30e3;                  // the window reaches back before the first file read
      return LTG.dens;
    }
    /* one storm cell's flash rate, 2-minute steps for the last 14 minutes,
       and whether it jumped (glm.js) — or null when the files read do not
       cover those 14 minutes yet */
    function cellLightning(c) {
      if (!GL || !ltgOn() || !LTG.at) return null;
      const key = `${c.site}:${c.id}:${c.time}`;
      if (LTG.cell.has(key)) return LTG.cell.get(key);
      const th = ltgThrough(c.lon);
      let out = null;
      if (th && th.to - th.from >= 14 * 60e3 - 30e3) {
        const rates = GL.rates(LTG.flashes, c, { endMs: th.to });
        out = { rates, j: GL.jump(rates), end: th.to };
      }
      LTG.cell.set(key, out);
      return out;
    }
    /* ── one clock (2026-10-23) ──
       The moment the frame on screen shows — an observation's time, or null
       for a forecast. Lightning and flash density show the minutes up to it,
       so a loop scrubbed back shows that moment's flashes, not now's; and a
       switch of layer lands on the frame nearest it (setMode). The newest
       frame, and any forecast, show now. */
    function frameTime(f = R.frames[R.frame]) {
      if (!f || f.future || f.nc || (f.model && !MM.SOURCES[f.model.src].analysis)) return null;
      return (f.l3 && f.l3.file && f.l3.file.time) || f.t || null;
    }
    function ltgRef() {
      if (R.frame >= R.frames.length - 1) return Date.now();
      const t = frameTime();
      return t == null ? Date.now() : t;
    }
    /* the frame nearest a moment, within a quarter of an hour, or -1 */
    function frameNear(t) {
      let best = -1, bd = 15 * 60e3;
      R.frames.forEach((f, i) => { const ft = frameTime(f); if (ft != null && Math.abs(ft - t) <= bd) { bd = Math.abs(ft - t); best = i; } });
      return best;
    }
    function drawLightning() {
      if (!ltgCv) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (ltgCv.width !== w || ltgCv.height !== h) { ltgCv.width = w; ltgCv.height = h; }
      const ctx = ltgCv.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      if (!ltgOn() || R.mode === "replay" || !LTG.flashes.length) return;
      const left = R.cx - w / 2, top = R.cy - h / 2, now = ltgRef(), r = R.z >= 7 ? 2.6 : 1.8;
      const th = ltgThrough();
      if (th && now < th.from - 60e3) return;                         // older than anything held: nothing, rather than now's flashes
      if (R.ov.density) {
        const D = ltgDensity();
        if (D) {
          ctx.globalAlpha = 0.72;
          for (const c of D.cells) {
            const x0 = lngX(c.lon0, R.z) - left, x1 = lngX(c.lon0 + c.dLon, R.z) - left, y0 = latY(c.lat0 + c.dLat, R.z) - top, y1 = latY(c.lat0, R.z) - top;
            if (x1 < 0 || y1 < 0 || x0 > w || y0 > h) continue;
            let col = DENS_COLS[0][1];
            for (const [n, cc] of DENS_COLS) if (c.n >= n) col = cc;
            ctx.fillStyle = col;
            ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
          }
          ctx.globalAlpha = 1;
        }
      }
      if (!R.ov.lightning) return;
      /* four ages, oldest drawn first so the newest sit on top */
      const COLS = ["#ffffff", "#ffe066", "#ff922b", "#e8590c"], buckets = [[], [], [], []];
      for (const f of LTG.flashes) {
        const a = now - f.t, k = a < 0 ? -1 : a <= 60e3 ? 0 : a <= 120e3 ? 1 : a <= 300e3 ? 2 : a <= 600e3 ? 3 : -1;
        if (k < 0) continue;
        const x = lngX(f.lon, R.z) - left, y = latY(f.lat, R.z) - top;
        if (x >= -3 && y >= -3 && x <= w + 3 && y <= h + 3) buckets[k].push(x, y);
      }
      for (let k = 3; k >= 0; k--) {
        const B = buckets[k];
        if (!B.length) continue;
        ctx.fillStyle = COLS[k]; ctx.beginPath();
        for (let i = 0; i < B.length; i += 2) { ctx.moveTo(B[i] + r, B[i + 1]); ctx.arc(B[i], B[i + 1], r, 0, 2 * Math.PI); }
        ctx.fill();
      }
    }

    /* ── what the pointer is over: the value under it, in words ── */
    /* a forecast hour as forecasters write it, the run first: "GFS 18Z +6 h"
       (2026-10-24) — the stamp and the readout said only "+6 h", and the
       maps beside this one, which hide the line above the map, said no run */
    function runHour(m) { return `${MM.SOURCES[m.src].label} ${new Date(m.run).toISOString().slice(11, 13)}Z +${m.fh} h`; }
    /* the warnings drawn under the cursor: their event and end, in the readout (B9) */
    function warnsAt(lat, lon) {
      if (!PRO || R.mode === "replay") return "";
      const list = [...(S.place ? (S.alerts || []) : []), ...(S.place ? (S.state || []) : (S.national || []))], seen = new Set(), k = clk(), out = [];
      for (const a of list) {
        if (!a.polygon || seen.has(a.id) || !Wx.inPolygon(lat, lon, a.polygon)) continue;
        seen.add(a.id);
        const end = a.ends || a.expires;
        out.push(`${a.event}${end ? " until " + k.time(end) : ""}`);
      }
      return out.join(" · ");
    }
    function readoutAt(lat, lon) {
      const w0 = warnsAt(lat, lon), a1 = readoutFrame(lat, lon), a2 = a1 && w0 ? `${a1} · ${w0}` : a1 || w0 || null;
      /* with Terrain on, the ground's height under the pointer, above sea level */
      const gh = PRO && R.ov.terrain ? groundAt(lat, lon) : null;
      const g = gh == null ? "" : `ground ${U() !== "metric" ? Math.round(gh * 3.28084).toLocaleString() + " ft" : Math.round(gh).toLocaleString() + " m"}`;
      const a = a2 && g ? `${a2} · ${g}` : a2 || g || null;
      const D = R.ov.density && LTG.at && R.mode !== "replay" ? ltgDensity() : null;
      if (!D) return a;
      const n = GL.densityAt(D, lat, lon), b = `${n} flash${n === 1 ? "" : "es"} in this 8 km square, ${R.densWin === 1 ? "last minute" : `last ${R.densWin} min`}`;
      return a ? `${a} · ${b}` : b;
    }
    function readoutFrame(lat, lon) {
      const f = R.frames[R.frame];
      if (!f) return null;
      if (f.l3 && f.l3.file) {
        const F = f.l3.file, P = NX.PRODUCTS[f.l3.prod];
        /* the same range and bearing the painter used, so the readout is the gate drawn there */
        const q = NX.polarOf(F.lat, F.lon, F.elev || 0, lat, lon), km = q.km, az = q.az, v = NX.valueAt(F, f.l3.prod, km, az);
        if (km > F.nBins * F.gateKm) return null;
        const beam = NX.beamHeightKm(km, F.elev) + F.heightM / 1000;
        let what = !v ? "no echo" : v.rf ? "range folded" : v.cls ? `${v.cls[1]} (${v.cls[0]})`
          : `${P.short} ${f.l3.prod === "cc" ? v.value.toFixed(2) : f.l3.prod === "zdr" || f.l3.prod === "kdp" ? v.value.toFixed(1) : Math.round(v.value)}${P.unit ? " " + P.unit : ""}${v.topped ? " (topped)" : ""}`;
        /* with filtering on, the gate's CC is the reason, said plainly — and "likely", because it is a filter, not a verdict */
        const cm = v && !v.rf && clutterOf(f);
        if (cm && cm.cc && F.cc) {
          const c = F.cc.lut[NX.gate(F.cc, km, az)];
          if (Number.isFinite(c)) what += c < NX.CLUTTER.CC_MAX ? (v.value < NX.CLUTTER.KEEP_DBZ ? ` · CC ${c.toFixed(2)}: likely not weather (birds, insects, ground clutter)${R.clutter === "filter" ? " — filtered" : ""}` : ` · CC ${c.toFixed(2)}, but strong: kept (debris looks like this too)`) : ` · CC ${c.toFixed(2)}`;
        }
        /* the beam's centre above sea level: the radar's own height plus the beam's rise */
        return `${what} · ${dist(q.groundKm)} ${Math.round(az)}° from ${F.site || "the radar"} · beam ${U() !== "metric" ? Math.round(beam * 3.28084) + " kft" : beam.toFixed(1) + " km"} MSL`;
      }
      if (f.abi && f.abi.layer) {
        const vs = AB.valuesAt(f.abi.layer, lat, lon);
        if (!vs) return null;
        const say = (x) => x.kind === "refl" ? `${Math.round(x.value)}%` : `${Math.round(x.value)} °C${U() === "us" ? ` (${Math.round(x.value * 9 / 5 + 32)} °F)` : ""}`;
        return vs.length === 1 ? `${AB.bandName(vs[0].band)}: ${say(vs[0])} ${vs[0].kind === "refl" ? "reflectance" : "brightness temperature"}` : vs.map((x) => `B${x.band} ${say(x)}`).join(" · ");
      }
      if (f.mrms && f.mrms.layer) {
        const L = f.mrms.layer, v = MM.valueAt(L, lat, lon);
        return Number.isFinite(v) ? `${L.field.label}: ${MM.say(L.field.unit, v, U())} · MRMS ${clk().time(f.t)}` : null;
      }
      if (f.model && f.model.layer) {
        const L = f.model.layer, v = MM.valueAt(L, lat, lon);
        if (!Number.isFinite(v)) return null;
        if (L.field.pal === "ptype") { const t = MM.PAL.ptype.types[Math.floor(v / 100)]; return `${t ? t[0] : "Precipitation"} · ${Math.round(v % 100)} dBZ · ${runHour(f.model)}`; }
        return `${L.field.label}: ${L.field.diff && v > 0 ? "+" : ""}${MM.say(L.field.unit, v, U())} · ${MM.SOURCES[f.model.src].analysis ? `${MM.SOURCES[f.model.src].server ? "mesoanalysis" : "HRRR analysis"} ${new Date(f.t).toISOString().slice(11, 13)}Z` : runHour(f.model)}`;
      }
      return null;
    }

    /* ── Terrain (2026-10-24, Ric: "Geological and elevation layers?" then
       "Both"): the ground's shape, shaded under the data, from the open
       Terrain Tiles on AWS (terrain.js says what they are). A tile is decoded
       to heights once and kept a while: the shading is drawn from them, and
       the readout and the cross-section read them. Shadow and light only,
       never a colour, so nothing on the map can be mistaken for radar. ── */
    const TR = window.Terrain, terrL = $("#radarterrain"), terrTiles = new Map(), terrElev = new Map(), terrDone = new Map();
    function terrainElev(z, x, y) {
      const key = `${z}/${x}/${y}`;
      if (!terrElev.has(key)) {
        const p = fetch(TR.url(z, x, y)).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); }).then((b) => createImageBitmap(b)).then((bm) => {
          const cv = document.createElement("canvas"); cv.width = cv.height = TR.TILE;
          const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(bm, 0, 0);
          const e = TR.decode(g.getImageData(0, 0, TR.TILE, TR.TILE).data);
          terrDone.set(key, e); if (terrDone.size > 96) terrDone.delete(terrDone.keys().next().value);
          return e;
        });
        p.catch(() => terrElev.delete(key));
        terrElev.set(key, p);
        if (terrElev.size > 96) terrElev.delete(terrElev.keys().next().value);
      }
      return terrElev.get(key);
    }
    /* the ground's height at a point, from a tile already read at this zoom — or null */
    function groundAt(lat, lon) {
      if (!TR) return null;
      const t = TR.tileOf(lat, lon, Math.min(TR.MAXZ, R.z)), e = terrDone.get(`${t.z}/${t.x}/${t.y}`);
      return e ? e[t.py * TR.TILE + t.px] : null;
    }
    function placeTerrain(w, h, left, top) {
      if (!terrL || !TR) return;
      const on = PRO && !!R.ov.terrain;
      terrL.hidden = !on;
      if ($("#terraincredit")) $("#terraincredit").hidden = !on;
      if (!on) { for (const c of terrTiles.values()) c.remove(); terrTiles.clear(); return; }
      const z = R.z, n = 2 ** z, T = TR.TILE, seen = new Set();
      /* the relief is a few pixels tall at the national view; exaggerate it there */
      const ex = z <= 5 ? 6 : z <= 7 ? 3 : z <= 9 ? 1.8 : 1.2;
      for (let tx = Math.floor(left / T); tx <= Math.floor((left + w) / T); tx++) for (let ty = Math.floor(top / T); ty <= Math.floor((top + h) / T); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n, key = `${z}/${tx}/${ty}`;
        seen.add(key);
        let c = terrTiles.get(key);
        if (!c) {
          c = document.createElement("canvas"); c.width = c.height = T; c.className = "ttile";
          terrL.appendChild(c); terrTiles.set(key, c);
          const lat = yLat((ty + 0.5) * T, z);
          terrainElev(z, wx, ty).then((e) => { if (c.isConnected) c.getContext("2d").putImageData(new ImageData(TR.shade(e, T, T, TR.metresPerPixel(lat, z), { ex }), T, T), 0, 0); }, () => {});
        }
        c.style.transform = `translate(${tx * T - left}px,${ty * T - top}px)`;
      }
      for (const [key, c] of terrTiles) if (!seen.has(key)) { c.remove(); terrTiles.delete(key); }
    }
    /* the real ground along a line, metres at `n` points — for the cross-section; null if it could not be read */
    async function groundProfile(a, b, n = 160) {
      if (!TR) return null;
      const km = Wx.distanceM(a.lat, a.lon, b.lat, b.lon) / 1000, z = km > 700 ? 8 : km > 250 ? 9 : 10;
      const pts = Array.from({ length: n }, (_, i) => { const f = i / (n - 1); return TR.tileOf(a.lat + (b.lat - a.lat) * f, a.lon + (b.lon - a.lon) * f, z); });
      try {
        const tiles = new Map();
        for (const t of pts) { const k = `${t.z}/${t.x}/${t.y}`; if (!tiles.has(k)) tiles.set(k, terrainElev(t.z, t.x, t.y)); }
        const got = new Map(await Promise.all([...tiles].map(async ([k, p]) => [k, await p])));
        return pts.map((t) => got.get(`${t.z}/${t.x}/${t.y}`)[t.py * TR.TILE + t.px]);
      } catch (e) { return null; }
    }

    function place(layer, cache, url, w, h, left, top, rain) {
      /* Weather's rain is asked one zoom finer and drawn at half size — four
         times the detail of IEM's tile for the view, as sharp as the radar
         itself on a phone's screen (Ric, 2026-10-23: "increase the quality") */
      const up = rain && RAIN_LUT && R.z < MAXZ + 1 ? 1 : 0, T = TILE / 2 ** up, zz = R.z + up;
      const n = 2 ** zz, seen = new Set();
      for (let tx = Math.floor(left / T); tx <= Math.floor((left + w) / T); tx++) {
        for (let ty = Math.floor(top / T); ty <= Math.floor((top + h) / T); ty++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          const key = `${zz}/${tx}/${ty}`;
          seen.add(key);
          let img = cache.get(key);
          if (!img) {
            img = new Image(); img.alt = ""; img.decoding = "async"; img.draggable = false;
            if (rain && RAIN_LUT) { img.crossOrigin = "anonymous"; img.onload = () => rainTile(img); }
            /* one tile failing never blanks the layer (§35.5): it hides, and is
               asked once more a few seconds later */
            const src = url(zz, wx, ty);
            if (up) { img.style.width = T + "px"; img.style.height = T + "px"; }
            img.onerror = () => {
              img.style.visibility = "hidden";
              if (img.dataset.retried) return;
              img.dataset.retried = "1";
              setTimeout(() => { if (img.isConnected) { img.style.visibility = ""; img.src = src + (src.includes("?") ? "&" : "?") + "r=1"; } }, 4000);
            };
            img.src = src;
            cache.set(key, img); layer.appendChild(img);
          }
          img.style.transform = `translate(${tx * T - left}px,${ty * T - top}px)`;
        }
      }
      for (const [key, img] of cache) if (!seen.has(key)) { dropTile(img); cache.delete(key); }
    }

    /* ── Weather's rain, redrawn (2026-10-23, Ric: "it should be closer to the
       Apple one … it should be easy to see where it's raining") ──
       IEM's mosaic tiles are the NWS's reflectivity colours at 82% over the map:
       light rain is a thin teal that disappears on a dark map. Every pixel of
       those tiles is an exact colour of IEM's N0Q palette (nowcast.js, checked
       2026-10-17), so its dBZ is known exactly and the tile is redrawn in one
       intensity ramp — light blue, blue, violet, magenta, orange, yellow,
       white — opaque from moderate rain up, the way Apple's radar reads at a
       glance. Below 12 dBZ (clear-air returns, not rain) is left clear. Pro
       keeps the NWS colours professionals read by number. */
    const NC = window.WxNowcast;
    const RAIN_STOPS = [[12, [120, 190, 255, 0.55]], [20, [60, 140, 255, 0.85]], [28, [80, 90, 245, 0.95]], [35, [150, 70, 235, 1]], [42, [220, 60, 200, 1]],
      [48, [255, 85, 110, 1]], [54, [255, 150, 50, 1]], [60, [255, 225, 70, 1]], [68, [255, 255, 255, 1]]];
    const rainRGBA = (dbz) => {
      if (!(dbz >= RAIN_STOPS[0][0])) return null;
      let k = 1;
      while (k < RAIN_STOPS.length - 1 && dbz > RAIN_STOPS[k][0]) k++;
      const [a, A] = RAIN_STOPS[k - 1], [b, B] = RAIN_STOPS[k], t = Math.max(0, Math.min(1, (dbz - a) / (b - a)));
      return A.map((v, i) => v + (B[i] - v) * t);
    };
    /* one 32-bit word (canvas byte order) per IEM colour */
    const RAIN_LUT = (() => {
      if (!NC || !NC.PALETTE) return null;
      const m = new Map();
      for (let i = 1; i < 256; i++) {
        const c = rainRGBA(NC.dbzOf(i));
        if (!c) continue;
        const rgb = parseInt(NC.PALETTE.slice(i * 6, i * 6 + 6), 16);
        m.set(rgb, ((Math.round(c[3] * 255) << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0);
      }
      return m;
    })();
    /* the key's colour stops; each layout of the key sets its own direction */
    const RAIN_CSS = RAIN_STOPS.map(([, c], i) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(c[3], .8)}) ${Math.round(i / (RAIN_STOPS.length - 1) * 100)}%`).join(",");
    function rainTile(img) {
      if (!RAIN_LUT || img.dataset.rain) return;
      try {
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth || 256; cv.height = img.naturalHeight || 256;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const im = ctx.getImageData(0, 0, cv.width, cv.height), px = new Uint32Array(im.data.buffer), d = im.data;
        for (let i = 0, j = 0; i < px.length; i++, j += 4) {
          if (!d[j + 3]) continue;
          px[i] = RAIN_LUT.get((d[j] << 16) | (d[j + 1] << 8) | d[j + 2]) || 0;
        }
        ctx.putImageData(im, 0, 0);
        cv.toBlob((blob) => {
          if (!blob || !img.isConnected) return;
          img.dataset.rain = "1";
          img.src = URL.createObjectURL(blob);
        });
      } catch (e) { /* a tile that cannot be read stays in IEM's colours */ }
    }

    /* ── the next hour on Weather's map (2026-10-23, Ric: "No forecast of the
       next hour's rain … Do these") ──
       Apple's timeline runs on past now into the next hour. Ours does the
       same with the room's own nowcast (nowcast.js): the last half hour of
       the mosaic around the view, read through IEM's exact palette, the motion
       found by the same block matching and SETTINGS the nightly grade
       (verify/nowcast.mjs) holds to account, and the newest picture carried
       forward along it — backward along the motion, as forecast() does for a
       point — every ten minutes to an hour. Rain only: it knows nothing about
       storms growing or dying, so it is never a storm's arrival (AGENTS.md),
       and every forecast frame says "forecast". Weather only; Pro has the HRRR. */
    const NCM = { gen: 0, area: null, timer: 0 };
    const RAIN_IDX = (() => {
      if (!NC) return null;
      const t = new Uint32Array(256);
      for (let i = 1; i < 256; i++) { const c = rainRGBA(NC.dbzOf(i)); if (c) t[i] = ((Math.round(c[3] * 255) << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0; }
      return t;
    })();
    const tileImg = (url) => new Promise((ok) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; });
    function ncSoon() { if (PRO || !NC) return; clearTimeout(NCM.timer); NCM.timer = setTimeout(() => { if (!ncCovers()) nowcastMap(); }, 900); }
    /* is the view still inside the area the forecast was worked out for, at the same scale? */
    function ncCovers() {
      const a = NCM.area;
      /* the grid is the same for every zoom from 4 up, and paintNc scales it to any */
      if (!a || a.valid !== R.valid || a.zm !== Math.max(5, Math.min(6, R.z + 2))) return false;
      const sc = 2 ** (a.zm - R.z), w = el.clientWidth * sc, h = el.clientHeight * sc, cx = R.cx * sc, cy = R.cy * sc;
      return cx - w / 2 >= a.ox && cy - h / 2 >= a.oy && cx + w / 2 <= a.ox + a.W && cy + h / 2 <= a.oy + a.H;
    }
    async function nowcastMap() {
      /* the nowcast reads IEM's palette: none over NOAA's backup mosaic */
      if (PRO || !NC || !RAIN_IDX || R.mode !== "comp" || !R.valid || !R.started || R.backup) return;
      const gen = ++NCM.gen, valid = R.valid;
      /* a scale where a pixel is a few km: fine enough to see motion, the view's area in at most 6×4 tiles */
      const zm = Math.max(5, Math.min(6, R.z + 2)), sc = 2 ** (zm - R.z), n = 2 ** zm;
      const cx = R.cx * sc, cy = R.cy * sc, hw = el.clientWidth * sc / 2, hh = el.clientHeight * sc / 2;
      let tx0 = Math.floor((cx - hw) / 256), tx1 = Math.floor((cx + hw) / 256), ty0 = Math.max(0, Math.floor((cy - hh) / 256)), ty1 = Math.min(n - 1, Math.floor((cy + hh) / 256));
      while (tx1 - tx0 + 1 > 6) { if ((tx1 + 0.5) * 256 - cx > cx - (tx0 + 0.5) * 256) tx1--; else tx0++; }
      while (ty1 - ty0 + 1 > 4) { if ((ty1 + 0.5) * 256 - cy > cy - (ty0 + 0.5) * 256) ty1--; else ty0++; }
      const W = (tx1 - tx0 + 1) * 256, H = (ty1 - ty0 + 1) * 256;
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const bust = Math.floor(valid / 60e3), fields = [];
      for (const back of [30, 20, 10, 0]) {
        const jobs = [];
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push(tileImg(Wx.radarTile(back, zm, ((tx % n) + n) % n, ty, bust)).then((im) => ({ im, tx, ty })));
        const got = await Promise.all(jobs);
        if (gen !== NCM.gen) return;
        ctx.clearRect(0, 0, W, H);
        for (const { im, tx, ty } of got) if (im) ctx.drawImage(im, (tx - tx0) * 256, (ty - ty0) * 256);
        try { fields.push(NC.field({ width: W, height: H, data: NC.indicesOf(ctx.getImageData(0, 0, W, H).data) }, 1)); } catch (e) { return; }
      }
      const lat = yLat(R.cy, R.z), km = 40075.016 * Math.cos(lat * Math.PI / 180) / (256 * n);
      const m = NC.motion(fields, 10, { regions: 4, regionsY: 3, search: NC.SETTINGS.searchKm / km });
      if (gen !== NCM.gen || R.mode !== "comp" || R.valid !== valid) return;
      /* the motion on a 16-px lattice, then each forecast picture backward along it */
      const f0 = fields[3], C = 16, cw = Math.ceil(W / C), ch = Math.ceil(H / C), mu = new Float32Array(cw * ch), mvv = new Float32Array(cw * ch);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const q = NC.motionAt(m, i * C + C / 2, j * C + C / 2); mu[j * cw + i] = q.u; mvv[j * cw + i] = q.v; }
      const frames = [];
      for (let L = 10; m.known && L <= 60; L += 10) {
        const out = ctx.createImageData(W, H), px = new Uint32Array(out.data.buffer);
        for (let y = 0; y < H; y++) {
          const row = ((y / C) | 0) * cw;
          for (let x = 0; x < W; x++) {
            const k = row + ((x / C) | 0), sx = Math.round(x - mu[k] * L), sy = Math.round(y - mvv[k] * L);
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            const d = f0.v[sy * W + sx];
            if (d < 12) continue;
            px[y * W + x] = RAIN_IDX[Math.max(1, Math.min(255, Math.round((d + 32.5) * 2)))];
          }
        }
        const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").putImageData(out, 0, 0);
        frames.push({ t: valid + L * 60e3, nc: { cv: c, zm, ox: tx0 * 256, oy: ty0 * 256, W, H, L } });
      }
      NCM.area = { valid, z: R.z, zm, ox: tx0 * 256, oy: ty0 * 256, W, H };
      /* the forecast frames follow the observed ones on the timeline */
      /* a visitor on a forecast minute stays on that minute */
      const onNc = R.frames[R.frame] && R.frames[R.frame].nc ? R.frames[R.frame].nc.L : null;
      const nObs = R.frames.filter((f) => !f.nc).length;
      const keep = onNc != null && frames.length ? nObs + Math.max(0, frames.findIndex((f) => f.nc.L === onNc)) : Math.min(R.frame, nObs - 1);
      for (const f of R.frames.filter((f) => f.nc)) f.el.remove();
      R.frames = R.frames.filter((f) => !f.nc);
      for (const f of frames) { const d = document.createElement("div"); d.className = "layer frame nc"; framesL.appendChild(d); R.frames.push({ ...f, el: d, tiles: new Map() }); }
      $("#scrub").max = String(Math.max(0, R.frames.length - 1));
      if (keep !== R.frame || onNc != null) show(Math.min(keep, R.frames.length - 1));
    }
    function paintNc(f, w, h, left, top) {
      const cv = frameCanvas(f, w, h), ctx = cv.getContext("2d"), key = `${R.z}|${left}|${top}`;
      if (f.painted === key) return;
      f.painted = key;
      const q = f.nc, sc = 2 ** (R.z - q.zm);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(q.cv, q.ox * sc - left, q.oy * sc - top, q.W * sc, q.H * sc);
    }

    /* ── Weather's city temperatures and My Location, Apple's way (2026-10-23) ──
       The biggest towns in view that do not crowd each other (Natural Earth's
       populated places, read when the page runs — mapgeo.js; nothing kept),
       each with its temperature now from Open-Meteo, asked twelve at a time
       and rounded to a kilometre like every place this room asks about. */
    const CITY = { places: null, asking: false, temps: new Map(), list: [], timer: 0, gen: 0 };
    function citiesSoon() { if (PRO) return; clearTimeout(CITY.timer); CITY.timer = setTimeout(loadCities, 600); }
    async function loadCities() {
      if (PRO || !R.wl || !R.wl.temps || !R.started || R.mode === "replay" || !window.MapGeo) { if (CITY.list.length) { CITY.list = []; draw(); } return; }
      if (!CITY.places) {
        if (CITY.asking) return;
        CITY.asking = true;
        try { CITY.places = (await Wx.mapLayer("places")).places || []; } catch (e) { CITY.asking = false; return; }
      }
      const gen = ++CITY.gen, w = el.clientWidth, h = el.clientHeight, left = R.cx - w / 2, top = R.cy - h / 2;
      const boxes = [], picks = [];
      /* the place's own bubble, the key and the buttons keep their room */
      if (S.place) { const x = lngX(S.place.lon, R.z) - left, y = latY(S.place.lat, R.z) - top; boxes.push([x - 40, y - 80, x + 40, y + 34]); }
      /* …and so do whatever floats over the map: the key, the buttons, the timeline, the close button */
      const mr = el.getBoundingClientRect();
      for (const sel of ["#legend", ".radar .zoom", ".radarbar", "#mapclose", ".radar .credit"]) {
        const e = el.closest("#radarcard").querySelector(sel);
        if (!e || !e.offsetParent) continue;
        const r = e.getBoundingClientRect();
        if (r.right > mr.left && r.left < mr.right && r.bottom > mr.top && r.top < mr.bottom) boxes.push([r.left - mr.left - 6, r.top - mr.top - 6, r.right - mr.left + 6, r.bottom - mr.top + 6]);
      }
      for (const p of CITY.places) {
        if (p[3] > R.z + 1.5) continue;
        const x = lngX(p[1], R.z) - left, y = latY(p[2], R.z) - top;
        if (x < 24 || y < 30 || x > w - 70 || y > h - 30) continue;
        const b = [x - 34, y - 22, x + 34, y + 34];
        if (boxes.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1])) continue;
        boxes.push(b); picks.push({ name: p[0], lon: p[1], lat: p[2] });
        if (picks.length >= 10) break;
      }
      const key = (c) => `${Wx.coord(c.lat)},${Wx.coord(c.lon)}`;
      const need = picks.filter((c) => { const t = CITY.temps.get(key(c)); return !t || Date.now() - t.at > 10 * 60e3; });
      if (need.length) {
        try {
          const got = await Wx.several(need.slice(0, 12).map((c) => ({ lat: c.lat, lon: c.lon })));
          need.slice(0, 12).forEach((c, i) => { if (got[i] && got[i].temp != null) CITY.temps.set(key(c), { temp: got[i].temp, at: Date.now() }); });
        } catch (e) { /* the bubbles wait for the next move of the map */ }
      }
      if (gen !== CITY.gen) return;
      CITY.list = picks.map((c) => ({ ...c, temp: (CITY.temps.get(key(c)) || {}).temp })).filter((c) => c.temp != null);
      draw();
    }
    function cityMarks(out, pt) {
      if (PRO || !R.wl || !R.wl.temps) return;
      for (const c of CITY.list) {
        const [x, y] = pt(c.lat, c.lon), X = x.toFixed(1), Y = y.toFixed(1);
        out.push(`<g class="city"><circle cx="${X}" cy="${Y}" r="17" fill="#4a5568" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/><text x="${X}" y="${(y + 5.5).toFixed(1)}" text-anchor="middle" class="ct">${Wx.fmt.temp(c.temp, U())}</text><text x="${X}" y="${(y + 33).toFixed(1)}" text-anchor="middle" class="cn">${esc(c.name)}</text></g>`);
      }
    }
    function placeBubble(out, pt) {
      if (!S.place) return;
      const [x, y] = pt(S.place.lat, S.place.lon), fc = shown();
      const cc = fc ? Wx.currentConditions(fc, S.obs || null) : null, t = cc && cc.temp && cc.temp.v;
      const X = x.toFixed(1), by = y - 46;
      const ic = cc ? icon(cc.kind, cc.isDay !== false).replace("<svg ", `<svg x="${(x - 9).toFixed(1)}" y="${(by + 5).toFixed(1)}" width="18" height="18" `) : "";
      out.push(`<g class="me"><path d="M${(x - 7).toFixed(1)} ${(by + 22).toFixed(1)} L${X} ${(y - 10).toFixed(1)} L${(x + 7).toFixed(1)} ${(by + 22).toFixed(1)}Z" fill="#2f6fd0"/><circle cx="${X}" cy="${by.toFixed(1)}" r="27" fill="#2f6fd0" stroke="#0b1422" stroke-opacity=".5" stroke-width="2"/>`
        + `<text x="${X}" y="${(by + 2).toFixed(1)}" text-anchor="middle" class="mt">${t != null ? Wx.fmt.temp(t, U()) + "°" : "–"}</text>${ic}`
        + `<circle cx="${X}" cy="${y.toFixed(1)}" r="5" fill="#0b1422"/><circle cx="${X}" cy="${y.toFixed(1)}" r="3" fill="#cfd8e3"/>`
        + `<text x="${X}" y="${(y + 20).toFixed(1)}" text-anchor="middle" class="cn">${esc(S.place.here ? "My Location" : S.place.name)}</text></g>`);
    }

    /* everything drawn over the tiles */
    /* one station as a surface chart draws it */
    const COVER = { CLR: 0, SKC: 0, FEW: 0.25, SCT: 0.5, BKN: 0.75, OVC: 1 };
    function stationModel(s, x, y) {
      const f = (v) => v.toFixed(1);
      let g = "";
      const kt = s.wind != null ? s.wind / 1.852 : null;
      if (kt != null && s.windDir != null && kt >= 2.5) g += Draw.barb(x, y, s.windDir, kt);
      const cov = COVER[s.cover];
      g += `<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#0b0f15" stroke="#e9ecef" stroke-width="1.5"/>`;
      if (s.cover === "VV") g += `<path d="M${f(x - 4)},${f(y - 4)}L${f(x + 4)},${f(y + 4)}M${f(x + 4)},${f(y - 4)}L${f(x - 4)},${f(y + 4)}" stroke="#e9ecef" stroke-width="1.5"/>`;
      else if (cov === 1) g += `<circle cx="${f(x)}" cy="${f(y)}" r="6" fill="#e9ecef"/>`;
      else if (cov > 0) { const a = cov * 2 * Math.PI; g += `<path d="M${f(x)},${f(y)}L${f(x)},${f(y - 6)}A6,6 0 ${cov > 0.5 ? 1 : 0},1 ${f(x + 6 * Math.sin(a))},${f(y - 6 * Math.cos(a))}Z" fill="#e9ecef"/>`; }
      if (kt != null && kt < 2.5) g += `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="none" stroke="#e9ecef" stroke-width="1.2"/>`;
      const txt = (dx, dy, v, cls, anchor) => `<text class="${cls}" x="${f(x + dx)}" y="${f(y + dy)}" text-anchor="${anchor}">${esc(v)}</text>`;
      if (s.temp != null) g += txt(-9, -5, Wx.fmt.temp(s.temp, U()), "st", "end");
      if (s.dew != null) g += txt(-9, 15, Wx.fmt.temp(s.dew, U()), "sd", "end");
      if (s.wx) g += txt(-9, 5, s.wx, "sw", "end");
      if (s.pressure != null) g += txt(9, -5, String(Math.round(s.pressure * 10) % 1000).padStart(3, "0"), "sp", "start");
      return g;
    }
    function overlay(left, top) {
      const pt = (lat, lon) => [lngX(lon, R.z) - left, latY(lat, R.z) - top];
      const ring = (r) => r.map(([lon, lat]) => pt(lat, lon).map((v) => v.toFixed(1)).join(",")).join(" ");
      const out = [];
      /* a replay draws only its own warnings, each for its own minutes,
         and the place dot — nothing of today */
      if (R.mode === "replay") {
        const f = R.frames[R.frame], t = f && f.t;
        for (const w of (R.replay && R.replay.warn) || []) {
          if (!t || t < w.begin || t >= w.end) continue;
          const tor = /^TO/.test(w.sig);
          for (const p of w.polys) out.push(`<polygon points="${ring(p[0])}" fill="${esc(w.color)}" fill-opacity="${tor ? ".25" : ".1"}" stroke="${esc(w.color)}" stroke-width="${tor ? 2.6 : 1.8}"/>`);
        }
        if (S.place) { const [mx, my] = pt(S.place.lat, S.place.lon); out.push(`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#fff" stroke="#0b2342" stroke-width="2"/>`); }
        if (R.replay && R.replay.site && R.site && R.site.lat != null) { const [sx, sy] = pt(R.site.lat, R.site.lon); out.push(`<rect x="${(sx - 4).toFixed(1)}" y="${(sy - 4).toFixed(1)}" width="8" height="8" fill="#ffd43b" stroke="#000"/>`); }
        stationMarks(out, pt);
        over.innerHTML = out.join("");
        return;
      }
      const olList = outlookList();
      if (R.outlook && olList) {
        /* lowest risk first; a probability by its number; the hatched significant areas last, over the rest */
        const rk = (o) => (o.sig ? 1e3 : 0) + (o.rank || (parseFloat(o.label) * 100) || 0);
        if (PRO && olList.some((o) => o.sig)) out.push(`<defs><pattern id="olsig" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#000" stroke-width="2.4"/></pattern></defs>`);
        for (const o of olList.slice().sort((a, b) => rk(a) - rk(b))) {
          const d = o.polys.map((poly) => poly.map((r) => "M" + ring(r).replace(/ /g, " L")).join(" ") + " Z").join(" ");
          /* on Weather, the outline only: a filled outlook hid the rain under it (Ric, 2026-10-23) */
          out.push(!PRO ? `<path d="${d}" fill="none" stroke="${esc(o.stroke || o.fill || "#888")}" stroke-width="1.6" stroke-dasharray="6 4" stroke-opacity=".85"/>`
            : o.sig ? `<path d="${d}" fill="url(#olsig)" fill-rule="evenodd" stroke="#000" stroke-width="1.6"/>`
            : `<path d="${d}" fill="${esc(o.fill || "#888")}" fill-opacity=".28" fill-rule="evenodd" stroke="${esc(o.stroke || "#888")}" stroke-width="1.6"/>`);
        }
        /* each area named where it starts — TSTM, SLGT, 5% … */
        if (PRO) for (const o of olList) {
          if (o.sig || !o.polys[0] || !o.polys[0][0]) continue;
          const r0 = o.polys[0][0], c = r0.reduce((m, q) => [m[0] + q[0] / r0.length, m[1] + q[1] / r0.length], [0, 0]), [x, y] = pt(c[1], c[0]);
          const word = SPC_SHORT[o.label] || (Number.isFinite(parseFloat(o.label)) ? Math.round(parseFloat(o.label) * 100) + "%" : "");
          if (word) out.push(`<text class="ovl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${esc(o.stroke || "#fff")}">${esc(word)}</text>`);
        }
      }
      /* ── the tropics: NHC's 7-day outlook areas, then each storm's cone,
         past track, forecast track and points, and its coastal watches and
         warnings (2026-10-23) ── */
      if (PRO && R.ov.tropics && R.pro.tropics) {
        const T = R.pro.tropics, line = (c) => c.map(([lo, la]) => pt(la, lo).map((v) => v.toFixed(1)).join(",")).join(" ");
        for (const a of T.outlook) {
          const d = a.polys.map((poly) => poly.map((r) => "M" + ring(r).replace(/ /g, " L")).join(" ") + " Z").join(" ");
          out.push(`<path d="${d}" fill="${a.color}" fill-opacity=".14" fill-rule="evenodd" stroke="${a.color}" stroke-width="2" stroke-dasharray="7 4"/>`);
          const r0 = a.polys[0][0], c = r0.reduce((m, q) => [m[0] + q[0] / r0.length, m[1] + q[1] / r0.length], [0, 0]), [x, y] = pt(c[1], c[0]);
          out.push(`<text class="ovl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${a.color}">${esc(`${a.p2} 2-day · ${a.p7} 7-day`)}</text>`);
        }
        for (const st of T.storms) {
          for (const poly of st.cone) out.push(`<path d="${poly.map((r) => "M" + ring(r).replace(/ /g, " L")).join(" ")} Z" fill="#ffffff" fill-opacity=".16" fill-rule="evenodd" stroke="#ffffff" stroke-opacity=".85" stroke-width="1.5"/>`);
          for (const l of st.past) out.push(`<polyline points="${line(l)}" fill="none" stroke="#adb5bd" stroke-width="2"/>`);
          for (const l of st.track) out.push(`<polyline points="${line(l)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4"/>`);
          for (const w of st.ww) for (const l of w.lines) out.push(`<polyline points="${line(l)}" fill="none" stroke="${w.color}" stroke-width="6" stroke-linecap="round"/>`);
          for (const q of st.points) {
            const [x, y] = pt(q.lat, q.lon), col = /^[HM]$/.test(q.label) ? "#ff4d6d" : q.label === "S" ? "#ffd43b" : "#74c0fc";
            out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${q.tau ? 7 : 9}" fill="${col}" stroke="#05070a" stroke-width="1.5"/><text class="trl" x="${x.toFixed(1)}" y="${(y + 3.8).toFixed(1)}" text-anchor="middle">${esc(q.label || "•")}</text>`);
            /* every point's time from zoom 6; further out, only the last, so they do not pile up */
            if (q.tau && q.when && (R.z >= 6 || q === st.points[st.points.length - 1])) out.push(`<text class="trw" x="${(x + 11).toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(q.when)}</text>`);
          }
          const [hx, hy] = pt(st.lat, st.lon);
          out.push(`<text class="ovl" x="${hx.toFixed(1)}" y="${(hy - 14).toFixed(1)}" text-anchor="middle" fill="#fff">${esc(`${st.name}${st.wind != null ? " · " + Math.round(st.wind) + " kt" : ""}`)}</text>`);
        }
      }
      const W0 = el.clientWidth, H0 = el.clientHeight;
      const off = ([x, y], m = 40) => x < -m || y < -m || x > W0 + m || y > H0 + m;
      const pathOf = (polys) => polys.map((poly) => poly.map((r) => "M" + ring(r).replace(/ /g, " L") + " Z").join(" ")).join(" ");
      const centre = (poly) => { const r = poly[0], n = r.length - 1 || 1; let a = 0, b = 0; for (let i = 0; i < n; i++) { a += r[i][1]; b += r[i][0]; } return pt(a / n, b / n); };
      const tag = (x, y, text, col) => `<text class="ovl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${col}">${esc(text)}</text>`;
      /* a label that would land on one already placed steps down a line until
         it is clear (2026-10-23: a watch and a discussion sharing a middle wrote
         "SVR 696" over "MPD 1519") — 11 px monospace is ~6.8 px a letter */
      const placed = [];
      const freeTag = (x, y, text, col) => {
        const w = text.length * 6.8 + 6, h = 14;
        for (let i = 0; i < 8; i++) {
          const b = [x - w / 2, y - h + 3, x + w / 2, y + 3];
          if (!placed.some((p) => b[0] < p[2] && b[2] > p[0] && b[1] < p[3] && b[3] > p[1])) { placed.push(b); break; }
          y += h + 1;
        }
        return tag(x, y, text, col);
      };
      /* WPC's surface analysis: fronts with their symbols on the side the
         bulletin's point order puts them, troughs dashed, highs and lows */
      if (R.ov.fronts && R.pro.surface) {
        const FC = { COLD: "#4dabf7", WARM: "#ff6b6b", OCFNT: "#cc5de8", STNRY: "#ff6b6b", TROF: "#d9a86c" };
        const walk = (P, every, make) => {
          let carry = every / 2, n = 0;
          for (let i = 0; i + 1 < P.length; i++) {
            const [x0, y0] = P[i], [x1, y1] = P[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
            if (!L) continue;
            const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
            let s = carry;
            for (; s < L; s += every) make(x0 + ux * s, y0 + uy * s, ux, uy, n++);
            carry = s - L;
          }
        };
        const tri = (x, y, ux, uy, side, col) => { const lx = uy * side, ly = -ux * side;
          return `<polygon points="${(x - ux * 6).toFixed(1)},${(y - uy * 6).toFixed(1)} ${(x + ux * 6).toFixed(1)},${(y + uy * 6).toFixed(1)} ${(x + lx * 9).toFixed(1)},${(y + ly * 9).toFixed(1)}" fill="${col}"/>`; };
        const semi = (x, y, ux, uy, side, col) => { const lx = uy * side, ly = -ux * side, ps = [];
          for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI; ps.push(`${(x - ux * Math.cos(a) * 6 + lx * Math.sin(a) * 6).toFixed(1)},${(y - uy * Math.cos(a) * 6 + ly * Math.sin(a) * 6).toFixed(1)}`); }
          return `<polygon points="${ps.join(" ")}" fill="${col}"/>`; };
        for (const f of R.pro.surface.fronts) {
          const P = f.pts.map(([la, lo]) => pt(la, lo));
          if (P.every((q) => off(q, 60))) continue;
          const line = P.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");
          if (f.kind === "TROF") { out.push(`<polyline points="${line}" fill="none" stroke="${FC.TROF}" stroke-width="2" stroke-dasharray="8 5"/>`); continue; }
          if (f.kind === "STNRY") {
            out.push(`<polyline points="${line}" fill="none" stroke="#ff6b6b" stroke-width="2.5"/><polyline points="${line}" fill="none" stroke="#4dabf7" stroke-width="2.5" stroke-dasharray="20 20"/>`);
            walk(P, 40, (x, y, ux, uy, n) => out.push(n % 2 ? semi(x, y, ux, uy, -1, "#ff6b6b") : tri(x, y, ux, uy, 1, "#4dabf7")));
            continue;
          }
          out.push(`<polyline points="${line}" fill="none" stroke="${FC[f.kind]}" stroke-width="2.5"/>`);
          walk(P, 34, (x, y, ux, uy, n) => out.push(f.kind === "COLD" ? tri(x, y, ux, uy, 1, FC.COLD) : f.kind === "WARM" ? semi(x, y, ux, uy, 1, FC.WARM) : (n % 2 ? semi : tri)(x, y, ux, uy, 1, FC.OCFNT)));
        }
        for (const [list, letter, col] of [[R.pro.surface.highs, "H", "#4dabf7"], [R.pro.surface.lows, "L", "#ff6b6b"]]) for (const c of list) {
          const q = pt(c.lat, c.lon);
          if (off(q)) continue;
          out.push(`<text class="ovl hl" x="${q[0].toFixed(1)}" y="${q[1].toFixed(1)}" text-anchor="middle" fill="${col}">${letter}</text>${tag(q[0], q[1] + 15, String(c.mb), col)}`);
        }
      }
      /* SPC's watches (the NWS colours: tornado yellow, severe pink) and
         the two centres' mesoscale discussions, dashed */
      if (R.ov.watches) {
        for (const w of R.pro.watches) {
          const col = w.type === "TOR" ? "#ffd43b" : "#f783ac", [cx, cy] = centre(w.polys[0]);
          out.push(`<path d="${pathOf(w.polys)}" fill="${col}" fill-opacity=".07" fill-rule="evenodd" stroke="${col}" stroke-width="2.4"/>${freeTag(cx, cy, `${w.type} ${w.num}`, col)}`);
        }
        for (const d of [...R.pro.mcds, ...R.pro.mpds]) {
          const col = d.kind === "mcd" ? "#74c0fc" : "#8ce99a", [cx, cy] = centre(d.polys[0]);
          out.push(`<path d="${pathOf(d.polys)}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="7 4"/>${freeTag(cx, cy + 14, `${d.kind === "mcd" ? "MD" : "MPD"} ${d.num}${d.chance != null ? " · " + d.chance + "%" : ""}`, col)}`);
        }
      }
      /* Weather's layers menu can take the warnings around off the map, never
         a warning in force where the visitor is: storm mode's own warning is
         always drawn (AGENTS.md: warnings and storm mode stay on both pages) */
      const warns = R.wl && !R.wl.warn ? (S.place ? (S.alerts || []).filter((a) => a.tone === "warning" || a.storm) : [])
        : [...(S.place ? (S.alerts || []) : []), ...(S.place ? (S.state || []) : (S.national || []))];
      const seen = new Set();
      for (const a of warns) {
        if (!a.polygon || seen.has(a.id)) continue;
        seen.add(a.id);
        const col = a.event === "Tornado Warning" ? "#ff4d6d" : a.event === "Severe Thunderstorm Warning" ? "#ffa94d" : a.event === "Flash Flood Warning" ? "#69db7c" : a.tone === "warning" ? "#ff6b6b" : a.tone === "watch" ? "#ffd43b" : "#a5d8ff";
        out.push(`<polygon points="${ring(a.polygon[0])}" fill="${col}" fill-opacity="${a.event === "Tornado Warning" ? ".22" : ".1"}" stroke="${col}" stroke-width="${a.storm ? 2.4 : 1.6}"/>`);
        /* the storm, where its warning says it is now, and 30 minutes on */
        if (a.motion) {
          const tr = Wx.stormTrack(a.motion, a.motion.points[0][0], a.motion.points[0][1]);
          if (tr && Date.now() - a.motion.time < 2 * 3600e3) {
            const now = tr.points.map(([la, lo]) => pt(la, lo));
            const r = tr.toward * Math.PI / 180, km = tr.kmh / 2;
            const ahead = tr.points.map(([la, lo]) => pt(la + km * Math.cos(r) / 110.57, lo + km * Math.sin(r) / (111.32 * Math.cos(la * Math.PI / 180))));
            now.forEach((p, i) => out.push(`<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${ahead[i][0].toFixed(1)}" y2="${ahead[i][1].toFixed(1)}" stroke="#fff" stroke-width="1.6" stroke-dasharray="4 3"/>`));
            if (now.length > 1) out.push(`<polyline points="${now.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="#fff" stroke-width="3"/>`);
            now.forEach((p) => out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#fff" stroke="#000" stroke-width="1.5"/>`));
          }
        }
      }
      if (R.site && single() && R.site.lat != null) {
        const [sx, sy] = pt(R.site.lat, R.site.lon);
        /* range rings (2026-10-23): every 25 mi or 50 km out to the products'
           230 km, on the sphere around the radar — distances at a glance */
        if (PRO && R.ov.rings) {
          const us = U() !== "metric", step = us ? 25 * 1.609344 : 50, rad = Math.PI / 180, la = R.site.lat * rad, lo = R.site.lon * rad;
          for (let k = 1; k * step <= 231; k++) {
            const d = k * step / 6371.0088, ptsR = [];
            for (let b = 0; b <= 360; b += 5) {
              const br = b * rad, lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br));
              const lon2 = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
              ptsR.push(pt(lat2 / rad, lon2 / rad).map((v) => v.toFixed(1)).join(","));
            }
            const [lx, ly] = pt(Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d)) / rad, R.site.lon);
            out.push(`<polyline points="${ptsR.join(" ")}" fill="none" stroke="#e6edf3" stroke-opacity=".75" stroke-width="1.3" stroke-dasharray="5 4"/><text class="ringl" x="${lx.toFixed(1)}" y="${(ly - 3).toFixed(1)}" text-anchor="middle">${us ? k * 25 + " mi" : k * 50 + " km"}</text>`);
          }
        }
        out.push(`<rect x="${(sx - 4).toFixed(1)}" y="${(sy - 4).toFixed(1)}" width="8" height="8" fill="#ffd43b" stroke="#000"/>`);
      }
      /* NEXRAD's storm cells, from zoom 6: where each is, where it is heading
         (ticks every 15 minutes for an hour, carried forward at its own
         motion), and rings for what the radar found in it — yellow for a
         mesocyclone, red for a tornadic vortex, green for large hail, and a
         dashed violet one for a lightning jump when a lightning layer is on */
      R.cellsDrawn = [];
      if (R.ov.cells && R.z >= 6) {
        for (const c of R.pro.cells) {
          const [x, y] = pt(c.lat, c.lon);
          if (off([x, y], 10)) continue;
          R.cellsDrawn.push(c);
          if (c.kt > 2 && c.from != null) {
            const to = ((c.from + 180) % 360) * Math.PI / 180, ticks = [];
            for (let m = 15; m <= 60; m += 15) {
              const km = c.kt * 1.852 * m / 60;
              ticks.push(pt(c.lat + km * Math.cos(to) / 110.57, c.lon + km * Math.sin(to) / (111.32 * Math.cos(c.lat * Math.PI / 180))));
            }
            const end = ticks[ticks.length - 1];
            out.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${end[0].toFixed(1)}" y2="${end[1].toFixed(1)}" stroke="#e9ecef" stroke-width="1.3" stroke-dasharray="3 3"/>`);
            ticks.forEach((q) => out.push(`<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="1.8" fill="#e9ecef"/>`));
          }
          const hail = (c.hailIn != null && c.hailIn >= 1) || (c.posh != null && c.posh >= 50);
          if (hail) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="none" stroke="#69db7c" stroke-width="2"/>`);
          if (c.meso) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="none" stroke="#ffd43b" stroke-width="2.4"/>`);
          const cl = cellLightning(c);
          if (cl && cl.j && cl.j.jump) out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" fill="none" stroke="#e599f7" stroke-width="2" stroke-dasharray="4 3"/>`);
          if (c.tvs) out.push(`<polygon points="${x.toFixed(1)},${(y + 9).toFixed(1)} ${(x - 8).toFixed(1)},${(y - 6).toFixed(1)} ${(x + 8).toFixed(1)},${(y - 6).toFixed(1)}" fill="none" stroke="#ff4d6d" stroke-width="2.6"/>`);
          const core = c.dbz >= 60 ? "#e64980" : c.dbz >= 50 ? "#ff6b6b" : c.dbz >= 40 ? "#ffa94d" : "#e9ecef";
          out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${core}" stroke="#05070a" stroke-width="1.2"/>`);
        }
      }
      /* the NWS's storm reports: a letter on its kind's colour, fading with
         age through the day; the severe ones at every zoom, the rest from 7 */
      R.reportsDrawn = [];
      if (R.ov.reports && R.pro.reports.length) {
        const now = Date.now();
        for (const r of R.pro.reports) {
          if (!r.severe && R.z < 7) continue;
          const [x, y] = pt(r.lat, r.lon);
          if (off([x, y], 10)) continue;
          R.reportsDrawn.push(r);
          const k = Wx.LSR_KINDS[r.kind], hrs = (now - r.time) / 3600e3, op = hrs < 1 ? 1 : hrs < 6 ? 0.85 : 0.6, rr = r.severe ? 9 : 7.5;   // room for an 11px letter (the site's floor)
          out.push(`<g class="lsr" opacity="${op}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="${k.color}" stroke="#05070a" stroke-width="1.5"/><text x="${x.toFixed(1)}" y="${(y + 3.9).toFixed(1)}" text-anchor="middle">${esc(k.glyph)}</text></g>`);
        }
      }
      /* stations: drawn by stationMarks() — today's, or a replay's from the archive */
      stationMarks(out, pt);
      /* the radars near the map, in a one-radar product: tap one to keep it
         (the picker at the head of the tilt row says the same) */
      if (PRO && single() && R.sites) {
        for (const s of R.sites.slice(0, 15)) {
          const [x, y] = pt(s.lat, s.lon);
          if (off([x, y], 20)) continue;
          const on = R.site && R.site.id === s.id, X1 = x.toFixed(1), Y1 = y.toFixed(1);
          out.push(`<g class="rsite"><rect x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10" transform="rotate(45 ${X1} ${Y1})" fill="${on ? "#ffffff" : "#0b0f15"}" stroke="${on ? "#05070a" : "#e9ecef"}" stroke-width="1.6"/>${tag(x, y + 20, s.id, on ? "#4dabf7" : "#e9ecef")}</g>`);   // under the mark: town names sit to the right of theirs
        }
      }
      /* the cross-section's line, A to B */
      if (X.a) {
        const [ax, ay] = pt(X.a.lat, X.a.lon);
        if (X.b) { const [bx, by] = pt(X.b.lat, X.b.lon); out.push(`<line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#0b1422" stroke-width="5"/><line x1="${ax.toFixed(1)}" y1="${ay.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="6 4"/>`); }
        for (const [q, lab] of [[X.a, "A"], [X.b, "B"]]) { if (!q) continue; const [qx, qy] = pt(q.lat, q.lon); out.push(`<circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="9" fill="#ffd166" stroke="#0b1422" stroke-width="2"/><text x="${qx.toFixed(1)}" y="${(qy + 4).toFixed(1)}" text-anchor="middle" style="font:700 11px var(--sans);fill:#0b1422">${lab}</text>`); }
      }
      /* the ruler: each leg with its distance */
      if (R.measure && R.measure.pts.length) {
        const P = R.measure.pts.map((q) => pt(q.lat, q.lon));
        if (P.length > 1) out.push(`<polyline points="${P.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="#05070a" stroke-width="5"/><polyline points="${P.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="#ffffff" stroke-width="2.4"/>`);
        R.measure.pts.forEach((q, i) => {
          out.push(`<circle cx="${P[i][0].toFixed(1)}" cy="${P[i][1].toFixed(1)}" r="4.5" fill="#ffffff" stroke="#05070a" stroke-width="1.5"/>`);
          if (i) { const a = R.measure.pts[i - 1], km = Wx.distanceM(a.lat, a.lon, q.lat, q.lon) / 1000;
            out.push(`<text class="ovl" x="${((P[i - 1][0] + P[i][0]) / 2).toFixed(1)}" y="${((P[i - 1][1] + P[i][1]) / 2 - 6).toFixed(1)}" text-anchor="middle" fill="#ffffff">${esc(dist(km))}</text>`); }
        });
      }
      if (R.pin) {
        const [qx, qy] = pt(R.pin.lat, R.pin.lon);
        out.push(`<circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="7" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="2.5" fill="#fff"/>`);
      }
      cityMarks(out, pt);
      if (S.place && !PRO) placeBubble(out, pt);
      else if (S.place) {
        const [mx, my] = pt(S.place.lat, S.place.lon);
        out.push(`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="rgba(255,255,255,.25)"/><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#fff" stroke="#0b2342" stroke-width="2"/>`);
      }
      over.innerHTML = out.join("");
    }

    /* the stations on the map (live, or a replay's own from the archive) */
    function stationMarks(out, pt) {
        /* stations: a dot, a tail from where the wind comes, and the
           temperature on a chip of its own colour — newest first, and none
           drawn on top of another. From zoom 8 on Pro, the full station
           model: sky cover, a wind barb in knots, temperature, dew point,
           present weather and pressure, as on any surface chart */
        R.drawn = [];
        if (R.stations && R.z >= STN_MINZ && R.obs.length) {
          const w = el.clientWidth, h = el.clientHeight, placed = [], zb = zoomBottom();
          const model = PRO && R.z >= 8, bx = model ? 74 : 40, by = model ? 50 : 26;
          /* airports first, so where stations crowd the airport keeps its place */
          for (const s of R.obs.slice().sort((a, b) => (a.net === "asos" ? 0 : 1) - (b.net === "asos" ? 0 : 1) || b.time - a.time)) {
            const [x, y] = pt(s.lat, s.lon);
            if (x < -20 || y < -20 || x > w + 20 || y > h + 20 || placed.some(([a, b]) => Math.abs(a - x) < bx && Math.abs(b - y) < by) || (x > w - 110 && y < zb)) continue;  // nor under the zoom buttons
            placed.push([x, y]); R.drawn.push(s);
            if (model) { out.push(`<g class="stn stp">${stationModel(s, x, y)}</g>`); continue; }
            let g = "";
            if (s.wind != null && !Wx.isCalm(s.wind) && s.windDir != null) {
              const r = s.windDir * Math.PI / 180, L = Math.min(26, 8 + s.wind * 0.45);
              g += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.sin(r) * L).toFixed(1)}" y2="${(y - Math.cos(r) * L).toFixed(1)}" stroke="#0b1422" stroke-width="4" stroke-linecap="round"/><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.sin(r) * L).toFixed(1)}" y2="${(y - Math.cos(r) * L).toFixed(1)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
            }
            /* an airport is a round dot; every other network a square one */
            g += !s.net || s.net === "asos" ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#fff" stroke="#0b1422" stroke-width="1.5"/>`
              : `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" fill="#fff" stroke="#0b1422" stroke-width="1.5"/>`;
            if (s.temp != null) {
              const txt = Wx.fmt.temp(s.temp, U()) + "°", cw = 10 + txt.length * 7.2;
              g += `<rect x="${(x + 5).toFixed(1)}" y="${(y - 20).toFixed(1)}" width="${cw.toFixed(1)}" height="17" rx="8.5" fill="${tempColor(s.temp)}" stroke="#0b1422" stroke-width="1"/><text x="${(x + 5 + cw / 2).toFixed(1)}" y="${(y - 7.5).toFixed(1)}" text-anchor="middle">${txt}</text>`;
            }
            out.push(`<g class="stn">${g}</g>`);
          }
        }
    }
    function draw() {
      if (!R.started) return;
      tellView();
      const w = el.clientWidth, h = el.clientHeight;
      const left = R.cx - w / 2, top = R.cy - h / 2;
      place(baseL, baseTiles, (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, w, h, left, top);
      placeTerrain(w, h, left, top);
      for (const s of sats) place(s.el, s.tiles, (z, x, y) => Wx.satTile(s.layer, z, x, y, satAt), w, h, left, top);
      syncPastSat(w, h, left, top);
      R.frames.forEach((f, i) => {
        if (f.nc) { if (i === R.frame) paintNc(f, w, h, left, top); return; }
        /* Pro's own radar and model frames: painted while on screen, fetched
           ahead only while the loop plays */
        /* an archived volume is a megabyte or two: only the next one is fetched ahead, while playing */
        if (f.l3) { if (i === R.frame) paintL3(f, w, h, left, top); else if (f.l3.l2 && f.l3.l2.archive ? R.playing && i === R.frame + 1 : R.loadedOld) l3File(f); return; }
        if (f.model) { if (i === R.frame) paintModel(f, w, h, left, top); else if (R.playing && (i === R.frame + 1 || i === R.frame + 2)) modelLayer(f); return; }
        if (f.mrms) { if (i === R.frame) paintModel(f, w, h, left, top); else if (R.playing && i === R.frame + 1) mrmsLayer(f); return; }
        if (f.abi) { if (i === R.frame) paintModel(f, w, h, left, top); else if (R.playing && (i === R.frame + 1 || i === R.frame + 2)) abiLayer(f); return; }
        /* a forecast frame is painted only while it is the one on screen —
           twenty-two full reprojections a pan would be the stroke §2 warns
           of; the others only load their picture, ready for the loop */
        if (f.future) { if (i === R.frame) paintHrrr(f, w, h, left, top); else if (R.loadedOld && !f.img) { f.img = new Image(); f.img.src = f.src; } }
        /* archive tiles are drawn by IEM on demand and slow: a replay loads the
           frame on screen and the next, never the whole loop at once */
        else if (f.archive ? i === R.frame || i === R.frame + 1 : i === R.frame || R.loadedOld) place(f.el, f.tiles, f.url, w, h, left, top, !PRO && f.rain);
      });
      drawGeo();
      overlay(left, top);
      drawLightning();
      placePin();
    }

    function note(text) {
      const n = $("#radarnote");
      delete n.dataset.flash;                // a real note outlives a key's passing one
      n.hidden = !text; n.textContent = text || "";
    }
    function paintFrame(f) {
      if (!R.started) return;
      const w = el.clientWidth, h = el.clientHeight, left = R.cx - w / 2, top = R.cy - h / 2;
      if (f.l3) paintL3(f, w, h, left, top);
      else if (f.model || f.mrms || f.abi) paintModel(f, w, h, left, top);
    }
    let byUser = 0;
    function userShow(i) { byUser++; try { show(i); } finally { byUser--; } }
    function show(i) {
      R.frame = i;
      const told = byUser && !applying;
      Promise.resolve().then(() => { const st = stamp(); hear("stamp", st); if (told) tell("time", st); });
      R.frames.forEach((f, j) => f.el.classList.toggle("on", j === i));
      if (!R.frames[i]) { $("#when").innerHTML = ""; return; }
      const f = R.frames[i];
      if (!R.loadedOld || f.future || f.nc || f.archive || (f.l3 && f.l3.l2 && f.l3.l2.archive)) draw();   // a replay's warnings change by the minute, and its next frame loads now
      /* every other frame is painted by itself, and only that one (2026-10-24):
         once the older frames had loaded, stepping onto a scan, model hour,
         MRMS or GOES frame drew nothing, because draw() paints those only
         while they are on screen and nothing here called it. Each painter
         keeps the view it last drew (f.painted), so one already drawn costs
         nothing, and one not yet loaded is asked for now. */
      else paintFrame(f);
      /* a replay's stations follow the frame, twenty minutes at a time */
      if (R.mode === "replay" && R.stations) { const ft = frameTime(f); if (ft != null && Math.round(ft / 1200e3) * 1200e3 !== R.obsSlot) stationsSoon(); }
      $("#scrub").value = String(i);
      if ($("#fcount")) $("#fcount").textContent = R.frames.length > 1 ? `${i + 1}/${R.frames.length}` : "";
      if (PRO) { timeline(); legendBase(); }
      const when = $("#when");
      if (f.archive) when.innerHTML = `${esc(dayFmt(f.t))}<small>${esc(timeFmt(f.t))}</small>`;
      else if (f.mrms) when.innerHTML = `${esc(clk().time(f.t))}<small>MRMS · ${Wx.age(Date.now() - f.t)} ago${f.mrms.layer ? "" : f.mrms.err ? " · failed" : " · loading"}</small>`;
      else if (f.abi) when.innerHTML = `${esc(clk().time(f.t))}<small>${f.abi.file.sat === "east" ? "GOES-East" : "GOES-West"} · ${Wx.age(Date.now() - f.t)} ago${f.abi.layer ? "" : f.abi.err ? " · failed" : " · loading"}</small>`;
      else if (f.model) {
        const k = clk(), day = k.ymd(f.t) !== k.ymd(Date.now()) ? k.day(f.t) + " " : "";
        when.innerHTML = `${esc(day + k.time(f.t))}<small>${esc(MM.SOURCES[f.model.src].analysis ? MM.SOURCES[f.model.src].label : runHour(f.model))}${MM.SOURCES[f.model.src].analysis ? " · " + Wx.age(Date.now() - f.t) + " ago" : ""}${f.model.layer ? "" : f.model.err ? " · failed" : " · loading"}</small>`;
      } else if (f.l3) {
        const F = f.l3.file;
        const t = F ? F.time : f.t, arch = f.l3.l2 && f.l3.l2.archive;
        /* an archived volume says its date, as the mosaic's replay does; a live scan its age */
        when.innerHTML = arch ? `${esc(timeFmt(t))}<small>${esc(dayFmt(t))}${F ? ` · ${F.elev.toFixed(1)}°` : f.l3.err ? " · failed" : " · loading"}${F && F.motionText ? ` · ${esc(F.motionText)}` : ""}</small>`
          : `${esc(clk().time(t))}<small>${Wx.age(Date.now() - t)} ago${F ? ` · ${F.elev.toFixed(1)}°` : f.l3.err ? " · failed" : " · loading"}${F && F.motionText ? ` · ${esc(F.motionText)}` : ""}</small>`;
      } else if (f.nc) {
        const k = clk();
        when.innerHTML = `${esc(k.time(f.t))}<small>forecast · in ${Wx.age(Math.max(60e3, f.t - Date.now()))}</small>`;
      } else if (f.future && f.t) {
        const k = clk(), d = f.t - Date.now(), day = k.ymd(f.t) !== k.ymd(Date.now()) ? k.day(f.t) + " " : "";
        when.innerHTML = `${esc(day + k.time(f.t))}<small>forecast · ${Math.abs(d) < 8 * 60e3 ? "now" : d > 0 ? "in " + Wx.age(d) : Wx.age(-d) + " ago"}</small>`;
      } else if (f.t) when.innerHTML = `${esc(clk().time(f.t))}<small>${Wx.age(Date.now() - f.t)} ago</small>`;
      else when.innerHTML = f.mins ? `−${f.mins} min<small>before latest</small>` : `Latest<small>scan time unknown</small>`;
      drawLightning();
      if (C.on && f.model) renderChart();
      const fr = !f.future && !f.model && !f.mrms && !f.abi && !f.nc && R.mode !== "replay" && !(f.l3 && f.l3.l2 && f.l3.l2.archive) ? radarFresh() : null;
      if (f.model && f.model.err) note(`This hour did not load (${f.model.err}).`);
      else if (f.mrms && f.mrms.err) note(`This MRMS file did not load (${f.mrms.err}).`);
      else if (f.abi && f.abi.err) note(`This GOES image did not load (${f.abi.err}).`);
      else if (f.l3 && f.l3.err && f.l3.errText) note(f.l3.errText);
      else if ((f.mrms || f.abi) && feedLate()) note(feedLate());
      else if (f.model && R.mm.late && f.model.run === R.mm.run) note(`${MM.SOURCES[f.model.src].label}'s newer runs are late — this is the ${new Date(f.model.run).toISOString().slice(11, 13)}Z run, ${Wx.age(Date.now() - f.model.run)} old. A newer one is usually out ${Wx.age(MM.SOURCES[f.model.src].publishMin * 60e3)} after it starts.`);
      else if ((f.model || f.mrms) && quietNote(f)) note(quietNote(f));
      else if (f.model || f.mrms || f.abi) note("");
      /* the backup on Pro: NOAA's own MRMS mosaic, read straight from NOAA's bucket, not IEM */
      else if (fr && fr.unknown) note(`IEM did not say when its newest mosaic was made, so how old this radar is is not known.${PRO ? " NOAA's own mosaic of the same radars is under MRMS → Composite reflectivity, read straight from NOAA." : ""}`);
      else if (fr && fr.frozen) note(`Radar delayed — the newest file holds a scan from ${fr.age} ago; the feed is repeating old data.`);
      else if (f.future && R.valid && Date.now() - R.valid > 3 * 3600e3) note(`This HRRR run is ${Wx.age(Date.now() - R.valid)} old — a newer one is late.`);
      else if (fr && fr.stale && !(R.mode === "comp" && R.backup)) note(`Radar delayed — the latest scan is ${fr.age} old.${PRO && R.mode === "comp" ? " NOAA's own mosaic is under MRMS → Composite reflectivity." : PRO && single() ? " The US mosaic and MRMS use the radars around it." : ""}`);
      else if (R.mode === "comp" && R.backup) note(`Iowa State's radar mosaic is ${R.iemValid ? Wx.age(Date.now() - R.iemValid) + " behind" : "not answering"}, so this is NOAA's own mosaic of the same radars (MRMS), in the NWS's colours.${fr && fr.stale ? ` It is ${fr.age} old too.` : ""}`);
      else if (S.place && !inUS() && R.mode === "comp") note("This radar covers the lower 48 US states only.");
      else if (R.frames.length) note("");
      if (ltgOn() && LTG.at && R.mode !== "replay" && !$("#radarnote").textContent) {
        const th = ltgThrough();
        if (th && ltgRef() < th.from - 60e3) note("Lightning is held for the last 20 minutes; this frame is older, so none is drawn.");
      }
    }
    /* An empty layer says so (UI-REVIEW B9, 2026-10-23): a model hour or
       an MRMS file with nothing at or above its palette's floor anywhere —
       rotation tracks on a quiet night — is a quiet map, not a broken one.
       Worked out once per layer, over the whole grid, not just the view. */
    function quietNote(f) {
      const m = f.model || f.mrms, L = m && m.layer;
      if (!L || !L.values || !L.field) return "";
      if (L.quiet === undefined) {
        const pal = L.field.pal === "dbz" && NX ? NX.paletteFor("ref", R.pal.ref) : MM.PAL[L.field.pal];
        const floor = pal && pal.floor;
        if (floor == null || pal.cat) L.quiet = "";
        else {
          let any = false;
          for (let i = 0; i < L.values.length; i++) if (L.values[i] >= floor) { any = true; break; }
          const [u, conv] = MM.unitFor(L.field.unit, U());
          L.quiet = any ? "" : `Nothing at or above ${+conv(floor).toFixed(2)} ${u} anywhere in this ${f.mrms ? "file" : "hour"} — a quiet map, not a broken one.`;
        }
      }
      return L.quiet;
    }
    /* How old the radar on screen really is (2026-10-23). The newest scan's
       own time, from inside its file once it has loaded — a feed can keep
       writing new files that hold an old scan, and the name's time never
       showed that — else the time in its name. Allowed twice the gap
       between scans plus three minutes, never under STALE_MS.radar (15):
       a clear-air volume takes ten minutes, and echo tops and VIL wait for
       the whole volume, so a fixed 15 called them delayed when they were not. */
    function radarFresh() {
      const nf = R.frames[R.frames.length - 1], F = nf && nf.l3 && nf.l3.file;
      return Wx.radarAge({ frames: R.frames.map((x) => x.t), nameMs: R.valid, fileMs: F ? F.time : null, comp: R.mode === "comp", asked: !!R.compAsked });
    }
    /* MRMS and GOES: late when the newest file is three of its own steps old (and five minutes more) */
    function feedLate() {
      if (!R.valid || R.mode === "replay") return "";
      const every = R.mode === "mrms" && MR ? (MR.PRODUCTS[R.mr.prod].every || 2) : R.mode === "abi" && AB ? AB.SECTORS[R.ab.sector].every : null;
      if (!every) return "";
      const a = Wx.feedLateMs(every, R.valid);
      return a != null ? `${R.mode === "mrms" ? "MRMS" : "GOES"} delayed — the newest file is ${Wx.age(a)} old.` : "";
    }
    function loadOld() { if (!R.loadedOld) { R.loadedOld = true; draw(); } }
    /* Pro's loop, the data's opacity and the base map (2026-10-23), each kept in this browser */
    const LOOP = Object.assign({ speed: 1, dwell: 1600 }, PRO ? store.get("wx:loop", {}) : {});
    let OPAC = PRO ? Math.max(0.2, Math.min(1, Number(store.get("wx:opacity", 1)) || 1)) : 1;
    let BASE = PRO && ["dark", "dim", "light"].includes(store.get("wx:base", "")) ? store.get("wx:base", "dark") : "dark";
    function setOpacity(v) {
      OPAC = Math.max(0.2, Math.min(1, v)); store.set("wx:opacity", OPAC);
      framesL.style.opacity = OPAC < 1 ? String(OPAC) : "";
      if ($("#opacity")) { $("#opacity").value = String(Math.round(OPAC * 100)); $("#opacityv").textContent = Math.round(OPAC * 100) + "%"; }
    }
    function setBase(b) {
      BASE = ["dark", "dim", "light"].includes(b) ? b : "dark"; store.set("wx:base", BASE);
      if (PRO) el.dataset.base = BASE;
      if ($("#basesel")) $("#basesel").value = BASE;
    }
    function setLoop(k, v) {
      LOOP[k] = v; store.set("wx:loop", LOOP);
      if ($("#loopspeed")) $("#loopspeed").value = String(LOOP.speed);
      if ($("#loopdwell")) $("#loopdwell").value = String(LOOP.dwell);
      if ($("#loopsum")) $("#loopsum").textContent = $("#loopspeed") ? $("#loopspeed").selectedOptions[0].textContent : LOOP.speed + "×";
    }
    /* auto: the page started the loop by itself (a load, a new kind of map) —
       Pro then rests on the newest frame for three seconds first, so the
       first thing read is how fresh the data is (UI-REVIEW-2 item 2) */
    function play(on, auto) {
      const was = R.playing;
      R.playing = on;
      clearTimeout(R.timer);
      /* the legend says the loop while it plays and the frame once it stops */
      if (was !== on && R.started) Promise.resolve().then(() => hear("stamp", stamp()));
      $("#play").innerHTML = on
        ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="#fff"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="#fff"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="#fff"/></svg>';
      $("#play").setAttribute("aria-label", on ? "Pause radar loop" : "Play radar loop");
      if (!on || R.frames.length < 2) return;
      loadOld();
      /* the count is read each step: Weather's forecast frames arrive, and are
         rebuilt, while the loop runs */
      const lastOf = () => R.frames.length - 1;
      const step = () => {
        const last = lastOf();
        const next = R.frame >= last ? 0 : R.frame + 1;
        /* a replay waits (up to ~3 s) for its next frame's tiles rather than
           flashing past empty map */
        const nf = R.frames[next];
        if (nf && nf.archive && nf.tiles.size && ![...nf.tiles.values()].every((im) => im.complete) && (R.wait = (R.wait || 0) + 1) < 12) { R.timer = setTimeout(step, 250); return; }
        /* …and for a decoded scan or model hour to arrive (up to ~6 s) */
        if (nf && ((nf.l3 && !nf.l3.file && !nf.l3.err) || (nf.model && !nf.model.layer && !nf.model.err) || (nf.mrms && !nf.mrms.layer && !nf.mrms.err) || (nf.abi && !nf.abi.layer && !nf.abi.err)) && (R.wait = (R.wait || 0) + 1) < 24) {
          if (nf.l3) l3File(nf); else if (nf.mrms) mrmsLayer(nf); else if (nf.abi) abiLayer(nf); else modelLayer(nf);
          R.timer = setTimeout(step, 250); return;
        }
        R.wait = 0;
        userShow(next);
        R.timer = setTimeout(step, next === last ? LOOP.dwell : 450 / LOOP.speed);
      };
      R.timer = setTimeout(step, R.frame === lastOf() ? (auto && PRO ? 3000 : 600) : 450);
    }

    /* the nearest NEXRAD to the middle of the map */
    async function sitesNear(lat, lon) {
      const sites = await Wx.radarSites(Wx.round2(lat), Wx.round2(lon));
      if (sites.length) { R.sites = sites; siteOptions(); }
      return sites;
    }
    async function pickSite(force) {
      const lat = yLat(R.cy, R.z), lon = xLng(R.cx, R.z);
      /* a radar the visitor chose stays until they let it go */
      if (R.lockId) {
        if (R.site && R.site.id === R.lockId) return false;
        let s = (R.sites || []).find((x) => x.id === R.lockId);
        if (!s) { try { s = (await sitesNear(lat, lon)).find((x) => x.id === R.lockId); } catch (e) {} }
        if (s) { R.site = s; siteOptions(); return true; }
        R.lockId = null;                                  // not a radar the list knows: follow the map
      }
      if (!force && R.site && R.site.lat != null && Wx.distanceM(lat, lon, R.site.lat, R.site.lon) < 120e3) return false;
      try {
        const sites = await sitesNear(lat, lon);
        if (!sites.length) return false;
        const s = sites[0];
        if (R.site && R.site.id === s.id) { siteOptions(); return false; }
        R.site = s; siteOptions();
        return true;
      } catch (e) { return false; }
    }

    async function setMode(mode) {
      /* inside a radar's replay, a product button changes the product, not the mode */
      if (R.replay && R.replay.vols && l3(mode) && l3(mode).l2) {
        R.replay.prodMode = mode;
        document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
        const keep = R.frame;
        play(false); siteReplayFrames(); show(Math.min(keep, R.frames.length - 1)); draw(); label(); renderSources();
        return;
      }
      /* Models from inside a replay: the runs as they stood at the replay's moment */
      if (R.replay && mode === "model") { const t = frameTime(); if (t != null) R.mm.at = t; }
      else if (mode !== "model") R.mm.at = null;
      if (R.replay) { R.replay = null; satL.hidden = false; $("#rplive").hidden = true; }
      /* scrubbed back? the new layer opens on the same moment (one clock) */
      const keepT = R.frames.length > 1 && R.frame < R.frames.length - 1 ? frameTime() : null;
      if (C.on && mode !== "model") chartStop();
      R.mode = mode; if (R.stations && R.obsSlot) stationsSoon();
      if (PRO && l3(mode)) store.set("wx:sitemode", mode);
      document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      play(false);
      clearTiles();
      legend();
      if ($("#modelbar")) $("#modelbar").hidden = mode !== "model";
      if ($("#mrmsbar")) $("#mrmsbar").hidden = mode !== "mrms";
      if ($("#abibar")) $("#abibar").hidden = mode !== "abi";
      if ($("#radarread")) $("#radarread").hidden = true;
      /* GOES's own imagery replaces the satellite tiles under the radar */
      satL.hidden = mode === "abi";
      if ($("#awscredit")) $("#awscredit").hidden = !(l3(mode) || mode === "model" || mode === "mrms" || mode === "abi" || ltgOn());
      tilts();
      /* only the newest switch may finish: tapping Reflectivity then Velocity
         quickly once left reflectivity's scans under the Velocity button */
      const ask = R.modeAsk = (R.modeAsk || 0) + 1;
      if (mode === "comp") {
        const v = await mosaicTime();
        if (ask !== R.modeAsk) return;
        R.valid = v; R.compAsked = true;
        compFrames();
      } else if (mode === "hrrr") {
        await hrrrFrames();
      } else if (mode === "model") {
        await modelFrames();
      } else if (mode === "mrms") {
        await mrmsFrames();
      } else if (mode === "abi") {
        R.abiBox = null;
        await abiFrames();
      } else {
        if (R.z < 7) zoomTo(8);
        await pickSite(!R.site);
        if (ask !== R.modeAsk) return;
        await siteFrames();
      }
      if (ask !== R.modeAsk) return;
      if (keepT != null) { const i = frameNear(keepT); if (i >= 0 && i !== R.frame) { if (i < R.frames.length - 1) loadOld(); show(i); } }
      label(); renderSources();
    }

    /* the colour key under the map, in the visitor's units */
    function legend() {
      const lg = $("#legend");
      if (!lg) return;
      /* a radar's replay keys its own product */
      const P = l3() || (R.mode === "replay" && R.replay && R.replay.prodMode ? l3(R.replay.prodMode) : null);
      lg.classList.remove("vel", "scale", "cats", "rainkey");
      if (R.mode === "abi" && AB) {
        const K = AB.key(R.ab.prod);
        if (!K || K.text) { lg.innerHTML = `<span>${esc(K ? K.text : "")}</span>`; return; }
        if (K.cats) { lg.classList.add("cats"); lg.innerHTML = K.cats.map(([n, c]) => `<span class="sw"><i style="background:${c}"></i>${esc(n)}</span>`).join(""); return; }
        /* brightness temperature is read in °C by everyone who reads it, whatever the page's units (2026-10-23) */
        const pos = (v) => (v - K.min) / (K.max - K.min) * 100, us = false;
        lg.classList.add("scale");
        lg.innerHTML = `<div class="bar"><i aria-hidden="true" style="background:linear-gradient(90deg,${K.stops.map(([v, c]) => `${c} ${pos(v).toFixed(1)}%`).join(",")})"></i><div class="ticks">${K.ticks.map((t) => `<span style="left:${pos(t).toFixed(1)}%">${us ? Math.round(t * 9 / 5 + 32) : t}</span>`).join("")}</div></div><span class="lu">${us ? "°F" : esc(K.unit)}</span>`;
        return;
      }
      if (R.mode === "N0S") { lg.classList.add("vel"); lg.innerHTML = `<span>toward</span><i aria-hidden="true"></i><span>away</span>`; return; }
      let pal = null, unit = "", fmt = (v) => String(v), cats = null;
      if (P) {
        pal = NX.paletteFor(P.pal, R.pal[P.pal]); unit = P.unit;
        if (pal.classes) cats = Object.entries(pal.classes).filter(([k]) => k !== "2").map(([k, c]) => [NX.HCA_CLASSES[k][1], c]);
      } else if ((R.mode === "model" || R.mode === "mrms") && MM) {
        /* a difference map keys its own two-sided scale, not the field's */
        const cur = R.mode === "model" && R.frames[R.frame] && R.frames[R.frame].model && R.frames[R.frame].model.layer;
        const f = R.mode === "mrms" ? MR.PRODUCTS[R.mr.prod] : cur && cur.field.diff ? cur.field : MM.field(R.mm.src, R.mm.field);
        pal = f.pal === "dbz" && NX ? NX.paletteFor("ref", R.pal.ref) : MM.PAL[f.pal];
        if (pal.cat) cats = Object.values(pal.types).map(([name, , hi]) => [name, hi]);
        else {
          const [name, conv] = MM.unitFor(f.unit, U());
          unit = name;
          /* a temperature or a speed converted from a model's own stops (°F, mph) is said whole, not "-6.7" or "8.7" */
          const whole = /^(°[CF]|kt|mph|km\/h)$/.test(name);
          fmt = (v) => { const x = conv(v), sg = f.diff && x > 0 ? "+" : ""; return sg + (whole || Math.abs(x) >= 10 || Number.isInteger(x) ? String(Math.round(x)) : x.toFixed(Math.abs(x) < 1 ? 2 : 1)); };
        }
      }
      if (cats) { lg.classList.add("cats"); lg.innerHTML = cats.map(([n, c]) => `<span class="sw"><i style="background:${c}"></i>${esc(n)}</span>`).join(""); return; }
      /* the mosaic, one site's IEM tiles and the HRRR's picture all use the NWS's
         reflectivity colours: 5 dBZ steps from 5 (#04e9e7) to 70 (#9854c6),
         the same stops as .legend i. Pro numbers them (2026-10-23); Weather
         keeps light-to-heavy. */
      if (!pal && PRO) {
        const pos = (v) => ((v - 5) / 65 * 100).toFixed(1);
        lg.classList.add("scale");
        lg.innerHTML = `<div class="bar"><i aria-hidden="true"></i><div class="ticks">${[10, 20, 30, 40, 50, 60, 70].map((t) => `<span style="left:${pos(t)}%">${t}</span>`).join("")}</div></div><span class="lu">dBZ</span>`;
        return;
      }
      if (!pal && !PRO && R.mode === "comp" && RAIN_LUT && !R.backup) {
        lg.classList.add("rainkey");
        lg.innerHTML = `<b>Precipitation</b><i aria-hidden="true" style="--rain:${RAIN_CSS}"></i><span class="k"><span>Light</span><span>Moderate</span><span>Heavy</span><span>Extreme</span></span>`;
        return;
      }
      if (!pal) { lg.innerHTML = `<span>light</span><i aria-hidden="true"></i><span>heavy</span>`; return; }
      const st = pal.stops, lo = pal.min ?? st[0][0], hi = pal.max ?? st[st.length - 1][0];
      const pos = (v) => Math.max(0, Math.min(1, pal.log ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (v - lo) / (hi - lo)));
      const grad = st.map(([v, c]) => `${c} ${(pos(v) * 100).toFixed(1)}%`).join(",");
      lg.classList.add("scale");
      lg.innerHTML = `<div class="bar"><i aria-hidden="true" style="background:linear-gradient(90deg,${grad})"></i><div class="ticks">${(pal.ticks || []).map((t) => `<span style="left:${(pos(t) * 100).toFixed(1)}%">${esc(fmt(t))}</span>`).join("")}</div></div><span class="lu">${esc(unit)}</span>`;
    }
    /* Pro's map toolbar (2026-10-23, Ric: "make it cleaner and easier to use
       for the professionals"): one row of kinds — the single-radar products
       live in the row under it, shown only while one radar is the layer —
       the overlays in one menu with a count, and the words about the map
       behind ⓘ, so the map gets the height the rows used to take */
    function syncTools() {
      if (!PRO || !$("#siterow")) return;
      const site = !!(l3() || (R.mode === "replay" && R.replay && R.replay.vols));
      $("#siterow").hidden = !site;
      $("#sitekind").setAttribute("aria-pressed", String(site));
      const n = Object.values(R.ov).filter(Boolean).length + (R.stations ? 1 : 0) + (R.outlook ? 1 : 0) + (R.sat ? 1 : 0);
      $("#ovcount").textContent = n ? String(n) : "";
    }
    /* ── The legend (UI-REVIEW B1, 2026-10-23): AWIPS's product legend —
       every layer on the map, one line each, with its time and age, and a
       click hides or shows it. The first line is the data: its words are the
       workstation's stamp (#mainstamp); a click hides the frames, not the map.
       Under it, each overlay that is on, with when it was last fetched (amber
       once that is well past its refresh), and the satellite underneath. A
       line clicked off stays, greyed, so a second click brings it back; one
       turned off in the Overlays panel goes. Pro only. ── */
    /* ── Colour tables (UI-REVIEW B7, 2026-10-23): the visitor's choice of
       reflectivity and velocity colours (Nexrad.SCHEMES), kept in this
       browser. Everything Pro paints itself follows it — a single radar,
       MRMS, a model's reflectivity — and the key with it; the US mosaic
       arrives coloured by IEM and stays the NWS's. Changing it recolours
       what is loaded; maps side by side follow by the storage event. ── */
    /* ── The map's own lines and names (UI-REVIEW B8, 2026-10-23): how
       strongly they are drawn over the data, and how many places are named
       — separate from the data's own opacity, as GR lets a placefile draw
       above or below. Kept in this browser; Weather keeps its defaults. ── */
    R.names = PRO && ["towns", "cities", "none"].includes(store.get("wx:names", "")) ? store.get("wx:names", "") : "towns";
    R.linesOp = PRO ? Math.min(100, Math.max(20, Number(store.get("wx:linesop", 100)) || 100)) : 100;
    const linesOp = () => { if (geoCv) geoCv.style.opacity = String(R.linesOp / 100); if ($("#linesopv")) $("#linesopv").textContent = R.linesOp + "%"; };
    if (PRO) {
      linesOp();
      const lo = $("#linesop"), ns = $("#namesel");
      if (lo) { lo.value = String(R.linesOp); lo.addEventListener("input", () => { R.linesOp = Number(lo.value); store.set("wx:linesop", R.linesOp); linesOp(); }); }
      if (ns) { ns.value = R.names; ns.addEventListener("change", () => { R.names = ns.value; store.set("wx:names", R.names); drawGeo(); }); }
    }
    /* ── Clutter filtering (2026-10-24): all echoes, only what the radar's own
       CC says is likely weather, or everything with the rest marked grey.
       Pro starts on all — raw is the analyst's view — and remembers the
       choice in this browser. NX.clutterMask holds the rule and its reasons;
       a strong echo is never filtered, because a tornado's debris has low CC. ── */
    R.clutter = PRO ? store.get("wx:clutter", "raw") : "raw";
    if (!["raw", "filter", "mark"].includes(R.clutter)) R.clutter = "raw";
    /* the mask for a reflectivity frame, or null when the frame has no CC to go on (yet) */
    function clutterOf(f) {
      const x = f.l3, F = x && x.file;
      if (!F || x.prod !== "ref" || R.clutter === "raw") return null;
      if (F.clut) return F.clut;
      if (F.cc === undefined) {
        if (F.code === "L2" || !x.ccUrl) F.cc = null;
        else if (!x.ccP) x.ccP = cached(x.ccUrl, () => NX.load(x.ccUrl)).then((c) => { F.cc = c; }, () => { F.cc = null; F.ccErr = true; }).then(() => { F.clut = null; f.painted = null; if (R.frames[R.frame] === f) { draw(); legendBase(); } });
        if (F.cc === undefined) return null;
      }
      return (F.clut = NX.clutterMask(F, F.cc));
    }
    function setClutter(v) {
      if (!["raw", "filter", "mark"].includes(v) || v === R.clutter) return;
      R.clutter = v; store.set("wx:clutter", v);
      const sel = $("#cluttersel"); if (sel) sel.value = v;
      for (const f of R.frames) f.painted = null;
      draw(); legendBase();
    }
    if ($("#cluttersel")) { $("#cluttersel").value = R.clutter; $("#cluttersel").addEventListener("change", (e) => setClutter(e.target.value)); }
    /* dealiasing: off by default — raw is the analyst's view, as with clutter */
    R.dealias = PRO ? !!store.get("wx:dealias", false) : false;
    if ($("#dealiasbtn")) $("#dealiasbtn").addEventListener("click", () => {
      R.dealias = !R.dealias; store.set("wx:dealias", R.dealias);
      $("#dealiasbtn").setAttribute("aria-pressed", String(R.dealias));
      /* every frame read again from the decoded volume it already has (no new download) */
      for (const f of R.frames) if (f.l3 && f.l3.l2) Object.assign(f.l3, { p: null, file: null, err: false, colors: null }), f.painted = null;
      draw(); label();
    });
    R.pal = { ref: "nws", vel: "nws" };
    if (PRO && NX) for (const k of ["ref", "vel"]) { const v = store.get("wx:pal" + k, "nws"); if (NX.SCHEMES[k][v]) R.pal[k] = v; }
    function lutFor(L) { return MM.table(L.field.pal, 255, L.field.pal === "dbz" && NX ? NX.paletteFor("ref", R.pal.ref) : null); }
    function recolor() {
      for (const f of R.frames) {
        if (f.l3 && f.l3.file) { f.l3.colors = NX.colorTable(f.l3.file, f.l3.prod, R.pal); f.painted = null; }
        const m = f.model || f.mrms;
        if (m && m.layer && m.layer.field && m.layer.field.pal === "dbz") { m.lut = lutFor(m.layer); f.painted = null; }
      }
      if (R.frames.length) show(R.frame);
      draw(); legend();
    }
    function setPal(k, v, keep) {
      if (!NX || !NX.SCHEMES[k][v] || R.pal[k] === v) return;
      R.pal[k] = v;
      if (keep) store.set("wx:pal" + k, v);
      const sel = $("#pal" + k); if (sel) sel.value = v;
      recolor();
    }
    if (PRO && NX) for (const k of ["ref", "vel"]) {
      const sel = $("#pal" + k);
      if (!sel) continue;
      sel.innerHTML = Object.entries(NX.SCHEME_NAMES[k]).map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("");
      sel.value = R.pal[k];
      sel.addEventListener("change", () => setPal(k, sel.value, true));
    }
    const LGOFF = new Set();
    const LG = () => [
      { k: "sat", on: () => !!R.sat, name: () => "Satellite under", src: () => { const o = $("#satsel") && $("#satsel").selectedOptions[0]; return o && o.value ? o.textContent : ""; }, col: "#9aa5b4", btn: null },
      /* map lines are the map's furniture, on by default and credited in the corner: the legend names them only once they are off (declutter, 2026-10-24) */
      { k: "lines", on: () => R.ov.lines, name: () => "Map lines", src: () => "Natural Earth", col: "#c3cad4", btn: '[data-ov="lines"]', quiet: true },
      { k: "watches", on: () => R.ov.watches, name: () => "Watches & discussions", src: () => "SPC · WPC", at: () => R.pro.wGot, every: 120e3, col: "#f783ac", btn: '[data-ov="watches"]' },
      { k: "cells", on: () => R.ov.cells, name: () => "Storm cells", src: () => "NEXRAD", at: () => R.pro.cGot, every: 120e3, col: "#e9ecef", btn: '[data-ov="cells"]' },
      { k: "lightning", on: () => R.ov.lightning, name: () => "Lightning", src: () => "GOES GLM · 10 min", at: () => LTG.at, every: 60e3, col: "#ffd43b", btn: '[data-ov="lightning"]' },
      { k: "density", on: () => R.ov.density, name: () => "Flash density", src: () => `GOES GLM · ${R.densWin} min`, at: () => LTG.at, every: 60e3, col: "#fd7e14", btn: '[data-ov="density"]' },
      { k: "reports", on: () => R.ov.reports, name: () => "Storm reports", src: () => "NWS · 24 h", at: () => R.pro.rGot, every: 120e3, col: "#ff8787", btn: '[data-ov="reports"]' },
      { k: "fronts", on: () => R.ov.fronts, name: () => "Fronts", src: () => "WPC analysis", at: () => R.pro.surface && R.pro.surface.issued, every: 3 * 3600e3, col: "#4dabf7", btn: '[data-ov="fronts"]', issued: true },
      { k: "stations", on: () => R.stations, name: () => "Stations", src: () => "airports and networks", col: "#e9ecef", btn: "#stationtoggle" },
      { k: "outlook", on: () => R.outlook, name: () => "SPC outlook", src: () => (Wx.OUTLOOKS[R.olSel] || {}).label || "Day 1 · categorical", at: () => { const L = outlookList(), f = L && L.find((o) => o.issued); return f ? f.issued : null; }, col: "#69db7c", btn: "#outlooktoggle", issued: true },
      { k: "rings", on: () => R.ov.rings, name: () => "Range rings", src: () => (U() !== "metric" ? "every 25 mi" : "every 50 km"), col: "#c3cad4", btn: '[data-ov="rings"]' },
      { k: "tropics", on: () => R.ov.tropics, name: () => "Tropics", src: () => "NHC", at: () => R.pro.tAt, every: 600e3, col: "#ff922b", btn: '[data-ov="tropics"]' },
      { k: "terrain", on: () => !!R.ov.terrain, name: () => "Terrain", src: () => "USGS 3DEP · SRTM", col: "#c8a27a", btn: '[data-ov="terrain"]' },
    ];
    let lgSatWas = "";
    function legendRows() {
      const box = $("#lgrows");
      if (!PRO || !box) return;
      const k = clk(), now = Date.now();
      box.innerHTML = LG().filter((d) => d.quiet ? !d.on() : d.on() || LGOFF.has(d.k)).map((d) => {
        const on = d.on(), t = d.at ? d.at() : null;
        /* fetched more than three refreshes (and five minutes) ago: late */
        const late = on && t && d.every && now - t > 3 * d.every + 300e3;
        const when = t ? ` · ${d.issued ? "issued" : "as of"} ${k.time(t)}` : "";
        return `<button type="button" class="lgrow${late ? " stale" : ""}" data-lg="${d.k}" aria-pressed="${on}" title="${on ? "Hide" : "Show"} ${esc(d.name().toLowerCase())}"><i class="lgsw" style="background:${d.col}" aria-hidden="true"></i><span>${esc(d.name())}<em> · ${esc(d.src())}${esc(when)}${late ? " · late" : ""}</em></span></button>`;
      }).join("");
    }
    if (PRO && $("#lgrows")) {
      $("#lgrows").addEventListener("click", (e) => {
        const b = e.target.closest("[data-lg]");
        if (!b) return;
        const d = LG().find((x) => x.k === b.dataset.lg);
        if (!d) return;
        const on = d.on();
        if (d.k === "sat") {
          const sel = $("#satsel");
          if (sel) { if (on) lgSatWas = sel.value; sel.value = on ? "" : lgSatWas || "ir"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
        } else { const btn = document.querySelector(d.btn); if (btn) btn.click(); }
        if (on) LGOFF.add(d.k); else LGOFF.delete(d.k);
        legendRows();
      });
      /* turned off anywhere else, a line goes (the legend's own clicks re-add theirs above) */
      document.addEventListener("click", (e) => { if (!e.target.closest("#lgrows") && e.target.closest("[data-ov],#stationtoggle,#outlooktoggle")) { LGOFF.clear(); setTimeout(legendRows, 0); } }, true);
      $("#lgbase").addEventListener("click", () => {
        const hide = !el.classList.contains("datahide");
        el.classList.toggle("datahide", hide);
        $("#lgbase").setAttribute("aria-pressed", String(!hide));
      });
    }
    /* the mode's own line (a model's run and hours, a satellite's sector,
       MRMS's file) said in the legend under the data line (UI-REVIEW B5):
       on a wide single map the toolbar hides it, so the run and its age
       are said once, where the rest of the time is. A line holding a button
       stays in the toolbar, where the button works. */
    function legendNote() {
      const n = $("#lgnote");
      if (!PRO || !n) return;
      const src = ["#mmrun", "#abirun", "#mrrun"].map((q) => $(q)).find((x) => x && x.closest(".modelbar") && !x.closest(".modelbar").hidden && x.textContent.trim() && !x.querySelector("button"));
      n.textContent = src ? src.textContent.trim() : "";
      n.hidden = !n.textContent;
    }
    if (PRO && typeof MutationObserver === "function") for (const q of ["#mmrun", "#abirun", "#mrrun"]) { const x = $(q); if (x) new MutationObserver(legendNote).observe(x, { childList: true, characterData: true, subtree: true }); }
    /* the data line: amber when the feed behind it is late */
    function legendBase() {
      const b = $("#lgbase");
      if (!PRO || !b) return;
      const f = R.frames[R.frame];
      const fr = f && !f.future && !f.model && !f.mrms && !f.abi && !f.nc && R.mode !== "replay" && !(f.l3 && f.l3.l2 && f.l3.l2.archive) ? radarFresh() : null;
      const late = !!((fr && (fr.stale || fr.frozen)) || ((R.mode === "mrms" || R.mode === "abi") && feedLate()) || (f && f.model && R.mm.late && f.model.run === R.mm.run));
      b.classList.toggle("stale", late);
      /* clutter filtering, said on the line of the data it changes: how much it took out, or why it could not */
      const lc = $("#lgclut");
      if (lc) {
        const cm = f && f.l3 && f.l3.prod === "ref" && R.clutter !== "raw" ? clutterOf(f) : null, F = f && f.l3 && f.l3.file;
        const t = !f || !f.l3 || f.l3.prod !== "ref" || R.clutter === "raw" || !F ? ""
          : !cm ? "filter: reading CC…"
          : !cm.cc ? `filter off: no CC ${F.ccErr ? "(it did not load)" : "for this scan"}`
          : `${R.clutter === "filter" ? "filtered" : "marked grey"}: ${cm.echoes ? Math.round(cm.removed / cm.echoes * 100) : 0}% of echoes likely not weather`;
        lc.textContent = t; lc.hidden = !t;
      }
      /* a new kind of map brings its data back into view */
      if (R.lgMode !== R.mode) { R.lgMode = R.mode; el.classList.remove("datahide"); b.setAttribute("aria-pressed", "true"); }
    }

    /* ── The timeline (UI-REVIEW B2, 2026-10-23): a tick a frame under the
       slider — filled once that frame has loaded, hollow while it loads, red
       if it failed — times along it (a model's forecast hours, the clock
       otherwise; WxWorkstation.timelineMarks picks them), and the frame's own
       time riding on the cursor, which is also what a screen reader hears. ── */
    function frameState(f, i) {
      if (!f) return "wait";
      /* a frame nobody has asked for yet (the older ones load once the loop plays) is idle, not loading */
      const asked = R.playing || R.loadedOld || i === R.frame;
      /* loaded means decoded: a single radar's file once parsed; a model hour, an MRMS or a GOES file once it has its layer
         (an MRMS or GOES frame carries its listing's file from the start — that is not the data) */
      if (f.l3) return f.l3.err ? "err" : f.l3.file ? "ok" : asked ? "wait" : "idle";
      const part = f.model || f.mrms || f.abi;
      if (part) return part.err ? "err" : part.layer ? "ok" : asked ? "wait" : "idle";
      if (f.nc) return "ok";
      if (f.tiles) {
        if (!f.tiles.size) return f.el && f.el.classList.contains("on") ? "wait" : "idle";
        const imgs = [...f.tiles.values()];
        return imgs.every((im) => im.complete) ? (imgs.some((im) => im.complete && !im.naturalWidth) && imgs.every((im) => !im.naturalWidth) ? "err" : "ok") : "wait";
      }
      return "ok";
    }
    const frameFh = (f) => (f && f.model && !MM.SOURCES[f.model.src].analysis ? f.model.fh : null);
    function tipText(f) {
      const t = validTime(f);
      if (t == null) return "";
      const k = clk(), day = k.ymd(t) !== k.ymd(Date.now()) ? k.day(t) + " " : "", fh = frameFh(f);
      return (fh != null ? `F${String(fh).padStart(3, "0")} · ` : "") + day + k.time(t);
    }
    let tlWait = 0;
    if (PRO) addEventListener("resize", () => timeline());
    /* with a mouse over the data (not over a control on it), the legend and the colour key step back (item 7) */
    if (PRO) {
      const card = $("#radarcard");
      el.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && card) card.classList.toggle("mapfocus", !e.target.closest(".maplegend,#legend,.zoom,.mapmenu,.pin,.read,.layersbtn,.mapctl")); });
      el.addEventListener("pointerleave", () => { if (card) card.classList.remove("mapfocus"); });
    }
    /* with a mouse, the bar says the time of the frame under the pointer before you step to it (B9) */
    if (PRO && $("#scrubwrap")) {
      const wrap = $("#scrubwrap");
      wrap.addEventListener("pointermove", (e) => {
        const tip = $("#scrubtip"), n = R.frames.length;
        if (e.pointerType !== "mouse" || !tip || n < 2) return;
        const r = wrap.getBoundingClientRect(), i = Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left - 5) / Math.max(1, r.width - 10) * (n - 1))));
        tip.textContent = tipText(R.frames[i]); tip.style.left = (i / (n - 1) * 100).toFixed(2) + "%"; tip.classList.toggle("peek", i !== R.frame);
      });
      wrap.addEventListener("pointerleave", () => { const tip = $("#scrubtip"); if (tip) tip.classList.remove("peek"); timeline(); });
    }
    function timeline() {
      const box = $("#scrubticks"), tip = $("#scrubtip"), sc = $("#scrub");
      if (!box || !sc) return;
      const n = R.frames.length;
      if (n < 2) { box.innerHTML = ""; if (tip) tip.textContent = ""; sc.removeAttribute("aria-valuetext"); return; }
      const W = Math.max(80, box.clientWidth || sc.clientWidth || 300);
      const marks = WS ? WS.timelineMarks(R.frames.map((f) => { const fh = frameFh(f); return fh != null ? { t: validTime(f), fh } : { t: validTime(f) }; }), clk(), Math.floor(W / 110)) : [];
      const pos = (i) => (i / (n - 1) * 100).toFixed(2) + "%";
      let waiting = false;
      box.innerHTML = R.frames.map((f, i) => {
        const st = frameState(f, i);
        if (st === "wait") waiting = true;
        return `<i class="tk ${st}${i === R.frame ? " cur" : ""}" style="left:${pos(i)}"></i>`;
      }).join("") + marks.map((m) => `<b class="tlab" style="left:${pos(m.i)}">${esc(m.text)}</b>`).join("");
      const txt = tipText(R.frames[R.frame]);
      if (tip) { tip.textContent = txt; tip.style.left = pos(R.frame); }
      /* the frame on screen still loading: the legend says so, with how many are ready (UI-REVIEW-2 item 6) */
      const ld = $("#lgload");
      if (ld) {
        const st = R.frames.map((f, i) => frameState(f, i)), here = st[R.frame] === "wait", ready = st.filter((x) => x === "ok").length;
        const t = here ? `loading · ${ready} of ${n} frame${n === 1 ? "" : "s"} ready` : "";
        if (ld.textContent !== t) ld.textContent = t;
        ld.hidden = !t;
      }
      if (txt) sc.setAttribute("aria-valuetext", txt); else sc.removeAttribute("aria-valuetext");
      /* while any frame is still loading, look again in a second (only the ticks change) */
      clearTimeout(tlWait);
      if (waiting) tlWait = setTimeout(timeline, 1000);
    }

    function label() {
      syncTools();
      legend();
      legendRows(); legendBase(); legendNote();
      const sb = $("#sitebar");
      if (R.mode === "comp") sb.textContent = PRO ? "NEXRAD mosaic of the whole country, every 5 minutes." : "";
      else if (R.mode === "replay" && R.replay && R.replay.prodMode) { const rp = R.replay, P = l3(rp.prodMode), n = rp.warn ? new Set(rp.warn.map((w) => w.sig + w.wfo + w.event + w.area)).size : null; sb.textContent = `Replay: ${rp.site ? rp.site + "'s own" : "the nearest radar's"} full volume (Level II), ${lc(P.label)} at the lowest tilt, ${dayFmt(rp.from)} ${timeFmt(rp.from)} to ${timeFmt(rp.to)}${rp.vols ? `, ${rp.vols.length} volumes` : " — finding the radar's volumes"}, with each storm warning drawn for the minutes it was in force${rp.warn ? ` (${n} warning${n === 1 ? "" : "s"})` : ""}. The product buttons change what is shown; NOAA's archive on AWS.`; }
      else if (R.mode === "replay" && R.replay) { const rp = R.replay, n = rp.warn ? new Set(rp.warn.map((w) => w.sig + w.wfo + w.event + w.area)).size : null; sb.textContent = `Replay: the national radar as it was, ${dayFmt(rp.from)} ${timeFmt(rp.from)} to ${timeFmt(rp.to)}, every ${rp.step} minutes, with each storm warning drawn for the minutes it was in force${rp.warn ? ` (${n} warning${n === 1 ? "" : "s"})` : rp.err ? " — the warnings archive did not answer" : " — loading the warnings"}. Archive via IEM.`; }
      else if (R.mode === "hrrr") sb.textContent = `A forecast, not radar: the HRRR model's own picture of the rain${R.valid ? ` from its ${new Date(R.valid).toISOString().slice(11, 13)}Z run` : ""}, every 15 minutes for the first hour then hourly to 18 hours. Lower 48 only.`;
      else if (R.mode === "abi" && AB) { const P = AB.PRODUCTS[R.ab.prod]; sb.textContent = `${AB.SATS[abiSat()].label} — ${P.group === "Single bands" ? P.label : P.label + " RGB"}, ${lc(AB.SECTORS[R.ab.sector].label)}, read from NOAA's own files. Hover or tap for each band's value.${/\(day\)/.test(P.label) ? " Dark at night: it is made from sunlight." : ""}`; }
      else if (R.mode === "mrms" && MR) sb.textContent = `MRMS — every NEXRAD blended by NOAA, with the model's temperatures and the rain gauges: ${lc(MR.PRODUCTS[R.mr.prod].label)}. Measured from radar, not a forecast. Hover or tap for the value.`;
      else if (R.mode === "model" && MM && MM.SOURCES[R.mm.src].server) { const f = MM.field(R.mm.src, R.mm.field); sb.textContent = `Mesoanalysis, computed every hour the way SPC computes theirs: the RAP model's one-hour forecast, with NOAA's 15-minute surface analysis at the ground, every column worked through every level (25 hPa apart) on a 0.25° grid. Not a forecast, and not SPC's own (that is the SPC mesoanalysis card below). ${f.label}. The slider steps through the hours; hover or tap for the value.`; }
      else if (R.mode === "model" && MM && MM.SOURCES[R.mm.src].analysis) { const f = MM.field(R.mm.src, R.mm.field); sb.textContent = `Mesoanalysis — the HRRR model's analysis hour: its picture of now, with the latest observations folded in. Not a forecast, and not SPC's own (that is the SPC mesoanalysis card below). ${f.label}. The slider steps through the last six hours; hover or tap for the value.`; }
      else if (R.mode === "model" && MM) { const f = MM.field(R.mm.src, R.mm.field); sb.textContent = `A forecast, not an observation — ${MM.SOURCES[R.mm.src].long}. ${f.label}${R.mm.run ? `, from the ${new Date(R.mm.run).toISOString().slice(11, 13)}Z run` : ""}. The slider is the forecast hour; hover or tap for the value.`; }
      else if (l3() && R.site) { const f = R.frames[R.frame], F = f && f.l3 && f.l3.file; sb.textContent = `${R.site.id} · ${R.site.name} · ${l3().long}${F ? ` · ${F.elev.toFixed(1)}° scan` : ""}. ${useL2() ? "The full volume (Level II), every tilt at full resolution, refreshed every 30 seconds" : "Read from the radar's own Level III files"}; ${R.lockId ? "kept on this radar wherever the map goes" : "the site follows the middle of the map"}. Hover or tap for the value.`; }
      else if (l3()) sb.textContent = "Finding the nearest radar…";
      else if (R.site) sb.textContent = `${R.site.id} · ${R.site.name} · ${Wx.SITE_PRODUCTS[R.mode].long}. ${R.lockId ? "Kept on this radar wherever the map goes." : "The site follows the middle of the map."}`;
      else sb.textContent = "Finding the nearest radar…";
      if (PRO && R.ov.cells && R.started && R.mode !== "replay" && R.z < 6) sb.textContent += " Zoom in to see storm cells.";
      if (R.stations && R.started && R.mode === "replay" && R.z >= STN_MINZ) sb.textContent += R.obsSlot ? ` Stations: the airports as they read at ${clk().time(R.obsSlot)} (the last report in the 40 minutes before), from IEM's archive.` : " Stations: reading the archive for this moment…";
      if (R.stations && R.started && R.mode !== "replay") sb.textContent += R.z < STN_MINZ ? (PRO ? " Zoom in to see the stations (round: airports; square: road, farm and gauge networks)." : " Zoom in to see the airport stations.") : R.obs.length ? " Tap a station for its full reading." : "";
      if (ltgOn() && R.started && R.mode !== "replay") {
        const n10 = LTG.flashes.filter((x) => x.t >= Date.now() - 10 * 60e3).length, D = R.ov.density && LTG.at ? ltgDensity() : null;
        sb.textContent += LTG.failed ? " Lightning: GOES did not answer."
          : !LTG.at ? " Lightning: loading the last 20 minutes…"
          : (R.ov.lightning ? ` Lightning: ${n10.toLocaleString()} flashes in the last 10 minutes, newest brightest; scrub back and it shows the minutes before that frame.` : "")
            + (D ? ` Flash density: flashes in each 8 km square over the ${R.densWin === 1 ? "last minute" : `last ${R.densWin} minutes`}${D.short ? " (still filling in)" : ""}, most ${D.max}.` : "");
        if (R.ov.cells && R.z >= 6) sb.textContent += " Tap a storm cell for its flash rate.";
      }
      if (PRO && R.outlook && R.started) {
        const L = outlookList(), first = L && L.find((o) => o.issued), name = (Wx.OUTLOOKS[R.olSel] || {}).label || "Day 1 · categorical";
        sb.textContent += !L ? ` SPC outlook (${name}): ${R.olData[R.olSel] && R.olData[R.olSel].list === null ? "SPC did not answer" : "loading…"}.`
          : !L.length ? ` SPC outlook (${name}): no areas in force.`
          : ` SPC outlook (${name})${first ? `, issued ${clk().time(first.issued)}${first.forecaster ? " by " + first.forecaster : ""}` : ""}${L.some((o) => o.sig) ? "; the hatching is the significant-severe area" : ""}.`;
      }
      if (PRO && R.ov.tropics && R.started) {
        const T = R.pro.tropics;
        sb.textContent += R.pro.tErr && !T ? " Tropics: NHC did not answer."
          : !T ? " Tropics: asking NHC…"
          : !T.storms.length ? ` Tropics: no active storms${T.outlook.length ? `; ${T.outlook.length} area${T.outlook.length === 1 ? "" : "s"} NHC is watching (dashed, with the chance of development in 2 and 7 days)` : ""}.`
          : ` Tropics: ${T.storms.map((st) => `${st.name} — ${st.wind != null ? Math.round(st.wind) + " kt" : ""}${st.mslp ? ", " + st.mslp + " mb" : ""}${st.speed != null ? `, moving ${Wx.compass(st.dir)} at ${st.speed} kt` : ""} (NHC advisory ${st.adv}, ${st.advDate})`).join("; ")}. The white cone is where the centre will probably go, not how big the storm is; coastal lines are NHC's watches and warnings.${T.outlook.length ? " Dashed areas: where NHC is watching for new storms." : ""}`;
      }
      if (PRO && R.ov.reports && R.started && R.mode !== "replay" && R.pro.rGot) { const n = R.pro.reports.filter((r) => r.severe).length; sb.textContent += ` Storm reports: ${n} severe in the last 24 hours${R.z < 7 ? " (zoom in for rain, snow and the rest)" : ""} — tap one for who reported it.`; }
      if (R.sat && PRO && AB && pastSat.el && !pastSat.el.hidden) {
        sb.textContent += pastSat.none ? " Under it: no satellite image — the GOES files this page reads begin in 2018."
          : pastSat.t ? ` Under it: ${Wx.SAT[R.sat].label.toLowerCase()} from ${AB.SATS[pastSat.sat].label}, ${clk().time(pastSat.t)} — the image nearest the frame on screen, read from NOAA's own files.` : " Under it: finding the satellite image for this moment…";
      } else if (R.sat && R.mode !== "replay") {
        const night = R.sat === "vis" && S.fc && S.fc.current && S.fc.current.isDay === false;
        sb.textContent += ` Under it: ${Wx.SAT[R.sat].long}${night ? " It is night here, so this part of the map is dark — try Infrared." : ""} The latest image; it refreshes every few minutes${PRO ? " (step the loop back and the image follows it)" : ""}.`;
      }
      if (R.started && R.frames[R.frame]) show(R.frame);
    }
    function describe() {
      if (l3()) return `${R.site ? R.site.id + " " : ""}${lc(l3().label)}, ${useL2() ? "Level II full volume" : "Level III"} (NOAA open data on AWS)`;
      if (R.mode === "model" && MM) return `${MM.SOURCES[R.mm.src].label} ${lc(MM.field(R.mm.src, R.mm.field).label)}`;
      if (R.mode === "abi" && AB) return `${AB.SATS[abiSat()].label} ${AB.PRODUCTS[R.ab.prod].label}${AB.PRODUCTS[R.ab.prod].group === "Single bands" ? "" : " RGB"} (NOAA open data on AWS)`;
      if (R.mode === "mrms" && MR) return `MRMS ${lc(MR.PRODUCTS[R.mr.prod].label)} (NOAA open data on AWS)`;
      return R.mode === "comp" ? (R.backup ? "NEXRAD base reflectivity, NOAA's MRMS mosaic (backup — IEM's is down or late)" : "NEXRAD base reflectivity, US mosaic (IEM)") : R.mode === "hrrr" ? "HRRR simulated reflectivity, the latest run (IEM)" : R.mode === "replay" ? (R.replay && R.replay.site ? `${R.replay.site} Level II archive (NOAA open data on AWS)` : "NEXRAD mosaic archive (IEM)") : `${R.site ? R.site.id + " " : ""}${Wx.SITE_PRODUCTS[R.mode].label.toLowerCase()} (NEXRAD via IEM)`;
    }

    async function start() {
      if (R.started) return;
      R.started = true;
      /* the map's canvas text (towns, contour labels) is drawn in Pro's own type: draw again once it has loaded */
      if (PRO && document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (R.started) draw(); });
      if (PRO) { setOpacity(OPAC); setBase(BASE); }
      const sat = store.get("wx:sat", null);           // the visitor's last choice, this browser only
      /* a panel shows only what its layers say, never the main page's underlay */
      if (PRO && !PANEL && Wx.SAT[sat]) setSat(sat);
      if (R.wlApply) R.wlApply();
      const linked = PRO ? applyLink() : false;          // a shared view wins over the place's
      /* no link: the map reopens where it was left (UI-REVIEW-3 item 1) — a place chosen later still moves it */
      if (PRO && !PANEL && !linked) {
        const lv = store.get("wx:lastview", null);
        if (lv && Wx.validLat(lv.lat) && Wx.validLon(lv.lon) && Number.isInteger(lv.z) && lv.z >= MINZ && lv.z <= MAXZ) { R.us = false; R.z = lv.z; R.cx = lngX(lv.lon, R.z); R.cy = latY(lv.lat, R.z); clearTiles(); }
      }
      /* after the link, which may have turned a lightning layer on */
      if (ltgOn()) { lightningClock(); if ($("#awscredit")) $("#awscredit").hidden = false; }
      /* the pickers say what the link chose */
      if (PRO && $("#mrprod") && MR) $("#mrprod").value = R.mr.prod;
      if (PRO && $("#abiprod") && AB) { $("#abiprod").value = R.ab.prod; $("#abisec").value = R.ab.sector; $("#abisat").value = R.ab.sat; }
      if (PRO && $("#mmfield") && MM) modelOptions();
      if (typeof linked === "string") { setMode(linked); loadOverlays(true); stationsSoon(); return; }
      if (R.mode === "comp") {
        compFrames();
        const v = await mosaicTime();
        if (R.mode !== "comp") return;               // a replay began meanwhile: it owns the frames now
        R.valid = v; R.compAsked = true;
        compFrames();
      } else if (single()) await siteFrames();
      label(); renderSources();
      stationsSoon(); loadOverlays(true);
      if (!reduced) setTimeout(() => { if (R.visible) play(true, true); }, 900);
    }

    /* ── Zoom that feels like a map (UI-REVIEW-2 item 1, 2026-10-24). The
       map's zoom levels stay whole numbers — every tile set and painter
       assumes them — but getting from one to the next is a gesture: the
       wheel, a trackpad's pinch, two fingers, a double-click, ± and the keys
       all scale the map's layers live with a CSS transform about the point
       under the pointer, then settle on the nearest level with that point
       held still. Nothing goes blank: a snapshot of the scaled picture (the
       ghost) sits over the new level until it has loaded, then fades.
       Before this, zoom was a whole level at a time about the middle of the
       map, and every step cleared the map and redrew it from nothing. ── */
    const Z = { acc: 0, ox: 0, oy: 0, t: 0, ghost: null, gt: 0, busy: false };
    const zlayers = () => [...el.querySelectorAll(":scope > .layer, :scope > #radarframes, :scope > svg.over")];
    const zmotion = () => !reduced;
    function zsetTransform(s, ox, oy, tx = 0, ty = 0, ms = 0) {
      for (const L of zlayers()) {
        L.style.transformOrigin = `${ox}px ${oy}px`;
        L.style.transition = ms ? `transform ${ms}ms ease-out` : "";
        L.style.transform = s === 1 && !tx && !ty ? "" : `translate(${tx}px,${ty}px) scale(${s})`;
      }
    }
    /* a still copy of the layers as they look now (canvases copied pixel for pixel), laid over them */
    function zghost() {
      zdropGhost(true);
      const g = document.createElement("div");
      g.className = "zghost";
      for (const L of zlayers()) {
        const c = L.cloneNode(true);
        const from = L.tagName === "CANVAS" ? [L] : [...L.querySelectorAll("canvas")], to = c.tagName === "CANVAS" ? [c] : [...c.querySelectorAll("canvas")];
        from.forEach((src, i) => { const dst = to[i]; if (!dst) return; dst.width = src.width; dst.height = src.height; try { dst.getContext("2d").drawImage(src, 0, 0); } catch (e) {} });
        c.removeAttribute("id"); c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        g.appendChild(c);
      }
      const over = $("#radarover");
      el.insertBefore(g, over ? over.nextSibling : null);
      Z.ghost = g;
      return g;
    }
    function zdropGhost(now) {
      const g = Z.ghost;
      if (!g) return;
      Z.ghost = null; clearTimeout(Z.gt);
      if (now || !zmotion()) { g.remove(); return; }
      g.style.transition = "opacity 140ms"; g.style.opacity = "0";
      setTimeout(() => g.remove(), 160);
    }
    /* the new level is on screen: the map under it has loaded and the frame on show is drawn */
    function zready() {
      const imgs = [...el.querySelectorAll("#radarbase img")];
      const base = imgs.length > 0 && imgs.every((im) => im.complete);
      const f = R.frames[R.frame];
      return base && (!f || frameState(f, R.frame) !== "wait");
    }
    function zwaitGhost(t0 = Date.now()) {
      clearTimeout(Z.gt);
      if (!Z.ghost) return;
      if (zready() || Date.now() - t0 > 2500) { zdropGhost(false); return; }
      Z.gt = setTimeout(() => zwaitGhost(t0), 80);
    }
    /* settle: dz whole levels, the world point under (ox, oy) moved to (sx, sy) on screen.
       `shown` is the scale the layers are showing now (the gesture's), so the ghost eases from it to the level's. */
    function zcommit(dz, ox, oy, sx = ox, sy = oy, shown = 2 ** dz, tx = sx - ox, ty = sy - oy) {
      const nz = Math.min(MAXZ, Math.max(MINZ, R.z + dz));
      dz = nz - R.z;
      const w = el.clientWidth, h = el.clientHeight;
      if (!dz && !tx && !ty) { zsetTransform(1, ox, oy, 0, 0, zmotion() ? 140 : 0); setTimeout(() => zsetTransform(1, ox, oy), 150); return; }
      const g = zghost();
      for (const c of g.children) { c.style.transformOrigin = `${ox}px ${oy}px`; c.style.transform = `translate(${tx}px,${ty}px) scale(${shown})`; }
      if (zmotion() && Math.abs(shown - 2 ** dz) > 0.01) requestAnimationFrame(() => { for (const c of g.children) { c.style.transition = "transform 120ms ease-out"; c.style.transform = `translate(${tx}px,${ty}px) scale(${2 ** dz})`; } });
      zsetTransform(1, ox, oy);
      const wx = R.cx - w / 2 + ox, wy = R.cy - h / 2 + oy, f = 2 ** dz;
      R.z = nz; R.cx = wx * f - sx + w / 2; R.cy = wy * f - sy + h / 2;
      clearTiles(); draw(); stationsSoon();
      if (single() && !R.lockId) { clearTimeout(follow); follow = setTimeout(async () => { if (await pickSite(false)) { clearTiles(); await siteFrames(); label(); } }, 700); }
      zwaitGhost();
    }
    /* ±, the keys, a double-click: one level, eased, about a point (the middle unless one is given) */
    function zoomAt(nz, ox = el.clientWidth / 2, oy = el.clientHeight / 2) {
      nz = Math.min(MAXZ, Math.max(MINZ, nz));
      if (nz === R.z || Z.busy) return;
      const dz = nz - R.z;
      if (!zmotion()) { zcommit(dz, ox, oy); return; }
      Z.busy = true;
      zsetTransform(2 ** dz, ox, oy, 0, 0, 160);
      setTimeout(() => { Z.busy = false; zcommit(dz, ox, oy); }, 170);
    }
    function zoomTo(nz) { zoomAt(nz); }
    /* the wheel and a trackpad: the scale follows the fingers; the level is settled once they stop */
    el.addEventListener("wheel", (e) => {
      if (e.target.closest(".pin,.wxmenu,.read,.maplegend,.mapctl")) return;
      /* on Weather the small map leaves the wheel to the page; its full-screen map takes it */
      if (!PRO && !$("#radarcard").classList.contains("mapfull")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (!Z.acc) { zdropGhost(true); Z.ox = e.clientX - r.left; Z.oy = e.clientY - r.top; }
      const d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);
      /* a trackpad pinch arrives as a wheel with ctrl held, in small steps; a mouse wheel in notches of about 100 */
      const k = e.ctrlKey ? 0.012 : Math.abs(d) >= 50 ? 0.005 : 0.003;
      Z.acc = Math.min(MAXZ - R.z + 0.35, Math.max(MINZ - R.z - 0.35, Z.acc - d * k));
      zsetTransform(2 ** Z.acc, Z.ox, Z.oy);
      clearTimeout(Z.t);
      Z.t = setTimeout(() => { const a = Z.acc; Z.acc = 0; zcommit(Math.round(a), Z.ox, Z.oy, Z.ox, Z.oy, 2 ** a); }, e.ctrlKey ? 140 : 200);
    }, { passive: false });
    function fit(minLat, minLon, maxLat, maxLon, pad = 40) {
      const w = el.clientWidth || 340, h = el.clientHeight || 300;
      let z = MAXZ;
      for (; z > MINZ; z--) {
        if (lngX(maxLon, z) - lngX(minLon, z) <= w - pad && latY(minLat, z) - latY(maxLat, z) <= h - pad) break;
      }
      R.z = z;
      R.cx = (lngX(minLon, z) + lngX(maxLon, z)) / 2;
      R.cy = (latY(minLat, z) + latY(maxLat, z)) / 2;
      clearTiles(); draw(); stationsSoon();
    }
    function fitPolygon(poly, place) {
      const pts = poly[0].slice();
      if (place) pts.push([place.lon, place.lat]);
      const lats = pts.map((p) => p[1]), lons = pts.map((p) => p[0]);
      fit(Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons), 60);
    }

    /* ── a tapped point (§10.3) ──
       Its weather now and its name, and "forecast here", which makes it the
       place. The point is the visitor's own tap, rounded to two decimals like
       any place, and kept nowhere unless they choose it. */
    const pinEl = $("#radarpin");
    function placePin() {
      if (!R.pin) { pinEl.hidden = true; return; }
      const w = el.clientWidth, h = el.clientHeight;
      const x = lngX(R.pin.lon, R.z) - (R.cx - w / 2), y = latY(R.pin.lat, R.z) - (R.cy - h / 2);
      pinEl.hidden = x < 0 || y < 0 || x > w || y > h;
      pinEl.style.left = Math.min(w - 120, Math.max(120, x)) + "px";
      /* above the point if it fits, else under it, else along the top edge */
      const ch = pinEl.offsetHeight || 140;
      const where = y - ch - 14 >= 4 ? "above" : y + 14 + ch <= h - 4 ? "below" : "top";
      pinEl.style.top = (where === "top" ? 6 : y) + "px";
      pinEl.style.transform = where === "above" ? "translate(-50%,calc(-100% - 14px))" : where === "below" ? "translate(-50%,14px)" : "translate(-50%,0)";
    }
    async function inspect(lat, lon) {
      const pin = R.pin = { lat: Wx.round2(lat), lon: Wx.round2(((lon + 540) % 360) - 180) };
      const ro = PRO ? readoutAt(lat, lon) : null, roHtml = ro ? `<p class="ps ro">${esc(ro)}</p>` : "";
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button><div class="pn">This point</div>${roHtml}<p class="ps">Asking…</p>`;
      draw();
      const [now, pt] = await Promise.all([
        Wx.several([pin]).then((l) => l[0]).catch(() => null),
        Wx.point(pin.lat, pin.lon).catch(() => null)
      ]);
      if (R.pin !== pin) return;
      pin.name = pt && pt.city ? "Near " + pt.city : "This point";
      const c = now && Wx.condition(now.code);
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button><div class="pn">${esc(pin.name)}</div>${roHtml}
        ${now && now.temp != null ? `<div class="ph">${icon(c.kind, now.isDay)}<span class="pt num">${Wx.fmt.temp(now.temp, U())}°</span><span class="ps">${esc(c.text)}${now.hi != null ? `<br>H ${Wx.fmt.temp(now.hi, U())}° L ${Wx.fmt.temp(now.lo, U())}°` : ""}</span></div>` : `<p class="ps">The forecast service did not answer for this point.</p>`}
        <button type="button" class="pgo" data-pingo>Forecast here</button>${PRO ? `<button type="button" class="pgo alt" data-pinsky>Sounding here</button>` : ""}${PRO && R.mode === "model" ? `<button type="button" class="pgo alt" data-pinchart>Chart this field here, hour by hour</button>` : ""}`;
      placePin();                                        // it grew: place it again
    }
    /* a station's own reading, every field it sent, and its raw METAR */
    function showStation(s) {
      R.pin = { lat: s.lat, lon: s.lon, name: s.name ? titleCase(s.name) : s.id };
      const u = Wx.UNITS[U()], k = clk();
      const row = (l, v) => v == null || v === "" ? "" : `<span>${l}</span><b class="num">${v}</b>`;
      const feels = s.temp != null && s.rh != null ? Wx.feelsLike(s.temp, s.rh, s.wind || 0) : null;
      const wind = s.wind == null ? null : Wx.isCalm(s.wind) ? "calm" : `${Wx.compass(s.windDir)} ${Wx.fmt.wind(s.wind, U())} ${u.wind}`;
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button>
        <div class="pn">${esc(R.pin.name)} · ${esc(s.id)}</div>
        <div class="ps">${esc((Wx.NET_KINDS || {})[s.net] || "Airport station")}${s.network ? ` (${esc(s.network.replace(/_/g, " "))})` : ""} · observed ${s.past ? esc(dayFmt(s.time) + " ") : ""}${esc(k.time(s.time))} (<span data-age="${s.time}">${Wx.age(Date.now() - s.time)}</span> ago)</div>
        ${s.temp != null ? `<div class="ph"><span class="pt num">${Wx.fmt.temp(s.temp, U())}°</span><span class="ps">${esc(s.wx || s.sky || "")}</span></div>` : ""}
        <div class="prows">
          ${row("Feels like", feels != null && Math.round(feels) !== Math.round(s.temp) ? deg(feels) : null)}
          ${row("Dew point", s.dew != null ? deg(s.dew) : null)}
          ${row("Humidity", s.rh != null ? Math.round(s.rh) + "%" : null)}
          ${row("Wind", wind)}
          ${row("Gusts", s.gust != null ? `${Wx.fmt.wind(s.gust, U())} ${u.wind}` : null)}
          ${row("Visibility", s.vis != null ? `${Wx.fmt.dist(s.vis, U())} ${u.dist}` : null)}
          ${row("Pressure", s.pressure != null ? `${Wx.fmt.pressure(s.pressure, U())} ${u.pressure}` : null)}
          ${row("Rain, last hour", s.precipHour ? `${Wx.fmt.precip(s.precipHour, U())} ${u.precip}` : null)}
        </div>
        ${s.raw ? `<details><summary>The station's own report (METAR)</summary><code>${esc(s.raw)}</code></details>` : ""}
        <button type="button" class="pgo" data-pingo>Forecast here</button>`;
      draw();
    }
    const titleCase = (t) => t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
    /* a storm cell, as the radar's own table describes it */
    function showCell(c) {
      R.pin = { lat: c.lat, lon: c.lon, name: `Cell ${c.id}` };
      const k = clk(), row = (l, v) => v == null || v === "" ? "" : `<span>${l}</span><b class="num">${v}</b>`;
      const to = c.from != null ? (c.from + 180) % 360 : null;
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button>
        <div class="pn">Storm cell ${esc(c.id)} · ${esc(c.site)} radar</div>
        <div class="ps">Scanned ${esc(k.time(c.time))} (<span data-age="${c.time}">${Wx.age(Date.now() - c.time)}</span> ago)</div>
        <div class="prows">
          ${row("Moving", c.kt > 2 && to != null ? `${Wx.compass(to)} at ${Wx.fmt.wind(c.kt * 1.852, U())} ${Wx.UNITS[U()].wind}` : "nearly still")}
          ${row("Strongest echo", c.dbz != null ? `${c.dbz} dBZ${c.dbzKft != null ? ` at ${c.dbzKft} kft` : ""}` : null)}
          ${row("Echo top", c.topKft != null ? `${c.topKft} kft` : null)}
          ${row("VIL", c.vil != null ? `${c.vil} kg/m²` : null)}
          ${row("Hail", c.poh != null ? `${c.poh}% any, ${c.posh ?? 0}% severe${c.hailIn ? `, up to ${c.hailIn} in` : ""}` : null)}
          ${row("Rotation", c.tvs ? `tornadic vortex (${esc(c.tvs)})` : c.meso ? `mesocyclone, strength ${esc(c.meso)}` : "none detected")}
          ${ltgRows(c, row)}
        </div>
        <p class="ps" style="margin-top:6px">From the radar's own storm-tracking table${ltgOn() ? " and GOES's lightning mapper" : ""} — what they measured, not a warning.</p>`;
      draw(); placePin();
    }
    /* the cell's lightning: flashes a minute within 15 km, 2-minute steps,
       and the lightning jump (glm.js) — only when a lightning layer is on */
    function ltgRows(c, row) {
      if (!ltgOn()) return "";
      if (!LTG.at) return row("Lightning", "loading…");
      const cl = cellLightning(c);
      if (!cl || !cl.j) return row("Flash rate", "reading 14 minutes of flashes…");
      const r = cl.rates, fmt = (x) => x >= 10 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ""), j = cl.j;
      const trend = r.slice(-4).map(fmt).join(" → ");
      return row("Flash rate", `${fmt(j.rate)} a minute, within 15 km`)
        + row("Last 8 minutes", `${trend} a minute`)
        + row("Lightning jump", j.jump ? `yes — rising ${j.level.toFixed(1)}× faster than its usual swing` : j.rate < 10 ? "no (under 10 a minute)" : "no")
        + (j.jump ? `<span class="pfull">A sudden rise in flashes often comes before hail, damaging wind or a tornado, by about 20 minutes (Schultz et al., the 2σ method). An indicator — not a warning.</span>` : "");
    }
    /* a local storm report, as the office issued it */
    function showReport(r) {
      R.pin = { lat: r.lat, lon: r.lon, name: titleCase(r.text) };
      const k = clk(), row = (l, v) => v == null || v === "" ? "" : `<span>${l}</span><b>${v}</b>`;
      const unit = /^mph$/i.test(r.unit) ? "mph" : /^inch$/i.test(r.unit) ? "in" : /^knots?$/i.test(r.unit) ? "kt" : r.unit.toLowerCase();
      const mag = r.mag != null ? `${r.mag} ${esc(unit)}${r.qualifier ? ` (${r.qualifier})` : ""}` : null;
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button>
        <div class="pn">${esc(titleCase(r.text))}${r.severe ? " · severe" : ""}</div>
        <div class="ps">${esc(k.time(r.time))} (<span data-age="${r.time}">${Wx.age(Date.now() - r.time)}</span> ago) · ${esc(r.city)}${r.county ? `, ${esc(r.county)} Co.` : ""}${r.state ? ` ${esc(r.state)}` : ""}</div>
        <div class="prows">
          ${row("Size or amount", mag)}
          ${row("Reported by", esc(r.source))}
          ${row("NWS office", esc(r.wfo))}
        </div>
        ${r.remark ? `<p class="ps" style="margin-top:6px">“${esc(r.remark)}”</p>` : ""}
        <p class="ps" style="margin-top:6px">A report to the National Weather Service, as the office issued it — not a verified survey.</p>`;
      draw(); placePin();
    }
    /* a watch or a discussion, as SPC or WPC issued it */
    function showArea(a) {
      const k = clk();
      const c0 = a.polys[0][0], n = c0.length - 1 || 1;
      R.pin = { lat: c0.slice(0, n).reduce((s, q) => s + q[1], 0) / n, lon: c0.slice(0, n).reduce((s, q) => s + q[0], 0) / n, name: a.title };
      pinEl.innerHTML = `<button type="button" class="px" data-pinx aria-label="Close">×</button>
        <div class="pn">${esc(a.title)}</div>
        <div class="ps">${a.issued ? `Issued ${esc(k.time(a.issued))}` : ""}${a.expires ? ` · until ${esc(k.time(a.expires))}` : ""}</div>
        <div class="prows">
          ${a.concerning ? `<span>Concerning</span><b>${esc(titleCase(a.concerning))}</b>` : ""}
          ${a.chance != null ? `<span>Chance of a watch</span><b class="num">${a.chance}%</b>` : ""}
        </div>
        <a class="pgo" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${esc(a.url)}" target="_blank" rel="noopener">Read it at ${a.kind === "mpd" ? "WPC" : "SPC"} ↗</a>
        <p class="ps" style="margin-top:6px">${a.kind === "mpd" ? "The Weather Prediction Center" : "The Storm Prediction Center"} issues these; this page only draws them.</p>`;
      draw(); placePin();
    }
    /* the ruler: tap points, read each leg and the whole */
    function measureTap(lat, lon) {
      R.measure.pts.push({ lat, lon: ((lon + 540) % 360) - 180 });
      const P = R.measure.pts;
      let km = 0;
      for (let i = 1; i < P.length; i++) km += Wx.distanceM(P[i - 1].lat, P[i - 1].lon, P[i].lat, P[i].lon) / 1000;
      if (P.length > 1) {
        const a = P[P.length - 2], b = P[P.length - 1];
        const y = Math.sin((b.lon - a.lon) * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180);
        const x = Math.cos(a.lat * Math.PI / 180) * Math.sin(b.lat * Math.PI / 180) - Math.sin(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.cos((b.lon - a.lon) * Math.PI / 180);
        const brg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        note(`Ruler: ${dist(km)} in all · last leg toward ${Math.round(brg)}° (${Wx.compass(brg)}). Tap to add a point; the ruler button finishes.`);
      } else note("Ruler: tap the next point.");
      draw();
    }
    function measureToggle() {
      R.measure = R.measure ? null : { pts: [] };
      $("#zmeasure").setAttribute("aria-pressed", String(!!R.measure));
      note(R.measure ? "Ruler: tap where it starts." : "");
      if (R.measure) { R.pin = null; if (X.pick || X.a) xsecStop(); }
      draw();
    }
    /* a link to this view: the map's middle (to about 10 km), its zoom, the
       layer, the satellite and the overlays — never the visitor's own place */
    /* the layers, in the link's words (no place in them) — a workstation
       panel and a saved workspace are written in the same words */
    function layerString() {
      const ov = [!R.ov.lines && "x", R.ov.watches && "w", R.ov.cells && "c", R.ov.fronts && "f", R.stations && "s", R.outlook && "o", R.ov.lightning && "l", R.ov.density && "d", R.ov.reports && "r", R.ov.rings && "g", R.ov.tropics && "h", R.ov.terrain && "e"].filter(Boolean).join("");
      return `l=${encodeURIComponent(R.mode === "replay" ? "comp" : R.mode)}&s=${encodeURIComponent(R.sat || "")}&o=${ov}${l3() ? (useL2() ? `&a=${R.l2angle}` : `&t=${R.tilt}`) : ""}${R.mode === "model" ? `&m=${R.mm.src}.${R.mm.field}${R.mm.pin ? "." + new Date(R.mm.pin).toISOString().replace(/\D/g, "").slice(0, 10) : R.mm.back ? "." + R.mm.back : ""}` : ""}${R.mode === "model" && R.mm.diff ? `&d=${R.mm.diff}` : ""}${R.mode === "mrms" ? `&r=${R.mr.prod}` : ""}${R.mode === "abi" ? `&g=${R.ab.prod}.${R.ab.sector}.${R.ab.sat}` : ""}${single() && R.lockId ? `&k=${R.lockId}` : ""}`;
    }
    /* the map's middle to about 10 km, and its zoom */
    function viewString() {
      const lat = yLat(R.cy, R.z), lon = xLng(R.cx, R.z);
      return `${lat.toFixed(1)},${(((lon + 540) % 360) - 180).toFixed(1)},${R.z}`;
    }
    function shareLink() {
      const url = `${location.origin}${location.pathname}#v=${viewString()}&${layerString()}`;
      const done = () => note("Link copied — it opens this map view and these layers. Your saved place is not in it.");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => note(`Copy this link: ${url}`));
      else note(`Copy this link: ${url}`);
    }
    /* opening such a link */
    function applyLink(str = location.hash) {
      const h = String(str).replace(/^#/, "");
      if (!h) return false;
      const q = new URLSearchParams(h), v = (q.get("v") || "").split(",").map(Number);
      if (v.length === 3 && Wx.validLat(v[0]) && Wx.validLon(v[1]) && v[2] >= MINZ && v[2] <= MAXZ) {
        R.z = Math.round(v[2]); R.cx = lngX(v[1], R.z); R.cy = latY(v[0], R.z);
      }
      const o = q.get("o");
      if (o != null) {
        R.ov = { lines: !o.includes("x"), watches: o.includes("w"), cells: o.includes("c"), fronts: o.includes("f"), lightning: o.includes("l"), density: o.includes("d"), reports: o.includes("r"), rings: o.includes("g"), tropics: o.includes("h"), terrain: o.includes("e") };
        R.stations = o.includes("s"); R.outlook = o.includes("o");
        $("#stationtoggle").setAttribute("aria-pressed", String(R.stations));
        $("#outlooktoggle").setAttribute("aria-pressed", String(R.outlook));
        document.querySelectorAll("[data-ov]").forEach((b) => b.setAttribute("aria-pressed", String(!!R.ov[b.dataset.ov])));
      }
      /* `s=` (none) is a choice too: a panel or a workspace without a satellite has none */
      if (Wx.SAT[q.get("s")]) setSat(q.get("s"));
      else if (q.has("s") && q.get("s") === "" && R.sat) setSat("");
      const t = Number(q.get("t")), a = q.get("a");
      if (q.get("t") != null && t >= 0 && t <= 3) { R.tilt = Math.round(t); R.l2 = false; }
      if (a != null && Number.isFinite(Number(a)) && Math.abs(Number(a)) < 30) { R.l2 = true; R.l2angle = Number(a); }
      const [ms, mf, mb] = (q.get("m") || "").split(".");
      if (MM && MM.field(ms, mf)) {
        R.mm.src = ms; R.mm.field = mf; R.mm.back = /^[1-3]$/.test(mb || "") ? Number(mb) : 0;
        /* a picked run travels as its own time, YYYYMMDDHH */
        const pm = /^(\d{4})(\d\d)(\d\d)(\d\d)$/.exec(mb || ""), pin = pm ? Date.UTC(+pm[1], +pm[2] - 1, +pm[3], +pm[4]) : NaN;
        R.mm.pin = Number.isFinite(pin) && pin <= Date.now() ? pin : null;
        const d = q.get("d") || "";
        R.mm.diff = d === "prev" || (MM.SOURCES[d] && MM.field(d, mf)) ? d : "";
        runOptions(); diffOptions();
      }
      if (MR && MR.PRODUCTS[q.get("r")]) R.mr.prod = q.get("r");
      const [gp, gs, gsat] = (q.get("g") || "").split(".");
      if (AB && AB.PRODUCTS[gp] && AB.SECTORS[gs] && ["auto", "east", "west"].includes(gsat)) R.ab = { prod: gp, sector: gs, sat: gsat };
      if (/^[A-Z]{3}$/.test(q.get("k") || "")) R.lockId = q.get("k");   // IEM's ids: TLX, not KTLX
      const l = q.get("l");
      return ["N0B", "N0S", "hrrr"].includes(l) || l3(l) || (l === "model" && MM) || (l === "mrms" && MR) || (l === "abi" && AB) ? l : true;
    }
    pinEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-pinx]")) { R.pin = null; draw(); }
      /* in a workstation panel, a point's forecast or sounding opens on the main page */
      else if (PANEL && e.target.closest("[data-pinsky],[data-pingo]") && R.pin) { const p = R.pin; R.pin = null; draw(); tell("pick", { lat: p.lat, lon: p.lon, name: p.name || "", what: e.target.closest("[data-pinsky]") ? "sky" : "forecast" }); }
      else if (e.target.closest("[data-pinsky]") && R.pin) { const p = R.pin; R.pin = null; draw(); sky.at(p.lat, p.lon, p.name || "the tapped point"); }
      else if (e.target.closest("[data-pinchart]") && R.pin) { const p = R.pin; R.pin = null; draw(); chartAt(p.lat, p.lon, p.name); chartEl.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); }
      else if (e.target.closest("[data-pingo]") && R.pin) {
        const p = R.pin; R.pin = null; full(false);
        choose({ name: p.name || "Map point", region: "", lat: p.lat, lon: p.lon });
      }
    });

    /* ── Go to a place, on the view that suits it (UI-REVIEW-2 items 3 and 4,
       2026-10-24): fit a box or centre a point, put the overlay that drew it
       on, and switch to a single radar's product when one is named — the
       nearest radar to where the map now is, never one kept from before. ── */
    async function goTo({ box, point, mode, overlay }) {
      if (box) fit(box[0], box[1], box[2], box[3], 70);
      else if (point) { R.z = Math.max(R.z, 8); R.cx = lngX(point.lon, R.z); R.cy = latY(point.lat, R.z); clearTiles(); draw(); stationsSoon(); }
      if (overlay && R.ov[overlay] === false) { const b = document.querySelector(`[data-ov="${overlay}"]`); if (b) b.click(); }
      if (mode && l3(mode)) {
        R.lockId = null;
        if (R.mode === mode) { if (await pickSite(false)) { clearTiles(); await siteFrames(); label(); } }
        else await setMode(mode);
      }
    }

    /* ── Active (item 3): the country's storms, one click each. Asked when
       opened (and kept a minute and a half); the button counts tornado and
       severe thunderstorm warnings, asked every three minutes in view. ── */
    const ACT = { at: 0, data: null, items: [], sel: 0 };
    async function activeData(force) {
      if (!force && ACT.data && Date.now() - ACT.at < 90e3) return ACT.data;
      const P = R.pro, soft = (p, d) => Promise.resolve(p).catch(() => d);
      const [warns, watches, mcds, mpds, cells] = await Promise.all([
        !S.place && Array.isArray(S.national) ? S.national : soft(Wx.national(), []),
        soft(Wx.proOverlays.watches(), P.watches), soft(Wx.proOverlays.mcds(), P.mcds), soft(Wx.proOverlays.mpds(), P.mpds), soft(Wx.proOverlays.cells(), P.cells)]);
      ACT.data = { warns: warns || [], watches: watches || [], mcds: mcds || [], mpds: mpds || [], cells: cells || [] };
      ACT.at = Date.now();
      actCount();
      return ACT.data;
    }
    function actCount() {
      const c = $("#actcount");
      if (!c || !ACT.data) return;
      const n = ACT.data.warns.filter((a) => a.polygon && (a.event === "Tornado Warning" || a.event === "Severe Thunderstorm Warning")).length;
      c.textContent = n ? String(n) : "";
    }
    function actRender() {
      const ul = $("#actlist"), lead = $("#actlead");
      if (!ul) return;
      const k = clk(), L = ACT.items;
      const n = (kind) => L.filter((x) => x.kind === kind).length;
      lead.textContent = !L.length ? "Nothing active across the US right now — no storm warnings, discussions, watches or strong storms."
        : [n("warning") && `${n("warning")} storm warning${n("warning") === 1 ? "" : "s"}`, n("md") && `${n("md")} SPC discussion${n("md") === 1 ? "" : "s"}`, n("watch") && `${n("watch")} watch${n("watch") === 1 ? "" : "es"}`, n("mpd") && `${n("mpd")} WPC discussion${n("mpd") === 1 ? "" : "s"}`, n("cell") && `${n("cell")} strong storm${n("cell") === 1 ? "" : "s"}`].filter(Boolean).join(" · ") + " — as the NWS, SPC and WPC issued them.";
      /* how to choose is said only when there is something to choose */
      const how = $("#activeit .findhint"); if (how) how.hidden = !L.length;
      ul.innerHTML = L.map((x, i) => `<li role="option" data-i="${i}" aria-selected="${i === ACT.sel}"><i class="actsw" style="background:${x.color}" aria-hidden="true"></i><span>${esc(x.title)}${x.chance != null ? ` · ${x.chance}% chance of a watch` : ""}<small>${esc([x.area, x.ends ? "until " + k.time(x.ends) : ""].filter(Boolean).join(" · "))}</small></span><em>${x.mode === "l3:srv" ? "SRV" : x.mode === "l3:ref" ? "radar" : ""}</em></li>`).join("");
    }
    async function openActive() {
      const d = $("#activeit");
      if (!d) return;
      ACT.sel = 0;
      if (d.showModal && !d.open) d.showModal();
      if (!ACT.data) { $("#actlead").textContent = "Asking the NWS, SPC and WPC…"; $("#actlist").innerHTML = ""; }
      else { ACT.items = Wx.activeList(ACT.data); actRender(); }
      try { ACT.items = Wx.activeList(await activeData(false)); } catch (e) { $("#actlead").textContent = "The NWS, SPC or WPC did not answer — try again in a minute."; return; }
      actRender();
    }
    function actGo(i) {
      const x = ACT.items[i];
      if (!x) return;
      const d = $("#activeit"); if (d && d.close) d.close();
      goTo({ box: x.box, point: x.point, mode: x.mode, overlay: x.overlay });
    }
    if (PRO && !PANEL && $("#actbtn")) {
      $("#actbtn").addEventListener("click", openActive);
      $("#actlist").addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) actGo(Number(li.dataset.i)); });
      $("#activeit").addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); ACT.sel = Math.max(0, Math.min(ACT.items.length - 1, ACT.sel + (e.key === "ArrowDown" ? 1 : -1))); actRender(); const li = $(`#actlist li[data-i="${ACT.sel}"]`); if (li) li.scrollIntoView({ block: "nearest" }); }
        else if (e.key === "Enter") { e.preventDefault(); actGo(ACT.sel); }
      });
      addEventListener("keydown", (e) => {
        const t = e.target;
        if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) || document.querySelector("dialog[open]")) return;
        if (e.key === "a" || e.key === "A") { e.preventDefault(); openActive(); }
      });
      /* the count on the button, kept fresh while the page is in view */
      const tick = () => { if (!document.hidden) activeData(true).catch(() => {}); };
      setTimeout(tick, 4000); setInterval(tick, 180e3);
    } else if ($("#actbtn")) $("#actbtn").hidden = true;

    /* ── A first-visit hint (UI-REVIEW-3 item 3): one line, once, along the
       foot of the map, saying what the map can do that nothing else on the
       page shows. × puts it away for good; so does a minute on screen. ── */
    if (PRO && !PANEL && !store.get("wx:hintseen", false)) {
      const hint = document.createElement("p");
      hint.className = "maphint"; hint.setAttribute("role", "note");
      hint.innerHTML = matchMedia("(pointer:coarse)").matches
        ? `<span>Pinch to zoom · press and hold the map for its menu · <b>Active</b> lists the country's storms</span><button type="button" aria-label="Got it">×</button>`
        : `<span>Wheel or pinch to zoom toward the pointer · right-click the map for its menu · <kbd>A</kbd> active weather · <kbd>?</kbd> every key</span><button type="button" aria-label="Got it">×</button>`;
      /* the words are one span: bare text beside <kbd> in a flex row became a column per run, one word a line on a phone */
      el.appendChild(hint);
      const seen = () => { store.set("wx:hintseen", true); hint.remove(); };
      hint.querySelector("button").addEventListener("click", seen);
      setTimeout(() => { if (hint.isConnected) { hint.classList.add("going"); setTimeout(seen, 600); } }, 60e3);
    }

    /* ── The map's own menu (item 4): right-click, or a long press on a
       touch screen. Every action is one the map already has, at the point
       pressed; the point is only the visitor's own pointer and is kept
       nowhere. ── */
    const menu = document.createElement("div");
    menu.className = "mapmenu"; menu.setAttribute("role", "menu"); menu.hidden = true;
    el.appendChild(menu);
    let MENU = null;
    function menuClose() { if (!menu.hidden) { menu.hidden = true; MENU = null; } }
    function menuOpen(px, py) {
      if (!PRO) return;
      const lat = yLat(R.cy - el.clientHeight / 2 + py, R.z), lon = xLng(R.cx - el.clientWidth / 2 + px, R.z);
      if (!Wx.validLat(lat) || !Wx.validLon(lon)) return;
      MENU = { lat, lon };
      const ll = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
      menu.innerHTML = `<p class="mmhead num">${ll}</p>
        <button type="button" role="menuitem" data-m="l3:ref">Nearest radar here · reflectivity</button>
        <button type="button" role="menuitem" data-m="l3:vel">Nearest radar here · velocity</button>
        <button type="button" role="menuitem" data-m="l3:srv">Nearest radar here · storm-relative</button>
        <hr><button type="button" role="menuitem" data-m="sky">Sounding here</button>
        <button type="button" role="menuitem" data-m="chart">Chart here</button>
        <button type="button" role="menuitem" data-m="xsec">Cross-section from here</button>
        <button type="button" role="menuitem" data-m="forecast">Forecast for here</button>
        <hr><button type="button" role="menuitem" data-m="centre">Centre the map here</button>
        <button type="button" role="menuitem" data-m="copy">Copy the coordinates</button>`;
      menu.hidden = false;
      const mw = menu.offsetWidth || 240, mh = menu.offsetHeight || 300;
      menu.style.left = Math.max(6, Math.min(px, el.clientWidth - mw - 6)) + "px";
      menu.style.top = Math.max(6, Math.min(py, el.clientHeight - mh - 6)) + "px";
      const first = menu.querySelector("button"); if (first) first.focus({ preventScroll: true });
    }
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-m]");
      if (!b || !MENU) return;
      const { lat, lon } = MENU, m = b.dataset.m;
      menuClose();
      if (l3(m)) goTo({ point: { lat, lon }, mode: m });
      else if (m === "sky") { if (PANEL) tell("pick", { lat, lon, name: "", what: "sky" }); else sky.at(lat, lon, "the point picked"); }
      else if (m === "chart") { chartAt(lat, lon, ""); chartEl.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); }
      else if (m === "xsec") { xsecStart(); xsecTap(lat, lon); }
      else if (m === "forecast") { if (PANEL) tell("pick", { lat, lon, name: "", what: "forecast" }); else { full(false); choose({ name: "Map point", region: "", lat, lon }); } }
      else if (m === "centre") { R.cx = lngX(lon, R.z); R.cy = latY(lat, R.z); draw(); stationsSoon(); }
      else if (m === "copy") {
        const txt = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        Promise.resolve(navigator.clipboard && navigator.clipboard.writeText(txt)).then(() => { note(`Copied ${txt}`); setTimeout(() => { if ($("#radarnote").textContent === `Copied ${txt}`) note(""); }, 2500); }).catch(() => note(txt));
      }
    });
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll("button")], i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.preventDefault(); menuClose(); el.focus && el.focus(); }
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]; if (n) n.focus(); }
    });
    if (PRO) {
      el.addEventListener("contextmenu", (e) => {
        if (e.target.closest("button,a,.pin,.mapmenu,.maplegend,.mapctl,.zoom")) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        menuOpen(e.clientX - r.left, e.clientY - r.top);
      });
      document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target)) menuClose(); }, true);
      el.addEventListener("wheel", menuClose, { passive: true });
    }

    /* the whole window as the map, and back — the button or Esc */
    function full(on) {
      const card = $("#radarcard");
      if (card.classList.contains("mapfull") === on) return;
      card.classList.toggle("mapfull", on);
      document.body.classList.toggle("mapopen", on);
      $("#zfull").setAttribute("aria-pressed", String(on));
      $("#zfull").setAttribute("aria-label", on ? "Leave the full-screen map" : "Full-screen map");
      if (on) start();
      requestAnimationFrame(draw);
      if (!PRO) { citiesSoon(); if (R.mode === "comp") ncSoon(); }
    }
    $("#zfull").addEventListener("click", () => full(!$("#radarcard").classList.contains("mapfull")));
    if ($("#mapclose")) $("#mapclose").addEventListener("click", () => full(false));
    /* Weather's layers menu, Apple's way: rain always, the rest ticked on or off */
    if (R.wl && $("#wxlayersbtn")) {
      const btn = $("#wxlayersbtn"), menu = $("#wxmenu");
      const apply = () => {
        R.outlook = !!R.wl.outlook;
        if (R.wl.temps) citiesSoon(); else CITY.list = [];
        if ((R.sat === "ir") !== !!R.wl.clouds) setSat(R.wl.clouds ? "ir" : "");
        menu.querySelectorAll("[data-wl]").forEach((b) => b.setAttribute("aria-checked", String(!!R.wl[b.dataset.wl])));
        btn.classList.toggle("some", ["outlook", "clouds"].some((k) => R.wl[k]));
        draw(); label();
      };
      const open = (on) => { menu.hidden = !on; btn.setAttribute("aria-expanded", String(on)); };
      btn.addEventListener("click", () => open(menu.hidden));
      menu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-wl]");
        if (!b) return;
        R.wl[b.dataset.wl] = !R.wl[b.dataset.wl];
        store.set("wx:maplayers", R.wl);
        apply();
      });
      document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest("#wxmenu,#wxlayersbtn")) open(false); });
      addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { open(false); btn.focus(); } });
      R.wlApply = apply;
    }
    $("#zxsec").addEventListener("click", () => { if (R.measure) measureToggle(); if (X.pick || X.a) xsecStop(); else xsecStart(); });
    if ($("#zmeasure")) $("#zmeasure").addEventListener("click", measureToggle);
    if ($("#zlink")) $("#zlink").addEventListener("click", shareLink);
    document.querySelectorAll("[data-ov]").forEach((b) => {
      b.setAttribute("aria-pressed", String(!!R.ov[b.dataset.ov]));
      b.addEventListener("click", () => {
        R.ov[b.dataset.ov] = !R.ov[b.dataset.ov];
        store.set("wx:ov", R.ov);
        b.setAttribute("aria-pressed", String(R.ov[b.dataset.ov]));
        if (b.dataset.ov === "lightning" || b.dataset.ov === "density") { lightningClock(); if ($("#awscredit")) $("#awscredit").hidden = !(l3() || R.mode === "model" || R.mode === "mrms" || R.mode === "abi" || ltgOn()); }
        loadOverlays(true); draw(); label(); renderSources();
      });
    });
    addEventListener("keydown", (e) => { if (e.key === "Escape") full(false); });
    if ($("#sitesel")) $("#sitesel").addEventListener("change", (e) => { e.target.blur(); keepSite(e.target.value); });
    /* keep one radar (an id), or follow the map again ("") */
    async function keepSite(id) {
      const prev = R.site && R.site.id;
      R.lockId = id || null;
      if (id) { const s = (R.sites || []).find((x) => x.id === id); if (s) R.site = s; }
      else await pickSite(true);
      siteOptions();
      if (single() && R.site && R.site.id !== prev) { play(false); R.valid = null; clearTiles(); await siteFrames(); }
      label(); renderSources(); draw();
    }
    /* Pro's keys, for a desk (2026-10-23): the loop, the zoom and the
       products reached for most, without the mouse. A key typed into a field,
       one with a modifier, or one pressed while a sheet is open is left alone;
       `?` lists them (the #keys sheet, which must say the same as KEYMODES). */
    /* a key's answer, said for a moment and then gone (never over a real note) */
    const flash = (text) => { const n = $("#radarnote"); if (n.textContent && !n.dataset.flash) return; note(text); n.dataset.flash = "1"; clearTimeout(flash.t); flash.t = setTimeout(() => { if (n.dataset.flash) { delete n.dataset.flash; note(""); } }, 1500); };
    const KEYMODES = { m: "comp", g: "abi", r: "l3:ref", v: "l3:vel", s: "l3:srv", c: "l3:cc", z: "l3:zdr", k: "l3:kdp", h: "l3:hca", e: "l3:eet" };
    if (PRO) addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target, k = e.key;
      if (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      const press = (b) => { if (!b) return false; b.click(); return true; };
      let done;
      /* shift and an arrow moves the map a third of the way (UI-REVIEW-3 item 4); the arrows alone still step frames */
      if (e.shiftKey && /^Arrow(Left|Right|Up|Down)$/.test(k)) {
        const w = el.clientWidth, h = el.clientHeight;
        R.cx += k === "ArrowLeft" ? -w / 3 : k === "ArrowRight" ? w / 3 : 0;
        R.cy += k === "ArrowUp" ? -h / 3 : k === "ArrowDown" ? h / 3 : 0;
        draw(); stationsSoon();
        if (single() && !R.lockId) { clearTimeout(follow); follow = setTimeout(async () => { if (await pickSite(false)) { clearTiles(); await siteFrames(); label(); } }, 700); }
        done = true;
      } else if (k === " ") {
        if (t && t.closest && t.closest("button,a,summary")) return;   // Space on a button presses it
        start(); play(!R.playing); done = true;
      } else if (k === "ArrowLeft" || k === "ArrowRight") {
        if (!R.frames.length) return;
        play(false); loadOld();
        const n = R.frames.length;
        userShow((R.frame + (k === "ArrowLeft" ? -1 : 1) + n) % n); done = true;
      } else if (k === "+" || k === "=") { zoomTo(R.z + 1); done = true; }
      else if (k === "-" || k === "_") { zoomTo(R.z - 1); done = true; }
      else if (k === "f" || k === "F") { full(!$("#radarcard").classList.contains("mapfull")); done = true; }
      else if (KEYMODES[k.toLowerCase()]) done = press(document.querySelector(`.seg [data-mode="${KEYMODES[k.toLowerCase()]}"]`));
      else if (k === "l" || k === "L") done = press(document.querySelector('[data-ov="lightning"]'));
      else if (k === "w" || k === "W") done = press(document.querySelector('[data-ov="watches"]'));
      else if (/^[1-9]$/.test(k)) done = !$("#tiltrow").hidden && press(document.querySelectorAll("#tiltbtns [data-tilt], #tiltbtns [data-angle]")[Number(k) - 1]);
      else if (k === "?") { const d = $("#keys"); if (d && d.showModal) { d.showModal(); done = true; } }
      /* 2026-10-23: the newest frame, UTC, the loop's speed, the data's opacity, range rings */
      else if (k === "n" || k === "N" || k === "End") { if (R.frames.length) { play(false); userShow(R.frames.length - 1); done = true; } }
      else if (k === "u" || k === "U") done = press($("#utcbtn"));
      else if (k === "[" || k === "]") { const sp = [0.5, 1, 2, 3], i = sp.indexOf(LOOP.speed); setLoop("speed", sp[Math.max(0, Math.min(sp.length - 1, (i < 0 ? 1 : i) + (k === "]" ? 1 : -1)))]); flash(`Loop speed ${LOOP.speed}×`); done = true; }
      else if (k === "o" || k === "O") { setOpacity(OPAC > 0.85 ? 0.7 : OPAC > 0.55 ? 0.4 : 1); flash(`Data opacity ${Math.round(OPAC * 100)}%`); done = true; }
      else if (k === "y" || k === "Y") done = press(document.querySelector('[data-ov="rings"]'));
      if (done) e.preventDefault();
    });
    if ($("#keys")) {
      const d = $("#keys");
      $("#keysbtn").addEventListener("click", () => d.showModal());
      $("#closekeys").addEventListener("click", () => d.close());
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });   // a tap on the backdrop
    }

    /* dragging, the site following the map, and a tap that is not a drag */
    let drag = null, follow = 0, tap = 0;
    /* two fingers: a pinch scales and moves the layers live, and settles on the nearest level when one lifts */
    const touches = new Map();
    let pinch = null;
    const pinchGeom = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button,a,.pin,.wxmenu")) return;
      if (e.pointerType === "touch") {
        const r = el.getBoundingClientRect();
        touches.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
        if (touches.size === 2) {
          /* the first finger's drag becomes the pinch: what it moved so far stays */
          if (drag) { drag = null; el.classList.remove("dragging"); }
          clearTimeout(tap); clearTimeout(R.lp); zdropGhost(true);
          const g = pinchGeom(); pinch = { d0: g.d, x0: g.x, y0: g.y, s: 1, x: g.x, y: g.y };
          el.setPointerCapture(e.pointerId);
          return;
        }
        if (pinch) return;
      }
      zdropGhost(true);
      drag = { x: e.clientX, y: e.clientY, cx: R.cx, cy: R.cy, t: Date.now() };
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.classList.add("dragging");
      /* a long press on a touch screen opens the map's own menu (the right-click of a phone) */
      clearTimeout(R.lp);
      if (PRO && e.pointerType === "touch") { const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; R.lp = setTimeout(() => { if (drag && !pinch && Math.hypot(drag.x - e.clientX, drag.y - e.clientY) < 1) { drag = null; el.classList.remove("dragging"); clearTimeout(tap); R.lpFired = true; menuOpen(x, y); } }, 550); }
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" && touches.has(e.pointerId)) {
        const r = el.getBoundingClientRect();
        touches.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
        if (pinch && touches.size >= 2) {
          const g = pinchGeom(), lo = 2 ** (MINZ - R.z - 0.35), hi = 2 ** (MAXZ - R.z + 0.35);
          pinch.s = Math.min(hi, Math.max(lo, g.d / pinch.d0)); pinch.x = g.x; pinch.y = g.y;
          zsetTransform(pinch.s, pinch.x0, pinch.y0, pinch.x - pinch.x0, pinch.y - pinch.y0);
          return;
        }
      }
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) clearTimeout(R.lp);
      R.cx = drag.cx - (e.clientX - drag.x); R.cy = drag.cy - (e.clientY - drag.y);
      requestAnimationFrame(draw);
    });
    const pinchEnd = (e) => {
      if (e.pointerType !== "touch") return false;
      touches.delete(e.pointerId);
      if (!pinch) return false;
      if (touches.size < 2) {
        const p = pinch; pinch = null;
        zcommit(Math.round(Math.log2(p.s)), p.x0, p.y0, p.x, p.y, p.s);
      }
      return true;
    };
    el.addEventListener("pointerup", (e) => { if (pinchEnd(e)) e.stopImmediatePropagation(); }, true);
    el.addEventListener("pointercancel", (e) => { if (pinchEnd(e)) e.stopImmediatePropagation(); }, true);
    const end = (e) => {
      clearTimeout(R.lp);
      if (R.lpFired) { R.lpFired = false; return; }
      if (!drag) return;
      const d = drag;
      drag = null; el.classList.remove("dragging");
      if (e.type === "pointerup" && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && Date.now() - d.t < 450) {
        /* wait out a double tap, which zooms instead */
        const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        clearTimeout(tap);
        if (!PRO && !$("#radarcard").classList.contains("mapfull")) { full(true); return; }
        tap = setTimeout(() => {
          const tlat = yLat(R.cy - el.clientHeight / 2 + py, R.z), tlon = xLng(R.cx - el.clientWidth / 2 + px, R.z);
          if (X.pick) { xsecTap(tlat, tlon); return; }
          if (R.measure) { measureTap(tlat, tlon); return; }
          const rs = siteNear(px, py);
          if (rs) { keepSite(rs.id); return; }
          const rp = PRO && reportNear(px, py), s = !rp && stationNear(px, py);
          const c = !rp && !s && cellNear(px, py), a = !rp && !s && !c && areaAt(tlat, tlon);
          if (rp) showReport(rp);
          else if (s) showStation(s);
          else if (c) showCell(c);
          else if (a) showArea(a);
          else inspect(yLat(R.cy - el.clientHeight / 2 + py, R.z), xLng(R.cx - el.clientWidth / 2 + px, R.z));
        }, 300);
        return;
      }
      stationsSoon();
      if (single()) {
        clearTimeout(follow);
        follow = setTimeout(async () => { if (await pickSite(false)) { clearTiles(); await siteFrames(); label(); } }, 700);
      }
    };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
    $("#zin").addEventListener("click", () => zoomTo(R.z + 1));
    $("#zout").addEventListener("click", () => zoomTo(R.z - 1));
    /* a double-click zooms toward the point clicked, not the middle (shift: out) */
    el.addEventListener("dblclick", (e) => { if (!e.target.closest("button,a,.pin")) { clearTimeout(tap); const r = el.getBoundingClientRect(); zoomAt(R.z + (e.shiftKey ? -1 : 1), e.clientX - r.left, e.clientY - r.top); } });
    /* the tilt row (built by tilts()): a Level III tilt, a full-volume angle, or the switch between them */
    if ($("#tiltrow")) $("#tiltrow").addEventListener("click", async (e) => {
      const t = e.target.closest("[data-tilt],[data-angle],[data-l2toggle]");
      if (!t || !l3()) return;
      if (t.dataset.tilt != null) { R.tilt = Number(t.dataset.tilt); store.set("wx:tilt", R.tilt); }
      else if (t.dataset.angle != null) { R.l2angle = Number(t.dataset.angle); store.set("wx:l2angle", R.l2angle); }
      else { R.l2 = !R.l2; store.set("wx:l2", R.l2); }
      play(false); R.valid = null; tilts();
      await l3Frames(); label(); renderSources();
    });
    /* the model bar: which model, which field */
    function modelOptions() {
      const sel = $("#mmfield");
      if (!sel || !MM) return;
      const groups = {};
      for (const f of MM.FIELDS[R.mm.src]) (groups[f.group] = groups[f.group] || []).push(f);
      sel.innerHTML = Object.entries(groups).map(([g, fs]) => `<optgroup label="${esc(g)}">${fs.map((f) => `<option value="${f.id}"${f.id === R.mm.field ? " selected" : ""}>${esc(f.label)}</option>`).join("")}</optgroup>`).join("");
      $("#mmsrc").value = R.mm.src;
      diffOptions();
    }
    /* what this field can be differenced against: its run before, and every forecast model with the same field showing the same quantity */
    const DIFF_MODELS = ["hrrr", "nam", "rap", "gfs", "ecmwf", "aifs", "ukmet"];
    function diffOptions() {
      const sel = $("#mmdiff"), M = R.mm, S = MM.SOURCES[M.src], f = MM.field(M.src, M.field);
      if (!sel) return;
      const lbl = $("#mmdiffl"), ok = f && !S.analysis && !S.server && !f.members && !f.member && M.src !== "tle";
      if (lbl) lbl.hidden = !ok;
      const others = ok ? DIFF_MODELS.filter((k) => k !== M.src && MM.SOURCES[k] && MM.field(k, M.field) && MM.field(k, M.field).unit === f.unit) : [];
      sel.innerHTML = `<option value="">None</option>${ok ? `<option value="prev">From the run before</option>` : ""}${others.map((k) => `<option value="${k}">Minus ${esc(MM.SOURCES[k].label)}</option>`).join("")}`;
      if (M.diff && ![...sel.options].some((o) => o.value === M.diff)) M.diff = "";
      sel.value = M.diff;
    }
    if ($("#modelbar") && MM) {
      modelOptions();
      $("#mmsrc").addEventListener("change", (e) => {
        R.mm.src = MM.SOURCES[e.target.value] ? e.target.value : "hrrr";
        if (!MM.field(R.mm.src, R.mm.field)) R.mm.field = MM.FIELDS[R.mm.src][0].id;
        store.set("wx:mmsrc", R.mm.src); store.set("wx:mmfield", R.mm.field);
        R.mm.diff = ""; modelOptions(); R.mm.run = null; R.mm.back = 0; R.mm.pin = null; R.mm.newest = null; runOptions();
        if (R.mode === "model") { play(false); modelFrames().then(label); }
      });
      $("#mmfield").addEventListener("change", (e) => {
        if (!MM.field(R.mm.src, e.target.value)) return;
        R.mm.field = e.target.value; store.set("wx:mmfield", R.mm.field);
        diffOptions();                                            // a field with nothing to difference against drops the choice first
        if (R.mode !== "model" || !R.frames.length) return;
        /* the same run and hours, the new field; the hour on screen stays */
        const at = R.frame;
        play(false);
        setFrames(R.frames.map((f) => ({ t: f.t, model: { src: f.model.src, field: R.mm.field, run: f.model.run, fh: f.model.fh, diff: R.mm.diff } })));
        show(Math.min(at, R.frames.length - 1)); label(); renderSources();
        if (C.on) chartAt(C.lat, C.lon, C.name);
      });
      $("#mmdiff").addEventListener("change", (e) => {
        R.mm.diff = e.target.value;
        if (R.mode !== "model" || !R.frames.length) return;
        const at = R.frame;
        play(false);
        setFrames(R.frames.map((f) => ({ t: f.t, model: { ...f.model, p: null, layer: null, lut: null, err: null, diff: R.mm.diff } })));
        show(Math.min(at, R.frames.length - 1)); label(); renderSources(); modelRunText();
      });
      $("#mmback").addEventListener("change", (e) => {
        const v = Number(e.target.value) || 0;
        R.mm.back = 0; R.mm.pin = v > 0 ? v : null;
        if (R.mode === "model") { play(false); modelFrames().then(label); }
      });
      /* out of a replay's moment, back to the newest run */
      $("#mmrun").addEventListener("click", (e) => {
        if (!e.target.closest("[data-mmnow]")) return;
        R.mm.at = null; R.mm.run = null; R.mm.pin = null;
        if (R.mode === "model") { play(false); modelFrames().then(label); }
      });
    }
    if ($("#denswin")) {
      $("#denswin").value = String(R.densWin);
      $("#densbar").hidden = !(PRO && R.ov.density);
      $("#denswin").addEventListener("change", (e) => { R.densWin = Number(e.target.value); store.set("wx:denswin", R.densWin); LTG.dens = null; drawLightning(); label(); });
    }
    if ($("#abibar") && AB) {
      const groups = {};
      for (const [id, P] of Object.entries(AB.PRODUCTS)) (groups[P.group] = groups[P.group] || []).push([id, P]);
      if (!AB.PRODUCTS[R.ab.prod]) R.ab.prod = "b13";
      if (!AB.SECTORS[R.ab.sector]) R.ab.sector = "conus";
      $("#abiprod").innerHTML = Object.entries(groups).map(([g, ps]) => `<optgroup label="${esc(g)}">${ps.map(([id, P]) => `<option value="${id}">${esc(P.label)}</option>`).join("")}</optgroup>`).join("");
      $("#abiprod").value = R.ab.prod; $("#abisec").value = R.ab.sector; $("#abisat").value = R.ab.sat;
      const again = () => { $("#radarread").hidden = true; store.set("wx:abi", R.ab.prod); store.set("wx:abisec", R.ab.sector); store.set("wx:abisat", R.ab.sat); if (R.mode === "abi") { play(false); R.valid = null; abiFrames().then(label); } };
      $("#abiprod").addEventListener("change", (e) => { if (AB.PRODUCTS[e.target.value]) { R.ab.prod = e.target.value; again(); } });
      $("#abisec").addEventListener("change", (e) => { if (AB.SECTORS[e.target.value]) { R.ab.sector = e.target.value; R.abiBox = null; again(); } });
      $("#abisat").addEventListener("change", (e) => { if (["auto", "east", "west"].includes(e.target.value)) { R.ab.sat = e.target.value; R.abiBox = null; again(); } });
      $("#abigo").addEventListener("click", () => { const b = R.abiBox; if (b) fit(b.s, b.w, b.n, b.e, 20); });
    }
    if ($("#mrmsbar") && MR) {
      const groups = {};
      for (const [id, P] of Object.entries(MR.PRODUCTS)) (groups[P.group] = groups[P.group] || []).push([id, P]);
      if (!MR.PRODUCTS[R.mr.prod]) R.mr.prod = "rot60";
      $("#mrprod").innerHTML = Object.entries(groups).map(([g, ps]) => `<optgroup label="${esc(g)}">${ps.map(([id, P]) => `<option value="${id}"${id === R.mr.prod ? " selected" : ""}>${esc(P.label)}</option>`).join("")}</optgroup>`).join("");
      $("#mrprod").addEventListener("change", (e) => {
        if (!MR.PRODUCTS[e.target.value]) return;
        R.mr.prod = e.target.value; store.set("wx:mrms", R.mr.prod);
        if (R.mode === "mrms") { play(false); R.valid = null; mrmsFrames().then(label); }
      });
    }
    /* with a mouse, the value under the pointer */
    const readEl = $("#radarread");
    let readRaf = 0;
    if (PRO && readEl) {
      el.addEventListener("pointermove", (e) => {
        if (drag || e.pointerType !== "mouse") return;
        const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        cancelAnimationFrame(readRaf);
        readRaf = requestAnimationFrame(() => {
          const lat = yLat(R.cy - el.clientHeight / 2 + py, R.z), lon = xLng(R.cx - el.clientWidth / 2 + px, R.z);
          const text = readoutAt(lat, lon);
          /* always where the cursor is, to three decimals (the visitor's own pointer; nothing is kept), then what is under it */
          const where = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
          readEl.hidden = false; readEl.classList.remove("stale");
          readEl.innerHTML = `<b>${esc(where)}</b>${text ? " · " + esc(text) : ""}`;
        });
      });
      /* the last reading stays, dimmed, so it can be read after the mouse moves off */
      el.addEventListener("pointerleave", () => { readEl.classList.add("stale"); });
    }
    $("#play").addEventListener("click", () => play(!R.playing));
    /* Pro's loop speed and pause on the newest frame, the data's opacity, and the base map */
    if ($("#loopspeed")) {
      setLoop("speed", LOOP.speed);
      $("#loopspeed").addEventListener("change", (e) => setLoop("speed", Number(e.target.value) || 1));
      $("#loopdwell").addEventListener("change", (e) => setLoop("dwell", Number(e.target.value) || 1600));
      /* the loop's menu closes on a click anywhere else, as the other menus do */
      document.addEventListener("click", (e) => { const d = $("#loopset"); if (d && d.open && !e.target.closest("#loopset")) d.open = false; });
    }
    if ($("#opacity")) $("#opacity").addEventListener("input", (e) => setOpacity(Number(e.target.value) / 100));
    if ($("#basesel")) $("#basesel").addEventListener("change", (e) => setBase(e.target.value));
    /* on a desk the colour key lies on the map, not under it — the map gets the height (2026-10-23) */
    if (PRO && !PANEL && $("#legend")) {
      const mq = matchMedia("(min-width: 901px)"), lg = $("#legend"), home = lg.parentNode, after = lg.nextSibling;
      const place = () => { if (mq.matches) el.appendChild(lg); else home.insertBefore(lg, after); };
      place();
      mq.addEventListener ? mq.addEventListener("change", place) : mq.addListener(place);
    }
    $("#scrub").addEventListener("input", (e) => { play(false); loadOld(); userShow(Number(e.target.value)); });
    document.querySelectorAll(".seg [data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    if ($("#sitekind")) {
      /* Radar: the single radar, on the product last used (reflectivity the first time) */
      $("#sitekind").addEventListener("click", () => {
        const last = store.get("wx:sitemode", "l3:ref");
        if (!l3()) setMode(l3(last) ? last : "l3:ref");
      });
      const ov = $("#ovbtn"), panel = $("#ovpanel");
      const ovOpen = (on) => { panel.hidden = !on; ov.setAttribute("aria-expanded", String(on)); };
      ov.addEventListener("click", () => ovOpen(panel.hidden));
      document.addEventListener("click", (e) => { if (!panel.hidden && !e.target.closest(".ovwrap")) ovOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { ovOpen(false); ov.focus(); } });
      /* the words about the map: under the toolbar while ⓘ is on (kept in this browser) */
      const sb = $("#sitebar"), info = $("#infobtn");
      const infoOn = (on) => { sb.classList.toggle("open", on); info.setAttribute("aria-expanded", String(on)); info.setAttribute("aria-pressed", String(on)); };
      infoOn(store.get("wx:info", false) === true);
      info.addEventListener("click", () => { const on = !sb.classList.contains("open"); infoOn(on); store.set("wx:info", on); });
    }
    document.querySelectorAll("[data-sat]").forEach((b) => b.addEventListener("click", () => setSat(b.dataset.sat)));
    if ($("#satsel")) $("#satsel").addEventListener("change", (e) => setSat(e.target.value));
    /* the replay bar: a time (the visitor's own clock), a length, or a notable storm */
    const localInput = (ms) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); };
    $("#replaytoggle").addEventListener("click", () => {
      const bar = $("#replaybar"), open = bar.hidden;
      bar.hidden = !open;
      $("#replaytoggle").setAttribute("aria-pressed", String(open));
      $("#replaytoggle").setAttribute("aria-expanded", String(open));
      if (open && !$("#rpfrom").value) $("#rpfrom").value = localInput(Date.now() - 86400e3);
      /* from a single radar's product, the replay offers that radar first */
      if (open && $("#rpsrc")) $("#rpsrc").value = l3() && l3().l2 ? "site" : "mosaic";
      $("#rpfrom").max = localInput(Date.now() - 1800e3);
    });
    $("#replaybar").addEventListener("submit", (e) => {
      e.preventDefault();
      const from = new Date($("#rpfrom").value).getTime(), hours = Number($("#rplen").value);
      if (!Number.isFinite(from) || from < Wx.REPLAY_FROM || from > Date.now() - 1800e3) { note("Pick a time between 2006 and half an hour ago."); return; }
      if (!R.started) start();
      if ($("#rpsrc") && $("#rpsrc").value === "site" && L2) siteReplay(from, hours, false); else replay(from, hours, false);
    });
    $("#replaybar").addEventListener("click", (e) => {
      const b = e.target.closest("[data-preset]");
      if (!b) return;
      const [iso, h] = b.dataset.preset.split(","), from = Date.parse(iso);
      $("#rpfrom").value = localInput(from); $("#rplen").value = h;
      if (!R.started) start();
      if ($("#rpsrc") && $("#rpsrc").value === "site" && L2) siteReplay(from, Number(h), true); else replay(from, Number(h), true);
    });
    $("#rplive").addEventListener("click", leaveReplay);
    $("#stationtoggle").setAttribute("aria-pressed", String(R.stations));
    $("#stationtoggle").addEventListener("click", () => {
      R.stations = !R.stations;
      store.set("wx:stations", R.stations);
      $("#stationtoggle").setAttribute("aria-pressed", String(R.stations));
      if (R.stations) loadStations(); else { R.obs = []; draw(); label(); renderSources(); }
    });
    $("#outlooktoggle").addEventListener("click", () => {
      R.outlook = !R.outlook;
      $("#outlooktoggle").setAttribute("aria-pressed", String(R.outlook));
      draw(); label(); loadOverlays();
    });
    /* Pro: which SPC outlook — picking one turns the overlay on */
    if ($("#outlooksel")) {
      $("#outlooksel").value = R.olSel;
      $("#outlooksel").addEventListener("change", (e) => {
        R.olSel = Wx.OUTLOOKS[e.target.value] ? e.target.value : "d1:cat"; store.set("wx:outlooksel", R.olSel);
        if (!R.outlook) { R.outlook = true; $("#outlooktoggle").setAttribute("aria-pressed", "true"); }
        draw(); label(); loadOverlays();
      });
    }
    addEventListener("resize", () => requestAnimationFrame(draw));

    new IntersectionObserver((entries) => {
      R.visible = entries.some((x) => x.isIntersecting);
      if (R.visible) start();
      else if (R.playing) play(false);
    }, { rootMargin: "200px" }).observe(el);
    play(false);

    /* ── the map as a workstation panel (workstation.js, 2026-10-22) ──
       Its view, its moment and a stamp for its header — and the same set
       from outside, by the shared place and time. A change made here is
       told; one applied from outside is not told back (`applying`). */
    let applying = 0, toldView = "";
    const listeners = [];
    /* `hear` is for every change (a header's stamp); `tell` only for one the
       visitor made here, which the other panels then follow */
    function hear(type, data) { for (const f of listeners) { try { f(type, data); } catch (e) {} } }
    function tell(type, data) { if (!applying) hear(type, data); }
    /* the moment a frame is valid for: the scan's own time, or a forecast hour's */
    const validTime = (f = R.frames[R.frame]) => (f ? (f.l3 && f.l3.file && f.l3.file.time) || f.t || null : null);
    function stamp() {
      const f = R.frames[R.frame], t = validTime(f);
      let kind = "observed", run = null;
      if (f && f.model) { const Sx = MM.SOURCES[f.model.src]; kind = Sx.analysis ? "analysis" : "forecast"; run = Sx.analysis ? null : f.model.run; }
      else if (f && f.future) kind = "forecast";
      else if (R.mode === "replay") kind = "archive";
      /* while the loop plays: its span, so the legend can say the loop rather than each frame */
      const ts = R.playing ? R.frames.map((x) => validTime(x)).filter((x) => x != null) : [];
      const loop = ts.length > 1 ? { from: Math.min(...ts), to: Math.max(...ts) } : null;
      return { layer: R.started ? describe() : "", kind, t, run, loop, newest: R.frame >= R.frames.length - 1, frames: R.frames.length, mode: R.mode };
    }
    function viewNow() { return { lat: yLat(R.cy, R.z), lon: xLng(R.cx, R.z), z: R.z }; }
    /* where the main map is, kept in this browser to 0.1° so a reload reopens there (UI-REVIEW-3 item 1); never sent */
    function rememberView(v = viewNow()) {
      if (PRO && !PANEL && R.started) { clearTimeout(R.lvT); R.lvT = setTimeout(() => store.set("wx:lastview", { lat: Math.round(v.lat * 10) / 10, lon: Math.round(v.lon * 10) / 10, z: v.z }), 800); }
    }
    function tellView() {
      const v = viewNow(), k = `${v.lat.toFixed(3)},${v.lon.toFixed(3)},${v.z}`;
      if (k === toldView) return;
      toldView = k; tell("view", v);
      rememberView(v);
    }
    function setView(lat, lon, z) {
      if (!Wx.validLat(lat) || !Wx.validLon(lon)) return;
      applying++;
      try {
        R.us = false;
        const wasZ = R.z;
        R.z = Math.min(MAXZ, Math.max(MINZ, Math.round(z || R.z)));
        R.cx = lngX(lon, R.z); R.cy = latY(lat, R.z);
        toldView = `${lat.toFixed(3)},${lon.toFixed(3)},${R.z}`;
        /* this runs on every frame of a drag in another map: a pan only moves
           the tiles (place() drops the ones out of view), a zoom starts over */
        if (R.z !== wasZ) { zghost(); clearTiles(); }
        draw(); stationsSoon();
        if (R.z !== wasZ) zwaitGhost();
        rememberView();   // moved by another map: remembered all the same
        if (single() && !R.lockId) { clearTimeout(follow); follow = setTimeout(async () => { if (await pickSite(false)) { clearTiles(); await siteFrames(); label(); } }, 700); }
      } finally { applying--; }
    }
    /* the frame nearest a moment, within the step between frames (and never
       more than three hours) — a panel with nothing near keeps its own
       frame, and its stamp says how far it is from the shared time */
    function setTime(t) {
      if (!R.frames.length) return false;
      if (t == null) { applying++; try { play(false); show(R.frames.length - 1); } finally { applying--; } return true; }
      let best = -1, bd = Infinity;
      R.frames.forEach((f, i) => { const ft = validTime(f); if (ft != null && Math.abs(ft - t) < bd) { bd = Math.abs(ft - t); best = i; } });
      const ts = R.frames.map((f) => validTime(f)).filter((x) => x != null), step = ts.length > 1 ? (ts[ts.length - 1] - ts[0]) / (ts.length - 1) : 3600e3;
      if (best < 0 || bd > Math.min(3 * 3600e3, Math.max(10 * 60e3, step))) return false;
      if (best === R.frame) return true;
      applying++;
      try { if (best < R.frames.length - 1) loadOld(); show(best); } finally { applying--; }
      return true;
    }
    async function setLayer(str) {
      applying++;
      try {
        /* the mosaic is the one layer applyLink leaves to the page's default, so it is named here */
        const asked = new URLSearchParams(String(str).replace(/^#/, "")).get("l");
        let l = applyLink(str);
        if (asked === "comp") l = "comp";
        if (PRO && $("#mrprod") && MR) $("#mrprod").value = R.mr.prod;
        if (PRO && $("#abiprod") && AB) { $("#abiprod").value = R.ab.prod; $("#abisec").value = R.ab.sector; $("#abisat").value = R.ab.sat; }
        if (PRO && $("#mmsrc") && MM) { $("#mmsrc").value = R.mm.src; modelOptions(); }
        if (ltgOn()) lightningClock();
        if (typeof l === "string" && (l !== R.mode || l === "comp")) await setMode(l);
        loadOverlays(true); stationsSoon(); draw(); label();
      } finally { applying--; }
    }

    /* The lower 48, edge to edge: a map view, not anybody's place. */
    const CONUS = [24.4, -125, 49.5, -66.9];
    return {
      /* the times said again (a panel given the page's time zone) */
      relabel() { if (R.frames.length) show(R.frame); label(); },
      /* a colour table chosen in the page or another map */
      setPal: (k, v) => setPal(k, v, false),
      panel: {
        get view() { return viewNow(); }, setView,
        get stamp() { return stamp(); }, setTime,
        get layer() { return layerString(); }, setLayer,
        viewString,
        on(f) { listeners.push(f); }
      },
      center(lat, lon) {
        R.us = false; R.pin = null;
        R.lat = lat; R.lon = lon;
        R.z = 7;
        R.cx = lngX(lon, R.z); R.cy = latY(lat, R.z);
        clearTiles();
        R.lockId = null;
        if (single()) { R.site = null; if (R.started) pickSite(true).then(() => siteFrames()).then(label); }
        if (R.started) { draw(); stationsSoon(); }
      },
      showUS() {
        R.us = true; R.lat = null;
        /* the day's risk across the country, on Weather; Pro leaves it to its switch */
        /* (Weather used to turn the outlook on here; it is the visitor's choice now, in the layers menu) */
        if (single()) setMode("comp");
        fit(...CONUS, 10);
      },
      /* a storm that covers the place: its polygon and the place, on the
         nearest radar's reflectivity, playing */
      async focusStorm(a) {
        if (a.polygon) fitPolygon(a.polygon, S.place);
        if (!single() && inUS()) await setMode(NX ? "l3:ref" : "N0B");
        if (!reduced && R.visible) play(true, true);
      },
      focus(id) {
        const all = [...(S.alerts || []), ...(S.state || []), ...(S.national || [])];
        const a = all.find((x) => x.id === id);
        if (!a || !a.polygon) return false;
        fitPolygon(a.polygon, S.place && S.place.approx ? null : S.place);
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
        return true;
      },
      refresh() {
        if (!R.started || !R.visible) return;
        if (R.stations && Date.now() - (R.obsAt || 0) > 300e3) loadStations();
        loadOverlays();
        if (R.sat && satBucket() !== satAt) { satAt = satBucket(); for (const s of sats) { for (const img of s.tiles.values()) img.remove(); s.tiles.clear(); } draw(); }
        if (R.mode === "comp") { const was = !!R.backup; mosaicTime().then((v) => { if (v && (v !== R.valid || was !== !!R.backup)) { R.valid = v; clearTiles(); compFrames(); renderSources(); } }); }
        else if (R.mode === "replay") { /* the past does not refresh */ }
        else if (R.mode === "hrrr") { Wx.hrrrRun().then((v) => { if (v && v !== R.valid && !R.playing) hrrrFrames(); }).catch(() => {}); }
        else if (R.mode === "mrms") mrmsFrames(true);
        else if (R.mode === "abi") abiFrames(true);
        else if (R.mode === "model" && MM.SOURCES[R.mm.src].analysis) { MM.analyses(R.mm.src).then((r) => { if (r.length && r[r.length - 1] !== R.mm.run && !R.playing) modelFrames(); }).catch(() => {}); }
        else if (R.mode === "model") { MM.latestRun(R.mm.src).then((r) => { if (!r) return; if (R.mm.pin || R.mm.at) { if (r.run !== R.mm.newest && !R.mm.at) { R.mm.newest = r.run; runOptions(); modelRunText(); } } else if (r.run !== (R.mm.back ? R.mm.newest : R.mm.run) && !R.playing) modelFrames(); }).catch(() => {}); }
        else siteFrames(true);
      },
      draw, label, describe, setSat, start,
      get sat() { return R.sat; },
      get mode() { return R.mode; },
      get replay() { return R.replay; },
      get pro() { return PRO ? { ov: R.ov, ...R.pro } : null; },
      get analysis() { return R.mode === "model" && MM && MM.SOURCES[R.mm.src].analysis ? (MM.SOURCES[R.mm.src].server ? "server" : true) : false; },
      get lightning() { return ltgOn() && (LTG.at || LTG.failed) ? { n: LTG.flashes.length, at: LTG.at, failed: LTG.failed } : null; },
      get stations() { return R.stations && R.obs.length ? { n: R.obs.length, newest: Math.max(...R.obs.map((s) => s.time)) } : null; },
      get valid() { return R.valid; },
      get backup() { return !!R.backup; },
      get iemValid() { return R.iemValid; },
      get started() { return R.started; },
      /* a radar site's Level III scans, read from NOAA's bucket: asked every
         30 s, as Level II already is (its own timer, l2Frames), since a new
         scan lands every one to five minutes (2026-10-24). IEM's tiles and the
         mosaic stay on two minutes; loadOverlays() throttles itself. */
      get fast() { return !!(PRO && R.started && l3() && !useL2() && R.mode !== "replay"); }
    };
  })();

  /* ── the air above you (DESIGN.md §15–17) ──
     Closed until asked for. Opening it fetches one model's next 48 hours at
     this point — every pressure level — once; the hour slider then only
     re-reads what is already here, so dragging through time redraws the
     Skew-T and hodograph instantly (§15.5). */
  const sky = (() => {
    /* only Weather Pro has the air above you */
    if (!$("#skyd")) return { reset() {}, get source() { return null; }, redraw() {}, at() {}, setTime() {}, hourMs: null, onHour: null };
    const K = { model: null, col: null, colKey: null, run: null, hour: 0, raob: null, raobSite: null, mode: "model", busy: false, source: null };
    const body = () => $("#skybody");
    const m2ft = (m) => m * 3.28084;
    const hgt = (m) => m == null ? "–" : U() === "us" ? `${Math.round(m2ft(m) / 100) * 100} ft` : `${Math.round(m / 10) * 10} m`;
    const kt = (ms) => ms == null ? "–" : `${Math.round(ms * 1.943844)} kt`;
    const motionText = (uv) => {
      if (!uv) return "–";
      const [u, v] = uv, s = Math.hypot(u, v);
      const from = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
      return `${Math.round(from / 5) * 5}° at ${Math.round(s * 1.943844)} kt`;
    };
    /* where the sounding is: a point tapped on Pro's map, or the place */
    const here = () => K.point || S.place;
    const defaultModel = () => { const h = here(); return h && Wx.inMosaic(h.lat, h.lon) ? "hrrr" : "gfs"; };

    async function loadModel() {
      if (!here()) return;
      const key = `${K.model}|${placeKey(here())}`;
      if (K.colKey === key && K.col) return draw();
      K.busy = true; draw();
      try {
        const [col, run] = await Promise.all([Wx.column(K.model, here().lat, here().lon), Wx.modelRun(K.model)]);
        K.col = col; K.colKey = key; K.run = run;
        const first = col.hourly && col.hourly.time ? col.hourly.time.findIndex((t) => t * 1000 > Date.now() - 3600e3) : 0;
        K.hour = Math.max(0, first);
      } catch (e) { K.col = null; K.colKey = null; K.err = "The model did not answer. Try again, or another model."; }
      K.busy = false; draw();
    }
    /* the nearest launch site's latest flight, into K.raob (or an error) */
    async function fetchLatestRaob() {
      if (!K.raobSite) {
        const sites = await Wx.raobSites();
        K.raobSite = sites.map((x) => ({ ...x, d: Wx.distanceM(here().lat, here().lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d)[0] || null;
      }
      K.raob = null;
      if (K.raobSite) {
        for (const t of Wx.raobTimes(Date.now())) {
          const r = Wx.ROUTES.raob(K.raobSite.id, Wx.raobTs(t));
          if (!r) break;
          try {
            const prof = await fetchRaob(r);
            if (prof && prof.levels.length > 15) { K.raob = prof; break; }
          } catch (e) {}
        }
      }
      if (!K.raob) K.err = "No recent balloon flight from the nearest launch site.";
    }
    async function loadRaob() {
      if (!here()) return;
      K.busy = true; draw();
      try { await fetchLatestRaob(); } catch (e) { K.err = "The balloon archive did not answer."; }
      K.busy = false; draw();
    }
    /* §16: the balloon laid over the model — like with like: the model's
       column at the LAUNCH SITE (often a hundred miles from the place), at
       the hour of the launch. The column carries the last twelve hours for
       exactly this. A launch site is a public station, not anyone's place. */
    const nearestHour = (col, ms) => {
      const ts = col && col.hourly && col.hourly.time;
      if (!ts) return -1;
      let best = -1;
      ts.forEach((t, i) => { if (best < 0 || Math.abs(t * 1000 - ms) < Math.abs(ts[best] * 1000 - ms)) best = i; });
      return best >= 0 && Math.abs(ts[best] * 1000 - ms) <= 90 * 60e3 ? best : -1;
    };
    async function loadCompare() {
      K.cmp = null;
      K.busy = true; draw();
      try {
        if (!K.raob) await fetchLatestRaob();
        if (K.raob && K.raobSite) {
          const col = await Wx.column(K.model, K.raobSite.lat, K.raobSite.lon);
          const i = nearestHour(col, K.raob.valid);
          K.cmp = i >= 0 ? { col, i, model: K.model } : { none: "The model's column does not reach back to the launch, so there is nothing to compare like with like." };
        }
      } catch (e) { K.cmp = { none: "The model did not answer for the launch site." }; }
      K.busy = false; draw();
    }
    function toggleCompare() {
      K.compare = !K.compare;
      if (K.compare) loadCompare(); else draw();
    }
    /* model minus balloon at a few standard levels, in words */
    function compareWords(a) {
      const deg = (c) => U() === "us" ? c * 9 / 5 : c;
      const bits = [], ball = K.raob.levels.slice().sort((x, y) => y.p - x.p);
      for (const [p, k, name] of [[850, "t", "850 hPa"], [700, "t", "700 hPa"], [500, "t", "500 hPa"], [850, "td", "850 hPa dewpoint"]]) {
        const m = Snd.at(a.levels, p, k), b = Snd.at(ball, p, k);
        if (!Number.isFinite(m) || !Number.isFinite(b)) continue;
        const d = deg(m - b), n = Math.round(Math.abs(d) * 10) / 10;
        bits.push(n < 0.5 ? `${name} within half a degree` : `${name} ${n}° ${k === "td" ? (d > 0 ? "moister" : "drier") : (d > 0 ? "warmer" : "cooler")}`);
      }
      return bits.length ? `The model against the balloon: ${bits.join(", ")}.` : "";
    }
    /* the balloon is fetched through the same Worker-then-direct path as everything else */
    async function fetchRaob(route) {
      const tryFetch = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return r.json(); };
      try { return Snd.fromRaob(await tryFetch(Wx.host() + "/wx/" + route[0])); }
      catch (e) { return Snd.fromRaob(await tryFetch(route[1])); }
    }

    const comparing = () => K.mode === "model" && K.compare && K.cmp && K.cmp.col && K.cmp.model === K.model;
    function analysisNow() {
      if (K.mode === "raob") return K.raob ? { a: Snd.analyze(K.raob.levels), when: K.raob.valid } : null;
      if (comparing()) {
        const prof = Snd.fromOpenMeteo(K.cmp.col, K.cmp.i);
        return prof ? { a: Snd.analyze(prof), when: K.cmp.col.hourly.time[K.cmp.i] * 1000 } : null;
      }
      if (!K.col) return null;
      const prof = Snd.fromOpenMeteo(K.col, K.hour);
      return prof ? { a: Snd.analyze(prof), when: K.col.hourly.time[K.hour] * 1000 } : null;
    }

    /* ── the ingredients over the next two days ──
       Every hour of the column analysed (once per column), four rows of
       cells coloured by the usual thresholds, so the hour worth a look can be
       found without dragging the slider through all 48. Tap a cell to go to it. */
    const ROWS = [
      ["CAPE", "Mixed-layer CAPE", (a) => a.ml.cape, [250, 1000, 2500], (x) => Math.round(x).toLocaleString() + " J/kg"],
      ["Shear", "0–6 km shear", (a) => a.shear6 != null ? a.shear6 * 1.943844 : null, [20, 35, 50], (x) => Math.round(x) + " kt"],
      ["SRH", "0–1 km storm-relative helicity", (a) => a.srh1, [50, 150, 300], (x) => Math.round(x) + " m²/s²"],
      ["STP", "Significant tornado parameter (effective layer)", (a) => a.stpE, [0.5, 1, 3], (x) => x.toFixed(1)]
    ];
    function timeline() {
      if (!K.col || !K.col.hourly || !K.col.hourly.time) return null;
      if (K.tl && K.tl.key === K.colKey) return K.tl;
      /* from the current hour on: the column's twelve past hours are there
         for the balloon, not for "the next two days" */
      const from = Date.now() - 3600e3;
      const hours = K.col.hourly.time.map((t, i) => ({ t, i })).filter((x) => x.t * 1000 > from).map(({ t, i }) => {
        const prof = Snd.fromOpenMeteo(K.col, i);
        let a = null;
        try { a = prof ? Snd.analyze(prof) : null; } catch (e) { a = null; }
        return { i, t: t * 1000, v: ROWS.map((r) => { const x = a ? r[2](a) : null; return x == null || !Number.isFinite(x) ? null : x; }) };
      });
      K.tl = { key: K.colKey, hours };
      return K.tl;
    }
    function timelineHtml() {
      const tl = timeline();
      if (!tl) return "";
      const k = clk();
      const lvl = (x, th) => x == null ? "x" : x >= th[2] ? "3" : x >= th[1] ? "2" : x >= th[0] ? "1" : "0";
      const peaks = ROWS.map((r, j) => tl.hours.reduce((best, h, i) => h.v[j] != null && (best === null || h.v[j] > tl.hours[best].v[j]) ? i : best, null));
      const notable = ROWS.map((r, j) => peaks[j] !== null && tl.hours[peaks[j]].v[j] >= r[3][1] ? `${r[1]} peaks at ${r[4](tl.hours[peaks[j]].v[j])} ${k.day(tl.hours[peaks[j]].t)} ${k.hour(tl.hours[peaks[j]].t)}` : null).filter(Boolean);
      const said = notable.length ? notable.join("; ") + "." : "No storm ingredients reach notable levels in the next two days.";
      /* a picture to tap; the slider above is the keyboard's way through the hours */
      const rows = ROWS.map((r, j) => `<div class="tlrow"><span class="tln" title="${esc(r[1])}">${r[0]}</span><div class="tlcells">${tl.hours.map((h, i) =>
        `<i class="l${lvl(h.v[j], r[3])}${h.i === K.hour ? " on" : ""}" data-tlh="${h.i}" title="${esc(k.day(h.t) + " " + k.hour(h.t) + ": " + (h.v[j] == null ? "none" : r[4](h.v[j])))}"></i>`).join("")}</div></div>`).join("");
      const ticks = tl.hours.map((h, i) => k.hour(h.t) === "12AM" ? `<span style="left:${(i / tl.hours.length * 100).toFixed(1)}%">${esc(k.day(h.t))}</span>` : "").join("");
      return `<div class="tl" id="skytime"><p class="tlsay">${esc(said)}</p><div role="img" aria-label="${esc("Storm ingredients by hour for the next two days. " + said)}">${rows}<div class="tlticks" aria-hidden="true">${ticks}</div></div>
        <p class="nextnote">Each cell is one hour of this model's run here: grey none, then yellow, orange, magenta as each ingredient climbs (CAPE 250 / 1,000 / 2,500; shear 20 / 35 / 50 kt; SRH 50 / 150 / 300; STP 0.5 / 1 / 3). Ingredients, not a forecast of storms. Tap an hour to see its sounding.</p></div>`;
    }

    function draw(partsOnly) {
      const b = body();
      if (!b || !$("#skyd").open) return null;
      const k = clk();
      const models = Object.entries(Wx.MODELS);
      const buttons = models.map(([id, m]) => `<button type="button" data-skymodel="${id}" aria-pressed="${K.mode === "model" && K.model === id}" title="${esc(m.long)}">${esc(m.label)}</button>`).join("") +
        `<button type="button" data-skymodel="raob" aria-pressed="${K.mode === "raob"}" title="The nearest weather balloon's latest flight">Balloon</button>` +
        (K.mode === "model" ? `<span class="sep"></span><button type="button" data-skycmp aria-pressed="${!!K.compare}" title="Lay the latest weather balloon over the model's hour for the same moment">Balloon on top</button>` : "");
      let info = "", slider = "", pics = "", table = "";
      const now = analysisNow();
      if (K.busy) info = `<p class="loading">Fetching the column…</p>`;
      else if (!now || !now.a) info = `<p class="err">${esc(K.err || "No sounding to draw for this place.")}</p>`;
      else {
        const a = now.a;
        if (K.mode === "model") {
          const m = Wx.MODELS[K.model];
          const lead = K.run ? Math.round((now.when - K.run) / 3600e3) : null;
          /* an hour before the latest run comes from an earlier run */
          const leadText = lead == null ? "" : lead >= 0 ? ` (+${lead} h)` : " (from an earlier run)";
          K.source = { title: `Sounding — ${m.label}`, sub: `Open-Meteo · model run`, at: K.run, stale: K.run ? Date.now() - K.run > (K.model === "hrrr" ? 4 : 14) * 3600e3 : false };
          if (comparing()) {
            const s = K.raobSite;
            info = `<p class="skymeta">${esc(m.label)} at the launch site, ${esc(s.id)} — ${esc(s.name)} · ${esc(k.dayLong(now.when))}, ${esc(k.time(now.when))}${leadText}
              <small>Solid: the model's column at the balloon's own launch site and hour, so the two are like with like. Dotted: the balloon, launched ${esc(new Date(K.raob.valid).toISOString().slice(11, 13))}Z (${esc(Wx.age(Date.now() - K.raob.valid))} ago), ${dist(s.d / 1000)} from here. Turn the comparison off to go back to this place's hours.</small></p>
              <p class="skycmp">${esc(compareWords(a))}</p>`;
          } else {
            info = `<p class="skymeta">${esc(m.label)}${K.run ? ` · ${new Date(K.run).toISOString().slice(11, 13)}Z run` : ""} · valid ${esc(k.dayLong(now.when))}, ${esc(k.time(now.when))}${leadText}
              <small>${esc(m.long)}. A forecast column at this point, not a measurement.</small></p>`;
            if (K.compare) info += `<p class="skycmp">${esc((K.cmp && K.cmp.none) || K.err || "No recent balloon flight to compare with.")}</p>`;
            const n = K.col.hourly.time.length;
            slider = `<div class="hourpick"><span class="num" style="min-width:52px">${esc(k.hour(now.when))}</span><input type="range" id="skyhour" min="0" max="${n - 1}" step="1" value="${K.hour}" aria-label="Forecast hour"><span class="dim num">+48 h</span></div>`;
          }
        } else {
          const s = K.raobSite;
          info = `<p class="skymeta">Weather balloon · ${esc(s ? s.id + " — " + s.name : "")}${s ? ` · ${dist(s.d / 1000)} away` : ""}
            <small>Launched ${esc(new Date(K.raob.valid).toISOString().slice(11, 13))}Z (${esc(Wx.age(Date.now() - K.raob.valid))} ago) — measured, not modelled. Balloons go up at 00Z and 12Z.</small></p>`;
          K.source = { title: `Sounding — balloon ${s ? s.id : ""}`, sub: "NOAA upper-air, via IEM · launched", at: K.raob.valid, stale: Date.now() - K.raob.valid > 14 * 3600e3 };
        }
        const over = comparing() && K.raob ? { levels: K.raob.levels } : null;
        pics = `<div class="skyrow">${Draw.skewT(a, { compare: over, label: "Skew-T log-P diagram: temperature (red), dewpoint (green), mixed-layer parcel (dashed white), CAPE shaded" + (over ? "; the weather balloon dotted over it" : "") })}
          <div>${Draw.hodograph(a, { label: "Hodograph: wind from the ground to 10 km, coloured by height" })}
          <div class="key"><span><i style="background:#ff6b6b"></i>0–1 km</span><span><i style="background:#51cf66"></i>1–3</span><span><i style="background:#ffd43b"></i>3–6</span><span><i style="background:#74c0fc"></i>6–10</span><span>● RM / ○ LM storm motion</span></div></div></div>`;
        const P = [["Surface", a.sb], ["Mixed layer", a.ml], ["Most unstable", a.mu]];
        table = `<table class="ptable"><thead><tr><th>Parcel</th><th>CAPE</th><th>CIN</th><th>LCL</th><th>LFC</th><th>EL</th></tr></thead><tbody>
          ${P.map(([n, p]) => `<tr><td>${n}</td><td class="num">${p.cape}</td><td class="num">${p.lfc ? p.cin : "–"}</td><td class="num">${hgt(p.lcl.z)}</td><td class="num">${p.lfc ? hgt(p.lfc.z) : "–"}</td><td class="num">${p.el ? hgt(p.el.z) : "–"}</td></tr>`).join("")}
          </tbody></table>
          <div class="params">
            <div><span>0–1 km shear</span><b class="num">${kt(a.shear1)}</b></div>
            <div><span>0–6 km shear</span><b class="num">${kt(a.shear6)}</b></div>
            <div><span>0–1 km SRH</span><b class="num">${a.srh1 != null ? Math.round(a.srh1) + " m²/s²" : "–"}</b></div>
            <div><span>0–3 km SRH</span><b class="num">${a.srh3 != null ? Math.round(a.srh3) + " m²/s²" : "–"}</b></div>
            <div><span>Storm motion (RM)</span><b class="num">${a.motion ? motionText(a.motion.right) : "–"}</b></div>
            <div><span>Precipitable water</span><b class="num">${U() !== "metric" ? (a.pw / 25.4).toFixed(2) + " in" : a.pw.toFixed(1) + " mm"}</b></div>
            <div><span>Freezing level</span><b class="num">${hgt(a.frz)}</b></div>
            <div><span>700–500 lapse rate</span><b class="num">${a.lapse75 != null ? a.lapse75.toFixed(1) + " °C/km" : "–"}</b></div>
            <div><span>0–3 km lapse rate</span><b class="num">${a.lapse03 != null ? a.lapse03.toFixed(1) + " °C/km" : "–"}</b></div>
            <div><span>Downdraft CAPE</span><b class="num">${a.dcape != null ? Math.round(a.dcape).toLocaleString() + " J/kg" : "–"}</b></div>
            <div><span>STP (fixed layer)</span><b class="num">${a.stp != null ? a.stp.toFixed(1) : "–"}</b></div>
            <div><span>Effective inflow layer</span><b class="num">${a.eff ? `${hgt(a.eff.base)}–${hgt(Math.max(a.eff.top, a.eff.base))}` : "none"}</b></div>
            <div><span>Effective SRH</span><b class="num">${a.eff && a.esrh != null ? Math.round(a.esrh) + " m²/s²" : "–"}</b></div>
            <div><span>Effective bulk shear</span><b class="num">${a.eff && a.ebwd != null ? kt(a.ebwd) : "–"}</b></div>
            <div><span>STP (effective)</span><b class="num">${a.stpE != null ? a.stpE.toFixed(1) : "–"}</b></div>
            <div><span>Supercell composite</span><b class="num">${a.scp != null ? a.scp.toFixed(1) : "–"}</b></div>
          </div>`;
      }
      if (partsOnly) return { info, pics, table, when: now && now.when };
      const where = K.point ? `<p class="skyat">Sounding at <b>${esc(K.point.name)}</b>, tapped on the map. <button type="button" class="linkbtn" data-skyback>Back to ${esc(S.place ? S.place.name : "the place")}</button></p>` : "";
      b.innerHTML = `${where}<div class="seg" role="group" aria-label="Sounding source" style="margin-top:10px">${buttons}</div><div id="skyinfo">${info}</div>${slider}${K.mode === "model" && !K.busy && now && !comparing() ? timelineHtml() : ""}<div id="skydyn">${pics}${table}</div>
        <details class="gloss"><summary>What these mean</summary><dl>
          <dt>CAPE</dt><dd>Energy a rising parcel of air gains from being warmer than its surroundings, J/kg. Over ~1000 is plenty for strong storms; over ~3000 is a lot.</dd>
          <dt>CIN</dt><dd>The "cap": energy needed to push a parcel up to where it rises on its own. Strongly negative means storms struggle to start.</dd>
          <dt>LCL · LFC · EL</dt><dd>Cloud base; where a lifted parcel starts rising freely; where it stops (roughly the storm top).</dd>
          <dt>Shear</dt><dd>How much the wind changes between two heights. 0–6 km over ~40 kt helps storms organise and rotate.</dd>
          <dt>SRH</dt><dd>Storm-relative helicity: how much spin the low-level wind feeds a storm moving the way Bunkers' method predicts (RM). Larger means more tornado-favourable.</dd>
          <dt>STP</dt><dd>SPC's significant tornado parameter: CAPE, cloud base, helicity and shear in one number. Above 1 is notable. The fixed-layer version uses the lowest 1 km and 6 km; the effective version (the one SPC leads with, and the timeline's row) uses the effective layer and also counts the cap. An index of ingredients — never a forecast that a tornado will happen.</dd>
          <dt>Effective layer</dt><dd>The air that would actually feed a storm: the lowest run of levels whose air, lifted, has at least 100 J/kg of CAPE and no worse than −250 J/kg of CIN (Thompson et al. 2007). If it starts above the ground, storms would be elevated, and the effective STP is 0.</dd>
          <dt>Effective SRH · shear</dt><dd>Helicity through the effective layer, and the wind change from its base to halfway up the most-unstable parcel's storm top.</dd>
          <dt>Supercell composite</dt><dd>Most-unstable CAPE, effective helicity and effective shear together (Thompson et al. 2004). Above 1 favours supercells; negative values favour left-moving ones. Ingredients, not a forecast.</dd>
        </dl><p>Computed on this page from the column above (sounding.js), with virtual-temperature parcels as SPC does; checked against MetPy.</p></details>`;
    }

    $("#skyd").addEventListener("toggle", () => {
      if (!$("#skyd").open) return;
      if (!K.model) K.model = defaultModel();
      if (K.mode === "model") loadModel(); else loadRaob();
      draw();
    });
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-skycmp]")) { toggleCompare(); return; }
      if (e.target.closest("[data-skyback]")) { K.point = null; Object.assign(K, { tl: null, col: null, colKey: null, raob: null, raobSite: null, cmp: null, compare: false }); K.model = defaultModel(); loadModel(); return; }
      const b = e.target.closest("[data-skymodel]");
      if (!b) return;
      const id = b.dataset.skymodel;
      K.err = null;
      if (id === "raob") { K.mode = "raob"; loadRaob(); }
      else { K.mode = "model"; K.model = id; loadModel().then(() => { if (K.compare) loadCompare(); }); }
    });
    /* Dragging the hour redraws the info line and the drawings, never the
       slider itself — replacing an input mid-drag ends the drag on a phone. */
    document.addEventListener("input", (e) => {
      if (e.target.id !== "skyhour") return;
      K.hour = Number(e.target.value);
      if (skyApi.onHour && K.col && K.col.hourly) skyApi.onHour(K.col.hourly.time[K.hour] * 1000);
      const html = draw(true);
      if (!html) return;
      $("#skyinfo").innerHTML = html.info;
      $("#skydyn").innerHTML = html.pics + html.table;
      const lab = e.target.previousElementSibling;
      if (lab && html.when) lab.textContent = clk().hour(html.when);
      markHour();
    });
    function markHour() { document.querySelectorAll("#skytime [data-tlh]").forEach((c) => c.classList.toggle("on", Number(c.dataset.tlh) === K.hour)); }
    document.addEventListener("click", (e) => {
      const c = e.target.closest("[data-tlh]");
      if (!c) return;
      K.hour = Number(c.dataset.tlh);
      if (skyApi.onHour && K.col && K.col.hourly) skyApi.onHour(K.col.hourly.time[K.hour] * 1000);
      const sl = $("#skyhour"); if (sl) sl.value = K.hour;
      const html = draw(true);
      if (!html) return;
      $("#skyinfo").innerHTML = html.info;
      $("#skydyn").innerHTML = html.pics + html.table;
      if (sl && html.when) sl.previousElementSibling.textContent = clk().hour(html.when);
      markHour();
    });
    const skyApi = {
      reset() { Object.assign(K, { tl: null, col: null, colKey: null, run: null, raob: null, raobSite: null, model: null, mode: "model", source: null, err: null, compare: false, cmp: null, point: null }); if ($("#skyd").open) { K.model = defaultModel(); loadModel(); } },
      /* a sounding at a point tapped on the map, until "back" */
      at(lat, lon, name) {
        Object.assign(K, { tl: null, col: null, colKey: null, run: null, raob: null, raobSite: null, mode: "model", source: null, err: null, compare: false, cmp: null,
          point: { lat: Wx.round2(lat), lon: Wx.round2(lon), name: String(name || "the tapped point").slice(0, 60) } });
        K.model = defaultModel();
        const d = $("#skyd"); d.open = true; $("#sky").hidden = false;
        loadModel();
        if (window.WxOpenDrawer) window.WxOpenDrawer();
        $("#sky").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      },
      get source() { return K.source; },
      /* the workstation's shared time: the model hour nearest it (a balloon
         keeps its launch time — an observation is not moved) */
      setTime(ms) {
        const ts = K.col && K.col.hourly && K.col.hourly.time;
        if (!ts || K.mode !== "model" || ms == null) return;
        let best = 0;
        ts.forEach((t, i) => { if (Math.abs(t * 1000 - ms) < Math.abs(ts[best] * 1000 - ms)) best = i; });
        if (best !== K.hour) { K.hour = best; draw(); }
      },
      get hourMs() { const ts = K.col && K.col.hourly && K.col.hourly.time; return ts && ts[K.hour] != null ? ts[K.hour] * 1000 : null; },
      onHour: null,
      redraw: draw
    };
    return skyApi;
  })();

  /* ── places ── */
  const dlg = $("#places");
  const openPlaces = () => { renderSaved(); $("#placemsg").textContent = ""; $("#results").innerHTML = ""; dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", ""); setTimeout(() => $("#q").focus(), 30); };
  const closePlaces = () => { dlg.close ? dlg.close() : dlg.removeAttribute("open"); };
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closePlaces(); });
  $("#closeplaces").addEventListener("click", closePlaces);
  $("#placebtn").addEventListener("click", openPlaces);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-places]")) { e.preventDefault(); openPlaces(); }
    if (e.target.closest("[data-locate]")) locate();
    if (e.target.closest("[data-retry]")) load();
    const hb = e.target.closest("[data-hour]");
    if (hb) { const t = Number(hb.dataset.hour); S.selected = S.selected === t ? null : t; renderHourly(); }
    const w = e.target.closest("[data-focus]");
    if (w) radar.focus(w.dataset.focus);
  });

  function choose(p) {
    const place = cleanPlace(p);
    if (!place) return;
    S.place = place;
    if (!place.approx) store.set("wx:place", place);
    if (!place.here && !place.approx) {
      S.saved = [place, ...S.saved.filter((s) => placeKey(s) !== placeKey(place))].slice(0, 12);
      store.set("wx:saved", S.saved);
    }
    closePlaces();
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    if (!S.meso.s) renderMeso();
    load();
  }
  function showUS() {
    S.place = null;
    store.del("wx:place");
    Object.assign(S, { fc: null, pt: undefined, obs: undefined, office: undefined, alerts: undefined, state: undefined });
    sky.reset();
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    if (!S.meso.s) renderMeso();
    loadUS();
  }
  $("#usview").addEventListener("click", showUS);

  function renderSaved() {
    const ul = $("#saved");
    $("#savedtitle").hidden = !S.saved.length;
    ul.innerHTML = S.saved.map((p, i) => `<li><button class="pick" type="button" data-saved="${i}">${esc(p.name)}<small>${esc(p.region)}</small></button><span class="savednow num" data-now="${i}"></span><button class="x" type="button" data-forget="${i}" aria-label="Forget ${esc(p.name)}">×</button></li>`).join("");
    /* every saved place's temperature right now, in one request */
    if (S.saved.length) Wx.several(S.saved).then((list) => list.forEach((x, i) => {
      const el = ul.querySelector(`[data-now="${i}"]`);
      if (el && x && x.temp != null) el.innerHTML = `${icon(Wx.condition(x.code).kind, x.isDay)}<b>${Wx.fmt.temp(x.temp, U())}°</b>${x.hi != null ? `<small>H ${Wx.fmt.temp(x.hi, U())}° L ${Wx.fmt.temp(x.lo, U())}°</small>` : ""}`;
    })).catch(() => {});
  }
  $("#saved").addEventListener("click", (e) => {
    const s = e.target.closest("[data-saved]"), f = e.target.closest("[data-forget]");
    if (s) choose(S.saved[Number(s.dataset.saved)]);
    if (f) { S.saved.splice(Number(f.dataset.forget), 1); store.set("wx:saved", S.saved); renderSaved(); }
  });

  let found = [];
  let searchCtl = null;
  /* Results come as you type (after a pause, from two letters), and Enter
     still searches at once. Only the newest question's answer is drawn. */
  async function search(q) {
    if (searchCtl) searchCtl.abort();
    if (!q) { $("#placemsg").textContent = ""; $("#results").innerHTML = ""; found = []; return; }
    const ctl = searchCtl = new AbortController();
    $("#placemsg").textContent = "Searching…";
    try {
      const list = await Wx.geocode(q, ctl.signal);
      if (ctl !== searchCtl) return;
      found = list;
      $("#placemsg").textContent = found.length ? "" : `Nothing called “${q}” — try a nearby town.`;
      $("#results").innerHTML = found.map((p, i) => `<li><button class="pick" type="button" data-found="${i}">${esc(p.name)}<small>${esc(p.region)}</small></button></li>`).join("");
    } catch (err) {
      if (!ctl.signal.aborted) $("#placemsg").textContent = "The place search did not answer. Try again in a moment.";
    }
  }
  let typing = 0;
  $("#searchform").addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(typing); search($("#q").value.trim()); });
  $("#q").addEventListener("input", () => {
    clearTimeout(typing);
    const q = $("#q").value.trim();
    typing = setTimeout(() => search(q.length >= 2 ? q : ""), 280);
  });
  $("#results").addEventListener("click", (e) => {
    const b = e.target.closest("[data-found]");
    if (b) choose(found[Number(b.dataset.found)]);
  });

  function locate() {
    const msg = (t) => { $("#placemsg").textContent = t; };
    if (!navigator.geolocation) { openPlaces(); msg("This browser can't share a location — search instead."); return; }
    msg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => choose({ name: "Your location", region: "", lat: pos.coords.latitude, lon: pos.coords.longitude, here: true }),
      (err) => { if (!dlg.open) openPlaces(); msg(err.code === 1 ? "Location is blocked for this site — search for a place instead." : "Couldn't get a location fix. Try again, or search."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60e3 }
    );
  }
  $("#locate").addEventListener("click", locate);

  $("#units").addEventListener("click", () => {
    /* Pro: its own set → °F → °C → its own set; Weather: °F ↔ °C */
    S.units = PRO ? ({ pro: "us", us: "metric", metric: "pro" })[S.units] || "pro" : S.units === "us" ? "metric" : "us";
    store.set(PRO ? "wx:prounits" : "wx:units", S.units);
    render(); radar.draw(); radar.label(); sky.redraw();
  });
  /* Pro: local time or UTC, everywhere on the page; panels follow by the storage event */
  const utcRedraw = () => {
    if ($("#utcbtn")) { $("#utcbtn").textContent = UTC ? "UTC" : "Local"; $("#utcbtn").setAttribute("aria-pressed", String(UTC)); }
    if (!PANEL) render();
    radar.label(); sky.redraw();
  };
  if ($("#utcbtn")) {
    $("#utcbtn").textContent = UTC ? "UTC" : "Local"; $("#utcbtn").setAttribute("aria-pressed", String(UTC));
    $("#utcbtn").addEventListener("click", () => { UTC = !UTC; store.set("wx:utc", UTC); utcRedraw(); });
  }
  if (PRO) addEventListener("storage", (e) => {
    if (e.key === "wx:utc") { UTC = store.get("wx:utc", false) === true; utcRedraw(); }
    /* the units, changed in the page or another map: every map follows */
    else if (e.key === "wx:palref" || e.key === "wx:palvel") radar.setPal(e.key.slice(6), store.get(e.key, "nws"));
    else if (e.key === "wx:prounits") {
      const u = store.get("wx:prounits", "pro");
      if (["pro", "us", "metric"].includes(u) && u !== S.units) { S.units = u; if (!PANEL) render(); radar.draw(); radar.label(); sky.redraw(); }
    }
  });

  /* ── Pro as a map app (2026-10-23, Ric: "The map needs to cover the whole
     page"): the map fills the window under the site's bar (its height is
     measured into --tb), and the readouts are a drawer. Open by default
     where there is room to dock it beside the map (1200 px and up); the
     visitor's own choice is kept in this browser. D opens and closes it. ── */
  if (PRO && !PANEL && $("#databtn")) {
    const tb = $(".topbar");
    /* one bar, not two (2026-10-23, Ric: "cut the stacked bars down"): the
       place bar joins the site's bar, between the wordmark and the rooms */
    const pb = $(".placebar"), nw = $(".topbar .navwrap");
    if (tb && pb && nw) { tb.insertBefore(pb, nw); tb.classList.add("hasplace"); }
    const measureTop = () => { if (tb) document.documentElement.style.setProperty("--tb", tb.offsetHeight + "px"); };
    measureTop();
    addEventListener("resize", measureTop);
    if (typeof ResizeObserver === "function" && tb) new ResizeObserver(measureTop).observe(tb);
    /* the page's settings behind ⋯ where the row has no room for them */
    const more = $("#pagemore"), mbox = $("#pagebox");
    if (more && mbox) {
      const moreOpen = (on) => {
        mbox.classList.toggle("open", on); more.setAttribute("aria-expanded", String(on));
        if (on) { const r = more.getBoundingClientRect(); mbox.style.setProperty("--popr", Math.max(8, innerWidth - r.right) + "px"); mbox.style.setProperty("--popy", Math.round(r.bottom + 6) + "px"); }
      };
      more.addEventListener("click", () => moreOpen(!mbox.classList.contains("open")));
      document.addEventListener("click", (e) => { if (mbox.classList.contains("open") && !mbox.contains(e.target) && !more.contains(e.target)) moreOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && mbox.classList.contains("open") && !document.querySelector("dialog[open]")) { moreOpen(false); more.focus(); } });
      mbox.addEventListener("click", (e) => { if (e.target.closest("#keysbtn,#refresh,#usview")) moreOpen(false); });
      addEventListener("resize", () => { if (mbox.classList.contains("open")) moreOpen(true); });
    }
    const wide = () => innerWidth >= 1200;
    const setDrawer = (on, keep) => {
      document.body.classList.toggle("drawer-open", on);
      $("#databtn").setAttribute("aria-expanded", String(on));
      if (keep) store.set("wx:drawer", on);
      /* the map changes size when the drawer docks: redraw once it has */
      setTimeout(() => dispatchEvent(new Event("resize")), 230);
    };
    const kept = store.get("wx:drawer", null);
    setDrawer(typeof kept === "boolean" ? kept && wide() : wide(), false);
    $("#databtn").addEventListener("click", () => setDrawer(!document.body.classList.contains("drawer-open"), true));
    addEventListener("keydown", (e) => {
      const t = e.target;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) || document.querySelector("dialog[open]")) return;
      if (e.key === "d" || e.key === "D") { setDrawer(!document.body.classList.contains("drawer-open"), true); e.preventDefault(); }
      /* over the map (a narrow window), Esc puts it away */
      else if (e.key === "Escape" && !wide() && document.body.classList.contains("drawer-open")) setDrawer(false, false);
    });
    /* the map's toolbar floats on the map: its height goes to --ctlh, so the zoom, the stamp and the notes sit under it */
    const card = $("#radarcard"), ctl = $("#mapctl");
    /* …and to the body as --mapctlh, so the storm warnings, which float over the map from outside its card, sit under the toolbar rather than over its buttons (2026-10-24) */
    const ctlh = () => { if (card && ctl) { const v = (getComputedStyle(ctl).position === "absolute" ? ctl.offsetHeight : 0) + "px"; card.style.setProperty("--ctlh", v); document.body.style.setProperty("--mapctlh", v); } };
    ctlh();
    if (typeof ResizeObserver === "function" && ctl) new ResizeObserver(ctlh).observe(ctl);
    addEventListener("resize", ctlh);
    /* anything that asks to show a card opens the drawer first */
    window.WxOpenDrawer = () => { if (!document.body.classList.contains("drawer-open")) setDrawer(true, false); };
  }
  $("#refresh").addEventListener("click", () => { load(); radar.refresh(); });

  /* ── keeping up ──
     Every ten minutes, everything. Every minute, the alerts — when a storm
     warning covers the place or one is in its state, or on the national view —
     and the radar every two, while it is in view (§25, §29) — a radar
     site's own Level III scans on Pro every thirty seconds (radar.fast). */
  const FULL = 10 * 60e3, FAST = 60e3;
  let lastRadar = Date.now();
  const radarDue = (now) => now - lastRadar >= (radar.fast ? 25e3 : 120e3);   // 25: the tick is 30 s, and a timer runs a little early or late
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (PANEL) { if (radarDue(now)) { lastRadar = now; radar.refresh(); } return; }
    if (now - S.loadedAt > FULL) { load(); return; }
    /* a failed alert check is asked again every minute, like a storm */
    const hot = !S.place || stormsHere().length || (S.state || []).some((a) => a.storm) || !!S.err.alerts;
    if (hot && now - S.fastAt >= FAST) {
      S.fastAt = now;
      const ctl = S.ctl || new AbortController();
      if (!S.place) Wx.national(ctl.signal).then((a) => { S.national = a; S.checked.national = Date.now(); render(); radar.draw(); }).catch(() => {});
      else {
        const key = placeKey(S.place);
        const live = () => S.place && placeKey(S.place) === key;
        loadAlerts(ctl.signal, live); loadState(ctl.signal, live);
      }
    }
    if (radarDue(now)) { lastRadar = now; radar.refresh(); }
    if (S.place && now - (S.nowAt || 0) >= 300e3) {
      S.nowAt = now;
      const key = placeKey(S.place);
      loadNowcast((S.ctl || new AbortController()).signal, () => S.place && placeKey(S.place) === key);
    }
  }, 30e3);
  document.addEventListener("visibilitychange", () => {
    if (!PANEL && document.visibilityState === "visible" && Date.now() - S.loadedAt > FULL) load();
  });

  /* ── the home screen ──
     Offered once a place is chosen, never to someone already opening it from
     their home screen, and gone for good once dismissed. iPhones have no
     install prompt, so they get the two taps that do it; everything else gets
     the browser's own prompt when it offers one. */
  if ("serviceWorker" in navigator && /^(https:|http:\/\/(localhost|127\.0\.0\.1))/.test(location.href)) {
    navigator.serviceWorker.register("weather-sw.js", { scope: "./weather" }).catch(() => {});
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvt = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; offerInstall(); });
  function offerInstall() {
    const box = $("#install");
    if (!box) return;
    if (standalone || !S.place || store.get("wx:installSeen", false)) { box.hidden = true; return; }
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
    if (!installEvt && !ios) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<div class="dial"><img src="assets/weather/icon-180.png" alt="" width="56" height="56" style="border-radius:14px">
      <div><b>Keep this on your home screen</b><div class="say">${installEvt ? "It opens like an app and works with no signal." : "Tap the Share button, then “Add to Home Screen”. It opens like an app and works with no signal."}</div></div></div>
      <div style="display:flex;gap:8px;margin-top:10px">${installEvt ? `<button class="chip" type="button" id="doinstall">Add it</button>` : ""}<button class="chip" type="button" id="noinstall">Not now</button></div>`;
    $("#noinstall").onclick = () => { store.set("wx:installSeen", true); box.hidden = true; };
    if (installEvt) $("#doinstall").onclick = async () => { installEvt.prompt(); try { await installEvt.userChoice; } catch (e) {} store.set("wx:installSeen", true); box.hidden = true; };
  }

  /* ── start ──
     A chosen place, if this browser has one. Otherwise the whole country —
     and, once the Worker can say roughly where this visitor is from their
     connection, that city's weather, labelled as approximate. */
  /* Pro's workstation (workstation.js) reaches the map and the sounding
     through this, and nothing else of the page */
  if (PRO) window.WxPro = { map: radar.panel, sky, choose, tz: () => tzNow() || null, setTZ: (tz) => { if (PANEL && (tz == null || /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) && tz !== PANEL_TZ) { PANEL_TZ = tz || null; radar.relabel && radar.relabel(); } }, time: (ms) => clk().time(ms), day: (ms) => clk().day(ms), ymd: (ms) => clk().ymd(ms), get place() { return S.place ? { lat: S.place.lat, lon: S.place.lon, name: S.place.name } : null; } };
  if (PANEL) {
    /* a panel is only its map: the parent page holds the place, the
       warnings and every card */
    radar.start();
  } else {
    renderPlace();
    renderMeso();
    if (S.place) load();
    else {
      loadUS();
      Wx.near().then((p) => { if (p && !S.place) choose(p); });
    }
    /* on Weather Pro the map is the page: it starts now (already centred by the
       place or the country), not when it is scrolled to */
    if (PRO) radar.start();
  }
})();
