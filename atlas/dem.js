/* ATLAS — elevation, on the main thread.
 *
 * One place that fetches and decodes elevation tiles, and remembers the last
 * few dozen, so everything that asks "how high is the ground here" — the
 * steep-ground and contour tiles, the height on a pin, the measure tool's
 * profile — shares one copy instead of each decoding the same PNG.
 *
 * The tiles go through fetch(), so the service worker answers them from a
 * saved area with no signal. (The spot finder has its own copy of the fetch in
 * its worker; a worker cannot share this cache.)
 */

import { DEM_URL, DEM_MAXZOOM, decode } from './terrain.js';

const N = 256;
const KEEP = 48;                       // ~12 MB of Float32 heights
const tiles = new Map();               // "z/x/y" -> Promise<Float32Array|null>

export function demTile(z, x, y) {
  const n = 2 ** z;
  x = ((x % n) + n) % n;
  if (y < 0 || y >= n) return Promise.resolve(null);
  const key = `${z}/${x}/${y}`;
  let p = tiles.get(key);
  if (p) {
    tiles.delete(key); tiles.set(key, p);          // most recently used last
    return p;
  }
  p = (async () => {
    const res = await fetch(DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    if (!res.ok) throw new Error(`elevation ${res.status}`);
    // No colour management: the colours ARE the heights.
    const bmp = await createImageBitmap(await res.blob(),
      { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(N, N);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    bmp.close?.();
    return decode(g.getImageData(0, 0, N, N).data, N);
  })().catch(() => { tiles.delete(key); return null; });
  tiles.set(key, p);
  while (tiles.size > KEEP) tiles.delete(tiles.keys().next().value);
  return p;
}

/* Fractional world pixel of a point at zoom z (256px tiles). */
export function worldPx(lng, lat, z) {
  const s = N * 2 ** z;
  const r = lat * Math.PI / 180;
  return {
    x: (lng + 180) / 360 * s,
    y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * s,
  };
}

/* A sampler over a set of world pixels at zoom z: loads every tile they touch
 * (plus one pixel round each, for interpolation), then answers heights
 * synchronously and bilinearly. Null if any tile would not load — a hole in
 * the middle reads as sea level, and sea level beside a mountain is a cliff
 * that is not there. */
export async function samplerFor(z, pts) {
  const keys = new Set();
  for (const { x, y } of pts) {
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      keys.add(`${Math.floor((x + dx) / N)}/${Math.floor((y + dy) / N)}`);
    }
  }
  const got = new Map();
  await Promise.all([...keys].map((k) => {
    const [tx, ty] = k.split('/').map(Number);
    return demTile(z, tx, ty).then((t) => got.set(k, t));
  }));
  for (const t of got.values()) if (!t) return null;

  // Height at the centre of world pixel (px, py), integers. A pixel in a tile
  // that was not loaded borrows the nearest edge of one that was.
  const px = (px, py) => {
    const tx = Math.floor(px / N), ty = Math.floor(py / N);
    let t = got.get(`${tx}/${ty}`);
    let ix = px - tx * N, iy = py - ty * N;
    if (!t) {
      for (const [k, v] of got) {
        const [kx, ky] = k.split('/').map(Number);
        if (Math.abs(kx - tx) <= 1 && Math.abs(ky - ty) <= 1) {
          t = v; ix = Math.min(N - 1, Math.max(0, px - kx * N)); iy = Math.min(N - 1, Math.max(0, py - ky * N));
          break;
        }
      }
    }
    return t[iy * N + ix];
  };
  return (x, y) => {
    const fx = x - 0.5, fy = y - 0.5;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const dx = fx - ix, dy = fy - iy;
    const a = px(ix, iy), b = px(ix + 1, iy), c = px(ix, iy + 1), d = px(ix + 1, iy + 1);
    return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
  };
}

/* The same over a rectangular block of world pixels (a map tile's worth). */
export function sampler(z, x0, y0, x1, y1) {
  return samplerFor(z, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 },
    { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }]);
}

/* The height of one point, in metres, at the finest data there is. */
export async function heightAt(lng, lat) {
  const p = worldPx(lng, lat, DEM_MAXZOOM);
  const s = await sampler(DEM_MAXZOOM, p.x, p.y, p.x, p.y);
  return s ? s(p.x, p.y) : null;
}

/* Heights along a line of [lng, lat] points, `count` samples evenly spaced by
 * the ground distances in `dists` (cumulative, metres, one per point). Only the
 * tiles under the line are loaded, and the zoom drops for long lines: a 40 km
 * line at full detail is hundreds of tiles for a chart 300 pixels wide. */
export async function heightsAlong(points, dists, count) {
  const total = dists[dists.length - 1];
  const z = total > 40000 ? 11 : total > 12000 ? 12 : total > 4000 ? 13 : 14;
  const ws = points.map(([lng, lat]) => worldPx(lng, lat, z));
  const at = [];
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const d = total * i / (count - 1);
    while (seg < dists.length - 2 && dists[seg + 1] < d) seg++;
    const span = dists[seg + 1] - dists[seg] || 1;
    const t = Math.min(1, Math.max(0, (d - dists[seg]) / span));
    at.push({ d, x: ws[seg].x + (ws[seg + 1].x - ws[seg].x) * t, y: ws[seg].y + (ws[seg + 1].y - ws[seg].y) * t });
  }
  const s = await samplerFor(z, at);
  return s ? at.map((p) => ({ d: p.d, h: s(p.x, p.y) })) : null;
}
