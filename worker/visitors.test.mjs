/* The visitor counter: what /hit keeps, what it refuses, and what /stats adds
   up — against the real Worker routing and a real SQLite (d1-memory.mjs).

       node worker/visitors.test.mjs */

import assert from 'node:assert/strict';
import worker, { TrainingLog } from './worker.mjs';
import { memoryD1, haveSqlite } from './d1-memory.mjs';
import { cleanPath, cleanRef, describeAgent, rangeStart } from './visitors.mjs';

if (!haveSqlite) {
  console.log('SKIPPED — node:sqlite needs Node 22.13 or newer');
  process.exit(0);
}

const TOKEN = 'test-token-long-enough';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ORIGIN = 'https://ricmassey.com';

function setup({ db = true } = {}) {
  const mem = new Map();
  const log = new TrainingLog({ storage: {
    get: async k => mem.get(k), put: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); },
    list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
  } }, { LOG_TOKEN: TOKEN });
  const env = { LOG: { idFromName: () => 'training', get: () => log } };
  if (db) env.STATS = memoryD1();
  const call = (path, init = {}) => worker.fetch(new Request('https://w' + path, init), env, null);
  const hit = (body, { origin = ORIGIN, ua = UA, country = 'US' } = {}) => {
    const req = new Request('https://w/hit', {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'text/plain', origin, 'user-agent': ua }
    });
    Object.defineProperty(req, 'cf', { value: { country } });
    return worker.fetch(req, env, null);
  };
  const stats = (q = 'range=30d&tz=-240', token = TOKEN) =>
    call('/stats?' + q, { headers: token ? { authorization: 'Bearer ' + token } : {} });
  return { env, call, hit, stats };
}

const V1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const V2 = 'bbbbbbbb-2222-4222-8222-222222222222';
const S1 = 'ssssssss-1111-4111-8111-111111111111';
const S2 = 'ssssssss-2222-4222-8222-222222222222';
const S3 = 'ssssssss-3333-4333-8333-333333333333';

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok', name); };

await test('paths, referrers and agents are reduced before storing', () => {
  assert.equal(cleanPath('/cs.html?seed=12#x'), '/cs.html');
  assert.equal(cleanPath('/projects/orrin/index.html'), '/projects/orrin');
  assert.equal(cleanPath('/projects/kondrite/'), '/projects/kondrite');
  assert.equal(cleanPath('/index.html'), '/');
  assert.equal(cleanPath('nope'), null);
  assert.equal(cleanRef('https://www.google.com/search?q=ric+massey'), 'google.com');
  assert.equal(cleanRef('old.reddit.com'), 'old.reddit.com');
  assert.equal(cleanRef('<script>'), '');
  assert.deepEqual(describeAgent(UA), { device: 'mobile', browser: 'Safari', os: 'iOS' });
  assert.equal(describeAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0').browser, 'Edge');
});

await test('"today" starts at the viewer\'s midnight, not Greenwich\'s', () => {
  const now = Date.UTC(2026, 9, 15, 2, 0);           // 10pm on the 14th in Eastern (-240)
  assert.equal(rangeStart('today', now, -240), Date.UTC(2026, 9, 14, 4, 0));
  assert.equal(rangeStart('7d', now, -240), Date.UTC(2026, 9, 8, 4, 0));
  assert.equal(rangeStart('all', now, -240), 0);
});

await test('a beacon is counted, with nothing identifying kept', async () => {
  const { env, hit, stats } = setup();
  const r = await hit({ v: V1, s: S1, f: true, p: '/cs.html?key=secret', r: 'www.google.com', k: 'view' });
  assert.equal(r.status, 204);
  const row = env.STATS.raw.prepare('SELECT * FROM views').get();
  assert.equal(row.path, '/cs.html');
  assert.equal(row.ref, 'google.com');
  assert.equal(row.country, 'US');
  assert.equal(row.device, 'mobile');
  const cols = env.STATS.raw.prepare('PRAGMA table_info(views)').all().map(c => c.name);
  for (const bad of ['ip', 'ua', 'user_agent', 'query']) assert.ok(!cols.includes(bad), bad);
  assert.ok(!JSON.stringify(row).includes('secret'));
  const d = await (await stats()).json();
  assert.equal(d.total.views, 1);
  assert.equal(d.live.count, 1);
});

await test('beacons from elsewhere, from bots, or malformed are dropped quietly', async () => {
  const { env, hit } = setup();
  for (const r of [
    await hit({ v: V1, s: S1, p: '/', k: 'view' }, { origin: 'https://copy-of-the-site.example' }),
    await hit({ v: V1, s: S1, p: '/', k: 'view' }, { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' }),
    await hit({ v: 'x', s: S1, p: '/', k: 'view' }),
    await hit({ v: V1, s: S1, p: 'not-a-path', k: 'view' }),
    await hit('{not json'),
    await hit('x'.repeat(5000))
  ]) assert.equal(r.status, 204);
  /* Not one of them got far enough to even make the tables. */
  assert.equal(env.STATS.raw.prepare("SELECT name FROM sqlite_master WHERE name = 'views'").get(), undefined);
});

await test('no database: the beacon still answers, the dashboard says so', async () => {
  const { hit, stats } = setup({ db: false });
  assert.equal((await hit({ v: V1, s: S1, p: '/', k: 'view' })).status, 204);
  assert.deepEqual(await (await stats()).json(), { configured: false });
});

await test('the numbers are the owner\'s only', async () => {
  const { stats } = setup();
  assert.equal((await stats('range=30d', '')).status, 401);
  assert.equal((await stats('range=30d', 'wrong')).status, 401);
  assert.equal((await stats()).status, 200);
});

await test('visitors, sessions, views, referrers and pages add up', async () => {
  const { hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', r: 'google.com', k: 'view' });
  await hit({ v: V1, s: S1, f: false, p: '/cs.html', r: '', k: 'view' });
  await hit({ v: V1, s: S2, f: true, p: '/climbing.html', r: '', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/cs.html', r: 'reddit.com', k: 'view' }, { country: 'CA' });
  await hit({ v: V2, s: S3, p: '/cs.html', k: 'ping' });
  await hit({ v: V2, s: S3, f: false, p: '/404/missing.html', k: 'view' }, { country: 'CA' });
  const d = await (await stats()).json();
  assert.deepEqual(d.total, { visitors: 2, sessions: 3, views: 5, newVisitors: 2 });
  assert.deepEqual(d.today, { visitors: 2, sessions: 3, views: 5 });
  assert.deepEqual(d.pages[0], ['/cs.html', 2, 2]);
  /* Referrers are per session — counted on its first page only. */
  assert.deepEqual(d.referrers.sort(), [['', 1], ['google.com', 1], ['reddit.com', 1]].sort());
  assert.deepEqual(d.countries.sort(), [['CA', 1], ['US', 1]]);
  assert.equal(d.live.count, 2);
  assert.equal(d.feed.length, 5);
  assert.equal(d.series.reduce((a, r) => a + r[3], 0), 5);
  /* A ping is presence, not a page view. */
  assert.ok(!d.pages.some(p => p[1] > 2));
});

await test('"online" means the last five minutes', async () => {
  const { env, hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/cs.html', k: 'view' });
  env.STATS.raw.prepare('UPDATE live SET ts = ts - 6 * 60000 WHERE visitor = ?').run(V1);
  const d = await (await stats()).json();
  assert.deepEqual(d.live, { count: 1, pages: [['/cs.html', 1]] });
});

await test('ignoring a device takes its past visits out, and can be undone', async () => {
  const { call, hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/cs.html', k: 'view' });
  const ex = on => call('/stats/exclude', { method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ visitor: V1, on }) });
  assert.equal((await call('/stats/exclude', { method: 'POST', body: JSON.stringify({ visitor: V1 }) })).status, 401);
  assert.equal((await ex(true)).status, 200);
  let d = await (await stats('range=30d&me=' + V1)).json();
  assert.equal(d.total.visitors, 1);
  assert.equal(d.live.count, 1);
  assert.equal(d.meExcluded, true);
  await ex(false);
  d = await (await stats('range=30d&me=' + V1)).json();
  assert.equal(d.total.visitors, 2);
  assert.equal(d.meExcluded, false);
});

await test('every range answers', async () => {
  const { hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', k: 'view' });
  for (const r of ['today', '7d', '30d', '90d', 'all', 'nonsense']) {
    const d = await (await stats('range=' + r + '&tz=60')).json();
    assert.equal(d.total.views, 1, r);
  }
});

console.log(`\n${n} passed`);
