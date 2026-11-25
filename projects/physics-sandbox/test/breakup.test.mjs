/* Fracture is real matter moving, with an energy cost, never deletion or a
   free blast. Kept quick so these books are checked on every push. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const Physics = createRequire(import.meta.url)("../physics.js");
const make = set => Physics.create({ layout: "empty", size: 1000, edge: "wrap", sized: false,
  startTemp: 0, startSpeed: 0, gravity: 0, fall: 0, shake: 0, conduct: 0, radiate: 0,
  bounce: 1, toughness: 2, fragmentMass: 1, meltTemp: 20, limit: 1e6, ...set });
/* springEnergy and twistEnergy are what a bond's two springs are holding at
   this moment (added 2026-11-14 with bonds that hold an angle). They belong
   in the books: a bond that lets go hands them back as heat, so leaving them
   out made a stretched bond look like it had made energy. */
const energy = s => s.motion + s.heat + s.radiated + s.dragged + s.breakWork
  + s.springEnergy + s.twistEnergy - s.bondEnergy - s.heated;
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)), `${message}: ${a} / ${b}`);
function books(w, before) {
  const after = w.stats();
  close(after.mass, before.mass, "mass");
  let absoluteX = 0, absoluteY = 0;
  for (let i = 0; i < w.n; i++) if (w.alive[i]) {
    absoluteX += Math.abs(w.m[i] * w.vx[i]); absoluteY += Math.abs(w.m[i] * w.vy[i]);
  }
  // Opposing trillion-mass momenta can cancel to zero with a few micro-units
  // of rounding. Bound error by the terms being summed, not by their tiny net.
  assert.ok(Math.abs(after.momentumX - before.momentumX) <= 1e-9 + 32 * Number.EPSILON * absoluteX, "momentum X");
  assert.ok(Math.abs(after.momentumY - before.momentumY) <= 1e-9 + 32 * Number.EPSILON * absoluteY, "momentum Y");
  close(energy(after), energy(before), "motion + heat + fracture work - bonds");
  for (let i = 0; i < w.n; i++) if (w.alive[i]) {
    assert.ok([w.x[i], w.y[i], w.vx[i], w.vy[i], w.heat[i], w.m[i]].every(Number.isFinite));
    assert.ok(w.heat[i] >= 0 && w.m[i] > 0);
  }
  return after;
}

test("a hard hit fractures before fusing, even with perfect bounciness, and pays for the blast", () => {
  const w = make({ fuse: "always" });
  w.place(500, 500, 1, 10, 2, 40); w.place(500.95, 500, 2, -10, 2, 10);
  const before = w.stats();
  w.step(1 / 600);
  const after = books(w, before);
  assert.ok(after.fractured > 0 && after.breakWork > 0);
  assert.equal(after.fused, 0);
  assert.equal(after.count, before.count + after.fragments);
  assert.equal(after.placed, 2, "fragments are not hand placements");
});

test("gentle contact, strong material and the off switch do not fracture", () => {
  for (const set of [{ speed: 0.1 }, { speed: 10, toughness: 1e9 }, { speed: 10, breaking: false }]) {
    const w = make(set);
    w.place(500, 500, 1, set.speed, 0, 40); w.place(500.95, 500, 2, -set.speed, 0, 10);
    const before = w.stats(); w.step(1 / 600);
    assert.equal(books(w, before).fragments, 0);
  }
});

test("a small projectile chips a trillion-mass body without removing the body", () => {
  const w = make();
  const giant = w.place(500, 500, 1, 0, 0, 1e12);
  w.place(500.95, 500, 2, -20, 0, 1);
  const before = w.stats(); w.step(1 / 600);
  const after = books(w, before);
  assert.equal(after.fractured, 1);
  assert.equal(after.mass, before.mass);
  assert.ok(w.m[giant] > 1e12 * 0.99 && w.m[giant] < 1e12);
});

test("repeated fracture, thermal shedding and re-fusing keep the same books", () => {
  const preset = Physics.PRESETS.find(p => p.id === "break");
  const w = Physics.create({ ...preset.set, radiate: 0, limit: 1e6 });
  const before = w.stats();
  for (let f = 0; f < 300; f++) w.step(1 / 60);
  const after = books(w, before);
  assert.ok(after.fractured > 0 && after.shed > 0 && after.fused > 0);
  assert.equal(after.count + after.fused, before.count + after.fragments);
});

test("heat gradually sheds pieces while keeping mass, momentum and energy", () => {
  const w = make();
  const i = w.place(500, 500, 3, 3, -2, 100);
  w.edit(i, { temperature: 100 });
  const before = w.stats();
  for (let f = 0; f < 20; f++) w.step(0.05);
  const after = books(w, before);
  assert.ok(after.shed > 1 && after.temperature < before.temperature);
  assert.equal(after.fractured, 0);
  assert.ok(after.count < 100, "shedding is not an instant conversion into dust");
  for (let j = 0; j < w.n; j++) if (w.alive[j]) {
    assert.ok(w.m[j] >= w.settings.fragmentMass - 1e-10);
    assert.equal(w.kind[j], 3, "pieces inherit their material's kind");
  }
});

test("a mildly hot body can accumulate a chip across short substeps", () => {
  const w = make({ toughness: 8 });
  const i = w.place(500, 500, 1, 0, 0, 100); w.edit(i, { temperature: 21 });
  w.step(1 / 60); assert.equal(w.stats().fragments, 0);
  for (let f = 0; f < 120; f++) w.step(1 / 60);
  assert.ok(w.stats().shed > 0);
});

test("temperature, not total heat or size, decides thermal breakup; pinned bodies stay whole", () => {
  for (const mass of [10, 1e12]) {
    const w = make(); const i = w.place(500, 500, 1, 0, 0, mass);
    w.edit(i, { temperature: 10 });
    for (let f = 0; f < 30; f++) w.step(1 / 30);
    assert.equal(w.stats().fragments, 0);
    assert.equal(w.m[i], mass);
    w.edit(i, { temperature: 100, pinned: true });
    w.step(1); assert.equal(w.stats().fragments, 0);
    w.edit(i, { pinned: false });
    const before = w.stats(); w.step(0.05);
    assert.ok(books(w, before).shed > 0, "the hot unpinned body can shed even at a trillion mass");
  }
  const w = make({ fragmentMass: 60 });
  const i = w.place(500, 500, 1, 0, 0, 100); w.edit(i, { temperature: 100 });
  w.step(1); assert.equal(w.stats().fragments, 0);
});

test("breaking a bonded body pays for its external bonds as well", () => {
  const w = make({ breaking: false, bonding: "any", bondChance: 1, bondStrength: 8 });
  const a = w.place(500, 500, 1, 0, 0, 40), b = w.place(501, 500, 1, 0, 0, 40);
  for (let f = 0; f < 30 && !w.bonds.size; f++) w.step(1 / 60);
  assert.equal(w.bonds.size, 1);
  w.set("breaking", true); w.edit(a, { temperature: 100 }); w.edit(b, { temperature: 100 });
  const before = w.stats(); w.step(1 / 60);
  const after = books(w, before);
  assert.ok(after.fragments > 0 && after.bondsBroken > 0);
});

test("a full world defers breakup without losing anything, then reuses a free slot", () => {
  const w = make();
  const i = w.place(500, 500, 1, 0, 0, 100); w.edit(i, { temperature: 100 });
  for (let j = 1; j < w.cap; j++) w.place(2 + j % 100 * 2, 2 + Math.floor(j / 100) * 2, 1);
  const before = w.stats(); w.step(0.1);
  const full = books(w, before);
  assert.ok(full.fragmentLimit); assert.equal(full.fragments, 0);
  w.remove(1); const freed = w.stats(); w.step(0.1);
  const after = books(w, freed);
  assert.equal(after.count, w.cap); assert.equal(after.shed, 1);
  assert.ok(w.alive[1] && w.m[1] > 1);
});

test("breakup is seeded and reproducible, and its controls survive shared links", () => {
  const set = { startTemp: 70, bigMass: 100, count: 1, layout: "sun", sized: false,
    toughness: 2.123456, meltTemp: 19.25, fragmentMass: 0.625 };
  const linked = Object.fromEntries(new URLSearchParams(set));
  assert.deepEqual(Physics.clean(linked), Physics.clean(set));
  const a = Physics.create(set), b = Physics.create(linked);
  for (let f = 0; f < 30; f++) { a.step(1 / 60); b.step(1 / 60); }
  assert.deepEqual(a.stats(), b.stats()); assert.deepEqual(a.x, b.x);
});
