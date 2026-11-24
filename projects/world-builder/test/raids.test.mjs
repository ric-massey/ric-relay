// Raids as the record has them (TODO 15.6d, 2026-11-23). Ric: "whatever is realistic".
//
// What is held:
//   1. a default world is the world it was, and "as before" is the old raid in a world at war;
//   2. a band goes only where it is more than what holds the place, and leaves: met, it breaks off;
//      more, it takes and goes; nobody stands at a raided village for days, so few fall there;
//   3. in a house a band burns some are killed and some carried off to the raiders' place, held
//      unfree where their law allows.
//
// node projects/world-builder/test/raids.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const AT_WAR = 2185467059;        // print() of a two-people war before, below, with the old raids

{
  const a = People.create({ seed: 2 }), b = People.create({ seed: 2, raids: "old", battle: "old" });
  a.step(24 * 60); b.step(24 * 60);
  assert.equal(print(a), print(b), "a default world is the world it was");
}
const war = (raids) => { const w = People.create({ seed: 4, people: 300, factions: 2, raids, battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" }); w.step(24); w.startWar(0, 1); w.step(2400); return w; };   // battle: the part built after this one, off
{
  assert.equal(print(war("old")), AT_WAR, "\"as before\" is the old raid, exactly");
}
{
  const w = war("real"), s = w.stats();
  const ended = s.raids_met + s.raids_lost + s.raids_took + s.raids_walled;
  assert.ok(s.bands > 0 && ended > 0, "bands go, and every one that arrives ends");
  assert.ok(s.raids_took > 0 && s.raids_met > 0, "some take and go, some are met and break off");
  assert.ok(s.koRaid <= 3, "nobody stands at a raided village for days (" + s.koRaid + " knocked out there)");
  for (const f of w.factions) for (const k in f.raid) { const rd = f.raid[k]; if (rd && rd.v >= 0) assert.ok(rd.size >= 0 && rd.lost >= 0); }
  console.log("  a war of 100 days: bands " + s.bands + ", took " + s.raids_took + ", met " + s.raids_met + ", lost " + s.raids_lost + ", knocked out at a raided village " + s.koRaid);
}
{
  // 3. A house burned by a band, many times over, for the odds.
  const w = People.create({ seed: 8, people: 400, factions: 2 });
  w.step(48);
  const by = w.factions[1];
  if (by.gov) by.gov.laws.unfree = "allowed";
  let killed = 0, taken = 0, bound = 0;
  for (const v of w.villages.filter(u => u.alive && u.f === 0)) {
    for (const h of w.homes.filter(x => x.v === v.id && x.built)) {
      const inside = w.people.filter(q => q.hp > 0 && q.dwelling === h.id && q.job !== "soldier" && Math.hypot(q.x - v.x, q.y - v.y) <= v.radius + 1);
      const s0 = w.stats();
      w.raidHouse(v.id, h, 1);
      const s1 = w.stats();
      killed += s1.raidKilled - s0.raidKilled; taken += s1.raidTaken - s0.raidTaken;
      for (const q of inside) if (q.hp > 0 && q.f === 1) { assert.equal(w.villages[q.home].f, 1, "the carried off live in a place of the raiders'"); if (q.unfree) bound++; }
    }
  }
  assert.ok(killed > 0 && taken > 0, "some killed (" + killed + "), some carried off (" + taken + ")");
  if (by.gov) assert.ok(bound > 0, "and held unfree where the raiders' law allows");
  console.log("  houses raided: killed " + killed + ", carried off " + taken + ", held unfree " + bound);
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder raids: default unchanged, old raid exact; bands strike the weakly held and go; villagers killed and carried off");
