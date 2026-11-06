// GAP 3's three readings, measured against each other. README items 25 and
// 31; Ric, 2026-11-06: "fix them".
//
// WHY THIS EXISTS AS A FILE. It re-opened item 25 hours after it was settled,
// and the register quotes its rows. A measurement that overturns a decision
// has to be re-runnable, so this generates the engine variants it needs
// rather than depending on copies made by hand. NOTHING IN THE REPO IS
// MODIFIED: lab.mjs is read and never written.
//
// The three readings of "what happens to a bond that motion would stretch":
//
//   drag    what lab.mjs does now, and what law 1 says: the bond holds and
//           the whole cluster goes together. Weak bonds still snap, because
//           the test is unchanged -- a bond holds exactly when the stepper
//           cannot afford its binding energy.
//   first   the same drag, tried BEFORE the affordability test instead of
//           after it. The argument for it is a division of labour rather
//           than a preference: breaking bonds is law 2's job, and it already
//           owns a sharper test for it -- temperature at or above B. Letting
//           law 1 break bonds too is what GAP 3 invented, and "drag" leaves
//           that invention in charge whenever the stepper happens to be able
//           to pay. Here motion only ever MOVES matter, and a cluster
//           shatters when it is crowded rather than merely warm.
//   break   the original reading. The bond always breaks when it can be paid
//           for, and when it cannot, NOTHING HAPPENS. Produced here by
//           disabling the drag call, which leaves the old code path exactly.
//   rigid   the rival. A step that would stretch any bond does not happen at
//           any temperature, so motion never breaks a bond and only heat does.
//   hold    both of the above at once, and the end of that argument: try the
//           drag first, and if it is REFUSED, hold. Motion then never breaks
//           a bond under any circumstances -- breaking is law 2's alone --
//           but a cluster with room still moves, which is the thing "rigid"
//           cannot do. It is the reading to beat, because it is the only one
//           that takes both halves of law 1 at its word.
//
// The momentum width is the second axis, because item 31 found it a real if
// secondary cause. THERMAL_KICK_PROB is NOT an axis: item 31 exonerated it,
// a 12x change moving the result by at most 0.15, so it is held at the
// shipped value.
//
// ALL THREE ARMS CARRY law 1's |p|/K inertia, which went in alongside the
// drag. So the "break" arm here is NOT the 5.74 that item 31 recorded for
// the shipped physics -- that was measured when a bonded primitive had the
// inertia of a speck. Isolating GAP 3 means changing only GAP 3.
//
// The metric is mean binding energy over the bonds left standing. Blind
// grabbing gives 5.26 and a perfect bond is 8, so "gain over frozen" -- the
// best mean B at any held T above zero, minus the value at T = 0 -- is the
// annealing claim as a number: how much the motion sorted bonds toward
// favoured pairings that blind grabbing would not have found.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "lab.mjs"), "utf8");
const CONSTS = pathToFileURL(join(HERE, "constants.mjs")).href;
const TMP = mkdtempSync(join(tmpdir(), "gap3-"));

const IMPORT_LINE = '} from "./constants.mjs";';
const RANGE_USE = "const R = MOMENTUM_RANGE;";
const DRAG_CALL = "if (this.dragCluster(i, d)) return j;";
const AFFORD = "if (owed > w.energy[i]) {";
const ALWAYS = "if (stretched.length > 0) {";
const OWED_DECL = "      let owed = 0;";

function variant(R, gap) {
  let s = SRC.replace(IMPORT_LINE, "} from " + JSON.stringify(CONSTS) + ";\nconst __R = " + R + ";");
  s = s.split(RANGE_USE).join("const R = __R;");
  if (s.includes(RANGE_USE)) throw new Error("a momentum-range use was missed");
  if (gap !== "drag") {
    if (!s.includes(DRAG_CALL)) throw new Error("the drag call moved -- this harness needs updating");
    s = s.replace(DRAG_CALL, "/* drag disabled for the " + gap + " arm */");
  }
  if (gap === "first" || gap === "hold") {
    // Move the drag ahead of the affordability test. It is attempted only
    // when a bond would actually be stretched, so an unbonded step is
    // untouched and no cluster is walked for nothing.
    if (!s.includes(OWED_DECL)) throw new Error("the owed declaration moved");
    s = s.replace(OWED_DECL,
      "      if (stretched.length > 0 && this.dragCluster(i, d)) return j;\n" + OWED_DECL);
  }
  if (gap === "rigid" || gap === "hold") {
    if (!s.includes(AFFORD)) throw new Error("GAP 3's affordability test moved");
    s = s.replace(AFFORD, ALWAYS);
  }
  const p = join(TMP, "lab-" + R + "-" + gap + ".mjs");
  writeFileSync(p, s);
  return p;
}

const { CANDIDATE_ZERO, DIRECTIONS, SETTLED } = await import(CONSTS);
const M = SETTLED.BOND_MODULUS;
const BE = (a, b) => M - Math.abs((a % M) + (b % M) - M);

const READINGS = ["hold", "first", "drag", "break", "rigid"];
const WIDTHS = [15, 63];
const engines = {};
for (const R of WIDTHS) for (const G of READINGS)
  engines[R + "-" + G] = await import(pathToFileURL(variant(R, G)).href);

const TEMPS = [0, 2, 6, 20];
const SEEDS = [31, 32, 33];
const EV = 1000000;
const BLIND = 5.26;
const NOISE = 0.1;   // a gain under this is inside the seed-to-seed spread

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

function one(key, T, seed) {
  const mod = engines[key];
  const lab = new mod.Lab({ constants: CANDIDATE_ZERO,
    thermostat: { HOT_T: 1, COLD_T: 1, BAND_ROWS: 3 }, seed });
  lab.seedWorld(0.35, (r) => 1 + r.below(255), { momentumRange: 0 });
  // Hold the world at a temperature: e = T * kind is what "temperature T"
  // means under law 2's break rule, which compares e against B * kind.
  if (T > 0) for (let i = 0; i < lab.w.kind.length; i++)
    if (lab.w.kind[i] !== 0) lab.w.energy[i] = T * lab.w.kind[i];
  lab.start();
  lab.run(EV, {});
  // No momentum is supplied at the start, so every move is the thermal kick,
  // and the kick is a pair in opposite directions. The total must therefore
  // still be exactly zero -- not nearly zero. A drag is a rigid translation
  // and cannot change it either, which is the point of asserting here.
  const cen = mod.census(lab.w);
  if (cen.pxSum !== 0 || cen.pySum !== 0)
    throw new Error("momentum leaked at " + key + " T=" + T + ": " + cen.pxSum + "," + cen.pySum);
  const b = bonds(mod, lab.w);
  return { n: b.n, mb: b.meanB, st: lab.counts.stepped, dr: lab.counts.dragged,
    dm: lab.counts.draggedMembers, db: lab.counts.dragBlocked,
    big: lab.counts.dragLargest, br: lab.counts.bondsStretched,
    cold: lab.counts.tooColdToMove, blk: lab.counts.blocked };
}

console.log("GAP 3's three readings -- " + WIDTHS.length + " widths, " + TEMPS.length
  + " temperatures, " + SEEDS.length + " seeds, " + (EV / 1e6) + "M events each, "
  + (WIDTHS.length * READINGS.length * TEMPS.length * SEEDS.length) + " runs");
console.log("variants in " + TMP);
console.log("blind grabbing gives mean B " + BLIND + "; a perfect bond is " + M + ".\n");

const summary = [];
for (const R of WIDTHS) for (const G of READINGS) {
  const label = "+-" + String(R).padEnd(2) + " " + G.padEnd(5);
  console.log("  " + label);
  console.log("      T    steps    drags  members  refused  stretch-br   bonds   meanB");
  const pts = [];
  let largest = 0;
  for (const T of TEMPS) {
    const a = { n: 0, mb: 0, st: 0, dr: 0, dm: 0, db: 0, br: 0, cold: 0, blk: 0 };
    for (const s of SEEDS) {
      const r = one(R + "-" + G, T, s);
      for (const k of Object.keys(a)) a[k] += r[k];
      if (r.big > largest) largest = r.big;
    }
    const d = (x) => Math.round(x / SEEDS.length), mb = a.mb / SEEDS.length;
    pts.push({ T, n: d(a.n), mb });
    console.log("    " + String(T).padStart(3) + "  " + String(d(a.st)).padStart(7)
      + "  " + String(d(a.dr)).padStart(7) + "  " + String(d(a.dm)).padStart(7)
      + "  " + String(d(a.db)).padStart(7) + "  " + String(d(a.br)).padStart(10)
      + "  " + String(d(a.n)).padStart(6) + "  " + mb.toFixed(2).padStart(6));
  }
  const zero = pts[0], best = pts.reduce((x, y) => (y.mb > x.mb ? y : x));
  const gain = best.mb - zero.mb, real = best.T !== 0 && gain >= NOISE;
  const hold = zero.n ? best.n / zero.n : 0;
  summary.push({ label, best, gain, real, hold, largest });
  console.log("      -> best " + best.mb.toFixed(2) + " at T=" + best.T + "; "
    + (real ? "PEAK, +" + gain.toFixed(2) + " over frozen"
            : "no peak (+" + gain.toFixed(2) + " is noise)")
    + "; bonds kept " + (hold * 100).toFixed(0) + "%"
    + (largest ? "; largest cluster dragged " + largest : "") + "\n");
}

console.log("=".repeat(78));
console.log("  arm           best meanB   over blind   gain over frozen   bonds kept");
for (const r of summary)
  console.log("  " + r.label + "        " + r.best.mb.toFixed(2) + "        +"
    + (r.best.mb - BLIND).toFixed(2) + "        "
    + (r.real ? "+" + r.gain.toFixed(2) : "none").padEnd(14) + "     "
    + (r.hold * 100).toFixed(0) + "%");
console.log("\n  Momentum was asserted exactly (0, 0) after every run.");
