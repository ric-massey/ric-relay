/* Weather Pro's decoders — node projects/weather/test/decoders.test.mjs
   The radar, lightning and model maps are read from NOAA's raw files in the
   browser (bzip2.js, nexrad.js, glm.js, grib2.js). Each is held here to the
   library the field trusts, on real files in fixtures/: MetPy for NEXRAD
   Level III, ecCodes for GRIB2, h5py for the GLM's and the ABI's HDF5,
   pyproj for the ABI's fixed grid. fixtures/
   make-expected.py wrote expected.json from those libraries; this file reads
   the same files with ours and must agree. No network. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const require = createRequire(import.meta.url);
const Bz = require('../bzip2.js');
const N = require('../nexrad.js');
const G = require('../grib2.js');
const L = require('../glm.js');
const L2 = require('../level2.js');
const MM = require('../modelmaps.js');
const MR = require('../mrms.js');
const AB = require('../abi.js');

const here = dirname(fileURLToPath(import.meta.url));
const fx = (name) => new Uint8Array(readFileSync(join(here, 'fixtures', name)));
const expected = JSON.parse(readFileSync(join(here, 'fixtures', 'expected.json'), 'utf8'));

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const close = (a, b, rel = 1e-4) => (b === null ? !Number.isFinite(a) : Math.abs(a - b) <= rel * Math.max(1, Math.abs(b)));

console.log('\nRULE  bzip2 undoes what bzip2 did');
{
  /* python's bz2 when it is there; otherwise the radar files below are the test */
  let py = null;
  try { execFileSync('python3', ['-c', 'import bz2'], { stdio: 'ignore' }); py = true; } catch { py = false; }
  if (py) {
    for (const [name, data] of [['text', Buffer.from('the quick brown fox '.repeat(4000))], ['random', randomBytes(300000)], ['runs', Buffer.alloc(200000, 7)], ['one byte', Buffer.from('x')]]) {
      const packed = execFileSync('python3', ['-c', 'import bz2,sys;sys.stdout.buffer.write(bz2.compress(sys.stdin.buffer.read(),9))'], { input: data, maxBuffer: 1e8 });
      const back = Bz.bunzip2(new Uint8Array(packed));
      ok(Buffer.compare(Buffer.from(back), data) === 0, `${name}: ${data.length} bytes round-trip through python's bz2`);
    }
  } else console.log('  skip  python3 not here — the dual-pol radar files below exercise it');
  let threw = false;
  try { const bad = new Uint8Array(execFileSync('python3', ['-c', 'import bz2,sys;sys.stdout.buffer.write(bz2.compress(b"hello world"*100))'])); bad[bad.length - 8] ^= 0xff; Bz.bunzip2(bad); } catch { threw = true; }
  ok(threw || !py, 'a damaged stream is an error, not a picture');
}

console.log('\nRULE  NEXRAD Level III reads as MetPy reads it');
for (const [file, e] of Object.entries(expected.l3)) {
  const f = N.parse(fx(file));
  let bad = 0, finite = 0, sum = 0;
  for (let i = 0; i < f.nRad * f.nBins; i++) { const v = f.lut[f.data[i]]; if (Number.isFinite(v)) { finite++; sum += v; } }
  /* MetPy keeps a radial's pad byte (an odd gate count is padded to whole
     halfwords); it is not a gate, and holds nothing */
  for (const [r, b, v] of e.samples) if (b >= f.nBins ? v !== null : !close(f.lut[f.data[r * f.nBins + b]], v)) bad++;
  ok(f.code === e.code && f.site === e.site && close(f.lat, e.lat) && close(f.lon, e.lon) && Math.abs(f.elev - e.el) < 0.05,
    `${file.slice(7, 10)}: product ${f.code}, ${f.site} at ${f.lat}, ${f.lon}, elevation ${f.elev.toFixed(1)}°`);
  ok(new Date(f.volTime).toISOString().slice(0, 19) === e.vol.slice(0, 19), `${file.slice(7, 10)}: volume time ${new Date(f.volTime).toISOString()}`);
  ok(f.nRad === e.nRad && (f.nBins === e.nBins || (f.nBins % 2 === 1 && f.nBins + 1 === e.nBins)) && e.az0.every((a, i) => Math.abs(a - f.az0[i]) < 0.05), `${file.slice(7, 10)}: ${f.nRad} radials × ${f.nBins} gates, same azimuths`);
  ok(finite === e.finite && close(sum, e.sum, 1e-6), `${file.slice(7, 10)}: ${finite} gates with data, values sum to ${sum.toFixed(2)} (MetPy ${e.sum.toFixed(2)})`);
  ok(bad === 0, `${file.slice(7, 10)}: ${e.samples.length} sampled gates match${bad ? ` — ${bad} do not` : ''}`);
}
{
  const f = N.parse(fx('l3-TLX_N0C_2026_10_22_19_08_56'));
  ok(N.gate(f, 0.1, f.az0[0] + 0.1) === f.data[0], 'the gate lookup finds the first radial at its own azimuth');
  ok(N.gate(f, 400, 10) === 0, 'beyond the last gate is no data');
  ok(Math.abs(N.beamHeightKm(100, 0.5) - 1.46) < 0.02, `the 0.5° beam is ${N.beamHeightKm(100, 0.5).toFixed(2)} km up at 100 km (4/3 earth: ~1.46)`);
  const ct = N.colorTable(f, 'cc');
  ok(ct[0] === 0 && ct.some((c) => c !== 0), 'a colour table leaves "no data" clear and colours the rest');
  ok(N.keyTime('TLX_N0C_2026_10_22_19_08_56') === Date.UTC(2026, 9, 22, 19, 8, 56), 'a bucket key carries its scan time');
  ok(N.hourPrefix('TLX', 'N0C', Date.UTC(2026, 9, 22, 3, 59)) === 'TLX_N0C_2026_10_22_03', 'the hour prefix lists one hour of one product');
  ok(N.parseListing('<a><Key>TLX_N0C_1</Key><Key>TLX_N0C_2</Key></a>').length === 2, 'a bucket listing is read for its keys');
}

console.log('\nRULE  GRIB2 reads as ecCodes reads it — values and where each one is');
for (const [file, e] of Object.entries(expected.grib2)) {
  const m = G.parse(fx(file)), g = G.projector(m.grid);
  let finite = 0, min = Infinity, max = -Infinity, sum = 0, bad = 0, badPos = 0;
  for (const v of m.values) if (Number.isFinite(v)) { finite++; sum += v; if (v < min) min = v; if (v > max) max = v; }
  for (const [i, v, la, lo] of e.samples) {
    if (!close(m.values[i], v, 1e-5)) bad++;
    const [fi, fj] = g.ij(la, lo), [lla, llo] = g.ll(i % m.grid.nx, Math.floor(i / m.grid.nx));
    if (Math.hypot(fi - i % m.grid.nx, fj - Math.floor(i / m.grid.nx)) > 0.01 || Math.abs(lla - la) > 1e-3 || Math.abs(((llo - lo + 540) % 360) - 180) > 1e-3) badPos++;
  }
  const ref = new Date(m.refTime).toISOString().replace(/\D/g, '').slice(0, 12);
  ok(m.grid.npts === e.npts && m.grid.nx === e.nx && ref === e.refTime && m.step === e.step,
    `${file}: ${m.grid.kind} ${m.grid.nx}×${m.grid.ny}, run ${ref}, +${m.step} h, data template 5.${m.pack.tmpl}`);
  ok(finite === e.finite && close(min, e.min, 1e-5) && close(max, e.max, 1e-5) && close(sum / finite, e.mean, 1e-6),
    `${file}: ${finite} values from ${min.toFixed(3)} to ${max.toFixed(3)}, mean ${(sum / finite).toFixed(4)}`);
  ok(bad === 0, `${file}: ${e.samples.length} sampled values match${bad ? ` — ${bad} do not` : ''}`);
  ok(badPos === 0, `${file}: every sampled point is where ecCodes puts it, both ways${badPos ? ` — ${badPos} are not` : ''}`);
}
{
  const m = G.parse(fx('gfs1-h500.grb2'));
  const [i, j] = [37, 50], v = m.values[j * m.grid.nx + i], [la, lo] = G.projector(m.grid).ll(i, j);
  ok(close(G.sample(m, la, lo), v, 1e-6), 'sampling at a grid point gives that point');
  const idx = G.parseIdx('1:0:d=2026102212:REFC:entire atmosphere:1 hour fcst:\n2:285249:d=2026102212:RETOP:cloud top:1 hour fcst:\n');
  ok(idx[0].end === 285248 && idx[1].end === null && G.find(idx, /^RETOP:/) === idx[1], 'an .idx line says where its message starts and the next ends it');
}

console.log('\nRULE  GLM flashes read as h5py reads them');
for (const [file, e] of Object.entries(expected.glm)) {
  const f = await L.open(L.fromBytes(fx(file)));
  for (const [name, ref] of Object.entries(e.vars)) {
    const v = await L.variable(f, name);
    let bad = 0;
    ref.forEach((x, i) => { if (!close(v.values[i], x, 1e-6)) bad++; });
    ok(v.values.length === ref.length && bad === 0, `${name}: ${ref.length} values${bad ? ` — ${bad} differ` : ' match'}`);
  }
  const key = file.replace(/^glm-/, '');
  const memo = {}, fl = await L.flashes(L.fromBytes(fx(file)), key, memo), again = await L.flashes(L.fromBytes(fx(file)), key, memo);
  ok(fl.length === e.count && fl.every((x) => x.lat >= -90 && x.lat <= 90 && x.lon >= -180 && x.lon <= 180), `${fl.length} flashes, every one on the globe`);
  const start = L.fileStart(key);
  ok(start === Date.UTC(2026, 9, 22, 19, 11, 40) && fl.every((x) => Math.abs(x.t - start) < 30e3), 'each flash is within its file’s 20 seconds of the time in the name');
  ok(again.length === fl.length && again.every((x, i) => x.t === fl[i].t && x.energy === fl[i].energy), 'a second file read with the first one’s attributes gives the same flashes');
  const D = L.density(fl, { nowMs: start + 20e3, windowMs: 60e3 });
  ok(D.cells.reduce((s, c) => s + c.n, 0) === fl.length && fl.every((x) => L.densityAt(D, x.lat, x.lon) > 0), `density: the file's ${fl.length} flashes land in ${D.cells.length} squares, every one counted once`);
}

console.log('\nRULE  flash density, flash rate and the lightning jump');
{
  const T = Date.UTC(2026, 9, 22, 20);
  /* 8 km squares are 8 km both ways at any latitude */
  for (const lat of [26, 48]) {
    const D = L.density([{ lat, lon: -97, t: T }], { nowMs: T });
    const c = D.cells[0], ew = c.dLon * 111.32 * Math.cos((c.lat0 + c.dLat / 2) * Math.PI / 180);
    ok(Math.abs(c.dLat * 110.574 - 8) < 1e-9 && Math.abs(ew - 8) < 1e-9, `a square at ${lat}° N is 8 km by 8 km`);
  }
  const D = L.density([{ lat: 35, lon: -97, t: T - 6 * 60e3 }, { lat: 35, lon: -97, t: T - 60e3 }, { lat: 35.001, lon: -97.001, t: T - 30e3 }], { nowMs: T });
  ok(D.max === 2 && D.cells.length === 1, 'the window keeps the last five minutes and drops the flash six minutes ago');
  /* a cell moving east at 60 kt: flashes that stayed with it are counted
     at every step, however far it has moved from where it was scanned */
  const cell = { lat: 35, lon: -97, kt: 60, from: 270, time: T };
  const fl = [];
  for (let m = 0; m < 14; m++) {
    const km = 60 * 1.852 * (m - 14) / 60, lon = -97 + km / (111.32 * Math.cos(35 * Math.PI / 180));
    for (let k = 0; k < 10; k++) fl.push({ lat: 35, lon, t: T - (14 - m) * 60e3 + k * 1000 });
  }
  const r = L.rates(fl, cell, { endMs: T });
  ok(r.length === 7 && r.every((x) => x === 10), `following the storm along its track, 10 flashes a minute at every step (${r.join(', ')})`);
  ok(L.rates(fl, { ...cell, kt: 0 }, { endMs: T })[0] === 0, 'standing still instead, the storm seems to have no flashes 14 minutes ago — it was 26 km away');
  const steady = L.jump([10, 11, 10, 11, 10, 11, 10]), up = L.jump([10, 11, 10, 11, 10, 11, 24]), weak = L.jump([1, 2, 1, 2, 1, 2, 8]);
  ok(steady && !steady.jump && up && up.jump && up.level > 2, `a rise from 11 to 24 a minute is a jump (${up.level.toFixed(1)}σ); wobbling between 10 and 11 is not`);
  ok(weak && !weak.jump && weak.dfrdt > 2 * weak.sigma, 'a storm under 10 flashes a minute never jumps, however steep its rise (Schultz et al. 2009)');
  ok(L.jump([10, 12, 14]) === null, 'fewer than seven steps (14 minutes) is not enough to say');
}
ok(L.hourPrefix(Date.UTC(2026, 0, 1, 5)) === 'GLM-L2-LCFA/2026/001/05/' && L.hourPrefix(Date.UTC(2026, 11, 31, 23)) === 'GLM-L2-LCFA/2026/365/23/', 'the bucket is by day of the year and hour');

console.log('\nRULE  GOES ABI imagery reads as h5py reads it, and sits where pyproj puts it');
for (const [file, e] of Object.entries(expected.abi)) {
  const f = await L.open(L.fromBytes(fx(file)));
  const v = await L.variable(f, 'CMI'), r = await L.variable(f, 'CMI', null, { raw16: true });
  let bad = 0, badRaw = 0, finite = 0;
  for (const [i, j, x] of e.samples) {
    const k = i * e.shape[1] + j;
    if (!close(v.values[k], x, 1e-5)) bad++;
    const y = r.raw[k] === r.fill ? NaN : r.raw[k] * r.scale + r.offset;
    if (!close(y, x, 1e-5)) badRaw++;
  }
  for (const x of v.values) if (Number.isFinite(x)) finite++;
  ok(v.dims.join('×') === e.shape.join('×') && finite === e.finite && bad === 0, `${e.shape.join('×')} band in row-band chunks put back together: ${finite} pixels, ${e.samples.length} sampled match${bad ? ` — ${bad} do not` : ''}`);
  ok(badRaw === 0, 'kept as 16-bit counts with their scale, the same values');
  const xs = await L.variable(f, 'x'), ys = await L.variable(f, 'y'), P = await L.attrsOf(f, 'goes_imager_projection');
  ok(close(xs.values[0], e.x[0], 1e-6) && close(ys.values[ys.values.length - 1], e.y[1], 1e-6) && P.longitude_of_projection_origin === e.proj.longitude_of_projection_origin, 'the scan-angle axes and the projection\'s attributes');
  const g = AB.projector(P, xs.values, ys.values);
  let worst = 0, back = 0;
  for (const [j, i, lat, lon] of e.nav) {
    const [la, lo] = g.ll(i, j); worst = Math.max(worst, Math.abs(la - lat), Math.abs(lo - lon));
    const [fi, fj] = g.ij(lat, lon); back = Math.max(back, Math.abs(fi - i), Math.abs(fj - j));
  }
  ok(worst < 1e-5 && back < 1e-3, `${e.nav.length} pixels navigated to within ${worst.toExponential(1)}° of pyproj, and back to within ${back.toExponential(1)} of a pixel`);
}
{
  /* the GOES-R Product User's Guide's own worked example (vol. 5, §4.2.8.1) */
  const g = AB.projector({ semi_major_axis: 6378137, semi_minor_axis: 6356752.31414, perspective_point_height: 35786023, longitude_of_projection_origin: -75 }, [-0.024052, -0.024042], [0.095340, 0.095330]);
  const [la, lo] = g.ll(0, 0);
  ok(Math.abs(la - 33.846162) < 1e-5 && Math.abs(lo + 84.690932) < 1e-5, `the PUG's example, x −0.024052, y 0.095340 rad: ${la.toFixed(6)}° N, ${lo.toFixed(6)}° E`);
  ok(Number.isNaN(g.ij(0, 110)[0]), 'a place on the far side of the earth is not on the image');
  ok(AB.ch(-26.2, -26.2, 0.6) === 0 && AB.ch(0.6, -26.2, 0.6) === 255 && Math.round(AB.ch(0.25, 0, 1, 2)) === 128, 'an RGB channel: the range stretched to 0–255, then the gamma');
  ok(Object.values(AB.PRODUCTS).every((P) => P.bands.every((b) => AB.BANDS[b])) && Object.keys(AB.PRODUCTS).every((id) => AB.key(id)), 'every product names real bands and has a colour key');
  ok(AB.hourPrefix('MCMIPC', Date.UTC(2026, 9, 22, 20, 5)) === 'ABI-L2-MCMIPC/2026/295/20/', 'the bucket is by product, day of the year and hour');
}

console.log('\nRULE  the Level II archive: both layouts read alike, and the download stops early');
{
  const { gzipSync } = await import('node:zlib');
  const parts = expected.l2.files.map(fx), whole = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let at = 0; for (const b of parts) { whole.set(b, at); at += b.length; }
  /* the same volume as an old archive file: one gzip around the header and the plain messages */
  const { header, records } = L2.records(whole);
  const plain = [whole.subarray(0, 24), ...records.map((r) => Bz.bunzip2(r))];
  const raw = new Uint8Array(plain.reduce((n, b) => n + b.length, 0));
  at = 0; for (const b of plain) { raw.set(b, at); at += b.length; }
  const gz = gzipSync(raw);
  let served = 0;
  const serve = (bytes) => async () => new Response(new ReadableStream({
    start() { this.i = 0; },
    pull(c) { if (this.i >= bytes.length) return c.close(); const n = Math.min(4096, bytes.length - this.i); served += n; c.enqueue(bytes.slice(this.i, this.i + n)); this.i += n; }
  }), { status: 200 });
  const ref = L2.feed(whole), mom = 'REF', want = L2.angles(ref, mom)[0];
  /* stopped by the radar's own end-of-elevation flag, not a radial count */
  const done = (st) => L2.swept(st, mom, want.angle);
  const a = await L2.stream('x', { fetchFn: serve(whole), until: done });
  const b = await L2.stream('x.gz', { fetchFn: serve(gz), until: done });
  const sa = L2.sweep(a, want.elevNum, mom), sb = L2.sweep(b, want.elevNum, mom), sr = L2.sweep(ref, want.elevNum, mom);
  const same = (x, y) => x && y && x.nRad === y.nRad && x.nBins === y.nBins && x.data.every((v, i) => v === y.data[i]);
  ok(header && header.site.trim() === expected.l2.site && same(sa, sr) && same(sb, sr), `bzip2 records and a gzip of plain messages give the volume's ${want.angle}° sweep byte for byte (${sr && sr.nRad} radials)`);
  served = 0;
  await L2.stream('x', { fetchFn: serve(whole), until: (st) => Object.keys(st.sweeps).length > 0 });
  ok(served < whole.length / 2, `asked to stop at the first radial, it read ${served.toLocaleString()} of ${whole.length.toLocaleString()} bytes`);
  const keys = ['2013/05/20/KTLX/KTLX20130520_200356_V06.gz', '2013/05/20/KTLX/KTLX20130520_200356_V06_MDM', '2024/05/06/KTLX/KTLX20240506_230154_V06'];
  const list = await L2.archive('KTLX', Date.UTC(2013, 4, 20, 20), Date.UTC(2013, 4, 20, 21), { fetchFn: async () => new Response(keys.map((k) => `<Key>${k}</Key>`).join(''), { status: 200 }) });
  ok(list.length === 1 && list[0].gz && list[0].t === Date.UTC(2013, 4, 20, 20, 3, 56), 'the archive\'s volumes by their time, the _MDM metadata files left out');
}

console.log('\nRULE  the RAP\'s rotated grid reads as ecCodes reads it, and sits where the RAP\'s own Lambert grid puts it');
for (const [file, e] of Object.entries(expected.rap)) {
  const m = G.parse(fx(file)), g = G.projector(m.grid);
  let bad = 0;
  for (const [i, v] of e.samples) if (!(Math.abs(m.values[i] - v) < 1e-3)) bad++;
  ok(m.grid.kind === 'rotll' && m.values.length === e.npts && bad === 0, `${m.grid.nx}×${m.grid.ny} rotated grid, ${e.samples.length} sampled values match${bad ? ` — ${bad} do not` : ''}`);
  const [la0, lo0] = g.ll(0, 0), [la1, lo1] = g.ll(m.grid.nx - 1, m.grid.ny - 1);
  ok(Math.abs(la0 - m.grid.la1) < 1e-6 && Math.abs(((lo0 - m.grid.lo1 + 540) % 360) - 180) < 1e-6 && Math.abs(la1 - m.grid.la2) < 1e-6 && Math.abs(((lo1 - m.grid.lo2 + 540) % 360) - 180) < 1e-6, 'the first and last points land where the file says');
  /* the same field, same run, on the Lambert grid ecCodes can place: sampled at
     those places from the rotated grid, the two agree to a fraction of a degree */
  const d = e.lambert.map(([lat, lon, v]) => Math.abs(G.sample(m, lat, lon) - v)).filter(Number.isFinite).sort((a, b) => a - b);
  ok(d.length > 250 && d[Math.floor(d.length / 2)] < 0.1 && d[Math.floor(d.length * 0.95)] < 0.5, `${d.length} places on the RAP's Lambert grid: median difference ${d[Math.floor(d.length / 2)].toFixed(3)} K, 95th ${d[Math.floor(d.length * 0.95)].toFixed(3)} K`);
}

console.log('\nRULE  the server\'s mesoanalysis file reads back, and each column is sounding.js\'s own arithmetic');
{
  const MG = require('../mesogrid.js');
  const { columnFields } = await import('../meso/build.mjs');
  const n = 6, arrays = {};
  for (const id of [...MG.FIELDS.map((f) => f.id), ...MG.EXTRA.map(([id]) => id)]) arrays[id] = Float32Array.from({ length: n }, (_, i) => (i === 3 ? NaN : 100 * Math.sin(i + id.length)));
  const head = { grid: { kind: 'latlon', la1: 50, lo1: -100, di: 1, dj: 1, nx: 3, ny: 2 }, valid: Date.UTC(2026, 9, 22, 22), made: 1, inputs: { rtma: true } };
  const back = MG.decode(MG.encode(arrays, head));
  let worst = 0, nans = true;
  for (const f of MG.FIELDS) for (let i = 0; i < n; i++) {
    if (i === 3) { nans = nans && Number.isNaN(back.arrays[f.id][i]); continue; }
    worst = Math.max(worst, Math.abs(back.arrays[f.id][i] - arrays[f.id][i]) / back.head.scale[f.id][1]);
  }
  ok(back.head.valid === head.valid && worst <= 0.5 + 1e-6 && nans, `every field comes back within half its stored step, and "none" stays none (worst ${worst.toFixed(2)} steps)`);
  ok(back.head.scale.pwat[1] > 0.001 && back.head.scale.mucape[1] === 5, 'a field too wide for its usual step (±100 inches of rain) gets a coarser one instead of being clipped; one that fits keeps its own');
  /* a capped, juicy column: columnFields is analyze()'s numbers, not new ones */
  const L = [];
  let z = 300;
  for (let p = 1000; p >= 100; p -= 25) {
    const t = p >= 850 ? (32 + 273.15) * (p / 1000) ** 0.2857 - 273.15 : 18 - (850 - p) * 0.1, td = p >= 850 ? 22 - (1000 - p) * 0.02 : -5 - (850 - p) * 0.06;
    if (L.length) z += 287 * (t + 273.15) / 9.81 * Math.log(L[L.length - 1].p / p);
    L.push({ p, z, t, td: Math.min(t, td), wd: 240, ws: 5 + (z - 300) / 400 });
  }
  const S = require('../sounding.js'), A = S.analyze(L), c = columnFields(L);
  ok(c.mlcape === A.ml.cape && c.mucape === A.mu.cape && c.esrh === A.esrh && c.dcape === A.dcape && Math.abs(c.ebwd - A.ebwd * 1.943844) < 1e-9 && c.stpe === A.stpE,
    `MLCAPE ${c.mlcape}, MUCAPE ${c.mucape}, DCAPE ${Math.round(c.dcape)}, ESRH ${Math.round(c.esrh)}, effective shear ${c.ebwd.toFixed(1)} kt — all analyze()'s`);
  ok(c.ship >= 0 && c.dcp >= 0 && c.cape3 >= 0 && c.cape3 <= c.mlcape, 'the composites built on top are never negative, and 0–3 km CAPE is part of the whole');
}

console.log('\nRULE  ECMWF and the GEFS ensemble');
{
  const idx = MM.parseJsonIndex('{"param":"gh","levtype":"pl","levelist":"500","step":"24","_offset":100,"_length":50}\n{"param":"2t","levtype":"sfc","step":"24","_offset":150,"_length":10}\n');
  ok(idx[0].name === 'gh' && idx[0].level === '500 mb' && idx[0].start === 100 && idx[0].end === 149 && idx[1].level === 'sfc', 'ECMWF\'s JSON-lines index: each field\'s bytes, its pressure level as "500 mb"');
  ok(MM.FIELDS.ecmwf.every((f) => Object.values(f.parts).every((t) => typeof t === 'function')) && MM.FIELDS.aifs.length >= 10, 'every ECMWF and AIFS field names its parts');
  ok(MM.SOURCES.gefs.members.length === 31 && MM.SOURCES.gefs.members[0] === 'gec00' && MM.SOURCES.gefs.members[30] === 'gep30', 'the GEFS is its control and thirty perturbed runs');
  ok(MM.SOURCES.gefs.hours([0, 3, 6, 9, 12, 384]).join() === '6,12,384', 'GEFS frames every six hours, where each run\'s rain is a 6-hour total');
  const ev = (id, v) => MM.field('gefs', id).event(v);
  ok(ev('p_rain25', [6.35]) && !ev('p_rain25', [6.3]) && ev('p_frz', [273.15]) && !ev('p_frz', [273.2]) && ev('p_wind', [12.33, 12.33]) && !ev('p_wind', [12, 12]),
    'the events: ¼ inch is 6.35 mm, freezing is 273.15 K, 39 mph is 17.43 m/s whichever way the wind blows');
  /* the mirror: Google's copy fails, AWS's answers */
  const asked = [];
  const fake = async (url) => { asked.push(url); if (url.includes('googleapis')) throw new TypeError('Failed to fetch'); return new Response('ok', { status: 200 }); };
  const keys = await MM.listKeys('https://storage.googleapis.com/ecmwf-open-data', 'x/', { fetchFn: async (u, o) => { const r = await fake(u, o); return new Response('<Key>x/1h-oper-fc.index</Key>', { status: r.status }); } });
  ok(keys.length === 1 && asked[0].startsWith('https://storage.googleapis.com/ecmwf-open-data') && asked[1].startsWith('https://ecmwf-forecasts.s3.eu-central-1.amazonaws.com'), 'when ECMWF\'s Google copy fails, the same request goes to its AWS copy');
}

console.log('\nRULE  the mesoanalysis: every field in the analysis hour, and SPC\'s arithmetic');
{
  const idx = G.parseIdx(readFileSync(join(here, 'fixtures', 'hrrr-wrfsfcf00.grib2.idx'), 'utf8'));
  const missing = MM.FIELDS.meso.filter((f) => !MM.resolve(idx, f)).map((f) => f.id);
  ok(MM.SOURCES.meso.analysis && !missing.length, `all ${MM.FIELDS.meso.length} fields find their parts in a real HRRR analysis hour (.idx, 18Z 22 Oct 2026)${missing.length ? ' — not: ' + missing.join(', ') : ''}`);
  /* one column, every part a one-element array */
  const one = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [v]]));
  const F = (id) => MM.field('meso', id);
  /* a straight-line hodograph: u grows 5 m/s per km from calm at 10 m (the
     ground's wind, as SPC takes it); the
     standard levels at their usual heights over a ground at sea level */
  const Z = { 1000: 110, 850: 1460, 700: 3010, 500: 5570, 925: 110 + (1460 - 110) * Math.log(1000 / 925) / Math.log(1000 / 850), 250: 5570 + 4790 };
  const col = { zs: 0, ps: 101300, u10: 0, v10: 0, z1000: Z[1000], z850: Z[850], z700: Z[700], z500: Z[500], mu: 2500, sb: 2500, sbcin: -20, plpl: 101300, el: 12000 };
  for (const mb of [1000, 925, 850, 700, 500, 250]) { col['u' + mb] = Z[mb] * 0.005; col['v' + mb] = 0; }
  const eb = F('ebwd').value(one(col), 0) / 1.943844;
  ok(Math.abs(eb - 30) < 0.01, `effective bulk shear from the ground to half a 12 km EL, 5 m/s per km: ${eb.toFixed(2)} m/s (30)`);
  ok(F('ebwd').value(one({ ...col, mu: 50 }), 0) === 0, 'no CAPE, no effective layer, no effective shear (as SPC shows it)');
  const stp = F('stpe').value(one({ ...col, ml: 1500, mlcin: -10, lcl: 800, h: 150 }), 0);
  ok(Math.abs(stp - 1.5) < 1e-6, `effective STP: 1500 J/kg, LCL 800 m, 150 m²/s², 30 m/s → ${stp.toFixed(3)} (1 × 1 × 1 × 1.5)`);
  ok(F('stpe').value(one({ ...col, sb: 50, ml: 1500, mlcin: -10, lcl: 800, h: 150 }), 0) === 0, 'an elevated effective layer (the surface parcel has under 100 J/kg) gives no STP, as SPC has it');
  const scp = F('scpe').value(one({ ...col, h: 100, mucin: -80 }), 0);
  ok(Math.abs(scp - 2.5) < 1e-6, `SCP with SPC's CIN term: 2500 J/kg, 100 m²/s², 30 m/s, MUCIN −80 → ${scp.toFixed(3)} (2.5 × 2 × 1 × ½)`);
  /* SHIP by hand: MUCAPE 2000, mixing ratio held to 13.6 g/kg (a 22 °C dewpoint at 900 hPa is more), 700–500 lapse 7.5 °C/km, T500 −12 °C, 20 m/s */
  const sc = { mu: 2000, plpl: 90000, ps: 100000, d2: 295.15, d925: 295.15, d850: 295.15, d700: 270, t700: 273.15 + 7.2, t500: 273.15 - 12, z700: 3000, z500: 5560, u: 20, v: 0, frz: 4000, zs: 0 };
  const ship = F('ship').value(one(sc), 0), hand = 2000 * 13.6 * ((7.2 + 12) / 2.56) * 12 * 20 / 42e6;
  ok(Math.abs(ship - hand) < 1e-6, `SHIP ${ship.toFixed(3)} against the formula by hand ${hand.toFixed(3)} (mixing ratio capped at 13.6 g/kg)`);
  ok(Math.abs(F('ship').value(one({ ...sc, mu: 650 }), 0) - 650 * 13.6 * (19.2 / 2.56) * 12 * 20 / 42e6 * 0.5) < 1e-6 && Math.abs(F('ship').value(one({ ...sc, frz: 1200 }), 0) - hand / 2) < 1e-6,
    'SHIP\'s limits: under 1300 J/kg it is scaled by MUCAPE/1300; a freezing level under 2400 m scales it down too');
}

console.log('\nRULE  NEXRAD Level II reads as MetPy reads it — a volume\'s first chunk and one cut');
{
  const e = expected.l2;
  let st = null;
  for (const name of e.files) st = L2.feed(fx(name), st);
  ok(st.header && st.header.site === e.site && st.vcp && st.vcp.cuts.length > 10, `site ${st.header && st.header.site}, coverage pattern ${st.vcp && st.vcp.pattern} with ${st.vcp && st.vcp.cuts.length} cuts`);
  const plan = L2.plan(st.vcp);
  for (const [num, sw] of Object.entries(e.sweeps)) {
    const cut = plan.find((c) => c.elevNum === Number(num));
    ok(cut && e.files.filter((f) => /-I$|-E$/.test(f)).every((f) => { const n = Number(f.slice(-5, -2)); return n >= cut.first && n <= cut.last; }),
      `cut ${num} is where the coverage pattern puts it: chunks ${cut && cut.first}–${cut && cut.last}`);
    for (const [m, x] of Object.entries(sw.moments)) {
      const s = L2.sweep(st, Number(num), m);
      let bad = 0, finite = 0;
      for (let k = 0; k < s.nRad; k++) for (let g = 0; g < x.shape[1]; g++) if (g < s.nBins && Number.isFinite(s.lut[s.data[k * s.nBins + g]])) finite++;
      /* 16-bit moments come through 8 bits (level2.js RANGE16): within a step */
      const tol = m === 'PHI' ? 1.5 : m === 'ZDR' && s.lut[3] - s.lut[2] < 0.1 ? 0.05 : 1e-3;
      /* …and clamped to that range, which no palette goes past */
      const R16 = s.lut[3] - s.lut[2] < 0.1 || m === 'PHI' ? L2.RANGE16[m] : null;
      const want = (v) => (R16 ? Math.min(R16[1], Math.max(R16[0], v)) : v);
      for (const [k, g, v] of x.samples) { const got = g < s.nBins ? s.lut[s.data[k * s.nBins + g]] : NaN; if (v === null ? Number.isFinite(got) : !(Math.abs(got - want(v)) <= tol)) bad++; }
      ok(s.nRad === x.shape[0] && Math.abs(s.firstKm - x.first) < 1e-6 && Math.abs(s.gateKm - x.spacing) < 1e-6 && Math.abs(s.elev - sw.el) < 0.01,
        `cut ${num} ${m}: ${s.nRad} radials, first gate ${s.firstKm} km, every ${s.gateKm} km, ${s.elev.toFixed(2)}°`);
      ok(finite === x.finite && bad === 0, `cut ${num} ${m}: ${finite} gates with data, ${x.samples.length} sampled gates match${bad ? ` — ${bad} do not` : ''}`);
    }
  }
  ok(L2.anglesOf(plan, 'VEL').length >= 10 && L2.cutFor(plan, 'REF', 0.5).waveform === 1, 'every angle of the volume is offered, and reflectivity comes from the long-range surveillance half of a split cut');
  ok(L2.site4('TLX') === 'KTLX' && L2.nextNumber(999) === 1 && L2.prevNumber(1, [1, 5, 9]) === 9, 'site ids and the 1–999 volume numbers wrap as the bucket does');
}

console.log('\nRULE  MRMS (gzip, GRIB2, PNG) reads as ecCodes reads it, pooled to its largest values');
for (const [file, e] of Object.entries(expected.mrms)) {
  const m = await G.parseAsync(fx(file), { pool: e.pool });
  let finite = 0, max = -Infinity, bad = 0;
  for (const v of m.values) if (Number.isFinite(v)) { finite++; if (v > max) max = v; }
  for (const [i, j, v] of e.samples) { const x = m.values[i * m.grid.nx + j]; if (v === null ? Number.isFinite(x) : !(Math.abs(x - v) < 1e-3)) bad++; }
  ok(m.grid.nx === e.nx && m.grid.ny === e.ny && m.pack.tmpl === 41, `${file.slice(5, 40)}: PNG packing, pooled ${e.pool}×${e.pool} to ${m.grid.nx}×${m.grid.ny}`);
  ok(finite === e.finite && Math.abs(max - e.max) < 1e-3 && bad === 0, `${file.slice(5, 40)}: ${finite} points, largest ${max.toFixed(2)}, ${e.samples.length} sampled blocks match${bad ? ` — ${bad} do not` : ''}`);
  const [la, lo] = G.projector(m.grid).ll(0, 0);
  ok(Math.abs(la - (54.995 - (e.pool - 1) / 2 * (e.pool === 4 ? 0.005 : 0.01) * 1)) < 0.02 && Math.abs(lo - (-129.995)) < 0.05, `${file.slice(5, 40)}: the first block sits at the middle of the points it pools`);
}

console.log('\nRULE  the derived severe maps are the published formulas');
{
  const stp = MM.field('hrrr', 'stp'), at = (o) => stp.value(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [v]])), 0);
  const base = { c: 1500, lcl: 1200, zs: 300, h: 150, u: 20, v: 0 };
  ok(Math.abs(at(base) - 1) < 1e-9, 'STP is 1 at 1500 J/kg, a 900 m LCL, 150 m²/s² of 0–1 km helicity and 20 m/s of shear');
  ok(at({ ...base, lcl: 2600 }) === 0 && Math.abs(at({ ...base, lcl: 1800 }) - 0.5) < 1e-9, 'an LCL above 2000 m gives nothing; at 1500 m it halves (Thompson et al. 2003)');
  ok(at({ ...base, u: 12 }) === 0 && Math.abs(at({ ...base, u: 40 }) - 1.5) < 1e-9, 'shear under 12.5 m/s gives nothing; past 30 m/s it is held at 1.5');
  const ehi = MM.field('hrrr', 'ehi');
  ok(Math.abs(ehi.value({ c: [2000], h: [160] }, 0) - 2) < 1e-9, 'EHI is CAPE × helicity / 160,000');
  const m = new Uint8Array(81); m[40] = 1;
  const w = MM.within(m, 9, 9, 2);
  ok(w.reduce((a, b) => a + b, 0) === 25 && w[40 - 2 * 9 - 2] === 1 && w[40 - 3 * 9] === 0, 'within 40 km: one event lights the square of cells around it, and no further');
  ok(MM.FIELDS.tle.every((f) => f.member && f.event && f.pal === 'prob'), 'every ensemble field names the member field and the event it counts');
  ok(MR.keyTime('CONUS/MESH_00.50/20261022/MRMS_MESH_00.50_20261022-201400.grib2.gz') === Date.UTC(2026, 9, 22, 20, 14), 'an MRMS file carries its time in its name');
  ok(Object.values(MR.PRODUCTS).every((P) => MM.PAL[P.pal] && MM.UNIT[P.unit]), 'every MRMS product has a palette and a unit');
}

console.log('\nRULE  two fields in one GRIB2 message (the NAM\'s winds): each is read as itself');
{
  /* Build what NCEP writes: one message, sections 0–3 once, then 4–7 for
     the first field and 4–7 again for the second. Made here from two HRRR
     fixtures on the same grid, so each half has a known answer. */
  const A = fx('hrrr-uh03.grb2'), B = fx('hrrr-cpofp.grb2');
  const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
  const sections = (b) => { const out = []; let p = 16; const total = Number(new DataView(b.buffer, b.byteOffset + 8, 8).getBigUint64(0)); while (p < total - 4) { const len = u32(b, p); out.push([b[p + 4], b.subarray(p, p + len)]); p += len; } return out; };
  const sa = sections(A), sb = sections(B);
  const head = sa.filter(([s]) => s <= 3).map(([, x]) => x), fa = sa.filter(([s]) => s >= 4).map(([, x]) => x), fb = sb.filter(([s]) => s >= 4).map(([, x]) => x);
  const parts = [A.subarray(0, 16), ...head, ...fa, ...fb, new TextEncoder().encode('7777')];
  const n = parts.reduce((s, x) => s + x.length, 0), M = new Uint8Array(n);
  let o = 0; for (const x of parts) { M.set(x, o); o += x.length; }
  new DataView(M.buffer).setBigUint64(8, BigInt(n));
  const a = G.parse(A), b = G.parse(B), m1 = G.parse(M, { sub: 1 }), m2 = G.parse(M, { sub: 2 });
  const same = (x, y) => x.length === y.length && x.every((v, i) => (Number.isNaN(v) ? Number.isNaN(y[i]) : v === y[i]));
  ok(same(m1.values, a.values) && same(m2.values, b.values), 'the first field and the second come out as they were packed');
  const idx = G.parseIdx('166:100:d=2026102300:HGT:250 mb:6 hour fcst:\n167.1:200:d=2026102300:UGRD:250 mb:6 hour fcst:\n167.2:200:d=2026102300:VGRD:250 mb:6 hour fcst:\n168:900:d=2026102300:TMP:250 mb:6 hour fcst:\n');
  ok(idx[1].sub === 1 && idx[2].sub === 2 && idx[1].end === 899 && idx[2].end === 899 && idx[0].end === 199 && idx[3].end === null,
    'the .idx gives both halves the whole message, and says which half');
}

console.log('\nRULE  storm-relative velocity: each radial loses the storm motion\'s part along it');
{
  /* a made-up sweep in m/s: 360 radials, the wind at every gate the same
     10 m/s from the west; the storms moving east at 10 m/s too */
  const nRad = 360, nBins = 2, lut = new Float32Array(256).fill(NaN);
  for (let i = 2; i < 256; i++) lut[i] = -63.5 + (i - 2) * 0.5;
  const enc = (v) => Math.round((v + 63.5) / 0.5) + 2, data = new Uint8Array(nRad * nBins);
  const az0 = new Float32Array(nRad), daz = new Float32Array(nRad).fill(1);
  for (let k = 0; k < nRad; k++) { az0[k] = k - 0.5; const v = 10 * Math.sin(k * Math.PI / 180); data[k * nBins] = enc(v); data[k * nBins + 1] = 1; }
  const f = { code: 'L2', nRad, nBins, az0, daz, data, lut, special: { 1: 'rf' } };
  const s = N.stormRelative(f, 10, 0), val = (k) => s.lut[s.data[k * nBins]];
  ok([0, 45, 90, 180, 270, 333].every((k) => Math.abs(val(k)) <= 1.6), 'a wind that is only the storm\'s own motion is near zero on every radial (to the 1.6 kt step)');
  const g = N.stormRelative(f, 0, 0);
  ok(Math.abs(g.lut[g.data[90 * nBins]] - 10 / 0.514444) <= 1.6, 'with the storm still, it is the velocity itself, in knots');
  ok(s.special[s.data[nBins + 1]] === 'rf', 'a range-folded gate stays range folded');
}

console.log('\nRULE  the NAM nest, the RAP and the National Blend: only fields their files carry');
{
  const ids = (src) => MM.FIELDS[src].map((f) => f.id);
  ok(!ids('nam').includes('ltng') && !ids('nam').includes('snow') && ids('nam').includes('h500') && ids('nam').includes('uh'), 'the NAM: no lightning or snowfall (not in its files), the upper air, updraft helicity');
  ok(!ids('rap').includes('uh') && ids('rap').includes('qpf1') && ids('rap').includes('jet250'), 'the RAP: no updraft helicity, its hourly rain, the jet');
  ok(MM.FIELDS.nbm.every((f) => f.unit === 'pct' && f.pal === 'prob'), 'the Blend: every field a chance, drawn as one');
  ok(MM.FIELDS.nam.find((f) => f.id === 'refc').parts.r({ name: 'REFC', level: 'entire atmosphere (considered as a single layer)', fcst: '6 hour fcst' }), 'the NAM reads reflectivity under its own level name');
  const e = (line) => { const f = line.split(':'); return { name: f[0], level: f[1], fcst: f[2], line }; };
  const rain = MM.FIELDS.nbm.find((f) => f.id === 'p_rain6').parts.p;
  ok(rain(e('APCP:surface:18-24 hour acc fcst:prob >0.254:prob fcst 255/255')) && !rain(e('APCP:surface:12-24 hour acc fcst:prob >0.254:prob fcst 255/255')) && !rain(e('APCP:surface:23-24 hour acc fcst:prob >0.254:prob fcst 255/255')),
    'the Blend\'s 6-hour rain chance, not its 12- or 1-hour one');
  const hours = MM.SOURCES.nbm.hours(Array.from({ length: 60 }, (_, k) => k + 1), Date.UTC(2026, 9, 23, 2));
  ok(hours[0] === 10 && hours.every((h) => (2 + h) % 6 === 0), 'its hours are the ones valid at 00, 06, 12 and 18Z, where its 6-hour windows end');
  ok(MM.SOURCES.rap.bucket.endsWith('/rap'), 'the RAP is read through the Worker\'s /rap (NOAA\'s bucket has no CORS)');
  /* the rotated grid's winds turn to the earth: the +i direction at the grid's centre points east */
  const grid = { kind: 'rotll', nx: 953, ny: 834, la1: -10.5906, lo1: 220.4, la0: 47.5, lo0: 254, la2: 80.1, lo2: 9.7, uvGrid: true };
  const [u, v] = MM.earthWind(grid, 47.5, -106, 10, 0);
  ok(Math.abs(u - 10) < 0.1 && Math.abs(v) < 0.1, 'and at its centre, grid-east is earth-east');
}

console.log(failures ? `\n${failures} DECODER RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL DECODER RULES PASS');
process.exit(failures ? 1 : 0);
