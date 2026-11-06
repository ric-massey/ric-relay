// world-check.mjs -- the World's pre-flight for law 1's two exchanges. Not
// part of the engine.
//
// These two were ported from the Lab on 2026-11-07 and they are the most
// dangerous kind of code in this project: they move momentum between
// neighbours without anything travelling, which is exactly the operation that
// can conserve momentum perfectly while quietly creating or destroying energy.
// README item 28 is that failure -- 34,864 units over 50,000 events, no error,
// nothing visibly wrong, found only because an assertion was looking.
//
// So the counters in world-run.mjs are not evidence. "34,394 momentum hops"
// says the function ran, not that it was right. What follows tries to break
// each claim the two laws make:
//
//   1. the kick's pair cancels EXACTLY, in integers, with no preferred direction
//   2. cold matter cannot kick and hot matter can -- README item 29's whole point
//   3. a push travels THROUGH a bonded chain, which is what makes a cluster an object
//   4. neither exchange ever clips at law 1's range; it declines, all-or-nothing
//   5. the heat seam is exact over thousands of random exchanges
//   6. heat MOVES MATTER in a real run, with gravity off, from zero momentum
//
// Every check prints what it measured rather than "ok", because rule 11 is
// about not believing output that only says it passed.

import { World, census, neighbour, keAt, tempOf, countMatter, DIR_CUBE } from "./world.mjs";
import { CANDIDATE_ZERO, DIRECTIONS, MOMENTUM_RANGE, ENERGY_MAX, KIND_MAX, SETTLED }
  from "./constants.mjs";

let failures = 0;
function report(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  --  " + detail : ""}`);
}

// A World with no gravity, nothing seeded, and the ledger baseline taken AFTER
// the state is placed by hand. seed_ with fill 0 adds no matter and then
// snapshots the books, which is the only way in from outside the class -- and
// the right way, since the baseline must include whatever was placed.
function bare(cols = 12, rows = 12, seed = 1) {
  const w = new World({ cols, rows, seed, constants: CANDIDATE_ZERO, gravity: null });
  return w;
}
const baseline = (world) => world.seed_(0, () => 1);
const at = (w, q, r) => r * w.cols + q;
const totalMomentum = (w) => { const c = census(w); return [c.px, c.py]; };
const totalEnergy = (w) => { const c = census(w); return c.heat + c.kinetic + c.inFlight; };

// ===========================================================================
console.log(`=== Check 1: the kick's pair cancels exactly, and has no preferred direction ===`);
{
  const world = bare();
  const w = world.w;
  // A field of pairs, all with heat and no momentum. The kick is the only
  // thing that can run here: no gravity, no momentum to step with.
  for (let i = 0; i < w.cells; i++) { w.kind[i] = 4; w.energy[i] = 2000; }
  baseline(world);

  const before = totalMomentum(w);
  for (let n = 0; n < 20000; n++) world.tryThermalKick(world.rng.below(w.cells));
  const after = totalMomentum(w);

  report("momentum is still exactly zero after 20,000 kicks",
    after[0] === 0 && after[1] === 0,
    `(${before[0]}, ${before[1]}) -> (${after[0]}, ${after[1]}) over `
    + `${world.counts.thermalKicks.toLocaleString()} kicks taken`);

  // Something must actually have happened, or the check above is vacuous --
  // which is the failure mode of every conservation test.
  let moving = 0, maxQ = 0;
  for (let i = 0; i < w.cells; i++) {
    if (w.mx[i] || w.my[i]) moving++;
    const q = w.mx[i] * w.mx[i] + w.my[i] * w.my[i];
    if (q > maxQ) maxQ = q;
  }
  report("and matter really is moving, so the zero is a cancellation not an absence",
    moving > 0 && world.counts.thermalKicks > 0,
    `${moving} of ${w.cells} hexagons have momentum, largest |p|^2 component sum ${maxQ}`);

  // No preferred direction: the six directions should be drawn about evenly.
  // A handedness here is what spiralled every orbit in orbit.mjs into the
  // centre, so it is worth measuring rather than assuming.
  let sx = 0, sy = 0;
  for (let i = 0; i < w.cells; i++) { sx += w.mx[i]; sy += w.my[i]; }
  report("the vector sum is zero component by component, not just in magnitude",
    sx === 0 && sy === 0, `sum mx = ${sx}, sum my = ${sy}`);

  try {
    world.ledger.check(w, "after 20,000 kicks");
    report("the books close: every unit of motion was paid for out of heat", true,
      `heat+kinetic ${totalEnergy(w)}, which is what it was`);
  } catch (e) {
    report("the books close: every unit of motion was paid for out of heat", false, e.message);
  }
}

// ===========================================================================
console.log(`\n=== Check 2: cold matter cannot kick, hot matter can (item 29) ===`);
{
  const rows = [];
  for (const heat of [0, 1, 50, 2000]) {
    const world = bare();
    const w = world.w;
    for (let i = 0; i < w.cells; i++) { w.kind[i] = 4; w.energy[i] = heat; }
    baseline(world);
    for (let n = 0; n < 20000; n++) world.tryThermalKick(world.rng.below(w.cells));
    rows.push({ heat, kicks: world.counts.thermalKicks, cold: world.counts.kickUnaffordable });
  }
  for (const r of rows) {
    console.log(`      heat ${String(r.heat).padStart(5)} per hexagon:  `
      + `${String(r.kicks).padStart(6)} kicks, ${String(r.cold).padStart(6)} refused as too cold`);
  }
  const zero = rows[0], hot = rows[rows.length - 1];
  report("matter at absolute zero never kicks", zero.kicks === 0,
    `${zero.cold} attempts refused, 0 taken -- cold matter is still, which is the right physics`);
  report("hot matter kicks", hot.kicks > 0, `${hot.kicks.toLocaleString()} kicks at heat ${hot.heat}`);
  report("and the colder world kicks less than the hotter one", zero.kicks < hot.kicks,
    `${zero.kicks} vs ${hot.kicks.toLocaleString()} -- heat is the thing that moves matter`);
}

// ===========================================================================
console.log(`\n=== Check 3: a push travels through a bonded chain ===`);
{
  // Ten hexagons in a row, bonded end to end along axial direction 0, same
  // kind so their velocities are comparable. One end is given momentum and
  // nothing else is. If sharing works, the far end ends up moving -- which is
  // what "a bonded group responds to a push as a group" means, and the reason
  // this law matters for gravity.
  const world = bare(24, 24);
  const w = world.w;
  const L = 10, r = 8;
  const chain = [];
  for (let q = 0; q < L; q++) {
    const i = at(w, q, r);
    chain.push(i);
    w.kind[i] = 4;
  }
  for (let q = 0; q < L - 1; q++) {
    w.bonds[chain[q]] |= 1 << 0;        // reaches q+1
    w.bonds[chain[q + 1]] |= 1 << 3;    // and back
  }
  w.mx[chain[0]] = 30; w.my[chain[0]] = -30;    // cube [30,-30,0], along direction 0
  baseline(world);

  const p0 = totalMomentum(w);
  const ke0 = census(w).kinetic;
  for (let fire = 0; fire < 4000; fire++) world.shareMomentum(chain[world.rng.below(L)]);
  const p1 = totalMomentum(w);

  const far = chain[L - 1];
  report("the far end of the chain is moving, having been given nothing",
    w.mx[far] !== 0 || w.my[far] !== 0,
    `hexagon at q=${L - 1}: p = (${w.mx[far]}, ${w.my[far]}) after `
    + `${world.counts.momentumShared.toLocaleString()} hops`);

  let carrying = 0;
  for (const i of chain) if (w.mx[i] || w.my[i]) carrying++;
  report("and so is most of the chain, so the push spread rather than teleporting",
    carrying >= L - 2, `${carrying} of ${L} hexagons carry momentum`);

  report("the chain's total momentum is exactly what was put in",
    p1[0] === p0[0] && p1[1] === p0[1],
    `(${p0[0]}, ${p0[1]}) -> (${p1[0]}, ${p1[1]})`);

  // Equalising is INELASTIC: spreading one body's momentum over ten reduces
  // the kinetic energy, because kinetic energy is quadratic. That difference
  // is the 34,864 units item 28 lost, and it should be sitting in the heat
  // field now.
  const c = census(w);
  report("kinetic energy FELL and the difference is in the heat field, not gone",
    c.kinetic < ke0 && c.heat > 0,
    `kinetic ${ke0} -> ${c.kinetic}, heat 0 -> ${c.heat} (equalising is inelastic)`);

  try {
    world.ledger.check(w, "after the chain settled");
    report("the books close over the whole exchange", true, `${totalEnergy(w)} units, unchanged`);
  } catch (e) {
    report("the books close over the whole exchange", false, e.message);
  }
}

// ===========================================================================
console.log(`\n=== Check 4: at law 1's range the exchange declines, it does not clip ===`);
{
  const world = bare();
  const w = world.w;
  const i = at(w, 5, 5), j = neighbour(w, i, 0);
  w.kind[i] = 1; w.kind[j] = 1;
  w.energy[i] = ENERGY_MAX; w.energy[j] = ENERGY_MAX;
  // Hard against the ceiling, in the direction the kick would push.
  w.mx[i] = MOMENTUM_RANGE; w.my[i] = -MOMENTUM_RANGE;
  baseline(world);

  const snap = [w.mx[i], w.my[i], w.mx[j], w.my[j], w.energy[i], w.energy[j]];
  const why = world.exchange(i, j, w.mx[i] + 1, w.my[i] - 1, w.mx[j] - 1, w.my[j] + 1);
  const now = [w.mx[i], w.my[i], w.mx[j], w.my[j], w.energy[i], w.energy[j]];

  report("an exchange past the momentum range is refused", why === "range", `returned "${why}"`);
  report("and NOTHING was touched -- all or nothing, like pullPair",
    snap.every((v, k) => v === now[k]),
    `p and heat identical at both ends (${snap.join(", ")})`);

  // The other ceiling: a shed that will not fit in the heat field. Both ends
  // full, and a hop that would release energy.
  const k2 = at(w, 5, 7), l2 = neighbour(w, k2, 0);
  w.kind[k2] = 1; w.kind[l2] = 1;
  w.energy[k2] = ENERGY_MAX; w.energy[l2] = ENERGY_MAX;
  w.mx[k2] = 40; w.my[k2] = -40;
  baseline(world);
  const snap2 = [w.mx[k2], w.my[k2], w.energy[k2], w.energy[l2]];
  const why2 = world.exchange(k2, l2, w.mx[k2] - 1, w.my[k2] + 1, w.mx[l2] + 1, w.my[l2] - 1);
  const now2 = [w.mx[k2], w.my[k2], w.energy[k2], w.energy[l2]];
  report("a shed that would overflow the heat field is refused too",
    why2 === "noRoom", `returned "${why2}" -- the Lab throws here; the World declines and counts`);
  report("and that one touched nothing either",
    snap2.every((v, k) => v === now2[k]), `${snap2.join(", ")}`);

  try {
    world.ledger.check(w, "after two refusals");
    report("a refusal costs the books nothing", true, "exactly conserving, which clipping is not");
  } catch (e) {
    report("a refusal costs the books nothing", false, e.message);
  }
}

// ===========================================================================
console.log(`\n=== Check 5: the heat seam is exact over thousands of random exchanges ===`);
{
  // The item 28 failure was slow: a unit or two per exchange, invisible for
  // thousands of events. So this does thousands, with the ledger asserted all
  // the way through, on a world of random kinds, heats and momenta -- the
  // mixed case, where the quadratic difference is never zero.
  const world = bare(18, 18, 7);
  const w = world.w;
  for (let i = 0; i < w.cells; i++) {
    if (world.rng.u01() < 0.7) {
      w.kind[i] = 1 + world.rng.below(255);
      w.energy[i] = world.rng.below(4000);
      w.mx[i] = world.rng.below(21) - 10;
      w.my[i] = world.rng.below(21) - 10;
      if (Math.abs(-w.mx[i] - w.my[i]) > MOMENTUM_RANGE) { w.mx[i] = 0; w.my[i] = 0; }
    }
  }
  // Bonds, placed by hand so sharing has something to run on. Bonds are set
  // BEFORE the baseline, so no bond energy has been released or absorbed and
  // bondPotential legitimately starts at zero.
  let placed = 0;
  for (let i = 0; i < w.cells; i++) {
    if (!w.kind[i]) continue;
    const d = world.rng.below(DIRECTIONS);
    const j = neighbour(w, i, d);
    if (!w.kind[j]) continue;
    w.bonds[i] |= 1 << d; w.bonds[j] |= 1 << ((d + 3) % DIRECTIONS);
    placed++;
  }
  baseline(world);

  let thrown = null, asserts = 0;
  try {
    for (let n = 0; n < 40000; n++) {
      const i = world.rng.below(w.cells);
      if (!w.kind[i]) continue;
      if (n % 2) world.shareMomentum(i); else world.tryThermalKick(i);
      if (n % 2000 === 0) { world.ledger.check(w, `exchange ${n}`); asserts++; }
    }
    world.ledger.check(w, "end");
    asserts++;
  } catch (e) { thrown = e.message; }

  report("40,000 mixed exchanges with the books asserted throughout", thrown === null,
    thrown || `${asserts} assertions, ${placed} bonds, `
      + `${world.counts.momentumShared.toLocaleString()} hops + `
      + `${world.counts.thermalKicks.toLocaleString()} kicks taken`);
  const c = census(w);
  report("and both laws actually fired, so the assertions were not watching nothing",
    world.counts.momentumShared > 0 && world.counts.thermalKicks > 0,
    `heat ${c.heat.toLocaleString()}, kinetic ${c.kinetic.toLocaleString()}, `
    + `momentum (${c.px}, ${c.py})`);
}

// ===========================================================================
console.log(`\n=== Check 6: with gravity OFF and no momentum, does heat move matter? ===`);
{
  // This is item 29 in the World rather than in the Lab. Gravity off means no
  // law can create momentum except the kick, and the world starts with none.
  //
  // THE CONTROL TOOK TWO GOES TO GET RIGHT, and both corrections are findings
  // rather than fixes, so they are named here:
  //
  //   CHEMISTRY IS AN ENERGY SOURCE AT T = 0. A world at absolute zero with
  //   bonds allowed does not stay there -- forming a bond releases its binding
  //   energy as heat, and that heat kicks. So BOND_FORM_PROB is 0 here. Check
  //   7 measures that on its own.
  //
  //   THE KICK IS FREE FOR HEAVY MATTER. Kinetic energy is floored to an
  //   integer, and one unit of momentum on a heavy primitive is worth less
  //   than one unit, so the "too cold" branch never fires for it. Only kinds
  //   1 to 4 are genuinely cold-locked under CANDIDATE_ZERO, so the control
  //   uses those. Check 8 measures the threshold.
  const stillborn = { ...CANDIDATE_ZERO, BOND_FORM_PROB: 0 };
  const rows = [];
  for (const heat of [0, 40, 200]) {
    const world = new World({ cols: 96, rows: 96, seed: 3, constants: stillborn, gravity: null });
    world.seed_(0.30, (rng) => 1 + rng.below(4));          // kinds 1..4: cold-lockable
    const w = world.w;
    for (let i = 0; i < w.cells; i++) {
      if (w.kind[i]) w.energy[i] = Math.min(ENERGY_MAX, heat * w.kind[i]);
    }
    world.seed_(0, () => 1);                 // re-baseline the books over the heat
    world.run(60, { checkEvery: 20 });
    const c = census(w);
    rows.push({
      heat, stepped: world.counts.stepped, kicks: world.counts.thermalKicks,
      cold: world.counts.kickUnaffordable, px: c.px, py: c.py, kinetic: c.kinetic,
    });
  }
  for (const r of rows) {
    console.log(`      T ~ ${String(r.heat).padStart(3)}:  `
      + `${String(r.stepped).padStart(6)} steps, ${String(r.kicks).padStart(6)} kicks, `
      + `${String(r.cold).padStart(6)} too cold to kick, `
      + `kinetic ${String(r.kinetic).padStart(7)}, net p (${r.px}, ${r.py})`);
  }
  const cold = rows[0], hot = rows[rows.length - 1];
  report("with no heat, no gravity and no chemistry, NOTHING moves",
    cold.stepped === 0 && cold.kicks === 0,
    `${cold.cold.toLocaleString()} kicks refused for want of heat -- README item 27 restated`);
  report("add heat and the same world moves, with no momentum supplied",
    hot.stepped > 0, `${hot.stepped.toLocaleString()} steps, every one paid for out of heat`);
  report("and every run's net momentum is still exactly zero",
    rows.every((r) => r.px === 0 && r.py === 0),
    `the pair cancels in integers, so there is no preferred direction`);
  console.log(`      steps by temperature: ${rows.map((r) => r.stepped).join(", ")} -- one seed.`);
  console.log(`      Whether this is monotonic in temperature needs a sweep (item 29 in the World).`);
}

// ===========================================================================
console.log(`\n=== Check 7: a world at absolute zero heats ITSELF, and then moves ===`);
{
  // Found 2026-11-07 by check 6's control failing: with gravity off, no
  // momentum and no heat anywhere, the world still took steps. Nothing was
  // broken. Forming a bond RELEASES its binding energy as heat (law 2), the
  // kick turns heat into motion (law 1), and the two compose -- so chemistry
  // is an energy source at T = 0, and the first one gravity has to beat.
  //
  // This bears on the chronology. TWO-RUNS.md expects collapse, then a hot
  // era, then recombination. If bonding alone can warm and stir the world
  // before gravity has gathered anything, the first era has competition that
  // THE-LAWS.md does not mention. Recorded here rather than argued.
  const world = new World({ cols: 96, rows: 96, seed: 3, constants: CANDIDATE_ZERO, gravity: null });
  world.seed_(0.30, (rng) => 1 + rng.below(255));
  const w = world.w;
  for (let i = 0; i < w.cells; i++) w.energy[i] = 0;
  world.seed_(0, () => 1);
  const e0 = totalEnergy(w);
  world.run(60, { checkEvery: 20 });
  const c = census(w);

  report("it starts with exactly zero energy and zero momentum",
    e0 === 0, `heat + kinetic + in flight = ${e0}`);
  report("bonds form and release heat into a world that had none",
    c.heat > 0 && world.counts.bondsFormed > 0,
    `${world.counts.bondsFormed.toLocaleString()} bonds formed, heat 0 -> ${c.heat.toLocaleString()}`);
  report("that heat becomes motion, and matter steps",
    world.counts.thermalKicks > 0 && world.counts.stepped > 0,
    `${world.counts.thermalKicks.toLocaleString()} kicks, ${world.counts.stepped.toLocaleString()} steps`);
  report("and the books still close, so none of it came from nowhere",
    (() => { try { world.ledger.check(w, "self-heated"); return true; } catch { return false; } })(),
    `all of it is bond potential, counted: ${world.ledger.bondPotential}`);
  report("net momentum is still exactly zero",
    c.px === 0 && c.py === 0, `(${c.px}, ${c.py})`);
}

// ===========================================================================
console.log(`\n=== Check 8: the kick is FREE above a kind threshold, and that is a finding ===`);
{
  // Also found 2026-11-07, also by check 6's control, and this one is not
  // about chemistry.
  //
  // Kinetic energy is floor(KE_SCALE * Q / 2k) -- an integer, because rule 5
  // wants conserved things in integers. One unit of momentum has Q = 2, so it
  // is worth KE_SCALE / k units of kinetic energy, which is BELOW ONE as soon
  // as k > KE_SCALE. For heavy matter the kick therefore costs nothing at all:
  // delta is 0, the "too cold" branch never fires, and a primitive at absolute
  // zero starts moving for free.
  //
  // THE BOOKS STILL CLOSE, which is why no assertion catches it: the ledger
  // floors the same way, so the energy it can see really is unchanged. What is
  // wrong is the PHYSICS -- "cold matter should be still" is the sentence the
  // unaffordable branch is there to enforce, and for 251 of 255 kinds it does
  // not enforce it.
  //
  // THIS IS INHERITED, NOT INTRODUCED. lab.mjs floors identically, so the Lab
  // has it too, and item 29's measurement ("heat moves matter": 1356, 1528,
  // 1473 steps across three temperature bands) was partly measuring this. The
  // flat trend across those bands is what a free kick would look like.
  //
  // Not fixed here. Fixing it is a physics decision -- raise KE_SCALE, cap the
  // kind range, carry fractional kinetic energy, or write down that cold heavy
  // matter does drift -- and rule 8 puts that in constants.mjs and THE-LAWS.md,
  // which is Ric's call and not this file's. So it is MEASURED here, so that
  // it cannot be rediscovered as a surprise a third time.
  const world = new World({ cols: 12, rows: 12, seed: 1, constants: CANDIDATE_ZERO, gravity: null });
  const w = world.w;
  const free = [], locked = [];
  for (let k = 1; k <= KIND_MAX; k++) {
    const i = 5 * w.cols + 5, j = neighbour(w, i, 0);
    w.kind[i] = k; w.kind[j] = k;
    w.energy[i] = 0; w.energy[j] = 0;
    w.mx[i] = 0; w.my[i] = 0; w.mx[j] = 0; w.my[j] = 0;
    world.seed_(0, () => 1);
    const why = world.exchange(i, j, 1, -1, -1, 1);
    (why === null ? free : locked).push(k);
    w.mx[i] = 0; w.my[i] = 0; w.mx[j] = 0; w.my[j] = 0;
    w.energy[i] = 0; w.energy[j] = 0;
  }
  console.log(`      cold-locked kinds (a kick costs real heat):  ${locked.join(", ") || "none"}`);
  console.log(`      free-kick kinds (a kick costs nothing):      ${free.length} of ${KIND_MAX}`
    + (free.length ? `, from kind ${free[0]} up` : ""));
  report("light matter at absolute zero cannot kick, so the branch does work",
    locked.length > 0, `kinds ${locked.join(", ")} are cold-locked, with KE_SCALE ${SETTLED.KE_SCALE}`);
  report("heavy matter at absolute zero CAN, which is the leak, measured not fixed",
    free.length > 0,
    `${free.length} of ${KIND_MAX} kinds move for free -- threshold is k > KE_SCALE, `
    + `because one unit of p is worth KE_SCALE/k floored units of kinetic energy`);
  report("the threshold is exactly where the arithmetic says it is, not somewhere odd",
    locked.every((k) => k <= SETTLED.KE_SCALE) && free.every((k) => k > SETTLED.KE_SCALE),
    `locked k <= ${SETTLED.KE_SCALE} < free k -- so raising KE_SCALE is one of the levers`);
}

console.log();
if (failures) {
  console.log(`${failures} CHECK(S) FAILED.`);
  process.exit(1);
}
console.log("All checks passed.");
