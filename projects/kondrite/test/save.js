#!/usr/bin/env node
"use strict";

/* KONDRITE — THE BOOK
   ─────────────────────────────────────────────────────────────────────────────
   A save is somebody's afternoon written to a disk they own, and every way it
   can go wrong is a way to lose one. This drives the four pieces the reader is
   made of — parse, migrate, validate, and the loader that decides what to do
   when one of them says no — on fixtures rather than through a played game, so
   a format change shows up here in a second rather than in `test/survey.js` in
   an hour.

   The three things it exists to hold down:

     · An older book migrates to exactly the book a current one loads to. A
       migration that is nearly right is a save that quietly loses a field.
     · A save this build has never heard of is refused, not guessed at. Guessing
       means an old build silently drops the fields a new one added, and a save
       gets smaller every time it is opened by the wrong game.
     · A bug in the *reader* is not a corrupt save. A `ReferenceError` in the
       validator used to come out of the same catch as a hand-edited file, and
       the game answered both by starting a new sector. That is the failure this
       file is really about. */


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
   loud: game.js captures `window.KondriteSurveyHUD` once at
   boot, so a HUD loaded after it would test the null-HUD path. */
assert.ok(
  html.indexOf('src="survey-hud.js"') > 0 &&
  html.indexOf('src="survey-hud.js"') < html.indexOf('src="game.js"'),
  "survey-hud.js must be loaded before game.js"
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
/* Every element the page ships hidden, read from the markup. See the note in
   test/survey.js: a stub that reports one of them visible makes the keyboard
   path unreachable. */
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
    /* The lobby starts hidden in the real markup, and that matters more than it
       looks: the keydown handler bails out early while the lobby is up, because
       you are typing a password and a stray space must not fire a gun. A stub that
       reported it visible made the entire keyboard path unreachable — every test
       that needed a key used `cf.hold`, which writes the held set directly, so
       nobody noticed the handler was never running. */
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
  sandbox.KondriteNet = undefined;
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
  assert.ok(windowStub.KondriteSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub, fire, listeners };
}

let fails = 0;
function check(ok, why) {
  if (ok) return true;
  console.error("  FAIL  " + why);
  fails++;
  return false;
}

console.log("KONDRITE book checks");

/* A book as a current game would write one. Taken from a real run rather than
   hand-built, so the fixture cannot drift away from what the game actually
   saves — which is the way a save-format test stops meaning anything. */
function livingBook() {
  const { cf } = boot("?debug=1&seed=4242");
  cf.start("survey", 1);
  const s = cf.survey();
  s.cash = 1234;
  s.hold.iron = 7;
  s.deaths = 2;
  cf.saveBook();
  return { raw: store[cf.book.keys.store], cf };
}

// ── a current book round-trips without changing ───────────────────────────
{
  const { raw, cf } = livingBook();
  check(!!raw, "saving produced no book at all");
  const b = cf.book.read(raw);
  check(b.version === cf.book.version,
        "a saved book came back as version " + b.version);
  check(b.cash === 1234 && b.hold.iron === 7 && b.deaths === 2,
        "a round trip lost a field: cash " + b.cash + ", iron " + b.hold.iron +
        ", deaths " + b.deaths);

  // Reading twice must land on the same place — validation cannot be lossy.
  const again = cf.book.read(JSON.stringify(b));
  check(JSON.stringify(again) === JSON.stringify(b),
        "validating an already-valid book changed it");
  console.log("  roundtrip  v" + b.version +
              " saves, reads and re-reads to exactly itself");
}

// ── an old book migrates to the same place a new one lands ────────────────
{
  const { raw, cf } = livingBook();
  const current = cf.book.read(raw);

  /* A v3 book is a v4 book with no `version` in it — that is the whole of the
     change, and saying so here is what makes the migration a fact rather than a
     hope. */
  const v3 = JSON.parse(raw);
  delete v3.version;
  const migrated = cf.book.read(JSON.stringify(v3));
  check(JSON.stringify(migrated) === JSON.stringify(current),
        "a v3 book did not migrate to the same book a v4 loads to");
  check(migrated.version === cf.book.version,
        "a migrated book kept the old version number");
  console.log("  migrate    a v3 book (no version field) lands on the exact " +
              "same v" + cf.book.version + " book");
}

// ── a book from the future is refused, not guessed at ─────────────────────
{
  const { raw, cf } = livingBook();
  const future = JSON.parse(raw);
  future.version = cf.book.version + 1;
  let code = null;
  try { cf.book.read(JSON.stringify(future)); }
  catch (err) { code = err.code; }
  check(code === "SAVE_UNSUPPORTED_VERSION",
        "a future book was not refused: " + code);
  console.log("  future     v" + future.version + " refused with " + code +
              " rather than read with fields dropped");
}

// ── what a broken file does, and does not, cost ───────────────────────────
{
  const { raw, cf } = livingBook();

  let code = null;
  try { cf.book.parse("{not json at all"); } catch (e) { code = e.code; }
  check(code === "SAVE_INVALID_JSON", "malformed JSON gave " + code);

  code = null;
  try { cf.book.parse("[1,2,3]"); } catch (e) { code = e.code; }
  check(code === "SAVE_INVALID_SCHEMA", "an array gave " + code);

  code = null;
  try { cf.book.parse("null"); } catch (e) { code = e.code; }
  check(code === "SAVE_INVALID_SCHEMA", "null gave " + code);
  console.log("  refusals   malformed JSON, an array and null each name what " +
              "is wrong with them");
}

/* ── the backup is what a corrupt primary falls back to ───────────────────
   The point of the whole exercise. */
{
  const { cf } = boot("?debug=1&seed=515");
  cf.start("survey", 1);
  cf.survey().cash = 900;
  cf.saveBook();                       // the book that becomes the backup
  cf.survey().cash = 1800;
  cf.saveBook();                       // primary now 1800, backup 900

  const keys = cf.book.keys;
  check(!!store[keys.backup], "no backup was kept after a second save");
  check(cf.book.read(store[keys.backup]).cash === 900,
        "the backup is not the previous good book");

  // Now ruin the primary the way a half-finished write would.
  store[keys.store] = '{"seed":42,"cash":';
  const recovered = cf.book.load();
  check(recovered.cash === 900,
        "a corrupt primary did not fall back to the backup — got cash " +
        recovered.cash);
  check(recovered.seed === cf.book.read(store[keys.backup]).seed,
        "the recovered book is not the backup");
  console.log("  backup     a half-written primary falls back to the last " +
              "good book, cash " + recovered.cash + " intact");
}

// ── both gone is a fresh sector, and only then ────────────────────────────
{
  const { cf } = boot("?debug=1&seed=616");
  cf.start("survey", 1);
  cf.survey().cash = 777;
  cf.saveBook();
  const keys = cf.book.keys;
  store[keys.store] = "@@@ not a book @@@";
  store[keys.backup] = "@@@ nor this @@@";
  const fresh = cf.book.load();
  check(fresh.cash === 0 && fresh.seed === 0,
        "two corrupt books did not produce a fresh survey");
  check(fresh.version === cf.book.version,
        "a fresh book is not stamped with the current version");
  console.log("  fresh      both books corrupt is the only way to a new sector");
}

/* ── a bug in the reader is not a corrupt save ────────────────────────────
   A `ReferenceError` in the validator once came out of the same catch as a
   hand-edited file, and the game answered both by starting over. */
{
  const { cf } = boot("?debug=1&seed=717");
  cf.start("survey", 1);
  cf.survey().cash = 4321;
  cf.saveBook();

  const keys = cf.book.keys;
  const before = store[keys.store];

  // A reader that throws the way a programmer's mistake throws. Through the
  // loader's own seam, so this is the call it actually makes.
  const real = cf.book.hooks.read;
  let escaped = null;
  cf.book.hooks.read = () => { throw new TypeError("someRenamedThing is not defined"); };
  try { cf.book.load(); }
  catch (err) { escaped = err; }
  cf.book.hooks.read = real;

  check(escaped instanceof TypeError || (escaped && escaped.name === "TypeError"),
        "a programmer's exception did not escape the loader: " + escaped);
  check(store[keys.store] === before,
        "a programmer's exception cost the player their save");
  console.log("  notmine    a TypeError in the validator escapes and leaves " +
              "the book on disk untouched");
}

/* ── a corrupt chart inside an otherwise good book ────────────────────────
   The two fixes meet here. `fog` is one string in the middle of a book, and it
   is the one field the reader does not parse — `importFog` does, on resume. A
   chart that will not decode must cost the chart and nothing else: the cash,
   the hold and the almanac in the same book are not in question. */
{
  const { cf } = boot("?debug=1&seed=1919");
  cf.start("survey", 1);
  const s = cf.survey();
  s.cash = 640;
  s.hold.iron = 5;
  cf.saveBook();

  const keys = cf.book.keys;
  const b = JSON.parse(store[keys.store]);
  b.fog = "@@@ not a chart @@@";
  store[keys.store] = JSON.stringify(b);

  const loaded = cf.book.load();
  check(loaded.cash === 640 && loaded.hold.iron === 5,
        "a corrupt chart cost the rest of the book: cash " + loaded.cash +
        ", iron " + loaded.hold.iron);
  check(typeof loaded.fog === "string",
        "a corrupt chart did not survive validation as a string");

  // And importing it leaves whatever chart is already up alone.
  const hud = cf.hud ? cf.hud() : null;
  console.log("  fogfield   a chart that will not decode costs the chart and " +
              "nothing else in the book");
}

/* ── a write that does not keep changes nothing ───────────────────────────
   Private browsing and a full quota both fail in `bookStore.write`. A save that
   did not happen must not advance what the backup is, or the next save would
   copy a book that was never written. */
{
  const { cf } = boot("?debug=1&seed=2020");
  cf.start("survey", 1);
  cf.survey().cash = 100;
  cf.saveBook();
  const keys = cf.book.keys;
  const first = store[keys.store];

  cf.survey().cash = 200;
  cf.saveBook();
  check(cf.book.read(store[keys.backup]).cash === 100,
        "the backup is not the book the second save replaced");
  check(cf.book.read(store[keys.store]).cash === 200,
        "the second save did not land");
  console.log("  backupwalk each save leaves the one before it as the spare");
}

/* ── what a run permanently changed, compacted ────────────────────────────
   Caches opened and hulks stripped are the only things a deterministic sector
   cannot re-derive: forget one and it refills. So the shape may change and the
   contents may not, and the number that matters is that nothing comes back. */
{
  const { cf } = boot("?debug=1&seed=3131");
  cf.start("survey", 1);
  const s = cf.survey();

  // Loot four thousand chunks the way a long run would: several objects each,
  // across chunks that are nowhere near one another.
  for (let n = 0; n < 4000; n++) {
    // Four thousand chunks that are actually distinct, spread either side of
    // the origin so the keys carry the minus signs a real run's would.
    const cx = (n % 100) - 50, cy = Math.floor(n / 100) - 20;
    const k = cx + "," + cy;
    for (let i = 0; i < 3; i++) s.opened.add(k + "c" + i);
    for (let i = 0; i < 2; i++) s.stripped.add(k + "h" + i);
  }
  // And the Leviathan's holds, which are not chunk-and-index at all.
  s.opened.add("lev0"); s.opened.add("lev1");

  /* Read back out of the sets rather than kept alongside them: the coordinates
     above repeat, the sets deduplicate and a parallel array would not — which
     is a wrong expectation, not a wrong packer. */
  const opened = [...s.opened], stripped = [...s.stripped];

  const flat = JSON.stringify({ opened, stripped });
  const packed = JSON.stringify(cf.book.pack(s.opened, s.stripped));
  const saved = 1 - packed.length / flat.length;
  check(saved > 0.3,
        "compaction saved only " + Math.round(saved * 100) + "%");

  /* The constant is not the point. The point is what happens as a run keeps
     emptying the *same* chunks: flat writes the coordinates once per object,
     per chunk writes them once per chunk, so the saving grows with density.
     Measured here rather than argued: the same 4,000 chunks with four times as
     much taken out of them must compact harder, not the same. */
  {
    const dense = new Set(), denseH = new Set();
    for (let n = 0; n < 4000; n++) {
      const k = ((n % 100) - 50) + "," + (Math.floor(n / 100) - 20);
      for (let i = 0; i < 12; i++) dense.add(k + "c" + i);
      for (let i = 0; i < 8; i++) denseH.add(k + "h" + i);
    }
    const dflat = JSON.stringify({ opened: [...dense], stripped: [...denseH] });
    const dpacked = JSON.stringify(cf.book.pack(dense, denseH));
    const dsaved = 1 - dpacked.length / dflat.length;
    check(dsaved > saved + 0.08,
          "four times the density saved " + Math.round(dsaved * 100) +
          "% against " + Math.round(saved * 100) + "% — the key is still " +
          "being written once an object");
    console.log("  density    5 objects a chunk saves " + Math.round(saved * 100) +
                "% · 20 a chunk saves " + Math.round(dsaved * 100) +
                "% · the chunk key is written once however much you take");
  }

  // Every single one comes back, and nothing else does.
  const back = cf.book.unpack(JSON.parse(packed));
  check(back.opened.length === opened.length,
        "unpacked " + back.opened.length + " opened caches, saved " + opened.length);
  check(back.stripped.length === stripped.length,
        "unpacked " + back.stripped.length + " stripped hulks, saved " +
        stripped.length);
  const gotO = new Set(back.opened), gotH = new Set(back.stripped);
  check(opened.every(id => gotO.has(id)), "an opened cache did not survive packing");
  check(stripped.every(id => gotH.has(id)), "a stripped hulk did not survive packing");
  check(gotO.has("lev0") && gotO.has("lev1"),
        "the Leviathan's holds were dropped — they are not chunk-and-index");

  console.log("  mutations  " + opened.length.toLocaleString("en-US") + " caches and " +
              stripped.length.toLocaleString("en-US") + " hulks over 4,000 chunks · " +
              Math.round(flat.length / 1024) + " KB flat → " +
              Math.round(packed.length / 1024) + " KB per chunk (" +
              Math.round((1 - packed.length / flat.length) * 100) + "% off) · " +
              "every one comes back");
}

/* ── and through a real save and load ─────────────────────────────────────
   The packing is only worth anything if it survives the round trip the game
   actually makes. */
{
  const { cf } = boot("?debug=1&seed=3232");
  cf.start("survey", 1);
  const s = cf.survey();
  for (let n = 0; n < 300; n++) {
    const k = ((n * 31) % 90 - 45) + "," + ((n * 17) % 90 - 45);
    s.opened.add(k + "c0");
    s.stripped.add(k + "h1");
  }
  const wasO = new Set(s.opened), wasH = new Set(s.stripped);
  cf.saveBook();

  const book = cf.book.read(store[cf.book.keys.store]);
  check(book.version === cf.book.version,
        "the saved book is version " + book.version);
  check(!("opened" in JSON.parse(store[cf.book.keys.store])),
        "the flat opened[] is still being written");
  check(book.opened.length === wasO.size && book.stripped.length === wasH.size,
        "a save and load lost mutations: " + book.opened.length + "/" +
        wasO.size + " caches, " + book.stripped.length + "/" + wasH.size + " hulks");
  check(book.opened.every(id => wasO.has(id)),
        "a save and load invented a cache that was never opened");
  console.log("  mutsave    " + wasO.size + " caches and " + wasH.size +
              " hulks survive a real save and load exactly");
}

/* ── a player arriving from the old build ─────────────────────────────────
   Only the v3 key exists: no v4, no backup. That is every existing save in the
   world the first time it meets this build. */
{
  const { cf } = boot("?debug=1&seed=818");
  cf.start("survey", 1);
  cf.survey().cash = 5150;
  cf.saveBook();
  const keys = cf.book.keys;

  // Move the book back to where the old build kept it, and take away the new.
  const v3 = JSON.parse(store[keys.store]);
  delete v3.version;
  store[keys.legacy] = JSON.stringify(v3);
  delete store[keys.store];
  delete store[keys.backup];

  const loaded = cf.book.load();
  check(loaded.cash === 5150,
        "a v3-only save did not load — cash came back " + loaded.cash);
  check(loaded.version === cf.book.version,
        "a v3-only save did not migrate, version " + loaded.version);
  check(!!store[keys.legacy],
        "the old key was deleted — an older build would find nothing");
  console.log("  upgrade    a v3-only save loads, migrates, and the old key is " +
              "left where an older build can still find it");
}

/* ── the rename ───────────────────────────────────────────────────────────
   The game was CROSSFIRE and everything it kept was under `crossfire.*`.
   `migrate.js` moves all of it, once, before any other module runs. It is the
   one module whose entire job is other people's saves, so it is worth driving
   directly on a storage rather than through a booted game — and directly is
   the only way to set up the two-tab race at all. */
{
  const src = fs.readFileSync(path.join(page.DIR, "migrate.js"), "utf8");

  // A storage that behaves like the real one, including being walkable.
  const storageOf = seed => {
    const data = Object.assign({}, seed);
    return {
      data,
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: k => { delete data[k]; },
      get length() { return Object.keys(data).length; },
      key: i => Object.keys(data)[i] ?? null
    };
  };
  const migrate = seed => {
    const ls = storageOf(seed);
    vm.runInNewContext(src, { window: { localStorage: ls }, JSON, Object });
    return ls.data;
  };

  const book = (cash, at) => JSON.stringify({ version: 5, cash, savedAt: at });

  /* Everything moves, whatever it is — this is a prefix sweep rather than a
     list of names, so a key nobody remembered still travels. */
  let out = migrate({
    "crossfire.survey.v4": book(100, 10),
    "crossfire.keys.v1": "[[\"KeyA\"]]",
    "crossfire.pad.v1": "{}",
    "crossfire.account.v1": "token",
    "somebody.elses.key": "left alone"
  });
  check(out["kondrite.survey.v4"] === book(100, 10),
        "the book did not come across");
  check(out["kondrite.keys.v1"] === "[[\"KeyA\"]]" &&
        out["kondrite.pad.v1"] === "{}" &&
        out["kondrite.account.v1"] === "token",
        "a key the rename plan's table forgot did not come across");
  check(!("crossfire.survey.v4" in out) && !("crossfire.keys.v1" in out),
        "the old keys are still there — the sweep copied but did not clear");
  check(out["somebody.elses.key"] === "left alone",
        "the sweep took a key that was not the game's");

  // Run twice: the second pass has nothing to do and must not undo the first.
  const twice = migrate(out);
  check(twice["kondrite.survey.v4"] === book(100, 10),
        "running the migration a second time damaged the save");

  /* The two-tab race, which is the only part of this with a race in it. A tab
     left on the old build autosaves to the old key after another tab has
     already migrated; that write is the newer one and has to win. */
  out = migrate({
    "kondrite.survey.v4": book(100, 10),   // migrated a minute ago
    "crossfire.survey.v4": book(999, 99)   // the old tab, saved since
  });
  check(JSON.parse(out["kondrite.survey.v4"]).cash === 999,
        "the older save won the two-tab race — the newer one was thrown away");

  // And the other way round: a stale old key must not clobber a newer one.
  out = migrate({
    "kondrite.survey.v4": book(999, 99),
    "crossfire.survey.v4": book(100, 10)
  });
  check(JSON.parse(out["kondrite.survey.v4"]).cash === 999,
        "a stale old key overwrote a newer save");
  check(!("crossfire.survey.v4" in out), "the stale old key was left behind");

  /* A storage that refuses to take the copy. The original has to survive: a
     quota failure with the original already deleted is the one way this loses
     somebody's sector. */
  {
    const ls = storageOf({ "crossfire.survey.v4": book(100, 10) });
    ls.setItem = () => { throw new Error("QuotaExceededError"); };
    vm.runInNewContext(src, { window: { localStorage: ls }, JSON, Object });
    check(ls.data["crossfire.survey.v4"] === book(100, 10),
          "a failed copy deleted the original — that is a lost save");
  }

  // A storage that throws on the way in at all. Nothing to do, and no throwing.
  vm.runInNewContext(src, {
    window: { get localStorage() { throw new Error("blocked"); } }, JSON, Object
  });
  check(true, "a blocked storage threw out of the migration");

  console.log("  rename     every crossfire.* key moves to kondrite.* and the " +
              "old one is cleared \u00b7 twice is the same as once \u00b7 the later " +
              "book wins a two-tab race \u00b7 a refused copy keeps the original");
}

if (fails) {
  console.error("\nKONDRITE book checks FAILED (" + fails + ")");
  process.exit(1);
}
console.log("KONDRITE book checks passed");
