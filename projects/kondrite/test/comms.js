#!/usr/bin/env node
"use strict";

/* KONDRITE — TRANSMISSIONS
   ────────────────────────────────────────────────────
   Ric, 2026-11-13: "a transmission page for big stuff like close wars and
   stuff and people trying to talk to you and you have to go to that page to
   see the information." And WORLD-IDEAS.md §3: every report says where the
   ship heard it, and nothing is made up. As assertions:

     · news is only ever an event that is in the record, worded by the
       record's own line — and only the big ones;
     · something small, or far away and not the sector's business, is not
       news; a war is, wherever it is;
     · what happens inside your scan is LOCAL SCAN, what you only hear of is
       UNCONFIRMED, and docking turns that into a STATION REPORT that names
       the dock;
     · a dock tells you what you missed, a few things, once;
     · a finished job, a price on a name — the people you dealt with tell
       you, as a message to you;
     · nothing reaches the flight screen as a sentence: the count is the
       only thing flight shows;
     · opening the page reads it; it survives the book; a hand-edited book
       comes in clamped;
     · a book from before this page existed does not replay its history.

   Run it:  node test/comms.js                                              */

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
  assert.ok(cf && cf.comms, "?debug=1 must expose the transmission hooks");
  return { cf, store,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}


const g = boot("?debug=1&seed=424242");
g.cf.start("survey", 1);
const surv = g.cf.survey();
const C = g.cf.comms;
const me = () => g.cf.peek().ships[0];

// ── 1. a fresh sector has nothing to say, and old history is not news ──────
check(C.state().list.length === 0, "a new sector opened with transmissions already in it");
g.cf.living.turn(30, 99);
C.news();                               // the first look only sets the mark
check(C.state().list.length === 0, "thirty turns of history from before the radio was on arrived as news");

// ── 2. only the record, only the big, only the near ────────────────────────
const L = surv.living;
const at = me();
const rec = e => g.cf.living.record(e);
const small = rec({ kind: "trade", actor: "cordon", target: "morrow", x: at.x + 500, y: at.y });
const nearBattle = rec({ kind: "battle", actor: "cordon", target: "hallow", what: "TEST FIELD",
                         x: at.x + 600, y: at.y, n: 6, importance: 0.75 });
const farBattle = rec({ kind: "battle", actor: "cordon", target: "hallow", what: "FAR FIELD",
                        x: at.x + 400000, y: at.y, n: 6, importance: 0.75 });
const midBattle = rec({ kind: "battle", actor: "morrow", target: "hallow", what: "MID FIELD",
                        x: at.x + 60000, y: at.y, n: 6, importance: 0.75 });
const farWar = rec({ kind: "war", actor: "cordon", target: "morrow", x: at.x + 900000, y: at.y });
const mine = rec({ kind: "kill", actor: "you", target: "cordon", x: at.x, y: at.y, importance: 0.9 });
C.news();
let list = C.raw().list;
const by = ev => list.find(m => m.ev === ev.id);
check(!by(small), "a trade deal was sent to you as news");
check(!by(farBattle), "a battle four hundred thousand units away reached you");
check(!by(mine), "your own kill was reported to you as news");
check(!!by(nearBattle) && by(nearBattle).source === "scan", "a battle inside your scan is not a LOCAL SCAN");
check(!!by(midBattle) && by(midBattle).source === "unconfirmed", "a battle you only heard of is not UNCONFIRMED");
check(!!by(farWar) && by(farWar).source === "unconfirmed", "a war did not reach you from across the sector");
for (const m of list) {
  const ev = L.events.find(e => e.id === m.ev);
  check(!!ev, "a transmission is about something that is not in the record");
  if (ev) check(m.text === g.cf.living.line(ev, ""), "a transmission says something the record's own line does not: " + m.text);
}
const count = list.length;
C.news();
check(C.raw().list.length === count, "the same events were transmitted twice");
check(C.state().unread === count, "new transmissions are not counted as unread");

// ── 3. flight shows a count and no sentence ────────────────────────────────
g.cf.screen("playing");
g.drawn();
g.cf.draw();
const flight = g.drawn().join(" | ");
for (const m of list) check(flight.indexOf(m.text) < 0, "a transmission's words are on the flight screen: " + m.text);

// ── 4. docking confirms, names the dock, and fills in what you missed ──────
const missed = rec({ kind: "law", actor: "hallow", target: "", what: "borders", x: at.x + 20000, y: at.y,
                     importance: 0.5 });
const dock = { x: at.x + 300, y: at.y, faction: "hallow" };
C.dock(dock);
list = C.raw().list;
check(by(midBattle).source === "station" && by(midBattle).by === g.cf.jobs.name(dock),
      "docking did not turn an unconfirmed report into a station report that names the dock");
check(by(nearBattle).source === "scan", "docking rewrote something your own scan saw");
check(by(midBattle).text === g.cf.living.line(midBattle, "hallow"),
      "a station report is not told the way that dock's flag tells it");
check(!!by(missed) && by(missed).source === "station", "the dock did not tell you what you missed");
const n2 = list.length;
C.dock(dock);
check(C.raw().list.length === n2, "docking twice told you the same things twice");

// ── 5. the people you dealt with ───────────────────────────────────────────
C.msg("DRAAI", "7 electronics received", "#6dffbf", { x: 1, y: 2 });
const msg = C.raw().list[0];
check(msg.kind === "msg" && msg.source === "direct" && msg.from === "DRAAI", "a message to you is not filed as one");

// ── 6. the page, and reading it ────────────────────────────────────────────
const unread = C.state().unread;
check(unread > 0, "nothing is unread before the page is opened");
g.cf.hud();
C.open();
g.drawn();
g.cf.draw();
const words = g.drawn().join(" | ");
check(g.cf.screenNow() === "comms", "the transmissions page did not open");
check(/TRANSMISSIONS/.test(words) || /T \| R \| A \| N \| S/.test(words), "the page has no title");
check(/LOCAL SCAN/.test(words) && /STATION REPORT/.test(words), "the page does not say where each report came from");
check(words.indexOf("DRAAI") >= 0, "a message does not say who it is from");
check(words.indexOf(g.cf.jobs.name(dock)) >= 0, "a station report does not name its station");
check(C.state().unread === 0, "opening the page did not read it");

// ── 7. the book ────────────────────────────────────────────────────────────
g.cf.screen("playing");
g.cf.saveBook();
check(g.cf.bookKeys().indexOf("comms") >= 0, "the loader does not read transmissions back");
const before = JSON.stringify(C.raw().list.map(m => [m.text, m.source, m.by, m.read]));
const g2 = boot("?debug=1&seed=424242", g.store);
g2.cf.start("survey", 1);
check(JSON.stringify(g2.cf.comms.raw().list.map(m => [m.text, m.source, m.by, m.read])) === before,
      "transmissions did not survive the book");

const key = Object.keys(g.store).find(k => /"comms"/.test(g.store[k]));
check(!!key, "the book has no transmissions in it");
if (key) {
  const raw = JSON.parse(g.store[key]);
  const holder = raw.comms ? raw : Object.values(raw).find(v => v && v.comms) || raw;
  holder.comms.list = [{ text: "X".repeat(500), source: "the president", colour: "red", from: "Y".repeat(99),
                         kind: "order", t: -5 }, { text: 7 }];
  g.store[key] = JSON.stringify(raw);
  const g3 = boot("?debug=1&seed=424242", g.store);
  g3.cf.start("survey", 1);
  const l3 = g3.cf.comms.raw().list;
  check(l3.length === 1, "a transmission with no words came in from a book");
  check(l3.every(m => m.text.length <= 90 && m.from.length <= 24 && m.source === "unconfirmed" &&
                      /^#[0-9a-f]{6}$/i.test(m.colour) && m.kind === "news" && m.t >= 0),
        "a hand-edited transmission came in unclamped");
}

if (problems.length) {
  console.error("KONDRITE transmission checks FAILED:");
  for (const p of problems) console.error("  \u00b7 " + p);
  process.exit(1);
}
console.log("KONDRITE transmission checks passed");
