// Siege engines, and how armies are raised (TODO.md 15p, 2026-11-22). From 15k's gaps 15 and 16.
//
// What is held:
//   1. with "Numbers alone" the world is the one 15o left, step for step;
//   2. besiegers working under a wall break it in their era's days, and it is mended when they go;
//   3. a place shut in and out of food gives itself up;
//   4. a feudal levy goes home after forty days with the army; the well-off pay scutage instead;
//   5. antiquity's army is paid and standing.
//
// node projects/world-builder/test/siege.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 3663990810;   // print() of 15o's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15p");
}

const make = era => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false, era });
  w.step(24 * 2);
  w.startWar(0, 1);
  w.warMap(); w.campaign(0, 1);
  return w;
};

// 2. Engines.
{
  const days = era => {
    const w = make(era), v = w.villages.find(u => u.alive && u.f === 1);
    v.wall = 1; v.breach = 0;
    let d = 0; while (v.breach < 1 && d < 200) { w.siegeWorks(v.id, 0, 6, 0); d++; }
    for (let i = 0; i < 5; i++) w.siegeWorks(v.id, 0, 0, 0);
    return [d, v.breach];
  };
  const [med, mended] = days("medieval"), [mod] = days("earlymodern");
  console.log("  a wall broken in " + med + " days by medieval engines, " + mod + " by guns; five days after they go: " + mended.toFixed(2) + " broken");
  assert.equal(med, 25, "trebuchets and miners: 25 days");
  assert.equal(mod, 8, "cannon: 8 days");
  assert.ok(mended < 1 && mended > 0.5, "mended a little each day they are gone");
}

// 3. Starved out.
{
  const w = make("medieval"), v = w.villages.find(u => u.alive && u.f === 1);
  const before = w.stats().starvedOut;
  for (let d = 0; d < 20 && v.f === 1; d++) { v.food = 0; v.hungry = v.adults; w.siegeWorks(v.id, 0, 6, 1); }
  console.log("  shut in with no food: " + (v.f === 0 ? "gave itself up" : "held") + " (" + (w.stats().starvedOut - before) + ")");
  assert.equal(v.f, 0, "a place shut in and starving gives itself up");
}

// 4. Feudal service and scutage.
{
  const w = make("medieval"), f = w.factions[0];
  assert.equal(w.serviceOf(0), "feudal");
  const mine = w.people.filter(p => p.f === 0 && p.job === "soldier" && p.hp > 0 && w.onCampaign(p));
  const home = w.people.find(p => p.f === 0 && p.job === "soldier" && p.hp > 0 && !w.onCampaign(p) && p.task !== "march" && p.task !== "fight");
  if (home) { home.coins = 100; home.bold = 0.4; }
  const chest = f.treasury;
  for (let d = 0; d < 41; d++) { for (const p of mine) if (p.job === "soldier") p.task = "march"; w.service(0); }
  const gone = mine.filter(p => p.job !== "soldier").length;
  console.log("  " + mine.length + " with the army: " + gone + " home after forty days; " + (home ? (home.job === "soldier" ? "the well-off one served" : "the well-off one paid scutage") : "nobody at home"));
  assert.ok(mine.length > 0 && gone === mine.length, "the levy goes home when its forty days are served");
  assert.ok(mine.every(p => w.servedOut(p)), "and is not called again this year");
  if (home) { assert.notEqual(home.job, "soldier", "the well-off pay instead"); assert.ok(f.treasury >= chest + 10 - 1e-9, "into the treasury"); }
}

// 5. Antiquity.
{
  const w = make("ancient");
  assert.equal(w.serviceOf(0), "paid", "a paid standing army");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder siegecraft and service: off is the world before; engines; starved out; forty days and scutage; paid armies");
