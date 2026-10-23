/* The weather room over hours — node projects/weather/test/soak.mjs [--minutes 60] [--every 120] [--burst 0]
   live.mjs asks every provider once. This asks the ones a storm day leans on
   again and again, through the same functions the page calls, and keeps
   score: how often each answered, how fast, and how old its newest data was.
   Run it through an active severe-weather day (2026-10-23: "run it
   continuously through active severe weather, including heavy usage and
   upstream outages").

   What it watches, each round (about a dozen requests):
     mosaic    IEM's national mosaic time (Wx.radarTime) and its age
     worker    the site's Worker answering /wx/radar (the page's first path)
     radar     NOAA's Level III bucket: the newest N0B at the busiest radars,
               decoded, aged by the time inside the file (a frozen feed shows)
     motion    NWS's storm motion in the same radars' N0S files
     alerts    the NWS's national storm warnings
     backup    Iowa State's copy of the storm warnings (the page's backup)
     cells     IEM's tracked storm cells
   An outage is a row that failed; the page's own behaviour in one is held by
   wx.test.mjs and the browser checks — this measures the providers.

   --burst N asks the site's own Worker for the same cached route N times at
   once, each round: what a crowd on a storm night does to it. It never
   bursts NOAA, the NWS or Iowa State — their services are shared, and the
   Worker's cache is what stands between a crowd and them.

   No coordinates are written here (hard rule 1). It writes nothing; the
   summary goes to the terminal, one JSON line a round to stdout with --json. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../wx.js');
const NX = require('../nexrad.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const MINUTES = arg('minutes', 60), EVERY = arg('every', 120), BURST = arg('burst', 0), JSONL = process.argv.includes('--json');
const SITES = ['TLX', 'AMX', 'BYX', 'TFX', 'LOT', 'FWS', 'DMX', 'MPX', 'FFC', 'LWX', 'ATX', 'MUX', 'ABQ', 'BMX', 'HGX', 'OKX'];
const WORKER = 'https://training-log.rmbuster82.workers.dev';

const score = {};
const mark = (k, okay, ms, age) => {
  const s = score[k] || (score[k] = { n: 0, ok: 0, ms: [], ages: [], fails: [] });
  s.n++; if (okay) s.ok++; else s.fails.push(new Date().toISOString().slice(11, 19));
  if (Number.isFinite(ms)) s.ms.push(ms);
  if (Number.isFinite(age)) s.ages.push(age);
};
const timed = async (fn) => { const t = Date.now(); try { const v = await fn(); return { v, ms: Date.now() - t }; } catch (e) { return { e, ms: Date.now() - t }; } };

/* the busiest radars: the most storm motion in their N0S, found again every hour */
let busy = [], busyAt = 0;
async function findBusy() {
  const got = [];
  for (const site of SITES) {
    try { const s = (await NX.scans(site, 'N0S', { mins: 30 })).at(-1); if (s) { const F = await NX.load(s.url); got.push({ site, kt: F.motion ? F.motion.kt : 0 }); } } catch (e) { /* down for maintenance */ }
  }
  busy = got.sort((a, b) => b.kt - a.kt).slice(0, 4).map((x) => x.site);
  busyAt = Date.now();
}

async function round() {
  const row = { t: new Date().toISOString() };
  if (!busy.length || Date.now() - busyAt > 3600e3) await findBusy();
  const m = await timed(() => W.radarTime());
  mark('mosaic', !!m.v, m.ms, m.v ? (Date.now() - m.v) / 60e3 : NaN); row.mosaic = m.v ? Math.round((Date.now() - m.v) / 60e3) : null;
  const w = await timed(async () => { const r = await fetch(WORKER + '/wx/radar'); if (!r.ok) throw new Error(r.status); return r.json(); });
  mark('worker', !w.e, w.ms);
  for (const site of busy) {
    const r = await timed(async () => { const s = (await NX.scans(site, 'N0B', { mins: 20 })).at(-1); if (!s) throw new Error('no scan'); return NX.load(s.url); });
    mark('radar', !r.e, r.ms, r.v ? (Date.now() - r.v.time) / 60e3 : NaN);
    row[site] = r.v ? Math.round((Date.now() - r.v.time) / 60e3) : null;
    const mo = await timed(async () => { const s = (await NX.scans(site, 'N0S', { mins: 20 })).at(-1); return s && (await NX.load(s.url)).motion; });
    mark('motion', !mo.e, mo.ms);
  }
  const a = await timed(() => W.national());
  mark('alerts', !a.e, a.ms); row.warnings = a.v ? a.v.length : null;
  const b = await timed(() => W.sbwArchive(Date.now() - 3600e3, Date.now()));
  mark('backup', !b.e, b.ms);
  const c = await timed(() => W.proOverlays.cells());
  mark('cells', !c.e, c.ms); row.cells = c.v ? c.v.length : null;
  if (BURST > 0) {
    const t = Date.now(), res = await Promise.all(Array.from({ length: BURST }, () => fetch(WORKER + '/wx/radar').then((r) => r.ok, () => false)));
    mark('burst', res.every(Boolean), Date.now() - t); row.burst = `${res.filter(Boolean).length}/${BURST}`;
  }
  if (JSONL) console.log(JSON.stringify(row));
  else console.log(`${row.t.slice(11, 19)}  mosaic ${row.mosaic ?? '—'} min · radars ${busy.map((s) => `${s} ${row[s] ?? '✗'}`).join(' ')} min · ${row.warnings ?? '✗'} warnings · ${row.cells ?? '✗'} cells${row.burst ? ' · burst ' + row.burst : ''}`);
}

const end = Date.now() + MINUTES * 60e3;
console.log(`soak: ${MINUTES} min, a round every ${EVERY} s${BURST ? `, ${BURST} at once to the Worker` : ''}`);
while (Date.now() < end) {
  const t = Date.now();
  try { await round(); } catch (e) { console.log('round failed:', e.message); }
  await new Promise((r) => setTimeout(r, Math.max(0, EVERY * 1000 - (Date.now() - t))));
}

const q = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
console.log('\nsource    answered        p50 ms   p95 ms   newest data, worst (min)   failed at');
let bad = 0;
for (const [k, s] of Object.entries(score)) {
  const up = s.ok / s.n;
  if (up < 0.95) bad++;
  console.log(`${k.padEnd(9)} ${`${s.ok}/${s.n} (${Math.round(up * 100)}%)`.padEnd(15)} ${String(q(s.ms, 0.5)).padStart(6)}   ${String(q(s.ms, 0.95)).padStart(6)}   ${s.ages.length ? Math.max(...s.ages).toFixed(1).padStart(8) : '       —'}                   ${s.fails.slice(0, 6).join(' ')}${s.fails.length > 6 ? ' …' : ''}`);
}
console.log(bad ? `\n${bad} source${bad > 1 ? 's' : ''} answered under 95% of the time` : '\nevery source answered at least 95% of the time');
process.exit(bad ? 1 : 0);
