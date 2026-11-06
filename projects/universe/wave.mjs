// Does a bonded cluster move, and did the momentum wave help? README items
// 25, 32 and 33. Ric, 2026-11-06, having asked how reality resolves GAP 3:
// "Do it".
//
// GAP 3 asks what happens to a bond that motion would stretch, and as of
// 2026-11-06 the answer is the shortest of the four readings tried: the bond
// holds and the step does not happen. Nothing is added. This file is the
// measurement that got it there, and it is kept because two of its three
// results contradict things this project had been saying confidently.
//
//   A  Does a bonded pair actually move, and does the bond's angle matter?
//      On a hex lattice i and i+d share two common neighbours, so a bond
//      within 60 degrees of the direction of travel survives a step and a
//      bond at 120 or 180 does not.
//      PREDICTED: transverse pairs translate freely, and a pair whose bond
//      lies ALONG its travel cannot translate at all -- the front member
//      would need the bond to span two hexagons, and the back member has the
//      front one in its way.
//      MEASURED: WRONG. All four orientations translate. A longitudinal pair
//      manages 56 hexagons against 115 for a transverse one, because the
//      pair ROTATES out of the locked geometry rather than stalling in it:
//      each refused step leaves the momentum where it was, the step direction
//      is redrawn from it, and the pair reorients. Slower, not impossible.
//
//   B  Did the momentum wave buy anything? A method was built the same day
//      to carry a refused step's momentum along the bond, one unit per event
//      -- local, conserving, and exactly what law 1's "once momentum has
//      SPREAD across a bonded group" describes.
//      MEASURED: it made things worse. It is in rejected/push-along-bond.txt
//      with the table. This file injects it back into a copy of the engine so
//      that run can be repeated.
//
//   C  Does law 1's |p| / K inertia emerge, with nothing computing K?
//      MEASURED: no sign of it. Momentum per member is flat across cluster
//      sizes. Item 33.
//
// AN OBSERVER MAY READ THE WHOLE WORLD. The cluster walks below are not
// physics and are not in lab.mjs; they are this file looking at the output,
// the way a microscope is allowed to see more than a molecule does. Rule 9
// binds the laws, not the instruments.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONSTS = pathToFileURL(join(HERE, "constants.mjs")).href;
const PLAIN = await import(pathToFileURL(join(HERE, "lab.mjs")).href);
const { neighbour, census, at, DIR_CUBE, N, CELLS } = PLAIN;
const { CANDIDATE_ZERO, DIRECTIONS, SETTLED } = await import(CONSTS);
const M = SETTLED.BOND_MODULUS;
const BE = (a, b) => M - Math.abs((a % M) + (b % M) - M);

// --------------------------------------------- the rejected mechanism, back
// lab.mjs no longer contains the push, so the comparison arm is built by
// putting it back rather than by taking it out. Three inserts, each anchored
// on a line that would be noticed if it moved -- an anchor that silently
// stops matching would leave this reporting the plain engine twice and
// calling it a null result, which is the failure mode rule 12 warns about.
const SRC = readFileSync(join(HERE, "lab.mjs"), "utf8");
const DOC = readFileSync(join(HERE, "rejected", "push-along-bond.txt"), "utf8");
const MARKER = "--- METHOD BELOW THIS LINE ---";
if (!DOC.includes(MARKER)) throw new Error("the rejected method's marker is gone");
const METHOD = DOC.slice(DOC.indexOf(MARKER) + MARKER.length).replace(/^\r?\n/, "");

const A_METHOD = "  step(i) {";
const A_CALL = "        this.counts.tooColdToMove++;\n        this.counts.blocked++;";
const A_COUNTS = "      bondedStepped: 0,";
const TMP = mkdtempSync(join(tmpdir(), "wave-"));

function withPush() {
  let s = SRC.replace('} from "./constants.mjs";', "} from " + JSON.stringify(CONSTS) + ";");
  for (const [name, anchor] of [["method", A_METHOD], ["call", A_CALL], ["counters", A_COUNTS]]) {
    if (s.split(anchor).length - 1 !== 1)
      throw new Error(`the ${name} anchor matched ${s.split(anchor).length - 1} times, need 1`);
  }
  s = s.replace(A_COUNTS, A_COUNTS
    + "\n      pushedAlongBond: 0, pushRangeDeclined: 0, pushUnaffordable: 0,");
  s = s.replace(A_METHOD, METHOD + "\n" + A_METHOD);
  s = s.replace(A_CALL, "        this.counts.tooColdToMove++;\n"
    + "        this.pushAlongBond(i, d, stretched);\n        this.counts.blocked++;");
  const p = join(TMP, "lab-push.mjs");
  writeFileSync(p, s);
  return p;
}
const PUSH = await import(pathToFileURL(withPush()).href);
const engines = { plain: PLAIN, push: PUSH };

// ---------------------------------------------------------------- observer
function clusters(w) {
  const seen = new Int32Array(CELLS).fill(-1);
  const out = [];
  for (let s = 0; s < CELLS; s++) {
    if (w.kind[s] === 0 || seen[s] !== -1) continue;
    const stack = [s], members = [];
    seen[s] = out.length;
    while (stack.length) {
      const x = stack.pop();
      members.push(x);
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[x] & (1 << d))) continue;
        const y = neighbour(x, d);
        if (w.kind[y] === 0 || seen[y] !== -1) continue;
        seen[y] = out.length; stack.push(y);
      }
    }
    let K = 0;
    for (const m of members) K += w.kind[m];
    out.push({ members, K });
  }
  return out;
}

function bondStats(w) {
  let n = 0, sum = 0;
  for (let i = 0; i < CELLS; i++) {
    if (w.kind[i] === 0) continue;
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(w.bonds[i] & (1 << d))) continue;
      const j = neighbour(i, d);
      if (j <= i || w.kind[j] === 0) continue;
      n++; sum += BE(w.kind[i], w.kind[j]);
    }
  }
  return { n, meanB: n ? sum / n : 0 };
}

// Kind-weighted centre of a cluster, without wrapping -- these runs start in
// the middle and are short, so nothing reaches the seam.
function centre(w, members) {
  let K = 0, cx = 0, cy = 0;
  for (const m of members) {
    const q = m % N, r = (m - q) / N;
    const k = w.kind[m];
    K += k; cx += q * k; cy += r * k;
  }
  return [cx / K, cy / K, K];
}

// ------------------------------------------------- A: one pair in a vacuum
// Two primitives, bonded, alone, equal momentum in one direction, no heat
// anywhere else. Two primitives under one law is a measurement rather than a
// claimed world, which orbit.mjs established is allowed here.
function pairRun({ bondDir, moveDir, kinds, p, events, which = "plain" }) {
  const mod = engines[which];
  const lab = new mod.Lab({ constants: CANDIDATE_ZERO,
    thermostat: { HOT_T: 0, COLD_T: 0, BAND_ROWS: 0 }, seed: 7 });
  const w = lab.w;
  const i = at(Math.floor(N / 2), Math.floor(N / 2));
  const j = neighbour(i, bondDir);
  const u = DIR_CUBE[moveDir];
  w.kind[i] = kinds[0]; w.kind[j] = kinds[1];
  // Bonds are symmetric and both ends must agree, or the seam is left open.
  w.bonds[i] |= (1 << bondDir);
  for (let f = 0; f < DIRECTIONS; f++) if (neighbour(j, f) === i) w.bonds[j] |= (1 << f);
  // Both get the same momentum, so the pair is already moving together and
  // the only question is whether the lattice lets it continue.
  for (const m of [i, j]) { w.mx[m] = u[0] * p; w.my[m] = u[1] * p; }
  // Enough heat to pay for an inelastic transfer, and NOT ENOUGH TO BREAK THE
  // BOND, which is a narrower window than it looks and this file got wrong on
  // its first run. Law 2 breaks a bond at e >= B * kind, so the heat has to
  // stay under B * kind -- and the kinds have to be a pair that binds at all.
  // Kind 40 has v = 40 mod 8 = 0 and B(0, 0) = 0, so the first version bonded
  // two primitives whose bond had zero binding energy and then heated them to
  // a temperature of 100. Every run reported BOND LOST and it was law 2 doing
  // exactly what it should.
  const cap = BE(kinds[0], kinds[1]) * Math.min(kinds[0], kinds[1]);
  if (cap === 0) throw new Error(`kinds ${kinds} do not bond: B = 0`);
  for (const m of [i, j]) w.energy[m] = Math.floor(cap / 4);
  lab.start();
  const before = centre(w, [i, j]);
  // The pair is moving, so the world's momentum is NOT zero here -- it is the
  // 2p that was put in, and the thing to assert is that it does not CHANGE.
  // (Asserting zero was this file's own bug for one run: the Lab reported
  // (60, -60) and was right. The engine's own runs start at zero because the
  // thermal kick only ever makes opposite pairs.)
  const p0 = census(w);
  lab.run(events, {});
  const c = census(w);
  if (c.pxSum !== p0.pxSum || c.pySum !== p0.pySum)
    throw new Error(`momentum changed: started (${p0.pxSum}, ${p0.pySum}), `
      + `ended (${c.pxSum}, ${c.pySum})`);
  const cs = clusters(w).filter((c2) => c2.members.length > 1);
  const after = cs.length === 1 ? centre(w, cs[0].members) : null;
  const moved = after ? Math.hypot(after[0] - before[0], after[1] - before[1]) : 0;
  return { moved, bonded: cs.length === 1, steps: lab.counts.stepped,
    pushes: lab.counts.pushedAlongBond || 0 };
}

console.log("=== A. one bonded pair alone in a vacuum, moving ===");
console.log("    does it translate, does the bond's angle matter, and did the");
console.log("    rejected momentum wave help? (centre of mass, 200k events)\n");
console.log("                     as it ships      with the rejected wave");
console.log("   bond vs travel      moved           moved   pushes");
// Direction 0 is the travel direction throughout. Bond direction 1 is 60
// degrees off it, 2 is 120, 3 is 180 (directly behind), 5 is -60.
for (const [bondDir, label] of [[1, "  60 deg"], [5, " -60 deg"], [2, " 120 deg"], [3, " 180 deg"]]) {
  const o = { bondDir, moveDir: 0, kinds: [44, 44], p: 30, events: 200000 };
  const a = pairRun({ ...o, which: "plain" });
  const b = pairRun({ ...o, which: "push" });
  console.log(`   ${label}      ${a.moved.toFixed(1).padStart(7)}        `
    + `${b.moved.toFixed(1).padStart(7)}  ${String(b.pushes).padStart(6)}`
    + (a.bonded ? "" : "   BOND LOST")
    + (b.bonded ? "" : "   wave arm lost its bond"));
}
console.log("\n   Every orientation translates, so the prediction that a longitudinal");
console.log("   pair cannot move was wrong -- it rotates out of the locked geometry");
console.log("   instead of stalling in it. And the wave moves it LESS in all four,");
console.log("   because each transfer is inelastic and damps the pair it carries.");
console.log("   (each run asserts the world's momentum is UNCHANGED, not zero:");
console.log("    a pair carrying p in one direction sums to 2p, which is the point)");

// --------------------------------------------------- B: the wave in a world
const TEMPS = [0, 2, 6, 20];
const SEEDS = [31, 32, 33];
const EV = 1000000;
const BLIND = 5.26;

function worldRun(which, T, seed) {
  const mod = engines[which];
  const lab = new mod.Lab({ constants: CANDIDATE_ZERO,
    thermostat: { HOT_T: 1, COLD_T: 1, BAND_ROWS: 3 }, seed });
  lab.seedWorld(0.35, (r) => 1 + r.below(255), { momentumRange: 0 });
  if (T > 0) for (let i = 0; i < lab.w.kind.length; i++)
    if (lab.w.kind[i] !== 0) lab.w.energy[i] = T * lab.w.kind[i];
  lab.start();
  lab.run(EV, {});
  const c = mod.census(lab.w);
  if (c.pxSum !== 0 || c.pySum !== 0)
    throw new Error(`momentum leaked at ${which} T=${T}: ${c.pxSum},${c.pySum}`);
  const b = bondStats(lab.w);
  return { n: b.n, mb: b.meanB, st: lab.counts.stepped,
    bs: lab.counts.bondedStepped, pu: lab.counts.pushedAlongBond || 0, w: lab.w };
}

console.log("\n=== B. the same thing in a full world ===");
console.log(`    ${TEMPS.length} temperatures, ${SEEDS.length} seeds, ${EV / 1e6}M events each; `
  + `blind grabbing gives mean B ${BLIND}\n`);
for (const which of ["plain", "push"]) {
  console.log(`  ${which === "plain" ? "as it ships" : "with the rejected wave"}`);
  console.log("      T    steps   bonded steps   pushes    bonds   meanB");
  const pts = [];
  for (const T of TEMPS) {
    const a = { n: 0, mb: 0, st: 0, bs: 0, pu: 0 };
    for (const s of SEEDS) {
      const r = worldRun(which, T, s);
      for (const k of Object.keys(a)) a[k] += r[k];
    }
    const d = (x) => Math.round(x / SEEDS.length), mb = a.mb / SEEDS.length;
    pts.push({ T, n: d(a.n), mb, bs: d(a.bs) });
    console.log(`    ${String(T).padStart(3)}  ${String(d(a.st)).padStart(7)}  `
      + `${String(d(a.bs)).padStart(13)}  ${String(d(a.pu)).padStart(7)}  `
      + `${String(d(a.n)).padStart(7)}  ${mb.toFixed(2).padStart(6)}`);
  }
  const zero = pts[0], best = pts.reduce((x, y) => (y.mb > x.mb ? y : x));
  console.log(`      -> best ${best.mb.toFixed(2)} at T=${best.T}, `
    + `+${(best.mb - zero.mb).toFixed(2)} over frozen, `
    + `+${(best.mb - BLIND).toFixed(2)} over blind; `
    + `${best.bs} bonded steps there\n`);
}
console.log("   BONDED MATTER STEPS ABOUT 14,500 TIMES PER MILLION EVENTS at the");
console.log("   temperature chemistry likes, with no drag and no wave. Clusters were");
console.log("   never frozen; nothing had counted them.\n");

// --------------------------------------------- C: does |p| / K come out?
console.log("=== C. does law 1's |p| / K inertia emerge, with nothing computing K? ===");
console.log("    nothing in lab.mjs reads a cluster's total kind\n");
const r = worldRun("plain", 6, 31);
const cs = clusters(r.w).filter((c) => c.members.length > 1);
console.log("   cluster size   clusters   members   mean K   mean |p| per member");
for (const [lo, hi] of [[2, 2], [3, 4], [5, 8], [9, 999]]) {
  const sel = cs.filter((c) => c.members.length >= lo && c.members.length <= hi);
  if (!sel.length) continue;
  let members = 0, K = 0, mom = 0;
  for (const c of sel) {
    members += c.members.length; K += c.K;
    for (const m of c.members) {
      const x = r.w.mx[m], y = r.w.my[m], z = -x - y;
      mom += Math.sqrt((x * x + y * y + z * z) / 2);
    }
  }
  console.log(`   ${String(lo === hi ? lo : lo + "-" + (hi > 100 ? "+" : hi)).padStart(12)}`
    + `   ${String(sel.length).padStart(8)}   ${String(members).padStart(7)}`
    + `   ${(K / sel.length).toFixed(0).padStart(6)}   ${(mom / members).toFixed(2).padStart(19)}`);
}
console.log("\n   Momentum per member is FLAT across cluster sizes, so there is no sign");
console.log("   of |p| / K emerging. Read it as evidence and not a verdict: it is one");
console.log("   seed, and a snapshot of momentum rather than a rate of movement. A");
console.log("   real measurement needs clusters tracked through time, and the engine");
console.log("   carries no identity to track them by. README item 33.");
