// Quarrels between villages (TODO.md 15.5i2, 2026-11-22). Ric, choosing from 15.5i: "Quarrels between
// villages". 15.5i measured every quarrel in seven worlds between neighbours of one village.
//
// What is held:
//   1. off, the world is the one 15.5i1 left, step for step;
//   2. somebody hot-tempered with a deep grudge against somebody of another village nearby has it out.
//
// node projects/world-builder/test/feuds.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { builtRoads: false };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2553129383;   // print() of 15.5i1's engine, seed 2, 60 days

{
  const w = People.create({ seed: 2, feuds: false, builtRoads: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15.5i2");
}

const sought = feuds => {
  const w = People.create({ ...LATER, seed: 5, people: 400, villages: 4, factions: 1, feuds });
  w.step(24 * 3);
  const p = w.people.find(q => q.hp > 0 && q.age > 20 && q.job !== "soldier");
  const q = w.people.find(r => r.hp > 0 && r.age > 20 && r.home !== p.home && r.job !== "soldier" && Math.hypot(w.villages[r.home].x - w.villages[p.home].x, w.villages[r.home].y - w.villages[p.home].y) < 20);
  assert.ok(q, "a grown-up of a village nearby");
  Object.assign(p, { temper: 1, patient: 0, food: 40 }); p.quarrelAt = -1e9;
  w.befriend(p, q, -1);
  for (let h = 0; h < 24 * 4; h++) { w.step(1); if (p.askOf === q.id && p.chose === "quarrel") return true; p.food = Math.max(p.food, 40); }
  return false;
};
const on = sought(true), off = sought(false);
console.log("  a deep grudge against somebody of the next village: " + (on ? "went to have it out" : "let it be") + "; off: " + (off ? "went" : "let it be"));
assert.ok(on && !off, "goes to have it out with them, only when on");

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder quarrels between villages: off is the world before; a deep grudge sought out next door");
