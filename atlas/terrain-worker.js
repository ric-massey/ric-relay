/* ATLAS — the spot finder, off the main thread.
 *
 * Handed a block of elevation tiles, it stitches them into one grid, reads
 * the slope, and hands back the few spots most worth a look. A dozen tiles is
 * a million cells and filling every hollow in them takes a few hundred
 * milliseconds — long enough to make a pan stutter if it ran beside the map.
 *
 * The tiles come through the service worker like any other tile, so an area
 * saved for offline with "likely spots" on can be read with no signal.
 */

import {
  DEM_URL, decode, slope, metresPerPixel, tileLat, findCliffs, findSinks, pick,
} from './terrain.js';

const N = 256;

async function heights(z, x, y) {
  const url = DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  // No colour management: the colours ARE the heights, and a browser that
  // "corrects" them into the display's colour space moves every hill.
  const bmp = await createImageBitmap(await res.blob(),
    { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(N, N);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  bmp.close?.();
  return decode(g.getImageData(0, 0, N, N).data, N);
}

self.onmessage = async ({ data }) => {
  const { id, z, x0, y0, cols, rows } = data;
  try {
    const W = cols * N, H = rows * N;
    const h = new Float32Array(W * H);
    const jobs = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        jobs.push(heights(z, x0 + c, y0 + r).then((t) => {
          for (let row = 0; row < N; row++) {
            h.set(t.subarray(row * N, row * N + N), (r * N + row) * W + c * N);
          }
        }));
      }
    }
    // One missing tile is a flat square at sea level in the middle of the
    // grid, and its edges are the biggest cliffs in the state. All or nothing.
    await Promise.all(jobs);

    const mpp = metresPerPixel(z, y0 + rows / 2, N);
    const s = slope(h, W, H, mpp);
    // A long list, best first per kind: the block of tiles is bigger than the
    // screen, and the page keeps the best of the ones actually in view.
    const spots = pick([...findCliffs(h, s, W, H, mpp), ...findSinks(h, W, H, mpp)], mpp,
      { perKind: 120, apartMetres: 120 });
    const world = N * 2 ** z;
    self.postMessage({
      id,
      spots: spots.map((p) => ({
        kind: p.kind,
        lng: (x0 * N + p.x + 0.5) / world * 360 - 180,
        lat: tileLat(z, (y0 * N + p.y + 0.5) / N),
        relief: p.relief, slope: p.slope, depth: p.depth, across: p.across,
      })),
    });
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
