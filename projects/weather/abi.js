/* ABI — GOES-East and GOES-West's Advanced Baseline Imager on Weather Pro's map
   ────────────────────────────────────────────────────────────────────────────
   All sixteen of the imager's bands and the RGB composites forecasters read
   storms and air masses off (Airmass, Day Cloud Phase, Day Convection,
   Night Microphysics, Dust, Fire Temperature, True and Natural Color), for
   the whole lower 48 every five minutes or for one of the two mesoscale
   sectors NOAA points at active weather every minute. Ric, 2026-10-22:
   "do it", after the list of what professional sites have that this does not.

   NOAA puts the Level 2 Cloud and Moisture Imagery on AWS (`noaa-goes19`,
   `noaa-goes18`, CORS open) as netCDF-4 — HDF5 — with every band at 2 km in
   one "multi-band" file (MCMIP). glm.js's HDF5 reader reads only the bands a
   product needs, chunk by chunk with Range requests: about 3.5 MB a band for
   the lower 48, about 0.3 MB for a mesoscale sector.

   The image is on the satellite's own fixed grid: scan angles x and y, seen
   from 35,786 km over the equator. `projector` is the GOES-R Product User's
   Guide's navigation (vol. 5, §4.2.8), both ways, on the GRS80 ellipsoid the
   file names.

   The RGB recipes are the ones in CIRA/RAMMB's and EUMETSAT's quick guides:
   each colour is one band or the difference of two, stretched over a fixed
   range and raised to a fixed gamma — so a forecaster's eye reads them as it
   does everywhere else. Every one is named with its source in RECIPES. */
(function (root) {
  'use strict';

  const GL = root.Glm || (typeof require === 'function' ? require('./glm.js') : null);

  const SATS = {
    east: { bucket: 'https://noaa-goes19.s3.amazonaws.com', id: 'G19', label: 'GOES-East (GOES-19)' },
    west: { bucket: 'https://noaa-goes18.s3.amazonaws.com', id: 'G18', label: 'GOES-West (GOES-18)' }
  };
  /* east of 105° W GOES-East sees the map better, west of it GOES-West —
     the same split glm.js uses for lightning */
  const SPLIT_LON = -105;
  const SECTORS = {
    conus: { product: 'MCMIPC', tag: 'MCMIPC', every: 5, frames: 6, label: 'Lower 48, every 5 minutes' },
    m1: { product: 'MCMIPM', tag: 'MCMIPM1', every: 1, frames: 20, label: 'Mesoscale sector 1, every minute' },
    m2: { product: 'MCMIPM', tag: 'MCMIPM2', every: 1, frames: 20, label: 'Mesoscale sector 2, every minute' }
  };

  /* the sixteen bands: centre wavelength (µm), what it is called, and
     whether it is read as reflectance (0–1) or brightness temperature (K) */
  const BANDS = {
    1: [0.47, 'Blue', 'refl'], 2: [0.64, 'Red (visible)', 'refl'], 3: [0.86, 'Veggie (near-IR)', 'refl'], 4: [1.37, 'Cirrus', 'refl'],
    5: [1.6, 'Snow/ice', 'refl'], 6: [2.2, 'Cloud particle size', 'refl'], 7: [3.9, 'Shortwave window', 'bt'], 8: [6.2, 'Upper-level water vapour', 'bt'],
    9: [6.9, 'Mid-level water vapour', 'bt'], 10: [7.3, 'Lower-level water vapour', 'bt'], 11: [8.4, 'Cloud-top phase', 'bt'], 12: [9.6, 'Ozone', 'bt'],
    13: [10.3, 'Clean longwave window', 'bt'], 14: [11.2, 'Longwave window', 'bt'], 15: [12.3, 'Dirty longwave window', 'bt'], 16: [13.3, 'CO₂ longwave', 'bt']
  };
  const bandName = (b) => `Band ${b} · ${BANDS[b][0]} µm ${BANDS[b][1].toLowerCase()}`;

  /* ── colour ── */
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const ramp = (stops) => {
    const S = stops.map(([v, c]) => [v, hex(c)]);
    return (v) => {
      if (!(v === v)) return null;
      if (v >= S[0][0]) return S[0][1];
      for (let i = 1; i < S.length; i++) if (v >= S[i][0]) {
        const [a, A] = S[i - 1], [b, B] = S[i], t = (a - v) / (a - b);
        return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
      }
      return S[S.length - 1][1];
    };
  };
  /* longwave IR, °C: warm ground dark grey to white cloud at −30, then the
     cold tops in colour, as the NWS's enhanced IR draws them */
  const IR = ramp([[50, '#000000'], [-30, '#e8e8e8'], [-30.01, '#8fd3ff'], [-40, '#2f6fff'], [-50, '#1fbf5a'], [-60, '#ffef3a'], [-65, '#ff9f1a'],
    [-70, '#ff2a1a'], [-75, '#9a0a0a'], [-80, '#000000'], [-85, '#ffffff'], [-95, '#d070ff']]);
  /* water vapour, °C: dry (warm) brown and orange, moist (cold) white, blue, green */
  const WV = ramp([[0, '#1a0c00'], [-15, '#8a4410'], [-25, '#e0a060'], [-32, '#ffffff'], [-40, '#a6cfff'], [-50, '#2f6fd9'], [-60, '#1fa05a'], [-70, '#c8f0c8'], [-80, '#ffffff']]);
  const GREY_IR = (c) => { const g = Math.max(0, Math.min(255, (50 - c) / 130 * 255)); return [g, g, g]; };   // +50 °C black … −80 °C white
  const GREY_VIS = (r) => { const g = Math.max(0, Math.min(255, Math.sqrt(Math.max(0, r)) * 255)); return [g, g, g]; };   // gamma 2: the eye's own

  /* one colour channel: (x − lo) / (hi − lo), clipped, to the 1/gamma */
  const ch = (x, lo, hi, gamma = 1) => { const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return 255 * (gamma === 1 ? t : t ** (1 / gamma)); };

  /* ── the products ── `bands` are what is read; `rgb(v)` takes the bands'
     values (reflectance 0–1 or brightness temperature K) and gives a colour */
  const PRODUCTS = {
    /* CIRA/RAMMB Airmass RGB quick guide: jets, troughs, dry intrusions, the
       stratospheric air that comes down behind a deepening low */
    airmass: { group: 'RGB composites', label: 'Airmass', bands: [8, 10, 12, 13],
      rgb: (v) => [ch(v[8] - v[10], -26.2, 0.6), ch(v[12] - v[13], -43.2, 6.7), ch(v[8], 243.9, 208.5)] },
    /* RAMMB Day Cloud Phase Distinction: cold ice tops red to yellow,
       water clouds cyan to green, glaciating towers stand out */
    dcp: { group: 'RGB composites', label: 'Day Cloud Phase Distinction (day)', bands: [13, 2, 5],
      rgb: (v) => [ch(v[13] - 273.15, 7.5, -53.5), ch(v[2] * 100, 0, 78), ch(v[5] * 100, 1, 59)] },
    /* EUMETSAT/RAMMB Day Convection: young strong updrafts with small ice
       particles bright yellow */
    convection: { group: 'RGB composites', label: 'Day Convection (day)', bands: [8, 10, 7, 13, 5, 2],
      rgb: (v) => [ch(v[8] - v[10], -35, 5), ch(v[7] - v[13], -5, 60), ch(v[5] - v[2], -0.75, 0.25)] },
    /* RAMMB Nighttime Microphysics: fog and low stratus at night */
    ntmicro: { group: 'RGB composites', label: 'Night Microphysics (fog, night)', bands: [15, 13, 7],
      rgb: (v) => [ch(v[15] - v[13], -6.7, 2.6), ch(v[13] - v[7], -3.1, 5.2), ch(v[13], 243.55, 292.65)] },
    /* RAMMB Dust RGB */
    dust: { group: 'RGB composites', label: 'Dust', bands: [15, 13, 14, 11],
      rgb: (v) => [ch(v[15] - v[13], -6.7, 2.6), ch(v[14] - v[11], -0.5, 20, 2.5), ch(v[13], 261.2, 288.7)] },
    /* RAMMB Fire Temperature: active fires red, hotter ones yellow to white */
    fire: { group: 'RGB composites', label: 'Fire Temperature', bands: [7, 6, 5],
      rgb: (v) => [ch(v[7] - 273.15, 0, 60, 0.4), ch(v[6] * 100, 0, 100), ch(v[5] * 100, 0, 75)] },
    /* RAMMB Day Land Cloud ("natural color") */
    natural: { group: 'RGB composites', label: 'Natural Color (day)', bands: [5, 3, 2],
      rgb: (v) => [ch(v[5] * 100, 0, 97.5), ch(v[3] * 100, 0, 108.6), ch(v[2] * 100, 0, 100)] },
    /* CIMSS true colour: the ABI has no green band, so green is made from
       red, blue and the vegetation band (Bah et al. 2018) */
    truecolor: { group: 'RGB composites', label: 'True Color (day)', bands: [1, 2, 3],
      rgb: (v) => {
        const r = Math.max(0, v[2]), b = Math.max(0, v[1]), g = Math.max(0, 0.45 * r + 0.1 * v[3] + 0.45 * b);
        return [ch(r, 0, 1, 2.2), ch(g, 0, 1, 2.2), ch(b, 0, 1, 2.2)];
      } }
  };
  for (const b of Object.keys(BANDS).map(Number)) {
    const [, , kind] = BANDS[b];
    PRODUCTS['b' + b] = { group: 'Single bands', label: bandName(b) + (b === 13 ? ' — enhanced' : ''), bands: [b], band: b,
      rgb: kind === 'refl' ? (v) => GREY_VIS(v[b])
        : b >= 8 && b <= 10 ? (v) => WV(v[b] - 273.15)
        : b === 13 ? (v) => IR(v[b] - 273.15)
        : (v) => GREY_IR(v[b] - 273.15) };
  }

  /* ── the fixed grid ── */
  function projector(P, xs, ys) {
    const req = P.semi_major_axis, rpol = P.semi_minor_axis, H = P.perspective_point_height + req;
    const l0 = P.longitude_of_projection_origin * Math.PI / 180, e2 = (req * req - rpol * rpol) / (req * req), q = (req * req) / (rpol * rpol);
    const x0 = xs[0], dx = xs[1] - xs[0], y0 = ys[0], dy = ys[1] - ys[0], nx = xs.length, ny = ys.length;
    /* PUG vol. 5 §4.2.8.2: latitude and longitude to scan angles */
    const ij = (lat, lon) => {
      const phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
      const pc = Math.atan(Math.tan(phi) / q), cp = Math.cos(pc), rc = rpol / Math.sqrt(1 - e2 * cp * cp);
      const sx = H - rc * cp * Math.cos(lam - l0), sy = -rc * cp * Math.sin(lam - l0), sz = rc * Math.sin(pc);
      if (H * (H - sx) < sy * sy + q * sz * sz) return [NaN, NaN];                // the far side of the earth
      const x = Math.asin(-sy / Math.sqrt(sx * sx + sy * sy + sz * sz)), y = Math.atan(sz / sx);
      return [(x - x0) / dx, (y - y0) / dy];
    };
    /* §4.2.8.1: scan angles to latitude and longitude */
    const ll = (i, j) => {
      const x = x0 + i * dx, y = y0 + j * dy, cx = Math.cos(x), sxn = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
      const a = sxn * sxn + cx * cx * (cy * cy + q * sy * sy), b = -2 * H * cx * cy, c = H * H - req * req, disc = b * b - 4 * a * c;
      if (disc < 0) return [NaN, NaN];
      const rs = (-b - Math.sqrt(disc)) / (2 * a), px = rs * cx * cy, py = -rs * sxn, pz = rs * cx * sy;
      return [Math.atan(q * pz / Math.sqrt((H - px) ** 2 + py * py)) * 180 / Math.PI, (l0 - Math.atan(py / (H - px))) * 180 / Math.PI];
    };
    return { kind: 'geos', nx, ny, ij, ll };
  }

  /* ── the bucket ──
     ABI-L2-MCMIPC/YYYY/DDD/HH/OR_ABI-L2-MCMIPC-M6_G19_sYYYYDDDHHMMSSt_e…_c….nc */
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function hourPrefix(product, ms) {
    const d = new Date(ms), y = d.getUTCFullYear(), doy = Math.floor((ms - Date.UTC(y, 0, 1)) / 86400e3) + 1;
    return `ABI-L2-${product}/${y}/${pad(doy, 3)}/${pad(d.getUTCHours())}/`;
  }
  const fileStart = GL.fileStart;
  /* the sector's newest files, oldest first */
  async function files(sat, sector, { nowMs = Date.now(), count, signal, fetchFn = fetch } = {}) {
    const S = SATS[sat], C = SECTORS[sector], n = count || C.frames;
    const prefixes = [...new Set([hourPrefix(C.product, nowMs - (n * C.every + 10) * 60e3), hourPrefix(C.product, nowMs)])];
    const keys = [];
    for (const pre of prefixes) {
      const r = await fetchFn(`${S.bucket}/?${new URLSearchParams({ 'list-type': '2', prefix: pre })}`, { signal });
      if (!r.ok) throw new Error('abi: listing HTTP ' + r.status);
      const xml = await r.text(), re = /<Key>([^<]+)<\/Key>/g;
      let m;
      while ((m = re.exec(xml))) if (m[1].includes(`-${C.tag}-`)) keys.push(m[1]);
    }
    return keys.map((key) => ({ key, t: fileStart(key), url: `${S.bucket}/${key}`, sat, sector }))
      .filter((k) => k.t).sort((a, b) => a.t - b.t).slice(-n);
  }

  /* One file, one product: the grid, each band's values (reflectance or
     kelvin, kept as the file's 16-bit counts) and the image as one RGBA word per pixel.
     `memo` carries the projection and the x/y axes from the first file of a
     sector to the rest (they do not change while the sector stays put). */
  async function load(file, productId, { memo, signal, fetchFn = fetch } = {}) {
    const P = PRODUCTS[productId];
    if (!P) throw new Error('abi: no product ' + productId);
    const f = await GL.open(GL.fromUrl(file.url, { signal, fetchFn }));
    const [xs, ys, proj, ext] = await Promise.all([GL.variable(f, 'x'), GL.variable(f, 'y'), GL.attrsOf(f, 'goes_imager_projection'), GL.attrsOf(f, 'geospatial_lat_lon_extent').catch(() => ({}))]);
    const grid = projector(proj, xs.values, ys.values), n = grid.nx * grid.ny;
    const memoV = memo || {};
    /* each band as its 16-bit counts and the scale to read them by */
    const vals = {};
    await Promise.all(P.bands.map(async (b) => {
      const v = await GL.variable(f, 'CMI_C' + pad(b), memoV['C' + b], { raw16: true });
      memoV['C' + b] = v.attrs;
      vals[b] = v;
    }));
    const rgba = new Uint32Array(n), v = {}, B = P.bands.map((b) => [b, vals[b]]);
    for (let i = 0; i < n; i++) {
      let ok = true;
      for (const [b, c] of B) { const r = c.raw[i]; if (r === c.fill) { ok = false; break; } v[b] = r * c.scale + c.offset; }
      if (!ok) continue;
      const c = P.rgb(v);
      if (c) rgba[i] = ((255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0])) >>> 0;
    }
    const box = ext.geospatial_westbound_longitude != null
      ? { w: ext.geospatial_westbound_longitude, e: ext.geospatial_eastbound_longitude, n: ext.geospatial_northbound_latitude, s: ext.geospatial_southbound_latitude } : null;
    return { product: { ...P, id: productId }, grid, rgba, bands: vals, valid: file.t, sat: file.sat, sector: file.sector, box };
  }

  /* what the bands say at a place: reflectance in %, brightness temperature in °C */
  function valuesAt(layer, lat, lon) {
    const [fi, fj] = layer.grid.ij(lat, lon), i = Math.round(fi), j = Math.round(fj);
    if (!(i >= 0 && j >= 0 && i < layer.grid.nx && j < layer.grid.ny)) return null;
    const out = [];
    for (const b of layer.product.bands) {
      const c = layer.bands[b], r = c.raw[j * layer.grid.nx + i];
      if (r === c.fill) return null;
      const x = r * c.scale + c.offset;
      out.push({ band: b, kind: BANDS[b][2], value: BANDS[b][2] === 'refl' ? x * 100 : x - 273.15 });
    }
    return out;
  }

  /* ── the colour key under the map ── what each RGB's colours mean, from
     the same quick guides, and the scale of a single band */
  const KEYS = {
    airmass: [['Dry, sinking upper air (jet, trough)', '#c83c32'], ['Warm, moist air', '#3c9b46'], ['Cold polar air', '#5a4bb4'], ['Thick high cloud', '#e6e6e6']],
    dcp: [['Low water cloud', '#46d2dc'], ['Thick ice cloud', '#f0dc3c'], ['Thin ice cloud', '#e6643c'], ['Snow on the ground', '#3cb43c'], ['Clear', '#283c8c']],
    convection: [['Young strong updrafts', '#f5e650'], ['Older anvil', '#d25a32']],
    ntmicro: [['Fog, low stratus', '#5ad2be'], ['Thick cold cloud', '#8c1e1e'], ['Clear ground', '#d28cb4']],
    dust: [['Dust', '#e646b4'], ['Thick cold cloud', '#78141e']],
    fire: [['Active fire', '#e63c28'], ['Intense fire', '#ffff96']]
  };
  function key(id) {
    const P = PRODUCTS[id];
    if (!P) return null;
    if (KEYS[id]) return { cats: KEYS[id] };
    if (!P.band) return { text: 'As the eye would see it' };
    const kind = BANDS[P.band][2];
    if (kind === 'refl') return { unit: '%', min: 0, max: 100, stops: [0, 25, 50, 75, 100].map((r) => [r, `rgb(${GREY_VIS(r / 100).map(Math.round).join(',')})`]), ticks: [0, 25, 50, 75, 100] };
    const fn = P.band >= 8 && P.band <= 10 ? WV : P.band === 13 ? IR : GREY_IR, lo = P.band >= 8 && P.band <= 10 ? -80 : -95, hi = P.band >= 8 && P.band <= 10 ? 0 : 40, out = [];
    for (let c = hi; c >= lo; c -= 2.5) out.push([c, `rgb(${fn(c).map(Math.round).join(',')})`]);
    return { unit: '°C', min: lo, max: hi, stops: out.reverse(), ticks: P.band >= 8 && P.band <= 10 ? [-70, -50, -30, -10] : [-80, -60, -40, -20, 0, 20] };
  }

  const api = { SATS, SPLIT_LON, SECTORS, BANDS, PRODUCTS, bandName, projector, hourPrefix, files, load, valuesAt, ch, key };
  root.Abi = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
