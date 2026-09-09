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
  check(cat.length === 31, "the catalogue must have 31 entries, has " + cat.length);
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

if (problems.length) {
  console.error("\nCROSSFIRE survey checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("CROSSFIRE survey checks passed");
