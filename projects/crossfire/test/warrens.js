#!/usr/bin/env node
"use strict";

/* CROSSFIRE — THE WARRENS
   ─────────────────────────────────────────────────────────────────────────────
   A region made of rock, with passages you thread rather than space you cross.
   It is the first thing in the game whose *shape* is generated per chunk, and
   that is the whole of what this file is about, because three things can be
   wrong with it and none of them is visible in a screenshot:

     · **the rock has to agree with itself across a chunk line.** Chunks are
       2,600 units and are built independently from `(seed, cx, cy)`, so the
       walls belong to a global lattice rather than to chunks. If that ever
       stopped being true the seam would be a wall that stops dead, and you
       would only find it by flying into one.
     · **the open space has to join up.** Noise makes caverns, not a cave
       system; measured, pure noise left a fifth of the region in sealed pockets.
       A tunnel network is carved under it to guarantee otherwise, and the only
       way to know it worked is to flood the thing.
     · **nothing may be placed inside rock — including the ship.** A hull
       dropped into a mass cannot get out by flying: collision pushes it off each
       disc and there is always another behind. Measured before it was fixed:
       nine hundred units deep, three seconds of collision moved it ninety-three.

   None of those is a matter of taste and all three are arithmetic.
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const page = require("./page.js");
const DIR = page.DIR;
const html = page.page().html;
const hudSrc = page.source("survey-hud.js");

/* The load order is the page's now rather than a copy of it — see
   test/page.js — but the fact it protects is still worth saying out
   loud: the inline script captures `window.CrossfireSurveyHUD` once at
   boot, so a HUD loaded after it would test the null-HUD path. */
assert.ok(
  html.indexOf('src="survey-hud.js"') > 0 &&
  html.indexOf('src="survey-hud.js"') < html.search(/<script(?![^>]*\bsrc=)/i),
  "survey-hud.js must be loaded before the inline game script"
);

let now = 0;
const noop = () => {};
function stubCtx() {
  // Every method a no-op and every property writable — except measureText,
  // which has to return something with a width: the menus size their own tap
  // targets from it, so a bare no-op turns drawing a menu into a TypeError.
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return str => ({ width: String(str).length * 8 });
      // Likewise the gradient makers: the menus fade a card's picture into its
      // words with one, and a no-op returning `undefined` turns drawing a card
      // into "cannot read properties of undefined (reading 'addColorStop')".
      if (k === "createLinearGradient" || k === "createRadialGradient" ||
          k === "createPattern") return () => ({ addColorStop: noop });
      return k in t ? t[k] : (t[k] = noop);
    },
    set: (t, k, v) => (t[k] = v, true)
  });
}
function stubEl() {
  return {
    style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    removeChild: noop, setAttribute: noop, removeAttribute: noop, focus: noop,
    // The online card opens the real lobby, which rebuilds a room list — so the
    // stub needs the DOM the other suites never reach.
    replaceChildren: noop, insertBefore: noop, remove: noop, scrollIntoView: noop,
    cloneNode: () => stubEl(), select: noop,
    blur: noop, click: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => stubEl(), querySelectorAll: () => [],
    hidden: false, value: "", textContent: "", width: 1000, height: 700,
    /* The stage's box is what the game sizes its screen against — the screen is
       as wide as the device now rather than a fixed thousand — so the stub has
       to report one, and the suite can change it to test a shape. */
    get clientWidth() { return STAGE.w; },
    get clientHeight() { return STAGE.h; },
    dataset: {}, children: [], parentNode: null
  };
}
// The viewport the stubbed stage reports. A landscape phone by default, because
// that is the shape this game is hardest to lay out for.
const STAGE = { w: 1200, h: 800 };
const store = {};
const documentStub = {
  getElementById: () => stubEl(), querySelector: () => stubEl(),
  querySelectorAll: () => [], createElement: () => stubEl(),
  addEventListener: noop, removeEventListener: noop,
  body: stubEl(), documentElement: stubEl(),
  hidden: false, visibilityState: "visible",
  exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
};

function boot(search) {
  for (const k of Object.keys(store)) delete store[k];
  return bootKeepingStorage(search);
}

function bootKeepingStorage(search) {
  now = 0;
  const windowStub = {
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false,
                        addEventListener: noop, addListener: noop }),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    location: { search, href: "http://localhost/" + search, hash: "" },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const audioNode = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = audioNode())),
        apply: () => audioNode()
      });
      return {
        createOscillator: audioNode, createGain: audioNode,
        createBufferSource: audioNode, createBuffer: audioNode,
        createBiquadFilter: audioNode, createStereoPanner: audioNode,
        createDynamicsCompressor: audioNode,
        destination: {}, state: "running", resume: noop, close: noop,
        get currentTime() { return now / 1000; }
      };
    },
    performance: { now: () => now },
    setTimeout: noop, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams, btoa: s => Buffer.from(s, "binary").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("binary")
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;

  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: documentStub, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.CrossfireNet = undefined;
  vm.createContext(sandbox);
  // The page's own modules, in the page's own order. See test/page.js.
  page.boot(sandbox);
  // `window` inside the sandbox is the stub, not the sandbox object itself, so
  // anything the game hangs off window lands there — the same reason
  // test/campaign.js looks in both places.
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  assert.ok(windowStub.CrossfireSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub };
}





/* ── the warrens of one sector ───────────────────────────────────────────── */
const SEED = Number(process.argv[2]) || 606061;
const { cf } = boot("?debug=1&seed=" + SEED);
cf.start("survey", 1);
const surv = cf.survey();
const k = n => Math.round(n / 1000) + "k";

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// The nearest one. Every sector has them; the lattice says where.
const sites = cf.regionSites(Math.ceil(700000 / cf.regionCell()))
  .filter(s => s.key === "warrens")
  .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
check(sites.length > 0, "no Warrens anywhere within 700k — the region never rolls");
const w = sites[0];

console.log("");
console.log("CROSSFIRE — the Warrens of sector " + SEED);
console.log("=".repeat(62));
console.log("  " + sites.length + " of them within 700k · the nearest is " +
            k(Math.hypot(w.x, w.y)) + " out");

/* ── 1. the rock agrees with itself across a chunk line ─────────────────────
   Asked of the *streamed* discs rather than of the field, because the field
   being pure proves nothing about the thing that actually gets built. Two
   neighbouring chunks are built and every disc within a cell of their shared
   edge has to appear exactly once, on the side that owns it. */
{
  const CHUNK = cf.sectorSpan().chunk;
  const cx = Math.round(w.x / CHUNK), cy = Math.round(w.y / CHUNK);
  let seams = 0, dupes = 0, gaps = 0;
  for (let i = 0; i < 6; i++) {
    const a = cf.chunk(cx + i, cy);
    const b = cf.chunk(cx + i + 1, cy);
    const edge = (cx + i + 1) * CHUNK;
    const all = a.caveSegs.concat(b.caveSegs);
    // Every lattice cell along the seam, asked of the lattice itself.
    const cell = cf.caveCell();
    /* Lattice cells, not arbitrary points. The first version of this asked
       about `edge`, `edge - cell` and `edge + cell` — and a chunk edge is a
       multiple of 2,600 while a cell is a multiple of 210, so none of those is a
       cell position and all of them were "built by neither", every time, whether
       or not anything was wrong. A check that cannot pass is not a check. */
    const near = Math.round(edge / cell);
    /* And the rows have to be rows these two chunks own. Walking `y` by a cell
       from the chunk's own corner and rounding lands on cells belonging to the
       chunk above or below — which were never built, so they came back missing
       and looked like a seam. The ownership rule is `ceil` at both ends; the
       test has to use the same one the code does or it is testing a third
       thing. */
    const j0 = Math.ceil(cy * CHUNK / cell), j1 = Math.ceil((cy + 1) * CHUNK / cell);
    for (let jj = j0; jj < j1; jj++) {
      const gy = jj * cell;
      for (const gx of [(near - 1) * cell, near * cell, (near + 1) * cell]) {
        if (!cf.caveSolid(gx, gy)) continue;
        /* Only the cells that are actually *built*. A disc buried inside a mass
           can never be touched by anything, so the streamer carries the surface
           and nothing else — asking whether an interior cell has a disc is
           asking about something deliberately absent, and the answer was 183
           "missing" walls that were simply rock with rock on every side. */
        let buried = true;
        for (let ox = -1; ox <= 1 && buried; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            if (!ox && !oy) continue;
            if (!cf.caveSolid(gx + ox * cell, gy + oy * cell)) { buried = false; break; }
          }
        }
        if (buried) continue;
        /* A disc sits a little off its own cell — the jitter is what stops the
           rock reading as bubbles — so it is matched to the cell it belongs to
           rather than to an exact position. Half a cell is well inside the
           0.21 the jitter can move it and well under the spacing, so no disc can
           be mistaken for its neighbour's. */
        const tol = cell * 0.5;
        const hits = all.filter(g => Math.abs(g.x - gx) < tol &&
                                     Math.abs(g.y - gy) < tol);
        seams++;
        if (hits.length > 1) dupes++;
        if (hits.length === 0) gaps++;
      }
    }
  }
  check(dupes === 0, dupes + " of " + seams +
        " cells on a chunk seam were built twice — the lattice is not shared");
  check(gaps === 0, gaps + " of " + seams +
        " cells on a chunk seam were built by neither chunk — there is a hole " +
        "in the wall at every boundary");
  console.log("  seams      " + seams + " cells checked along six chunk edges · " +
              "each built exactly once");
}

/* ── 2. a chunk is the same chunk every time ───────────────────────────────
   The streamer throws chunks away behind you and rebuilds them when you come
   back. Rock that rebuilt differently would be a passage that closed while you
   were down it. */
{
  const CHUNK = cf.sectorSpan().chunk;
  const cx = Math.round(w.x / CHUNK), cy = Math.round(w.y / CHUNK);
  const one = cf.chunk(cx, cy).caveSegs.map(g => g.x + "," + g.y).join("|");
  const two = cf.chunk(cx, cy).caveSegs.map(g => g.x + "," + g.y).join("|");
  check(one === two, "a chunk's rock changed between two builds of it");
  console.log("  pure       a chunk rebuilds to the same rock, disc for disc");
}

/* ── 3. the open space joins up ─────────────────────────────────────────────
   Flooded from outside the patch. This is the check the tunnel network exists
   to pass, and the number it replaced was 77.7%. */
let openPct = 0, reachPct = 0, centreOK = false;
{
  /* One cell a step, and it cannot be coarsened. The narrowest squeeze in the
     network is about 190 units across; at two cells the flood steps straight
     over passages that are genuinely open and reports them sealed — tried, and
     it took connectivity from 99.7% to 76% without a line of the game changing.
     A sampling grid coarser than the thing it samples measures the grid. */
  const STEP = cf.caveCell();
  const R = 46000;
  const N = Math.floor(R * 2 / STEP);
  const open = new Uint8Array(N * N);
  let openCells = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (!cf.caveSolid(w.x - R + i * STEP, w.y - R + j * STEP)) {
        open[j * N + i] = 1; openCells++;
      }
    }
  }
  const seen = new Uint8Array(N * N), q = [];
  const push = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return;
    const kk = j * N + i;
    if (!open[kk] || seen[kk]) return;
    seen[kk] = 1; q.push(kk);
  };
  for (let i = 0; i < N; i++) { push(i, 0); push(i, N - 1); push(0, i); push(N - 1, i); }
  for (let head = 0; head < q.length; head++) {
    const kk = q[head], i = kk % N, j = (kk - i) / N;
    push(i + 1, j); push(i - 1, j); push(i, j + 1); push(i, j - 1);
  }
  let reach = 0;
  for (let kk = 0; kk < N * N; kk++) if (seen[kk]) reach++;
  openPct = openCells / (N * N) * 100;
  reachPct = reach / openCells * 100;
  const mid = Math.floor(N / 2);
  for (let d = 0; d < 14 && !centreOK; d++) {
    for (let j = mid - d; j <= mid + d && !centreOK; j++) {
      for (let i = mid - d; i <= mid + d && !centreOK; i++) {
        if (seen[j * N + i]) centreOK = true;
      }
    }
  }
  check(reachPct > 90,
        "only " + reachPct.toFixed(1) + "% of the open space can be reached " +
        "from outside — the rest is sealed chambers");
  check(centreOK, "the middle of the region cannot be reached from outside");
  check(openPct > 25 && openPct < 70,
        openPct.toFixed(0) + "% open — a cave is neither a wall nor a field");
  console.log("  connected  " + openPct.toFixed(0) + "% of it is open space · " +
              reachPct.toFixed(1) + "% of that is reachable from outside · the " +
              "middle is reachable");
}

/* ── 4. the edges are open and the middle is not ────────────────────────────
   The density ramps with `regionDepth`. Without it the region is a hundred
   thousand units of rock whose only feature is its outside. */
{
  /* Sampled by **depth into the patch**, not by distance from its middle. A
     patch is a Voronoi cell: how far its edge is depends entirely on where the
     neighbouring sites landed, so a fixed radius is the rim of one patch and the
     middle of another — measured that way, one sector reported 39% rock "at the
     rim" and nothing was wrong with it except the question. `regionDepth` is
     what the ramp is actually written against, so it is what this asks. */
  const band = (lo, hi) => {
    let solid = 0, n = 0;
    for (let i = 0; i < 30000 && n < 2000; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 60000;
      const x = w.x + Math.cos(a) * r, y = w.y + Math.sin(a) * r;
      if (cf.regionProbe(x, y).key !== "warrens") continue;
      const d = cf.regionAtDepth(x, y).depth;
      if (d < lo || d >= hi) continue;
      if (cf.caveSolid(x, y)) solid++;
      n++;
    }
    return n ? solid / n * 100 : 0;
  };
  const deep = band(0.55, 1.01), rim = band(0, 0.14);
  check(deep > rim + 12,
        "the middle (" + deep.toFixed(0) + "% rock) is no denser than the rim (" +
        rim.toFixed(0) + "%) — there is nothing to go in for");
  check(rim < 22, "the outer edge is " + rim.toFixed(0) +
        "% rock — you would meet the outside of it as a wall");
  console.log("  ramped     " + rim.toFixed(0) + "% rock in the outer seventh · " +
              deep.toFixed(0) + "% rock in the inner half");
}

/* ── 5. nothing is ever left inside rock ────────────────────────────────────
   The one failure nobody can play their way out of. */
{
  let worst = 0, buried = 0, tries = 0;
  const me = cf.live().ships[0];
  for (let t = 0; t < 40; t++) {
    // Somewhere genuinely inside a mass, not merely touching one.
    let bx = null, by = null, best = 0;
    for (let i = 0; i < 400; i++) {
      const a = Math.random() * Math.PI * 2, r = 6000 + Math.random() * 12000;
      const x = w.x + Math.cos(a) * r, y = w.y + Math.sin(a) * r;
      if (!cf.caveSolid(x, y)) continue;
      let d = 0;
      for (let s = 100; s <= 900; s += 100) {
        if (cf.caveSolid(x + s, y) && cf.caveSolid(x - s, y) &&
            cf.caveSolid(x, y + s) && cf.caveSolid(x, y - s)) d = s; else break;
      }
      if (d > best) { best = d; bx = x; by = y; }
    }
    if (bx === null || best < 200) continue;
    tries++;
    worst = Math.max(worst, best);
    surv.death = null;
    me.alive = true; me.hull = me.maxHull;
    me.x = bx; me.y = by; me.vx = me.vy = 0;
    for (let i = 0; i < 8; i++) {
      me.invuln = 9999; surv.water = 9e5; surv.food = 9e5;
      now += 1000 / 60; cf.step();
    }
    if (cf.caveSolid(me.x, me.y)) buried++;
  }
  check(tries > 8, "only " + tries + " places deep enough to test being buried");
  check(buried === 0, buried + " of " + tries +
        " ships dropped into rock were still inside it an eighth of a second " +
        "later — that is a run nobody can finish");
  console.log("  buried     " + tries + " hulls dropped up to " + worst +
              " units inside a mass · every one out within an eighth of a second");
}

/* ── 6. and the region's own furniture is not inside the walls ─────────────
   `inBuilt` is asked before anything is placed, and it now answers for rock as
   well. A cache in a wall is a cache generated for nobody. */
{
  const CHUNK = cf.sectorSpan().chunk;
  const cx = Math.round(w.x / CHUNK), cy = Math.round(w.y / CHUNK);
  let things = 0, inside = 0;
  for (let j = -4; j <= 4; j++) {
    for (let i = -4; i <= 4; i++) {
      const c = cf.chunk(cx + i, cy + j);
      for (const list of [c.caches, c.hulks, c.wrecks, c.stations, c.gates]) {
        for (const o of list) {
          things++;
          if (cf.caveSolid(o.x, o.y)) inside++;
        }
      }
    }
  }
  check(inside === 0, inside + " of " + things +
        " things in the Warrens were generated inside solid rock");
  console.log("  placed     " + things + " caches, hulks, wrecks and gates " +
              "across 81 chunks · not one of them in a wall");
}

/* ── 7. it is solid to everything, not only to you ─────────────────────────
   A wall that stops one kind of ship is set dressing. The player goes through
   `strike`; every other ship in the sector goes through `solidBounce`, and the
   cave was in neither until it was put there. Rounds went through all of it. */
{
  const me = cf.live().ships[0];
  // Somewhere inside a passage, deep in.
  let px = null, py = null;
  for (let i = 0; i < 30000 && px === null; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 9000;
    const x = w.x + Math.cos(a) * r, y = w.y + Math.sin(a) * r;
    if (cf.caveFill(x, y) > 0.9 && cf.caveEdge(x, y) < -60) { px = x; py = y; }
  }
  check(px !== null, "found nowhere inside a passage to test collision from");
  if (px !== null) {
    surv.death = null;
    me.alive = true; me.hull = me.maxHull;
    me.x = px; me.y = py; me.vx = me.vy = 0;
    for (let i = 0; i < 6; i++) { me.invuln = 9999; surv.water = 9e5; surv.food = 9e5; now += 1000/60; cf.step(); }

    /* The hull, driven flat into the wall from eight bearings at well past
       cruising speed. It may bounce, scrape or stop; it may not end up inside. */
    let inHull = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]]) {
      me.x = px; me.y = py; me.vx = dx * 1100; me.vy = dy * 1100;
      let bad = false;
      for (let i = 0; i < 50; i++) {
        me.invuln = 9999; surv.water = 9e5; surv.food = 9e5;
        now += 1000/60; cf.step();
        if (cf.caveSolid(me.x, me.y)) bad = true;
      }
      if (bad) inHull++;
    }
    check(inHull === 0, inHull + " of 8 runs drove the hull into the rock and left it there");

    // Everything else: `solidBounce` has to actually push off the cave.
    /* Counted against the ships that actually *met* rock. A passage can run
       clear for two and a half thousand units, and a probe that flew down one
       and out of the region without touching anything is not a wall failing to
       stop it — it is a corridor. The first version of this counted those as
       failures and one sector in five reported a phantom. */
    let bounced = 0, met = 0;
    for (let n = 0; n < 16; n++) {
      const a = (n / 16) * Math.PI * 2;
      const o = { x: px, y: py, a };
      let touched = false, reached = false;
      for (let i = 0; i < 600; i++) {
        o.x += Math.cos(o.a) * 4.3; o.y += Math.sin(o.a) * 4.3;
        if (cf.solidBounce(o, 22)) { touched = true; break; }
        if (cf.caveSolid(o.x, o.y)) { reached = true; break; }
      }
      if (touched || reached) met++;
      if (touched) bounced++;
    }
    check(met > 6, "only " + met + " of 16 bearings met rock at all — this " +
          "spot is too open to prove anything");
    check(bounced === met, (met - bounced) + " of " + met +
          " ships reached rock without being pushed off it — a wall that stops " +
          "one kind of ship is set dressing");

    // And a round is stopped by rock in every direction.
    // Same rule: judged only on the rounds that actually reached rock.
    let stopped = 0, reached = 0;
    for (let n = 0; n < 48; n++) {
      const a = (n / 48) * Math.PI * 2;
      let x = px, y = py;
      for (let d = 0; d < 3000; d += 20) {
        x += Math.cos(a) * 20; y += Math.sin(a) * 20;
        if (cf.solidHit(x, y)) { stopped++; reached++; break; }
        if (cf.caveSolid(x, y)) { reached++; break; }
      }
    }
    check(reached > 20, "only " + reached + " of 48 rounds met rock at all");
    check(stopped === reached, (reached - stopped) + " of " + reached +
          " rounds flew into solid rock without being stopped — there is no " +
          "cover in here");

    console.log("  solid      the hull bounces from 8 bearings · every ship " +
                "that met rock was pushed off it · every round that met rock " +
                "was stopped by it");
  }
}

/* ── 8. nothing is generated inside anything solid ─────────────────────────
   Worlds are rolled first in a chunk and can be 3,600 units across, so a cache
   or a hulk could be placed inside one — drawn, named, on the chart, and
   unreachable, because a world is solid and the only way in is through. */
{
  const CHUNK = cf.sectorSpan().chunk;
  const cx = Math.round(w.x / CHUNK), cy = Math.round(w.y / CHUNK);
  let things = 0, inWorld = 0, inRock = 0;
  for (let j = -6; j <= 6; j++) {
    for (let i = -6; i <= 6; i++) {
      const c = cf.chunk(cx + i, cy + j);
      for (const list of [c.caches, c.hulks, c.wrecks, c.stations, c.gates]) {
        for (const o of list) {
          things++;
          if (cf.caveSolid(o.x, o.y)) inRock++;
          for (const pl of c.planets) {
            if ((o.x - pl.x) ** 2 + (o.y - pl.y) ** 2 < pl.r * pl.r) { inWorld++; break; }
          }
        }
      }
    }
  }
  check(inRock === 0, inRock + " of " + things + " things were generated in rock");
  check(inWorld === 0, inWorld + " of " + things +
        " things were generated inside a world in their own chunk");
  console.log("  clear      " + things + " caches, hulks, wrecks, stations and " +
              "gates across 169 chunks · none in rock, none inside a world");
}

if (problems.length) {
  console.log("");
  console.log("CROSSFIRE warrens checks FAILED");
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("");
console.log("CROSSFIRE warrens checks passed");
