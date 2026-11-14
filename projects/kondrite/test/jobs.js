#!/usr/bin/env node
"use strict";

/* KONDRITE — THE JOB BOARD
   ────────────────────────────────────────────────────
   WORLD-IDEAS.md says a job has to "agree with the actual situation and its
   outcome should affect that situation", and that nothing may invent a
   shortage to have something to show. This is that, as assertions:

     · every offer is a real shortage at a station the generator really
       makes, for something that station really buys;
     · no shortage, no offer — easing the market takes the row off the board;
     · taking one puts the dock on the chart, by name;
     · the delivery is the ordinary sale: it eases the same number, and the
       bonus is paid once, when the count is met;
     · a need that goes away without you lapses the job and pays the part
       you carried; one that sits for two hours goes stale;
     · it survives the book, and a hand-edited book cannot plant a job for a
       material that does not exist;
     · the board and the missions page draw it, and the tab is pressable.

   Run it:  node test/jobs.js                                               */

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
  assert.ok(cf && cf.jobs, "?debug=1 must expose the job hooks");
  return { cf, store,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}

/* A dock that has neighbours with something to ask for. The generator decides
   where the stations are, so the test goes looking rather than assuming. */
function findDock(g) {
  const C = g.cf.chunkSize();
  for (let r = 4; r < 60; r++) {
    for (let cx = -r; cx <= r; cx++) for (let cy = -r; cy <= r; cy++) {
      if (Math.max(Math.abs(cx), Math.abs(cy)) !== r) continue;
      for (const st of g.cf.chunk(cx, cy).stations) {
        g.cf.survey().docked = st;
        if (g.cf.jobs.offers().some(o => !o.here)) return st;
      }
    }
  }
  return null;
}

// ── 1. what is on the board is true ────────────────────────────────────────
const g = boot("?debug=1&seed=424242");
g.cf.start("survey", 1);
const surv = g.cf.survey();
const dock = findDock(g);
check(!!dock, "no station in sixty chunks had a neighbour short of anything");
if (dock) {
  const offers = g.cf.jobs.offers();
  check(offers.length > 0 && offers.length <= 4, "a board shows one to four rows, not " + offers.length);
  const around = g.cf.jobs.around();
  for (const o of offers) {
    const st = o.here ? dock : around.find(a => Math.round(a.x) === o.x && Math.round(a.y) === o.y);
    check(!!st, "an offer names a station the generator does not make: " + o.name);
    if (!st) continue;
    const need = g.cf.jobs.need(st);
    check(need.key === o.key && need.want >= 0.45,
          "an offer asks for something its station is not short of: " + o.name + " " + o.key);
    check(o.n >= 2 && o.n <= 14, "a job's count is out of range: " + o.n);
    check(o.pay >= 50, "a job pays nothing: " + o.pay);
    check(/^[A-Z]+$/.test(o.name), "a station has no name: " + JSON.stringify(o.name));
    check(g.cf.jobs.name(st) === o.name, "a station's name is not a function of where it is");
  }
  check(!offers.some(o => Math.hypot(o.x, o.y) < 400), "your own station is asking you for cargo");

  // ── 2. no shortage, no row ───────────────────────────────────────────────
  const first = offers.find(o => !o.here);
  const target = around.find(a => Math.round(a.x) === first.x && Math.round(a.y) === first.y);
  const m = g.cf.market(target);
  const was = m.want[first.key];
  m.want[first.key] = 0.05;
  check(!g.cf.jobs.offers().some(o => o.id === first.id),
        "a station that is not short of it is still asking for it");
  m.want[first.key] = was;
  check(g.cf.jobs.offers().some(o => o.id === first.id), "the row did not come back with the shortage");

  // ── 3. taking it puts the dock on the chart ──────────────────────────────
  const knownBefore = surv.known.size;
  check(g.cf.jobs.take(first.id) === true, "a job on the board could not be taken");
  check(surv.jobs.taken.length === 1, "a taken job is not in the book");
  const entry = [...surv.known.values()].find(q => q.k === "station" && q.x === first.x && q.y === first.y);
  check(!!entry && entry.name === first.name, "taking a job did not put its dock on the chart by name");
  check(surv.known.size === knownBefore + 1, "taking a job wrote more than one place");
  check(!g.cf.jobs.offers().some(o => o.id === first.id), "a job you took is still on the board");
  check(g.cf.jobs.take(first.id) === false, "the same job was taken twice");

  // ── 4. the delivery is the sale ──────────────────────────────────────────
  surv.docked = target;
  const job = surv.jobs.taken[0];
  surv.hold[first.key] = first.n + 3;
  const cash0 = surv.cash, want0 = m.want[first.key];
  g.cf.jobs.sell(first.key, first.n - 1);
  check(surv.jobs.taken.length === 1 && job.left === 1, "a part delivery did not count down: " + job.left);
  const afterPart = surv.cash;
  check(afterPart > cash0 && afterPart - cash0 < first.pay + (first.n - 1) * 200,
        "the bonus was paid before the count was met");
  g.cf.jobs.sell(first.key, 1);
  check(surv.jobs.taken.length === 0, "a finished job is still on the list");
  check(surv.jobs.done.length === 1 && surv.jobs.done[0].n === first.n, "a finished job is not in the record");
  check(m.want[first.key] < want0 - 0.2, "the delivery did not ease the shortage it was for");
  const sale1 = g.cf.prices(target)[first.key];
  check(surv.cash - afterPart >= first.pay, "the bonus was not paid: " + (surv.cash - afterPart) + " of " + first.pay);
  const cashDone = surv.cash;
  g.cf.jobs.sell(first.key, 1);
  check(surv.cash - cashDone <= sale1 + 1, "the bonus was paid twice");
  check(g.cf.jobs.state().here.done === 1 && g.cf.jobs.state().here.units === first.n,
        "the dock does not remember what you brought it");

  // ── 5. a need that goes away, and one that sits ──────────────────────────
  surv.docked = dock;
  m.want[first.key] = 0.9;
  const again = g.cf.jobs.offers().find(o => o.id === first.id);
  check(!!again, "a deepened shortage did not post again");
  g.cf.jobs.take(again.id);
  surv.docked = target;
  surv.hold[first.key] = 20;
  g.cf.jobs.sell(first.key, 2);
  m.want[first.key] = 0.02;            // somebody else's convoy got through
  const cashL = surv.cash;
  g.cf.jobs.turn();
  check(surv.jobs.taken.length === 0, "a job outlived the need it was for");
  check(surv.cash > cashL && surv.cash - cashL < again.pay, "a lapsed job did not pay for the part carried");

  surv.docked = dock;
  m.want[first.key] = 0.9;
  const third = g.cf.jobs.offers().find(o => o.id === first.id);
  g.cf.jobs.take(third.id);
  surv.living.turn += 121;
  const cashS = surv.cash;
  g.cf.jobs.turn();
  check(surv.jobs.taken.length === 0, "a job two hours old is still waiting");
  check(surv.cash === cashS, "a stale job nobody carried anything for paid out");

  // Three is the limit, and dropping one is free.
  m.want[first.key] = 0.9;
  let took = 0;
  for (const o of g.cf.jobs.offers()) if (g.cf.jobs.take(o.id)) took++;
  check(surv.jobs.taken.length <= 3, "more than three jobs were taken at once");
  const n0 = surv.jobs.taken.length;
  if (n0) {
    g.cf.jobs.drop(surv.jobs.taken[0].id);
    check(surv.jobs.taken.length === n0 - 1, "a dropped job is still on the list");
  }

  // ── 6. the pages ─────────────────────────────────────────────────────────
  const hud = g.cf.hud();
  g.drawn();
  g.cf.screen("jobs");
  g.cf.draw();
  const words = g.drawn().join(" | ");
  check(/WANTED NEAR HERE/.test(words), "the board did not draw its panel");
  check(/YOUR JOBS/.test(words), "the board did not draw what you are carrying");
  check(words.indexOf(g.cf.jobs.name(dock)) >= 0, "the board does not say which dock it is");
  const taps = g.cf.taps ? g.cf.taps() : [];
  check(!g.cf.taps || taps.length > 2, "nothing on the board is pressable");
  if (surv.jobs.taken.length) {
    g.cf.screen("missions");
    g.cf.draw();
    check(/YOUR JOBS/.test(g.drawn().join(" | ")), "the missions page does not list the jobs you carry");
  }
  check(typeof hud.drawJobs === "function", "the interface has no job board");

  // ── 7. the book ──────────────────────────────────────────────────────────
  g.cf.screen("playing");
  g.cf.saveBook();
  const taken = JSON.stringify(surv.jobs.taken), done = JSON.stringify(surv.jobs.done);
  check(g.cf.bookKeys().indexOf("jobs") >= 0, "the loader does not read jobs back");
  const g2 = boot("?debug=1&seed=424242", g.store);
  g2.cf.start("survey", 1);
  const s2 = g2.cf.survey();
  check(JSON.stringify(s2.jobs.taken) === taken, "taken jobs did not survive the book");
  check(JSON.stringify(s2.jobs.done) === done, "the record of deliveries did not survive the book");

  // A hand-edited book.
  const key = Object.keys(g.store).find(k => /"jobs"/.test(g.store[k]));
  if (key) {
    const raw = JSON.parse(g.store[key]);
    const holder = raw.jobs ? raw : Object.values(raw).find(v => v && v.jobs) || raw;
    if (holder.jobs) {
      holder.jobs.taken = [{ key: "unobtainium", n: 5, left: 5, x: 1, y: 1, name: "X", pay: 1e12 },
                           { key: "ice", n: 5, left: 900, x: 9000, y: 9000, name: "Y".repeat(90),
                             faction: "nobody", pay: 1e12, turn: 0 }];
      g.store[key] = JSON.stringify(raw);
      const g3 = boot("?debug=1&seed=424242", g.store);
      g3.cf.start("survey", 1);
      const t3 = g3.cf.survey().jobs.taken;
      check(!t3.some(j => j.key === "unobtainium"), "a book planted a job for a material that does not exist");
      check(t3.every(j => j.left <= j.n && j.pay <= 1e6 && j.name.length <= 24 && j.faction === "free"),
            "a hand-edited job came in unclamped");
    }
  }
}

if (problems.length) {
  console.error("KONDRITE job-board checks FAILED:");
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}
console.log("KONDRITE job-board checks passed");
