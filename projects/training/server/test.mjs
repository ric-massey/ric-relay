/* TRAINING log service — assertions
   ────────────────────────────────────────────────────────────────────────────
   The whole security model of the public training feed is "the Worker rejects
   writes without the token", so that claim is worth a test that runs without a
   Cloudflare account.

       node projects/training/server/test.mjs

   Exits non-zero on any failure. */

import { TrainingLog } from './worker.mjs';

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

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WORKER RULES PASS'));
process.exit(failures ? 1 : 0);
