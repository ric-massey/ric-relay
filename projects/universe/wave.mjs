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
//      MEASURED: WRONG. All four orientations translate, and about EQUALLY
//      far: ~1,040-1,080 hexagons in 200,000 events, four laps of the world.
//      (Until a correction later on 2026-11-06 this said a longitudinal pair
//      "manages 56 against 115" and rotates out of the locked geometry. Those
//      were before-and-after positions on a 258-wide torus -- where on its
//      last lap each run stopped -- not distances. See travelled() below.)
//
//   B  Did the momentum wave buy anything? A method was built the same day
//      to carry a refused step's momentum along the bond, one unit per event
//      -- local, conserving, and exactly what law 1's "once momentum has
//      SPREAD across a bonded group" describes.
//      MEASURED: it bought nothing -- no further travel once distance is
//      measured properly, and no better chemistry in a full world. It is in
//      rejected/push-along-bond.txt with the table. This file injects it back into a copy of the engine so
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

// ---------------------------------------------- the engine without the wave
// The wave (pushAlongBond) was RE-ADOPTED into lab.mjs on 2026-11-06, so the
// comparison arm is now the engine WITHOUT it, built by deleting its one call.
// The anchor must match exactly once -- one that silently stopped matching
// would report the shipped engine twice and call it a null result, which is
// the failure rule 12 warns about. The keys stay "plain" (no wave) and
// "push" (with it, as it ships).
const SRC = readFileSync(join(HERE, "lab.mjs"), "utf8");
const A_METHOD = "  step(i) {";
const A_PUSHCALL = "        this.pushAlongBond(i, d, stretched);\n";
const A_COUNTS = "      bondedStepped: 0,";
const TMP = mkdtempSync(join(tmpdir(), "wave-"));

function withoutPush() {
  let s = SRC.replace('} from "./constants.mjs";', "} from " + JSON.stringify(CONSTS) + ";");
  if (s.split(A_PUSHCALL).length - 1 !== 1)
    throw new Error(`the push call anchor matched ${s.split(A_PUSHCALL).length - 1} times, need 1`);
  s = s.replace(A_PUSHCALL, "");
  const p = join(TMP, "lab-nopush.mjs");
  writeFileSync(p, s);
  return p;
}
const NOPUSH = await import(pathToFileURL(withoutPush()).href);
const engines = { plain: NOPUSH, push: PLAIN };

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
// The centre of a group, in axial (q, r), unwrapped around its first member
// so a group straddling the seam is not averaged to the middle of the world.
function centre(w, members) {
  const q0 = members[0] % N, r0 = (members[0] - q0) / N;
  const wrap = (d) => ((d + N / 2) % N + N) % N - N / 2;
  let K = 0, cq = 0, cr = 0;
  for (const m of members) {
    const q = m % N, r = (m - q) / N;
    const k = w.kind[m];
    K += k; cq += (q0 + wrap(q - q0)) * k; cr += (r0 + wrap(r - r0)) * k;
  }
  return [cq / K, cr / K, K];
}

// HOW FAR A GROUP TRAVELLED, ON A TORUS. FIXED 2026-11-06. This file used to
// compare the centre before and after the whole run, and the Lab is a 258-wide
// loop: a pair at kind 44 and |p| 30 takes ~3,500 steps in 200,000 events and
// laps the world several times, so the before-after difference was just where
// on its last lap the run stopped. Item 25's "115 hexagons" and "56 for a
// longitudinal pair" were that, never distances. Now the run is sampled often
// enough that the centre moves far less than half the world between samples,
// each step's displacement is unwrapped, and the path is summed -- reported
// as the net distance from the start in hexagon widths.
function travelled(lab, w, events, members0, chunk = 2000) {
  const wrap = (d) => ((d + N / 2) % N + N) % N - N / 2;
  const groupNow = () => { const cs = clusters(w).filter((c) => c.members.length > 1);
    return cs.length === 1 ? cs[0].members : null; };
  let prev = centre(w, members0), dq = 0, dr = 0, done = 0;
  while (done < events) {
    done = Math.min(events, done + chunk);
    lab.run(done, {});
    const g = groupNow();
    if (!g) return { distance: Math.hypot(dq + dr / 2, dr * Math.sqrt(3) / 2), bonded: false };
    const c = centre(w, g);
    dq += wrap(c[0] - prev[0]); dr += wrap(c[1] - prev[1]); prev = c;
  }
  return { distance: Math.hypot(dq + dr / 2, dr * Math.sqrt(3) / 2), bonded: true };
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

  // The pair is moving, so the world's momentum is NOT zero here -- it is the
  // 2p that was put in, and the thing to assert is that it does not CHANGE.
  // (Asserting zero was this file's own bug for one run: the Lab reported
  // (60, -60) and was right. The engine's own runs start at zero because the
  // thermal kick only ever makes opposite pairs.)
  const p0 = census(w);
  const tr = travelled(lab, w, events, [i, j]);
  const c = census(w);
  if (c.pxSum !== p0.pxSum || c.pySum !== p0.pySum)
    throw new Error(`momentum changed: started (${p0.pxSum}, ${p0.pySum}), `
      + `ended (${c.pxSum}, ${c.pySum})`);
  return { moved: tr.distance, bonded: tr.bonded, steps: lab.counts.stepped,
    pushes: lab.counts.pushedAlongBond || 0 };
}

console.log("=== A. one bonded pair alone in a vacuum, moving ===");
console.log("    does it translate, does the bond's angle matter, and did the");
console.log("    momentum wave help? (centre of mass, 200k events)\n");
console.log("                     without the wave  as it ships (wave)");
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
console.log("\n   Every orientation translates, so the prediction that a longitudinal pair");
console.log("   cannot move was wrong. Under nearest-of-six stepping the wave carried it");
console.log("   no further; under tracked stepping (item 34, 2026-11-06) it carries it");
console.log("   10-25% further -- read the numbers above, not this sentence, if they move");
console.log("   again. Distances are the unwrapped path on the torus (travelled()).");
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
    bs: lab.counts.bondedStepped, pu: lab.counts.pushedAlongBond || 0,
    dr: lab.counts.dragged || 0, w: lab.w };
}

console.log("\n=== B. the same thing in a full world ===");
console.log(`    ${TEMPS.length} temperatures, ${SEEDS.length} seeds, ${EV / 1e6}M events each; `
  + `blind grabbing gives mean B ${BLIND}\n`);
for (const which of ["plain", "push"]) {
  console.log(`  ${which === "plain" ? "without the wave" : "as it ships, with the wave"}`);
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
const r = worldRun("push", 6, 31);   // the engine as it ships, with the wave
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

// ----------------------------- D: item 33, the drag and |p| / K separated
// Ric, 2026-11-06: "Run it. Why not?"
//
// The removed drag reading scored higher than everything else on chemistry,
// and it came with a second change: motionRateAt read the bonded CLUSTER's
// total kind rather than the hexagon's, which is law 1's |p| / K. Two
// variables moved at once and were never separated -- the error README item
// 31 was written to record, made again four items later. So: a 2x2, all four
// arms at the SHIPPED momentum width, which is the other half of the mistake.
//
// The arms carry the cluster walk, which is rule 9's forbidden non-local
// read. That is why none of them can ship whatever they score -- this is a
// measurement of what the removed code was worth, not a candidate.
const DRAGDOC = readFileSync(join(HERE, "rejected", "cluster-drag.txt"), "utf8");
function between(a, b) {
  const i = DRAGDOC.indexOf(a);
  if (i < 0) throw new Error(`marker missing from cluster-drag.txt: ${a}`);
  const from = i + a.length;
  const j = b ? DRAGDOC.indexOf(b, from) : DRAGDOC.length;
  if (b && j < 0) throw new Error(`marker missing from cluster-drag.txt: ${b}`);
  return DRAGDOC.slice(from, j).replace(/^\r?\n/, "").replace(/\r?\n\s*$/, "");
}
const M_METHODS = "--- METHODS BELOW THIS LINE ---";
const M_RATE = "--- RATE LINE BELOW THIS LINE ---";
const M_CALL = "--- DRAG CALL BELOW THIS LINE ---";
const CLUSTER_METHODS = between(M_METHODS, M_RATE);
const K_RATE = between(M_RATE, M_CALL);
const DRAG_CALL = between(M_CALL, null);
const A_RATE = "    const speed = matterSpeed(Q, w.kind[i]);";
const A_COLD = "        this.counts.tooColdToMove++;";

function arm(useDrag, useK) {
  let s = SRC.replace('} from "./constants.mjs";', "} from " + JSON.stringify(CONSTS) + ";");
  for (const [name, anchor] of [["counters", A_COUNTS], ["method", A_METHOD],
                                ["rate", A_RATE], ["cold", A_COLD]]) {
    if (s.split(anchor).length - 1 !== 1)
      throw new Error(`the ${name} anchor matched ${s.split(anchor).length - 1} times, need 1`);
  }
  // The drag's own counters, which dragCluster increments.
  s = s.replace(A_COUNTS, A_COUNTS
    + "\n      dragged: 0, draggedMembers: 0, dragBlocked: 0, dragLargest: 0,");
  s = s.replace(A_METHOD, CLUSTER_METHODS + "\n\n" + A_METHOD);
  if (useK) s = s.replace(A_RATE, K_RATE);
  if (useDrag) s = s.replace(A_COLD, A_COLD + "\n" + DRAG_CALL);
  const p = join(TMP, "lab-" + (useDrag ? "drag" : "nodrag") + "-" + (useK ? "K" : "k") + ".mjs");
  writeFileSync(p, s);
  return p;
}
for (const [useDrag, useK, name] of [[false, true, "k-only"], [true, false, "drag-only"],
                                     [true, true, "both"]]) {
  engines[name] = await import(pathToFileURL(arm(useDrag, useK)).href);
}

console.log("\n=== D. item 33: the drag and |p| / K, separated at last ===");
console.log("    all four arms at the SHIPPED momentum width, which is the half of");
console.log("    the earlier comparison that was also wrong\n");
const D = [["push", "neither -- as it ships"], ["k-only", "|p| / K only"],
           ["drag-only", "the drag only"], ["both", "both, as it was removed"]];
console.log("   arm                        best meanB   over blind   seed spread   drags");
const dres = [];
for (const [key, label] of D) {
  let best = null;
  for (const T of TEMPS) {
    // Keep the per-seed values, because the whole question here is whether a
    // difference between arms is bigger than the difference between seeds.
    const each = SEEDS.map((s) => worldRun(key, T, s));
    const mb = each.reduce((a, r) => a + r.mb, 0) / each.length;
    if (!best || mb > best.mb) best = { T, mb,
      lo: Math.min(...each.map((r) => r.mb)), hi: Math.max(...each.map((r) => r.mb)),
      bs: Math.round(each.reduce((a, r) => a + r.bs, 0) / each.length),
      dr: Math.round(each.reduce((a, r) => a + r.dr, 0) / each.length) };
  }
  dres.push({ label, ...best });
  console.log(`   ${label.padEnd(24)}   ${best.mb.toFixed(2).padStart(10)}`
    + `   ${("+" + (best.mb - BLIND).toFixed(2)).padStart(10)}`
    + `   ${(best.hi - best.lo).toFixed(2).padStart(11)}   ${String(best.dr).padStart(5)}`);
}
const span = Math.max(...dres.map((r) => r.mb)) - Math.min(...dres.map((r) => r.mb));
const noise = Math.max(...dres.map((r) => r.hi - r.lo));
console.log(`\n   Spread across all four arms: ${span.toFixed(2)} of mean B.`);
console.log(`   Largest seed-to-seed spread within one arm: ${noise.toFixed(2)}.`);
console.log(`   ${span > noise ? "The arms differ by more than the seeds do."
  : "THE ARMS DIFFER BY LESS THAN THE SEEDS DO -- neither variable matters."}`);
console.log("\n   The gap this item was raised to explain was stated as 0.67, and that");
console.log("   figure compared a +-15 arm against a +-63 one -- the same");
console.log("   two-variables-at-once error, one level up, in the sentence that");
console.log("   complained about it. The table above is the honest version.");
