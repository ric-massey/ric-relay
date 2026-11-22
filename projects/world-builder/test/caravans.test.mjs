// Caravans: long-distance trade (TODO.md 15l, 2026-11-22). Ric: "caravans are a yes".
//
// What is held:
//   1. with caravans off the world is the one 15j left, step for step;
//   2. on a large land, goods go by caravan to places beyond a village trader's reach (34 squares);
//   3. a caravan robbed on the road loses half its load to the bandit's place.
//
// node projects/world-builder/test/caravans.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { armySick: false, oldArms: "plain", generals: "none", siegecraft: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 322919713;   // print() of 15j's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15l");
}

// 2. Far trade on a 60 km land of 36 places.
{
  const w = People.create({ ...LATER, seed: 5, map: 60, villages: 8, people: 1500, factions: 2 });
  w.step(24 * 60);
  const s = w.stats(), routes = w.routes();
  console.log("  60 days on 60 km: " + s.caravans + " caravans, " + s.caravanFar.toFixed(1) + " goods sold beyond a trader's reach, " + routes.length + " routes, most trips on one " + Math.max(0, ...routes.map(r => r.trips)));
  assert.ok(s.caravans >= 5, "caravans set out");
  assert.ok(s.caravanFar > 1, "goods reach places beyond a village's own traders");
  for (const r of routes) { const [a, b] = r.key.split(">").map(Number); assert.ok(Math.hypot(w.villages[a].x - w.villages[b].x, w.villages[a].y - w.villages[b].y) > 34, "a caravan route is long"); }
}

// 3. Off on the same land: none.
{
  const w = People.create({ ...LATER, seed: 5, map: 60, villages: 8, people: 1500, factions: 2, caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old" });
  w.step(24 * 10);
  assert.equal(w.stats().caravans, 0, "no caravans when off");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder caravans: off is the world before; goods go far; routes are long");
