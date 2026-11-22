// Each people's ways (TODO.md item 15a, 2026-11-20). Ric: "I like nature sliders" ("Faction tabs");
// customs "decided through the stats" of the people with the most say; and what happens changes
// people "if their young enough or the thing that happened was a big enough deal".
//
// What is held:
//   1. a world nobody changes starts as it did before 15a, person for person (a fingerprint kept
//      from the engine before 15a), and the link's "own" setting is cleaned to what it can mean;
//   2. a faction given its own nature starts with it, and every other faction exactly as without;
//   3. two factions whose chiefs differ in their stats choose different customs (who holds the land);
//      an elected leader's decisions lean to the people's own average, a chief's are the chief's;
//   4. an event moves a child more than a grown-up and a grown-up more than the old, nobody under
//      six, and a bigger one (a parent lost) more than a smaller one;
//   5. a raided village's children are changed more than its old.
//
// node projects/world-builder/test/ways.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Engine = createRequire(import.meta.url)("../people.js");
/* Item 15's parts off: this test holds its own part as it was built (TODO 15, 2026-11-22). */
const People = Object.assign({}, Engine, { create: s => Engine.create(Object.assign({ govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false }, s)) });
const K = ["bold", "warm", "greed", "stub", "loyal", "patient", "temper", "hard", "curious", "honest"];

// 1. As before, and the setting cleaned.
{
  const print = w => { let h = 0; for (const p of w.people) { h = (h * 31 + p.id + p.f * 7 + p.home * 13) % 2147483647; for (const k of K) h = (h * 31 + Math.round(p[k] * 1e6)) % 2147483647; } return h; };
  /* 2111185208 before TODO 15.5a. That item changed who takes which trade at the start (253 of 400
     here: the bench pays only for what is ordered), and through it two people's loyalty by under
     0.001; their natures, factions and homes are as before 15a. */
  assert.equal(print(People.create({ seed: 11 })), 1182167126, "the default world starts as before 15a, but for 15.5a's trades");
  assert.equal(print(People.create({ seed: 4, factions: 8, people: 900, map: 25 })), 1248157309, "eight factions start as before 15a");
  assert.equal(People.clean({ own: " 2.temper=0.9,1.bold=0.13,9.bold=1,3.foo=1,2.warm=x,1.bold=0.2" }).own, "1.bold=0.2,2.temper=0.9", "the link's own nature is cleaned");
  assert.equal(People.clean({ factions: 2, own: "1.bold=0.2,3.warm=0.9" }).own, "1.bold=0.2", "no own nature for a faction that is not there");
  assert.equal(People.DEFAULTS.own, "", "nobody has their own by default");
}

// 2. One faction's own nature.
{
  const plain = People.create({ seed: 3 }), own = People.create({ seed: 3, own: "2.temper=0.9,2.patient=0.1" });
  const mean = (w, f, k) => { const ps = w.people.filter(p => p.f === f); return ps.reduce((a, p) => a + p[k], 0) / ps.length; };
  assert.ok(mean(own, 1, "temper") > mean(plain, 1, "temper") + 0.3, "faction 2 is hot-tempered: " + mean(plain, 1, "temper").toFixed(2) + " → " + mean(own, 1, "temper").toFixed(2));
  assert.ok(mean(own, 1, "patient") < mean(plain, 1, "patient") - 0.25, "faction 2 is impatient: " + mean(plain, 1, "patient").toFixed(2) + " → " + mean(own, 1, "patient").toFixed(2));
  assert.equal(plain.people.length, own.people.length);
  for (let i = 0; i < plain.people.length; i++) {
    const a = plain.people[i], b = own.people[i];
    if (a.f === 1) continue;
    for (const k of K) assert.equal(a[k], b[k], "everybody of the other factions is as they were: " + a.name + " " + k);
  }
}

// 3. Customs from the stats of whoever has the say.
{
  /* Chiefs: a grasping people's chief keeps the land for themselves; a content one's leaves it to
     families or the village. Over several seeds, since one chief may be anybody. */
  let grasping = 0, content = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const w = People.create({ seed, rule: "chief", factions: 2, divided: 0, own: "1.greedy=1,2.greedy=0" });   // nobody set on sharing, which would decide it first
    if (w.factions[0].land === "leader") grasping++;
    if (w.factions[1].land === "leader") content++;
  }
  assert.ok(grasping >= 5 && content === 0, "a grasping people's chief holds the land: " + grasping + " of 6 against " + content);

  /* Elected: half the leader, half the people's average. */
  const w = People.create({ seed: 5, rule: "elected", factions: 2, own: "1.temper=0.95,2.temper=0.05" });
  w.step(6);
  for (const f of w.factions) {
    const lead = w.byId.get(f.leader), ad = w.people.filter(p => p.f === f.id && w.adult(p));
    const avg = ad.reduce((a, p) => a + p.temper, 0) / ad.length;
    assert.ok(Math.abs(w.ruling(lead, "temper", f) - (lead.temper + avg) / 2) < 0.02, "an elected leader leans to their people");
  }
  const hot = w.ruling(w.byId.get(w.factions[0].leader), "temper", w.factions[0]), cool = w.ruling(w.byId.get(w.factions[1].leader), "temper", w.factions[1]);
  assert.ok(hot > 0.7 && cool < 0.3, "a hot-tempered people's elected leader acts hot-tempered: " + hot.toFixed(2) + " against " + cool.toFixed(2));
  const c = People.create({ seed: 5, rule: "chief" }), cl = c.byId.get(c.factions[0].leader);
  assert.equal(c.ruling(cl, "temper", c.factions[0]), cl.temper, "a chief's decisions are the chief's own");
}

// 4. By age and by size.
{
  const w = People.create({ seed: 11 });
  const moved = (age, size) => { const p = w.people[0], was = p.temper, wasAge = p.age, wasFade = p.fade; p.age = age; p.temper = 0.5; p.fade = null; w.shaken(p, w.LIFE.raid, size); const d = p.temper - 0.5; p.temper = was; p.age = wasAge; p.fade = wasFade; return d; };
  const a3 = moved(3), a12 = moved(12), a30 = moved(30), a60 = moved(60);
  assert.equal(a3, 0, "a raid leaves no mark on a three-year-old");
  assert.ok(Math.abs(a30 - 0.04) < 1e-9, "a thirty-year-old is moved as everybody was before 15a: " + a30);
  assert.ok(a12 > a30 * 1.5 && a30 > a60 * 1.3, "the young move most, the old least: 12 " + a12.toFixed(3) + ", 30 " + a30.toFixed(3) + ", 60 " + a60.toFixed(3));
  assert.ok(a12 / a60 > 2.2 && moved(6) / a60 > 2.6, "a child more than twice the old, most at six: " + (a12 / a60).toFixed(2));
  assert.ok(Math.abs(moved(30, 2) - 2 * a30) < 1e-9, "twice the event, twice the change");
}

// 5. A raid: the same world twice; in one, enemies struck a village on its second day.
{
  const a = People.create({ seed: 11, ages: 0.75 }), b = People.create({ seed: 11, ages: 0.75 });
  a.step(48); b.step(48);
  const v = a.villages.find(x => x.alive && x.pop > 30);
  const here = a.people.filter(p => p.home === v.id).map(p => p.id);
  a.villages[v.id].raidAt = 0;
  a.step(24 * 3); b.step(24 * 3);
  const d = (lo, hi) => {
    const ids = here.filter(id => { const p = a.byId.get(id), q = b.byId.get(id); return p && q && p.hp > 0 && q.hp > 0 && p.age >= lo && p.age < hi; });
    return { n: ids.length, d: ids.reduce((s, id) => s + a.byId.get(id).temper - b.byId.get(id).temper, 0) / Math.max(1, ids.length) };
  };
  const young = d(6, 18), old = d(40, 200);
  assert.ok(young.n >= 5 && old.n >= 3, "both ages are there: " + young.n + " young, " + old.n + " old");
  assert.ok(young.d > old.d * 1.8, "raided, the young are changed more than the old: " + young.d.toFixed(3) + " against " + old.d.toFixed(3));
}

console.log("world-builder ways: an untouched world as before, a faction's own nature, customs from the stats of who has the say, events by age and size");
