// Prisoners and ransom, mutiny, and paying for war by borrowing (TODO.md 15q, 2026-11-22). From 15k's
// gaps 5, 6 and 7.
//
// What is held:
//   1. with "None of it" the world is the one 15p left, step for step;
//   2. a prisoner is kept at the captor's place and ransomed, most of it to the one who took them;
//   3. unransomed, an exchange if they hold one of ours; a hard, dishonest captor kills;
//   4. soldiers left unpaid rise together, take their pay, and obey again once paid;
//   5. a people at war borrows from the rich (no coin made), and defaults when it cannot pay.
//
// node projects/world-builder/test/spoils.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = {};   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 3175300586;   // print() of 15p's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, ransom: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15q");
}

const make = () => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false });
  w.step(24 * 2);
  w.startWar(0, 1);
  return w;
};
const soldiersOf = (w, fid) => w.people.filter(p => p.f === fid && p.job === "soldier" && p.hp > 0);

// 2. Taken and ransomed.
{
  const w = make(), [by] = soldiersOf(w, 0), [q] = soldiersOf(w, 1);
  q.coins = 40; by.coins = 0;
  w.takePrisoner(q, by);
  const h = w.held(q);
  assert.ok(h && w.villages[h.v].f === 0, "held at a place of the captor's");
  w.step(24 * 3);
  const hv = w.villages[h.v];
  console.log("  held three days: " + Math.hypot(q.x - hv.x, q.y - hv.y).toFixed(1) + " squares from " + hv.name);
  assert.ok(Math.hypot(q.x - hv.x, q.y - hv.y) < 3, "kept there");
  for (let d = 0; d < 12 && w.held(q); d++) { w.step(24); w.ransoms(0); }
  console.log("  ransomed: " + !w.held(q) + "; the one who took them has " + by.coins.toFixed(1) + " coins");
  assert.ok(!w.held(q) && q.job !== "soldier", "ransomed and home on their word");
  assert.ok(by.coins > 10, "a living for the soldier who took them");
}

// 3. Unransomed.
{
  const w = make(), [a, b] = soldiersOf(w, 0), [c, d] = soldiersOf(w, 1);
  for (const p of [a, b, c, d]) { p.coins = 0; p.mum = p.dad = 0; p.partner = 0; p.wards = null; }
  w.takePrisoner(c, a);   // ours hold one of theirs
  w.takePrisoner(b, d);   // and they one of ours
  w.step(24 * 61); w.ransoms(0);
  assert.ok(!w.held(c) && !w.held(b), "exchanged after two months");
  const [e] = soldiersOf(w, 1).filter(p => p !== c && p !== d), lead = w.people.find(p => p.id === w.factions[0].leader);
  e.coins = 0; e.mum = e.dad = 0; e.partner = 0; e.wards = null;
  lead.temper = 1; lead.honest = 0;
  const [g] = soldiersOf(w, 0);
  w.takePrisoner(e, g);
  assert.ok(w.held(e), "taken");
  for (let d = 0; d < 61; d++) { e.coins = 0; w.step(24); }
  w.ransoms(0);
  console.log("  after two months: exchanged " + w.stats().exchanged + ", killed by a hard captor " + w.stats().prisonersKilled + " (ransomed " + w.stats().ransomed + ", released " + w.stats().released + ", e " + e.hp.toFixed(2) + " " + e.job + ", held " + !!w.held(e) + ", temper " + lead.temper + ")");
  assert.ok(e.hp <= 0 && w.stats().prisonersKilled === 1, "a hard, dishonest captor kills");
}

// 4. Mutiny.
{
  const w = make(), f = w.factions[0], s = soldiersOf(w, 0);
  for (const p of s) p.unpaid = 8;
  f.treasury = 0;
  const v = w.villages[s[0].home]; v.till = 100;
  w.mutinyDay(0);
  console.log("  " + s.length + " unpaid soldiers: mutinies " + w.stats().mutinies + ", took " + w.stats().mutinyTook.toFixed(1));
  assert.equal(w.stats().mutinies, 1, "they rise together");
  assert.ok(w.stats().mutinyTook > 0 && v.till < 100, "and take their pay where they are");
  f.treasury = 10000; w.mutinyDay(0);
  assert.equal(f.mutiny, null, "paid, they obey again");
}

// 5. Borrowing and default.
{
  const w = make(), f = w.factions[0];
  const sum = () => w.people.reduce((a, p) => a + p.coins, 0) + w.villages.reduce((a, v) => a + v.till, 0) + w.factions.reduce((a, g) => a + g.treasury, 0);
  for (const p of w.people.filter(p => p.hp > 0 && p.age > 30).slice(0, 6)) p.coins = 500;
  f.treasury = 0;
  const before = sum();
  w.borrow(0, true);
  const debt = w.debtOf(0);
  console.log("  borrowed " + debt.toFixed(0) + " coins; treasury " + f.treasury.toFixed(0));
  assert.ok(debt > 5 && Math.abs(f.treasury - debt) < 1e-6, "lent by the rich into the treasury");
  assert.ok(Math.abs(sum() - before) < 1e-6, "no coin made");
  f.treasury = 0;
  for (let d = 0; d < 70 && !w.stats().defaults; d++) { f.treasury = 0; w.borrow(0, false); }
  assert.equal(w.stats().defaults, 1, "unable to pay its interest, it defaults");
  assert.equal(w.debtOf(0), 0, "and the lenders lose it");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder prisoners, mutiny and war loans: off is the world before; ransom; exchange or killing; mutiny; loans and default");
