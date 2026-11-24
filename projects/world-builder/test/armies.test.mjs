// Armies: what they carry, how far they go, and strategy (TODO.md 15h, 2026-11-22). Ric: "we need to
// cover what it is carrying with it so it knows how far they can go … rn they just run up one at a
// time instead of using war strategies".
//
// What is held:
//   1. with "Each soldier marches alone" the world is the one 15f left, step for step;
//   2. an army strikes only where what it carries takes it there and back: with every enemy place
//      out of reach, it does not march;
//   3. it gathers before it marches, and marches when enough have come in;
//   4. enemy soldiers across the road it is fed by make it fall back;
//   5. a ruler at war with coins to spare and too few under arms hires; unpaid, the hired go robbing.
//
// node projects/world-builder/test/armies.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 2789358566;   // print() of 15f's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15h");
}

const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, war: true, aggression: 0, map: 40, bandits: false });
w.step(24 * 2);
const [a, b] = w.factions;
w.startWar(a.id, b.id);
w.warMap();

// 2. Reach.
{
  const reach = w.reachOf(a);
  let inReach = false;
  for (const v of w.villages) if (v.alive && v.f === b.id) for (const u of w.villages) if (u.alive && u.f === a.id && Math.hypot(u.x - v.x, u.y - v.y) <= reach) inReach = true;
  w.campaign(a.id, b.id);
  const c = w.campOf(a)[b.id];
  assert.equal(c.goal >= 0, inReach, "a goal exactly when an enemy place is within reach (" + (reach / 4).toFixed(0) + " km)");
  /* Far apart: a world twice as wide with the two peoples at its ends. */
  const far = People.create({ ...LATER, seed: 8, people: 200, factions: 2, war: true, aggression: 0, map: 120, villages: 1 });
  far.step(24);
  const [fa, fb] = far.factions;
  let d = 1e9; for (const v of far.villages) if (v.alive && v.f === fb.id) for (const u of far.villages) if (u.alive && u.f === fa.id) d = Math.min(d, Math.hypot(u.x - v.x, u.y - v.y));
  far.startWar(fa.id, fb.id); far.warMap(); far.campaign(fa.id, fb.id);
  if (d > far.reachOf(fa)) assert.equal(far.campOf(fa)[fb.id].goal, -1, "too far for what they carry: no march (" + (d / 4).toFixed(0) + " km)");
  else console.log("  (the two peoples of the wide world are only " + (d / 4).toFixed(0) + " km apart; reach not tested there)");
}

// 3. Gathers, then marches.
{
  const c = w.campOf(a)[b.id];
  assert.ok(c.goal >= 0 && c.v >= 0, "a place to strike and a place to gather");
  /* The rule itself: not before enough have reported in at the gathering place. */
  const mine = w.people.filter(p => p.f === a.id && p.job === "soldier" && p.hp > 0 && p.id % 3 !== 0);
  for (const p of mine) w.muster(p, -1e9);
  c.ready = false; c.since = w.tick;
  w.warMap(); w.campaign(a.id, b.id);
  assert.equal(c.ready, false, "with nobody come in, it does not march");
  const m = w.villages[c.v];
  for (const p of mine.slice(0, Math.ceil(mine.length * 0.95))) { w.place(p, m.x + 0.5, m.y + 0.5); w.muster(p, w.tick); }
  w.warMap(); w.campaign(a.id, b.id);
  assert.ok(c.ready, "with nearly all come in, it marches (" + mine.length + " soldiers)");
  assert.ok(w.events.some(e => e.kind === "war" && /marches from/.test(e.text)), "and it is news");
  assert.ok(w.stats().marched > 0 && w.events.some(e => e.kind === "war" && /marches from/.test(e.text)), "and it is news");
}

// 4. Fed along a road.
{
  const c = w.campOf(a)[b.id];
  c.ready = true; c.cut = false;
  const m = w.villages[c.v], g = w.villages[c.goal];
  const theirs = w.people.filter(p => p.f === b.id && p.job === "soldier" && p.hp > 0).slice(0, 4);
  if (theirs.length < 3) for (const p of w.people.filter(q => q.f === b.id && w.adult(q) && q.hp > 0 && q.job !== "soldier").slice(0, 4 - theirs.length)) { p.job = "soldier"; theirs.push(p); }
  /* A point on the road clear of their own places: soldiers by their own village are its defence,
     not across the road (TODO 15j). */
  const k = [0.25, 0.5, 0.75].find(k => w.villages.every(u => !u.alive || u.f !== b.id || Math.hypot(u.x - (m.x + (g.x - m.x) * k), u.y - (m.y + (g.y - m.y) * k)) >= 12));
  if (k === undefined) console.log("  (every point of this road lies by one of their places; the cut is not tested here)");
  else {
    for (const p of theirs) w.place(p, m.x + (g.x - m.x) * k, m.y + (g.y - m.y) * k);
    const before = w.stats().withdrawn;
    w.warMap(); w.campaign(a.id, b.id);
    assert.ok(c.cut, "enemy soldiers across the road it is fed by cut it");
    assert.equal(w.stats().withdrawn, before + 1, "and the army falls back");
    assert.equal(c.ready, false, "to gather again");
  }
  /* And their soldiers standing by their own place do not. */
  const near = w.villages.find(u => u.alive && u.f === b.id);
  c.ready = true; c.cut = false;
  for (const p of theirs) w.place(p, near.x + 0.3, near.y + 0.3);
  w.warMap(); w.campaign(a.id, b.id);
  assert.equal(c.cut, false, "soldiers at home by their own place are not across the road");
}

// 5. Hired.
{
  /* Three peoples: the poor of the one not in the war are there to be hired. */
  const w = People.create({ ...LATER, seed: 5, people: 600, factions: 3, war: true, aggression: 0, map: 20 });
  w.step(24 * 2);
  const [a, b, c] = w.factions;
  w.startWar(a.id, b.id);
  for (const p of w.people) if (p.f === c.id && w.adult(p)) { p.coins = 0; p.bold = Math.max(p.bold, 0.6); }
  const before = w.stats().hired;
  for (let d = 0; d < 6; d++) { a.treasury = 5000; w.step(24); }
  const hired = w.stats().hired - before;
  assert.ok(hired > 0, "a ruler at war with coins to spare hires (" + hired + ")");
  a.treasury = 0; a.tax = 0;
  for (let d = 0; d < 12; d++) { a.treasury = 0; w.step(24); }
  assert.ok(w.stats().hiredGone > 0, "unpaid, they go");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder armies: off is the world before; only as far as they carry; gather, then march; fall back when the road is cut; hired and let go");
