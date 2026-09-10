#!/usr/bin/env node
"use strict";

/* CROSSFIRE — MENU
   ─────────────────────────────────────────────────────────────────────────────
   The front page is two questions now — on your own or with other people, then
   which mode — and the second one is a row of cards that open when you point at
   one. None of that is visible to a syntax check: a card whose art key is wrong
   draws an empty box, a lane that lists a mode it cannot start is a dead end,
   and a row whose widths do not add up spills off the screen. All three are
   silent, and all three are arithmetic, so all three are checked here.

   The harness is the one test/survey.js uses, deliberately copied rather than
   shared: these suites are run one at a time and a shared harness is a shared
   thing to break. What is checked is the real path — the same `menuKey` a
   keyboard reaches, the same tap rectangles a thumb hits, the same `openCard`
   the renderer asks.                                                          */

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
const menuSrc = fs.readFileSync(path.join(DIR, "menu.js"), "utf8");

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
    // The online card opens the real lobby, which rebuilds a room list — so the
    // stub needs the DOM the other suites never reach.
    replaceChildren: noop, insertBefore: noop, remove: noop, scrollIntoView: noop,
    cloneNode: () => stubEl(), select: noop,
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
  vm.runInContext(menuSrc, sandbox, { filename: "menu.js" });
  vm.runInContext(inline, sandbox, { filename: "index.inline.js" });
  // `window` inside the sandbox is the stub, not the sandbox object itself, so
  // anything the game hangs off window lands there — the same reason
  // test/campaign.js looks in both places.
  const cf = windowStub.__cf || sandbox.__cf;
  assert.ok(cf && cf.start && cf.survey, "?debug=1 must expose the survey hooks");
  assert.ok(windowStub.CrossfireSurveyHUD, "the HUD module must have registered");
  return { cf, sandbox, windowStub };
}



const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };

// ── 1. the front page is a choice, not a list ─────────────────────────────
{
  const { cf } = boot("?debug=1");
  const m = cf.menu();
  check(m.lanes.length === 2,
        "the front page offers " + m.lanes.length + " lanes, expected 2");
  check(m.lanes[0] === "solo" && m.lanes[1] === "multi",
        "the lanes are not solo then multiplayer: " + m.lanes.join(", "));
  cf.screen("title");
  cf.draw();                                  // it must survive being drawn
  console.log("  front      two lanes · solo, multiplayer · draws clean");
}

// ── 2. both lanes open, and offer only what they can honestly start ───────
/* Survey is one pilot and one chart, so it has no business in the multiplayer
   lane; the lobby has no business in the solo one. A lane that lists a mode it
   cannot deliver is the menu lying, which is worse than the menu being long. */
{
  const { cf } = boot("?debug=1");

  cf.lane("solo");
  let m = cf.menu();
  check(m.lane === "solo", "opening the solo lane did not select it");
  check(m.rows.includes("survey"), "the solo lane does not offer Survey");
  check(!m.rows.includes("online"), "the solo lane offers the online lobby");
  const soloRows = m.rows.slice();

  cf.lane("multi");
  m = cf.menu();
  check(m.rows.includes("online"), "the multiplayer lane does not offer Online");
  check(!m.rows.includes("survey"),
        "the multiplayer lane offers Survey, which is one pilot only");
  console.log("  lanes      solo [" + soloRows.join(" ") + "] · multi [" +
              m.rows.join(" ") + "]");
}

// ── 3. exactly one card is open, and pointing changes which ──────────────
{
  const { cf } = boot("?debug=1");
  cf.lane("solo");
  const rows = cf.menu().rows;

  // Settle the animation, then check the row has one open card and only one.
  for (let i = 0; i < 40; i++) cf.draw();
  let anim = cf.menu().anim;
  const openCount = anim.filter(a => a > 0.5).length;
  check(openCount === 1, openCount + " cards are open at once, expected 1");
  check(anim[0] > 0.5, "the first card is not the one open by default");

  // Point at the last card: it opens, the first closes.
  cf.hover(rows.length - 1);
  for (let i = 0; i < 40; i++) cf.draw();
  anim = cf.menu().anim;
  check(anim[rows.length - 1] > 0.5, "pointing at a card did not open it");
  check(anim[0] < 0.5, "the card the pointer left did not close");
  check(cf.menu().open === rows.length - 1,
        "the open card is not the one being pointed at");

  /* And the keyboard takes it back. Two focus sources fighting over one row is
     the classic bug here: the mouse opens a card, the arrows move somewhere
     else, and the card that opens is neither. */
  cf.key("ArrowLeft");
  check(cf.menu().hover === -1, "the arrows did not release the pointer's hold");
  check(cf.menu().open === rows.length - 2,
        "the arrows moved to " + cf.menu().open + ", expected " + (rows.length - 2));
  console.log("  cards      one open at a time · pointer opens · arrows take it back");
}

// ── 4. the row always fills its span, whatever is open ───────────────────
/* The widths are weights rather than fixed sizes, so the row is only correct if
   it adds up. A row that does not fill the span leaves a gap; one that fills
   more spills off a 1000-wide canvas, and neither shows up as an error. */
{
  const { cf } = boot("?debug=1");
  cf.lane("multi");
  const rows = cf.menu().rows;

  for (let card = 0; card < rows.length; card++) {
    cf.hover(card);
    for (let i = 0; i < 40; i++) cf.draw();
    const taps = cf.live().taps.filter(t => t.card != null);
    check(taps.length === rows.length,
          "the row drew " + taps.length + " cards, expected " + rows.length);
    if (taps.length !== rows.length) continue;

    const first = taps[0], last = taps[taps.length - 1];
    check(first.x >= 39, "the row starts off the left edge at x=" + first.x);
    check(last.x + last.w <= 961,
          "the row ends at " + Math.round(last.x + last.w) + ", past the right margin");

    // No overlaps, and no gaps beyond the gutter.
    for (let i = 1; i < taps.length; i++) {
      const gap = taps[i].x - (taps[i - 1].x + taps[i - 1].w);
      check(gap > 0 && gap < 20,
            "cards " + (i - 1) + " and " + i + " sit " + Math.round(gap) + " apart");
    }
    // The open one is the widest, or opening it means nothing.
    const widest = taps.reduce((a, b) => (b.w > a.w ? b : a));
    check(widest.card === card,
          "card " + card + " is open but card " + widest.card + " is the widest");
  }
  console.log("  layout     row fills its span for every open card · no overlaps");
}

// ── 5. every card starts what it says it starts ──────────────────────────
/* The two lanes end in different places on purpose. Solo knows there is one
   pilot, so it flies straight in; multiplayer has to ask how many are playing,
   so it stops at the count screen. Campaign goes to its mission list from
   either, and the lobby is the lobby. */
{
  const MODE_NAME = { survival: "SURVIVAL", royale: "BATTLE ROYALE",
                      survey: "SURVEY" };

  for (const lane of ["solo", "multi"]) {
    const probe = boot("?debug=1");
    probe.cf.lane(lane);
    const rows = probe.cf.menu().rows;

    rows.forEach((key, i) => {
      const { cf } = boot("?debug=1");
      cf.lane(lane);
      cf.hover(i);
      cf.key("Enter");
      const st = cf.peek();

      if (key === "campaign") {
        check(st.state === "levels",
              lane + "/campaign: ENTER went to " + st.state + ", expected levels");
      } else if (key === "online") {
        // The lobby is DOM rather than canvas; the check that matters is that
        // pressing it did not throw and did not start a match.
        check(st.state !== "playing", "the lobby card dropped straight into a match");
      } else if (lane === "solo") {
        check(st.state === "playing",
              lane + "/" + key + ": ENTER left the game in " + st.state);
        check(st.mode === MODE_NAME[key],
              lane + "/" + key + ": ENTER started " + st.mode);
      } else {
        /* Multiplayer asks first. Landing straight in a match here would mean
           somebody's second player never got a seat. */
        check(st.state === "count",
              lane + "/" + key + ": ENTER went to " + st.state + ", expected count");
      }
      cf.draw();
    });
  }
  console.log("  play       solo flies straight in · multiplayer asks how many first");
}

// ── 6. solo Battle Royale brings its own opponents ───────────────────────
/* A free-for-all with one ship in it is not a match. The solo lane has to fill
   the arena itself, because there is no count screen in that lane to ask. */
{
  const { cf } = boot("?debug=1");
  cf.lane("solo");
  const rows = cf.menu().rows;
  cf.hover(rows.indexOf("royale"));
  cf.key("Enter");
  const st = cf.peek();
  check(st.mode === "BATTLE ROYALE", "solo royale did not start: " + st.mode);
  const bots = st.ships.filter(s => s.bot).length;
  check(bots >= 1, "solo Battle Royale started with " + bots + " opponents");
  check(st.ships.length >= 2, "solo Battle Royale has only " + st.ships.length + " ship");
  console.log("  solo br    " + bots + " bots brought along, " + st.ships.length + " ships in the arena");
}

// ── 7. back out, and the escape hatches work ─────────────────────────────
{
  const { cf } = boot("?debug=1");
  cf.lane("multi");
  cf.key("Escape");
  check(cf.peek().state === "title", "Escape did not return to the front page");
  cf.key("Enter");                                    // opens whichever lane has focus
  check(cf.peek().state === "modes", "ENTER on the front page opened nothing");
  cf.key("Backspace");
  check(cf.peek().state === "title", "Backspace did not return to the front page");
  console.log("  back       escape and backspace both return to the front page");
}

// ── 8. every card actually paints a picture ──────────────────────────────
/* The point of the rebuild. `preview` returns false when it has no scene for a
   key, so a card whose art is a typo is caught here rather than by somebody
   noticing an empty rectangle. */
{
  const { cf, windowStub } = boot("?debug=1");
  const art = windowStub.CrossfireMenu;
  check(!!art, "the menu art module did not register");
  if (art) {
    for (const lane of ["solo", "multi"]) {
      cf.lane(lane);
      for (const key of cf.menu().rows) {
        check(art.has(key) || art.has(key), key + ": no diorama");
      }
    }
    // And a scene that does not exist must fail rather than draw nothing quietly.
    check(art.preview("no-such-mode", 0, 0, 100, 100, 0) === false,
          "an unknown diorama key reported success");
    check(art.preview("survival", 0, 0, 100, 100, 1.5) === true,
          "a known diorama refused to draw");
    // Every scene, at a few clocks, must not throw or go non-finite.
    for (const key of ["survival", "royale", "campaign", "survey", "online"]) {
      for (const t of [0, 0.7, 3.3, 91.4]) {
        check(art.preview(key, 10, 10, 200, 140, t) === true,
              key + ": failed to draw at t=" + t);
      }
    }
  }
  console.log("  dioramas   five scenes · every card has one · unknown keys refused");
}

// ── 9. the Battle Royale wall stays a place, and only ever closes ────────
/* It used to inset the arena by a fraction on all four sides, leaving `1 - 2f`
   with f peaking at 0.46 — eight per cent of the card. That is not a closing
   wall, it is a dot with four ships stacked in it, and no drawing test catches
   it because the scene draws perfectly. The geometry is a pure function now, so
   the floor is arithmetic and can be held here. */
{
  const { windowStub } = boot("?debug=1");
  const art = windowStub.CrossfireMenu;
  check(typeof art.royaleWall === "function", "the royale wall is not measurable");
  if (art && art.royaleWall) {
    let min = Infinity, max = -Infinity;
    for (let t = 0; t < 60; t += 0.02) {
      const { size, fade } = art.royaleWall(t);
      check(Number.isFinite(size) && size > 0, "the wall went non-finite at t=" + t);
      check(fade >= 0 && fade <= 1, "the wall's fade left 0..1 at t=" + t);
      min = Math.min(min, size);
      max = Math.max(max, size);
    }
    /* The smallest card the row ever draws is about 185 x 120 for its art. At
       0.4 that is 74 x 48, which still holds four ships; much under that and
       the scene is a smudge. */
    check(min >= 0.4,
          "the wall closes to " + min.toFixed(3) + " of the card — too small to read");
    check(max <= 0.95, "the wall starts at " + max.toFixed(3) + ", past the card edge");
    check(max - min > 0.2,
          "the wall barely moves (" + min.toFixed(2) + "–" + max.toFixed(2) +
          "), so it does not read as closing");

    /* And it must never reopen. The real wall cannot, so the picture must not
       either — the only place it may grow is the cut back to the start, which
       is hidden by the fade being at zero. */
    let prev = art.royaleWall(0);
    for (let t = 0.02; t < 30; t += 0.02) {
      const now = art.royaleWall(t);
      if (now.size > prev.size + 1e-9) {
        check(prev.fade < 0.05,
              "the wall reopened in view at t=" + t.toFixed(2) +
              " (fade " + prev.fade.toFixed(2) + ")");
      }
      prev = now;
    }
    console.log("  royale     wall closes " + max.toFixed(2) + " → " + min.toFixed(2) +
                " of the card · never reopens in view");
  }
}

// ── the settings page belongs to one mode at a time ───────────────────────
/* How far the camera sits back is a question about Survey and nonsense in a
   Battle Royale; whether the view turns with the ship is answered differently
   for a duel than for a long haul. So the settings page shows one mode's
   options, and — this is the part that is easy to break silently — the camera
   is now four separate answers rather than one flag wearing four hats. */
{
  const { cf } = boot("?debug=1");
  const TABS = ["SURVEY", "BATTLE ROYALE", "CAMPAIGN", "SURVIVAL"];
  const W = 1000;
  const tabX = i => W / 2 - (4 * 234 - 10) / 2 + i * 234 + 112;

  const openTab = (i, y) => {
    cf.draw();
    const t = cf.live().taps.find(t => tabX(i) >= t.x && tabX(i) <= t.x + t.w &&
                                       y >= t.y && y <= t.y + t.h);
    check(!!t, "no settings tab where " + TABS[i] + " should be");
    if (t) t.act();
    cf.draw();
  };
  // What the band is showing, read off the drawn frame rather than assumed.
  const band = (lo, hi) => cf.live().taps
    .filter(t => t.y > lo && t.y < hi).length;

  cf.screen("controls");
  for (let i = 0; i < TABS.length; i++) openTab(i, 112);
  check(true, "the four settings tabs are all reachable");

  /* Each page offers different things, or the tabs are decoration. */
  const opts = [];
  for (let i = 0; i < TABS.length; i++) {
    openTab(i, 112);
    opts.push(band(135, 182));
  }
  check(opts[0] === 3, "the survey page offers " + opts[0] + " settings, not 3");
  check(opts[1] === 1 && opts[2] === 1,
        "the shooter pages offer " + opts[1] + "/" + opts[2] + " settings, not 1 each");
  check(opts[3] === 1, "the survival page offers " + opts[3] + " settings, not 1");

  /* And the camera is genuinely per mode: turning it on for Battle Royale must
     leave Survey alone, which the one shared flag could not do. */
  openTab(1, 112);
  const camBtn = () => {
    cf.draw();
    return cf.live().taps.find(t => t.y > 135 && t.y < 182);
  };
  camBtn().act();
  check(cf.live().cameraModes.royale === true,
        "turning the royale camera on did nothing");
  check(cf.live().cameraModes.survey === false,
        "the royale camera setting leaked into Survey");
  check(!("survival" in cf.live().cameraModes),
        "survival grew a camera setting it has no camera for");

  // It survives the tab, one mode at a time.
  const again = bootKeepingStorage("?debug=1");
  again.cf.screen("controls");
  again.cf.draw();
  check(again.cf.live().cameraModes.royale === true &&
        again.cf.live().cameraModes.survey === false,
        "a reload came back with the wrong modes' cameras");

  console.log("  settings   one page per mode \u00b7 survey 3, royale 1, campaign 1, " +
              "survival 1 \u00b7 the camera is four answers, not one");
}

if (problems.length) {
  console.error("\nCROSSFIRE menu checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("CROSSFIRE menu checks passed");
