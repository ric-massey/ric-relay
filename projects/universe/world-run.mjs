// world-run.mjs -- run the World and print what it did, era by era.
//
// This exists because gravity's strength is a DIAL and not a measurement yet.
// README item 20 put gravity's floor above its ceiling at 4096 squared, under
// a physics that stopped existing on 2026-11-06, and nobody has re-measured
// it. Ric's call, 2026-11-07: run it, look at the three eras, move the dial,
// run it again.
//
// So the job of this file is to make the three eras in TWO-RUNS.md's "what one
// run would actually be like" legible enough to judge:
//
//   1. COLLAPSE      matter gathers. Watch the density contrast rise.
//   2. THE HOT ERA   falling turns into heat; no bond survives. Watch mean
//                    temperature rise and the bonded fraction stay near zero.
//   3. RECOMBINATION radiation carries the heat off, it cools, clusters start
//                    to stand. Watch the bonded fraction rise.
//
// A run that shows none of them is telling you about the dial, which is the
// point. The readings below are deliberately crude -- they are for steering,
// not for a result, and nothing in this file should ever be quoted as a
// finding.
//
// FOUR THINGS CHANGED HERE ON 2026-11-07, all of them because the first runs
// were unreadable rather than because the engine was:
//
//   the collapse statistic   was the MAXIMUM of a hexagon's neighbourhood
//                            count, an integer that cannot exceed 7, over a
//                            one-in-seven sample. It read 7 within a hundred
//                            ticks at fill 0.30 by chance alone and 6 for
//                            1500 ticks at fill 0.08. It is now the density
//                            contrast against a random spread: 1.0 means
//                            spread at random, and it has no ceiling.
//   the initial state        the World was seeded at absolute zero, so every
//                            adjacent pair bonded before gravity moved
//                            anything. --temp0 and --p0 make being hot an
//                            initial condition rather than a hope.
//   gravity's payout         is printed. gravityPotential is a counter with no
//                            floor, so the books close however much energy
//                            gravity hands out; the first runs paid 558,000
//                            units into matter that took 19,389 steps.
//                            --gcap stops a run that goes past a typed limit.
//   seeds                    three by default. One seed was never a finding
//                            (rule 11) and the verdict now only speaks when
//                            the seeds agree.
//
// Every run is written out. A run that is not on disk cannot be compared with
// the next one, and the first runs were not.
//
// Usage:
//   node world-run.mjs                                a first look, 3 seeds
//   node world-run.mjs --seeds 1                      one seed, quick
//   node world-run.mjs --ticks 400 --eps 1e-6         turn gravity up
//   node world-run.mjs --eps 0                        gravity off, the control
//   node world-run.mjs --temp0 9 --p0 6               start hot and moving
//   node world-run.mjs --size 384 --grow 50 --max 600000   let it expand
//   node world-run.mjs --gcap 500000                  stop if gravity pumps
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

// The era tests' thresholds. Named because they are instrument settings and
// not physics (rule 8): they say how big a change this file is willing to
// call an era, and nothing in the laws depends on them.
const COLLAPSE_RISE = 1.10;      // contrast must reach 1.10x its first sample
const HOT_RISE = 1.5;            // and temperature 1.5x its first, plus
const HOT_FLOOR = 0.05;          // a floor, so 0.00 -> 0.01 is not an era

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const OPT = {
  size:   num("size", 258),
  ticks:  num("ticks", 300),
  seeds:  String(flag("seeds", flag("seed", "1,2,3"))).split(",").map(Number),
  fill:   num("fill", 0.30),
  temp0:  num("temp0", 0),           // energy per unit of kind, at tick 0
  p0:     num("p0", 0),              // momentum components drawn in +-p0
  sample: num("sample", 10),
  check:  num("check", 50),
  grow:   num("grow", 0),            // ticks between growth events; 0 = static
  drain:  num("drain", 0.02),
  max:    num("max", 400000),        // cell cap -- "stops at the hardware"
  eps:    num("eps", 2e-7),          // GRAVITY: the dial
  screen: num("screen", 0.25),       // screening length m, so range is 1/m
  relax:  num("relax", 2),           // relaxation sweeps per tick
  gcap:   num("gcap", 0),            // stop if gravity pays out more than this
  json:   has("no-json") ? null : flag("json", `runs/world-${stamp}.json`),
};

if (OPT.seeds.some((s) => !Number.isFinite(s))) {
  throw new Error(`--seeds wants numbers, got "${flag("seeds", flag("seed", ""))}"`);
}

const gravity = OPT.eps > 0
  ? { eps: OPT.eps, screen: OPT.screen, relax: OPT.relax, cap: OPT.gcap }
  : null;

console.log(`World ${OPT.size}x${OPT.size}, seed${OPT.seeds.length > 1 ? "s" : ""} `
  + `${OPT.seeds.join(", ")}, fill ${OPT.fill}, ${OPT.ticks} ticks`);
console.log(gravity
  ? `  gravity ON   eps ${OPT.eps}  screen ${OPT.screen} (range ~${(1 / OPT.screen).toFixed(1)} hexagons)  relax ${OPT.relax}`
  : `  gravity OFF  -- the control. Nothing here creates momentum, so nothing will move.`);
console.log(OPT.temp0 || OPT.p0
  ? `  start    temperature ${OPT.temp0} (bonds need B > temperature, and B is at most `
    + `${SETTLED.BOND_MODULUS}), momentum +-${OPT.p0}, net zero`
  : `  start    absolute zero: no heat, no momentum. Every pair that can bond will, at once.`);
console.log(`  constants: CANDIDATE_ZERO, the plumbing test point. Not a chosen physics.`);
if (OPT.grow) console.log(`  growing: 3 lines every ${OPT.grow} ticks, drain ${OPT.drain}, cap ${OPT.max} cells`);
if (gravity && OPT.gcap) console.log(`  gravity cap: the run stops if gravity pays out more than ${OPT.gcap.toLocaleString()} units`);

const HEAD = "  tick     cells   matter   meanT    bonds  bonded%  contrast  maxDens   kinetic    gravPaid   flight   expLoss";
const RULE = "  ----     -----   ------   -----    -----  -------  --------  -------   -------    --------   ------   -------";
const show = (r) => console.log(
  `  ${String(r.tick).padStart(4)}  ${String(r.cells).padStart(8)} `
  + `${String(r.matterCells).padStart(8)} ${r.meanTemp.toFixed(2).padStart(7)} `
  + `${String(r.bonds).padStart(8)} ${(r.bondedFraction * 100).toFixed(1).padStart(7)} `
  + `${r.densityContrast.toFixed(3).padStart(9)} ${String(r.maxLocalDensity).padStart(7)} `
  + `${String(r.kinetic).padStart(9)} ${String(r.gravityPaid).padStart(11)} `
  + `${String(r.inFlight).padStart(8)} ${String(r.expansionLoss).padStart(9)}`);

// --------------------------------------------------------------- one seed
// The three tests are computed ONCE per seed and both the era lines and the
// verdict read them. An earlier version tested them twice with different
// thresholds and printed "the shape the chronology is supposed to have"
// directly under two lines saying NOT SEEN.
function runOne(seed) {
  const world = new World({
    cols: OPT.size, rows: OPT.size, seed,
    constants: CANDIDATE_ZERO, gravity,
  });
  world.seed_(OPT.fill, (rng) => 1 + rng.below(255),
              { temp0: OPT.temp0, momentumRange: OPT.p0 });

  const started = Date.now();
  console.log(`\n=== seed ${seed} ===`);
  console.log(HEAD);
  console.log(RULE);
  world.sample();
  show(world.history[0]);

  const out = world.run(OPT.ticks, {
    sampleEvery: OPT.sample,
    checkEvery: OPT.check,
    growEvery: OPT.grow,
    growthDrain: OPT.drain,
    maxCells: OPT.max,
    onSample: show,
  });

  const elapsed = Date.now() - started;
  console.log();
  console.log(`  ${out.ticks} ticks in ${(elapsed / 1000).toFixed(1)} s `
    + `(${(out.ticks / (elapsed / 1000)).toFixed(1)} ticks/s, ${out.cells.toLocaleString()} cells)`);
  console.log(`  the books closed at every check -- energy, matter and momentum`);
  if (out.stopped) console.log(`  STOPPED EARLY: ${out.stopped}`);

  const h = world.history;
  const first = h[0], last = h[h.length - 1];
  const peak = (f) => h.reduce((a, b) => (f(b) > f(a) ? b : a), h[0]);
  const densePeak = peak((r) => r.densityContrast);
  const hotPeak = peak((r) => r.meanTemp);
  const bondPeak = peak((r) => r.bondedFraction);

  // A HOT START IS NOT A FAILED HOT ERA. The test for the hot era is that the
  // temperature ROSE, which is the right test for a world that began at
  // absolute zero and the wrong one for a world handed its heat at tick 0:
  // the first --temp0 9 run printed "the hot era NOT SEEN" about a world in
  // which no bond could form because it was too hot. So a temperature at or
  // above the deepest possible bond satisfies the era by construction, and
  // the line says which of the two it was.
  const hotGiven = OPT.temp0 >= SETTLED.BOND_MODULUS;
  const saw = {
    collapse: densePeak.densityContrast > first.densityContrast * COLLAPSE_RISE,
    hot: hotGiven || hotPeak.meanTemp > first.meanTemp * HOT_RISE + HOT_FLOOR,
    hotGiven,
    recombination: bondPeak.bondedFraction > first.bondedFraction && bondPeak.tick > hotPeak.tick,
    stillHeating: !hotGiven && hotPeak.tick === last.tick,
  };

  console.log();
  console.log(`  the eras, this seed:`);
  console.log(`    collapse       contrast ${first.densityContrast.toFixed(3)} -> `
    + `${densePeak.densityContrast.toFixed(3)} at tick ${densePeak.tick}`
    + (saw.collapse ? "" : "   NOT SEEN"));
  console.log(`    the hot era    mean temperature ${first.meanTemp.toFixed(2)} -> `
    + `${hotPeak.meanTemp.toFixed(2)} at tick ${hotPeak.tick}`
    + (saw.hotGiven ? `   GIVEN AT TICK 0 by --temp0 ${OPT.temp0}, not earned by collapse`
                    : saw.hot ? "" : "   NOT SEEN"));
  console.log(`    recombination  bonded ${(first.bondedFraction * 100).toFixed(1)}% -> `
    + `${(bondPeak.bondedFraction * 100).toFixed(1)}% at tick ${bondPeak.tick}, `
    + `${(last.bondedFraction * 100).toFixed(1)}% at the end`
    + (saw.recombination ? "" : "   NOT AFTER A HOT ERA"));

  // GRAVITY'S OWN BOOKS, printed whether or not anything else happened. The
  // counter has no floor, so this is the only place a run says how much
  // energy gravity created -- and the pump test is the comparison the first
  // runs could not make: paid out against whether the matter actually
  // gathered. Work without displacement is what real gravity cannot do.
  if (gravity) {
    const paid = last.gravityPaid;
    const pump = paid > 0 && !saw.collapse;
    console.log(`    gravity paid   ${paid.toLocaleString()} units of kinetic energy, `
      + `field binding ${first.fieldBinding.toExponential(2)} -> ${last.fieldBinding.toExponential(2)}`);
    if (pump) {
      console.log(`                   PUMP: it paid that out and the matter is no more gathered `
        + `than at the start.`);
    }
  }

  console.log(`    motion         ${world.counts.stepped.toLocaleString()} steps, of which `
    + `${world.counts.bondedStepped.toLocaleString()} by bonded matter; `
    + `${world.counts.blocked.toLocaleString()} blocked, `
    + `${world.counts.bondsStretched.toLocaleString()} refused by a bond`);
  console.log(`    the push       ${world.counts.pushedAlongBond.toLocaleString()} along a bond, `
    + `${world.counts.pushRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.pushUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.pushNoRoom.toLocaleString()} no room for the heat`);
  console.log(`    bonds          ${world.counts.bondsFormed.toLocaleString()} formed, `
    + `${world.counts.bondsBroken.toLocaleString()} broken`);
  console.log(`    shared         ${world.counts.momentumShared.toLocaleString()} momentum hops along bonds, `
    + `${world.counts.shareUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.shareRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.shareNoRoom.toLocaleString()} no room`);
  console.log(`    kicks          ${world.counts.thermalKicks.toLocaleString()} heat-to-motion kicks, `
    + `${world.counts.kickUnaffordable.toLocaleString()} too cold, `
    + `${world.counts.kickNoPartner.toLocaleString()} no partner, `
    + `${world.counts.kickRangeDeclined.toLocaleString()} at law 1 range, `
    + `${world.counts.kickNoRoom.toLocaleString()} no room`);
  console.log(`    gravity        ${world.counts.gravityCarries.toLocaleString()} pulls carried a whole unit, `
    + `${world.counts.gravityDeclined.toLocaleString()} declined`);
  console.log(`    light          ${world.counts.emitted.toLocaleString()} emitted, `
    + `${world.counts.absorbed.toLocaleString()} absorbed, `
    + `${world.counts.quantaMoved.toLocaleString()} moved`);
  if (OPT.grow) {
    console.log(`    growth         ${world.counts.grew} lines added, `
      + `${world.counts.growthBlocked} refused because a bond crossed every cut`);
  }

  return {
    seed, saw, first, last, densePeak, hotPeak, bondPeak,
    stopped: out.stopped,
    ticks: out.ticks,
    counts: world.counts,
    census: census(world.w),
    matterCells: countMatter(world.w),
    history: h,
  };
}

const runs = OPT.seeds.map(runOne);

// ------------------------------------------------------- across the seeds
// RULE 11. One seed is not a finding, and the first runs of this engine were
// one seed each. An era is claimed here only if every seed showed it; a split
// is reported as a split, because a split IS the reading.
const agree = (k) => runs.filter((r) => r.saw[k]).length;
const all = (k) => agree(k) === runs.length;
const tally = (k) => `${agree(k)} of ${runs.length} seeds`;

const lines = [];
const say = (s) => { lines.push(s); console.log(s); };

console.log();
say(`THE ERAS, across ${runs.length} seed${runs.length > 1 ? "s" : ""}:`);
say(`    collapse       ${tally("collapse")}` + (all("collapse") ? "" : "   NOT SEEN"));
say(`    the hot era    ${tally("hot")}` + (all("hot") ? "" : "   NOT SEEN"));
say(`    recombination  ${tally("recombination")}` + (all("recombination") ? "" : "   NOT AFTER A HOT ERA"));
console.log();

if (!gravity) {
  say(`  Gravity is off, so there is no collapse and no hot era by construction.`);
  say(`  This run is the control: whatever it shows is what the OTHER four laws do.`);
} else if (runs.some((r) => r.stopped)) {
  say(`  A SEED STOPPED EARLY AT THE GRAVITY CAP, so this is not a run, it is a fuse`);
  say(`  blowing. Nothing about the eras can be read off it. Either the dial is far too`);
  say(`  high for ${OPT.ticks} ticks, or gravity is pumping -- compare the paid-out figure`);
  say(`  with whether the contrast moved at all.`);
} else if (agree("collapse") && !all("collapse")) {
  say(`  THE SEEDS DISAGREE ABOUT COLLAPSE (${tally("collapse")}), which at this dial means the`);
  say(`  contrast is moving about as much as the draw does. More ticks or a stronger dial`);
  say(`  before anything is read off it.`);
} else if (runs.every((r) => r.saw.hotGiven)) {
  // A HOT START GETS ITS OWN READING, and it has to come before the branches
  // that reason about the order of the eras, because half the order was typed
  // on the command line. The first version of this chain put it last, so a
  // hot run with no recombination printed "the three eras happened in the
  // wrong order", about a world that had been handed its hot era.
  say(`  THE HOT ERA WAS GIVEN AND NOT EARNED: --temp0 ${OPT.temp0} put the world above every`);
  say(`  possible bond at tick 0. So this run can say whether matter gathers while nothing`);
  say(`  can stand -- collapse ${tally("collapse")} -- and it can say nothing at all about`);
  say(`  collapse PRODUCING the heat, which is the half README item 20 is about.`);
  if (all("recombination")) {
    say(`  Bonds did appear later (${tally("recombination")}), and they are NOT evidence that the world`);
    say(`  cooled: a bond needs its own primitive below B, and B is at most ${SETTLED.BOND_MODULUS}, so every`);
    say(`  bond here formed in the cold TAIL of the distribution while the mean stayed hot.`);
  } else {
    say(`  No bonds came later either, so nothing recombined (${tally("recombination")}).`);
  }
  say(`  Read the meanT column for cooling, and expansionLoss for where any of it went:`);
  say(`  that drain is the only sink in this engine (README item 36).`);
} else if (!all("hot") && runs.every((r) => r.last.bondedFraction > 0.2) && !all("collapse")) {
  say(`  THE CHRONOLOGY IS INVERTED: the world bonded before it ever collapsed.`);
  say(`  Every pair that can bond does so at the temperature it was seeded at, and a bond`);
  say(`  holds against a step along it, so matter stiffens before gravity can gather it.`);
  say(`  Chemistry is winning the race against gravity. Either gravity is far too weak --`);
  say(`  try --eps ${(OPT.eps * 100).toExponential(0)} -- or the world has to START hot enough that nothing stands,`);
  say(`  which is what --temp0 ${SETTLED.BOND_MODULUS} is for. This is a finding about the dial and the`);
  say(`  initial state, not about the engine.`);
} else if (!all("hot")) {
  say(`  Nothing heated. Either eps is below gravity's floor -- collapse never melts a`);
  say(`  bond, which is the failure README item 20 names -- or the screening length is`);
  say(`  short enough that nothing reaches anything. Try --eps ${(OPT.eps * 10).toExponential(0)} or --screen ${(OPT.screen / 2).toFixed(2)}.`);
} else if (runs.every((r) => r.last.bondedFraction < r.first.bondedFraction)) {
  say(`  It heated and stayed hot: bonds are being broken faster than they form. That is`);
  say(`  gravity above its ceiling, or simply not enough ticks for radiation to carry the`);
  say(`  heat off. Try --eps ${(OPT.eps / 10).toExponential(0)} or more --ticks.`);
} else if (runs.every((r) => r.saw.stillHeating)) {
  // The hot era peaked on the LAST sample, so the world is still heating when
  // the run stops. Nothing can be said about recombination yet -- a bonded
  // fraction that rose while the temperature was still climbing is not
  // recombination, it is bonding that the heat has not caught up with.
  say(`  COLLAPSE AND HEATING, BUT EVERY SEED STOPS WHILE STILL HEATING. The hot era`);
  say(`  peaked on the last sample, so radiation has not had time to carry the heat off`);
  say(`  and recombination cannot be judged from this run at all. A bonded fraction that`);
  say(`  rose DURING the heating is not recombination.`);
  say(`  Run it longer -- and note that in a world that is not growing there is nowhere`);
  say(`  for the heat to go: the only sink in this engine is the expansion drain, so`);
  say(`  --grow is what makes a turnover possible at all.`);
} else if (!all("recombination")) {
  say(`  Collapse and a hot era, but the bonds did not come after the heat (${tally("recombination")}).`);
  say(`  So the three eras happened in the wrong order, which is a finding about the dial`);
  say(`  and not about the engine.`);
} else {
  say(`  Collapse, heat and then bonds, on every seed -- the shape the chronology is`);
  say(`  supposed to have. Worth more seeds and a written-down dial before believing it`);
  say(`  (rule 11), and the contrast figure is the thing to quote, not the maximum.`);
}

if (OPT.json) {
  mkdirSync(dirname(OPT.json), { recursive: true });
  writeFileSync(OPT.json, JSON.stringify({
    kind: "world-run/2",
    written: new Date().toISOString(),
    warning: "Gravity's strength here is a DIAL, not a measured constant. README item 20's "
      + "floor-above-ceiling finding predates the 2026-11-06 physics and has not been redone. "
      + "Nothing in this file is a result.",
    options: OPT,
    gravity,
    thresholds: { COLLAPSE_RISE, HOT_RISE, HOT_FLOOR },
    constants: CANDIDATE_ZERO,
    verdict: lines,
    seeds: runs.map((r) => ({
      seed: r.seed, ticks: r.ticks, saw: r.saw, stopped: r.stopped,
      counts: r.counts, census: r.census, matterCells: r.matterCells,
      history: r.history,
    })),
  }, null, 2));
  console.log(`\n  wrote ${OPT.json}`);
}
