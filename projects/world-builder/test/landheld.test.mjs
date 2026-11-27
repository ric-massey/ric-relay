// How land is held (TODO 24, 2026-11-27): by use and walking, by reach, by record, by survey.
//
// What is held:
//   1. each stage comes from what a people knows and how it rules, never its era label: foragers a
//      range, ruled farmers a reach, a people that writes a record, rail or the telegraph a survey;
//   2. a village's land is a walk, not a disc: nothing it holds lies past the walk the old disc
//      measured, and rough ground holds it shorter than open grass;
//   3. what the page is sent agrees with the engine: a village's square is its id, a people's square
//      outside its villages carries the people and the kind;
//   4. reach joins up: under stage 3 a people's villages hold land between them;
//   5. a written border stays put while nothing happens, and moves with a village ceded at a peace;
//   6. surveyed land runs over rivers nobody can wade; a band's range is nobody's to refuse;
//   7. the same seed holds the same land.
//
// node projects/world-builder/test/landheld.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

const stageOf = era => { const w = People.create({ seed: 3, people: 300, era }); return [...new Set(w.factions.filter(f => f.alive).map(f => w.landStage(f)))]; };
assert.deepEqual(stageOf("foragers"), [1], "foragers hold a range");
assert.deepEqual(stageOf("early"), [3], "early farmers with a leader who takes a share hold by reach");
assert.deepEqual(stageOf("bronze"), [4], "a people that writes holds by record");
assert.deepEqual(stageOf("industrial"), [5], "rail and the telegraph bring a survey");
{
  /* Not the era: an early people with nobody taking a share and no soldiers holds only by use. */
  const w = People.create({ seed: 3, people: 300, tax: 0, harvestTax: 0, soldiers: 0 });
  const f = w.factions.find(g => g.alive && !(g.army > 0 || g.tax > 0 || g.harvest > 0 || g.soldiers > 0));
  assert.ok(f, "with no tax, no share of the harvest and no soldiers, nobody rules");
  assert.equal(w.landStage(f), 2, "a farming people nobody rules holds what its villages work");
  for (let i = 0; i < w.realm.length; i++) if (w.realm[i] === f.id) assert.fail("and holds nothing outside its villages");
}

/* 2. A walk, not a disc. */
{
  let far = 0, rough = 0, open = 0, roughN = 0, openN = 0;
  for (const seed of [1, 2, 3, 4]) {
  const w = People.create({ seed, people: 400 });
  for (let i = 0; i < w.owner.length; i++) {
    const o = w.owner[i]; if (o < 0) continue;
    const v = w.villages[o], d = Math.hypot(i % w.cols + 0.5 - v.x, ((i / w.cols) | 0) + 0.5 - v.y);
    if (d > v.radius + 1.5) far++;
  }
  for (const v of w.villages) if (v.alive) {
    /* Squares held, against the old disc's area, by how rough its ground is. */
    let held = 0, slow = 0, all = 0;
    for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === v.id) held++;
    const r = Math.ceil(v.radius);
    for (let y = Math.floor(v.y) - r; y <= Math.floor(v.y) + r; y++) for (let x = Math.floor(v.x) - r; x <= Math.floor(v.x) + r; x++) {
      if (x < 0 || y < 0 || x >= w.cols || y >= w.rows || Math.hypot(x + 0.5 - v.x, y + 0.5 - v.y) >= v.radius) continue;
      const g = w.ground[y * w.cols + x]; all++; if (g === 4 || g === 6 || g === 7 || g === 8) slow++;
    }
    if (slow / all > 0.5) { rough += held / (Math.PI * v.radius * v.radius); roughN++; } else if (slow / all < 0.2) { open += held / (Math.PI * v.radius * v.radius); openN++; }
  }
  }
  assert.equal(far, 0, "nothing a village holds lies past the walk the old disc measured");
  console.log("  share of the old disc held: open ground " + (open / openN).toFixed(2) + " (" + openN + "), rough " + (rough / roughN).toFixed(2) + " (" + roughN + ")");
  assert.ok(openN && roughN, "both kinds of ground were looked at");
  assert.ok(open / openN > rough / roughN, "rough ground holds a village's land shorter than open grass");
}

/* 3, 4. What the page is sent, and reach joining up. */
{
  const w = People.create({ seed: 2, people: 400 });
  w.step(24 * 2);
  for (let i = 0; i < w.owner.length; i++) {
    const o = w.owner[i], c = w.landCode[i];
    if (o >= 0) assert.equal(c, o, "a village's square is sent as the village");
    else if (w.realm[i] >= 0) assert.equal(c, -(2 + w.realm[i] * 8 + w.realmK[i]), "a people's square outside its villages carries the people and the kind");
    else assert.equal(c, -1, "nobody's square is −1");
  }
  /* Two villages of one people within an hour's walk of each other's land: the squares between are theirs. */
  let joined = 0, pairs = 0;
  for (const a of w.villages) for (const b of w.villages) {
    if (!a.alive || !b.alive || a.id >= b.id || a.f !== b.f || w.landStage(a.f) !== 3) continue;
    const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > a.radius + b.radius + 12) continue;
    pairs++;
    let ok = 0, n = 0;
    for (let k = 1; k < 10; k++) {
      const x = Math.floor(a.x + (b.x - a.x) * k / 10), y = Math.floor(a.y + (b.y - a.y) * k / 10), i = y * w.cols + x;
      if (w.ground[i] <= 2) continue; n++;
      if (w.owner[i] >= 0 ? w.villages[w.owner[i]].f === a.f : w.realm[i] === a.f) ok++;
    }
    if (n && ok / n >= 0.8) joined++;
  }
  console.log("  stage 3, two villages of one people near each other: joined up " + joined + " of " + pairs);
  assert.ok(pairs > 0 && joined / pairs >= 0.75, "a people's reach joins up between its villages");
}

/* 5. Written down, a border stays; ceded, it moves with the village. */
{
  const w = People.create({ seed: 6, people: 300, factions: 2, villages: 4, era: "bronze", war: false });
  w.step(24);
  const written = f => { const out = []; for (let i = 0; i < w.realm.length; i++) if (w.realm[i] === f && w.realmK[i] === 2) out.push(i); return out; };
  const before = [written(0), written(1)];
  assert.ok(before[0].length > 0 && before[1].length > 0, "both peoples have written land");
  w.step(24 * 21);
  const still = before.map((l, f) => l.filter(i => w.realm[i] === f || (w.owner[i] >= 0 && w.villages[w.owner[i]].f === f)).length / l.length);
  console.log("  three weeks of peace: written land still each people's " + still.map(x => (x * 100).toFixed(1) + "%").join(", "));
  assert.ok(still[0] > 0.97 && still[1] > 0.97, "with nothing happening, a written border stays where it was");
  const v = w.villages.find(u => u.alive && u.f === 1 && w.villages.some(o => o.alive && o.f === 1 && o !== u));
  const its = []; for (let i = 0; i < w.realm.length; i++) if (w.realm[i] === 1 && w.realmK[i] === 2 && w.realmV[i] === v.id) its.push(i);
  assert.ok(its.length > 0, "the ceded village had written land of its own");
  w.takeOnTerms(v.id, 0);
  w.step(24);
  const moved = its.filter(i => w.realm[i] === 0 || (w.owner[i] >= 0 && w.villages[w.owner[i]].f === 0)).length / its.length;
  console.log("  a village ceded: " + (moved * 100).toFixed(0) + "% of its written land went with it");
  assert.ok(moved > 0.9, "a written border moves with a village ceded at a peace");
}

/* 6. A survey runs over water nobody can wade; a range is nobody's. */
{
  let over = 0;
  for (const seed of [1, 2, 3, 4]) {
    const w = People.create({ seed, people: 400, era: "industrial" });
    for (let i = 0; i < w.realm.length; i++) if (w.realm[i] >= 0 && w.realmK[i] === 3 && w.ground[i] === 2) over++;
  }
  console.log("  surveyed squares on rivers: " + over);
  assert.ok(over > 0, "a surveyed line runs over rivers");
  const c = People.create({ seed: 2, people: 400, era: "foragers" });
  let range = 0;
  for (let i = 0; i < c.realm.length; i++) if (c.realm[i] >= 0) { assert.equal(c.realmK[i], 4, "a band holds a range and nothing more"); range++; }
  assert.ok(range > 0, "a band has a range round its camp");
}

/* 7. The same seed, the same land. */
{
  const a = People.create({ seed: 8, people: 400 }), b = People.create({ seed: 8, people: 400 });
  a.step(24 * 8); b.step(24 * 8);
  assert.deepEqual(Array.from(a.landCode), Array.from(b.landCode), "the same seed holds the same land");
}
console.log("landheld: ok");
