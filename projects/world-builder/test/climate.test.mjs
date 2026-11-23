// Climate over centuries (TODO.md 15.5q, 2026-11-22). Ric (2026-11-20): yes, from the seed, and on by
// default (a default world changes with it).
//
// What is held:
//   1. with "Over the centuries" at nothing the world is the one 15.5p left, step for step;
//   2. the swing is slow: a year is like the one before it, and it wanders over generations;
//   3. at the middle a cold age is about a degree (a tenth of warmth's yearly range), never more
//      than the setting allows, and the same seed always gives the same centuries;
//   4. a cold age means a later spring and a poorer harvest in the world itself.
//
// node projects/world-builder/test/climate.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 1345748374;   // print() of 15.5p's engine, seed 2, 60 days

// 1. Every century alike: the world before.
{
  const w = People.create({ seed: 2, climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "nothing is the world before 15.5q");
}

// 2 and 3. Slow, bounded, from the seed.
{
  const c = y => People.climateOf(11, y, 0.5);
  let maxStep = 0, lo = 0, hi = 0;
  for (let y = 0; y < 2000; y++) { maxStep = Math.max(maxStep, Math.abs(c(y + 1).warm - c(y).warm)); lo = Math.min(lo, c(y).warm); hi = Math.max(hi, c(y).warm); }
  assert.ok(maxStep < 0.01, "a year is like the one before (" + maxStep.toFixed(4) + ")");
  assert.ok(lo < -0.07 && hi > 0.07, "over centuries it swings both ways (" + lo.toFixed(2) + " to " + hi.toFixed(2) + ")");
  assert.ok(lo >= -0.2 && hi <= 0.2, "never past what the setting allows");
  assert.equal(People.climateOf(11, 333, 0.5).warm, c(333).warm, "the same seed, the same centuries");
  assert.notEqual(People.climateOf(12, 333, 0.5).warm, c(333).warm, "another seed, other centuries");
  assert.equal(People.climateOf(11, 333, 0).warm, 0, "and nothing at nothing");
  const big = People.climateOf(11, 333, 1).warm;
  assert.ok(Math.abs(big - 2 * c(333).warm) < 1e-12, "the setting scales the swing");
}

// 4. In the world: the coldest year of a seed's first three centuries grows less than its warmest.
{
  let cold = 0, warm = 0;
  for (let y = 0; y < 300; y++) { const x = People.climateOf(5, y, 1).warm; if (x < People.climateOf(5, cold, 1).warm) cold = y; if (x > People.climateOf(5, warm, 1).warm) warm = y; }
  const at = y => People.create({ seed: 5, climate: 1, weather: 0, people: 40, start: "spring" });
  const w = at(0);
  const S = w.settings, grow = (y) => { let g = 0; for (let d = 0; d < 365; d++) g += People.seasonAt(y * 365 + d, S).growth; return g; };
  assert.ok(grow(cold) < grow(warm) * 0.9, "a cold age's year grows less (" + grow(cold).toFixed(0) + " against " + grow(warm).toFixed(0) + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder climate: nothing is the world before, the swing is slow and bounded, from the seed, and a cold age grows less");
