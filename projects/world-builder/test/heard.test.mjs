// Acting on more of what is heard (TODO.md item 12b, 2026-11-19). Ric: people act on news of
// "Sickness", "Famine" and "Prices and harvests"; traders "Keep it, news adds a pull"; a sickness at
// home sends "A few, to family".
//
// What is held:
//   1. a report of a sickness keeps people from setting out for the village it names, and a
//      telling that names another village keeps them from that one instead (the item's "done when");
//   2. a report that a village is starving sends family elsewhere there with food.
//
// node projects/world-builder/test/heard.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. Everybody outside the biggest village (A) is told a sickness has started there; or, in the
//    second world, told the same news naming the next biggest (B). Trips set out for each by people
//    who do not live there (to sell, trade or look for a market), over the next thirty days.
function trips(say) {
  const w = People.create({ seed: 13, plague: "none" });
  w.step(24 * 60);
  const big = w.villages.filter(v => v.alive).sort((a, b) => b.pop - a.pop), A = big[0], B = big[1];
  const e = w.report("sick", A.id, w.people.filter(p => p.hp > 0 && w.adult(p) && p.home !== A.id).map(p => p.id), say === "B" ? B.id : A.id);
  assert.ok(w.telling(e, say === "B" ? 1 : 0).includes(say === "B" ? B.name : A.name), "the telling names the village it should");
  const TRIP = new Set(["carry", "scout", "pickup"]), was = new Map();
  for (const p of w.people) was.set(p.id, p.at + ":" + p.task);
  let toA = 0, toB = 0;
  for (let h = 0; h < 24 * 30; h++) {
    w.step(1);
    for (const p of w.people) {
      if (p.hp <= 0) continue;
      const k = p.at + ":" + p.task;
      if (k !== was.get(p.id) && TRIP.has(p.task)) { if (p.at === A.id && p.home !== A.id) toA++; if (p.at === B.id && p.home !== B.id) toB++; }
      was.set(p.id, k);
    }
  }
  return { toA, toB };
}
{
  const right = trips("A"), wrong = trips("B");
  assert.ok(right.toA * 3 < wrong.toA, "told the sickness is at A, fewer set out for A than when told it is at B: " + JSON.stringify({ right, wrong }));
  assert.ok(wrong.toB * 3 < right.toB, "told it is at B, fewer set out for B than when told it is at A: " + JSON.stringify({ right, wrong }));
}

// 2. Everyone with family in another village is told that village is starving.
{
  const w = People.create({ seed: 11, plague: "none" });
  w.step(24 * 200);
  const byV = new Map();
  for (const p of w.people) {
    if (p.hp <= 0 || !w.adult(p)) continue;
    const fam = w.inMind(p).filter(x => x.kind === "family");
    for (const [id, s] of w.tiesOf(p)) {
      if (s <= 0.3) continue;
      const q = w.byId.get(id);
      if (q && q.hp > 0 && q.home !== p.home && fam.some(x => x.text.includes(q.name))) { if (!byV.has(q.home)) byV.set(q.home, new Set()); byV.get(q.home).add(p.id); }
    }
  }
  assert.ok(byV.size > 0, "somebody has family in another village by day 200");
  for (const [v, ids] of byV) w.report("famine", v, [...ids]);
  const before = w.stats().helped;
  w.step(24 * 10);
  assert.ok(w.stats().helped - before > 20, "family carried food to a village they heard was starving: " + Math.round(w.stats().helped - before));
}

console.log("world-builder heard: a sickness keeps people from setting out for the village named in the telling they hold, right or wrong; family carry food where they hear of a famine");
