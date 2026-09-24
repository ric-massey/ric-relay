"use strict";

/* KONDRITE — INPUT
   ─────────────────────────────────────────────────────────────────────────────
   The glass from the first touch, orientation, the way out of a page, the
   controls screen, driving settings from the keyboard, the raw input layer,
   and the gamepad.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the whole glass, from the first touch ────────────────────────────────
   Fullscreen used to be asked for when a match started, which is the right
   gesture and the wrong moment: the menus are where a phone spends its first
   half-minute, and they spent it inside a browser with a toolbar top and
   bottom. A browser only grants fullscreen inside a user gesture, and the
   first touch anywhere is one, so that is where this goes.

   Once is enough. If it is refused, or the player leaves fullscreen on
   purpose, it is not asked again — a game that keeps grabbing the screen back
   is a game people close. */
let askedFullscreen = false;
addEventListener("pointerdown", () => {
  if (askedFullscreen) return;
  askedFullscreen = true;
  enterPlayFullscreen();
}, { passive: true });

/* ── which way up the phone is ────────────────────────────────────────────
   Kondrite is a 1000x700 picture. In a portrait phone that is a slot across
   the middle of the glass with nothing above or below it, and scaling does not
   fix a shape. So portrait is answered rather than accommodated: one sentence,
   an arrow, and the game waits.

   Only on a touch device, and only while it is actually portrait — a desktop
   window that happens to be tall is somebody deliberately making it tall. */
const rotateEl = document.getElementById("rotate");
function checkOrientation() {
  const touch = document.body.classList.contains("touch") || thumbInput();
  const portrait = window.innerHeight > window.innerWidth;
  const turn = !!(touch && portrait);
  document.body.classList.toggle("turnme", turn);
  if (rotateEl) rotateEl.setAttribute("aria-hidden", turn ? "false" : "true");
  /* Sideways again means the canvas has a different box to fill, and the
     resize that reports it can land before the class comes off. */
  if (!turn) resize();
}
addEventListener("resize", checkOrientation);
addEventListener("orientationchange", () => {
  requestAnimationFrame(() => requestAnimationFrame(checkOrientation));
});
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", checkOrientation);
}

/* ── the way out ──────────────────────────────────────────────────────────
   Back to the site, from the settings, deliberately. This is the address the
   floating "Ric's Terminal" pill used to point at; the pill is gone because a
   fixed button at the bottom-left corner of a phone is a button under a thumb,
   and a game does not want one. Leaving a game is a thing you go and do.

   Armed before it fires, like the survey reset: one stray tap should not end a
   run and close the game. */
const HOME_URL = /^https?:$/.test(location.protocol)
  ? "../../" : "../../index.html";
let exitArm = 0;
const exitArmed = () => performance.now() < exitArm;
const exitLabel = () => exitArmed() ? "SURE? LEAVE GAME" : "EXIT GAME";
function exitToSite() {
  if (!exitArmed()) {
    exitArm = performance.now() + 3200;
    gameSound("hit");
    return;
  }
  exitArm = 0;
  // Whatever the run was, it is written down already — the survey book saves
  // on every event that changes it, so leaving costs nothing but the flight.
  try { if (surv) saveSurveyBook(); } catch (_) {}
  location.href = HOME_URL;
}

function toggleCamera(on) {
  cameraRotates = on === undefined ? !cameraRotates : !!on;
  try { localStorage.setItem(CAMERA_STORE, cameraRotates ? "rotating" : "fixed"); }
  catch (_) {}
  // Switching back to the original view should be immediate, including
  // while the match is paused on this screen.
  if (!cameraRotates) cam.rot = 0;
}

// What has to be true whenever the table changes, or is first read in.
function refreshKeys() {
  boundKeys.clear();
  // Only the rows a keyboard can reach: a key sitting in an unreachable row
  // must not go on taking keypresses away from the browser.
  for (const p of keyRows()) {
    for (const a of ACTIONS) for (const c of p[a.field]) boundKeys.add(c);
  }
  // The device keys too, or a slot rebound to "/" opens the browser's find
  // bar every time you drop a decoy.
  for (const row of DEVICE_KEYS) for (const c of row) boundKeys.add(c);
}

function keysChanged() {
  refreshKeys();
  // Private browsing, a full disk, a locked-down profile: none of those are
  // worth losing the rebind you just made over.
  try {
    localStorage.setItem(KEY_STORE,
      JSON.stringify(PLAYERS.map(p => ACTIONS.map(a => p[a.field]))));
    /* Kept in their own key rather than appended to that array. An older
       build reads the same store, and a row it does not recognise on the end
       of the players list is a row it would try to read as a player. */
    localStorage.setItem(DEV_KEY_STORE, JSON.stringify(DEVICE_KEYS));
  } catch (_) {}
}

function loadKeys() {
  let raw = null;
  try { raw = localStorage.getItem(KEY_STORE); } catch (_) { return; }
  if (!raw) return;
  let saved;
  try { saved = JSON.parse(raw); } catch (_) { return; }
  if (!Array.isArray(saved)) return;
  // Anything unrecognisable in storage leaves that row on its defaults,
  // rather than handing the game a control that can never be pressed.
  PLAYERS.forEach((p, i) => {
    const row = saved[i];
    if (!Array.isArray(row)) return;
    ACTIONS.forEach((a, k) => {
      const codes = row[k];
      if (!Array.isArray(codes)) return;
      p[a.field] = codes
        .filter(c => typeof c === "string" && /^[A-Za-z0-9]{1,24}$/.test(c))
        .slice(0, 4);
    });
  });
  let devRaw = null;
  try { devRaw = localStorage.getItem(DEV_KEY_STORE); } catch (_) { return; }
  if (!devRaw) return;
  let dev;
  try { dev = JSON.parse(devRaw); } catch (_) { return; }
  if (!Array.isArray(dev)) return;
  DEVICE_KEYS.forEach((_, i) => {
    const codes = dev[i];
    if (!Array.isArray(codes)) return;
    DEVICE_KEYS[i] = codes
      .filter(c => typeof c === "string" && /^[A-Za-z0-9]{1,24}$/.test(c))
      .slice(0, 4);
  });
}

function resetKeys() {
  PLAYERS.forEach((p, i) => {
    ACTIONS.forEach((a, k) => { p[a.field] = DEFAULT_KEYS[i][k].slice(); });
  });
  DEFAULT_DEVICE_KEYS.forEach((codes, i) => { DEVICE_KEYS[i] = codes.slice(); });
  keysChanged();
}

/* A key can only mean one thing. Taking one that belonged to somebody else
   takes it off them and says so — quietly leaving two ships on one button
   would be a bug you'd only find mid-match. */
function bindTo(pi, ai, code) {
  const taken = [];
  /* Every row, the device row included. A key that meant "thrust" and now
     means "slot two" has to stop meaning thrust, or the first decoy you drop
     also burns the engine. */
  for (let j = 0; j < GRID_ROWS(); j++) {
    for (let k = 0; k < ACTIONS.length; k++) {
      if (j === pi && k === ai) continue;
      const codes = cellKeys(j, k);
      if (!codes.includes(code)) continue;
      setCellKeys(j, k, codes.filter(c => c !== code));
      taken.push(cellWho(j, k));
    }
  }
  setCellKeys(pi, ai, [code]);
  keysChanged();
  return taken;
}

/* The game already means something by these three wherever you are, so they
   can't also be somebody's thrust. */
const RESERVED = { Escape: "ESC", KeyP: "P", Tab: "TAB" };

/* ── the controls screen ──────────────────────────────────────────────────
   A key is chosen by pressing it, not by picking its name out of a list:
   what you press is what you get, and a key nobody can reach is a key you
   can't accidentally choose.

   The grid is five rows of four cells laid out in SCREEN units, and both the
   pointer and the drawing read the same boxes out of `cellBox`, so what you
   click is exactly what you can see. */
/* The key grid, centred rather than pinned. `x0` was 372 when the screen was
   always a thousand wide; it is four columns of 150 centred in whatever the
   screen is now, which keeps the player labels down its left side in the same
   place relative to it. */
/* `y0` is set by `drawControls` each frame rather than fixed at 270. The
   settings band above the grid can be one row or two depending on the mode
   and how its notes wrap, and a grid pinned to a constant is a grid that gets
   drawn through — which is exactly what happened the moment FLYING was added
   above it. The click handler reads the same value, so what you press is
   where it was last drawn. */
/* `x0`, `colW` and `cellW` moved here from a formula for the same reason
   `y0` did. The grid used to be centred on the screen and sized in constants,
   which was right while it had the whole width to itself; it lives inside the
   settings panel now, so how wide a column can be is a question about how
   wide that panel is. `drawControls` sets all four before anything reads
   them, and the pointer reads the same values — so what you press is where it
   was last drawn. */
const GRID = { x0: 425, colW: 150, cellW: 128, cellH: 42, y0: 270, rowH: 60,
               labelW: 160 };
const gridX0 = () => GRID.x0;

/* The device row sits a little below the seats, because it is not one of
   them: the gap is the only thing saying the rule changes there. */
const DEV_GAP = 12;
function cellBox(pi, ai) {
  const cx = gridX0() + ai * GRID.colW;
  const cy = GRID.y0 + pi * GRID.rowH + (isDevRow(pi) ? DEV_GAP : 0);
  return { cx, cy, x: cx - GRID.cellW / 2, y: cy - GRID.cellH / 2,
           w: GRID.cellW, h: GRID.cellH };
}

/* Only when the grid is actually the thing on the screen. It is one category
   of the settings page now rather than the whole of it, and boxes left over
   from the last time it was drawn would otherwise take a press meant for
   whatever is in that space today. */
function cellAt(sx, sy) {
  if (state !== "controls" || settingsCat !== "controls" ||
      controlTab !== "keys") return null;
  for (let pi = 0; pi < GRID_ROWS(); pi++) {
    for (let ai = 0; ai < ACTIONS.length; ai++) {
      const b = cellBox(pi, ai);
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
        return { p: pi, a: ai };
      }
    }
  }
  return null;
}

const binder = { p: 0, a: 0, listening: false, hover: null,
                 note: "", bad: false, noteUntil: 0 };

function note(msg, bad) {
  binder.note = msg;
  binder.bad = !!bad;
  binder.noteUntil = performance.now() + 4000;
}

// A code is a physical position, and not everything that reaches a keydown
// has one — some on-screen keyboards and input methods send nothing at all.
// Binding that would leave a cell holding a key nobody can ever press.
const bindable = code => /^[A-Za-z0-9]{1,24}$/.test(code || "");

function takeKey(code) {
  if (!bindable(code)) {
    note("the browser didn't say which key that was — try another", true);
    return;
  }
  if (RESERVED[code]) {
    note(RESERVED[code] + " belongs to the game — pick another key", true);
    return;
  }
  const taken = bindTo(binder.p, binder.a, code);
  binder.listening = false;
  const who = cellWho(binder.p, binder.a);
  note(taken.length
    ? keyLabel(code) + " is now " + who + ", taken off " + taken.join(" and ")
    : who + " is now " + keyLabel(code));
}

/* ── driving the settings page from the keyboard ──────────────────────────
   The old page could be driven from the keyboard only as far as the key grid
   — arrows walked the cells and nothing else on the page was reachable at
   all. SOUND, FULLSCREEN, the zoom, the camera: all of them mouse-only, on a
   page whose whole subject is not needing a mouse.

   The rail fixes that by giving the page a shape a keyboard can walk. Up and
   down move along whichever of the two lists you are in, right or ENTER goes
   from the rail into the panel, left at the panel's left edge comes back out.
   Every control registers itself with a row and a column as it is drawn, so
   the key grid's four-across and a settings row's one-across are the same
   kind of move. */
function setMove(dr, dc) {
  if (!setItems.length) return;
  const cur = setItems[setFocus.i] || setItems[0];
  const land = it => {
    setFocus.where = "panel";
    setFocus.i = setItems.indexOf(it);
    // The grid draws its highlight off the binder, so the binder follows.
    if (it.cell) { binder.p = it.cell.p; binder.a = it.cell.a; }
  };
  if (dc) {
    const row = setItems.filter(t => t.row === cur.row);
    const k = row.indexOf(cur) + dc;
    // Off the left of the panel is the rail. Off the right is nothing.
    if (k < 0) { setLeaveToRail(); return; }
    if (k < row.length) land(row[k]);
    return;
  }
  const rows = [...new Set(setItems.map(t => t.row))].sort((a, b) => a - b);
  const ri = rows.indexOf(cur.row) + dr;
  if (ri < 0 || ri >= rows.length) return;
  const row = setItems.filter(t => t.row === rows[ri]);
  land(row[Math.min(cur.col, row.length - 1)]);
}

/* Stepping between the two lists lands somewhere meant, in both directions.
   They are different lists, so an index carried across is nonsense: going in
   would land THE GAME on whatever is third in a panel of something else, and
   coming out of the seventh control on a panel used to land on BACK. So
   going in is always the first control, and coming out is always the
   category you are in. */
function setLeaveToRail() {
  setFocus.where = "rail";
  const i = setRail.findIndex(r => r.cat === settingsCat);
  if (i >= 0) setFocus.i = i;
}

function setEnterPanel() {
  if (!setItems.length) return;
  setFocus.where = "panel";
  setFocus.i = 0;
  const it = setItems[0];
  if (it && it.cell) { binder.p = it.cell.p; binder.a = it.cell.a; }
}

function controlsKey(code) {
  if (binder.listening) {
    if (code === "Escape") { binder.listening = false; note("left as it was"); }
    else takeKey(code);
    return;
  }
  if (code === "Escape" || code === "KeyC") { state = backFrom || "title"; return; }

  const up = code === "ArrowUp" || code === "KeyW";
  const down = code === "ArrowDown" || code === "KeyS";
  const left = code === "ArrowLeft" || code === "KeyA";
  const right = code === "ArrowRight" || code === "KeyD";
  const go = code === "Enter" || code === "NumpadEnter" || code === "Space";

  if (setFocus.where === "rail") {
    const rail = setRail.length || 1;
    if (up)   { setFocus.i = (setFocus.i + rail - 1) % rail; return; }
    if (down) { setFocus.i = (setFocus.i + 1) % rail; return; }
    if (right) { setEnterPanel(); return; }
    if (go) {
      const it = setRail[setFocus.i];
      // A category is walked into; EXIT and BACK are done where they stand.
      if (it && it.cat) { it.act(); setEnterPanel(); }
      else if (it) it.act();
      return;
    }
    return;
  }

  if (up || down)    { setMove(up ? -1 : 1, 0); return; }
  if (left || right) { setMove(0, left ? -1 : 1); return; }
  if (go) {
    const it = setItems[setFocus.i];
    if (it && typeof it.act === "function") it.act();
    return;
  }
  if (code === "Backspace" || code === "Delete") {
    // Emptying an action is allowed: two people at one keyboard may want
    // fewer keys in play, not more. Only where there is a key to empty.
    if (settingsCat !== "controls" || controlTab !== "keys") return;
    setCellKeys(binder.p, binder.a, []);
    keysChanged();
    note(cellWho(binder.p, binder.a) + " has no key now");
  }
}

/* ── input ───────────────────────────────────────────────────────────── */
const keys = new Set();
// The menus need these whatever anyone has bound; `boundKeys` covers the
// rest, so a fire key rebound to "/" doesn't open the browser's find bar.
const SWALLOW = new Set([
  "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Slash",
  "Tab", "Escape", "KeyP" // keep camera switching and menus inside the game
]);

/* A panel with a field in it owns the keyboard, and so does a focused field
   anywhere. The online lobby was given the first half of that rule when it was
   written; the account door was not, and the difference was a bug nobody could
   see from the outside. `SWALLOW` and `boundKeys` together cover Space, A, D,
   W, P, Slash, Tab, Enter and the digits 1–4 — so the `preventDefault` below
   was taking those characters straight out of the email and password fields
   as they were typed. A password with a space in it could not be entered at
   all, and neither could most email addresses. It read as "the password only
   accepts certain characters", which is precisely what it was.

   Asked of the focused element rather than of a list of panel ids, so the next
   panel with an input in it is born working instead of inheriting this. */
const typingInField = () => {
  const a = document.activeElement;
  if (!a) return false;
  if (a.isContentEditable) return true;
  const t = a.tagName;
  return t === "INPUT" || t === "TEXTAREA" || t === "SELECT";
};

addEventListener("keydown", e => {
  audioUnlock();
  // While a panel that takes typing is up the keyboard belongs to it — you're
  // entering a name, an email or a password, and a stray space shouldn't fire
  // a gun or vanish out of the box you typed it into.
  const lob = document.getElementById("lobby");
  if (lob && !lob.hidden) return;
  const acct = document.getElementById("account");
  if (acct && !acct.hidden) return;
  if (typingInField()) return;
  // While a key is being listened for, the whole keyboard is ours: the point
  // is to catch the key itself, not what the browser would rather do with it.
  if (binder.listening || SWALLOW.has(e.code) || boundKeys.has(e.code)) {
    e.preventDefault();
  }
  /* The held set is written *before* the auto-repeat is dropped, and that
     ordering is the whole of a bug.

     `keys` is emptied wholesale in four places — losing focus, standing down,
     pausing, and starting a match — and a key you are still physically holding
     sends nothing but `repeat` events after that. Those used to return before
     `keys.add`, so the key was never put back: you were left holding something
     the game could not see, and the only cure was to let go and press it again.
     Which is exactly what it looked like from the cockpit — thrust or the
     trigger dead until you released it and pressed it once more.

     A repeat still does not reach `menuKey`, because that is one action per
     press and always was. It only re-asserts what your hand is doing. */
  keys.add(e.code);
  if (e.repeat) return;
  menuKey(e.code);
});
addEventListener("keyup", e => keys.delete(e.code));

// Alt-tab away mid-thrust and the keyup never arrives, so the key stays
// "held" and you come back to a ship burning into a wall. Drop everything
// held whenever the page stops being the thing in front of you.
//
// Pausing, though, is only right for a game nobody else is in. The host runs
// the one simulation everybody is playing inside, and a guest that stops
// sending input leaves the host flying its ship on whatever it last heard —
// so online, looking away means letting go of the controls, not stopping the
// world. `bgTicker` keeps the match stepping once the browser stops handing
// out animation frames.
function standDown() {
  keys.clear();
  touch.l = touch.r = touch.th = touch.f = false;
  padRelease();
  gpadRelease();
  if (!inMatch()) return;
  if (net.on) { if (document.hidden) bgTicker.start(); }
  else if (state === "playing") { state = "paused"; localPause = true; }
}
addEventListener("blur", standDown);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) standDown(); else bgTicker.stop();
});

const held = k => Array.isArray(k) ? k.some(c => keys.has(c)) : keys.has(k);

/* ── the gamepad ─────────────────────────────────────────────────────────
   `gpad`, because `pad` is already the on-screen thumb pad. Polled, not
   evented: the Gamepad API hands out a snapshot and nothing else, so
   `readGamepad` runs once a frame ahead of the input read and turns the
   snapshot into the same two kinds of thing a keyboard produces — something
   *held* (turn, thrust, fire, reverse), which is OR-ed into the local ship's
   input beside touch and the mouse, and something *pressed* (a menu move, a
   choice, a slot), which goes through `menuKey` with the key code a keyboard
   would have sent, so a pad presses the same buttons a keyboard does and
   there is no second copy of any menu.

   The mapping is the W3C standard layout and is fixed — there is no binding
   screen for it, because every pad that reports "standard" agrees on where A
   and the sticks are, and a pad that does not is a pad this cannot read
   anyway. The CONTROLLER tab says what is plugged in and what does what.

   Nothing shows in `getGamepads()` until a button has been pressed on it —
   that is the browser's rule, not ours — so the tab says so. (C6.) */
const gpad = { on: false, id: "", l: false, r: false, th: false, f: false,
               rev: false, held: [], last: "" };
const GPAD_DEAD = 0.28;       // a stick at rest is not exactly at zero
const GPAD_MENU = 0.6;        // a stick has to be pushed to count as a press
/* Standard mapping: 0 A · 1 B · 2 X · 3 Y · 4 LB · 5 RB · 6 LT · 7 RT ·
   8 BACK · 9 START · 12 UP · 13 DOWN · 14 LEFT · 15 RIGHT. */
const GPAD_SLOTS = [2, 3, 4, 5];         // X, Y, LB, RB: the four Survey slots
const GPAD_NAMES = { 0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT",
                     8: "BACK", 9: "START", 12: "UP", 13: "DOWN", 14: "LEFT", 15: "RIGHT" };
let gpadWas = new Set();     // what was down last frame, for edges

function gpadDevice() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  let list;
  try { list = navigator.getGamepads() || []; } catch (_) { return null; }
  for (const g of list) if (g && g.connected !== false && g.buttons) return g;
  return null;
}

/* A pad's id is "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e
   Product: 0b13)" — the first half is the name and the rest is for a driver. */
const gpadName = id => String(id || "").replace(/\s*\(.*$/, "").trim() || "a controller";

function gpadRelease() {
  gpad.l = gpad.r = gpad.th = gpad.f = gpad.rev = false;
  gpad.held = [];
  gpadWas = new Set();
}

/* A press the way a keyboard would have made it. Not while a panel that takes
   typing is up — the same rule the keydown handler has — and not a menu move
   while the ship is being flown, where A is the trigger and not "choose". */
function gpadPress(code) {
  gpad.last = code;
  const lob = document.getElementById("lobby");
  if (lob && !lob.hidden) return;
  const acct = document.getElementById("account");
  if (acct && !acct.hidden) return;
  menuKey(code);
}

function readGamepad() {
  const gp = gpadDevice();
  if (!gp) {
    if (gpad.on) gpadRelease();
    gpad.on = false; gpad.id = "";
    return;
  }
  gpad.on = true; gpad.id = gp.id || "";
  const btn = i => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
  const ax = i => { const v = gp.axes[i]; return typeof v === "number" && isFinite(v) ? v : 0; };
  const x = ax(0), y = ax(1);

  // Held: the stick, the D-pad and the triggers, as the flying inputs.
  gpad.l = x < -GPAD_DEAD || btn(14);
  gpad.r = x > GPAD_DEAD || btn(15);
  gpad.th = y < -GPAD_DEAD || btn(12) || btn(7);
  gpad.rev = y > GPAD_DEAD || btn(13) || btn(6);
  gpad.f = btn(0);

  // Pressed: edges, this frame against last.
  const down = new Set();
  for (let i = 0; i < 16; i++) if (btn(i)) down.add(i);
  if (x < -GPAD_MENU) down.add("sl"); if (x > GPAD_MENU) down.add("sr");
  if (y < -GPAD_MENU) down.add("su"); if (y > GPAD_MENU) down.add("sd");
  const edge = k => down.has(k) && !gpadWas.has(k);
  const flying = state === "playing";
  if (edge(9)) gpadPress("Escape");                      // START pauses, or resumes
  if (!flying) {
    if (edge(0)) gpadPress("Enter");
    if (edge(1)) gpadPress("Escape");
    if (edge(12) || edge("su")) gpadPress("ArrowUp");
    if (edge(13) || edge("sd")) gpadPress("ArrowDown");
    if (edge(14) || edge("sl")) gpadPress("ArrowLeft");
    if (edge(15) || edge("sr")) gpadPress("ArrowRight");
  } else {
    GPAD_SLOTS.forEach((b, i) => {
      if (edge(b) && DEVICE_KEYS[i] && DEVICE_KEYS[i].length) gpadPress(DEVICE_KEYS[i][0]);
    });
  }
  if (down.size && !gpadWas.size) audioUnlock();
  gpad.held = [...down].filter(k => typeof k === "number").map(k => GPAD_NAMES[k] || String(k));
  gpadWas = down;
}
// `?debug=1`: the harness hooks, and the one place a swallowed error speaks up.
const debugOn = new URLSearchParams(location.search).get("debug") === "1";
const digit = code => {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? +m[1] : 0;
};
