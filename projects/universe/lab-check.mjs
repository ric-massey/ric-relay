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
  Lab, neighbour, opposite, bindingEnergy, census, N, CELLS, at, qOf, rOf, matterSpeed,
} from "./lab.mjs";
import { LAB, CANDIDATE_ZERO, DIRECTIONS, capacityOf, HOT_T_MAX, KIND_MAX, ENERGY_MAX,
  MOMENTUM_RANGE } from "./constants.mjs";

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

  // Was CAPACITY until 2026-11-06, which stopped being a searched constant
  // when law 4 started deriving it from kind. Aimed at THERMAL_KICK_PROB now:
  // the newest constant is the one most likely to be forgotten by a caller.
  let refused2 = null;
  try { new Lab({ constants: { ...CANDIDATE_ZERO, THERMAL_KICK_PROB: null } }); }
  catch (e) { refused2 = e.message; }
  report("an unset searched constant is refused", refused2 !== null
    && /THERMAL_KICK_PROB is not set/.test(refused2), refused2 ? "THERMAL_KICK_PROB" : "ran anyway");

  // And law 4's capacity is now a FORM, so what needs checking is the form
  // over every kind that can exist rather than one value. An inert kind -- one
  // with capacity 0 -- would be item 15's heavy-matter failure arriving from
  // law 4 instead of from a field width.
  //
  // Note what this does NOT do: it does not try to provoke a refusal. The
  // first version of this check did, by setting BOND_MODULUS to 1, and it
  // could never have worked -- capacityOf clamps with Math.max(1, ...), so no
  // modulus reaches 0 and FILTER 3 cannot fire for this form. The filter is
  // kept anyway, because the clamp is a property of candidate form ONE and the
  // next form may not have one. So: assert the property, and record that it is
  // the clamp and not the modulus that delivers it.
  {
    let worst = null, worstK = 0;
    for (let k = 1; k <= 255; k++) {
      const cap = capacityOf(k, CANDIDATE_ZERO);
      if (worst === null || cap < worst) { worst = cap; worstK = k; }
    }
    const caps = new Set();
    for (let k = 1; k <= 255; k++) caps.add(capacityOf(k, CANDIDATE_ZERO));
    report("every kind has a legal capacity, so none is born inert",
      worst >= 1, `lowest is ${worst} at kind ${worstK}; ${caps.size} distinct capacities over 255 kinds`);
    report("and capacity actually VARIES by kind, which is the point of item 6",
      caps.size > 1, `capacities present: ${[...caps].sort((a, b) => a - b).join(", ")}`);
  }
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
  report("the world starts at exactly zero momentum", before.pxSum === 0 && before.pySum === 0,
    `(${before.pxSum}, ${before.pySum}) -- seeds 7 and 107 did not until 2026-11-06`);
  {
    // The two seeds the old 1,000-pass cap left drifting. Checked directly,
    // because a constant total is all the run's own assertion can see.
    const starts = [7, 107].map((seed) => {
      const l = new Lab({ seed });
      l.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 6 });
      const c = census(l.w); return `${seed}: (${c.pxSum}, ${c.pySum})`;
    });
    report("including the seeds that used to start drifting", starts.every((s) => s.endsWith("(0, 0)")),
      starts.join(", "));
  }
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
  // bondsStretched -> bondedStepped ON 2026-11-06, and this is a replacement
  // rather than a deletion. The effect it watched was "motion broke a bond",
  // and once GAP 3 was settled motion cannot break a bond at all, so that
  // counter is zero by construction in every run -- not rare, impossible.
  // Dropping it and leaving three keys would have been the dishonest move: it
  // would read as a check that got easier.
  //
  // bondedStepped is the right replacement because it is the effect this
  // project had been WRONG about. It counts steps taken by a primitive that
  // was bonded at the time -- clusters moving without coming apart -- and
  // nothing counted it until GAP 3 was settled, which is why "refusing a
  // stretching step freezes clusters solid" went unchallenged for two days.
  // It is also the effect most likely to disappear silently if someone
  // changes how bonds are re-pointed after a step, and nothing else here
  // would notice.
  //
  // (For part of that day this read "dragged" and then "pushedAlongBond", for
  // two mechanisms that were built and removed the same day. Both are in the
  // git history; the second is in rejected/push-along-bond.txt with the
  // numbers that killed it, and README item 32 has the first.)
  const KEYS = ["tooColdToMove", "emissionBlocked", "quantumWaited", "bondedStepped"];

  // EV WENT 120,000 -> 400,000 ON 2026-11-06, and the reason is worth keeping
  // because it is a lesson about this check rather than about the physics.
  //
  // "transport 0.1" began reporting LOST: quantumWaited. It looked like a
  // regression from the same day's KE_SCALE change and it was not. Measured:
  // quantumWaited is the rarest of the four by a long way -- about 110 per
  // seed per 400,000 events at baseline, and transport 0.1 makes it roughly
  // FIFTY TIMES rarer still, about 1. At 120,000 events that variation
  // expects well under one occurrence per seed, so reading zero was the
  // sample being too small to contain the effect.
  //
  // It was already marginal before anything changed: at 40,000 events the
  // BASELINE reads zero on two seeds in five. So the check had been passing
  // on luck, and the honest fix is more events rather than fewer effects --
  // dropping quantumWaited from KEYS would have made the symptom go away and
  // thrown out the one effect that is sensitive to law 5's rate.
  const EV = 400000;
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
    ["kick 0.05", { ...CANDIDATE_ZERO, THERMAL_KICK_PROB: 0.05 }],
    ["kick 0.90", { ...CANDIDATE_ZERO, THERMAL_KICK_PROB: 0.90 }],
    ["form 0.05", { ...CANDIDATE_ZERO, BOND_FORM_PROB: 0.05 }],
    ["transport 0.1", { ...CANDIDATE_ZERO, TRANSPORT_RATE: 0.1 }],
    ["clock floor x4", { ...CANDIDATE_ZERO, CLOCK_FLOOR: CANDIDATE_ZERO.CLOCK_FLOOR * 4 }],
  ];
  let allSurvive = true;
  for (const [label, constants] of variants) {
    const r = sample(constants, [1, 2, 3]);   // three, not two -- see EV above
    const dead = r.filter((x) => x.zero === x.zero && x.lo === 0 && x.hi === 0);
    if (dead.length) allSurvive = false;
    console.log(`      ${label.padEnd(18)} ${dead.length ? "LOST: " + dead.map((d) => d.k).join(", ")
      : "all four effects still present"}`);
  }
  report("every effect survives a constant change", allSurvive,
    `${variants.length} variations`);
}

console.log(`\n=== Check 10: does heat become motion, and does it still sum to zero? ===`);
{
  // REWRITTEN 2026-11-06, and the old version is worth keeping in view: it
  // asserted that NOTHING steps at any temperature, which was true and was
  // README item 29 -- the clock was credited with producing thermal pressure
  // and could not, because stepping runs on law 1's rate min(1, |p|/k) and
  // that never reads temperature.
  //
  // Ric's call was to connect them (item 29, 2026-11-06), so the assertion
  // inverts: heat must now move matter. The number that matters more than
  // that one is the SECOND assertion. The kick works by giving a pair equal
  // and opposite momentum, so the world's total must still be exactly zero
  // after millions of kicks -- if it is not, the kick is a leak wearing a
  // law's clothes, and no amount of plausible motion makes up for it.
  const rows = [];
  for (const hotT of [1, 64, 200]) {
    const lab = new Lab({ thermostat: { HOT_T: hotT, COLD_T: 1, BAND_ROWS: 3 }, seed: 31 });
    lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 0 });  // NO momentum
    lab.start();
    lab.run(150000);
    const c = census(lab.w);
    rows.push({ hotT, stepped: lab.counts.stepped, heat: c.heat, bonds: c.bondBits / 2,
      kicks: lab.counts.thermalKicks, px: c.pxSum, py: c.pySum });
    console.log(`      hot band ${String(hotT).padStart(4)}:  stepped ${String(lab.counts.stepped).padStart(6)}`
      + `   kicks ${String(lab.counts.thermalKicks).padStart(6)}`
      + `   heat ${String(c.heat).padStart(8)}   bonds ${String(c.bondBits / 2).padStart(6)}`
      + `   net p (${c.pxSum}, ${c.pySum})`);
  }
  report("heat moves matter, with no momentum supplied at the start",
    rows.every((r) => r.stepped > 0),
    `${rows[0].stepped}, ${rows[1].stepped}, ${rows[2].stepped} steps -- item 29 settled by connecting them`);
  report("and the world's momentum is still exactly zero",
    rows.every((r) => r.px === 0 && r.py === 0),
    `the pair cancels in integers, so there is no preferred direction`);
  report("chemistry still runs", rows.every((r) => r.bonds > 0),
    `${rows[2].bonds} bonds at the hottest band`);
  // Reported, NOT asserted. Thermal pressure needs hot regions to move more
  // than cold ones, and the trend here is in the right direction -- but it is
  // three bands on one seed, and the clock's rate is not the only thing that
  // differs between them. It belongs in a sweep before anyone claims it.
  // Thermal pressure would need hot regions to move MORE than cold ones. Do
  // not read that off these three numbers: the trend was monotonic at
  // KE_SCALE 64 and stopped being monotonic at 4, which is all the evidence
  // needed that three bands on one seed cannot tell the difference between a
  // trend and noise. Printed as data, with no claim attached.
  console.log(`      steps by band: ${rows.map((r) => r.stepped).join(", ")} -- NOT a trend on one seed.`);
  console.log(`      Whether hot regions really move more than cold ones needs a sweep (item 29).`);
}

console.log(`\n=== Check 11: the hot band fits, with room for what arrives (item 30) ===`);
{
  // Item 30: a held band cannot exceed ENERGY_MAX / heaviest kind, and needs
  // headroom under that for arriving radiation. HOT_T_MAX is derived from the
  // first half; this checks the engine refuses past it at startup, and then
  // MEASURES the second half rather than trusting the - 1.
  let refused = false;
  try { new Lab({ thermostat: { HOT_T: HOT_T_MAX + 1, COLD_T: 1, BAND_ROWS: 3 }, seed: 1 }); }
  catch (e) { refused = /item 30/.test(e.message); }
  report(`a band at ${HOT_T_MAX + 1} is refused before the run, not during it`, refused,
    `${HOT_T_MAX + 1} x ${KIND_MAX} = ${(HOT_T_MAX + 1) * KIND_MAX} against ${ENERGY_MAX}`);

  const used = [];
  for (const seed of [41, 42, 43]) {
    const lab = new Lab({ thermostat: { HOT_T: HOT_T_MAX, COLD_T: 1, BAND_ROWS: 3 }, seed });
    lab.seedWorld(0.35, (rng) => 1 + rng.below(255), { momentumRange: 6 });
    lab.start();
    lab.run(200000);              // throws if any hexagon ever passed the field
    used.push(lab.thermostatHeadroomUsed);
  }
  const worst = Math.max(...used);
  console.log(`      held at ${HOT_T_MAX}, share of headroom used before the thermostat refired: `
    + used.map((u) => (100 * u).toFixed(1) + "%").join(", "));
  report(`the band holds at ${HOT_T_MAX} for 200,000 events on 3 seeds, field never reached`, true,
    `worst ${(100 * worst).toFixed(1)}% of the room used`);
  report("and uses well under half its headroom, so the margin is not luck", worst < 0.5,
    `${(100 * worst).toFixed(1)}% -- if this rises, widen the margin in HOT_T_MAX, do not loosen this`);
}

console.log(`\n=== Check 12: no matter reaches the speed limit ===`);
{
  // Ric, 2026-11-06: "I don't want anything of matter to reach that speed."
  // Law 1's speed is relativity's |p| / sqrt(k^2 + |p|^2). Checked over every
  // kind and every legal momentum vector, in the engine's own floating point,
  // because 0.99999... rounding to 1 would be the same failure as before.
  let fastest = 0, at = "";
  for (let x = -MOMENTUM_RANGE; x <= MOMENTUM_RANGE; x++) {
    for (let y = -MOMENTUM_RANGE; y <= MOMENTUM_RANGE; y++) {
      const z = -x - y;
      if (Math.abs(z) > MOMENTUM_RANGE) continue;
      const Q = x * x + y * y + z * z;
      for (let k = 1; k <= KIND_MAX; k++) {
        const v = matterSpeed(Q, k);
        if (v > fastest) { fastest = v; at = `kind ${k}, p (${x}, ${y}, ${z})`; }
      }
    }
  }
  report("every kind at every legal momentum moves strictly slower than the limit", fastest < 1,
    `fastest is ${fastest.toFixed(6)} of the limit, at ${at}`);
  report("slow matter is unchanged in practice", Math.abs(matterSpeed(2 * 1, 10) / 0.1 - 1) < 0.01,
    `|p| = k/10 moves at ${(matterSpeed(2 * 1, 10) / 0.1).toFixed(4)} of |p|/k`);
}

console.log(`\n=== Check 13: a free primitive travels true, at the right speed (item 34) ===`);
{
  // Law 1 steps by "track" since 2026-11-06: the primitive keeps its true
  // position inside its hexagon and enters the hexagon its straight path
  // enters next. Under nearest-of-six a heading 20 degrees off a lattice
  // direction travelled at 0 degrees for ever. One primitive, alone, five
  // headings, sampled every 50 events so the 258-wide loop is never lapped
  // between samples (wave.mjs's lesson: on a torus a distance is a path).
  const wrapd = (v) => ((v + N / 2) % N + N) % N - N / 2;
  let worstHead = 0, worstSpeed = 0;
  const rows = [];
  for (const [x, y] of [[20, -20], [13, -20], [7, -20], [-11, -9], [3, 17]]) {
    const lab = new Lab({ thermostat: { HOT_T: 0, COLD_T: 0, BAND_ROWS: 0 }, seed: 5 });
    const w = lab.w, i0 = at(N >> 1, N >> 1);
    w.kind[i0] = 40; w.mx[i0] = x; w.my[i0] = y;
    lab.start();
    let cur = i0, cq = 0, cr = 0;
    for (let e = 1; e <= 400; e++) {
      lab.run(e * 50);
      let k = 0; while (!w.kind[k]) k++;
      cq += wrapd(qOf(k) - qOf(cur)); cr += wrapd(rOf(k) - rOf(cur)); cur = k;
    }
    const X = cq + cr / 2 + w.ox[cur], Y = cr * Math.sqrt(3) / 2 + w.oy[cur];
    const z = -x - y, ux = x + z / 2, uy = z * Math.sqrt(3) / 2;
    let dh = (Math.atan2(Y, X) - Math.atan2(uy, ux)) * 180 / Math.PI;
    dh = ((dh + 540) % 360) - 180;
    const Q = x * x + y * y + z * z;
    const speed = Math.hypot(X, Y) / lab.now / (lab.causal * matterSpeed(Q, 40));
    worstHead = Math.max(worstHead, Math.abs(dh));
    worstSpeed = Math.max(worstSpeed, Math.abs(speed - 1));
    rows.push(`(${x},${y}) ${dh.toFixed(2)} deg, speed ${speed.toFixed(3)}`);
  }
  console.log("      " + rows.join("   "));
  report("every heading travels true, not along a lattice direction", worstHead < 0.5,
    `worst heading error ${worstHead.toFixed(2)} deg -- nearest-of-six missed by up to 30`);
  report("and at the speed law 1 gives it", worstSpeed < 0.02,
    `worst ${(100 * worstSpeed).toFixed(1)}% off -- LAB.TRACK_EDGE_FLOOR costs only corner clips`);
}

console.log(`\n${failures === 0 ? "All checks passed." : failures + " CHECK(S) FAILED."}`);
if (failures > 0) process.exitCode = 1;
