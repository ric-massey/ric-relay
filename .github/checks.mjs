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
  ['the front door lists every room, and only real ones', ['.github/test/frontdoor.mjs']],
  /* The terminal's search: ranking on the real data, every result's link,
     and pages.js current with the pages it lists. */
  ['the terminal search', ['.github/test/terminal-search.mjs']],
  /* The terminal's shell: `help`, Tab completion and the command table are
     three hand-kept lists, held to each other here; and the phone and
     front-door fixes of 2026-11-10 stay in. */
  ['the terminal shell', ['.github/test/terminal-shell.mjs']],
  ['world-builder breakup keeps its books', ['projects/world-builder/test/breakup.test.mjs']],
  ['world-builder shape and sequence', ['projects/world-builder/test/shape.test.mjs']],
  ['world-builder chemistry', ['projects/world-builder/test/chemistry.test.mjs']],
  ['world-builder lab', ['projects/world-builder/test/lab.test.mjs']],
  ['the entertainment write path', ['projects/entertainment/test/write-path.mjs']],
  /* The finder's filters against the Worker's /tmdb/discover whitelist. */
  ['the entertainment finder', ['projects/entertainment/test/finder.mjs']],
  ['the worker (training-log)', ['worker/test.mjs']],
  ['the arcade game rules', ['projects/arcade/test/engine.test.cjs', 'projects/arcade/test/pages.test.cjs']],
  ['the arcade shared scoreboards', ['worker/arcade.test.mjs']],
  ['the media location scrub', ['.github/test/scrub-media.mjs']],
  ['nothing tracked is ignored', ['.github/test/tracked-ignored.mjs']],
  ['the visitor counter', ['worker/visitors.test.mjs']],
  /* Not live.mjs: that one asks the real ClinicalTrials.gov, so it runs in
     its own lane (.github/workflows/studies-live.yml), not here. */
  ['the psyche studies client', ['projects/psyche/test/trials.test.mjs', 'projects/psyche/test/watch-policy.test.mjs']],
  /* Not live.mjs: that asks the real NWS and Open-Meteo, in its own lane
     (.github/workflows/weather-live.yml). wx.test.mjs also holds the
     Worker's /wx route to every request the page makes. */
  ['the weather client', ['projects/weather/test/wx.test.mjs', 'projects/weather/test/astro.test.mjs', 'projects/weather/test/sounding.test.mjs', 'projects/weather/test/verify.test.mjs', 'projects/weather/test/nowcast.test.mjs', 'projects/weather/test/decoders.test.mjs', 'projects/weather/test/workstation.test.mjs', 'projects/weather/test/palettes.test.mjs', 'projects/weather/test/terrain.test.mjs', 'projects/weather/test/route.test.mjs', 'projects/weather/test/watches.test.mjs', 'projects/weather/test/reanalysis.test.mjs', 'projects/weather/test/colormaps.test.mjs', 'projects/weather/test/radar3d.test.mjs', 'projects/weather/test/operational.test.mjs']],
  ['the garmin puller', ['projects/training/garmin/test.mjs']],
  ["orrin's server", ['projects/orrin/server/test.mjs']],
  ["orrin's progress notes", ['.github/test/orrin-updates.mjs']],
  /* Quick, and here rather than in the slow lane below because it is what
     parses game.js: the game moved out of index.html on 2026-09-24, so the
     inline-scripts suite above no longer sees it, and a game that does not
     parse should not wait for the nightly simulations to be found. */
  ['kondrite parses and is wired up', ['projects/kondrite/test/smoke.js']],
  ['the two climbing parsers agree', ['projects/climbing/test/parse-parity.js']],
  /* The bomb timer and the packed replay tracks are each written twice, in
     cs.html and in Python; this replays every committed match through both. */
  ['the CS page and its scripts agree', ['projects/cs/test/parity.mjs']],
  /* The live feed's last round arrives as game over with no winner named. */
  ['the CS live feed keeps every round', ['projects/cs/test/gsi.mjs']],
  ['atlas', glob('atlas/test', '.test.mjs')],
  /* ricmassey.com/admin: the site-admin function holds the service key, and
     KONDRITE's admin.sql reads every player's email, so this holds both to
     their admin checks and runs the page against hostile names. */
  ['the admin site', ['admin/test/admin.test.mjs']],
  /* auth-security is also what keeps the real database key off the website. */
  ['hermiscus (dads-race)', glob('projects/dads-race/tests', '.test.cjs')],
  ['kondrite', glob('projects/kondrite/test', '.js')
    /* browser.js is the Playwright one; smoke.js ran above; page.js is the
       harnesses' shared loader, not a test. */
    /* traffic-trace.js is a tool, not a suite: it prints hashes to compare
       before and after a refactor and asserts nothing, so running it here
       would be four minutes of proving nothing. */
    .filter(f => !/(browser|smoke|page|traffic-trace)\.js$/.test(f)), 'slow'],
  /* corridor.js is the only check of the whole I-40 corridor and set a failing
     exit code that nothing read (bug sweep A6-3). harness.js, i40.js and map.js
     in the same folder are helpers, not suites. */
  ['offramp', [...glob('projects/offramp/test', '.test.js'), 'projects/offramp/test/corridor.js'], 'slow'],
  /* The universe Lab's pre-flight: the torus seam, the books asserted through
     a run, five seeds and five constant changes. About 30 seconds, so slow
     lane (Ric, 2026-11-06: "Sure").

     world-check.mjs is the World's, seventeen checks (eleven until
     2026-11-09, when the World got its collisions, its wall, an exact resume
     and a lit edge, and Checks 12 to 17 with them). Law 1's two exchanges move
     momentum between neighbours without anything travelling, which is the
     operation that can conserve momentum perfectly while quietly creating or
     destroying energy — that failure cost 34,864 units in the Lab (README item
     28) with no error and nothing visibly wrong. Check 11 watches the World's
     EDGE, added 2026-11-08: light leaves through it and matter does not, and
     "it radiated away" has to be distinguishable from "it vanished", which is
     the same class of bug one level out. */
  ['universe', ['projects/universe/lab-check.mjs', 'projects/universe/world-check.mjs'], 'slow'],
  /* One clock through frames/hours/batches, plus daily food and lifecycle boundaries. */
  ['world-builder time and food', ['projects/world-builder/test/time-food.test.mjs']],
  ['world-builder equipment', ['projects/world-builder/test/equipment.test.mjs']],
  ['world-builder travel', ['projects/world-builder/test/travel.test.mjs']],
  /* Actual effects and a held transcript that survives rolling history. */
  ['world-builder conversations', ['projects/world-builder/test/conversations.test.mjs']],
  /* A setting has to be something you can feel. The hash check in the slow lane
     only proves a setting changed *something*; this one measures how much of an
     adult's day it moves, and pins the shape of a day that made it possible. */
  ['world-builder decisions', ['projects/world-builder/test/decisions.test.mjs']],
  // Ruling a faction, live settings and grain trade: decisions do what they say, are felt, conserve coins.
  ['world-builder rule and grain', ['projects/world-builder/test/rule.test.mjs']],
  // War has to be fed: rations, resupply at home, slow raising, the wounded go home.
  ['world-builder war', ['projects/world-builder/test/war.test.mjs']],
  // Settings mean what they say: coins, inherited natures, land-fed villages, leaders' armies, revolutions.
  ['world-builder settings sense', ['projects/world-builder/test/settings-sense.test.mjs']],
  /* The walking short cuts (a blocked step remembered, a failed way round
     remembered, a crowd placed with a finer map) may only be faster: the same
     engine with them switched off has to give the identical world. Run both
     ways on this machine rather than against a stored answer, because a
     simulation's numbers are one machine's. */
  ['world-builder walking is the same world', ['projects/world-builder/test/walking.test.mjs']],
  /* Land from the seed (TODO 4a): the seed's alone, water downhill to the sea,
     a lake or the edge, settings that mean what they say, nobody in the water. */
  ['world-builder land from the seed', ['projects/world-builder/test/land.test.mjs']],
  /* Houses as buildings and people at their real size (TODO 7a). */
  ['world-builder houses', ['projects/world-builder/test/houses.test.mjs']],
  /* Water to drink (TODO 6a): off is off, fetching, wells, three days without. */
  ['world-builder water', ['projects/world-builder/test/water.test.mjs']],
  ['world-builder rain and fishing', ['projects/world-builder/test/rain.test.mjs']],
  ['world-builder crossing', ['projects/world-builder/test/crossing.test.mjs']],
  ['world-builder fields', ['projects/world-builder/test/fields.test.mjs']],
  ['world-builder roads', ['projects/world-builder/test/roads.test.mjs']],
  ['world-builder towns', ['projects/world-builder/test/towns.test.mjs']],
  ['world-builder materials', ['projects/world-builder/test/materials.test.mjs']],
  ['world-builder traits', ['projects/world-builder/test/traits.test.mjs']],
  ['world-builder mind', ['projects/world-builder/test/mind.test.mjs']],
  ['world-builder talk', ['projects/world-builder/test/talk.test.mjs']],
  // About a minute: three worlds of 80 to 210 days, acting on news of sickness and famine (TODO 12b).
  ['world-builder heard', ['projects/world-builder/test/heard.test.mjs'], 'slow'],
  ['world-builder treaties', ['projects/world-builder/test/treaties.test.mjs']],   // TODO 14d
  ['world-builder ways', ['projects/world-builder/test/ways.test.mjs']],   // TODO 15a
  ['world-builder land updates', ['projects/world-builder/test/land-updates.test.mjs']],   // TODO 15.25
  ['world-builder made to order', ['projects/world-builder/test/orders.test.mjs']],   // TODO 15.5a
  ['world-builder wartime gear and the marriage button', ['projects/world-builder/test/wartime.test.mjs']],   // TODO 15.5h
  ['world-builder rivers and boats', ['projects/world-builder/test/rivers.test.mjs']],   // TODO 15.5b1
  ['world-builder grain', ['projects/world-builder/test/grain.test.mjs']],   // TODO 15.5b2, about a minute
  ['world-builder treasury', ['projects/world-builder/test/treasury.test.mjs']],   // TODO 15.5t, about a minute
  ['world-builder food riots', ['projects/world-builder/test/riots.test.mjs']],   // TODO 15.5b3, under a minute
  ['world-builder bandits', ['projects/world-builder/test/bandits.test.mjs']],   // TODO 15.5b4, under a minute
  ['world-builder dirt in towns', ['projects/world-builder/test/dirt.test.mjs']],   // TODO 15.5r, under a minute and a half
  ['world-builder wounds and old age', ['projects/world-builder/test/health.test.mjs']],   // TODO 15.5e, about two minutes
  ['world-builder men and women', ['projects/world-builder/test/sexes.test.mjs']],   // TODO 15.5l, about two minutes
  ['world-builder babies and mothers', ['projects/world-builder/test/infancy.test.mjs']],   // TODO 15.5k, about two minutes
  ['world-builder children working', ['projects/world-builder/test/childwork.test.mjs']],   // TODO 15.5m, about a minute
  ['world-builder work in the house', ['projects/world-builder/test/housework.test.mjs']],   // TODO 15.5n, about two minutes
  ['world-builder land that changes', ['projects/world-builder/test/landchange.test.mjs']],   // TODO 15.5d, about two minutes
  ['world-builder animals that work', ['projects/world-builder/test/beasts.test.mjs']],   // TODO 15.5o, under a minute
  ['world-builder irrigation', ['projects/world-builder/test/irrigation.test.mjs']],   // TODO 15.5p, about two minutes
  ['world-builder climate', ['projects/world-builder/test/climate.test.mjs']],   // TODO 15.5q, seconds
  ['world-builder sleep', ['projects/world-builder/test/sleep.test.mjs']],   // TODO 15.5s, seconds
  ['world-builder household firewood', ['projects/world-builder/test/hearth.test.mjs']],   // TODO 15.5f, under a minute
  ['world-builder news of plenty', ['projects/world-builder/test/plenty.test.mjs']],   // TODO 15.5g, under a minute
  ['world-builder small land and its edge', ['projects/world-builder/test/smallland.test.mjs']],   // TODO 15.5c, under a minute
  ['world-builder government', ['projects/world-builder/test/government.test.mjs']],   // TODO 15c, under a minute
  ['world-builder faith', ['projects/world-builder/test/faith.test.mjs']],   // TODO 15g, under a minute
  ['world-builder marriage', ['projects/world-builder/test/marriage.test.mjs']],   // TODO 15b, under a minute
  ['world-builder know-how', ['projects/world-builder/test/knowhow.test.mjs']],   // TODO 15e, under a minute
  ['world-builder work and workplaces', ['projects/world-builder/test/works.test.mjs']],   // TODO 15f, under a minute
  ['world-builder armies', ['projects/world-builder/test/armies.test.mjs']],   // TODO 15h, about a minute
  ['world-builder people on the road and in camps', ['projects/world-builder/test/roaming.test.mjs']],   // TODO 15i, under a minute
  ['world-builder eras', ['projects/world-builder/test/eras.test.mjs']],   // TODO 15d, under a minute
  ['world-builder soldiers on campaign', ['projects/world-builder/test/campaign.test.mjs']],   // TODO 15j, under a minute
  ['world-builder caravans', ['projects/world-builder/test/caravans.test.mjs']],   // TODO 15l
  ['world-builder sickness in armies', ['projects/world-builder/test/armysick.test.mjs']],   // TODO 15m
  ['world-builder births', ['projects/world-builder/test/births.test.mjs'], 'slow'],   // TODO 15.25
  // About eight minutes: forced wars through a harvest, a siege with and without a wall (TODO 14e).
  ['world-builder walls', ['projects/world-builder/test/walls.test.mjs'], 'slow'],
  // About seven minutes: twelve worlds, a year and a half each, to tell hot leaders from patient ones.
  ['world-builder dealings', ['projects/world-builder/test/dealings.test.mjs'], 'slow'],
  /* TODO.md item 2 (2026-11-15): people with nothing to do are passed over
     until their wait is up or somebody makes room beside them, and the lists
     of who stands where and who lives where are kept up, not made again. The
     engine run the long way round has to give the identical world, hour by
     hour, and the short cuts check themselves on every step (`audit`). */
  ['world-builder passing people over is the same world', ['projects/world-builder/test/dozing.test.mjs']],
  /* TODO.md item 3 (2026-11-15): the People engine runs in a worker, kept by
     people-host.js, and the page is sent only what it draws. A world run
     through the keeper — any speed, time in any pieces, frames and panels
     read all the while — has to be the engine's own world; a frame has to
     say what the world says; the two files have to come out whole when
     written out again as a worker's text (how the page starts one, and why
     it still works opened as a file); and people has no top. */
  ['world-builder keeper, worker text and no top on people', ['projects/world-builder/test/keeper.test.mjs']],
  /* Physics settings/conservation and seven actual days per People preset.
     The shared daily clock superseded the compressed headless century in
     2026-11-12. Generation-scale experiments remain explicit --generations
     work, not routine CI; time/food parity and lifecycle boundaries run above. */
  ['world-builder', ['projects/world-builder/test/world-builder.test.mjs'], 'slow']
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
/* Node 23 and later print the `spec` report even into a pipe — `ℹ pass 0`
   rather than `# pass 0` — so both spellings are read, and every suite is run
   with --test-reporter=tap besides (bug sweep A6-1). */
const counts = out => {
  const n = word => { const m = out.match(new RegExp(`^(?:#|ℹ) ${word} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  return { pass: n('pass'), skip: n('skipped') };
};
const provedNothing = out => {
  const { pass, skip } = counts(out);
  if (pass === 0 && skip > 0) return 'every test in it skipped';
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
    const r = spawnSync('node', ['--test-reporter=tap', join(ROOT, file)], { cwd: ROOT, encoding: 'utf8' });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    ran++;
    const why = r.status === 0 ? provedNothing(r.stdout || '') : '';
    if (why) {
      skipped.push(file);
      console.log(`   skip  ${file}  (${secs}s) — ${why}`);
    } else if (r.status === 0) {
      /* Green, but a suite that skipped some of its tests says how many. */
      const { skip } = counts(r.stdout || '');
      console.log(`   ok    ${file}  (${secs}s)${skip ? ` — ${skip} skipped` : ''}`);
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
