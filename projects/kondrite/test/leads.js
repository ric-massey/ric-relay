#!/usr/bin/env node
"use strict";

/* KONDRITE - LEADS
   ----------------------------------------------------
   WORLD-IDEAS.md: "Leave a lead before the opening ends". Ric, 2026-11-14,
   chose both of the two he was shown. As assertions:

     - a lead points at a landmark that really stands in this sector, and
       makes nothing;
     - it is given once, arrives on COMMS as UNCONFIRMED, and says a bearing
       from home and never a distance or a place;
     - a landmark already logged gives no lead;
     - the missions page lists it, the chart draws it, and neither states
       how far in units;
     - which lead is near is the sector's business (landmarks are dealt per
       world), so each says the range it really is, in words;
     - once the station is whole the arrow takes the nearest lead a tank can
       reach, and never one that is past your range;
     - finding the place closes it; it survives the book; a book cannot
       plant a lead that does not exist.

   Run it:  node test/leads.js                                              */

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
  assert.ok(cf && cf.leads, "?debug=1 must expose the lead hooks");
  return { cf, store,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}


const WORDS = ["past your range", "most of a sector away", "a very long way out",
               "a long way out", "out there", "close", "right here"];
let reachable = 0;

for (const seed of [424242, 7, 99, 12345]) {
  const g = boot("?debug=1&seed=" + seed);
  g.cf.start("survey", 1);
  const surv = g.cf.survey();
  const L = g.cf.leads;
  const mark = key => surv.landmarks.find(l => l.key === key);
  const home = g.cf.home();
  const far = lm => Math.round(Math.hypot(lm.x - home.x, lm.y - home.y));
  const tag = "seed " + seed + ": ";

  // 1. the table is about real places
  for (const l of L.all()) {
    check(!!mark(l.at), tag + "the " + l.key + " lead points at a landmark this sector does not have: " + l.at);
    check(l.name.length <= 34 && l.text.length <= 28, "the " + l.key + " lead does not fit its row");
  }

  // 2. given once, on COMMS, as a bearing
  const before = g.cf.comms.raw().list.length;
  check(L.give("tracker") === true, tag + "the tracker lead could not be given");
  check(L.give("tracker") === false, tag + "the tracker lead was given twice");
  check(L.give("nonsense") === false, tag + "a lead that does not exist was given");
  const list = g.cf.comms.raw().list;
  check(list.length === before + 1, tag + "a lead did not arrive on COMMS exactly once");
  const msg = list[0];
  check(msg.source === "unconfirmed", tag + "a lead is not marked UNCONFIRMED");
  check(/BEARING \d{3} FROM HOME/.test(msg.text), tag + "a lead does not give a bearing from home: " + msg.text);
  check(msg.placed === false, tag + "a lead's transmission carries a position");

  // 3. a logged landmark gives nothing
  const lt = mark("last-transmission");
  lt.found = true;
  check(L.give("answer") === false, tag + "a lead was given to a place already logged");
  lt.found = false;
  check(L.give("answer") === true, tag + "the answering signal could not be given");

  // What the pages are handed: a bearing and a word, never where or how far.
  const open = L.open();
  check(open.length === 2, tag + "two leads were given and " + open.length + " are open");
  const reach = L.reach();
  for (const o of open) {
    const lm = mark(L.all().find(l => l.key === o.key).at);
    const told = JSON.stringify({ name: o.name, text: o.text, bearing: o.bearing, range: o.range });
    check(told.indexOf(String(far(lm))) < 0, tag + "a lead states its distance");
    check(WORDS.indexOf(o.range) >= 0, tag + "a lead's range is not one of the words: " + o.range);
    check((far(lm) > reach) === (o.range === "past your range"),
          tag + "the " + o.key + " lead is " + far(lm) + " out against a reach of " + reach + " and says " + o.range);
  }

  // 4. the pages
  g.drawn();
  g.cf.screen("missions");
  g.cf.draw();
  const words = g.drawn().join(" | ");
  check(/OPEN LEADS/.test(words), tag + "the missions page does not list open leads");
  for (const l of L.all()) check(words.indexOf(l.name) >= 0, tag + "the missions page does not name the " + l.key + " lead");
  g.cf.screen("chart");
  g.cf.draw();           // the chart draws the lines; it must not throw
  g.cf.screen("playing");

  // 5. the arrow, once the station is whole: the nearest lead a tank reaches
  const want = L.all()
    .map(l => ({ key: l.key, lm: mark(l.at) }))
    .filter(l => far(l.lm) <= reach)
    .sort((a, b) => far(a.lm) - far(b.lm))[0] || null;
  check(L.inReach() === (want ? want.key : null),
        tag + "the lead in reach is " + L.inReach() + "; it should be " + (want && want.key));
  for (const k of ["spar", "core", "lens", "coil", "beacon", "plate"]) surv.built.add(k);
  surv.mk1Site = null;            // the mark-one tractor has the arrow first
  const tgt = g.cf.objectiveTarget();
  if (want) {
    reachable++;
    check(tgt && tgt.key === "lead" && tgt.vague === true && tgt.x === want.lm.x,
          tag + "with the station whole the arrow does not take the open lead: " + (tgt && tgt.key));
    // 6. finding it closes it
    g.cf.find(L.all().find(l => l.key === want.key).at);
    check(!L.open().some(o => o.key === want.key), tag + "finding the place did not close its lead");
  } else {
    check(!tgt || tgt.key !== "lead", tag + "the arrow is on a lead that is past your range");
  }

  // 7. the book
  g.cf.saveBook();
  check(g.cf.bookKeys().indexOf("leads") >= 0, tag + "the loader does not read leads back");
  const g2 = boot("?debug=1&seed=" + seed, g.store);
  g2.cf.start("survey", 1);
  check(JSON.stringify(g2.cf.leads.raw()) === JSON.stringify(surv.leads), tag + "leads did not survive the book");
  const key = Object.keys(g.store).find(k => /"leads"/.test(g.store[k]));
  check(!!key, tag + "the book has no leads in it");
  if (key && seed === 424242) {
    const raw = JSON.parse(g.store[key]);
    const holder = Array.isArray(raw.leads) ? raw : Object.values(raw).find(v => v && Array.isArray(v.leads)) || raw;
    holder.leads = ["tracker", "tracker", "treasure", 7, { a: 1 }];
    g.store[key] = JSON.stringify(raw);
    const g3 = boot("?debug=1&seed=" + seed, g.store);
    g3.cf.start("survey", 1);
    check(JSON.stringify(g3.cf.leads.raw()) === JSON.stringify(["tracker"]),
          "a hand-edited book planted a lead: " + JSON.stringify(g3.cf.leads.raw()));
  }
}
/* Which landmark is near is dealt per world, so no one seed proves the arrow
   half. Four of them have to include a sector where a lead is in reach. */
check(reachable > 0, "no seed had a lead inside a tank's reach, so the arrow was never tested");

if (problems.length) {
  console.error("KONDRITE lead checks FAILED:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("KONDRITE lead checks passed");
