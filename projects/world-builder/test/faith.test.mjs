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
const LATER = { marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 1260742038;   // print() of 15c's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old", pursuit: "old", soldierPay: "kept", tills: "old", poor: "old", column: "old", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false, folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old", lakes: "few", crossing: "big" });
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
  /* Twenty holders across a world, so the numbers are big enough to tell apart; and four more worlds beside
     this one, pooled, since 2026-11-24 (15.12a's dice): one world's dozen converts gave 2.7 times where the
     README's world gave 4. */
  const along = (w, fa) => {
    const seeds = w.people.filter(p => w.adult(p) && p.hp > 0 && p.faith == null).filter((p, i) => i % 15 === 0).slice(0, 20);
    for (const p of seeds) { w.convert(p, fa.id); p.zeal = 1; }
    const ids = [fa.founder, ...seeds.map(p => p.id)];
    w.byId.get(fa.founder).zeal = 1;
    const others = w.people.filter(p => w.adult(p) && p.hp > 0 && p.faith == null);
    const trusted = new Set(others.filter(p => ids.some(id => w.feel(p, id) > 0.25)).map(p => p.id));
    w.step(24 * 60);
    const r = { took: 0, all: others.length, inT: 0, nT: 0, inR: 0, nR: 0 };
    for (const p of others) { const got = p.faith === fa.id ? 1 : 0; r.took += got; if (trusted.has(p.id)) { r.nT++; r.inT += got; } else { r.nR++; r.inR += got; } }
    return r;
  };
  const runs = [along(w, w.faiths[0])];
  /* Eleven worlds beside this one since 2026-11-27: on TODO 23 and 24's land the five gave 2.1 times, from 15
     converts among those who trusted nobody; seeds 4 to 15 gave 3.8 (the old land 3.2 over the same twelve). */
  for (const seed of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    const x = People.create({ ...LATER, seed, people: 400, war: false, bandits: false, riots: false });
    x.step(24 * 30);   // friendships first: a world's first day has none
    const maker = x.people.find(p => x.adult(p) && p.hp > 0);
    runs.push(along(x, x.makeFaith(maker, "famine")));
  }
  const sum = k => runs.reduce((a, r) => a + r[k], 0);
  const rT = sum("inT") / Math.max(1, sum("nT")), rR = sum("inR") / Math.max(1, sum("nR"));
  console.log("  taken up in 60 days, " + runs.length + " worlds: " + sum("took") + " of " + sum("all") + "; " + (rT * 100).toFixed(0) + "% of " + sum("nT") + " who trusted a holder, " + (rR * 100).toFixed(1) + "% of the rest (" + (rT / rR).toFixed(1) + " times)");
  assert.ok(runs[0].took > 0, "it is taken up");
  /* Twice, since 2026-11-27: over these twelve worlds the old land gave 3.2 times and the new 3.0 to 3.8 from
     one engine fix to the next, on 15 to 21 converts among the rest; a line at three was a coin toss. */
  assert.ok(rT > rR * 2, "far more by those who trusted a holder");
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
