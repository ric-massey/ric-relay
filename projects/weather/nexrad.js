/* NEXRAD Level III — one radar's own products, read in the browser
   ────────────────────────────────────────────────────────────────────────────
   Weather Pro's single-site radar. IEM tiles only base reflectivity and
   storm-relative velocity (probed 2026-10-17), and a forecaster reads a storm
   on the dual-pol products — correlation coefficient for debris, ZDR and KDP
   for hail and heavy rain, the hydrometeor classification — at more than one
   tilt. Every NEXRAD's Level III files land in Unidata's public bucket on AWS
   (`unidata-nexrad-level3`, CORS open) within a minute or two of the scan, so
   the page lists the bucket, fetches the files and decodes them here. No
   server, no tiles, nothing stored. Ric's call, 2026-10-22 ("do the three").

   The format is the NWS's Product Specification ICD (2620001). What is read:
     the WMO header and the message header,
     the product description block (site, time, elevation, the thresholds
       that turn a stored byte into a value),
     the symbology block — bzip2-compressed for the digital products
       (bzip2.js), plain for the legacy ones,
     packet 16 (digital radial data, one byte a gate) and packet AF1F (the
       run-length radials of the 16-level legacy products, storm-relative
       velocity among them).
   How a byte becomes a value follows MetPy's mappers product by product, and
   `test/decoders.test.mjs` holds this file to MetPy on real files.

   Exports for Node too (the tests), like wx.js. */
(function (root) {
  'use strict';

  const Bz = root.Bzip2 || (typeof require === 'function' ? require('./bzip2.js') : null);

  const BUCKET = 'https://unidata-nexrad-level3.s3.amazonaws.com';

  /* ── the products this page reads, by what a forecaster calls them ──
     `tilts` are the bucket's product names from the lowest scan up; which
     elevation each is depends on the volume coverage pattern, so the label
     comes from the file, not from here. `unit` is what the legend and the
     readout say; `toUnit` turns the stored unit into it. */
  const KT = 1 / 0.514444;
  const PRODUCTS = {
    /* `l2` is the same moment in the full volume (level2.js); a product with
       no Level III tilts (spectrum width) is read from Level II only */
    ref: { label: 'Reflectivity', short: 'REF', tilts: ['N0B', 'N1B', 'N2B', 'N3B'], unit: 'dBZ', l2: 'REF',
      long: 'Base reflectivity, super-resolution — how much the beam came back', pal: 'ref' },
    vel: { label: 'Velocity', short: 'VEL', tilts: ['N0G', 'N1G', 'N2U', 'N3U'], unit: 'kt', toUnit: KT, l2: 'VEL',
      long: 'Base radial velocity — green toward the radar, red away', pal: 'vel' },
    sw: { label: 'Spectrum width', short: 'SW', tilts: [], unit: 'kt', toUnit: KT, l2: 'SW',
      long: 'Spectrum width — how spread the speeds in each gate are; high in turbulence and tight rotation', pal: 'sw' },
    srv: { label: 'Storm-relative', short: 'SRV', tilts: ['N0S'], unit: 'kt', l2: 'VEL', srm: true,
      long: 'Storm-relative velocity — the storm’s own motion taken out, so rotation stands out', pal: 'vel' },
    cc: { label: 'CC', short: 'CC', tilts: ['N0C', 'N1C', 'N2C', 'N3C'], unit: '', l2: 'RHO',
      long: 'Correlation coefficient — how alike the targets are. Rain and snow sit near 1; a drop inside a hook can be debris', pal: 'cc' },
    zdr: { label: 'ZDR', short: 'ZDR', tilts: ['N0X', 'N1X', 'N2X', 'N3X'], unit: 'dB', l2: 'ZDR',
      long: 'Differential reflectivity — the shape of what the beam hit. Big drops are high; tumbling hail is near zero', pal: 'zdr' },
    kdp: { label: 'KDP', short: 'KDP', tilts: ['N0K', 'N1K', 'N2K', 'N3K'], unit: '°/km',
      long: 'Specific differential phase — liquid water in the beam. High KDP is very heavy rain', pal: 'kdp' },
    hca: { label: 'Hydro class', short: 'HCA', tilts: ['N0H', 'N1H', 'N2H', 'N3H'], unit: '',
      long: 'Hydrometeor classification — the radar’s own call on what each gate holds', pal: 'hca' },
    eet: { label: 'Echo tops', short: 'EET', tilts: ['EET'], unit: 'kft',
      long: 'Enhanced echo tops — the highest 18 dBZ echo above each point', pal: 'eet' },
    vil: { label: 'VIL', short: 'VIL', tilts: ['DVL'], unit: 'kg/m²',
      long: 'Vertically integrated liquid — all the water in the column; very high VIL is a hail signal', pal: 'vil' }
  };
  const HCA_CLASSES = [
    null,
    ['BI', 'Biological'], ['GC', 'Ground clutter'], ['IC', 'Ice crystals'], ['DS', 'Dry snow'], ['WS', 'Wet snow'],
    ['RA', 'Light / moderate rain'], ['HR', 'Heavy rain'], ['BD', 'Big drops'], ['GR', 'Graupel'], ['HA', 'Hail mixed with rain'],
    ['LH', 'Large hail'], ['GH', 'Giant hail'], ['UK', 'Unknown'], ['RF', 'Range folded']
  ];

  /* The gate spacing is the product's, not max range / bins: an upper tilt
     stops early (the beam is above anything worth showing) and keeps its
     0.25 km gates. ICD table III. */
  const GATE_KM = { 56: 1, 94: 1, 99: 0.25, 134: 1, 135: 1, 153: 0.25, 154: 0.25, 159: 0.25, 161: 0.25, 163: 0.25, 165: 0.25 };

  /* ── numbers as the ICD stores them ── */
  const u16 = (v) => v & 0xffff;
  const s16 = (v) => (v & 0x8000 ? (v & 0xffff) - 0x10000 : v & 0xffff);
  function float16(v) {
    v = u16(v);
    const frac = v & 0x3ff, exp = (v >> 10) & 0x1f, sign = v >> 15;
    const x = exp ? 2 ** (exp - 16) * (1 + frac / 1024) : frac / 512;
    return sign ? -x : x;
  }
  const f32buf = new DataView(new ArrayBuffer(4));
  function float32(a, b) { f32buf.setUint16(0, u16(a)); f32buf.setUint16(2, u16(b)); return f32buf.getFloat32(0); }

  /* ── stored byte → value: one 256-entry table per file (NaN = no data) ──
     `special[i]` names a flagged byte: 'rf' range folded. */
  function lookup(code, thr) {
    const lut = new Float32Array(256).fill(NaN), special = {};
    if (code === 153 || code === 154 || code === 94 || code === 99) {
      const min = s16(thr[0]) * 0.1, inc = thr[1] * 0.1, n = Math.min(thr[2], 254);
      for (let i = 0; i < n; i++) lut[i + 2] = min + i * inc;
      if (code === 154 || code === 99) special[1] = 'rf';
    } else if (code === 159 || code === 161 || code === 163) {
      const scale = float32(thr[0], thr[1]), offset = float32(thr[2], thr[3]);
      const max = u16(thr[5]), lead = thr[6], trail = thr[7];
      for (let i = lead; i <= Math.min(255, max - trail); i++) lut[i] = (i - offset) / scale;
      if (lead > 1) special[1] = 'rf';
    } else if (code === 165) {
      for (let i = 10; i < 256; i++) lut[i] = Math.floor(i / 10);
      lut[150] = NaN; special[150] = 'rf';
    } else if (code === 134) {
      const linScale = float16(thr[0]), linOff = float16(thr[1]), logStart = thr[2], logScale = float16(thr[3]), logOff = float16(thr[4]);
      for (let i = 2; i < logStart && i < 255; i++) lut[i] = (i - linOff) / linScale;
      for (let i = logStart; i < 255; i++) lut[i] = Math.exp((i - logOff) / logScale);
    } else if (code === 135) {
      const mask = thr[0], scale = thr[1], offset = thr[2], topped = thr[3];
      for (let i = 2; i < 256; i++) { lut[i] = ((i & mask) - offset) / scale; if (i & topped) special[i] = 'topped'; }
    } else {
      /* the legacy 16-level products: each threshold carries its own flags */
      for (let k = 0; k < 16; k++) {
        const t = u16(thr[k]), flags = t >> 8;
        let val = t & 0xff;
        if (flags >> 7) {
          if (val === 3) special[k] = 'rf';
          val = NaN;
        } else if (flags >> 6) val *= 0.01;
        else if (flags >> 5) val *= 0.05;
        else if (flags >> 4) val *= 0.1;
        if (flags & 1) val = -val;
        lut[k] = val;
      }
    }
    return { lut, special };
  }

  /* ── one file ── */
  function parse(bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    /* the WMO header is text ending in \r\r\n twice ("SDUS54 KOUN 221908",
       "N0BTLX"); the message starts after it */
    let start = 0;
    const head = String.fromCharCode(...bytes.subarray(0, 60));
    const m = /^((?:NX|SD|NO)US\d\d [A-Z]{4} \d{6})\r\r\n([A-Z0-9]{3})([A-Z0-9]{3})\r\r\n/.exec(head);
    if (m) start = m[0].length;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.length - start);
    const code = dv.getInt16(0);
    if (code < 16 || code > 211) throw new Error('nexrad: not a Level III product');
    /* the product description block, 102 bytes after the 18-byte header */
    const P = 18;
    if (dv.getInt16(P) !== -1) throw new Error('nexrad: bad description block');
    const lat = dv.getInt32(P + 2) / 1000, lon = dv.getInt32(P + 6) / 1000, heightFt = dv.getInt16(P + 10);
    const vcp = dv.getInt16(P + 16), volDate = dv.getInt16(P + 22), volSec = dv.getInt32(P + 24);
    const dep = [], thr = [];
    dep[0] = dv.getInt16(P + 34); dep[1] = dv.getInt16(P + 36); dep[2] = dv.getInt16(P + 40);  // el_num sits at +38
    for (let i = 0; i < 16; i++) thr[i] = dv.getInt16(P + 42 + i * 2);
    for (let i = 3; i < 10; i++) dep[i] = dv.getInt16(P + 74 + (i - 3) * 2);
    const symOff = dv.getInt32(P + 90) * 2;
    if (!symOff) throw new Error('nexrad: no symbology block');
    const volTime = ((volDate - 1) * 86400 + volSec) * 1000;
    const elev = dep[2] * 0.1;
    const DIGITAL = [134, 135, 153, 154, 159, 161, 163, 165, 94, 99];
    const deltaSec = [153, 154, 159, 161, 163, 165].includes(code) ? (u16(dep[6]) >> 5) : 0;

    /* the rest of the message, decompressed when the description says so */
    let body = bytes.subarray(start), off = symOff;
    const compressed = [32, 94, 99, 134, 135, 138, 149, 152, 153, 154, 155, 159, 161, 163, 165, 167, 168, 170, 172, 173, 174, 175, 176, 177, 178, 179, 180, 182, 186, 193, 195, 202].includes(code) && dep[7] === 1;
    if (compressed) {
      const inflated = Bz.bunzip2(body.subarray(P + 102));
      const joined = new Uint8Array(P + 102 + inflated.length);
      joined.set(body.subarray(0, P + 102)); joined.set(inflated, P + 102);
      body = joined;
    }
    const d = new DataView(body.buffer, body.byteOffset, body.length);
    if (d.getInt16(off) !== -1 || d.getInt16(off + 2) !== 1) throw new Error('nexrad: bad symbology block');
    const nLayers = d.getUint16(off + 8);
    off += 10;
    let radial = null;
    for (let L = 0; L < nLayers && !radial; L++) {
      const layerLen = d.getUint32(off + 2), layerEnd = off + 6 + layerLen;
      off += 6;
      while (off < layerEnd) {
        const pc = d.getUint16(off);
        if (pc === 16 || pc === 0xaf1f) {
          const nBins = d.getUint16(off + 4), nRad = d.getUint16(off + 12);
          let p = off + 14;
          const az0 = new Float32Array(nRad), daz = new Float32Array(nRad), data = new Uint8Array(nRad * nBins);
          for (let r = 0; r < nRad; r++) {
            const n = d.getUint16(p); az0[r] = d.getInt16(p + 2) * 0.1; daz[r] = d.getInt16(p + 4) * 0.1; p += 6;
            if (pc === 16) {
              data.set(body.subarray(p, p + Math.min(n, nBins)), r * nBins); p += n;
            } else {
              /* run-length: a byte is (run << 4 | level), n counts halfwords */
              let g = r * nBins;
              const end = r * nBins + nBins;
              for (let k = 0; k < n * 2; k++) {
                const b = body[p + k], run = b >> 4, val = b & 15;
                for (let q = 0; q < run && g < end; q++) data[g++] = val;
              }
              p += n * 2;
            }
          }
          radial = { nBins, nRad, az0, daz, data };
          off = p;
          break;
        }
        throw new Error('nexrad: unsupported packet ' + pc.toString(16));
      }
    }
    if (!radial) throw new Error('nexrad: no radial data');
    const { lut, special } = lookup(code, thr);
    return {
      code, site: m ? m[3] : null, lat, lon, heightM: heightFt * 0.3048, vcp, elev,
      volTime, time: volTime + deltaSec * 1000, gateKm: GATE_KM[code] || 1, digital: DIGITAL.includes(code),
      /* storm-relative velocity (56) carries the storm motion the RPG took
         out: halfword 51 the speed in tenths of a knot, 52 the direction it
         comes FROM in tenths of a degree. "From" was checked on 2026-10-23
         by rebuilding N0S from N0G at three radars with storms: 4.5–5 kt mean
         difference (inside N0S's value bands) against 5.7–11 kt for "toward". */
      ...(code === 56 && dep[7] > 0 ? { motion: { kt: dep[7] / 10, from: dep[8] / 10 } } : {}),
      ...radial, lut, special
    };
  }

  /* The radial an azimuth falls in. Radials start where the scan started and
     wrap, so a lookup table by tenth of a degree is built once per file. */
  function azIndex(f) {
    if (f.azIdx) return f.azIdx;
    const idx = new Int16Array(3600).fill(-1);
    for (let r = 0; r < f.nRad; r++) {
      const a = Math.round(f.az0[r] * 10), n = Math.max(1, Math.round(f.daz[r] * 10));
      for (let k = 0; k < n; k++) idx[((a + k) % 3600 + 3600) % 3600] = r;
    }
    for (let i = 0; i < 3600; i++) if (idx[i] < 0) idx[i] = idx[(i + 3599) % 3600];   // a gap borrows its neighbour
    return (f.azIdx = idx);
  }
  /* the stored byte at a range and azimuth, or 0 outside the sweep. Level
     III's first gate starts at the radar; Level II's is centred at `firstKm`
     (about 2 km out). */
  const gateStart = (f) => (f.firstKm != null ? f.firstKm - f.gateKm / 2 : 0);
  function gate(f, km, azDeg) {
    const off = gateStart(f);
    if (km < off) return 0;
    const b = Math.floor((km - off) / f.gateKm);
    if (b < 0 || b >= f.nBins) return 0;
    const r = azIndex(f)[((Math.floor(azDeg * 10) % 3600) + 3600) % 3600];
    return r < 0 ? 0 : f.data[r * f.nBins + b];
  }
  /* the value there, in the product's display unit, or null */
  function valueAt(f, prod, km, azDeg) {
    const c = gate(f, km, azDeg), v = f.lut[c];
    if (f.special[c] === 'rf') return { rf: true };
    if (!Number.isFinite(v)) return null;
    const P = PRODUCTS[prod];
    if (prod === 'hca') return { value: v, cls: HCA_CLASSES[v] || null };
    return { value: P && P.toUnit ? v * P.toUnit : v, topped: f.special[c] === 'topped' };
  }

  /* The beam's height above the radar at a range, with the standard 4/3
     earth (Doviak & Zrnić 2.28b). km in, km out. */
  function beamHeightKm(rangeKm, elevDeg) {
    const ke = 4 / 3 * 6371, e = elevDeg * Math.PI / 180;
    return Math.sqrt(rangeKm * rangeKm + ke * ke + 2 * rangeKm * ke * Math.sin(e)) - ke;
  }

  /* ── where a point on the map is, as the radar sees it ──
     A gate's range is along the beam (slant range), and the beam rises over
     a curved earth. The painter used to turn map distance into range on a
     flat map with no slant, which put storms 0.25–4.6 km from where they were
     (more at long range, high tilts and northern sites — measured against
     MetPy, 2026-10-23). Now: the radar and the point on WGS84 (ECEF), the
     chord between them in the radar's own east-north-up frame — its azimuth
     is the bearing, its length the ground distance — and the ground distance
     turned into slant range with the standard 4/3 earth (Doviak & Zrnić
     2.28c, inverted: r = kₑa·sin φ / cos(θ + φ), φ = s / kₑa).
     locator(lat0, lon0, elevDeg) → { lat(lat), lon(lon), at(row, col) }:
     `lat` and `lon` are worked out once per row and column, `at` per pixel,
     so a whole screen costs one sqrt and one atan2 a pixel. `at` returns one
     shared object { km (slant), groundKm, az (degrees from north) }. */
  const WGS_A = 6378.137, WGS_E2 = 0.00669437999014, RAD = Math.PI / 180;
  function locator(lat0, lon0, elevDeg = 0) {
    const s0 = Math.sin(lat0 * RAD), c0 = Math.cos(lat0 * RAD), w0 = 1 - WGS_E2 * s0 * s0;
    const N0 = WGS_A / Math.sqrt(w0), X0 = N0 * c0, Z0 = N0 * (1 - WGS_E2) * s0;
    /* the earth's mean radius of curvature here, and the 4/3 earth over it */
    const Rl = Math.sqrt(N0 * WGS_A * (1 - WGS_E2) / Math.pow(w0, 1.5)), KE = 4 / 3 * Rl, k24 = 1 / (24 * Rl * Rl);
    const st = Math.sin(elevDeg * RAD), ct = Math.cos(elevDeg * RAD);
    const out = { km: 0, groundKm: 0, az: 0 };
    return {
      lat(lat) { const s = Math.sin(lat * RAD), N = WGS_A / Math.sqrt(1 - WGS_E2 * s * s); return { rc: N * Math.cos(lat * RAD), dz: N * (1 - WGS_E2) * s - Z0 }; },
      lon(lon) { const d = (lon - lon0) * RAD; return { cl: Math.cos(d), sl: Math.sin(d) }; },
      at(row, col) {
        const dx = row.rc * col.cl - X0, e = row.rc * col.sl;
        const n = c0 * row.dz - s0 * dx, u = c0 * dx + s0 * row.dz;
        const d2 = e * e + n * n + u * u, g = Math.sqrt(d2) * (1 + d2 * k24);   // chord → arc
        const p = g / KE, sp = p - p * p * p / 6, cp = 1 - p * p / 2;
        out.groundKm = g; out.km = KE * sp / (ct * cp - st * sp);
        const a = Math.atan2(e, n) / RAD; out.az = a < 0 ? a + 360 : a;
        return out;
      }
    };
  }
  /* one point, for a tap or a test */
  function polarOf(lat0, lon0, elevDeg, lat, lon) {
    const L = locator(lat0, lon0, elevDeg), o = L.at(L.lat(lat), L.lon(lon));
    return { km: o.km, groundKm: o.groundKm, az: o.az };
  }

  /* ── colour ──
     Smooth palettes in the conventions forecasters read: the NWS's
     reflectivity colours, green-in / red-out velocity, CC with the low
     (non-meteorological) values in blues and purples. Each stop is
     [value in display units, colour]; between stops the colour is blended. */
  const PALETTES = {
    ref: { min: -10, max: 80, stops: [[5, '#04e9e7'], [10, '#019ff4'], [15, '#0300f4'], [20, '#02fd02'], [25, '#01c501'], [30, '#008e00'], [35, '#fdf802'], [40, '#e5bc00'],
      [45, '#fd9500'], [50, '#fd0000'], [55, '#d40000'], [60, '#bc0000'], [65, '#f800fd'], [70, '#9854c6'], [75, '#fdfdfd']], floor: 5, ticks: [10, 20, 30, 40, 50, 60, 70] },
    vel: { min: -80, max: 80, stops: [[-80, '#ffd6f5'], [-64, '#00ff6a'], [-40, '#00c853'], [-20, '#0b8a3b'], [-5, '#0b4a25'], [-1, '#4a5a4e'], [1, '#5a4a4a'], [5, '#5c1010'],
      [20, '#a31515'], [40, '#e52222'], [64, '#ff6b6b'], [80, '#ffe0a3']], ticks: [-60, -30, 0, 30, 60] },
    cc: { min: 0.2, max: 1.05, stops: [[0.2, '#151563'], [0.45, '#2b2bd6'], [0.6, '#3d8bff'], [0.7, '#36d1d1'], [0.8, '#2fd82f'], [0.85, '#b6e61c'], [0.9, '#ffe600'],
      [0.93, '#ff9f1c'], [0.96, '#ff3b1c'], [0.98, '#b3122e'], [1.0, '#ff66d9'], [1.05, '#ffd6f5']], ticks: [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1] },
    zdr: { min: -4, max: 8, stops: [[-4, '#2b2b2b'], [-2, '#6d6d9f'], [0, '#b0b0b0'], [0.5, '#4b6bff'], [1, '#22c1ff'], [1.5, '#22e0a0'], [2, '#4ce64c'], [2.5, '#d9f03a'],
      [3, '#ffd21f'], [4, '#ff8c1a'], [5, '#ff3b3b'], [6, '#d61a8c'], [8, '#ffffff']], ticks: [-2, 0, 1, 2, 3, 4, 6] },
    sw: { min: 0, max: 40, stops: [[0, '#1f2937'], [4, '#4b5563'], [8, '#60a5fa'], [12, '#22c55e'], [16, '#eab308'], [20, '#f97316'], [25, '#ef4444'], [32, '#d946ef'], [40, '#ffffff']],
      floor: 1, ticks: [5, 10, 15, 20, 25, 30] },
    kdp: { min: -2, max: 8, stops: [[-2, '#555555'], [0, '#8a8a8a'], [0.5, '#3b82f6'], [1, '#22c55e'], [2, '#eab308'], [3, '#f97316'], [4, '#ef4444'], [6, '#d946ef'], [8, '#ffffff']],
      ticks: [0, 1, 2, 3, 4, 6] },
    eet: { min: 0, max: 70, stops: [[5, '#1e3a8a'], [15, '#2563eb'], [25, '#10b981'], [35, '#fde047'], [45, '#f97316'], [55, '#ef4444'], [65, '#d946ef'], [70, '#ffffff']],
      ticks: [10, 20, 30, 40, 50, 60] },
    vil: { min: 0, max: 80, stops: [[1, '#1e3a8a'], [5, '#2563eb'], [10, '#10b981'], [20, '#84cc16'], [30, '#fde047'], [40, '#f97316'], [50, '#ef4444'], [65, '#d946ef'], [80, '#ffffff']],
      ticks: [5, 10, 20, 30, 40, 50, 65] },
    hca: { classes: { 1: '#9ca3af', 2: '#78716c', 3: '#a5f3fc', 4: '#60a5fa', 5: '#1d4ed8', 6: '#22c55e', 7: '#15803d', 8: '#fde047', 9: '#f472b6', 10: '#ef4444', 11: '#b91c1c', 12: '#7f1d1d', 13: '#e9d5ff', 14: '#7c3aed' } }
  };
  const RF_COLOR = [124, 58, 237, 255];
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function colorOf(pal, v) {
    const s = pal.stops;
    if (v <= s[0][0]) return hex(s[0][1]);
    for (let i = 1; i < s.length; i++) if (v <= s[i][0]) {
      const [a, ca] = s[i - 1], [b, cb] = s[i], t = (v - a) / (b - a), A = hex(ca), B = hex(cb);
      return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t].map(Math.round);
    }
    return hex(s[s.length - 1][1]);
  }
  /* one RGBA word per stored byte, for this file: the painter's whole job is
     then a table lookup per pixel */
  function colorTable(f, prod) {
    /* as long as the file's own table: 256, or 65,536 for a 16-bit Level II moment */
    const P = PRODUCTS[prod], pal = PALETTES[P.pal], out = new Uint32Array(f.lut.length);
    const pack = (c, a = 255) => ((a << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;   // little-endian RGBA
    for (let i = 0; i < out.length; i++) {
      if (f.special[i] === 'rf') { out[i] = pack(RF_COLOR, 200); continue; }
      const v = f.lut[i];
      if (!Number.isFinite(v)) continue;
      if (pal.classes) { const c = pal.classes[v]; if (c && v !== 2) out[i] = pack(hex(c)); continue; }   // ground clutter left clear
      const x = P.toUnit ? v * P.toUnit : v;
      if (pal.floor != null && x < pal.floor) continue;
      if (prod === 'cc' || prod === 'zdr' || prod === 'kdp') { if (i < 2) continue; }
      out[i] = pack(colorOf(pal, x));
    }
    return out;
  }

  /* ── the bucket ──
     Files are named SITE_PROD_YYYY_MM_DD_HH_MM_SS (UTC), the site in three
     letters (TLX for KTLX). A prefix by the hour lists that hour's scans. */
  const SITE3 = /^[A-Z0-9]{3}$/;
  const pad = (n) => String(n).padStart(2, '0');
  function hourPrefix(site, prod, ms) {
    const d = new Date(ms);
    return `${site}_${prod}_${d.getUTCFullYear()}_${pad(d.getUTCMonth() + 1)}_${pad(d.getUTCDate())}_${pad(d.getUTCHours())}`;
  }
  function keyTime(key) {
    const m = /_(\d{4})_(\d\d)_(\d\d)_(\d\d)_(\d\d)_(\d\d)$/.exec(key);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  function parseListing(xml) {
    const keys = [];
    const re = /<Key>([^<]+)<\/Key>/g;
    let m;
    while ((m = re.exec(xml))) keys.push(m[1]);
    return keys;
  }
  /* every scan of one product from one site in the last `mins` minutes,
     oldest first: [{ key, t, url }] */
  async function scans(site, prod, { mins = 60, nowMs = Date.now(), signal, fetchFn = fetch } = {}) {
    if (!SITE3.test(site) || !/^[A-Z0-9]{3}$/.test(prod)) return [];
    /* every clock hour the window touches, from the hour it starts in to
       the one now is in (a minute ahead, for a clock a little slow). Stepping
       an hour from the window's start skipped the current hour whenever the
       window was under an hour and began in the last one — 20 minutes at
       19:04 listed only 18Z, and the newest scan grew older all hour
       (found by soak.mjs, 2026-10-23) */
    const hours = [];
    for (let t = Math.floor((nowMs - mins * 60e3) / 3600e3) * 3600e3; t <= nowMs + 60e3; t += 3600e3) hours.push(hourPrefix(site, prod, t));
    const lists = await Promise.all(hours.map(async (h) => {
      const r = await fetchFn(`${BUCKET}/?list-type=2&prefix=${h}`, { signal });
      if (!r.ok) throw new Error('nexrad: listing HTTP ' + r.status);
      return parseListing(await r.text());
    }));
    return lists.flat().map((key) => ({ key, t: keyTime(key), url: `${BUCKET}/${key}` }))
      .filter((s) => s.t && s.t >= nowMs - mins * 60e3 && s.t <= nowMs + 120e3).sort((a, b) => a.t - b.t);
  }
  async function load(url, { signal, fetchFn = fetch } = {}) {
    const r = await fetchFn(url, { signal });
    if (!r.ok) throw new Error('nexrad: HTTP ' + r.status);
    return parse(new Uint8Array(await r.arrayBuffer()));
  }

  /* ── storm-relative velocity at any tilt ──
     The NWS sends storm-relative velocity for the lowest tilt only (N0S).
     Above it, it is worked out here the way the RPG does: from a sweep's
     radial velocity take away the storm motion's component along each
     radial (the part of the motion toward or away from the radar). `uE`,
     `vN` are the motion the storms are heading with, m/s east and north;
     the sweep's velocities are m/s (Level II). The result is in knots, as
     N0S is, re-stored over ±200 kt in 253 steps (1.6 kt, finer than the
     palette); "below threshold" and range-folded gates keep their codes. */
  function stormRelative(f, uE, vN) {
    const lo = -200, hi = 200, data = new Uint8Array(f.data.length), lut = new Float32Array(256).fill(NaN), rad = Math.PI / 180;
    for (let i = 2; i < 256; i++) lut[i] = lo + (i - 2) * (hi - lo) / 253;
    for (let k = 0; k < f.nRad; k++) {
      const az = (f.az0[k] + f.daz[k] / 2) * rad, along = uE * Math.sin(az) + vN * Math.cos(az), row = k * f.nBins;
      for (let g = 0; g < f.nBins; g++) {
        const b = f.data[row + g], v = f.lut[b];
        if (!Number.isFinite(v)) { data[row + g] = f.special[b] === 'rf' ? 1 : 0; continue; }
        data[row + g] = Math.max(2, Math.min(255, Math.round(((v - along) * KT - lo) * 253 / (hi - lo)) + 2));
      }
    }
    return { ...f, data, lut, special: { 1: 'rf' }, motion: { uE, vN } };
  }

  const api = { BUCKET, PRODUCTS, HCA_CLASSES, PALETTES, GATE_KM, gateStart, parse, lookup, float16, float32, gate, valueAt, azIndex, beamHeightKm,
    colorOf, colorTable, hourPrefix, keyTime, parseListing, scans, load, stormRelative, locator, polarOf };
  root.Nexrad = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
