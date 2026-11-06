// GAP 3's two readings, separated from the momentum width and from
// THERMAL_KICK_PROB. README items 25 and 31; Ric, 2026-11-06: "sure".
//
// WHY THIS EXISTS AS A FILE. It re-opened item 25, which had been settled the
// same morning, and the register quotes eight rows from it. A measurement that
// overturns a decision has to be re-runnable, so this generates the engine
// variants it needs rather than depending on copies made by hand.
//
// It writes four copies of lab.mjs into the OS temp directory and changes two
// things in them, both one-liners:
//   the momentum width   the module-level MOMENTUM_RANGE is replaced, which
//                        governs both the legality test and the span the
//                        collision sampler draws from.
//   GAP 3's reading      "break" is the file as it stands -- a step that would
//                        stretch a bond breaks it at its cost of B, and a
//                        primitive that cannot pay does not move. "rigid" is
//                        the rival -- a step that would stretch ANY bond does
//                        not happen, at any temperature, so motion never
//                        breaks a bond and only heat does.
// NOTHING IN THE REPO IS MODIFIED: lab.mjs is read and never written.
//
// Everything else is the physics of constants.mjs as it stands, KE_SCALE
// included, so THE +-15 ARM IS NOT THE 2026-11-04 WORLD -- it is today's world
// with narrower momentum, which is what isolates the width rather than
// confounding it with the scale change that +-63 forced.
//
// The metric is mean binding energy over the bonds left standing. Blind
// grabbing gives 5.26 and a perfect bond is 8, so "gain over frozen" -- the
// best mean B at any held T above zero, minus the value at T = 0 -- is the
// annealing claim stated as a number: how much the motion sorted bonds toward
// favoured pairings that blind grabbing would not have found.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "lab.mjs"), "utf8");
const CONSTS = pathToFileURL(join(HERE, "constants.mjs")).href;
const TMP = mkdtempSync(join(tmpdir(), "gap3-"));

const BREAK_LINE = "if (owed > w.energy[i]) { this.counts.blocked++; this.counts.tooColdToMove++; return; }";
const RIGID_LINE = "if (stretched.length > 0) { this.counts.blocked++; this.counts.tooColdToMove++; return; }";

function variant(R, gap) {
  let s = SRC.replace('} from "./constants.mjs";',
    "} from " + JSON.stringify(CONSTS) + ";\nconst __R = " + R + ";");
  s = s.split("const R = MOMENTUM_RANGE;").join("const R = __R;");
  if (s.includes("const R = MOMENTUM_RANGE;")) throw new Error("a momentum-range use was missed");
  if (gap === "rigid") {
    if (!s.includes(BREAK_LINE)) throw new Error("GAP 3's check moved -- this harness needs updating");
    s = s.replace(BREAK_LINE, RIGID_LINE + "   // RIGID VARIANT");
  }
  const p = join(TMP, "lab-" + R + "-" + gap + ".mjs");
  writeFileSync(p, s);
  return p;
}

const { CANDIDATE_ZERO, DIRECTIONS, SETTLED } = await import(CONSTS);
const M = SETTLED.BOND_MODULUS;
const BE = (a, b) => M - Math.abs((a % M) + (b % M) - M);

const engines = {};
for (const R of [15, 63]) for (const G of ["break", "rigid"])
  engines[R + "-" + G] = await import(pathToFileURL(variant(R, G)).href);

const TEMPS = [0, 2, 6, 20];
const SEEDS = [31, 32, 33];
const EV = 1000000;
const BLIND = 5.26;

function bonds(mod, w) {
  let n = 0, sum = 0;
  for (let i = 0; i < w.kind.length; i++) {
    if (w.kind[i] === 0) continue;
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(w.bonds[i] & (1 << d))) continue;
      const j = mod.neighbour(i, d);
      if (j <= i || w.kind[j] === 0) continue;
      n++; sum += BE(w.kind[i], w.kind[j]);
    }
  }
  return { n, meanB: n ? sum / n : 0 };
}

function one(key, kick, T, seed) {
  const mod = engines[key];
  const lab = new mod.Lab({
    constants: { ...CANDIDATE_ZERO, THERMAL_KICK_PROB: kick },
    thermostat: { HOT_T: 1, COLD_T: 1, BAND_ROWS: 3 }, seed });
  lab.seedWorld(0.35, (r) => 1 + r.below(255), { momentumRange: 0 });
  // Hold the whole world at a temperature: e = T * kind is what "temperature
  // T" means under law 2's break rule, which compares e against B * kind.
  if (T > 0) for (let i = 0; i < lab.w.kind.length; i++)
    if (lab.w.kind[i] !== 0) lab.w.energy[i] = T * lab.w.kind[i];
  lab.start();
  lab.run(EV, {});
  // No momentum is supplied at the start, so every move in these runs is the
  // thermal kick, and the kick is a pair in opposite directions. The total
  // must therefore still be exactly zero -- not nearly zero.
  const cen = mod.census(lab.w);
  if (cen.pxSum !== 0 || cen.pySum !== 0)
    throw new Error(`momentum leaked at ${key} T=${T} seed=${seed}: ${cen.pxSum},${cen.pySum}`);
  const b = bonds(mod, lab.w);
  return { n: b.n, mb: b.meanB, st: lab.counts.stepped,
    br: lab.counts.bondsStretched, cold: lab.counts.tooColdToMove };
}

console.log(`GAP 3 separated -- 2x2x2, ${TEMPS.length} temperatures, ${SEEDS.length} seeds, `
  + `${EV / 1e6}M events each, ${2 * 2 * 2 * TEMPS.length * SEEDS.length} runs`);
console.log(`engine variants generated in ${TMP}`);
console.log(`blind grabbing gives mean B ${BLIND}; a perfect bond is ${M}.\n`);

const summary = [];
for (const R of [15, 63]) for (const G of ["break", "rigid"]) for (const kick of [0.02, 0.25]) {
  const label = `+-${String(R).padEnd(2)} ${G.padEnd(5)} kick ${String(kick).padEnd(4)}`;
  console.log(`  ${label}`);
  console.log(`      T    steps   stretch-br  cold-blocked    bonds   meanB`);
  const pts = [];
  for (const T of TEMPS) {
    const a = { n: 0, mb: 0, st: 0, br: 0, cold: 0 };
    for (const s of SEEDS) {
      const r = one(`${R}-${G}`, kick, T, s);
      for (const k of Object.keys(a)) a[k] += r[k];
    }
    const d = (x) => Math.round(x / SEEDS.length), mb = a.mb / SEEDS.length;
    pts.push({ T, n: d(a.n), mb });
    console.log(`    ${String(T).padStart(3)}  ${String(d(a.st)).padStart(7)}  `
      + `${String(d(a.br)).padStart(10)}  ${String(d(a.cold)).padStart(12)}  `
      + `${String(d(a.n)).padStart(7)}  ${mb.toFixed(2).padStart(6)}`);
  }
  const zero = pts[0], best = pts.reduce((x, y) => (y.mb > x.mb ? y : x));
  // A gain under about 0.1 is inside the seed-to-seed spread, so it is not a
  // peak. Reporting one would be reporting noise.
  const gain = best.mb - zero.mb, real = best.T !== 0 && gain >= 0.1;
  summary.push({ label, best, gain, real, hold: zero.n ? best.n / zero.n : 0 });
  console.log(`      -> best ${best.mb.toFixed(2)} at T=${best.T}; `
    + (real ? `PEAK, +${gain.toFixed(2)} over frozen` : `no peak (+${gain.toFixed(2)} is noise)`)
    + `; bonds kept ${(summary.at(-1).hold * 100).toFixed(0)}%\n`);
}

console.log("=".repeat(76));
console.log("  arm                       best meanB   gain over frozen   bonds kept");
for (const r of summary)
  console.log(`  ${r.label}      ${r.best.mb.toFixed(2)}        `
    + `${(r.real ? "+" + r.gain.toFixed(2) : "none").padEnd(14)}     ${(r.hold * 100).toFixed(0)}%`);
console.log(`\n  Momentum was asserted exactly (0, 0) after every run.`);
