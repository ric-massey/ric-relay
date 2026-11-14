import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const make = extra => People.create({ people: 20, map: "small", factions: 1, villages: 2, war: false, talk: 0, seed: 7, ...extra });
const ready = w => {
  for (const p of w.people) { p.wait = 9999; p.task = "idle"; p.tx = p.x; p.ty = p.y; }
  const p = w.people[0], v = w.villages[p.home];
  p.age = 25; p.job = "farmer"; p.food = 2; p.goods = 0; p.coins = 20; p.x = v.x; p.y = v.y; p.tx = p.x; p.ty = p.y;
  return [p,v];
};
{
  const w = make(), [p,v] = ready(w);
  v.goods = 0; w.outfit(p,v); assert.deepEqual(w.equipment(p), [], "no supply means no free equipment");
  v.goods = 5; p.coins = 0; w.outfit(p,v); assert.deepEqual(p.gear, {}, "no money means no free purchase");
  p.coins = 20; const money = w.stats().money, goods = v.goods;
  w.outfit(p,v);
  assert.equal(p.gear.tool, 1); assert.ok(Math.abs(v.goods - goods + 0.6) < 1e-10);
  assert.ok(Math.abs(w.stats().money - money) < 1e-10, "purchase conserves coins");
  p.gear.tool = 0.2; const repairStock = v.goods;
  w.outfit(p,v); assert.equal(p.gear.tool,1);
  assert.ok(Math.abs(repairStock - v.goods - 0.48) < 1e-10, "repair pays for only the worn material");
  assert.ok(Math.abs(w.stats().money - money) < 1e-10);
  // A tool only helps the jobs it is for, and a broken one does not help at all.
  p.job = "child"; assert.equal(w.equipment(p)[0].equipped,false); assert.equal(w.harvestCapacity(p),1.8);
  p.job = "farmer"; p.gear.tool = 0; assert.equal(w.harvestCapacity(p),1.8);
  p.food = 0.1; w.outfit(p,v); assert.equal(p.gear.tool,0,"food takes priority over gear");
  p.food = 2; p.x = v.x + 5; w.outfit(p,v); assert.equal(p.gear.tool,0,"no outfitting away from a village");
}
for (const tool of [false,true]) {
  const w = make({money:"shared"}), [p,v] = ready(w);
  p.x=20; p.y=20; p.tx=20; p.ty=20; p.wait=0; p.task="field"; p.harvesting=true;
  if(tool) p.gear.tool=1;
  w.stock.fill(100);
  const food=p.food, stock=w.stock.reduce((a,b)=>a+b,0);
  w.advance(0.2);
  /* Read the capacity off the engine rather than writing the number twice:
     a day's work is a balance choice and it has moved once already. */
  const expected=w.harvestCapacity(p);
  assert.ok(Math.abs(expected-(tool?2.25:1.8))<1e-9,"a day in the fields brings back what the README says");
  assert.ok(Math.abs(p.food-food-expected)<1e-9,"real harvest uses equipment capacity");
  assert.ok(Math.abs(stock-w.stock.reduce((a,b)=>a+b,0)-expected)<0.0001,"harvested food comes from fields");
  if(tool) assert.ok(Math.abs(p.gear.tool-0.997)<1e-10,"work wears the tool");
}
for (const pack of [false,true]) {
  const w=make(), [p,v]=ready(w), destination=w.villages.find(x=>x!==v);
  /* A rested trader in the middle of the morning with a route worth walking.
     Since 2026-11-13 people compare their options, so the fixture has to give
     one: at midnight, exhausted, the right answer is bed, not commerce. */
  p.job="trader";p.at=v.id;p.wait=9999;p.goods=0;p.coins=100;
  if(pack)p.gear.pack=1;
  v.goods=0;v.food=100;v.priceFood=1;destination.priceFood=5;destination.food=0;
  w.step(9);
  p.wait=0;p.rest=0;p.greed=1;p.food=2;p.job="trader";
  v.food=100;v.priceFood=1;destination.priceFood=5;destination.food=0;
  w.advance(0.2);
  assert.equal(p.cargo?.what,"food");assert.equal(p.cargo.amount,pack?5:3,"real cargo obeys pack capacity");
}
{
  const w=make(), [p,v]=ready(w), foe=w.people[1];
  p.job=foe.job="soldier";p.gear.weapon=1;foe.gear.shield=1;foe.hp=10;
  assert.equal(w.strike(p,foe,1),0.9375);assert.equal(foe.hp,9.0625);
  assert.equal(p.gear.weapon,0.99);assert.equal(foe.gear.shield,0.99);
  p.gear.weapon=foe.gear.shield=0;assert.equal(w.strike(p,foe,1),1,"broken gear has no effect");
}
{
  const w=make({money:"shared"}), [p,v]=ready(w);
  p.coins=0;v.goods=5;w.outfit(p,v);assert.equal(p.gear.tool,1,"shared stores supply real goods without coins");
  assert.ok(Math.abs(v.goods-4.4)<1e-10);
  p.gear.tool=0.5;p.goods=0;p.dieAt=1;v.goods=0;w.step(1);
  assert.equal(w.byId.has(p.id),false);assert.ok(Math.abs(v.goods-0.3)<1e-10,"remaining equipment material returns on death");
  assert.deepEqual(p.gear,{});
}
console.log("Equipment: paid supply, repairs, real harvest/cargo effects, combat, wear, stored/broken states and salvage pass.");
