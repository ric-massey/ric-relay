// Paths and roads, carts and boats (TODO.md item 7d, 2026-11-16).
//
// What is held:
//   1. paths and roads are where people have walked, and nowhere else: every one is on ground
//      trodden past the line, and when nobody walks there any more they go back to grass;
//   2. a trader owns a cart from the start, and it is a thing they carry and wear out;
//   3. a load for a village along the same coast goes by boat when that is quicker, and arrives;
//   4. a boat can be lost, and the load with it.
//
// node projects/world-builder/test/roads.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. Paths from walking.
{
  const w = People.create({ seed: 11 });
  w.step(24 * 30);
  const s = w.stats();
  assert.ok(s.paths > 0, "paths are worn in where people walk: " + s.paths);
  for (let i = 0; i < w.track.length; i++) if (w.track[i]) assert.ok(w.trod[i] >= 2000, "a path is only where the ground is trodden");
  const before = w.trackStamp;
  w.trod.fill(0);                        // as if nobody had walked anywhere
  for (const p of w.people) { p.task = "idle"; p.wait = 1e9; }
  w.step(26);
  assert.ok(w.trackStamp !== before && w.stats().paths === 0 && w.stats().roads === 0, "untrodden, they go back to grass");
}

// 2. Carts.
{
  const w = People.create({ seed: 11 });
  const traders = w.people.filter(p => p.job === "trader");
  if (traders.length) for (const p of traders) assert.ok(w.equipment(p).some(e => e.key === "cart" && e.equipped), p.name + " has a cart");
  const q = w.people.find(p => w.adult(p));
  q.job = "trader"; q.gear = { pack: 1 };
  assert.ok(!w.equipment(q).some(e => e.key === "cart"), "a cart is owned, not given by a job");
}

// 3 and 4. By boat along a coast, and lost.
{
  const w = People.create({ seed: 5, sea: 0.5, map: 40 });   // seed 5 since 15.12a's dice (2026-11-24) placed seed 4's villages elsewhere
  w.step(24);
  let pair = null;
  /* Two villages with landings on the sea, far enough apart that the water is quicker. */
  for (const v of w.villages) for (const o of w.villages) {
    if (pair || v === o || !v.crossings || !o.crossings || !v.crossings.landing || !o.crossings.landing) continue;
    v.boat = { x: v.crossings.landing.x, y: v.crossings.landing.y };
    const p = w.people.find(q => q.home === v.id && w.adult(q) && q.job !== "soldier");
    if (!p) continue;
    p.cargo = { what: "goods", amount: 2 }; p.at = o.id; p.gear.cart = 1; p.job = "trader";
    w.send(p, o.x, o.y, "carry");
    if (p.task === "boat") pair = { v, o, p }; else { v.boat = null; p.cargo = null; }
  }
  assert.ok(pair, "somewhere along this coast a load goes by boat");
  const { v, o, p } = pair;
  const goods = o.goods;
  let landed = false;
  for (let h = 0; h < 24 * 4 && !landed; h++) { w.step(1); landed = p.cargo === null || Math.hypot(p.x - o.x, p.y - o.y) < 3; }
  assert.ok(landed, p.name + " takes the load to " + o.name + " by water");
  /* A long, rough crossing: the boat goes down. */
  const q = w.people.find(x => x.home === v.id && w.adult(x) && x !== p && x.job !== "soldier");
  if (!v.boat) v.boat = { x: v.crossings.landing.x, y: v.crossings.landing.y };
  q.cargo = { what: "goods", amount: 2 }; q.at = o.id; q.gear.cart = 1; q.job = "trader";
  w.send(q, o.x, o.y, "carry");
  assert.equal(q.task, "boat");
  let set = false;
  p.task = "idle"; p.wait = 1e9;          // the first trader stays put, so the boat is the second's alone
  for (let s = 0; s < 24 * 4 * 60; s++) {
    w.advance(People.STEP);
    if (q.rowing && !set) { q.over.hours = 5000; q.over.sea = true; set = true; }
    if (set && !q.rowing) break;
  }
  assert.ok(set && w.stats().boatsLost >= 1, "a boat can be lost");
  assert.ok(!v.boat && q.cargo === null, "with its load, and the village is without one");
  assert.ok(w.events.some(e => /boat was lost/.test(e.text)), "and the news says so");
}

console.log("world-builder roads: paths from walking that fade, carts owned, goods by boat, boats lost");
