/* ASTRO — where the sun and moon are from a place, for Weather's scene (scene.js).
   ────────────────────────────────────────────────────────────────────────────
   Ric, 2026-10-25: "night and day needs to be implemented. the moon also needs to
   be what it is based on the location. and the sun."

   So the scene's light comes from the sun's real height at the visitor's place
   (day, golden hour, the three twilights, night), and the sun and moon are drawn
   where they are in that sky: the moon at its real phase, its lit side turned the
   way it looks from that latitude — a waxing moon is lit on the right in the
   north and on the left in the south, and it tips over in the tropics.

   Low-precision formulas from the standard references (Meeus, "Astronomical
   Algorithms"; the same set SunCalc uses), written here — no library. Good to a
   fraction of a degree, which is far finer than a picture needs.
   test/astro.test.mjs holds them to known full and new moons, the sun at noon
   on an equinox, and the lit side facing the sun.

   Angles out are radians. Azimuth is from north, clockwise (east = π/2). Nothing
   here is fetched or sent: the place stays in the browser it came from. */
(function (root) {
  "use strict";
  const PI = Math.PI, rad = PI / 180, sin = Math.sin, cos = Math.cos, tan = Math.tan,
    asin = Math.asin, atan = Math.atan2, acos = Math.acos;
  const e = rad * 23.4397;                                       // obliquity of the ecliptic
  const days = (ms) => ms / 864e5 - 0.5 + 2440588 - 2451545;     // days since J2000.0
  const ra = (l, b) => atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l));
  const dec = (l, b) => asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l));
  /* azimuth here from south, westward; turned to from-north at the end */
  const az = (H, phi, d) => atan(sin(H), cos(H) * sin(phi) - tan(d) * cos(phi));
  const alt = (H, phi, d) => asin(sin(phi) * sin(d) + cos(phi) * cos(d) * cos(H));
  const sidereal = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;
  /* refraction lifts a body near the horizon by about half a degree */
  const refract = (h) => { h = Math.max(h, 0); return 0.0002967 / tan(h + 0.00312536 / (h + 0.08901179)); };

  function sunCoords(d) {
    const M = rad * (357.5291 + 0.98560028 * d);
    const C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M));
    const L = M + C + rad * 102.9372 + PI;
    return { dec: dec(L, 0), ra: ra(L, 0) };
  }
  function moonCoords(d) {
    const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.22935 * d);
    const l = L + rad * 6.289 * sin(M), b = rad * 5.128 * sin(F);
    return { ra: ra(l, b), dec: dec(l, b), dist: 385001 - 20905 * cos(M) };
  }
  const fromNorth = (a) => (a + PI) % (2 * PI);

  /* the sun: altitude and azimuth at a place and time */
  function sun(ms, lat, lon) {
    const lw = rad * -lon, phi = rad * lat, d = days(ms), c = sunCoords(d), H = sidereal(d, lw) - c.ra;
    return { alt: alt(H, phi, c.dec), az: fromNorth(az(H, phi, c.dec)) };
  }
  /* the moon: altitude, azimuth, and the parallactic angle (how the sky's north
     is tipped at the moon from the observer's up) */
  function moon(ms, lat, lon) {
    const lw = rad * -lon, phi = rad * lat, d = days(ms), c = moonCoords(d), H = sidereal(d, lw) - c.ra;
    const h = alt(H, phi, c.dec);
    const pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));
    return { alt: h + refract(h), az: fromNorth(az(H, phi, c.dec)), pa, dist: c.dist };
  }
  /* how much of the moon is lit (0 new … 1 full), where in the cycle it is
     (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter), and the position
     angle of its bright limb's midpoint, from the sky's north towards east */
  function moonLight(ms) {
    const d = days(ms), s = sunCoords(d), m = moonCoords(d), sd = 149598000;
    const phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra));
    const inc = atan(sd * sin(phi), m.dist - sd * cos(phi));
    const angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) - cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));
    return { fraction: (1 + cos(inc)) / 2, phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / PI, angle };
  }
  /* the bright limb as the observer sees it: an angle from straight up, positive
     towards the east side of the sky. Lit side faces the sun. (SunCalc's
     "zenith angle", angle − pa, runs the other way: towards the west.) */
  const limb = (ms, lat, lon) => moon(ms, lat, lon).pa - moonLight(ms).angle;

  const api = { sun, moon, moonLight, limb };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WxAstro = api;
})(typeof window !== "undefined" ? window : globalThis);
