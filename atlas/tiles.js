/* Slippy-map tile maths.
 *
 * Split out from app.js so it can be tested without a browser. Getting this
 * wrong means downloading the wrong square of the planet and finding out about
 * it in a canyon, which is the worst possible place to find out about it.
 */

/** Which tile contains this point, at this zoom. */
export function lngLatToTile(lng, lat, z) {
  const n = 2 ** z;
  const latRad = lat * Math.PI / 180;
  return {
    x: Math.floor((lng + 180) / 360 * n),
    y: Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n),
  };
}

/** The geographic box a tile covers — the inverse of the above. */
export function tileToBBox(x, y, z) {
  const n = 2 ** z;
  const lngAt = (tx) => tx / n * 360 - 180;
  const latAt = (ty) => {
    const r = Math.PI - 2 * Math.PI * ty / n;
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(r) - Math.exp(-r)));
  };
  return { west: lngAt(x), east: lngAt(x + 1), north: latAt(y), south: latAt(y + 1) };
}

/**
 * The block of tiles a bounding box covers at one zoom, clamped to the world.
 * `bounds` is { west, south, east, north }.
 */
export function tileRange(bounds, z) {
  const n = 2 ** z;
  const topLeft = lngLatToTile(bounds.west, bounds.north, z);
  const botRight = lngLatToTile(bounds.east, bounds.south, z);
  return {
    x0: Math.max(0, Math.min(topLeft.x, botRight.x)),
    x1: Math.min(n - 1, Math.max(topLeft.x, botRight.x)),
    y0: Math.max(0, Math.min(topLeft.y, botRight.y)),
    y1: Math.min(n - 1, Math.max(topLeft.y, botRight.y)),
  };
}

/**
 * How many tiles that box needs across a zoom range — the same number
 * tileUrlsForBounds would return the length of, without building any of them.
 *
 * This exists because the estimate is recomputed every time the map stops
 * moving, and the honest answer for the whole country at street detail is in
 * the hundreds of millions. Counting it is arithmetic; building it is a
 * hundred million strings and a browser that never comes back. Nothing should
 * ever ask for that download, but the estimate has to be able to say so.
 */
export function tileCountForBounds(bounds, minZoom, maxZoom) {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    n += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  }
  return n;
}

/**
 * Every tile URL needed to cover a bounding box across a zoom range.
 * `bounds` is { west, south, east, north }.
 */
export function tileUrlsForBounds(bounds, minZoom, maxZoom, urlTemplate) {
  const urls = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const { x0, x1, y0, y1 } = tileRange(bounds, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(urlTemplate
          .replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return urls;
}

/* Which level of the pyramid MapLibre will actually ask for.
 *
 * Its zoom is reckoned against 512-pixel tiles, so a source declaring 256 is
 * asked for the level BELOW the map's own zoom, and one declaring 128 — which
 * is how a 256-pixel tile is made to fill a retina screen at its real density —
 * for the level below that again.
 *
 * This lives here, next to the maths it belongs to, because two entirely
 * separate things have to agree about it and only one of them fails loudly. The
 * map asks for a level; the offline download decides which levels to take up
 * the mountain. Take one level less than the map asks for and nothing warns
 * you, nothing throws, and the ground is simply blank in the canyon — which is
 * the one place the mistake cannot be fixed.
 */
export function tileZoomFor(mapZoom, tileCssSize) {
  return Math.max(0, Math.floor(mapZoom + Math.log2(512 / tileCssSize)));
}
