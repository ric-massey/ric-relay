// Roads built on purpose (TODO.md 15.5i3, 2026-11-22). Ric, choosing from 15.5i: "Roads built on
// purpose". 15.5i found roads only wore in.
//
// What is held:
//   1. off, the world is the one 15.5i2 left, step for step;
//   2. a people builds a road along its most walked way between two of its places, paid or levied;
//   3. a road built stays a road when nobody walks it.
//
// node projects/world-builder/test/roadwork.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15.5i2's engine, seed 2, 60 days

{
  const w = People.create({ seed: 2, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15.5i3");
}

{
  const w = People.create({ ...LATER, seed: 5, people: 400, villages: 4, factions: 1, map: 20 });
  w.step(24 * 2);
  const f = w.factions[0], mine = w.villages.filter(v => v.alive && v.f === 0);
  let a = null, b = null;
  for (const x of mine) for (const y of mine) if (x !== y && Math.hypot(x.x - y.x, x.y - y.y) < 40 && Math.hypot(x.x - y.x, x.y - y.y) > 8 && !a) { a = x; b = y; }
  assert.ok(a, "two places near enough");
  /* Walked hard along the way between them. */
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
  for (let k = 0; k <= n; k++) { const i = Math.floor(a.y + (b.y - a.y) * k / n) * w.cols + Math.floor(a.x + (b.x - a.x) * k / n); w.trod[i] = 6000; }
  f.roadAt = -1e9; f.treasury = 1000;
  w.roadDay(0);
  const job = w.roadJob(0);
  assert.ok(job, "a road is begun along the most walked way");
  const chest = f.treasury;
  for (let d = 0; d < 60 && w.roadJob(0); d++) w.roadDay(0);
  const s = w.stats();
  console.log("  a road of " + job.line.length + " squares: built " + s.roadsBuilt + ", paid " + s.roadPaid + " coins, levied " + s.roadLevied);
  assert.equal(s.roadsBuilt, 1, "and finished");
  assert.ok(chest - f.treasury > 0 && s.roadPaid > 0, "paid from the treasury");
  assert.ok(job.line.every(i => w.builtRoad(i) && w.track[i] === 2), "every square of it a road");
  for (const i of job.line) w.trod[i] = 0;
  w.step(24 * 3);
  assert.ok(job.line.every(i => w.track[i] === 2), "and a road it stays, walked or not");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder roads built on purpose: off is the world before; begun on the most walked way; paid; stays a road");
