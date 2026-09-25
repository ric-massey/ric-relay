#!/usr/bin/env node
"use strict";

/* KONDRITE — WHAT A SEED MAKES
   ─────────────────────────────────────────────────────────────────────────────
   A hash of the sector, for changing `survey-world.js` without changing the
   game.

   The generator is the one part of this where passing the suite is not the bar.
   A save stores a *seed*; the worlds it names are rebuilt from that seed every
   time it is loaded. So a change that makes generation faster, or tidier, and
   moves one float has silently thrown away every chart, pin, almanac entry and
   yard site in every save that exists — and no assertion about wells being
   bigger further out will notice, because they still are.

   The bar is this file. Run it, change the generator, run it again. The hashes
   have to match exactly. If they do not, the change is not an optimisation,
   whatever else it is.

       node test/fingerprint.js                 # the default seeds
       node test/fingerprint.js 1 606061 42     # or your own

   What goes into the hash, per seed:

     · 4,000 chunks, whole — planets, hulks, caches, stations, wells, fields,
       gates, wrecks, nebulae. Sorted keys and fixed-width floats, so it is
       about the sector and not about property order.
     · the nearest Warrens, at the resolution it is actually built at:
       360,000 `caveSolid` samples on the cave lattice.
     · 20,000 samples of `caveFill` and `caveEdge`, which are continuous —
       this is where a float that moved by one ulp shows up.
     · every streamed disc in the 7x7 chunks around that region, which is what
       the chunk streamer really hands the renderer.

   Asked through the `?debug=1` hooks rather than of the module. That matters:
   `window.KondriteSurveyWorld` is the factory, so `WORLD.caveSolidAt` is
   `undefined`, and a `typeof` guard around it makes this whole file a no-op
   that prints a hash and proves nothing. It did, once. */

const crypto = require("node:crypto");
const vm = require("node:vm");
const page = require("./page.js");

const noop = () => {};

function stubCtx() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return str => ({ width: String(str).length * 8 });
      if (k === "createLinearGradient" || k === "createRadialGradient" ||
          k === "createPattern") return () => ({ addColorStop: noop });
      return k in t ? t[k] : (t[k] = noop);
    },
    set: (t, k, v) => (t[k] = v, true)
  });
}

function stubEl(id) {
  return {
    id: id || "", style: { setProperty: noop, getPropertyValue: () => "",
                           removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop,
    removeChild: noop, setAttribute: noop, removeAttribute: noop, focus: noop,
    blur: noop, click: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop,
    releasePointerCapture: noop, querySelector: () => stubEl(),
    querySelectorAll: () => [], hidden: false, value: "", textContent: "",
    width: 1000, height: 700, dataset: {}, children: [], parentNode: null
  };
}

const els = {};
const documentStub = {
  getElementById: id => (els[id] || (els[id] = stubEl(id))),
  querySelector: () => stubEl(), querySelectorAll: () => [],
  createElement: tag => stubEl(tag), addEventListener: noop,
  removeEventListener: noop, body: stubEl(), documentElement: stubEl(),
  hidden: false, visibilityState: "visible", exitPointerLock: noop,
  exitFullscreen: noop, fullscreenElement: null
};

function boot(seed) {
  const store = {};
  const win = {
    KONDRITE_NO_INTRO: true,
    addEventListener: noop, removeEventListener: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
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
      key: i => Object.keys(store)[i] ?? null,
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    },
    location: { search: "?debug=1&seed=" + seed, href: "http://x/", hash: "" },
    innerWidth: 1000, innerHeight: 700, devicePixelRatio: 1,
    performance: { now: () => 0 }, setTimeout: noop, clearTimeout: noop,
    setInterval: noop, clearInterval: noop, alert: noop,
    prompt: () => null, confirm: () => false
  };
  win.window = win;
  const sandbox = Object.assign(Object.create(null), win, {
    document: documentStub, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, isNaN, isFinite,
    parseInt, parseFloat, Infinity, NaN, undefined, URLSearchParams
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  page.boot(sandbox);
  const cf = win.__cf || sandbox.__cf;
  if (!cf || !cf.chunk) throw new Error("?debug=1 did not expose the survey hooks");
  cf.start("survey", 1);
  return cf;
}

/* Sorted keys and fixed-width floats: two runs must not differ because a
   property was assigned in a different order or a float printed shorter. */
function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort()
      .map(k => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  if (typeof v === "number") {
    return Number.isFinite(v) ? v.toFixed(9) : String(v);
  }
  return JSON.stringify(v);
}
const F = n => (Number.isFinite(n) ? n.toFixed(9) : String(n));

/* ── what is the world, and what is only flying through it ────────────────
   A chunk carries the traffic that starts in it, and a traffic entry carries
   a `speed` taken from its hull's row in the ship table. That is tuning, not
   terrain: a save stores a seed, and nothing in a save depends on how fast a
   passing freighter cruises — the ship is gone the moment you leave the chunk
   and is rebuilt from the table next time.

   So it comes out of the hash. Everything that says *which ship is where* —
   where it is, where it came from, where it is going, what it is, whose flag
   it flies, what it is carrying — stays in. Re-balancing the roster should
   not read as "you have thrown away everyone's charts", or the next person to
   see this fire will learn to ignore it. */
const worldOnly = (v, key) => {
  if (Array.isArray(v)) return v.map(x => worldOnly(x, key));
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) {
      if (key === "traffic" && k === "speed") continue;
      out[k] = worldOnly(v[k], key === "traffic" ? key : k);
    }
    return out;
  }
  return v;
};

function fingerprint(seed) {
  const cf = boot(seed);
  const h = crypto.createHash("sha256");

  /* 1. The sector itself. A spiral rather than a ring, so the sample is not
        all at one range and not all on one bearing. */
  for (let i = 0; i < 4000; i++) {
    const a = i * 2.399963, r = 40 + i * 0.37;
    const cx = Math.round(Math.cos(a) * r), cy = Math.round(Math.sin(a) * r);
    h.update(cx + "," + cy + "=" + stable(worldOnly(cf.chunk(cx, cy), "")));
  }

  /* 2. The rock, found the way test/warrens.js finds it. */
  const sites = cf.regionSites(Math.ceil(700000 / cf.regionCell()))
    .filter(s => s.key === "warrens")
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  let solidPct = null, discs = 0;
  if (sites.length) {
    const w = sites[0], cell = cf.caveCell();
    let solid = 0, n = 0;
    for (let j = -300; j < 300; j++) {
      for (let i = -300; i < 300; i++) {
        const s = cf.caveSolid(w.x + i * cell, w.y + j * cell);
        if (s) solid++;
        n++;
        h.update(s ? "1" : "0");
      }
    }
    solidPct = (100 * solid) / n;
    // The continuous fields, where a moved float actually shows.
    for (let i = 0; i < 20000; i++) {
      const x = w.x + ((i * 7919) % 120000) - 60000;
      const y = w.y + ((i * 104729) % 120000) - 60000;
      h.update("|" + F(cf.caveFill(x, y)) + "," + F(cf.caveEdge(x, y)));
    }
    // And the discs the streamer really builds.
    const CH = cf.sectorSpan().chunk;
    const bx = Math.round(w.x / CH), by = Math.round(w.y / CH);
    for (let j = -3; j <= 3; j++) {
      for (let i = -3; i <= 3; i++) {
        for (const g of cf.chunk(bx + i, by + j).caveSegs) {
          discs++;
          h.update("#" + F(g.x) + "," + F(g.y) + "," + F(g.r || 0));
        }
      }
    }
  }
  return { hash: h.digest("hex"), solidPct, discs, warrens: sites.length };
}

const seeds = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const SEEDS = seeds.length ? seeds : [1, 606061, 424242];

console.log("");
console.log("KONDRITE — what a seed makes");
console.log("=".repeat(62));
const t0 = Date.now();
for (const seed of SEEDS) {
  const r = fingerprint(seed);
  console.log("  seed " + String(seed).padEnd(10) + r.hash.slice(0, 32) +
              (r.warrens
                ? "  rock " + r.solidPct.toFixed(3) + "%  discs " + r.discs
                : "  (no Warrens within 700k)"));
}
console.log("=".repeat(62));
console.log("  " + SEEDS.length + " seeds in " +
            ((Date.now() - t0) / 1000).toFixed(1) + "s · " +
            "these must not change unless the sector is meant to");
console.log("");
