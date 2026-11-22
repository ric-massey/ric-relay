// Villages, towns and cities (TODO.md item 8, 2026-11-17). Ric: "all of this being choices";
// a city far out is drawn as one block, its houses close in ("Houses, then a block").
//
// What is held:
//   1. a place is a village, a town (400 and more) or a city (5,000 and more) by its size;
//   2. "Where they live at first" means what it says: hamlets of about fifteen, villages as before,
//      a market town with two-fifths of each faction, or a city with half of everybody;
//   3. food goes to a town that is short from villages that have it, sold there, and is counted as
//      brought in, which is what lets a place outgrow its own land.
//
// node projects/world-builder/test/towns.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const placeFor = n => n >= 5000 ? "city" : n >= 400 ? "town" : "village";

// 1 and 2. Sizes, and where they live at first.
{
  const count = w => { const n = new Map(); for (const p of w.people) n.set(p.home, (n.get(p.home) || 0) + 1); return n; };
  const v = People.create({ seed: 7, people: 2000, map: 40 });
  for (const x of v.villages) assert.equal(x.place, placeFor(count(v).get(x.id) || 0), x.name + " is a " + x.place + " by its size");
  const h = People.create({ seed: 7, people: 2000, map: 40, places: "hamlets" });
  const hn = [...count(h).values()];
  assert.ok(h.villages.length >= 100 && Math.max(...hn) <= 20, "hamlets: many places of about fifteen (" + h.villages.length + ", the biggest " + Math.max(...hn) + ")");
  const c = People.create({ seed: 7, people: 12000, map: 60, places: "city" });
  const cn = count(c), big = Math.max(...cn.values());
  assert.equal(big, 6000, "a city with half of everybody");
  assert.ok(c.villages.some(x => x.place === "city"), "and it is a city by its size");
  const t = People.create({ seed: 7, people: 4000, map: 40, places: "towns" });
  const tn = count(t);
  for (const f of t.factions) {
    const mine = t.villages.filter(x => x.f === f.id).map(x => tn.get(x.id) || 0);
    assert.ok(Math.max(...mine) >= 0.4 * 4000 / t.factions.length - 1, f.name + " has a market town of two-fifths of its people");
  }
}

// 3. Market day.
{
  /* dirt at the fixed toll (15.5r): six days of market from one seed swing with the dice (seeds 7, 8, 9: 135, 36, 62 days sold, and 0, 45, 253 with dirt from its causes), and this one was found in the world before it */
  const w = People.create({ seed: 7, people: 3000, map: 40, places: "city", start: "winter", materials: "goods", dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0 });   // market day alone, without wood and herds to tend
  w.step(26);                                                      // a day, so every place knows where its market is
  const town = w.villages.reduce((a, b) => (b.pop > a.pop ? b : a));
  const before = town.importAvg;
  /* A good harvest in the stores of the villages round it, so food is cheap there; the town's own store
     emptied, so it is dear. */
  for (const v of w.villages) if (v !== town) v.food = v.pop * 30;
  town.food = 0;
  let going = 0;
  for (let h = 0; h < 24 * 6; h++) { w.step(1); for (const p of w.people) if (p.cargo && p.cargo.what === "food" && p.at === town.id) going++; }
  assert.ok(going > 0, "households take food to the town's market");
  assert.ok(w.stats().market > 0, "and sell it door to door to the town's households (" + Math.round(w.stats().market) + " days)");
  assert.ok(town.importAvg > before * Math.pow(179 / 180, 6), "and it is counted as brought in: " + before.toFixed(1) + " to " + town.importAvg.toFixed(1));
}

// 4. No market day for a town whose households are fed (2026-11-17: the pull is their hunger).
{
  const w = People.create({ seed: 7, people: 3000, map: 40, places: "city", start: "winter" });
  const town = w.villages.reduce((a, b) => (b.pop > a.pop ? b : a));
  for (const p of w.people) if (p.home === town.id) p.food = 400;
  w.step(25);
  assert.ok(w.villages.every(v => v.marketTo !== town.id), "a fed town draws no market day");
}

console.log("world-builder towns: sizes, where they live at first, market day");
