/* GARMIN puller — assertions
   ────────────────────────────────────────────────────────────────────────────
   Runs pull-garmin.py for real against a fake Garmin (test/fake/) in a
   throwaway home directory, with --dry so nothing is uploaded. What it proves
   is the part that matters if the real account is ever pulled: no coordinate
   or identity survives, the time series are dropped, the walk back stops when
   the watch runs out, and a rate limit loses nothing.

       node projects/training/garmin/test.mjs                                    */

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import worker, { TrainingLog } from '../../../worker/worker.mjs';
import { memoryBucket } from '../../../worker/r2-memory.mjs';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'pull-garmin.py');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

function run(home, env = {}, args = []) {
  const r = spawnSync('python3', [SCRIPT, '--dry', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: join(HERE, 'test', 'fake'), RIC_GARMIN_HOME: home,
           GARMIN_EMAIL: 'ric@example.com', GARMIN_PASSWORD: 'x', FAKE_HISTORY_DAYS: '90', ...env },
    /* The real script pauses between calls so Garmin does not lock the
       account; the fake has no such limit and the test has no such time. */
    input: ''
  });
  let out = null;
  try { out = JSON.parse(readFileSync(join(home, 'export.json'), 'utf8')); } catch {}
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, out };
}

/* GARMIN_PAUSE=0 below: the real script paces its calls so Garmin does not
   lock the account out, and the fake has no limit to respect. */
process.env.PYTHONDONTWRITEBYTECODE = '1';

const homes = [];
const home = () => { const h = mkdtempSync(join(tmpdir(), 'garmin-')); homes.push(h); return h; };

console.log('\nRULE  a full pull keeps the answers and drops the rest');
{
  const h = home();
  const r = run(h, { GARMIN_PAUSE: '0' });
  ok(r.code === 0, 'the dry run exits cleanly' + (r.code ? ' — ' + r.stderr.slice(-300) : ''));
  const o = r.out || { days: {}, activities: [{}] };
  const text = JSON.stringify(o);
  ok(o.counts && o.counts.days === 91, `every worn day is there (got ${o.counts && o.counts.days})`);
  ok(o.activities.length === 45, 'every activity is there');
  const today = Object.keys(o.days).pop();
  const d = o.days[today] || {};
  ok(d.sleep && d.sleep.dailySleepDTO.sleepScores.overall.value === 74, 'the sleep score survives, three levels down');
  ok(d.hrv && d.hrv.hrvSummary.lastNightAvg === 61, 'last night\'s HRV survives');
  ok(d.summary && d.summary.restingHeartRate === 48, 'resting heart rate survives');
  ok(d.readiness && d.readiness.length === 1 && d.readiness[0].score === 55, 'readiness keeps the latest update of the day');
  ok(d.status && JSON.stringify(d.status).includes('"acwrPercent":130'), 'training load ratio survives');
  ok(o.activities[0].hrTimeInZone_2 === 1200.5, 'heart-rate zones on an activity survive');
  ok(o.activities[0].activityType.typeKey === 'running', 'and the activity type');
  ok(!/latitude|longitude|locationName|Knoxville"/i.test(text.replace(/"activityName":"Knoxville Run"/g, '')),
     'no coordinate or location name survives anywhere');
  ok(!/ownerFullName|ProfileImage|userProfileId|ric-secret-name/.test(text), 'no identity field survives');
  ok(!/sleepMovement|sleepHeartRate|hrvReadings/.test(text), 'the time series are dropped');
  ok(o.race_predictions && o.race_predictions.timeMarathon === 12600, 'race predictions come along');
}

console.log('\nRULE  the walk back stops when the watch runs out');
{
  const h = home();
  const r = run(h, { FAKE_HISTORY_DAYS: '30', GARMIN_PAUSE: '0' });
  const cache = JSON.parse(readFileSync(join(h, 'cache.json'), 'utf8'));
  ok(r.out && r.out.counts.days === 31, 'thirty-one worn days are exported');
  ok(Object.keys(cache.days).length === 31 + 60, 'and it walked sixty empty days past them, then stopped');
}

console.log('\nRULE  a rate limit loses nothing, and the next run carries on');
{
  const h = home();
  const r1 = run(h, { FAKE_RATE_LIMIT_AFTER: '120', GARMIN_PAUSE: '0' });
  ok(r1.code === 2, 'a rate-limited run says so in its exit code');
  ok(r1.out && r1.out.counts.days > 10 && r1.out.counts.days < 91, `it still writes what it had (${r1.out && r1.out.counts.days} days)`);
  const r2 = run(h, { GARMIN_PAUSE: '0' });
  ok(r2.code === 0 && r2.out.counts.days === 91, 'the next run finishes the history');
}

console.log('\nRULE  a wrong login is said plainly');
{
  const h = home();
  const r = run(h, { GARMIN_EMAIL: 'someone@else.com', GARMIN_PAUSE: '0' });
  ok(r.code === 1 && /refused the login/.test(r.stderr), 'exit 1 with a sentence, not a traceback');
}

/* ── on GitHub: state on the Worker ──
   The real worker.mjs, served on localhost with an in-memory bucket, and the
   script in GARMIN_REMOTE mode: what a press from the phone does. */
const TOKEN = 'test-log-token-long-enough';
const mem = new Map();
const obj = new TrainingLog({ storage: {
  get: async k => mem.get(k), put: async (k, v) => { mem.set(k, v); },
  delete: async k => { mem.delete(k); },
  list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
} }, { LOG_TOKEN: TOKEN });
const bucket = memoryBucket();
const server = createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request('http://w' + req.url, {
    method: req.method, headers: req.headers, ...(body && req.method !== 'GET' ? { body } : {})
  }), { LOG: { idFromName: () => 'training', get: () => obj }, MEDIA: bucket }, null);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const WORKER = `http://127.0.0.1:${server.address().port}`;

/* Async, because the Worker it talks to is running in this same process. */
function remote(home, env = {}) {
  return new Promise(done => {
    const p = spawn('python3', [SCRIPT], { env: { ...process.env,
      PYTHONPATH: join(HERE, 'test', 'fake'), RIC_GARMIN_HOME: home, GARMIN_REMOTE: '1',
      GARMIN_WORKER: WORKER, LOG_TOKEN: TOKEN, GARMIN_EMAIL: 'ric@example.com', GARMIN_PASSWORD: 'x',
      GARMIN_PAUSE: '0', FAKE_HISTORY_DAYS: '90', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; });
    p.stderr.on('data', d => { stderr += d; });
    p.on('close', code => done({ code, stdout, stderr }));
  });
}

console.log('\nRULE  on GitHub, the export and the Garmin session live on the Worker');
{
  const r1 = await remote(home());
  ok(r1.code === 0, 'a first run from a blank machine uploads' + (r1.code ? ' — ' + r1.stderr.slice(-300) : ''));
  ok(/logged in with the password/.test(r1.stdout), 'logging in with the password the first time');
  const up = bucket._map.get('garmin/export.json');
  const exp = up && JSON.parse(new TextDecoder().decode(up.bytes));
  ok(exp && exp.counts.days === 91 && exp.empty.length === 60, 'the export holds every worn day and the empty ones it checked');
  ok(bucket._map.has('garmin/session.json'), 'and Garmin\'s session is parked on the Worker');

  /* A fresh machine, a wrong password, and a Garmin that rate-limits after 30
     calls: only a run that reused both the session and the last export gets
     through that. */
  const r2 = await remote(home(), { GARMIN_PASSWORD: 'wrong', GARMIN_EMAIL: 'nobody@example.com', FAKE_RATE_LIMIT_AFTER: '30' });
  ok(r2.code === 0, 'the next run, on a new machine, finishes' + (r2.code ? ' — ' + (r2.stderr + r2.stdout).slice(-400) : ''));
  ok(/logged in from a parked session/.test(r2.stdout), 'from the parked session, without the password');
  ok(/Picked up 91 days/.test(r2.stdout), 'and from the last export, asking Garmin only for the last few days');

  const mfa = await remote(home(), { FAKE_MFA: '1' });
  ok(mfa.code === 0, 'a parked session means a two-step code is never asked for');
  bucket._map.delete('garmin/session.json');
  const mfa2 = await remote(home(), { FAKE_MFA: '1' });
  ok(mfa2.code === 1 && /two-step verification code/.test(mfa2.stderr), 'and with none, a code request is a sentence, not a hang');

  const leak = r1.stdout + r1.stderr + r2.stdout + r2.stderr;
  ok(!/\b48\b|sleepScores|restingHeartRate|fresh-session|test-log-token/.test(leak.replace(/Picked up \d+ days/g, '')),
     'nothing it prints is a value, a token or a password — Actions logs are public');
}
server.close();

for (const h of homes) rmSync(h, { recursive: true, force: true });
console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL GARMIN RULES PASS'));
process.exit(failures ? 1 : 0);
