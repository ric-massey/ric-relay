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
//   node world-stream.mjs --eps 2e-5 --grow 200      turn the dials
//   node world-stream.mjs --push https://training-log.rmbuster82.workers.dev/universe
//   node world-stream.mjs --host 127.0.0.1           this machine only
//   node world-stream.mjs --save runs/world          also write frames to disk

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname, extname, resolve, normalize } from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { World, census, countMatter, neighbour, qOf, rOf } from "./world.mjs";
import { CANDIDATE_ZERO } from "./constants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf("--" + n); return i === -1 ? d : argv[i + 1]; };
const num = (n, d) => { const v = flag(n, null); return v === null ? d : Number(v); };
const has = (n) => argv.includes("--" + n);

const OPT = {
  // the run -- the same dials world-run.mjs has, and they mean the same things
  size:   num("size", 258),
  seed:   num("seed", 1),
  fill:   num("fill", 0.30),
  ticks:  num("ticks", Infinity),       // runs until stopped by default
  eps:    num("eps", 2e-7),
  screen: num("screen", 0.25),
  relax:  num("relax", 2),
  grow:   num("grow", 0),
  drain:  num("drain", 0.02),
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
};

const gravity = OPT.eps > 0 ? { eps: OPT.eps, screen: OPT.screen, relax: OPT.relax } : null;

// ------------------------------------------------------------- the engine id
// Which engine is producing this. snapshot.mjs hashes lab.mjs and
// constants.mjs for exactly this reason: a frame is a picture of a run, the
// engine changes daily, and nothing in a file says so unless it is put there.
// The two files the World's physics lives in are world.mjs and constants.mjs.
const digest = (f) => createHash("sha256")
  .update(readFileSync(join(HERE, f))).digest("hex").slice(0, 12);
const engine = { world: digest("world.mjs"), constants: digest("constants.mjs") };

// ---------------------------------------------------------------- the world
const world = new World({
  cols: OPT.size, rows: OPT.size, seed: OPT.seed,
  constants: CANDIDATE_ZERO, gravity,
});
world.seed_(OPT.fill, (rng) => 1 + rng.below(255));
const sizeAtStart = [world.w.cols, world.w.rows];

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
  const grew = w.cols !== sizeAtStart[0] || w.rows !== sizeAtStart[1];
  return {
    engine,
    format: "universe-world-frame/1",
    kind: "world",
    warning: "A LIVE FRAME FROM A RUNNING WORLD, and gravity's strength here is "
      + "a DIAL rather than a measured constant: README item 20's floor-above-ceiling "
      + "finding predates the 2026-11-06 physics and has not been redone. CANDIDATE_ZERO "
      + "is the plumbing test point, not a chosen physics. Nothing read off this is a result.",
    written: new Date().toISOString(),
    label: `World, live -- tick ${world.tick}`,
    slot: "live",

    // THE SPACE, which is the only thing the map draws from.
    space: {
      lattice: "hex-axial-pointy",
      size: [w.cols, w.rows],
      ...(grew ? { sizeAtStart } : {}),
      wraps,
      indexing: "i = r * cols + q",
      note: wraps[0] && wraps[1] ? "hexagonal torus -- no edge in either direction"
          : wraps[0] || wraps[1] ? "cylinder -- one looping axis, a boundary on the other"
          : "bounded patch -- edges in both directions",
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

    run: {
      seed: OPT.seed,
      events: world.tick,                 // the viewer's run line reads this
      ticks: world.tick,
      fill: OPT.fill,
      gravity,
      growing: OPT.grow ? { everyTicks: OPT.grow, drain: OPT.drain, maxCells: OPT.max } : null,
      approximations: [
        "ticked time rather than the Lab's event queue (TWO-RUNS.md)",
        `the potential is RELAXED ${gravity ? gravity.relax : 0} sweeps a tick, not solved`,
      ],
    },

    counts: { ...world.counts },
    // The books, with their terms named. A frame that cannot say its energy
    // closed is a picture of nothing in particular.
    books: {
      matter: c.matter, heat: c.heat, kinetic: c.kinetic, inFlight: c.inFlight,
      momentum: [c.px, c.py],
      expansionLoss: world.ledger.expansionLoss,
      bondPotential: world.ledger.bondPotential,
      gravityPotential: world.ledger.gravityPotential,
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
let growAxis = 0;

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
  try {
    for (let n = 0; n < OPT.batch; n++) {
      world.doTick();
      if (OPT.grow && world.tick % OPT.grow === 0 && world.w.cells < OPT.max) {
        if (world.grow(growAxis)) {
          growAxis ^= 1;
          if (OPT.drain > 0) world.drainForGrowth(OPT.drain);
          world.order = null;
        }
      }
      if (OPT.check && world.tick % OPT.check === 0) {
        world.ledger.check(world.w, `tick ${world.tick}`);
        lastCheckedTick = world.tick; booksClose = true;
      }
      if (world.tick >= OPT.ticks) { stopped = true; break; }
      if (world.tick % OPT.every === 0) break;        // frame time
    }
  } catch (err) {
    // A ledger failure is the most important thing this process can say, so it
    // stops and the frame SAYS SO rather than carrying on looking fine.
    booksClose = false; stopped = true; lastError = err.message;
    console.error(`\n  THE BOOKS DID NOT CLOSE at tick ${world.tick}:\n  ${err.message}\n`);
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
  console.log(`  ${w.cols}x${w.rows} = ${w.cells.toLocaleString()} hexagons, seed ${OPT.seed}, fill ${OPT.fill}`);
  console.log(gravity
    ? `  gravity ON   eps ${OPT.eps}  screen ${OPT.screen}  relax ${OPT.relax}   -- a DIAL, not a measurement`
    : `  gravity OFF  -- the control. Nothing creates momentum, so nothing moves.`);
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
  console.log(`  Ctrl-C stops it. The run is NOT saved unless --save was given.`);
  console.log();
  buildFrame();
  slice();
});

const bye = () => {
  stopped = true;
  if (pushTimer) clearInterval(pushTimer);
  console.log(`\n  stopped at tick ${world.tick}.`
    + (booksClose ? ` The books closed at tick ${lastCheckedTick}.` : ` THE BOOKS DID NOT CLOSE.`));
  if (OPT.save) console.log(`  the last frame is in ${OPT.save}.json and ${OPT.save}.bin`);
  server.close(() => process.exit(booksClose ? 0 : 1));
  setTimeout(() => process.exit(booksClose ? 0 : 1), 500);
};
process.on("SIGINT", bye);
process.on("SIGTERM", bye);
if (has("help")) { console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 42).join("\n")); process.exit(0); }
