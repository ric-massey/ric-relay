// Faith (TODO.md 15g, 2026-11-22). Ric: "How do we make it so they can come up with their own
// faiths?"; "Yes it can drive harsh things."
//
// What is held:
//   1. with Faith off the world is the one 15c left, step for step;
//   2. a faith nobody wrote appears after a hard event, made by somebody who was there, and what it
//      holds comes from its maker's nature (a hot, bold, cold maker's calls for sacrifice);
//   3. it spreads along trust, not at random: those who trusted a holder take it up far more often;
//   4. a people with one does different things: its holders keep holy days, and a ruler who holds it
//      makes it the people's own.
//
// node projects/world-builder/test/faith.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 620498115;   // print() of 15c's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15g");
}

const w = People.create({ ...LATER, seed: 3, people: 400, war: false, bandits: false, riots: false });
w.step(24 * 3);

// 2. Made after a hard event.
{
  const v = w.villages.filter(x => x.alive).sort((a, b) => b.pop - a.pop)[0];
  for (let i = 0; i < 200 && !w.faiths.length; i++) w.hardTimes(v.id, "famine", 1.5);
  assert.ok(w.faiths.length >= 1, "a hard event, often enough, makes a faith");
  const fa = w.faiths[0], maker = w.byId.get(fa.founder);
  assert.equal(maker.home, v.id, "made by somebody who was there");
  assert.equal(maker.faith, fa.id, "who holds it");
  const hot = w.people.find(p => w.adult(p) && p.hp > 0 && p.faith == null);
  Object.assign(hot, { temper: 1, bold: 1, warm: 0, stub: 1, patient: 0.2, honest: 0.2 });
  const hard = w.makeFaith(hot, "lost");
  assert.equal(hard.rite, "sacrifice", "a hot, bold, cold maker's faith calls for sacrifice");
  assert.ok(hard.holyWar, "and for war on those who do not hold it");
  const kind = w.people.find(p => w.adult(p) && p.hp > 0 && p.faith == null);
  Object.assign(kind, { temper: 0.1, bold: 0.3, warm: 0.9, stub: 0.3, patient: 0.5, honest: 0.8, greed: 0.2 });
  const soft = w.makeFaith(kind, "sick");
  assert.equal(soft.rite, "feast", "a warm maker's keeps a feast");
  assert.equal(soft.rule, "theft", "an honest maker's forbids stealing");
}

// 3. Along trust.
{
  /* Twenty holders across the world, so the numbers are big enough to tell apart. */
  const fa = w.faiths[0];
  const seeds = w.people.filter(p => w.adult(p) && p.hp > 0 && p.faith == null).filter((p, i) => i % 15 === 0).slice(0, 20);
  for (const p of seeds) { w.convert(p, fa.id); p.zeal = 1; }
  const ids = [fa.founder, ...seeds.map(p => p.id)];
  w.byId.get(fa.founder).zeal = 1;
  const others = w.people.filter(p => w.adult(p) && p.hp > 0 && p.faith == null);
  const trusted = new Set(others.filter(p => ids.some(id => w.feel(p, id) > 0.25)).map(p => p.id));
  w.step(24 * 60);
  const took = others.filter(p => p.faith === fa.id);
  const rate = (inSet) => { const pool = others.filter(p => trusted.has(p.id) === inSet); return pool.length ? pool.filter(p => p.faith === fa.id).length / pool.length : 0; };
  console.log("  taken up in 60 days: " + took.length + " of " + others.length + "; " + (rate(true) * 100).toFixed(0) + "% of " + trusted.size + " who trusted a holder, " + (rate(false) * 100).toFixed(1) + "% of the rest");
  assert.ok(took.length > 0, "it is taken up");
  assert.ok(rate(true) > rate(false) * 3, "far more by those who trusted a holder");
}

// 4. What it changes.
{
  const fa = w.faiths[0];
  fa.every = 7;
  const holders = w.people.filter(p => p.faith === fa.id && p.hp > 0);
  for (const p of holders) p.zeal = 1;
  const before = w.stats().holyDays;
  w.step(24 * 8);
  assert.ok(w.stats().holyDays > before, "its holders keep a holy day (" + (w.stats().holyDays - before) + " gatherings in eight days)");
  const f = w.factions[w.byId.get(fa.founder).f], lead = w.byId.get(f.leader);
  while (fa.holders < 12) { const q = w.people.find(p => w.adult(p) && p.hp > 0 && p.faith == null); w.convert(q, fa.id); }
  w.convert(lead, fa.id); lead.zeal = 1;
  w.faithDay();
  assert.equal(f.faith, fa.id, "a ruler who holds it makes it the people's own");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder faith: off is the world before; made after a hard event from its maker's nature; passed along trust; holy days and a people's own faith");
