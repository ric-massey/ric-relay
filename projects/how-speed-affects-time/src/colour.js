/* ══════════════════════════════════════════════════════════════════════
   colour.js — temperature in, colour out. Nothing else in this exhibit is
   allowed to decide what something looks like.

   There is no RGB anywhere in the data. A star is a direction, a flux and a
   temperature; this file is the only place a colour is ever produced, and it
   produces it the long way round:

     Planck's law  →  CIE 1931 x̄ ȳ z̄  →  XYZ  →  linear sRGB (D65)

   Built once at load into a table indexed by log T, because T is the only
   thing that varies: a blackbody Doppler-shifted by D is still a blackbody,
   at T′ = D·T. That single fact is what makes the whole relativistic
   transform a one-line change to a temperature.

   Two numbers come out per temperature:

     chroma   linear sRGB with the peak channel at 1 — hue and nothing else.
              Brightness is carried separately and never touches this.
     vis      the fraction of a blackbody's total power that lands in the
              band your eyes can see, relative to the Sun. This is why a
              star redshifted behind you goes dark: its light is still
              there, it has just left the window.

   Colour-matching functions are the multi-lobe Gaussian fits from Wyman,
   Sloan & Shirley (2013), which are well inside a just-noticeable
   difference of the CIE tables and save shipping a data file.

   Gamut is handled by desaturating toward D65, never by clipping a channel.
   Channel clipping is what produces the cartoon-blue and cartoon-orange
   stars in every other star renderer.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const H = 6.62607015e-34;   // Planck constant, J s      (exact, SI 2019)
  const C = 299792458;        // speed of light, m/s       (exact)
  const KB = 1.380649e-23;    // Boltzmann constant, J/K   (exact)
  const SIGMA = 5.670374419e-8; // Stefan–Boltzmann, W m⁻² K⁻⁴

  const LAMBDA_MIN = 360e-9;
  const LAMBDA_MAX = 830e-9;
  const LAMBDA_STEP = 2e-9;

  // Sun's effective temperature — the anchor for `vis`, and the sanity check
  // that the Ballesteros relation is wired up correctly (B−V = 0.65 → 5778 K).
  const T_SUN = 5778;

  /* ── CIE 1931 colour-matching functions (Wyman et al. 2013) ───────────── */

  function g(x, mu, s1, s2) {
    const s = x < mu ? s1 : s2;
    const t = (x - mu) / s;
    return Math.exp(-0.5 * t * t);
  }

  function xBar(nm) {
    return 1.056 * g(nm, 599.8, 37.9, 31.0)
         + 0.362 * g(nm, 442.0, 16.0, 26.7)
         - 0.065 * g(nm, 501.1, 20.4, 26.2);
  }
  function yBar(nm) {
    return 0.821 * g(nm, 568.8, 46.9, 40.5)
         + 0.286 * g(nm, 530.9, 16.3, 31.1);
  }
  function zBar(nm) {
    return 1.217 * g(nm, 437.0, 11.8, 36.0)
         + 0.681 * g(nm, 459.0, 26.0, 13.8);
  }

  /* ── Planck's law ─────────────────────────────────────────────────────
     Spectral radiance per wavelength. The Wien tail overflows long before
     the flux stops mattering, so the exponent is guarded: above ~700 the
     answer is zero to every digit a double can hold, and that zero is the
     correct answer, not a fudge. It is the reason the microwave background
     is invisible until you are moving fast enough to heat it. */
  function planck(lambda, T) {
    const x = (H * C) / (lambda * KB * T);
    if (x > 700) return 0;
    const denom = Math.exp(x) - 1;
    if (denom <= 0) return 0;
    return (2 * H * C * C) / (Math.pow(lambda, 5) * denom);
  }

  /* ── Spectrum → XYZ, and the visible-band fraction ────────────────────── */
  function spectrumToXYZ(T) {
    let X = 0, Y = 0, Z = 0;
    for (let l = LAMBDA_MIN; l <= LAMBDA_MAX; l += LAMBDA_STEP) {
      const B = planck(l, T);
      if (B === 0) continue;
      const nm = l * 1e9;
      X += B * xBar(nm);
      Y += B * yBar(nm);
      Z += B * zBar(nm);
    }
    const w = LAMBDA_STEP;
    return { X: X * w, Y: Y * w, Z: Z * w };
  }

  /* ── XYZ → linear sRGB, D65 ───────────────────────────────────────────── */
  function xyzToLinearRGB(X, Y, Z) {
    return [
       3.2406 * X - 1.5372 * Y - 0.4986 * Z,
      -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
       0.0557 * X - 0.2040 * Y + 1.0570 * Z,
    ];
  }

  /* Desaturate out of gamut, never clip.
     Adding the magnitude of the most negative channel to all three walks the
     colour straight toward the D65 white point in linear sRGB, which is the
     correct desaturation direction and leaves hue alone. */
  function gamutMap(rgb) {
    const lowest = Math.min(rgb[0], rgb[1], rgb[2]);
    if (lowest < 0) {
      rgb = [rgb[0] - lowest, rgb[1] - lowest, rgb[2] - lowest];
    }
    const peak = Math.max(rgb[0], rgb[1], rgb[2]);
    if (peak <= 0) return [0, 0, 0];
    return [rgb[0] / peak, rgb[1] / peak, rgb[2] / peak];
  }

  function chromaFor(T) {
    const { X, Y, Z } = spectrumToXYZ(T);
    if (Y <= 0) return [0, 0, 0];
    return gamutMap(xyzToLinearRGB(X / Y, 1, Z / Y));
  }

  /* ── The table ────────────────────────────────────────────────────────
     Indexed by log₁₀ T. Linear T would spend most of its resolution on
     temperatures nothing has, and none on the 2,000–10,000 K range where
     every star lives.

     Clamped at 10⁵ K at the top: by there the chromaticity is within one
     8-bit step of the Rayleigh–Jeans limit, and above it only brightness
     changes. Cut off at 1 K at the bottom, below which no visible photons
     survive the Wien tail at all. */
  const LOG_MIN = 0;      // 1 K
  const LOG_MAX = 5;      // 100,000 K
  const N = 1024;

  const chroma = new Float32Array(N * 3);
  const visible = new Float32Array(N);

  // Visible-band efficiency, normalised so the Sun is 1. Anchored before the
  // loop so every entry is measured against the same reference.
  const sunXYZ = spectrumToXYZ(T_SUN);
  const sunVis = sunXYZ.Y / (SIGMA * Math.pow(T_SUN, 4));

  for (let i = 0; i < N; i++) {
    const T = Math.pow(10, LOG_MIN + (LOG_MAX - LOG_MIN) * (i / (N - 1)));
    const { X, Y, Z } = spectrumToXYZ(T);
    if (Y > 0) {
      const rgb = gamutMap(xyzToLinearRGB(X / Y, 1, Z / Y));
      chroma[i * 3] = rgb[0];
      chroma[i * 3 + 1] = rgb[1];
      chroma[i * 3 + 2] = rgb[2];
      visible[i] = (Y / (SIGMA * Math.pow(T, 4))) / sunVis;
    }
  }

  const out = [0, 0, 0];

  /** Linear-sRGB chromaticity of a blackbody at T. Peak channel is 1.
      Writes into a reused array — copy it if you need to keep it. */
  function chromaAt(T) {
    if (!(T > 1)) { out[0] = out[1] = out[2] = 0; return out; }
    const lt = Math.log10(Math.min(T, 1e5));
    const f = (lt - LOG_MIN) / (LOG_MAX - LOG_MIN) * (N - 1);
    const i = Math.min(N - 2, Math.max(0, Math.floor(f)));
    const t = f - i;
    const a = i * 3, b = (i + 1) * 3;
    out[0] = chroma[a] + (chroma[b] - chroma[a]) * t;
    out[1] = chroma[a + 1] + (chroma[b + 1] - chroma[a + 1]) * t;
    out[2] = chroma[a + 2] + (chroma[b + 2] - chroma[a + 2]) * t;
    return out;
  }

  /** Fraction of a blackbody's total power landing in the visible band,
      relative to the Sun. Zero below roughly 700 K — which is why stars
      redden and then vanish behind you rather than turning some exotic
      colour. */
  function visAt(T) {
    if (!(T > 1)) return 0;
    if (T >= 1e5) {
      // On the Rayleigh–Jeans tail the visible band's share of σT⁴ falls as
      // 1/T³. Extrapolating beats clamping: at these temperatures the star
      // is genuinely dumping nearly all its power into X-rays.
      const edge = visible[N - 1];
      const r = 1e5 / T;
      return edge * r * r * r;
    }
    const lt = Math.log10(T);
    const f = (lt - LOG_MIN) / (LOG_MAX - LOG_MIN) * (N - 1);
    const i = Math.min(N - 2, Math.max(0, Math.floor(f)));
    const t = f - i;
    return visible[i] + (visible[i + 1] - visible[i]) * t;
  }

  /* ── B−V → effective temperature (Ballesteros 2012) ────────────────────
     Checks out at B−V = 0.65 → 5778 K, to four figures. */
  function temperatureFromBV(bv) {
    return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  }

  /* ── Apparent magnitude → illuminance in lux ───────────────────────────
     Real physical units, so the tone map at the end has something to be
     anchored to rather than a number that only means something internally. */
  function fluxFromMagnitude(v) {
    return 2.54e-6 * Math.pow(10, -0.4 * v);
  }

  /* ── sRGB encode ───────────────────────────────────────────────────────── */
  function encode(c) {
    if (c <= 0) return 0;
    if (c >= 1) return 1;
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function hexAt(T) {
    const c = chromaAt(T);
    const to = (x) => Math.round(encode(x) * 255).toString(16).padStart(2, "0").toUpperCase();
    return "#" + to(c[0]) + to(c[1]) + to(c[2]);
  }

  window.HSAT_COLOUR = {
    chromaAt, visAt, hexAt, encode,
    temperatureFromBV, fluxFromMagnitude,
    planck, spectrumToXYZ,
    T_SUN,
    CMB: 2.7255,  // Fixsen 2009
  };
})();
