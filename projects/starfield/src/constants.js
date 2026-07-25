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
    // TIME IS NOT COMPRESSED ANY MORE. This used to read 0.4 — one second of
    // play was 0.4 years of the pilot's life, a hidden 12,600,000× speedup on
    // the one clock the whole game is about. It was described here as the
    // single largest lie in the game, and it was.
    //
    // It is gone. One second is one second. A 1 g burn covers 18 km in the
    // first minute, 0.24 AU in a day, and reaches 77% of light after a year,
    // which is exactly what a relativistic rocket does. The two clocks in the
    // HUD only mean something if the pilot's own clock is honest.
    //
    // What makes the game playable instead is the faster-than-light drive:
    // sub-light flight is for manoeuvring inside a system, and crossing real
    // distance is what the jump is for. That is a declared, visible cheat the
    // player engages on purpose, rather than a silent one applied to them.
    shipYearsPerSecond: 1 / year,

    // Orbits run at their true Kepler rate now. With the clock honest there is
    // nothing left to compensate for: Earth takes a year because it takes a
    // year. Kept as a dial rather than deleted, in case a system needs to be
    // watchable for a screenshot.
    orbitRate: 1,

    // Visual radii. A Sun-sized star is 7.35e-8 ly across; at any distance
    // you could survive it is far smaller than one pixel. Radii below are the
    // rendered/collidable size in light-years, still inflated but pulled back
    // toward a believable scale — a star now dwarfs its planets (~13×), and
    // both are small enough that flying into one is a rare accident rather
    // than the point of the game.
    // Bodies are drawn big on purpose now: this is a game about flying up to a
    // star and feeling it fill the sky, not spotting a pixel. A star spans ~0.2
    // ly rendered — a few seconds across in gear 1 — and dwarfs its planets by
    // ~10×. Orbits are quoted in stellar radii (see orbitToLy), so scaling the
    // star scales its whole system and the planets always sit clear of it.
    starRadiusLy: 0.20,                // was 0.05 — stars now loom
    starRadiusExp: 0.40,               // compresses the real 9,000× range to ~24×
    planetRadiusLy: 0.020,             // was 0.004 — planets read as worlds
    planetRadiusExp: 0.40,
    moonRadiusLy: 0.007,
    cometRadiusLy: 0.004,
    blackHoleRadiusLy: 0.035,          // for a 10 M☉ hole: r_s is 30 km = 3e-12 ly
    blackHoleRadiusExp: 0.33,

    // Gravity. The drawn geometry is enormously inflated — a Sun-mass star is
    // rendered 6.8×10⁵ times too wide — so its *true* surface gravity applied
    // at the drawn radius would give an escape velocity of about 1.2c and
    // silently turn every star in the game into a black hole. Instead the
    // pull is defined by what it should feel like at the drawn surface, and
    // falls off as an honest inverse square from there.
    //
    //   GM_eff = surfaceG × R_drawn²      g(r) = GM_eff / r²
    //
    // At 0.06 g a Sun-mass star leans on a 1 g ship without ever trapping it:
    // 0.06 g at the surface, 0.007 g three radii out. Masses scale linearly,
    // so a four-million-solar-mass black hole is still absolutely lethal.
    gravitySurfaceG: 0.06,             // gravities at a 1 R☉ star's drawn edge
    gravityMaxG: 5000,                 // clamp, so nothing returns Infinity

    // The faster-than-light drive, which is the *only* way to cross real
    // distance and therefore the game's headline cheat. Real physics forbids
    // it outright; the banner says so while it is running.
    //
    // Space here is inflated to light-year scale — even the nearest body in a
    // system sits a couple of ly away — so at honest lightspeed (3.2e-8 ly/s)
    // it is a two-year trip. Every playable speed, even "flying around the
    // planets", is therefore already faster than light. That is the arcade
    // bargain: the DRIVE cheats, and the g-force readout stays honest about
    // what the cheat would cost the pilot.
    //
    // Speed is in light-years per REAL second, and it is SIGNED: positive is
    // along the nose, negative is astern.
    warpMaxLySec: 4e9,                 // absolute ceiling any gear may name

    // ── the gearbox ──────────────────────────────────────────────────────
    // A GEAR IS AN ACCELERATION, NOT A SPEED. Changing gear never changes how
    // fast you are going — it changes how hard the engine can push. The ship
    // carries a real velocity VECTOR: thrust adds to it along the nose, nothing
    // bleeds it away, and turning the ship only turns where the next push goes.
    // That is what lets you look around while travelling, and it is why the
    // green heading marker and the crosshair come apart.
    //
    //   top    the fastest this gear can push you to — a ceiling on thrust,
    //          NOT a speed it forces on you. Shift down while going faster
    //          than it and you simply keep coasting: the engine will no longer
    //          add speed, only take it away.
    //   ramp   seconds of full thrust from a standstill to that ceiling, so
    //          acceleration = top / ramp. This is the number the gear is
    //          really selecting.
    //
    // Speeds below are in HOME LIGHT-YEARS PER SECOND OF YOUR OWN LIFE, which
    // is the only speed a pilot can act on — see the note on celerity in
    // game.js. Below c that is γβc, so gear 2's ceiling of "99% of light" moves
    // you seven times further per second than its β suggests, and that is real
    // relativity doing you a favour rather than a cheat.
    //
    // GEARS 1 AND 2 ARE HONEST. Gear 1 is realistic spacecraft speed — metres
    // and kilometres per second, the gear you dock in. Gear 2 climbs to 99% of
    // light, so all the relativity lives there: aberration, the starbow, the
    // clocks splitting, and the length contraction that makes crossing a solar
    // system in it take about a minute. Gears 3–6 are the declared cheat, and
    // the ladder is sized to the distances the game contains: neighbouring
    // stars ~4 ly, the galactic core 26,670 ly, Andromeda 2.5 Mly.
    //   c ≈ 3.1688×10⁻⁸ ly/s. Tuning these by feel is expected.
    gears: [
      { id: 1, name: "Thrusters", topLySec: 9.5e-11, ramp: 4, honest: true,
        note: "Real spacecraft speed — up to about 900 km/s. Slow, precise, and the only gear fine enough to work close to a planet." },
      { id: 2, name: "Relativistic", topLySec: 2.224e-7, ramp: 8, honest: true,
        note: "Honest physics all the way to 99% of light. Space contracts ahead of you, so this crosses a solar system — and the sky pays for it." },
      { id: 3, name: "Interstellar", topLySec: 0.1, ramp: 3,
        note: "The first faster-than-light gear, and the start of real travel: the nearest star is about forty seconds out." },
      { id: 4, name: "Fast transit", topLySec: 2, ramp: 3.5,
        note: "Faster-than-light. Two light-years a second — neighbouring stars in a couple of seconds." },
      { id: 5, name: "Galactic", topLySec: 2e3, ramp: 4,
        note: "Faster-than-light. The black hole at the centre of the galaxy is about thirteen seconds away." },
      { id: 6, name: "Intergalactic", topLySec: 5e5, ramp: 5,
        note: "Faster-than-light. 500,000 ly/s — Andromeda in five seconds, and the home clock notices." },
    ],
    // Kill velocity is the one autopilot and it has to work from ANY speed,
    // including speeds the current gear could never have reached — otherwise
    // dropping into gear 1 at a thousand light-years a second would strand you.
    // It kills the velocity vector geometrically, so a full stop is about two
    // seconds from anywhere.
    brakeSeconds: 0.45,

    // Flight-assist authority, in gravities: the thrusters that swing your
    // velocity round to match the nose so the ship goes where you point it.
    // Barely a cheat — a real pilot would fire exactly these, just by hand.
    // The burn is integrated honestly and is suppressed near c like any other.
    assistG: 1.4,

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
