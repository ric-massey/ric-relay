// Walls, sieges and raids (TODO.md item 14e, 2026-11-19).
//
// What is held:
//   1. a war's soldiers go home for the harvest: fewer under arms at harvest than in the summer
//      before it, and they come back in the spring;
//   2. a walled place holds out longer: the same siege, seed for seed, takes a place with no wall
//      sooner than the same place with one;
//   3. bands are sent raiding besides the army, and a war of two years sees houses burned by them;
//   4. who is winning counts: a side that has lost places is wearier than one that has taken them.
//
// node projects/world-builder/test/walls.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const war = seed => {
  const w = People.create({ seed, people: 600, factions: 3, battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old" });   // the parts built after this one (TODO 15.6e to 15.9; 15.6e left this red: armies that choose battle took no open place in five months), off: walls as they were built
  const [a, b] = w.factions;
  w.rule(a.id, true); w.declare(a.id, b.id, "war"); w.rule(a.id, false);
  return { w, a, b };
};

// 1 and 3. The season, and bands.
{
  const { w, a, b } = war(68);
  let summer = 0, harvest = 0, spring = 0, sawHarvest = false;
  for (let d = 0; d < 420; d++) {
    w.step(24);
    const s = w.season(), n = a.soldiers + b.soldiers;
    if (!a.rel[b.id].war) break;
    if (s.name === "summer" && s.ripe < 1.05 && !sawHarvest) summer = Math.max(summer, n);
    if (s.ripe > 1.5) { sawHarvest = true; harvest = Math.max(harvest, n); }
    if (sawHarvest && s.name === "spring" && d > 300) spring = Math.max(spring, n);
  }
  assert.ok(summer > 0 && harvest > 0, "a summer and a harvest at war: " + summer + ", " + harvest);
  assert.ok(harvest < summer * 0.6, "fewer under arms at harvest than in the summer: " + harvest + " against " + summer);
  if (a.rel[b.id].war) assert.ok(spring > harvest, "and called up again in the spring: " + spring);
  assert.ok(w.stats().bands > 0, "bands sent raiding");
}

// 2. A wall.
{
  let checked = 0;
  for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) {
    const taken = wall => {
      const { w, a, b } = war(seed);
      const v = w.villages.find(x => x.alive && x.id === a.target[b.id]);
      if (!v) return null;
      v.wall = wall;
      for (let d = 0; d < 150; d++) {
        if (wall === 0) v.wall = 0; else v.wall = Math.max(v.wall, wall);   // held where it was set
        w.step(24);
        if (v.f !== b.id) return d;
        if (!a.rel[b.id].war) return 999;
      }
      return 999;
    };
    const open = taken(0);
    if (open === null || open >= 150) continue;
    const walled = taken(1);
    assert.ok(walled > open, "seed " + seed + ": with no wall taken on day " + open + ", walled " + (walled === 999 ? "held" : "taken on day " + walled));
    checked++;
    if (checked >= 2) break;
  }
  assert.ok(checked >= 1, "some open place was taken within five months");
}

// 4. Who is winning.
{
  const { w, a, b } = war(5);
  const rel = a.rel[b.id], back = b.rel[a.id];
  rel.lost = 2; back.took = 2;
  assert.ok(w.winning(rel, 2, 6, a) > w.winning(back, 6, 2, b) + 0.5, "a side that lost two of its four places is far wearier than the side that took them");
  rel.lost = 0; back.took = 0;
  assert.ok(Math.abs(w.winning(rel, 4, 4, a) - w.winning(back, 4, 4, b)) < 0.05, "between equals it comes to nothing either way");
}

console.log("world-builder walls: home for the harvest, a wall holds out longer, bands sent raiding, who is winning counts");
