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
//   1. COLLAPSE      matter gathers. Watch max local density rise.
//   2. THE HOT ERA   falling turns into heat; no bond survives. Watch mean
//                    temperature rise and the bonded fraction stay near zero.
//   3. RECOMBINATION radiation carries the heat off, it cools, clusters start
//                    to stand. Watch the bonded fraction rise.
//
// A run that shows none of them is telling you about the dial, which is the
// point. The four readings below are deliberately crude -- they are for
// steering, not for a result, and nothing in this file should ever be quoted
// as a finding.
//
// Usage:
//   node world-run.mjs                                a first look
//   node world-run.mjs --ticks 400 --eps 1e-6         turn gravity up
//   node world-run.mjs --eps 0                        gravity off, the control
//   node world-run.mjs --size 384 --grow 50 --max 600000   let it expand
//   node world-run.mjs --json runs/world-current.json      write it out

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { World, census, countMatter } from "./world.mjs";
import { CANDIDATE_ZERO } from "./constants.mjs";

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const num = (n, d) => { const v = flag(n, null); return v === null ? d : Number(v); };

const OPT = {
  size:   num("size", 258),
  ticks:  num("ticks", 300),
  seed:   num("seed", 1),
  fill:   num("fill", 0.30),
  sample: num("sample", 10),
  check:  num("check", 50),
  grow:   num("grow", 0),            // ticks between growth events; 0 = static
  drain:  num("drain", 0.02),
  max:    num("max", 400000),        // cell cap -- "stops at the hardware"
  eps:    num("eps", 2e-7),          // GRAVITY: the dial
  screen: num("screen", 0.25),       // screening length m, so range is 1/m
  relax:  num("relax", 2),           // relaxation sweeps per tick
  json:   flag("json", null),
};

const gravity = OPT.eps > 0 ? { eps: OPT.eps, screen: OPT.screen, relax: OPT.relax } : null;

console.log(`World ${OPT.size}x${OPT.size}, seed ${OPT.seed}, fill ${OPT.fill}, ${OPT.ticks} ticks`);
console.log(gravity
  ? `  gravity ON   eps ${OPT.eps}  screen ${OPT.screen} (range ~${(1 / OPT.screen).toFixed(1)} hexagons)  relax ${OPT.relax}`
  : `  gravity OFF  -- the control. Nothing here creates momentum, so nothing will move.`);
console.log(`  constants: CANDIDATE_ZERO, the plumbing test point. Not a chosen physics.`);
if (OPT.grow) console.log(`  growing: 3 lines every ${OPT.grow} ticks, drain ${OPT.drain}, cap ${OPT.max} cells`);
console.log();

const world = new World({
  cols: OPT.size, rows: OPT.size, seed: OPT.seed,
  constants: CANDIDATE_ZERO, gravity,
});
world.seed_(OPT.fill, (rng) => 1 + rng.below(255));

const started = Date.now();
console.log("  tick     cells   matter   meanT    bonds  bonded%  maxDens   kinetic   flight   expLoss");
console.log("  ----     -----   ------   -----    -----  -------  -------   -------   ------   -------");
const show = (r) => console.log(
  `  ${String(r.tick).padStart(4)}  ${String(r.cells).padStart(8)} `
  + `${String(r.matterCells).padStart(8)} ${r.meanTemp.toFixed(2).padStart(7)} `
  + `${String(r.bonds).padStart(8)} ${(r.bondedFraction * 100).toFixed(1).padStart(7)} `
  + `${String(r.maxLocalDensity).padStart(8)} ${String(r.kinetic).padStart(9)} `
  + `${String(r.inFlight).padStart(8)} ${String(r.expansionLoss).padStart(9)}`);

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

// ----------------------------------------------------------------- the eras
// Crude on purpose. Each is the weakest statement the numbers support, and
// each says "not seen" rather than guessing when it is not there.
const h = world.history;
const first = h[0], last = h[h.length - 1];
const peak = (f) => h.reduce((a, b) => (f(b) > f(a) ? b : a), h[0]);

const densePeak = peak((r) => r.maxLocalDensity);
const hotPeak = peak((r) => r.meanTemp);
const bondPeak = peak((r) => r.bondedFraction);

// The three tests are computed ONCE and both the era lines and the verdict
// read them. An earlier version tested them twice with different thresholds
// and printed "the shape the chronology is supposed to have" directly under
// two lines saying NOT SEEN.
const saw = {
  collapse: densePeak.maxLocalDensity > first.maxLocalDensity,
  hot: hotPeak.meanTemp > first.meanTemp * 1.5 + 0.05,
  recombination: bondPeak.bondedFraction > first.bondedFraction && bondPeak.tick > hotPeak.tick,
};

console.log();
console.log("  THE ERAS, read off the history above:");
console.log(`    collapse       max local density ${first.maxLocalDensity} -> ${densePeak.maxLocalDensity} `
  + `at tick ${densePeak.tick}` + (saw.collapse ? "" : "   NOT SEEN"));
console.log(`    the hot era    mean temperature ${first.meanTemp.toFixed(2)} -> `
  + `${hotPeak.meanTemp.toFixed(2)} at tick ${hotPeak.tick}`
  + (saw.hot ? "" : "   NOT SEEN -- nothing heated the world"));
console.log(`    recombination  bonded ${(first.bondedFraction * 100).toFixed(1)}% -> `
  + `${(bondPeak.bondedFraction * 100).toFixed(1)}% at tick ${bondPeak.tick}, `
  + `${(last.bondedFraction * 100).toFixed(1)}% at the end`
  + (saw.recombination ? "" : "   NOT AFTER A HOT ERA"));

console.log();
if (!gravity) {
  console.log("  Gravity is off, so there is no collapse and no hot era by construction.");
  console.log("  This run is the control: whatever it shows is what the OTHER four laws do.");
} else if (!saw.hot && last.bondedFraction > 0.2 && !saw.collapse) {
  console.log(`  THE CHRONOLOGY IS INVERTED: the world bonded before it ever collapsed.`);
  console.log(`  At T = 0 every pair that can bond does, and a bonded primitive does not step`);
  console.log(`  (GAP 3), so matter freezes in place before gravity can gather it. Chemistry is`);
  console.log(`  winning the race against gravity. Either gravity is far too weak to beat bond`);
  console.log(`  formation -- try --eps ${(OPT.eps * 100).toExponential(0)} -- or the world has to start hot enough that`);
  console.log(`  nothing stands, which is what the hot era IS. This is a finding about the dial.`);
} else if (!saw.hot) {
  console.log(`  Nothing heated. Either eps is below gravity's floor -- collapse never melts a`);
  console.log(`  bond, which is the failure README item 20 names -- or the screening length is`);
  console.log(`  short enough that nothing reaches anything. Try --eps ${(OPT.eps * 10).toExponential(0)} or --screen ${(OPT.screen / 2).toFixed(2)}.`);
} else if (last.bondedFraction < first.bondedFraction) {
  console.log(`  It heated and stayed hot: bonds are being broken faster than they form. That is`);
  console.log(`  gravity above its ceiling, or simply not enough ticks for radiation to carry the`);
  console.log(`  heat off. Try --eps ${(OPT.eps / 10).toExponential(0)} or more --ticks.`);
} else if (hotPeak.tick === last.tick) {
  // The hot era peaked on the LAST sample, so the world is still heating when
  // the run stops. Nothing can be said about recombination yet -- a bonded
  // fraction that rose while the temperature was still climbing is not
  // recombination, it is bonding that the heat has not caught up with. The
  // earlier version of this file printed "the shape the chronology is supposed
  // to have" here, directly under an era line reading NOT AFTER A HOT ERA. It
  // was wrong twice for the same reason: the verdict has to read `saw`.
  console.log(`  COLLAPSE AND HEATING, BUT THE RUN STOPS WHILE STILL HEATING. The hot era peaked`);
  console.log(`  on the last sample (tick ${last.tick}), so radiation has not had time to carry the`);
  console.log(`  heat off and recombination cannot be judged from this run at all. The bonded`);
  console.log(`  fraction rose, but it rose DURING the heating, which is not the same thing.`);
  console.log(`  Run it longer -- more --ticks -- and watch for the temperature to turn over.`);
} else if (!saw.recombination) {
  console.log(`  Collapse and a hot era, but the bonds did not come after the heat: the bonded`);
  console.log(`  fraction peaked at tick ${bondPeak.tick} and the temperature at tick ${hotPeak.tick}.`);
  console.log(`  So the three eras happened in the wrong order, which is a finding about the dial`);
  console.log(`  and not about the engine.`);
} else {
  console.log(`  Collapse, heat and then bonds -- the shape the chronology is supposed to have.`);
  console.log(`  Worth a second seed before believing it (rule 11).`);
}
console.log();
console.log(`  gravity: ${world.counts.gravityCarries.toLocaleString()} pulls carried a whole unit, `
  + `${world.counts.gravityDeclined.toLocaleString()} declined`);
console.log(`  motion:  ${world.counts.stepped.toLocaleString()} steps, `
  + `${world.counts.blocked.toLocaleString()} blocked, `
  + `${world.counts.bondsStretched.toLocaleString()} held by a bond`);
console.log(`  bonds:   ${world.counts.bondsFormed.toLocaleString()} formed, `
  + `${world.counts.bondsBroken.toLocaleString()} broken`);
// The two exchanges, ported 2026-11-07. Each refusal is printed separately
// because they mean different things, and a run where one dominates is the
// run telling you which ceiling it is sitting against.
console.log(`  shared:  ${world.counts.momentumShared.toLocaleString()} momentum hops along bonds, `
  + `${world.counts.shareUnaffordable.toLocaleString()} too cold, `
  + `${world.counts.shareRangeDeclined.toLocaleString()} at law 1 range, `
  + `${world.counts.shareNoRoom.toLocaleString()} no room for the heat`);
console.log(`  kicks:   ${world.counts.thermalKicks.toLocaleString()} heat-to-motion kicks, `
  + `${world.counts.kickUnaffordable.toLocaleString()} too cold, `
  + `${world.counts.kickNoPartner.toLocaleString()} no partner, `
  + `${world.counts.kickRangeDeclined.toLocaleString()} at law 1 range, `
  + `${world.counts.kickNoRoom.toLocaleString()} no room`);
console.log(`  light:   ${world.counts.emitted.toLocaleString()} emitted, `
  + `${world.counts.absorbed.toLocaleString()} absorbed, `
  + `${world.counts.quantaMoved.toLocaleString()} moved`);
if (OPT.grow) {
  console.log(`  growth:  ${world.counts.grew} lines added, `
    + `${world.counts.growthBlocked} refused because a bond crossed every cut`);
}

if (OPT.json) {
  mkdirSync(dirname(OPT.json), { recursive: true });
  writeFileSync(OPT.json, JSON.stringify({
    kind: "world-run/1",
    written: new Date().toISOString(),
    warning: "Gravity's strength here is a DIAL, not a measured constant. README item 20's "
      + "floor-above-ceiling finding predates the 2026-11-06 physics and has not been redone. "
      + "Nothing in this file is a result.",
    options: OPT,
    gravity,
    constants: CANDIDATE_ZERO,
    counts: world.counts,
    census: census(world.w),
    matterCells: countMatter(world.w),
    history: world.history,
  }, null, 2));
  console.log(`\n  wrote ${OPT.json}`);
}
