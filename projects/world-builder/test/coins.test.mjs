// Where the coins pile up, and how the penniless get by (TODO 15.10, 2026-11-23). Ric: "can we talk about
// the extreme wealth concentration that happens and how people with no money still survive", and of every
// choice in it, "answered by what is realistic".
//
// What is held:
//   1. with all three off ("kept", "old", "old") the world is the old one, exactly (fingerprinted before 15.10);
//   2. every coin is still accounted for with all three on;
//   3. what the army fed a soldier with is stopped from the pay, leaving a tenth of it;
//   4. a soldier with a parent at home sends half of what they hold beyond a week's pay there;
//   5. somebody with more than a season's bread in coins spends some at the store, and the till gets it;
//   6. somebody hungry with no coins gets alms from a neighbour of their faith, or a loan from kin, and eats;
//   7. a loan is paid back once the borrower can, with nothing on top between kin;
//   8. the till ends a year of a default world with coins in it, where the old way left it all but empty.
//
// node projects/world-builder/test/coins.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OFF = { soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, pursuit: "old" };
const OLD = 1585413095;   // the world below before 15.10 and 15.6h

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
{
  const w = People.create({ seed: 2, people: 250, ...OFF }); w.step(1500);
  assert.equal(print(w), OLD, "with all three off, the old world exactly");
}
const money = w => w.people.reduce((a, p) => a + (p.hp !== -99 ? p.coins : 0), 0) + w.villages.reduce((a, v) => a + v.till + (v.bid || 0), 0) + w.factions.reduce((a, f) => a + f.treasury, 0) + [...w.hoards.values()].reduce((a, x) => a + x, 0);
{
  const w = People.create({ seed: 3, people: 300, era: "medieval", neighbours: "enemies" }); w.step(24 * 120);
  const s = w.stats();
  assert.ok(Math.abs(money(w) - s.minted) < 1e-6 * s.minted, "every coin accounted for (" + money(w).toFixed(3) + " against " + s.minted.toFixed(3) + ")");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(23);   // the next hour is a pay day
  const p = w.people.find(q => q.hp > 0 && q.job === "soldier" && q.partner);
  const f = w.factions[p.f]; f.treasury = 1000;
  p.stop = 5; const s0 = w.stats().stopped;
  w.step(1);
  assert.ok(Math.abs(p.stop - 4.1) < 1e-9, "nine-tenths of a day's pay stopped (" + p.stop + " left owing)");
  assert.ok(w.stats().stopped - s0 >= 0.9 - 1e-9, "and counted");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(3);
  const p = w.people.find(q => q.hp > 0 && w.adult(q) && !q.partner);
  const par = w.people.find(q => q.hp > 0 && w.adult(q) && q.home === p.home && q !== p);
  p.mum = par.id;
  p.job = "soldier"; p.coins = 50; const c0 = par.coins;
  w.payDay(p.id);
  assert.ok(Math.abs(par.coins - c0 - (50 - 7) / 2) < 1e-9, "half of what is beyond a week's pay sent home (" + (par.coins - c0) + ")");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(3);
  const v = w.villages.find(u => u.alive && u.goods > 3);
  const p = w.people.find(q => q.hp > 0 && w.adult(q) && q.home === v.id && q.job !== "crafter" && q.job !== "trader" && !q.partner);
  p.x = v.x; p.y = v.y; p.coins = 500; p.goods = 0.5;
  const till = v.till;
  w.spendSpare(p.id);
  assert.ok(p.coins < 500 && p.goods > 0.5, "somebody with a season to spare buys for the house (" + (500 - p.coins).toFixed(2) + " coins)");
  assert.ok(v.till > till, "and the till gets it back");
  p.coins = 10; const g = p.goods; w.spendSpare(p.id);
  assert.equal(p.goods, g, "and nobody short of a season's bread does");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(3);
  const v = w.villages.find(u => u.alive && u.food > 20);
  const here = w.people.filter(q => q.hp > 0 && w.adult(q) && q.home === v.id);
  const lender = here[0], p = here.find(q => q !== lender && q.partner !== lender.id);
  p.mum = lender.id;
  for (const q of w.people) q.faith = null;
  lender.coins = 500; p.coins = 0; p.food = 0; p.faith = null;
  if (p.partner) w.people.find(q => q.id === p.partner).coins = 0;
  w.shopAt(p.id, v.id);
  assert.ok(p.food > 0.5, "hungry with nothing, fed on a loan from kin (" + p.food.toFixed(2) + ")");
  const o = w.owed.get(p.id);
  assert.ok(o && o.from === lender.id && o.rate === 0, "owed to the parent, nothing on top");
  p.coins = 100; const l0 = lender.coins; w.repay(p.id);
  assert.ok(!w.owed.has(p.id) && Math.abs(lender.coins - l0 - o.sum) < 1e-9, "and paid back once they can");
}
{
  const w = People.create({ seed: 2, people: 300 }); w.step(3);
  const v = w.villages.find(u => u.alive && u.food > 20);
  const giver = w.people.find(q => q.hp > 0 && w.adult(q) && q.home === v.id);
  const p = w.people.find(q => q.hp > 0 && w.adult(q) && q.home === v.id && q !== giver && q.id !== giver.partner && q.partner !== giver.id && q.mum !== giver.id && q.dad !== giver.id && giver.mum !== q.id && giver.dad !== q.id);
  for (const q of w.people) q.faith = null;
  w.makeFaith(giver); p.faith = giver.faith; giver.coins = 4000; p.coins = 0; p.food = 0;
  if (p.partner) w.people.find(q => q.id === p.partner).coins = 0;
  const g0 = giver.coins;
  w.shopAt(p.id, v.id);
  assert.ok(giver.coins < g0 && p.food > 0.5, "alms from one of their own faith (" + (g0 - giver.coins).toFixed(2) + " coins)");
  assert.ok(!w.owed.has(p.id), "and nothing owed for it");
}
{
  const till = o => { const w = People.create({ seed: 2, people: 300, ...o }); w.step(24 * 365); return w.villages.reduce((a, v) => a + (v.alive ? v.till : 0), 0); };
  const old = till(OFF), now = till({});
  assert.ok(now > old * 5 && now > 50, "a year on the tills still hold coins (" + now.toFixed(0) + " against " + old.toFixed(0) + ")");
}
console.log("world-builder where coins go: old world unchanged; every coin accounted for; pay stopped, sent home, spent; alms and loans; tills not drained");
