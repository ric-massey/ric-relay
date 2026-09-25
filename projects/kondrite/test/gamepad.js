#!/usr/bin/env node
"use strict";

/* KONDRITE — THE GAMEPAD
   ─────────────────────────────────────────────────────────────────────────────
   C6 on the list: "read a gamepad — sticks to turn and thrust, a trigger to
   fire, buttons on the four Survey slots, and the tab naming what is plugged
   in." The Gamepad API is a snapshot the game polls, so the whole feature is
   testable with a fake `navigator.getGamepads` that the test owns.

   What is asserted, in the order a player meets it: with nothing plugged in
   the game is exactly as it was; a pad that appears is named on the CONTROLLER
   tab; at the title, A starts the game and does so ONCE however long it is
   held; in the cockpit the stick turns, the stick and the trigger thrust, A
   fires, and holding A does not keep pressing Enter; X presses slot one the way
   the bound key would; START pauses; and unplugging it lets go of everything.

   Run it:  node test/gamepad.js                                               */

const assert = require("node:assert/strict");
const vm = require("node:vm");
const page = require("./page.js");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const noop = () => {};

/* A canvas that remembers what was written on it, so the settings tab can be
   read back. Everything else is a no-op. */
const drawn = [];
function stubCtx() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return str => ({ width: String(str).length * 8 });
      if (k === "fillText" || k === "strokeText") return str => { drawn.push(String(str)); };
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
    id,
    style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    removeChild: noop, setAttribute: noop, removeAttribute: noop, focus: noop,
    blur: noop, click: noop, replaceChildren: noop, insertBefore: noop,
    remove: noop, scrollIntoView: noop, cloneNode: () => make(id + "-copy"),
    select: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => make(id + "-q"), querySelectorAll: () => [],
    hidden: true, value: "", textContent: "", placeholder: "",
    width: 1000, height: 700, clientWidth: 1200, clientHeight: 800,
    dataset: {}, children: [], parentNode: null
  });
  const get = id => { if (!byId.has(id)) byId.set(id, make(id)); return byId.get(id); };
  return {
    get,
    doc: {
      getElementById: get, querySelector: () => get("?"), querySelectorAll: () => [],
      createElement: () => make("new"), addEventListener: noop, removeEventListener: noop,
      body: get("body"), documentElement: get("html"),
      hidden: false, visibilityState: "visible",
      exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
    }
  };
}

/* Boot the game with a `navigator.getGamepads` the test controls. `pads` is
   the array it returns; put a pad in it, or take it out, between steps. */
function boot() {
  const pads = [];
  const store = {};
  const D = makeDoc();
  let now = 0;
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
    location: { search: "?debug=1", href: "http://localhost/?debug=1", hash: "",
                origin: "http://localhost", pathname: "/" },
    history: { replaceState: noop },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const audioNode = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = audioNode())),
        apply: () => audioNode()
      });
      return { createOscillator: audioNode, createGain: audioNode,
               createBufferSource: audioNode, createBuffer: audioNode,
               createBiquadFilter: audioNode, createStereoPanner: audioNode,
               createDynamicsCompressor: audioNode,
               destination: {}, state: "running", resume: noop, close: noop,
               get currentTime() { return now / 1000; } };
    },
    performance: { now: () => now },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams,
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: D.doc,
    navigator: { userAgent: "node", maxTouchPoints: 0, getGamepads: () => pads },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, TypeError,
    isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  page.boot(sandbox);
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.gamepad, "?debug=1 must expose the gamepad hook");
  return {
    cf, pads, el: D.get,
    step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
    drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; }
  };
}

/* A pad in the standard layout, at rest. `press` and `stick` change it in
   place, the way a real one changes between polls. */
function fakePad(id) {
  const p = { id: id || "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
              connected: true, mapping: "standard",
              buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
              axes: [0, 0, 0, 0] };
  p.press = (i, on) => { p.buttons[i].pressed = !!on; p.buttons[i].value = on ? 1 : 0; };
  p.stick = (x, y) => { p.axes[0] = x; p.axes[1] = y; };
  return p;
}

// ── 1. nothing plugged in is nothing changed ───────────────────────────────
{
  const g = boot();
  g.cf.screen("title");
  g.step(3);
  check(!g.cf.gamepad().on, "with no pad the game thought one was on");
  check(g.cf.screenNow() === "title", "with no pad the title screen moved on its own");
  console.log("  nopad      with nothing plugged in, nothing happens");
}

// ── 2. the tab names it ────────────────────────────────────────────────────
{
  const g = boot();
  g.cf.screen("title");
  g.cf.key("KeyC");
  g.cf.setCat("controls");
  g.cf.setTab("pad");
  g.step(1); g.cf.draw();
  let words = g.drawn().join(" | ");
  check(/NOTHING PLUGGED IN/.test(words), "the tab did not say nothing was plugged in");
  check(/press any button/i.test(words), "the tab did not say how to wake a pad");
  g.pads.push(fakePad());
  g.step(1); g.cf.draw();
  words = g.drawn().join(" | ");
  check(/XBOX WIRELESS CONTROLLER/.test(words), "the tab did not name the pad: " + words.slice(0, 200));
  check(!/Vendor|Product|STANDARD GAMEPAD/.test(words), "the tab printed the driver half of the id");
  check(/turn/.test(words) && /fire/.test(words) && /slots/.test(words),
        "the tab does not say what the pad does");
  g.pads[0].press(0, true);
  g.step(1); g.cf.draw();
  check(/pressing A/.test(g.drawn().join(" | ")), "the tab does not show what is being pressed");
  console.log("  tab        names the pad without its driver id · says the layout · shows what is pressed");
}

// ── 3. at the title, A is Enter, once ──────────────────────────────────────
{
  const g = boot();
  g.cf.screen("title");
  const pad = fakePad(); g.pads.push(pad);
  pad.press(0, true);
  g.step(1);
  check(g.cf.peek().mode === "SURVEY", "A at the title did not start the game");
  check(g.cf.gamepad().last === "Enter", "A was not pressed as Enter");
  // Held down through the start: no second press arrives.
  const before = g.cf.gamepad().last;
  g.step(30);
  check(g.cf.gamepad().last === before, "holding A kept pressing Enter");
  console.log("  title      A starts the game, once, however long it is held");
}

// ── 4. in the cockpit ──────────────────────────────────────────────────────
{
  const g = boot();
  const pad = fakePad(); g.pads.push(pad);
  g.cf.start("survey", 1);
  g.cf.screen("playing");
  const me = () => g.cf.live().ships[0];
  pad.stick(-1, 0); g.step(1);
  check(me().input.l && !me().input.r, "the stick left did not turn left");
  pad.stick(1, 0); g.step(1);
  check(me().input.r && !me().input.l, "the stick right did not turn right");
  pad.stick(0.1, -0.05); g.step(1);
  check(!me().input.l && !me().input.r && !me().input.th, "a stick at rest is still steering");
  pad.stick(0, -1); g.step(1);
  check(me().input.th, "the stick forward did not thrust");
  pad.stick(0, 0); pad.press(7, true); g.step(1);
  check(me().input.th, "the right trigger did not thrust");
  pad.press(7, false); g.step(1);
  check(!me().input.th, "letting go of the trigger did not stop the thrust");
  pad.press(0, true); g.step(1);
  check(me().input.f, "A did not fire");
  check(g.cf.gamepad().last !== "Enter", "A pressed Enter in the cockpit");
  pad.press(0, false);
  // Slot one, the way the bound key would press it.
  const slotKey = g.cf.deviceKeys()[0][0];
  pad.press(2, true); g.step(1);
  check(g.cf.gamepad().last === slotKey, "X did not press slot one (" + slotKey + "), pressed " + g.cf.gamepad().last);
  pad.press(2, false); g.step(1);
  // START pauses.
  pad.press(9, true); g.step(1);
  check(g.cf.screenNow() === "paused" || g.cf.screenNow() === "menu",
        "START did not pause: " + g.cf.screenNow());
  console.log("  cockpit    stick turns · stick and RT thrust · A fires and is not Enter · X is slot one · START pauses");
}

// ── 5. unplugged is let go of ──────────────────────────────────────────────
{
  const g = boot();
  const pad = fakePad(); g.pads.push(pad);
  g.cf.start("survey", 1);
  g.cf.screen("playing");
  pad.stick(-1, -1); pad.press(0, true); g.step(1);
  const me = () => g.cf.live().ships[0];
  check(me().input.l && me().input.th && me().input.f, "(the pad was being read)");
  g.pads.length = 0; g.step(1);
  check(!g.cf.gamepad().on, "an unplugged pad still read as on");
  check(!me().input.l && !me().input.th && !me().input.f, "an unplugged pad left the ship flying itself");
  console.log("  unplugged  everything is let go of");
}

if (problems.length) {
  console.log("KONDRITE gamepad checks FAILED");
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("KONDRITE gamepad checks passed");
