// Where money comes from (TODO 15.8, 2026-11-23). Ric: "i kinda want only one curency but how is it made?",
// "one currence different coins are okay", and "when does money not become important like in war".
//
// What is held:
//   1. "a fixed stock" is the old money, exactly (a medieval world, fingerprinted before 15.8);
//   2. every coin is accounted for: what is in hands, tills and treasuries is what was minted, mined
//      and debased, less what was lost and left buried;
//   3. a people that strikes coins keeps a twentieth of the silver; one that does not passes it as weighed silver;
//   4. a greedy ruler who cannot pay the soldiers debases, and their coin is trusted less;
//   5. in a siege or a famine food is not sold for coins; it is again once that passes;
//   6. coins buried by somebody who never comes back are gone from the world.
//
// node projects/world-builder/test/mint.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 1267386687;   // the world below before 15.7, 15.6f, 15.6g and 15.8

{
  const w = People.create({ seed: 3, people: 200, era: "medieval", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big", property: "old", passage: "old", taking: "old" });
  w.step(1500);
  assert.equal(print(w), OLD, "a fixed stock is the old money, exactly");
}
const money = w => w.people.reduce((a, p) => a + (p.hp !== -99 ? p.coins : 0), 0) + w.villages.reduce((a, v) => a + v.till + (v.bid || 0), 0) + w.factions.reduce((a, f) => a + f.treasury, 0) + [...w.hoards.values()].reduce((a, x) => a + x, 0);
{
  for (const era of ["early", "medieval"]) {
    const w = People.create({ seed: 2, people: 300, era }); w.step(24 * 120);
    const s = w.stats();
    assert.ok(Math.abs(money(w) - s.minted) < 1e-6 * s.minted, era + ": every coin accounted for (" + money(w).toFixed(3) + " against " + s.minted.toFixed(3) + ")");
    assert.ok(s.silver > 0, era + ": silver comes out of the ground (" + s.silver.toFixed(1) + ")");
    assert.ok(s.coinsLost > 0, era + ": and coins are lost (" + s.coinsLost.toFixed(1) + ")");
    if (era === "early") assert.equal(s.struck, 0, "early farmers strike no coins: their silver is weighed");
    else assert.ok(s.struck > 0, "a medieval people strikes its silver into coin");
  }
}
{
  const w = People.create({ seed: 2, people: 300, era: "medieval", factions: 2 }); w.step(24 * 3);
  const f = w.factions[0], lead = w.people.find(p => p.id === f.leader);
  lead.greed = 1; lead.honest = 0; f.treasury = 0; f.soldiers = 20; f.rule = "chief";
  const m0 = w.stats().minted;
  w.moneyMonth();
  assert.ok(w.stats().debased >= 1, "a greedy ruler with an empty treasury debases");
  assert.ok(w.stats().minted > m0 && f.treasury > 0, "coins struck with no silver behind them");
  assert.ok(f.coinTrust < 1, "and their coin is trusted less (" + f.coinTrust.toFixed(2) + ")");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(24 * 3);
  const v = w.villages.find(u => u.alive && w.people.some(q => q.hp > 0 && q.home === u.id && w.adult(q))); v.food = Math.max(v.food, 20);   // a store with food in it (15.12a: in this world's third day every store happens to be empty)
  const p = w.people.find(q => q.hp > 0 && q.home === v.id && w.adult(q)); p.coins = 100;
  v.siege = 1;
  assert.ok(w.trustOf(v.id) < 0.35, "under siege coins are not trusted");
  assert.equal(w.buyFood(p.id, v.id, 2), 0, "and food is not sold for them");
  v.siege = 0;
  assert.ok(w.trustOf(v.id) >= 0.35, "the siege lifted, they are again");
  assert.ok(w.buyFood(p.id, v.id, 2) > 0, "and food is sold for coins");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(24 * 3);
  const p = w.people.find(q => q.hp > 0 && w.adult(q) && q.coins > 2);
  const m0 = w.stats().minted, had = p.coins;
  w.bury(p.id);
  assert.ok(Math.abs(w.hoards.get(p.id) - had / 2) < 1e-9, "half of it buried");
  w.kill(p);
  assert.ok(!w.hoards.has(p.id));
  assert.ok(Math.abs(w.stats().minted - (m0 - had / 2)) < 1e-9, "never dug up, it is gone from the world");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder where money comes from: old money unchanged; every coin accounted for; struck or weighed; debased; not taken in a siege; hoards lost");
