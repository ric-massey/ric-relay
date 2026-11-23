// Babies, children and mothers dying, and the gap between births (TODO.md 15.5k, 2026-11-21). Ric
// (2026-11-20), all four yes: children dying of real causes at real rates, mothers dying in childbirth,
// the gap after a birth, and "Children" meaning as many as they had.
//
// What is held:
//   1. with "Babies and mothers" at "before" the world is the one 15.5l left, step for step;
//   2. a child's yearly chance of dying is highest in its first year and falls with age; hunger, foul
//      water and a dead mother raise it;
//   3. a mother nursing a living baby seldom conceives, and conceives readily once it is weaned or dead;
//   4. in a world over two years, a good share of the children born die young, and a few mothers in
//      childbirth, as in the past.
//
// node projects/world-builder/test/infancy.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 1596798464;   // print() of 15.5l's engine, seed 2, 60 days

// 1. Before: the world before.
{
  const w = People.create({ seed: 2, infancy: "before", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"Nearly every child grows up\" is the world before 15.5k");
}

const w = People.create({ seed: 3, people: 300, dirt: "fixed" });
w.step(2);

// 2. By age, hunger, water and a mother.
{
  const kid = w.people.find(p => !w.adult(p) && p.mum && w.people.some(m => m.id === p.mum && m.hp > 0));
  const keep = { age: kid.age, hungry: kid.hungry };
  kid.hungry = 0;
  kid.age = 0.5; const baby = w.childHazard(kid);
  kid.age = 3; const small = w.childHazard(kid);
  kid.age = 10; const big = w.childHazard(kid);
  assert.ok(baby > small * 3 && small > big * 3, "the first year worst, then falling (" + [baby, small, big].map(x => x.toFixed(3)).join(", ") + ")");
  /* a quarter or so of babies, nearly half before fifteen, before hunger, sickness and cold */
  const first = 1 - Math.exp(-baby), toFifteen = 1 - Math.exp(-(baby + small * 4 + big * 10));
  assert.ok(first > 0.15 && first < 0.3, "about a fifth of fed babies in their first year (" + first.toFixed(2) + ")");
  assert.ok(toFifteen > 0.25 && toFifteen < 0.45, "about a third of fed children before fifteen (" + toFifteen.toFixed(2) + ")");
  kid.age = 0.5; kid.hungry = 10;
  assert.ok(Math.abs(w.childHazard(kid) - baby * 2.5) < 1e-9, "hunger, two and a half times");
  kid.hungry = 0;
  const mum = w.people.find(m => m.id === kid.mum), hp = mum.hp;
  mum.hp = -99; assert.ok(Math.abs(w.childHazard(kid) - baby * 2) < 1e-9, "a baby with no mother, twice"); mum.hp = hp;
  Object.assign(kid, keep);
}

// 3. Nursing.
{
  const mum = w.people.find(p => p.sex === 0 && w.adult(p));
  const kid = w.people.find(p => !w.adult(p));
  const keep = { nurse: mum.nurse, age: kid.age };
  mum.nurse = kid.id; kid.age = 0.5;
  const nursing = w.fecund(mum);
  kid.age = 2; const weaned = w.fecund(mum);
  assert.ok(nursing < weaned * 0.2, "nursing a baby, seldom conceiving (" + nursing.toFixed(2) + " against " + weaned.toFixed(2) + ")");
  kid.age = 0.5; const hp = kid.hp; kid.hp = -99;
  assert.equal(w.fecund(mum), weaned, "and readily once the baby is dead");
  kid.hp = hp; mum.nurse = keep.nurse; kid.age = keep.age;
}

// 4. Two years of a world.
{
  const c = People.create({ seed: 7, people: 300 });
  c.step(24 * 730);
  const s = c.stats();
  assert.ok(s.births > 12, "children are born (" + s.births + ")");
  assert.ok(s.young > s.births * 0.08 && s.young < s.births * 0.6, "a good share of them die young (" + s.young + " of " + s.births + ")");
  assert.ok(s.childbirth <= Math.max(3, s.births * 0.04), "a few mothers at most die of a birth (" + s.childbirth + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder babies and mothers: \"before\" is the world before, children die most in their first year and more when hungry, in foul water or motherless, nursing spaces births, and a good share of children die young");
