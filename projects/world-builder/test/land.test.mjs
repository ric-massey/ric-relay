// Land from the seed (TODO.md item 4a, 2026-11-15).
//
// What is held:
//   1. the same seed gives the same land, whatever the other settings (how many
//      people, villages, what year); a different seed gives a different land;
//   2. water runs downhill: from every square the way the water goes never climbs
//      (on the filled ground, where a hollow too shallow for a lake drains over
//      its lip) and ends in the sea, a lake or off the edge of the land;
//   3. every river reaches the sea, a lake or the edge;
//   4. the settings do what they say: more sea is more sea, more rivers more
//      river, more forest more forest, hillier more hills;
//   5. villages stand on ground that can be lived on, and nobody starts in the sea
//      or a lake;
//   6. fields are only where something grows.
//
// node projects/world-builder/test/land.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const G = { sea: 0, lake: 1, river: 2, marsh: 4, forest: 6, hills: 7, mountain: 8, snow: 10 };
const share = (w, k) => { let n = 0; for (const g of w.ground) if (g === k) n++; return n / w.ground.length; };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// 1. The seed's alone.
{
  const a = People.create({ seed: 5, people: 300 }), b = People.create({ seed: 5, people: 900, villages: 3, factions: 2, births: 1 });
  assert.ok(same(a.ground, b.ground) && same(a.height, b.height), "the same seed gives the same land whatever else is set");
  const c = People.create({ seed: 6, people: 300 });
  assert.ok(!same(a.ground, c.ground), "another seed gives another land");
}

// 2 and 3. Downhill, and to somewhere.
for (const [seed, map, more] of [[11, 17, {}], [3, 60, { rivers: 1 }], [7, 120, { sea: 0 }], [2, 40, { sea: 0.6, hills: 1 }]]) {
  const land = {};
  const w = People.create(Object.assign({ seed, map, people: 50 }, more), { land });
  const { down, fill } = land, n = w.ground.length;
  assert.ok(down && fill, "the test hook hands back the drainage");
  const ends = i => w.ground[i] === G.sea || w.ground[i] === G.lake || down[i] < 0;
  let rivers = 0;
  for (let i = 0; i < n; i++) {
    if (down[i] >= 0) assert.ok(fill[down[i]] <= fill[i], "water never runs uphill (seed " + seed + ")");
    if (w.ground[i] !== G.river) continue;
    rivers++;
    let j = i, steps = 0;
    while (!ends(j)) { j = down[j]; assert.ok(++steps < n, "a river cannot run in a circle"); }
  }
  if (more.rivers === 1) assert.ok(rivers > 0, "the most rivers gives rivers");
  if (more.sea === 0) assert.equal(share(w, G.sea), 0, "no sea is no sea");
}

// 4. The settings mean what they say (one seed, each at its two ends).
{
  const base = { seed: 4, map: 60, people: 50 };
  const at = (k, v) => People.create(Object.assign({}, base, { [k]: v }));
  assert.ok(share(at("sea", 0.5), G.sea) > share(at("sea", 0.1), G.sea) + 0.3, "more sea");
  assert.ok(share(at("rivers", 1), G.river) > share(at("rivers", 0.2), G.river), "more rivers");
  assert.equal(share(at("rivers", 0), G.river), 0, "no rivers is none");
  assert.ok(share(at("forest", 1), G.forest) > share(at("forest", 0), G.forest), "more forest");
  const hills = w => share(w, G.hills) + share(w, G.mountain);
  assert.ok(hills(at("hills", 1)) > hills(at("hills", 0)), "hillier");
  const cold = People.create(Object.assign({}, base, { map: 300, latitude: 70, winter: 1 })), warm = People.create(Object.assign({}, base, { map: 300, latitude: 10, winter: 0 }));
  assert.ok(share(cold, G.snow) > share(warm, G.snow), "colder worlds have more snow and ice");
}

// 5 and 6. Where people are, and where things grow.
for (const set of [{ seed: 11 }, { seed: 2, sea: 0.7 }, { seed: 9, latitude: 70, winter: 1, hills: 1 }, { seed: 3, map: 5, people: 400 }]) {
  const w = People.create(Object.assign({ people: 600 }, set));
  const live = new Set([3, 5, 6, 7, 9]);
  assert.equal(w.villages.length, w.settings.factions * w.settings.villages, "every village found a place " + JSON.stringify(set));
  for (const v of w.villages) assert.ok(live.has(w.ground[Math.floor(v.y) * w.cols + Math.floor(v.x)]), "a village stands on livable ground");
  for (const p of w.people) { const g = w.ground[Math.floor(p.y) * w.cols + Math.floor(p.x)]; assert.ok(g !== G.sea && g !== G.lake, "nobody starts in the water " + JSON.stringify(set)); }
  for (let i = 0; i < w.ground.length; i++) if ([0, 1, 2, 4, 8, 10].includes(w.ground[i])) assert.equal(w.fert[i], 0, "nothing grows on water, marsh, mountain or snow");
}

// 7. Crossing (TODO 4b): nobody walks into the sea or a lake, two days of a crowded wet world.
for (const set of [{ seed: 11 }, { seed: 2, sea: 0.6 }]) {
  const w = People.create(Object.assign({ people: 600 }, set));
  for (let h = 0; h < 48; h++) {
    w.step(1);
    for (const p of w.people) { const g = w.ground[Math.floor(p.y) * w.cols + Math.floor(p.x)]; assert.ok(g !== G.sea && g !== G.lake, "nobody walks into the water " + JSON.stringify(set)); }
  }
}

// 8. A walker sent to the far shore of a lake goes round it, on land, and gets there.
{
  let done = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const w = People.create({ seed, map: 120, people: 20, rivers: 0.3 });
    const C = w.cols, at = (x, y) => w.ground[y * C + x];
    /* A row with dry land, then at least four squares of lake, then dry land again. */
    let from = null, to = null;
    for (let y = 5; y < w.rows - 5 && !from; y++) for (let x = 5; x < C - 20 && !from; x++) {
      if (at(x, y) <= 1 || at(x + 1, y) !== 1) continue;
      let e = x + 1; while (e < C - 5 && at(e, y) === 1) e++;
      if (e - x - 1 >= 4 && e - x - 1 <= 12 && at(e, y) > 1 && at(e + 1, y) > 1) { from = [x + 0.5, y + 0.5]; to = [e + 1.5, y + 0.5]; }
    }
    if (!from) continue;
    const p = w.people.find(q => w.adult(q));
    for (const q of w.people) if (q !== p) { q.wait = 1e6; }
    p.x = from[0]; p.y = from[1]; p.tx = to[0]; p.ty = to[1]; p.task = "trade"; p.wait = 0; p.food = 50; p.rest = 0; p.lastDistance = Infinity; p.stuck = 0; p.route = null; p.way = null;
    let arrived = false;
    for (let i = 0; i < 6000 && !arrived; i++) {
      w.advance(People.STEP);
      const g = w.ground[Math.floor(p.y) * C + Math.floor(p.x)];
      assert.ok(g !== G.sea && g !== G.lake, "the walker never steps into the lake");
      if (p.task !== "trade") break;
      arrived = Math.hypot(p.x - to[0], p.y - to[1]) < 1;
    }
    if (p.task !== "trade") continue;   // something else called them away: try another lake
    assert.ok(arrived, "the walker gets round the lake to the far shore (seed " + seed + ")");
    done = true; break;
  }
  assert.ok(done, "a lake with two shores was found and walked round");
}

console.log("world-builder land: the seed's own, downhill, settings that mean it, nobody in the water, the way round a lake");
