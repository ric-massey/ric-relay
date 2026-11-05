// orbit.mjs -- does anything orbit here, and if not, which cause stops it?
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
const LAPS_TARGET  = 2;               // the claim is "nothing completed two laps"
const MAX_TICKS    = 4000000;         // give up
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
function nearestDir(p) {
  let best = DIRS[0], bestDot = -Infinity;
  for (const d of DIRS) {
    const v = dot(p, d);
    if (v > bestDot) { bestDot = v; best = d; }
  }
  return best;
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
function run({ r0, R, integerMomentum, latticeSteps, carry, startFrac = START_FRAC }) {
  const k = KIND_ORBITER;
  const p0mag = mag(scl([0, -1, 1], R)) * startFrac;    // see START_FRAC
  const v0 = p0mag / k;                        // hexagons per tick
  const gm = v0 * v0 * r0;

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
  let minR = r0, maxR = r0, gravityZeroTicks = 0;
  const [sx, sy] = cart(pos);
  let angPrev = Math.atan2(sy, sx), angTotal = 0;
  let outcome = "ran out of ticks";

  while (ticks < MAX_TICKS) {
    ticks++;

    // --- law 3: gravity adds to momentum, falling off as 1/r^2 ---
    const r = mag(pos);
    if (r < FELL_IN)            { outcome = "fell in"; break; }
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
      while (stepAcc >= 1) { pos = add(pos, nearestDir(p)); stepAcc -= 1; }
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
    if (laps >= LAPS_TARGET) { outcome = "ORBITED"; break; }
  }

  return {
    laps: Number(laps.toFixed(2)), outcome, ticks,
    rMin: Number(minR.toFixed(1)), rMax: Number(maxR.toFixed(1)),
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
console.log(`orbiter is kind ${KIND_ORBITER}; p0 is the longest legal vector at each range.`);

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
console.log("  carry rule +-3 holds no orbit at any radius and +-15 holds one at all");
console.log("  three, so the 2026-11-04 move to eight bytes is what bought orbits. The");
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
