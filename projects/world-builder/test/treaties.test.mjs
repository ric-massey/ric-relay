// Peace and dealings left from item 13 (TODO.md item 14d, 2026-11-19).
//
// What is held:
//   1. tribute is an amount agreed for how lopsided the two sides are: a side twice as strong takes
//      about a sixth of the stores a year, three times as strong more, an even match little;
//   2. a trade deal needs trade both ways across the border: offered with none, it is refused;
//   3. a marriage between two leaders' families binds them while the couple are together; a war
//      begun while it holds is a marriage that failed, and a parting ends the tie, and is told.
//
// node projects/world-builder/test/treaties.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. The amount.
{
  const w = People.create({ seed: 9, factions: 2, people: 200 });
  const s = w.tributeShare;
  assert.ok(s(1.1) < s(2) && s(2) < s(3) && s(3) < s(6), "more for a more lopsided match");
  assert.ok(Math.abs(s(2) - 1 / 6) < 0.01, "a side twice as strong takes a sixth: " + s(2));
  const [a, b] = w.factions;
  w.rule(a.id, true);
  const r = w.declare(a.id, b.id, "tribute");
  if (r === "paid") {
    const rate = b.rel[a.id].rate;
    assert.ok(rate > 0 && rate < 0.003, "paid at the agreed rate, under the old flat 0.3% a day: " + rate);
    assert.ok(w.events.some(e => e.kind === "tribute" && / of its stores a year/.test(e.text)), "and the amount is told");
  } else assert.equal(r, "refused");
}

// 2. Trade first, then a deal.
{
  const w = People.create({ seed: 9, factions: 2, people: 200 });
  const [a, b] = w.factions;
  w.rule(a.id, true);
  a.rel[b.id].op = b.rel[a.id].op = 0.6;
  a.rel[b.id].sold = b.rel[a.id].sold = 0;
  assert.equal(w.declare(a.id, b.id, "trade"), "refused-trade", "no trade between them, no deal");
  a.rel[b.id].sold = 400; b.rel[a.id].sold = 0;
  assert.equal(w.declare(a.id, b.id, "trade"), "refused-trade", "trade one way only, no deal");
  b.rel[a.id].sold = 400;
  assert.equal(w.declare(a.id, b.id, "trade"), "trade", "trade both ways: a deal");
}

// 3. A marriage, and whether it holds.
{
  let done = false;
  for (const seed of [4, 5, 6, 7, 8]) {
    const w = People.create({ seed, factions: 2, people: 300 });
    const [a, b] = w.factions;
    if (!w.wed(a.id, b.id)) continue;
    const rel = a.rel[b.id], back = b.rel[a.id];
    assert.ok(rel.wed && back.wed && w.bound(rel) && w.bound(back), "the two are bound");
    const x = w.byId.get(rel.wed[0]), y = w.byId.get(rel.wed[1]);
    assert.equal(x.partner, y.id, "and married");
    if (x.id !== a.leader || y.id !== b.leader) assert.equal(x.f, y.f, "the one who is not a leader goes to live on the other side");   // two leaders keep their own lands
    w.rule(a.id, true);
    assert.equal(w.declare(a.id, b.id, "war"), "war");
    assert.equal(w.stats().wedBroken, 1, "a war begun while it held: a marriage that failed");
    assert.ok(w.events.some(e => e.kind === "war" && e.text.includes("did not hold")), "and it is told");
    x.partner = 0; y.partner = 0;
    w.step(24);
    assert.equal(rel.wed, null, "a parting ends the tie");
    assert.ok(w.events.some(e => e.kind === "wed" && e.text.includes("is over")), "and it is told");
    done = true; break;
  }
  assert.ok(done, "some world had two leading families with somebody free to marry");
}

console.log("world-builder treaties: tribute agreed for how lopsided, trade deals need trade both ways, a marriage binds and can fail");
