// People who belong to no one place (TODO.md 15i, 2026-11-22). Ric: "aren't their people who aren't
// part of a place? Depending on the era too? They travel?"; "all of them"; a settled family taking
// to the road and back: "yes".
//
// What is held:
//   1. with "Everybody keeps to their village" the world is the one 15h left, step for step;
//   2. a people set to forage does not farm, has a headman who takes no tax, and shares its food
//      across the camp by need;
//   3. its camp moves when the food round it runs down;
//   4. somebody grown, poor and hungry in a hungry village takes to the road, and settles where
//      there is food.
//
// node projects/world-builder/test/roaming.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = {};   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 322919713;   // print() of 15h's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15i");
}

// 2 and 3. A band.
{
  const w = People.create({ ...LATER, seed: 4, people: 300, factions: 2, foragers: 1, war: false });
  const band = w.factions[0];
  w.step(24 * 2);
  const grown = w.people.filter(p => p.f === band.id && w.adult(p) && p.hp > 0);
  assert.ok(grown.length > 0 && grown.every(p => p.job !== "farmer" && p.job !== "crafter" && p.job !== "trader"), "nobody of the band farms or keeps a trade");
  assert.equal(band.tax, 0, "a headman takes nothing");
  assert.equal(w.titleOf(band), "headman", "and is called so");
  const camp = w.villages.find(v => v.alive && v.f === band.id);
  w.bandDay(band.id);
  const here = w.people.filter(p => p.home === camp.id && p.hp > 0);
  const per = here.map(p => p.food / w.dailyNeed(p));
  assert.ok(Math.max(...per) - Math.min(...per) < 1e-6, "food shared across the camp by need");
  const before = w.stats().campMoves;
  w.step(24 * 150);
  const moves = w.stats().campMoves - before;
  console.log("  the band moved camp " + moves + " times in 150 days" + (w.events.some(e => e.kind === "camp") ? ": " + w.events.filter(e => e.kind === "camp").pop().text : ""));
  assert.ok(moves > 0, "the camp moves when the food round it runs down");
}

// 4. On the road.
{
  const w = People.create({ ...LATER, seed: 3, people: 400, war: false });
  w.step(24 * 2);
  const vs = w.villages.filter(v => v.alive).sort((a, b) => b.pop - a.pop);
  const poor = vs[0];
  const p = w.people.find(q => q.home === poor.id && w.adult(q) && q.hp > 0 && q.id !== w.factions[q.f].leader && q.job !== "soldier" &&
    !w.people.some(c => c.hp > 0 && !w.adult(c) && c.age < 12 && (c.mum === q.id || c.dad === q.id)));
  p.coins = 0; p.hungry = 5; p.bold = 0.8;
  poor.hungry = poor.pop;
  assert.equal(w.living(p), "vagrant", "takes to the road");
  for (const o of vs.slice(1)) { o.food = Math.max(o.food, o.pop * 60); o.hungry = 0; }
  p.job = "vagrant"; p.wait = 0; p.task = "idle";
  const home = p.home;
  for (let d = 0; d < 20 && p.home === home; d++) { poor.hungry = poor.pop; w.step(24); }
  assert.notEqual(p.home, home, "and settles where there is food (" + w.villages[p.home].name + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder people on the road and in camps: off is the world before; a band that does not farm, shares and has no ruler; its camp moves; the poor take to the road and settle");
