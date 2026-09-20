#!/usr/bin/env node
"use strict";

/* KONDRITE — MENU
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

/* A boot that starts from a storage the test wrote, for checking that an old
   save is read the way it is meant to be — a settings key whose shape changed,
   for instance. Clean first, so it is exactly what was asked for and nothing
   another block left behind. */
function bootWithStorage(search, seed) {
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(seed || {})) store[k] = String(seed[k]);
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

// ── 2. both lanes open, and neither of them is the game ──────────────────
/* The lanes are the simulators now — the machines in the corner of a station —
   and **there is one game**. A lane that lists Survey beside three machines is
   the row of peers the front page was rebuilt to end, so the check that used to
   insist Survey was in the solo lane now insists it is in neither.

   The rest of the rule is unchanged and is still the menu's job: a lane that
   lists a mode it cannot deliver is the menu lying. The lobby has no business
   in the solo lane. */
{
  const { cf } = boot("?debug=1");

  cf.lane("solo");
  let m = cf.menu();
  check(m.lane === "solo", "opening the solo lane did not select it");
  check(!m.rows.includes("survey"),
        "the solo lane still lists Survey beside the machines");
  check(!m.rows.includes("online"), "the solo lane offers the online lobby");
  check(m.rows.length >= 3, "the solo lane is down to " + m.rows.length + " machines");
  const soloRows = m.rows.slice();

  cf.lane("multi");
  m = cf.menu();
  check(m.rows.includes("online"), "the multiplayer lane does not offer Online");
  check(!m.rows.includes("survey"),
        "the multiplayer lane offers Survey, which is one pilot only");

  /* And the way in is one floor down. The front page starts the game; the
     machines are behind SIMULATORS, and backing out of the lanes lands on the
     front page rather than on nothing. */
  cf.screen("title");
  cf.draw();
  cf.key("ArrowRight");                       // off the game, onto SIMULATORS
  cf.key("Enter");
  check(cf.peek().state === "sims",
        "SIMULATORS on the front page went to " + cf.peek().state);
  cf.draw();
  cf.key("Enter");
  check(cf.peek().state === "modes", "a lane on the simulators page opened nothing");
  cf.key("Escape");
  check(cf.peek().state === "sims", "backing out of the machines skipped a floor");
  cf.key("Escape");
  check(cf.peek().state === "title", "backing out of the simulators left the title");

  console.log("  lanes      one floor down, under SIMULATORS · solo [" +
              soloRows.join(" ") + "] · multi [" + m.rows.join(" ") +
              "] · the game is in neither");
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

    /* Measured against the screen, whatever width the device made it. The row
       is laid out from `SCREEN_W`, so the margin it has to stay inside is a
       fraction of the screen rather than a number of pixels. */
    const W = cf.live().screenW;
    const first = taps[0], last = taps[taps.length - 1];
    check(first.x >= 34, "the row starts off the left edge at x=" + Math.round(first.x));
    check(last.x + last.w <= W - 34,
          "the row ends at " + Math.round(last.x + last.w) +
          ", past the right margin at " + (W - 34));

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
/* One floor at a time. The cards back out to the simulators page they were
   opened from, and that backs out to the front page — a key that skipped the
   middle floor would put a player who wanted a different lane on the title. */
{
  const { cf } = boot("?debug=1");
  cf.lane("multi");
  cf.key("Escape");
  check(cf.peek().state === "sims", "Escape did not return to the simulators");
  cf.key("Enter");                                    // opens whichever lane has focus
  check(cf.peek().state === "modes", "ENTER on the simulators page opened nothing");
  cf.key("Backspace");
  check(cf.peek().state === "sims", "Backspace did not return to the simulators");
  cf.key("Backspace");
  check(cf.peek().state === "title", "Backspace did not return to the front page");
  console.log("  back       escape and backspace step one floor at a time, " +
              "cards → simulators → the front page");
}

// ── 8. every card actually paints a picture ──────────────────────────────
/* The point of the rebuild. `preview` returns false when it has no scene for a
   key, so a card whose art is a typo is caught here rather than by somebody
   noticing an empty rectangle. */
{
  const { cf, windowStub } = boot("?debug=1");
  const art = windowStub.KondriteMenu;
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
  const art = windowStub.KondriteMenu;
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

// ── the settings page ─────────────────────────────────────────────────────
/* Three categories, and CONTROLS has four tabs under it. Two things about the
   page are easy to break silently and neither is visible to a syntax check.

   One: every room has to be furnished. A rail entry or a tab whose panel draws
   nothing is a dead end, and from out here it looks exactly like a working one.

   Two: the camera is **one answer for every mode** now. It used to be four,
   behind four tabs, and the brief changed — the same settings everywhere
   unless the mode restricts it. What has to keep working is the collapse: an
   old save with the royale camera on comes back with the camera on.

   Everything below asks for controls by the words on them. The old version of
   this suite measured y bands, and its own comment admitted the problem — "a
   window that fails when the thing inside it moves by two pixels is measuring
   the layout, not the behaviour". */
{
  const { cf } = boot("?debug=1");

  // A control, by what it says. `taps` carries the label now.
  const press = (label, why) => {
    cf.draw();
    const t = cf.live().taps.find(t => t.label === label);
    check(!!t, why || ("nothing on the settings page says " + label));
    if (t) t.act();
    cf.draw();
    return !!t;
  };
  const labels = () => cf.live().taps.map(t => t.label).filter(Boolean);

  cf.screen("controls");
  cf.draw();

  /* The rail is the page's table of contents. */
  const cats = cf.settings().cats;
  check(cats.join(",") === "controls,game,account",
        "the settings rail is [" + cats.join(", ") + "]");

  const rooms = [["controls", "mouse"], ["controls", "keys"],
                 ["controls", "pad"], ["controls", "touch"],
                 ["game", null], ["account", null]];
  for (const [cat, tab] of rooms) {
    cf.setCat(cat);
    if (tab) cf.setTab(tab);
    cf.draw();
    const s = cf.settings();
    const where = cat + (tab ? "/" + tab : "");
    /* CONTROLLER is the one room with nothing in it, on purpose — nothing in
       the game reads a gamepad yet and a tab that quietly did nothing would be
       worse than no tab. It has to say so rather than be empty. */
    if (tab === "pad") {
      check(s.items === 4, where + " grew controls before the gamepad exists");
    } else {
      check(s.items > 0, where + " draws a panel with nothing on it");
    }
    // And whatever it drew stays inside the panel it was given.
    for (const t of cf.live().taps) {
      if (t.y + t.h < s.panel.top) continue;        // the title row
      if (t.x < s.panel.x - 1 && t.x + t.w > s.panel.x + 1) {
        check(false, where + ": a control straddles the rail and the panel");
      }
    }
  }

  /* The four tabs are reachable by name, which is the thing a player does. */
  cf.setCat("controls");
  cf.draw();
  for (const name of ["MOUSE", "KEYS", "CONTROLLER", "TOUCHSCREEN"]) {
    press(name, "no CONTROLS tab where " + name + " should be");
  }

  /* ── one camera, not four ───────────────────────────────────────────────── */
  cf.setCat("game");
  cf.draw();
  check(cf.live().cameraOn === false, "the camera started out rotating");
  press("FIXED", "GAME has no camera button");
  check(cf.live().cameraOn === true, "turning the camera on did nothing");
  press("ROTATING", "the camera button did not change what it says");
  check(cf.live().cameraOn === false, "turning the camera off did nothing");
  press("FIXED");

  // It survives the tab, as one answer rather than four.
  const again = bootKeepingStorage("?debug=1");
  again.cf.screen("controls");
  again.cf.draw();
  check(again.cf.live().cameraOn === true,
        "a reload came back with the camera off");

  /* And an old three-answer save collapses rather than being thrown away:
     whoever had it on for a duel still has it on. */
  const old = bootWithStorage("?debug=1", {
    "kondrite.camera.v2": JSON.stringify({ royale: true, campaign: false,
                                            survey: false })
  });
  check(old.cf.live().cameraOn === true,
        "a v2 save with the royale camera on came back fixed");

  /* ── the mode-restricted settings are on the page anyway ──────────────────
     The zoom is Survey's and friendly fire is Survival's, but both are set
     from anywhere — hiding a setting until you are already in the mode it
     belongs to is how you end up with four pages again. */
  cf.setCat("game");
  cf.draw();
  const game = labels();
  check(game.includes("STANDARD"), "the zoom is not on the page");
  check(game.some(l => l === "ON" || l === "OFF"),
        "friendly fire and sound are not on the page");

  /* ── one page, not two ──────────────────────────────────────────────────
     Sound, fullscreen and the way out used to be written twice — once on the
     keyboard's settings page and again on the phone's — and the two drifted.
     There is one of each now, and the phone screen is only for dragging. */
  check(labels().includes("EXIT GAME"), "no way back to the site from settings");
  check(labels().includes("BACK"), "no way off the settings page");

  cf.setCat("controls"); cf.setTab("touch");
  cf.draw();
  check(labels().includes("MOVE THEM"), "no door from TOUCHSCREEN to the drag screen");
  cf.screen("thumb");
  cf.draw();
  const pad = labels();
  check(pad.includes("DONE"), "the drag screen has no way back");
  check(!pad.some(l => l === "EXIT GAME" || l.startsWith("SOUND")),
        "the drag screen is carrying a second copy of the settings page again");

  /* ── the keyboard can reach all of it ───────────────────────────────────
     It used to reach the key grid and nothing else: sound, fullscreen, the
     zoom and the camera were mouse-only, on the one page whose whole subject
     is not needing a mouse. */
  cf.screen("controls");
  press("GAME");
  check(cf.settings().focus.where === "rail",
        "the settings page opens with the keyboard nowhere");
  cf.key("ArrowRight");
  cf.draw();
  check(cf.settings().focus.where === "panel",
        "right off the rail did not reach the panel");
  const before = cf.settings().focus.i;
  cf.key("ArrowDown");
  cf.draw();
  check(cf.settings().focus.i !== before, "down inside the panel went nowhere");
  cf.key("ArrowLeft");
  cf.draw();
  check(cf.settings().focus.where === "rail",
        "left off the panel's edge did not come back to the rail");
  /* And onto the category you are actually in. The two lists are different
     lists, so an index carried across lands wherever it happens to land. */
  check(cf.settings().rail[cf.settings().focus.i] === "GAME",
        "coming out of the GAME panel landed on " +
        cf.settings().rail[cf.settings().focus.i]);

  console.log("  settings   CONTROLS [mouse keys controller touchscreen] · GAME · " +
              "ACCOUNT · every room furnished · the camera is one answer and " +
              "an old four-answer save collapses into it · walkable from the keyboard");
}

// ── the screen is the shape of the device ────────────────────────────────
/* Kondrite was laid out in a fixed 1000x700 box. A phone held sideways is
   about 19.5:9, and the difference used to come out as a third of the screen in
   black bars down either side — which on a phone reads as the game not working
   rather than as a design decision.

   The height is fixed and the width follows the glass now. What can rot silently
   is the layout: a control laid out against a literal `700` sits two thirds of
   the way across a 1000-wide screen and a little under half of a 1519-wide one,
   so it drifts out of its row without anything erroring. Every tappable thing on
   every menu is therefore checked against the screen it was drawn on. */
{
  const { cf } = boot("?debug=1");

  const shapes = [
    { name: "a squarish laptop", w: 1000, h: 800, wide: false },
    { name: "a widescreen monitor", w: 1920, h: 1080, wide: true },
    { name: "a phone held sideways", w: 844, h: 390, wide: true },
    { name: "a very wide phone", w: 2400, h: 1080, wide: true }
  ];
  const screens = ["title", "modes", "controls", "thumb", "paused"];

  for (const sh of shapes) {
    STAGE.w = sh.w; STAGE.h = sh.h;
    const W = cf.resize();
    check(W >= 1000, sh.name + " gave a screen only " + W + " wide");
    check(W <= 1680, sh.name + " gave a screen " + W + " wide; 1680 is the cap");
    if (sh.wide) {
      check(W > 1000,
            sh.name + " (" + sh.w + "x" + sh.h + ") still got a 1000-wide screen");
    } else {
      check(W === 1000,
            sh.name + " widened to " + W + " when it did not need to");
    }
    // The picture must never be wider than the shape it is being fitted into.
    check(Math.abs(W / 700 - Math.min(1680 / 700, Math.max(1000 / 700, sh.w / sh.h))) < 0.02,
          sh.name + ": the screen is " + (W / 700).toFixed(2) +
          ":1 in a " + (sh.w / sh.h).toFixed(2) + ":1 window");

    for (const st of screens) {
      cf.screen(st);
      for (let i = 0; i < 3; i++) cf.draw();
      const taps = cf.live().taps;
      check(taps.length > 0, sh.name + "/" + st + " drew nothing you can press");
      for (const t of taps) {
        check(t.x >= 0 && t.x + t.w <= W,
              sh.name + "/" + st + ": a control runs from " + Math.round(t.x) +
              " to " + Math.round(t.x + t.w) + " on a screen " + W + " wide");
        check(t.y >= 0 && t.y + t.h <= 700,
              sh.name + "/" + st + ": a control runs off the top or bottom");
      }
      /* And nothing is huddled on the left. On a wide screen a row that was
         written against literals stays put while everything relative moves, so
         the giveaway is a right-hand margin much larger than the left.

         Not on the pause overlay: half its controls are disabled in a harness
         with no fullscreen API, a disabled control registers no tap at all, and
         the gap it leaves is not a layout fault. */
      if (taps.length > 2 && st !== "paused") {
        const left = Math.min(...taps.map(t => t.x));
        const right = W - Math.max(...taps.map(t => t.x + t.w));
        check(right < left + 120,
              sh.name + "/" + st + ": " + Math.round(left) + " clear on the left " +
              "and " + Math.round(right) + " on the right — the row is not centred");
      }
    }
  }

  /* The key grid is the one thing on any menu with its own coordinate system.
     It is centred in the settings panel rather than on the screen now — the
     rail is to the left of it — and the panel is what it must stay inside, at
     both ends of the width range. A grid written against `SCREEN_W / 2` looks
     right at 1000 and is halfway under the rail at 1680. */
  let wide = 0;
  for (const w of [1000, 2400]) {
    STAGE.w = w; STAGE.h = w === 1000 ? 800 : 1080;
    wide = cf.resize();
    cf.screen("controls");
    cf.setCat("controls");
    cf.setTab("keys");
    cf.draw();
    const g = cf.keyGrid();
    const panel = cf.settings().panel;
    /* The block is the label column and the four columns of cells together,
       so the margin on the left is measured from the labels — which is why the
       cells' own left edge is `labelW` further in than the right-hand gap. */
    const gl = g.x0 - g.cellW / 2 - panel.x - g.labelW;
    const gr = panel.x + panel.w - (g.x0 + (g.cols - 1) * g.colW + g.cellW / 2);
    check(gl > 0, "the key grid starts off the left of its panel at " + wide + " wide");
    check(gr > 0, "the key grid runs off the right of its panel at " + wide + " wide");
    check(Math.abs(gl - gr) < 6,
          "the key grid sits " + Math.round(gl) + " from the panel's left and " +
          Math.round(gr) + " from its right on a " + wide + "-wide screen");
  }

  STAGE.w = 1200; STAGE.h = 800;
  cf.resize();
  console.log("  screen     1000 wide on a squarish window, " + wide +
              " on a wide one, capped at 1680 \u00b7 every control on every " +
              "menu stays on it and stays centred \u00b7 the key grid too");
}

if (problems.length) {
  console.error("\nKONDRITE menu checks FAILED");
  for (const p of problems.slice(0, 40)) console.error("  · " + p);
  if (problems.length > 40) console.error("  … and " + (problems.length - 40) + " more");
  process.exit(1);
}
console.log("KONDRITE menu checks passed");
