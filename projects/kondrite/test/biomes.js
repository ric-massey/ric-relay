#!/usr/bin/env node
"use strict";

/* KONDRITE — THE BIOMES OF A SECTOR
   ─────────────────────────────────────────────────────────────────────────────
   A biome is an invisible ruleset — see BIOMES.md. The chart never says which
   kind of space you are in, so the only way anybody learns what the Murk is, is
   by being in it and noticing that things are different. That puts a hard
   requirement on the geography and none of it is visible from a screenshot:

     · the patches have to be big enough to be *somewhere* rather than a stripe
       you cross in thirty seconds, and
     · there have to be enough different ones in reach that a run finds some,
       without every world being a sampler of all thirteen.

   Neither is assertable from the constants. The lattice jitters, patches of the
   same kind merge where they touch, and the home override rewrites the middle
   of it — so this measures a real sector by sampling it, and prints what it
   found. Run it with a seed to look at one world:

       node test/biomes.js 424242
*/

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
   loud: the inline script captures `window.KondriteSurveyHUD` once at
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
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false,
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




/* ── the biomes of one random world ──────────────────────────────────────── */
const SEED = Number(process.argv[2]) || 606061;
const { cf } = boot("?debug=1&seed=" + SEED);
cf.start("survey", 1);
const surv = cf.survey();

const CELL = cf.regionCell();

/* Two views of the lattice, because the two questions want different things.

   How big a patch is, is a *local* measurement: it needs every neighbour of a
   site sampled finely, and it does not care what is happening a million units
   away. How far out a kind's nearest example is wants the opposite — a wide net
   and no sampling at all, because a site's position is exact.

   Doing both from one grid is what made the first run of this report claim the
   same patch count for 1200k and 1800k: the grid stopped at 791k, so every
   number past that was the edge of the sample rather than the edge of anything
   in the sector. */
const N = 9;                                   // fine and local, for patch sizes
const sites = cf.regionSites(N);
const WIDE = Math.ceil(1800000 / CELL) + 1;    // coarse and wide, for distances
const wide = cf.regionSites(WIDE);

const KINDS = [...new Set(sites.map(s => s.key))];
const dist = s => Math.hypot(s.x, s.y);

/* Each site owns the space nearer to it than to any other — a Voronoi cell. Its
   real extent is measured rather than assumed: the lattice jitters, so cells are
   nothing like uniform and two neighbours of the same kind merge into one patch
   you can fly across without the rules changing. */
const STEP = CELL / 14;
const owner = new Map();                       // site index -> sampled points
const idx = new Map(sites.map((s, i) => [s, i]));
const reach = CELL * (N - 0.5);
let samples = 0;
for (let y = -reach; y <= reach; y += STEP) {
  for (let x = -reach; x <= reach; x += STEP) {
    let best = null, bd = Infinity;
    for (const s of sites) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    samples++;
    const k = idx.get(best);
    if (!owner.has(k)) owner.set(k, []);
    owner.get(k).push([x, y]);
  }
}
const cellArea = STEP * STEP;

function extentOf(i) {
  const pts = owner.get(i) || [];
  if (!pts.length) return { area: 0, across: 0, near: 0, far: 0 };
  const s = sites[i];
  let far = 0, near = Infinity, minD = Infinity, maxD = 0;
  for (const [x, y] of pts) {
    const r = Math.hypot(x - s.x, y - s.y);
    if (r > far) far = r;
    const d = Math.hypot(x, y);
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  }
  const area = pts.length * cellArea;
  return { area, across: 2 * Math.sqrt(area / Math.PI), near: minD, far: maxD };
}

const k = n => Math.round(n / 1000) + "k";

console.log("");
console.log("KONDRITE — the biomes of sector " + SEED);
console.log("=".repeat(64));
console.log("Region lattice: one site per " + k(CELL) +
            " cell, jittered, nearest site wins.");
console.log(KINDS.length + " kinds present in this world, of " +
            "13 the game defines.");
console.log("");

// ── how many within a limit ───────────────────────────────────────────────
console.log("HOW MANY PATCHES WITHIN A DISTANCE OF HOME");
console.log("-".repeat(64));
/* Counted as *what you would fly through*, not as site centres. A patch whose
   middle is 300k away can still reach in to 180k, and near home the count by
   centres reads zero while you are plainly standing in a region. So this asks
   which cells actually touch the disc. */
for (const lim of [60000, 140000, 320000, 600000, 1200000, 1800000]) {
  const touch = new Set();
  const kinds = new Set();
  const ring = Math.max(64, Math.round(lim / 6000));
  for (let r = lim / 24; r <= lim; r += lim / 24) {
    for (let a = 0; a < ring; a++) {
      const th = (a / ring) * Math.PI * 2;
      const x = Math.cos(th) * r, y = Math.sin(th) * r;
      let best = null, bd = Infinity;
      for (const st of wide) {
        const d = (st.x - x) ** 2 + (st.y - y) ** 2;
        if (d < bd) { bd = d; best = st; }
      }
      touch.add(best.cx + "," + best.cy);
      // Home is forced ordinary near the origin whatever the lattice says.
      kinds.add(cf.regionProbe(x, y).key);
    }
  }
  console.log("  within " + String(k(lim)).padStart(6) + "   " +
              String(touch.size).padStart(3) + " patches you could fly into   " +
              String(kinds.size).padStart(2) + " of the 13 kinds");
}
console.log("");

// ── the range of each kind ────────────────────────────────────────────────
console.log("EACH KIND IN THIS WORLD — size of one patch, and how far out");
console.log("-".repeat(64));
console.log("  KIND                 N   TYPICAL   BIGGEST   NEAREST   FARTHEST");
const rows = [];
for (const key of KINDS) {
  const mine = sites.map((s, i) => ({ s, i })).filter(o => o.s.key === key);
  const ex = mine.map(o => extentOf(o.i));
  const across = ex.map(e => e.across).filter(v => v > 0).sort((a, b) => a - b);
  if (!across.length) continue;
  const mid = across[Math.floor(across.length / 2)];
  const big = across[across.length - 1];
  // How far out, from the wide net — the fine one stops well short of the abyss.
  const ds = wide.filter(q => q.key === key).map(dist).sort((a, b) => a - b);
  rows.push({ name: mine[0].s.name, n: ds.length, mid, big,
              near: ds[0], far: ds[ds.length - 1] });
}
rows.sort((a, b) => a.near - b.near);
for (const r of rows) {
  console.log("  " + r.name.padEnd(18) + String(r.n).padStart(3) + "   " +
              k(r.mid).padStart(7) + "   " + k(r.big).padStart(7) + "   " +
              k(r.near).padStart(7) + "   " + k(r.far).padStart(8));
}
console.log("");
console.log("  TYPICAL/BIGGEST are how far across one patch is.");
console.log("  N and NEAREST/FARTHEST count every patch of that kind in a " +
            k(CELL * WIDE * 2) + " square, so FARTHEST reaches its corners.");
console.log("  TYPICAL/BIGGEST are measured on the " + sites.length +
            " patches nearest home.");
console.log("");

// ── what you actually fly through ─────────────────────────────────────────
console.log("WHAT A STRAIGHT LINE OUT OF HOME CROSSES");
console.log("-".repeat(64));
for (const deg of [0, 72, 144, 216, 288]) {
  const a = deg * Math.PI / 180;
  const legs = [];
  let last = null, since = 0;
  for (let d = 0; d <= 1200000; d += 4000) {
    const r = cf.regionProbe(Math.cos(a) * d, Math.sin(a) * d);
    if (!last) { last = r; since = d; continue; }
    if (r.key !== last.key) {
      legs.push(last.name + " " + k(d - since));
      last = r; since = d;
    }
  }
  legs.push(last.name + " " + k(1200000 - since));
  console.log("  " + String(deg + "°").padStart(4) + "  " + legs.join("  →  "));
}
console.log("");
console.log("  " + samples.toLocaleString() + " points sampled over a " +
            k(reach * 2) + " square.");

/* ── and the things that have to stay true of any world ─────────────────── */
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

/* Home is ordinary space, whatever the lattice rolled underneath it. The first
   two minutes are the same promise in every sector — see `regionOf` — and a
   pilot dropped into the middle of the Wells would be playing a different game
   from one dropped into the Settled Reach.

   Checked against **what the opening needs** rather than against whatever
   `HOME_REACH` currently is, which is the mistake the first version of this made:
   it probed at 40k because the bubble was 68k at the time, so when the bubble
   changed the test failed without anything being wrong. The opening lives in the
   Home and Open bands — the station, the water, the yard, and the first two yard
   parts — and those end at 25,000. That is the requirement. */
const OPENING_ENDS = 25000;
for (let ring = 4000; ring <= OPENING_ENDS; ring += 3000) {
  for (let a = 0; a < 24; a++) {
    const th = (a / 24) * Math.PI * 2;
    const r = cf.regionProbe(Math.cos(th) * ring, Math.sin(th) * ring);
    check(r.key === "normal",
          "home is " + r.name + " at " + k(ring) + " out — everything inside " +
          k(OPENING_ENDS) + " has to be ordinary space, because that is where " +
          "the opening happens");
  }
}

/* Enough different kinds within reach to be worth the system existing, and not
   so many that a world is a sampler. Measured across seeds: six to nine of the
   thirteen inside the abyssal boundary. */
const kinds320 = new Set();
for (let r = 20000; r <= 320000; r += 10000) {
  for (let a = 0; a < 64; a++) {
    const th = (a / 64) * Math.PI * 2;
    kinds320.add(cf.regionProbe(Math.cos(th) * r, Math.sin(th) * r).key);
  }
}
check(kinds320.size >= 4,
      "only " + kinds320.size + " kinds of space inside 320k — this world is " +
      "one thing all the way out");
/* There used to be a ceiling here — a world should not be a sampler of the whole
   set before the abyss — and it was a rule about the *old* geography, where a
   patch was 200k across and a run met six to nine kinds on the way out. At 93k
   a run meets eleven to thirteen, and that is the point of the change rather
   than a regression of it. What is worth keeping is the floor. */

/* And a patch has to be a place. The lattice is one site per 200k cell, so a
   typical patch runs about a cell across; anything much under that is a stripe
   you cross without noticing, which is the whole failure this system has. */
const acrossAll = sites.map((s, i) => extentOf(i).across).filter(v => v > 0);
const typical = acrossAll.sort((a, b) => a - b)[Math.floor(acrossAll.length / 2)];
check(typical > CELL * 0.6,
      "a typical patch is only " + k(typical) + " across against a " + k(CELL) +
      " lattice — these are stripes, not places");

if (problems.length) {
  console.log("");
  console.log("KONDRITE biome checks FAILED");
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("");
console.log("KONDRITE biome checks passed");
