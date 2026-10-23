/* The weather room against the REAL providers — node projects/weather/test/live.mjs
   wx.test.mjs runs on fixtures shaped like each provider's documented answer.
   This asks the providers themselves, through the same functions the page
   calls, and reads what comes back: a 200 is not a pass. It needs the
   network, so it is not in checks.mjs; .github/workflows/weather-live.yml runs
   it when this code changes and once a day.

   No coordinates are written here (hard rule 1): every place is found by
   name through the geocoder, the same way a visitor finds one. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../wx.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const guard = async (msg, fn) => { try { await fn(); } catch (e) { ok(false, `${msg} — threw ${e.message}`); } };

let us = null, abroad = null;

console.log('\nLIVE  the place search (Open-Meteo geocoding)');
await guard('geocode', async () => {
  const r = await W.geocode('Norman');
  us = r.find(p => p.cc === 'US' && /Oklahoma/.test(p.region));
  ok(!!us, `"Norman" finds Norman, Oklahoma (${r.length} results)`);
  ok(r.every(p => Number(W.coord(p.lat)) === p.lat && Number(W.coord(p.lon)) === p.lon), 'every result arrives rounded to two decimals');
  abroad = (await W.geocode('Reykjavik')).find(p => p.cc === 'IS');
  ok(!!abroad, 'and somewhere outside the US');
});
if (!us) { console.log('\nno place to test with — stopping'); process.exit(1); }

console.log('\nLIVE  the forecast (Open-Meteo)');
await guard('forecast', async () => {
  const fc = await W.forecast(us.lat, us.lon);
  const now = Math.floor(Date.now() / 1000);
  ok(fc.tz === 'America/Chicago', `the place's timezone: ${fc.tz}`);
  ok(Number.isFinite(fc.current.temp) && fc.current.temp > -40 && fc.current.temp < 50, `a current temperature: ${fc.current.temp}°C`);
  ok(Number.isFinite(fc.current.code) && W.WMO[fc.current.code], `a weather code the page knows: ${fc.current.code}`);
  ok(fc.hourly.length >= 240, `eleven days of hours: ${fc.hourly.length}`);
  const hrs = W.upcomingHours(fc, now, 24);
  ok(hrs.length === 24 && hrs.every(h => Number.isFinite(h.temp) && Number.isFinite(h.pop) && Number.isFinite(h.gust)), 'the next 24 hours have temperature, chance of rain and gusts');
  ok(hrs.every(h => Number.isFinite(h.vis) && Number.isFinite(h.uv) && (h.isDay === 0 || h.isDay === 1)), '…and visibility, UV, day/night');
  const days = W.upcomingDays(fc, now);
  ok(days.length >= 9 && days.slice(0, 9).every(d => d.hi >= d.lo && Number.isFinite(d.sunrise)), `ten days of highs, lows and sunrises (${days.length})`);
  ok(fc.minutely.filter(s => s.t > now).length >= 12 && fc.minutely.every(s => s.precip === null || s.precip >= 0), 'rain every fifteen minutes for at least the next three hours');
  const tr = W.pressureTrend(fc, now);
  ok(tr && ['rising', 'falling', 'steady'].includes(tr.word), `a pressure trend: ${tr && tr.word}`);
  const o = W.rainOutlook(fc, now, 3, s => W.clock(fc.tz).time(s * 1000));
  ok(o.state !== 'unknown' && o.text.length > 5, `the rain sentence: "${o.text}"`);
});

console.log('\nLIVE  the National Weather Service');
await guard('nws', async () => {
  const pt = await W.point(us.lat, us.lon);
  ok(pt && /^[A-Z]{3}$/.test(pt.office), `the point has a forecast office: ${pt && pt.office}`);
  ok(pt && W.ROUTES.nws(pt.forecastUrl) && W.ROUTES.nws(pt.stationsUrl), 'and its forecast and station links are ones the Worker allows');
  ok(pt && /Norman|Oklahoma|OK/.test(pt.city || ''), `and names the town: ${pt && pt.city}`);
  const office = await W.officeForecast(pt);
  ok(office && office.periods.length >= 10 && office.periods[0].detailed.length > 20, `the office's own words: ${office && office.periods.length} periods`);
  ok(office && Number.isFinite(office.updated) && Date.now() - office.updated < 24 * 3600e3, 'updated within a day');
  const obs = await W.observation(pt, us.lat, us.lon);
  ok(obs && /^[A-Z0-9]{3,6}$/.test(obs.station), `a station observation: ${obs && obs.station} ${obs && obs.stationName}`);
  ok(obs && Date.now() - obs.time < 3 * 3600e3, `reported in the last three hours (${obs && W.age(Date.now() - obs.time)} ago)`);
  /* Not every station reports pressure (KOUN did not, 2026-10-17); the page
     fills it from the model and says so. One that does must be in hPa. */
  ok(obs && Number.isFinite(obs.temp) && (obs.pressure === null || (obs.pressure > 900 && obs.pressure < 1100)),
    `with a temperature, and any pressure in hPa: ${obs && obs.temp}°C, ${obs && obs.pressure} hPa`);
  ok(obs && obs.dist != null && obs.dist < 60e3, `from within 60 km: ${obs && Math.round(obs.dist / 1000)} km`);
  const al = await W.alerts(us.lat, us.lon);
  ok(Array.isArray(al) && al.every(a => a.event && a.tone), `alerts read (${al.length} active)`);
});

console.log('\nLIVE  outside the US');
if (abroad) await guard('abroad', async () => {
  ok(await W.point(abroad.lat, abroad.lon) === null, 'the NWS has no point there, and that is an answer, not an error');
  const fc = await W.forecast(abroad.lat, abroad.lon);
  ok(fc.tz === 'Atlantic/Reykjavik' && fc.hourly.length >= 240, 'but the forecast works anywhere');
});

console.log('\nLIVE  radar (Iowa Environmental Mesonet)');
await guard('radar', async () => {
  const t = await W.radarTime();
  ok(Number.isFinite(t), `the composite says when it was scanned: ${t && new Date(t).toISOString()}`);
  ok(t && Date.now() - t < 20 * 60e3, `within twenty minutes (${t && W.age(Date.now() - t)} ago)`);
  for (const m of [0, 50]) {
    const r = await fetch(W.radarTile(m, 6, 14, 25, 'live'));
    ok(r.ok && /image\/png/.test(r.headers.get('content-type') || ''), `a ${m ? m + '-minute-old' : 'latest'} tile is a PNG (${r.status})`);
  }
});

console.log('\nLIVE  how sure: five models at once, and saved places in one request');
await guard('ensemble', async () => {
  const e = await W.ensemble(us.lat, us.lon);
  const now = Math.floor(Date.now() / 1000);
  const row = e && [...e.hours.entries()].find(([t]) => t >= now)?.[1];
  ok(row && W.ENSEMBLE.every(m => row[m] && Number.isFinite(row[m].t)), `every model has the next hour: ${row ? Object.keys(row).join(', ') : '—'}`);
  const fc = await W.forecast(us.lat, us.lon);
  const c = W.dayConfidence(e, W.upcomingDays(fc, now)[0].t);
  ok(c && ['high', 'medium', 'low'].includes(c.level) && c.models === 5, `today: ${c && c.level}, highs ${c && c.low.toFixed(1)}–${c && c.high.toFixed(1)} °C`);
  const k = W.clock(fc.tz);
  const said = W.summary(fc, now, k, x => String(Math.round(x * 9 / 5 + 32)), x => String(Math.round(x / 1.609)), 'mph');
  ok(said.length > 10, `the sentence at the top: "${said}"`);
  const two = await W.several([us, abroad].filter(Boolean));
  ok(two.length === 2 && two.every(x => x && Number.isFinite(x.temp)), `saved places at once: ${two.map(x => x && x.temp).join(', ')} °C`);
});

console.log('\nLIVE  storms across the country, and the outlook');
await guard('national', async () => {
  const n = await W.national();
  ok(Array.isArray(n) && n.every(a => a.event && W.NATIONAL_EVENTS.includes(a.event)), `the country's storm warnings and watches read (${n.length} now)`);
  const withMotion = n.filter(a => a.motion);
  ok(n.filter(a => /Tornado Warning|Severe Thunderstorm Warning/.test(a.event)).every(a => a.motion || !a.polygon) || n.length === 0,
    `every tornado / severe thunderstorm warning with a polygon has a readable motion line (${withMotion.length} with motion)`);
  const st = await W.stateAlerts('OK');
  ok(Array.isArray(st), `a state's alerts read (${st.length})`);
  const cat = await W.outlook('day1otlk_cat');
  ok(Array.isArray(cat) && cat.every(o => o.label && o.polys.length), `SPC's day 1 outlook: ${cat.map(o => o.label).join(', ') || 'no risk areas today'}`);
  for (const k of W.SPC_KINDS.slice(1)) { const o = await W.outlook(k); ok(Array.isArray(o), `${k} reads (${o.length} areas)`); }
});

console.log('\nLIVE  storm radar (single sites, IEM)');
await guard('site radar', async () => {
  const sites = await W.radarSites(us.lat, us.lon);
  ok(sites.length >= 3 && /^[A-Z]{3}$/.test(sites[0].id) && sites[0].dist < 80e3, `nearest NEXRAD: ${sites.slice(0, 3).map(x => x.id + ' ' + Math.round(x.dist / 1000) + 'km').join(', ')}`);
  for (const prod of Object.keys(W.SITE_PRODUCTS)) {
    const scans = await W.siteScans(sites[0].id, prod);
    ok(scans.length >= 4 && Date.now() - scans.at(-1).t < 30 * 60e3, `${prod}: ${scans.length} scans in the last hour, newest ${scans.length ? W.age(Date.now() - scans.at(-1).t) : '—'} ago`);
    if (scans.length) {
      const r = await fetch(W.tileUrl(scans.at(-1).layer, 7, 29, 50));
      ok(r.ok && /image\/png/.test(r.headers.get('content-type') || ''), `and its newest scan is a tile (${r.status})`);
    }
  }
});

console.log('\nLIVE  model columns and runs (Open-Meteo)');
const S = require('../sounding.js');
for (const m of Object.keys(W.MODELS)) {
  await guard(m, async () => {
    const j = await W.column(m, us.lat, us.lon);
    const prof = S.fromOpenMeteo(j, 1);
    /* HRRR and GFS publish ~20 pressure levels; ECMWF's models publish 12 */
    ok(prof && prof.length >= 10 && prof[0].p > 900, `${m}: a column of ${prof && prof.length} levels from ${prof && Math.round(prof[0].p)} hPa`);
    ok(prof && prof.filter(l => l.td !== null && l.ws !== null).length >= 10, `${m}: with dewpoints (or humidity to make them from) and winds`);
    const a = S.analyze(prof);
    ok(a && Number.isFinite(a.sb.cape) && Number.isFinite(a.pw) && a.pw > 0, `${m}: analyzed — SBCAPE ${a && a.sb.cape}, PW ${a && a.pw.toFixed(1)} mm, 0–6 km shear ${a && a.shear6 && a.shear6.toFixed(1)} m/s`);
    const run = await W.modelRun(m);
    ok(run && Date.now() - run < 30 * 3600e3, `${m}: last run ${run ? new Date(run).toISOString().slice(0, 13) + 'Z' : '—'}`);
  });
}

console.log('\nLIVE  weather balloons (IEM RAOB)');
await guard('raob', async () => {
  const sites = await W.raobSites();
  const nearest = sites.map(x => ({ ...x, d: W.distanceM(us.lat, us.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d)[0];
  ok(nearest && nearest.d < 100e3, `nearest balloon site: ${nearest && nearest.id} (${nearest && Math.round(nearest.d / 1000)} km)`);
  let flight = null;
  for (const t of W.raobTimes(Date.now())) {
    const r = S.fromRaob((await (async () => { try { return (await fetch(W.ROUTES.raob(nearest.id, W.raobTs(t))[1])).json(); } catch (e) { return null; } })()));
    if (r && r.levels.length > 20) { flight = r; break; }
  }
  ok(flight && flight.levels.length > 20, `a recent flight: ${flight && flight.station} ${flight && new Date(flight.valid).toISOString().slice(0, 13)}Z, ${flight && flight.levels.length} levels`);
  const a = flight && S.analyze(flight.levels);
  ok(a && Number.isFinite(a.sb.cape), `analyzed — SBCAPE ${a && a.sb.cape}, PW ${a && a.pw.toFixed(1)} mm`);
});

console.log('\nLIVE  Pro\'s map lines (Natural Earth, from its release on GitHub)');
require('../mapgeo.js');
for (const [name, least] of [['states', 50], ['coast', 100], ['nations', 5], ['counties', 3000], ['places', 500]]) {
  await guard(`map ${name}`, async () => {
    const L = await W.mapLayer(name);
    const n = L && (L.lines || L.places).length;
    ok(n >= least, `${name}: ${n} ${L && L.places ? 'towns' : 'lines'} inside North America`);
    if (name === 'places') ok(L.places.some(p => p[0] === 'Chicago') && L.places.every(p => typeof p[0] === 'string' && Number.isFinite(p[3])), 'names and the zoom each one is worth from');
  });
}

console.log('\nLIVE  Pro\'s own radar: NOAA\'s Level III and Level II, and the storm motion');
const NX = require('../nexrad.js'), LV2 = require('../level2.js');
await guard('radar bucket', async () => {
  /* the radars with the most storm motion right now: NWS writes its motion
     into each N0S file, so the busiest of a spread of sites is found, not named */
  const SITES = ['TLX', 'AMX', 'BYX', 'TFX', 'LOT', 'FWS', 'DMX', 'MPX', 'FFC', 'LWX', 'ATX', 'MUX', 'ABQ', 'BMX', 'HGX', 'OKX'];
  const found = [];
  for (const site of SITES) {
    try {
      const s = (await NX.scans(site, 'N0S', { mins: 30 })).at(-1);
      if (!s) continue;
      const F = await NX.load(s.url);
      found.push({ site, F, url: s.url, t: s.t });
    } catch (e) { /* a radar down for maintenance is not a failure */ }
  }
  ok(found.length >= SITES.length - 4, `NOAA's bucket answers: newest N0S from ${found.length} of ${SITES.length} radars`);
  const fresh = found.filter((x) => Date.now() - x.F.time < 20 * 60e3).length;
  ok(fresh >= found.length - 2, `and they are fresh by the time inside each file: ${fresh} of ${found.length} under 20 min`);
  ok(found.every((x) => Math.abs(x.t - x.F.time) < 15 * 60e3), 'the time in each file\'s name and the time inside it agree (a frozen feed would not)');
  /* the lowest tilt's scans, SAILS cuts included, run forward in time and none is ahead of now */
  for (const site of found.slice(0, 4).map((x) => x.site)) {
    const ss = (await NX.scans(site, 'N0B', { mins: 25 })).slice(-6), ts = [];
    for (const s of ss) ts.push((await NX.load(s.url)).time);
    ok(ts.every((t, i) => t <= Date.now() + 60e3 && (!i || t > ts[i - 1])), `${site}: ${ts.length} lowest-tilt scans in order, none in the future (${ts.map((t) => new Date(t).toISOString().slice(11, 16)).join(' ')})`);
  }
  const moving = found.filter((x) => x.F.motion).sort((a, b) => b.F.motion.kt - a.F.motion.kt);
  if (!moving.length) { console.log('  note  no radar is carrying a storm motion right now; the storm-relative check waits for weather'); return; }
  const best = moving[0], m = best.F.motion;
  ok(m.kt > 0 && m.kt < 120 && m.from >= 0 && m.from < 360, `${best.site}: NWS's storm motion from ${m.from}° at ${m.kt} kt`);
  /* rebuilt from base velocity with that motion (direction it comes FROM),
     storm-relative velocity lands on NWS's own N0S */
  const u = (await NX.scans(best.site, 'N0G', { mins: 30 })).filter((x) => Math.abs(x.t - best.t) < 120e3).at(-1);
  if (u) {
    const U = await NX.load(u.url);
    const err = (from) => { let n = 0, e = 0; for (let az = 0; az < 360; az += 3) for (let km = 20; km < 120; km += 4) { const a = NX.valueAt(best.F, 'srv', km, az), b = NX.valueAt(U, 'vel', km, az); if (!a || !b || a.rf || b.rf) continue; e += Math.abs(a.value - (b.value - m.kt * Math.cos((az - from - 180) * Math.PI / 180))); n++; } return n ? e / n : null; };
    const right = err(m.from), wrong = err(m.from + 180);
    ok(right != null && right < 6.5 && (m.kt < 5 || right < wrong), `${best.site}: N0G with the motion taken out is NWS's N0S to ${right && right.toFixed(1)} kt (the opposite direction: ${wrong && wrong.toFixed(1)} kt)`);
  }
  /* every tilt of a whole volume: velocity with the storm motion taken out decodes and stays in range */
  const s4 = LV2.site4(best.site), vol = await LV2.newestVolume(s4);
  if (vol) {
    /* the volume before the newest: a whole one, every tilt in it */
    const ch = await LV2.chunks(s4, LV2.prevNumber(vol.number, vol.numbers));
    let st = null;
    for (const c of ch) st = LV2.feed(new Uint8Array(await (await fetch(c.url)).arrayBuffer()), st);
    const cuts = st ? Object.keys(st.sweeps).map(Number).filter((n) => LV2.sweep(st, n, 'VEL')) : [];
    const to = (m.from + 180) * Math.PI / 180;
    const okCuts = cuts.filter((n) => { const sw = LV2.sweep(st, n, 'VEL'), r = NX.stormRelative(sw, m.kt * 0.514444 * Math.sin(to), m.kt * 0.514444 * Math.cos(to)); return r.data.some((b) => b >= 2 && Number.isFinite(r.lut[b])); });
    ok(cuts.length >= 2 && okCuts.length === cuts.length, `${s4}: storm-relative velocity at every velocity tilt of the last whole volume (${okCuts.length} of ${cuts.length})`);
  }
});

console.log('\nLIVE  the backup mosaic (NOAA MRMS, from NOAA\'s own map server)');
await guard('mosaic backup', async () => {
  const ts = await W.mosaicBackup();
  ok(ts.length >= 10, `its times answer: ${ts.length}, every ~${ts.length > 1 ? Math.round((ts.at(-1) - ts[0]) / (ts.length - 1) / 60e3) : '?'} min`);
  ok(ts.length && Date.now() - ts.at(-1) < 15 * 60e3, `and the newest is fresh: ${ts.length ? Math.round((Date.now() - ts.at(-1)) / 60e3) : '—'} min old`);
  const r = ts.length ? await fetch(W.backupTile(4, 3, 6, ts.at(-1))) : null;
  ok(r && r.ok && /image\/png/.test(r.headers.get('content-type') || ''), `a tile at the newest time is a picture (${r && r.status} ${r && r.headers.get('content-type')})`);
});

console.log('\nLIVE  the warnings backup (Iowa State\'s copy of the NWS\'s storm warnings)');
await guard('alerts backup', async () => {
  const now = Date.now(), rows = await W.sbwArchive(now - 6 * 3600e3, now);
  ok(Array.isArray(rows), `IEM's storm-based warnings answer: ${rows.length} polygons in the last six hours`);
  ok(rows.every((x) => x.polys.length && Number.isFinite(x.begin) && Number.isFinite(x.end) && x.event && x.wfo), 'each with a polygon, its minutes, its event and its office');
  /* a point inside a warning in force now (read from the answer, never written here) must find it */
  const live = rows.find((x) => x.begin <= now && now < x.end);
  if (!live) { console.log('  note  no storm-based warning is in force right now; the point check waits for weather'); return; }
  const ring = live.polys[0][0], lat = ring.reduce((s, p) => s + p[1], 0) / ring.length, lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const got = W.backupAlerts(rows, lat, lon, now);
  ok(!W.inPolygon(lat, lon, live.polys[0]) || got.some((a) => a.event === live.event && a.backup), `a point inside ${live.event} (${live.wfo}) finds it in the backup`);
});

console.log('\nLIVE  IEM\'s tracked storm cells (the storm motion when NWS\'s is not to be had)');
await guard('cells', async () => {
  const cells = await W.proOverlays.cells();
  ok(Array.isArray(cells), `the cell feed answers: ${cells.length} cells tracked across the country`);
  const moving = cells.filter((c) => c.kt > 0 && c.from != null && /^[A-Z0-9]{3}$/.test(c.site || ''));
  ok(!cells.length || moving.length > 0, `with a radar, a speed and a direction on the moving ones (${moving.length})`);
});

console.log('\n' + (failures ?`${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'THE WEATHER PROVIDERS ANSWER AS THE PAGE EXPECTS'));
process.exit(failures ? 1 : 0);
