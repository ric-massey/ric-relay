/* Terrain — node projects/weather/test/terrain.test.mjs
   terrain.js turns the open Terrain Tiles' "terrarium" pixels into heights
   and a hillshade. Held here to the encoding's own formula and to which way
   a slope faces, on made-up pixels: this room commits no real geography, so
   there is no real tile in fixtures/. No network. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../terrain.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

console.log('\nRULE  terrarium pixels are metres: R×256 + G + B/256 − 32768');
{
  const enc = (h) => { const v = h + 32768, r = Math.floor(v / 256), g = Math.floor(v - r * 256), b = Math.round((v - Math.floor(v)) * 256); return [r, g, b, 255]; };
  const heights = [0, -86, 1479.5, 4257, 8848];
  const px = Uint8ClampedArray.from(heights.flatMap(enc)), e = T.decode(px);
  ok(heights.every((h, i) => Math.abs(e[i] - h) < 1 / 256 + 1e-6), `heights come back exactly (${[...e].map((x) => x.toFixed(1)).join(', ')} m)`);
}

console.log('\nRULE  the hillshade lights slopes facing the north-west and shades the others; flat ground is clear');
{
  const n = 9, mpp = 100;
  const grid = (f) => Float32Array.from({ length: n * n }, (_, i) => f(i % n, Math.floor(i / n)));
  const alphaAt = (px, x, y) => px[(y * n + x) * 4 + 3], white = (px, x, y) => px[(y * n + x) * 4] === 255;
  const flat = T.shade(grid(() => 500), n, n, mpp);
  ok(alphaAt(flat, 4, 4) === 0, 'flat ground draws nothing');
  /* ground rising toward the south-east faces north-west: toward the light */
  const towardLight = T.shade(grid((x, y) => (x + y) * 30), n, n, mpp);
  ok(white(towardLight, 4, 4) && alphaAt(towardLight, 4, 4) > 0, 'a slope facing the light is drawn as light');
  const away = T.shade(grid((x, y) => -(x + y) * 30), n, n, mpp);
  ok(!white(away, 4, 4) && alphaAt(away, 4, 4) > 0, 'a slope facing away is drawn as shadow');
  const steep = T.shade(grid((x, y) => -(x + y) * 90), n, n, mpp);
  ok(alphaAt(steep, 4, 4) > alphaAt(away, 4, 4), 'a steeper slope away from the light is darker');
  const ex = T.shade(grid((x, y) => -(x + y) * 30), n, n, mpp, { ex: 3 });
  ok(alphaAt(ex, 4, 4) > alphaAt(away, 4, 4), 'exaggeration deepens the shading');
  ok([...steep].every(Number.isFinite), 'every pixel is a number');
}

console.log('\nRULE  the standard atmosphere, the tile maths and the pixel size');
{
  ok(Math.abs(T.pressureAt(0) - 1013.25) < 0.01, 'sea level is 1013.25 hPa');
  ok(Math.abs(T.pressureAt(1500) - 845.6) < 1, `1,500 m is about 846 hPa (${T.pressureAt(1500).toFixed(1)})`);
  ok(Math.abs(T.pressureAt(5500) - 505.4) < 2, `5,500 m is about 505 hPa (${T.pressureAt(5500).toFixed(1)})`);
  const t = T.tileOf(0, 0, 1);
  ok(t.x === 1 && t.y === 1 && t.px === 0 && t.py === 0, 'the middle of the world is the corner of the four zoom-1 tiles');
  const w = T.tileOf(10, 190, 3);
  ok(w.x >= 0 && w.x < 8, 'a longitude past 180 wraps onto the map');
  ok(Math.abs(T.metresPerPixel(0, 0) - 156543.03) < 0.1, 'a zoom-0 pixel at the equator is 156.5 km');
  ok(/^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\/7\/30\/50\.png$/.test(T.url(7, 30, 50)), "tiles come from the open bucket's terrarium set");
}

console.log(failures ? `\n${failures} TERRAIN RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL TERRAIN RULES PASS');
process.exit(failures ? 1 : 0);
