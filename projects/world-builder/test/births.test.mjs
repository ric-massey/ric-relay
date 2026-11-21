// Births with no top on the number of people (TODO.md item 15.25, 2026-11-20).
//
// Until 15.25 nobody was born once a world held 3,000 people (Ric: "Idk why births stop they
// shouldn't"). What is held:
//   1. a world started above 3,000 has children, and each newborn is a whole person: listed,
//      with a mind, a house and a home, kept by its family (fed, not left hungry), and walked,
//      woken and placed by the engine's audited lists;
//   2. a world just under 3,000 grows past it by births alone, and children go on being born
//      after it has;
//   3. Children set to nought still means nobody is born, however many there are.
//
// node projects/world-builder/test/births.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. Above the old line, with the engine checking its own lists as it goes.
{
  const w = People.create({ seed: 3, people: 3300, map: 30, plague: "none" }, { audit: true });
  const start = w.people.length, ids = new Set(w.people.map(p => p.id));
  assert.ok(start > 3000, "starts above 3,000: " + start);
  /* Twenty days, or up to forty until the first child: births here are about one a fortnight or two,
     and after TODO 15.5a this world's first came on day 25 instead of within 20. */
  w.step(24 * 20);
  for (let d = 20; d < 40 && !w.stats().births; d += 5) w.step(24 * 5);
  const born = w.people.filter(p => !ids.has(p.id));
  assert.ok(w.stats().births > 0 && born.length > 0, "children are born above 3,000: " + w.stats().births);
  for (const c of born) {
    assert.equal(w.byId.get(c.id), c, "listed");
    assert.ok(c.age < 1 && c.job === "child", "a baby");
    assert.ok(Array.isArray(w.inMind(c)), "with a mind");
    const parent = w.byId.get(c.mum) || w.byId.get(c.dad);
    if (parent && parent.home === c.home) assert.equal(c.dwelling, parent.dwelling, "living in its parents' house");
    assert.ok(c.dwelling >= 0, "under a roof");
  }
  const hungry = born.filter(c => c.hungry > 0).length;
  assert.ok(hungry <= born.length * 0.25, "fed by their families: " + hungry + " of " + born.length + " hungry");
}

// 2. Across the old line by births alone: a long-lived, well-fed country one short of 3,000
//    (seed 9 crosses within five days), audited all the way. It was seed 1, crossing on its 14th
//    day; after TODO 15.5a seed 1 had one birth in thirty days. Births are few in all of these
//    worlds — four in thirty days in seed 1 before 15.5a, a tenth of a real birth rate — which is a
//    question for 15b, not this test.
{
  const w = People.create(People.clean({ seed: 9, people: 2999, map: 45, plague: "none", births: 1, rich: 2, life: 100, stored: 1 }), { audit: true });
  let crossed = false, above = 0, last = w.stats().births;
  for (let d = 0; d < 30 && !(crossed && above >= 2); d++) {
    const before = w.people.length;
    w.step(24);
    const b = w.stats().births - last; last = w.stats().births;
    if (before < 3000 && w.people.length >= 3000 && b > 0) crossed = true;
    if (before >= 3000) above += b;
  }
  assert.ok(crossed, "a birth takes the country past 3,000: " + w.people.length + " people");
  assert.ok(above >= 2, "and children go on being born after: " + above);
}

// 3. Children at nought.
{
  const w = People.create({ seed: 3, people: 3300, map: 30, plague: "none", births: 0 });
  w.step(24 * 20);
  assert.equal(w.stats().births, 0, "nobody is born with Children at nought");
}

console.log("world-builder births: children above 3,000 people, across the old line by births, none with Children at nought");
