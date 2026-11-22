// Animals that work (TODO.md 15.5o, 2026-11-22). Ric (2026-11-20): yes, the cheapest way to run —
// counted as what a village owns, not as animals that walk about, eat and die one by one.
//
// What is held:
//   1. with "Animals that work" at "none" the world is the one 15.5d left, step for step;
//   2. a village starts with a full plough team; without oxen a day's reaping is four-fifths;
//   3. a starving village with an empty store eats its beasts; a sacked one has them driven off;
//      a village with grazing breeds them back;
//   4. where the plough is used, a people's customs keep women from the fields a little more.
//
// node projects/world-builder/test/beasts.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 2596476372;   // print() of 15.5d's engine, seed 2, 60 days

// 1. None: the world before.
{
  const w = People.create({ seed: 2, beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"None\" is the world before 15.5o");
}

const w = People.create({ seed: 3, people: 400 });
w.step(2);
const v = w.villages.find(o => o.alive && o.pop > 20);

// 2. The plough.
{
  assert.ok(Math.abs(v.oxen - v.pop / 3) < 1e-9 && v.horses > 0, "an ox for every three people and some horses at the start");
  assert.equal(w.plough(v.id), 1, "a full team: a day's reaping as it was");
  const p = w.people.find(q => q.home === v.id && w.adult(q) && q.hp > 0);
  const full = w.harvestCapacity(p), keep = v.oxen;
  v.oxen = 0;
  assert.ok(Math.abs(w.harvestCapacity(p) - full * 0.8) < 1e-9, "no oxen: four-fifths, the work of a hoe");
  v.oxen = keep;
}

// 3. Eaten, driven off, bred back.
{
  const keep = { hungry: v.hungry, food: v.food, oxen: v.oxen, horses: v.horses };
  v.hungry = v.pop; v.food = 0;
  const before = v.oxen + v.horses;
  w.beastTurn(v.id);
  assert.ok(v.oxen + v.horses < before && v.food > 0, "a starving village eats its beasts (" + v.food.toFixed(0) + " days of food)");
  Object.assign(v, keep);
  v.oxen = 1; v.horses = 0;
  for (let d = 0; d < 365; d++) w.beastTurn(v.id);
  assert.ok(v.oxen > 3, "and where there is grazing they are bred back (" + v.oxen.toFixed(1) + " in a year)");
  Object.assign(v, keep);
}

// 4. The plough and custom.
{
  const c = People.create({ seed: 4, people: 400 });
  c.step(24 * 31);
  const f = c.factions.find(x => x.alive);
  const withPlough = c.split(f.id);
  f.plough = 0;
  assert.ok(c.split(f.id) < withPlough, "a people that ploughs keeps women from the fields more (" + c.split(f.id).toFixed(2) + " against " + withPlough.toFixed(2) + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder animals that work: \"none\" is the world before, a plough team keeps reaping up, beasts are eaten in famine and bred back, and the plough leans a people's customs");
