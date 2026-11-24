// Battle by choice (TODO 15.6e, 2026-11-23). Ric: "Battle by choice".
//
// What is held:
//   1. a default world is the world it was, and "as before" is the old war, exactly;
//   2. at war, armies decline battle at poor odds and fight less often; an army resting after a battle does
//      not march; soldiers die less;
//   3. a walled place is invested while its wall stands and it has food, and stormed once breached or starving.
//
// node projects/world-builder/test/battle.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const AT_WAR = 3998479614;   // print() of the two-people war below before 15.6e

{
  const a = People.create({ seed: 2 }), b = People.create({ seed: 2, battle: "old" });
  a.step(24 * 60); b.step(24 * 60);
  assert.equal(print(a), print(b), "a default world is the world it was");
}
const LATER = { property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" };   // the parts built after this one, off for the fingerprint
const war = (battle) => { const w = People.create({ seed: 4, people: 300, factions: 2, battle, ...LATER }); w.step(24); w.startWar(0, 1); w.step(2400); return w; };   // this part as it was built
{
  const old = war("old");
  assert.equal(print(old), AT_WAR, "\"as before\" is the old war, exactly");
  const w = war("choice"), s = w.stats(), s0 = old.stats();
  assert.ok(s.battleDeclined > 0, "battle declined at poor odds (" + s.battleDeclined + ")");
  assert.ok(s.battles < s0.battles, "armies fight less often (" + s0.battles + " -> " + s.battles + ")");
  assert.ok(s.soldiersKilled <= s0.soldiersKilled, "and soldiers die no more (" + s0.soldiersKilled + " -> " + s.soldiersKilled + ")");
  for (const f of w.factions) for (const k in f.camp || {}) { const c = f.camp[k]; if (c && c.restUntil > w.tick) assert.equal(c.ready, false, "a resting army does not march"); }
  console.log("  100 days of war: engagements " + s0.battles + " -> " + s.battles + ", declined " + s.battleDeclined + ", soldiers killed " + s0.soldiersKilled + " -> " + s.soldiersKilled);
}
{
  const w = People.create({ seed: 5, people: 200, factions: 2, era: "medieval" });
  w.step(24);
  const v = w.villages.find(u => u.alive && u.f === 0);
  v.wall = 1; v.breach = 0; v.food = v.pop * 10;
  assert.equal(w.walledOut(v.id, 1), true, "a walled place with food is invested");
  v.breach = 0.8;
  assert.equal(w.walledOut(v.id, 1), false, "breached, it is stormed");
  v.breach = 0; v.food = 0;
  assert.equal(w.walledOut(v.id, 1), false, "starving, it is stormed");
  v.wall = 0; v.food = v.pop * 10;
  assert.equal(w.walledOut(v.id, 1), false, "an open place is stormed");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder battle by choice: default and old war unchanged; battle declined and rested; walled places invested until breached or starving");
