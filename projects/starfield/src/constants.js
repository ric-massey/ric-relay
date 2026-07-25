/* ══════════════════════════════════════════════════════════════════════
   constants.js — the numbers.

   Two blocks, and the distinction matters:

     SF.K   real physics. Every value is a measured or defined constant.
            Nothing here was tuned to make the game feel good. If one of
            these is wrong, it is a bug.

     SF.FUDGE  the cheats. Space is so empty that an honest simulation is
            unplayable (see the ledger, §14 of the plan) — so we inflate
            sizes and compress time. Every cheat lives here, in one place,
            with its magnitude written down, and the in-game ledger reads
            straight out of this object.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});

  const c = 299792458;                 // m/s, exact by definition
  const lyM = 9.4607304725808e15;      // metres per Julian light-year, exact
  const year = 31557600;               // Julian year in seconds, exact
  const g0 = 9.80665;                  // standard gravity, m/s², exact
  const auM = 1.495978707e11;          // astronomical unit, m, exact

  const K = SF.K = {
    c, lyM, year, g0, auM,

    h: 6.62607015e-34,                 // Planck, J·s (exact)
    kB: 1.380649e-23,                  // Boltzmann, J/K (exact)
    sigmaSB: 5.670374419e-8,           // Stefan–Boltzmann, W/m²/K⁴
    wienB: 2.897771955e-3,             // Wien displacement, m·K

    pcLy: 3.2615638,                   // light-years per parsec
    auLy: auM / lyM,                   // 1.5813e-5 ly per AU

    // A 1 g rocket. c/g and c²/g are the natural scales of the whole game:
    //   c / g = 0.9687 years        c² / g = 0.9687 light-years
    // so at one gravity the ship's rapidity climbs by 1/0.9687 per year.
    gYears: c / (g0 * year),           // 0.968716…

    rSunM: 6.957e8,                    // solar radius, m (IAU nominal)
    rSunLy: 6.957e8 / lyM,             // 7.3535e-8 ly
    rEarthM: 6.371e6,                  // Earth equatorial radius, m
    mSunKg: 1.98892e30,
    lSunW: 3.828e26,                   // solar luminosity, W (IAU nominal)
    tSun: 5772,                        // solar effective temperature, K

    tCMB: 2.72548,                     // cosmic microwave background, K
    protonMeV: 938.27208816,           // proton rest energy

    // Schwarzschild radius per solar mass: r_s = 2GM/c² = 2.953 km
    rsPerSolarM: 2953.25,

    nStarsPerLy3: 0.004,               // local stellar number density
    meanNeighbourLy: 0.554 * Math.pow(0.004, -1 / 3),  // ≈ 3.5 ly

    // Interstellar medium. The Local Bubble is a real ~300 ly cavity blown
    // out around the Sun by ancient supernovae, and it really is ~20× thinner
    // than the galactic average. Free level design.
    ismLocalBubble: 0.05,              // atoms / cm³
    ismGalactic: 1.0,                  // atoms / cm³
    localBubbleLy: 300,

    h0: 70,                            // km/s/Mpc
    hubbleLy: 14.0e9,                  // c / H₀
    cosmicEventHorizonLy: 16.0e9,      // comoving; you can never reach past it
    observableEdgeLy: 46.5e9,

    milkyWayDiameterLy: 105700,
    milkyWayScaleLengthLy: 8500,       // exponential disk scale length h
    milkyWayScaleHeightLy: 1000,       // thin disk
    milkyWayPitchDeg: 12,              // logarithmic spiral pitch angle
    sgrADistanceLy: 26670,
  };

  /* ── the cheats ──────────────────────────────────────────────────────
     Read by hud.js to build the in-game honesty ledger. Each entry states
     what we changed and by how much, in the same units as the real thing.  */
  SF.FUDGE = {
    // Time compression. One second of play is this many years of ship time,
    // so a 1 g burn reaches the galactic edge in about a minute instead of
    // twelve years. This is the single largest lie in the game.
    shipYearsPerSecond: 0.4,

    // Visual radii. A Sun-sized star is 7.35e-8 ly across; at any distance
    // you could survive it is far smaller than one pixel. Radii below are the
    // rendered/collidable size in light-years, still inflated but pulled back
    // toward a believable scale — a star now dwarfs its planets (~13×), and
    // both are small enough that flying into one is a rare accident rather
    // than the point of the game.
    starRadiusLy: 0.05,                // ×6.8e5 for a solar-radius star
    starRadiusExp: 0.40,               // compresses the real 9,000× range to ~24×
    planetRadiusLy: 0.004,             // Earth: ×6.0e6
    planetRadiusExp: 0.40,
    moonRadiusLy: 0.0015,
    cometRadiusLy: 0.0010,
    blackHoleRadiusLy: 0.010,          // for a 10 M☉ hole: r_s is 30 km = 3e-12 ly
    blackHoleRadiusExp: 0.33,

    // Orbital-motion slowdown. Orbits keep their real relative rates (inner
    // worlds fast, outer slow) and still speed up when you fly fast — time
    // dilation seen from outside — but the whole thing is scaled down by this
    // factor so a parked system drifts at a pace you can watch instead of
    // whirling round every few seconds.
    orbitRate: 0.22,

    // Orbits, expressed as a power law in units of the star's own radius so
    // that the *shape* of a system survives: M-dwarf systems stay compact,
    // Sun-like systems stay sprawling. The exponent is the compression.
    orbitExp: 0.35,
    orbitMaxLy: 1.9,

    // Encounter geometry. Honest λ = nπR² with R = 4.46 ly gives a 4 ly mean
    // gap — that part is real. What is not real is that we then drop each
    // system near the flight axis instead of anywhere in that 4.46 ly disk.
    encounterRadiusLy: 4.46,           // real: reproduces the 4 ly mean gap
    corridorRadiusLy: 0.85,            // fake: where we actually put them
    corridorBias: 0.7,                 // r = R·U^0.7, concentrated on the axis

    // How far ahead a system is born, and how many may exist at once. At high
    // γ the road ahead is contracted by 1/γ, so this shrinks on its own — the
    // cap only stops the object count exploding when γ passes ~17.
    spawnAheadLy: 2.4,                 // × γ
    spawnAheadMaxLy: 40,
    maxSystems: 11,

    // Cross-section inflation, quoted for the ledger. Real mean free path
    // through the galaxy is 1/(nσ) with σ = πR☉² = 1.7e-14 ly².
    trueMeanFreePathLy: 1 / (0.004 * Math.PI * Math.pow(6.957e8 / 9.4607304725808e15, 2)),
  };

  // Focal length in pixels-per-radian-ish units: this is the original
  // starfield's projection scale, kept because it was already correct.
  SF.FOCAL = 0.82;
})();
