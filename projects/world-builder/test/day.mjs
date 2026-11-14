/* WHAT A DAY LOOKS LIKE — the one definition of "a different day"
   ────────────────────────────────────────────────────────────────────────
   `behaviour.mjs` measures with these and `decisions.test.mjs` checks with
   them, so a measurement and a check cannot disagree about what they mean.

   A run becomes a distribution of adult person-hours over activities: every
   simulated hour, every adult's activity line is tallied. Two runs are then
   compared by what share of those hours are spent differently — 0 for the
   same day, 1 for no overlap at all. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const People = require("../people.js");

/* The activity line the page shows, with the other person's name taken off:
   "Talking to Mara" and "Talking to Tovin" are the same way to spend an hour. */
export const bucket = a => (a.startsWith("Talking to") ? "Talking" : a);

/* One run, reduced to how its people spent their time and what came of it. */
export function probe(base, set, seed, days) {
  const w = People.create(Object.assign({}, base, set, { seed }));
  const acts = new Map(), jobs = new Map();
  let samples = 0, jobSamples = 0, foodDays = 0, mood = 0, loyal = 0, n = 0;
  for (let h = 0; h < days * People.DAY_HOURS; h++) {
    w.step(1);
    for (const p of w.people) {
      if (!w.adult(p)) continue;
      const a = bucket(w.activity(p));
      acts.set(a, (acts.get(a) || 0) + 1); samples++;
      jobs.set(p.job, (jobs.get(p.job) || 0) + 1); jobSamples++;
      foodDays += p.food / Math.max(1e-6, w.dailyNeed(p));
      mood += p.mood; loyal += p.loyal; n++;
    }
  }
  const s = w.stats();
  const v = { act: {}, job: {}, scalar: {} };
  for (const [k, c] of acts) v.act[k] = samples ? c / samples : 0;
  for (const [k, c] of jobs) v.job[k] = jobSamples ? c / jobSamples : 0;
  v.scalar.foodDays = n ? foodDays / n : 0;
  v.scalar.mood = n ? mood / n : 0;
  v.scalar.loyal = n ? loyal / n : 0;
  for (const k of ["people", "villages", "factions", "topShare"]) v.scalar[k] = s[k];
  /* Outcomes as a rate, so a run with fewer people in it stays comparable. */
  const personYears = Math.max(1e-6, Math.max(1, s.people) * days / 365);
  for (const k of ["births", "starved", "battle", "sick", "talks", "switched", "moved", "thefts", "wars", "secessions"])
    v.scalar["rate_" + k] = (s[k] || 0) / personYears;
  return v;
}

/* The share of person-hours spent differently: 0 the same day, 1 no overlap. */
export function spentDifferently(a, b, part) {
  const keys = new Set([...Object.keys(a[part]), ...Object.keys(b[part])]);
  let total = 0;
  for (const k of keys) total += Math.abs((a[part][k] || 0) - (b[part][k] || 0));
  return total / 2;
}

/* A value for a setting that is not its default: half way to the far end, the
   same choice `world-builder.test.mjs` makes, so the three agree. */
export function other(it, base) {
  if (it.type === "toggle") return !base;
  if (it.type === "select") return it.options.map(o => o[0]).find(v => v !== base);
  const far = Math.abs(it.max - base) > Math.abs(it.min - base) ? it.max : it.min;
  const v = base + (far - base) * 0.5;
  return Math.round((v - it.min) / it.step) * it.step + it.min;
}

export { People };
