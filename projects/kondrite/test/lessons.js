#!/usr/bin/env node
"use strict";

/* KONDRITE - A PART TEACHES THE ROOM IT LIGHTS
   ----------------------------------------------------
   Ric, 2026-11-13: "make them make sense. like jump coil should show the
   jumping." So the parts were re-paired with the rooms they turn on, and each
   has one errand that uses that room. As assertions:

     - the pairing is the one that makes sense: the coil is the wormhole,
       the plate is the dock, the spar is the hangar, and every room has
       exactly one part;
     - every part has an errand, and the errand is about what the part is;
     - an errand is ticked where the thing is done, and only once its part
       is home;
     - the missions page shows it until then, including after the station
       is whole, and the tick survives the book.

   Run it:  node test/lessons.js                                            */

const assert = require("node:assert/strict");
const vm = require("node:vm");
const page = require("./page.js");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const noop = () => {};

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
  return { get, doc: {
    getElementById: get, querySelector: () => get("?"), querySelectorAll: () => [],
    createElement: () => make("new"), addEventListener: noop, removeEventListener: noop,
    body: get("body"), documentElement: get("html"), hidden: false, visibilityState: "visible",
    exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null } };
}
function boot(search, store) {
  store = store || {};
  const D = makeDoc();
  let now = 0;
  const windowStub = {
    KONDRITE_NO_INTRO: true,
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
      const audioNode = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = audioNode())), apply: () => audioNode() });
      return { createOscillator: audioNode, createGain: audioNode, createBufferSource: audioNode,
               createBuffer: audioNode, createBiquadFilter: audioNode, createStereoPanner: audioNode,
               createDynamicsCompressor: audioNode, destination: {}, state: "running",
               resume: noop, close: noop, get currentTime() { return now / 1000; } };
    },
    performance: { now: () => now },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams, fetch: async () => { throw new TypeError("Failed to fetch"); }
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: D.doc, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, TypeError,
    isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  page.boot(sandbox);
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.lessons, "?debug=1 must expose the lesson hooks");
  return { cf, store,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}


const g = boot("?debug=1&seed=424242");
g.cf.start("survey", 1);
const surv = g.cf.survey();
const L = g.cf.lessons;

// 1. the pairing
const pairs = L.pairs();
const want = { spar: "hangar", core: "counter", lens: "market", coil: "mouth",
               beacon: "stock", plate: "dock" };
for (const k of Object.keys(want)) {
  check(pairs[k] === want[k], "the " + k + " lights the " + pairs[k] + "; it should light the " + want[k]);
}
check(new Set(Object.values(pairs)).size === 6, "two parts light the same room");
const rooms = L.rooms();
for (const k of Object.keys(want)) {
  check(rooms[want[k]] === k, "the " + want[k] + " does not name the " + k + " as the part it wants");
}

// 2. every part has an errand, in its own words
const all = L.all();
const WORD = { spar: /SHIPS/, core: /fit/, lens: /JOBS/, coil: /jump/, beacon: /COMMS/, plate: /repair/ };
for (const k of Object.keys(want)) {
  check(typeof all[k] === "string" && all[k].length > 8, "the " + k + " has no errand");
  check(WORD[k].test(all[k] || ""), "the " + k + "'s errand is not about what the " + k + " is: " + all[k]);
  check((all[k] || "").length <= 34, "the " + k + "'s errand is too long for its row on the missions page");
}

// 3. ticked where it is done, and only once the part is home
check(L.did("coil") === false, "a lesson was ticked for a part that is not home");
check(!L.done("coil"), "the coil's errand is done before the coil is home");
surv.built.add("coil");
check(!L.done("coil"), "bringing the coil home ticked its own errand");
g.cf.jump(900, 900);
check(L.done("coil"), "jumping through the mouth did not tick the coil's errand");
check(L.did("coil") === false, "an errand was ticked twice");

surv.built.add("beacon");
check(!L.done("beacon"), "the beacon's errand is done before the page was opened");
g.cf.comms.openPage();
check(L.done("beacon"), "opening COMMS did not tick the beacon's errand");
g.cf.screen("playing");

// 4. the missions page, before and after the station is whole
surv.built.add("plate");
g.drawn();
g.cf.screen("missions");
g.cf.draw();
let words = g.drawn().join(" | ");
check(words.indexOf("try it") >= 0 && /repair/.test(words), "the missions page does not show an open errand");
check(words.indexOf(all.coil) < 0, "a finished errand is still on the missions page");
for (const k of ["spar", "core", "lens"]) surv.built.add(k);
g.cf.draw();
words = g.drawn().join(" | ");
check(/repair/.test(words) && /SHIPS/.test(words), "the open errands left the page when the station became whole");
check(words.indexOf(all.beacon) < 0, "a finished errand came back when the station became whole");

// 5. the book
g.cf.screen("playing");
g.cf.saveBook();
const g2 = boot("?debug=1&seed=424242", g.store);
g2.cf.start("survey", 1);
check(g2.cf.lessons.done("coil") && g2.cf.lessons.done("beacon"), "a finished errand did not survive the book");
check(!g2.cf.lessons.done("plate"), "an open errand came back from the book finished");

if (problems.length) {
  console.error("KONDRITE lesson checks FAILED:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("KONDRITE lesson checks passed");
