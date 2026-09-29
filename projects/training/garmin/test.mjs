/* GARMIN puller — assertions
   ────────────────────────────────────────────────────────────────────────────
   Runs pull-garmin.py for real against a fake Garmin (test/fake/) in a
   throwaway home directory, with --dry so nothing is uploaded. What it proves
   is the part that matters if the real account is ever pulled: no coordinate
   or identity survives, the time series are dropped, the walk back stops when
   the watch runs out, and a rate limit loses nothing.

       node projects/training/garmin/test.mjs                                    */

import { spawnSync } from 'node:child_process';
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

for (const h of homes) rmSync(h, { recursive: true, force: true });
console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL GARMIN RULES PASS'));
process.exit(failures ? 1 : 0);
