// The mind: a fixed number of things a person holds (TODO.md item 11, 2026-11-17). Ric: 20 by
// default, people differing "A little", and "Grudges last longest".
//
// What is held:
//   1. nobody's mind ever holds more than its size, sizes differ a little, and every thing held
//      reads as plain words for the person panel;
//   2. a grudge formed in year 1 still changes a choice in year 3;
//   3. nobody is close to more than five people (Ric, 2026-11-18: "do 5");
//   4. being turned away when hungry makes nobody an enemy: grudges stay few.
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
      assert.ok(m.filter(x => (x.kind === "friend" || x.kind === "family") && x.strength > 0.5).length <= 5, p.name + " is close to more than five");
      if (d === 59) {
        sizes.add(p.mcap);
        for (const x of m) assert.ok(typeof x.text === "string" && x.text.length > 3 && !/undefined|NaN/.test(x.text), "in plain words: " + x.text);
      }
    }
  }
  const all = [...sizes];
  assert.ok(Math.min(...all) >= 14 && Math.max(...all) <= 26 && all.length >= 5, "minds differ a little about 20: " + all.sort((a, b) => a - b).join(", "));
  const ad = w.people.filter(p => w.adult(p));
  const grudges = ad.reduce((a, p) => a + w.inMind(p).filter(x => (x.kind === "friend" || x.kind === "family") && x.strength < -0.15).length, 0) / ad.length;
  assert.ok(grudges < 1.5, "grudges stay few: " + grudges.toFixed(2) + " an adult");
  const full = w.people.filter(p => w.inMind(p).length === p.mcap + 1).length;
  assert.ok(full > 0, "some minds are full, and have forgotten to make room: " + full);
}

// 2. A grudge made on the first day: everybody here is even-tempered, so nobody has it out with
// anybody until year 3.
{
  const w = People.create({ seed: 5, people: 80, villages: 1, factions: 1, war: false, soldiers: 0, plague: "none", temper: 0 });
  w.step(1);
  /* Every single adult under 45, paired with the first one free who isn't kin: under-30s alone
     gave two pairs, too few to count on one of them still living side by side in year 3 (15.5t's
     harvest tax moved the last such pair into a new village). */
  const young = w.people.filter(p => w.adult(p) && p.age < 45 && !p.partner);
  const kin = (a, b) => a.mum === b.id || a.dad === b.id || b.mum === a.id || b.dad === a.id || (a.mum && a.mum === b.mum);
  const pairs = [];
  const used = new Set();
  for (const a of young) {
    if (pairs.length >= 8) break;
    if (used.has(a.id)) continue;
    const b = young.find(b => b !== a && !used.has(b.id) && !kin(a, b));
    if (!b) continue;
    used.add(a.id); used.add(b.id);
    w.befriend(a, b, -0.9);
    pairs.push([a.id, b.id]);
  }
  assert.ok(pairs.length >= 6, "pairs to watch: " + pairs.length);
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

console.log("world-builder mind: never past its size, sizes differ a little, in plain words, a year-1 grudge acted on in year 3, close to five at most, few grudges");
