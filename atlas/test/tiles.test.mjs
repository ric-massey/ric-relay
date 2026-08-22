/* Run: node test/tiles.test.mjs */
import assert from 'node:assert/strict';
import { lngLatToTile, tileToBBox, tileUrlsForBounds } from '../tiles.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('tile maths');

test('zoom 0 is a single tile holding everything', () => {
  assert.deepEqual(lngLatToTile(0, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(lngLatToTile(-179, 80, 0), { x: 0, y: 0 });
});

test('the null island corner at z1', () => {
  // 0,0 sits on the seam of all four z1 tiles; floor lands it in the SE one.
  assert.deepEqual(lngLatToTile(0.001, -0.001, 1), { x: 1, y: 1 });
  assert.deepEqual(lngLatToTile(-0.001, 0.001, 1), { x: 0, y: 0 });
});

test('a point always falls inside the box of its own tile', () => {
  // Round-trip property: this is what catches a sign or projection error.
  const pts = [
    [-105.28, 40.02], [-122.4, 37.77], [-73.9, 40.7], [-149.9, 61.2],
    [-80.2, 25.8], [-111.9, 33.4], [-68.8, 44.8], [-155.5, 19.6],
  ];
  for (const [lng, lat] of pts) {
    for (const z of [8, 12, 14, 16, 17]) {
      const t = lngLatToTile(lng, lat, z);
      const b = tileToBBox(t.x, t.y, z);
      assert.ok(lng >= b.west && lng < b.east,
        `lng ${lng} outside [${b.west}, ${b.east}) at z${z}`);
      assert.ok(lat <= b.north && lat > b.south,
        `lat ${lat} outside (${b.south}, ${b.north}] at z${z}`);
    }
  }
});

test('x grows eastward and y grows southward', () => {
  const z = 12;
  assert.ok(lngLatToTile(-100, 40, z).x < lngLatToTile(-99, 40, z).x);
  assert.ok(lngLatToTile(-100, 41, z).y < lngLatToTile(-100, 40, z).y);
});

test('a box covers every tile its corners touch', () => {
  const bounds = { west: -105.32, south: 39.99, east: -105.24, north: 40.05 };
  const urls = tileUrlsForBounds(bounds, 14, 14, '{z}/{x}/{y}');
  const nw = lngLatToTile(bounds.west, bounds.north, 14);
  const se = lngLatToTile(bounds.east, bounds.south, 14);
  const expected = (se.x - nw.x + 1) * (se.y - nw.y + 1);
  assert.equal(urls.length, expected);
  assert.ok(urls.includes(`14/${nw.x}/${nw.y}`), 'missing the NW corner tile');
  assert.ok(urls.includes(`14/${se.x}/${se.y}`), 'missing the SE corner tile');
});

test('each extra zoom level is about four times the tiles', () => {
  // Needs a box many tiles wide: on a small one, grid alignment swamps the
  // ratio (a 5-wide box at z14 can be 8 rather than 10 wide at z15).
  const bounds = { west: -106, south: 39, east: -104, north: 41 };
  const one = tileUrlsForBounds(bounds, 12, 12, '{z}/{x}/{y}').length;
  const two = tileUrlsForBounds(bounds, 13, 13, '{z}/{x}/{y}').length;
  const ratio = two / one;
  assert.ok(ratio > 3.6 && ratio < 4.4, `${one} -> ${two} is ${ratio.toFixed(2)}x, not ~4x`);
});

test('a zoom range is the sum of its levels', () => {
  const bounds = { west: -105.32, south: 39.99, east: -105.24, north: 40.05 };
  const range = tileUrlsForBounds(bounds, 9, 16, '{z}/{x}/{y}').length;
  let sum = 0;
  for (let z = 9; z <= 16; z++) sum += tileUrlsForBounds(bounds, z, z, '{z}/{x}/{y}').length;
  assert.equal(range, sum);
});

test('tile indices never escape the world', () => {
  const whole = { west: -180, south: -85, east: 180, north: 85 };
  for (const z of [0, 1, 4]) {
    const n = 2 ** z;
    for (const u of tileUrlsForBounds(whole, z, z, '{z}/{x}/{y}')) {
      const [, x, y] = u.split('/').map(Number);
      assert.ok(x >= 0 && x < n, `x ${x} out of range at z${z}`);
      assert.ok(y >= 0 && y < n, `y ${y} out of range at z${z}`);
    }
  }
});

test('the URL template is filled in the right order', () => {
  const bounds = { west: -105.29, south: 40.01, east: -105.285, north: 40.015 };
  const [u] = tileUrlsForBounds(bounds, 14, 14, 'https://host/tile/{z}/{y}/{x}');
  const t = lngLatToTile(bounds.west, bounds.north, 14);
  assert.equal(u, `https://host/tile/14/${t.y}/${t.x}`);
});

console.log(`\n${passed} passed`);
