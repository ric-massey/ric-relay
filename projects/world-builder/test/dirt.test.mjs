// Dirt and disease in towns (TODO.md 15.5r, 2026-11-21). Ric (2026-11-20): "There shouldn't be a town
// fixed death rate it should all be of actual causes." A village's water is as foul as the waste of
// those who live round it reaches it: all of them where it drinks from a well among its houses, half
// where it drinks from a river or lake, and on a river the waste of every place within 10 km upstream.
//
// What is held:
//   1. with "Dirt in towns" at the fixed toll the world is the one 15.5b4 left, step for step;
//   2. a hamlet's water is nearly clean, a town's fouled and a city's very foul, and a well among the
//      houses fouler than a river;
//   3. a place on a river below a town drinks that town's waste, less the further down it is;
//   4. foul water kills: a town held at a city's foulness for a season loses people to it, and a world
//      of villages hardly anyone.
//
// node projects/world-builder/test/dirt.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const FINGERPRINT = 481523178;   // print() of 15.5b4's engine, seed 2, 60 days

// 1. The fixed toll: the world before.
{
  const w = People.create({ seed: 2, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false });
  w.step(24 * 60);
  assert.equal(print(w), FINGERPRINT, "the fixed toll is the world before 15.5r");
}

const w = People.create({ seed: 1, map: 40, people: 600, rivers: 0.9, villages: 12 });
w.step(2);
const vs = w.villages.filter(v => v.alive);
const river = i => w.ground[i] === 2;   // G_RIVER
/* The water a village drinks, as the engine finds it: a well, or the river or lake by its middle. */
const tileOf = (x, y) => Math.floor(y) * w.cols + Math.floor(x);

// 2. More people, fouler water; a well fouler than a river.
{
  const v = vs[0], keep = { pop: v.pop, well: v.well };
  v.well = { x: v.x, y: v.y };   // a well in its middle: its own waste, all of it
  const at = n => { v.pop = n; w.foulness(); return v.foul; };
  const hamlet = at(50), town = at(1000), city = at(5000);
  assert.ok(hamlet < 0.05, "a hamlet's water is nearly clean (" + hamlet.toFixed(3) + ")");
  assert.ok(town > 0.25 && town < 0.45, "a town's is fouled (" + town.toFixed(2) + ")");
  assert.ok(city > 0.65, "a city's very foul (" + city.toFixed(2) + ")");
  const onRiver = vs.find(u => !u.well && u !== v && nearestRiver(u) >= 0);
  if (onRiver) {
    const keep2 = onRiver.pop; onRiver.pop = 1000; w.foulness();
    const r = onRiver.foul; onRiver.pop = keep2;
    assert.ok(r < town, "drinking from a river or lake, half of it (" + r.toFixed(2) + " against " + town.toFixed(2) + ")");
  }
  v.pop = keep.pop; v.well = keep.well; w.foulness();
}

// 3. Below a town on the river.
{
  /* a river square with 8 km of river above it: a village set beside it drinks from it, and a town
     is set on the river 2 and then 8 km upstream */
  let at0 = -1, up = [];
  for (let i = 0; i < w.cols * w.rows && at0 < 0; i++) if (river(i)) { const c = upstream(i, 34); if (c.length >= 34) { at0 = i; up = c; } }
  assert.ok(at0 >= 0, "a river with 8 km of it upstream");
  const a = vs[0], keepA = { x: a.x, y: a.y, pop: a.pop, well: a.well };
  a.x = at0 % w.cols + 0.5; a.y = Math.floor(at0 / w.cols) + 0.5; a.well = null;

  const b = vs.find(v => v !== a), keep = { x: b.x, y: b.y, pop: b.pop, well: b.well };
  const at = k => { const i = up[k - 1]; b.x = i % w.cols + 0.5; b.y = Math.floor(i / w.cols) + 0.5; b.well = null; b.pop = 3000; w.foulness(); return a.foul; };
  a.pop = 100; b.pop = 0; w.foulness(); const alone = a.foul;
  const near = at(8), far = at(32);
  assert.ok(near > alone + 0.3, "a town 2 km upstream fouls its water (" + alone.toFixed(2) + " to " + near.toFixed(2) + ")");
  assert.ok(far < near && far > alone, "less from 8 km up (" + far.toFixed(2) + ")");
  Object.assign(b, keep); Object.assign(a, keepA); w.foulness();
}

// 4. Foul water kills.
{
  const t = People.create({ seed: 4, people: 1000, map: 20, places: "city", plague: "none" });
  t.step(24);
  const town = t.villages.reduce((a, b) => (b.pop > a.pop ? b : a));
  const before = t.stats().foul;
  /* the biggest place's water held at a big city's foulness (each day's reckoning undone) */
  for (let h = 0; h < 24 * 90; h++) { town.foul = 0.9; t.step(1); }
  const died = t.stats().foul - before;
  assert.ok(died >= 2, "people die of foul water (" + died + " in a season, of " + town.pop + ")");
  /* and in a world of hamlets, hardly anyone */
  const c = People.create({ seed: 4, plague: "none" }); c.step(24 * 90);
  assert.ok(c.stats().foul <= 3, "hardly anyone in a world of villages (" + c.stats().foul + ")");   // 1 before 15.5k's children; 2 after
}

function nearestRiver(v) {
  let best = -1, bd = 1e9;
  for (let y = Math.floor(v.y) - 3; y <= Math.floor(v.y) + 3; y++) for (let x = Math.floor(v.x) - 3; x <= Math.floor(v.x) + 3; x++) {
    if (x < 0 || y < 0 || x >= w.cols || y >= w.rows) continue;
    const i = y * w.cols + x, d = Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y);
    if (river(i) && d < bd) { bd = d; best = i; }
  }
  return best === tileOf(v.x, v.y) || bd < 1 ? best : -1;   // drinking from it: on it, or beside it
}
/* Squares upstream of river square i, nearest first: the one whose riverTo leads into it, again and again. */
function upstream(i, n) {
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], out = [];
  let cur = i;
  for (let k = 0; k < n; k++) {
    let found = -1;
    const x = cur % w.cols, y = Math.floor(cur / w.cols);
    for (let d = 0; d < 8 && found < 0; d++) {
      const nx = x - DX[d], ny = y - DY[d]; if (nx < 0 || ny < 0 || nx >= w.cols || ny >= w.rows) continue;
      const j = ny * w.cols + nx; if (river(j) && w.riverTo[j] === d) found = j;
    }
    if (found < 0) break;
    out.push(found); cur = found;
  }
  return out;
}
function print(w) {
  let h = 2166136261;
  const mix = x => { h = Math.imul(h ^ (Math.round(x * 1000) | 0), 16777619) >>> 0; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.loyal); mix(p.hp); }
  for (const v of w.villages) { mix(v.food); mix(v.till); mix(v.pop); }
  for (const f of w.factions) mix(f.treasury);
  return h;
}
console.log("world-builder dirt: the fixed toll is the world before, more people foul their water more and a well among the houses most, a town upstream fouls a river below it, and foul water kills");
