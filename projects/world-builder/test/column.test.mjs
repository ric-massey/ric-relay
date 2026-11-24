// Coming to a place (TODO 15.6i, 2026-11-23). Ric: "do 15.6i too, whatever is realistic". Measured first
// (`test/arrival.mjs`): an army's soldiers each walked into the place it marched on by themselves, and the
// first to come fought its garrison alone.
//
// What is held:
//   1. "Each soldier walks straight in" is the old world, exactly (fingerprinted before 15.6h, 15.6i and 15.10);
//   2. a soldier of an army marching on a place goes first to a camp outside its fields;
//   3. and waits there while too few of the army have come;
//   4. once three in five of those who set out for it are in the camp (at least three), they go in;
//   5. or once three days have passed since the first came.
//
// node projects/world-builder/test/column.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 2600205387;   // the world below before 15.6h, 15.6i and 15.10

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
{
  const w = People.create({ seed: 4, people: 200, era: "medieval", neighbours: "enemies", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, pursuit: "old", soldierPay: "kept", tills: "old", poor: "old" }); w.step(1500);
  assert.equal(print(w), OLD, "each soldier walking straight in is the old world, exactly");
}
{
  const w = People.create({ seed: 4, people: 400, factions: 2 }); w.step(3);
  w.startWar(0, 1);
  const f = w.factions[0];
  const from = w.villages.find(u => u.alive && u.f === 0), goal = w.villages.find(u => u.alive && u.f === 1);
  f.camp[1] = { v: from.id, goal: goal.id, ready: true, since: 0, cut: false, out: 0 }; f.target[1] = goal.id;
  const army = w.people.filter(q => q.hp > 0 && q.f === 0 && w.adult(q) && q.id % 3 !== 0).slice(0, 10);
  for (const q of army) { q.job = "soldier"; q.hp = 1; w.place(q, from.x, from.y); }
  w.step(24);   // a new day, so the army is counted again
  for (const q of army) { q.job = "soldier"; q.hp = 1; w.place(q, from.x, from.y); }
  const p = army[0];
  assert.equal(w.columnFor(p.id, 1), true, "an army's soldier is sent to the camp first");
  const s = f.camp[1].stage;
  assert.ok(Math.hypot(s.x - goal.x, s.y - goal.y) > goal.radius, "and the camp is outside the place's fields");
  assert.ok(Math.hypot(p.tx - s.x, p.ty - s.y) < 1.5, "and that is where they walk");
  w.place(p, s.x, s.y);
  assert.equal(w.columnFor(p.id, 1), true, "alone in the camp, they wait");
  assert.ok(Math.hypot(p.tx - goal.x, p.ty - goal.y) > goal.radius, "outside the place");
  let went = 0;
  for (const q of army.slice(1)) { w.place(q, s.x, s.y); went++; if (!w.columnFor(q.id, 1)) break; }
  assert.ok(s.go && went === 2, "with three in five of those who set out in the camp, at least three, they go in (" + went + " more came)");
  f.camp[1].stage = null;
  w.columnFor(p.id, 1); const s2 = f.camp[1].stage;
  w.place(p, s2.x, s2.y); w.columnFor(p.id, 1);
  s2.first -= 4 * 24;
  assert.equal(w.columnFor(p.id, 1), false, "and after three days they go in whoever has come");
  assert.ok(s2.go, "the camp is gone in");
}
console.log("world-builder coming to a place: old world unchanged; the army camps outside, waits for most of itself or three days, then goes in");
