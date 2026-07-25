/* ══════════════════════════════════════════════════════════════════════
   galaxy.js — galaxies you can actually reach, and that resolve into stars.

   The original drifted galaxies in at a fifth of flight speed and, the
   moment one got close, silently swapped it for a fresh one spawned far
   away. You could never arrive. And the sprite had no code path where its
   stars became individual objects, because it was a glow blob with stroked
   arms.

   THE HANDOFF IS NOT ARBITRARY. Angular size is θ ≈ D/d, so Andromeda —
   152,000 ly across at 2.54 Mly — is 3.4° wide, seven full moons. You start
   resolving individual stars when their mean separation s ≈ 4 ly subtends
   more than a rendered pixel, θ_res ≈ 10⁻³ rad:

     d_resolve = s / θ_res ≈ 4 / 0.001 ≈ 4,000 ly

   So three staged representations, crossfading by real distance:

     > 100,000 ly    a Sérsic-profile sprite
                     I(R) = I_e·exp(−b_n[(R/R_e)^(1/n) − 1]),  b_n ≈ 2n − ⅓
                     n = 4 is de Vaucouleurs, which is what ellipticals do;
                     n = 1 is an exponential disk, which is what spirals do.
     100,000→4,000   the sprite grains apart into thousands of point stars
                     sampled from the real disk profile I(R) = I₀·e^(−R/h),
                     scale length h ≈ 8,500 ly, thin-disk height ~1,000 ly,
                     each coloured by the same IMF as every other star.
     < 4,000 ly      you are inside it. Encounters get denser, and the
                     galaxy stops being scenery.

   ARMS. Real spiral arms are logarithmic — density waves, Lin–Shu — not
   the Archimedean curve the original drew:

     r = r₀ · e^(θ·tan φ)      Sa 5–10° · Sb 10–15° · Sc 15–25°
     the Milky Way is about 12°

   One expression, and they immediately read as real galaxies.

   And a galaxy is recycled only once it has been entered and left behind.
   Never because a raw distance threshold tripped.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const v3 = SF.v3;

  const RESOLVE_START_LY = 100000;   // sprite begins graining apart
  const RESOLVE_FULL_LY = 4000;      // fully individual stars
  const INSIDE_ANGULAR = 1.2;        // radians: it wraps around you, so it *is* the sky
  const MAX_POINTS = 1500;

  /** b_n ≈ 2n − ⅓, the Sérsic normalisation that puts R_e at half the light. */
  function bn(n) { return 2 * n - 1 / 3; }

  function sersic(R, Re, n) {
    return Math.exp(-bn(n) * (Math.pow(Math.max(1e-6, R / Re), 1 / n) - 1));
  }

  function planeBasis(n) {
    const seed = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const u = v3.normalize(v3.cross(seed, n));
    return [u, v3.cross(n, u)];
  }

  const Galaxy = SF.galaxy = {
    resolveStartLy: RESOLVE_START_LY,
    resolveFullLy: RESOLVE_FULL_LY,

    create({ pos, diameterLy, kind = "spiral", n, pitchDeg, hue, name, note, mass, rng = Math.random, permanent = false }) {
      const normal = (() => {
        const cosI = -1 + 2 * rng();
        const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
        const phi = rng() * Math.PI * 2;
        return { x: sinI * Math.cos(phi), y: sinI * Math.sin(phi), z: cosI };
      })();
      const [u, w] = planeBasis(normal);
      const elliptical = kind === "elliptical";
      const sersicN = n ?? (elliptical ? 4 : kind === "irregular" ? 0.8 : 1);

      return {
        kind: "galaxy",
        type: kind,
        name: name || null,
        note: note || null,
        permanent,
        pos: { ...pos },
        diameterLy,
        radiusLy: diameterLy / 2,
        // Half-light radius. For an exponential disk R_e ≈ 1.68h, and the
        // visible extent is roughly four scale lengths, so R_e ≈ 0.42·R.
        effectiveRadiusLy: diameterLy * (elliptical ? 0.18 : 0.21),
        scaleLengthLy: diameterLy / 12.4,   // Milky Way: 105,700 / 12.4 = 8,500
        scaleHeightLy: diameterLy / 106,    // Milky Way: ~1,000
        sersicN,
        pitch: (pitchDeg ?? (kind === "spiral" ? 10 + rng() * 14 : 12)) * Math.PI / 180,
        arms: kind === "spiral" ? (rng() < 0.65 ? 2 : 4) : kind === "barred" ? 2 : 3,
        hue: hue ?? (elliptical ? 38 : 210 + rng() * 40),
        normal, u, w,
        spin: rng() < 0.5 ? -1 : 1,
        mass: mass || null,
        entered: false,
        wasInside: false,
        points: null,
        labelAlpha: 0,
      };
    },

    /**
     * Lazily build the star field for a galaxy that has come close enough to
     * resolve. Radii are drawn from the exponential disk profile by inverse
     * transform on its cumulative distribution, so the points genuinely
     * follow I(R) = I₀·e^(−R/h) rather than being scattered uniformly.
     */
    buildPoints(galaxy, rng = Math.random) {
      if (galaxy.points) return galaxy.points;
      const points = [];
      const h = galaxy.scaleLengthLy;
      const zh = galaxy.scaleHeightLy;
      const elliptical = galaxy.type === "elliptical";

      for (let i = 0; i < MAX_POINTS; i += 1) {
        let r;
        if (elliptical) {
          // de Vaucouleurs: sample R^(1/4)-ish by pushing uniform deviates out.
          r = galaxy.effectiveRadiusLy * Math.pow(rng(), 2.6) * 3.2;
        } else {
          // Exponential disk: solve 1 − (1 + R/h)e^(−R/h) = U by iteration.
          const U = rng() * 0.985;
          let x = 1.7;
          for (let k = 0; k < 12; k += 1) {
            const e = Math.exp(-x);
            const f = 1 - (1 + x) * e - U;
            const df = x * e;
            x -= f / Math.max(1e-6, df);
            if (x < 0) x = 1e-3;
          }
          r = x * h;
        }

        let theta = rng() * Math.PI * 2;
        if (!elliptical && galaxy.type !== "irregular") {
          // Pull stars toward the logarithmic arms: r = r₀·e^(θ tan φ), so
          // the arm's angle at radius r is θ = ln(r/r₀)/tan φ.
          const armIndex = Math.floor(rng() * galaxy.arms);
          const armTheta = Math.log(Math.max(1e-3, r / (h * 0.35))) / Math.tan(galaxy.pitch)
            + armIndex * Math.PI * 2 / galaxy.arms;
          const pull = 0.62;
          const jitter = (rng() - 0.5) * 1.5;
          theta = theta * (1 - pull) + (armTheta + jitter) * pull;
        }

        // Exponential vertical profile, symmetric about the plane.
        const zSign = rng() < 0.5 ? -1 : 1;
        const z = -Math.log(Math.max(1e-6, rng())) * zh * zSign * (elliptical ? 6 : 1);

        const star = SF.stars.sample(rng);
        points.push({
          x: Math.cos(theta) * r,
          y: Math.sin(theta) * r,
          z,
          teff: star.teff,
          lum: star.lum,
          entry: SF.color.at(star.teff),
        });
      }
      galaxy.points = points;
      return points;
    },

    /**
     * Distance, angular radius, and which of the three stages applies.
     *
     * The crossfade is keyed to the galaxy's *near edge*, not its centre,
     * because that is the part you actually see resolve first. Andromeda is
     * 152,000 ly across: standing 90,000 ly from its middle puts its nearest
     * stars 14,000 ly away and already graining apart while its far side is
     * still a smooth glow. Keying off the centre instead made a galaxy this
     * large jump from "smooth sprite" straight to "you are inside it".
     */
    measure(galaxy) {
      const d = Math.hypot(galaxy.pos.x, galaxy.pos.y, galaxy.pos.z);
      const angular = galaxy.radiusLy / Math.max(1e-6, d);
      const nearEdge = Math.max(1, d - galaxy.radiusLy);

      let grain = 0;
      if (nearEdge <= RESOLVE_FULL_LY) {
        grain = 1;
      } else if (nearEdge < RESOLVE_START_LY) {
        // Crossfade in log distance across the 100,000 → 4,000 ly window.
        grain = (Math.log(RESOLVE_START_LY) - Math.log(nearEdge))
              / (Math.log(RESOLVE_START_LY) - Math.log(RESOLVE_FULL_LY));
      }
      grain = Math.max(0, Math.min(1, grain));

      const stage = angular > INSIDE_ANGULAR ? "inside"
        : grain >= 1 ? "resolved"
        : grain > 0 ? "resolving"
        : "sprite";
      return { distanceLy: d, nearEdgeLy: nearEdge, angular, stage, grain };
    },

    /** Surface brightness of the sprite at fractional radius t ∈ [0,1]. */
    profileAt(galaxy, t) {
      return sersic(t * galaxy.radiusLy, galaxy.effectiveRadiusLy, galaxy.sersicN);
    },

    /**
     * A point on a logarithmic spiral arm, in the galaxy's own plane.
     * `t` runs 0 → 1 from the centre outward.
     */
    armPoint(galaxy, armIndex, t) {
      // Arms are only traced from where they actually become visible — well
      // outside the bulge. Starting at 6% of the radius instead of 18% makes
      // a 10° pitch wind two and a half times round, which no real galaxy
      // does; from 18% it is about one and a half turns, which they do.
      const r0 = galaxy.radiusLy * 0.18;
      const maxTheta = Math.log(galaxy.radiusLy / r0) / Math.tan(galaxy.pitch);
      const theta = t * maxTheta;
      const r = r0 * Math.exp(theta * Math.tan(galaxy.pitch));
      const a = theta * galaxy.spin + armIndex * Math.PI * 2 / galaxy.arms;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, r };
    },

    /** Galaxy-plane coordinates → world position. */
    toWorld(galaxy, x, y, z) {
      const { pos, u, w, normal } = galaxy;
      return {
        x: pos.x + u.x * x + w.x * y + normal.x * z,
        y: pos.y + u.y * x + w.y * y + normal.y * z,
        z: pos.z + u.z * x + w.z * y + normal.z * z,
      };
    },

    translate(galaxy, forward, distanceLy) {
      galaxy.pos.x -= forward.x * distanceLy;
      galaxy.pos.y -= forward.y * distanceLy;
      galaxy.pos.z -= forward.z * distanceLy;
    },

    /**
     * How thick the star field is where the ship currently sits, relative to
     * the solar neighbourhood. This is what makes leaving the disk a real
     * event rather than an announcement: the sky genuinely empties out.
     */
    localDensity(galaxy) {
      // The ship is the origin, so the galaxy's own pos is −(ship − centre).
      const dx = -galaxy.pos.x, dy = -galaxy.pos.y, dz = -galaxy.pos.z;
      const height = Math.abs(dx * galaxy.normal.x + dy * galaxy.normal.y + dz * galaxy.normal.z);
      const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - height * height));
      // I(R,z) = I₀·e^(−R/h)·e^(−|z|/z_h), normalised at the Sun's 26,670 ly.
      const solarRadial = K.sgrADistanceLy;
      return Math.exp(-(radial - solarRadial) / galaxy.scaleLengthLy)
           * Math.exp(-height / galaxy.scaleHeightLy);
    },

    /**
     * Real galaxy luminosities follow a Schechter function
     *   φ(L) ∝ (L/L*)^α · e^(−L/L*)   with α ≈ −1.25
     * so, exactly like stars, most galaxies are dwarfs. Sampled here as a
     * diameter, which is what the renderer needs.
     */
    sampleDiameterLy(rng = Math.random) {
      // Draw L/L* from the Schechter tail, then D ∝ L^0.4 (Tully–Fisher-ish).
      const u = rng();
      const lStar = Math.pow(u, -1 / 0.25) * 0.02;
      const ratio = Math.min(4, Math.max(0.02, lStar * (-Math.log(1 - rng() * 0.9))));
      return Math.max(3000, K.milkyWayDiameterLy * Math.pow(ratio, 0.4));
    },

    /** Hubble-sequence pick, weighted the way the real sky is. */
    sampleKind(rng = Math.random) {
      const u = rng();
      if (u < 0.30) return "spiral";
      if (u < 0.52) return "barred";
      if (u < 0.72) return "elliptical";
      if (u < 0.94) return "irregular";
      return "spiral";
    },
  };
})();
