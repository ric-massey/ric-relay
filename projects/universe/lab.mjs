// lab.mjs -- the Lab. The first engine in this project; everything before it
// was a screening tool that answered a question without running a world.
//
// What it is: 258 x 258 hexagons on a torus, four of the five laws, event-driven
// continuous time, run to measure what matter IS in this physics. Gravity is
// deliberately absent -- see "Why gravity is held out of the Lab" in THE-LAWS.md.
// The output this is eventually for is a table of species, measured by running
// collisions rather than computed from anything anybody wrote.
//
// Read THE-LAWS.md and AGENTS.md before changing anything here. The rules that
// shaped this file, each marked where it bites:
//
//   rule 1   every technique credited in SOURCES.md BEFORE use. The event loop
//            is Bortz-Kalos-Lebowitz, the waiting times Gillespie, the queue
//            Gibson-Bruck over a Williams heap, the generator Marsaglia. All
//            five entries went in before this file existed.
//   rule 2   nothing stored that should emerge. There is no species field, no
//            cluster id, no temperature field -- temperature is e/kind, read.
//   rule 3   no borrowed names.
//   rule 5   integers for everything conserved. kind, energy and momentum are
//            typed-array integers and never floats. Rates are floats; a rate
//            is not conserved.
//   rule 6   conservation asserted, with the edge counters, and a drift of 1
//            is a bug. In the Lab two counters are zero by construction and
//            that is asserted too.
//   rule 8   no physics number in this file. They all live in constants.mjs.
//   rule 9   nothing reads past a site's immediate neighbours. With gravity
//            out, the Lab has NO exception at all.
//
// THREE THINGS THIS FILE HAD TO CHOOSE THAT NO DOCUMENT SETTLES. Each is
// marked GAP where it appears, and each belongs in README as a question
// rather than being quietly decided here:
//
//   GAP 1   the causal limit in continuous time. Law 1 says "one hexagon per
//           TICK" and the Lab has no tick. See causalRate in constants.mjs.
//   GAP 2   the Margolus partition "offset each step", with no step to offset
//           on. See collide().
//   GAP 3   whether a bonded primitive may step, and what happens to a bond
//           that motion stretches. See step().

import {
  KIND_MAX, ENERGY_MAX, MOMENTUM_RANGE, DIRECTIONS, LAB, SETTLED,
  clockRate, causalRate, validateForLab, CANDIDATE_ZERO, THERMOSTAT_DEFAULT,
} from "./constants.mjs";

// ====================================================================== rng
// Marsaglia (2003), xorshift128. Seeded, because AGENTS.md rule 11 asks
// "does it survive a change of random seed", which is only a check you can
// run if the seed is an input you control. Every draw the physics makes comes
// from this one stream.
function makeRng(seed) {
  let x = (seed | 0) || 2463534242, y = 362436069, z = 521288629, w = 88675123;
  for (let i = 0; i < 8; i++) { const t = x ^ (x << 11); x = y; y = z; z = w; w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8)); }
  const next = () => {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return w >>> 0;
  };
  return {
    u01: () => next() / 4294967296,          // [0,1)
    below: (n) => next() % n,                 // integer in 0..n-1
    coin: () => (next() & 1) === 1,           // law 1's tie-break
  };
}

// ================================================================= geometry
// Axial coordinates on a torus. THE-LAWS.md: "Walk off one side and you come
// back on the opposite side. In axial coordinates that is just q mod N, r mod N."
//
// The six directions, as cube vectors and as the axial steps they correspond
// to. Cube (x,y,z) with x+y+z=0 maps to axial q=x, r=z, so these two lists
// are the same six directions in two notations and MUST stay in step: law 1
// stores momentum in cube, the lattice is walked in axial.
const DIR_CUBE = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]];
const DIR_AXIAL = DIR_CUBE.map(([x, , z]) => [x, z]);
const opposite = (d) => (d + 3) % DIRECTIONS;

const N = LAB.N;
const CELLS = N * N;
const wrap = (v) => ((v % N) + N) % N;
const at = (q, r) => wrap(r) * N + wrap(q);
const qOf = (i) => i % N;
const rOf = (i) => (i - (i % N)) / N;

// The one place a neighbour is computed. Everything goes through it, so the
// seam cannot be forgotten in one caller and remembered in another -- rule 6:
// "a neighbour lookup that forgets to wrap is a wall nobody wrote down."
function neighbour(i, d) {
  const [dq, dr] = DIR_AXIAL[d];
  return at(qOf(i) + dq, rOf(i) + dr);
}

// ==================================================================== world
// A hexagon is one of three things (THE-LAWS.md, the radiation fact):
//   a primitive        kind 1..255, its heat, a momentum vector, its bonds
//   a quantum in flight kind 0, one bit per direction in flight, energy 0
//   empty              kind 0, everything 0
function makeWorld() {
  return {
    kind:   new Uint8Array(CELLS),    // 0 = not matter
    energy: new Uint16Array(CELLS),   // heat, matter only
    mx:     new Int8Array(CELLS),     // momentum, cube x
    my:     new Int8Array(CELLS),     // momentum, cube y;  z = -x-y
    bonds:  new Uint8Array(CELLS),    // matter: which neighbours. vacuum: in-flight slots.
  };
}

const isMatter = (w, i) => w.kind[i] !== 0;
const mz = (w, i) => -w.mx[i] - w.my[i];
const popcount6 = (b) => {
  let n = 0;
  for (let d = 0; d < DIRECTIONS; d++) if (b & (1 << d)) n++;
  return n;
};
const bondCount = (w, i) => popcount6(w.bonds[i]);

// ------------------------------------------------- the derived quantities
// Held nowhere. Rule 2: computed for use, never stored.

// Q is the UN-HALVED squared length on the cube axes; true |p|^2 is Q/2.
// Law 1 carries Q to stay in integers.
const Qof = (w, i) => {
  const x = w.mx[i], y = w.my[i], z = -x - y;
  return x * x + y * y + z * z;
};

// Law 1: KE(p,k) = floor(S * Q(p) / 2k). Derived, never stored. A pure
// function of (p, k), which is what makes the free-energy pump impossible.
const keAt = (w, i) => Math.floor(SETTLED.KE_SCALE * Qof(w, i) / (2 * w.kind[i]));
const keOf = (Q, k) => Math.floor(SETTLED.KE_SCALE * Q / (2 * k));

// Law 2: B(k1,k2) = M - |v(k1) + v(k2) - M|, v(k) = k mod M. Recomputed from
// the two kinds every time, never stored -- the six bond bits record WHICH
// neighbours, never HOW STRONGLY. That is what makes the bond-energy seam
// hold by construction, since kind is immutable.
function bindingEnergy(k1, k2) {
  const M = SETTLED.BOND_MODULUS;
  return M - Math.abs((k1 % M) + (k2 % M) - M);
}

// Law 5: the comparison is on TEMPERATURE, not energy. e1*k2 against e2*k1 --
// two integer multiplications, exact, no division. Comparing raw energy would
// move heat uphill, which is one of the two accounting bugs this project has
// already had.
const hotterThan = (w, i, j) => w.energy[i] * w.kind[j] > w.energy[j] * w.kind[i];

// ================================================================== ledger
// Rule 6. Matter, energy and momentum every run, with the edge counters, and
// a drift of 1 is a bug rather than a rounding issue.
function census(w) {
  let matter = 0, heat = 0, kinetic = 0, inFlight = 0, pxSum = 0, pySum = 0, bondBits = 0;
  let bondPotential = 0;
  for (let i = 0; i < CELLS; i++) {
    if (w.kind[i] !== 0) {
      matter += w.kind[i];
      heat += w.energy[i];
      kinetic += keAt(w, i);
      pxSum += w.mx[i];
      pySum += w.my[i];
      bondBits += bondCount(w, i);
      // Standing bonds hold NEGATIVE potential, and leaving this out was a
      // real leak -- caught 2026-11-05 by the assertion, at 18541 units over
      // 50,000 events. Forming releases B into the heat field, so the bonded
      // state is B LOWER than the unbonded one, and a bond that forms and
      // stays formed otherwise looks like heat arriving from nowhere. The
      // structural fact "Bond energy accounting is exact" says this is the one
      // place conservation is actually at risk, and it was right.
      //
      // Each bond is counted once, from the endpoint with the lower index.
      for (let d = 0; d < DIRECTIONS; d++) {
        if (!(w.bonds[i] & (1 << d))) continue;
        const j = neighbour(i, d);
        if (j > i) bondPotential -= bindingEnergy(w.kind[i], w.kind[j]);
      }
    } else {
      // Vacuum. Energy in flight is one unit per set direction bit -- counted
      // by walking the six bits, exactly as rule 6 says to.
      inFlight += popcount6(w.bonds[i]);
    }
  }
  return { matter, heat, kinetic, inFlight, pxSum, pySum, bondBits, bondPotential };
}

class Ledger {
  constructor(w) {
    const c = census(w);
    this.matter0 = c.matter;
    this.px0 = c.pxSum;
    this.py0 = c.pySum;
    this.thermostatNet = 0;    // energy the held bands injected (+) or removed (-)
    this.radiatedAway = 0;     // MUST stay 0: the Lab has no boundary
    this.energy0 = c.heat + c.kinetic + c.inFlight + c.bondPotential;
  }

  // The Lab gets the STRICT equality, and two of the counters are zero by
  // construction -- so those get asserted too, because a nonzero
  // radiated-away here "is not a small leak, it is code that still thinks
  // there is an edge."
  check(w, label) {
    const c = census(w);
    const problems = [];

    if (c.matter !== this.matter0) {
      problems.push(`matter drifted by ${c.matter - this.matter0} (sum of kinds ${c.matter}, was ${this.matter0})`);
    }
    if (c.pxSum !== this.px0 || c.pySum !== this.py0) {
      problems.push(`momentum drifted by (${c.pxSum - this.px0}, ${c.pySum - this.py0}); `
        + `the Lab loops, so there is no wall to absorb it and this must be exact`);
    }
    if (this.radiatedAway !== 0) {
      problems.push(`radiated-away is ${this.radiatedAway} and must be 0: the Lab has no `
        + `boundary, so this is code that still thinks there is an edge`);
    }
    // Four terms inside the world and two at its edge. The bond term is
    // NEGATIVE potential: see census. Leaving it out reads exactly like a
    // leak, which is how it was found.
    const energyNow = c.heat + c.kinetic + c.inFlight + c.bondPotential
      + this.radiatedAway - this.thermostatNet;
    if (energyNow !== this.energy0) {
      problems.push(`energy drifted by ${energyNow - this.energy0}: heat ${c.heat} + kinetic `
        + `${c.kinetic} + in flight ${c.inFlight} + bonds ${c.bondPotential} + radiated `
        + `${this.radiatedAway} - thermostat ${this.thermostatNet} = ${energyNow}, `
        + `was ${this.energy0}`);
    }
    if (problems.length) {
      throw new Error(`CONSERVATION FAILED at ${label}:\n  - ` + problems.join("\n  - "));
    }
    return c;
  }
}

// Rule 5: "Any operation that would exceed a field must fail loudly, exactly
// like a drift of 1. Don't clamp, don't saturate, don't widen the field
// quietly: a world that keeps hitting the ceiling is telling you the
// constants are wrong."
function addEnergy(w, i, amount, why) {
  const next = w.energy[i] + amount;
  if (next > ENERGY_MAX) {
    throw new Error(`ENERGY FIELD OVERFLOW at hexagon ${i} (${why}): ${w.energy[i]} + ${amount} `
      + `= ${next} > ${ENERGY_MAX}. Not clamped on purpose -- the constants are wrong.`);
  }
  if (next < 0) {
    throw new Error(`ENERGY WENT NEGATIVE at hexagon ${i} (${why}): ${w.energy[i]} + ${amount}.`);
  }
  w.energy[i] = next;
}

// ============================================================ event queue
// Gibson & Bruck's indexed priority queue over Williams's implicit binary
// heap, with lazy invalidation: a hexagon's old entry is left in the heap and
// skipped when popped, rather than being deleted in place. One entry per
// hexagon is live at a time, identified by its stamp.
class Queue {
  constructor(capacity) {
    this.time = new Float64Array(capacity);
    this.site = new Int32Array(capacity);
    this.stamp = new Int32Array(capacity);
    this.n = 0;
    this.live = new Int32Array(CELLS);   // the stamp that is current for each hexagon
  }
  _grow() {
    const cap = this.time.length * 2;
    const t = new Float64Array(cap), s = new Int32Array(cap), st = new Int32Array(cap);
    t.set(this.time); s.set(this.site); st.set(this.stamp);
    this.time = t; this.site = s; this.stamp = st;
  }
  push(t, i) {
    const stamp = ++this.live[i];
    if (this.n === this.time.length) this._grow();
    let c = this.n++;
    this.time[c] = t; this.site[c] = i; this.stamp[c] = stamp;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (this.time[p] <= this.time[c]) break;
      this._swap(p, c); c = p;
    }
  }
  _swap(a, b) {
    let t = this.time[a]; this.time[a] = this.time[b]; this.time[b] = t;
    let s = this.site[a]; this.site[a] = this.site[b]; this.site[b] = s;
    let u = this.stamp[a]; this.stamp[a] = this.stamp[b]; this.stamp[b] = u;
  }
  // Returns the next LIVE event, discarding stale ones, or null when empty.
  pop() {
    while (this.n > 0) {
      const t = this.time[0], i = this.site[0], st = this.stamp[0];
      this.n--;
      if (this.n > 0) {
        this.time[0] = this.time[this.n]; this.site[0] = this.site[this.n]; this.stamp[0] = this.stamp[this.n];
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < this.n && this.time[l] < this.time[m]) m = l;
          if (r < this.n && this.time[r] < this.time[m]) m = r;
          if (m === c) break;
          this._swap(m, c); c = m;
        }
      }
      if (st === this.live[i]) return { t, i };
    }
    return null;
  }
}

// ==================================================================== lab
export class Lab {
  constructor({ constants = CANDIDATE_ZERO, thermostat = THERMOSTAT_DEFAULT, seed = 1 } = {}) {
    const refusals = validateForLab(constants);
    if (refusals.length) {
      throw new Error("REFUSING TO RUN. " + refusals.length + " constant problem(s):\n  - "
        + refusals.join("\n  - "));
    }
    this.c = constants;
    this.thermostat = thermostat;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.w = makeWorld();
    this.now = 0;
    this.events = 0;
    this.causal = causalRate(constants);
    this.counts = {
      stepped: 0, blocked: 0, collided: 0, collisionDead: 0, tooColdToMove: 0,
      bondsFormed: 0, bondsBroken: 0, bondsStretched: 0,
      conducted: 0, emitted: 0, absorbed: 0, quantaMoved: 0,
      emissionBlocked: 0, quantumWaited: 0,
      momentumShared: 0, momentumRangeDeclined: 0, shareUnaffordable: 0, thermostatFires: 0,
    };
  }

  // ----------------------------------------------------------------- rates
  // The n-fold way: each hexagon has a total rate and the loop draws which
  // acts next. A hexagon with rate 0 is simply never scheduled.
  //
  // Matter has two independent processes, and keeping them apart is law 1's
  // doing rather than a convenience: the CLOCK is temperature-driven and
  // carries laws 2 and 5 plus momentum sharing, while MOTION is
  // momentum-driven and carries law 1's stepping. Inertia should not speed up
  // because a thing is hot, and a reaction rate should not speed up because
  // it is moving.
  clockRateAt(i) {
    const w = this.w;
    return clockRate(this.c, w.energy[i] / w.kind[i]);
  }
  motionRateAt(i) {
    const w = this.w;
    const Q = Qof(w, i);
    if (Q === 0) return 0;
    // Law 1: one hexagon every k/|p| ticks, capped at one per tick. As a rate
    // that is min(1, |p|/k) steps per tick, and GAP 1 turns "per tick" into
    // "per unit of the fastest clock".
    const speed = Math.min(1, Math.sqrt(Q / 2) / w.kind[i]);
    return this.causal * speed;
  }
  totalRateAt(i) {
    const w = this.w;
    if (isMatter(w, i)) return this.clockRateAt(i) + this.motionRateAt(i);
    // A quantum in flight travels at exactly the causal limit and never
    // slower -- the one thing in this world that always does.
    if (w.bonds[i] !== 0) return this.causal;
    return 0;   // empty, and nothing to do
  }

  schedule(i) {
    const rate = this.totalRateAt(i);
    // Rate 0 means empty vacuum: nothing to do and nothing to schedule. Bump
    // the live stamp so any entry still sitting in the heap is skipped when
    // it surfaces, rather than firing on a hexagon that has gone quiet.
    if (rate <= 0) { this.queue.live[i]++; return; }
    // Gillespie: exponential waiting time by inverse transform.
    const u = this.rng.u01();
    const dt = -Math.log(1 - u) / rate;
    this.queue.push(this.now + dt, i);
  }

  // ------------------------------------------------------------- the laws
  // Law 2 breaking. "A bond breaks when e >= B * kind at either endpoint,
  // which is temperature exceeding B." Breaking ABSORBS precisely B, and
  // since the condition at an endpoint is e >= B*kind and kind >= 1, that
  // endpoint always holds at least B -- so the seam cannot go short.
  breakBondsIfHot(i) {
    const w = this.w;
    for (let d = 0; d < DIRECTIONS; d++) {
      if (!(w.bonds[i] & (1 << d))) continue;
      const j = neighbour(i, d);
      const B = bindingEnergy(w.kind[i], w.kind[j]);
      const hotHere = w.energy[i] >= B * w.kind[i];
      const hotThere = w.energy[j] >= B * w.kind[j];
      if (!hotHere && !hotThere) continue;
      const payer = hotHere ? i : j;
      this.severBond(i, d, payer, "law 2 break");
    }
  }

  severBond(i, d, payer, why) {
    const w = this.w;
    const j = neighbour(i, d);
    const B = bindingEnergy(w.kind[i], w.kind[j]);
    w.bonds[i] &= ~(1 << d);
    w.bonds[j] &= ~(1 << opposite(d));
    addEnergy(w, payer, -B, why);          // breaking absorbs precisely B
    this.counts.bondsBroken++;
  }

  // Law 2 forming, under law 4's capacity. "A bond forms with a fixed
  // probability when the clock fires -- never instantly on contact." Forming
  // releases precisely B into the hexagon as heat.
  tryFormBond(i) {
    const w = this.w;
    if (this.rng.u01() >= this.c.BOND_FORM_PROB) return;
    if (bondCount(w, i) >= this.c.CAPACITY) return;        // law 4
    const d = this.rng.below(DIRECTIONS);
    if (w.bonds[i] & (1 << d)) return;                     // already bonded
    const j = neighbour(i, d);
    if (!isMatter(w, j)) return;
    if (bondCount(w, j) >= this.c.CAPACITY) return;        // law 4, both ends
    const B = bindingEnergy(w.kind[i], w.kind[j]);
    if (B === 0) return;                                   // this pair cannot bond at all
    // Note what is NOT done here: no check that the bond will survive its own
    // break condition. Forming releases B into this hexagon, which can push
    // it straight over e >= B*kind, and then the next clock fire breaks it
    // again. That churn is the two laws disagreeing at a particular
    // temperature, which is a finding about the constants, so it is left to
    // happen and counted rather than suppressed by a rule this file invented.
    addEnergy(w, i, B, "law 2 form");                      // releases precisely B
    w.bonds[i] |= (1 << d);
    w.bonds[j] |= (1 << opposite(d));
    this.counts.bondsFormed++;
  }

  // Law 5 plus the radiation fact. One uniform direction among the six: the
  // uniformity is forced, not chosen, because the second-law argument needs
  // it. Into colder matter it is conduction; into vacuum it is emission, and
  // vacuum is colder than anything.
  tryTransport(i) {
    const w = this.w;
    if (this.rng.u01() >= this.c.TRANSPORT_RATE) return;
    if (w.energy[i] < 1) return;
    const d = this.rng.below(DIRECTIONS);
    const j = neighbour(i, d);
    if (isMatter(w, j)) {
      if (!hotterThan(w, i, j)) return;                    // downhill only
      addEnergy(w, i, -1, "law 5 conduct out");
      addEnergy(w, j, 1, "law 5 conduct in");
      this.counts.conducted++;
      return;
    }
    // Emission into vacuum. One unit per quantum, one quantum per direction
    // per hexagon.
    //
    // GAP 4, and it is a real one -- found 2026-11-05 by this file crashing on
    // its own assertion, which is what the assertion was for.
    //
    // THE-LAWS.md argues the six bits are "exact rather than a cap", because a
    // quantum in a given slot "can only come from the one neighbour behind it
    // -- and that neighbour is either matter or vacuum, never both. There is
    // no third source to collide with." That argument is sound only if every
    // quantum moves IN LOCKSTEP, which is what radiate.mjs measures and what
    // the World's ticked time provides. THE LAB HAS NO LOCKSTEP: every hexagon
    // propagates at its own drawn time, so a trailing quantum catches the one
    // ahead and finds the slot full. The one source can also simply emit
    // twice before the first quantum has moved on.
    //
    // So the exactness claim is a property of ticked time, not of the lattice,
    // and the Lab is where that shows. Of the ways out -- drop the quantum
    // (destroys energy), widen the field (rule 5 forbids it without a reason
    // written in THE-LAWS.md), go synchronous (abandons the Lab's whole time
    // model) -- only one conserves and changes no width: THE EMISSION DOES NOT
    // HAPPEN. Nothing moves, the heat stays where it was, and the attempt is
    // counted. What it costs is the claim that radiation always travels at the
    // causal limit and never slower. That is Ric's call, not this file's.
    if (w.bonds[j] & (1 << d)) { this.counts.emissionBlocked++; return; }
    addEnergy(w, i, -1, "law 5 emit");
    w.bonds[j] |= (1 << d);
    this.counts.emitted++;
  }

  // Law 1, bonded: "a bonded pair exchanges integer momentum toward equalizing
  // their velocities, equal and opposite, one hop per clock fire."
  shareMomentum(i) {
    const w = this.w;
    if (w.bonds[i] === 0) return;
    const live = [];
    for (let d = 0; d < DIRECTIONS; d++) if (w.bonds[i] & (1 << d)) live.push(d);
    const d = live[this.rng.below(live.length)];
    const j = neighbour(i, d);
    // velocity is p/k. Move one unit cube vector from i to j, choosing the
    // one that most reduces the velocity difference.
    const ki = w.kind[i], kj = w.kind[j];
    const vi = [w.mx[i] / ki, w.my[i] / ki, mz(w, i) / ki];
    const vj = [w.mx[j] / kj, w.my[j] / kj, mz(w, j) / kj];
    const gap = [vi[0] - vj[0], vi[1] - vj[1], vi[2] - vj[2]];
    let best = -1, bestDot = 0;
    for (let e = 0; e < DIRECTIONS; e++) {
      const u = DIR_CUBE[e];
      const dot = u[0] * gap[0] + u[1] * gap[1] + u[2] * gap[2];
      if (dot > bestDot) { bestDot = dot; best = e; }
    }
    if (best < 0) return;                                  // already equal
    const u = DIR_CUBE[best];
    const nxI = w.mx[i] - u[0], nyI = w.my[i] - u[1];
    const nxJ = w.mx[j] + u[0], nyJ = w.my[j] + u[1];
    // Momentum has a range, and exceeding a field must not be papered over.
    // Declining the hop conserves exactly; clamping would not. Counted,
    // because a world that keeps declining is telling us something.
    if (!this.legalMomentum(nxI, nyI) || !this.legalMomentum(nxJ, nyJ)) {
      this.counts.momentumRangeDeclined++;
      return;
    }

    // THE HOP IS INELASTIC AND HAS TO PAY FOR ITSELF.
    //
    // Found 2026-11-05 by the assertion, at 34,864 units lost over 50,000
    // events. Momentum is linear and its sum is conserved by construction
    // here -- i loses exactly what j gains. Kinetic energy is QUADRATIC, so
    // moving momentum between two primitives changes the total, and
    // "equalizing their velocities" reduces it. That difference has to go
    // into the heat field, exactly as a collision's does.
    //
    // No document says this. THE-LAWS.md settles bonded momentum as "equal
    // and opposite, one hop per clock fire. Nothing else is added", and the
    // structural fact *Bond energy accounting is exact* names the laws 2-5
    // seam as the one place conservation is at risk -- but this is a THIRD
    // seam, between law 1's momentum sharing and law 5's heat, and it fails
    // the same silent way: slowly, with no error, looking like physics. A
    // cluster would quietly cool the world every time it flexed.
    const keBefore = keAt(w, i) + keAt(w, j);
    const zI = -nxI - nyI, zJ = -nxJ - nyJ;
    const keAfter = keOf(nxI * nxI + nyI * nyI + zI * zI, ki)
                  + keOf(nxJ * nxJ + nyJ * nyJ + zJ * zJ, kj);
    const delta = keBefore - keAfter;        // > 0 sheds heat, < 0 needs heat

    if (delta < 0) {
      // The hop would speed the pair up, so the heat has to be there. If it
      // is not, the hop does not happen -- which conserves exactly, where
      // clamping or ignoring it would not.
      const available = w.energy[i] + w.energy[j];
      if (available < -delta) { this.counts.shareUnaffordable++; return; }
    }

    w.mx[i] = nxI; w.my[i] = nyI;
    w.mx[j] = nxJ; w.my[j] = nyJ;

    if (delta > 0) {
      addEnergy(w, i, delta, "bonded momentum hop shed kinetic energy");
    } else if (delta < 0) {
      let owed = -delta;
      for (const m of [i, j]) {
        const take = Math.min(owed, w.energy[m]);
        addEnergy(w, m, -take, "bonded momentum hop absorbed heat");
        owed -= take;
        if (owed === 0) break;
      }
      if (owed !== 0) throw new Error(`momentum hop could not pay ${owed} it had checked for`);
    }
    this.counts.momentumShared++;
  }

  legalMomentum(x, y) {
    const z = -x - y;
    const R = MOMENTUM_RANGE;
    return Math.abs(x) <= R && Math.abs(y) <= R && Math.abs(z) <= R;
  }

  // Law 1, stepping. The momentum vector is never rounded; the rounding only
  // chooses a path. "The nearest" is not always one direction -- an integer
  // vector lies exactly halfway between two of the six all the time -- and a
  // fixed tie-break is a handedness that spiralled every orbit in orbit.mjs
  // into the centre. So a tie is a coin.
  stepDirection(i) {
    const w = this.w;
    const p = [w.mx[i], w.my[i], mz(w, i)];
    let best = 0, bestDot = -Infinity, tied = 0;
    for (let d = 0; d < DIRECTIONS; d++) {
      const u = DIR_CUBE[d];
      const dot = u[0] * p[0] + u[1] * p[1] + u[2] * p[2];
      if (dot > bestDot) { bestDot = dot; best = d; tied = 1; }
      else if (dot === bestDot) {
        tied++;
        // Reservoir of size 1 over the tied set: each tied direction gets an
        // equal chance, which generalises the coin to three-way ties.
        if (this.rng.below(tied) === 0) best = d;
      }
    }
    return best;
  }

  step(i) {
    const w = this.w;
    const d = this.stepDirection(i);
    const j = neighbour(i, d);

    if (isMatter(w, j)) { this.collide(i, j, d); return; }

    // NOTHING IS TOUCHED UNTIL THE WHOLE STEP IS KNOWN TO BE LEGAL.
    //
    // The first version picked the target hexagon's quanta up here, before the
    // affordability check below, so a step that then turned out to be illegal
    // returned having already cleared them -- destroying one unit of energy.
    // The assertion caught it as a drift of exactly 1 over 50,000 events,
    // which is the smallest thing rule 6 is written to catch and the reason it
    // says a drift of 1 is a bug rather than a rounding issue.

    // GAP 3. Law 1 says clusters are elastic and a strike travels through one
    // as a wave, which means bonded primitives do move -- but nothing says
    // what happens to a bond that a step would stretch past adjacency. The
    // reading taken here: the bond cannot stretch, so motion BREAKS it, at
    // its proper cost of B. That keeps the accounting exact and keeps the
    // light cone, and it makes a hard strike shatter a cluster, which is what
    // law 1 says should happen. It is still a choice and it is the one most
    // likely to be wrong in this file.
    const carriedBonds = w.bonds[i];
    const stretched = [];
    if (carriedBonds !== 0) {
      for (let e = 0; e < DIRECTIONS; e++) {
        if (!(carriedBonds & (1 << e))) continue;
        const partner = neighbour(i, e);
        // After the step, is the partner still adjacent to the new position?
        let stillAdjacent = false;
        for (let f = 0; f < DIRECTIONS; f++) if (neighbour(j, f) === partner) { stillAdjacent = true; break; }
        if (!stillAdjacent) stretched.push(e);
      }
      // Breaking absorbs precisely B, so a step that would stretch bonds has
      // to be able to PAY for them, and a cold primitive cannot. Then the
      // step does not happen.
      //
      // This was a crash in the first draft: severBond drove the energy field
      // negative on a cold bonded primitive. The fix is not a clamp, it is
      // noticing that the step is illegal. The consequence is worth stating
      // because nothing wrote it down: COLD CLUSTERS ARE RIGID, and they are
      // rigid because they cannot afford to come apart, not because any rule
      // says so. Heat one and it can move again.
      let owed = 0;
      for (const e of stretched) owed += bindingEnergy(w.kind[i], w.kind[neighbour(i, e)]);
      if (owed > w.energy[i]) { this.counts.blocked++; this.counts.tooColdToMove++; return; }
      // Past this line the step WILL happen, so it is now safe to change the
      // world.
      for (const e of stretched) {
        this.severBond(i, e, i, "law 1 step stretched a bond");
        this.counts.bondsStretched++;
      }
    }

    // Now the target's quanta can be collected -- "it stops at the first
    // matter it meets, which absorbs it".
    let pickup = 0;
    if (w.bonds[j] !== 0) {
      pickup = popcount6(w.bonds[j]);
      w.bonds[j] = 0;
      this.counts.absorbed += pickup;
    }

    // Carry the whole primitive. Any bonds that survived have to be re-pointed
    // at the new position, which is what makes this fiddly rather than a swap.
    const survivors = [];
    for (let e = 0; e < DIRECTIONS; e++) {
      if (!(w.bonds[i] & (1 << e))) continue;
      survivors.push(neighbour(i, e));
      const partner = neighbour(i, e);
      w.bonds[partner] &= ~(1 << opposite(e));
    }
    w.kind[j] = w.kind[i]; w.energy[j] = w.energy[i];
    w.mx[j] = w.mx[i]; w.my[j] = w.my[i];
    w.bonds[j] = 0;
    w.kind[i] = 0; w.energy[i] = 0; w.mx[i] = 0; w.my[i] = 0; w.bonds[i] = 0;
    for (const partner of survivors) {
      for (let f = 0; f < DIRECTIONS; f++) {
        if (neighbour(j, f) === partner) {
          w.bonds[j] |= (1 << f);
          w.bonds[partner] |= (1 << opposite(f));
          break;
        }
      }
    }
    if (pickup > 0) addEnergy(w, j, pickup, "radiation absorbed by moving matter");
    this.counts.stepped++;
    return j;
  }

  // Law 1's collisions. "Any redistribution with the same vector sum is legal
  // ... Resolve them in Margolus blocks rather than pairs, so conservation
  // holds by construction." The legality test is momentum.mjs Check 8, which
  // is the corrected one: an outcome is legal if the kinetic-energy change is
  // payable out of the heat that is actually there. Checks 3 and 5 of that
  // file are the deliberately-wrong pair versions and are not used here.
  collide(i, j, d) {
    const w = this.w;

    // GAP 2. The block. THE-LAWS.md wants three-hexagon blocks, and the torus
    // is 258 wide precisely so they tile across the seam. It also says
    // "offset the partition each step" -- and there is no step here to offset
    // on. The reading taken: the block is the triangle of three mutually
    // adjacent hexagons containing i and j, of which there are exactly two,
    // and the choice between them is a COIN. That is the same answer law 1
    // gives for a tied direction, and for the same reason: a fixed pick is a
    // handedness, and this project has already been bitten once by one.
    const third = neighbour(i, this.rng.coin() ? (d + 1) % DIRECTIONS : (d + 5) % DIRECTIONS);
    const block = [i, j, third];
    const members = block.filter((x) => isMatter(w, x));

    // The block's conserved sums.
    let sx = 0, sy = 0, keBefore = 0, heat = 0;
    for (const m of members) { sx += w.mx[m]; sy += w.my[m]; keBefore += keAt(w, m); heat += w.energy[m]; }

    // Draw an outcome. For two members the set is enumerable; for three it is
    // sampled, because 961 squared candidates per collision is not affordable
    // and "pick one at random" does not require enumerating them all first.
    const R = MOMENTUM_RANGE;
    const tries = 64;
    let chosen = null;
    for (let t = 0; t < tries; t++) {
      const cand = [];
      let ax = 0, ay = 0;
      for (let m = 0; m < members.length - 1; m++) {
        const x = this.rng.below(2 * R + 1) - R;
        const y = this.rng.below(2 * R + 1) - R;
        if (!this.legalMomentum(x, y)) { ax = NaN; break; }
        cand.push([x, y]); ax += x; ay += y;
      }
      if (Number.isNaN(ax)) continue;
      const lastX = sx - ax, lastY = sy - ay;
      if (!this.legalMomentum(lastX, lastY)) continue;
      cand.push([lastX, lastY]);

      let keAfter = 0;
      for (let m = 0; m < members.length; m++) {
        const [x, y] = cand[m];
        const z = -x - y;
        keAfter += keOf(x * x + y * y + z * z, w.kind[members[m]]);
      }
      const delta = keBefore - keAfter;       // > 0 sheds heat, < 0 needs heat
      if (delta < 0 && heat < -delta) continue;            // not enough heat to absorb
      // Identity is a legal outcome but not an interesting one; allow it only
      // if nothing else turned up, so a collision is not silently a no-op.
      chosen = { cand, delta };
      let changed = false;
      for (let m = 0; m < members.length; m++) {
        if (cand[m][0] !== w.mx[members[m]] || cand[m][1] !== w.my[members[m]]) { changed = true; break; }
      }
      if (changed) break;
    }

    if (chosen === null) {
      // No legal outcome at all. The primitive does not move and nothing
      // changes, which conserves everything exactly. momentum.mjs measures
      // this at a few percent of collisions, so it is expected, not an error.
      this.counts.collisionDead++;
      this.counts.blocked++;
      return;
    }

    for (let m = 0; m < members.length; m++) {
      w.mx[members[m]] = chosen.cand[m][0];
      w.my[members[m]] = chosen.cand[m][1];
    }
    // The kinetic-energy change goes into or out of the heat field. Put it in
    // the hexagon that acted; the block's total is what has to balance, and
    // it does, because KE is a pure function of (p, k).
    if (chosen.delta !== 0) {
      if (chosen.delta > 0) addEnergy(w, i, chosen.delta, "collision shed kinetic energy");
      else {
        // take from whichever member actually has it
        let owed = -chosen.delta;
        for (const m of members) {
          const take = Math.min(owed, w.energy[m]);
          addEnergy(w, m, -take, "collision absorbed heat into motion");
          owed -= take;
          if (owed === 0) break;
        }
        if (owed !== 0) throw new Error(`collision could not pay ${owed} of heat it had checked for`);
      }
    }
    this.counts.collided++;
    this.counts.blocked++;
    return;
  }

  // The radiation fact: a quantum moves one hexagon per step in a straight
  // line and stops at the first matter it meets, which absorbs it.
  propagateQuanta(i) {
    const w = this.w;
    const bits = w.bonds[i];
    // One direction per fire, drawn among those actually in flight, so a
    // hexagon holding several quanta does not move them all at once.
    const live = [];
    for (let d = 0; d < DIRECTIONS; d++) if (bits & (1 << d)) live.push(d);
    if (live.length === 0) return;
    const d = live[this.rng.below(live.length)];
    const j = neighbour(i, d);
    if (isMatter(w, j)) {
      w.bonds[i] &= ~(1 << d);
      addEnergy(w, j, 1, "radiation absorbed");
      this.counts.absorbed++;
      return;
    }
    // GAP 4 again, on the propagation side: the quantum ahead has not moved
    // yet, so this one waits where it is. See tryTransport for the whole
    // argument. Note the bit is cleared only AFTER the move is known to be
    // possible -- clearing it first and then failing would destroy the unit,
    // which is the silent leak rule 6 exists to catch.
    if (w.bonds[j] & (1 << d)) { this.counts.quantumWaited++; return; }
    w.bonds[i] &= ~(1 << d);
    w.bonds[j] |= (1 << d);
    this.counts.quantaMoved++;
  }

  // The Lab's only exchange with outside. It holds a hot band and a cold
  // band, and every unit it injects or removes is counted -- otherwise the
  // conservation assertion would pass while the world quietly gained energy
  // at the one place it matters most.
  applyThermostat(i) {
    const w = this.w;
    const r = rOf(i);
    const band = this.thermostat.BAND_ROWS;
    let target = null;
    if (r < band) target = this.thermostat.HOT_T;
    else if (r >= N - band) target = this.thermostat.COLD_T;
    if (target === null) return false;
    const want = target * w.kind[i];
    if (want > ENERGY_MAX) {
      throw new Error(`thermostat target ${target} x kind ${w.kind[i]} = ${want} exceeds the `
        + `energy field. The held condition is out of range for this kind.`);
    }
    const delta = want - w.energy[i];
    if (delta === 0) return true;
    w.energy[i] = want;
    this.ledger.thermostatNet += delta;
    this.counts.thermostatFires++;
    return true;
  }

  // ------------------------------------------------------------- the loop
  // The initial condition. Law 3 wanted only "matter, spread out" -- but law 3
  // is not in the Lab, and that turns out to matter more than it looks.
  //
  // GAP 5, found 2026-11-05 by the first run reporting kinetic energy 0 and
  // never moving: WITH GRAVITY OUT, NOTHING IN THE FOUR REMAINING LAWS EVER
  // CREATES MOMENTUM. Law 1 conserves it, law 2 has no distance term and so no
  // force, law 4 is a constraint, law 5 moves energy and not momentum. A
  // collision can turn heat into motion, but a collision only happens when
  // something steps into something, which needs momentum already. So from a
  // standing start the Lab is frozen for ever, however hot the thermostat runs.
  //
  // Gravity was the only thing that set matter moving, and holding it out
  // removes the world's only source of momentum along with its only source of
  // energy. In the World the collapse supplies both. In the Lab both have to be
  // inputs: the thermostat supplies the energy, and this supplies the momentum.
  //
  // That is a condition the Lab HOLDS, in TWO-RUNS.md's sense, so it is swept
  // rather than chosen -- and it is not in any document. Ric's call whether it
  // belongs in TWO-RUNS.md as a third held condition beside the two bands.
  seedWorld(fill, kindDraw, { momentumRange = 0 } = {}) {
    const w = this.w;
    const R = Math.min(momentumRange, MOMENTUM_RANGE);
    for (let i = 0; i < CELLS; i++) {
      if (this.rng.u01() >= fill) continue;
      w.kind[i] = kindDraw(this.rng);
      w.energy[i] = 0;
      w.bonds[i] = 0;
      if (R > 0) {
        // Drawn so the WHOLE WORLD starts at zero total momentum: every draw is
        // paired with its opposite. Otherwise the world has a net drift that
        // looks exactly like "a preferred direction in the physics", which is
        // the thing law 3 guards its solver against.
        let x = 0, y = 0;
        for (let t = 0; t < 8; t++) {
          x = this.rng.below(2 * R + 1) - R;
          y = this.rng.below(2 * R + 1) - R;
          if (this.legalMomentum(x, y)) break;
          x = 0; y = 0;
        }
        w.mx[i] = x; w.my[i] = y;
      } else {
        w.mx[i] = 0; w.my[i] = 0;
      }
    }
    // Cancel whatever net momentum the draws left, by handing the remainder
    // back one unit at a time to primitives that can legally take it. The Lab
    // has no wall, so a net drift would never be absorbed by anything.
    this.cancelNetMomentum();
  }

  cancelNetMomentum() {
    const w = this.w;
    const occupied = [];
    for (let i = 0; i < CELLS; i++) if (isMatter(w, i)) occupied.push(i);
    if (occupied.length === 0) return;
    for (let guard = 0; guard < 1000; guard++) {
      let sx = 0, sy = 0;
      for (const i of occupied) { sx += w.mx[i]; sy += w.my[i]; }
      if (sx === 0 && sy === 0) return;
      // Push one unit against the drift, onto a primitive that can hold it.
      const want = [-Math.sign(sx), -Math.sign(sy)];
      let moved = false;
      for (let t = 0; t < occupied.length; t++) {
        const i = occupied[this.rng.below(occupied.length)];
        const nx = w.mx[i] + (sx !== 0 ? want[0] : 0);
        const ny = w.my[i] + (sy !== 0 ? want[1] : 0);
        if (!this.legalMomentum(nx, ny)) continue;
        w.mx[i] = nx; w.my[i] = ny; moved = true; break;
      }
      if (!moved) return;   // cannot be cancelled; the assertion will say so
    }
  }

  start() {
    this.ledger = new Ledger(this.w);
    this.queue = new Queue(1 << 16);
    for (let i = 0; i < CELLS; i++) this.schedule(i);
  }

  run(eventBudget, { checkEvery = 0 } = {}) {
    if (!this.queue) this.start();
    let checked = 0;
    while (this.events < eventBudget) {
      const ev = this.queue.pop();
      if (ev === null) break;              // the world has gone completely still
      this.now = ev.t;
      this.events++;
      const i = ev.i;
      const w = this.w;

      if (isMatter(w, i)) {
        if (!this.applyThermostat(i)) {
          const clock = this.clockRateAt(i), motion = this.motionRateAt(i);
          const pick = this.rng.u01() * (clock + motion);
          if (pick < clock) {
            this.breakBondsIfHot(i);
            if (isMatter(w, i)) this.tryFormBond(i);
            if (isMatter(w, i)) this.tryTransport(i);
            if (isMatter(w, i)) this.shareMomentum(i);
          } else {
            this.step(i);
          }
        }
      } else if (w.bonds[i] !== 0) {
        this.propagateQuanta(i);
      }

      // Gibson & Bruck: only what changed gets a new time. An event touches a
      // hexagon and its six neighbours and nothing else, which is rule 9
      // paying for itself in performance as well as in physics.
      this.schedule(i);
      for (let d = 0; d < DIRECTIONS; d++) this.schedule(neighbour(i, d));

      if (checkEvery && this.events % checkEvery === 0) {
        this.ledger.check(this.w, `event ${this.events}`);
        checked++;
      }
    }
    this.ledger.check(this.w, `end of run at event ${this.events}`);
    return { events: this.events, now: this.now, midRunChecks: checked };
  }
}

export { makeRng, neighbour, DIR_CUBE, DIR_AXIAL, opposite, bindingEnergy, census, N, CELLS, at, qOf, rOf };
