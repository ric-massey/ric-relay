// Sleep that follows the way people live (TODO.md 15.5s, 2026-11-22). Ric (2026-11-20): "For the sleeps
// how close to the equator changes the nights which changes the sleep. So I think it should all be in
// there"; the waking hour does something.
//
// What is held:
//   1. with "Sleep" at "simple" the world is the one 15.5q left, step for step;
//   2. a night's need is six and a half hours, an hour more on the longest nights;
//   3. near the equator sleep stays in one piece; far north in winter people wake in the middle;
//   4. grown-ups go to bed some hours after dark, not at dark.
//
// node projects/world-builder/test/sleep.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 983894563;   // print() of 15.5q's engine, seed 2, 60 days

// 1. Simple: the world before.
{
  const w = People.create({ seed: 2, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"From dark to dawn\" is the world before 15.5s");
}

// 2 and 3. The night's length.
{
  const eq = People.create({ seed: 3, latitude: 2, people: 200, start: "winter" });
  const north = People.create({ seed: 3, latitude: 62, people: 200, start: "winter" });
  const p = eq.people.find(q => eq.adult(q)), q = north.people.find(x => north.adult(x));
  assert.ok(Math.abs(eq.need(p) - 6.5) < 0.05, "six and a half hours near the equator (" + eq.need(p).toFixed(2) + ")");
  assert.ok(north.need(q) > 7.3, "an hour more on a northern winter night (" + north.need(q).toFixed(2) + ")");
  eq.step(24 * 30); north.step(24 * 30);
  assert.equal(eq.stats().wakings, 0, "near the equator, one sleep");
  assert.ok(north.stats().wakings > 200 * 0.5 * 20, "far north in winter, two (" + north.stats().wakings + " wakings in a month)");
  /* and awake in the night, they are at home */
  let up = 0, home = 0;
  for (let h = 0; h < 24 * 5; h++) { north.step(1); for (const x of north.people) if (x.task === "watch") { up++; if (Math.hypot(x.x - x.hx, x.y - x.hy) < 1) home++; } }
  assert.ok(up > 0 && home > up * 0.9, "up in the night at home (" + home + " of " + up + ")");
}

// 4. Bed some hours after dark.
{
  const w = People.create({ seed: 4, latitude: 45, people: 300, start: "autumn" });
  w.step(24 * 10);
  const asleepAt = after => {
    let n = 0, a = 0;
    for (let d = 0; d < 6; d++) {
      while ((w.tick % 24) !== 0) w.step(1);
      const s = People.seasonAt(Math.floor(w.tick / 24), w.settings), dusk = Math.ceil(13 + s.daylight / 2);
      w.step(dusk + after);
      for (const p of w.people) if (w.adult(p) && p.job !== "soldier") { n++; if (p.task === "sleep" || p.task === "watch") a++; }
    }
    return a / n;
  };
  const early = asleepAt(1), late = asleepAt(4);
  assert.ok(late > early + 0.2, "an hour after dusk most are still up; four hours after, most are in bed (" + early.toFixed(2) + ", " + late.toFixed(2) + ")");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder sleep: \"simple\" is the world before, need grows with the night, one sleep near the equator and two far north in winter, and bed some hours after dark");
