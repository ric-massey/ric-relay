/* ══════════════════════════════════════════════════════════════════════
   ephemeris.js — where the Sun and the Moon actually are.

   Data Sources §3.1 lists three candidates for the shipped runtime and
   recommends the analytic series: "VSOP87 / ELP-2000, or Meeus algorithms
   — analytic series, tiny footprint, accuracy adequate for Earth–Moon
   work. Strong candidate for the shipped runtime with DE440 as the
   accuracy reference." That is what this file is.

   Everything here is class `C` — calculated from published series whose
   coefficients are class `M`. Sources:

     Meeus, Jean. *Astronomical Algorithms*, 2nd ed. (Willmann-Bell, 1998)
       ch. 22  nutation and obliquity
       ch. 25  solar coordinates (low accuracy)
       ch. 47  position of the Moon — the ELP-2000/82 truncation
       ch. 12  sidereal time

     Archinal et al. (2011), "Report of the IAU Working Group on
       Cartographic Coordinates and Rotational Elements: 2009"
       — lunar pole and prime meridian

   Stated accuracy of the lunar series: about 10″ in longitude and 4″ in
   latitude, which at the Moon's distance is roughly 20 km along-track.
   The Moon is 3 474 km across, so it lands within 0.6% of its own diameter
   of the truth. That is the honest number, and it is in the ledger.
   ══════════════════════════════════════════════════════════════════════ */

import { DEG, wrapDeg, v3, rotZ, multiply, rotX } from "../core/linalg.js";
import { ttSecondsToCenturies, ttSecondsToJdTt, ttSecondsToJdUtc } from "../time/time-service.js";
import { K } from "../core/units.js";

const sinD = (deg) => Math.sin(deg * DEG);
const cosD = (deg) => Math.cos(deg * DEG);

/* ══════════════════════════════════════════════════════════════════════
   Obliquity of the ecliptic — Meeus (22.2)
   ══════════════════════════════════════════════════════════════════════ */

/** Mean obliquity ε₀, degrees. Valid to about 1″ over ±2000 years of J2000. */
export function meanObliquityDeg(T) {
  const arcsec = 21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813));
  return 23 + (26 + arcsec / 60) / 60;
}

/* ══════════════════════════════════════════════════════════════════════
   The Sun — Meeus ch. 25, "low accuracy" solar coordinates.
   Accuracy about 0.01° in longitude, which is a third of the Sun's own
   apparent diameter. For lighting and for pointing a ship at it, that is
   far below anything a player could perceive.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Geocentric solar position, in the ecliptic of date.
 * @returns {{lonDeg:number, latDeg:number, distanceM:number}}
 */
export function sunEclipticOfDate(T) {
  // Geometric mean longitude and mean anomaly (25.2, 25.3)
  const L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  const M = 357.52911 + T * (35999.05029 - T * 0.0001537);
  const e = 0.016708634 - T * (0.000042037 + T * 0.0000001267);

  // Equation of the centre (25.4)
  const C =
    (1.914602 - T * (0.004817 + T * 0.000014)) * sinD(M) +
    (0.019993 - T * 0.000101) * sinD(2 * M) +
    0.000289 * sinD(3 * M);

  const trueLon = L0 + C;
  const trueAnomaly = M + C;

  // Radius vector in astronomical units (25.5)
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cosD(trueAnomaly));

  // Apparent longitude: strip aberration and the leading nutation term so
  // this matches the direction light actually arrives from.
  const omega = 125.04 - 1934.136 * T;
  const apparentLon = trueLon - 0.00569 - 0.00478 * sinD(omega);

  return {
    lonDeg: wrapDeg(apparentLon),
    latDeg: 0, // below 1.2″; the Sun sits on the ecliptic by construction
    distanceM: R * K.AU.value,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   The Moon — Meeus ch. 47 (truncated ELP-2000/82).

   Tables 47.A and 47.B, packed as flat arrays of
   [D, M, M′, F, coefficient…] to keep the byte count down.
   ══════════════════════════════════════════════════════════════════════ */

// Table 47.A — arguments and the Σl (×1e-6 deg) and Σr (×1e-3 km) coefficients.
const TERMS_LR = [
  0, 0, 1, 0, 6288774, -20905355,
  2, 0, -1, 0, 1274027, -3699111,
  2, 0, 0, 0, 658314, -2955968,
  0, 0, 2, 0, 213618, -569925,
  0, 1, 0, 0, -185116, 48888,
  0, 0, 0, 2, -114332, -3149,
  2, 0, -2, 0, 58793, 246158,
  2, -1, -1, 0, 57066, -152138,
  2, 0, 1, 0, 53322, -170733,
  2, -1, 0, 0, 45758, -204586,
  0, 1, -1, 0, -40923, -129620,
  1, 0, 0, 0, -34720, 108743,
  0, 1, 1, 0, -30383, 104755,
  2, 0, 0, -2, 15327, 10321,
  0, 0, 1, 2, -12528, 0,
  0, 0, 1, -2, 10980, 79661,
  4, 0, -1, 0, 10675, -34782,
  0, 0, 3, 0, 10034, -23210,
  4, 0, -2, 0, 8548, -21636,
  2, 1, -1, 0, -7888, 24208,
  2, 1, 0, 0, -6766, 30824,
  1, 0, -1, 0, -5163, -8379,
  1, 1, 0, 0, 4987, -16675,
  2, -1, 1, 0, 4036, -12831,
  2, 0, 2, 0, 3994, -10445,
  4, 0, 0, 0, 3861, -11650,
  2, 0, -3, 0, 3665, 14403,
  0, 1, -2, 0, -2689, -7003,
  2, 0, -1, 2, -2602, 0,
  2, -1, -2, 0, 2390, 10056,
  1, 0, 1, 0, -2348, 6322,
  2, -2, 0, 0, 2236, -9884,
  0, 1, 2, 0, -2120, 5751,
  0, 2, 0, 0, -2069, 0,
  2, -2, -1, 0, 2048, -4950,
  2, 0, 1, -2, -1773, 4130,
  2, 0, 0, 2, -1595, 0,
  4, -1, -1, 0, 1215, -3958,
  0, 0, 2, 2, -1110, 0,
  3, 0, -1, 0, -892, 3258,
  2, 1, 1, 0, -810, 2616,
  4, -1, -2, 0, 759, -1897,
  0, 2, -1, 0, -713, -2117,
  2, 2, -1, 0, -700, 2354,
  2, 1, -2, 0, 691, 0,
  2, -1, 0, -2, 596, 0,
  4, 0, 1, 0, 549, -1423,
  0, 0, 4, 0, 537, -1117,
  4, -1, 0, 0, 520, -1571,
  1, 0, -2, 0, -487, -1739,
  2, 1, 0, -2, -399, 0,
  0, 0, 2, -2, -381, -4421,
  1, 1, 1, 0, 351, 0,
  3, 0, -2, 0, -340, 0,
  4, 0, -3, 0, 330, 0,
  2, -1, 2, 0, 327, 0,
  0, 2, 1, 0, -323, 1165,
  1, 1, -1, 0, 299, 0,
  2, 0, 3, 0, 294, 0,
  2, 0, -1, -2, 0, 8752,
];

// Table 47.B — arguments and the Σb (×1e-6 deg) coefficients.
const TERMS_B = [
  0, 0, 0, 1, 5128122,
  0, 0, 1, 1, 280602,
  0, 0, 1, -1, 277693,
  2, 0, 0, -1, 173237,
  2, 0, -1, 1, 55413,
  2, 0, -1, -1, 46271,
  2, 0, 0, 1, 32573,
  0, 0, 2, 1, 17198,
  2, 0, 1, -1, 9266,
  0, 0, 2, -1, 8822,
  2, -1, 0, -1, 8216,
  2, 0, -2, -1, 4324,
  2, 0, 1, 1, 4200,
  2, 1, 0, -1, -3359,
  2, -1, -1, 1, 2463,
  2, -1, 0, 1, 2211,
  2, -1, -1, -1, 2065,
  0, 1, -1, -1, -1870,
  4, 0, -1, -1, 1828,
  0, 1, 0, 1, -1794,
  0, 0, 0, 3, -1749,
  0, 1, -1, 1, -1565,
  1, 0, 0, 1, -1491,
  0, 1, 1, 1, -1475,
  0, 1, 1, -1, -1410,
  0, 1, 0, -1, -1344,
  1, 0, 0, -1, -1335,
  0, 0, 3, 1, 1107,
  4, 0, 0, -1, 1021,
  4, 0, -1, 1, 833,
  0, 0, 1, -3, 777,
  4, 0, -2, 1, 671,
  2, 0, 0, -3, 607,
  2, 0, 2, -1, 596,
  2, -1, 1, -1, 491,
  2, 0, -2, 1, -451,
  0, 0, 3, -1, 439,
  2, 0, 2, 1, 422,
  2, 0, -3, -1, 421,
  2, 1, -1, 1, -366,
  2, 1, 0, 1, -351,
  4, 0, 0, 1, 331,
  2, -1, 1, 1, 315,
  2, -2, 0, -1, 302,
  0, 0, 1, 3, -283,
  2, 1, 1, -1, -229,
  1, 1, 0, -1, 223,
  1, 1, 0, 1, 223,
  0, 1, -2, -1, -220,
  2, 1, -1, -1, -220,
  1, 0, 1, 1, -185,
  2, -1, -2, -1, 181,
  0, 1, 2, 1, -177,
  4, 0, -2, -1, 176,
  4, -1, -1, -1, 166,
  1, 0, 1, -1, -164,
  4, 0, 1, -1, 132,
  1, 0, -1, -1, -119,
  4, -1, 0, -1, 115,
  2, -2, 0, 1, 107,
];

/**
 * Geocentric lunar position in the ecliptic of date. Meeus (47.1)–(47.6)
 * plus tables 47.A/47.B and the additive terms.
 * @returns {{lonDeg:number, latDeg:number, distanceM:number}}
 */
export function moonEclipticOfDate(T) {
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;

  // Moon's mean longitude, referred to the mean equinox of date (47.1)
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  // Mean elongation of the Moon from the Sun (47.2)
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  // Sun's mean anomaly (47.3)
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  // Moon's mean anomaly (47.4)
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  // Moon's argument of latitude (47.5)
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;

  // Additive arguments for Venus, Jupiter and the flattening of the Earth (47.6)
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.290 * T;
  const A3 = 313.45 + 481266.484 * T;

  // Eccentricity correction: terms in M are scaled by E because the Earth's
  // orbital eccentricity is slowly decreasing.
  const E = 1 - 0.002516 * T - 0.0000074 * T2;

  let sumL = 0, sumR = 0, sumB = 0;

  for (let i = 0; i < TERMS_LR.length; i += 6) {
    const cD = TERMS_LR[i], cM = TERMS_LR[i + 1], cMp = TERMS_LR[i + 2], cF = TERMS_LR[i + 3];
    const arg = cD * D + cM * M + cMp * Mp + cF * F;
    let f = 1;
    if (cM === 1 || cM === -1) f = E;
    else if (cM === 2 || cM === -2) f = E * E;
    sumL += TERMS_LR[i + 4] * f * sinD(arg);
    sumR += TERMS_LR[i + 5] * f * cosD(arg);
  }

  for (let i = 0; i < TERMS_B.length; i += 5) {
    const cD = TERMS_B[i], cM = TERMS_B[i + 1], cMp = TERMS_B[i + 2], cF = TERMS_B[i + 3];
    const arg = cD * D + cM * M + cMp * Mp + cF * F;
    let f = 1;
    if (cM === 1 || cM === -1) f = E;
    else if (cM === 2 || cM === -2) f = E * E;
    sumB += TERMS_B[i + 4] * f * sinD(arg);
  }

  // Additive terms (Meeus, after table 47.B)
  sumL += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
  sumB += -2235 * sinD(Lp) + 382 * sinD(A3) + 175 * sinD(A1 - F) + 175 * sinD(A1 + F) +
    127 * sinD(Lp - Mp) - 115 * sinD(Lp + Mp);

  return {
    lonDeg: wrapDeg(Lp + sumL / 1e6),
    latDeg: sumB / 1e6,
    // 385 000.56 km is the constant term of the distance series.
    distanceM: (385000.56 + sumR / 1000) * 1000,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   Frame conversion
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Spherical ecliptic coordinates → Cartesian equatorial of date, metres.
 * Meeus (13.3)/(13.4) in Cartesian form. +x toward the equinox of date,
 * +z toward the celestial north pole.
 */
export function eclipticToEquatorial({ lonDeg, latDeg, distanceM }, obliquityDeg) {
  const cb = cosD(latDeg), sb = sinD(latDeg);
  const cl = cosD(lonDeg), sl = sinD(lonDeg);
  const ce = cosD(obliquityDeg), se = sinD(obliquityDeg);
  return {
    x: distanceM * cb * cl,
    y: distanceM * (cb * sl * ce - sb * se),
    z: distanceM * (cb * sl * se + sb * ce),
  };
}

/**
 * Greenwich Mean Sidereal Time in degrees — Meeus (12.4).
 * This is the angle Earth has turned, and therefore the whole of the
 * transform between the inertial and the Earth-fixed frame.
 */
export function gmstDeg(jdUt1) {
  const T = (jdUt1 - K.JD_J2000.value) / 36525;
  const theta =
    280.46061837 +
    360.98564736629 * (jdUt1 - K.JD_J2000.value) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;
  return wrapDeg(theta);
}

/* ══════════════════════════════════════════════════════════════════════
   Body states, in Earth-centred inertial (equator and equinox of date)
   ══════════════════════════════════════════════════════════════════════ */

/** Central-difference step for velocities, seconds. */
const DV = 30;

function positionAt(bodyFn, tt) {
  const T = ttSecondsToCenturies(tt);
  return eclipticToEquatorial(bodyFn(T), meanObliquityDeg(T));
}

/**
 * Position and velocity of a body in the Earth-centred frame.
 *
 * The velocity is a central difference over ±30 s rather than a
 * differentiated series. The truncation error of a central difference is
 * (h²/6)·x‴; for the Moon that is well under a millimetre per second,
 * which is nine orders of magnitude below the velocity itself. Doing it
 * analytically would be more elegant and no more accurate.
 */
function stateOf(bodyFn, tt) {
  const p = positionAt(bodyFn, tt);
  const before = positionAt(bodyFn, tt - DV);
  const after = positionAt(bodyFn, tt + DV);
  return {
    position: p,
    velocity: {
      x: (after.x - before.x) / (2 * DV),
      y: (after.y - before.y) / (2 * DV),
      z: (after.z - before.z) / (2 * DV),
    },
  };
}

/** Moon state in the Earth-centred inertial frame of date. */
export const moonStateEci = (tt) => stateOf(moonEclipticOfDate, tt);

/** Sun state in the Earth-centred inertial frame of date. */
export const sunStateEci = (tt) => stateOf(sunEclipticOfDate, tt);

/* ══════════════════════════════════════════════════════════════════════
   Body orientation
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Earth-fixed orientation: rotation from the inertial frame to the
 * Earth-fixed frame, plus the angular-velocity vector.
 *
 * UT1 is approximated by UTC. |UT1−UTC| < 0.9 s by construction, which is
 * up to 415 m of surface displacement at the equator — irrelevant from
 * orbit, and recorded in the ledger rather than silently ignored.
 */
export function earthOrientation(tt) {
  const theta = gmstDeg(ttSecondsToJdUtc(tt));
  return {
    R: rotZ(-theta * DEG),
    omega: v3(0, 0, K.EARTH_ROTATION_RATE.value),
  };
}

/**
 * Lunar orientation — IAU 2009 mean expressions (Archinal et al. 2011),
 * with the periodic libration terms omitted.
 *
 * Class `K`: the omitted terms are the physical libration, up to about
 * 0.03° in the pole and 0.13° in the prime meridian. Optical libration —
 * the big ±8° effect that lets us see 59% of the surface — comes from the
 * Moon's orbit, not its rotation, and IS present here because the orbit is.
 */
export function moonOrientation(tt) {
  const T = ttSecondsToCenturies(tt);
  const d = (ttSecondsToJdTt(tt) - K.JD_J2000.value); // days since J2000

  const raDeg = 269.9949 + 0.0031 * T;   // pole right ascension
  const decDeg = 66.5392 + 0.0130 * T;   // pole declination
  const wDeg = wrapDeg(38.3213 + 13.17635815 * d - 1.4e-12 * d * d); // prime meridian

  // IAU convention: body-fixed = Rz(W) · Rx(90°−δ) · Rz(90°+α) applied to
  // an inertial equatorial vector.
  const R = multiply(
    rotZ(wDeg * DEG),
    multiply(rotX((90 - decDeg) * DEG), rotZ((90 + raDeg) * DEG))
  );

  // Synodic-free sidereal rotation rate about the body's own pole,
  // expressed in inertial axes.
  const rate = (13.17635815 * DEG) / 86400;
  const pole = {
    x: cosD(decDeg) * cosD(raDeg),
    y: cosD(decDeg) * sinD(raDeg),
    z: sinD(decDeg),
  };
  return { R, omega: { x: pole.x * rate, y: pole.y * rate, z: pole.z * rate } };
}
