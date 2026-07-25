/* ══════════════════════════════════════════════════════════════════════
   color.js — Planck's law → CIE XYZ → sRGB, computed at load.

   No colour in this game is picked by eye. A star's colour is what a
   blackbody at its effective temperature actually looks like:

     B_λ(T) = (2hc² / λ⁵) / (exp(hc / λkT) − 1)

   integrated against the CIE 1931 colour-matching functions x̄ ȳ z̄ over
   380–780 nm, converted to linear sRGB and gamma-encoded.

   The table also stores `vis`, the fraction of the blackbody's *total*
   power that lands in the visible band, normalised to 1 at the Sun's
   5772 K. That one number is what makes the relativistic starbow work
   for free: Doppler-shift a star to T' = D·T and look up the same table,
   and stars boosted into the ultraviolet or dragged into the infrared go
   dark on their own, because their light genuinely left the visible band.

   The table is log-spaced so it can cover both ends of that shift — from
   250 K (a star redshifted behind you at γ = 12) up to 20 million K (the
   CMB dead ahead at γ = 10⁶). Resolution near stellar temperatures is
   better than 80 K, and building the whole thing costs about a
   millisecond.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;

  const LAMBDA_MIN = 380e-9;
  const LAMBDA_MAX = 780e-9;
  const LAMBDA_STEP = 5e-9;

  // Analytic multi-lobe Gaussian fits to the CIE 1931 2° observer
  // (Wyman, Sloan & Shirley 2013). Accurate to well under a percent, and
  // 20 lines instead of a 471-row table.
  function cieX(nm) {
    const t1 = (nm - 442.0) * (nm < 442.0 ? 0.0624 : 0.0374);
    const t2 = (nm - 599.8) * (nm < 599.8 ? 0.0264 : 0.0323);
    const t3 = (nm - 501.1) * (nm < 501.1 ? 0.0490 : 0.0382);
    return 0.362 * Math.exp(-0.5 * t1 * t1)
         + 1.056 * Math.exp(-0.5 * t2 * t2)
         - 0.065 * Math.exp(-0.5 * t3 * t3);
  }
  function cieY(nm) {
    const t1 = (nm - 568.8) * (nm < 568.8 ? 0.0213 : 0.0247);
    const t2 = (nm - 530.9) * (nm < 530.9 ? 0.0613 : 0.0322);
    return 0.821 * Math.exp(-0.5 * t1 * t1)
         + 0.286 * Math.exp(-0.5 * t2 * t2);
  }
  function cieZ(nm) {
    const t1 = (nm - 437.0) * (nm < 437.0 ? 0.0845 : 0.0278);
    const t2 = (nm - 459.0) * (nm < 459.0 ? 0.0385 : 0.0725);
    return 1.217 * Math.exp(-0.5 * t1 * t1)
         + 0.681 * Math.exp(-0.5 * t2 * t2);
  }

  // Spectral radiance of a blackbody, W·sr⁻¹·m⁻³.
  function planck(lambda, T) {
    const a = 2 * K.h * K.c * K.c / Math.pow(lambda, 5);
    const b = K.h * K.c / (lambda * K.kB * T);
    // expm1 keeps the long-wavelength (b → 0) limit from cancelling to zero.
    return a / Math.expm1(b);
  }

  function srgbGamma(u) {
    const v = Math.max(0, Math.min(1, u));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  }

  // Total radiance over all wavelengths, σT⁴/π — the denominator for `vis`.
  function bolometric(T) {
    return K.sigmaSB * T * T * T * T / Math.PI;
  }

  function computeEntry(T) {
    let X = 0, Y = 0, Z = 0;
    for (let lambda = LAMBDA_MIN; lambda <= LAMBDA_MAX + 1e-12; lambda += LAMBDA_STEP) {
      const nm = lambda * 1e9;
      const B = planck(lambda, T);
      X += B * cieX(nm);
      Y += B * cieY(nm);
      Z += B * cieZ(nm);
    }
    // Visible-band power fraction. The dλ and unit factors cancel in the
    // ratio to the 5772 K reference, so only the shape matters here.
    const visRaw = Y * LAMBDA_STEP / bolometric(T);

    // CIE XYZ → linear sRGB (IEC 61966-2-1 primaries, D65).
    let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;

    // Clip negatives back onto the gamut by desaturating toward white
    // rather than truncating, which would swing the hue.
    const floor = Math.min(r, g, b);
    if (floor < 0) { r -= floor; g -= floor; b -= floor; }

    const peak = Math.max(r, g, b);
    if (peak > 0) { r /= peak; g /= peak; b /= peak; }

    return {
      T,
      r: Math.round(255 * srgbGamma(r)),
      g: Math.round(255 * srgbGamma(g)),
      b: Math.round(255 * srgbGamma(b)),
      visRaw,
    };
  }

  // 1,000 K is a real floor, not a convenience. The analytic CIE fits are
  // multi-lobe Gaussians, and below about 1,000 K the blackbody's visible
  // output lives entirely in the far red tail where those Gaussians decay at
  // different rates than the real curves do — ȳ overtakes x̄ and the table
  // starts reporting yellow-green for objects that are, in truth, black.
  // Their visible power is zero down there anyway, so nothing is lost by
  // clamping; what it buys is that a star Doppler-shifted into the infrared
  // fades to deep red and then out, instead of through a colour no blackbody
  // has ever been.
  const T_MIN = 1000;
  const T_MAX = 2e7;
  const STEPS = 768;
  const LOG_MIN = Math.log(T_MIN);
  const LOG_SPAN = Math.log(T_MAX) - LOG_MIN;

  const table = new Array(STEPS + 1);
  for (let i = 0; i <= STEPS; i += 1) {
    table[i] = computeEntry(Math.exp(LOG_MIN + LOG_SPAN * (i / STEPS)));
  }

  // Normalise the visible fraction so the Sun reads 1.0.
  const solarVis = computeEntry(K.tSun).visRaw;
  for (const entry of table) {
    entry.vis = entry.visRaw / solarVis;
    entry.css = `rgb(${entry.r},${entry.g},${entry.b})`;
  }

  function indexFor(T) {
    const clamped = Math.max(T_MIN, Math.min(T_MAX, T));
    return (Math.log(clamped) - LOG_MIN) / LOG_SPAN * STEPS;
  }

  const SFColor = SF.color = {
    tMin: T_MIN,
    tMax: T_MAX,
    entries: table,

    /** Nearest table entry for a temperature in kelvin. */
    at(T) {
      return table[Math.round(indexFor(T))];
    },

    /** `rgb(...)` string for a blackbody at T. */
    css(T) {
      return SFColor.at(T).css;
    },

    /** `rgba(...)` string at a given alpha. */
    rgba(T, alpha) {
      const e = SFColor.at(T);
      return `rgba(${e.r},${e.g},${e.b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
    },

    /**
     * Fraction of a blackbody's total power that falls in the visible band,
     * relative to the Sun. Below ~1,000 K and above ~10⁵ K this collapses
     * toward zero, which is exactly why Doppler-shifted stars vanish.
     */
    visible(T) {
      if (T <= T_MIN) return 0;
      return SFColor.at(T).vis;
    },

    /**
     * Apparent colour and brightness of a blackbody seen with Doppler
     * factor D. Returns the shifted temperature, its colour, and the gain
     * in *visible* flux, which is the D⁴ relativistic beaming multiplied by
     * the change in visible-band fraction.
     */
    shifted(T, D) {
      const Tobs = T * D;
      const restVis = SFColor.visible(T);
      const seenVis = SFColor.visible(Tobs);
      const beaming = D * D * D * D;
      return {
        T: Tobs,
        entry: SFColor.at(Tobs),
        gain: restVis > 0 ? beaming * (seenVis / restVis) : 0,
      };
    },

    /** Wien's displacement law, metres. */
    peakWavelength(T) {
      return K.wienB / T;
    },
  };
})();
