/* ══════════════════════════════════════════════════════════════════════
   stars-near.js — the actual solar neighbourhood.

   ═══════════════════ EDITABLE — this is a star chart ═══════════════════
   One row per star. Positions are as published, J2000, so you can check
   any line of this file against a real catalogue:

     ra    right ascension, degrees      (RA 14h 29m 43s → 217.4289)
     dec   declination, degrees
     plx   parallax, milliarcseconds     distance[pc] = 1000 / plx
     sp    spectral type
     v     apparent visual magnitude
     note  optional; shown on the label when you fly close

   Cartesian light-years are worked out once at load (systems.js), never
   per frame:  d = 1/π,  x = d·cos δ·cos α,  y = d·cos δ·sin α,  z = d·sin δ

   Sources: RECONS 100-nearest list, Gliese–Jahreiss CNS, Hipparcos, Gaia
   DR3. Distances quoted in comments are light-years.

   Count the M's. Twenty-two of the thirty nearest stars are red dwarfs —
   that is not a stylistic choice, that is the neighbourhood.
   ══════════════════════════════════════════════════════════════════════ */
window.SF_STARS_NEAR = [
  { name: "Proxima Centauri", ra: 217.4289, dec: -62.6795, plx: 768.50, sp: "M5.5V", v: 11.13, note: "the nearest star" },   // 4.246
  { name: "Alpha Centauri A", ra: 219.9021, dec: -60.8340, plx: 754.81, sp: "G2V",   v: -0.01, note: "the Sun's twin" },     // 4.365
  { name: "Alpha Centauri B", ra: 219.8960, dec: -60.8375, plx: 754.81, sp: "K1V",   v: 1.33 },
  { name: "Barnard's Star",   ra: 269.4521, dec: 4.6933,   plx: 546.98, sp: "M4V",   v: 9.53, note: "fastest proper motion known" }, // 5.963
  { name: "Luhman 16 A",      ra: 162.3287, dec: -53.3197, plx: 501.6,  sp: "L7.5",  v: 16.9, note: "brown dwarf pair" },    // 6.50
  { name: "Luhman 16 B",      ra: 162.3287, dec: -53.3197, plx: 501.6,  sp: "T0.5",  v: 17.0 },
  { name: "WISE 0855-0714",   ra: 133.7860, dec: -7.2446,  plx: 439.0,  sp: "Y4",    v: 25.0, note: "coldest known: 250 K" }, // 7.43
  { name: "Wolf 359",         ra: 164.1204, dec: 7.0144,   plx: 415.18, sp: "M6V",   v: 13.44 },  // 7.86
  { name: "Lalande 21185",    ra: 165.8341, dec: 35.9699,  plx: 392.75, sp: "M2V",   v: 7.52 },   // 8.307
  { name: "Sirius A",         ra: 101.2872, dec: -16.7161, plx: 379.21, sp: "A1V",   v: -1.46, note: "brightest star in the sky" }, // 8.611
  { name: "Sirius B",         ra: 101.2872, dec: -16.7161, plx: 379.21, sp: "DA2",   v: 8.44, note: "white dwarf, Earth-sized" },
  { name: "Luyten 726-8 A",   ra: 24.7593,  dec: -17.9500, plx: 373.70, sp: "M5.5V", v: 12.54 },  // 8.73
  { name: "Luyten 726-8 B",   ra: 24.7593,  dec: -17.9500, plx: 373.70, sp: "M6V",   v: 12.99, note: "UV Ceti — the flare star" },
  { name: "Teegarden's Star", ra: 43.2542,  dec: 16.8811,  plx: 260.98, sp: "M7V",   v: 15.14, note: "two temperate planets" }, // 12.50
  { name: "Ross 154",         ra: 282.4556, dec: -23.8363, plx: 336.12, sp: "M3.5V", v: 10.44 },  // 9.70
  { name: "Ross 248",         ra: 355.4795, dec: 44.1785,  plx: 316.48, sp: "M5V",   v: 12.29 },  // 10.30
  { name: "Epsilon Eridani",  ra: 53.2327,  dec: -9.4583,  plx: 311.37, sp: "K2V",   v: 3.73, note: "young star, debris disk" }, // 10.475
  { name: "Lacaille 9352",    ra: 346.4667, dec: -35.8533, plx: 305.26, sp: "M0.5V", v: 7.34 },   // 10.72
  { name: "Ross 128",         ra: 176.9375, dec: 0.8047,   plx: 296.30, sp: "M4V",   v: 11.13 },  // 11.007
  { name: "EZ Aquarii A",     ra: 340.6693, dec: -16.9917, plx: 289.50, sp: "M5V",   v: 13.33 },  // 11.27
  { name: "61 Cygni A",       ra: 316.7248, dec: 38.7492,  plx: 286.15, sp: "K5V",   v: 5.21, note: "first stellar parallax, 1838" }, // 11.40
  { name: "61 Cygni B",       ra: 316.7300, dec: 38.7400,  plx: 286.15, sp: "K7V",   v: 6.03 },
  { name: "Procyon A",        ra: 114.8255, dec: 5.2250,   plx: 284.56, sp: "F5IV-V", v: 0.34 },  // 11.46
  { name: "Procyon B",        ra: 114.8255, dec: 5.2250,   plx: 284.56, sp: "DQZ",   v: 10.70 },
  { name: "Struve 2398 A",    ra: 282.6875, dec: 59.6289,  plx: 283.84, sp: "M3V",   v: 8.90 },   // 11.49
  { name: "Struve 2398 B",    ra: 282.6900, dec: 59.6300,  plx: 283.84, sp: "M3.5V", v: 9.69 },
  { name: "Groombridge 34 A", ra: 4.5953,   dec: 44.0231,  plx: 280.70, sp: "M1.5V", v: 8.08 },   // 11.62
  { name: "Groombridge 34 B", ra: 4.5953,   dec: 44.0231,  plx: 280.70, sp: "M3.5V", v: 11.06 },
  { name: "DX Cancri",        ra: 129.0106, dec: 26.7767,  plx: 275.80, sp: "M6.5V", v: 14.78 },  // 11.83
  { name: "Epsilon Indi",     ra: 330.8400, dec: -56.7861, plx: 274.80, sp: "K5V",   v: 4.69, note: "brown dwarf companions" }, // 11.87
  { name: "Tau Ceti",         ra: 26.0170,  dec: -15.9375, plx: 273.81, sp: "G8V",   v: 3.50, note: "closest single Sun-like star" }, // 11.91
  { name: "GJ 1061",          ra: 53.9958,  dec: -44.5111, plx: 272.00, sp: "M5.5V", v: 13.03 },  // 11.99
  { name: "YZ Ceti",          ra: 17.9646,  dec: -16.9942, plx: 269.36, sp: "M4.5V", v: 12.03 },  // 12.11
  { name: "Luyten's Star",    ra: 111.8500, dec: 5.2256,   plx: 263.99, sp: "M3.5V", v: 9.86 },   // 12.35
  { name: "Kapteyn's Star",   ra: 77.9192,  dec: -45.0164, plx: 254.20, sp: "M1.5V", v: 8.85, note: "halo star, 11 Gyr old" }, // 12.83
  { name: "Lacaille 8760",    ra: 319.3117, dec: -38.8672, plx: 251.90, sp: "M0V",   v: 6.67 },   // 12.95
  { name: "SCR 1845-6357",    ra: 281.4000, dec: -63.9578, plx: 249.90, sp: "M8.5V", v: 17.4 },   // 13.05
  { name: "Kruger 60 A",      ra: 341.7208, dec: 57.6975,  plx: 249.40, sp: "M3V",   v: 9.79 },   // 13.08
  { name: "Kruger 60 B",      ra: 341.7208, dec: 57.6975,  plx: 249.40, sp: "M4V",   v: 11.41 },
  { name: "Ross 614 A",       ra: 99.6417,  dec: -2.8117,  plx: 244.40, sp: "M4.5V", v: 11.15 },  // 13.35
  { name: "Wolf 1061",        ra: 251.6667, dec: -12.6614, plx: 234.50, sp: "M3V",   v: 10.07, note: "three planets" }, // 13.91
  { name: "Van Maanen's Star", ra: 12.3167, dec: 5.3928,   plx: 232.50, sp: "DZ7",   v: 12.38, note: "nearest solitary white dwarf" }, // 14.03
  { name: "Gliese 1",         ra: 1.3542,   dec: -37.3572, plx: 230.40, sp: "M1.5V", v: 8.55 },   // 14.16
  { name: "Wolf 424 A",       ra: 190.2333, dec: 9.0122,   plx: 227.90, sp: "M5.5V", v: 13.18 },  // 14.31
  { name: "TZ Arietis",       ra: 42.1583,  dec: 17.0703,  plx: 226.90, sp: "M4.5V", v: 12.27 },  // 14.37
  { name: "Gliese 687",       ra: 264.1083, dec: 68.3389,  plx: 220.40, sp: "M3V",   v: 9.17 },   // 14.80
  { name: "LHS 292",          ra: 158.6875, dec: -11.2969, plx: 220.30, sp: "M6.5V", v: 15.60 },  // 14.81
  { name: "Gliese 674",       ra: 262.1625, dec: -46.8931, plx: 220.20, sp: "M3V",   v: 9.36 },   // 14.81
  { name: "LP 145-141",       ra: 176.4542, dec: -64.8433, plx: 216.40, sp: "DQ6",   v: 11.50 },  // 15.07
  { name: "Gliese 876",       ra: 343.3208, dec: -14.2639, plx: 214.00, sp: "M4V",   v: 10.17, note: "four planets" }, // 15.24
  { name: "GJ 1245 A",        ra: 297.4292, dec: 44.3811,  plx: 213.00, sp: "M5.5V", v: 13.46 },  // 15.31
  { name: "LHS 288",          ra: 160.6167, dec: -57.1683, plx: 208.00, sp: "M5.5V", v: 13.90 },  // 15.68
  { name: "Gliese 412 A",     ra: 165.9042, dec: 43.5217,  plx: 205.20, sp: "M1V",   v: 8.77 },   // 15.90
  { name: "AD Leonis",        ra: 154.9013, dec: 19.8700,  plx: 201.40, sp: "M3V",   v: 9.32, note: "violent flare star" }, // 16.19
  { name: "Gliese 832",       ra: 323.3917, dec: -49.0094, plx: 201.40, sp: "M2V",   v: 8.66 },   // 16.19
  { name: "40 Eridani A",     ra: 63.8179,  dec: -7.6528,  plx: 199.60, sp: "K0.5V", v: 4.43, note: "Vulcan, in the fiction" }, // 16.34
  { name: "40 Eridani B",     ra: 63.8100,  dec: -7.6520,  plx: 199.60, sp: "DA4",   v: 9.52 },
  { name: "40 Eridani C",     ra: 63.8100,  dec: -7.6520,  plx: 199.60, sp: "M4.5V", v: 11.17 },
  { name: "Groombridge 1618", ra: 152.8375, dec: 49.8069,  plx: 199.50, sp: "K7V",   v: 6.59 },   // 16.35
  { name: "EV Lacertae",      ra: 342.5458, dec: 44.3339,  plx: 198.10, sp: "M3.5V", v: 10.09 },  // 16.47
  { name: "GJ 682",           ra: 265.9583, dec: -44.3186, plx: 196.90, sp: "M4V",   v: 10.95 },  // 16.57
  { name: "70 Ophiuchi A",    ra: 271.3625, dec: 2.5006,   plx: 195.20, sp: "K0V",   v: 4.03 },   // 16.71
  { name: "70 Ophiuchi B",    ra: 271.3625, dec: 2.5006,   plx: 195.20, sp: "K5V",   v: 6.00 },
  { name: "Altair",           ra: 297.6958, dec: 8.8683,   plx: 194.95, sp: "A7V",   v: 0.76, note: "spins in 9 hours; visibly oblate" }, // 16.73
  { name: "Gliese 570 A",     ra: 220.4708, dec: -21.6603, plx: 169.90, sp: "K4V",   v: 5.72 },   // 19.20
  { name: "Sigma Draconis",   ra: 293.0900, dec: 69.6611,  plx: 173.40, sp: "K0V",   v: 4.68 },   // 18.80
  { name: "Eta Cassiopeiae A", ra: 12.2764, dec: 57.8156,  plx: 167.98, sp: "F9V",   v: 3.44 },   // 19.42
  { name: "36 Ophiuchi A",    ra: 258.8375, dec: -26.6011, plx: 167.70, sp: "K2V",   v: 5.07 },   // 19.45
  { name: "82 Eridani",       ra: 48.0192,  dec: -43.0697, plx: 165.50, sp: "G8V",   v: 4.26 },   // 19.71
  { name: "Delta Pavonis",    ra: 302.1817, dec: -66.1820, plx: 163.70, sp: "G8IV",  v: 3.56 },   // 19.92
  { name: "Beta Hydri",       ra: 6.4381,   dec: -77.2543, plx: 133.80, sp: "G0V",   v: 2.80, note: "the Sun in 6 billion years" }, // 24.4
  { name: "Vega",             ra: 279.2347, dec: 38.7837,  plx: 130.23, sp: "A0V",   v: 0.03, note: "defines magnitude zero" }, // 25.04
  { name: "Fomalhaut",        ra: 344.4127, dec: -29.6222, plx: 129.81, sp: "A3V",   v: 1.16, note: "sculpted debris ring" }, // 25.13
  { name: "61 Virginis",      ra: 199.6013, dec: -18.3111, plx: 117.30, sp: "G7V",   v: 4.74 },   // 27.8
  { name: "Zeta Tucanae",     ra: 5.0208,   dec: -64.8747, plx: 116.40, sp: "F9.5V", v: 4.23 },   // 28.0
];
