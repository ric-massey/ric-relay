/* TRAINING log service — assertions
   ────────────────────────────────────────────────────────────────────────────
   The whole security model of the public training feed is "the Worker rejects
   writes without the token", so that claim is worth a test that runs without a
   Cloudflare account.

       node projects/training/server/test.mjs

   Exits non-zero on any failure. */

import worker, { TrainingLog } from './worker.mjs';

const TOKEN = 'test-token-long-enough-to-be-real';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

function fresh() {
  const mem = new Map();
  return new TrainingLog({
    storage: {
      get: async k => mem.get(k),
      put: async (k, v) => { mem.set(k, v); },
      delete: async k => { mem.delete(k); },
      list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
    }
  }, { LOG_TOKEN: TOKEN });
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

  const all = await call('GET', '/climb');
  ok(!!all.body.days['2026-08-16'], 'it appears in the full climbing read');

  ok((await call('POST', '/climb/2026-08-20', { area: '' }, TOKEN)).status === 400, 'an empty day is refused');
  ok((await call('POST', '/climb/2026-08-16', { remove: true }, TOKEN)).status === 200, 'the owner can remove a mistake');
  ok((await call('GET', '/climb/2026-08-16')).body === null, 'and it is gone');
}

console.log('\nRULE  guessing gets throttled, and the right password still works before that');
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

  /* The throttle must never refuse a CORRECT credential. If it did, anyone
     could lock Ric out of his own site indefinitely by hammering /auth with
     rubbish — a free denial of service, in exchange for delaying a guesser who
     the counter already bounds. */
  ok((await hit2('POST', '/auth', { password: TOKEN })).status === 200, 'but the right password still works mid-lockout');
  ok((await hit2('POST', '/log/2026-08-21', { done: { 0: true } }, TOKEN)).status === 200, 'and so does a write');

  /* The write path must share the counter, or it is an unthrottled oracle. */
  const t3 = fresh();
  const hit3 = async (...a) => { const r = await t3.fetch(req(...a)); return { status: r.status, body: await r.json() }; };
  for (let i = 0; i < 10; i++) await hit3('POST', '/log/2026-08-16', { done: {} }, 'bad' + i);
  ok((await hit3('POST', '/auth', { password: 'another-guess' })).status === 429, 'bad bearer tokens count toward the same limit');
}

console.log('\nRULE  a lockout never empties the owner\'s own private notes');
{
  /* This is the bug the throttle introduced: authed() returned false while
     throttled, so an owner read fell through to the public view and returned
     200 with the private notes stripped. It reads as data loss, not a lockout. */
  const t = fresh();
  const hit = async (...a) => { const r = await t.fetch(req(...a)); return { status: r.status, body: await r.json() }; };
  await hit('POST', '/log/2026-08-22', { notes: [{ id: 'x', text: 'LOCKOUT-CANARY', public: false }] }, TOKEN);
  for (let i = 0; i < 12; i++) await hit('POST', '/auth', { password: 'nope' + i });
  const mine = await hit('GET', '/log/2026-08-22', null, TOKEN);
  ok(JSON.stringify(mine.body).includes('LOCKOUT-CANARY'), 'the owner still sees his private note during a lockout');
  const theirs = await hit('GET', '/log/2026-08-22');
  ok(!JSON.stringify(theirs.body).includes('LOCKOUT-CANARY'), 'and a visitor still does not');
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

  return { hit, event, mem, calls, storage: () => mem, refreshNow: () => refresh };
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

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WORKER RULES PASS'));
process.exit(failures ? 1 : 0);
