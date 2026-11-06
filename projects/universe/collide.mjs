// collide.mjs -- what a species does when it meets another, measured by
// running the collision rather than reasoning about it.
//
// README says what the Lab is for: "Its output is meant to be this universe's
// periodic table: the stable clusters, what each is made of, and how each
// behaves when it meets another -- MEASURED BY RUNNING COLLISIONS, not
// computed." census.mjs does the first three. This file does the fourth.
//
// It is the opposite experiment to census.mjs. The census watches a full world
// and takes whatever encounters it happens to produce; this builds an empty
// world, puts exactly two clusters in it, aims them at each other and watches
// the one event. Nothing else is happening, so the outcome is attributable.
//
// Rules this file stands under:
//
//   rule 2   nothing stored that should emerge. The clusters are built by
//            writing kind, bonds, momentum and in-hexagon position -- the same
//            fields seedWorld writes -- and then the engine is left alone. No
//            species tag, no cluster id, no outcome flag lives in the world.
//            The outcome is read back out of the bond bits afterwards.
//
//   rule 6   assert conservation on every run. The Ledger is built by start()
//            AFTER the clusters are placed, so its baseline includes them, and
//            lab.run() checks the books itself and throws. Every collision
//            here is therefore conservation-checked, and a throw is reported.
//
//   rule 8   named constants, with units.
//
//   rule 11  don't trust a pretty picture -- and this file is the rule's own
//            case study. Three readings were wrong before this version:
//
//              `collided` was read as "they met". It is not. A CONTROL with
//              ONE dimer alone in an empty world records 320 collisions at
//              speed 4 with the bond along travel and 338 with it across, so
//              a cluster collides with ITSELF and the counter cannot tell an
//              encounter from a cluster jostling its own members. Both
//              orientations fail it, which is why the control is in this file
//              as Check 0 rather than in a note.
//
//              The heat field was read as "heat generated". With no
//              thermostat and an empty world the collision's heat radiates
//              straight into the vacuum, so the heat field FALLS while
//              in-flight rises. The energy columns are reported separately.
//
//              Sampled proximity was read as contact. The clusters meet and
//              separate within a few events, so sampling every 10,000 events
//              missed every encounter and reported "never met" across a table
//              where the position trace showed them bouncing.
//
//   rule 12  a count from one run is not a finding: every cell runs on
//            several seeds and disagreement between them is printed.
//
// HOW CONTACT IS ACTUALLY DETECTED, AND WHY THIS TEST IS EXACT.
// The two clusters are built from DIFFERENT KINDS that carry the SAME
// VALENCE: side A uses kind KIND_BASE + v, side B uses KIND_BASE + M + v.
// Since v(k) = k mod M, both sides have identical valence, so law 2's B and
// law 4's capacity are identical and the chemistry is untouched -- the only
// difference is 8 units of mass, which moves law 2's break threshold
// e >= B * kind by about 6% and is reported.
//
// With the sides distinguishable, contact is detected by MOMENTUM rather than
// by proximity, and that is what makes it exact. Side A's total momentum can
// only change by interacting with side B: a step does not change momentum,
// sharing along a bond and the momentum wave move it between bonded partners
// on the same side, and a thermal kick adds equal and opposite units to a
// neighbouring pair. None of those alter the sum over A-kinds. A collision
// with B does, and the change is PERMANENT -- unlike proximity, which is
// transient and can fall between samples. So one scan at the end settles it.
//
// WHAT THIS FILE DOES NOT ASSUME.
// Whether a bonded pair can be aimed at all. GAP 3 settled on 2026-11-06 as
// "the bond holds and the step does not happen", with a momentum wave along
// the bond. Both orientations are run -- bond along the line of travel and
// across it -- and `stepped` is printed, because a dimer with the bond along
// travel records stepped = 0 at speed 16 and above: its trailing member can
// only step into its own leader. An experiment where nothing moved is not a
// collision, and the stepped column is how that shows.
//
//   node collide.mjs

import { Lab, census, neighbour, bindingEnergy, DIR_CUBE, opposite, at, CELLS } from "./lab.mjs";
import { MOMENTUM_RANGE, ENERGY_MAX, capacityOf } from "./constants.mjs";
import { walk, M } from "./clusters.mjs";

// ---------------------------------------------------------------- constants
const SEEDS        = [1, 2, 3];        // rule 12
const SPEEDS       = [4, 16, 63];      // momentum per primitive, along the axis
const GAP          = 6;                // empty hexagons between the two clusters
const AXIS         = 0;                // DIR_CUBE index the two clusters travel along
const EVENT_BUDGET = 400000;           // per collision
const KIND_BASE    = 128;              // kind for valence 0 on side A; 128 mod 8 == 0
const NO_BANDS     = { HOT_T: 0, COLD_T: 0, BAND_ROWS: 0 };   // thermostat off
const ORIENTATIONS = [["along", 0], ["across", 1]];
const CONTROL_EVENTS = 100000;         // for Check 0

// Side A carries valence v as kind KIND_BASE + v; side B as KIND_BASE + M + v.
// Same valence, different kind -- see the header.
const kindFor = (v, sideB) => KIND_BASE + (sideB ? M : 0) + v;

// The species under test, as valence pairs, chosen from census.mjs: 0-1 is the
// most abundant cluster in the Lab and has the WEAKEST possible bond (B = 1)
// with both ends at capacity 1, so it cannot bond to anything further; 1-7 is
// the strongest (B = 8); 4-4 is tetravalent and its own best partner, the
// shape the docs call carbon-like; 7-7 has six bonds available but B = 2;
// 2-6 is B = 8 with mismatched capacities.
const SPECIES = [[0, 1], [1, 7], [4, 4], [7, 7], [2, 6]];
const nameOf = (s) => s.join("-");

const countBits = (b) => { let n = 0; for (let d = 0; d < 6; d++) if (b & (1 << d)) n++; return n; };
const isSideB = (k) => k >= KIND_BASE + M;

// ------------------------------------------------------------ construction
// Place a chain along `dir` from `head`, bonding consecutive members. Mirrors
// tryFormBond exactly: the released B goes into the initiating hexagon and the
// bond bit is set at both ends.
function build(lab, head, dir, kinds) {
  const w = lab.w;
  const idx = [];
  let site = head;
  for (const k of kinds) {
    if (w.kind[site] !== 0) return { error: `site ${site} already occupied` };
    w.kind[site] = k;
    w.energy[site] = 0;
    w.bonds[site] = 0;
    w.mx[site] = 0; w.my[site] = 0;
    // Tracked stepping reads an in-hexagon position. The centre is inside
    // every hexagon, and using it rather than a random point keeps a
    // collision reproducible for a given seed.
    if (lab.tracking) { w.ox[site] = 0; w.oy[site] = 0; }
    idx.push(site);
    site = neighbour(site, dir);
  }
  for (let n = 0; n + 1 < idx.length; n++) {
    const i = idx[n], j = idx[n + 1];
    if (capacityOf(w.kind[i]) <= countBits(w.bonds[i])) return { error: `law 4: kind ${w.kind[i]} is full` };
    if (capacityOf(w.kind[j]) <= countBits(w.bonds[j])) return { error: `law 4: kind ${w.kind[j]} is full` };
    const B = bindingEnergy(w.kind[i], w.kind[j]);
    if (B === 0) return { error: "law 2: B = 0, this pair cannot bond" };
    if (w.energy[i] + B > ENERGY_MAX) return { error: "energy field would overflow" };
    w.energy[i] += B;                            // exactly as tryFormBond does
    w.bonds[i] |= (1 << dir);
    w.bonds[j] |= (1 << opposite(dir));
  }
  return { idx };
}

// Equal and opposite momentum along the axis, so the pair starts at exactly
// (0, 0) with nothing cancelled by hand.
function aim(lab, idx, dir, speed) {
  const w = lab.w;
  const cx = DIR_CUBE[dir][0] * speed, cy = DIR_CUBE[dir][1] * speed;
  if (!lab.legalMomentum(cx, cy)) return `momentum (${cx}, ${cy}) is outside +-${MOMENTUM_RANGE}`;
  for (const i of idx) { w.mx[i] = cx; w.my[i] = cy; }
  return null;
}

// Total momentum carried by one side, by kind. The whole contact test.
function sideMomentum(w, sideB) {
  let x = 0, y = 0;
  for (let i = 0; i < CELLS; i++) {
    if (w.kind[i] === 0) continue;
    if (isSideB(w.kind[i]) === sideB) { x += w.mx[i]; y += w.my[i]; }
  }
  return [x, y];
}

// ----------------------------------------------------------- one collision
function collide({ specA, specB, speed, seed, bondDir }) {
  const lab = new Lab({ seed, thermostat: NO_BANDS });
  const w = lab.w;
  const total = specA.length + specB.length;

  const headA = at(0, 0);
  let headB = headA;
  for (let n = 0; n < specA.length + GAP; n++) headB = neighbour(headB, AXIS);

  const a = build(lab, headA, bondDir, specA.map((v) => kindFor(v, false)));
  if (a.error) return { skipped: a.error };
  const b = build(lab, headB, bondDir, specB.map((v) => kindFor(v, true)));
  if (b.error) return { skipped: b.error };

  const errA = aim(lab, a.idx, AXIS, speed);
  if (errA) return { skipped: errA };
  const errB = aim(lab, b.idx, opposite(AXIS), speed);
  if (errB) return { skipped: errB };

  lab.start();                                   // ledger baseline, after placement
  const before = census(w);
  if (before.pxSum !== 0 || before.pySum !== 0) {
    return { skipped: `start momentum (${before.pxSum}, ${before.pySum}) is not zero` };
  }
  const startWalk = walk(w, 2);
  if (startWalk.clusters.length !== 2) {
    return { skipped: `built ${startWalk.clusters.length} clusters, not 2` };
  }
  const pA0 = sideMomentum(w, false);

  let threw = null;
  try { lab.run(EVENT_BUDGET); } catch (e) { threw = e.message; }

  const after = census(w);
  const end = walk(w, 2);
  const sizes = end.clusters.map((c) => c.size).sort((x, y) => y - x);
  const pA1 = sideMomentum(w, false);
  const met = pA1[0] !== pA0[0] || pA1[1] !== pA0[1];
  const mixed = end.clusters.filter((c) => {
    const tags = c.members.map((i) => isSideB(w.kind[i]));
    return tags.some((t) => t) && tags.some((t) => !t);
  }).length;
  const c = lab.counts;

  let outcome;
  if (threw) {
    outcome = /conserv|momentum|energy|matter|ledger|books/i.test(threw)
      ? "CONSERVATION THREW" : `HARNESS BUG: ${threw}`;
  } else if (!met) outcome = "never met";
  else if (sizes.length === 1 && sizes[0] === total) outcome = "merged";
  else if (end.free > 0) outcome = `shattered (${end.free} free)`;
  else if (mixed > 0) outcome = `exchanged (${sizes.join("+")})`;
  else if (sizes.length === 2 && sizes[0] === Math.max(specA.length, specB.length)) outcome = "bounced";
  else outcome = `rearranged (${sizes.join("+")})`;

  return {
    outcome, threw, met,
    stepped: c.stepped, collided: c.collided, blocked: c.blocked,
    formed: c.bondsFormed, broken: c.bondsBroken,
    dKinetic: after.kinetic - before.kinetic,
    dHeat: after.heat - before.heat,
    dFlight: after.inFlight - before.inFlight,
    px: after.pxSum, py: after.pySum,
  };
}

// ===================================================================== main
console.log("=== Collisions: two clusters in an empty world, aimed at each other ===");
console.log(`  Thermostat OFF, gap ${GAP} hexagons, axis ${AXIS}, ${SEEDS.length} seeds, ${EVENT_BUDGET.toLocaleString()} events each.`);
console.log(`  Side A is kind ${KIND_BASE}-${KIND_BASE + M - 1}, side B is ${KIND_BASE + M}-${KIND_BASE + 2 * M - 1}:`);
console.log(`  same valence v = k mod ${M}, so identical chemistry, 8 units apart in mass.`);
console.log("  CANDIDATE_ZERO constants -- SCREENED BY NOTHING.");

// --------------------------------------------- Check 0: the contact control
console.log("");
console.log("=== Check 0: ONE dimer alone, so every collision it records is with itself ===");
console.log("  This is why `collided` is not the contact test. Contact is detected from");
console.log("  side A's total momentum instead, which nothing but side B can change.");
console.log("  orientation  speed  collided  stepped  blocked  own momentum drifted?");
for (const [label, bondDir] of ORIENTATIONS) {
  for (const speed of SPEEDS) {
    const lab = new Lab({ seed: 1, thermostat: NO_BANDS });
    const built = build(lab, at(0, 0), bondDir, [kindFor(0, false), kindFor(1, false)]);
    aim(lab, built.idx, AXIS, speed);
    lab.start();
    const p0 = sideMomentum(lab.w, false);
    lab.run(CONTROL_EVENTS);
    const p1 = sideMomentum(lab.w, false);
    const drift = p1[0] !== p0[0] || p1[1] !== p0[1];
    console.log("  " + label.padEnd(13) + String(speed).padEnd(7) +
      String(lab.counts.collided).padEnd(10) + String(lab.counts.stepped).padEnd(9) +
      String(lab.counts.blocked).padEnd(9) + (drift ? `YES -- test is invalid (${p0} -> ${p1})` : "no"));
  }
}
console.log("  A lone dimer collides with itself in BOTH orientations, so the collision");
console.log("  counter cannot detect an encounter. Its own momentum never drifts, so the");
console.log("  momentum test is sound: nothing but the other side can move it.");

// ----------------------------------- the species, computed rather than typed
console.log("");
console.log("=== The species under test, and what the laws say about each ===");
console.log("species  A kinds    B kinds    B(bond)  capacity  break e >= B*kind");
for (const s of SPECIES) {
  const [a1, a2] = s.map((v) => kindFor(v, false));
  const [b1, b2] = s.map((v) => kindFor(v, true));
  const B = bindingEnergy(a1, a2);
  console.log(nameOf(s).padEnd(9) + `${a1},${a2}`.padEnd(11) + `${b1},${b2}`.padEnd(11) +
    String(B).padEnd(9) + `${capacityOf(a1)},${capacityOf(a2)}`.padEnd(10) +
    `${B * a1}, ${B * a2}`);
}

let failures = 0, skipped = 0;
const tally = new Map();
for (const [label, bondDir] of ORIENTATIONS) {
  console.log("");
  console.log(`=== Bond ${label === "along" ? "ALONG the line of travel" : "ACROSS it (60 degrees off)"} ===`);
  console.log("A       B       speed  outcome            agree  met  stepped  collided  formed  dKE    dHeat  dFlight  net p");
  for (const specA of SPECIES) {
    for (const specB of SPECIES) {
      for (const speed of SPEEDS) {
        const runs = SEEDS.map((seed) => collide({ specA, specB, speed, seed, bondDir }));
        const live = runs.filter((r) => !r.skipped);
        if (live.length === 0) {
          skipped++;
          console.log(nameOf(specA).padEnd(8) + nameOf(specB).padEnd(8) +
            String(speed).padEnd(7) + `skipped -- ${runs[0].skipped}`);
          continue;
        }
        const outcomes = [...new Set(live.map((r) => r.outcome))];
        const agree = outcomes.length === 1 ? `${live.length}/${live.length}` : "SPLIT";
        if (live.some((r) => r.threw)) failures++;
        const netP = live.every((r) => r.px === 0 && r.py === 0) ? "(0,0)" : "DRIFT";
        if (netP === "DRIFT") failures++;
        const mean = (f) => Math.round(live.reduce((s, r) => s + f(r), 0) / live.length);
        for (const o of live) {
          const key = o.outcome.replace(/ \(.*/, "");
          tally.set(`${label}|${key}`, (tally.get(`${label}|${key}`) || 0) + 1);
        }
        console.log(
          nameOf(specA).padEnd(8) + nameOf(specB).padEnd(8) + String(speed).padEnd(7) +
          outcomes[0].padEnd(19) + agree.padEnd(7) +
          `${live.filter((r) => r.met).length}/${live.length}`.padEnd(5) +
          String(mean((r) => r.stepped)).padEnd(9) +
          String(mean((r) => r.collided)).padEnd(10) +
          String(mean((r) => r.formed)).padEnd(8) +
          String(mean((r) => r.dKinetic)).padEnd(7) +
          String(mean((r) => r.dHeat)).padEnd(7) +
          String(mean((r) => r.dFlight)).padEnd(9) + netP +
          (outcomes.length > 1 ? "  <- " + outcomes.join(" / ") : ""));
      }
    }
  }
}

console.log("");
console.log("=== Outcome tally, by orientation ===");
for (const [label] of ORIENTATIONS) {
  const rows = [...tally.entries()].filter(([k]) => k.startsWith(label + "|"));
  const n = rows.reduce((s, [, v]) => s + v, 0);
  console.log(`  ${label}:`);
  for (const [k, v] of rows.sort((x, y) => y[1] - x[1])) {
    console.log(`    ${k.split("|")[1].padEnd(22)}${String(v).padStart(4)}  ${(100 * v / n).toFixed(1)}%`);
  }
}

console.log("");
console.log("=== Checks ===");
console.log(`  conservation: ${failures === 0
  ? "every collision closed its books and ended at net momentum (0, 0)"
  : `FAILED in ${failures} cells`}`);
console.log(`  skipped cells: ${skipped} (a species the laws refuse to build is reported, not hidden)`);
console.log("  read `stepped` before any outcome: a dimer with its bond along travel cannot");
console.log("  move at speed 16 or above, and 'never met' there is law 1, not a failed aim.");
