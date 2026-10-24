/* TERRAIN — the ground's height under Weather Pro's map
   ────────────────────────────────────────────────────────────────────────────
   Elevation comes from the open Terrain Tiles on AWS (the Registry of Open
   Data's "Terrain Tiles", s3://elevation-tiles-prod), in the "terrarium"
   encoding: a 256-px PNG per web-map tile whose red, green and blue are the
   height in metres,

       h = R × 256 + G + B / 256 − 32768

   assembled from USGS 3DEP over the US and SRTM, GMTED and ETOPO1 elsewhere
   (their own list of sources is the attribution, and the map's corner names
   it). The page fetches them while it runs, as it does Natural Earth's lines;
   nothing is committed — this room keeps real geography out of the repo.

   decode(rgba)        terrarium pixels → metres, one per pixel
   shade(elev, …)      a hillshade (Horn's slope, light from the north-west),
                       drawn as shadow and light over a dark map — never a
                       colour, so the radar's colours stay the radar's
   metresPerPixel(…)   a web-map pixel's width on the ground at a latitude
   pressureAt(h)       the standard atmosphere's pressure at a height (hPa),
                       to draw the ground on a pressure axis
   tileOf(lat, lon, z) which tile, and where in it, a point falls

   Pure: pixels in, numbers out. No DOM, so the tests hold it to the formulas. */
(function (root) {
  'use strict';
  const TILE = 256, MAXZ = 15;
  const url = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

  function decode(rgba) {
    const n = rgba.length >> 2, out = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = rgba[j] * 256 + rgba[j + 1] + rgba[j + 2] / 256 - 32768;
    return out;
  }

  const EARTH = 40075016.686;
  const metresPerPixel = (lat, z) => EARTH * Math.cos(lat * Math.PI / 180) / (TILE * 2 ** z);

  /* The hillshade: Horn's (1981) 3×3 slope and aspect, lit from azimuth 315°
     at 45° up — the cartographers' convention, so a ridge reads as raised.
     `ex` exaggerates the relief; at the national view the mountains are a
     few pixels wide and need it to show at all. Flat ground is left clear;
     slopes facing the light brighten, slopes away darken, by up to `k` of
     full opacity. The edge pixels borrow their neighbours. */
  function shade(elev, w, h, mpp, opts = {}) {
    const ex = opts.ex || 1, k = opts.k != null ? opts.k : 0.55;
    const az = (opts.az != null ? opts.az : 315) * Math.PI / 180, alt = (opts.alt != null ? opts.alt : 45) * Math.PI / 180;
    const zen = Math.PI / 2 - alt, flat = Math.cos(zen), out = new Uint8ClampedArray(w * h * 4);
    const at = (x, y) => elev[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y), g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
      const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * mpp) * ex;
      const dzdy = ((g + 2 * hh + i) - (a + 2 * b + c)) / (8 * mpp) * ex;
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      /* aspect clockwise from north; image y runs south */
      const aspect = Math.atan2(dzdx, -dzdy) + Math.PI;
      const lit = Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect);
      const o = (y * w + x) * 4, v = lit - flat;
      if (v > 0) { out[o] = out[o + 1] = out[o + 2] = 255; out[o + 3] = Math.round(Math.min(1, v / (1 - flat)) * k * 255); }
      else { out[o + 3] = Math.round(Math.min(1, -v / flat) * k * 255); }
    }
    return out;
  }

  /* the standard atmosphere (ICAO, to 11 km): pressure at a height, hPa */
  const pressureAt = (hM) => 1013.25 * Math.pow(1 - 2.25577e-5 * Math.max(-500, Math.min(11000, hM)), 5.25588);

  function tileOf(lat, lon, z) {
    const n = 2 ** z, s = Math.sin(lat * Math.PI / 180);
    const fx = (lon + 180) / 360 * n, fy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    const x = Math.floor(fx), y = Math.floor(fy);
    return { z, x: ((x % n) + n) % n, y, px: Math.min(TILE - 1, Math.floor((fx - x) * TILE)), py: Math.min(TILE - 1, Math.floor((fy - y) * TILE)) };
  }

  const api = { TILE, MAXZ, url, decode, shade, metresPerPixel, pressureAt, tileOf };
  root.Terrain = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
