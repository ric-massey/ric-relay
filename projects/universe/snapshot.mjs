// snapshot.mjs -- freeze a Lab run to disk so the viewer can read it.
//
// This file runs the Lab and writes what the world LOOKED LIKE when the event
// budget ran out. It is a reader, not a law: it imports lab.mjs and
// constants.mjs and changes neither, and it computes nothing the viewer could
// not compute itself from the same arrays.
//
// Rules this file is standing under:
//
//   rule 2   nothing stored that should emerge. The written file carries the
//            world arrays -- the five of the word, and since 2026-11-06 the
//            tracked position inside each hexagon -- and NOTHING derived -- no cluster ids, no
//            species, no temperature field. The viewer derives all of that on
//            the fly, the same way lab.mjs does.
//   rule 8   no physics number lives here. The run settings below (how full
//            the world starts, how many events, which seed) are not physics;
//            they are the same experiment settings lab-check.mjs types out for
//            its own checks, and they are exposed as flags so nothing is
//            hidden in a default.
//   rule 11  a run is one seed. The file records its seed, so a figure read
//            off the viewer can be reproduced and nothing in the viewer can be
//            mistaken for a result that survived a seed change.
//
// THE CONSTANTS ARE CANDIDATE_ZERO AND THAT IS NOT A CHOSEN PHYSICS. It is the
// plumbing test point -- the slate the engine runs on before the search has
// picked anything. Every number in a written snapshot is therefore a number
// from an arbitrary point in the search space, and the viewer says so on its
// face. README item 31 is the live reason to distrust any chemistry figure read
// off a run at all, including these.
//
// Two slots, because that is what gets compared in practice:
//
//   runs/current.bin + .json    the run that just finished
//   runs/last.bin    + .json    whatever `current` was before it
//
// Writing a new run rotates the old one back. Nothing older is kept.
//
// Usage:
//   node snapshot.mjs                                  default run
//   node snapshot.mjs --events 400000 --seed 21        a longer run, named seed
//   node snapshot.mjs --hot 6 --label "held at 6"      with the thermostat band
//   node snapshot.mjs --fill 0.2 --momentum 0          a thin, still world
//   node snapshot.mjs --to last                        write the `last` slot

import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Lab, census, N, CELLS, neighbour, at, qOf, rOf, DIR_AXIAL } from "./lab.mjs";
import { CANDIDATE_ZERO, SETTLED, MOMENTUM_RANGE, KE_SCALE_WINDOW, LAB,
         THERMOSTAT_DEFAULT, capacityOf } from "./constants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = join(HERE, "runs");

// --------------------------------------------------------------- the flags
// Defaults match lab-check.mjs's own runs, so a default snapshot is the same
// experiment its checks pass on rather than a new one invented here.
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? fallback : argv[i + 1];
};
const num = (name, fallback) => {
  const v = flag(name, null);
  if (v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} wants a number, got "${v}"`);
  return n;
};

const RUN = {
  events:       num("events", 200000),
  seed:         num("seed", 7),
  fill:         num("fill", 0.35),
  momentumRange: num("momentum", 6),
  hot:          flag("hot", null) === null ? null : num("hot", 0),
  label:        flag("label", null),
  slot:         flag("to", "current"),
};

if (RUN.slot !== "current" && RUN.slot !== "last") {
  throw new Error(`--to wants "current" or "last", got "${RUN.slot}"`);
}

// ----------------------------------------------------------------- the run
// The thermostat is the Lab's held band. With --hot absent the run uses the
// engine's own default; with --hot T the band is held at T, which is how
// item 25 and item 31 were measured.
const thermostat = RUN.hot === null
  ? THERMOSTAT_DEFAULT
  : { ...THERMOSTAT_DEFAULT, HOT_T: RUN.hot };

const started = Date.now();
const lab = new Lab({ constants: CANDIDATE_ZERO, thermostat, seed: RUN.seed });
lab.seedWorld(RUN.fill, (rng) => 1 + rng.below(255), { momentumRange: RUN.momentumRange });
const seeded = census(lab.w);
const out = lab.run(RUN.events);
const after = census(lab.w);
const elapsed = Date.now() - started;

// -------------------------------------------------------------- the bytes
// Layout, little-endian, CELLS = N * N hexagons in axial order i = r * N + q:
//
//   [0]                kind    Uint8   * CELLS     0 = not matter
//   [CELLS]            energy  Uint16  * CELLS     heat, matter only
//   [CELLS * 3]        mx      Int8    * CELLS     momentum, cube x
//   [CELLS * 4]        my      Int8    * CELLS     momentum, cube y;  z = -x-y
//   [CELLS * 5]        bonds   Uint8   * CELLS     matter: neighbour bits
//                                                  vacuum: in-flight slots
//
// Six bytes per hexagon rather than the world's eight: the word's 24 reserved
// bits are not stored because nothing is in them. This is a transport format
// for a viewer, not a claim about the word.
const w = lab.w;
// Six bytes of the word, then the tracked position inside each hexagon
// (README item 34) as two float32s -- ample for a picture, and the run's own
// arithmetic stays in the engine's float64.
const bin = Buffer.alloc(CELLS * 14);
Buffer.from(w.kind.buffer, w.kind.byteOffset, CELLS).copy(bin, 0);
Buffer.from(w.energy.buffer, w.energy.byteOffset, CELLS * 2).copy(bin, CELLS);
Buffer.from(w.mx.buffer, w.mx.byteOffset, CELLS).copy(bin, CELLS * 3);
Buffer.from(w.my.buffer, w.my.byteOffset, CELLS).copy(bin, CELLS * 4);
Buffer.from(w.bonds.buffer, w.bonds.byteOffset, CELLS).copy(bin, CELLS * 5);
Buffer.from(Float32Array.from(w.ox).buffer).copy(bin, CELLS * 6);
Buffer.from(Float32Array.from(w.oy).buffer).copy(bin, CELLS * 10);

// --------------------------------------------------------------- the space
// WHAT SHAPE THIS RUN IS, MEASURED FROM THE ENGINE RATHER THAN ASSERTED HERE.
//
// A viewer that knows "the Lab is a torus" because someone typed it will draw
// a torus for a run that is not one. The Lab wraps both axes; README item 22
// has the World possibly looping only left-right, which keeps a floor and a
// ceiling and is a cylinder, not a torus -- and that question is open. So the
// file says which axes wrap, and it finds out by asking the engine's own
// neighbour function what lies west of the west edge.
//
// The test: step off the q = 0 edge going west. If the engine wraps that axis
// the answer is q = N-1. Anything else -- an edge, a clamp, a refusal -- is
// not a wrap. Same going north off r = 0.
function probeWraps() {
  const west = DIR_AXIAL.findIndex(([dq, dr]) => dq === -1 && dr === 0);
  const north = DIR_AXIAL.findIndex(([dq, dr]) => dq === 0 && dr === -1);
  const probe = (q, r, d, read, want) => {
    try {
      const j = neighbour(at(q, r), d);
      return typeof j === "number" && j >= 0 && read(j) === want;
    } catch { return false; }
  };
  return [
    probe(0, 1, west, qOf, N - 1),    // does q loop?
    probe(1, 0, north, rOf, N - 1),   // does r loop?
  ];
}
const wraps = probeWraps();

// -------------------------------------------------------------- the engine
// WHICH ENGINE WROTE THIS. A snapshot is a photograph of a run, and the Lab
// changes daily -- GAP 3's reading changed twice on 2026-11-06 alone, and each
// time every run already on disk became a picture of an engine that no longer
// exists. Nothing in the file said so, which made a stale run indistinguishable
// from a fresh one.
//
// A hash of the two files the physics lives in is enough: the viewer hashes
// the same two files where it is served and says plainly whether they match.
// It is not a version number anybody has to remember to raise.
const digest = (f) => createHash("sha256")
  .update(readFileSync(join(HERE, f))).digest("hex").slice(0, 12);
const engine = { lab: digest("lab.mjs"), constants: digest("constants.mjs") };

// -------------------------------------------------------------- the header
const header = {
  engine,
  format: "universe-lab-snapshot/1",
  warning: "CANDIDATE_ZERO is the plumbing test point, not a chosen physics. "
         + "Every number in this run comes from an arbitrary point in the search "
         + "space, and README item 31 is the standing reason to distrust any "
         + "chemistry figure read off a run.",
  written: new Date().toISOString(),
  label: RUN.label,
  slot: RUN.slot,

  // THE SPACE. This is what the map draws from, and nothing else: a viewer
  // that recognises `lattice` and reads `size` and `wraps` draws this run
  // correctly without knowing which engine produced it, and one that does not
  // recognise the lattice should say so rather than fall back on a guess.
  //
  //   lattice  how the cells are arranged and indexed
  //   size     [cols, rows] at the END of the run, which is what the bytes are
  //   sizeAtStart  present only when the run changed size, so a growing World
  //            can be read as having grown; absent means it did not
  //   wraps    [q, r] -- measured, see probeWraps()
  //
  // Both axes wrapping is a torus. One is a cylinder, with a real boundary at
  // the other two edges. Neither is a bounded patch. The Lab is the first;
  // README item 22 has not settled which the World will be.
  space: {
    lattice: "hex-axial-pointy",
    size: [N, N],
    wraps,
    indexing: "i = r * cols + q",
    note: wraps[0] && wraps[1] ? "hexagonal torus -- no edge in either direction"
        : wraps[0] || wraps[1] ? "cylinder -- one looping axis, a boundary on the other"
        : "bounded patch -- edges in both directions",
  },

  // the world
  N, cells: CELLS,
  torus: wraps[0] && wraps[1],
  layout: [
    { field: "kind",   type: "u8",  offset: 0 },
    { field: "energy", type: "u16", offset: CELLS },
    { field: "mx",     type: "i8",  offset: CELLS * 3 },
    { field: "my",     type: "i8",  offset: CELLS * 4 },
    { field: "bonds",  type: "u8",  offset: CELLS * 5 },
    { field: "ox",     type: "f32", offset: CELLS * 6 },    // tracked position, cartesian,
    { field: "oy",     type: "f32", offset: CELLS * 10 },   // in spacings from the centre
  ],

  // the run
  run: {
    seed: RUN.seed,
    events: out.events,
    budget: RUN.events,
    clock: out.now,
    fill: RUN.fill,
    momentumRange: RUN.momentumRange,
    thermostat,
    wallMs: elapsed,
    eventsPerSecond: Math.round(out.events / (elapsed / 1000)),
    stillBeforeBudget: out.events < RUN.events,
  },

  // what the engine counted. Straight off lab.mjs -- not re-derived here.
  counts: lab.counts,

  // the books, at the start and at the end. census() is lab.mjs's own.
  census: { seeded, final: after },

  // the physics the run stood on, so a figure can never be read without it
  constants: {
    settled: SETTLED,
    searched: CANDIDATE_ZERO,
    momentumRange: MOMENTUM_RANGE,
    keScaleWindow: KE_SCALE_WINDOW,
    lab: LAB,
    capacityByValence: Array.from({ length: 8 }, (_, v) => capacityOf(v, SETTLED)),
  },
};

// --------------------------------------------------------------- the write
mkdirSync(RUNS, { recursive: true });

// Rotate, only when writing `current`, and only when there is something to
// rotate. A failed run must not be able to destroy the pair.
if (RUN.slot === "current" && existsSync(join(RUNS, "current.bin"))) {
  for (const ext of ["bin", "json"]) {
    const from = join(RUNS, "current." + ext);
    if (!existsSync(from)) continue;
    const prev = JSON.parse(readFileSync(join(RUNS, "current.json"), "utf8"));
    prev.slot = "last";
    if (ext === "json") writeFileSync(join(RUNS, "last.json"), JSON.stringify(prev, null, 2));
    else renameSync(from, join(RUNS, "last.bin"));
  }
}

writeFileSync(join(RUNS, RUN.slot + ".bin"), bin);
writeFileSync(join(RUNS, RUN.slot + ".json"), JSON.stringify(header, null, 2));

// ---------------------------------------------------------------- the word
const mb = (bin.length / 1048576).toFixed(2);
console.log(`wrote runs/${RUN.slot}.bin  ${mb} MB   runs/${RUN.slot}.json`);
console.log(`  ${out.events.toLocaleString()} events, seed ${RUN.seed}, `
  + `${elapsed} ms (${header.run.eventsPerSecond.toLocaleString()}/s)`);
console.log(`  ${(after.bondBits / 2).toLocaleString()} standing bonds, `
  + `heat ${after.heat.toLocaleString()}, net momentum (${after.pxSum}, ${after.pySum})`);
if (RUN.slot === "current") console.log("  previous current rotated to runs/last.*");
