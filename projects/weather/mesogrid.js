/* MESOGRID — the mesoanalysis the server computes, as the page reads it
   ────────────────────────────────────────────────────────────────────────────
   meso/build.mjs computes SPC's way — the RAP's one-hour forecast for the
   hour, its ground-level air replaced by NOAA's 15-minute surface analysis
   (RTMA), every column lifted through all of its levels by sounding.js —
   and writes one file an hour: every field on one grid. This is that file's
   shape, shared by the builder (encode) and the page (decode), so the two
   cannot drift. Ric, 2026-10-22: "do it", for a mesoanalysis as accurate and
   as fast as a professional's.

   The file: "MESO1\n", a 4-byte header length, the header (JSON: the grid,
   the valid time, the inputs, each field's scale and offset), then each
   field as 16-bit integers — value = offset + n × scale, −32768 for none —
   in the header's order, each field's low bytes then its high bytes (they
   compress better apart), the whole gzipped. About a megabyte. */
(function (root) {
  'use strict';

  /* id → what it is. `unit` and `pal` are modelmaps.js's, so the page draws
     these with the same palettes and units as every other map; `q` is the
     quantum each is stored to (finer than any palette step). */
  const FIELDS = [
    ['pmsl', 'Surface', 'Pressure, temperature and wind', 'temp', 'temp', 0.1, { contour: 'mslp', barbs: true }],
    ['td2m', 'Surface', 'Dew point and wind', 'temp', 'dew', 0.1, { barbs: true }],
    ['thetae', 'Surface', 'Theta-e (surface)', 'kelvin', 'thetae', 0.1],
    ['mcon', 'Surface', 'Moisture convergence (surface)', 'mcon', 'mcon', 0.01, { barbs: true }],
    ['sbcape', 'Thermodynamics', 'Surface-based CAPE', 'jkg', 'cape', 5],
    ['mlcape', 'Thermodynamics', 'Mixed-layer CAPE, CIN contoured', 'jkg', 'cape', 1, { contour: 'mlcin' }],
    ['mucape', 'Thermodynamics', 'Most-unstable CAPE', 'jkg', 'cape', 5],
    ['cape3', 'Thermodynamics', '0–3 km CAPE (mixed layer)', 'jkg', 'cape3', 1],
    ['dcape', 'Thermodynamics', 'Downdraft CAPE', 'jkg', 'dcape', 5],
    ['lr75', 'Thermodynamics', '700–500 mb lapse rate', 'lapse', 'lapse', 0.01],
    ['lr85', 'Thermodynamics', '850–500 mb lapse rate', 'lapse', 'lapse', 0.01],
    ['lr03', 'Thermodynamics', '0–3 km lapse rate', 'lapse', 'lapse', 0.01],
    ['lcl', 'Thermodynamics', 'LCL height (mixed layer)', 'magl', 'lcl', 5],
    ['lfc', 'Thermodynamics', 'LFC height (mixed layer)', 'magl', 'lcl', 5],
    ['frz', 'Thermodynamics', 'Freezing level', 'kft', 'tops', 0.01],
    ['pwat', 'Thermodynamics', 'Precipitable water', 'precip', 'pwat', 0.001],
    ['shear1', 'Wind shear', '0–1 km shear and barbs', 'kt', 'shear1', 0.1, { barbs: 'shear1' }],
    ['shear6', 'Wind shear', '0–6 km shear and barbs', 'kt', 'shear', 0.1, { barbs: 'shear6' }],
    ['ebwd', 'Wind shear', 'Effective bulk shear and barbs', 'kt', 'shear', 0.1, { barbs: 'ebwd' }],
    ['srh1', 'Wind shear', '0–1 km storm-relative helicity', 'm2s2', 'srh', 1],
    ['srh3', 'Wind shear', '0–3 km storm-relative helicity', 'm2s2', 'srh', 1],
    ['esrh', 'Wind shear', 'Effective storm-relative helicity', 'm2s2', 'srh', 1],
    ['motion', 'Wind shear', 'Storm motion (Bunkers right-mover)', 'kt', 'shear1', 0.1, { barbs: 'motion' }],
    ['stpe', 'Composites', 'Significant tornado parameter (effective layer)', 'index', 'stp', 0.01],
    ['stpf', 'Composites', 'Significant tornado parameter (fixed layer)', 'index', 'stp', 0.01],
    ['scpe', 'Composites', 'Supercell composite (effective layer)', 'index', 'scp', 0.01],
    ['ship', 'Composites', 'Significant hail parameter', 'index', 'ship', 0.01],
    ['dcp', 'Composites', 'Derecho composite', 'index', 'ehi', 0.01],
    ['ehi1', 'Composites', 'Energy-helicity index, 0–1 km', 'index', 'ehi', 0.01]
  ].map(([id, group, label, unit, pal, q, opt]) => ({ id, group, label, unit, pal, q, ...(opt || {}) }));
  /* the extra arrays the fields above draw with: contours and barbs (u, v in knots, earth-relative) */
  const EXTRA = [['mslp', 0.1], ['mlcin', 1], ['u10', 0.1], ['v10', 0.1],
    ['shear1u', 0.1], ['shear1v', 0.1], ['shear6u', 0.1], ['shear6v', 0.1], ['ebwdu', 0.1], ['ebwdv', 0.1], ['motionu', 0.1], ['motionv', 0.1]];

  const MAGIC = 'MESO1\n';
  const NONE = -32768;

  /* arrays: { id: Float32Array } for every FIELDS and EXTRA id; head: the
     grid ({ kind: 'latlon', la1, lo1, di, dj, nx, ny }), valid, inputs */
  function encode(arrays, head) {
    const order = [...FIELDS.map((f) => [f.id, f.q]), ...EXTRA];
    const scale = {}, chunks = [];
    for (const [id, q0] of order) {
      const a = arrays[id];
      if (!a) throw new Error('mesogrid: no ' + id);
      let lo = Infinity, hi = -Infinity;
      for (const v of a) if (v === v) { if (v < lo) lo = v; if (v > hi) hi = v; }
      if (lo === Infinity) { lo = 0; hi = 0; }
      /* a field wider than 65,534 steps gets a coarser step rather than being clipped */
      const q = Math.max(q0, (hi - lo) / 65000);
      const off = Math.floor(lo / q) * q + 32767 * q, out = new Int16Array(a.length);
      for (let i = 0; i < a.length; i++) {
        const v = a[i];
        out[i] = v === v ? Math.max(-32767, Math.min(32767, Math.round((v - off) / q))) : NONE;
      }
      scale[id] = [off, q];
      const b = new Uint8Array(out.buffer), sh = new Uint8Array(b.length), n = a.length;
      for (let i = 0; i < n; i++) { sh[i] = b[2 * i]; sh[n + i] = b[2 * i + 1]; }      // little-endian: low, then high
      chunks.push(sh);
    }
    const header = new TextEncoder().encode(JSON.stringify({ ...head, order: order.map(([id]) => id), scale }));
    const magic = new TextEncoder().encode(MAGIC), len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, header.length, true);
    const total = magic.length + 4 + header.length + chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let p = 0;
    for (const c of [magic, len, header, ...chunks]) { bytes.set(c, p); p += c.length; }
    return bytes;
  }
  /* the uncompressed file → { head, arrays } */
  function decode(bytes) {
    const magic = new TextDecoder().decode(bytes.subarray(0, MAGIC.length));
    if (magic !== MAGIC) throw new Error('mesogrid: not a mesoanalysis file');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const hl = dv.getUint32(MAGIC.length, true);
    const head = JSON.parse(new TextDecoder().decode(bytes.subarray(MAGIC.length + 4, MAGIC.length + 4 + hl)));
    const n = head.grid.nx * head.grid.ny, arrays = {};
    let p = MAGIC.length + 4 + hl;
    for (const id of head.order) {
      const [off, q] = head.scale[id], out = new Float32Array(n);
      for (let i = 0; i < n; i++) { const v = ((bytes[p + n + i] << 8) | bytes[p + i]) << 16 >> 16; out[i] = v === NONE ? NaN : off + v * q; }
      arrays[id] = out;
      p += n * 2;
    }
    return { head, arrays };
  }
  const field = (id) => FIELDS.find((f) => f.id === id) || null;

  const api = { FIELDS, EXTRA, encode, decode, field, MAGIC };
  root.MesoGrid = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
