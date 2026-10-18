/* NOWCAST — the next hour of rain, from the radar itself
   ────────────────────────────────────────────────────────────────────────────
   The weather room's own short-range prediction (DESIGN.md §9.3): take the
   last half hour of the national radar mosaic, find which way the rain is
   moving, carry the newest picture forward along that motion, and read what
   arrives over the visitor's spot every five minutes for an hour.

   It is the textbook method (extrapolation nowcasting, as in the NWS's own
   MRMS and the pySTEPS library): it knows nothing about rain growing or
   dying, so it is good for about an hour and honest about being worse the
   further out it reaches. The page calls it our estimate, shows it beside the
   models rather than over them, and verify/nowcast.mjs grades it every night
   against what the radar did next — the same rule as every other number here.
   It is never used for a storm's arrival: storm mode's times come from the
   warning's own motion (AGENTS.md).

   Pure: the page and the grading job hand it decoded pictures. Everything is
   in grid pixels; the caller says how many km a pixel is.

   ── the pieces ──
     decodePng(bytes, inflate)   a paletted PNG → its palette indices
     dbzOf(index)                IEM's N0Q scale: index → dBZ
     field(...)                  a picture → a coarse reflectivity grid
     motion(frames, ...)         where the rain is moving: a vector per region
     forecast(field, motion, …)  what arrives over a point, minute by minute
     describe(...)               that, in a sentence */
(function (root) {
  'use strict';

  /* ── PNG ──
     IEM's radar pictures are 8-bit paletted PNGs; the palette index IS the
     value, so no colour has to be guessed back into a number. Reading the
     bytes ourselves also means the page does not need a tainted-canvas
     workaround. inflate: bytes → Promise<Uint8Array> (zlib stream). */
  async function decodePng(bytes, inflate) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) throw new Error('not a PNG');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0;
    const idat = [];
    while (i + 8 <= b.length) {
      const n = dv.getUint32(i), t = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      const d = b.subarray(i + 8, i + 8 + n);
      if (t === 'IHDR') { w = dv.getUint32(i + 8); h = dv.getUint32(i + 12); depth = d[8]; type = d[9]; interlace = d[12]; }
      else if (t === 'IDAT') idat.push(d);
      else if (t === 'IEND') break;
      i += 12 + n;
    }
    if (!w || !h) throw new Error('PNG without a header');
    if (interlace) throw new Error('interlaced PNG');
    /* palette (3) or grey (0) at 8 bits: one byte per pixel, which is all IEM sends */
    if (!((type === 3 || type === 0) && depth === 8)) throw new Error(`PNG type ${type}/${depth} not supported`);
    const total = idat.reduce((a, c) => a + c.length, 0);
    const z = new Uint8Array(total);
    let o = 0; for (const c of idat) { z.set(c, o); o += c.length; }
    const raw = await inflate(z);
    const out = new Uint8Array(w * h);
    const stride = w;
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)];
      const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const a = x ? cur[x - 1] : 0, up = prev[x], c = x ? prev[x - 1] : 0;
        let v = row[x];
        if (f === 1) v += a;
        else if (f === 2) v += up;
        else if (f === 3) v += (a + up) >> 1;
        else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
        cur[x] = v & 255;
      }
      out.set(cur, y * w);
      const t = prev; prev = cur; cur = t;
    }
    return { width: w, height: h, data: out };
  }

  /* IEM N0Q: 0.5 dBZ steps from -32.5, index 0 meaning no echo / no data. */
  const dbzOf = idx => idx === 0 ? null : idx * 0.5 - 32.5;
  const RAIN_DBZ = 20;                  // light rain reaches the ground about here

  /* The live map tiles are full-colour PNGs drawn with the archive's own
     palette — checked 2026-10-17: every one of 44,155 rain pixels over the
     lower 48 was an exact palette colour — so a tile pixel's colour gives its
     index back exactly. The palette is IEM's N0Q ramp as the archive PNGs
     carry it (index 105 = 20 dBZ, the classic radar green). */
  const PALETTE = '00000085718f85728f86738d87758b87768b887789897987897a878a7b858b7d848b7e848c7f828d81808d82808e837e8f847c8f857c90877b918879918979928b77938d759691539894579b975b9d9a60a09d64a3a068a5a36da8a671aaa976adac7ab0af7eb2b283b7b88cbabb90bdbe94bfc199c2c49dc4c7a2c7caa6cacdaaccd0afd2d4b4cfd2b4c9ccb4c6c9b4c3c7b4c0c4b4bdc1b4b9beb4b6bbb4b3b9b4b0b6b4adb3b4aab0b4a4abb4a0a8b49da5b49aa2b497a0b4949db4919ab4949bb59098b48c95b38892b2808cb07c89af7886ae7483ac7080ab6c7daa6779a96376a85f73a75b70a6576da44f67a24b64a14761a0435e9f415b9e4361a24568a6486faa4a76ae4d7db24f84b6518bbb5699c3599fc75ba6cb5eadcf60b4d462bbd865c2dc67c9e06ad0e46fd6e868d6d759d6b352d6a24bd69043d67e3cd66d35d65b11d51811d11710cd1710c81610c4160fbc150fb7140eb3140eaf130eab130da6120da2120d9e110c99110c95100c91100b880f0b840e0a800e0a7c0d0a770d09730c096f0c096b0b08660b08620a095e09327308467d085b88076f9207849d0698a806adb205c1bd05d6c704ead204ffe200ffd800ffd300ffce00ffc900ffc400ffc000ffbb00ffb600ffb100ffac00ffa700ffa200ff9900ff9400ff8f00ff8a00ff8500ff8000ff0000f80000f10000ea0000e30000d50000cd0000c60000bf0000b80000b10000aa0000a300009b00009400008d00007f0000780000710000fffffffff5ffffeaffffdfffffd4ffffc9ffffbeffffb3ffff9dffff92ffff75fffc6bfdf960faf656f7f34bf4f040f1ed36efea2bece720e9e10be3b200ffac00fca400f79b00f49300ef8800ea8300e87900e27200dd6900db05ecf005ebf005eaf005dde005dce005dbe005cdd005ccd004bdc004bcc004bbc004aeb004adb0049ea0049da0049ca0038e90038d90038c90037e80037d80036f70036e70036d70025f60025e60024f50024e50024d50023f40023e40023d40013030012f30012020011f20011e203a67b53a66b53a65b53a64b53a63b53a62b5';
  const byColour = new Map();
  for (let i = 1; i < 256; i++) byColour.set(parseInt(PALETTE.slice(i * 6, i * 6 + 6), 16), i);
  /* RGBA bytes (a canvas's) → palette indices; transparent is 0, "nothing" */
  function indicesOf(rgba) {
    const out = new Uint8Array(rgba.length >> 2);
    for (let i = 0, k = 0; i < rgba.length; i += 4, k++) {
      if (rgba[i + 3] < 128) continue;
      out[k] = byColour.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) || 0;
    }
    return out;
  }

  /* The settings, in km and minutes, shared by the page and the nightly grade
     so what is graded is exactly what is shown:
       searchKm   the farthest rain is looked for between frames 10 min apart
                  (a 150 km/h squall line moves 25 km in 10 min)
       r0Km       how wide the look at a point is now
       growKm     how much wider per minute ahead (neither the motion nor the
                  rain is known exactly, so the look blurs with time) */
  const SETTINGS = { searchKm: 28, r0Km: 3, growKmPerMin: 0.25, stepMin: 5 };
  const optionsFor = (kmPerCell, maxMin = 60) => ({
    maxMin, step: SETTINGS.stepMin, r0: SETTINGS.r0Km / kmPerCell, grow: SETTINGS.growKmPerMin / kmPerCell
  });
  const LEVELS = [[45, 'heavy'], [35, 'moderate'], [RAIN_DBZ, 'light']];

  /* ── a coarse grid ──
     The pictures are ~0.5–1 km a pixel; motion and what arrives over a spot
     are steadier on blocks of a few km. Each block keeps the HIGHEST dBZ in
     it, so a narrow line of storms is not averaged away. lut: index → dBZ
     (defaults to N0Q). */
  function field(img, block, lut) {
    const L = lut || dbzOf;
    const W = Math.floor(img.width / block), H = Math.floor(img.height / block);
    const g = new Float32Array(W * H).fill(-99);
    for (let y = 0; y < H * block; y++) {
      const gy = (y / block) | 0, base = y * img.width;
      for (let x = 0; x < W * block; x++) {
        const d = L(img.data[base + x]);
        if (d === null) continue;
        const k = gy * W + ((x / block) | 0);
        if (d > g[k]) g[k] = d;
      }
    }
    return { w: W, h: H, v: g };
  }
  const at = (f, x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= f.w || yi >= f.h ? null : f.v[yi * f.w + xi];
  };

  /* ── motion ──
     Block matching between consecutive pictures: for each region, the shift
     that makes the older picture best match the newer one (mean absolute
     difference of rain intensity over the pixels where either has rain).
     Shifts from every pair are pooled per region, the median kept, and a
     region with too little rain to judge takes the whole picture's motion.
     frames: oldest first, each a field; dtMin: minutes between frames.
     Returns { regions: [{x0,y0,x1,y1,u,v,n}], u, v } in px per minute. */
  const intensity = d => d > RAIN_DBZ - 5 ? d - (RAIN_DBZ - 5) : 0;
  /* The cost of a shift is the mean difference over every pixel where either
     picture has rain, so it is read off lists of the rain pixels themselves:
     every one for a small cell, an even thinning of them (MAX_PTS) for a big
     system. A sparse sampling grid instead loses small storms between its
     points and picks an aliased shift. */
  const MAX_PTS = 1500;
  function rainPts(f, x0, y0, x1, y1) {
    const pts = [];
    for (let y = Math.max(0, y0); y < Math.min(f.h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(f.w, x1); x++) {
      const i = intensity(f.v[y * f.w + x]);
      if (i) pts.push(x, y, i);
    }
    if (pts.length / 3 <= MAX_PTS) return pts;
    const out = [], every = pts.length / 3 / MAX_PTS;
    for (let k = 0; k < MAX_PTS; k++) { const j = Math.floor(k * every) * 3; out.push(pts[j], pts[j + 1], pts[j + 2]); }
    return out;
  }
  function bestShift(a, b, x0, y0, x1, y1, S) {
    const pb = rainPts(b, x0, y0, x1, y1), pa = rainPts(a, x0 - S, y0 - S, x1 + S, y1 + S);
    if (pb.length / 3 < 4 || pa.length / 3 < 4) return null;
    const ia = (x, y) => x < 0 || y < 0 || x >= a.w || y >= a.h ? 0 : intensity(a.v[y * a.w + x]);
    const ib = (x, y) => x < 0 || y < 0 || x >= b.w || y >= b.h ? 0 : intensity(b.v[y * b.w + x]);
    let best = null;
    for (let dy = -S; dy <= S; dy++) for (let dx = -S; dx <= S; dx++) {
      let sum = 0, n = 0;
      /* rain in the newer picture, against where it would have come from */
      for (let k = 0; k < pb.length; k += 3) { sum += Math.abs(ia(pb[k] - dx, pb[k + 1] - dy) - pb[k + 2]); n++; }
      /* rain in the older picture that this shift carries onto dry ground */
      for (let k = 0; k < pa.length; k += 3) {
        const x = pa[k] + dx, y = pa[k + 1] + dy;
        if (x < x0 || y < y0 || x >= x1 || y >= y1 || ib(x, y)) continue;
        sum += pa[k + 2]; n++;
      }
      const cost = sum / n;
      /* ties go to the smaller shift: no motion is the default, not a guess */
      if (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) <= 1e-9 && dx * dx + dy * dy < best.dx * best.dx + best.dy * best.dy)) best = { dx, dy, cost, n };
    }
    return best;
  }
  const median = xs => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
  function motion(frames, dtMin, opts = {}) {
    const n = opts.regions || 3, ny = opts.regionsY || n, S = Math.max(1, Math.round(opts.search || 8));
    const f0 = frames[frames.length - 1], W = f0.w, H = f0.h;
    const regions = [];
    const all = { u: [], v: [] };
    for (let ry = 0; ry < ny; ry++) for (let rx = 0; rx < n; rx++) {
      const x0 = Math.floor(rx * W / n), x1 = Math.floor((rx + 1) * W / n);
      const y0 = Math.floor(ry * H / ny), y1 = Math.floor((ry + 1) * H / ny);
      const us = [], vs = [];
      let support = 0;
      for (let k = 1; k < frames.length; k++) {
        const m = bestShift(frames[k - 1], frames[k], x0, y0, x1, y1, S);
        if (!m) continue;
        us.push(m.dx / dtMin); vs.push(m.dy / dtMin); support += m.n;
      }
      const r = { x0, y0, x1, y1, u: median(us), v: median(vs), n: support, ok: us.length >= Math.max(1, frames.length - 2) };
      if (r.ok) { all.u.push(r.u); all.v.push(r.v); }
      regions.push(r);
    }
    const u = median(all.u), v = median(all.v);
    for (const r of regions) if (!r.ok) { r.u = u; r.v = v; }
    return { regions, u, v, known: all.u.length > 0 };
  }
  /* the motion at a point: the regions' vectors, weighted by distance */
  function motionAt(m, x, y) {
    let su = 0, sv = 0, sw = 0;
    for (const r of m.regions) {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + 1;
      const w = 1 / d2;
      su += w * r.u; sv += w * r.v; sw += w;
    }
    return sw ? { u: su / sw, v: sv / sw } : { u: m.u, v: m.v };
  }

  /* ── forecast over one point ──
     Backward along the motion: what will be over (px, py) in L minutes is
     what is now at (px − uL, py − vL). The look widens with lead time (radius
     grows ~1 px per 10 min), because neither the motion nor the rain is
     known exactly; the chance of rain is the share of that circle raining.
     Returns 0, 5, … maxMin minutes: { min, p, dbz } (dbz: the 80th
     percentile in the circle — "what you would likely get"). */
  function forecast(f, m, px, py, opts = {}) {
    const maxMin = opts.maxMin || 60, step = opts.step || 5, r0 = opts.r0 ?? 1, grow = opts.grow ?? 0.1;
    const out = [];
    let x = px, y = py;
    for (let L = 0; L <= maxMin; L += step) {
      if (L) {
        /* walk upstream in steps, so a turn in the motion field is followed */
        const mv = motionAt(m, x, y);
        x -= mv.u * step; y -= mv.v * step;
      }
      const R = r0 + grow * L;
      const vals = [];
      const Ri = Math.ceil(R);
      for (let dy = -Ri; dy <= Ri; dy++) for (let dx = -Ri; dx <= Ri; dx++) {
        if (dx * dx + dy * dy > R * R + 0.5) continue;
        const d = at(f, x + dx, y + dy);
        if (d !== null) vals.push(d);
      }
      if (!vals.length) { out.push({ min: L, p: null, dbz: null }); continue; }
      vals.sort((p, q) => p - q);
      out.push({
        min: L,
        p: vals.filter(d => d >= RAIN_DBZ).length / vals.length,
        dbz: vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.8))],
        edge: x < 0 || y < 0 || x >= f.w || y >= f.h
      });
    }
    return out;
  }

  /* ── in words ── */
  const level = d => { for (const [t, w] of LEVELS) if (d >= t) return w; return null; };
  /* opts: base — when the newest radar picture was scanned (ms; the series
     counts from it); now — the reader's moment; clock — ms → "4:32 PM" in the
     place's own time. Minutes in the words are counted from now. */
  function describe(series, opts = {}) {
    const now = opts.now || Date.now(), base = opts.base || now;
    const late = Math.max(0, (now - base) / 60e3);
    const s = (series || []).filter(p => p.p !== null && p.min >= late - 2.5);
    if (s.length < 4) return null;
    const wet = p => p.p >= 0.5;
    const clock = opts.clock || (ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    const at = min => clock(base + min * 60e3);
    const inMin = min => Math.max(1, Math.round((min - late) / 5) * 5 || Math.round(min - late));
    const peak = s.reduce((a, p) => (p.dbz ?? -99) > (a.dbz ?? -99) && wet(p) ? p : a, { dbz: -99 });
    const how = peak.dbz > -99 ? level(peak.dbz) : null;
    if (wet(s[0])) {
      const stop = s.find(p => !wet(p));
      if (!stop) return { kind: 'raining', text: `Raining${how ? ' — ' + how : ''}, and the radar shows it lasting the next hour.`, peak: how };
      return { kind: 'ending', at: stop.min, text: `Raining now; the radar has it moving off around ${at(stop.min)} (about ${inMin(stop.min)} min).`, peak: how };
    }
    const start = s.find(wet);
    if (!start) {
      const close = s.some(p => p.p >= 0.15);
      return { kind: 'dry', text: close ? 'Rain is nearby on radar, but it is not heading straight here in the next hour.' : 'No rain on radar heading here in the next hour.' };
    }
    const end = s.slice(s.indexOf(start)).find(p => !wet(p));
    return {
      kind: 'starting', at: start.min, until: end ? end.min : null, peak: how,
      text: `${how ? how[0].toUpperCase() + how.slice(1) + ' rain' : 'Rain'} likely around ${at(start.min)} (in about ${inMin(start.min)} min)` +
        (end ? `, moving off by about ${at(end.min)}.` : ', lasting past the hour.')
    };
  }

  const api = { decodePng, dbzOf, RAIN_DBZ, PALETTE, indicesOf, SETTINGS, optionsFor, field, motion, motionAt, forecast, describe, level };
  root.WxNowcast = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
