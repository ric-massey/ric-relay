/* 3D radar — node projects/weather/test/radar3d.test.mjs
   nexrad.js's volumePoints puts each gate where its beam is (up the
   4/3-earth beam, along the arc under it, at its azimuth), thins a volume
   to a budget and keeps only what passes; radar3d.js's camera maths puts
   what the camera looks at in the middle of the screen. Made-up sweeps:
   no real radar's data is needed to hold the geometry. The WebGL drawing
   itself was checked in Chromium (README, round eight). */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const NX = require('../nexrad.js');
const V = require('../radar3d.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const near = (a, b, e) => Math.abs(a - b) <= e;

/* a sweep in Level II's shape: 360 radials of 1°, 250-m gates from 2.125 km, every gate's byte = its value + 2 (dBZ ×1) */
function sweep(elev, fill, { heightM = 400, nBins = 1200 } = {}) {
  const nRad = 360, data = new Uint8Array(nRad * nBins), lut = new Float32Array(256).fill(NaN);
  for (let i = 2; i < 256; i++) lut[i] = i - 2 - 32;               // byte b means b − 34 dBZ
  for (let r = 0; r < nRad; r++) for (let b = 0; b < nBins; b++) { const v = fill(r + 0.5, 2.125 + b * 0.25); if (v != null) data[r * nBins + b] = Math.round(v) + 34; }
  return { elev, lat: 0, lon: 0, heightM, site: 'TEST', time: 0, nRad, nBins, az0: Float32Array.from({ length: nRad }, (_, r) => r), daz: new Float32Array(nRad).fill(1), gateKm: 0.25, firstKm: 2.25, data, lut };
}

console.log('\nRULE  every gate is drawn where its beam is');
{
  /* one echo: 40 dBZ at azimuth 90° (due east), 100 km out, on the 0.5° tilt */
  const sw = sweep(0.5, (az, km) => (Math.abs(az - 90.5) < 0.6 && Math.abs(km - 100) < 0.2 ? 40 : null));
  const P = NX.volumePoints([sw], { keep: (v) => v >= 20, radialDeg: 1, gateKm: 0.25 });
  ok(P.n >= 1, `the echo is found (${P.n} point${P.n === 1 ? '' : 's'})`);
  const x = P.pos[0], y = P.pos[1], z = P.pos[2], h = NX.beamHeightKm(100.125, 0.5) + 0.4;
  ok(near(x, 100, 0.5) && near(y, 0, 1.2), `due east: x ${x.toFixed(2)} km, y ${y.toFixed(2)} km`);
  ok(near(z, h, 0.05), `at the beam's height above sea level: ${z.toFixed(3)} km (the 4/3-earth beam ${h.toFixed(3)} km, the radar's 400 m included)`);
  ok(x < 100.125, 'the ground under a gate is a little short of its slant range');
  const hi = NX.volumePoints([sweep(19.5, (az, km) => (Math.abs(az - 0.5) < 0.6 && Math.abs(km - 40) < 0.2 ? 50 : null))], { radialDeg: 1, gateKm: 0.25 });
  ok(near(hi.pos[1], 40 * Math.cos(19.5 * Math.PI / 180), 0.6) && near(hi.pos[2], 40 * Math.sin(19.5 * Math.PI / 180) + 0.4, 0.4), `a steep tilt: 40 km out on the 19.5° beam is ${hi.pos[1].toFixed(1)} km north and ${hi.pos[2].toFixed(1)} km up`);
}

console.log('\nRULE  only what passes is drawn, and a big volume is thinned to its budget');
{
  const storm = (az, km) => (km > 50 && km < 120 && az > 200 && az < 250 ? 35 + (km % 10) : km < 30 ? 5 : null);
  const S = [0.5, 1.5, 2.4, 3.4].map((e) => sweep(e, storm));
  const all = NX.volumePoints(S, { keep: () => true, radialDeg: 1, gateKm: 1 });
  const strong = NX.volumePoints(S, { keep: (v) => v >= 20, radialDeg: 1, gateKm: 1 });
  ok(strong.n < all.n && Array.from(strong.val).every((v) => v >= 20), `the threshold keeps the storm and drops the weak echo near the radar (${strong.n} of ${all.n})`);
  ok(Array.from({ length: strong.n }, (_, i) => Math.atan2(strong.pos[3 * i], strong.pos[3 * i + 1]) * 180 / Math.PI + 360).every((a) => (a % 360) > 199 && (a % 360) < 251), 'every point of the storm lies between 200° and 250°');
  const capped = NX.volumePoints(S, { keep: () => true, radialDeg: 1, gateKm: 0.25, maxPoints: 20000 });
  ok(capped.n <= 20000 && capped.thinned, `past its budget the volume is thinned (${capped.n} points, said to be thinned)`);
  const vel = NX.volumePoints([sweep(0.5, () => 10)], { keep: (v) => Math.abs(v) >= 15, toUnit: 1.943844 });
  ok(vel.n > 0 && Math.abs(vel.val[0] - 10 * 1.943844) < 1e-4, 'values are turned into the unit drawn (m/s to knots) before the threshold');
  let threw = false; try { NX.volumePoints([]); } catch (e) { threw = true; }
  ok(threw, 'no tilts is said, not drawn');
}

console.log('\nRULE  the camera puts what it looks at in the middle');
{
  const cam = { yaw: 30, pitch: 40, dist: 300, target: [10, 20, 3] };
  const m = V.multiply(V.perspective(45, 1.5, 1, 5000), V.lookAt(V.eyeOf(cam), cam.target, [0, 0, 1]));
  const c = V.apply(m, cam.target);
  ok(near(c[0] / c[3], 0, 1e-5) && near(c[1] / c[3], 0, 1e-5) && c[3] > 0, 'the target is at the centre of the screen, in front of the eye');
  const e = V.eyeOf(cam);
  ok(near(Math.hypot(e[0] - 10, e[1] - 20, e[2] - 3), 300, 1e-6) && e[2] > 3, 'the eye is the distance away, above the ground');
  const north = V.eyeOf({ yaw: 0, pitch: 10, dist: 100, target: [0, 0, 0] });
  ok(north[1] < 0 && near(north[0], 0, 1e-9), 'yaw 0 looks north: the eye stands to the south');
  const up = V.apply(V.multiply(V.perspective(45, 1, 1, 5000), V.lookAt(V.eyeOf({ yaw: 0, pitch: 10, dist: 100, target: [0, 0, 0] }), [0, 0, 0], [0, 0, 1])), [0, 0, 10]);
  ok(up[1] / up[3] > 0, 'higher is up the screen');
  const I = V.multiply(V.perspective(45, 1, 1, 10), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  ok(Array.from(I).every((v, i) => near(v, V.perspective(45, 1, 1, 10)[i], 1e-7)), 'multiplying by the identity changes nothing');
}

console.log(failures ? `\n${failures} 3D RADAR RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL 3D RADAR RULES PASS');
process.exit(failures ? 1 : 0);
