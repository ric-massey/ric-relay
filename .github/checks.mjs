/* EVERY CHECK IN THE REPO, IN ONE COMMAND
   ────────────────────────────────────────────────────────────────────────────
   There were 43 test files in here and nothing that ran them. That is not a
   test suite, it is a collection of scripts that used to pass — and on
   2026-09-23 three live bugs in the entertainment write path were found by
   hand, in code that had tests either side of the hole.

       node .github/checks.mjs            the quick ones — seconds
       node .github/checks.mjs --slow     and the simulations — about ten minutes
       node .github/checks.mjs --only movie

   Everything here runs with nothing installed: plain node, plus python3 for
   the halves of things that are written in Python. The one test left out is
   kondrite's browser.js, which drives a real Chromium through Playwright; it
   is run from its own directory (npm run setup, then npm run browser).

   .github/workflows/checks.yml runs this on every push. If you add a test,
   add it here, or it joins the pile that used to pass. */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const glob = (dir, ends) => readdirSync(join(ROOT, dir))
  .filter(f => f.endsWith(ends)).sort().map(f => join(dir, f));

/* `slow` is measured, not guessed: the traffic simulation alone is seven
   minutes, because what it asserts — a lane gradient, a lorry share — cannot
   be observed in less. Worth running, not worth waiting for on every save.

   They are also the only ones here that are deterministic on one machine and
   not across two: an arm64 Mac and an x86_64 runner fly kondrite's front page
   identically for two minutes and differently by the ninetieth, because a
   one-ulp difference in a transcendental compounds over 300,000 frames. A
   threshold with a few percent of headroom will go red on the other machine
   eventually, and the answer to that is slack in the thing being measured, not
   a constant nudged until it passes. See .github/workflows/simulations.yml. */
const SUITES = [
  ['the entertainment write path', ['projects/entertainment/test/write-path.mjs']],
  ['the training worker', ['projects/training/server/test.mjs']],
  ["orrin's server", ['projects/orrin/server/test.mjs']],
  ['the two climbing parsers agree', ['projects/climbing/test/parse-parity.js']],
  ['atlas', glob('atlas/test', '.test.mjs')],
  ['kondrite', glob('projects/kondrite/test', '.js')
    /* browser.js is the Playwright one; package.json is not a test. */
    .filter(f => !/browser\.js$/.test(f)), 'slow'],
  ['offramp', glob('projects/offramp/test', '.test.js'), 'slow']
];

const args = process.argv.slice(2);
const slow = args.includes('--slow') || args.includes('--all');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

let ran = 0, failed = [];
const started = Date.now();

for (const [name, files, speed] of SUITES) {
  if (speed === 'slow' && !slow) {
    console.log(`\n── ${name} — skipped (--slow runs it)`);
    continue;
  }
  if (only && !name.includes(only)) continue;

  console.log(`\n── ${name}`);
  for (const file of files) {
    const t0 = Date.now();
    const r = spawnSync('node', [join(ROOT, file)], { cwd: ROOT, encoding: 'utf8' });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ran++;
    if (r.status === 0) {
      console.log(`   ok    ${file}  (${secs}s)`);
    } else {
      failed.push(file);
      console.log(`   FAIL  ${file}  (${secs}s)`);
      /* The tail, because these suites print a line per assertion and the
         answer is at the bottom. Enough to see what broke without opening it. */
      const out = ((r.stdout || '') + (r.stderr || '')).trimEnd().split('\n');
      for (const line of out.slice(-14)) console.log('         │ ' + line);
    }
  }
}

const mins = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\n${ran} suite${ran === 1 ? '' : 's'} in ${mins}s — ` +
  (failed.length ? `${failed.length} FAILED:\n  ` + failed.join('\n  ') : 'all green'));
if (!slow && !only) console.log('(--slow adds the simulations, which take about ten minutes)');
process.exit(failed.length ? 1 : 0);
