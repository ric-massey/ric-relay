// Treasuries that can pay (TODO.md 15.5t, 2026-11-21). Ric: leaders "can tax what they want lol just
// like real life", the share moved "By the leader's traits".
//
// What is held:
//   1. "Tax on the harvest at the start" at none means none, ever;
//   2. a share of what is reaped goes into the village store as the faction's grain, and no coin is
//      made or lost;
//   3. the faction's grain sold from the store pays the treasury, not the till;
//   4. a soldier the treasury cannot pay is paid a day's food from the faction's grain;
//   5. a greedier leader wants a bigger chest;
//   6. a faction you rule takes the share you set.
//
// node projects/world-builder/test/treasury.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. None at the start, none ever — and then the world is the one before 15.5t (15.5b2's, as test/rivers holds it).
{
  const o = People.create({ seed: 1, harvestTax: 0, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old" });   // and 15.5r's dirt at the old fixed toll
  o.step(24 * 30);
  let h = 0; const mix = x => { h = (h * 31 + (Math.round(x * 1e6) | 0)) % 2147483647; };
  for (const p of o.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.home); }
  assert.equal(h, 1920400234, "with no harvest tax the world is the world before it");
}
{
  const w = People.create({ seed: 2, harvestTax: 0, start: "summer" });
  w.step(24 * 90);
  assert.equal(w.stats().harvestTax, 0, "no harvest taxed");
  assert.ok(w.factions.every(f => f.harvest === 0) && w.villages.every(v => v.levy === 0), "and no faction's grain in any store");
}

// 2. The harvest taxed, into the store; no coin made or lost.
{
  const w = People.create({ seed: 2, start: "summer" });
  const before = w.stats().money;
  w.step(24 * 90);
  const s = w.stats();
  assert.ok(s.harvestTax > 100, "a share of the harvest is taken (" + Math.round(s.harvestTax) + " days' food)");
  assert.ok(Math.abs(s.money - before) < 1e-6, "no coin made or lost (" + (s.money - before) + ")");
}

// 3 and 4. The faction's grain sold for the treasury; a soldier paid in grain.
{
  const w = People.create({ seed: 3, start: "winter" });
  const v = w.villages.find(x => x.alive && x.pop > 10), f = w.factions[v.f];
  v.food += 200; v.levy = v.food;                          // all of the store the faction's
  const buyer = w.people.find(p => p.home === v.id && p.job !== "soldier" && p.age >= 20);
  buyer.coins += 50; buyer.food = 0;
  const tr = f.treasury, till = v.till;
  let bought = false;
  for (let h = 0; h < 48 && !bought; h++) { w.step(1); bought = v.levy < 200 - 0.5 && f.treasury > tr; }
  assert.ok(bought, "the faction's grain sold pays the treasury (" + Math.round(tr) + " → " + Math.round(f.treasury) + ", till " + Math.round(till) + " → " + Math.round(v.till) + ")");

  const soldier = w.people.find(p => p.f === f.id && p.job === "soldier" && p.home === v.id) ||
                  Object.assign(w.people.find(p => p.f === f.id && p.home === v.id && p.age >= 20 && p.id !== f.leader), { job: "soldier" });
  f.treasury = 0; v.levy = v.food = Math.max(v.food, 100);
  const levy = v.levy;
  soldier.unpaid = 0;
  w.step(24);
  f.treasury = 0;                                          // still nothing in coin
  w.step(24);
  assert.ok(v.levy < levy, "a soldier with no coin to be paid in is paid from the faction's grain");
  assert.equal(soldier.unpaid, 0, "and is not owed");
}

// 5. The chest a leader wants: a year's wages, more for the greedy.
{
  const w = People.create({ seed: 4 });
  const f = w.factions[0]; f.rule = "chief";
  const lead = w.people.find(p => p.id === f.leader);
  Object.assign(lead, { greed: 0.9, warm: 0.1 }); w.step(24); const greedy = f.chest;
  Object.assign(lead, { greed: 0.1, warm: 0.9 }); w.step(24); const warm = f.chest;
  /* (The wages it is reckoned from move as the army does from day to day, so only "more".) */
  assert.ok(warm > 0 && greedy > warm * 1.1, "a greedy leader wants more in the chest (" + Math.round(greedy) + " against " + Math.round(warm) + ")");
}

// 6. Ruled by you.
{
  const w = People.create({ seed: 4 });
  w.rule(0, true); w.order(0, { harvest: 0.3 });
  w.step(24 * 3);
  assert.equal(w.factions[0].harvest, 0.3, "a faction you rule takes the share you set");
}

console.log("world-builder treasury: none means none, the harvest taxed, its grain sold and paid out, the chest, your share");
