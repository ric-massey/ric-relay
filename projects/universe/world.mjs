// world.mjs -- the World. The second of the two runs, and the one that is
// meant to be lived in rather than measured: a sheet of matter with an edge,
// no thermostat, and no held conditions anywhere.
//
// ONE HEXAGON IS ONE ATOM. Nothing in this project said so until 2026-11-08,
// and every argument about gravity was downstream of that silence. Ric settled
// it with the question the whole thing turned on -- "think about how much DNA
// gets affected by gravity, and how many atoms are in DNA" -- and with the
// scale declared, two of this file's four differences from the Lab had to go.
//
// FOUR THINGS WENT IN ON 2026-11-09, when Ric asked for a world he could start
// and leave running. Each is written up where it lives:
//
//   COLLISIONS          law 1's, which the Lab has always had and this file
//   (collide)           never did. Without them matter that met matter stopped
//                       for ever, and a hot gas took 519 steps in 20,000 ticks.
//   LIGHT IS ABSORBED   by matter that steps into it, as in the Lab. It used to
//   (step)              block the step, so warm matter could not move through
//                       its own radiation.
//   THE WALL ANSWERS    matter at the edge is turned back and the wall's
//   (bounce)            momentum is counted, which is rule 6's own instruction.
//   A LIT EDGE          light IN through one side: a held condition, off unless
//   (receiveAtEdge)     a run asks. It is the only thing here that is not a
//                       correction, and the "no held conditions" below is true
//                       of every run that does not ask for it.
//
// Also that day: a World can be put down and picked up exactly (checkpoint,
// restore), and a one-unit hole in how light moves was found and closed
// (propagateAll).
//
// Read TWO-RUNS.md, THE-LAWS.md and AGENTS.md before changing anything here.
// What this file is NOT is a bigger Lab. Three things differ, and each is a
// decision written down somewhere rather than a convenience:
//
//   TICKED TIME.        The Lab uses event-driven continuous time where
//                       nothing ever skips. The World uses per-tick update
//                       probability (TWO-RUNS.md, "Cross-validate the time
//                       scheme") because a queue costs 50-100x at the cell
//                       counts this needs. Law 1 was WRITTEN in ticks -- "one
//                       hexagon every k/|p| ticks, capped at one per tick" --
//                       so here it is the original and the Lab's GAP 1 is the
//                       approximation, which is the reverse of how it looks.
//   NO THERMOSTAT.      The Lab holds a hot band and a cold band. The World
//                       holds nothing. Chemistry supplies the heat and the
//                       edge takes it away.
//   THE SPACE HAS AN    The Lab is a torus with no edge, so nothing ever
//   EDGE.               leaves it. The World is a bounded sheet: a quantum of
//                       radiation that steps off is GONE -- counted on the way
//                       out, never seen again. That edge is the World's only
//                       sink, and README item 22 said all along that the shape
//                       is what decides the heat sink.
//
// TWO THINGS CAME OUT ON 2026-11-08, and both removals are the scale talking:
//
//   GRAVITY (law 3).    A sheet of 4.26 million atoms has a self-gravitational
//                       binding energy around 10^-42 J, against ~5x10^-19 J for
//                       one chemical bond: gravity is 10^-24 of a single bond.
//                       The crossing point, where the whole sheet's gravity is
//                       worth one bond, is near 3x10^22 hexagons -- a lattice
//                       180 billion a side. The hardware reaches 2.1 billion
//                       cells. So gravity is not weak here, it is absent, and
//                       a dial that made it visible was 10^22 out. It also
//                       cost three quarters of every tick and paid out
//                       17,120,848 units of manufactured energy in the one
//                       long run (README items 20, 35 and 37).
//   EXPANSION.          It was the only sink and far too small -- 102,936 units
//                       drained against 23 million of heat, and it switched off
//                       the moment the space hit its cap. The edge replaces it
//                       (README items 22 and 36).
//
// Rules this file stands under, each marked where it bites:
//
//   rule 2   nothing stored that should emerge. No species field, no cluster
//            id, no temperature field.
//   rule 5   integers for everything conserved. Energy and momentum are
//            integers, with no float anywhere in the state: fine momentum went
//            out with gravity, which is the only thing that ever made a
//            fraction.
//   rule 6   conservation asserted, and with one sink the invariant is as
//            strict as the Lab's. Energy leaves only through the edge and is
//            counted as it goes: see Ledger.
//   rule 7   "Prefer removing." Five laws became four here.
//   rule 8   no physics number in this file.
//   rule 9   nothing reads past a site's immediate neighbours. With gravity
//            gone there is no exception left to argue about.

import {
  SETTLED, WIDTHS, KIND_MAX, ENERGY_MAX, MOMENTUM_RANGE, DIRECTIONS,
  clockRate, causalRate, validateForLab, CANDIDATE_ZERO,
  capacityOf, validateInflow,
} from "./constants.mjs";

// ------------------------------------------------------------- the lattice
// Pointy-top axial, the same arrangement the Lab uses and the same bond-bit
// order. The size is NOT fixed here: the World grows, so cols and rows are
// state rather than constants.
const DIR_CUBE = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
const DIR_AXIAL = DIR_CUBE.map(([x, , z]) => [x, z]);
const opposite = (d) => (d + 3) % DIRECTIONS;

// FOR EACH DIRECTION, IS THE HEXAGON AHEAD AT A HIGHER INDEX? With
// i = r * cols + q a step of (dq, dr) changes the index by dr * cols + dq, so
// the sign is dr's, and dq's when dr is zero. propagateAll needs this to walk
// each line of light head first (2026-11-09; the reason is written there).
const AHEAD_IS_HIGHER = DIR_AXIAL.map(([dq, dr]) => dr > 0 || (dr === 0 && dq > 0));

// WHICH WAY IN, for each side a World may be lit from (the inflow, below).
// One direction per side: the one that runs straight along a row or a column
// of the axial sheet, so light entering at an edge hexagon crosses the sheet
// on that hexagon's own line and nothing has to be chosen per quantum.
const dirOf = (dq, dr) => DIR_AXIAL.findIndex(([a, b]) => a === dq && b === dr);
const INFLOW_SIDES = {
  west:  { dir: dirOf(1, 0),  cells: (w) => Array.from({ length: w.rows }, (_, r) => r * w.cols) },
  east:  { dir: dirOf(-1, 0), cells: (w) => Array.from({ length: w.rows }, (_, r) => r * w.cols + w.cols - 1) },
  north: { dir: dirOf(0, 1),  cells: (w) => Array.from({ length: w.cols }, (_, q) => q) },
  south: { dir: dirOf(0, -1), cells: (w) => Array.from({ length: w.cols }, (_, q) => (w.rows - 1) * w.cols + q) },
};

const MOD = SETTLED.BOND_MODULUS;
const KE_SCALE = SETTLED.KE_SCALE;

// How many depth bands sample() reports temperature in. This is a RESOLUTION,
// not a physics number (rule 8): it says how finely a run is willing to look at
// its own skin, the way the sample interval says how often. Eight because the
// smallest World anyone runs is 96 across, which gives each band six hexagons
// of depth to average over.
const BANDS = 8;

const bindingEnergy = (k1, k2) => MOD - Math.abs((k1 % MOD) + (k2 % MOD) - MOD);
const popcount6 = (b) => { let n = 0; for (let d = 0; d < DIRECTIONS; d++) if (b & (1 << d)) n++; return n; };

// Marsaglia xorshift, the generator SOURCES.md credits. One per run, seeded.
function makeRng(seed) {
  let x = (seed | 0) || 1;
  const next = () => { x ^= x << 13; x |= 0; x ^= x >>> 17; x ^= x << 5; x |= 0; return x >>> 0; };
  return {
    u32: next,
    u01: () => next() / 4294967296,
    below: (n) => next() % n,
    // The whole of the generator is one 32-bit word, so a run can be put down
    // and picked up exactly where it was (World.checkpoint, 2026-11-09).
    state: () => x,
    restore: (v) => { x = (v | 0) || 1; },
  };
}

// ================================================================= the world
// FIVE ARRAYS, SIX BYTES A HEXAGON, and they are exactly the Lab's. There were
// eight until 2026-11-08: fineX and fineY carried gravity's sub-unit pull in
// units of 2^-32 (item 19) and phi was law 3's potential, and all three went
// out with gravity. What is left is the same six bytes snapshot.mjs has always
// written to disk and the viewer has always read, so the frame format did not
// have to change when the engine did.
//
// The word in THE-LAWS.md packs the same state into eight bytes -- kind 8,
// energy 16, momentum 14, bonds 6 -- and these arrays spend two bytes on
// momentum where the word spends fourteen bits. That is the one place the
// engine is looser than the word, and it is deliberate: a byte per component
// is addressable and 7 bits is not.
function makeWorld(cols, rows) {
  const n = cols * rows;
  return {
    cols, rows, cells: n,
    kind:   new Uint8Array(n),
    energy: new Uint16Array(n),
    mx:     new Int8Array(n),
    my:     new Int8Array(n),
    bonds:  new Uint8Array(n),
  };
}

// OFF THE SHEET IS NOT MATTER, and this one comparison is why the edge did not
// have to be threaded through twenty call sites. Without it `isMatter(w, -1)`
// reads w.kind[-1], which is `undefined`, and `undefined !== 0` is TRUE -- so
// every "is my neighbour matter?" test in the engine would have answered yes
// at the boundary, and bonds would have formed with the outside.
const isMatter = (w, i) => i >= 0 && w.kind[i] !== 0;
const qOf = (w, i) => i % w.cols;
const rOf = (w, i) => (i - (i % w.cols)) / w.cols;

// The one neighbour lookup. The World loops both ways, as the Lab does --
// README item 22's shape question is open and this is the provisional
// direction, so it is recorded in the run's `space` block and can change
// without anything else here changing.
// THE EDGE LIVES HERE AND NOWHERE ELSE, which is the whole point of putting it
// in this one function: -1 means "off the sheet". Until 2026-11-08 this wrapped
// both axes and the World was a torus; now a step off the side returns -1 and
// every caller has to say what that means for it. Radiation says "gone, and
// counted". Everything else says "not there", which is the same answer it gives
// for vacuum or for a neighbour it cannot use.
//
// A guard this cheap is worth having in one place: the alternative, four
// if-statements per caller, is how a seam goes quietly wrong (rule 6).
function neighbour(w, i, d) {
  const [dq, dr] = DIR_AXIAL[d];
  const q = qOf(w, i) + dq, r = rOf(w, i) + dr;
  if (q < 0 || q >= w.cols || r < 0 || r >= w.rows) return -1;
  return r * w.cols + q;
}

// ---------------------------------------------------- derived, never stored
const tempOf = (w, i) => (w.kind[i] ? (w.energy[i] / w.kind[i]) | 0 : 0);
const Qof = (w, i) => { const x = w.mx[i], y = w.my[i], z = -x - y; return x * x + y * y + z * z; };
const keAt = (w, i) => (w.kind[i] ? ((KE_SCALE * Qof(w, i)) / (2 * w.kind[i])) | 0 : 0);
// The same number for a momentum a hexagon does not have yet, which is what
// the exchanges below need to price a hop BEFORE taking it. Truncated the same
// way as keAt, deliberately: if the two rounded differently, every exchange
// would leak a unit or two past the ledger.
const keOf = (x, y, k) => (k ? ((KE_SCALE * (x * x + y * y + (-x - y) * (-x - y))) / (2 * k)) | 0 : 0);
const legalMomentum = (x, y) =>
  Math.abs(x) <= MOMENTUM_RANGE && Math.abs(y) <= MOMENTUM_RANGE &&
  Math.abs(-x - y) <= MOMENTUM_RANGE;

// ================================================================= the books
// rule 6, and as of 2026-11-08 it is as strict as the Lab's. The invariant is
//
//     heat + kinetic + in flight + bond potential + radiated away  =  constant
//
// and every term on the left is an integer. It used to carry an expansion loss
// and a gravitational potential as well: the first because creating space
// destroys energy, the second because a force that adds momentum adds kinetic
// energy and it has to come from somewhere. Both are gone, and the second was
// worth the trouble it caused -- it is a counter with no floor, so the books
// closed however much energy gravity invented, and one long run manufactured
// 17 million units before anything noticed (README item 35).
//
// "Radiated away" is the only channel out, and it is counted one quantum at a
// time as it crosses the edge. Nothing else can leave: matter never steps off
// the sheet, and radiation in this physics carries energy without momentum.
// MOMENTUM: world + wall is exactly constant. It was "exactly constant, no
// term at all" until 2026-11-09, which was true only because matter at the
// edge was refused rather than answered; see World.bounce.
function census(w) {
  let matter = 0, heat = 0, kinetic = 0, inFlight = 0, px = 0, py = 0, bondEnds = 0, bonded = 0;
  for (let i = 0; i < w.cells; i++) {
    if (w.kind[i] !== 0) {
      matter += w.kind[i];
      heat += w.energy[i];
      kinetic += keAt(w, i);
      px += w.mx[i]; py += w.my[i];
      const b = popcount6(w.bonds[i]);
      bondEnds += b;
      if (b) bonded++;
    } else {
      inFlight += popcount6(w.bonds[i]);
    }
  }
  return { matter, heat, kinetic, inFlight, px, py, bonds: bondEnds / 2, bonded };
}

class Ledger {
  constructor(w) {
    const c = census(w);
    this.matter0 = c.matter;
    this.energy0 = c.heat + c.kinetic + c.inFlight;
    this.px0 = c.px;
    this.py0 = c.py;
    this.bondPotential = 0;       // released on forming, absorbed on breaking
    // RADIATED AWAY. The one way out, counted on the way out. A quantum that
    // steps off the sheet is added here and removed from the lattice in the
    // same statement (propagateAll), which is what makes "it left" different
    // from "it leaked" -- and the difference is the whole of rule 6.
    this.escaped = 0;
    // RECEIVED. The one way in, and it is zero unless a run is lit (the
    // inflow, 2026-11-09): a quantum that enters at the lit edge is added
    // here in the same statement that puts it on the lattice. With it the
    // invariant reads
    //     heat + kinetic + in flight + bond potential + radiated away
    //                                             - received  =  constant
    // and a run with no inflow has received 0 for ever, which is the old
    // invariant unchanged.
    this.received = 0;
    // THE WALL'S MOMENTUM. Matter that reaches the edge is turned back
    // (World.bounce, 2026-11-09) and the wall takes twice what it carried.
    // Rule 6: "keep wall momentum as an integer vector and assert world
    // momentum + wall momentum = constant."
    this.wallX = 0; this.wallY = 0;
  }
  check(w, label) {
    const c = census(w);
    const energy = c.heat + c.kinetic + c.inFlight + this.bondPotential + this.escaped
      - this.received;
    if (c.matter !== this.matter0) {
      throw new Error(`${label}: matter ${c.matter} was ${this.matter0}`);
    }
    if (energy !== this.energy0) {
      throw new Error(`${label}: energy ${energy} was ${this.energy0} `
        + `(heat ${c.heat} kinetic ${c.kinetic} flight ${c.inFlight} `
        + `bonds ${this.bondPotential} radiated ${this.escaped} received ${this.received})`);
    }
    if (c.px + this.wallX !== this.px0 || c.py + this.wallY !== this.py0) {
      throw new Error(`${label}: momentum (${c.px}, ${c.py}) + wall (${this.wallX}, ${this.wallY}) `
        + `was (${this.px0}, ${this.py0}) -- every exchange and every collision is equal and `
        + `opposite, the wall counts what it turns back, and radiation carries no momentum`);
    }
  }
}

// =================================================================== the run
export class World {
  constructor({
    cols = 258, rows = 258, seed = 1,
    constants = CANDIDATE_ZERO,
    // A HELD CONDITION, NOT A LAW, and absent unless a run asks for it: light
    // entering through one edge. See receiveAtEdge.
    inflow = null,
  } = {}) {
    // The multiple-of-three requirement went with the torus. It was there
    // because collisions resolve in three-hexagon Margolus blocks, which only
    // tile across a SEAM when 3 divides the side -- and a bounded sheet has no
    // seam. Keeping a constraint whose reason has gone is how a document ends
    // up disagreeing with the code (rule 5, "a width is physics"), so it is
    // recorded here rather than left standing. If the shape ever loops again,
    // this comes back with it.
    const refusals = validateForLab(constants);
    if (refusals.length) {
      throw new Error("REFUSING TO RUN. " + refusals.length + " constant problem(s):\n  - "
        + refusals.join("\n  - "));
    }
    if (inflow && inflow.rate > 0) {
      const problems = validateInflow(inflow);
      if (!INFLOW_SIDES[inflow.side]) {
        problems.push(`inflow side "${inflow.side}" is not one of ${Object.keys(INFLOW_SIDES).join(", ")}`);
      }
      if (problems.length) throw new Error("REFUSING TO RUN. " + problems.join("; "));
      this.inflow = { rate: inflow.rate, side: inflow.side };
    } else this.inflow = null;
    this.c = constants;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.w = makeWorld(cols, rows);
    this.tick = 0;
    this.causal = causalRate(constants);
    this.counts = {
      stepped: 0, blocked: 0, collided: 0, tooColdToMove: 0,
      // LAW 1'S COLLISIONS, carried across from the Lab on 2026-11-09 (see
      // collide). `collided` sat here at 0 from the day this file was written
      // and printed as if it were a measurement; it was an absence.
      // `collisionDead` is a collision with no legal outcome in 64 draws, and
      // `collisionNoRoom` is one whose shed heat would not fit, which the
      // World declines where the Lab throws. `bounced` is matter turned back
      // at the edge (bounce), and `blockedFull` is the one step that still
      // simply does not happen: light in the way and no room to absorb it.
      collisionDead: 0, collisionNoRoom: 0, bounced: 0, blockedFull: 0,
      // quanta picked up by matter stepping into them, counted in `absorbed`
      // as well -- this is the part of `absorbed` that motion did
      sweptUp: 0,
      bondsFormed: 0, bondsBroken: 0, bondsStretched: 0,
      // Steps taken by a primitive that was bonded at the time -- the direct
      // measure of whether clusters move at all. The World ran without it
      // until 2026-11-07 and therefore could not see that it had frozen: a
      // 1500-tick run took 19,389 steps against 2,626,838 gravity carries and
      // nothing in the output said why. The Lab's counter of the same name is
      // the reason the Lab knows its own number (~14,500 per million events).
      bondedStepped: 0,
      // The bond's reaction to a refused step (pushAlongBond), and the three
      // ways the exchange seam can decline it. Each refusal is counted apart
      // because they mean different things -- law 1's field width, matter too
      // cold to pay, and the heat ceiling.
      pushedAlongBond: 0, pushRangeDeclined: 0, pushUnaffordable: 0, pushNoRoom: 0,
      conducted: 0, emitted: 0, absorbed: 0, quantaMoved: 0,
      // law 1 exchanges. Each refusal has its OWN counter because the three
      // reasons mean different things: "range" is law 1 field width being hit,
      // "unaffordable" is matter too cold to move, "noRoom" is the heat field
      // ceiling. Lumping them would hide which one a run is telling you about.
      momentumShared: 0, shareRangeDeclined: 0, shareUnaffordable: 0, shareNoRoom: 0,
      thermalKicks: 0, kickRangeDeclined: 0, kickUnaffordable: 0, kickNoRoom: 0,
      kickNoPartner: 0,
      // THE EDGE. `escaped` is quanta that crossed it and are gone, which is
      // the same number the ledger carries; `emittedOff` is matter at the very
      // edge radiating straight out, which never spends a tick in flight at
      // all. They are counted apart because they are different pictures of
      // the same sink: one is the sheet's interior cooling THROUGH its skin,
      // the other is the skin cooling directly.
      escaped: 0, emittedOff: 0,
      // THE LIT EDGE, when there is one. `received` is the ledger's number;
      // `receiveDeclined` is a quantum the edge could not take that tick (the
      // slot was full, or the matter there was at the heat ceiling), which
      // simply did not arrive -- nothing is owed for it.
      received: 0, receiveDeclined: 0,
    };
    this.history = [];
    // A LEDGER FROM THE FIRST TICK, not from the first seed. propagateAll and
    // tryTransport both count escaped energy into it, so it has to exist
    // before anything can run -- an empty world's books are all zeros, and
    // seed_ replaces this one once matter is placed. `seeded` is what run()
    // checks, since "the ledger exists" no longer means "the world was set up".
    this.ledger = new Ledger(this.w);
    this.seeded = false;
  }

  // ------------------------------------------------------------ law 2, bonds
  breakBondsIfHot(i) {
    const w = this.w;
    if (!w.bonds[i]) return;
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(w.bonds[i] & (1 << d))) continue;
      const j = neighbour(w, i, d);
      if (!isMatter(w, j)) continue;
      const B = bindingEnergy(w.kind[i], w.kind[j]);
      if (tempOf(w, i) < B && tempOf(w, j) < B) continue;
      // breaking ABSORBS B, taken from the endpoint that is hot enough
      const payer = tempOf(w, i) >= B ? i : j;
      if (w.energy[payer] < B) continue;
      w.energy[payer] -= B;
      this.ledger.bondPotential += B;
      w.bonds[i] &= ~(1 << d);
      w.bonds[j] &= ~(1 << opposite(d));
      this.counts.bondsBroken++;
    }
  }

  tryFormBond(i) {
    const w = this.w;
    if (this.rng.u01() >= this.c.BOND_FORM_PROB) return;
    if (popcount6(w.bonds[i]) >= capacityOf(w.kind[i], SETTLED)) return;
    const d = this.rng.below(DIRECTIONS);
    if (w.bonds[i] & (1 << d)) return;
    const j = neighbour(w, i, d);
    if (!isMatter(w, j)) return;
    if (popcount6(w.bonds[j]) >= capacityOf(w.kind[j], SETTLED)) return;
    const B = bindingEnergy(w.kind[i], w.kind[j]);
    if (B < 1) return;
    if (tempOf(w, i) >= B || tempOf(w, j) >= B) return;      // would break at once
    if (w.energy[i] + B > ENERGY_MAX) return;
    w.energy[i] += B;                     // forming RELEASES B as heat
    this.ledger.bondPotential -= B;
    w.bonds[i] |= 1 << d;
    w.bonds[j] |= 1 << opposite(d);
    this.counts.bondsFormed++;
  }

  // ------------------------------------------------------- law 5, transport
  tryTransport(i) {
    const w = this.w;
    if (this.rng.u01() >= this.c.TRANSPORT_RATE) return;
    if (w.energy[i] === 0) return;
    const d = this.rng.below(DIRECTIONS);
    const j = neighbour(w, i, d);
    if (isMatter(w, j)) {
      // the comparison is on TEMPERATURE: e1*k2 against e2*k1, exact integers
      if (w.energy[i] * w.kind[j] <= w.energy[j] * w.kind[i]) return;
      if (w.energy[j] >= ENERGY_MAX) return;
      w.energy[i]--; w.energy[j]++;
      this.counts.conducted++;
      this.counts.quantaMoved++;
      return;
    }
    // STRAIGHT OFF THE SHEET. Matter on the very edge, radiating outward, has
    // nowhere to put the quantum -- there is no hexagon to hold it. It is not
    // blocked and it is not kept: the energy leaves, counted as it goes. This
    // is the skin cooling directly, and without this branch `w.bonds[-1] |= …`
    // would have written to nothing and destroyed the unit in silence, which
    // is the exact shape of leak rule 6 exists to catch.
    if (j < 0) {
      w.energy[i]--;
      this.ledger.escaped++;
      this.counts.emitted++;
      this.counts.emittedOff++;
      return;
    }
    // vacuum: emit one unit as a quantum in flight, travelling in direction d
    if (w.bonds[j] & (1 << d)) return;      // that slot is occupied
    w.energy[i]--;
    w.bonds[j] |= 1 << d;
    this.counts.emitted++;
  }

  // A quantum crosses vacuum in a straight line at the causal limit -- ONE
  // hexagon per tick, which means the whole light field moves at once, from a
  // copy. Moving them in the same shuffled pass as matter let a quantum be
  // found again further along the same tick and travel several hexagons,
  // which is the causal limit broken by an implementation detail.
  //
  // HEAD FIRST, AND THAT ORDER IS AN ACCOUNTING RULE (2026-11-09). This used
  // to be one pass over the hexagons in index order, every direction at once,
  // and it could lose a unit: a quantum that cannot move ("the absorber is
  // full", or "the slot ahead is taken") is written back where it stood -- but
  // if the quantum BEHIND it had been looked at first, that one had already
  // stepped into the same slot, the write-back found the bit set, and two
  // quanta became one. One unit of energy gone, no error, and only for light
  // travelling toward higher indices behind a hexagon at the heat ceiling,
  // which is why it would take a long run to meet. AGENTS.md carried "a
  // stream reached tick 569,750 and the books were off by one unit ... and
  // it is unfound"; whether that run died of exactly this cannot be shown,
  // because it ran under gravity and its settings were not kept, but this is
  // a one-unit hole of the right shape and world-check.mjs Check 12 holds it
  // shut. The fix moves nothing differently when nothing is blocked: each
  // line of light is walked from its head backwards, so the quantum in front
  // has always been decided before the one behind it asks.
  propagateAll() {
    const w = this.w;
    if (!this.flight || this.flight.length !== w.cells) this.flight = new Uint8Array(w.cells);
    const was = this.flight;
    for (let i = 0; i < w.cells; i++) { was[i] = isMatter(w, i) ? 0 : w.bonds[i]; }
    for (let i = 0; i < w.cells; i++) if (!isMatter(w, i)) w.bonds[i] = 0;

    let up = 0, down = 0;                   // the directions each pass handles
    for (let d = 0; d < DIRECTIONS; d++) { if (AHEAD_IS_HIGHER[d]) up |= 1 << d; else down |= 1 << d; }
    // ahead is at a higher index: walk downward, so the head of a line is first
    for (let i = w.cells - 1; i >= 0; i--) { const s = was[i] & up; if (s) this.moveQuanta(i, s); }
    // ahead is at a lower index: walk upward
    for (let i = 0; i < w.cells; i++) { const s = was[i] & down; if (s) this.moveQuanta(i, s); }
  }

  moveQuanta(i, slots) {
    const w = this.w;
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(slots & (1 << d))) continue;
      const j = neighbour(w, i, d);
      // THE SINK. A quantum that steps off the sheet is gone: added to the
      // one counter that is allowed to grow and not written anywhere on the
      // lattice. This is the only line in the engine that removes energy
      // from the world, and the only reason the World can cool at all.
      if (j < 0) { this.ledger.escaped++; this.counts.escaped++; continue; }
      if (isMatter(w, j)) {
        if (w.energy[j] < ENERGY_MAX) { w.energy[j]++; this.counts.absorbed++; }
        else w.bonds[i] |= 1 << d;            // absorber full: it waits here
      } else if (w.bonds[j] & (1 << d)) {
        w.bonds[i] |= 1 << d;                 // the slot ahead is taken
      } else {
        w.bonds[j] |= 1 << d;
        this.counts.quantaMoved++;
      }
    }
  }

  // ------------------------------------------------- the lit edge (a condition)
  // LIGHT COMES IN THROUGH ONE EDGE. Added 2026-11-09, off unless a run asks,
  // and it is a HELD CONDITION in the sense TWO-RUNS.md uses the words -- not
  // a sixth law, and not a thermostat either.
  //
  // WHY IT EXISTS. The World has one sink (the edge) and one source (law 2,
  // which pays out once per bond). So every World ends the same way: it bonds,
  // it radiates what the bonding released, and it stops. A cold 96x96 sheet
  // was measured doing exactly that on 2026-11-08 -- 54% of everything it ever
  // had gone out through the edge, 89.1% bonded, mean temperature 0.000 -- and
  // nothing can happen in it afterwards, however long it is left. Ric,
  // 2026-11-09: "i wanted to start a world and let it run and check in on it
  // every once in a while with the chance of something crazy happening". A
  // world that is to keep happening needs energy passing THROUGH it: in at one
  // place, out at another. Item 5's reopening (2026-11-08) had already said
  // the same from the other side: law 2 only selects where matter is warm.
  //
  // WHY THIS SHAPE. The edge already lets light out; this lets light in
  // through one side of it. It uses the radiation the physics has, one quantum
  // at a time, travelling at the causal limit like any other -- no temperature
  // is set anywhere, nothing is held hot, and what the matter does with the
  // light is the four laws' business. (It was expected to leave the sheet warm
  // on the lit side and cold on the far one. Measured the same day, it does
  // not: matter mixes a 64x64 sheet faster than light builds a slope, and the
  // whole sheet warms together -- world-check.mjs Check 17.)
  // The alternatives were a held hot patch (a thermostat: it SETS a
  // temperature, which is the Lab's kind of condition and overrides whatever
  // the matter there was doing) and random hot spots (energy appearing in the
  // interior with no path in, which is the nearest of the three to a leak).
  //
  // WHAT IT COSTS, said out loud (rule 7): one number, the chance per tick
  // that an edge hexagon on the lit side receives a quantum (constants.mjs,
  // INFLOW), and one term in the books (Ledger.received). It reads nothing
  // past the edge hexagon it writes to (rule 9), it is integers (rule 5), and
  // it carries no momentum, as radiation here never does -- so the momentum
  // total is still exactly constant.
  // The brightness may be changed between ticks -- a run's caller is allowed to
  // vary a held condition, as a Lab sweep varies its thermostat -- and it goes
  // through the same refusal the constructor uses. null or 0 turns it off.
  setInflow(inflow) {
    if (!inflow || !(inflow.rate > 0)) { this.inflow = null; return; }
    const problems = validateInflow(inflow);
    if (!INFLOW_SIDES[inflow.side]) problems.push(`inflow side "${inflow.side}" is not a side`);
    if (problems.length) throw new Error("REFUSING. " + problems.join("; "));
    if (!this.inflow || this.inflow.side !== inflow.side) this.litCells = null;
    this.inflow = { rate: inflow.rate, side: inflow.side };
  }

  receiveAtEdge() {
    const w = this.w, { rate, side } = this.inflow;
    const { dir, cells } = INFLOW_SIDES[side];
    const lit = this.litCells || (this.litCells = cells(w));
    for (let n = 0; n < lit.length; n++) {
      if (this.rng.u01() >= rate) continue;
      const i = lit[n];
      if (isMatter(w, i)) {
        // matter standing on the lit edge takes the quantum directly, the
        // mirror of tryTransport's "straight off the sheet"
        if (w.energy[i] >= ENERGY_MAX) { this.counts.receiveDeclined++; continue; }
        w.energy[i]++;
      } else {
        if (w.bonds[i] & (1 << dir)) { this.counts.receiveDeclined++; continue; }
        w.bonds[i] |= 1 << dir;
      }
      this.ledger.received++;
      this.counts.received++;
    }
  }

  // ----------------------------------------------------- law 1, the exchanges
  // TWO WAYS MOMENTUM MOVES BETWEEN NEIGHBOURS WITHOUT ANYTHING TRAVELLING.
  // Ported from the Lab on 2026-11-07 at Ric's instruction. Both are settled
  // physics -- the first is law 1's own second sentence, the second is README
  // item 29 settled on 2026-11-06 -- and the World ran without either, which
  // made it an incomplete physics rather than a different one:
  //
  //   shareMomentum   a bonded pair equalising. This is what lets a bonded
  //                   GROUP respond to a push as a group: something leans on
  //                   one end and the bond carries that momentum through the
  //                   cluster, one hop per clock fire. Without it a cluster is
  //                   not an object, just a set of hexagons that cannot move.
  //                   (It was gravity doing the leaning until 2026-11-08; now
  //                   it is a collision, a thermal kick or a refused step.)
  //   tryThermalKick  heat becoming motion. Without it a primitive with no
  //                   momentum never moves at any temperature, because law 1's
  //                   step rate min(1, |p|/k) does not read heat -- so hot
  //                   matter sat still, which is item 29's measurement.
  //
  // THEY SHARE THEIR ACCOUNTING, and that sharing is the physics rather than a
  // tidiness. Momentum is LINEAR and cancels by construction: one end gains
  // exactly the integer vector the other loses, so the world's total cannot
  // move and there is no preferred direction. Kinetic energy is QUADRATIC and
  // does NOT cancel, so every such exchange changes the total energy of
  // motion, and the difference has to be paid to or from the heat field.
  //
  // Missing that seam cost the Lab 34,864 units over 50,000 events (README
  // item 28) -- no error, nothing visibly wrong, a cluster quietly cooling the
  // world every time it flexed. The World's ledger would catch it the same
  // way. That is why the accounting is written once here and used twice, and
  // why neither function below does its own.

  // A dry run, then a commit, for the reason every transfer in this file does
  // it that way: an exchange that cannot be paid for in full does not happen
  // at all, because declining conserves exactly where clamping would not.
  // Returns null on success, or the reason it did not happen.
  exchange(i, j, nxI, nyI, nxJ, nyJ) {
    const w = this.w;
    // Law 1's range is a field width, and rule 5 says a field must not be
    // papered over. Declining the hop conserves; clipping it would not, and
    // clipping a sub-unit pull is what README item 20 found gravity dying of
    // back when there was a gravity to die.
    if (!legalMomentum(nxI, nyI) || !legalMomentum(nxJ, nyJ)) return "range";

    const keBefore = keAt(w, i) + keAt(w, j);
    const keAfter = keOf(nxI, nyI, w.kind[i]) + keOf(nxJ, nyJ, w.kind[j]);
    const delta = keBefore - keAfter;        // > 0 sheds heat, < 0 needs heat

    // Speeding the pair up costs heat, and the heat has to actually be there.
    // A cold pair simply does not exchange, which is the right physics as well
    // as the right accounting: cold matter should be still.
    if (delta < 0 && w.energy[i] + w.energy[j] < -delta) return "unaffordable";

    // And shedding has to FIT. The Lab THROWS here -- rule 5, "a world that
    // keeps hitting the ceiling is telling you the constants are wrong" --
    // because the Lab is where constants are judged, under a thermostat, at a
    // fixed size. The World has no thermostat and a ceiling collapse can
    // genuinely reach, so it declines the exchange and counts it instead.
    // That conserves exactly, where a clamp would destroy the difference in
    // silence. A run with a large count here is saying what the Lab's throw
    // would say, and the counter is in the output for that reason.
    const room = (ENERGY_MAX - w.energy[i]) + (ENERGY_MAX - w.energy[j]);
    if (delta > 0 && room < delta) return "noRoom";

    w.mx[i] = nxI; w.my[i] = nyI;
    w.mx[j] = nxJ; w.my[j] = nyJ;

    // The heat is spread over BOTH ends rather than dumped on one, so a pair
    // near the ceiling can still exchange where a single hexagon could not.
    // The two branches are each other's mirror, and both assert they finished
    // what the dry run promised.
    let owed = delta > 0 ? delta : -delta;
    const ends = [i, j];
    if (delta > 0) {
      for (const m of ends) {
        const take = Math.min(owed, ENERGY_MAX - w.energy[m]);
        w.energy[m] += take; owed -= take;
        if (owed === 0) break;
      }
    } else if (delta < 0) {
      for (const m of ends) {
        const take = Math.min(owed, w.energy[m]);
        w.energy[m] -= take; owed -= take;
        if (owed === 0) break;
      }
    }
    if (owed !== 0) throw new Error(`exchange could not move ${owed} of ${delta} it had checked for`);
    return null;
  }

  // Law 1, bonded: "a bonded pair exchanges integer momentum toward equalizing
  // their velocities, equal and opposite, one hop per clock fire."
  shareMomentum(i) {
    const w = this.w;
    if (!w.bonds[i]) return;
    // Only bonds to matter. On a matter hexagon every bond bit should point at
    // matter, but the World's space GROWS underneath these arrays, so this
    // reads the lattice rather than trusting it.
    const live = [];
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(w.bonds[i] & (1 << d))) continue;
      if (isMatter(w, neighbour(w, i, d))) live.push(d);
    }
    if (!live.length) return;
    const j = neighbour(w, i, live[this.rng.below(live.length)]);

    // velocity is p/k. Move one unit cube vector from i to j: the one that
    // most reduces the velocity difference, which is the equalising the law
    // asks for. If no direction reduces it, the velocities are already equal
    // and nothing happens.
    const ki = w.kind[i], kj = w.kind[j];
    const gx = w.mx[i] / ki - w.mx[j] / kj;
    const gy = w.my[i] / ki - w.my[j] / kj;
    const gz = (-w.mx[i] - w.my[i]) / ki - (-w.mx[j] - w.my[j]) / kj;
    let best = -1, bestDot = 0;
    for (let e = 0; e < DIRECTIONS; e++) {
      const [ux, uy, uz] = DIR_CUBE[e];
      const dot = ux * gx + uy * gy + uz * gz;
      if (dot > bestDot) { bestDot = dot; best = e; }
    }
    if (best < 0) return;
    const [ux, uy] = DIR_CUBE[best];

    const why = this.exchange(i, j, w.mx[i] - ux, w.my[i] - uy, w.mx[j] + ux, w.my[j] + uy);
    if (why === null) this.counts.momentumShared++;
    else if (why === "range") this.counts.shareRangeDeclined++;
    else if (why === "unaffordable") this.counts.shareUnaffordable++;
    else this.counts.shareNoRoom++;
  }

  // Law 1, the thermal kick. HEAT BECOMES MOTION.
  //
  // Ric's rule, 2026-11-06, and the pairing is the whole of it: "can't just
  // make one hexagon start moving. make them move in pairs, in opposite
  // directions. One goes left, its neighbour goes right. Add them up, you get
  // zero." A single hexagon starting to move is momentum from nowhere, which
  // is law 1's one inviolable thing, and it would be a preferred direction in
  // the physics as well. A pair moving oppositely sums to zero exactly, in
  // integers, with nothing left over.
  //
  // NOTE WHAT IT DOES NOT READ: temperature. Not for its direction, not for
  // its size. It is offered at every clock fire, and the clock ALREADY fires
  // more often when hot -- so hot regions kick more often than cold ones, and
  // that is where thermal pressure comes from, without temperature appearing
  // in this function at all. The World's clock is the same rate the Lab's is
  // (clockRate over the causal limit, per tick), so the mechanism carries over
  // unchanged.
  tryThermalKick(i) {
    const w = this.w;
    if (this.rng.u01() >= this.c.THERMAL_KICK_PROB) return;

    // A partner, and it must be matter. Vacuum cannot take the other half of
    // the pair, so there is nothing to cancel against and the kick is off.
    const d = this.rng.below(DIRECTIONS);
    const j = neighbour(w, i, d);
    if (!isMatter(w, j)) { this.counts.kickNoPartner++; return; }

    // One unit along the cube axes, opposite ways. This is the pairing.
    const [ux, uy] = DIR_CUBE[d];
    const why = this.exchange(i, j, w.mx[i] + ux, w.my[i] + uy, w.mx[j] - ux, w.my[j] - uy);
    if (why === null) this.counts.thermalKicks++;
    else if (why === "range") this.counts.kickRangeDeclined++;
    else if (why === "unaffordable") this.counts.kickUnaffordable++;
    else this.counts.kickNoRoom++;
  }

  // ------------------------------------------------------- law 1, the motion
  // "one hexagon every k/|p| ticks, capped at one per tick", read as a
  // probability per tick -- which is the law's own sentence, not a scheme
  // invented here.
  stepProbability(i) {
    const w = this.w;
    const Q = Qof(w, i);
    if (Q === 0) return 0;
    return Math.min(1, Math.sqrt(Q / 2) / w.kind[i]);
  }

  stepDirection(i) {
    const w = this.w;
    const x = w.mx[i], y = w.my[i], z = -x - y;
    let best = -1, bestDot = 0, ties = 0;
    for (let d = 0; d < DIRECTIONS; d++) {
      const [ux, uy, uz] = DIR_CUBE[d];
      const dot = x * ux + y * uy + z * uz;
      if (dot > bestDot) { bestDot = dot; best = d; ties = 1; }
      else if (dot === bestDot && dot > 0) { ties++; if (this.rng.below(ties) === 0) best = d; }
    }
    return best;
  }

  // ------------------------------------- law 1, a bond reacts to strain
  // PORTED FROM THE LAB 2026-11-07, and the port is a correction rather than
  // an addition: until today this file ran law 1's RETIRED reading, in which
  // a bond is a wall. The Lab settled GAP 3 on 2026-11-06 (lab.mjs moveOne,
  // README item 25) and the World was never brought across, so the two
  // engines were running different physics while TWO-RUNS.md said they ran
  // the same laws with two time schemes.
  //
  // In reality a bond is a force: when two bonded atoms start to separate its
  // tension slows the leading one and speeds the trailing one, equal and
  // opposite, and their relative motion goes into vibration -- heat. So when
  // a step is refused for a bond, one unit of momentum passes along that bond
  // to the partner, in the step's own direction.
  //
  // The transfer is the exchange seam's, unchanged: shareMomentum and
  // tryThermalKick have used it since the World was written, and only the
  // trigger and the direction are new. Nothing here reads past a neighbour.
  pushAlongBond(i, d, stretched) {
    const w = this.w;
    // One of the bonds that refused the step. In reality the push reaches
    // every one of them at once; here one per step IS the wave, because the
    // next step draws again.
    const e = stretched[this.rng.below(stretched.length)];
    const j = neighbour(w, i, e);
    // A bond bit on matter should point at matter, but the World's space grows
    // underneath these arrays, so this reads the lattice rather than trusting
    // it -- the same guard shareMomentum uses.
    if (!isMatter(w, j)) return;
    const [ux, uy] = DIR_CUBE[d];
    const why = this.exchange(i, j, w.mx[i] - ux, w.my[i] - uy, w.mx[j] + ux, w.my[j] + uy);
    if (why === null) this.counts.pushedAlongBond++;
    else if (why === "range") this.counts.pushRangeDeclined++;
    else if (why === "unaffordable") this.counts.pushUnaffordable++;
    else this.counts.pushNoRoom++;
  }

  // GAP 3, AS THE LAB SETTLED IT. The bond holds, the step does not happen,
  // the bond reacts -- and CLUSTERS STILL MOVE, which is the half this file
  // was missing. On a hex lattice i and i+d share two common neighbours, so a
  // bond within 60 degrees of the direction of travel SURVIVES the step: the
  // partner is still adjacent afterwards and the re-pointing below carries it
  // across. Only bonds at 120 and 180 degrees refuse. Transverse motion is
  // free, longitudinal motion is held, and a cluster therefore FLOWS rather
  // than translating -- shear cheap, compression dear, which is the right way
  // round for matter.
  //
  // Breaking is law 2's and only law 2's, by the sharper test it already has
  // in breakBondsIfHot. Motion never breaks a bond here.
  step(i) {
    const w = this.w;
    const d = this.stepDirection(i);
    if (d < 0) { this.counts.tooColdToMove++; return; }
    const j = neighbour(w, i, d);
    // THE EDGE HOLDS MATTER IN. Only light leaves; a primitive that would walk
    // off the sheet is turned back (bounce, below). Without this the move below would
    // write the primitive to index -1 -- which a typed array accepts and
    // discards, so matter would quietly evaporate at the boundary and the
    // matter total would fall. That is a leak with a plausible story attached,
    // which is the kind rule 6 warns is the most dangerous.
    if (j < 0) { this.bounce(i); return; }
    // MATTER IN THE WAY IS A COLLISION, not a wall (2026-11-09, below).
    if (isMatter(w, j)) { this.collide(i, j, d); return; }
    // LIGHT IN THE WAY IS ABSORBED, not an obstacle (2026-11-09). This line
    // used to read "a quantum is there: blocked", so one unit of radiation
    // anywhere in a hexagon stopped any mass at any speed from entering it,
    // and warm matter -- which fills the vacuum around itself with light --
    // could not move through its own glow. The Lab has always had it the
    // other way, which is the radiation fact's own sentence: "it stops at the
    // first matter it meets, which absorbs it" (lab.mjs moveOne). The quanta
    // are collected below, AFTER the step is known to be legal, for the reason
    // the Lab gives: picking them up first and then refusing the step
    // destroyed one unit, and rule 6 caught it as a drift of exactly 1.
    const pickup = w.bonds[j] ? popcount6(w.bonds[j]) : 0;
    // A heat field that could not hold them is the one case that still blocks:
    // declining conserves, and clamping would not (rule 5).
    if (pickup && w.energy[i] + pickup > ENERGY_MAX) {
      this.counts.blocked++; this.counts.blockedFull++; return;
    }

    const carriedBonds = w.bonds[i];
    if (carriedBonds !== 0) {
      const stretched = [];
      for (let e = 0; e < DIRECTIONS; e++) {
        if (!(carriedBonds & (1 << e))) continue;
        const partner = neighbour(w, i, e);
        // After the step, would the partner still be adjacent?
        let stillAdjacent = false;
        for (let f = 0; f < DIRECTIONS; f++) {
          if (neighbour(w, j, f) === partner) { stillAdjacent = true; break; }
        }
        if (!stillAdjacent) stretched.push(e);
      }
      if (stretched.length > 0) {
        this.counts.bondsStretched++;
        this.pushAlongBond(i, d, stretched);
        return;
      }
    }

    // Carry the whole primitive. Bonds that survived have to be re-pointed at
    // the new position, which is what makes this fiddly rather than a swap.
    const survivors = [];
    for (let e = 0; e < DIRECTIONS; e++) {
      if (!(carriedBonds & (1 << e))) continue;
      const partner = neighbour(w, i, e);
      survivors.push(partner);
      w.bonds[partner] &= ~(1 << opposite(e));
    }
    w.kind[j] = w.kind[i]; w.energy[j] = w.energy[i] + pickup;
    w.mx[j] = w.mx[i]; w.my[j] = w.my[i];
    w.bonds[j] = 0;                       // the quanta that stood here are now its heat
    if (pickup) { this.counts.absorbed += pickup; this.counts.sweptUp += pickup; }
    w.kind[i] = 0; w.energy[i] = 0; w.mx[i] = 0; w.my[i] = 0; w.bonds[i] = 0;
    for (const partner of survivors) {
      for (let f = 0; f < DIRECTIONS; f++) {
        if (neighbour(w, j, f) === partner) {
          w.bonds[j] |= (1 << f);
          w.bonds[partner] |= (1 << opposite(f));
          break;
        }
      }
    }
    this.counts.stepped++;
    // A bonded primitive that got here moved WITH its bonds intact, carrying
    // them to the new site. That is a cluster deforming, and counting it is
    // the only direct evidence that clusters move at all.
    if (carriedBonds !== 0) this.counts.bondedStepped++;
  }

  // ------------------------------------------------ law 1, matter at the edge
  // THE EDGE RETURNS MATTER. Added 2026-11-09, in the same change that gave the
  // World its collisions, because the first made the second necessary.
  //
  // Until then "the edge holds matter in" meant the step off the sheet was
  // refused and the primitive kept its momentum -- so it tried again next tick,
  // and the tick after, for ever. While nothing in the World moved, that could
  // not be seen. With collisions it could not be missed: a 64x64 sheet seeded
  // at temperature 12 had 951 of its 1,254 primitives inside the outermost four
  // hexagons after 3,000 ticks, 2.4 million refused steps at the edge behind
  // them, all leaning outward on a boundary that neither let them through nor
  // answered. A wall that takes any push and gives nothing back is a place
  // momentum goes to stop mattering, which is a sink nobody chose.
  //
  // SO THE WALL ANSWERS. A primitive that would step off the sheet has its
  // momentum reversed, exactly: (x, y) becomes (-x, -y). Q is unchanged, so its
  // kinetic energy is unchanged to the unit and no heat changes hands; and the
  // 2p the wall took is COUNTED, in the ledger, which is rule 6's own line --
  // "momentum at a wall or floor: keep wall momentum as an integer vector and
  // assert world momentum + wall momentum = constant". That rule was written
  // for exactly this and had nothing to bind until now. The momentum invariant
  // was "exactly constant, no drain term"; it is now "world + wall, exactly
  // constant", and Ledger.check asserts that form.
  //
  // STRAIGHT BACK, NOT MIRRORED. A mirror would keep the part of the momentum
  // that runs along the edge and reverse only the part across it, which is
  // what a smooth wall does. It was not chosen because the sheet's four sides
  // are not all lines of the lattice's symmetry in axial coordinates, so a
  // mirror would need a different rule for the q edges and the r edges, and a
  // rounding where the mirrored vector is not an integer one. Reversal is one
  // rule for every side and exact for every momentum. It is a choice, and what
  // it costs is that the edge scatters like a rough wall rather than a smooth
  // one. Light still leaves through the edge exactly as before: the wall is
  // for matter only.
  bounce(i) {
    const w = this.w;
    this.ledger.wallX += 2 * w.mx[i];
    this.ledger.wallY += 2 * w.my[i];
    w.mx[i] = -w.mx[i]; w.my[i] = -w.my[i];
    this.counts.blocked++;                  // the step itself did not happen
    this.counts.bounced++;
  }

  // ------------------------------------------------- law 1, the collisions
  // CARRIED ACROSS FROM THE LAB ON 2026-11-09, and like the port of 2026-11-07
  // it is a correction rather than an addition. Law 1 has said since it was
  // written that matter running into matter is a collision -- "any
  // redistribution with the same vector sum is legal ... resolve them in
  // Margolus blocks rather than pairs, so conservation holds by construction"
  // -- and the Lab has resolved them that way from its first day (lab.mjs
  // collide). This file never did. A primitive that met another one simply did
  // not move, kept every unit of its momentum, and tried again next tick, for
  // ever.
  //
  // WHAT THAT DID, measured the day it was found (64x64, fill 0.30, seeded at
  // temperature 12 where no bond can stand, 20,000 ticks): 519 steps taken
  // against 9,333,810 refused, while the thermal kick went on turning heat
  // into momentum that nothing could spend -- mean |p| climbed from 2.8 to
  // 53.9, against law 1's range of 63, and 270,207 units of energy stood as
  // motion in a world where nothing moved. Every primitive drifted until it
  // touched something and then leaned on it. A gas could not be a gas. This is
  // the same shape as the freeze of 2026-11-07 (a bond as a wall: 19,389 steps
  // against 2.6 million carries) and it survived that fix because the counter
  // that would have shown it, `collided`, printed 0 and 0 reads as physics.
  //
  // THE RULE IS THE LAB'S, unchanged: the block is the triangle of three
  // mutually adjacent hexagons that holds i and j, chosen between the two by a
  // coin (a fixed pick is a handedness -- item 21); the matter in it has its
  // momentum redrawn at random with the same vector sum; an outcome is legal
  // if every momentum is inside law 1's range and the change in kinetic energy
  // can be paid out of the heat that is actually in the block. Momentum is
  // conserved by construction, because the last member takes whatever the
  // others left.
  //
  // TWO THINGS DIFFER FROM THE LAB, and each is the World's standing habit
  // rather than a new choice:
  //
  //   the edge   the third hexagon may be off the sheet, and then it is simply
  //              not in the block -- the same answer isMatter gives everywhere.
  //   the heat   shed kinetic energy is spread over the block's members and
  //   ceiling    has to FIT. The Lab puts it all on the hexagon that acted and
  //              THROWS if that overflows, because the Lab is where constants
  //              are judged; the World declines the outcome and counts it
  //              (collisionNoRoom), as exchange() does and for the reason
  //              written there.
  //
  // Nothing here reads past the neighbours of i (rule 9): j and the third
  // hexagon are both adjacent to it.
  collide(i, j, d) {
    const w = this.w;
    const side = this.rng.below(2) ? (d + 1) % DIRECTIONS : (d + 5) % DIRECTIONS;
    const third = neighbour(w, i, side);
    const members = isMatter(w, third) ? [i, j, third] : [i, j];

    let sx = 0, sy = 0, keBefore = 0, heat = 0, room = 0;
    for (const m of members) {
      sx += w.mx[m]; sy += w.my[m]; keBefore += keAt(w, m);
      heat += w.energy[m]; room += ENERGY_MAX - w.energy[m];
    }

    // Draw an outcome, as the Lab does: sampled rather than enumerated, and
    // the identity allowed only if nothing else turned up in the tries.
    const R = MOMENTUM_RANGE, tries = 64;
    let chosen = null, sawNoRoom = false;
    for (let t = 0; t < tries; t++) {
      const cand = [];
      let ax = 0, ay = 0, ok = true;
      for (let m = 0; m < members.length - 1; m++) {
        const x = this.rng.below(2 * R + 1) - R;
        const y = this.rng.below(2 * R + 1) - R;
        if (!legalMomentum(x, y)) { ok = false; break; }
        cand.push(x, y); ax += x; ay += y;
      }
      if (!ok) continue;
      const lastX = sx - ax, lastY = sy - ay;
      if (!legalMomentum(lastX, lastY)) continue;
      cand.push(lastX, lastY);

      let keAfter = 0;
      for (let m = 0; m < members.length; m++) keAfter += keOf(cand[2 * m], cand[2 * m + 1], w.kind[members[m]]);
      const delta = keBefore - keAfter;       // > 0 sheds heat, < 0 needs heat
      if (delta < 0 && heat < -delta) continue;            // the heat is not there
      if (delta > 0 && room < delta) { sawNoRoom = true; continue; }   // and it must fit
      chosen = { cand, delta };
      let changed = false;
      for (let m = 0; m < members.length; m++) {
        if (cand[2 * m] !== w.mx[members[m]] || cand[2 * m + 1] !== w.my[members[m]]) { changed = true; break; }
      }
      if (changed) break;
    }

    this.counts.blocked++;                  // the step itself never happens
    if (chosen === null) {
      // No legal outcome. Nothing changes, which conserves everything exactly.
      if (sawNoRoom) this.counts.collisionNoRoom++; else this.counts.collisionDead++;
      return;
    }

    for (let m = 0; m < members.length; m++) {
      w.mx[members[m]] = chosen.cand[2 * m];
      w.my[members[m]] = chosen.cand[2 * m + 1];
    }
    // The kinetic-energy change goes into or out of the heat field, spread
    // over the block the way exchange() spreads it over a pair, and asserted
    // to have finished what the dry run promised.
    let owed = Math.abs(chosen.delta);
    if (chosen.delta > 0) {
      for (const m of members) {
        const take = Math.min(owed, ENERGY_MAX - w.energy[m]);
        w.energy[m] += take; owed -= take;
        if (owed === 0) break;
      }
    } else if (chosen.delta < 0) {
      for (const m of members) {
        const take = Math.min(owed, w.energy[m]);
        w.energy[m] -= take; owed -= take;
        if (owed === 0) break;
      }
    }
    if (owed !== 0) throw new Error(`collision could not move ${owed} of ${chosen.delta} it had checked for`);
    this.counts.collided++;
  }

  // ---------------------------------------------------------------- a tick
  // Every hexagon gets its chance every tick, in a shuffled order so position
  // does not become a hidden priority. This is the per-tick update
  // probability TWO-RUNS.md names, and the clock's rate becomes the chance it
  // fires at all.
  doTick() {
    const w = this.w;
    this.propagateAll();          // the light field moves as one, from a copy
    // After the field has moved, so a quantum that arrives this tick stands
    // on the edge hexagon for one tick like any other and moves on the next.
    if (this.inflow) this.receiveAtEdge();

    const order = this.order && this.order.length === w.cells
      ? this.order : (this.order = new Int32Array(w.cells).map((_, i) => i));
    for (let i = order.length - 1; i > 0; i--) {
      const j = this.rng.below(i + 1);
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }

    for (let o = 0; o < order.length; o++) {
      const i = order[o];
      if (isMatter(w, i)) {
        const pClock = Math.min(1, clockRate(this.c, tempOf(w, i)) / this.causal);
        if (this.rng.u01() < pClock) {
          this.breakBondsIfHot(i);
          if (isMatter(w, i)) this.tryFormBond(i);
          if (isMatter(w, i)) this.tryTransport(i);
          // The two exchanges, in the Lab clock fire order so the two engines
          // can still be compared event for event (TWO-RUNS.md, "cross-validate
          // the time scheme"). Both are offered per clock fire, not per tick,
          // which is how the kick ends up temperature-driven without reading
          // temperature: the clock is the thing that reads it.
          if (isMatter(w, i)) this.shareMomentum(i);
          if (isMatter(w, i)) this.tryThermalKick(i);
        }
        if (this.rng.u01() < this.stepProbability(i)) this.step(i);
      }
    }
    this.tick++;
  }

  // ------------------------------------------------------- the initial state
  // THE-LAWS.md: "The only initial condition for energy is matter, spread
  // out." That sentence was written when gravity was expected to supply the
  // heat and the motion, and with gravity gone it is the whole of the World's
  // energy budget: whatever is placed here, plus what law 2 releases when a
  // bond forms, is all the energy the run will ever have. Nothing adds any
  // after tick 0, and the edge only takes it away.
  //
  // TWO DIALS ON TOP OF THAT, ADDED 2026-11-07, and they exist because the
  // sentence above turned out to decide the whole run rather than leave it
  // open. A world seeded at absolute zero bonds at once: at T = 0 every
  // adjacent pair that can bond does (tryFormBond's own test is temperature
  // below B), and the first 1500-tick runs were 50-91% bonded within a
  // hundred ticks. So a world that is to be hot has to be SEEDED hot, and
  // being hot is now the only way a run gets a hot era at all. Neither dial
  // has a default: left alone this is the old behaviour exactly, and a run
  // records what it was given.
  //
  //   temp0          energy per unit of kind, which is what tempOf reads. At
  //                  or above BOND_MODULUS no bond can form at all, since the
  //                  deepest possible B is the modulus itself.
  //   momentumRange  momentum components drawn in +-R, then the world brought
  //                  to exactly zero total momentum, as the Lab's seedWorld
  //                  does. A net drift looks exactly like a preferred
  //                  direction in the physics.
  seed_(fill, kindDraw, { temp0 = 0, momentumRange = 0 } = {}) {
    const w = this.w;
    const R = Math.min(momentumRange, MOMENTUM_RANGE);
    for (let i = 0; i < w.cells; i++) {
      if (this.rng.u01() >= fill) continue;
      const k = kindDraw(this.rng);
      w.kind[i] = k;
      // Heat is a FIELD WIDTH (rule 5), so an asked-for temperature that will
      // not fit is a refusal and not a clamp: a quietly clamped seed would
      // make every heavy primitive colder than the light ones and nothing
      // would say so.
      if (temp0 > 0) {
        const e = temp0 * k;
        if (e > ENERGY_MAX) {
          throw new Error(`temp0 ${temp0} needs ${e} units on a kind-${k} primitive and the `
            + `energy field holds ${ENERGY_MAX}. The highest temperature every kind can hold `
            + `is ${Math.floor(ENERGY_MAX / KIND_MAX)}.`);
        }
        w.energy[i] = e;
      }
      if (R > 0) {
        let x = 0, y = 0;
        for (let t = 0; t < 8; t++) {
          x = this.rng.below(2 * R + 1) - R;
          y = this.rng.below(2 * R + 1) - R;
          if (legalMomentum(x, y)) break;
          x = 0; y = 0;
        }
        w.mx[i] = x; w.my[i] = y;
      }
    }
    if (R > 0) this.cancelNetMomentum();
    this.ledger = new Ledger(w);
    this.seeded = true;
  }

  // Hand the remainder of the draws back one unit at a time, until the total
  // is exactly zero. The Lab learned this the hard way: its own version used
  // to give up after 1,000 passes and trust the conservation assertion to
  // notice, which it cannot -- the assertion checks that momentum stays
  // CONSTANT, not that it starts at zero. Seeds 7 and 107 ran with a built-in
  // drift of (0, -84) and (0, -656).
  cancelNetMomentum() {
    const w = this.w;
    const occupied = [];
    let sx = 0, sy = 0;
    for (let i = 0; i < w.cells; i++) {
      if (!isMatter(w, i)) continue;
      occupied.push(i); sx += w.mx[i]; sy += w.my[i];
    }
    while (sx !== 0 || sy !== 0) {
      const dx = -Math.sign(sx), dy = -Math.sign(sy);
      let took = -1;
      for (let t = 0; t < 64 && took < 0; t++) {
        const i = occupied[this.rng.below(occupied.length)];
        if (legalMomentum(w.mx[i] + dx, w.my[i] + dy)) took = i;
      }
      for (let k = 0; k < occupied.length && took < 0; k++) {
        const i = occupied[k];
        if (legalMomentum(w.mx[i] + dx, w.my[i] + dy)) took = i;
      }
      if (took < 0) {
        throw new Error(`cannot cancel the seeded net momentum (${sx}, ${sy}): no primitive `
          + `can take another unit inside +-${MOMENTUM_RANGE}. The World would start with a drift.`);
      }
      w.mx[took] += dx; w.my[took] += dy;
      sx += dx; sy += dy;
    }
  }

  // -------------------------------------------------------- what a run shows
  // What the run is FOR, at this stage: making the chemistry, the cooling and
  // the gradient visible enough to judge. It used to be collapse, the hot era
  // and recombination -- the chronology TWO-RUNS.md describes -- and two of
  // those three needed gravity, so what a run can show changed with the laws
  // on 2026-11-08. Each sample is one line of the history, and nothing here is
  // stored in the world (rule 2).
  sample() {
    const w = this.w, c = census(w);
    // LOCAL DENSITY, AND THE STATISTIC REPLACED ON 2026-11-07. The old reading
    // was the MAXIMUM of (self + matter neighbours) over every seventh cell:
    // an integer that cannot exceed 7, over a one-in-seven sample. At fill
    // 0.30 a full neighbourhood occurs about twice by chance in a sample that
    // size, so it read 7 within a hundred ticks of every run and could never
    // read higher -- the whole evidence for "collapse" in the first runs was
    // 6 -> 7, which is a saturated order statistic and not a measurement. At
    // fill 0.08 it sat at 6 for 1500 ticks and said NOT SEEN whatever gravity
    // did. A statistic with a ceiling two steps above its floor cannot show a
    // collapse.
    //
    // What replaces it is a CONTRAST against the null the configuration
    // itself provides. Conditional on a hexagon holding matter, each of its
    // six neighbours holds matter with probability f if matter is spread at
    // random, so the mean neighbourhood is 1 + 6f. Therefore
    //
    //     contrast = (mean neighbourhood - 1) / 6f
    //
    // is 1.0 for matter spread at random, above 1 for matter that has
    // gathered, below 1 for matter that has spread itself out, and it has no
    // ceiling until 1/f. No constant, nothing fitted: the denominator is the
    // fill the same pass measured. The max is kept beside it because it costs
    // nothing and because dropping a reading silently is how the old one
    // survived.
    //
    // AND THE PROFILE, ADDED 2026-11-08 WITH THE EDGE, because the edge makes
    // the World's temperature a function of WHERE. A surface sink drains the
    // perimeter, and perimeter over area falls as 1/side, so a big sheet
    // cannot cool evenly however long it runs: what it can do is grow a cool
    // skin over a hot interior, which is what real matter does and what a
    // photosphere is. A single mean temperature cannot see that at all, so
    // every sample also reports temperature by DEPTH -- how far a hexagon is
    // from the nearest edge, in BANDS equal fractions of the way in. Band 0 is
    // the skin.
    const bandSum = new Float64Array(BANDS), bandMatter = new Int32Array(BANDS);
    const bandCells = new Int32Array(BANDS);
    const halfMin = Math.max(1, Math.min(w.cols, w.rows) / 2);
    let maxLocal = 0, sumLocal = 0, matterCells = 0;
    for (let i = 0; i < w.cells; i++) {
      const q = qOf(w, i), r = rOf(w, i);
      const depth = Math.min(q, w.cols - 1 - q, r, w.rows - 1 - r);
      const band = Math.min(BANDS - 1, Math.floor((depth / halfMin) * BANDS));
      bandCells[band]++;
      if (!isMatter(w, i)) continue;
      matterCells++;
      bandSum[band] += w.energy[i]; bandMatter[band] += w.kind[i];
      let near = 1;
      for (let d = 0; d < DIRECTIONS; d++) if (isMatter(w, neighbour(w, i, d))) near++;
      sumLocal += near;
      if (near > maxLocal) maxLocal = near;
    }
    // Temperature is energy over kind, the same ratio tempOf uses, summed over
    // the band rather than averaged over primitives -- so a band of heavy
    // matter is not reported as cold for being heavy.
    const bandTemp = Array.from(bandMatter, (m, b) => (m ? bandSum[b] / m : 0));
    const fillNow = matterCells / w.cells;
    const meanLocal = matterCells ? sumLocal / matterCells : 0;
    const densityContrast = matterCells && fillNow > 0
      ? (meanLocal - 1) / (6 * fillNow) : 0;
    const row = {
      tick: this.tick,
      cols: w.cols, rows: w.rows, cells: w.cells,
      matterCells,
      fill: matterCells / w.cells,
      meanTemp: matterCells ? c.heat / Math.max(1, c.matter) : 0,
      heat: c.heat, kinetic: c.kinetic, inFlight: c.inFlight,
      // The one channel out, and the only number here that can only rise.
      radiated: this.ledger.escaped,
      // and the one way in, which is 0 for ever unless the run is lit
      received: this.ledger.received,
      bonds: c.bonds,
      bondedFraction: matterCells ? c.bonded / matterCells : 0,
      maxLocalDensity: maxLocal,
      meanLocalDensity: meanLocal,
      densityContrast,
      // Temperature by depth, skin first, and the matter in each band so a
      // band with nothing in it cannot be read as a cold one.
      bandTemp,
      bandMatter: Array.from(bandMatter),
      bandCells: Array.from(bandCells),
      netMomentum: [c.px, c.py],
    };
    this.history.push(row);
    return row;
  }

  // ------------------------------------------------ putting a run down, and
  // ------------------------------------------------ picking it up again
  // Added 2026-11-09. AGENTS.md had this as one of the two things a long run
  // needs and the engine did not have: "nothing loads a World back, so a
  // three-day run dies with the process."
  //
  // EXACT, and that is the only kind worth having here. A World picked up
  // from a checkpoint continues bit for bit as if it had never stopped --
  // world-check.mjs Check 13 runs one world straight through and another
  // through a checkpoint and compares every byte. So a checkpoint is not a
  // new run with a similar look; it is the same run, and a books failure at
  // tick N can be replayed from the checkpoint before it as many times as it
  // takes to find.
  //
  // What that needs is everything the next tick reads: the five arrays, the
  // generator's one word, the tick, the ledger's baseline and its counters --
  // and `order`, the shuffle. doTick shuffles the PREVIOUS tick's order in
  // place rather than starting from 0..n-1, so the order is state, four bytes
  // a hexagon, and leaving it out gives a run that conserves perfectly and
  // has silently become a different run.
  //
  // The bytes are the frame's six per hexagon in the frame's own order
  // (kind, energy, mx, my, bonds), then the order. Nothing derived (rule 2).
  checkpoint() {
    const w = this.w, n = w.cells;
    const order = this.order && this.order.length === n ? this.order : null;
    const bytes = new Uint8Array(n * 6 + (order ? n * 4 : 0));
    const put = (arr, at) => bytes.set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), at);
    put(w.kind, 0); put(w.energy, n); put(w.mx, n * 3); put(w.my, n * 4); put(w.bonds, n * 5);
    if (order) put(order, n * 6);
    const meta = {
      format: "universe-world-checkpoint/1",
      cols: w.cols, rows: w.rows, cells: n,
      seed: this.seed, tick: this.tick, rng: this.rng.state(),
      hasOrder: !!order,
      inflow: this.inflow,
      ledger: { ...this.ledger },
      counts: { ...this.counts },
      history: this.history.slice(-400),
    };
    return { meta, bytes };
  }

  static restore(meta, bytes, { constants = CANDIDATE_ZERO } = {}) {
    if (meta.format !== "universe-world-checkpoint/1") {
      throw new Error(`not a World checkpoint: format ${meta.format}`);
    }
    const n = meta.cols * meta.rows;
    const want = n * 6 + (meta.hasOrder ? n * 4 : 0);
    if (bytes.length !== want) {
      throw new Error(`checkpoint is ${bytes.length} bytes and a ${meta.cols}x${meta.rows} `
        + `World is ${want}: it was cut short, and a short world is not resumed`);
    }
    const world = new World({ cols: meta.cols, rows: meta.rows, seed: meta.seed,
                              constants, inflow: meta.inflow });
    const w = world.w;
    // copied, not viewed: an odd byte offset cannot back a Uint16Array
    const take = (Type, at, count) =>
      new Type(bytes.slice(at, at + count * Type.BYTES_PER_ELEMENT).buffer);
    w.kind.set(take(Uint8Array, 0, n));
    w.energy.set(take(Uint16Array, n, n));
    w.mx.set(take(Int8Array, n * 3, n));
    w.my.set(take(Int8Array, n * 4, n));
    w.bonds.set(take(Uint8Array, n * 5, n));
    if (meta.hasOrder) world.order = take(Int32Array, n * 6, n);
    world.tick = meta.tick;
    world.rng.restore(meta.rng);
    world.ledger = Object.assign(new Ledger(w), meta.ledger);
    Object.assign(world.counts, meta.counts);
    world.history = meta.history || [];
    world.seeded = true;
    // THE BOOKS, BEFORE ANYTHING RUNS. A checkpoint that does not balance
    // against its own ledger was damaged on disk or written by a different
    // engine, and resuming it would turn that into a mystery a million ticks
    // later.
    world.ledger.check(w, `checkpoint at tick ${meta.tick}`);
    return world;
  }

  run(ticks, { sampleEvery = 0, checkEvery = 0, onSample = null } = {}) {
    if (!this.seeded) throw new Error("seed the world before running it");
    for (let t = 0; t < ticks; t++) {
      this.doTick();
      if (checkEvery && this.tick % checkEvery === 0) this.ledger.check(this.w, `tick ${this.tick}`);
      if (sampleEvery && this.tick % sampleEvery === 0) {
        const row = this.sample();
        if (onSample) onSample(row);
      }
    }
    this.ledger.check(this.w, `end of run at tick ${this.tick}`);
    if (sampleEvery && this.history[this.history.length - 1]?.tick !== this.tick) {
      const row = this.sample();
      if (onSample) onSample(row);
    }
    return { ticks: this.tick, cells: this.w.cells, history: this.history };
  }
}

function countMatter(w) {
  let n = 0;
  for (let i = 0; i < w.cells; i++) if (w.kind[i] !== 0) n++;
  return n;
}

export { census, makeWorld, neighbour, bindingEnergy, DIR_AXIAL, DIR_CUBE, makeRng,
         qOf, rOf, tempOf, keAt, countMatter, KIND_MAX, WIDTHS };
