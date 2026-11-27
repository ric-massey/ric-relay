// Water to drink (TODO.md item 6a, 2026-11-16).
//
// What is held:
//   1. with "Thirst" off nobody fetches water, digs a well or dies of thirst, and no house's
//      water is touched (that the world is otherwise exactly as before was checked against the
//      engine before this item on three settings when it was written: README, "Water to drink");
//   2. with it on (the default), households fetch water, children from six too, and a village far
//      from fresh water digs a well;
//   3. a person with no water dies in about three days (Ric: "Real"), and gentler is about two weeks;
//   4. a default world gets through a month with hardly anybody dying of thirst.
//
// node projects/world-builder/test/water.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const fetching = a => /water|well/i.test(a);

// 1. Off.
{
  const w = People.create({ seed: 11, thirst: "off" });
  for (let h = 0; h < 24 * 5; h++) { w.step(1); for (const p of w.people) assert.ok(!fetching(w.activity(p)), "nobody fetches water with thirst off"); }
  assert.equal(w.stats().thirst, undefined, "no thirst count with thirst off");
  assert.ok(w.villages.every(v => !v.well), "no wells with thirst off");
  assert.ok(w.homes.every(h => h.water === 300), "no house's water is touched with thirst off");
}

// 2. On: fetching, children fetching, wells.
{
  const w = People.create({ seed: 11 });
  assert.equal(w.settings.thirst, "real", "real thirst is the default");
  let adults = 0, kids = 0;
  for (let h = 0; h < 24 * 20; h++) {
    w.step(1);
    for (const p of w.people) if (w.activity(p) === "Fetching water") { if (w.adult(p)) adults++; else { kids++; assert.ok(p.age >= 6, "no child under six fetches water"); } }
  }
  assert.ok(adults > 0 && kids > 0, "grown-ups and children fetch water: " + adults + " and " + kids);
  assert.ok(w.villages.some(v => v.well), "a village far from fresh water digs a well");
  assert.ok(w.homes.every(h => h.water >= 0 && h.water <= 300), "a house holds between none and its pots' worth");
}

// 3. Three days, or about two weeks: one person, kept from fetching, in a house with nothing.
for (const [thirst, lo, hi] of [["real", 2, 4.5], ["gentle", 9, 16]]) {
  /* Without rain, which would fill the pot (TODO 6b); and alone, so nobody they live with takes them
     off to another house (TODO 7b). */
  const w = People.create({ seed: 4, people: 60, thirst, rain: "off", plague: "none" });
  /* Somebody whose house is not beside fresh water (TODO 23: houses stand where a village's layout puts
     them, and the first one picked here came to stand by a river, where she drank). */
  const dry = h => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = Math.floor(h.x) + dx, y = Math.floor(h.y) + dy, i = y * w.cols + x; if (x >= 0 && y >= 0 && x < w.cols && y < w.rows && (w.ground[i] <= 2 || w.pond[i])) return false; } return true; };
  const p = w.people.find(q => w.adult(q) && q.dwelling >= 0 && dry(w.homes[q.dwelling]));
  for (const q of w.people) if (q.dwelling === p.dwelling && q !== p) q.dwelling = -1;
  const mate = w.byId.get(p.partner); if (mate) mate.partner = 0; p.partner = 0;
  const h = w.homes[p.dwelling], v = w.villages[p.home];   // and no well beside her house: with 15.12a's dice (2026-11-24) the village dug one within her reach, and she drank there
  p.food = 1e3; p.task = "idle"; p.wait = 1e9; p.x = p.tx = h.x; p.y = p.ty = h.y;
  let hours = 0;
  while (p.hp !== -99 && hours < 24 * 20) { for (let s = 0; s < People.ACTIONS_PER_HOUR; s++) { h.water = 0; if (p.dwelling >= 0) w.homes[p.dwelling].water = 0; v.well = null; p.wait = 1e9; w.advance(People.STEP); } hours++; }   // whichever house she is in (TODO 23: taken into a neighbour's after a day)   // emptied every step: a lodger fetches for the house (TODO 7b)
  const days = hours / 24;
  assert.ok(days >= lo && days <= hi, thirst + " thirst killed in " + days.toFixed(1) + " days, expected " + lo + " to " + hi);
}

// 4. A month of a default world.
{
  const w = People.create({ seed: 3 });
  w.step(24 * 30);
  assert.ok(w.stats().thirst <= 3, "hardly anybody dies of thirst in a default world's first month: " + w.stats().thirst);
}

console.log("world-builder water: off is off, households and children fetch, wells dug, three days without, a month survived");
