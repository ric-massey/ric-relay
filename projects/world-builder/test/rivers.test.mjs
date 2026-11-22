// Rivers that run one way, and grain by boat (TODO.md 15.5b1, 2026-11-21). Ric: "Boats should be
// pretty important for travel because it makes it easy but then the question goes of which way the
// rivers travel".
//
// What is held:
//   1. the default world, which has no big river, is the world it was before 15.5b1;
//   2. a boat goes down a big river faster than it comes back up it — about three times, towed;
//   3. a boat gets along a river that runs corner to corner, and past its fords;
//   4. only a trader at home with the village's boat takes a boatload, to a village it can reach,
//      and the time there is not the time back where a river runs between them.
//
// node projects/world-builder/test/rivers.test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const People = createRequire(import.meta.url)("../people.js");

// 1. No big river: nothing changes.
{
  const w = People.create({ seed: 1, harvestTax: 0, dirt: "fixed", health: "simple", sexes: "none", childwork: "none", housework: "none", landchange: "fixed", beasts: "none", irrigation: "none", climate: 0, sleep: "simple", hearth: "village", plenty: false, govern: "leader", faith: false, marriage: "liking", finds: 0, works: "none", armies: "trickle", roaming: "settled", campaign: "home", caravans: false, armySick: false, oldArms: "plain", generals: "none", siegecraft: "old" });   // (and 15.5r's dirt) 15.5t's harvest tax changes the world; off, it is the world 15.5b2 left
  w.step(24 * 30);
  let h = 0; const mix = x => { h = (h * 31 + (Math.round(x * 1e6) | 0)) % 2147483647; };
  for (const p of w.people) { mix(p.id); mix(p.x); mix(p.y); mix(p.food); mix(p.coins); mix(p.home); }
  /* 2129222375 until 15.5b2 (2026-11-21): a leader's coins set aside for grain move the treasury, so
     the tax and relief, within the month. Checked then that the committed engine still gave the old
     value, so the change is 15.5b2's and nothing of 15.5b1 moved. */
  assert.equal(h, 1920400234, "the default world is the world it was before 15.5b1 (as 15.5b2 changed it)");
}

// 2 and 3. Down and up the longest stretch of big river on a 60 km land.
{
  const w = People.create({ seed: 1, map: 60, people: 200, rivers: 0.8 });
  const cols = w.cols, cr = w.cross, rt = w.riverTo, g = w.ground;
  const FX = [1, -1, 0, 0, 1, 1, -1, -1], FY = [0, 0, 1, -1, 1, -1, 1, -1];
  let chain = [];
  for (let i = 0; i < cr.length; i++) if (cr[i] >= 1) {
    const c = [i]; let at = i;
    for (let n = 0; n < 400; n++) { const d = rt[at]; if (d > 7) break; const j = (((at / cols) | 0) + FY[d]) * cols + at % cols + FX[d]; if (!(cr[j] >= 1)) break; c.push(j); at = j; }
    if (c.length > chain.length) chain = c;
  }
  assert.ok(chain.length > 20, "a long big river: " + chain.length + " squares");
  assert.ok(chain.some(i => cr[i] === 2), "with a ford on it");
  assert.ok(chain.some((i, k) => k && (Math.abs(i % cols - chain[k - 1] % cols) === 1 && Math.abs(((i / cols) | 0) - ((chain[k - 1] / cols) | 0)) === 1)), "running corner to corner somewhere");
  const bank = i => { const x = i % cols, y = (i / cols) | 0; for (let k = 0; k < 4; k++) { const j = (y + FY[k]) * cols + x + FX[k]; if (g[j] > 1 && !(cr[j] >= 1)) return j; } return -1; };
  const top = bank(chain[1]), bottom = bank(chain[chain.length - 2]);
  const down = w.boatHours(top, bottom), up = w.boatHours(bottom, top);
  assert.ok(down !== null && up !== null, "a boat gets along it, past its fords and round its corners");
  const ratio = (up - 0.5) / (down - 0.5);
  assert.ok(ratio > 2 && ratio < 3.2, "up the river takes two to three times as long as down: " + down.toFixed(2) + " h down, " + up.toFixed(2) + " h up");
}

// 4. A boatload of grain only from a village that has a boat, to one its boat can reach.
{
  const w = People.create({ seed: 9, map: 60, people: 1500, rivers: 0.9, villages: 20 });
  const L = w.villages.filter(v => w.landingOf(v.id));
  let pairs = 0, unequal = 0;
  for (const v of L) for (const o of L) {
    if (v === o || Math.hypot(o.x - v.x, o.y - v.y) < 12) continue;
    const there = w.boatHours(w.landingOf(v.id).i, w.landingOf(o.id).i), back = w.boatHours(w.landingOf(o.id).i, w.landingOf(v.id).i);
    if (there === null) continue;
    pairs++; if (Math.abs(there - back) > 0.2) unequal++;
    const p = w.people.find(q => q.home === v.id && w.adult(q)); p.x = v.x; p.y = v.y; p.at = v.id;
    assert.equal(w.byBoat(p.id, o.id), false, "no boat, no boatload");
    v.boat = { x: w.landingOf(v.id).x, y: w.landingOf(v.id).y };
    assert.equal(w.byBoat(p.id, o.id), true, "with the village's boat, a boatload to " + o.name);
    v.boat = null;
  }
  assert.ok(pairs >= 4, "villages on water that a boat joins: " + pairs);
  assert.ok(unequal > 0, "and the way there is not the way back, where a river runs between them");
}

console.log("world-builder rivers: no big river, no change; down faster than up; along corners and past fords; a boatload only by a village's boat");
