/* CLIMBING — the date index the training page needs
   ────────────────────────────────────────────────────────────────────────────
   climbs-data.js is 200 kB, which is fine on the climbing page and absurd on the
   training page, where the only question is "did I climb on this date, and what
   do I link to?". This writes the two-line answer.

       node projects/climbing/build-climb-days.mjs

   Run it after build-data.py, or whenever climbs.md gains a dated trip. The
   output is committed; the training page fetches it.

   Web-added days (the ones logged from a phone via the Worker) are NOT in here
   — they come from the live API and are merged client-side. This file is only
   the static archive built from the markdown. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'assets', 'climb-days.json');

/* climbs-data.js assigns to window; give it one. */
const sandbox = { window: {} };
new Function('window', readFileSync(join(HERE, 'climbs-data.js'), 'utf8'))(sandbox.window);
const trips = (sandbox.window.CLIMBING_DATA || {}).trips || [];

const days = {};
for (const t of trips) {
  /* Undated trips exist in climbs.md by design — old sessions nobody wrote the
     day down for. They cannot match a training day, so they are skipped rather
     than guessed at. */
  if (!t.date || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
  const routes = (t.routes || []).length;
  /* Two trips can share a date across areas; keep both names. */
  if (days[t.date]) {
    days[t.date].area += ' + ' + t.area;
    days[t.date].routes += routes;
  } else {
    days[t.date] = { area: t.area || 'Climbing', routes, anchor: 'trip-' + t.date };
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), days }));

const n = Object.keys(days).length;
console.log(`wrote assets/climb-days.json — ${n} dated days out of ${trips.length} trips`);
console.log(`size: ${(Buffer.byteLength(JSON.stringify({ days })) / 1024).toFixed(1)} kB`);
