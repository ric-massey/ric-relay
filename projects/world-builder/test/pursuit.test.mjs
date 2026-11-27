// Chasing an enemy home (TODO 15.6h, 2026-11-23). Measured first (`test/villagedead.mjs`): most soldiers who
// died at a village were alone at the enemy's, and for many that place was no goal of their people's — they had
// followed a lone enemy back into its own fields.
//
// What is held:
//   1. "Wherever they run" is the old world, exactly (fingerprinted before 15.6h and 15.10);
//   2. a lone soldier lets an enemy go once it is inside its own village's fields;
//   3. but not when that place is what their army came for;
//   4. nor when two of their own side stand with them;
//   5. and an enemy in open country is followed as before.
//
// node projects/world-builder/test/pursuit.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 2704337721;   // the world below before 15.6h and 15.10

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
{
  const w = People.create({ seed: 4, people: 200, era: "medieval", neighbours: "enemies", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" }); w.step(1500);
  assert.equal(print(w), OLD, "wherever they run is the old world, exactly");
}
{
  const w = People.create({ seed: 4, people: 300, factions: 2 }); w.step(3);
  w.startWar(0, 1);
  const v = w.villages.find(u => u.alive && u.f === 1);
  const p = w.people.find(q => q.hp > 0 && q.f === 0 && w.adult(q));
  const foe = w.people.find(q => q.hp > 0 && q.f === 1 && w.adult(q));
  p.job = "soldier"; foe.job = "soldier"; p.hp = 1; foe.hp = 1;
  for (const q of w.people) if (q !== p && q.f === 0) w.place(q, 0.5, 0.5);   // nobody of theirs anywhere near
  w.factions[0].target[1] = -1; w.factions[0].raid[1] = { v: -1, until: 0 };
  w.place(foe, v.x, v.y); w.place(p, v.x + 2, v.y);
  assert.equal(w.wontFollow(p.id, foe.id), true, "alone, an enemy inside its own fields is let go");
  w.factions[0].target[1] = v.id;
  assert.equal(w.wontFollow(p.id, foe.id), false, "unless that place is what their army came for");
  w.factions[0].target[1] = -1;
  const mates = w.people.filter(q => q.hp > 0 && q.f === 0 && w.adult(q) && q !== p).slice(0, 2);
  for (const q of mates) { q.job = "soldier"; q.hp = 1; w.place(q, p.x + 0.5, p.y); }
  assert.equal(w.wontFollow(p.id, foe.id), false, "or two of their own stand with them");
  for (const q of mates) w.place(q, 0.5, 0.5);
  let far = null;
  for (let y = 1; y < w.rows - 1 && !far; y += 2) for (let x = 1; x < w.cols - 1; x += 2) if (w.villages.every(u => !u.alive || Math.hypot(u.x - x, u.y - y) > u.radius + 2)) { far = { x, y }; break; }
  if (far) { w.place(foe, far.x, far.y); w.place(p, far.x + 1, far.y); assert.equal(w.wontFollow(p.id, foe.id), false, "and an enemy in open country is followed"); }
}
console.log("world-builder chasing an enemy home: old world unchanged; let go inside its fields when alone and it is no goal; followed otherwise");
