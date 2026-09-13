#!/usr/bin/env node
"use strict";

/* CROSSFIRE — THE BOOK
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
    hidden: (id || "") === "lobby", value: "", textContent: "",
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
  vm.runInContext(hudSrc, sandbox, { filename: "survey-hud.js" });
  vm.runInContext(inline, sandbox, { filename: "index.inline.js" });
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

let fails = 0;
function check(ok, why) {
  if (ok) return true;
  console.error("  FAIL  " + why);
  fails++;
  return false;
}

console.log("CROSSFIRE book checks");

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

if (fails) {
  console.error("\nCROSSFIRE book checks FAILED (" + fails + ")");
  process.exit(1);
}
console.log("CROSSFIRE book checks passed");
