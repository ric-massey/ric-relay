#!/usr/bin/env node
/* SCORE — the weather room's nationwide scoreboard
   ────────────────────────────────────────────────────────────────────────────
   Once a day (.github/workflows/weather-score.yml) this holds every model the
   weather room can show to what actually happened at every US airport
   weather station (IEM's AZOS network — about 2,500 of them), and folds the
   result into a running record per station, model and lead time (core.js
   says what a record is).

       node projects/weather/verify/score.mjs                 score yesterday
       node projects/weather/verify/score.mjs --backfill 14   and the 13 days before it
       node projects/weather/verify/score.mjs --day 2026-10-16 --limit 40

   Where the numbers come from:
     forecasts    Open-Meteo's previous-runs API: what each model said one day
                  (and two days) before each hour. No forecast has to be saved
                  here to be checked later.
     observations IEM's ASOS archive, one request per state network per run.
     stations     IEM's AZOS network list, fetched every run.

   Hard rule 1: nothing written by this script holds a coordinate. Station
   positions are read at run time and used only to ask for forecasts; the
   published files name stations by their public airport identifier.

   What it writes:
     <state>            the full running record (the workflow keeps it in the
                        Actions cache between runs; not committed)
     scores/index.json  which state each station is in, and the national summary
     scores/<ST>.json   each state's stations and their records, rounded
   The workflow commits scores/ once a week (and on the first run), so the
   repository's history grows by a weekly snapshot rather than a daily one.

   Open-Meteo's free tier is non-commercial and counts a request as one call
   per place, more for over ten variables or over two weeks. The script paces
   itself to CALLS_PER_MIN weighted calls a minute, under the hourly limit. */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const C = require('./core.js');
const HERE = dirname(fileURLToPath(import.meta.url));

export const MODELS = {
  best: 'best_match',
  nbm: 'ncep_nbm_conus',
  hrrr: 'ncep_hrrr_conus',
  gfs: 'gfs_global',
  ecmwf: 'ecmwf_ifs025',
  aifs: 'ecmwf_aifs025_single'
};
const VARS = ['temperature_2m_previous_day1', 'wind_speed_10m_previous_day1', 'precipitation_previous_day1', 'temperature_2m_previous_day2'];
const IEM = 'https://mesonet.agron.iastate.edu';
const PREV = 'https://previous-runs-api.open-meteo.com/v1/forecast';
const BATCH = 50;
const CALLS_PER_MIN = 70;
const UA = 'ricmassey.com weather scoreboard (+https://ricmassey.com)';

const ok = v => v !== null && v !== undefined && Number.isFinite(v);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
const dayStart = d => Date.parse(d + 'T00:00:00Z') / 1000;

/* ── fetching, with a few patient retries ── */
async function get(fetchImpl, url, as = 'json') {
  let last;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(90000) });
      if (r.ok) return as === 'json' ? await r.json() : await r.text();
      last = new Error(`HTTP ${r.status} ${url.slice(0, 120)}`);
      if (r.status < 500 && r.status !== 429) break;
    } catch (e) { last = e; }
    await sleep(5000 * (i + 1));
  }
  throw last;
}

/* ── stations ── */
export function stationsFrom(geo) {
  return ((geo && geo.features) || []).map(f => {
    const p = f.properties || {}, c = f.geometry && f.geometry.coordinates;
    return { id: String(f.id || p.sid || ''), name: p.sname || '', st: p.state || '', network: p.network || '',
      online: p.online !== false && !p.archive_end, lat: c && c[1], lon: c && c[0] };
  }).filter(s => /^[A-Z0-9]{3,4}$/.test(s.id) && s.online && /^[A-Z]{2}$/.test(s.st) && /_ASOS$/.test(s.network) &&
    Number.isFinite(s.lat) && Number.isFinite(s.lon) && s.lat > 17 && s.lat < 72 && s.lon > -180 && s.lon < -60);
}

/* ── forecasts: one batch of stations, every model, the whole range ── */
export function prevRunsUrl(batch, from, to) {
  const q = new URLSearchParams({
    latitude: batch.map(s => s.lat.toFixed(2)).join(','), longitude: batch.map(s => s.lon.toFixed(2)).join(','),
    hourly: VARS.join(','), models: Object.values(MODELS).join(','), start_date: from, end_date: to, timeformat: 'unixtime'
  });
  return `${PREV}?${q}`;
}
const weight = (n, days) => n * Math.max(1, VARS.length * Object.keys(MODELS).length / 10) * Math.max(1, days / 14);

/* answer → per station: { model: { 1: Map(hour → {t,w,p}), 2: Map(hour → {t}) } } */
export function forecastsFrom(json, batch) {
  const arr = Array.isArray(json) ? json : [json];
  const out = new Map();
  arr.forEach((loc, i) => {
    const s = batch[i], h = loc && loc.hourly;
    if (!s || !h || !Array.isArray(h.time)) return;
    const per = {};
    for (const [m, om] of Object.entries(MODELS)) {
      const col = v => h[`${v}_${om}`] || [];
      const t1 = col(VARS[0]), w1 = col(VARS[1]), p1 = col(VARS[2]), t2 = col(VARS[3]);
      const L1 = new Map(), L2 = new Map();
      h.time.forEach((t, k) => {
        if (t1[k] != null || w1[k] != null || p1[k] != null) L1.set(t, { t: t1[k] ?? null, w: w1[k] ?? null, p: p1[k] ?? null });
        if (t2[k] != null) L2.set(t, { t: t2[k], w: null, p: null });
      });
      per[m] = { 1: L1, 2: L2 };
    }
    out.set(s.id, per);
  });
  return out;
}

/* ── our own AI run (.github/workflows/weather-ai.yml, ai/extract.py) ──
   Each evening's run sits in <state dir>/ai/<init>.json: six-hourly values
   per station. A day is graded on the run made the evening before it began
   (initialised 12–36 hours before the day's first hour), the same footing as
   the other models' "one day before". */
export const AI_MODELS = ['pangu'];
export function loadAiRuns(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /^\d{10}\.json$/.test(f)).sort().map(f => {
    try { const j = JSON.parse(readFileSync(join(dir, f), 'utf8')); return { ...j, at: Date.parse(j.init) / 1000 }; } catch { return null; }
  }).filter(r => r && Number.isFinite(r.at) && Array.isArray(r.times) && r.stations);
}
export function aiFor(runs, day) {
  const t0 = dayStart(day);
  const ok1 = runs.filter(r => r.at <= t0 - 12 * 3600 && r.at >= t0 - 36 * 3600);
  return ok1.length ? ok1[ok1.length - 1] : null;
}
/* fold the runs into the forecast map: fc.get(id)[model] = { 1: Map(hour → {t,w,p}) } */
export function addAi(fc, runs, days) {
  for (const d of days) {
    const r = aiFor(runs, d);
    if (!r) continue;
    const t0 = dayStart(d);
    for (const [id, v] of Object.entries(r.stations)) {
      const per = fc.get(id);
      if (!per) continue;
      const m = r.model || 'pangu';
      const L1 = (per[m] || (per[m] = { 1: new Map(), 2: new Map() }))[1];
      r.times.forEach((t, k) => { if (t > t0 && t <= t0 + 86400) L1.set(t, { t: v.t[k] ?? null, w: v.w[k] ?? null, p: null }); });
    }
  }
}

/* ── observations: one state network, the whole range ── */
export function asosUrl(network, from, to) {
  const [y1, m1, d1] = from.split('-'), [y2, m2, d2] = ymd(Date.parse(to + 'T00:00:00Z') + 2 * 86400e3).split('-');
  return `${IEM}/cgi-bin/request/asos.py?network=${network}&data=tmpf&data=sknt&data=p01i&year1=${y1}&month1=${m1}&day1=${d1}` +
    `&year2=${y2}&month2=${m2}&day2=${d2}&tz=Etc/UTC&format=onlycomma&latlon=no&missing=null&trace=0.0001&report_type=3`;
}

/* ── state ── */
export function emptyState() { return { version: 1, updated: null, scored: [], stations: {} }; }
/* Rebuild a state from the committed per-state files when the cache is gone:
   the records are rounded to tenths there, which is close enough to carry on. */
export function seedFrom(dir) {
  const st = emptyState();
  if (!existsSync(dir)) return st;
  const idx = existsSync(join(dir, 'index.json')) ? JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) : null;
  if (idx) st.scored = idx.scored || [];
  for (const f of readdirSync(dir).filter(f => /^[A-Z]{2}\.json$/.test(f))) {
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const [id, s] of Object.entries(j.stations || {})) {
      st.stations[id] = { st: f.slice(0, 2), name: s.n, models: {} };
      for (const [m, leads] of Object.entries(s.m || {})) st.stations[id].models[m] = leads;
      if (s.L) st.stations[id].learn = { t: null, w: null, beta: { t: s.L.t || null, w: s.L.w || null } };
    }
  }
  return st;
}

/* ── one day, every station ── */
export function scoreOneDay(state, day, stations, fc, obs) {
  const t0 = dayStart(day);
  let scoredStations = 0;
  for (const s of stations) {
    const f = fc.get(s.id), o = obs.get(s.id);
    if (!f || !o || !o.size) continue;
    const rec = state.stations[s.id] || (state.stations[s.id] = { st: s.st, name: s.name, models: {} });
    rec.st = s.st; rec.name = s.name;
    const R = id => rec.models[id] || (rec.models[id] = {});

    /* our blend, built hour by hour from yesterday's records — before today
       is folded in, exactly as the page would have built it */
    const before = {};
    for (const m of C.BLEND_MODELS) before[m] = rec.models[m] && rec.models[m][1];
    const blendFc = new Map();
    for (let h = t0 + 3600; h <= t0 + 86400; h += 3600) {
      const vals = {};
      for (const m of C.BLEND_MODELS) { const v = f[m] && f[m][1].get(h); if (v) vals[m] = v; }
      if (Object.keys(vals).length) blendFc.set(h, C.blend(vals, before, C.isDay(h, s.lon)));
    }

    let any = false;
    for (const m of Object.keys(f)) {
      for (const lead of [1, 2]) {
        const series = f[m] && f[m][lead];
        if (!series || !series.size) continue;
        const d = C.scoreDay(series, o, t0, s.lon);
        if (lead === 2) { d.w = null; d.rain = null; }
        if (!d.td && !d.tn && !d.w && !d.rain) continue;
        R(m)[lead] = C.fold(R(m)[lead], d);
        any = true;
      }
    }
    const db = C.scoreDay(blendFc, o, t0, s.lon);
    if (db.td || db.tn || db.w || db.rain) { R('blend')[1] = C.fold(R('blend')[1], db); any = true; }

    /* our learned forecast: predicted with what was learned before today,
       scored, and only then taught today */
    const L = rec.learn || (rec.learn = { t: null, w: null, beta: { t: null, w: null } });
    const learnFc = new Map(), teach = { t: [], w: [] };
    for (let h = t0 + 3600; h <= t0 + 86400; h += 3600) {
      const vals = {};
      for (const m of C.LEARN_MODELS) { const v = f[m] && f[m][1].get(h); if (v) vals[m] = v; }
      const pt = C.learnPredict(L.beta.t, vals, 't', h, s.lon), pw = C.learnPredict(L.beta.w, vals, 'w', h, s.lon);
      if (pt !== null || pw !== null) learnFc.set(h, { t: pt, w: pw, p: null });
      const ob = o.get(h);
      if (!ob) continue;
      for (const k of ['t', 'w']) {
        const ft = C.learnFeatures(vals, k, h, s.lon);
        if (ft && ok(ob[k])) teach[k].push({ x: ft.x, r: ob[k] - ft.mean });
      }
    }
    if (learnFc.size) {
      const dl = C.scoreDay(learnFc, o, t0, s.lon);
      if (dl.td || dl.tn || dl.w) { R('learn')[1] = C.fold(R('learn')[1], dl); any = true; }
    }
    L.t = C.learnAdd(L.t, teach.t); L.w = C.learnAdd(L.w, teach.w);
    /* a record seeded from the published files has coefficients but no sums
       yet: keep those until the new sums are long enough to solve */
    L.beta = { t: C.learnSolve(L.t) || L.beta.t, w: C.learnSolve(L.w) || L.beta.w };
    if (any) scoredStations++;
  }
  if (scoredStations) {
    state.scored = [...new Set([...state.scored, day])].sort().slice(-400);
  }
  return scoredStations;
}

/* ── what the page reads ── */
const median = xs => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
export function publish(state, outDir) {
  mkdirSync(outDir, { recursive: true });
  const byState = {}, where = {};
  const allModels = [...Object.keys(MODELS), ...AI_MODELS, 'blend', 'learn'];
  const national = {};
  for (const m of allModels) national[m] = { mae: [], bias: [], rain: [] };
  for (const [id, s] of Object.entries(state.stations)) {
    const entry = { n: s.name, m: {} };
    for (const [m, leads] of Object.entries(s.models)) {
      entry.m[m] = {};
      for (const [lead, rec] of Object.entries(leads)) entry.m[m][lead] = C.compact(rec);
      const r1 = leads[1];
      if (r1 && r1.days >= C.MIN_DAYS && national[m]) {
        national[m].mae.push(C.tempMae(r1));
        national[m].bias.push((r1.td[0] * r1.td[2] + r1.tn[0] * r1.tn[2]) / Math.max(1, r1.td[2] + r1.tn[2]));
        national[m].rain.push(C.rainSkill(r1));
      }
    }
    if (s.learn && (s.learn.beta.t || s.learn.beta.w)) entry.L = { t: s.learn.beta.t, w: s.learn.beta.w };
    (byState[s.st] || (byState[s.st] = { stations: {} })).stations[id] = entry;
    where[id] = s.st;
  }
  const generated = new Date().toISOString();
  for (const [st, body] of Object.entries(byState)) {
    writeFileSync(join(outDir, `${st}.json`), JSON.stringify({ generated, ...body }) + '\n');
  }
  const summary = {};
  for (const m of allModels) {
    const n = national[m];
    summary[m] = { stations: n.mae.length, mae: median(n.mae), bias: median(n.bias), rain: median(n.rain.filter(x => x !== null)) };
    for (const k of ['mae', 'bias', 'rain']) if (summary[m][k] !== null) summary[m][k] = Math.round(summary[m][k] * 100) / 100;
  }
  const index = { generated, scored: state.scored, through: state.scored[state.scored.length - 1] || null,
    models: MODELS, minDays: C.MIN_DAYS, national: summary, stations: where };
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index) + '\n');
  return index;
}

/* ── the run ── */
export async function run({ day, backfill = 1, statePath, outDir, aiDir, limit = 0, fetchImpl = fetch, log = console.log, pace = true } = {}) {
  const end = day || ymd(Date.now() - 86400e3);
  const days = [];
  for (let i = backfill - 1; i >= 0; i--) days.push(ymd(Date.parse(end + 'T00:00:00Z') - i * 86400e3));
  const state = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : seedFrom(outDir);
  const todo = days.filter(d => !state.scored.includes(d));
  if (!todo.length) { log(`nothing to score: ${days.join(', ')} already in the record`); return { state, scoredDays: [] }; }
  const from = todo[0], to = todo[todo.length - 1];
  log(`scoring ${from} → ${to} (${todo.length} day${todo.length > 1 ? 's' : ''})`);

  let stations = stationsFrom(await get(fetchImpl, `${IEM}/geojson/network.py?network=AZOS`));
  if (limit) stations = stations.slice(0, limit);
  log(`${stations.length} stations`);

  /* observations, a state network at a time */
  const obsRows = new Map();
  const networks = [...new Set(stations.map(s => s.network))].sort();
  for (const n of networks) {
    try {
      const rows = C.parseCsv(await get(fetchImpl, asosUrl(n, from, to), 'text'));
      for (const [id, m] of C.hourlyObs(rows)) obsRows.set(id, m);
    } catch (e) { log(`  ${n}: observations failed (${e.message}) — its stations sit this run out`); }
  }
  log(`observations for ${obsRows.size} stations`);

  /* forecasts, in batches, paced */
  const fc = new Map();
  const span = (Date.parse(to) - Date.parse(from)) / 86400e3 + 1;
  /* Open-Meteo's free tier also caps a day (~10,000 weighted calls). A daily
     run costs ~7,500; a 28-day rebuild ~15,000, so it reaches the cap about
     two-thirds through (seen 2026-10-18). Past the cap every request is
     refused until tomorrow, so after a few refusals in a row stop asking: the
     stations not reached simply start their record with tomorrow's run. */
  let used = 0, refusedInARow = 0, stopped = false;
  for (let i = 0; i < stations.length; i += BATCH) {
    const batch = stations.slice(i, i + BATCH).filter(s => obsRows.has(s.id));
    if (!batch.length) continue;
    if (stopped) break;
    const t = Date.now();
    try {
      for (const [id, v] of forecastsFrom(await get(fetchImpl, prevRunsUrl(batch, from, to)), batch)) fc.set(id, v);
      used += weight(batch.length, span); refusedInARow = 0;
    } catch (e) {
      log(`  batch ${i / BATCH + 1}: forecasts failed (${e.message})`);
      if (/429|fetch failed/.test(e.message) && ++refusedInARow >= 3) {
        stopped = true;
        log(`  Open-Meteo has stopped answering after ~${Math.round(used)} weighted calls (its daily cap); ` +
          `the ${stations.length - i - BATCH > 0 ? stations.length - i - BATCH : 0} stations left start with the next run`);
      }
    }
    if (pace && !stopped) await sleep(Math.max(0, weight(batch.length, span) / CALLS_PER_MIN * 60e3 - (Date.now() - t)));
  }
  log(`forecasts for ${fc.size} stations`);
  const runs = loadAiRuns(aiDir || (statePath && join(dirname(statePath), 'ai')));
  addAi(fc, runs, todo);
  if (runs.length) log(`our AI runs: ${runs.map(r => r.init).join(', ')}`);

  const scoredDays = [];
  for (const d of todo) {
    const n = scoreOneDay(state, d, stations, fc, obsRows);
    log(`  ${d}: ${n} stations scored`);
    if (n) scoredDays.push(d);
  }
  state.updated = new Date().toISOString();
  if (statePath) { mkdirSync(dirname(statePath), { recursive: true }); writeFileSync(statePath, JSON.stringify(state)); }
  const index = publish(state, outDir);
  for (const [m, x] of Object.entries(index.national)) {
    if (x.stations) log(`  ${m.padEnd(6)} median temperature error ${x.mae} °C over ${x.stations} stations (bias ${x.bias}, rain skill ${x.rain})`);
  }
  return { state, scoredDays, index };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const out = await run({
    day: arg('--day'), backfill: Number(arg('--backfill', 1)), limit: Number(arg('--limit', 0)),
    statePath: arg('--state', join(HERE, '.state', 'state.json')), outDir: arg('--out', join(HERE, 'scores'))
  });
  if (!out.scoredDays.length && !out.state.scored.length) { console.error('nothing was scored'); process.exit(1); }
}
