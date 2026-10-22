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
}
ok(L.hourPrefix(Date.UTC(2026, 0, 1, 5)) === 'GLM-L2-LCFA/2026/001/05/' && L.hourPrefix(Date.UTC(2026, 11, 31, 23)) === 'GLM-L2-LCFA/2026/365/23/', 'the bucket is by day of the year and hour');

console.log(failures ? `\n${failures} DECODER RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL DECODER RULES PASS');
process.exit(failures ? 1 : 0);
