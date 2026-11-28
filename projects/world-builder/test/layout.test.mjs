// Where houses stand (TODO 23, 2026-11-27): villages laid out as real ones are.
//
// What is held:
//   1. each of the forms appears where its land and its people call for it: street, green, cluster
//      and scattered farms in a farming world, water somewhere in twelve seeds, a grid for a
//      surveying people, a ring of huts for foragers;
//   2. a house fronts what it should: on a street it faces the street's middle line, round a green
//      it faces the green, in a camp it faces the middle;
//   3. a people's first village sets the custom its later villages take where the land allows it;
//   4. no house stands in the sea or a lake, and the same seed lays out the same houses;
//   5. a household's fields lie behind its house more often than in front of it.
//
// node projects/world-builder/test/layout.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const forms = {}, worlds = [];
for (let seed = 1; seed <= 12; seed++) {
  const w = People.create({ seed, people: 400 });
  worlds.push(w);
  for (const v of w.villages) if (v.alive && v.lay) forms[v.lay.form] = (forms[v.lay.form] || 0) + 1;
}
console.log("  twelve farming worlds: " + JSON.stringify(forms));
for (const k of ["street", "green", "cluster", "farms", "water"]) assert.ok(forms[k] > 0, "a farming world has villages laid out as " + k);
assert.ok(!forms.grid && !forms.camp, "and no grid or camp: early farmers neither survey nor forage");
{
  const w = People.create({ seed: 1, people: 400, era: "industrial" });
  assert.ok(w.villages.some(v => v.alive && v.lay && v.lay.form === "grid"), "a surveying people lays its villages out on a grid");
  const g = w.villages.find(v => v.alive && v.lay && v.lay.form === "grid");
  assert.equal(g.lay.ang, 0, "laid to north, as a survey is");
  const c = People.create({ seed: 1, people: 400, era: "foragers" });
  assert.ok(c.villages.filter(v => v.alive).every(v => v.lay && v.lay.form === "camp"), "foragers' camps are rings of huts");
}

/* 2. Houses face what they front. */
let street = 0, green = 0, camp = 0;
const facing = (h, tx, ty) => { const fx = Math.cos(h.face), fy = Math.sin(h.face); return (tx - h.x) * fx + (ty - h.y) * fy; };
for (const w of worlds) for (const h of w.homes) {
  const v = w.villages[h.v], L = v && v.lay; if (!L || h.face == null) continue;
  if (L.form === "street" && !L.ext) {
    /* The nearest point on the street's middle line. */
    const c = Math.cos(L.ang), s = Math.sin(L.ang), u = (h.x - L.ox) * c + (h.y - L.oy) * s;
    assert.ok(facing(h, L.ox + c * u, L.oy + s * u) > 0, "a house on a street faces the street"); street++;
  }
  if (L.form === "green" && !L.ext && Math.hypot(h.x - v.x, h.y - v.y) < 0.3) { assert.ok(facing(h, v.x, v.y) > 0, "a house round a green faces the green"); green++; }
}
{
  const c = People.create({ seed: 2, people: 400, era: "foragers" });
  for (const h of c.homes) { const v = c.villages[h.v]; if (h.face == null) continue; assert.ok(facing(h, v.x, v.y) > 0, "a hut faces the middle of its camp"); camp++; }
}
console.log("  facing what they front: " + street + " on streets, " + green + " round greens, " + camp + " huts");
assert.ok(street > 20 && green > 20 && camp > 20, "enough houses were looked at");

/* 3. Custom leans: a people's villages take its first village's form where the land allows it. */
{
  let same = 0, all = 0;
  for (const w of worlds) for (const f of w.factions) {
    if (!f.lay) continue;
    for (const v of w.villages) if (v.alive && v.f === f.id && v.lay && v.lay.form !== "farms") { all++; if (v.lay.form === f.lay) same++; }
  }
  console.log("  villages on land that allows a choice, in their people's custom: " + same + " of " + all);
  assert.ok(same / all > 0.6, "a people's custom leans its villages its way");
}

/* 4. No house in water, and the same seed lays out the same houses. */
for (const w of worlds) for (const h of w.homes) {
  const g = w.ground[Math.floor(h.y) * w.cols + Math.floor(h.x)];
  assert.ok(g > 1, "no house stands in the sea or a lake");   // a river square is 250 m across; a house may stand beside a stream that can be waded, as under the spiral
}
{
  const a = People.create({ seed: 5, people: 400 }), b = People.create({ seed: 5, people: 400 });
  assert.deepEqual(a.homes.map(h => [h.x, h.y, h.ang]), b.homes.map(h => [h.x, h.y, h.ang]), "the same seed, the same houses");
}

/* 5. Fields behind the house. */
{
  let behind = 0, ahead = 0;
  for (const w of worlds.slice(0, 6)) {
    w.step(24 * 3);
    for (const h of w.homes) {
      if (h.face == null || !h.fields) continue;
      const fx = Math.cos(h.face), fy = Math.sin(h.face);
      for (const i of h.fields) { const d = (i % w.cols + 0.5 - h.x) * fx + (((i / w.cols) | 0) + 0.5 - h.y) * fy; if (d < 0) behind++; else ahead++; }
    }
  }
  console.log("  a household's fields: " + behind + " behind the house, " + ahead + " in front");
  assert.ok(behind > ahead, "fields lie behind the house more than in front");
}
/* 6. The page draws a field's furrows the way the engine's rows run: the same hash, copied (2026-11-27). */
{
  const { readFileSync } = await import("node:fs");
  const body = (src, name) => { const k = src.indexOf("const " + name + " = (a, b, c) => {"); if (k < 0) return null; const a = src.indexOf("{", k), b = src.indexOf("};", a); return src.slice(a, b); };
  const engine = body(readFileSync(new URL("../people.js", import.meta.url), "utf8"), "h01"), page = body(readFileSync(new URL("../index.html", import.meta.url), "utf8"), "rowHash");
  assert.ok(engine && page && engine === page, "the page's furrows and the engine's rows use the same hash");
}
/* 7. What villages leave on the ground reaches the page (2026-11-27): a layout's streets and green, the squares
   a ditch waters, a sacred grove (and a tap on it opens it), and worn soil once a day. */
{
  const Host = (await import("node:module")).createRequire(import.meta.url)("../people-host.js");
  const got = [];
  const host = Host.create(People, m => got.push(m));
  const ask = m => { got.length = 0; host.receive(m); return got[got.length - 1]; };
  ask({ t: "start", values: { seed: 3, weather: 1, rivers: 0.9, map: 30 } });
  const w = host.world;
  let dv = null; for (const o of w.villages) { if (!o.alive) continue; w.ditchDug(o.id); if (o.ditch && o.ditch.tiles.length > 4) { dv = o; break; } }
  w.step(24 * 3);
  const f = ask({ t: "frame", cam: { x: w.cols / 2, y: w.rows / 2, s: 4, w: w.cols * 4, h: w.rows * 4 }, view: "faction", fresh: true, land: { force: true, at: -1 } });
  assert.ok(f.vs.some(v => v.lay && (v.lay.lines.length || v.lay.green)), "a village's streets or green are sent");
  for (const v of f.vs) if (v.lay) for (const l of v.lay.lines) assert.ok(l.length >= 4 && l.length % 2 === 0 && l.every(Number.isFinite), "each street is a line of points");
  assert.ok(dv && f.vs[dv.id].watered && f.vs[dv.id].watered.length === dv.ditch.tiles.length, "the squares a ditch waters are sent");
  assert.ok(f.worn && f.worn.length === w.worn.length * 2, "worn soil is sent with the land");
  const g = f.vs.find(v => v.sacred >= 0);
  if (g) {
    const i = g.sacred, t = ask({ t: "at", seq: 1, x: i % w.cols + 0.5, y: Math.floor(i / w.cols) + 0.5, r: 0.05 });
    assert.deepEqual(t.thing, { sacred: g.id }, "a tap on a sacred grove is the grove");
  } else console.log("  (no sacred grove chosen yet in this world: its tap not looked at)");
  console.log("  sent: " + f.vs.filter(v => v.lay).length + " layouts, " + (dv ? dv.ditch.tiles.length : 0) + " watered squares, " + f.vs.filter(v => v.sacred >= 0).length + " groves, " + w.worn.length + " worn squares");
}
console.log("layout: ok");
