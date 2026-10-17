/* Run: node test/terrain.test.mjs
 *
 * The ground-reading maths, on made-up ground. Deliberately no real elevation
 * and no real place: a grid with a wall in it, a grid with a bowl in it, and
 * the things that look like one but are not. The thresholds themselves were
 * set against real tiles (see terrain.js); what this holds is that each
 * detector still finds what it is for and refuses what it is not.
 */
import assert from 'node:assert/strict';
import {
  terrarium, decode, slope, paintSlope, metresPerPixel, findCliffs, findSinks,
  fillDepressions, pick, rockFamily, rockOf, verdict, SLOPE_BANDS,
} from '../terrain.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

const N = 96, MPP = 8;
const grid = (f) => {
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = f(x, y);
  return h;
};
// A gentle tilt so nothing is perfectly flat — flat ground fills to nothing
// and would make the sink tests pass for the wrong reason.
const tilt = (x, y) => 200 + x * 0.05 + y * 0.03;

console.log('reading the ground');

test('terrarium decodes the way the tiles are packed', () => {
  assert.equal(terrarium(128, 0, 0), 0);
  assert.equal(terrarium(128, 100, 128), 100.5);
  assert.equal(terrarium(127, 255, 0), -1);
  const rgba = new Uint8ClampedArray([128, 10, 0, 255, 129, 0, 0, 255, 128, 0, 0, 255, 128, 0, 0, 255]);
  assert.deepEqual([...decode(rgba, 2)], [10, 256, 0, 0]);
});

test('ground metres per pixel shrink toward the poles', () => {
  const eq = metresPerPixel(14, 2 ** 13);          // the equator row
  assert.ok(Math.abs(eq - 9.55) < 0.05, `equator z14 is ~9.55 m, got ${eq}`);
  assert.ok(metresPerPixel(14, 6300) < eq);
});

test('slope: flat is 0°, a 1:1 ramp is 45°', () => {
  const flat = slope(grid(() => 100), N, N, MPP);
  assert.ok(flat.every((v) => v === 0));
  const ramp = slope(grid((x) => x * MPP), N, N, MPP);
  assert.ok(Math.abs(ramp[40 * N + 40] - 45) < 0.01);
});

test('the slope colours leave gentle ground alone and get louder with angle', () => {
  const s = Float32Array.from([10, 26.9, 27, 36, 50, 70]);
  const px = paintSlope(s);
  const alpha = [3, 7, 11, 15, 19, 23].map((i) => px[i]);
  assert.equal(alpha[0], 0); assert.equal(alpha[1], 0);
  for (let i = 3; i < alpha.length; i++) assert.ok(alpha[i] >= alpha[i - 1]);
  assert.equal(SLOPE_BANDS.at(-1).min, 60);
});

// A 40 m wall running north–south down the middle of the grid.
const wall = grid((x, y) => tilt(x, y) + (x < 48 ? 40 : 0));

test('a wall is found, at its TOP, with its height', () => {
  const s = slope(wall, N, N, MPP);
  const c = findCliffs(wall, s, N, N, MPP);
  assert.ok(c.length >= 1, 'no cliff found on a 40 m wall');
  for (const k of c) {
    assert.ok(k.x === 47 || k.x === 46, `spot should be on the lip (x 46–47), got ${k.x}`);
    assert.ok(k.relief >= 38 && k.relief <= 46, `relief ${k.relief}`);
  }
});

test('a long wall is cut into several spots, not one', () => {
  const s = slope(wall, N, N, MPP);
  assert.ok(findCliffs(wall, s, N, N, MPP).length >= 3);
});

test('a road cut is steep but too short to count', () => {
  const cut = grid((x, y) => tilt(x, y) + (x < 48 ? 6 : 0));
  assert.equal(findCliffs(cut, slope(cut, N, N, MPP), N, N, MPP).length, 0);
});

test('a big hillside is tall but not steep enough to count', () => {
  const hill = grid((x) => x * MPP * 0.6);               // ~31°, 450 m of relief
  assert.equal(findCliffs(hill, slope(hill, N, N, MPP), N, N, MPP).length, 0);
});

// A round bowl, 6 m deep and ~160 m across.
const bowl = grid((x, y) => {
  const r = Math.hypot(x - 40, y - 50);
  return tilt(x, y) - (r < 10 ? 6 * (1 - (r / 10) ** 2) : 0);
});

test('filling a bowl raises it to its rim and touches nothing else', () => {
  const f = fillDepressions(bowl, N, N);
  assert.ok(f[50 * N + 40] - bowl[50 * N + 40] > 5);
  assert.equal(f[5 * N + 5], bowl[5 * N + 5]);
});

test('a round closed hollow is found, at its deepest', () => {
  const k = findSinks(bowl, N, N, MPP);
  assert.equal(k.length, 1);
  assert.ok(Math.abs(k[0].x - 40) <= 1 && Math.abs(k[0].y - 50) <= 1);
  assert.ok(k[0].depth > 5 && k[0].depth < 7);
});

test('a long trench behind an embankment is not a sinkhole', () => {
  const trench = grid((x, y) => tilt(x, y) - (y > 45 && y < 50 && x > 10 && x < 80 ? 4 : 0));
  assert.equal(findSinks(trench, N, N, MPP).length, 0);
});

test('a dip too shallow to trust is left out', () => {
  const dimple = grid((x, y) => tilt(x, y) - (Math.hypot(x - 40, y - 40) < 6 ? 1 : 0));
  assert.equal(findSinks(dimple, N, N, MPP).length, 0);
});

test('pick keeps the best and keeps them apart', () => {
  const spots = [
    { kind: 'cliff', x: 10, y: 10, score: 5 }, { kind: 'cliff', x: 11, y: 10, score: 9 },
    { kind: 'cliff', x: 80, y: 80, score: 1 }, { kind: 'sink', x: 10, y: 11, score: 2 },
  ];
  const p = pick(spots, MPP, { perKind: 5, apartMetres: 100 });
  assert.deepEqual(p.map((s) => s.score), [9, 1, 2]);
});

console.log('what the rock is');

test('the first rock named wins', () => {
  assert.equal(rockFamily('sandstone | conglomerate | minor shale').key, 'sandstone');
  assert.equal(rockFamily('Major:{limestone}, Minor:{dolostone}').key, 'carbonate');
  assert.equal(rockFamily('shale with limestone beds').key, 'shale');
  assert.equal(rockFamily('Major:{silt}').key, 'loose');
  assert.equal(rockFamily(''), null);
});

test('no lithology falls back to the unit name', () => {
  const r = rockOf([{ scale: 'large', name: 'Some Granite and similar rocks', lith: '' }]);
  assert.equal(r.family.key, 'granite');
});

test('the most detailed map that names the rock is used', () => {
  const r = rockOf([
    { scale: 'small', name: 'Unit A', lith: 'basalt' },
    { scale: 'large', name: 'Unit B', lith: 'Major:{limestone}', b_int_name: 'Late Mississippian', t_int_name: 'Late Mississippian' },
  ]);
  assert.equal(r.family.key, 'carbonate');
  assert.equal(r.unit.name, 'Unit B');
  assert.equal(r.unit.lith, 'limestone');
  assert.equal(r.unit.age, 'Late Mississippian');
});

test('verdicts: only rock that backs it up is "likely"', () => {
  const sink = { kind: 'sink' }, cliff = { kind: 'cliff' };
  assert.equal(verdict(sink, rockFamily('limestone')).strong, true);
  assert.equal(verdict(sink, rockFamily('basalt')).strong, true);
  assert.equal(verdict(sink, rockFamily('glacial till')).strong, false);
  assert.equal(verdict(sink, null).strong, false);
  assert.equal(verdict(cliff, rockFamily('sandstone')).strong, true);
  assert.equal(verdict(cliff, rockFamily('alluvium')).strong, false);
});

console.log(`${passed} passed`);
