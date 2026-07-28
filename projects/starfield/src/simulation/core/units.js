/* ══════════════════════════════════════════════════════════════════════
   units.js — SI constants, each carrying its provenance.

   Scientific Standard §6.1: store units explicitly at module boundaries and
   convert once at a documented boundary. Everything inside the simulation is
   metres, seconds, kilograms, radians. Only the UI converts.

   Every constant here is an object, not a bare number, because §2.1 requires
   a source and a class for every value we assert. Use `K.EARTH_RADIUS.value`
   in maths and `K.EARTH_RADIUS.source` when the player asks where it came
   from.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * @param {number} value    SI value
 * @param {string} unit     SI unit string
 * @param {'M'|'C'|'K'|'P'|'F'|'A'} cls  Scientific Standard §2 class
 * @param {string} source   who says so
 * @param {string} [note]   anything a reader would want to know
 */
const q = (value, unit, cls, source, note = "") =>
  Object.freeze({ value, unit, cls, source, note });

export const K = Object.freeze({
  /* ── defined exactly ─────────────────────────────────────────────── */
  C_LIGHT: q(299792458, "m/s", "M", "SI, exact by definition (1983 CGPM)"),
  AU: q(149597870700, "m", "M", "IAU 2012 Resolution B2, exact by definition"),
  LIGHT_YEAR: q(9460730472580800, "m", "M", "IAU — exact: c × one Julian year",
    "Exact because both factors are: the metre is defined from c, and a Julian year is " +
    "defined as 365.25 days of 86 400 s. 63 241 au."),
  JULIAN_DAY: q(86400, "s", "M", "Defined: 86 400 SI seconds"),
  JULIAN_CENTURY: q(36525 * 86400, "s", "M", "Defined: 36 525 days"),

  /* ── measured ────────────────────────────────────────────────────── */
  G: q(6.6743e-11, "m³/kg/s²", "M", "CODATA 2018", "±1.5e-15; the least precisely known constant in this file"),

  GM_EARTH: q(3.986004418e14, "m³/s²", "M", "IERS Conventions 2010 / EGM2008",
    "Known far better than G×M separately — this is what orbits actually feel."),
  GM_MOON: q(4.9028001e12, "m³/s²", "M", "JPL DE440 / IAU"),
  GM_SUN: q(1.32712440018e20, "m³/s²", "M", "IAU 2009 / JPL DE440"),

  EARTH_RADIUS_EQ: q(6378137.0, "m", "M", "WGS 84, defined semi-major axis"),
  EARTH_RADIUS_POLAR: q(6356752.314245, "m", "C", "WGS 84, from a and 1/f = 298.257223563"),
  EARTH_RADIUS_MEAN: q(6371008.8, "m", "C", "IUGG mean radius R1 = (2a+b)/3"),
  EARTH_FLATTENING: q(1 / 298.257223563, "dimensionless", "M", "WGS 84, defined"),
  EARTH_J2: q(1.08262668e-3, "dimensionless", "M", "EGM96 geopotential model (NASA GSFC / NIMA / OSU)",
    "Earth's equatorial bulge. Regresses the ISS orbit plane about 5°/day."),
  EARTH_ROTATION_RATE: q(7.292115e-5, "rad/s", "M", "IERS Conventions 2010",
    "Sidereal, not solar — a sidereal day is 23 h 56 m 04 s."),

  MOON_RADIUS: q(1737400, "m", "M", "IAU/IAG 2015 mean radius; LOLA-based"),
  MOON_SEMI_MAJOR: q(384399000, "m", "M", "Mean Earth–Moon distance, IAU"),

  SUN_RADIUS: q(695700000, "m", "M", "IAU 2015 Resolution B3 nominal solar radius"),
  SUN_LUMINOSITY: q(3.828e26, "W", "M", "IAU 2015 Resolution B3 nominal"),
  SUN_EFFECTIVE_TEMP: q(5772, "K", "M", "IAU 2015 Resolution B3 nominal"),

  SOLAR_CONSTANT: q(1361, "W/m²", "M", "Total solar irradiance at 1 au, SORCE/TIM",
    "Varies by about ±0.05% over the solar cycle."),

  /* ── time-scale offsets ──────────────────────────────────────────── */
  TT_MINUS_TAI: q(32.184, "s", "M", "IAU, defined offset"),
  TAI_MINUS_UTC: q(37, "s", "M", "IERS Bulletin C — leap seconds as of 2017-01-01",
    "Constant since 2017. If a leap second is ever added this must be updated; " +
    "the error if it is not is one second, which moves Earth's rotation by 460 m " +
    "at the equator."),

  /* ── epochs ──────────────────────────────────────────────────────── */
  JD_J2000: q(2451545.0, "day", "M", "Defined: 2000-01-01T12:00:00 TT"),
  UNIX_JD_EPOCH: q(2440587.5, "day", "M", "Defined: 1970-01-01T00:00:00 UTC"),
});

/* ── conversions the UI is allowed to use ─────────────────────────── */

export const metresToKm = (m) => m / 1000;
export const metresToAu = (m) => m / K.AU.value;
export const metresToLightYears = (m) => m / K.LIGHT_YEAR.value;
export const metresToEarthRadii = (m) => m / K.EARTH_RADIUS_MEAN.value;
export const secondsToDays = (s) => s / 86400;

/**
 * The Lorentz factor γ = 1/√(1−β²), for a speed in m/s.
 *
 * **Above light it returns 1, and that is a declared fiction rather than an
 * approximation.** Modes 4 and 5 exceed c (ledger SF-L-018), where β > 1
 * makes 1−β² negative and γ imaginary — there is no "relativistic answer"
 * to give, because the premise is already outside relativity. The fiction
 * this project has chosen is that the faster-than-light drive moves you
 * without dilating your time, so the clocks stay together above c and the
 * HUD says which regime it is in rather than pretending.
 *
 * Below c it is exact and unapproximated, so mode 2 — which is named
 * Relativistic and goes to 30 km/s — separates the clocks by the amount it
 * really would (γ−1 ≈ 5×10⁻⁹) rather than by nothing at all.
 */
export function lorentzFactor(speedMps) {
  const beta = Math.abs(speedMps) / K.C_LIGHT.value;
  if (!(beta < 1)) return 1;
  return 1 / Math.sqrt(1 - beta * beta);
}

/**
 * Three significant figures, grouped, and never in exponent notation until
 * the number genuinely has no other honest shape.
 *
 * `toFixed` is the wrong tool once a readout spans more than a couple of
 * decades: four decimal places on 106 835 097 854 au is not precision, it
 * is noise with a decimal point in it. Every band below is sized so the
 * number it holds sits between about 1 and 1000, and this rounds it to
 * three figures, which is all a glance can use.
 */
function sig(x) {
  const a = Math.abs(x);
  if (a === 0) return "0";
  if (a >= 1e7) return x.toExponential(2).replace("e+", "×10^");
  const decimals = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return x.toLocaleString("en", {
    minimumFractionDigits: 0, maximumFractionDigits: decimals,
  });
}

/**
 * Format a distance for a human, choosing the unit the number deserves.
 * Scientific Standard §6.4: significant figures reflect purpose, not the
 * width of a float.
 *
 * ── Extended 2026-07-28 ────────────────────────────────────────────────
 *
 * The ladder used to stop at au, which was fine while the ship could not
 * leave the Earth–Moon system and became nonsense the moment it could. Ric,
 * having flown it: *"you broke the ui quite a bit lol."* He was right — the
 * altitude readout was showing `106835097854.1794 au` and the stopping
 * distance `2.4929288785685408e+30 au`, because nothing above au existed
 * and `toFixed(4)` will happily print eighteen digits before the point.
 *
 * A game whose whole premise is that the stars are reachable needs
 * light-years on the glass. Every band keeps its number roughly between 1
 * and 1000, which is the actual readability rule.
 */
export function formatDistance(m) {
  const a = Math.abs(m);
  if (a < 1) return `${(m * 100).toFixed(1)} cm`;
  if (a < 1000) return `${m.toFixed(1)} m`;
  if (a < 1e7) return `${(m / 1000).toFixed(a < 1e5 ? 2 : 1)} km`;
  if (a < 0.02 * K.AU.value) return `${(m / 1000).toLocaleString("en", { maximumFractionDigits: 0 })} km`;
  // au out to a quarter of a light-year: the whole of a planetary system,
  // the Kuiper belt and the heliopause stay in the unit they are quoted in.
  if (a < 0.25 * K.LIGHT_YEAR.value) return `${sig(metresToAu(m))} au`;
  if (a < 1e6 * K.LIGHT_YEAR.value) return `${sig(metresToLightYears(m))} ly`;
  return `${sig(metresToLightYears(m) / 1e6)} Mly`;
}

/**
 * Speed, in the unit that makes the number legible.
 *
 * Above light the unit is **light-years per second**, not a multiple of c.
 * "500,000 ly/s" is a thing a player can hold in their head — it is
 * Andromeda in five seconds — and `15778749177182.425781 c` is not. The
 * modes themselves are specified in ly/s (`modes.js`), so this also makes
 * the readout and the mode table speak the same language.
 */
export function formatSpeed(mps) {
  const a = Math.abs(mps);
  const C = K.C_LIGHT.value, LY = K.LIGHT_YEAR.value;
  if (a < 1) return `${(mps * 100).toFixed(1)} cm/s`;
  if (a < 1000) return `${mps.toFixed(2)} m/s`;
  if (a < 0.001 * C) return `${(mps / 1000).toFixed(3)} km/s`;
  if (a < 0.01 * LY) return `${sig(mps / C)} c`;
  return `${sig(mps / LY)} ly/s`;
}

/**
 * A duration a person would actually say out loud.
 *
 * Same failure as the distances and found the same way: the stopping
 * readout was printing `157678333333063991296.0 s`. Seconds are the right
 * unit for a docking burn and no other part of this game.
 */
export function formatDuration(s) {
  if (!Number.isFinite(s)) return "—";
  const a = Math.abs(s);
  if (a < 90) return `${s.toFixed(1)} s`;
  if (a < 5400) return `${(s / 60).toFixed(1)} min`;
  if (a < 172800) return `${(s / 3600).toFixed(1)} h`;
  if (a < 3.156e7) return `${(s / 86400).toFixed(1)} days`;
  return `${sig(s / 3.15576e7)} yr`;
}

/** An angle in the unit an astronomer would use for its size. */
export function formatAngle(rad) {
  const deg = (rad * 180) / Math.PI;
  if (Math.abs(deg) >= 1) return `${deg.toFixed(2)}°`;
  const arcmin = deg * 60;
  if (Math.abs(arcmin) >= 1) return `${arcmin.toFixed(1)}′`;
  return `${(arcmin * 60).toFixed(1)}″`;
}
