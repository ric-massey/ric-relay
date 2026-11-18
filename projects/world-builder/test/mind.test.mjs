// The mind: a fixed number of things a person holds (TODO.md item 11, 2026-11-17). Ric: 20 by
// default, people differing "A little", and "Grudges last longest".
//
// What is held:
//   1. nobody's mind ever holds more than its size, sizes differ a little, and every thing held
//      reads as plain words for the person panel;
//   2. a grudge formed in year 1 still changes a choice in year 3.
//
// node projects/world-builder/test/mind.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. Sixty days of the default world.
{
  const w = People.create({ seed: 11 });
  const sizes = new Set();
  for (let d = 0; d < 60; d++) {
    w.step(24);
    for (const p of w.people) {
      const m = w.inMind(p);
      assert.ok(m.length <= p.mcap + 1, p.name + " holds " + m.length + " things in a mind of " + (p.mcap + 1));
      if (d === 59) {
        sizes.add(p.mcap);
        for (const x of m) assert.ok(typeof x.text === "string" && x.text.length > 3 && !/undefined|NaN/.test(x.text), "in plain words: " + x.text);
      }
    }
  }
  const all = [...sizes];
  assert.ok(Math.min(...all) >= 14 && Math.max(...all) <= 26 && all.length >= 5, "minds differ a little about 20: " + all.sort((a, b) => a - b).join(", "));
  const full = w.people.filter(p => w.inMind(p).length === p.mcap + 1).length;
  assert.ok(full > 0, "some minds are full, and have forgotten to make room: " + full);
}

// 2. A grudge made on the first day: everybody here is even-tempered, so nobody has it out with
// anybody until year 3.
{
  const w = People.create({ seed: 5, people: 80, villages: 1, factions: 1, war: false, soldiers: 0, plague: "none", temper: 0 });
  w.step(1);
  const young = w.people.filter(p => w.adult(p) && p.age < 30 && !p.partner);
  const kin = (a, b) => a.mum === b.id || a.dad === b.id || b.mum === a.id || b.dad === a.id || (a.mum && a.mum === b.mum);
  const pairs = [];
  for (let i = 0; i + 1 < young.length && pairs.length < 8; i += 2) {
    const [a, b] = young.slice(i, i + 2);
    if (kin(a, b)) continue;
    w.befriend(a, b, -0.9);
    pairs.push([a.id, b.id]);
  }
  assert.ok(pairs.length >= 2, "pairs to watch");
  for (const p of w.people) p.temper = 0;
  w.step(24 * 365 * 2);
  let looked = 0, went = 0;
  for (const [ai, bi] of pairs) {
    const a = w.byId.get(ai), b = w.byId.get(bi);
    if (!a || !b || a.home !== b.home) continue;
    looked++;
    assert.ok(w.feel(a, b.id) < -0.4, "a grudge left two years holds: " + w.feel(a, b.id).toFixed(2));
    a.temper = 0.95;
  }
  assert.ok(looked >= 1, "somebody with a grudge is still alive and next door to its object in year 3");
  /* Caught as they set off (`quarrelAt` is when they last chose to): next door, the quarrel is
     over within the hour. */
  const was = new Map(pairs.map(([ai]) => [ai, w.byId.get(ai)?.quarrelAt]));
  for (let h = 0; h < 24 * 30 && !went; h++) {
    w.step(1);
    for (const [ai, bi] of pairs) { const a = w.byId.get(ai); if (a && a.quarrelAt !== was.get(ai) && a.askOf === bi) went++; }
  }
  assert.ok(went > 0, "in year 3 they go to have it out over a grudge from year 1");
}

console.log("world-builder mind: never past its size, sizes differ a little, in plain words, a year-1 grudge acted on in year 3");
