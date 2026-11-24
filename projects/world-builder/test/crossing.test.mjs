// Water as a road and a wall (TODO.md item 6d, 2026-11-16).
//
// What is held:
//   1. with "Crossing water" at "wade" there is no crossing map, and nobody goes by boat (that the
//      world is otherwise exactly as before was checked against the engine before this item on
//      three seeds when it was written: README, "Fords, bridges and boats");
//   2. on a land with big rivers there are fords, nobody ever stands in a big river, and a village
//      beside one with no ford near builds a bridge;
//   3. a village by the sea whose people want to cross builds a boat, and is rowed over to an
//      island it could not walk to;
//   4. an army is not: soldiers sent over water they cannot walk round stay, and word of it is
//      given.
//
// node projects/world-builder/test/crossing.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");
const LATER2 = { folk: false, faithRules: "few", fading: "old", fromTop: false, faithsMeet: false, faithDrift: false, faithWealth: false, faithYear: false, comfort: false, faithLaw: false, faithRank: false, lifeRites: false, faithSchools: false, faithKeeps: false, truce: false, martyrs: false, flight: false, greatWorks: false, pilgrims: false, sacredLand: false, faithHealth: false, heardOf: false, experience: "people", discovery: "roll", ruins: "old", scavenge: false, bread: "old" };   // 15.11b to z and 15.12b to d, built after this one, off: its worlds as they were picked

/* Which piece of land each square is on, walked as the engine walks it. */
function pieces(w) {
  const { cols, rows } = w, piece = new Int32Array(cols * rows), size = [0];
  const stop = i => w.ground[i] <= 1 || (w.cross && w.cross[i] === 1);
  let id = 0;
  for (let s = 0; s < piece.length; s++) {
    if (piece[s] || stop(s)) continue;
    id++; size.push(0); const q = [s]; piece[s] = id;
    while (q.length) {
      const i = q.pop(), x = i % cols, y = (i / cols) | 0; size[id]++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (dx && dy && w.cross && w.cross[y * cols + x + dx] === 1 && w.cross[(y + dy) * cols + x] === 1) continue;
        const j = ny * cols + nx; if (!piece[j] && !stop(j)) { piece[j] = id; q.push(j); }
      }
    }
  }
  return { piece, size, at: (x, y) => piece[Math.floor(y) * cols + Math.floor(x)] };
}

// 1. Wade.
{
  const w = People.create({ seed: 4, sea: 0.5, crossing: "wade" });
  assert.equal(w.cross, null, "no crossing map when every river can be waded");
}

// 2. Big rivers: fords, nobody in the water, a bridge.
{
  const w = People.create({ seed: 5, map: 200, people: 2000 });   // seed 5 since 15.12a's dice (2026-11-24)
  let big = 0, fords = 0;
  for (let i = 0; i < w.cross.length; i++) { if (w.cross[i] === 1) big++; if (w.cross[i] === 2) fords++; }
  assert.ok(big > 100 && fords > 10 && fords < big / 4, "big rivers with fords here and there: " + big + " squares, " + fords + " fords");
  for (let h = 0; h < 48; h++) {
    w.step(1);
    for (const p of w.people) assert.notEqual(w.cross[Math.floor(p.y) * w.cols + Math.floor(p.x)], 1, p.name + " is standing in a big river");
  }
  /* Somebody takes up the work on their own. */
  let started = null;
  for (let d = 0; d < 12 && !started; d++) { w.step(24); started = w.villages.find(v => v.bridgeWork > 0); }
  assert.ok(started, "a village beside a big river with no ford near starts a bridge");
  /* A bridge is about 75 person-days, and one here took three to four weeks. So most of it is
     taken as done, and one of the village sent to finish it, as a decision would. */
  const v = started, b = v.crossings.bridge, p = w.people.find(q => q.home === v.id && w.adult(q) && q.job !== "soldier");
  v.bridgeWork = 590;
  w.send(p, b.x, b.y, "bridge"); p.wait = 0;
  for (let h = 0; h < 48 && !v.bridge; h++) { w.step(1); if (!v.bridge && p.task !== "bridge") { w.send(p, b.x, b.y, "bridge"); p.wait = 0; } }
  assert.ok(v.bridge, v.name + " finishes its bridge");
  assert.equal(w.cross[Math.floor(v.bridge.y) * w.cols + Math.floor(v.bridge.x)], 3, "the bridge is on the map");
}

// 3 and 4. A boat to an island, and an army that cannot follow.
{
  const w = People.create({ seed: 4, sea: 0.5, map: 40, ...LATER2 });
  const P = pieces(w);
  const main = P.at(w.villages[0].x, w.villages[0].y);
  let island = -1;
  for (let id = 1; id < P.size.length; id++) if (id !== main && P.size[id] >= 30) island = id;
  assert.ok(island > 0, "seed 4 on 40 km with half of it sea has an island");
  /* The island square nearest a village whose boat could reach it, and that village (2026-11-24: with 15.12a's
     dice the nearest village stood inland, and the nearest with a landing was on water that does not join). */
  const near = [];
  for (let i = 0; i < P.piece.length; i++) if (P.piece[i] === island) {
    const x = i % w.cols + 0.5, y = ((i / w.cols) | 0) + 0.5;
    for (const v of w.villages) if (w.landingOf(v.id)) near.push({ d: Math.hypot(v.x - x, v.y - y), v, x, y });
  }
  near.sort((a, b) => a.d - b.d);
  let best = null;
  for (const c of near) {
    const q = w.people.find(z => z.home === c.v.id && w.adult(z) && z.job !== "soldier"); if (!q) continue;
    const l = w.landingOf(c.v.id), was = { x: q.x, y: q.y, tx: q.tx, ty: q.ty, task: q.task, wait: q.wait };
    c.v.boat = { x: l.x, y: l.y }; w.send(q, c.x, c.y); const ok = q.task === "boat";
    c.v.boat = null; c.v.ferries = null; c.v.wantBoat = 0; Object.assign(q, was); q.over = undefined;
    if (ok) { best = c; break; }
  }
  assert.ok(best, "a village whose boat could reach the island");
  const v = best.v;
  let p = w.people.find(q => q.home === v.id && w.adult(q) && q.job !== "soldier");
  /* Wanting to cross is what starts a boat: refused, and remembered. */
  w.send(p, best.x, best.y);
  assert.equal(p.task, "idle", "no boat yet: nobody sets off over the sea");
  v.wantBoat = 99;
  let days = 0;
  for (; days < 60 && !v.boat; days++) w.step(24);   // 60 days since 2026-11-24: with 15.12a's dice it took longer than 20
  assert.ok(v.boat, v.name + ", by the sea, builds a boat once its people want to cross (" + v.boatWork + " hours of work in " + days + " days)");
  /* Somebody at home now, idle: in sixty days the first may have gone off or taken another living (2026-11-24). */
  p = w.people.filter(q => q.hp > 0 && q.home === v.id && w.adult(q) && q.job !== "soldier" && !q.cargo).sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y))[0];
  w.send(p, best.x, best.y);
  assert.equal(p.task, "boat", "with a boat at home, somebody going to the island goes by it (" + p.task + ")");
  let landed = false;
  for (let h = 0; h < 24 * 3 && !landed; h++) {
    w.step(1);
    landed = P.at(p.x, p.y) === island;
    if (p.task !== "boat" && !landed) w.send(p, best.x, best.y);   // a need may call them home first
  }
  assert.ok(landed, p.name + " is rowed over to the island");
  const soldier = w.people.find(q => q.home === v.id && w.adult(q) && q !== p);
  const x0 = soldier.x;
  w.send(soldier, best.x, best.y, "march");
  assert.ok(soldier.task === "idle" && soldier.tx === x0, "an army does not go by boat");
  assert.ok(w.events.some(e => /stopped by water/.test(e.text)), "word is given that soldiers are stopped by the water");
}

console.log("world-builder crossing: wade is off, fords and bridges on big rivers, a boat to an island, an army stopped at the water");
