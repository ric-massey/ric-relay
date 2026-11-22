// Irrigation (TODO.md 15.5p, 2026-11-22). Ric (2026-11-20): yes — a ditch from a river is a thing a
// village builds with hours, that waters the fields along it so a dry year spares them as it spares
// river flats, and needs cleaning each year or silts up.
//
// What is held:
//   1. with "Irrigation" at "none" the world is the one 15.5o left, step for step;
//   2. a ditch dug waters the farmland along it, and in a dry year those fields lose far less;
//   3. a ditch not cleaned by the turn of the year silts up and waters nothing until it is cleaned;
//   4. in dry-prone river worlds, villages that have had a dry year dig ditches.
//
// node projects/world-builder/test/irrigation.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 1345748374;   // print() of 15.5o's engine, seed 2, 60 days

// 1. None: the world before.
{
  const w = People.create({ seed: 2, irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "\"None\" is the world before 15.5p");
}

const w = People.create({ seed: 3, weather: 1, rivers: 0.9, map: 30 });
w.step(2);

// 2. Dug, it waters; a dry year spares what it waters.
let v = null;
{
  for (const o of w.villages) { if (!o.alive) continue; w.ditchDug(o.id); if (o.ditch && o.ditch.tiles.length > 4) { v = o; break; } }
  assert.ok(v, "a village by a river digs a ditch");
  const tiles = v.ditch.tiles;
  assert.ok(tiles.every(i => w.watered[i] === 1), "it waters the farmland along it (" + tiles.length + " squares)");
  /* the driest of thirty years on those squares, with the ditch and without */
  let worstYear = -1, worst = 1e9;
  const wet = [], dry = [];
  for (let y = 0; y < 30; y++) { const r = w.rainOf(y); const m = tiles.reduce((a, i) => a + r[i], 0) / tiles.length; wet.push(m); }
  for (const i of tiles) w.watered[i] = 0;
  for (let y = 0; y < 30; y++) { const r = w.rainOf(y); const m = tiles.reduce((a, i) => a + r[i], 0) / tiles.length; dry.push(m); if (m < worst) { worst = m; worstYear = y; } }
  for (const i of tiles) w.watered[i] = 1;
  assert.ok(worst < 90, "a dry year comes in thirty (" + worst.toFixed(0) + "% of a crop)");
  assert.ok(wet[worstYear] > worst + (100 - worst) * 0.5, "the ditch spares most of what it would take (" + worst.toFixed(0) + "% to " + wet[worstYear].toFixed(0) + "%)");
}

// 3. Cleaned or silted.
{
  v.cleanWork = 0; w.ditchYear();
  assert.ok(v.ditch.silted && v.ditch.tiles.every(i => w.watered[i] === 0), "left uncleaned a year, it silts up");
  v.cleanWork = 400; w.ditchYear();
  assert.ok(!v.ditch.silted && v.ditch.tiles.every(i => w.watered[i] === 1), "cleaned, it waters again");
}

// 4. Dug where a dry year has been.
{
  const d = People.create({ seed: 3, weather: 0.8, rivers: 0.8 });
  d.step(24 * 730);
  assert.ok(d.stats().ditches > 0, "villages that have had a dry year dig ditches (" + d.stats().ditches + " in two years)");
}

function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder irrigation: \"none\" is the world before, a ditch spares its fields in a dry year, it silts up unless cleaned, and villages dig them after a dry year");
