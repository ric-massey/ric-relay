/* NEXRAD Level II — the radar's full volume, read in the browser
   ────────────────────────────────────────────────────────────────────────────
   Level III (nexrad.js) is what the radar's own computer makes for the NWS:
   four tilts, 8-bit products. Level II is what the radar measured — every
   tilt of the volume (fourteen or more in a storm), the moments at their full
   resolution — and it is what GR2Analyst and RadarScope Pro read. Unidata
   puts it on AWS in two buckets, both open to a page:
     unidata-nexrad-level2-chunks  the volume being scanned now, in chunks of
                                   about 120 radials as the dish turns: a tilt
                                   is here seconds after it is scanned
     unidata-nexrad-level2         every finished volume, back to 1991
   Ric's call, 2026-10-22 ("do it").

   The format is the RDA/RPG ICD (2620002): an Archive II file is a 24-byte
   volume header and then records, each a 4-byte length and a bzip2 block
   (bzip2.js); a record holds messages — 2432 bytes each, or for message 31
   (the digital radar data) as long as it says. Message 31 carries the
   radial's azimuth, elevation and a block per moment: REF, VEL, SW, ZDR,
   PHI, RHO. A chunk is one record (the first chunk also carries the volume
   header and the metadata record). `test/decoders.test.mjs` holds this file
   to MetPy's Level2File on a real volume. */
(function (root) {
  'use strict';

  const Bz = root.Bzip2 || (typeof require === 'function' ? require('./bzip2.js') : null);
  const CHUNKS = 'https://unidata-nexrad-level2-chunks.s3.amazonaws.com';
  const ARCHIVE = 'https://unidata-nexrad-level2.s3.amazonaws.com';

  /* the moments a forecaster reads, with the unit the page shows them in */
  const KT = 1 / 0.514444;
  const MOMENTS = {
    REF: { label: 'Reflectivity', short: 'REF', unit: 'dBZ', pal: 'ref' },
    VEL: { label: 'Velocity', short: 'VEL', unit: 'kt', toUnit: KT, pal: 'vel' },
    SW: { label: 'Spectrum width', short: 'SW', unit: 'kt', toUnit: KT, pal: 'sw' },
    ZDR: { label: 'ZDR', short: 'ZDR', unit: 'dB', pal: 'zdr' },
    RHO: { label: 'CC', short: 'CC', unit: '', pal: 'cc' },
    PHI: { label: 'Differential phase', short: 'PHI', unit: '°', pal: 'phi' }
  };

  const RANGE16 = { PHI: [0, 360], ZDR: [-8, 12] };

  /* ── records ── */
  /* the bzip2 records in a piece of an Archive II file (a whole file, or one chunk) */
  function records(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let p = 0, header = null;
    if (bytes[0] === 0x41 && bytes[1] === 0x52 && bytes[2] === 0x32 && bytes[3] === 0x56) {   // "AR2V"
      const site = String.fromCharCode(...bytes.subarray(20, 24));
      header = { version: String.fromCharCode(...bytes.subarray(0, 9)), site, date: dv.getUint32(12), ms: dv.getUint32(16) };
      p = 24;
    }
    const out = [];
    while (p + 4 <= bytes.length) {
      const n = Math.abs(dv.getInt32(p));
      p += 4;
      if (!n || p + n > bytes.length) break;
      out.push(bytes.subarray(p, p + n));
      p += n;
    }
    return { header, records: out };
  }

  /* ── messages in one decompressed record ── */
  function messages(data, into) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let p = 0;
    while (p + 28 <= data.length) {
      const size = dv.getUint16(p + 12) * 2, type = data[p + 15];
      if (type === 31) {
        if (size < 16) break;
        radial(data, dv, p + 28, into);
        p += 12 + size;
      } else {
        if (type === 5 && !into.vcp) into.vcp = vcpMessage(dv, p + 28);
        p += 2432;
      }
    }
  }
  /* message 5: the volume coverage pattern — every cut of the volume, in
     order, with its angle and whether it is super-resolution (720 radials
     of half a degree, else 360). That is enough to know which chunks of a
     volume will hold which cut before any of them arrive. ICD 2620002,
     table XI: a 22-byte head, then 46 bytes a cut. */
  function vcpMessage(dv, o) {
    const pattern = dv.getUint16(o + 4), n = dv.getUint16(o + 6), cuts = [];
    for (let i = 0; i < n && i < 40; i++) {
      const c = o + 22 + i * 46;
      cuts.push({ elev: dv.getUint16(c) * 180 / 32768, waveform: dv.getUint8(c + 3), superRes: dv.getUint8(c + 4) });
    }
    return { pattern, cuts };
  }
  /* message 31: one radial */
  function radial(data, dv, o, into) {
    const az = dv.getFloat32(o + 12), elevNum = data[o + 22], elev = dv.getFloat32(o + 24);
    const status = data[o + 21], res = data[o + 20], time = dv.getUint32(o + 4), date = dv.getUint16(o + 8);
    const nBlocks = dv.getUint16(o + 30);
    const r = { az, res: res === 1 ? 0.5 : 1, status, t: ((date - 1) * 86400e3 + time), moments: {} };
    for (let b = 0; b < nBlocks && b < 10; b++) {
      const bp = o + dv.getUint32(o + 32 + b * 4);
      if (bp <= o || bp + 28 > data.length) continue;
      const kind = String.fromCharCode(data[bp]), name = String.fromCharCode(data[bp + 1], data[bp + 2], data[bp + 3]);
      if (kind === 'R' && name === 'VOL' && !into.site) {
        into.site = { lat: dv.getFloat32(bp + 8), lon: dv.getFloat32(bp + 12), heightM: dv.getInt16(bp + 16) + dv.getUint16(bp + 18) };
        into.vcpNumber = dv.getUint16(bp + 40);
      } else if (kind === 'D') {
        const key = name.trim();
        if (!MOMENTS[key]) continue;
        const nGates = dv.getUint16(bp + 8), first = dv.getInt16(bp + 10), spacing = dv.getInt16(bp + 12);
        const word = data[bp + 19], scale = dv.getFloat32(bp + 20), offset = dv.getFloat32(bp + 24);
        const start = bp + 28, len = nGates * (word / 8);
        if (start + len > data.length) continue;
        r.moments[key] = { nGates, first, spacing, word, scale, offset,
          raw: word === 16 ? new Uint16Array(Uint8Array.from(data.subarray(start, start + len)).buffer.slice(0)).map((_, i) => dv.getUint16(start + i * 2)) : data.slice(start, start + len) };
      }
    }
    (into.sweeps[elevNum] = into.sweeps[elevNum] || { elevNum, elevs: [], radials: [] }).radials.push(r);
    into.sweeps[elevNum].elevs.push(elev);
  }

  /* A volume, or as much of one as has arrived: records are decompressed
     and their radials gathered by elevation number. Pass `state` to keep
     adding chunks to the same volume. */
  function feed(bytes, state) {
    const s = state || { header: null, site: null, vcp: null, vcpNumber: null, sweeps: {} };
    const { header, records: recs } = records(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    if (header && !s.header) s.header = header;
    for (const rec of recs) messages(Bz.bunzip2(rec), s);
    return s;
  }

  /* One sweep of one moment as the painter wants it — the same shape as a
     Level III file (nexrad.js): radials sorted by azimuth, one byte a gate,
     a 256-entry table from byte to value. A 16-bit moment (PHI) is brought
     to 8 bits over its range. */
  function sweep(state, elevNum, moment) {
    const sw = state.sweeps[elevNum];
    if (!sw) return null;
    const rads = sw.radials.filter((r) => r.moments[moment]).sort((a, b) => a.az - b.az);
    if (!rads.length) return null;
    const m0 = rads[0].moments[moment];
    const nBins = Math.max(...rads.map((r) => r.moments[moment].nGates));
    const nRad = rads.length, data = new Uint8Array(nRad * nBins), az0 = new Float32Array(nRad), daz = new Float32Array(nRad);
    /* a 16-bit moment (PHI always, ZDR on some radars) is brought to 8 bits
       over a fixed range — 0.08 dB a step for ZDR, 1.4° for PHI, finer than
       any palette shows */
    const lut = new Float32Array(256).fill(NaN), special = { 1: 'rf' };
    const [lo, hi] = RANGE16[moment] || [-32, 95];
    if (m0.word === 8) for (let i = 2; i < 256; i++) lut[i] = (i - m0.offset) / m0.scale;
    else for (let i = 2; i < 256; i++) lut[i] = lo + (i - 2) * (hi - lo) / 253;
    rads.forEach((r, k) => {
      const m = r.moments[moment];
      az0[k] = r.az - r.res / 2; daz[k] = r.res;
      if (m.word === 8) data.set(m.raw.subarray(0, Math.min(m.nGates, nBins)), k * nBins);
      else for (let g = 0; g < m.nGates && g < nBins; g++) {
        const v = m.raw[g];
        data[k * nBins + g] = v < 2 ? v : Math.max(2, Math.min(255, Math.round(((v - m.offset) / m.scale - lo) * 253 / (hi - lo)) + 2));
      }
    });
    const elev = sw.elevs.reduce((a, b) => a + b, 0) / sw.elevs.length;
    const times = rads.map((r) => r.t);
    return {
      code: 'L2', moment, site: state.header ? state.header.site.trim() : null, lat: state.site ? state.site.lat : null, lon: state.site ? state.site.lon : null,
      heightM: state.site ? state.site.heightM : 0, elev, elevNum, time: Math.max(...times), start: Math.min(...times),
      gateKm: m0.spacing / 1000, firstKm: m0.first / 1000, nRad, nBins, az0, daz, data, lut, special, digital: true, complete: nRad >= (rads[0].res === 0.5 ? 700 : 350)
    };
  }
  /* the sweeps a volume holds, one line each: which moments, which angle, done or not */
  function tilts(state) {
    return Object.values(state.sweeps).map((sw) => {
      const moms = Object.keys(MOMENTS).filter((k) => sw.radials.some((r) => r.moments[k]));
      const res = sw.radials[0] ? sw.radials[0].res : 1, n = sw.radials.length;
      return { elevNum: sw.elevNum, elev: sw.elevs.reduce((a, b) => a + b, 0) / sw.elevs.length, moments: moms, radials: n, complete: n >= (res === 0.5 ? 700 : 350),
        time: Math.max(...sw.radials.map((r) => r.t)) };
    }).sort((a, b) => a.elevNum - b.elevNum);
  }
  /* For a moment, the newest finished sweep at each angle: a split cut's
     surveillance and Doppler halves, and SAILS's extra low scans, fold into
     one tilt each, the newest winning. */
  function angles(state, moment) {
    const by = new Map();
    for (const t of tilts(state)) {
      if (!t.complete || !t.moments.includes(moment)) continue;
      const k = Math.round(t.elev * 10) / 10, have = by.get(k);
      if (!have || t.time > have.time) by.set(k, t);
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([angle, t]) => ({ angle, elevNum: t.elevNum, time: t.time }));
  }

  /* Has a sweep of `moment` near `angle` been read to its end? The radial
     status says so (2: end of elevation, 4: end of volume) — counting
     radials is not enough to stop a download on, since "complete" above
     allows a few missing. */
  function swept(state, moment, angle, tol = 0.3) {
    return Object.values(state.sweeps).some((sw) => {
      const elev = sw.elevs.reduce((a, b) => a + b, 0) / sw.elevs.length;
      return Math.abs(elev - angle) < tol && sw.radials.some((r) => r.moments[moment]) && sw.radials.some((r) => r.status === 2 || r.status === 4);
    });
  }

  /* ── which chunks hold which cut ──
     A volume's chunks are numbered from 1: the first holds the metadata,
     then each cut takes 720 / 120 = 6 chunks (super-resolution) or 3, in the
     coverage pattern's order — checked against a real volume, where every
     chunk held exactly 120 radials of one cut. A split cut's surveillance
     half (waveform 1) carries reflectivity and the dual-pol moments to 460
     km; its Doppler half (2) carries reflectivity, velocity and spectrum
     width; the batch and single-PRF cuts carry everything. */
  const WAVE_MOMENTS = { 1: ['REF', 'ZDR', 'RHO', 'PHI'], 2: ['REF', 'VEL', 'SW'] };
  const ALL_MOMENTS = ['REF', 'VEL', 'SW', 'ZDR', 'RHO', 'PHI'];
  function plan(vcp) {
    let next = 2;
    return vcp.cuts.map((c, i) => {
      const radials = c.superRes & 1 ? 720 : 360, n = radials / 120;
      const elev = c.elev > 180 ? c.elev - 360 : c.elev;
      const cut = { elevNum: i + 1, elev, waveform: c.waveform, radials, first: next, last: next + n - 1, moments: WAVE_MOMENTS[c.waveform] || ALL_MOMENTS };
      next += n;
      return cut;
    });
  }
  /* the angles a moment is scanned at, lowest first */
  function anglesOf(cuts, moment) {
    return [...new Set(cuts.filter((c) => c.moments.includes(moment)).map((c) => Math.round(c.elev * 10) / 10))].sort((a, b) => a - b);
  }
  /* The cut to show for a moment at an angle: the last one in the volume
     (SAILS repeats the lowest angle mid-volume — the newest is what a
     forecaster wants), and for reflectivity the surveillance half, which
     reaches 460 km where the Doppler half stops at 300. */
  function cutFor(cuts, moment, angle) {
    let c = cuts.filter((x) => x.moments.includes(moment) && Math.abs(x.elev - angle) < 0.15);
    if (moment === 'REF' && c.some((x) => x.waveform === 1)) c = c.filter((x) => x.waveform === 1);
    return c.length ? c[c.length - 1] : null;
  }

  /* ── the buckets ── */
  async function list(base, prefix, { signal, fetchFn = fetch, delimiter = '', maxKeys = 1000, startAfter = '' } = {}) {
    const q = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': String(maxKeys) });
    if (delimiter) q.set('delimiter', delimiter);
    if (startAfter) q.set('start-after', startAfter);
    const r = await fetchFn(`${base}/?${q}`, { signal });
    if (!r.ok) throw new Error('level2: listing HTTP ' + r.status);
    const xml = await r.text();
    return { keys: [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]), prefixes: [...xml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)].map((m) => m[1]) };
  }
  /* A site's volume folders are numbered 1–999 and reused in turn, so the
     newest is found by its start time: the numbers in order rise in time to
     the newest and drop at the wrap — a binary search, about ten asks. */
  async function newestVolume(site4, { signal, fetchFn = fetch } = {}) {
    const { prefixes } = await list(CHUNKS, `${site4}/`, { signal, fetchFn, delimiter: '/' });
    /* the listing echoes the request's own prefix ("KTLX/"), which is no folder */
    const nums = prefixes.map((p) => /^[A-Z0-9]{4}\/(\d{1,3})\/$/.exec(p)).filter(Boolean).map((m) => Number(m[1])).filter((n) => n >= 1).sort((a, b) => a - b);
    if (!nums.length) return null;
    const start = async (n) => { const { keys } = await list(CHUNKS, `${site4}/${n}/`, { signal, fetchFn, maxKeys: 1 }); return keys[0] ? keys[0].split('/')[2].slice(0, 15) : ''; };
    const t0 = await start(nums[0]);
    let lo = 0, hi = nums.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((await start(nums[mid])) >= t0) lo = mid; else hi = mid - 1;
    }
    return { site: site4, number: nums[lo], numbers: nums };
  }
  /* a volume's chunks so far, in order: [{ key, url, n, kind: 'S'|'I'|'E', t }] */
  async function chunks(site4, number, { signal, fetchFn = fetch } = {}) {
    const { keys } = await list(CHUNKS, `${site4}/${number}/`, { signal, fetchFn });
    return keys.map((key) => {
      const m = /\/(\d{8})-(\d{6})-(\d{3})-([SIE])$/.exec(key);
      if (!m) return null;
      const t = Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6), +m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4));
      return { key, url: `${CHUNKS}/${key}`, n: +m[3], kind: m[4], t };
    }).filter(Boolean).sort((a, b) => a.n - b.n);
  }
  /* ── the archive: every finished volume since 1991 ──
     YYYY/MM/DD/KTLX/KTLX20130520_200356_V06(.gz). A volume to 2015 or so is
     one gzip around an uncompressed Archive II file; later ones are the
     usual bzip2 records. The _MDM files beside them are not radar data. */
  async function archive(site4, fromMs, toMs, { signal, fetchFn = fetch } = {}) {
    const days = [];
    for (let d = Date.UTC(new Date(fromMs).getUTCFullYear(), new Date(fromMs).getUTCMonth(), new Date(fromMs).getUTCDate()); d <= toMs; d += 86400e3) days.push(d);
    const out = [];
    for (const d of days) {
      const t = new Date(d), pre = `${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${String(t.getUTCDate()).padStart(2, '0')}/${site4}/`;
      const { keys } = await list(ARCHIVE, pre, { signal, fetchFn });
      for (const key of keys) {
        const m = /\/[A-Z0-9]{4}(\d{8})_(\d{6})(?:_V\d\d)?(\.gz)?$/.exec(key);
        if (!m) continue;
        const ms = Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6), +m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4));
        if (ms >= fromMs && ms <= toMs) out.push({ key, url: `${ARCHIVE}/${key}`, t: ms, gz: !!m[3] });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  }
  /* One archived volume, read as it downloads and abandoned the moment
     `until(state)` is satisfied — the lowest tilt is the first tenth of a
     volume, so a replay at it fetches about a megabyte a frame, not ten.
     Both layouts: bzip2 records ("BZh" after each record's length), or
     uncompressed messages one after another (each 2432 bytes, or as long as
     a message 31 says). */
  async function stream(url, { until = () => false, gz = /\.gz$/.test(url), signal, fetchFn = fetch } = {}) {
    const ctl = new AbortController();
    if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });
    const r = await fetchFn(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('level2: HTTP ' + r.status);
    /* gzip by hand, one network chunk at a time: piped, the decompressor
       drains the whole download before the first tilt is even read */
    const src = r.body.getReader();
    let reader = src, pump = null, stop = false;
    if (gz) {
      const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
      reader = ds.readable.getReader();
      pump = (async () => {
        try {
          for (;;) {
            const { value, done: end } = await src.read();
            if (stop) break;
            if (end) { await w.close(); break; }
            await w.write(value);
          }
        } catch (e) { /* cancelled, or the reader below reports it */ }
      })();
    }
    const st = { header: null, site: null, vcp: null, vcpNumber: null, sweeps: {} };
    let buf = new Uint8Array(1 << 20), len = 0, p = 0, kind = null, done = false;
    const dv = () => new DataView(buf.buffer, 0, len);
    try {
      while (!done) {
        const { value, done: end } = await reader.read();
        if (end) done = true;
        else {
          if (len + value.length > buf.length) { const nb = new Uint8Array(Math.max(buf.length * 2, len + value.length)); nb.set(buf.subarray(0, len)); buf = nb; }
          buf.set(value, len); len += value.length;
        }
        if (!st.header) {
          if (len < 32) continue;
          st.header = records(buf.subarray(0, 24)).header;
          if (!st.header) throw new Error('level2: not an Archive II file');
          p = 24;
          kind = buf[28] === 0x42 && buf[29] === 0x5a && buf[30] === 0x68 ? 'bz' : 'raw';      // "BZh"
        }
        const d = dv();
        if (kind === 'bz') {
          while (p + 4 <= len) {
            const n = Math.abs(d.getInt32(p));
            if (!n || p + 4 + n > len) break;
            messages(Bz.bunzip2(buf.subarray(p + 4, p + 4 + n)), st);
            p += 4 + n;
          }
        } else {
          const start = p;
          while (p + 28 <= len) {
            const size = d.getUint16(p + 12) * 2, type = buf[p + 15], n = type === 31 ? 12 + size : 2432;
            if (type === 31 && size < 16) { p = len; break; }
            if (p + n > len) break;
            p += n;
          }
          if (p > start) messages(buf.slice(start, p), st);
        }
        if (until(st)) break;
      }
    } finally {
      /* cancelling the network reader stops the download itself */
      stop = true;
      await src.cancel().catch(() => {});
      if (reader !== src) await reader.cancel().catch(() => {});
      if (pump) await pump;
    }
    return st;
  }
  const prevNumber = (n, nums) => { const i = nums.indexOf(n); return i > 0 ? nums[i - 1] : nums[nums.length - 1]; };
  const nextNumber = (n) => (n >= 999 ? 1 : n + 1);
  /* the site's ID in four letters, from Level III's three (TLX → KTLX) */
  const site4 = (s3) => (s3.length === 4 ? s3 : /^[A-Z]{3}$/.test(s3) ? 'K' + s3 : s3);

  const api = { CHUNKS, ARCHIVE, MOMENTS, RANGE16, records, feed, sweep, tilts, angles, plan, anglesOf, cutFor, list, newestVolume, chunks, archive, stream, swept, prevNumber, nextNumber, site4 };
  root.Level2 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
