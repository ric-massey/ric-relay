// world-stream.mjs -- run the World on this machine and watch it from
// somewhere else, live. Not part of the engine: it owns no physics and
// changes none.
//
// Ric, 2026-11-07: "can you make it so it can be streamed from my pc to my
// website?"
//
// WHY IT WORKS THE WAY IT DOES. The website is static -- GitHub Pages, a
// CNAME, no server -- and this PC is behind a home router, so the site cannot
// reach in. The traffic has to go the other way: this process PUSHES frames
// somewhere the site can read. The repo already does exactly that for CS
// replays (worker.mjs, /cs/replay), so this follows that path rather than
// inventing a second one:
//
//     node world-stream.mjs            the World runs here, in this process
//              |
//              |  (1) http://<this machine>:8787      same wifi, no account,
//              |      the viewer, straight off this    nothing in the middle
//              |      process. Phone on the LAN works.
//              |
//              `> (2) PUT /universe/live.{json,bin}   anywhere in the world
//                     on the Worker, with the site     through the Worker's R2
//                     password as a Bearer token.      bucket. The site GETs it.
//
// Path 1 needs nothing but this command. Path 2 needs --push and the token,
// and only then does anything leave this machine. The default is local only.
//
// WHAT A FRAME IS. The same six bytes per hexagon that snapshot.mjs writes, in
// the same order, with a header that declares the space the way snapshot.mjs
// does -- so the viewer reads a live frame with the code it already has, and a
// frame can be saved to disk and opened later as an ordinary run. It is a
// transport format for a picture, not a claim about the word.
//
// Usage:
//   node world-stream.mjs                           local, 258x258, port 8787
//   node world-stream.mjs --size 150 --every 2       smaller, a frame every 2 ticks
//   node world-stream.mjs --temp0 9 --p0 6           start it hot and moving
//   node world-stream.mjs --push https://training-log.rmbuster82.workers.dev/universe
//   node world-stream.mjs --host 127.0.0.1           this machine only
//   node world-stream.mjs --save runs/world          also write frames to disk
//
// A WORLD THAT IS LEFT RUNNING (2026-11-09). Ric: "i wanted to start a world and
// let it run and check in on it every once in a while with the chance of
// something crazy happening". Four flags, and run-world.cmd passes all of them:
//
//   --keep runs/eternal      the world LIVES in that folder. It is checkpointed
//                            there every few minutes and on Ctrl-C, and the next
//                            start picks the same world up at the same tick,
//                            exactly (world-check.mjs Check 13). Without --keep
//                            a run still dies with the process, as it always did.
//   --lit [rate]             light comes in through the west edge (world.mjs,
//                            receiveAtEdge). A held condition, off by default.
//   --hold [T]               trim the brightness to keep the mean temperature
//                            near T. See "steer" below for why a fixed
//                            brightness is not enough.
//   --yield-to cs2.exe       stand still while that program is running, so the
//                            world does not take a core from a game.
//
// With --keep the run also keeps a JOURNAL (journal.mjs): the firsts and the
// records, written to <keep>/journal.jsonl and carried in every frame, so the
// viewer can say what happened since the last time anyone looked.

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, appendFileSync,
         copyFileSync } from "node:fs";
import { execFile } from "node:child_process";
import os from "node:os";
import { gzipSync } from "node:zlib";
import { join, dirname, extname, resolve, normalize } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { World, census, countMatter, neighbour, qOf, rOf } from "./world.mjs";
import { CANDIDATE_ZERO, INFLOW } from "./constants.mjs";
import { Journal } from "./journal.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const num = (n, d) => { const v = flag(n, null); return v === null ? d : Number(v); };
const has = (n) => argv.includes("--" + n);
// a flag that may stand alone or carry a number: --lit, --lit 0.05
const optional = (n, d) => {
  const i = argv.indexOf("--" + n);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? d : Number(v);
};

const OPT = {
  // the run -- the same dials world-run.mjs has, and they mean the same things
  size:   num("size", 258),
  seed:   num("seed", 1),
  fill:   num("fill", 0.30),
  ticks:  num("ticks", Infinity),       // runs until stopped by default
  // The initial state, added 2026-11-07 for the reason world-run.mjs gives at
  // length: a World seeded at absolute zero bonds before it can fall, so
  // being hot has to be sayable rather than hoped for.
  temp0:  num("temp0", 0),              // energy per unit of kind, at tick 0
  p0:     num("p0", 0),                 // momentum components drawn in +-p0
  max:    num("max", 400000),
  check:  num("check", 200),            // the books, every N ticks

  // the stream
  port:   num("port", 8787),
  host:   flag("host", "0.0.0.0"),
  every:  num("every", 5),              // ticks between frames
  // AND A FLOOR IN WALL TIME. Measured 2026-11-07: a 150x150 World runs at
  // ~250 ticks/s, so "every 3 ticks" asked for 80 frames a second -- each one
  // gzipping 400 KB -- and the run slowed to 158 ticks/s building pictures
  // nobody could see. A frame nobody can perceive costs the run that produced
  // it, so the two rates are separate dials and this is the one that matters.
  minMs:  num("min-ms", 200),           // at most five frames a second
  batch:  num("batch", 1),              // ticks per slice of work; see below

  // pushing to the website
  push:      flag("push", null),
  tokenEnv:  flag("token-env", "UNIVERSE_TOKEN"),
  pushEvery: num("push-every", 10),     // SECONDS between pushes, not ticks
  save:      flag("save", null),        // write each frame to <save>.{json,bin}

  // a world that is left running -- see the top of the file
  keep:          flag("keep", null),                    // the folder the world lives in
  checkpointMin: num("checkpoint-min", 5),              // minutes between checkpoints
  lit:           optional("lit", INFLOW.LONG_RUN.rate), // chance per edge hexagon per tick
  hold:          optional("hold", INFLOW.LONG_RUN.holdT),   // mean temperature to steer toward
  journalEvery:  num("journal-every", 500),             // ticks between the journal's looks
  yieldTo:       (flag("yield-to", "") || "").split(",").map((x) => x.trim()).filter(Boolean),
  low:           has("low"),                            // run at the lowest CPU priority
};
if (OPT.hold !== null && OPT.lit === null) OPT.lit = INFLOW.LONG_RUN.rate;   // holding needs a light
if (OPT.low) { try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch { /* not allowed: run as we are */ } }



// ------------------------------------------------------------- the engine id
// Which engine is producing this. snapshot.mjs hashes lab.mjs and
// constants.mjs for exactly this reason: a frame is a picture of a run, the
// engine changes daily, and nothing in a file says so unless it is put there.
// The two files the World's physics lives in are world.mjs and constants.mjs.
const digest = (f) => createHash("sha256")
  .update(readFileSync(join(HERE, f))).digest("hex").slice(0, 12);
const engine = { world: digest("world.mjs"), constants: digest("constants.mjs") };

// ---------------------------------------------------------------- the world
// EITHER THE ONE THAT WAS LEFT HERE, OR A NEW ONE. With --keep and a checkpoint
// in the folder, the world on disk is picked up exactly where it stopped and
// every run flag that would have shaped a NEW world (size, seed, fill, temp0,
// p0) is ignored, because that world already has them. It is said out loud at
// startup which of the two happened.
const KEEP = OPT.keep ? join(HERE, OPT.keep) : null;
const CK = KEEP ? { json: join(KEEP, "world.json"), bin: join(KEEP, "world.bin"),
                    journal: join(KEEP, "journal.jsonl") } : null;
let world, journal = new Journal(), life;
// `life` is what a kept world knows about itself that is not physics: when it
// was first started, how many times it has been picked up, and the state of
// the brightness steering. It rides in the checkpoint beside the world.
if (CK && existsSync(CK.json) && existsSync(CK.bin)) {
  const meta = JSON.parse(readFileSync(CK.json, "utf8"));
  world = World.restore(meta, new Uint8Array(readFileSync(CK.bin)), { constants: CANDIDATE_ZERO });
  journal = Journal.load(meta.journal);
  life = meta.life;
  life.sessions++;
  life.resumedAtTick = world.tick;
  // THE ENGINE MAY HAVE CHANGED UNDER IT. A checkpoint is a state, and any
  // engine can run a state forward -- but from this tick on it is a different
  // physics, and a record that did not say so would let a week-old structure
  // be credited to laws it never lived under. So it is written into the
  // journal, with both hashes, and the run goes on.
  if (life.engine.world !== engine.world || life.engine.constants !== engine.constants) {
    journal.note(world.tick, "engine", `The engine changed under this world. It was running `
      + `world.mjs ${life.engine.world} / constants.mjs ${life.engine.constants} and continues on `
      + `${engine.world} / ${engine.constants}. Everything before this tick happened under the old one.`,
      { from: life.engine, to: engine });
    life.engineChanges = (life.engineChanges || 0) + 1;
    life.engine = engine;
  }
  journal.note(world.tick, "resumed", `Picked up again at tick ${world.tick.toLocaleString("en-US")}.`);
} else {
  world = new World({
    cols: OPT.size, rows: OPT.size, seed: OPT.seed,
    constants: CANDIDATE_ZERO,
    inflow: OPT.lit !== null ? { rate: OPT.lit, side: INFLOW.LONG_RUN.side } : null,
  });
  world.seed_(OPT.fill, (rng) => 1 + rng.below(255),
              { temp0: OPT.temp0, momentumRange: OPT.p0 });
  life = {
    born: new Date().toISOString(), sessions: 1, resumedAtTick: 0, engine, engineChanges: 0,
    seed: OPT.seed, fill: OPT.fill, temp0: OPT.temp0, p0: OPT.p0,
    hold: OPT.hold !== null ? { target: OPT.hold, integral: OPT.lit ?? INFLOW.LONG_RUN.rate } : null,
  };
  if (CK) {
    journal.note(0, "born", `A new world: ${OPT.size} x ${OPT.size} hexagons, seed ${OPT.seed}, `
      + `${Math.round(OPT.fill * 100)}% matter, seeded at temperature ${OPT.temp0}`
      + (OPT.lit !== null ? `, lit from the west` : `, dark`)
      + (OPT.hold !== null ? ` and held near temperature ${OPT.hold}.` : `.`));
  }
}

// --------------------------------------------------------- steering the light
// WHY A FIXED BRIGHTNESS IS NOT ENOUGH, measured 2026-11-09 on a 64x64 sheet
// over 300,000 ticks at six brightnesses: what the sheet radiates barely
// depends on how hot it is -- 2.13 quanta a tick at temperature 2.5, 2.52 at
// temperature 115. A primitive sheds one quantum when its clock fires, and at
// CANDIDATE_ZERO the clock's rate is flat to a fraction of a percent across
// every temperature a World actually reaches (its slope is set by the hottest
// temperature the energy field could ever hold, 65535, and chemistry lives
// below 8). So there is no temperature at which "out" rises to meet "in": a
// world lit at a fixed rate either cools until it stops or heats until
// nothing can bond, and which one is decided by a few percent of brightness.
// That is a finding about the clock and it is in README as an open item. Until
// it is settled, a world that is meant to go on being interesting has to have
// its brightness trimmed, and this is that trim.
//
// IT IS A HELD CONDITION, the same kind of thing the Lab's thermostat is --
// but it acts only through the light at the edge, never by setting a
// temperature anywhere. Every INFLOW.HOLD.EVERY ticks it reads the sheet's
// mean temperature and sets the edge's rate to a slowly-learned base plus a
// push proportional to how far off the target the sheet is. It runs at fixed
// ticks from saved state, so a resumed world steers exactly as it would have.
function steer() {
  const h = life.hold;
  if (!h) return;
  const c = census(world.w);
  const T = c.matter ? c.heat / c.matter : 0;
  const err = h.target - T;
  h.integral = Math.min(INFLOW.RATE[1], Math.max(INFLOW.RATE[0], h.integral + INFLOW.HOLD.KI * err));
  const rate = Math.min(INFLOW.RATE[1], Math.max(INFLOW.RATE[0], h.integral + INFLOW.HOLD.KP * err));
  h.reading = T; h.rate = rate;
  world.setInflow(rate > 0 ? { rate, side: INFLOW.LONG_RUN.side } : null);
}

// ------------------------------------------------------------ the journal
const TREND_MAX = 360;      // points kept; a drawing's resolution, not physics
let lastLook = null;
function look() {
  const { fresh, now } = journal.observe(world);
  lastLook = now;
  // THE TREND: a few numbers from each look, kept for the whole life of the
  // world so the viewer can draw what it has been doing and not only what it
  // is doing. It never grows past TREND_MAX points: when it fills, every
  // other point is dropped and the stride doubles, so a week and an hour are
  // both a few hundred points and the old end simply gets coarser.
  const tr = life.trend || (life.trend = { stride: 1, points: [] });
  if (journal.looks % tr.stride === 0) {
    tr.points.push([now.tick, +now.meanTemp.toFixed(3), +now.bondedFraction.toFixed(4), now.largest, now.sorts]);
    if (tr.points.length > TREND_MAX) { tr.points = tr.points.filter((_, i) => i % 2 === 1); tr.stride *= 2; }
  }
  if (CK && fresh.length) {
    appendFileSync(CK.journal, fresh.map((e) => JSON.stringify(e)).join("\n") + "\n");
    for (const e of fresh) console.log(`  [tick ${e.tick.toLocaleString("en-US")}] ${e.text}`);
  }
}

// ---------------------------------------------------------- the checkpoint
// Written whole to a .tmp and renamed, with the previous one kept as .prev, so
// a power cut during a write costs at most a few minutes and never the world.
// Only ever taken straight after the books have closed at this exact tick: a
// state that does not balance is not saved over one that does.
let lastCheckpoint = { tick: null, at: null }, lastCheckpointMs = Date.now();
function writeCheckpoint() {
  if (!CK) return;
  mkdirSync(KEEP, { recursive: true });
  const { meta, bytes } = world.checkpoint();
  meta.life = life; meta.journal = journal.save(); meta.written = new Date().toISOString();
  writeFileSync(CK.bin + ".tmp", bytes);
  writeFileSync(CK.json + ".tmp", JSON.stringify(meta));
  if (existsSync(CK.json) && existsSync(CK.bin)) {
    copyFileSync(CK.bin, CK.bin + ".prev"); copyFileSync(CK.json, CK.json + ".prev");
  }
  renameSync(CK.bin + ".tmp", CK.bin);
  renameSync(CK.json + ".tmp", CK.json);
  lastCheckpoint = { tick: world.tick, at: meta.written };
  lastCheckpointMs = Date.now();
}

// ------------------------------------------------------- standing aside
// --yield-to: while any of the named programs is running, the world does not
// tick. It still answers the viewer, and says why it is still.
let paused = null;
function checkYield() {
  if (!OPT.yieldTo.length || process.platform !== "win32") return;
  execFile("tasklist", ["/FO", "CSV", "/NH"], { windowsHide: true }, (err, out) => {
    if (err) return;
    const running = out.toLowerCase();
    const hit = OPT.yieldTo.find((name) => running.includes(`"${name.toLowerCase()}"`));
    paused = hit ? `standing still while ${hit} is running` : null;
  });
}
if (OPT.yieldTo.length) { checkYield(); setInterval(checkYield, 15000).unref(); }

// WHICH AXES ACTUALLY WRAP, asked of the engine rather than asserted here.
// Ric, 2026-11-07, on the map: "it needs to be an accurate representation of
// exactly what the run is showing." A viewer that knows "the World is a torus"
// because someone typed it will draw a torus for a run that is not one. So the
// frame says which axes wrap, measured by stepping off an edge and seeing where
// the engine's own neighbour function lands. README item 22 has the World's
// shape open, and when it changes this measurement changes with it.
function probeWraps() {
  const w = world.w;
  // Step west off q = 0, and north off r = 0. If the engine wraps that axis
  // the answer is the far edge; an edge, a clamp or a throw is not a wrap.
  const axis = [
    { step: [-1, 0], from: [0, 1], read: qOf, want: w.cols - 1 },   // does q loop?
    { step: [0, -1], from: [1, 0], read: rOf, want: w.rows - 1 },   // does r loop?
  ];
  return axis.map(({ step, from, read, want }) => {
    const d = directionOf(step);
    if (d < 0) return false;
    try {
      const j = neighbour(w, from[1] * w.cols + from[0], d);
      return typeof j === "number" && j >= 0 && read(w, j) === want;
    } catch { return false; }
  });
}
// world.mjs keeps DIR_AXIAL for itself, so the direction is found by what it
// does rather than by an index copied over here -- an index that drifted would
// silently probe the wrong edge.
function directionOf([dq, dr]) {
  const w = world.w;
  const i = 3 * w.cols + 3;                          // away from every edge
  for (let d = 0; d < 6; d++) {
    const j = neighbour(w, i, d);
    if (qOf(w, j) === 3 + dq && rOf(w, j) === 3 + dr) return d;
  }
  return -1;
}
const wraps = probeWraps();

// ----------------------------------------------------------------- the frame
// Six bytes per hexagon, the same layout and the same order snapshot.mjs
// writes, so the viewer needs no second reader and a saved frame is an
// ordinary run file.
function frameBytes() {
  const w = world.w, cells = w.cells;
  const bin = Buffer.alloc(cells * 6);
  Buffer.from(w.kind.buffer, w.kind.byteOffset, cells).copy(bin, 0);
  Buffer.from(w.energy.buffer, w.energy.byteOffset, cells * 2).copy(bin, cells);
  Buffer.from(w.mx.buffer, w.mx.byteOffset, cells).copy(bin, cells * 3);
  Buffer.from(w.my.buffer, w.my.byteOffset, cells).copy(bin, cells * 4);
  Buffer.from(w.bonds.buffer, w.bonds.byteOffset, cells).copy(bin, cells * 5);
  return bin;
}

const started = Date.now();
let ticksAtLastFrame = 0, lastFrameAt = started, ticksPerSecond = 0;

function frameHeader() {
  const w = world.w, cells = w.cells, c = census(w);
  const row = world.history[world.history.length - 1] || null;
  return {
    engine,
    format: "universe-world-frame/1",
    kind: "world",
    warning: "A LIVE FRAME FROM A RUNNING WORLD: a bounded sheet with four laws, no "
      + "gravity and no expansion, as of 2026-11-08 -- one hexagon is one atom, and at "
      + "that scale gravity is 10^-24 of a single bond (README items 20, 22, 37). "
      + "CANDIDATE_ZERO is the plumbing test point, not a chosen physics. Nothing read "
      + "off this is a result.",
    written: new Date().toISOString(),
    label: `World, live -- tick ${world.tick}`,
    slot: "live",

    // THE SPACE, which is the only thing the map draws from.
    space: {
      lattice: "hex-axial-pointy",
      size: [w.cols, w.rows],
      wraps,
      indexing: "i = r * cols + q",
      // Measured by asking the engine where its own edges lead, not asserted.
      // Since 2026-11-08 the World is bounded, so this reads false twice and
      // the map draws a sheet with edges -- which is what the run now is. It
      // stays a measurement rather than a constant because the shape is still
      // README item 22's open question.
      note: wraps[0] && wraps[1] ? "hexagonal torus -- no edge in either direction"
          : wraps[0] || wraps[1] ? "cylinder -- one looping axis, a boundary on the other"
          : "bounded sheet -- edges in both directions, and light leaves through them",
    },

    // the old square-world fields, kept so an older viewer still opens this.
    // N is honest only while the world is square, and it says so when it is not.
    N: w.cols === w.rows ? w.cols : null,
    cells,
    torus: wraps[0] && wraps[1],
    layout: [
      { field: "kind",   type: "u8",  offset: 0 },
      { field: "energy", type: "u16", offset: cells },
      { field: "mx",     type: "i8",  offset: cells * 3 },
      { field: "my",     type: "i8",  offset: cells * 4 },
      { field: "bonds",  type: "u8",  offset: cells * 5 },
    ],

    // what is live about it
    live: {
      tick: world.tick,
      ticksPerSecond: Math.round(ticksPerSecond * 10) / 10,
      runningForMs: Date.now() - started,
      ticksRequested: OPT.ticks === Infinity ? null : OPT.ticks,
      stopped,
      frameEvery: OPT.every,
    },

    // A world that is left running: when it began, what holds it, what it has
    // done. null for an ordinary run, and the viewer shows nothing extra.
    longRun: CK ? {
      born: life.born, sessions: life.sessions, resumedAtTick: life.resumedAtTick,
      engineChanges: life.engineChanges || 0,
      paused,
      checkpoint: lastCheckpoint,
      inflow: world.inflow,
      hold: life.hold ? { target: life.hold.target, reading: life.hold.reading ?? null } : null,
      look: lastLook,
      trend: life.trend ? { fields: ["tick", "meanTemp", "bondedFraction", "largest", "sorts"],
                            points: life.trend.points } : null,
    } : null,
    journal: CK ? journal.entries.slice(-80) : null,

    run: {
      seed: life.seed ?? OPT.seed,
      events: world.tick,                 // the viewer's run line reads this
      ticks: world.tick,
      fill: life.fill ?? OPT.fill,
      temp0: life.temp0 ?? OPT.temp0,
      p0: life.p0 ?? OPT.p0,
      approximations: [
        "ticked time rather than the Lab's event queue (TWO-RUNS.md)",
      ],
    },

    counts: { ...world.counts },
    // The books, with their terms named. A frame that cannot say its energy
    // closed is a picture of nothing in particular.
    books: {
      matter: c.matter, heat: c.heat, kinetic: c.kinetic, inFlight: c.inFlight,
      momentum: [c.px, c.py],
      bondPotential: world.ledger.bondPotential,
      radiatedAway: world.ledger.escaped,
      received: world.ledger.received,
      wall: [world.ledger.wallX, world.ledger.wallY],
      closedAtTick: lastCheckedTick,
      closes: booksClose,
    },
    census: { bonds: c.bonds, bonded: c.bonded, matterCells: countMatter(w) },
    eras: row,
    history: world.history.slice(-120),
  };
}

// ------------------------------------------------------------------- the run
// Node is single-threaded, and the whole point of this file is that something
// else can read the world WHILE it runs. So the ticks go through the event
// loop in slices: a batch of ticks, then a yield, so an HTTP request is
// answered between them rather than after the run finishes. --batch 1 keeps
// the stream smoothest; a bigger batch runs faster and answers slower.
let stopped = false, booksClose = true, lastCheckedTick = 0, lastError = null;
let frame = { header: null, bin: null, json: null, gzJson: null, gzBin: null, at: 0 };
const watchers = new Set();

function buildFrame() {
  world.sample();
  const now = Date.now();
  const dt = (now - lastFrameAt) / 1000;
  if (dt > 0) ticksPerSecond = (world.tick - ticksAtLastFrame) / dt;
  ticksAtLastFrame = world.tick; lastFrameAt = now;

  const header = frameHeader();
  const bin = frameBytes();
  const json = Buffer.from(JSON.stringify(header));
  frame = {
    header, bin, json, at: now,
    gzJson: gzipSync(json), gzBin: gzipSync(bin),
  };
  // Tell anyone listening that there is a new one, with enough in the message
  // to update a readout without fetching the bytes at all.
  const note = JSON.stringify({
    tick: header.live.tick, ticksPerSecond: header.live.ticksPerSecond,
    cells: header.cells, size: header.space.size, eras: header.eras,
    books: header.books, stopped,
  });
  for (const res of watchers) {
    try { res.write(`event: frame\ndata: ${note}\n\n`); } catch { watchers.delete(res); }
  }
  if (OPT.save) saveFrame().catch((e) => console.error("  save failed:", e.message));
}

async function saveFrame() {
  await mkdir(dirname(join(HERE, OPT.save)), { recursive: true });
  await writeFile(join(HERE, OPT.save + ".json"), JSON.stringify(frame.header, null, 2));
  await writeFile(join(HERE, OPT.save + ".bin"), frame.bin);
}

function slice() {
  if (stopped) return;
  if (paused) {                            // --yield-to: answer the viewer, do no work
    if (Date.now() - lastFrameAt >= 5000) buildFrame();
    setTimeout(slice, 1000);
    return;
  }
  try {
    for (let n = 0; n < OPT.batch; n++) {
      world.doTick();
      if (life.hold && world.tick % INFLOW.HOLD.EVERY === 0) steer();
      if (CK && OPT.journalEvery && world.tick % OPT.journalEvery === 0) look();
      if (OPT.check && world.tick % OPT.check === 0) {
        world.ledger.check(world.w, `tick ${world.tick}`);
        lastCheckedTick = world.tick; booksClose = true;
        // straight after the books closed, and only then
        if (CK && Date.now() - lastCheckpointMs >= OPT.checkpointMin * 60000) writeCheckpoint();
      }
      if (world.tick >= OPT.ticks) { stopped = true; break; }
      if (world.tick % OPT.every === 0) break;        // frame time
    }
  } catch (err) {
    // A ledger failure is the most important thing this process can say, so it
    // stops and the frame SAYS SO rather than carrying on looking fine.
    booksClose = false; stopped = true; lastError = err.message;
    console.error(`\n  THE BOOKS DID NOT CLOSE at tick ${world.tick}:\n  ${err.message}\n`);
    // The checkpoint on disk is from BEFORE this and still balances, so the
    // failure can be replayed from it exactly. It is not overwritten.
    if (CK) {
      try {
        const e = journal.note(world.tick, "books", `THE BOOKS DID NOT CLOSE at tick `
          + `${world.tick.toLocaleString("en-US")}: ${err.message.slice(0, 300)} The run has stopped. `
          + `The last checkpoint (tick ${lastCheckpoint.tick ?? "none"}) is from before it and can be replayed.`);
        mkdirSync(KEEP, { recursive: true });
        appendFileSync(CK.journal, JSON.stringify(e) + "\n");
      } catch { /* the console has it */ }
    }
  }
  const due = world.tick % OPT.every === 0 && Date.now() - lastFrameAt >= OPT.minMs;
  if (due || stopped) buildFrame();
  setImmediate(slice);
}

// ---------------------------------------------------------------- the server
const TYPES = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".bin": "application/octet-stream",
  ".md": "text/plain; charset=utf-8", ".svg": "image/svg+xml",
};

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, {
    "content-type": type,
    // Read-only, from a process the user started on purpose, so any origin may
    // read it: that is what lets the page on ricmassey.com show a run that is
    // happening on this machine.
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  });
  res.end(body);
}

function gzipOk(req) { return /\bgzip\b/.test(req.headers["accept-encoding"] || ""); }

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  if (req.method === "OPTIONS") {
    return send(res, 204, "text/plain", "", { "access-control-allow-methods": "GET,OPTIONS" });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "application/json", JSON.stringify({ error: "read only" }));
  }

  if (path === "/frame.json" || path === "/live.json") {
    if (!frame.json) return send(res, 503, "application/json", JSON.stringify({ error: "no frame yet" }));
    return gzipOk(req)
      ? send(res, 200, TYPES[".json"], frame.gzJson, { "content-encoding": "gzip" })
      : send(res, 200, TYPES[".json"], frame.json);
  }
  if (path === "/frame.bin" || path === "/live.bin") {
    if (!frame.bin) return send(res, 503, "application/json", JSON.stringify({ error: "no frame yet" }));
    return gzipOk(req)
      ? send(res, 200, TYPES[".bin"], frame.gzBin, { "content-encoding": "gzip" })
      : send(res, 200, TYPES[".bin"], frame.bin);
  }
  // Server-sent events: the viewer is told when a frame exists instead of
  // asking. One line of JSON per frame, small enough to drive the readouts on
  // its own, so a phone on a slow link can follow the numbers without pulling
  // half a megabyte of hexagons.
  if (path === "/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      connection: "keep-alive",
    });
    res.write(`retry: 2000\n\n`);
    watchers.add(res);
    req.on("close", () => watchers.delete(res));
    return;
  }
  if (path === "/status") {
    return send(res, 200, TYPES[".json"], JSON.stringify({
      running: !stopped, tick: world.tick, ticksPerSecond,
      cells: world.w.cells, size: [world.w.cols, world.w.rows],
      booksClose, lastError, watchers: watchers.size,
      pushing: !!OPT.push, pushedAt: pushedAt, pushError,
      kept: KEEP, paused, checkpoint: lastCheckpoint, inflow: world.inflow,
      hold: life.hold, sessions: life.sessions, born: life.born,
    }, null, 2));
  }

  // Everything else is a file out of this folder, so that opening this port in
  // a browser gives the viewer with no other server running. Read-only, and
  // the path is resolved and checked rather than trusted: ../ must not climb
  // out of the project.
  const rel = path === "/" ? "viewer.html" : decodeURIComponent(path).replace(/^\/+/, "");
  const file = resolve(HERE, normalize(rel));
  if (!file.startsWith(resolve(HERE))) {
    return send(res, 403, "application/json", JSON.stringify({ error: "outside the project" }));
  }
  try {
    const body = await readFile(file);
    return send(res, 200, TYPES[extname(file)] || "application/octet-stream", body);
  } catch {
    return send(res, 404, "application/json", JSON.stringify({ error: "not here" }));
  }
});

// ------------------------------------------------------------- the push path
// Only if asked. The token is read from the environment and never printed,
// never written to a frame, and never sent anywhere but the URL given on the
// command line.
let pushedAt = null, pushError = null, pushTimer = null;

async function pushOnce() {
  if (!frame.json) return;
  const token = process.env[OPT.tokenEnv];
  if (!token) {
    pushError = `${OPT.tokenEnv} is not set in this shell, so nothing is being pushed`;
    return;
  }
  const base = OPT.push.replace(/\/+$/, "");
  const put = async (suffix, body, type) => {
    const r = await fetch(`${base}/live.${suffix}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": type,
        "content-encoding": "gzip",
      },
      body,
    });
    if (!r.ok) throw new Error(`${suffix}: ${r.status} ${(await r.text()).slice(0, 120)}`);
  };
  try {
    // The header last: a reader that polls the header and then fetches the
    // bytes should never see a header newer than the bytes it describes.
    await put("bin", frame.gzBin, "application/octet-stream");
    await put("json", frame.gzJson, "application/json");
    pushedAt = new Date().toISOString(); pushError = null;
  } catch (e) {
    pushError = e.message;
  }
}

// ----------------------------------------------------------------- go, and say so
server.listen(OPT.port, OPT.host, () => {
  const w = world.w;
  console.log(`The World is running here, and can be watched.`);
  console.log(`  ${w.cols}x${w.rows} = ${w.cells.toLocaleString()} hexagons, seed ${life.seed}, fill ${life.fill}`);
  console.log(`  a bounded sheet: four laws, no thermostat, and an EDGE light leaves through.`);
  if (CK && life.sessions > 1) {
    console.log(`  PICKED UP    at tick ${world.tick.toLocaleString()} from ${OPT.keep}/ -- `
      + `begun ${life.born.slice(0, 10)}, session ${life.sessions}. Size, seed and seeding are the world's own.`);
  } else {
    console.log(life.temp0 || life.p0
      ? `  start        temperature ${life.temp0}, momentum +-${life.p0}, net zero`
      : `  start        absolute zero: no heat, no momentum. Every pair that can bond will, at once.`);
  }
  if (world.inflow) {
    console.log(`  lit          from the ${world.inflow.side}, ${world.inflow.rate.toFixed(4)} quanta per edge hexagon per tick`
      + (life.hold ? `, steered to hold temperature ${life.hold.target}` : `, fixed`));
  }
  if (CK) console.log(`  kept in      ${OPT.keep}/ -- a checkpoint every ${OPT.checkpointMin} min and on Ctrl-C; the journal beside it`);
  if (OPT.yieldTo.length) console.log(`  stands still while running: ${OPT.yieldTo.join(", ")}`);
  console.log(`  a frame every ${OPT.every} ticks and at most every ${OPT.minMs} ms; `
    + `the books asserted every ${OPT.check}`);
  console.log();
  console.log(`  on this machine        http://localhost:${OPT.port}/`);
  if (OPT.host === "0.0.0.0") {
    for (const [name, list] of Object.entries(networkInterfaces())) {
      for (const a of list) {
        if (a.family === "IPv4" && !a.internal) {
          console.log(`  on this wifi           http://${a.address}:${OPT.port}/   (${name})`);
        }
      }
    }
    console.log(`  -- that port is open to this network. --host 127.0.0.1 keeps it to this machine.`);
  }
  console.log(`  the frame itself       /frame.json and /frame.bin  (+ /events, /status)`);
  if (OPT.push) {
    console.log();
    console.log(`  pushing to             ${OPT.push}/live.{json,bin} every ${OPT.pushEvery}s`);
    console.log(`  with the token in      $${OPT.tokenEnv}`
      + (process.env[OPT.tokenEnv] ? "" : `   -- NOT SET, so nothing will be pushed`));
    pushTimer = setInterval(() => { pushOnce(); }, OPT.pushEvery * 1000);
  } else {
    console.log();
    console.log(`  not pushing anywhere. --push <worker url>/universe sends frames to the website.`);
  }
  console.log();
  console.log(CK ? `  Ctrl-C stops it and saves it. Start it again and it carries on from the same tick.`
                 : `  Ctrl-C stops it. The run is NOT kept unless --keep was given.`);
  console.log();
  if (CK) { look(); if (life.sessions === 1) writeCheckpoint(); }
  buildFrame();
  slice();
});

const bye = () => {
  stopped = true;
  if (pushTimer) clearInterval(pushTimer);
  console.log(`\n  stopped at tick ${world.tick}.`
    + (booksClose ? ` The books closed at tick ${lastCheckedTick}.` : ` THE BOOKS DID NOT CLOSE.`));
  if (OPT.save) console.log(`  the last frame is in ${OPT.save}.json and ${OPT.save}.bin`);
  // A kept world is saved on the way out -- but only a state whose books close
  // right now, checked here rather than assumed.
  if (CK && booksClose) {
    try {
      world.ledger.check(world.w, `stopping at tick ${world.tick}`);
      writeCheckpoint();
      console.log(`  saved in ${OPT.keep}/ at tick ${world.tick.toLocaleString()}. Start it again to carry on.`);
    } catch (e) { console.error(`  NOT SAVED: ${e.message}`); }
  }
  server.close(() => process.exit(booksClose ? 0 : 1));
  setTimeout(() => process.exit(booksClose ? 0 : 1), 500);
};
process.on("SIGINT", bye);
process.on("SIGTERM", bye);
if (has("help")) { console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 62).join("\n")); process.exit(0); }
