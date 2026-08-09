/* ══════════════════════════════════════════════════════════════════════
   IMPACT.

   One solver, and the curves that turn its answer into an outcome.

   ── why this file exists at all ─────────────────────────────────────
   What it replaces was four bespoke tests with four hand-tuned
   thresholds: one for the median, one for soft ground, one for the
   fence, one for the nose of a gore. Each was fitted against feel on
   its own, so they did not agree with each other, and there was no way
   to add a fifth. Traffic needs a fifth — car into car — and then a
   sixth, car into car into barrier, and nobody can tune that.

   So the four cases are one case. They differ only in what the other
   thing weighs, how stiff it is, and how much it gives back:

     concrete median      infinite mass, rigid,             ε ~0.10
     impact attenuator    infinite mass, 6 m of crush,      ε  0
     right-of-way fence   40 kg of post and wire,           ε  0.05
     another car          comparable, and it moves,         ε  0.05–0.30
     a loaded truck       twenty-four times yours, rigid,   ε ~0.10

   A barrier is the case where the other mass is infinite. That is the
   whole trick, and `1/Infinity === 0` means it needs no branch.

   ── the rule this file is written under ─────────────────────────────
   Realism beats interest. If the accurate answer is boring, the boring
   answer ships. The low end of every curve here goes to ZERO, not to
   "a small chance" — two wheels onto the grass at 40 mph costs speed
   and dignity and nothing else, because that is what it costs in life.
   Most contact is nothing, a little of it is fatal, and there is not
   much in between. That gap is real and it is not compressed here.

   ── units ───────────────────────────────────────────────────────────
   THIS FILE IS PURE SI. Metres, m/s, kilograms, newton-seconds,
   radians. It never sees a world pixel and it never sees km/h — except
   where a function is explicitly documented as taking km/h, which is
   the injury curves and the rollover curve, because every published
   figure they are fitted against is quoted that way.

   The impulse-momentum equations have mass in them, and a mass has no
   meaning in a unit system whose length is a screen pixel. offramp.js
   converts on the way in and on the way out; nothing converts in here.

   ── and it has no dependencies ──────────────────────────────────────
   No DOM, no globals, no Road, no World, no Draw, no S. Numbers in,
   numbers out, so it can be checked directly against published crash
   figures rather than against how the game feels. See test/impact.test.js.
   ══════════════════════════════════════════════════════════════════════ */

const Impact = (() => {
  "use strict";

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const cross = (p, q) => p.x * q.y - p.y * q.x;
  const G = 9.81;

  /* ══════════════════════════════════════════════════════════════════
     restitution

     How much of the closing speed comes back. Strongly speed-dependent
     and that dependence is the point: cars bounce at parking speed and
     crush at highway speed, because at highway speed the structure has
     gone plastic and there is nothing left to spring back.

       0 (parking)   0.35
       11 km/h       0.26
       36 km/h       0.14
       100 km/h      0.06

     An empirical shape fitted to that behaviour, not a law. The
     constants are tunable; the behaviour is not.
     ══════════════════════════════════════════════════════════════════ */
  const restitution = (vClosing) => 0.05 + 0.30 * Math.exp(-vClosing / 8);

  /* ══════════════════════════════════════════════════════════════════
     the solver — planar impulse-momentum with Coulomb friction

     This is the standard tool of crash reconstruction. It is not an
     approximation invented for this game, which is why its answers can
     be checked against published ones.

     A body:
       { m,   kg — Infinity for anything bolted to the earth
         Iz,  kg·m² — Infinity likewise
         v,   {x,y} velocity of the centre of gravity, m/s, world frame
         w,   yaw rate, rad/s, positive counter-clockwise
         r }  {x,y} from the CG to the contact point, m, world frame

     A contact:
       { n,      {x,y} unit normal, pointing from b toward a
         mu,     friction at the contact patch
         eps }   restitution override, or undefined for the curve above

     Returns null when the bodies are separating. That test is not
     optional — without it bodies stick together, which is the classic
     way to get this wrong.
     ══════════════════════════════════════════════════════════════════ */
  function solve(a, b, contact) {
    const n = contact.n;
    const t = { x: -n.y, y: n.x };

    // velocity at the contact point: v + ω × r
    const ua = { x: a.v.x - a.w * a.r.y, y: a.v.y + a.w * a.r.x };
    const ub = { x: b.v.x - b.w * b.r.y, y: b.v.y + b.w * b.r.x };
    const rel = { x: ua.x - ub.x, y: ua.y - ub.y };

    const vn = rel.x * n.x + rel.y * n.y;
    if (vn >= 0) return null;            // separating. no impulse, no damage.
    const vClosing = -vn;

    /* Effective masses. With m = Infinity the reciprocal is 0 and this
       is already right — do NOT write a branch for the barrier. */
    const ran = cross(a.r, n), rbn = cross(b.r, n);
    const rat = cross(a.r, t), rbt = cross(b.r, t);
    const kn = 1 / a.m + 1 / b.m + ran * ran / a.Iz + rbn * rbn / b.Iz;
    const kt = 1 / a.m + 1 / b.m + rat * rat / a.Iz + rbt * rbt / b.Iz;

    const eps = contact.eps !== undefined && contact.eps !== null
      ? contact.eps : restitution(vClosing);
    const jn = (1 + eps) * vClosing / kn;

    /* The tangential impulse is what makes a shallow barrier hit behave.
       Sliding along a wall the tangential velocity is the whole road
       speed and can never be arrested, so this saturates at the friction
       limit — which is how road speed enters the model. Not through a
       multiplication: through a fast car dragging along concrete under a
       friction impulse for as long as the contact lasts. */
    const vt = rel.x * t.x + rel.y * t.y;
    const jtFull = -vt / kt;
    const mu = contact.mu ?? 0;
    const jt = clamp(jtFull, -mu * jn, mu * jn);

    const J = { x: jn * n.x + jt * t.x, y: jn * n.y + jt * t.y };
    const mag = Math.hypot(J.x, J.y);

    return {
      J, jn, jt, eps, vClosing,
      va: { x: a.v.x + J.x / a.m, y: a.v.y + J.y / a.m },
      vb: { x: b.v.x - J.x / b.m, y: b.v.y - J.y / b.m },
      wa: a.w + cross(a.r, J) / a.Iz,
      wb: b.w - cross(b.r, J) / b.Iz,
      /* delta-v: the change in the centre-of-gravity velocity, which is
         exactly what crash reconstruction means by the word and exactly
         what every injury correlation below is written against. */
      dvA: mag / a.m,
      dvB: mag / b.m,
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     which way the blow landed

     The same delta-v is roughly twice as injurious side-on as frontal,
     because there is no crush zone between a door and the person behind
     it. This one fact will shape the entire traffic game.

     `angleDeg` is the direction the blow ARRIVES from, measured in the
     car's frame: 0° straight into the nose, 90° into the driver's door,
     180° into the tail. Given an impulse J applied to the car, that is
     the bearing of −J relative to the car's forward axis — a frontal
     hit pushes the car backwards, so the force points at the tail and
     the blow came from the nose.
     ══════════════════════════════════════════════════════════════════ */
  function directionFactor(angleDeg) {
    const a = Math.abs(((angleDeg + 180) % 360 + 360) % 360 - 180);   // 0..180
    if (a <= 30) return 1.00;                              // frontal
    if (a <= 60) return 1.00 + 0.80 * (a - 30) / 30;       // oblique  1.00→1.80
    if (a <= 120) return 1.80;                             // side
    if (a <= 150) return 1.80 - 1.10 * (a - 120) / 30;     // oblique rear 1.80→0.70
    return 0.70;                                           // rear
  }

  /* Bearing of the blow, in degrees, given the impulse on the car and
     the car's forward unit vector. Both in the same (world) frame. */
  function blowAngle(J, fwd) {
    const f = { x: -J.x, y: -J.y };
    const along = f.x * fwd.x + f.y * fwd.y;
    const across = f.x * -fwd.y + f.y * fwd.x;
    return Math.atan2(across, along) * 180 / Math.PI;
  }

  const effectiveDv = (dv, angleDeg) => dv * directionFactor(angleDeg);

  /* ══════════════════════════════════════════════════════════════════
     ride-down

     The injury curves below are fitted to car-into-car and car-into-
     barrier crashes, where the whole delta-v arrives inside about a
     tenth of a second and the pulse is brutal. Stretch the same
     delta-v over six metres of crushable barrels and it is a different
     event: this is the entire reason an impact attenuator is bought.

     So the credit is the ratio of the actual deceleration to what that
     same delta-v does in a standard crash pulse. An ordinary impact IS
     the standard pulse, so it scores 1.0 and nothing changes — which is
     why this is applied to every impact rather than special-cased onto
     the attenuator. Special-casing it is how the model stops being
     general, and general is the entire point of this file.

     CONTACT_T is the crush phase of a normal impact. T_REF is the
     reference pulse the injury curves were fitted against; it is
     slightly the longer of the two, so an ordinary impact clamps to
     exactly 1.0 with a little room rather than landing on the boundary.

     A note on the constant, because the spec quotes it the other way
     round: a "hard car-to-car frontal at ~25 g" is a delta-v of
     110 km/h over T_REF — 30.56 / 0.125 = 244 m/s² = 24.9 g. Same
     number, stated as a duration so that the ordinary case falls out
     at 1.0 by construction instead of by coincidence.
     ══════════════════════════════════════════════════════════════════ */
  const CONTACT_T = 0.10;                 // s, crush phase of a normal impact
  const T_REF = 0.125;                    // s, the pulse the curves are fitted to
  const RIDEDOWN_REF_G = 25;              // the same figure, as the spec quotes it

  function rideDownFactor(gMean, dv) {
    if (!(dv > 0)) return 1;
    const gRef = dv / T_REF / G;          // g this delta-v does in a normal pulse
    return clamp(Math.sqrt(gMean / gRef), 0.25, 1.0);
  }

  /* ══════════════════════════════════════════════════════════════════
     delta-v to outcome

     Two logistic curves on EFFECTIVE delta-v in km/h. Fitted to the
     belted-adult-in-a-modern-car anchors: serious injury climbing
     steeply above about 40, roughly half fatal at 65.

       Δv_eff   P(fatal)  P(disabling)
         20       0.5%        5.0%
         30       1.6%       14.6%
         40       5.0%       35.7%
         50      14.6%       64.3%
         65      50.0%       91.4%
         80      85.4%       98.4%
        100      98.4%       99.8%

     `pDisabling` is CUMULATIVE — the chance of at least a disabling
     result — so it is always ≥ pFatal, and one uniform roll resolves
     both. Rolling twice produces fatal-but-not-disabling, which is
     nonsense, and is the obvious way to get this wrong.
     ══════════════════════════════════════════════════════════════════ */
  const pFatal = (d) => 1 / (1 + Math.exp(-0.118 * (d - 65)));
  const pDisabling = (d) => 1 / (1 + Math.exp(-0.118 * (d - 45)));

  /* Below this there is nothing to roll for. The logistic curves have a
     left tail that never quite reaches zero — at 6 km/h of effective
     delta-v they still return about one chance in a hundred of a
     disabling injury — and a car that occasionally kills its driver by
     scraping paint off a wall at walking pace is not realism, it is a
     curve being read outside the range it was fitted over. The
     governing rule says the low end of every risk curve goes to ZERO,
     not to "a small chance", and this is where that is enforced. */
  const SUPERFICIAL = 12;                 // km/h of effective delta-v

  /* One roll, compared against cumulative thresholds. `roll` is
     injectable so the tests are not at the mercy of Math.random. */
  function outcome(dvEff, roll) {
    if (dvEff <= SUPERFICIAL) return "superficial";
    const r = roll === undefined ? Math.random() : roll;
    if (r < pFatal(dvEff)) return "fatal";
    if (r < pDisabling(dvEff)) return "disabling";
    return "damage";
  }

  /* ══════════════════════════════════════════════════════════════════
     the attenuator is a crush stroke, not a rating

     "Rated at 110 km/h" is a TEST SPEED, not a survivability limit.
     What decides the outcome is the deceleration over the crush length,
     and a full-size highway unit has six metres of it.

     Under about 175 km/h the stroke swallows the whole approach speed.
     Above it the car runs out of barrels and reaches the rigid backing
     still moving, and that residual is a second, much worse impact —
     which is what the caller then puts through the solver.
     ══════════════════════════════════════════════════════════════════ */
  const ATTEN_STROKE = 6.0;               // m
  const ATTEN_A_MAX = 20 * G;             // 196 m/s², what the barrels can hold

  function crushStop(v, stroke = ATTEN_STROKE) {
    const vOut = Math.sqrt(Math.max(0, v * v - 2 * ATTEN_A_MAX * stroke));
    const dv = v - vOut;
    const aMean = Math.min(ATTEN_A_MAX, (v * v) / (2 * stroke));
    // 2·stroke/(v_in+v_out) is the time to traverse the stroke at mean speed
    const dur = (v + vOut) > 0 ? 2 * stroke / (v + vOut) : CONTACT_T;
    return {
      vOut, dv, aMean, gMean: aMean / G, gPeak: aMean / G * 1.6, duration: dur,
      exhausted: vOut > 0,
    };
  }

  /* ══════════════════════════════════════════════════════════════════
     soft ground is not a collision

     Leaving the road is a friction and moment problem, and it is
     genuinely stochastic. Two identical cars leaving at the same speed
     and angle do not have the same outcome, and what differs is whether
     that particular wheel found a rut, a drain, a soft patch or a
     stone. That is unknowable, so a probability is the honest model and
     a threshold is not.

     ── the floor is physical, and it is the important part ───────────
     To roll, the centre of gravity has to be lifted over the outside
     tyre. Half track 0.75 m, CG height 0.55 m, so the lift is
     √(t²+h²) − h = 0.380 m, and at 35% trip efficiency that needs
     4.62 m/s — 16.6 km/h — of lateral velocity.

     BELOW THAT A CAR CANNOT BE TRIPPED. Ever. Not rarely: never. It is
     an energy balance, not a tuning choice, and it is what makes a
     low-speed excursion into the grass the guaranteed non-event it is
     in life.
     ══════════════════════════════════════════════════════════════════ */
  const HALF_TRACK = 0.75;                // m
  const CG_HEIGHT = 0.55;                 // m
  const TRIP_EFF = 0.35;                  // fraction of lateral KE that goes into roll
  const SSF = HALF_TRACK / CG_HEIGHT;     // 1.36. A sedan; an SUV is ~1.1.
  const LIFT = Math.hypot(HALF_TRACK, CG_HEIGHT) - CG_HEIGHT;          // 0.380 m
  const V_CRIT = Math.sqrt(2 * G * LIFT / TRIP_EFF) * 3.6;             // 16.62 km/h

  /* Ground factors. An ordinary verge is 1.0 by definition. */
  const SOIL = { packed: 0.70, verge: 1.00, soft: 1.30, slope: 1.55 };

  /* Quadratic, because the criterion is an energy one.

       ≤16.6 km/h   0%          29    29.9%
        20          2.2%        35    65.9%
        25         13.7%       ≥40    85% (capped) */
  function rolloverRisk(vLat, soil = 1.0) {
    const v = Math.abs(vLat);
    if (v <= V_CRIT) return 0;
    const x = (v - V_CRIT) / V_CRIT;
    return Math.min(0.85, 0.538 * x * x * soil);
  }

  /* ── forward speed does not decide WHETHER, it decides HOW BAD ──────
     Rollover initiation is a lateral phenomenon and is very nearly
     independent of forward speed. What forward speed decides is how
     many times the car goes over, and that is what decides the outcome.
     Scoring the trip on a speed-weighted product — which is what this
     replaces — gets this backwards at both ends. */
  const quarterTurns = (vFwd) => Math.max(1, Math.round(0.9 * (vFwd / 100) ** 2));
  const rollDv = (turns) => 28 + 9 * turns;      // equivalent Δv_eff, km/h

  /* ══════════════════════════════════════════════════════════════════
     the vehicles

     Iz for a body of other dimensions is ≈ 0.8·m·(L²+W²)/12; the 0.8 is
     a car's mass being more centrally concentrated than a uniform slab.
     For the player's 4.65 × 1.97 m that gives 2550, and measured sedans
     come in at 2000–2500, so 2200 is used directly.
     ══════════════════════════════════════════════════════════════════ */
  const CAR_MASS = 1500, CAR_IZ = 2200;

  const BODIES = {
    car:      { m: 1500, Iz: 2200, mu: 0.55 },
    suv:      { m: 2270, Iz: 3400, mu: 0.55 },
    semi:     { m: 36000, Iz: 900000, mu: 0.55 },
    fence:    { m: 40, Iz: 60, mu: 0.60, eps: 0.05 },
    /* Infinite mass, and no branch anywhere that says so.

       `epsMax` is the one place the specification argues with itself.
       §4.3 says to clamp concrete's restitution to 0.10; §11.2's four
       verification rows, §8's headline result and §11.4's behavioural
       check were all computed WITHOUT that clamp, and they are the
       numbers the model is supposed to reproduce — a full-lock hit from
       the next lane over at 220 mph reads 11% fatal uncapped and 7%
       capped. The verification is the stated gate, so it wins, and the
       clamp is left here as one edit rather than removed: set this to
       0.10 and §4.3 is satisfied at the cost of every worked example.

       The physical difference is small and it only shows up at low
       closing speed. The curve gives 0.20 at a 20 km/h nudge against a
       Jersey barrier, which is defensible; so is 0.10. It is a genuine
       toss-up, so the tie goes to the numbers that were written down. */
    concrete: { m: Infinity, Iz: Infinity, mu: 0.40, epsMax: null },
    barrels:  { m: Infinity, Iz: Infinity, mu: 0.30, eps: 0 },
    backing:  { m: Infinity, Iz: Infinity, mu: 0.40, epsMax: null },
  };

  const fixed = (r) => ({ m: Infinity, Iz: Infinity, v: { x: 0, y: 0 }, w: 0, r: r || { x: 0, y: 0 } });

  return {
    solve, restitution,
    directionFactor, blowAngle, effectiveDv,
    rideDownFactor, CONTACT_T, T_REF, RIDEDOWN_REF_G,
    pFatal, pDisabling, outcome, SUPERFICIAL,
    crushStop, ATTEN_STROKE, ATTEN_A_MAX,
    rolloverRisk, quarterTurns, rollDv,
    V_CRIT, SSF, LIFT, SOIL,
    CAR_MASS, CAR_IZ, BODIES, fixed,
    clamp, cross, G,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Impact;
