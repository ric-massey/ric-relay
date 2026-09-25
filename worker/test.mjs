/* TRAINING log service — assertions
   ────────────────────────────────────────────────────────────────────────────
   The whole security model of the public training feed is "the Worker rejects
   writes without the token", so that claim is worth a test that runs without a
   Cloudflare account.

       node worker/test.mjs

   Exits non-zero on any failure. */

import worker, { TrainingLog } from './worker.mjs';
import { memoryBucket } from './r2-memory.mjs';

const TOKEN = 'test-token-long-enough-to-be-real';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

function fresh(extra) {
  const mem = new Map();
  return new TrainingLog({
    storage: {
      get: async k => mem.get(k),
      put: async (k, v) => { mem.set(k, v); },
      delete: async k => { mem.delete(k); },
      list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
    }
  }, { LOG_TOKEN: TOKEN, ...extra });
}

const req = (method, path, body, token) => new Request('https://x' + path, {
  method,
  headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), 'content-type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {})
});

const log = fresh();
const call = async (...a) => { const r = await log.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

console.log('\nRULE  a write without the right token changes nothing');
{
  ok((await call('POST', '/log/2026-08-16', { done: { 0: true } })).status === 401, 'no token is rejected');
  ok((await call('POST', '/log/2026-08-16', { done: { 0: true } }, 'wrong')).status === 401, 'wrong token is rejected');
  ok((await call('POST', '/log/2026-08-16', { done: { 0: true } }, TOKEN.slice(0, -1))).status === 401, 'prefix of the token is rejected');
  const after = await call('GET', '/log/2026-08-16');
  ok(Object.keys(after.body.done).length === 0, 'nothing was written by any of them');
}

console.log('\nRULE  a write with the token is stored and readable by anyone');
{
  const w = await call('POST', '/log/2026-08-16', { done: { 1: true } }, TOKEN);
  ok(w.status === 200, 'accepted');
  const r = await call('GET', '/log/2026-08-16');
  ok(r.body.done['1'] === true, 'readable without any token at all');
}

console.log('\nRULE  notes are public by default and private ones never leave');
{
  await call('POST', '/log/2026-08-17', {
    notes: [
      { id: 'a', text: 'shared note' },
      { id: 'b', text: 'PRIVATE-CANARY', public: false }
    ]
  }, TOKEN);
  const r = await call('GET', '/log/2026-08-17');
  ok(r.body.notes.length === 1, 'one of the two notes is published');
  ok(r.body.notes[0].id === 'a', 'the default-public one');
  ok(!JSON.stringify(r.body).includes('PRIVATE-CANARY'), 'the private one is absent from the whole response');
  const all = await call('GET', '/log');
  ok(!JSON.stringify(all.body).includes('PRIVATE-CANARY'), 'and absent from the full-log read too');
}

console.log('\nRULE  the owner can re-read his own private notes');
{
  /* Without this the author writes a private note, reloads, and it is gone —
     filtered by the same rule that hides it from everyone else. */
  const mine = await call('GET', '/log/2026-08-17', null, TOKEN);
  ok(mine.body.notes.length === 2, 'the token returns both notes');
  ok(JSON.stringify(mine.body).includes('PRIVATE-CANARY'), 'including the private one');
  const theirs = await call('GET', '/log/2026-08-17');
  ok(theirs.body.notes.length === 1, 'and a visitor still sees only one');

  const mineAll = await call('GET', '/log', null, TOKEN);
  ok(JSON.stringify(mineAll.body).includes('PRIVATE-CANARY'), 'full-log read honours the token too');

  const wrong = await call('GET', '/log/2026-08-17', null, 'wrong-token');
  ok(!JSON.stringify(wrong.body).includes('PRIVATE-CANARY'), 'a wrong token gets the public view, not an error');
}

console.log('\nRULE  a write echoes the owner view so nothing vanishes on save');
{
  const w = await call('POST', '/log/2026-08-19', { notes: [{ id: 'p', text: 'SECRET-ECHO', public: false }] }, TOKEN);
  ok(JSON.stringify(w.body).includes('SECRET-ECHO'), 'the POST response returns the private note to its author');
  const pub = await call('GET', '/log/2026-08-19');
  ok(!JSON.stringify(pub.body).includes('SECRET-ECHO'), 'but the public read still hides it');
}

console.log('\nRULE  two devices writing the same day do not erase each other');
{
  await call('POST', '/log/2026-08-18', { done: { 1: true } }, TOKEN);
  await call('POST', '/log/2026-08-18', { done: { 2: true } }, TOKEN);
  const r = await call('GET', '/log/2026-08-18');
  ok(r.body.done['1'] && r.body.done['2'], 'both ticks survive the merge');
}

console.log('\nRULE  the password check answers immediately and says nothing else');
{
  const good = await call('POST', '/auth', { password: TOKEN });
  ok(good.status === 200 && good.body.ok === true, 'right password is accepted');
  const bad = await call('POST', '/auth', { password: 'hunter2' });
  ok(bad.status === 401, 'wrong password is rejected');
  ok(!JSON.stringify(bad.body).includes(TOKEN.slice(0, 6)), 'the rejection leaks nothing about the real one');
  ok((await call('POST', '/auth', {})).status === 401, 'no password is rejected');
  ok((await call('GET', '/auth')).status === 405, 'auth is POST only');
}

console.log('\nRULE  climbing days are public to read and token-gated to write');
{
  const day = { area: 'Ijams Crag', routes: [{ name: 'Some Route', grade: '5.11a', outcome: 'sent' }] };
  ok((await call('POST', '/climb/2026-08-16', day)).status === 401, 'a visitor cannot add a climbing day');
  const w = await call('POST', '/climb/2026-08-16', day, TOKEN);
  ok(w.status === 200 && w.body.area === 'Ijams Crag', 'the owner can');
  const r = await call('GET', '/climb/2026-08-16');
  ok(r.body && r.body.routes.length === 1, 'and anyone can read it back');
  ok(r.body.source === 'web', 'tagged as web-added so it can be told from climbs.md');

  /* A day off a phone has to survive the trip with everything a day in
     climbs.md has: the style it went in, how many goes, the sector, the star.
     Dropping any of them here would make a web day a second-class one on every
     page that reads it, which is the thing add.html exists not to do. */
  const full = {
    area: 'Red River Gorge', region: 'PMRP', people: 'Dorcey', pitches: 3,
    md: '# 08/17/26\n-\n## Red River Gorge\n### PMRP\n#### The Shire\nGold Rush - 5.11d (redpoint, x4)',
    routes: [{
      name: 'Gold Rush', grade: '5.11d', gradeKind: 'rope', gradeRank: 47,
      styles: ['redpoint'], outcome: 'sent', repeats: 4, star: true,
      note: 'greasy', wall: 'The Shire'
    }]
  };
  const f = await call('POST', '/climb/2026-08-17', full, TOKEN);
  const fr = (await call('GET', '/climb/2026-08-17')).body.routes[0];
  ok(f.status === 200 && f.body.md.startsWith('# 08/17/26'),
    'the markdown the page would have written is kept as the record');
  ok(fr.gradeRank === 47 && fr.gradeKind === 'rope', 'the grade keeps its rank, so it can be ranked');
  ok(fr.styles[0] === 'redpoint' && fr.repeats === 4, 'the style and the number of goes survive');
  ok(fr.star === true && fr.wall === 'The Shire', 'so do the star and the sector');

  const junk = await call('POST', '/climb/2026-08-18', {
    area: 'Nowhere',
    routes: [{ name: 'X', styles: ['sandbagged', 'flash'], outcome: 'dyno', repeats: 500 }]
  }, TOKEN);
  const jr = junk.body.routes[0];
  ok(JSON.stringify(jr.styles) === '["flash"]', 'a style nobody climbs in is dropped');
  ok(jr.outcome === 'sent' && jr.repeats === 99, 'and a nonsense outcome or count is clamped, not stored');
  await call('POST', '/climb/2026-08-17', { remove: true }, TOKEN);
  await call('POST', '/climb/2026-08-18', { remove: true }, TOKEN);

  const all = await call('GET', '/climb');
  ok(!!all.body.days['2026-08-16'], 'it appears in the full climbing read');

  ok((await call('POST', '/climb/2026-08-20', { area: '' }, TOKEN)).status === 400, 'an empty day is refused');
  ok((await call('POST', '/climb/2026-08-16', { remove: true }, TOKEN)).status === 200, 'the owner can remove a mistake');
  ok((await call('GET', '/climb/2026-08-16')).body === null, 'and it is gone');
}

console.log('\nRULE  the tick list is public to read and token-gated to write');
{
  const route = { name: 'Cobra Crack', grade: '5.14b', style: 'Trad',
                  crag: 'Squamish', wall: 'Cirque of the Uncrackables', lengthFt: 100 };
  ok((await call('POST', '/todo', route)).status === 401, 'a visitor cannot add to the list');

  const w = await call('POST', '/todo', route, TOKEN);
  ok(w.status === 200 && w.body.item.id === 'cobra-crack-squamish',
     'the owner can, and the id is a slug of the name and the crag');

  const all = await call('GET', '/todo');
  ok(all.status === 200 && all.body.items['cobra-crack-squamish'].grade === '5.14b',
     'and anyone can read the list back');
  ok(all.body.items['cobra-crack-squamish'].source === 'web',
     'tagged as web-added so it can be told from todo.md');

  /* Two crags can have a route of the same name, so the crag is in the key. */
  const other = await call('POST', '/todo',
    { name: 'Cobra Crack', grade: '5.11', crag: 'Ijams Crag' }, TOKEN);
  ok(other.body.item.id === 'cobra-crack-ijams-crag', 'the same name at another crag is its own row');
  ok(Object.keys((await call('GET', '/todo')).body.items).length === 2, 'so both are on the list');

  /* Saving an edit has to land on the row it came from rather than making a
     second one — which is what a slug recomputed from an edited name would do. */
  const edit = await call('POST', '/todo/cobra-crack-squamish',
    { name: 'Cobra Crack', grade: '5.14', crag: 'Squamish' }, TOKEN);
  ok(edit.body.item.id === 'cobra-crack-squamish' && edit.body.item.grade === '5.14',
     'an edit posted to an id stays on that id');
  ok(Object.keys((await call('GET', '/todo')).body.items).length === 2, 'and does not fork the row');

  const tick = await call('POST', '/todo/cobra-crack-squamish',
    { name: 'Cobra Crack', crag: 'Squamish', done: true, result: 'redpoint' }, TOKEN);
  ok(tick.body.item.done === true && /^\d{4}-\d{2}-\d{2}$/.test(tick.body.item.tickDate),
     'ticking one dates it');
  const again = await call('POST', '/todo/cobra-crack-squamish',
    { name: 'Cobra Crack', crag: 'Squamish', done: true, tickDate: '' }, TOKEN);
  ok(again.body.item.tickDate === tick.body.item.tickDate,
     'and re-saving it does not move the day it was done on');

  ok((await call('POST', '/todo', { name: '' }, TOKEN)).status === 400, 'a nameless route is refused');
  ok((await call('POST', '/todo/cobra-crack-squamish', { remove: true }, TOKEN)).status === 200,
     'the owner can remove one');
  ok(!(await call('GET', '/todo')).body.items['cobra-crack-squamish'], 'and it is gone');
}

console.log('\nRULE  guessing gets throttled, and the throttle refuses the right password too');
{
  const t = fresh();
  const hit = async (...a) => { const r = await t.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  /* Nine wrong guesses must not lock out a correct tenth — the limit has to be
     generous enough that a typo or two costs nothing. */
  for (let i = 0; i < 9; i++) await hit('POST', '/auth', { password: 'guess' + i });
  ok((await hit('POST', '/auth', { password: TOKEN })).status === 200, 'the right password still works after 9 misses');

  const t2 = fresh();
  const hit2 = async (...a) => { const r = await t2.fetch(req(...a)); return { status: r.status, body: await r.json() }; };
  for (let i = 0; i < 10; i++) await hit2('POST', '/auth', { password: 'guess' + i });
  ok((await hit2('POST', '/auth', { password: 'guess-again' })).status === 429, 'the tenth miss closes the door on wrong guesses');

  /* THE ORACLE. This suite used to assert the opposite of the next three lines
     — "the right password still works mid-lockout" — on the argument that the
     owner must never be locked out. With that rule a script needed only to keep
     guessing through the lockout: every wrong guess got a 429 and the right one
     got a 200, so the throttle delayed nothing and the status code announced
     the hit. It was reproduced on 2026-09-24 with the token `hunter42`: guess
     43 returned 200 while the door was "closed". A throttle that examines the
     credential at all while it is tripped is not a throttle. */
  const right = await hit2('POST', '/auth', { password: TOKEN });
  const wrong = await hit2('POST', '/auth', { password: 'guess-again' });
  ok(right.status === 429, 'mid-lockout the RIGHT password is refused too');
  ok(right.status === wrong.status && JSON.stringify(right.body) === JSON.stringify(wrong.body),
     'and a right guess is indistinguishable from a wrong one');
  ok((await hit2('POST', '/log/2026-08-21', { done: { 0: true } }, TOKEN)).status === 429,
     'a write with the right token is refused unread during the lockout');
  ok((await hit2('GET', '/log/2026-08-21', null, TOKEN)).status === 429,
     'and so is a read that presents it');
  ok((await hit2('GET', '/log/2026-08-21')).status === 200,
     'while a visitor presenting nothing is not throttled at all');

  /* The lockout is five minutes, not forever: this is what keeps "anyone can
     lock Ric out" a nuisance rather than a denial of service. */
  const realNow = Date.now;
  Date.now = () => realNow() + 5 * 60 * 1000 + 1;
  try {
    ok((await hit2('POST', '/auth', { password: TOKEN })).status === 200, 'five minutes later the right password works again');
    ok((await hit2('POST', '/log/2026-08-21', { done: { 0: true } }, TOKEN)).status === 200, 'and so does a write');
  } finally { Date.now = realNow; }

  /* The write path must share the counter, or it is an unthrottled oracle. */
  const t3 = fresh();
  const hit3 = async (...a) => { const r = await t3.fetch(req(...a)); return { status: r.status, body: await r.json() }; };
  for (let i = 0; i < 10; i++) await hit3('POST', '/log/2026-08-16', { done: {} }, 'bad' + i);
  ok((await hit3('POST', '/auth', { password: 'another-guess' })).status === 429, 'bad bearer tokens count toward the same limit');
}

console.log('\nRULE  a lockout is said out loud, never served as an emptied page');
{
  /* Two wrong ways to handle the owner during a lockout, both seen here:
       - authed() returning false and the read falling through to the public
         view: a 200 with his private notes stripped, which reads as data loss;
       - the right token being examined and let through, which is the oracle
         above.
     The right shape is a 429 for anyone presenting a credential, and the
     public view, unchanged, for anyone presenting none. */
  const t = fresh();
  const hit = async (...a) => { const r = await t.fetch(req(...a)); return { status: r.status, body: await r.json() }; };
  await hit('POST', '/log/2026-08-22', { notes: [{ id: 'x', text: 'LOCKOUT-CANARY', public: false }] }, TOKEN);
  for (let i = 0; i < 12; i++) await hit('POST', '/auth', { password: 'nope' + i });
  const mine = await hit('GET', '/log/2026-08-22', null, TOKEN);
  ok(mine.status === 429, 'the owner is told he is locked out');
  ok(!JSON.stringify(mine.body).includes('LOCKOUT-CANARY') && mine.body.done === undefined,
     'and is not handed a page that looks like his notes vanished');
  const theirs = await hit('GET', '/log/2026-08-22');
  ok(theirs.status === 200 && !JSON.stringify(theirs.body).includes('LOCKOUT-CANARY'),
     'a visitor still gets the public view, without the note');
  const realNow = Date.now;
  Date.now = () => realNow() + 5 * 60 * 1000 + 1;
  try {
    const later = await hit('GET', '/log/2026-08-22', null, TOKEN);
    ok(JSON.stringify(later.body).includes('LOCKOUT-CANARY'), 'and once the window passes the owner sees his note');
  } finally { Date.now = realNow; }
}

console.log('\nRULE  malformed input is refused rather than stored');
{
  ok((await call('GET', '/log/not-a-date')).status === 400, 'bad date shape');
  ok((await call('POST', '/log', { done: {} }, TOKEN)).status === 400, 'POST with no date');
  ok((await call('GET', '/nope')).status === 404, 'unknown path');
  ok((await call('DELETE', '/log/2026-08-16', null, TOKEN)).status === 405, 'unsupported method');
}

/* ══ STRAVA ════════════════════════════════════════════════════════════════
   The auto-tick answers a webhook that ANYONE can POST to — Strava does not
   sign its events — and it reads activities that carry the exact route Ric ran.
   Those are the two things worth pinning down: a stranger's event must achieve
   nothing, and no coordinate may ever reach storage. */

const ATHLETE = 4242;

/* A day with a run session, a day with only climbing. Enough to tell "ticked
   the right thing" from "ticked something". */
const PLAN = {
  days: [
    { date: '2026-08-17', sessions: [
      { slot: 'MORNING', kind: 'body', id: 'morning-body', title: 'Morning practice' },
      { slot: 'MORNING', kind: 'run', id: 'morning-run', title: 'Long run — 7 mi' }
    ] },
    { date: '2026-08-18', sessions: [
      { slot: 'MORNING', kind: 'climb', id: 'morning-climb', title: 'Kilter pyramids' }
    ] }
  ]
};

/* A real activity as the API returns one — including the three fields that must
   never come out the other side. */
const activity = (over = {}) => ({
  id: 900001,
  name: 'Morning Run',
  sport_type: 'Run',
  type: 'Run',
  distance: 11265,
  moving_time: 3120,
  elapsed_time: 3200,
  total_elevation_gain: 88,
  start_date_local: '2026-08-17T06:12:00Z',
  athlete: { id: ATHLETE },
  average_speed: 3.61,
  max_speed: 4.9,
  average_heartrate: 152.4,
  max_heartrate: 176,
  has_heartrate: true,
  average_cadence: 84.2,
  calories: 812,
  suffer_score: 121,
  device_name: 'Garmin Forerunner 265',
  kudos_count: 4,
  pr_count: 1,
  /* Splits carry a place name in `name` on some Strava payloads and always
     carry fields nobody here reviewed. The fixture puts one of each in, so the
     copy has something to fail to copy. */
  splits_metric: [
    { split: 1, distance: 1000, elapsed_time: 296, moving_time: 293, elevation_difference: 4, average_speed: 3.41, average_heartrate: 141, pace_zone: 2, location_city: 'Knoxville' },
    { split: 2, distance: 1000, elapsed_time: 288, moving_time: 288, elevation_difference: -2, average_speed: 3.47, average_heartrate: 149, pace_zone: 2 }
  ],
  start_latlng: [35.9606, -83.9207],
  end_latlng: [35.9611, -83.9199],
  location_city: 'Knoxville',
  timezone: '(GMT-05:00) America/New_York',
  map: { id: 'a900001', polyline: 'ojqzErfhcNSKGGCCEIAIAI?QAI' },
  ...over
});

function stravaRig(opts = {}) {
  const mem = new Map();
  const calls = [];
  const activities = opts.activities || { 900001: activity() };
  let refresh = 'seed-refresh';

  const fetch_ = async (u, init) => {
    const url = String(u);
    calls.push(url);
    if (url.includes('/oauth/token')) {
      const sent = JSON.parse(init.body);
      /* Strava rotates the refresh token. Handing back a new one every time is
         the behaviour that breaks integrations which treat the secret as the
         credential, so the fake does it. */
      if (sent.refresh_token !== refresh) return new Response('{}', { status: 400 });
      refresh = 'rotated-' + calls.length;
      return Response.json({ access_token: 'access-' + calls.length, refresh_token: refresh, expires_at: 1e12 });
    }
    if (url.includes('/api/v3/activities/')) {
      const id = url.split('/').pop();
      const a = activities[id];
      /* `{ down: true }` stands in for Strava being unreachable for that id —
         a 503, which is neither "here it is" nor "gone". */
      if (a && a.down) return new Response('{}', { status: 503 });
      return a ? Response.json(a) : new Response('{}', { status: 404 });
    }
    if (url.includes('plan')) return Response.json(opts.plan || PLAN);
    return new Response('{}', { status: 404 });
  };

  const log = new TrainingLog({
    storage: {
      get: async k => mem.get(k),
      put: async (k, v) => { mem.set(k, v); },
      delete: async k => { mem.delete(k); },
      list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
    }
  }, {
    LOG_TOKEN: TOKEN,
    STRAVA_CLIENT_ID: '12345',
    STRAVA_CLIENT_SECRET: 'client-secret',
    STRAVA_REFRESH_TOKEN: 'seed-refresh',
    STRAVA_ATHLETE_ID: String(ATHLETE),
    STRAVA_VERIFY_TOKEN: 'verify-me',
    PLAN_URL: 'https://example.invalid/plan.json',
    FETCH: fetch_,
    ...(opts.env || {})
  });

  const env = {
    LOG: { idFromName: () => 'training', get: () => log },
    STRAVA_VERIFY_TOKEN: 'verify-me'
  };
  /* Through the outer Worker, so the route whitelist and the two-second
     acknowledgement are part of what is being tested. No ctx is passed, which
     makes the ingest awaited rather than backgrounded — see the note there. */
  const hit = async (method, path, body, token) => {
    const r = await worker.fetch(new Request('https://x' + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    }), env, null);
    const text = await r.text();
    let parsed = null; try { parsed = JSON.parse(text); } catch {}
    return { status: r.status, text, body: parsed, headers: r.headers };
  };
  const event = (over = {}) => hit('POST', '/strava',
    { aspect_type: 'create', object_type: 'activity', object_id: 900001, owner_id: ATHLETE, ...over });

  return { hit, event, mem, calls, activities, storage: () => mem, refreshNow: () => refresh };
}

console.log('\nRULE  a finished run ticks the session that was planned for that day');
{
  const r = stravaRig();
  const ack = await r.event();
  ok(ack.status === 200, 'the webhook is acknowledged');

  const day = await r.hit('GET', '/log/2026-08-17');
  ok(day.body.done['morning-run'] === true, 'the run session is ticked');
  ok(day.body.done['morning-body'] === undefined, 'and nothing else on the day is');
  ok(day.body.auto['morning-run'] === 'strava', 'the tick is marked as one Strava placed');

  const runs = await r.hit('GET', '/strava/2026-08-17');
  ok(runs.body.length === 1 && runs.body[0].name === 'Morning Run', 'the run itself is readable');
  ok(runs.body[0].distance === 11265, 'with the distance the page needs');
}

console.log('\nRULE  the route is published; everything else about where is still refused');
{
  /* This used to read "no coordinate ever reaches storage". Ric decided on
     2026-08-17 to publish the route so the run detail can draw a map, which
     reverses that for the polyline and only the polyline. The rest of the rule
     stands, and the point of this test is now to hold that line: a decision to
     publish the shape of a run is not a decision to publish its city. */
  const r = stravaRig();
  await r.event();
  const everything = JSON.stringify([...r.storage()]);
  ok(everything.includes('ojqzE'), 'the encoded route IS stored now, by decision');
  ok(!everything.includes('35.96'), 'but no raw start or end coordinate pair');
  ok(!everything.includes('Knoxville'), 'no city');
  ok(!everything.includes('America/New_York'), 'no timezone');

  /* Storage keeps the route; whether a given reader gets it is the next rule
     down. The owner always does, which is what proves it was stored rather
     than quietly dropped. */
  const mine = await r.hit('GET', '/strava', null, TOKEN);
  ok(mine.text.includes('ojqzE'), 'and the owner can read it back');

  const pub = await r.hit('GET', '/strava');
  ok(!pub.text.includes('35.96') && !pub.text.includes('Knoxville'),
     'a visitor still gets nothing else that says where');

  /* Refusing the whole activity would satisfy every assertion above while
     quietly shipping nothing, so say out loud that the run survived — and that
     what was dropped is the planted field, not the payload. */
  const kept = (await r.hit('GET', '/strava/2026-08-17')).body[0];
  ok(kept && kept.distance === 11265, 'the run itself is still stored');
  ok(kept.average_heartrate === 152.4 && kept.calories === 812, 'and its numbers with it');
  ok(Array.isArray(kept.splits) && kept.splits.length === 2, 'the splits are kept');
  ok(kept.splits[0].average_speed === 3.41, 'with the fields the page draws');
  ok(kept.splits[0].location_city === undefined, 'and the city planted inside a split is gone');
}

console.log('\nRULE  a run only ticks a session that actually matches it');
{
  const climbDay = stravaRig({ activities: { 900001: activity({ start_date_local: '2026-08-18T06:12:00Z' }) } });
  await climbDay.event();
  const d = await climbDay.hit('GET', '/log/2026-08-18');
  ok(Object.keys(d.body.done).length === 0, 'a run on a climbing day ticks nothing');
  ok((await climbDay.hit('GET', '/strava/2026-08-18')).body.length === 1, 'but it is still recorded and shown');

  const ride = stravaRig({ activities: { 900001: activity({ sport_type: 'Ride', type: 'Ride' }) } });
  await ride.event();
  ok(Object.keys((await ride.hit('GET', '/log/2026-08-17')).body.done).length === 0, 'a ride ticks nothing');

  /* Starting a watch by accident in a car park makes a 40-metre activity. */
  const stub = stravaRig({ activities: { 900001: activity({ distance: 120 }) } });
  await stub.event();
  ok(Object.keys((await stub.hit('GET', '/log/2026-08-17')).body.done).length === 0,
    'an accidental 120 m does not tick the long run');
}

console.log('\nRULE  a run marked private on Strava ticks its session and is not republished');
{
  /* Marking a run private is a person saying what they want. It still happened,
     so the session still ticks — but nothing about it appears on a public page,
     and its name is not even kept. */
  for (const over of [{ visibility: 'only_me' }, { visibility: 'followers_only' }, { private: true }]) {
    const r = stravaRig({ activities: { 900001: activity({ name: 'PRIVATE-RUN-CANARY', ...over }) } });
    await r.event();
    const what = JSON.stringify(over);

    ok((await r.hit('GET', '/log/2026-08-17')).body.done['morning-run'] === true,
      `${what}: the session is still ticked`);
    ok((await r.hit('GET', '/strava/2026-08-17')).body.length === 0,
      `${what}: but the run is not in the public feed`);
    ok(!JSON.stringify((await r.hit('GET', '/strava')).body).includes('PRIVATE-RUN-CANARY'),
      `${what}: and its name is nowhere in the full read`);
    ok(!JSON.stringify([...r.storage()]).includes('PRIVATE-RUN-CANARY'),
      `${what}: the name was never even stored`);
  }
}

console.log('\nRULE  a board session ticks the climbing session planned for its date');
{
  /* Kilter and Tension have no webhooks, so the Mac polls and posts the dates.
     The endpoint can tick things, so it needs the token — and it matches the
     date to a session here rather than trusting the caller to say which. */
  const r = stravaRig();
  const day = '2026-08-18';                       // a climbing day in the fixture plan

  ok((await r.hit('POST', '/board', { source: 'kilter', days: [day] })).status === 401,
     'without the token it ticks nothing');

  const res = await r.hit('POST', '/board', { source: 'kilter', days: [day] }, TOKEN);
  ok(res.status === 200, 'with the token it is accepted');
  ok(res.body.ticked.length === 1, 'and it says what it ticked');

  const log = await r.hit('GET', '/log/' + day, null, TOKEN);
  ok(log.body.done['morning-climb'] === true, 'the climbing session is ticked');
  ok(log.body.auto['morning-climb'] === 'kilter', 'and marked as the board that did it');

  /* A run session on the same plan must be left alone — only climbing. */
  const runDay = await r.hit('POST', '/board', { source: 'tension', days: ['2026-08-17'] }, TOKEN);
  ok(runDay.body.ticked.length === 0, 'a board session on a day with no climbing ticks nothing');
  ok((await r.hit('GET', '/log/2026-08-17', null, TOKEN)).body.done['morning-run'] === undefined,
     'and certainly does not tick the run');

  /* Same rule as Strava: a session Ric has already decided about is his. */
  const r2 = stravaRig();
  await r2.hit('POST', '/log/' + day, { done: { 'morning-climb': false } }, TOKEN);
  await r2.hit('POST', '/board', { source: 'kilter', days: [day] }, TOKEN);
  ok((await r2.hit('GET', '/log/' + day, null, TOKEN)).body.done['morning-climb'] === false,
     'a session he unticked stays unticked when the board sync runs again');

  ok((await r.hit('POST', '/board', { source: 'nonsense', days: [day] }, TOKEN)).status === 400,
     'an unknown source is refused');
  ok((await r.hit('GET', '/board')).status === 405, 'there is no public read on this path');
}

console.log('\nRULE  the leak guard reads the fields, not the route blob');
{
  /* A polyline is a thousand characters over an alphabet that includes every
     lowercase letter, so one will eventually contain "latlng" by chance. The
     guard used to read it and throw the whole activity away — a run vanishing
     for a coincidence in a coordinate encoding. It now reads everything but. */
  const r = stravaRig({
    activities: { 900001: activity({ map: { summary_polyline: 'ab_latlng_cd~address~ef' } }) }
  });
  await r.event();
  const kept = (await r.hit('GET', '/strava/2026-08-17', null, TOKEN)).body[0];
  ok(kept, 'the run survives a polyline that reads like a field name');
  ok(kept.route === 'ab_latlng_cd~address~ef', 'with its route intact');

  /* The planted city inside a split is still caught, which is the guard doing
     the job it was actually written for — see the leak rule above. */
}

console.log('\nRULE  the route appears five minutes after the run reaches the site');
{
  /* "I don't want them to see my location when I'm training — I'm fine if they
     know I trained at 9am today." So the time of day publishes as normal, and
     the route alone waits — counted from when the Worker took the activity in,
     not from when the run started. */
  const r = stravaRig();
  await r.event();
  const DATE = '2026-08-17';

  const pub = (await r.hit('GET', '/strava/' + DATE)).body[0];
  ok(pub, 'the run is published straight away');
  ok(pub.distance === 11265 && pub.average_heartrate === 152.4, 'with its numbers');
  ok(pub.route === undefined, 'but no route in the first five minutes');
  ok(pub.start_date_local === '2026-08-17T06:12:00Z',
     'the time of day is published as normal — that part he does not mind');

  const mine = (await r.hit('GET', '/strava/' + DATE, null, TOKEN)).body[0];
  ok(mine.route !== undefined, 'signed in, Ric sees his own route immediately');

  /* Wind the arrival stamp back six minutes — the same thing the clock does on
     its own, without the suite having to wait for it. */
  const wind = async back => {
    const list = r.storage().get('s:' + DATE);
    list[0].at = new Date(Date.now() - back).toISOString();
    r.storage().set('s:' + DATE, list);
  };
  await wind(6 * 60 * 1000);
  ok((await r.hit('GET', '/strava/' + DATE)).body[0].route !== undefined,
     'six minutes later a visitor gets the map');

  /* A rename fires a fresh webhook. The run is old; its map must not vanish. */
  await r.event({ aspect_type: 'update' });
  ok((await r.hit('GET', '/strava/' + DATE)).body[0].route !== undefined,
     'and renaming it later does not put the map back behind the hold');
}

console.log('\nRULE  a private run is withheld from the world, not from the person who ran it');
{
  /* The rule is "not republished", and it was over-applied: the filter hid a
     private run from its own author, so his weekly mileage on his own page was
     short by exactly the runs he chose not to publish. Signed in he gets the
     numbers back. The name is a different matter — it was never stored, so
     there is nothing to hand over at any authorisation level. */
  const r = stravaRig({ activities: { 900001: activity({ name: 'PRIVATE-RUN-CANARY', visibility: 'only_me' }) } });
  await r.event();

  const pub = await r.hit('GET', '/strava/2026-08-17');
  ok(pub.body.length === 0, 'a visitor still sees no private run at all');

  const mine = await r.hit('GET', '/strava/2026-08-17', null, TOKEN);
  ok(mine.body.length === 1, 'the owner gets it back');
  ok(mine.body[0].distance === 11265, 'with the distance, so his mileage is his mileage');
  ok(mine.body[0].hidden === true, 'flagged, so the page can say which runs are not public');
  ok(mine.body[0].name === undefined, 'and still no name, because none was ever stored');
  ok(!mine.text.includes('PRIVATE-RUN-CANARY'), 'the canary is nowhere in the owner read either');

  /* A shared cache holding the owner's copy would undo all of the above. */
  ok(/private|no-store/.test(mine.headers.get('cache-control') || ''),
     "the owner's copy is not cacheable by anything in the middle");
  ok(/public/.test(pub.headers.get('cache-control') || ''),
     "the visitor's copy still caches as before");

  /* Splits are the one field trim() withholds from a hidden run, so even the
     owner's copy cannot leak a per-kilometre shape into a public cache later. */
  ok(mine.body[0].splits === undefined, 'no splits are kept for a private run');
}

console.log('\nRULE  a forged webhook achieves nothing');
{
  /* The callback URL is public and unauthenticated — it has to be. What makes
     that safe is that the event body is never believed: the date, the sport and
     the distance are all read back from the API with Ric's own token. */
  const other = stravaRig();
  await other.event({ owner_id: 999 });
  ok(Object.keys((await other.hit('GET', '/log/2026-08-17')).body.done).length === 0,
    "another athlete's event is dropped before it costs an API call");
  ok(other.calls.length === 0, 'and really does not call Strava at all');

  const unknown = stravaRig();
  await unknown.event({ object_id: 5 });
  ok(Object.keys((await unknown.hit('GET', '/strava')).body.days).length === 0,
    'an id the API will not return stores nothing');

  const lie = stravaRig({ activities: { 900001: activity({ athlete: { id: 777 } }) } });
  await lie.event();
  ok(Object.keys((await lie.hit('GET', '/strava')).body.days).length === 0,
    "an activity the API says belongs to someone else is refused");

  /* A forged DELETE. Both ids it needs are public: Ric's athlete id is in his
     Strava profile URL and the activity id is in this Worker's own /strava
     feed. Until 2026-09-24 this one POST un-ticked the session and wiped the
     run without a single API call — the delete path was the one branch of
     ingest() that trusted the body. */
  const vandal = stravaRig();
  await vandal.event();
  const before = vandal.calls.length;
  ok((await vandal.hit('GET', '/log/2026-08-17')).body.done['morning-run'] === true, '(a real run is on the log)');
  await vandal.event({ aspect_type: 'delete' });
  ok((await vandal.hit('GET', '/log/2026-08-17')).body.done['morning-run'] === true,
    'a delete event for a run Strava still has does not un-tick it');
  ok((await vandal.hit('GET', '/strava/2026-08-17')).body.length === 1, 'and the run stays on the log');
  ok(vandal.calls.length === before + 1, 'having been checked against the API, once');
  /* And a delete for an id nothing was ever stored under costs no API call at
     all — the feed is public, so the ids to try are free, and each lookup is
     a slice of the Strava rate limit. */
  await vandal.event({ aspect_type: 'delete', object_id: 123456 });
  ok(vandal.calls.length === before + 1, 'a delete for an unknown id is dropped before it costs an API call');

  /* "Could not ask" is not "gone". Strava being down, or the token being
     dead, must not turn a stale delete into a deletion. */
  const deaf = stravaRig();
  await deaf.event();
  deaf.activities[900001] = { down: true };
  await deaf.event({ aspect_type: 'delete' });
  ok((await deaf.hit('GET', '/strava/2026-08-17')).body.length === 1,
    'a delete the API cannot confirm keeps the run');
}

console.log('\nRULE  the webhook endpoint gives nothing else away');
{
  const r = stravaRig();
  const good = await r.hit('GET', '/strava?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=verify-me');
  ok(good.status === 200 && good.body['hub.challenge'] === 'abc123', 'the right verify token echoes the challenge');

  const bad = await r.hit('GET', '/strava?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=wrong');
  ok(bad.status === 403, 'a wrong one is refused');
  ok(!bad.text.includes('abc123'), 'and the challenge is not echoed to it');

  ok((await r.hit('POST', '/strava/2026-08-17', { name: 'fake' })).status === 405,
    'there is no public way to write an activity');
  ok((await r.hit('POST', '/strava-ingest', { object_id: 1 })).status === 404,
    'and the internal ingest path is not reachable from outside');
}

console.log('\nRULE  deleting a run on Strava takes back its own tick and no others');
{
  const r = stravaRig();
  await r.event();
  await r.hit('POST', '/log/2026-08-17', { done: { 'morning-body': true } }, TOKEN);

  /* The activity really is gone from Strava — the rig's API 404s it — because
     a delete event is checked before it is believed. */
  delete r.activities[900001];
  await r.event({ aspect_type: 'delete' });
  const after = await r.hit('GET', '/log/2026-08-17');
  ok(after.body.done['morning-run'] === undefined, 'the auto tick is gone');
  ok(after.body.done['morning-body'] === true, "but the owner's own tick on the same day stands");
  ok((await r.hit('GET', '/strava/2026-08-17')).body.length === 0, 'and the run itself is gone');
}

console.log('\nRULE  a tick the owner has touched is his, and Strava cannot take it back');
{
  /* Ric re-ticks the same session by hand — the watch died mid-run and he said
     so himself. From that moment the tick is a human's, and a later delete on
     Strava must leave it exactly where it is. */
  const r = stravaRig();
  await r.event();
  await r.hit('POST', '/log/2026-08-17', { done: { 'morning-run': true } }, TOKEN);
  const mid = await r.hit('GET', '/log/2026-08-17');
  ok(mid.body.auto['morning-run'] === undefined, 'touching it clears the Strava mark');

  delete r.activities[900001];
  await r.event({ aspect_type: 'delete' });
  const after = await r.hit('GET', '/log/2026-08-17');
  ok(after.body.done['morning-run'] === true, 'and the tick survives the deletion');
}

console.log('\nRULE  a session unticked by hand stays unticked, however often Strava re-sends it');
{
  /* Strava fires a webhook on every edit, so renaming a run on the phone
     replays this hours later. Ric unticking a session Strava filled in is him
     saying it did not really happen — a rename must not argue with that. */
  const r = stravaRig();
  await r.event();
  await r.hit('POST', '/log/2026-08-17', { done: { 'morning-run': false } }, TOKEN);

  await r.event({ aspect_type: 'update' });
  const after = await r.hit('GET', '/log/2026-08-17');
  ok(after.body.done['morning-run'] === false, 'the untick holds');
  ok(after.body.auto['morning-run'] === undefined, 'and nothing claims Strava put it back');

  /* The same replay on a day he has never touched still ticks, or the whole
     feature would have quietly stopped working. */
  const virgin = stravaRig();
  await virgin.event({ aspect_type: 'update' });
  ok((await virgin.hit('GET', '/log/2026-08-17')).body.done['morning-run'] === true,
     'an untouched session still ticks on an update');
}

console.log('\nRULE  the rotating refresh token is kept, not the one in the secret');
{
  /* Strava says the value "can change anytime you retrieve a new access token"
     and kills the old one immediately. Treating the Cloudflare secret as the
     credential works for exactly one refresh and then breaks silently, weeks
     later, on a token that used to be fine. */
  const r = stravaRig();
  await r.event();
  const stored = r.storage().get('strava:refresh');
  ok(!!stored && stored !== 'seed-refresh', 'the rotated token is written to storage');

  /* Second activity, same object: the seed is now dead and only the stored
     token gets an access token back. */
  await r.event({ object_id: 900001, aspect_type: 'update' });
  ok((await r.hit('GET', '/strava/2026-08-17')).body.length === 1, 'the next event still works');
}

console.log('\nRULE  a Worker with no Strava secrets behaves exactly as it did before');
{
  const bare = new TrainingLog({
    storage: {
      get: async () => undefined, put: async () => {}, delete: async () => {},
      list: async () => new Map()
    }
  }, { LOG_TOKEN: TOKEN });
  const env = { LOG: { idFromName: () => 'training', get: () => bare } };
  const r = await worker.fetch(new Request('https://x/strava', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ aspect_type: 'create', object_type: 'activity', object_id: 1, owner_id: 1 })
  }), env, null);
  ok(r.status === 200, 'the webhook is still acknowledged rather than erroring');
}


/* ── /media ──
   The bytes live in R2 and are served back through this Worker, so the rules
   worth asserting are the same two the rest of the file exists for: a stranger
   cannot put anything in, and the things Ric put in are readable by everyone. */
function mediaRig() {
  const mem = new Map();
  const obj = new TrainingLog({
    storage: {
      get: async k => mem.get(k), put: async (k, v) => { mem.set(k, v); },
      delete: async k => { mem.delete(k); },
      list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
    }
  }, { LOG_TOKEN: TOKEN });
  const bucket = memoryBucket();
  const env = { LOG: { idFromName: () => 'training', get: () => obj }, MEDIA: bucket };
  return {
    bucket,
    async hit(method, path, { token, type, body, json: asJson } = {}) {
      const headers = {};
      if (token) headers.authorization = 'Bearer ' + token;
      if (type) headers['content-type'] = type;
      if (asJson) headers['content-type'] = 'application/json';
      const r = await worker.fetch(new Request('https://x' + path, {
        method, headers,
        ...(body != null ? { body: asJson ? JSON.stringify(body) : body } : {})
      }), env, null);
      return r;
    }
  };
}

const CLIP = new Uint8Array(2048).fill(7);         // stands in for a video

console.log('\nRULE  only the owner can add media, and everyone can watch it');
{
  const r = mediaRig();

  const no = await r.hit('POST', '/media/2026-08-18', { type: 'video/mp4', body: CLIP });
  ok(no.status === 401, 'an upload with no token is refused');
  const wrong = await r.hit('POST', '/media/2026-08-18', { token: 'wrong', type: 'video/mp4', body: CLIP });
  ok(wrong.status === 401, 'an upload with the wrong token is refused');
  ok(r.bucket._map.size === 0, 'neither of them stored a single byte');

  const up = await r.hit('POST', '/media/2026-08-18?name=gaia.mp4&route=Gaia&caption=first%20go',
    { token: TOKEN, type: 'video/mp4', body: CLIP });
  const rec = await up.json();
  ok(up.status === 200 && rec.ok, 'the owner\'s upload is accepted');
  ok(rec.kind === 'video' && rec.date === '2026-08-18', 'it comes back as a video on the right day');
  ok(rec.route === 'Gaia' && rec.caption === 'first go', 'the route and caption survive the round trip');

  /* The whole point of the feature: a visitor with no token sees it. */
  const seen = await (await r.hit('GET', '/media')).json();
  ok(seen.days['2026-08-18'] && seen.days['2026-08-18'].length === 1, 'a visitor can list it');
  ok(seen.days['2026-08-18'][0].path === rec.path, 'and gets the same path to play');

  const file = await r.hit('GET', rec.path);
  ok(file.status === 200, 'a visitor can fetch the bytes');
  ok((await file.arrayBuffer()).byteLength === CLIP.length, 'and gets all of them');
  ok(file.headers.get('content-type') === 'video/mp4', 'served as the type it was uploaded as');
}

console.log('\nRULE  a phone can scrub a video, which means Range has to work');
{
  const r = mediaRig();
  const up = await (await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  const part = await worker.fetch(new Request('https://x' + up.path, {
    headers: { range: 'bytes=100-199' }
  }), { LOG: { idFromName: () => 'training', get: () => null }, MEDIA: r.bucket }, null);
  ok(part.status === 206, 'a range request gets a 206 rather than the whole file');
  ok(part.headers.get('content-range') === `bytes 100-199/${CLIP.length}`, 'the range that came back is the range asked for');
  ok((await part.arrayBuffer()).byteLength === 100, 'and is exactly that many bytes');
}

console.log('\nRULE  what may be uploaded is an allowlist, not a guess');
{
  const r = mediaRig();
  const bad = await r.hit('POST', '/media/2026-08-18', { type: 'text/html', body: '<script>x</script>' });
  ok(bad.status === 401, 'an unknown type with no token is refused for the token first');
  const bad2 = await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'text/html', body: '<script>x</script>' });
  ok(bad2.status === 415, 'and refused for the type even with the token');
  ok(r.bucket._map.size === 0, 'nothing was stored either way');

  const nodate = await r.hit('POST', '/media/not-a-date', { token: TOKEN, type: 'video/mp4', body: CLIP });
  ok(nodate.status === 400, 'a date that is not a date is refused');
}

console.log('\nRULE  a caption with real punctuation in it survives R2 metadata');
{
  /* customMetadata rides in HTTP headers, so a curly apostrophe raw would be
     rejected by R2 itself. The board logbook is full of them. */
  const r = mediaRig();
  const caption = 'That One’s Good — 40°, felt easy';
  const up = await (await r.hit('POST', '/media/2026-08-18?caption=' + encodeURIComponent(caption),
    { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  ok(up.caption === caption, 'it comes straight back off the upload');
  const listed = await (await r.hit('GET', '/media/2026-08-18')).json();
  ok(listed.items[0].caption === caption, 'and again out of the listing');
}

console.log('\nRULE  a photo can be told which route it is of, after it went up');
{
  /* The bug this closes: nothing at a crag asks which route a clip is of, so
     most arrive with none — and the only fix used to be deleting the file and
     sending 74MB back up a phone connection. */
  const r = mediaRig();
  const up = await (await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  ok(up.route === '', 'it goes up with no route on it');

  const nope = await r.hit('POST', `/media/2026-08-18/${up.id}`, { json: true, body: { route: 'Gold Rush' } });
  ok(nope.status === 401, 'a stranger cannot name it');

  const named = await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { route: 'Gold Rush' } });
  ok(named.status === 200, 'the owner can');
  const listed = await (await r.hit('GET', '/media/2026-08-18')).json();
  ok(listed.items[0].route === 'Gold Rush', 'and the listing says so');

  /* The bytes are the expensive, irreplaceable half. A label must never be a
     reason to rewrite them. */
  ok(r.bucket._map.size === 1, 'one object still, not a second copy');
  const bytes = await r.hit('GET', up.path);
  ok(bytes.status === 200, 'and the file is still served');

  const fixed = await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { route: 'Tapeworm' } });
  ok(fixed.status === 200, 'a wrong route can be corrected');
  ok((await (await r.hit('GET', '/media/2026-08-18')).json()).items[0].route === 'Tapeworm', 'to the new one');

  await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { route: '' } });
  ok((await (await r.hit('GET', '/media/2026-08-18')).json()).items[0].route === '', 'and taken off again');

  const junk = await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: {} });
  ok(junk.status === 400, 'a POST that says nothing is refused rather than guessed at');
}

console.log('\nRULE  a label does not outlive the file it was on');
{
  const r = mediaRig();
  const up = await (await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { route: 'Gold Rush' } });
  await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { remove: true } });
  const after = await (await r.hit('GET', '/media/2026-08-18')).json();
  ok(!after.items.length, 'the file is gone');
  /* An id is eight random bytes, so a collision is not the worry — a label
     surviving its file is just a row nothing will ever clean up. */
  const again = await (await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  ok(again.route === '', 'and the next upload starts unnamed');
}

console.log('\nRULE  only the owner can take media down');
{
  const r = mediaRig();
  const up = await (await r.hit('POST', '/media/2026-08-18', { token: TOKEN, type: 'video/mp4', body: CLIP })).json();
  const nope = await r.hit('POST', `/media/2026-08-18/${up.id}`, { json: true, body: { remove: true } });
  ok(nope.status === 401, 'a stranger deleting is refused');
  ok(r.bucket._map.size === 1, 'and it is still there');
  const gone = await r.hit('POST', `/media/2026-08-18/${up.id}`, { token: TOKEN, json: true, body: { remove: true } });
  ok(gone.status === 200, 'the owner deleting is accepted');
  ok(r.bucket._map.size === 0, 'and it is gone');
  ok((await r.hit('GET', up.path)).status === 404, 'the bytes 404 afterwards');
}

console.log('\nRULE  a Worker with no bucket still serves every page');
{
  /* This is the state the site is in between deploying the code and creating
     the bucket, and it must not be a broken climbing page. */
  const obj = new TrainingLog({
    storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() }
  }, { LOG_TOKEN: TOKEN });
  const env = { LOG: { idFromName: () => 'training', get: () => obj } };
  const r = await worker.fetch(new Request('https://x/media'), env, null);
  const body = await r.json();
  ok(r.status === 200, 'listing media answers rather than failing');
  ok(body.configured === false && Object.keys(body.days).length === 0, 'it says there is nothing, and why');
  const up = await worker.fetch(new Request('https://x/media/2026-08-18', {
    method: 'POST', headers: { authorization: 'Bearer ' + TOKEN, 'content-type': 'video/mp4' }, body: CLIP
  }), env, null);
  ok(up.status === 503, 'an upload says the storage is not there rather than pretending it worked');
}


/* ── /movies ──
   The Entertainment room's list. It has a committed file underneath it that
   /todo does not, and that one difference is what most of these assert: a
   removal has to survive as a tombstone, or the file puts the row straight
   back on the next load. */
console.log('\nRULE  anyone can read the list, only the owner can change it');
{
  const m = fresh();
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  ok((await hit('GET', '/movies')).status === 200, 'the list reads without a token');
  ok((await hit('POST', '/movies/heat', { title: 'Heat', status: 'watched' })).status === 401,
     'a stranger cannot add a title');
  ok((await hit('POST', '/movies/heat', { title: 'Heat' }, 'wrong')).status === 401,
     'nor with the wrong token');
  ok(Object.keys((await hit('GET', '/movies')).body.items).length === 0, 'and nothing was written');

  const w = await hit('POST', '/movies/heat', { title: 'Heat', status: 'watchlist', where: 'Buy' }, TOKEN);
  ok(w.status === 200, 'the owner can');
  const got = (await hit('GET', '/movies')).body.items.heat;
  ok(got.title === 'Heat' && got.status === 'watchlist' && got.where === 'Buy', 'and it reads back whole');
}

console.log('\nRULE  moving a title to watched is an edit, not a second row');
{
  const m = fresh();
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  await hit('POST', '/movies/the-departed', { title: 'The Departed', status: 'watchlist', where: 'Buy' }, TOKEN);
  const added = (await hit('GET', '/movies')).body.items['the-departed'].added;
  await hit('POST', '/movies/the-departed', { title: 'The Departed', status: 'watched' }, TOKEN);
  const items = (await hit('GET', '/movies')).body.items;
  ok(Object.keys(items).length === 1, 'still one row');
  ok(items['the-departed'].status === 'watched', 'now watched');
  ok(items['the-departed'].added === added, 'and the date it was added did not move');
}

console.log('\nRULE  a removal is a tombstone, because a file underneath would undo a delete');
{
  const m = fresh();
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  await hit('POST', '/movies/anaconda', { title: 'Anaconda', status: 'watchlist' }, TOKEN);
  ok((await hit('POST', '/movies/anaconda', { removed: true })).status === 401, 'a stranger cannot remove');
  await hit('POST', '/movies/anaconda', { removed: true }, TOKEN);
  const row = (await hit('GET', '/movies')).body.items.anaconda;
  ok(row && row.removed === true, 'the row is still there, marked removed');
}

console.log('\nRULE  a title is required, and the slug is derived the way the page derives it');
{
  const m = fresh();
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  ok((await hit('POST', '/movies', { status: 'watched' }, TOKEN)).status === 400, 'no title is refused');
  ok((await hit('POST', '/movies', { title: '   ' }, TOKEN)).status === 400, 'and so is a blank one');

  const w = await hit('POST', '/movies', { title: 'Kiss Kiss Bang Bang', status: 'watchlist' }, TOKEN);
  ok(w.body.item.id === 'kiss-kiss-bang-bang', 'a posted title slugs itself');

  const acc = await hit('POST', '/movies', { title: 'Amélie' }, TOKEN);
  ok(acc.body.item.id === 'amelie', 'accents are folded, not dropped into an empty slug');

  const junk = await hit('POST', '/movies/x', { title: 'X', status: 'nonsense', count: 'lots', pick: 'yes' }, TOKEN);
  ok(junk.body.item.status === 'watchlist', 'an unknown status falls back to the queue');
  ok(junk.body.item.count === null, 'a non-numeric count is dropped rather than stored');
  ok(junk.body.item.pick === false, 'pick is a boolean or it is false');
}

/* ── the doorbell ──
   /movies/_pull asks GitHub to run the poster job now rather than at the top
   of the next three-hour slot. The rules worth pinning are about restraint: it
   must not ring when nothing changed, it must not record a ring that failed,
   and a film must never be able to take the route over. */

/* A GitHub that says what it was asked, and can be told to refuse. */
function fakeGitHub(reply = { ok: true, status: 204, body: '' }) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: reply.ok, status: reply.status, text: async () => reply.body };
  };
  fn.calls = calls;
  return fn;
}

console.log('\nRULE  only the owner can ring the doorbell');
{
  const gh = fakeGitHub();
  const m = fresh({ GH_TOKEN: 'gh-secret', FETCH: gh });
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  ok((await hit('POST', '/movies/_pull')).status === 401, 'a stranger cannot');
  ok((await hit('POST', '/movies/_pull', null, 'wrong')).status === 401, 'nor with the wrong token');
  ok((await hit('GET', '/movies/_pull')).status === 405, 'and it is not a GET');
  ok(gh.calls.length === 0, 'GitHub was never called');
}

console.log('\nRULE  a film cannot take the doorbell over');
{
  const gh = fakeGitHub();
  const m = fresh({ GH_TOKEN: 'gh-secret', FETCH: gh });
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  const film = await hit('POST', '/movies/pull', { title: 'Pull', status: 'watchlist' }, TOKEN);
  ok(film.status === 200 && film.body.item.id === 'pull', 'a film called Pull saves as a film');
  ok(gh.calls.length === 0, 'and saving it rang nothing');
  ok((await hit('GET', '/movies')).body.items.pull.title === 'Pull', 'it is on the list');
  ok((await hit('POST', '/movies/_pull', null, TOKEN)).body.rang === true,
     'the underscore is still the doorbell');
  ok((await hit('GET', '/movies')).body.items._pull === undefined,
     'and ringing it did not create a film');
}

console.log('\nRULE  the doorbell rings GitHub, once, for what actually changed');
{
  const gh = fakeGitHub();
  const m = fresh({ GH_TOKEN: 'gh-secret', FETCH: gh });
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  const quiet = await hit('POST', '/movies/_pull', null, TOKEN);
  ok(quiet.body.rang === false && gh.calls.length === 0, 'an empty list rings nothing');

  await hit('POST', '/movies/heat', { title: 'Heat', status: 'watchlist' }, TOKEN);
  const first = await hit('POST', '/movies/_pull', null, TOKEN);
  ok(first.body.rang === true && gh.calls.length === 1, 'a new film rings it');

  const c = gh.calls[0];
  ok(c.url === 'https://api.github.com/repos/ric-massey/ric-relay/dispatches',
     'at the repository that holds the site');
  ok(c.body.event_type === 'entertainment', 'asking for the entertainment job');
  ok(c.init.headers.authorization === 'Bearer gh-secret', 'with the GitHub token, not the log token');
  ok(!JSON.stringify(c.body).includes(TOKEN), 'and the log token is nowhere in the request');

  const again = await hit('POST', '/movies/_pull', null, TOKEN);
  ok(again.body.rang === false && gh.calls.length === 1,
     'ringing again with nothing new does not ring GitHub again');

  /* This edit lands in the same millisecond as the one above, which is the
     case an ISO timestamp cannot tell apart and a write counter can. */
  await hit('POST', '/movies/heat', { title: 'Heat', status: 'watched' }, TOKEN);
  ok((await hit('POST', '/movies/_pull', null, TOKEN)).body.rang === true && gh.calls.length === 2,
     'but a fresh edit does, even one made in the same millisecond as the ring');
}

console.log('\nRULE  a ring that failed is not remembered as done');
{
  const gh = fakeGitHub({ ok: false, status: 403, body: '{"message":"Resource not accessible by personal access token"}' });
  const m = fresh({ GH_TOKEN: 'gh-secret', FETCH: gh });
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  await hit('POST', '/movies/heat', { title: 'Heat' }, TOKEN);
  const bad = await hit('POST', '/movies/_pull', null, TOKEN);
  ok(bad.body.rang === false && bad.body.ok === false, 'it says it failed');
  ok(/403/.test(bad.body.why) && /not accessible/.test(bad.body.why),
     "and passes on GitHub's own words, which name the missing permission");
  ok(!JSON.stringify(bad.body).includes('gh-secret'), 'without ever echoing the token');
  ok((await hit('POST', '/movies/_pull', null, TOKEN)).body.rang === false && gh.calls.length === 2,
     'and tries again next time rather than counting it done');
}

console.log('\nRULE  a deploy with no GitHub token still works, quietly');
{
  const gh = fakeGitHub();
  const m = fresh({ FETCH: gh });                      // no GH_TOKEN at all
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  await hit('POST', '/movies/heat', { title: 'Heat' }, TOKEN);
  const r = await hit('POST', '/movies/_pull', null, TOKEN);
  ok(r.status === 200 && r.body.rang === false, 'the doorbell answers instead of throwing');
  ok(gh.calls.length === 0, 'and nothing was called');
  ok((await hit('GET', '/movies')).body.items.heat.title === 'Heat', 'the list is untouched');
}

console.log('\nRULE  a write is a patch — it never drops or invents a field');
{
  const m = fresh();
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  /* The committed file holds 363 films this service has never seen. An edit to
     one of them arrives as a patch for an id with no record here, which used to
     be refused outright — the page sends the title now, so it lands. */
  const first = await hit('POST', '/movies/se7en', { title: 'Se7en', status: 'watched', pick: true }, TOKEN);
  ok(first.status === 200, 'the first edit to a film only the committed file knows is accepted');

  /* The chooser's answer is the whole point of asking Ric which film it is.
     These used to be thrown away, and the pull script then re-guessed from the
     title — which is exactly the guess the chooser exists to replace. */
  const rich = await hit('POST', '/movies/sicario',
    { title: 'Sicario', status: 'watchlist', wd: 'Q17087904', tmdb: 273481, kind: 'movie', year: 2015, seen: '' }, TOKEN);
  ok(rich.body.item.tmdb === 273481 && rich.body.item.wd === 'Q17087904' && rich.body.item.year === 2015,
     'the identity Ric picked survives the write');

  const after = await hit('POST', '/movies/sicario', { title: 'Sicario', where: 'Netflix' }, TOKEN);
  ok(after.body.item.tmdb === 273481, 'and a later patch does not drop it');
  ok(after.body.item.where === 'Netflix', 'while still applying what it came to say');
  ok(after.body.item.status === 'watchlist', 'and leaving alone what it did not mention');

  /* The corruption this rule exists for: a patch that says only `pick` used to
     arrive with status defaulted, which put a film watched years ago back on
     the queue. */
  const pick = await hit('POST', '/movies/heat', { title: 'Heat', pick: true }, TOKEN);
  ok(pick.body.item.status === undefined,
     'a patch with no status gets none invented — the committed value stands');
  ok(pick.body.item.pick === true, 'and the thing it did say is stored');

  /* `note` is clamped by name; the cap is what stands behind the fields that
     ride through unrecognised, which is most of them. */
  const bad = await hit('POST', '/movies/heat', { title: 'Heat', overview: 'x'.repeat(40000) }, TOKEN);
  ok(bad.status === 413, 'a field this end does not know is still not allowed to be a megabyte');
  ok((await hit('GET', '/movies')).body.items.heat.overview === undefined, 'and it was not stored');
}

console.log('\nRULE  a favourite actor is kept, and is not filed as a film');
{
  const gh = fakeGitHub();
  const m = fresh({ GH_TOKEN: 'gh-secret', FETCH: gh });
  const hit = async (...a) => { const r = await m.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

  ok((await hit('POST', '/movies/_people', { names: ['Michael Mann'] })).status === 401,
     'a stranger cannot set one');

  const w = await hit('POST', '/movies/_people', { id: '_people', names: ['Michael Mann'] }, TOKEN);
  ok(w.status === 200, 'the owner can');
  const items = (await hit('GET', '/movies')).body.items;
  ok(items._people && items._people.names[0] === 'Michael Mann', 'it comes back under its own id');
  ok(items.people === undefined,
     'and NOT slugged to `people`, which would put a list of actors on the list of films');

  /* This is the bug this rule exists for: before reserved records were let
     through, the film shaping demanded a title, so this 400d, the page fell
     back to localStorage, and the star silently stopped following him
     between devices. */
  ok(w.body.item.title === undefined, 'a list of actors is never given a title to satisfy the film shape');

  ok((await hit('POST', '/movies/_pull', null, TOKEN)).body.rang === false && gh.calls.length === 0,
     'and starring an actor rings nothing — the pull script skips reserved ids anyway');

  ok((await hit('POST', '/movies/_people', 'not an object', TOKEN)).status === 400,
     'nonsense is still refused');
  ok((await hit('POST', '/movies/_people', { names: Array(400).fill('x'.repeat(60)) }, TOKEN)).status === 413,
     'and so is something far too big to be a list of actors');
  ok((await hit('GET', '/movies')).body.items._people.names[0] === 'Michael Mann',
     'neither of which disturbed what was already there');
}

console.log('\nRULE  the list is reachable from outside and unknown paths are not');
{
  const m = fresh();
  const env = { LOG: { idFromName: () => 'training', get: () => m } };
  const pub = await worker.fetch(new Request('https://x/movies'), env, null);
  ok(pub.status === 200, '/movies is on the public path list');
  const no = await worker.fetch(new Request('https://x/movie'), env, null);
  ok(no.status === 404, 'a near miss still 404s');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WORKER RULES PASS'));
process.exit(failures ? 1 : 0);
