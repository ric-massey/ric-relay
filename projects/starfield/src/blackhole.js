/* ══════════════════════════════════════════════════════════════════════
   blackhole.js — general relativity, rendered.

   The original had a hazard with a smaller radius and an accretion ellipse
   whose phase was randomised once at spawn and then reused unchanged every
   frame, so the disk never turned. The real object is the most spectacular
   thing in physics, and almost all of it is arithmetic:

     Schwarzschild radius   r_s = 2GM/c² = 2.953 km × (M/M☉)
     photon sphere          1.5 r_s
     ISCO, last stable orbit  3 r_s
     apparent shadow        (3√3/2)·r_s = 2.598 r_s   ← what the EHT imaged
     light deflection       α = 4GM/(c²b) = 2 r_s / b

   Two things follow, and both are worth the code.

   LENSING. A point mass bends light by α = 2r_s/b, which turns into the
   standard lens equation β = θ − θ_E²/θ with θ_E = √(2r_s/d). Solve it for
   the apparent position and every background star gets pushed radially
   outward from the hole; stars swim around the dark disk, and one that
   passes near-perfectly behind it smears into an Einstein ring. The second
   root of the same quadratic is the counter-image on the far side, which
   is why a lensed star appears twice.

   BEAMING. Matter at the ISCO orbits at roughly 0.5c, so the side coming
   toward you is brightened by D⁴ and the receding side is dimmed by the
   same factor. One side of the ring blazes and the other nearly vanishes.
   That asymmetry is exactly what the Event Horizon Telescope photographed
   and what Interstellar rendered — and it is the same D⁴ the rest of this
   game already uses for the starbow.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const F = SF.FUDGE;

  const SHADOW_FACTOR = 3 * Math.sqrt(3) / 2;   // 2.598

  /* Real holes, as set pieces. Sgr A* sits at the galactic centre, which the
     1 g burn table says you reach at τ ≈ 10 ship-years. The game already had
     a destination; it just didn't know it yet. */
  const CATALOGUE = [
    { name: "A0620-00",   ra: 95.6796,  dec: -0.3564,  dly: 3300,  mass: 6.6,   note: "nearest confirmed X-ray binary hole" },
    { name: "Gaia BH1",   ra: 262.1712, dec: -0.5811,  dly: 1560,  mass: 9.6,   note: "the nearest black hole known" },
    { name: "V404 Cygni", ra: 306.0159, dec: 33.8674,  dly: 7800,  mass: 9.0 },
    { name: "Cygnus X-1", ra: 299.5903, dec: 35.2016,  dly: 7200,  mass: 21.2,  note: "the first one anybody believed in" },
  ];

  const BH = SF.blackhole = {
    catalogue: CATALOGUE,

    /** Schwarzschild radius in metres, and in light-years. */
    schwarzschildM(massSolar) { return K.rsPerSolarM * massSolar; },
    schwarzschildLy(massSolar) { return K.rsPerSolarM * massSolar / K.lyM; },

    photonSphereM(massSolar) { return 1.5 * BH.schwarzschildM(massSolar); },
    iscoM(massSolar) { return 3 * BH.schwarzschildM(massSolar); },
    shadowM(massSolar) { return SHADOW_FACTOR * BH.schwarzschildM(massSolar); },

    /** Weak-field deflection angle, radians, for a ray with impact parameter b metres. */
    deflection(massSolar, bMetres) {
      return 2 * BH.schwarzschildM(massSolar) / Math.max(1e-9, bMetres);
    },

    /**
     * Rendered size. A ten-solar-mass hole is 30 km across — three
     * picolight-years — so like every other radius in this game it is
     * inflated, here by ~3×10⁹. The exponent keeps the range honest:
     * Sgr A* at 4.3 million solar masses comes out 30× wider than a stellar
     * hole, and it should.
     */
    visualRadiusLy(massSolar) {
      return F.blackHoleRadiusLy * Math.pow(Math.max(0.1, massSolar / 10), F.blackHoleRadiusExp);
    },

    /**
     * Build a black hole "system". Same shape as a star system so the rest
     * of the game does not need to care which it got.
     */
    createSystem({ pos, rng = Math.random, name, note, mass }) {
      const massSolar = mass ?? Math.exp(Math.log(5) + rng() * Math.log(8));   // 5–40 M☉
      const radiusLy = BH.visualRadiusLy(massSolar);
      const spin = rng() < 0.5 ? -1 : 1;

      const hole = {
        kind: "blackhole",
        system: null,
        massSolar,
        radiusLy,
        rsM: BH.schwarzschildM(massSolar),
        // Disk runs from the ISCO out to a few tens of r_s.
        diskInner: radiusLy * (3 / SHADOW_FACTOR),
        diskOuter: radiusLy * 2.9,
        // Inclination of the disk to the line of sight, and which way it turns.
        tiltPhase: rng() * Math.PI * 2,
        tilt: 0.18 + rng() * 0.55,
        spin,
        phase: rng() * Math.PI * 2,
        // Matter at the ISCO orbits at ~0.5c. That is where the D⁴ comes from.
        diskBeta: 0.5,
        name: name || null,
        p: { ...pos },
      };

      const system = {
        kind: "system",
        blackHole: true,
        name: name || null,
        note: note || "no light leaves this",
        pos: { ...pos },
        star: null,
        hole,
        bodies: [hole],
        radiusLy: radiusLy * 3.2,
        entered: false,
        labelAlpha: 0,
        normal: { x: 0, y: 1, z: 0 },
        u: { x: 1, y: 0, z: 0 },
        w: { x: 0, y: 0, z: 1 },
        frostAU: 0, hzAU: 0,
      };
      hole.system = system;
      return system;
    },

    /** Spin the disk. Called with home-frame years elapsed. */
    advance(hole, dHomeYears) {
      // Orbital period at the ISCO of a stellar-mass hole is milliseconds, so
      // the honest rate is a blur. Capped, and declared in the ledger.
      hole.phase += hole.spin * Math.min(0.25, dHomeYears * 4.2e3);
      if (hole.phase > Math.PI * 2) hole.phase -= Math.PI * 2;
    },

    /**
     * Gravitational lensing, in screen space.
     *
     * Solving β = θ − θ_E²/θ for the primary image gives
     *     θ₊ = ½(β + √(β² + 4θ_E²))
     * and the counter-image on the other side is the negative root
     *     θ₋ = ½(β − √(β² + 4θ_E²)).
     *
     * `beta` and `einstein` are both in pixels. Returns the two apparent
     * radii; the caller places the star along the same bearing from the hole.
     *
     * The Einstein radius used by the renderer is tied to the *rendered*
     * shadow rather than √(2r_s/d), because r_s here is already inflated by
     * ~10⁹. The functional form is real; the one ratio is chosen so the ring
     * sits just outside the shadow, which is where it sits in the EHT image.
     */
    lens(betaPx, einsteinPx) {
      const root = Math.sqrt(betaPx * betaPx + 4 * einsteinPx * einsteinPx);
      return { primary: 0.5 * (betaPx + root), counter: 0.5 * (betaPx - root) };
    },

    /** Einstein radius the renderer uses, in pixels, given the shadow's radius. */
    einsteinRadiusPx(shadowPx) { return shadowPx * 2.15; },

    /**
     * Doppler factor of the disk at azimuth `a`, seen at inclination `tilt`.
     * The component of orbital motion along the line of sight is
     * cos(a)·β·cos(tilt), and matter at the ISCO is doing half the speed of
     * light — so one side of the ring is coming at you at 0.5c and the other
     * is going away at 0.5c.
     */
    dopplerAt(a, diskBeta, tilt) {
      const losBeta = Math.cos(a) * diskBeta * Math.cos(tilt);
      const gamma = 1 / Math.sqrt(Math.max(1e-6, 1 - diskBeta * diskBeta));
      return 1 / (gamma * (1 - losBeta));
    },

    /**
     * Brightness ratio across the disk: D⁴. At 0.5c that is a factor of
     * about sixty between the approaching and receding sides — one side
     * blazes and the other nearly disappears. That asymmetry is exactly what
     * the Event Horizon Telescope photographed.
     */
    diskBeaming(a, diskBeta, tilt) {
      const D = BH.dopplerAt(a, diskBeta, tilt);
      return D * D * D * D;
    },

    /** Human-readable size for the HUD, since r_s spans kilometres to AU. */
    describeSize(massSolar) {
      const m = BH.schwarzschildM(massSolar);
      if (m < 1e7) return `${(m / 1000).toFixed(m < 1e5 ? 0 : 0)} km`;
      const au = m / K.auM;
      if (au < 1) return `${(m / 1e9).toFixed(1)} million km`;
      return `${au.toFixed(au < 10 ? 3 : 0)} AU`;
    },
  };
})();
