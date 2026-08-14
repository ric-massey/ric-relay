/* ══════════════════════════════════════════════════════════════════════
   The road, run for hours with nobody watching, and checked against the
   drones and the counters.

   `node test/sim.test.js` from projects/offramp.

   ── what this file is for ───────────────────────────────────────────
   `traffic.test.js` checks the POPULATION against the counters that
   produced it: how many vehicles, of what kind, wanting to go how fast.
   Every one of those numbers is an input, and it is checked the way an
   input should be — did it survive the arithmetic.

   This file checks the opposite kind of number. BEHAVIOUR.md §2 has four
   statistics that nothing in the model is ever told:

     0.37 lane changes per vehicle-km      §2, I-294 L2
     4.24 s per manoeuvre                  §2, I-294 L2
     1.2% of lorry-seconds in the left lane
     a 15 mph gradient from left lane to right

   They are properties of a motorway full of people deciding things, and
   PLAN.md §5c's whole argument is that a model which reproduces them by
   aiming at them has learned nothing:

     "a model that changes lane at 0.37 per vehicle-km at random
      reproduces every number in §2 and still looks wrong."

   So the file is in three parts and they are not the same kind of test.

     §1-§3  THE HARNESS. Hard assertions. Conservation, no two vehicles
            in one place, determinism, and the corridor actually being
            read. If these fail nothing else here means anything.
     §4     THE CALIBRATION. Two anchors the following model was fitted
            to — lane capacity against HCM, and the headway distribution
            against the drone. Hard, because they pin decisions that
            would otherwise drift.
     §5     THE SCOREBOARD. The four emergent numbers, for three
            deciders, printed against target. These are `todo`, not
            `fail`: none of them can be right until the motive layer
            exists, and a suite that is permanently red is a suite
            nobody runs. The exit code ignores them. The point of them
            is the column of numbers.
     §7     THE CRASHES. Whether the road is as safe as a real one, and
            what happens behind a wreck. Mixed: hard assertions where a
            short run can measure something, and one printed gap where
            it cannot — a US freeway does 0.62 crashes per million
            vehicle-km and the reference run covers 12,000, so the
            honest expectation is 0.007 and crash COUNT is not a thing
            this or any short run can check. What it checks instead is
            the surrogates, the machinery under stress, and the one
            behaviour the game is actually made of: a wreck in a live
            lane and the queue behind it.

   ── the four deciders ───────────────────────────────────────────────
     stay     nobody ever changes lane. The floor.
     random   a Poisson process aimed straight at 0.37/veh-km. The straw
              man PLAN.md §5c names by hand.
     mobil    the standard model of the literature. The real opponent.
     motive   `src/motive.js` — the model. Seven motives compete and the
              strongest wins, and a lane change is never sampled.

   Reading the scoreboard is the deliverable. For most of this file's
   life it said which of the four numbers the field's default model gets
   for free — those the motives must not lose — and which no amount of
   arithmetic-about-acceleration can reach. Now it says whether the
   motives reached them.
   ══════════════════════════════════════════════════════════════════════ */

global.window = {};
require("../data/traffic.js");
const T = require("../src/traffic.js");
const S = require("../src/sim.js");
const M = require("../src/motive.js");
/* Where the interchanges are. The stretch still has no ramp GEOMETRY
   on it — nothing merges, nothing leaves — but the drivers now know a
   junction is coming, which is what §5c's `yield` needs for the half
   of it that is about merging traffic. Five of them fall inside this
   six-kilometre run. */
const I40 = require("./i40.js");

let pass = 0, fail = 0, todo = 0;
const fmt = (n) => typeof n === "number"
  ? (Number.isInteger(n) ? String(n) : n.toFixed(3)) : String(n);
function ok(name, got, want, tol) {
  const good = tol === undefined ? got === want : Math.abs(got - want) <= tol;
  if (good) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${fmt(want)}${tol !== undefined ? ` ±${tol}` : ""}`); }
}
function within(name, got, lo, hi) {
  if (got >= lo && got <= hi) { pass++; console.log(`  ok   ${name}  = ${fmt(got)}  (${lo}–${hi})`); }
  else { fail++; console.log(`  FAIL ${name}  = ${fmt(got)}   want ${lo}–${hi}`); }
}
/* Measured, not yet reproduced, and known not to be. Prints the gap and
   does not fail the run — see the header. */
function target(name, got, want, unit) {
  todo++;
  const off = want ? (got - want) / want * 100 : 0;
  console.log(`  todo ${name}  = ${fmt(got)}${unit || ""}   measured ${fmt(want)}${unit || ""}`
            + `   ${off >= 0 ? "+" : ""}${off.toFixed(0)}%`);
}
const head = (s) => console.log(`\n${s}\n${"─".repeat(s.length)}`);

/* ── where ────────────────────────────────────────────────────────────
   The reference stretch is mile 1897, in Tennessee: 124 km of unbroken
   posted 70 with four lanes each way, which is the longest run on the
   corridor that is both wide enough and constant enough to stand in for
   the four-lane motorway BEHAVIOUR.md's free-flow figures were measured
   on. Everywhere else on I-40 that is this busy changes its mind about
   the speed limit inside a mile.

   THE REFERENCE FLOW is derived rather than assumed, and it is worth
   saying how. BEHAVIOUR.md never records what flow I-294 was carrying
   when the drone was up — but it records the whole time-headway
   distribution, and the mean of a headway distribution is the reciprocal
   of the flow. Integrating the published percentiles gives a mean of
   2.27 s and therefore **1,585 veh/h/lane**, which is a busy but
   free-flowing motorway and is consistent with the 62 mph it also
   reports. Every free-flow comparison below is made at that flow. */
const REF = 17037426 + 3000 / 0.179;             // mile 1897, TN, 4 lanes, 70
const REF_Q = 1585;                              // veh/h/lane, derived above
const DAY = { dow: 2, hour: 14, month: 6 };
const MOJAVE = 258033.8;                         // rural CA, 2 lanes, the 55
const KNOX = 18548767.3;                         // where the limit steps down

/* BEHAVIOUR.md §2, I-294 L2, free-flowing. */
const HW = { p5: 0.49, p15: 0.71, p50: 1.50, p85: 3.57, p95: 5.83 };
const GAP = { p5: 12.9, p15: 18.9, p50: 40.5, p85: 99, p95: 159 };
const DUR = { p15: 2.9, p50: 4.24, p85: 5.6 };
const RATE = 0.37;                               // per vehicle-km, cars
const LORRY_LEFT = 0.012;                        // share of lorry-seconds
const GRADIENT = 15;                             // mph, lane 1 to lane 4
const CAR_MPH = 62, LORRY_MPH = 57;              // medians

/* The scoreboard runs carry junction POSITIONS but nobody leaves. That
   is deliberate and it is an experimental-design choice rather than a
   convenience: the four numbers are about how traffic arranges itself
   along a stated stretch at a STATED FLOW, and a road that vehicles
   leave is not at a stated flow — it thins downstream, and with no
   on-ramps to replace them nothing can be done about it. Compensating at
   the boundary was tried and cannot work: delivering 1,585 veh/h/lane
   four kilometres in needs about 2,300 going in, which is above the
   road's own capacity, so it simply queues at the entrance.

   Exits get their own section below, where the thing being measured is
   what the exit motive does rather than what the lane-choice motives do.
   `yield`'s merge half is live in both, because it needs only to know
   that a junction is coming. */
const at = (o) => S.run(Object.assign(
  { px: REF, when: DAY, state: "TN", dir: 1, seed: 11, warmup: 500,
    junctions: I40.exits, exitShare: 0 }, o));

console.log("running… (a dozen simulated road-hours, no rendering)");
const t0 = Date.now();
const stay   = at({ q: REF_Q, hours: 0.4, decide: S.deciders.stay });
const rnd    = at({ q: REF_Q, hours: 0.4, decide: S.deciders.random(RATE) });
const mob    = at({ q: REF_Q, hours: 0.4, decide: S.deciders.mobil() });
const mot    = at({ q: REF_Q, hours: 0.4, decide: M.decide });
/* Capacity is measured with the blind spot switched off, and sim.js says
   at length why: HCM's 2,400 is defined under BASE CONDITIONS, which
   means incident-free by construction. A capacity taken on a road that
   is also crashing is a measurement of something else. */
const capRun = at({ q: 3000,  hours: 0.3, miss: 0, decide: S.deciders.mobil() });

/* ══ 1. nothing impossible happened ══════════════════════════════════
   The harness's own invariants. Two vehicles cannot be in one place;
   what goes in must come out. These have caught three faults already and
   every one of them was invisible from the numbers people look at:

     · two vehicles released into the same lane in the same tenth of a
       second, on top of each other, because the boundary checked both
       against an index built before either moved. The overlap was 21.5 m
       — the length of an articulated lorry, which is what named it.
     · two vehicles on opposite sides of the same gap both taking it in
       the same tick, for the same reason one lane in.
     · a boundary that read its entry speed off whichever vehicle
       happened to be nearest, however far away, so one slow lorry pulled
       every vehicle behind it onto the road at 49 mph and the lane never
       recovered. The whole carriageway ran 13 mph under its desired
       speed with 55 m of clear road in front of every driver.

   The third is the one to keep in mind. It broke nothing, threw nothing,
   and produced a perfectly plausible-looking motorway. */
head("Nothing impossible happened");
for (const [name, r] of [["stay", stay], ["random", rnd], ["mobil", mob],
                         ["motive", mot], ["at capacity", capRun]])
  ok(`${name}: vehicles sharing tarmac`, r.conflicts, 0);

head("What went in came out");
for (const [name, r] of [["stay", stay], ["random", rnd], ["mobil", mob], ["motive", mot]]) {
  within(`${name}: detector flow vs demand`, r.flowLane / r.demandLane, 0.90, 1.05);
  ok(`${name}: ...and the queue upstream stayed small`, r.queueMax < 400, true);
}
/* The population that arrives must be the population traffic.js drew.
   `mix` is checked against the counters in traffic.test.js; this checks
   that nothing in the sim eats lorries. */
const want = T.mix(REF, DAY);
ok("the mix at the detector is the counted mix, artics", mob.mix.artic, want.artic, 0.02);
ok("...and cars", mob.mix.car, want.car, 0.03);

/* Ordinary driving is inside ±1.1 m/s², measured over both classes and
   both datasets — BEHAVIOUR.md §2, which also warns that the tails of
   that measurement are the instrument's clamp and not the drivers. So
   this is a check on the middle, which is all the evidence supports. */
head("Ordinary driving is a tenth of gravity");
within("5th percentile acceleration, m/s²", mob.acc.p5, -1.1, -0.05);
within("95th percentile acceleration, m/s²", mob.acc.p95, 0.05, 1.1);

/* ══ 2. the same seed is the same road ═══════════════════════════════ */
head("The same seed is the same road");
const a = at({ q: 900, hours: 0.1, seed: 4242, decide: S.deciders.mobil() });
const b = at({ q: 900, hours: 0.1, seed: 4242, decide: S.deciders.mobil() });
const c = at({ q: 900, hours: 0.1, seed: 4243, decide: S.deciders.mobil() });
ok("twice with one seed, the same run",
   JSON.stringify(a.changes) === JSON.stringify(b.changes), true);
ok("a different seed, a different run",
   JSON.stringify(a.changes) !== JSON.stringify(c.changes), true);

/* ══ 3. the corridor is under it ═════════════════════════════════════
   The sim is not a stretch of generic motorway with parameters. Every
   vehicle reads the posted limit at the pixel it is standing on, every
   tick, and so does what it wants to be doing.

   This was found rather than written. The first speed profiles had a
   clean step down at 3,400 m that looked exactly like a harness artifact
   and was chased as one — it is Knoxville dropping from a posted 70 to a
   posted 60. */
head("The corridor is under it");
const knoxWho = [];
const knoxMobil = S.deciders.mobil();
S.run({ px: KNOX, when: DAY, state: "TN", dir: 1, seed: 3, q: 900,
        hours: 0.15, warmup: 500, length: 6000, zone: [200, 6000],
        decide: (v, view, c) => { knoxWho.push([v.s, v.v]); return knoxMobil(v, view, c); } });
const half = (from, to) => {
  let sum = 0, n = 0;
  for (const [s, v] of knoxWho) if (s >= from && s < to) { sum += v; n++; }
  return n ? sum / n / S.MPH : NaN;
};
ok("the posted limit really does step down here",
   T.profile("speed", KNOX) - T.profile("speed", KNOX + 4000 / 0.179), 5);
within("mph before the step (posted 70)", half(1000, 3000), 55, 72);
within("mph after it (posted 60)", half(4000, 6000), 48, 64);
ok("the traffic slowed down because the sign did", half(1000, 3000) - half(4000, 6000) > 2, true);

/* ══ 4. the two things the following model was fitted to ═════════════
   Both of these are CALIBRATION and are labelled as such. They exist so
   that the decisions behind them cannot drift silently, not because
   passing them is evidence of anything.

   ── the first anchor: capacity ──────────────────────────────────────
   Drive the demand well past what the road can take and see what it
   passes. The Highway Capacity Manual puts a basic freeway lane at 2,400
   passenger cars an hour, and converts heavy vehicles at about 2 cars
   each on level terrain — so at this stretch's 29% lorries and coaches,

     2400 / (1 + 0.29 x (2 - 1)) = 1,860 veh/h/lane

   which is an entirely independent number from anything in BEHAVIOUR.md.

   The model comes in about 15% under it and that is expected rather than
   excused. HCM's 2,400 is base conditions, and base conditions include a
   driver population far more uniform than this one: `traffic.js` draws a
   desired speed whose fifth percentile is 54 mph on a posted 70, off
   I-40's own counters, and a 30 mph spread costs capacity in any
   car-following model — the slow vehicle leaves a void behind it that
   only lane changing partly fills. So the assertion is that capacity is
   a plausible motorway capacity, and the HCM figure is printed beside it
   rather than fitted to. */
head("The road carries about what a motorway lane carries");
const heavy = want.artic + want.rigid;
within("heavy vehicle share here", heavy, 0.05, 0.40);
const hcm = 2400 / (1 + heavy * 1.0);
within(`lane capacity, veh/h (HCM base conditions: ${Math.round(hcm)})`,
       capRun.flowLane, 1700, 2300);
ok("...and it is a ceiling, so the demand queued", capRun.queueMax > 500, true);
console.log(`       ${(capRun.flowLane / hcm * 100).toFixed(0)}% of HCM, on a population whose`
          + ` p5 desired speed is ${(T.desiredSpeed("car", REF, DAY, "TN", 0.05, 0.5) / S.MPH).toFixed(0)} mph`
          + ` in a posted ${T.profile("speed", REF)}`);

/* ── the second anchor: the following distance itself ────────────────
   Run at the flow the drone was flown at and the gaps have to come out
   the shape the drone measured. This is what T_SCALE was actually set
   against, and the reason it exists at all is in sim.js: the measured
   headway distribution is what the gaps ARE, and a driver five seconds
   behind the vehicle in front is not a driver who wants five seconds.
   Feeding the observed distribution in as a desired following time put
   the model's lane capacity at 1,300 and Knoxville at 45 mph.

   The lower half is the calibration. The upper half is not — p85 and p95
   are mostly drivers with nobody in front of them, so they are a
   property of the arrival process and of how well the traffic has sorted
   itself, and they belong on the scoreboard rather than here. */
head("At the flow the drone was flown at, the gaps are the drone's gaps");
within("realised flow, veh/h/lane", mob.flowLane, REF_Q * 0.9, REF_Q * 1.05);
ok("headway p5, seconds", mob.hw.p5, HW.p5, 0.12);
ok("headway p15", mob.hw.p15, HW.p15, 0.12);
ok("headway p50", mob.hw.p50, HW.p50, 0.25);
within("space gap p50, metres", mob.sp.p50, GAP.p50 * 0.8, GAP.p50 * 1.25);
ok(`pairs measured (the drone had ${(114781).toLocaleString("en-GB")})`,
   mob.hw.n > 20000, true);

/* ── and the manoeuvre, which is calibration too, and it should not be ─
   Duration is not drawn: it falls out of a lateral acceleration through
   T = sqrt(2.pi.W / a), which is what a lane change is. But the
   distribution of that acceleration was fitted to the measured duration,
   so this is a round trip and not a prediction. sim.js says why: the
   attempt to derive it from the `push` temperament alone needs half a
   gravity sideways at the aggressive end, which is not a lane change. */
head("Four and a quarter seconds to change lane");
ok("median manoeuvre, seconds", mob.dur.p50, DUR.p50, 0.4);
ok("p15 — the quick ones", mob.dur.p15, DUR.p15, 0.4);
ok("p85 — the dawdlers", mob.dur.p85, DUR.p85, 0.5);
ok("...and the same shape under a different decider",
   Math.abs(rnd.dur.p50 - mob.dur.p50) < 0.3, true);

/* Half of all lane changes are made with no indicator — MEASURED and
   cited, BEHAVIOUR.md §3. traffic.js draws the habit; this checks the
   trace carries it, because the courtesy loop in PLAN.md §5c depends on
   other vehicles being able to read it. */
head("Half of them do not indicate");
ok("share of manoeuvres with any signal at all", mob.signalled, 0.52, 0.03);
ok("every change in the trace says which motive won",
   mob.changes.every((c) => c.why != null), true);
ok("...and where, and how fast, and which way",
   mob.changes.every((c) => c.s > 0 && c.v > 0 && (c.dir === "left" || c.dir === "right")), true);

/* ══ 5. THE SCOREBOARD ═══════════════════════════════════════════════
   Everything above is the apparatus working. This is the measurement.

   Four numbers, measured off 2024 drone video of a four-lane motorway
   running free, and not one of them is an input to anything. Three
   deciders, none of which is the model. Read down the columns. */
head("═══ THE SCOREBOARD ═══");
console.log(`  Measured on I-294 L2, free-flowing, at ${REF_Q} veh/h/lane.`);
console.log("  None of these four is an input to any of the four deciders.\n");

const runs = [["stay", stay], ["random", rnd], ["mobil", mob], ["motive", mot]];
const W = 9;
console.log(`  ${"".padEnd(34)}${"measured".padStart(W)}`
          + runs.map(([n]) => n.padStart(W)).join(""));
const row = (label, get, wanted, dp) => {
  const f = (x) => (Number.isFinite(x) ? x.toFixed(dp == null ? 2 : dp) : "—").padStart(W);
  console.log(`  ${label.padEnd(34)}${f(wanted)}` + runs.map(([, r]) => f(get(r))).join(""));
};
row("lane changes per vehicle-km", (r) => r.rate, RATE, 3);
row("manoeuvre, median seconds", (r) => r.dur.p50, DUR.p50);
row("% of lorry-seconds in lane 1", (r) => r.lorryLeft * 100, LORRY_LEFT * 100, 1);
row("mph, lane 1 minus lane 4", (r) => r.gradient, GRADIENT, 1);
row("median car, mph", (r) => r.mph.car.p50, CAR_MPH, 1);
row("median lorry, mph", (r) => r.mph.artic.p50, LORRY_MPH, 1);
row("time headway, median s", (r) => r.hw.p50, HW.p50);
row("space gap, median m", (r) => r.sp.p50, GAP.p50, 0);
console.log("");

/* The individual gaps, for the model that is actually trying. */
head("Where the model lands, and where the literature's does");
target("lane changes per vehicle-km", mot.rate, RATE);
target("manoeuvre, median", mot.dur.p50, DUR.p50, " s");
target("lorry-seconds in the left lane", mot.lorryLeft * 100, 1.2, "%");
target("mph gradient, lane 1 to lane 4", mot.gradient, GRADIENT, " mph");
target("median car speed", mot.mph.car.p50, CAR_MPH, " mph");
target("median lorry speed", mot.mph.artic.p50, LORRY_MPH, " mph");
target("headway p85 (arrival process, not following)", mot.hw.p85, HW.p85, " s");
target("headway p95", mot.hw.p95, HW.p95, " s");

/* Cars' share of each lane, BEHAVIOUR.md §2. Not one of the four, but
   it is the shape the gradient is made of and it reads at a glance. */
console.log("\n  cars' share of each lane, motive vs I-294 L2 measured:");
const CARLANE = [31.7, 24.3, 19.2, 24.8];
mot.lanes.forEach((L, i) =>
  console.log(`    lane ${L.lane} (${i === 0 ? "left " : i === 3 ? "right" : "     "})`
            + `  ${(L.car * 100).toFixed(1)}%   measured ${CARLANE[i]}%`
            + `      ${L.mph.toFixed(0)} mph`));

/* The three claims about the harness's discriminating power that MUST
   hold, or the scoreboard above is not measuring anything. Hard. */
head("The scoreboard can tell the deciders apart");
ok("doing nothing produces no gradient at all", Math.abs(stay.gradient) < 1.5, true);
ok("...and leaves lorries wherever they arrived",
   Math.abs(stay.lorryLeft - 0.25) < 0.08, true);
ok("changing lane at random produces no gradient either",
   Math.abs(rnd.gradient) < 1.5, true);
ok("...and does not move lorries out of the left lane",
   rnd.lorryLeft > 0.15, true);
ok("a model with a reason produces a gradient", mob.gradient > 3, true);
ok("...and does move lorries right", mob.lorryLeft < stay.lorryLeft / 2, true);
/* The straw man cannot even hit the rate it is aimed at, because gap
   acceptance throws most of its proposals out — a lane change is not
   free, and a model that samples one has not noticed. */
ok("random(0.37) does not even achieve 0.37", rnd.rate < 0.25, true);

/* ── and what the motives are worth, which is the whole point ────────
   Two of BEHAVIOUR.md's four are the ones no acceleration-gain rule can
   reach, and they are the reason `motive.js` exists. These are hard
   assertions rather than `todo`s: they are not "is the model finished",
   they are "did building it accomplish anything", and if the answer is
   no then the argument of PLAN.md §5c is wrong and should be rewritten
   rather than quietly carried.

   ── the bounds are the cross-seed ranges, not this seed's numbers ───
   Lorry-seconds in lane 1 is a small-sample statistic: articulated
   lorries are about 6% of the traffic here, so it swings a long way run
   to run and it is very easy to write an assertion that only passes
   because of the seed at the top of this file. Measured over eight
   seeds, at this flow and this length of run:

     lorry-seconds in lane 1   mobil  median 6.6%, range 4.7–11.0
                               motive median 2.8%, range  1.7– 3.7
     mph gradient              mobil  median 5.6,  range 5.1– 6.5
                               motive median 7.6,  range  7.0– 8.3

   The ranges do not overlap on either statistic, which is the claim
   worth asserting — though be honest about the margins: the lorry share
   separates by a mile (3.7 against 4.7) and the gradient by four tenths
   of one (6.9 against 6.5). So the gradient bound below is absolute
   rather than a ratio. A per-seed ratio looked stronger and was not: on
   seed 11 MOBIL happens to sit at the top of its range and the motives
   at the bottom of theirs, and 1.12x reads like a failure of a model
   that is in fact 1.36x better on the medians. */
head("...and the motives beat the standard model where it counts");
ok("lorries stay out of the left lane, and MOBIL cannot make them",
   mot.lorryLeft < mob.lorryLeft, true);
/* Below MOBIL's best seed, which is 4.7%. */
ok("...comfortably below anything the standard model manages",
   mot.lorryLeft < 0.045, true);
ok("the lane gradient is bigger than the standard model's",
   mot.gradient > mob.gradient, true);
/* Above MOBIL's best seed, which is 6.5 mph. The motives run 7.0–8.3
   across seeds, so this is the separation and not the seed. */
ok("...and above its best run, not just its average", mot.gradient > 6.6, true);
ok("and it does it while changing lane LESS often, not more",
   mot.rate < mob.rate, true);
ok("...and without putting anybody in the same place as anybody else",
   mot.conflicts, 0);
console.log(`       lorries in lane 1: mobil ${(mob.lorryLeft * 100).toFixed(1)}%`
          + `  motive ${(mot.lorryLeft * 100).toFixed(1)}%  measured 1.2%`);
console.log(`       gradient:          mobil ${mob.gradient.toFixed(1)}`
          + `  motive ${mot.gradient.toFixed(1)}  measured 15.0 mph`);
console.log(`       lane changes/km:   mobil ${mob.rate.toFixed(2)}`
          + `  motive ${mot.rate.toFixed(2)}  measured 0.37`);

/* ══ 6. the Mojave, where the sign itself does the work ══════════════
   155 miles of California with lorries posted 55 against cars' 70, on a
   stretch that is a third lorries by count. PLAN.md §5c calls it the
   corridor's signature and says it comes out of two measured facts and
   one sign. This is whether it does. */
head("The Mojave, where lorries are posted 15 mph slower");
const moj = S.run({ px: MOJAVE, when: DAY, state: "CA", dir: 1, seed: 21,
                    hours: 0.6, warmup: 500, decide: S.deciders.mobil() });
ok("two lanes each way", moj.site.lanes, 2);
ok("cars posted 70", T.limitFor("car", MOJAVE, "CA"), 70);
ok("lorries posted 55", T.limitFor("artic", MOJAVE, "CA"), 55);
within("median car, mph", moj.mph.car.p50, 60, 78);
within("the differential you can see out of the window",
       moj.mph.car.p50 - moj.mph.artic.p50, 10, 25);
ok("the right lane is the slow one", moj.lanes[1].mph < moj.lanes[0].mph, true);
ok("and nine lorries in ten are in it", moj.lanes[1].artic > 0.8, true);
console.log(`       left lane ${moj.lanes[0].mph.toFixed(0)} mph, ${(moj.lanes[0].artic * 100).toFixed(0)}% of the artics`);
console.log(`       right lane ${moj.lanes[1].mph.toFixed(0)} mph, ${(moj.lanes[1].artic * 100).toFixed(0)}% of the artics`);

/* The elephant race, and it is not an assertion because it is a finding.
   The lorries here realise a median of about 45 mph against the 53 they
   want — and the reason is upstream of this file. `desiredSpeed`
   extrapolates the observed offset curve linearly below its p15, so the
   lorry that wants 42 mph in a posted 55 is at the fifteenth percentile
   rather than out at the edge. On a two-lane carriageway one of those
   dams the right lane for everything behind it, which is exactly the
   phenomenon PLAN.md §5c wanted and rather more of it than the road has.
   Whether that tail is too fat is a question for traffic.js, and it is
   the sort of question this harness exists to raise. */
console.log(`       lorries want a median of `
  + `${(T.desiredSpeed("artic", MOJAVE, DAY, "CA", 0.5, 0.5) / S.MPH).toFixed(0)} mph`
  + ` and its p15 is ${(T.desiredSpeed("artic", MOJAVE, DAY, "CA", 0.15, 0.5) / S.MPH).toFixed(0)};`
  + ` they realise ${moj.mph.artic.p50.toFixed(0)}. The elephant race is real and may be too strong.`);

/* And at three in the morning it is a different road: more than half
   lorries, on a stretch where they are held to 55. */
const mojNight = S.run({ px: MOJAVE, when: { dow: 2, hour: 3, month: 6 },
                         state: "CA", dir: 1, seed: 22, hours: 1.5, warmup: 400,
                         decide: S.deciders.mobil() });
head("...and at three in the morning it is mostly lorries");
within("vehicles per hour per lane", mojNight.flowLane, 40, 160);
within("artic share at the detector", mojNight.mix.artic, 0.45, 0.85);
ok("more lorries than cars", mojNight.mix.artic > mojNight.mix.car, true);
ok("nobody is queueing for anything", mojNight.queueMax < 3, true);

/* ══ 7. and when it does not work ════════════════════════════════════
   Vehicles can now hit each other. `impact.js` was written for this and
   says so in its own header — the four barrier cases were unified so
   that "traffic needs a fifth: car into car" — and this is the fifth.

   What makes a crash possible is not the solver, it is that nobody in
   the model knows exactly where anybody is any more. Every driver reads
   the road through a delayed, extrapolated picture, occasionally stops
   reading it at all, and can only see 300 m. Give a car-following model
   perfect information and it is provably collision-free; no motive layer
   would ever have produced a crash, because motives are not where
   crashes come from.

   ── the number this section is really about ─────────────────────────
   A US freeway does about **0.62 police-reported crashes per million
   vehicle-kilometres**. That is a startlingly small number and it is the
   hardest part of the whole thing to get right, because it is very easy
   to build a sim whose crashes look plausible one at a time and which is
   wrong by orders of magnitude in the aggregate — and the first version
   of this was wrong by five, all of them from using AASHTO's
   unexpected-object reaction time as a car-following tracking delay.

   The reference run covers about 12,000 veh-km, so the honest
   expectation is 0.007 crashes. Zero is the right answer, and a run that
   produces one is already a hundred times too dangerous. Which means
   crash COUNT is not something a short run can measure at all, and the
   tests below do not pretend otherwise: what they check is that the road
   is quiet when it should be quiet, that the surrogates the safety
   literature uses instead are in range, and that the machinery fires
   correctly when it is given something to fire at. */
head("A free-flowing motorway is a very safe place");
/* The reference run itself, which has already been used for the gaps and
   the scoreboard — a safety check does not need its own road. */
const safe = mob;
console.log(`  ${safe.vehKm.toFixed(0)} vehicle-km of road. At the real ${S.MVK_TARGET}/million`
          + ` that is ${(safe.vehKm / 1e6 * S.MVK_TARGET).toFixed(3)} expected crashes.`);
ok("nobody was hurt", safe.crashes.length, 0);
ok("...and nothing was left in the road", safe.wrecks, 0);
/* The surrogates. Hard braking is the standard telematics threshold at
   0.3 g and is measured in the field at a few events per 100 km; a
   time-to-collision under 1.5 s is the standard conflict definition and
   should be rare on a road running free. Both are three orders of
   magnitude more common than the thing they stand in for, which is
   exactly why they are what a short run can measure. */
within("hard braking events per 100 veh-km", safe.per100Km.hardBrakes, 1, 40);
within("conflicts (TTC < 1.5 s) per 100 veh-km", safe.per100Km.conflicts, 0, 1);
ok("the closest anybody came, 1st percentile TTC, is comfortable",
   safe.ttcP.p1 > 3, true);
within("glances away per 100 veh-km", safe.per100Km.glances, 50, 400);

/* ── the machinery, checked where it can be seen ────────────────────
   Turned up until it fires. These multipliers are not tuning: they are
   how a mechanism that goes off once in a million vehicle-kilometres is
   tested in a run anybody will wait for, and every calibration figure
   above is at 1x. */
head("Turn the inattention up and the machinery works");
const bad = at({ q: REF_Q, hours: 0.25, seed: 41, glance: 15, miss: 0.4,
                 zone: [0, 6000], decide: S.deciders.mobil() });
ok("vehicles hit each other", bad.crashes.length > 0, true);
ok("...and it is mostly rear-end, as it is on a real motorway",
   bad.byType.rear > bad.byType.sideswipe, true);
ok("every crash names both vehicles, both outcomes and the closing speed",
   bad.crashes.every((c) => c.a.kind && c.b.kind && c.a.outcome && c.b.outcome
                          && c.closing > 0 && c.type), true);
/* impact.js's curves, arriving through the sim rather than called
   directly: severity has to fall off, hard, or the injury model is not
   being used properly. Most people walk away; that is the governing rule
   of impact.js and it has to survive the trip through here. */
ok("most people walk away", bad.hurt.superficial + bad.hurt.damage
   > 4 * (bad.hurt.disabling + bad.hurt.fatal), true);
ok("nobody is hurt without a delta-v to hurt them",
   bad.crashes.every((c) => c.a.eff >= 0 && c.b.eff >= 0), true);
ok("the vehicles that stopped are a minority of the vehicles that were hit",
   bad.wrecks < 2 * bad.crashes.length, true);
console.log(`       ${bad.crashes.length} crashes, ${bad.wrecks} vehicles left in the road: `
  + Object.entries(bad.hurt).map(([k, n]) => `${n} ${k}`).join(", "));

/* ── and the one that is the game ───────────────────────────────────
   PLAN.md §5c: "wrecks make traffic, which is the game". A wreck is not
   a scoring event and it is not deleted — it is a stationary object in a
   live lane, and everything behind it has to deal with that. At a real
   freeway's crash rate you would wait eighty simulated hours for one, so
   the harness stages it. */
head("One wreck, and the road behind it");
const before = at({ q: REF_Q, hours: 0.3, seed: 51, zone: [0, 6000],
                    decide: S.deciders.mobil() });
const after = at({ q: REF_Q, hours: 0.3, seed: 51, zone: [0, 6000],
                   incident: { t: 700, s: 3000, lane: 2 },
                   decide: S.deciders.mobil() });
ok("the staged wreck happened where it was asked to",
   after.staged != null && Math.abs(after.staged.s - 3000) < 200, true);
ok("the road behind it slowed right down",
   after.mph.car.p50 < before.mph.car.p50 / 2, true);
/* ⚠ SEED-SENSITIVE, like §9's pair — see PLAN.md, "three more of them".
   The queue behind a wreck grows by a factor that is continuous and
   wide, not a clean step: seven seeds on the OLD vehicle lengths, where
   this is supposed to be green, give x1.32, x1.75, x1.95, x2.24, x2.44,
   x2.77 and x2.96 against this bar of x2.0 — 3 of 7 red. Seed 51 clears
   it by 12%. A red here is worth a seed sweep before it is worth a
   bisect. */
ok("...and the queue upstream grew", after.queueMax > before.queueMax * 2, true);
ok("...and drivers had to brake for it",
   after.per100Km.hardBrakes > before.per100Km.hardBrakes * 3, true);
ok("the carriageway still passes traffic — it is a jam, not a wall",
   after.flowLane > 300, true);
console.log(`       clean: ${before.flowLane.toFixed(0)} veh/h/lane at ${before.mph.car.p50.toFixed(0)} mph`
          + `  |  after: ${after.flowLane.toFixed(0)} at ${after.mph.car.p50.toFixed(0)} mph,`
          + ` queue ${after.queueMax}`);

/* ── and what it still gets wrong, with the number ──────────────────
   Printed rather than asserted, in the same spirit as the scoreboard
   above: a suite that hides its own gaps is worth nothing. */
head("What the crash model still gets wrong");
target("crashes behind one wreck, per million veh-km",
       after.perMvk.crashes, S.MVK_TARGET);
console.log(`       Read that comparison carefully before believing it: the`);
console.log(`       0.62 is a whole freeway's average and this run is nothing`);
console.log(`       but standing queue, which is genuinely the most dangerous`);
console.log(`       place on a motorway. But four orders of magnitude is not a`);
console.log(`       denominator problem. Stop-and-go here shunts far too`);
console.log(`       readily, and the secondary crashes are all 12–18 km/h taps`);
console.log(`       at 3–8 m/s of closing speed — the right KIND of event in`);
console.log(`       the right place, at nothing like the right rate.`);
console.log(`       Two things are missing and both are in PLAN.md §5c: nobody`);
console.log(`       in this model yields, and nobody leaves extra room because`);
console.log(`       the traffic ahead looks bad. Free-flowing road: right.`);
console.log(`       Queue: the shape is right and the rate is not.`);
console.log(`       The blind-spot mechanism is built and defaults to OFF for`);
console.log(`       the same reason — see sim.js. Pass \`miss\` to turn it on.`);

/* ══ 8. and the ramps, which decide a lot of it ══════════════════════
   *(Ric, 2026-08-10: "ramps define some of the decisions by cars. people
   will move lanes more around exits because they are trying to get off
   on or give people room.")*

   Everything above is measured on a road nobody leaves. This is the same
   road with `exitShare` on: each vehicle is given an exit when it spawns
   — §5c, "that is its whole plan" — moves right as it closes on it, and
   is gone from the mainline when it takes it.

   ── the honest health warning on these numbers ──────────────────────
   There are no ON-ramps. A third of the traffic leaves over six
   kilometres and nothing replaces it, so the road THINS: 1,585 veh/h/lane
   at the boundary arrives at the far end as about 1,060. Every
   density-dependent figure below is therefore taken at a lower flow than
   the drone's, and BEHAVIOUR.md is explicit that the lane-change rate is
   *higher* in free flow than in congestion — so a rate measured on a
   thinning road is not comparable to 0.37 and is not compared to it.
   What is checked here is that the mechanism does what it should. */
head("Ramps, and what they do to the decisions");
const ramp = at({ q: REF_Q, hours: 0.3, exitShare: 0.10, zone: [0, 6000],
                  decide: M.decide });
const flat = at({ q: REF_Q, hours: 0.3, exitShare: 0, zone: [0, 6000],
                  decide: M.decide });
console.log(`       junctions inside the run: 1079, 3152, 4228, 5486 m`);
ok("vehicles actually leave the motorway", ramp.exited > 0, true);
ok("...about a third of them, over four junctions at a tenth each",
   Math.abs(ramp.exited / (ramp.exited + ramp.detector) - 0.34) < 0.10, true);
/* Ric's claim, and the point of the whole section. */
ok("RAMPS MAKE PEOPLE CHANGE LANE: the rate goes up",
   ramp.rate > flat.rate * 1.4, true);
ok("...and `exit` is a big share of why anybody moves",
   ramp.changes.filter((c) => c.why === "exit").length > ramp.changes.length * 0.15,
   true);
console.log(`       lane changes per veh-km: ${flat.rate.toFixed(3)} without ramps,`
          + ` ${ramp.rate.toFixed(3)} with`);

/* Missing one is allowed and has to be — §5c wants the driver still in
   lane 1 at the gore, and `exitLead` is drawn 240 m to 3.2 km precisely
   so that the same trait produces the careful and the appalling. What it
   must not be is COMMON. Counted per vehicle: `missedExit` counts
   events, and the few who fail sail past four gores each. */
const tried = ramp.exited + ramp.everMissed;
within("share of drivers who got off, having tried",
       ramp.exited / tried, 0.75, 0.98);
ok("...and the ones who do not are a persistent few, not bad luck spread thin",
   ramp.missedExit / Math.max(1, ramp.everMissed) > 2, true);
console.log(`       ${ramp.exited} got off, ${ramp.everMissed} never did`
          + ` (${(100 * ramp.exited / tried).toFixed(0)}%), over`
          + ` ${ramp.missedExit} sailed-past gores`);
ok("nobody ended up in the same place as anybody else", ramp.conflicts, 0);

/* Where the failures happen is a fact about the model worth printing:
   they are not scattered, they are one lane short of the exit lane. */
console.log("       missed from lane: "
  + ramp.missedFrom.map((n, i) => (n ? `${i}:${n}` : null)).filter(Boolean).join("  "));

/* ══ 9. the on-ramp side ═════════════════════════════════════════════
   The whole point of building it: with exits on and nothing coming the
   other way, the road quietly empties, and every density-dependent
   number taken on it is taken at a flow nobody chose. So the test is
   conservation — everything that entered against everything that left —
   and it is deliberately not rigged. The ramps put in a tenth of what
   arrives at the boundary; the exits take a tenth of whatever happens
   to be passing. Nothing makes those equal.

   Run at 1,200 veh/h/lane rather than the reference 1,585, and §5e is
   the honest account of why: at the reference flow `keepRight` has
   already put 34% of the traffic in the rightmost lane against a
   measured 24.8%, so the lane an on-ramp joins is over capacity before
   a single ramp vehicle arrives. That is a defect in the lane
   distribution, not in the ramps, and it is the next thing to fix.

   ⚠ ── BOTH ASSERTIONS BELOW ARE A COIN TOSS ON `seed` ───────────────
   Do not read a red here as "my change broke the ramps" without running
   it across seeds first. Measured five seeds, both the old vehicle
   lengths and the real ones (PLAN.md, "three more of them"):

     seed        11     23     37     51     67
     old       pass   pass   FAIL   FAIL   pass      2 of 5 red
     real      FAIL   pass   pass   pass   pass      1 of 5 red

   The outcome is BINARY and both assertions read the same event. The
   ramp either gets away — flow x1.23-1.29, conserved 0.99 — or it locks
   solid, x1.01-1.04, conserved 0.78. Nothing lands in between, so a
   single seed is a Bernoulli trial and neither number is a measurement
   of anything but which side it fell.

   It is left as one seed because the alternatives are all worse: five
   seeds is 4 road-hours of on-ramp running and would turn this suite
   from ten minutes into an hour, moving the seed until it passes is
   tuning the scoreboard to fit the run, and widening the bars would
   hide the lane-distribution defect this section exists to keep
   visible. Pool it the day the defect above is fixed and the ramp stops
   being marginal — then it should be green at every seed, and that is
   the real test.

   ── AND THEY ARE GREEN NOW, WHICH IS NOT A FIX ──────────────────────
   Both assertions passed from 2026-08-14, at `conserved` 0.996 against
   the 0.799 they had been failing at. Nothing about the ramp was
   repaired. §5j added a mainline courtesy which consumes different
   random draws, the run landed on the other side of the same coin, and
   the coin is the thing this whole comment is about. The evidence that
   it is luck rather than progress is two lines further down and has not
   moved: the ramp still delivers 247 veh/h against a real 1,200, and
   the median vehicle still joins the motorway at 0.0 m/s. Do not read
   green here as the on-ramp working. */
head("On-ramps, and whether the road holds its traffic");
const RAMP_Q = 1200;
const noRamp   = at({ q: RAMP_Q, hours: 0.4, exitShare: 0.10, zone: [0, 6000],
                      decide: M.decide });
const withRamp = at({ q: RAMP_Q, hours: 0.4, exitShare: 0.10, zone: [0, 6000],
                      decide: M.decide, rampShare: 0.10 });

ok("vehicles really join the motorway", withRamp.merged > 100, true);
ok("...and none at all when the ramps are off", noRamp.merged, 0);
within("everything in against everything out", withRamp.conserved, 0.93, 1.07);
ok("THE ROAD STOPS THINNING: more gets past the detector than without them",
   withRamp.flowLane > noRamp.flowLane * 1.1, true);
console.log(`       ${noRamp.flowLane.toFixed(0)} veh/h/lane with exits and no ramps,`
          + ` ${withRamp.flowLane.toFixed(0)} with both`);
console.log(`       ${noRamp.exited} got off without ramps, ${withRamp.exited} with —`
          + ` the extra traffic does not buy extra exits, because it is`
          + ` the exit lane it is standing in`);

/* The merge itself. `mergeAt` is how far down the acceleration lane the
   gap was found, which is the one thing the drone data could weakly
   corroborate — four merges, median about half way along. */
const mergePts = withRamp.mergeAt.slice().sort((a, b) => a - b);
const atMed = mergePts.length ? mergePts[mergePts.length >> 1] : 0;
ok("nobody merged past the end of the tarmac",
   mergePts[mergePts.length - 1] <= 250 + 1e-6, true);
ok("nobody drove through anybody doing it", withRamp.conflicts, 0);
/* The merge point is pinned to the end of the lane, and that is the
   symptom of the throughput gap below rather than a free choice: once a
   ramp is queued, everybody on it has already been carried to the stop
   line by the vehicle in front, so they all merge from the same place.
   The four drone merges say about half way along. */
target("median merge point along a 250 m lane", atMed, 125, " m");
console.log(`       ${withRamp.merged} merged, worst ramp queue`
          + ` ${withRamp.rampQueueMax}`);

/* And the jam, which §5c asked to appear on its own rather than be
   written: the same ramps on a road that is already full. It does — but
   it also forms at 1,200, which it should not, and §5e says why. */
const jam = at({ q: REF_Q, hours: 0.4, exitShare: 0.10, zone: [0, 6000],
                 decide: M.decide, rampShare: 0.10 });
ok("THE ON-RAMP JAM: the fuller the road, the longer the queue",
   jam.rampQueueMax > withRamp.rampQueueMax, true);
console.log(`       queue ${withRamp.rampQueueMax} at ${RAMP_Q} veh/h/lane,`
          + ` ${jam.rampQueueMax} at ${REF_Q} — nobody wrote that in`);
/* The number that stops this being the default. A real on-ramp carries
   1,200–1,500 veh/h; four of these together manage a fraction of it,
   because the lane they are joining has no room in it. */
const perRamp = withRamp.merged / (0.4) / 4;
target("veh/h a single on-ramp can deliver", perRamp, 1200, " veh/h");

/* ── and WHY, which is now a number rather than a theory ──────────────
   §5e blamed the lane shares, and they are wrong in the direction it
   said. But they are not what pins the ramp, and this is the measurement
   that says so: a queued ramp discharges FROM A STANDSTILL. A stopped
   vehicle joining a lane doing 28 m/s needs the follower to lose all of
   that speed, which asks for a couple of hundred metres of gap, and at
   the density in the rightmost lane that gap does not come.

   It is the ceiling on everything else about merging. The `merge` motive
   — mainline drivers moving over and lifting off for somebody joining —
   was built against it and measured over seven seeds at 600 veh/h
   offered: the ramp serves about 270 veh/h with the courtesy and about
   270 without it. Nobody can open a two-hundred-metre gap by being
   polite. See PLAN.md §5j; the fix is a merging driver who does not
   merge from rest, and it is in the ramp model rather than in a motive. */
const mv = withRamp.mergeV.slice().sort((a, b) => a - b);
const ml = withRamp.mergeLag.slice().sort((a, b) => a - b);
target("m/s a vehicle is doing when it joins the motorway",
       mv.length ? mv[mv.length >> 1] : 0, 25, " m/s");
console.log(`       and the gap behind it when it does:`
          + ` ${(ml.length ? ml[ml.length >> 1] : 0).toFixed(0)} m —`
          + ` a stopped vehicle asks the follower for all of its speed`);

/* ══════════════════════════════════════════════════════════════════════
   §10  The band that travels with somebody

   Everything above measures a fixed six kilometres of road. The game is
   2,551 miles long and only ever shows about six hundred pixels of it,
   so `roam` moves the stretch instead: traffic crosses into it from
   behind when it is faster than the band and from in front when the band
   is faster than it, at the flux the corridor's own density implies.

   The claim being tested is that this is the SAME ROAD, observed from a
   moving car rather than a fixed camera — so the thing to check is the
   one quantity an observer's speed must not change. Density.

   The parked case is the load-bearing one. A band standing still is the
   harness, so it must return the harness's own answer with no allowance
   made, and it is the check that the flux arithmetic is not merely
   self-consistent.
   ══════════════════════════════════════════════════════════════════════ */
head("The band that travels with the player");

/* The standing road's density, in the counting zone so the boundary
   transient is outside it. */
function standingK(seed) {
  const w = S.world({ px: REF, when: DAY, state: "TN", dir: 1, seed,
                      q: REF_Q, lanes: 4, decide: M.decide, exitShare: 0,
                      hours: 0.25, length: 6000, zone: [2000, 6000] });
  let n = 0, m = 0;
  while (w.time() < 600 + 900) {
    w.step();
    if (w.time() > 600 && Math.round(w.time() * 10) % 100 === 0) {
      n += w.live.filter((v) => v.s >= 2000 && v.s <= 6000).length; m++;
    }
  }
  return n / m / 4 / 4;                          // veh/km/lane
}

/* The same road seen from a car doing `vb` metres a second. */
const BACK = 900, AHEAD = 1500;
function bandK(seed, vb, secs) {
  const w = S.world({ px: REF, when: DAY, state: "TN", dir: 1, seed,
                      q: REF_Q, lanes: 4, decide: M.decide, exitShare: 0,
                      roam: { back: BACK, ahead: AHEAD, at: 0 } });
  let s = 0, n = 0, m = 0;
  for (let k = 0; k < secs * 10; k++) {
    s += vb * 0.1; w.follow(s, vb); w.step();
    if (k > secs * 3 && k % 10 === 0) {
      const b = w.band();
      n += w.live.filter((v) => v.s >= b.lo && v.s <= b.hi).length; m++;
    }
  }
  return { k: n / m / ((BACK + AHEAD) / 1000) / 4, w };
}

const SEEDS = [11, 23, 37];
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const kStand = med(SEEDS.map(standingK));
console.log(`       the standing harness carries ${kStand.toFixed(1)} veh/km/lane`);

const kParked = med(SEEDS.map((sd) => bandK(sd, 0, 900).k));
ok("A PARKED BAND IS THE HARNESS: same density, no allowance made",
   Math.abs(kParked / kStand - 1) < 0.10, true);
console.log(`       parked ${kParked.toFixed(1)} against ${kStand.toFixed(1)}`
          + ` — ${(kParked / kStand * 100).toFixed(0)}%`);

/* And the same road at every speed a player can hold. The residual is
   real and is printed rather than tolerated: a band travelling at the
   traffic's own speed exchanges almost nothing with the road outside it,
   so it holds whatever it was given and drifts. That is the regime the
   hysteresis in `SOFT` exists for, and it is the one it only half
   fixes. */
console.log("       band speed      veh/km/lane   vs standing");
let worst = 1;
for (const vb of [15, 27, 40, 53]) {
  const k = med(SEEDS.map((sd) => bandK(sd, vb, 900).k));
  const r = k / kStand;
  if (r < worst) worst = r;
  console.log(`       ${String(Math.round(vb * 2.237)).padStart(3)} mph`
            + `         ${k.toFixed(1)}          ${(r * 100).toFixed(0)}%`);
}
ok("...and it holds the road at every speed a player can drive at",
   worst > 0.75, true);
console.log("       the dip is at the traffic's own speed, where a band"
          + " exchanges almost nothing — see sim.js on SOFT");

/* ── and the band that runs the other way ─────────────────────────────
   The ONCOMING carriageway is this same band with a negative speed: seen
   from a car going the other way it sweeps backwards through its own
   traffic, so vehicles cross in over its TRAILING edge at the SUM of the
   two speeds rather than over its leading edge at the difference. It is
   the case a player looks straight at for the whole run, and clamping
   the band speed to zero broke it silently — the road held its density
   on average while the nine hundred metres behind the band ran empty.
   Checked here as a PROFILE for that reason: an average would have
   passed. */
function profile(seed, vb, secs) {
  const w = S.world({ px: REF, when: DAY, state: "TN", dir: 1, seed,
                      q: REF_Q, lanes: 4, decide: M.decide, exitShare: 0,
                      roam: { back: BACK, ahead: AHEAD, at: 0 } });
  let s = 0;
  const bins = new Array(8).fill(0), BIN = (BACK + AHEAD) / 8;
  let m = 0;
  for (let k = 0; k < secs * 10; k++) {
    s += vb * 0.1; w.follow(s, vb); w.step();
    if (k > secs * 3 && k % 10 === 0) {
      const b = w.band();
      for (const v of w.live) {
        const i = Math.floor((v.s - b.lo) / BIN);
        if (i >= 0 && i < 8) bins[i]++;
      }
      m++;
    }
  }
  return bins.map((n) => n / m / (BIN / 1000) / 4);
}

const back = profile(11, -36, 600);              // against the traffic, 80 mph
console.log(`       against the traffic, veh/km/lane by 300 m bin:`);
console.log("       " + back.map((x) => x.toFixed(0).padStart(4)).join(""));
const emptiest = Math.min(...back), fullest = Math.max(...back);
ok("A BAND RUNNING THE OTHER WAY FILLS FROM THE BACK, not the front",
   emptiest > kStand * 0.5, true);
console.log(`       emptiest bin ${emptiest.toFixed(1)}, fullest`
          + ` ${fullest.toFixed(1)}, against a standing ${kStand.toFixed(1)}`);

/* A live world must not keep books. `stat.changes`, `stat.headway` and
   `stat.ttc` are unbounded, and an hour of driving would fill them. */
const roamer = bandK(11, 30, 300).w;
ok("a roaming world keeps no ledger to fill up",
   roamer.stat.changes.length + roamer.stat.headway.length
   + roamer.stat.ttc.length, 0);
ok("...and nobody drove through anybody in it", roamer.stat.conflicts, 0);

/* ══════════════════════════════════════════════════════════════════════
   §11  A lane that ends

   The third junction motive, and the last of §5c's seven. The harness
   never had anywhere to test it until `drop` went in: one lane stops
   being there at a stated station, the end of it is a stopped obstacle
   in `follow` like a wreck is, and getting out of it is an ordinary
   lane change that has to be wanted, decided and granted.

   THE FLOW IT IS MEASURED AT MATTERS and it is easy to get wrong. Drop
   one of four lanes and the demand does not drop with it — the reference
   1,585 veh/h/lane is 6,340 veh/h arriving at a road that is three lanes
   wide from halfway, which is 2,113 per lane against a capacity near
   1,900. That queues, and it should; measuring the motive there measures
   the queue instead. So the flow here is one that FITS: 900 veh/h/lane
   into three lanes is 1,200 each, free-flowing on both sides of the
   drop, and what is left to measure is the merge itself.
   ══════════════════════════════════════════════════════════════════════ */
head("A lane that ends, and whether anybody gets out of it");
const DP_AT = 4000, DP_Q = 900;
const dpWide = at({ q: DP_Q, hours: 0.4, zone: [2000, 6000], decide: M.decide });
const dpRun = at({ q: DP_Q, hours: 0.4, zone: [2000, 6000], decide: M.decide,
                  drop: DP_AT });

const dpOut = dpRun.changes.filter((c) => c.why === "lane-drop");
ok("nobody has a lane-drop reason on a road of constant width",
   dpWide.changes.filter((c) => c.why === "lane-drop").length, 0);
ok("...and on one that narrows, that is why they move",
   dpOut.length > 100, true);
ok("nobody drove through anybody doing it", dpRun.conflicts, 0);

/* Where they get out, as metres before the end. The spread is the whole
   claim: it comes from `exitLead` alone — one trait drawn 240 m to
   3.2 km — so the careful are out a kilometre early and the appalling
   are still there at the taper, and nothing decides which is which. */
const dpBefore = dpOut.map((c) => DP_AT - c.s).sort((a, b) => a - b);
const dpQ = (f) => dpBefore[Math.floor(dpBefore.length * f)];
console.log(`       out of it at ${dpQ(0.15).toFixed(0)} / ${dpQ(0.5).toFixed(0)}`
          + ` / ${dpQ(0.85).toFixed(0)} m before the end (p15/p50/p85)`);
ok("THE CAREFUL AND THE APPALLING, out of one trait",
   dpQ(0.85) > 3 * dpQ(0.15), true);

/* And the ones who leave it too late. A lane drop nobody ever fails at
   is a lane drop with the urgency turned up until failure is impossible,
   which is not what §5c asked for — the tails are supposed to have
   people in them. */
ok("somebody always leaves it too late", dpRun.dropStuck > 0, true);
within("...but it is the tail, not the population",
       dpRun.dropStuck / dpRun.spawned, 0.0, 0.10);
console.log(`       ${dpRun.dropStuck} of ${dpRun.spawned} stopped at the end of it,`
          + ` for ${dpRun.dropHeld.toFixed(0)} vehicle-seconds`);

/* The road still works. Three lanes carrying what four were carrying is
   the point of the exercise, and the detector is downstream of the drop
   so it is counting three. */
console.log(`       ${dpWide.flowLane.toFixed(0)} veh/h/lane over four lanes,`
          + ` ${(dpRun.flow / 3).toFixed(0)} over the three it becomes`);
ok("the traffic gets past the drop", dpRun.flow / 3 > dpWide.flowLane * 0.9, true);

/* ── done ─────────────────────────────────────────────────────────── */
console.log(`\n${pass} passed, ${fail} failed, ${todo} measured but not yet reproduced`);
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s of wall clock`);
console.log("─".repeat(30));
process.exit(fail ? 1 : 0);
