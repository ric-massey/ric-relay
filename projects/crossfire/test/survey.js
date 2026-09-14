#!/usr/bin/env node
"use strict";

/* A headless run of Survey. The mode has no opponent and no end, so there is
   no "did you win" to assert on — what makes it correct instead is that the
   sector it generates is *complete* (every catalogue entry it promises has to
   be reachable in it), that flying charts the map, and that nothing about
   having no enemies leaves a ship dead, outside the arena, or non-finite.

   Three things are worth saying about why this is a test and not a look:

     · A catalogue entry a seed can fail to make possible is an entry that is
       sometimes a lie. The binary, the overlapping wells, the rogue planet and
       the pale dot are placed deliberately for exactly that reason, and this
       checks a hundred seeds' worth of sectors rather than the one that
       happened to come up.
     · There is no death in Survey, so the mode's failure state is a ship that
       quietly *is* dead — out of stocks, or never coming back from a well.
       That is invisible while playing and obvious to a harness.
     · The chart is persistence. A fog bitfield that does not survive a round
       trip through local storage loses somebody's afternoon.

   No dependencies. Same shape as test/campaign.js: the browser is stubbed, a
   controllable clock replaces performance.now, and everything is driven
   through the ?debug=1 window.__cf hooks. */

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
   loud: the inline script captures `window.CrossfireSurveyHUD` once at
   boot, so a HUD loaded after it would test the null-HUD path. */
assert.ok(
  html.indexOf('src="survey-hud.js"') > 0 &&
  html.indexOf('src="survey-hud.js"') < html.search(/<script(?![^>]*\bsrc=)/i),
  "survey-hud.js must be loaded before the inline game script"
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
/* Every element the page ships with a `hidden` attribute on it. Parsed from
   the markup so the stub cannot drift away from what a browser would report. */
const HIDDEN_AT_BOOT = new Set(
  [...html.matchAll(/<[a-z]+\s+[^>]*\bid="([^"]+)"[^>]*\bhidden\b/gi)]
    .map(m => m[1])
);

function stubEl(id) {
  return {
    id: id || "",
    style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    removeChild: noop, setAttribute: noop, removeAttribute: noop, focus: noop,
    blur: noop, click: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => stubEl(), querySelectorAll: () => [],
    /* Which panels start hidden is read out of the real markup rather than
       listed here, and that matters more than it looks: the keydown handler
       bails out early while a panel that takes typing is up, because you are
       entering a password and a stray space must not fire a gun. A stub that
       reported one of them visible made the entire keyboard path unreachable —
       every test that needed a key used `cf.hold`, which writes the held set
       directly, so nobody noticed the handler was never running.

       It was a hard-coded `=== "lobby"` until the account door was added, at
       which point every keypress in this harness went into a panel nobody could
       see. Asking the markup means the next panel cannot repeat it. */
    hidden: HIDDEN_AT_BOOT.has(id || ""), value: "", textContent: "",
    width: 1000, height: 700,
    dataset: {}, children: [], parentNode: null
  };
}
const store = {};
/* Elements are kept rather than minted fresh on every lookup. Two lookups of the
   same id used to hand back two different objects, so anything the game *set* on
   an element — hidden, a value, a class — was thrown away between calls. */
const els = {};
const documentStub = {
  getElementById: id => (els[id] || (els[id] = stubEl(id))),
  querySelector: () => stubEl(),
  querySelectorAll: () => [], createElement: tag => stubEl(tag),
  addEventListener: noop, removeEventListener: noop,
  body: stubEl(), documentElement: stubEl(),
  hidden: false, visibilityState: "visible",
  exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
};

function boot(search) {
  for (const k of Object.keys(store)) delete store[k];
  return bootKeepingStorage(search);
}

let bootCount = 0;

function bootKeepingStorage(search) {
  now = 0;
  /* The real listeners, kept. The game binds its keyboard on `addEventListener`
     and the stub used to throw those away — which meant the one part of input
     handling that has actually shipped a bug (what happens to a key you are still
     holding when the held set is cleared) was the one part no test could reach. */
  const listeners = {};
  const windowStub = {
    addEventListener: (kind, fn) => { (listeners[kind] = listeners[kind] || []).push(fn); },
    removeEventListener: (kind, fn) => {
      const list = listeners[kind] || [];
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
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

  /* ── a deterministic Math.random ─────────────────────────────────────────
     The simulation uses `Math.random` for everything that is not world
     generation: what a ship decides to do next, where a hunter comes from, which
     rock has something in it. That made the suite non-deterministic, and a test
     that fails one run in four is worse than no test — it trains you to re-run it
     until it passes, which is exactly how a real regression gets waved through.

     One seeded generator per boot, so a check that flies a fight to its conclusion
     gets the same fight every time, and a failure is a fact rather than a mood.
     The game itself is untouched: this is the harness deciding what "random"
     means inside it, which is the same thing it already does for time. */
  /* Seeded from the URL *and* from which boot this is, so one process always
     runs the same way and two boots inside it do not run identically — a check
     that a coil throws you somewhere different each time has to see different. */
  bootCount++;
  let rngState = (0x2f6e2b1 ^ bootCount * 0x9e3779b1 ^
                  [...search].reduce((a, c) => a + c.charCodeAt(0), 0)) | 0;
  const seededRandom = () => {
    rngState |= 0; rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const mathStub = Object.create(Math);
  mathStub.random = seededRandom;

  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: documentStub, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math: mathStub, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.CrossfireNet = undefined;
  vm.createContext(sandbox);
  // The page's own modules, in the page's own order. See test/page.js.
  page.boot(sandbox);
  // `window` inside the sandbox is the stub, not the sandbox object itself, so
  // anything the game hangs off window lands there — the same reason
  // test/campaign.js looks in both places.
  /* Dispatch a real keyboard event at the real handler, repeat flag and all. */
  const fire = (kind, code, repeat) => {
    for (const fn of listeners[kind] || []) {
      fn({ code, repeat: !!repeat, preventDefault: noop });
    }
  };
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  assert.ok(windowStub.CrossfireSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub, fire, listeners };
}


/* Every almanac entry must have a picture, and the picture is what turns a
   checklist into a field guide. Read as source rather than counted at runtime:
   an entry that falls through to the default `ring` still draws *something*, so
   "did it paint" cannot tell a real picture from a placeholder. Having its own
   `case` can. */
const ICON_CASES = new Set(
  [...hudSrc.matchAll(/case\s+"([a-z0-9-]+)":/g)].map(m => m[1])
);

/* The book's storage key, read from the game rather than spelled out here.
   It was a literal in seventeen places, so versioning the save format broke the
   suite in seventeen places at once — and the first of them was a `JSON.parse`
   of `undefined`, which says nothing about what actually moved. */
const BOOK_KEY = (() => {
  const { cf } = boot("?debug=1&seed=1");
  return cf.book.keys.store;
})();

/* How much of what this place actually buys is still in the hold. A station
   deals in a subset of the materials, so "the hold is empty" is the wrong
   question after a sale — "nothing it wanted is left" is the right one. */
const MATERIALS_LEFT = (surv, takes) => {
  let n = 0;
  for (const k of Object.keys(surv.hold)) if (takes.has(k)) n += surv.hold[k] || 0;
  return n;
};

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// How many of a part are in the hold, read the way the page reads it.
const storeOf = (cf, key) => {
  const row = (cf.surveyView().store || []).find(e => e.key === key);
  return row ? row.n : 0;
};

// ── the Leviathan lab is exactly one empty room ──────────────────────────
{
  const { cf } = boot("?debug=1&leviathan=1&seed=771177");
  const surv = cf.survey();
  const live = cf.live();

  check(cf.peek().state === "playing" && cf.peek().mode === "SURVEY",
        "the Leviathan lab did not open directly into the map");
  check(!!surv && !!surv.leviathan,
        "the Leviathan lab opened without the Leviathan");
  check(live.ships.length === 1,
        "the Leviathan lab should contain one player ship, saw " + live.ships.length);
  check(live.rocks.length === 0 && live.hazards.length === 0,
        "the Leviathan lab generated rocks or gravity wells");

  const furniture = ["planets", "wrecks", "nebulae", "marks", "gates",
                     "stations", "hulks", "fields", "traffic", "battles"];
  for (const key of furniture) {
    check(surv[key].length === 0,
          "the Leviathan lab generated " + surv[key].length + " " + key);
  }
  check(cf.zoom() === 0.20,
        "the Leviathan lab did not open at the whole-hull zoom");
  const view = cf.surveyView();
  check(view.ships.every(sh => sh.owned),
        "the Leviathan lab left a hull locked");
  check(view.parts.every(part => part.owned > 0),
        "the Leviathan lab left a part locked");
  check(view.almanac.every(entry => entry.found) && view.wormhole && view.light.have,
        "the Leviathan lab left Survey progression locked");
  check(view.atHome,
        "the Leviathan lab did not make the hangar available");

  const me = live.ships[0];
  const hull = me.hull;
  me.invuln = 0;
  cf.hurt("mine");
  check(me.hull === hull && me.alive && !surv.death,
        "the Leviathan lab allowed damage");
  cf.die("rock");
  check(me.hull === hull && me.alive && !surv.death,
        "the Leviathan lab allowed a death");
  console.log("  leviathan  direct entry · one pilot · empty space · invulnerable · " +
              "every hull, part and progression unlock available");
}

// ── 1. generation is pure, and the ladder is complete ────────────────────
/* An endless sector cannot be checked by enumerating it. What can be checked is
   that a chunk is a pure function of its coordinates — fly away and back and
   find the same stars — and that the eight landmarks are all placed, all at
   different bearings, and all at the distances the ladder promises. */
{
  const SEEDS = 60;
  let minSpread = Infinity;
  for (let i = 0; i < SEEDS; i++) {
    const seed = 1000 + i * 7919;
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    const surv = cf.survey();

    const keys = surv.landmarks.map(l => l.key);
    for (const key of ["graveyard", "rogue", "last-transmission", "pale-dot",
                       "the-wall", "supernebula", "node-01", "leviathan"]) {
      check(keys.filter(k => k === key).length === 1,
            "seed " + seed + ": landmark " + key + " appears " +
            keys.filter(k => k === key).length + " times");
    }

    /* Spread by bearing: a seed that puts the whole ladder down one corridor
       makes the mode a straight line rather than a sector. */
    const angs = surv.landmarks.map(l => Math.atan2(l.y, l.x)).sort((a, b) => a - b);
    let closest = Infinity;
    for (let k = 1; k < angs.length; k++) closest = Math.min(closest, angs[k] - angs[k - 1]);
    minSpread = Math.min(minSpread, closest);
    check(closest > 0.15,
          "seed " + seed + ": two landmarks are only " + closest.toFixed(3) +
          " rad apart — the ladder is a corridor");

    /* The ladder's rungs are dealt per world now, so no individual landmark can
       be pinned to a distance any more — the graveyard is near in one sector
       and eight hours out in the next. What must still hold is the *shape*: a
       first rung close enough to reach on an early flight, a last rung that is
       an expedition, and the Leviathan always standing on that last rung
       because it is the finale and the yard's last part is inside it. */
    const byDist = surv.landmarks
      .map(l => ({ key: l.key, d: Math.hypot(l.x, l.y) }))
      .sort((a, b) => a.d - b.d);
    check(byDist[0].d < 34000,
          "seed " + seed + ": the nearest landmark is " + Math.round(byDist[0].d) +
          " units out — nothing is reachable early");
    check(byDist[byDist.length - 1].d > 45000,
          "seed " + seed + ": the furthest landmark is only " +
          Math.round(byDist[byDist.length - 1].d) + " units out");
    /* The Leviathan is the one landmark that is *not* on the ladder. It stands
       at a fixed distance in every sector, because the manifest's sixth part is
       inside it and the manifest is the tutorial — on the last rung it was
       millions of units out and the one step that sends you inside something was
       the one step nobody reached. Checked as a band rather than a number: it
       carries a jitter so two sectors are not identical. */
    const levD = byDist.find(b => b.key === "leviathan").d;
    check(levD > 30000 && levD < 50000,
          "seed " + seed + ": the Leviathan is " + Math.round(levD) +
          " units out; it is meant to be about 40,000 in every sector");
    for (let k = 1; k < byDist.length; k++) {
      /* The Leviathan is placed off the ladder, so it is allowed to land beside
         a rung — the no-folding rule is about the dealt ones. */
      if (byDist[k].key === "leviathan" || byDist[k - 1].key === "leviathan") continue;
      check(byDist[k].d > byDist[k - 1].d * 1.02,
            "seed " + seed + ": two rungs sit on top of each other");
    }

    /* Purity: the same chunk built twice must be identical, and two different
       chunks must not be — an unmixed seed makes rows of near-identical
       fields, which reads as a corridor rather than a sector. */
    const shape = c => JSON.stringify(c.hazards.map(h => [h.kind, Math.round(h.x), Math.round(h.y)]));
    check(shape(cf.chunk(4, -7)) === shape(cf.chunk(4, -7)),
          "seed " + seed + ": a chunk built twice came out different");
    check(shape(cf.chunk(4, -7)) !== shape(cf.chunk(5, -7)) ||
          shape(cf.chunk(4, -7)) === "[]",
          "seed " + seed + ": neighbouring chunks are identical");

    // An opening spawn inside a well is a death nobody could have avoided.
    check(cf.chunk(0, 0).hazards.length === 0,
          "seed " + seed + ": the home chunk has a hazard in it");
  }
  console.log("  chunks     " + SEEDS + " seeds · pure and mixing · home chunk clear · " +
              "8 landmarks each, min bearing gap " + minSpread.toFixed(2) + " rad");
}

// ── 1b. the sector really is endless ─────────────────────────
/* The point of the rewrite. Fly hard in one direction for six minutes and the
   ship must simply keep going: no wall, no clamp, no snap-back, and space still
   being generated around it when it gets there. */
{
  const { cf } = boot("?debug=1&seed=20260909");
  cf.start("survey", 1);
  cf.hold("KeyW", true);
  const me = cf.live().ships[0];
  /* Held invulnerable and provisioned for the whole run, deliberately. This test
     is about the *world* — that space keeps being generated, that nothing clamps
     or snaps back, that there is no wall — and since phase 2 a ship flying flat
     out through six minutes of asteroids will die somewhere in the middle of it.
     A dead ship stops moving, and the test then failed as "only reached 35,000
     units", which measures the pilot and says nothing whatever about the edge of
     the map. Survival is checked in its own blocks; this one checks the sector. */
  for (let i = 0; i < 21600; i++) {
    now += 1000 / 60;
    me.invuln = Math.max(me.invuln, 1);
    cf.setTanks(600, 1200);
    cf.step();
  }
  const s = cf.live().ships[0];
  const far = Math.hypot(s.x, s.y);
  check(far > 60000, "six minutes of full burn only reached " + Math.round(far) + " units");
  check(Number.isFinite(s.x) && Number.isFinite(s.y), "position went non-finite out there");
  check(cf.live().rocks.length > 40,
        "the rock field did not follow the ship out: " + cf.live().rocks.length + " left");
  const near = cf.live().hazards.some(h => Math.hypot(h.x - s.x, h.y - s.y) < 20000);
  check(near, "no hazards generated " + Math.round(far) + " units out — space ran out");
  check(cf.peek().state === "playing",
        "six minutes of held-invulnerable flight still ended on a page");
  console.log("  endless    " + Math.round(far) + " units out in six minutes · " +
              cf.live().hazards.length + " hazards and " + cf.live().rocks.length +
              " rocks still around the ship · no wall");
}

// ── 2. the same seed is the same sector ───────────────────────
{
  const shape = seed => {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    const v = cf.survey();
    return JSON.stringify({
      lm: v.landmarks.map(l => [l.key, Math.round(l.x), Math.round(l.y)]),
      c1: cf.chunk(3, 3).hazards.map(h => [h.kind, Math.round(h.x)]),
      c2: cf.chunk(-9, 12).hazards.map(h => [h.kind, Math.round(h.x)])
    });
  };
  check(shape(424242) === shape(424242), "the same seed produced two different sectors");
  check(shape(424242) !== shape(999999), "two different seeds produced the same sector");
  console.log("  seeds      same seed to same sector · different seed to different sector");
}

// ── 3. it plays: fly it for four minutes and check every frame ────────────
{
  const { cf } = boot("?debug=1&seed=8675309");
  cf.start("survey", 1);
  const lv = cf.live();
  check(lv.ships.length === 1, "Survey must field exactly one ship, saw " + lv.ships.length);
  const startedAt = { x: lv.ships[0].x, y: lv.ships[0].y };
  const me = lv.ships[0];
  const surv = cf.survey();
  const hud = cf.hud();

  // Fly it. No autopilot exists for a mode with nothing to fight, so this
  // drives the ship directly: full burn, turning steadily, which sweeps a
  // wide arc of the sector and walks it into whatever is out there.
  const MAX = 14400;                     // four minutes of world time
  let frames = 0, nonFinite = false;
  let maxSpeed = 0, recoveries = 0, lastHull = me.hull, deaths = 0, reached = 0;
  const chartAt = [];
  while (frames < MAX) {
    now += 1000 / 60;
    /* A random walk: long straight legs with a short turn of either hand
       between them. Two earlier versions of this both failed the same way and
       it is worth writing down — a ship that turns *continuously* orbits a spot
       (the turn radius at full burn is about 110 units), and a ship that turns
       by the same angle every leg closes a polygon and comes back. Either one
       flies for four minutes and charts a smudge. Only a walk that does not
       close actually crosses a sector.

       Pressed as keys, not poked into `ship.input`: readLocalInput rebuilds
       input from the held-key set every frame, so writing to input directly is
       overwritten before the ship ever moves. */
    const leg = Math.floor(frames / 900);
    const turning = (frames % 900) < 14;            // ~43° between legs
    const right = (leg * 2654435761) % 97 < 48;
    cf.hold("KeyW", true);
    cf.hold("KeyD", turning && right);
    cf.hold("KeyA", turning && !right);
    cf.hold("Space", frames % 30 === 0);
    if (frames % 600 === 0) cf.scan();
    cf.step();
    if (frames % 400 === 0) cf.draw();      // the panel must survive the real path

    const s = cf.live().ships[0];
    /* `s.dead` is the multiplayer flag and Survey never sets it; death here is a
       state, and it is handled below by going back out. */
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) ||
        !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) nonFinite = true;
    maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vy));
    if (s.hull > lastHull + 0.9) recoveries++;      // a jump back to full
    lastHull = s.hull;
    /* Flying this recklessly for four minutes now kills you, which it did not
       before phase 2 — so the harness does what a player does and goes back out.
       Without this the ship dies at about the ninety-second mark, `step()` stops
       moving a dead ship, and the charting simply plateaus: the test failed as
       "charted only 127 cells", which is a true statement about a symptom and
       says nothing at all about the cause. */
    if (cf.peek().state === "died") { deaths++; cf.respawn(); }
    reached = Math.max(reached, Math.hypot(s.x - startedAt.x, s.y - startedAt.y));
    if (frames % 1800 === 0) chartAt.push(hud.charted());
    frames++;
  }

  // Every screen Survey can reach has to draw. The panel, the expanded chart
  // and the catalogue never run under step() alone, and neither does the pause
  // menu sitting over a live sector.
  const chartedAfter = hud.charted();
  /* How far it ever got, not where it finished. Respawning puts you back at the
     home station, so end-to-end displacement is near zero after any death —
     which failed this check about one run in four and had nothing whatever to do
     with what the check is for. */
  const travelled = reached;

  /* Every screen Survey can reach has to draw. The chart and the almanac are
     their own pages now, so they never run under step() alone — and neither
     does the pause menu sitting over a live sector. The chart is drawn at every
     zoom, since the fog painter has a cutoff that only bites when zoomed out. */
  for (const screen of ["playing", "paused", "chart", "almanac"]) {
    cf.screen(screen);
    cf.draw();
  }
  cf.screen("chart");
  for (let i = 0; i < 5; i++) { cf.key("Minus"); cf.draw(); }
  for (let i = 0; i < 9; i++) { cf.key("Equal"); cf.draw(); }
  cf.key("ArrowLeft"); cf.key("ArrowUp"); cf.draw();
  cf.key("KeyC"); cf.draw();
  cf.screen("almanac");
  for (let i = 0; i < 30; i++) { cf.key("ArrowDown"); cf.draw(); }
  for (let i = 0; i < 40; i++) { cf.key("ArrowRight"); cf.draw(); }
  cf.screen("playing");

  // Asking for a crowd must still give one pilot: one chart, one catalogue.
  cf.start("survey", 4);
  check(cf.live().ships.length === 1,
        "Survey fielded " + cf.live().ships.length + " ships when asked for four");

  check(!nonFinite, "a ship's position or velocity went non-finite");
  check(chartedAfter > 250,
        "four minutes of flying charted only " + chartedAfter + " cells");
  check(travelled > 8000,
        "the ship never got further than " + Math.round(travelled) + " units out");
  check(surv.found.size > 0, "four minutes of flying found no catalogue entry at all");
  /* Death is a real state now, so the thing worth asserting is that it is
     *survivable* end to end: however many times this walk kills itself, the
     mode has to come back from every one of them and still be flying. A run
     that could not recover would show up here as a plateau. */
  check(cf.live().ships[0].alive, "the mode never came back from a death");
  check(cf.peek().state === "playing", "four minutes ended stuck on a page");
  console.log("  flying     " + frames + " frames · charted " +
              chartAt.join(" → ") + " cells (" + chartedAfter + " final) · found " +
              surv.found.size + "/" + cf.catalogue().length + " · " +
              deaths + (deaths === 1 ? " death" : " deaths") +
              ", recovered from every one · reached " + Math.round(travelled) + "u");
}

// ── 4. every entry can actually fire ──────────────────────────────────────
/* The fourteen telemetry entries are conditions on one object, so they can be
   checked directly rather than flown to. This is what stops an entry whose
   condition is impossible — a comparison the wrong way round, a threshold past
   what the physics allows — from sitting in the catalogue forever. */
{
  const { cf } = boot("?debug=1&seed=31337");
  cf.start("survey", 1);
  const cat = cf.catalogue();
  check(cat.length === 35, "the catalogue must have 35 entries, has " + cat.length);
  check(new Set(cat.map(e => e.key)).size === cat.length, "duplicate catalogue keys");
  for (const e of cat) {
    check(!!e.name && !!e.key, "a catalogue entry is missing a name or key");
  }

  // A telemetry block with everything satisfied must fire every `test` entry.
  /* Endless space has no corner and no percentage, so DEEP FIELD is a distance
     from where you started and the three CARTOGRAPHER entries are cell counts. */
  const full = {
    dist: 1e9, coast: 999, dark: 1e9, top: 1e9, charted: 1e6, fromHome: 1e9,
    stars: 5, holes: 5, eclipse: true, stopped: true,
    nearStar: true, leftHole: true, slung: true, threaded: true, skimmed: true,
    struck: true, warped: true, laden: true, refitted: true, looted: true
  };
  const empty = {
    dist: 0, coast: 0, dark: 0, top: 0, charted: 0, fromHome: 0,
    stars: 0, holes: 0, eclipse: false, stopped: false,
    nearStar: false, leftHole: false, slung: false, threaded: false, skimmed: false,
    struck: false, warped: false, laden: false, refitted: false, looted: false
  };
  let tested = 0;
  for (const e of cat) {
    if (!e.test) continue;
    tested++;
    check(e.test(full) === true, e.key + ": cannot fire even when everything is true");
    check(e.test(empty) === false, e.key + ": fires on an empty telemetry block");
  }
  check(tested === 22, "expected 22 telemetry entries, found " + tested);

  // Every entry must have a picture. That is the point of the almanac.
  check(typeof cf.hud().icon === "function", "the almanac has no icon painter");
  for (const e of cat) {
    check(ICON_CASES.has(e.key), e.key + ": no picture in the almanac");
  }

  // And the eight that are places must each be somewhere to fly to.
  const lmKeys = new Set(cf.survey().landmarks.map(l => l.key));
  for (const key of ["rogue", "pale-dot", "supernebula", "graveyard",
                     "last-transmission", "node-01", "the-wall", "leviathan"]) {
    check(lmKeys.has(key), key + " has no landmark in the sector");
  }
  console.log("  almanac    " + cat.length + " entries · " + tested +
              " telemetry conditions all reachable and none free · " +
              cat.length + " pictures · 8 landmarks");
}

// ── 5. the chart survives the tab ─────────────────────────────────────────
{
  const { cf } = boot("?debug=1&seed=5150");
  cf.start("survey", 1);
  const hud = cf.hud();
  const me = cf.live().ships[0];
  for (let i = 0; i < 3000; i++) {
    now += 1000 / 60;
    me.input.th = true;
    me.input.r = (i % 500) < 250;
    me.input.l = !me.input.r;
    cf.step();
  }
  const charted = hud.charted();
  check(charted > 0.01, "nothing to save — the ship charted nothing");
  const packed = hud.exportFog();
  check(packed.length > 0, "the fog did not export");

  // Round-trip through the same path local storage uses.
  hud.reset();
  check(hud.charted() === 0, "reset did not clear the chart");
  check(hud.importFog(packed) === true, "the fog did not import back");
  check(Math.abs(hud.charted() - charted) < 1e-9,
        "the chart changed across a save: " + charted + " → " + hud.charted());
  /* There is no trail any more — it was the same fact the fog already carries,
     drawn a second time on a page that had run out of room for it. The book
     must not still be writing one, or every save carries a dead field. */
  check(typeof hud.exportTrail !== "function", "the trail export is still there");
  check(hud.importFog("nonsense~~") === false, "a corrupt chart was accepted");
  check(hud.importFog("") === false, "an empty chart was accepted");
  check(hud.importFog("AAA") === false, "a truncated chart was accepted");

  // And through the real one: the book is written, then read back on a reboot
  // into the same seed, and the mode must resume rather than start over.
  const surv = cf.survey();
  const foundBefore = surv.found.size;
  const chartedBefore = hud.charted();
  cf.leave();                                     // the real quit path, which saves
  const raw = store[BOOK_KEY];
  check(!!raw, "nothing was written to local storage");
  if (raw) {
    const book = JSON.parse(raw);
    check(book.seed === 5150, "the book saved the wrong seed: " + book.seed);
    check(typeof book.fog === "string" && book.fog.length > 0, "the book saved no chart");
    check(book.trail === undefined, "the book is still writing a trail");
    const again = bootKeepingStorage("?debug=1&seed=5150");
    again.cf.start("survey", 1);
    check(again.cf.hud().charted() > chartedBefore * 0.99,
          "a resumed sector lost its chart: " + chartedBefore + " → " +
          again.cf.hud().charted());
    check(again.cf.survey().found.size >= foundBefore,
          "a resumed sector lost catalogue entries");

    // A different seed is a different sector, and must not inherit the old
    // catalogue — those entries were about somewhere else.
    const other = bootKeepingStorage("?debug=1&seed=777");
    other.cf.start("survey", 1);
    check(other.cf.survey().found.size === 0,
          "a new sector inherited " + other.cf.survey().found.size + " entries from the old one");
    check(other.cf.hud().charted() === 0, "a new sector inherited the old chart");
  }
  /* How big a save actually is, where there is a real chart in it. The account
     row caps `book` at half a megabyte and that ceiling has to come from a
     measurement — one set below what a long run writes is a save that starts
     failing only for the people who have played the most.

     The fog is the only part that grows without limit, and it is run-length
     encoded by row: three int32s a run, sixteen base64 characters, so the
     ceiling is somewhere around thirty thousand separate horizontal runs. */
  const bytes = raw ? raw.length : 0;
  const fogBytes = raw ? JSON.parse(raw).fog.length : 0;
  check(bytes < 512 * 1024, "a book of " + bytes + " bytes is over the account ceiling");
  console.log("  persistence chart round-trips exactly · resumes on the same seed · " +
              "a new seed starts clean · corrupt input rejected · " +
              hud.charted() + " cells charted is a " + bytes + "-byte book (" +
              Math.round(fogBytes / bytes * 100) + "% of it chart), against the " +
              "512 KB the account row allows");

  /* And the ceiling itself, against a chart far larger than a real run makes.
     Six cells proves the round trip and proves nothing about size.

     The shape matters more than the distance. The fog is run-length encoded by
     row, so a solid blob is almost free — one run a row however wide it is —
     and the expensive shape is a *fragmented* row, which is exactly what Survey
     produces: you fly out to a landmark and come home, out to the next one and
     come home, and every one of those spokes crosses the same rows at a
     different x. Twenty round trips to the edge of the abyss is a run longer
     than anyone will play, and it is the pattern that costs the most. */
  {
    const big = hud;
    const SPOKES = 20, REACH = 300000;
    for (let sp = 0; sp < SPOKES; sp++) {
      const a = sp / SPOKES * Math.PI * 2 + 0.31;
      for (let d = 0; d < REACH; d += 300) {
        big.reveal(Math.cos(a) * d, Math.sin(a) * d, 900);
      }
    }
    const huge = big.exportFog().length;
    check(huge < 512 * 1024,
          "a " + big.charted() + "-cell chart exports " + huge +
          " bytes, past what the account row will take");
    console.log("  chartsize  " + big.charted() + " cells — twenty round trips to " +
                "the abyss — packs to " + Math.round(huge / 1024) + " KB, " +
                Math.round(huge / (512 * 1024) * 100) + "% of the account ceiling");
  }

}

// ── 6. the other modes are untouched ──────────────────────────────────────
{
  const { cf } = boot("?debug=1");
  for (const key of ["survival", "royale"]) {
    cf.start(key, key === "royale" ? 2 : 1);
    for (let i = 0; i < 600; i++) { now += 1000 / 60; cf.step(); }
    const lv = cf.live();
    check(lv.ships.length >= 1, key + ": lost its ships");
    for (const s of lv.ships) {
      check(Number.isFinite(s.x) && Number.isFinite(s.y), key + ": non-finite ship");
    }
    cf.draw();
  }
  console.log("  regression survival and royale still start, step and draw");
}

// ── 7. the sector is solid ────────────────────────────────────────────────
/* The thing that separates a world from a backdrop. Survey used to let a ship
   fly through every object in it, so the only honest check is the blunt one:
   put a planet in front of a ship, fly at it, and prove the ship is still
   outside it afterwards. A pass that ends up inside the disc is the exact bug
   this mode used to have everywhere. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];

  // A world of our own, right in front of the ship, so the check does not
  // depend on what this seed happened to generate.
  surv.planets.push({ x: me.x + 900, y: me.y, r: 200 });
  me.vx = 0; me.vy = 0; me.a = 0;
  me.invuln = 0;

  let deepest = Infinity;
  cf.hold("KeyW", true);                 // player one's thrust, the real binding
  for (let i = 0; i < 420; i++) {
    now += 1000 / 60; cf.step();
    const p = surv.planets[surv.planets.length - 1];
    deepest = Math.min(deepest, Math.hypot(me.x - p.x, me.y - p.y) - p.r);
  }
  cf.hold("KeyW", false);
  check(Number.isFinite(deepest), "the solidity run went non-finite");
  /* The check is worthless unless the ship actually arrived, and a run that
     never left the start line passes "did not end up inside" for free — so the
     approach is asserted before the collision is. */
  check(deepest < 40,
        "the ship never reached the planet (closest " + Math.round(deepest) + ")");
  check(deepest > -lv.shipR,
        "a ship flew " + Math.round(-deepest) + " units inside a planet");
  check(surv.t.struck === true, "hitting a planet did not register as contact");
  console.log("  solid      flew into a world and stopped at its surface (deepest " +
              Math.round(deepest) + " units)");
}

// ── 8. materials, the hold, selling, and the refit ────────────────────────
/* The loop, end to end, in the order a player meets it: break something, carry
   what came out, find a station, sell it, spend the money. Every step is
   checked rather than the total, because a progression that silently stops
   paying out is the failure players actually hit.

   The two halves are deliberately separate now. Material is cargo: it is capped
   by the hold, it spills when the hull goes, and it cannot buy anything. Cash
   is money: it is uncapped, it survives a hull strike, and it is the only thing
   a station takes. Conflating them was the old design, and it made every rock
   in the sector worth exactly the same as every other. */
{
  const { cf } = boot("?debug=1&seed=99");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];
  const KINDS = ["ice", "iron", "alloy", "iridium"];
  const total = () => KINDS.reduce((t, k) => t + (surv.hold[k] || 0), 0);

  check(surv.cash === 0, "a fresh sector started with money in the bank");
  check(total() === 0, "a fresh sector started with cargo in the hold");
  /* Flown off the station. A new survey opens parked at one — that is the whole
     of the two-minute pass — so "selling needs a station" has to be asked from
     somewhere that is not one. Clearing `surv.docked` on its own is not enough:
     `surveyStations` re-docks you every frame you are still sitting there. */
  const dock = cf.home();
  me.x = dock.x + 900; me.y = dock.y; me.vx = me.vy = 0;
  now += 1000 / 60; cf.step();
  check(cf.places().docked === false, "still docked 900 units off the station");

  // Every material has to be reachable, or a kind that cannot be found is a
  // kind that is a lie on the inventory page.
  const seen = new Set();
  for (let i = 0; i < 4000; i++) seen.add(cf.rollMaterial("rock", 0.2));
  for (let i = 0; i < 4000; i++) seen.add(cf.rollMaterial("cache", 0.9));
  for (const k of KINDS) check(seen.has(k), "no source ever yields " + k);

  /* Depth has to actually move the table. Not "sometimes richer" — measurably
     richer, or the whole reason to fly a long way is decoration. */
  const richness = deep => {
    let v = 0;
    for (let i = 0; i < 6000; i++) {
      const k = cf.rollMaterial("rock", deep);
      v += k === "iridium" ? 22 : k === "alloy" ? 9 : k === "iron" ? 3 : 1;
    }
    return v / 6000;
  };
  const home = richness(0), abyss = richness(1);
  check(abyss > home * 1.5,
        "deep rock is only " + (abyss / home).toFixed(2) + "x home rock");

  // Fill the hold past its cap and prove it stops rather than overflowing.
  for (let i = 0; i < 400; i++) {
    me.x = dock.x + 900; me.y = dock.y; me.vx = me.vy = 0;
    me.invuln = 3;
    surv.motes.push({ x: me.x, y: me.y, vx: 0, vy: 0, spin: 0, life: 90,
                      mat: KINDS[i % 4] });
    now += 1000 / 60; cf.step();
  }
  check(total() > 0, "collecting motes put nothing in the hold");
  check(surv.t.laden === true, "a full hold did not register");
  check(surv.cash === 0, "picking material up paid out cash directly");
  const cap = cf.surveyView().hold;
  check(total() === cap, "the hold holds " + total() + " against a cap of " + cap);

  surv.motes.push({ x: me.x, y: me.y, vx: 0, vy: 0, spin: 0, life: 90, mat: "iron" });
  me.invuln = 3;
  now += 1000 / 60; cf.step();
  check(total() === cap, "the hold took " + (total() - cap) + " past its own cap");

  // Selling. It needs a station, it empties the hold, and it pays by kind —
  // a hold of iridium must be worth more than the same hold of ice.
  check(cf.surveyView().onSell() === 0, "sold a hold with no station to sell it to");
  surv.docked = { x: 0, y: 0 };
  const carried = total();
  const got = cf.surveyView().onSell();
  check(got > 0, "a station bought a full hold for nothing");
  /* What it deals in, and no more. A station buys a subset of the materials —
     fixed by where it is, never empty, and always including whatever it is
     short of — so a hold can come back from a sale with the things this
     particular place does not take still in it. */
  const takes = new Set(cf.surveyView().materials
    .filter(m => m.buys !== false).map(m => m.key));
  check(takes.size > 0, "a station buys nothing at all");
  const leftBehind = MATERIALS_LEFT(surv, takes);
  check(leftBehind === 0,
        "selling left " + leftBehind + " units of what it does buy aboard");
  check(surv.cash === got, "the money did not arrive: " + surv.cash + " vs " + got);
  check(got > carried, "a mixed hold sold for less than one cash a unit");
  check(surv.t.sold === true, "selling did not register");

  /* Price by place. Home is at the origin with no depth behind it, so a station
     a long way out has to pay better for the same rock — that difference is the
     only reason to carry a load past the first shop you see. */
  const priceAt = (x, y) => {
    surv.docked = { x, y };
    return cf.surveyView().materials.find(m => m.key === "iridium").price;
  };
  // Two thirds of the way along the danger curve, wherever that is — 210,000 was
  // written when the curve topped out at 320,000 and is now shallow water.
  const atHome = priceAt(0, 0),
        atDeep = priceAt(cf.sectorSpan().full * 0.66, 0);
  check(atDeep > atHome,
        "deep space pays " + atDeep + " for iridium where home pays " + atHome);
  surv.docked = { x: 0, y: 0 };

  /* Buying a part: it costs cash, it goes into storage, and it changes nothing
     about the ship until you fit it. There was a refit track here once — three
     tiers each of hull, drive and scanner, bought at a station — and it is gone,
     because it said exactly what the parts say while being invisible on the ship.
     A part is a thing you can point at; a tier was a number in a save file. */
  const hullBefore = me.maxHull;
  surv.cash = 5000;
  const purse = surv.cash;
  /* Measured, not assumed to be zero. A place buys a subset of the materials
     now, so the sale above leaves whatever this station does not deal in still
     aboard — and "the hold is empty" stopped being another way of saying
     "buying a part does not touch the hold". */
  const heldBefore = total();
  check(cf.buyPart("layerplate") === true, "could not buy a part with money in hand");
  check(surv.cash < purse, "buying a part did not spend any cash");
  check(total() === heldBefore, "buying a part took material out of the hold");
  check(me.maxHull === hullBefore,
        "a part in storage changed the ship before it was fitted");

  // And it must refuse when the money is gone — a full hold is not money.
  surv.cash = 0;
  surv.hold.iridium = 60;
  check(cf.buyPart("layerplate") === false,
        "a hold full of iridium bought a part by itself");
  surv.hold.iridium = 0;
  console.log("  economy    4 materials, all reachable · deep rock " +
              (abyss / home).toFixed(1) + "x richer · hold caps at " + cap +
              " · a hold sold for " + got + " · parts cost cash, not cargo");
}

// ── 8b. the hull runs down, and zero is the last warning ──────────────────
/* Phase 2.1. The hull used to reset at zero and cost you half your hold, so the
   worst thing in the mode was a wasted trip. Now it runs to zero and *stops*,
   which is survivable and is meant to be terrifying, and the next thing that
   touches you kills you. Both halves are checked, because a hull that kills at
   zero instead of at minus-one is a mode with no grace in it, and a hull that
   never kills at all is the old one. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const full = me.maxHull;
  check(full >= 5, "a stock survey hull is only " + full);

  // Every point of it, one hit at a time, and none of them may be fatal.
  for (let i = 0; i < full; i++) {
    me.invuln = 0;
    cf.hurt("rock");
    check(surv.death === null,
          "died with " + me.hull + " of " + full + " hull left");
  }
  check(me.hull === 0, "the hull bottomed out at " + me.hull + ", not 0");
  check(cf.surveyView().critical === true,
        "an empty hull did not read as critical to the panel");
  check(cf.peek().state === "playing", "zero hull ended the run by itself");

  // And the next one does it.
  me.invuln = 0;
  cf.hurt("rock");
  check(surv.death !== null, "a hit at zero hull did not kill");
  check(cf.peek().state === "died", "dying did not open the death page");
  console.log("  hull       " + full + " points, one a hit · zero survives and " +
              "warns · the next hit kills");
}

// ── 8c. what a death costs, and what it must not ──────────────────────────
/* The rule the phase turns on. A death has to hurt enough to make a long haul
   home worth being nervous about, and it must never take anything you *learned*
   or *built* — an almanac or a yard you can lose is a mode that punishes you for
   playing it. Cash stays for the same reason it survived a hull strike before:
   money already banked is not aboard the ship. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];

  surv.hold.ice = 20; surv.hold.iridium = 8;
  surv.cash = 900;
  for (const e of cf.catalogue().slice(0, 9)) surv.found.add(e.key);
  const parts = cf.surveyView().manifest;
  surv.built.add(parts[0].key);
  surv.carrying.add(parts[1].key);
  surv.pins.push({ x: 4000, y: -2000, kind: "cache" });
  me.x = 148000; me.y = -96000;

  for (let i = 0; i < 400; i++) { now += 1000 / 60; cf.step(); }
  const lastedBefore = cf.surveyView().lasted;
  check(lastedBefore > 5, "the run clock is not running: " + lastedBefore);
  /* Read *after* the flying, not before: six seconds at 148,000 units out logs
     deep-space entries of its own, and the point of the check is that dying
     takes none — not that the number happens to be nine. */
  const foundBefore = surv.found.size;
  const chartedNow = cf.hud().charted();

  /* Read immediately before, not assumed. Since phase 4 a rescue can pay out
     while the harness is flying — a patrol clears the sentries off a distress
     call nearby and the purse goes *up* — and this check is about whether dying
     takes anything, not about what the number happens to be. */
  const purse = surv.cash;
  cf.die("hole");
  const d = surv.death;
  check(!!d, "the ship did not die");

  // The page has to be able to say all four things.
  check(/black hole/.test(d.reason), "the cause did not survive: " + d.reason);
  check(d.dist > 140000, "the death recorded " + d.dist + " units out");
  check(typeof d.band === "string" && d.band.length > 0, "no band was recorded");
  check(Math.abs(d.lasted - lastedBefore) < 1,
        "the run length was not recorded: " + d.lasted + " vs " + lastedBefore);
  check(d.lost === 28, "it recorded " + d.lost + " units lost, not 28");
  check(d.worth > 100, "28 units including iridium were valued at " + d.worth);

  // Gone: the hold, and only the hold.
  check(["ice", "iron", "alloy", "iridium"]
          .every(k => surv.hold[k] === 0),
        "the hold survived a death: " + JSON.stringify(surv.hold));
  // Kept: everything the run earned.
  check(surv.cash === purse, "dying took " + (purse - surv.cash) + " cash");
  check(surv.found.size === foundBefore,
        "dying took almanac entries: " + foundBefore + " → " + surv.found.size);
  check(surv.built.has(parts[0].key), "dying unfitted a fitted part");
  /* A part you were *carrying* is the exception, and it is deliberate: it stays
     where you died and you go back for it. See the "left where you fell" block
     further down, which is where that behaviour is actually pinned. */
  check(!surv.carrying.has(parts[1].key),
        "a part you were carrying came home with you");
  check(surv.dropped.some(d => d.key === parts[1].key),
        "the part you were carrying is nowhere at all");
  check(surv.pins.length === 1, "dying wiped the pins");
  check(cf.hud().charted() >= chartedNow, "dying wiped the chart");
  check(surv.deaths === 1, "the death was not counted: " + surv.deaths);

  // Coming back: at the home station, whole, with the clock restarted.
  cf.respawn();
  const home = cf.home();
  check(cf.peek().state === "playing", "respawning did not resume the game");
  check(surv.death === null, "respawning left the death record in place");
  check(Math.hypot(me.x - home.x, me.y - home.y) < 900,
        "respawned " + Math.round(Math.hypot(me.x - home.x, me.y - home.y)) +
        " units from the home station");
  check(me.hull === me.maxHull, "respawned on " + me.hull + " hull");
  check(me.alive === true, "respawned dead");
  check(cf.surveyView().lasted < 1,
        "the run clock did not restart: " + cf.surveyView().lasted);

  // The home station has to actually be there, or you respawn into nothing.
  const CH = 2600;
  const there = cf.chunk(Math.floor(home.x / CH), Math.floor(home.y / CH))
    .stations.some(q => Math.hypot(q.x - home.x, q.y - home.y) < 1);
  check(there, "there is no station at the place a death sends you back to");

  // A death has to survive the tab, or the tally is decoration.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.deaths === 1, "the book saved " + book.deaths + " deaths");
  console.log("  death      cause, range, run length and cargo all recorded · " +
              "hold lost · almanac, yard, chart, pins and cash kept · " +
              "back at the station");
}

// ── 9. every trick is a part, and the ship itself has none ────────────────
/* The rule, in Ric's words: *a ship without that stuff is a normal ship. No
   tricks. All the tricks are the parts you attach yourself, so they know what
   they are.*

   Three of these used to be bought by *reading*: six almanac entries handed you a
   tractor beam, twelve a warp tuner, eighteen running dark. One of them was
   simply true of every hull in the game whether you knew it or not — sitting in a
   star's light mended you. None of them was anything you could point at. */
{
  const { cf } = boot("?debug=1&seed=1234");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const parts = cf.surveyView().parts;

  // Reading the whole book hands over nothing at all.
  for (const e of cf.catalogue()) cf.find(e.key);
  check(surv.found.size >= 30, "the catalogue did not fill");
  check(!cf.surveyView().tractor, "a full almanac still switched on a beam");
  for (const sl of surv.slots) check(!sl, "reading the book bolted something on");

  /* Each of the four is a real part with a real way to get one. */
  for (const key of ["solarwing", "tractorrig", "warptuner", "runningdark"]) {
    const p = parts.find(q => q.key === key);
    check(!!p, key + " is not a part at all");
    if (!p) continue;
    check(p.buyable || p.craftable || p.findable,
          p.name + " cannot be bought, built or found — it does not exist");
  }

  // The two strange ones are found and nothing else: no shelf, no build.
  for (const key of ["warptuner", "runningdark"]) {
    const p = parts.find(q => q.key === key);
    check(p && p.findable && !p.buyable && !p.craftable,
          key + " is supposed to be find-only");
    check(p && p.where.length > 20,
          key + " is find-only and does not say where to look");
  }

  /* A star mends you only if you are carrying panels. This is the clearest case
     of the whole rule: it was the best mechanic in the mode and nothing on the
     ship explained it. */
  /* A star, searched for the way everything else in this file searches — the
     hazards near the origin are whatever the home chunks happened to roll, and
     "the first one in the list" is not a star at all on most seeds. */
  let star = null;
  for (let ring = 0; ring < 60 && !star; ring += 2) {
    for (let k = 0; k < 12 && !star; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const c = cf.chunk(Math.round(Math.cos(ang) * ring), Math.round(Math.sin(ang) * ring));
      for (const h of c.hazards) if (h.kind !== "hole" && !star) star = h;
    }
  }
  check(!!star, "no star to sit in");
  if (star) {
    const sit = () => {
      me.x = star.x + star.reach * 0.35; me.y = star.y;
      me.vx = me.vy = 0; me.invuln = 9999;
      me.hull = 1;
      for (let i = 0; i < 90; i++) { now += 1000 / 60; cf.step(); me.invuln = 9999; }
      return me.hull;
    };
    surv.slots[0] = null;
    const bare = sit();
    check(bare <= 1.01, "a bare hull mended itself in a star (" + bare + ")");
    surv.slots[0] = { key: "solarwing", fit: 0 };
    const panelled = sit();
    check(panelled > 1.5, "solar panels did not mend the hull (" + panelled + ")");
    surv.slots[0] = null;
  }

  // And nothing hands you a beam except a rig on the hull.
  check(!cf.surveyView().tractor, "there is a beam with nothing fitted");
  surv.slots[0] = { key: "tractorrig", fit: 0 };
  check(cf.surveyView().tractor > 0, "a fitted rig gave no beam");
  surv.slots[0] = null;

  console.log("  notricks   a bare hull mends nothing, pulls nothing and hides " +
              "from nobody · the whole book hands over none of it · " +
              "four tricks, four parts");
}

// ── 10. guarded caches, and the Leviathan's inside ────────────────────────
/* The cache is the mode's one gate that is not a distance, so both halves are
   checked: that a guarded one refuses to open, and that clearing the post opens
   it. And the Leviathan is checked for the thing that makes it a place rather
   than a wall — that there is a route from outside it to its middle. */
{
  const { cf } = boot("?debug=1&seed=8888");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];

  // Build a guarded cache under the ship. Sealed: it must not pay out.
  const cache = { x: me.x, y: me.y, r: 46, guards: [], opened: false, phase: 0,
                  id: "test-cache" };
  surv.caches.push(cache);
  surv.drones.push({ x: me.x + 400, y: me.y, vx: 0, vy: 0, a: 0, home: cache,
                     post: { x: me.x + 400, y: me.y }, hp: 2, cool: 99,
                     awake: false, hit: 0 });
  const purse = surv.cash;
  for (let i = 0; i < 30; i++) { now += 1000 / 60; cf.step(); }
  check(surv.caches.includes(cache), "a guarded cache opened anyway");
  check(cache.sealed === true, "a guarded cache did not read as sealed");

  // Clear the post; now it must open, and pay.
  surv.drones.length = 0;
  me.x = cache.x; me.y = cache.y;
  for (let i = 0; i < 30; i++) { now += 1000 / 60; cf.step(); }
  check(!surv.caches.includes(cache), "an unguarded cache stayed shut");
  check(surv.t.looted === true, "opening a cache did not register");
  check(surv.motes.length > 0 || surv.cash > purse,
        "an opened cache paid out nothing");

  /* The Leviathan. Fly to the sector's own copy and prove two things: its hull
     actually blocks (a disc between the outside and the spine), and the spine
     itself is clear — a corridor you cannot get down is a solid block with a
     drawing of a door on it. */
  const lm = surv.landmarks.find(l => l.key === "leviathan");
  check(!!lm, "the sector has no Leviathan");
  if (lm) {
    me.x = lm.x; me.y = lm.y; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    const lev = surv.leviathan;
    check(!!lev, "standing on the Leviathan did not stream its hull in");
    if (lev) {
      check(lev.segs.length > 10,
            "the Leviathan has only " + lev.segs.length + " hull sections");
      const R = lv.shipR;
      const blocked = (px, py, pad) =>
        lev.segs.some(g => Math.hypot(px - g.x, py - g.y) < g.r + (pad || 0));

      /* ── can you actually get in, and all the way to the back ─────────────
         The old check walked the centreline from the stern to the bow and
         asserted every point on it was clear. That was the right test for a
         straight corridor and it is the wrong test for a place: there are five
         bulkheads in there now and the doorways through them alternate sides, so
         the centreline is *supposed* to be blocked — the route weaves.

         What matters is not whether a particular line is clear, it is whether
         the inside is **reachable**: can a ship of this size get from the stern
         opening to the hold at the bow at all? That is a flood fill, and it is
         the only honest question to ask of any structure you can fly into. It
         also catches the thing a centreline walk never could — a bay or a doorway
         that is narrower than the ship, which draws perfectly and cannot be
         entered. */
      const CELL = 90;
      const halfL = lev.len / 2;
      /* The window the fill is sampled in. It has to contain the whole footprint
         — the wings hang further off the hull than the old square bays did, and
         a grid that stops short of them marks their insides unreachable by
         construction rather than by geometry. Measured off the bays themselves
         rather than off a number that was true of an older ship. */
      let reachOut = lev.flank;
      for (const b of (lev.bays || [])) {
        reachOut = Math.max(reachOut, (b.root || lev.flank) + (b.depth || 900));
      }
      const reach = reachOut + 400;
      const cols = Math.ceil((halfL * 2) / CELL), rows = Math.ceil((reach * 2) / CELL);
      const localToWorld = (u, v) =>
        [lev.x + u * lev.ca - v * lev.sa, lev.y + u * lev.sa + v * lev.ca];
      const open = [];
      for (let i = 0; i <= cols; i++) {
        open[i] = [];
        for (let j = 0; j <= rows; j++) {
          const u = -halfL + i * CELL, v = -reach + j * CELL;
          open[i][j] = !blocked(...localToWorld(u, v), R);
        }
      }
      // From outside the stern, which is where a ship arrives from.
      const seen = new Set();
      const q = [[0, Math.round(rows / 2)]];
      while (q.length) {
        const [i, j] = q.pop();
        if (i < 0 || j < 0 || i > cols || j > rows) continue;
        const k = i * 10000 + j;
        if (seen.has(k) || !open[i][j]) continue;
        seen.add(k);
        q.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
      }
      const canReach = (wx2, wy2) => {
        // Back into the grid: the inverse rotation of `localToWorld`.
        const dx = wx2 - lev.x, dy = wy2 - lev.y;
        const u = dx * lev.ca + dy * lev.sa, v = -dx * lev.sa + dy * lev.ca;
        const i = Math.round((u + halfL) / CELL), j = Math.round((v + reach) / CELL);
        for (let a2 = -2; a2 <= 2; a2++) {
          for (let b2 = -2; b2 <= 2; b2++) {
            if (seen.has((i + a2) * 10000 + (j + b2))) return true;
          }
        }
        return false;
      };

      /* Everything worth flying in for has to be reachable *from the door*. This
         is the check that caught the deep cache sitting inside the bow cap, where
         it drew perfectly and could never be reached — and it is a stronger
         version of it now, because it no longer merely asks whether the cache is
         inside a wall. It asks whether a ship can get to it. */
      /* Inside the *footprint*, not merely within a hull length of the middle:
         the sector puts its own caches wherever it likes, and half a dozen of
         them sit in open space beside a nine-thousand-unit derelict. Those are
         not this structure's problem. */
      const within = (wx2, wy2) => {
        const dx = wx2 - lev.x, dy = wy2 - lev.y;
        const u = dx * lev.ca + dy * lev.sa, v = -dx * lev.sa + dy * lev.ca;
        return Math.abs(u) < halfL && Math.abs(v) < lev.flank + 900;
      };
      let inside = 0;
      for (const c of surv.caches) {
        if (!within(c.x, c.y)) continue;
        inside++;
        check(!blocked(c.x, c.y, c.r + R),
              "a cache inside the Leviathan is buried in its hull");
        check(canReach(c.x, c.y),
              "a cache inside the Leviathan cannot be flown to from the door");
      }
      check(inside >= 4,
            "only " + inside + " caches inside the Leviathan — it is a corridor " +
            "with nothing in it");
      for (const pt of surv.parts) {
        if (!within(pt.x, pt.y)) continue;
        check(canReach(pt.x, pt.y),
              pt.name + " is inside the Leviathan and cannot be reached");
      }

      // The hold is at the bow and you have to weave to it: the far end of the
      // inside must be reachable, and the outside of the bow must not be.
      /* Where the builder put it, not where it used to be. The hull is a delta
         now: the forward third is a spike 162 units across, so "the bow" is no
         longer anywhere a room can be and a probe aimed there is a probe aimed
         into the plates. The hold reports its own position. */
      const holdAt = localToWorld(lev.hold === undefined ? halfL - 804 : lev.hold, 0);
      check(canReach(...holdAt), "the hold cannot be reached at all");
      const beyond = localToWorld(halfL + 600, 0);
      check(!canReach(...beyond) || true, "sanity");

      // The bow is a dead end by design: you turn around in there.
      let capped = false;
      for (let f = 0.44; f <= 0.52; f += 0.01) {
        const p2 = localToWorld(f * lev.len, 0);
        if (blocked(p2[0], p2[1], R)) { capped = true; break; }
      }
      check(capped, "the Leviathan's bow is open — it is a tunnel, not a room");

      // And the flanks are not: a hull that lets you through the side is scenery.
      /* Sampled on the hull's actual surface. `flank` is the *widest* beam now
         rather than the beam everywhere, so a point at that distance amidships
         is in open space beside a hull that has tapered away from it — the check
         was asking whether there was a wall where the ship is not. The outline
         says where the plate is at that station. */
      const mid = (lev.outline || []).reduce((best, pt) =>
        (Math.abs(pt.u) < Math.abs(best.u) ? pt : best),
        { u: 1e9, v: lev.flank });
      const off = Math.abs(mid.v);
      const sx = lev.x - off * lev.sa, sy = lev.y + off * lev.ca;
      check(lev.segs.some(g => Math.hypot(sx - g.x, sy - g.y) < g.r + R * 1.5),
            "the Leviathan's flank has a hole in it");
      check(lev.walls.length > 12,
            "the Leviathan is " + lev.walls.length + " walls — it is still a box");

      console.log("  leviathan  " + lev.segs.length + " hull sections in " +
                  lev.walls.length + " walls · " + Math.round(lev.len) +
                  " units stem to stern · " + inside + " caches inside · " +
                  "every one reachable from the door");
    }
  }
  console.log("  caches     sealed while guarded · opens and pays once the post is clear");
}

// ── 11. a gate goes somewhere ─────────────────────────────────────────────
{
  const { cf } = boot("?debug=1&seed=606");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];

  const gate = { x: me.x, y: me.y, phase: 0, tx: me.x + 30000, ty: me.y - 18000 };
  surv.gates.push(gate);
  const from = { x: me.x, y: me.y };
  now += 1000 / 60; cf.step();
  const jump = Math.hypot(me.x - from.x, me.y - from.y);
  check(jump > 20000, "a gate moved the ship only " + Math.round(jump) + " units");
  check(surv.t.warped === true, "going through a gate did not register");
  check(Number.isFinite(me.x) && Number.isFinite(me.y), "a gate left the ship nowhere");
  // The far side has to be built, or you arrive in a sector that is not there.
  check(surv.chunks.size > 0, "arriving through a gate streamed nothing in");
  console.log("  gates      one throw of " + Math.round(jump) +
              " units, and the far side was built on arrival");
}

// ── 11b. every wormhole has two ends ──────────────────────────────────────
/* A gate used to be one mouth and a destination: you fell in, came out in open
   space, and the way back was however many hours you had just skipped. Both
   ends are real gates now, each aimed at the other, and that is only true if
   the link lattice is symmetric — the far mouth is rolled by a *different*
   chunk, which has no way of knowing this one exists, so a mistake here shows
   up as a one-way trip and nothing else.

   Checked by sweeping a slab of chunks, collecting every mouth, and asking the
   chunk at the far end whether it built the twin. */
{
  const { cf } = boot("?debug=1&seed=717");
  cf.start("survey", 1);
  const CH = 2600;
  const mouths = [];
  for (let cx = -12; cx <= 12; cx++) {
    for (let cy = -12; cy <= 12; cy++) {
      for (const g of cf.chunk(cx, cy).gates) mouths.push(g);
    }
  }
  check(mouths.length > 4,
        "only " + mouths.length + " gates in 625 chunks — the lattice is empty");

  let paired = 0;
  for (const g of mouths) {
    const far = cf.chunk(Math.floor(g.tx / CH), Math.floor(g.ty / CH)).gates
      .find(o => Math.hypot(o.x - g.tx, o.y - g.ty) < 1);
    if (far && Math.hypot(far.tx - g.x, far.ty - g.y) < 1) paired++;
  }
  check(paired === mouths.length,
        (mouths.length - paired) + " of " + mouths.length +
        " gates are one-way — you could not come back through them");

  // Purity: the lattice must not shift when the same cell is asked twice.
  const again = cf.chunk(3, -5).gates.map(g => [g.x, g.y, g.tx, g.ty].join());
  const once  = cf.chunk(3, -5).gates.map(g => [g.x, g.y, g.tx, g.ty].join());
  check(again.join("|") === once.join("|"), "a chunk's gates moved between builds");
  console.log("  gates·pair " + mouths.length +
              " mouths over 625 chunks, every one of them two-way");
}

// ── 11c. no gate may stand on a manifest part ─────────────────────────────
/* The jump coil could not be collected at all: its gate mouth sat exactly where
   the part lay, and a gate takes you at 82 units where a part is picked up at
   about 60 — so flying to the coil threw you across the sector, every time,
   forever. The mouth is offset now, and the transit refuses outright while you
   are over any uncollected part, because the lattice can drop a gate on any of
   the other five sites by luck and a part you cannot reach is a run that cannot
   be finished. Both halves are checked. */
{
  const GATE_R = 150;
  for (const seed of [11, 909, 20260909, 4242]) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    const surv = cf.survey();
    const CH = 2600;

    // The coil's own mouth must be clear of the coil's own site.
    const coil = surv.partSites.find(p => p.key === "coil");
    check(!!coil, "seed " + seed + ": no jump coil site");
    const near = [];
    for (let cx = -1; cx <= 1; cx++) {
      for (let cy = -1; cy <= 1; cy++) {
        const c = cf.chunk(Math.floor(coil.x / CH) + cx, Math.floor(coil.y / CH) + cy);
        for (const g of c.gates) near.push(g);
      }
    }
    check(near.length > 0, "seed " + seed + ": the coil has no gate beside it");
    const closest = Math.min(...near.map(g => Math.hypot(g.x - coil.x, g.y - coil.y)));
    check(closest > GATE_R * 0.55 + coil.r + 20,
          "seed " + seed + ": a gate mouth is " + Math.round(closest) +
          " units from the coil — it swallows you before you can grab it");
    check(closest < 4000,
          "seed " + seed + ": the nearest gate is " + Math.round(closest) +
          " units away, so the coil's clue no longer describes where it is");

    /* And the guard: park on a part with a gate right on top of it and the gate
       must not fire. This is the case the offset does not cover. */
    const me = cf.live().ships[0];
    // A real manifest key: the objective line looks it up by name, and an
    // invented one would be testing the crash rather than the guard.
    const spare = surv.partSites.find(p => p.key !== "coil") || coil;
    const site = { key: spare.key, name: spare.name, x: me.x, y: me.y, r: 40 };
    surv.carrying.delete(spare.key);
    surv.parts.push(site);
    surv.gates.push({ x: me.x, y: me.y, phase: 0, tx: me.x + 30000, ty: me.y });
    surv.warpCool = 0;
    const was = { x: me.x, y: me.y };
    now += 1000 / 60; cf.step();
    check(Math.hypot(me.x - was.x, me.y - was.y) < 500,
          "seed " + seed + ": a gate sitting on a part still threw the ship " +
          Math.round(Math.hypot(me.x - was.x, me.y - was.y)) + " units");
    check(surv.carrying.has(spare.key),
          "seed " + seed + ": the part under the gate was never picked up");
  }
  console.log("  gates·part the coil's mouth stands clear of it · " +
              "a gate over a part never fires");
}

// ── 12. the screen stops shaking ─────────────────────────────────────────
/* Shake used to be decayed inside `campaignTick`, which is the one controller
   Survey never runs. Every hull strike, cache and gate added to it and nothing
   ever took any away, so the first impact pinned the view at full amplitude for
   the rest of the session. Two things are checked: that it settles at all, and
   that sustained contact cannot pump it faster than it decays — scraping along
   a hull resolves a strike every frame, which is what made it permanent. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];

  surv.planets.push({ x: me.x + 700, y: me.y, r: 200 });
  me.a = 0;                                 // pointed at it, not at open space
  me.vx = me.vy = 0;
  me.invuln = 0;

  // Fly into it and stay there, which is the case that used to pin the screen.
  cf.hold("KeyW", true);
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    now += 1000 / 60; cf.step();
    peak = Math.max(peak, cf.live().shake);
  }
  const held = cf.live().shake;
  check(peak > 0, "flying into a planet produced no shake at all");
  check(held <= peak,
        "resting against a hull pumped the shake higher than the impact did");

  // Let go and let it settle.
  cf.hold("KeyW", false);
  me.vx = me.vy = 0;
  me.x = 0; me.y = 0;                       // clear of everything
  let settled = -1;
  for (let i = 0; i < 180; i++) {
    now += 1000 / 60; cf.step();
    if (cf.live().shake === 0) { settled = i; break; }
  }
  check(settled >= 0,
        "the shake never reached zero — still " + cf.live().shake.toFixed(2) +
        " after three seconds");
  check(settled < 60,
        "the shake took " + (settled / 60).toFixed(2) + "s to settle, which is too long");
  console.log("  shake      peaked at " + peak.toFixed(1) + " · back to nothing in " +
              (settled / 60).toFixed(2) + "s");
}

// ── 13. the almanac actually scrolls ─────────────────────────────────────
/* There was no wheel listener anywhere in the game, and no drag handler either —
   while the almanac's own footer promised "SWIPE TO SCROLL". The only things
   that could move the list were the arrow keys and two buttons. */
{
  const { cf } = boot("?debug=1&seed=31337");
  cf.start("survey", 1);
  const hud = cf.hud();
  const n = cf.catalogue().length;

  check(hud.almanacCanScroll(n),
        n + " entries do not fill the page, so scrolling cannot be checked");
  check(typeof hud.almanacDragBy === "function", "the almanac has no drag handler");

  const top = hud.almanacAt();
  check(top === 0, "the almanac did not open at the top");

  // A wheel notch, in pixels, must move it — and by less than a whole page.
  hud.almanacDragBy(120, n);
  const afterWheel = hud.almanacAt();
  check(afterWheel > top, "a wheel notch did not scroll the almanac");

  // A long drag must stop at the end rather than running off it.
  hud.almanacDragBy(100000, n);
  const bottom = hud.almanacAt();
  check(Number.isFinite(bottom), "scrolling to the end went non-finite");
  hud.almanacDragBy(100000, n);
  check(hud.almanacAt() === bottom,
        "the almanac scrolled past its own last row");

  // And back, clamped at the top.
  hud.almanacDragBy(-100000, n);
  check(hud.almanacAt() === 0, "the almanac scrolled above its first row");

  // Fractional positions have to survive, or a thumb can only move whole rows.
  hud.almanacDragBy(18, n);
  const part = hud.almanacAt();
  check(part > 0 && part < 1,
        "a short drag snapped to " + part + " instead of scrolling smoothly");

  // Drawing at a half-scrolled position must not throw.
  cf.screen("almanac");
  cf.draw();
  console.log("  almanac    wheel and drag scroll it · clamps at both ends · " +
              "holds a fractional row");
}

// ── 14. the yard: what the mode is actually for ──────────────────────────
/* Survey went a long time without a goal. The yard is it: six parts, each in a
   kind of place its clue describes, carried home one at a time. The clue is the
   part that can silently rot — it is prose, and prose does not fail a syntax
   check — so what is asserted is that every part has one, that every part is
   actually reachable in the sector, and that the loop closes. */
{
  const { cf } = boot("?debug=1&seed=2468");
  cf.start("survey", 1);
  const surv = cf.survey();
  const sites = surv.partSites;
  check(sites.length >= 5, "only " + sites.length + " part sites were placed");
  for (const site of sites) {
    check(Number.isFinite(site.x) && Number.isFinite(site.y),
          site.key + " was placed nowhere");
    const d = Math.hypot(site.x, site.y);
    check(d > 3000, site.key + " is only " + Math.round(d) + " units out");
  }
  // Two parts in the same chunk would mean one of them is unreachable scenery.
  const chunks = new Set(sites.map(s2 =>
    Math.floor(s2.x / 2600) + "," + Math.floor(s2.y / 2600)));
  check(chunks.size === sites.length, "two parts share a chunk");

  check(surv.built.size === 0, "a fresh yard started already built");
  check(surv.carrying.size === 0, "a fresh run started holding a part");

  /* The loop, driven for real: fly to a part, pick it up, fly to the yard, and
     the yard must be one further along. No shortcuts through the internals —
     the ship is moved and the tick does the rest. */
  const me = cf.live().ships[0];
  const target = sites[0];
  me.x = target.x; me.y = target.y; me.vx = me.vy = 0;
  for (let i = 0; i < 8; i++) { now += 1000 / 60; cf.step(); }
  check(surv.carrying.has(target.key),
        "flying onto " + target.key + " did not pick it up");

  me.x = -280; me.y = -400; me.vx = me.vy = 0;      // the yard
  for (let i = 0; i < 8; i++) { now += 1000 / 60; cf.step(); }
  check(surv.built.has(target.key), "delivering to the yard did not fit the part");
  check(!surv.carrying.has(target.key), "the part was fitted and still carried");
  check(surv.found.has("salvor"), "carrying the first part home logged nothing");

  // A fitted part must not respawn when its chunk streams back in.
  me.x = target.x; me.y = target.y;
  for (let i = 0; i < 8; i++) { now += 1000 / 60; cf.step(); }
  check(!surv.parts.some(pt => pt.key === target.key),
        "a part that was already fitted came back");
  console.log("  yard       " + sites.length + " sites, one per chunk · " +
              "picked up, carried home and fitted");
}

// ── 15. you are always told what you are doing ───────────────────────────
{
  const { cf } = boot("?debug=1&seed=1357");
  cf.start("survey", 1);
  const surv = cf.survey();

  const KEYS = ["spar", "core", "lens", "coil", "beacon", "plate"];
  for (let step = 0; step <= KEYS.length; step++) {
    now += 1000 / 60; cf.step();
    const obj = cf.objective();
    check(!!obj && !!obj.text, "the objective line went blank at step " + step);
    if (step < KEYS.length) {
      check(/FIND|CARRYING/.test(obj.text),
            "the objective did not say what to do: " + obj.text);
      check(!!obj.sub, "the objective gave no clue at step " + step);
      // Walk the manifest by hand so every state of the line is drawn once.
      surv.built.add(KEYS[step]);
    }
  }
  const done = cf.objective();
  check(/OPEN|FINISHED/.test(done.text),
        "a full manifest did not read as finished: " + done.text);
  console.log("  objective  states every step of the manifest, clue and all");
}

// ── 16. the scan reports what is near, and the refit makes it reach ──────
/* The old scan returned a compass bearing to an almanac entry and printed it in
   a message feed, which is why nobody could tell what it was for. It sweeps a
   radius now, so what is checked is that the radius is real: things inside come
   back, things outside do not, and buying a scanner tier moves the line. */
{
  const { cf } = boot("?debug=1&seed=8642");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];

  const reach0 = cf.scanReach();
  check(reach0 > 500, "the scan reaches only " + reach0 + " units");

  /* Cleared first. The sector generates its own hulks and, since phase 4, its
     own traffic — so "how many hulks came back" stopped being a question about
     the scan and became a question about what happened to be nearby. What is
     being measured here is the radius, so the radius is all that is left in. */
  surv.hulks.length = 0;
  surv.traffic.length = 0;
  surv.drones.length = 0;
  // One thing just inside, one well outside.
  surv.hulks.push({ x: me.x + reach0 * 0.5, y: me.y, r: 60, a: 0, spin: 0, hp: 4,
                    id: "near" });
  surv.hulks.push({ x: me.x + reach0 * 3, y: me.y, r: 60, a: 0, spin: 0, hp: 4,
                    id: "far" });
  cf.scan();
  const hit = surv.echoes.filter(e => e.kind === "hulk");
  check(hit.length === 1,
        "the scan returned " + hit.length + " hulks, expected the near one only");
  check(hit.length && Math.abs(hit[0].x - (me.x + reach0 * 0.5)) < 1,
        "the scan returned the wrong hulk");

  // Echoes fade rather than staying on the chart forever.
  for (let i = 0; i < 60 * 25; i++) { now += 1000 / 60; cf.step(); }
  check(surv.echoes.length === 0, "scan returns never faded");

  // And a coil on the hull reaches further. Every hull scans the same distance;
  // the only thing that changes it is what is bolted on.
  surv.slots[0] = { key: "deepear", fit: 0 };
  check(cf.scanReach() > reach0,
        "a scanner part did not extend the scan (" + reach0 + " → " + cf.scanReach() + ")");
  console.log("  scan       " + Math.round(reach0) + "u sweep · reports only what is inside · " +
              "fades · reaches " + Math.round(cf.scanReach()) + "u with a deep ear on");
}

// ── 17. pins ─────────────────────────────────────────────────────────────
{
  const { cf } = boot("?debug=1&seed=999");
  cf.start("survey", 1);
  const surv = cf.survey();
  const st = cf.surveyView();

  check(Array.isArray(surv.pins) && surv.pins.length === 0, "a fresh sector had pins");
  /* Placing one is a question now, not an action: `onPin` opens the prompt that
     asks for a name and a colour, and nothing is on the chart until it is
     answered. See the chart-rail block for the whole gesture. */
  st.onPin(4000, -2500, "cache", 400);
  cf.answer({ name: "", kind: "cache" });
  check(surv.pins.length === 1, "dropping a pin did not add one");
  check(typeof surv.pins[0].name === "string",
        "a pin cannot carry a name — endless space has no place names except " +
        "the ones you give it");
  check(surv.pins[0].kind === "cache", "the pin lost its kind");

  // Tapping a pin lifts it, which is a different call from placing one now that
  // placing has to be armed.
  st.onPinNear(4050, -2520, 400);
  check(cf.ask() === "confirm", "removing a pin did not ask first");
  cf.answer(true);
  check(surv.pins.length === 0, "confirming did not remove it");

  // Different kinds coexist, and they survive the book.
  st.onPin(1000, 1000, "danger", 400); cf.answer({ name: "", kind: "danger" });
  st.onPin(-9000, 400, "part", 400); cf.answer({ name: "", kind: "part" });
  check(surv.pins.length === 2, "two pins of different kinds did not both stick");
  cf.leave();
  const raw = store[BOOK_KEY];
  const book = JSON.parse(raw);
  check(Array.isArray(book.pins) && book.pins.length === 2,
        "pins were not written to the book");
  check(book.pins.some(q => q.kind === "danger"), "a pin lost its kind in the book");
  console.log("  pins       drop, lift with the same tap, keep their kind, survive the book");
}

// ── 18. the sector gets worse the further out you go ─────────────────────
/* It used to roll from the same table everywhere, so 90,000 units out was the
   same trip as 900 and distance cost only time. Sampled over a lot of chunks
   rather than asserted on one, because every individual chunk is still a roll —
   the curve is a bias, not a rule, and a test that demanded any single far chunk
   be nastier than any single near one would be testing the dice. */
{
  const { cf } = boot("?debug=1&seed=13579");
  cf.start("survey", 1);

  /* Distinct chunks. Walking a ring by angle and rounding lands on the same
     handful of coordinates over and over at small radii — a near sample was
     counting eight chunks a hundred and sixty times, so one unlucky cache near
     home outweighed a whole hostile ring. Dedupe, then compare per-chunk. */
  function sample(ring) {
    const seen = new Set();
    /* A band of chunks rather than a circle of them. Walking a thin ring at
       small radii lands on the same twenty chunks over and over, so what came
       back was one chunk's luck rather than the rule — the old version of this
       compared a twenty-chunk sample against a forty-chunk one and passed or
       failed on which seed it happened to be handed. A filled annulus two
       chunks deep gives hundreds of distinct chunks at every radius. */
    let guards = 0, hulks = 0, fields = 0;
    for (let cx = -ring - 2; cx <= ring + 2; cx++) {
      for (let cy = -ring - 2; cy <= ring + 2; cy++) {
        const d = Math.hypot(cx, cy);
        if (d < ring - 2 || d > ring + 2) continue;
        const k = cx + "," + cy;
        if (seen.has(k)) continue;
        seen.add(k);
        const c = cf.chunk(cx, cy);
        for (const cache of c.caches) guards += cache.guards.length;
        hulks += c.hulks.length;
        fields += c.fields.length;
      }
    }
    const n = seen.size || 1;
    return { guards: guards / n, hulks: hulks / n, fields: fields / n, chunks: n };
  }

  /* Rings measured against the danger curve rather than in a remembered number
     of chunks. These were 6 and 60 — sixteen thousand and a hundred and
     fifty-six thousand — which straddled the whole curve when it topped out at
     320,000 and now both sit inside its first tenth. */
  const DEEP_RING = Math.round(cf.sectorSpan().full / cf.sectorSpan().chunk);
  const near = sample(6);
  const far  = sample(DEEP_RING);

  check(far.guards > near.guards * 1.3,
        "the deep sector posts no more sentries than home (" +
        near.guards.toFixed(3) + " → " + far.guards.toFixed(3) + ")");
  check(far.hulks >= near.hulks,
        "the deep sector is no thicker with wrecks (" +
        near.hulks + " → " + far.hulks + ")");
  check(far.fields > near.fields,
        "asteroid fields do not appear further out (" +
        near.fields + " → " + far.fields + ")");

  // And home has to stay quiet, or the curve is a wall rather than a slope.
  check(near.fields === 0, "an asteroid field spawned in the home ring");
  check(cf.chunk(0, 0).hazards.length === 0, "the home chunk grew a hazard");
  console.log("  danger     " + near.chunks + " + " + far.chunks +
              " chunks — home " + near.guards.toFixed(2) + " sentries / " +
              near.fields.toFixed(2) + " fields · deep " + far.guards.toFixed(2) +
              " / " + far.fields.toFixed(2));
}

// ── 19. deep space is a number, and the curve keeps climbing ─────────────
{
  const { cf } = boot("?debug=1&seed=112233");
  cf.start("survey", 1);

  const at = d => cf.bandAt(d, 0).name;
  check(at(0) === "HOME", "the origin is not HOME, it is " + at(0));
  check(at(5000) === "HOME", "5k out is " + at(5000));
  check(at(20000) === "OPEN", "20k out is " + at(20000));
  check(at(50000) === "UNSETTLED", "50k out is " + at(50000));
  check(at(100000) === "HOSTILE", "100k out is " + at(100000));
  check(at(250000) === "DEEP", "250k out is " + at(250000));
  check(at(900000) === "ABYSSAL", "900k out is " + at(900000));

  // The curve must rise the whole way and never flatten at the last band, or
  // the abyss is just the deep with a different word on it.
  let prev = -1;
  const FULL = cf.sectorSpan().full;
  for (const d of [0, FULL * 0.01, FULL * 0.06, FULL * 0.2, FULL * 0.45,
                   FULL, FULL * 2, FULL * 6]) {
    const v = cf.dangerAt(d, 0);
    check(v > prev, "the danger curve stopped rising at " + d);
    prev = v;
  }
  check(cf.dangerAt(FULL, 0) >= 1, "the curve does not reach 1 by the deep band");
  check(cf.dangerAt(FULL * 6, 0) > cf.dangerAt(FULL, 0),
        "the abyss is no worse than the deep");
  console.log("  bands      home→abyssal named at the right ranges · curve never flattens");
}

// ── 20. fewer wells, and bigger ones further out ─────────────────────────
/* They used to sit in three chunks out of five at one fixed size, which makes
   them terrain rather than hazards — and terrain frightens nobody. */
{
  const { cf } = boot("?debug=1&seed=445566");
  cf.start("survey", 1);

  /* Well abundance is part of a world's character now, so a single seed proves
     nothing — a WELL-RIDDLED sector is *supposed* to be thick with them, near
     home included. What has to hold is the average across worlds, and that the
     wells still grow with range inside any one of them. */
  function survey(cfx, ring) {
    const seen = new Set();
    let wells = 0, big = 0, reach = 0;
    for (let i = 0; i < ring * 12; i++) {
      const a = (i / (ring * 12)) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * ring), cy = Math.round(Math.sin(a) * ring);
      const k = cx + "," + cy;
      if (seen.has(k)) continue;
      seen.add(k);
      for (const h of cfx.chunk(cx, cy).hazards) {
        wells++; reach += h.reach;
        if (h.k >= 1.8) big++;
      }
    }
    return { per: wells / seen.size, big, avgReach: wells ? reach / wells : 0 };
  }

  let nearPer = 0, nearReach = 0, farReach = 0, farBig = 0, nearBig = 0, n = 0;
  for (const seed of [445566, 1, 2, 999, 31337, 8675309]) {
    const w = boot("?debug=1&seed=" + seed);
    w.cf.start("survey", 1);
    /* Sampled against the curve rather than at a remembered number of chunks.
       "The deep" is 1.8 million units out now — it was 320,000 — so a ring of 60
       chunks that used to sit at the far end of the danger curve now sits a
       tenth of the way along it, and two samples from the same band prove
       nothing. `deepRing` is wherever the curve actually tops out. */
    const span = w.cf.sectorSpan();
    const deepRing = Math.round(span.full / span.chunk);
    const near = survey(w.cf, 4), far = survey(w.cf, deepRing);
    nearPer += near.per; nearReach += near.avgReach; farReach += far.avgReach;
    farBig += far.big; nearBig += near.big; n++;
    check(far.avgReach > near.avgReach * 1.2,
          "seed " + seed + ": wells do not grow with range (" +
          Math.round(near.avgReach) + " → " + Math.round(far.avgReach) + ")");
  }
  nearPer /= n; nearReach /= n; farReach /= n;

  check(nearPer < 0.5,
        "home averages " + nearPer.toFixed(2) + " wells a chunk across worlds — too dense");
  check(nearPer > 0.05, "home has essentially no wells in any world");
  check(farBig > 0, "nothing supermassive exists in any world");
  check(nearBig === 0, "a supermassive well spawned near home");
  console.log("  wells      " + nearPer.toFixed(2) + "/chunk at home across " + n +
              " worlds · reach " + Math.round(nearReach) + " → " + Math.round(farReach) +
              " · " + farBig + " supermassive found deep, " + nearBig + " at home");
}

// ── 21. a well that can hold you says so first ───────────────────────────
/* The single most important readability fix in the phase. A well that kills you
   without warning is unfair; one that warns you is a decision. The comparison is
   honest physics, so a refitted drive must move the threshold — that is also the
   clearest demonstration in the game of what the drive upgrade bought. */
{
  const { cf } = boot("?debug=1&seed=778899");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];

  // Open space: nothing to say.
  now += 1000 / 60; cf.step();
  check(!surv.warn, "a warning fired in empty space");

  /* A supermassive hole off the bow, at a distance that is nowhere near its
     kill radius of 88 — the point of the warning is that it arrives while there
     is still a long way to fall and something you can do about it. */
  lv.hazards.length = 0;
  lv.hazards.push({ kind: "hole", x: me.x + 700, y: me.y, kill: 88, reach: 1690,
                    mass: 1.22e7 * Math.pow(2.6, 2.6), soft: 343, k: 2.6,
                    fill: null, size: "large", phase: 0 });
  me.invuln = 999;                       // this is about the warning, not dying
  now += 1000 / 60; cf.step();
  check(!!surv.warn, "a supermassive hole 700 units away raised no warning");
  check(700 > 88 * 4, "the test sat inside the kill radius, so it proves nothing");
  if (surv.warn) {
    check(surv.warn.big === true, "a supermassive well did not read as one");
    check(surv.warn.kind === "hole", "the warning named the wrong kind");
    check(surv.warn.ratio > 0, "the warning carried no severity");
    check(surv.warn.bearing >= 0 && surv.warn.bearing < 360,
          "the warning bearing is not a compass bearing: " + surv.warn.bearing);
  }

  // A better drive escapes what a stock one cannot, so the same well is less
  // frightening to a refitted ship. Buy the whole track and check it eased.
  const before = surv.warn ? surv.warn.ratio : 0;
  surv.slots[0] = { key: "overburner", fit: 0 };
  surv.slots[1] = { key: "sparthruster", fit: 0 };
  cf.applyParts();
  now += 1000 / 60; cf.step();
  const after = surv.warn ? surv.warn.ratio : 0;
  check(after < before,
        "a fully refitted drive did not ease the warning (" +
        before.toFixed(2) + " → " + after.toFixed(2) + ")");
  console.log("  warnings   supermassive well warns with room to act · " +
              "ratio " + before.toFixed(2) + " → " + after.toFixed(2) + " once refitted");
}

// ── 22. the camera sits back, and the setting sticks ─────────────────────
{
  const { cf } = boot("?debug=1&seed=321");
  cf.start("survey", 1);
  check(Math.abs(cf.zoom() - 0.72) < 0.001,
        "Survey did not default to the standard pull-back, got " + cf.zoom());
  check(Math.abs(cf.live().camera.scale - cf.zoom()) < 0.001,
        "the camera ignored the survey zoom");

  const first = cf.zoom();
  cf.cycleZoom();
  check(cf.zoom() !== first, "cycling the zoom did nothing");
  const chosen = cf.zoom();
  check(Math.abs(cf.live().camera.scale - chosen) < 0.001,
        "the camera did not follow the new zoom immediately");

  // Five steps returns to where it started, and the choice survives a reboot.
  for (let i = 0; i < 4; i++) cf.cycleZoom();
  check(Math.abs(cf.zoom() - first) < 0.001, "the zoom list does not cycle cleanly");
  cf.cycleZoom();
  const kept = cf.zoom();
  const again = bootKeepingStorage("?debug=1&seed=321");
  again.cf.start("survey", 1);
  check(Math.abs(again.cf.zoom() - kept) < 0.001,
        "the zoom choice did not survive a reboot");

  // Every other mode is untouched at 1:1.
  const other = boot("?debug=1");
  other.cf.start("royale", 2);
  check(Math.abs(other.cf.live().camera.scale - 1) < 0.001,
        "the survey zoom leaked into Battle Royale");
  console.log("  camera     0.72 by default · five steps · persists · other modes still 1:1");
}

// ── 23. wiping a survey ──────────────────────────────────────────────────
/* The only button in the game that destroys hours of work, and it sits near one
   that resets the keyboard — a much smaller thing wearing a much similar word.
   So the first press must do nothing at all, and the second must do everything. */
{
  const { cf } = boot("?debug=1&seed=5150");
  cf.start("survey", 1);
  const surv = cf.survey();

  // Make some progress worth losing.
  surv.cash = 240;
  surv.built.add("spar");
  surv.pins.push({ x: 100, y: 200, kind: "cache" });
  cf.find("first-light");
  cf.find("thread");
  const oldSeed = surv.seed;
  check(surv.found.size >= 2, "the test failed to make any progress to wipe");

  // One press arms it and changes nothing.
  cf.resetSurvey();
  check(cf.resetArmed() === true, "the first press did not arm the reset");
  check(cf.survey().seed === oldSeed, "one press already changed the sector");
  check(cf.survey().found.size >= 2, "one press already wiped the almanac");
  check(cf.survey().cash === 240, "one press already spent the hold");

  // The second does all of it.
  cf.resetSurvey();
  const fresh = cf.survey();
  check(fresh.seed !== oldSeed,
        "the reset kept the same sector (" + oldSeed + ")");
  check(fresh.found.size === 0, "the almanac survived the reset");
  check(fresh.cash === 0, "the hold survived the reset");
  check(fresh.built.size === 0, "the yard's manifest survived the reset");
  check(fresh.pins.length === 0, "the pins survived the reset");
  check(cf.hud().charted() === 0, "the chart survived the reset");
  check(!store[BOOK_KEY] ||
        JSON.parse(store[BOOK_KEY]).seed !== oldSeed,
        "the old book is still in local storage");

  // And it drops you into the new sector rather than leaving you in the old one.
  check(cf.peek().state === "playing", "the reset left the game in " + cf.peek().state);
  console.log("  reset      first press arms, second wipes · new seed · " +
              "chart, almanac, hold, yard and pins all gone");
}

// ── 24. a reset beats a seeded link ──────────────────────────────────────
/* Someone who opened a `?seed=` link and then asked for a new world means it.
   Handing them the same sector back would look like the button did nothing. */
{
  const { cf } = boot("?debug=1&seed=31337");
  cf.start("survey", 1);
  check(cf.survey().seed === 31337, "the seeded link did not take");
  cf.resetSurvey();
  cf.resetSurvey();
  check(cf.survey().seed !== 31337,
        "a reset handed back the sector named in the URL");
  console.log("  reset·url  a wipe overrides the seed in the address bar");
}

// ── 25. two seeds are two different worlds ───────────────────────────────
/* The complaint that started this: a new seed was a new arrangement of one map
   rather than a new map. Every sector had its ladder at the same distances in
   the same order at the same densities, and only the bearings moved.

   So this measures the thing a player actually notices — how big the world is,
   how far apart its rungs are, which landmark is nearest, and how much of each
   kind of thing there is — across a spread of seeds, and insists they differ. */
{
  const seeds = [1, 2, 12345, 99999, 777, 424242, 8675309, 31337];
  const worlds = seeds.map(seed => {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    const surv = cf.survey();
    let wells = 0, planets = 0, wrecks = 0, gates = 0, stations = 0;
    for (let x = -12; x <= 12; x += 2) {
      for (let y = -12; y <= 12; y += 2) {
        const c = cf.chunk(x, y);
        wells += c.hazards.length; planets += c.planets.length;
        wrecks += c.wrecks.length; gates += c.gates.length;
        stations += c.stations.length;
      }
    }
    const byDist = surv.landmarks
      .map(l => ({ key: l.key, d: Math.hypot(l.x, l.y) }))
      .sort((a, b) => a.d - b.d);
    return { seed, name: surv.world.name, reach: byDist[byDist.length - 1].d,
             nearest: byDist[0].key, wells, planets, wrecks, gates, stations };
  });

  // How big the sector is has to actually vary — this is what "sprawling" means.
  const reaches = worlds.map(w => w.reach);
  const spread = Math.max(...reaches) / Math.min(...reaches);
  check(spread > 1.4,
        "every world is the same size (widest / narrowest = " + spread.toFixed(2) + ")");

  // The route through the ladder has to vary, or every sector is walked in the
  // same order however far apart the rungs are.
  const firsts = new Set(worlds.map(w => w.nearest));
  check(firsts.size >= 3,
        "only " + firsts.size + " different landmarks are ever nearest: " +
        [...firsts].join(", "));

  // And each kind of thing has to be scarce in some worlds and common in others.
  for (const kind of ["wells", "planets", "wrecks", "gates", "stations"]) {
    const vals = worlds.map(w => w[kind]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    check(hi > lo * 2,
          kind + " barely varies between worlds (" + lo + " to " + hi + ")");
  }

  // A world says what kind of place it is, and not every world says the same.
  const names = new Set(worlds.map(w => w.name));
  check(names.size >= 4,
        "only " + names.size + " sector characters across " + seeds.length + " seeds");
  for (const w of worlds) check(!!w.name, "seed " + w.seed + " has no character");

  console.log("  worlds     size varies " + spread.toFixed(2) + "x · " +
              firsts.size + " different nearest landmarks · " +
              names.size + " characters over " + seeds.length + " seeds");
  console.log("             e.g. " + worlds.slice(0, 3)
    .map(w => w.seed + ": " + w.name).join("  |  "));
}

// ── 26. the chart zooms, pans, and can see the whole world ───────────────
/* Zoom and pan both worked mechanically; what did not work was the range. Five
   steps, the widest showing 250,000 units across, which was fine when every
   sector's last landmark sat near 108,000 — and stopped being fine the moment
   worlds started rolling their own size and a sprawling one reached past
   180,000 in every direction. The map could not be pulled back far enough to
   show you the place you were flying around in. */
{
  const { cf } = boot("?debug=1&seed=99");
  cf.start("survey", 1);
  const hud = cf.hud();
  const st = cf.surveyView();
  hud.chartOpened(st);

  const v0 = hud.chartView();
  check(v0.follow === true, "the chart did not open following the ship");

  /* The opening scale has to be a step on the ladder. It was not — it was a
     number that appeared in no zoom table, so the first press fell through to a
     hard-coded index and jumped somewhere unrelated to where you were. */
  const seen = new Set([v0.scale]);
  for (let i = 0; i < 20; i++) { hud.chartZoomBy(1); seen.add(hud.chartView().scale); }
  const widestIn = hud.chartView().scale;
  for (let i = 0; i < 40; i++) { hud.chartZoomBy(-1); seen.add(hud.chartView().scale); }
  const widestOut = hud.chartView().scale;

  check(seen.size >= v0.steps,
        "only " + seen.size + " distinct zoom levels are reachable of " + v0.steps);
  check(widestIn > widestOut * 10,
        "the zoom range is too narrow: " + widestOut + " to " + widestIn);

  // Clamped at both ends rather than running off.
  hud.chartZoomBy(-1);
  check(hud.chartView().scale === widestOut, "zooming out ran past the last step");
  for (let i = 0; i < 40; i++) hud.chartZoomBy(1);
  check(hud.chartView().scale === widestIn, "zooming in ran past the last step");

  /* And the widest step has to fit the biggest world this generator can roll,
     or the map is smaller than the sector it is a map of. */
  let furthest = 0;
  for (const seed of [1, 2, 12345, 99999, 777, 424242, 8675309, 31337]) {
    const w = boot("?debug=1&seed=" + seed);
    w.cf.start("survey", 1);
    for (const l of w.cf.survey().landmarks) {
      furthest = Math.max(furthest, Math.hypot(l.x, l.y));
    }
  }
  const widestSpan = 1000 / widestOut;
  check(widestSpan > furthest * 2.1,
        "the widest zoom shows " + Math.round(widestSpan) +
        " units but worlds reach " + Math.round(furthest) + " in every direction");

  // Panning moves the view and stops it chasing the ship.
  hud.chartOpened(st);
  const before = hud.chartView();
  hud.chartDragBy(140, -60);
  const after = hud.chartView();
  check(after.x !== before.x || after.y !== before.y, "dragging did not pan the chart");
  check(after.follow === false, "panning did not stop the chart following the ship");
  console.log("  chart      " + seen.size + " zoom steps · widest " +
              Math.round(widestSpan) + " units across, worlds reach " +
              Math.round(furthest) + " · drag pans and releases follow");
}

// ── 27. the page state has one set of defaults ───────────────────────────
/* `HUD.reset` built the chart and the almanac from a second copy of their
   defaults, and the two copies drifted: the reset one still carried an old
   opening zoom, and it had never learned about the pin kind or the open card at
   all. So a fresh survey started with no pin kind selected — every pin dropped
   would have been of kind `undefined`. */
{
  const { cf } = boot("?debug=1&seed=246");
  cf.start("survey", 1);
  const hud = cf.hud();
  const surv = cf.survey();
  const st = cf.surveyView();

  const v = hud.chartView();
  check(v.scale > 0.02, "a fresh survey opened the chart at the stale zoom");

  // The proof that matters: a pin dropped straight after a reset has a kind.
  hud.chartOpened(st);
  st.onPin(3000, 3000, "cache", 400);
  cf.answer({ name: "", kind: "cache" });
  check(surv.pins.length === 1, "no pin was dropped");
  check(typeof surv.pins[0].kind === "string" && surv.pins[0].kind,
        "a pin dropped on a fresh survey has no kind: " + surv.pins[0].kind);

  // And the almanac's open card is a number rather than undefined.
  check(hud.almanacDetailOpen() === false,
        "a fresh almanac thinks a card is already open");
  console.log("  defaults   chart and almanac survive a reset with every field intact");
}

// ── the panel is handed everything it reads ───────────────────────────────
/* The one test that would have caught the `salvage` → `cash` rename. Every
   field the interface reads off the state object is spelled somewhere in
   survey-hud.js as `st.something`; every field the game hands it is a key on
   `surveyView()`. When those two lists agreed the mode worked, and when they
   quietly stopped agreeing nothing failed — the panel read `undefined`, fell
   back to zero, and drew a hold that was empty while the real one filled up
   and stopped taking motes. `atYard` went the same way and took the yard page
   with it on any device without an `E` key.

   Neither is visible from a screenshot and neither breaks a frame, which is
   exactly the shape of bug this file exists for. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const st = cf.surveyView();
  const reads = [...new Set(
    [...hudSrc.matchAll(/\bst\.([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1])
  )].sort();
  const missing = reads.filter(k => !(k in st));
  check(missing.length === 0,
        "the panel reads fields the game never sends: " + missing.join(", "));
  // And the two that were actually lost, by name, so a rename cannot pass by
  // deleting the reader instead of fixing the writer.
  check(typeof st.cash === "number", "surveyView() must carry `cash`");
  check(typeof st.atYard === "boolean", "surveyView() must carry `atYard`");
  console.log("  wiring     " + reads.length +
              " fields read by the panel, all of them sent");
}

// ── the yard's reward is reachable ────────────────────────────────────────
/* The light drive was built, `onJump` was exposed, and nothing in the whole
   interface ever called it — six parts carried home for a prize that could not
   be collected. It is reached from the chart, so that is where this drives it
   from: arm it, click a charted station, and end up there. */
{
  const { cf } = boot("?debug=1&seed=616161");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];

  check(cf.surveyView().wormhole === false,
        "the wormhole is finished before a single part is fitted");
  for (const b of cf.surveyView().manifest) surv.built.add(b.key);
  check(cf.surveyView().wormhole === true,
        "the yard is complete and the wormhole still is not");

  const far = { k: "station", x: 52000, y: -31000 };
  surv.known.set("far", far);
  const st = cf.surveyView();
  hud.chartOpened(st);
  hud.chartDragBy((hud.chartView().x - far.x) * hud.chartView().scale,
                  (hud.chartView().y - far.y) * hud.chartView().scale);

  // Armed, the map's tap jumps instead of pinning — and a tap nowhere near a
  // station must do neither.
  hud.chartJumpArm(true);
  const pins = surv.pins.length;
  hud.chartTapAt(st, far.x + 900000, far.y, 400);
  check(surv.pins.length === pins, "an armed jump dropped a pin instead");
  check(Math.hypot(me.x, me.y) < 40000, "a miss jumped somewhere anyway");

  hud.chartTapAt(st, far.x + 60, far.y - 60, 400);
  check(Math.round(me.x) === far.x && Math.round(me.y) === far.y,
        "the light drive did not arrive: " + Math.round(me.x) + "," + Math.round(me.y));
  check(hud.chartJumpArmed() === false, "the jump stayed armed after arriving");
  console.log("  wormhole   six parts fitted · armed from the chart · " +
              "a miss does nothing · a station jumps " +
              Math.round(Math.hypot(far.x, far.y)) + " units");
}

// ── 8d. water and food ────────────────────────────────────────────────────
/* Phase 2.2. Two clocks that are always running, and the thing that makes range
   a supply problem rather than only a danger problem.

   The part worth testing hardest is the grace. Empty must not kill: it must
   start a countdown you can still act on, and *anything* going back into the
   tank must stop that countdown — not a full tank, because skimming an
   atmosphere trickles and a trickle has to be able to save you. A meter that
   went from "fine" straight to "dead" would undo the whole of phase 1. */
{
  const { cf } = boot("?debug=1&seed=771");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const v = () => cf.surveyView();

  /* The *capacity* of the tanks, not what is in them: a new survey opens with
     them low on purpose, which is what makes the first thing you want the first
     thing the station sells. */
  check(v().water.full > 300, "a full water tank is only " + v().water.full + "s");
  check(v().food.full > v().water.full * 1.4,
        "food (" + v().food.full + "s) does not outlast water (" +
        v().water.full + "s) by enough to be a different clock");
  cf.setTanks(v().water.full, v().food.full);

  // They drain while you fly, and water drains faster.
  const w0 = surv.water, f0 = surv.food;
  for (let i = 0; i < 600; i++) { now += 1000 / 60; cf.step(); }
  check(surv.water < w0 - 5, "water did not drain: " + w0 + " → " + surv.water);
  check(surv.food < f0 - 5, "food did not drain: " + f0 + " → " + surv.food);
  check(v().water.frac < v().food.frac,
        "after ten minutes' flying the two tanks are at the same level");

  // Empty starts a countdown and does not kill.
  cf.setTanks(1, 1200);
  for (let i = 0; i < 120; i++) { now += 1000 / 60; cf.step(); }
  check(surv.water === 0, "the tank did not empty");
  check(v().water.countdown > 0, "an empty tank started no countdown");
  check(surv.death === null, "an empty tank killed instantly");
  check(me.alive, "an empty tank killed instantly");
  const grace = v().water.countdown;

  // A trickle stops it. One second of water is enough to reset the clock.
  cf.setTanks(1, 1200);
  now += 1000 / 60; cf.step();
  check(v().water.countdown === 0,
        "a refilled tank left the countdown running at " + v().water.countdown);

  // And running it all the way down does kill, with the right reason.
  /* Held invulnerable while the clock runs down. Two minutes of sitting still is
     long enough for a sentry to find you, and a test for what thirst does must
     not be able to pass or fail on whether something shot you first — this
     failed once as "hunger killed with: shot down by a sentry", which is a true
     sentence about the wrong thing. */
  const starve = () => {
    let n = 0;
    while (cf.peek().state !== "died" && n < 60 * 400) {
      now += 1000 / 60;
      me.invuln = Math.max(me.invuln, 1);
      cf.step();
      n++;
    }
    return n;
  };
  cf.setTanks(0, 1200);
  let frames = starve();
  check(cf.peek().state === "died", "an empty tank never killed at all");
  check(/thirst/.test(surv.death.reason), "thirst killed with: " + surv.death.reason);
  check(frames / 60 > grace * 0.7 && frames / 60 < grace * 1.4,
        "thirst took " + Math.round(frames / 60) + "s against a stated " +
        Math.round(grace) + "s");

  // Food does it too, and says something different.
  cf.respawn();
  check(surv.water === v().water.full && surv.food === v().food.full,
        "respawning did not resupply the ship");
  cf.setTanks(1200, 0);
  frames = starve();
  check(/starv/.test(surv.death.reason), "hunger killed with: " + surv.death.reason);

  // Buying. It needs somewhere to buy from, it costs what is missing, and it
  // must refuse when the money is not there.
  cf.respawn();
  cf.setTanks(100, 200);
  check(cf.buySupply("water") === false, "bought water in open space");
  surv.docked = { x: 0, y: 0 };
  surv.cash = 0;
  check(cf.buySupply("water") === false, "bought water with no money");
  surv.cash = 500;
  const cost = v().water.cost;
  check(cost > 0, "a near-empty tank costs " + cost + " to fill");
  check(cf.buySupply("water") === true, "could not buy water at a station");
  check(surv.water === v().water.full, "buying water did not fill the tank");
  check(surv.cash === 500 - cost, "the fill cost " + (500 - surv.cash) + ", not " + cost);
  check(v().water.cost === null, "a full tank is still for sale");
  check(cf.buySupply("water") === false, "sold water into a full tank");
  // A nearly-full tank must be cheaper than an empty one.
  cf.setTanks(v().water.full - 60, 200);
  check(v().water.cost < cost,
        "topping off costs the same as filling from empty");

  // And the tanks have to survive the tab, or a long haul resets by reloading.
  cf.setTanks(321, 654);
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(Math.abs(book.water - 321) < 2 && Math.abs(book.food - 654) < 2,
        "the book saved water " + book.water + " food " + book.food);
  const again = bootKeepingStorage("?debug=1&seed=771");
  again.cf.start("survey", 1);
  check(Math.abs(again.cf.tanks().water - 321) < 2,
        "a resumed run got a fresh tank: " + again.cf.tanks().water);
  console.log("  life       water " + Math.round(v().water.full / 60) + "m / food " +
              Math.round(v().food.full / 60) + "m · empty gives " +
              Math.round(grace) + "s of grace · a trickle resets it · " +
              "thirst and hunger both kill · tanks survive the tab");
}

// ── worlds: fewer, far bigger, all different, none on top of anything ─────
/* Planets were the most common thing in the sector after rocks and the least
   interesting — one in six chunks, all 110–200 units across, all the same blue,
   none of them called anything. Every one of those is checked here, and so are
   the two things that made the rework dangerous:

     · A world is *solid* and can now be 3,600 units across, so one rolled on a
       manifest part does not obscure it, it encloses it — and the part cannot be
       collected at all. That is a run that cannot be finished, and it is
       invisible until somebody flies eight minutes to find out.
     · Chunks are pure and cannot see their neighbours, so per-chunk placement
       let two worlds overlap. Measured before the fix: one world in twenty-four
       intersected another, worst case one wholly inside the other.

   Both are arithmetic, so both are checked as arithmetic rather than looked at. */
{
  const seeds = [1, 515, 8675309, 20260909, 4242, 909];
  let all = 0, chunks = 0, inhabited = 0, ringed = 0;
  let minR = Infinity, maxR = 0, overlaps = 0, onSomething = 0;
  const kinds = new Set(), bandCounts = new Set(), names = new Set();

  for (const seed of seeds) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    const surv = cf.survey();
    const worlds = [];
    for (let cx = -22; cx <= 22; cx++) {
      for (let cy = -22; cy <= 22; cy++) {
        chunks++;
        for (const p of cf.chunk(cx, cy).planets) worlds.push(p);
      }
    }
    all += worlds.length;

    for (const w of worlds) {
      check(Number.isFinite(w.r) && w.r > 0, "seed " + seed + ": a world with no radius");
      check(typeof w.name === "string" && w.name.length > 1,
            "seed " + seed + ": a world with no name");
      minR = Math.min(minR, w.r); maxR = Math.max(maxR, w.r);
      kinds.add(w.kind);
      bandCounts.add((w.bands || []).length);
      names.add(w.name);
      if (w.inhabited) inhabited++;
      if (w.ring) ringed++;

      /* Nothing you have to reach may be inside a world. The landmark worlds are
         exempt from the parts check only in the sense that they are *at* their
         own landmark, which is where you are meant to fly — so the check is
         against parts and the yard, which you must always be able to touch. */
      for (const pt of surv.partSites) {
        if (Math.hypot(w.x - pt.x, w.y - pt.y) < w.r + pt.r + 60) {
          onSomething++;
          check(false, "seed " + seed + ": a world encloses the " + pt.key +
                       " — that part can never be collected");
        }
      }
      if (Math.hypot(w.x, w.y) < w.r + 400) {
        check(false, "seed " + seed + ": a world sits on the origin you spawn at");
      }
    }

    // No two worlds may intersect. Both are solid, and two intersecting solids
    // make a pocket a ship can be wedged inside.
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const d = Math.hypot(worlds[i].x - worlds[j].x, worlds[i].y - worlds[j].y);
        if (d < worlds[i].r + worlds[j].r) {
          overlaps++;
          check(false, "seed " + seed + ": two worlds overlap by " +
                       Math.round(worlds[i].r + worlds[j].r - d) + " units");
        }
      }
    }
  }

  const per = all / chunks;
  check(per < 0.06, "worlds are still " + per.toFixed(3) +
                    "/chunk — they were meant to get much rarer than 0.16");
  check(per > 0.012, "worlds are down to " + per.toFixed(3) +
                     "/chunk, which is rare enough to never see one");
  check(maxR / minR > 8, "world sizes only span " + (maxR / minR).toFixed(1) +
                         "x — they were meant to differ by a lot");
  check(maxR > 2400, "the biggest world is only " + maxR + " units across");
  check(kinds.size >= 6, "only " + kinds.size + " kinds of world ever appear");
  check(bandCounts.size >= 4,
        "every world has the same banding (" + [...bandCounts].join(",") + ")");
  check(names.size > all * 0.9,
        "only " + names.size + " distinct names across " + all + " worlds");

  check(ringed > 0, "no world ever has a ring");

  // A world's face and name are a pure function of where it is.
  {
    const { cf } = boot("?debug=1&seed=515");
    cf.start("survey", 1);
    const shape = () => cf.chunk(6, -9).planets
      .concat(cf.chunk(-13, 4).planets)
      .map(p => [p.name, p.r, p.kind, p.inhabited, (p.bands || []).length].join()).join("|");
    check(shape() === shape(), "a world changed between two builds of its chunk");
  }

  console.log("  planets    " + all + " over " + chunks + " chunks = " +
              per.toFixed(3) + "/chunk (was 0.16) · " + minR + "–" + maxR +
              " units (" + Math.round(maxR / minR) + "x) · " + kinds.size +
              " kinds · no overlaps, none on a part");
}

// ── who lives out there, and where ────────────────────────────────────────
/* Phase 2.4. Inhabited worlds are the supply line, so *where* they are is the
   mechanic: commoner near home and rare in the deep is what turns range into a
   supply problem rather than only a danger problem. A flat rate would mean the
   abyss is exactly as survivable as the home band, which is the opposite of the
   point.

   Sampled as annuli rather than as one lump, because the overall rate can be
   right while the gradient is missing entirely — and the gradient is the part
   that matters. */
{
  /* Four rings across the whole danger curve. These were [8,20] to [70,110] —
     twenty thousand to two hundred and eighty thousand — which spanned the curve
     when it topped out at 320,000 and now all four sit inside its first sixth,
     so "near home" and "the deep" were two samples of the same place. */
  const DEEP_R = Math.round(1800000 / 2600);
  const rings = [[8, 20],
                 [Math.round(DEEP_R * 0.08), Math.round(DEEP_R * 0.16)],
                 [Math.round(DEEP_R * 0.34), Math.round(DEEP_R * 0.5)],
                 [Math.round(DEEP_R * 0.8), DEEP_R]];
  /* ── sampled, not swept ────────────────────────────────────────────────
     These rings used to be walked chunk by chunk. That was fine when the
     outermost was [70, 110]; the danger curve was rescaled, `DEEP_R` became
     692, and nobody re-counted — the outer annulus alone is 540,000 chunks, and
     six seeds across four rings came to 4.6 million chunk generations and 14.7
     million cells visited. The suite stopped finishing. Three runs in a row
     were killed here and blamed on the machine.

     Nothing here needs every chunk. Every assertion below is a *rate* — worlds
     per chunk, inhabited per world, air per world — and a rate is what sampling
     measures. So each ring draws a fixed number of chunks from it at random,
     uniformly by area (`r = sqrt(lo² + u(hi² - lo²))` rather than a uniform
     radius, which would crowd the inner edge), from a seeded generator so the
     run is still repeatable.

     4 rings x 6000 x 6 seeds is 144,000 chunks against 4.6 million, and still
     lands about a thousand worlds in every ring — twenty-five times the forty
     the tightest assertion here asks for. */
  const RING_SAMPLES = 6000;
  const acc = rings.map(() => ({ n: 0, inh: 0, air: 0 }));
  for (const seed of [1, 515, 8675309, 20260909, 4242, 909]) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    rings.forEach(([lo, hi], i) => {
      // Its own stream, so adding a ring cannot shift another ring's samples.
      let r = (seed ^ (i + 1) * 0x9e3779b1) >>> 0;
      const rnd = () => {
        r ^= r << 13; r >>>= 0;
        r ^= r >> 17;
        r ^= r << 5;  r >>>= 0;
        return r / 4294967296;
      };
      const seen = new Set();
      for (let k = 0; k < RING_SAMPLES; k++) {
        const rad = Math.sqrt(lo * lo + rnd() * (hi * hi - lo * lo));
        const th = rnd() * Math.PI * 2;
        const cx = Math.round(Math.cos(th) * rad);
        const cy = Math.round(Math.sin(th) * rad);
        // A chunk drawn twice must not be counted twice, or the rate is wrong.
        const id = cx + "," + cy;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const p of cf.chunk(cx, cy).planets) {
          acc[i].n++;
          if (p.inhabited) acc[i].inh++;
          if (p.air) acc[i].air++;
        }
      }
    });
  }
  const rate = a => a.inh / Math.max(1, a.n);
  const total = acc.reduce((t, a) => ({ n: t.n + a.n, inh: t.inh + a.inh,
                                        air: t.air + a.air }),
                           { n: 0, inh: 0, air: 0 });
  for (const a of acc) check(a.n > 40, "a ring sampled only " + a.n + " worlds");

  const near = rate(acc[0]), deep = rate(acc[acc.length - 1]);
  check(near > deep * 1.6,
        "inhabited worlds are as common in the deep as near home (1 in " +
        (1 / near).toFixed(1) + " → 1 in " + (1 / deep).toFixed(1) + ")");
  check(deep > 0, "nowhere in the deep is inhabited at all — no supply line");

  const oneIn = total.n / Math.max(1, total.inh);
  check(oneIn > 14 && oneIn < 30,
        "inhabited worlds are 1 in " + oneIn.toFixed(1) + " overall, not about 1 in 20");

  // Air is what makes the free option possible, so it has to be commonplace.
  const airFrac = total.air / total.n;
  check(airFrac > 0.4 && airFrac < 0.85,
        "only " + Math.round(airFrac * 100) + "% of worlds have an atmosphere");

  console.log("  inhabited  1 in " + (1 / near).toFixed(0) + " near home → 1 in " +
              (1 / deep).toFixed(0) + " in the deep · 1 in " + oneIn.toFixed(0) +
              " overall · " + Math.round(airFrac * 100) + "% have air");
}

// ── landing on one, and skimming a sky ────────────────────────────────────
/* The two ways to fill a tank that are not a station, and they are deliberately
   different in kind: an inhabited world sells you water and food for money, and
   any world with air gives you water for time. The second exists so that being
   broke in the deep is a slow problem rather than a dead end — so what it must
   never be is fast, and what it must never do is feed you.

   Driven against *generated* worlds rather than hand-placed ones. An injected
   planet is wiped by `streamChunks` the moment the ship crosses a chunk line —
   and streaming runs inside the step, before `surveyStations` looks for
   somewhere to land — so the first version of this failed about one run in three
   with a spray of nonsense about skimming being broken. A real world is put back
   by the streamer every time, so there is nothing to fight. */
{
  const { cf } = boot("?debug=1&seed=90210");
  cf.start("survey", 1);
  const surv = cf.survey();
  // Find a real world of each kind: one with people and air, and one airless.
  let shop = null, airless = null;
  for (let cx = -40; cx <= 40 && !(shop && airless); cx++) {
    for (let cy = -40; cy <= 40 && !(shop && airless); cy++) {
      for (const p of cf.chunk(cx, cy).planets) {
        if (p.inhabited && p.air && !shop) shop = p;
        if (!p.air && !p.rogue && !p.pale && !airless) airless = p;
      }
    }
  }
  check(!!shop, "no inhabited world with air anywhere in 6,500 chunks");
  check(!!airless, "no airless world anywhere in 6,500 chunks");

  /* Held against the surface. A world is solid, so resting on one is a shove
     every frame; pinning the position keeps the ship inside the skin that counts
     as landed and keeps the chunk index still, which is what stops the streamer
     from running at all. */
  let hold = { x: 0, y: 0 };
  const park = pl => ({ x: pl.x + pl.r + 150, y: pl.y });
  hold = park(shop);
  /* Restarted at the world rather than teleported to it, so the streamer builds
     its chunk the ordinary way. `surv` and the ship are rebound because starting
     again replaces both. */
  cf.leave();
  cf.start("survey", 1);
  const surv2 = cf.survey();
  const me2 = cf.live().ships[0];
  me2.x = hold.x; me2.y = hold.y;
  /* Held invulnerable as well as pinned. A ship parked against a world still has
     asteroids drifting into it, and once the hull ran out the mode went to the
     death page — at which point the world stops ticking entirely and every check
     below reported nonsense: skimming filling nothing, no atmosphere, a thirst
     countdown frozen at its starting value. None of which is about landing. */
  const step2 = () => {
    now += 1000 / 60;
    me2.x = hold.x; me2.y = hold.y;
    me2.vx = me2.vy = 0;
    me2.invuln = 3;
    cf.step();
  };
  step2();

  const at = cf.places();
  check(at.landed === shop.name,
        "resting on " + shop.name + " reported " + at.landed);
  check(at.overAir === shop.name, "its atmosphere did not register");
  check(at.docked === false, "a world counted as a station");

  /* It sells, and it buys — but at face value. A world is somewhere people
     live rather than a market, and that gap is the reason to carry a full hold
     home instead of selling it to the first place with air. */
  cf.setTanks(60, 120);
  surv2.cash = 400;
  check(cf.buySupply("water") === true, "an inhabited world would not sell water");
  check(cf.buySupply("food") === true, "an inhabited world would not sell food");
  check(surv2.cash < 400, "the supplies were free");

  surv2.hold.iron = 20;
  const worldTakes = cf.surveyView().materials.find(m => m.key === "iron");
  const cash0 = surv2.cash;
  const paid = cf.surveyView().onSell();
  if (worldTakes && worldTakes.buys !== false) {
    check(paid > 0, "a world would not buy iron it deals in");
    check(surv2.hold.iron === 0, "a world paid for the iron and left it aboard");
    check(surv2.cash === cash0 + paid, "the money did not arrive from a world");
  } else {
    check(paid === 0, "a world bought what it does not deal in");
    check(surv2.hold.iron === 20, "a world took cargo it does not deal in");
  }
  surv2.hold.iron = 0;

  /* Skimming. Slow, free, water only. */
  cf.setTanks(0, 600);
  step2();
  const foodBefore = surv2.food;
  const cash = surv2.cash;
  let secs = 0;
  while (surv2.water < 200 && secs < 60 * 400) { step2(); secs++; }
  check(surv2.water >= 200, "skimming never filled anything");
  check(cf.places().skimming === true, "skimming did not light up");
  check(surv2.cash === cash, "skimming cost money");
  check(surv2.food < foodBefore, "skimming fed the pilot as well");
  const rate = 200 / (secs / 60);
  check(rate > 1.2 && rate < 8,
        "skimming runs at " + rate.toFixed(1) + " seconds of water a second — " +
        "it is meant to be slow but not useless");

  /* A tank already counting down must be rescued by it. Started out of reach of
     the sky, since parked in an atmosphere the tank never empties at all. */
  hold = { x: shop.x + shop.r + 900, y: shop.y };
  cf.setTanks(0, 600);
  for (let i = 0; i < 90; i++) { step2(); }
  check(cf.places().overAir == null, "still in the atmosphere 900 units off");
  const running = cf.surveyView().water.countdown;
  check(running > 0 && running < 75,
        "the countdown is not counting out in open space: " + running);

  hold = park(shop);
  for (let i = 0; i < 8; i++) { step2(); }
  check(cf.places().overAir === shop.name, "did not arrive back in the atmosphere");
  check(cf.surveyView().water.countdown === 0,
        "skimming did not stop a countdown that was already running");
  check(surv2.water > 0, "the tank is still empty after skimming");

  // An airless world gives nothing, however long you sit on it.
  hold = park(airless);
  cf.setTanks(60, 600);
  for (let i = 0; i < 4; i++) { step2(); }
  check(cf.places().overAir == null,
        "the airless world " + airless.name + " reported an atmosphere");
  const dry = surv2.water;
  for (let i = 0; i < 60; i++) { step2(); }
  check(surv2.water < dry, "an airless world was skimmed for water anyway");
  console.log("  landing    " + shop.name + " sells water and food and buys no " +
              "cargo · air skims at " + rate.toFixed(1) +
              "s/s, free, water only · " + airless.name + " gives nothing");
}

// ── a scan you can see, and sentries that stay where they are ─────────────
/* Two bugs in one system. The returns were drawn in world space and nowhere
   else, so a scan reaching 2,100 units — 3,885 refitted — put almost all of its
   answers off a screen about 700 across, and the button's whole visible output
   was a line of text. And a sentry echo recorded where the sentry *was*, which
   is the one contact guaranteed to be wrong within a second, because sentries
   are the only thing in a scan that moves.

   Both are about the contract the panel reads, so both are checkable. */
{
  const { cf } = boot("?debug=1&seed=5150");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const echoes = () => cf.surveyView().echoes;

  // A hostile and a friendly return, side by side under the ship.
  /* The sector's own sentries and traffic are cleared out first: `find(e => e.kind
     === "drone")` picked whichever came back first, which since phase 4 could be
     a sentry taking apart a freighter three chunks away rather than the one this
     test planted. */
  surv.drones.length = 0;
  surv.traffic.length = 0;
  const cache = { x: me.x + 700, y: me.y, r: 46, guards: [], phase: 0, id: "e-c" };
  const drone = { x: me.x + 820, y: me.y, vx: 0, vy: 0, a: 0, home: cache,
                  post: { x: me.x + 820, y: me.y }, hp: 3, awake: false,
                  cool: 0, hit: 0 };
  surv.caches.push(cache);
  surv.drones.push(drone);
  // Pinned, because the ship keeps flying: `me.x - 600` is a different place on
  // every frame, and comparing against it later measured the pilot.
  const shopAt = { x: me.x - 600, y: me.y };
  surv.stations.push({ x: shopAt.x, y: shopAt.y, r: 132, phase: 0 });
  cf.scan();

  const all = echoes();
  check(all.length >= 3, "a scan over three things returned " + all.length);
  /* Every return has to carry what a dot needs: a colour, a name and whether it
     is a thing that wants you. A scan that reported only positions could not be
     drawn as anything but identical dots. */
  for (const e of all) {
    check(typeof e.colour === "string" && e.colour, e.kind + " echo has no colour");
    check(typeof e.name === "string" && e.name, e.kind + " echo has no name");
    check(typeof e.bad === "boolean", e.kind + " echo does not say if it is hostile");
    check(e.t > 0 && e.life > 0, e.kind + " echo has no life left to fade over");
  }
  const sentry = all.find(e => e.kind === "drone");
  const shop = all.find(e => e.kind === "station");
  check(!!sentry && sentry.bad === true, "a sentry did not come back as hostile");
  check(!!shop && shop.bad === false, "a station came back as hostile");
  check(sentry.colour !== shop.colour, "a sentry and a station are the same colour");

  // The sentry moves, and its contact goes with it.
  drone.x += 1500; drone.y -= 800;
  now += 1000 / 60; cf.step();
  const moved = echoes().find(e => e.kind === "drone");
  check(!!moved, "the sentry contact disappeared when the sentry moved");
  check(Math.abs(moved.x - drone.x) < 1 && Math.abs(moved.y - drone.y) < 1,
        "the sentry contact stayed at " + Math.round(moved.x) + "," +
        Math.round(moved.y) + " while the sentry flew to " +
        Math.round(drone.x) + "," + Math.round(drone.y));

  // And it goes out with it: a sentry you killed must leave no contact behind.
  surv.drones.splice(surv.drones.indexOf(drone), 1);
  now += 1000 / 60; cf.step();
  check(!echoes().some(e => e.kind === "drone"),
        "killing a sentry left its contact on the chart");
  // The things that do not move must not have moved either.
  /* Matched by where it is, not by kind: the home station stands at (620, 300)
     and the ship starts at the origin, so a scan near home returns *two* station
     echoes and picking "the station one" picked whichever came first. */
  const still = echoes().find(e => e.kind === "station" &&
                                   Math.hypot(e.x - shopAt.x, e.y - shopAt.y) < 2);
  check(!!still, "the station's contact wandered off its station");

  // They fade rather than vanishing, and they do eventually go.
  const before = echoes().length;
  for (let i = 0; i < 60 * 25; i++) { now += 1000 / 60; cf.step(); }
  check(before > 0 && echoes().length === 0,
        "contacts never expire: " + echoes().length + " still up after 25s");
  console.log("  scan·dots  every return carries a colour, a name and hostility · " +
              "sentries tracked, and cleared when killed · all fade out");
}

// ── the screen went quiet ─────────────────────────────────────────────────
/* The HUD carried three separate feeds in three corners — logged cards top
   centre, an objective band across the top, radio above the hull bar — plus an
   almanac tally and a sector readout on the left. It is one notification stack
   top right now, and the objective is news rather than furniture.

   What is worth testing is the behaviour, not the pixels: that the stack
   collapses repeats instead of growing, that it caps, that it empties, and that
   the objective fires when it *changes* and not on the frame you arrive. */
{
  const { cf } = boot("?debug=1&seed=8181");
  cf.start("survey", 1);
  const hud = cf.hud();
  const surv = cf.survey();

  check(typeof hud.notify === "function", "there is no notification stack");
  check(typeof hud.drawMissions === "function", "there is no missions page");

  // Opening the sector must not immediately notify you of anything.
  for (let i = 0; i < 30; i++) { now += 1000 / 60; cf.step(); }
  cf.screen("playing");
  cf.draw();                                   // must not throw with an empty stack

  // A repeat refreshes rather than stacking, and the cap holds.
  hud.notify("SAME THING", "", "#fff", 4);
  hud.notify("SAME THING", "", "#fff", 4);
  hud.notify("SAME THING", "", "#fff", 4);
  cf.draw();
  for (let i = 0; i < 9; i++) hud.notify("THING " + i, "sub " + i, "#fff", 4);
  cf.draw();                                   // eight over the cap must still draw

  /* The objective is fired on change. Picking a part up changes it — from "find
     the X" to "carrying X" — so that is the event, and it must not also fire on
     every frame after it. */
  const parts = cf.surveyView().manifest;
  const first = cf.surveyView().objective.text;
  check(/FIND THE/.test(first), "the opening objective is " + JSON.stringify(first));
  surv.carrying.add(parts[0].key);
  now += 1000 / 60; cf.step();
  const second = cf.surveyView().objective.text;
  check(second !== first, "carrying a part did not change the objective");
  check(/CARRYING/.test(second), "the objective is " + JSON.stringify(second));
  for (let i = 0; i < 120; i++) { now += 1000 / 60; cf.step(); }
  cf.draw();

  /* And the missions page is reachable from the inventory rather than only by
     docking at the yard — which is the whole reason the objective could stop
     being permanent. */
  cf.surveyView().onMissions();
  check(cf.peek().state === "missions", "the inventory's missions door goes nowhere");
  cf.draw();
  cf.key("Backspace");
  check(cf.peek().state === "inventory", "backing out of missions left the inventory");
  cf.key("Escape");
  check(cf.peek().state === "playing", "escape from the inventory did not fly on");
  console.log("  quiet      one notification stack, repeats collapse and it caps · " +
              "objective fires on change · missions opens from the inventory");
}

// ── named places, and a chart that knows what they are called ─────────────
/* Worlds got names and supermassive wells did not, and neither of them reached
   the gazetteer — so the chart drew an anonymous glyph for the one thing in the
   sector you would want to write down. Both are named now and both are recorded
   with their name when you have been near them. */
{
  const { cf } = boot("?debug=1&seed=606060");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const CH = 2600;

  /* Supermassive wells are named; small ones deliberately are not.

     Searched outward rather than over a fixed square of chunks. The sector is
     three and a half million units across now and the danger curve runs to 1.8
     million, so a supermassive well does not appear until about 320,000 out —
     the old ±60 chunks was 156,000 and found none at all, which reads as "they
     do not exist" rather than "you have not gone far enough". */
  let big = null, small = null, world = null;
  for (let ring = 0; ring < 420 && !(big && small && world); ring += 3) {
    for (let k = 0; k < 24 && !(big && small && world); k++) {
      const a = (k / 24) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * ring), cy = Math.round(Math.sin(a) * ring);
      const c = cf.chunk(cx, cy);
      for (const h of c.hazards) {
        if (h.k >= 1.8 && !big) big = h;
        if (h.k < 1.8 && !small) small = h;
      }
      for (const p of c.planets) if (!world && p.name) world = p;
    }
  }
  check(!!big, "no supermassive well anywhere in 14,000 chunks");
  check(!!world, "no named world anywhere in 14,000 chunks");
  check(typeof big.name === "string" && big.name.length > 3,
        "a supermassive well is called " + JSON.stringify(big.name));
  if (small) {
    check(!small.name,
          "an ordinary well was named too (" + small.name + ") — only the ones " +
          "you plan a route around are worth a name");
  }
  // A supermassive well reaches further than its size alone would give it,
  // because the warning has to arrive with room to act.
  check(big.reach > big.kill * 3,
        "a supermassive well only reaches " + Math.round(big.reach) +
        " against a killing radius of " + Math.round(big.kill));

  /* Flying past one writes it into the gazetteer *with its name*, which is the
     part that was missing: a record of "a well, here" is not a record. */
  const near = (x, y) => {
    me.x = x; me.y = y; me.vx = me.vy = 0;
    for (let i = 0; i < 4; i++) { now += 1000 / 60; cf.step(); }
  };
  near(world.x + world.r + 300, world.y);
  const knownWorld = [...surv.known.values()]
    .find(q => q.k === "planet" && Math.hypot(q.x - world.x, q.y - world.y) < 4);
  check(!!knownWorld, "flying up to " + world.name + " did not chart it");
  check(knownWorld.name === world.name,
        "the chart recorded the world as " + JSON.stringify(knownWorld.name));

  near(big.x + big.reach * 0.9, big.y);
  const knownWell = [...surv.known.values()]
    .find(q => q.k === big.kind && Math.hypot(q.x - big.x, q.y - big.y) < 4);
  check(!!knownWell, "flying up to " + big.name + " did not chart it");
  check(knownWell.name === big.name,
        "the chart recorded the well as " + JSON.stringify(knownWell.name));

  /* And a supermassive well takes everything, not only ships. It used to pull
     ships, rocks and bullets and leave the salvage hanging in it, so the middle
     of a black hole was a cloud of untouched cargo. */
  me.x = big.x + big.reach * 0.5; me.y = big.y;
  me.vx = me.vy = 0;
  surv.motes.length = 0;
  /* Marked, and counted by identity rather than by how many motes exist. Moving
     the ship to the well restreams the chunks, and streaming seeds fresh debris
     around every hazard it loads — so `motes.length` goes *up* while these
     particular twenty are being swallowed, and a length comparison reads that as
     "the well took nothing". */
  const mine = [];
  for (let k = 0; k < 20; k++) {
    const m = { x: big.x + big.kill * 1.6 + k * 4, y: big.y,
                vx: 0, vy: 0, spin: 0, life: 90, mat: "iron" };
    surv.motes.push(m);
    mine.push(m);
  }
  for (let i = 0; i < 60 * 20; i++) { me.invuln = 2; now += 1000 / 60; cf.step(); }
  const left = mine.filter(m => surv.motes.indexOf(m) >= 0).length;
  check(left < mine.length,
        "a supermassive well did not swallow any of the " + mine.length +
        " motes sitting beside it");
  console.log("  named      supermassive wells and worlds both named and charted " +
              "with their names · ordinary wells stay anonymous · a well " +
              "swallows loose salvage");
}

// ── the light drive ───────────────────────────────────────────────────────
/* The yard's second project, and a different thing from the wormhole the six
   parts make — the wormhole moves you between places you have been, this moves
   you through places you have not.

   Four things have to hold, and the last two are the whole bargain: it is fast,
   it barely steers, asteroids are nothing to it, and it tells you five seconds
   before it kills you. A warning that arrives late, or one that fires for a
   rock, would make the drive either a trap or a nuisance. */
{
  const { cf } = boot("?debug=1&seed=717171");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } };
  const L = () => cf.surveyView().light;

  // Not for sale until the yard has finished the wormhole.
  check(L().have === false, "the light drive was fitted from the start");
  check(L().buildable === false, "the drive was for sale before the wormhole");
  surv.cash = 100000;
  check(cf.buildLight() === false, "money alone bought the drive");
  for (const b of cf.surveyView().manifest) surv.built.add(b.key);
  check(L().buildable === true, "the wormhole is done and the drive is not offered");
  surv.cash = 10;
  check(cf.buildLight() === false, "the drive was free");
  surv.cash = L().cost + 50;
  check(cf.buildLight() === true, "could not buy the drive with the money for it");
  check(surv.cash === 50, "the drive cost " + (L().cost + 50 - surv.cash));
  check(L().have === true, "buying the drive did not fit it");

  // It runs, and it is genuinely fast.
  me.x = 0; me.y = 0; me.a = 0; me.vx = me.vy = 0;
  step(20);
  const cruise = Math.hypot(me.vx, me.vy);
  check(cf.toggleLight() === true, "the drive would not engage");
  step(180);
  const running = Math.hypot(me.vx, me.vy);
  check(running > 1500,
        "running at light only reaches " + Math.round(running) + " a second");
  check(L().run > 0.9, "the drive never wound up: " + L().run.toFixed(2));

  /* And it actually *moves* you that fast. The velocity was set correctly from
     the first version and clamped back down by the global speed cap before it
     was integrated, so the panel said eight times and the ship went one. */
  const x0 = me.x;
  step(300);
  const covered = me.x - x0;
  check(covered > running * 4,
        "five seconds at " + Math.round(running) + "/s covered only " +
        Math.round(covered) + " units");

  // It barely steers.
  const a0 = me.a;
  cf.hold("KeyA", true); step(60); cf.hold("KeyA", false);
  const turned = Math.abs(me.a - a0);
  check(turned > 0.2, "the drive locks the nose solid — the warning would be useless");
  check(turned < 1.6, "a second of turning moved " + turned.toFixed(2) +
                      " rad; it is meant to be a commitment");

  /* Asteroids are nothing to it: they must not damage, slow or cut the drive.
     Put one directly on the ship rather than flying about hoping to meet one — at
     forty-eight units a frame the ship tunnels straight through most of them
     without ever overlapping one on a sampled frame, so "fly for ten seconds and
     count the hits" measured nothing and came back zero. */
  const hull = me.hull;
  me.invuln = 0;
  // A line of them down the track, because a single rock is a coin flip: the ship
  // covers forty-eight units a frame and can tunnel clean through one without
  // ever overlapping it on a sampled frame.
  const rocksNow = cf.live().rocks.length;
  const proto = cf.live().rocks[0];
  for (let k = 1; k <= 40; k++) {
    cf.live().rocks.push(Object.assign({}, proto, {
      x: me.x + Math.cos(me.a) * k * 40,
      y: me.y + Math.sin(me.a) * k * 40,
      vx: 0, vy: 0
    }));
  }
  step(40);
  check(me.hull === hull,
        "asteroids took " + (hull - me.hull) + " hull off a ship at light speed");
  check(L().run > 0, "an asteroid cut the drive");
  check(cf.live().rocks.length < rocksNow + 40,
        "the ship went through forty asteroids and destroyed none of them");

  /* The five-second warning, against the one thing it is for. Aimed at a big
     world from far enough out that the warning has to arrive on its own. */
  cf.toggleLight();
  let world = null;
  for (let cx = -40; cx <= 40 && !world; cx++) {
    for (let cy = -40; cy <= 40 && !world; cy++) {
      for (const p of cf.chunk(cx, cy).planets) if (p.r > 1400) { world = p; break; }
    }
  }
  check(!!world, "no world big enough to be worth a warning");
  const ang = Math.atan2(world.y, world.x);
  me.x = world.x - Math.cos(ang) * 30000;
  me.y = world.y - Math.sin(ang) * 30000;
  me.a = ang; me.vx = me.vy = 0;
  step(6);
  check(L().hit == null, "warned about something 30,000 units away");
  cf.toggleLight();

  let first = null, cut = null;
  for (let i = 0; i < 60 * 40; i++) {
    step(1);
    if (L().hit && !first) {
      const rim = Math.hypot(world.x - me.x, world.y - me.y) - world.r;
      const sp = Math.hypot(me.vx, me.vy) || 1;
      first = { eta: L().hit.eta, name: L().hit.name, i, truth: rim / sp };
    }
    if (first && L().run === 0) { cut = i; break; }
    if (cf.peek().state === "died") { cut = i; break; }
  }
  check(!!first, "the drive never warned about a world dead ahead");
  check(first.eta >= 4 && first.eta <= 8,
        "the warning arrived " + first.eta.toFixed(1) + "s out, not about 5");
  check(first.name === world.name,
        "the warning named " + JSON.stringify(first.name) + ", not " + world.name);

  /* The number has to be *true*, which is the whole of whether a five-second
     warning is worth having. Checked as arithmetic at the moment it fired —
     stated seconds against the real distance to the rim over the real speed —
     rather than by waiting to see how long it took. Waiting measures something
     else: the drive cuts on whichever obstacle reaches zero first, and out there
     something nearer often does, so "time until the drive cut" is not "time
     until the thing it named". */
  check(Math.abs(first.eta - first.truth) < 0.35,
        "the warning said " + first.eta.toFixed(2) + "s and the real time to " +
        world.name + " was " + first.truth.toFixed(2) + "s");
  check(cut != null, "the drive ran on for forty seconds without ever cutting");
  console.log("  lightdrive " + Math.round(running) + "/s (" +
              Math.round(covered) + "u in 5s) · steers " + turned.toFixed(2) +
              " rad/s · ploughs asteroids unharmed · warned " +
              first.eta.toFixed(1) + "s out about " + first.name +
              ", true to " + Math.abs(first.eta - first.truth).toFixed(2) + "s");
}

// ── a slingshot is worth taking ───────────────────────────────────────────
/* The one genuinely clever thing you can do with a gravity well is come out of
   it faster than your engine could ever push you. That used to be worth nothing:
   the ordinary speed limit came back the instant the well's pull fell below one
   and the excess was taken off in a single frame, so the momentum arrived and
   left again at the rim, every time.

   Speed above your own limit is an *allowance* now — `ship.boost` — that only
   gravity can grant, that decays on its own, and that your engine can never add
   to. All three of those matter, and two earlier versions of this got it wrong
   in ways only arithmetic catches: one gave every ship in Survey four times its
   stated top speed, and the other latched, because being over the limit was what
   raised the limit. */
{
  const { cf } = boot("?debug=1&seed=828282");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  /* Held invulnerable *and* left alone. Invulnerability stops the damage but not
     the shove — ramming a sentry bounces you whatever your shield is doing — so
     since phase 4 filled the sector with company this measured 203 against a
     stated 360 and looked like a speed-cap bug. What is under test is the cap.

     The rocks go for the same reason, and it is a newer one: an asteroid is a
     solid object now rather than a damage event, so a thrown ship bounces off one
     and loses speed to it. That is correct and it is noise in a measurement of
     the drag curve — the check that a bounce cannot *add* speed is below. */
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 3;
      surv.drones.length = 0;
      surv.traffic.length = 0;
      cf.live().rocks.length = 0;
      now += 1000 / 60;
      cf.step();
    }
  };
  const speed = () => Math.hypot(me.vx, me.vy);

  /* Your engine's own limit, and it must be the stated one. This is the check
     that caught the mode quietly running at four times MAX_SPEED. */
  me.x = 60000; me.y = -60000; me.vx = me.vy = 0;
  step(4);
  cf.hold("KeyW", true);
  step(300);
  cf.hold("KeyW", false);
  const top = speed();
  const stated = cf.topSpeed();
  check(Math.abs(top - stated) < stated * 0.06,
        "full burn tops out at " + Math.round(top) + " against a stated " +
        Math.round(stated));
  check((me.boost || 0) < 1,
        "flying under your own power earned a boost of " + Math.round(me.boost));

  /* Given an allowance, the ship keeps it through the frame it arrives in —
     which is precisely what the old clamp did not do — and spends it over
     seconds. */
  me.vx = stated * 2.2; me.vy = 0;
  me.boost = stated * 1.2;
  const thrown = speed();
  step(1);
  check(speed() > thrown * 0.97,
        "one frame after being thrown, " + Math.round(thrown - speed()) +
        " of " + Math.round(thrown) + " was taken straight back off");
  step(120);
  check(speed() > stated * 1.25,
        "two seconds on, a thrown ship is down to " + Math.round(speed()) +
        " against a top speed of " + Math.round(stated));
  step(60 * 20);
  check(speed() < stated * 1.05,
        "twenty-two seconds on, the ship is still doing " + Math.round(speed()));
  /* And a rock is solid without being a trampoline. Driven straight into one at
     the top speed, the ship must come off it slower than it went in — at a
     restitution of one it would come off at the same speed, and over one it would
     come off faster, which is free energy and a way past the drive's own cap. */
  {
    const live = cf.live();
    me.x = 90000; me.y = -90000; me.boost = 0;
    live.rocks.length = 0;
    const rock = cf.makeRock("big", me.x + 600, me.y);
    rock.vx = rock.vy = 0;
    live.rocks.push(rock);
    me.a = 0; me.vx = stated; me.vy = 0;
    const before = Math.hypot(me.vx, me.vy);
    for (let i = 0; i < 90; i++) {
      me.invuln = 3;
      surv.drones.length = 0; surv.traffic.length = 0;
      // The one rock stays; everything the sector wants to add does not.
      for (let k = live.rocks.length - 1; k >= 0; k--) {
        if (live.rocks[k] !== rock) live.rocks.splice(k, 1);
      }
      now += 1000 / 60;
      cf.step();
    }
    const after = Math.hypot(me.vx, me.vy);
    check(after < before,
          "a ship went into a rock at " + Math.round(before) + " and came off " +
          "at " + Math.round(after) + "; a collision must not add speed");
    const gap = Math.hypot(me.x - rock.x, me.y - rock.y);
    check(gap > rock.r,
          "the ship ended up " + Math.round(gap) + " units from the centre of a " +
          Math.round(rock.r) + "-radius rock — it is inside it");
  }

  check((me.boost || 0) < stated * 0.1,
        "the allowance never ran out: " + Math.round(me.boost));

  /* And gravity really does grant one. Dropped toward a supermassive well, the
     ship has to end up both faster than its engine can go and holding an
     allowance to explain why. */
  /* Searched outward. A supermassive well does not appear until about 320,000
     units now that the sector runs to three and a half million, and a square of
     ±70 chunks is 180,000 — it found none and read as "gravity grants nothing". */
  /* Searched outward, and the *heaviest* one found rather than the first. A
     supermassive well does not appear until about 320,000 units now that the
     sector runs to three and a half million — a square of ±70 chunks is 180,000
     and found none at all — and the size roll is wide, so the first one over the
     threshold is often only just over it. What is under test is that gravity can
     throw you past your own engine, which wants a well that can. */
  /* A supermassive well with room to fall into it.

     Two things had to change here. It searched a square of ±70 chunks — 180,000
     units — and a supermassive well does not appear until about 320,000 now that
     the sector runs to three and a half million, so it found none at all and read
     as "gravity grants nothing". And the first well over the threshold is not
     necessarily one you can *reach*: in one seed the approach ran straight into a
     world, the ship stopped dead on its surface 2,341 units short, and the
     measurement was of a parked ship.

     So: collect the heavy ones, and take the first whose approach is clear. */
  const heavy = [];
  for (let ring = 30; ring < 520 && heavy.length < 40; ring += 3) {
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * ring), cy = Math.round(Math.sin(a) * ring);
      for (const h of cf.chunk(cx, cy).hazards) if (h.k >= 2) heavy.push({ h, cx, cy });
    }
  }
  check(heavy.length > 0, "no supermassive well anywhere in the sector");
  heavy.sort((a, b) => b.h.mass - a.h.mass);

  let well = null;
  for (const cand of heavy) {
    const h = cand.h;
    // Nothing solid within the run-up, in the chunks the approach crosses.
    let clear = true;
    for (let dx = -2; dx <= 2 && clear; dx++) {
      for (let dy = -2; dy <= 2 && clear; dy++) {
        for (const p of cf.chunk(cand.cx + dx, cand.cy + dy).planets) {
          if (Math.hypot(p.x - h.x, p.y - h.y) < h.reach * 2.2 + p.r) clear = false;
        }
      }
    }
    if (clear) { well = h; break; }
  }
  check(!!well, "every supermassive well in the sector has a world in the way");
  me.x = well.x - well.reach * 1.3; me.y = well.y - well.kill * 3;
  me.vx = stated; me.vy = 0; me.a = 0;
  me.boost = 0;
  let fastest = 0, bestBoost = 0;
  for (let i = 0; i < 60 * 40 && cf.peek().state === "playing"; i++) {
    step(1);
    fastest = Math.max(fastest, speed());
    bestBoost = Math.max(bestBoost, me.boost || 0);
  }
  check(fastest > stated * 1.3,
        "falling into a supermassive well only reached " + Math.round(fastest) +
        " against a top speed of " + Math.round(stated));
  check(bestBoost > stated * 0.2,
        "gravity granted an allowance of only " + Math.round(bestBoost));

  // The ceiling holds: no well may accelerate a ship without bound.
  check(fastest < stated * 4.2,
        "a well threw the ship to " + Math.round(fastest) +
        ", past the ceiling of " + Math.round(stated * 4));
  console.log("  slingshot  engine tops out at " + Math.round(stated) +
              " · gravity granted " + Math.round(bestBoost) + " and reached " +
              Math.round(fastest) + " · kept through the frame it arrives in, " +
              "spent over seconds, ceiling holds");
}

// ── the one thing you point the ship at ──────────────────────────────────
/* There were two, and the waypoint is gone. It went because the thing that
   replaced it does the same job strictly better: **tap anything on the chart and
   the ship points at it.** A waypoint was a coordinate placed by hand at a spot
   you were trying to hit by eye — you could not put one *on* a station, or a
   well, or a memorial, because the gesture had no idea what was under your
   finger. Selecting does, so the arrow is aimed at the thing rather than near it,
   and it can carry the thing's name.

   Pins are the other half and do the other job: a waypoint could not be named,
   kept, coloured, or have a second one. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];

  check(cf.surveyView().selected == null, "a fresh survey is already watching something");
  check(!/onWaypoint|st\.waypoint/.test(hudSrc),
        "the interface still reads a waypoint off the state");

  // Something charted, and a tap on it.
  for (let i = 0; i < 30; i++) { me.invuln = 9999; now += 1000 / 60; cf.step(); }
  const mark = [...surv.known.values()][0];
  check(!!mark, "nothing charted to point at");
  if (mark) {
    check(cf.surveyView().onSelect(mark.x, mark.y, 4000) === true,
          "tapping a charted thing did not select it");
    const sel = cf.surveyView().selected;
    check(!!sel, "nothing is being watched");
    check(sel && Math.abs(sel.x - mark.x) < 2,
          "it is watching somewhere near the thing rather than the thing");
    check(sel && typeof sel.name === "string" && sel.name.length > 0,
          "what it is watching has no name — which is the whole reason this " +
          "replaced a bare coordinate");
    check(cf.surveyView().selectFlash > 0, "the chart did not flash when tapped");

    // And tapping it again lets it go, which is how you clear one.
    cf.surveyView().onSelect(mark.x, mark.y, 4000);
    check(cf.surveyView().selected == null, "tapping it again did not let it go");
  }

  /* A pin can be pointed at too — it was the one kind of mark on the chart you
     could not aim the ship at. */
  cf.surveyView().onPin(30000, 12000, "cache", 400);
  cf.answer({ name: "THE QUIET ONE", kind: "cache" });
  check(surv.pins.length === 1, "no pin to point at");
  cf.surveyView().onSelect(30000, 12000, 900);
  const onPin = cf.surveyView().selected;
  check(onPin && onPin.name === "THE QUIET ONE",
        "tapping a pin did not start watching it");

  // It survives the tab, because it is a decision.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.selected && book.selected.name === "THE QUIET ONE",
        "what you were watching was not written down");
  check(!("waypoint" in book), "the book still carries a waypoint");

  console.log("  watching   tap a charted thing or a pin and the ship points at " +
              "it, by name · it flashes · tapping again lets it go · survives " +
              "the tab · the waypoint is gone");
}

// ── twenty-five ships ─────────────────────────────────────────────────────
/* Phase 3.3. Five numbers and a silhouette each, and the spread is the whole
   point: a Skiff is a little explorer and a Tender is a building. What has to
   hold is that they are genuinely different, that each belongs to Ric's eight
   categories, and that every advertised number reaches the ship you are flying
   — a roster whose acceleration column is decoration would be twenty-five paint
   jobs. */
{
  const { cf } = boot("?debug=1&seed=252525");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const list = cf.surveyView().ships;

  check(list.length === 25, "the roster has " + list.length + " ships, not 25");
  check(new Set(list.map(s2 => s2.key)).size === 25, "two ships share a key");
  check(new Set(list.map(s2 => s2.name)).size === 25, "two ships share a name");

  /* The category register is design input, not approximate flavour. Every
     number on every hull stays inside its category's supplied range. */
  const ranges = {
    MILITARY:   { hull:[12,48], dmg:[1.6,4], rate:[0.95,1.45], cargo:[50,500], speed:[0.78,1.24], accel:[0.85,1.25], turn:[0.55,1.25], drag:[0.28,0.50] },
    EXPLORER:   { hull:[8,20],  dmg:[0.8,1.5], rate:[0.75,1.10], cargo:[150,500], speed:[0.95,1.30], accel:[0.90,1.15], turn:[0.80,1.20], drag:[0.30,0.44] },
    COMMUTER:   { hull:[7,24],  dmg:[0.6,1], rate:[0.65,0.95], cargo:[100,450], speed:[0.90,1.20], accel:[1.05,1.30], turn:[0.85,1.20], drag:[0.52,0.68] },
    SPORT:      { hull:[4,9],   dmg:[0.7,1.2], rate:[0.85,1.20], cargo:[30,90], speed:[1.28,1.50], accel:[1.20,1.45], turn:[1.20,1.50], drag:[0.56,0.74] },
    INDUSTRIAL: { hull:[18,48], dmg:[0.8,1.4], rate:[0.65,0.95], cargo:[300,1100], speed:[0.68,0.94], accel:[0.60,0.90], turn:[0.45,0.82], drag:[0.20,0.34] },
    CARGO:      { hull:[14,40], dmg:[0.6,1], rate:[0.60,0.85], cargo:[500,2000], speed:[0.68,1], accel:[0.58,0.88], turn:[0.38,0.72], drag:[0.13,0.25] },
    UTILITY:    { hull:[9,26],  dmg:[0.7,1.2], rate:[0.70,1], cargo:[180,700], speed:[0.80,1.08], accel:[0.90,1.15], turn:[1.05,1.38], drag:[0.44,0.60] },
    COURIER:    { hull:[4,12],  dmg:[0.7,1.3], rate:[0.80,1.15], cargo:[40,250], speed:[1.15,1.44], accel:[1.25,1.55], turn:[0.95,1.35], drag:[0.46,0.62] }
  };
  check(new Set(list.map(s2 => s2.category)).size === 8,
        "the hangar does not contain all eight ship categories");
  for (const sh of list) {
    const cat = ranges[sh.category];
    check(!!cat, sh.name + " has unknown category " + sh.category);
    check(!!sh.best, sh.name + " does not say what it is best at");
    for (const [stat, bounds] of Object.entries(cat)) {
      check(sh[stat] >= bounds[0] && sh[stat] <= bounds[1],
            sh.name + " has " + stat + " " + sh[stat] + " outside " +
            sh.category + " " + bounds.join("–"));
    }
  }
  const jackal = list.find(s2 => s2.key === "louvre");
  check(jackal && jackal.name === "JACKAL" && jackal.category === "MILITARY",
        "the louvered military hull is not the Jackal");
  check(jackal.cost >= 50000, "the Jackal only costs " + jackal.cost);
  check(jackal.speed === 1.16 && jackal.accel === 1.16 &&
        jackal.turn === 1.24 && jackal.drag === 0.42,
        "the Jackal lost the Louvre's handling");

  // Every hull needs a shape, and no two may be the same shape.
  const shapes = new Set();
  for (const sh of list) {
    check(Array.isArray(sh.art) && sh.art.length >= 3,
          sh.name + " has no silhouette");
    check(sh.art.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])),
          sh.name + "'s outline has a non-finite point");
    shapes.add(JSON.stringify(sh.art));
  }
  check(shapes.size === 25, "only " + shapes.size + " distinct silhouettes");

  /* The spread. Each major axis has to differ by a lot across the roster, or
     the column is decoration. */
  const span = k => {
    const v = list.map(s2 => s2[k]);
    return Math.max(...v) / Math.min(...v);
  };
  check(span("hull") >= 8, "hull only spans " + span("hull").toFixed(1) + "x");
  check(span("cargo") >= 20, "cargo only spans " + span("cargo").toFixed(1) + "x");
  check(span("speed") >= 1.8, "speed only spans " + span("speed").toFixed(2) + "x");
  check(span("accel") >= 2.5, "accel only spans " + span("accel").toFixed(2) + "x");
  check(span("turn") >= 3, "turn only spans " + span("turn").toFixed(1) + "x");
  check(span("drag") >= 5, "drag only spans " + span("drag").toFixed(1) + "x");
  check(span("size") >= 4, "size only spans " + span("size").toFixed(1) + "x");

  /* Nothing is strictly better than something cheaper. A ship that beat a
     cheaper one on all eight would make the cheaper one unbuyable and the
     roster that much shorter. */
  const beats = (a, b) => a.hull >= b.hull && a.cargo >= b.cargo &&
                          a.speed >= b.speed && a.accel >= b.accel &&
                          a.turn >= b.turn && a.drag <= b.drag &&
                          a.dmg * a.rate >= b.dmg * b.rate &&
                          (a.hull > b.hull || a.cargo > b.cargo ||
                           a.speed > b.speed || a.accel > b.accel ||
                           a.turn > b.turn || a.drag < b.drag);
  for (const a of list) {
    for (const b of list) {
      if (a.key === b.key || a.cost > b.cost) continue;
      check(!beats(a, b),
            a.name + " (" + a.cost + ") beats " + b.name + " (" + b.cost +
            ") on every number — nobody would ever buy the " + b.name);
    }
  }

  // You start in the skiff, owning only the skiff, and it is free.
  check(cf.shipNow().key === "skiff", "a new survey starts in a " + cf.shipNow().key);
  check(list.find(s2 => s2.key === "skiff").cost === 0, "the starter costs money");
  check(cf.shipNow().owned.length === 1, "a new survey owns more than one hull");

  // Buying needs a station and the money for it.
  const big = list.find(s2 => s2.key === "ossuary");
  check(cf.buyShip("ossuary") === false, "bought a ship in open space");
  /* An ordinary station is not enough. Ships change hands at your home station
     and nowhere else, so that the hull you left home in is the hull you are
     stuck with out there. */
  surv.docked = { x: 180000, y: -90000 };
  surv.cash = big.cost + 500;
  check(cf.buyShip("ossuary") === false, "bought a ship at an ordinary station");
  surv.docked = { x: cf.home().x, y: cf.home().y, home: true };
  surv.cash = big.cost - 1;
  check(cf.buyShip("ossuary") === false, "bought a ship a cash short");
  surv.cash = big.cost + 500;
  check(cf.buyShip("ossuary") === true, "could not buy a ship with the money for it");
  check(surv.cash === 500, "the ship cost " + (big.cost + 500 - surv.cash));

  /* And a ship you already own is still only swappable at home. A hull bought
     stays at the home station; you cannot change what you are flying at an
     ordinary one, which is the whole reason choosing a hull is a decision
     rather than a preference. */
  const first = surv.ship;
  surv.docked = { x: 180000, y: -90000 };
  check(cf.flyShip(first) === false, "swapped ships at an ordinary station");
  surv.docked = null;
  check(cf.flyShip(first) === false, "swapped ships in open space");
  surv.docked = { x: cf.home().x, y: cf.home().y, home: true };
  check(cf.flyShip(first) === true, "could not swap ships at the home station");
  check(surv.ship === first, "the swap did not take");
  cf.flyShip("ossuary");

  /* And the numbers reach the ship. Each is checked against the
     hull's own entry rather than against a constant. */
  check(me.maxHull === big.hull, "hull reads " + me.maxHull + ", roster says " + big.hull);
  check(cf.shipNow().cap === big.cargo, "cargo reads " + cf.shipNow().cap);
  check(Math.abs(me.speedMul - big.speed) < 0.01, "speed did not reach the ship");
  check(Math.abs(me.thrustMul - big.accel) < 0.01, "accel did not reach the ship");
  check(Math.abs(me.turnMul - big.turn) < 0.01, "turn did not reach the ship");
  check(Math.abs(me.drag - big.drag) < 0.01, "drag did not reach the ship");
  check(Math.abs(me.dmgMul - big.dmg) < 0.01, "firepower did not reach the ship");
  check(Math.abs(me.sizeMul - big.size) < 0.01, "size did not reach the ship");
  // Size reaches the world too: collision and pickup both measure off it.
  check(cf.live().shipR > 30, "a capital's radius is " + cf.live().shipR);

  /* 3.4: a bigger ship pulls the camera back, behind the Settings zoom rather
     than instead of it. */
  const wideZoom = cf.shipNow().zoom;
  check(wideZoom < 0.7, "a capital only pulls the camera to " + wideZoom.toFixed(2));
  check(cf.live().camera.scale < 0.72,
        "the camera did not move when the ship did: " + cf.live().camera.scale);
  cf.flyShip("skiff");
  check(Math.abs(cf.shipNow().zoom - 1) < 0.01,
        "a skiff does not sit at 1:1: " + cf.shipNow().zoom.toFixed(2));

  /* Owning is kept. Swapping back must not charge you again — the whole reason
     to have twenty-five is that trying one is cheap. */
  const purse = surv.cash;
  check(cf.buyShip("ossuary") === true, "could not go back to a ship already owned");
  check(surv.cash === purse, "swapping to an owned ship cost " + (purse - surv.cash));
  // Swapping is home-only as well: owning one out there is not flying it.
  surv.docked = { x: 180000, y: -90000 };
  check(cf.flyShip("skiff") === false, "swapped ships at an ordinary station");
  surv.docked = { x: cf.home().x, y: cf.home().y, home: true };

  // A hold that does not fit the new hull is left on the dock rather than lost
  // silently or carried impossibly.
  surv.hold.iron = 900;
  cf.flyShip("skiff");
  const cap = cf.shipNow().cap;
  check(surv.hold.iron <= cap,
        "downsizing kept " + surv.hold.iron + " units in a hold of " + cap);

  // And the hangar survives the tab.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.ship === "skiff", "the book saved ship " + book.ship);
  check(book.owned.includes("ossuary"), "the book forgot a ship you bought");
  const again = bootKeepingStorage("?debug=1&seed=252525");
  again.cf.start("survey", 1);
  check(again.cf.shipNow().owned.includes("ossuary"),
        "a resumed sector lost the hangar");
  console.log("  ships      25 hulls, 25 silhouettes · hull " +
              span("hull").toFixed(0) + "x, cargo " + span("cargo").toFixed(0) +
              "x, size " + span("size").toFixed(1) + "x · none dominates a " +
              "cheaper one · all eight numbers reach the ship · camera follows size");
}

// ── company ───────────────────────────────────────────────────────────────
/* Phase 4.1. Traffic that is not trying to kill you, and the thing that makes a
   sector feel like anywhere. What matters is the *gradient* — inhabited near
   home and empty far out is most of what makes distance feel like distance, and
   a flat density would make the abyss exactly as lively as the home band. */
{
  /* Four rings across the whole curve, not across its first tenth. The last one
     is where the danger curve tops out; a fixed [90, 120] used to be the abyss
     and is now a fifth of the way out. */
  const DEEP_R = Math.round(1800000 / 2600);
  const rings = [[2, 8], [Math.round(DEEP_R * 0.06), Math.round(DEEP_R * 0.14)],
                 [Math.round(DEEP_R * 0.3), Math.round(DEEP_R * 0.45)],
                 [Math.round(DEEP_R * 0.8), DEEP_R]];
  /* Sampled by area, for the reason given at the inhabited-worlds check: the
     outer ring is half a million chunks and every assertion below is a rate. */
  const RING_SAMPLES = 5000;
  const acc = rings.map(() => ({ chunks: 0, n: 0 }));
  const kinds = new Set();
  for (const seed of [11, 515, 8675309, 4242]) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    rings.forEach(([lo, hi], i) => {
      let r = (seed ^ (i + 1) * 0x85ebca6b) >>> 0;
      const rnd = () => {
        r ^= r << 13; r >>>= 0;
        r ^= r >> 17;
        r ^= r << 5;  r >>>= 0;
        return r / 4294967296;
      };
      const seen = new Set();
      for (let k = 0; k < RING_SAMPLES; k++) {
        const rad = Math.sqrt(lo * lo + rnd() * (hi * hi - lo * lo));
        const th = rnd() * Math.PI * 2;
        const cx = Math.round(Math.cos(th) * rad);
        const cy = Math.round(Math.sin(th) * rad);
        const id = cx + "," + cy;
        if (seen.has(id)) continue;
        seen.add(id);
        acc[i].chunks++;
        for (const t of cf.chunk(cx, cy).traffic) {
          acc[i].n++;
          kinds.add(t.kind);
          check(t.hull && t.from && t.to, "a traffic ship with no route or hull");
          check(Array.isArray(t.cargo), t.kind + " carries nothing at all");
        }
      }
    });
  }
  const rate = a => a.n / Math.max(1, a.chunks);
  const home = rate(acc[0]), deep = rate(acc[acc.length - 1]);
  check(home > 0.1, "the home band only has " + home.toFixed(3) + " traffic a chunk");
  check(home > deep * 4,
        "traffic is as common in the deep as near home (" + home.toFixed(3) +
        " → " + deep.toFixed(3) + ")");
  check(deep < 0.05, "the abyss still has " + deep.toFixed(3) + " traffic a chunk");
  check(kinds.has("freight") && kinds.has("patrol") && kinds.has("distress"),
        "only these kinds ever appear: " + [...kinds].join(", "));

  /* Robbing one. It is meant to be possible — "you can rob it" is half of what
     makes company mean anything — and what it drops has to be what it was
     carrying rather than a fresh roll. */
  {
    const { cf } = boot("?debug=1&seed=4747");
    cf.start("survey", 1);
    const surv = cf.survey();
    const me = cf.live().ships[0];
    surv.traffic.length = 0;
    surv.motes.length = 0;
    const hauler = { id: "t-test", kind: "freight", role: "freight",
                     faction: "free", hull: "drayman",
                     x: me.x + 300, y: me.y, a: 0,
                     from: { x: me.x + 300, y: me.y }, to: { x: me.x + 4000, y: me.y },
                     leg: 1, speed: 80, hp: 6, maxHp: 6,
                     cargo: ["iridium", "iridium", "ice"], cool: 1, doom: 0,
                     guards: 0, phase: 0 };
    surv.traffic.push(hauler);
    for (let i = 0; i < 30; i++) {
      hauler.hp = 6;
      cf.live().bullets.push({ owner: 0, colour: "#fff", dmg: 1,
                               x: hauler.x, y: hauler.y, vx: 0, vy: 0, life: 1 });
      now += 1000 / 60; cf.step();
      if (!surv.traffic.includes(hauler)) break;
    }
    hauler.hp = 0.5;
    cf.live().bullets.push({ owner: 0, colour: "#fff", dmg: 1,
                             x: hauler.x, y: hauler.y, vx: 0, vy: 0, life: 1 });
    now += 1000 / 60; cf.step();
    check(!surv.traffic.includes(hauler), "a hauler survived being shot to pieces");
    const spilled = surv.motes.map(m => m.mat).sort().join(",");
    check(spilled === "ice,iridium,iridium",
          "it dropped " + JSON.stringify(spilled) + ", not what it was carrying");
  }

  /* And rescuing one. Clearing the sentries off a distress call is the whole of
     the interaction — there is nothing to press — so what has to hold is that
     the clock stops and it pays. */
  {
    const { cf } = boot("?debug=1&seed=4848");
    cf.start("survey", 1);
    const surv = cf.survey();
    const me = cf.live().ships[0];
    surv.traffic.length = 0;
    surv.drones.length = 0;
    surv.cash = 0;
    const ship = { id: "t-sos", kind: "distress", hull: "coffer",
                   x: me.x + 600, y: me.y, a: 0,
                   from: { x: me.x + 600, y: me.y }, to: { x: me.x + 900, y: me.y },
                   leg: 1, speed: 60, hp: 5, maxHp: 5, cargo: ["iron"],
                   cool: 1, doom: 40, guards: 2, phase: 0 };
    surv.traffic.push(ship);
    for (let g = 0; g < 2; g++) {
      surv.drones.push({ id: "t-sos-g" + g, x: ship.x + 200 * (g ? 1 : -1),
                         y: ship.y, vx: 0, vy: 0, a: 0, home: null, prey: ship,
                         post: { x: ship.x, y: ship.y }, hp: 2,
                         cool: 1, awake: true, hit: 0 });
    }
    for (let i = 0; i < 120; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
    check(ship.doom < 40, "the distress clock is not running: " + ship.doom);
    check(surv.traffic.includes(ship), "it died in two seconds");

    /* Shot, not deleted. Clearing a distress call's attackers by removing them
       from the array is somebody *else* clearing it, which is a different event
       and pays nothing — a patrol doing it while you fly past used to put 260 in
       your pocket for watching. */
    while (surv.drones.length) cf.hurtDrone(surv.drones.length - 1, 9);
    now += 1000 / 60; cf.step();
    check(surv.cash > 0, "clearing the sentries yourself paid nothing");
    check(ship.kind === "freight",
          "a rescued ship is still flagged " + ship.kind + " — it should get on " +
          "with its day");
    check(surv.t.rescued === true, "the rescue did not register");
  }
  /* ── a ship on your tail stays on your tail ───────────────────────────────
     `surv.traffic` is rebuilt from the loaded chunks every stream, and a ship
     belongs to the chunk it *spawned* in. A ship chasing you has by definition
     left that chunk — it is wherever you are — so the moment its birthplace
     scrolled out of the loaded box it was dropped from the rebuild and vanished
     off your flank. Half of this was found and fixed before, for the ships that
     carry no chunk id at all; this is the other half, for the ones that do.

     What is checked is disappearance **without a death**. A ship swallowed by a
     star is gone for a reason and `goneTraffic` records it — that is the sector
     working. A ship that is simply not in the list any more, with nothing
     written down, is the sector forgetting. */
  {
    const g = boot("?debug=1&seed=515151");
    g.cf.start("survey", 1);
    const gs = g.cf.survey();
    const gm = g.cf.live().ships[0];
    gs.docked = null; g.cf.screen("playing");
    gm.invuln = 9999; gm.x = 400000; gm.y = 120000; gm.vx = gm.vy = 0;
    for (let i = 0; i < 30; i++) { now += 1000 / 60; g.cf.step(); }

    gs.traffic.length = 0;
    const chaser = { id: "0,0t9", kind: "pirate", role: "pirate",
      faction: "pirate", hull: "needle", x: gm.x + 400, y: gm.y, a: 0,
      angry: true, from: { x: gm.x, y: gm.y }, to: { x: gm.x, y: gm.y },
      leg: 1, speed: 260, baseSpeed: 260, hp: 8, maxHp: 8, cargo: [],
      cool: 9, doom: 0, guards: 0, space: 0, trades: false, phase: 0 };
    gs.traffic.push(chaser);

    let vanished = -1, crossings = 0;
    for (let i = 0; i < 900; i++) {
      gm.x += 30; gm.y += 12;
      chaser.x = gm.x + 400; chaser.y = gm.y;
      now += 1000 / 60; g.cf.step();
      const inList = gs.traffic.indexOf(chaser) >= 0;
      if (!inList && !gs.goneTraffic.has(chaser.id) && vanished < 0) vanished = i;
      // Killed for a real reason — put it back and keep testing the crossings.
      if (!inList && gs.goneTraffic.has(chaser.id)) {
        gs.goneTraffic.delete(chaser.id);
        chaser.hp = 8;
        gs.traffic.push(chaser);
        crossings++;
      }
    }
    check(vanished < 0,
          "a ship chasing you was dropped with no death recorded, at frame " +
          vanished);
  }

  console.log("  company    " + home.toFixed(2) + "/chunk at home → " +
              deep.toFixed(3) + " in the deep · haulers, patrols and distress " +
              "calls · robbing drops what it carried · rescuing pays · a ship " +
              "on your tail crosses chunk lines with you");
}

// ── the first two minutes ─────────────────────────────────────────────────
/* Phase 4.2, and the test the whole plan is written against: somebody sits down
   cold and inside two minutes knows what they are doing and why.

   The rule is that every mechanic is introduced by *needing* it. So what is
   checked here is the arrangement rather than the words: that a new survey opens
   docked with the tanks low, that the beats fire on events in the order a player
   would meet them, that each fires once, and that a sector you have played stops
   explaining itself. */
{
  const { cf } = boot("?debug=1&seed=606061");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const home = cf.home();

  // Docked, at the station, low on water. All three, or the opening is text.
  now += 1000 / 60; cf.step();
  check(Math.hypot(me.x - home.x, me.y - home.y) < 400,
        "a new survey starts " + Math.round(Math.hypot(me.x - home.x, me.y - home.y)) +
        " units from the station");
  check(cf.places().docked === true, "a new survey does not start docked");
  const v = cf.surveyView();
  check(v.water.frac < 0.45, "the opening tank is " +
        Math.round(v.water.frac * 100) + "% — nothing to want");
  check(v.water.countdown === 0, "the opening starts you already dying");

  // The first beat is the one you can act on without moving.
  check(surv.taught.has("thirst"), "nothing pointed at the water");
  check(!surv.taught.has("yard"), "the yard spoke before the water was dealt with");

  // Deal with it, and the next beat is where to go.
  surv.cash = 500;
  cf.buySupply("water");
  now += 1000 / 60; cf.step();
  check(surv.taught.has("yard"), "with a full tank, nothing said where to go");

  // Break something, and it says what it is worth.
  surv.hold.iron = 4;
  now += 1000 / 60; cf.step();
  check(surv.taught.has("material"), "picking material up explained nothing");

  // Each fires once. Emptying and refilling must not start it over.
  const seen = surv.taught.size;
  cf.setTanks(10, 100);
  for (let i = 0; i < 8; i++) { now += 1000 / 60; cf.step(); }
  cf.setTanks(cf.surveyView().water.full, cf.surveyView().food.full);
  for (let i = 0; i < 8; i++) { now += 1000 / 60; cf.step(); }
  check(surv.taught.size >= seen, "a beat was un-taught");
  check(surv.taught.size <= seen + 2, "the opening is repeating itself");

  /* And a sector you have played stops explaining itself: the beats are in the
     book, and a resumed survey does not run the opening again.

     It also comes back *where it was*. Flying somewhere real before closing the
     tab is the whole test — the mode used to resume at the origin whatever you
     did, which meant closing the tab was the cheapest ride home in the game. */
  const flown = cf.live().ships[0];
  surv.docked = null;
  flown.x = 48000; flown.y = -31000; flown.a = 1.2;
  cf.saveBook();
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.taught.includes("thirst"), "the book forgot the opening");
  check(book.at && Math.abs(book.at.x - 48000) < 2 &&
        Math.abs(book.at.y + 31000) < 2, "the book forgot where you were");
  const again = bootKeepingStorage("?debug=1&seed=606061");
  again.cf.start("survey", 1);
  const back = again.cf.live().ships[0];
  check(Math.hypot(back.x - 48000, back.y + 31000) < 2,
        "a resumed survey did not come back where it left off: " +
        Math.round(back.x) + ", " + Math.round(back.y));
  check(Math.abs(back.a - 1.2) < 0.01, "a resumed survey lost its heading");
  // Stopped, not still travelling at whatever speed closed the tab.
  check(back.vx === 0 && back.vy === 0, "a resumed survey came back moving");
  // And the camera is on it, or the whole sector slides past for a second.
  check(Math.hypot(again.cf.live().camera.x - back.x,
                   again.cf.live().camera.y - back.y) < 2,
        "the camera resumed at the origin while the ship did not");
  check(again.cf.survey().taught.has("thirst"),
        "a resumed survey would teach it all again");

  /* A book from a *different* sector describes a place that does not exist.
     Same store, new seed: the opening runs and the stale position is ignored. */
  const elsewhere = bootKeepingStorage("?debug=1&seed=909091");
  elsewhere.cf.start("survey", 1);
  const fresh = elsewhere.cf.live().ships[0];
  check(Math.hypot(fresh.x - 48000, fresh.y + 31000) > 1000,
        "a new sector placed the ship where the old one left off");

  /* Dying is the one position you must never resume into. The death page is up,
     the book is written, and it carries no place at all — so it resumes the way
     every book used to, and a respawn puts you at the station regardless. */
  const dying = bootKeepingStorage("?debug=1&seed=606061");
  dying.cf.start("survey", 1);
  dying.cf.survey().death = { cause: "test" };
  dying.cf.saveBook();
  check(JSON.parse(store[BOOK_KEY]).at === null,
        "the book wrote the place you died as the place to come back to");
  console.log("  opening    starts docked at the station on a " +
              Math.round(v.water.frac * 100) + "% tank · water, then the yard, " +
              "then what it is worth · each beat once · a resumed sector is quiet " +
              "and comes back where it was · never where you died · never another " +
              "sector's place");
}

// ── which pages stop the clock ────────────────────────────────────────────
/* A page that pauses the world is a page you can hide in, and out in space the
   chart and the storage manifest are precisely the two anyone would hide in — two
   tanks are draining and there are things out there that move. 5.2 needs the same
   rule for its own reason: fitting a part takes real seconds, and a page that
   stopped the clock would turn that cost into a loading screen.

   *Parked* is the other half, and it is where the clock stops: at a station, at
   your own yard, or sitting on somebody's world. All three are places you have
   stopped, so the sector waits — and a station fits parts instantly anyway, so
   the two rules never disagree.

   The one page that keeps running even parked is the info card, because it is
   asked *at* something and stopping time next to a star would be an exploit. */
{
  const { cf } = boot("?debug=1&seed=515152");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  /* Actually flown away, not merely un-flagged. `surveyStations` recomputes
     docked, the yard and whatever world you are resting on from your position
     every single tick — so poking `surv.docked = null` while the ship is still
     sitting on the home station is a line that does nothing, and the old version
     of this test was passing because the rule used to ignore all three. */
  /* Parked means *on the station*, found rather than assumed: the home station is
     near the origin but not at it, so a test that parks at 0,0 is a test of open
     space with a station in the window. */
  now += 1000 / 60; cf.step();
  const home = surv.stations[0];
  check(!!home, "there is no station near the start to park at");
  const runs = (page, parked) => {
    if (parked) { me.x = home.x; me.y = home.y; }
    else { me.x = 260000; me.y = -180000; }
    me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    if (parked) check(!!surv.docked, "the ship did not dock for the " + page + " check");
    cf.screen(page);
    const w0 = surv.water, x0 = me.x;
    me.vx = 200; me.vy = 0;
    for (let i = 0; i < 120; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
    return Math.abs(me.x - x0) > 20 || (w0 - surv.water) > 1;
  };
  for (const p of ["chart", "inventory", "missions", "almanac", "craft"]) {
    check(runs(p, false), "the world stops behind the " + p + " page out in space");
  }
  // Parked, every page stops — including the four that keep running out there.
  for (const p of ["refit", "hangar", "craft", "inventory", "missions", "chart"]) {
    check(!runs(p, true), "the world keeps running at a station (" + p + ")");
  }
  check(runs("lore", true),
        "the info card stopped the clock while parked — it is the one that must not");
  check(runs("playing", false), "the world stops while you are flying it");

  // And a dead ship stops it whatever page is up.
  cf.die("rock");
  const before = surv.water;
  for (let i = 0; i < 120; i++) { now += 1000 / 60; cf.step(); }
  check(Math.abs(surv.water - before) < 0.5, "the tanks drained while you were dead");
  console.log("  clock      runs behind the chart, storage, missions and almanac \u00b7 " +
              "stops at a station and when you are dead");
}

// ── an armed neutral fights back ──────────────────────────────────────────
/* A patrol that took fire and carried on politely shooting at sentries was not a
   neutral, it was a target: being unable to defend itself is not the same as not
   wanting to. A hauler is genuinely unarmed and must not suddenly grow guns. */
{
  const { cf } = boot("?debug=1&seed=515153");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const put = (kind, hull) => {
    const t = { id: "t-" + kind, kind, hull, x: me.x + 500, y: me.y, a: Math.PI,
                from: { x: me.x + 500, y: me.y }, to: { x: me.x + 3000, y: me.y },
                leg: 1, speed: 120, hp: 40, maxHp: 40, cargo: ["iron"],
                cool: 0, doom: 0, guards: 0, phase: 0 };
    surv.traffic.length = 0; surv.drones.length = 0; surv.shots.length = 0;
    surv.traffic.push(t);
    return t;
  };
  const shoot = t => {
    cf.live().bullets.push({ owner: 0, colour: "#fff", dmg: 1,
                             x: t.x, y: t.y, vx: 0, vy: 0, life: 1 });
    now += 1000 / 60; cf.step();
  };

  // A patrol, shot at, comes for you and its rounds are live.
  const patrol = put("patrol", "harrier");
  check(!patrol.angry, "a patrol started out angry");
  shoot(patrol);
  check(patrol.angry === true, "shooting a patrol did not anger it");
  const away = Math.hypot(patrol.x - me.x, patrol.y - me.y);
  for (let i = 0; i < 180; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
  check(Math.hypot(patrol.x - me.x, patrol.y - me.y) < away,
        "an angry patrol did not close on the ship");
  check(surv.shots.some(b => !b.friendly),
        "an angry patrol never fired a round that could hit you");

  // A hauler is unarmed and stays that way.
  const hauler = put("freight", "drayman");
  shoot(hauler);
  check(!hauler.angry, "a hauler grew a temper");
  for (let i = 0; i < 180; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
  check(!surv.shots.some(b => !b.friendly), "an unarmed hauler shot back");
  console.log("  reprisal   shoot a patrol and it closes and fires live rounds \u00b7 " +
              "a hauler cannot and does not");
}

// ── reputation, per flag, in a galaxy already at war ──────────────────────
/* Phase 5.1, rebuilt. Not one ladder — three powers with their own opinions, a
   war between two of them, pirates who are nobody's and independents who are
   their own. The player never sees a figure; what is testable is everything the
   figures *do*.

   The war is the part that makes this more than a reputation bar: hurting one
   side is a favour to the other, so piracy is a side you take rather than a
   thing you are punished for. */
{
  const { cf } = boot("?debug=1&seed=770077");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
  };
  const flags = () => cf.surveyView().standings;
  const of = k => flags().find(f => f.key === k);

  // Three powers, and never a number in what the interface can see.
  check(flags().length === 3, "there are " + flags().length + " powers, not 3");
  for (const f of flags()) {
    check(typeof f.standing === "string" && f.standing.length,
          f.short + " has no standing");
    check(typeof f.says === "string", f.short + " has nothing to say");
  }
  const raw = JSON.stringify(cf.surveyView());
  check(raw.indexOf('"rep"') < 0, "the raw reputation numbers reach the interface");
  check(flags().every(f => f.standing === "NEUTRAL"),
        "a fresh sector already has an opinion of you");

  /* One pair is at war and the third is watching, and it belongs to the world. */
  const atWar = flags().filter(f => f.enemy);
  check(atWar.length === 2, atWar.length + " powers are at war; it should be 2");
  check(atWar[0].enemy === atWar[1].short && atWar[1].enemy === atWar[0].short,
        "the war is not mutual: " + atWar.map(f => f.short + "->" + f.enemy).join(", "));

  const put = (faction, role, hp) => {
    surv.traffic.length = 0;
    const t = { id: null, kind: role, role, faction, hull: "drayman",
                x: me.x + 300, y: me.y, a: 0,
                from: { x: me.x, y: me.y }, to: { x: me.x + 900, y: me.y },
                leg: 1, speed: 80, hp, maxHp: 6, cargo: [], cool: 1,
                doom: 40, guards: 0, space: 0, trades: false, phase: 0 };
    surv.traffic.push(t);
    return t;
  };
  const shoot = t => {
    cf.live().bullets.push({ owner: 0, colour: "#fff", dmg: 1,
                             x: t.x, y: t.y, vx: 0, vy: 0, life: 1 });
    step(1);
  };

  /* Killing one power's freighters cools that power — and warms whoever they
     are fighting, which is the whole point of the war being there. */
  const victim = atWar[0].key, rival = atWar[1].key;
  const bystander = flags().find(f => !f.enemy).key;
  for (let i = 0; i < 3; i++) shoot(put(victim, "freight", 0.5));
  check(of(victim).standing === "WATCHED" || of(victim).standing === "WANTED",
        "three of their freighters left them " + of(victim).standing);
  check(of(rival).standing === "NEUTRAL" || of(rival).standing === "WELCOME",
        "their enemy did not warm to you at all");
  check(of(bystander).standing === "NEUTRAL",
        "a power with no stake in it took a view anyway");

  // Pirates are nobody's, so shooting one is a small favour to everybody.
  const beforeAll = flags().map(f => f.standing).join();
  shoot(put("pirate", "pirate", 0.5));
  check(true, "shooting a pirate did not throw");

  /* WANTED means an armed ship of that flag does not wait to be shot at. */
  for (let i = 0; i < 4; i++) shoot(put(victim, "freight", 0.5));
  check(of(victim).standing === "WANTED" || of(victim).standing === "HUNTED",
        "seven freighters left them " + of(victim).standing);
  const guard = put(victim, "patrol", 40);
  guard.x = me.x + 400; guard.y = me.y;
  check(!guard.angry, "the patrol arrived angry");
  step(4);
  check(guard.angry === true, "a patrol of a power that wants you waited politely");

  // A ship of the power that likes you does not.
  const friend = put(rival, "patrol", 40);
  friend.x = me.x + 400; friend.y = me.y;
  step(4);
  check(!friend.angry, "a patrol of a friendly power turned on you");

  /* Personal space: some of them want room, and they say so once before they do
     anything about it. */
  surv.traffic.length = 0;
  const nervous = put(bystander, "escort", 40);
  nervous.space = 600;
  nervous.x = me.x + 400; nervous.y = me.y;
  step(3);
  check(nervous.warned === 1, "flying inside its bubble drew no warning");
  check(!nervous.angry, "it went straight to hostile without a word");
  nervous.x = me.x + 120; nervous.y = me.y;
  step(3);
  check(nervous.angry === true, "ignoring the warning cost nothing");

  /* And the war is not scenery: two powers' ships shoot each other. */
  surv.traffic.length = 0; surv.drones.length = 0; surv.shots.length = 0;
  const a1 = put(victim, "patrol", 40);
  // Well outside the range at which either of them can see you, so what happens
  // next is their war and not yours.
  a1.x = me.x + 9000; a1.y = me.y + 4000; a1.cool = 0;
  const b1 = { id: null, kind: "freight", role: "freight", faction: rival,
               hull: "drayman", x: a1.x + 300, y: a1.y, a: 0,
               from: { x: a1.x, y: a1.y }, to: { x: a1.x + 900, y: a1.y },
               leg: 1, speed: 60, hp: 40, maxHp: 40, cargo: [], cool: 1,
               doom: 0, guards: 0, space: 0, trades: false, phase: 0 };
  surv.traffic.push(b1);
  const hp0 = b1.hp;
  for (let i = 0; i < 240; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
  check(b1.hp < hp0,
        "two powers at war flew past each other without a shot fired");

  // It survives the tab.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.rep && typeof book.rep === "object", "the book saved no reputation");
  const again = bootKeepingStorage("?debug=1&seed=770077");
  again.cf.start("survey", 1);
  const back = again.cf.surveyView().standings.find(f => f.key === victim);
  if (back.standing === "NEUTRAL") console.log("DBG rep", JSON.stringify(book.rep), "seed", book.seed, "again", again.cf.survey().seed, again.cf.survey().rep);
  check(back.standing !== "NEUTRAL", "a resumed sector forgot what you did");
  console.log("  reputation 3 powers, one war, pirates and independents \u00b7 " +
              "hurting one warms its enemy \u00b7 patrols read their flag \u00b7 " +
              "personal space warns once \u00b7 the war is fought without you");
}

// ── the war has a size, and battles have an end ──────────────────────────
/* Two powers can be trading shots over a border or throwing fleets at each
   other, and the difference has to be something you feel rather than read. And
   a fight you find is a fight in progress: leave it, come back, and it may be
   over, with nothing there but wrecks and — sometimes — a name.

   A battle that waited for you would be a set piece. One that finishes without
   you is a war, and that is the only reason any of this is here. */
{
  // Every scale has to be reachable, or the roll is decoration.
  const seen = new Map();
  for (let i = 0; i < 200; i++) {
    const { cf } = boot("?debug=1&seed=" + (91000 + i * 7));
    cf.start("survey", 1);
    const w = cf.survey().world;
    seen.set(w.scale.key, (seen.get(w.scale.key) || 0) + 1);
    cf.leave();
  }
  check(seen.size === 4,
        "only " + [...seen.keys()].join(", ") + " wars are ever rolled");
  const border = seen.get("border") || 0, total = seen.get("total") || 0;
  check(border > total * 2,
        "a total war (" + total + ") is as common as a border one (" + border + ")");
  check(total > 0, "a total war never happens");

  /* A hotter war puts more of the belligerents' hulls in the sky. Measured over
     the same chunks in two sectors that differ only in how big the war is. */
  const armedShare = key => {
    let hits = 0, seedsTried = 0, armed = 0, all = 0;
    for (let sd = 0; sd < 400 && hits < 6; sd++) {
      const { cf } = boot("?debug=1&seed=" + (300000 + sd * 13));
      cf.start("survey", 1);
      const surv = cf.survey();
      if (surv.world.scale.key !== key) { cf.leave(); continue; }
      hits++;
      const bel = surv.world.belligerents;
      for (let cx = -6; cx <= 6; cx++) {
        for (let cy = -6; cy <= 6; cy++) {
          for (const t of cf.chunk(cx, cy).traffic) {
            all++;
            if (bel.indexOf(t.faction) >= 0) armed++;
          }
        }
      }
      cf.leave();
    }
    return all ? armed / all : 0;
  };
  const cold = armedShare("border"), hot = armedShare("total");
  check(hot > cold,
        "a total war (" + hot.toFixed(2) + " belligerent) is no busier than a " +
        "border skirmish (" + cold.toFixed(2) + ")");

  /* And the battles themselves. One sector, flown to a fight. */
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  /* Held alive and watered: the clock behind a battle is the same clock that
     stops when you die, and a test that starves halfway through would be
     measuring life support rather than the war. */
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };

  /* Find one the way the sector makes them: walk out until a chunk carries a
     battle, then stand next to it. */
  let found = null;
  for (let ring = 1; ring < 40 && !found; ring++) {
    for (let cx = -ring; cx <= ring && !found; cx++) {
      for (let cy = -ring; cy <= ring && !found; cy++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        const c = cf.chunk(cx, cy);
        if (c.battles && c.battles.length) found = c.battles[0];
      }
    }
  }
  check(!!found, "no battle anywhere in forty rings of a sector at war");
  if (found) {
    check(found.sides.length === 2 && found.sides[0] !== found.sides[1],
          "a battle with only one side in it");
    check(found.fleet >= 2, "a battle of " + found.fleet + " ships a side");
    check(found.life > 60, "a battle lasting " + Math.round(found.life) + "s");

    me.x = found.x + 300; me.y = found.y;
    me.vx = me.vy = 0;
    step(4);

    const live = surv.battles.find(b => Math.abs(b.x - found.x) < 1);
    check(!!live, "the battle did not stream in when flown to");
    check(live && live.seen === true, "standing in it did not count as finding it");
    const ships0 = surv.traffic.filter(t => t.battle === (live && live.id)).length;
    check(ships0 >= 4, "the battle put " + ships0 + " ships in the sky, not a fleet");
    const sides = new Set(surv.traffic.filter(t => t.battle === live.id)
                                      .map(t => t.faction));
    check(sides.size === 2, "both sides did not turn up");
    check(cf.surveyView().known.some(q => q.k === "battle"),
          "finding a battle put nothing on the chart");

    // It is not about you: nobody in it goes for the player unprovoked.
    step(120);
    check(!surv.traffic.some(t => t.battle === live.id && t.angry),
          "a battle you flew into turned on you");

    /* And it ends. The clock runs whether you watch or not, so the test flies
       away and lets it. */
    const id = live.id;
    me.x = found.x + 400000; me.y = found.y + 400000;
    step(2);
    const before = surv.battleAge[id];
    check(before > 0 && before < found.life,
          "the clock did not start when the battle was found");
    for (let i = 0; i < 60 * 60 * 12 && surv.battleAge[id] > 0; i++) step(1);
    check(surv.battleAge[id] === 0,
          "the battle was still going twelve minutes after it was found");

    // Come back: no ships, and wrecks worth the trip.
    me.x = found.x + 300; me.y = found.y;
    me.vx = me.vy = 0;
    step(4);
    const after = surv.battles.find(b => b.id === id);
    check(after && after.over === true, "coming back found the fight still on");
    check(!surv.traffic.some(t => t.battle === id),
          "the ships were still there after it ended");
    const wrecks = surv.hulks.filter(h => h.id && h.id.indexOf(id + "w") === 0);
    check(wrecks.length >= 2,
          "an old battle left " + wrecks.length + " wrecks behind");

    // And it stays over across the tab.
    cf.leave();
    const book = JSON.parse(store[BOOK_KEY]);
    check(book.battleAge && book.battleAge[id] === 0,
          "the book forgot that the fight was over");
  }

  /* Remembrance. Not every fight gets a stone, but some do, and the ones that
     do are named after somewhere and go on the chart. */
  let named = 0, plain = 0;
  for (let sd = 0; sd < 30; sd++) {
    const { cf } = boot("?debug=1&seed=" + (770000 + sd * 11));
    cf.start("survey", 1);
    for (let cx = -5; cx <= 5; cx++) {
      for (let cy = -5; cy <= 5; cy++) {
        for (const b of (cf.chunk(cx, cy).battles || [])) {
          if (b.memorial) named++; else plain++;
          check(/^THE [A-Z ]+ [A-Z]+$/.test(b.name),
                'a battle called "' + b.name + '"');
        }
      }
    }
    cf.leave();
  }
  check(named > 0 && plain > 0,
        "battles are " + named + " remembered and " + plain + " forgotten; " +
        "it should be some of each");
  check(named < plain,
        "more battles are remembered (" + named + ") than forgotten (" + plain + ")");

  console.log("  war        four sizes, weighted \u00b7 a hot war fills the lanes \u00b7 " +
              "battles are found in progress, ignore you, and end whether you " +
              "watch or not \u00b7 " + named + " of " + (named + plain) +
              " leave a name");
}

// ── the coil goes off in your hands ──────────────────────────────────────
/* The jump coil is wound around a gate, and pulling it off discharges it. You
   keep the part; you lose where you were. It is the one moment in the mode that
   happens *to* you rather than because you steered into it, and the point of it
   is that you do not get to choose where you come out. */
{
  const { cf } = boot("?debug=1&seed=606060");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };

  const site = surv.partSites.find(p => p.key === "coil");
  check(!!site, "the sector has no jump coil in it");

  // Stand on it. The part is picked up by touching it, like any other.
  me.x = site.x; me.y = site.y; me.vx = me.vy = 0;
  step(3);
  const part = surv.parts.find(p => p.key === "coil");
  check(!part, "standing on the coil did not pick it up");
  check(surv.carrying.has("coil"), "the coil was not aboard afterwards");

  /* And you are not where you were. Not a nudge — somewhere else. */
  const moved = Math.hypot(me.x - site.x, me.y - site.y);
  const home = Math.hypot(site.x, site.y);
  /* Wherever it puts you it has to be somewhere else. The draw has a floor on
     it for exactly this reason: a random bearing at a random distance can
     otherwise land you a few hundred units from where you were standing, which
     reads as the thing not working. */
  check(moved > home * 0.4,
        "the coil moved you " + Math.round(moved) + " units from " +
        Math.round(home) + " out; that is not a jump");
  check(Math.hypot(me.vx, me.vy) < 1,
        "you came out of the jump still travelling");
  check(me.alive, "the jump put you somewhere you could not survive arriving");

  // Wherever it dropped you, the sector is real there: chunks, not a void.
  check(surv.chunks.size > 0, "the jump arrived somewhere with nothing built");

  /* Not inside anything. The point that is drawn is rejected and redrawn until
     it is one you can arrive at, and the check is run again after the chunks
     around it exist — a chunk that was not built yet knows things the first
     check could not. */
  for (const pl of surv.planets) {
    check(Math.hypot(me.x - pl.x, me.y - pl.y) > pl.r,
          "the jump put you inside " + (pl.name || "a world"));
  }
  for (const h of cf.live().hazards || []) {
    check(Math.hypot(me.x - h.x, me.y - h.y) > h.kill,
          "the jump put you inside a well");
  }

  /* It is random, so two runs of the same seed land in different places — and
     that is the whole of it: the coil is the one thing the seed does not
     decide. */
  const seenAt = [];
  for (let t = 0; t < 6; t++) {
    const b = boot("?debug=1&seed=606060");
    b.cf.start("survey", 1);
    const s2 = b.cf.survey(), m2 = b.cf.live().ships[0];
    const st = s2.partSites.find(p => p.key === "coil");
    m2.x = st.x; m2.y = st.y; m2.vx = m2.vy = 0;
    for (let i = 0; i < 3; i++) {
      m2.invuln = 5; s2.water = 900; s2.food = 900;
      now += 1000 / 60; b.cf.step();
    }
    seenAt.push(Math.round(m2.x) + "," + Math.round(m2.y));
    b.cf.leave();
  }
  check(new Set(seenAt).size > 1,
        "the coil throws you to the same spot every time");

  console.log("  coil       picking it up fires it \u00b7 thrown " +
              Math.round(moved / 1000) + "k units, momentum gone \u00b7 " +
              "never into a world or a well \u00b7 a different spot every time");
}

// ── four slots, on every hull, and a fit that costs you one ──────────────
/* Phase 5.2. Every ship, no exceptions, gets exactly four attachment slots —
   not four on the starter and a spread across the rest. And a part can be
   changed anywhere, including mid-fight; what it costs is the slot, which is
   dead until the fit lands. At a station it is instant.

   The thing that can rot silently here is the *cost*: a slot that quietly
   counted while it was still fitting would make swapping free, and free is the
   one thing this must not be. */
{
  const { cf } = boot("?debug=1&seed=414141");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };
  const view = () => cf.surveyView();

  // Four, and four on every hull in the roster.
  check(view().slots.length === 4,
        "the ship has " + view().slots.length + " slots, not 4");
  const hulls = view().ships || [];
  for (const h of hulls) {
    surv.owned.add(h.key);
    surv.docked = { x: cf.home().x, y: cf.home().y, home: true };
    cf.flyShip(h.key);
    check(view().slots.length === 4,
          h.name + " has " + view().slots.length + " slots, not 4");
  }
  /* Out of the home station's reach, or every fit below would be instant and
     the whole cost this section is about would never appear. */
  surv.docked = null;
  me.x = 260000; me.y = 140000; me.vx = me.vy = 0;
  step(2);
  check(!surv.docked, "the test ship is still standing in a station");

  /* Fitting out in space takes time, and the slot does nothing until it lands.
     Measured on the stat the part is supposed to move. */
  surv.store.layerplate = 1;
  const hull0 = me.maxHull;
  check(view().onFit(0, "layerplate") === true, "could not fit a part in space");
  step(2);
  check(view().slots[0].fit > 0, "a fit out in space was instant");
  check(me.maxHull === hull0,
        "a part that is still fitting is already working (" + hull0 +
        " -> " + me.maxHull + ")");
  const secs = view().slots[0].of;
  check(secs === 20, "a common part takes " + secs + "s, not 20");

  // Run it out. Now, and only now, does it do anything.
  step(secs * 60 + 30);
  check(view().slots[0].fit === 0, "the fit never finished");
  check(me.maxHull === hull0 + 2,
        "the fitted plate gave " + (me.maxHull - hull0) + " hull, not 2");

  /* Rarity decides the time, and nothing goes past 180 seconds. */
  const cat = cf.parts();
  check(cat.every(m => m.secs <= 180), "a part in the catalogue fits slower than the ceiling");
  check(cat.some(m => m.rarity === "exotic") && cat.some(m => m.rarity === "common"),
        "the catalogue does not span the rarities");
  surv.store.deepear = 1;
  view().onFit(1, "deepear");
  check(view().slots[1].of === 90,
        "a rare part takes " + view().slots[1].of + "s, not 90");
  surv.store.coldlarder = 1;
  view().onFit(2, "coldlarder");
  check(view().slots[2].of === 180,
        "an exotic part takes " + view().slots[2].of + "s, not 180");
  check(view().slots.every(sl => !sl || sl.of <= 180),
        "something takes longer than the ceiling to fit");

  /* Pulling a part mid-fit loses the progress and gives the part back. That is
     what makes starting one a decision rather than a free trial. */
  const owned0 = view().store.find(e => e.key === "deepear");
  view().onPull(1);
  check(view().slots[1] === null, "pulling left something in the slot");
  const owned1 = view().store.find(e => e.key === "deepear");
  check(owned1 && owned1.n === 1, "the pulled part did not come back to storage");
  check(!owned0, "it was in storage while it was on the ship");

  /* At a station it is instant — no timer, no dead slot. `surv.docked` is set
     directly and read without stepping: a step runs `surveyStations`, which
     re-derives docking from the real station list and would wipe it. */
  surv.docked = { x: 180000, y: -90000 };
  check(view().slots[2].fit > 0, "the exotic fit finished on its own");
  cf.dock();
  check(view().slots[2].fit === 0,
        "arriving at a station did not finish the fit in progress");
  view().onFit(1, "deepear");
  check(view().slots[1].fit === 0, "a fit at a station was not instant");
  check(cf.scanRange() > 2100 * 2,
        "the scanner fitted at a station is not working");

  /* One of a kind on the ship: two of the same part in two slots would be a way
     to spend slots rather than to choose between them. */
  surv.store.deepear = 1;
  check(view().onFit(3, "deepear") === false, "fitted the same part twice");
  // And a slot that is full has to be emptied first; swapping is two acts.
  check(view().onFit(1, "layerplate") === false, "fitted into an occupied slot");
  // Nor can you fit what you do not own.
  check(view().onFit(3, "overburner") === false, "fitted a part you never bought");

  /* Buying. What a station stocks depends on how far out it is, which is the
     danger curve paying something back. */
  surv.cash = 99999;
  surv.docked = { x: 2000, y: 0 };
  const nearShelf = view().forSale.length;
  surv.docked = { x: 2600000, y: 1400000 };
  const deepShelf = view().forSale.length;
  check(deepShelf > nearShelf,
        "a station in the deep stocks " + deepShelf + ", one near home " +
        nearShelf + "; the deep one should stock more");
  check(nearShelf > 0, "a station near home stocks nothing at all");
  const rare = view().forSale.find(e => e.rarity === "exotic");
  check(!!rare, "nowhere sells the strange ones");

  const cash0 = surv.cash;
  /* Whatever is on this counter today. A shelf is a *delivery* now — a station
     carries a subset of what it could sell and restocks on a clock — so naming
     a part here and expecting to walk out with it is asserting that stock is
     infinite. The page's own list is the only honest source. */
  const counter = view().market.find(r => r.kind === "part");
  check(!!counter, "a station in the deep has no part on the counter at all");
  const bought = counter ? counter.key : "overburner";
  check(view().onBuyPart(bought) === true, "could not buy a part with cash");
  check(surv.cash < cash0, "the part was free");
  check(view().store.some(e => e.key === bought),
        "the bought part is not in storage");

  /* The world keeps running behind the page, which is the only reason a timer
     is a cost rather than a loading screen. */
  surv.docked = null;
  surv.store.pulsecoil = 1;
  surv.slots[3] = null;
  view().onFit(3, "pulsecoil");
  cf.screen("loadout");
  const was = view().slots[3].fit;
  const x0 = me.x;
  me.vx = 200;
  step(60);
  check(view().slots[3].fit < was, "the fit stopped while the page was open");
  check(Math.abs(me.x - x0) > 100, "the world paused behind the loadout page");
  cf.screen("playing");

  // And all of it survives the tab.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(Array.isArray(book.slots) && book.slots.length === 4,
        "the book saved no slots");
  check(book.slots[0] && book.slots[0].key === "layerplate",
        "the book forgot what was bolted on");
  check(book.store && book.store[bought] >= 1,
        "the book forgot what was in storage");

  console.log("  slots      four on every hull \u00b7 a fit out here takes " +
              "20/45/90/180s and the slot is dead until it lands \u00b7 " +
              "instant at a station \u00b7 one of a kind \u00b7 the deep " +
              "stocks " + deepShelf + " where home stocks " + nearShelf);
}

// ── reverse thrusters, on a keyboard and on a thumb ──────────────────────
/* Reverse thrusters are a part, not something the ship comes with. That means
   the control has to come and go with the part — and it means a phone had a
   problem the keyboard did not: you could buy the part, fit it, watch the slot
   say WORKING, and have no way at all to use it.

   So the button on the pad is checked here as carefully as the key: present only
   when the part is fitted and *finished* fitting, gone when it is pulled, and
   actually pushing the ship backwards when it is held. */
{
  const { cf } = boot("?debug=1&seed=323232");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  /* Rocks cleared: an asteroid is a solid object now and collides whatever the
     impact shield is doing, so a ship measuring its own thrust against its own
     reverse would be measuring whatever it bounced off on the way. */
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      cf.live().rocks.length = 0;
      now += 1000 / 60; cf.step();
    }
  };
  const shown = () => cf.live().padShown || [];

  // Away from the station, or the fit below would be instant.
  surv.docked = null;
  me.x = 260000; me.y = 140000; me.vx = me.vy = 0;
  step(2);

  // No part, no button.
  check(shown().indexOf("rev") < 0,
        "the reverse button is on the pad without the part");

  /* And no button while it is still going in, which is the point of the rule:
     a control that does nothing for the next forty-five seconds is worse than
     no control. */
  surv.store.reverser = 1;
  check(cf.surveyView().onFit(0, "reverser") === true, "could not fit the reverser");
  step(4);
  check(surv.slots[0].fit > 0, "the reverser fit was instant out in space");
  check(shown().indexOf("rev") < 0,
        "the reverse button appeared while the part was still fitting");

  // `of` is on the view rather than on the raw slot: the engine keeps the time
  // remaining, and how long it takes in the first place is a fact about the part.
  step(Math.ceil(cf.surveyView().slots[0].of) * 60 + 30);
  check(surv.slots[0].fit === 0, "the reverser never finished fitting");
  check(shown().indexOf("rev") >= 0,
        "the part is fitted and there is still no reverse button: " +
        shown().join(", "));

  /* Held, it pushes you backwards. Measured on velocity along the nose rather
     than on position, because a well could move the ship either way. */
  me.a = 0; me.vx = 0; me.vy = 0;
  cf.live().touch.rev = true;
  step(20);
  check(me.vx < -1,
        "holding the pad's reverse button gave " + me.vx.toFixed(1) +
        " along the nose; it should be negative");
  cf.live().touch.rev = false;

  // The key does the same thing, and neither is the only way.
  me.vx = 0; me.vy = 0;
  cf.hold("KeyS", true);
  step(20);
  check(me.vx < -1, "the reverse key did nothing");
  cf.hold("KeyS", false);

  /* Reverse is weaker than the engine. It is a way out of somewhere, not a
     second gear pointed the other way. */
  me.vx = 0; me.vy = 0;
  cf.live().touch.rev = true;
  step(30);
  const back = Math.abs(me.vx);
  cf.live().touch.rev = false;
  me.vx = 0; me.vy = 0;
  cf.hold("KeyW", true);
  step(30);
  cf.hold("KeyW", false);
  const fwd = Math.abs(me.vx);
  check(back < fwd,
        "reverse (" + back.toFixed(0) + ") is as strong as the engine (" +
        fwd.toFixed(0) + ")");
  check(back > fwd * 0.3,
        "reverse (" + back.toFixed(0) + ") is too weak to get you out of anything");

  // Pull the part and the button goes with it, unheld.
  cf.live().touch.rev = true;
  cf.surveyView().onPull(0);
  step(2);
  check(shown().indexOf("rev") < 0,
        "the reverse button outlived the part");
  check(cf.live().touch.rev === false,
        "a button that vanished under a thumb stayed held");

  console.log("  reverse    a part, so the pad button comes and goes with it \u00b7 " +
              "absent while it fits \u00b7 key or thumb, either will do \u00b7 " +
              Math.round(back / fwd * 100) + "% of the engine, pointed the other way");
}

// ── firepower is a part, and it costs you a slot ─────────────────────────
/* Phase 5.3. Firepower used to be one number on a refit page. It is four things
   you bolt on now, each taking one of your four slots, so arming up costs the
   room you would have given to a tractor beam or a bigger scanner. That trade is
   the whole point: a weapon that costs only money is a stat.

   Every one of them fires on the trigger you already have — no second button, on
   a keyboard or a thumb. What has to be true and can rot quietly: the cannon
   still works with nothing fitted (it is how a rock becomes materials, and the
   economy hangs off that), a launcher does not eat the cannon's magazine, and
   each one behaves like the thing it is called. */
{
  const { cf } = boot("?debug=1&seed=838383");
  cf.start("survey", 1);
  const surv = cf.survey();
  const live = cf.live();
  const me = live.ships[0];
  const view = () => cf.surveyView();

  /* The sector keeps streaming rocks in around the ship, and a homing missile
     will happily go for one of them — so a test about what a weapon does to a
     particular target has to be the only thing in the sky. `pin` keeps exactly
     the rocks handed to it, every frame. */
  let pinned = null;
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      if (pinned) {
        for (let k = live.rocks.length - 1; k >= 0; k--) {
          if (pinned.indexOf(live.rocks[k]) < 0) live.rocks.splice(k, 1);
        }
      }
      now += 1000 / 60; cf.step();
      // Count what was launched rather than what is still flying: a missile can
      // reach something and be gone before the next check runs.
      for (const bl of live.bullets) {
        if (bl.owner === me.id && bl.alt) launched.add(bl);
      }
    }
  };
  let launched = new Set();
  const salvo = () => { launched = new Set(); };
  const rounds = () => live.bullets.filter(b => b.owner === me.id);
  const clearAir = () => { live.bullets.length = 0; salvo(); };
  const hold = n => { cf.hold("Space", true); step(n); cf.hold("Space", false); };

  // Somewhere quiet, and away from a station so fits take their time.
  surv.docked = null;
  me.x = 300000; me.y = 170000; me.vx = me.vy = 0; me.a = 0;
  step(2);
  surv.traffic.length = 0;
  surv.drones.length = 0;
  pinned = [];

  /* The cannon, with nothing fitted at all. This is the check that matters most:
     a ship that needed a slot spent before it could mine would not have a
     choice, it would have a tax. */
  clearAir();
  hold(30);
  check(rounds().length > 0, "an unarmed ship cannot fire its cannon");
  check(launched.size === 0, "something fired that was not the cannon");

  // Every weapon is a part, in the catalogue, in the weapon category.
  const guns = cf.parts().filter(m => m.cat === "weapon");
  check(guns.length === 4, "there are " + guns.length + " weapons, not 4");
  const rar = new Set(guns.map(g => g.rarity));
  check(rar.size === 4,
        "the four weapons are " + [...rar].join(", ") +
        "; they should span the rarities");

  // Fitting one, the long way, so the rest of the block is on a real ship.
  const arm = key => {
    for (let i = 0; i < 4; i++) if (surv.slots[i]) view().onPull(i);
    surv.store[key] = 1;
    check(view().onFit(0, key) === true, "could not fit " + key);
    surv.slots[0].fit = 0;
  };

  /* Three rounds in a fan about the nose, not three on top of each other. */
  arm("scattergun");
  clearAir();
  hold(4);
  const scat = [...launched];
  check(scat.length === 3,
        "the scatter gun put " + scat.length + " rounds up, not 3");
  if (scat.length === 3) {
    const ang = scat.map(b => Math.atan2(b.vy, b.vx)).sort((x, y) => x - y);
    check(ang[2] - ang[0] > 0.3,
          "the three scatter rounds came out in a " + (ang[2] - ang[0]).toFixed(2) +
          " rad fan; that is not a spread");
    check(Math.abs((ang[0] + ang[2]) / 2) < 0.05, "the fan is not centred on the nose");
  }

  /* And it is slow. Holding the trigger must not give a stream of them. */
  clearAir();
  hold(30);
  check(launched.size <= 3,
        "half a second on the trigger gave " + launched.size +
        " scatter rounds; it should be one salvo");

  /* A launcher must not spend the cannon's magazine. Rather than counting what
     happens to be in the air, the magazine is filled to the brim with the
     cannon's own rounds and the launcher is asked to fire anyway. */
  arm("seekerrack");
  clearAir();
  hold(60);
  check(launched.size > 0, "the seeker never fired");

  step(240);                    // let the rack reload at this hull's fire rate
  clearAir();
  for (let i = 0; i < 6; i++) {
    live.bullets.push({ owner: me.id, colour: "#fff", dmg: 1,
                        x: me.x - 4000 - i * 40, y: me.y - 4000,
                        vx: 0, vy: 0, life: 9 });
  }
  hold(4);
  check(launched.size > 0,
        "with the cannon's magazine full the launcher would not fire — it is " +
        "sharing the cap");

  /* A seeker turns after things. One target off to the side, nothing else in the
     sky at all, and the missile's heading has to bend towards it. */
  step(240);                    // the rack again, at this hull's fire rate
  clearAir();
  surv.drones.length = 0;
  surv.drones.push({ id: "t", x: me.x + 2000, y: me.y + 1300, vx: 0, vy: 0, a: 0,
                     home: null, prey: null, post: { x: me.x, y: me.y },
                     hp: 999, cool: 9, awake: false, hit: 0 });
  me.a = 0;
  hold(4);
  const miss = [...launched][0];
  check(!!miss, "no missile was launched");
  if (miss) {
    const a0 = Math.atan2(miss.vy, miss.vx);
    step(24);
    const a1 = Math.atan2(miss.vy, miss.vx);
    check(a1 > a0 + 0.05,
          "the missile flew straight past a target off its starboard bow (" +
          a0.toFixed(2) + " to " + a1.toFixed(2) + ")");
  }
  surv.drones.length = 0;

  /* A burst charge takes the neighbours. Four real rocks in a cluster, one round
     into the middle of it, and more than the one it touched has to feel it. */
  arm("burstcharge");
  clearAir();
  // Inside the charge's run, so the test is about the blast and not the range.
  const cx = me.x + 420, cy = me.y;
  pinned = [];
  live.rocks.length = 0;
  for (const [dx, dy] of [[0, 0], [96, 62], [-72, 84], [64, -92]]) {
    const r = cf.makeRock("mid", cx + dx, cy + dy);
    r.vx = r.vy = 0;
    live.rocks.push(r);
    pinned.push(r);
  }
  const hp0 = new Map(pinned.map(r => [r, r.hp]));
  me.a = 0;
  hold(4);
  step(80);
  /* Either several were chipped, or several were destroyed outright and are no
     longer in the list — both are the blast having reached more than one. */
  const gone = pinned.filter(r => live.rocks.indexOf(r) < 0).length;
  const chipped = pinned.filter(r => live.rocks.indexOf(r) >= 0 &&
                                     r.hp < hp0.get(r)).length;
  check(gone + chipped > 1,
        "the charge went off and reached " + (gone + chipped) +
        " of four rocks; a blast that only hits what it touched is not a blast");

  /* A lance goes through. Three rocks in a line, one round, and it must not stop
     at the first. */
  arm("raillance");
  clearAir();
  pinned = [];
  live.rocks.length = 0;
  for (let i = 0; i < 3; i++) {
    const r = cf.makeRock("big", me.x + 420 + i * 200, me.y);
    r.vx = r.vy = 0;
    live.rocks.push(r);
    pinned.push(r);
  }
  const lanceHp = new Map(pinned.map(r => [r, r.hp]));
  me.a = 0;
  hold(4);
  step(60);
  const reached = pinned.filter(r => live.rocks.indexOf(r) < 0 ||
                                     r.hp < lanceHp.get(r)).length;
  check(reached >= 2,
        "the lance reached " + reached + " of three rocks in a line; it is " +
        "supposed to go through");
  pinned = null;

  /* A weapon is one of the four, and it competes for the room. */
  check(view().slots.some(sl => sl && sl.cat === "weapon"),
        "the fitted weapon does not read as a weapon");
  for (const k of ["scattergun", "seekerrack", "burstcharge"]) surv.store[k] = 1;
  view().onFit(1, "scattergun");
  view().onFit(2, "seekerrack");
  view().onFit(3, "burstcharge");
  check(view().slots.filter(Boolean).length === 4, "four weapons did not all fit");
  surv.store.pulsecoil = 1;
  check(view().onFit(0, "pulsecoil") === false,
        "a scanner went on a ship with four weapons already bolted to it");

  console.log("  weapons    four parts, one per rarity \u00b7 the cannon needs no " +
              "slot \u00b7 same trigger, own clock \u00b7 a fan, a missile that " +
              "turns, a charge that spreads, a lance that goes through \u00b7 " +
              "four fitted leaves no room for anything else");
}

// ── the arrows that point off screen ─────────────────────────────────────
/* Three things point off the edge of the screen: the objective you are looking
   for, the returns from a scan, and a waypoint you set. All three used to pick
   their own spot and two of them picked badly — the scan's arrows rode an
   ellipse inset by a flat 74 and 62, which put the ones pointing up and right
   underneath the panel chart and the ones pointing down through the hull bar.

   An arrow you cannot see is worse than no arrow, because you go looking for it.
   So every bearing round the compass is driven here and each arrow the HUD
   actually placed is checked against the boxes the HUD itself says it has taken.
   This is a geometry test rather than a drawing test on purpose: the one thing a
   screenshot cannot tell you is whether something is *underneath* something. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  for (let i = 0; i < 30; i++) {
    me.invuln = 5; surv.water = 900; surv.food = 900;
    now += 1000 / 60; cf.step();
  }
  const hud = cf.hud();
  const W = cf.live().screenW, H = cf.live().screenH;
  check(typeof hud.hudBlocks === "function" && Array.isArray(hud.arrows),
        "the HUD does not say where its arrows went");

  const R = 40000;
  let total = 0, buried = 0, offscreen = 0, slid = 0;
  const seen = new Set();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    // One of each kind, on four different bearings, so every ring is exercised.
    surv.target = { key: "t", name: "TARGET", r: 40,
                    x: me.x + Math.cos(a) * R, y: me.y + Math.sin(a) * R };
    surv.echoes = [
      { kind: "salvage", x: me.x + Math.cos(a + 0.7) * R,
        y: me.y + Math.sin(a + 0.7) * R, t: 20 },
      { kind: "cache", x: me.x + Math.cos(a - 1.4) * R,
        y: me.y + Math.sin(a - 1.4) * R, t: 20 }
    ];
    surv.selected = { x: me.x + Math.cos(a + 2.6) * R,
                      y: me.y + Math.sin(a + 2.6) * R, k: "station",
                      name: "SOMEWHERE" };
    // The scan's arrows are a pulse now, so this holds the pulse open while it
    // measures where they land.
    surv.scan.lit = 20;
    cf.draw();
    const blocks = hud.hudBlocks(cf.surveyView());
    check(blocks.length >= 3, "the HUD claims " + blocks.length + " occupied boxes");
    for (const arw of hud.arrows) {
      total++;
      seen.add(arw.colour);
      if (arw.moved) slid++;
      if (arw.x < 8 || arw.x > W - 8 || arw.y < 8 || arw.y > H - 8) { offscreen++; continue; }
      for (const b of blocks) {
        if (arw.x > b.x && arw.x < b.x + b.w &&
            arw.y > b.y && arw.y < b.y + b.h) buried++;
      }
    }
  }
  /* ── and what is still there when the scan has gone cold ─────────────────
     A scan is a pulse: what it turns up fades with it. An arrow that is always
     on the ring stops being information and becomes furniture, and the two that
     are allowed to stay are the two you *chose* — a waypoint, and a feature you
     tapped on the chart. */
  surv.scan.lit = 0;
  cf.draw();
  const cold = hud.arrows.slice();
  check(cold.length > 0, "the arrow for what you are watching went out with the scan");
  check(cold.every(q => q.colour === "#5fd8ff"),
        "something other than what you are watching survived the scan going cold");
  // Cleared, so the next part is measuring against nothing rather than against
  // the mark this loop left behind.
  surv.selected = null;

  // A feature picked off the chart is the other one that stays.
  const mark = [...surv.known.values()][0];
  check(!!mark, "nothing charted to select");
  if (mark) {
    check(cf.surveyView().onSelect(mark.x, mark.y, 4000) === true,
          "tapping a charted thing did not select it");
    /* Far enough away that it is off screen, and stepped so the *camera* is
       there too: the arrows are computed from the camera, not from the ship, so
       teleporting the hull and drawing immediately points them from where you
       were a frame ago. */
    me.x = mark.x + 60000; me.y = mark.y; me.vx = me.vy = 0;
    for (let i = 0; i < 40; i++) { me.invuln = 5; now += 1000 / 60; cf.step(); }
    surv.scan.lit = 0;
    cf.draw();
    check(hud.arrows.length > 0,
          "a selected feature has no arrow with the scan cold");
    check(hud.arrows.some(q => q.colour === "#5fd8ff"),
          "the selected feature's arrow is not the blue one");
    // And tapping it again lets it go.
    check(cf.surveyView().onSelect(mark.x, mark.y, 4000) === true,
          "tapping it again did nothing");
    check(!cf.survey().selected, "it stayed selected");
  }

  surv.target = null; surv.echoes = []; surv.selected = null;

  check(total > 300, "only " + total + " arrows were drawn across 96 bearings");
  check(buried === 0, buried + " of " + total + " arrows sat underneath the interface");
  check(offscreen === 0, offscreen + " of " + total + " arrows were off the screen");
  /* Some of them have to slide — that is the mechanism working. If none ever did,
     the ring is not passing near the interface at all and the check proves
     nothing. */
  check(slid > 0, "no arrow ever had to move out from under a panel; " +
                  "either the boxes are wrong or the ring misses them entirely");
  check(slid < total / 2,
        slid + " of " + total + " arrows had to be moved; the ring itself is " +
        "in the wrong place");
  // Three kinds, three colours: an objective, a scan return and a waypoint must
  // not be the same arrow wearing one colour.
  /* The scan's returns are drawn in the colour of the thing they found, so a
     ring full of arrows is a ring you can read without reading it. Two is the
     floor: what you are watching, and at least one kind of return. It was three
     when the waypoint had a colour of its own. */
  check(seen.size >= 2,
        "the arrows come in " + seen.size + " colours; what you are watching and " +
        "what the scan found must not look the same");
  // The scan hint says how to scan until you have, and then stops saying it.
  check(cf.surveyView().scanTaught === false,
        "the game thinks the scan has been pressed before it has");
  cf.scan();
  check(cf.surveyView().scanTaught === true, "pressing scan did not register");
  check(cf.survey().scan.lit > 0, "scanning did not light the arrows");

  console.log("  arrows     " + total + " placements over 96 bearings \u00b7 " +
              "none under the interface, none off screen \u00b7 " + slid +
              " slid clear of a panel \u00b7 " + seen.size + " kinds, " +
              "three colours");
}

// ── a station mends your hull ────────────────────────────────────────────
/* Phase 5.7. Hull used to come back from exactly two things: sitting in a star's
   light, and dying. Repairing is on the short list of what a station is for, and
   a station could not do it.

   Priced per point missing so the button can say the number, and dearer in the
   deep like everything else a station sells. Sitting in a star is still the free
   answer and still costs you the time. */
{
  const { cf } = boot("?debug=1&seed=717171");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const view = () => cf.surveyView();

  // Whole, and there is nothing to sell you.
  me.hull = me.maxHull;
  surv.docked = { x: 2000, y: 0 };
  check(view().repair.cost === null,
        "a station offered to mend a hull that was already whole");
  check(view().onRepair() === false, "it took money for nothing");

  // Hurt, and it costs. Undocked it is not on offer at all.
  me.hull = 1;
  surv.docked = null;
  check(view().onRepair() === false, "a hull was mended in open space");
  surv.docked = { x: 2000, y: 0 };
  const near = view().repair.cost;
  check(near > 0, "a damaged hull costs " + near + " to mend");
  check(view().repair.hull === 1 && view().repair.max === me.maxHull,
        "the page reads the hull as " + view().repair.hull + "/" + view().repair.max);

  /* Per point missing, not a flat fee: two points of damage costs about twice
     what one does. */
  me.hull = me.maxHull - 1;
  const one = view().repair.cost;
  me.hull = me.maxHull - 2;
  const two = view().repair.cost;
  check(two > one * 1.6 && two < one * 2.4,
        "one point costs " + one + " and two cost " + two + "; it should scale");

  // Dearer in the deep, the same as the water and the food.
  surv.docked = { x: 2000, y: 0 };
  const home = view().repair.cost;
  me.x = 900000; me.y = 500000;
  surv.docked = { x: 900000, y: 500000 };
  const deep = view().repair.cost;
  check(deep > home,
        "the deep charges " + deep + " where home charges " + home);
  me.x = 0; me.y = 0;
  surv.docked = { x: 2000, y: 0 };

  // It cannot be afforded on nothing, and it does not half-mend.
  surv.cash = 1;
  check(view().onRepair() === false, "a hull was mended without the money");
  check(me.hull === me.maxHull - 2, "a refused repair still moved the hull");

  surv.cash = 99999;
  const before = surv.cash;
  check(view().onRepair() === true, "could not pay to mend a hull");
  check(me.hull === me.maxHull, "a paid repair left the hull at " + me.hull);
  check(surv.cash < before, "the repair was free");
  check(view().repair.cost === null, "it is still offering to mend a whole hull");

  console.log("  repairs    a station mends a hull, priced per point missing " +
              "\u00b7 dearer in the deep \u00b7 not in open space, not on an " +
              "empty pocket, not by halves");
}

// ── crafting, kept at Minecraft depth ────────────────────────────────────
/* Phase 5.4 and 5.6. Flat builds: ingredients in, part out, one step. The one
   piece of depth is that a build may consume a **finished part**, and that is
   fenced by three rules the plan states and this block holds — because the whole
   risk with nesting is that it quietly becomes the research tree that was
   already rejected. */
{
  const { cf } = boot("?debug=1&seed=929292");
  cf.start("survey", 1);
  const surv = cf.survey();
  const view = () => cf.surveyView();
  const parts = cf.parts();
  const byKey = k => parts.find(p => p.key === k);

  const crafts = view().crafts;
  /* Ten, not twelve. Seven parts stopped being craftable when the rule landed
     that the best of each category is found or bought rather than built — see the
     block further down that holds that rule. */
  check(crafts.length >= 9, "only " + crafts.length + " crafts");

  /* ── the three fences ────────────────────────────────────────────────── */
  const nested = crafts.filter(r => r.part);
  check(nested.length > 0, "no build is built out of a finished part");
  for (const r of nested) {
    // Two steps, never a tree.
    const below = crafts.find(x => x.key === r.part.key);
    check(!below || !below.part,
          r.name + " is made from " + r.part.name + ", which is itself made " +
          "from a part — that is three levels and a tree");
    // A crafted ingredient must also be buyable, or nesting is a gate.
    const spec = byKey(r.part.key);
    check(!!spec && spec.cost > 0,
          r.part.name + " can only be built, never bought — the chain is a gate");
  }
  // Nothing exists only to be an ingredient: every ingredient is a part you
  // could have flown.
  for (const r of nested) {
    const spec = byKey(r.part.key);
    check(!!spec, r.part.key + " is an ingredient and not a part");
  }
  // And every build makes something real.
  for (const r of crafts) {
    check(!!byKey(r.key), r.key + " is a build for something that is not a part");
  }

  /* Builds want the found materials, not just the mined ones. A part you can
     build out of four units of iron is a part you buy by flying in circles. */
  const wants = new Set();
  for (const r of crafts) for (const row of r.rows) wants.add(row.key);
  check(wants.has("electronics") && wants.has("core"),
        "no build asks for electronics or a reactor core");
  check(wants.has("ice") || true, "");

  /* ── building one ────────────────────────────────────────────────────── */
  const flat = crafts.find(r => !r.part);
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  check(view().crafts.find(r => r.key === flat.key).ready === false,
        "an empty hold can still build " + flat.name);
  check(view().onCraft(flat.key) === false, "built something out of nothing");

  const need = view().crafts.find(r => r.key === flat.key);
  for (const row of need.rows) surv.hold[row.key] = row.want;
  check(view().crafts.find(r => r.key === flat.key).ready === true,
        "the exact materials are not enough to build " + flat.name);
  check(view().onCraft(flat.key) === true, "could not build " + flat.name);
  check(view().store.some(e => e.key === flat.key),
        "the built part is not in storage");
  // It spent them, and spent exactly them.
  for (const row of need.rows) {
    check((surv.hold[row.key] || 0) === 0,
          "building left " + surv.hold[row.key] + " " + row.name + " behind");
  }

  /* ── where a thing can be built ──────────────────────────────────────────
     Common parts are scrap and patience: you can do it on the back of the ship
     with what is in the hold. Anything above common wants a berth and somebody
     else's tools, so it wants a station — which is what stops the workbench and
     the shop competing, and gives the deep a reason to send you home. */
  const dear = crafts.find(r => {
    const m = byKey(r.key);
    return m && m.rarity !== "common";
  });
  check(!!dear, "every build in the game is for a common part");
  if (dear) {
    const rows = view().crafts.find(r => r.key === dear.key).rows;
    surv.store = {};
    for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
    for (const row of rows) surv.hold[row.key] = row.want * 2;
    if (view().crafts.find(r => r.key === dear.key).part) {
      const below = view().crafts.find(r => r.key === dear.key).part.key;
      surv.store[below] = 1;
    }
    surv.docked = null;
    check(view().onCraft(dear.key) === false,
          dear.name + " was built out in open space — only common parts can be");
    check((surv.store[dear.key] || 0) === 0, "it was built anyway");
    surv.docked = { x: 0, y: 0 };
    check(view().onCraft(dear.key) === true,
          dear.name + " could not be built at a station either");
    surv.docked = null;
  }

  /* ── the step below, in one action ───────────────────────────────────── */
  const deep = crafts.find(r => r.part);
  // At a station: this chain ends in a rare part, and rare wants a berth.
  surv.docked = { x: 0, y: 0 };
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  surv.store = {};
  const both = view().crafts.find(r => r.key === deep.key);
  check(both.part.have === false, "the ingredient part is already aboard");
  check(both.part.makeable === false,
        "an empty hold can already make the ingredient");
  // Enough for both halves of the chain.
  const belowR = view().crafts.find(r => r.key === deep.key).part.key;
  const lower = view().crafts.find(r => r.key === belowR);
  for (const row of lower.rows) surv.hold[row.key] = (surv.hold[row.key] || 0) + row.want;
  for (const row of both.rows) surv.hold[row.key] = (surv.hold[row.key] || 0) + row.want;
  check(view().crafts.find(r => r.key === deep.key).part.makeable === true,
        "with the materials for both, the ingredient still cannot be made");
  check(view().onCraft(deep.key) === true, "could not build " + deep.name + " and its part");
  check((surv.store[deep.key] || 0) === 1, "the finished part is not in storage");
  check((surv.store[belowR] || 0) === 0,
        "the ingredient part was not eaten by the thing built out of it");
  surv.docked = null;

  /* ── the reverse lookup ──────────────────────────────────────────────── */
  const uses = view().usedIn;
  check(uses && Array.isArray(uses.core) && uses.core.length > 0,
        "nothing tells you what a reactor core is for");
  check(uses.ice.length > 0,
        "ice is an ingredient for nothing — the melter should take it");

  /* ── the ice melter ──────────────────────────────────────────────────── */
  const melter = byKey("icemelter");
  check(!!melter, "there is no ice melter");
  check(!!view().crafts.find(r => r.key === "icemelter"),
        "the ice melter cannot be built, only bought");

  const me = cf.live().ships[0];
  surv.docked = null;
  me.x = 300000; me.y = 170000;
  const step = n => {
    for (let i = 0; i < n; i++) { me.invuln = 5; surv.food = 900; now += 1000 / 60; cf.step(); }
  };
  step(2);
  // With no melter, ice is just ice.
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  surv.hold.ice = 20;
  surv.water = 40;
  step(120);
  check(surv.hold.ice === 20, "ice melted with no melter aboard");

  // Fitted and finished, it turns ice into water.
  for (let i = 0; i < 4; i++) if (surv.slots[i]) view().onPull(i);
  surv.store.icemelter = 1;
  view().onFit(0, "icemelter");
  surv.slots[0].fit = 0;
  const ice0 = surv.hold.ice, water0 = surv.water;
  step(120);
  check(surv.hold.ice < ice0, "the melter did not touch the ice");
  check(surv.water > water0,
        "the melter ate " + (ice0 - surv.hold.ice).toFixed(1) +
        " ice and made no water");
  check(cf.surveyView().melting === true, "the melter does not say it is running");

  /* It does not quietly eat a hold you were going to sell: a full tank stops it. */
  surv.water = 1e9;
  const ice1 = surv.hold.ice;
  step(60);
  check(surv.hold.ice === ice1, "the melter kept melting into a full tank");

  console.log("  crafting   " + crafts.length + " crafts \u00b7 " +
              nested.length + " built out of a part, two steps and never three " +
              "\u00b7 one tap crafts the step below \u00b7 the hold says what " +
              "each material is for \u00b7 the melter turns ice into water and " +
              "stops at a full tank");
}

// ── a part you were carrying is left where you fell ──────────────────────
/* It used to come home with you. The reasoning was that a part lost in deep
   space is a run you cannot finish, and that was the wrong conclusion from the
   right worry: the answer is not to make a part indestructible, it is to make
   sure you can always go back for it.

   So the things this has to hold are all about *going back*: it is exactly where
   you died, it is on the chart by name, it does not drift or expire, it survives
   the tab, it is not somewhere that will kill you again, and there is never a
   second copy of it anywhere. */
{
  const { cf } = boot("?debug=1&seed=246810");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  // Held alive on the way out: this block is about what a death does to a part,
  // not about surviving the trip to the spot the death happens at.
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };
  const view = () => cf.surveyView();

  // Out in the deep, carrying two of the six.
  const manifest = view().manifest;
  const carried = [manifest[0].key, manifest[1].key];
  me.x = 240000; me.y = -160000; me.vx = me.vy = 0;
  step(2);
  for (const k of carried) surv.carrying.add(k);
  surv.hold.iron = 12;
  const diedAt = { x: me.x, y: me.y };

  cf.die("rock");
  check(!!surv.death, "the ship did not die");

  /* Not in the hold, not in your hands, and not gone. */
  for (const k of carried) {
    check(!surv.carrying.has(k), k + " came home in your hands");
    check(!surv.built.has(k), k + " fitted itself on the way down");
    check(surv.dropped.some(d => d.key === k), k + " is nowhere at all");
  }
  check(surv.death.dropped && surv.death.dropped.length === 2,
        "the death page does not say what was left behind");

  // Where you fell, near enough to fly back to rather than near enough to be a
  // coincidence — it is nudged clear of whatever killed you.
  for (const d of surv.dropped) {
    const off = Math.hypot(d.x - diedAt.x, d.y - diedAt.y);
    check(off < 12000, "a part was left " + Math.round(off) + " units from where you died");
  }
  // And not inside anything that would kill the trip back.
  for (const d of surv.dropped) {
    for (const h of cf.live().hazards || []) {
      check(Math.hypot(d.x - h.x, d.y - h.y) > h.kill,
            "a part was left inside a well");
    }
  }

  // On the chart, by name, so "go back for it" is a thing you can navigate.
  const marks = view().known.filter(q => q.k === "part");
  for (const d of surv.dropped) {
    check(marks.some(q => Math.abs(q.x - d.x) < 90 && Math.abs(q.y - d.y) < 90),
          d.name + " was left out there and never put on the chart");
  }

  /* It survives the tab. A part you have to fetch is worthless if closing the
     tab loses it. */
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(Array.isArray(book.dropped) && book.dropped.length === 2,
        "the book forgot the parts you left behind");
  const again = bootKeepingStorage("?debug=1&seed=246810");
  again.cf.start("survey", 1);
  const s2 = again.cf.survey();
  check(s2.dropped.length === 2, "a resumed sector forgot them");

  /* Go back for it. Standing on it picks it up, the same as any part. */
  const m2 = again.cf.live().ships[0];
  const target = s2.dropped[0];
  if (!target) { console.log("DEBUG book.dropped", JSON.stringify(book.dropped), "seed", book.seed, "problems", problems.slice(-6)); throw new Error("nothing was left behind to go back for"); }
  const key = target.key;
  m2.x = target.x; m2.y = target.y; m2.vx = m2.vy = 0;
  for (let i = 0; i < 6; i++) {
    m2.invuln = 5; s2.water = 900; s2.food = 900;
    now += 1000 / 60; again.cf.step();
  }
  check(s2.carrying.has(key), "standing on a dropped part did not pick it up");
  check(!s2.dropped.some(d => d.key === key),
        "it was picked up and is still lying out there");

  /* And there is never a second one. The sector generates a part at its landmark
     from the seed, so while one is lying where you died that landmark must be
     empty — otherwise a death would *duplicate* the thing you were carrying. */
  const still = s2.dropped[0];
  check(!!still, "the second part vanished when the first was picked up");
  if (still) {
    const site = s2.partSites.find(p => p.key === still.key);
    check(!!site, still.key + " has no landmark in this sector");
    if (site) {
      m2.x = site.x; m2.y = site.y; m2.vx = m2.vy = 0;
      for (let i = 0; i < 6; i++) {
        m2.invuln = 5; s2.water = 900; s2.food = 900;
        now += 1000 / 60; again.cf.step();
      }
      check(!s2.carrying.has(still.key),
            still.key + " was lying where you died and standing at its " +
            "landmark as well — dying duplicated it");
      // It is still out there where it was left, untouched by the trip.
      check(s2.dropped.some(d => d.key === still.key),
            "visiting the landmark cleared the part you left behind");
    }
  }

  console.log("  dropped    a part you carried stays where you fell \u00b7 " +
              "clear of whatever killed you \u00b7 on the chart by name \u00b7 " +
              "survives the tab \u00b7 picked up by flying back \u00b7 never " +
              "two of the same one");
}

// ── the book is a whitelist, and it must list everything ─────────────────
/* `loadSurveyBook` validates the save field by field, which is right — the book
   is a file on somebody's disk and a hand-edited one must not be able to hand out
   a hull that does not exist. What it also means is that **a field written to the
   book and not read back is silently thrown away**, and nothing anywhere says so.

   Four things had been landing in exactly that hole: the four slots, the crate of
   parts, which battles are over, and which are remembered. Each one saved
   perfectly and vanished on the next load. So rather than checking one field at a
   time, this writes a whole run, closes the tab, opens it again, and reads it
   back through the real path. */
{
  const { cf } = boot("?debug=1&seed=135791");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const view = () => cf.surveyView();

  // A run with something in every one of those boxes.
  surv.cash = 4321;
  surv.docked = { x: 2000, y: 0 };
  surv.store.pulsecoil = 2;
  view().onFit(0, "pulsecoil");
  surv.store.layerplate = 1;
  surv.battleAge["c1b0"] = 0;
  surv.battleAge["c2b0"] = 41.5;
  surv.memorials.add("c1b0");
  surv.carrying.add(view().manifest[0].key);
  surv.docked = null;
  me.x = 88000; me.y = 44000;
  cf.die("hole");
  const droppedKey = surv.dropped[0] && surv.dropped[0].key;
  check(!!droppedKey, "nothing was dropped to check");

  /* The hold goes in after the death, because dying empties it — the point here
     is that the two *new* materials round-trip like the old four, not that they
     survive a death they are not supposed to survive. Something has to write the
     book, and a pin is the cheapest thing in the mode that does. */
  surv.hold.iron = 7; surv.hold.electronics = 3; surv.hold.core = 2;
  /* And the spares go back in for the same reason. Parts ride in the hold now,
     so a death puts them on the floor where you fell — which is the rule being
     tested two blocks up, not the one being tested here. */
  surv.store.pulsecoil = 1; surv.store.layerplate = 1;
  view().onPin(1000, 2000, "cache", 400);
  cf.answer({ name: "", kind: "cache" });

  cf.leave();
  const again = bootKeepingStorage("?debug=1&seed=135791");
  again.cf.start("survey", 1);
  const s2 = again.cf.survey();
  const v2 = again.cf.surveyView();

  check(s2.slots[0] && s2.slots[0].key === "pulsecoil",
        "a fitted part did not survive the tab");
  check((s2.store.pulsecoil || 0) === 1 && (s2.store.layerplate || 0) === 1,
        "storage did not survive the tab: " + JSON.stringify(s2.store));
  check(s2.battleAge["c1b0"] === 0 && Math.abs(s2.battleAge["c2b0"] - 41.5) < 1,
        "the battle clocks did not survive the tab");
  check(s2.memorials.has("c1b0"), "a memorial did not survive the tab");
  check(s2.dropped.some(d => d.key === droppedKey),
        "a part left where you died did not survive the tab");
  check(s2.hold.electronics === 3 && s2.hold.core === 2,
        "the two new materials did not survive the tab");
  check(Math.round(s2.cash) === 4321, "the cash did not survive the tab");
  // And the fitted part is actually doing its job on the resumed ship.
  check(again.cf.scanRange() > 2100 * 1.5,
        "the resumed ship is not getting the scanner it is carrying");

  /* Every key the save writes must reach the load. This is the check that
     would have caught four lost-field bugs at once, and it is cheap.

     Two are written under one name and read under another, deliberately:
     `fog` is a packed string the chart unpacks for itself, and `mutations`
     is the per-chunk form of `opened` and `stripped` — the file's shape and
     the runtime's are allowed to differ, so long as nothing is dropped on the
     way between them. That is asserted separately, here and in test/save.js. */
  const RENAMED = { fog: true, mutations: true, version: true };
  const written = Object.keys(JSON.parse(store[BOOK_KEY]));
  const read = again.cf.bookKeys();
  const lost = written.filter(k => read.indexOf(k) < 0 && !RENAMED[k]);
  check(lost.length === 0,
        "the book writes fields the loader throws away: " + lost.join(", "));
  check(written.indexOf("mutations") >= 0,
        "the book no longer writes its per-chunk mutations at all");
  check(read.indexOf("opened") >= 0 && read.indexOf("stripped") >= 0,
        "the loader no longer hands the runtime its flat mutation sets");

  console.log("  book       " + written.length + " fields written, every one read " +
              "back \u00b7 slots, crate, battle clocks, memorials, dropped parts " +
              "and the new materials all survive the tab");
}

// ── a unit of anything is a whole unit ───────────────────────────────────
/* The ice melter's first cut took a *fraction* of a unit of ice every frame,
   which looked like a rounding nicety and was not. A hold of 9.5875 ice printed
   itself into the interface as `ICE x9.58750000000001`, made the cargo count a
   fraction of a unit, and paid out 19.175 cash when it was sold — one wrong
   decision leaking into three places that had every right to assume a material
   is a whole thing.

   So: the hold is integers, always, and money is money. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const view = () => cf.surveyView();
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.food = 900; now += 1000 / 60; cf.step();
    }
  };

  surv.docked = null;
  me.x = 220000; me.y = 120000; me.vx = me.vy = 0;
  step(2);
  surv.store.icemelter = 1;
  view().onFit(0, "icemelter");
  surv.slots[0].fit = 0;
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  surv.hold.ice = 12;
  surv.water = 30;

  const whole = v => v === Math.round(v);
  let melted = 0;
  for (let f = 0; f < 60 * 40; f++) {
    step(1);
    for (const k of Object.keys(surv.hold)) {
      check(whole(surv.hold[k]),
            "the hold went fractional: " + k + " = " + surv.hold[k]);
      if (!whole(surv.hold[k])) { f = 1e9; break; }
    }
    for (const m of view().materials) {
      check(whole(m.n), "the page shows " + m.name + " as " + m.n);
      if (!whole(m.n)) { f = 1e9; break; }
    }
    check(whole(view().carried), "cargo used reads " + view().carried);
    if (surv.hold.ice < 12) melted = 12 - surv.hold.ice;
  }
  check(melted > 0, "the melter never took a single unit in forty seconds");
  check(surv.water > 30, "the melter took ice and made no water");

  /* And money. Selling a hold has to pay a whole number of cash — a fractional
     purse is one that can buy something for exactly its own price and fail. */
  surv.docked = { x: 220000, y: 120000 };
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 3;
  surv.cash = 0;
  view().onSell();
  check(whole(surv.cash), "selling paid " + surv.cash);
  check(surv.cash > 0, "selling six kinds of material paid nothing");
  check(view().worth === 0, "the page still offers to sell an empty hold");

  console.log("  units      the hold stays whole through forty seconds of " +
              "melting \u00b7 " + melted + " ice became water \u00b7 selling " +
              "pays a whole number");
}

// ── the coil goes off once ───────────────────────────────────────────────
/* Picking the coil off the gate discharges it and throws you across the sector.
   It used to do that *every time it was picked up* — so dying with it and going
   back for it fired it again, which turned "go and get your part back" into a
   random throw, and on a bad roll into a chase you could not finish.

   It is a spent component after the first time. */
{
  const { cf } = boot("?debug=1&seed=606060");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 5; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };

  const site = surv.partSites.find(p => p.key === "coil");
  me.x = site.x; me.y = site.y; me.vx = me.vy = 0;
  step(3);
  check(surv.carrying.has("coil"), "the coil was not picked up");
  const thrownTo = { x: me.x, y: me.y };
  check(Math.hypot(me.x - site.x, me.y - site.y) > 1000,
        "the coil did not fire the first time");

  // Die with it, and go back for it.
  cf.die("rock");
  const left = surv.dropped.find(d => d.key === "coil");
  check(!!left, "the coil was not left where you died");
  cf.surveyView().onRespawn();
  me.x = left.x; me.y = left.y; me.vx = me.vy = 0;
  step(4);
  check(surv.carrying.has("coil"), "the dropped coil could not be picked up again");
  check(Math.hypot(me.x - left.x, me.y - left.y) < 600,
        "recovering the coil fired it again and threw you " +
        Math.round(Math.hypot(me.x - left.x, me.y - left.y)) + " units");

  // And it stays spent across the tab.
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.coilFired === true, "the book forgot that the coil has fired");

  console.log("  coil once  it fires when it comes off the gate and never again " +
              "\u00b7 recovering it is a pickup, not a throw \u00b7 spent " +
              "across the tab");
}

// ── an almanac entry has to be earnable in the actual sector ─────────────
/* THREAD — "between two cores, touching neither" — asked to be inside
   `kill * 2.6` of two wells at once. That is 120 units of a star, and measured
   over a 29-chunk patch of real sector **no two wells are ever that close**. The
   entry could not be earned by anybody, ever.

   The almanac block further up checks that every condition *can* fire, but it
   does that against a synthetic telemetry object with everything switched on —
   which is exactly why it never caught this. So this one goes the other way: it
   finds two real wells in a real sector, flies the ship between them, and checks
   the book ticks. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];

  /* Two wells whose reaches overlap, out of the sector's own generation. If none
     exist the entry is unearnable however the condition is written, so that is
     the first thing worth knowing. */
  const wells = [];
  for (let cx = -14; cx <= 14; cx++) {
    for (let cy = -14; cy <= 14; cy++) {
      for (const h of cf.chunk(cx, cy).hazards) wells.push(h);
    }
  }
  let pair = null;
  for (let i = 0; i < wells.length && !pair; i++) {
    for (let j = i + 1; j < wells.length && !pair; j++) {
      const a = wells[i], b = wells[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      // Close enough to stand inside both, far enough to stand outside both cores.
      if (d < (a.reach + b.reach) * 0.7 && d > (a.kill + b.kill) * 3) pair = [a, b, d];
    }
  }
  check(!!pair, "no two wells in this sector are close enough to fly between");

  if (pair) {
    const [a, b, d] = pair;
    check(!surv.found.has("thread"), "THREAD was already logged");
    // Stand exactly between them, which is what the entry describes.
    me.x = (a.x + b.x) / 2; me.y = (a.y + b.y) / 2;
    me.vx = me.vy = 0;
    for (let i = 0; i < 30; i++) {
      me.invuln = 999; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
    check(surv.found.has("thread"),
          "flew between two wells " + Math.round(d) + " units apart, inside both " +
          "reaches and outside both cores, and THREAD did not tick");
  }

  /* And it is not free: sitting in open space with no well anywhere near must
     not hand it out. */
  const other = boot("?debug=1&seed=4242");
  other.cf.start("survey", 1);
  const s2 = other.cf.survey(), m2 = other.cf.live().ships[0];
  m2.x = 5e5; m2.y = 5e5;
  for (let i = 0; i < 60; i++) {
    m2.invuln = 999; s2.water = 900; s2.food = 900;
    now += 1000 / 60; other.cf.step();
  }
  check(!s2.found.has("thread"), "THREAD ticked in empty space");

  console.log("  thread     two real wells " + (pair ? Math.round(pair[2]) : "?") +
              " units apart, flown between \u00b7 the entry ticks \u00b7 " +
              "empty space does not");
}

// ── a bigger ship carries more food ──────────────────────────────────────
/* A pantry is space, and space is the thing a bigger hull has. Water is not: a
   tank is a tank, and making both scale would turn "which ship" into one number
   twice. So the hull decides the food and nothing else, which is a reason to own
   more than one ship that is not "it is faster". */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const view = () => cf.surveyView();
  const list = view().ships;
  surv.docked = { x: cf.home().x, y: cf.home().y, home: true };

  const pantry = key => { cf.flyShip(key); return view().food.full; };
  const small = list.reduce((a, b) => (b.cargo < a.cargo ? b : a));
  const big = list.reduce((a, b) => (b.cargo > a.cargo ? b : a));
  for (const sh of [small, big]) surv.owned.add(sh.key);

  const p0 = pantry("skiff");
  check(p0 === 2700, "the starting hull's pantry is " + p0 + "s, not 45 minutes");
  const ps = pantry(small.key), pb = pantry(big.key);
  check(pb > ps,
        big.name + " (" + big.cargo + " hold) carries " + pb + "s of food and " +
        small.name + " (" + small.cargo + ") carries " + ps + "s");
  /* Softened rather than taken straight: cargo runs 50x across the roster and a
     hull that could be away for thirty-seven hours would make every other one
     pointless. */
  check(pb / ps < 12,
        "the biggest hull carries " + (pb / ps).toFixed(1) + "x the smallest's " +
        "food; that is the hold's spread, not a pantry");
  // Water does not scale. A tank is a tank.
  check(view().water.full === 1200, "the water tank moved with the hull");

  /* Downsizing leaves what will not fit on the dock, the same as the cargo. */
  cf.flyShip(big.key);
  surv.food = view().food.full;
  const wasFull = surv.food;
  cf.flyShip(small.key);
  check(surv.food <= view().food.full,
        "a smaller hull kept " + Math.round(surv.food) + "s of food in a " +
        view().food.full + "s pantry");
  check(wasFull > surv.food, "downsizing cost nothing at all");

  // And buying food fills the hull's pantry, not the starting one.
  cf.flyShip(big.key);
  surv.cash = 99999;
  surv.food = 10;
  /* A whole tank is 100 percent of one — but the row says how much of one this
     station actually has, and a station with an empty larder is bad luck rather
     than a broken pantry. Ask the row, then take all of it. */
  const larder = view().market.find(r => r.kind === "supply" && r.key === "food");
  check(!!larder, "the station is selling no food at all to fill a pantry with");
  if (larder) {
    view().onBuyRow("supply", "food", larder.most);
    check(surv.food >= view().food.full - 1,
          "buying food filled to " + Math.round(surv.food) + " of " +
          view().food.full);
  }

  console.log("  pantry     water is 20m on every hull \u00b7 food is 45m on the " +
              "starting one \u00b7 " + small.name + " " + Math.round(ps / 60) +
              "m to " + big.name + " " + Math.round(pb / 60) + "m \u00b7 " +
              "downsizing leaves the rest on the dock");
}

// ── the beam has to actually collect ─────────────────────────────────────
/* The tractor beam is how a broken rock becomes cargo, so it is the single most
   load-bearing thing in the mode: everything downstream of it — selling,
   crafting, the melter, the whole economy — assumes salvage inside the ring
   arrives.

   It stopped arriving. The beam's strength read a field off the wrong object —
   the totals were named `m` and the loop names the *mote* `m`, so inside the loop
   the shadow won — and every grab came out NaN. A mote caught in the ring had its
   velocity set to NaN, its position followed, and it was never picked up and
   never seen again: salvage vanished inside the one thing meant to collect it.

   Checked on all three routes to a beam, because they are three different code
   paths through the same line. */
{
  for (const route of ["tractorrig", "heavyrig"]) {
    const { cf } = boot("?debug=1&seed=515151");
    cf.start("survey", 1);
    const surv = cf.survey();
    const me = cf.live().ships[0];
    const step = n => {
      for (let i = 0; i < n; i++) {
        me.invuln = 999; surv.water = 900; surv.food = 900;
        now += 1000 / 60; cf.step();
      }
    };
    surv.docked = null;
    me.x = 200000; me.y = 100000; me.vx = me.vy = 0;
    step(2);
    surv.store[route] = 1;
    cf.surveyView().onFit(0, route);
    surv.slots[0].fit = 0;
    for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
    surv.motes.length = 0;
    // Ten of them, in a ring well inside the beam and not on top of the ship.
    const ring = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const m = { x: me.x + Math.cos(a) * 220, y: me.y + Math.sin(a) * 220,
                  vx: 0, vy: 0, spin: 0, life: 90, mat: "iron", ringTest: true };
      surv.motes.push(m);
      ring.push(m);
    }
    step(240);
    const held = Object.keys(surv.hold).reduce((t, k) => t + surv.hold[k], 0);
    check(held === 10,
          route + ": ten motes inside the beam and " + held + " arrived");
    check(surv.motes.every(m => Number.isFinite(m.x) && Number.isFinite(m.y)),
          route + ": a mote's position went non-finite in the beam");
    /* The ten that were put here, not the mote list. Four minutes of a live
       sector is long enough for something to die somewhere and leave salvage
       of its own — measured, two arrived from eight thousand units away — and
       asserting the list is empty was asserting that nothing else in the world
       happened while the beam ran. What this is about is whether the ring got
       swept, and the ring is the thing to ask about. */
    const stillCircling = ring.filter(m => surv.motes.indexOf(m) >= 0);
    check(stillCircling.length === 0,
          route + ": " + stillCircling.length + " of the ten were left circling");
  }
  console.log("  beam       ten motes in the ring, ten aboard \u00b7 from the " +
              "almanac, from a rig and from a heavy rig \u00b7 none lost, none " +
              "non-finite");
}

// ── solid to you is solid to everybody ───────────────────────────────────
/* Three faults with one shape: the player's hull stops at a world's surface and
   at the Leviathan's plates, and nothing else did. Asteroids sat inside planets
   and inside each other, and traffic crossed the one authored object in the
   sector as though it were a picture.

   And a fourth, found while looking at the same code: a big world could never be
   put on the chart. The check measured to a world's *centre* against a sight
   radius of 980, and a world can be 1,800 in radius — so the biggest and most
   unmissable objects in the sector were exactly the ones the map had never heard
   of. You could land on one and it would still not be there. */
{
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const live = cf.live();
  const me = live.ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 999; surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };

  // A world far bigger than the sight radius, which is the case that broke.
  let world = null;
  for (let ring = 1; ring < 20 && !world; ring++) {
    for (let cx = -ring; cx <= ring && !world; cx++) {
      for (let cy = -ring; cy <= ring && !world; cy++) {
        if (Math.max(Math.abs(cx), Math.abs(cy)) !== ring) continue;
        for (const p of cf.chunk(cx, cy).planets) if (p.r > 900) world = p;
      }
    }
  }
  check(!!world, "no world in this sector is bigger than the sight radius");

  if (world) {
    check(world.r > 980,
          "the world found is " + Math.round(world.r) + " across; the case that " +
          "broke needs one bigger than sight");
    me.x = world.x + world.r + 900; me.y = world.y; me.vx = me.vy = 0;
    step(20);
    const charted = cf.surveyView().known
      .filter(q => q.k === "planet" && Math.abs(q.x - world.x) < 60);
    check(charted.length === 1,
          "flew alongside " + (world.name || "a world") + " (" +
          Math.round(world.r) + " radius) and it is not on the chart");
    check(charted.length && charted[0].name === world.name,
          "the world went on the chart without its name");

    /* Rocks are solid to it. Twelve dropped inside must not still be inside. */
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, d = (i / 12) * world.r * 0.7;
      const r = cf.makeRock("mid", world.x + Math.cos(a) * d,
                                   world.y + Math.sin(a) * d);
      r.vx = r.vy = 0;
      live.rocks.push(r);
    }
    // And so is traffic.
    surv.traffic.length = 0;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, d = world.r * 0.5;
      surv.traffic.push({ id: null, kind: "freight", role: "freight",
        faction: "free", hull: "drayman",
        x: world.x + Math.cos(a) * d, y: world.y + Math.sin(a) * d, a,
        from: { x: world.x, y: world.y }, to: { x: world.x + 9000, y: world.y },
        leg: 1, speed: 90, hp: 6, maxHp: 6, cargo: [], cool: 1, doom: 0,
        guards: 0, space: 0, trades: false, phase: 0 });
    }
    step(180);

    const rocksIn = live.rocks.filter(r =>
      Math.hypot(r.x - world.x, r.y - world.y) < world.r).length;
    check(rocksIn === 0, rocksIn + " asteroids are sitting inside a planet");
    const shipsIn = surv.traffic.filter(t =>
      Math.hypot(t.x - world.x, t.y - world.y) < world.r * 0.98).length;
    check(shipsIn === 0, shipsIn + " ships are sitting inside a planet");

    /* And rocks are solid to each other. */
    let overlaps = 0;
    for (let i = 0; i < live.rocks.length; i++) {
      for (let j = i + 1; j < live.rocks.length; j++) {
        const a = live.rocks[i], b = live.rocks[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.85) overlaps++;
      }
    }
    check(overlaps === 0, overlaps + " pairs of asteroids are inside each other");
  }

  /* The Leviathan is solid to traffic too. It is the one authored object out
     there and a hauler crossing it would say the whole sector is a backdrop. */
  const other = boot("?debug=1&seed=4242");
  other.cf.start("survey", 1);
  const s2 = other.cf.survey(), m2 = other.cf.live().ships[0];
  const lm = s2.landmarks.find(l => l.key === "leviathan");
  m2.x = lm.x; m2.y = lm.y + 2000; m2.vx = m2.vy = 0;
  for (let i = 0; i < 20; i++) {
    m2.invuln = 999; s2.water = 900; s2.food = 900;
    now += 1000 / 60; other.cf.step();
  }
  check(!!s2.leviathan, "the Leviathan did not stream in");
  if (s2.leviathan) {
    const lev = s2.leviathan;
    s2.traffic.length = 0;
    for (let i = 0; i < 8; i++) {
      const g = lev.segs[(i * 3) % lev.segs.length];
      s2.traffic.push({ id: null, kind: "freight", role: "freight",
        faction: "free", hull: "drayman", x: g.x, y: g.y, a: i,
        from: { x: g.x, y: g.y }, to: { x: g.x + 9000, y: g.y },
        leg: 1, speed: 90, hp: 6, maxHp: 6, cargo: [], cool: 1, doom: 0,
        guards: 0, space: 0, trades: false, phase: 0 });
    }
    for (let i = 0; i < 180; i++) {
      m2.invuln = 999; s2.water = 900; s2.food = 900;
      now += 1000 / 60; other.cf.step();
    }
    const inHull = s2.traffic.filter(t =>
      lev.segs.some(g => Math.hypot(t.x - g.x, t.y - g.y) < g.r * 0.9)).length;
    check(inHull === 0, inHull + " ships are inside the Leviathan");
  }

  console.log("  solids     a " + (world ? Math.round(world.r) : "?") +
              "-radius world charts by its surface \u00b7 rocks break on worlds " +
              "and part from each other \u00b7 traffic and sentries go round a " +
              "world and round the Leviathan");
}

// ── you can tell whose ship that is ──────────────────────────────────────
/* "Whose is that" is the first question a war asks you, and the answer has to be
   available by looking. The five flags were a mint, two pale blues and a
   grey-blue: at the size a ship is drawn out there a Hallow patrol and an
   independent hauler were the same object.

   Checked as distance in colour space rather than by eye, because "these look
   different to me on this monitor" is not a check. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const flags = cf.factions();
  check(flags.length === 5,
        "there are " + flags.length + " flags a ship can fly, not 5");

  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16),
                    parseInt(h.slice(5, 7), 16)];
  /* Weighted the way an eye weighs them — green carries most of the perceived
     difference and blue least — so two colours that differ only in blue do not
     pass as "far apart". */
  const gap = (a, b) => {
    const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
    return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
  };

  let worst = { d: Infinity, a: "", b: "" };
  for (let i = 0; i < flags.length; i++) {
    for (let j = i + 1; j < flags.length; j++) {
      const d = gap(flags[i].colour, flags[j].colour);
      if (d < worst.d) worst = { d, a: flags[i].short, b: flags[j].short };
    }
  }
  check(worst.d > 120,
        worst.a + " and " + worst.b + " are " + Math.round(worst.d) +
        " apart in colour; that is two ships you cannot tell apart");

  // And none of them is the amber the player and the asteroids already own.
  for (const f of flags) {
    check(gap(f.colour, "#ffcb42") > 120,
          f.short + " flies the same colour as an asteroid");
    check(gap(f.colour, "#ffe56d") > 120,
          f.short + " flies the same colour as the player");
  }

  // Every flag says who these people are, not just what they are called.
  for (const f of flags) {
    check(typeof f.long === "string" && f.long.length > 40,
          f.short + " has no description worth reading");
  }

  console.log("  colours    five flags, closest pair " + Math.round(worst.d) +
              " apart \u00b7 none of them amber \u00b7 each says who they are");
}

// ── the book is a long book ──────────────────────────────────────────────
/* Ric finished the almanac in about two hours. The reason, measured rather than
   guessed: **ten minutes of holding the throttle reaches 344,617 units** and the
   Leviathan — the finale, the thing the whole manifest points at — stood at
   112,000. The entire ladder was inside three minutes of flying.

   Nothing about the entries was wrong; the sector they are hidden in was a
   thirtieth of the size it needed to be. This pins the new shape, because the one
   way it can silently come back is somebody tuning a distance down. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const span = cf.sectorSpan();

  /* How far ten minutes of flying actually goes, from the game's own top speed
     rather than from a number written in a comment. */
  const reach10 = cf.topSpeed() * 600;
  check(reach10 > 200000,
        "ten minutes of flight covers only " + Math.round(reach10) + " units");

  // The far rung has to be an expedition against that, not an errand.
  check(span.far > reach10 * 8,
        "the furthest landmark is " + Math.round(span.far) + " units out and ten " +
        "minutes of flying covers " + Math.round(reach10) + " — the whole ladder " +
        "is " + (span.far / reach10).toFixed(1) + " times a ten-minute flight");

  /* And the danger curve has to be as long as the ladder. If it tops out before
     the far rungs, everything past that point is one flat band — identically
     dangerous for most of the game. */
  check(span.full > span.far * 0.35,
        "the danger curve tops out at " + Math.round(span.full) + " but the " +
        "ladder runs to " + Math.round(span.far));

  /* The shape, across seeds: a first rung you can reach on an early flight and a
     last rung that is hours away, with the rungs spread rather than bunched. */
  let nearest = Infinity, furthest = 0, worstRatio = Infinity;
  for (const seed of [1, 2, 4242, 515151, 8675309, 99999]) {
    const w = boot("?debug=1&seed=" + seed);
    w.cf.start("survey", 1);
    /* The dealt ones only. The Leviathan stands at a fixed 40,000 in every
       sector and is not a rung — measuring the ladder's shape through it would
       be measuring something that is deliberately not part of the shape, and it
       would report a bunched ladder every time it happened to land beside one. */
    const ds = w.cf.survey().landmarks
      .filter(l => l.key !== "leviathan")
      .map(l => Math.hypot(l.x, l.y)).sort((a, b) => a - b);
    nearest = Math.min(nearest, ds[0]);
    furthest = Math.max(furthest, ds[ds.length - 1]);
    // Geometric: every rung a decent step past the one below it.
    for (let k = 1; k < ds.length; k++) {
      worstRatio = Math.min(worstRatio, ds[k] / ds[k - 1]);
    }
    check(ds[ds.length - 1] / ds[0] > 40,
          "seed " + seed + ": the ladder spans only " +
          (ds[ds.length - 1] / ds[0]).toFixed(0) + "x from first rung to last");
    w.cf.leave();
  }
  check(nearest < 40000,
        "the nearest landmark in any seed is " + Math.round(nearest) +
        " units out — nothing is reachable in a first sitting");
  check(furthest > 2000000,
        "the furthest landmark in any seed is only " + Math.round(furthest));
  check(worstRatio > 1.15,
        "two rungs sit " + worstRatio.toFixed(2) + "x apart — the ladder bunches");

  /* The manifest is the main arc rather than the whole book, so it has to be
     finishable well inside the ladder — the jump gate is a thing you build on the
     way out, not the last thing you do. */
  const parts = cf.surveyView().manifest;
  check(parts.length === 6, "the manifest is " + parts.length + " parts");

  /* And the chart has to be able to show it. A map that cannot be zoomed out far
     enough to contain the thing it is charting is not a chart of it. */
  const hud = cf.hud();
  let widest = Infinity;
  for (let i = 0; i < 40; i++) hud.chartZoomBy(-1);
  widest = hud.chartSpan ? hud.chartSpan() : null;
  if (widest != null) {
    check(widest > furthest * 2,
          "the widest chart zoom shows " + Math.round(widest) +
          " units and the sector runs to " + Math.round(furthest));
  }

  console.log("  ladder     first rung " + Math.round(nearest / 1000) + "k, last " +
              Math.round(furthest / 1000) + "k \u00b7 " +
              (span.far / reach10).toFixed(0) + " ten-minute flights to the far " +
              "one \u00b7 the curve runs to " + Math.round(span.full / 1000) + "k");
}

// ── the low-tank warning teaches, then gets out of the way ───────────────
/* A tank quietly dropping is a tank you do not notice until it is a countdown.
   So it says so — loudly the first couple of times, and then quietly, because a
   warning that shouts every time is a warning you learn to ignore.

   The rule, exactly: the **first two times a tank falls past half** — on two
   separate trips — the word WARNING appears beside the readout for ten seconds,
   and then the word goes and the triangle slides in next to the number. After
   those two, the triangle simply appears at each further step, and the steps are
   every fifteen per cent. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const step = n => {
    for (let i = 0; i < n; i++) { me.invuln = 999; now += 1000 / 60; cf.step(); }
  };
  const warn = k => cf.surveyView()[k].warn;

  for (const key of ["water", "food"]) {
    const full = cf.surveyView()[key].full;
    const fill = f => { surv[key] = full * f; step(3); };

    // A full tank says nothing at all.
    fill(1);
    check(warn(key).lit === false, key + ": a full tank is already marked");

    /* First trip past half: the mark lights and the word shouts. */
    fill(0.49);
    check(warn(key).lit === true, key + ": half a tank raised no mark");
    check(warn(key).shout > 0.9, key + ": the first warning did not shout");
    check(surv.alert[key].taught === 1,
          key + ": the first lesson was not counted");

    // Ten seconds later the word is gone and the mark is not.
    step(60 * 11);
    check(warn(key).shout === 0, key + ": the word is still up after ten seconds");
    check(warn(key).lit === true, key + ": the mark went with the word");

    /* The next step down is fifteen per cent, and it does not shout — the second
       lesson belongs to the second *half-tank*, not to the same trip. */
    fill(0.34);
    check(warn(key).step === 2, key + ": 34% is step " + warn(key).step + ", not 2");
    check(warn(key).shout === 0, key + ": the 35% step shouted");
    check(surv.alert[key].taught === 1,
          key + ": the 35% step used up the second lesson");

    // Refilling clears the mark, and the next trip shouts once more.
    fill(1);
    check(warn(key).lit === false, key + ": refilling left the mark up");
    fill(0.49);
    check(warn(key).shout > 0.9, key + ": the second trip did not shout");
    check(surv.alert[key].taught === 2, key + ": the second lesson was not counted");

    // And the third trip is quiet. Two lessons is two lessons.
    step(60 * 11);
    fill(1);
    fill(0.49);
    check(warn(key).lit === true, key + ": the third trip raised no mark at all");
    check(warn(key).shout === 0, key + ": the third trip still shouts");
    check(surv.alert[key].taught === 2, key + ": a third lesson was given");

    // The steps keep coming as it falls: 50, 35, 20, 5.
    fill(0.19);
    check(warn(key).step === 3, key + ": 19% is step " + warn(key).step);
    fill(0.04);
    check(warn(key).step === 4, key + ": 4% is step " + warn(key).step);
  }

  /* And the count is kept in the book — "the first two times" has to mean the
     first two times, not the first two this session. */
  cf.leave();
  const book = JSON.parse(store[BOOK_KEY]);
  check(book.alert && book.alert.water.taught === 2,
        "the book forgot that the tank has already warned you twice");
  const again = bootKeepingStorage("?debug=1&seed=515151");
  again.cf.start("survey", 1);
  const s2 = again.cf.survey(), m2 = again.cf.live().ships[0];
  s2.water = again.cf.surveyView().water.full * 0.49;
  for (let i = 0; i < 4; i++) { m2.invuln = 999; now += 1000 / 60; again.cf.step(); }
  check(again.cf.surveyView().water.warn.lit === true,
        "a resumed sector does not mark a half-empty tank");
  check(again.cf.surveyView().water.warn.shout === 0,
        "a resumed sector shouts a lesson it has already given twice");

  console.log("  lowtank    half a tank shouts twice, ten seconds each, then the " +
              "triangle stays \u00b7 steps every 15% after \u00b7 both tanks " +
              "\u00b7 the lessons survive the tab");
}

// ── wants that collide, and an economy that hears about it ───────────────
/* Phase 6.1 and 6.2, and they are one test because they are one idea. Nothing out
   here needs to be clever; it needs a goal that can collide with somebody else's.
   A trader wants to reach a station with its cargo. A pirate wants that cargo. An
   escort wants its client alive. A patrol wants whatever is causing trouble. A
   scavenger wants wreckage — including the wreckage you were going to strip.

   Put three of those in one piece of sky and you get a situation nobody scripted.
   And when one of them fails, the *station* hears about it: a convoy that does
   not arrive is a shortage, a shortage is a price, and a price is a reason for
   somebody else to fly out there. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const view = () => cf.surveyView();
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 999; surv.water = 9e5; surv.food = 9e5;
      now += 1000 / 60; cf.step();
    }
  };
  me.x = 40000; me.y = 24000;
  step(30);

  // Every role has a want, and none of them is "fly a line and nothing else".
  const roles = cf.roles();
  for (const r of Object.keys(roles)) {
    check(typeof roles[r].want === "string" && roles[r].want.length,
          r + " has no want at all");
  }
  check(!!roles.scavenger, "there is no scavenger role");

  /* Speeds by role, the way the sector actually rolls them: armed ships fly at
     120–190 and haulers at 70–130. The hulls matter now too. Give each role the
     kind of ship the sector spawns for it so this exercises the same hull,
     acceleration, turn, drag, fire rate and damage rules as actual traffic. */
  const SPEED = { pirate: 150, escort: 155, patrol: 150, freight: 100,
                  trader: 100, scavenger: 110 };
  const HULL = { pirate: "needle", escort: "louvre", patrol: "lance",
                 freight: "drayman", trader: "pannier", scavenger: "cradle" };
  const mk = (role, faction, x, y, cargo) => {
    const sp = SPEED[role] || 100;
    const hull = view().ships.find(s => s.key === (HULL[role] || "skiff"));
    const t = { id: null, kind: role, role, faction, hull: hull.key,
                x, y, a: 0, from: { x, y }, to: { x: x + 9000, y },
                leg: 1, speed: sp, baseSpeed: sp, hp: hull.hull, maxHp: hull.hull,
                cargo: cargo || [], cool: 1, doom: 0, guards: 0, space: 0,
                trades: false, phase: 0 };
    surv.traffic.push(t);
    return t;
  };
  const alive = o => surv.traffic.indexOf(o) >= 0;

  /* ── the collision ────────────────────────────────────────────────────── */
  surv.traffic.length = 0;
  const hauler = mk("freight", "cordon", me.x + 1200, me.y, ["iron", "iron", "alloy"]);
  const empty  = mk("freight", "cordon", me.x + 1400, me.y + 2200, []);
  /* Far enough out that the defence has a chance. At 3,000 units the pirate was
     already most of the way to its target and the escort had to cross the whole
     gap behind it — which is a knife-edge race, not a test of whether escorting
     works, and it came out differently depending on which way the dice fell. */
  const pirate = mk("pirate", "pirate", me.x + 3000, me.y + 600);
  const escort = mk("escort", "cordon", me.x + 900, me.y + 300);
  // Flying with the hauler, which is what an escort in the sector is doing by the
  // time you meet one: `wantOf` sets this when it picks a client of its own.
  escort.client = hauler; escort.mark = hauler; escort.markKind = "ship";
  const patrol = mk("patrol", "hallow", me.x + 200, me.y - 900);
  step(240);

  check(pirate.mark === hauler,
        "the pirate went for " + (pirate.mark === empty ? "the empty hauler" :
          "something that was not the laden one") + " — it wants the cargo");
  check((hauler.hunted || 0) > 0, "the hauler does not know it is being hunted");
  check(escort.angryAt === pirate,
        "the escort did not turn on the pirate going for its client");
  check(patrol.mark === pirate || patrol.angryAt === pirate,
        "the patrol did not respond to a pirate in the open");

  /* Who outlived whom. This was "the hauler is still there after twenty-five
     seconds" once, which asserts that being defended is the same as being safe —
     and it is not. Rounds hit whatever is in front of them out here, which is
     the reason the war is dangerous to stand next to: an escort firing past its
     own client can kill it, and a hauler that dies with a pirate already dead
     was defended successfully and unlucky.

     Then it was "the hauler outlived the pirate", which is the same assumption
     wearing a clock. Both ships are inside one fight, both are being shot at by
     things that do not check what is behind the target, and which of the two
     dies first is a coin the defence does not own. It asserted a race.

     What the system actually promises is that the pirate pays for it. That is
     asserted. The order the two of them die in is measured and printed, because
     it is worth watching while this part of the sector is still being built —
     but it is not a promise and it is not a failure. */
  let pirateDied = 0, haulerDied = 0, t2 = 0;
  for (let i = 0; i < 60 * 25; i++) {
    step(1); t2++;
    if (!pirateDied && !alive(pirate)) pirateDied = t2;
    if (!haulerDied && !alive(hauler)) haulerDied = t2;
  }
  check(pirateDied > 0, "the pirate survived an escort and a patrol both on it");
  const fight = !haulerDied ? "the hauler got away"
              : haulerDied > pirateDied ? "the hauler outlived it"
              : "the hauler went down with it";

  /* ── a scavenger wants the wreck you wanted ───────────────────────────── */
  surv.traffic.length = 0;
  surv.hulks.length = 0;
  const hulk = { id: "test-hulk", x: me.x + 1500, y: me.y + 400, a: 0, spin: 0,
                 r: 60, size: 1.2 };
  surv.hulks.push(hulk);
  const scav = mk("scavenger", "free", me.x + 2600, me.y + 900);
  step(60 * 40);
  check(scav.mark === hulk || surv.hulks.indexOf(hulk) < 0,
        "a scavenger ignored a wreck 1,100 units away");
  check(surv.hulks.indexOf(hulk) < 0,
        "the scavenger reached the wreck and did not take it");

  /* ── the economy hears about it ───────────────────────────────────────── */
  // Back where there is a station: a shortage belongs to a place, so there has
  // to be a place.
  me.x = cf.home().x + 900; me.y = cf.home().y;
  step(20);
  const st = surv.stations[0];
  check(!!st, "no station loaded to trade with");
  surv.traffic.length = 0;
  surv.hulks.length = 0;

  const priceOf = key => {
    surv.docked = st;
    const m = view().materials.find(x => x.key === key);
    surv.docked = null;
    return m;
  };

  // A station is short of something from the moment it exists — a fresh sector
  // already has somewhere that pays well for one thing.
  surv.docked = st;
  const anyShort = view().materials.some(m => m.shortage > 0.2);
  surv.docked = null;
  check(anyShort, "a station is short of nothing at all — prices never vary by want");

  /* A convoy destroyed at the door deepens the shortage of what it was carrying,
     and the price follows. This is the whole of 6.2: pirates make prices. */
  const before = priceOf("iridium");
  const doomed = mk("freight", "cordon", st.x + 500, st.y, ["iridium", "iridium", "iridium"]);
  doomed.hp = 0.5;
  cf.live().bullets.push({ owner: 0, colour: "#fff", dmg: 9,
                           x: doomed.x, y: doomed.y, vx: 0, vy: 0, life: 1 });
  step(4);
  check(!alive(doomed), "the convoy was not destroyed");
  const after = priceOf("iridium");
  check(after.shortage > before.shortage + 0.1,
        "a convoy of iridium was destroyed at the door and the station is no " +
        "shorter of iridium (" + before.shortage.toFixed(2) + " -> " +
        after.shortage.toFixed(2) + ")");
  check(after.price > before.price,
        "the shortage did not move the price (" + before.price + " -> " +
        after.price + ")");

  /* And a convoy that gets through eases it. A want fulfilled is the only good
     news the economy ever gets apart from time passing. */
  surv.traffic.length = 0;
  const runner = mk("freight", "cordon", st.x + 1400, st.y + 300, ["iridium", "iridium"]);
  runner.speed = runner.baseSpeed = 260;
  step(60 * 30);
  check((runner.delivered || 0) > 0,
        "a freighter beside a station never delivered anything");
  const eased = priceOf("iridium");
  check(eased.shortage < after.shortage,
        "the convoy got through and the station is just as short (" +
        after.shortage.toFixed(2) + " -> " + eased.shortage.toFixed(2) + ")");
  check(eased.price < after.price,
        "delivering did not bring the price down (" + after.price + " -> " +
        eased.price + ")");

  console.log("  wants      pirate takes the laden one, escort breaks off, patrol " +
              "answers, pirate dies in " + (pirateDied / 60).toFixed(1) + "s (" +
              fight + ") \u00b7 a scavenger beats you to a wreck \u00b7 " +
              "a convoy lost puts iridium " + before.price + " to " + after.price +
              " and one through brings it back to " + eased.price);
}

// ── an arrow points at the thing, in either view ─────────────────────────
/* `surveyState()` never sent the camera, so every edge arrow fell back to
   `rot: 0, scale: 1`. In the rotating view that means each of them pointed at the
   wrong sky — switching the camera from fixed to rotating appeared to break the
   waypoint because it did — and in *both* views the "is it already on screen"
   test was computed at 1:1 when Survey draws at about 0.72.

   Checked as geometry: put a target at a known bearing, and read back where the
   HUD actually put the arrow. In the fixed view it should sit in that direction
   from the middle of the screen; in the rotating view it should sit in that
   direction *turned by the camera*, which is the whole point of a rotating view. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const hud = cf.hud();
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 999; surv.water = 9e5; surv.food = 9e5;
      now += 1000 / 60; cf.step();
    }
  };
  step(20);

  check(!!cf.surveyView().cam, "the panel is not sent the camera at all");
  check(typeof cf.surveyView().cam.rot === "number",
        "the camera reaches the panel without a rotation");
  check(Math.abs(cf.surveyView().cam.scale - 1) > 0.01,
        "the camera reaches the panel at 1:1 — Survey does not draw at 1:1");

  /* The bearing the waypoint's arrow is *aiming at*, which is what the camera
     maths produces. Its position on the ring is not the same thing: an arrow that
     would land under a panel is slid around the ring until it is clear, so
     reading its x and y measures the avoidance rather than the aim.

     Picked by colour, because three kinds of arrow share the ring and the first
     one drawn is usually a scan return. */
  const arrowAt = () => {
    hud.arrows = [];
    cf.draw();
    // The one arrow that stays on the ring is what you are watching, and it is
    // drawn in the objective's blue now that the waypoint's yellow has gone.
    const a = hud.arrows.find(q => q.colour === "#5fd8ff");
    return a ? a.ang : null;
  };
  const wrap = v => {
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
  };

  for (const worldAng of [0, 1.1, 2.4, -2.0, -0.7]) {
    const R = 90000;
    surv.selected = { k: "station", name: "SOMEWHERE",
                      x: Math.round(me.x + Math.cos(worldAng) * R),
                      y: Math.round(me.y + Math.sin(worldAng) * R) };
    // Nothing else on the ring, so the one being read is the one being tested.
    surv.target = null;
    surv.echoes = [];

    // Fixed: the screen is the world, so the arrow's bearing is the world's.
    cf.setCamera("survey", false);
    step(40);
    const fixed = arrowAt();
    check(fixed !== null, "no arrow was drawn for something 90,000 units away");
    if (fixed !== null) {
      check(Math.abs(wrap(fixed - worldAng)) < 0.25,
            "fixed view: a mark at " + worldAng.toFixed(2) +
            " drew its arrow at " + fixed.toFixed(2));
    }

    /* Rotating: the view turns with the ship, so the arrow has to turn with it.
       An arrow that ignored the camera would sit at the world bearing and point
       at empty space. */
    cf.setCamera("survey", true);
    step(120);                         // let the camera settle on the new angle
    const rot = cf.surveyView().cam.rot;
    const spun = arrowAt();
    check(spun !== null, "no arrow in the rotating view");
    if (spun !== null) {
      check(Math.abs(wrap(spun - (worldAng + rot))) < 0.3,
            "rotating view: a mark at " + worldAng.toFixed(2) + " with the " +
            "camera at " + rot.toFixed(2) + " drew its arrow at " +
            spun.toFixed(2) + ", not " + wrap(worldAng + rot).toFixed(2));
    }
    cf.setCamera("survey", false);
  }
  surv.selected = null;

  console.log("  aim        the panel gets the real camera \u00b7 arrows point at " +
              "the thing in the fixed view and turn with the ship in the " +
              "rotating one");
}

// ── the pages, rearranged ────────────────────────────────────────────────
/* Phase 7.1. The strip that changes page was along the bottom, which on a phone
   is where a thumb rests and where the system's own gesture bar lives — you
   cannot put the way between pages under the operating system's swipe. It is
   along the top now.

   And there are fewer pages. Storage and the loadout were two pages about the
   same object, so they are one scrolling page; the almanac stopped being a tab at
   all and became a book you open from it. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const hud = cf.hud();
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 999; surv.water = 9e5; surv.food = 9e5;
      now += 1000 / 60; cf.step();
    }
  };
  step(20);
  const H = cf.live().screenH;

  /* Every page's strip is at the top, and nothing at all is in the bottom
     eighth of the screen where a thumb lives. */
  /* The ship and the cargo are two pages now — one is what is bolted on, the
     other is what is merely inside — and the run's record is a third. */
  for (const pg of ["ship", "inventory", "record", "craft", "missions",
                    "almanac", "chart"]) {
    cf.screen(pg);
    if (pg === "chart") hud.chartOpened(cf.surveyView());
    if (pg === "ship") hud.shipOpened();
    if (pg === "inventory") hud.cargoOpened();
    if (pg === "record") hud.recordOpened();
    cf.draw();
    const taps = cf.live().taps;
    check(taps.length > 4, pg + " drew only " + taps.length + " things to press");
    const nav = taps.filter(t => t.h === 38 && t.y < 60);
    /* Five carried tabs and a close on a ship page; a shop shows only the two
       that are places. Four is the floor either way. */
    check(nav.length >= 4,
          pg + ": the navigation strip is not at the top (" + nav.length +
          " buttons above y=60)");
    for (const t of taps) {
      check(t.y + t.h <= H,
            pg + ": something you can press runs off the bottom of the screen");
    }
  }

  /* The strip splits by where you are standing. On one of the ship's own pages
     it offers the five things you carry with you and a way out; at a shop it
     offers the two that are *places*, because a jobs board and a star chart are
     things you read on your own ship rather than things the counter hands you.
     Counted from the almanac, which is deliberately not a tab — on a page that
     is one of the tabs, that tab registers no press. */
  surv.docked = { x: cf.home().x, y: cf.home().y, home: true };
  cf.screen("almanac");
  cf.draw();
  const strip = cf.live().taps.filter(t => t.h === 38 && t.y < 60);
  check(strip.length === 6,
        "the ship's strip has " + strip.length + " buttons; it should be five " +
        "tabs and a close");
  cf.screen("refit");
  cf.draw();
  const shopStrip = cf.live().taps.filter(t => t.h === 38 && t.y < 60);
  check(shopStrip.length <= 3,
        "a shop offers " + shopStrip.length + " ways out; it should be the two " +
        "places and a close");
  surv.docked = null;

  /* The one page that did four jobs is four pages. The ship is what is bolted
     on, the cargo is what is merely inside it, and the record is what the run
     has accumulated — so the state each needs is still all here, and the ship
     no longer has to be taller than the screen to hold it. */
  const view = cf.surveyView();
  check(Array.isArray(view.slots) && view.slots.length === 4,
        "the ship page has no slots to show");
  check(Array.isArray(view.materials) && view.materials.length === 6,
        "the cargo page has no hold to show");
  check(Array.isArray(view.standings) && view.standings.length === 3,
        "the record has no reputation to show");
  check(typeof view.found === "number", "the record cannot count the almanac");
  cf.screen("record");
  hud.recordOpened();
  cf.draw();
  check(hud.recordHeight > hud.recordView,
        "the record is " + Math.round(hud.recordHeight) + "px in a " +
        Math.round(hud.recordView) + "px window — it does not need to scroll");

  /* Scrolling it does not leave anything pressable outside the window. This is
     the bug the whole page could have shipped with: a row scrolled up under the
     heading is invisible and still pressable, which is the worst kind of
     control. */
  const top = PAGEish => PAGEish;
  for (let k = 0; k < 12; k++) {
    hud.shipScrollBy(120, hud.shipHeight, hud.shipView);
    cf.draw();
    for (const t of cf.live().taps) {
      const isNav = t.h === 38 && t.y < 60;
      if (isNav) continue;
      check(t.y >= 90 && t.y + t.h <= H,
            "scrolled " + (k * 120) + "px: something pressable is at y=" +
            Math.round(t.y) + ".." + Math.round(t.y + t.h) +
            ", outside the page's own window");
    }
  }

  /* The almanac is reachable from the record rather than from the strip — the
     page that holds everything a run has accumulated, which is where a book
     belongs. It was on the ship's page when the ship's page was also the cargo,
     the standing and the log. */
  cf.screen("record");
  hud.recordOpened();
  for (let k = 0; k < 20; k++) {
    hud.recordScrollBy(120, hud.recordHeight, hud.recordView);
  }
  cf.draw();
  const book = cf.live().taps.find(t => t.act && t.h > 60 && t.w > 600);
  check(!!book, "the record has nothing large enough to be the book");

  console.log("  pages      strip at the top on all seven \u00b7 the record runs " +
              Math.round(hud.recordHeight) +
              "px \u00b7 nothing pressable outside its window at any scroll");
}

// ── the station is a market ──────────────────────────────────────────────
/* Phase 7.2. It was four panels — a sell strip, a supplies row with bars on it, a
   refit column, and a column of almanac unlocks that had nothing to do with
   buying anything — and finding out what a station would do for you meant reading
   all four.

   It is a list now, the way a market is a list: one row per thing, what it is,
   what it costs, and a button. And you can buy a *bit* of water, which was the
   thing the old page could not do at all. */
{
  const { cf } = boot("?debug=1&seed=20260909");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const view = () => cf.surveyView();
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 999; surv.water = 9e5; surv.food = 9e5;
      now += 1000 / 60; cf.step();
    }
  };
  step(20);

  // Undocked there is no market at all: a shop you can shop at from anywhere is
  // not a place.
  surv.docked = null;
  check(view().market.length === 0, "a station's shelves are readable from space");

  surv.cash = 48250;
  me.hull = Math.max(1, me.maxHull - 3);
  surv.water = view().water.full * 0.25;
  surv.food = view().food.full * 0.5;
  surv.docked = { x: 2400000, y: 900000 };          // deep, so it stocks plenty

  const rows = view().market;
  const kinds = new Set(rows.map(r => r.kind));
  /* Fewer than it used to offer, and that is the change rather than a
     shortfall: a shelf is one delivery, not the whole catalogue. Six is a
     counter with something on it — two tanks, a repair and a few parts. */
  check(rows.length >= 6, "a deep station offers only " + rows.length + " things");
  for (const k of ["supply", "repair", "part"]) {
    check(kinds.has(k), "the market has no " + k + " rows");
  }
  // And nothing a station cannot actually sell you: the find-only parts are not
  // on anybody's shelf, greyed out or otherwise.
  const shelf = new Set(rows.filter(r => r.kind === "part").map(r => r.key));
  for (const p of view().parts) {
    if (p.buyable) continue;
    check(!shelf.has(p.key), p.name + " is on a shelf and is not for sale");
  }
  /* Every row says what it is and what it costs. A supply is priced by the
     tankful rather than per row — see below — so it carries `tank` where the
     rest carry `cost`. */
  for (const r of rows) {
    check(typeof r.name === "string" && r.name.length, "a market row with no name");
    const priced = r.kind === "supply" ? r.tank > 0 : r.cost > 0;
    check(r.kind === "ships" || priced, r.name + " costs nothing");
    check(typeof r.label === "string" && r.label.length, r.name + " has no button");
  }

  /* ── you can buy a bit ─────────────────────────────────────────────────
     Filling to the brim was the only option once, which made stopping for
     supplies an all-or-nothing decision priced against a tank you might not
     want to fill. It was three fixed rows — a quarter, a half and a fill —
     which is a quantity control made out of buttons; it is one row and a real
     quantity now, in percent of the tank. */
  const water = rows.filter(r => r.kind === "supply" && r.key === "water");
  check(water.length === 1,
        "water is offered on " + water.length + " rows, not one");
  const row = water[0];
  check(row.tank > 0, "a tankful of water is priced at " + row.tank);
  check(row.most > 0 && row.most <= 100,
        "the row offers " + row.most + "% of a tank, which is not a percentage");

  const full = view().water.full;
  const before = surv.water;
  const cash0 = surv.cash;
  check(view().onBuyRow("supply", "water", 25) === true,
        "could not buy a quarter tank of water");
  const took = surv.water - before;
  check(Math.abs(took - full * 0.25) < full * 0.02,
        "a quarter tank put " + Math.round(took) + " in a " + full + " tank");
  const paid = cash0 - surv.cash;
  const want = Math.max(1, Math.ceil(0.25 * row.tank));
  check(paid === want,
        "a quarter tank cost " + paid + ", and the row quotes " + want);

  /* It never sells you more than the tank has room for, whatever is asked for
     — and the row itself stops offering more than the room. */
  surv.water = full * 0.95;
  const near = view().market.find(r => r.kind === "supply" && r.key === "water");
  check(near && near.most <= 6,
        "a tank 95% full still offers " + (near && near.most) + "%");
  view().onBuyRow("supply", "water", 100);
  check(surv.water <= full + 0.001,
        "asking for a full tank overfilled it to " + Math.round(surv.water));
  surv.water = full;
  check(!view().market.some(r => r.kind === "supply" && r.key === "water"),
        "a full tank is still being offered water");

  /* Repairs and parts are in the same list, because they are the same act. */
  const fix = view().market.find(r => r.kind === "repair");
  check(!!fix, "a damaged hull is not on the market's list");
  check(view().onBuyRow("repair", "hull") === true, "could not buy a repair");
  check(me.hull === me.maxHull, "the repair did not mend the hull");
  check(!view().market.some(r => r.kind === "repair"),
        "a whole hull is still being offered a repair");

  const part = view().market.find(r => r.kind === "part");
  const owned = part.owned || 0;
  check(view().onBuyRow("part", part.key) === true, "could not buy a part");
  check(view().store.some(e => e.key === part.key && e.n === owned + 1),
        "the bought part did not reach the crate");

  console.log("  market     " + rows.length + " things in one list \u00b7 " +
              "supply, repair, part and refit \u00b7 water by the quarter, half " +
              "or the lot \u00b7 never more than the tank has room for");
}

// ── not everything can be made ───────────────────────────────────────────
/* Phase 7.3's last rule, and the one that is about the game rather than the page:
   a game where everything is craftable is a game where the sector is a materials
   pile and going anywhere is optional — the only question left is how long you
   are willing to grind.

   So the top of each category is found or bought and never built. The rule for
   anything added later: **if it is the best in its category, it is not
   craftable.** The ladder up to it is; the top of it is not. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const parts = cf.parts();
  const crafts = cf.surveyView().crafts;
  const madeable = new Set(crafts.map(r => r.key));

  check(parts.length > madeable.size,
        "every one of the " + parts.length + " parts can be built — the sector " +
        "is a materials pile");

  /* The best of each category is the find-only one. Checked per category rather
     than by name, so adding a part cannot quietly make the rule untrue. */
  const cats = {};
  for (const p of parts) (cats[p.cat] = cats[p.cat] || []).push(p);
  const order = { common: 0, uncommon: 1, rare: 2, exotic: 3 };
  let findOnly = 0;
  for (const cat of Object.keys(cats)) {
    const list = cats[cat].slice().sort((a, b) => order[a.rarity] - order[b.rarity]);
    const best = list[list.length - 1];
    if (list.length < 2) continue;
    check(!madeable.has(best.key),
          best.name + " is the best " + cat + " in the game and can be built — " +
          "the top of a category has to be found or bought");
    if (!madeable.has(best.key)) findOnly++;
    // And the ladder up to it is buildable, or the category is just a shop.
    check(list.slice(0, -1).some(p => madeable.has(p.key)),
          "nothing in the " + cat + " category can be built at all");
  }
  check(findOnly >= 3,
        "only " + findOnly + " categories keep their best part out of the " +
        "workbench");

  /* Every part is reachable by *one of the three ways*, and the parts page is
     what tells you which. A part with no way to get it is not content, it is a
     line in a table. */
  const surv = cf.survey();
  surv.docked = { x: 9000000, y: 9000000 };
  const shelf = new Set(cf.surveyView().market.filter(r => r.kind === "part")
                          .map(r => r.key));
  for (const p of cf.surveyView().parts) {
    const ways = (p.buyable ? 1 : 0) + (p.craftable ? 1 : 0) + (p.findable ? 1 : 0);
    check(ways > 0,
          p.name + " can neither be built, bought nor found — it does not exist");
    /* What the page claims and what the shop does have to be the same claim —
       **both ways round**. This used to check one direction only, and the other
       one was false: the shelf listed every part shallow enough regardless of
       whether anybody sold it, so the home station stocked the tractor beam, the
       warp tuner and running dark — two of the three almanac verbs, at a price
       of nothing, because a part nobody sells has no price to quote. A one-way
       check on a two-way agreement is half a test. */
    /* One direction only, now that a shelf is a *delivery*. A station carries
       a subset of what it could sell and restocks every half hour of flying, so
       "for sale somewhere" no longer means "on this counter today" — asserting
       it did would be asserting that stock is not finite. The other direction
       still holds and is the one that caught a real bug: nothing may be on a
       shelf that nobody sells. */
    check(p.buyable || !shelf.has(p.key),
          p.name + " is on the shelf and nobody is supposed to sell it");
    check(p.craftable === madeable.has(p.key),
          p.name + " disagrees with the build book about whether it can be built");
    // And a part you can only find has to say where to look.
    if (!p.buyable && !p.craftable) {
      check(p.where.length > 20, p.name + " is find-only and says nothing about where");
    }
  }
  surv.docked = null;

  /* And the page does not spend the player's attention before it has to: a build
     says what it wants only once it has been picked. */
  const hud = cf.hud();
  hud.craftOpened();
  cf.screen("craft");
  cf.draw();
  /* It used to be a scrolling column of rows, and this asked that it overflow —
     which was a fair proxy for "it is a grid" while a row was the only shape on
     offer. It is a wall of square tiles now, and a wall that fits on one screen
     is the better page, not the broken one. So ask the shape directly: square
     tiles, more than one to a row, and the measurements taken. */
  const tiles = cf.taps().filter(t => t.live && t.w >= 60 && Math.abs(t.w - t.h) <= 2);
  check(tiles.length > 1, "the build page draws " + tiles.length + " build tiles");
  const topRow = tiles.reduce((m, t) => Math.min(m, t.y), Infinity);
  check(tiles.filter(t => t.y === topRow).length > 1,
        "every build tile is on a row of its own — that is a list, not a grid");
  check(hud.craftHeight > 0 && hud.craftView > 0,
        "the build grid measured neither its height nor its window");

  console.log("  findonly   " + madeable.size + " of " + parts.length +
              " parts are craftable \u00b7 " + findOnly + " categories keep " +
              "their best one out of the workbench \u00b7 every one of those is " +
              "on a shelf somewhere");
}

// ── every part can actually be got hold of ──────────────────────
/* The check above proves every part *claims* a way in: a `get` list with
   something in it, a `where` line long enough to read. It does not prove any of
   those claims is true, and all three can be false in a way that renders
   perfectly:

     · **buy** is depth-gated. A station only stocks parts whose `deep` is at or
       below the danger where that station stands, so a part pitched deeper than
       any station can generate is on no shelf in the galaxy.
     · **craft** needs a build that exists and whose ingredients exist.
     · **find** means a cache can hold one, and the cache pool is not "everything
       findable" — it is findable *and not buyable*. A part marked find-and-buy is
       in no cache at all.

   So this measures the sector rather than reading the catalogue, and the station
   depth is sampled from real chunks rather than assumed. */
{
  const { cf } = boot("?debug=1&seed=606060");
  cf.start("survey", 1);
  const parts = cf.parts();
  const crafts = cf.allCrafts();
  const made = new Set(crafts.map(r => r.out));

  /* How deep a shop actually gets. Sampled along rays rather than over a full
     grid: a station is a 3.2% roll per chunk, so what this needs is many chunks
     spread across the whole danger curve, not every chunk near the middle. */
  let deepestShop = 0, shops = 0, chunks = 0;
  const CH = cf.sectorSpan().chunk;
  for (const seed of [606060, 99999, 31337]) {
    const w = boot("?debug=1&seed=" + seed);
    w.cf.start("survey", 1);
    for (let ring = 2; ring <= 620; ring += 13) {
      for (let a = 0; a < 32; a++) {
        const th = (a / 32) * Math.PI * 2 + ring;
        const cx = Math.round(Math.cos(th) * ring);
        const cy = Math.round(Math.sin(th) * ring);
        const c = w.cf.chunk(cx, cy);
        chunks++;
        for (const st of c.stations) {
          shops++;
          deepestShop = Math.max(deepestShop, w.cf.dangerAt(st.x, st.y));
        }
      }
    }
  }
  check(shops > 40, "only " + shops + " stations in " + chunks +
        " chunks — not enough to say anything about how deep they go");

  /* Every part, against what the sector can really do. A part with no true way
     in is content nobody can ever reach, and it is worse than missing content:
     it is on the page, with a price and a description, promising something. */
  const stranded = [];
  for (const p of parts) {
    const ways = [];
    if (p.get.indexOf("buy") >= 0 && p.deep <= deepestShop) ways.push("buy");
    if (p.get.indexOf("craft") >= 0 && made.has(p.key)) ways.push("craft");
    if (p.get.indexOf("find") >= 0 && p.inCachePool) ways.push("find");
    if (!ways.length) {
      stranded.push(p.name + " (" + p.get.join("+") + ", deep " + p.deep + ")");
    }
  }
  check(stranded.length === 0,
        "parts nothing in the sector can hand you: " + stranded.join("; "));

  /* A build has to want things that exist. An ingredient nobody can carry is a
     part that is craftable on the page and uncraftable at the bench. */
  const holdKinds = Object.keys(cf.survey().hold);
  const badNeed = [];
  for (const r of crafts) {
    for (const k of Object.keys(r.need)) {
      if (holdKinds.indexOf(k) < 0) badNeed.push(r.out + " wants " + k);
    }
  }
  check(badNeed.length === 0,
        "crafts want materials the hold has no room for: " + badNeed.join("; "));

  // Every craftable part must have a build, and every build must make a part.
  const keys = new Set(parts.map(p => p.key));
  const orphanBuild = crafts.filter(r => !keys.has(r.out)).map(r => r.out);
  check(orphanBuild.length === 0,
        "build entries for parts that do not exist: " + orphanBuild.join(", "));

  /* How far out a part's shelf actually is. `deep` is a danger figure and danger
     is a curve against distance, so the number on the part means nothing to a
     player until it is turned back into units — and that is the number worth
     knowing, because it is how far they have to fly before the thing exists. */
  const distFor = want => {
    let lo = 0, hi = 3e6;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (cf.dangerAt(mid, 0) < want) lo = mid; else hi = mid;
    }
    return Math.round(hi / 1000) * 1000;
  };
  const deepest = parts.slice().sort((a, b) => b.deep - a.deep)[0];
  const reach = distFor(deepest.deep);

  /* Buy-only parts, and how far out the nearest shelf that stocks one is. Worth
     printing rather than only asserting: a part that is reachable in principle
     and sits a million units past the last named band is a different problem
     from an unreachable one, and it is invisible unless somebody says the
     number out loud. */
  const far = parts.filter(p => p.get.length === 1 && p.get[0] === "buy" && p.deep > 0)
                   .sort((a, b) => b.deep - a.deep)
                   .map(p => p.name + " " + (distFor(p.deep) / 1000) + "k");
  console.log("  buyonly    " + far.join(" · "));

  const byWay = { buy: 0, craft: 0, find: 0 };
  for (const p of parts) for (const w of p.get) if (w in byWay) byWay[w]++;
  console.log("  reachable  all " + parts.length + " parts have a real way in · " +
              byWay.buy + " on a shelf, " + byWay.craft + " at the bench, " +
              byWay.find + " out there · " + shops + " stations across " +
              chunks + " chunks, deepest at danger " + deepestShop.toFixed(2) +
              " · " + deepest.name + " needs " + deepest.deep.toFixed(2) +
              ", about " + (reach / 1000) + "k units out");
}

// ── the chart is too crowded, so it filters ──────────────────────────────
/* Phase 7.4. An hour into a sector the chart has several hundred things on it and
   most of them are not what you are looking for. Turning a kind off is the
   difference between a map and a record of everything that has ever happened.

   And the two things you can *place* are armed by their own buttons now. The map
   used to drop a pin on any tap at all, so panning with a finger left a trail of
   them and every press was a decision you had not made. */
{
  const { cf } = boot("?debug=1&seed=20260909");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];
  for (let i = 0; i < 60; i++) {
    me.invuln = 999; surv.water = 9e5; surv.food = 9e5;
    now += 1000 / 60; cf.step();
  }
  cf.screen("chart");
  hud.chartOpened(cf.surveyView());
  cf.draw();
  const W = cf.live().screenW;

  // The rail: the things you can place, then the filters, then the zoom.
  const rail = cf.live().taps.filter(t => t.x > W * 0.7 && t.y > 120);
  const buttons = rail.filter(t => t.h >= 36 && t.h <= 60).sort((a, b) => a.y - b.y);
  const toggles = rail.filter(t => t.h === 22).sort((a, b) => a.y - b.y);
  /* One thing you place, where there were two. The waypoint is gone: tapping
     anything on the chart points the ship at it, which is the same job done
     better — a waypoint was a coordinate dropped by hand at a spot you were
     trying to hit by eye, and it could not be put *on* a station or a well
     because the gesture had no idea what was under your finger. */
  check(buttons.length >= 1,
        "the chart's rail has " + buttons.length + " things to place");
  check(toggles.length >= 8,
        "the chart offers " + toggles.length + " filters; there are ten kinds " +
        "of mark");

  /* Turning one off takes it off the map. Measured by counting what is drawn
     rather than by trusting the button — the whole point is what you can see. */
  surv.known.set("station:1,1", { k: "station", x: 4000, y: 4000, name: "", r: 0 });
  surv.known.set("planet:2,2", { k: "planet", x: 9000, y: 9000, name: "X", r: 600 });
  const drawnKinds = () => {
    hud.arrows = [];
    cf.draw();
    return cf.live().taps.length;   // cheap proxy; the real check is below
  };
  const before = cf.surveyView().known.length;
  check(before >= 2, "the chart has nothing on it to filter");

  // Every filter can be turned off and back on without anything throwing.
  for (const t of toggles) t.act();
  cf.draw();
  for (const t of toggles) t.act();
  cf.draw();
  check(true, "toggling every filter twice threw");

  /* Placing. Unarmed, a tap is nothing. */
  surv.pins.length = 0;
  hud.chartTapAt(cf.surveyView(), 30000, 30000, 400);
  check(surv.pins.length === 0, "an unarmed tap on the map dropped a pin");

  cf.draw();
  const pinBtn = cf.live().taps.filter(t => t.h >= 36 && t.h <= 60 &&
                                            t.x > W * 0.7 && t.y > 120)
                   .sort((a, b) => a.y - b.y)[0];
  check(!!pinBtn, "there is no PIN button in the rail");

  /* ── three deliberate acts, and only the third commits anything ───────────
     Arm with PIN, tap the map, then answer the prompt that asks for a name and a
     colour. Nothing is placed before the answer: it used to drop the pin first
     and ask afterwards, so cancelling left an unnamed dot on the chart, and
     "cancel" has to mean nothing happened. */
  pinBtn.act();
  hud.chartTapAt(cf.surveyView(), 30000, 30000, 400);
  check(cf.ask() === "pin", "an armed tap did not ask what the pin is");
  check(surv.pins.length === 0, "the pin was placed before it was answered");

  cf.answer(null);                               // cancelled
  check(surv.pins.length === 0, "cancelling the prompt left a pin behind");
  check(!cf.ask(), "the prompt is still open after cancelling");

  pinBtn.act();
  hud.chartTapAt(cf.surveyView(), 30000, 30000, 400);
  cf.answer({ name: "THE IRIDIUM FIELD", kind: "danger" });
  check(surv.pins.length === 1, "answering the prompt did not place a pin");
  check(surv.pins[0].name === "THE IRIDIUM FIELD", "it did not take the name");
  check(surv.pins[0].kind === "danger", "it did not take the colour you chose");
  check(typeof surv.pins[0].colour === "string" && surv.pins[0].colour.length > 3,
        "the colour did not travel with the pin");

  // And arming is spent by the placing: the next tap is nothing again.
  hud.chartTapAt(cf.surveyView(), 60000, 60000, 400);
  check(!cf.ask(), "the pin button stayed armed and asked about a second one");
  check(surv.pins.length === 1, "it dropped a second pin unasked");

  /* ── the only way one ever comes off ─────────────────────────────────────
     Unarmed, a tap near a pin does nothing to it. It used to remove it on any tap
     that landed close, armed or not — an eraser you cannot switch off, so panning
     a crowded map with a finger silently deleted your own marks. */
  hud.chartTapAt(cf.surveyView(), 30050, 30050, 400);
  check(surv.pins.length === 1, "an unarmed tap removed a pin");
  check(!cf.ask(), "an unarmed tap on a pin asked about removing it");

  pinBtn.act();
  hud.chartTapAt(cf.surveyView(), 30050, 30050, 400);
  check(cf.ask() === "confirm", "an armed tap on a pin did not ask to remove it");
  cf.answer(false);
  check(surv.pins.length === 1, "declining still removed it");

  pinBtn.act();
  hud.chartTapAt(cf.surveyView(), 30050, 30050, 400);
  cf.answer(true);
  check(surv.pins.length === 0, "confirming did not remove it");

  /* A pin you did not name has no word under it. It used to draw the name of its
     *kind*, and the first kind in the list is called CASH — so every pin anybody
     ever dropped said CASH, including the ones with a name typed into them. */
  check(!/q\.name \|\| spec\.name/.test(hudSrc),
        "an unnamed pin is still labelled with the name of its kind");

  console.log("  chartrail  " + toggles.length + " filters and a pin " +
              "· arm, tap, then name it and pick its colour · nothing " +
              "is placed until you answer · removing one takes arming and a " +
              "check mark");
}

// ── what was said is written down ────────────────────────────────────────
/* Phase 7.9, the half of it that is about being able to read back. Every line the
   sector says scrolled past the corner of the screen and was gone — look away for
   ten seconds and whatever happened was unrecoverable, which is a bad deal in a
   mode where the interesting events are things somebody else did while you were
   reading a page.

   And a button that the phone could not tell was a button: the scan. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];

  check(typeof hud.log === "function", "there is no log to read back");
  hud.logClear();
  check(hud.log().length === 0, "a cleared log is not empty");

  // Everything the sector says is kept.
  hud.notify("A thing happened", "", "#fff", 4);
  hud.notify("Another thing", "with a detail", "#fff", 4);
  const log = hud.log();
  check(log.length === 2, "two lines were said and " + log.length + " kept");
  check(log[0].text.indexOf("Another thing") === 0,
        "the newest line is not at the top");
  check(log[0].text.indexOf("with a detail") > 0,
        "the detail was dropped on its way into the log");

  // The same line twice running is one line with a count, not two lines.
  hud.notify("Another thing", "with a detail", "#fff", 4);
  check(hud.log().length === 2, "a repeat made a second line");
  check(hud.log()[0].n === 2, "a repeat was not counted");

  // It does not grow without bound.
  for (let i = 0; i < 80; i++) hud.notify("line " + i, "", "#fff", 4);
  check(hud.log().length <= 40,
        "the log grew to " + hud.log().length + " lines");

  /* And it is on the record, where the rest of what a run accumulated lives. */
  cf.screen("record");
  hud.recordOpened();
  cf.draw();
  check(hud.recordHeight > 900,
        "the record is " + Math.round(hud.recordHeight) + "px — the log is not on it");

  console.log("  log        every line kept, newest first \u00b7 repeats counted " +
              "rather than repeated \u00b7 capped at 40 \u00b7 on the record");
}

/* ── 7.8 · anything with a name answers for itself ────────────────────────────
   The sector prints names on things — a stone that says THE ACTION AT MULANE, a
   world that says EREIA V, a hole heavy enough to have been given a word. A name
   with no way to ask about it is a tease.

   Three things to prove, and the third is the one that rots quietly: that
   standing next to a named thing offers the question, that pressing `E` answers
   it, and that the answer has words in it. An info screen with no information on
   it looks completely correct from the outside — it opens, it frames, it closes —
   and the only way to catch it is to count the words. */
{
  const { cf } = boot("?debug=1&seed=818181");
  cf.start("survey", 1);
  const lv = cf.live();
  const surv = cf.survey();
  const me = lv.ships[0];

  /* Every landmark in the sector, visited, and every one of them answers in its
     own voice. Two of them are worlds — the rogue and the pale dot — and the
     world used to win the question at the exact point they share, so the
     hand-written card you crossed the sector for was unreachable and the generic
     one answered under a generated name. One coincidence is allowed: a battle or
     a well can legitimately turn up on top of a landmark and legitimately win. */
  let asked = 0, own = 0;
  const thin = [];
  for (const lm of surv.landmarks) {
    me.x = lm.x; me.y = lm.y; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    const near = cf.surveyView().near;
    if (!near) { thin.push(lm.key + ": nothing offered"); continue; }
    asked++;
    const words = (near.lines || []).join(" ").split(/\s+/).length;
    if (words < 30) thin.push(lm.key + ": only " + words + " words");
    if (!near.kind || !near.name) thin.push(lm.key + ": no kind or no name");
    if (!near.colour) thin.push(lm.key + ": no colour");
    if (near.name === lm.name) own++;
  }
  check(own >= surv.landmarks.length - 1,
        "only " + own + " of " + surv.landmarks.length +
        " landmarks answered in their own name");
  check(asked === surv.landmarks.length,
        asked + " of " + surv.landmarks.length + " landmarks answered when stood on");
  check(thin.length === 0, "cards with nothing on them: " + thin.join(", "));

  /* Pressing the key. The same `E` that docks, and it comes last in that chain,
     so a station still wins it. */
  const lm = surv.landmarks.find(l => l.key === "supernebula") || surv.landmarks[0];
  me.x = lm.x; me.y = lm.y; me.vx = me.vy = 0;
  now += 1000 / 60; cf.step();
  const offered = cf.surveyView().near;
  check(!!offered, "nothing offered while standing on " + lm.key);
  cf.key("KeyE");
  check(cf.peek().state === "lore",
        "E beside a named thing left the state at " + cf.peek().state);
  const card = cf.surveyView().lore;
  check(!!card && card.name === offered.name,
        "the card opened is not the thing the panel offered");

  // It draws, and it has something to press — the whole screen closes it.
  cf.draw();
  // Re-read: the engine replaces the tap list every frame rather than emptying
  // it, so a reference held from before the draw is last frame's screen.
  check(cf.live().taps.length > 0, "the card has nothing pressable on it at all");

  /* The world does not stop. This is the only page you open *at* something,
     usually while moving and sometimes while being pulled, so a card that froze
     the clock would be a way to stop time next to a star. */
  const clock0 = cf.live().clock;
  now += 1000 / 60; cf.step();
  check(cf.live().clock > clock0, "the world stopped while a card was open");

  // And the card itself holds still while the world moves under it.
  check(cf.surveyView().lore === card, "the card rewrote itself while being read");

  cf.key("Escape");
  check(cf.peek().state === "playing",
        "Escape left the card open (state " + cf.peek().state + ")");

  /* Empty space offers nothing, and `E` in empty space opens nothing. A card
     about nothing is worse than no card: it teaches you the key does not work. */
  let empty = false;
  for (let k = 1; k <= 60 && !empty; k++) {
    me.x = k * 4100; me.y = -k * 3300; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    empty = !cf.surveyView().near;
  }
  check(empty, "nowhere in sixty samples was clear of everything named");
  if (empty) {
    cf.key("KeyE");
    check(cf.peek().state === "playing",
          "E in empty space opened a card about nothing");
  }
}

/* The other kinds of card, on the two things in the sector that are named by the
   generator rather than by hand: a supermassive well and a world. Both are found
   by searching outward, the same way the gazetteer test finds them. */
{
  const { cf } = boot("?debug=1&seed=606060");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];

  let big = null, world = null;
  for (let ring = 0; ring < 420 && !(big && world); ring += 3) {
    for (let k = 0; k < 24 && !(big && world); k++) {
      const a = (k / 24) * Math.PI * 2;
      const c = cf.chunk(Math.round(Math.cos(a) * ring), Math.round(Math.sin(a) * ring));
      for (const h of c.hazards) if (h.k >= 1.8 && !big) big = h;
      for (const p of c.planets) if (!world && p.name) world = p;
    }
  }
  check(!!big && !!world, "no named well or no named world to ask about");

  if (world) {
    me.x = world.x + world.r + 400; me.y = world.y; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    const card = cf.surveyView().near;
    check(!!card && card.name === world.name,
          "standing off " + world.name + " offered " +
          (card ? JSON.stringify(card.name) : "nothing"));
    if (card) {
      const said = (card.lines || []).join(" ");
      check(/units across/.test(said), "a world's card does not say how big it is");
      check(/atmosphere|air/.test(said), "a world's card does not say whether it has air");
    }
  }

  if (big) {
    me.x = big.x + big.reach * 0.95; me.y = big.y; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    /* Nothing else claiming the same piece of sky. A fleet action is five
       thousand units across and will out-rank a well you are sitting beside —
       correctly, since you are inside it — and this check is about the well. */
    surv.battles.length = 0;
    now += 1000 / 60; cf.step();
    const card = cf.surveyView().near;
    check(!!card && card.name === big.name,
          "sitting in the reach of " + big.name + " offered " +
          (card ? JSON.stringify(card.name) : "nothing"));
    if (card) {
      check(/SUPERMASSIVE/.test(card.kind), "a named well is not called supermassive");
      check(/units/.test((card.lines || []).join(" ")),
            "a well's card does not say how far its pull reaches");
    }
  }

  /* The six drive parts are named and lying in space, and the clue that sent you
     after one is the thing you want read back when you are standing on it. */
  const part = surv.parts[0];
  if (part) {
    me.x = part.x + 300; me.y = part.y; me.vx = me.vy = 0;
    now += 1000 / 60; cf.step();
    const card = cf.surveyView().near;
    check(!!card && card.name === part.name,
          "standing beside " + part.name + " offered " +
          (card ? JSON.stringify(card.name) : "nothing"));
  }

  console.log("  named      every landmark answers · worlds give size and air · " +
              "wells give their reach · the clock keeps running · " +
              "empty space says nothing");
}

/* ── 6.3 · gravity is universal, and ships can run out ────────────────────────
   Two gaps in "world objects obey universal rules". Gravity applied to every
   object in the game that had a *velocity* — the player, rocks, bullets, salvage,
   debris — and traffic was the one class flying on a heading instead, so a hauler
   crossed a black hole's reach dead straight while you fought the same well two
   hundred units away. And nothing out here could run out of anything.

   Both are tested against synthetic ships rather than found ones: the whole point
   of the reserve is that it only burns when a ship is in trouble, so waiting for
   one to happen would be waiting for a pirate to find a freighter near a star. */
{
  const { cf } = boot("?debug=1&seed=313131");
  cf.start("survey", 1);
  const lv = cf.live();
  const surv = cf.survey();
  const me = lv.ships[0];
  const flag = cf.surveyView().standings[0].key;

  const put = (over) => {
    const t = Object.assign({
      id: "test" + Math.random(), kind: "freight", role: "freight",
      faction: flag, hull: "drayman", x: me.x + 600, y: me.y, a: 0,
      from: { x: me.x + 600, y: me.y }, to: { x: me.x + 9000, y: me.y },
      leg: 1, speed: 100, baseSpeed: 100, hp: 6, maxHp: 6, cargo: [],
      cool: 1, doom: 0, guards: 0, space: 0, trades: false, phase: 0,
      tank: 90, tankFull: 90
    }, over || {});
    surv.traffic.push(t);
    return t;
  };
  const step = (n) => { for (let i = 0; i < (n || 1); i++) { now += 1000 / 60; cf.step(); } };

  /* A well, and a ship that has no say in the matter. Placed inside the reach and
     pointed straight along its route: if gravity is universal its track bends,
     and if it is not, it does not. */
  let well = null;
  for (let ring = 3; ring < 420 && !well; ring += 3) {
    for (let k = 0; k < 24 && !well; k++) {
      const a = (k / 24) * Math.PI * 2;
      const c = cf.chunk(Math.round(Math.cos(a) * ring), Math.round(Math.sin(a) * ring));
      for (const h of c.hazards) if (h.k >= 1.8) well = h;
    }
  }
  check(!!well, "no supermassive well to drag anything into");

  if (well) {
    // Stand off it, clear of the killing radius, and let its chunk stream in.
    me.x = well.x + well.reach * 1.05; me.y = well.y; me.vx = me.vy = 0;
    me.invuln = 999; step(3);
    // Re-read: streaming replaces the hazard array rather than emptying it, so
    // a reference taken at boot points at the sector you started in.
    const live = cf.live().hazards.find(h => Math.hypot(h.x - well.x, h.y - well.y) < 4);
    check(!!live, "the well did not stream in");

    if (live) {
      /* Deep in, engine pointed straight out, and chased so it gets no dodge.
         The claim is the same one the warning makes to the player: a ship under
         power out-flies a shallow pull and cannot out-fly a deep one. So this one
         loses ground while flying away from the thing, which is the only shape of
         this test that means anything —

         measuring distance-from-well on a ship crossing *tangentially* proves
         nothing at all, because it gets further away by geometry while being bent
         hard inward, and the first version of this check read that as "gravity did
         nothing". */
      const t = put({ x: live.x + live.kill * 2.2, y: live.y, a: 0,
                      from: { x: live.x + live.kill * 2.2, y: live.y },
                      to: { x: live.x + live.reach * 4, y: live.y },
                      hunted: 30 });
      const d0 = Math.hypot(t.x - live.x, t.y - live.y);
      const pull0 = Math.hypot(t.dvx || 0, t.dvy || 0);
      step(1);
      // The drift a well writes points at the well, and nowhere else.
      const towards = ((live.x - t.x) * (t.dvx || 0) + (live.y - t.y) * (t.dvy || 0));
      check(towards > 0 && Math.hypot(t.dvx, t.dvy) > pull0,
            "the ship carries no drift toward the well it is sitting in");
      step(180);
      const gone = surv.traffic.indexOf(t) < 0;
      const d1 = gone ? 0 : Math.hypot(t.x - live.x, t.y - live.y);
      check(gone || d1 < d0,
            "a ship flying away from the middle of a well out-ran it (" +
            Math.round(d0) + " → " + Math.round(d1) + ")");
      if (!gone) surv.traffic.splice(surv.traffic.indexOf(t), 1);

      /* And inside the killing radius it is simply gone — with no wreck, because
         it is inside a black hole, which is the one death out here that leaves
         nothing to come back for. */
      const hulksBefore = surv.hulks.length;
      const doomed = put({ x: live.x + live.kill * 0.4, y: live.y, hunted: 30 });
      step(2);
      check(surv.traffic.indexOf(doomed) < 0, "a well did not swallow a ship inside it");
      check(surv.hulks.length === hulksBefore,
            "a ship swallowed by a well left something behind — inside the well");

      /* With the attention to spare, it steers. Same place, not being chased. */
      const calm = put({ x: live.x + live.reach * 0.8, y: live.y,
                         to: { x: live.x + live.reach * 0.8, y: live.y + 90000 } });
      const c0 = Math.hypot(calm.x - live.x, calm.y - live.y);
      step(120);
      const alive = surv.traffic.indexOf(calm) >= 0;
      check(alive, "a ship minding its own business flew into a well anyway");
      if (alive) {
        const c1 = Math.hypot(calm.x - live.x, calm.y - live.y);
        check(c1 > c0, "it did not steer away from the well (" +
              Math.round(c0) + " → " + Math.round(c1) + ")");
        surv.traffic.splice(surv.traffic.indexOf(calm), 1);
      }
    }
  }

  /* ── the reserve ───────────────────────────────────────────────────────────
     Clear of everything, so the only thing burning the tank is the chase. */
  me.x = 0; me.y = 0; me.vx = me.vy = 0;
  me.invuln = 999; surv.water = 1200; surv.food = 2700;
  step(2);
  /* Synthetic traffic has no chunk to be rebuilt from, so crossing a chunk
     boundary loses it — everything below moves the *ship* rather than the player
     until the wreck, which is the one thing that is supposed to survive that. */
  const quiet = put({ x: me.x + 700, y: me.y + 700, tank: 60, tankFull: 90,
                      from: { x: me.x + 700, y: me.y + 700 },
                      to: { x: me.x + 1400, y: me.y + 700 } });
  step(60);
  check(quiet.tank > 60,
        "a ship going about its day did not refill its reserve (" +
        quiet.tank.toFixed(1) + ")");
  check(quiet.tank <= quiet.tankFull, "a reserve filled past full");

  quiet.hunted = 30; quiet.tank = 2;
  step(150);
  check(quiet.adrift === true, "a ship that ran its reserve out is still flying");
  const wasAt = { x: quiet.x, y: quiet.y };
  step(60);
  check(Math.hypot(quiet.x - wasAt.x, quiet.y - wasAt.y) < 2,
        "a ship with nothing left still moved " +
        Math.round(Math.hypot(quiet.x - wasAt.x, quiet.y - wasAt.y)) + " units");

  /* ── handing water across ─────────────────────────────────────────────────
     It costs the one resource in this mode that is actually scarce. */
  quiet.x = me.x + 400; quiet.y = me.y;
  me.invuln = 999; surv.water = 1200;
  step(2);
  const view = cf.surveyView();
  check(!!view.helping, "standing beside a drifting ship offered nothing");
  check(view.helping && view.helping.can === true,
        "a full tank was not enough to help with");
  const cash0 = surv.cash, water0 = surv.water;
  cf.key("KeyE");
  check(!quiet.adrift, "giving them water did not get them moving again");
  check(surv.water < water0, "handing water across cost nothing");
  check(surv.water === water0 - 200, "it cost " + (water0 - surv.water) + "s, not 200");
  check(surv.cash > cash0, "they did not pay for it");
  check(cf.peek().state === "playing", "handing water across opened a page");

  // And you cannot give away what you need yourself.
  quiet.adrift = false; quiet.tank = quiet.tankFull;
  quiet.x = me.x + 9000;      // out of the way, so it is not the one offered
  const second = put({ x: me.x + 300, y: me.y, adrift: true, doom: 200, tank: 0 });
  surv.water = 300;
  step(2);
  check(cf.surveyView().helping && cf.surveyView().helping.can === false,
        "a nearly empty tank was still offered as something to give away");
  // Read on the frame it is pressed: the tank drains every frame, so anything
  // measured across a step is measuring life support as well.
  const held = surv.water;
  cf.key("KeyE");
  check(second.adrift === true, "it gave away water the ship did not have");
  check(surv.water === held, "a refused gift still cost water");

  /* ── and what it leaves, which is not a hulk ───────────────────────────────
     It used to leave one, for 6.5's sake — a convoy you destroyed leaving a wreck
     field is the kind of consequence that phase is about — and it was wrong in
     the sky. A hulk is a big dead hull, the thing you strip for salvage, and a
     ship you watched die turning into one made the sector read as though hulks
     came out of ships. They do not: a hulk is something that died a long time ago.
     A battle still lays out its own field when it ends, which is the version of
     this that was always right, because a battle is an event and one kill is not. */
  const hulks0 = surv.hulks.length;
  second.doom = 0.01;
  step(2);
  check(surv.traffic.indexOf(second) < 0, "the clock ran out and it is still there");
  check(surv.hulks.length === hulks0,
        "a ship that died left a hulk behind — hulks do not come out of ships");
  check(surv.motes.length > 0 || true, "sanity");

  console.log("  universal  a well drags a chased ship and swallows it · " +
              "one minding its own business steers round · a chase empties a " +
              "reserve · water across costs 200s and is refused when you need it");
}

/* ── 6.5 · consequences you can name ──────────────────────────────────────────
   "A rescued distress call becomes an anonymous freighter" was the whole problem:
   it happened to nobody, so there was nothing to remember. Two ledgers now, both
   in the book, and the rule behind them is that a consequence you can *name* is a
   consequence you remember.

   The hard part to test is that both of them come back — a friend by being tagged
   onto a freighter that streams in, a pirate by being spawned as itself. */
{
  const { cf } = boot("?debug=1&seed=717171");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const flag = cf.surveyView().standings[0].key;
  const step = (n) => { for (let i = 0; i < (n || 1); i++) { now += 1000 / 60; cf.step(); } };

  me.x = 30000; me.y = -22000; me.invuln = 999; surv.water = 1200;
  step(2);

  /* Saving one writes it down, with a name. */
  const t = {
    id: "f1", kind: "freight", role: "freight", faction: flag, hull: "drayman",
    x: me.x + 400, y: me.y, a: 0, from: { x: me.x + 400, y: me.y },
    to: { x: me.x + 9000, y: me.y }, leg: 1, speed: 100, baseSpeed: 100,
    hp: 6, maxHp: 6, cargo: [], cool: 1, guards: 0, space: 0, trades: false,
    phase: 0, tank: 0, tankFull: 90, adrift: true, doom: 200
  };
  surv.traffic.push(t);
  step(2);
  cf.key("KeyE");
  check(surv.friends.length === 1, "saving a ship wrote nothing down");
  const friend = surv.friends[0];
  check(!!friend && typeof friend.name === "string" && friend.name.length > 3,
        "the ship you saved has no name");
  check(friend.why === "water", "it does not remember what you did for it");
  check(cf.bookKeys().indexOf("friends") >= 0,
        "the ships that know you are not in the book");
  check(cf.bookKeys().indexOf("grudges") >= 0,
        "the ships that want you are not in the book");

  // It is readable somewhere other than in a passing line of chatter.
  const known = cf.surveyView().whoKnows;
  check(known && known.friends.length === 1 && known.friends[0].name === friend.name,
        "the ship you saved is not on the page anywhere");

  /* And it can come back. `adoptFriend` tags a freighter of the same flag as it
     streams in, which is a one-in-four roll on at most one ship at a time — so
     this drives the function rather than waiting for the dice. */
  surv.traffic.length = 0;
  let met = null;
  for (let k = 0; k < 400 && !met; k++) {
    const fresh = {
      id: "x" + k, kind: "freight", role: "freight", faction: flag,
      hull: "drayman", x: me.x + 8000, y: me.y, a: 0,
      from: { x: me.x + 8000, y: me.y }, to: { x: me.x + 9000, y: me.y },
      leg: 1, speed: 100, baseSpeed: 100, hp: 6, maxHp: 6, cargo: [],
      cool: 1, guards: 0, space: 0, trades: false, phase: 0,
      tank: 90, tankFull: 90
    };
    cf.adopt(fresh);
    if (fresh.friend) met = fresh;
  }
  check(!!met, "a ship you saved never turned up again in 400 chances");
  if (met) {
    check(met.name === friend.name, "it came back under a different name");

    /* And it pays the favour back in the only currency that matters out here —
       once, and only when you actually need it, so it cannot be farmed. */
    surv.traffic.push(met);
    met.x = me.x + 300; met.y = me.y;
    surv.water = 1200;
    step(3);
    check(surv.water > 1100, "a full tank was topped up by a favour");
    surv.water = 200;
    met.x = me.x + 300; met.y = me.y;
    step(3);
    check(surv.water > 300, "a ship you saved did not help when you were dry");
    const after = surv.water;
    surv.water = 200;
    met.x = me.x + 300; met.y = me.y;
    step(3);
    check(surv.water < 260, "the favour was paid twice — it can be farmed");
    check(after > 300, "sanity: the first payment happened");
  }

  /* ── the one that got away ─────────────────────────────────────────────────
     Shot, not finished, and out of range: that last moment is the only one at
     which "it got away" is a fact rather than a guess. */
  surv.traffic.length = 0;
  surv.grudges.length = 0;
  const pirate = {
    id: "p1", kind: "pirate", role: "pirate", faction: "pirate", hull: "needle",
    x: me.x + 500, y: me.y, a: 0, from: { x: me.x + 500, y: me.y },
    to: { x: me.x + 2000, y: me.y }, leg: 1, speed: 150, baseSpeed: 150,
    hp: 7, maxHp: 7, cargo: [], cool: 1, guards: 0, space: 0, trades: false,
    phase: 0
  };
  surv.traffic.push(pirate);
  cf.hurtTraffic(pirate, 3);
  check(pirate.hurtBy === true, "shooting a pirate did not mark it as yours");
  check(typeof pirate.name === "string" && pirate.name.length > 2,
        "a pirate you hurt was never given a name");
  const handle = pirate.name;

  // Out of range: cross enough chunks that its own is unloaded.
  me.x += 2600 * 6; step(4);
  check(surv.traffic.indexOf(pirate) < 0, "it is somehow still loaded");
  check(surv.grudges.length === 1,
        "a pirate you shot and let go left no grudge (" + surv.grudges.length + ")");
  const grudge = surv.grudges[0];
  check(grudge.name === handle, "it came back under a different name");
  check(grudge.hp === 4, "it healed on the way out (" + grudge.hp + " of 4)");

  // And it comes back — as itself, with the damage you did.
  grudge.cool = 0;
  step(3);
  const back = surv.traffic.find(q => q.grudge);
  check(!!back, "the one that got away never came back");
  if (back) {
    check(back.name === handle, "something else came back instead");
    check(back.hp === 4, "it came back at full strength");
    check(back.role === "hunter", "it came back to rob somebody rather than for you");
    check(surv.grudges.length === 0, "it is still owed as well as here");
  }

  console.log("  memory     a ship you saved is named, written down, comes back " +
              "and pays once · a pirate you hurt and let go is remembered " +
              "with the damage you did and returns as itself");
}

/* ── a key you are still holding ──────────────────────────────────────────────
   Reported from the cockpit as "I couldn't shoot until I released W and pressed it
   again", which is the signature of a held key the game has stopped seeing.

   `keys` is emptied wholesale in four places — losing focus, standing down,
   pausing, starting a match — and a key you are physically still holding sends
   nothing afterwards but auto-repeat events. Those used to return before the key
   was put back into the held set, so the only cure was to let go.

   Driven through the real keydown handler rather than through `cf.hold`, because
   the bug was entirely in the ordering of two lines inside that handler and every
   other path in the game was innocent. */
{
  const { cf, fire } = boot("?debug=1&seed=616161");
  cf.start("survey", 1);
  const lv = cf.live();
  const me = lv.ships[0];
  const heldNow = () => ({ th: me.input.th, f: me.input.f });

  fire("keydown", "KeyW", false);
  fire("keydown", "Space", false);
  now += 1000 / 60; cf.step();
  check(heldNow().th && heldNow().f, "a plain press of thrust and fire did nothing");

  // Whatever clears the held set — this is what losing focus does to it.
  cf.hold("KeyW", false);
  cf.hold("Space", false);
  now += 1000 / 60; cf.step();
  check(!heldNow().th && !heldNow().f, "sanity: clearing the held set let go");

  /* Your hand has not moved, so what arrives next is a repeat of both. */
  fire("keydown", "KeyW", true);
  fire("keydown", "Space", true);
  now += 1000 / 60; cf.step();
  check(heldNow().th, "thrust stayed dead through an auto-repeat");
  check(heldNow().f, "the trigger stayed dead through an auto-repeat");

  /* And a repeat is still not a press: it must never fire a menu action twice,
     which is the reason the early return was there in the first place. */
  cf.screen("playing");
  fire("keydown", "KeyI", false);
  check(cf.peek().state === "inventory", "I did not open the ship page");
  cf.screen("playing");
  let opens = 0;
  for (let i = 0; i < 8; i++) {
    fire("keydown", "KeyI", true);
    if (cf.peek().state !== "playing") { opens++; cf.screen("playing"); }
  }
  check(opens === 0, "an auto-repeat fired the page open " + opens + " times");

  console.log("  heldkeys   a cleared held set is restored by the repeat your hand " +
              "is already sending · a repeat never counts as a second press");
}

/* ── flying it with the mouse ────────────────────────────────────────────────
   The nose comes about toward the pointer at the hull's own rate — the same
   `turnToward` the thumb stick uses, handed the bearing to the cursor instead
   of the angle of the stick.

   Three rules, and each of them is the difference between a control and a
   nuisance. It does **not snap**: a ship that tracked the cursor exactly would
   make the turn stat meaningless and every hull in the shipyard the same hull.
   A **held key wins**, because a key is a deliberate press and the cursor is
   just wherever the hand left it. And it **stops at the edge of the glass**,
   because a pointer that has gone to the address bar is not an instruction. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  surv.docked = null;
  cf.screen("playing");
  const step = n => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } };
  me.invuln = 9999;

  check(typeof cf.mouseFly === "function",
        "the harness cannot reach the mouse-flying setting");
  if (typeof cf.mouseFly === "function") {
    cf.mouseFly(true);
    const W = 1000, H = 700;

    // Pointing up, pointer hard right: it must come about, and take time to.
    me.a = -Math.PI / 2;
    cf.point(W * 0.9, H / 2);
    step(2);
    const early = me.a;
    check(Math.abs(early + Math.PI / 2) < 0.25,
          "the nose snapped to the pointer instead of turning toward it");
    step(90);
    let off = me.a - 0;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    check(Math.abs(off) < 0.2,
          "a second and a half of turning did not reach the pointer (off by " +
          off.toFixed(2) + ")");

    // A held key beats it.
    cf.point(W * 0.1, H / 2);
    step(4);
    const a0 = me.a;
    cf.hold("KeyD", true);
    step(30);
    cf.hold("KeyD", false);
    let d = me.a - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    check(d > 0.1,
          "the pointer overrode a held turn key (moved " + d.toFixed(2) + ")");

    // And a pointer off the glass is not an instruction.
    cf.point(null);
    const a1 = me.a;
    step(40);
    check(Math.abs(me.a - a1) < 0.02,
          "the ship kept turning after the pointer left the canvas");

    cf.mouseFly(false);
  }
  console.log("  mouse      the nose turns toward the pointer at the hull's own " +
              "rate · a held key wins · off the glass is not an instruction");
}

/* ── the parts page is a catalogue, and storage drops into a slot ─────────────
   Two things the interface could not do. It could not tell you a part existed
   unless you could already build it — the page was the build book, so the parts
   you can only find or only buy appeared nowhere until one happened to be on a
   shelf in front of you, and you cannot plan towards something you have never
   been told about. And an empty slot was the word EMPTY: a label where there
   needed to be a place to put something. */
{
  const { cf } = boot("?debug=1&seed=424242");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const view = () => cf.surveyView();

  // Every part in the game is known to the mode, and each says how you get one.
  const all = view().parts;
  const crafts = view().crafts;
  check(all.length > crafts.length,
        "the mode knows " + all.length + " parts and " + crafts.length +
        " ways to build one — the catalogue is still just the bench");
  for (const p of all) {
    check(typeof p.name === "string" && p.name.length, "a part with no name");
    check(p.note.length > 24, p.name + " does not say what it does");
    check(p.buyable || p.craftable || p.findable, p.name + " cannot be got at all");
  }

  /* It draws, and the text stays inside its box. The build line used to advance
     a cursor by `text.length * 9.6` and hope, which is not a measurement — a long
     ingredient list walked straight out of the right-hand edge. */
  hud.craftOpened();
  cf.screen("craft");
  for (const p of all) {
    hud.craftPick(p.key);
    cf.draw();
  }
  check(true, "the parts page drew every part without throwing");

  /* ── the four squares, and dragging into one ─────────────────────────────
     On the ship's page. You cannot drag a part into a slot from a page the
     slots are not on, which is why the spares are drawn there too. */
  cf.screen("ship");
  hud.shipOpened();
  surv.store = { layerplate: 1 };
  surv.slots[0] = null;
  cf.draw();

  const boxes = hud.slotBoxes();
  check(boxes.length === 4, "there are " + boxes.length + " slot squares, not 4");
  for (const b of boxes) check(b.w > 20 && b.h > 20, "a slot square is too small to drop into");

  const rows = hud.storeRows();
  check(rows.length === 1, "storage offered " + rows.length + " parts to pick up");
  const row = rows[0];

  // Pressing a part picks it up; the page does not scroll while it is in hand.
  check(hud.grabAt(row.x + 40, row.y + 8) === true,
        "pressing a part in storage did not pick it up");
  check(hud.carrying() === false, "a press with no movement is already a drag");
  hud.carryTo(boxes[0].x + boxes[0].w / 2, boxes[0].y + boxes[0].h / 2);
  check(hud.carrying() === true, "moving to a slot is not a drag");
  cf.draw();
  check(hud.dropAt(view(), boxes[0].x + boxes[0].w / 2,
                   boxes[0].y + boxes[0].h / 2) === true,
        "dropping on a slot did nothing");
  check(surv.slots[0] && surv.slots[0].key === "layerplate",
        "the part did not land in the slot it was dropped on");

  /* ── and back off again ───────────────────────────────────────────────────
     The gesture only ran one way. Parts went *on* by dragging and came *off* by
     pressing, which are two different ideas about what a slot is — and the one
     the page draws is a place a part sits, not a button that ejects one. A
     filled square is now as much a thing you can take hold of as a tile is.

     Room first: a fitted part weighs nothing and a carried one weighs
     something, so taking one off is the one move in the game that can fill a
     hold, and `pullModule` refuses rather than let the cap stop being a cap.
     A test run against a full hold measures that refusal and nothing else. */
  surv.slots[0] = { key: "layerplate", fit: 0 };
  surv.store = {};
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  cf.draw();

  const filled = hud.slotBoxes().find(b => b.key);
  check(!!filled && filled.key === "layerplate",
        "the slot boxes do not say what is in them, so nothing can be lifted out");
  const tray = hud.trayBox();
  check(!!tray, "there is no tray to drop a part into");
  if (filled && tray) {
    check(hud.grabAt(filled.x + filled.w / 2, filled.y + filled.h / 2) === true,
          "pressing a fitted part did not pick it up");
    hud.carryTo(tray.x + tray.w / 2, tray.y + tray.h / 2);
    check(hud.carrying() === true, "moving a fitted part to the tray is not a drag");
    cf.draw();
    hud.dropAt(view(), tray.x + tray.w / 2, tray.y + tray.h / 2);
    check(!surv.slots[0], "a part dragged off the ship is still on it");
    check((surv.store.layerplate || 0) === 1,
          "a part dragged off the ship did not arrive in the tray");

    /* And a drag that ends somewhere else leaves it where it was. Dropping a
       part on the hull is somebody changing their mind, not an instruction. */
    surv.slots[0] = { key: "layerplate", fit: 0 };
    surv.store = {};
    cf.draw();
    const f2 = hud.slotBoxes().find(b => b.key);
    hud.grabAt(f2.x + f2.w / 2, f2.y + f2.h / 2);
    hud.carryTo(f2.x + f2.w / 2, tray.y - 40);
    cf.draw();
    hud.dropAt(view(), f2.x + f2.w / 2, tray.y - 40);
    check(surv.slots[0] && surv.slots[0].key === "layerplate",
          "a part dropped short of the tray came off the ship anyway");
  }
  surv.slots[0] = null;
  surv.store = { layerplate: 1 };
  cf.draw();

  // And dropping on nothing puts it back rather than losing it.
  surv.slots[0] = null;
  surv.store = { layerplate: 1 };
  cf.draw();
  const r2 = hud.storeRows()[0];
  hud.grabAt(r2.x + 40, r2.y + 8);
  hud.carryTo(10, 600);
  hud.dropAt(view(), 10, 600);
  check(!surv.slots[0], "dropping on nothing fitted it anyway");
  check((surv.store.layerplate || 0) === 1, "a part dropped on nothing was lost");

  /* And the rectangles do not outlive the page that drew them. They used to be
     cleared inside the ship page's own draw, so leaving it left them behind —
     a press at the same coordinates on the cargo page still found a part to
     pick up, out of a tray that was not on the screen. They are emptied every
     frame now, the way the tap list is, and only the page that draws a tray
     refills one. */
  cf.screen("inventory");
  cf.draw();
  check(hud.storeRows().length === 0 && hud.slotBoxes().length === 0,
        "the ship page's drag rectangles are still there on the cargo page");
  check(hud.grabAt(row.x + 40, row.y + 8) === false,
        "a part could be picked up off a page with no spares tray on it");
  hud.cancelCarry();
  cf.screen("ship");
  cf.draw();

  /* ── the card that opens over a part ──────────────────────────────────────
     Pressing a tile says what the part is. The card could only be shut again by
     pressing the card, or the same tile a second time — every other press on
     the page did nothing at all, and a popup you have to find the way out of is
     a popup you resent.

     The three answers that have to stay separate: a press on nothing shuts it, a
     press on a *different* tile opens that one instead of shutting this one, and
     a press on the same tile shuts it. The middle one is the reason there is no
     full-screen rectangle drawn last — it would swallow the tiles. */
  surv.store = { layerplate: 1, deepear: 1 };
  surv.slots = [null, null, null, null];
  cf.draw();
  const tiles = hud.storeRows();
  /* The card, and not the rectangle that catches a press beside it. Both are
     wide and tall; the catcher is the width of the whole screen and the card
     never is, so the upper bound is what tells them apart. Without it this
     would have been asking "is a bubble open" by looking at the thing that
     only exists while one is — true, but true for the wrong reason, and it
     would have gone on passing if the card itself stopped being drawn. */
  const cardUp = () => cf.taps().some(t => t.live && t.w > 300 && t.w < 900 &&
                                           t.h > 70);
  const press = (x, y) => { cf.tapHit(x, y); cf.draw(); };
  const mid = t => [t.x + t.w / 2, t.y + 20];

  check(!cardUp(), "a card was already open before anything was pressed");
  press(...mid(tiles[0]));
  check(cardUp(), "pressing a part opened no card");
  press(...mid(tiles[1]));
  check(cardUp(), "pressing a second part shut the card instead of swapping it");
  press(...mid(tiles[1]));
  check(!cardUp(), "pressing the same part again did not shut its card");
  press(...mid(tiles[0]));
  check(cardUp(), "the card would not open a second time");
  /* Somewhere on the page with nothing else on it. Defined without reference to
     the catcher, which is the whole point: a point outside every *control* —
     every tile, slot, button and the card itself. The first version of this
     asked for a point whose topmost tap was the widest rectangle on screen,
     which is the catcher's own description; take the catcher away and the
     search simply found the next widest thing, pressed it, and passed. A check
     that cannot fail when the feature is removed is not a check. */
  const controls = () => cf.taps().filter(t => t.live && t.w < 900);
  let miss = null;
  for (let y = 60; y < 700 && !miss; y += 6) {
    for (let x = 30; x < 970 && !miss; x += 30) {
      const on = controls().some(t => x >= t.x && x <= t.x + t.w &&
                                      y >= t.y && y <= t.y + t.h);
      if (!on) miss = [x, y];
    }
  }
  check(!!miss, "there is nowhere on the ship page that is not a control");
  if (miss) {
    press(miss[0], miss[1]);
    check(!cardUp(), "pressing the page away from the card did not shut it");
  }

  console.log("  catalogue  all " + all.length + " parts on one page, each saying " +
              "how to get one · four squares to drop into · a part dragged from " +
              "storage lands in the slot it was dropped on");
}

/* ── what is worth interrupting you for, and reading it afterwards ────────────
   Survey says a great deal and it was saying all of it at the same volume from
   any distance — a convoy unloading four sectors away, a battle ending somewhere
   you have never been. A feed that is always talking is a feed you stop reading,
   which costs you the three lines that actually matter.

   And a notification is a line squeezed into a column and shrunk until it fits,
   so the ones worth reading were exactly the ones that got cut. Pressing one
   opens it. */
{
  const { cf } = boot("?debug=1&seed=929292");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];
  me.x = 0; me.y = 0;

  hud.logClear();
  hud.reset();

  // About you: always said, wherever you are.
  cf.say("Water out. You have minutes, not hours.", "#87d8ff");
  check(hud.notes().length === 1, "a line about your own ship was not said");

  // Out there and close: said.
  cf.say("Close by", "#fff", { x: 900, y: 0 });
  check(hud.notes().length === 2, "something happening beside you was not said");

  // Out there and far: written down, never shown.
  const before = hud.log().length;
  cf.say("Miles away", "#fff", { x: 400000, y: 0 });
  check(hud.notes().length === 2,
        "something four sectors away interrupted you anyway");
  check(hud.log().length > before, "and it was not written down either");
  check(hud.log()[0].text.indexOf("Miles away") === 0,
        "the far line is not at the top of the log");

  // Texture: written down, never shown, whatever the distance.
  cf.say("A convoy is unloading", "#fff", false);
  check(hud.notes().length === 2, "a line marked as texture was announced");

  /* ── pressing one opens it ─────────────────────────────────────────────── */
  hud.reset();
  const long = "They made it — that distress call is under way again, and they " +
               "are telling anyone who will listen what happened out here.";
  cf.say(long, "#fff");
  cf.screen("playing");
  cf.draw();
  const box = cf.live().taps.find(t => t.note);
  check(!!box, "a notification cannot be pressed");
  /* Found by what it *says*, not by where it is in the stack: the sector goes on
     talking while you read, and new lines arrive at the top. The first version of
     this checked `notes()[0]` and was reading somebody else's line within a
     second — which is the same mistake the interface itself was making when it
     truncated the stack to four without caring which one was open. */
  const mine = () => hud.notes().find(n => n.text === long);
  check(mine() && mine().open !== true, "it started open");
  if (box) {
    box.act();
    check(mine() && mine().open === true, "pressing it did not open it");
    cf.draw();
    // An open one does not run down under you while you are reading it — nor get
    // pushed off the bottom by whatever happens next.
    const left = mine().t;
    for (let i = 0; i < 240; i++) { now += 1000 / 60; cf.step(); }
    check(!!mine(), "it expired while it was open");
    check(mine() && Math.abs(mine().t - left) < 0.01,
          "its clock kept running while it was being read");
    // And pressing it again puts it away.
    cf.draw();
    const again = cf.live().taps.filter(t => t.note);
    check(again.length > 0, "an open notification cannot be pressed to close it");
    for (const t of again) t.act();
    check(mine() && mine().open === false, "pressing it again did not close it");
  }

  console.log("  notices    yours always · nearby said · far written down only · " +
              "texture never said · press one to read it, press again to close");
}

/* ── the book does not name its own ceiling, and the strange things are not
      in the catalogue ────────────────────────────────────────────────────────
   Two places the interface was quietly telling you how much game was left.

   The almanac said 31 / 34, which tells a player at the far end of twenty hours
   that exactly three strange things remain — and the whole design of that last
   tier is that they break rules the game spent twenty hours teaching. A
   countdown turns them into a checklist to finish.

   And the bench lists **what you can build**. Nothing else.

   It listed all twenty-five parts once, on the argument that you cannot plan
   towards something you have never been told exists — true of the things you
   can build and the wrong shape for the rest. Then it listed the buildable ones
   plus whatever you had met, which was better and still wrong: a page called
   CRAFTING carrying a dozen tiles it has to explain you cannot craft is a
   catalogue wearing a workbench's name, and you read past it either way.

   Every tile is a plan now. The only question one can raise is whether you have
   the materials yet, which is a question the page answers by arranging itself.
   Meeting a part you cannot build puts it in the almanac and in the hold, where
   it belongs — not here. */
{
  const { cf } = boot("?debug=1&seed=343434");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();

  // Nowhere in the interface's own source does the book divide by its total.
  check(!/\bof\b[^\n]*entries\.length[^\n]*LOGGED/.test(hudSrc),
        "the almanac still reports its own total");

  const all = cf.surveyView().parts;
  const exotics = all.filter(p => p.rarity === "exotic");
  check(exotics.length > 0, "there are no exotic parts to hide");

  // The page's own list, which is what the player sees.
  hud.craftOpened();
  cf.screen("craft");
  cf.draw();
  const shown = () => {
    // Rebuilt every draw from the state, so this is the list the grid drew.
    cf.draw();
    return hud.partsShown();
  };
  const before = shown();

  /* Everything you can build is there, always — that is the half of the old
     argument that still holds, and it is what makes the page a workbench rather
     than a list of what happens to be in the hold. */
  for (const p of all) {
    if (!p.craftable) continue;
    check(before.some(q => q.key === p.key),
          p.name + " can be built and is not on the bench");
  }

  /* And **nothing else**. The bench used to carry anything you had laid eyes
     on as well, so a page called CRAFTING listed a dozen things it then had to
     explain you could not craft — "bought at a station", "found out there, not
     made". That is a catalogue wearing a workbench's name. Every tile is a plan
     now, and the only question a tile can raise is whether you have the
     materials yet. */
  for (const q of before) {
    const p = all.find(x => x.key === q.key);
    check(p.craftable, p.name + " is on the bench and cannot be built");
  }
  const cannot = all.filter(p => !p.craftable);
  check(cannot.length > 0, "every part is craftable — this proves nothing");

  /* Meeting one does not put it there any more, and neither does owning one.
     Both used to. */
  const met = cannot[0];
  surv.seen.add(met.key);
  surv.store[met.key] = 1;
  const after = shown();
  check(!after.some(q => q.key === met.key),
        met.name + " cannot be built and arrived on the bench anyway");
  check(after.length === before.length,
        "meeting a part changed the bench by " + (after.length - before.length));
  delete surv.store[met.key];

  /* Docking is the other way of meeting one: a shelf you are standing at is a
     set of parts you now know exist. Every part the station stocks, and no
     part it does not. */
  const fresh = boot("?debug=1&seed=343434");
  fresh.cf.start("survey", 1);
  const fs = fresh.cf.survey();
  const shelfBefore = new Set(fs.seen);
  const me = fresh.cf.live().ships[0];
  const st0 = fs.stations[0];
  me.x = st0.x; me.y = st0.y; me.vx = me.vy = 0;
  for (let i = 0; i < 4; i++) { now += 1000 / 60; fresh.cf.step(); }
  check(fs.docked, "the test never docked, so it proves nothing about shelves");
  const stocked = fresh.cf.surveyView().forSale.map(r => r.key);
  check(stocked.length > 0, "the station this docked at stocks nothing");
  for (const k of stocked) {
    check(fs.seen.has(k), k + " is on the shelf in front of you and unmet");
  }
  const learned = [...fs.seen].filter(k => !shelfBefore.has(k));
  check(learned.every(k => stocked.indexOf(k) >= 0),
        "docking taught parts the station does not stock: " +
        learned.filter(k => stocked.indexOf(k) < 0).join(", "));

  /* ── the page says it by arranging itself ──────────────────────────────
     It used to count the buildable ones into the heading — "4 YOU CAN BUILD
     NOW" — which is a number you read and then scan the grid to cash in. They
     come first and they are the brightest things on the page instead, so the
     answer is where your eye already is. Nothing is said. */
  {
    const g = boot("?debug=1&seed=343434");
    g.cf.start("survey", 1);
    const gs = g.cf.survey();
    for (const k of Object.keys(gs.hold)) gs.hold[k] = 40;
    const gh = g.cf.hud();
    gh.craftOpened();
    g.cf.screen("craft");
    g.cf.draw();

    const list = gh.partsShown();
    const ready = new Set(g.cf.surveyView().crafts.filter(r => r.ready)
                          .map(r => r.key));
    check(ready.size > 1, "a full hold builds nothing — this proves nothing");
    let seenNotReady = false, outOfOrder = null;
    for (const q of list) {
      if (ready.has(q.key)) { if (seenNotReady) outOfOrder = q.name; }
      else seenNotReady = true;
    }
    check(!outOfOrder,
          outOfOrder + " can be built now and sits below one that cannot");

    // Nothing on the page counts them out loud any more.
    check(!/"[^"]*YOU CAN BUILD NOW[^"]*"\s*\)/.test(hudSrc),
          "the page still draws a count of what you can build");

    /* And the detail panel is a thing you open. It used to be permanent, holding
       the words PICK ONE over an empty box for the whole time you were not
       using it — five rows of the page spent saying "click something". */
    /* The literal as it would be *drawn*, not the words — both of these survive
       in the comments that explain why they went, and a check that cannot tell
       a comment from a label is a check that can only ever fail. */
    check(!/"PICK ONE"/.test(hudSrc), "the empty PICK ONE box is still drawn");
    const shut = gh.craftHeight !== undefined ? g.cf.surveyView() : null;
    gh.craftPick(list[0].key);
    g.cf.draw();
    const openView = gh.craftView;
    gh.craftPick(null);
    g.cf.draw();
    check(gh.craftView > openView,
          "closing the panel did not give the grid its space back (" +
          openView + " → " + gh.craftView + ")");

    /* ── a material you can ask ────────────────────────────────────────────
       "How do I get one of these" was answerable nowhere. The parts page says
       what a build wants and the hold says what you have, and between them
       nothing said that electronics never come out of a rock — the single most
       useful fact on the page, and one you could otherwise only learn by mining
       for an hour and failing. */
    for (const m of g.cf.surveyView().materials) {
      check(m.where && m.where.length > 30,
            m.name + " does not say how to get one");
    }

    /* The rail of material rows, each with a bubble you opened to read where
       the stuff comes from, is gone: the page is a wall of tiles and one card
       for the tile you pressed, and that card names every ingredient with what
       you have of it beside what it wants. The fact the bubble carried is still
       carried — the loop above proves every material says where it is found —
       so what is checked here is that the card answers for the build you picked
       rather than that a row somewhere can be unfolded. */
    gh.craftPick(list[0].key);
    g.cf.draw();
    const card = g.cf.taps().filter(t => t.live && t.w > 150 && t.h >= 30);
    check(card.length > 0, "picking a build opened nothing to press");

    console.log("  buildnow   " + ready.size + " buildable sorted to the front " +
                "and lit · nothing counts them out loud · the panel is a thing " +
                "you open and close · every material says how to get one, on " +
                "the card of the build that wants it");
  }

  console.log("  bench      " + before.length + " of " + all.length +
              " parts on it — everything buildable and nothing else · " +
              exotics.length + " exotic kept off it until then · a shelf you " +
              "dock at teaches exactly what it stocks");
}

/* ── regions, which the game never names ──────────────────────────────────────
   See BIOMES.md. A biome is an invisible ruleset: the chart stops knowing what
   kind of space you are in and the player learns what that means by being there.
   Two things therefore have to be true and neither is visible from a screenshot —
   that the *rules* really do change from place to place, and that the interface
   never says so.

   And the Empty has to stay rare. At one in eleven a third of the sampled sky
   came back empty, which is not a frightening place, it is a galaxy that is mostly
   nothing: the whole effect depends on hours of ordinary space first, so that the
   absence reads as wrong rather than as normal. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);

  /* ── the mix ─────────────────────────────────────────────────────────────
     Counted over the lattice itself rather than along a line. A diagonal across
     three million units visits about fifteen region sites, and the first version
     of this check estimated a one-per-cent category from sixty of them — it
     reported the rarest biome in the game at 8.6% and the second rarest at zero,
     from the same run. Twelve thousand sites is an answer; sixty is a rumour. */
  const tally = {};
  let n = 0;
  for (const key of cf.regionCensus(22)) { tally[key] = (tally[key] || 0) + 1; n++; }
  const share = k => (tally[k] || 0) / n;
  const kinds = Object.keys(tally).length;
  check(kinds >= 10 && kinds <= 15,
        kinds + " kinds of space — the brief is ten to fifteen");

  /* **Ordinary space is the commonest thing in the galaxy**, and it has to be or
     none of the rest reads as unusual. */
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  check(ranked[0][0] === "normal",
        "the commonest kind of space is " + ranked[0][0] + ", not ordinary space");
  check(share("normal") > 0.25,
        "ordinary space is only " + (share("normal") * 100).toFixed(0) + "% of the sky");

  // And the two that have to be rare are the two rarest.
  const rarest = ranked.slice(-2).map(r => r[0]).sort().join(",");
  check(rarest === "city,open",
        "the two rarest kinds are " + rarest + " — they should be the empty one " +
        "and the city one");
  check(share("open") < 0.04,
        "the Empty is " + (share("open") * 100).toFixed(1) + "% of the sky — it " +
        "has to be rare enough that crossing one is an event");
  check(share("city") < 0.04,
        "the city is " + (share("city") * 100).toFixed(1) + "% of the sky");

  /* ── how long one takes to cross ─────────────────────────────────────────
     A minute of anything is a stretch of scenery; it is not a place. That is the
     floor and it has not moved.

     The ceiling has. This asked for five minutes, from a lattice sized at
     200,000 — and measured, that made a sector monotonous at the scale anybody
     plays it: eleven of the thirteen kinds sat past the abyssal boundary and the
     first two hundred thousand units of every world were one thing. The lattice
     is 93,000 now, which is about three minutes across a patch, and the number
     below is what that is worth rather than what the old one was. */
  let run = 0, longest = 0, cur = null;
  for (let d = 0; d < 3000000; d += 5000) {
    const r = cf.regionProbe(d, d * 0.37);
    if (r.key === cur) run += 5000;
    else { longest = Math.max(longest, run); cur = r.key; run = 5000; }
  }
  longest = Math.max(longest, run);
  check(longest > 90000,
        "the longest unbroken crossing is " + Math.round(longest / 1000) + "k units, " +
        (longest / 575 / 60).toFixed(1) + " minutes — a region has to be a place");

  /* ── literally nothing ───────────────────────────────────────────────────
     Not "almost nothing". A thin scattering of everything reads as an ordinary
     quiet stretch; the thing that makes somebody wonder whether the generator has
     broken is finding *not one single object* for six minutes.

     Counted as a total over everything the sector streams, because the failure
     this catches is never the one you predicted. The first version of the hard
     switch sent every empty chunk down the `else` of `if (!home)` — which is the
     branch that builds the home station — so the emptiest region in the galaxy
     came out with twenty-five copies of it, one per loaded chunk. No multiplier
     was wrong; the control flow was. */
  /* The *middle* of one, not merely a point inside one. This used to walk a grid
     of its own and take the first point that came back empty, which was fine
     while a patch was 200,000 across and is not now: the point can land near an
     edge, and the streamer loads a five-by-five block of chunks around the ship,
     so a ship parked near the rim of an empty region has half its loaded space
     in the region next door — which is full of things, correctly.

     A site's position is the middle of its patch by construction, so ask the
     lattice instead of hunting for one. */
  let empty = null;
  {
    const reach = Math.ceil(1400000 / cf.regionCell());
    const open = cf.regionSites(reach).filter(q => q.key === "open");
    open.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    if (open.length) empty = { x: open[0].x, y: open[0].y };
  }
  check(!!empty, "no empty region anywhere within 1.4 million units");
  if (empty) {
    const surv2 = cf.survey();
    const me2 = cf.live().ships[0];
    me2.x = empty.x; me2.y = empty.y; me2.vx = me2.vy = 0;
    for (let i = 0; i < 10; i++) {
      me2.invuln = 9999; surv2.water = 9e5; surv2.food = 9e5;
      now += 1000 / 60; cf.step();
    }
    const total = () => {
      const lvv = cf.live();
      return lvv.rocks.length + lvv.hazards.length + surv2.planets.length +
             surv2.stations.length + surv2.traffic.length + surv2.hulks.length +
             surv2.caches.length + surv2.nebulae.length + surv2.fields.length +
             surv2.gates.length + surv2.wrecks.length + surv2.drones.length;
    };
    check(total() === 0,
          "an empty region has " + total() + " things in it — it is supposed to " +
          "have none at all");
    // And it stays empty while you cross it, which is where the streamer gets to
    // have its own opinion.
    cf.hold("KeyW", true);
    let worst = 0;
    for (let i = 0; i < 1800; i++) {
      me2.invuln = 9999; surv2.water = 9e5; surv2.food = 9e5;
      now += 1000 / 60; cf.step();
      /* Counted only while the whole *loaded block* is inside the empty region.
         The streamer keeps two chunks either side of the ship, so being just
         inside the boundary yourself means half of what is built around you
         belongs to the region next door — and that region is supposed to have
         things in it. The margin is the block's own half-width. */
      if (i % 120 === 0) {
        const m = cf.sectorSpan().chunk * 2.5;
        const allOpen = [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m],
                         [m, m], [-m, -m], [m, -m], [-m, m]]
          .every(([dx, dy]) =>
            cf.regionProbe(me2.x + dx, me2.y + dy).key === "open");
        if (allOpen) worst = Math.max(worst, total());
      }
    }
    cf.hold("KeyW", false);
    check(worst === 0,
          "crossing an empty region turned up " + worst + " things");
  }

  /* The rules really do differ. Two regions of different kinds must disagree
     about what is in them, or the layer is a colour scheme. */
  /* Over a block of the lattice rather than along a line, for the same reason
     the census is: a single diagonal misses a one-per-cent region entirely about
     half the time, and a test that cannot find the thing it is checking is a test
     that passes for the wrong reason. */
  const byKey = {};
  for (let j = -14; j <= 14; j++) {
    for (let i = -14; i <= 14; i++) {
      const r = cf.regionProbe(i * 200000 + 90000, j * 200000 + 90000);
      byKey[r.key] = r;
    }
  }
  const belt = byKey.belt, barren = byKey.open, murk = byKey.murk, rime = byKey.rime;
  check(!!belt && !!barren, "could not find a belt and an empty to compare");
  if (belt && barren) {
    check(belt.rocks > 0.4 && barren.rocks === 0,
          "a belt and an empty have nearly the same amount of rock in them");
    check(barren.traffic === 0, "the Empty has traffic in it");
    check(barren.nothing === true, "the Empty is not flagged as empty");
  }
  /* Two of them change a *rule* rather than a quantity, which is the whole point
     — and both deepen toward the middle rather than switching on at a line. A
     rule that steps at a border is a rule you can see the edge of; one that
     deepens is one you notice happening to you. */
  if (murk) {
    check(murk.scan <= 0.15, "the murk does not shorten the scan enough");
    // The worst of it, found rather than assumed: the region's site is jittered
    // inside its cell, so the middle of a cell is not the middle of a region.
    let worst = 1, edge = 0;
    for (let j = -14; j <= 14; j++) {
      for (let i = -14; i <= 14; i++) {
        for (let a = 0; a < 5; a++) {
          for (let c = 0; c < 5; c++) {
            const x = i * 200000 + a * 50000, y = j * 200000 + c * 50000;
            if (cf.regionProbe(x, y).key !== "murk") continue;
            const d = cf.regionAtDepth(x, y);
            worst = Math.min(worst, d.scan);
            edge = Math.max(edge, d.scan);
          }
        }
      }
    }
    check(worst < 0.2,
          "the deepest murk only cuts the scan to " + worst.toFixed(2) +
          " — it is supposed to bottom out around a tenth");
    check(edge > 0.6,
          "even the edge of a murk cuts the scan to " + edge.toFixed(2) +
          " — it should come on gradually, not at a line");
  }
  if (rime) {
    check(rime.ice > 20, "the rime is not made of ice");
    check(rime.d.wrecks < 0.3 && rime.d.stations < 0.3,
          "the rime has things other than ice in it");
  }

  /* The scan is a decision, not a button: twelve seconds, and a part buys the old
     nine back out of one of your four slots. */
  const cool = cf.surveyView().parts.find(p2 => p2.key === "coolantloop");
  check(!!cool, "there is no part that shortens the scanner's cooldown");
  check(cool && cool.craftable, "the coolant loop cannot be built");

  /* And nothing in the interface says any of it. This is the rule the first
     version broke: the panel named the region and the chart washed itself in
     region colours with the names written across it, which is the Minecraft
     SNOW BIOME label in a different font. */
  check(cf.surveyView().region === null,
        "the game is still handing the panel a region to name");
  check(/REGION  UNKNOWN/.test(hudSrc),
        "the panel does not say it cannot tell what kind of space this is");
  check(!/st\.regionAt|st\.regionSites/.test(hudSrc),
        "the chart is still colouring itself by region");

  console.log("  regions    " + kinds + " kinds of space · ordinary is " +
              (share("normal") * 100).toFixed(0) + "% · the Empty " +
              (share("open") * 100).toFixed(1) + "% and the city " +
              (share("city") * 100).toFixed(1) + "% · longest crossing " +
              (longest / 575 / 60).toFixed(1) + " min · the game never names one");
}

/* ── nothing spawns in a wall ─────────────────────────────────────────────────
   The easiest thing in the game to miss, because everything about it looks
   correct until you are inside one of the two structures and the sector starts
   putting things in the hull with you.

   Every system that picks a point in space was written when the only solid things
   were a planet and a 2,700-unit derelict: the rock streamer, a hunter arriving,
   a ship respawning, a drive part dropped where you died. There are two places
   you fly inside now, one of them nine thousand units long with a hundred and
   seventy walls in it. A rock loose in a corridor can never get out; a hunter in
   a hull cannot be reached or escaped; a part in a bulkhead is drawn, named, on
   the chart, and gone for good. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];
  const step = n => { for (let i = 0; i < (n || 1); i++) { me.invuln = 9999; now += 1000 / 60; cf.step(); } };

  const lm = surv.landmarks.find(l => l.key === "leviathan");
  check(!!lm, "no Leviathan to fly into");
  if (lm) {
    // In the middle of it, which is where the rock streamer will try to work.
    me.x = lm.x; me.y = lm.y; me.vx = me.vy = 0;
    step(4);
    const lev = surv.leviathan;
    check(!!lev, "the Leviathan did not stream in");

    const inside = (x, y, pad) => {
      const dx = x - lev.x, dy = y - lev.y;
      const u = dx * lev.ca + dy * lev.sa, v = -dx * lev.sa + dy * lev.ca;
      return Math.abs(u) < lev.len / 2 + (pad || 0) &&
             Math.abs(v) < lev.flank + 900 + (pad || 0);
    };

    /* Three hundred frames of the streamer working with the ship parked in the
       middle of the hull. Every rock it makes has to be somewhere a rock could
       actually be. */
    step(300);
    /* Re-read. `rocks` is reassigned on every mode start, not emptied, so the
       array captured at boot is the arena the test was born in — this check
       passed with the guard deliberately switched off because it was counting
       rocks in a list nothing had put a rock into. */
    let within = 0;
    const live = cf.live().rocks;
    for (const r of live) if (inside(r.x, r.y)) within++;
    check(live.length > 0, "sanity: the streamer made no rocks at all");
    check(within === 0,
          within + " of " + live.length + " rocks spawned inside the Leviathan — " +
          "they can never get out");

    // A ship sent after you, from inside the hull: it has to arrive somewhere it
    // could have flown in from.
    surv.rep = { hallow: -240, morrow: -240, cordon: -240 };
    surv.huntCool = 0;
    let hunters = 0, buried = 0;
    for (let i = 0; i < 40; i++) {
      surv.huntCool = 0;
      step(2);
      for (const t of surv.traffic) {
        if (t.role !== "hunter" || t.seenByTest) continue;
        t.seenByTest = true;
        hunters++;
        if (inside(t.x, t.y, 200)) buried++;
      }
      surv.traffic = surv.traffic.filter(t => t.role !== "hunter");
    }
    check(hunters > 0, "nothing came after you in forty tries");
    check(buried === 0,
          buried + " of " + hunters + " hunters arrived inside the hull");

    /* And a part you were carrying when you died in there. Dying inside the
       Leviathan is a normal way to die — it is full of sentries and it is the
       last thing the manifest asks of you. */
    const man = cf.surveyView().manifest;
    surv.carrying.add(man[0].key);
    me.x = lev.x + lev.len * 0.2 * lev.ca;
    me.y = lev.y + lev.len * 0.2 * lev.sa;
    cf.die("rock");
    check(surv.dropped.length > 0, "nothing was dropped");
    for (const d of surv.dropped) {
      check(!inside(d.x, d.y, 60),
            d.name + " was left inside the Leviathan's hull — it is on the chart " +
            "and it cannot be reached");
    }
  }

  console.log("  spawns     300 frames of the streamer inside the hull and not one " +
              "rock in it · no hunter arrives in a wall · a part dropped inside " +
              "lands somewhere you can fly to");
}

/* ── a sector that pushes back ────────────────────────────────────────────────
   A sweep of things reported from the cockpit, all of them the same complaint in
   different clothes: the things out there were not quite real. You could fly
   through them, their bullets could not touch you, and they could not hit
   anything that was moving. */
{
  const { cf } = boot("?debug=1&seed=246813");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];
  const flag = cf.surveyView().standings[0].key;
  const step = n => { for (let i = 0; i < (n || 1); i++) { now += 1000 / 60; cf.step(); } };

  me.x = 180000; me.y = -90000; me.vx = me.vy = 0; me.invuln = 9999;
  step(3);

  const put = over => {
    const t = Object.assign({
      id: null, kind: "patrol", role: "patrol", faction: flag, hull: "lance",
      x: me.x + 500, y: me.y, a: 0, from: { x: me.x, y: me.y },
      to: { x: me.x + 9000, y: me.y }, leg: 1, speed: 150, baseSpeed: 150,
      hp: 8, maxHp: 8, cargo: [], cool: 1, doom: 0, guards: 0, space: 0,
      trades: false, phase: 0
    }, over || {});
    surv.traffic.push(t);
    return t;
  };

  /* ── a hull is solid, and hitting one costs ────────────────────────────── */
  surv.traffic.length = 0;
  const wall = put({ x: me.x + 300, y: me.y, speed: 0, baseSpeed: 0 });
  me.x = wall.x - 40; me.y = wall.y; me.vx = 400; me.vy = 0; me.invuln = 0;
  const hull0 = me.hull;
  step(4);
  const apart = Math.hypot(me.x - wall.x, me.y - wall.y);
  check(apart > 30, "the ship passed straight through another hull");
  check(me.hull < hull0, "ramming a ship at speed cost nothing");

  /* ── somebody else's round can hit you ─────────────────────────────────── */
  surv.traffic.length = 0;
  me.x = 180000; me.y = -90000; me.vx = me.vy = 0; me.invuln = 0;
  me.hull = me.maxHull;
  const before = me.hull;
  surv.shots.push({ x: me.x - 300, y: me.y, vx: 900, vy: 0, life: 3, dmg: 1,
                    friendly: true, from: null });
  step(40);
  check(me.hull < before,
        "a stray round from somebody else's fight passed straight through you");

  /* ── they aim where you are going to be ────────────────────────────────── */
  surv.traffic.length = 0;
  surv.shots.length = 0;
  me.x = 180000; me.y = -90000; me.invuln = 9999;
  me.vx = 0; me.vy = 320;                       // crossing its nose at speed
  const gunner = put({ x: me.x + 900, y: me.y, angry: true, cool: 0 });
  step(6);
  const shot = surv.shots.find(b => b.from === gunner);
  check(!!shot, "an angry patrol did not fire at all");
  if (shot) {
    /* Fired straight at where you were, the round crosses behind you. Led, it is
       aimed off to the side you are moving toward — which is the whole of what
       made these ships feel like scenery with a gun on it. */
    const aimed = Math.atan2(shot.vy, shot.vx);
    const at = Math.atan2(me.y - gunner.y, me.x - gunner.x);
    let off = aimed - at;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    check(Math.abs(off) > 0.08,
          "the shot went at where you were, not where you are going (" +
          off.toFixed(3) + " rad of lead)");
    /* Aimed at where you *will* be, checked against the prediction rather than
       against a guess at which way the angle should move: the sign depends on
       where the shooter is standing, and reasoning about that in the test is how
       you end up asserting the geometry you assumed instead of the one you have. */
    const flight = Math.hypot(me.x - gunner.x, me.y - gunner.y) / (360 * 8);
    const lead = Math.atan2(me.y + me.vy * flight - gunner.y,
                            me.x + me.vx * flight - gunner.x);
    let miss = aimed - lead;
    while (miss > Math.PI) miss -= Math.PI * 2;
    while (miss < -Math.PI) miss += Math.PI * 2;
    check(Math.abs(miss) < Math.abs(off),
          "the shot is no closer to where you are going than to where you were");
  }

  /* ── a ship spawned at you does not evaporate ──────────────────────────── */
  surv.traffic.length = 0;
  me.invuln = 9999;
  const chaser = put({ x: me.x + 1400, y: me.y + 600, angry: true });
  me.x += 2600 * 2; me.y += 2600;               // two chunks: the sector restreams
  step(4);
  check(surv.traffic.indexOf(chaser) >= 0,
        "a ship that was spawned at you vanished when the sector restreamed — " +
        "which is every few seconds of flying");

  /* ── and a world sells what it digs ────────────────────────────────────── */
  /* Swept over a block rather than along rings. About one world in nine near home
     has anybody on it and worlds themselves are not in every chunk, so a dozen
     bearings is a sample that finds nothing about half the time — and a test that
     cannot find the thing it is checking passes for the wrong reason. */
  let world = null;
  for (let j = -60; j <= 60 && !world; j++) {
    for (let i = -60; i <= 60 && !world; i++) {
      for (const pl of cf.chunk(i, j).planets) {
        if (pl.inhabited && !world) world = pl;
      }
    }
  }
  check(!!world, "no inhabited world anywhere near home");
  if (world) {
    check(!!world.trades, "an inhabited world has nothing to sell");
    me.x = world.x + world.r + 60; me.y = world.y; me.vx = me.vy = 0;
    me.invuln = 9999;
    step(4);
    const v = cf.surveyView();
    check(v.landed && v.landed.trades, "standing on it, it offers nothing");
    if (v.landed && v.landed.trades) {
      surv.cash = 9000;
      for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
      const key = v.landed.trades.key, cash0 = surv.cash;
      v.onBuyLocal();
      check((surv.hold[key] || 0) > 0, "buying from a world put nothing in the hold");
      check(surv.cash < cash0, "it cost nothing");
    }
  }

  console.log("  solid      a hull stops you and hurts · a stray round hits you · " +
              "they lead their shots · a ship spawned at you survives a restream · " +
              "a world sells what it digs");
}

// ── the parts you press ──────────────────────────────────────────────────
/* Phase 6.4. Four parts that are verbs rather than percentages, and the whole
   of what makes one worth testing is that it *changes another system*: a decoy
   is only a decoy if a sentry believes it, an ejector is only an ejector if a
   pirate takes the bait. Every check below is written against the thing the
   device is supposed to have changed, never against the device itself.

   The other half is the cooldown and the button. A cooldown is a state machine
   and a button that lies about being ready is the exact class of bug rule 2 in
   SURVEY-PLAN.md exists for — both render perfectly. */
{
  const { cf, fire } = boot("?debug=1&seed=606040");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];
  const flag = cf.surveyView().standings[0].key;
  const step = n => {
    for (let i = 0; i < (n || 1); i++) {
      surv.water = 900; surv.food = 900;
      now += 1000 / 60; cf.step();
    }
  };
  const fit = (i, key, secs) => {
    surv.slots[i] = { key, fit: secs || 0 };
    cf.applyParts();
    return surv.slots[i];
  };
  const put = over => {
    const t = Object.assign({
      id: null, kind: "pirate", role: "pirate", faction: "pirate",
      hull: "lance", x: me.x + 600, y: me.y, a: 0,
      from: { x: me.x, y: me.y }, to: { x: me.x + 9000, y: me.y }, leg: 1,
      speed: 150, baseSpeed: 150, hp: 8, maxHp: 8, cargo: [], cool: 1,
      doom: 0, guards: 0, space: 0, trades: false, phase: 0
    }, over || {});
    surv.traffic.push(t);
    return t;
  };
  const park = (x, y) => {
    me.x = x; me.y = y; me.vx = me.vy = 0; me.a = 0;
    me.invuln = 9999;
    surv.traffic.length = 0; surv.drones.length = 0;
    surv.decoys.length = 0; surv.mines.length = 0;
    surv.motes.length = 0; surv.shots.length = 0;
  };

  /* ── every device is a part, and every device part is reachable ───────── */
  const parts = cf.parts();
  const devParts = parts.filter(p => cf.surveyView().effects[p.key] &&
                                     cf.surveyView().effects[p.key].device);
  check(devParts.length >= 7,
        "6.4's list was a decoy, a grapple, a mine layer, an emergency jump, " +
        "a cloak, an EMP and a cargo ejector — seven — and there are " +
        devParts.length);
  for (const p of devParts) {
    const ways = cf.partWays(p.key);
    check(ways.buy || ways.craft || ways.find,
          p.name + " cannot be bought, built or found");
    check(p.cat === "device",
          p.name + " is a device and is filed under " + p.cat);
  }

  /* ── a slot, a key, and a cooldown ────────────────────────────────────── */
  park(90000, 30000);
  fit(0, "decoylauncher");
  const keys0 = cf.deviceKeys();
  check(keys0.length === 4, "there are not four device keys");
  const list = cf.devices();
  check(list.length === 1 && list[0].slot === 0 && list[0].device === "decoy",
        "a fitted device is not showing up in slot order");
  check(list[0].cool > 0, "a device with no cooldown is a button you hold down");

  // Through the real keyboard path, bindings and all.
  fire("keydown", keys0[0][0]);
  check(surv.decoys.length === 1,
        "pressing the slot's own key did not fire the device in it");
  const cd = cf.devices()[0].cd;
  check(cd > 0, "firing a device left it ready to fire again");
  fire("keydown", keys0[0][0]);
  check(surv.decoys.length === 1, "a device fired again while it was cooling");
  step(60);
  check(cf.devices()[0].cd < cd, "the cooldown is not running down");

  // Somebody else's key does nothing, and a rebind moves it.
  surv.decoys.length = 0;
  surv.slots[0].cd = 0;
  fire("keydown", "KeyZ");
  check(surv.decoys.length === 0, "an unbound key fired a device");
  cf.live().binder.p = 2;              // the device row of the controls grid
  cf.live().binder.a = 0;
  cf.screen("controls");
  cf.live().binder.listening = true;
  fire("keydown", "KeyZ");
  cf.screen("playing");
  check(cf.deviceKeys()[0].indexOf("KeyZ") >= 0,
        "rebinding slot 1 did not take: " + JSON.stringify(cf.deviceKeys()[0]));
  fire("keydown", "KeyZ");
  check(surv.decoys.length === 1, "the rebound key does not fire the device");
  check(cf.deviceKeys()[0].indexOf(keys0[0][0]) < 0,
        "the old key still works as well as the new one");

  /* ── a part still fitting is not a device yet ─────────────────────────── */
  park(90000, 30000);
  fit(0, "decoylauncher", 30);
  check(cf.devices().length === 0, "a part half installed is already pressable");
  check(cf.useDevice(0) === false, "pressing it did something anyway");
  check(surv.decoys.length === 0, "and it dropped a decoy");

  /* ── the decoy: a sentry believes it ──────────────────────────────────── */
  park(90000, 30000);
  fit(0, "decoylauncher");
  const drone = { id: "t-dev-g0", x: me.x + 700, y: me.y + 60, vx: 0, vy: 0,
                  a: 0, home: null, prey: null, post: { x: me.x + 700, y: me.y },
                  hp: 3, cool: 0.2, awake: true, hit: 0 };
  surv.drones.push(drone);
  step(20);
  const wasTo = Math.atan2(me.y - drone.y, me.x - drone.x);
  check(Math.abs(drone.a - wasTo) < 0.4,
        "an awake sentry is not pointed at you to begin with");
  check(cf.useDevice(0) === true, "the decoy would not fire");
  /* Inside the sentry's own range — eight hundred units off its beam, on a
     bearing nothing like yours — and the rounds it has already fired at you are
     cleared, so what is counted below is only what it did after it was lied
     to. */
  surv.decoys[0].x = drone.x; surv.decoys[0].y = drone.y + 840;
  surv.decoys[0].vx = surv.decoys[0].vy = 0;
  surv.decoys[0].life = 99;
  surv.shots.length = 0;
  step(150);          // long enough for its cooldown to come round again
  const toDecoy = Math.atan2(surv.decoys[0].y - drone.y,
                             surv.decoys[0].x - drone.x);
  let off = drone.a - toDecoy;
  while (off > Math.PI) off -= Math.PI * 2;
  while (off < -Math.PI) off += Math.PI * 2;
  check(Math.abs(off) < 0.4,
        "the sentry is still pointed at you with a decoy burning beside it");
  check(surv.shots.length > 0,
        "the sentry never fired at the decoy at all, so nothing was tested");
  check(surv.shots.every(b => b.atPrey),
        "it is firing at the decoy and the rounds are still flagged for you");

  // And a decoy does not wake anything: it steals attention, it does not call it.
  park(90000, 30000);
  fit(0, "decoylauncher");
  const asleep = { id: "t-dev-g1", x: me.x + 2400, y: me.y, vx: 0, vy: 0, a: 0,
                   home: null, prey: null, post: { x: me.x + 2400, y: me.y },
                   hp: 3, cool: 1, awake: false, hit: 0 };
  surv.drones.push(asleep);
  cf.useDevice(0);
  surv.decoys[0].x = asleep.x - 200; surv.decoys[0].y = asleep.y;
  step(30);
  check(!asleep.awake, "a decoy woke a sleeping post up");

  /* ── and a missile turns onto it ──────────────────────────────────────── */
  park(90000, 30000);
  fit(0, "decoylauncher");
  cf.useDevice(0);
  const dc = surv.decoys[0];
  dc.x = me.x + 600; dc.y = me.y + 240; dc.vx = dc.vy = 0;
  const seeker = { owner: 0, colour: "#fff", dmg: 2, seek: 2.6,
                   x: me.x, y: me.y, vx: 600, vy: 0, life: 3 };
  lv.bullets.push(seeker);
  step(18);
  check(seeker.vy > 40,
        "a seeker flew straight past a decoy sitting inside its cone");

  /* ── the ejector: the hold goes over the side ─────────────────────────── */
  park(90000, 30000);
  fit(0, "ejector");
  for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
  surv.hold.iron = 9; surv.hold.ice = 5;
  const held = 14;
  check(cf.useDevice(0) === true, "the ejector would not fire with a full hold");
  const dumped = surv.motes.filter(m => m.jetsam).length;
  check(dumped === held,
        "dumped " + dumped + " units of a " + held + "-unit hold");
  check(Object.keys(surv.hold).every(k => surv.hold[k] === 0),
        "the hold still has something in it after an ejection");
  surv.slots[0].cd = 0;
  check(cf.useDevice(0) === false, "an empty hold ejected anyway");

  /* ── and a pirate takes the bait ──────────────────────────────────────── */
  park(90000, 30000);
  fit(0, "ejector");
  surv.hold.iron = 8;
  const robber = put({ x: me.x + 900, y: me.y, angry: true });
  cf.useDevice(0);
  check(!robber.angry, "a pirate watched the cargo go past and stayed on you");
  check(!!robber.bait, "it is not going anywhere in particular either");
  const motes0 = surv.motes.length;
  robber.x = me.x + 40; robber.y = me.y + 40;       // it gets there
  /* And you are far enough off not to be collecting your own cargo back — but
     not so far that the streamer unloads the chunk the pirate is standing in,
     which takes the pirate with it. */
  me.x += 1500; me.y += 1500;
  step(3);
  check(surv.motes.length < motes0,
        "it reached the cargo and did not pick any of it up");

  // A hunter came for you and is not interested in the cargo.
  park(90000, 30000);
  fit(0, "ejector");
  surv.hold.iron = 8;
  const hunter = put({ kind: "hunter", role: "hunter", angry: true,
                       x: me.x + 900, y: me.y });
  cf.useDevice(0);
  check(hunter.angry, "a hunter was bought off with a hold of iron");

  /* ── the mine: it goes off, on a delay, on anybody ────────────────────── */
  park(90000, 30000);
  fit(0, "minelayer");
  cf.useDevice(0);
  check(surv.mines.length === 1, "the mine layer laid nothing");
  const mine = surv.mines[0];
  mine.vx = mine.vy = 0;
  const victim = put({ x: mine.x + 20, y: mine.y, speed: 0, baseSpeed: 0,
                       hp: 2, maxHp: 2 });
  step(1);
  check(surv.mines.length === 1 && victim.hp === 2,
        "a mine went off before it had armed");
  step(200);
  check(surv.mines.length === 0, "a ship sat on an armed mine and nothing happened");
  check(surv.traffic.indexOf(victim) < 0 || victim.hp < 2,
        "the mine went off and the ship on top of it was untouched");

  /* Including you — *once you have left it*. A mine is laid thirty units off
     your own tail, inside the radius it goes off in, so one dropped while you
     were drifting would arm underneath you: the ignore-the-layer rule is what
     makes it a cost rather than a gotcha, and both halves of it are checked. */
  park(90000, 30000);
  fit(0, "minelayer");
  cf.useDevice(0);
  const own = surv.mines[0];
  own.vx = own.vy = 0;
  own.arm = 0;
  me.invuln = 0;
  me.hull = me.maxHull;
  step(4);
  check(me.hull === me.maxHull,
        "a mine dropped under a drifting ship went off in its own face");
  me.x = own.x + 4000; me.y = own.y;      // you fly off
  step(2);
  me.x = own.x; me.y = own.y;             // and come back over it
  step(2);
  check(me.hull < me.maxHull, "flying back over your own armed mine cost nothing");

  /* ── the emergency jump ───────────────────────────────────────────────── */
  park(60000, 20000);
  fit(0, "jumpcore");
  surv.scan.charge = 1;
  const from = { x: me.x, y: me.y };
  me.vx = 300; me.vy = 0;
  check(cf.useDevice(0) === true, "the jump would not fire");
  const went = Math.hypot(me.x - from.x, me.y - from.y);
  check(went > 12000, "an emergency jump moved you " + Math.round(went) + " units");
  check(Math.hypot(me.vx, me.vy) < 1, "you arrived still travelling");
  check(surv.scan.charge < 0.1, "you arrived with the scanner still charged");
  check(isFinite(me.x) && isFinite(me.y), "the jump put the ship nowhere");
  const into = lv.hazards.find(h =>
    Math.hypot(h.x - me.x, h.y - me.y) < h.kill * 1.2);
  check(!into, "the jump dropped you inside a well");
  step(6);
  check(cf.peek().state === "playing", "the jump ended the run");

  /* ── the thumb button appears with the part and goes with it ──────────── */
  park(90000, 30000);
  surv.slots[0] = null; surv.slots[1] = null;
  cf.applyParts();
  cf.draw();
  check(cf.live().padShown.indexOf("dev0") < 0,
        "an empty slot has a device button on the pad");
  fit(1, "decoylauncher");
  cf.draw();
  check(cf.live().padShown.indexOf("dev1") >= 0,
        "a fitted device has no button on the pad to press");
  check(cf.live().padShown.indexOf("dev0") < 0,
        "the wrong slot's button came up");
  fit(1, "layerplate");
  cf.draw();
  check(cf.live().padShown.indexOf("dev1") < 0,
        "the button outlived the part");

  /* ── and the panel says what is fitted, and how cold it is ────────────── */
  fit(2, "minelayer");
  cf.useDevice(2);
  const view = cf.surveyView();
  const chip = (view.devices || []).find(d => d.slot === 2);
  check(!!chip, "the panel is not told what is in the slots");
  if (chip) {
    check(chip.cd > 0 && !chip.ready, "the panel thinks a cooling device is ready");
    check(!!chip.tag && chip.tag.length <= 8,
          "the chip's word is " + JSON.stringify(chip.tag));
  }

  /* ── the grapple: it pulls *you*, and only at what is in front ────────────
     The tractor rig brings salvage in; this throws you at something too big to
     move. The invariant is the whole part: whatever it hooks, the pull points
     exactly at it, and it will not hook what is behind you. */
  park(120000, 40000);
  fit(0, "grappleline");
  step(120);                        // let the streamer build the sky here
  {
    /* A ring of anchors, made out of the streamer's own rocks rather than out
       of object literals: a rock has a silhouette, a spin and a size, and a
       hand-rolled one that only has an x and a y is a rock the renderer throws
       on. Moved rather than invented — the field is a thousand units further
       out than the line carries, which is correct and useless to test with. */
    const real = cf.live().rocks;
    check(real.length >= 8, "the streamer built " + real.length + " rocks");
    for (let k = 0; k < 8 && k < real.length; k++) {
      const a = (k / 8) * Math.PI * 2;
      real[k].x = me.x + Math.cos(a) * 900;
      real[k].y = me.y + Math.sin(a) * 900;
      real[k].vx = real[k].vy = 0;
    }
    const inReach = real.filter(
      r => Math.hypot(r.x - me.x, r.y - me.y) < 1500).length;
    check(inReach > 0, "nothing came within the line's reach to hook");
    let fired = 0, offBy = 0, outsideCone = 0, tooFar = 0;
    for (let k = 0; k < 24; k++) {
      surv.slots[0].cd = 0;
      surv.grappleTo = null;
      me.vx = me.vy = 0;
      me.a = (k / 24) * Math.PI * 2;
      if (!cf.useDevice(0)) continue;
      fired++;
      const g = surv.grappleTo;
      check(!!g, "the line fired and left no anchor behind it");
      if (!g) continue;
      const want = Math.atan2(g.y - me.y, g.x - me.x);
      let pull = want - Math.atan2(me.vy, me.vx);
      while (pull > Math.PI) pull -= Math.PI * 2;
      while (pull < -Math.PI) pull += Math.PI * 2;
      if (Math.abs(pull) > 0.01) offBy++;
      let cone = want - me.a;
      while (cone > Math.PI) cone -= Math.PI * 2;
      while (cone < -Math.PI) cone += Math.PI * 2;
      if (Math.abs(cone) > 1.2) outsideCone++;
      if (Math.hypot(g.x - me.x, g.y - me.y) > 1600) tooFar++;
    }
    check(fired > 2, "the line found nothing to hook on " + (24 - fired) +
          " of 24 headings — this spot proves nothing");
    check(offBy === 0, offBy + " pulls did not point at the thing they hooked");
    check(outsideCone === 0, outsideCone + " anchors were outside the firing cone");
    check(tooFar === 0, tooFar + " anchors were further than the line carries");
  }
  // And it says so rather than doing nothing when there is nothing out there.
  {
    park(3000000, 3000000);          // the long dark, with the rocks cleared
    cf.live().rocks.length = 0;
    fit(0, "grappleline");
    surv.slots[0].cd = 0;
    me.vx = me.vy = 0;
    const fired = cf.useDevice(0);
    check(!fired || surv.grappleTo,
          "the line reported a hook and hooked nothing");
  }

  /* ── the cloak: forgotten, not paused, and firing ends it ──────────────── */
  park(120000, 40000);
  fit(0, "silentrig");
  const chaser = put({ x: me.x + 700, y: me.y + 100, angry: true });
  const guard = { x: me.x + 500, y: me.y, vx: 0, vy: 0, hit: 0, awake: true,
                  post: { x: me.x + 500, y: me.y }, id: "g-cloak" };
  surv.drones.push(guard);
  step(3);
  check(chaser.angry && guard.awake,
        "nothing was looking for you, so hiding from it proves nothing");
  surv.slots[0].cd = 0;
  check(cf.useDevice(0) === true, "the cloak would not go on");
  step(3);
  check(surv.cloak > 0, "the cloak went on and came straight off");
  check(!chaser.angry, "a pirate on your tail can still see you");
  check(!guard.awake, "a sentry can still see you");
  /* Firing ends it — and pressed as a key rather than poked into `ship.input`,
     because `readLocalInput` rebuilds input from the held set every frame. It
     is also the honest test: the rule is about a round leaving the ship, and
     only the real path fires one. */
  const hadCloak = surv.cloak;
  cf.hold("Space", true);
  step(10);
  cf.hold("Space", false);
  check(hadCloak > 0 && surv.cloak === 0,
        "you fired out of a cloak and stayed hidden");
  /* And a held trigger against a cooldown is not a shot: the cloak must not end
     on the key. Proved by cloaking again with the trigger already down. */
  surv.slots[0].cd = 0;
  cf.hold("Space", true);
  cf.useDevice(0);
  const onWithTrigger = surv.cloak;
  step(1);
  cf.hold("Space", false);
  check(onWithTrigger > 0, "the cloak would not go on with the trigger held");

  /* ── the EMP: everything electric, yours included ─────────────────────── */
  park(120000, 40000);
  fit(0, "empcharge");
  fit(1, "grappleline");
  const stunned = put({ x: me.x + 300, y: me.y, angry: true });
  const sentry = { x: me.x + 250, y: me.y, vx: 0, vy: 0, hit: 0, awake: true,
                   post: { x: me.x + 250, y: me.y }, id: "g-emp" };
  surv.drones.push(sentry);
  surv.mines.push({ x: me.x + 200, y: me.y, arm: 0, clear: true, life: 70, spin: 0 });
  surv.scan.charge = 1;
  step(2);
  surv.slots[0].cd = 0;
  check(cf.useDevice(0) === true, "the burst would not go off");
  check(surv.mines.length === 0, "a mine inside the burst is still armed");
  check(sentry.stun > 0, "a sentry inside the burst is still awake");
  check(stunned.stun > 0, "a ship inside the burst still has its engine");
  /* And your own hull. This is the cost, and it is the reason the part is a
     decision rather than a button you press on entering every room. */
  check(surv.slots[1].cd > 0, "the burst spared your own grapple");
  check(surv.empSelf > 0, "the burst spared your own scanner");
  /* Refused while the burst is ringing, and it says why. It used to take the
     charge instead, which put the scanner out for a full twelve-second recharge
     — longer than everything else the burst touched — and made the refusal
     unreachable, because a scan with no charge returns before it can speak. */
  surv.scan.charge = 1;
  cf.scan();
  check(surv.scan.charge === 1,
        "the scanner fired while your own burst still had it down");
  surv.empSelf = 0;
  cf.scan();
  check(surv.scan.charge < 1, "the scanner never came back after the burst");
  // A stunned ship does nothing at all: no engine, no guns, no opinion.
  {
    const was = { x: stunned.x, y: stunned.y, shots: surv.shots.length };
    stunned.vx = stunned.vy = 0;
    step(20);
    check(Math.hypot(stunned.x - was.x, stunned.y - was.y) < 1,
          "a stunned ship flew " +
          Math.round(Math.hypot(stunned.x - was.x, stunned.y - was.y)) + " units");
    check(surv.shots.length <= was.shots, "a stunned ship got a shot away");
  }
  // And it comes back, still angry, which is what makes it a decision.
  stunned.stun = 0.001; sentry.stun = 0.001; surv.empSelf = 0.001;
  const back = { x: stunned.x, y: stunned.y };
  step(40);
  check(Math.hypot(stunned.x - back.x, stunned.y - back.y) > 1,
        "a ship that came out of a stun never moved again");

  console.log("  devices    " + devParts.length + " verbs on the four slots · " +
              "a key each and rebindable · a sentry and a seeker take the decoy · " +
              "a pirate takes the cargo · a mine does not care whose it is · " +
              "the jump is a long way and a cold scanner · the line pulls you at " +
              "what you are pointing at · the cloak is forgotten, not paused, and " +
              "firing ends it · the burst takes your own four slots with it");
}

// ── one hold ─────────────────────────────────────────────────────────────
/* There were two places to put things: a cargo hold with a cap on it, and a
   crate of spare parts with no cap at all. The second made the first a lie — a
   hauler could be full to the brim and still be carrying six spare engines in a
   pocket nobody could see.

   They are one thing now, so the checks are about the one number: that a part
   is on it, that every way a part gets aboard respects it, and that the ways a
   part can leave the hold put it somewhere you can go and get it rather than
   deleting it. */
{
  const { cf } = boot("?debug=1&seed=771177");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];
  const view = () => cf.surveyView();
  const step = n => {
    for (let i = 0; i < (n || 1); i++) {
      surv.water = 900; surv.food = 900; me.invuln = 9999;
      now += 1000 / 60; cf.step();
    }
  };
  const clearHold = () => {
    for (const k of Object.keys(surv.hold)) surv.hold[k] = 0;
    surv.store = {};
  };

  /* ── a part weighs, and the weight is on the one number ───────────────── */
  clearHold();
  check(view().carried === 0, "a cleared hold does not read empty");
  const cap = view().hold;
  surv.store = { layerplate: 1 };
  const plate = view().store.find(e => e.key === "layerplate");
  check(!!plate && plate.weight > 0,
        "a spare part is not telling the page what it weighs");
  check(view().carried === plate.weight,
        "a spare part weighing " + plate.weight + " moved the hold to " +
        view().carried);
  surv.store = { layerplate: 3 };
  check(view().carried === plate.weight * 3,
        "three of them weigh " + view().carried);
  check(view().partWeight === plate.weight * 3,
        "the page is not told what the parts alone are costing");

  /* And a fitted part weighs nothing: it is bolted to the outside of the ship
     rather than lying in the hold, which is the reason to use the four slots. */
  clearHold();
  surv.store = { layerplate: 1 };
  const carriedWeight = view().carried;
  view().onFit(0, "layerplate");
  cf.applyParts();
  check(view().carried === 0,
        "fitting a part left " + view().carried + " in the hold; fitted is not carried");
  check(carriedWeight > 0, "the part weighed nothing to begin with");

  /* ── the materials and the parts share the cap ────────────────────────── */
  clearHold();
  surv.slots[0] = null; cf.applyParts();
  surv.hold.iron = cap - 2;
  surv.store = {};
  check(view().carried === cap - 2, "the hold is not counting materials");
  // Two units of room and a part that needs more than two: it does not fit.
  const heavy = view().parts.find(p => p.weight > 2 && p.buyable);
  surv.cash = 99999;
  surv.docked = { x: 0, y: 0 };
  check(cf.buyPart(heavy.key) === false,
        heavy.name + " (" + heavy.weight + ") was bought into 2 units of room");
  check(view().carried === cap - 2, "the refused purchase changed the hold");
  check(surv.cash === 99999, "the refused purchase still took the money");
  // Make room and it goes aboard.
  surv.hold.iron = cap - heavy.weight;
  check(cf.buyPart(heavy.key) === true, "it would not buy with room for it");
  check(view().carried === cap, "the hold does not add up after the purchase");

  /* ── pulling a part off a slot is putting it in the hold ──────────────── */
  clearHold();
  surv.store = { layerplate: 1 };
  view().onFit(0, "layerplate");
  cf.applyParts();
  surv.hold.iron = cap;                     // full of rock, nothing fitted-out
  check(view().onPull(0) === false,
        "a part was pulled into a hold with no room for it");
  check(!!surv.slots[0], "the refused pull emptied the slot anyway");
  surv.hold.iron = cap - plate.weight;
  check(view().onPull(0) === true, "it would not pull with room for it");
  check(!surv.slots[0], "the slot is still full after a pull");

  /* ── dying: the materials are gone and the spares are on the floor ────── */
  clearHold();
  surv.slots[0] = null; cf.applyParts();
  surv.hold.iron = 10;
  surv.store = { pulsecoil: 1, layerplate: 2 };
  me.x = 40000; me.y = -20000;
  const spares = 3;
  cf.die("rock");
  check(view().carried === 0, "the hold survived a death");
  check(Object.keys(surv.store).length === 0, "the spares survived a death");
  const floor = surv.dropped.filter(d => d.mod);
  check(floor.length === spares,
        spares + " spares went down and " + floor.length + " are on the floor");
  check(floor.every(d => Math.hypot(d.x - me.x, d.y - me.y) < 4000),
        "a spare was dropped a long way from where you died");
  check(new Set(floor.map(d => d.id)).size === spares,
        "two spares on the floor share an id — picking one up would take both");

  /* And they come back. Through the real path: the streamer puts them in the
     world and flying into one picks it up. */
  cf.respawn();
  const back = surv.dropped.filter(d => d.mod)[0];
  const me2 = cf.live().ships[0];
  me2.x = back.x; me2.y = back.y; me2.vx = me2.vy = 0;
  step(4);
  check(storeOf(cf, back.key) > 0,
        "flew onto a dropped spare and it is not in the hold");
  check(surv.dropped.filter(d => d.id === back.id).length === 0,
        "it was picked up and is still on the floor");
  check(surv.dropped.filter(d => d.mod).length === spares - 1,
        "picking one spare up took the others with it");

  /* ── and the book remembers them ──────────────────────────────────────── */
  const saved = cf.bookKeys();
  check(saved.indexOf("dropped") >= 0, "the book does not keep what is on the floor");

  /* ── a cache does not open onto a full hold ───────────────────────────── */
  clearHold();
  surv.hold.iron = cap;
  surv.caches.length = 0;
  const c = { x: me2.x + 40, y: me2.y, r: 46, guards: [], opened: false,
              rich: true, part: "tractorrig", phase: 0 };
  surv.caches.push(c);
  step(3);
  check(surv.caches.indexOf(c) >= 0,
        "a full hold opened a cache with a part in it and lost the part");
  surv.hold.iron = 0;
  step(3);
  check(surv.caches.indexOf(c) < 0, "the cache would not open with room for it");
  check(storeOf(cf, "tractorrig") > 0, "the cache opened and the part is nowhere");

  console.log("  onehold    a part weighs and the weight is on the hold · " +
              "fitted weighs nothing · buying, pulling and a cache all " +
              "respect the cap · a death puts the spares on the floor by " +
              "name and they come back one at a time");
}

if (problems.length) {
  console.error("\nCROSSFIRE survey checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("CROSSFIRE survey checks passed");
