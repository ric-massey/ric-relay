// How technology moves (TODO 15.9, 2026-11-23). Ric: "i dont want it linear because it isnt."
//
// What is held:
//   1. "as before" is the old know-how, exactly (finds at the top, fingerprinted before 15.9);
//   2. (a) iron can be found by an early people with smithing and ore near; as before it could not;
//   3. (g) the telephone needs the telegraph, and the mobile phone the telephone and the radio;
//   4. (b) the hungry are pointed at farming's tools, traders at carts;
//   5. (c) without timber or ore near, boats and iron are neither found nor used;
//   6. (d) a thing new to a people starts poorly done and gets better;
//   7. (e) a stubborn ruler forbids a new thing; a war with a people that has it ends the ban;
//   8. (a) a people's age is read off what it knows.
//
// node projects/world-builder/test/tech.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 1226058922;   // the world below before 15.6f to 15.9

{
  const w = People.create({ seed: 5, people: 300, finds: 1, tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big", property: "old", passage: "old", taking: "old" });
  w.step(2000);
  assert.equal(print(w), OLD, "\"as before\" is the old know-how, exactly");
}
{
  const w = People.create({ seed: 5, people: 300, factions: 2, war: false }), o = People.create({ seed: 5, people: 300, factions: 2, war: false, tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" });
  w.step(48); o.step(48);
  const f = w.factions.findIndex(x => w.villages.some(v => v.alive && v.f === x.id && w.matOk(v.id, "iron")));
  assert.ok(f >= 0, "(a people with ore near)");
  assert.ok(w.techView(f).next.some(x => x.key === "iron"), "an early people with smithing and ore near can find iron");
  assert.ok(!o.techView(f).next.some(x => x.key === "iron"), "as before, it could not");
  assert.deepEqual(w.techNeeds("telephone"), ["telegraph"], "the telephone needs the telegraph");
  assert.deepEqual(w.techNeeds("phone"), ["telephone", "radio"], "and the mobile phone the telephone and the radio");
  assert.deepEqual(o.techNeeds("phone"), ["radio", "engine"], "(as before)");

  const v = w.villages.find(u => u.alive && u.pop > 10);
  const p = w.people.find(q => q.hp > 0 && q.home === v.id && w.adult(q));
  p.job = "farmer"; v.hungry = 0; v.famine = -1e9;
  const fed = w.needWeight(p.id, "plough");
  v.hungry = v.pop;
  assert.ok(w.needWeight(p.id, "plough") >= fed * 3, "the hungry are pointed at the plough");
  p.job = "trader";
  assert.ok(w.needWeight(p.id, "carts") > w.needWeight(p.id, "writing"), "traders at carts");

  v.mats = { wood: [], stone: -1, iron: -1, grass: [] }; v.wood = 0; v.iron = 0;
  assert.equal(w.matOk(v.id, "boats"), false, "no timber near: no boats");
  assert.equal(w.matOk(v.id, "iron"), false, "no ore near: no iron");
  v.iron = 5;
  assert.equal(w.matOk(v.id, "iron"), true, "unless it is bought in");
}
{
  const w = People.create({ seed: 5, people: 300, factions: 2, war: false });
  w.step(48);
  const f = w.factions[0], lead = w.people.find(p => p.id === f.leader);
  lead.stub = 1; lead.curious = 0; f.rule = "chief";
  w.learnAll(0, "writing", 0.5);
  w.step(24);
  assert.ok(f.banned, "a stubborn ruler forbids a new thing");
  assert.equal(w.has(0, "writing"), false, "and it is not used");
  w.learnAll(1, "writing", 0.5);
  w.step(24);
  w.startWar(0, 1);
  w.step(24);
  assert.ok(!f.banned, "at war with a people that has it, the ban ends");
  assert.equal(w.has(0, "writing"), true);
  assert.equal(f.eraNow, "bronze", "a farming people that writes is in its Bronze Age");
  const sk = w.techView(0).known.find(x => x.key === "writing").skill;
  assert.ok(sk < 0.9, "new to them, it is done poorly (" + sk + ")");
  w.step(24 * 60);
  const sk2 = w.techView(0).known.find(x => x.key === "writing");
  if (sk2) assert.ok(sk2.skill > sk, "and better with practice (" + sk + " -> " + sk2.skill + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder how technology moves: old know-how unchanged; anything findable; wiring; need; materials; skill; bans; the age read off");
