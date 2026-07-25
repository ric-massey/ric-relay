/* ══════════════════════════════════════════════════════════════════════
   stars.js — what kinds of stars exist, and how big and bright they are.

   The original picked uniformly from six hand-chosen colours, which showed
   roughly the *opposite* of the real sky: far too many blue-white stars.
   The real main sequence is overwhelmingly red:

     O ≥33,000 K  0.00003%      F 6,000–7,300 K   3.0%
     B 10–33 kK   0.13%         G 5,300–6,000 K   7.6%
     A 7.3–10 kK  0.61%         K 3,900–5,300 K  12.1%
                                M 2,300–3,900 K  76.5%

   Three quarters of all stars are red dwarfs. Sample from that and the sky
   becomes a haze of faint red embers — and every blue-white star you find
   becomes an event, because it genuinely is rare. Of the thirty nearest
   stars, twenty-two are M dwarfs; the catalogue in data/stars-near.js is
   the proof.

   Physical size follows from mass rather than `75 + random*45`:
     L/L☉ = (M/M☉)^3.5      R/R☉ = (M/M☉)^0.8      t ≈ 10 Gyr·(M/M☉)^−2.5
   An M6 dwarf is 0.1 R☉ and Betelgeuse is ~900 R☉ — a factor of 9,000 that
   the renderer compresses (SF.FUDGE.starRadiusExp) rather than ignores.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const F = SF.FUDGE;

  // Real main-sequence share, and the temperature range of each class.
  const CLASSES = [
    { cls: "O", share: 0.0000003, tLo: 33000, tHi: 45000 },
    { cls: "B", share: 0.0013,    tLo: 10000, tHi: 33000 },
    { cls: "A", share: 0.0061,    tLo: 7300,  tHi: 10000 },
    { cls: "F", share: 0.030,     tLo: 6000,  tHi: 7300 },
    { cls: "G", share: 0.076,     tLo: 5300,  tHi: 6000 },
    { cls: "K", share: 0.121,     tLo: 3900,  tHi: 5300 },
    { cls: "M", share: 0.765,     tLo: 2300,  tHi: 3900 },
  ];
  const CUMULATIVE = [];
  {
    let total = 0;
    for (const entry of CLASSES) total += entry.share;
    let running = 0;
    for (const entry of CLASSES) {
      running += entry.share / total;
      CUMULATIVE.push({ ...entry, upTo: running });
    }
  }

  // Main-sequence anchors: T_eff (K), mass (M☉), radius (R☉), luminosity (L☉).
  // Interpolated in log space, so the 9,000× radius span survives intact.
  const SEQUENCE = [
    { t: 42000, m: 60,   r: 12,   l: 8.0e5 },
    { t: 30000, m: 17.5, r: 7.4,  l: 5.2e4 },
    { t: 15200, m: 5.9,  r: 3.9,  l: 8.3e2 },
    { t: 9790,  m: 2.9,  r: 2.4,  l: 5.4e1 },
    { t: 8180,  m: 2.0,  r: 1.7,  l: 1.4e1 },
    { t: 7300,  m: 1.6,  r: 1.5,  l: 6.5 },
    { t: 6650,  m: 1.4,  r: 1.3,  l: 3.2 },
    { t: 5940,  m: 1.05, r: 1.06, l: 1.26 },
    { t: 5772,  m: 1.0,  r: 1.0,  l: 1.0 },
    { t: 5150,  m: 0.79, r: 0.85, l: 0.40 },
    { t: 4410,  m: 0.67, r: 0.72, l: 0.15 },
    { t: 3840,  m: 0.51, r: 0.60, l: 0.077 },
    { t: 3520,  m: 0.40, r: 0.50, l: 0.029 },
    { t: 3170,  m: 0.21, r: 0.32, l: 0.0076 },
    { t: 2600,  m: 0.10, r: 0.13, l: 0.0008 },
    { t: 2000,  m: 0.075, r: 0.10, l: 0.00015 },
  ];

  // Spectral-class temperature anchors, subclass 0 → subclass 9.
  const CLASS_TEMPS = {
    O: [50000, 33000], B: [30000, 10500], A: [9800, 7400], F: [7300, 6000],
    G: [5940, 5300],   K: [5150, 3900],   M: [3840, 2400], L: [2200, 1300],
    T: [1300, 600],    Y: [500, 250],
  };

  function lerpLog(a, b, u) { return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * u); }

  const Stars = SF.stars = {
    classes: CLASSES,

    /** Draw a spectral class from the real main-sequence distribution. */
    sampleClass(rng = Math.random) {
      const u = rng();
      for (const entry of CUMULATIVE) if (u <= entry.upTo) return entry;
      return CUMULATIVE[CUMULATIVE.length - 1];
    },

    /**
     * A whole star, sampled from the real population. Temperature is drawn
     * log-uniformly inside the class, which leans cool — correctly, since
     * the mass function keeps falling across every class.
     */
    sample(rng = Math.random) {
      const entry = Stars.sampleClass(rng);
      const teff = lerpLog(entry.tLo, entry.tHi, Math.pow(rng(), 1.7));
      return Stars.fromTemperature(teff, entry.cls, rng);
    },

    /** Main-sequence mass, radius and luminosity implied by an effective temperature. */
    fromTemperature(teff, cls, rng = Math.random) {
      const seq = Stars.interpolateSequence(teff);
      const subclass = Stars.subclassFor(teff, cls);
      return {
        teff,
        cls: cls || Stars.classFor(teff),
        subclass,
        type: `${cls || Stars.classFor(teff)}${subclass}V`,
        mass: seq.m,
        radius: seq.r,
        lum: seq.l,
        // 10 Gyr × (M/M☉)^−2.5 — a red dwarf outlives the universe several
        // times over; an O star is gone in a couple of million years.
        lifetimeGyr: 10 * Math.pow(seq.m, -2.5),
        phase: rng() * Math.PI * 2,
      };
    },

    interpolateSequence(teff) {
      const T = Math.max(1500, Math.min(50000, teff));
      if (T >= SEQUENCE[0].t) return { ...SEQUENCE[0] };
      const last = SEQUENCE[SEQUENCE.length - 1];
      if (T <= last.t) return { ...last };
      for (let i = 0; i < SEQUENCE.length - 1; i += 1) {
        const hi = SEQUENCE[i], lo = SEQUENCE[i + 1];
        if (T <= hi.t && T >= lo.t) {
          const u = (Math.log(T) - Math.log(lo.t)) / (Math.log(hi.t) - Math.log(lo.t));
          return {
            m: lerpLog(lo.m, hi.m, u),
            r: lerpLog(lo.r, hi.r, u),
            l: lerpLog(lo.l, hi.l, u),
          };
        }
      }
      return { ...last };
    },

    classFor(teff) {
      for (const entry of CLASSES) if (teff >= entry.tLo) return entry.cls;
      return "M";
    },

    subclassFor(teff, cls) {
      const range = CLASS_TEMPS[cls || Stars.classFor(teff)];
      if (!range) return 5;
      const [hot, cool] = range;
      const u = (hot - teff) / (hot - cool);
      return Math.max(0, Math.min(9, Math.round(u * 9)));
    },

    /**
     * Effective temperature from a catalogue spectral type such as "M5.5V",
     * "G2V", "K1V" or "DA2". White dwarfs use the real temperature index,
     * T_eff = 50,400 / n, which is what the digit in "DA2" actually means.
     */
    temperatureFromType(sp) {
      if (!sp) return 5000;
      const text = String(sp).trim().toUpperCase();
      const white = text.match(/^D[ABCOQXZ]*\s*([\d.]+)/);
      if (white) return 50400 / Math.max(0.5, parseFloat(white[1]));
      const match = text.match(/^([OBAFGKMLTY])\s*([\d.]*)/);
      if (!match) return 5000;
      const range = CLASS_TEMPS[match[1]];
      if (!range) return 5000;
      const sub = match[2] === "" ? 5 : Math.max(0, Math.min(9.9, parseFloat(match[2])));
      const [hot, cool] = range;
      return hot + (cool - hot) * (sub / 10);
    },

    /** True if a catalogue type is a white dwarf. */
    isWhiteDwarf(sp) { return /^D/i.test(String(sp || "").trim()); },

    /**
     * Rendered radius, in light-years. Real stellar radii span 9,000× and
     * are all far below a pixel, so this compresses the range with a power
     * law: a solar-radius star gets 0.05 ly, an M6 dwarf ~0.021, Betelgeuse
     * ~0.73. Ordering and ratios survive; absolute scale does not. That
     * inflation is ~7×10⁵ and is declared in the ledger.
     */
    visualRadiusLy(radiusSolar) {
      return F.starRadiusLy * Math.pow(Math.max(1e-3, radiusSolar), F.starRadiusExp);
    },

    /**
     * Apparent brightness, as a plain inverse-square flux relative to the
     * Sun seen from one light-year. Used raw for alpha after beaming.
     */
    fluxAt(lumSolar, distanceLy) {
      return lumSolar / Math.max(1e-6, distanceLy * distanceLy);
    },

    /** Apparent visual magnitude from luminosity and distance. */
    apparentMagnitude(lumSolar, distanceLy) {
      const pc = Math.max(1e-4, distanceLy / K.pcLy);
      const absolute = 4.83 - 2.5 * Math.log10(Math.max(1e-9, lumSolar));
      return absolute + 5 * (Math.log10(pc) - 1);
    },

    /** Absolute magnitude → luminosity, for catalogue rows that give only V and distance. */
    luminosityFromMagnitude(vMag, distanceLy) {
      const pc = Math.max(1e-4, distanceLy / K.pcLy);
      const absolute = vMag - 5 * (Math.log10(pc) - 1);
      return Math.pow(10, (4.83 - absolute) / 2.5);
    },

    /**
     * Frost line and habitable zone, both scaling as √(L/L☉).
     *   a_snow ≈ 2.7·√(L/L☉) AU     r_HZ ≈ 1.0·√(L/L☉) AU
     * For the Sun that is 2.7 AU — exactly the asteroid belt — and 1 AU.
     * The formula validates itself, and then it gives M-dwarf systems a
     * frost line at 0.12 AU, which is why they come out tiny and packed.
     */
    frostLineAU(lumSolar) { return 2.7 * Math.sqrt(Math.max(1e-8, lumSolar)); },
    habitableZoneAU(lumSolar) { return 1.0 * Math.sqrt(Math.max(1e-8, lumSolar)); },
  };
})();
