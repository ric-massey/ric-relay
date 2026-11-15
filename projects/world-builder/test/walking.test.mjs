// The walking short cuts must not change the world (TODO.md item 1, 2026-11-15).
//
// people.js remembers a blocked step and a way round that could not be found,
// and places a crowd with a finer map of taken ground. Each is only allowed to
// be faster. `create(options, { plainWalking: true })` runs the same engine with
// all three turned off, so the two can be held equal here, on this machine —
// a stored answer would not do, because a sine differs by a hair between an
// Apple and an Intel chip and a simulation compounds it.
//
// node projects/world-builder/test/walking.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// What a person is, without walking's own book-keeping.
const OWN = new Set(["ox", "oy", "mc", "mx", "my", "mdx", "mdy", "rm", "on"]);
const picture = w => JSON.stringify({
  people: w.people.map(p => JSON.stringify(p, (k, v) => OWN.has(k) ? undefined : v instanceof Map ? [...v] : v)),
  villages: w.villages, factions: w.factions, events: w.events, stats: w.stats()
});
const both = options => [People.create(options), People.create(options, { plainWalking: true })];
function sameFor(label, options, hours, each) {
  const [fast, plain] = both(options);
  assert.equal(picture(fast), picture(plain), label + ": the two must start as the same world");
  for (let h = 0; h < hours; h++) {
    if (each) { each(fast, h); each(plain, h); }
    fast.step(1); plain.step(1);
    assert.equal(picture(fast), picture(plain), label + ": different after hour " + (h + 1));
  }
  return fast;
}

// 1. A packed village: most people are blocked most of the time, which is the
//    case the memory exists for. If it were never used this would prove nothing,
//    so count that people really are standing blocked.
{
  const w = sameFor("a packed village", { people: 700, factions: 1, villages: 1, map: 8, seed: 3, plague: "none" }, 10);
  const blocked = w.people.filter(p => p.mc >= 0).length;
  assert.ok(blocked > 50, "the packed village should have people remembered as blocked; found " + blocked);
}

// 2. People dying makes room: war and sickness on, a hungry start.
sameFor("war and sickness", { people: 500, factions: 4, villages: 1, map: 9, seed: 5, plague: "common", war: true, aggression: 1, deadly: 3, stored: 0 }, 18);

// 3. People moved from outside, as other tests and the page may do: the place
//    they left has room in it and the neighbours must notice. The same for
//    somebody marked dead from outside rather than by the engine.
sameFor("moved from outside", { people: 400, factions: 1, villages: 1, map: 8, seed: 9, plague: "none" }, 9, (w, h) => {
  if (h === 2 || h === 5) for (let i = 3; i < w.people.length; i += 5) w.people[i].hp = -99;
  if (h % 3 !== 1) return;
  for (let i = 0; i < w.people.length; i += 7) { const p = w.people[i]; p.x = 2 + (i % 40) * 0.5; p.y = 2 + (h % 5) * 0.5; p.tx = p.x; p.ty = p.y; }
});

// 4. A crowd placed at once stands exactly where the plain search puts it, and
//    nobody is inside anybody.
{
  const options = { people: 3000, factions: 2, villages: 1, map: 20, seed: 11, plague: "none" };
  const [fast, plain] = both(options);
  assert.equal(picture(fast), picture(plain), "a crowd is placed in the same spots");
  const byTile = new Map();
  for (const p of fast.people) { const k = Math.floor(p.y) * fast.cols + Math.floor(p.x); if (!byTile.has(k)) byTile.set(k, []); byTile.get(k).push(p); }
  for (const p of fast.people) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
    for (const q of byTile.get((Math.floor(p.y) + j) * fast.cols + Math.floor(p.x) + i) || [])
      assert.ok(q === p || Math.hypot(p.x - q.x, p.y - q.y) >= 0.42 - 1e-9, "two people are standing in the same place");
}

// 5. Real-size bodies have no short cuts to take; the switch must change nothing.
sameFor("real-size bodies", { people: 300, map: 10, seed: 2, bodies: "real" }, 8);

console.log("walking: the short cuts leave the world exactly as it was");
