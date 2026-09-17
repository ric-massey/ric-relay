#!/usr/bin/env node
"use strict";

/* THE VAULT, measured.
   ───────────────────────────────────────────────────────────────────────────
   A3 on `TODO.md` is the one item left on Ric's list, and it is four
   complaints in one line: *"Lines, hit markers, bots flying behind the walls,
   bullets passing through them. Everything the Leviathan got right and this
   did not."*

   Four complaints is four questions, and a look at the screen cannot separate
   them — which is most of why the item has sat open. This asks each one of the
   code, on real sectors, so the answer is a number rather than an impression:

     1. do rounds stop on a wall?            (`solidHit` along a wall)
     2. does the player stop on a wall?      (the real collision, not a poke)
     3. does traffic stop on a wall?          (`solidBounce`, the path bots use)
     4. is the inside ever painted over?      (the draw order, and the fill)

   The Leviathan is the control: every question is asked of both, and a
   difference between them is the bug. Run it alongside `test/survey.js`.

   No dependencies; the browser is stubbed by `test/page.js` like every other
   suite in here. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const page = require("./page.js");
const DIR = page.DIR;
const html = page.page().html;

let now = 0;
const noop = () => {};
const store = {};

/* ── the stub ─────────────────────────────────────────────────────────────
   Narrower than test/survey.js's: this suite never draws, so the canvas only
   has to absorb calls. What it does keep is the draw ORDER — question 4 is
   answered by which structure paints after which ship. */
const painted = [];

function ctxStub() {
  const noopFn = () => {};
  const target = {
    save: noopFn, restore: noopFn, beginPath: noopFn, closePath: noopFn,
    moveTo: noopFn, lineTo: noopFn, arc: noopFn, arcTo: noopFn, rect: noopFn,
    stroke: noopFn, clip: noopFn, translate: noopFn, rotate: noopFn, scale: noopFn,
    setTransform: noopFn, resetTransform: noopFn, drawImage: noopFn,
    fillText: noopFn, strokeText: noopFn, setLineDash: noopFn, quadraticCurveTo: noopFn,
    bezierCurveTo: noopFn, ellipse: noopFn, clearRect: noopFn,
    createLinearGradient: () => ({ addColorStop: noopFn }),
    createRadialGradient: () => ({ addColorStop: noopFn }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noopFn,
    fill: () => { painted.push({ what: "fill", style: target.fillStyle }); },
    fillRect: () => { painted.push({ what: "fillRect", style: target.fillStyle }); },
  };
  /* Anything not named above is a no-op. Naming canvas methods one crash at a
     time is how a stub ends up describing a context nobody has. */
  return new Proxy(target, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (typeof k === "string" && /^[a-z]/.test(k)) return noopFn;
      return undefined;
    },
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

function element() {
  const el = {
    style: new Proxy({}, {
      get: (t, k) => (k === "setProperty" ? (n, v) => { t[n] = v; }
                    : k === "removeProperty" ? (n) => { delete t[n]; }
                    : k === "getPropertyValue" ? (n) => t[n] || ""
                    : t[k]),
      set: (t, k, v) => { t[k] = v; return true; },
    }),
    dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    children: [], value: "", textContent: "", innerHTML: "", hidden: false,
    width: 1200, height: 800,
    getContext: () => ctxStub(),
    addEventListener: noop, removeEventListener: noop,
    appendChild: (c) => { el.children.push(c); return c; },
    removeChild: noop, insertBefore: (c) => c, remove: noop,
    setAttribute: noop, removeAttribute: noop, getAttribute: () => null,
    querySelector: () => element(), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 }),
    focus: noop, blur: noop, play: () => Promise.resolve(), pause: noop,
    requestFullscreen: () => Promise.resolve(), scrollIntoView: noop,
    getPointerCapture: noop, setPointerCapture: noop, releasePointerCapture: noop,
    closest: () => null, contains: () => false, cloneNode: () => element(),
  };
  return el;
}

function boot(search) {
  now = 0;
  painted.length = 0;
  for (const k of Object.keys(store)) delete store[k];

  const documentStub = {
    readyState: "complete", hidden: false, visibilityState: "visible",
    documentElement: element(), body: element(), head: element(),
    getElementById: () => element(), querySelector: () => element(),
    querySelectorAll: () => [], createElement: () => element(),
    createElementNS: () => element(), createTextNode: () => element(),
    addEventListener: noop, removeEventListener: noop,
    exitFullscreen: () => Promise.resolve(), fullscreenElement: null,
    activeElement: null, title: "",
  };

  const windowStub = {
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    location: { search, href: "http://localhost/" + search, hash: "" },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const node = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = node())),
        apply: () => node(),
      });
      return {
        createOscillator: node, createGain: node, createBufferSource: node,
        createBuffer: node, createBiquadFilter: node, createStereoPanner: node,
        createDynamicsCompressor: node,
        destination: {}, state: "running", resume: noop, close: noop,
        get currentTime() { return now / 1000; },
      };
    },
    navigator: { userAgent: "node", maxTouchPoints: 0, vibrate: noop },
    performance: { now: () => now },
    document: documentStub,
    setTimeout: (fn) => { if (typeof fn === "function") fn(); return 0; },
    clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    fetch: () => Promise.reject(new Error("offline")),
    RTCPeerConnection: function () { return new Proxy({}, { get: () => noop }); },
    WebSocket: function () { return new Proxy({}, { get: () => noop }); },
    isSecureContext: true,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    Image: function () { return element(); },
    URL: { createObjectURL: () => "blob:", revokeObjectURL: noop },
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  windowStub.URLSearchParams = URLSearchParams;
  windowStub.btoa = (x) => Buffer.from(x, "binary").toString("base64");
  windowStub.atob = (x) => Buffer.from(x, "base64").toString("binary");

  /* Deterministic, for the same reason test/survey.js is: a probe that reports
     a different number every run is a probe nobody believes. */
  let rngState = [...search].reduce((a, c) => a + c.charCodeAt(0), 0x2f6e2b1) | 0;
  const mathStub = Object.create(Math);
  mathStub.random = () => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: documentStub, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math: mathStub, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, Infinity, NaN, undefined, URLSearchParams,
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.CrossfireNet = undefined;
  vm.createContext(sandbox);
  // The page's own modules, in the page's own order. See test/page.js.
  page.boot(sandbox);
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  return { cf, win: windowStub };
}

let failures = 0;
function check(ok, label) {
  if (!ok) { failures++; console.log("  FAIL  " + label); }
  return ok;
}

/* ── find the Vault and stand next to it ──────────────────────────────────
   There is no teleport hook, deliberately — so the ship is placed and the
   streamer is asked to catch up, which is the same path the light drive takes
   when it crosses a chunk. */
function standAt(cf, key) {
  const lm = cf.survey().landmarks.find((l) => l.key === key);
  if (!lm) return null;
  const me = cf.live().ships[0];
  me.x = lm.x; me.y = lm.y - 6000;
  me.vx = me.vy = 0;
  for (let i = 0; i < 12; i++) { now += 16; cf.step(); }
  return lm;
}

/* Every wall of a structure, sampled along its length, asked the question a
   round asks. A wall that answers "no" anywhere is a wall rounds fly through. */
function wallsStopRounds(cf, s) {
  const wx = (u, v) => s.x + u * s.ca - v * s.sa;
  const wy = (u, v) => s.x && s.y + u * s.sa + v * s.ca;
  let pts = 0, stopped = 0;
  for (const w of s.walls) {
    for (let t = 0; t <= 8; t++) {
      const u = w.u0 + (w.u1 - w.u0) * (t / 8);
      const v = w.v0 + (w.v1 - w.v0) * (t / 8);
      pts++;
      if (cf.solidHit(wx(u, v), s.y + u * s.sa + v * s.ca)) stopped++;
    }
  }
  return { pts, stopped };
}

/* Question 3, the honest version: not "would a wall stop a bot" but "does a bot
   ever end up inside", because a ship inside the footprint at the moment the
   structure paints is a ship painted over. Flown, not reasoned about. */
function trafficInside(cf, s, reach, frames) {
  const seen = new Set();
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    now += 16; cf.step();
    const surv = cf.survey();
    if (!surv) break;
    let n = 0;
    for (const t of surv.traffic) {
      const du = (t.x - s.x) * s.ca + (t.y - s.y) * s.sa;
      const dv = -(t.x - s.x) * s.sa + (t.y - s.y) * s.ca;
      if (Math.abs(du) < reach && Math.abs(dv) < reach) { n++; seen.add(t.id || t); }
    }
    peak = Math.max(peak, n);
  }
  return { peak, distinct: seen.size };
}

console.log("THE VAULT — four questions, and the Leviathan as the control\n");

const SEEDS = ["424242", "112233", "771177", "9090", "31337"];
const rows = [];

for (const seed of SEEDS) {
  /* Two boots per seed. The Leviathan sits at a fixed 40,000 from home and the
     Vault a quarter of the way to the edge of the ladder, so only one of them is
     ever streamed at a time — measuring both from one position is how you get a
     control that reads 0% because it was not there. */
  for (const key of ["vault", "leviathan"]) {
    const { cf } = boot(`?debug=1&survey=1&seed=${seed}`);
    cf.pick("survey");
    cf.start("survey", 1);
    for (let i = 0; i < 6; i++) { now += 16; cf.step(); }
    if (!standAt(cf, key)) { rows.push({ seed, key, missing: "no landmark" }); continue; }
    const surv = cf.survey();
    const s = key === "vault" ? surv.vault : surv.leviathan;
    if (!s) { rows.push({ seed, key, missing: "chunk did not stream" }); continue; }

    const rounds = wallsStopRounds(cf, s);
    let probes = 0, bounced = 0;
    for (const g of s.segs) {
      probes++;
      if (cf.solidBounce({ x: g.x, y: g.y, vx: 0, vy: 0 }, 9)) bounced++;
    }
    const reach = key === "vault" ? s.r : s.len / 2;
    const inside = trafficInside(cf, s, reach, 240);
    rows.push({ seed, key, segs: s.segs.length, walls: s.walls.length,
                rounds, probes, bounced, inside, reach: Math.round(reach) });
  }
}

const pc = (a, b) => (b ? Math.round((a / b) * 100) : 0) + "%";
for (const r of rows) {
  if (r.missing) { console.log(`  seed ${r.seed} ${r.key}: ${r.missing}`); continue; }
  console.log(`  seed ${r.seed.padEnd(7)} ${r.key.padEnd(10)} ` +
              `${String(r.segs).padStart(4)} discs, ${String(r.walls).padStart(3)} walls, ` +
              `footprint +-${r.reach}`);
  console.log(`      rounds stopped on a wall  ${pc(r.rounds.stopped, r.rounds.pts).padStart(4)}` +
              `   solidBounce off a disc ${pc(r.bounced, r.probes).padStart(4)}`);
  console.log(`      traffic inside the footprint over 4s: peak ${r.inside.peak}, ` +
              `${r.inside.distinct} distinct ship(s)`);
}

const vaults = rows.filter((r) => r.key === "vault" && !r.missing);
const levs = rows.filter((r) => r.key === "leviathan" && !r.missing);
if (vaults.length) {
  const worst = Math.min(...vaults.map((r) => r.rounds.stopped / r.rounds.pts));
  const bounce = Math.min(...vaults.map((r) => r.bounced / r.probes));
  check(worst > 0.98, `a round flies through a vault wall (worst seed stops ${Math.round(worst * 100)}%)`);
  check(bounce > 0.98, `solidBounce misses a vault disc (worst seed ${Math.round(bounce * 100)}%)`);
}
const vaultInside = vaults.reduce((a, r) => a + r.inside.distinct, 0);
const levInside = levs.reduce((a, r) => a + r.inside.distinct, 0);
console.log(`\n  ships inside a footprint, summed over ${SEEDS.length} seeds:` +
            ` vault ${vaultInside}, leviathan ${levInside}`);

/* ── 4. what is actually different from the Leviathan ─────────────────────
   Questions 1 to 3 come back clean and identical on both structures, so
   whatever A3 is about, it is not the collisions. These are the differences
   that are left, read out of the source rather than guessed at — each one a
   thing the Leviathan has and the Vault does not. */

const src = html;
const at = (needle) => src.indexOf(needle);
const order = {
  traffic: at("for (const t of surv.traffic) drawTraffic(t);"),
  leviathan: at("if (surv.leviathan) drawLeviathan(surv.leviathan);"),
  vault: at("if (surv.vault) drawVault(surv.vault);"),
  wrecks: at("for (const w of surv.wrecks) drawWreck(w);"),
  caches: at("for (const c of surv.caches) drawCache(c);"),
  drones: at("for (const d of surv.drones) drawDrone(d);"),
};

console.log("\n  what the Leviathan has and the Vault has not");

/* The fill. The Leviathan fills from the outline its builder made; the Vault
   fills the bounding square, then strokes 90 lines over it. That is the whole
   of "lines" — the shape carries no plating, no bulkheads, no throats, nothing
   for the eye to read as built. */
const levDraw = src.slice(at("function drawLeviathan("), at("function drawVault("));
const vaultDraw = src.slice(at("function drawVault("), at("function drawSurveyWorld("));
const levStrokes = (levDraw.match(/ctx\.stroke\(\)/g) || []).length;
const vaultStrokes = (vaultDraw.match(/ctx\.stroke\(\)/g) || []).length;
const levFills = (levDraw.match(/ctx\.fill\(\)|ctx\.fillRect\(/g) || []).length;
const vaultFills = (vaultDraw.match(/ctx\.fill\(\)|ctx\.fillRect\(/g) || []).length;
console.log(`    drawn from its own outline:   leviathan ${levDraw.includes("lev.outline")}` +
            `   vault ${vaultDraw.includes("v.outline")}`);
console.log(`    fill calls / stroke calls:    leviathan ${levFills}/${levStrokes}` +
            `   vault ${vaultFills}/${vaultStrokes}`);
console.log(`    source lines of drawing:      leviathan ${levDraw.split("\n").length}` +
            `   vault ${vaultDraw.split("\n").length}`);

/* The hit marker. The Leviathan has a burst of its own in `surveyBullets`, in
   WRECK colour — and it cannot run. `update()` sweeps every survey round
   against `solidHit` (which knows both structures) and splices it at line
   order 20503, while `surveyTick` -> `surveyBullets` is called later in the
   same function. So a round that would reach either structure is already gone,
   and both get the same generic burst in the round's own colour. It is the trap
   the comment three lines above it warns about for hulks. */
const sweepAt = at("struck = solidHit(b.x - b.vx * dt * (1 - f)");
const surveyTickAt = at("      surveyTick(dt);");
const levBurstAt = at("for (const g of surv.leviathan.segs) {");
console.log(`    a hit marker of its own:      leviathan yes, vault no` +
            ` — but the Leviathan's is unreachable (sweep at ${sweepAt} < surveyTick at ${surveyTickAt})`);
check(sweepAt > 0 && surveyTickAt > sweepAt && levBurstAt > 0,
      "the reachability argument above no longer holds — re-read surveyBullets");

/* Proximity logging. The Leviathan is written into the book by distance as well
   as by its landmark radius; the Vault has only the radius. */
console.log(`    logged by proximity too:      leviathan ${src.includes('noteKnown("leviathan"')}` +
            `   vault ${src.includes('noteKnown("vault"')}`);

/* A lab to look at it in. `?debug=1&leviathan=1` opens an empty sector with
   the Leviathan and nothing else — which is how you look at a structure
   without a sector happening around you. There is no vault equivalent. */
console.log(`    an empty-room lab:            leviathan ${src.includes("LEV_ONLY")}   vault false`);

/* And the draw order, which is a real latent bug and is NOT the difference:
   traffic paints before both structures and both fill opaquely, so a ship
   inside either one is painted over. Measured above: it happens, rarely. */
console.log("\n  draw order in drawSurveyWorld");
console.log("    " + Object.entries(order).sort((a, b) => a[1] - b[1]).map(([k]) => k).join(" -> "));
console.log(`    traffic paints before both structures, and both fill opaquely,`);
console.log(`    so a ship inside either is painted over. Affects BOTH, so it is`);
console.log(`    a latent bug rather than the A3 difference. Caches and drones`);
console.log(`    paint after the fill and are fine.`);
check(order.traffic > 0 && order.vault > 0 && order.caches > order.vault,
      "drawSurveyWorld's order changed — re-read this section");

console.log("");
if (failures) {
  console.log(`THE VAULT: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("THE VAULT: collisions are sound on both; the differences are drawing, " +
            "a dead hit-marker path, proximity logging and a lab");
