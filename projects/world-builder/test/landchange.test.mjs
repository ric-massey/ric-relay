// Land that changes (TODO.md 15.5d, 2026-11-22). Ric (2026-11-20): people clear forest for fields, yes;
// resting land is the people's choice; herds manure fields, yes; shifting cultivation with it.
//
// What is held:
//   1. with "Land that changes" at "fixed" the world is the one 15.5n left, step for step;
//   2. a field reaped year after year tires toward half its strength, never below, and comes back
//      when rested;
//   3. a patient people rests tired land, an impatient one hardly;
//   4. a village short of land clears forest beside its fields: the square becomes grassland that
//      farms better, starts fresh, gives its wood to the store, and the page is told;
//   5. a cleared square nobody reaps is scrub in 25 years and forest in 50;
//   6. in a year of a default world, some forest is cleared and farmed land tires.
//
// node projects/world-builder/test/landchange.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Engine = createRequire(import.meta.url)("../people.js");
/* Item 15's parts off: this test holds its own part as it was built (TODO 15, 2026-11-22). */
const People = Object.assign({}, Engine, { create: s => Engine.create(Object.assign({ govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" }, s)) });
const FINGERPRINT = 3532844969;   // print() of 15.5n's engine, seed 2, 60 days
const G_GRASS = 5, G_FOREST = 6, YEAR_DAYS = 365;

// 1. Fixed: the world before.
{
  const w = People.create({ seed: 2, landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"The land never changes\" is the world before 15.5d");
}

// 2. Wear and rest.
{
  const w = People.create({ seed: 5, people: 300 });
  w.step(2);
  const v = w.villages.find(o => o.alive), i = Math.floor(v.y) * w.cols + Math.floor(v.x);
  v.manure = 0;
  const cap = w.fert[i] * w.tileCapacity * (1 + 1.5 * 0.5);   // a field in a default winter
  for (let k = 0; k < 4; k++) w.reapedFrom(i, cap, v.id);
  const ten = w.soil[i];
  assert.ok(ten < 0.8 && ten > 0.6, "four full fields reaped tire it (" + ten.toFixed(3) + ")");
  for (let k = 0; k < 200; k++) w.reapedFrom(i, cap, v.id);
  assert.ok(w.soil[i] >= 0.5 && w.soil[i] < 0.52, "and it settles at half, never below (" + w.soil[i].toFixed(3) + ")");
  w.lastCut[i] = w.tick - 200 * 24;
  for (let d = 0; d < 730; d++) w.restSoil();
  assert.ok(w.soil[i] > 0.8, "two years. rest bring most of it back (" + w.soil[i].toFixed(3) + ")");
  /* dung from the herds puts it back as it is reaped */
  w.soil[i] = 0.6; v.manure = 0.3; w.reapedFrom(i, 0.001, v.id);
  assert.ok(w.soil[i] > 0.65, "manure (" + w.soil[i].toFixed(3) + ")");
}

// 3 to 5. Custom, clearing, regrowth.
{
  const own = "1.patient=0.9,2.patient=0.1";
  const w = People.create({ seed: 1, people: 400, own: own });
  w.step(2);
  /* 3 */
  assert.ok(w.restWill(0) > 0.6 && w.restWill(1) < 0.05, "a patient people rests tired land, an impatient one hardly (" + w.restWill(0).toFixed(2) + ", " + w.restWill(1).toFixed(2) + ")");
  /* 4: the village with forest nearest its fields, made short of food */
  let v = null, i0 = -1;
  for (const o of w.villages) {
    if (!o.alive) continue;
    o.hungry = o.pop; w.landTurn(o.id); o.hungry = 0;
    if (o.clearAt >= 0) { v = o; i0 = o.clearAt; break; }
  }
  assert.ok(v, "a village short of land picks forest beside its fields to clear");
  assert.equal(w.ground[i0], G_FOREST, "it is forest");
  const f0 = w.fert[i0], logged = w.groundLog.length, wood = v.wood;
  w.clearedFor(v.id);
  assert.equal(w.ground[i0], G_GRASS, "cleared, it is grassland");
  assert.ok(w.fert[i0] > f0, "and farms better (" + f0.toFixed(2) + " to " + w.fert[i0].toFixed(2) + ")");
  assert.equal(w.soil[i0], 1, "fresh");
  assert.ok(v.wood > wood, "its wood goes to the store");
  assert.equal(w.groundLog.length, logged + 3, "and the page is told");
  /* 5 */
  const c = w.cleared.get(i0); assert.ok(c, "the square is remembered as cleared");
  const fresh = w.fert[i0];
  c.last = w.tick - 26 * YEAR_DAYS * 24; w.regrow();
  assert.ok(w.fert[i0] < fresh && w.ground[i0] === G_GRASS, "scrub after 25 years");
  c.last = w.tick - 51 * YEAR_DAYS * 24; w.regrow();
  assert.equal(w.ground[i0], G_FOREST, "forest again after 50");
  assert.ok(!w.cleared.has(i0), "and forgotten as a field");
}

// 6. A default world's year.
{
  const w = People.create({ seed: 3 });
  w.step(24 * 365);
  const s = w.stats();
  assert.ok(s.cleared > 0, "forest is cleared in a year (" + s.cleared + " squares)");
  let tired = 0;
  for (let i = 0; i < w.soil.length; i++) if (w.soil[i] < 0.95) tired++;
  assert.ok(tired > 10, "and farmed land tires (" + tired + " squares)");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder land that changes: \"fixed\" is the world before, farmed land tires to half and rests back, villages short of land clear forest that grows back if left, and a year of a world shows it");
