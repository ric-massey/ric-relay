/* bzip2 — a decompressor, for the radar's dual-pol files
   ────────────────────────────────────────────────────────────────────────────
   NEXRAD's Level III dual-pol products (correlation coefficient, ZDR, KDP,
   hydrometeor class, super-resolution reflectivity and velocity) arrive with
   their symbology block bzip2-compressed, and a browser has no bzip2 of its
   own (DecompressionStream knows gzip and deflate only). This is the format
   as Julian Seward's bzip2 1.0 writes it: blocks of Huffman-coded MTF/RLE2
   symbols over a Burrows–Wheeler transform, then the RLE1 pass. Written for
   this room, no dependency; `test/decoders.test.mjs` holds it to Python's
   bz2 on real radar files.

   bunzip2(Uint8Array) → Uint8Array. Throws on a stream it cannot read, and
   the CRCs are checked, so a damaged file is an error rather than a picture. */
(function (root) {
  'use strict';

  const CRC = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 24;
    for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
    CRC[i] = c >>> 0;
  }

  function bunzip2(src) {
    let pos = 0, bitBuf = 0, bitCount = 0;
    const bits = (n) => {
      while (bitCount < n) {
        if (pos >= src.length) throw new Error('bzip2: unexpected end of data');
        bitBuf = ((bitBuf << 8) | src[pos++]) >>> 0;
        bitCount += 8;
      }
      bitCount -= n;
      return (bitBuf >>> bitCount) & ((1 << n) - 1);
    };
    const bit = () => bits(1);

    if (bits(8) !== 0x42 || bits(8) !== 0x5a || bits(8) !== 0x68) throw new Error('bzip2: not a bzip2 stream');
    const level = bits(8) - 0x30;
    if (level < 1 || level > 9) throw new Error('bzip2: bad block size');
    const maxBlock = level * 100000;

    let out = new Uint8Array(Math.max(1024, src.length * 6)), outLen = 0;
    const put = (b) => {
      if (outLen === out.length) { const n = new Uint8Array(out.length * 2); n.set(out); out = n; }
      out[outLen++] = b;
    };
    const tt = new Uint32Array(maxBlock);

    for (;;) {
      const m1 = bits(24), m2 = bits(24);
      if (m1 === 0x177245 && m2 === 0x385090) break;               // end of stream
      if (m1 !== 0x314159 || m2 !== 0x265359) throw new Error('bzip2: bad block header');
      const blockCRC = ((bits(16) << 16) | bits(16)) >>> 0;
      if (bit()) throw new Error('bzip2: randomised blocks are not supported');
      const origPtr = bits(24);

      /* the symbols in use */
      const used = bits(16), seqToUnseq = [];
      for (let i = 0; i < 16; i++) if (used & (0x8000 >> i)) {
        const m = bits(16);
        for (let j = 0; j < 16; j++) if (m & (0x8000 >> j)) seqToUnseq.push(i * 16 + j);
      }
      if (!seqToUnseq.length) throw new Error('bzip2: no symbols');
      const alphaSize = seqToUnseq.length + 2;

      /* Huffman tables and the selectors that choose one per 50 symbols */
      const nGroups = bits(3), nSel = bits(15);
      if (nGroups < 2 || nGroups > 6 || !nSel) throw new Error('bzip2: bad tables');
      const mtfG = [0, 1, 2, 3, 4, 5].slice(0, nGroups), sel = new Uint8Array(nSel);
      for (let i = 0; i < nSel; i++) {
        let j = 0;
        while (bit()) if (++j >= nGroups) throw new Error('bzip2: bad selector');
        const v = mtfG[j];
        for (; j > 0; j--) mtfG[j] = mtfG[j - 1];
        mtfG[0] = v; sel[i] = v;
      }
      const tables = [];
      for (let g = 0; g < nGroups; g++) {
        const len = new Uint8Array(alphaSize);
        let c = bits(5);
        for (let s = 0; s < alphaSize; s++) {
          for (;;) {
            if (c < 1 || c > 20) throw new Error('bzip2: bad code length');
            if (!bit()) break;
            c += bit() ? -1 : 1;
          }
          len[s] = c;
        }
        /* canonical codes: limit/base/perm as bzip2's own decoder builds them */
        let minLen = 32, maxLen = 0;
        for (const l of len) { if (l > maxLen) maxLen = l; if (l < minLen) minLen = l; }
        const perm = [], limit = new Int32Array(maxLen + 2), base = new Int32Array(maxLen + 2);
        for (let l = minLen; l <= maxLen; l++) for (let s = 0; s < alphaSize; s++) if (len[s] === l) perm.push(s);
        const count = new Int32Array(maxLen + 2);
        for (const l of len) count[l]++;
        let code = 0, idx = 0;
        for (let l = minLen; l <= maxLen; l++) {
          base[l] = idx - code;          // symbol index = code + base[l]
          code += count[l]; idx += count[l];
          limit[l] = code - 1;
          code <<= 1;
        }
        tables.push({ perm, limit, base, minLen, maxLen });
      }

      /* the MTF/RLE2 symbols, undone straight into byte counts */
      const mtf = new Uint8Array(256);
      for (let i = 0; i < 256; i++) mtf[i] = i;
      const unzftab = new Int32Array(256);
      const EOB = alphaSize - 1;
      let n = 0, groupPos = 0, selIdx = 0, t = null, runPos = 0, run = 0;
      const flushRun = () => {
        if (!run) return;
        const b = seqToUnseq[mtf[0]];
        if (n + run > maxBlock) throw new Error('bzip2: block too long');
        unzftab[b] += run;
        for (; run > 0; run--) tt[n++] = b;
        runPos = 0;
      };
      for (;;) {
        if (!groupPos) {
          if (selIdx >= nSel) throw new Error('bzip2: ran out of selectors');
          groupPos = 50; t = tables[sel[selIdx++]];
        }
        groupPos--;
        let l = t.minLen, code = bits(l);
        while (l <= t.maxLen && code > t.limit[l]) { code = (code << 1) | bit(); l++; }
        if (l > t.maxLen) throw new Error('bzip2: bad Huffman code');
        const sym = t.perm[code + t.base[l]];
        if (sym <= 1) {                                    // RUNA / RUNB
          run += (sym + 1) << runPos; runPos++;
          continue;
        }
        flushRun();
        if (sym === EOB) break;
        const k = sym - 1, v = mtf[k];
        mtf.copyWithin(1, 0, k); mtf[0] = v;
        const b = seqToUnseq[v];
        if (n >= maxBlock) throw new Error('bzip2: block too long');
        unzftab[b]++; tt[n++] = b;
      }
      if (origPtr >= n) throw new Error('bzip2: bad origin pointer');

      /* the inverse BWT: tt[i] keeps its byte in the low 8 bits and the
         next index above them */
      const cftab = new Int32Array(257);
      for (let i = 0; i < 256; i++) cftab[i + 1] = cftab[i] + unzftab[i];
      for (let i = 0; i < n; i++) { const b = tt[i] & 0xff; tt[cftab[b]++] |= i << 8; }

      /* …and RLE1: four equal bytes are followed by a count */
      let crc = 0xffffffff, p = tt[origPtr] >>> 8, last = -1, same = 0;
      for (let i = 0; i < n; i++) {
        const e = tt[p]; p = e >>> 8;
        const b = e & 0xff;
        if (same === 4) {
          for (let r = 0; r < b; r++) { put(last); crc = ((crc << 8) ^ CRC[((crc >>> 24) ^ last) & 0xff]) >>> 0; }
          same = 0; last = -1;
          continue;
        }
        if (b === last) same++; else { same = 1; last = b; }
        put(b); crc = ((crc << 8) ^ CRC[((crc >>> 24) ^ b) & 0xff]) >>> 0;
      }
      if ((~crc >>> 0) !== blockCRC) throw new Error('bzip2: block CRC mismatch');
    }
    return out.subarray(0, outLen);
  }

  const api = { bunzip2 };
  root.Bzip2 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
