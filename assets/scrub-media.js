/* scrub-media.js — take where-a-photo-was-taken out of a file, losslessly.

   Hard rule 1 covers photo metadata: a phone photo carries the exact point it
   was taken, and a clip carries it too. Nothing is re-encoded here — the
   segments and boxes that hold location (and the rest of the camera's notes)
   are dropped or blanked, and the picture is the same bytes.

     JPEG  every APPn segment but APP0 (JFIF), APP2 ICC_PROFILE (the colour
           space — without it an iPhone's P3 photo goes dull) and APP14
           (Adobe colour transform); every COM. EXIF and XMP live in APP1,
           IPTC in APP13.
     PNG   eXIf, tEXt, zTXt, iTXt, tIME.
     WebP  EXIF and XMP chunks, and their flags in VP8X.
     MP4 / MOV / M4V
           '©xyz' and 'loci' boxes become zeroed 'free' boxes (same size, so
           nothing moves), and any ilst value whose key names a location is
           zeroed.
     GIF   carries no location; passed through.

   HEIC is not handled: scrub() returns null for it and the caller converts
   or refuses. WebM is passed through — browsers write no location into it.

   One file for the page and the Worker: a classic script sets
   globalThis.ScrubMedia, and `import '../assets/scrub-media.js'` does the
   same in a module. */
(function (root) {
  'use strict';

  const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));

  function jpeg(b) {
    if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
    const out = [b.subarray(0, 2)];
    let i = 2;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xFF) return null;
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }                       // fill byte
      if (m === 0xDA || m === 0xD9) { out.push(b.subarray(i)); break; } // image data: the rest as is
      if (m >= 0xD0 && m <= 0xD7 || m === 0x01) { out.push(b.subarray(i, i + 2)); i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      const end = i + 2 + len;
      if (len < 2 || end > b.length) return null;
      const app = m >= 0xE0 && m <= 0xEF;
      const keep = !app && m !== 0xFE
        || m === 0xE0
        || m === 0xEE
        || (m === 0xE2 && ascii(b, i + 4, 11) === 'ICC_PROFILE');
      if (keep) out.push(b.subarray(i, end));
      i = end;
    }
    return join(out);
  }

  const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
  function png(b) {
    if (u32(b, 0) !== 0x89504E47) return null;
    const out = [b.subarray(0, 8)];
    let i = 8;
    while (i + 12 <= b.length) {
      const len = u32(b, i);
      const end = i + 12 + len;
      if (end > b.length) return null;
      if (!PNG_DROP.has(ascii(b, i + 4, 4))) out.push(b.subarray(i, end));
      i = end;
    }
    return join(out);
  }

  function webp(b) {
    if (ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null;
    const out = [];
    let i = 12;
    while (i + 8 <= b.length) {
      const id = ascii(b, i, 4);
      const len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
      const end = i + 8 + len + (len & 1);
      if (end > b.length + 1) return null;
      if (id !== 'EXIF' && id !== 'XMP ') {
        const chunk = b.slice(i, Math.min(end, b.length));
        if (id === 'VP8X') chunk[8] &= ~(0x08 | 0x04);           // EXIF and XMP flags
        out.push(chunk);
      }
      i = end;
    }
    const body = join(out);
    const all = new Uint8Array(12 + body.length);
    all.set(b.subarray(0, 12));
    all.set(body, 12);
    const size = all.length - 8;
    all[4] = size & 255; all[5] = (size >> 8) & 255; all[6] = (size >> 16) & 255; all[7] = (size >>> 24) & 255;
    return all;
  }

  /* ISO-BMFF, edited in place: every change keeps every size, so the sample
     offsets in stco/co64 still point at the right bytes. */
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'udta', 'meta', 'edts', 'dinf', 'stbl']);
  function bmff(src) {
    if (ascii(src, 4, 4) !== 'ftyp') return null;
    const b = src.slice();
    /* A 'free' box of the same size, its contents zeroed. */
    const free = (at, size, head) => { b.set([0x66, 0x72, 0x65, 0x65], at + 4); b.fill(0, at + head, at + size); };
    const walk = (start, end) => {
      let i = start;
      while (i + 8 <= end) {
        let size = u32(b, i);
        let head = 8;
        if (size === 1) { size = u32(b, i + 8) * 2 ** 32 + u32(b, i + 12); head = 16; }
        else if (size === 0) size = end - i;
        if (size < head || i + size > end) return;
        const type = ascii(b, i + 4, 4);
        if (type === '©xyz' || type === 'loci') free(i, size, head);
        else if (type === 'meta') metaBox(i + head, i + size);
        else if (CONTAINERS.has(type)) walk(i + head, i + size);
        i += size;
      }
    };
    /* QuickTime's meta has no version field; ISO's has four zero bytes. Its
       keys list names each ilst item by position. */
    const metaBox = (start, end) => {
      if (ascii(b, start + 4, 4) !== 'hdlr' && u32(b, start) === 0) start += 4;
      const located = new Set();
      let i = start;
      const kids = [];
      while (i + 8 <= end) {
        const size = u32(b, i);
        if (size < 8 || i + size > end) break;
        kids.push([ascii(b, i + 4, 4), i, size]);
        i += size;
      }
      for (const [type, at, size] of kids) {
        if (type !== 'keys') continue;
        const n = u32(b, at + 12);
        let k = at + 16;
        for (let idx = 1; idx <= n && k + 8 <= at + size; idx++) {
          const ks = u32(b, k);
          if (ks < 8) break;
          if (/location|gps|xyz/i.test(ascii(b, k + 8, ks - 8))) located.add(idx);
          k += ks;
        }
      }
      for (const [type, at, size] of kids) {
        if (type === 'ilst') {
          let k = at + 8;
          while (k + 8 <= at + size) {
            const is = u32(b, k);
            if (is < 8) break;
            if (located.has(u32(b, k + 4)) || ascii(b, k + 4, 4) === '©xyz') b.fill(0, k + 8, k + is);
            k += is;
          }
        } else if (CONTAINERS.has(type) || type === '©xyz' || type === 'loci') {
          if (type === '©xyz' || type === 'loci') free(at, size, 8);
          else walk(at + 8, at + size);
        }
      }
    };
    walk(0, b.length);
    return b;
  }

  function join(parts) {
    const n = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  /* bytes → scrubbed bytes; the input bytes when the type carries nothing;
     null when it cannot be read or cannot be scrubbed (HEIC). */
  function bytes(type, b) {
    switch (type) {
      case 'image/jpeg': return jpeg(b);
      case 'image/png': return png(b);
      case 'image/webp': return webp(b);
      case 'image/gif': case 'video/webm': return b;
      case 'video/mp4': case 'video/quicktime': case 'video/x-m4v': return bmff(b);
      default: return null;
    }
  }

  root.ScrubMedia = Object.freeze({ bytes });
})(typeof globalThis !== 'undefined' ? globalThis : this);
