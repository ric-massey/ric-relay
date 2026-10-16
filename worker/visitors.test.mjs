/* The visitor counter: what /hit keeps, what it refuses, and what /stats adds
   up — against the real Worker routing and a real SQLite (d1-memory.mjs).

       node worker/visitors.test.mjs */

import assert from 'node:assert/strict';
import worker, { TrainingLog } from './worker.mjs';
import { memoryD1, haveSqlite } from './d1-memory.mjs';
import { cleanPath, cleanRef, cleanTag, describeAgent, rangeStart, isSiteAdmin } from './visitors.mjs';

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
  const hit = (body, { origin = ORIGIN, ua = UA, country = 'US', region = 'Kentucky', city = 'Lexington' } = {}) => {
    const req = new Request('https://w/hit', {
      method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'content-type': 'text/plain', origin, 'user-agent': ua }
    });
    Object.defineProperty(req, 'cf', { value: { country, region, city, latitude: '38.04', longitude: '-84.50', postalCode: '40502' } });
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

const P1 = 'pppppppp-1111-4111-8111-111111111111';
const P2 = 'pppppppp-2222-4222-8222-222222222222';

await test('the richer row: language, screen, campaign, place — and still no coordinates', async () => {
  const { env, hit } = setup();
  await hit({ v: V1, s: S1, i: P1, f: true, p: '/', r: 'instagram.com', l: 'en', w: 'S', u: 'Insta_Story', c: 'oct', k: 'view' });
  const row = env.STATS.raw.prepare('SELECT * FROM views').get();
  assert.equal(row.lang, 'en');
  assert.equal(row.screen, 'S');
  assert.equal(row.src, 'insta_story');
  assert.equal(row.camp, 'oct');
  assert.equal(row.region, 'Kentucky');
  assert.equal(row.city, 'Lexington');
  const all = JSON.stringify(env.STATS.raw.prepare('SELECT * FROM views').all());
  for (const leak of ['38.04', '-84.50', '40502']) assert.ok(!all.includes(leak), leak);
  assert.equal(cleanTag('<b>hi</b>'), '');
  assert.equal(cleanTag('Newsletter-1'), 'newsletter-1');
  /* Junk in the new fields is dropped, not stored. */
  await hit({ v: V1, s: S1, i: 'x', p: '/cs.html', l: 'english<script>', w: 'HUGE', k: 'view' });
  const r2 = env.STATS.raw.prepare("SELECT * FROM views WHERE path = '/cs.html'").get();
  assert.deepEqual([r2.vid, r2.lang, r2.screen], ['', '', '']);
});

await test('heartbeats and leaving record time on page and scroll, only growing', async () => {
  const { env, hit } = setup();
  await hit({ v: V1, s: S1, i: P1, f: true, p: '/', k: 'view' });
  await hit({ v: V1, s: S1, i: P1, p: '/', t: 60, d: 40, k: 'ping' });
  await hit({ v: V1, s: S1, i: P1, p: '/', t: 30, d: 90, k: 'leave' });
  await hit({ v: V1, s: S1, i: P1, p: '/', t: 999999, d: 500, k: 'leave' });
  /* Somebody else's id cannot move this view. */
  await hit({ v: V2, s: S3, i: P1, p: '/', t: 5, d: 5, k: 'leave' });
  const row = env.STATS.raw.prepare('SELECT dur, depth FROM views').get();
  assert.deepEqual({ ...row }, { dur: 1800, depth: 100 });
  /* Leaving is not presence: V2 never viewed anything and is not online. */
  assert.equal(env.STATS.raw.prepare('SELECT COUNT(*) AS n FROM live WHERE visitor = ?').get(V2).n, 0);
});

await test('a link out keeps the site it went to, nothing more', async () => {
  const { env, hit } = setup();
  await hit({ v: V1, s: S1, p: '/orrin.html', o: 'https://github.com/ric-massey/orrin_v3?tab=x', k: 'out' });
  await hit({ v: V1, s: S1, p: '/orrin.html', o: 'javascript:alert(1)', k: 'out' });
  assert.deepEqual(env.STATS.raw.prepare('SELECT path, host FROM outs').all().map(r => ({ ...r })), [{ path: '/orrin.html', host: 'github.com' }]);
});

await test('a database made before the new columns is brought up to date', async () => {
  const { env, hit } = setup();
  env.STATS.raw.exec(`CREATE TABLE views (id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, visitor TEXT NOT NULL, session TEXT NOT NULL,
    first INTEGER NOT NULL DEFAULT 0, path TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
    browser TEXT NOT NULL DEFAULT '', os TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '')`);
  env.STATS.raw.prepare("INSERT INTO views (ts, visitor, session, path) VALUES (?, ?, ?, '/old')").run(Date.now(), V2, S3);
  await hit({ v: V1, s: S1, i: P1, f: true, p: '/', l: 'fr', k: 'view' });
  const rows = env.STATS.raw.prepare('SELECT path, lang, dur FROM views ORDER BY id').all().map(r => ({ ...r }));
  assert.deepEqual(rows, [{ path: '/old', lang: '', dur: 0 }, { path: '/', lang: 'fr', dur: 0 }]);
});

await test('full=1 adds engagement, flows, places, sessions and the rest', async () => {
  const { hit, stats } = setup();
  await hit({ v: V1, s: S1, i: P1, f: true, p: '/', r: 'google.com', l: 'en', w: 'L', k: 'view' });
  await hit({ v: V1, s: S1, i: P1, p: '/', t: 20, d: 50, k: 'leave' });
  await hit({ v: V1, s: S1, i: P2, p: '/cs.html', k: 'view' });
  await hit({ v: V1, s: S1, i: P2, p: '/cs.html', t: 40, d: 100, k: 'leave' });
  await hit({ v: V1, s: S1, p: '/cs.html', o: 'steamcommunity.com', k: 'out' });
  await hit({ v: V1, s: S2, f: true, p: '/', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/climbing.html', u: 'family', k: 'view' }, { country: 'CA', region: 'Ontario', city: 'Toronto' });
  const plain = await (await stats()).json();
  assert.equal(plain.more, undefined);
  const { more } = await (await stats('range=30d&tz=-240&full=1')).json();
  assert.equal(more.engagement.sessions, 3);
  assert.equal(more.engagement.bounces, 2);
  assert.equal(more.engagement.pageSeconds, 30);
  const home = more.pages.find(p => p.path === '/');
  assert.deepEqual([home.views, home.entries, home.exits, home.bounces, home.dur, home.depth], [2, 2, 1, 1, 20, 50]);
  assert.deepEqual(more.flows, [['/', '/cs.html', 1]]);
  assert.equal(more.heat.reduce((a, x) => a + x[2], 0), 4);
  assert.deepEqual(more.places.find(p => p[0] === 'CA'), ['CA', 'Ontario', 'Toronto', 1]);
  assert.deepEqual(more.campaigns, [['family', '', 1]]);
  assert.deepEqual(more.outbound, [['steamcommunity.com', 1, 1]]);
  assert.deepEqual(more.loyalty, [[1, 1], [2, 1]]);
  assert.equal(more.regulars[0].visitor, V1);
  assert.equal(more.regulars[0].sessions, 2);
  const s1 = more.sessions.find(x => x.session === S1);
  assert.deepEqual(s1.pages.map(p => p[0]), ['/', '/cs.html']);
  assert.equal(s1.dur, 60);
  assert.equal(s1.ref, 'google.com');
  assert.deepEqual(s1.outs, ['steamcommunity.com']);
  assert.equal(more.sessions.find(x => x.session === S2).returning, true);
});

await test('one visitor\'s history, owner only', async () => {
  const { call, hit } = setup();
  await hit({ v: V1, s: S1, i: P1, f: true, p: '/', k: 'view' });
  await hit({ v: V1, s: S2, f: true, p: '/cs.html', k: 'view' });
  assert.equal((await call('/stats/visitor?id=' + V1)).status, 401);
  const auth = { headers: { authorization: 'Bearer ' + TOKEN } };
  assert.equal((await call('/stats/visitor?id=nope', auth)).status, 400);
  const d = await (await call('/stats/visitor?id=' + V1, auth)).json();
  assert.equal(d.sessions, 2);
  assert.equal(d.history.length, 2);
  assert.equal(d.history[0].pages[0][0], '/cs.html');
});

await test('the admin page gets in with an admin\'s site session, and nobody else does', async () => {
  const env = { SITE_SUPABASE_URL: 'https://proj.supabase.co', SITE_SUPABASE_KEY: 'sb_publishable_x' };
  const asked = [];
  const supa = async (url, init) => {
    asked.push([url, init.headers.authorization]);
    return new Response(JSON.stringify(init.headers.authorization === 'Bearer admin-jwt'), { status: 200 });
  };
  assert.equal(await isSiteAdmin('admin-jwt', env, supa), true);
  assert.equal(await isSiteAdmin('admin-jwt', env, supa), true);       // remembered for a minute
  assert.equal(asked.length, 1);
  assert.equal(asked[0][0], 'https://proj.supabase.co/rest/v1/rpc/is_site_admin');
  assert.equal(await isSiteAdmin('member-jwt', env, supa), false);
  assert.equal(await isSiteAdmin('', env, supa), false);
  assert.equal(await isSiteAdmin('admin-jwt-2', {}, supa), false);    // not configured: door shut
  assert.equal(await isSiteAdmin('x', env, async () => { throw new Error('down'); }), false);
  /* Through the Worker: a session header never reaches the password throttle,
     and a refused one is a 401 like any other. */
  const { env: wenv, call } = setup();
  Object.assign(wenv, env);
  const real = globalThis.fetch;
  globalThis.fetch = supa;
  try {
    assert.equal((await call('/stats?full=1', { headers: { 'x-admin-session': 'admin-jwt' } })).status, 200);
    assert.equal((await call('/stats', { headers: { 'x-admin-session': 'member-jwt' } })).status, 401);
  } finally { globalThis.fetch = real; }
});

await test('filters narrow to the visits that match, and two filters mean both', async () => {
  const { hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', r: 'google.com', k: 'view' });
  await hit({ v: V1, s: S1, p: '/cs.html', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/cs.html', r: 'instagram.com', k: 'view' }, { country: 'CA' });
  await hit({ v: V2, s: S2, f: true, p: '/climbing.html', k: 'view' }, { country: 'CA' });
  const get = async qs => (await (await stats('range=30d&tz=0&full=1&' + qs)).json());
  /* Saw /cs.html: both visits that did, whole — their other pages included. */
  let d = await get('path=' + encodeURIComponent('/cs.html'));
  assert.deepEqual(d.total, { visitors: 2, sessions: 2, views: 3, newVisitors: 2 });
  assert.deepEqual(d.more.filters, { path: '/cs.html' });
  /* Came from Google (any of its hosts), or straight in. */
  d = await get('ref=' + encodeURIComponent('google.com,google.ca'));
  assert.equal(d.total.sessions, 1);
  d = await get('ref=');
  assert.equal(d.total.sessions, 1);
  assert.equal(d.more.sessions[0].session, S2);
  /* Both: Canada AND saw /cs.html. */
  d = await get('country=CA&path=' + encodeURIComponent('/cs.html'));
  assert.equal(d.total.sessions, 1);
  assert.equal(d.more.sessions[0].session, S3);
  /* Junk filter names are ignored, never spliced into SQL. */
  d = await get('path%3D1%20OR%201=1');
  assert.equal(d.total.sessions, 3);
  d = await get("country=" + encodeURIComponent("US' OR '1'='1"));
  assert.equal(d.total.sessions, 0);
});

await test('the same stretch one period back comes alongside, and "since you last looked"', async () => {
  const { env, hit, stats } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/', k: 'view' });
  await hit({ v: V2, s: S3, f: true, p: '/cs.html', k: 'view' });
  /* Move V1's visit back eight days: last week, not this one. */
  env.STATS.raw.prepare('UPDATE views SET ts = ts - 8 * 86400000 WHERE visitor = ?').run(V1);
  const seen = Date.now() - 60000;
  const d = await (await stats('range=7d&tz=0&full=1&seen=' + seen)).json();
  assert.equal(d.total.visitors, 1);
  assert.equal(d.more.prev.visitors, 1);
  assert.deepEqual(d.more.prev.pages, [['/', 1]]);
  assert.equal(d.more.since.views, 1);
  assert.equal(d.more.since.newVisitors, 1);
  const all = await (await stats('range=all&tz=0&full=1')).json();
  assert.equal(all.more.prev, null);
  assert.equal(all.more.since, null);
});

await test('/stats/live answers who is here without reading the views', async () => {
  const { call, hit } = setup();
  await hit({ v: V1, s: S1, f: true, p: '/cs.html', k: 'view' });
  assert.equal((await call('/stats/live')).status, 401);
  const d = await (await call('/stats/live', { headers: { authorization: 'Bearer ' + TOKEN } })).json();
  assert.deepEqual(d.live, { count: 1, pages: [['/cs.html', 1]] });
});

console.log(`\n${n} passed`);
