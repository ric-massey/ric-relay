// Materials and other ways to live (TODO.md item 9, 2026-11-17). Ric: materials "Few and clear" —
// wood, stone, ore, wool and hides — and firewood "Yes, as a setting".
//
// What is held:
//   1. a village by a forest and a village by water live differently without being told to: the
//      forest one cuts wood and hunts, the one by water fishes, and one without either does neither;
//   2. wood, stone and ore go into the store and are used: houses, what crafters make, gear;
//   3. firewood burns in the cold, and a village with none is cold; off, nothing burns;
//   4. on treeless land soldiers still get shields, of hide (seed 4 has no forest at all);
//   5. "One kind of goods" leaves nothing of it: no wood, no woodcutters, no cutting.
//
// node projects/world-builder/test/materials.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People0 = createRequire(import.meta.url)("../people.js");
/* TODO 15.5 (2026-11-22): the firewood checked is the village store's (9c); each household's own is 15.5f, tested in hearth.test.mjs; so its worlds keep these at their old values unless a check sets them. */
const PIN = { hearth: "village" };
const People = Object.assign({}, People0, { create: (o, ...rest) => People0.create(Object.assign({}, PIN, o), ...rest) });

// 1 and 2. Twenty days of the default world; each village's hours by what they were doing.
{
  const w = People.create({ seed: 11 });
  const hours = new Map();
  for (let h = 0; h < 24 * 20; h++) {
    w.step(1);
    for (const p of w.people) if (w.adult(p)) {
      let m = hours.get(p.home); if (!m) hours.set(p.home, m = {});
      m[p.task] = (m[p.task] || 0) + 1; m.all = (m.all || 0) + 1;
    }
  }
  const share = (v, k) => { const m = hours.get(v.id) || {}; return (m[k] || 0) / Math.max(1, m.all || 0); };
  const live = w.villages.filter(v => v.alive && v.mats);
  const forest = live.reduce((a, b) => (b.mats.wood.length > a.mats.wood.length ? b : a));
  const bare = live.reduce((a, b) => (b.mats.wood.length < a.mats.wood.length ? b : a));
  assert.ok(forest.mats.wood.length > 100 && bare.mats.wood.length < 10, "a forest village and one with hardly any (" + forest.mats.wood.length + ", " + bare.mats.wood.length + ")");
  assert.ok(share(forest, "cut") + share(forest, "hunt") > share(bare, "cut") + share(bare, "hunt") + 0.02,
    "the forest village cuts and hunts more: " + ((share(forest, "cut") + share(forest, "hunt")) * 100).toFixed(1) + "% against " + ((share(bare, "cut") + share(bare, "hunt")) * 100).toFixed(1) + "%");
  const wet = live.filter(v => v.fishing), dry = live.filter(v => !v.fishing);
  if (wet.length && dry.length) {
    assert.ok(wet.some(v => share(v, "fish") > 0.01), "a village by water fishes");
    assert.ok(dry.every(v => share(v, "fish") === 0), "and one without water does not");
  }
  const s = w.stats();
  assert.ok(s.wood > 50 && s.iron > 10, "wood is cut and ore mined: " + Math.round(s.wood) + ", " + Math.round(s.iron));
  assert.ok(s.meat > 0 && s.wool > 0, "herds and game give meat and wool");
  const priced = live.filter(v => v.mats.wood.length === 0);
  if (priced.length) assert.ok(priced.every(v => v.priceWood > forest.priceWood), "wood is dearer where there is no forest");
}

// 3. Firewood.
{
  const go = firewood => { const w = People.create({ seed: 11, start: "winter", firewood });
    for (const v of w.villages) v.wood = 0.01;
    w.step(26); return w; };
  const cold = go("real"), warm = go("off");
  assert.ok(cold.villages.some(v => v.alive && v.cold > 0.5), "a village with no wood in winter is cold");
  assert.ok(warm.villages.every(v => v.cold === 0), "with firewood off nobody is cold");
  const w = People.create({ seed: 11, start: "winter" });
  const before = w.villages.reduce((n, v) => n + v.wood, 0); w.step(25);
  assert.ok(w.villages.reduce((n, v) => n + v.wood, 0) < before + w.stats().wood, "fires burn wood in winter");
}

// 4. Shields of hide on treeless land.
{
  const w = People.create({ seed: 4 });
  assert.ok(w.ground.every(g => g !== 6), "seed 4 has no forest");
  w.step(24 * 90);
  const soldiers = w.people.filter(p => p.job === "soldier");
  assert.ok(soldiers.filter(p => (p.gear.shield || 0) > 0).length >= soldiers.length * 0.6, "most of its soldiers have shields");
}

// 5. Off.
{
  const w = People.create({ seed: 11, materials: "goods" });
  w.step(24 * 10);
  assert.ok(w.stats().wood === undefined && !w.people.some(p => p.job === "woodcutter" || p.task === "cut"), "one kind of goods: no wood at all");
}

console.log("world-builder materials: forest and water live differently, materials used, firewood, hide shields, off");
