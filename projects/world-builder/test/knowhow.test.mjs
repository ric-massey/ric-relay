// Know-how (TODO.md 15e, 2026-11-22). Ric: "Propose an idea please"; finds "Rare (make it a slide
// tho)"; "If writing is that important put it in".
//
// What is held:
//   1. with "How often new things are found" at never, the world is the one 15b left, step for step;
//   2. somebody at work finds something new, with nothing scripted, when finds are often;
//   3. what one holds passes to others who see it done;
//   4. a people whose last boat-builder dies has lost boats, and no longer builds one;
//   5. a lost thing that was written down is read again by somebody who can read.
//
// node projects/world-builder/test/knowhow.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 4263759778;   // print() of 15b's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "never is the world before 15e");
}

// 2. Found at work.
{
  const w = People.create({ ...LATER, seed: 3, people: 400, finds: 1, war: false });
  w.step(24 * 90);
  const st = w.stats();
  const ev = w.events.filter(e => e.kind === "found");
  console.log("  " + st.finds + " found in 90 days at the top of the slider" + (ev.length ? ": " + ev[0].text : ""));
  assert.ok(st.finds > 0, "somebody at work finds something new");
}

// 3 and 4 and 5.
{
  const w = People.create({ ...LATER, seed: 5, people: 300, finds: 0.2, war: false, factions: 2 });
  w.step(24 * 2);
  w.knowDay();
  /* 3. Seen done. */
  const one = w.people.find(p => w.adult(p) && p.hp > 0);
  w.teach(one, "herbs");
  w.step(24 * 60);
  const holders = w.people.filter(p => p.hp > 0 && p.know != null && (p.know & (1 << w.TECH.indexOf("herbs"))));
  const factions = new Set(holders.map(p => p.f));
  console.log("  healing herbs, taught to one: " + holders.length + " hold it after sixty days, in " + factions.size + " of the peoples");
  assert.ok(holders.length > 1, "it passes to others who see it done");
  /* 4. Lost. */
  const f = w.factions[0], bit = 1 << w.TECH.indexOf("boats");
  for (const p of w.people) if (p.f === f.id && p.know != null) p.know &= ~bit;
  w.knowDay();
  assert.equal(w.knows(f.id, "boats"), false, "nobody left knows boats");
  assert.ok(w.events.some(e => e.kind === "lost" && e.text.includes("building boats")), "and it is news");
  /* 5. Read again. */
  const g = w.factions[1], wbit = 1 << w.TECH.indexOf("writing");
  const readers = w.people.filter(p => p.f === g.id && w.adult(p) && p.hp > 0).slice(0, 6);
  for (const p of readers) p.know |= wbit;
  w.knowDay();   // a people that writes writes down what it knows
  for (const p of w.people) if (p.f === g.id && p.know != null) p.know &= ~bit;
  let days = 0;
  while (!w.knows(g.id, "boats") && days < 400) { w.knowDay(); days++; }
  assert.ok(w.knows(g.id, "boats"), "a people that wrote it down reads it again (" + days + " days)");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder know-how: never is the world before; found at work; passed on by being seen; lost with the last who knew; read again where written");
