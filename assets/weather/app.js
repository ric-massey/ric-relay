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
  /* each page's own title, which a storm warning takes over and gives back */
  const TITLE = document.title;

  /* ── this browser's own memory (never sent anywhere) ── */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const cleanPlace = (p) => p && Wx.validLat(+p.lat) && Wx.validLon(+p.lon)
    ? { name: String(p.name || "A place").slice(0, 80), region: String(p.region || "").slice(0, 80), lat: Wx.round2(p.lat), lon: Wx.round2(p.lon), here: !!p.here, approx: !!p.approx }
    : null;

  /* The one state the whole page reads (DESIGN.md §6): a place — or none,
     which is the whole country — and a time. */
  const S = {
    place: cleanPlace(store.get("wx:place", null)),
    saved: (store.get("wx:saved", []) || []).map(cleanPlace).filter(Boolean).slice(0, 12),
    units: store.get("wx:units", "us") === "metric" ? "metric" : "us",
    fc: null, fcStale: false, pt: undefined, obs: undefined, office: undefined, alerts: undefined,
    state: undefined, national: undefined, outlook: undefined, ens: undefined, rec: undefined, verdict: null, fcShown: null,
    err: {}, checked: {}, selected: null, ctl: null, loadedAt: 0, fastAt: 0, focusedStorm: null
  };
  const placeKey = (p) => `${Wx.coord(p.lat)},${Wx.coord(p.lon)}`;
  const U = () => S.units;
  const deg = (c) => Wx.fmt.temp(c, U()) + "°";
  const clk = () => Wx.clock((S.fc && S.fc.tz) || (S.pt && S.pt.tz) || undefined);
  const nowSec = () => Math.floor(Date.now() / 1000);
  const dayFmtPage = (ms) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ms);
  const dist = (km) => U() === "us" ? `${Math.max(1, Math.round(km / 1.609344))} mi` : `${Math.max(1, Math.round(km))} km`;
  const speed = (kmh) => U() === "us" ? `${Math.round(kmh / 1.609344)} mph` : `${Math.round(kmh)} km/h`;
  const inUS = () => S.pt !== null;      // undefined while asking: assume yes

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
        ens: undefined, rec: undefined, verdict: null, fcShown: null, now: undefined, plumes: undefined, afd: undefined });
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
    await Promise.allSettled([fcJob, nwsJob, alertJob, ensJob, nowJob, loadOutlook(ctl.signal, live)]);
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
      .then((a) => { if (live()) { S.alerts = a; S.checked.alerts = Date.now(); render(); radar.draw(); stormFocus(); } })
      .catch((e) => { if (live()) { S.alerts = null; S.err.alerts = e; render(); } });
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
    $("#units").textContent = S.units === "us" ? "°F" : "°C";
    $("#usview").setAttribute("aria-pressed", String(!p));
  }

  const PLACE_CARDS = ["#next", "#afd", "#hourly", "#daily", "#models", "#record", "#sky", "#t-wind", "#t-humid", "#t-press", "#t-vis", "#t-uv", "#t-sun", "#t-rain"];
  function render() {
    renderPlace();
    const us = !S.place;
    for (const c of PLACE_CARDS) { const el = $(c); if (el) el.hidden = us || !S.fc; }   // each page holds only its own cards
    $("#national").hidden = !us;
    if (us) {
      $("#alerts").hidden = true; $("#nearby").hidden = true; $("#storms").hidden = true;
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
  function renderStorms() {
    const box = $("#storms");
    const list = stormsHere();
    document.body.classList.toggle("storming", list.length > 0);
    document.title = list.length ? `⚠ ${list[0].event} — ${PRO ? "/weather pro" : "/weather"}` : TITLE;
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const k = clk();
    box.innerHTML = list.map((a) => {
      const tr = a.motion ? Wx.stormTrack(a.motion, S.place.lat, S.place.lon) : null;
      const t = tr && trackLine(tr);
      const chips = [a.detection && (/observed/i.test(a.detection) ? "Tornado OBSERVED" : a.detection.toLowerCase().replace(/^./, (c) => c.toUpperCase())),
        a.threat && `${a.threat.toLowerCase()} damage threat`, a.hail && `Hail up to ${a.hail} in`, a.gust && `Gusts to ${a.gust} mph`, a.pds && "Particularly dangerous situation"].filter(Boolean);
      return `<section class="storm${a.emergency ? " emergency" : ""}" data-ev="${evOf(a)[0]}" aria-label="${esc(a.event)}">
        <div class="kicker">${a.emergency ? "Emergency · " : ""}You are inside this warning</div>
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
    if (c.from === "observation") {
      from = `<span>Observed at ${esc(S.obs.station)}${S.obs.dist != null ? " · " + Wx.fmt.dist(S.obs.dist, U()) + " " + Wx.UNITS[U()].dist + " away" : ""} · <b data-age="${c.time}">${Wx.age(Date.now() - c.time)}</b> ago</span>`;
    } else {
      from = `<span${S.fcStale ? ' class="delayed"' : ""}>${S.fcStale ? "Offline — saved forecast from " : `Model estimate · ${esc(S.fcShown ? shownName().replace(/^the /, "") : "Open-Meteo")} · `}<b data-age="${fc.fetchedAt}">${Wx.age(Date.now() - fc.fetchedAt)}</b> ago</span>`;
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
    const k = clk(), now = nowSec(), { v, span } = S.cmp, us = U() === "us";
    const end = now + span * 3600, start = now - (now % 3600);
    const conv = v === "t" ? (c) => us ? Wx.cToF(c) : c : v === "w" ? (x) => us ? x / 1.609344 : x : (mm) => us ? mm / 25.4 : mm;
    const unit = v === "t" ? (us ? "°F" : "°C") : v === "w" ? Wx.UNITS[U()].wind : Wx.UNITS[U()].precip;
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
    box.innerHTML = head + sections.map((s, i) => `<details class="afd"${i < 2 ? " open" : ""}><summary>${esc(titleCase0(s.name))}</summary><pre>${esc(s.body)}</pre></details>`).join("") +
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
  S.meso = Object.assign({ s: "19", f: "mlcp" }, store.get("wx:meso", {}));
  function renderMeso() {
    const box = $("#meso");
    if (!box) return;
    const m = S.meso, hour = Math.floor(Date.now() / 1800e3);
    const field = MESO_FIELDS.find((x) => x[0] === m.f) || MESO_FIELDS[2], sector = MESO_SECTORS.find((x) => x[0] === m.s) || MESO_SECTORS[0];
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
    if (!a || !a.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const k = clk();
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.id));
    box.innerHTML = `<h2>Official alerts<span class="src">National Weather Service</span></h2>` + a.map((x) => `
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
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5S3.5 7 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7 8 1.5 8 1.5z" fill="currentColor"/></svg>Next 3 hours<span class="src">${radarLine ? "radar, then " : ""}model ${hourly ? "hourly" : "every 15 min"}</span></h2>
      ${radarLine}
      ${radarLine ? `<div class="who">The models, 3 hours</div>` : ""}
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
    const g = h.gust != null && h.gust - h.wind >= 16 ? `<small>g${Wx.fmt.wind(h.gust, U())}</small>` : "";
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
    const nowTemp = Wx.currentConditions(fc, S.obs || null).temp.v;
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
        ${windCell(h)}
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
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l2.5 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Hourly<span class="src">tap an hour · wind in ${esc(Wx.UNITS[U()].wind)} · model</span></h2>
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
    box.innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.5"/></svg>${days.length}-day forecast<span class="src">model${periods.length ? " + NWS words" : ""}</span></h2>` +
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
      }).join("");
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
    const srcTag = (src) => src === "obs" ? `<span class="tag">station</span>` : src === "derived" ? `<span class="tag">computed</span>` : `<span class="tag">model</span>`;
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
      <div class="say">${tr ? `<b>${tr.word[0].toUpperCase() + tr.word.slice(1)}</b> over 3 hours (model)` : ""}</div>`;

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
      if (S.alerts) row("", `Alerts — ${S.alerts.length ? S.alerts.length + " active here" : "none here"}`, "National Weather Service · checked", S.checked.alerts);
      else row("off", "Alerts", S.alerts === undefined ? "asking…" : us ? "could not be checked" : "US only", null);
    }
    if (S.outlook) {
      const o = S.outlook[0];
      row("", "SPC convective outlook, day 1", `Storm Prediction Center${o && o.forecaster ? " · " + esc(o.forecaster) : ""} · issued`, o ? o.issued : S.checked.outlook);
    } else row("off", "SPC convective outlook", S.outlook === undefined ? "asking…" : "not answering", null);
    if (S.place && S.now) row("", "Radar nowcast — this site's own", "the last half hour of the IEM mosaic, carried forward in this browser · from the scan", S.now.valid);
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
      if (rv) row("", `Model map — ${esc(radar.describe())}`, radar.analysis ? "the HRRR analysis hour, NOAA open data on AWS · newest" : "a forecast, from the run's own files · run", rv);
      else row("off", "Model map", "asking NOAA for the latest run…", null);
    } else if (rv) {
      const f = Wx.fresh("radar", rv);
      row(f.stale ? "stale" : "", `Radar${f.stale ? " — delayed" : ""}`, `${esc(radar.describe())} · latest scan`, rv);
    } else row("off", "Radar", radar.started ? "scan time unknown" : "loads when you reach it", null);
    const pro = radar.pro;
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
    $("#sources").innerHTML = `<h2><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 13V9M6 13V6M10 13V3M14 13V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Where this comes from</h2><div class="feeds">${rows.join("")}</div>`;
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
      stations: PRO && store.get("wx:stations", true) !== false, obs: [],   // stations are Pro's
      /* Pro's overlays, each the visitor's own choice in this browser */
      ov: PRO ? Object.assign({ watches: true, cells: true, fronts: false, lightning: false, density: false, reports: true }, store.get("wx:ov", {})) : { watches: false, cells: false, fronts: false, lightning: false, density: false, reports: false },
      /* the flash density window, in minutes */
      densWin: [1, 5, 10, 20].includes(Number(store.get("wx:denswin", 5))) ? Number(store.get("wx:denswin", 5)) : 5,
      pro: { watches: [], mcds: [], mpds: [], cells: [], surface: null, reports: [] }, measure: null,
      /* Pro's own radar and model maps: the tilt (0 is the lowest scan) and the model field, each kept in this browser */
      tilt: Math.min(3, Math.max(0, Number(store.get("wx:tilt", 0)) || 0)),
      /* the full volume (Level II) instead of Level III, and its tilt by angle */
      mr: { prod: store.get("wx:mrms", "rot60") },
      /* GOES imagery (abi.js): the product, the sector, and the satellite (auto picks by the map's middle) */
      ab: { prod: store.get("wx:abi", "b13"), sector: store.get("wx:abisec", "conus"), sat: store.get("wx:abisat", "auto") },
      l2: store.get("wx:l2", false) === true, l2angle: Number(store.get("wx:l2angle", 0.5)), l2vol: null,
      mm: { src: store.get("wx:mmsrc", "hrrr"), field: store.get("wx:mmfield", "refc"), run: null } };
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

    function clearTiles() {
      for (const c of [baseTiles, ...sats.map((s) => s.tiles), ...R.frames.map((f) => f.tiles)]) { for (const img of c.values()) img.remove(); c.clear(); }
    }
    function setSat(kind) {
      R.sat = Wx.SAT[kind] ? kind : null;
      store.set("wx:sat", R.sat);
      for (const s of sats) for (const img of s.tiles.values()) img.remove();
      satL.innerHTML = ""; sats.length = 0;
      if (R.sat) for (const layer of Wx.SAT[R.sat].layers) {
        const d = document.createElement("div");
        d.className = "layer";
        satL.appendChild(d);
        sats.push({ el: d, layer, tiles: new Map() });
      }
      document.querySelectorAll("[data-sat]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.sat || null) === R.sat)));
      $("#satcredit").hidden = !R.sat;
      label(); draw(); renderSources();
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
    function stationsSoon() { clearTimeout(stnTimer); stnTimer = setTimeout(loadStations, 500); }
    async function loadStations() {
      if (!R.stations || !R.started || R.z < STN_MINZ) { if (R.obs.length) { R.obs = []; draw(); } label(); return; }
      const ask = ++stnAsk, w = el.clientWidth, h = el.clientHeight;
      const at = (fx, fy) => [yLat(R.cy + (fy - 0.5) * h, R.z), xLng(R.cx + (fx - 0.5) * w, R.z)];
      const pts = [at(0.5, 0.5), at(0.2, 0.2), at(0.8, 0.2), at(0.2, 0.8), at(0.8, 0.8)];
      const offices = [...new Set((await Promise.all(pts.map(([la, lo]) => officeOf(la, lo)))).filter(Boolean))].slice(0, 5);
      await Promise.all(offices.map(async (o) => {
        const have = byOffice.get(o);
        if (have && Date.now() - have.at < 300e3) return;
        try { byOffice.set(o, { at: Date.now(), list: await Wx.stationObs(o) }); } catch (e) { if (!have) byOffice.set(o, { at: Date.now() - 240e3, list: [] }); }
      }));
      if (ask !== stnAsk) return;
      const seen = new Map();
      for (const o of offices) for (const s of (byOffice.get(o) || { list: [] }).list) if (!seen.has(s.id) || seen.get(s.id).time < s.time) seen.set(s.id, s);
      R.obs = [...seen.values()];
      R.obsAt = Date.now();
      draw(); label(); renderSources();
    }
    /* ── Pro's overlays: SPC watches and discussions, WPC's, storm cells,
       and the surface analysis — each asked again on its own clock ── */
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
      framesL.innerHTML = "";
      if ($("#radarread")) $("#radarread").hidden = true;
      /* ECMWF's open data is CC BY 4.0: its credit shows whenever its fields are on the map */
      if ($("#eccredit")) $("#eccredit").hidden = !(R.mode === "model" && (R.mm.src === "ecmwf" || R.mm.src === "aifs"));
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
    const dayFmt = (ms) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ms);
    const timeFmt = (ms) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(ms);
    async function replay(from, hours, fitToStorms) {
      R.mode = "replay";
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
      if (!reduced && R.visible) play(true);
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
      R.mode = "replay";
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
      if (!reduced && R.visible) play(true);
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
    const X = { pick: false, a: null, b: null, data: null, hour: 0, view: "rh", busy: false, err: null, model: null };
    const xsecEl = $("#xsec");
    function xsecStart() {
      Object.assign(X, { pick: true, a: null, b: null, data: null, err: null });
      R.pin = null;
      $("#zxsec").setAttribute("aria-pressed", "true");
      note("Cross-section: tap where the line starts, then where it ends.");
      draw(); renderXsec();
    }
    function xsecStop() {
      Object.assign(X, { pick: false, a: null, b: null, data: null, err: null, busy: false });
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
    async function loadXsec() {
      X.busy = true; X.err = null; renderXsec();
      const model = Wx.inMosaic(X.a.lat, X.a.lon) && Wx.inMosaic(X.b.lat, X.b.lon) ? "hrrr" : "gfs";
      const ask = X.ask = {};
      try {
        const d = await Wx.xsec(model, X.a, X.b);
        if (X.ask !== ask) return;
        X.data = d; X.model = model;
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
      if (X.busy) { xsecEl.innerHTML = `<div class="xh"><span>Cross-section<small>Asking the model for twelve columns along the line…</small></span>${close}</div>`; return; }
      if (X.err || !X.data) { xsecEl.innerHTML = `<div class="xh"><span>Cross-section<small>${esc(X.err || "Nothing to draw.")}</small></span>${close}</div>`; return; }
      const d = X.data, t = d.times[X.hour] * 1000, k = clk(), m = Wx.MODELS[X.model];
      const seg = (v, l) => `<button type="button" data-xsv="${v}" aria-pressed="${X.view === v}">${l}</button>`;
      xsecEl.innerHTML = `<div class="xh"><span>Cross-section A → B · ${dist(d.km)} · ${esc(m.label)}<small>Valid ${esc(k.dayLong(t))}, ${esc(k.time(t))} — a forecast from the model's columns, not a measurement.</small></span>${close}</div>
        <div class="seg" role="group" aria-label="Shading">${seg("rh", "Moisture")}${seg("ws", "Wind")}</div>
        <div class="hourpick"><span class="num" style="min-width:52px">${esc(k.hour(t))}</span><input type="range" id="xshour" min="0" max="${d.times.length - 1}" step="1" value="${X.hour}" aria-label="Cross-section hour"><span class="dim num">+12 h</span></div>
        <canvas id="xscv" role="img" aria-label="Cross-section from A to B: ${X.view === "rh" ? "relative humidity" : "wind speed"} shaded, potential temperature in lines, the ground in brown"></canvas>
        <p class="nextnote">${X.view === "rh" ? "Shading: humidity — white where the air is near saturation (cloud likely), clear where it is dry." : "Shading: wind speed, knots — the jet stream shows as the bright core aloft."} Lines: potential temperature every 4 K; lines packed close are stable layers, wide gaps are well-mixed air. Brown is the ground. Twelve columns from Open-Meteo, joined.</p>`;
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
    function compFrames() {
      const b = bucket();
      setFrames(Wx.RADAR_STEPS.map((mins) => ({ t: R.valid ? R.valid - mins * 60e3 : null, mins,
        url: (z, x, y) => Wx.radarTile(mins, z, x, y, b) })));
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
      R.valid = scans[scans.length - 1].t;
      setFrames(scans.map((s) => ({ t: s.t, l3: { url: s.url, prod: mode.slice(3) } })));
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
        return L2.sweep(st, best.elevNum, q.mom);
      }
      const bufs = await Promise.all(q.urls.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error("HTTP " + r.status); return new Uint8Array(await r.arrayBuffer()); }));
      let st = null;
      for (const b of bufs) st = L2.feed(b, st);
      const sw = L2.sweep(st, q.elevNum, q.mom);
      if (!sw) throw new Error("no " + q.mom + " in this cut");
      return sw;
    }
    function l3File(f) {
      const x = f.l3;
      if (!x.p) x.p = (x.l2 ? cached(x.l2.key, () => loadL2(x.l2)) : cached(x.url, () => NX.load(x.url))).then((file) => {
        x.file = file; x.colors = NX.colorTable(file, x.prod);
        if (R.frames[R.frame] === f) { draw(); show(R.frame); tilts(); }
        return file;
      }).catch((e) => { x.err = true; if (R.frames[R.frame] === f) note(x.l2 && x.l2.archive ? `This volume did not load (${String(e.message || e)}).` : "This scan did not load — the next one may."); });
      return x.p;
    }
    function frameCanvas(f, w, h) {
      if (!f.cv) { f.cv = document.createElement("canvas"); f.cv.className = "hrrr"; f.el.appendChild(f.cv); }
      if (f.cv.width !== w || f.cv.height !== h) { f.cv.width = w; f.cv.height = h; f.cv.style.width = w + "px"; f.cv.style.height = h + "px"; f.painted = null; }
      return f.cv;
    }
    function paintL3(f, w, h, left, top) {
      const cv = frameCanvas(f, w, h), ctx = cv.getContext("2d"), key = `${R.z}|${left}|${top}`;
      if (!f.l3.file) { l3File(f); if (f.painted) { ctx.clearRect(0, 0, w, h); f.painted = null; } return; }
      if (f.painted === key) return;
      f.painted = key;
      const F = f.l3.file, col = f.l3.colors, img = ctx.createImageData(w, h), px = new Uint32Array(img.data.buffer);
      const azi = NX.azIndex(F), gk = F.gateKm, nb = F.nBins, data = F.data, g0 = NX.gateStart(F), rmax = g0 + nb * gk;
      const lat0 = F.lat, lon0 = F.lon, rad = Math.PI / 180;
      const sx = lngX(lon0, R.z) - left, sy = latY(lat0, R.z) - top;
      const pxPerKm = lngX(lon0 + 1 / (111.32 * Math.cos(lat0 * rad)), R.z) - lngX(lon0, R.z), rpx = rmax * pxPerKm * 1.1 + 2;
      const x0 = Math.max(0, Math.floor(sx - rpx)), x1 = Math.min(w, Math.ceil(sx + rpx)), y0 = Math.max(0, Math.floor(sy - rpx)), y1 = Math.min(h, Math.ceil(sy + rpx));
      const dlon = new Float64Array(w);
      for (let x = x0; x < x1; x++) dlon[x] = xLng(left + x + 0.5, R.z) - lon0;
      for (let y = y0; y < y1; y++) {
        const lat = yLat(top + y + 0.5, R.z), dy = (lat - lat0) * 110.574, kx = 111.32 * Math.cos((lat + lat0) / 2 * rad), row = y * w;
        for (let x = x0; x < x1; x++) {
          const dx = dlon[x] * kx, r = Math.sqrt(dx * dx + dy * dy);
          if (r >= rmax || r < g0) continue;
          let a = Math.atan2(dx, dy) * 572.9577951308232;              // tenths of a degree, clockwise from north
          if (a < 0) a += 3600;
          const c = col[data[azi[a | 0] * nb + (((r - g0) / gk) | 0)]];
          if (c) px[row + x] = c;
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
      const meta = have && have.sKey === S.key ? have.meta : L2.feed(new Uint8Array(await (await fetch(S.url)).arrayBuffer()));
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
      row.hidden = !P || (P.tilts.length < 2 && !P.l2);
      if (row.hidden) return;
      const f = R.frames[R.frame], el0 = f && f.l3 && f.l3.file ? f.l3.file.elev : null, b = [];
      if (useL2()) {
        for (const a of R.l2angles || []) b.push(`<button type="button" data-angle="${a}" aria-pressed="${Math.abs(a - R.l2angle) < 0.15}">${a.toFixed(1)}°</button>`);
        if (!(R.l2angles || []).length) b.push(`<span class="seglab">reading the volume…</span>`);
      } else {
        P.tilts.forEach((_, k) => { const on = k === Math.min(R.tilt, P.tilts.length - 1); b.push(`<button type="button" data-tilt="${k}" aria-pressed="${on}">${on && el0 != null ? el0.toFixed(1) + "°" : ["Lowest", "2nd", "3rd", "4th"][k]}</button>`); });
      }
      if (P.l2 && P.tilts.length) b.push(`<button type="button" data-l2toggle aria-pressed="${useL2()}" title="Every tilt the radar scans, at full resolution, seconds after the sweep — about 1 MB a frame">Full volume</button>`);
      row.innerHTML = `<span class="seglab">Tilt</span>${b.join("")}`;
    }

    /* ── model maps (modelmaps.js) ──
       Frames are the run's forecast hours; each loads its field when shown
       (or when the loop plays) and is painted from the model's own grid:
       shading, then contours and wind barbs on top. */
    async function modelFrames() {
      const M = R.mm, src = M.src, ask = R.modeAsk;
      $("#mmrun").textContent = "Finding the latest run…";
      /* the mesoanalysis is a run of analysis hours, not one run's forecast */
      if (MM.SOURCES[src].analysis) {
        let runs = [];
        try { runs = await MM.analyses(src); } catch (e) {}
        if (R.mode !== "model" || M.src !== src || ask !== R.modeAsk) return;
        if (!runs.length) { setFrames([]); $("#mmrun").textContent = ""; note("NOAA's HRRR archive did not answer. Try again in a minute."); return; }
        M.run = runs[runs.length - 1]; R.valid = M.run;
        setFrames(runs.map((run) => ({ t: run, model: { src, field: M.field, run, fh: 0 } })));
        show(R.frames.length - 1);
        modelRunText(); legend(); renderSources();
        return;
      }
      let run = null;
      try { run = await MM.latestRun(src); } catch (e) {}
      if (R.mode !== "model" || M.src !== src || ask !== R.modeAsk) return;
      if (!run) { setFrames([]); $("#mmrun").textContent = ""; note(`NOAA's ${MM.SOURCES[src].label} archive did not answer. Try again in a minute.`); return; }
      M.run = run.run; R.valid = run.run;
      setFrames(run.hours.map((fh) => ({ t: run.run + fh * 3600e3, model: { src, field: M.field, run: run.run, fh } })));
      let best = 0;
      R.frames.forEach((f, i) => { if (Math.abs(f.t - Date.now()) < Math.abs(R.frames[best].t - Date.now())) best = i; });
      show(best);
      modelRunText(); legend(); renderSources();
    }
    function modelRunText() {
      const M = R.mm, el = $("#mmrun");
      if (!el) return;
      el.textContent = !M.run ? "" : MM.SOURCES[M.src].analysis
        ? `HRRR analysis hours, the last ${R.frames.length} · newest ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)} · the model's picture of now, observations folded in — not a forecast`
        : `${MM.SOURCES[M.src].label} run ${new Date(M.run).toISOString().slice(11, 13)}Z ${dayFmt(M.run)} · ${R.frames.length} hours out so far · a forecast`;
    }
    function modelLayer(f) {
      const m = f.model;
      if (!m.p) m.p = MM.load(m.src, m.run, m.fh, m.field).then((L) => {
        m.layer = L; m.lut = MM.table(L.field.pal);
        if (R.frames[R.frame] === f) { draw(); show(R.frame); }
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
        m.layer = L; m.lut = MM.table(L.field.pal);
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
        ctx.font = "600 11px ui-monospace,Menlo,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
      if (LTG.dens && LTG.dens.windowMs === R.densWin * 60e3) return LTG.dens;
      const th = ltgThrough();
      if (!th) return null;
      LTG.dens = GL.density(LTG.flashes, { nowMs: th.to, windowMs: R.densWin * 60e3 });
      LTG.dens.short = th.to - th.from < R.densWin * 60e3 - 30e3;              // the window reaches back before the first file read
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
    function drawLightning() {
      if (!ltgCv) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (ltgCv.width !== w || ltgCv.height !== h) { ltgCv.width = w; ltgCv.height = h; }
      const ctx = ltgCv.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      if (!ltgOn() || R.mode === "replay" || !LTG.flashes.length) return;
      const left = R.cx - w / 2, top = R.cy - h / 2, now = Date.now(), r = R.z >= 7 ? 2.6 : 1.8;
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
        const a = now - f.t, k = a <= 60e3 ? 0 : a <= 120e3 ? 1 : a <= 300e3 ? 2 : a <= 600e3 ? 3 : -1;
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
    function readoutAt(lat, lon) {
      const a = readoutFrame(lat, lon);
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
        const dy = (lat - F.lat) * 110.574, dx = (lon - F.lon) * 111.32 * Math.cos((lat + F.lat) / 2 * Math.PI / 180), km = Math.hypot(dx, dy);
        const az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360, v = NX.valueAt(F, f.l3.prod, km, az);
        if (km > F.nBins * F.gateKm) return null;
        const beam = NX.beamHeightKm(km, F.elev) + F.heightM / 1000;
        const what = !v ? "no echo" : v.rf ? "range folded" : v.cls ? `${v.cls[1]} (${v.cls[0]})`
          : `${P.short} ${f.l3.prod === "cc" ? v.value.toFixed(2) : f.l3.prod === "zdr" || f.l3.prod === "kdp" ? v.value.toFixed(1) : Math.round(v.value)}${P.unit ? " " + P.unit : ""}${v.topped ? " (topped)" : ""}`;
        /* the beam's centre above sea level: the radar's own height plus the beam's rise */
        return `${what} · ${dist(km)} ${Math.round(az)}° from ${F.site || "the radar"} · beam ${U() === "us" ? Math.round(beam * 3.28084) + " kft" : beam.toFixed(1) + " km"} MSL`;
      }
      if (f.abi && f.abi.layer) {
        const vs = AB.valuesAt(f.abi.layer, lat, lon);
        if (!vs) return null;
        const say = (x) => x.kind === "refl" ? `${Math.round(x.value)}%` : `${U() === "us" ? Math.round(x.value * 9 / 5 + 32) + " °F" : Math.round(x.value) + " °C"}`;
        return vs.length === 1 ? `${AB.bandName(vs[0].band)}: ${say(vs[0])} ${vs[0].kind === "refl" ? "reflectance" : "brightness temperature"}` : vs.map((x) => `B${x.band} ${say(x)}`).join(" · ");
      }
      if (f.mrms && f.mrms.layer) {
        const L = f.mrms.layer, v = MM.valueAt(L, lat, lon);
        return Number.isFinite(v) ? `${L.field.label}: ${MM.say(L.field.unit, v, U())} · MRMS ${clk().time(f.t)}` : null;
      }
      if (f.model && f.model.layer) {
        const L = f.model.layer, v = MM.valueAt(L, lat, lon);
        if (!Number.isFinite(v)) return null;
        if (L.field.pal === "ptype") { const t = MM.PAL.ptype.types[Math.floor(v / 100)]; return `${t ? t[0] : "Precipitation"} · ${Math.round(v % 100)} dBZ · ${MM.SOURCES[f.model.src].label} +${f.model.fh} h`; }
        return `${L.field.label}: ${MM.say(L.field.unit, v, U())} · ${MM.SOURCES[f.model.src].analysis ? `HRRR analysis ${new Date(f.t).toISOString().slice(11, 13)}Z` : `${MM.SOURCES[f.model.src].label} +${f.model.fh} h`}`;
      }
      return null;
    }

    function place(layer, cache, url, w, h, left, top) {
      const n = 2 ** R.z, seen = new Set();
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
        for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
          if (ty < 0 || ty >= n) continue;
          const wx = ((tx % n) + n) % n;
          const key = `${R.z}/${tx}/${ty}`;
          seen.add(key);
          let img = cache.get(key);
          if (!img) {
            img = new Image(); img.alt = ""; img.decoding = "async"; img.draggable = false;
            /* one tile failing never blanks the layer (§35.5): it hides, and is
               asked once more a few seconds later */
            const src = url(R.z, wx, ty);
            img.onerror = () => {
              img.style.visibility = "hidden";
              if (img.dataset.retried) return;
              img.dataset.retried = "1";
              setTimeout(() => { if (img.isConnected) { img.style.visibility = ""; img.src = src + (src.includes("?") ? "&" : "?") + "r=1"; } }, 4000);
            };
            img.src = src;
            cache.set(key, img); layer.appendChild(img);
          }
          img.style.transform = `translate(${tx * TILE - left}px,${ty * TILE - top}px)`;
        }
      }
      for (const [key, img] of cache) if (!seen.has(key)) { img.remove(); cache.delete(key); }
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
        R.drawn = [];
        over.innerHTML = out.join("");
        return;
      }
      if (R.outlook && S.outlook) {
        for (const o of S.outlook.slice().sort((a, b) => a.rank - b.rank)) {
          const d = o.polys.map((poly) => poly.map((r) => "M" + ring(r).replace(/ /g, " L")).join(" ") + " Z").join(" ");
          out.push(`<path d="${d}" fill="${esc(o.fill || "#888")}" fill-opacity=".28" fill-rule="evenodd" stroke="${esc(o.stroke || "#888")}" stroke-width="1.6"/>`);
        }
      }
      const W0 = el.clientWidth, H0 = el.clientHeight;
      const off = ([x, y], m = 40) => x < -m || y < -m || x > W0 + m || y > H0 + m;
      const pathOf = (polys) => polys.map((poly) => poly.map((r) => "M" + ring(r).replace(/ /g, " L") + " Z").join(" ")).join(" ");
      const centre = (poly) => { const r = poly[0], n = r.length - 1 || 1; let a = 0, b = 0; for (let i = 0; i < n; i++) { a += r[i][1]; b += r[i][0]; } return pt(a / n, b / n); };
      const tag = (x, y, text, col) => `<text class="ovl" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" fill="${col}">${esc(text)}</text>`;
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
          out.push(`<path d="${pathOf(w.polys)}" fill="${col}" fill-opacity=".07" fill-rule="evenodd" stroke="${col}" stroke-width="2.4"/>${tag(cx, cy, `${w.type} ${w.num}`, col)}`);
        }
        for (const d of [...R.pro.mcds, ...R.pro.mpds]) {
          const col = d.kind === "mcd" ? "#74c0fc" : "#8ce99a", [cx, cy] = centre(d.polys[0]);
          out.push(`<path d="${pathOf(d.polys)}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="7 4"/>${tag(cx, cy + 14, `${d.kind === "mcd" ? "MD" : "MPD"} ${d.num}${d.chance != null ? " · " + d.chance + "%" : ""}`, col)}`);
        }
      }
      const warns = [...(S.place ? (S.alerts || []) : []), ...(S.place ? (S.state || []) : (S.national || []))];
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
          const k = Wx.LSR_KINDS[r.kind], hrs = (now - r.time) / 3600e3, op = hrs < 1 ? 1 : hrs < 6 ? 0.85 : 0.6, rr = r.severe ? 8 : 6.5;
          out.push(`<g class="lsr" opacity="${op}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr}" fill="${k.color}" stroke="#05070a" stroke-width="1.5"/><text x="${x.toFixed(1)}" y="${(y + 3.6).toFixed(1)}" text-anchor="middle">${esc(k.glyph)}</text></g>`);
        }
      }
      /* stations: a dot, a tail from where the wind comes, and the
         temperature on a chip of its own colour — newest first, and none
         drawn on top of another. From zoom 8 on Pro, the full station
         model: sky cover, a wind barb in knots, temperature, dew point,
         present weather and pressure, as on any surface chart */
      R.drawn = [];
      if (R.stations && R.z >= STN_MINZ && R.obs.length) {
        const w = el.clientWidth, h = el.clientHeight, placed = [], zb = zoomBottom();
        const model = PRO && R.z >= 8, bx = model ? 74 : 40, by = model ? 50 : 26;
        for (const s of R.obs.slice().sort((a, b) => b.time - a.time)) {
          const [x, y] = pt(s.lat, s.lon);
          if (x < -20 || y < -20 || x > w + 20 || y > h + 20 || placed.some(([a, b]) => Math.abs(a - x) < bx && Math.abs(b - y) < by) || (x > w - 110 && y < zb)) continue;  // nor under the zoom buttons
          placed.push([x, y]); R.drawn.push(s);
          if (model) { out.push(`<g class="stn stp">${stationModel(s, x, y)}</g>`); continue; }
          let g = "";
          if (s.wind != null && !Wx.isCalm(s.wind) && s.windDir != null) {
            const r = s.windDir * Math.PI / 180, L = Math.min(26, 8 + s.wind * 0.45);
            g += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.sin(r) * L).toFixed(1)}" y2="${(y - Math.cos(r) * L).toFixed(1)}" stroke="#0b1422" stroke-width="4" stroke-linecap="round"/><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + Math.sin(r) * L).toFixed(1)}" y2="${(y - Math.cos(r) * L).toFixed(1)}" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`;
          }
          g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="#fff" stroke="#0b1422" stroke-width="1.5"/>`;
          if (s.temp != null) {
            const txt = Wx.fmt.temp(s.temp, U()) + "°", cw = 10 + txt.length * 7.2;
            g += `<rect x="${(x + 5).toFixed(1)}" y="${(y - 20).toFixed(1)}" width="${cw.toFixed(1)}" height="17" rx="8.5" fill="${tempColor(s.temp)}" stroke="#0b1422" stroke-width="1"/><text x="${(x + 5 + cw / 2).toFixed(1)}" y="${(y - 7.5).toFixed(1)}" text-anchor="middle">${txt}</text>`;
          }
          out.push(`<g class="stn">${g}</g>`);
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
        if (P.length > 1) out.push(`<polyline points="${P.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="#05070a" stroke-width="5"/><polyline points="${P.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="#ffb627" stroke-width="2.4"/>`);
        R.measure.pts.forEach((q, i) => {
          out.push(`<circle cx="${P[i][0].toFixed(1)}" cy="${P[i][1].toFixed(1)}" r="4.5" fill="#ffb627" stroke="#05070a" stroke-width="1.5"/>`);
          if (i) { const a = R.measure.pts[i - 1], km = Wx.distanceM(a.lat, a.lon, q.lat, q.lon) / 1000;
            out.push(`<text class="ovl" x="${((P[i - 1][0] + P[i][0]) / 2).toFixed(1)}" y="${((P[i - 1][1] + P[i][1]) / 2 - 6).toFixed(1)}" text-anchor="middle" fill="#ffb627">${esc(dist(km))}</text>`); }
        });
      }
      if (R.pin) {
        const [qx, qy] = pt(R.pin.lat, R.pin.lon);
        out.push(`<circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="7" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="${qx.toFixed(1)}" cy="${qy.toFixed(1)}" r="2.5" fill="#fff"/>`);
      }
      if (S.place) {
        const [mx, my] = pt(S.place.lat, S.place.lon);
        out.push(`<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" fill="rgba(255,255,255,.25)"/><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#fff" stroke="#0b2342" stroke-width="2"/>`);
      }
      over.innerHTML = out.join("");
    }

    function draw() {
      if (!R.started) return;
      const w = el.clientWidth, h = el.clientHeight;
      const left = R.cx - w / 2, top = R.cy - h / 2;
      place(baseL, baseTiles, (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`, w, h, left, top);
      for (const s of sats) place(s.el, s.tiles, (z, x, y) => Wx.satTile(s.layer, z, x, y, satAt), w, h, left, top);
      R.frames.forEach((f, i) => {
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
        else if (f.archive ? i === R.frame || i === R.frame + 1 : i === R.frame || R.loadedOld) place(f.el, f.tiles, f.url, w, h, left, top);
      });
      overlay(left, top);
      drawLightning();
      placePin();
    }

    function note(text) {
      const n = $("#radarnote");
      n.hidden = !text; n.textContent = text || "";
    }
    function show(i) {
      R.frame = i;
      R.frames.forEach((f, j) => f.el.classList.toggle("on", j === i));
      if (!R.frames[i]) { $("#when").innerHTML = ""; return; }
      const f = R.frames[i];
      if (!R.loadedOld || f.future || f.archive || (f.l3 && f.l3.l2 && f.l3.l2.archive)) draw();   // a replay's warnings change by the minute, and its next frame loads now
      $("#scrub").value = String(i);
      const when = $("#when");
      if (f.archive) when.innerHTML = `${esc(dayFmt(f.t))}<small>${esc(timeFmt(f.t))}</small>`;
      else if (f.mrms) when.innerHTML = `${esc(clk().time(f.t))}<small>MRMS · ${Wx.age(Date.now() - f.t)} ago${f.mrms.layer ? "" : f.mrms.err ? " · failed" : " · loading"}</small>`;
      else if (f.abi) when.innerHTML = `${esc(clk().time(f.t))}<small>${f.abi.file.sat === "east" ? "GOES-East" : "GOES-West"} · ${Wx.age(Date.now() - f.t)} ago${f.abi.layer ? "" : f.abi.err ? " · failed" : " · loading"}</small>`;
      else if (f.model) {
        const k = clk(), day = k.ymd(f.t) !== k.ymd(Date.now()) ? k.day(f.t) + " " : "";
        when.innerHTML = `${esc(day + k.time(f.t))}<small>${esc(MM.SOURCES[f.model.src].label)}${MM.SOURCES[f.model.src].analysis ? " · " + Wx.age(Date.now() - f.t) + " ago" : ` +${f.model.fh} h`}${f.model.layer ? "" : f.model.err ? " · failed" : " · loading"}</small>`;
      } else if (f.l3) {
        const F = f.l3.file;
        const t = F ? F.time : f.t, arch = f.l3.l2 && f.l3.l2.archive;
        /* an archived volume says its date, as the mosaic's replay does; a live scan its age */
        when.innerHTML = arch ? `${esc(timeFmt(t))}<small>${esc(dayFmt(t))}${F ? ` · ${F.elev.toFixed(1)}°` : f.l3.err ? " · failed" : " · loading"}</small>`
          : `${esc(clk().time(t))}<small>${Wx.age(Date.now() - t)} ago${F ? ` · ${F.elev.toFixed(1)}°` : " · loading"}</small>`;
      } else if (f.future && f.t) {
        const k = clk(), d = f.t - Date.now(), day = k.ymd(f.t) !== k.ymd(Date.now()) ? k.day(f.t) + " " : "";
        when.innerHTML = `${esc(day + k.time(f.t))}<small>forecast · ${Math.abs(d) < 8 * 60e3 ? "now" : d > 0 ? "in " + Wx.age(d) : Wx.age(-d) + " ago"}</small>`;
      } else if (f.t) when.innerHTML = `${esc(clk().time(f.t))}<small>${Wx.age(Date.now() - f.t)} ago</small>`;
      else when.innerHTML = f.mins ? `−${f.mins} min<small>before latest</small>` : `Latest<small>scan time unknown</small>`;
      const fr = R.valid && !f.future && !f.model && !f.mrms && !f.abi ? Wx.fresh("radar", R.valid) : null;
      if (f.model && f.model.err) note(`This hour did not load (${f.model.err}).`);
      else if (f.mrms && f.mrms.err) note(`This MRMS file did not load (${f.mrms.err}).`);
      else if (f.abi && f.abi.err) note(`This GOES image did not load (${f.abi.err}).`);
      else if (f.model || f.mrms || f.abi) note("");
      else if (f.future && R.valid && Date.now() - R.valid > 3 * 3600e3) note(`This HRRR run is ${Wx.age(Date.now() - R.valid)} old — a newer one is late.`);
      else if (fr && fr.stale) note(`Radar delayed — the latest scan is ${fr.age} old.`);
      else if (S.place && S.pt === null && R.mode === "comp") note("This radar covers the lower 48 US states only.");
      else if (R.frames.length) note("");
    }
    function loadOld() { if (!R.loadedOld) { R.loadedOld = true; draw(); } }
    function play(on) {
      R.playing = on;
      clearTimeout(R.timer);
      $("#play").innerHTML = on
        ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="#fff"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="#fff"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="#fff"/></svg>';
      $("#play").setAttribute("aria-label", on ? "Pause radar loop" : "Play radar loop");
      if (!on || R.frames.length < 2) return;
      loadOld();
      const last = R.frames.length - 1;
      const step = () => {
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
        show(next);
        R.timer = setTimeout(step, next === last ? 1600 : 450);
      };
      R.timer = setTimeout(step, R.frame === last ? 600 : 450);
    }

    /* the nearest NEXRAD to the middle of the map */
    async function pickSite(force) {
      const lat = yLat(R.cy, R.z), lon = xLng(R.cx, R.z);
      if (!force && R.site && R.site.lat != null && Wx.distanceM(lat, lon, R.site.lat, R.site.lon) < 120e3) return false;
      try {
        const sites = await Wx.radarSites(Wx.round2(lat), Wx.round2(lon));
        if (!sites.length) return false;
        const s = sites[0];
        if (R.site && R.site.id === s.id) return false;
        R.site = s;
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
      if (R.replay) { R.replay = null; satL.hidden = false; $("#rplive").hidden = true; }
      R.mode = mode;
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
        const v = await Wx.radarTime();
        if (ask !== R.modeAsk) return;
        R.valid = v;
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
      label(); renderSources();
    }

    /* the colour key under the map, in the visitor's units */
    function legend() {
      const lg = $("#legend");
      if (!lg) return;
      /* a radar's replay keys its own product */
      const P = l3() || (R.mode === "replay" && R.replay && R.replay.prodMode ? l3(R.replay.prodMode) : null);
      lg.classList.remove("vel", "scale", "cats");
      if (R.mode === "abi" && AB) {
        const K = AB.key(R.ab.prod);
        if (!K || K.text) { lg.innerHTML = `<span>${esc(K ? K.text : "")}</span>`; return; }
        if (K.cats) { lg.classList.add("cats"); lg.innerHTML = K.cats.map(([n, c]) => `<span class="sw"><i style="background:${c}"></i>${esc(n)}</span>`).join(""); return; }
        const pos = (v) => (v - K.min) / (K.max - K.min) * 100, us = U() === "us" && K.unit === "°C";
        lg.classList.add("scale");
        lg.innerHTML = `<div class="bar"><i aria-hidden="true" style="background:linear-gradient(90deg,${K.stops.map(([v, c]) => `${c} ${pos(v).toFixed(1)}%`).join(",")})"></i><div class="ticks">${K.ticks.map((t) => `<span style="left:${pos(t).toFixed(1)}%">${us ? Math.round(t * 9 / 5 + 32) : t}</span>`).join("")}</div></div><span class="lu">${us ? "°F" : esc(K.unit)}</span>`;
        return;
      }
      if (R.mode === "N0S") { lg.classList.add("vel"); lg.innerHTML = `<span>toward</span><i aria-hidden="true"></i><span>away</span>`; return; }
      let pal = null, unit = "", fmt = (v) => String(v), cats = null;
      if (P) {
        pal = NX.PALETTES[P.pal]; unit = P.unit;
        if (pal.classes) cats = Object.entries(pal.classes).filter(([k]) => k !== "2").map(([k, c]) => [NX.HCA_CLASSES[k][1], c]);
      } else if ((R.mode === "model" || R.mode === "mrms") && MM) {
        const f = R.mode === "mrms" ? MR.PRODUCTS[R.mr.prod] : MM.field(R.mm.src, R.mm.field);
        pal = MM.PAL[f.pal];
        if (pal.cat) cats = Object.values(pal.types).map(([name, , hi]) => [name, hi]);
        else {
          const [name, conv] = MM.UNIT[f.unit][U() === "metric" ? "metric" : "us"];
          unit = name;
          fmt = (v) => { const x = conv(v); return Math.abs(x) >= 10 || Number.isInteger(x) ? String(Math.round(x)) : x.toFixed(Math.abs(x) < 1 ? 2 : 1); };
        }
      }
      if (cats) { lg.classList.add("cats"); lg.innerHTML = cats.map(([n, c]) => `<span class="sw"><i style="background:${c}"></i>${esc(n)}</span>`).join(""); return; }
      if (!pal) { lg.innerHTML = `<span>light</span><i aria-hidden="true"></i><span>heavy</span>`; return; }
      const st = pal.stops, lo = pal.min ?? st[0][0], hi = pal.max ?? st[st.length - 1][0];
      const pos = (v) => Math.max(0, Math.min(1, pal.log ? (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (v - lo) / (hi - lo)));
      const grad = st.map(([v, c]) => `${c} ${(pos(v) * 100).toFixed(1)}%`).join(",");
      lg.classList.add("scale");
      lg.innerHTML = `<div class="bar"><i aria-hidden="true" style="background:linear-gradient(90deg,${grad})"></i><div class="ticks">${(pal.ticks || []).map((t) => `<span style="left:${(pos(t) * 100).toFixed(1)}%">${esc(fmt(t))}</span>`).join("")}</div></div><span class="lu">${esc(unit)}</span>`;
    }
    function label() {
      legend();
      const sb = $("#sitebar");
      if (R.mode === "comp") sb.textContent = "NEXRAD mosaic of the whole country, every 5 minutes.";
      else if (R.mode === "replay" && R.replay && R.replay.prodMode) { const rp = R.replay, P = l3(rp.prodMode), n = rp.warn ? new Set(rp.warn.map((w) => w.sig + w.wfo + w.event + w.area)).size : null; sb.textContent = `Replay: ${rp.site ? rp.site + "'s own" : "the nearest radar's"} full volume (Level II), ${lc(P.label)} at the lowest tilt, ${dayFmt(rp.from)} ${timeFmt(rp.from)} to ${timeFmt(rp.to)}${rp.vols ? `, ${rp.vols.length} volumes` : " — finding the radar's volumes"}, with each storm warning drawn for the minutes it was in force${rp.warn ? ` (${n} warning${n === 1 ? "" : "s"})` : ""}. The product buttons change what is shown; NOAA's archive on AWS.`; }
      else if (R.mode === "replay" && R.replay) { const rp = R.replay, n = rp.warn ? new Set(rp.warn.map((w) => w.sig + w.wfo + w.event + w.area)).size : null; sb.textContent = `Replay: the national radar as it was, ${dayFmt(rp.from)} ${timeFmt(rp.from)} to ${timeFmt(rp.to)}, every ${rp.step} minutes, with each storm warning drawn for the minutes it was in force${rp.warn ? ` (${n} warning${n === 1 ? "" : "s"})` : rp.err ? " — the warnings archive did not answer" : " — loading the warnings"}. Archive via IEM.`; }
      else if (R.mode === "hrrr") sb.textContent = `A forecast, not radar: the HRRR model's own picture of the rain${R.valid ? ` from its ${new Date(R.valid).toISOString().slice(11, 13)}Z run` : ""}, every 15 minutes for the first hour then hourly to 18 hours. Lower 48 only.`;
      else if (R.mode === "abi" && AB) { const P = AB.PRODUCTS[R.ab.prod]; sb.textContent = `${AB.SATS[abiSat()].label} — ${P.group === "Single bands" ? P.label : P.label + " RGB"}, ${lc(AB.SECTORS[R.ab.sector].label)}, read from NOAA's own files. Hover or tap for each band's value.${/\(day\)/.test(P.label) ? " Dark at night: it is made from sunlight." : ""}`; }
      else if (R.mode === "mrms" && MR) sb.textContent = `MRMS — every NEXRAD blended by NOAA, with the model's temperatures and the rain gauges: ${lc(MR.PRODUCTS[R.mr.prod].label)}. Measured from radar, not a forecast. Hover or tap for the value.`;
      else if (R.mode === "model" && MM && MM.SOURCES[R.mm.src].analysis) { const f = MM.field(R.mm.src, R.mm.field); sb.textContent = `Mesoanalysis — the HRRR model's analysis hour: its picture of now, with the latest observations folded in. Not a forecast, and not SPC's own (that is the SPC mesoanalysis card below). ${f.label}. The slider steps through the last six hours; hover or tap for the value.`; }
      else if (R.mode === "model" && MM) { const f = MM.field(R.mm.src, R.mm.field); sb.textContent = `A forecast, not an observation — ${MM.SOURCES[R.mm.src].long}. ${f.label}${R.mm.run ? `, from the ${new Date(R.mm.run).toISOString().slice(11, 13)}Z run` : ""}. The slider is the forecast hour; hover or tap for the value.`; }
      else if (l3() && R.site) { const f = R.frames[R.frame], F = f && f.l3 && f.l3.file; sb.textContent = `${R.site.id} · ${R.site.name} · ${l3().long}${F ? ` · ${F.elev.toFixed(1)}° scan` : ""}. ${useL2() ? "The full volume (Level II), every tilt at full resolution, refreshed every 30 seconds" : "Read from the radar's own Level III files"}; the site follows the middle of the map. Hover or tap for the value.`; }
      else if (l3()) sb.textContent = "Finding the nearest radar…";
      else if (R.site) sb.textContent = `${R.site.id} · ${R.site.name} · ${Wx.SITE_PRODUCTS[R.mode].long}. The site follows the middle of the map.`;
      else sb.textContent = "Finding the nearest radar…";
      if (PRO && R.ov.cells && R.started && R.mode !== "replay" && R.z < 6) sb.textContent += " Zoom in to see storm cells.";
      if (R.stations && R.started && R.mode !== "replay") sb.textContent += R.z < STN_MINZ ? " Zoom in to see the airport stations." : R.obs.length ? " Tap a station for its full reading." : "";
      if (ltgOn() && R.started && R.mode !== "replay") {
        const n10 = LTG.flashes.filter((x) => x.t >= Date.now() - 10 * 60e3).length, D = R.ov.density && LTG.at ? ltgDensity() : null;
        sb.textContent += LTG.failed ? " Lightning: GOES did not answer."
          : !LTG.at ? " Lightning: loading the last 20 minutes…"
          : (R.ov.lightning ? ` Lightning: ${n10.toLocaleString()} flashes in the last 10 minutes, newest brightest.` : "")
            + (D ? ` Flash density: flashes in each 8 km square over the ${R.densWin === 1 ? "last minute" : `last ${R.densWin} minutes`}${D.short ? " (still filling in)" : ""}, most ${D.max}.` : "");
        if (R.ov.cells && R.z >= 6) sb.textContent += " Tap a storm cell for its flash rate.";
      }
      if (PRO && R.ov.reports && R.started && R.mode !== "replay" && R.pro.rGot) { const n = R.pro.reports.filter((r) => r.severe).length; sb.textContent += ` Storm reports: ${n} severe in the last 24 hours${R.z < 7 ? " (zoom in for rain, snow and the rest)" : ""} — tap one for who reported it.`; }
      if (R.sat && R.mode !== "replay") {
        const night = R.sat === "vis" && S.fc && S.fc.current && S.fc.current.isDay === false;
        sb.textContent += ` Under it: ${Wx.SAT[R.sat].long}${night ? " It is night here, so this part of the map is dark — try Infrared." : ""} The latest image; it refreshes every few minutes.`;
      }
      if (R.started && R.frames[R.frame]) show(R.frame);
    }
    function describe() {
      if (l3()) return `${R.site ? R.site.id + " " : ""}${lc(l3().label)}, ${useL2() ? "Level II full volume" : "Level III"} (NOAA open data on AWS)`;
      if (R.mode === "model" && MM) return `${MM.SOURCES[R.mm.src].label} ${lc(MM.field(R.mm.src, R.mm.field).label)}`;
      if (R.mode === "abi" && AB) return `${AB.SATS[abiSat()].label} ${AB.PRODUCTS[R.ab.prod].label}${AB.PRODUCTS[R.ab.prod].group === "Single bands" ? "" : " RGB"} (NOAA open data on AWS)`;
      if (R.mode === "mrms" && MR) return `MRMS ${lc(MR.PRODUCTS[R.mr.prod].label)} (NOAA open data on AWS)`;
      return R.mode === "comp" ? "NEXRAD base reflectivity, US mosaic (IEM)" : R.mode === "hrrr" ? "HRRR simulated reflectivity, the latest run (IEM)" : R.mode === "replay" ? (R.replay && R.replay.site ? `${R.replay.site} Level II archive (NOAA open data on AWS)` : "NEXRAD mosaic archive (IEM)") : `${R.site ? R.site.id + " " : ""}${Wx.SITE_PRODUCTS[R.mode].label.toLowerCase()} (NEXRAD via IEM)`;
    }

    async function start() {
      if (R.started) return;
      R.started = true;
      const sat = store.get("wx:sat", null);           // the visitor's last choice, this browser only
      if (PRO && Wx.SAT[sat]) setSat(sat);
      const linked = PRO ? applyLink() : false;          // a shared view wins over the place's
      /* after the link, which may have turned a lightning layer on */
      if (ltgOn()) { lightningClock(); if ($("#awscredit")) $("#awscredit").hidden = false; }
      /* the pickers say what the link chose */
      if (PRO && $("#mrprod") && MR) $("#mrprod").value = R.mr.prod;
      if (PRO && $("#abiprod") && AB) { $("#abiprod").value = R.ab.prod; $("#abisec").value = R.ab.sector; $("#abisat").value = R.ab.sat; }
      if (PRO && $("#mmfield") && MM) modelOptions();
      if (typeof linked === "string") { setMode(linked); loadOverlays(true); stationsSoon(); return; }
      if (R.mode === "comp") {
        compFrames();
        const v = await Wx.radarTime();
        if (R.mode !== "comp") return;               // a replay began meanwhile: it owns the frames now
        R.valid = v;
        compFrames();
      } else if (single()) await siteFrames();
      label(); renderSources();
      stationsSoon(); loadOverlays(true);
      if (!reduced) setTimeout(() => { if (R.visible) play(true); }, 900);
    }

    function zoomTo(nz) {
      nz = Math.min(MAXZ, Math.max(MINZ, nz));
      if (nz === R.z) return;
      const f = 2 ** (nz - R.z);
      R.cx *= f; R.cy *= f; R.z = nz;
      clearTiles(); draw(); stationsSoon();
    }
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
        <button type="button" class="pgo" data-pingo>Forecast here</button>${PRO ? `<button type="button" class="pgo alt" data-pinsky>Sounding here</button>` : ""}`;
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
        <div class="ps">Airport station · observed ${esc(k.time(s.time))} (<span data-age="${s.time}">${Wx.age(Date.now() - s.time)}</span> ago)</div>
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
    function shareLink() {
      const lat = yLat(R.cy, R.z), lon = xLng(R.cx, R.z);
      const ov = [R.ov.watches && "w", R.ov.cells && "c", R.ov.fronts && "f", R.stations && "s", R.outlook && "o", R.ov.lightning && "l", R.ov.density && "d", R.ov.reports && "r"].filter(Boolean).join("");
      const v = `${lat.toFixed(1)},${(((lon + 540) % 360) - 180).toFixed(1)},${R.z}`;
      const url = `${location.origin}${location.pathname}#v=${v}&l=${encodeURIComponent(R.mode === "replay" ? "comp" : R.mode)}&s=${encodeURIComponent(R.sat || "")}&o=${ov}${l3() ? (useL2() ? `&a=${R.l2angle}` : `&t=${R.tilt}`) : ""}${R.mode === "model" ? `&m=${R.mm.src}.${R.mm.field}` : ""}${R.mode === "mrms" ? `&r=${R.mr.prod}` : ""}${R.mode === "abi" ? `&g=${R.ab.prod}.${R.ab.sector}.${R.ab.sat}` : ""}`;
      const done = () => note("Link copied — it opens this map view and these layers. Your saved place is not in it.");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => note(`Copy this link: ${url}`));
      else note(`Copy this link: ${url}`);
    }
    /* opening such a link */
    function applyLink() {
      const h = location.hash.replace(/^#/, "");
      if (!h) return false;
      const q = new URLSearchParams(h), v = (q.get("v") || "").split(",").map(Number);
      if (v.length === 3 && Wx.validLat(v[0]) && Wx.validLon(v[1]) && v[2] >= MINZ && v[2] <= MAXZ) {
        R.z = Math.round(v[2]); R.cx = lngX(v[1], R.z); R.cy = latY(v[0], R.z);
      }
      const o = q.get("o");
      if (o != null) {
        R.ov = { watches: o.includes("w"), cells: o.includes("c"), fronts: o.includes("f"), lightning: o.includes("l"), density: o.includes("d"), reports: o.includes("r") };
        R.stations = o.includes("s"); R.outlook = o.includes("o");
        $("#stationtoggle").setAttribute("aria-pressed", String(R.stations));
        $("#outlooktoggle").setAttribute("aria-pressed", String(R.outlook));
        document.querySelectorAll("[data-ov]").forEach((b) => b.setAttribute("aria-pressed", String(!!R.ov[b.dataset.ov])));
      }
      if (Wx.SAT[q.get("s")]) setSat(q.get("s"));
      const t = Number(q.get("t")), a = q.get("a");
      if (q.get("t") != null && t >= 0 && t <= 3) { R.tilt = Math.round(t); R.l2 = false; }
      if (a != null && Number.isFinite(Number(a)) && Math.abs(Number(a)) < 30) { R.l2 = true; R.l2angle = Number(a); }
      const [ms, mf] = (q.get("m") || "").split(".");
      if (MM && MM.field(ms, mf)) { R.mm.src = ms; R.mm.field = mf; }
      if (MR && MR.PRODUCTS[q.get("r")]) R.mr.prod = q.get("r");
      const [gp, gs, gsat] = (q.get("g") || "").split(".");
      if (AB && AB.PRODUCTS[gp] && AB.SECTORS[gs] && ["auto", "east", "west"].includes(gsat)) R.ab = { prod: gp, sector: gs, sat: gsat };
      const l = q.get("l");
      return ["N0B", "N0S", "hrrr"].includes(l) || l3(l) || (l === "model" && MM) || (l === "mrms" && MR) || (l === "abi" && AB) ? l : true;
    }
    pinEl.addEventListener("click", (e) => {
      if (e.target.closest("[data-pinx]")) { R.pin = null; draw(); }
      else if (e.target.closest("[data-pinsky]") && R.pin) { const p = R.pin; R.pin = null; draw(); sky.at(p.lat, p.lon, p.name || "the tapped point"); }
      else if (e.target.closest("[data-pingo]") && R.pin) {
        const p = R.pin; R.pin = null; full(false);
        choose({ name: p.name || "Map point", region: "", lat: p.lat, lon: p.lon });
      }
    });

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
    }
    $("#zfull").addEventListener("click", () => full(!$("#radarcard").classList.contains("mapfull")));
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

    /* dragging, the site following the map, and a tap that is not a drag */
    let drag = null, follow = 0, tap = 0;
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button,a,.pin")) return;
      drag = { x: e.clientX, y: e.clientY, cx: R.cx, cy: R.cy, t: Date.now() };
      el.setPointerCapture(e.pointerId); el.classList.add("dragging");
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      R.cx = drag.cx - (e.clientX - drag.x); R.cy = drag.cy - (e.clientY - drag.y);
      requestAnimationFrame(draw);
    });
    const end = (e) => {
      if (!drag) return;
      const d = drag;
      drag = null; el.classList.remove("dragging");
      if (e.type === "pointerup" && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && Date.now() - d.t < 450) {
        /* wait out a double tap, which zooms instead */
        const r = el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        clearTimeout(tap);
        tap = setTimeout(() => {
          const tlat = yLat(R.cy - el.clientHeight / 2 + py, R.z), tlon = xLng(R.cx - el.clientWidth / 2 + px, R.z);
          if (X.pick) { xsecTap(tlat, tlon); return; }
          if (R.measure) { measureTap(tlat, tlon); return; }
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
    el.addEventListener("dblclick", (e) => { if (!e.target.closest("button,a,.pin")) { clearTimeout(tap); zoomTo(R.z + 1); } });
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
    }
    if ($("#modelbar") && MM) {
      modelOptions();
      $("#mmsrc").addEventListener("change", (e) => {
        R.mm.src = MM.SOURCES[e.target.value] ? e.target.value : "hrrr";
        if (!MM.field(R.mm.src, R.mm.field)) R.mm.field = MM.FIELDS[R.mm.src][0].id;
        store.set("wx:mmsrc", R.mm.src); store.set("wx:mmfield", R.mm.field);
        modelOptions(); R.mm.run = null;
        if (R.mode === "model") { play(false); modelFrames().then(label); }
      });
      $("#mmfield").addEventListener("change", (e) => {
        if (!MM.field(R.mm.src, e.target.value)) return;
        R.mm.field = e.target.value; store.set("wx:mmfield", R.mm.field);
        if (R.mode !== "model" || !R.frames.length) return;
        /* the same run and hours, the new field; the hour on screen stays */
        const at = R.frame;
        play(false);
        setFrames(R.frames.map((f) => ({ t: f.t, model: { src: f.model.src, field: R.mm.field, run: f.model.run, fh: f.model.fh } })));
        show(Math.min(at, R.frames.length - 1)); label(); renderSources();
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
          const text = readoutAt(yLat(R.cy - el.clientHeight / 2 + py, R.z), xLng(R.cx - el.clientWidth / 2 + px, R.z));
          readEl.hidden = !text; if (text) readEl.textContent = text;
        });
      });
      el.addEventListener("pointerleave", () => { readEl.hidden = true; });
    }
    $("#play").addEventListener("click", () => play(!R.playing));
    $("#scrub").addEventListener("input", (e) => { play(false); loadOld(); show(Number(e.target.value)); });
    document.querySelectorAll(".seg [data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
    document.querySelectorAll("[data-sat]").forEach((b) => b.addEventListener("click", () => setSat(b.dataset.sat)));
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
      draw();
    });
    addEventListener("resize", () => requestAnimationFrame(draw));

    new IntersectionObserver((entries) => {
      R.visible = entries.some((x) => x.isIntersecting);
      if (R.visible) start();
      else if (R.playing) play(false);
    }, { rootMargin: "200px" }).observe(el);
    play(false);

    /* The lower 48, edge to edge: a map view, not anybody's place. */
    const CONUS = [24.4, -125, 49.5, -66.9];
    return {
      center(lat, lon) {
        R.us = false; R.pin = null;
        R.lat = lat; R.lon = lon;
        R.z = 7;
        R.cx = lngX(lon, R.z); R.cy = latY(lat, R.z);
        clearTiles();
        if (single()) { R.site = null; if (R.started) pickSite(true).then(() => siteFrames()).then(label); }
        if (R.started) { draw(); stationsSoon(); }
      },
      showUS() {
        R.us = true; R.lat = null;
        if (!R.outlook) { R.outlook = true; $("#outlooktoggle").setAttribute("aria-pressed", "true"); }
        if (single()) setMode("comp");
        fit(...CONUS, 10);
      },
      /* a storm that covers the place: its polygon and the place, on the
         nearest radar's reflectivity, playing */
      async focusStorm(a) {
        if (a.polygon) fitPolygon(a.polygon, S.place);
        if (!single() && inUS()) await setMode(NX ? "l3:ref" : "N0B");
        if (!reduced && R.visible) play(true);
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
        if (R.mode === "comp") { Wx.radarTime().then((v) => { if (v && v !== R.valid) { R.valid = v; clearTiles(); compFrames(); renderSources(); } }); }
        else if (R.mode === "replay") { /* the past does not refresh */ }
        else if (R.mode === "hrrr") { Wx.hrrrRun().then((v) => { if (v && v !== R.valid && !R.playing) hrrrFrames(); }).catch(() => {}); }
        else if (R.mode === "mrms") mrmsFrames(true);
        else if (R.mode === "abi") abiFrames(true);
        else if (R.mode === "model" && MM.SOURCES[R.mm.src].analysis) { MM.analyses(R.mm.src).then((r) => { if (r.length && r[r.length - 1] !== R.mm.run && !R.playing) modelFrames(); }).catch(() => {}); }
        else if (R.mode === "model") { MM.latestRun(R.mm.src).then((r) => { if (r && r.run !== R.mm.run && !R.playing) modelFrames(); }).catch(() => {}); }
        else siteFrames(true);
      },
      draw, label, describe, setSat, start,
      get sat() { return R.sat; },
      get mode() { return R.mode; },
      get replay() { return R.replay; },
      get pro() { return PRO ? { ov: R.ov, ...R.pro } : null; },
      get analysis() { return R.mode === "model" && MM && !!MM.SOURCES[R.mm.src].analysis; },
      get lightning() { return ltgOn() && (LTG.at || LTG.failed) ? { n: LTG.flashes.length, at: LTG.at, failed: LTG.failed } : null; },
      get stations() { return R.stations && R.obs.length ? { n: R.obs.length, newest: Math.max(...R.obs.map((s) => s.time)) } : null; },
      get valid() { return R.valid; },
      get started() { return R.started; }
    };
  })();

  /* ── the air above you (DESIGN.md §15–17) ──
     Closed until asked for. Opening it fetches one model's next 48 hours at
     this point — every pressure level — once; the hour slider then only
     re-reads what is already here, so dragging through time redraws the
     Skew-T and hodograph instantly (§15.5). */
  const sky = (() => {
    /* only Weather Pro has the air above you */
    if (!$("#skyd")) return { reset() {}, get source() { return null; }, redraw() {}, at() {} };
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
            <div><span>Precipitable water</span><b class="num">${U() === "us" ? (a.pw / 25.4).toFixed(2) + " in" : a.pw.toFixed(1) + " mm"}</b></div>
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
      const sl = $("#skyhour"); if (sl) sl.value = K.hour;
      const html = draw(true);
      if (!html) return;
      $("#skyinfo").innerHTML = html.info;
      $("#skydyn").innerHTML = html.pics + html.table;
      if (sl && html.when) sl.previousElementSibling.textContent = clk().hour(html.when);
      markHour();
    });
    return {
      reset() { Object.assign(K, { tl: null, col: null, colKey: null, run: null, raob: null, raobSite: null, model: null, mode: "model", source: null, err: null, compare: false, cmp: null, point: null }); if ($("#skyd").open) { K.model = defaultModel(); loadModel(); } },
      /* a sounding at a point tapped on the map, until "back" */
      at(lat, lon, name) {
        Object.assign(K, { tl: null, col: null, colKey: null, run: null, raob: null, raobSite: null, mode: "model", source: null, err: null, compare: false, cmp: null,
          point: { lat: Wx.round2(lat), lon: Wx.round2(lon), name: String(name || "the tapped point").slice(0, 60) } });
        K.model = defaultModel();
        const d = $("#skyd"); d.open = true; $("#sky").hidden = false;
        loadModel();
        $("#sky").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      },
      get source() { return K.source; },
      redraw: draw
    };
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
    load();
  }
  function showUS() {
    S.place = null;
    store.del("wx:place");
    Object.assign(S, { fc: null, pt: undefined, obs: undefined, office: undefined, alerts: undefined, state: undefined });
    sky.reset();
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
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
    S.units = S.units === "us" ? "metric" : "us";
    store.set("wx:units", S.units);
    render(); radar.draw(); radar.label(); sky.redraw();
  });
  $("#refresh").addEventListener("click", () => { load(); radar.refresh(); });

  /* ── keeping up ──
     Every ten minutes, everything. Every minute, the alerts — when a storm
     warning covers the place or one is in its state, or on the national view —
     and the radar every two, while it is in view (§25, §29). */
  const FULL = 10 * 60e3, FAST = 60e3;
  let lastRadar = Date.now();
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - S.loadedAt > FULL) { load(); return; }
    const hot = !S.place || stormsHere().length || (S.state || []).some((a) => a.storm);
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
    if (now - lastRadar >= 120e3) { lastRadar = now; radar.refresh(); }
    if (S.place && now - (S.nowAt || 0) >= 300e3) {
      S.nowAt = now;
      const key = placeKey(S.place);
      loadNowcast((S.ctl || new AbortController()).signal, () => S.place && placeKey(S.place) === key);
    }
  }, 30e3);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - S.loadedAt > FULL) load();
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
})();
