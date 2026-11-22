// Soldiers on campaign (TODO.md 15j, 2026-11-22). Ric: "in real like do soldiors choose duty over food
// and company? if so how do we change that?"
//
// What is held:
//   1. with "Come home to eat and sleep" the world is the one 15d left, step for step;
//   2. a soldier in a gathering army stays with it: duty or sleep where it lies, not the walk home;
//   3. desertion is far likelier for the hungry and unpaid than for the fed and paid.
//
// node projects/world-builder/test/campaign.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER = { caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old" };   // the parts built after this one, off: this part as it was built
const FINGERPRINT = 322919713;   // print() of 15d's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old" });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15j");
}

const make = () => {
  const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false });
  w.step(24 * 2);
  w.startWar(0, 1);
  w.warMap(); w.campaign(0, 1);
  return w;
};

// 2. With the army: held in its gathering (it does not march in the test), against the old way.
{
  const stay = campaign => {
    const w = People.create({ ...LATER, seed: 5, people: 500, factions: 2, villages: 4, war: true, aggression: 0, map: 20, bandits: false, campaign });
    w.step(24 * 2); w.startWar(0, 1); w.warMap(); w.campaign(0, 1);
    const f = w.factions[0], c = w.campOf(f)[1], m = w.villages[c.v];
    const mine = w.people.filter(p => p.f === f.id && p.job === "soldier" && p.hp > 0 && p.id % 3 !== 0 && Math.hypot(w.villages[p.home].x - m.x, w.villages[p.home].y - m.y) > 8);
    for (const p of mine) { w.place(p, m.x + 0.4, m.y + 0.4); p.food = 15; p.task = "idle"; p.wait = 0; p.alone = 50; }
    for (let h = 0; h < 48; h++) { c.ready = false; c.since = w.tick; for (const p of mine) p.hp = Math.max(p.hp, 0.9); w.step(1); }
    /* With the army: at the gathering place, or marching or fighting with it once it goes. */
    return [mine.filter(p => p.job === "soldier" && (Math.hypot(p.x - m.x, p.y - m.y) < 6 || p.task === "march" || p.task === "fight")).length, mine.length];
  };
  const [a, n] = stay("army"), [b, n2] = stay("home");
  console.log("  with the army after two days: " + a + " of " + n + " living with it, " + b + " of " + n2 + " the old way");
  assert.ok(n >= 3, "soldiers from other places in a gathering army");
  assert.ok(a >= n * 0.8 && a > b, "they stay with the army, sleeping and keeping company there");
}

// 3. Desertion.
{
  const run = hard => {
    const w = make(), f = w.factions[0];
    let left = 0;
    for (let d = 0; d < 200; d++) {
      for (const p of w.people) if (p.f === f.id && p.job === "soldier") { p.hungry = hard ? 6 : 0; p.unpaid = hard ? 8 : 0; p.loyal = 0.5; p.fear = 0.3; }
      const before = w.stats().deserted; w.desertions(f.id); left += w.stats().deserted - before;
    }
    return left;
  };
  const easy = run(false), hard = run(true);
  console.log("  deserted in 200 days: fed and paid " + easy + ", hungry and unpaid " + hard);
  assert.ok(hard > easy * 3 && hard > 5, "the hungry and unpaid desert far more");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder soldiers on campaign: off is the world before; they stay with the army; the hungry and unpaid desert");
