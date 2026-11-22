// Land from about 2 km² (TODO.md 15.5c, 2026-11-22). Ric (2026-11-20): a 2 km² world is one village
// watched house by house; how many people and groups, "whatever happens"; the world beyond the edge,
// "an option" (closed, or people coming and going).
//
// What is held:
//   1. a default world is the one 15.5g left (the edge closed), step for step;
//   2. a land 1.5 km across is made and runs: one village's land;
//   3. with the edge open, strangers come in and the hungry near the edge leave, taking what they have,
//      and every coin is still accounted for; closed, nobody comes or goes.
//
// node projects/world-builder/test/smallland.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 140974437;   // print() of 15.5g's engine, seed 2, 60 days

// 1. Closed by default: the world before.
{
  const w = People.create({ seed: 2, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "a default world, the edge closed, is the world before 15.5c");
}

// 2. One village's land.
{
  const S = People.clean({ map: 1.5 });
  assert.equal(S.map, 1.5, "a land 1.5 km across may be asked for");
  const w = People.create({ seed: 1, map: 1.5, factions: 1, villages: 1, people: 30 });
  assert.ok(w.cols === 6 && w.rows === 4, "six squares by four (" + w.cols + " by " + w.rows + ")");
  w.step(24 * 60);
  assert.ok(w.stats().people > 20 && w.stats().villages === 1, "it runs: one village, " + w.stats().people + " people");
}

// 3. The edge.
{
  const opts = { seed: 2, map: 1.75, factions: 1, villages: 1, people: 60 };
  const shut = People.create(opts); shut.step(24 * 200);
  assert.equal(shut.stats().strangers + shut.stats().left, 0, "closed, nobody comes or goes");
  const w = People.create(Object.assign({ edge: "open" }, opts));
  const m0 = w.stats().money - w.stats().minted;
  w.step(24 * 200);
  const s = w.stats();
  assert.ok(s.left > 0, "open, the hungry near the edge leave (" + s.left + ")");
  assert.ok(s.strangers > 0, "and strangers come (" + s.strangers + ")");
  assert.ok(Math.abs((s.money - s.minted) - m0) < 1e-6, "every coin accounted for, those taken away too");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder small land: a default world is the world before, a land 1.5 km across runs, and an open edge lets strangers in and the hungry out with every coin counted");
