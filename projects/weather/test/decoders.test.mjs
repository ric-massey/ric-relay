/* Weather Pro's decoders — node projects/weather/test/decoders.test.mjs
   The radar, lightning and model maps are read from NOAA's raw files in the
   browser (bzip2.js, nexrad.js, glm.js, grib2.js). Each is held here to the
   library the field trusts, on real files in fixtures/: MetPy for NEXRAD
   Level III, ecCodes for GRIB2, h5py for the GLM's HDF5. fixtures/
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

console.log(failures ? `\n${failures} DECODER RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL DECODER RULES PASS');
process.exit(failures ? 1 : 0);
