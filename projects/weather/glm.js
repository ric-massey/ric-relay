/* GLM — lightning from the GOES satellites, read in the browser
   ────────────────────────────────────────────────────────────────────────────
   The Geostationary Lightning Mapper on GOES-East (GOES-19) and GOES-West
   (GOES-18) sees every flash over the Americas, day and night, and NOAA puts
   its Level 2 file in the public bucket (`noaa-goes19`, `noaa-goes18`, CORS
   open) every 20 seconds. Each file is netCDF-4 — HDF5 underneath — about
   350 KB, of which the flashes (where, when, how bright) are a few KB.

   So this is a small HDF5 reader: just enough of the format (version 2/3
   superblock — and 0/1, with its symbol-table groups, for older files —
   version 1 and 2 object headers, compact and dense links and
   attributes, chunked datasets with the deflate and shuffle filters) to find
   the flash variables and read them, fetching only the byte ranges it needs
   — the metadata at the head of the file and the five little chunks — so a
   minute of lightning costs about 200 KB rather than a megabyte. Ric's call,
   2026-10-22. `test/decoders.test.mjs` holds it to h5py on a real file.
   abi.js reads the imager's bands with the same reader: their chunks are
   two-dimensional (row bands), put back where each belongs, and `raw16`
   keeps a band as its 16-bit counts with the scale to read them by.

   Flashes are what the GLM reports; ground strikes are a different
   instrument (the commercial networks) and nothing here calls them that. */
(function (root) {
  'use strict';

  /* ── a file read in pieces ──
     read(offset, length) answers from 16 KB blocks fetched with Range
     requests (or from a whole file already in memory, for the tests). */
  function source(get, size) {
    const BLOCK = 16384, blocks = new Map();
    const block = (k) => {
      if (!blocks.has(k)) blocks.set(k, get(k * BLOCK, Math.min(BLOCK, size ? size - k * BLOCK : BLOCK)).catch((e) => { blocks.delete(k); throw e; }));
      return blocks.get(k);
    };
    return {
      async read(off, len) {
        const out = new Uint8Array(len);
        for (let k = Math.floor(off / BLOCK); k * BLOCK < off + len; k++) {
          const b = await block(k), s = Math.max(off, k * BLOCK), e = Math.min(off + len, k * BLOCK + b.length);
          if (e > s) out.set(b.subarray(s - k * BLOCK, e - k * BLOCK), s - off);
        }
        return out;
      },
      /* a chunk is fetched by itself, exactly */
      exact: (off, len) => get(off, len)
    };
  }
  const fromBytes = (bytes) => source(async (o, n) => bytes.subarray(o, o + n), bytes.length);
  function fromUrl(url, { signal, fetchFn = fetch } = {}) {
    return source(async (o, n) => {
      const r = await fetchFn(url, { signal, headers: { Range: `bytes=${o}-${o + n - 1}` } });
      if (!r.ok) throw new Error('glm: HTTP ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    });
  }

  /* ── little-endian fields ── */
  const le = (b, o, n) => { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + b[o + i]; return v; };
  const UNDEF = 2 ** 64 - 1;

  async function inflate(bytes) {
    if (typeof DecompressionStream === 'function') {
      const ds = new DecompressionStream('deflate');
      const out = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
      return new Uint8Array(out);
    }
    return new Uint8Array(require('zlib').inflateSync(bytes));
  }
  function unshuffle(b, size) {
    const n = b.length / size, out = new Uint8Array(b.length);
    for (let k = 0; k < size; k++) for (let i = 0; i < n; i++) out[i * size + k] = b[k * n + i];
    return out;
  }

  /* ── the file ── */
  async function open(src) {
    const sb = await src.read(0, 64);
    if (sb[0] !== 0x89 || sb[1] !== 0x48 || sb[2] !== 0x44 || sb[3] !== 0x46) throw new Error('glm: not an HDF5 file');
    const ver = sb[8];
    let O, L, rootAddr;
    if (ver === 2 || ver === 3) { O = sb[9]; L = sb[10]; rootAddr = le(sb, 12 + 3 * O, O); }
    else if (ver === 0 || ver === 1) {
      /* the older superblock (ERA5's files before about 2023, 2026-10-24):
         four addresses, then the root group's symbol table entry — its
         second field is the root's object header */
      O = sb[13]; L = sb[14];
      const p = (ver === 1 ? 28 : 24) + 4 * O;
      rootAddr = le(await src.read(0, p + 2 * O), p + O, O);
    } else throw new Error('glm: superblock version ' + ver + ' is not read here');
    const f = { src, O, L, cache: new Map() };
    f.root = await header(f, rootAddr);
    return f;
  }

  /* An object header's messages, version 1 or 2, continuations followed. */
  async function header(f, addr) {
    if (f.cache.has(addr)) return f.cache.get(addr);
    const { src, O } = f;
    const msgs = [];
    const head = await src.read(addr, 32);
    const chunks = [];
    if (head[0] === 0x4f && head[1] === 0x48 && head[2] === 0x44 && head[3] === 0x52) {      // "OHDR", version 2
      const flags = head[5];
      let p = 6 + (flags & 0x20 ? 16 : 0) + (flags & 0x10 ? 4 : 0);
      const sz = 1 << (flags & 3), len = le(head, p, sz);
      chunks.push({ at: addr + p + sz, len, v: 2, tracked: !!(flags & 0x04) });
    } else if (head[0] === 1) {
      const len = le(head, 8, 4);
      chunks.push({ at: addr + 16, len, v: 1 });
    } else throw new Error('glm: unknown object header at ' + addr);
    while (chunks.length) {
      const c = chunks.shift(), b = await src.read(c.at, c.len);
      /* a version 2 continuation is "OCHK", messages, a checksum; the first
         chunk's length counts its messages only (its checksum follows it) */
      let p = c.v === 2 && c.cont ? 4 : 0;
      const stop = c.v === 2 && c.cont ? c.len - 4 : c.len;
      while (p + (c.v === 2 ? 4 : 8) <= stop) {
        let type, size;
        if (c.v === 2) { type = b[p]; size = le(b, p + 1, 2); p += 4 + (c.tracked ? 2 : 0); }
        else { type = le(b, p, 2); size = le(b, p + 2, 2); p += 8; }
        const body = b.subarray(p, p + size);
        if (type === 0x10) chunks.push({ at: le(body, 0, O), len: le(body, O, f.L), v: c.v, cont: c.v === 2, tracked: c.tracked });
        else if (type) msgs.push({ type, body });
        p += size;
      }
    }
    f.cache.set(addr, msgs);
    return msgs;
  }

  /* ── links: compact (link messages) or dense (a fractal heap) ── */
  function linkMessage(b, O) {
    const flags = b[1];
    let p = 2, type = 0;
    if (flags & 0x08) type = b[p++];
    if (flags & 0x04) p += 8;
    if (flags & 0x10) p++;
    const nl = 1 << (flags & 3), n = le(b, p, nl); p += nl;
    const name = new TextDecoder().decode(b.subarray(p, p + n)); p += n;
    return { name, addr: type === 0 ? le(b, p, O) : null, size: p + (type === 0 ? O : 0) };
  }
  /* ── dense storage: a fractal heap of objects, indexed by a version 2
     B-tree. The heap is not packed end to end — netCDF rewrites attributes
     and leaves holes — so every object is found through the tree's heap IDs. */
  const bytesFor = (n) => Math.max(1, Math.ceil(Math.log2(n + 1) / 8));
  async function fractalHeap(f, addr) {
    const { src, O, L } = f;
    const h = await src.read(addr, 256);
    if (String.fromCharCode(h[0], h[1], h[2], h[3]) !== 'FRHP') throw new Error('glm: not a fractal heap');
    const idLen = le(h, 5, 2), filterLen = le(h, 7, 2), flags = h[9], maxObj = le(h, 10, 4);
    let p = 14 + L + O + L + O + L + L + L + L + L + L + L + L;
    const width = le(h, p, 2); p += 2;
    const startBlock = le(h, p, L); p += L;
    const maxDirect = le(h, p, L); p += L;
    const maxHeapBits = le(h, p, 2); p += 2;
    p += 2;                                                          // starting rows
    const rootAddr = le(h, p, O); p += O;
    const rows = le(h, p, 2);
    if (filterLen) throw new Error('glm: filtered heaps are not read here');
    const offBytes = Math.ceil(maxHeapBits / 8), lenBytes = bytesFor(Math.min(maxDirect, maxObj));
    /* the direct blocks and where each sits in the heap's address space */
    const blocks = [];
    if (rows === 0) blocks.push({ addr: rootAddr, start: 0, size: startBlock });
    else {
      const maxDirectRows = Math.log2(maxDirect) - Math.log2(startBlock) + 2, dRows = Math.min(rows, maxDirectRows);
      const ib = await src.read(rootAddr, 5 + O + offBytes + dRows * width * O);
      let q = 5 + O + offBytes, start = 0;
      for (let r = 0; r < dRows; r++) for (let c = 0; c < width; c++) {
        const a = le(ib, q, O), size = r < 2 ? startBlock : startBlock * 2 ** (r - 1); q += O;
        if (a !== UNDEF && a) blocks.push({ addr: a, start, size });
        start += size;
      }
    }
    void flags;
    return {
      idLen,
      async get(id) {
        if (((id[0] >> 4) & 3) !== 0) throw new Error('glm: only managed heap objects are read here');
        const off = le(id, 1, offBytes), len = le(id, 1 + offBytes, lenBytes);
        const b = blocks.find((k) => off >= k.start && off < k.start + k.size);
        if (!b) throw new Error('glm: heap object outside its blocks');
        return src.read(b.addr + off - b.start, len);
      }
    };
  }
  /* every record of a version 2 B-tree (depth 0 or 1 — what a file this size has) */
  async function btree2(f, addr) {
    const { src, O, L } = f;
    const h = await src.read(addr, 64);
    if (String.fromCharCode(h[0], h[1], h[2], h[3]) !== 'BTHD') throw new Error('glm: not a B-tree');
    const type = h[5], nodeSize = le(h, 6, 4), recSize = le(h, 10, 2), depth = le(h, 12, 2);
    const rootAddr = le(h, 16, O), rootN = le(h, 16 + O, 2);
    void L;
    const out = [];
    const leaf = async (a, n) => { const b = await src.read(a, 6 + n * recSize); for (let i = 0; i < n; i++) out.push(b.subarray(6 + i * recSize, 6 + (i + 1) * recSize)); };
    if (depth === 0) await leaf(rootAddr, rootN);
    else if (depth === 1) {
      const maxLeaf = Math.floor((nodeSize - 10) / recSize), nb = bytesFor(maxLeaf);
      const b = await src.read(rootAddr, 6 + rootN * recSize + (rootN + 1) * (O + nb));
      for (let i = 0; i < rootN; i++) out.push(b.subarray(6 + i * recSize, 6 + (i + 1) * recSize));
      let q = 6 + rootN * recSize;
      for (let i = 0; i <= rootN; i++) { const a = le(b, q, O), n = le(b, q + O, nb); q += O + nb; await leaf(a, n); }
    } else throw new Error('glm: B-tree depth ' + depth + ' is not read here');
    return { type, records: out };
  }
  /* the objects a dense store holds, each parsed by `parseOne` */
  async function denseObjects(f, heapAddr, treeAddr, parseOne) {
    const heap = await fractalHeap(f, heapAddr), tree = await btree2(f, treeAddr);
    const ids = tree.records.map((r) => (tree.type === 5 ? r.subarray(4, 4 + heap.idLen) : r.subarray(0, heap.idLen)));
    return (await Promise.all(ids.map((id) => heap.get(id)))).map(parseOne).filter(Boolean);
  }
  /* ── the older groups: a symbol table message points at a version 1
     B-tree of symbol nodes ("SNOD") and a local heap of their names ── */
  async function symbolTable(f, body, out) {
    const { src, O, L } = f, tree = le(body, 0, O), heapAddr = le(body, O, O);
    const hh = await src.read(heapAddr, 8 + 2 * L + O);
    if (String.fromCharCode(hh[0], hh[1], hh[2], hh[3]) !== 'HEAP') throw new Error('glm: not a local heap');
    const dataSize = le(hh, 8, L), data = await src.read(le(hh, 8 + 2 * L, O), dataSize);
    const nameAt = (off) => { let e = off; while (e < data.length && data[e]) e++; return new TextDecoder().decode(data.subarray(off, e)); };
    const walk = async (addr) => {
      const h = await src.read(addr, 8 + 2 * O);
      const sig = String.fromCharCode(h[0], h[1], h[2], h[3]);
      if (sig === 'SNOD') {
        const n = le(h, 6, 2), b = await src.read(addr + 8, n * (2 * O + 24));
        for (let i = 0; i < n; i++) { const q = i * (2 * O + 24); out.set(nameAt(le(b, q, O)), le(b, q + O, O)); }
        return;
      }
      if (sig !== 'TREE' || h[4] !== 0) throw new Error('glm: bad group tree');
      const entries = le(h, 6, 2), b = await src.read(addr + 8 + 2 * O, (entries + 1) * L + entries * O), kids = [];
      for (let e = 0; e < entries; e++) kids.push(le(b, L + e * (L + O), O));
      await Promise.all(kids.map(walk));
    };
    await walk(tree);
  }
  async function links(f, msgs) {
    const out = new Map();
    const st = msgs.find((m) => m.type === 0x11);
    if (st) await symbolTable(f, st.body, out);
    for (const m of msgs) if (m.type === 0x06) { const l = linkMessage(m.body, f.O); out.set(l.name, l.addr); }
    const info = msgs.find((m) => m.type === 0x02);
    if (info) {
      const flags = info.body[1], p = 2 + (flags & 1 ? 8 : 0), heap = le(info.body, p, f.O), tree = le(info.body, p + f.O, f.O);
      if (heap !== UNDEF) for (const l of await denseObjects(f, heap, tree, (b) => linkMessage(b, f.O))) out.set(l.name, l.addr);
    }
    return out;
  }

  /* ── types, shapes, attributes ── */
  function datatype(b) {
    const cls = b[0] & 0x0f, bits = b[1] | (b[2] << 8), size = le(b, 4, 4);
    return { cls, size, signed: cls === 0 ? !!(bits & 0x08) : true, bigEndian: !!(bits & 1) };
  }
  function dataspace(b, L) {
    const v = b[0], rank = b[1];
    let p = v === 1 ? 8 : 4;
    const dims = [];
    for (let i = 0; i < rank; i++) { dims.push(le(b, p, L)); p += L; }
    return dims;
  }
  function decodeValues(bytes, t, n) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), out = new Float64Array(n), little = !t.bigEndian;
    for (let i = 0; i < n; i++) {
      const o = i * t.size;
      if (t.cls === 1) out[i] = t.size === 4 ? dv.getFloat32(o, little) : dv.getFloat64(o, little);
      else if (t.size === 1) out[i] = t.signed ? dv.getInt8(o) : dv.getUint8(o);
      else if (t.size === 2) out[i] = t.signed ? dv.getInt16(o, little) : dv.getUint16(o, little);
      else if (t.size === 4) out[i] = t.signed ? dv.getInt32(o, little) : dv.getUint32(o, little);
      else out[i] = Number(t.signed ? dv.getBigInt64(o, little) : dv.getBigUint64(o, little));
    }
    return out;
  }
  function attributeMessage(b, L) {
    const v = b[0];
    if (v !== 1 && v !== 2 && v !== 3) return null;
    const nameLen = le(b, 2, 2), dtLen = le(b, 4, 2), dsLen = le(b, 6, 2);
    let p = v === 3 ? 9 : 8;
    const pad = (x) => (v === 1 ? (x + 7) & ~7 : x);
    const name = new TextDecoder().decode(b.subarray(p, p + nameLen - 1)); p += pad(nameLen);
    const t = datatype(b.subarray(p, p + dtLen)); p += pad(dtLen);
    const dims = dataspace(b.subarray(p, p + dsLen), L); p += pad(dsLen);
    const n = dims.reduce((a, c) => a * c, 1), raw = b.subarray(p, p + n * t.size);
    const value = t.cls === 3 ? new TextDecoder().decode(raw).replace(/\0+$/, '') : decodeValues(raw, t, n);
    return { name, value: t.cls !== 3 && n === 1 ? value[0] : value, size: p + n * t.size };
  }
  async function attributes(f, msgs) {
    const out = {};
    for (const m of msgs) if (m.type === 0x0c) { const a = attributeMessage(m.body, f.L); if (a) out[a.name] = a.value; }
    const info = msgs.find((m) => m.type === 0x15);
    if (info) {
      const flags = info.body[1], p = 2 + (flags & 1 ? 2 : 0), heap = le(info.body, p, f.O), tree = le(info.body, p + f.O, f.O);
      if (heap !== UNDEF) for (const a of await denseObjects(f, heap, tree, (b) => attributeMessage(b, f.L))) out[a.name] = a.value;
    }
    return out;
  }

  /* ── one dataset's values, scaled the way netCDF's attributes say ── */
  /* `slice0`: one index of the first dimension of a 3-D chunked dataset —
     one pressure level of the Met Office's UKMET files (2026-10-24), which
     hold all 37 levels in 130–230 MB. Only the chunks that cover that index
     are fetched, and the 2-D plane comes back. An array fixes as many
     leading dimensions as it has indices: [hour, level] of an ERA5
     pressure-level file (time × level × lat × lon, 2026-10-24).
     `win`: [r0, r1, c0, c1], the rows and columns of the 2-D plane wanted
     (end exclusive). Only the chunks touching it are fetched, and what comes
     back is those chunks' rows and columns, with `origin` [row, col] saying
     where in the full plane they start — a map's view out of a global grid.
     `cache`: a Map the caller keeps per file; each chunk is decompressed
     once and kept there, so the next hour of the same chunk (ERA5 packs 27
     hours in one) costs nothing to fetch. */
  async function variable(f, name, knownAttrs, { raw16 = false, slice0 = null, win = null, cache = null } = {}) {
    const addr = (f.links || (f.links = await links(f, f.root))).get(name);
    if (addr == null) throw new Error('glm: no variable ' + name);
    const msgs = await header(f, addr);
    const t = datatype(msgs.find((m) => m.type === 0x03).body);
    const full = dataspace(msgs.find((m) => m.type === 0x01).body, f.L);
    let dims = full;
    const lead = slice0 == null ? [] : Array.isArray(slice0) ? slice0 : [slice0];
    if (lead.length && full.length === lead.length + 2) dims = full.slice(lead.length);
    let n = dims.reduce((a, c) => a * c, 1), origin = null;
    const lay = msgs.find((m) => m.type === 0x08).body;
    const filters = [];
    const fp = msgs.find((m) => m.type === 0x0b);
    if (fp) {
      const b = fp.body, v = b[0], nf = b[1];
      let p = v === 1 ? 8 : 2;
      for (let i = 0; i < nf; i++) {
        const id = le(b, p, 2), nameLen = v === 1 || id >= 256 ? le(b, p + 2, 2) : 0, nv = le(b, p + (v === 1 || id >= 256 ? 6 : 4), 2);
        p += (v === 1 || id >= 256 ? 8 : 6) + (v === 1 ? (nameLen + 7) & ~7 : nameLen) + nv * 4 + (v === 1 && nv % 2 ? 4 : 0);
        filters.push(id);
      }
    }
    let bytes = new Uint8Array(0), cdims = null;
    if (n) {
      const parts = [];
      if (lay[0] === 3 && lay[1] === 2) {
        /* chunked, version 1 B-tree of chunks */
        const rank = lay[2], tree = le(lay, 3, f.O);
        const walk = async (node) => {
          const h = await f.src.read(node, 24 + 64 * (16 + 8 * rank + f.O));
          if (String.fromCharCode(h[0], h[1], h[2], h[3]) !== 'TREE') throw new Error('glm: bad chunk tree');
          const level = h[5], entries = le(h, 6, 2), kids = [];
          let p = 8 + 2 * f.O;
          for (let e = 0; e < entries; e++) {
            const size = le(h, p, 4), mask = le(h, p + 4, 4), offs = [];
            for (let d = 0; d < rank; d++) offs.push(le(h, p + 8 + 8 * d, 8));
            p += 8 + 8 * rank;
            const child = le(h, p, f.O); p += f.O;
            if (level > 0) kids.push(child); else parts.push({ addr: child, size, mask, offs });
          }
          /* the branches at once: a UKMET pressure file's tree is hundreds of nodes, and one at a time took 40 s */
          await Promise.all(kids.map(walk));
        };
        await walk(tree);
        /* the chunk's shape, so a 2-D image (GOES ABI's, in row bands) is
           put back together where each chunk belongs */
        cdims = [];
        for (let d = 0; d < rank - 1; d++) cdims.push(le(lay, 3 + f.O + 4 * d, 4));
        if (dims !== full) {
          /* only the chunks holding that level (or hour and level), each cut to its plane there */
          const L = lead.length, keep = parts.filter((c) => lead.every((x, d) => x >= c.offs[d] && x < c.offs[d] + cdims[d]));
          parts.length = 0;
          for (const c of keep) {
            let plane = 0;
            for (let d = 0; d < L; d++) plane = plane * cdims[d] + (lead[d] - c.offs[d]);
            parts.push({ ...c, plane, offs: c.offs.slice(L) });
          }
          cdims = cdims.slice(L);
          if (!parts.length) throw new Error('glm: no chunk holds index ' + lead.join(',') + ' of ' + name);
        }
        if (win && dims.length === 2) {
          /* only the chunks over the window, and the plane shrunk to them */
          const [r0, r1, c0, c1] = win, keep = parts.filter((c) => c.offs[0] < r1 && c.offs[0] + cdims[0] > r0 && c.offs[1] < c1 && c.offs[1] + cdims[1] > c0);
          if (!keep.length) throw new Error('glm: the window holds none of ' + name);
          const o0 = Math.min(...keep.map((c) => c.offs[0])), o1 = Math.min(...keep.map((c) => c.offs[1]));
          const e0 = Math.min(dims[0], Math.max(...keep.map((c) => c.offs[0] + cdims[0]))), e1 = Math.min(dims[1], Math.max(...keep.map((c) => c.offs[1] + cdims[1])));
          parts.length = 0;
          for (const c of keep) parts.push({ ...c, offs: [c.offs[0] - o0, c.offs[1] - o1] });
          dims = [e0 - o0, e1 - o1];
          origin = [o0, o1];
        }
      } else if (lay[0] === 4 && lay[1] === 2 && lay[3 + lay[2] * lay[4] + 0] !== undefined) {
        /* chunked, version 4: only the single-chunk index is read here */
        const rank = lay[3], dsz = lay[4];
        const p = 5 + rank * dsz, idx = lay[p];
        if (idx !== 1) throw new Error('glm: chunk index type ' + idx + ' is not read here');
        const filtered = lay[2] & 2;
        const size = filtered ? le(lay, p + 1, f.L) : null, mask = filtered ? le(lay, p + 1 + f.L, 4) : 0;
        const addr = le(lay, p + 1 + (filtered ? f.L + 4 : 0), f.O);
        parts.push({ addr, size: size || n * t.size, mask, offs: [0] });
      } else if ((lay[0] === 3 || lay[0] === 4) && lay[1] === 1) {
        parts.push({ addr: le(lay, 2, f.O), size: le(lay, 2 + f.O, f.L), mask: 0xffffffff, offs: [0], raw: true });
      } else if ((lay[0] === 3 || lay[0] === 4) && lay[1] === 0) {
        const sz = le(lay, 2, 2);
        bytes = lay.slice(4, 4 + sz);
      } else throw new Error('glm: layout ' + lay[0] + '/' + lay[1] + ' is not read here');
      if (parts.length) {
        if (origin) n = dims[0] * dims[1];
        bytes = new Uint8Array(n * t.size);
        /* every chunk asked at once: an ABI band is dozens of them */
        await Promise.all(parts.map(async (c) => {
          const unpack = async () => {
            let b = await f.src.exact(c.addr, c.size);
            if (!c.raw) for (let i = filters.length - 1; i >= 0; i--) {
              if (c.mask & (1 << i)) continue;
              if (filters[i] === 1) b = await inflate(b);
              else if (filters[i] === 2) b = unshuffle(b, t.size);
              else if (filters[i] === 3) b = b.subarray(0, b.length - 4);
              else throw new Error('glm: filter ' + filters[i] + ' is not read here');
            }
            return b;
          };
          let b;
          if (cache) {
            const key = name + '@' + c.addr;
            if (!cache.has(key)) cache.set(key, unpack().catch((e) => { cache.delete(key); throw e; }));
            b = await cache.get(key);
          } else b = await unpack();
          if (c.plane != null) { const ps = cdims.reduce((a, x) => a * x, 1) * t.size; b = b.subarray(c.plane * ps, (c.plane + 1) * ps); }
          if (!cdims || dims.length < 2) {
            const at = (c.offs ? c.offs[0] : 0) * t.size;
            bytes.set(b.subarray(0, Math.min(b.length, bytes.length - at)), at);
            return;
          }
          /* row by row: every index but the last walks the chunk, the last is
             one run of bytes; a chunk at the edge is cut to the dataset */
          const r = dims.length, last = Math.min(cdims[r - 1], dims[r - 1] - c.offs[r - 1]), idx = new Array(r - 1).fill(0);
          for (;;) {
            let inside = true, src = 0, dst = 0;
            for (let d = 0; d < r - 1; d++) {
              if (c.offs[d] + idx[d] >= dims[d]) { inside = false; break; }
              src = src * cdims[d] + idx[d]; dst = dst * dims[d] + c.offs[d] + idx[d];
            }
            if (inside) {
              src = src * cdims[r - 1]; dst = dst * dims[r - 1] + c.offs[r - 1];
              bytes.set(b.subarray(src * t.size, (src + last) * t.size), dst * t.size);
            }
            let d = r - 2;
            while (d >= 0 && ++idx[d] >= cdims[d]) idx[d--] = 0;
            if (d < 0) break;
          }
        }));
      }
    }
    const attrs = knownAttrs || await attributes(f, msgs);
    if (raw16 && t.cls === 0 && t.size === 2) {
      /* an image (GOES ABI: 3.75 million 16-bit counts a CONUS band) is
         kept as its counts, with the scale to read them by — a quarter of
         the memory of the decoded numbers */
      const uns = attrs._Unsigned === 'true' || !t.signed, n2 = n, out = uns ? new Uint16Array(n2) : new Int16Array(n2);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), little = !t.bigEndian;
      for (let i = 0; i < n2; i++) out[i] = uns ? dv.getUint16(i * 2, little) : dv.getInt16(i * 2, little);
      const fill = attrs._FillValue;
      return { raw: out, scale: attrs.scale_factor ?? 1, offset: attrs.add_offset ?? 0, fill: fill != null && uns && fill < 0 ? fill + 65536 : fill, attrs, dims, origin };
    }
    const raw = decodeValues(bytes, attrs._Unsigned === 'true' ? { ...t, signed: false } : t, n);
    const fill = attrs._FillValue, scale = attrs.scale_factor ?? 1, offset = attrs.add_offset ?? 0;
    const unsignedFill = fill != null && attrs._Unsigned === 'true' && fill < 0 ? fill + 2 ** (8 * t.size) : fill;
    const vals = new Float64Array(n);
    for (let i = 0; i < n; i++) vals[i] = unsignedFill != null && raw[i] === unsignedFill ? NaN : raw[i] * scale + offset;
    return { values: vals, attrs, dims, origin };
  }
  /* an object's attributes alone (a scalar like goes_imager_projection
     carries everything in them) */
  async function attrsOf(f, name) {
    const addr = (f.links || (f.links = await links(f, f.root))).get(name);
    if (addr == null) throw new Error('glm: no variable ' + name);
    return attributes(f, await header(f, addr));
  }

  /* ── flashes ──
     Each: lat, lon, t (ms), energy (fJ), good (the GLM's own quality flag
     is 0). The file's start time is in its name. */
  function fileStart(key) {
    const m = /_s(\d{4})(\d{3})(\d\d)(\d\d)(\d\d)(\d)/.exec(key);
    if (!m) return null;
    return Date.UTC(+m[1], 0, 1, +m[3], +m[4], +m[5]) + (+m[2] - 1) * 86400e3 + +m[6] * 100;
  }
  /* `memo` carries each variable's attributes from the first file read to
     the rest: the attributes sit in heaps spread through the whole file, and
     a scale factor does not change from one 20-second file to the next. The
     one attribute that does — the time units, "seconds since <the file's
     start>" — is the start in the file's name. */
  const FLASH_VARS = ['flash_lat', 'flash_lon', 'flash_time_offset_of_first_event', 'flash_energy', 'flash_quality_flag'];
  async function flashes(src, key, memo) {
    const f = await open(src);
    const [lat, lon, t, e, q] = await Promise.all(FLASH_VARS.map((v) => variable(f, v, memo && memo[v])));
    if (memo) FLASH_VARS.forEach((v, i) => { memo[v] = [lat, lon, t, e, q][i].attrs; });
    const base = (() => {
      const fromName = key ? fileStart(key) : null;
      if (fromName != null) return fromName;
      const m = /since (\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d(?:\.\d+)?)/.exec(t.attrs.units || '');
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + parseFloat(m[6]) * 1000 : null;
    })();
    const out = [];
    for (let i = 0; i < lat.values.length; i++) {
      if (!Number.isFinite(lat.values[i]) || !Number.isFinite(lon.values[i])) continue;
      out.push({ lat: lat.values[i], lon: lon.values[i], t: base + t.values[i] * 1000, energy: e.values[i] * 1e15, good: q.values[i] === 0 });
    }
    return out;
  }

  /* ── the buckets ──
     GLM-L2-LCFA/YYYY/DDD/HH/OR_GLM-L2-LCFA_G19_sYYYYDDDHHMMSSt_e…_c….nc */
  const SATS = {
    east: { bucket: 'https://noaa-goes19.s3.amazonaws.com', id: 'G19', label: 'GOES-East (GOES-19)' },
    west: { bucket: 'https://noaa-goes18.s3.amazonaws.com', id: 'G18', label: 'GOES-West (GOES-18)' }
  };
  /* Where each satellite's flashes are used: they overlap over the middle of
     the country and both see the same flashes there, so the map takes
     GOES-East east of 105° W and GOES-West west of it. */
  const SPLIT_LON = -105;
  function hourPrefix(ms) {
    const d = new Date(ms), y = d.getUTCFullYear(), doy = Math.floor((ms - Date.UTC(y, 0, 1)) / 86400e3) + 1;
    return `GLM-L2-LCFA/${y}/${String(doy).padStart(3, '0')}/${String(d.getUTCHours()).padStart(2, '0')}/`;
  }
  /* the files whose 20 seconds began in the last `mins` minutes, oldest first */
  async function files(sat, { mins = 10, nowMs = Date.now(), after = '', signal, fetchFn = fetch } = {}) {
    const S = SATS[sat];
    const prefixes = [...new Set([hourPrefix(nowMs - mins * 60e3), hourPrefix(nowMs)])];
    const keys = [];
    for (const pre of prefixes) {
      const q = new URLSearchParams({ 'list-type': '2', prefix: pre });
      if (after && after.startsWith(pre)) q.set('start-after', after);
      const r = await fetchFn(`${S.bucket}/?${q}`, { signal });
      if (!r.ok) throw new Error('glm: listing HTTP ' + r.status);
      const xml = await r.text(), re = /<Key>([^<]+)<\/Key>/g;
      let m;
      while ((m = re.exec(xml))) keys.push(m[1]);
    }
    return keys.map((key) => ({ key, t: fileStart(key), url: `${S.bucket}/${key}` }))
      .filter((k) => k.t && k.t >= nowMs - mins * 60e3).sort((a, b) => a.t - b.t);
  }

  /* ── flash density ──
     How many flashes fell in each square of the map over a window: the
     number forecasters read a storm's electrical strength off. Squares are
     `km` on a side (rows by latitude, each row cut into columns of the same
     width in km), so a square in Texas and one in Montana are the same size. */
  function density(list, { nowMs = Date.now(), windowMs = 5 * 60e3, km = 8 } = {}) {
    const dLat = km / 110.574, from = nowMs - windowMs, map = new Map();
    let max = 0;
    for (const f of list) {
      if (f.t < from || f.t > nowMs) continue;
      const row = Math.floor(f.lat / dLat), dLon = km / (111.32 * Math.cos((row + 0.5) * dLat * Math.PI / 180));
      const col = Math.floor(f.lon / dLon), key = row * 100000 + col;
      let c = map.get(key);
      if (!c) { c = { lat0: row * dLat, lon0: col * dLon, dLat, dLon, n: 0 }; map.set(key, c); }
      if (++c.n > max) max = c.n;
    }
    return { km, windowMs, nowMs, dLat, map, cells: [...map.values()], max };
  }
  function densityAt(D, lat, lon) {
    const row = Math.floor(lat / D.dLat), dLon = D.km / (111.32 * Math.cos((row + 0.5) * D.dLat * Math.PI / 180));
    const c = D.map.get(row * 100000 + Math.floor(lon / dLon));
    return c ? c.n : 0;
  }

  /* ── one storm's flash rate ──
     Flashes per minute within `radiusKm` of a storm cell, in `binMs` steps
     ending at `endMs`, oldest first. The cell's position is carried back
     along its own motion to each flash's time, so a storm moving at 40 kt is
     not counted as dying because it left the circle it was in 15 minutes ago. */
  function rates(list, cell, { radiusKm = 15, binMs = 120e3, bins = 7, endMs = Date.now() } = {}) {
    const out = new Array(bins).fill(0), start = endMs - bins * binMs;
    const to = cell.kt > 2 && cell.from != null ? ((cell.from + 180) % 360) * Math.PI / 180 : null;
    const kmPerMs = to != null ? cell.kt * 1.852 / 3600e3 : 0, cosLat = Math.cos(cell.lat * Math.PI / 180);
    for (const f of list) {
      if (f.t < start || f.t >= endMs) continue;
      const back = to != null ? kmPerMs * (f.t - cell.time) : 0;           // + forward, − back in time
      const clat = cell.lat + back * Math.cos(to || 0) / 110.574, clon = cell.lon + back * Math.sin(to || 0) / (111.32 * cosLat);
      const dy = (f.lat - clat) * 110.574, dx = (f.lon - clon) * 111.32 * cosLat;
      if (dx * dx + dy * dy <= radiusKm * radiusKm) out[Math.floor((f.t - start) / binMs)]++;
    }
    return out.map((n) => n / (binMs / 60e3));
  }

  /* ── the lightning jump ──
     Schultz, Petersen and Carey's "2σ" algorithm (2009, Weather and
     Forecasting 24): the change in flash rate from one 2-minute step to the
     next (DFRDT, flashes per minute per minute) against the spread of the
     five changes before it. A change more than twice that spread, while the
     storm is flashing at least 10 times a minute, is a jump — in their
     storms it came before most severe hail, wind and tornadoes, by about 20
     minutes. It is a research indicator, never a warning. `rateList` is
     flashes per minute, oldest first, at least seven steps. */
  function jump(rateList, { binMin = 2, minRate = 10 } = {}) {
    if (rateList.length < 7) return null;
    const d = [];
    for (let i = 1; i < rateList.length; i++) d.push((rateList[i] - rateList[i - 1]) / binMin);
    const now = d[d.length - 1], prev = d.slice(-6, -1), mean = prev.reduce((s, x) => s + x, 0) / prev.length;
    const sigma = Math.sqrt(prev.reduce((s, x) => s + (x - mean) ** 2, 0) / (prev.length - 1));
    const rate = rateList[rateList.length - 1];
    return { rate, dfrdt: now, sigma, level: sigma > 0 ? now / sigma : null, jump: rate >= minRate && now > 0 && now > 2 * sigma };
  }

  const api = { SATS, SPLIT_LON, open, variable, attrsOf, flashes, fromBytes, fromUrl, fileStart, hourPrefix, files, density, densityAt, rates, jump };
  root.Glm = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
