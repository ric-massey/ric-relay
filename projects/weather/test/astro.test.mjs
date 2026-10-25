/* Weather's scene draws the sun and moon from assets/weather/astro.js. These
   hold it to things that are known without it: full and new moons, the sun's
   height at noon on an equinox, and the moon's lit side facing the sun. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const A = require('../../../assets/weather/astro.js');

let failures = 0;
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) failures++; };
const deg = (r) => r * 180 / Math.PI;

console.log('RULE  the moon is the phase it is');
{
  /* published times (USNO): full moon 2024-01-25 17:54 UTC, new moon 2024-01-11 11:57 UTC,
     first quarter 2024-01-18 03:53 UTC */
  const full = A.moonLight(Date.UTC(2024, 0, 25, 17, 54)), fresh = A.moonLight(Date.UTC(2024, 0, 11, 11, 57));
  const first = A.moonLight(Date.UTC(2024, 0, 18, 3, 53));
  ok(full.fraction > 0.99 && Math.abs(full.phase - 0.5) < 0.02, `a full moon is full (${full.fraction.toFixed(3)} lit, phase ${full.phase.toFixed(3)})`);
  ok(fresh.fraction < 0.01, `a new moon is dark (${fresh.fraction.toFixed(3)} lit)`);
  ok(Math.abs(first.fraction - 0.5) < 0.04 && Math.abs(first.phase - 0.25) < 0.02, `first quarter is half lit and waxing (${first.fraction.toFixed(3)}, phase ${first.phase.toFixed(3)})`);
}

console.log('\nRULE  the sun is where it is');
{
  /* the March 2024 equinox, near local noon on the prime meridian: the sun's
     height is about 90° minus the latitude, and it is due south in the north */
  const t = Date.UTC(2024, 2, 20, 12, 7);
  const london = A.sun(t, 51.5, 0), quito = A.sun(t, -0.2, 0), sydney = A.sun(Date.UTC(2024, 2, 20, 2, 7), -33.9, 151.2);
  ok(Math.abs(deg(london.alt) - 38.5) < 1 && Math.abs(deg(london.az) - 180) < 3, `51.5°N at noon: ${deg(london.alt).toFixed(1)}° up, ${deg(london.az).toFixed(0)}° (due south)`);
  ok(deg(quito.alt) > 88, `on the equator it is overhead (${deg(quito.alt).toFixed(1)}°)`);
  ok(Math.abs(deg(sydney.alt) - 56) < 2 && (deg(sydney.az) < 10 || deg(sydney.az) > 350), `33.9°S at noon: ${deg(sydney.alt).toFixed(1)}° up, due north (${deg(sydney.az).toFixed(0)}°)`);
  ok(deg(A.sun(Date.UTC(2024, 2, 20, 0, 0), 51.5, 0).alt) < -30, 'and at midnight it is well below');
}

console.log('\nRULE  the lit side faces the sun, from wherever you stand');
{
  /* for every place and many times, the bright limb's direction on the sky
     should point the way the sun is from the moon (both seen from that place) */
  let worst = 0, n = 0;
  for (const [lat, lon] of [[47.6, -122.3], [-49.3, -73.1], [1.3, 103.8], [64.1, -21.9], [-33.9, 151.2]]) {
    for (let h = 0; h < 24 * 30; h += 7) {
      const t = Date.UTC(2026, 9, 1) + h * 3600e3;
      const m = A.moon(t, lat, lon), s = A.sun(t, lat, lon), L = A.moonLight(t);
      if (m.alt < 0.1 || L.fraction < 0.05 || L.fraction > 0.95) continue;
      /* direction to the sun in the moon's local frame: up = altitude, east = azimuth */
      const dAz = Math.atan2(Math.sin(s.az - m.az), Math.cos(s.az - m.az));
      const toSun = Math.atan2(Math.sin(dAz) * Math.cos(s.alt), Math.cos(m.alt) * Math.sin(s.alt) - Math.sin(m.alt) * Math.cos(s.alt) * Math.cos(dAz));
      /* limb is from up towards east; the bearing above is from up towards increasing azimuth (east) too */
      const diff = Math.abs(Math.atan2(Math.sin(A.limb(t, lat, lon) - toSun), Math.cos(A.limb(t, lat, lon) - toSun)));
      worst = Math.max(worst, diff); n++;
    }
  }
  ok(n > 100 && deg(worst) < 3, `over ${n} moments in five places, the lit side is within ${deg(worst).toFixed(1)}° of the sun's direction`);
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL ASTRO RULES PASS'));
process.exit(failures ? 1 : 0);
