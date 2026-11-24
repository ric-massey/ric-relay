// A household's own firewood (TODO.md 15.5f, 2026-11-22). Ric (2026-11-20): keep — "firewood was
// important till the modern age no?" Made the household's, fetched or bought like water.
//
// What is held:
//   1. with "Whose firewood" at "the village store's" the world is the one 15.5s left, step for step;
//   2. each household burns its own wood in the cold, and one with none is cold whatever its
//      neighbours have;
//   3. short of wood, a household with coins buys from the store; one without cuts its own;
//   4. over a winter, households cut and buy their wood.
//
// node projects/world-builder/test/hearth.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Engine = createRequire(import.meta.url)("../people.js");
/* Item 15's parts off: this test holds its own part as it was built (TODO 15, 2026-11-22). */
const People = Object.assign({}, Engine, { create: s => Engine.create(Object.assign({ govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false }, s)) });
const FINGERPRINT = 1545454631;   // print() of 15.5s's engine, seed 2, 60 days

// 1. The village's: the world before.
{
  const w = People.create({ seed: 2, hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"The village store's\" is the world before 15.5f");
}

// 2 and 3. Burning, cold, buying.
{
  const w = People.create({ seed: 3, people: 300, start: "winter", winter: 0.8 });
  w.step(24 * 3);
  const v = w.villages.find(o => o.alive && o.pop > 20);
  const mine = w.homes.filter(h => h.v === v.id && h.n > 0);
  assert.ok(mine.length > 3, "households");
  const a = mine[0], b = mine[1];
  a.wood = 0; b.wood = 5;
  const headA = w.people.find(p => p.id === a.head), coins = headA.coins;
  headA.coins = 0; if (headA.partner) { const m = w.people.find(p => p.id === headA.partner); if (m) m.coins = 0; }
  w.hearths(v.id, true);
  assert.ok(a.cold > 0.99 && b.cold === 0, "a household with no wood is cold, its neighbour with wood is not");
  assert.ok(b.wood < 5, "and burns its own");
  /* with coins, and wood in the store, it buys */
  headA.coins = 50; v.wood = Math.max(v.wood, v.wantWood + 10);
  const till = v.till;
  w.hearths(v.id, true);
  assert.ok(a.wood > 0 && v.till > till, "a household with coins buys from the store (" + a.wood.toFixed(2) + " loads)");
  headA.coins = coins;
}

// 4. A winter of it.
{
  const w = People.create({ seed: 1, people: 400, start: "autumn" });
  w.step(24 * 150);
  const s = w.stats();
  assert.ok(s.hearthCut > 20, "households cut their own (" + s.hearthCut.toFixed(0) + " loads)");
  assert.ok(s.hearthBought > 5, "and buy from the store (" + s.hearthBought.toFixed(0) + " loads)");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder hearth: \"the village's\" is the world before, each household burns its own and is cold without, buys with coins and cuts its own without");
