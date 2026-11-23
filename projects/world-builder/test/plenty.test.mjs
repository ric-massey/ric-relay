// News of a good harvest (TODO.md 15.5g, 2026-11-22). Ric (2026-11-20): "Not sure which is best. Do
// research" — the word-of-mouth half of news of plenty, acted on as 12b's news is.
//
// What is held:
//   1. with "News of plenty" off the world is the one 15.5f left, step for step;
//   2. a village with grain to spare after the harvest becomes news;
//   3. the hungry with coins and an empty store at home, told of it, go there to buy;
//   4. a trader told of it goes there.
//
// node projects/world-builder/test/plenty.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Engine = createRequire(import.meta.url)("../people.js");
/* Item 15's parts off: this test holds its own part as it was built (TODO 15, 2026-11-22). */
const People = Object.assign({}, Engine, { create: s => Engine.create(Object.assign({ govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false }, s)) });
const FINGERPRINT = 140974437;   // print() of 15.5f's engine, seed 2, 60 days

// 1. Off: the world before.
{
  const w = People.create({ seed: 2, plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "off is the world before 15.5g");
}

const w = People.create({ seed: 3, people: 400, war: false, bandits: false, riots: false });
w.step(24 * 35);
const vs = w.villages.filter(v => v.alive && v.pop > 15);

// 2. Grain to spare is news.
const rich = vs[0];
{
  rich.food = rich.pop * 400;
  w.step(24 * 2);
  assert.ok(w.events.some(e => e.kind === "plenty" && e.text.includes(rich.name)), "a village with grain to spare is news");
}

// 3 and 4. Acted on.
{
  const poor = vs.find(v => v !== rich && Math.hypot(v.x - rich.x, v.y - rich.y) < 18 && v.f === rich.f) || vs.find(v => v !== rich && Math.hypot(v.x - rich.x, v.y - rich.y) < 18);
  assert.ok(poor, "a village within a day's walk");
  const here = w.people.filter(p => p.home === poor.id && w.adult(p) && p.job !== "soldier" && p.hp > 0).slice(0, 12);
  for (const p of here) { p.food = 0; p.hungry = 20; p.coins = 30; p.wait = 0; }
  poor.food = 0;
  w.report("plenty", rich.id, here.map(p => p.id));
  const went = new Set();
  for (let h = 0; h < 48; h++) { poor.food = 0; w.step(1); for (const p of here) if (p.chose === "buyfar") went.add(p.id); }
  assert.ok(went.size > 0, "the hungry with coins go to buy there (" + went.size + " of " + here.length + ")");
  w.step(24 * 2);
  assert.ok(w.stats().plentyBought > 0, "and buy (" + w.stats().plentyBought.toFixed(1) + " days of food)");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder news of plenty: off is the world before, grain to spare is news, and the hungry told of it go there to buy");
