// Working harder at war (TODO.md 15.5i1, 2026-11-22). Ric, choosing what of 15.5i to work on: "Work at war".
//
// What is held:
//   1. off, the world is the one 15r left, step for step;
//   2. a village counts its grown-ups away with the army, and those left at home feel the slack;
//   3. at peace, nobody does.
//
// node projects/world-builder/test/homefront.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { feuds: false };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15r's engine, seed 2, 60 days

{
  const w = People.create({ seed: 2, homeFront: false, feuds: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15.5i1");
}

{
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false });
  w.step(24 * 2);
  const farmer = w.people.find(p => p.f === 0 && p.hp > 0 && p.age > 20 && p.job === "farmer");
  assert.equal(w.slackOf(farmer), 0, "at peace, no slack");
  w.startWar(0, 1);
  const v = w.villages[farmer.home];
  for (const p of w.people.filter(q => q.home === v.id && q.age > 20 && q.hp > 0 && q !== farmer).slice(0, 8)) { p.job = "soldier"; w.place(p, Math.min(w.cols - 1, v.x + 20), v.y); }
  w.step(24);
  console.log("  " + v.name + ": " + v.away + " away with the army of " + v.adults + " grown-ups; slack felt at home " + w.slackOf(farmer).toFixed(2));
  assert.ok(v.away > 0, "the village counts those away");
  assert.ok(w.slackOf(farmer) > 0, "and those at home feel it");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder working harder at war: off is the world before; those away counted; slack felt at home");
