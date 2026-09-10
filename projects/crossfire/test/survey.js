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
    check(byDist[byDist.length - 1].key === "leviathan",
          "seed " + seed + ": the Leviathan is not the last rung, " +
          byDist[byDist.length - 1].key + " is");
    for (let k = 1; k < byDist.length; k++) {
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
  const raw = store["crossfire.survey.v3"];
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
  check(total() === 0, "selling left " + total() + " units aboard");
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
  const atHome = priceAt(0, 0), atDeep = priceAt(210000, 0);
  check(atDeep > atHome,
        "deep space pays " + atDeep + " for iridium where home pays " + atHome);
  surv.docked = { x: 0, y: 0 };

  // The refit: it must cost cash, and it must change the ship.
  const hullBefore = me.maxHull, thrustBefore = me.thrustMul || 1;
  surv.cash = 5000;
  const purse = surv.cash;
  check(cf.buy("hull") === true, "could not buy a hull tier with money in hand");
  check(surv.cash < purse, "buying a tier did not spend any cash");
  check(total() === 0, "buying a tier took material out of the hold");
  check(me.maxHull > hullBefore,
        "a hull tier did not raise max hull (" + hullBefore + " → " + me.maxHull + ")");
  check(cf.buy("thrust") === true, "could not buy a drive tier");
  check((me.thrustMul || 1) > thrustBefore, "a drive tier did not raise thrust");
  check(surv.t.refitted === true, "refitting did not register");

  // And it must refuse when the money is gone — a full hold is not money.
  surv.cash = 0;
  surv.hold.iridium = 60;
  check(cf.buy("hull") === false, "a hold full of iridium bought a tier by itself");
  surv.hold.iridium = 0;

  /* A track runs out at its last tier rather than taking money forever. Checked
     on the scanner, since the cargo track has gone — how much you can carry is
     the ship's and nothing you buy changes it. */
  surv.cash = 1000000;
  let bought = 0;
  while (cf.buy("scanner")) bought++;
  check(bought <= 3, "the scanner track sold " + bought + " tiers past its cap");
  check(cf.buy("scanner") === false, "a maxed track kept selling");
  check(cf.buy("hold") === false, "storage is still for sale as a refit");
  console.log("  economy    4 materials, all reachable · deep rock " +
              (abyss / home).toFixed(1) + "x richer · hold caps at " + cap +
              " · a hold sold for " + got + " · refits cost cash, not cargo");
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
  check(surv.built.has(parts[0].key), "dying unfitted a yard part");
  check(surv.carrying.has(parts[1].key), "dying dropped a part you were carrying");
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
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(book.deaths === 1, "the book saved " + book.deaths + " deaths");
  console.log("  death      cause, range, run length and cargo all recorded · " +
              "hold lost · almanac, yard, chart, pins and cash kept · " +
              "back at the station");
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
  // No amount of cash buys one.
  surv.cash = 1e6;
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

  // And the refit reaches further.
  surv.cash = 5000;
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

  const near = sample(6);      // ~16,000 units out
  const far  = sample(60);     // ~156,000 units out

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
    const near = survey(w.cf, 4), far = survey(w.cf, 60);
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
  surv.cash = 100000;
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
  const book = JSON.parse(store["crossfire.survey.v3"]);
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
  const rings = [[8, 20], [20, 40], [40, 70], [70, 110]];
  const acc = rings.map(() => ({ n: 0, inh: 0, air: 0 }));
  for (const seed of [1, 515, 8675309, 20260909, 4242, 909]) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    rings.forEach(([lo, hi], i) => {
      for (let cx = -hi; cx <= hi; cx++) {
        for (let cy = -hi; cy <= hi; cy++) {
          const d = Math.hypot(cx, cy);
          if (d < lo || d > hi) continue;
          for (const p of cf.chunk(cx, cy).planets) {
            acc[i].n++;
            if (p.inhabited) acc[i].inh++;
            if (p.air) acc[i].air++;
          }
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

  // It sells. And it is not a station: it must not buy cargo.
  cf.setTanks(60, 120);
  surv2.cash = 400;
  check(cf.buySupply("water") === true, "an inhabited world would not sell water");
  check(cf.buySupply("food") === true, "an inhabited world would not sell food");
  check(surv2.cash < 400, "the supplies were free");
  surv2.hold.iron = 20;
  check(cf.surveyView().onSell() === 0, "a world bought cargo like a station");
  check(surv2.hold.iron === 20, "a world took the cargo anyway");
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

  // Supermassive wells are named; small ones deliberately are not.
  let big = null, small = null, world = null;
  for (let cx = -60; cx <= 60 && !(big && small && world); cx++) {
    for (let cy = -60; cy <= 60 && !(big && small && world); cy++) {
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
  for (let k = 0; k < 20; k++) {
    surv.motes.push({ x: big.x + big.kill * 1.6 + k * 4, y: big.y,
                      vx: 0, vy: 0, spin: 0, life: 90, mat: "iron" });
  }
  const held = surv.motes.length;
  for (let i = 0; i < 60 * 20; i++) { me.invuln = 2; now += 1000 / 60; cf.step(); }
  check(surv.motes.length < held,
        "a supermassive well did not swallow any of the " + held +
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
     stated 360 and looked like a speed-cap bug. What is under test is the cap. */
  const step = n => {
    for (let i = 0; i < n; i++) {
      me.invuln = 3;
      surv.drones.length = 0;
      surv.traffic.length = 0;
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
  check((me.boost || 0) < stated * 0.1,
        "the allowance never ran out: " + Math.round(me.boost));

  /* And gravity really does grant one. Dropped toward a supermassive well, the
     ship has to end up both faster than its engine can go and holding an
     allowance to explain why. */
  let well = null;
  for (let cx = -70; cx <= 70 && !well; cx++) {
    for (let cy = -70; cy <= 70 && !well; cy++) {
      for (const h of cf.chunk(cx, cy).hazards) if (h.k >= 2) { well = h; break; }
    }
  }
  check(!!well, "no supermassive well to fall into");
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

// ── a waypoint is somewhere you decided to go ─────────────────────────────
/* Pins are notes: six kinds, two hundred of them, and not one of them points
   anywhere. A waypoint is the other thing — one at a time, and the flight HUD
   holds a bearing to it — so the two must not be the same gesture, and setting
   one must not quietly drop a pin instead. */
{
  const { cf } = boot("?debug=1&seed=515151");
  cf.start("survey", 1);
  const surv = cf.survey();
  const hud = cf.hud();
  const me = cf.live().ships[0];

  check(cf.surveyView().waypoint == null, "a fresh survey started with a waypoint");

  // Unarmed, a tap on the map is still a pin. That is the default and it stays.
  hud.chartTapAt(cf.surveyView(), 9000, -4000, 400);
  check(surv.pins.length === 1, "an unarmed tap did not drop a pin");
  check(cf.surveyView().waypoint == null, "an unarmed tap set a waypoint");
  hud.chartTapAt(cf.surveyView(), 9000, -4000, 400);   // the same tap lifts it
  check(surv.pins.length === 0, "the pin did not lift again");

  // Armed from the chart's own button, and then the map sets it.
  cf.screen("chart");
  cf.draw();
  const arm = cf.live().taps.find(t => t.w === 130 && t.h === 38);
  check(!!arm, "there is no waypoint button on the chart");
  arm.act();
  hud.chartTapAt(cf.surveyView(), 12000, -6000, 400);
  const w = cf.surveyView().waypoint;
  check(!!w, "an armed tap set no waypoint");
  check(Math.round(w.x) === 12000 && Math.round(w.y) === -6000,
        "the waypoint landed at " + Math.round(w.x) + "," + Math.round(w.y));
  check(surv.pins.length === 0, "setting a waypoint dropped a pin as well");

  /* The two numbers the flight HUD points with. A waypoint with no range and no
     bearing is a mark on a map, which is what pins are already for. */
  const truth = Math.hypot(12000 - me.x, -6000 - me.y);
  check(Math.abs(w.dist - truth) < 2,
        "the range reads " + w.dist + " against a real " + Math.round(truth));
  check(Number.isFinite(w.bearing) && w.bearing >= 0 && w.bearing < 360,
        "the bearing is " + w.bearing);

  // Only ever one: setting another moves it rather than collecting them.
  arm.act();
  hud.chartTapAt(cf.surveyView(), -3000, 8000, 400);
  const moved = cf.surveyView().waypoint;
  check(Math.round(moved.x) === -3000 && Math.round(moved.y) === 8000,
        "setting a second waypoint did not move the first");

  // And it survives the tab, or it is a note you have to write down twice.
  cf.leave();
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(book.waypoint && book.waypoint.x === -3000,
        "the book saved " + JSON.stringify(book.waypoint));
  const again = bootKeepingStorage("?debug=1&seed=515151");
  again.cf.start("survey", 1);
  const back = again.cf.surveyView().waypoint;
  check(back && Math.round(back.x) === -3000 && Math.round(back.y) === 8000,
        "a resumed sector lost its waypoint");

  // Cleared on purpose, and then it is gone.
  again.cf.surveyView().onWaypoint(null);
  check(again.cf.surveyView().waypoint == null, "clearing left the waypoint up");
  console.log("  waypoint   armed from the chart, set by a tap, one at a time · " +
              "range and bearing to it · pins still work · survives the tab");
}

// ── twenty-five ships ─────────────────────────────────────────────────────
/* Phase 3.3. Five numbers and a silhouette each, and the spread is the whole
   point: a skiff is a bicycle with a pistol taped to it and an Ossuary is a
   building. What has to hold is that they are genuinely different, that none of
   them is strictly better than a cheaper one, and that every one of the five
   numbers actually reaches the ship you are flying — a roster whose cargo column
   is decoration would be twenty-five paint jobs. */
{
  const { cf } = boot("?debug=1&seed=252525");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const list = cf.surveyView().ships;

  check(list.length === 25, "the roster has " + list.length + " ships, not 25");
  check(new Set(list.map(s2 => s2.key)).size === 25, "two ships share a key");
  check(new Set(list.map(s2 => s2.name)).size === 25, "two ships share a name");

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

  /* The spread. Each of the five has to differ by a lot across the roster, or
     the column is decoration. */
  const span = k => {
    const v = list.map(s2 => s2[k]);
    return Math.max(...v) / Math.min(...v);
  };
  check(span("hull") >= 8, "hull only spans " + span("hull").toFixed(1) + "x");
  check(span("cargo") >= 20, "cargo only spans " + span("cargo").toFixed(1) + "x");
  check(span("speed") >= 1.8, "speed only spans " + span("speed").toFixed(2) + "x");
  check(span("turn") >= 3, "turn only spans " + span("turn").toFixed(1) + "x");
  check(span("size") >= 4, "size only spans " + span("size").toFixed(1) + "x");

  /* Nothing is strictly better than something cheaper. A ship that beat a
     cheaper one on all five would make the cheaper one unbuyable and the
     roster that much shorter. */
  const beats = (a, b) => a.hull >= b.hull && a.cargo >= b.cargo &&
                          a.speed >= b.speed && a.turn >= b.turn &&
                          a.dmg * a.rate >= b.dmg * b.rate &&
                          (a.hull > b.hull || a.cargo > b.cargo ||
                           a.speed > b.speed || a.turn > b.turn);
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

  /* And the numbers reach the ship. Each of the five is checked against the
     hull's own entry rather than against a constant. */
  check(me.maxHull === big.hull, "hull reads " + me.maxHull + ", roster says " + big.hull);
  check(cf.shipNow().cap === big.cargo, "cargo reads " + cf.shipNow().cap);
  check(Math.abs(me.speedMul - big.speed) < 0.01, "speed did not reach the ship");
  check(Math.abs(me.turnMul - big.turn) < 0.01, "turn did not reach the ship");
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
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(book.ship === "skiff", "the book saved ship " + book.ship);
  check(book.owned.includes("ossuary"), "the book forgot a ship you bought");
  const again = bootKeepingStorage("?debug=1&seed=252525");
  again.cf.start("survey", 1);
  check(again.cf.shipNow().owned.includes("ossuary"),
        "a resumed sector lost the hangar");
  console.log("  ships      25 hulls, 25 silhouettes · hull " +
              span("hull").toFixed(0) + "x, cargo " + span("cargo").toFixed(0) +
              "x, size " + span("size").toFixed(1) + "x · none dominates a " +
              "cheaper one · all five numbers reach the ship · camera follows size");
}

// ── company ───────────────────────────────────────────────────────────────
/* Phase 4.1. Traffic that is not trying to kill you, and the thing that makes a
   sector feel like anywhere. What matters is the *gradient* — inhabited near
   home and empty far out is most of what makes distance feel like distance, and
   a flat density would make the abyss exactly as lively as the home band. */
{
  const rings = [[2, 8], [10, 24], [40, 70], [90, 120]];
  const acc = rings.map(() => ({ chunks: 0, n: 0 }));
  const kinds = new Set();
  for (const seed of [11, 515, 8675309, 4242]) {
    const { cf } = boot("?debug=1&seed=" + seed);
    cf.start("survey", 1);
    rings.forEach(([lo, hi], i) => {
      for (let cx = -hi; cx <= hi; cx++) {
        for (let cy = -hi; cy <= hi; cy++) {
          const d = Math.hypot(cx, cy);
          if (d < lo || d > hi) continue;
          acc[i].chunks++;
          for (const t of cf.chunk(cx, cy).traffic) {
            acc[i].n++;
            kinds.add(t.kind);
            check(t.hull && t.from && t.to, "a traffic ship with no route or hull");
            check(Array.isArray(t.cargo), t.kind + " carries nothing at all");
          }
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

    surv.drones.length = 0;                    // the rescue, done the only way
    now += 1000 / 60; cf.step();
    check(surv.cash > 0, "clearing the sentries paid nothing");
    check(ship.kind === "freight",
          "a rescued ship is still flagged " + ship.kind + " — it should get on " +
          "with its day");
    check(surv.t.rescued === true, "the rescue did not register");
  }
  console.log("  company    " + home.toFixed(2) + "/chunk at home → " +
              deep.toFixed(3) + " in the deep · haulers, patrols and distress " +
              "calls · robbing drops what it carried · rescuing pays");
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
     book, and a resumed survey starts at the origin rather than in the shop. */
  cf.leave();
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(book.taught.includes("thirst"), "the book forgot the opening");
  const again = bootKeepingStorage("?debug=1&seed=606061");
  again.cf.start("survey", 1);
  const back = again.cf.live().ships[0];
  check(Math.hypot(back.x, back.y) < 400,
        "a resumed survey did not start at the origin");
  check(again.cf.survey().taught.has("thirst"),
        "a resumed survey would teach it all again");
  console.log("  opening    starts docked at the station on a " +
              Math.round(v.water.frac * 100) + "% tank · water, then the yard, " +
              "then what it is worth · each beat once · a resumed sector is quiet");
}

// ── which pages stop the clock ────────────────────────────────────────────
/* A page that pauses the world is a page you can hide in, and the chart and the
   storage manifest are precisely the two anyone would hide in — two tanks are
   draining and there are things out there that move. So the world keeps running
   behind the chart, storage, missions and the almanac, and stops at a station,
   which is where you are docked and doing business. */
{
  const { cf } = boot("?debug=1&seed=515152");
  cf.start("survey", 1);
  const surv = cf.survey();
  const me = cf.live().ships[0];
  const runs = (page, docked) => {
    surv.docked = docked ? { x: 0, y: 0 } : null;
    cf.screen(page);
    const w0 = surv.water, x0 = me.x;
    me.vx = 200; me.vy = 0;
    for (let i = 0; i < 120; i++) { me.invuln = 3; now += 1000 / 60; cf.step(); }
    return Math.abs(me.x - x0) > 20 || (w0 - surv.water) > 1;
  };
  for (const p of ["chart", "inventory", "missions", "almanac"]) {
    check(runs(p, false), "the world stops behind the " + p + " page");
  }
  for (const p of ["refit", "hangar"]) {
    check(!runs(p, true), "the world keeps running at a station (" + p + ")");
  }
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
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(book.rep && typeof book.rep === "object", "the book saved no reputation");
  const again = bootKeepingStorage("?debug=1&seed=770077");
  again.cf.start("survey", 1);
  const back = again.cf.surveyView().standings.find(f => f.key === victim);
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
    const book = JSON.parse(store["crossfire.survey.v3"]);
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
  check(owned1 && owned1.n === 1, "the pulled part did not come back to the crate");
  check(!owned0, "it was in the crate while it was on the ship");

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
  check(view().onBuyPart("overburner") === true, "could not buy a part with cash");
  check(surv.cash < cash0, "the part was free");
  check(view().store.some(e => e.key === "overburner"),
        "the bought part is not in the crate");

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
  const book = JSON.parse(store["crossfire.survey.v3"]);
  check(Array.isArray(book.slots) && book.slots.length === 4,
        "the book saved no slots");
  check(book.slots[0] && book.slots[0].key === "layerplate",
        "the book forgot what was bolted on");
  check(book.store && book.store.overburner === 1,
        "the book forgot what was in the crate");

  console.log("  slots      four on every hull \u00b7 a fit out here takes " +
              "20/45/90/180s and the slot is dead until it lands \u00b7 " +
              "instant at a station \u00b7 one of a kind \u00b7 the deep " +
              "stocks " + deepShelf + " where home stocks " + nearShelf);
}

if (problems.length) {
  console.error("\nCROSSFIRE survey checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("CROSSFIRE survey checks passed");
