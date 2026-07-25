/* ══════════════════════════════════════════════════════════════════════
   deep-sky.js — everything bigger than a star.

   ═══════════════ EDITABLE — Messier, NGC, and the neighbours ═══════════
     ra, dec   J2000 degrees
     dly       distance, light-years (not parallax — these are far too far)
     dia       true diameter, light-years
     kind      spiral | barred | elliptical | irregular | nebula |
               cluster | globular | remnant | blackhole
     n         Sérsic index, galaxies only. n = 4 is de Vaucouleurs, the
               profile ellipticals actually follow; n = 1 is an exponential
               disk, which is what spirals actually follow.
     pitch     spiral arm pitch angle in degrees. Real arms are logarithmic
               spirals, r = r₀·e^(θ tan φ): Sa 5–10°, Sb 10–15°, Sc 15–25°.
               The Milky Way is about 12°.
     hue       nebula tint only; galaxies get their colour from starlight.

   Angular size is just θ ≈ dia / dly, which is why Andromeda — 152,000 ly
   across at 2.54 Mly — covers 3.4° of sky, seven full moons wide. Almost
   nobody has seen that, because only its bright core is visible by eye.
   ══════════════════════════════════════════════════════════════════════ */
window.SF_DEEP_SKY = [
  // ── inside the Milky Way ────────────────────────────────────────────
  { name: "The Pleiades",       m: "M45",  ra: 56.75,   dec: 24.117,  dly: 444,     dia: 43,    kind: "cluster",  hue: 215, note: "young, hot, and still wrapped in dust" },
  { name: "Hyades",             m: "",     ra: 66.75,   dec: 15.867,  dly: 153,     dia: 60,    kind: "cluster",  hue: 40 },
  { name: "Helix Nebula",       m: "NGC 7293", ra: 337.411, dec: -20.837, dly: 655, dia: 2.9,   kind: "nebula",   hue: 175, note: "a Sun-like star's last breath" },
  { name: "Orion Nebula",       m: "M42",  ra: 83.822,  dec: -5.391,  dly: 1344,    dia: 24,    kind: "nebula",   hue: 340, note: "a nursery: 700 stars forming" },
  { name: "Dumbbell Nebula",    m: "M27",  ra: 299.902, dec: 22.721,  dly: 1360,    dia: 2.9,   kind: "nebula",   hue: 160 },
  { name: "Ring Nebula",        m: "M57",  ra: 283.396, dec: 33.029,  dly: 2570,    dia: 2.6,   kind: "nebula",   hue: 190 },
  { name: "Lagoon Nebula",      m: "M8",   ra: 270.904, dec: -24.387, dly: 4100,    dia: 110,   kind: "nebula",   hue: 345 },
  { name: "Rosette Nebula",     m: "NGC 2237", ra: 97.983, dec: 4.950, dly: 5200,   dia: 130,   kind: "nebula",   hue: 350 },
  { name: "Crab Nebula",        m: "M1",   ra: 83.633,  dec: 22.015,  dly: 6500,    dia: 11,    kind: "remnant",  hue: 285, note: "the supernova of 1054, still expanding" },
  { name: "Eagle Nebula",       m: "M16",  ra: 274.700, dec: -13.807, dly: 7000,    dia: 70,    kind: "nebula",   hue: 20,  note: "the Pillars of Creation" },
  { name: "Carina Nebula",      m: "NGC 3372", ra: 161.265, dec: -59.867, dly: 7500, dia: 460,  kind: "nebula",   hue: 355 },
  { name: "Omega Centauri",     m: "NGC 5139", ra: 201.697, dec: -47.480, dly: 15800, dia: 150, kind: "globular", hue: 45,  note: "ten million stars; probably a stripped galaxy core" },
  { name: "Hercules Cluster",   m: "M13",  ra: 250.423, dec: 36.460,  dly: 22200,   dia: 145,  kind: "globular", hue: 45 },
  { name: "Sagittarius A*",     m: "",     ra: 266.417, dec: -29.008, dly: 26670,   dia: 0.001, kind: "blackhole", mass: 4.3e6, note: "the galactic centre" },

  // ── the Local Group ─────────────────────────────────────────────────
  { name: "Large Magellanic Cloud", m: "", ra: 80.894, dec: -69.756, dly: 163000,   dia: 14000, kind: "irregular", n: 1, note: "a satellite galaxy, naked-eye from the south" },
  { name: "Small Magellanic Cloud", m: "", ra: 13.187, dec: -72.829, dly: 200000,   dia: 7000,  kind: "irregular", n: 1 },
  { name: "Andromeda",          m: "M31",  ra: 10.685,  dec: 41.269,  dly: 2537000, dia: 152000, kind: "spiral",   n: 1, pitch: 10, note: "3.4° wide — seven full moons" },
  { name: "Triangulum",         m: "M33",  ra: 23.462,  dec: 30.660,  dly: 2730000, dia: 60000,  kind: "spiral",   n: 1, pitch: 22 },

  // ── beyond ──────────────────────────────────────────────────────────
  { name: "Bode's Galaxy",      m: "M81",  ra: 148.888, dec: 69.065,  dly: 11800000, dia: 90000, kind: "spiral",   n: 1, pitch: 13 },
  { name: "Cigar Galaxy",       m: "M82",  ra: 148.970, dec: 69.680,  dly: 11500000, dia: 37000, kind: "irregular", n: 1, note: "starburst — forming stars ten times too fast" },
  { name: "Centaurus A",        m: "NGC 5128", ra: 201.365, dec: -43.019, dly: 12000000, dia: 60000, kind: "elliptical", n: 4 },
  { name: "Sculptor Galaxy",    m: "NGC 253", ra: 11.888, dec: -25.288, dly: 11400000, dia: 90000, kind: "spiral",  n: 1, pitch: 18 },
  { name: "Whirlpool Galaxy",   m: "M51",  ra: 202.470, dec: 47.195,  dly: 23000000, dia: 76000, kind: "spiral",   n: 1, pitch: 20 },
  { name: "Sombrero Galaxy",    m: "M104", ra: 189.998, dec: -11.623, dly: 29300000, dia: 50000, kind: "spiral",   n: 3, pitch: 8 },
  { name: "Virgo A",            m: "M87",  ra: 187.706, dec: 12.391,  dly: 53500000, dia: 240000, kind: "elliptical", n: 4, mass: 6.5e9, note: "the black hole the EHT photographed" },
];
