// War by what a people knows, and blasts (TODO 15.6, 2026-11-23). Ric: "the technology and era need to
// be coorilated and technology and weaponry should be coorilated"; "what about bombs?", "Yes, add them".
//
// What is held:
//   1. a default world is the world it was, and "By era label" is the world before in any era;
//   2. each era's starting kit is what it had; with "By era label" no war know-how exists at all;
//   3. an early people taught gunpowder fights with muskets and no bows; cannon break walls in days;
//   4. armour is dropped for helmets against rifles; a wall's worth is the wall's and the guns', and a
//      low, thick wall stands cannon;
//   5. how an army is raised comes from government and treasury, not the era;
//   6. a blast hurts everybody near it, soldier or not, and burns houses; what is left in the ground goes
//      off under somebody, or is cleared by a people that knows explosives.
//
// node projects/world-builder/test/warknow.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { formations: "nearest", raids: "old" };   // the parts built after this one, off
const FINGERPRINT = 1505646459;   // print() of the world before, seed 2, 60 days

{
  const w = People.create({ ...LATER, seed: 2, warBooks: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "a default world (early farmers, eras standing) is the world it was");
}
{
  // The era label, in an era that is not the default: as before (the old engine's own answer, kept).
  const a = People.create({ ...LATER, seed: 3, era: "medieval", warBy: "era", warBooks: "old", people: 200 });
  assert.equal(a.WAR_TECH.length, 0, "by era label there is no war know-how");
  assert.equal(a.kitOf(0), null, "and no kit");
}

// 2. Starting kits.
const kit = (era, extra = {}) => { const w = People.create({ ...LATER, seed: 5, era, people: 200, ...extra }); w.step(24); w.knowDay(); return { w, k: w.kitOf(0) }; };
{
  const e = kit("early").k, b = kit("bronze").k, m = kit("medieval").k, x = kit("modern").k;
  assert.equal(e.arms.name, "hand weapons"); assert.equal(e.bow, "bow"); assert.equal(e.archers, 0.3); assert.equal(e.armour.name, "padded coats");
  assert.equal(e.engineDays, 40); assert.equal(e.standing, 0.04); assert.equal(e.campaign, 0.2); assert.equal(e.season, true);
  assert.equal(b.arms.name, "bronze weapons"); assert.equal(b.bow, "composite"); assert.ok(b.chariot, "Bronze Age chariots");
  assert.equal(m.arms.name, "steel blades"); assert.equal(m.bow, "crossbow"); assert.equal(m.armour.name, "plate"); assert.ok(m.stirrup && !m.chariot);
  assert.equal(x.arms.name, "machine guns"); assert.ok(x.tanks && x.aircraft && x.cannon && x.shells && !x.season);
  console.log("  kits: early " + e.arms.name + ", bronze " + b.arms.name + "/" + b.bow + ", medieval " + m.arms.name + "/" + m.armour.name + ", modern " + x.arms.name);
}

// 3. An early people that learns gunpowder, a medieval one that learns cannon.
{
  const { w } = kit("early");
  for (const p of w.people) if (p.f === 0) { w.teach(p, "gunpowder"); w.teach(p, "iron"); }
  w.step(24); w.knowDay();
  const k = w.kitOf(0);
  assert.equal(k.arms.name, "muskets", "gunpowder arms an early people with muskets");
  assert.equal(k.bow, null, "and puts the bows away");
  const { w: m } = kit("medieval");
  for (const p of m.people) if (p.f === 0) m.teach(p, "cannon");
  m.step(24); m.knowDay();
  assert.equal(m.kitOf(0).engineDays, 8, "cannon break a wall in days, whatever the era");
}

// 4. Armour against rifles, and walls against guns.
{
  const { w } = kit("medieval", { factions: 2 });
  for (const p of w.people) if (p.f === 1) { w.teach(p, "rifling"); w.teach(p, "gunpowder"); }
  w.startWar(0, 1);
  w.step(24); w.knowDay(); w.kitOf(1);
  w.step(24);
  assert.equal(w.kitOf(0).armour.name, "steel helmets", "against rifles, plate gives way to helmets");
  const v = w.villages.find(u => u.alive && u.f === 0);
  v.wall = 1; v.wallBase = 1.4; v.fort = 0;
  assert.equal(w.wallWorth(v.id, 0), 1.4, "a high wall, against nobody");
  for (const p of w.people) if (p.f === 1) w.teach(p, "cannon");
  w.step(24); w.knowDay(); w.step(24);
  const high = w.wallWorth(v.id, 1); v.fort = 1; const low = w.wallWorth(v.id, 1);
  assert.ok(Math.abs(high - 1.4 * 0.57) < 1e-9, "cannon take most of a high wall's worth");
  assert.ok(low === 1.4, "a low, thick wall stands them");
}

// 5. How an army is raised.
{
  const { w } = kit("early");
  assert.equal(w.kitOf(0).service, "levy", "no writing: a levy");
  const { w: a } = kit("ancient");
  const f = a.factions[0];
  f.land = "leader"; a.step(24);
  assert.equal(a.kitOf(0).service, "feudal", "writing, and the land the leader's: owed service");
  f.land = "village"; f.treasury = 1e5; a.step(24);
  assert.equal(a.kitOf(0).service, "paid", "writing, and a treasury that can pay: paid");
}

// 6. Blasts, and what they leave.
{
  const w = People.create({ ...LATER, seed: 8, people: 300 });
  w.step(30);
  const v = w.villages.find(u => u.alive && u.pop > 20);
  const near = w.people.filter(q => q.hp > 0 && Math.hypot(q.x - v.x, q.y - v.y) < 0.3);
  const built = w.homes.filter(h => h.v === v.id && h.built).length;
  const s0 = w.stats();
  w.blast(v.x, v.y, 0.3, 3, -1, "shell");
  const s1 = w.stats();
  assert.ok(near.length && near.every(q => q.hp < 1), "everybody within it is hurt");
  assert.ok(s1.blastDead > s0.blastDead && s1.blastCivilians > 0, "and some killed, counted as civilians");
  assert.ok(w.homes.filter(h => h.v === v.id && h.built).length < built, "houses under it burn");
  const p = w.people.find(q => q.hp > 0 && q.job !== "soldier");
  w.leave(p.x, p.y, 0.05, 3, "shell", 1);
  for (let i = 0; i < 400 && w.left().length; i++) w.leftDay();
  assert.equal(w.left().length, 0, "a shell in the ground goes off under somebody");
  assert.ok(w.stats().leftWentOff >= 1);
  const { w: m } = kit("modern");
  const o = m.villages.find(u => u.alive && u.f === 0);
  m.leave(o.x + o.radius * 0.6, o.y + o.radius * 0.6, 0.02, 1, "mine", 1);
  for (let i = 0; i < 6000 && m.left().length; i++) m.leftDay();
  assert.equal(m.left().length, 0, "and a people that knows explosives clears it in time");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder war by what a people knows: default unchanged; kits from know-how; guns, helmets, forts and service follow it; blasts hit all near, burn houses and leave what goes off later");
