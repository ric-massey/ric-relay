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
 * Every tile URL needed to cover a bounding box across a zoom range.
 * `bounds` is { west, south, east, north }.
 */
export function tileUrlsForBounds(bounds, minZoom, maxZoom, urlTemplate) {
  const urls = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const n = 2 ** z;
    const topLeft = lngLatToTile(bounds.west, bounds.north, z);
    const botRight = lngLatToTile(bounds.east, bounds.south, z);

    const x0 = Math.max(0, Math.min(topLeft.x, botRight.x));
    const x1 = Math.min(n - 1, Math.max(topLeft.x, botRight.x));
    const y0 = Math.max(0, Math.min(topLeft.y, botRight.y));
    const y1 = Math.min(n - 1, Math.max(topLeft.y, botRight.y));

    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        urls.push(urlTemplate
          .replace('{z}', z).replace('{x}', x).replace('{y}', y));
      }
    }
  }
  return urls;
}
