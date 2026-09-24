"use strict";

/* KONDRITE — CONTROLS
   ─────────────────────────────────────────────────────────────────────────────
   Thumb controls, the four slots as keys, key names, the settings-page state
   and how the ship is flown.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── thumb controls ───────────────────────────────────────────────────────
   A phone gets either a stick or direct left/right buttons, and where they
   sit is the player's business, not this file's. Every piece has a position
   kept as a fraction of the screen. The stick layout has two extra choices:

     GAS BUTTON     off, the stick is the throttle — push it and you go.
                    On, the stick only aims and a separate button burns.
     ALWAYS SHOOT   on, the gun runs by itself and the fire button goes
                    away, which is the only way to fly one-thumbed.

   The arrow layout is deliberately simpler: LEFT, RIGHT and ACCELERATE,
   with the gun always firing. Both layouts hold ordinary input flags, so a
   phone obeys the same turn and thrust rates as a keyboard. */
const PAD_STORE = "kondrite.pad.v1";

// Right-handed, two-handed, landscape: stick under the left thumb, gun under
// the right, gas above the gun where the right thumb can rock up to it.
const PAD_DEFAULTS = {
  scheme: "stick",
  gas: false,
  auto: false,
  size: 1,
  pos: {
    stick: { x: 0.16, y: 0.74 },
    left:  { x: 0.12, y: 0.78 },
    right: { x: 0.31, y: 0.78 },
    accel: { x: 0.86, y: 0.78 },
    gas:   { x: 0.71, y: 0.58 },
    fire:  { x: 0.88, y: 0.78 },
    // Above the fire button and inboard of it: a thumb that is already there
    // can reach it, and nothing else wants that spot.
    rev:   { x: 0.70, y: 0.80 },
    /* The four device buttons, in a block above the gun. Four of them is the
       most a ship can ever have and most ships have one, so they are stacked
       in slot order from the one nearest the thumb — and every one of them can
       be dragged somewhere else, like the rest of the pad. */
    dev0:  { x: 0.80, y: 0.62 },
    dev1:  { x: 0.93, y: 0.62 },
    dev2:  { x: 0.80, y: 0.46 },
    dev3:  { x: 0.93, y: 0.46 },
    pause: { x: 0.95, y: 0.08 }
  }
};

const PAD_SIZES = [
  { s: 0.82, name: "SMALL" }, { s: 1, name: "MEDIUM" },
  { s: 1.2, name: "LARGE" },  { s: 1.45, name: "HUGE" }
];

const padCfg = JSON.parse(JSON.stringify(PAD_DEFAULTS));

// What the stick is doing right now: an angle on the screen and how far out
// it is pushed, which is all the ship ever needs to know.
const stick = { on: false, ang: 0, mag: 0, pid: null };

const padEl    = document.getElementById("pad");
const stickEl  = document.getElementById("padStick");
const knobEl   = stickEl.querySelector(".knob");
const leftEl   = document.getElementById("padLeft");
const rightEl  = document.getElementById("padRight");
const gasEl    = document.getElementById("padGas");
const accelEl  = document.getElementById("padAccel");
const revEl    = document.getElementById("padRev");
const fireEl   = document.getElementById("padFire");
const pauseEl  = document.getElementById("padPause");
const devEls   = [0, 1, 2, 3].map(i => document.getElementById("padDev" + i));

const PAD_PARTS = [["stick", stickEl], ["left", leftEl], ["right", rightEl],
                   ["accel", accelEl], ["gas", gasEl], ["rev", revEl],
                   ["fire", fireEl],
                   ...devEls.map((el, i) => ["dev" + i, el]),
                   ["pause", pauseEl]];

let arranging = false;      // true only on the thumb-controls screen
let padDrag = null;

const fraction = v => typeof v === "number" && isFinite(v) && v >= 0 && v <= 1;

function padLoad() {
  let raw = null;
  try { raw = localStorage.getItem(PAD_STORE); } catch (_) { return; }
  if (!raw) return;
  let saved;
  try { saved = JSON.parse(raw); } catch (_) { return; }
  if (!saved || typeof saved !== "object") return;
  if (saved.scheme === "stick" || saved.scheme === "arrows") {
    padCfg.scheme = saved.scheme;
  }
  padCfg.gas = !!saved.gas;
  padCfg.auto = !!saved.auto;
  if (PAD_SIZES.some(z => z.s === saved.size)) padCfg.size = saved.size;
  // A position that isn't two numbers between 0 and 1 is a control nobody
  // could reach, so that piece stays where it started.
  const p = saved.pos;
  if (p && typeof p === "object") {
    for (const [key] of PAD_PARTS) {
      const q = p[key];
      if (q && fraction(q.x) && fraction(q.y)) padCfg.pos[key] = { x: q.x, y: q.y };
    }
  }
}

function padSave() {
  try { localStorage.setItem(PAD_STORE, JSON.stringify(padCfg)); } catch (_) {}
}

// Nothing is allowed to sit half off the screen, however it got there —
// dragged to the edge, or a phone turned from landscape to portrait.
function padClamp(el, x, y) {
  const w = el.offsetWidth, h = el.offsetHeight, r = padEl.getBoundingClientRect();
  // The pad itself is the thing these fractions are fractions OF, so it is
  // the pad that is measured — not the window, which counts a scrollbar the
  // pad doesn't have. A box with no size yet has no edges to be inside, and
  // dividing by one would put every control at infinity and lose the layout.
  if (!w || !h || !r.width || !r.height) return { x, y };
  const mx = (w / 2 + 4) / r.width, my = (h / 2 + 4) / r.height;
  return { x: Math.min(Math.max(x, mx), Math.max(mx, 1 - mx)),
           y: Math.min(Math.max(y, my), Math.max(my, 1 - my)) };
}

/* Whether there is a reverse button at all. Reverse thrusters are a part, not
   something the ship comes with, so this is the one control on the pad that
   comes and goes — and it is deliberately gated on the fit having *finished*,
   because a button that does nothing for the next forty-five seconds is worse
   than no button. */
const revAvailable = () =>
  !!(mode && mode.survey && typeof modFitted === "function" &&
     modFitted("reverser"));

/* What is in each of the four slots, as the pad sees it: a button per fitted
   device, named after what is in the slot, dark while it is cooling.

   Called every frame from `padStage` rather than only when something changes,
   because three of the four things it draws *do* change every frame — the
   cooldown sweeps, a part finishes fitting, a part is pulled off at a station
   — and a button that lies about being ready is worse than no button. It is
   four elements and an early exit; it is not worth a change-detection scheme.

   On the laying-out screen every one of them shows, whatever the ship has
   fitted: you cannot drag a button that is not there, and where the device
   buttons live is a decision you make before the trip, not during it. */
function padDevices() {
  const laying = arranging;
  const fitted = (mode && mode.survey && surv) ? devicesFitted() : [];
  devEls.forEach((el, i) => {
    const d = fitted.find(f => f.slot === i);
    const show = laying || !!d;
    if (el.hidden === show) el.hidden = !show;
    const tag = el.querySelector(".dt");
    if (tag) tag.textContent = d ? d.dev.tag : "SLOT " + (i + 1);
    const cd = d ? Math.max(0, Math.min(1, d.cd / d.dev.cool)) : 0;
    el.style.setProperty("--cd", cd.toFixed(3));
    el.classList.toggle("cooling", cd > 0);
  });
}

function padApply() {
  padEl.style.setProperty("--u", padCfg.size);
  const arrows = padCfg.scheme === "arrows";
  // Arrow mode is exactly three flight buttons and always fires. Stick mode
  // keeps its optional separate gas and automatic gun.
  stickEl.hidden = arrows;
  leftEl.hidden = rightEl.hidden = !arrows;
  accelEl.hidden = !arrows;
  gasEl.hidden = arrows || !padCfg.gas;
  fireEl.hidden = arrows || padCfg.auto;
  // In both schemes: backing off a rock is as useful with arrows as with a
  // stick, and the part paid for it either way.
  revEl.hidden = !revAvailable();
  /* A button that goes away under a thumb has to let go of it. Pulling the
     part mid-press would otherwise leave the ship reversing on a control that
     is no longer on the screen. */
  if (revEl.hidden) { touch.rev = false; revEl.classList.remove("down"); }
  for (const [key, el] of PAD_PARTS) {
    if (!el.hidden) padCfg.pos[key] = padClamp(el, padCfg.pos[key].x, padCfg.pos[key].y);
    el.style.left = (padCfg.pos[key].x * 100) + "%";
    el.style.top = (padCfg.pos[key].y * 100) + "%";
  }
}

function padReset() {
  const d = JSON.parse(JSON.stringify(PAD_DEFAULTS));
  padCfg.scheme = d.scheme; padCfg.gas = d.gas;
  padCfg.auto = d.auto; padCfg.size = d.size;
  padCfg.pos = d.pos;
  padApply(); padSave();
}

// Left-handed is the mirror of right-handed and nothing else, so it's one
// button rather than a second set of positions to keep.
function padMirror() {
  for (const [key] of PAD_PARTS) padCfg.pos[key].x = 1 - padCfg.pos[key].x;
  padApply(); padSave();
}

function stickRelease() {
  stick.on = false; stick.mag = 0; stick.pid = null;
  knobEl.style.transform = "translate(0px, 0px)";
  stickEl.classList.remove("down");
}

// Capture can be refused — a pointer that has already gone, a synthetic
// event — and a refusal must not take the press down with it.
function grab(el, id) { try { el.setPointerCapture(id); } catch (_) {} }

/* Everything let go of at once. A pointerup that never arrives — the pad
   going away under a thumb, the tab losing focus mid-burn — would otherwise
   leave the ship flying on a control nobody is holding. */
function padRelease() {
  stickRelease();
  touch.l = touch.r = touch.th = touch.f = false;
  leftEl.classList.remove("down");
  rightEl.classList.remove("down");
  accelEl.classList.remove("down");
  gasEl.classList.remove("down");
  fireEl.classList.remove("down");
}

/* [C] means the settings page, whatever you are playing on.

   It used to mean two different pages — a key grid on a keyboard, a separate
   pad screen on a phone — and the phone's copy had grown its own SOUND, its
   own FULLSCREEN, its own EXIT and its own mode band, each written twice and
   each drifting. There is one page now. The pad has a category on it like
   everything else, and `thumb` is what that category opens: the one screen
   that genuinely cannot be a list, because on it you are dragging the real
   controls around at their real size. */
const settingsScreen = () => "controls";

/* Opening the settings from inside a match shows that match's page and only
   that page: you are in Survey, so the camera and zoom you are looking at are
   Survey's, and Battle Royale's are not your problem right now. From the
   front page there is no match to be in, so all four are offered as tabs. */
function openSettings(from) {
  backFrom = from;
  // It opens where it was left, except that a key grid is no use to a thumb.
  if (thumbInput() && controlTab === "keys") controlTab = "touch";
  setFocus.where = "rail";
  setFocus.i = Math.max(0, settingsCats().findIndex(c => c.key === settingsCat));
  return settingsScreen();
}

const ACTIONS = [
  { field: "left",   name: "TURN LEFT",  short: "turn left" },
  { field: "right",  name: "TURN RIGHT", short: "turn right" },
  { field: "thrust", name: "THRUST",     short: "thrust" },
  { field: "fire",   name: "FIRE",       short: "fire" }
];

// Taken before anything can be rebound, so [R] always has somewhere to go.
const DEFAULT_KEYS = PLAYERS.map(p => ACTIONS.map(a => p[a.field].slice()));

/* ── the four slots, as keys ──────────────────────────────────────────────
   Survey's devices are pressed rather than held, and which one you are
   pressing is a *slot* rather than a named action: what is in slot two is
   whatever you bolted there this morning, so the key is named after the slot
   and the interface says what is in it.

   They are their own row on the controls grid rather than four more columns
   on everybody's, because they belong to one mode and to one seat. Nothing
   outside Survey ever reads them.

   Digits by default, in slot order, which is the one arrangement nobody has
   to be told. */
const DEVICE_KEYS = [["Digit1"], ["Digit2"], ["Digit3"], ["Digit4"]];
const DEFAULT_DEVICE_KEYS = DEVICE_KEYS.map(k => k.slice());
const DEV_KEY_STORE = "kondrite.devkeys.v1";

/* The grid is the two seats *and* the device row, and every one of the five
   things that walk it — drawing, hit-testing, binding, clearing, resetting —
   goes through these rather than reaching into `PLAYERS`. That is the whole
   trick to adding a row that is not a player: there is one way to ask a cell
   what keys it holds and one way to tell it. */
const GRID_ROWS = () => KEYBOARD_MAX + 1;
const isDevRow = pi => pi >= KEYBOARD_MAX;
const cellKeys = (pi, ai) =>
  isDevRow(pi) ? DEVICE_KEYS[ai] : PLAYERS[pi][ACTIONS[ai].field];
const setCellKeys = (pi, ai, codes) => {
  if (isDevRow(pi)) DEVICE_KEYS[ai] = codes;
  else PLAYERS[pi][ACTIONS[ai].field] = codes;
};
const cellWho = (pi, ai) =>
  isDevRow(pi) ? "SLOT " + (ai + 1) + " device"
               : PLAYERS[pi].label + " " + ACTIONS[ai].short;
const rowLabel = pi => (isDevRow(pi) ? "SLOTS" : PLAYERS[pi].label);
const rowColour = pi => (isDevRow(pi) ? "#a08cff" : PLAYERS[pi].colour);

/* ── key names ────────────────────────────────────────────────────────────
   `event.code` is a position on the keyboard, not a letter, which is what a
   game wants — WASD stays in the same square on a French layout. It reads
   terribly though, so everything shown to a player goes through here. */
const KEY_LABEL = {
  Space: "SPACE", Enter: "ENTER", NumpadEnter: "NUM ENTER", Escape: "ESC",
  ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
  ShiftLeft: "L SHIFT", ShiftRight: "R SHIFT",
  ControlLeft: "L CTRL", ControlRight: "R CTRL",
  AltLeft: "L ALT", AltRight: "R ALT", MetaLeft: "L CMD", MetaRight: "R CMD",
  Backspace: "BKSP", Tab: "TAB", CapsLock: "CAPS",
  Minus: "−", Equal: "=", BracketLeft: "[", BracketRight: "]",
  Backslash: "\\", Semicolon: ";", Quote: "'", Backquote: "`",
  Comma: ",", Period: ".", Slash: "/", IntlBackslash: "\\",
  NumpadAdd: "NUM +", NumpadSubtract: "NUM −", NumpadMultiply: "NUM ×",
  NumpadDivide: "NUM ÷", NumpadDecimal: "NUM .", NumLock: "NUM LOCK",
  Insert: "INS", Delete: "DEL", Home: "HOME", End: "END",
  PageUp: "PG UP", PageDown: "PG DN"
};

function keyLabel(code) {
  if (KEY_LABEL[code]) return KEY_LABEL[code];
  let m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
  m = /^Digit(\d)$/.exec(code);      if (m) return m[1];
  m = /^Numpad(\d)$/.exec(code);     if (m) return "NUM " + m[1];
  if (/^F\d{1,2}$/.test(code)) return code;
  return String(code).toUpperCase();
}

// An empty action is a real state — you can take a key away and not replace
// it — so it needs something to print.
const keysOf = (p, field) => p[field].length ? p[field].map(keyLabel) : ["—"];
const firstKey = (p, field) => keysOf(p, field)[0];

const hintOf = p =>
  firstKey(p, "left") + " " + firstKey(p, "right") + " turn · " +
  firstKey(p, "thrust") + " thrust · " + firstKey(p, "fire") + " fire";

/* Every code any player is bound to. Rebuilt on every change, and used to
   decide what the browser is not allowed to do with a keypress — bind fire
   to "/" and it must not open the page's find bar. */
const boundKeys = new Set();

const KEY_STORE = "kondrite.keys.v1";
// v3 is one answer. v2 was three (royale/campaign/survey) and v1 was one
// flag worn by the shooters; both are read on the way in and collapsed.
const CAMERA_STORE = "kondrite.camera.v3";
const SOUND_STORE = "kondrite.sound.v1";

/* ── one answer, not one per mode ────────────────────────────────────────
   The camera used to be four separate answers behind four tabs, and how far
   it sat back was Survey's alone. That was built to a brief — *"only the
   survey settings should pop up"* — and the brief has changed: **the same
   settings for every mode, unless the mode restricts it.**

   So there is one rotating-camera answer now. A mode that has no camera to
   turn restricts it, which is `mode.camera` and means Survival, where the
   whole arena is on the screen at once. The zoom stays Survey's, because the
   other three arenas are framed for you and a zoom there would be changing
   the mode rather than the view; the page says so beside the setting rather
   than hiding it.

   The old per-mode answers are collapsed on the way in — see `CAMERA_STORE`
   below — so somebody who had it on for a duel still has it on. */

/* ── where you are on the settings page ──────────────────────────────────
   The page is a rail of categories down the left and one panel to the right
   of it; `settingsCat` is which category the panel is showing. `setFocus`
   is where the keyboard is: on the rail, or on one of the panel's controls.

   Both lists are collected while the page is drawn rather than kept in step
   with it — the same bargain `taps` makes, for the same reason. What you can
   move the keyboard onto is exactly what is on the screen. */
let settingsCat = "controls";
const setFocus = { where: "rail", i: 0 };
let setItems = [], setRail = [];

/* Whether the view turns with the ship. One answer, and it only means
   anything in a mode that has a camera to turn. */
let cameraRotates = false;
const camRotates = () => cameraRotates && !!(mode && mode.camera);
let soundEnabled = true;
let audioCtx = null, audioMaster = null, audioNoise = null;

/* ── how you are flying it ────────────────────────────────────────────────
   Two settings, and they exist because the browser's guess is not always
   right about either.

   **Which kind of machine this is.** `touchOnly` asks the media query whether
   there is a coarse pointer and no hover, which is a good guess and only a
   guess: a touchscreen laptop answers yes and is being used with a keyboard,
   and a tablet with a case-keyboard answers no and is being used with a
   thumb. Neither person can currently tell the game it is wrong. So the guess
   becomes a default that can be overridden, and `AUTO` keeps the behaviour
   everybody has now.

   **Flying with the mouse.** The ship turns toward the pointer and the left
   button fires. It does *not* snap: the nose comes about at the hull's own
   rate, the same rate the keys turn it at, so the mouse says where you want
   to be pointed rather than where you are pointed. A ship that tracked the
   cursor exactly would make the turn stat meaningless and every hull the
   same hull. */
const INPUT_STORE = "kondrite.input.v1";
const MOUSEFLY_STORE = "kondrite.mousefly.v1";
let inputMode = "auto";          // "auto" | "keys" | "touch"
let mouseFly = false;

try {
  /* Three answers became one. Whoever had it on for any mode had it on, so
     that is what they get — turning it off is one press and being silently
     switched back to a fixed view is a thing you have to notice first. */
  const cam3 = localStorage.getItem(CAMERA_STORE);
  if (cam3 === "rotating" || cam3 === "fixed") cameraRotates = cam3 === "rotating";
  else {
    const v2 = JSON.parse(localStorage.getItem("kondrite.camera.v2") || "null");
    if (v2 && typeof v2 === "object") cameraRotates = Object.keys(v2).some(k => v2[k]);
    else cameraRotates = localStorage.getItem("kondrite.camera.v1") === "rotating";
  }
  soundEnabled = localStorage.getItem(SOUND_STORE) !== "off";
  const im = localStorage.getItem(INPUT_STORE);
  if (im === "keys" || im === "touch" || im === "auto") inputMode = im;
  mouseFly = localStorage.getItem(MOUSEFLY_STORE) === "on";
} catch (_) {}

/* The answer the whole interface asks for. `touchOnly` is the guess; this is
   the guess with the player's word on top of it, and everything that used to
   read `touchOnly` for a *layout* decision reads this instead. */
function thumbInput() {
  if (inputMode === "touch") return true;
  if (inputMode === "keys") return false;
  return touchOnly || document.body.classList.contains("touch");
}
function cycleInputMode() {
  inputMode = inputMode === "auto" ? "keys" : inputMode === "keys" ? "touch" : "auto";
  try { localStorage.setItem(INPUT_STORE, inputMode); } catch (_) {}
  applyInputMode();
}
/* Asked as a question about the pad rather than about the machine: what it
   actually decides is whether the on-screen controls turn up. "Which kind of
   machine is this" was the browser's question, not the player's. */
const touchModeName = () =>
  inputMode === "keys" ? "OFF"
  : inputMode === "touch" ? "ALWAYS ON"
  : "AUTOMATIC";
function toggleMouseFly() {
  mouseFly = !mouseFly;
  try { localStorage.setItem(MOUSEFLY_STORE, mouseFly ? "on" : "off"); } catch (_) {}
}

/* The body class is what the stylesheet lays the page out from, so a choice
   has to reach it — otherwise picking TOUCHSCREEN on a laptop changes the
   game's mind and not the page's. */
function applyInputMode() {
  if (inputMode === "touch") document.body.classList.add("touch");
  else if (inputMode === "keys") document.body.classList.remove("touch");
  else if (touchOnly) document.body.classList.add("touch");
}
