/* ORRIN status service — assertions
   ────────────────────────────────────────────────────────────────────────────
   Two claims are load-bearing and both are worth a test that runs without a
   Cloudflare account:

     1. a write without the token changes nothing, and
     2. the only half of a conversation that can ever reach the page is HIS.

   The second is the one to be paranoid about. Orrin's speech log keeps his
   reply and the `user_input` that prompted it on the SAME record, so "publish
   the speech log" is one careless spread operator away from publishing Ric's
   messages. These tests push the whole raw record at the Worker on purpose and
   assert that the other half does not come out the other side.

       node projects/orrin/server/test.mjs

   Exits non-zero on any failure. */

import { OrrinStatus } from './worker.mjs';

const TOKEN = 'test-token-long-enough-to-be-real';
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

function fresh() {
  const mem = new Map();
  return new OrrinStatus({
    storage: {
      get: async k => mem.get(k),
      put: async (k, v) => {
        if (typeof k === 'object') { for (const [kk, vv] of Object.entries(k)) mem.set(kk, vv); return; }
        mem.set(k, v);
      },
      delete: async k => { for (const key of [].concat(k)) mem.delete(key); },
      list: async ({ prefix, limit = 1000, reverse = false }) => {
        let rows = [...mem].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
        if (reverse) rows.reverse();
        return new Map(rows.slice(0, limit));
      }
    }
  }, { ORRIN_TOKEN: TOKEN });
}

const req = (method, path, body, token) => new Request('https://x' + path, {
  method,
  headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), 'content-type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {})
});

let orrin = fresh();
const call = async (...a) => { const r = await orrin.fetch(req(...a)); return { status: r.status, body: await r.json() }; };

const now = () => new Date().toISOString();
const snap = (over = {}) => ({
  runId: 'run12-c6df9f9', buildSha: 'c6df9f9', alive: true,
  cycle: 12167, startedAt: '2026-09-02T12:26:16.284745Z', ...over
});

console.log('\nRULE  a write without the right token changes nothing');
{
  ok((await call('POST', '/status', snap())).status === 401, 'no token is rejected');
  ok((await call('POST', '/status', snap(), 'wrong')).status === 401, 'wrong token is rejected');
  ok((await call('POST', '/status', snap(), TOKEN.slice(0, -1))).status === 401, 'prefix of the token is rejected');
  ok((await call('POST', '/status', snap(), TOKEN + 'x')).status === 401, 'token plus a suffix is rejected');
  const after = await call('GET', '/status');
  ok(after.body.run === null, 'nothing was written by any of them');
}

console.log('\nRULE  only his half of a conversation is ever published');
{
  orrin = fresh();
  /* The raw shape of a brain/data/speech_log.json entry, pushed whole — this is
     exactly the mistake the allowlist exists to survive. */
  await call('POST', '/status', snap({
    speech: [{
      id: '8518e87f', at: now(),
      user_input: 'RIC SAID SOMETHING PRIVATE',
      text: 'I learned something: Growth may refer to: What do you think?',
      reply: 'I learned something: Growth may refer to: What do you think?',
      tone: 'inquisitive', kind: 'share_finding',
      quality_score: 0.5, retrieval_count: 3
    }]
  }), TOKEN);

  const out = await call('GET', '/status');
  const blob = JSON.stringify(out.body);
  ok(!blob.includes('RIC SAID SOMETHING PRIVATE'), 'user_input does not reach the page');
  ok(!blob.includes('user_input'), 'the field name is not even carried');
  ok(out.body.speech.length === 1, 'his reply is published');
  ok(out.body.speech[0].text.startsWith('I learned something'), 'and it is the right text');
  ok(out.body.speech[0].quality_score === undefined, 'unlisted fields are dropped, not passed through');
  ok(out.body.speech[0].id === undefined, 'including ones that look harmless');
}

console.log('\nRULE  a snapshot is rebuilt field by field, never taken whole');
{
  orrin = fresh();
  await call('POST', '/status', snap({
    privateThoughts: 'the sealed interior',
    theoryOfMind: { ric: 'a model of a real person' },
    memory: ['an episodic record'],
    cycle: 500
  }), TOKEN);
  const blob = JSON.stringify((await call('GET', '/status')).body);
  ok(!blob.includes('sealed interior'), 'private thoughts cannot ride along');
  ok(!blob.includes('a model of a real person'), 'theory of mind cannot ride along');
  ok(!blob.includes('an episodic record'), 'memory cannot ride along');
  ok(blob.includes('500'), 'the fields that ARE listed still arrive');
}

console.log('\nRULE  a number outside its range is wrong, not unusual');
{
  orrin = fresh();
  await call('POST', '/status', snap({ cycle: -5, satisfaction: 42, rssMb: 1e12 }), TOKEN);
  const run = (await call('GET', '/status')).body.run;
  ok(run.cycle === undefined, 'a negative cycle count is refused');
  ok(run.satisfaction === undefined, 'a satisfaction of 42 is refused');
  ok(run.rssMb === undefined, 'an impossible RSS is refused');
}

console.log('\nRULE  running means he says so AND we heard from him recently');
{
  orrin = fresh();
  await call('POST', '/status', snap(), TOKEN);
  ok((await call('GET', '/status')).body.live === true, 'a fresh push from a live loop is live');

  await call('POST', '/status', snap({ alive: false }), TOKEN);
  ok((await call('GET', '/status')).body.live === false, 'a clean stop is not live even though the push just arrived');

  /* A machine unplugged mid-run leaves alive:true behind on its last push. Age
     is what catches that, so age has to be able to overrule the claim. */
  orrin = fresh();
  await call('POST', '/status', snap(), TOKEN);
  const stored = await orrin.state.storage.get('run:run12-c6df9f9');
  stored.lastSeen = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await orrin.state.storage.put('run:run12-c6df9f9', stored);
  const stale = (await call('GET', '/status')).body;
  ok(stale.live === false, 'an abandoned run stops reading as alive');
  ok(stale.staleFor > 5 * 60 * 1000, 'and the page is told how long it has been quiet');
}

console.log('\nRULE  the last run is still there when he is off');
{
  orrin = fresh();
  await call('POST', '/status', snap({ speech: [{ at: now(), text: 'something he said' }] }), TOKEN);
  await call('POST', '/status', snap({ alive: false, cycle: 12200 }), TOKEN);
  const out = (await call('GET', '/status')).body;
  ok(out.live === false, 'he reads as stopped');
  ok(out.run.cyclesTotal === 12200, 'the run headline survives him stopping');
  ok(out.run.buildSha === 'c6df9f9', 'so does the build it ran on');
  ok(out.speech.length === 1, 'and what he said is still readable');
}

console.log('\nRULE  a malformed push cannot erase a run headline');
{
  orrin = fresh();
  await call('POST', '/status', snap({ cycle: 9000 }), TOKEN);
  await call('POST', '/status', snap({ cycle: 0 }), TOKEN);
  ok((await call('GET', '/status')).body.run.cyclesTotal === 9000, 'cyclesTotal does not walk backwards');
}

console.log('\nRULE  his sentences stay in the order he said them');
{
  orrin = fresh();
  const lines = Array.from({ length: 12 }, (_, i) => ({ at: now(), text: `line ${i}` }));
  await call('POST', '/status', snap({ speech: lines }), TOKEN);
  const said = (await call('GET', '/status')).body.speech.map(s => s.text);
  ok(said[0] === 'line 0' && said[11] === 'line 11', 'twelve lines come back in order, not sorted as strings');
}

console.log('\nRULE  nothing here can send anything toward Orrin');
{
  orrin = fresh();
  ok((await call('POST', '/say', { text: 'hello orrin' }, TOKEN)).status === 404, 'there is no endpoint that talks to him');
  ok((await call('POST', '/input', { message: 'hello' }, TOKEN)).status === 404, 'not under another name either');
  ok((await call('GET', '/memory')).status === 404, 'and nothing that reads his memory');
}

console.log('\nRULE  a timestamp that is not a timestamp is dropped, not defaulted');
{
  orrin = fresh();
  await call('POST', '/status', snap({ speech: [{ at: 'yesterday', text: 'said at an unknown time' }] }), TOKEN);
  ok((await call('GET', '/status')).body.speech.length === 0, 'a line with no real time is not stamped "now"');
}

console.log(failures ? `\n${failures} FAILED\n` : '\nall good\n');
process.exit(failures ? 1 : 0);
