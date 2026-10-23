/* The mesoanalysis, computed SPC's way — node projects/weather/meso/build.mjs
   ────────────────────────────────────────────────────────────────────────────
   Ric, 2026-10-22: "If we want to make Mesoanalysis more accurate how do we do
   that?", then "do it". The browser's mesoanalysis (modelmaps.js, source
   `meso`) reads the HRRR's analysis hour, which holds only six levels and
   comes out ~50 minutes after its hour. SPC's is fresher and fuller because of
   how it is made, so this is made the same way:

   1. The first guess is the RAP's one-hour forecast for the hour — the run
      that started an hour before, out by the hour itself (`noaa-rap-pds`,
      the native 13 km grid, `wrfprsf01`, every 25 hPa from 1000 to 100).
   2. Its ground-level air is replaced by NOAA's surface analysis, the 15-
      minute RTMA (`noaa-rtma-pds`, `rtma2p5_ru`, 2.5 km): temperature and
      dewpoint brought to the model's ground height (6.5 K/km; the dewpoint
      keeps its mixing ratio), and the 10 m wind. SPC blends the surface
      observations in the same place; RTMA is NOAA's own blend of them.
   3. Every column, on a 0.25° grid over the lower 48, goes through
      sounding.js's analyze() — all of its levels, the parcels, the
      effective layer, the composites — the same arithmetic the sounding card
      uses, held to MetPy in test/sounding.test.mjs.

   It writes one file (mesogrid.js's shape) and can PUT it to the Worker,
   which keeps the last day's hours in R2 for the page. It runs by itself in
   GitHub Actions (.github/workflows/meso.yml) a few minutes past each hour,
   or in AWS Lambda when the RTMA lands (meso/README.md). Nothing here holds a
   place: the grid is a regular one over the country.

     node projects/weather/meso/build.mjs                     newest hour whose inputs are out
     node projects/weather/meso/build.mjs --valid 2026102220  that hour (UTC)
     --out file.bin.gz    write it here       --put URL|worker  send it (LOG_TOKEN in the environment)
     --check              build only if the Worker does not have the hour yet */
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
const require = createRequire(import.meta.url);
const G = require('../grib2.js');
const S = require('../sounding.js');
const MM = require('../modelmaps.js');
const MG = require('../mesogrid.js');

export const RAP = 'https://noaa-rap-pds.s3.amazonaws.com';
export const RTMA = 'https://noaa-rtma-pds.s3.amazonaws.com';
/* the grid the page gets: SPC's is 40 km; this is 0.25° (about 25 km), over
   the lower 48 and its edges */
export const GRID = { kind: 'latlon', la1: 55, lo1: -130, di: 0.25, dj: 0.25, nx: 281, ny: 141, scan: 0 };
const LEVELS = [];
for (let p = 1000; p >= 100; p -= 25) LEVELS.push(p);

const pad = (n, w = 2) => String(n).padStart(w, '0');
const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
const hh = (ms) => pad(new Date(ms).getUTCHours());
export const stamp = (ms) => ymd(ms) + hh(ms);
const rapFile = (run, fh) => `${RAP}/rap.${ymd(run)}/rap.t${hh(run)}z.wrfprsf${pad(fh)}.grib2`;
const rtmaFile = (ms) => `${RTMA}/rtma2p5_ru.${ymd(ms)}/rtma2p5_ru.t${hh(ms)}00z.2dvaranl_ndfd.grb2`;

async function retry(fn, tries = 4) {
  for (let k = 0; ; k++) {
    try { return await fn(); } catch (e) { if (k + 1 >= tries) throw e; await new Promise((ok) => setTimeout(ok, 1000 * 2 ** k)); }
  }
}
async function text(url, fetchFn) {
  return retry(async () => { const r = await fetchFn(url); if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.text(); });
}
/* the messages wanted from one file, each by its own Range request, a few at a time */
async function messages(url, wanted, fetchFn) {
  const idx = G.parseIdx(await text(url + '.idx', fetchFn));
  const out = {}, todo = Object.entries(wanted);
  const one = async ([k, [name, level]]) => {
    const e = idx.find((x) => x.name === name && x.level === level && !/acc|max|min|ave/.test(x.fcst));
    if (!e) throw new Error(`no ${name} ${level} in ${url}`);
    out[k] = await retry(() => G.fetchMessage(url, e, { fetchFn }));
  };
  for (let i = 0; i < todo.length; i += 16) await Promise.all(todo.slice(i, i + 16).map(one));
  return out;
}

/* Which inputs exist for an hour: the RAP run an hour before (else two),
   and the RTMA at the hour. */
export async function inputs(valid, { fetchFn = fetch } = {}) {
  const has = async (url) => { try { const r = await fetchFn(url + '.idx', { method: 'HEAD' }); return r.ok; } catch { return false; } };
  let rap = null;
  for (const fh of [1, 2]) {
    const run = valid - fh * 3600e3;
    if (await has(rapFile(run, fh))) { rap = { run, fh, url: rapFile(run, fh) }; break; }
  }
  const rtma = (await has(rtmaFile(valid))) ? { url: rtmaFile(valid) } : null;
  return { rap, rtma };
}

/* the bearing (° clockwise from north) of a grid's +i direction at a point,
   to turn its grid-relative winds to the earth */
function bearingOfI(g, i, j) {
  const [la, lo] = g.ll(i, j), [lb, lob] = g.ll(i + 0.5, j), r = Math.PI / 180;
  const y = Math.sin((lob - lo) * r) * Math.cos(lb * r), x = Math.cos(la * r) * Math.sin(lb * r) - Math.sin(la * r) * Math.cos(lb * r) * Math.cos((lob - lo) * r);
  return Math.atan2(y, x);
}

/* One column's numbers, from sounding.js's analysis and its parts. Every
   composite is SPC's published formula; the comments name each. */
export function columnFields(L) {
  const A = S.analyze(L);
  if (!A) return null;
  const s = A.levels[0], W = A.winds, zs = s.z, MS2KT = 1.943844;
  const vec = (h) => { const a = S.windAt(W, 0), b = S.windAt(W, h); return a && b ? [b[0] - a[0], b[1] - a[1]] : [NaN, NaN]; };
  const at = (p, k) => S.at(A.levels, p, k);
  const lapse = (p1, p2) => {
    const t1 = at(p1, 't'), t2 = at(p2, 't'), z1 = S.heightAt(A.levels, p1), z2 = S.heightAt(A.levels, p2);
    return [t1, t2, z1, z2].every((v) => v !== null && Number.isFinite(v)) && z2 > z1 ? (t1 - t2) / (z2 - z1) * 1000 : NaN;
  };
  /* 0–3 km CAPE of the mixed-layer parcel: its positive area between the LFC and 3 km */
  let cape3 = 0;
  if (A.ml.lfc) {
    const P = A.ml.path;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i], b = P[i + 1];
      if (a.z == null || b.z == null || b.z - zs > 3000 || (a.p + b.p) / 2 > A.ml.lfc.p) continue;
      cape3 += Math.max(0, 287.04 * ((a.tv - a.tve) + (b.tv - b.tve)) / 2 * Math.log(a.p / b.p));
    }
  }
  /* SPC's effective bulk shear as a vector, for barbs: from the effective
     inflow base to half the most-unstable parcel's EL above it */
  let eb = [0, 0];
  if (A.eff && A.mu.el && A.mu.el.z !== null) {
    const a = S.windAt(W, A.eff.base), b = S.windAt(W, A.eff.base + (A.mu.el.z - A.eff.base) / 2);
    if (a && b) eb = [b[0] - a[0], b[1] - a[1]];
  }
  /* SPC's significant hail parameter (its help page): MUCAPE × the MU
     parcel's mixing ratio (11–13.6 g/kg) × the 700–500 lapse rate × −T500
     (no warmer than −5.5 °C) × 0–6 km shear (7–27 m/s) / 42,000,000; scaled
     down under 1300 J/kg, a 5.8 °C/km lapse rate and a 2400 m freezing level */
  const lr75 = lapse(700, 500), t500 = at(500, 't');
  let ship = 0;
  if (A.mu.cape > 0 && Number.isFinite(lr75) && t500 !== null) {
    const r = Math.min(13.6, Math.max(11, S.mixing(A.mu.start.p, A.mu.start.td) * 1000));
    const sh = Math.min(27, Math.max(7, A.shear6 ?? 0));
    ship = A.mu.cape * r * lr75 * -Math.min(-5.5, t500) * sh / 42e6;
    if (A.mu.cape < 1300) ship *= A.mu.cape / 1300;
    if (lr75 < 5.8) ship *= lr75 / 5.8;
    if (A.frz !== null && A.frz < 2400) ship *= Math.max(0, A.frz) / 2400;
  }
  /* SPC's derecho composite (Evans and Doswell 2001): DCAPE/980 ×
     MUCAPE/2000 × 0–6 km shear/20 kt × 0–6 km mean wind/16 kt */
  const mean = A.motion ? Math.hypot(...A.motion.mean) * MS2KT : NaN;
  const dcp = A.dcape != null ? (A.dcape / 980) * (A.mu.cape / 2000) * ((A.shear6 ?? 0) * MS2KT / 20) * (mean / 16) : NaN;
  /* SPC's supercell composite with its most-unstable CIN term (Gropp and
     Davenport 2018): × −40 / MUCIN where MUCIN is below −40 J/kg */
  const scp = (A.scp || 0) * (A.mu.cin < -40 ? -40 / A.mu.cin : 1);
  const s1 = vec(1000), s6 = vec(6000), m = A.motion ? A.motion.right : [NaN, NaN];
  return {
    thetae: S.thetaE(s.p, s.t, s.td),
    sbcape: A.sb.cape, mlcape: A.ml.cape, mucape: A.mu.cape, mlcin: -A.ml.cin, cape3,
    dcape: A.dcape ?? NaN, lr75, lr85: lapse(850, 500), lr03: A.lapse03 ?? NaN,
    lcl: A.ml.lcl.z ?? NaN, lfc: A.ml.lfc ? A.ml.lfc.z : NaN, frz: A.frz !== null ? A.frz * 3.28084 / 1000 : NaN, pwat: A.pw / 25.4,
    shear1: Math.hypot(...s1) * MS2KT, shear6: Math.hypot(...s6) * MS2KT, ebwd: (A.ebwd || 0) * MS2KT,
    srh1: A.srh1 ?? NaN, srh3: A.srh3 ?? NaN, esrh: A.esrh || 0, motion: Math.hypot(...m) * MS2KT,
    stpe: A.stpE || 0, stpf: A.stp ?? 0, scpe: Math.max(0, scp), ship: Math.max(0, ship), dcp: Math.max(0, dcp),
    ehi1: Math.max(0, A.sb.cape * (A.srh1 ?? 0) / 160000),
    shear1u: s1[0] * MS2KT, shear1v: s1[1] * MS2KT, shear6u: s6[0] * MS2KT, shear6v: s6[1] * MS2KT,
    ebwdu: eb[0] * MS2KT, ebwdv: eb[1] * MS2KT, motionu: m[0] * MS2KT, motionv: m[1] * MS2KT
  };
}


/* one band of rows of the output grid: the columns, their analysis, the fields */
/* One place's column: the RAP's levels interpolated to it, its winds turned
   to the earth, and its ground-level air from RTMA where RTMA covers it.
   Null off the RAP's grid. Exported for meso/measure.mjs, which must ask
   exactly the same columns. */
const tdFromRH = (t, rh) => { const es = S.es(t), e = Math.max(1e-3, Math.min(1, rh / 100)) * es, l = Math.log(e / 6.112); return 243.5 * l / (17.67 - l); };
const toWdWs = (u, v) => [((Math.atan2(-u, -v) * 180 / Math.PI) + 360) % 360, Math.hypot(u, v)];
export function column(ctx, lat, lon) {
  const { rap, rt } = ctx;
  const rg = ctx.rg || (ctx.rg = G.projector(rap.ps.grid)), nx = rap.ps.grid.nx;
  const [fi, fj] = rg.ij(lat, lon), i = Math.floor(fi), j = Math.floor(fj);
  if (!(i >= 0 && j >= 0 && i + 1 < nx && j + 1 < rap.ps.grid.ny)) return null;
  const tx = fi - i, ty = fj - j, a = j * nx + i, w = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty], ix4 = [a, a + 1, a + nx, a + nx + 1];
  const bl = (arr2) => w[0] * arr2[ix4[0]] + w[1] * arr2[ix4[1]] + w[2] * arr2[ix4[2]] + w[3] * arr2[ix4[3]];
  const beta = bearingOfI(rg, fi, fj), sb = Math.sin(beta), cb = Math.cos(beta);
  const earth = (ug, vg) => [ug * sb - vg * cb, ug * cb + vg * sb];
  const ps = bl(rap.ps.values) / 100, zs = bl(rap.zs.values);
  let t2 = bl(rap.t2.values) - 273.15, d2 = bl(rap.d2.values) - 273.15, [u10, v10] = earth(bl(rap.u10.values), bl(rap.v10.values)), rtUsed = false;
  /* the ground-level air from RTMA, where it covers (the lower 48), to the model's ground height */
  if (rt) {
    const r = G.sample(rt.t2, lat, lon), rd = G.sample(rt.d2, lat, lon), rz = G.sample(rt.zs, lat, lon), rp = G.sample(rt.ps, lat, lon);
    const ru = G.sample(rt.u10, lat, lon), rv = G.sample(rt.v10, lat, lon);
    if ([r, rd, rz, rp, ru, rv].every(Number.isFinite)) {
      t2 = r - 273.15 + 0.0065 * (rz - zs);
      const mr = S.mixing(rp / 100, rd - 273.15), e = Math.log((mr * ps / (0.622 + mr)) / 6.112);
      d2 = Math.min(t2, 243.5 * e / (17.67 - e));
      [u10, v10] = MM.earthWind(rt.u10.grid, lat, lon, ru, rv);
      rtUsed = true;
    }
  }
  const [wd0, ws0] = toWdWs(u10, v10);
  const L = [{ p: ps, z: zs + 2, t: t2, td: d2, wd: wd0, ws: ws0 }];
  for (const p of LEVELS) {
    if (p >= ps - 1) continue;
    const t = bl(rap['t' + p].values) - 273.15, [ue, ve] = earth(bl(rap['u' + p].values), bl(rap['v' + p].values)), [wd, ws] = toWdWs(ue, ve);
    L.push({ p, z: bl(rap['z' + p].values), t, td: tdFromRH(t, bl(rap['r' + p].values)), wd, ws });
  }
  return { L, t2, d2, u10, v10, mslp: bl(rap.mslp.values) / 100, rtUsed };
}
/* one band of rows of the output grid: the columns, their analysis, the fields */
function computeRows(ctx, j0, j1) {
  const { grid, conv } = ctx, arr = ctx.out;
  let done = 0, rtUsed = 0;
  for (let jy = j0; jy < j1; jy++) for (let ix = 0; ix < grid.nx; ix++) {
    const lat = grid.la1 - jy * grid.dj, lon = grid.lo1 + ix * grid.di, k = jy * grid.nx + ix;
    const c = column(ctx, lat, lon);
    if (!c) continue;
    if (c.rtUsed) rtUsed++;
    const f = columnFields(c.L);
    arr.pmsl[k] = c.t2 * 9 / 5 + 32; arr.td2m[k] = c.d2 * 9 / 5 + 32; arr.mslp[k] = c.mslp;
    arr.u10[k] = c.u10 * 1.943844; arr.v10[k] = c.v10 * 1.943844;
    if (conv) arr.mcon[k] = G.sample(conv, lat, lon);
    if (f) for (const [id, v] of Object.entries(f)) if (arr[id]) arr[id][k] = v;
    done++;
  }
  return { done, rtUsed };
}
/* a grid's numbers only (its functions are made again where it is used) */
const stripGrid = (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => typeof v !== 'function'));
  /* moisture convergence on RTMA's own 2.5 km grid (the model's otherwise):
     −∇·(qV) with the grid's own winds, smoothed over ~25 km first as SPC
     smooths theirs; g/kg per hour */
function convergence(src) {
  {
    const g = src.ps.grid, n = g.nx * g.ny, qu = new Float32Array(n), qv = new Float32Array(n);
    for (let k = 0; k < n; k++) { qu[k] = src.q.values[k] * src.u10.values[k]; qv[k] = src.q.values[k] * src.v10.values[k]; }
    const su = MM.smooth(qu, g.nx, g.ny, 5), sv = MM.smooth(qv, g.nx, g.ny, 5), out = new Float32Array(n).fill(NaN), d = 2 * (g.dx || 2539.7);
    for (let j = 1; j + 1 < g.ny; j++) for (let i = 1; i + 1 < g.nx; i++) {
      const k = j * g.nx + i;
      out[k] = -((su[k + 1] - su[k - 1]) / d + (sv[k + g.nx] - sv[k - g.nx]) / d) * 1000 * 3600;
    }
    return { grid: g, values: out };
  }
}


/* The whole build: inputs, columns, the file. `log` hears progress; the
   columns are shared out over the machine's cores (`threads` to choose). */
export async function load(valid, { fetchFn = fetch, log = () => {}, rtma: useRtma = true } = {}) {
  const t0 = Date.now();
  const inp = await inputs(valid, { fetchFn });
  if (!inp.rap) throw new Error(`no RAP run reaches ${stamp(valid)}Z yet`);
  log(`RAP ${hh(inp.rap.run)}Z +${inp.rap.fh} h; RTMA ${inp.rtma ? 'yes' : 'not yet — the model\'s own surface'}`);
  const want = { ps: ['PRES', 'surface'], zs: ['HGT', 'surface'], t2: ['TMP', '2 m above ground'], d2: ['DPT', '2 m above ground'],
    u10: ['UGRD', '10 m above ground'], v10: ['VGRD', '10 m above ground'], mslp: ['MSLMA', 'mean sea level'] };
  for (const p of LEVELS) for (const [k, n] of [['t', 'TMP'], ['r', 'RH'], ['z', 'HGT'], ['u', 'UGRD'], ['v', 'VGRD']]) want[k + p] = [n, p + ' mb'];
  const rap = await messages(inp.rap.url, want, fetchFn);
  log(`RAP: ${Object.keys(rap).length} fields in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  let rt = null;
  if (useRtma && inp.rtma) {
    rt = await messages(inp.rtma.url, { zs: ['HGT', 'surface'], ps: ['PRES', 'surface'], t2: ['TMP', '2 m above ground'], d2: ['DPT', '2 m above ground'],
      u10: ['UGRD', '10 m above ground'], v10: ['VGRD', '10 m above ground'], q: ['SPFH', '2 m above ground'] }, fetchFn);
    log(`RTMA: in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  return { inp, rap, rt };
}
export async function build(valid, { fetchFn = fetch, log = () => {}, grid = GRID, rtma: useRtma = true, threads = 0 } = {}) {
  const t0 = Date.now();
  const { inp, rap, rt } = await load(valid, { fetchFn, log, rtma: useRtma });
  /* every field into shared memory once, so the cores can read it without a copy each */
  const share = (m) => { if (!m) return null; const sab = new SharedArrayBuffer(m.values.length * 4), v = new Float32Array(sab); v.set(m.values); return { grid: stripGrid(m.grid), values: v }; };
  const ctx = { grid, rap: Object.fromEntries(Object.entries(rap).map(([k, m]) => [k, share(m)])), rt: rt ? Object.fromEntries(Object.entries(rt).map(([k, m]) => [k, share(m)])) : null, out: {} };
  for (const id of [...MG.FIELDS.map((f) => f.id), ...MG.EXTRA.map(([id]) => id)]) ctx.out[id] = new Float32Array(new SharedArrayBuffer(grid.nx * grid.ny * 4)).fill(NaN);
  ctx.conv = rt ? share(convergence(rt)) : null;
  const cores = Math.max(1, Math.min(threads || availableParallelism(), 16)), per = Math.ceil(grid.ny / cores);
  const counts = await Promise.all(Array.from({ length: cores }, (_, w) => {
    const j0 = w * per, j1 = Math.min(grid.ny, j0 + per);
    if (j0 >= j1) return { done: 0, rtUsed: 0 };
    if (cores === 1) return computeRows(ctx, j0, j1);
    return new Promise((ok, fail) => {
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { ctx, j0, j1 } });
      wk.once('message', ok); wk.once('error', fail);
    });
  }));
  const done = counts.reduce((n, c) => n + c.done, 0), rtUsed = counts.reduce((n, c) => n + c.rtUsed, 0), arr = ctx.out;
  log(`${done} columns (${rtUsed} with RTMA's ground-level air) on ${cores} core${cores === 1 ? '' : 's'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const head = { grid, valid, made: Date.now(), inputs: { rap: { run: inp.rap.run, fh: inp.rap.fh }, rtma: !!(rt), rtmaColumns: rtUsed } };
  return { bytes: gzipSync(MG.encode(arr, head)), head, arrays: arr };
}

/* ── one run: the newest hour (or the one asked), built and sent ──
   `check`: ask the Worker first and do nothing if it already has the hour
   with its surface analysis in it — so the scheduler can ask often and pay
   only when there is something new. Used by the command line below and by
   lambda.mjs. */
export const WORKER = 'https://training-log.rmbuster82.workers.dev/meso';
export async function run({ valid = null, put = null, check = false, out = null, token = process.env.LOG_TOKEN || '', log = (m) => console.log(`[meso] ${m}`) } = {}) {
  if (valid == null) {
    /* the newest hour whose RAP first guess is out */
    const h = Math.floor(Date.now() / 3600e3) * 3600e3;
    for (const v of [h, h - 3600e3]) { if ((await inputs(v)).rap) { valid = v; break; } }
    if (valid == null) { log('no RAP run reaches this hour or the last yet'); return { built: false }; }
  }
  if (check && put) {
    try {
      const r = await fetch(put.replace(/\/$/, '') + '/index');
      const j = r.ok ? await r.json() : null;
      const have = j && j.hours && j.hours.find((x) => x.valid === valid);
      if (have && have.rtma) { log(`${stamp(valid)}Z is already there`); return { built: false }; }
      /* an hour built before its RTMA was out is built again once it is */
      if (have && !(await inputs(valid)).rtma) { log(`${stamp(valid)}Z is there; its RTMA is still not out`); return { built: false }; }
    } catch (e) { log(`could not read the index (${e.message}); building anyway`); }
  }
  const res = await build(valid, { log });
  log(`${stamp(valid)}Z: ${(res.bytes.length / 1024).toFixed(0)} KB`);
  if (out) writeFileSync(out, res.bytes);
  if (put) {
    if (!token) throw new Error('LOG_TOKEN is not set');
    const r = await retry(async () => {
      const x = await fetch(`${put.replace(/\/$/, '')}/${stamp(valid)}`, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' }, body: res.bytes });
      if (x.status >= 500) throw new Error('HTTP ' + x.status);
      return x;
    });
    /* the status only: never the token, never a value (the log is public) */
    log(`sent: HTTP ${r.status}`);
    if (!r.ok) throw new Error(`the Worker answered ${r.status}`);
  }
  return { built: true, valid, bytes: res.bytes.length };
}

/* ── the command line ── */
async function main() {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const v = opt('--valid');
  await run({
    valid: v ? Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10)) : null,
    put: opt('--put') === 'worker' ? WORKER : opt('--put'), check: args.includes('--check'), out: opt('--out')
  });
}
if (!isMainThread) parentPort.postMessage(computeRows(workerData.ctx, workerData.j0, workerData.j1));
else if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('[meso] ' + e.message); process.exitCode = 1; });
