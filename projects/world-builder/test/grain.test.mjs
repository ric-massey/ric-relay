// The government's grain (TODO.md 15.5b2, 2026-11-21). Ric: how the grain reaches people has
// "options based on the type of ruler there is"; hard leaders force hoarders to sell; laying in
// after the harvest "Both, by traits".
//
// What is held:
//   1. a leader who can spare it sets coins aside in a village going short, and carriers bring grain
//      to it, paid from those coins into the store; no coin is made or lost;
//   2. a greedy leader sets nothing aside;
//   3. a bold leader makes households with more than their winter's store sell the rest to the
//      store, and they hold it against the leader; a timid one does not;
//   4. a ration's price: the treasury pays as much of it as the leader is warmer than greedy;
//   5. a patient leader lays grain in during the months after the reaping; an impatient one does not.
//
// node projects/world-builder/test/grain.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People0 = createRequire(import.meta.url)("../people.js");
/* TODO 15.5 (2026-11-22): the winter store checked (60 days) is a fixed guess that the climate's swing (15.5q) and households with children (15.5l, k) move; the rest sits near its thresholds by seed; so its worlds keep these at their old values unless a check sets them. */
const PIN = { health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" };
const People = Object.assign({}, People0, { create: (o, ...rest) => People0.create(Object.assign({}, PIN, o), ...rest) });

const city = w => w.villages.reduce((a, b) => (b.pop > a.pop ? b : a));
/* A town held hungry: in the engine a town with nothing gathers what it can and half of it moves
   away in a day, so what is tested is the leader's answer to a town going hungry, not whether it does. */
function hungry(w, town, hours, each, spare = new Set()) {
  for (let h = 0; h < hours; h++) {
    for (const p of w.people) if (p.home === town.id && !spare.has(p)) { p.food = Math.min(p.food, 0.3); p.hungry = Math.max(p.hungry, 1); }
    w.step(1); if (each) each();
  }
}
function rule(w, f, traits) {
  f.rule = "chief";   // the leader's own stats, not leaned to the people's (15a)
  const lead = w.people.find(p => p.id === f.leader);
  Object.assign(lead, traits);
  return lead;
}

// 1 and 2. A public order, and a greedy leader who makes none.
for (const greedy of [false, true]) {
  const w = People.create({ seed: 3, people: 900, map: 20, places: "city", start: "winter", materials: "goods" });
  const town = city(w), f = w.factions[town.f];
  rule(w, f, greedy ? { warm: 0, greed: 1, bold: 0, patient: 0 } : { warm: 1, greed: 0, bold: 0, patient: 0 });
  f.treasury += 4000;   // a full treasury
  for (const p of w.people) if (p.home === town.id) { p.food = 0; p.coins = 0; }
  for (const v of w.villages) if (v !== town) for (const p of w.people) if (p.home === v.id) p.food += 400;
  town.food = 0;
  const before = (w.stats().money - w.stats().minted);
  let most = 0;
  hungry(w, town, 24 * 20, () => { most = Math.max(most, town.bid); });
  const s = w.stats();
  if (greedy) assert.equal(most, 0, "a greedy leader sets nothing aside");
  else {
    assert.ok(most > 100, "a warm leader sets coins aside for the town (" + Math.round(most) + ")");
    assert.ok(s.publicGrain > 0, "and grain is carried in on them (" + Math.round(s.publicGrain) + " days)");
  }
  assert.ok(Math.abs((s.money - s.minted) - before) < 1e-6, "no coin made or lost (" + ((s.money - s.minted) - before) + ")");
}

// 3. Hoarders made to sell, by a bold leader only.
for (const bold of [1, 0]) {
  const w = People.create({ seed: 5, people: 600, map: 20, places: "city", start: "winter", materials: "goods" });
  const town = city(w), f = w.factions[town.f];
  const lead = rule(w, f, { warm: 0.5, greed: 0.5, bold: bold, patient: 0 });
  f.treasury += 3000;
  const mine = w.people.filter(p => p.home === town.id && p.age >= 20 && p !== lead);
  for (const p of mine) p.food = 0;
  const rich = mine.slice(0, 5);
  for (const p of rich) p.food = 600;   // well past a winter's store
  /* Their households are left out of the hunger below: a partner or a child at home shares the pot, and
     `hungry` empties everybody else's every hour, so a shared pot was emptied through them (found
     2026-11-24, when 15.12a's dice gave one hoarder a household). */
  const home = new Set(rich);
  for (const p of rich) for (const q of w.people) if (q.home === p.home && (q.id === p.partner || q.mum === p.id || q.dad === p.id)) home.add(q);
  town.food = 0;
  hungry(w, town, 30, null, home);
  const sold = w.stats().forcedGrain;
  if (bold) {
    assert.ok(sold > 50, "a bold leader makes the hoarders sell (" + Math.round(sold) + " days)");
    assert.ok(rich.some(p => p.forced > 0), "and they hold it against the leader");
    /* A winter's store is at most a few hundred days for somebody feeding a family; each kept one. */
    /* (Those not made to sell may have shared their pot with a partner, as households do.) */
    const made = rich.filter(p => p.forced > 0);
    assert.ok(made.every(p => p.food > 60), "never into their own winter (" + made.map(p => Math.round(p.food)).join(", ") + ")");
  } else assert.equal(sold, 0, "a timid leader does not");
}

// 4. The ration's price.
{
  const w = People.create({ seed: 5, people: 600, map: 20, places: "city", start: "winter", materials: "goods" });
  const town = city(w), f = w.factions[town.f];
  rule(w, f, { warm: 0.9, greed: 0.2, bold: 0, patient: 0 });
  w.step(24);
  assert.ok(Math.abs(f.cheap - 0.7) < 1e-9, "the treasury pays warm less greed of the price (" + f.cheap + ")");
  rule(w, f, { warm: 0.2, greed: 0.9 });
  w.step(24);
  assert.equal(f.cheap, 0, "the greedy sell at the store's price");
}

// 5. Laying in after the harvest.
for (const patient of [1, 0]) {
  const w = People.create({ seed: 4, people: 600, map: 20, start: "autumn", materials: "goods" });
  const f = w.factions[0];
  rule(w, f, { warm: 1, greed: 0, bold: 0, patient: patient });
  f.treasury += 3000;
  let stocking = false;
  for (let d = 0; d < 80 && !stocking; d++) { w.step(24); stocking = w.villages.some(v => v.f === f.id && v.bidFor === "stock"); }
  assert.equal(stocking, !!patient, patient ? "a patient leader lays grain in after the harvest" : "an impatient one does not");
}

console.log("world-builder grain: public orders, greedy leaders, hoarders made to sell, rations, laying in");
