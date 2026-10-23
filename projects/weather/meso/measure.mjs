/* How far off is the browser's mesoanalysis? — node projects/weather/meso/measure.mjs [YYYYMMDDHH]
   ────────────────────────────────────────────────────────────────────────────
   The browser's (modelmaps.js, source `meso`) works from the HRRR's analysis
   hour, which holds the ground and six standard levels, so three of its
   fields are approximations, each named in its label:
     – effective bulk shear: the winds at the standard levels only, and the
       effective inflow base taken as the most-unstable parcel's level when
       the surface parcel does not qualify;
     – DCAPE: on the ground and 1000, 925, 850, 700 and 500 hPa;
     – effective STP: the surface parcel's LCL where SPC uses the mixed
       layer's.
   Here every column of one RAP hour (build.mjs's own, every 25 hPa) is
   worked both ways — the full arithmetic, and the same shortcut the browser
   takes, applied to the same air — so the difference is the shortcut's alone,
   not the HRRR's against the RAP's. The other inputs (CAPE, CIN, the
   parcels, the helicity) come from the full column both times.

   It prints, for each field, where it matters: the mean absolute difference,
   the bias, the 90th percentile, and how often a threshold forecasters use
   is called differently. Ric, 2026-10-22: measure first, so the server
   version is known to be better before anyone signs up for anything. */
import { createRequire } from 'node:module';
import { load, column, columnFields, GRID } from './build.mjs';
const require = createRequire(import.meta.url);
const S = require('../sounding.js');

const KT = 1.943844;
const STD = [1000, 925, 850, 700, 500, 250];

/* the browser's shortcuts (modelmaps.js MESO_FIELDS), on a full column */
export function shortcuts(L) {
  const A = S.analyze(L);
  if (!A) return null;
  const s = A.levels[0], zs = s.z;
  /* only the standard levels, as the HRRR's file holds them */
  const std = A.levels.filter((l, i) => i === 0 || STD.includes(l.p));
  /* effective bulk shear: winds at 10 m and the standard levels */
  let ebwd = 0;
  if (A.mu.cape >= 100 && A.mu.el && A.mu.el.z !== null) {
    const W = S.winds(std);
    const base = A.sb.cape >= 100 && A.sb.cin >= -250 ? 0 : (S.heightAt(A.levels, A.mu.start.p) ?? zs) - zs;
    const top = base + (A.mu.el.z - base) / 2;
    const a = S.windAt(W, Math.max(W[0].h, base)) || W[0], b = S.windAt(W, top) || W[W.length - 1];
    ebwd = Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  /* DCAPE on the ground and five levels */
  const d5 = S.dcape(S.prepare(std.filter((l) => l.p >= 500)), { step: 10 });
  /* effective STP with the surface parcel's LCL in place of the mixed layer's */
  const stp = A.eff && A.sb.cape >= 100 && A.sb.cin >= -250 ? S.stpEffective(A.ml.cape, A.sb.lcl.z, A.ml.cin, A.esrh, A.ebwd, 0) || 0 : 0;
  return { ebwd: ebwd * KT, dcape: d5 ? d5.dcape : NaN, stpe: stp };
}

function stats(pairs, thr) {
  const d = pairs.map(([full, cut]) => cut - full).filter(Number.isFinite).sort((a, b) => Math.abs(a) - Math.abs(b));
  if (!d.length) return null;
  const mae = d.reduce((t, x) => t + Math.abs(x), 0) / d.length, bias = d.reduce((t, x) => t + x, 0) / d.length;
  const p90 = Math.abs(d[Math.floor(d.length * 0.9)]);
  const flips = thr == null ? null : pairs.filter(([f, c]) => (f >= thr) !== (c >= thr)).length / pairs.length;
  return { n: d.length, mae, bias, p90, flips };
}

export async function measure(valid, { step = 2, log = () => {} } = {}) {
  const { rap, rt } = await load(valid, { log });
  const ctx = { rap, rt };
  const pairs = { ebwd: [], dcape: [], stpe: [] };
  for (let jy = 0; jy < GRID.ny; jy += step) for (let ix = 0; ix < GRID.nx; ix += step) {
    const c = column(ctx, GRID.la1 - jy * GRID.dj, GRID.lo1 + ix * GRID.di);
    if (!c) continue;
    const full = columnFields(c.L), cut = shortcuts(c.L);
    if (!full || !cut) continue;
    /* where each matters: shear and STP where there is instability to use it */
    if (full.mucape >= 250) pairs.ebwd.push([full.ebwd, cut.ebwd]);
    pairs.dcape.push([full.dcape, cut.dcape]);
    if (full.stpe >= 0.25 || cut.stpe >= 0.25) pairs.stpe.push([full.stpe, cut.stpe]);
  }
  return { ebwd: stats(pairs.ebwd, 35), dcape: stats(pairs.dcape, 1000), stpe: stats(pairs.stpe, 1) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const v = process.argv[2];
  const valid = v ? Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10)) : Math.floor(Date.now() / 3600e3) * 3600e3 - 3600e3;
  const r = await measure(valid, { log: (m) => console.log('[measure] ' + m) });
  const row = (name, unit, x, thr) => x ? console.log(`${name.padEnd(28)} n=${String(x.n).padStart(6)}  mean |Δ| ${x.mae.toFixed(1).padStart(6)} ${unit}  bias ${x.bias >= 0 ? '+' : ''}${x.bias.toFixed(1)}  90th ${x.p90.toFixed(1)}  ${thr} called differently ${(x.flips * 100).toFixed(1)}%`) : console.log(name, 'no columns');
  row('effective bulk shear (MU≥250)', 'kt', r.ebwd, '35 kt');
  row('DCAPE (every column)', 'J/kg', r.dcape, '1000 J/kg');
  row('effective STP (where ≥0.25)', '', r.stpe, 'STP 1');
}
