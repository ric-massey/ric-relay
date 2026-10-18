/* The radar nowcast — node projects/weather/test/nowcast.test.mjs
   A real PNG (built here, paletted, every filter type) decodes to its
   indices; a storm drawn on a grid and moved a known amount between frames
   is found moving that way; and what the nowcast says arrives over a point
   matches where the storm actually goes. */
import { createRequire } from 'node:module';
import { deflateSync, inflateSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const N = require('../nowcast.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };
const inflate = async b => new Uint8Array(inflateSync(b));

/* a minimal PNG writer: palette type, the given filter per row */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), 8 + data.length);
  return out;
}
function png(w, h, px, filterOf) {
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    const f = filterOf(y);
    raw[y * (w + 1)] = f;
    for (let x = 0; x < w; x++) {
      const v = px[y * w + x], a = x ? px[y * w + x - 1] : 0, up = y ? px[(y - 1) * w + x] : 0, c = x && y ? px[(y - 1) * w + x - 1] : 0;
      let pred = 0;
      if (f === 1) pred = a; else if (f === 2) pred = up; else if (f === 3) pred = (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      raw[y * (w + 1) + 1 + x] = (v - pred) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(256 * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

console.log('\nRULE  a paletted PNG is read back to its indices');
{
  const w = 37, h = 10, px = new Uint8Array(w * h);
  for (let i = 0; i < px.length; i++) px[i] = (i * 7 + (i >> 3)) & 255;
  const img = await N.decodePng(png(w, h, px, y => y % 5), inflate);
  ok(img.width === w && img.height === h && img.data.every((v, i) => v === px[i]), 'every filter (none, sub, up, average, Paeth) undone exactly');
  let threw = false; try { await N.decodePng(new Uint8Array([1, 2, 3]), inflate); } catch { threw = true; }
  ok(threw, 'not a PNG: refused');
  ok(N.dbzOf(0) === null && N.dbzOf(105) === 20 && N.dbzOf(65) === 0, 'N0Q: index 0 is nothing, 0.5 dBZ steps from -32.5');
}

/* a storm: a disc of 45 dBZ with a 25 dBZ rim, on a 120×120 grid */
const W = 120;
function storm(cx, cy) {
  const v = new Float32Array(W * W).fill(-99);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d < 6) v[y * W + x] = 45; else if (d < 10) v[y * W + x] = 25;
    /* a second, stationary-shaped cell elsewhere moving the same way keeps the regions honest */
  }
  return { w: W, h: W, v };
}

console.log('\nRULE  the motion is found');
{
  /* moving 1.5 px/min east and 0.5 px/min south; frames 10 minutes apart */
  const frames = [0, 1, 2, 3].map(k => storm(20 + 15 * k, 40 + 5 * k));
  const m = N.motion(frames, 10, { regions: 1, search: 20 });
  ok(m.known && Math.abs(m.u - 1.5) < 0.11 && Math.abs(m.v - 0.5) < 0.11, `whole-picture motion ${m.u.toFixed(2)}, ${m.v.toFixed(2)} px/min (true 1.5, 0.5)`);
  const empty = N.motion([storm(-50, -50), storm(-50, -50)], 10, { regions: 2 });
  ok(!empty.known && empty.u === 0 && empty.v === 0, 'nothing on radar: no motion claimed');

  console.log('\nRULE  what arrives over a point');
  const last = frames[3];                                  // storm now at (65, 55)
  /* a point 30 px east, 10 south: the core arrives in ~20 min */
  const s = N.forecast(last, m, 95, 65, { maxMin: 60, r0: 1, grow: 0 });
  const first = s.find(p => p.p >= 0.5);
  ok(s[0].p === 0 && first && first.min >= 10 && first.min <= 20, `dry now, rain from ~${first && first.min} min (rim at ~13–15, core ~20)`);
  const core = s.find(p => p.dbz >= 45);
  ok(core && Math.abs(core.min - 20) <= 5, `the heavy core over the point at ~${core && core.min} min`);
  const T = Date.parse('2026-10-17T15:00:00Z'), utc = ms => new Date(ms).toISOString().slice(11, 16);
  const d = N.describe(s, { base: T, now: T, clock: utc });
  ok(d.kind === 'starting' && d.at === first.min && d.peak === 'heavy', `in words: ${d.text}`);
  const late = N.describe(s, { base: T, now: T + 6 * 60e3, clock: utc });
  ok(late.text.includes(`around ${utc(T + first.min * 60e3)}`) && late.text.includes(`in about ${Math.round((first.min - 6) / 5) * 5} min`),
    `read six minutes after the scan, the clock time stays and the wait shrinks: ${late.text}`);
  const behind = N.forecast(last, m, 20, 40, { maxMin: 60 });
  ok(N.describe(behind).kind === 'dry', 'a point the storm has already passed stays dry');
  const under = N.forecast(last, m, 65, 55, { maxMin: 60, grow: 0 });
  const dd = N.describe(under, { base: T, now: T, clock: utc });
  ok(dd.kind === 'ending' && dd.at > 0 && dd.at <= 15, `under the storm now: ${dd.text}`);
}

console.log('\nRULE  the coarse grid keeps the strongest echo in a block');
{
  const img = { width: 4, height: 4, data: new Uint8Array([0, 0, 105, 0, 0, 155, 0, 0, 0, 0, 0, 0, 0, 0, 0, 125]) };
  const f = N.field(img, 2);
  ok(f.w === 2 && f.h === 2 && f.v[0] === 45 && f.v[1] === 20 && f.v[2] === -99 && f.v[3] === 30, 'max dBZ per block; no echo stays "nothing"');
}

console.log('\nRULE  a live tile colour gives its dBZ back');
{
  const c = i => [0, 2, 4].map(k => parseInt(N.PALETTE.slice(i * 6 + k, i * 6 + k + 2), 16));
  const rgba = new Uint8Array([...c(105), 255, ...c(150), 255, 9, 9, 9, 255, ...c(105), 0]);
  const idx = N.indicesOf(rgba);
  ok(idx[0] === 105 && N.dbzOf(idx[0]) === 20 && idx[1] === 150, 'palette colours → their index (20 dBZ is index 105)');
  ok(idx[2] === 0 && idx[3] === 0, 'a colour not in the palette, or a transparent pixel, is "nothing"');
  ok(N.PALETTE.length === 256 * 6, 'the whole 256-colour palette is there');
}

console.log('\nRULE  the nightly grade: graded like the page, against "nothing moves"');
{
  const G = await import('../verify/nowcast.mjs');
  const W2 = 240, H2 = 160;
  /* a line of storms 40 cells long moving east at 1 cell a minute (2 km cells: 120 km/h) */
  const line = x0 => { const v = new Float32Array(W2 * H2).fill(-99); for (let y = 50; y < 110; y++) for (let x = x0; x < x0 + 12; x++) v[y * W2 + x] = 40; return { w: W2, h: H2, v }; };
  const frames = [30, 40, 50, 60].map(line);           // t−30 … t, 10 min apart
  const truth = G.LEADS.map(L => line(60 + L));
  const g = G.gradeSample(frames, truth, 2, 4);
  const csi = c => c[0] / (c[0] + c[1] + c[2]);
  ok(g.moving && Math.abs(g.u - 1) < 0.15, `the line's motion found: ${g.u.toFixed(2)} cells/min`);
  ok(G.LEADS.every(L => csi(g.counts[L].now) > csi(g.counts[L].still)), 'at every lead the nowcast beats "nothing moves": ' +
    G.LEADS.map(L => `${L}m ${csi(g.counts[L].now).toFixed(2)} vs ${csi(g.counts[L].still).toFixed(2)}`).join(', '));
  const s = G.foldDay(null, '2026-10-16', g.counts);
  const sum = G.summary(s);
  ok(sum.through === '2026-10-16' && sum.leads[30].csi > sum.leads[30].still, 'folded into the record and summarised for the page');
  ok(G.archiveUrl(Date.parse('2026-10-16T12:05:00Z')).endsWith('/2026/10/16/GIS/uscomp/n0q_202610161205.png'), 'the archive address for a time');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL NOWCAST RULES PASS'));
process.exit(failures ? 1 : 0);
