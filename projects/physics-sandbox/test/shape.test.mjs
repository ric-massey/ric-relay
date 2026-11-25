/* Shape, and a sequence that can be read.

   These hold the two rules added on 2026-11-13 so that self-replication is
   POSSIBLE in the physics sandbox rather than ruled out by arithmetic: bonds
   that hold an angle (so a thing has a shape, and two hexagons held against
   the same neighbour stay in step) and a bond that reads the next one along
   (so a chain carries a sequence worth copying). Nothing here asserts that
   anything replicates — see replication-probe.mjs, which measures that and
   is run by hand.

   The one thing these must never stop checking: with both settings off, the
   world is the world it was before any of this existed. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("../physics.js");

const base = set => ({
  layout: "empty", size: 80, kinds: 5, edge: "wrap", sized: false,
  bonding: "any", bondStrength: 3, bondChance: 1, maxBonds: 6, bondSpeed: 6,
  startTemp: 0, startSpeed: 0, shake: 0, conduct: 0, radiate: 0,
  gravity: 0, fall: 0, bounce: 1, breaking: false, align: 30, ...set });
const make = set => Physics.create(base(set));
const dist = (w, i, j) => Math.hypot(w.x[j] - w.x[i], w.y[j] - w.y[i]);
/* Everything the world holds, with nothing left out: the two springs are
   stored energy, bonds gave their strength up as heat when they formed. */
const energy = s => s.motion + s.heat + s.radiated + s.dragged + s.breakWork
  + s.springEnergy + s.twistEnergy - s.bondEnergy - s.heated;
/* A row of hexagons, held in place until they have all bonded and cooled so
   the formation heat cannot shake them apart again. Holding them is not
   physics and is not measured: every test reads its starting numbers after
   the row is let go. */
function row(w, kinds) {
  const gap = 0.98, y = 40;
  const ids = kinds.map((k, q) => w.place(40 + q * gap, y, k, 0, 0, 1));
  w.set("radiate", 0.8);
  for (let f = 0; f < 1500; f++) {
    w.step(1 / 240);
    if (w.stats().bonds < kinds.length - 1) ids.forEach((id, q) => {
      w.x[id] = 40 + q * gap; w.y[id] = y; w.vx[id] = 0; w.vy[id] = 0;
    });
  }
  w.set("radiate", 0);
  assert.equal(w.stats().bonds, kinds.length - 1, "the row did not bond up");
  return ids;
}

test("with angles and look off, a world is exactly the world it was", () => {
  const settings = { count: 220, size: 40, layout: "cloud", kinds: 5, bonding: "sum",
    maxBonds: 3, shift: 1, startTemp: 2, startSpeed: 2, shake: 0.4, conduct: 0.4 };
  const plain = Physics.create(settings);
  const off = Physics.create({ ...settings, angles: 0, look: 0, align: 12 });
  for (let f = 0; f < 600; f++) { plain.step(1 / 60); off.step(1 / 60); }
  for (let i = 0; i < plain.n; i++) {
    assert.equal(off.x[i], plain.x[i], "a hexagon moved differently with the new settings off");
    assert.equal(off.heat[i], plain.heat[i]);
    assert.equal(off.kind[i], plain.kind[i]);
  }
  assert.equal(off.stats().bonds, plain.stats().bonds);
  for (let i = 0; i < off.n; i++) assert.equal(off.spin[i], 0, "nothing turns with angles off");
});

test("a bond holds its angle: the slots swing round to face each other", () => {
  const w = make({ angles: 0.8 });
  const [a, b] = row(w, [1, 2]);
  assert.equal(w.stats().bonds, 1, "the pair did not bond");
  const bd = [...w.bonds.values()][0];
  const wrap = v => v - Math.PI * 2 * Math.round(v / (Math.PI * 2));
  const along = Math.atan2(w.y[b] - w.y[a], w.x[b] - w.x[a]);
  const errA = Math.abs(wrap(along - (w.face[a] + bd.sa * Math.PI / 3)));
  const errB = Math.abs(wrap(along + Math.PI - (w.face[b] + bd.sb * Math.PI / 3)));
  assert.ok(errA < 0.08 && errB < 0.08, `the bond did not straighten: ${errA} / ${errB}`);
});

test("one slot holds one bond, so nothing piles up in the same place", () => {
  const w = make({ angles: 0.6, maxBonds: 6 });
  for (let q = 0; q < 40; q++) w.place(40 + (q % 8) * 0.9, 40 + Math.floor(q / 8) * 0.9, 1 + q % 5, 0, 0, 1);
  for (let f = 0; f < 1200; f++) w.step(1 / 240);
  const taken = new Map();
  for (const bd of w.bonds.values()) {
    for (const [who, slot] of [[bd.a, bd.sa], [bd.b, bd.sb]]) {
      assert.ok(slot >= 0 && slot < 6, "a bond with angles on has no slot");
      const at = who * 6 + slot;
      assert.ok(!taken.has(at), `two bonds in one slot on hexagon ${who}`);
      taken.set(at, true);
    }
  }
  for (let i = 0; i < w.n; i++) {
    let held = 0;
    for (let sl = 0; sl < 6; sl++) if (w.slots[i * 6 + sl] >= 0) held++;
    assert.equal(held, w.nb[i], "the slots and the bond count disagree");
  }
});

test("lining up tightly makes a bond rare, which is what leaves room for a template", () => {
  const counts = [30, 3].map(align => {
    const w = make({ angles: 0.6, align, count: 0 });
    for (let q = 0; q < 120; q++) w.place(20 + (q % 12) * 1.4, 20 + Math.floor(q / 12) * 1.4, 1 + q % 5, 0, 0, 1);
    w.set("startSpeed", 0);
    for (let i = 0; i < w.n; i++) { w.vx[i] = (i % 7 - 3) * 0.25; w.vy[i] = (i % 5 - 2) * 0.25; }
    for (let f = 0; f < 2400; f++) w.step(1 / 240);
    return w.stats().bondsMade;
  });
  assert.ok(counts[0] > 0, "nothing bonded even at any angle");
  assert.ok(counts[1] < counts[0] * 0.75, `tight alignment did not make bonding rarer: ${counts[0]} then ${counts[1]}`);
});

test("a bond reads the next one along: the same kind offers a different site", () => {
  const w = make({ angles: 0, bonding: "sum", look: 1, maxBonds: 2 });
  const [left, middle] = row(w, [2, 3]);
  const plain = make({ angles: 0, bonding: "sum", look: 0, maxBonds: 2 });
  const [, alone] = row(plain, [2, 3]);
  assert.equal(w.stats().bonds, 1);
  const read = w.describe(middle), flat = plain.describe(alone);
  assert.notEqual(read.actsAs, flat.actsAs, "the neighbour's kind changed nothing");
  /* And it is the KIND that did it, not the count: a different neighbour, the
     same number of bonds, a different site. */
  const other = make({ angles: 0, bonding: "sum", look: 1, maxBonds: 2 });
  const [, next] = row(other, [4, 3]);
  assert.notEqual(other.describe(next).actsAs, read.actsAs, "two different neighbours read the same");
  assert.equal(left >= 0 && next >= 0, true);
});

test("the census reads a chain along itself, both ways round", () => {
  const forward = make({ angles: 0.6, maxBonds: 2 });
  row(forward, [1, 2, 3]);
  const backward = make({ angles: 0.6, maxBonds: 2 });
  row(backward, [3, 2, 1]);
  const other = make({ angles: 0.6, maxBonds: 2 });
  row(other, [1, 3, 2]);
  const sig = w => { const t = w.census().types; assert.equal(t.length, 1, "the row did not come out as one thing"); return t[0]; };
  const a = sig(forward), b = sig(backward), c = sig(other);
  assert.equal(a.shape, "chain");
  assert.equal(a.sig, b.sig, "a row and the same row backwards are the same thing");
  assert.notEqual(a.sig, c.sig, "a different order came out as the same thing");
  assert.deepEqual(a.kinds, [1, 2, 3]);
});

test("a bonded world keeps its books, with the angle spring in them", () => {
  for (const angles of [0, 0.5, 1]) {
    const w = make({ angles, maxBonds: 3 });
    row(w, [1, 2, 3, 4]);
    const bonds = w.stats().bonds;
    assert.ok(bonds >= 2, `the row did not bond: ${bonds}`);
    w.spin[0] += 2; w.vy[0] += 0.05;
    const before = w.stats(), e0 = energy(before);
    for (let f = 0; f < 12000; f++) w.step(1 / 240);
    const after = w.stats();
    assert.ok(Math.abs(energy(after) - e0) < 2e-3 * Math.abs(e0),
      `angles ${angles}: energy went from ${e0} to ${energy(after)}`);
    assert.ok(Math.hypot(after.momentumX - before.momentumX, after.momentumY - before.momentumY) < 1e-9,
      `angles ${angles}: the straightening spring moved the world's momentum`);
    assert.ok(Math.abs(after.mass - before.mass) < 1e-9);
  }
});

test("heat turns a hexagon as well as moving it, and pays for both", () => {
  /* No bonds in this one: the springs are integrated step by step and hold a
     little energy between steps, and this is about the shove, which is exact. */
  const w = make({ angles: 0.5, startTemp: 4, shake: 0.6, bondChance: 0 });
  for (let q = 0; q < 30; q++) w.place(10 + q * 2.1, 30, 1 + q % 5, 0, 0, 1);
  const before = w.stats();
  for (let f = 0; f < 1200; f++) w.step(1 / 240);
  const after = w.stats();
  let turning = 0;
  for (let i = 0; i < w.n; i++) if (w.alive[i] && Math.abs(w.spin[i]) > 1e-9) turning++;
  assert.ok(turning > 10, "shaking never turned anything");
  assert.ok(Math.abs(energy(after) - energy(before)) < 1e-6 * energy(before),
    `shaking made or lost energy: ${energy(before)} to ${energy(after)}`);
});

test("a pinned hexagon is not turned, and holds its end still", () => {
  const w = make({ angles: 0.9 });
  const [a, b] = row(w, [1, 2]);
  w.edit(a, { pinned: true });
  const face0 = w.face[a], x0 = w.x[a];
  w.spin[b] += 3;
  for (let f = 0; f < 2400; f++) w.step(1 / 240);
  assert.equal(w.face[a], face0, "a pinned hexagon was turned by its bond");
  assert.equal(w.x[a], x0, "a pinned hexagon was moved by its bond");
  assert.ok(dist(w, a, b) < 1.7, "the bond tore");
});
