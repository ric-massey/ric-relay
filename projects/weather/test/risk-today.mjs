/* Is today a severe-weather day? — node projects/weather/test/risk-today.mjs [--min ENH]
   SPC's day-1 categorical outlook, through the same function the page uses:
   prints the highest risk anywhere in the lower 48 and, under GitHub Actions,
   writes `run=true` to $GITHUB_OUTPUT when it is at least --min (Enhanced by
   default). .github/workflows/weather-soak.yml asks this before it spends
   three hours watching the feeds (2026-10-23, Ric: "Yep" to running the soak
   test by itself on outbreak days). It always exits 0: a quiet day, or SPC
   not answering, is not a failure — the soak simply waits for weather. */
import { createRequire } from 'node:module';
import { appendFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const W = require('../wx.js');

const ORDER = ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH'];
const i = process.argv.indexOf('--min'), MIN = i > 0 ? String(process.argv[i + 1]).toUpperCase() : 'ENH';
const force = process.argv.includes('--force');

let top = null, issued = null, err = null;
try {
  const o = (await W.outlook('day1otlk_cat')).filter((x) => !x.expire || x.expire > Date.now());
  for (const x of o) if (ORDER.includes(x.label) && (!top || ORDER.indexOf(x.label) > ORDER.indexOf(top))) top = x.label;
  issued = o.find((x) => x.issued) ? new Date(o.find((x) => x.issued).issued).toISOString().slice(0, 16) + 'Z' : null;
} catch (e) { err = e.message; }

const run = force || (top != null && ORDER.indexOf(top) >= ORDER.indexOf(MIN));
console.log(err ? `SPC did not answer (${err})` : `SPC day 1: highest risk ${top || 'none'}${issued ? `, issued ${issued}` : ''}`);
console.log(run ? `${force ? 'forced' : `at least ${MIN}`}: watch the feeds` : `under ${MIN}: nothing to watch today`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\nrisk=${top || 'none'}\n`);
