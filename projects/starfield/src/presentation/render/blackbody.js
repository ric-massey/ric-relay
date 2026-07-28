/* ══════════════════════════════════════════════════════════════════════
   blackbody.js — what colour a star actually is.

   Visual Perception §3: stars are not the saturated jewels of space art.
   A star's colour is its Planckian locus colour, and even the reddest ones
   are pale, because the eye's colour response at the low light levels of a
   night sky is weak. Betelgeuse is not red; it is a faintly warm white
   that a long exposure reveals as orange.

   Approach: a tabulated Planckian locus in sRGB (Mitchell Charity's
   blackbody colour table, normalised so the brightest channel is 1), with
   linear interpolation between entries. That table is derived from the CIE
   colour-matching functions rather than guessed, which is why it is used
   here instead of the usual three-line "temperature to RGB" hack.
   ══════════════════════════════════════════════════════════════════════ */

// [K, r, g, b] at 1000 K intervals, sRGB, normalised to max component = 1.
const LOCUS = [
  [1000, 1.000, 0.221, 0.000],
  [1500, 1.000, 0.402, 0.000],
  [2000, 1.000, 0.541, 0.164],
  [2500, 1.000, 0.657, 0.364],
  [3000, 1.000, 0.740, 0.517],
  [3500, 1.000, 0.804, 0.639],
  [4000, 1.000, 0.855, 0.740],
  [4500, 1.000, 0.896, 0.824],
  [5000, 1.000, 0.930, 0.896],
  [5500, 1.000, 0.959, 0.960],
  [6000, 0.973, 0.966, 1.000],
  [6500, 0.921, 0.938, 1.000],
  [7000, 0.879, 0.914, 1.000],
  [8000, 0.813, 0.874, 1.000],
  [9000, 0.765, 0.844, 1.000],
  [10000, 0.728, 0.820, 1.000],
  [12000, 0.677, 0.786, 1.000],
  [15000, 0.630, 0.753, 1.000],
  [20000, 0.586, 0.720, 1.000],
  [30000, 0.545, 0.688, 1.000],
  [40000, 0.525, 0.671, 1.000],
];

/** sRGB colour of a blackbody at temperature `k`, as {r,g,b} in 0..1. */
export function blackbodyRgb(k) {
  const t = Math.max(LOCUS[0][0], Math.min(LOCUS[LOCUS.length - 1][0], k));
  let i = 0;
  while (i < LOCUS.length - 2 && LOCUS[i + 1][0] < t) i++;
  const [t0, r0, g0, b0] = LOCUS[i];
  const [t1, r1, g1, b1] = LOCUS[i + 1];
  const f = (t - t0) / (t1 - t0);
  return {
    r: r0 + (r1 - r0) * f,
    g: g0 + (g1 - g0) * f,
    b: b0 + (b1 - b0) * f,
  };
}

/**
 * Effective temperature from a spectral type string like "K1.5III" or "M3Ia".
 * Class `K` — constrained: the mapping from letter and subclass to
 * temperature is a published main-sequence calibration, and giants of the
 * same letter run a little cooler. Good to roughly ±300 K, which is well
 * inside the colour resolution of a two-pixel star.
 */
const CLASS_TEMPS = { O: 40000, B: 20000, A: 8750, F: 6750, G: 5600, K: 4400, M: 3200 };
const NEXT = { O: "B", B: "A", A: "F", F: "G", G: "K", K: "M", M: null };

/**
 * Effective temperature from the B−V colour index — Ballesteros (2012),
 * EPL 97, 34008:
 *
 *   T = 4600 K × ( 1/(0.92·B−V + 1.70) + 1/(0.92·B−V + 0.62) )
 *
 * Class `C`. This is strictly better than guessing from a spectral-type
 * string: B−V is a *measurement* of the star's colour, taken through two
 * standard filters, whereas a spectral class is a human judgement binned
 * into letters. Where the catalogue gives B−V, this is what is used.
 *
 * The relation is derived for stars treated as blackbodies and is good to
 * a few per cent across the main sequence. It is poor for heavily reddened
 * or strongly non-thermal objects, which the naked-eye sky has few of.
 */
export function colourIndexToTemp(bv) {
  const x = 0.92 * bv;
  return 4600 * (1 / (x + 1.7) + 1 / (x + 0.62));
}

export function spectralTypeToTemp(sp) {
  if (!sp) return 5600;
  const m = /^([OBAFGKM])(\d(?:\.\d)?)?/.exec(sp.trim().toUpperCase());
  if (!m) return 5600;
  const letter = m[1];
  const sub = m[2] === undefined ? 5 : parseFloat(m[2]);
  const hot = CLASS_TEMPS[letter];
  const nextLetter = NEXT[letter];
  const cool = nextLetter ? CLASS_TEMPS[nextLetter] : hot * 0.8;
  // Subclass 0 is the hot end of the letter, 9 the cool end.
  return hot + (cool - hot) * (sub / 10);
}

/**
 * Desaturate toward white by `amount`. Visual Perception §3.3: at the light
 * levels of a real night sky the cone response is weak, so stars look far
 * less coloured than a photograph of them. This is applied to the star
 * field rather than pretending the catalogue colours are what you see.
 */
export function desaturate({ r, g, b }, amount) {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return {
    r: r + (y - r) * amount,
    g: g + (y - g) * amount,
    b: b + (y - b) * amount,
  };
}
