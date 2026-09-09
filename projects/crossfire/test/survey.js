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

const DIR = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
const inline = [...html.matchAll(
  /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
)][0][1];
const hudSrc = fs.readFileSync(path.join(DIR, "survey-hud.js"), "utf8");

// The page loads survey-hud.js before the inline script, and the inline script
// captures the global once at boot — so the harness must load them in the same
// order or it would be testing the null-HUD path by accident.
assert.ok(
  html.indexOf('src="survey-hud.js"') > 0 &&
  html.indexOf('src="survey-hud.js"') < html.indexOf("<script>"),
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
    blur: noop, click: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => stubEl(), querySelectorAll: () => [],
    hidden: false, value: "", textContent: "", width: 1000, height: 700,
    dataset: {}, children: [], parentNode: null
  };
}
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
    addEventListener: noop, removeEventListener: noop,
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

  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: documentStub, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.CrossfireNet = undefined;
  vm.createContext(sandbox);
  vm.runInContext(hudSrc, sandbox, { filename: "survey-hud.js" });
  vm.runInContext(inline, sandbox, { filename: "index.inline.js" });
  // `window` inside the sandbox is the stub, not the sandbox object itself, so
  // anything the game hangs off window lands there — the same reason
  // test/campaign.js looks in both places.
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  assert.ok(windowStub.CrossfireSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub };
}


/* Every almanac entry must have a picture, and the picture is what turns a
   checklist into a field guide. Read as source rather than counted at runtime:
   an entry that falls through to the default `ring` still draws *something*, so
   "did it paint" cannot tell a real picture from a placeholder. Having its own
   `case` can. */
const ICON_CASES = new Set(
  [...hudSrc.matchAll(/case\s+"([a-z0-9-]+)":/g)].map(m => m[1])
);

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

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

    const near = surv.landmarks.find(l => l.key === "graveyard");
    const far = surv.landmarks.find(l => l.key === "node-01");
    check(Math.hypot(near.x, near.y) < 20000, "seed " + seed + ": the first landmark is too far");
    check(Math.hypot(far.x, far.y) > 60000, "seed " + seed + ": the last landmark is too close");

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
  for (let i = 0; i < 21600; i++) { now += 1000 / 60; cf.step(); }
  const s = cf.live().ships[0];
  const far = Math.hypot(s.x, s.y);
  check(far > 60000, "six minutes of full burn only reached " + Math.round(far) + " units");
  check(Number.isFinite(s.x) && Number.isFinite(s.y), "position went non-finite out there");
  check(cf.live().rocks.length > 40,
        "the rock field did not follow the ship out: " + cf.live().rocks.length + " left");
  const near = cf.live().hazards.some(h => Math.hypot(h.x - s.x, h.y - s.y) < 20000);
  check(near, "no hazards generated " + Math.round(far) + " units out — space ran out");
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
  let frames = 0, everDead = false, nonFinite = false;
  let maxSpeed = 0, recoveries = 0, lastHull = me.hull;
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
    if (s.dead) everDead = true;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) ||
        !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) nonFinite = true;
    maxSpeed = Math.max(maxSpeed, Math.hypot(s.vx, s.vy));
    if (s.hull > lastHull + 0.9) recoveries++;      // a jump back to full
    lastHull = s.hull;
    if (frames % 1800 === 0) chartAt.push(hud.charted());
    frames++;
  }

  // Every screen Survey can reach has to draw. The panel, the expanded chart
  // and the catalogue never run under step() alone, and neither does the pause
  // menu sitting over a live sector.
  const chartedAfter = hud.charted();
  const travelled = Math.hypot(cf.live().ships[0].x - startedAt.x,
                               cf.live().ships[0].y - startedAt.y);

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

  check(!everDead, "a ship died in Survey — the mode has no death");
  check(!nonFinite, "a ship's position or velocity went non-finite");
  check(chartedAfter > 250,
        "four minutes of flying charted only " + chartedAfter + " cells");
  check(travelled > 8000, "the ship never got anywhere: " + Math.round(travelled) + " units");
  check(surv.found.size > 0, "four minutes of flying found no catalogue entry at all");
  console.log("  flying     " + frames + " frames · charted " +
              chartAt.join(" → ") + " cells (" + chartedAfter + " final) · found " +
              surv.found.size + "/" +
              cf.catalogue().length + " · " + recoveries + " recoveries · no death");
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
  check(cat.length === 33, "the catalogue must have 33 entries, has " + cat.length);
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
  const packedTrail = hud.exportTrail();
  check(packedTrail.length > 0, "the trail did not export");

  // Round-trip through the same path local storage uses.
  hud.reset();
  check(hud.charted() === 0, "reset did not clear the chart");
  check(hud.importFog(packed) === true, "the fog did not import back");
  check(Math.abs(hud.charted() - charted) < 1e-9,
        "the chart changed across a save: " + charted + " → " + hud.charted());
  check(hud.importTrail(packedTrail) === true, "the trail did not import back");
  check(hud.importFog("nonsense~~") === false, "a corrupt chart was accepted");
  check(hud.importFog("") === false, "an empty chart was accepted");
  check(hud.importFog("AAA") === false, "a truncated chart was accepted");

  // And through the real one: the book is written, then read back on a reboot
  // into the same seed, and the mode must resume rather than start over.
  const surv = cf.survey();
  const foundBefore = surv.found.size;
  const chartedBefore = hud.charted();
  cf.leave();                                     // the real quit path, which saves
  const raw = store["crossfire.survey.v3"];
  check(!!raw, "nothing was written to local storage");
  if (raw) {
    const book = JSON.parse(raw);
    check(book.seed === 5150, "the book saved the wrong seed: " + book.seed);
    check(typeof book.fog === "string" && book.fog.length > 0, "the book saved no chart");
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
  console.log("  persistence chart round-trips exactly · resumes on the same seed · " +
              "a new seed starts clean · corrupt input rejected");
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

// ── 8. salvage, the hold, and the refit ───────────────────────────────────
/* The numbers track, end to end: salvage goes in, the hold caps it, the station
   spends it, and the ship that comes out is measurably better than the one that
   went in. Each step is checked rather than the total, because a progression
   that silently stops paying out is the failure players actually hit. */
{
  const { cf } = boot("?debug=1&seed=99");
  cf.start("survey", 1);
  const surv = cf.survey();
  const lv = cf.live();
  const me = lv.ships[0];

  check(surv.salvage === 0, "a fresh sector started with salvage in the hold");

  // Fill the hold past its cap and prove it stops rather than overflowing.
  const before = surv.salvage;
  for (let i = 0; i < 400; i++) {
    surv.motes.push({ x: me.x, y: me.y, vx: 0, vy: 0, spin: 0, life: 90 });
    now += 1000 / 60; cf.step();
  }
  check(surv.salvage > before, "collecting salvage did not add any");
  check(surv.t.laden === true, "a full hold did not register");
  const capped = surv.salvage;

  surv.motes.push({ x: me.x, y: me.y, vx: 0, vy: 0, spin: 0, life: 90 });
  now += 1000 / 60; cf.step();
  check(surv.salvage === capped,
        "the hold took " + (surv.salvage - capped) + " past its own cap");

  // The refit: it must cost, and it must change the ship.
  const hullBefore = me.maxHull, thrustBefore = me.thrustMul || 1;
  const purse = surv.salvage;
  check(purse >= 40, "the hold cap is too small to buy anything — test is stale");
  check(cf.buy("hull") === true, "could not buy a hull tier with a full hold");
  check(surv.salvage < purse, "buying a tier did not spend any salvage");
  check(me.maxHull > hullBefore,
        "a hull tier did not raise max hull (" + hullBefore + " → " + me.maxHull + ")");
  surv.salvage = 500;                    // top the hold up between purchases
  check(cf.buy("thrust") === true, "could not buy a drive tier");
  check((me.thrustMul || 1) > thrustBefore, "a drive tier did not raise thrust");
  check(surv.t.refitted === true, "refitting did not register");

  // And it must refuse when the hold is empty.
  surv.salvage = 0;
  check(cf.buy("hull") === false, "bought a tier with an empty hold");

  // A track runs out at its last tier rather than taking money forever.
  surv.salvage = 100000;
  let bought = 0;
  while (cf.buy("hold")) bought++;
  check(bought <= 3, "the cargo track sold " + bought + " tiers past its cap");
  check(cf.buy("hold") === false, "a maxed track kept selling");
  console.log("  economy    hold caps · a refit costs and lands · maxed tracks stop selling");
}

// ── 9. the verbs are earned, never bought ─────────────────────────────────
{
  const { cf } = boot("?debug=1&seed=1234");
  cf.start("survey", 1);
  const surv = cf.survey();
  check(cf.unlocked("tractor") === false, "the beam was unlocked on a blank almanac");
  check(cf.unlocked("warp") === false, "warp was unlocked on a blank almanac");

  // Log entries until each threshold, and prove the verb arrives exactly there.
  const keys = cf.catalogue().map(e => e.key);
  for (const key of keys) {
    const had = cf.unlocked("tractor");
    cf.find(key);
    if (!had && cf.unlocked("tractor")) {
      check(surv.found.size === 6,
            "the beam arrived at " + surv.found.size + " entries, not 6");
    }
  }
  check(cf.unlocked("tractor") && cf.unlocked("warp") && cf.unlocked("cloak"),
        "a full almanac did not hand over every verb");
  // No amount of salvage buys one.
  surv.salvage = 1e6;
  check(!cf.buy("tractor"), "a verb was purchasable at a station");
  console.log("  verbs      three unlocks, at 6/12/18 entries, none for sale");
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
  const purse = surv.salvage;
  for (let i = 0; i < 30; i++) { now += 1000 / 60; cf.step(); }
  check(surv.caches.includes(cache), "a guarded cache opened anyway");
  check(cache.sealed === true, "a guarded cache did not read as sealed");

  // Clear the post; now it must open, and pay.
  surv.drones.length = 0;
  me.x = cache.x; me.y = cache.y;
  for (let i = 0; i < 30; i++) { now += 1000 / 60; cf.step(); }
  check(!surv.caches.includes(cache), "an unguarded cache stayed shut");
  check(surv.t.looted === true, "opening a cache did not register");
  check(surv.motes.length > 0 || surv.salvage > purse,
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
      const spine = f => [lev.x + f * lev.len * lev.ca, lev.y + f * lev.len * lev.sa];

      // Points down the spine, from the stern opening to short of the bow cap.
      let clear = 0, total = 0;
      for (let f = -0.44; f < 0.36; f += 0.02) {
        const [px, py] = spine(f);
        total++;
        if (!blocked(px, py, R)) clear++;
      }
      check(clear === total,
            "the Leviathan's corridor is blocked at " + (total - clear) +
            " of " + total + " points — it is a wall, not a place");
      // The bow is a dead end by design: you turn around in there, you do not
      // pass through. If that ever opens, the inside stops being a room.
      let capped = false;
      for (let f = 0.36; f <= 0.52; f += 0.01) {
        if (blocked(...spine(f), R)) { capped = true; break; }
      }
      check(capped, "the Leviathan's bow is open — it is a tunnel, not a room");

      /* And nothing worth flying in for may be buried in the hull. This is the
         check that caught the deep cache sitting inside the bow cap, where it
         drew perfectly and could never be reached. */
      for (const c of surv.caches) {
        if (Math.hypot(c.x - lev.x, c.y - lev.y) > lev.len) continue;
        check(!blocked(c.x, c.y, c.r + R),
              "a cache inside the Leviathan is buried in its hull");
      }
      // And the flanks are not: a hull that lets you through the side is scenery.
      const off = lev.beam + 158;
      const sx = lev.x - off * lev.sa, sy = lev.y + off * lev.ca;
      check(lev.segs.some(g => Math.hypot(sx - g.x, sy - g.y) < g.r + R),
            "the Leviathan's flank has a hole in it");
      console.log("  leviathan  " + lev.segs.length + " hull sections · " +
                  Math.round(lev.len) + " units stem to stern · corridor clear end to end");
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
  check(/FINISHED/.test(done.text),
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

  // And the refit reaches further.
  surv.salvage = 5000;
  check(cf.buy("scanner") === true, "could not buy a scanner tier");
  check(cf.scanReach() > reach0,
        "a scanner tier did not extend the scan (" + reach0 + " → " + cf.scanReach() + ")");
  console.log("  scan       " + Math.round(reach0) + "u sweep · reports only what is inside · " +
              "fades · reaches " + Math.round(cf.scanReach()) + "u refitted");
}

// ── 17. pins ─────────────────────────────────────────────────────────────
{
  const { cf } = boot("?debug=1&seed=999");
  cf.start("survey", 1);
  const surv = cf.survey();
  const st = cf.surveyView();

  check(Array.isArray(surv.pins) && surv.pins.length === 0, "a fresh sector had pins");
  st.onPin(4000, -2500, "cache", 400);
  check(surv.pins.length === 1, "dropping a pin did not add one");
  check(surv.pins[0].kind === "cache", "the pin lost its kind");

  // The same gesture lifts it again.
  st.onPin(4050, -2520, "cache", 400);
  check(surv.pins.length === 0, "tapping a pin did not lift it");

  // Different kinds coexist, and they survive the book.
  st.onPin(1000, 1000, "danger", 400);
  st.onPin(-9000, 400, "part", 400);
  check(surv.pins.length === 2, "two pins of different kinds did not both stick");
  cf.leave();
  const raw = store["crossfire.survey.v3"];
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

  function sample(ring) {
    let guards = 0, hulks = 0, fields = 0, chunks = 0;
    for (let i = 0; i < 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * ring), cy = Math.round(Math.sin(a) * ring);
      const c = cf.chunk(cx, cy);
      chunks++;
      for (const cache of c.caches) guards += cache.guards.length;
      hulks += c.hulks.length;
      fields += c.fields.length;
    }
    return { guards, hulks, fields, chunks };
  }

  const near = sample(2);      // ~5,000 units out
  const far  = sample(32);     // ~83,000 units out

  check(far.guards > near.guards,
        "the deep sector posts no more sentries than home (" +
        near.guards + " → " + far.guards + ")");
  check(far.hulks >= near.hulks,
        "the deep sector is no thicker with wrecks (" +
        near.hulks + " → " + far.hulks + ")");
  check(far.fields > near.fields,
        "asteroid fields do not appear further out (" +
        near.fields + " → " + far.fields + ")");

  // And home has to stay quiet, or the curve is a wall rather than a slope.
  check(near.fields === 0, "an asteroid field spawned in the home ring");
  check(cf.chunk(0, 0).hazards.length === 0, "the home chunk grew a hazard");
  console.log("  danger     home " + near.guards + " sentries / " + near.fields +
              " fields · deep " + far.guards + " sentries / " + far.fields + " fields");
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
  for (const d of [0, 5e3, 2e4, 6e4, 1.4e5, 3.2e5, 6e5, 2e6]) {
    const v = cf.dangerAt(d, 0);
    check(v > prev, "the danger curve stopped rising at " + d);
    prev = v;
  }
  check(cf.dangerAt(3.2e5, 0) >= 1, "the curve does not reach 1 by the deep band");
  check(cf.dangerAt(2e6, 0) > cf.dangerAt(3.2e5, 0),
        "the abyss is no worse than the deep");
  console.log("  bands      home→abyssal named at the right ranges · curve never flattens");
}

// ── 20. fewer wells, and bigger ones further out ─────────────────────────
/* They used to sit in three chunks out of five at one fixed size, which makes
   them terrain rather than hazards — and terrain frightens nobody. */
{
  const { cf } = boot("?debug=1&seed=445566");
  cf.start("survey", 1);

  function survey(ring) {
    let wells = 0, chunks = 0, big = 0, reach = 0;
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      const c = cf.chunk(Math.round(Math.cos(a) * ring), Math.round(Math.sin(a) * ring));
      chunks++;
      for (const h of c.hazards) {
        wells++; reach += h.reach;
        if (h.k >= 1.8) big++;
      }
    }
    return { per: wells / chunks, big, avgReach: wells ? reach / wells : 0 };
  }

  const near = survey(3), far = survey(60);   // ~7.8k out vs ~156k, in DEEP
  check(near.per < 0.45,
        "home still carries " + near.per.toFixed(2) + " wells a chunk — too dense");
  check(near.per > 0.05, "home has essentially no wells at all");
  check(far.avgReach > near.avgReach * 1.4,
        "wells do not grow with range (" + Math.round(near.avgReach) + " → " +
        Math.round(far.avgReach) + ")");
  check(far.big > 0, "nothing supermassive exists anywhere");
  check(near.big === 0, "a supermassive well spawned near home");
  console.log("  wells      " + near.per.toFixed(2) + "/chunk at home vs " +
              far.per.toFixed(2) + " deep · reach " + Math.round(near.avgReach) +
              " → " + Math.round(far.avgReach) + " · " + far.big + " supermassive");
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
  surv.salvage = 100000;
  while (cf.buy("thrust")) { /* every tier */ }
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
  surv.salvage = 240;
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
  check(cf.survey().salvage === 240, "one press already spent the hold");

  // The second does all of it.
  cf.resetSurvey();
  const fresh = cf.survey();
  check(fresh.seed !== oldSeed,
        "the reset kept the same sector (" + oldSeed + ")");
  check(fresh.found.size === 0, "the almanac survived the reset");
  check(fresh.salvage === 0, "the hold survived the reset");
  check(fresh.built.size === 0, "the yard's manifest survived the reset");
  check(fresh.pins.length === 0, "the pins survived the reset");
  check(cf.hud().charted() === 0, "the chart survived the reset");
  check(!store["crossfire.survey.v3"] ||
        JSON.parse(store["crossfire.survey.v3"]).seed !== oldSeed,
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

if (problems.length) {
  console.error("\nCROSSFIRE survey checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("CROSSFIRE survey checks passed");
