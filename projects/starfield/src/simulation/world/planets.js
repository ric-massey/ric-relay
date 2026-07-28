/* ══════════════════════════════════════════════════════════════════════
   planets.js — the other worlds, and why the sky was missing its brightest
   points of light.

   Ric, 2026-07-28: the sky "is lackluster". It was, and the largest single
   reason was not the stars at all. After the Sun and the Moon, the four
   brightest objects a human eye ever sees in the sky are planets — Venus
   reaches magnitude −4.6, brighter than Sirius by a factor of twenty — and
   this simulation did not contain any of them. A sky built to the naked-eye
   limit that omits the four things a naked eye notices first is not a dim
   sky, it is an incomplete one.

   ── Where the numbers come from ────────────────────────────────────────

   JPL Solar System Dynamics, "Approximate Positions of the Planets"
   (Standish, E.M.), the Keplerian element set fitted for **1800–2050**:
   six elements per planet and six rates, plus four extra terms for the
   outer planets. Published at ssd.jpl.nasa.gov.

   That set is chosen over VSOP87 deliberately. Data Sources §3.1 prefers
   analytic series with a tiny footprint and accuracy adequate for the job,
   and here the job is a *point of light in the sky at the right place*.
   Standish states the fit as good to roughly 10–100 arcseconds over the
   interval, worst for Mercury and Mars. The eye resolves about 60″, so at
   worst this is on the order of one resolution element — and every planet
   is an unresolved point at these distances anyway. VSOP87 would cost
   thousands of coefficients to move an error nobody can see.

   The honest consequence is recorded as ledger SF-L-022: these positions
   are good enough to look at and not good enough to navigate by at close
   range, and the game says so rather than implying otherwise.

   ── What is class M and what is class C ────────────────────────────────

   The elements and their rates are class `M` (measured/published). Every
   position here is class `C` (calculated from them). Radii are class `M`,
   from the IAU 2015 nominal values. Nothing in this file is invented.
   ══════════════════════════════════════════════════════════════════════ */

import { DEG } from "../core/linalg.js";
import { K } from "../core/units.js";
import { ttSecondsToCenturies } from "../time/time-service.js";
import { meanObliquityDeg } from "./ephemeris.js";

/**
 * Keplerian elements at J2000 and their rates per Julian century.
 *
 * Columns, in the order Standish publishes them:
 *   a    semi-major axis, au            and au/century
 *   e    eccentricity                   and per century
 *   I    inclination, degrees           and degrees/century
 *   L    mean longitude, degrees        and degrees/century
 *   wbar longitude of perihelion, deg   and degrees/century
 *   Om   longitude of ascending node    and degrees/century
 *
 * `extra` carries Standish's b, c, s, f correction terms, which apply to
 * Jupiter outward and are what keep the giants honest across 250 years.
 *
 * `vmag` is the standard magnitude at 1 au from both Sun and observer,
 * used to compute apparent brightness. `radius` is the IAU 2015 nominal
 * equatorial radius in metres.
 */
export const PLANET_ELEMENTS = [
  {
    id: "mercury", name: "Mercury",
    a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906],
    I: [7.00497902, -0.00594749], L: [252.25032350, 149472.67411175],
    wbar: [77.45779628, 0.16047689], Om: [48.33076593, -0.12534081],
    radius: 2439700, vmag: -0.6, albedo: 0.142,
  },
  {
    id: "venus", name: "Venus",
    a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107],
    I: [3.39467605, -0.00078890], L: [181.97909950, 58517.81538729],
    wbar: [131.60246718, 0.00268329], Om: [76.67984255, -0.27769418],
    radius: 6051800, vmag: -4.47, albedo: 0.689,
  },
  {
    id: "mars", name: "Mars",
    a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882],
    I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499],
    wbar: [-23.94362959, 0.44441088], Om: [49.55953891, -0.29257343],
    radius: 3396200, vmag: -1.52, albedo: 0.170,
  },
  {
    id: "jupiter", name: "Jupiter",
    a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253],
    I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775],
    wbar: [14.72847983, 0.21252668], Om: [100.47390909, 0.20469106],
    radius: 71492000, vmag: -9.40, albedo: 0.538,
    extra: { b: -0.00012452, c: 0.06064060, s: -0.35635438, f: 38.35125000 },
  },
  {
    id: "saturn", name: "Saturn",
    a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991],
    I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201],
    wbar: [92.59887831, -0.41897216], Om: [113.66242448, -0.28867794],
    radius: 60268000, vmag: -8.88, albedo: 0.499,
    extra: { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125000 },
  },
  {
    id: "uranus", name: "Uranus",
    a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397],
    I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785],
    wbar: [170.95427630, 0.40805281], Om: [74.01692503, 0.04240589],
    radius: 25559000, vmag: -7.19, albedo: 0.488,
    extra: { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025000 },
  },
  {
    id: "neptune", name: "Neptune",
    a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105],
    I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325],
    wbar: [44.96476227, -0.32241464], Om: [131.78422574, -0.00508664],
    radius: 24764000, vmag: -6.87, albedo: 0.442,
    extra: { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025000 },
  },
];

/** Solve Kepler's equation M = E − e sin E for the eccentric anomaly. */
function eccentricAnomaly(meanAnomalyDeg, e) {
  const M = meanAnomalyDeg * DEG;
  const eStar = e;                       // radians form: e* = e, M in radians
  let E = M + eStar * Math.sin(M);
  /* Newton–Raphson. Standish specifies iterating to 10⁻⁶ degrees; six
     iterations reaches that for every eccentricity in this table (Mercury's
     0.2056 is the worst case and converges in four). A fixed count rather
     than a while-loop because this runs every frame for seven bodies and a
     loop whose length depends on the data is a frame-time spike waiting to
     happen. */
  for (let i = 0; i < 6; i++) {
    const dM = M - (E - eStar * Math.sin(E));
    E += dM / (1 - eStar * Math.cos(E));
  }
  return E;
}

/**
 * Heliocentric position in the **J2000 ecliptic** frame, in metres.
 *
 * @param {object} p   one PLANET_ELEMENTS entry
 * @param {number} T   centuries of TT since J2000
 */
export function heliocentricEcliptic(p, T) {
  const a = p.a[0] + p.a[1] * T;
  const e = p.e[0] + p.e[1] * T;
  const I = p.I[0] + p.I[1] * T;
  const L = p.L[0] + p.L[1] * T;
  const wbar = p.wbar[0] + p.wbar[1] * T;
  const Om = p.Om[0] + p.Om[1] * T;

  const omega = wbar - Om;               // argument of perihelion
  let M = L - wbar;

  // Standish's extra terms for the giant planets.
  if (p.extra) {
    const { b, c, s, f } = p.extra;
    M += b * T * T + c * Math.cos(f * T * DEG) + s * Math.sin(f * T * DEG);
  }

  M = ((M + 180) % 360 + 360) % 360 - 180;   // wrap to −180…180
  const E = eccentricAnomaly(M, e);

  // Position in the orbital plane, perifocal coordinates.
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Rotate into the ecliptic: argument of perihelion, inclination, node.
  const co = Math.cos(omega * DEG), so = Math.sin(omega * DEG);
  const ci = Math.cos(I * DEG), si = Math.sin(I * DEG);
  const cO = Math.cos(Om * DEG), sO = Math.sin(Om * DEG);

  const xh = (co * cO - so * sO * ci) * xv + (-so * cO - co * sO * ci) * yv;
  const yh = (co * sO + so * cO * ci) * xv + (-so * sO + co * cO * ci) * yv;
  const zh = (so * si) * xv + (co * si) * yv;

  const AU = K.AU.value;
  return { x: xh * AU, y: yh * AU, z: zh * AU };
}

/** Rotate a J2000 ecliptic vector into equatorial coordinates of date. */
function eclipticToEquatorial(v, obliquityDeg) {
  const eps = obliquityDeg * DEG;
  const c = Math.cos(eps), s = Math.sin(eps);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

/**
 * Every planet's state in the Earth-centred inertial frame.
 *
 * Earth's own heliocentric position comes from the same element set rather
 * than from the Sun series already in `ephemeris.js`, and that is on
 * purpose: subtracting two positions from *different* theories leaves the
 * difference between the theories in the answer, which for Mars near
 * opposition is larger than either error alone.
 *
 * @param {number} tt   TT seconds since J2000
 * @returns {Array<{id,name,position,velocity,radius,vmag,albedo,distanceSunM}>}
 */
export function planetStatesEci(tt) {
  const T = ttSecondsToCenturies(tt);
  const eps = meanObliquityDeg(T);

  // Earth-Moon barycentre, from the same table Standish gives for Earth.
  const earth = heliocentricEcliptic(EARTH_ELEMENTS, T);

  // Central difference for velocity, matching how ephemeris.js does it.
  const DV = 30;
  const Tb = ttSecondsToCenturies(tt - DV);
  const Ta = ttSecondsToCenturies(tt + DV);
  const earthB = heliocentricEcliptic(EARTH_ELEMENTS, Tb);
  const earthA = heliocentricEcliptic(EARTH_ELEMENTS, Ta);

  return PLANET_ELEMENTS.map((p) => {
    const geo = (helio, e) => ({ x: helio.x - e.x, y: helio.y - e.y, z: helio.z - e.z });
    const now = geo(heliocentricEcliptic(p, T), earth);
    const before = geo(heliocentricEcliptic(p, Tb), earthB);
    const after = geo(heliocentricEcliptic(p, Ta), earthA);

    const position = eclipticToEquatorial(now, eps);
    const vb = eclipticToEquatorial(before, eps);
    const va = eclipticToEquatorial(after, eps);

    const helio = heliocentricEcliptic(p, T);
    return {
      id: p.id,
      name: p.name,
      position,
      velocity: {
        x: (va.x - vb.x) / (2 * DV),
        y: (va.y - vb.y) / (2 * DV),
        z: (va.z - vb.z) / (2 * DV),
      },
      radius: p.radius,
      vmag: p.vmag,
      albedo: p.albedo,
      distanceSunM: Math.hypot(helio.x, helio.y, helio.z),
      /* The *observer's* distance from the Sun, for the phase angle. Earth's
         is used rather than the ship's: anywhere in the Earth–Moon volume
         the two differ by at most 0.4 million km out of 150, which moves a
         phase angle by under a tenth of a degree and no magnitude by a
         thousandth. It stops being true if the ship ever leaves. */
      observerSunM: Math.hypot(earth.x, earth.y, earth.z),
    };
  });
}

/** Earth's own elements, from the same Standish table. */
const EARTH_ELEMENTS = {
  id: "earth", name: "Earth",
  a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392],
  I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981],
  wbar: [102.93768193, 0.32327364], Om: [0.0, 0.0],
  radius: 6378137, vmag: -3.86, albedo: 0.306,
};

/**
 * Phase-angle brightness corrections, magnitudes per degree and up.
 *
 * From the Astronomical Almanac's polynomial fits (also Meeus ch. 41).
 * These were very nearly left out on the grounds that an approximate phase
 * law implies a precision the element set does not have — which was wrong,
 * and checkable: without them Venus came out at −5.6 where the real thing
 * never passes −4.9, because at greatest elongation you are looking at a
 * half-lit disc and half a disc is 0.75 magnitudes of missing light. An
 * omitted term that is worth 1.4 magnitudes on the brightest object in the
 * sky is not a simplification, it is an error.
 *
 * Saturn's rings are not modelled: they swing it by ±0.5 magnitudes over
 * fifteen years and doing them properly needs the ring opening angle.
 * Saturn is therefore quoted at its ringless brightness and is the one
 * planet here whose magnitude is knowingly incomplete.
 */
const PHASE_LAW = {
  mercury: (a) => 0.0380 * a - 0.000273 * a * a + 0.000002 * a * a * a,
  venus: (a) => 0.0009 * a + 0.000239 * a * a - 0.00000065 * a * a * a,
  mars: (a) => 0.016 * a,
  jupiter: (a) => 0.005 * a,
  saturn: (a) => 0.044 * a,
  uranus: (a) => 0.0028 * a,
  neptune: (a) => 0.0037 * a,
};

/**
 * Apparent visual magnitude of a planet as seen from the ship.
 *
 * m = H + 5·log₁₀(r·Δ) + phase(α), with r the Sun–planet distance, Δ the
 * observer–planet distance, and α the phase angle at the planet — the
 * Sun–planet–observer angle, which is what decides how much of the disc
 * you are looking at the lit side of.
 *
 * α comes from the cosine rule on the triangle whose sides are r, Δ and
 * the observer's own distance from the Sun.
 */
export function apparentMagnitude(planet, rangeM, observerSunM = null) {
  const AU = K.AU.value;
  const r = planet.distanceSunM / AU;
  const d = Math.max(rangeM, 1) / AU;
  let m = planet.vmag + 5 * Math.log10(Math.max(r * d, 1e-12));

  const law = PHASE_LAW[planet.id];
  const obs = (observerSunM ?? planet.observerSunM) / AU;
  if (law && obs > 0) {
    const cosA = (r * r + d * d - obs * obs) / (2 * r * d);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosA))) / DEG;
    m += law(alpha);
  }
  return m;
}
