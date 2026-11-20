// Made to order (TODO.md 15.5a, 2026-11-20). Ric: crafters make to order, "yes"; households do
// not use goods up (no new need); when nobody wants what crafters make they do what people did —
// other work, which `choose` already weighs.
//
// What is held:
//   1. a default world's store holds about what its people took from it in the last season, not a
//      pile that grows all year (before: 38–54 goods a head after a year, against about 0.3–0.6);
//   2. what is made is about what is taken, not ten times it;
//   3. the order book adds up: a village's `wanted` is the sum of its people's orders;
//   4. an empty store gets goods made for it when people ask, and the orders are filled;
//   5. the same holds with shared money and with one kind of goods.
//
// node projects/world-builder/test/orders.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const book = w => {
  const sum = new Map();
  for (const p of w.people) if (p.hp > 0 && p.order > 0) sum.set(p.orderV, (sum.get(p.orderV) || 0) + p.order);
  for (const v of w.villages) if (v.alive)
    assert.ok(Math.abs((sum.get(v.id) || 0) - v.wanted) < 1e-6, v.name + "'s orders add up: " + (sum.get(v.id) || 0).toFixed(3) + " held by its people, " + v.wanted.toFixed(3) + " in its book");
};

function run(o, days) {
  const w = People.create(o);
  for (let d = 0; d < days; d++) { w.step(24); if (d % 15 === 14) book(w); }
  const vs = w.villages.filter(v => v.alive), s = w.stats();
  return { w, s, store: vs.reduce((n, v) => n + v.goods, 0), used: vs.reduce((n, v) => n + v.used, 0), pop: vs.reduce((n, v) => n + v.pop, 0) };
}

/* 1–3. The default world, ninety days. */
{
  const r = run({ seed: 1 }, 90);
  assert.ok(r.store <= r.used * 2 + r.pop * 0.2 + 10,
    "the store holds about a season's use: " + r.store.toFixed(0) + " on the shelves, " + r.used.toFixed(0) + " taken in the season, " + r.pop + " people");
  assert.ok(r.store / r.pop < 2, "not a pile: " + (r.store / r.pop).toFixed(2) + " goods a head (before 15.5a, 21 at ninety days)");
  assert.ok(r.s.goodsMade < r.s.goodsUsed * 3 + r.pop,
    "made about what is taken: " + r.s.goodsMade.toFixed(0) + " made, " + r.s.goodsUsed.toFixed(0) + " taken (before 15.5a, 10,101 and 1,932)");
  assert.ok(r.s.goodsUsed > 0 && r.s.goodsMade > 0, "goods are still made and used");
}

/* 4. Every store, every household's goods and the season's use gone on the first day: people ask, crafters make,
   orders are filled. */
{
  const w = People.create({ seed: 3 });
  w.step(24);
  /* The season's use cleared too, so nothing is made for stock: only orders can start the benches. */
  for (const v of w.villages) { v.goods = 0; v.used = 0; }
  for (const p of w.people) p.goods = 0;
  const made0 = w.stats().goodsMade;
  let asked = 0;
  for (let h = 0; h < 30 * 24; h++) { w.step(1); asked = Math.max(asked, w.villages.reduce((n, v) => n + (v.alive ? v.wanted : 0), 0)); }
  book(w);
  assert.ok(asked > 0, "people with nothing in the store leave orders");
  assert.ok(w.stats().goodsMade - made0 > 1, "goods are made for them: " + (w.stats().goodsMade - made0).toFixed(1));
  const filled = w.people.filter(p => p.hp > 0 && w.adult(p) && p.goods > 0.15).length, adults = w.people.filter(p => p.hp > 0 && w.adult(p)).length;
  assert.ok(filled > adults * 0.3, "and get them: " + filled + " of " + adults + " grown-ups hold goods again");
}

/* 5. Shared money and one kind of goods. */
for (const o of [{ seed: 2, money: "shared" }, { seed: 2, materials: "goods" }]) {
  const r = run(o, 60);
  assert.ok(r.store / Math.max(1, r.pop) < 2, JSON.stringify(o) + ": not a pile, " + (r.store / Math.max(1, r.pop)).toFixed(2) + " goods a head");
  assert.ok(r.s.goodsMade > 0, JSON.stringify(o) + ": goods are made");
}

console.log("Made to order: the store holds about a season's use, made about what is taken, the order book adds up, an empty store is refilled on orders, shared money and one kind of goods.");
