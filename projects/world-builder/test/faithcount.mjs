// What faith does on its own, in a default world (TODO 15.11a, 2026-11-24). Counting only: nothing is placed,
// and nothing is held. It is the "before" every part of 15.11 is measured against, and is rerun after.
//
//   node projects/world-builder/test/faithcount.mjs [years] [seed ...]      default: 10 years, seeds 1 2 3 4
//   add --old to turn every part of 15.11 b to z off (the world 15.11a measured)
//
// For each seed it reports, year by year, the faiths made, named and gone, the most holders any faith had,
// the share of grown-ups holding any faith, and at the end how long faiths lasted; and whether a people
// whose ruler holds a faith differs from one whose ruler does not (loyalty, births a year per hundred).
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const args = process.argv.slice(2), old = args.includes("--old"), nums = args.filter(a => /^\d+$/.test(a)).map(Number);
const years = nums[0] || 10, seeds = nums.length > 1 ? nums.slice(1) : [1, 2, 3, 4];
const OFF = { folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false,
              faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false,
              pilgrims: false, sacredLand: false, faithHealth: false };
const mean = xs => xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN;
const f2 = x => Number.isFinite(x) ? x.toFixed(2) : "-";
for (const seed of seeds) {
  const w = People.create({ seed, ...(old ? OFF : {}) });
  const rows = [];
  let births0 = 0;
  const tied = { loyal: [], births: [] }, free = { loyal: [], births: [] };
  for (let y = 1; y <= years; y++) {
    const pop0 = new Map(w.factions.map(f => [f.id, f.pop])), b0 = w.stats().births;
    const bornBy = new Map(); for (const f of w.factions) bornBy.set(f.id, 0);
    const kids0 = new Set(w.people.map(p => p.id));
    w.step(24 * 365);
    const s = w.stats(), grown = w.people.filter(p => p.hp > 0 && w.adult(p));
    const holding = grown.filter(p => p.faith != null).length;
    const alive = w.faiths.filter(f => f.alive);
    rows.push([y, s.faiths, w.faiths.filter(f => f.name).length, s.faithsGone, alive.length, Math.max(0, ...alive.map(f => f.holders)), (holding / Math.max(1, grown.length) * 100).toFixed(1) + "%", s.converts, s.lapsed, s.sacrifices, s.holyWars, w.people.length]);
    for (const p of w.people) if (!kids0.has(p.id) && p.hp > 0) bornBy.set(p.f, (bornBy.get(p.f) || 0) + 1);
    for (const f of w.factions) {
      if (!f.alive || f.pop < 20) continue;
      const g = grown.filter(p => p.f === f.id), side = f.faith != null ? tied : free;
      side.loyal.push(mean(g.map(p => p.loyal)));
      side.births.push((bornBy.get(f.id) || 0) / Math.max(1, (pop0.get(f.id) || f.pop)) * 100);
    }
  }
  console.log("seed " + seed + (old ? " (15.11 b to z off)" : "") + ": year, made, named, gone, alive, most holders, grown-ups holding any, converts, lapsed, sacrifices, holy wars, people");
  for (const r of rows) console.log("  " + r.join("  "));
  const life = w.faiths.map(f => ((f.alive ? w.tick : f.goneAt ?? w.tick) - f.born) / (24 * 365));
  console.log("  faiths lasted (years, of those made): mean " + f2(mean(life)) + ", longest " + f2(Math.max(0, ...life)));
  console.log("  a people whose ruler holds a faith: loyalty " + f2(mean(tied.loyal)) + ", births a year per 100 " + f2(mean(tied.births)) + " (" + tied.loyal.length + " people-years); without: " + f2(mean(free.loyal)) + ", " + f2(mean(free.births)) + " (" + free.loyal.length + ")");
}
