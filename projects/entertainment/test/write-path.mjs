/* ENTERTAINMENT — a film survives the whole way, or this fails
   ────────────────────────────────────────────────────────────────────────────
   Three programs handle a change Ric makes on the page, and none of them can
   see the other two:

     assets/entertainment/room.js   decides what to send
     projects/training/server/      stores it, with no sight of the data file
     pull-entertainment.py          merges it back into the committed file

   Each was individually correct and the path between them was not. On
   2026-09-23 it turned out that the service dropped every field it had no slot
   for (the chooser's `tmdb`, `wd`, `year` — thrown away, then re-guessed from
   the title), refused the first edit to any of the 363 committed films, and
   filled in a status nobody sent, which moved films Ric watched years ago back
   onto the queue. All three had been live for a while. Nothing failed, because
   nothing looked: the page renders its local layer and calls it "not
   committed", so a refused write and a write made on a train look identical.

   So this walks one film the whole way and checks it arrives. No network, no
   token, no Cloudflare — the real Durable Object class with a Map for storage,
   and the real stage_sync out of the pull script.

       node projects/entertainment/test/write-path.mjs

   Exits non-zero on any failure.

   See also projects/climbing/test/parse-parity.js, which exists for the same
   reason one floor down: two programs reading one file have to agree, and
   "have to" is not a thing you can hope at. */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { TrainingLog } from '../../training/server/worker.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = p => readFileSync(join(ROOT, p), 'utf8');

let failures = 0;
const ok = (cond, msg) => {
  console.log((cond ? '  PASS  ' : '  FAIL  ') + msg);
  if (!cond) failures++;
};

/* ── the service, in memory ── */
const TOKEN = 'test-token-long-enough-to-be-real';
function service() {
  const mem = new Map();
  const log = new TrainingLog({ storage: {
    get: async k => mem.get(k),
    put: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); },
    list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
  } }, { LOG_TOKEN: TOKEN });

  return async (method, path, body) => {
    const r = await log.fetch(new Request('https://x' + path, {
      method,
      headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    }));
    return { status: r.status, body: await r.json() };
  };
}

/* ── what the page sends ──
   Read out of the page rather than retyped here. A copy of a rule is a rule
   that goes green after somebody edits the original — the trap atlas's
   prefs-matches-app.test.mjs was written for. */
const roomJs = read('assets/entertainment/room.js');
const saveFn = roomJs.slice(roomJs.indexOf('async function save(id, patch)'),
                            roomJs.indexOf('const today = ()'));

console.log('\nRULE  the page sends enough for the service to be right about the film');
{
  ok(/body\.title\s*=/.test(saveFn),
     'save() sends the title — without it the first edit to a committed film is a 400');
  ok(/body\.status\s*=/.test(saveFn),
     'and the status — without it a patch saying only `pick` moves a watched film back to the queue');
  ok(/startsWith\('_'\)/.test(saveFn),
     'and leaves reserved records alone, which have neither');
}

console.log('\nRULE  the two FIELDS lists have not drifted apart');
{
  const js = JSON.parse(roomJs.match(/const FIELDS = (\[[^\]]*\])/s)[1].replace(/'/g, '"'));
  const py = JSON.parse(read('projects/entertainment/pull-entertainment.py')
    .match(/^FIELDS = (\[[^\]]*\])/ms)[1].replace(/'/g, '"'));
  /* The page's list leaves out id/title/status: they are not editable fields,
     they are the row. The script's includes them because it writes the file. */
  const pyRest = py.filter(f => !['id', 'title', 'status'].includes(f));
  ok(JSON.stringify(js) === JSON.stringify(pyRest),
     'the page and the pull script name the same fields, in the same order');
  if (JSON.stringify(js) !== JSON.stringify(pyRest)) {
    console.log('        page:   ' + js.join(' '));
    console.log('        script: ' + pyRest.join(' '));
  }
}

/* ── a film with every field filled in ──
   Built from FIELDS, so a field added to the page tomorrow is carried by this
   test the same day rather than whenever somebody remembers. */
const FIELDS = JSON.parse(roomJs.match(/const FIELDS = (\[[^\]]*\])/s)[1].replace(/'/g, '"'));
const SAMPLE = {
  count: 2, series: true, where: 'Netflix', pick: true, note: 'a note', seen: '2026-09-23',
  wd: 'Q17087904', wdok: true, tmdb: 273481, kind: 'movie', imdb: 'tt1798684',
  year: 2015, runtime: 121, genres: ['Thriller'], director: 'Denis Villeneuve',
  overview: 'A line about it.', rating: 'R', cast: ['Emily Blunt'],
  parts: [{ id: 'sicario-2', title: 'Sicario: Day of the Soldado' }],
  like: ['no-country-for-old-men'], poster: true, backdrop: true,
  streams: ['Netflix'], rents: ['Buy'], checked: '2026-09-23'
};

console.log('\nRULE  every field the page can send survives the service');
{
  const missing = FIELDS.filter(f => !(f in SAMPLE));
  ok(missing.length === 0,
     'this test has a value for every field the page knows about' +
     (missing.length ? ' — MISSING: ' + missing.join(', ') : ''));

  const hit = service();
  const sent = { id: 'sicario', title: 'Sicario', status: 'watchlist', ...SAMPLE };
  await hit('POST', '/movies/sicario', sent);
  const stored = (await hit('GET', '/movies')).body.items.sicario;

  const lost = FIELDS.filter(f => JSON.stringify(stored[f]) !== JSON.stringify(SAMPLE[f]));
  ok(lost.length === 0, 'nothing is dropped on the way in' +
     (lost.length ? ' — LOST: ' + lost.join(', ') : ''));
}

console.log('\nRULE  a patch changes what it names and nothing else');
{
  const hit = service();
  const full = { id: 'sicario', title: 'Sicario', status: 'watched', ...SAMPLE };
  await hit('POST', '/movies/sicario', full);
  /* The page's own shape for "I have seen this": title and status ride along,
     and nothing else is mentioned. */
  await hit('POST', '/movies/sicario', { id: 'sicario', title: 'Sicario', status: 'watched', pick: false });
  const after = (await hit('GET', '/movies')).body.items.sicario;

  ok(after.pick === false, 'the field it named changed');
  const collateral = FIELDS.filter(f => f !== 'pick' &&
    JSON.stringify(after[f]) !== JSON.stringify(SAMPLE[f]));
  ok(collateral.length === 0, 'and nothing it did not name moved' +
     (collateral.length ? ' — CHANGED: ' + collateral.join(', ') : ''));
}

console.log('\nRULE  a film the service has never heard of can still be edited');
{
  const hit = service();
  /* This is every one of the 363 rows in the committed file, the first time
     Ric touches it. It used to come back 400. */
  const r = await hit('POST', '/movies/heat', { id: 'heat', title: 'Heat', status: 'watched', pick: true });
  ok(r.status === 200, 'the patch is accepted');
  ok(r.body.item.status === 'watched', 'with the status the page said it had');

  const bare = await hit('POST', '/movies/the-departed', { id: 'the-departed', title: 'The Departed', pick: true });
  ok(bare.body.item.status === undefined,
     'and a patch that mentions no status has none invented for it');
}

/* ── and out the other side ──
   The service is only half the trip. What lands in entertainment-data.js is
   whatever stage_sync makes of these records, and that is Python. */
console.log('\nRULE  the pull script folds the same change into the file, and only that change');
{
  const hit = service();
  await hit('POST', '/movies/heat', { id: 'heat', title: 'Heat', status: 'watched', seen: '2026-09-23' });
  await hit('POST', '/movies/sicario', { id: 'sicario', title: 'Sicario', status: 'watchlist', tmdb: 273481, wd: 'Q17087904' });
  await hit('POST', '/movies/tag', { id: 'tag', removed: true });
  await hit('POST', '/movies/_people', { names: ['Michael Mann'] });
  const items = (await hit('GET', '/movies')).body.items;

  const dir = mkdtempSync(join(tmpdir(), 'entertainment-'));
  writeFileSync(join(dir, 'items.json'), JSON.stringify({ items }));
  const out = execFileSync('python3', [join(ROOT, 'projects/entertainment/test/merge-once.py'),
                                       join(dir, 'items.json')], { encoding: 'utf8' });
  const merged = JSON.parse(out);

  const heat = merged.rows.find(r => r.id === 'heat');
  ok(heat.status === 'watched' && heat.seen === '2026-09-23', 'the edit lands on the committed row');
  ok(heat.where === 'Buy' && heat.year === 1995,
     'and the fields nobody touched still hold what the file said');
  ok(heat.added === undefined,
     'without stamping an old film with the date the service first saw it');

  const sicario = merged.rows.find(r => r.id === 'sicario');
  ok(sicario && sicario.tmdb === 273481 && sicario.wd === 'Q17087904',
     'a new film arrives with the identity Ric picked, so nothing has to guess');

  ok(!merged.rows.some(r => r.id === 'tag'), 'a removal removes');
  ok(!merged.rows.some(r => String(r.id).startsWith('_')),
     'and a list of favourite actors is never filed as a film');
}

console.log('\nRULE  the dev server can still exercise every route the Worker answers');
{
  /* dev.mjs is the only way to run any of this without a real token. Its route
     list is a separate regex and it had gone stale — /movies and /todo fell
     through to the deployed Worker, so the room could not be tested locally at
     all and nobody noticed for months. */
  const worker = read('projects/training/server/worker.mjs');
  const dev = read('projects/training/server/dev.mjs');
  const paths = [...worker.match(/const PUBLIC_PATHS = new Set\(\[([^\]]*)\]/)[1]
    .matchAll(/'([a-z-]+)'/g)].map(m => m[1]);
  const regex = dev.match(/\/\^\\\/\(([a-z|]+)\)/)[1].split('|');
  const missing = paths.filter(p => !regex.includes(p));
  ok(missing.length === 0,
     'every public route is served locally too' +
     (missing.length ? ' — MISSING FROM dev.mjs: ' + missing.join(', ') : ''));
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'THE WHOLE WRITE PATH HOLDS'));
process.exit(failures ? 1 : 0);
