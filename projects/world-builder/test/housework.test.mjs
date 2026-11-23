// Work in the house (TODO.md 15.5n, 2026-11-21). Ric (2026-11-20): house work as hours a household must
// spend each day, yes; clothes "should maybe matter? If it doesn't cost much for the copy or gpu".
//
// What is held:
//   1. with "Work in the house" at "none" the world is the one 15.5m left, step for step;
//   2. a household owes hours every day, more with more mouths and small children, and they are done;
//   3. where a people keeps women at home, women do more of it than men;
//   4. clothes wear thin and spinning makes them good; thin clothes let the cold in.
//
// node projects/world-builder/test/housework.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 2152893328;   // print() of 15.5m's engine, seed 2, 60 days

// 1. None: the world before.
{
  const w = People.create({ seed: 2, housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"No house work\" is the world before 15.5n");
}

// 2 and 3. Hours owed and done; by custom.
{
  const own = "1.stubborn=0.9,1.bold=0.8,2.stubborn=0.9,2.bold=0.8,3.stubborn=0.9,3.bold=0.8,4.stubborn=0.9,4.bold=0.8";
  const w = People.create({ seed: 3, people: 400, own: own });
  w.step(24 * 30);
  const s = w.stats();
  /* about two hours a household a day and more: a month of a world of about a hundred households */
  assert.ok(s.houseHours > 100 * 30 * 1.5, "the hours are done (" + Math.round(s.houseHours) + " in a month)");
  const at = { 0: 0, 1: 0 }, n = { 0: 0, 1: 0 };
  for (let h = 0; h < 24 * 10; h++) {
    w.step(1);
    for (const p of w.people) if (w.adult(p) && p.job !== "soldier") { n[p.sex]++; if (p.chose === "house" || p.chose === "spin") at[p.sex]++; }
  }
  const women = at[0] / n[0], men = at[1] / n[1];
  assert.ok(women > men * 1.5, "where custom keeps women at home, they do more of it (" + women.toFixed(3) + " against " + men.toFixed(3) + ")");
}

// 4. Clothes.
{
  const w = People.create({ seed: 4, people: 200, start: "autumn" });
  w.step(24 * 200);
  const worn = w.people.filter(p => p.clothes < 1).length;
  assert.ok(worn > w.people.length * 0.8, "clothes wear (" + worn + " of " + w.people.length + ")");
  assert.ok(w.stats().spunHours > 0, "and people spin to make them good (" + Math.round(w.stats().spunHours) + " hours)");
  const mean = w.people.reduce((a, p) => a + p.clothes, 0) / w.people.length;
  assert.ok(mean > 0.5, "enough to keep most clothed (" + mean.toFixed(2) + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder work in the house: \"none\" is the world before, households owe hours and they are done, women do more of it where custom says so, and clothes wear and are spun good again");
