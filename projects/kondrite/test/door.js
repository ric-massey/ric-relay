#!/usr/bin/env node
"use strict";

/* KONDRITE — THE DOOR
   ─────────────────────────────────────────────────────────────────────────────
   Step 3 of archive/SIMULATIONS.md: you sign in before you play, the door is
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
  const calls = [], ownFiles = [];

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
      /* The game's own files are not somebody. The gun sounds are fetched out
         of the game's folder the way its scripts are, and asking a server for
         the page you are already on is not "asking anybody anything" — so they
         are kept off the list the checks count, and refused the way a missing
         file is, which leaves the synth voices playing. Only a relative path
         into `sounds/` gets this; anything with a host is still a call. */
      if (/^sounds\/[\w-]+\.wav$/.test(String(url))) {
        ownFiles.push(String(url));
        throw new TypeError("Failed to fetch");
      }
      calls.push({ url: String(url), method: (init && init.method) || "GET",
                   headers: (init && init.headers) || {},
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

// ── 2. the guest door is open, and it is a real answer ─────────────────────
/* Closed for a while, on the argument that a board needs a name; reopened on
   2026-09-24 because a game that will not start without an email is a game
   people close. What "real answer" means: the button is on the panel at the
   door and only there, pressing it starts the game, the choice is remembered
   so the door does not come back, a guest's scores go nowhere, and signing in
   or out clears the choice so the question gets asked again. */
{
  const GUEST_KEY = "kondrite.account.guest";
  const g = boot({ cloud: FAKE });
  g.cf.screen("title");
  g.cf.key("Enter");
  check(!g.el("account").hidden, "the door did not open for a signed-out player");
  check(g.shown("acctGuestRow"), "the guest button is not on the door");
  g.el("btnAcctGuest").click();
  check(g.el("account").hidden, "choosing guest did not close the door");
  check(g.cf.peek().mode === "SURVEY", "choosing guest did not start the game");
  check(g.store[GUEST_KEY] === "yes", "the guest choice was not remembered");
  check(g.calls.length === 0, "choosing guest made " + g.calls.length + " requests");

  /* Not queued, not sent: a guest has no reporter id, and rows that waited
     for one would land on whoever signs in next. */
  const took = g.cloud.reportMatch("match-1", [{ subject: "a", game: "rocks", value: 9 }]);
  check(took === 0 && g.cloud.scoresWaiting() === 0, "a guest's score was queued");

  /* Remembered: the next visit goes straight in, to the game and to online,
     which are the two doors the front page has. The stub document's elements
     are not `hidden` until something says so, unlike the real markup, so the
     panel is closed by hand first and "the door did not open" means it stayed
     that way. */
  const g2 = boot({ cloud: FAKE, store: { [GUEST_KEY]: "yes" } });
  g2.cf.screen("title");
  g2.el("account").hidden = true;
  g2.cf.key("Enter");
  check(g2.el("account").hidden, "a remembered guest was asked again");
  check(g2.cf.peek().mode === "SURVEY", "a remembered guest could not start the game");
  const g3 = boot({ cloud: FAKE, store: { [GUEST_KEY]: "yes" } });
  g3.cf.screen("title");
  g3.el("account").hidden = true;
  g3.el("lobby").hidden = true;
  // No net module in this sandbox, so the lobby may not finish drawing; what
  // matters is which panel opened.
  try { g3.cf.key("KeyO"); } catch (_) {}
  check(g3.el("account").hidden, "a remembered guest was asked again on the way online");
  check(!g3.el("lobby").hidden, "a remembered guest could not open the lobby");

  /* Opened from a menu rather than at the door, the panel does not offer it:
     there is no question being asked there to answer. */
  const g4 = boot({ cloud: FAKE });
  g4.cf.account();
  check(!g4.shown("acctGuestRow"), "the guest button is offered where nothing is being asked");

  /* The markup only ever says it once, and the panel's copy says the trade. */
  const html = page.page().html;
  check((html.match(/id="btnAcctGuest"/g) || []).length === 1, "the guest button is in the markup more than once");
  check(/Nothing goes on a board/.test(html), "the guest button does not say what a guest gives up");
  console.log("  guest      the guest door is open: it starts the game, is remembered, posts nothing, and is only offered at the door");
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

  /* The other door on the front page is online (`O`): the machines are one
     floor down inside a sector now, behind the same door as the game. An
     earlier version of this check pressed ArrowRight-Enter — which is
     CONTROLS — and asserted the screen was not "sims", a state that no longer
     exists, so it passed without testing anything. */
  const g2 = boot({ cloud: FAKE });
  g2.cf.screen("title");
  g2.el("account").hidden = true;
  g2.el("lobby").hidden = true;
  g2.cf.key("KeyO");
  check(g2.el("lobby").hidden, "the lobby opened with nobody signed in");
  check(!g2.el("account").hidden, "pressing online did not open the door");
  console.log("  bothdoors  signed out, neither the game nor the lobby opens");
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

// ── 10. the schema keeps the two postures apart ───────────────────
/* Read rather than run: nothing here can reach a Postgres, so what is checked
   is the shape of the file Ric pastes into the dashboard. These are the two
   properties that would be catastrophic to get wrong and invisible until
   somebody else read your save. */
{
  const sql = require("node:fs").readFileSync(
    require("node:path").join(page.DIR, "supabase/schema.sql"), "utf8");

  /* One policy is one statement, ending at its own semicolon. Split on the
     keyword alone and a block runs on into whatever table is defined after it
     — which it did, and made the profiles' `for update` look like one on
     `scores`. */
  const policies = [...sql.matchAll(/create policy[\s\S]*?;/g)].map(m => m[0]);

  // `saves` stays private. Every policy on it still names auth.uid().
  const savesPolicies = policies.filter(p => /on public\.saves/.test(p));
  check(savesPolicies.length >= 4, "the saves table lost its policies");
  check(savesPolicies.every(p => /auth\.uid\(\)/.test(p)),
        "a policy on saves no longer names auth.uid()");
  check(!/on public\.saves[\s\S]{0,200}using \(true\)/.test(sql),
        "the saves table has been made readable by everybody");

  // A score cannot be walked back: no update and no delete policy exists.
  const scorePolicies = policies.filter(p => /on public\.scores/.test(p));
  check(scorePolicies.length > 0, "the scores table has no policies at all");
  check(!scorePolicies.some(p => /\bfor update\b|\bfor delete\b/.test(p)),
        "a score can be changed or deleted after the fact");
  check(scorePolicies.some(p => /for insert[\s\S]*auth\.uid\(\) = reporter/.test(p)),
        "anybody can report as anybody");
  check(scorePolicies.some(p => /for select[\s\S]*using \(true\)/.test(p)),
        "the board cannot be read by the people on it");

  /* The agreement rule, which is the only thing that makes the board real. It
     has to be in the database — a check the client performs is not a check. */
  check(/count\(distinct reporter\) >= 2/.test(sql),
        "the agreement rule is not in the schema");
  check(/security_invoker = true/.test(sql),
        "a view reads with its owner's rights and goes round row-level security");

  // And no email ever reaches anything a stranger can select.
  check(!/\bemail\b/.test(sql.replace(/--[^\n]*/g, "")),
        "the schema mentions an email column outside its comments");
  console.log("  schema     saves stays private \u00b7 a score cannot be edited or " +
              "deleted \u00b7 you report only as yourself \u00b7 two witnesses, counted " +
              "in Postgres");
}

/* 11 and 12 reach the network, and a post lands on a microtask rather than on
   the line that asked for it — so they are awaited rather than read straight
   after. */
async function witnessChecks() {
  const ME = "11111111-2222-3333-4444-555555555555";
  const YOU = "22222222-3333-4444-5555-666666666666";
  const MATCH = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  // ── 11. what this client says it saw ────────────────────────
  /* A score is not a claim you make about yourself, so what this client posts
     is a row about *everybody it could name* — and the reporter on every one of
     them is this account, because the policy on the table refuses anything
     else. */
  {
    const g = boot({ cloud: FAKE, store: { [SESSION_KEY]: cached() },
                     net: async () => ({ ok: true, status: 201,
                                         text: async () => "" }) });
    g.cf.start("survival", 2);

    // A local game is not a witnessed one, whoever is sitting at it.
    g.cf.witness.online(false);
    g.cf.witness.seats([ME, YOU], MATCH);
    check(g.cf.witness.report({ kind: "lost" }).length === 0,
          "a local game filed a report on the real board");

    /* Nor an online one with nobody else signed in: there is no second account
       to agree, so the rows could never become a score. */
    g.cf.witness.online(true);
    g.cf.witness.seats([ME, ""], MATCH);
    check(g.cf.witness.report({ kind: "lost" }).length === 0,
          "a match with one signed-in player filed rows nobody can witness");
    g.cf.witness.seats([ME, ME], MATCH);
    check(g.cf.witness.report({ kind: "lost" }).length === 0,
          "one account in two seats was allowed to witness itself");

    // Two accounts: a row each, and this client is the reporter on both.
    g.cf.witness.seats([ME, YOU], MATCH);
    const rows = g.cf.witness.report({ kind: "lost" });
    check(rows.length === 2, "a two-account match filed " + rows.length + " rows");
    check(rows.some(r => r.subject === YOU),
          "this client said nothing about the other player, so nobody can be witnessed");

    await g.cloud.sendScores();
    const sent = g.calls.filter(c => /\/scores/.test(c.url));
    check(sent.length >= 1, "the report never reached the scores table");
    if (sent.length) {
      const body = sent[0].body;
      check(Array.isArray(body) && body.length === 2,
            "the rows were not posted together");
      check(body.every(r => r.reporter === ME),
            "a row was posted claiming somebody else reported it");
      check(body.every(r => r.match_id === MATCH),
            "the rows are not all about one match");
      check(body.every(r => typeof r.value === "number" && r.value >= 0),
            "a row carries something that is not a score");
      check(!JSON.stringify(body).includes("@"),
            "an email address reached the scores table");
      /* Re-posting has to be harmless, because the queue retries whatever it
         could not confirm — the primary key makes a repeat the same row. */
      check(/ignore-duplicates/.test(String(sent[0].headers.Prefer || "")),
            "a retried report would be refused rather than ignored");
    }
    console.log("  witness    a local game reports nothing \u00b7 so does a match " +
                "with nobody to agree \u00b7 two accounts file a row each, and you " +
                "can only ever be the reporter");
  }

  // ── 12. a match on a train still reaches the board ──────────────
  /* The same promise step 3 made about playing: a connection is not required to
     play, so it cannot be required to *have played*. A report made with no
     network waits in local storage — through a closed tab — and goes up on the
     next connection. */
  {
    const store = { [SESSION_KEY]: cached() };
    const g = boot({ cloud: FAKE, store });        // no `net`: everything fails
    g.cf.start("survival", 2);
    g.cf.witness.online(true);
    g.cf.witness.seats([ME, YOU], MATCH);
    g.cf.witness.report({ kind: "lost" });
    await g.cloud.sendScores();
    check(g.cloud.scoresWaiting() === 2,
          "an unsendable report was dropped rather than kept: " +
          g.cloud.scoresWaiting() + " waiting");
    check(!!g.store["kondrite.scores.v1"],
          "the report is only in memory, so closing the tab would lose it");

    /* And the next tab, with a connection, sends what the last one could not.
       The queue is read from storage at boot, which is what makes this true. */
    const g2 = boot({ cloud: FAKE, store: g.store,
                      net: async () => ({ ok: true, status: 201, text: async () => "" }) });
    check(g2.cloud.scoresWaiting() === 2,
          "a new tab did not pick up the waiting reports");
    const r = await g2.cloud.sendScores();
    check(r.sent === 2, "the waiting reports did not go up: " + JSON.stringify(r));
    check(g2.cloud.scoresWaiting() === 0, "they went up and stayed queued as well");
    check(!g2.store["kondrite.scores.v1"], "an empty queue was left in storage");

    console.log("  queued     a report with no connection waits in storage, " +
                "survives the tab, and goes up on the next one");
  }

  // ── 13. a board is read once, not on every frame ───────────────
  {
    const rows = [{ name: "RIC", value: 12, witnesses: 2,
                    user_id: "11111111-2222-3333-4444-555555555555" },
                  { name: "SPLITTOOTH", value: 9, witnesses: 3, user_id: "x" }];
    const g = boot({ cloud: FAKE, store: { [SESSION_KEY]: cached() },
                     net: async () => ({ ok: true, status: 200,
                                         text: async () => JSON.stringify(rows) }) });
    const first = await g.cloud.board("survival", 10);
    const again = await g.cloud.board("survival", 10);
    const reads = g.calls.filter(c => /\/board/.test(c.url));
    check(reads.length === 1,
          "the board was read " + reads.length + " times for two asks");
    check(first.length === 2 && again.length === 2, "the cached board came back empty");
    check(first[0].you === true && first[1].you === false,
          "the board did not know which row is yours");
    check(!JSON.stringify(first).includes("@"), "an email came back on a board");
    /* The board is read through a view that carries the name and not the
       account it belongs to being anything a stranger can act on. */
    check(reads[0].url.includes("game=eq.survival") && reads[0].url.includes("order=value.desc"),
          "the board was not asked for in order, per game: " + reads[0].url);
    console.log("  cached     a board is read once a session, knows your row, " +
                "and carries no email");
  }
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



/* ── 14. the guest choice does not outlive an account ─────────────────────
   Signing out says "not this account", which is not "no account": the guest
   flag goes with the session, so the next start asks the question again. A
   sign-in clears it too (nowSignedIn), which section 2's flag would otherwise
   leave standing under a real account and turn the next sign-out into a
   doorless drop back into the sector. */
async function guestChecks() {
  const GUEST_KEY = "kondrite.account.guest";
  const g = boot({ cloud: FAKE, store: { [GUEST_KEY]: "yes", [SESSION_KEY]: cached() } });
  g.cf.screen("title");
  g.cf.account();
  await g.el("btnAcctOut").click();
  check(!g.cloud.session(), "signing out left a session behind");
  check(g.store[GUEST_KEY] === undefined, "signing out left the guest choice standing");
  g.el("account").hidden = true;
  g.cf.key("Enter");
  check(!g.el("account").hidden, "after signing out, the door did not come back");
  console.log("  guestgone  signing out clears the guest choice, and the door is asked again");
}

refreshChecks().then(witnessChecks).then(guestChecks).then(() => {
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
