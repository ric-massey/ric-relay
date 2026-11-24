// Each one's own dice (TODO 15.12a, 2026-11-24). Ric: "Feeding Sethaeeis should affect another person through
// something the simulation models — an encounter, shipment, price change, or political decision."
//
// What is held:
//   1. a world is still the seed's: the same settings give the same world;
//   2. feed one person, and people far off — another people's village, who never met them, traded with them
//      or shared a store with them — do exactly the same things for a day;
//   3. while the fed one's own village does change (the change is real, and it does reach those who share
//      their store and their talk).
//
// node projects/world-builder/test/dice.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OPT = { seed: 7, people: 240, factions: 2, map: 60, war: false, bandits: false };
const state = p => [p.x, p.y, p.food, p.coins, p.task, p.job, p.rest, p.mood].map(x => typeof x === "number" ? Math.round(x * 1e6) : x).join(",");

const a = People.create(OPT), b = People.create(OPT);
a.step(24); b.step(24);
assert.equal(a.people.map(state).join(";"), b.people.map(state).join(";"), "the same settings, the same world");

const who = b.people.find(p => p.f === 0 && b.adult(p));
const home = b.villages[who.home];
const far = b.villages.filter(v => v.alive && v.f !== who.f && Math.hypot(v.x - home.x, v.y - home.y) > 30);
assert.ok(far.length > 0, "a village of another people, far off");
who.food += 20;   // the watcher feeds one person
a.step(24); b.step(24);
const there = new Set(far.map(v => v.id));
const strangers = b.people.filter(p => there.has(p.home)), same = strangers.filter(p => state(p) === state(a.byId.get(p.id)));
assert.ok(strangers.length > 20, "enough strangers to look at (" + strangers.length + ")");
assert.equal(same.length, strangers.length, "nobody far off does anything different for being fed nothing (" + same.length + " of " + strangers.length + ")");
const near = b.people.filter(p => p.home === who.home && p !== who), moved = near.filter(p => a.byId.get(p.id) && state(p) !== state(a.byId.get(p.id)));
assert.ok(state(who) !== state(a.byId.get(who.id)), "the fed one's day is different");
console.log("world-builder own dice: the same seed, the same world; feeding one person left all " + strangers.length + " far off as they were (" + moved.length + " of " + near.length + " at home changed)");
