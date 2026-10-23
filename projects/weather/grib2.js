/* GRIB2 — model fields, read in the browser
   ────────────────────────────────────────────────────────────────────────────
   Weather Pro's model maps. NOAA puts every HRRR and GFS run on AWS
   (`noaa-hrrr-bdp-pds`, `noaa-gfs-bdp-pds`, both CORS open), each file with a
   `.idx` listing where every field starts. So the page asks for one field's
   bytes with a Range request — about a megabyte for a whole HRRR field — and
   decodes it here. No server turning GRIB into tiles, nothing stored. Ric's
   call, 2026-10-22.

   What is read (WMO FM 92 GRIB edition 2):
     section 1  the run's reference time
     section 3  grid template 3.0 (regular lat/lon — GFS), 3.30 (Lambert
                conformal — HRRR) and NCEP's 3.32769 (rotated lat/lon — the
                RAP's native grid, for the mesoanalysis builder)
     section 4  the forecast hour (template 4.0 and 4.8's first fields)
     section 5  data templates 5.0 (simple packing), 5.2 (complex), 5.3
                (complex with spatial differencing — what both models use)
                5.41 (PNG — what MRMS uses; parseAsync only, below) and 5.42
                (CCSDS, the Rice coder of libaec — what ECMWF's open data uses)
     section 6  the bitmap, when there is one
     section 7  the packed values
   `test/decoders.test.mjs` holds the values and the grid's positions to
   ecCodes on real messages. */
(function (root) {
  'use strict';

  /* ── reading bits ── */
  class Bits {
    constructor(bytes, pos = 0) { this.b = bytes; this.p = pos * 8; }
    read(n) {
      if (!n) return 0;
      let v = 0;
      for (let k = 0; k < n; ) {
        const byte = this.b[this.p >> 3], used = this.p & 7, take = Math.min(8 - used, n - k);
        v = v * (1 << take) + ((byte >> (8 - used - take)) & ((1 << take) - 1));
        this.p += take; k += take;
      }
      return v;
    }
    align() { this.p = (this.p + 7) & ~7; }
  }
  const u = (b, o, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[o + i]; return v; };
  /* GRIB2 signed integers are sign-and-magnitude, not two's complement */
  const s = (b, o, n) => { const v = u(b, o, n), top = 2 ** (8 * n - 1); return v >= top ? -(v - top) : v; };
  const f32 = (b, o) => new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0);

  /* ── one message ── */
  function parse(bytes, opts) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u(bytes, 0, 4) !== 0x47524942 || bytes[7] !== 2) throw new Error('grib2: not a GRIB2 message');
    const total = u(bytes, 8, 8);
    const msg = { discipline: bytes[6] };
    /* NCEP packs some fields together — the NAM's U and V winds are one
       message, sections 4 to 7 repeated (its .idx calls them 167.1 and
       167.2). `sub` picks which; reading stops where the next one starts. */
    const sub = (opts && opts.sub) || 1;
    let p = 16, bitmap = null, data = null, fieldNo = 0;
    while (p < total - 4) {
      const len = u(bytes, p, 4), sec = bytes[p + 4], b = bytes, o = p;
      if (sec === 4 && ++fieldNo > sub) break;
      if (sec === 1) {
        msg.refTime = Date.UTC(u(b, o + 12, 2), b[o + 14] - 1, b[o + 15], b[o + 16], b[o + 17], b[o + 18]);
      } else if (sec === 3) {
        const npts = u(b, o + 6, 4), tmpl = u(b, o + 12, 2), t = o + 14;
        const shape = b[t], radius = shape === 1 ? u(b, t + 2, 4) / 10 ** b[t + 1] : shape === 6 ? 6371229 : shape === 0 ? 6367470 : 6371229;
        if (tmpl === 0) {
          const nx = u(b, t + 16, 4), ny = u(b, t + 20, 4);
          msg.grid = { kind: 'latlon', nx, ny, npts,
            la1: s(b, t + 32, 4) / 1e6, lo1: u(b, t + 36, 4) / 1e6, la2: s(b, t + 41, 4) / 1e6, lo2: u(b, t + 45, 4) / 1e6,
            di: u(b, t + 49, 4) / 1e6, dj: u(b, t + 53, 4) / 1e6, scan: b[t + 57], uvGrid: !!(b[t + 40] & 0x08) };
        } else if (tmpl === 30) {
          const nx = u(b, t + 16, 4), ny = u(b, t + 20, 4);
          msg.grid = { kind: 'lambert', nx, ny, npts, radius,
            la1: s(b, t + 24, 4) / 1e6, lo1: u(b, t + 28, 4) / 1e6, lad: s(b, t + 33, 4) / 1e6, lov: u(b, t + 37, 4) / 1e6,
            dx: u(b, t + 41, 4) / 1e3, dy: u(b, t + 45, 4) / 1e3, scan: b[t + 50],
            latin1: s(b, t + 51, 4) / 1e6, latin2: s(b, t + 55, 4) / 1e6,
            /* winds along the grid's own axes rather than east and north */
            uvGrid: !!(b[t + 32] & 0x08) };
        } else if (tmpl === 32769) {
          /* NCEP's rotated latitude/longitude (the RAP's native 13 km grid,
             what its wrfprs files use): the first and last points in true
             latitude and longitude, and the point the grid is centred on —
             the rotated equator and meridian cross there. The spacing is
             taken from the two corners, which ecCodes and the RAP agree on;
             the Di in the file is rounded. */
          const nx = u(b, t + 16, 4), ny = u(b, t + 20, 4);
          msg.grid = { kind: 'rotll', nx, ny, npts, radius,
            la1: s(b, t + 32, 4) / 1e6, lo1: u(b, t + 36, 4) / 1e6, la0: s(b, t + 41, 4) / 1e6, lo0: u(b, t + 45, 4) / 1e6,
            scan: b[t + 57], la2: s(b, t + 58, 4) / 1e6, lo2: u(b, t + 62, 4) / 1e6, uvGrid: !!(b[t + 40] & 0x08) };
        } else throw new Error('grib2: grid template 3.' + tmpl + ' is not read here');
      } else if (sec === 4) {
        const tmpl = u(b, o + 7, 2), t = o + 9;
        msg.product = { tmpl, category: b[t], number: b[t + 1], unit: b[t + 8], fcst: s(b, t + 9, 4),
          level1: { type: b[t + 13], scale: s(b, t + 14, 1), value: s(b, t + 15, 4) } };
        /* an accumulation or a maximum (4.8) is stored from the start of its
           window; the hour it is valid for is the window's end */
        if (tmpl === 8) {
          const e = t + 25;
          msg.product.endTime = Date.UTC(u(b, e, 2), b[e + 2] - 1, b[e + 3], b[e + 4], b[e + 5], b[e + 6]);
        }
      } else if (sec === 5) {
        const tmpl = u(b, o + 9, 2), t = o + 11;
        msg.pack = { tmpl, npts: u(b, o + 5, 4), R: f32(b, t), E: s(b, t + 4, 2), D: s(b, t + 6, 2), nbits: b[t + 8] };
        if (tmpl === 2 || tmpl === 3) Object.assign(msg.pack, {
          splitting: b[t + 10], missing: b[t + 11], miss1: u(b, t + 12, 4), miss2: u(b, t + 16, 4),
          NG: u(b, t + 20, 4), widthRef: b[t + 24], widthBits: b[t + 25], lenRef: u(b, t + 26, 4), lenInc: b[t + 30],
          lastLen: u(b, t + 31, 4), lenBits: b[t + 35],
          order: tmpl === 3 ? b[t + 36] : 0, extraOctets: tmpl === 3 ? b[t + 37] : 0 });
        else if (tmpl === 42) Object.assign(msg.pack, { flags: b[t + 10], block: b[t + 11], rsi: u(b, t + 12, 2) });
        else if (tmpl !== 0 && tmpl !== 41) throw new Error('grib2: data template 5.' + tmpl + ' is not read here');
      } else if (sec === 6) {
        /* 0: this field's own bitmap; 255: none (a second field in a shared
           message must not inherit the first one's); 254: the previous
           field's, which is already in `bitmap` */
        if (b[o + 5] === 0) bitmap = b.subarray(o + 6, o + len);
        else if (b[o + 5] === 255) bitmap = null;
        else if (b[o + 5] !== 254 || !bitmap) throw new Error('grib2: a predefined bitmap is not read here');
      } else if (sec === 7) {
        data = b.subarray(o + 5, o + len);
      }
      p += len;
    }
    if (!msg.grid || !msg.pack || !data) throw new Error('grib2: incomplete message');
    if (msg.pack.tmpl === 41) { msg.png = data; return msg; }   // finished by parseAsync
    /* the hour this field is valid for, counted from the run */
    msg.validTime = msg.product && msg.product.endTime != null ? msg.product.endTime : msg.refTime + (msg.product ? msg.product.fcst : 0) * 3600e3;
    msg.step = Math.round((msg.validTime - msg.refTime) / 3600e3);
    msg.values = unpack(msg.pack, data, bitmap, msg.grid.npts);
    return msg;
  }

  /* ── MRMS: gzip around GRIB2 around PNG ──
     MRMS ships each field gzipped, packed as a PNG (template 5.41) over the
     lower 48 at 0.01° or 0.005° — 24 to 98 million points, too many to hold
     in a phone's browser as numbers. So the PNG is inflated as a stream and
     its scanlines unfiltered one at a time, keeping the largest stored value
     in each `pool` × `pool` block: a rotation track a few hundred metres wide
     or a hail core survives, where an average would smear it out. Stored
     values rise with the field (2^E ≥ 1), and MRMS's "missing" and "no
     coverage" codes (−999, −99) are its lowest, so the maximum is the
     strongest real echo in the block. */
  async function stream(bytes, format) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function parseAsync(bytes, { pool = 1, sub = 1 } = {}) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await stream(bytes, 'gzip');
    const msg = parse(bytes, { sub });
    if (msg.pack.tmpl !== 41) return msg;
    const g = msg.grid, k = msg.pack;
    if (g.kind !== 'latlon') throw new Error('grib2: PNG packing is read here on lat/lon grids only');
    const raw = await pngPooled(msg.png, g.nx, g.ny, pool);
    const bscale = 2 ** k.E, dscale = 10 ** -k.D, n = raw.length, values = new Float32Array(n);
    for (let i = 0; i < n; i++) { const v = (k.R + raw[i] * bscale) * dscale; values[i] = v <= -99 ? NaN : v; }
    const nx = Math.ceil(g.nx / pool), ny = Math.ceil(g.ny / pool), north = !(g.scan & 0x40);
    /* the pooled grid's points sit at the middle of each block */
    const half = (pool - 1) / 2;
    msg.grid = { ...g, nx, ny, npts: nx * ny, di: g.di * pool, dj: g.dj * pool,
      la1: north ? g.la1 - half * g.dj : g.la1 + half * g.dj, lo1: g.lo1 + half * g.di, pool, ij: null, ll: null };
    msg.values = values;
    delete msg.png;
    return msg;
  }
  /* A grey PNG (8 or 16 bits) → its samples, max-pooled. Only what MRMS
     writes: colour type 0, no interlace. */
  async function pngPooled(png, W0, H0, pool) {
    const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
    if (dv.getUint32(0) !== 0x89504e47) throw new Error('grib2: not a PNG');
    let p = 8, w = 0, h = 0, depth = 8;
    const idat = [];
    while (p + 8 <= png.length) {
      const len = dv.getUint32(p), type = String.fromCharCode(png[p + 4], png[p + 5], png[p + 6], png[p + 7]);
      if (type === 'IHDR') {
        w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); depth = png[p + 16];
        if (png[p + 17] !== 0 || png[p + 20] !== 0) throw new Error('grib2: only grey, non-interlaced PNG is read here');
      } else if (type === 'IDAT') idat.push(png.subarray(p + 8, p + 8 + len));
      else if (type === 'IEND') break;
      p += 12 + len;
    }
    if (w !== W0 || h !== H0) throw new Error('grib2: the PNG is not the grid');
    const bpp = depth / 8, rowLen = w * bpp, nx = Math.ceil(w / pool), ny = Math.ceil(h / pool);
    const out = new Uint32Array(nx * ny);
    let prev = new Uint8Array(rowLen), cur = new Uint8Array(rowLen), row = 0, filled = -1, filter = 0;
    const take = (r) => {
      const base = Math.floor(r / pool) * nx;
      if (bpp === 1) for (let x = 0; x < w; x++) { const v = cur[x], o = base + ((x / pool) | 0); if (v > out[o]) out[o] = v; }
      else for (let x = 0; x < w; x++) { const v = (cur[2 * x] << 8) | cur[2 * x + 1], o = base + ((x / pool) | 0); if (v > out[o]) out[o] = v; }
    };
    const unfilter = () => {
      const c = cur, q = prev;
      if (filter === 1) for (let i = bpp; i < rowLen; i++) c[i] = (c[i] + c[i - bpp]) & 255;
      else if (filter === 2) for (let i = 0; i < rowLen; i++) c[i] = (c[i] + q[i]) & 255;
      else if (filter === 3) for (let i = 0; i < rowLen; i++) c[i] = (c[i] + (((i >= bpp ? c[i - bpp] : 0) + q[i]) >> 1)) & 255;
      else if (filter === 4) for (let i = 0; i < rowLen; i++) {
        const a = i >= bpp ? c[i - bpp] : 0, b = q[i], cc = i >= bpp ? q[i - bpp] : 0, pp = a + b - cc;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - cc);
        c[i] = (c[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255;
      }
    };
    /* the inflated stream, scanline by scanline: a filter byte, then the row */
    const reader = new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (let i = 0; i < value.length; ) {
        if (filled < 0) { filter = value[i++]; filled = 0; continue; }
        const n = Math.min(rowLen - filled, value.length - i);
        cur.set(value.subarray(i, i + n), filled); filled += n; i += n;
        if (filled === rowLen) {
          unfilter(); take(row);
          const t = prev; prev = cur; cur = t; filled = -1; row++;
          if (row >= h) break;
        }
      }
    }
    return out;
  }

  /* ── the packed values → Float32Array, NaN where missing ── */
  /* ── CCSDS 121.0-B lossless (Adaptive Entropy Coding, "Rice") ──
     What libaec does, for GRIB2 template 5.42. The samples come in
     reference-sample intervals of `rsi` blocks of `J` samples. Each block
     opens with an option id: zero blocks (a run of all-zero blocks), the
     second extension (pairs of samples coded as one number), "split" k (each
     sample's high part as a unary count, then its k low bits), or
     uncompressed. With preprocessing on (flags & 8), every interval opens
     with one raw reference sample and the rest are mapped differences from
     the sample before (CCSDS §4, the unit-delay predictor), undone here. */
  function aec(data, bits, flags, J, rsi, n) {
    const out = new Float64Array(n);
    if (!n) return out;
    const pp = !!(flags & 8), padRsi = !!(flags & 32), restricted = !!(flags & 16);
    const idLen = bits > 16 ? 5 : bits > 8 ? 4 : restricted && bits <= 4 ? (bits <= 2 ? 1 : 2) : 3, idMax = 2 ** idLen - 1;
    const xmax = 2 ** bits - 1, med = Math.floor(xmax / 2) + 1, nb = data.length;
    let pos = 0;
    const get = (k) => {
      let v = 0;
      while (k > 0) {
        const byte = pos >> 3, off = pos & 7, avail = 8 - off, take = avail < k ? avail : k;
        v = v * (1 << take) + (((byte < nb ? data[byte] : 0) >> (avail - take)) & ((1 << take) - 1));
        pos += take; k -= take;
      }
      return v;
    };
    /* a fundamental sequence: zeros counted up to the closing one */
    const fs = () => {
      let c = 0;
      for (;;) {
        const byte = pos >> 3;
        if (byte >= nb) throw new Error('grib2: CCSDS data ran out');
        const x = (data[byte] << (pos & 7)) & 0xff;
        if (!x) { c += 8 - (pos & 7); pos = (byte + 1) << 3; continue; }
        const z = Math.clz32(x) - 24;
        c += z; pos += z + 1;
        return c;
      }
    };
    const buf = new Float64Array(J);
    let o = 0;
    while (o < n) {
      let ref = pp ? 1 : 0, last = 0, first = true;
      /* the decoded block's samples (mapped differences, the reference raw) go out here */
      const emit = (count, fromBuf) => {
        for (let i = 0; i < count && o < n; i++) {
          const d = fromBuf ? buf[i] : 0;
          if (!pp) { out[o++] = d; continue; }
          if (first) { last = d; first = false; out[o++] = d; continue; }
          const half = Math.floor(d / 2) + (d % 2), mask = last >= med, theta = mask ? xmax - last : last;
          if (half <= theta) last += d % 2 ? -(d + 1) / 2 : d / 2;
          else last = mask ? xmax - d : d;
          out[o++] = last;
        }
      };
      for (let b = 0; b < rsi && o < n; ) {
        const id = get(idLen);
        if (id === 0) {
          const se = get(1);
          if (ref) buf[0] = get(bits);
          if (!se) {
            let z = fs() + 1;
            if (z === 5) z = Math.min(rsi - b, 64 - (b % 64));                // to the end of the segment
            else if (z > 5) z--;
            if (ref) { emit(1, true); emit(z * J - 1, false); } else emit(z * J, false);
            b += z; ref = 0;
            continue;
          }
          for (let i = ref; i < J; ) {
            const m = fs(), beta = Math.floor((Math.sqrt(8 * m + 1) - 1) / 2), d1 = m - beta * (beta + 1) / 2;
            if ((i & 1) === 0) buf[i++] = beta - d1;
            buf[i++] = d1;
          }
        } else if (id === idMax) {
          for (let i = 0; i < J; i++) buf[i] = get(bits);
        } else {
          const k = id - 1, sc = 2 ** k;
          if (ref) buf[0] = get(bits);
          for (let i = ref; i < J; i++) buf[i] = fs() * sc;
          if (k) for (let i = ref; i < J; i++) buf[i] += get(k);
        }
        emit(J, true);
        b++; ref = 0;
      }
      if (padRsi) pos = (pos + 7) & ~7;
    }
    return out;
  }

  function unpack(k, data, bitmap, npts) {
    const out = new Float32Array(npts).fill(NaN);
    const bscale = 2 ** k.E, dscale = 10 ** -k.D;
    /* which grid points carry a value */
    const present = [];
    if (bitmap) { for (let i = 0; i < npts; i++) if (bitmap[i >> 3] & (0x80 >> (i & 7))) present.push(i); }
    const n = bitmap ? present.length : npts;
    const at = (j) => (bitmap ? present[j] : j);
    if (k.tmpl === 42) {
      const x = k.nbits ? aec(data, k.nbits, k.flags, k.block, k.rsi, n) : new Float64Array(n);
      for (let j = 0; j < n; j++) out[at(j)] = (k.R + x[j] * bscale) * dscale;
      return out;
    }
    if (k.tmpl === 0) {
      const br = new Bits(data);
      for (let j = 0; j < n; j++) out[at(j)] = (k.R + (k.nbits ? br.read(k.nbits) : 0) * bscale) * dscale;
      return out;
    }
    /* complex packing: groups, each with its own reference and width */
    const br = new Bits(data);
    let ival1 = 0, ival2 = 0, minsd = 0;
    if (k.tmpl === 3 && k.order) {
      const rd = () => { const v = br.read(8 * k.extraOctets), top = 2 ** (8 * k.extraOctets - 1); return v >= top ? -(v - top) : v; };
      ival1 = rd(); if (k.order === 2) ival2 = rd(); minsd = rd();
    }
    const NG = k.NG, refs = new Float64Array(NG), widths = new Uint8Array(NG), lens = new Uint32Array(NG);
    for (let g = 0; g < NG; g++) refs[g] = br.read(k.nbits);
    br.align();
    for (let g = 0; g < NG; g++) widths[g] = br.read(k.widthBits) + k.widthRef;
    br.align();
    for (let g = 0; g < NG; g++) lens[g] = br.read(k.lenBits) * k.lenInc + k.lenRef;
    br.align();
    lens[NG - 1] = k.lastLen;
    const X = new Float64Array(n), miss = new Uint8Array(n);
    const mm = k.missing;
    let j = 0;
    for (let g = 0; g < NG && j < n; g++) {
      const w = widths[g], L = lens[g], ref = refs[g];
      if (w === 0) {
        const allOnes = 2 ** k.nbits - 1;
        const m = mm === 1 && ref === allOnes ? 1 : mm === 2 && ref === allOnes ? 1 : mm === 2 && ref === allOnes - 1 ? 2 : 0;
        for (let q = 0; q < L && j < n; q++, j++) { if (m) miss[j] = m; else X[j] = ref; }
      } else {
        const m1 = 2 ** w - 1, m2 = 2 ** w - 2;
        for (let q = 0; q < L && j < n; q++, j++) {
          const v = br.read(w);
          if (mm >= 1 && v === m1) miss[j] = 1;
          else if (mm === 2 && v === m2) miss[j] = 2;
          else X[j] = v + ref;
        }
      }
    }
    /* undo the spatial differencing over the values that are present */
    if (k.tmpl === 3 && k.order) {
      let seen = 0, a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        if (miss[i]) continue;
        if (seen === 0) X[i] = ival1;
        else if (seen === 1 && k.order === 2) X[i] = ival2;
        else if (k.order === 1) X[i] = X[i] + minsd + a;
        else X[i] = X[i] + minsd + 2 * a - b;
        b = a; a = X[i]; seen++;
      }
    }
    for (let i = 0; i < n; i++) if (!miss[i]) out[at(i)] = (k.R + X[i] * bscale) * dscale;
    return out;
  }

  /* ── where a grid point is, and which grid point a place falls on ──
     ij(grid, lat, lon) → [i, j] in grid units, fractional, in the order the
     values are stored (i along a row, j row by row). */
  function projector(g) {
    if (g.ij) return g;
    const rad = Math.PI / 180;
    const wrap = (lon) => ((lon % 360) + 540) % 360 - 180;
    if (g.kind === 'latlon') {
      const north = !(g.scan & 0x40);                          // rows run north to south
      const lo1 = wrap(g.lo1);
      g.ij = (lat, lon) => {
        let di = wrap(lon - lo1); if (di < 0) di += 360;
        return [di / g.di, north ? (g.la1 - lat) / g.dj : (lat - g.la1) / g.dj];
      };
      g.ll = (i, j) => [north ? g.la1 - j * g.dj : g.la1 + j * g.dj, wrap(lo1 + i * g.di)];
      return g;
    }
    if (g.kind === 'rotll') {
      /* the sphere turned so the grid's centre sits on the equator at 0°:
         a rotation about the polar axis by the centre's longitude, then about
         the new y axis by its latitude */
      const p0 = g.la0 * rad, c0 = Math.cos(p0), s0 = Math.sin(p0), lon0 = g.lo0;
      const fwd = (lat, lon) => {
        const p = lat * rad, l = wrap(lon - lon0) * rad, x = Math.cos(p) * Math.cos(l), y = Math.cos(p) * Math.sin(l), z = Math.sin(p);
        return [Math.asin(Math.max(-1, Math.min(1, -s0 * x + c0 * z))) / rad, Math.atan2(y, c0 * x + s0 * z) / rad];
      };
      const back = (pr, lr) => {
        const p = pr * rad, l = lr * rad, xr = Math.cos(p) * Math.cos(l), y = Math.cos(p) * Math.sin(l), zr = Math.sin(p);
        const x = c0 * xr - s0 * zr, z = s0 * xr + c0 * zr;
        return [Math.asin(Math.max(-1, Math.min(1, z))) / rad, wrap(lon0 + Math.atan2(y, x) / rad)];
      };
      const [pa, la] = fwd(g.la1, g.lo1), [pb, lb] = fwd(g.la2, g.lo2);
      const di = (lb - la) / (g.nx - 1), dj = (pb - pa) / (g.ny - 1);
      g.ij = (lat, lon) => { const [pr, lr] = fwd(lat, lon); return [(lr - la) / di, (pr - pa) / dj]; };
      g.ll = (i, j) => back(pa + j * dj, la + i * di);
      return g;
    }
    /* Lambert conformal conic, spherical earth (Snyder 1987, 15-1 to 15-4) */
    const p1 = g.latin1 * rad, p2 = g.latin2 * rad, R = g.radius;
    const n = Math.abs(p1 - p2) < 1e-9 ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    const F = Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n / n;
    const lov = wrap(g.lov);
    const xy = (lat, lon) => {
      const rho = R * F / Math.tan(Math.PI / 4 + lat * rad / 2) ** n, th = n * wrap(lon - lov) * rad;
      return [rho * Math.sin(th), -rho * Math.cos(th)];
    };
    const [x0, y0] = xy(g.la1, g.lo1);
    const up = !!(g.scan & 0x40);                                // rows run south to north
    g.ij = (lat, lon) => { const [x, y] = xy(lat, lon); return [(x - x0) / g.dx, up ? (y - y0) / g.dy : (y0 - y) / g.dy]; };
    g.ll = (i, j) => {
      const x = x0 + i * g.dx, y = up ? y0 + j * g.dy : y0 - j * g.dy;
      const rho = Math.sign(n) * Math.hypot(x, y), th = Math.atan2(x, -y);
      const lat = (2 * Math.atan((R * F / rho) ** (1 / n)) - Math.PI / 2) / rad;
      return [lat, wrap(lov + th / n / rad)];
    };
    return g;
  }
  /* the value at a place, bilinear between the four grid points around it */
  function sample(msg, lat, lon) {
    const g = projector(msg.grid), [fi, fj] = g.ij(lat, lon);
    const i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || j + 1 >= g.ny) return NaN;
    const i1 = g.kind === 'latlon' && i + 1 >= g.nx ? 0 : i + 1;
    if (i1 >= g.nx) return NaN;
    const v = msg.values, a = v[j * g.nx + i], b = v[j * g.nx + i1], c = v[(j + 1) * g.nx + i], d = v[(j + 1) * g.nx + i1];
    const x = fi - i, y = fj - j;
    return (a * (1 - x) + b * x) * (1 - y) + (c * (1 - x) + d * x) * y;
  }

  /* ── the .idx files ──
     "71:41635837:d=2026102212:TMP:2 m above ground:1 hour fcst:" — one
     line per message, in file order, so a message ends where the next
     begins. */
  function parseIdx(text) {
    const lines = String(text).split('\n').filter(Boolean).map((l) => l.split(':'));
    /* a field inside a shared message ("167.2") ends where the next message
       begins, not where its sibling does (they share a start) */
    return lines.map((f, k) => {
      let next = k + 1;
      while (next < lines.length && +lines[next][1] === +f[1]) next++;
      const sub = /\.(\d+)$/.exec(f[0]);
      return { n: parseInt(f[0], 10), sub: sub ? +sub[1] : 1, start: +f[1], end: next < lines.length ? +lines[next][1] - 1 : null,
        run: f[2].replace(/^d=/, ''), name: f[3], level: f[4], fcst: f[5], line: f.slice(3).join(':') };
    });
  }
  /* the one entry matching a pattern over "NAME:LEVEL:FCST" */
  function find(idx, re) { return idx.find((e) => re.test(e.line)) || null; }

  async function fetchMessage(url, entry, { signal, fetchFn = fetch, pool } = {}) {
    let end = entry.end;
    if (end == null) {
      /* the last message in a file: its own length is in its first 16 bytes */
      const h = await fetchFn(url, { signal, headers: { Range: `bytes=${entry.start}-${entry.start + 15}` } });
      const hb = new Uint8Array(await h.arrayBuffer());
      end = entry.start + u(hb, 8, 8) - 1;
    }
    const r = await fetchFn(url, { signal, headers: { Range: `bytes=${entry.start}-${end}` } });
    if (!r.ok) throw new Error('grib2: HTTP ' + r.status);
    return parseAsync(new Uint8Array(await r.arrayBuffer()), { pool, sub: entry.sub || 1 });
  }

  const api = { parse, parseAsync, pngPooled, unpack, projector, sample, parseIdx, find, fetchMessage, Bits, aec };
  root.Grib2 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
