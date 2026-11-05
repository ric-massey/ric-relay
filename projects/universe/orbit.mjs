// orbit.mjs -- does anything orbit here, and if not, which cause stops it?
// And, since 2026-11-05: how strong is gravity allowed to be? (Checks 6-9.)
//
// README item 16. The documents say "nothing completed two laps" at radii of
// 20, 100 and 500 and conclude that the lattice is what prevents orbits, filed
// beside "2D is topologically poor". No tool in this directory ever had an
// orbit in it, so by this project's own standard -- every number came from a
// tool and can be rerun -- that result could not be checked. This is the tool.
//
// Item 16 says the result had TWO sufficient causes and separated neither:
//   1. direction quantization -- a primitive steps one whole hexagon in one of
//      six directions, so its path is a zigzag and every lap leaks from rounding
//   2. momentum clipping -- an orbit runs on momentum CHANGING as a primitive
//      rises and falls, and at +-3 there are three integers of room before the
//      symmetric clamp stops the change entirely
// So this runs the 2x2: each cause off, each on alone, both on, with the
// both-off corner as the control. AGENTS.md rule 12 is explicit that the
// control is where the result lives; if the control cannot orbit, the harness
// is broken and nothing else in the output means anything.
//
// THERE IS A THIRD CAUSE, and it is not in item 16 because nothing had run.
// Law 3 says gravity falls off as 1/r^2 and adds to momentum. It does not say
// what happens when the pull is SMALLER THAN ONE UNIT of momentum, which at
// these radii it almost always is. That is an unwritten rule, it is doing more
// to the answer than either cause item 16 names, and it is the third axis here:
//   round -- round the pull to the nearest integer each tick. Below |dp| = 0.5
//            gravity switches off completely. A cutoff radius nobody chose.
//   carry -- accumulate the fraction and spend it in whole units when it
//            reaches one. The impulse arrives late but exact.
//
// Physics from THE-LAWS.md: momentum is an integer cube vector with every
// component in +-R; speed is a RATE, one hexagon every k/|p| ticks, capped at
// one per tick; a step rounds to the nearest of six directions and the vector
// itself is never rounded; gravity adds to momentum, falling off as 1/r^2.
// Cube coordinates and cube rounding: Patel, Red Blob Games -- SOURCES.md.
// The circular-orbit condition v^2 = GM/r: Newton -- SOURCES.md.
//
//   node orbit.mjs

// ---------------------------------------------------------------- constants
// AGENTS.md rule 8: named, with units, no magic numbers in rule bodies.
const RADII        = [20, 100, 500];  // hexagons -- the three the claim cites
const RANGES       = [3, 15];         // momentum component limit, +-R
// The claim was "nothing completed two laps", and this was 2 until
// 2026-11-05 -- which is too short to tell an orbit from a slow spiral, and
// hid Check 9's tie-break bias for a day. Ten laps, and every run reports
// its closest approach on its first lap and its last, so a spiral shows.
const LAPS_TARGET  = 10;
const MAX_TICKS    = 8000000;         // give up -- ten laps at r=500, +-3 needs 5.3M
const FELL_IN      = 1.0;             // hexagons from centre -- counts as fallen in
const ESCAPE_MULT  = 8;               // radius this many x r0 counts as escaped

// The orbiter is the HEAVIEST kind, and that is forced rather than chosen.
// Speed is |p|/k and law 1 caps it at one hexagon per tick, so a circular
// orbit needs |p| <= k or the causal cap breaks the circular condition the run
// was set up with. Heavy also means the finest speed resolution available,
// since one unit of momentum moves the speed by 1/k -- so this is the best
// case an orbit can have here, which is what the test should be measuring.
const KIND_ORBITER = 255;

// How far out in the legal momentum box a run is allowed to start, as a
// fraction of the longest legal vector at +-R.
//
// This constant is the third harness bug this file has had, and the worst.
// It was effectively 1.0 -- every run began at the very corner of the box.
// The legal set is "every component within +-R", which is not a circle, so
// the longest available vector CHANGES WITH DIRECTION. A circular orbit has
// to hold |p| constant while the direction turns a full lap, and starting at
// the edge means clampLegal shaves the magnitude at some headings and not
// others. That is a systematic speed leak, it is one-sided (slower, so it
// falls inward, so 1/r^2 pulls harder), and it was reported as "integer
// momentum cannot orbit" for a day. Check 5 is the measurement.
const START_FRAC   = 0.5;

// ------------------------------------------------------------ cube geometry
// Three axes summing to zero. Q is the un-halved squared length, exactly as
// momentum.mjs carries it; true |p|^2 is Q/2, so |p| = sqrt(Q/2).
const Q    = (p) => p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
const mag  = (p) => Math.sqrt(Q(p) / 2);
const add  = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub  = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl  = (a, t) => [a[0] * t, a[1] * t, a[2] * t];
const dot  = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const zero = (p) => p[0] === 0 && p[1] === 0 && p[2] === 0;

// Measurement only. No law reads cartesian space; the lap counter does.
const SQ3H = Math.sqrt(3) / 2;
const cart = (p) => [p[0] + p[2] / 2, SQ3H * p[2]];

const DIRS = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];

// The start radius, and a vector perpendicular to it. Cube dot is cartesian
// dot doubled, so dot(RADIAL, TANGENT) === 0 is real perpendicularity -- and
// getting this wrong is one of the two bugs the control caught on first run:
// [0,-1,1] looks tangential written down and is 60 degrees off.
const RADIAL  = [1, -1, 0];
const TANGENT = [-1, -1, 2];

// Cube rounding: round each component, then repair the one that moved
// furthest so the three still sum to zero.
function cubeRound(p) {
  let rx = Math.round(p[0]), ry = Math.round(p[1]), rz = Math.round(p[2]);
  const dx = Math.abs(rx - p[0]), dy = Math.abs(ry - p[1]), dz = Math.abs(rz - p[2]);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, ry, rz];
}

// The one thing law 1 asks for: round the STEP to one of six directions,
// leaving the momentum vector itself alone.
//
// AND WHAT LAW 1 DOES NOT SAY: what happens on a TIE. An integer cube vector
// lands exactly halfway between two directions all the time -- [-1,-1,2],
// this file's own starting tangent, is one -- and on 2 to 4 percent of steps
// in an orbit. This function used to keep the first of the tied pair in
// DIRS order, every time. That is a preferred handedness in the physics: the
// path always leans the same way, and it bled every integer orbit inward
// into a spiral that fell in within 3 to 15 laps (Check 9). It was the
// fourth harness bug in this file, and the first that pushed AGAINST the
// conclusion being tested -- Check 1 called those spirals orbits, because
// two laps is too short to tell an ellipse from a spiral.
//
// TIE_COIN is the fix: a fair coin between the tied directions, from a
// seeded generator so every run is reproducible. A coin rather than an
// alternation because the World already draws per-tick probabilities and an
// alternation would need a stored bit per primitive. "first" stays available
// so Check 9 can show what it did.
const TIE_COIN = "coin", TIE_FIRST = "first";
const TIE_SEED = 12345;
const SEEDS    = [1, 2, 3];           // Check 8 flies each orbit this many times
function nearestDir(p, tie, rand) {
  let bestDot = -Infinity, ties = [];
  for (const d of DIRS) {
    const v = dot(p, d);
    if (v > bestDot) { bestDot = v; ties = [d]; }
    else if (v === bestDot) ties.push(d);
  }
  if (ties.length === 1 || tie === TIE_FIRST) return ties[0];
  return ties[Math.floor(rand() * ties.length)];
}

// A small seeded generator (a linear congruential one -- Knuth, SOURCES.md),
// so a coin flip is reproducible run to run. Not physics; a dice cup.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

// The symmetric clamp. THE-LAWS settles the PAIR case -- transfer as much as
// both sides can take -- but says nothing about a single body in a field, so
// this scales the whole vector back along its own direction rather than
// clipping one component, which would turn the primitive as well as slow it.
// Stated here because it is a physics choice, not an implementation detail.
function clampLegal(p, R) {
  const worst = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2]));
  return worst <= R ? p : cubeRound(scl(p, R / worst));
}

// --------------------------------------------------------------- the engine
// integerMomentum -- momentum is an integer cube vector, clamped at +-R
// latticeSteps    -- position is a whole hexagon and steps go in six directions
// carry           -- accumulate sub-unit gravity instead of rounding it away
//
// gm is chosen so the starting momentum is EXACTLY circular at r0: v = |p|/k
// and v^2 = GM/r, so GM = (p0/k)^2 * r0. Each run starts from the best case
// Newton allows and measures only what the lattice does to it.
//
// Checks 6 to 8 pass gm and k explicitly instead, because they ask what a
// GIVEN strength of gravity does rather than what strength a circle needs.
// Then p0 is whatever is circular at r0 under that gm. `surface` is the
// radius of whatever sits at the centre: an orbit that dips inside it has
// hit it, and two laps through a clump is a collision, not an orbit.
function run({ r0, R, integerMomentum, latticeSteps, carry, startFrac = START_FRAC,
               gm: gmGiven, k = KIND_ORBITER, surface = FELL_IN, tie = TIE_COIN,
               seed = TIE_SEED }) {
  const rand = seeded(seed);
  const p0mag = gmGiven === undefined
    ? mag(scl([0, -1, 1], R)) * startFrac      // see START_FRAC
    : k * Math.sqrt(gmGiven / r0);
  const v0 = p0mag / k;                        // hexagons per tick
  const gm = gmGiven === undefined ? v0 * v0 * r0 : gmGiven;

  const start = scl(RADIAL, r0 / mag(RADIAL));
  let pos = latticeSteps ? cubeRound(start) : start;
  let p = scl(TANGENT, p0mag / mag(TANGENT));
  if (integerMomentum) p = clampLegal(cubeRound(p), R);

  let residual = [0, 0, 0];                    // unspent gravity, carry mode
  let clips = 0;                               // ticks the clamp shaved |p| on
  const clampCount = (v) => {
    const b = clampLegal(v, R);
    if (mag(b) < mag(v) - 1e-9) clips++;
    return b;
  };
  let ticks = 0, laps = 0, stepAcc = 0;
  const lapMin = {};                           // closest approach on each lap
  let minR = r0, maxR = r0, gravityZeroTicks = 0;
  const [sx, sy] = cart(pos);
  let angPrev = Math.atan2(sy, sx), angTotal = 0;
  let outcome = "ran out of ticks";

  while (ticks < MAX_TICKS) {
    ticks++;

    // --- law 3: gravity adds to momentum, falling off as 1/r^2 ---
    const r = mag(pos);
    if (r < surface)            { outcome = surface > FELL_IN ? "hit the clump" : "fell in"; break; }
    if (r > r0 * ESCAPE_MULT)   { outcome = "escaped"; break; }

    const dpMag = (k * gm) / (r * r);
    const dp = scl(scl(pos, -1), dpMag / r);   // toward the centre
    if (!integerMomentum) {
      p = add(p, dp);
    } else if (carry) {
      residual = add(residual, dp);
      const whole = cubeRound(residual);
      if (zero(whole)) gravityZeroTicks++;
      else { p = clampCount(add(p, whole)); residual = sub(residual, whole); }
    } else {
      const next = clampCount(cubeRound(add(p, dp)));
      if (next[0] === p[0] && next[1] === p[1] && next[2] === p[2]) gravityZeroTicks++;
      p = next;
    }

    // --- law 1: speed is a rate, one hexagon every k/|p| ticks, max one ---
    const pm = mag(p);
    if (pm === 0) { outcome = "stopped dead"; break; }
    const speed = Math.min(1, pm / k);         // hexagons per tick
    if (latticeSteps) {
      stepAcc += speed;
      while (stepAcc >= 1) { pos = add(pos, nearestDir(p, tie, rand)); stepAcc -= 1; }
    } else {
      pos = add(pos, scl(p, speed / pm));
    }

    // --- measurement only ---
    const rNow = mag(pos);
    if (rNow < minR) minR = rNow;
    if (rNow > maxR) maxR = rNow;
    const [cx, cy] = cart(pos);
    const ang = Math.atan2(cy, cx);
    let d = ang - angPrev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    angTotal += d; angPrev = ang;
    laps = Math.abs(angTotal) / (2 * Math.PI);
    const lap = Math.floor(laps);
    if (!(lap in lapMin) || rNow < lapMin[lap]) lapMin[lap] = rNow;
    if (laps >= LAPS_TARGET) { outcome = "ORBITED"; break; }
  }

  return {
    laps: Number(laps.toFixed(2)), outcome, ticks,
    rMin: Number(minR.toFixed(1)), rMax: Number(maxR.toFixed(1)),
    // closest approach on the first lap and on the last COMPLETE lap: equal
    // is an ellipse, falling is a spiral. "-" when no lap completed.
    close1: 0 in lapMin && 1 in lapMin ? Number(lapMin[0].toFixed(0)) : "-",
    closeN: Math.floor(laps) >= 2 ? Number(lapMin[Math.floor(laps) - 1].toFixed(0)) : "-",
    noGravity: integerMomentum
      ? (100 * gravityZeroTicks / ticks).toFixed(0) + "%" : "-",
    clamped: integerMomentum ? clips : "-",
  };
}

// ------------------------------------------------------------------ the 2x2
const MODES = [
  { key: "control, neither cause", integerMomentum: false, latticeSteps: false, carry: false },
  { key: "direction only",         integerMomentum: false, latticeSteps: true,  carry: false },
  { key: "momentum only, round",   integerMomentum: true,  latticeSteps: false, carry: false },
  { key: "momentum only, carry",   integerMomentum: true,  latticeSteps: false, carry: true },
  { key: "both, round",            integerMomentum: true,  latticeSteps: true,  carry: false },
  { key: "both, carry",            integerMomentum: true,  latticeSteps: true,  carry: true },
];

console.log("=== Check 1: each cause alone, then together, under both gravity rules ===");
console.log(`orbiter is kind ${KIND_ORBITER}; p0 is START_FRAC (${START_FRAC}) of the longest legal vector; ${LAPS_TARGET} laps to pass.`);

const rows = [];
for (const r0 of RADII) {
  for (const R of RANGES) {
    for (const m of MODES) {
      rows.push({
        r0, range: "+-" + R, cause: m.key,
        ...run({ r0, R, integerMomentum: m.integerMomentum, latticeSteps: m.latticeSteps, carry: m.carry }),
      });
    }
  }
}
console.table(rows);

// ------------------------------------------------------------------ verdict
const pick = (s) => rows.filter((x) => x.cause.startsWith(s));
const won = (set) => set.filter((x) => x.outcome === "ORBITED").length;
const control = pick("control"), dirOnly = pick("direction");
const momRound = pick("momentum only, round"), momCarry = pick("momentum only, carry");
const bothRound = pick("both, round"), bothCarry = pick("both, carry");

console.log("");
console.log("=== Check 2: what it says ===");
for (const [label, set] of [
  ["control, neither cause", control], ["direction quantization only", dirOnly],
  ["integer momentum only, round", momRound], ["integer momentum only, carry", momCarry],
  ["both, round", bothRound], ["both, carry", bothCarry],
]) console.log(`  ${label.padEnd(30)} ${won(set)} of ${set.length} orbited`);
console.log("");

if (won(control) === 0) {
  console.log("  THE CONTROL DID NOT ORBIT. Rule 12: if a run reports zero of the thing");
  console.log("  you are measuring, the run is wrong, not the physics. Nothing below");
  console.log("  this line means anything until the control orbits.");
} else {
  console.log("  The control orbits, so the harness can produce one and the rest of the");
  console.log("  table is measuring what it claims to.");
  if (won(bothCarry) > 0 && won(bothRound) === 0) {
    console.log("");
    console.log("  THE DECIDING CAUSE IS THE ONE ITEM 16 DOES NOT NAME. Under the same");
    console.log("  lattice, the same widths and the same clamp, orbits exist with carried");
    console.log("  gravity and do not exist with rounded gravity. Neither direction");
    console.log("  quantization nor momentum width decides it -- an unwritten rule does,");
    console.log("  and law 3 has to say which it is before item 16 can be answered.");
  } else if (won(dirOnly) === 0 && won(momRound) + won(momCarry) > 0) {
    console.log("  Direction quantization alone kills it; integer momentum alone does not.");
    console.log("  The original diagnosis -- the lattice -- survives, as evidence now.");
  } else if (won(momRound) + won(momCarry) === 0 && won(dirOnly) > 0) {
    console.log("");
    console.log("  THE RECORDED DIAGNOSIS IS FALSE. The documents say what defeats an orbit");
    console.log("  is that a primitive travels in one of six directions, one whole hexagon");
    console.log("  at a time, and that every lap leaks from the rounding. Direction");
    console.log("  quantization is switched on alone in the 'direction only' rows and they");
    console.log("  orbit every time -- the path is a visible zigzag, the radius wobbles by");
    console.log("  about a quarter, and it still closes two laps. The zigzag is survivable.");
    console.log("");
    console.log("  What is not survivable is integer momentum, in every configuration");
    console.log("  tested, under both gravity rules. Check 4 then rules out the obvious");
    console.log("  follow-up: it is not the RANGE.");
  } else {
    console.log("  Read the table rather than this line: the pattern is not one of the");
    console.log("  three this tool knows how to summarise.");
  }
}

// ------------------------------------------- the gap, stated with its numbers
console.log("");
console.log("=== Check 3: the size of the sub-unit pull ===");
console.log("  |dp| per tick at the starting radius is p0^2/(k*r0):");
for (const r0 of RADII) {
  for (const R of RANGES) {
    const p0mag = mag(scl([0, -1, 1], R));
    const dp = (p0mag * p0mag) / (KIND_ORBITER * r0);
    const flag = dp < 0.5 ? "  <- rounds to ZERO: gravity never acts" : "";
    console.log(`    r=${String(r0).padStart(3)}  +-${String(R).padStart(2)}  |dp| = ${dp.toFixed(5)}${flag}`);
  }
}
console.log("");
console.log("  Every one of them is below half a unit. Under the ROUNDING rule that");
console.log("  means gravity is off at every radius and range tested -- the noGravity");
console.log("  column is 100% and the body leaves in a straight line. That is a cutoff");
console.log("  radius nobody chose, arriving exactly the way law 2's cap of 8 did: a");
console.log("  field width quietly picking a physics constant.");
console.log("");
console.log("  Under the CARRY rule the same fractions orbit. Note what the noGravity");
console.log("  column says in those rows: 96 to 100 percent. Gravity spends a whole unit");
console.log("  on about one tick in fifty and is idle on the rest, and that is enough to");
console.log("  hold an orbit. Sub-unit pull was never the problem. Discarding it was.");

// ------------------------------------------------- where does it become possible
// Check 3 says the pull is unrepresentably small. That has an arithmetic
// boundary rather than a vague one, so find it rather than asserting it.
// A circular orbit needs the per-tick pull to be at least one unit:
//     |dp| = p0^2 / (k*r0) >= 1   ->   p0 >= sqrt(k*r0)
// and law 1's causal cap needs the speed under one hexagon per tick:
//     v = p0/k <= 1              ->   p0 <= k
// Both at once give sqrt(k*r0) <= k, which is r0 <= k. So the orbiter's KIND
// is a hard ceiling on orbital radius, and no momentum width changes it.
console.log("");
console.log("=== Check 4: the range at which an orbit first becomes representable ===");
const SWEEP_RADII = [20, 100];
const SWEEP_RANGES = [3, 7, 15, 31, 63, 127, 255];
const sweep = [];
for (const r0 of SWEEP_RADII) {
  for (const R of SWEEP_RANGES) {
    const p0mag = mag(scl([0, -1, 1], R));
    const row = {
      r0, range: "+-" + R,
      bits: Math.ceil(Math.log2(2 * R + 1)) * 2 + " of 10",
      dpPerTick: Number(((p0mag * p0mag) / (KIND_ORBITER * r0)).toFixed(3)),
      round: run({ r0, R, integerMomentum: true, latticeSteps: true, carry: false }).outcome,
      carry: run({ r0, R, integerMomentum: true, latticeSteps: true, carry: true }).outcome,
    };
    sweep.push(row);
  }
}
console.table(sweep);
console.log("  THE PREDICTION ABOVE IS CORRECT, AND FOR A DAY A BROKEN START HID IT.");
console.log("  It said an orbit should appear under the ROUNDING rule once the range is");
console.log("  wide enough for |dp| to reach about one unit, at roughly +-sqrt(k*r0) --");
console.log("  which is +-71 for r=20 and +-160 for r=100. The round column turns over");
console.log("  between +-63 and +-127 at r=20, and between +-127 and +-255 at r=100.");
console.log("  Both thresholds straddle the predicted number. It was right.");
console.log("");
console.log("  It read as refuted while START_FRAC was effectively 1.0, because every");
console.log("  run then grazed the clamp and fell in before the prediction could show.");
console.log("  Kept here with both readings, because the lesson is not that the number");
console.log("  was wrong -- it is that a broken harness can refute a correct prediction");
console.log("  just as convincingly as it can confirm a wrong one. Rule 12 cuts in both");
console.log("  directions and this file is now the evidence for the second direction.");
console.log("");
console.log("  Momentum RANGE is a lever, and the sweep says where it bites. Under the");
console.log("  carry rule +-3 holds no orbit at any radius and +-7 and +-15 hold one at");
console.log("  all three, so the 2026-11-04 move to eight bytes is what bought orbits --");
console.log("  though +-7 would have done. (Before Check 9's tie-break fix +-7 fell in;");
console.log("  that was the bias, not the width.) The");
console.log("  reason +-3 fails is not the pull, it is that the box is too small to");
console.log("  hold a margin and a usable resolution at the same time: half of +-3 is");
console.log("  a momentum of about 1, and one unit of anything destroys it.");
console.log("");
console.log("  This tool does NOT settle which rule law 3 should use. Carrying the");
console.log("  remainder needs somewhere to keep it, and a per-primitive residual is a");
console.log("  stored field -- 24 spare bits exist but AGENTS.md rule 5 says nothing goes");
console.log("  in them without an entry in THE-LAWS.md and a reason. That is the decision.");

// ------------------------------------- the clamp, which was the third bug
console.log("");
console.log("=== Check 5: how far from the clamp a run has to start ===");
console.log("  START_FRAC is the starting |p| as a fraction of the longest legal vector.");
console.log("  The clamped column counts ticks on which clampLegal shaved the magnitude.");
const MARGINS = [1.0, 0.9, 0.7, 0.5, 0.25];
const margin = [];
for (const frac of MARGINS) {
  for (const carry of [false, true]) {
    const z = run({ r0: 20, R: 15, integerMomentum: true,
                    latticeSteps: true, carry, startFrac: frac });
    margin.push({
      "start |p|": frac.toFixed(2) + " of box",
      rule: carry ? "carry" : "round",
      outcome: z.outcome, laps: z.laps, clamped: z.clamped,
    });
  }
}
console.table(margin);
console.log("  Every CARRY row that fails has a nonzero clamped count and every carry");
console.log("  row that orbits has zero. (The round rows fail at every margin with no");
console.log("  clamping at all -- that is Check 3's cause, not this one, and the two");
console.log("  are independent.) The legal momentum set is every component within +-R,");
console.log("  which is a hexagon and not a circle, so the longest available vector");
console.log("  changes with heading. An orbit has to hold |p| steady while the heading");
console.log("  turns a full lap, so a run that starts on the boundary gets shaved at");
console.log("  some headings and not others -- a systematic speed leak, one-sided,");
console.log("  because slower means inward and 1/r^2 means the next tick pulls harder.");
console.log("");
console.log("  This is a fact about the HARNESS, not about the physics: nothing in the");
console.log("  laws says a primitive starts at the edge of its own momentum range. But");
console.log("  it is worth one line in law 1, because the shape of the legal set is a");
console.log("  consequence of the field widths, and a world that puts matter near that");
console.log("  boundary will see the same leak. That belongs in README as a question.");

// ======================================================================
// Checks 6 to 8 -- how strong is gravity, and how strong is it allowed to be?
// (Added 2026-11-05. Ric: "I have a hunch gravity is too strong right now.")
//
// Nothing in the five documents gives gravity a strength. It is constant #1
// in the search space with no value, and the only number law 3 states about
// it is an upper bound: gravity between two ADJACENT primitives must be
// negligible against the weakest bond -- "orders of magnitude, not a factor
// of two". Check 1 above never had to choose a strength, because it solves
// for whatever gm makes its start circular. So a strength was chosen for it,
// silently, eighteen times -- the same way law 2's cap of 8 and law 3's
// cutoff radius were chosen. Check 6 reads off what it chose. Check 7 finds
// the strength the energy budget needs, which is the bound law 3 never wrote:
// gravity is "where the energy comes from", so it must be strong enough that
// collapse heats matter past its weakest bond, or chemistry never runs.
// Check 8 asks whether anything orbits at a strength the filter allows.
//
// The unit everything is stated in: EPS, the energy two kind-255 primitives
// release falling together into contact, in units of the weakest bond.
// Law 3's filter is EPS << 1.
// ======================================================================

const KE_SCALE     = 64;              // S, law 1, adopted 2026-11-04
// KE = floor(S * Q(p) / 2k) and Q is the UN-halved square, Q = 2|p|^2, so one
// classical unit of p^2/2k is 2S units of energy. Gravity's work arrives in
// classical units, so this is the conversion -- and it is 2S, not S.
const ENERGY_PER   = 2 * KE_SCALE;
const KIND_MAX     = 255;
const KIND_MEAN    = 128;             // seeded uniform over 1-255, README item 18
const B_WEAKEST    = 1;               // law 2: B = 8 - |v1 + v2 - 8|, weakest bond
const B_STRONGEST  = 8;               //        and strongest
const WORLD_SITES  = 4096 * 4096;     // the World
const HEX_DENSITY  = 2 / Math.sqrt(3);// hexagon centres per unit area at spacing 1
const FILTER       = [0.01, 0.1];     // "orders of magnitude": two, and the loosest reading, one
const SAMPLE_SITES = 300;             // sites sampled per disc for the mean potential
const DISC_RADII   = [16, 32, 64, 128, 256];  // radii summed exactly over the lattice

// G in the units the run() engine uses (gm = G * mass in kinds), from EPS.
const gFromEps = (eps) => (eps * B_WEAKEST) / (ENERGY_PER * KIND_MAX * KIND_MAX);
const epsFromG = (g) => (g * ENERGY_PER * KIND_MAX * KIND_MAX) / B_WEAKEST;

// Hexagon centres inside a disc of radius a, in cartesian units, by count.
function discSites(a) {
  const pts = [], rows = Math.ceil(a / SQ3H) + 1;
  for (let r = -rows; r <= rows; r++) {
    for (let q = -2 * rows; q <= 2 * rows; q++) {
      const x = q + r / 2, y = SQ3H * r;
      if (x * x + y * y <= a * a) pts.push([x, y]);
    }
  }
  return pts;
}

// --------------------------------------------- check 6: what Check 1 chose
console.log("");
console.log("=== Check 6: the strength of gravity Check 1 chose without saying so ===");
console.log("  Check 1 sets gm so its start is circular. gm = G x (mass at the centre),");
console.log("  and the file never says what is at the centre, so here are both ends:");
console.log("  one kind-255 primitive, and a packed kind-255 disc filling the orbit.");
const chose = [];
for (const r0 of RADII) {
  const R = 15, p0mag = mag(scl([0, -1, 1], R)) * START_FRAC;
  const gm = (p0mag / KIND_ORBITER) ** 2 * r0;
  const discMass = discSites(r0 - 1).length * KIND_MAX;
  chose.push({
    r0, range: "+-" + R, gm: Number(gm.toFixed(4)),
    "EPS, one primitive": Number(epsFromG(gm / KIND_MAX).toFixed(0)),
    "EPS, packed disc": Number(epsFromG(gm / discMass).toFixed(3)),
  });
}
console.table(chose);
console.log("  Read as a point mass -- which is how the engine treats it -- gravity in");
console.log("  Check 1 is 565 to 14,000 times STRONGER than the weakest bond, and 70 to");
console.log("  1,800 times stronger than the strongest. Law 3's filter rejects every one");
console.log("  of those runs before it starts. Read instead as the densest thing that");
console.log("  could sit inside the orbit, none passes the filter at two orders of");
console.log("  magnitude; r=100 and r=500 pass at one. So the hunch is right about the");
console.log("  evidence: the orbits in Check 1 ran at a gravity the laws do not allow,");
console.log("  unless the centre is a packed clump nearly as wide as the orbit, and");
console.log("  nothing set one up. Check 1 still answers ITS question -- what the lattice");
console.log("  does to an orbit -- but it says nothing about orbits at a legal strength.");
console.log("  Check 8 does.");

// ------------------------------------- check 7: the floor law 3 never wrote
// Collapse turns potential into heat, and heat is what breaks bonds: a bond
// breaks when e >= B * kind, i.e. temperature >= B. So the energy budget
// needs collapse to lift temperature to at least B_WEAKEST somewhere.
//
// The heat available is the binding energy of the clump. Starting from
// matter spread infinitely thin (the upper bound -- any real seeding starts
// with some of it already spent), packing N primitives into a disc releases
//     W = ENERGY_PER * G * sum over pairs k_i k_j / d_ij
// and once that heat is shared evenly the temperature is W / (sum of kinds):
//     T = ENERGY_PER * G * KIND_MEAN * phiMean / 2
// where phiMean is the mean over sites of sum_j 1/d_ij -- pure geometry, and
// measured here by summing over real lattice discs rather than assumed.
console.log("");
console.log("=== Check 7: the floor -- how strong gravity must be to heat anything ===");
const geo = [];
for (const a of DISC_RADII) {
  const P = discSites(a), N = P.length;
  let phiSum = 0;
  const rnd = seeded(TIE_SEED);
  for (let n = 0; n < SAMPLE_SITES; n++) {
    const [xi, yi] = P[Math.floor(rnd() * N)];
    for (const [x, y] of P) {
      const d2 = (x - xi) ** 2 + (y - yi) ** 2;
      if (d2 > 0) phiSum += 1 / Math.sqrt(d2);
    }
  }
  // the pull on a site at the rim, summed exactly -- 1/r^2 in 2D has no
  // shell theorem, so the rim field is NOT the point-mass field and must be
  // summed rather than assumed
  let rim = 0, bd = Infinity;
  P.forEach(([x, y], i) => { const d = Math.hypot(x - a, y); if (d < bd) { bd = d; rim = i; } });
  let fx = 0, fy = 0;
  for (const [x, y] of P) {
    const dx = x - P[rim][0], dy = y - P[rim][1], d2 = dx * dx + dy * dy;
    if (d2 > 0) { const d = Math.sqrt(d2); fx += dx / (d2 * d); fy += dy / (d2 * d); }
  }
  geo.push({ a, sites: N, phiPerA: phiSum / SAMPLE_SITES / a, rimField: Math.hypot(fx, fy) });
}
console.table(geo.map((g) => ({ a: g.a, sites: g.sites,
  "mean potential / a": g.phiPerA.toFixed(3), "rim pull (geometric)": g.rimField.toFixed(2) })));

// mean potential is linear in a (the ratio column settles); the rim pull is
// logarithmic (it gains the same amount every doubling). Extrapolate each by
// its own measured shape from the two widest discs.
const g1 = geo[geo.length - 2], g2 = geo[geo.length - 1];
const PHI_PER_A = g2.phiPerA;                          // still rising slightly: conservative
const RIM_PER_DOUBLING = g2.rimField - g1.rimField;
const phiMean = (a) => PHI_PER_A * a;
const rimField = (a) => g2.rimField + RIM_PER_DOUBLING * Math.log2(a / g2.a);
const tempRise = (eps, a) => ENERGY_PER * gFromEps(eps) * KIND_MEAN * phiMean(a) / 2;
const epsFor = (T, a) => T / tempRise(1, a);
const A_WORLD = Math.sqrt(WORLD_SITES / (Math.PI * HEX_DENSITY));

console.log(`  Mean potential grows as ${PHI_PER_A.toFixed(2)} x a; the rim pull gains ` +
            `${RIM_PER_DOUBLING.toFixed(2)} per doubling.`);
console.log(`  The whole World packed into one disc has radius ${A_WORLD.toFixed(0)}.`);
console.log("");
const floorRows = [];
for (const [label, a] of [["a clump of radius 64", 64], ["a clump of radius 256", 256],
                          ["a clump of radius 1024", 1024], ["the whole World, one clump", A_WORLD]]) {
  floorRows.push({
    "collapse into": label,
    "T reached at EPS 0.01": Number(tempRise(0.01, a).toFixed(3)),
    "T reached at EPS 0.1": Number(tempRise(0.1, a).toFixed(3)),
    "EPS for T = 1": Number(epsFor(B_WEAKEST, a).toFixed(3)),
    "EPS for T = 8": Number(epsFor(B_STRONGEST, a).toFixed(2)),
  });
}
console.table(floorRows);
console.log("  T is temperature (energy per unit of kind); a bond of strength B breaks");
console.log("  at T >= B, so T = 1 is the first bond breaking anywhere and T = 8 is every");
console.log("  bond. These are UPPER bounds: they assume matter starts infinitely thin.");
console.log("");
console.log("  THE FILTER AND THE FLOOR DO NOT OVERLAP AT 4096^2. At two orders of");
console.log("  magnitude (EPS 0.01) the entire World collapsing into a single ball --");
console.log("  the one outcome the project chose 1/r^2 to avoid -- warms to about a");
console.log("  tenth of the weakest bond. Nothing breaks, so nothing reacts: a frozen");
console.log("  world. Even the loosest reading of the filter (one order, EPS 0.1) only");
console.log("  reaches T = 1 for the single global clump, and every smaller clump stays");
console.log("  frozen. For clumps of a few hundred hexagons -- the 'many local");
console.log("  collapses' law 3 is for -- gravity has to be as strong as the bonds.");
console.log("");
console.log("  So the plan's problem is not that gravity is too strong. It is that the");
console.log("  plan asks two things of one number and the World is too small for both:");
console.log("  weak against a bond at arm's length, strong enough summed over a clump to");
console.log("  melt one. The ratio between those is the clump's size, so the floor falls");
console.log("  as 1/a -- reality gets 10^36 of headroom from 10^57 atoms in a star.");

// ------------------------------------------ check 7b: rounding, settled
console.log("");
console.log("  And it settles README item 19's ROUND rule. The strongest pull anywhere is");
console.log("  on a kind-255 primitive at the rim of a packed kind-255 disc. Rounding");
console.log("  lets gravity act only where that pull reaches half a unit per tick:");
const roundRows = [];
for (const [label, field] of [["one neighbour, touching", 1],
                              ["rim of a clump of radius 256", rimField(256)],
                              ["rim of the whole World, one clump", rimField(A_WORLD)]]) {
  const dpPerEps = gFromEps(1) * KIND_MAX * KIND_MAX * field;   // momentum per tick per EPS
  roundRows.push({ "pulled by": label,
    "|dp| per tick at EPS 0.1": Number((0.1 * dpPerEps).toExponential(2)),
    "EPS for rounding to act": Number((0.5 / dpPerEps).toFixed(1)) });
}
console.table(roundRows);
console.log("  Under rounding, gravity does anything at all only when it is several");
console.log("  times STRONGER than the weakest bond, everywhere in the World, which the");
console.log("  filter forbids. Rounding is not a cutoff radius at a legal strength; it is");
console.log("  gravity switched off. If law 3 exists, it carries the remainder.");

// -------------------------------- check 8: does anything orbit when legal?
// A packed clump of mean kind, treated as a point mass from outside (only
// fair well outside it -- no shell theorem here), with the orbiter at 1.5a.
// The control is the same gm with continuous momentum; rule 12 again.
console.log("");
console.log("=== Check 8: orbits at a strength the filter allows ===");
console.log("  A packed clump of mean kind 128, the orbiter starting circular at 1.5x");
console.log("  its radius. Integer momentum, lattice steps, carried gravity, coin ties,");
console.log(`  ${SEEDS.length} seeds each (rule 11). The control is continuous momentum.`);
const legal = [];
for (const eps of FILTER) {
  for (const a of [100, 300, 1000]) {
    const r0 = 1.5 * a;
    const gm = gFromEps(eps) * discSites(a).length * KIND_MEAN;
    for (const k of [KIND_MAX, 64]) {
      const base = { r0, R: 15, gm, k, latticeSteps: true, surface: a };
      const ctl = run({ ...base, integerMomentum: false, carry: false });
      const real = SEEDS.map((seed) => run({ ...base, integerMomentum: true, carry: true, seed }));
      legal.push({ EPS: eps, clump: a, r0, orbiter: k,
        "|p0|": Number((k * Math.sqrt(gm / r0)).toFixed(2)),
        control: ctl.outcome,
        "orbited 10 laps": `${real.filter((z) => z.outcome === "ORBITED").length} of ${SEEDS.length}`,
        "otherwise": [...new Set(real.filter((z) => z.outcome !== "ORBITED").map((z) => z.outcome))].join(", ") || "-" });
    }
  }
}
console.table(legal);
console.log("  The control orbits in every row, so the harness is not why an integer row");
console.log("  fails. What decides the integer rows is |p0|: orbital speed goes as");
console.log("  sqrt(EPS x a) and momentum is speed times kind. Under about 4 units, one");
console.log("  unit of momentum is too coarse to steer with and the orbiter mostly hits");
console.log("  the clump or leaves -- the +-3 box of Check 4 from the other side.");
console.log("  Over about 10 it is past the safe part of the +-15 box and Check 5's");
console.log("  clamp leak takes it in. Between, it orbits, and the closest approach");
console.log("  wanders from lap to lap -- a random walk from the coin, not a decay -- so");
console.log("  an orbit near its clump survives some seeds and not others.");
console.log("");
console.log("  So weak gravity does not rule orbits out. At a legal strength only the");
console.log("  heaviest kinds orbit, only around the largest clumps, and not forever.");
console.log("  Kind 64 orbits nowhere on this table.");

// ------------------------------------------ check 9: the tie-break, kept
console.log("");
console.log("=== Check 9: the tie-break that made a spiral look like physics ===");
console.log("  Integer momentum and lattice steps together, +-15, carried gravity, with");
console.log("  ties between two step directions broken the old way (always the first");
console.log("  in DIRS) and the new way (a fair coin).");
const tieRows = [];
for (const r0 of RADII) {
  for (const tie of [TIE_FIRST, TIE_COIN]) {
    const z = run({ r0, R: 15, integerMomentum: true, latticeSteps: true, carry: true, tie });
    tieRows.push({ r0, tie, outcome: z.outcome, laps: z.laps,
      "closest, lap 1": z.close1, "closest, last lap": z.closeN });
  }
}
console.table(tieRows);
console.log("  With the first-in-list rule every orbit spirals in: its closest approach");
console.log("  falls lap after lap until it hits the centre. With a coin the closest");
console.log("  approach holds. The only difference is which way an exact tie goes --");
console.log("  2 to 4 percent of steps. A fixed rule is a handedness: the path leans");
console.log("  the same way every time, which is the 'preferred direction in the");
console.log("  physics' AGENTS.md rule 6 warns about, arriving through the step rule");
console.log("  instead of the gravity solver. LAW 1 SAYS NOTHING ABOUT TIES, and an");
console.log("  engine written from it would pick one silently. It has to say.");
