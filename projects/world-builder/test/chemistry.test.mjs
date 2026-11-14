/* Chemistry with depth: a kind's own character, a barrier, and bonds that
   settle with temperature (2026-11-14, Ric: "its chemical context is
   shallow still"). Quick checks only. The measurements against the textbook
   numbers — van 't Hoff, mass action, a barrier that moves the speed and not
   the balance — take minutes and live in chemistry-probe.mjs, run by hand.

   With all three off the world is byte for byte what it was before; that was
   checked against the previous commit's engine across every preset on the
   day, and the first test here holds the part of it a test can hold. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("../physics.js");

const energy = s => s.motion + s.heat + s.radiated + s.dragged + s.breakWork
  + s.springEnergy + s.twistEnergy - s.bondEnergy - s.heated;
const run = (w, seconds) => { for (let f = 0; f < seconds * 60; f++) w.step(1 / 60); };

test("all three off is the world it was", () => {
  const set = { layout: "cloud", count: 300, size: 40, kinds: 5, bonding: "sum", maxBonds: 3,
    shift: 1, startTemp: 2, startSpeed: 2, shake: 0.4, conduct: 0.4 };
  const plain = Physics.create(set);
  const off = Physics.create({ ...set, settle: false, barrier: 0, bondsPer: "same" });
  run(plain, 8); run(off, 8);
  for (let i = 0; i < plain.n; i++) {
    assert.equal(off.x[i], plain.x[i]);
    assert.equal(off.heat[i], plain.heat[i]);
  }
});

test("a kind's bonds run 1-2-3-4-3-2-1 along a row, and its pull rises", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(Physics.valence), [1, 2, 3, 4, 3, 2, 1, 1, 2]);
  for (let k = 1; k < 7; k++) assert.ok(Physics.pull(k + 1) > Physics.pull(k), "pull rises along a row");
  assert.ok(Physics.pull(8) < Physics.pull(1), "a later row pulls less at the same place");
  /* Pauling: the most unlike pair in a row is the strongest bond there is,
     like with like is weakest, and it grows with the square of the gap. */
  assert.equal(Physics.polar(1, 7), 1);
  assert.ok(Math.abs(Physics.polar(3, 3) - 1 / (1 + 2 * (6 / 7) ** 2)) < 1e-12);
  const g1 = Physics.polar(1, 2) - Physics.polar(1, 1), g2 = Physics.polar(1, 3) - Physics.polar(1, 1);
  assert.ok(Math.abs(g2 / g1 - 4) < 1e-9, "twice the gap, four times the extra");
});

test("set by the kind, nobody holds more than its kind allows", () => {
  const w = Physics.create({ layout: "cloud", count: 700, size: 34, kinds: 7, bonding: "any",
    maxBonds: 6, bondsPer: "kind", bondChance: 1, startTemp: 0.3, startSpeed: 1.5, shake: 0.3 });
  run(w, 10);
  const most = new Map();
  for (let i = 0; i < w.n; i++) if (w.alive[i]) {
    const k = ((w.kind[i] - 1) % 7) + 1;
    assert.ok(w.nb[i] <= Physics.valence(k), `kind ${k} holds ${w.nb[i]}`);
    most.set(k, Math.max(most.get(k) || 0, w.nb[i]));
  }
  assert.ok(most.get(4) >= 3, "kind 4 should branch in a crowded world");
  assert.equal(most.get(1), 1);
});

/* Every make and break pays exactly. The hexagons are held still so that
   nothing but the settling steps moves energy around: a moving bonded world
   drifts a little through the integrator and the collision push-apart, which
   is older than this and measured in README.md, and would hide an error
   here. */
test("settling keeps the books exactly", () => {
  const w = Physics.create({ layout: "empty", size: 30, kinds: 5, edge: "wrap", sized: false,
    bonding: "sum", bondStrength: 2, bondChance: 1, maxBonds: 3, settle: true, barrier: 1.5,
    bondsPer: "kind", angles: 0.5, startTemp: 1.5, shake: 0, conduct: 0.3, radiate: 0, gravity: 0, breaking: false });
  for (let gx = 0; gx < 25; gx++) for (let gy = 0; gy < 25; gy++) {
    const id = w.place(gx * 1.04 + (gy % 2) * 0.52, gy * 0.9, 1 + ((gx * 3 + gy) % 5), 0, 0, 1);
    w.edit(id, { pinned: true, facing: (gx * 7 + gy * 3) % 6 * 0.17 });
  }
  const before = energy(w.stats());
  run(w, 10);
  const after = w.stats();
  assert.ok(after.bondsMade > 200 && after.bondsBroken > 100, `made ${after.bondsMade}, broke ${after.bondsBroken}`);
  assert.ok(Math.abs(energy(after) - before) < 1e-9 * before, `energy ${before} → ${energy(after)}`);
});

test("settling: a hotter world holds fewer bonds", () => {
  const at = T => {
    const w = Physics.create({ layout: "cloud", count: 500, size: 50, kinds: 2, bonding: "other",
      maxBonds: 1, settle: true, bondStrength: 4, startTemp: T, shake: 0.5, conduct: 0.5, radiate: 0, breaking: false });
    run(w, 40);
    return w.stats().bonds;
  };
  const cold = at(0.8), hot = at(3);
  assert.ok(cold > hot * 1.3, `cold ${cold}, hot ${hot}`);
});

/* Pairs held still and touching, slot pointing at slot or turned 20° off.
   Held lined up, there is no barrier left to climb; turned, most of it is
   still there. That gap IS catalysis by holding: nothing names a catalyst.
   The bond is weak, so the pairs flicker between joined and apart without
   heating anything, and the count of joinings is the rate. */
function joinings(set, turn) {
  const w = Physics.create({ layout: "empty", size: 200, kinds: 2, edge: "wrap", sized: false,
    bonding: "any", bondStrength: 0.3, bondChance: 1, maxBonds: 1, settle: true, angles: 0.6, align: 30,
    startTemp: 1, shake: 0, conduct: 0, radiate: 0, gravity: 0, breaking: false, ...set });
  for (let p = 0; p < 30; p++) {
    const x0 = 5 + (p % 6) * 30, y0 = 5 + Math.floor(p / 6) * 30;
    const a = w.place(x0, y0, 1, 0, 0, 1), b = w.place(x0 + 0.999 * (w.r[0] * 2), y0, 1, 0, 0, 1);
    w.edit(a, { pinned: true, facing: turn }); w.edit(b, { pinned: true, facing: -turn });
  }
  run(w, 2);
  return w.stats().bondsMade;
}
test("a barrier is lower for pieces held lined up", () => {
  const turn = 20 * Math.PI / 180;
  const linedUp = joinings({ barrier: 4.5 }, 0), turned = joinings({ barrier: 4.5 }, turn);
  assert.ok(linedUp > 20 * turned, `lined up ${linedUp}, turned ${turned}`);
  /* And with no barrier, lining up makes no difference. */
  const free = joinings({ barrier: 0 }, turn), freeLined = joinings({ barrier: 0 }, 0);
  assert.ok(Math.abs(free / freeLined - 1) < 0.15, `no barrier: turned ${free}, lined up ${freeLined}`);
});

test("without settling, a barrier still slows bonding", () => {
  const count = barrier => {
    const w = Physics.create({ layout: "cloud", count: 500, size: 50, kinds: 3, bonding: "any",
      maxBonds: 2, barrier, startTemp: 1, shake: 0.4, radiate: 0 });
    run(w, 5);
    return w.stats().bonds;
  };
  const none = count(0), high = count(5);
  assert.ok(high < none * 0.3, `no barrier ${none}, barrier 5: ${high}`);
});
