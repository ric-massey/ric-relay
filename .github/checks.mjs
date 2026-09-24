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
  /* First, because a page that does not parse is the one failure that takes
     a whole room down and that no other suite here would ever see. */
  ['every inline script parses', ['.github/test/inline-scripts.mjs']],
  ['the entertainment write path', ['projects/entertainment/test/write-path.mjs']],
  ['the training worker', ['projects/training/server/test.mjs']],
  ["orrin's server", ['projects/orrin/server/test.mjs']],
  /* Quick, and here rather than in the slow lane below because it is what
     parses game.js: the game moved out of index.html on 2026-09-24, so the
     inline-scripts suite above no longer sees it, and a game that does not
     parse should not wait for the nightly simulations to be found. */
  ['kondrite parses and is wired up', ['projects/kondrite/test/smoke.js']],
  ['the two climbing parsers agree', ['projects/climbing/test/parse-parity.js']],
  ['atlas', glob('atlas/test', '.test.mjs')],
  /* auth-security is also what keeps the real database key off the website. */
  ['hermiscus (dads-race)', glob('projects/dads-race/tests', '.test.cjs')],
  ['kondrite', glob('projects/kondrite/test', '.js')
    /* browser.js is the Playwright one; smoke.js ran above; page.js is the
       harnesses' shared loader, not a test. */
    .filter(f => !/(browser|smoke|page)\.js$/.test(f)), 'slow'],
  ['offramp', glob('projects/offramp/test', '.test.js'), 'slow']
];

const args = process.argv.slice(2);
const slow = args.includes('--slow') || args.includes('--all');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

let ran = 0, failed = [], skipped = [];
const started = Date.now();

/* A node:test file that skipped everything exits 0, and "ok" is the wrong
   word for it. atlas/test/site-accounts.test.mjs is the one suite that runs
   the row-level-security policies against a real Postgres, and with no local
   Supabase — which is every CI run — it reports `# pass 0 # skipped 1` and
   used to print here as green. A suite that proved nothing is said so. */
const provedNothing = out => {
  const pass = out.match(/^# pass (\d+)/m), skip = out.match(/^# skipped (\d+)/m);
  if (pass && skip && Number(pass[1]) === 0 && Number(skip[1]) > 0) return 'every test in it skipped';
  /* The hand-rolled suites say it in words: kondrite's sounds.js and browser.js
     print "SKIPPED — playwright is not installed" and exit 0. */
  const said = out.match(/^.*\bSKIPPED\b.*$/m);
  return said ? said[0].trim() : '';
};

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
    const why = r.status === 0 ? provedNothing(r.stdout || '') : '';
    if (why) {
      skipped.push(file);
      console.log(`   skip  ${file}  (${secs}s) — ${why}`);
    } else if (r.status === 0) {
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
  (failed.length ? `${failed.length} FAILED:\n  ` + failed.join('\n  ') : 'all green') +
  (skipped.length ? `\n${skipped.length} proved nothing (skipped throughout):\n  ` + skipped.join('\n  ') : ''));
if (!slow && !only) console.log('(--slow adds the simulations, which take about ten minutes)');
process.exit(failed.length ? 1 : 0);
