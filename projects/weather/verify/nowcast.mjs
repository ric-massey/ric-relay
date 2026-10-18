#!/usr/bin/env node
/* NOWCAST GRADE — how good the radar nowcast has really been
   ────────────────────────────────────────────────────────────────────────────
   The page's next-hour rain call (projects/weather/nowcast.js) is the room's
   own prediction, so it is graded the way every model is: each night
   (.github/workflows/weather-score.yml) this replays yesterday from IEM's
   radar archive. At SAMPLES times through the day it makes the nowcast
   exactly as the page would — the same code, the same settings, from the
   same 30 minutes of history — over a lattice of points across the lower
   48, then looks at what the radar actually showed 15, 30, 45 and 60
   minutes later.

   Against what: "nothing moves" (persistence — the same look, no motion).
   A nowcast that cannot beat that is not worth showing, and the page says
   which it was.

   Score: the critical success index of "rain here" (≥ 20 dBZ) at each lead,
   from decayed counts (the scoreboard's 14-day memory). Published to
   scores/nowcast.json; no place is written, the lattice is regular.

       node projects/weather/verify/nowcast.mjs                 grade yesterday
       node projects/weather/verify/nowcast.mjs --day 2026-10-16 --samples 2 */
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const N = require('../nowcast.js');
const C = require('./core.js');
const HERE = dirname(fileURLToPath(import.meta.url));
const IEM = 'https://mesonet.agron.iastate.edu';
const UA = 'ricmassey.com weather scoreboard (+https://ricmassey.com)';

/* the archive composite: 0.005° a pixel, west edge -126, north edge 50 */
export const GRID = { x0: -126, y0: 50, d: 0.005 };
export const LEADS = [15, 30, 45, 60];
/* the page's settings, in km, so the two can never drift apart */
export const SETTINGS = N.SETTINGS;
const BLOCK = 4;                      // 0.02° ≈ 2 km cells, as the page's tiles
const SAMPLES = 6;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
export const archiveUrl = t => {
  const d = new Date(t);
  return `${IEM}/archive/data/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/GIS/uscomp/n0q_` +
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}.png`;
};
async function getBytes(fetchImpl, url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchImpl(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(120000) });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
      last = new Error(`HTTP ${r.status} ${url}`);
      if (r.status === 404) break;
    } catch (e) { last = e; }
    await sleep(4000 * (i + 1));
  }
  throw last;
}
const inflate = async b => new Uint8Array(inflateSync(b));
async function frame(fetchImpl, t) {
  return N.field(await N.decodePng(await getBytes(fetchImpl, archiveUrl(t)), inflate), BLOCK);
}

/* one sample time: a nowcast from [t−30, t−20, t−10, t], graded at t+15…60 */
export function gradeSample(frames, truth, kmPerCell, step = 12) {
  const now = frames[frames.length - 1];
  const m = N.motion(frames, 10, { regions: Math.max(4, Math.round(now.w / 120)), regionsY: Math.max(2, Math.round(now.h / 120)), search: SETTINGS.searchKm / kmPerCell });
  const still = { regions: m.regions.map(r => ({ ...r, u: 0, v: 0 })), u: 0, v: 0, known: true };
  const out = {};
  for (const L of LEADS) out[L] = { now: [0, 0, 0], still: [0, 0, 0] };
  if (!m.known) return { counts: out, moving: false };
  const opt = N.optionsFor(kmPerCell, LEADS[LEADS.length - 1]);
  for (let y = step; y < now.h - step; y += step) for (let x = step; x < now.w - step; x += step) {
    if (now.v[y * now.w + x] < -90 && !truth.some(f => f.v[y * f.w + x] >= N.RAIN_DBZ)) {
      /* nothing on radar here now or later: skip the empty sky, which both
         would get "right" and which would only flatter the scores */
      let near = false;
      for (let k = -8; k <= 8 && !near; k += 4) for (let j = -8; j <= 8 && !near; j += 4) { const v = now.v[(y + k) * now.w + x + j]; if (v >= N.RAIN_DBZ) near = true; }
      if (!near) continue;
    }
    const fc = N.forecast(now, m, x, y, opt), ps = N.forecast(now, still, x, y, opt);
    LEADS.forEach((L, i) => {
      const o = truth[i].v[y * truth[i].w + x] >= N.RAIN_DBZ;
      for (const [k, s] of [['now', fc], ['still', ps]]) {
        const p = s.find(q => q.min === L);
        if (!p || p.p === null) continue;
        const f = p.p >= 0.5;
        const c = out[L][k];
        if (f && o) c[0]++; else if (f) c[1]++; else if (o) c[2]++;
      }
    });
  }
  return { counts: out, moving: true, u: m.u, v: m.v };
}

const csi = c => { const d = c[0] + c[1] + c[2]; return d ? c[0] / d : null; };
const DECAY = 1 - 1 / C.HALF_LIFE_DAYS;
export function foldDay(prev, day, counts) {
  const s = prev && prev.leads ? prev : { days: [], leads: {} };
  for (const L of LEADS) {
    const p = s.leads[L] || { now: [0, 0, 0], still: [0, 0, 0] };
    for (const k of ['now', 'still']) p[k] = p[k].map((v, i) => v * DECAY + counts[L][k][i]);
    s.leads[L] = p;
  }
  s.days = [...new Set([...(s.days || []), day])].sort().slice(-60);
  return s;
}
export function summary(s) {
  const leads = {};
  for (const L of LEADS) {
    const p = s.leads[L];
    if (!p) continue;
    const r = x => x === null ? null : Math.round(x * 100) / 100;
    leads[L] = { csi: r(csi(p.now)), still: r(csi(p.still)), events: Math.round(p.now[0] + p.now[2]) };
  }
  return { generated: new Date().toISOString(), through: s.days[s.days.length - 1] || null, days: s.days.length, threshold: N.RAIN_DBZ, leads };
}

export async function run({ day, samples = SAMPLES, statePath, outPath, fetchImpl = fetch, log = console.log } = {}) {
  const d = day || new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const state = statePath && existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8'))
    : outPath && existsSync(outPath) ? { days: JSON.parse(readFileSync(outPath, 'utf8')).days_list || [], leads: JSON.parse(readFileSync(outPath, 'utf8')).raw || {} } : null;
  if (state && state.days && state.days.includes(d)) { log(`nowcast: ${d} already graded`); return { state, graded: false }; }
  const t0 = Date.parse(d + 'T00:00:00Z');
  const total = {};
  for (const L of LEADS) total[L] = { now: [0, 0, 0], still: [0, 0, 0] };
  let used = 0;
  for (let k = 0; k < samples; k++) {
    /* spread through the day, off the hour so the cron's own minute does not bias it */
    const t = t0 + Math.round((k + 0.5) * 24 / samples * 3600e3 / 300e3) * 300e3;
    try {
      const frames = [];
      for (const back of [30, 20, 10, 0]) frames.push(await frame(fetchImpl, t - back * 60e3));
      const truth = [];
      for (const L of LEADS) truth.push(await frame(fetchImpl, t + L * 60e3));
      const kmPerCell = GRID.d * BLOCK * 111.2 * Math.cos(38 * Math.PI / 180);
      const g = gradeSample(frames, truth, kmPerCell);
      for (const L of LEADS) for (const key of ['now', 'still']) g.counts[L][key].forEach((v, i) => { total[L][key][i] += v; });
      used++;
      log(`  ${new Date(t).toISOString().slice(11, 16)}Z  ` + LEADS.map(L => `${L}m ${csi(g.counts[L].now)?.toFixed(2) ?? '–'}/${csi(g.counts[L].still)?.toFixed(2) ?? '–'}`).join('  '));
    } catch (e) { log(`  sample ${k}: ${e.message}`); }
  }
  if (!used) { log('nowcast: no sample could be graded'); return { state, graded: false }; }
  const next = foldDay(state, d, total);
  if (statePath) { mkdirSync(dirname(statePath), { recursive: true }); writeFileSync(statePath, JSON.stringify(next)); }
  const pub = { ...summary(next), days_list: next.days, raw: next.leads };
  if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, JSON.stringify(pub) + '\n'); }
  log(`nowcast ${d}: ` + LEADS.map(L => `${L} min CSI ${pub.leads[L].csi} (nothing-moves ${pub.leads[L].still})`).join(', '));
  return { state: next, graded: true, summary: pub };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (k, dflt) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : dflt; };
  /* trying other settings by hand: --r0 3 --grow 0.25 (never written back) */
  if (arg('--r0')) N.SETTINGS.r0Km = Number(arg('--r0'));
  if (arg('--grow')) N.SETTINGS.growKmPerMin = Number(arg('--grow'));
  if (arg('--dry')) { await run({ day: arg('--day'), samples: Number(arg('--samples', SAMPLES)) }); process.exit(0); }
  await run({ day: arg('--day'), samples: Number(arg('--samples', SAMPLES)),
    statePath: join(HERE, '.state', 'nowcast.json'), outPath: join(HERE, 'scores', 'nowcast.json') });
}
