// Fishing boats and road bridges (TODO.md 15.5i4, 2026-11-22). Ric, choosing from 15.5i: "Water: boats
// and bridges". 15.5i found no boat built and no bridge but over a big river, on every land.
//
// What is held:
//   1. off, the world is the one 15.5i3 left, step for step;
//   2. a village by the water whose people fish builds a boat; off, it does not;
//   3. a road built across a stream bridges it.
//
// node projects/world-builder/test/waterwork.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15.5i3's engine, seed 2, 60 days

{
  const w = People.create({ seed: 2, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15.5i4");
}

// 2. Boats where people fish (seed 3's 17 km land has a coast).
{
  const boats = waterWork => { const w = People.create({ ...LATER, seed: 3, waterWork }); w.step(24 * 60); return w.stats().boatsBuilt; };
  const on = boats(true), off = boats(false);
  console.log("  boats built in sixty days: " + on + "; off " + off);
  assert.ok(on >= 1 && off === 0, "fishing villages build boats");
}

// 3. A road over a stream.
{
  const w = People.create({ ...LATER, seed: 5, people: 400, villages: 6, factions: 1, map: 30 });
  w.step(24);
  const f = w.factions[0], mine = w.villages.filter(v => v.alive && v.f === 0);
  let done = false;
  for (const a of mine) for (const b of mine) {
    if (done || a === b || Math.hypot(a.x - b.x, a.y - b.y) >= 40) continue;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)), line = [];
    let stream = false, deep = false;
    for (let k = 0; k <= n; k++) { const i = Math.floor(a.y + (b.y - a.y) * k / n) * w.cols + Math.floor(a.x + (b.x - a.x) * k / n); line.push(i); if (w.ground[i] === 2) stream = true; if (w.ground[i] <= 1 || (w.cross && w.cross[i] === 1)) deep = true; }
    if (!stream || deep) continue;
    for (const i of line) w.trod[i] = 6000;
    f.roadAt = -1e9; f.treasury = 1000; w.roadDay(0);
    for (let d = 0; d < 60 && w.roadJob(0); d++) w.roadDay(0);
    done = true;
  }
  console.log("  " + (done ? "a road over a stream: bridges " + w.stats().roadBridges : "(no two places with a stream between them on this land)"));
  if (done) assert.ok(w.stats().roadBridges >= 1, "the road bridges it");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder fishing boats and road bridges: off is the world before; boats where people fish; roads bridge streams");
