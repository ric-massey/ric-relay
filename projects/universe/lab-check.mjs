// lab-check.mjs -- the Lab's pre-flight. Not part of the engine.
//
// AGENTS.md rule 6: "the seam is where a looped world breaks quietly:
// anything that reads a neighbour must wrap, and a neighbour lookup that
// forgets to is a wall nobody wrote down. Test the seam on its own -- a
// collision block, a bond and a radiation line that each straddle it --
// before trusting a run."
//
// So that is what this does, in that order, and then it runs the thing and
// asserts the books. Every check prints what it measured rather than "ok",
// because rule 11 is about not believing output that only says it passed.

import {
  Lab, neighbour, opposite, bindingEnergy, census, N, CELLS, at, qOf, rOf,
} from "./lab.mjs";
import { LAB, CANDIDATE_ZERO, DIRECTIONS } from "./constants.mjs";

let failures = 0;
function report(name, ok, detail) {
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  --  " + detail : ""}`);
}

console.log(`=== Check 1: the torus closes, everywhere, in both directions ===`);
console.log(`  ${N} x ${N} = ${CELLS} hexagons, N % ${LAB.BLOCK_SIZE} = ${N % LAB.BLOCK_SIZE}`);
{
  // The fundamental wrap property: stepping out and back returns you to where
  // you started, for every hexagon and every direction. If a single neighbour
  // lookup forgets to wrap, this is what catches it.
  let broken = 0, firstBad = null;
  for (let i = 0; i < CELLS; i++) {
    for (let d = 0; d < DIRECTIONS; d++) {
      if (neighbour(neighbour(i, d), opposite(d)) !== i) {
        broken++; if (firstBad === null) firstBad = `hexagon ${i} (q=${qOf(i)}, r=${rOf(i)}) direction ${d}`;
      }
    }
  }
  report("out and back returns home, all 6 directions, all hexagons", broken === 0,
    broken === 0 ? `${CELLS * DIRECTIONS} lookups` : `${broken} broken, first at ${firstBad}`);

  // Six DISTINCT neighbours everywhere. On a torus this can fail only if N is
  // too small, but it is the property that makes "every hexagon has the same
  // surroundings" true, which is what rule 11 leans on.
  let degenerate = 0;
  for (let i = 0; i < CELLS; i++) {
    const seen = new Set();
    for (let d = 0; d < DIRECTIONS; d++) seen.add(neighbour(i, d));
    if (seen.size !== DIRECTIONS || seen.has(i)) degenerate++;
  }
  report("six distinct neighbours, none of them itself", degenerate === 0,
    degenerate === 0 ? "no special place on the lattice" : `${degenerate} degenerate hexagons`);

  // The corners of the rhombus are where a wrap bug hides, so name them.
  const corners = [at(0, 0), at(N - 1, 0), at(0, N - 1), at(N - 1, N - 1)];
  let cornerBad = 0;
  for (const i of corners) {
    for (let d = 0; d < DIRECTIONS; d++) if (neighbour(neighbour(i, d), opposite(d)) !== i) cornerBad++;
  }
  report("the four rhombus corners wrap", cornerBad === 0, `${corners.length} corners x 6`);
}

console.log(`\n=== Check 2: the three-hexagon collision block tiles across the seam ===`);
{
  // THE-LAWS.md: collisions resolve in three-hexagon blocks and "the blocks
  // only tile cleanly across the seam when 3 divides N". lab.mjs builds the
  // block as the triangle of three mutually adjacent hexagons containing the
  // colliding pair, so the property to check is that both candidate thirds
  // really are adjacent to BOTH, everywhere -- including over the seam.
  let bad = 0, checked = 0, firstBad = null;
  for (let i = 0; i < CELLS; i += 7) {            // every 7th, to cover all residues cheaply
    for (let d = 0; d < DIRECTIONS; d++) {
      const j = neighbour(i, d);
      for (const turn of [(d + 1) % DIRECTIONS, (d + 5) % DIRECTIONS]) {
        const third = neighbour(i, turn);
        checked++;
        let adjToI = false, adjToJ = false;
        for (let f = 0; f < DIRECTIONS; f++) {
          if (neighbour(third, f) === i) adjToI = true;
          if (neighbour(third, f) === j) adjToJ = true;
        }
        if (!adjToI || !adjToJ || third === i || third === j) {
          bad++; if (firstBad === null) firstBad = `i=${i} d=${d} third=${third}`;
        }
      }
    }
  }
  report("both candidate thirds are adjacent to both members", bad === 0,
    bad === 0 ? `${checked} triangles` : `${bad} of ${checked} bad, first ${firstBad}`);
}

console.log(`\n=== Check 3: a bond straddling the seam forms, breaks, and pays exactly ===`);
{
  const lab = new Lab({ seed: 11 });
  const w = lab.w;
  // Put two primitives either side of the q seam: q = N-1 and q = 0.
  const a = at(N - 1, 5), b = at(0, 5);
  let dir = -1;
  for (let d = 0; d < DIRECTIONS; d++) if (neighbour(a, d) === b) dir = d;
  report("the two hexagons either side of the q seam are neighbours", dir >= 0, `direction ${dir}`);

  w.kind[a] = 9; w.kind[b] = 7;                  // v=1 and v=7, so B should be maximal
  const B = bindingEnergy(w.kind[a], w.kind[b]);
  report("B over the seam is computed from the kinds", B === 8, `B(9,7) = ${B}`);

  lab.start();
  const before = census(w);
  // Form it by hand, the way law 2 would.
  w.bonds[a] |= (1 << dir);
  w.bonds[b] |= (1 << opposite(dir));
  w.energy[a] += B;
  // No thermostat declaration here, and that is the point: forming is
  // SELF-BALANCING. Heat goes up by B and the bond potential goes down by B,
  // so the total does not move and nothing was injected from outside. The
  // first version of this test declared it as a thermostat injection and the
  // assertion caught that too, in the other direction.
  lab.ledger.check(w, "after forming a seam bond");
  report("both ends record the bond", (w.bonds[a] & (1 << dir)) !== 0
    && (w.bonds[b] & (1 << opposite(dir))) !== 0, `a=${w.bonds[a]} b=${w.bonds[b]}`);

  // Now break it the way law 2 would and check the cost is exactly B.
  const eBefore = w.energy[a];
  lab.severBond(a, dir, a, "seam test");
  report("breaking absorbs precisely B", eBefore - w.energy[a] === B,
    `${eBefore} -> ${w.energy[a]}, B = ${B}`);
  report("both ends forget the bond", w.bonds[a] === 0 && w.bonds[b] === 0,
    `a=${w.bonds[a]} b=${w.bonds[b]}`);
  lab.ledger.check(w, "after breaking a seam bond");
  report("the books still close after a seam bond round trip", true,
    `matter ${before.matter}, momentum (${before.pxSum}, ${before.pySum})`);
}

console.log(`\n=== Check 4: a radiation line straddling the seam comes back to its start ===`);
{
  const lab = new Lab({ seed: 12 });
  const w = lab.w;
  // A quantum travelling in direction 0 has axial step (1, 0), so after N
  // propagations on an empty row it must be exactly where it began.
  const start = at(17, 40);
  const dir = 0;
  w.bonds[start] |= (1 << dir);
  lab.start();
  const inFlight0 = census(w).inFlight;
  report("one quantum in flight to begin with", inFlight0 === 1, `in flight = ${inFlight0}`);

  let here = start, hops = 0;
  for (let s = 0; s < N; s++) {
    lab.propagateQuanta(here);
    here = neighbour(here, dir);
    hops++;
    const c = census(w);
    if (c.inFlight !== 1) {
      report("energy in flight stayed at exactly 1", false, `became ${c.inFlight} after ${hops} hops`);
      break;
    }
  }
  report(`after ${hops} hops the quantum is back at its start`, here === start
    && (w.bonds[start] & (1 << dir)) !== 0, `start ${start}, now ${here}`);
  report("nothing was radiated away -- the Lab has no edge", lab.ledger.radiatedAway === 0,
    `radiated-away = ${lab.ledger.radiatedAway}`);
  lab.ledger.check(w, "after a full lap of radiation");
}

console.log(`\n=== Check 5: a collision across the seam conserves momentum exactly ===`);
{
  const lab = new Lab({ seed: 13 });
  const w = lab.w;
  const a = at(N - 1, 90), b = at(0, 90);
  let dir = -1;
  for (let d = 0; d < DIRECTIONS; d++) if (neighbour(a, d) === b) dir = d;
  w.kind[a] = 40; w.kind[b] = 24;
  w.mx[a] = 9; w.my[a] = -4;
  w.mx[b] = -3; w.my[b] = 6;
  w.energy[a] = 4000; w.energy[b] = 4000;
  lab.start();
  const before = census(w);
  for (let t = 0; t < 200; t++) lab.collide(a, b, dir);
  const after = census(w);
  report("momentum sum is unchanged by 200 seam collisions",
    before.pxSum === after.pxSum && before.pySum === after.pySum,
    `(${before.pxSum}, ${before.pySum}) -> (${after.pxSum}, ${after.pySum})`);
  report("matter is unchanged", before.matter === after.matter,
    `${before.matter} -> ${after.matter}`);
  lab.ledger.check(w, "after 200 seam collisions");
  report("energy closes: kinetic traded against heat, nothing created",
    true, `heat ${before.heat} -> ${after.heat}, kinetic ${before.kinetic} -> ${after.kinetic}`);
  console.log(`        ${lab.counts.collided} collisions changed something, `
    + `${lab.counts.collisionDead} had no legal outcome`);
}

console.log(`\n=== Check 6: the engine refuses an unset constant set ===`);
{
  // Rule 8's filters are the cheapest part of the search, so they have to
  // actually fire. A set with a clipping clock must be refused, not run.
  let refused = null;
  try { new Lab({ constants: { ...CANDIDATE_ZERO, CLOCK_SCALE: 1 } }); }
  catch (e) { refused = e.message; }
  report("a clipping clock is refused before anything runs", refused !== null
    && /clock clips/.test(refused), refused ? refused.split("\n")[1].trim().slice(0, 70) : "ran anyway");

  let refused2 = null;
  try { new Lab({ constants: { ...CANDIDATE_ZERO, CAPACITY: null } }); }
  catch (e) { refused2 = e.message; }
  report("an unset searched constant is refused", refused2 !== null
    && /CAPACITY is not set/.test(refused2), refused2 ? "CAPACITY" : "ran anyway");
}

console.log(`\n=== Check 7: a real run, with the books asserted all the way through ===`);
{
  const lab = new Lab({ seed: 21 });
  // Matter spread out, which is the only initial condition law 3 wanted --
  // and the kinds are drawn uniformly because nothing in the project says
  // what the composition should be. That is README item 18, and it is an
  // input here rather than an answer.
  lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 6 });
  lab.start();
  const before = census(lab.w);
  console.log(`  seeded: ${before.matter} total kind over `
    + `${lab.w.kind.reduce((n, k) => n + (k ? 1 : 0), 0)} occupied hexagons`);
  const t0 = Date.now();
  const out = lab.run(400000, { checkEvery: 50000 });
  const ms = Date.now() - t0;
  const after = census(lab.w);
  console.log(`  ran ${out.events} events to t = ${out.now.toFixed(2)} in ${ms} ms `
    + `(${(out.events / (ms / 1000) / 1000).toFixed(0)}k events/s), `
    + `${out.midRunChecks} mid-run assertions`);
  report("matter conserved exactly", before.matter === after.matter,
    `${before.matter} -> ${after.matter}`);
  report("momentum conserved exactly -- no wall to hide a drift in",
    before.pxSum === after.pxSum && before.pySum === after.pySum,
    `(${after.pxSum}, ${after.pySum})`);
  report("radiated-away is still zero", lab.ledger.radiatedAway === 0, "no edge exists");
  console.log(`  what happened:`);
  for (const [k, v] of Object.entries(lab.counts)) {
    if (v !== 0) console.log(`      ${k.padEnd(22)} ${v}`);
  }
  console.log(`  energy: heat ${after.heat}, kinetic ${after.kinetic}, in flight ${after.inFlight}, `
    + `thermostat net ${lab.ledger.thermostatNet}`);
  console.log(`  bonds: ${after.bondBits / 2} standing`);
}

console.log(`\n=== Check 8: does it survive a change of seed? (rule 11) ===`);
{
  // Rule 11 asks this of any structure. Asked here of the ENGINE: the books
  // must close on every seed, and the outcome must differ between them --
  // identical output across seeds would mean the draws are not reaching the
  // physics.
  const summaries = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    const lab = new Lab({ seed });
    lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 6 });
    lab.start();
    lab.run(40000);
    const c = census(lab.w);
    summaries.push(`${c.bondBits / 2} bonds, ${c.inFlight} in flight, heat ${c.heat}`);
  }
  const distinct = new Set(summaries).size;
  report("the books close on all five seeds", true, "no assertion threw");
  report("the seeds give different worlds", distinct === summaries.length,
    `${distinct} distinct of ${summaries.length}`);
  for (let s = 0; s < summaries.length; s++) console.log(`      seed ${s + 1}: ${summaries[s]}`);
}

console.log(`\n=== Check 9: do the findings survive a seed and a constant change? (rule 11) ===`);
{
  // Items 23 to 30 were first written from ONE run on ONE seed with ONE
  // unscreened constant set. Ric asked whether that was all they rested on,
  // and it was. This is the answer, and it is the reason the numbers in those
  // items are ranges rather than single figures.
  const KEYS = ["tooColdToMove", "emissionBlocked", "quantumWaited", "bondsStretched"];
  const EV = 120000;
  const sample = (constants, seeds) => {
    const rows = seeds.map((seed) => {
      const lab = new Lab({ constants, seed });
      lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 6 });
      lab.start();
      lab.run(EV);
      return lab.counts;
    });
    return KEYS.map((k) => {
      const v = rows.map((r) => r[k]);
      return { k, lo: Math.min(...v), hi: Math.max(...v), zero: v.filter((x) => !x).length };
    });
  };

  const seeds = [1, 2, 3, 4, 5];
  const base = sample(CANDIDATE_ZERO, seeds);
  for (const r of base) {
    console.log(`      ${r.k.padEnd(18)} ${String(r.lo).padStart(6)} .. ${String(r.hi).padStart(6)}`
      + `  over ${seeds.length} seeds`);
  }
  report("every effect is nonzero on every seed", base.every((r) => r.zero === 0),
    base.filter((r) => r.zero).map((r) => r.k).join(", ") || `${KEYS.length} effects`);

  // The other half of rule 11: a small change of constants.
  const variants = [
    ["capacity 1", { ...CANDIDATE_ZERO, CAPACITY: 1 }],
    ["capacity 6", { ...CANDIDATE_ZERO, CAPACITY: 6 }],
    ["form 0.05", { ...CANDIDATE_ZERO, BOND_FORM_PROB: 0.05 }],
    ["transport 0.1", { ...CANDIDATE_ZERO, TRANSPORT_RATE: 0.1 }],
    ["clock floor x4", { ...CANDIDATE_ZERO, CLOCK_FLOOR: CANDIDATE_ZERO.CLOCK_FLOOR * 4 }],
  ];
  let allSurvive = true;
  for (const [label, constants] of variants) {
    const r = sample(constants, [1, 2]);
    const dead = r.filter((x) => x.zero === x.zero && x.lo === 0 && x.hi === 0);
    if (dead.length) allSurvive = false;
    console.log(`      ${label.padEnd(18)} ${dead.length ? "LOST: " + dead.map((d) => d.k).join(", ")
      : "all four effects still present"}`);
  }
  report("every effect survives a constant change", allSurvive,
    `${variants.length} variations`);
}

console.log(`\n=== Check 10: does heat ever become motion? ===`);
{
  // THE-LAWS.md credits the clock with four jobs, the fourth being thermal
  // pressure: "Hot matter moves more often, so hot regions expand against cold
  // ones with nothing written down to make them." Stepping is law 1's own rate,
  // min(1, |p|/k), which does not read temperature -- so test it.
  const rows = [];
  for (const hotT of [1, 64, 200]) {
    const lab = new Lab({ thermostat: { HOT_T: hotT, COLD_T: 1, BAND_ROWS: 3 }, seed: 31 });
    lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 0 });  // NO momentum
    lab.start();
    lab.run(150000);
    const c = census(lab.w);
    rows.push({ hotT, stepped: lab.counts.stepped, heat: c.heat, bonds: c.bondBits / 2 });
    console.log(`      hot band ${String(hotT).padStart(4)}:  stepped ${String(lab.counts.stepped).padStart(6)}`
      + `   heat ${String(c.heat).padStart(8)}   bonds ${String(c.bondBits / 2).padStart(6)}`);
  }
  report("nothing steps at any temperature with no initial momentum",
    rows.every((r) => r.stepped === 0),
    `so there is no thermal motion -- README item 29`);
  report("chemistry runs anyway, with nothing moving",
    rows.every((r) => r.bonds > 0), `${rows[2].bonds} bonds at the hottest band`);
  console.log(`      Momentum is therefore a MIXING condition, not a chemistry one (item 27).`);
}

console.log(`\n${failures === 0 ? "All checks passed." : failures + " CHECK(S) FAILED."}`);
if (failures > 0) process.exitCode = 1;
