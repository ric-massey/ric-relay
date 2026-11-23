// Leave to cross another people's land (TODO 15.6f, 2026-11-23). Ric: "why wouldnt soldiers avoid areas
// that are others property unless they haave persmission?"
//
// What is held:
//   1. a world where nobody marches is the world it was (two peoples, a year, no third to cross);
//   2. a friendly people gives leave; a hostile one refuses, and the army turns to another goal;
//   3. a bold, strong general refused forces the way, and the people crossed holds it against them;
//   4. leave once given or refused is kept for the season, not asked again every day.
//
// node projects/world-builder/test/passage.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

{
  const a = People.create({ seed: 4, people: 200, factions: 2, rebel: 0 }), b = People.create({ seed: 4, people: 200, factions: 2, rebel: 0, passage: "old" });   // rebel 0: no third people breaks away
  a.step(24 * 200); b.step(24 * 200);
  assert.equal(print(a), print(b), "with no third people to cross, the world is the world it was");
}
const setup = () => {
  const w = People.create({ seed: 4, people: 300, factions: 3, war: false }); w.step(24 * 3);
  const A = w.villages.find(v => v.alive && v.f === 0), B = w.villages.find(v => v.alive && v.f === 2);
  return { w, A, B, x: w.factions[2], f: w.factions[0], lead: w.people.find(p => p.id === w.factions[0].leader) };
};
{
  const { w, A, B, x } = setup();
  x.rel[0].op = 0.6; x.rel[0].trade = true;
  assert.equal(w.passage(0, 1, A.id, B.id), true, "a friendly people gives leave");
  assert.ok(w.stats().passGiven >= 1);
  const asked = w.stats().passAsked;
  w.passage(0, 1, A.id, B.id);
  assert.equal(w.stats().passAsked, asked, "and is not asked again this season");
}
{
  const { w, A, B, x, f, lead } = setup();
  x.rel[0].op = -0.8; x.rel[0].bond = -0.8; f.treasury = 0; lead.bold = 0.2;
  assert.equal(w.passage(0, 1, A.id, B.id), false, "a hostile people refuses");
  assert.ok(f.camp[1].barred[B.id] > w.tick, "and that goal is given up for now");
  assert.equal(w.stats().passForced, 0);
}
{
  const { w, A, B, x, f, lead } = setup();
  x.rel[0].op = -0.8; x.rel[0].bond = -0.8; f.treasury = 0; lead.bold = 1; f.soldiers = 500; f.adults = 2000;
  const g0 = x.rel[0].grief;
  assert.equal(w.passage(0, 1, A.id, B.id), true, "a bold, strong general forces the way");
  assert.ok(x.rel[0].grief > g0 + 0.4, "and it is held against them");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder leave to cross: unchanged with nobody to cross; given, refused and kept; forced and held against");
