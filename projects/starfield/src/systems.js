/* ══════════════════════════════════════════════════════════════════════
   systems.js — stars with planets around them, and the planets move.

   The original placed each planet once at a fixed angle and never touched
   it again, so loitering near a star showed a frozen diorama. Worse, every
   system in the universe shared one hardcoded inclination.

   Kepler's third law fixes both for the cost of one line per frame:

     P[yr] = √(a[AU]³ / M[M☉])        ω = 2π/P ∝ a^(−3/2)

   Mercury at 0.387 AU → 0.241 yr. Jupiter at 5.204 AU → 11.87 yr. Both
   correct. Inner worlds whip round while outer ones crawl, and that
   differential rotation alone is what sells a system as a *system*.

   The orbits are timed in *home* time, not ship time, because the planets
   are the ones sitting still. So the faster you fly, the faster they spin:
   at γ = 100 a century passes out there for every year aboard, and you can
   watch it happen. That is time dilation, seen from the other side.

   What kinds of planets exist is decided by the frost line:

     a_snow ≈ 2.7·√(L/L☉) AU     inside: rock. outside: gas and ice.
     r_HZ   ≈ 1.0·√(L/L☉) AU

   For the Sun that puts the frost line at 2.7 AU, which is exactly the
   asteroid belt, and the habitable zone at 1 AU. The formula validates
   itself. Then it does something better: for an M5 dwarf at L = 0.002 L☉
   the frost line falls to 0.12 AU and the habitable zone to 0.045 AU, so
   M-dwarf systems come out tiny and tightly packed — which is precisely
   what TRAPPIST-1 looks like in reality. Since 76% of stars are M dwarfs,
   most systems in this game are compact red huddles, and a sprawling
   Sun-like system is the rare one. Nobody authored that.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const F = SF.FUDGE;
  const v3 = SF.v3;

  const AU_PER_SOLAR_RADIUS = K.rSunM / K.auM;   // 0.0046491
  const TWO_PI = Math.PI * 2;

  /* ── planet classes, decided by where they formed ──────────────────── */
  const CLASS_STYLE = {
    lava:      { hue: 14,  sat: 72, light: 46, label: "molten rock" },
    iron:      { hue: 22,  sat: 26, light: 40, label: "iron world" },
    rock:      { hue: 32,  sat: 30, light: 46, label: "rocky world" },
    desert:    { hue: 38,  sat: 48, light: 54, label: "desert world" },
    terran:    { hue: 202, sat: 52, light: 48, label: "temperate world" },
    ice:       { hue: 196, sat: 20, light: 74, label: "ice world" },
    iceGiant:  { hue: 190, sat: 55, light: 52, label: "ice giant" },
    gasGiant:  { hue: 34,  sat: 44, light: 58, label: "gas giant" },
  };

  function randIn(lo, hi, rng) { return lo + (hi - lo) * rng(); }

  /** A unit vector uniform on the sphere: cos i uniform in [−1, 1]. */
  function randomDirection(rng) {
    const cosI = randIn(-1, 1, rng);
    const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
    const phi = rng() * TWO_PI;
    return { x: sinI * Math.cos(phi), y: sinI * Math.sin(phi), z: cosI };
  }

  /** Two orthonormal vectors spanning the plane perpendicular to `n`. */
  function planeBasis(n) {
    const seed = Math.abs(n.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    const u = v3.normalize(v3.cross(seed, n));
    const w = v3.cross(n, u);
    return [u, w];
  }

  const Systems = SF.systems = {
    /**
     * Catalogue RA/Dec/parallax → Cartesian light-years, done once at load
     * and never per frame:
     *   d[pc] = 1000 / plx[mas]
     *   x = d·cos δ·cos α,  y = d·cos δ·sin α,  z = d·sin δ
     * Returned in the game's axes (y up, z forward) rather than equatorial
     * ones, so the swap is x→x, z→y, y→z.
     */
    catalogueToCartesian(entry) {
      const distancePc = entry.plx ? 1000 / entry.plx : (entry.dly || 1) / K.pcLy;
      const distanceLy = entry.dly != null && !entry.plx ? entry.dly : distancePc * K.pcLy;
      const ra = entry.ra * Math.PI / 180;
      const dec = entry.dec * Math.PI / 180;
      const cd = Math.cos(dec);
      return {
        distanceLy,
        pos: {
          x: distanceLy * cd * Math.cos(ra),
          y: distanceLy * Math.sin(dec),
          z: distanceLy * cd * Math.sin(ra),
        },
      };
    },

    /** Star description from a catalogue row, using explicit radius when given. */
    starFromCatalogue(entry, distanceLy) {
      const teff = SF.stars.temperatureFromType(entry.sp);
      const dwarf = SF.stars.isWhiteDwarf(entry.sp);
      let radiusSolar = entry.rsun;
      let lum = entry.lsun;
      if (dwarf) {
        // White dwarfs are Earth-sized. Nothing on the main sequence is.
        radiusSolar = radiusSolar ?? 0.0127;
        lum = lum ?? radiusSolar * radiusSolar * Math.pow(teff / K.tSun, 4);
      } else if (radiusSolar == null || lum == null) {
        const seq = SF.stars.interpolateSequence(teff);
        radiusSolar = radiusSolar ?? seq.r;
        lum = lum ?? seq.l;
      }
      // If the catalogue gives a magnitude, trust it over the model — that
      // is a measurement, and the model is a fit.
      if (entry.v != null && distanceLy && !entry.lsun) {
        const measured = SF.stars.luminosityFromMagnitude(entry.v, distanceLy);
        if (Number.isFinite(measured) && measured > 0) lum = measured;
      }
      return {
        teff, radiusSolar, lum,
        type: entry.sp || SF.stars.classFor(teff),
        whiteDwarf: dwarf,
        radiusLy: dwarf
          ? F.starRadiusLy * 0.34
          : SF.stars.visualRadiusLy(radiusSolar),
      };
    },

    /**
     * Build a system. `star` may be supplied (catalogue) or sampled from the
     * real main-sequence distribution.
     */
    create({ pos, star, name, note, rng = Math.random, allowBlackHole = true, catalogue = false }) {
      const isBlackHole = !star && allowBlackHole && rng() < 0.002;

      if (isBlackHole) {
        return SF.blackhole.createSystem({ pos, rng, name, note });
      }

      const s = star || (() => {
        const sampled = SF.stars.sample(rng);
        return {
          teff: sampled.teff,
          radiusSolar: sampled.radius,
          lum: sampled.lum,
          type: sampled.type,
          radiusLy: SF.stars.visualRadiusLy(sampled.radius),
          mass: sampled.mass,
        };
      })();
      s.mass = s.mass ?? SF.stars.interpolateSequence(s.teff).m;
      s.colour = SF.color.at(s.teff);

      const normal = randomDirection(rng);
      const [u, w] = planeBasis(normal);
      const frostAU = SF.stars.frostLineAU(s.lum);
      const hzAU = SF.stars.habitableZoneAU(s.lum);

      const system = {
        kind: "system",
        name: name || null,
        note: note || null,
        catalogue,
        pos: { ...pos },
        star: s,
        normal, u, w,
        frostAU, hzAU,
        bodies: [],
        radiusLy: s.radiusLy,
        entered: false,
        labelAlpha: 0,
      };

      // The star itself.
      system.bodies.push({
        kind: "star",
        system,
        orbitAU: 0,
        radiusLy: s.radiusLy,
        teff: s.teff,
        lum: s.lum,
        radiusSolar: s.radiusSolar,
        name: system.name,
        p: { ...pos },
      });

      Systems.populate(system, rng);
      Systems.layout(system, 0);
      return system;
    },

    /** Planets, moons and comets, placed relative to the frost line. */
    populate(system, rng) {
      const { star, frostAU, hzAU } = system;
      // Real systems average a handful of planets; M dwarfs, which dominate,
      // tend to carry many small ones close in.
      const count = 1 + Math.floor(Math.pow(rng(), 0.75) * 6);
      // Orbits roughly follow a geometric progression, as ours does.
      let aAU = hzAU * randIn(0.18, 0.55, rng);
      // Coplanar to about 7°, like the solar system.
      const spread = 7 * Math.PI / 180;

      for (let i = 0; i < count; i += 1) {
        aAU *= randIn(1.45, 2.3, rng);
        const beyondFrost = aAU > frostAU;
        let cls, radiusEarth;
        if (beyondFrost) {
          // Past the frost line water is solid, so cores grow fast enough to
          // capture gas. Giants form here and only here.
          if (rng() < 0.45 && aAU < frostAU * 6) {
            cls = "gasGiant"; radiusEarth = randIn(8, 12.5, rng);
          } else if (rng() < 0.55) {
            cls = "iceGiant"; radiusEarth = randIn(3.2, 5.2, rng);
          } else {
            cls = "ice"; radiusEarth = randIn(0.25, 1.6, rng);
          }
        } else if (aAU < hzAU * 0.45) {
          cls = rng() < 0.4 ? "lava" : "iron"; radiusEarth = randIn(0.35, 1.5, rng);
        } else if (aAU < hzAU * 1.5) {
          cls = rng() < 0.35 ? "terran" : (rng() < 0.5 ? "desert" : "rock");
          radiusEarth = randIn(0.5, 1.9, rng);
        } else {
          cls = rng() < 0.5 ? "rock" : "desert"; radiusEarth = randIn(0.4, 1.7, rng);
        }

        const style = CLASS_STYLE[cls];
        const planet = {
          kind: "planet",
          system,
          cls,
          style,
          label: style.label,
          radiusEarth,
          radiusLy: F.planetRadiusLy * Math.pow(radiusEarth, F.planetRadiusExp),
          orbitAU: aAU,
          orbitLy: Systems.orbitToLy(aAU, star),
          // P = √(a³/M) in years; ω = 2π/P.
          periodYears: Math.sqrt(aAU * aAU * aAU / Math.max(0.02, star.mass)),
          phase: rng() * TWO_PI,
          tilt: randIn(-spread, spread, rng),
          ring: cls === "gasGiant" || cls === "iceGiant" ? rng() < 0.45 : rng() < 0.06,
          inHZ: aAU > hzAU * 0.72 && aAU < hzAU * 1.4,
          p: { x: 0, y: 0, z: 0 },
          moons: [],
        };
        planet.omega = TWO_PI / planet.periodYears;
        system.bodies.push(planet);

        // Moons. Giants keep families of them; rocky worlds rarely do.
        const moonCount = cls === "gasGiant" ? Math.floor(randIn(1, 4, rng))
          : cls === "iceGiant" ? Math.floor(randIn(0, 3, rng))
          : rng() < 0.3 ? 1 : 0;
        for (let mIndex = 0; mIndex < moonCount; mIndex += 1) {
          const moon = {
            kind: "moon",
            system,
            parent: planet,
            radiusLy: F.moonRadiusLy * randIn(0.6, 1.6, rng),
            orbitLy: planet.radiusLy * randIn(3.2, 8.5, rng) * (1 + mIndex * 0.7),
            periodYears: randIn(0.004, 0.05, rng) * (1 + mIndex),
            phase: rng() * TWO_PI,
            style: { hue: 210, sat: 8, light: 62 },
            label: "moon",
            p: { x: 0, y: 0, z: 0 },
          };
          moon.omega = TWO_PI / moon.periodYears;
          planet.moons.push(moon);
          system.bodies.push(moon);
        }
      }

      // Comets: long, eccentric, and out of the plane, the way real ones are.
      const cometCount = rng() < 0.6 ? 1 + (rng() < 0.25 ? 1 : 0) : 0;
      for (let i = 0; i < cometCount; i += 1) {
        const aOuter = aAU * randIn(1.4, 3.2, rng);
        const comet = {
          kind: "comet",
          system,
          radiusLy: F.cometRadiusLy * randIn(0.7, 1.7, rng),
          orbitAU: aOuter,
          orbitLy: Systems.orbitToLy(aOuter, star),
          eccentricity: randIn(0.55, 0.92, rng),
          periodYears: Math.sqrt(aOuter * aOuter * aOuter / Math.max(0.02, star.mass)),
          phase: rng() * TWO_PI,
          tilt: randIn(-1.1, 1.1, rng),
          label: "comet",
          p: { x: 0, y: 0, z: 0 },
        };
        comet.omega = TWO_PI / comet.periodYears;
        system.bodies.push(comet);
      }

      system.radiusLy = Math.max(
        system.star.radiusLy,
        ...system.bodies.map((b) => (b.orbitLy || 0) + b.radiusLy),
      );
    },

    /**
     * Semi-major axis in AU → rendered orbit radius in light-years.
     * Expressed as a power of the orbit measured in *stellar radii*, so the
     * shape of a system is preserved even though the scale is not: an M
     * dwarf's habitable zone is 48 stellar radii out and the Sun's is 215,
     * and that ratio is what makes red systems look huddled.
     */
    orbitToLy(aAU, star) {
      const starAU = Math.max(1e-5, star.radiusSolar * AU_PER_SOLAR_RADIUS);
      const inStellarRadii = Math.max(1.6, aAU / starAU);
      const ly = star.radiusLy * Math.pow(inStellarRadii, F.orbitExp);
      return Math.min(F.orbitMaxLy, ly);
    },

    /**
     * Advance every orbit by `dHomeYears` and write world positions into
     * each body's `p`. The angular step is capped so that at extreme γ,
     * where centuries pass per frame out there, orbits blur instead of
     * strobing backwards through the frame rate. (Declared in the ledger.)
     */
    layout(system, dHomeYears) {
      const { pos, u, w, normal } = system;
      for (const body of system.bodies) {
        if (body.kind === "star" || body.kind === "blackhole") {
          body.p.x = pos.x; body.p.y = pos.y; body.p.z = pos.z;
          continue;
        }
        if (body.kind === "moon") continue;   // placed relative to its planet below

        const step = Math.min(0.35, body.omega * dHomeYears * F.orbitRate);
        body.phase += step;
        if (body.phase > TWO_PI) body.phase -= TWO_PI;

        let r = body.orbitLy;
        if (body.eccentricity) {
          // Not a solved Kepler orbit — a fixed ellipse traced at a varying
          // rate, which is enough to read as "comet" without a solver.
          const e = body.eccentricity;
          r = body.orbitLy * (1 - e * e) / (1 + e * Math.cos(body.phase));
        }
        const cosA = Math.cos(body.phase), sinA = Math.sin(body.phase);
        const tilt = body.tilt || 0;
        body.p.x = pos.x + (u.x * cosA + w.x * sinA) * r + normal.x * r * tilt;
        body.p.y = pos.y + (u.y * cosA + w.y * sinA) * r + normal.y * r * tilt;
        body.p.z = pos.z + (u.z * cosA + w.z * sinA) * r + normal.z * r * tilt;

        // A planet's lit side faces its star; the renderer needs that vector.
        body.toStar = {
          x: pos.x - body.p.x, y: pos.y - body.p.y, z: pos.z - body.p.z,
        };

        for (const moon of body.moons || []) {
          moon.phase += Math.min(0.35, moon.omega * dHomeYears * F.orbitRate);
          const mc = Math.cos(moon.phase), ms = Math.sin(moon.phase);
          moon.p.x = body.p.x + (u.x * mc + w.x * ms) * moon.orbitLy;
          moon.p.y = body.p.y + (u.y * mc + w.y * ms) * moon.orbitLy;
          moon.p.z = body.p.z + (u.z * mc + w.z * ms) * moon.orbitLy;
          moon.toStar = { ...body.toStar };
        }
      }
    },

    /** Translate a whole system by −(forward · distance). */
    translate(system, forward, distanceLy) {
      system.pos.x -= forward.x * distanceLy;
      system.pos.y -= forward.y * distanceLy;
      system.pos.z -= forward.z * distanceLy;
    },

    /**
     * Gap to the next encounter, in home-frame light-years.
     *
     * Real stars are a Poisson point process, so gaps along a flight path
     * are exponentially distributed, not uniform:
     *   λ = n·π·R²      s = −ln(1 − U) / λ
     * With n = 0.004/ly³ and R = 4.46 ly this gives a 4 ly mean gap, which
     * matches the real mean nearest-neighbour distance of 0.554·n^(−1/3) =
     * 3.5 ly, and Proxima at 4.24.
     *
     * The distribution is the whole point: exponential gaps produce clusters
     * and voids on their own. Three systems in quick succession, then a long
     * empty stretch. Uniform sampling can never do that, and that clumpiness
     * is what makes empty space feel like real empty space.
     */
    nextGapLy(rng = Math.random) {
      const R = F.encounterRadiusLy;
      const lambda = K.nStarsPerLy3 * Math.PI * R * R;
      return -Math.log(1 - rng()) / lambda;
    },

    /**
     * Where to drop the next system, relative to the flight axis.
     * The gap above is real. This is not: instead of anywhere in a 4.46 ly
     * disk, we bias it onto the corridor so that flying somewhere means
     * arriving at something. Declared in the ledger.
     */
    corridorOffset(forward, rng = Math.random) {
      const [u, w] = planeBasis(forward);
      const r = F.corridorRadiusLy * Math.pow(rng(), F.corridorBias);
      const a = rng() * TWO_PI;
      return {
        x: u.x * Math.cos(a) * r + w.x * Math.sin(a) * r,
        y: u.y * Math.cos(a) * r + w.y * Math.sin(a) * r,
        z: u.z * Math.cos(a) * r + w.z * Math.sin(a) * r,
      };
    },

    classStyles: CLASS_STYLE,
  };
})();
