#!/usr/bin/env node
"use strict";

/* KONDRITE - ENCOUNTERS THAT CONTINUE
   ----------------------------------------------------
   WORLD-IDEAS.md, "Encounters could continue" (built 2026-11-14). A ship you
   saved used to have a name and one line that never changed. As assertions:

     - a saved ship met again with cargo aboard puts the dock it is really
       flying to on your chart, by name, and on its own line - once;
     - one with no cargo, or no dock, says nothing: no errand is invented;
     - nothing on the page counts meetings;
     - when the hull carrying the name is destroyed the name is kept, struck
       as lost, reported on COMMS, and never flies again;
     - if the guns were yours, the line says so;
     - a pirate that gets away a second time is remembered as having done so;
     - all of it survives the book, and a book cannot write nonsense into it.

   Run it:  node test/encounters.js                                         */

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
  assert.ok(cf && cf.killTraffic, "?debug=1 must expose the encounter hooks");
  return { cf, store,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}


const g = boot("?debug=1&seed=717171");
const cf = g.cf;
cf.start("survey", 1);
const surv = cf.survey();
const me = cf.live().ships[0];
const flag = cf.surveyView().standings[0].key;
me.x = 30000; me.y = -22000; me.invuln = 999; surv.water = 1200;
g.step(2);

const hauler = (id, extra) => Object.assign({
  id, kind: "freight", role: "freight", faction: flag, hull: "drayman",
  x: me.x + 400, y: me.y, a: 0, from: { x: me.x + 400, y: me.y },
  to: { x: me.x + 9000, y: me.y }, leg: 1, speed: 100, baseSpeed: 100,
  hp: 6, maxHp: 6, cargo: [], cool: 1, guards: 0, space: 0, trades: false,
  phase: 0, tank: 90, tankFull: 90
}, extra || {});

/* Two ships saved, so one can be lost to the sector and one to you. */
function save(id) {
  surv.traffic.length = 0;
  const t = hauler(id, { tank: 0, adrift: true, doom: 200 });
  surv.traffic.push(t);
  g.step(2);
  surv.water = 1200;
  cf.key("KeyE");
  return t;
}
save("a"); save("b");
check(surv.friends.length === 2, "two rescues wrote down " + surv.friends.length + " ships");
const [fa, fb] = surv.friends;

function meet(f, extra) {
  surv.traffic.length = 0;
  for (let k = 0; k < 2000; k++) {
    const t = hauler("m" + f.name + k, extra);
    cf.adopt(t);
    if (t.friend === f) { surv.traffic.push(t); return t; }
    if (t.friend) { t.friend = null; }
  }
  return null;
}

// 1. met with nothing aboard: a greeting and no errand
let t = meet(fa);
check(!!t, "the first saved ship never turned up again");
g.step(4);
check(t && t.greeted, "a saved ship in talking range did not greet you");
check(!fa.bound, "a ship with an empty hold named a dock: " + fa.bound);

// 2. met with cargo and a real dock: the dock goes on the chart, once
const dock = { x: me.x + 14000, y: me.y + 3000, faction: flag };
t = meet(fa, { cargo: ["iron", "iron"], markKind: "station", mark: dock });
g.step(4);
check(!!fa.bound && fa.bound.length > 2, "a loaded friend did not say where it was bound");
const charted = () => [...surv.known.values()].filter(k => k.k === "station" && k.name === fa.bound).length;
check(charted() === 1, "the dock it is bound for did not go on the chart");
const stillBound = fa.bound;
g.step(30);
check(fa.bound === stillBound && charted() === 1, "the same dock was noted twice");

// 3. the page: the dock, and no count of anything
g.drawn();
cf.screen("record"); cf.draw();
let words = g.drawn().join(" | ");
check(words.indexOf(fa.bound) >= 0, "the record page does not show where a friend was bound");
check(!/\bmet\b|\d+\s*(times|×)/i.test(words.split("WHO KNOWS YOU")[1] || ""),
      "the list of who knows you has grown a tally");
cf.screen("survey");

// 4. the sector kills it: the name is kept, struck, reported, and grounded
const comms0 = cf.comms.raw().list.length;
check(cf.killTraffic(t, false), "the harness could not destroy the ship");
check(fa.lost === "gone", "a friend the sector killed is not marked lost: " + fa.lost);
check(surv.friends.indexOf(fa) >= 0, "a lost ship was taken off the record");
const news = cf.comms.raw().list[0];
check(cf.comms.raw().list.length === comms0 + 1 && news.from === fa.name,
      "losing a ship you knew put nothing on COMMS");
check(meet(fa) === null, "a lost ship's name flew again");

// 5. your guns
t = meet(fb);
check(!!t, "the second saved ship never turned up again");
g.step(2);
cf.killTraffic(t, true);
check(fb.lost === "you", "a friend you destroyed is not marked as yours: " + fb.lost);
g.drawn();
cf.screen("record"); cf.draw();
words = g.drawn().join(" | ");
check(/destroyed by you/.test(words), "the page does not say you destroyed a ship you had saved");
check(/\blost\b/.test(words), "the page does not say a ship was lost");
cf.screen("survey");

// 6. the one that got away, twice
surv.traffic.length = 0;
surv.grudges.length = 0;
surv.grudges.push({ name: "THE TEST", hull: "needle", hp: 3, cool: 0, runs: 1 });
cf.grudgeVisit(1);
const back = surv.traffic.find(x => x.grudge);
check(!!back && back.runs === 1, "the one that got away did not come back as itself");
check(surv.grudges.length === 0, "a grudge that is on the screen is still in the queue");
if (back) {
  // It leaves the sector hurt a second time: the streaming code calls this.
  surv.traffic.length = 0;
  cf.remember(back);
  check(surv.grudges.length === 1 && surv.grudges[0].runs === 2,
        "getting away twice was not remembered: " + JSON.stringify(surv.grudges));
  check(cf.surveyView().whoKnows.grudges[0].runs === 2, "the page is not told it got away twice");
}

// 7. the book
cf.saveBook();
const g2 = boot("?debug=1&seed=717171", g.store);
g2.cf.start("survey", 1);
const s2 = g2.cf.survey();
check(s2.friends.length === 2 && s2.friends[0].lost === "gone" && s2.friends[1].lost === "you" &&
      s2.friends[0].bound === stillBound, "the record did not survive the book: " + JSON.stringify(s2.friends));
check(s2.grudges.length === 1 && s2.grudges[0].runs === 2, "a second escape did not survive the book");

const key = Object.keys(g.store).find(k => /"friends"/.test(g.store[k]));
const bad = Object.assign({}, g.store);
const book = JSON.parse(bad[key]);
const hold = book.friends ? book : Object.values(book).find(v => v && v.friends) || book;
hold.friends[0].bound = "X".repeat(400);
hold.friends[0].lost = { evil: true };
hold.grudges[0].runs = 1e9;
bad[key] = JSON.stringify(book);
const g3 = boot("?debug=1&seed=717171", bad);
g3.cf.start("survey", 1);
const s3 = g3.cf.survey();
if (s3.friends.length) {
  check(s3.friends[0].bound.length <= 24 && typeof s3.friends[0].lost === "string" &&
        s3.friends[0].lost.length <= 20, "a hand-edited book wrote nonsense onto a friend");
}
if (s3.grudges.length) check(s3.grudges[0].runs <= 9, "a hand-edited book made a pirate escape a billion times");

if (problems.length) {
  console.error("\nENCOUNTERS FAILED - " + problems.length + " problem(s):\n");
  for (const p of problems) console.error("  x " + p);
  process.exit(1);
}
console.log("encounters: a saved ship says where it trades, a lost one stays lost, and the book keeps both");
