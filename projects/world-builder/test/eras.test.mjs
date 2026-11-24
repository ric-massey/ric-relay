// Eras as starting points; news by what is built; towers, cars, houses, medicine (TODO.md 15d,
// 2026-11-22). Ric: "Sure all 9 work"; different peoples in different eras, "Yes"; moving on by
// itself, "A setting, on or off"; news "shouldn't be for era it should be for what is built"; "cell
// towers must be a thing too".
//
// What is held:
//   1. with every people an early farmer and eras not moving on, the world is the one 15i left;
//   2. the same land and people from two starting eras fight, travel and hear news differently:
//      weapons that reach further and hit harder, armies that go further, the fighting season or
//      none, children who live, houses of another shape;
//   3. a telegraph line carries news at once to the people's other places with a line; cut, it
//      does not;
//   4. knocking down a tower slows the news within its reach, and nowhere else.
//
// node projects/world-builder/test/eras.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 322919713;   // print() of 15i's engine, seed 2, 60 days

// 1. As before.
{
  const w = People.create({ ...LATER, seed: 2 });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "early farmers, not moving on, are the world before 15d");
}

// 2. Two eras, the same land.
const early = People.create({ ...LATER, seed: 5, people: 300, factions: 2, villages: 4, era: "early", war: false });
const ind = People.create({ ...LATER, seed: 5, people: 300, factions: 2, villages: 4, era: "industrial", war: false });
early.step(24); ind.step(24);
{
  const a = early.armsOf(0), b = ind.armsOf(0);
  assert.ok(b.reach > a.reach && b.hit > a.hit, "rifles reach further and hit harder than hand weapons (" + a.name + " against " + b.name + ")");
  assert.ok(ind.reachOf(ind.factions[0]) > early.reachOf(early.factions[0]) * 1.5, "an army goes further by rail and horse");
  assert.equal(early.eraWar(early.factions[0]).season, true, "early farmers fight in the season");
  assert.equal(ind.eraWar(ind.factions[0]).season, false, "industrial armies the year round");
  assert.equal(ind.has(0, "telegraph"), true, "an industrial people knows the telegraph");
  assert.equal(early.has(0, "telegraph"), false, "early farmers do not");
  const h1 = { v: 0, len: 0, wid: 0 }, h2 = { v: 0, len: 0, wid: 0 };
  early.sizeHome(h1, 0.5); ind.sizeHome(h2, 0.5);
  assert.ok(h2.len < h1.len, "industrial houses are terraces, smaller than a hall house");
  const f = People.create({ ...LATER, seed: 5, people: 200, factions: 2, era: "foragers" });
  const h3 = { v: 0, len: 0, wid: 0 }; f.sizeHome(h3, 0.5);
  assert.equal(h3.len, h3.wid, "foragers' huts are round");
  assert.ok(f.factions[0].band, "and foragers live in bands");
  const modern = People.create({ ...LATER, seed: 5, people: 200, factions: 2, era: "modern" });
  assert.equal(modern.has(0, "medicine"), true, "a modern people has medicine");
}

// 3. A telegraph line.
{
  const w = ind;
  const mine = w.villages.filter(v => v.alive && v.f === 0);
  assert.ok(mine.length >= 3, "three places");
  const [a, b, c] = mine;
  w.buildWorks(a.id, "line", 1000); w.buildWorks(b.id, "line", 1000);
  w.workDay();
  const ev = w.report("famine", a.id, []);
  w.wire(ev);
  const heardIn = v => w.people.some(p => p.home === v.id && p.hp > 0 && w.inMind(p).some(m => m.kind === "news" && m.text && m.text.includes(a.name)));
  assert.ok(heardIn(b), "a place on the line hears at once");
  assert.ok(!heardIn(c), "a place off it does not");
  w.knock(b.id, "line");
  const ev2 = w.report("sick", a.id, []);
  w.wire(ev2);
  const heard2 = w.people.some(p => p.home === b.id && p.hp > 0 && w.inMind(p).some(m => m.kind === "news" && m.text && m.text.includes("sickness")));
  assert.ok(!heard2, "cut, it does not");
}

// 4. A tower.
{
  const w = People.create({ ...LATER, seed: 5, people: 300, factions: 2, era: "information", war: false });
  w.step(24);
  const vs = w.villages.filter(v => v.alive);
  const [t1, t2] = vs;
  for (const v of [t1, t2]) { v.wood = 500; w.buildWorks(v.id, "power", 5000); w.buildWorks(v.id, "tower", 5000); }
  w.workDay();
  assert.ok(t1.power && t2.power, "towers with power");
  const hears = (v, e) => w.people.filter(p => p.home === v.id && p.hp > 0 && w.inMind(p).some(m => m.kind === "news" && m.text && m.text.includes(e.text.slice(0, 12)) && m.text.includes(w.villages[e.vid].name))).length;
  const e1 = w.report("famine", t1.id, []); e1.vid = t1.id; w.wire(e1);
  assert.ok(hears(t2, e1) > 0 || Math.hypot(t1.x - t2.x, t1.y - t2.y) > 140, "news reaches another tower's place within reach at once");
  w.knock(t2.id, "tower"); w.workDay();
  const e2 = w.report("sick", t1.id, []); e2.vid = t1.id; w.wire(e2);
  assert.equal(hears(t2, e2), 0, "its tower down, that place hears nothing at once");
  const e3 = w.report("sick", t2.id, []); e3.vid = t2.id; w.wire(e3);
  assert.ok(hears(t1, e3) > 0 || Math.hypot(t1.x - t2.x, t1.y - t2.y) > 140, "and the other tower still carries news from there: slower only where the tower fell");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder eras: early farmers are the world before; two eras fight, travel and live differently; a line and a tower carry news, and cut or down, stop carrying it there only");
