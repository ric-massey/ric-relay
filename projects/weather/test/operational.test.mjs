/* Operational behaviour — node projects/weather/test/operational.test.mjs
   Written 2026-10-24 after an outside check: "a test showing that your
   vorticity calculation matches a reference dataset … does not establish
   that the correct forecast run is always selected, every map displays the
   correct valid time, a model download cannot silently fail, every radar
   frame is complete." These hold those claims, as far as they can be held
   without the network: with a made-up bucket and made-up failures, and with
   real files from test/fixtures. What they still cannot show — the live
   hosts on a bad day, many devices — is said in the README ("What the tests
   do not show"). */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const MM = require('../modelmaps.js'), NX = require('../nexrad.js'), G = require('../grib2.js'), L2 = require('../level2.js');
const fx = (n) => new Uint8Array(readFileSync(join(here, 'fixtures', n)));

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const H = 3600e3;

console.log('\nRULE  the newest run far enough out is the one drawn — a half-published run is passed over');
{
  /* a made-up GFS bucket on 24 October: the 12Z run has reached 9 hours, the 06Z all of them */
  const run12 = Date.UTC(2026, 9, 24, 12), run06 = Date.UTC(2026, 9, 24, 6), S = MM.SOURCES.gfs;
  const published = { [run12]: [0, 3, 6, 9], [run06]: Array.from({ length: 81 }, (_, k) => k * 3) };
  const bucket = async (url) => {
    const pre = new URL(url).searchParams.get('prefix') || '';
    const run = Object.keys(published).map(Number).find((r) => pre === S.prefix(r));
    const keys = run ? published[run].map((h) => `${S.file(run, h)}.idx`) : [];
    return new Response(`<ListBucketResult>${keys.map((k) => `<Key>${k}</Key>`).join('')}</ListBucketResult>`, { status: 200 });
  };
  const got = await MM.latestRun('gfs', { nowMs: Date.UTC(2026, 9, 24, 15, 30), fetchFn: bucket });
  ok(got && got.run === run06, `at 15:30Z the 06Z run is drawn, not the 12Z that has only 9 hours (${got && new Date(got.run).toISOString().slice(11, 16)})`);
  ok(got && got.hours[0] === 0 && got.hours.includes(120) && got.hours.every((h) => (h <= 120 ? h % 3 === 0 : h % 6 === 0)), 'its hours are the ones it published, on the GFS\'s steps');
  const none = await MM.latestRun('gfs', { nowMs: Date.UTC(2026, 9, 24, 15, 30), fetchFn: async () => new Response('<ListBucketResult></ListBucketResult>', { status: 200 }) });
  ok(none === null, 'a bucket with nothing out is "no run" — never a run with no hours');
  let threw = false;
  try { await MM.latestRun('gfs', { nowMs: Date.UTC(2026, 9, 24, 15, 30), fetchFn: async () => new Response('', { status: 403 }) }); } catch (e) { threw = true; }
  ok(threw, 'a bucket that refuses is an error the page says ("did not answer"), not an empty run');
}

console.log('\nRULE  every map\'s valid time is its run plus its hour — read from the file itself, not assumed');
{
  const b = fx('gfs1-500-uv-absv.grb2'), len = Number(new DataView(b.buffer, b.byteOffset + 8, 8).getBigUint64(0)), m = G.parse(b.subarray(0, len));
  ok(m.refTime === Date.UTC(2026, 9, 24, 0) && m.validTime === m.refTime + 24 * H, `GFS 00Z +24 h: the file says run ${new Date(m.refTime).toISOString().slice(0, 13)}Z, valid ${new Date(m.validTime).toISOString().slice(0, 13)}Z`);
  const L = MM.build(MM.field('gfs', 'h500'), { z: { grid: m.grid, values: m.values, validTime: m.validTime }, a: { grid: m.grid, values: m.values, validTime: m.validTime } }, m.refTime, 24);
  ok(L.valid === m.refTime + 24 * H && L.run === m.refTime && L.fh === 24, 'the layer the map draws carries the same run, hour and valid time');
  /* a window's total (APCP 0–6 h): valid at its end, as the frame that shows it says */
  const e = G.parseIdx('1:0:d=2026102400:APCP:surface:0-6 hour acc fcst:\n2:100:d=2026102400:TMP:2 m above ground:6 hour fcst:\n');
  ok(e[0].fcst === '0-6 hour acc fcst' && MM.field('gfs', 'qpf').parts.a(e[0]), 'a 0–6 h total is matched as the 6-hour frame\'s');
}

console.log('\nRULE  a download that fails says so — it never draws an empty map');
{
  const run = Date.UTC(2026, 9, 24, 6);
  const missing = async () => new Response('', { status: 404 });
  let msg = null;
  try { await MM.load('gfs', run, 6, 't2m', { fetchFn: missing }); } catch (e) { msg = e.message; }
  ok(msg && /HTTP 404|index/.test(msg), `a missing index file is an error (${msg})`);
  /* the index is there but the field is not in it */
  const idxOnly = async (url) => new Response(url.endsWith('.idx') ? '1:0:d=2026102406:HGT:500 mb:6 hour fcst:\n2:100:d=2026102406:UGRD:500 mb:6 hour fcst:\n' : '', { status: 200 });
  msg = null;
  try { await MM.load('gfs', run + 12 * H, 6, 't2m', { fetchFn: idxOnly }); } catch (e) { msg = e.message; }
  ok(msg && /has no/.test(msg), `a field the file does not hold is said by name (${msg})`);
  /* a truncated download: the bytes stop short of the message */
  /* a message cut short: it used to parse as a whole field, the missing bytes read as zeros (found by this test) */
  const whole = fx('gfs1-500-uv-absv.grb2'), len = Number(new DataView(whole.buffer, whole.byteOffset + 8, 8).getBigUint64(0));
  const said = [4000, 20000, len - 4].map((n) => { try { G.parse(whole.subarray(0, n)); return 'parsed'; } catch (e) { return e.message; } });
  ok(said.every((m) => /cut short/.test(m)), `a message cut short anywhere — 4,000, 20,000 or all but 4 of its ${len} bytes — is an error, never a field (${said[0]})`);
  const bent = whole.slice(0, len); bent[len - 1] = 0;
  let endErr = ''; try { G.parse(bent); } catch (e) { endErr = e.message; }
  ok(/7777/.test(endErr), 'a message whose end marker is not where its length says is refused');
  ok(G.parse(whole.subarray(0, len)).values.length === 65160, 'the whole message still reads');
  /* an HDF5 chunk cut short: an error, not a plane padded with zeros */
  const GL = require('../glm.js'), h5 = fx('hdf5-v0.h5');
  const shortSrc = GL.fromBytes(h5); const exact = shortSrc.exact; shortSrc.exact = async (o, n) => (await exact(o, n)).subarray(0, Math.max(1, n - 10));
  let h5err = ''; try { const f = await GL.open(shortSrc); await GL.variable(f, 'U', null, { slice0: 1 }); } catch (e) { h5err = e.message; }
  ok(/cut short/.test(h5err), `an HDF5 chunk cut short is an error (${h5err})`);
}

console.log('\nRULE  a host that stops answering fails within a minute, and the visitor\'s own abort is never called a failure');
{
  let calls = 0;
  const hang = (u, o) => { calls++; return new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))); };
  const t0 = Date.now();
  let err = null;
  try { await NX.retrying(hang, { waitMs: 10, stallMs: 150 })('x', {}); } catch (e) { err = e; }
  ok(err && err.stalled && calls === 2 && Date.now() - t0 < 2000, `a silent host: tried twice, then an error that says so (${err && err.message}) — at 30 s a try, about a minute in the page`);
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 30);
  err = null;
  try { await NX.retrying(hang, { waitMs: 10, stallMs: 5000 })('x', { signal: ctl.signal }); } catch (e) { err = e; }
  ok(err && !err.stalled, 'a new layer chosen mid-download aborts it quietly, not as a failure');
  const answer = await NX.retrying(async () => ({ ok: true, status: 200 }), { stallMs: 150 })('x', {});
  ok(answer.status === 200, 'a host that answers is not touched');
  ok(NX.STALL_MS === 30e3, 'in the page a try waits 30 s for an answer');
}

console.log('\nRULE  a radar volume still sweeping says its cut is not whole');
{
  const e = JSON.parse(readFileSync(join(here, 'fixtures', 'expected.json'), 'utf8')).l2;
  let all = null; for (const f of e.files) all = L2.feed(fx(f), all);
  const S = e.files.filter((f) => /-S$/.test(f)), I = e.files.filter((f) => /-I$|-E$/.test(f));
  let part = null; for (const f of [...S, I[0]]) part = L2.feed(fx(f), part);
  const num = Number(Object.keys(e.sweeps)[0]), whole = L2.sweep(all, num, 'REF'), some = L2.sweep(part, num, 'REF');
  ok(whole && whole.complete && whole.nRad === 360, `every chunk of the cut: ${whole && whole.nRad} radials, whole`);
  ok(some && !some.complete && some.nRad < whole.nRad, `its first chunk only: ${some && some.nRad} radials, said to be still sweeping — the page then draws the volume before it`);
}

console.log(failures ? `\n${failures} OPERATIONAL RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL OPERATIONAL RULES PASS');
process.exit(failures ? 1 : 0);
