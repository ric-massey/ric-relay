#!/usr/bin/env node
"use strict";

/* KONDRITE — THE INTERFACE, EVERYWHERE
   ─────────────────────────────────────────────────────────────────────────────
   One class of bug, hunted across every page in the game: **a control that is
   drawn and cannot be pressed.**

   It is the bug this mode keeps shipping — five of them in one pass at one
   point, and the mode's three keys spent their entire existence twelve pixels
   below the bottom of the canvas — and the reason is always the same. A tap
   target is a rectangle nobody can see. It can sit off the edge of the screen,
   or be a pixel high, or be laid down at NaN, and the thing it belongs to draws
   perfectly in every screenshot anybody takes. Nothing about the picture is
   wrong. The rectangle is somewhere else.

   So this walks every page at several shapes of glass and reads the rectangles
   themselves — `cf.taps()` — rather than looking at the picture. What it checks
   is not what a page looks like; it is whether the things on it can be touched.

   The harness is the one test/menu.js uses, deliberately copied rather than
   shared: these suites run one at a time, and a shared harness is a shared
   thing to break.                                                            */

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
   loud: the game's chapters capture `window.KondriteSurveyHUD` once at
   boot, so a HUD loaded after it would test the null-HUD path. */
assert.ok(
  html.indexOf('src="survey-hud/') > 0 &&
  html.indexOf('src="survey-hud/') < html.indexOf('src="game/'),
  "survey-hud/ must be loaded before the game's chapters"
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
    KONDRITE_NO_INTRO: true,
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: q => ({ matches: TOUCH && /coarse/.test(String(q)),
                        addEventListener: noop, addListener: noop }),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      /* A real localStorage can be walked, and something in the game walks it:
         migrate.js sweeps every key under the old name. A stub without these
         is a stub the sweep finds nothing in, which would make the one module
         whose whole job is other people's saves the one module no harness
         ever runs. */
      get length() { return Object.keys(store).length; },
      key: i => Object.keys(store)[i] ?? null
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
  sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  // The page's own modules, in the page's own order. See test/page.js.
  page.boot(sandbox);
  // `window` inside the sandbox is the stub, not the sandbox object itself, so
  // anything the game hangs off window lands there — the same reason
  // test/campaign.js looks in both places.
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  assert.ok(windowStub.KondriteSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub };
}



const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

/* The shapes of glass this game actually runs on. The landscape phone is first
   because it is the hardest — 1000 wide and 700 tall is the whole budget, and
   everything that has ever fallen off the bottom fell off it there. */
/* Whether the boot about to happen is a phone. `touchOnly` is read once at
   start-up from a media query, so this has to be set before `boot` and not
   after — and the phone is not a smaller desk: it lays out five parts across
   instead of four, puts a thumb pad on the sector, and hides the keyboard
   hints. Most of the dead controls this mode has shipped were on it. */
let TOUCH = false;

const SHAPES = [
  { name: "landscape phone", w: 1200, h: 800 },
  { name: "laptop",          w: 1440, h: 900 },
  { name: "ultrawide",       w: 2400, h: 1080 },
  { name: "squarish",        w: 900,  h: 820 }
];

/* Every page the game can be sitting on, and how to get there. Survey's pages
   need a survey running; the menus do not. */
/* `sims` was the solo/multiplayer lane page. It went when the front page's
   SIMULATORS door came off — the machines are a room in a station now, and the
   lanes' question is answered by standing in one. */
const MENU_PAGES = ["title", "modes", "levels", "paused", "controls",
                    "thumb", "board"];
const SURVEY_PAGES = ["chart", "inventory", "missions", "almanac", "craft",
                      "lore", "refit", "hangar", "landed", "arcade"];

/* A tap that cannot be pressed, for one of the four reasons a rectangle can be
   unpressable. Returns why, or null. */
function whyDead(t, W, H) {
  for (const k of ["x", "y", "w", "h"]) {
    if (!Number.isFinite(t[k])) return "laid down at a non-number (" + k + ")";
  }
  if (t.w <= 0 || t.h <= 0) return "has no area (" + t.w + "×" + t.h + ")";
  // Wholly outside the canvas: nothing can ever land on it.
  if (t.x + t.w <= 0 || t.x >= W) return "is off the side (x " + t.x + ")";
  if (t.y + t.h <= 0 || t.y >= H) return "is off the top or bottom (y " + t.y + ")";
  /* Or mostly outside it, which is worse than wholly: half a button looks like
     a button and misses half the presses aimed at it. */
  const inW = Math.min(t.x + t.w, W) - Math.max(t.x, 0);
  const inH = Math.min(t.y + t.h, H) - Math.max(t.y, 0);
  if (inW * inH < t.w * t.h * 0.6) {
    return "is " + Math.round(100 - inW * inH / (t.w * t.h) * 100) +
           "% off the screen";
  }
  /* Degenerate rather than merely small. The interface clips its scrolling
     grids and intersects every rectangle with the visible window — see `tap` in
     survey-hud.js — so the top and bottom row of a scrolled grid legitimately
     come back as slivers, and a tile showing six pixels of itself is still a
     tile you can press. Six is the HUD's own floor; anything under it it drops
     on the floor already, so anything reaching here under it is a rectangle that
     was authored wrong rather than clipped. */
  if (t.h < 6 || t.w < 6) return "is " + t.w + "×" + t.h + ", too small to hit";
  return null;
}

const findings = [];
const shapesSeen = [];
const perPage = {};
let pagesWalked = 0, tapsSeen = 0;

for (const hands of [false, true]) {
TOUCH = hands;
for (const shape of SHAPES) {
  STAGE.w = shape.w; STAGE.h = shape.h;
  const { cf } = boot("?debug=1&seed=606061");
  /* The stage is only measured on a resize, so it has to be told. Getting this
     wrong is silent and total: without it all four shapes are the same shape,
     the suite passes four times over, and nothing has been tested at all — which
     is why the widths are asserted at the bottom. */
  const gotW = cf.resize();

  shapesSeen.push((TOUCH ? "phone" : "desk") + " " + shape.name + " " + gotW);

  const walk = (label, page) => {
    pagesWalked++;
    const W = cf.live().screenW, H = cf.live().screenH;
    const taps = cf.taps();
    tapsSeen += taps.length;
    for (const t of taps) {
      const why = whyDead(t, W, H);
      if (why) {
        findings.push((TOUCH ? "phone" : "desk") + " " + shape.name + " · " + label + " · a control " + why);
      }
    }
    /* And a control can be perfectly placed and still unpressable, because
       something drawn after it landed on top. `tapAt` walks the list backwards —
       last drawn wins — so a rectangle wholly covered by a later one can never
       be reached, however good it looks.

       Partial overlap is normal and often deliberate (a bubble over the row that
       opened it, a panel over the sector). Being *wholly* swallowed is not: that
       is a control nobody can ever press. */
    for (let i = 0; i < taps.length; i++) {
      const a = taps[i];
      if (!a.live) continue;
      for (let j = i + 1; j < taps.length; j++) {
        const b = taps[j];
        if (b.x <= a.x && b.y <= a.y &&
            b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h) {
          findings.push((TOUCH ? "phone" : "desk") + " " + shape.name + " · " + label + " · a control at " +
                        a.x + "," + a.y + " (" + a.w + "×" + a.h +
                        ") is completely covered by a later one at " +
                        b.x + "," + b.y + " (" + b.w + "×" + b.h +
                        ") and can never be pressed");
          break;
        }
      }
    }
    const pk = (TOUCH ? "phone/" : "desk/") + label;
    perPage[pk] = Math.max(perPage[pk] || 0, taps.length);
    return taps.length;
  };

  // ── the menus ───────────────────────────────────────────────────────────
  for (const page of MENU_PAGES) {
    if (page === "paused") { cf.start("survival", 1); }
    cf.screen(page);
    cf.draw();
    walk(page, page);
  }

  // ── survey's pages ──────────────────────────────────────────────────────
  cf.start("survey", 1);
  for (let i = 0; i < 3; i++) { now += 1000 / 60; cf.step(); }
  const hud = cf.hud();
  const surv = cf.survey();
  for (const page of SURVEY_PAGES) {
    if (page === "craft" && hud.craftOpened) hud.craftOpened();
    if (page === "chart" && hud.chartOpened) hud.chartOpened();
    /* Two pages are *about* something and draw nothing without it. Setting them
       up is the difference between walking them and walking past them: both
       reported "no controls" until this, which is the same thing a page with a
       dead close button would report. */
    if (page === "lore") {
      // A card is asked at a feature, so there has to be one to ask at.
      surv.lore = surv.near || {
        kind: "A STAR", name: "TEST STAR", colour: "#ffcb42",
        lines: ["It is a star.",
                "A long sentence of the kind these cards actually carry, so " +
                "the column wraps the way it would in the game rather than " +
                "fitting on one line and proving nothing about the layout."]
      };
    }
    if (page === "landed") {
      // And landing needs somewhere inhabited under you.
      surv.landed = surv.landed ||
        (surv.planets || []).find(pl => pl.inhabited) ||
        { x: 0, y: 0, r: 400, inhabited: true, name: "TEST WORLD",
          air: 1, sells: {} };
    }
    /* And the machines need a dock to stand in, the same way. A cabinet room
       with nowhere to be standing draws its frame and nothing else, which is
       correct and is also a page this sweep would walk straight past. */
    if (page === "arcade") {
      surv.docked = surv.docked ||
        (surv.stations || [])[0] ||
        { x: 0, y: 0, r: 132, home: true, faction: "free" };
    }
    cf.screen(page);
    cf.draw();
    walk("survey/" + page, page);
  }

  // And the sector itself, which has the panel, the devices and the scan on it.
  cf.screen("playing");
  cf.draw();
  walk("survey/playing", "playing");

  /* Survey's own pause screen, which is a different screen from every other
     mode's — it is the one carrying SAVE and the account button, and the row
     below it had to move down to make room. */
  cf.screen("paused");
  cf.draw();
  walk("survey/paused", "paused");

  /* ── and again with the pages full ─────────────────────────────────────
     Every page above was walked on a run four seconds old, which is the state
     a page is least likely to break in. Layout bugs live in *content*: a crate
     with one of everything in it, an almanac with every entry logged, a chart
     carrying two hundred pins, a hold that is full. All of those are states a
     real run reaches and none of them are the state a test finds by default. */
  const loaded = cf.survey();
  for (const m of cf.parts()) loaded.store[m.key] = 3;
  for (const e of cf.almanac ? cf.almanac() : []) loaded.found.add(e.key);
  for (const k of Object.keys(loaded.hold)) loaded.hold[k] = 60;
  loaded.cash = 9876543;
  for (const sh of cf.ships ? cf.ships() : []) loaded.owned.add(sh.key);
  loaded.pins = [];
  for (let i = 0; i < 200; i++) {
    loaded.pins.push({ x: i * 900 - 90000, y: i * 400 - 40000,
                       name: "A PIN WITH A LONG NAME " + i, colour: "#ffcb42" });
  }
  for (const page of SURVEY_PAGES) {
    if (page === "craft" && hud.craftOpened) hud.craftOpened();
    if (page === "chart" && hud.chartOpened) hud.chartOpened();
    cf.screen(page);
    cf.draw();
    walk("full/" + page, page);
  }
}
}

for (const f of findings) check(false, f);

/* And the shapes have to have actually differed. Four runs at one width is a
   suite that passes by testing nothing — the failure mode this file is most
   likely to have, and the one nothing else would ever notice. */
/* A page that laid down no controls at all was not reached — `cf.screen` set a
   state the renderer does not draw, and the walk over it proved nothing. Every
   page in this game has at least a way off it. */
for (const label of Object.keys(perPage)) {
  check(perPage[label] > 0, label + " drew no controls at all — it was never reached");
}

const widths = new Set(shapesSeen.map(x => x.split(" ").pop()));
check(widths.size >= 3,
      "the shapes did not change the screen: " + shapesSeen.join(", "));

if (problems.length) {
  console.log("KONDRITE interface checks FAILED");
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("  pages      " +
            Object.keys(perPage).map(k => k + " " + perPage[k]).join(" · "));
console.log("  shapes     " + shapesSeen.join(" · "));
console.log("  reachable  " + tapsSeen + " controls across " + pagesWalked +
            " pages and " + SHAPES.length + " shapes of glass · every one " +
            "on the screen, big enough to hit, at a real coordinate");
console.log("KONDRITE interface checks passed");
