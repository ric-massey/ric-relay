// Sickness in armies and in their wake (TODO.md 15m, 2026-11-22). From 15k's research: before the
// 20th century sickness killed more soldiers than the enemy (about four to one in the Napoleonic wars,
// two to one in the American Civil War), and armies carried it to the places they passed.
//
// What is held:
//   1. with "Sickness in armies" off the world is the one 15l left, step for step;
//   2. soldiers in a gathering army fall to camp fever;
//   3. the sick carry it to a place they pass.
//
// node projects/world-builder/test/armysick.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 3635171381;   // print() of 15l's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15m");
}

const make = () => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false });
  w.step(24 * 2);
  w.startWar(0, 1);
  w.warMap(); w.campaign(0, 1);
  return w;
};

// 2. Camp fever: a hundred days in the gathering army.
{
  const w = make(), f = w.factions[0];
  const mine = w.people.filter(p => p.f === f.id && p.job === "soldier" && p.hp > 0 && w.onCampaign(p));
  let caught = 0;
  for (let d = 0; d < 100; d++) {
    for (const p of mine) { if (p.sick > 0) { caught++; p.sick = 0; } }
    w.campSickness(f.id);
  }
  for (const p of mine) if (p.sick > 0) caught++;
  console.log("  " + mine.length + " soldiers with the army a hundred days: " + caught + " fevers; camp foulness " + f.campFoul.toFixed(2));
  assert.ok(mine.length >= 5, "an army gathering");
  assert.ok(f.campFoul > 0 && w.campFoulOf(mine[0]) === f.campFoul, "the camp is foul");
  assert.ok(caught >= mine.length * 0.4, "about one fever a soldier in a hundred days");
}

// 3. Carried: a sick soldier by a village of the enemy's leaves it there.
{
  const w = make(), f = w.factions[0];
  const p = w.people.find(q => q.f === f.id && q.job === "soldier" && q.hp > 0 && w.onCampaign(q));
  const v = w.villages.find(u => u.alive && u.f === 1);
  let spread = 0;
  for (let d = 0; d < 200 && !spread; d++) { w.place(p, v.x + 1, v.y + 1); p.sick = 100; w.campSickness(f.id); spread = w.stats().armySpread; }
  console.log("  a sick soldier by " + v.name + ": carried there " + spread + " time(s)");
  assert.ok(spread >= 1, "the sick carry it to places they pass");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder sickness in armies: off is the world before; camp fever; carried to places passed");
