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
  + s.springEnergy + s.twistEnergy + s.chargeEnergy - s.bondEnergy - s.heated;
const run = (w, seconds) => { for (let f = 0; f < seconds * 60; f++) w.step(1 / 60); };

test("all four off is the world it was", () => {
  const set = { layout: "cloud", count: 300, size: 40, kinds: 5, bonding: "sum", maxBonds: 3,
    shift: 1, startTemp: 2, startSpeed: 2, shake: 0.4, conduct: 0.4 };
  const plain = Physics.create(set);
  const off = Physics.create({ ...set, settle: false, barrier: 0, bondsPer: "same", charge: 0 });
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

/* ── Charge from bonds ──────────────────────────────────────────────────── */

/* A grid of hexagons held still, so the only thing moving energy is bonds
   being made and broken, and the charge each one moves. */
function heldGrid(set, gap) {
  const w = Physics.create({ layout: "empty", size: 30, kinds: 7, edge: "wrap", sized: false,
    bonding: "any", bondStrength: 2, bondChance: 1, maxBonds: 4, bondsPer: "kind", charge: 2,
    startTemp: 1.5, shake: 0, conduct: 0.3, radiate: 0, gravity: 0, breaking: false, ...set });
  for (let gx = 0; gx < 25; gx++) for (let gy = 0; gy < 25; gy++) {
    const id = w.place(gx * gap + (gy % 2) * gap / 2, gy * 0.9, 1 + ((gx * 3 + gy) % 7), 0, 0, 1);
    w.edit(id, { pinned: true });
  }
  return w;
}

test("charge: the harder puller goes negative, and a thing adds up to nothing", () => {
  const w = heldGrid({ settle: true }, 1.04);
  run(w, 3);
  assert.ok(w.stats().bonds > 50, "nothing bonded");
  const expect = new Float64Array(w.n);
  for (const bd of w.bonds.values()) {
    const g = Physics.pull(w.kind[bd.b]) - Physics.pull(w.kind[bd.a]);
    expect[bd.a] += g; expect[bd.b] -= g;
  }
  let total = 0;
  for (let i = 0; i < w.n; i++) {
    const c = w.describe(i).charge;
    assert.ok(Math.abs(c - expect[i]) < 1e-9, `hexagon ${i}: ${c}, expected ${expect[i]}`);
    total += c;
  }
  assert.ok(Math.abs(total) < 1e-9, `the world's charges add to ${total}`);
  /* Kind 6 holding two kind 1s, the shape of water: −10/7 in the middle. */
  const water = [-(Physics.pull(6) - Physics.pull(1)) * 2, Physics.pull(6) - Physics.pull(1)];
  assert.ok(Math.abs(water[0] + 10 / 7) < 1e-12 && Math.abs(water[1] - 5 / 7) < 1e-12);
});

/* Every bond made or broken pays for what its charge does to everyone near
   it: out of the pool when settling, out of its own two ends when not. */
test("charge keeps the books exactly (settling)", () => {
  const w = heldGrid({ settle: true, barrier: 1 }, 1.04);
  const before = energy(w.stats());
  run(w, 6);
  const after = w.stats();
  assert.ok(after.bondsMade > 100 && after.bondsBroken > 50, `made ${after.bondsMade}, broke ${after.bondsBroken}`);
  assert.ok(after.chargeEnergy !== 0, "nothing felt a charge");
  assert.ok(Math.abs(energy(after) - before) < 1e-9 * before, `energy ${before} → ${energy(after)}`);
});
/* Without settling, two held hexagons never bond (a collision between two
   immovable things is skipped), so the grid is let bond for one moment,
   then held, and the books are read while its bonds shake loose. */
test("charge keeps the books exactly (bonding on contact)", () => {
  const w = heldGrid({ settle: false, startTemp: 3 }, 0.99);
  for (let i = 0; i < w.n; i++) w.edit(i, { pinned: false });
  w.step(1 / 240);
  for (let i = 0; i < w.n; i++) w.edit(i, { pinned: true });
  const start = w.stats(), before = energy(start);
  assert.ok(start.bonds > 50, `made ${start.bonds}`);
  assert.ok(start.chargeEnergy !== 0, "nothing felt a charge");
  run(w, 3);
  const after = w.stats();
  assert.ok(after.bondsBroken > 30, `broke ${after.bondsBroken}`);
  assert.ok(Math.abs(energy(after) - before) < 1e-9 * before, `energy ${before} → ${energy(after)}`);
});

/* The same four pieces, wired two ways. 1–7 twice: each pair lopsided, one
   end positive and one negative. 1–1 and 7–7: each pair alike, no charge at
   all. Real chemistry's version is HF, which boils at 20 °C, next to H₂ and
   F₂ at −253 and −188. Only the wiring differs, and the lopsided pairs
   stick to each other. */
function contacts(polar, charge) {
  const w = Physics.create({ layout: "empty", size: 40, kinds: 7, edge: "wrap", sized: false, bonding: "any",
    bondsPer: "kind", maxBonds: 4, bondChance: 1, bondStrength: 6, startTemp: 0, shake: 0.3, conduct: 0.3,
    radiate: 0.8, gravity: 0, bounce: 0.8, breaking: false, charge: 0 });
  const mols = [];
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
    const kinds = polar ? [1, 7] : ((a + b) % 2 ? [1, 1] : [7, 7]);
    const pos = [[2 + a * 4, 2 + b * 4], [2.98 + a * 4, 2 + b * 4]];
    mols.push({ pos, ids: pos.map(([px, py], k) => w.place(px, py, kinds[k], 0, 0, 1)) });
  }
  /* Held until every pair has bonded and cooled. Holding them is not
     physics and nothing is measured until they are let go. */
  for (let f = 0; f < 600; f++) {
    w.step(1 / 240);
    if (w.stats().bonds < 100) for (const M of mols) M.ids.forEach((id, k) => {
      w.x[id] = M.pos[k][0]; w.y[id] = M.pos[k][1]; w.vx[id] = 0; w.vy[id] = 0;
    });
  }
  assert.equal(w.stats().bonds, 100);
  const mol = new Int32Array(w.n);
  mols.forEach((M, k) => M.ids.forEach(id => { mol[id] = k; }));
  w.set("radiate", 0); w.set("charge", charge);
  for (let i = 0; i < w.n; i++) w.edit(i, { temperature: 0.3 });
  run(w, 10);
  let touching = 0;
  for (let s = 0; s < 10; s++) {
    run(w, 1);
    for (let i = 0; i < w.n; i++) for (let j = i + 1; j < w.n; j++) {
      if (mol[i] === mol[j]) continue;
      let dx = w.x[j] - w.x[i], dy = w.y[j] - w.y[i];
      dx -= 40 * Math.round(dx / 40); dy -= 40 * Math.round(dy / 40);
      if (dx * dx + dy * dy < 1.44) touching++;
    }
  }
  return touching / 1000;
}
test("charge: the same pieces wired differently stick differently", () => {
  const lopsided = contacts(true, 3), alike = contacts(false, 3), alikeOff = contacts(false, 0);
  assert.ok(lopsided > 2 * alike, `lopsided pairs ${lopsided} touching each, alike pairs ${alike}`);
  assert.equal(alike, alikeOff, "pairs with no charge should not notice the setting at all");
});
