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
console.log("layout: ok");
