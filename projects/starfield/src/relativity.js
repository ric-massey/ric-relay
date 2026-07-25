/* ══════════════════════════════════════════════════════════════════════
   relativity.js — the engine, and everything that follows from it.

   The ship is a relativistic rocket. The throttle is *proper acceleration*
   measured in g, felt in the ship, and holding it runs these equations:

     β = tanh(aτ/c)          γ = cosh(aτ/c)
     d = (c²/a)·(cosh(aτ/c) − 1)      distance in the home frame
     t = (c/a)·sinh(aτ/c)             time in the home frame

   We integrate instead of evaluating those closed forms, because the
   throttle changes. The closed forms are still here — `burn()` — because
   they are what the milestone table is made of.

   The ship has thrusters on all three axes, so the integrated state is the
   proper-velocity *vector* u = γβ rather than a scalar rapidity; see the
   block above `properStep`. For a burn straight down the nose the two are
   the same equation, u = sinh η.

   Everything else in this file is the *consequence* of moving that fast:
   aberration crushes the sky into a cone ahead, Doppler paints a ring of
   true colour, beaming multiplies brightness by D⁴, and the cosmic
   microwave background heats up until it is as bright as the Sun.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;

  // The one speed this game exists to say you cannot reach. β is clamped
  // here for anything that has to *report* a speed, because past twelve
  // nines a double cannot tell 0.999… from 1 anyway.
  const BETA_MAX = 0.999999999999;

  // The ceiling on proper velocity is a different number for a different
  // reason, and conflating the two nearly broke the distance ladder. β
  // saturates at twelve nines, but u = γβ keeps climbing long after, and it
  // has to: the last milestone is the edge of the observable universe at
  // 46.5 Gly, which a 1 g ship reaches in 24.5 years of its own time at
  // γ ≈ 4.8×10¹⁰. Clamping u at the β ceiling (γ ≈ 7×10⁵) would have made
  // the top of the ladder physically unreachable while looking correct.
  // This is set far above anything the game can actually reach, purely so
  // that sinh() cannot hand the rest of the engine an Infinity.
  const U_MAX = 1e12;
  const clampU = (m) => (m > U_MAX ? U_MAX : m);

  const R = SF.rel = {
    /** dη for a burn of `a` gravities over `dTau` ship-years. */
    rapidityStep(aGravities, dTauYears) {
      // dη/dτ = a/c, and c/g = 0.9687 years, so a[g]/c = a/0.9687 per year.
      return aGravities * dTauYears / K.gYears;
    },

    beta(eta) { return Math.tanh(eta); },
    gamma(eta) { return Math.cosh(eta); },
    rapidityFromBeta(beta) { return Math.atanh(Math.max(-BETA_MAX, Math.min(BETA_MAX, beta))); },
    rapidityFromGamma(gamma) { return Math.acosh(Math.max(1, gamma)); },

    /* ── flying in three dimensions ─────────────────────────────────────
       A scalar rapidity is only enough while the thrust is a scalar too.
       The ship has thrusters on every axis now, so the state is the proper
       velocity — the spatial part of the four-velocity,

         u = γβ                γ = √(1 + u²)      β = u / √(1 + u²)

       — and the engine integrates that vector directly. Boosting the proper
       acceleration (0, a) out of the instantaneous rest frame gives

         du/dτ = γ·a∥ + a⊥          (∥ and ⊥ taken relative to u)

       which is the whole flight model in one line. Everything the old scalar
       code special-cased falls out of it:

         · a pure forward burn has u = sinh η, so du/dτ = cosh η·a = γa,
           which is exactly dη/dτ = a — the 1 g rocket is unchanged.
         · a pure sideways burn turns the velocity at |a⊥|/|u| = a/(γβ).
           That transverse suppression — the reason you cannot swerve at
           relativistic speed — is now a *consequence* of the integrator
           rather than a separate hand-applied term.
         · at rest u = 0, γ = 1 and the ∥/⊥ split stops mattering, so
           du/dτ = a with no singularity. The old code needed a max(0.08, β)
           floor to dodge a division by zero that no longer exists.

       u is unbounded as β → 1, so it is capped at the same ceiling rapidity
       uses; β can approach c and never reach it.                         */

    /**
     * Gravity, and why it does not go through properStep.
     *
     * PROPER ACCELERATION IS WHAT YOU FEEL. An accelerometer bolted to the
     * hull reads the engines and nothing else: in free fall it reads zero,
     * however hard you are falling. That is the equivalence principle, and it
     * means gravity cannot be added to the thrust vector — doing so would
     * make the throttle gauge climb as you fell toward a star, let gravity
     * add rapidity as though it were a burn, and have a ship in orbit
     * reporting a permanent 0.06 g it should not feel.
     *
     * So gravity enters where it belongs: as a plain coordinate acceleration
     * in the home frame, changing the home-frame velocity v = u/γ directly
     * over home-frame time dt = γ·dτ. Weak-field general relativity reduces
     * to exactly this, which is as honest as a flat-spacetime engine can be
     * without integrating geodesics.
     *
     * Takes ship time and derives the home-frame interval itself, so no
     * caller can hand it a γ from before the thrust step.
     */
    gravityStep(u, gGravities, dTauYears) {
      const gMag = Math.hypot(gGravities.x, gGravities.y, gGravities.z);
      if (!(gMag > 0) || !(dTauYears > 0)) return { x: u.x, y: u.y, z: u.z };

      const uMag = Math.hypot(u.x, u.y, u.z);
      const gamma = Math.sqrt(1 + uMag * uMag);
      const k = gamma * dTauYears / K.gYears;   // gravities → Δβ, as with thrust
      let vx = u.x / gamma + gGravities.x * k;
      let vy = u.y / gamma + gGravities.y * k;
      let vz = u.z / gamma + gGravities.z * k;

      // A large step under a fierce pull could push v past c, which is a
      // failure of the integrator rather than of physics. Clamp and carry on.
      const vMag = Math.hypot(vx, vy, vz);
      if (vMag >= BETA_MAX) {
        const s = BETA_MAX / vMag;
        vx *= s; vy *= s; vz *= s;
      }
      const v2 = vx * vx + vy * vy + vz * vz;
      const g2 = 1 / Math.sqrt(Math.max(1e-30, 1 - v2));
      return { x: vx * g2, y: vy * g2, z: vz * g2 };
    },

    /** Proper velocity from β, and back. */
    properFromBeta(beta) { return beta / Math.sqrt(Math.max(1e-30, 1 - beta * beta)); },
    betaFromProper(uMag) { return uMag / Math.sqrt(1 + uMag * uMag); },
    gammaFromProper(uMag) { return Math.sqrt(1 + uMag * uMag); },
    properMax() { return U_MAX; },

    /**
     * Advance the proper-velocity vector `u` under a proper acceleration
     * `a` (a world-frame vector, in gravities) for `dTauYears` of ship time.
     * Returns a new vector; does not mutate.
     *
     * SPLIT INTO SPEED AND DIRECTION, rather than integrated as one vector,
     * and the reason is accuracy where the game can least afford to lose it.
     * du/dτ = γa∥ + a⊥ is correct but stiff: u grows exponentially under a
     * sustained burn, so stepping it with plain Euler *undershoots*, and by
     * τ = 12.3 years of 1 g it had lost 0.4% of γ. Every headline number in
     * this game is a closed form — 7.4 years to the CMB fire, 12.3 to leave
     * the galaxy — and a drifting integrator quietly makes the ledger lie.
     *
     * So the two components are advanced the way each is exactly solvable:
     *
     *   along u   rapidity is *additive*, η → η + a∥·dτ/c, which is exact
     *             for a constant burn no matter how coarse the step. This is
     *             what the old scalar engine did, preserved bit-for-bit.
     *   across u  the direction rotates at dθ/dτ = a⊥/(γβ) = a⊥/|u|, applied
     *             about the midpoint speed so a curving burn stays second
     *             order rather than first.
     *
     * A pure forward burn is therefore exact, a pure sideways burn turns at
     * exactly the suppressed rate, and only a sustained diagonal burn takes
     * a split-step approximation — which is both small and self-correcting,
     * because the two operators commute in the limit.
     */
    properStep(u, a, dTauYears) {
      // dη/dτ = a/c with c/g = K.gYears years, so a[g] becomes a/K.gYears
      // per ship-year in units of c — the same conversion rapidityStep uses.
      const s = dTauYears / K.gYears;
      const uMag = Math.hypot(u.x, u.y, u.z);
      const aMag = Math.hypot(a.x, a.y, a.z);
      if (aMag < 1e-15) return { x: u.x, y: u.y, z: u.z };

      // From rest there is no direction to be parallel *to*, so the whole
      // burn is longitudinal along its own axis — and exact.
      if (uMag < 1e-12) {
        const m = clampU(Math.sinh(aMag * s));
        return { x: a.x / aMag * m, y: a.y / aMag * m, z: a.z / aMag * m };
      }

      let ix = u.x / uMag, iy = u.y / uMag, iz = u.z / uMag;
      const aPar = a.x * ix + a.y * iy + a.z * iz;

      // The transverse component, taken against the *current* heading and
      // before any reversal below — a⊥ is a property of a and the axis, so
      // it must not be recomputed from a direction that has since flipped.
      const px = a.x - ix * aPar, py = a.y - iy * aPar, pz = a.z - iz * aPar;
      const pMag = Math.hypot(px, py, pz);

      // Longitudinal: exact, via rapidity.
      let eta = Math.asinh(uMag) + aPar * s;
      if (eta < 0) {
        // Burned through zero — you are now going the other way.
        eta = -eta;
        ix = -ix; iy = -iy; iz = -iz;
      }
      const newMag = Math.sinh(eta);

      // Transverse: ADD THE IMPULSE, DO NOT ROTATE BY AN ANGLE. The exact
      // relation already says du⊥/dτ = a⊥, so the sideways part of u simply
      // grows by a⊥·dτ and the new heading falls out of the vector sum.
      //
      // Rotating instead — by θ = a⊥·dτ/|u|, which is the same thing to first
      // order — reintroduces the singularity this integrator was supposed to
      // have removed. As |u| → 0 that angle diverges, and with the clamp it
      // pinned at π: a nearly stationary ship spun its velocity through half a
      // turn every frame, so a full 1 g burn accumulated no speed at all.
      // Sitting at the throttle for 1.6 ship-years left β at 9×10⁻⁵.
      //
      // The vector form is correct in both regimes and singular in neither:
      // at rest it is plain addition, at speed the heading turns by exactly
      // a⊥/(γβ) because that is what adding a small perpendicular vector to a
      // long one does.
      let nx = ix * newMag, ny = iy * newMag, nz = iz * newMag;
      if (pMag > 1e-15) {
        nx += px * s; ny += py * s; nz += pz * s;
      }

      const mag = Math.hypot(nx, ny, nz);
      if (mag < 1e-30) return { x: 0, y: 0, z: 0 };
      const m = clampU(mag);
      return { x: nx / mag * m, y: ny / mag * m, z: nz / mag * m };
    },

    /**
     * Closed-form 1 g-style burn from rest. `aGravities` proper acceleration
     * held for `tauYears` of ship time. This is the table in §6 of the plan:
     * 7.4 years to the CMB fire, 12.3 to leave the galaxy, 24.5 to the edge
     * of the observable universe.
     */
    burn(aGravities, tauYears) {
      const eta = R.rapidityStep(aGravities, tauYears);
      const scaleLy = K.gYears / aGravities;   // c²/a in light-years
      return {
        eta,
        beta: Math.tanh(eta),
        gamma: Math.cosh(eta),
        distanceLy: scaleLy * (Math.cosh(eta) - 1),
        homeYears: scaleLy * Math.sinh(eta),
        shipYears: tauYears,
      };
    },

    /**
     * Relativistic aberration. `cosTheta` is measured in the frame where the
     * source sits still, from the direction of motion; the return value is
     * where you actually see it.
     *
     *   cos θ' = (cos θ + β) / (1 + β cos θ)
     *
     * A star dead abeam at rest (θ = 90°) appears at arccos β — at β = 0.999
     * that is 2.6°, so half the sky is squeezed into a spot ahead of you.
     */
    aberrate(cosTheta, beta) {
      return (cosTheta + beta) / (1 + beta * cosTheta);
    },

    /** Inverse of `aberrate`: apparent direction back to rest-frame direction. */
    unaberrate(cosThetaApparent, beta) {
      return (cosThetaApparent - beta) / (1 - beta * cosThetaApparent);
    },

    /**
     * How much a small angular size is magnified or squashed by aberration,
     * d(cos θ')/d(cos θ) = (1 − β²) / (1 + β cos θ)². Ahead of you this goes
     * to (1−β)/(1+β) — objects in front are demagnified as the sky piles in.
     */
    aberrationJacobian(cosTheta, beta) {
      const d = 1 + beta * cosTheta;
      return (1 - beta * beta) / (d * d);
    },

    /**
     * Doppler factor for something seen at apparent angle θ'.
     *
     *   D = 1 / (γ(1 − β cos θ'))
     *
     * Ahead: D = γ(1+β) ≈ 2γ. Behind: D = γ(1−β) ≈ 1/2γ.
     */
    doppler(cosThetaApparent, beta, gamma) {
      return 1 / (gamma * R.oneMinusBetaCos(cosThetaApparent, beta, gamma));
    },

    /**
     * (1 − β cos θ′), COMPUTED SO IT SURVIVES β = 1 IN DOUBLE PRECISION.
     *
     * Written directly it is the classic catastrophic cancellation: past
     * γ ≈ 10⁸, β rounds to exactly 1.0, so (1 − β·1) evaluates to 0 and the
     * Doppler factor comes back Infinity — which is how "Heat ahead" managed
     * to print an em-dash in the top gear. Split it instead:
     *
     *   1 − β cos = (1 − β) + β(1 − cos)
     *   1 − β     = 1 / (γ²(1 + β))        exactly, from γ²(1−β²) = 1
     *   1 − cos   = sin²/(1 + cos)          no cancellation near cos = 1
     *
     * Every term on the right stays well away from zero, so the result is
     * accurate at any γ the drive can produce.
     */
    oneMinusBetaCos(cosThetaApparent, beta, gamma) {
      const cos = Math.max(-1, Math.min(1, cosThetaApparent));
      const oneMinusBeta = 1 / (gamma * gamma * (1 + beta));
      const sin2 = Math.max(0, 1 - cos * cos);
      const oneMinusCos = cos > 0 ? sin2 / (1 + cos) : 1 - cos;
      return oneMinusBeta + beta * oneMinusCos;
    },

    /**
     * The starbow. Where D = 1 the sky keeps its true colour, and that ring
     * tightens toward the flight path as you accelerate:
     *
     *   cos θ'_ring = (1 − 1/γ) / β
     *
     * β = 0.90 → 51°, β = 0.99 → 30°, β = 0.999 → 17°.
     * Returns the half-angle in radians, or null below the useful range.
     */
    starbowAngle(beta, gamma) {
      if (beta <= 1e-6) return null;
      const cosRing = (1 - 1 / gamma) / beta;
      if (cosRing >= 1 || cosRing <= -1) return null;
      return Math.acos(cosRing);
    },

    /**
     * The cosmic microwave background, boosted. It stays a blackbody — that
     * is the remarkable part — just a hotter one, at T' = D·T_CMB.
     * Dead ahead D ≈ 2γ, so:
     *     γ = 100    →   545 K, a dull infrared smudge
     *     γ = 1,059  → 5,772 K, as hot as the surface of the Sun
     *     γ = 10,000 → 54,500 K, hotter than an O star
     * At one gravity the Sun-temperature threshold arrives at τ = 7.4 years.
     */
    cmbTemperature(cosThetaApparent, beta, gamma) {
      return K.tCMB * R.doppler(cosThetaApparent, beta, gamma);
    },

    /** γ at which the forward CMB reaches a given temperature. D_ahead = γ(1+β) ≈ 2γ. */
    gammaForForwardCMB(targetK) {
      return targetK / (2 * K.tCMB);
    },

    /**
     * The other wall: the interstellar medium, arriving as a beam.
     * Each proton carries (γ − 1)·938.27 MeV in the ship's frame — at
     * γ = 7,000 that is 6.5 TeV, an LHC beam, continuously.
     */
    protonEnergyMeV(gamma) {
      return (gamma - 1) * K.protonMeV;
    },

    /**
     * Radiated power hitting a square metre of hull, in watts.
     * flux = n·βc  particles/m²/s, each carrying (γ−1)m_p c².
     * n arrives in atoms/cm³, so ×1e6 for m⁻³.
     */
    ismPowerPerM2(densityPerCm3, beta, gamma) {
      const n = densityPerCm3 * 1e6;
      const joulesPerProton = R.protonEnergyMeV(gamma) * 1e6 * 1.602176634e-19;
      return n * beta * K.c * joulesPerProton;
    },

    /**
     * Length contraction. The road ahead physically shortens by 1/γ in your
     * frame: at γ = 87 the 4.24 light-years to Proxima are 0.049 of *your*
     * light-years. This is why the game stores the world contracted — it is
     * also the only reason a flight at γ = 10⁶ is renderable at all.
     */
    contract(properLength, gamma) {
      return properLength / gamma;
    },
  };
})();
