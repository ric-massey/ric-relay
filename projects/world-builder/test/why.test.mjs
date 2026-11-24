// Why things happen (2026-11-23). Ric: "is there an easy log we can add that helps with some of it and doesnt
// slow it down?" Each decision the log records — a war, a peace, a plan, a coup, a breakaway, a famine, a wall, a
// road, a law — carries the numbers it was made on, read where it was made.
//
// What is held:
//   1. the world is the same world, exactly (fingerprinted before the reasons were added): they only report;
//   2. every war begun carries its reason, and so do most of the year's decisions;
//   3. no reason has a number missing (NaN, undefined, Infinity) in it.
//
// node projects/world-builder/test/why.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const OLD = 466254238;   // the world below before the reasons

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
const w = People.create({ seed: 4, people: 300, era: "medieval", neighbours: "enemies", favour: false, prophets: false, witches: false, faithKids: false, faithTrade: false }); w.step(24 * 365);   // 15.11i to m, built after, off
assert.equal(print(w), OLD, "the same world, exactly: a reason only reports");
const wars = w.events.filter(e => e.kind === "war" && / has gone to war with /.test(e.text));
assert.ok(wars.length > 0, "there were wars");
for (const e of wars) assert.ok(e.why, "a war begun says why: " + e.text);
const said = w.events.filter(e => e.why);
assert.ok(said.length >= 20, "a year's decisions carry reasons (" + said.length + " of " + w.events.length + ")");
for (const e of said) assert.ok(!/NaN|undefined|Infinity/.test(e.why), "no number missing: " + e.why);
console.log("world-builder why things happen: the same world; wars and " + said.length + " of " + w.events.length + " events say why; no number missing");
