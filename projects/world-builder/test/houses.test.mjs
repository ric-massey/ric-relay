// Houses as buildings, and people at their real size (TODO.md item 7a, 2026-11-16).
//
// What is held:
//   1. people are half a metre wide unless "Bodies" says otherwise (Ric: "Real size by default");
//   2. everybody has a house; a couple shares one, and so does a child with a parent at home;
//   3. a house has a real size (12 to 24 m long, 4.5 to 7 m wide) and never stands in water;
//   4. a richer household has a bigger house than a poorer one;
//   5. somebody gone to bed is inside their own house, not near it;
//   6. a household that marries in moves into the house.
//
// node projects/world-builder/test/houses.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const M = 1 / 250;

for (const set of [{ seed: 11 }, { seed: 2, sea: 0.6, people: 600 }, { seed: 5, map: 60, people: 900 }]) {
  const w = People.create(set), name = JSON.stringify(set);
  assert.equal(w.settings.bodies, "real", "real size is the default");
  for (const p of w.people) assert.ok(p.dwelling >= 0 && w.homes[p.dwelling], "everybody has a house " + name);
  for (const p of w.people) {
    const mate = p.partner && w.byId.get(p.partner);
    if (mate && mate.home === p.home) assert.equal(p.dwelling, mate.dwelling, "a couple shares a house " + name);
  }
  for (const p of w.people) {
    const mum = w.byId.get(p.mum);
    if (!w.adult(p) && mum && mum.home === p.home && !p.partner) {
      const dad = w.byId.get(p.dad);
      assert.ok(p.dwelling === mum.dwelling || (dad && p.dwelling === dad.dwelling), "a child lives with a parent at home " + name);
    }
  }
  assert.ok(w.homes.length < w.people.length, "households share: fewer houses than people " + name);
  for (const h of w.homes) {
    assert.ok(h.len >= 12 * M - 1e-9 && h.len <= 24 * M + 1e-9 && h.wid >= 4.5 * M - 1e-9 && h.wid <= 7 * M + 1e-9, "a house is house-sized " + name);
    const g = w.ground[Math.floor(h.y) * w.cols + Math.floor(h.x)];
    assert.ok(g !== 0 && g !== 1, "no house stands in the sea or a lake " + name);
  }
  /* Richer, bigger: the worth of each house's household at the start against its length. */
  const worth = new Map();
  for (const p of w.people) worth.set(p.dwelling, (worth.get(p.dwelling) || 0) + p.coins);
  const ranked = [...worth.entries()].sort((a, b) => a[1] - b[1]);
  const poor = ranked.slice(0, Math.max(1, ranked.length >> 2)), rich = ranked.slice(-Math.max(1, ranked.length >> 2));
  const mean = list => list.reduce((s, [id]) => s + w.homes[id].len, 0) / list.length;
  if (rich[0][1] > poor[poor.length - 1][1]) assert.ok(mean(rich) > mean(poor), "the richest quarter has bigger houses than the poorest " + name);
}

// 5. To bed means into the house.
{
  const w = People.create({ seed: 11 });
  w.step(28);
  const asleep = w.people.filter(p => p.task === "sleep" && Math.hypot(p.x - p.tx, p.y - p.ty) < 1e-9);
  assert.ok(asleep.length > 50, "a night has sleepers: " + asleep.length);
  for (const p of asleep) {
    const h = w.homes[p.dwelling], c = Math.cos(h.ang), s = Math.sin(h.ang), dx = p.x - h.x, dy = p.y - h.y;
    const along = Math.abs(dx * c + dy * s), across = Math.abs(-dx * s + dy * c);
    assert.ok(along <= h.len / 2 + 1e-9 && across <= h.wid / 2 + 1e-9, "a sleeper lies inside their own house");
  }
}

// 6. Married into a house.
{
  const w = People.create({ seed: 7, people: 300 });
  w.step(24 * 20);
  for (const p of w.people) {
    const mate = p.partner && w.byId.get(p.partner);
    if (mate && mate.home === p.home && mate.hp !== -99) assert.equal(p.dwelling, mate.dwelling, "partners live in one house after twenty days");
  }
}

console.log("world-builder houses: real size, a house each household, house-sized, richer bigger, asleep inside");
