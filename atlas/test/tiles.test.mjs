/* Run: node test/tiles.test.mjs */
import assert from 'node:assert/strict';
import {
  lngLatToTile, tileToBBox, tileUrlsForBounds, tileCountForBounds, tileZoomFor,
} from '../tiles.js';

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

test('counting and building agree, which is the only reason counting is safe', () => {
  // The estimate counts and the download builds. If those two ever disagree the
  // number on the button is not the download you get, and the place you notice
  // is the place with no signal.
  const boxes = [
    { west: -105.29, south: 40.01, east: -105.28, north: 40.02 },
    { west: -111.3, south: 39.4, east: -111.1, north: 39.6 },
    { west: -0.01, south: -0.01, east: 0.01, north: 0.01 },   // across the seam
  ];
  for (const b of boxes) {
    for (const [lo, hi] of [[9, 12], [12, 14], [14, 14]]) {
      assert.equal(
        tileCountForBounds(b, lo, hi),
        tileUrlsForBounds(b, lo, hi, '{z}/{x}/{y}').length,
        `${JSON.stringify(b)} z${lo}-${hi}`);
    }
  }
});

test('the whole world is counted rather than built', () => {
  // The count for the planet at street detail is nine figures. This returns it
  // in microseconds; building the same list is a browser that never comes back,
  // and the panel needs the number in order to refuse.
  const world = { west: -180, south: -85, east: 180, north: 85 };
  assert.equal(tileCountForBounds(world, 0, 0), 1);
  assert.equal(tileCountForBounds(world, 0, 2), 1 + 4 + 16);
  assert.ok(tileCountForBounds(world, 9, 16) > 1e8);
});

console.log('\nwhich level gets asked for');

test('a 256-pixel tile is fetched one level below the map, a 128 two', () => {
  // MapLibre reckons its zoom against 512-pixel tiles. This is the whole of the
  // retina change in one line: the same picture, from a level deeper, drawn at
  // half the size, so a phone gets a real pixel per pixel instead of a stretched
  // third of one.
  assert.equal(tileZoomFor(15, 256), 16);
  assert.equal(tileZoomFor(15, 128), 17);
  assert.equal(tileZoomFor(15, 512), 15);
});

test('a part-way zoom asks for the level it has got past, not the next one', () => {
  // Floor, not round. Rounding up would ask for a level the map is not showing
  // yet, which on a metered connection is a quarter of the data for nothing.
  assert.equal(tileZoomFor(15.9, 256), 16);
  assert.equal(tileZoomFor(16.0, 256), 17);
});

test('the rule is the one MapLibre uses, written out a second way', () => {
  // The download's depth and the map's request come from this one function, so
  // asserting they agree with each other proves nothing. What is worth holding
  // is that the function is the RIGHT rule: MapLibre reckons zoom against
  // 512-pixel tiles, so a source declaring S is asked for zoom + log2(512/S).
  // Written here from that sentence rather than copied from the implementation.
  const asMapLibreDoesIt = (z, css) => Math.floor(z + Math.log(512 / css) / Math.LN2);
  for (const css of [512, 256, 128]) {
    for (const mapZoom of [3, 9, 12, 13.4, 14, 15, 16, 18]) {
      assert.equal(tileZoomFor(mapZoom, css), asMapLibreDoesIt(mapZoom, css),
        `z${mapZoom} at ${css}px`);
    }
  }
});

test('the shallow end never goes negative', () => {
  // Zoomed all the way out on a retina screen the arithmetic wants a level
  // below zero, and there is no such tile.
  assert.equal(tileZoomFor(0, 128), 2);
  assert.equal(tileZoomFor(0, 512), 0);
  assert.ok(tileZoomFor(-3, 512) >= 0);
});

console.log(`\n${passed} passed`);
