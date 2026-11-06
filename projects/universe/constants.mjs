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
// Eight bytes, 2026-11-04. kind 8 + bonds 6 + energy 16 + momentum 10 = 40
// of 64. The 24 spare bits are RESERVED: nothing goes in them without an
// entry in THE-LAWS.md and a reason (rule 5), and not gravity's remainder.
export const WIDTHS = {
  KIND_BITS:      8,    // bits -- a primitive's kind, 1..255; 0 means not matter
  BONDS_BITS:     6,    // bits -- one per neighbour; in vacuum, one per in-flight direction
  ENERGY_BITS:   16,    // bits -- heat held by a primitive
  MOMENTUM_BITS: 10,    // bits -- two signed cube components, 5 each
};

export const KIND_MAX       = (1 << WIDTHS.KIND_BITS) - 1;    // 255
export const ENERGY_MAX     = (1 << WIDTHS.ENERGY_BITS) - 1;  // 65535
export const MOMENTUM_RANGE = 15;   // +-R on each cube component (law 1, 2026-11-04)
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
  N:             258,   // hexagons per axis -- 66,564 cells
  BLOCK_SIZE:      3,   // hexagons per Margolus block
  BLOCK_OFFSETS:   3,   // partition offsets, cycled so information crosses
};

// ------------------------------------------------------------- the settled
export const SETTLED = {
  // Law 1's kinetic-energy scale. KE(p,k) = floor(S * Q(p) / 2k).
  // Adopted 2026-11-04. The measured window is 2..291; law 1 says why 64.
  KE_SCALE: 64,

  // Law 2's valence modulus. v(k) = k mod 8, B = 8 - |v1 + v2 - 8|.
  // This is a searched constant carrying a chosen value: THE-LAWS.md calls 8
  // "the version to build first, not a proof it is right", and README item 17
  // retracts the one attempt to improve on it. It sits here rather than in
  // SEARCHED because a value IS chosen and the slate is held in reserve --
  // but it is the first thing to vary if the Lab comes back flat.
  BOND_MODULUS: 8,
};

export const KE_SCALE_WINDOW = [2, 291];   // measured in law 1; outside it, KE misbehaves

// ------------------------------------------------------------ the searched
// NULL on purpose. See the header. Supply a full set to run.
export const SEARCHED = {
  // Law 4. A primitive may be bonded to at most C of its six neighbours.
  // One global number, so every kind has identical capacity and all
  // differentiation comes from law 2. Whether it should vary by kind is open.
  CAPACITY: null,                 // bonds, integer 0..6

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
  // NOT IN README'S LIST OF SEVEN. Found 2026-11-05 while writing this file:
  // law 2 requires this number, the search space does not count it, and no
  // document gives it a value. Either it is an eighth searched constant or it
  // folds into the clock -- that is a question for Ric, not for this file to
  // settle, so it is null like the rest and the engine refuses to run without
  // it. Logged as a README item rather than quietly given a value.
  BOND_FORM_PROB: null,           // probability 0..1

  // Law 3. Not used by the Lab -- gravity is deliberately held out, because a
  // measurement needs controlled conditions. Here for completeness, and
  // because rule 8 says ONE module.
  //
  // THE-LAWS.md: the strength has a ceiling (eps << 1, or gravity contaminates
  // chemistry) AND a floor (collapse must heat matter past the weakest bond or
  // chemistry never runs). At 4096 squared the floor is above the ceiling, so
  // as of 2026-11-05 no strength passes both. README item 20, Ric's call.
  GRAVITY_EPS:     null,          // energy two kind-255 release falling to contact, over weakest bond
  GRAVITY_FALLOFF: null,          // the exponent in 1/r^n
};

export const SEARCHED_RANGES = {
  CAPACITY:        [1, 6],
  TRANSPORT_RATE:  [0, 1],
  CLOCK_SCALE:     [0, 1 / TEMPERATURE_MAX],
  CLOCK_FLOOR:     [0, 1],
  BOND_FORM_PROB:  [0, 1],
  GRAVITY_EPS:     [0, 1],
  GRAVITY_FALLOFF: [1, 3],
};

// Which of the searched constants the Lab actually needs. Gravity is not on
// this list, and that absence is law 3 being held out, not an oversight.
export const LAB_REQUIRES = [
  "CAPACITY", "TRANSPORT_RATE", "CLOCK_SCALE", "CLOCK_FLOOR", "BOND_FORM_PROB",
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
export const THERMOSTAT_SWEEP = {
  HOT_T:  [4, 4096],   // the range a sweep should cover
  COLD_T: [0, 64],
};

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
  // there are, nor the bond field's width.
  if (!Number.isInteger(c.CAPACITY) || c.CAPACITY < 1 || c.CAPACITY > DIRECTIONS) {
    problems.push("CAPACITY must be an integer in 1.." + DIRECTIONS + "; got " + c.CAPACITY + ".");
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
  CAPACITY:        3,
  TRANSPORT_RATE:  0.5,
  CLOCK_SCALE:     CZ_SCALE,
  CLOCK_FLOOR:     CZ_SCALE * TEMPERATURE_MAX / 16,   // the 16:1 spread law 5 suggests
  BOND_FORM_PROB:  0.25,
  GRAVITY_EPS:     null,
  GRAVITY_FALLOFF: null,
};
