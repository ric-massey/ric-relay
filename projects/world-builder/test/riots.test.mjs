// Food riots (TODO.md 15.5b3, 2026-11-21). Ric (2026-11-20): "Yes they should", after asking "is it
// really just a hot tempered thing?" — the research says no: the hungry riot together where food is
// in sight that is not theirs, and mostly pay what they think fair.
//
// What is held:
//   1. with riots off the world is the one 15.5t left, step for step (a fingerprint of it);
//   2. a town held hungry beside a full store riots: the crowd takes the grain and pays a fair price,
//      and no coin or food is made or lost; a warm, timid leader then feeds them;
//   3. a hot-tempered crowd pays nothing;
//   4. a bold leader with soldiers at hand breaks it up, and the crowd holds it against them;
//   5. hunger alone does not riot: with nothing in sight, nobody comes out; nor do the weak.
//
// node projects/world-builder/test/riots.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Engine = createRequire(import.meta.url)("../people.js");
/* Item 15's parts off: this test holds its own part as it was built (TODO 15, 2026-11-22). */
const People = Object.assign({}, Engine, { create: s => Engine.create(Object.assign({ govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old" }, s)) });
const FINGERPRINT = 3279161514;   // print() of 15.5t's engine, seed 2, 40 days

// 1. Off: the world 15.5t left (fingerprint taken from 15.5t's engine, seed 2, 40 days).
{
  const w = People.create({ seed: 2, riots: false, bandits: false, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old", ransom: "old", smallWar: "old", homeFront: false, feuds: false, builtRoads: false, waterWork: false, meeting: false, dispersion: false, warBooks: "old", warBy: "era", formations: "nearest", raids: "old", battle: "old", property: "old", passage: "old", taking: "old", mint: "fixed", tech: "old" });
  w.step(24 * 40);
  assert.equal(print(w), FINGERPRINT, "riots off is the world before them");
}

// Bandits off (15.5b4): the towns below were set up in the world before them, and a hungry, hot-tempered
// town's people take to the road as well as to the store.
const OPTS = { seed: 3, people: 400, map: 20, places: "city", start: "winter", materials: "goods", bandits: false };
/* A town set up to riot on its next day: its people hungry and nearly penniless, its store full.
   Held there by the hour until the day's turn has looked at it (`each` may change it further). */
function town(over, lead, each) {
  const w = People.create(Object.assign({}, OPTS, over));
  w.step(24 * 31 - 3);
  const v = w.villages.reduce((a, b) => (b.pop > a.pop ? b : a)), f = w.factions[v.f];
  const L = w.people.find(p => p.id === f.leader);
  if (lead) { f.rule = "chief"; Object.assign(L, lead); }
  f.treasury += 500;
  const here = () => w.people.filter(p => p.home === v.id);
  for (const p of here()) { p.food = 0; p.coins = Math.min(p.coins, 3); p.hp = 1; }
  v.food = 800;
  const before = { money: (w.stats().money - w.stats().minted), riots: w.stats().riots };
  for (let h = 0; h < 30 && w.stats().riots === before.riots; h++) {
    for (const p of here()) { p.food = Math.min(p.food, 0.2); p.hungry = Math.max(p.hungry, 1); }
    if (each) each(w, v, here());
    w.step(1);
  }
  return { w, v, f, L, before, s: w.stats(), here: here() };
}

// 2. A crowd at the store, paying; a warm leader who feeds them.
{
  const { w, v, before, s } = town({}, { warm: 1, greed: 0, bold: 0 });
  assert.equal(s.riots, before.riots + 1, "a hungry town beside a full store riots");
  assert.ok(s.riotGrain > 20, "and takes grain (" + Math.round(s.riotGrain) + " days' food)");
  assert.equal(s.riotsRough, 0, "an ordinary crowd is not a rough one");
  assert.equal(s.riotsFed, 1, "a warm leader sends grain");
  assert.ok(Math.abs((s.money - s.minted) - before.money) < 1e-6, "no coin made or lost (" + ((s.money - s.minted) - before.money) + ")");
  const e = w.events.filter(x => x.kind === "riot").pop();
  assert.match(e.text, /fair price/, e.text);
  assert.ok(v.riotAt > 0, "the village remembers it");
}

// 3. Hot-tempered: they take, and pay nothing.
{
  const { w, s, before } = town({ temper: 0.95 }, { warm: 0, greed: 1, bold: 0 });
  assert.equal(s.riots, before.riots + 1, "a hot-tempered town riots too");
  assert.equal(s.riotsRough, 1, "roughly");
  assert.match(w.events.filter(x => x.kind === "riot").pop().text, /taken what they wanted/);
}

// 4. A bold leader sends soldiers and breaks it up; the crowd holds it against them. (Soldiers standing
//    in the town keep a crowd at home, so here they are all elsewhere.)
{
  const { w, f, L, s, before, here } = town({}, { warm: 0, greed: 0.5, bold: 1 }, away);
  assert.equal(s.riots, before.riots + 1, "they riot even so");
  {
    // and the same town with no soldiers to hand: nobody breaks it up
    const none = town({}, { warm: 0, greed: 0.5, bold: 1 }, (w, v, ps) => { for (const p of w.people) if (p.job === "soldier") { p.job = "farmer"; p.task = "idle"; } });
    assert.equal(none.s.riots, none.before.riots + 1, "a faction with no soldiers riots too");
    assert.equal(none.s.riotsPut, 0, "and with no soldiers to send, nobody breaks it up");
  }
  assert.equal(s.riotsPut, 1, "and the soldiers break it up");
  const wronged = here.filter(p => p.wronged > 0);
  assert.ok(wronged.length >= 5, "the crowd holds it against the leader (" + wronged.length + ")");
  assert.ok(wronged.some(p => w.feel(p, L.id) < 0), "and against " + L.name + " by name");
  assert.match(w.events.filter(x => x.kind === "riot").pop().text, /broke it up/);
}

// 5. Nothing in sight, or too weak: nobody comes out.
{
  const empty = town({}, null, (w, v) => { v.food = 0; for (const p of w.people) if (p.home === v.id) p.food = Math.min(p.food, 0.2); });
  assert.equal(empty.s.riots, empty.before.riots, "hunger alone, with nothing to take, does not riot");
  const weak = town({}, null, (w, v, ps) => { for (const p of ps) p.hp = 0.4; });
  assert.equal(weak.s.riots, weak.before.riots, "nor do people too weak to stand");
}

/* None of the town's own under arms, and twenty raised in the faction's other villages instead. */
function away(w, v) {
  let n = w.people.filter(p => p.job === "soldier" && p.f === v.f && p.home !== v.id).length;
  for (const p of w.people) {
    if (p.job === "soldier" && p.home === v.id) { p.job = "farmer"; p.task = "idle"; }
    else if (n < 20 && p.f === v.f && p.home !== v.id && w.adult(p) && p.job !== "soldier" && Math.hypot(p.x - v.x, p.y - v.y) > 12) { p.job = "soldier"; p.task = "idle"; n++; }
  }
}
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder riots: off is the world before, a hungry town beside a full store riots and pays, a hot-tempered one pays nothing, a bold leader's soldiers break it up and are held against them, nothing in sight or too weak and nobody comes out");
