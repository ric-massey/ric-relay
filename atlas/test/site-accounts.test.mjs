/* Site accounts, against a REAL database: a stranger signs up and gets nothing,
 * asks, Ric approves, and the stranger gets exactly what Ric ticked.
 *
 * The static checks next door read the SQL. This one runs it, because the whole
 * point of the migration is how restrictive policies combine with permissive
 * ones already there — which only Postgres can answer. It needs the local stack:
 *
 *     cd atlas && supabase start && supabase db reset --local
 *     node atlas/test/site-accounts.test.mjs
 *
 * With no local stack it skips (CI has none), so it only ever proves anything
 * on a machine that has run the two commands above. The keys below are the
 * Supabase CLI's fixed LOCAL demo keys, the same on every machine; they open
 * nothing but a database on 127.0.0.1. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.ATLAS_LOCAL_URL || 'http://127.0.0.1:54321';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

let up = false;
try { up = (await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON } })).ok; } catch {}

const run = Date.now().toString(36);
const mail = (who) => `${who}-${run}@example.test`;
const PASS = 'correct horse battery staple';

async function call(path, { token, key = ANON, method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, ok: res.ok, json };
}

const admin = (path, opts = {}) => call(path, { ...opts, key: SERVICE, token: SERVICE });
const rpc = (fn, token, args = {}) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', token, body: args });
const rows = (table, token, query = 'select=*') => call(`/rest/v1/${table}?${query}`, { token });

async function makeUser(who, { invited = false } = {}) {
  // Invited accounts are created the way the dashboard does it; everybody else
  // the way the sign-up form does, which is what a stranger gets.
  if (invited) {
    // generate_link makes the same invited user without needing a mail server.
    const r = await admin('/auth/v1/admin/generate_link', { method: 'POST', body: { type: 'invite', email: mail(who) } });
    assert.ok(r.ok, `invite ${who}: ${JSON.stringify(r.json)}`);
    const id = r.json.id || (r.json.user && r.json.user.id);
    await admin(`/auth/v1/admin/users/${id}`, { method: 'PUT', body: { password: PASS, email_confirm: true } });
    return id;
  }
  const r = await admin('/auth/v1/admin/users', {
    method: 'POST', body: { email: mail(who), password: PASS, email_confirm: true },
  });
  assert.ok(r.ok, `create ${who}: ${JSON.stringify(r.json)}`);
  return r.json.id;
}

async function signIn(who) {
  const r = await call('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email: mail(who), password: PASS },
  });
  assert.ok(r.ok, `sign in ${who}: ${JSON.stringify(r.json)}`);
  return r.json.access_token;
}

async function upload(token, path, bucket = 'pin-photos') {
  const res = await fetch(`${URL_}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' },
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  });
  return res.ok;
}

test('site accounts: request, approve, per-page access', { skip: !up && 'no local Supabase on 127.0.0.1:54321' }, async (t) => {
  const ricId = await makeUser('ric');
  const made = await admin('/rest/v1/site_admins', { method: 'POST', body: { user_id: ricId } });
  assert.ok(made.ok, `make ric an admin: ${JSON.stringify(made.json)}`);
  const crewId = await makeUser('crew', { invited: true });
  const strangerId = await makeUser('stranger');

  const ric = await signIn('ric');
  const crew = await signIn('crew');
  let stranger = await signIn('stranger');

  const pin = await call('/rest/v1/pins', {
    method: 'POST', token: crew, prefer: 'return=representation',
    body: { created_by: crewId, name: 'test find', lat: 1, lng: 2 },
  });
  assert.ok(pin.ok, `an invited crew member can still drop a pin: ${JSON.stringify(pin.json)}`);
  const pinId = pin.json[0].id;

  await t.test('approved crew still do everything they did before', async () => {
    const named = await rpc('set_username', crew, { want: `crew_${run}`.slice(0, 20) });
    assert.ok(named.ok, `choose a username: ${JSON.stringify(named.json)}`);
    const note = await call('/rest/v1/pin_notes', {
      method: 'POST', token: crew, body: { pin_id: pinId, created_by: crewId, body: 'gate was open' },
    });
    assert.ok(note.ok, `leave a note: ${JSON.stringify(note.json)}`);
    const group = await call('/rest/v1/groups', {
      method: 'POST', token: crew, body: { owner: crewId, name: 'hunting' },
    });
    assert.ok(group.ok, `make a group: ${JSON.stringify(group.json)}`);
    assert.ok(await upload(crew, `${pinId}/${crewId}/a.jpg`), 'upload a pin photo');
    const own = await call(`/rest/v1/profiles?id=eq.${crewId}`, {
      method: 'PATCH', token: crew, body: { display_name: 'Crew' },
    });
    assert.ok(own.ok, 'edit own profile');
  });

  await t.test('a new account is a pending request and sees nothing of ATLAS', async () => {
    const mine = await rows('access_requests', stranger);
    assert.equal(mine.json.length, 1);
    assert.equal(mine.json[0].status, 'pending');
    assert.deepEqual((await rows('pins', stranger)).json, []);
    assert.deepEqual((await rows('pin_notes', stranger)).json, []);
    assert.deepEqual((await rows('pin_photos', stranger)).json, []);
    const profiles = (await rows('profiles', stranger, 'select=id')).json;
    assert.deepEqual(profiles.map((p) => p.id), [strangerId], 'only their own profile');
    assert.deepEqual((await rpc('people_i_can_draw', stranger)).json, [strangerId]);
    const crewName = (await rows('profiles', crew, `select=username&id=eq.${crewId}`)).json[0].username;
    assert.deepEqual((await rpc('lookup_username', stranger, { handle: crewName })).json, []);
    const claim = await rpc('set_username', stranger, { want: 'squatter' });
    assert.equal(claim.ok, false, 'cannot sit on a username');
    const drop = await call('/rest/v1/pins', {
      method: 'POST', token: stranger, body: { created_by: strangerId, name: 'x', lat: 0, lng: 0 },
    });
    assert.equal(drop.ok, false, 'cannot drop a pin');
    assert.equal(await upload(stranger, `${pinId}/${strangerId}/b.jpg`), false, 'cannot upload a photo');
    const list = await call('/storage/v1/object/list/pin-photos', {
      method: 'POST', token: stranger, body: { prefix: `${pinId}/`, limit: 10 },
    });
    assert.deepEqual(list.json, [], 'cannot list the crew photos');
    assert.equal((await rpc('has_page_access', stranger, { page: 'atlas' })).json, false);
  });

  await t.test('asking fills in the request, keeping only real pages', async () => {
    const r = await rpc('request_access', stranger, { who: 'Bob', why: 'friend of Ric', wanted: ['hermiscus', 'atlas', 'nope'] });
    assert.ok(r.ok, JSON.stringify(r.json));
    const mine = (await rows('access_requests', stranger)).json[0];
    assert.equal(mine.name, 'Bob');
    assert.deepEqual(mine.pages, ['atlas', 'hermiscus']);
  });

  await t.test('only an admin can see people or decide', async () => {
    assert.deepEqual((await rpc('admin_people', stranger)).json, []);
    assert.equal((await rpc('admin_set_access', stranger, { target: strangerId, new_status: 'approved', grant_pages: ['atlas'] })).ok, false);
    assert.equal((await rpc('admin_set_access', crew, { target: strangerId, new_status: 'approved', grant_pages: ['atlas'] })).ok, false);
    const direct = await call('/rest/v1/site_access', { method: 'POST', token: stranger, body: { user_id: strangerId, page_key: 'atlas' } });
    assert.equal(direct.ok, false, 'no granting yourself');
    const people = (await rpc('admin_people', ric)).json;
    const bob = people.find((p) => p.user_id === strangerId);
    assert.equal(bob.status, 'pending');
    assert.equal(bob.name, 'Bob');
    assert.equal(people.find((p) => p.user_id === crewId).status, 'approved', 'invited crew arrive approved');
  });

  await t.test('approving for HERMISCUS only opens HERMISCUS', async () => {
    const r = await rpc('admin_set_access', ric, { target: strangerId, new_status: 'approved', grant_pages: ['hermiscus'] });
    assert.ok(r.ok, JSON.stringify(r.json));
    assert.equal((await rpc('has_page_access', stranger, { page: 'hermiscus' })).json, true);
    assert.equal((await rpc('has_page_access', stranger, { page: 'atlas' })).json, false);
    assert.deepEqual((await rows('pins', stranger)).json, []);
  });

  await t.test('somebody already let in can ask for more, and keeps what they have meanwhile', async () => {
    const r = await rpc('request_access', stranger, { who: '', why: 'could I see the map too?', wanted: ['atlas'] });
    assert.ok(r.ok, JSON.stringify(r.json));
    const mine = (await rows('access_requests', stranger)).json[0];
    assert.equal(mine.status, 'pending');
    assert.deepEqual(mine.pages, ['atlas']);
    assert.equal(mine.name, 'Bob', 'an empty name does not wipe the one given before');
    assert.equal((await rpc('has_page_access', stranger, { page: 'hermiscus' })).json, true, 'still has HERMISCUS while waiting');
    const bob = (await rpc('admin_people', ric)).json.find((p) => p.user_id === strangerId);
    assert.equal(bob.status, 'pending');
    assert.deepEqual(bob.pages, ['hermiscus']);
    assert.deepEqual(bob.requested, ['atlas']);
  });

  await t.test('adding ATLAS opens the map — and only what somebody shares', async () => {
    await rpc('admin_set_access', ric, { target: strangerId, new_status: 'approved', grant_pages: ['hermiscus', 'atlas'] });
    assert.deepEqual((await rows('pins', stranger)).json, [], 'nothing is anybody\'s by default');
    assert.ok((await rpc('set_username', stranger, { want: `bob_${run}`.slice(0, 20) })).ok);
    assert.ok((await rpc('request_connection', crew, { handle: `bob_${run}`.slice(0, 20) })).ok);
    assert.ok((await rpc('accept_connection', stranger, { requester: crewId })).ok);
    const shared = await call('/rest/v1/pin_audience', {
      method: 'POST', token: crew, body: { pin_id: pinId, user_id: strangerId },
    });
    assert.ok(shared.ok, JSON.stringify(shared.json));
    const pins = (await rows('pins', stranger)).json;
    assert.ok(pins.some((p) => p.id === pinId), 'sees the pin shared with them');
  });

  await t.test('denying takes everything back and the request cannot be reopened', async () => {
    await rpc('admin_set_access', ric, { target: strangerId, new_status: 'denied', grant_pages: ['atlas'] });
    stranger = await signIn('stranger');
    assert.deepEqual((await rows('pins', stranger)).json, []);
    assert.equal((await rpc('has_page_access', stranger, { page: 'hermiscus' })).json, false);
    await rpc('request_access', stranger, { who: 'Bob again', why: 'please', wanted: ['atlas'] });
    const mine = (await rows('access_requests', stranger)).json[0];
    assert.equal(mine.status, 'denied');
    assert.equal(mine.name, 'Bob', 'a denied request is not rewritten');
  });

  await t.test('signed out, only the page list is visible', async () => {
    assert.ok((await rows('site_pages')).json.length >= 2);
    assert.deepEqual((await rows('pins')).json, []);
    assert.equal((await rpc('has_page_access', undefined, { page: 'atlas' })).ok, false);
    assert.equal((await rpc('admin_people')).ok, false);
  });

  await t.test('an admin opens every page without ticking it', async () => {
    assert.equal((await rpc('has_page_access', ric, { page: 'hermiscus' })).json, true);
    assert.equal((await rows('pins', ric)).json.some((p) => p.id === pinId), false,
      'running the site is not reading everybody\'s pins');
  });

  // ── the 2026-10-17 bug sweep (atlas/supabase/migrations/20261017150000) ──
  const mateId = await makeUser('mate');
  const lonerId = await makeUser('loner');
  for (const id of [mateId, lonerId]) {
    await rpc('admin_set_access', ric, { target: id, new_status: 'approved', grant_pages: ['atlas'] });
  }
  const mate = await signIn('mate');
  const loner = await signIn('loner');

  await t.test('A3a-2: grouping somebody shows their name and face, never their settings', async () => {
    await call(`/rest/v1/profiles?id=eq.${mateId}`, {
      method: 'PATCH', token: mate, body: { prefs: { home: { name: 'secret town' } } },
    });
    const g = await call('/rest/v1/groups', {
      method: 'POST', token: loner, prefer: 'return=representation', body: { owner: lonerId, name: 'x' },
    });
    const early = await call('/rest/v1/group_members', {
      method: 'POST', token: loner, body: { group_id: g.json[0].id, user_id: mateId },
    });
    assert.equal(early.ok, false, 'not before you are connected');
    assert.ok((await rpc('set_username', mate, { want: `mate_${run}`.slice(0, 20) })).ok);
    assert.equal((await rpc('request_connection', loner, { handle: `mate_${run}`.slice(0, 20) })).json, 'requested');
    assert.ok((await rpc('accept_connection', mate, { requester: lonerId })).ok);
    const added = await call('/rest/v1/group_members', {
      method: 'POST', token: loner, body: { group_id: g.json[0].id, user_id: mateId },
    });
    assert.ok(added.ok, 'grouping a connection works');
    const face = await rows('profiles', loner, `select=id,display_name,avatar_path&id=eq.${mateId}`);
    assert.equal(face.json.length, 1, 'name and face are readable');
    const prefs = await rows('profiles', loner, `select=prefs&id=eq.${mateId}`);
    assert.equal(prefs.ok, false, 'prefs are not');
    const own = await rpc('my_profile', mate);
    assert.equal(own.json[0].prefs.home.name, 'secret town', 'your own come through my_profile()');
  });

  await t.test('A3a-3: being in a group reveals nobody you did not already know', async () => {
    // A group can only hold somebody connected to its owner, so the person who
    // filed you is somebody you said yes to. Nobody else is drawn because of it.
    const drawn = (await rpc('people_i_can_draw', mate)).json;
    assert.equal(drawn.includes(crewId), false);
  });

  await t.test('A3a-2: the avatars bucket is not a roster', async () => {
    assert.ok(await upload(loner, `${lonerId}/a.jpg`, 'avatars'), 'own avatar uploads');
    const list = await call('/storage/v1/object/list/avatars', {
      method: 'POST', token: crew, body: { prefix: '', limit: 100 },
    });
    assert.equal((list.json || []).some((o) => o.name === lonerId), false,
      'a stranger\'s folder is not listed');
  });

  await t.test('A3a-7: sizes are bounded', async () => {
    const big = await call(`/rest/v1/profiles?id=eq.${mateId}`, {
      method: 'PATCH', token: mate, body: { display_name: 'x'.repeat(500) },
    });
    assert.equal(big.ok, false);
  });

  await t.test('A3a-8: a pin with parking cannot itself become parking', async () => {
    const mk = async (body) => (await call('/rest/v1/pins', {
      method: 'POST', token: crew, prefer: 'return=representation',
      body: { created_by: crewId, lat: 1, lng: 1, ...body },
    })).json[0].id;
    const a = await mk({ name: 'a' });
    await mk({ name: 'park', parent_id: a });
    const c = await mk({ name: 'c' });
    const moved = await call(`/rest/v1/pins?id=eq.${a}`, {
      method: 'PATCH', token: crew, body: { parent_id: c },
    });
    assert.equal(moved.ok, false);
  });

  await t.test('A3b lead: a photo row names its own object only', async () => {
    const r = await call('/rest/v1/pin_photos', {
      method: 'POST', token: mate,
      body: { pin_id: pinId, created_by: mateId, path: `${pinId}/${crewId}/a.jpg` },
    });
    assert.equal(r.ok, false);
  });

  await t.test('A3a-1: a county someone adds reaches nobody else until Ric approves it', async () => {
    const src = { label: 'Elk County, NV', url: 'https://example.test/x/MapServer/0', owner_field: 'OWNER' };
    const theirs = await call('/rest/v1/parcel_sources', {
      method: 'POST', token: crew, prefer: 'return=representation',
      body: { ...src, created_by: crewId, approved: true },
    });
    assert.ok(theirs.ok, JSON.stringify(theirs.json));
    assert.equal(theirs.json[0].approved, false, 'cannot approve your own');
    assert.equal((await rows('parcel_sources', mate, `select=id&id=eq.${theirs.json[0].id}`)).json.length, 0);
    const ok = await call(`/rest/v1/parcel_sources?id=eq.${theirs.json[0].id}`, {
      method: 'PATCH', token: ric, body: { approved: true },
    });
    assert.ok(ok.ok);
    assert.equal((await rows('parcel_sources', mate, `select=id&id=eq.${theirs.json[0].id}`)).json.length, 1);
    const moved = await call(`/rest/v1/parcel_sources?id=eq.${theirs.json[0].id}`, {
      method: 'PATCH', token: crew, prefer: 'return=representation', body: { url: 'https://evil.test/x/MapServer/0' },
    });
    assert.equal(moved.json[0].approved, false, 'pointing it somewhere else takes the approval away');
  });

  await t.test('A3a-4: a deleted account\'s username is never handed out again', async () => {
    const name = `loner_${run}`.slice(0, 20);
    assert.ok((await rpc('set_username', loner, { want: name })).ok);
    const del = await admin(`/auth/v1/admin/users/${lonerId}`, { method: 'DELETE' });
    assert.ok(del.ok, JSON.stringify(del.json));
    const claim = await rpc('set_username', mate, { want: name });
    assert.equal(claim.ok, false);
  });
  // ── connections and pin audiences (20261022120000_connections_and_audiences) ──
  const ids = {};
  const tok = {};
  const handle = (who) => `${who}_${run}`.slice(0, 20);
  for (const who of ['al', 'bo', 'cy', 'di']) {
    ids[who] = await makeUser(who);
    await rpc('admin_set_access', ric, { target: ids[who], new_status: 'approved', grant_pages: ['atlas'] });
    tok[who] = await signIn(who);
    await rpc('set_username', tok[who], { want: handle(who) });
  }
  const connect = async (from, to) => {
    await rpc('request_connection', tok[from], { handle: handle(to) });
    return rpc('accept_connection', tok[to], { requester: ids[from] });
  };
  const seen = async (who, id) => (await rows('pins', tok[who], `select=id&id=eq.${id}`)).json.length === 1;
  const drop = async (who, body = {}) => {
    const r = await call('/rest/v1/pins', {
      method: 'POST', token: tok[who], prefer: 'return=representation',
      body: { created_by: ids[who], name: 'spot', lat: 1, lng: 1, ...body },
    });
    assert.ok(r.ok, JSON.stringify(r.json));
    return r.json[0].id;
  };
  const grant = (who, body) => call('/rest/v1/pin_audience', { method: 'POST', token: tok[who], body });

  await t.test('asking is by exact username, and only for people on ATLAS', async () => {
    assert.equal((await rpc('request_connection', tok.al, { handle: 'nobody_here_at_all' })).json, 'nobody');
    const strangerName = (await rows('profiles', tok.al, `select=username&id=eq.${strangerId}`)).json;
    assert.deepEqual(strangerName, [], 'a denied account is not drawable');
    assert.equal((await rpc('request_connection', tok.al, { handle: `bob_${run}`.slice(0, 20) })).json, 'nobody',
      'an account without ATLAS is nobody, the same answer as a name nobody wears');
    assert.equal((await rpc('request_connection', tok.al, { handle: handle('al') })).ok, false, 'not yourself');
    assert.equal((await rpc('request_connection', tok.al, { handle: handle('al').toUpperCase() + ' ' })).ok, false, 'not yourself, however it is typed');
    const asked = await rpc('request_connection', tok.al, { handle: ` ${handle('bo').toUpperCase()}` });
    assert.equal(asked.json, 'requested', JSON.stringify(asked.json));
    assert.equal((await rpc('request_connection', tok.al, { handle: handle('bo') })).json, 'requested', 'asking twice is one ask');
    const theirs = (await rows('connection_requests', tok.bo)).json;
    assert.equal(theirs.length, 1);
    assert.equal(theirs[0].from_id, ids.al);
    assert.deepEqual((await rows('connection_requests', tok.cy)).json, [], 'nobody else sees it');
    assert.ok((await rpc('people_i_can_draw', tok.bo)).json.includes(ids.al), 'the asker has a face');
  });

  await t.test('nothing about a connection is written by hand', async () => {
    const lo = ids.cy < ids.di ? ids.cy : ids.di;
    const hi = ids.cy < ids.di ? ids.di : ids.cy;
    const direct = await call('/rest/v1/connections', { method: 'POST', token: tok.cy, body: { a: lo, b: hi } });
    assert.equal(direct.ok, false, 'no connecting yourself to somebody');
    const req = await call('/rest/v1/connection_requests', {
      method: 'POST', token: tok.cy, body: { from_id: ids.cy, to_id: ids.di },
    });
    assert.equal(req.ok, false, 'a request goes in by username only, never by id');
    assert.equal((await rpc('accept_connection', tok.cy, { requester: ids.al })).ok, false,
      'you cannot accept a request addressed to somebody else');
  });

  await t.test('saying yes connects you both; asking back is a yes too', async () => {
    assert.ok((await rpc('accept_connection', tok.bo, { requester: ids.al })).ok);
    assert.equal((await rows('connections', tok.al)).json.length, 1);
    assert.equal((await rows('connections', tok.bo)).json.length, 1);
    assert.deepEqual((await rows('connection_requests', tok.bo)).json, [], 'the request is gone');
    assert.equal((await rpc('request_connection', tok.al, { handle: handle('bo') })).json, 'already');
    await rpc('request_connection', tok.cy, { handle: handle('al') });
    assert.equal((await rpc('request_connection', tok.al, { handle: handle('cy') })).json, 'connected');
  });

  await t.test('a new pin is nobody\'s but yours', async () => {
    const p = await drop('al');
    assert.equal(await seen('al', p), true);
    assert.equal(await seen('bo', p), false, 'not even a connection');
    assert.equal((await rpc('can_see_pin', tok.bo, { p_id: p })).json, false);
  });

  await t.test('sharing with a person, and only with a connection', async () => {
    const p = await drop('al');
    assert.equal((await grant('al', { pin_id: p, user_id: ids.di })).ok, false, 'di is not a connection');
    assert.ok((await grant('al', { pin_id: p, user_id: ids.bo })).ok);
    assert.equal(await seen('bo', p), true);
    assert.equal(await seen('di', p), false);
    const note = await call('/rest/v1/pin_notes', {
      method: 'POST', token: tok.bo, body: { pin_id: p, created_by: ids.bo, body: 'went Tuesday' },
    });
    assert.ok(note.ok, 'notes are everybody\'s who can see it');
    assert.equal((await grant('bo', { pin_id: p, user_id: ids.al })).ok, false,
      'seeing a pin is not sharing it — only the finder widens it');
    const people = (await rpc('pin_audience_people', tok.bo, { p_id: p })).json.map((x) => x.id).sort();
    assert.deepEqual(people, [ids.al, ids.bo].sort(), 'the finder and the audience');
    assert.deepEqual((await rpc('pin_audience_people', tok.di, { p_id: p })).json, [], 'an outsider learns nothing');
    const un = await call(`/rest/v1/pin_audience?pin_id=eq.${p}&user_id=eq.${ids.bo}`, { method: 'DELETE', token: tok.al });
    assert.ok(un.ok);
    assert.equal(await seen('bo', p), false, 'unsharing is immediate');
  });

  await t.test('sharing with a group: members see it, and never the group', async () => {
    const g = await call('/rest/v1/groups', {
      method: 'POST', token: tok.al, prefer: 'return=representation', body: { owner: ids.al, name: 'climbers' },
    });
    const gid = g.json[0].id;
    for (const who of ['bo', 'cy']) {
      const r = await call('/rest/v1/group_members', { method: 'POST', token: tok.al, body: { group_id: gid, user_id: ids[who] } });
      assert.ok(r.ok, JSON.stringify(r.json));
    }
    const p = await drop('al');
    const other = await call('/rest/v1/groups', {
      method: 'POST', token: tok.bo, prefer: 'return=representation', body: { owner: ids.bo, name: 'mine' },
    });
    assert.equal((await grant('al', { pin_id: p, group_id: other.json[0].id })).ok, false, 'not somebody else\'s group');
    assert.ok((await grant('al', { pin_id: p, group_id: gid })).ok);
    assert.equal(await seen('bo', p), true);
    assert.equal(await seen('cy', p), true);
    assert.equal(await seen('di', p), false);
    assert.deepEqual((await rows('groups', tok.bo, `select=id&id=eq.${gid}`)).json, [], 'the group stays its owner\'s');
    assert.ok((await rpc('people_i_can_draw', tok.bo)).json.includes(ids.cy), 'co-visible people have faces');
    const people = (await rpc('pin_audience_people', tok.cy, { p_id: p })).json;
    assert.deepEqual(people.map((x) => x.id).sort(), [ids.al, ids.bo, ids.cy].sort());
    assert.deepEqual(Object.keys(people[0]).sort(), ['avatar_path', 'display_name', 'id', 'username']);
    const del = await call(`/rest/v1/groups?id=eq.${gid}`, { method: 'DELETE', token: tok.al });
    assert.ok(del.ok);
    assert.equal(await seen('bo', p), false, 'deleting the group narrows every pin it was on');
  });

  await t.test('a parking spot is seen exactly when its pin is', async () => {
    const p = await drop('al');
    const park = await drop('al', { parent_id: p, name: 'park' });
    assert.equal((await grant('al', { pin_id: park, user_id: ids.bo })).ok, false, 'a parking spot carries no grants');
    assert.equal(await seen('bo', park), false);
    assert.ok((await grant('al', { pin_id: p, user_id: ids.bo })).ok);
    assert.equal(await seen('bo', park), true);
  });

  await t.test('ending a connection takes back everything it allowed', async () => {
    const g = await call('/rest/v1/groups', {
      method: 'POST', token: tok.al, prefer: 'return=representation', body: { owner: ids.al, name: 'later' },
    });
    await call('/rest/v1/group_members', { method: 'POST', token: tok.al, body: { group_id: g.json[0].id, user_id: ids.cy } });
    const p1 = await drop('al');
    const p2 = await drop('al');
    await grant('al', { pin_id: p1, user_id: ids.cy });
    await grant('al', { pin_id: p2, group_id: g.json[0].id });
    assert.equal(await seen('cy', p1), true);
    assert.equal(await seen('cy', p2), true);
    const lo = ids.al < ids.cy ? ids.al : ids.cy;
    const hi = ids.al < ids.cy ? ids.cy : ids.al;
    const end = await call(`/rest/v1/connections?a=eq.${lo}&b=eq.${hi}`, { method: 'DELETE', token: tok.cy });
    assert.ok(end.ok);
    assert.equal(await seen('cy', p1), false);
    assert.equal(await seen('cy', p2), false, 'out of the group as well');
    assert.deepEqual((await rows('group_members', tok.al, `select=user_id&group_id=eq.${g.json[0].id}`)).json, []);
  });

  await t.test('an old app that still writes is_private fails loudly', async () => {
    const r = await call('/rest/v1/pins', {
      method: 'POST', token: tok.al, body: { created_by: ids.al, name: 'old', lat: 0, lng: 0, is_private: false },
    });
    assert.equal(r.ok, false);
  });
});
