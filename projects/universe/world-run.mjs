// world-run.mjs -- run the World and print what it did.
//
// WHAT A RUN SHOWS CHANGED ON 2026-11-08, because the laws did. This file used
// to read the three eras of TWO-RUNS.md off a run -- collapse, the hot era,
// recombination -- and two of those three were gravity's. With one hexagon
// declared to be one atom, gravity left the engine (README items 20 and 37)
// and expansion left with it (item 22), so there is no collapse to watch and
// no hot era for a cooling to follow.
//
// What is left is a sealed sheet of matter with an edge, and three things worth
// measuring about it:
//
//   1. CHEMISTRY     bonds form and hold, and law 2 releases heat doing it.
//                    This is the only source of energy a run has after tick 0.
//   2. COOLING       the edge is the only sink. A quantum that steps off is
//                    gone and counted. Watch `radiated` rise and meanT fall.
//   3. THE GRADIENT  a surface sink drains the perimeter, and perimeter over
//                    area falls as 1/side -- so a big sheet cannot cool evenly
//                    however long it runs. What it can do is grow a cool SKIN
//                    over a hot interior, which is what real matter does. The
//                    band columns are temperature by depth, skin first.
//
// The gradient is the prediction that made the edge worth building rather than
// the expansion drain, and it is the one this file exists to check. If the skin
// and the core read the same after a long run, the edge is not cooling anything
// and item 36 is still open.
//
// Nothing here should ever be quoted as a finding: three seeds of one size with
// CANDIDATE_ZERO is a steering run (rule 11).
//
// Usage:
//   node world-run.mjs                                a first look, 3 seeds
//   node world-run.mjs --seeds 1                      one seed, quick
//   node world-run.mjs --ticks 20000 --sample 2000    long enough to cool
//   node world-run.mjs --temp0 9 --p0 6               start hot and moving
//   node world-run.mjs --size 96                      small, so the edge is near
//   node world-run.mjs --json runs/mine.json          choose where it lands
//   node world-run.mjs --no-json                      do not write it out

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { World, census, countMatter } from "./world.mjs";
import { CANDIDATE_ZERO, SETTLED } from "./constants.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const num = (n, d) => { const v = flag(n, null); return v === null ? d : Number(v); };
const has = (n) => argv.includes("--" + n);

// The three readings' thresholds. Named because they are instrument settings
// and not physics (rule 8): they say how big a change this file is willing to
// call real, and nothing in the laws depends on them.
const BONDED_FLOOR = 0.01;      // 1% of matter bonded is chemistry happening
const COOL_FRACTION = 0.01;     // mean temperature has to fall by 1% to count
const GRADIENT_RATIO = 1.02;    // and the core has to be 2% hotter than the skin

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const OPT = {
  size:   num("size", 258),
  ticks:  num("ticks", 3000),
  seeds:  String(flag("seeds", flag("seed", "1,2,3"))).split(",").map(Number),
  fill:   num("fill", 0.30),
  temp0:  num("temp0", 0),           // energy per unit of kind, at tick 0
  p0:     num("p0", 0),              // momentum components drawn in +-p0
  sample: num("sample", 0),          // 0 = ticks/6, so a run always has a table
  check:  num("check", 0),           // 0 = ticks/6 as well
  json:   has("no-json") ? null : flag("json", `runs/world-${stamp}.json`),
};
if (!OPT.sample) OPT.sample = Math.max(1, Math.round(OPT.ticks / 6));
if (!OPT.check) OPT.check = Math.max(1, Math.round(OPT.ticks / 6));

if (OPT.seeds.some((s) => !Number.isFinite(s))) {
  throw new Error(`--seeds wants numbers, got "${flag("seeds", flag("seed", ""))}"`);
}

console.log(`World ${OPT.size}x${OPT.size}, seed${OPT.seeds.length > 1 ? "s" : ""} `
  + `${OPT.seeds.join(", ")}, fill ${OPT.fill}, ${OPT.ticks} ticks`);
console.log(`  a bounded sheet: four laws, no thermostat, and an EDGE that light leaves through.`);
console.log(`  one hexagon is one atom, so there is no gravity here (README items 20, 37).`);
console.log(OPT.temp0 || OPT.p0
  ? `  start    temperature ${OPT.temp0} (a bond needs B above its own temperature, and B is at `
    + `most ${SETTLED.BOND_MODULUS}), momentum +-${OPT.p0}, net zero`
  : `  start    absolute zero: no heat, no momentum. Law 2 is the only thing that can warm it.`);
console.log(`  constants: CANDIDATE_ZERO, the plumbing test point. Not a chosen physics.`);

const HEAD = "  tick    matter   meanT    bonds  bonded%  contrast   kinetic   flight  radiated"
  + "    skin     core";
const RULE = "  ----    ------   -----    -----  -------  --------   -------   ------  --------"
  + "    ----     ----";
const show = (r) => console.log(
  `  ${String(r.tick).padStart(5)} ${String(r.matterCells).padStart(8)} `
  + `${r.meanTemp.toFixed(2).padStart(7)} ${String(r.bonds).padStart(8)} `
  + `${(r.bondedFraction * 100).toFixed(1).padStart(7)} `
  + `${r.densityContrast.toFixed(3).padStart(9)} ${String(r.kinetic).padStart(9)} `
  + `${String(r.inFlight).padStart(8)} ${String(r.radiated).padStart(9)} `
  + `${r.bandTemp[0].toFixed(3).padStart(7)} `
  + `${r.bandTemp[r.bandTemp.length - 1].toFixed(3).padStart(8)}`);

// --------------------------------------------------------------- one seed
function runOne(seed) {
  const world = new World({ cols: OPT.size, rows: OPT.size, seed, constants: CANDIDATE_ZERO });
  world.seed_(OPT.fill, (rng) => 1 + rng.below(255),
              { temp0: OPT.temp0, momentumRange: OPT.p0 });
  const energy0 = world.ledger.energy0;

  const started = Date.now();
  console.log(`\n=== seed ${seed} ===`);
  console.log(HEAD);
  console.log(RULE);
  world.sample();
  show(world.history[0]);

  const out = world.run(OPT.ticks, {
    sampleEvery: OPT.sample, checkEvery: OPT.check, onSample: show,
  });

  const elapsed = Date.now() - started;
  console.log();
  console.log(`  ${out.ticks} ticks in ${(elapsed / 1000).toFixed(1)} s `
    + `(${(out.ticks / (elapsed / 1000)).toFixed(1)} ticks/s, ${out.cells.toLocaleString()} cells)`);
  console.log(`  the books closed at every check -- energy, matter and momentum, with the`);
  console.log(`  radiated total as the only term that may grow`);

  const h = world.history;
  const first = h[0], last = h[h.length - 1];
  const peak = (f) => h.reduce((a, b) => (f(b) > f(a) ? b : a), h[0]);
  const bondPeak = peak((r) => r.bondedFraction);
  // THE SKIN AGAINST THE BULK, NOT AGAINST THE INNERMOST BAND. This first
  // compared band 0 with band 7, and band 7 is the worst number in the row:
  // the bands are equal fractions of the way in, so the innermost holds the
  // least matter -- 43,183 primitives against the skin's 632,431 in the first
  // 258x258 run -- and it swings by a few percent on noise alone. Seed 3
  // reported NO GRADIENT on that comparison while its skin was plainly 7%
  // cooler than everything else in the sheet.
  //
  // So the bulk is the matter-weighted mean of every band but the skin, which
  // is what "the rest of the sheet" means and is as stable as the sheet is
  // large. Measured 2026-11-08: the gradient in this engine is a SKIN EFFECT
  // one band deep -- the skin cool, the interior flat -- and not a smooth
  // profile from edge to centre.
  const bands = last.bandTemp;
  const skin = bands[0];
  let bulkEnergy = 0, bulkMatter = 0;
  for (let b = 1; b < bands.length; b++) {
    bulkEnergy += bands[b] * last.bandMatter[b];
    bulkMatter += last.bandMatter[b];
  }
  const core = bulkMatter ? bulkEnergy / bulkMatter : 0;

  // THE GRADIENT IS ONLY A GRADIENT IF THE SKIN HAS MATTER IN IT. A band with
  // nothing in it reads 0.00, which looks exactly like a perfectly cooled skin
  // and is in fact an empty one -- the same mistake the old density statistic
  // made in the other direction, so it is tested rather than assumed.
  const skinHasMatter = last.bandMatter[0] > 0 && bulkMatter > 0;

  // COOLING MEANS THE HEAT WENT AWAY, and for a cold start the temperature it
  // fell FROM is the peak it reached on its own, not the zero it was seeded at.
  // A sheet seeded cold warms itself through law 2 and then radiates, so the
  // honest test is against the hottest it ever got.
  const hotPeak = peak((r) => r.meanTemp);
  // And what the radiated total is a fraction of is not what the world was
  // seeded with: a cold start is seeded with nothing, and this line printed
  // "0.00% of everything it started with" about a sheet that had radiated away
  // every unit it ever had. The budget is what was placed plus what law 2 has
  // released, and released energy is exactly the bond potential gone negative.
  const released = Math.max(0, -world.ledger.bondPotential);
  const budget = energy0 + released;
  const saw = {
    chemistry: bondPeak.bondedFraction >= BONDED_FLOOR,
    cooling: hotPeak.meanTemp > 0
      ? last.meanTemp < hotPeak.meanTemp * (1 - COOL_FRACTION)
      : last.radiated > 0,
    gradient: skinHasMatter && skin > 0 && core / skin >= GRADIENT_RATIO,
  };

  console.log();
  console.log(`  what this seed showed:`);
  console.log(`    chemistry      ${(first.bondedFraction * 100).toFixed(1)}% -> `
    + `${(bondPeak.bondedFraction * 100).toFixed(1)}% bonded at tick ${bondPeak.tick}, `
    + `${world.counts.bondsFormed.toLocaleString()} formed and `
    + `${world.counts.bondsBroken.toLocaleString()} broken`
    + (saw.chemistry ? "" : "   NOT SEEN"));
  console.log(`    cooling        mean temperature ${first.meanTemp.toFixed(3)} -> peak `
    + `${hotPeak.meanTemp.toFixed(3)} at tick ${hotPeak.tick} -> ${last.meanTemp.toFixed(3)}; `
    + `${last.radiated.toLocaleString()} units radiated away, `
    + `${budget ? ((last.radiated / budget) * 100).toFixed(2) : "0.00"}% of its whole energy `
    + `budget (${energy0.toLocaleString()} seeded + ${released.toLocaleString()} released by law 2)`
    + (saw.cooling ? "" : "   NOT SEEN"));
  console.log(`    the gradient   skin ${skin.toFixed(4)}, the rest of the sheet ${core.toFixed(4)}`
    + (skin > 0 ? ` -- the bulk is ${(core / skin).toFixed(3)}x the skin` : "")
    + (saw.gradient ? "" : skinHasMatter ? "   NOT SEEN" : "   NO MATTER IN A BAND"));
  console.log(`    by depth       ${bands.map((t) => t.toFixed(4)).join("  ")}`);
  console.log(`    matter/band    ${last.bandMatter.map((m) => m.toLocaleString()).join("  ")}`);

  console.log(`    the edge       ${world.counts.escaped.toLocaleString()} quanta crossed it, `
    + `${world.counts.emittedOff.toLocaleString()} radiated straight off the skin`);
  console.log(`    light          ${world.counts.emitted.toLocaleString()} emitted, `
    + `${world.counts.absorbed.toLocaleString()} absorbed, `
    + `${world.counts.quantaMoved.toLocaleString()} moved`
    + (world.counts.emitted
      ? ` -- ${((world.counts.absorbed / world.counts.emitted) * 100).toFixed(1)}% reabsorbed`
      : ""));
  console.log(`    motion         ${world.counts.stepped.toLocaleString()} steps, of which `
    + `${world.counts.bondedStepped.toLocaleString()} by bonded matter; `
    + `${world.counts.blocked.toLocaleString()} blocked, `
    + `${world.counts.bondsStretched.toLocaleString()} refused by a bond`);
  console.log(`    the push       ${world.counts.pushedAlongBond.toLocaleString()} along a bond, `
    + `${world.counts.pushRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.pushUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.pushNoRoom.toLocaleString()} no room for the heat`);
  console.log(`    shared         ${world.counts.momentumShared.toLocaleString()} momentum hops along bonds, `
    + `${world.counts.shareUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.shareRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.shareNoRoom.toLocaleString()} no room`);
  console.log(`    kicks          ${world.counts.thermalKicks.toLocaleString()} heat-to-motion kicks, `
    + `${world.counts.kickUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.kickNoPartner.toLocaleString()} no partner, `
    + `${world.counts.kickRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.kickNoRoom.toLocaleString()} no room`);

  return {
    seed, saw, ticks: out.ticks, energy0, released, budget,
    first, last, bondPeak, skin, core,
    counts: world.counts,
    census: census(world.w),
    matterCells: countMatter(world.w),
    history: h,
  };
}

const runs = OPT.seeds.map(runOne);

// ------------------------------------------------------- across the seeds
// RULE 11. One seed is not a finding. A reading is claimed here only if every
// seed showed it; a split is reported as a split, because a split IS the
// reading.
const agree = (k) => runs.filter((r) => r.saw[k]).length;
const all = (k) => agree(k) === runs.length;
const tally = (k) => `${agree(k)} of ${runs.length} seeds`;

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

console.log();
say(`ACROSS ${runs.length} SEED${runs.length > 1 ? "S" : ""}:`);
say(`    chemistry      ${tally("chemistry")}` + (all("chemistry") ? "" : "   NOT SEEN"));
say(`    cooling        ${tally("cooling")}` + (all("cooling") ? "" : "   NOT SEEN"));
say(`    the gradient   ${tally("gradient")}` + (all("gradient") ? "" : "   NOT SEEN"));
console.log();

const meanRadiatedPct = runs.reduce(
  (a, r) => a + (r.budget ? (r.last.radiated / r.budget) * 100 : 0), 0) / runs.length;

if (!all("chemistry")) {
  say(`  NOTHING BONDED. With gravity gone, law 2 is the only source of energy this world`);
  say(`  has, so a run with no chemistry has nothing to cool and nothing to show. Either`);
  say(`  the fill is too low for pairs to meet, or --temp0 is at or above the deepest`);
  say(`  possible bond (${SETTLED.BOND_MODULUS}) and no bond can survive being formed.`);
} else if (!all("cooling")) {
  say(`  IT BONDED AND IT DID NOT COOL (${tally("cooling")}). The edge is the only sink, and a`);
  say(`  sink on the perimeter drains an area that grows faster than it does. Either the`);
  say(`  sheet is too big for ${OPT.ticks} ticks -- light crosses one hexagon a tick, so a`);
  say(`  quantum born in the middle of a ${OPT.size}-wide world needs ${Math.round(OPT.size / 2)} ticks just to`);
  say(`  reach the edge -- or it is being reabsorbed before it gets there. Try --size 96,`);
  say(`  or many more --ticks.`);
} else if (!all("gradient")) {
  say(`  IT COOLED EVENLY: ${meanRadiatedPct.toFixed(2)}% of the world's energy left through the edge and`);
  say(`  the skin is no cooler than the core (${tally("gradient")}). That is the honest answer to`);
  say(`  the prediction this engine was rebuilt on, and it means transport is fast enough`);
  say(`  at this size to even the sheet out between radiating events. A gradient should`);
  say(`  appear as the sheet gets wider -- the same run at a larger --size is the test.`);
} else {
  say(`  CHEMISTRY, COOLING, AND A COOL SKIN OVER A HOT CORE, on every seed. That is the`);
  say(`  shape the edge was built to produce: ${meanRadiatedPct.toFixed(2)}% of the world's energy has left`);
  say(`  through the perimeter and the interior has not caught up. It is a gradient in a`);
  say(`  made-up physics and not a photosphere, and the next question is whether it`);
  say(`  steepens with size -- the same run at a larger --size is the test (rule 11).`);
}

if (OPT.json) {
  mkdirSync(dirname(OPT.json), { recursive: true });
  writeFileSync(OPT.json, JSON.stringify({
    kind: "world-run/3",
    written: new Date().toISOString(),
    warning: "A bounded sheet with no gravity and no expansion, as of 2026-11-08. "
      + "CANDIDATE_ZERO is the plumbing test point, not a chosen physics, so no number "
      + "here is a finding (rule 11).",
    options: OPT,
    thresholds: { BONDED_FLOOR, COOL_FRACTION, GRADIENT_RATIO },
    constants: CANDIDATE_ZERO,
    verdict: lines,
    seeds: runs.map((r) => ({
      seed: r.seed, ticks: r.ticks, saw: r.saw,
      energy0: r.energy0, releasedByLaw2: r.released, energyBudget: r.budget,
      counts: r.counts, census: r.census, matterCells: r.matterCells,
      history: r.history,
    })),
  }, null, 2));
  console.log(`\n  wrote ${OPT.json}`);
}
