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

   There are two ladders of units here, metric and imperial, and a switch
   in the corner picks one. They are the same ladder at both ends. Below
   an inch imperial has no word anybody says out loud — a red blood cell
   is three ten-thousandths of an inch, which is not a measurement, it is
   a dare — and that end of the exhibit is measured in microns by the
   people who measure it, in every country. Above a mile both systems give
   up and go to astronomical units and light-years, which belong to
   neither. So the switch really only changes six decades in the middle,
   which happens to be all six decades a person has ever walked across.
   ══════════════════════════════════════════════════════════════════════ */
window.U = (() => {
  "use strict";

  const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
  const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");

  const AU = 1.495978707e11;
  const LY = 9.4607304726e15;
  const C = 299792458;
  const IN = 0.0254;
  const FT = 0.3048;
  const MI = 1609.344;

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
    const n = fig(v);
    // "1 miles" and "1 light-years" are the only two places this can bite,
    // and both are reachable from the scale bar's rounding.
    if (unit && n === "1") unit = unit.replace(/s$/, "");
    return n + (unit ? " " + unit : "");
  }

  /* ── which unit ───────────────────────────────────────────────────────
     One table per system, read from the small end up: the first row whose
     ceiling the length is under owns it. `div` is what to divide metres by
     to get the number, `unit` is what to say after it, and `style` is
     which of the three formatters above gets to say it.

     The two tables share their first seven rows and their last two, which
     is the honest shape of the disagreement — see the note at the top. */
  const SMALL = [
    [1e-15, 1, "m", "sci"],
    [1e-12, 1e-15, "fm"],
    [1e-9, 1e-12, "pm"],
    [1e-6, 1e-9, "nm"],
    [1e-3, 1e-6, "µm"],
    [1e-2, 1e-3, "mm"],
  ];
  const FAR = [
    [0.02 * LY, AU, "AU"],
    [Infinity, LY, "light-years", "wordsFloor"],
  ];
  const TABLE = {
    m: SMALL.concat([
      [1, 1e-2, "cm"],
      [1e3, 1, "m"],
      [1e12, 1e3, "km", "words"],
    ], FAR),
    ft: SMALL.concat([
      [IN, 1e-2, "cm"],
      [FT, IN, "in"],
      [MI, FT, "ft"],
      [1e12, MI, "miles", "words"],
    ], FAR),
  };

  let system = "m";
  const setSystem = (s) => { system = s === "ft" ? "ft" : "m"; };
  const getSystem = () => system;

  function unitFor(a) {
    const rows = TABLE[system];
    for (const r of rows) if (a < r[0]) return r;
    return rows[rows.length - 1];
  }

  function say(m, r) {
    const style = r[3];
    if (style === "sci") return sci(m) + " " + r[2];
    if (style === "words") return words(m / r[1], r[2]);
    if (style === "wordsFloor") return words(m / r[1], r[2], true);
    return fig(m / r[1]) + " " + r[2];
  }

  /* A length, in whatever unit belongs to it. */
  function length(m) {
    return say(m, unitFor(Math.abs(m)));
  }

  /* The nearest round length at or about this one — 1, 2, 5 or 10 of
     whatever unit the length is in, which is not the same as 1, 2, 5 or 10
     of anything in metres once feet and miles are on the table. Rounding
     can push the answer up into the next unit (7,500 ft rounds to 10,000,
     which is nearly two miles), so the unit is picked again afterwards and
     the number rounded a second time in it. Twice is always enough: the
     second unit is the one that owns the answer. */
  function niceLength(want) {
    let r = unitFor(Math.abs(want)), out = want;
    for (let pass = 0; pass < 2; pass++) {
      const div = r[3] === "sci" ? 1 : r[1];
      const v = want / div;
      const e = Math.pow(10, Math.floor(Math.log10(v)));
      const m = v / e;
      out = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e * div;
      const again = unitFor(Math.abs(out));
      if (again === r) break;
      r = again;
    }
    return out;
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

  return { sup, sci, decade, length, niceLength, count, fig, words,
           setSystem, system: getSystem, AU, LY, C, IN, FT, MI };
})();
