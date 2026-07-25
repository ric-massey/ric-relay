/* ══════════════════════════════════════════════════════════════════════
   relativity.js — the engine, and everything that follows from it.

   The ship is a relativistic rocket. The throttle is *proper acceleration*
   measured in g, felt in the ship, and holding it runs these equations:

     β = tanh(aτ/c)          γ = cosh(aτ/c)
     d = (c²/a)·(cosh(aτ/c) − 1)      distance in the home frame
     t = (c/a)·sinh(aτ/c)             time in the home frame

   We integrate the rapidity η = aτ/c instead of evaluating those closed
   forms, because the throttle changes: dη/dτ = a/c, so η just accumulates,
   and β and γ fall out of it at every instant. The closed forms are still
   here — `burn()` — because they are what the milestone table is made of.

   Everything else in this file is the *consequence* of moving that fast:
   aberration crushes the sky into a cone ahead, Doppler paints a ring of
   true colour, beaming multiplies brightness by D⁴, and the cosmic
   microwave background heats up until it is as bright as the Sun.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;

  const R = SF.rel = {
    /** dη for a burn of `a` gravities over `dTau` ship-years. */
    rapidityStep(aGravities, dTauYears) {
      // dη/dτ = a/c, and c/g = 0.9687 years, so a[g]/c = a/0.9687 per year.
      return aGravities * dTauYears / K.gYears;
    },

    beta(eta) { return Math.tanh(eta); },
    gamma(eta) { return Math.cosh(eta); },
    rapidityFromBeta(beta) { return Math.atanh(Math.max(-0.999999999999, Math.min(0.999999999999, beta))); },
    rapidityFromGamma(gamma) { return Math.acosh(Math.max(1, gamma)); },

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
      return 1 / (gamma * (1 - beta * cosThetaApparent));
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
