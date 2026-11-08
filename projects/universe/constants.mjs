// constants.mjs -- every physics constant in this world, in one place.
//
// AGENTS.md rule 8: "The constants are the search space. They live in one
// module, named, with their units and plausible ranges. No magic numbers
// inline, anywhere." This is that module. Nothing else in the project may
// write a physical number into a rule body.
//
// Three kinds of number live here and they are kept apart on purpose:
//
//   WIDTHS    the hexagon word's field sizes. AGENTS.md rule 5: a width is
//             physics here, not implementation. One of these silently chose
//             law 2's bond cap once, so they are stated, not assumed.
//   SETTLED   constants with a chosen value and a reason, each naming it.
//   SEARCHED  the search space. These are NULL. The engine refuses to run
//             until a caller supplies them, because inventing one and
//             letting it look chosen is the exact failure README item 17
//             and rule 12's fourth lesson are both about.
//
// Nothing here is named after anything in our universe (rule 3).

// --------------------------------------------------------------- the widths
// Eight bytes, 2026-11-04. kind 8 + bonds 6 + energy 16 + momentum 14 = 44
// of 64, and 20 spare. The spare bits are RESERVED: nothing goes in them
// without an entry in THE-LAWS.md and a reason (rule 5), and not gravity's
// remainder.
//
// MOMENTUM WENT FROM 10 BITS TO 14 on 2026-11-06 -- +-15 to +-63 per cube
// component. Ric's call, README item 20, and it is a change to the PHYSICS
// rather than to a buffer size (rule 5). What forced it: with gravity bolted
// onto the Lab from outside, the symmetric clamp refused every pull it was
// offered -- 562,344 attempts, not one impulse landed, because the world was
// already near +-15 and every legal move was taken. Item 20 had predicted
// exactly this from the energy side: the infall speed at the rim of a clump
// depends on temperature alone, and at T = 1 it is faster than any kind above
// 110 can carry inside +-15, which is 81% of the seeded mass. +-63 lets every
// kind carry the fall that melts the WEAKEST bond; +-127 would carry the
// strongest and was the other option on the table.
//
// AND IT MOVES LAW 1'S ENERGY WINDOW, which is the cost. KE = floor(S*Q/2k)
// and Q grows as the square of the component range, so KE_SCALE_WINDOW was
// measured at +-15 and does not transfer. See KE_SCALE_WINDOW below.
export const WIDTHS = {
  KIND_BITS:      8,    // bits -- a primitive's kind, 1..255; 0 means not matter
  BONDS_BITS:     6,    // bits -- one per neighbour; in vacuum, one per in-flight direction
  ENERGY_BITS:   16,    // bits -- heat held by a primitive
  MOMENTUM_BITS: 14,    // bits -- two signed cube components, 7 each (2026-11-06)
};

export const KIND_MAX       = (1 << WIDTHS.KIND_BITS) - 1;    // 255
export const ENERGY_MAX     = (1 << WIDTHS.ENERGY_BITS) - 1;  // 65535
export const MOMENTUM_RANGE = 63;   // +-R on each cube component (law 1; 15 -> 63 on 2026-11-06)
export const DIRECTIONS     = 6;    // hexagon neighbours; also vacuum's in-flight slots

// The hottest temperature any hexagon can reach. Temperature is e/kind, so
// the maximum is a kind-1 primitive holding the whole energy field. The
// clock's no-clip filter is asserted against THIS, not against the heaviest
// kind's 257, because the filter has to hold everywhere.
export const TEMPERATURE_MAX = ENERGY_MAX;   // 65535, at kind 1

// ----------------------------------------------------------------- the Lab
// THE-LAWS.md, structural facts: the Lab is a hexagonal torus, N x N in
// axial coordinates, and N MUST be a multiple of 3 because collisions
// resolve in three-hexagon blocks that only tile across the seam when 3
// divides N. 258 is the nearest such size at or above the planned 256.
export const LAB = {
  // The shortest distance to a hexagon's edge that tracked stepping (law 1,
  // README item 34) will divide by. A path that clips a corner can come
  // within a billionth of a spacing of its next edge, and if a bond refuses
  // that crossing the primitive would retry a billion times faster than
  // anything else and eat the whole run -- the first tracked run did exactly
  // that, 387,477 refusals in 400,000 events. A numerical guard, not
  // physics: it slows only corner-clipping crossings, and lab-check.mjs
  // Check 13 measures that a free primitive's average speed is unharmed.
  TRACK_EDGE_FLOOR: 1 / 16,   // hexagon spacings
  N:             258,   // hexagons per axis -- 66,564 cells
  BLOCK_SIZE:      3,   // hexagons per Margolus block
  BLOCK_OFFSETS:   3,   // partition offsets, cycled so information crosses
};

// ------------------------------------------------------------- the settled
export const SETTLED = {
  // Law 1's kinetic-energy scale. KE(p,k) = floor(S * Q(p) / 2k).
  //
  // 64 -> 4 ON 2026-11-06, AND THIS IS FORCED, NOT CHOSEN. Widening momentum
  // to +-63 raised the largest legal Q from 450 to 7938 -- 17.64x -- and the
  // window's ceiling is the S at which a KIND-1 primitive at full speed
  // overflows the 16-bit energy field, so the ceiling falls by the same
  // factor. The window went from 2..291 to 1..16 and 64 LEFT IT. Running on
  // at 64 would have meant a fast light primitive coming to a dead stop
  // overflowing the field as a matter of routine.
  //
  // 4 is then picked by S=64's OWN three stated reasons, which are in law 1:
  // a power of two; every kind from 1 to 255 gets a usable amount; and the
  // largest kinetic energy stays a modest share of the energy field so a dead
  // stop can dump into an already-warm hexagon. At +-63, S=4 puts that share
  // at 24.2% against the 22% that S=64 gave at +-15 -- the same world, re-
  // scaled. S=16 would be legal and sits at 96.9%, which is the failure the
  // third reason exists to avoid.
  //
  // Measured, with the method first reproducing the documented 2..291 before
  // being trusted on 1..16. Item 20 predicted this cost in advance: "either
  // moves law 1's kinetic-energy window, so S = 64 would need re-measuring."
  KE_SCALE: 4,

  // Law 2's valence modulus. v(k) = k mod 8, B = 8 - |v1 + v2 - 8|.
  // This is a searched constant carrying a chosen value: THE-LAWS.md calls 8
  // "the version to build first, not a proof it is right", and README item 17
  // retracts the one attempt to improve on it. It sits here rather than in
  // SEARCHED because a value IS chosen and the slate is held in reserve --
  // but it is the first thing to vary if the Lab comes back flat.
  BOND_MODULUS: 8,

  // Law 1's stepping (README item 34; Ric, 2026-11-06: "I'm fine with the
  // added state it's not much"). "nearest" rounds every step to the nearest
  // of six directions, with a coin on a tie -- the rule until 2026-11-06,
  // which gives matter six headings and random-walks a tied path. "track"
  // keeps each primitive's true position inside its hexagon and moves it into
  // the hexagon its straight-line path enters next (Amanatides & Woo), at a
  // rate of speed over the distance to that edge. Not a searched constant:
  // a choice between two forms of the law, kept switchable so they can be
  // compared.
  STEPPING: "track",
};

// RE-MEASURED 2026-11-06 for +-63. Both ends are derived from law 1's own
// definitions, so this is measurement rather than preference:
//   floor    the smallest S at which the HEAVIEST kind reads KE >= 1 somewhere
//   ceiling  the largest S at which a KIND-1 primitive at full speed still
//            fits the 16-bit energy field
// Largest legal Q went 450 -> 7938 (at the vector (-63, 0, 63)), so the
// ceiling fell by that factor and the floor reached 1.
//
// The superseded pair is kept rather than overwritten: at +-15 it was [2, 291],
// and before the eight-byte word it was [29, 227]. Three widths, three windows,
// which is rule 5 in one line -- a width is physics, and this is the physics it
// was quietly setting.
export const KE_SCALE_WINDOW = [1, 16];    // at +-63; was [2, 291] at +-15, [29, 227] at +-3

// ---------------------------------------------------- law 4, derived by kind
// CAPACITY STOPPED BEING ONE GLOBAL NUMBER on 2026-11-06. Ric's call on README
// item 6: "per kind". The item's own objection to a global number is that every
// kind then holds the same number of bonds, so nothing has a valence -- and
// valence is most of what gives our chemistry its shape.
//
// The form reads the SAME valence law 2 reads, v(k) = k mod BOND_MODULUS, and
// clamps it into law 4's legal 1..6. Nothing new is stored and no table is
// typed by hand, which is rule 2: this is derived from kind exactly as B is.
//
// What falls out of it, unasked, is the argument for this form over an
// arbitrary one:
//   v = 0  capacity 1, and B(0,0) = 0 -- monovalent, and it cannot bond to its
//          own kind at all. Its one good partner is v = 7, at B = 7.
//   v = 4  capacity 4, and B(4,4) = 8 -- tetravalent and its own best partner,
//          which is the shape carbon chemistry is built on.
//   v = 7  capacity 6 but B(7,7) = 2 -- many weak bonds, a gas-like corner.
// None of that was put in. It is what reading law 2's own valence for law 4
// produces, and it is an argument rather than a proof.
//
// IT IS CANDIDATE FORM ONE AND HAS NOT BEEN SCREENED. Law 2's form earned its
// place against ten rivals in screen.mjs, on measured spread, family count,
// roughness and the diagonal maximum. This has earned nothing yet, and it
// belongs in the same harness before it is called settled (README item 6).
export const capacityOf = (k, c = SETTLED) =>
  Math.min(6, Math.max(1, k % c.BOND_MODULUS));

// ------------------------------------------------------------ the searched
// NULL on purpose. See the header. Supply a full set to run.
export const SEARCHED = {
  // Law 4's CAPACITY IS GONE FROM HERE as of 2026-11-06. It is no longer a
  // number to search: it is capacityOf(k) above, derived from the same valence
  // law 2 reads. Worth stating plainly because the arithmetic looks like a
  // coincidence and is not one -- removing CAPACITY and naming BOND_FORM_PROB
  // on the same day leaves the count unchanged. One constant became a form; a
  // different one that had been running unnamed got a name.

  // Law 5's transport rate: the probability that a clock fire moves one unit
  // of energy to the chosen colder neighbour.
  TRANSPORT_RATE: null,           // probability 0..1

  // The clock. rate(T) = CLOCK_FLOOR + CLOCK_SCALE * T. Must be strictly
  // increasing in T and must never saturate.
  CLOCK_SCALE: null,              // rate per unit temperature, > 0
  CLOCK_FLOOR: null,              // rate at absolute zero, > 0 so cold is slow not frozen

  // Law 2's formation probability. THE-LAWS.md: "A bond forms with a fixed
  // probability when the clock fires -- never instantly on contact."
  //
  // SETTLED 2026-11-06: a searched constant in its own right, not a fold into
  // the clock. Ric's call on README item 28, which this file raised on
  // 2026-11-05 after finding that law 2 needs the number, no document gave it
  // one, and the search space did not count it.
  //
  // Why not the clock: the clock sets how OFTEN a site acts, and this sets
  // WHICH act happens when it does -- the same fire may bond, transport, share
  // momentum or now kick. Folding them would make one number do two jobs, and
  // law 2 would have had to say so in writing. Different job, own name.
  BOND_FORM_PROB: null,           // probability 0..1

  // Law 1's THERMAL KICK -- the probability that a clock fire attempts to turn
  // heat into motion. NEW MACHINERY, 2026-11-06, and new machinery costs a
  // constant: that is rule 7's price, paid out loud rather than absorbed.
  // README item 29 found that heat never becomes motion here, so the clock's
  // fourth job -- thermal pressure -- did not follow from the laws. Ric's call
  // was to connect them, with the mechanism: "can't just make one hexagon
  // start moving. make them move in pairs, in opposite directions. One goes
  // left, its neighbour goes right. Add them up, you get zero."
  //
  // That pairing is what makes it a law rather than a momentum leak, and it is
  // the same trick law 1 already uses for a bonded pair's exchange. See
  // tryThermalKick in lab.mjs.
  THERMAL_KICK_PROB: null,        // probability 0..1

  // Law 3. USED BY NEITHER ENGINE AS OF 2026-11-08, and kept here rather than
  // deleted because the law is still true of the universe and rule 8 says one
  // module holds every constant.
  //
  // One hexagon is one atom (README item 40), and at that scale the whole
  // sheet's self-gravity is about 10^-24 of one of its own bonds: the strength
  // that would matter needs 3x10^22 hexagons, and the hardware holds 2.1
  // billion. So there is no value to search for here at any size this project
  // can run, and leaving these null is the honest state rather than an
  // oversight. The old reading -- a ceiling (eps << 1 or gravity contaminates
  // chemistry) above a floor (collapse must melt a bond) with no room between
  // them at 4096 squared -- is still in README item 20, now with the sweep
  // that confirmed it from the other direction.
  GRAVITY_EPS:     null,          // energy two kind-255 release falling to contact, over weakest bond
  GRAVITY_FALLOFF: null,          // the exponent in 1/r^n
};

export const SEARCHED_RANGES = {
  TRANSPORT_RATE:  [0, 1],
  CLOCK_SCALE:     [0, 1 / TEMPERATURE_MAX],
  CLOCK_FLOOR:     [0, 1],
  BOND_FORM_PROB:  [0, 1],
  THERMAL_KICK_PROB: [0, 1],
  GRAVITY_EPS:     [0, 1],
  GRAVITY_FALLOFF: [1, 3],
};

// Which of the searched constants the Lab actually needs. Gravity is not on
// this list, and that absence is law 3 being held out, not an oversight.
export const LAB_REQUIRES = [
  "TRANSPORT_RATE", "CLOCK_SCALE", "CLOCK_FLOOR", "BOND_FORM_PROB",
  "THERMAL_KICK_PROB",
];

// ------------------------------------------------------- the clock, derived
export const clockRate = (c, temperature) => c.CLOCK_FLOOR + c.CLOCK_SCALE * temperature;

// The causal limit, expressed as a rate in continuous time.
//
// THIS IS A CHOICE AND IT IS NOT IN ANY DOCUMENT. Flagged 2026-11-05 while
// writing lab.mjs. Law 1 states speed as "one hexagon every k/|p| TICKS,
// capped at one per tick", and the locality fact states the causal limit as
// "one hexagon per TICK". The Lab has no tick -- TWO-RUNS.md puts it in
// event-driven continuous time on purpose -- so "per tick" has no referent
// here and something has to supply one.
//
// The reading taken: the causal limit is the rate of the FASTEST CLOCK the
// world can have, which is the clock at TEMPERATURE_MAX. Then nothing
// outruns the hottest matter, radiation rides exactly at the limit as the
// structural fact says, and the limit is derived from constants that already
// exist rather than being a new number. It is still a choice, and the Lab's
// numbers depend on it, so it belongs in README as a question.
export const causalRate = (c) => clockRate(c, TEMPERATURE_MAX);

// ---------------------------------------------- the Lab's held conditions
// Not physics constants -- these are the experiment's independent variables.
// TWO-RUNS.md: "The Lab sweeps conditions; it does not pick one." So these
// are defaults for a single run, and a sweep varies them and records the
// regime each species was found in.
export const THERMOSTAT_DEFAULT = {
  HOT_T:       64,   // temperature held in the hot band
  COLD_T:       1,   // temperature held in the cold band
  BAND_ROWS:    3,   // axial rows each band occupies
};
// THE HOTTEST HOLDABLE BAND, derived rather than typed (README item 30, fixed
// 2026-11-06). A held band sets every hexagon in it to HOT_T x kind, so with
// kind-255 matter about the band cannot go past ENERGY_MAX / KIND_MAX = 257
// -- and it cannot sit AT that either, or the next quantum of radiation to
// arrive has nowhere to go. The - 1 is that headroom: a kind-255 primitive
// held at 256 has 255 units of room. lab-check.mjs Check 11 measures how much
// of that room arriving energy actually uses, so the margin is a measurement,
// not a hope. This range said [4, 4096] until 2026-11-06, a sweep that would
// have crashed at its first step past 257.
export const HOT_T_MAX = Math.floor(ENERGY_MAX / KIND_MAX) - 1;   // 256

export const THERMOSTAT_SWEEP = {
  HOT_T:  [4, HOT_T_MAX],   // the range a sweep may cover, for any seeded mix of kinds
  COLD_T: [0, 64],
};

// Refuse a held condition the engine could not hold, BEFORE the run rather
// than thousands of events into it (rule 8: reject a bad set at startup).
// Checked against KIND_MAX because the Lab seeds every kind; a run that seeds
// only light kinds could hold a hotter band, and that is a different
// experiment that would need its own, stated, limit.
export function validateThermostat(t) {
  const problems = [];
  if (!(t.BAND_ROWS > 0)) return problems;           // no bands, nothing held
  for (const name of ["HOT_T", "COLD_T"]) {
    const T = t[name];
    if (!(Number.isInteger(T) && T >= 0)) {
      problems.push(name + " must be a whole temperature >= 0, got " + T + ".");
    } else if (T > HOT_T_MAX) {
      problems.push(name + " = " + T + " cannot be held: x kind " + KIND_MAX + " is "
        + T * KIND_MAX + ", and the band needs room under the " + ENERGY_MAX
        + " energy field for arriving radiation, so the most is " + HOT_T_MAX
        + " (README item 30).");
    }
  }
  return problems;
}

// ------------------------------------------------- the hard filters (rule 8)
// "Assert both at startup and refuse to run." Each rejects a constant set
// without running it, which is rule 12 -- screen before you simulate.
export function validateForLab(c) {
  const problems = [];

  for (const name of LAB_REQUIRES) {
    if (c[name] === null || c[name] === undefined) {
      problems.push(name + " is not set. It is a searched constant with no chosen value; "
        + "supply one. Range " + JSON.stringify(SEARCHED_RANGES[name]) + ".");
    }
  }
  if (problems.length) return problems;   // the rest would read undefined

  // FILTER 1 -- the clock must not clip. The rate is a probability, so it
  // saturates at 1, and above the clip two hexagons at different temperatures
  // act equally often: net radiative flow goes to zero and its DIRECTION
  // becomes a coin flip. The second law does not degrade gracefully there, it
  // switches off -- measured at 10 of 20 seeds running uphill.
  const rateMax = clockRate(c, TEMPERATURE_MAX);
  if (!(rateMax <= 1)) {
    problems.push("the clock clips: CLOCK_FLOOR + CLOCK_SCALE * " + TEMPERATURE_MAX
      + " = " + rateMax + " > 1, so above the clip the second law switches off. "
      + "Do not loosen this to get a run going.");
  }

  // FILTER 2 -- strictly increasing, never flat.
  if (!(c.CLOCK_SCALE > 0)) {
    problems.push("CLOCK_SCALE must be > 0: a flat clock transports exactly nothing, because "
      + "sight lines on this lattice are reciprocal and the net flow is then exactly zero.");
  }
  if (!(c.CLOCK_FLOOR > 0)) {
    problems.push("CLOCK_FLOOR must be > 0, or the coldest matter is frozen rather than slow "
      + "and its clock never fires at all.");
  }

  // FILTER 3 -- capacity is a count of bonds and cannot exceed the neighbours
  // there are, nor the bond field's width. Since 2026-11-06 capacity is a FORM
  // rather than a number (capacityOf, above), so the filter checks the form
  // across every kind that can exist instead of checking one value. A form that
  // returned 0 for some kind would make that kind permanently inert -- which is
  // exactly the heavy-matter failure item 15 was about, arriving from law 4
  // instead of from a field width.
  {
    const bad = [];
    for (let k = 1; k <= KIND_MAX; k++) {
      const cap = capacityOf(k, c);
      if (!Number.isInteger(cap) || cap < 1 || cap > DIRECTIONS) bad.push(k + "->" + cap);
      if (bad.length >= 4) break;
    }
    if (bad.length) {
      problems.push("capacityOf must give an integer in 1.." + DIRECTIONS
        + " for every kind 1.." + KIND_MAX + "; it does not: " + bad.join(", ") + ".");
    }
  }

  // FILTER 4 -- the KE scale must sit inside its measured window, or heavy
  // kinds read zero kinetic energy at any momentum.
  if (SETTLED.KE_SCALE < KE_SCALE_WINDOW[0] || SETTLED.KE_SCALE > KE_SCALE_WINDOW[1]) {
    problems.push("KE_SCALE " + SETTLED.KE_SCALE + " is outside its measured window "
      + KE_SCALE_WINDOW.join("..") + ".");
  }

  // FILTER 5 -- the torus only tiles if 3 divides N (checked by brute force
  // in THE-LAWS.md: 255, 258 and 4098 tile; 256, 257 and 4096 break).
  if (LAB.N % LAB.BLOCK_SIZE !== 0) {
    problems.push("LAB.N " + LAB.N + " is not a multiple of " + LAB.BLOCK_SIZE + ", so the "
      + "collision blocks do not tile across the seam and the loop is a wall nobody wrote down.");
  }

  return problems;
}

// One arbitrary point in the search space, so the engine can be exercised at
// all. IT IS SCREENED BY NOTHING. It is not a proposal, it is not a default,
// and no result from it means anything about the physics until the Lab has
// swept the space properly. Named ZERO because it is where a search starts,
// not because it is good.
const CZ_SCALE = 1 / (TEMPERATURE_MAX * 2);        // leaves headroom under the clip
export const CANDIDATE_ZERO = {
  ...SETTLED,
  TRANSPORT_RATE:  0.5,
  CLOCK_SCALE:     CZ_SCALE,
  CLOCK_FLOOR:     CZ_SCALE * TEMPERATURE_MAX / 16,   // the 16:1 spread law 5 suggests
  BOND_FORM_PROB:    0.25,
  THERMAL_KICK_PROB: 0.25,
  GRAVITY_EPS:     null,
  GRAVITY_FALLOFF: null,
};
