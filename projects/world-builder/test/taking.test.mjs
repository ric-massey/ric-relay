// Taking a place: surrender demanded first (TODO 15.6g, 2026-11-23).
//
// What is held:
//   1. a world at peace is the world it was; an army at a place too strongly held to take draws off;
//   2. a place far outnumbered with few soldiers of its own gives itself up; one with soldiers, or only
//      a little outnumbered, refuses; a stubborn leader holds out longer;
//   3. given up on terms, it changes hands with nothing burned and a quarter of its till paid.
//
// node projects/world-builder/test/taking.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER2 = { folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll" };   // 15.11b to z and 15.12b to d, built after this one, off: its worlds as they were picked

{
  const peace = taking => { const w = People.create({ seed: 4, people: 300, factions: 2, taking, war: false }); w.step(24 * 60); return w; };
  assert.equal(print(peace("terms")), print(peace("old")), "a world at peace is the world it was");
  const war = taking => { const w = People.create({ seed: 4, people: 300, factions: 2, taking, ...LATER2 }); w.step(24); w.startWar(0, 1); w.step(2400); return w; };
  const s = war("terms").stats();
  assert.ok(s.calledOff > 0, "an army at a place too strongly held to take draws off (" + s.calledOff + ")");
  console.log("  100 days of war: called off " + s.calledOff + " (soldiers' deaths are measured over seeds by test/soldierdead.mjs)");
}
{
  const w = People.create({ seed: 6, people: 300, factions: 2, villages: 4 }); w.step(24);
  const v = w.villages.find(u => u.alive && u.f === 1 && w.villages.some(o => o.alive && o.f === 1 && o !== u));
  assert.equal(w.yieldsOnTerms(v.id, 60, 10, 0), true, "far outnumbered, it gives itself up");
  assert.equal(w.yieldsOnTerms(v.id, 60, 10, 30), false, "with soldiers of its own, it refuses");
  assert.equal(w.yieldsOnTerms(v.id, 15, 10, 0), false, "only a little outnumbered, it refuses");
  const lead = w.people.find(p => p.id === w.factions[1].leader); lead.stub = 1;
  const stubborn = w.yieldsOnTerms(v.id, 25, 10, 0); lead.stub = 0;
  assert.equal(stubborn, false, "a stubborn leader holds out");
  assert.equal(w.yieldsOnTerms(v.id, 25, 10, 0), true, "where a yielding one would not");
  const houses = w.homes.filter(h => h.v === v.id && h.built).length, till = v.till;
  w.takeOnTerms(v.id, 0);
  assert.equal(v.f, 0, "given up, it changes hands");
  assert.equal(w.homes.filter(h => h.v === v.id && h.built).length, houses, "and nothing is burned");
  assert.ok(Math.abs(v.till - till * 0.75) < 1e-9, "a quarter of its till is paid");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder taking a place: unchanged where nothing is taken; given up when it cannot hold; nothing burned on terms");
