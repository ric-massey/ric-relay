#!/usr/bin/env node
"use strict";

/* KONDRITE — THE DOOR
   ─────────────────────────────────────────────────────────────────────────────
   Step 3 of SIMULATIONS.md: you sign in before you play, the guest door is
   closed, and everybody has a pilot name because every board needs one.

   This suite exists because the door was, until it was written, the one part of
   the game no test could see. `test/page.js` stubs `cloud.js` and `config.js`
   off by default — so `cloud` is undefined in every other harness, `needsDoor()`
   is false, and the whole account layer is skipped. Six suites passing said
   nothing at all about it.

   So this one boots the game with a *fake* account service: a real `cloud.js`,
   a configuration that is not Ric's, and a `fetch` the test owns. What it
   checks is the pair of promises that make a required sign-in survivable —

     · a sign-in wall must never become a connection wall, and
     · a copy of the game with no account service must still be a whole game

   — plus the thing the plan says to assert rather than eyeball: that an email
   address never becomes the thing other people see.                           */

const assert = require("node:assert/strict");
const vm = require("node:vm");
const page = require("./page.js");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const noop = () => {};

/* ── a document whose elements stay the same ──────────────────────────────
   The other suites hand back a fresh stub for every `getElementById`, which is
   fine when nothing reads the panel back. Here the panel *is* the subject:
   which of its sections is showing is the answer to most of these questions,
   so an element has to be the same object the second time it is asked for. */
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

function makeDoc() {
  const byId = new Map();
  const make = id => ({
    id,
    style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: (() => {
      const on = new Set();
      return { add: c => on.add(c), remove: c => on.delete(c),
               toggle: (c, v) => (v === undefined ? (on.has(c) ? on.delete(c) : on.add(c))
                                                  : (v ? on.add(c) : on.delete(c))),
               contains: c => on.has(c), has: c => on.has(c) };
    })(),
    addEventListener: function (ev, fn) { (this.on = this.on || {})[ev] = fn; },
    removeEventListener: noop, appendChild: noop, removeChild: noop,
    setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop,
    click: function () { if (this.on && this.on.click) return this.on.click(); },
    replaceChildren: noop, insertBefore: noop, remove: noop, scrollIntoView: noop,
    cloneNode: () => make(id + "-copy"), select: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => make(id + "-q"), querySelectorAll: () => [],
    hidden: false, value: "", textContent: "", placeholder: "",
    width: 1000, height: 700, clientWidth: 1200, clientHeight: 800,
    dataset: {}, children: [], parentNode: null
  });
  const get = id => {
    if (!byId.has(id)) byId.set(id, make(id));
    return byId.get(id);
  };
  return {
    byId, get,
    doc: {
      getElementById: get, querySelector: () => get("?"), querySelectorAll: () => [],
      createElement: () => make("new"), addEventListener: noop,
      removeEventListener: noop, body: get("body"), documentElement: get("html"),
      hidden: false, visibilityState: "visible",
      exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null
    }
  };
}

/* Boot the game with an account service the test controls.

   `cloud` is the configuration `cloud.js` reads — pass null for "this copy of
   the game has no account service", which is a blank `config.js` and is the
   case that must still be a whole game. `store` seeds local storage, which is
   how a session that was cached on an earlier visit gets here. `net` answers
   every request; throwing from it is a tunnel. */
function boot(opts) {
  const o = opts || {};
  const store = Object.assign({}, o.store || {});
  const D = makeDoc();
  const timers = [];
  let now = 0;
  const calls = [];

  const windowStub = {
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
    location: { search: "?debug=1", href: "http://localhost/?debug=1", hash: "",
                origin: "http://localhost", pathname: "/" },
    history: { replaceState: noop },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const audioNode = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = audioNode())),
        apply: () => audioNode()
      });
      return { createOscillator: audioNode, createGain: audioNode,
               createBufferSource: audioNode, createBuffer: audioNode,
               createBiquadFilter: audioNode, createStereoPanner: audioNode,
               createDynamicsCompressor: audioNode,
               destination: {}, state: "running", resume: noop, close: noop,
               get currentTime() { return now / 1000; } };
    },
    performance: { now: () => now },
    // Real enough to be run on purpose: the door closes on a timer.
    setTimeout: (fn, ms) => { timers.push({ fn, at: now + (ms || 0) }); return timers.length; },
    clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams, btoa: s => Buffer.from(s, "binary").toString("base64"),
    atob: s => Buffer.from(s, "base64").toString("binary"),
    /* Every request the game makes, answered by the test. Recorded first, so a
       check can say "it played without asking anybody anything". */
    fetch: async (url, init) => {
      calls.push({ url: String(url), method: (init && init.method) || "GET",
                   body: init && init.body ? JSON.parse(init.body) : null });
      if (!o.net) throw new TypeError("Failed to fetch");
      return o.net({ url: String(url), init: init || {},
                     body: init && init.body ? JSON.parse(init.body) : null });
    }
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  if (o.cloud) windowStub.KONDRITE_CLOUD = o.cloud;

  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: D.doc, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, TypeError,
    isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  // `config.js` stays off: this suite brings its own, and the real one has
  // Ric's project in it. `cloud.js` comes on, which is the whole point.
  page.boot(sandbox, { with: ["cloud.js"] });

  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start, "?debug=1 must expose the hooks");
  const cloud = windowStub.KondriteCloud || sandbox.KondriteCloud;

  return {
    cf, cloud, store, calls, el: D.get, windowStub,
    // Run every timer that is due, which is how the door gets to close.
    settle: () => {
      now += 5000;
      const due = timers.splice(0, timers.length).filter(t => t.at <= now);
      for (const t of due) { try { t.fn(); } catch (_) {} }
    },
    shown: id => !D.get(id).hidden
  };
}

/* A session as it would have been left in storage by an earlier visit. */
const SESSION_KEY = "kondrite.account.v1";
const cached = extra => JSON.stringify(Object.assign({
  access: "access-token", refresh: "refresh-token",
  userId: "11111111-2222-3333-4444-555555555555",
  email: "pilot@example.com", name: "Ric",
  expires: Date.now() + 3600_000
}, extra || {}));

const FAKE = { url: "https://example.invalid", anonKey: "sb_publishable_test" };

// ── 1. no account service is still a whole game ────────────────────────────
/* `config.js` says blank means "no accounts … everything still works", and a
   fork of this repo has a blank one. A sign-in wall does not get to revoke
   that promise, so this is checked before anything else the step added. */
{
  const g = boot({ cloud: null });
  check(!g.cloud || !g.cloud.enabled(), "a blank config still configured a service");
  g.cf.screen("title");
  g.cf.play ? g.cf.play() : null;
  const started = (() => { g.cf.start("survey", 1); return g.cf.peek().mode; })();
  check(started === "SURVEY", "a copy with no account service could not start the game");
  check(g.calls.length === 0,
        "a copy with no account service made " + g.calls.length + " requests");
  console.log("  noservice  a blank config.js is a whole game, and asks nobody anything");
}

// ── 2. the guest door is closed ────────────────────────────────────────────
/* Not "the button is hidden" — gone. The markup, the flag it wrote, and the
   handler behind it are all asserted absent, because a hidden guest button is
   one `show()` away from being a guest button again. */
{
  const html = page.page().html;
  const inline = page.page().inline;
  check(!/btnAcctGuest/.test(html), "the guest button is still in the markup");
  check(!/acctGuestRow/.test(html), "the guest row is still in the markup");
  check(!/play as a guest/i.test(html), "the panel still offers to play as a guest");
  check(!/kondrite\.account\.guest/.test(inline),
        "the guest flag is still written to storage");
  check(!/guestChosen|chooseGuest/.test(inline),
        "the guest choice is still part of the door");
  console.log("  noguest    the guest button, its row, its flag and its handler are gone");
}

// ── 3. signed out, the door stands in front of both of them ────────────────
/* "Before single player and before multiplayer" — so the game's button and the
   machines' button, which is every way into a match from the front page. */
{
  const g = boot({ cloud: FAKE });
  check(g.cloud.enabled(), "the fake service did not configure");
  check(!g.cloud.session(), "a clean storage came back signed in");

  g.cf.screen("title");
  g.cf.title ? g.cf.title() : null;
  g.cf.key("Enter");                       // the game
  check(g.cf.peek().mode !== "SURVEY" || g.cf.screenNow() === "title",
        "the game started with nobody signed in");
  check(!g.el("account").hidden, "pressing the game did not open the door");

  const g2 = boot({ cloud: FAKE });
  g2.cf.screen("title");
  g2.cf.key("ArrowRight");                 // onto SIMULATORS
  g2.cf.key("Enter");
  check(g2.cf.screenNow() !== "sims",
        "the machines opened with nobody signed in: " + g2.cf.screenNow());
  check(!g2.el("account").hidden, "pressing the machines did not open the door");
  console.log("  bothdoors  signed out, neither the game nor the machines open");
}

// ── 4. a cached session plays, and plays with no network at all ────────────
/* The one that stops a required sign-in becoming a required connection. Every
   request fails, the way it does on a plane; the game boots, the survey runs,
   and nothing waited for a server. */
{
  const g = boot({ cloud: FAKE, store: { [SESSION_KEY]: cached() } });
  check(!!g.cloud.session(), "a cached session did not come back");
  check(g.cloud.session().name === "Ric", "the cached session lost its name");
  g.cf.start("survey", 1);
  check(g.cf.peek().mode === "SURVEY", "a cached session could not start the game");
  check(!!g.cf.survey(), "the sector did not build");
  check(g.calls.length === 0,
        "booting on a cached session made " + g.calls.length + " requests");
  console.log("  offline    a cached session plays with every request failing");
}

/* 5 and 6 are the only asynchronous checks here, and they are the pair that
   gives each other meaning: an unreachable service must not sign anybody out,
   and a refused token must. Run together, at the end, where a real `await` is
   available. */
async function refreshChecks() {
  // ── 5. being offline does not sign anybody out ───────────────
  /* The bug this step had to fix before it could close the guest door. `fresh`
     signs you out when the refresh is refused, which is right — a rotated
     token never becomes valid again. It was doing the same thing when it could
     not reach the service *at all*, which on a sign-in wall would have taken
     the game away from somebody in a tunnel, permanently. */
  {
    const g = boot({ cloud: FAKE,
                     store: { [SESSION_KEY]: cached({ expires: Date.now() - 1000 }) } });
    check(!!g.cloud.session(), "an expired-but-cached session did not load");
    g.cloud.push('{"seed":1}');
    const r = await g.cloud.flush();
    check(r && r.synced === false, "an unreachable service reported a successful save");
    check(g.calls.length > 0, "nothing was even attempted");
    check(!!g.cloud.session(),
          "being unable to reach the service signed the player out — the plane is a brick");
    // And the game is still playable on it, which is the point of the session.
    g.cf.start("survey", 1);
    check(g.cf.peek().mode === "SURVEY", "the game stopped being playable offline");
    console.log("  tunnel     an unreachable service is not a refusal · " +
                "the session survives and the game plays on");
  }

  // ── 6. a refusal still signs you out ───────────────────────
  /* The other half, or the check above would pass on a `fresh` that never
     signed anybody out at all. */
  {
    const g = boot({
      cloud: FAKE,
      store: { [SESSION_KEY]: cached({ expires: Date.now() - 1000 }) },
      net: async () => ({ ok: false, status: 400,
                          text: async () => JSON.stringify({ msg: "Invalid Refresh Token" }) })
    });
    g.cloud.push('{"seed":1}');
    await g.cloud.flush();
    check(!g.cloud.session(), "a refused refresh token left the player signed in");
    console.log("  revoked    a refusal does sign you out, so the check above means something");
  }
}

// ── 7. signed in is not enough: a board needs a name ───────────────────────
{
  const g = boot({ cloud: FAKE, store: { [SESSION_KEY]: cached({ name: "" }) } });
  check(!!g.cloud.session(), "the session did not load");
  check(g.cloud.session().name === "", "the fixture had a name after all");
  g.cf.account();
  check(g.shown("acctName"), "an account with no name was not asked for one");
  check(!g.shown("acctOut"), "an account with no name was asked to sign in again");
  console.log("  unnamed    an account made before names existed is asked for one");
}

// ── 8. what a name is ──────────────────────────────────────────────────────
/* One rule, in `cloud.pilot`, because the box that asks and the board that
   prints must not disagree. An email is the case worth naming: it is what a
   player will paste in if the box does not stop them, and the whole point of a
   pilot name is that an address never becomes public. */
{
  const g = boot({ cloud: FAKE });
  const P = g.cloud.pilot;
  const good = ["Ric", "Ric Massey", "a_b-c 1", "x".repeat(16)];
  const bad = ["", "ab", "x".repeat(17), "-nope", "nope-", "<script>",
               "ric@example.com", "   "];
  for (const n of good) check(P.ok(P.clean(n)), "a good name was refused: " + JSON.stringify(n));
  for (const n of bad) check(!P.ok(P.clean(n)), "a bad name was allowed: " + JSON.stringify(n));
  check(P.clean("  Ric   Massey  ") === "Ric Massey", "a name was not tidied");
  check(bad.every(n => typeof P.why(n) === "string" && P.why(n).length > 0),
        "a refused name is refused without saying why");
  console.log("  names      3 to 16, letters and digits at both ends · an email is not a name");
}

// ── 9. the email never becomes the public thing ────────────────────────────
/* Asserted rather than eyeballed, which is what the plan asks for. */
{
  const g = boot({ cloud: FAKE, store: { [SESSION_KEY]: cached() } });
  g.cf.account();
  const who = g.el("acctWho").textContent;
  check(who === "Ric", "the panel showed " + JSON.stringify(who) + " rather than the name");
  check(!/@/.test(who), "an email address reached the part of the panel that names you");
  console.log("  private    you are your pilot name; the email stays a way to sign in");
}



refreshChecks().then(() => {
  if (problems.length) {
    console.log("KONDRITE door checks FAILED");
    for (const p of problems) console.log("  · " + p);
    process.exit(1);
  }
  console.log("KONDRITE door checks passed");
}, err => {
  console.log("KONDRITE door checks FAILED");
  console.log("  · " + ((err && err.stack) || err));
  process.exit(1);
});
