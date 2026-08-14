/* A motorway with nobody watching it.

   `node test/sim.test.js` from projects/offramp.

   ══════════════════════════════════════════════════════════════════════
   This is the MEASURING APPARATUS for the motive layer, and it is
   deliberately built before the motive layer is. `traffic.js` says how
   many vehicles there are, of what kind, wanting to go how fast, driven
   by whom. This file puts them on a stretch of road, steps them at 10 Hz
   for as many simulated hours as you ask for, and counts what happened —
   with no canvas, no DOM, no game state and no frame rate. A run is a
   seed and a place and a clock, and it returns numbers.

   The point is stated in BEHAVIOUR.md §5 and PLAN.md §5c: everything
   measured off real trajectories is the RATE and the DURATION of a
   manoeuvre, never its motive, and

     "a model that changes lane at 0.37 per vehicle-km at random
      reproduces every number in §2 and still looks wrong."

   So a harness that only checks the rate is worthless — the rate can be
   hit by aiming at it, and this file ships a decider that does exactly
   that in order to prove the point. What the harness is FOR is the
   numbers that cannot be aimed at without giving the game away:

     · lorries take 1.2% of the left lane, on a road with no restriction
       requiring it
     · the lanes run a 15 mph gradient left to right
     · the headway distribution has the measured shape at the measured
       flow — median 1.50 s with a fifteenth percentile of 0.71
     · the manoeuvre takes 4.24 s and nothing anywhere says so

   Those fall out of the motives or they do not, and this is the thing
   that says which. `test/sim.test.js` is the scoreboard.

   ── what is physical here and what is a decision ──────────────────────
   The harness owns everything that is not a motive:

     the following model     IDM, parameterised by the measured traits
     the manoeuvre           a lateral acceleration, so DURATION emerges
     gap acceptance          a safety criterion, per driver temperament
     arrivals                Poisson at the counted flow, lane uniform
     the counting            zones, warm-up, percentiles

   and it owns none of the deciding. `decide(veh, view, ctx)` returns the
   lane a vehicle wants and how badly, or null. The seven motives of
   PLAN.md §5c go behind that one call and nothing else in this file has
   to change when they do.

   ── the two null models it ships with ─────────────────────────────────
     Sim.deciders.stay        nobody ever moves. The floor: this is what
                              car-following alone is responsible for.
     Sim.deciders.random(r)   a Poisson process at r per metre, aimed
                              straight at 0.37/veh-km. The straw man the
                              documentation names.

   Neither is the model. They are here so that the scoreboard has a
   before, and so that the day the motives land it is possible to say
   what they were worth rather than that they felt better.
   ══════════════════════════════════════════════════════════════════════ */
const Sim = (() => {
  "use strict";

  const TR = (typeof Traffic !== "undefined") ? Traffic
           : (typeof require !== "undefined") ? require("./traffic.js") : null;
  const IM = (typeof Impact !== "undefined") ? Impact
           : (typeof require !== "undefined") ? require("./impact.js") : null;

  const M_PER_PX = 0.179;          // data/i40.js: 1 world px = 0.179 m
  const MPH = 0.44704;
  const LANE_W = 3.7;              // metres, US standard

  /* ── the following model ──────────────────────────────────────────────
     IDM, because it is the one car-following model whose parameters are
     the things BEHAVIOUR.md actually measured. `T` is the time headway
     the driver holds, drawn per driver from 114,781 measured pairs; `v0`
     is its desired speed, off I-40's own counters. Neither is fitted
     here — they were measured elsewhere for other reasons and are simply
     plugged in.

     The check that this is the right model is arithmetic and worth doing
     out loud. IDM's equilibrium spacing is s0 + v.T, so a driver holding
     T = 1.50 s at the measured free-flow 62 mph sits 2 + 41.6 = 43.6 m
     behind the vehicle in front. BEHAVIOUR.md measured the median gap at
     **40.5 m** and the median time headway at **1.50 s** as two separate
     statistics, and 40.5 / 27.7 = 1.46 s. The model's own geometry lands
     on the measured pair without being told to.

     A (maximum acceleration) and B (comfortable braking) are DECIDED,
     but only just. BEHAVIOUR.md §2 puts ordinary driving inside
     ±1.1 m/s² over both classes — and warns that both datasets CLAMP
     acceleration, so the tails of the measured distribution are the
     instrument and not the drivers. These are therefore shaped by the
     middle of that measurement, and what the run actually realises is
     checked back against ±1.1 in the test rather than assumed here. */
  const IDM = {
    moto:  { A: 1.6, B: 2.0, s0: 1.5 },
    car:   { A: 1.2, B: 1.8, s0: 2.0 },
    rigid: { A: 0.8, B: 1.6, s0: 3.0 },
    artic: { A: 0.6, B: 1.5, s0: 4.0 },
  };
  const BRAKE_MAX = 9.0;           // m/s², the floor no model output passes
  const DELTA = 4;                 // IDM's free-acceleration exponent

  /* ── the first thing this harness found, and it is a real one ─────────
     `driver.headway` in traffic.js is drawn off BEHAVIOUR.md's 114,781
     measured pairs — p15 0.71, median 1.50, p85 3.57. That distribution
     is **what the gaps on a motorway are**, and it is not the same
     quantity as **what a driver is trying to hold**, because most of the
     traffic on a free-flowing motorway is not following anybody. A pair
     5.83 s apart is not a driver who wants 5.83 s; it is a driver with
     nothing in front of it.

     Feed the observed distribution in as a desired time gap and the
     model prices every vehicle as if it were constrained. Its lane
     capacity comes out at about 1,300 veh/h against a real 2,000, so
     Knoxville at two in the afternoon queues at the boundary and settles
     at 45 mph on a road where the counters measure free flow. The first
     run of this harness did exactly that, which is what it is for.

     T_SCALE is the correction and it is ONE number, not a per-percentile
     fudge: the desired gap is the observed distribution scaled down,
     which keeps its shape — the tailgater is still the same driver at
     the same place in the population — and the OBSERVED distribution
     then has to come back out of the run, tail and all, as the check.
     Calibrated against all five measured percentiles at the reference
     flow. See `test/sim.test.js` §2.

     It belongs here rather than in traffic.js because traffic.js's job
     is to report what was counted and this is what a following model has
     to do with it. */
  const T_SCALE = 0.47;

  function idm(v, v0, gap, dv, p) {
    // dv is CLOSING speed: this vehicle's speed minus its leader's.
    const free = 1 - Math.pow(Math.max(0, v) / Math.max(1, v0), DELTA);
    if (gap == null) return p.A * free;
    const g = Math.max(0.5, gap);
    const want = p.s0 + Math.max(0, v * p.T + (v * dv) / (2 * Math.sqrt(p.A * p.B)));
    return Math.max(-BRAKE_MAX, p.A * (free - (want / g) * (want / g)));
  }

  /* ── the manoeuvre ────────────────────────────────────────────────────
     A lane change takes as long as it takes, and how long that is is one
     of the four numbers this harness exists to check. So it must NOT be
     drawn from the measured distribution — that would be aiming at the
     answer. It comes out of a lateral acceleration instead.

     Move sideways by LANE_W on a sinusoidal lateral-velocity profile
     (zero lateral speed at both ends, which is what makes a lane change
     look like a lane change and not a swerve) and the peak lateral
     acceleration is 2.pi.W/T². Invert it:

       T = sqrt(2.pi.LANE_W / aLat)

     The measured duration distribution then says what aLat has to be:
     a median of 4.24 s wants 1.29 m/s², the p15 of 2.9 s wants 2.76 and
     the p85 of 5.6 s wants 0.74. That is a wide spread with a brisk
     middle — a lane change is a sharper manoeuvre than it feels — and it
     is a real finding of turning the measurement round.

     **This one is CALIBRATED and not emergent, and the test says so.**
     The first attempt derived aLat from `push` alone and it cannot be
     done: `push` is 1 − headway/3 s, so a quarter of all drivers sit at
     exactly zero and the trait has no room left at the aggressive end.
     Fitting the measured p15, p50 and p85 through it needs a lateral
     acceleration of 5.4 m/s² at the top, which is half a gravity
     sideways and is not a lane change, it is losing it. So lateral
     vigour is its own draw — lognormal, median 1.29 m/s², correlated
     with `push` at about a half, clipped at both ends — and the round
     trip through `durationOf` is a check on the arithmetic rather than
     on the model. The numbers that ARE emergent are the rate, the lane
     gradient and the lorry share, and those are the ones to read. */
  const LAT = { med: 1.210, sig: 0.635, lo: 0.45, hi: 4.5, rho: 0.5 };

  /* Irwin-Hall: three uniforms, centred and scaled to unit variance and
     bounded at ±3, which is close enough to a normal for this and cannot
     produce the 6-sigma lane change a real one occasionally would. */
  const zOf = (a, b, c) => (a + b + c - 1.5) * 2;

  /* push is measured off the run of drivers traffic.js draws: mean
     0.405, sd 0.308, with a quarter of them at zero. */
  function latAccel(drv, z) {
    const zp = Math.max(-2.5, Math.min(2.5, (drv.push - 0.405) / 0.308));
    const zz = LAT.rho * zp + Math.sqrt(1 - LAT.rho * LAT.rho) * (z || 0);
    return Math.max(LAT.lo, Math.min(LAT.hi, LAT.med * Math.exp(LAT.sig * zz)));
  }
  const durationOf = (a) => Math.sqrt((2 * Math.PI * LANE_W) / a);

  /* Lateral progress 0..1 against fraction of the manoeuvre elapsed:
     the integral of that sinusoidal velocity profile, normalised. */
  const lateral = (f) => f - Math.sin(2 * Math.PI * f) / (2 * Math.PI);

  /* ── gap acceptance ───────────────────────────────────────────────────
     Whether a vehicle MAY move into the lane it wants. This is the
     harness's job and not a motive's: a motive says where it wants to
     be, physics and nerve say whether it goes.

     The criterion is the standard one and it is the right shape — the
     arriving vehicle must not force the vehicle it arrives in front of
     to brake harder than that driver will wear, and must not have to
     brake harder than that itself. What is per-driver is the tolerance,
     off the `gap` trait, which traffic.js draws as a fraction of the
     headway the driver chooses to hold and which is always tighter than
     it: people accept gaps they would not sit in.

     This is deliberately where a mistake comes from. Drawn at the short
     end and met with a closing speed it was not drawn for, a driver
     takes a gap that was not there. There is no `mistake()` anywhere and
     there is not going to be. */
  const B_SAFE = 4.0;              // m/s² a patient driver will impose
  const tolerable = (drv) => B_SAFE * (0.55 + 0.9 * drv.gap);

  /* ══ what a driver can actually see ══════════════════════════════════
     Until this block existed no vehicle in the sim could hit another
     one, and the reason was not that they were careful. It was that
     every driver knew, exactly and instantaneously, where the vehicle in
     front was and how fast it was going. Give a car-following model
     perfect information with no delay and it is provably collision-free;
     nothing you do to the motives will ever produce a crash, because the
     motives are not where crashes come from.

     Crashes come from four things and all four are in here.

     ── 1. reaction time, and the constant that is two constants ────────
     A driver acts on the road as it was, not as it is. The first version
     of this used the textbook perception-reaction time for it — 1.1 s
     median, AASHTO's 2.5 s at the 95th percentile — and produced a road
     that crashed **five orders of magnitude** more often than a real
     one. Every crash was the same crash: a low-speed shunt into the back
     of a standing queue, at three to twelve metres a second.

     That number is not wrong, it is the wrong quantity. AASHTO's 2.5 s
     is the time to respond to an UNEXPECTED OBJECT — a deer, a stopped
     car round a blind bend, something the driver was not already
     watching. It is measured, and designed to, for exactly that case.
     The delay in ordinary car-following is a different thing entirely:
     the driver is already looking at the only object that matters, has
     been for the last ten minutes, and is tracking it continuously. The
     delayed-response following literature puts THAT at 0.4–0.8 s, and a
     platoon is string-stable at 0.6 and comes apart at 1.5.

     So the two are separated, and the AASHTO figure is not discarded —
     it is reassembled out of its parts. TRACK is the tracking delay. The
     unexpected-object case is a driver who was looking somewhere else,
     which is mechanism 4 below, and a driver 1.5 s into a glance with a
     0.9 s tracking delay is 2.4 s behind the road. That is AASHTO's
     number, arrived at rather than posted, and it now applies when it is
     actually true instead of to everybody all the time.

     The delayed state is EXTRAPOLATED forward at the speed it was last
     seen doing. That is not a refinement, it is the difference between a
     model and a bug: without it every driver systematically
     underestimates the gap by v.TRACK and the whole road backs off by
     thirty metres. Extrapolated, the delay costs nothing at all in
     steady state and bites only when the vehicle in front CHANGES what
     it is doing — which is exactly when a crash happens, and is why this
     is the mechanism rather than a fudge.

     ── 2. brake lights ─────────────────────────────────────────────────
     The one piece of information a vehicle broadcasts. A driver watching
     lit brake lights is primed and responds in about two thirds the
     time; this is the entire reason the lamp is fitted, and it is why a
     motorway does not pile up every time somebody lifts off.

     ── 3. looking further ahead than the car in front ──────────────────
     Ric's requirement, and it is also what makes the model stable. Real
     drivers watch several vehicles up and brake before the car in front
     does. A model with single-vehicle anticipation and a real reaction
     time is string-unstable and turns a motorway into a demolition derby
     within a minute. Every vehicle within SIGHT is considered and the
     most binding of them wins.

     ANTICIPATE is a COUNT CAP and nothing else — a cost limit, not the
     model. It used to be the model, set at three vehicles, and that is a
     silent disaster: three vehicles is 120 m of free-flowing motorway
     and 15 m of a stopped queue. So the one situation where seeing a
     long way is the entire difference between braking early and dying is
     precisely the situation where a vehicle count blinds the driver to
     everything past their own bonnet. Park a wreck across a lane and the
     road did not queue behind it, it disintegrated: 82 wrecks in twenty
     minutes, every one of them somebody who could not see a wall of
     stationary traffic 200 m away.

     What a driver sees is a DISTANCE. At 27 m/s with a queue 200 m up,
     IDM's own arithmetic wants 269 m of room and returns −2.2 m/s² — a
     gentle lift, from a long way out, growing as you close. That is what
     approaching a jam is, and it falls out of the model as soon as the
     model is allowed to look.

     ── 4. and not looking at all ───────────────────────────────────────
     The honest one. Freeway rear-end crashes are overwhelmingly an
     attention failure rather than a judgement failure — the driver was
     looking at something else and the road had changed when they looked
     back. So a driver occasionally glances away for a second or two, at
     a rate set by a temperament trait, and during a glance the perceived
     state simply stops updating.

     This is a mechanism, not a `mistake()`: nothing anywhere decides
     that this vehicle should crash. A long reaction time, drawn once,
     meeting a glance, drawn from its own rate, meeting a lorry braking
     for a dam it could not see round — that is a mistake, and it needs
     no code that knows it is one. GLANCE_BASE is DECIDED; the shape of
     it is not, because naturalistic driving studies are unanimous that
     eyes-off-road is common and that the tail beyond two seconds is
     where the crashes are. */
  const TRACK = { med: 0.60, sig: 0.30, lo: 0.25, hi: 1.6 };  // seconds
  const BRAKE_PRIMED = 0.65;       // multiplier when the lamps are lit
  const BRAKE_LIGHT = -1.2;        // m/s² at which they come on
  const ANTICIPATE = 12;           // COUNT CAP only; SIGHT is the real limit
  const GLANCE_BASE = 1 / 22;      // glances per second at attention 0
  const GLANCE = { lo: 0.6, hi: 3.2 };                        // seconds each
  /* The ring has to be long enough to hold the WORST case, because a
     ring that saturates silently caps the very tail the crashes come
     out of. Slowest tracking 1.6 s plus longest glance 3.2 s is 4.8, so
     6 s of it at dt = 0.1 with room to spare. */
  const HIST = 60;

  /* Sight. A stopped vehicle beyond this is not there yet, which is what
     makes a wreck on an empty road at night a different event from the
     same wreck in daylight traffic. Daylight on a straight is generous;
     the corridor's own curvature and the dark are for later, and are
     flagged in PLAN.md rather than faked here. */
  const SIGHT = 300;               // metres

  /* ══ what a vehicle weighs and how big it is ═════════════════════════
     impact.js is pure SI and takes mass, yaw inertia and a contact
     geometry, so the sim has to know what its vehicles physically are.
     `car` and `semi` are impact.js's own BODIES entries and are used
     unchanged; the other two are built on the same basis.

     Iz is impact.js's own formula, 0.8.m.(L²+W²)/12 — the 0.8 being a
     vehicle's mass sitting more centrally than a uniform slab. Lengths
     come per vehicle from traffic.js's measured distribution, so the
     inertia is computed rather than tabulated. */
  const BODY = {
    moto:  { m: 250,   w: 0.8, mu: 0.60 },
    car:   { m: 1500,  w: 1.9, mu: 0.55 },
    rigid: { m: 9000,  w: 2.5, mu: 0.55 },
    artic: { m: 36000, w: 2.6, mu: 0.55 },
  };
  const izOf = (m, len, w) => 0.8 * m * (len * len + w * w) / 12;

  /* ══ and what happens afterwards ═════════════════════════════════════
     A wrecked vehicle is not deleted and it is not a scoring event. It
     is a stationary object in a live lane, which is the whole reason
     traffic is worth simulating: PLAN.md §5c's `avoid` motive is the one
     that makes "wrecks make traffic, which is the game".

     WRECK_DECEL is a vehicle off the throttle with its wheels pointing
     the wrong way — about six tenths of a g, so a car doing 70 stops in
     roughly five seconds and sixty metres, sideways.

     CLEAR is how long before the wreckage is gone. DECIDED, and it
     matters for long runs only: without it a ten-hour run ends with the
     carriageway full of stopped vehicles, which is true of a road with
     no emergency services and of nothing else. */
  const WRECK_DECEL = 0.6 * 9.81;
  const CLEAR = 20 * 60;           // seconds before the wreck is removed

  /* ── being in a crash and being stopped by one are different ────────
     impact.js's `outcome` says how badly hurt somebody is. It does not
     say whether the vehicle still drives, and treating those as the same
     question is what turned one wreck into sixty-five.

     Park a car across a lane at the reference flow and the queue behind
     it produces shunts, because queues do. They arrive at 3–8 m/s of
     closing speed and 12–18 km/h of effective delta-v — a scraped
     bumper, a cracked lamp, two drivers exchanging details. Score every
     one of those as an immobile obstacle for the next twenty minutes and
     each one seeds its own queue, which produces its own shunts: the
     carriageway was down to 3 mph in all four lanes inside twenty
     minutes, off ONE staged wreck.

     So there is a second threshold and it is about the vehicle rather
     than the person. Below it the cars are damaged and driven away, and
     the traffic closes over the incident the way it does in life. Above
     it — a bent subframe, a radiator through the fan, or anybody hurt
     badly enough that nothing is moving until help arrives — the vehicle
     is where it stopped.

     IMMOBILE is DECIDED, at roughly the delta-v where airbags fire and
     the crumple structure is into the rails rather than the bumper. */
  const IMMOBILE = 30;             // km/h of effective delta-v

  /* ══ and how often any of it is supposed to happen ═══════════════════
     This is the number that decides whether the perception model above
     is a model or a demolition derby, and it is worth writing down
     before looking at what the run produces, because it is very easy to
     build a sim whose crashes look plausible one at a time and which is
     wrong by two orders of magnitude in the aggregate.

     A US freeway runs at roughly **one police-reported crash per
     million vehicle-miles** — rural interstate is nearer 0.5, urban
     freeway nearer 2. That is 0.62 per million vehicle-KILOMETRES, and
     it is a startlingly small number: this harness's reference run does
     about 10,000 veh-km, so the honest expectation for a single test
     run is **0.006 crashes**. A run that produces one is already a
     hundred times too dangerous.

     So crash count is not a thing a short run can measure, and the test
     must not pretend otherwise. What a short run CAN measure is the
     surrogates the safety literature uses for exactly this reason —
     time-to-collision below 1.5 s, and braking harder than 0.3 g — and
     those are collected every step. The crash rate itself needs a long
     run, which is what `test/crash.test.js` is for. */
  const MVK_TARGET = 0.62;         // crashes per million veh-km, US freeway
  const TTC_CONFLICT = 1.5;        // s: the standard surrogate threshold
  const HARD_BRAKE = -3.0;         // m/s², 0.3 g — the telematics threshold

  /* ── the road ─────────────────────────────────────────────────────────
     One carriageway, `lanes` lanes, `length` metres, **lane 1 leftmost**
     — the counters' own numbering, so BEHAVIOUR.md's lane 2 of I-294 is
     this file's lane 1.

     Straight, flat, and with no ramps on it. That is not a limitation
     being apologised for: every number in BEHAVIOUR.md §2 was measured
     on mainline, so mainline is what has to reproduce them, and adding
     geometry before the mainline is right would only hide which of the
     two was wrong. `merge`, `lane drop` and `exit` need a corridor with
     junctions in it, and they are the second run of this harness rather
     than the first.

     ── arrivals ──────────────────────────────────────────────────────
     Poisson at the counted flow, and the lane chosen UNIFORMLY.

     The uniform is the important half. traffic.js knows what share of a
     direction the counters find in each lane and it would be very easy
     to spawn to it — and then lane occupancy, which is one of the four
     things this harness exists to measure, would be an echo of an input.
     So vehicles arrive spread flat across the carriageway, and
     everything about how they are arranged by the time they reach the
     counting zone is the model's doing. If the left lane empties of
     lorries, something moved them. */

  function percentile(sorted, q) {
    if (!sorted.length) return NaN;
    const i = (sorted.length - 1) * q;
    const lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  /* ── the deciders that are not the model ──────────────────────────── */
  const deciders = {
    /* Nobody moves. The floor of the scoreboard, and the run that says
       what car-following alone is responsible for. */
    stay: () => null,

    /* A Poisson process in distance, aimed straight at the measured 0.37
       per vehicle-km. It will hit that number, because it is the number
       it was given, and it will miss every other number in BEHAVIOUR.md
       — which is the argument of PLAN.md §5c made arithmetically instead
       of in prose. */
    random(perKm) {
      const rate = (perKm == null ? 0.37 : perKm) / 1000;      // per metre
      return (veh, view, ctx) => {
        if (ctx.rng() > rate * veh.v * ctx.dt) return null;
        const opts = [];
        if (veh.lane > 1) opts.push(veh.lane - 1);
        if (veh.lane < ctx.lanes) opts.push(veh.lane + 1);
        if (!opts.length) return null;
        return { lane: opts[(ctx.rng() * opts.length) | 0], urgency: 1, why: "random" };
      };
    },

    /* ── and the third one, which is the state of the art ──────────────
       MOBIL: the lane-change model nearly every microsimulation in the
       literature uses, and IDM's usual companion. It is here so the
       scoreboard has a real opponent rather than only two straw men —
       "the motives beat doing nothing" would prove very little.

       Its whole content is one inequality. Change lane if the
       acceleration you would gain, plus a politeness-weighted share of
       what everyone around you gains or loses, plus a standing bias
       toward the right-hand lane, beats a threshold:

         gain = a_new − a_old
              + p . [ (new follower's change) + (old follower's change) ]
              + bias

       It is a good model and it will produce a lot of what BEHAVIOUR.md
       measured. It is also, precisely, the thing PLAN.md §5c argues
       against: there is no intention anywhere in it. Nobody in MOBIL is
       getting off at exit 407, nobody has been stuck behind a lorry for
       four minutes and had enough, nobody sees you coming. Every lane
       change is an arithmetic result about acceleration this instant,
       and the vehicle has no idea it made one.

       So the interesting question the scoreboard asks is not whether the
       motives beat `stay`. It is which of BEHAVIOUR.md's numbers MOBIL
       already gets — those the motives must not lose — and which it
       cannot, which are the ones worth building for.

       Reuses the two temperament traits it has an honest use for:
       `polite` becomes p, and `discipline` scales the keep-right bias
       (lorries draw it high and tight, which is where 1.2% has to come
       from if it is going to come from anywhere). */
    mobil(opt) {
      const o = opt || {};
      const THR = o.threshold == null ? 0.2 : o.threshold;   // m/s²
      const BIAS = o.bias == null ? 0.3 : o.bias;            // m/s², keep right
      const P = o.polite == null ? 0.3 : o.polite;

      // What `veh` would accelerate at with `lead` in front of it.
      const acc = (veh, lead, gap) =>
        idm(veh.v, veh.drv.want, lead ? gap : null, lead ? veh.v - lead.v : 0, veh.par);

      return (veh, view) => {
        const now = view.gap == null ? acc(veh, null, 0) : acc(veh, view.lead, view.gap);
        const mine = view.side(Math.round(veh.lane));
        // The follower I am about to stop bothering.
        const oldLag = mine && mine.lag;
        const oldLagNow = oldLag ? acc(oldLag, veh, mine.lagGap) : 0;
        const oldLagThen = oldLag
          ? acc(oldLag, view.lead, mine.lagGap + (view.gap == null ? 1e4 : view.gap) + veh.len)
          : 0;

        let best = null, bestGain = THR;
        for (const d of [-1, 1]) {
          const ln = Math.round(veh.lane) + d;
          const n = view.side(ln);
          if (!n) continue;
          const then = acc(veh, n.lead, n.leadGap);
          const lag = n.lag;
          const lagNow = lag ? acc(lag, n.lead, lag ? n.lagGap + veh.len + n.leadGap : 0) : 0;
          const lagThen = lag ? acc(lag, veh, n.lagGap) : 0;
          const bias = d > 0 ? BIAS * veh.drv.discipline : -BIAS * veh.drv.discipline;
          const p = veh.drv.polite ? P : 0;
          const gain = (then - now) + bias
                     + p * ((lagThen - lagNow) + (oldLagThen - oldLagNow));
          if (gain > bestGain) { bestGain = gain; best = { lane: ln, urgency: gain,
                                                           why: d > 0 ? "mobil-right" : "mobil-left" }; }
        }
        return best;
      };
    },
  };

  /* ══ the run ═════════════════════════════════════════════════════════
     opts:
       px       corridor pixel the stretch starts at
       when     { dow, hour, month }
       dir      +1 eastbound, the direction the corridor is surveyed in
       state    two-letter state, for the lorry limit differential
       hours    simulated hours to COUNT, after the warm-up
       warmup   seconds discarded before counting starts (default 600)
       length   metres of road (default 6000)
       zone     [from, to] metres over which anything is counted
       q        veh/h/lane override, for running at a reference flow
                rather than at the flow the counters find here
       decide   the motive layer, or one of `deciders`
       seed     integer
       glance   multiplier on how often drivers look away (default 1)
       track    multiplier on the car-following tracking delay (default 1)
       miss     P(a manoeuvre goes ahead unchecked); 0 disables the blind
                spot entirely, which is how capacity is measured
       junctions corridor px of every interchange, or objects with a `px`.
                Sorted here, so any order will do. Without it the stretch
                is featureless mainline, which is what it always was.
       incident { t, s, lane } — wreck whatever is nearest that spot, at
                that time. The one thing in this file that is ALLOWED to
                decide a crash happens, because it is not modelling one:
                it is the harness asking what the road does afterwards,
                which is PLAN.md §5c's "wrecks make traffic, which is the
                game". At a real freeway's crash rate you would wait
                eighty hours of simulated road for one to happen by
                itself, so waiting for it is not an experiment.

     The last two are not tuning knobs and must not be used as any. They
     are there because "what would this road be like if a tenth of the
     traffic were on their phones" is a question with an answer, and
     because a mechanism that only fires once in a million vehicle-
     kilometres cannot be tested at 1x in any run anybody will wait for.
     Every calibration figure in this file is at 1x and the test says so.
       dt       seconds (default 0.1 — the rate both trajectory datasets
                were published at, so the model is stepped no finer than
                the evidence it is checked against)
     ═══════════════════════════════════════════════════════════════════*/
  const SAMPLE_EVERY = 20;         // steps between speed samples (2 s)
  const PAIRS_EVERY = 100;         // steps between headway sweeps (10 s)
  const FRAME = 400;               // m: pairs further apart are not pairs
                                   // a drone could have seen at once

  /* ── the world, and the run that drives it ────────────────────────────
     This was one function. `run(opts)` built a stretch of motorway in a
     closure, stepped it to the end and closed the books, and that is
     still exactly what it does — but the game needs the middle of that
     sentence on its own. A frame of OFFRAMP is 16 ms of somebody
     driving, not an hour of nobody watching, so the loop has to be
     somebody else's.

     So `world(opts)` builds the same closure and hands back the handles:
     step it, advance it, read the vehicles out, close the books when
     there is anything to close. `run` is the four lines underneath it,
     and every number in PLAN.md §5c still comes out of this file the
     way it did — the extraction was held to an eleven-configuration
     fingerprint of the whole stat object at full precision, not to the
     suite's tolerances. */
  function world(opts) {
    const o = opts || {};
    const px0 = o.px || 0, dir = o.dir == null ? 1 : o.dir;
    const when = o.when || { dow: 2, hour: 14, month: 6 };
    const st = o.state || null;
    const dt = o.dt || 0.1;
    const roadLen = o.length || 6000;
    const zone = o.zone || [2000, roadLen];
    /* ── roaming: a stretch that travels with somebody ────────────────
       The harness models a fixed six kilometres with a boundary at one
       end and a detector at the other. A game is 2,551 miles long and
       the only road that matters is the road the player can see, so the
       stretch has to move — and the moment it does, the boundary stops
       being a boundary. Traffic crosses INTO a moving band at both ends:
       from behind when it is faster than the band, from in front when
       the band is faster than it.

       The rate it crosses at is not a decision. Vehicles wanting speed v
       stand at a density k(v) = q(v)/v, so the flux inward across an
       edge moving at vb is k(v)·(v−vb) behind and k(v)·(vb−v) in front.
       Draw a candidate from the same population the boundary draws from
       and accept it with that probability over q(v) — exact thinning of
       a Poisson process, and no new constant anywhere.

       The property worth having is what it does at vb = 0: the trailing
       edge accepts (v−0)/v = 1, every candidate, at exactly the rate the
       fixed boundary uses, and the leading edge accepts nothing. A
       parked band IS the harness, which is the check `test/sim.test.js`
       §10 makes rather than a claim made here.

       `warmup` goes to Infinity because a live world must never keep
       books: `stat.changes`, `stat.headway` and `stat.ttc` are unbounded
       arrays, and a player driving for an hour would fill them. Nothing
       reads a roaming world's ledger — the behaviour is judged headless,
       which is the whole reason this file exists. */
    const roam = o.roam || null;
    const warmup = roam ? Infinity : o.warmup == null ? 600 : o.warmup;
    const hours = o.hours == null ? 1 : o.hours;
    /* ── how many lanes, and it is not a constant ──────────────────
       It was, and on a corridor that changes its mind 732 times in 2,551
       miles that is a fiction with visible consequences — see
       `setLanes` below. `MAX_LANES` is one more than the widest stretch
       I-40 has, and every per-lane array is sized to it once so that
       changing the count later never has to resize anything. */
    const MAX_LANES = 8;
    let nLanes = o.lanes || (TR ? TR.lanes(px0) : 2);
    const decide = o.decide || deciders.stay;
    const rng = TR.seeded(o.seed == null ? 1 : o.seed);
    let incident = o.incident || null;
    const glanceX = o.glance == null ? 1 : o.glance;
    const trackX = o.track == null ? 1 : o.track;

    let qLane = o.q != null ? o.q : TR.demand(px0, when, dir) / nLanes;
    const arrivalRate = (qLane * nLanes) / 3600;               // veh/s, all lanes
    const pxAt = (s) => px0 + dir * (s / M_PER_PX);

    /* Where the band is, and how fast it is going. `follow()` is the
       only thing that writes these; until it is called the band sits at
       the origin, which is the parked case. */
    const BACK = roam ? (roam.back == null ? 900 : roam.back) : 0;
    const AHEAD = roam ? (roam.ahead == null ? 1500 : roam.ahead) : 0;
    let bandS = roam ? (roam.at || 0) : 0, bandV = 0;
    const loEdge = () => bandS - BACK, hiEdge = () => bandS + AHEAD;
    /* A vehicle slower than this is stopped, not travelling, and the
       thinning bound divides by it. Nothing is injected below it. */
    const V_FLOOR = 8;                                          // m/s

    /* ── where the junctions are ──────────────────────────────────────
       The stretch is still straight and flat and still has no ramp
       GEOMETRY on it — nothing merges, nothing leaves, the lane count
       does not change. What it now knows is where the interchanges are,
       which is a different and much cheaper thing: one sorted list of
       corridor pixels and a binary search.

       That is enough for the half of §5c's `yield` that is about
       merging traffic, and it turns out to matter a great deal, because
       the reference stretch is not the empty motorway the harness has
       been treating it as. I-40 at mile 1897 has junctions at +1.1,
       +3.2, +4.2, +5.5 and +6.3 km — five of them inside a six
       kilometre run. Corridor-wide the median spacing is 1,420 m.

       Supplied by the caller rather than loaded here, because this file
       has no business reading a 900 KB survey; in the browser `I40` is
       already a global and is picked up for free. */
    const jRaw = o.junctions
      || (typeof I40 !== "undefined" && I40 && I40.exits ? I40.exits : null);
    const jx = jRaw && jRaw.length
      ? jRaw.map((e) => (typeof e === "number" ? e : e.px)).sort((a, b) => a - b)
      : null;

    /* Index of the first interchange ahead, or -1. */
    function firstAhead(px) {
      let lo = 0, hi = jx.length;
      if (dir > 0) {
        while (lo < hi) { const m = (lo + hi) >> 1; if (jx[m] <= px) lo = m + 1; else hi = m; }
        return lo < jx.length ? lo : -1;
      }
      while (lo < hi) { const m = (lo + hi) >> 1; if (jx[m] < px) lo = m + 1; else hi = m; }
      return lo > 0 ? lo - 1 : -1;
    }
    /* Metres to the next interchange in the direction of travel. */
    function junctionAhead(px) {
      if (!jx) return Infinity;
      const i = firstAhead(px);
      return i < 0 ? Infinity : (jx[i] - px) * dir * M_PER_PX;
    }
    /* Metres from `px` to a particular one, ahead being positive. */
    const toPx = (px, target) => (target - px) * dir * M_PER_PX;

    /* ── and a lane that ends ─────────────────────────────────────────
       §5c's third junction motive needs the one thing this harness has
       never had: somewhere the road stops being as wide as it was. The
       corridor knows where those are — `data/i40.js` carries 732 lane
       changes over 2,551 miles — but the harness takes it as an option
       for the same reason it takes `junctions` as one, which is that a
       behaviour file has no business reading a 900 KB survey.

       `drop: { at, lane }`, or a bare number for the rightmost lane
       ending at that station. The rightmost is the common case and the
       one that matters — an exit-only lane, or a widening that closes up
       again after a city — but a left-hand drop is a real thing on this
       corridor too and costs nothing to allow.

       What makes it a LANE DROP rather than a narrower road is that
       nobody is teleported out of it. The end of the lane is a stopped
       obstacle in `follow`, exactly like a wreck: everybody brakes for
       it, the queue assembles itself, and getting out is a lane change
       that has to be wanted, decided and granted like any other. A
       vehicle that does not manage it stops at the end, which is what
       actually happens to somebody who leaves it too late.

       It is a HARNESS feature and not yet a game one: the station is
       fixed, so a roaming band would carry its drop along with it, and
       wiring the corridor's own 732 lane changes to it is the job that
       makes this real on the road rather than in a test. */
    const dropRaw = o.drop || null;
    const DROP_AT = !dropRaw ? Infinity
      : (typeof dropRaw === "number" ? dropRaw : dropRaw.at);
    const DROP_LANE = !dropRaw || typeof dropRaw === "number" || !dropRaw.lane
      ? nLanes : dropRaw.lane;
    /* Metres of lane `ln` left in front of somebody standing at `s`.
       Infinity for every lane that runs the length of the stretch, which
       is all of them unless the caller said otherwise. */
    const endsIn = (ln, s) => (ln === DROP_LANE ? DROP_AT - s : Infinity);
    /* Within this of the end and stopped is somebody who did not make
       it, rather than somebody in the queue behind them. */
    const DROP_STUCK = 30;           // m

    /* ── where is this one going? ─────────────────────────────────────
       §5c: "A vehicle is given an exit when it spawns and that is its
       whole plan. It does not know where it is going after that."

       Which exit is a geometric draw: pass each interchange with
       probability 1 − EXIT_SHARE. Memoryless, which is the right shape
       — nothing about having passed four junctions makes the fifth more
       likely — and it needs one number rather than a table.

       EXIT_SHARE is **DECIDED**, and it is worth saying exactly how hard
       it was tried as a measurement. The corridor's own counts step
       across junctions: sampling `demand` 400 m either side of 204 of
       them gives a fractional change of −21% at the tenth percentile and
       +14% at the ninetieth. But that is the NET exchange, on-ramp minus
       off-ramp, and half the steps read zero because the AADT is binned
       per mile and most interchanges fall inside a bin. Gross exiting is
       strictly larger than net and this data cannot see it. So: decided
       at a tenth, which is the usual planning figure for ramp volume
       against mainline, and consistent with net steps of that order. */
    const EXIT_SHARE = o.exitShare == null ? 0.10 : o.exitShare;

    function drawExit(px) {
      if (!jx || EXIT_SHARE <= 0) return null;
      let i = firstAhead(px);
      if (i < 0) return null;
      const step = dir > 0 ? 1 : -1;
      while (rng() > EXIT_SHARE) {
        i += step;
        if (i < 0 || i >= jx.length) return null;   // off the end of the road
      }
      return jx[i];
    }

    /* ── and the other half of an interchange ─────────────────────────
       Until now every junction on this stretch was a way OFF. That made
       every density-dependent number in the scoreboard untrustworthy the
       moment exits were switched on, because nothing replaced the
       leavers: 1,585 veh/h/lane at the boundary arrived at the far end
       as about 1,060, and there is no honest way to report a lane-change
       rate on a road that is quietly emptying.

       An on-ramp is the mirror of the exit already here. A vehicle is
       born at the junction rather than at the boundary, in the rightmost
       lane because that is the only lane an on-ramp joins, and it waits
       there until there is a gap it will take.

       `RAMP_SHARE` is **DECIDED** at a tenth when it is asked for, the
       same planning figure and for the same reason as `EXIT_SHARE`
       above — and deliberately NOT tied to it. Setting the inflow equal
       to the measured outflow would make conservation true by
       construction and prove nothing. Ramps put in a tenth of the flow
       *arriving at the boundary* while exits take a tenth of whatever
       is actually passing, so the two are free to disagree, and
       `stat.conserved` is what says whether they did.

       **It defaults to OFF, and that is not timidity.** Every reference
       number this harness reports was measured on a road with no ramps
       on it, and switching them on by default moved 29 of them at once
       — which is not a result, it is the loss of the baseline they are
       compared against. A road with on-ramps is a different road and it
       has to be asked for by name. See §5e for what it does when you
       do, and for the one thing that stops it being the default yet. */
    const RAMP_SHARE = o.rampShare == null ? 0 : o.rampShare;

    /* ── the acceleration lane, and why it is not optional ────────────
       The first version of this merged at a POINT: a vehicle appeared at
       the junction and either got into the rightmost lane there or
       queued. It jammed, and the jam was informative rather than a bug.
       At the reference flow `keep right` puts about 30% of 6,340 veh/h
       into lane 4, which is roughly 1,900 — the lane is already at
       capacity — so there is no gap to take AT a point, and the ramps
       choked the road at 6% per junction against a planning figure of
       10%. Sweeping it: 2% conserved 1.000, 4% fell to 0.901, 6%
       collapsed to a queue of 188 and 777 veh/h/lane.

       An acceleration lane is what real roads answer that with, and the
       answer is not "a wider gap" — it is TIME AND ROAD to find one. So
       a merging vehicle is given `MERGE_LEN` of ramp to travel while it
       looks, rather than one instant at one place. It is not in
       `byLane` while it does so, which is correct: it is on its own
       pavement and obstructs nobody.

       That also makes §5c's line about `merge` literal rather than
       figurative — "urgency rising to infinity as the taper runs out" —
       because nerve is now spread over the distance remaining, and a
       driver who reaches the end of the lane without a gap has to stop,
       which is the on-ramp jam.

       AASHTO puts an acceleration lane on a 70 mph freeway at about a
       thousand feet including its taper. 250 m, **DECIDED** at the
       round number inside that.

       The gap acceptance itself needed no new decision, which is the
       good news: `room` already does it, with the delayed picture, the
       blind spot and the follower's braking in it. A merge is the
       manoeuvre this file already models, entered from the side.

       And it could not have been measured anyway. BEHAVIOUR.md lists
       merging gap acceptance as derivable from the TGSIM drone data
       already on disk — "the ramp merges are in frame" — and that is
       wrong. The auxiliary lane in the busy flight is occupied by
       **four vehicles in the whole set**, and by none at all in the
       free-flowing one. Four merges cannot carry a critical-gap
       distribution. What they do say, weakly, is that a merge happens
       about half way along the lane available: it runs 593–1442 m and
       the median merge point is 1,007. See §5d. */
    const MERGE_LEN = 250;           // m of acceleration lane
    /* A vehicle comes up the ramp slower than the road it is joining,
       which is the whole reason a merge disturbs anything, and it
       accelerates along the lane. DECIDED. */
    const MERGE_SPEED = 0.72;        // of desired speed, at the nose of the ramp
    const MERGE_ACCEL = 2.0;         // m/s² along the acceleration lane
    const MERGE_MATCH = 0.9;         // of the speed of the lane, before merging

    const sAt = (px) => (px - px0) * dir * M_PER_PX;
    /* Junctions that actually fall inside the modelled stretch, and far
       enough in that a merging vehicle has road to be seen on. */
    const ramps = !jx || RAMP_SHARE <= 0 ? [] : jx
      .map((px) => ({ px, s: sAt(px), end: sAt(px) + MERGE_LEN,
                      q: [], next: 0, merged: 0, wait: 0,
                      pub: { ds: 0, used: 0, v: 0, len: 0 } }))
      .filter((r) => r.s > 100 && r.s < roadLen - 100)
      .sort((a, b) => a.s - b.s);
    const rampRate = arrivalRate * RAMP_SHARE;      // veh/s, per junction

    /* ── and the one thing a merging vehicle broadcasts ───────────────
       A vehicle on a slip road is not in `byLane`, and that is right —
       it is on its own pavement and obstructs nobody. But it is also the
       most conspicuous thing on that stretch of motorway: it is beside
       you, it is going slower than you, and it is indicating.

       So the leader of each ramp queue is published, and a decider in
       the lane being joined may look at it. Only the leader, because
       only the leader can merge — everybody behind it is queueing and
       has no gap to want yet. This is not the decider peering into
       simulation state for the same reason `avoid` may read `lead.wreck`
       is not: it is what the vehicle is telling the road about itself. */
    /* Publishing is the switch for the whole of it — the motive sees
       nothing and `follow` looks at nothing — so `letIn: false` is the
       road as it was before anybody made room, which is what the before
       and after in PLAN.md §5j were measured against. It defaults ON,
       and that is safe rather than bold: with no ramps on the road there
       is never anything in this list, so every scoreboard number in this
       harness is untouched by construction. */
    const LET_ON = o.letIn == null ? true : !!o.letIn;
    /* The two halves separate, because they are two different courtesies
       and the question of which one is doing what has already been asked
       once in anger. `true` is both; "lateral" is the lane change only;
       "long" is the lift-off only; `false` is the road as it was before
       either. Measured, at 600 veh/h offered, all four land in the same
       place — see §5j, and see the warning about single seeds before
       reading anything into a difference between them. */
    const LET_LAT = LET_ON && o.letIn !== "long";
    const LET_LONG = LET_ON && o.letIn !== "lateral";
    const mergers = [];              // rebuilt each step, at most one per ramp
    function nearestMerger(veh) {
      let best = null, bestD = Infinity;
      for (let i = 0; i < mergers.length; i++) {
        const d = Math.abs(mergers[i].ds - veh.s);
        if (d < bestD) { bestD = d; best = mergers[i]; }
      }
      if (!best || bestD > SEE_MERGE) return null;
      merging.ds = best.ds - veh.s;
      merging.used = best.used;
      merging.v = best.v;
      merging.len = best.len;
      return merging;
    }
    const merging = { ds: 0, used: 0, v: 0, len: 0 };
    /* How far either side of a merging vehicle a mainline driver counts
       it as theirs to deal with. DECIDED, and it is a sight line rather
       than a courtesy: further than this and it is somebody else's gap
       being taken. */
    const SEE_MERGE = 120;           // m

    /* ── which lane a vehicle arrives in ──────────────────────────────
       It used to be UNIFORM, always, and that made the lane-share table
       the suite prints a measurement of the wrong thing. A vehicle
       dropped into a random lane at the boundary spends the first
       kilometres sorting itself out, so a zone 2–6 km in is reading the
       boundary washing through rather than what the road settles at:
       followed out with the exits off, cars run 16.6% in lane 1 at 6 km
       and 17.9% at 30 km and are still moving. BEHAVIOUR.md's shares
       come off a five-kilometre drone frame of vehicles that have been
       sorting for tens of miles. The two are not the same measurement
       and comparing them was never going to referee anything.

       `laneMix: true` seeds the boundary from the measured shares
       instead, which turns the whole run into a FIXED-POINT test and is
       a much sharper question than the one being asked before: start
       the road where the real road is, and see whether the motives keep
       it there or push it somewhere else. `stat.drift` is the answer,
       and it is not circular — nothing about seeding a distribution
       makes a model preserve it.

       Off by default. Every reference number in this harness was taken
       on a uniform boundary and switching it silently would move them
       all, which is the mistake `RAMP_SHARE` already made once.

       The shares are four-lane, because that is what I-294 was and what
       the reference stretch is. Anything else falls back to uniform
       rather than pretending to know. Motorcycles ride with the cars
       and rigids with the artics — neither is measured separately. */
    const LANE_MIX = {
      car:   [31.7, 24.3, 19.2, 24.8], moto:  [31.7, 24.3, 19.2, 24.8],
      artic: [1.2, 26.1, 48.1, 24.7],  rigid: [1.2, 26.1, 48.1, 24.7],
    };
    const seeded = !!o.laneMix && nLanes === 4;
    function drawLane(kind) {
      const mix = seeded ? LANE_MIX[kind] : null;
      if (!mix) return 1 + ((rng() * nLanes) | 0);
      let r = rng() * 100;
      for (let i = 0; i < mix.length; i++) { r -= mix[i]; if (r <= 0) return i + 1; }
      return nLanes;
    }

    /* ── the ledger ─────────────────────────────────────────────────── */
    const stat = {
      site: { px: px0, when, dir, state: st, lanes: nLanes, qLane,
              roadLen, zone, limit: TR.limitFor("car", px0, st) },
      seconds: 0, spawned: 0, held: 0, detector: 0,
      vehKm: 0, kmBy: { moto: 0, car: 0, rigid: 0, artic: 0 },
      byKind: { moto: 0, car: 0, rigid: 0, artic: 0 },
      laneSec: [], laneSpeed: [],
      changes: [],                                 // the motive trace
      durations: [], headway: [], gap: [],
      speed: { moto: [], car: [], rigid: [], artic: [] },
      accel: [],
      conflicts: 0, worstOverlap: 0, queueMax: 0,
      /* what went wrong, and how nearly it went wrong */
      contacts: 0, crashes: [], wrecks: 0, glances: 0, staged: null,
      exited: 0, missedExit: 0, everMissed: 0,
      /* the on-ramp side */
      merged: 0, mergeWait: [], mergeAt: [], mergeV: [], mergeLag: [],
      rampHeld: 0, rampQueueMax: 0,
      /* Vehicle-seconds spent stopped at the end of a lane that ended,
         and how many distinct vehicles it happened to. A lane drop that
         nobody fails at is a lane drop with the urgency set too high. */
      dropHeld: 0, dropStuck: 0,
      /* Which lane the ones who missed were still sitting in. A model
         that loses people at the gore should say from where. */
      missedFrom: [], exitedFrom: [],
      hurt: { superficial: 0, damage: 0, disabling: 0, fatal: 0 },
      byType: { rear: 0, sideswipe: 0 },
      conflictTTC: 0, hardBrakes: 0, ttc: [], blindChanges: 0, aborts: 0,
    };
    for (let i = 0; i <= MAX_LANES; i++) {
      stat.laneSec.push({ moto: 0, car: 0, rigid: 0, artic: 0, all: 0 });
      stat.laneSpeed.push([]);
    }

    /* ── state ──────────────────────────────────────────────────────── */
    let t = 0, steps = 0, nextId = 1, nextArrival = 0;
    const live = [];
    const pending = [];
    const byLane = [];                             // rebuilt each step
    for (let i = 0; i <= MAX_LANES; i++) byLane.push([]);

    /* `at` is where along the run the vehicle comes into existence, and
       it is 0 for everything arriving over the upstream boundary. An
       on-ramp vehicle is born at its junction instead, which is the
       only difference between the two — it is drawn from the same
       corridor, given the same temperament and the same plan. */
    function born(at, inLane, ofKind) {
      const s = at || 0;
      const px = pxAt(s);
      const kind = ofKind || TR.drawKind(px, when, rng);
      const drv = TR.driver(kind, px, when, st, rng);
      const p = IDM[kind] || IDM.car;
      const B = BODY[kind] || BODY.car;
      /* Attention, drawn once and kept — one trait producing both the
         driver who never takes their eyes off the road and the one who
         is reading their phone, the same way `exitLead` produces both
         the careful and the appalling. Cubed, so most drivers are most
         of the way toward attentive and the bad ones are genuinely
         rare. */
      const att = Math.pow(rng(), 3);
      const veh = {
        id: nextId++, kind, drv, len: drv.length, w: B.w,
        m: B.m, mu: B.mu, Iz: izOf(B.m, drv.length, B.w),
        A: p.A, B: p.B, s0: p.s0,
        par: { A: p.A, B: p.B, s0: p.s0, T: drv.headway * T_SCALE },
        /* An on-ramp vehicle arrives in the rightmost lane because that
           is the only lane an on-ramp joins. Everything else is UNIFORM
           — see `arrivals`. */
        lane: inLane || (at ? nLanes : drawLane(kind)),
        latZ: zOf(rng(), rng(), rng()),            // how briskly it changes lane
        from: 0, to: 0, phase: 0, dur: 0, why: null,
        s, v: drv.want, a: 0, vy: 0,
        limitAt: TR.limitFor(kind, px, st), changes: 0,
        /* perception */
        track: trackX * Math.max(TRACK.lo, Math.min(TRACK.hi,
                 TRACK.med * Math.exp(TRACK.sig * zOf(rng(), rng(), rng())))),
        attention: att,
        glanceRate: glanceX * GLANCE_BASE * (1 - 0.92 * att),
        gaze: 0,                                   // seconds of glance left
        away: 0,                                   // seconds it has been away
        brake: false, hard: false,
        /* aftermath */
        hS: new Float64Array(HIST), hV: new Float64Array(HIST), hi: 0,
        wreck: null, hitAt: -1, looked: true, sawIt: 0, aborted: false,
        /* Where it is getting off. Null means it is going past the
           end of the stretch, which most of them are. */
        exitPx: drawExit(px), missed: 0, planned: false,
      };
      /* Its history starts where IT starts, not at the boundary — a
         vehicle born at a junction that claimed to have been at s = 0 a
         moment ago is a vehicle every follower reads as having crossed
         the whole stretch instantaneously. */
      veh.hS.fill(s); veh.hV.fill(veh.v);
      return veh;
    }

    /* ── the ring, and what a driver sees in it ───────────────────────
       Every vehicle records where it was and how fast it was going, and
       everyone behind it reads that record `delay` seconds late and then
       extrapolates it forward at the speed it was last seen doing. See
       the block on perception: the extrapolation is what makes a
       reaction time cost nothing in steady state and everything when
       something changes. */
    function remember(veh) {
      veh.hS[veh.hi] = veh.s; veh.hV[veh.hi] = veh.v;
      veh.hi = (veh.hi + 1) % HIST;
    }
    const seenS = { s: 0, v: 0 };
    function seen(lead, delay) {
      const k = Math.min(HIST - 1, Math.max(0, Math.round(delay / dt)));
      const i = (lead.hi - 1 - k + HIST + HIST) % HIST;
      const v = lead.hV[i];
      seenS.v = v; seenS.s = lead.hS[i] + v * (k * dt);
      return seenS;
    }

    /* How stale this driver's picture of the world is, right now.
       Deliberately NOT called `lag` — `lag` in this file already means
       the vehicle behind you, and `room()` has a local of that name. */
    function stale(veh, lead) {
      let d = veh.track;
      if (lead && lead.brake) d *= BRAKE_PRIMED;   // the lamps are for this
      return d + veh.away;
    }

    /* Eyes on the road, or not. `away` is how long this glance has been
       going ON, not how long is left, because that is the quantity the
       staleness is made of: a driver two seconds into looking at their
       phone is working from a two-second-old road. It resets to zero the
       moment they look back, and the picture snaps up to date — which is
       what makes the recovery either just in time or not at all.

       Duration is squared-uniform: most glances are short, and the tail
       past two seconds is thin and is where every one of these crashes
       comes from. */
    function glance(veh) {
      if (veh.gaze > 0) {
        veh.gaze -= dt; veh.away += dt;
        if (veh.gaze <= 0) { veh.gaze = 0; veh.away = 0; }
        return;
      }
      if (rng() < veh.glanceRate * dt) {
        const u = rng();
        veh.gaze = GLANCE.lo + (GLANCE.hi - GLANCE.lo) * u * u;
        veh.away = dt;
        if (counting()) stat.glances++;
      }
    }

    /* Whose bumper is where. A mid-manoeuvre vehicle is in BOTH lanes,
       because it is — and because the vehicle behind it in the lane it
       is arriving in has to see it before it gets there, which is the
       whole physical content of a lane change taking time.

       Rebuilt every step and sorted every step. The arrays are almost
       always already sorted, and V8's sort is linear on that, so this is
       far cheaper than maintaining order by hand would be. */
    function index() {
      for (let i = 1; i <= nLanes; i++) byLane[i].length = 0;
      for (let i = 0; i < live.length; i++) {
        const v = live[i];
        byLane[v.from].push(v);
        if (v.phase > 0 && v.to !== v.from) { byLane[v.to].push(v); continue; }
        /* Everything else goes into every lane its actual WIDTH overlaps,
           computed rather than rounded. For a vehicle sitting squarely in
           its lane this is that one lane and nothing changes — the reach
           is 0.76 of a lane for a car and 0.85 for an artic, both under
           one. It matters for the two cases where a vehicle is not
           squarely anywhere: a wreck, which slides to a stop wherever the
           friction ran out and very often across a line, and a vehicle
           that was hit mid-manoeuvre and stopped steering. Both shut two
           lanes, which is the whole reason a wreck is worth simulating. */
        const reach = (LANE_W + v.w) / (2 * LANE_W);
        const lo = Math.max(1, Math.ceil(v.lane - reach + 1e-9));
        const hi = Math.min(nLanes, Math.floor(v.lane + reach - 1e-9));
        for (let ln = lo; ln <= hi; ln++) if (ln !== v.from) byLane[ln].push(v);
      }
      for (let i = 1; i <= nLanes; i++) byLane[i].sort(bySpot);
    }
    const bySpot = (a, b) => a.s - b.s;

    function insert(arr, v) {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s <= v.s) lo = m + 1; else hi = m; }
      arr.splice(lo, 0, v);
    }

    /* The first vehicle in `ln` whose front bumper is beyond `s`, and the
       last one at or behind it, skipping `self`. Binary search, because
       the linear scan this replaced was the whole cost of the harness. */
    const found = { lead: null, lag: null, leadGap: 0, lagGap: 0 };
    function neigh(ln, s, self) {
      const arr = byLane[ln];
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s <= s) lo = m + 1; else hi = m; }
      let lead = null, lag = null;
      for (let i = lo; i < arr.length; i++) if (arr[i] !== self) { lead = arr[i]; break; }
      for (let i = lo - 1; i >= 0; i--) if (arr[i] !== self) { lag = arr[i]; break; }
      found.lead = lead; found.lag = lag;
      found.leadGap = lead ? lead.s - lead.len - s : Infinity;
      found.lagGap = lag ? s - (self ? self.len : 0) - lag.s : Infinity;
      return found;
    }

    /* The binding leader over every lane the vehicle currently occupies,
       and the acceleration that implies.

       Three things happen here that did not before, and together they
       are what "the cars are aware of each other" means:

         · the leader's state is read `lag()` seconds late and
           extrapolated, so a driver acts on the road as it was
         · up to ANTICIPATE vehicles ahead are considered, not one, and
           the most binding wins — a driver watching the third car up
           brakes before the second one does
         · nothing beyond SIGHT is there at all

       The multi-anticipation is not decoration. With a real reaction
       time and single-vehicle following the model is string-unstable:
       every lift-off amplifies down the queue until something stops
       dead. With it, the road is stable and the crashes come from the
       tails, which is where they should come from. */
    let followGap = null, followLead = null, followTTC = Infinity;
    const upstream = [];
    function ahead(ln, s, self, out, limit) {
      const arr = byLane[ln];
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s <= s) lo = m + 1; else hi = m; }
      for (let i = lo; i < arr.length && out.length < limit; i++) {
        const v = arr[i];
        if (v === self) continue;
        if (v.s - v.len - s > SIGHT) break;
        /* A vehicle whose tail is still behind your nose is not in front
           of you. Without this test a car halfway into your lane and
           level with you is a leader at zero gap, IDM returns the full
           nine metres per second squared, and everything behind you
           piles into the back of a car that was never going to hit
           anything — a shockwave manufactured out of a bookkeeping
           choice, and what took this road from 1,866 veh/h/lane to 268
           the first time a driver pulled out without looking.

           But "not in front" splits two ways and the difference is the
           whole thing. If it is laterally clear it is BESIDE you: you
           cannot rear-end it, ignore it, and let `sweep` deal with the
           conflict. If it is laterally overlapping you are INSIDE it —
           you have hit it, or it has stopped across your lane — and it
           is the most urgent object in the world. Skipping that case
           too, which is what the first version did, means a car that
           runs into a wreck stops being able to see the wreck, comes off
           the brakes, and grinds into it again every tenth of a second
           for as long as the run lasts. That is 564,691 collisions in
           half an hour, and it is how this line got written. */
        if (v.s - v.len < s) {
          const apart = Math.abs(self.lane - v.lane) * LANE_W;
          if (apart >= (self.w + v.w) / 2) continue;         // beside
        }
        out.push(v);
      }
    }

    function follow(veh) {
      upstream.length = 0;
      ahead(veh.from, veh.s, veh, upstream, ANTICIPATE);
      if (veh.phase > 0 && veh.to !== veh.from)
        ahead(veh.to, veh.s, veh, upstream, upstream.length + ANTICIPATE);

      /* Nobody in front is the starting point, and it is also the answer
         if everything in front turns out to be beyond the horizon. The
         version that started at Infinity and relied on the loop to lower
         it returned Infinity for a vehicle whose only leaders were out
         of sight, which is not a big acceleration, it is not a number. */
      let worst = idm(veh.v, veh.drv.want, null, 0, veh.par);
      let gap = null, lead = null, ttc = Infinity;

      for (let i = 0; i < upstream.length; i++) {
        const L = upstream[i];
        const st2 = seen(L, stale(veh, L));
        const g = st2.s - L.len - veh.s;
        if (g > SIGHT) continue;
        /* A vehicle two up is judged on the gap to IT, past whatever is
           between — which is what a driver looking through the traffic
           actually does, and is why they are already off the throttle
           when the car in front lights up. */
        const a = idm(veh.v, veh.drv.want, g, veh.v - st2.v, veh.par);
        if (a < worst) worst = a;
        if (lead === null || g < gap) { gap = g; lead = L; }

        /* Time to collision, computed on the REAL gap and the REAL
           closing speed rather than the perceived ones. That asymmetry
           is the point: TTC is what an observer above the road would
           measure, and the whole question this file asks is how far the
           driver's picture has drifted from it. */
        const tg = L.s - L.len - veh.s, tdv = veh.v - L.v;
        if (tdv > 0.1 && tg >= 0 && tg / tdv < ttc) ttc = tg / tdv;
      }
      /* ── and the room somebody makes for a merge ──────────────────────
         The other half of letting a vehicle in, and on a busy road it is
         the half that works. `motive.js`'s `merge` moves a driver out of
         the lane being joined, which is the courtesy everybody thinks of
         first and which needs a gap in the lane to the left — and in the
         traffic where a merge is actually hard there is not one. So the
         courtesy that is left is the one real drivers mostly use: lift
         off, and let the gap in front of you open up.

         It is deliberately NOT a lane choice, which is why it is here
         rather than in a motive: the decider answers with a lane, and
         this driver is staying in theirs. It is the same mechanism as
         following anybody else, applied to a vehicle that is not in this
         lane yet, and gated on the same `polite` the rest of the courtesy
         is — about half the road does not do it and never will.

         ── and it is bounded twice, both times physically ─────────────
         A driver eases off for a merge. They do not brake for one, and
         they certainly do not stop on a live carriageway for a vehicle
         that is on its own pavement — so the deceleration this can ask
         for is capped at a lift-off, and it does not apply at all to a
         merger going far slower than the traffic. Without the second
         bound a vehicle that has already given up and stopped at the end
         of the taper becomes a stationary leader for the whole lane, and
         the courtesy that was supposed to clear the ramp closes the
         motorway instead. */
      if (LET_LONG && mergers.length && veh.drv.polite && veh.lane > nLanes - 0.5) {
        const m = nearestMerger(veh);
        /* Ahead of me and moving with the traffic: I can open the gap
           they are aiming at. Beside or behind me, there is nothing I
           can do about it with the throttle. */
        if (m && m.ds > 0 && m.ds < LET_SEE
            && m.v >= LET_MATCH * veh.drv.want
            && veh.v > LET_FLOOR * veh.drv.want) {
          const g = m.ds - m.len;
          const a = idm(veh.v, veh.drv.want, g > 0 ? g : 0, veh.v - m.v, veh.par);
          const eased = a < -LET_BRAKE ? -LET_BRAKE : a;
          if (eased < worst) worst = eased;
        }
      }

      /* ── and the end of the lane, which is a stopped obstacle ────────
         Not a clamp on position, which would let everybody behind sail
         up to a wall of stationary cars and only find out on contact.
         The end of a dying lane brakes the traffic in it the same way a
         wreck does, through the same solver, so the queue on the taper
         assembles itself and the drivers behind it can see it coming.

         Only for a vehicle actually committed to that lane — somebody
         halfway out of it has a lane that does not end. */
      if (DROP_AT < Infinity && veh.from === DROP_LANE && veh.to === DROP_LANE) {
        const g = DROP_AT - veh.s;
        const a = idm(veh.v, veh.drv.want, g > 0 ? g : 0, veh.v, veh.par);
        if (a < worst) worst = a;
        /* Somebody who left it too late, standing at the end of a lane
           that is not there any more, waiting for a gap. It is the same
           event as the on-ramp jam seen from the other side, and it is
           counted the same way. */
        if (counting() && g < DROP_STUCK && veh.v < 1) {
          stat.dropHeld += dt;
          if (!veh.stuck) { veh.stuck = true; stat.dropStuck++; }
        }
      }

      followGap = gap; followLead = lead; followTTC = ttc;
      return worst;
    }
    /* A lift-off, not a brake: about a tenth of gravity, which is what
       easing off the throttle at motorway speed costs you. DECIDED. */
    const LET_BRAKE = 1.0;           // m/s²
    /* And only for somebody who is nearly up to speed. Below this they
       are not merging, they are waiting, and nobody stops for them.

       ── measured against the driver's OWN DESIRED speed, not their
       current one, and that distinction is the whole mechanism ────────
       The first version asked whether the merger was doing at least half
       of what THIS DRIVER IS DOING RIGHT NOW, which is a feedback loop
       with the sign pointing the wrong way: ease off for a slow merger,
       and your own speed falls, so the merger clears the gate more
       easily, so you ease off again. A courteous driver near a busy ramp
       could wind itself down to a crawl and become the obstruction.

       Against `want` there is no loop: it is a fixed property of the
       driver, so the gate says what it meant to say — *is this vehicle
       travelling like traffic, or has it given up and stopped?*

       Changed because it was wrong by inspection, and it is worth
       recording that the RUN which appeared to prove it — the ramp
       serving 645 veh/h without the courtesy and 180 with it — was one
       seed, and did not survive six more. See PLAN.md §5j. On this road
       a single seed is a coin toss and it has now fooled this work
       twice. */
    const LET_MATCH = 0.5;           // of the courteous driver's desired speed
    /* And there is a limit to what a courtesy is worth. Below this you
       have given up enough of your own journey for somebody else's, and
       the road behind you has a claim too. */
    const LET_FLOOR = 0.75;          // of desired speed
    /* Close enough that it is your gap they are asking for. Beyond it
       they are somebody else's problem — the same sight line the motive
       uses, and deliberately the same number. */
    const LET_SEE = 60;              // m

    /* ══ and when it does not work ═══════════════════════════════════
       Two vehicles are in contact when they overlap along the road AND
       across it. Both halves matter: a vehicle halfway through a lane
       change is in two lanes in the index but is only PARTLY in each,
       and whether it hits the car beside it depends on where its
       flank actually is, not on which array it is in.

       Which way the blow lands is decided the way any contact between
       two boxes is decided — by the axis of least penetration. Overlap
       deeper across than along and it is a rear-end; deeper along than
       across and it is a sideswipe. Nothing has to be told which one it
       is, and a lane change into an occupied gap produces the second
       kind without anything anywhere mentioning lane changes.

       Then impact.js takes over, which is what it was written for: its
       own docstring says the four barrier cases were unified so that
       "traffic needs a fifth — car into car". This is the fifth. */
    /* ── two different questions, and they had one answer ──────────────
       (Ric, 2026-08-12: "i hit the cars and it never crashes. sometimes
       clipping of my rear or front corners on their corners.")

       Which way to PUSH two overlapped boxes apart and which way they
       are actually HITTING each other are not the same question, and
       this returned the first answer to both.

       The push wants the least-overlap axis — that is the minimum
       translation, and moving a car 0.27 m sideways rather than 2.65 m
       backwards is obviously right. But handing that same axis to the
       solver as the impulse normal throws away the axis the energy is
       on. Clip somebody's rear corner while overtaking: you overlap
       2.65 m nose-tail and 0.27 m across, so the least-overlap axis is
       the FLANK, and across the road you are not closing at all — so
       `solve` reports two separating bodies and there is no impact.
       Measured, that is a car 4.65 m nose-tail and 0.82 m body-deep
       inside another one with nothing whatever happening.

       So the impulse gets its own normal, chosen by what the two bodies
       are actually doing to each other: the axis they are CLOSING on,
       fastest first. Where both are closing this picks the harder one
       and the least-overlap axis is usually it anyway, so ordinary
       rear-ends and ordinary sideswipes are unchanged. Where the
       least-overlap axis is separating and the other one is not, this
       is the difference between a corner clip and nothing at all. */
    function contact(a, b) {
      // a is the one behind or to the left; both are front-bumper `s`.
      const ax = a.s - a.len / 2, bx = b.s - b.len / 2;
      const ay = a.lane * LANE_W, by = b.lane * LANE_W;
      const ox = (a.len + b.len) / 2 - Math.abs(ax - bx);
      const oy = (a.w + b.w) / 2 - Math.abs(ay - by);
      if (ox <= 0 || oy <= 0) return null;
      const rear = ox < oy;
      const nx = { x: ax < bx ? -1 : 1, y: 0 };    // from b toward a
      const ny = { x: 0, y: ay < by ? -1 : 1 };
      const n = rear ? nx : ny;
      /* Closing speed along each candidate, positive when approaching.
         `n` points from b toward a, so a closes on b when its velocity
         runs against n. */
      const rel = { x: a.v - b.v, y: (a.vy || 0) - (b.vy || 0) };
      const closeOn = (m) => -(rel.x * m.x + rel.y * m.y);
      const cx = closeOn(nx), cy = closeOn(ny);
      const nImp = (cx > 0 || cy > 0) ? (cx >= cy ? nx : ny) : n;
      /* ── "if you hit it just right" ───────────────────────────────
         A CORNER hit is the one where only the corners are engaged:
         small overlap on BOTH axes at once. Door-to-door has a big `ox`
         and nose-to-tail a big `oy`, and neither is a corner. Half of
         full engagement on each axis separates them cleanly — the
         measured nose-on-tail-corner case sits at ox 0.70 against a
         2.33 bar and oy 0.27 against 0.95.

         It matters because a corner is where the WHEEL is. A blow
         across somebody's door does not touch a tyre; one on the corner
         loads it, and that is the difference between a scrape and a
         sidewall that lets go two minutes later. */
      const corner = ox < 0.5 * Math.min(a.len, b.len)
                  && oy < 0.5 * Math.min(a.w, b.w);
      return { rear, n, nImp, corner, ox, oy, ax, bx, ay, by };
    }

    function collide(a, b, c) {
      /* Contact point: the middle of the overlap, on both axes. Which
         matters — put it on the lane centreline instead and a sideswipe
         has no moment arm and produces no yaw at all. */
      const cx = (Math.max(a.s - a.len, b.s - b.len) + Math.min(a.s, b.s)) / 2;
      const ay = a.lane * LANE_W, by = b.lane * LANE_W;
      const cy = (Math.max(ay - a.w / 2, by - b.w / 2)
                + Math.min(ay + a.w / 2, by + b.w / 2)) / 2;
      const bodyA = { m: a.m, Iz: a.Iz, v: { x: a.v, y: a.vy }, w: 0,
                      r: { x: cx - (a.s - a.len / 2), y: cy - ay } };
      const bodyB = { m: b.m, Iz: b.Iz, v: { x: b.v, y: b.vy }, w: 0,
                      r: { x: cx - (b.s - b.len / 2), y: cy - by } };
      /* `nImp`, not `n`: the axis they are closing on rather than the
         one that is cheapest to push apart. See `contact`. */
      const r = IM.solve(bodyA, bodyB, { n: c.nImp || c.n, mu: (a.mu + b.mu) / 2 });
      if (!r) return null;                          // separating: no impulse

      /* The impulse on `a` is +J and on `b` is −J — impact.js's own sign
         convention, and the reason `sign` is here rather than a second
         solve. `fwd` is +x for both because nothing in this sim yaws;
         the day a vehicle can be sideways in its lane, this is the one
         line that has to know about it. */
      const hurt = (dv, J, sign) => {
        const ang = IM.blowAngle({ x: J.x * sign, y: J.y * sign }, { x: 1, y: 0 });
        const eff = IM.effectiveDv(dv, ang) * 3.6;  // km/h, which the curves want
        return { dv, ang, eff, outcome: IM.outcome(eff, rng()) };
      };
      const oa = hurt(r.dvA, r.J, 1);
      const ob = hurt(r.dvB, r.J, -1);

      /* The impulse is computed from both bodies — the player's real
         mass is what decides how hard the other car is thrown — but it
         is only APPLIED to the one this file is driving. The game owns
         the player's velocity and always has; writing it here would put
         two solvers on one car.

         NOT the same thing as discarding it. `r.va`/`r.vb` for the
         piloted body is handed to the game in the hit record below, and
         for a long time it was not — which is how the player ended up
         an immovable object that could shove traffic aside at no cost.
         "The game owns it" is a statement about who writes it, not
         about whether it happens. */
      if (!a.piloted) { a.v = Math.max(0, r.va.x); a.vy = r.va.y; }
      if (!b.piloted) { b.v = Math.max(0, r.vb.x); b.vy = r.vb.y; }

      /* Below impact.js's SUPERFICIAL threshold there is nothing to
         roll for and nothing to stop for. A tap in slow traffic is a
         tap: paint, a look in the mirror, and both drivers carry on.

         Above it there is a crash, and then the SEPARATE question of
         whether anything still drives — see IMMOBILE. A shunt at
         fifteen is a reportable crash and two vehicles that leave under
         their own power; the road is not shut by it, and modelling it
         as though it were is how a single wreck ate a carriageway. */
      const stops = (out, o) => o.outcome === "disabling" || o.outcome === "fatal"
                             || o.eff >= IMMOBILE;
      const hurtBad = oa.outcome !== "superficial" || ob.outcome !== "superficial";
      const wrecked = hurtBad && (stops(a, oa) || stops(b, ob));
      /* Both stop, whichever one of them was stopped: a vehicle that
         still drives does not drive off and leave the other in the road.
         That is not sentiment, it is what the queue behind them sees. */
      if (wrecked) { wreck(a, oa); wreck(b, ob); }
      /* ── and everybody keeps the marks ────────────────────────────
         (Ric, 2026-08-12: "cosmetic damage to me and the other
         vehicles".)

         Below the wreck threshold a vehicle used to walk away with no
         record that anything had happened, so a carriageway that had
         been shunted around for ten minutes looked showroom-fresh.
         `scuff` is 0..1 of accumulated cosmetic damage and nothing in
         the model reads it — it does not slow the car, it is not a
         hitbox, it does not feed the injury roll. It exists so the
         renderer can show a road that has been in a scrape, and so the
         side it landed on is known: −1 is the near flank, +1 the off
         one, which is what a scrape down one side has to know. */
      const mark = (v, o) => {
        if (v.piloted) return;                     // the game keeps its own
        v.scuff = Math.min(1, (v.scuff || 0) + Math.min(0.5, o.eff / 60));
        v.scuffSide = c.n.y ? (c.n.y > 0 ? 1 : -1) : (v.scuffSide || 0);
      };
      mark(a, oa); mark(b, ob);
      return { r, oa, ob, wrecked, hurtBad };
    }

    function wreck(veh, o) {
      if (veh.wreck || veh.piloted) return;
      veh.wreck = { at: t, outcome: o.outcome, dv: o.dv, eff: o.eff, angle: o.ang };
      veh.phase = 0; veh.to = veh.from = Math.round(veh.lane);
      if (counting()) stat.wrecks++;
    }

    /* Two bodies that have exchanged an impulse are still inside each
       other, because the impulse changed their velocities and not their
       positions. Push them apart along the contact normal, split by
       inverse mass, so that a car shunted by a lorry moves and the lorry
       barely does.

       This is not cosmetic. Without it the pair stays overlapped, hits
       again next tick, and every tick after that — a hundred impulses a
       second, each rolling the injury dice. With it the second contact
       is between two bodies that are no longer closing, `solve` returns
       null, and a shunt is one event followed by a shove. */
    function separate(a, b, c) {
      const inv = 1 / a.m + 1 / b.m;
      const d = (c.rear ? c.ox : c.oy) + 1e-3;
      let fa = (1 / a.m) / inv, fb = (1 / b.m) / inv;
      /* A piloted body is immovable here, so the whole separation is
         taken by the other one. Splitting it by inverse mass would shove
         the player sideways out of the lane they are steering, which is
         a fight between this file and the wheel. */
      if (a.piloted) { fa = 0; fb = 1; }
      else if (b.piloted) { fa = 1; fb = 0; }
      if (!a.piloted) { a.s += c.n.x * d * fa; }
      if (!b.piloted) { b.s -= c.n.x * d * fb; }
      if (c.n.y) {
        if (!a.piloted) a.lane = clampLane(a.lane + c.n.y * d * fa / LANE_W);
        if (!b.piloted) b.lane = clampLane(b.lane - c.n.y * d * fb / LANE_W);
      }
    }
    const clampLane = (l) => (l < 1 ? 1 : l > nLanes ? nLanes : l);

    /* The sweep. Every lane, every pair whose bodies overlap along the
       road, nearest first and stopping the moment they cannot.

       A vehicle can be in two lanes at once — mid-manoeuvre, or wrecked
       across a line — so the same pair can turn up twice in one sweep.
       `hitOnce` is the guard, and it is a Set rather than a mark on the
       vehicle because a pile-up is one vehicle against several. */
    const hitOnce = new Set();
    function sweep() {
      hitOnce.clear();
      for (let ln = 1; ln <= nLanes; ln++) {
        const arr = byLane[ln];
        for (let i = 1; i < arr.length; i++) {
          const b = arr[i];
          for (let j = i - 1; j >= 0; j--) {
            const a = arr[j];
            if (b.s - b.len >= a.s) break;         // and no closer pair behind
            if (a === b) continue;
            const c = contact(a, b);
            if (!c) continue;
            const key = a.id * 16777216 + b.id;
            if (hitOnce.has(key)) continue;
            hitOnce.add(key);
            a.hitAt = t; b.hitAt = t;
            const va0 = a.v, vb0 = b.v;
            const r = collide(a, b, c);
            separate(a, b, c);
            stopChanging(a); stopChanging(b);
            if (r) record(a, b, c, r, va0, vb0);
            /* Anything the player was part of goes into a queue for the
               game to answer, with which end of the car it landed on and
               how hard. Nothing here decides what it costs them. */
            if (r && (a.piloted || b.piloted)) {
              const me = a.piloted ? a : b, them = a.piloted ? b : a;
              /* ── what it did to the PLAYER'S OWN SPEED ─────────────
                 `collide` solves both bodies and then applies only the
                 one this file drives, which left the player's half of
                 the answer computed and thrown away. That made the car
                 you drive an immovable object: measured, 229 contacts
                 in sixty seconds of driving through traffic at 108 km/h
                 and not one of them cost a single km/h, while every car
                 hit was shoved aside by `separate`. You could bulldoze
                 the carriageway.

                 The velocity is still not written here — the game owns
                 it, and two solvers on one car is the thing that rule
                 exists to prevent. It is HANDED OVER, which is exactly
                 what offramp.js's `scrapeWall` already does with
                 `res.va` for the four barrier cases. This is the fifth,
                 and impact.js's docstring says the four were unified so
                 that "traffic needs a fifth — car into car".

                 Signed along the player's own direction of travel, so
                 negative always means speed lost: in the oncoming world
                 their `v` is negative because they are travelling
                 backwards through it. */
              const v0 = a.piloted ? va0 : vb0;
              const v1 = a.piloted ? r.r.va.x : r.r.vb.x;
              /* And the same for ACROSS the road. Handed over in this
                 world's frame — `cars.js` put the player's lateral
                 velocity in and is the file that knows which way round
                 this carriageway is, so it is the file that takes it
                 back out. A sideswipe is nearly all of this and almost
                 none of `dvAlong`: at matched speeds there is no
                 lengthways sliding to make friction out of. */
              const y1 = a.piloted ? r.r.va.y : r.r.vb.y;
              hits.push({
                kind: them.kind, rear: c.rear,
                /* Struck from behind, or ran into the back of somebody:
                   `me` is the one further back when it is `a`. */
                fromBehind: c.rear && me === b,
                closing: Math.abs(va0 - vb0),
                eff: (a.piloted ? r.oa : r.ob).eff,
                outcome: (a.piloted ? r.oa : r.ob).outcome,
                dv: (a.piloted ? r.oa : r.ob).dv,
                angle: (a.piloted ? r.oa : r.ob).ang,
                dvAlong: (v0 < 0 ? -1 : 1) * (v1 - v0),   // m/s, − is lost
                vyAfter: y1, dvLat: y1 - me.vy,           // m/s, this world's frame
                corner: !!c.corner,                       // only the corners engaged
                side: c.n.y ? (c.n.y > 0 ? 1 : -1) : 0,   // which flank took it
                theirLane: Math.round(them.lane), s: me.s, t,
              });
            }
          }
        }
      }
    }

    /* You do not carry on changing lane into a car you have just hit.
       This is obvious as behaviour and it is also load-bearing as code:
       `separate` moves the vehicles apart, and the manoeuvre's own
       lateral interpolation would put them straight back next tick, so
       the pair grinds through a fresh impulse every hundredth of a
       second forever. The first version did exactly that — 76,674
       separate collisions in half an hour of road.

       They steer back, and they FINISH steering back. The version that
       froze the manoeuvre where it stood instead — phase to zero,
       wherever the wheels happened to be — left the car straddling the
       line for the rest of its life, blocking two lanes at once under
       the occupancy rule in `index`. Two lanes blocked is more traffic,
       more traffic is more conflicts, more conflicts is more cars frozen
       across lines, and the reference road went from 1,545 veh/h/lane to
       796 with a third of the carriageway standing sideways. A scrape is
       a scrape: you get back in your lane. Only a WRECK stops between
       lines, and that is `wreck`'s business, not this one's. */
    function stopChanging(veh) {
      if (veh.phase > 0 && !veh.aborted) abortChange(veh);
    }

    function record(a, b, c, r, va0, vb0) {
      if (!counting()) return;
      if (a.s < zone[0] || a.s > zone[1]) return;
      stat.contacts++;
      /* A contact only becomes a CRASH when somebody would report it —
         which is exactly impact.js's superficial threshold, and is why
         the scrape and the shunt are counted separately. */
      if (!r.hurtBad) return;
      const type = c.rear ? "rear" : "sideswipe";
      stat.byType[type]++;
      stat.hurt[r.oa.outcome]++; stat.hurt[r.ob.outcome]++;
      stat.crashes.push({
        t, s: a.s, lane: Math.round(a.lane), type,
        closing: r.r.vClosing, wrecked: r.wrecked,
        a: { id: a.id, kind: a.kind, v: va0, dv: r.oa.dv, eff: r.oa.eff,
             angle: r.oa.ang, outcome: r.oa.outcome, away: a.away, track: a.track },
        b: { id: b.id, kind: b.kind, v: vb0, dv: r.ob.dv, eff: r.ob.eff,
             angle: r.ob.ang, outcome: r.ob.outcome, away: b.away, track: b.track },
      });
    }

    /* ══ May this vehicle move into `ln` right now? ═══════════════════
       This function was the last place in the file where a driver had
       perfect information, and that is why nothing ever hit anything
       sideways. It read the true position and true speed of the vehicle
       in the next lane, including the one alongside its own back wheel,
       and then applied a safety criterion to it. A gate like that cannot
       be got wrong, so a lane change could never be a mistake, so there
       were no lane-change crashes — and lane changes are where a large
       share of real freeway crashes come from.

       Two things are wrong with reading the truth here and they are
       different mechanisms.

       ── the mirror is late, like everything else ──────────────────────
       The vehicle behind in the next lane is seen through the same
       delayed, extrapolated picture as everything in front. Nothing
       special: `seen` and `stale`, exactly as in `follow`.

       ── and it does not show you everything ───────────────────────────
       There is a region alongside and just behind a car that neither
       mirror covers. It is not a defect, it is geometry, and it is the
       single best-documented cause of lane-change collisions: the
       vehicle is not misjudged, it is *not seen at all*. Looking over
       your shoulder is what covers it, and looking over your shoulder is
       a habit rather than a rule.

       So a driver who does not check has no idea the vehicle in the
       blind spot exists, `room` returns true, and the manoeuvre puts two
       cars in the same place. Nothing decides that this is a mistake.

       BLIND_SPOT is the depth of that region measured back from the
       driver's own tail — about a car's length, which is what the mirror
       geometry gives. MISS is DECIDED: the base chance a manoeuvre goes
       ahead with nobody having looked, attenuated by the driver's own
       attention exactly as the glance rate is. There is no measurement
       of "how often people look" in BEHAVIOUR.md to set it from.

       ── AND IT DEFAULTS TO ZERO, which needs saying out loud ──────────
       This mechanism is built, wired, and demonstrably works — turn it
       up and you get sideswipes, aborts, wrecks and the pile-ups behind
       them. It is switched OFF, because it is not calibrated and at any
       value that produces crashes at all it is BISTABLE. At 0.055 the
       reference road ran clean on two seeds out of three and gridlocked
       on the third: 70 wrecks, throughput halved, and it never
       recovered inside the run. A road whose safety depends on the seed
       is not a model of anything.

       The reason is a motive that does not exist yet. PLAN.md §5c has
       `yield` on the list and it is not built, so nobody in this
       model ever gives way. In dense traffic a lane change is not a gap-
       acceptance problem at all, it is a negotiation: you put your nose
       in and the other driver lets you, at a closing speed of about a
       metre a second. Model the squeeze without the yield and every
       merge is forced and nobody gives way, which is not a motorway —
       it is a demolition derby with indicators.

       So: `miss` is an option, its default is 0, and the day `yield`
       lands this is the first thing to turn back on. What that costs
       today is nothing that can be measured. A real freeway does 0.62
       crashes per million vehicle-km and the reference run covers
       12,000, so the honest expectation either way is 0.007 crashes —
       zero is the right answer at this exposure, and the mechanism that
       matters for the game is the one that still runs: a wreck already
       on the road, and everything behind it. */
    const BLIND_SPOT = 5.0;          // m behind the tail, laterally alongside
    const MISS = (o.miss == null ? 0 : o.miss);       // base P(no shoulder check)

    const rmLead = { v: null, gap: 0, spd: 0 };
    const rmLag = { v: null, gap: 0, spd: 0 };
    function perceived(veh, other, out, behind) {
      if (!other) { out.v = null; return; }
      const p = seen(other, stale(veh, other));
      out.v = other;
      out.spd = p.v;
      /* Same gap, recomputed against where the driver thinks they are. */
      out.gap = behind ? veh.s - veh.len - p.s : p.s - other.len - veh.s;
    }

    /* ══ and the half of it that saves nearly everybody ═══════════════
       A driver who pulls out onto somebody they never saw does not, in
       life, usually hit them. They get a horn, or the car appears in the
       corner of their eye the moment their own bonnet crosses the line,
       and they pull back. Lane-change CONFLICTS are common; lane-change
       CRASHES are rare; the abort is the entire difference between the
       two numbers, and a model with the blind spot and without the abort
       overstates the crash rate by three orders of magnitude. That is
       measured, not asserted: it is what this file did before this
       block existed.

       So the manoeuvre can now be abandoned — and the comment below
       saying nothing is reconsidered was right about the general case
       and is kept, because this is not the general case. A manoeuvre is
       abandoned for exactly one reason: there turns out to be a vehicle
       in the lane, alongside. Not because the gap got worse, not because
       a better one appeared, not because the motive changed its mind.

       How long the driver takes to notice is their own tracking delay —
       they are already looking that way, they are mid-manoeuvre — and
       during that delay they keep moving over. That is where the ones
       that do connect come from, and nothing anywhere decides which. */
    function alongside(veh) {
      const arr = byLane[veh.to];
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].s <= veh.s) lo = m + 1; else hi = m; }
      for (let i = lo - 1; i >= 0; i--) {
        const o = arr[i];
        if (o === veh) continue;
        if (veh.s - veh.len >= o.s) break;
        return o;
      }
      for (let i = lo; i < arr.length; i++) {
        const o = arr[i];
        if (o === veh) continue;
        if (o.s - o.len >= veh.s) break;
        return o;
      }
      return null;
    }

    /* Reversing is exact rather than approximate, and it is worth one
       line of algebra to see why. Swap the ends and mirror the phase:
       `lateral` satisfies lateral(1−p) = 1 − lateral(p), so the vehicle
       does not jump, and its lateral velocity profile is a sinusoid and
       so does not jump either. The car simply stops going that way and
       comes back, which is what a driver who has just been hooted at
       actually does. */
    function abortChange(veh) {
      const was = veh.to;
      veh.to = veh.from; veh.from = was;
      veh.phase = 1 - veh.phase;
      veh.sawIt = 0; veh.aborted = true;
      if (counting()) stat.aborts++;
    }

    /* ── and how badly they want it changes what they will accept ────
       `urgency` comes from the decider, on the motive layer's own scale,
       and it is the last thing `room` needs that it did not have. A
       driver in lane 3 with the gore coming up does not apply the gap
       standard they use on an idle Tuesday; they take what is there.

       This is not a safety valve bolted on. It is §5c's account of where
       a mistake actually comes from — "a gap acceptance drawn too tight
       for the closing speed actually faced" — and without it the model
       loses people at the gore for a silly reason: 428 of 751 missed
       exits were vehicles that had made it all the way to lane 3 and
       could not get the last hop, because the exit lane is the busiest
       lane on the road and their ordinary nerve said no.

       It is its OWN field on the decider's answer rather than being read
       off `urgency`, and that distinction cost a bug. Urgency is on the
       motive layer's scale, where above 1 means "this has stopped being
       an opinion" — but the two stand-in deciders do not use that scale:
       MOBIL's urgency is an acceleration gain in m/s², routinely above
       1, so reading nerve off it quietly handed the standard model of
       the literature a courage bonus and moved numbers it had no
       business moving. A decider that wants extra nerve now has to say
       so. Capped, because a driver who would accept any gap at all is
       not desperate, they are a physics violation. */
    const DESPERATE = 1.6;           // how much extra nerve, at full stretch

    function room(veh, ln, nerve) {
      /* A lane you cannot finish the manoeuvre in is not a lane you can
         move into, whatever the gap says. This is a physical refusal
         rather than a preference — the preference belongs in the
         motives, and the two stand-in deciders have none. */
      if (ln === DROP_LANE
          && DROP_AT - veh.s < veh.v * durationOf(latAccel(veh.drv, veh.latZ)))
        return false;
      const n = neigh(ln, veh.s, veh);
      const tol = tolerable(veh.drv)
                * Math.min(DESPERATE, Math.max(1, nerve || 1));

      perceived(veh, n.lead, rmLead, false);
      /* Blind spot first, because a driver who did not look does not get
         a delayed picture of that vehicle — they get no picture at all.
         `lagGap` is negative once the other vehicle's nose is past this
         one's tail, which is precisely the alongside case. */
      const hidden = n.lag && n.lagGap < BLIND_SPOT && !veh.looked;
      perceived(veh, hidden ? null : n.lag, rmLag, true);

      const lead = rmLead.v, lag = rmLag.v;
      const leadGap = lead ? rmLead.gap : Infinity;
      const lagGap = lag ? rmLag.gap : Infinity;

      // Never onto a bumper, whatever the arithmetic says.
      if (leadGap < veh.s0) return false;
      if (lag && lagGap < lag.s0) return false;

      const mine = idm(veh.v, veh.drv.want, lead ? leadGap : null,
                       lead ? veh.v - rmLead.spd : 0, veh.par);
      if (mine < -tol) return false;

      if (lag) {
        /* ── and NOT the speed the arriving vehicle will be at ─────────
           Tried, measured, and wrong, which is worth a note because it
           is the obvious idea and it looks right. A queued ramp
           discharges from a standstill — the median merge speed is
           **0.0 m/s** — and judging a stationary vehicle against a
           follower doing 28 demands a couple of hundred metres of gap,
           so it seemed clear that the follower should be judged against
           the speed the merger will have accelerated to rather than the
           one it is sitting at.

           Projecting both over the manoeuvre — merger accelerating,
           follower holding station — made it strictly WORSE: the ramp
           served 270 veh/h before and **60** after, because a stopped
           vehicle gains 16 m while the traffic gains 112, so the
           projected gap is a hundred metres SMALLER and the criterion
           tightens. And it double-counts: `idm` already prices the
           closing, on the real gap and the real speed difference, which
           is the whole content of the standard safety criterion. Adding
           a closing term in front of it charges for the same metres
           twice.

           The number that is wrong here is 0.0 m/s, and it is wrong in
           the ramp model rather than in this test. See PLAN.md §5j. */
        const theirs = idm(rmLag.spd, lag.drv.want, lagGap, rmLag.spd - veh.v, lag.par);
        /* The arriving driver judges the follower by its OWN nerve, not
           by the follower's, which is exactly the asymmetry that makes a
           tight merge annoying rather than impossible. */
        if (theirs < -tol) return false;
      }
      return true;
    }

    /* What a decider is allowed to see. One object, reused, with the
       adjacent lanes behind a call rather than in a field — a motive
       that does not consider the left lane should not pay for looking at
       it, and at 36,000 steps an hour that is the difference between a
       run taking seconds and taking minutes.

       It is also the enforcement point for "no perfect information"
       (PLAN.md §5c): a decider gets its own leader, the two lanes beside
       it, and the corridor under it. It does not get `live`. */
    const view = {
      lanes: nLanes, lane: 0, limit: 0, px: 0, veh: null,
      lead: null, gap: null,
      /* Metres to the next interchange. Infinity when the caller did not
         say where any are, which is the featureless-mainline case every
         run before 2026-08-10 was. */
      junction: Infinity,
      /* Metres to THIS vehicle's own exit. Infinity when it has none,
         which is most of them — see `drawExit`. */
      exitIn: Infinity,
      /* Metres of THIS vehicle's own lane left in front of it. Infinity
         unless it is standing in one that ends. */
      laneEnds: Infinity,
      /* The vehicle on a slip road beside you, or null — `ds` metres
         ahead (negative behind), `used` of its acceleration lane spent.
         Null for everybody not in the lane it is joining, because a
         merge two lanes over is not yours to make room for. */
      merging: null,
      /* Metres of that lane left in front of me, Infinity for a lane
         that does not end. Both the motive that gets people out of a
         dying lane and the ones that must stop shepherding people into
         it ask this. */
      endsIn(ln) { return endsIn(ln, this.veh.s); },
      side(ln) {
        if (ln < 1 || ln > nLanes) return null;
        const n = neigh(ln, this.veh.s, this.veh);
        return { lead: n.lead, lag: n.lag, leadGap: n.leadGap, lagGap: n.lagGap,
                 ends: endsIn(ln, this.veh.s) };
      },
      get left() { return this.side(Math.round(this.lane) - 1); },
      get right() { return this.side(Math.round(this.lane) + 1); },
    };
    const ctx = { rng, t: 0, dt, lanes: nLanes, px: px0, when, dir, state: st };

    const counting = () => t >= warmup;

    /* ── crossing into a moving band ──────────────────────────────────
       One Poisson clock per lane per edge, at the same per-lane rate the
       fixed boundary uses, scaled by `K` so that the acceptance
       probability below can never exceed one. `K` is a thinning bound
       and nothing else: raising it costs candidates and changes no
       distribution. It only bites when the band outruns the traffic,
       which is a player at 190 km/h among lorries at 90.

       A candidate that finds no room is DROPPED rather than queued. At
       the leading edge that is the physical answer — a full road is a
       road nothing can cross into — and at the trailing edge it is the
       same judgement the boundary already makes. */
    const edgeDue = roam ? [[], []] : null;                    // [trail, lead][lane]
    if (roam) {
      for (let ln = 0; ln <= MAX_LANES; ln++) { edgeDue[0][ln] = 0; edgeDue[1][ln] = 0; }
      /* Only on a roaming world, so the harness's ledger is untouched. */
      stat.tried = 0; stat.passed = 0; stat.noRoom = 0; stat.injected = 0;
    }

    /* ── how much road there is to cross an edge ──────────────────────
       The flux across an edge is k·(u−vb), and the third thing that went
       wrong here was reading `k` off the band itself. Density and speed
       are not independent — q = k·u is the fundamental diagram, and 1585
       veh/h/lane is available BOTH free-flowing at 15 veh/km and jammed
       at 29. Sampling the band's own speed to infer its own density
       closes a loop around that identity: over-supply the band once and
       its mean speed drops, which makes the inferred density rise, which
       supplies it harder. At 119 mph it walked itself onto the congested
       branch in two minutes and sat there — 28 veh/km at 15 m/s, exactly
       self-consistent and exactly wrong.

       So the density target is the corridor's, fixed at construction and
       never read back off the road: k* = q / harmonic-mean desired
       speed, which is the exact inverse relation rather than an
       approximation to it (a road's density is the sum of q(u)/u, not
       q over the mean of u). The SPREAD still comes off the live
       population, because that is what makes travelling at the mean
       exchange traffic at all — it just no longer sets the level. */
    let vHarm = 30;                                             // m/s, filled below
    let kStar = 0;                                              // veh/m, one lane
    let vBar = 0;                                               // realised, smoothed
    function reference() {
      let inv = 0, n = 0;
      for (let i = 0; i < 300; i++) {
        const kind = TR.drawKind(px0, when, rng);
        const d = TR.driver(kind, px0, when, st, rng);
        if (d.want > V_FLOOR) { inv += 1 / d.want; n++; }
      }
      if (n) vHarm = n / inv;
      vBar = vHarm;
      kStar = (qLane / 3600) / vHarm;
    }

    /* ── and the difference between wanting and getting ───────────────
       k = q/v is exact, and `v` in it is the speed the road RUNS at, not
       the speed its drivers would like to. On a busy corridor those are
       not close: at 1585 veh/h/lane the harness realises 57.8 mph
       against a population wanting about 65, so a target built on
       desired speed under-supplies by the ratio — measured, 89% of the
       density and 92% of the flow, at every band speed at once.

       Letting the target chase the band's own realised speed fixes the
       parked case and breaks the moving one, and the reason is worth
       writing down because it is not obvious. A band travelling at
       119 mph is FULL of traffic slower than itself — that is what
       overtaking is — so its mean speed is not the corridor's, and a
       target built on it supplies harder, which congests it, which
       lowers the mean again. 117% of the density at 17.8 m/s, held off
       the congested branch only by a floor.

       The discount between wanting and getting is a property of the
       CORRIDOR at this flow, not of the observer, so it is measured once
       with the band standing still and then frozen. Everything after
       that is arithmetic on the corridor's own numbers. */
    const TAU_REF = 60;                          // s, smoothing while parked
    let discount = 1;                            // vHarm / realised, ≥ 1
    let settling = false;

    function realised() {
      let inv = 0, n = 0;
      const lo = loEdge(), hi = hiEdge();
      for (let i = 0; i < live.length; i++) {
        const v = live[i];
        if (v.wreck || v.s < lo || v.s > hi || !(v.v > V_FLOOR)) continue;
        inv += 1 / v.v; n++;
      }
      return n < 8 ? 0 : n / inv;
    }

    function retarget() {
      if (!settling) return;
      const now = realised();
      if (!now) return;
      vBar += (now - vBar) * Math.min(1, dt / TAU_REF);
      kStar = (qLane / 3600) / vBar;
    }

    /* Stand still until the population stops changing, take the
       discount, and never look at the road again. `SETTLE_S` is three
       times the minute the smoothing runs over, which is what it takes
       for the parked band to reach the density the standing harness
       reports — measured, not assumed. */
    const SETTLE_S = 180;
    function settle() {
      settling = true;
      const until = t + SETTLE_S;
      while (t < until) step();
      settling = false;
      discount = Math.max(1, vHarm / Math.max(vBar, 1e-6));
    }

    /* The corridor changes under a band that travels hundreds of miles:
       the flow, the limit and so the speeds people want are all
       functions of where you are. Re-read every RETARGET_S of driving,
       which is cheap at that interval and is the only thing that makes a
       drive from the Mojave to Knoxville feel like two different roads.
       The discount is not re-measured — it is the corridor's, and
       re-measuring it is what the loop above forbids. */
    const RETARGET_S = 30;
    let nextCorridor = 0;
    function corridorTarget() {
      if (settling || t < nextCorridor) return;
      nextCorridor = t + RETARGET_S;
      const px = pxAt(bandS);
      if (o.q == null) qLane = TR.demand(px, when, dir) / nLanes;
      let inv = 0, n = 0;
      for (let i = 0; i < 120; i++) {
        const kind = TR.drawKind(px, when, rng);
        const d = TR.driver(kind, px, when, st, rng);
        if (d.want > V_FLOOR) { inv += 1 / d.want; n++; }
      }
      if (n) vHarm = n / inv;
      kStar = (qLane / 3600) * discount / vHarm;
    }

    /* ── the speed the flux is about ──────────────────────────────────
       Two things were wrong here and the second one hid behind the
       first.

       It first thinned on the driver's DESIRED speed, and that emptied
       the road: at a band speed of 27 m/s among traffic wanting 30 but
       realising 25, every candidate was judged faster than the band and
       offered to the trailing edge, while the vehicles actually falling
       out of the back went unreplaced. What crosses an edge is set by
       how fast a vehicle IS going, not by how fast it would like to.

       Replacing `want` with the lane's realised MEAN then failed at
       precisely the interesting speed. E[(v−vb)⁺] is not (E[v]−vb)⁺, and
       when the band travels at the mean the difference is the whole
       quantity: half the traffic leaves forwards and half backwards,
       both at the spread rather than at the mean, and a mean-field flux
       says nothing crosses at all. Travelling with the traffic emptied
       the band as surely as outrunning it did.

       So the speed is RESAMPLED from the band's own live population —
       same lane and same class where there is one, because a lorry does
       not inherit a car's speed. That is a bootstrap rather than a
       second opinion about the road, it carries the spread by
       construction, and it is why the parked case still comes back to
       the harness. */
    function sampleV(ln, kind, want) {
      const arr = byLane[ln];
      if (arr && arr.length) {
        for (let k = 0; k < 8; k++) {
          const c = arr[(rng() * arr.length) | 0];
          if (c && !c.wreck && c.kind === kind && c.v > V_FLOOR) return c.v;
        }
      }
      for (let k = 0; k < 8; k++) {
        const c = live[(rng() * live.length) | 0];
        if (c && !c.wreck && c.kind === kind && c.v > V_FLOOR) return c.v;
      }
      if (arr && arr.length) {
        const c = arr[(rng() * arr.length) | 0];
        if (c && !c.wreck && c.v > V_FLOOR) return c.v;
      }
      return want;                     // an empty band has only the draw
    }

    /* Injected a little INSIDE the edge rather than on it. On it, a
       vehicle entering at the leading edge moved forward by v·dt in the
       same step and was retired by the boundary test that had just let
       it in — 204 injected and none alive, at 89 mph. */
    const INSET = 25;                                           // m

    /* ── and retired well OUTSIDE it ──────────────────────────────────
       Injecting and retiring at the same line makes the edge absorbing:
       a vehicle travelling within a metre a second of the band drifts
       out, is deleted, and can only come back as a fresh draw at the
       flux rate. That is a loss the flux does not price, and it is worst
       exactly where the flux is smallest — a band moving AT the speed of
       the traffic exchanges almost nothing, so almost nothing replaces
       what the edge shaves off. Measured: half the corridor's density
       after ten minutes at 60 mph, with every other band speed correct.

       So the two lines are different lines. Traffic is admitted just
       inside the band and kept until it is well outside, which lets a
       vehicle wander across and back the way it really would. */
    const SOFT = 1000;                                           // m
    const loKeep = () => loEdge() - SOFT, hiKeep = () => hiEdge() + SOFT;

    /* A vehicle that crosses an edge and finds no room is NOT destroyed.
       Dropping it loses flux, and the loss is not small — a quarter of
       everything accepted at the parked band, which is exactly the
       quarter by which the road came out short of the flow it was asked
       for. The fixed boundary has always queued instead, and the reason
       is the same: a full road does not annihilate the traffic behind
       it, it delays it. So an edge holds what it could not place and
       tries again, carrying it with the edge.

       Bounded, because a band that cannot take traffic for a minute is a
       jam and the vehicles behind it are somewhere else by now. */
    const Q_MAX = 6;
    const edgeQ = roam ? [[], []] : null;
    if (roam) for (let ln = 0; ln <= MAX_LANES; ln++) { edgeQ[0][ln] = []; edgeQ[1][ln] = []; }

    /* The speed scale the acceptance is divided by. It has to cover both
       (u − vb) and (vb − u), so it is the band's speed plus the fastest
       anything travels; raising it costs candidates and moves no
       distribution. */
    const V_TOP = 45;                                           // m/s, ~100 mph

    function inject() {
      retarget();
      corridorTarget();
      /* |vb| because the band may be running AGAINST the traffic — the
         oncoming carriageway, seen from a car on this one — and the
         bound has to cover (u + |vb|) either way. */
      const S = Math.abs(bandV) + V_TOP;
      const rate = kStar * S;                                   // veh/s, one lane
      if (!(rate > 0)) return;
      for (let ln = 1; ln <= nLanes; ln++) {
        for (let e = 0; e < 2; e++) {
          const q = edgeQ[e][ln];
          while (t >= edgeDue[e][ln]) {
            edgeDue[e][ln] += -Math.log(1 - rng()) / rate;
            const at = e === 0 ? loEdge() + INSET : hiEdge() - INSET;
            /* The class is drawn first and the driver only if the
               candidate survives, because `TR.driver` is the expensive
               half and most candidates are thinned away. */
            const kind = TR.drawKind(pxAt(at), when, rng);
            const u = sampleV(ln, kind, vHarm);
            /* k*·(u−vb) behind, k*·(vb−u) in front, over the candidate
               rate k*·S — which leaves the speed difference over S. */
            const p = (e === 0 ? u - bandV : bandV - u) / S;
            stat.tried++;
            if (p <= 0 || rng() > p) continue;
            stat.passed++;
            const v = born(at, ln, kind);
            v.enterV = u;
            q.push(v);
            while (q.length > Q_MAX) { q.shift(); stat.noRoom++; }
          }
          /* Everything waiting tries again, at wherever the edge is now. */
          for (let i = 0; i < q.length;) {
            const v = q[i];
            const at = e === 0 ? loEdge() + INSET : hiEdge() - INSET;
            v.s = at;
            if (!place(v, ln, at, v.enterV)) { i++; continue; }
            v.v = v.enterV; v.from = v.to = v.lane;
            v.hV.fill(v.v);
            live.push(v); insert(byLane[ln], v); stat.injected++;
            q.splice(i, 1);
          }
        }
      }
    }

    /* Room to stand, judged by the test the same driver would apply to
       changing lane: a gap it can take without braking harder than it
       will wear, and without making the vehicle behind do so either. */
    function place(v, ln, at, want) {
      const n = neigh(ln, at, v);
      if (n.lead && (n.leadGap <= v.s0
          || idm(want, want, n.leadGap, want - n.lead.v, v.par) <= -tolerable(v.drv))) return false;
      if (n.lag && (n.lagGap <= n.lag.s0
          || idm(n.lag.v, n.lag.drv.want, n.lagGap, n.lag.v - want, n.lag.par) <= -tolerable(n.lag.drv)))
        return false;
      return true;
    }

    /* The band starts full, not empty. Without this the player pulls
       away from a standing start onto an empty motorway and the traffic
       seeps in from behind over the next minute. Walked lane by lane at
       the equilibrium spacing the population itself implies. */
    function fill() {
      index();
      for (let ln = 1; ln <= nLanes; ln++) {
        let s = loEdge();
        for (let guard = 0; guard < 4000 && s < hiEdge(); guard++) {
          const v = born(s, ln);
          v.s = s;
          const want = v.drv.want;
          /* Vehicles wanting speed v stand at k(v) = q/v, so the mean
             spacing is v/q — the same relation the edges are thinned by,
             used here in space instead of in time. Poisson rather than a
             comb, because evenly spaced traffic reads as evenly spaced. */
          s += (want / Math.max(1e-9, qLane / 3600)) * -Math.log(1 - rng());
          if (want > V_FLOOR && place(v, ln, v.s, want)) {
            v.v = want; v.from = v.to = v.lane; v.hV.fill(v.v);
            live.push(v); insert(byLane[ln], v);
          }
        }
      }
    }

    function step() {
      index();

      /* arrivals */
      if (roam) inject();
      while (!roam && t >= nextArrival) {
        pending.push(born());
        nextArrival += -Math.log(1 - rng()) / arrivalRate;
      }
      for (let i = 0; i < pending.length;) {
        const v = pending[i];
        /* Released only into an equilibrium-sized gap, at no more than
           the speed of whatever it is arriving behind. A boundary that
           injects vehicles faster than the lane can take them does not
           model congestion, it manufactures it — the first version of
           this loop checked every waiting vehicle against ONE index
           built before any of them were let go, so two arriving in the
           same tenth of a second into the same lane were both released
           onto s = 0 and were inside each other. The overlap was
           exactly the length of an articulated lorry, which is what
           gave it away, and the shock wave off it held a road the
           counters call free-flowing down to 50 mph. Anything released
           goes into the index at once. */
        /* Enter at the speed it wants, into a gap big enough to hold it
           there — plus, if the vehicle in front is slower, the room to
           shed the difference comfortably.

           The version that entered at `min(want, lead.v)` instead was a
           ratchet: the cap was read off whichever vehicle happened to be
           nearest AT THE MOMENT OF RELEASE, however far up the road it
           had got, so one slow lorry pulled every vehicle behind it into
           the road at 49 mph and the lane never recovered. The whole
           carriageway ran 13 mph under its desired speed with 55 m of
           clear road in front of every driver, which is the shape of
           fault this harness was built to catch and could not have been
           seen by looking at it. */
        const n = neigh(v.lane, 0, v);
        const want = v.drv.want;
        /* Judged by exactly the test the same driver would apply to
           changing lane: a gap it can enter without braking harder than
           it will wear. Sizing the gate at the full EQUILIBRIUM spacing
           instead — which is what the second version did — throttled the
           boundary to about 1,400 veh/h/lane, well under the 1,860 the
           road itself carries at this lorry share, so the queue was
           outside the model and every statistic downstream was being
           taken at a flow nobody asked for. A boundary must never be the
           narrowest thing in the run. */
        const ok = n.lead == null
          || (n.leadGap > v.s0
              && idm(want, want, n.leadGap, want - n.lead.v, v.par) > -tolerable(v.drv));
        /* `n.lag` at the boundary can only ever be a vehicle released
           into this lane a moment ago and still standing on s = 0.
           Nothing else in the run is ever behind the start line. */
        if (!n.lag && ok) {
          v.v = want; v.from = v.to = v.lane;
          live.push(v); byLane[v.lane].unshift(v);
          pending.splice(i, 1);
          if (counting()) stat.spawned++;
        } else { i++; if (counting()) stat.held += dt; }
      }
      if (pending.length > stat.queueMax) stat.queueMax = pending.length;

      /* ── and the on-ramps ───────────────────────────────────────────
         Same shape as the boundary above and one important difference:
         the boundary asks whether the lane is clear behind, because
         nothing in the run is ever upstream of the start line. A merging
         vehicle has traffic on both sides of it and has to be judged the
         way a lane change is judged — which is what `room` already does,
         with the delayed picture, the blind spot and the follower's
         braking all in it. So a merge is not a new piece of physics; it
         is the manoeuvre this file already models, entered from a
         standing start.

         Nerve is the only thing added, and §5c asked for it: a driver
         who has been sitting on the ramp for a while takes a gap they
         would not have taken on arrival. `room` clamps it at DESPERATE,
         so no amount of waiting buys a gap that is not there — the
         queue just grows, which is the jam. */
      mergers.length = 0;
      for (let ri = 0; ri < ramps.length; ri++) {
        const rp = ramps[ri];
        while (t >= rp.next) {
          const nv = born(rp.s);
          /* It arrives at the nose of the ramp below the speed of the
             road, and the acceleration lane is where it makes that up. */
          nv.v = MERGE_SPEED * nv.drv.want;
          nv.hV.fill(nv.v);
          rp.q.push(nv);
          rp.next += -Math.log(1 - rng()) / rampRate;
        }
        if (!rp.q.length) continue;
        /* Everybody on the ramp moves, not just the one at the front —
           it is a lane, and the queue that forms on it when nobody can
           get out is the thing worth seeing. Each is held behind the one
           ahead and behind the end of the tarmac. */
        for (let qi = 0; qi < rp.q.length; qi++) {
          const v = rp.q[qi];
          v.waited = (v.waited || 0) + dt;
          const stop = qi > 0
            ? Math.min(rp.end, rp.q[qi - 1].s - rp.q[qi - 1].len - v.s0)
            : rp.end;
          v.v = Math.min(v.drv.want, v.v + MERGE_ACCEL * dt);
          /* Braking to a stop at whatever is in front, be that the end
             of the lane or the car that could not get out either. */
          const room2 = stop - v.s;
          if (room2 <= 0) { v.v = 0; v.s = stop; }
          else if (v.v * v.v > 2 * BRAKE_MAX * room2) v.v = Math.sqrt(2 * BRAKE_MAX * room2);
          v.s = Math.min(stop, v.s + v.v * dt);
          if (counting() && qi === 0) stat.rampHeld += dt;
        }
        /* Only the leader may leave, because a vehicle merging from
           behind another one on the same ramp would be driving through
           it. */
        const v = rp.q[0];
        /* §5c, literally: urgency rises as the taper runs out. */
        const used = Math.max(0, Math.min(1, (v.s - rp.s) / MERGE_LEN));
        const nerve = 1 + (DESPERATE - 1) * used;
        /* Published BEFORE the attempt, so that the drivers who could
           make room are looking at the same vehicle this one is about to
           ask for a gap from. */
        if (LET_ON) {
          rp.pub.ds = v.s; rp.pub.used = used;
          rp.pub.v = v.v; rp.pub.len = v.len;
          mergers.push(rp.pub);
        }
        /* ── and it gets up to speed FIRST ───────────────────────────
           `room` asks whether the gap is big enough and whether anybody
           has to brake for it. It does not ask whether the merging
           vehicle is going fast enough to belong there, because for a
           lane change between two through lanes that question does not
           arise — both are already at road speed.

           From a slip road it is the whole problem. Without this the
           model merged vehicles into a 31 m/s lane at 22, found a gap
           big enough that nobody had to brake AT THAT MOMENT, and then
           let the lane catch them up: 2% per junction took the road from
           1,156 veh/h/lane to 596, worse than merging at a point. That
           is not a gap-acceptance failure, it is a speed-matching one,
           and an acceleration lane exists to fix exactly it.

           So a driver keeps accelerating while there is lane left, and
           only looks for a gap once they are within MERGE_MATCH of the
           traffic they are joining — unless the lane is running out,
           when they take what they can get. */
        const pace = neigh(nLanes, v.s, v).lead;
        const target = pace ? pace.v : v.drv.want;
        if (used < 0.85 && v.v < MERGE_MATCH * target) continue;
        if (!room(v, nLanes, nerve)) continue;
        v.from = v.to = v.lane = nLanes;
        v.hS.fill(v.s); v.hV.fill(v.v);
        live.push(v);
        insert(byLane[nLanes], v);
        rp.q.shift();
        rp.merged++;
        if (counting()) {
          stat.merged++;
          stat.mergeWait.push(v.waited);
          stat.mergeAt.push(v.s - rp.s);
          /* How fast it was going when it got in, and how much room it
             was given. A merge point pinned to the end of the taper says
             the queue is saturated; these two say what a merge out of
             that queue actually costs the road. */
          stat.mergeV.push(v.v);
          stat.mergeLag.push(neigh(nLanes, v.s, v).lagGap);
          rp.wait += v.waited;
        }
      }
      let qNow = 0;
      for (let ri = 0; ri < ramps.length; ri++) qNow += ramps[ri].q.length;
      if (qNow > stat.rampQueueMax) stat.rampQueueMax = qNow;

      /* decide, then move sideways */
      ctx.t = t;
      for (let i = 0; i < live.length; i++) {
        const veh = live[i];

        /* Somebody else is driving this one. It is in the index, so
           every other driver follows it, yields to it and can hit it —
           which is the whole point of putting it there — but it is not
           asked what lane it wants and its position is not this file's
           to write. See `pilot()`. */
        if (veh.piloted) continue;

        /* A wreck is not driving. It is not asked what lane it wants,
           it does not look at the road, and what happens to it next is
           friction. Everything else still sees it, because it is still
           in the index — which is the entire point. */
        if (veh.wreck) { veh.a = -WRECK_DECEL; veh.brake = true; continue; }

        glance(veh);
        veh.a = follow(veh);

        /* The lamps, and the two surrogates. `hard` is edge-triggered so
           one long brake application is one event and not forty. */
        veh.brake = veh.a < BRAKE_LIGHT;
        const hard = veh.a < HARD_BRAKE;
        if (counting() && veh.s >= zone[0] && veh.s <= zone[1]) {
          if (hard && !veh.hard) stat.hardBrakes++;
          if (followTTC < 20) stat.ttc.push(followTTC);
          if (followTTC < TTC_CONFLICT) stat.conflictTTC++;
        }
        veh.hard = hard;

        if (veh.phase > 0) {
          /* Mid-manoeuvre. Nothing is reconsidered — not the gap, not
             the motive, not a better opportunity one lane further over.
             A lane change that can be shopped around halfway is a
             different and much harder model and no measured duration
             would survive it.

             The one exception is a vehicle that turns out to be there,
             which is not reconsidering: see `abortChange`. */
          /* Once, and once only. A vehicle already on its way back is
             going back: the lane it is returning to is its own, it has
             every right to it, and a driver who ping-ponged between two
             lanes on every conflict would spend the whole manoeuvre
             straddling the line and blocking both. That is not a
             hypothetical — it is what the first version of this did, and
             it took the carriageway from 1,866 veh/h/lane to 149. */
          if (!veh.aborted) {
            if (alongside(veh)) {
              veh.sawIt += dt;
              if (veh.sawIt >= veh.track) { abortChange(veh); continue; }
            } else veh.sawIt = 0;
          }

          veh.phase += dt / veh.dur;
          if (veh.phase >= 1) {
            veh.phase = 0; veh.from = veh.lane = veh.to;
            if (!veh.aborted) veh.changes++;
            veh.aborted = false;
          } else veh.lane = veh.from + (veh.to - veh.from) * lateral(veh.phase);
          continue;
        }

        view.lane = veh.lane; view.limit = veh.limitAt; view.veh = veh;
        view.lead = followLead; view.gap = followGap; view.px = pxAt(veh.s);
        view.junction = junctionAhead(view.px);
        view.exitIn = veh.exitPx == null ? Infinity : toPx(view.px, veh.exitPx);
        view.laneEnds = endsIn(Math.round(veh.lane), veh.s);
        /* Only the lane being joined is asked to look. A driver two
           lanes in has nothing to give and nothing to fear, and asking
           everybody would spend the search on drivers who cannot act. */
        view.merging = LET_LAT && mergers.length && veh.lane > nLanes - 0.5
          ? nearestMerger(veh) : null;
        const want = decide(veh, view, ctx);
        if (!want) continue;
        const ln = want.lane;
        if (ln === veh.lane || ln < 1 || ln > nLanes
            || Math.abs(ln - veh.lane) !== 1) continue;

        /* Drawn per manoeuvre and not per driver: even somebody who
           normally looks occasionally does not, and it is the individual
           manoeuvre that either kills somebody or does not. Mid-glance
           there is nothing to draw — their eyes are elsewhere. */
        /* Nobody starts a lane change while looking at their phone.
           This is not a safety rule bolted on, it is what the word
           "decide" means: a driver mid-glance is not looking at the
           lane they would be moving into, so there is no decision to
           make. Leaving it out was worth measuring — a driver initiating
           a manoeuvre off a picture of the mirror up to 3.2 s old cuts
           in on people who are not where they were, and a saturated
           carriageway lost half its throughput to it. */
        if (veh.gaze > 0) continue;
        veh.looked = rng() >= MISS * (1 - 0.92 * veh.attention);
        if (!room(veh, ln, want.nerve)) continue;
        /* Counted AFTER the gate, so it is the number of manoeuvres that
           actually happened with nobody having looked — which is the
           quantity that can produce a crash. Counting proposals instead
           put it at 97% of all changes, because a decider proposes a
           lane change every tick it wants one and `room` throws almost
           all of them out. */
        if (counting() && !veh.looked) stat.blindChanges++;

        veh.from = veh.lane; veh.to = ln;
        veh.dur = durationOf(latAccel(veh.drv, veh.latZ));
        veh.phase = 1e-9; veh.why = want.why || null;
        /* Carried on the vehicle as well as into the trace, because a
           lamp is a thing you can see and the trace is a thing a roaming
           world does not keep. Same expression, no extra draw — the
           habit was decided once, when the driver was made. */
        veh.signal = want.signal ? "proper" : veh.drv.signal;
        /* Into the target lane's index THIS INSTANT, before the next
           vehicle is asked. Otherwise two drivers on opposite sides of
           the same gap, deciding in the same tenth of a second against
           the same stale index, both take it and neither ever saw the
           other. That is not a near miss the model can recover from —
           they are inside each other before either has moved. */
        insert(byLane[ln], veh);
        if (counting() && veh.s >= zone[0] && veh.s <= zone[1]) {
          /* The motive trace. Per change: who, where, which way, which
             motive won and by how much, and whether they indicated.
             Without it "the car changed lane" is not a fact anyone can
             argue with. */
          stat.changes.push({
            t, id: veh.id, kind: veh.kind, from: veh.from, to: veh.to,
            dir: veh.to < veh.from ? "left" : "right",
            why: veh.why, urgency: want.urgency == null ? null : want.urgency,
            /* A decider may override the habit. `yield` and `avoid` do:
               §5c is explicit that a driver doing you a courtesy is
               exactly the driver who indicates, and the signal is what
               makes that legible rather than merely kind. Everything
               else obeys the measured 48/26/26 split. */
            s: veh.s, v: veh.v, dur: veh.dur,
            signal: want.signal ? "proper" : veh.drv.signal,
          });
          stat.durations.push(veh.dur);
        }
      }

      /* integrate, count, retire */
      const doSample = counting() && steps % SAMPLE_EVERY === 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const veh = live[i];
        if (veh.piloted) continue;                 // driven from outside

        if (veh.wreck) {
          /* Off the throttle, wheels pointing the wrong way, and sliding
             — both along the road and across it. Where it stops is not a
             lane, it is wherever the friction ran out, and `index` puts
             it into whatever lanes that turns out to block. */
          const v0w = veh.v;
          veh.v = Math.max(0, veh.v - WRECK_DECEL * dt);
          veh.s += (v0w + veh.v) * 0.5 * dt;
          const drag = veh.mu * 9.81 * dt;
          veh.vy -= Math.sign(veh.vy) * Math.min(Math.abs(veh.vy), drag);
          veh.lane = clampLane(veh.lane + veh.vy * dt / LANE_W);
          veh.from = veh.to = Math.max(1, Math.min(nLanes, Math.round(veh.lane)));
          remember(veh);
          /* It is still occupying tarmac and the lane-occupancy figures
             should say so; it is not driving, so it is not a speed
             sample. */
          if (counting() && veh.s >= zone[0] && veh.s <= zone[1]) {
            stat.laneSec[veh.from][veh.kind] += dt;
            stat.laneSec[veh.from].all += dt;
          }
          if (t - veh.wreck.at > CLEAR) live.splice(i, 1);
          continue;
        }

        const v0 = veh.v;
        veh.v = Math.max(0, veh.v + veh.a * dt);
        const ds = (v0 + veh.v) * 0.5 * dt;
        veh.s += ds;
        /* ── a tap shoves the car sideways, and the driver CATCHES it ──
           (Ric, 2026-08-12: "seems like it should cause more issues
           than it currently is".)

           It should, and this line was most of why it did not. It read
           `veh.vy = 0` — the solver worked out how hard the car had been
           knocked across the road, and one line later the driver undid
           all of it, perfectly, in a hundredth of a second, every time.
           Nothing could ever be destabilised by a scrape: you were
           either wrecked outright or you were exactly where you started,
           with no in-between. That is the opposite of the real thing,
           where the impact is trivial — a motorway sideswipe is single
           digits of delta-v — and the TROUBLE is all in the catching.

           "Nobody drifts a lane from a scrape" is right and it survives:
           the catch is now at this driver's own lateral acceleration
           rather than instant, so the excursion is vy²/2a and settles
           itself. A 0.66 m/s knock — a car drifting into your flank at
           walking pace — moves you 18 cm and is a wobble. It takes about
           3 m/s before you are into the next lane, and a knock that hard
           is not a scrape any more.

           No new constant, and the same argument the paragraph below
           already makes for steering back: it is the same driver doing
           the same manoeuvre, so it is the same number. A brisk driver
           catches it in half the distance a lazy one does, which is the
           correlated-personality model this file runs on everywhere. */
        if (veh.vy) {
          veh.lane = clampLane(veh.lane + veh.vy * dt / LANE_W);
          const catchA = latAccel(veh.drv, veh.latZ) * dt;
          veh.vy -= Math.sign(veh.vy) * Math.min(Math.abs(veh.vy), catchA);
        }

        /* ── and they steer back into their lane ───────────────────────
           Catching the sideways VELOCITY is not the same as undoing the
           sideways POSITION, and only the first was ever done.
           `separate()` moves a vehicle across the road by a fraction of
           a lane to get it out of whatever it just hit, and nothing
           afterwards puts it back: `lane` is written only by the
           manoeuvre, so a vehicle that was not mid-change when it was
           shunted keeps its offset FOR THE REST OF ITS LIFE.

           Measured on a road with one staged incident on it: seven
           vehicles left straddling a line while not changing lane, the
           worst a clean half-lane out, two of them still there at the
           end of the run. A vehicle at lane 1.5 sits in `byLane[1]` and
           `byLane[2]` — it obstructs two lanes, is hit by both, and
           every one of those hits leaves another one like it.

           Reported from play as a car "driving between the lanes", which
           is exactly what it was. It steers back at the rate this driver
           changes lane at, because that is the same manoeuvre and there
           is no reason for it to have a second constant. */
        if (veh.phase === 0) {
          const home = Math.round(veh.from);
          if (veh.lane !== home) {
            const per = dt / durationOf(latAccel(veh.drv, veh.latZ));
            const d = home - veh.lane;
            veh.lane = Math.abs(d) <= per ? home : veh.lane + Math.sign(d) * per;
            veh.from = veh.to = home;
          }
        }

        /* The limit follows the corridor and so does what this driver
           wants — which is what traffic.js keeps `speedU` for. On a six
           kilometre stretch this almost never fires; on the day the
           harness is pointed at a state line it will. */
        const lim = TR.limitFor(veh.kind, pxAt(veh.s), st);
        if (lim !== veh.limitAt) {
          veh.limitAt = lim;
          veh.drv.want = TR.desiredSpeed(veh.kind, pxAt(veh.s), when, st,
                                         veh.drv.speedU, veh.drv.govU);
        }

        if (counting() && veh.s >= zone[0] && veh.s <= zone[1]) {
          stat.vehKm += ds / 1000;
          stat.kmBy[veh.kind] += ds / 1000;
          const ln = Math.round(veh.lane);
          stat.laneSec[ln][veh.kind] += dt;
          stat.laneSec[ln].all += dt;
          if (doSample) {
            stat.laneSpeed[ln].push(veh.v);
            stat.speed[veh.kind].push(veh.v);
            stat.accel.push(veh.a);
          }
        }

        remember(veh);

        /* ── getting off ─────────────────────────────────────────────
           And whether it managed to. A vehicle at the gore in the exit
           lane leaves the mainline; one that is still two lanes over
           does not, and that is not a special case — it is the same
           `exitLead` trait drawn at the wrong end meeting traffic that
           did not part. §5c: "some move right miles before their exit
           and some cross four lanes at the mouth of it", and one trait
           produces both the careful and the appalling.

           A driver who misses it takes the next one, because that is
           what you do. It is not a route — §5c is explicit that a
           vehicle's whole plan is the one exit — it is the same problem
           again, one junction later. */
        if (veh.exitPx != null && toPx(pxAt(veh.s), veh.exitPx) <= 0) {
          if (Math.round(veh.lane) >= nLanes || veh.to >= nLanes) {
            if (counting()) { stat.exited++; stat.byKind[veh.kind]++; }
            live.splice(i, 1);
            continue;
          }
          if (counting()) {
            stat.missedExit++;
            const L = Math.round(veh.lane);
            stat.missedFrom[L] = (stat.missedFrom[L] || 0) + 1;
          }
          veh.missed++;
          const nxt = firstAhead(pxAt(veh.s));
          veh.exitPx = nxt < 0 ? null : jx[nxt];
        }

        /* A roaming band retires at BOTH edges: a vehicle the player has
           left far behind is as gone as one that has run away in front,
           and neither is a detector crossing. */
        if (roam) {
          if (veh.s > hiKeep() || veh.s < loKeep()) live.splice(i, 1);
          continue;
        }

        if (veh.s > roadLen) {
          if (counting()) {
            stat.detector++; stat.byKind[veh.kind]++;
            /* Reached the far end still carrying an exit it never took.
               Counted per VEHICLE, because `missedExit` counts events and
               one driver can sail past three gores in a row. */
            if (veh.missed > 0) stat.everMissed++;
          }
          live.splice(i, 1);
        }
      }

      /* ── and now find out whether anybody hit anybody ────────────────
         After everything has moved, because a collision is a fact about
         where the vehicles ENDED UP, not about what they intended. */
      index();
      sweep();

      /* The staged one. Fires once, on the vehicle nearest the spot. */
      if (incident && t >= incident.t) {
        const arr = byLane[clampLane(incident.lane || 1)];
        let best = null, near = Infinity;
        for (let i = 0; i < arr.length; i++) {
          const d = Math.abs(arr[i].s - incident.s);
          if (!arr[i].wreck && d < near) { near = d; best = arr[i]; }
        }
        if (best) {
          /* Struck side-on and hard, which is what puts a vehicle across
             a lane rather than along it. `vy` is what makes it slide. */
          wreck(best, { outcome: "damage", dv: 8, eff: 30, ang: 90 });
          best.vy = (incident.vy == null ? 3 : incident.vy);
          stat.staged = { t, id: best.id, kind: best.kind, s: best.s, lane: best.lane };
          incident = null;
        }
      }

      /* Overlaps. Two vehicles in one lane cannot occupy the same tarmac
         AND BOTH BE DRIVING — if they ever do it is the FOLLOWING model
         that has failed, not the motive layer, so this is an assertion
         about the harness itself and the test treats it as one.

         The qualification is new and it is the whole difference this
         change makes. Overlap is now a modelled event with a solver
         behind it, so the audit has to exclude the pairs that are IN one
         — a shunted car and the lorry still pressed against it are not a
         bug, and a wreck lying across a lane with traffic stopped an
         inch off it is the thing being simulated. What the audit still
         means, exactly, is: nobody drove through anybody. */
      if (counting() && steps % SAMPLE_EVERY === 0) {
        index();                     // `separate` moved things; re-sort
        for (let ln = 1; ln <= nLanes; ln++) {
          const arr = byLane[ln];
          for (let i = 1; i < arr.length; i++) {
            const me = arr[i - 1], lead = arr[i];
            if (me.wreck || lead.wreck || me.hitAt === t || lead.hitAt === t) continue;
            const g = lead.s - lead.len - me.s;
            if (g >= 0) continue;
            /* Overlapping along the road is not enough, and treating it
               as enough reported 1,238 impossible events in a run where
               nothing impossible happened. A vehicle halfway through a
               manoeuvre is in two lane arrays at once, so the car in the
               next lane level with it turns up as its immediate
               neighbour with a negative gap — and it is not in the same
               place as it, it is BESIDE it, which is the ordinary state
               of a motorway. Sharing tarmac means both axes. */
            if (Math.abs(me.lane - lead.lane) * LANE_W >= (me.w + lead.w) / 2) continue;
            stat.conflicts++;
            if (-g > stat.worstOverlap) stat.worstOverlap = -g;
          }
        }
      }

      /* Headway and gap, sampled the way the drone measured them: every
         leader-follower pair in frame, at an instant, over and over. */
      if (counting() && steps % PAIRS_EVERY === 0) {
        index();
        for (let ln = 1; ln <= nLanes; ln++) {
          const arr = byLane[ln];
          for (let i = 1; i < arr.length; i++) {
            const me = arr[i - 1], lead = arr[i];
            if (me.s < zone[0] || me.s > zone[1]) continue;
            const g = lead.s - lead.len - me.s;
            if (g < 0 || g > FRAME) continue;
            stat.gap.push(g);
            if (me.v > 1) stat.headway.push(g / me.v);
          }
        }
      }

      t += dt; steps++;
      if (counting()) stat.seconds += dt;
    }

    const total = warmup + hours * 3600;

    /* ── close the books ──────────────────────────────────────────────
       Everything from here down is the accounting, and it is only ever
       asked for once, at the end. A live world may never ask at all. */
    function finish() {
    const pct = (a, q) => percentile(a.slice().sort((x, y) => x - y), q);

    stat.hours = hours;
    stat.flow = stat.detector / hours;                          // veh/h, all lanes
    stat.flowLane = stat.flow / nLanes;
    /* ── did the road hold its traffic ────────────────────────────────
       The number the on-ramp side was built to make honest. Everything
       that entered the stretch against everything that left it: over the
       boundary plus up the ramps, against past the detector plus down
       the exits. It is NOT forced — the ramps put in a tenth of what
       arrives at the boundary while the exits take a tenth of whatever
       happens to be passing — so a ratio near 1 is a result and not a
       tautology. Anything else means the model is leaking vehicles, and
       every density-dependent statistic below is being taken at a flow
       nobody chose. */
    stat.inflow = stat.spawned + stat.merged;
    stat.outflow = stat.detector + stat.exited;
    stat.conserved = stat.inflow > 0 ? stat.outflow / stat.inflow : 1;
    stat.mergeWaitMed = stat.mergeWait.length
      ? percentile(stat.mergeWait.slice().sort((a, b) => a - b), 0.5) : 0;
    stat.demandLane = qLane;

    /* THE number. Completed-or-committed manoeuvres begun inside the
       zone, over the vehicle-kilometres driven inside it. */
    stat.rate = stat.vehKm > 0 ? stat.changes.length / stat.vehKm : 0;
    stat.rateBy = {};
    for (const k of TR.KINDS) {
      const n = stat.changes.reduce((a, c) => a + (c.kind === k ? 1 : 0), 0);
      stat.rateBy[k] = stat.kmBy[k] > 0 ? n / stat.kmBy[k] : 0;
    }
    stat.leftShare = stat.changes.length
      ? stat.changes.reduce((a, c) => a + (c.dir === "left" ? 1 : 0), 0) / stat.changes.length
      : 0;
    stat.signalled = stat.changes.length
      ? stat.changes.reduce((a, c) => a + (c.signal === "none" ? 0 : 1), 0) / stat.changes.length
      : 0;

    stat.dur = { p15: pct(stat.durations, 0.15), p50: pct(stat.durations, 0.50),
                 p85: pct(stat.durations, 0.85), n: stat.durations.length };
    stat.hw = { p5: pct(stat.headway, 0.05), p15: pct(stat.headway, 0.15),
                p50: pct(stat.headway, 0.50), p85: pct(stat.headway, 0.85),
                p95: pct(stat.headway, 0.95), n: stat.headway.length };
    stat.sp = { p5: pct(stat.gap, 0.05), p15: pct(stat.gap, 0.15),
                p50: pct(stat.gap, 0.50), p85: pct(stat.gap, 0.85),
                p95: pct(stat.gap, 0.95) };

    /* Lane occupancy and the gradient, in the units BEHAVIOUR.md reports
       them in: share of each class's vehicle-seconds by lane, and the
       median speed per lane in mph. */
    stat.lanes = [];
    const clsTotal = {};
    for (const k of TR.KINDS)
      clsTotal[k] = stat.laneSec.reduce((a, L) => a + L[k], 0);
    const allSec = stat.laneSec.reduce((a, L) => a + L.all, 0);
    for (let ln = 1; ln <= nLanes; ln++) {
      const L = stat.laneSec[ln], row = { lane: ln, share: allSec ? L.all / allSec : 0 };
      for (const k of TR.KINDS) row[k] = clsTotal[k] > 0 ? L[k] / clsTotal[k] : 0;
      row.mph = pct(stat.laneSpeed[ln], 0.50) / MPH;
      stat.lanes.push(row);
    }
    stat.gradient = nLanes > 1 ? stat.lanes[0].mph - stat.lanes[nLanes - 1].mph : 0;
    stat.lorryLeft = clsTotal.artic > 0 ? stat.laneSec[1].artic / clsTotal.artic : 0;

    /* ── how far it moved from where it was put ───────────────────────
       Only meaningful when the boundary was seeded: it is the distance
       between the distribution the road was started at and the one it
       is running at by the time it reaches the zone, per class, as an
       RMS of percentage points. Zero means the motives hold the real
       road's shape; anything else is them pushing it somewhere, and the
       sign of each lane says which way. */
    stat.seeded = seeded ? LANE_MIX : null;
    stat.drift = null;
    if (seeded) {
      stat.drift = {};
      for (const k of TR.KINDS) {
        const want = LANE_MIX[k];
        if (!want) continue;
        let sum = 0;
        stat.drift[k + "By"] = stat.lanes.map((row, i) => +(row[k] * 100 - want[i]).toFixed(2));
        for (let i = 0; i < nLanes; i++) {
          const d = stat.lanes[i][k] * 100 - want[i];
          sum += d * d;
        }
        stat.drift[k] = Math.sqrt(sum / nLanes);
      }
    }

    stat.mph = {};
    for (const k of TR.KINDS) stat.mph[k] = {
      p15: pct(stat.speed[k], 0.15) / MPH, p50: pct(stat.speed[k], 0.50) / MPH,
      p85: pct(stat.speed[k], 0.85) / MPH, n: stat.speed[k].length,
    };
    stat.acc = { p5: pct(stat.accel, 0.05), p95: pct(stat.accel, 0.95) };

    stat.mix = {};
    for (const k of TR.KINDS) stat.mix[k] = stat.byKind[k] / Math.max(1, stat.detector);

    /* ── the safety books ────────────────────────────────────────────
       Per million vehicle-kilometres, which is the unit every published
       exposure rate is quoted in, so the model's answer can be put next
       to a real road's without arithmetic in between. `MVK_TARGET` is
       what a US freeway does. */
    const mvk = stat.vehKm / 1e6;
    stat.perMvk = {
      crashes: mvk > 0 ? stat.crashes.length / mvk : 0,
      wrecks: mvk > 0 ? stat.wrecks / mvk : 0,
      contacts: mvk > 0 ? stat.contacts / mvk : 0,
      fatal: mvk > 0 ? stat.hurt.fatal / mvk : 0,
      target: MVK_TARGET,
    };
    /* Per hundred vehicle-km for the surrogates, because they are three
       orders of magnitude more common than the thing they stand in for —
       which is exactly why they are the ones a short run can measure. */
    const hvk = stat.vehKm / 100;
    stat.per100Km = {
      hardBrakes: hvk > 0 ? stat.hardBrakes / hvk : 0,
      conflicts: hvk > 0 ? stat.conflictTTC / hvk : 0,
      glances: hvk > 0 ? stat.glances / hvk : 0,
    };
    stat.ttcP = { p1: pct(stat.ttc, 0.01), p5: pct(stat.ttc, 0.05),
                  p50: pct(stat.ttc, 0.50), n: stat.ttc.length };
    return stat;
    }

    /* `live` and `stat` are handed out by reference on purpose: a caller
       drawing sixty frames a second must not be copying the population
       to look at it. Nothing outside this file may write to them. */
    /* ── the road changes width under the traffic ─────────────────────
       The harness holds the lane count fixed for the length of a run,
       which is honest on six kilometres of chosen motorway and false on
       a corridor. Measured over ONE twenty-mile window at Knoxville: the
       road is three lanes for 58% of it, four for 21% and five for 20%,
       and the first disagreement with whatever the world was built with
       arrives 0.16 miles in.

       What that did was not subtle. A vehicle the model had in lane 4 on
       a stretch that has three lanes was CLAMPED into lane 3 to be
       drawn — on top of whatever was already in lane 3 — while the model
       went on believing the two were a lane apart. Reported from play as
       cars touching, and as being hit by cars that were not there.

       So the count follows the corridor. Vehicles in a lane that has
       just ended are brought in, which is what a lane drop physically
       is; doing it as a proper merge, with gap acceptance and a reason,
       is `lane drop`, and it is still one of §5c's three stubs. This is
       the difference between the road being the wrong shape and the
       traffic being crudely polite about it. */
    function setLanes(n) {
      if (!roam || !(n > 0)) return nLanes;
      n = Math.max(1, Math.min(MAX_LANES, Math.round(n)));
      if (n === nLanes) return nLanes;
      const was = nLanes;
      nLanes = n;
      ctx.lanes = n;
      view.lanes = n;
      if (n < was) {
        for (let i = 0; i < live.length; i++) {
          const v = live[i];
          if (v.lane <= n && v.from <= n && v.to <= n) continue;
          v.lane = Math.min(v.lane, n);
          v.from = v.to = Math.max(1, Math.min(n, Math.round(v.lane)));
          v.phase = 0;
        }
        /* Anything still waiting to be let in at a lane that no longer
           exists is not waiting for anything. */
        for (let ln = n + 1; ln <= was; ln++) {
          if (edgeQ) { edgeQ[0][ln].length = 0; edgeQ[1][ln].length = 0; }
          byLane[ln].length = 0;
        }
      }
      /* The per-lane flow is a share of the corridor's total, so it
         moves whenever the count does rather than at the next
         thirty-second re-read. */
      if (o.q == null) qLane = TR.demand(pxAt(bandS), when, dir) / nLanes;
      kStar = (qLane / 3600) * discount / vHarm;
      return nLanes;
    }

    if (roam) { reference(); fill(); if (roam.settle !== false) settle(); }

    /* ── somebody else's car ──────────────────────────────────────────
       PLAN.md §5c, settled: "The player is not special. The driver is."
       So the player does not get a flag anybody tests for. They get a
       BODY — mass, length, width, a lane and a speed — placed in the
       index like any other, and every motive that reads the road reads
       them without knowing what they are. `yield` fires on a car closing
       from behind at a real speed difference, and whether it fires on
       the player is a question about the driver in front, not about the
       player.

       What is different is only that this file does not drive it. Its
       position comes from the game each tick, and the four places that
       would otherwise write to it — the decide loop, the integrator,
       `collide` and `separate` — all step around `piloted`.

       Contacts involving it are collected rather than acted on, because
       what a crash MEANS to the player is offramp.js's question and it
       already has a much better answer than this file does. */
    let driven = null;
    const hits = [];
    function pilot(p) {
      if (!roam) return null;
      if (!p) {                                    // put the car away
        if (driven) { const k = live.indexOf(driven); if (k >= 0) live.splice(k, 1); }
        driven = null;
        return null;
      }
      let fresh = false;
      if (!driven) {
        const B = BODY.car;
        driven = {
          id: -1, piloted: true, kind: "car",
          len: p.len || 4.7, w: p.w || B.w,
          m: p.m || B.m, mu: B.mu, Iz: izOf(p.m || B.m, p.len || 4.7, p.w || B.w),
          A: IDM.car.A, B: IDM.car.B, s0: IDM.car.s0,
          par: { A: IDM.car.A, B: IDM.car.B, s0: IDM.car.s0, T: 1.2 },
          drv: { want: 40, headway: 1.2, signal: "proper", polite: false,
                 discipline: 0.5, patience: 1, nerve: 1, push: 0.5,
                 length: p.len || 4.7 },
          lane: 1, from: 1, to: 1, phase: 0, dur: 0, why: null,
          s: 0, v: 0, a: 0, vy: 0, changes: 0, missed: 0,
          hV: new Float64Array(HIST), hS: new Float64Array(HIST),
          hL: new Float64Array(HIST), hA: new Float64Array(HIST),
          brake: false, hard: false, latZ: 0, limitAt: 30, exitPx: null,
          look: 0, looked: true, glanceT: 0, lag: 0, att: 1,
        };
        live.push(driven);
        fresh = true;
      }
      driven.s = p.s;
      /* `lane` is fractional so that straddling a line reads as
         straddling one — `index()` puts a body into every lane its width
         overlaps, which is how a player halfway across gets seen by both
         lanes.

         And it is NOT clamped to the carriageway, which is the fix for
         being unable to pass anybody on the left shoulder. Clamped, a
         player out on the shoulder arrived here as exactly lane 1,
         `index()` filed them squarely in lane 1, and lane 1 drove into
         a car that was not on the road. Left alone, `index()`'s width
         test resolves all three cases by itself: off the road overlaps
         nothing, half on overlaps one lane, straddling overlaps two.
         See `laneAt` in cars.js for the other half of this.

         `from` and `to` are array INDICES and have to be whole — handed
         a fractional one, `byLane[2.3]` is undefined and the index
         throws on the first step. They are also the only thing here
         that still needs a range: `byLane` runs 0..MAX_LANES, so an
         out-of-range round would throw. Bucket 0 exists and is never
         iterated, which is exactly the right home for a body that is
         beside the road rather than on it. */
      driven.lane = p.lane;
      driven.from = driven.to =
        Math.max(0, Math.min(nLanes, Math.round(driven.lane)));
      /* Braking is what the vehicles behind actually watch, and the game
         knows whether the player is on the brakes far better than a
         difference of two positions would. */
      driven.brake = !!p.braking;
      /* How fast they are crossing the road, m/s, in the same axis
         `lane` is measured in. Zero for the whole life of the file
         before this, which meant every sideswipe was solved as though
         the player were tracking straight: no lateral closing speed, so
         no lateral impulse, so drifting into somebody's flank cost
         nothing and `separate` simply moved them over. The other half
         of "i can push cars out of the way". */
      driven.vy = p.vy || 0;
      const was = driven.v;
      driven.v = p.v;
      driven.a = dt > 0 ? (driven.v - was) / dt : 0;
      if (driven.hV) { driven.hV.fill(driven.v); driven.hS.fill(driven.s); }

      /* ── you do not materialise inside somebody ─────────────────────
         `fill()` populates the whole band, including the stretch of lane
         the player is about to be put down on, so a run could begin with
         a lorry already overlapping the car — and it did: holding the
         outside lane on rural I-40, the first two minutes ended in a
         rear-end 0.2 miles in, against traffic that had been there
         before the player was.

         So the space is cleared, once, at the moment the body appears —
         which is the start of a run and the moment of rejoining the
         mainline from a ramp. Only vehicles genuinely overlapping go,
         and they go quietly: this is the road being arranged around a
         car that was always meant to be there, not a collision. */
      if (fresh) {
        const half = driven.len / 2 + 2;
        for (let i = live.length - 1; i >= 0; i--) {
          const v = live[i];
          if (v.piloted) continue;
          if (Math.abs(v.lane - driven.lane) * LANE_W >= (v.w + driven.w) / 2) continue;
          const gap = Math.abs((v.s - v.len / 2) - (driven.s - driven.len / 2))
                    - (v.len + driven.len) / 2;
          if (gap < half) live.splice(i, 1);
        }
      }
      return driven;
    }
    function drainHits() {
      if (!hits.length) return null;
      const out = hits.slice();
      hits.length = 0;
      return out;
    }

    return {
      step, finish, live, stat, total, ramps,
      pilot, drainHits, setLanes,
      dt, dir, px0, roadLen, pxAt, roam,
      /* A getter, because the count moves now and a snapshot taken at
         construction would be a lie the moment the road narrowed. */
      get nLanes() { return nLanes; },
      time: () => t,
      band: () => ({ s: bandS, v: bandV, lo: loEdge(), hi: hiEdge() }),
      /* Where the band is and how fast it is going. The speed is taken
         rather than differenced because the caller knows it exactly and
         a difference over one frame of a game is mostly jitter — and it
         is the speed, not the position, that sets how much traffic
         crosses each edge. */
      /* `v` is SIGNED, and the sign is load-bearing rather than tidy.
         A band travelling against the traffic — which is what the
         oncoming carriageway is, seen from a car on the other one — has
         vehicles streaming in over its TRAILING edge at the sum of the
         two speeds, not over its leading edge at the difference. Clamped
         to zero here once, the oncoming road was supplied at the wrong
         end and at half the rate: the 900 m behind the band ran empty
         while everything piled in from in front. */
      follow(s, v) {
        if (!roam) return;
        if (v == null) v = (s - bandS) / Math.max(1e-6, dt);
        bandS = s; bandV = v;
      },
      advance(until) { while (t < until) step(); },
    };
  }

  /* The harness, unchanged: build the world, step it to the end, and
     close the books. */
  function run(opts) {
    const w = world(opts);
    w.advance(w.total);
    return w.finish();
  }

  return {
    run, world, deciders, percentile,
    idm, latAccel, durationOf, lateral, tolerable,
    IDM, LAT, LANE_W, M_PER_PX, MPH, B_SAFE, FRAME, T_SCALE, zOf,
    BODY, izOf,
    TRACK, GLANCE, GLANCE_BASE, BRAKE_PRIMED, ANTICIPATE, SIGHT, HIST,
    WRECK_DECEL, CLEAR, MVK_TARGET, TTC_CONFLICT, HARD_BRAKE,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Sim;
