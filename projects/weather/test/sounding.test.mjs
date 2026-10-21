/* The sounding arithmetic — node projects/weather/test/sounding.test.mjs
   Each rule is a property a meteorologist could check by hand: Bolton's LCL,
   a straight-line wind profile whose shear and Bunkers motion are exact,
   helicity whose sign follows the hodograph's turn, and a capped, juicy
   profile that must have CAPE above its LFC and CIN under it while a stable
   one has none. REFERENCE below holds values MetPy (the standard Python
   library) computed for the same profiles. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../sounding.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

/* A profile every 25 hPa from the surface to 100 hPa: temperature and
   dewpoint from functions of pressure, heights by the hypsometric equation,
   winds from a function of height. */
function build({ ps = 1000, zs = 300, t, td, wind = () => [null, null] }) {
  const out = [];
  let z = zs, prev = null;
  for (let p = ps; p >= 100; p -= 25) {
    const T = t(p), D = Math.min(td(p), T);
    if (prev) {
      const tv = ((prev.t + T) / 2 + 273.15) * (1 + 0.61 * S.mixing((prev.p + p) / 2, (prev.td + D) / 2));
      z += 287.04 * tv / 9.80665 * Math.log(prev.p / p);
    }
    const [wd, ws] = wind(z - zs);
    prev = { p, z, t: T, td: D, wd, ws };
    out.push(prev);
  }
  return out;
}
/* the dry adiabat through (1000 hPa, t0) */
const dry = (t0, ps = 1000) => p => (t0 + 273.15) * Math.pow(p / ps, 0.2857) - 273.15;

console.log('\nRULE  the textbook parts');
{
  const c = S.lcl(1000, 30, 20);
  ok(near(c.t, 17.6, 0.4) && near(c.p, 862, 6), `LCL from 30/20 °C at 1000 hPa: ${c.t.toFixed(1)} °C at ${c.p.toFixed(0)} hPa (Bolton: ~17.6 °C, ~862 hPa)`);
  ok(near(S.es(0), 6.112, 1e-3) && near(S.es(20), 23.37, 0.05), 'saturation vapour pressure: 6.11 hPa at 0 °C, 23.4 at 20 °C');
  ok(near(S.mixing(1000, 20) * 1000, 14.9, 0.2), 'mixing ratio at 20 °C dewpoint, 1000 hPa: ~14.9 g/kg');
  ok(near(S.theta(850, 10), 296.4, 0.3), 'θ of 10 °C at 850 hPa: ~296.4 K');
  const m = S.moistLift(1000, 20, 500);
  ok(m < -3 && m > -9, `a saturated 20 °C parcel lifted from 1000 to 500 hPa: ${m.toFixed(1)} °C`);
  ok(S.moistLift(850, 10, 850) === 10, 'lifting nowhere changes nothing');
}

console.log('\nRULE  a capped, juicy afternoon has CAPE above the LFC and CIN below it');
const loaded = build({
  t: p => p >= 850 ? dry(32)(p) + (p < 880 ? 3 : 0)        // a well-mixed layer under a 3 °C cap
    : p >= 250 ? dry(32)(850) + 3 - (850 - p) * 0.1       // ~7.5 °C/km aloft
    : dry(32)(850) + 3 - 600 * 0.1,
  td: p => p >= 850 ? 22 - (1000 - p) * 0.02 : -5 - (850 - p) * 0.06,
  wind: h => [240 + Math.min(h, 6000) / 6000 * 30, 5 + Math.min(h, 6000) / 6000 * 25]
});
const A = S.analyze(loaded);
/* smooth and ordinary: ~30 °C under a steady lapse rate, moisture falling off with height */
const smooth = build({ t: p => Math.max(30 - 55 * Math.log(1000 / p), -60), td: p => Math.max(Math.min(21 - 0.07 * (1000 - p), 30), -70) });
ok(A && A.sb.cape > 2000, `SBCAPE ${A && A.sb.cape} J/kg — a lot`);
ok(A && A.sb.cin < -5, `SBCIN ${A && A.sb.cin} J/kg — capped`);
ok(A && A.sb.lcl.z > 500 && A.sb.lfc && A.sb.lfc.z > A.sb.lcl.z && A.sb.el.z > A.sb.lfc.z + 5000,
  `LCL ${A && Math.round(A.sb.lcl.z)} m < LFC ${A && A.sb.lfc && Math.round(A.sb.lfc.z)} m < EL ${A && A.sb.el && Math.round(A.sb.el.z)} m`);
ok(A && A.mu.cape >= A.ml.cape - 1 && A.mu.cape >= A.sb.cape - 1, 'the most-unstable parcel has the most CAPE');
ok(A && A.pw > 25 && A.pw < 60, `precipitable water ${A && A.pw.toFixed(1)} mm`);
ok(A && A.lapse75 > 6 && A.lapse75 < 9, `700–500 hPa lapse rate ${A && A.lapse75.toFixed(1)} °C/km`);
ok(A && A.frz > 3000 && A.frz < 5000, `freezing level ${A && Math.round(A.frz)} m`);

console.log('\nRULE  a stable column has none');
{
  const stable = build({ t: p => 10 - (1000 - p) * 0.02, td: p => -10 - (1000 - p) * 0.03 });
  const B = S.analyze(stable);
  ok(B && B.sb.cape === 0 && B.ml.cape === 0 && B.sb.lfc === null && B.sb.el === null, 'no CAPE, no LFC, no EL');
  ok(B && B.stp === null || B.stp === 0, 'and no tornado parameter worth the name');
}

console.log('\nRULE  wind: shear, Bunkers motion and helicity');
{
  /* straight-line: westerly, 0 m/s at the ground to 30 m/s at 6 km */
  const straight = build({ t: dry(25), td: () => 5, wind: h => [270, Math.min(h, 6000) / 200] });
  const W = S.winds(S.prepare(straight));
  /* the levels either side of 6 km straddle the profile's kink, so linear
     interpolation lands a little under 30 */
  ok(near(S.shear(W, 6000), 30, 0.6), `0–6 km shear ~30 m/s: ${S.shear(W, 6000).toFixed(2)}`);
  const b = S.bunkers(W);
  ok(near(b.mean[0], 15, 0.4) && near(b.mean[1], 0, 1e-6), `0–6 km mean wind 15 m/s from the west: (${b.mean.map(x => x.toFixed(2))})`);
  ok(near(b.right[0], 15, 0.4) && near(b.right[1], -7.5, 1e-6) && near(b.left[1], 7.5, 1e-6), 'right-mover 7.5 m/s to the right (south) of it, left-mover to the north');

  /* curved: the wind turns clockwise with height (veers) vs counter-clockwise (backs) */
  const veer = build({ t: dry(25), td: () => 5, wind: h => [(180 + Math.min(h, 3000) / 3000 * 90) % 360, 10 + Math.min(h, 6000) / 400] });
  const back = build({ t: dry(25), td: () => 5, wind: h => [(180 - Math.min(h, 3000) / 3000 * 90 + 360) % 360, 10 + Math.min(h, 6000) / 400] });
  const sv = S.analyze(veer), sb = S.analyze(back), ss = S.analyze(straight);
  ok(sv.srh3 > 100 && sv.srh3 > ss.srh3, `a veering hodograph has large positive 0–3 km SRH: ${Math.round(sv.srh3)} m²/s²`);
  ok(sb.srh3 < sv.srh3 && sb.srh1 < sv.srh1, `a backing one has much less: ${Math.round(sb.srh3)} m²/s²`);
  ok(S.windAt(W, -5) === null && S.srh(W, 1000, null) === null, 'outside the column, or with no storm motion, nothing is made up');
}

console.log('\nRULE  shaping the providers\' answers');
{
  const j = { elevation: 300, hourly: { time: [0], surface_pressure: [980], temperature_2m: [25], dew_point_2m: [18], wind_speed_10m: [5], wind_direction_10m: [180],
    temperature_1000hPa: [26], geopotential_height_1000hPa: [120], dew_point_1000hPa: [19], wind_speed_1000hPa: [6], wind_direction_1000hPa: [180],
    temperature_850hPa: [15], geopotential_height_850hPa: [1500], dew_point_850hPa: [10], wind_speed_850hPa: [12], wind_direction_850hPa: [210] } };
  const prof = S.fromOpenMeteo(j, 0);
  ok(prof.length === 2 && prof[0].p === 980 && prof[1].p === 850, 'the ground first; a pressure level below the ground (1000 hPa under a 980 hPa surface) is dropped');
  const aifs = JSON.parse(JSON.stringify(j)); delete aifs.hourly.dew_point_850hPa; aifs.hourly.relative_humidity_850hPa = [100 * S.es(10) / S.es(15)];
  ok(near(S.fromOpenMeteo(aifs, 0)[1].td, 10, 0.1), 'a model that gives humidity instead of dewpoint (ECMWF AIFS): the dewpoint is made from it');
  ok(S.fromOpenMeteo(j, 5) === null && S.fromOpenMeteo({}, 0) === null, 'an hour that is not there is nothing');
  const r = S.fromRaob({ profiles: [{ station: 'KABC', valid: '2026-10-17T12:00:00Z', profile: [
    { pres: 1000, hght: 300, tmpc: null, dwpc: null, drct: null, sknt: null },
    { pres: 995, hght: 357, tmpc: 5.8, dwpc: 3.8, drct: 0, sknt: 10 },
    { pres: 900, hght: 1200, tmpc: 1, dwpc: null, drct: 90, sknt: 20 }] }] });
  ok(r.station === 'KABC' && r.levels.length === 2 && near(r.levels[0].ws, 5.14, 0.01) && r.levels[1].td === null, 'a balloon: empty levels dropped, knots to m/s, missing dewpoints kept as missing');
}

/* ── against MetPy ──
   MetPy 1.7.1, the standard Python library, on the same two profiles —
   computed once on 2026-10-17 and pinned here. MetPy works without the
   virtual-temperature correction, so these compare our plain-temperature
   parcel (useVirtual = false) with its own.

   The parcel agrees within 0.15 °C all the way to 300 hPa (a few hundredths
   near the ground; the gap grows with height through small differences in
   constants such as Rd/Cp), and LFC and EL within 2 hPa. Its cape_cin() reports a few percent more CAPE and
   less CIN than the textbook integral of its own parcel: integrating MetPy's
   parcel_profile by hand (Rd ∫ (Tparcel − Tenv) d ln p, positive area from LFC
   to EL, negative area below the LFC) gave 2295 / −191 J/kg on `smooth`,
   against our 2342 / −189 — the difference being our finer steps along the
   curved parcel. So the pinned CAPE/CIN are that hand integral. */
console.log('\nRULE  agrees with MetPy on the same profiles');
{
  const M = {
    smooth: { parcel: { 850: 17.74, 700: 10.7, 500: -2.74, 300: -28.2 }, lfc: 712.3, el: 177.2, cape: 2295, cin: -191 },
    loaded: { parcel: { 850: 19.0, 700: 12.13, 500: -0.86, 300: -25.29 }, lfc: 812.7, el: 237.4, lclp: 864.7, pw: 34.95 }
  };
  for (const [name, prof] of [['smooth', smooth], ['loaded', loaded]]) {
    const L = S.prepare(prof), ref = M[name];
    const pl = S.parcel(L, S.parcels(L).sb, 100, false);
    const worst = Math.max(...Object.entries(ref.parcel).map(([pp, t]) => Math.abs(pl.path.find(q => q.p === Number(pp)).t - t)));
    ok(worst < 0.2, `${name}: the parcel matches MetPy's at 850/700/500/300 hPa to ${worst.toFixed(2)} °C`);
    ok(near(pl.lfc.p, ref.lfc, 3) && near(pl.el.p, ref.el, 3), `${name}: LFC ${pl.lfc.p.toFixed(1)} / EL ${pl.el.p.toFixed(1)} hPa vs MetPy ${ref.lfc} / ${ref.el}`);
    if (ref.cape) ok(near(pl.cape, ref.cape, ref.cape * 0.03) && near(pl.cin, ref.cin, 10), `${name}: CAPE ${pl.cape} / CIN ${pl.cin} vs the integral of MetPy's parcel ${ref.cape} / ${ref.cin}`);
  }
  ok(near(A.sb.lcl.p, M.loaded.lclp, 1.5), `LCL ${A.sb.lcl.p.toFixed(1)} hPa vs MetPy ${M.loaded.lclp}`);
  ok(near(A.pw, M.loaded.pw, 1.5), `precipitable water ${A.pw.toFixed(2)} mm vs MetPy ${M.loaded.pw}`);
  ok(near(S.moistLift(1000, 20, 500), -8.48, 0.15), `the pseudo-adiabat from 20 °C at 1000 hPa reaches ${S.moistLift(1000, 20, 500).toFixed(2)} °C at 500 (MetPy −8.48)`);
  const v = S.parcel(S.prepare(smooth), S.parcels(S.prepare(smooth)).sb);
  ok(v.cape > 2342 && v.cin > -189, `with the virtual-temperature correction (the page's numbers, as SPC does it) CAPE rises and CIN shrinks: ${v.cape} / ${v.cin}`);
}

console.log('\nRULE  the drawings hold only real numbers');
{
  const D = require('../draw.js');
  const withWind = build({ t: dry(30), td: () => 10, wind: h => [200 + h / 200, 5 + h / 400] });
  for (const [name, a] of [['loaded', A], ['smooth', S.analyze(smooth)], ['windy', S.analyze(withWind)]]) {
    const sk = D.skewT(a), ho = D.hodograph(a);
    ok(sk.startsWith('<svg') && !/NaN|undefined|Infinity/.test(sk), `${name}: the Skew-T draws with no NaN`);
    ok(!/NaN|undefined|Infinity/.test(ho), `${name}: so does the hodograph (${ho ? 'drawn' : 'no winds, nothing drawn'})`);
  }
  const stable = S.analyze(build({ t: p => 5 + p / 400, td: () => -20 }));
  ok(stable.sb.cape === 0 && stable.sb.cin === 0 && stable.sb.lfc === null, `a stable, nearly isothermal, dry column has no LFC, so no CAPE and no CIN: ${stable.sb.cape} / ${stable.sb.cin}`);
  const both = D.skewT(A, { compare: { levels: S.analyze(smooth).levels.concat([{ p: 300, t: NaN, td: null }]) } });
  ok((both.match(/stroke-dasharray="2 3"/g) || []).length === 2 && !/NaN|undefined|Infinity/.test(both), 'a balloon laid over the model draws two dotted lines, skipping a missing reading');
  ok(D.barb(0, 0, 270, 65).includes('<polygon') && (D.barb(0, 0, 270, 65).match(/<line/g) || []).length === 3, 'a 65 kt barb: one flag, one full barb, one half (plus the staff)');
  ok(D.barb(0, 0, 0, 1).includes('<circle'), 'calm is a circle');
  ok(D.xOf(0, 1000) < D.xOf(0, 500), 'isotherms lean right going up');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL SOUNDING RULES PASS'));
process.exit(failures ? 1 : 0);
