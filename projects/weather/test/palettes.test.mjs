/* The colour tables a visitor can pick (UI-REVIEW B7): the colour-blind-safe
   ones have to be, and every table has to be a table.

   "Safe" is measured, not asserted: each palette is run through a simulation
   of the two common red-green colour blindnesses (deuteranopia and
   protanopia; Viénot, Brettel & Mollon 1999, in linear RGB) and the colours
   compared in CIELAB (ΔE76). Reflectivity: any two bands 10 dBZ or more
   apart must not look alike. Velocity: toward and away at the same speed
   must look clearly different. The NWS's own palettes are measured too and
   printed — they fail both, which is why the others exist. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NX = require('../nexrad.js');
const MM = require('../modelmaps.js');

let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fails++; };

const lin = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; };
const SIM = {
  deuteranopia: [[0.29275, 0.70725, 0], [0.29275, 0.70725, 0], [-0.02234, 0.02234, 1]],
  protanopia: [[0.11238, 0.88762, 0], [0.11238, 0.88762, 0], [0.00401, -0.00401, 1]],
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
};
function lab([r, g, b], kind) {
  const L = [lin(r), lin(g), lin(b)], M = SIM[kind];
  const [R, G, B] = M.map((row) => Math.min(1, Math.max(0, row[0] * L[0] + row[1] * L[1] + row[2] * L[2])));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* the closest two reflectivity bands, 10 dBZ or more apart, under each simulation */
function refWorst(pal, kind) {
  let worst = Infinity, at = '';
  for (let a = 10; a <= 70; a += 5) for (let b = a + 10; b <= 70; b += 5) {
    const d = dE(lab(NX.colorOf(pal, a), kind), lab(NX.colorOf(pal, b), kind));
    if (d < worst) { worst = d; at = `${a}/${b} dBZ`; }
  }
  return { worst, at };
}
/* the closest toward/away pair at the same speed */
function velWorst(pal, kind) {
  let worst = Infinity, at = '';
  for (const v of [10, 20, 30, 40, 50, 60]) {
    const d = dE(lab(NX.colorOf(pal, -v), kind), lab(NX.colorOf(pal, v), kind));
    if (d < worst) { worst = d; at = `±${v} kt`; }
  }
  return { worst, at };
}

console.log('\nRULE  every scheme is a table: stops rising, colours that parse, the NWS one first');
for (const [name, set] of Object.entries(NX.SCHEMES)) {
  ok(set.nws === NX.PALETTES[name], `${name}: "nws" is the palette the radar has always drawn with`);
  for (const [k, p] of Object.entries(set)) {
    ok(p.stops.every((s, i) => i === 0 || s[0] > p.stops[i - 1][0]) && p.stops.every((s) => /^#[0-9a-f]{6}$/i.test(s[1])), `${name}.${k}: stops rise and are colours`);
    ok(typeof NX.SCHEME_NAMES[name][k] === 'string', `${name}.${k}: has a name to show`);
  }
  ok(NX.paletteFor(name, 'nosuch') === NX.PALETTES[name], `${name}: an unknown choice falls back to the NWS's`);
}

console.log('\nRULE  the colour-blind-safe tables are, under simulated deuteranopia and protanopia');
for (const kind of ['deuteranopia', 'protanopia']) {
  const nr = refWorst(NX.SCHEMES.ref.nws, kind), cr = refWorst(NX.SCHEMES.ref.cvd, kind);
  console.log(`  ...   reflectivity, ${kind}: NWS closest ΔE ${nr.worst.toFixed(1)} (${nr.at}); colour-blind safe ${cr.worst.toFixed(1)} (${cr.at})`);
  ok(cr.worst >= 15, `reflectivity, ${kind}: no two bands 10 dBZ apart look alike (closest ΔE ${cr.worst.toFixed(1)} at ${cr.at})`);
  const nv = velWorst(NX.SCHEMES.vel.nws, kind), cv = velWorst(NX.SCHEMES.vel.cvd, kind);
  console.log(`  ...   velocity, ${kind}: NWS closest ΔE ${nv.worst.toFixed(1)} (${nv.at}); colour-blind safe ${cv.worst.toFixed(1)} (${cv.at})`);
  ok(cv.worst >= 25, `velocity, ${kind}: toward and away differ at every speed (closest ΔE ${cv.worst.toFixed(1)} at ${cv.at})`);
}

console.log('\nRULE  high contrast tells the bands apart at least as well as the NWS table, to a normal eye');
{
  const n = refWorst(NX.SCHEMES.ref.nws, 'normal'), h = refWorst(NX.SCHEMES.ref.contrast, 'normal');
  ok(h.worst >= n.worst, `closest bands 10 dBZ apart: high contrast ΔE ${h.worst.toFixed(1)} (${h.at}), NWS ${n.worst.toFixed(1)} (${n.at})`);
}

console.log('\nRULE  model and MRMS reflectivity draw with the same choice');
{
  const t = MM.table('dbz', 255, NX.SCHEMES.ref.cvd), base = MM.table('dbz');
  const px = (x) => [x & 255, (x >>> 8) & 255, (x >>> 16) & 255];
  const want = NX.colorOf(NX.SCHEMES.ref.cvd, 40), got = px(t.lookup(40));
  ok(want.every((c, i) => Math.abs(c - got[i]) <= 3), `ModelMaps.table with the colour-blind table draws 40 dBZ as it does (${got} vs ${want})`);
  ok(px(base.lookup(40)).join() !== got.join(), 'and without it, the model\'s own');
  ok(t.lookup(2) === 0, 'below its floor nothing is drawn');
}

if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
console.log('\nall passed');
