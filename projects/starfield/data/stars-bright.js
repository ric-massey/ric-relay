/* ══════════════════════════════════════════════════════════════════════
   stars-bright.js — landmarks you can steer toward.

   ═══════════════════ EDITABLE — famous distant stars ═══════════════════
   Same coordinate columns as stars-near.js, plus two that matter once a
   star leaves the main sequence, because then temperature no longer tells
   you how big it is:

     rsun   radius in solar radii   (Betelgeuse is ~900; the Sun is 1)
     lsun   luminosity in solar luminosities

   Without those, a red supergiant would render as a red dwarf. Betelgeuse
   and an M6 dwarf have almost the same surface temperature and differ in
   radius by a factor of seven thousand.

   Sources: Hipparcos, Gaia DR3, and the usual published interferometric
   radii. Distances in the comments are light-years.
   ══════════════════════════════════════════════════════════════════════ */
window.SF_STARS_BRIGHT = [
  { name: "Sirius",      ra: 101.2872, dec: -16.7161, plx: 379.21, sp: "A1V",     v: -1.46, rsun: 1.71,  lsun: 25.4 },     // 8.6
  { name: "Altair",      ra: 297.6958, dec: 8.8683,   plx: 194.95, sp: "A7V",     v: 0.76,  rsun: 1.79,  lsun: 10.6 },     // 16.7
  { name: "Vega",        ra: 279.2347, dec: 38.7837,  plx: 130.23, sp: "A0V",     v: 0.03,  rsun: 2.36,  lsun: 40.1 },     // 25.0
  { name: "Arcturus",    ra: 213.9153, dec: 19.1824,  plx: 88.83,  sp: "K1.5III", v: -0.05, rsun: 25.4,  lsun: 170 },      // 36.7
  { name: "Capella",     ra: 79.1723,  dec: 45.9980,  plx: 76.20,  sp: "G8III",   v: 0.08,  rsun: 11.98, lsun: 78.7 },     // 42.8
  { name: "Pollux",      ra: 116.3290, dec: 28.0262,  plx: 96.54,  sp: "K0III",   v: 1.14,  rsun: 8.8,   lsun: 43 },       // 33.8
  { name: "Castor",      ra: 113.6495, dec: 31.8883,  plx: 64.12,  sp: "A1V",     v: 1.58,  rsun: 2.4,   lsun: 52 },       // 50.9
  { name: "Aldebaran",   ra: 68.9802,  dec: 16.5093,  plx: 49.97,  sp: "K5III",   v: 0.86,  rsun: 45.1,  lsun: 439 },      // 65.3
  { name: "Regulus",     ra: 152.0930, dec: 11.9672,  plx: 41.13,  sp: "B8IV",    v: 1.40,  rsun: 3.8,   lsun: 316 },      // 79.3
  { name: "Mizar",       ra: 200.9814, dec: 54.9254,  plx: 39.36,  sp: "A2V",     v: 2.23,  rsun: 2.4,   lsun: 33 },       // 82.9
  { name: "Gacrux",      ra: 187.7915, dec: -57.1133, plx: 36.83,  sp: "M3.5III", v: 1.63,  rsun: 120,   lsun: 820 },      // 88.6
  { name: "Algol",       ra: 47.0422,  dec: 40.9556,  plx: 36.27,  sp: "B8V",     v: 2.12,  rsun: 2.9,   lsun: 182 },      // 90
  { name: "Achernar",    ra: 24.4285,  dec: -57.2367, plx: 23.39,  sp: "B6V",     v: 0.46,  rsun: 7.3,   lsun: 3150 },     // 139
  { name: "Bellatrix",   ra: 81.2828,  dec: 6.3497,   plx: 12.92,  sp: "B2III",   v: 1.64,  rsun: 5.75,  lsun: 9211 },     // 252
  { name: "Spica",       ra: 201.2983, dec: -11.1613, plx: 13.06,  sp: "B1III",   v: 0.97,  rsun: 7.47,  lsun: 12100 },    // 250
  { name: "Mimosa",      ra: 191.9303, dec: -59.6888, plx: 11.71,  sp: "B0.5III", v: 1.25,  rsun: 8.4,   lsun: 34000 },    // 279
  { name: "Canopus",     ra: 95.9880,  dec: -52.6957, plx: 10.55,  sp: "A9II",    v: -0.74, rsun: 71,    lsun: 10700 },    // 309
  { name: "Acrux",       ra: 186.6496, dec: -63.0991, plx: 10.13,  sp: "B0.5IV",  v: 0.76,  rsun: 7.8,   lsun: 25000 },    // 322
  { name: "Hadar",       ra: 210.9559, dec: -60.3730, plx: 8.32,   sp: "B1III",   v: 0.61,  rsun: 9.0,   lsun: 41700 },    // 392
  { name: "Alcyone",     ra: 56.8712,  dec: 24.1051,  plx: 7.40,   sp: "B7III",   v: 2.87,  rsun: 9.3,   lsun: 2400, note: "brightest of the Pleiades" }, // 440
  { name: "Polaris",     ra: 37.9546,  dec: 89.2641,  plx: 7.54,   sp: "F7Ib",    v: 1.98,  rsun: 37.5,  lsun: 1260, note: "the pole star — for now" },   // 433
  { name: "Betelgeuse",  ra: 88.7929,  dec: 7.4071,   plx: 5.95,   sp: "M1Ia",    v: 0.50,  rsun: 887,   lsun: 126000, note: "will go supernova" },       // 548
  { name: "Antares",     ra: 247.3519, dec: -26.4320, plx: 5.89,   sp: "M1.5Iab", v: 1.06,  rsun: 680,   lsun: 97700 },    // 554
  { name: "Rigel",       ra: 78.6345,  dec: -8.2017,  plx: 3.78,   sp: "B8Ia",    v: 0.13,  rsun: 78.9,  lsun: 120000 },   // 863
  { name: "Naos",        ra: 120.8961, dec: -40.0031, plx: 3.02,   sp: "O4If",    v: 2.25,  rsun: 14,    lsun: 550000, note: "an O star — 0.00003% of stars" }, // 1080
  { name: "Mintaka",     ra: 83.0016,  dec: -0.2991,  plx: 4.71,   sp: "O9.5II",  v: 2.23,  rsun: 16.5,  lsun: 190000 },   // 692
  { name: "Alnitak",     ra: 85.1897,  dec: -1.9426,  plx: 4.43,   sp: "O9.5Ib",  v: 1.77,  rsun: 20,    lsun: 250000 },   // 736
  { name: "Wezen",       ra: 107.0979, dec: -26.3932, plx: 2.03,   sp: "F8Ia",    v: 1.83,  rsun: 215,   lsun: 82000 },    // 1600
  { name: "Alnilam",     ra: 84.0534,  dec: -1.2019,  plx: 1.65,   sp: "B0Ia",    v: 1.69,  rsun: 32.4,  lsun: 537000 },   // 2000
  { name: "Sadr",        ra: 305.5571, dec: 40.2567,  plx: 1.78,   sp: "F8Ib",    v: 2.23,  rsun: 150,   lsun: 33000 },    // 1800
  { name: "Deneb",       ra: 310.3580, dec: 45.2803,  plx: 2.31,   sp: "A2Ia",    v: 1.25,  rsun: 203,   lsun: 196000, note: "one of the most luminous stars known" }, // 2615
  { name: "VY Canis Majoris", ra: 110.7388, dec: -25.7679, plx: 0.83, sp: "M3II", v: 7.95,  rsun: 1420,  lsun: 270000, note: "big enough to swallow Saturn's orbit" }, // 3900
  { name: "Eta Carinae", ra: 161.2646, dec: -59.6844, plx: 0.44,   sp: "B0Ia",    v: 4.30,  rsun: 240,   lsun: 5000000, note: "erupted in 1843; still here" }, // 7500
  { name: "UY Scuti",    ra: 285.6272, dec: -12.4491, plx: 0.64,   sp: "M4Ia",    v: 9.00,  rsun: 1708,  lsun: 340000 },   // 5100
];
