// world.mjs -- the World. The second of the two runs, and the one that is
// meant to be lived in rather than measured: all five laws, a space that
// grows, and no held conditions anywhere.
//
// Read TWO-RUNS.md, THE-LAWS.md and AGENTS.md before changing anything here.
// What this file is NOT is a bigger Lab. Four things differ, and each is a
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
//   GRAVITY IS IN.      Law 3 is held out of the Lab because a measurement
//                       needs controlled conditions. The World has no
//                       controlled conditions, so it has gravity.
//   NO THERMOSTAT.      The Lab holds a hot band and a cold band. The World
//                       holds nothing: collapse supplies the energy and the
//                       growth takes it away.
//   THE SPACE GROWS.    README item 22, rules 1-3.
//
// Rules this file stands under, each marked where it bites:
//
//   rule 2   nothing stored that should emerge. No species field, no cluster
//            id, no temperature field. The potential IS stored, and that is
//            not an exception: it is a field the law is written in terms of.
//   rule 5   integers for everything conserved. Energy and momentum are
//            integers. The potential is a float because a potential is not
//            conserved -- the momentum it produces is, and that is carried in
//            integers through the fine-momentum array.
//   rule 6   conservation asserted, with the edge counters. In a growing
//            world energy is genuinely NOT conserved, so the invariant gains
//            a term rather than being dropped: see Ledger.
//   rule 8   no physics number in this file.
//   rule 9   nothing reads past a site's immediate neighbours -- INCLUDING
//            GRAVITY, which is why it is the screened field and not a sum
//            over pairs. See "law 3" below.
//
// GRAVITY'S STRENGTH IS A DIAL ON THIS FILE AND THAT IS DELIBERATE.
// README item 20 measured gravity's floor above its ceiling at 4096 squared,
// under +-15 and S = 64 -- a physics that stopped existing on 2026-11-06. So
// there is no legal strength to read off, and no re-measurement yet either.
// Ric's call, 2026-11-07: run it, watch collapse, the hot era and
// recombination, and move the dial between runs. Every run therefore records
// the strength it used and the eras it produced, which is what makes the next
// run an experiment rather than a guess.
//
// WHEN A STRENGTH IS CHOSEN IT BELONGS IN constants.mjs AS A SEARCHED
// CONSTANT, not here. These are run settings in exactly the sense
// snapshot.mjs's are: typed on the command line, recorded in the output,
// never defaulted silently into the physics.

import {
  SETTLED, WIDTHS, KIND_MAX, ENERGY_MAX, MOMENTUM_RANGE, DIRECTIONS,
  clockRate, causalRate, validateForLab, CANDIDATE_ZERO,
  capacityOf,
} from "./constants.mjs";

// ------------------------------------------------------------- the lattice
// Pointy-top axial, the same arrangement the Lab uses and the same bond-bit
// order. The size is NOT fixed here: the World grows, so cols and rows are
// state rather than constants.
const DIR_CUBE = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
const DIR_AXIAL = DIR_CUBE.map(([x, , z]) => [x, z]);
const HALF = [0, 1, 5];                     // one of each edge pair
const opposite = (d) => (d + 3) % DIRECTIONS;

const MOD = SETTLED.BOND_MODULUS;
const KE_SCALE = SETTLED.KE_SCALE;

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
  };
}

// ================================================================= the world
// Eight arrays. Five are the Lab's; three are the World's own and each one is
// a decision from THE-LAWS.md rather than an optimisation:
//
//   fineX/fineY  LAW 3's "a pull smaller than one unit of momentum is carried,
//                never rounded". Units of 2^-32, two 32-bit components, which
//                is the form adopted for the World on 2026-11-06 (items 19 and
//                34). An Int32 holds [-2^31, 2^31) of those, which is exactly
//                +-half a momentum unit -- and the law says the strongest legal
//                pull anywhere is under half a unit a tick, so a whole unit is
//                carried the moment the accumulator wraps. The wrap IS the
//                carry, which is why this width and not another.
//   phi          LAW 3's potential. Stored because the screened field equation
//                is written in terms of it; see law 3 below.
function makeWorld(cols, rows) {
  const n = cols * rows;
  return {
    cols, rows, cells: n,
    kind:   new Uint8Array(n),
    energy: new Uint16Array(n),
    mx:     new Int8Array(n),
    my:     new Int8Array(n),
    bonds:  new Uint8Array(n),
    fineX:  new Int32Array(n),
    fineY:  new Int32Array(n),
    phi:    new Float32Array(n),
  };
}

const isMatter = (w, i) => w.kind[i] !== 0;
const qOf = (w, i) => i % w.cols;
const rOf = (w, i) => (i - (i % w.cols)) / w.cols;

// The one neighbour lookup. The World loops both ways, as the Lab does --
// README item 22's shape question is open and this is the provisional
// direction, so it is recorded in the run's `space` block and can change
// without anything else here changing.
function neighbour(w, i, d) {
  const [dq, dr] = DIR_AXIAL[d];
  const q = qOf(w, i) + dq, r = rOf(w, i) + dr;
  const qq = q < 0 ? q + w.cols : q >= w.cols ? q - w.cols : q;
  const rr = r < 0 ? r + w.rows : r >= w.rows ? r - w.rows : r;
  return rr * w.cols + qq;
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
// rule 6, with the term a growing world forces. Energy is NOT conserved when
// space is created -- that is physics, not a bug (README item 22, rule 2) --
// so the invariant carries the loss rather than pretending otherwise:
//
//     heat + kinetic + in flight + expansion loss  =  constant
//
// Momentum IS conserved, gravity included, because every pull is computed
// once per edge and applied equal and opposite to its two ends.
function census(w) {
  let matter = 0, heat = 0, kinetic = 0, inFlight = 0, px = 0, py = 0, bondEnds = 0, bonded = 0;
  // The fine accumulators are part of the momentum, not a side table: a carry
  // adds 1 to mx and wraps fineX by exactly -2^32, so mx*2^32 + fineX is
  // invariant across a carry and the whole-unit part alone is NOT. Summing
  // both is what makes the momentum check exact.
  let fx = 0, fy = 0;
  for (let i = 0; i < w.cells; i++) {
    fx += w.fineX[i]; fy += w.fineY[i];
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
  return { matter, heat, kinetic, inFlight, px, py, fx, fy, bonds: bondEnds / 2, bonded };
}

class Ledger {
  constructor(w) {
    const c = census(w);
    this.matter0 = c.matter;
    this.energy0 = c.heat + c.kinetic + c.inFlight;
    this.px0 = c.px * 4294967296 + c.fx;
    this.py0 = c.py * 4294967296 + c.fy;
    this.expansionLoss = 0;
    this.bondPotential = 0;       // released on forming, absorbed on breaking
    // Expansion takes MOMENTUM as well as energy -- free motion slows as space
    // stretches, which is the same redshift seen from the other side. So the
    // momentum invariant gains a term exactly as the energy one did, rather
    // than the check being switched off because it became inconvenient.
    this.pxDrained = 0; this.pyDrained = 0;
    // GRAVITATIONAL POTENTIAL. THE-LAWS.md: "spread-out matter holds
    // potential, collapse turns it into heat." A force that adds momentum
    // adds kinetic energy, and that energy has to come from somewhere or the
    // world is a perpetual motion machine -- which is exactly what the first
    // run of this engine was, caught by this check at tick 20 with 40 units
    // from nowhere. Every unit of kinetic energy gravity creates is debited
    // here, so the counter IS the potential spent, and watching it drain is
    // watching the collapse pay for the hot era.
    this.gravityPotential = 0;
  }
  check(w, label) {
    const c = census(w);
    const energy = c.heat + c.kinetic + c.inFlight
      + this.expansionLoss + this.bondPotential + this.gravityPotential;
    if (c.matter !== this.matter0) {
      throw new Error(`${label}: matter ${c.matter} was ${this.matter0}`);
    }
    if (energy !== this.energy0) {
      throw new Error(`${label}: energy ${energy} was ${this.energy0} `
        + `(heat ${c.heat} kinetic ${c.kinetic} flight ${c.inFlight} `
        + `expansion ${this.expansionLoss} bonds ${this.bondPotential} `
        + `gravity ${this.gravityPotential})`);
    }
    const px = (c.px + this.pxDrained) * 4294967296 + c.fx;
    const py = (c.py + this.pyDrained) * 4294967296 + c.fy;
    if (px !== this.px0 || py !== this.py0) {
      throw new Error(`${label}: momentum (${px}, ${py}) was (${this.px0}, ${this.py0}) `
        + `-- gravity is applied per edge so it cannot move the total, and expansion's `
        + `share is counted in pxDrained/pyDrained`);
    }
  }
}

// =================================================================== the run
export class World {
  constructor({
    cols = 258, rows = 258, seed = 1,
    constants = CANDIDATE_ZERO,
    gravity = null,          // { eps, screen, relax } -- null means law 3 off
  } = {}) {
    if (cols % 3 || rows % 3) {
      throw new Error(`${cols}x${rows}: both sides must be multiples of 3, because collisions `
        + `resolve in three-hexagon blocks that only tile across the seam when 3 divides the side`);
    }
    const refusals = validateForLab(constants);
    if (refusals.length) {
      throw new Error("REFUSING TO RUN. " + refusals.length + " constant problem(s):\n  - "
        + refusals.join("\n  - "));
    }
    this.c = constants;
    this.g = gravity;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.w = makeWorld(cols, rows);
    this.tick = 0;
    this.causal = causalRate(constants);
    this.counts = {
      stepped: 0, blocked: 0, collided: 0, tooColdToMove: 0,
      bondsFormed: 0, bondsBroken: 0, bondsStretched: 0,
      conducted: 0, emitted: 0, absorbed: 0, quantaMoved: 0,
      // law 1 exchanges. Each refusal has its OWN counter because the three
      // reasons mean different things: "range" is law 1 field width being hit,
      // "unaffordable" is matter too cold to move, "noRoom" is the heat field
      // ceiling. Lumping them would hide which one a run is telling you about.
      momentumShared: 0, shareRangeDeclined: 0, shareUnaffordable: 0, shareNoRoom: 0,
      thermalKicks: 0, kickRangeDeclined: 0, kickUnaffordable: 0, kickNoRoom: 0,
      kickNoPartner: 0,
      gravityCarries: 0, gravityDeclined: 0,
      grew: 0, growthBlocked: 0, expansionDrained: 0,
    };
    this.history = [];
  }

  // ----------------------------------------------------------- law 3, local
  // "Gravity as a sum over pairs is non-local. Gravity as a field is not."
  // THE-LAWS.md, "Gravity can be made local": the screened Poisson equation
  //
  //     laplacian(phi) - m^2 phi = -rho
  //
  // relaxed by repeated neighbour-averaging, with the force read off as the
  // gradient between neighbours. On the hex lattice the discrete laplacian is
  // (sum of six neighbours - 6 phi), so a relaxation step is
  //
  //     phi = (sum of neighbours + rho) / (6 + m^2)
  //
  // and phi is large where matter is, so a primitive is pulled UP the
  // gradient. This is item 12's candidate, taken because rule 9 is worth more
  // than the pairwise form's exactness, and because a pairwise sum over
  // millions of cells is not a thing a browser does.
  //
  // IT IS RELAXED, NOT SOLVED. A few sweeps a tick track a density that moves
  // slowly compared to the relaxation. That is an approximation and it is the
  // World's second one after ticked time; both are listed in the run's output
  // so neither can be forgotten.
  relaxPotential() {
    const w = this.w, m2 = this.g.screen * this.g.screen, denom = 6 + m2;
    for (let pass = 0; pass < this.g.relax; pass++) {
      for (let i = 0; i < w.cells; i++) {
        let sum = 0;
        for (let d = 0; d < DIRECTIONS; d++) sum += w.phi[neighbour(w, i, d)];
        w.phi[i] = (sum + w.kind[i]) / denom;
      }
    }
  }

  // One Int32 of fine momentum is 2^-32 of a unit, so the accumulator covers
  // +-half a unit and WRAPS at exactly one whole unit. Detecting the wrap is
  // the carry -- no division, no rounding, and nothing is ever dropped.
  //
  // This is a DRY RUN: it works out what would happen without touching
  // anything, because a pull is only legal if it is legal at BOTH ends. See
  // pullPair.
  wouldCarry(before, delta) {
    const after = (before + delta) | 0;
    const carry = delta > 0 && after < before ? 1
                : delta < 0 && after > before ? -1 : 0;
    return [after, carry];
  }

  // "Each interaction is computed once and applied to both sides." Walking
  // edges rather than cells is what makes that true by construction: the pair
  // gets one number, +F to one end and -F to the other, so the world's total
  // momentum cannot move however wrong the potential is.
  applyGravity() {
    const w = this.w;
    this.relaxPotential();
    const scale = this.g.eps * 4294967296;     // into units of 2^-32
    for (let i = 0; i < w.cells; i++) {
      if (!isMatter(w, i)) continue;
      for (const d of HALF) {
        const j = neighbour(w, i, d);
        if (!isMatter(w, j)) continue;
        // symmetric weight, antisymmetric gradient -> equal and opposite
        let f = scale * w.kind[i] * w.kind[j] * (w.phi[j] - w.phi[i]);
        if (!f) continue;
        // |0 on anything past 2^31 wraps, which would turn the strongest pull
        // in the world into a pull the other way. Clamp first and count it:
        // a dial set this high is outside the law's "under half a unit a
        // tick" and the run should say so rather than silently invert.
        if (f > 2147483647 || f < -2147483648) { this.counts.gravityDeclined++; f = f > 0 ? 2147483647 : -2147483648; }
        const [ux, uy] = DIR_CUBE[d];
        const fx = (f * ux) | 0, fy = (f * uy) | 0;
        if (fx === 0 && fy === 0) { this.counts.gravityDeclined++; continue; }
        this.pullPair(i, j, fx, fy);
      }
    }
  }

  // ONE EDGE, SETTLED AS ONE TRANSACTION, and that is forced rather than
  // tidy. The law says each interaction is "computed once and applied to both
  // sides", and the first version applied the two sides independently: when
  // one end was already at law 1's momentum range and refused its half, the
  // other end took its half anyway and the world's momentum walked off --
  // caught by the ledger at (-21, 11) after twenty ticks.
  //
  // So the pull is all-or-nothing. If either end cannot legally take it,
  // neither does, and the edge is counted as declined. A pull is never
  // clipped: clipping is what item 20 found gravity dying of.
  pullPair(i, j, fx, fy) {
    const w = this.w;
    const [aix, cix] = this.wouldCarry(w.fineX[i], fx);
    const [aiy, ciy] = this.wouldCarry(w.fineY[i], fy);
    const [ajx, cjx] = this.wouldCarry(w.fineX[j], -fx);
    const [ajy, cjy] = this.wouldCarry(w.fineY[j], -fy);

    if ((cix || ciy) && !legalMomentum(w.mx[i] + cix, w.my[i] + ciy)) {
      this.counts.gravityDeclined++; return;
    }
    if ((cjx || cjy) && !legalMomentum(w.mx[j] + cjx, w.my[j] + cjy)) {
      this.counts.gravityDeclined++; return;
    }

    w.fineX[i] = aix; w.fineY[i] = aiy;
    w.fineX[j] = ajx; w.fineY[j] = ajy;

    if (cix || ciy) {
      const before = keAt(w, i);
      w.mx[i] += cix; w.my[i] += ciy;
      this.ledger.gravityPotential -= keAt(w, i) - before;
      this.counts.gravityCarries++;
    }
    if (cjx || cjy) {
      const before = keAt(w, j);
      w.mx[j] += cjx; w.my[j] += cjy;
      this.ledger.gravityPotential -= keAt(w, j) - before;
      this.counts.gravityCarries++;
    }
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
  propagateAll() {
    const w = this.w;
    if (!this.flight || this.flight.length !== w.cells) this.flight = new Uint8Array(w.cells);
    const was = this.flight;
    for (let i = 0; i < w.cells; i++) { was[i] = isMatter(w, i) ? 0 : w.bonds[i]; }
    for (let i = 0; i < w.cells; i++) if (!isMatter(w, i)) w.bonds[i] = 0;

    for (let i = 0; i < w.cells; i++) {
      const slots = was[i];
      if (!slots) continue;
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(slots & (1 << d))) continue;
        const j = neighbour(w, i, d);
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
  }

  // ----------------------------------------------------- law 1, the exchanges
  // TWO WAYS MOMENTUM MOVES BETWEEN NEIGHBOURS WITHOUT ANYTHING TRAVELLING.
  // Ported from the Lab on 2026-11-07 at Ric's instruction. Both are settled
  // physics -- the first is law 1's own second sentence, the second is README
  // item 29 settled on 2026-11-06 -- and the World ran without either, which
  // made it an incomplete physics rather than a different one:
  //
  //   shareMomentum   a bonded pair equalising. This is what lets a bonded
  //                   GROUP respond to a push as a group: gravity pulls on one
  //                   end and the bond carries that momentum through the
  //                   cluster, one hop per clock fire. Without it a cluster is
  //                   not an object, just a set of hexagons that cannot move.
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

  // A dry run, then a commit, exactly as pullPair is and for the same reason:
  // an exchange that cannot be paid for in full does not happen at all,
  // because declining conserves exactly where clamping would not. Returns
  // null on success, or the reason it did not happen.
  exchange(i, j, nxI, nyI, nxJ, nyJ) {
    const w = this.w;
    // Law 1's range is a field width, and rule 5 says a field must not be
    // papered over. Declining the hop conserves; clipping it is what README
    // item 20 found gravity dying of.
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

  step(i) {
    const w = this.w;
    const d = this.stepDirection(i);
    if (d < 0) { this.counts.tooColdToMove++; return; }
    const j = neighbour(w, i, d);
    if (isMatter(w, j)) { this.counts.blocked++; return; }
    if (w.bonds[j]) { this.counts.blocked++; return; }    // a quantum is there
    // a bond that motion would stretch costs B, and what cannot pay does not
    // move -- GAP 3 as the Lab settled it
    if (w.bonds[i]) { this.counts.bondsStretched++; return; }
    w.kind[j] = w.kind[i]; w.energy[j] = w.energy[i];
    w.mx[j] = w.mx[i]; w.my[j] = w.my[i];
    w.fineX[j] = w.fineX[i]; w.fineY[j] = w.fineY[i];
    w.bonds[j] = 0;
    w.kind[i] = 0; w.energy[i] = 0; w.mx[i] = 0; w.my[i] = 0;
    w.fineX[i] = 0; w.fineY[i] = 0; w.bonds[i] = 0;
    this.counts.stepped++;
  }

  // ------------------------------------------------------------- the growth
  // README item 22, rule 1: a new line of empty hexagons all the way round the
  // loop, between two existing lines, WHERE NOTHING ON ONE SIDE IS BONDED TO
  // ANYTHING ON THE OTHER. Bound matter is never split. Lines go in threes so
  // each side stays a multiple of 3, and the axis alternates.
  rowIsCuttable(r) {
    const w = this.w;
    // a cut between row r-1 and row r: no bond may cross it
    for (let q = 0; q < w.cols; q++) {
      const i = (r === 0 ? w.rows - 1 : r - 1) * w.cols + q;
      if (!w.bonds[i]) continue;
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[i] & (1 << d))) continue;
        if (DIR_AXIAL[d][1] === 1) return false;      // reaches into row r
      }
    }
    return true;
  }
  colIsCuttable(q) {
    const w = this.w;
    for (let r = 0; r < w.rows; r++) {
      const i = r * w.cols + (q === 0 ? w.cols - 1 : q - 1);
      if (!w.bonds[i]) continue;
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[i] & (1 << d))) continue;
        if (DIR_AXIAL[d][0] === 1) return false;
      }
    }
    return true;
  }

  grow(axis) {
    const w = this.w;
    const along = axis === 0 ? w.cols : w.rows;
    const eligible = [];
    for (let k = 0; k < along; k++) {
      if (axis === 0 ? this.colIsCuttable(k) : this.rowIsCuttable(k)) eligible.push(k);
    }
    if (!eligible.length) { this.counts.growthBlocked++; return false; }
    const atK = eligible[this.rng.below(eligible.length)];

    const cols = axis === 0 ? w.cols + 3 : w.cols;
    const rows = axis === 1 ? w.rows + 3 : w.rows;
    const n = makeWorld(cols, rows);
    const copy = (si, di) => {
      n.kind[di] = w.kind[si]; n.energy[di] = w.energy[si];
      n.mx[di] = w.mx[si]; n.my[di] = w.my[si]; n.bonds[di] = w.bonds[si];
      n.fineX[di] = w.fineX[si]; n.fineY[di] = w.fineY[si]; n.phi[di] = w.phi[si];
    };
    for (let r = 0; r < w.rows; r++) {
      for (let q = 0; q < w.cols; q++) {
        const si = r * w.cols + q;
        const dq = axis === 0 && q >= atK ? q + 3 : q;
        const dr = axis === 1 && r >= atK ? r + 3 : r;
        copy(si, dr * cols + dq);
      }
    }
    this.w = n;
    this.counts.grew++;
    return true;
  }

  // rule 2: growth drains energy from what is NOT bound -- light in flight and
  // the motion of free primitives -- in proportion, into a counted loss. Heat
  // held in matter is not drained. That is the cold dark sky a loop with no
  // edge was missing.
  drainForGrowth(fraction) {
    const w = this.w;
    for (let i = 0; i < w.cells; i++) {
      if (isMatter(w, i)) {
        if (w.bonds[i]) continue;                    // bound: not drained
        if (w.mx[i] === 0 && w.my[i] === 0) continue;
        if (this.rng.u01() >= fraction) continue;
        const before = keAt(w, i);
        const sx = Math.sign(w.mx[i]), sy = Math.sign(w.my[i]);
        if (sx) { w.mx[i] -= sx; this.ledger.pxDrained += sx; }
        else if (sy) { w.my[i] -= sy; this.ledger.pyDrained += sy; }
        else continue;
        const lost = before - keAt(w, i);
        if (lost > 0) { this.ledger.expansionLoss += lost; this.counts.expansionDrained++; }
      } else if (w.bonds[i]) {
        for (let d = 0; d < DIRECTIONS; d++) {
          if (!(w.bonds[i] & (1 << d))) continue;
          if (this.rng.u01() >= fraction) continue;
          w.bonds[i] &= ~(1 << d);                   // the quantum redshifts away
          this.ledger.expansionLoss += 1;
          this.counts.expansionDrained++;
        }
      }
    }
  }

  // ---------------------------------------------------------------- a tick
  // Every hexagon gets its chance every tick, in a shuffled order so position
  // does not become a hidden priority. This is the per-tick update
  // probability TWO-RUNS.md names, and the clock's rate becomes the chance it
  // fires at all.
  doTick() {
    const w = this.w;
    if (this.g) this.applyGravity();
    this.propagateAll();          // the light field moves as one, from a copy

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
  // out." No momentum, no heat -- gravity is supposed to supply both, and
  // whether it does at a given strength is the thing being watched.
  seed_(fill, kindDraw) {
    const w = this.w;
    for (let i = 0; i < w.cells; i++) {
      if (this.rng.u01() >= fill) continue;
      w.kind[i] = kindDraw(this.rng);
    }
    this.ledger = new Ledger(w);
  }

  // ----------------------------------------------------------- the eras
  // What the run is FOR, at this stage: making collapse, the hot era and
  // recombination visible enough to move gravity's dial against. Each sample
  // is one line of the history, and nothing here is stored in the world.
  sample() {
    const w = this.w, c = census(w);
    let maxLocal = 0, occupied = 0;
    // local density: matter in a hexagon's own neighbourhood, which is the
    // most local thing that can show a collapse at all
    for (let i = 0; i < w.cells; i += 7) {
      if (!isMatter(w, i)) continue;
      occupied++;
      let near = 1;
      for (let d = 0; d < DIRECTIONS; d++) if (isMatter(w, neighbour(w, i, d))) near++;
      if (near > maxLocal) maxLocal = near;
    }
    const matterCells = countMatter(w);
    const row = {
      tick: this.tick,
      cols: w.cols, rows: w.rows, cells: w.cells,
      matterCells,
      fill: matterCells / w.cells,
      meanTemp: matterCells ? c.heat / Math.max(1, c.matter) : 0,
      heat: c.heat, kinetic: c.kinetic, inFlight: c.inFlight,
      expansionLoss: this.ledger.expansionLoss,
      bonds: c.bonds,
      bondedFraction: matterCells ? c.bonded / matterCells : 0,
      maxLocalDensity: maxLocal,
      netMomentum: [c.px, c.py],
    };
    this.history.push(row);
    return row;
  }

  run(ticks, { sampleEvery = 0, checkEvery = 0, growEvery = 0, growthDrain = 0,
               maxCells = Infinity, onSample = null } = {}) {
    if (!this.ledger) throw new Error("seed the world before running it");
    let growAxis = 0;
    for (let t = 0; t < ticks; t++) {
      this.doTick();
      if (growEvery && this.tick % growEvery === 0 && this.w.cells < maxCells) {
        // rule 3: the rate follows the World and stops at the hardware
        if (this.grow(growAxis)) {
          growAxis ^= 1;                       // alternate, so the loop stays even
          if (growthDrain > 0) this.drainForGrowth(growthDrain);
          this.order = null;                   // the world changed size
        }
      }
      if (checkEvery && this.tick % checkEvery === 0) this.ledger.check(this.w, `tick ${this.tick}`);
      if (sampleEvery && this.tick % sampleEvery === 0) {
        const row = this.sample();
        if (onSample) onSample(row);
      }
    }
    this.ledger.check(this.w, `end of run at tick ${this.tick}`);
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
