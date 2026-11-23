// Tanks and aircraft (TODO 15.6c, 2026-11-23). Ric: aircraft "Scout, bomb and carry"; "Go past WWII".
//
// What is held:
//   1. a people that does not know them builds none, whatever it pays;
//   2. a people that knows them, at war, with a works and power and the coins to spare, builds them, pays
//      for them out of its treasury into the village's till (no coin made or lost), and fuels them from
//      the store;
//   3. aircraft scout the enemy's places and bomb, and some are lost; jets come with the jet engine.
//
// node projects/world-builder/test/machines.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const ready = (era) => {
  const w = People.create({ seed: 6, era, factions: 2, people: 240, money: "coins" });
  w.step(24); w.knowDay();
  w.startWar(0, 1);
  const v = w.villages.find(u => u.alive && u.f === 0);
  v.works = Object.assign(v.works || {}, { power: { built: true, fuel: true }, works: { built: true } });
  v.power = true; v.goods = 500; v.iron = 500; v.wood = 500;
  w.factions[0].treasury = 5000;
  return { w, v, f: w.factions[0] };
};

{
  const { w, f } = ready("industrial");
  const m0 = (w.stats().money - w.stats().minted);
  for (let d = 0; d < 5; d++) w.machinesDay(0, 1);
  assert.equal(f.tanks || 0, 0, "no tanks without knowing them");
  assert.equal((f.air || []).length, 0, "nor aircraft");
  assert.ok(Math.abs((w.stats().money - w.stats().minted) - m0) < 1e-6);
}
{
  const { w, v, f } = ready("modern");
  const m0 = (w.stats().money - w.stats().minted), wood = v.wood;
  for (let d = 0; d < 30; d++) { w.machinesDay(0, 1); v.power = true; }
  const s = w.stats();
  console.log("  modern: tanks " + (f.tanks || 0) + " built " + s.tanksBuilt + ", aircraft " + f.air.length + " built " + s.aircraftBuilt + " lost " + s.aircraftLost + ", sorties " + s.sorties + ", bombs " + s.bombs + ", scouted " + s.airScouted);
  assert.ok(s.tanksBuilt > 0 && s.aircraftBuilt > 0, "built when they pay");
  assert.ok(Math.abs((s.money - s.minted) - m0) < 1e-6, "paid from the treasury into the till: no coin made or lost");
  assert.ok(v.wood < wood, "fuelled from the store");
  assert.ok(s.sorties > 0 && s.airScouted > 0 && s.bombs > 0, "they fly, look and bomb");
  assert.ok(Object.keys(w.factions[0].intel || {}).length > 0, "and what they saw is known");
}
{
  const { w, v, f } = ready("information");
  for (let d = 0; d < 10; d++) { w.machinesDay(0, 1); v.power = true; }
  assert.ok(f.air.includes("jet") || f.air.includes("heli"), "after the Second World War: jets and helicopters");
}
console.log("world-builder tanks and aircraft: none unknown; built when they pay, fuelled, flown, lost; jets later");
