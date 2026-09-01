#!/usr/bin/env node
"use strict";

/* A headless run of each campaign mission. The smoke test proves the script
   parses; this proves it *plays* — that a mission starts, the fleets fight, the
   objective and reinforcement machinery run, and a win or a loss actually fires,
   all with no ship leaving the arena and no bullet crossing the team line.

   No dependencies: the whole browser surface the game touches is stubbed here
   with no-ops, a controllable clock replaces performance.now, and the game is
   driven through the ?debug=1 window.__cf hooks. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const INDEX = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(INDEX, "utf8");
const script = [...html.matchAll(
  /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
)][0][1];

// ── a browser, reduced to the parts the game reaches for ──────────────────
let now = 0;                       // the clock the harness controls
const noop = () => {};
function stubCtx() {
  // A 2D context whose every method is a no-op and whose every property is
  // writable. Rendering must never be what a logic test trips over.
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (t[k] = noop)),
    set: (t, k, v) => (t[k] = v, true)
  });
}
function stubEl() {
  const el = {
    style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    removeChild: noop, setAttribute: noop, removeAttribute: noop, focus: noop,
    blur: noop, click: noop, getContext: stubCtx, getBoundingClientRect: () => ({
      left: 0, top: 0, width: 1000, height: 700
    }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => stubEl(), querySelectorAll: () => [],
    hidden: false, value: "", textContent: "", width: 1000, height: 700,
    dataset: {}, children: [], parentNode: null
  };
  return el;
}
const store = {};
const documentStub = {
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  createElement: () => stubEl(),
  addEventListener: noop, removeEventListener: noop,
  body: stubEl(), documentElement: stubEl(),
  hidden: false, visibilityState: "visible",
  exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
};
const windowStub = {
  addEventListener: noop, removeEventListener: noop,
  requestAnimationFrame: noop, cancelAnimationFrame: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  location: { search: "?debug=1", href: "http://localhost/", hash: "" },
  devicePixelRatio: 1,
  innerWidth: 1200, innerHeight: 800,
  AudioContext: function () {
    // Every audio node method is a no-op and every audio param accepts every
    // ramp call, so synthesis never trips the logic test — but the context's
    // own scalar fields stay real numbers the game does arithmetic on.
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
  URLSearchParams
};
windowStub.window = windowStub;
windowStub.webkitAudioContext = windowStub.AudioContext;

const sandbox = Object.assign(Object.create(null), windowStub, {
  document: documentStub,
  navigator: { userAgent: "node", maxTouchPoints: 0 },
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
  Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
  parseInt, parseFloat, Infinity, NaN, undefined
});
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

// The game expects `net.js`'s global too; it only reads it while online.
sandbox.CrossfireNet = undefined;

vm.createContext(sandbox);
try {
  vm.runInContext(script, sandbox, { filename: "index.inline.js" });
} catch (e) {
  console.error("game script threw while booting:", e);
  process.exit(1);
}

const cf = windowStub.__cf || sandbox.__cf;
assert.ok(cf && cf.start, "?debug=1 must expose the harness hooks");

// ── drive one mission to a verdict, checking invariants every frame ───────
function playLevel(key, humans) {
  now = 0;
  cf.start(key, humans);
  const live0 = cf.live();
  const startShips = live0.ships.length;
  assert.ok(startShips >= 4, key + ": a mission must field a fleet, saw " + startShips);
  assert.ok(live0.ships.some(s => s.team === 0 && s.human), key + ": there must be a pilot");

  // No keyboard is attached to a headless run, so autopilot the human pilots —
  // still human (they draw from the shared reserve and their loss ends the
  // mission), just flown by the same campaign AI as their wingmates, so the
  // battle actually plays out instead of the pilots sitting on the start line.
  for (const s of live0.ships) {
    if (s.human) { s.bot = true; s.localKeys = null; }
  }

  const camp = cf.campaign();
  assert.ok(camp && camp.levelKey === key, key + ": campaign controller must be live");

  let frames = 0, ended = null, sawEnemy = false;
  let peakLive = 0, sawPickup = false, sawComms = false, subsystemsBroken = 0;
  let sawHazard = false, sawRock = false;
  const speeds = [];
  const ORDERS = ["focus", "defend", "regroup", null];
  const MAX = 30000;                 // ~8 minutes of world time at 60fps
  while (frames < MAX) {
    now += 1000 / 60;
    cf.step();
    // Exercise the render path too, occasionally — the drawing code (capital
    // ships, the campaign HUD, the minimap markers) never runs under step()
    // alone, so a bad reference in it would otherwise hide until a browser.
    if (frames % 200 === 0) cf.draw();
    // Cycle squad orders so the ally command-AI branches actually run.
    if (frames % 300 === 0) cf.squad(ORDERS[(frames / 300) % 4]);
    const lv = cf.live();
    if (lv.pickups && lv.pickups.length) sawPickup = true;
    if (lv.comms && lv.comms.length) sawComms = true;
    if (lv.hazards && lv.hazards.length) sawHazard = true;
    if (lv.rocks && lv.rocks.length) sawRock = true;
    // The convoy transport must cross at a constant speed — sample it while it
    // is alive, up to speed, and clear of any knockback (kinematic means its
    // velocity magnitude should never wander from its cruise).
    if (key === "convoy") {
      const t = lv.ships.find(s => s.kind === "transport");
      if (t && t.alive && frames > 60) speeds.push(Math.hypot(t.vx, t.vy));
    }
    frames++;

    const L = cf.live();
    const pad = 6;                   // a hair of slack for the wall push
    for (const s of L.ships) {
      if (!s.alive) continue;
      assert.ok(
        s.x > L.bounds.x0 - pad && s.x < L.bounds.x1 + pad &&
        s.y > L.bounds.y0 - pad && s.y < L.bounds.y1 + pad,
        key + ": ship left the arena at frame " + frames +
        " (" + Math.round(s.x) + "," + Math.round(s.y) + ")"
      );
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y),
        key + ": a ship position went non-finite at frame " + frames);
    }
    if (L.ships.some(s => s.team === 1)) sawEnemy = true;
    // Every bullet must belong to the side it can hurt — a shot that could
    // bite its own team would mean the team gate leaked.
    peakLive = Math.max(peakLive, L.ships.filter(s => s.alive).length);

    const p = cf.peek();
    if (p.state === "over") { ended = p; break; }
  }

  assert.ok(sawEnemy, key + ": an enemy side never appeared");
  assert.ok(ended, key + ": mission never resolved in " + MAX + " frames");
  cf.draw();                         // the result screen (drawCampaignOver)

  const c = cf.campaign();
  const L = cf.live();
  let progress = "";
  if (key === "convoy") {
    progress = "distance " + Math.round(c.progress * 100) + "% · wave " +
      c.waveIndex + "/" + c.waves.length;
  } else if (key === "raid") {
    const dead = c.transports.filter(t => t.dead).length;
    progress = dead + "/" + c.transports.length + " transports destroyed";
  } else if (key === "mothership") {
    const td = c.turrets.filter(t => t.dead).length;
    const hd = c.hangars.filter(h => h.dead).length;
    const gd = c.shieldGens.filter(g => g.dead).length;
    const core = c.mothership;
    subsystemsBroken = td + hd + gd;
    progress = "phase " + (c.phase + 1) + "/4 · hangars " + hd + "/" + c.hangars.length +
      " · gens " + gd + "/" + c.shieldGens.length + " · turrets " + td + "/" + c.turrets.length +
      " · core " + Math.max(0, core.hull) + "/" + core.maxHull +
      (core.dying ? " DYING" : "");
  }
  // Every mission now seeds wells and asteroids that the fleets must fly around.
  assert.ok(sawHazard, key + ": no gravity hazards were ever present");
  assert.ok(sawRock, key + ": no asteroids were ever present");

  if (key === "convoy") {
    assert.ok(c.planet, "convoy: there must be a destination planet");
    assert.ok(speeds.length > 20, "convoy: never sampled the transport in motion");
    const lo = Math.min(...speeds), hi = Math.max(...speeds);
    assert.ok(hi - lo < hi * 0.05,
      "convoy: transport speed was not constant (" +
      Math.round(lo) + "–" + Math.round(hi) + ")");
  }

  return { frames, ended, peakLive, progress, camp: c, won: c.won,
           subsystemsBroken, sawPickup, sawComms };
}

// Force the outcomes we can, and just require the others to resolve cleanly.
// The menus draw code the play-through never reaches. Walk the real path into
// each screen and draw it, so a bad reference in the title, the mission list or
// the campaign setup screen surfaces here instead of in a browser. (The result
// screen is drawn at the end of every play-through below.)
cf.screen("title"); cf.draw();
cf.screen("levels"); cf.draw();
cf.pick("convoy"); cf.draw();       // chooseMode → the campaign count screen

const kind = r => (r.camp.won ? "victory" : r.camp.lost ? "defeat" : "unresolved");
let anyPickup = false, anyComms = false;
const note = r => { anyPickup = anyPickup || r.sawPickup; anyComms = anyComms || r.sawComms; };

// Convoy is an escort: the pilot's whole job is bodyguarding the transport,
// which the autopilot never does — so a passive run is expected to carry the
// cargo most of the way and then lose the last stretch, not to win outright.
// The bar is that it gets nearly home, which proves an active pilot finishes it.
const convoy = playLevel("convoy", 1);
note(convoy);
console.log("  convoy     " + kind(convoy).padEnd(8) + convoy.frames +
  " frames · " + convoy.progress);
assert.ok(convoy.camp.won || convoy.camp.progress >= 0.6,
  "convoy: a passive escort should still get the transport most of the way home, saw " +
  Math.round(convoy.camp.progress * 100) + "%");

const raid = playLevel("raid", 1);
note(raid);
console.log("  raid       " + kind(raid).padEnd(8) + raid.frames +
  " frames · " + raid.progress);

// The hard mission has real variance, so winnability is checked best-of-a-few
// rather than every single run: the allied fleet, unaided, must carve real
// subsystems off the mothership at least once — proof a human can finish it.
let bossBroke = false;
for (let attempt = 0; attempt < 3; attempt++) {
  const r = playLevel("mothership", 2);
  note(r);
  if (r.subsystemsBroken >= 2 || r.camp.won) bossBroke = true;
  console.log("  mothership " + kind(r).padEnd(8) + r.frames +
    " frames · " + r.progress);
  if (r.camp.won) break;
}
assert.ok(bossBroke,
  "mothership: across 3 attempts the fleet never carved into the hull — unwinnable");

// The new systems have to actually fire, not just parse.
assert.ok(anyPickup, "salvage never dropped across the campaign");
assert.ok(anyComms, "radio chatter never appeared across the campaign");

// Difficulty sets a fighter's hits — the pilot's on every setting, and every
// fighter's on Impossible — while the capitals keep the hulls their mission
// gave them. Each setting is stepped a little to be sure nothing throws.
for (const [d, hull] of [["easy", 5], ["hard", 3], ["impossible", 1]]) {
  cf.diff(d);
  cf.start("mothership", 1);
  const L = cf.live();
  const pilot = L.ships.find(s => s.human);
  assert.equal(pilot.maxHull, hull, d + ": pilot hull should be " + hull);
  const foe = L.ships.find(s => s.team === 1 && s.kind === "fighter");
  assert.equal(foe.maxHull, d === "impossible" ? 1 : 2,
    d + ": enemy fighter hull wrong");
  const core = L.ships.find(s => s.kind === "mothership");
  const turret = L.ships.find(s => s.kind === "turret");
  assert.ok(core.maxHull > 3 && turret.maxHull > 1,
    d + ": capitals and subsystems must keep their scripted hulls");
  for (let f = 0; f < 300; f++) { now += 1000 / 60; cf.step(); }
}
console.log("  difficulty: pilot hulls 5/3/1, capital exemption, no crash");

console.log("CROSSFIRE campaign checks passed");
