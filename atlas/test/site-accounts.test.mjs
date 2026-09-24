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

async function upload(token, path) {
  const res = await fetch(`${URL_}/storage/v1/object/pin-photos/${path}`, {
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
    const profiles = (await rows('profiles', stranger)).json;
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

  await t.test('adding ATLAS opens the map', async () => {
    await rpc('admin_set_access', ric, { target: strangerId, new_status: 'approved', grant_pages: ['hermiscus', 'atlas'] });
    const pins = (await rows('pins', stranger)).json;
    assert.ok(pins.some((p) => p.id === pinId), 'sees the crew pin');
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
    assert.ok((await rows('pins', ric)).json.some((p) => p.id === pinId));
  });
});
