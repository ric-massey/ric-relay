/* An R2 bucket that is only a Map
   ────────────────────────────────────────────────────────────────────────────
   Enough of the R2 binding for dev.mjs to serve a real video and for test.mjs
   to assert who is allowed to upload one, without a Cloudflare account and
   without anybody's bytes leaving the machine.

   It is deliberately not a full R2. It implements the calls worker.mjs actually
   makes — put, get (with Range), head, list (with customMetadata), delete and
   multipart — and nothing else, so a call this file has to grow is a call worth noticing. */

const enc = new TextEncoder();

/* R2's etag is the MD5 of the body. Nothing here depends on it being MD5 —
   only on the same bytes giving the same string and different bytes not — so
   this is a cheap hash wearing the right shape. */
function etagOf(bytes) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = (h1 ^ bytes[i]) * 16777619 >>> 0;
    h2 = (h2 + bytes[i] * (i + 1)) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
}

async function bytesOf(body) {
  if (body == null) return new Uint8Array(0);
  if (body instanceof Uint8Array) return body;
  if (typeof body === 'string') return enc.encode(body);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  /* A ReadableStream — which is what request.body is, and therefore the case
     that actually runs. */
  if (typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out;
  }
  return new Uint8Array(await new Response(body).arrayBuffer());
}

function stored(key, rec) {
  return {
    key,
    size: rec.bytes.length,
    uploaded: rec.uploaded,
    httpEtag: '"' + rec.etag + '"',
    etag: rec.etag,
    httpMetadata: rec.httpMetadata,
    customMetadata: rec.customMetadata,
    writeHttpMetadata(headers) {
      if (rec.httpMetadata && rec.httpMetadata.contentType) {
        headers.set('content-type', rec.httpMetadata.contentType);
      }
      headers.set('content-length', String(rec.bytes.length));
    }
  };
}

export function memoryBucket() {
  const map = new Map();
  const uploads = new Map();
  let uploadSeq = 0;

  return {
    /* Exposed for the tests — the real binding has no such thing. */
    _map: map,

    async put(key, body, opts = {}) {
      const bytes = await bytesOf(body);
      const rec = {
        bytes,
        uploaded: new Date(),
        etag: etagOf(bytes),
        httpMetadata: opts.httpMetadata || {},
        customMetadata: opts.customMetadata || {}
      };
      map.set(key, rec);
      return stored(key, rec);
    },

    async get(key, opts = {}) {
      const rec = map.get(key);
      if (!rec) return null;

      /* onlyIf is handed the request's own headers by the Worker, so the only
         conditional that matters here is If-None-Match on a re-watch. */
      const inm = opts.onlyIf && typeof opts.onlyIf.get === 'function'
        ? opts.onlyIf.get('if-none-match') : null;
      const out = stored(key, rec);
      if (inm && inm.replace(/^W\//, '') === '"' + rec.etag + '"') {
        return { ...out, body: null, writeHttpMetadata: out.writeHttpMetadata };
      }

      const raw = opts.range && typeof opts.range.get === 'function'
        ? opts.range.get('range') : null;
      const m = raw && /^bytes=(\d*)-(\d*)$/.exec(raw.trim());
      if (m) {
        const total = rec.bytes.length;
        let start, end;
        if (m[1] === '') {                       // bytes=-500, the last 500
          const n = Math.min(Number(m[2]), total);
          start = total - n; end = total - 1;
        } else {
          start = Number(m[1]);
          end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
        }
        if (!(start >= 0 && start <= end)) return null;
        const slice = rec.bytes.slice(start, end + 1);
        return {
          ...out,
          range: { offset: start, length: slice.length },
          body: new Blob([slice]).stream(),
          writeHttpMetadata: out.writeHttpMetadata
        };
      }

      return { ...out, body: new Blob([rec.bytes]).stream(), writeHttpMetadata: out.writeHttpMetadata };
    },

    async list(opts = {}) {
      const prefix = opts.prefix || '';
      const keys = [...map.keys()].filter(k => k.startsWith(prefix)).sort();
      return {
        objects: keys.map(k => stored(k, map.get(k))),
        truncated: false,
        delimitedPrefixes: []
      };
    },

    async delete(keys) {
      for (const k of Array.isArray(keys) ? keys : [keys]) map.delete(k);
    },

    async head(key) {
      const rec = map.get(key);
      return rec ? stored(key, rec) : null;
    },

    /* Multipart, for a video too big for one request. Kept as strict as R2 is
       about the two things that make a real one fail: an unknown upload id,
       and a part list whose etags are not the ones it handed out. Nothing is
       listed until complete. */
    async createMultipartUpload(key, opts = {}) {
      const uploadId = 'mpu-' + (++uploadSeq);
      uploads.set(uploadId, { key, opts, parts: new Map() });
      return resume(key, uploadId);
    },

    resumeMultipartUpload(key, uploadId) {
      return resume(key, uploadId);
    },

    /* Exposed for the tests: uploads begun and not yet finished or aborted. */
    _uploads: uploads
  };

  function resume(key, uploadId) {
    const live = () => {
      const u = uploads.get(uploadId);
      if (!u || u.key !== key) throw new Error('NoSuchUpload');
      return u;
    };
    return {
      key, uploadId,
      async uploadPart(n, body) {
        const u = live();
        const bytes = await bytesOf(body);
        const etag = etagOf(bytes);
        u.parts.set(n, { bytes, etag });
        return { partNumber: n, etag };
      },
      async complete(parts) {
        const u = live();
        const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
        const chunks = sorted.map(p => {
          const got = u.parts.get(p.partNumber);
          if (!got || got.etag !== p.etag) throw new Error('InvalidPart');
          return got.bytes;
        });
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const bytes = new Uint8Array(total);
        let at = 0;
        for (const c of chunks) { bytes.set(c, at); at += c.length; }
        uploads.delete(uploadId);
        const rec = {
          bytes, uploaded: new Date(), etag: etagOf(bytes),
          httpMetadata: u.opts.httpMetadata || {},
          customMetadata: u.opts.customMetadata || {}
        };
        map.set(key, rec);
        return stored(key, rec);
      },
      async abort() {
        uploads.delete(uploadId);
      }
    };
  }
}
