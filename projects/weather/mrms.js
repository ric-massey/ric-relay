/* MRMS — NOAA's Multi-Radar Multi-Sensor products on Weather Pro's map
   ────────────────────────────────────────────────────────────────────────────
   Every NEXRAD in the country blended every two minutes, with the model's
   temperatures and the rain gauges folded in, into the products a
   forecaster checks after a storm and during one: where rotation passed
   (rotation tracks), how big the hail was (MESH), how tall the reflectivity
   column is above the freezing level, how much rain fell. NOAA puts them on
   AWS (`noaa-mrms-pds`, CORS open) as gzipped GRIB2 with PNG packing;
   grib2.js's parseAsync reads them, keeping the largest value in each block
   so a rotation track a few hundred metres wide is not averaged away. Ric's
   call, 2026-10-22 ("do it").

   Each product is named as the bucket names it; `conv` turns MRMS's unit
   into the canonical unit modelmaps.js's palettes are built in. */
(function (root) {
  'use strict';

  const G = root.Grib2 || (typeof require === 'function' ? require('./grib2.js') : null);
  const BUCKET = 'https://noaa-mrms-pds.s3.amazonaws.com';

  /* pool: how many of MRMS's own grid points go into one of ours, each way —
     to about 2 km (0.02°), which holds a CONUS field in 6 million numbers */
  const PRODUCTS = {
    rot60: { name: 'RotationTrack60min_00.50', label: 'Rotation tracks, 0–2 km, past hour', group: 'Rotation', unit: 'rot', pal: 'rot', pool: 4 },
    rot240: { name: 'RotationTrack240min_00.50', label: 'Rotation tracks, 0–2 km, past 4 hours', group: 'Rotation', unit: 'rot', pal: 'rot', pool: 4 },
    rot1440: { name: 'RotationTrack1440min_00.50', label: 'Rotation tracks, 0–2 km, past 24 hours', group: 'Rotation', unit: 'rot', pal: 'rot', pool: 4 },
    rotml60: { name: 'RotationTrackML60min_00.50', label: 'Rotation tracks, 3–6 km, past hour', group: 'Rotation', unit: 'rot', pal: 'rot', pool: 4 },
    azshear: { name: 'MergedAzShear_0-2kmAGL_00.50', label: 'Rotation now (0–2 km azimuthal shear)', group: 'Rotation', unit: 'rot', pal: 'rot', pool: 4 },
    mesh: { name: 'MESH_00.50', label: 'Hail size now (MESH)', group: 'Hail', unit: 'hailin', pal: 'hail', pool: 2, conv: (mm) => mm / 25.4 },
    mesh60: { name: 'MESH_Max_60min_00.50', label: 'Largest hail, past hour (MESH)', group: 'Hail', unit: 'hailin', pal: 'hail', pool: 2, conv: (mm) => mm / 25.4 },
    mesh1440: { name: 'MESH_Max_1440min_00.50', label: 'Largest hail, past 24 hours (MESH)', group: 'Hail', unit: 'hailin', pal: 'hail', pool: 2, conv: (mm) => mm / 25.4 },
    posh: { name: 'POSH_00.50', label: 'Probability of severe hail', group: 'Hail', unit: 'pct', pal: 'posh', pool: 2 },
    ref10: { name: 'Reflectivity_-10C_00.50', label: 'Reflectivity at −10 °C', group: 'Storms', unit: 'dbz', pal: 'dbz', pool: 2 },
    comp: { name: 'MergedReflectivityQCComposite_00.50', label: 'Composite reflectivity (all radars, quality-controlled)', group: 'Storms', unit: 'dbz', pal: 'dbz', pool: 2 },
    tops50: { name: 'EchoTop_50_00.50', label: 'Echo tops, 50 dBZ', group: 'Storms', unit: 'kft', pal: 'tops', pool: 2, conv: (km) => km * 3.28084 },
    tops18: { name: 'EchoTop_18_00.50', label: 'Echo tops, 18 dBZ', group: 'Storms', unit: 'kft', pal: 'tops', pool: 2, conv: (km) => km * 3.28084 },
    vil: { name: 'VIL_00.50', label: 'VIL', group: 'Storms', unit: 'kgm2', pal: 'vil', pool: 2 },
    qpe1: { name: 'MultiSensor_QPE_01H_Pass2_00.00', label: 'Rain, past hour (radar and gauges)', group: 'Rain', unit: 'precip', pal: 'precip', pool: 2, conv: (mm) => mm / 25.4, every: 60 },
    qpe24: { name: 'MultiSensor_QPE_24H_Pass2_00.00', label: 'Rain, past 24 hours (radar and gauges)', group: 'Rain', unit: 'precip', pal: 'precip', pool: 2, conv: (mm) => mm / 25.4, every: 60 },
    rate: { name: 'PrecipRate_00.00', label: 'Rain rate now', group: 'Rain', unit: 'inhr', pal: 'precip', pool: 2, conv: (mmh) => mmh / 25.4 }
  };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`; };
  const hms = (ms) => { const d = new Date(ms); return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`; };
  /* MRMS_RotationTrack60min_00.50_20261022-200800.grib2.gz → its time */
  function keyTime(key) {
    const m = /_(\d{8})-(\d{6})\.grib2\.gz$/.exec(key);
    return m ? Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6), +m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4)) : null;
  }
  /* the product's files from the last `mins` minutes, oldest first */
  async function files(id, { mins = 30, nowMs = Date.now(), signal, fetchFn = fetch } = {}) {
    const P = PRODUCTS[id];
    if (!P) return [];
    const from = nowMs - mins * 60e3, days = [...new Set([ymd(from), ymd(nowMs)])], keys = [];
    for (const day of days) {
      const prefix = `CONUS/${P.name}/${day}/`;
      const q = new URLSearchParams({ 'list-type': '2', prefix });
      if (day === ymd(from)) q.set('start-after', `${prefix}MRMS_${P.name}_${day}-${hms(from)}`);
      const r = await fetchFn(`${BUCKET}/?${q}`, { signal });
      if (!r.ok) throw new Error('mrms: listing HTTP ' + r.status);
      keys.push(...[...(await r.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]));
    }
    return keys.map((key) => ({ key, t: keyTime(key), url: `${BUCKET}/${key}` })).filter((k) => k.t && k.t >= from).sort((a, b) => a.t - b.t);
  }
  /* one file → a layer the map painter draws: grid, values in the
     canonical unit, the product, and its time */
  async function load(id, file, { signal, fetchFn = fetch } = {}) {
    const P = PRODUCTS[id], r = await fetchFn(file.url, { signal });
    if (!r.ok) throw new Error('mrms: HTTP ' + r.status);
    const msg = await G.parseAsync(new Uint8Array(await r.arrayBuffer()), { pool: P.pool });
    if (P.conv) for (let i = 0; i < msg.values.length; i++) msg.values[i] = P.conv(msg.values[i]);
    return { field: { ...P, id }, grid: msg.grid, values: msg.values, valid: file.t };
  }

  const api = { BUCKET, PRODUCTS, keyTime, files, load };
  root.Mrms = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
