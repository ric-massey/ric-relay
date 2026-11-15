/* The Lab (2026-11-14, Ric: "a hexagon grid pops up. You place the
   hexagons, choose the rules … and the properties of them … so then we can
   test each individual property"). These hold the parts a test can hold:
   kinds typed in are obeyed exactly, a setup is built exactly as drawn, the
   control is the same hexagons loose, anything loaded is checked, and an
   experiment reports what it says it does. The page itself (lab.html,
   lab.js) was checked by hand in a browser on the day. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Physics = require("../physics.js");
const Lab = require("../lab-core.js");
const run = (w, seconds) => { for (let f = 0; f < seconds * 60; f++) w.step(1 / 60); };

/* Three kinds: 1 holds one bond, 2 holds two, 3 holds one. 1 and 3 never
   bond with each other. Shapes: 2 is straight. */
function kinds() {
  return [
    { valence: 1, pull: 0.2, mass: 1, shape: "any", bonds: [3, 4, 0] },
    { valence: 2, pull: 0.5, mass: 2, shape: "straight", bonds: [4, 0, 4] },
    { valence: 1, pull: 0.9, mass: 1, shape: "any", bonds: [0, 4, 3] },
  ];
}

test("without kinds of its own, a world is the world it was", () => {
  const set = { layout: "cloud", count: 300, size: 40, kinds: 5, bonding: "sum", maxBonds: 3, startTemp: 1, shake: 0.4 };
  const a = Physics.create(set), b = Physics.create(Object.assign({}, set, { kindsDef: null }));
  run(a, 5); run(b, 5);
  for (let i = 0; i < a.n; i++) assert.equal(a.x[i], b.x[i]);
});

test("kinds typed in are obeyed: bonds held, who bonds with whom, and shape", () => {
  const w = Physics.create({ layout: "empty", size: 24, edge: "wrap", sized: false, bonding: "any", angles: 0.6,
    settle: true, startTemp: 0.6, shake: 0.4, conduct: 0.4, radiate: 0, kindsDef: kinds() });
  let s = 5;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let q = 0; q < 240; q++) w.place(rand() * 24, rand() * 24, 1 + (q % 3), 0, 0, 1);
  run(w, 20);
  assert.ok(w.stats().bonds > 20, "almost nothing bonded");
  for (let i = 0; i < w.n; i++) if (w.alive[i]) assert.ok(w.nb[i] <= [1, 2, 1][w.kind[i] - 1], `kind ${w.kind[i]} holds ${w.nb[i]}`);
  for (const bd of w.bonds.values()) {
    const pair = [w.kind[bd.a], w.kind[bd.b]].sort().join("");
    assert.ok(pair !== "13" && pair !== "22", `kinds ${pair} bonded, and the table says never`);
  }
  /* Kind 2 is straight: its two bonds sit in opposite slots. */
  for (let i = 0; i < w.n; i++) if (w.alive[i] && w.kind[i] === 2 && w.nb[i] === 2) {
    const used = []; for (let t = 0; t < 6; t++) if (w.slots[i * 6 + t] >= 0) used.push(t);
    assert.equal((used[1] - used[0]) % 6, 3, "kind 2 should be straight");
  }
});

test("a setup is built exactly as drawn, and its control is the same hexagons loose", () => {
  const raw = Lab.blank();
  raw.kinds = kinds();
  raw.cells.push([5, 5, 1, 1], [6, 5, 2, 0], [7, 5, 3, 0], [12, 12, 1, 0]);
  raw.bonds.push([0, 1], [1, 2]);
  const setup = Lab.clean(Physics, raw);
  const built = Lab.build(Physics, setup, { seed: 2 });
  assert.equal(built.failed, 0);
  assert.equal(built.world.stats().bonds, 2);
  assert.equal(built.world.pinned[built.ids[0]], 1);
  const [x, y] = Lab.cellXY(6, 5);
  assert.ok(Math.abs(built.world.x[built.ids[1]] - x) < 1e-12 && Math.abs(built.world.y[built.ids[1]] - y) < 1e-12);
  assert.deepEqual([...Lab.tally(built.world)], [["1-2-3", 1]]);
  const control = Lab.build(Physics, setup, { seed: 2, control: true }).world;
  assert.equal(control.stats().bonds, 0, "the control starts with nothing bonded");
  assert.equal(control.stats().count, 4);
  const kindsIn = w => { const k = []; for (let i = 0; i < w.n; i++) if (w.alive[i]) k.push(w.kind[i]); return k.sort().join(); };
  assert.equal(kindsIn(control), kindsIn(built.world), "the control holds the same hexagons");
  for (let i = 0; i < control.n; i++) assert.equal(control.pinned[i], 0, "nothing is pinned in the control");
});

test("anything loaded is checked before it is used", () => {
  const junk = {
    name: 12, kinds: [{ valence: 99, pull: -3, mass: 0, shape: "spiral", bonds: ["x", 2e9] }],
    rules: { size: 24, gravity: 5, layout: "sun", kinds: 40, "<script>": 1 },
    cells: [[1, 1, 1, 0], [1, 1, 1, 0], [999, 1, 1, 0], [2, 1, 7, 0], "nope", [2, 1, 1, 1], [5, 5, 1, 0]],
    bonds: [[0, 1], [0, 5], [0, 6], [0, 99], "x"],
  };
  const s = Lab.clean(Physics, junk);
  assert.equal(s.name, "Untitled");
  assert.deepEqual(s.kinds[0], { valence: 6, pull: 0, mass: 0.1, shape: "any", bonds: [0] });
  assert.equal(s.rules.gravity, 5);
  assert.ok(!("layout" in s.rules) && !("kinds" in s.rules) && !("<script>" in s.rules));
  assert.deepEqual(s.cells, [[1, 1, 1, 0], [2, 1, 1, 1], [5, 5, 1, 0]], "duplicates, off-grid cells and unknown kinds dropped");
  assert.deepEqual(s.bonds, [[0, 1]], "only bonds between kept neighbours survive");
});

test("an experiment runs the setup, its control, and each rule off in turn", () => {
  const raw = Lab.blank();
  raw.kinds = kinds();
  raw.cells.push([5, 5, 1, 0], [6, 5, 2, 0], [7, 5, 3, 0]);
  raw.bonds.push([0, 1], [1, 2]);
  for (let q = 0; q < 30; q++) raw.cells.push([2 + (q % 10) * 2, 10 + Math.floor(q / 10) * 3, 1 + (q % 3), 0]);
  const setup = Lab.clean(Physics, raw);
  let ticks = 0;
  const res = Lab.experiment(Physics, setup, { seconds: 5, runs: 2, oneAtATime: true }, () => ticks++);
  const on = Lab.switchedOn(setup.rules);
  assert.ok(on.includes("settle") && on.includes("angles"));
  assert.equal(res.results.length, 1 + on.length);
  assert.equal(ticks, 2 * (res.results.length + 1), "progress after every world");
  assert.equal(res.results[0].rows[0].sig, "1-2-3");
  assert.equal(res.results[0].rows[0].start, 1);
  assert.ok(["no copying", "a difference"].includes(res.verdict.word));
});
