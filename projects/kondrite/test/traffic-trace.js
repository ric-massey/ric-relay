#!/usr/bin/env node
"use strict";

/* KONDRITE — WHAT THE TRAFFIC DID
   ─────────────────────────────────────────────────────────────────────────────
   A hash of the sector's traffic, frame by frame, for changing how the traffic
   is written without changing what it does. It does for the pilots what
   fingerprint.js does for the generator.

   The traffic AI is the part of the game most likely to be reorganised as it
   grows, and it is the part the other suites can least see: they ask whether a
   raider eventually attacks, not whether it attacked on the same frame from the
   same place. A refactor that nudged one decision by one frame passes all of
   them. This does not.

   So: run it, change the code, run it again. If the hashes match, the change
   moved code and nothing else. If they do not, it changed behaviour — which may
   be what you meant, but then it is not a refactor, and the other suites are
   the judge.

       node test/traffic-trace.js            # the default flights, ~3 minutes
       node test/traffic-trace.js 1 606061   # or your own seeds

   Each flight is one seed, one place and one pair of hands: the player is put
   down at home, in a busy lane, in contested sky or in the deep, and cruises a
   fixed pattern of thrust, turn and fire, so the traffic has somebody to notice, chase, run from
   and shoot at. Time and Math.random are the harness's, so a flight is the same
   flight every run. Everything a traffic ship carries goes into the hash — every
   number, flag and name on it, with other ships named by id — along with the
   player, every round in the air and the purse. It prints what each flight
   exercised too, because a trace of an empty sky proves nothing. */

const crypto = require("node:crypto");
const vm = require("node:vm");
const page = require("./page.js");

const noop = () => {};
function stubCtx() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return str => ({ width: String(str).length * 8 });
      if (k === "createLinearGradient" || k === "createRadialGradient" ||
          k === "createPattern") return () => ({ addColorStop: noop });
      return k in t ? t[k] : (t[k] = noop);
    },
    set: (t, k, v) => (t[k] = v, true)
  });
}
function makeDoc() {
  const byId = new Map();
  const make = id => ({
    id, style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop, click: noop,
    replaceChildren: noop, insertBefore: noop, remove: noop, scrollIntoView: noop,
    cloneNode: () => make(id + "-copy"), select: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => make(id + "-q"), querySelectorAll: () => [],
    hidden: true, value: "", textContent: "", placeholder: "",
    width: 1000, height: 700, clientWidth: 1200, clientHeight: 800,
    dataset: {}, children: [], parentNode: null
  });
  const get = id => { if (!byId.has(id)) byId.set(id, make(id)); return byId.get(id); };
  return {
    getElementById: get, querySelector: () => get("?"), querySelectorAll: () => [],
    createElement: () => make("new"), addEventListener: noop, removeEventListener: noop,
    body: get("body"), documentElement: get("html"), hidden: false, visibilityState: "visible",
    exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
  };
}

/* The same generator the other suites use, seeded per flight. */
function seededMath(seed) {
  let s = seed | 0;
  const m = Object.create(Math);
  m.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return m;
}

function boot(seed) {
  let now = 0;
  const store = {};
  const search = "?debug=1&seed=" + seed;
  const windowStub = {
    KONDRITE_NO_INTRO: !globalThis.KONDRITE_INTRO,
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: i => Object.keys(store)[i] ?? null
    },
    location: { search, href: "http://localhost/" + search, hash: "", origin: "http://localhost", pathname: "/" },
    history: { replaceState: noop },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const node = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = node())), apply: () => node() });
      return { createOscillator: node, createGain: node, createBufferSource: node,
               createBuffer: node, createBiquadFilter: node, createStereoPanner: node,
               createDynamicsCompressor: node, destination: {}, state: "running",
               resume: noop, close: noop, get currentTime() { return now / 1000; } };
    },
    performance: { now: () => now },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams, fetch: async () => { throw new TypeError("Failed to fetch"); }
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: makeDoc(), navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math: seededMath(seed * 0x9e3779b1), Date, JSON, Object, Array, String,
    Number, Boolean, Symbol, Float32Array, Uint8Array, Map, Set, Promise, RegExp,
    Error, TypeError, isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  page.boot(sandbox);
  const cf = windowStub.__cf || sandbox.__cf;
  const run = code => vm.runInContext(code, sandbox);
  return { cf, run, step: () => { now += 1000 / 60; cf.step(); } };
}

/* A value as text, exactly: every float in full, other ships by id, and plain
   nested records one level down. Functions and DOM-ish things are not state. */
function describe(v, depth) {
  if (v === null || v === undefined) return String(v);
  const t = typeof v;
  if (t === "number") return Object.is(v, -0) ? "-0" : String(v);
  if (t === "string") return JSON.stringify(v);
  if (t === "boolean") return v ? "T" : "F";
  if (t !== "object") return "";
  if (v.id !== undefined && depth > 0) return "#" + v.id;
  if (depth > 1) return "{}";
  if (Array.isArray(v)) return "[" + v.map(x => describe(x, depth + 1)).join(",") + "]";
  if (v instanceof Map || v instanceof Set) return "<" + v.size + ">";
  return "{" + Object.keys(v).sort().map(k => k + ":" + describe(v[k], depth + 1)).join(",") + "}";
}

/* Four kinds of sky, found per seed on a grid around home: home itself, the
   busiest safe lane, the busiest contested sky, and the most dangerous sky that
   has anybody in it at all. Danger and traffic are properties of regions, not of
   distance, and the busiest places are mostly safe — so they are searched for
   rather than guessed. */
const PLACES = {
  home: "null",
  lanes: "d < 0.3 ? t : -1",
  contested: "d >= 0.3 && d < 0.6 ? t : -1",
  deep: "t > 0.05 ? d : -1"
};
const FRAMES = 60 * 90;

function fly(seed, where) {
  const g = boot(seed);
  g.cf.start("survey", 1);
  const spot = g.run(`(() => {
    const score = (t, d) => ${PLACES[where]};
    if (score(0, 0) === null) return { x: ships[0].x, y: ships[0].y, danger: dangerAt(ships[0].x, ships[0].y) };
    let best = null;
    for (let i = -150; i <= 150; i += 3) for (let j = -150; j <= 150; j += 3) {
      const x = i * CHUNK, y = j * CHUNK;
      const v = score(abund("traffic", x, y), dangerAt(x, y)) - Math.hypot(i, j) / 5000;
      if (v > 0 && (!best || v > best.v)) best = { x, y, v, danger: dangerAt(x, y) };
    }
    return best;
  })()`);
  if (!spot) return null;
  g.run(`ships[0].x = ${spot.x}; ships[0].y = ${spot.y};`);
  const hash = crypto.createHash("sha256");
  const seen = { frames: 0, ships: new Set(), kinds: new Set(), rounds: 0, maxHere: 0, deaths: 0 };
  let wasAlive = true, deadAt = -1;
  for (let f = 0; f < FRAMES; f++) {
    // Cruise: mostly thrust, so new chunks keep streaming in, a turn every
    // few seconds so the line is not straight, and the trigger half the time.
    const beat = f % 300;
    g.run(`keys.clear();` +
          (beat < 250 ? `keys.add("KeyW");` : "") +
          (beat >= 250 || (f % 900 > 870) ? `keys.add("KeyD");` : "") +
          (f % 120 < 60 ? `keys.add("Space");` : ""));
    g.step();
    const s = g.run(`[surv ? surv.traffic : [], ships[0], bullets, surv ? surv.cash : 0, state]`);
    const [traffic, me, rounds, cash, state] = s;
    hash.update(f + "|" + state + "|" + describe(me, 0) + "|" + cash + "|");
    for (const t of traffic) {
      hash.update(describe(t, 0));
      seen.ships.add(t.id); seen.kinds.add(t.kind + "/" + t.role);
    }
    hash.update("|" + rounds.map(b => describe(b, 0)).join(";"));
    seen.rounds += rounds.length;
    seen.maxHere = Math.max(seen.maxHere, traffic.length);
    if (wasAlive && !me.alive) { seen.deaths++; deadAt = f; }
    wasAlive = me.alive;
    // Back out three seconds after a death, as a player would press on, so a
    // flight does not spend its last minute looking at the death page.
    if (!me.alive && f - deadAt === 180) {
      g.run(`surveyRespawn(); ships[0].x = ${spot.x}; ships[0].y = ${spot.y};`);
    }
    seen.frames++;
  }
  return { hash: hash.digest("hex").slice(0, 16), seen, spot };
}

module.exports = { boot, fly, describe };

if (require.main === module) {
  const seeds = process.argv.slice(2).map(Number).filter(n => n > 0);
  for (const seed of seeds.length ? seeds : [1, 606061, 42, 7]) {
    for (const where of Object.keys(PLACES)) {
      const t0 = Date.now();
      const out = fly(seed, where);
      if (!out) { console.log(`  seed ${seed}: no ${where} sky within reach`); continue; }
      const { hash, seen, spot } = out;
      console.log(`  seed ${String(seed).padEnd(7)} ${where.padEnd(10)} danger ${spot.danger.toFixed(2)}  ${hash}` +
        `   ${seen.ships.size} ships (${seen.kinds.size} kinds, ${seen.maxHere} at once)` +
        ` · ${seen.rounds} round-frames · ${seen.deaths} deaths · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  }
  console.log("KONDRITE traffic trace done — compare the hashes before and after");
}
