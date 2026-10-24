/* REANALYSIS — ERA5, the weather of any hour since 1940, on Weather Pro's map
   ────────────────────────────────────────────────────────────────────────────
   Built 2026-10-24 (the last of an outside review's specialist items Ric
   passed on: "3D radar, a reanalysis archive, custom colour maps and a
   satellite recipe builder"). ERA5 is ECMWF's reanalysis: the atmosphere
   of every hour from 1940 to a few months ago, rebuilt with one model and
   every observation there was. NSF NCAR keeps a copy on AWS's open data
   (s3://nsf-ncar-era5, NCAR's dataset ds633.0, DOI 10.5065/BH6N-5N20;
   ERA5 is Copernicus's, CC BY 4.0 — the map's corner credits both while it
   shows), as netCDF-4 that glm.js's HDF5 reader opens with range requests.

   How the files are cut, measured 2026-10-24:
     an.sfc    one file per field per month, every hour; chunks of
               27 hours × 139 × 277 points (about 1.1 MB each), so the map's
               window over the lower 48 is 6.5 MB, and the next 26 hours
               of it are already here
     an.pl     one file per field per DAY, chunks of 1 hour × all 37 levels ×
               the whole globe — 43 MB compressed, 154 MB unpacked, for one
               level of one hour. Too heavy to loop: those fields are drawn
               every 6 hours, and never cached
     accumu    precipitation, as short forecasts from 06 and 18Z: two files a
               month (inits from the 1st and from the 16th), chunks of one
               forecast × 12 hours × the globe (8.5 MB); each step holds the
               hour's own total, ending at it

   locate(name, ms, level) where one field's hour is: { url, slice0 }
   windowOf(view)          the rows and columns of the 0.25° grid under a
                           map view, padded, and the whole width when the
                           view crosses 0° longitude
   grid(origin, dims)      the window as a lat/lon grid the map can paint
   read(name, ms, opts)    one field at one hour: { grid, values, valid }
   budget(bytes)           a chunk cache that lets the oldest go past a size

   No place is kept or sent: the window is the map's own view, rounded to
   the grid, and it goes no further than the requests to the bucket. */
(function (root) {
  'use strict';
  const GL = root.Glm || (typeof require === 'function' ? require('./glm.js') : null);
  const BUCKET = 'https://nsf-ncar-era5.s3.amazonaws.com';
  const FIRST = Date.UTC(1940, 0, 1);
  const H = 3600e3, DEG = 0.25, NLAT = 721, NLON = 1440;
  /* the 37 pressure levels, top down, as the files hold them */
  const LEVELS = [1, 2, 3, 5, 7, 10, 20, 30, 50, 70, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 775, 800, 825, 850, 875, 900, 925, 950, 975, 1000];
  /* each field: which stream, ECMWF's table and parameter code, and its name in the file */
  const VARS = {
    '2t': ['an.sfc', '128_167_2t', 'VAR_2T'], '2d': ['an.sfc', '128_168_2d', 'VAR_2D'], msl: ['an.sfc', '128_151_msl', 'MSL'],
    '10u': ['an.sfc', '128_165_10u', 'VAR_10U'], '10v': ['an.sfc', '128_166_10v', 'VAR_10V'], cape: ['an.sfc', '128_059_cape', 'CAPE'],
    tcwv: ['an.sfc', '128_137_tcwv', 'TCWV'], tcc: ['an.sfc', '128_164_tcc', 'TCC'], sd: ['an.sfc', '128_141_sd', 'SD'], sst: ['an.sfc', '128_034_sstk', 'SSTK'],
    z: ['an.pl', '128_129_z', 'Z'], t: ['an.pl', '128_130_t', 'T'],
    lsp: ['fc.sfc.accumu', '128_142_lsp', 'LSP'], cp: ['fc.sfc.accumu', '128_143_cp', 'CP']
  };
  const p2 = (n) => String(n).padStart(2, '0');
  const ym = (d) => `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}`;
  const stamp = (ms) => { const d = new Date(ms); return `${ym(d)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}`; };

  function locate(name, ms, level) {
    const V = VARS[name];
    if (!V) throw new Error('era5: no field ' + name);
    if (!(ms >= FIRST)) throw new Error('era5: ERA5 starts in 1940');
    if (ms % H) throw new Error('era5: ERA5 is hourly — ask on the hour');
    const [kind, code] = V, d = new Date(ms), Y = d.getUTCFullYear(), M = d.getUTCMonth();
    const base = `${BUCKET}/e5.oper.${kind}/${ym(d)}/e5.oper.${kind}.${code}.ll025sc.`;
    if (kind === 'an.sfc') {
      const start = Date.UTC(Y, M, 1), last = Date.UTC(Y, M + 1, 0, 23);
      return { url: `${base}${stamp(start)}_${stamp(last)}.nc`, slice0: (ms - start) / H, kind };
    }
    if (kind === 'an.pl') {
      const k = LEVELS.indexOf(level);
      if (k < 0) throw new Error('era5: no ' + level + ' mb level');
      const day = Date.UTC(Y, M, d.getUTCDate());
      return { url: `${base}${stamp(day)}_${stamp(day + 23 * H)}.nc`, slice0: [(ms - day) / H, k], kind };
    }
    /* precipitation: the forecast from the latest 06 or 18Z strictly before the hour, at its step */
    let init = Math.floor((ms - 6 * H) / (12 * H)) * 12 * H + 6 * H;
    if (init >= ms) init -= 12 * H;
    const step = (ms - init) / H, di = new Date(init), iY = di.getUTCFullYear(), iM = di.getUTCMonth(), half = di.getUTCDate() >= 16;
    const fileStart = Date.UTC(iY, iM, half ? 16 : 1, 6), fileEnd = half ? Date.UTC(iY, iM + 1, 1, 6) : Date.UTC(iY, iM, 16, 6);
    const pbase = `${BUCKET}/e5.oper.${kind}/${ym(di)}/e5.oper.${kind}.${code}.ll025sc.`;
    return { url: `${pbase}${stamp(fileStart)}_${stamp(fileEnd)}.nc`, slice0: [(init - fileStart) / (12 * H), step - 1], kind, init, step };
  }

  /* the grid's rows run north to south from 90°, its columns east from 0° */
  function windowOf(view, pad = 0.25) {
    if (!view) return null;
    const dLat = (view.n - view.s) * pad, dLon = (view.e - view.w) * pad;
    const n = Math.min(90, view.n + dLat), s = Math.max(-90, view.s - dLat);
    const r0 = Math.max(0, Math.floor((90 - n) / DEG)), r1 = Math.min(NLAT, Math.ceil((90 - s) / DEG) + 1);
    const w = view.w - dLon, e = view.e + dLon;
    if (e - w >= 360) return [r0, r1, 0, NLON];
    const c0 = Math.floor((((w % 360) + 360) % 360) / DEG), c1 = Math.ceil((((e % 360) + 360) % 360) / DEG) + 1;
    /* across 0°: the columns would wrap, so the whole width is read */
    if (c1 <= c0) return [r0, r1, 0, NLON];
    return [r0, r1, c0, Math.min(NLON, c1)];
  }
  function grid(origin, dims) {
    const [o0, o1] = origin || [0, 0], [ny, nx] = dims;
    return { kind: 'latlon', nx, ny, npts: nx * ny, la1: 90 - o0 * DEG, lo1: o1 * DEG, di: DEG, dj: DEG, scan: 0 };
  }

  /* a Map-like chunk cache with a budget: the oldest unpacked chunks go
     first. Holds glm.js's promises; each is counted once it has arrived. */
  function budget(maxBytes) {
    const m = new Map(), size = new Map();
    let used = 0;
    const trim = () => { for (const k of m.keys()) { if (used <= maxBytes || m.size <= 1) break; used -= size.get(k) || 0; size.delete(k); m.delete(k); } };
    const c = {
      has: (k) => m.has(k),
      get: (k) => { const v = m.get(k); if (v) { m.delete(k); m.set(k, v); } return v; },
      set: (k, p) => { m.set(k, p); p.then((b) => { if (m.get(k) === p) { size.set(k, b.byteLength); used += b.byteLength; trim(); } }, () => {}); return c; },
      delete: (k) => { used -= size.get(k) || 0; size.delete(k); return m.delete(k); },
      get bytes() { return used; }, get size() { return m.size; }
    };
    return c;
  }
  /* the surface and precipitation chunks are a few MB each and hold many
     hours, so they are kept, to about 200 MB; a pressure-level chunk is
     154 MB for one hour and is let go at once */
  const CHUNKS = budget(200e6);
  const files = new Map();
  function open(url, opts) {
    if (!files.has(url)) {
      files.set(url, GL.open(GL.fromUrl(url, opts)).catch((e) => { files.delete(url); throw e; }));
      if (files.size > 40) files.delete(files.keys().next().value);
    }
    return files.get(url);
  }
  const attrsOf = new Map();
  async function read(name, ms, { level, win, signal, fetchFn = fetch } = {}) {
    const L = locate(name, ms, level), f = await open(L.url, { signal, fetchFn }), v = VARS[name][2];
    const known = attrsOf.get(L.url + v);
    const r = await GL.variable(f, v, known, { slice0: L.slice0, win, cache: L.kind === 'an.pl' ? null : CHUNKS });
    attrsOf.set(L.url + v, r.attrs);
    const values = r.values instanceof Float32Array ? r.values : Float32Array.from(r.values);
    return { grid: grid(r.origin, r.dims), values, valid: ms, units: r.attrs.units };
  }

  /* the newest month in a stream, from the bucket's own listing; ERA5 runs
     two to three months behind (July 2026 was the newest on 2026-10-24) */
  async function latestMonth(kind = 'an.sfc', { fetchFn = fetch, signal, nowMs = Date.now() } = {}) {
    const y = new Date(nowMs).getUTCFullYear() - 1;
    const r = await fetchFn(`${BUCKET}/?list-type=2&delimiter=/&prefix=e5.oper.${kind}/&start-after=e5.oper.${kind}/${y}`, { signal });
    if (!r.ok) throw new Error('era5: listing HTTP ' + r.status);
    const xml = await r.text(), m = [...xml.matchAll(/<Prefix>e5\.oper\.[^/]+\/(\d{4})(\d\d)\/<\/Prefix>/g)];
    if (!m.length) throw new Error('era5: no months listed');
    const [, Y, M] = m[m.length - 1];
    return Date.UTC(+Y, +M - 1, 1);
  }
  /* the last hour of the month that starts at ms */
  const monthEnd = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23); };

  const api = { BUCKET, FIRST, LEVELS, VARS, locate, windowOf, grid, budget, read, latestMonth, monthEnd, CHUNKS };
  root.Era5 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
