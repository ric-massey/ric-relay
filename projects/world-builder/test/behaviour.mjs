/* WORLD BUILDER — HOW MUCH A SETTING CHANGES A LIFE
   ────────────────────────────────────────────────────────────────────────
   Ric, 2026-11-13: "what you change doesn't change a lot for the people day
   to day". `world-builder.test.mjs` already checks that every setting changes
   *something* — but all it asserts is that a state hash differs, so a setting
   passes while moving nobody's day at all. This measures the size of the
   change instead of its existence.

   What it reads off a run: where an adult's hours actually go. Every simulated
   hour, every adult's activity is tallied, so a run becomes a distribution of
   person-hours over harvesting, sleeping, walking, talking and the rest. Two
   runs are compared by **what share of person-hours are spent differently**
   (`day.mjs`), 0 for identical days and 1 for no overlap at all.

   The null it is measured against: **rerolling the world.** Changing the seed
   changes the land, the names and who is born where, so some difference is
   expected from that alone. A setting that moves the day less than a reseed
   does is a setting you cannot feel. The ratio is the number worth reading.

   Nothing here is pass/fail — it is a measurement, and the activity mix it
   prints for the base world is as interesting as the table. The check that
   guards a few of these is `decisions.test.mjs`.

   A short run cannot see a slow mechanism: elections, war, plague and
   inheritance are not four-day effects, and a 0.0% beside one of those means
   the probe was too short, not that the setting does nothing. Use --days to
   look further out.

   Run it:
     node projects/world-builder/test/behaviour.mjs
     node projects/world-builder/test/behaviour.mjs --days=7 --seeds=4
     node projects/world-builder/test/behaviour.mjs --only=rich,talk,tax
     node projects/world-builder/test/behaviour.mjs --json=before.json   */
import { writeFileSync } from "node:fs";
import { probe, spentDifferently, other, People } from "./day.mjs";

const flag = (name, def) => {
  const hit = process.argv.find(a => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : def;
};
const DAYS = Number(flag("days", 4));
const SEEDS = Number(flag("seeds", 3));
const ONLY = flag("only", "") ? flag("only", "").split(",") : null;
const JSON_OUT = flag("json", "");

/* A world small enough to measure many times over, busy enough that work,
   trade, talk, soldiering and hunger are all on the table. */
const BASE = { people: 220, map: "small", factions: 3, villages: 2, crowd: 60 };

const items = People.SCHEMA.flatMap(g => g.items);
const seeds = [];
for (let i = 0; i < SEEDS; i++) seeds.push(11 + i * 97);

process.stdout.write("Measuring the base world (" + SEEDS + " seeds × " + DAYS + " days)…");
const t0 = Date.now();
const base = seeds.map(s => probe(BASE, {}, s, DAYS));
console.log(" " + ((Date.now() - t0) / 1000 / SEEDS).toFixed(1) + "s a run.");

const drift = spentDifferently(base[0], probe(BASE, {}, seeds[0], DAYS), "act");
console.log("Same seed twice: " + (drift < 1e-12 ? "identical" : "DIFFERED by " + (drift * 100).toFixed(2) + "% of hours"));

/* The null. Rerolling the world moves the day this much. */
let reseed = 0, pairs = 0;
for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) { reseed += spentDifferently(base[i], base[j], "act"); pairs++; }
reseed = pairs ? reseed / pairs : 0;

console.log("\nWhere an adult's hours go in the base world");
const mix = {};
for (const v of base) for (const [k, s] of Object.entries(v.act)) mix[k] = (mix[k] || 0) + s / base.length;
for (const [k, s] of Object.entries(mix).sort((a, b) => b[1] - a[1]))
  console.log("  " + (s * 100).toFixed(1).padStart(5) + "%  " + k);
console.log("\nRerolling the seed moves " + (reseed * 100).toFixed(1) + "% of those hours. That is the bar.");

const clean = People.clean(BASE);
const rows = [];
for (const it of items) {
  if (it.key === "seed" || it.key === "rate") continue;      // the seed is the null; the clock is the page's
  if (ONLY && !ONLY.includes(it.key)) continue;
  if (it.when && !it.when(clean)) continue;                  // not shown in this base world
  const value = other(it, clean[it.key]);
  process.stdout.write("  " + it.key + "…");
  let hours = 0, jobs = 0;
  for (let i = 0; i < seeds.length; i++) {
    /* Matched seeds: the same world, one setting apart. */
    const changed = probe(BASE, { [it.key]: value }, seeds[i], DAYS);
    hours += spentDifferently(base[i], changed, "act");
    jobs += spentDifferently(base[i], changed, "job");
  }
  hours /= seeds.length; jobs /= seeds.length;
  rows.push({ key: it.key, label: it.label, value: value, hours: hours, jobs: jobs, ratio: reseed > 0 ? hours / reseed : 0 });
  process.stdout.write(" " + (hours * 100).toFixed(1) + "%\n");
}

rows.sort((a, b) => a.hours - b.hours);
console.log("\nHow much each setting changes a day");
console.log("  hours   jobs   vs reseed  setting");
for (const r of rows) {
  const mark = r.ratio < 0.5 ? "  <- you cannot feel this" : r.ratio < 1 ? "  <- weaker than a reseed" : "";
  console.log("  " + (r.hours * 100).toFixed(1).padStart(5) + "%  " +
              (r.jobs * 100).toFixed(1).padStart(5) + "%  " +
              (r.ratio).toFixed(2).padStart(9) + "×  " + r.key + " = " + r.value + mark);
}

const dead = rows.filter(r => r.ratio < 0.5).length;
console.log("\n" + dead + " of " + rows.length + " settings move a day less than half as much as rerolling the world does.");
console.log("Median setting moves " + (rows[Math.floor(rows.length / 2)].hours * 100).toFixed(1) + "% of an adult's hours.");

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ days: DAYS, seeds: seeds, base: BASE, reseed: reseed, mix: mix, rows: rows }, null, 2));
  console.log("Written to " + JSON_OUT);
}
