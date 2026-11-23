// Parole, deserters and the books (TODO 15.5u, 2026-11-23). Ric: "there are a few bugs that need to be
// added in", then, of deserters and the unfree, "this should be dependednt on the leaders".
//
// What is held:
//   1. "As before" is the world before, byte for byte;
//   2. a village's spare food (stats) and spare coins (workDay) are kept apart;
//   3. a prisoner let go on their word is not called up while that war lasts, and may be once it ends;
//   4. a people that defaults on its war loans pays what is left to its lenders: no coin leaves the world;
//   5. a deserter is taken back by a forgiving leader and kept out (and punished) by a hard one;
//   6. people held unfree are kept out of the levy unless the leader arms them.
//
// node projects/world-builder/test/warbooks.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { warBy: "era", formations: "nearest" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 1505646459;   // print() of the world before (armies spread out), seed 2, 60 days

{
  const w = People.create({ ...LATER, seed: 2, warBooks: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"As before\" is the world before");
}

// 2. Spare food and spare coins.
{
  const w = People.create({ ...LATER, seed: 3 });
  w.step(48);
  const v = w.villages.find(u => u.alive);
  const food = v.spare;
  w.workDay();
  assert.equal(v.spare, food, "workDay leaves the spare food alone");
  assert.ok(typeof v.spareCoins === "number", "and counts spare coins apart");
  const o = People.create({ ...LATER, seed: 3, warBooks: "old" });
  o.step(48);
  const u = o.villages.find(x => x.alive);
  o.workDay();
  assert.equal(u.spareCoins, undefined, "before, there was one name for both");
}

// 3. Parole.
{
  const w = People.create({ ...LATER, seed: 4, factions: 2 });
  w.step(24);
  w.startWar(0, 1);
  const p = w.people.find(q => q.f === 0 && q.hp > 0 && q.age > 20 && !q.unfree);
  w.heldOf().set(p.id, { by: 1, v: w.villages.find(v => v.f === 1).id, taker: 0, since: w.tick });
  w.releasePrisoner(p, "released");
  assert.equal(w.parole.get(p.id), 1, "their word is to the people that held them");
  assert.equal(w.mayServe(p), false, "not called up while that war lasts");
  w.factions[0].rel[1].war = false; w.factions[1].rel[0].war = false;
  assert.equal(w.mayServe(p), true, "the war over, they may be");
  assert.equal(w.parole.has(p.id), false, "and the word is spent");
}

// 4. A default pays the lenders what is left.
for (const books of ["kept", "old"]) {
  const w = People.create({ ...LATER, seed: 5, warBooks: books });
  w.step(24);
  const f = w.factions[0], rich = w.people.filter(q => q.hp > 0 && q.age > 20).slice(0, 3);
  const book = new Map(rich.map(q => [q.id, f.pop * 5]));
  w.loans().set(f.id, book);
  f.treasury = 50;
  const before = w.stats().money;
  w.borrow(f.id, 1);
  const after = w.stats().money;
  assert.equal(w.loans().has(f.id), false, books + ": the loans are gone");
  if (books === "kept") assert.ok(Math.abs(after - before) < 1e-6, "kept: every coin is still somewhere (" + before + " → " + after + ")");
  else assert.ok(before - after > 49, "before: the treasury's coins left the world");
}

// 5. Deserters, as the leader would have it.
{
  const w = People.create({ ...LATER, seed: 6, factions: 2, rule: "chief", govern: "leader" });
  w.step(24);
  w.startWar(0, 1);
  const f = w.factions[0], lead = w.byId.get(f.leader);
  const kind = () => w.people.find(q => q.f === 0 && q.hp > 0 && q.age > 20 && q.id !== f.leader && !w.deserted.has(q.id));
  lead.warm = 0.95; lead.temper = 0.1;
  const a = kind(); w.deserterJudged(a, false);
  assert.equal(w.deserted.has(a.id), false, "a forgiving leader takes them back");
  assert.equal(w.mayServe(a), true, "and they may be called up again");
  lead.warm = 0.1; lead.temper = 0.95;
  const b = kind(); b.coins = 20; w.deserterJudged(b, false);
  assert.equal(w.deserted.get(b.id), 0, "a hard one keeps them out");
  assert.equal(w.mayServe(b), false, "for the war");
  assert.ok(b.coins < 20 || b.hp < 1, "and punishes them");
  lead.warm = 0.5; lead.temper = 0.5;
  const c = kind(); const coins = c.coins; w.deserterJudged(c, false);
  assert.ok(w.deserted.has(c.id) && c.coins === coins, "one in between lets them be, kept out");
}

// 6. The unfree.
{
  const w = People.create({ ...LATER, seed: 7, factions: 2 });
  w.step(24);
  const f = w.factions[0], p = w.people.find(q => q.f === 0 && q.hp > 0 && q.age > 20 && q.id !== f.leader);
  p.unfree = f.leader;
  assert.equal(w.mayServe(p), false, "kept out of the levy");
  f.armUnfree = true;
  assert.equal(w.mayServe(p), true, "unless the leader arms them");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder parole, deserters and the books: before unchanged; spare food and coins apart; parole holds for the war; a default pays the lenders; deserters and the unfree as the leader decides");
