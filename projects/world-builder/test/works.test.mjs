// Work and workplaces (TODO.md 15f, 2026-11-22). Ric: "technology needs to be more of a thing and
// there does need to be jobs"; jobs "have to match what the city needs".
//
// What is held:
//   1. with "Farming, crafts and trade only" the world is the one 15e left, step for step;
//   2. a living exists where the place needs it and can pay: a healer where people are sick and
//      households have coins to spare, none where nobody is sick; a teacher only where people write;
//      and a teacher who writes teaches the children of families who can pay;
//   3. no workplace is placed: none stands at the start, and a village wants a mill only once its
//      people know how and it is by a river;
//   4. a works fed by a power works makes three times what a bench does, and knocking the power works
//      down stops it.
//
// node projects/world-builder/test/works.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 3986133300;   // print() of 15e's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15f");
}

/* Seed 5 since 2026-11-27: on TODO 23 and 24's land, with field work and friends, seed 3's teacher never taught
   (a starving village, short of water); over seeds 3 to 8 children taught in a month were 0, 3, 7, 1, 0, 8,
   against 6, 11, 6, 2, 1, 2 before. */
const w = People.create({ ...LATER, seed: 5, people: 400, war: false, finds: 0.2 });
w.step(24 * 2);
const v = w.villages.filter(x => x.alive).sort((a, b) => b.pop - a.pop)[0];
const here = w.people.filter(p => p.home === v.id && p.hp > 0);

// 2. Needed and paid for.
{
  for (const p of here) p.sick = 0;
  for (const p of here) if (w.adult(p)) p.coins = 40;
  w.workDay();
  assert.equal(w.serviceWorth(v.id, "healer"), 0, "no healer where nobody is sick");
  for (const p of here.slice(0, 12)) p.sick = 100;
  w.workDay();
  assert.ok(w.serviceWorth(v.id, "healer") > 0, "a healer where people are sick and can pay");
  for (const p of here) if (w.adult(p)) p.coins = 0;
  w.workDay();
  assert.equal(w.serviceWorth(v.id, "healer"), 0, "but not where nobody has a coin to spare");
  for (const p of here) if (w.adult(p)) p.coins = 40;
  w.workDay();
  assert.equal(w.serviceWorth(v.id, "teacher"), 0, "no teacher where nobody writes");
  for (const p of here.filter(w.adult).slice(0, 5)) w.teach(p, "writing");
  w.knowDay(); w.workDay();
  assert.ok(w.serviceWorth(v.id, "teacher") > 0, "a teacher where people write and there are children");
}

// 2b. A teacher who writes teaches the children of families who can pay.
{
  const t = here.find(p => w.adult(p) && p.know != null && (p.know & (1 << w.TECH.indexOf("writing"))));
  t.job = "teacher"; t.wait = 0;
  const before = w.stats().taught;
  w.step(24 * 30);
  assert.ok(w.stats().taught > before, "children learn to write (" + (w.stats().taught - before) + " in a month)");
}

// 3. Nothing placed.
{
  assert.ok(w.villages.every(x => !x.works || !Object.values(x.works).some(b => b.built)), "no workplace stands that nobody built");
  assert.ok(!w.worksWanted(v.id).includes("power"), "nobody wants a power works who does not know the steam engine");
}

// 4. Power.
{
  for (const p of here.filter(w.adult).slice(0, 5)) w.teach(p, "steam");
  w.knowDay();
  v.wood = 500;
  w.buildWorks(v.id, "power", 5000); w.buildWorks(v.id, "works", 5000);
  w.workDay();
  assert.ok(v.power, "a power works with wood runs");
  const crafter = here.find(w.adult);
  const powered = w.craftOutput(crafter, v);
  assert.ok(w.knock(v.id, "power"), "knocked down");
  w.workDay();
  assert.ok(!v.power, "no power");
  const bench = w.craftOutput(crafter, v);
  assert.ok(Math.abs(powered - bench * 3) < 1e-9, "the works made three times a bench, and makes a bench's now (" + powered.toFixed(2) + " → " + bench.toFixed(2) + ")");
  w.buildWorks(v.id, "power", 5000); v.wood = 0; w.workDay();
  assert.ok(!v.power, "and a power works with no wood stops too");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder work and workplaces: off is the world before; livings where needed and paid for; nothing placed; power works feed works and their loss stops them");
