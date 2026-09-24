#!/usr/bin/env node
"use strict";

/* KONDRITE — THE LIVING WORLD
   ─────────────────────────────────────────────────────────────────────────────
   LIVING-WORLD.md §27 says: run this world without the player, speed it up,
   watch what happens. This is that, as assertions. A sector is booted
   headless and the political turn is run hundreds of times on a seeded
   generator, and then the record is asked the questions the brief asks:

     · does anything happen, and is it the five things and nothing else;
     · does it stay sane — every number in range, and no faction that does
       not exist in the record;
     · does it have inertia (§25) — no war straight after a peace, no raid on
       the same neighbour every three turns;
     · does the news frame the same fact three ways without changing it (§20),
       and never make anything up (§21);
     · does the player's own action land in the same record (§16);
     · does it survive the book;
     · and do the pages draw it — the board, the history, the strip.

   Run it:  node test/living.js                                               */

const assert = require("node:assert/strict");
const vm = require("node:vm");
const page = require("./page.js");

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const noop = () => {};

const drawn = [];
function stubCtx() {
  return new Proxy({}, {
    get: (t, k) => {
      if (k === "measureText") return str => ({ width: String(str).length * 8 });
      if (k === "fillText" || k === "strokeText") return str => { drawn.push(String(str)); };
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
    id, style: { setProperty: noop, getPropertyValue: () => "", removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, appendChild: noop, removeChild: noop,
    setAttribute: noop, removeAttribute: noop, focus: noop, blur: noop, click: noop,
    replaceChildren: noop, insertBefore: noop, remove: noop, scrollIntoView: noop,
    cloneNode: () => make(id + "-copy"), select: noop, getContext: stubCtx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    requestPointerLock: noop, setPointerCapture: noop, releasePointerCapture: noop,
    querySelector: () => make(id + "-q"), querySelectorAll: () => [],
    hidden: true, value: "", textContent: "", placeholder: "",
    width: 1000, height: 700, clientWidth: 1200, clientHeight: 800,
    dataset: {}, children: [], parentNode: null
  });
  const get = id => { if (!byId.has(id)) byId.set(id, make(id)); return byId.get(id); };
  return { get, doc: {
    getElementById: get, querySelector: () => get("?"), querySelectorAll: () => [],
    createElement: () => make("new"), addEventListener: noop, removeEventListener: noop,
    body: get("body"), documentElement: get("html"), hidden: false, visibilityState: "visible",
    exitPointerLock: noop, exitFullscreen: noop, fullscreenElement: null } };
}
function boot(search, store) {
  store = store || {};
  const D = makeDoc();
  let now = 0;
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
    location: { search, href: "http://localhost/" + search, hash: "", origin: "http://localhost", pathname: "/" },
    history: { replaceState: noop },
    devicePixelRatio: 1, innerWidth: 1200, innerHeight: 800,
    AudioContext: function () {
      const audioNode = () => new Proxy(function () {}, {
        get: (t, k) => (k in t ? t[k] : (t[k] = audioNode())), apply: () => audioNode() });
      return { createOscillator: audioNode, createGain: audioNode, createBufferSource: audioNode,
               createBuffer: audioNode, createBiquadFilter: audioNode, createStereoPanner: audioNode,
               createDynamicsCompressor: audioNode, destination: {}, state: "running",
               resume: noop, close: noop, get currentTime() { return now / 1000; } };
    },
    performance: { now: () => now },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    URLSearchParams, fetch: async () => { throw new TypeError("Failed to fetch"); }
  };
  windowStub.window = windowStub;
  windowStub.webkitAudioContext = windowStub.AudioContext;
  const sandbox = Object.assign(Object.create(null), windowStub, {
    document: D.doc, navigator: { userAgent: "node", maxTouchPoints: 0 },
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, Symbol,
    Float32Array, Uint8Array, Map, Set, Promise, RegExp, Error, TypeError,
    isNaN, isFinite, parseInt, parseFloat, Infinity, NaN, undefined
  });
  sandbox.globalThis = sandbox; sandbox.self = sandbox; sandbox.KondriteNet = undefined;
  vm.createContext(sandbox);
  page.boot(sandbox);
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.living, "?debug=1 must expose the living-world hooks");
  return { cf, store, sandbox,
           step: (n = 1) => { for (let i = 0; i < n; i++) { now += 1000 / 60; cf.step(); } },
           drawn: () => { const out = drawn.slice(); drawn.length = 0; return out; } };
}

const KINDS = ["trade", "claim", "raid", "war", "peace", "taken", "battle", "kill", "relief", "rescue", "loss", "arrived"];
const ACTS = ["trade", "claim", "raid", "invade", "peace"];
const POWERS = ["cordon", "hallow", "morrow"];
const inRange = v => typeof v === "number" && v >= 0 && v <= 1;

// ── 1. run it without a player, fast ───────────────────────────────────────
{
  const g = boot("?debug=1&seed=424242");
  g.cf.start("survey", 1);
  const acts = {};
  const warLog = [];
  let last = null;
  for (let i = 0; i < 400; i++) {
    for (const a of g.cf.living.turn(1, 424242 + i)[0]) {
      const [who, act, target] = a.split(":");
      check(ACTS.indexOf(act) >= 0, "a power took an action that is not one of the five: " + act);
      check(POWERS.indexOf(who) >= 0, "something that is not a power acted: " + who);
      acts[act] = (acts[act] || 0) + 1;
    }
    const w = g.cf.war().belligerents.slice().sort().join("-") || "";
    if (w !== last) { warLog.push({ turn: i, w }); last = w; }
  }
  const events = g.cf.living.events();
  check(events.length > 20, "four hundred turns produced only " + events.length + " events");
  check(events.every(e => KINDS.indexOf(e.kind) >= 0), "an event of an unknown kind is in the record");
  check(events.every(e => inRange(e.importance)), "an event's importance is out of range");
  check(events.every(e => !e.actor || e.actor === "you" || e.actor === "free" || e.actor === "pirate" || POWERS.indexOf(e.actor) >= 0),
        "an event names an actor that does not exist");
  check(events.length <= 240, "the record grew past its cap: " + events.length);
  const P = g.cf.living.powers();
  for (const k of POWERS) {
    for (const f of ["ice", "iron", "alloy", "stability", "aggression", "expansion", "trade"]) {
      check(inRange(P[k][f]), k + "'s " + f + " is out of range: " + P[k][f]);
    }
    for (const o of Object.keys(P[k].rel)) check(P[k].rel[o] >= -1 && P[k].rel[o] <= 1, k + " feels " + P[k].rel[o] + " about " + o);
  }
  check(Object.keys(acts).length >= 3, "only " + Object.keys(acts).join(",") + " ever happened — the world is not deciding anything");
  check((acts.raid || 0) + (acts.invade || 0) + (acts.trade || 0) > 0, "no power ever dealt with another");
  check(warLog.length >= 3, "the war never changed in four hundred turns");

  /* Inertia. A pair that made peace does not go back to war inside the
     cooldown, and nobody is raided by the same power inside the raid one. */
  const peaces = events.filter(e => e.kind === "peace");
  const wars = events.filter(e => e.kind === "war");
  for (const pc of peaces) {
    const pair = [pc.actor, pc.target].sort().join("-");
    const again = wars.find(w => w.turn > pc.turn && w.turn - pc.turn < 60 &&
                                 [w.actor, w.target].sort().join("-") === pair);
    check(!again, "the same two went back to war " + (again ? again.turn - pc.turn : "?") + " turns after making peace");
  }
  const raids = events.filter(e => e.kind === "raid");
  for (let i = 0; i < raids.length; i++) {
    for (let j = i + 1; j < raids.length; j++) {
      const a = raids[i], b = raids[j];
      if (a.actor === b.actor && a.target === b.target && b.turn - a.turn < 14 && b.turn !== a.turn) {
        check(false, a.actor + " raided " + a.target + " again after " + (b.turn - a.turn) + " turns"); break;
      }
    }
  }
  check(wars.every(w => events.some(e => e.kind === "war" && e.thread === w.thread)) &&
        wars.every(w => /^war:/.test(w.thread)), "a war is not on a war thread");
  console.log("  fastforward 400 turns · " + Object.keys(acts).map(k => k + " " + acts[k]).join(" · ") +
              " · " + events.length + " events kept · the war changed " + (warLog.length - 1) + " times");
}

// ── 2. the news frames, and never invents ──────────────────────────────────
{
  const g = boot("?debug=1&seed=424242");
  g.cf.start("survey", 1);
  for (let i = 0; i < 200; i++) g.cf.living.turn(1, 7 + i);
  const events = g.cf.living.events();
  const war = events.find(e => e.kind === "war");
  check(!!war, "(no war to frame on this seed)");
  if (war) {
    const A = war.actor, T = war.target, N = POWERS.find(k => k !== A && k !== T);
    const line = flag => (g.cf.living.news(flag, 12).find(n => n.id === war.id) || { text: "" }).text;
    const a = line(A), t = line(T), n = line(N), f = line("free");
    check(/^WE ARE AT WAR/.test(a), "the attacker's own news does not say 'we': " + a);
    check(/HAS ATTACKED US/.test(t), "the attacked's news does not say it was attacked: " + t);
    check(n === f && /ARE AT WAR/.test(n) && n.indexOf(A.toUpperCase()) >= 0 && n.indexOf(T.toUpperCase()) >= 0,
          "the neutral line does not name both powers plainly: " + n);
    check(a !== t && t !== n, "three tellers told it the same way");
  }
  const before = events.length;
  for (const flag of ["cordon", "hallow", "morrow", "free", "pirate", ""]) g.cf.living.news(flag, 8);
  check(g.cf.living.events().length === before, "reading the news changed the record");
  const feed = g.cf.living.news("free", 5);
  check(feed.length > 0 && feed.every(n => n.text && n.colour), "the feed came back empty or unlit");
  check(feed.every(n => events.some(e => e.id === n.id)), "a headline has no event behind it");
  console.log("  news       one war, three framings, the same two names · reading it writes nothing");
}

// ── 3. the player is in the same world ─────────────────────────────────────
{
  const g = boot("?debug=1&seed=8888");
  g.cf.start("survey", 1);
  const surv = g.cf.survey();
  const me = g.cf.live().ships[0];
  // Dock at home, make the station short of iron, and sell iron into it.
  const st = surv.stations[0];
  check(!!st, "(no station loaded)");
  if (st) {
    surv.docked = st;
    const raw = g.cf.living.raw();
    // A shortage, deliberately, through the market itself; then a sale into
    // it, through the same function the shop's button calls.
    surv.market[st.id || ("s" + Math.round(st.x) + "," + Math.round(st.y))] = { base: "iron", want: { iron: 0.8 }, seen: 0 };
    surv.hold.iron = 40;
    const n0 = raw.events.length;
    g.sandbox.sellSome("iron", 20);
    const ev = raw.events.slice(n0).find(e => e.kind === "relief");
    check(!!ev && ev.actor === "you" && ev.what === "iron", "a delivery into a shortage was not recorded as a relief by you");
    check([...surv.known.values()].some(q => q.k === "relief"), "the relief did not go on the chart");
    // A kill.
    const n1 = raw.events.length;
    g.sandbox.repForKill({ role: "escort", kind: "escort", faction: "hallow", x: me.x, y: me.y });
    const kill = raw.events.slice(n1).find(e => e.kind === "kill");
    check(!!kill && kill.actor === "you" && kill.target === "hallow", "a kill was not recorded against you");
    // A rescue.
    const n2 = raw.events.length;
    g.sandbox.rememberFriend({ name: "THE TEST", faction: "morrow", hull: "drayman", x: me.x, y: me.y }, "saved");
    check(raw.events.slice(n2).some(e => e.kind === "rescue" && e.actor === "you"), "a rescue was not recorded");
    // And they show up framed as yours in the station's news.
    const news = g.cf.living.news(st.faction, 12);
    check(news.some(n => n.kind === "relief" || n.kind === "rescue" || n.kind === "kill"), "nothing you did reached the news");
  }
  console.log("  player     a delivery into a shortage, a kill and a rescue are all in the record, as yours");
}

// ── 4. it survives the book ────────────────────────────────────────────────
{
  const g = boot("?debug=1&seed=12345");
  g.cf.start("survey", 1);
  for (let i = 0; i < 120; i++) g.cf.living.turn(1, 99 + i);
  const raw = g.cf.living.raw();
  const events = raw.events.length, turn = raw.turn;
  const P = JSON.parse(JSON.stringify(raw.powers));
  g.sandbox.saveSurveyBook();
  // A fresh boot on the same storage: the same sector, the same history.
  const g2 = boot("?debug=1&seed=12345", g.store);
  g2.cf.start("survey", 1);
  const raw2 = g2.cf.living.raw();
  check(raw2.turn === turn, "the turn count did not survive the book: " + raw2.turn + " vs " + turn);
  check(raw2.events.length === events, "the record did not survive the book: " + raw2.events.length + " vs " + events);
  for (const k of POWERS) {
    check(Math.abs(raw2.powers[k].ice - P[k].ice) < 1e-9 && Math.abs(raw2.powers[k].stability - P[k].stability) < 1e-9,
          k + "'s numbers changed through the book");
    check(Math.abs(raw2.powers[k].aggression - P[k].aggression) < 1e-9, k + "'s temper changed through the book");
  }
  // The validator refuses what does not belong.
  const book = g2.cf.book.parse(g.store[g2.cf.book.keys.store]);
  book.living.events.push({ kind: "coup", actor: "cordon" });
  book.living.events.push({ kind: "war", actor: "atlantis", target: "hallow" });
  book.living.powers.cordon.ice = 42;
  const ok = g2.cf.book.validate(book);
  check(!ok.living.events.some(e => e.kind === "coup"), "an unknown kind of event got through the validator");
  check(!ok.living.events.some(e => e.actor === "atlantis"), "a power that does not exist got through the validator");
  check(ok.living.powers.cordon.ice === 1, "an out-of-range number was not clamped: " + ok.living.powers.cordon.ice);
  console.log("  book       120 turns round-trip exactly · an unknown kind, an unknown power and a wild number are refused");
}

// ── 5. the pages show it, and mostly without words ─────────────────────────
{
  const g = boot("?debug=1&seed=424242");
  g.cf.start("survey", 1);
  for (let i = 0; i < 150; i++) g.cf.living.turn(1, 3 + i);
  const st = g.cf.living.state();
  check(st.powers.length === 3 && st.powers.every(p => inRange(p.strength) && inRange(p.holdings) && p.goods.length === 3),
        "the state for the board is not three powers with bars");
  check(st.history.length > 0 && st.history.every(h => h.line && h.glyph && h.colour), "the history for the page is empty or unlit");
  check(st.here && typeof st.here.control === "number", "the state does not say where you are");
  // The record page.
  g.cf.screen("record");
  g.drawn();
  g.cf.draw();
  const words = g.drawn();
  const text = words.join(" | ");
  check(/THE SECTOR/.test(text), "the record page has no sector board");
  check(/HISTORY/.test(text), "the record page has no history");
  check(/TURN \d+/.test(text), "the history does not say which turn it is");
  check(st.history.every(h => text.indexOf(h.line) >= 0 || words.some(w => h.line.startsWith(w.replace(/…$/, "")))),
        "a history line did not reach the page");
  /* Visuals over words: the board is bars and a triangle, and the only
     words on it are three names and three tiny captions. Counted rather
     than eyeballed. */
  const boardWords = words.filter(w => /^(CORDON|HALLOW|MORROW|FIGHT|SKY HELD|ICE · IRON · ALLOY)$/.test(w));
  check(boardWords.length <= 8, "the sector board is drowning in words: " + boardWords.length);
  // In flight, the strip draws with the living state and says nothing.
  g.cf.screen("playing");
  g.drawn();
  g.cf.draw();
  const flight = g.drawn().join(" | ");
  check(!/THE SECTOR|HISTORY|CORDON AND|RAIDED/.test(flight), "the flight HUD is printing the living world in words");
  console.log("  pages      the board is bars and a triangle · the history is one line each · the strip in flight says nothing");
}

if (problems.length) {
  console.log("KONDRITE living-world checks FAILED");
  for (const p of problems) console.log("  · " + p);
  process.exit(1);
}
console.log("KONDRITE living-world checks passed");
