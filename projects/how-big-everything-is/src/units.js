/* ══════════════════════════════════════════════════════════════════════
   Units.

   Forty-five decades in one readout. No single unit survives that, so the
   rule here is: always the unit a person would actually say out loud at
   that size, and never more than three significant figures, because the
   fourth one is noise on every number in this exhibit anyway.

   The one place that rule is broken on purpose is scientific notation
   below a femtometre and above a light-year, where there is no spoken
   unit and pretending otherwise ("0.000000000000000001 metres") is worse
   than the exponent.
   ══════════════════════════════════════════════════════════════════════ */
window.U = (() => {
  "use strict";

  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");

  const AU = 1.495978707e11;
  const LY = 9.4607304726e15;
  const C = 299792458;

  function fig(v, n) {
    n = n || 3;
    if (!isFinite(v)) return "—";
    const a = Math.abs(v);
    if (a === 0) return "0";
    const d = Math.max(0, Math.min(20, n - 1 - Math.floor(Math.log10(a))));
    return Number(v.toFixed(d)).toLocaleString("en-US", { maximumFractionDigits: d });
  }

  /* 1.68 × 10⁻¹⁵. The mantissa is dropped when it is 1, because "1 × 10⁻¹⁸"
     reads as a measurement and "10⁻¹⁸" reads as an order of magnitude, and
     at the bottom of this ladder the second one is the honest claim. */
  function sci(v, n) {
    if (v === 0) return "0";
    const e = Math.floor(Math.log10(Math.abs(v)));
    const m = v / Math.pow(10, e);
    const ms = fig(m, n || 3);
    return (ms === "1" ? "" : ms + " × ") + "10" + sup(e);
  }

  /* A power of ten on its own, for the dock: which decade the frame is in. */
  function decade(v) {
    return "10" + sup(Math.floor(Math.log10(v))) + " m";
  }

  /* Big counts get words, because "93,000,000,000" is a row of zeros and
     "93 billion" is a quantity. */
  const WORDS = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
  function words(v, unit, floorAtThousand) {
    for (const [mag, name] of WORDS) {
      if (v >= mag && (mag > 1e3 || floorAtThousand)) {
        return fig(v / mag) + " " + name + (unit ? " " + unit : "");
      }
    }
    return fig(v) + (unit ? " " + unit : "");
  }

  /* A length, in whatever unit belongs to it. */
  function length(m) {
    const a = Math.abs(m);
    if (a < 1e-15) return sci(m) + " m";
    if (a < 1e-12) return fig(m * 1e15) + " fm";
    if (a < 1e-9) return fig(m * 1e12) + " pm";
    if (a < 1e-6) return fig(m * 1e9) + " nm";
    if (a < 1e-3) return fig(m * 1e6) + " µm";
    if (a < 1e-2) return fig(m * 1e3) + " mm";
    if (a < 1) return fig(m * 1e2) + " cm";
    if (a < 1e3) return fig(m) + " m";
    if (a < 1e12) return words(m / 1e3, "km") ;
    if (a < 0.02 * LY) return fig(m / AU) + " AU";
    return words(m / LY, "light-years", true);
  }

  /* "63,000" up to a point, then exponents. A count with fourteen digits in
     it is not a count, it is a texture. */
  function count(n) {
    if (!isFinite(n)) return "—";
    if (n < 1) return fig(n, 2);
    if (n < 1e6) return fig(n).replace(/\.\d+$/, "");
    if (n < 1e15) return words(n, "", true);
    return sci(n, 2);
  }

  return { sup, sci, decade, length, count, fig, words, AU, LY, C };
})();
