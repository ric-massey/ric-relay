"use strict";

/* KONDRITE — SETTINGS
   ─────────────────────────────────────────────────────────────────────────────
   The controls page: keys, the touchscreen, the game, what it sounds like,
   you, the rail and moving the pad.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── CONTROLS ─────────────────────────────────────────────────────────────
   One category, four tabs: the thing in your hands. Which tab you are on
   changes nothing about the game — it is four sets of settings, not four
   modes — so a person at a desk with a phone in their pocket can set both up
   without going anywhere.

   `TAB_TOP` is where a tab's own content starts. It is below the tab strip
   rather than below the heading, which is the whole reason the key grid has
   room: it is measured from here and not from a constant. */
const TAB_TOP = 112;

function drawTabs(sh, list, now, pick) {
  const gap = 10;
  const tw = Math.min(240, (sh.pw - gap * (list.length - 1)) / list.length);
  const x0 = sh.px + sh.pw / 2 - (list.length * (tw + gap) - gap) / 2;
  list.forEach((t, i) => {
    panelButton(t.name, x0 + i * (tw + gap) + tw / 2, sh.top + 58, tw, 34,
                t.colour, () => pick(t.key), 0, i, t.key === now);
  });
}

function drawControlsPanel(sh) {
  const tab = CONTROL_TABS.find(t => t.key === controlTab) || CONTROL_TABS[1];
  panelHead(sh, "CONTROLS", null, tab.colour);
  drawTabs(sh, CONTROL_TABS, controlTab, k => { controlTab = k; });
  ({ mouse: drawMouseTab, keys: drawKeysTab,
     pad: drawControllerTab, touch: drawTouchTab }[tab.key])(sh);
}

function drawMouseTab(sh) {
  setRow(sh, 0, {
    label: "MOUSE FLYING", value: mouseFly ? "ON" : "OFF",
    colour: mouseFly ? "#6dffbf" : "#ffcb42", on: mouseFly,
    // What it does not do is worth one line; that it is on is not.
    note: mouseFly ? "It does not snap." : null,
    act: toggleMouseFly }, TAB_TOP);
}

/* What is plugged in, and what it does. The mapping is fixed (see `gpad`), so
   this is a page to read rather than a page to edit: the pad's own name at the
   top, the layout under it, and what is being pressed right now — which is
   how you find out the pad is being read at all. */
const GPAD_MAP = [
  ["LEFT STICK · D-PAD", "turn · push up to thrust · pull back to reverse"],
  ["RT",                 "thrust"],
  ["LT",                 "reverse"],
  ["A",                  "fire · choose, in a menu"],
  ["X · Y · LB · RB",    "the four survey slots"],
  ["START",              "pause"],
  ["B",                  "back, in a menu"],
];
function drawControllerTab(sh) {
  const mid = sh.px + sh.pw / 2;
  const y0 = sh.top + TAB_TOP;
  if (!gpad.on) {
    text("NOTHING PLUGGED IN", mid, y0 + 40, 24, "#a08cff", "center", 0.9);
    text("Plug a controller in and press any button on it.",
         mid, y0 + 76, 16, "#ffcb42", "center", 0.7);
    text("The browser will not show a pad until it has been touched.",
         mid, y0 + 100, 14, "#ffcb42", "center", 0.55);
  } else {
    text(gpadName(gpad.id).toUpperCase(), mid, y0 + 40, 22, "#a08cff", "center", 0.95);
    text(gpad.held.length ? "pressing " + gpad.held.join(" · ") : "ready",
         mid, y0 + 68, 14, "#6dffbf", "center", 0.8);
  }
  const top = y0 + 130, step = 30;
  text("STANDARD LAYOUT", sh.px, top - 8, 13, "#ffcb42", "left", 0.55);
  GPAD_MAP.forEach(([what, does], i) => {
    text(what, sh.px, top + 20 + i * step, 15, "#ffe56d", "left");
    text(does, sh.px + 210, top + 20 + i * step, 14, "#ffcb42", "left", 0.75);
  });
}

/* ── the keys ─────────────────────────────────────────────────────────────
   Every box on it is a control you can change, and it is the same grid
   `cellBox` hands the pointer.

   The grid is sized and placed here rather than by a formula, because how
   wide a column can be is now a question about how wide the panel is. Four
   columns, a label column beside them, and the whole block centred in what
   is left. */
function drawKeysTab(sh) {
  const labelW = 160;
  // 150 is the width the grid was designed at and the most it ever takes;
  // below that it is whatever four columns and the label column can have of
  // the panel, less a margin either side.
  GRID.labelW = labelW;
  GRID.colW = Math.min(150, Math.floor((sh.pw - labelW + 8) / 4));
  GRID.cellW = GRID.colW - 24;
  const blockW = labelW + 3 * GRID.colW + GRID.cellW;
  GRID.x0 = Math.round(sh.px + (sh.pw - blockW) / 2 + labelW + GRID.cellW / 2);
  GRID.y0 = sh.top + TAB_TOP + 44;

  text("Select a box and press the key you want. ESC cancels.",
       sh.px, sh.top + TAB_TOP - 8, 14, "#ffcb42", "left", 0.55);

  ACTIONS.forEach((a, ai) => {
    text(a.name, cellBox(0, ai).cx, GRID.y0 - 24, 15, "#ffcb42", "center", 0.9);
    // And what the same column means down on the device row.
    text("SLOT " + (ai + 1), cellBox(KEYBOARD_MAX, ai).cx,
         cellBox(KEYBOARD_MAX, 0).y - 10, 13, "#a08cff", "center", 0.75);
  });

  const now = performance.now();

  for (let pi = 0; pi < GRID_ROWS(); pi++) {
    const home = cellBox(pi, 0);
    const colour = rowColour(pi);
    text(rowLabel(pi), home.x - 18, home.cy + 6, 17, colour, "right");
    /* The device row is a different kind of row and says so once, under its
       own label: the columns above it are TURN LEFT and FIRE, and these four
       are slots whose meaning is whatever you bolted into them. */
    if (isDevRow(pi)) {
      text("survey devices", home.x - 18, home.cy + 24, 12, colour,
           "right", 0.7);
    }

    ACTIONS.forEach((a, ai) => {
      const b = cellBox(pi, ai);
      const i = setPush({ x: b.x, y: b.y, w: b.w, h: b.h,
                          cell: { p: pi, a: ai },
                          act: () => { binder.p = pi; binder.a = ai;
                                       binder.listening = true; } },
                        pi + 1, ai);
      const picked = binder.p === pi && binder.a === ai;
      const live = picked && binder.listening;
      const hot = picked ||
        (binder.hover && binder.hover.p === pi && binder.hover.a === ai);

      if (hot) {
        ctx.fillStyle = colour;
        ctx.globalAlpha = live ? 0.24 : 0.12;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.strokeStyle = hot ? colour : "#ffcb42";
      ctx.globalAlpha = live ? 1 : hot ? 0.9 : 0.35;
      ctx.lineWidth = picked ? 2 : 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      if (setFocus.where === "panel" && setFocus.i === i) {
        focusRing(b.x, b.y, b.w, b.h, colour);
      }

      const codes = cellKeys(pi, ai);
      if (live) {
        // Blinking, because at this moment the game is waiting on you and
        // nothing else on the screen is.
        const on = Math.floor(now / 400) % 2 === 0;
        text("PRESS A KEY", b.cx, b.cy + 5, 13, colour, "center", on ? 1 : 0.3);
      } else {
        text(codes.length ? keyLabel(codes[0]) : "—", b.cx, b.cy + 6, 16,
             codes.length ? "#ffe56d" : "#ff8f77");
        // Spares for the same action are a count here and a list below, or
        // four fire keys would need four cells.
        if (codes.length > 1) {
          text("+" + (codes.length - 1), b.x + b.w - 7, b.y + 13, 10,
               "#ffcb42", "right", 0.8);
        }
      }
    });
  }

  // What the page has to say, under the grid it is about.
  const sayY = cellBox(GRID_ROWS() - 1, 0).y + GRID.cellH + 30;
  const sel = cellKeys(binder.p, binder.a);
  const fresh = binder.note && now < binder.noteUntil;
  // A refused key has to say so while it is still listening, or pressing
  // ESC looks like the only thing that ever happens.
  if (binder.listening && fresh && binder.bad) {
    text(binder.note, sh.px + sh.pw / 2, sayY, 15, "#ff8f77");
  } else if (binder.listening) {
    text("Press the new key. Press ESC to cancel.",
         sh.px + sh.pw / 2, sayY, 15, "#ffe56d");
  } else if (fresh) {
    text(binder.note, sh.px + sh.pw / 2, sayY, 15,
         binder.bad ? "#ff8f77" : "#6dffbf");
  } else if (sel.length > 1) {
    text("Also: " + sel.slice(1).map(keyLabel).join(", ") +
         ". A new key replaces them.", sh.px + sh.pw / 2, sayY, 14, "#ffcb42");
  } else {
    text("More than two at once? Play online — one screen each.",
         sh.px + sh.pw / 2, sayY, 14, "#ffcb42", "center", 0.7);
  }

  setActions(sh, GRID_ROWS() + 1, [
    { label: "RESET ALL KEYS", colour: "#ffe56d",
      act: () => { resetKeys(); note("Keys reset."); } },
    { label: "CLEAR SELECTED KEY", colour: "#ffcb42",
      act: () => {
        setCellKeys(binder.p, binder.a, []);
        keysChanged();
        note("Selected key cleared.");
      } }
  ]);
}

/* ── the touchscreen ──────────────────────────────────────────────────────
   Everything about the controls that appear when a thumb touches the screen.
   Where they *sit* is the one thing that cannot be a row in a list, because
   answering it means dragging the real controls around at their real size —
   so that is its own screen, and MOVE THEM is the door to it.

   `TOUCH CONTROLS` used to be a global called INPUT sitting above everything
   else, phrased as "which kind of machine is this". That was the browser's
   question, not the player's. What it actually decides is whether the pad
   turns up, which is a question about the pad — so it is asked here. */
function drawTouchTab(sh) {
  const stick = padCfg.scheme === "stick";
  setRow(sh, 0, {
    label: "TOUCH CONTROLS", value: touchModeName(), colour: "#6dffbf",
    on: inputMode === "touch",
    // Only AUTOMATIC needs a line. ALWAYS ON and OFF say themselves.
    note: inputMode === "auto"
            ? "Only if the browser says so."
            : null,
    act: cycleInputMode }, TAB_TOP);
  setRow(sh, 1, {
    label: "LAYOUT", value: stick ? "STICK" : "ARROWS", colour: "#6dffbf",
    // Neither word is a picture of the thing, so both get a line.
    note: stick ? "Aim with the stick." : "Auto-fire is always on.",
    act: () => {
      padCfg.scheme = stick ? "arrows" : "stick";
      padRelease(); padApply(); padSave();
    } }, TAB_TOP);
  setRow(sh, 2, {
    label: "GAS BUTTON", value: stick ? (padCfg.gas ? "ON" : "OFF") : "—",
    colour: padCfg.gas ? "#6dffbf" : "#ffcb42", on: stick && padCfg.gas,
    enabled: stick,
    // Only when it is off, because then the throttle is somewhere else.
    note: stick && !padCfg.gas ? "Push the stick forward." : null,
    act: () => { padCfg.gas = !padCfg.gas; padApply(); padSave(); } }, TAB_TOP);
  setRow(sh, 3, {
    label: "AUTO-FIRE",
    value: stick ? (padCfg.auto ? "ON" : "OFF") : "ALWAYS ON",
    colour: (!stick || padCfg.auto) ? "#6dffbf" : "#ffcb42",
    on: !stick || padCfg.auto, enabled: stick,
    act: () => { padCfg.auto = !padCfg.auto; padApply(); padSave(); } }, TAB_TOP);
  const z = PAD_SIZES.find(v => v.s === padCfg.size) || PAD_SIZES[1];
  setRow(sh, 4, {
    label: "SIZE", value: z.name, colour: "#6dffbf",
    act: () => {
      const i = PAD_SIZES.indexOf(z);
      padCfg.size = PAD_SIZES[(i + 1) % PAD_SIZES.length].s;
      padApply(); padSave();
    } }, TAB_TOP);

  setActions(sh, 6, [
    { label: "MOVE THEM", colour: "#ffe56d",
      act: () => { binder.listening = false; state = "thumb"; } },
    { label: "SWAP SIDES", colour: "#ffe56d", act: padMirror },
    { label: "RESET THE PAD", colour: "#ffcb42", act: padReset }
  ]);
}

/* ── the game ─────────────────────────────────────────────────────────────
   What the game does — gameplay and video in the usual taxonomy, which at
   this size is four rows rather than two pages. What it sounds like is
   AUDIO, next door.

   Two of them mean something in one mode and nothing in the other three. The
   zoom is Survey's, because the other arenas are framed for you and a zoom
   there would be changing the mode rather than the view; friendly fire is
   Survival's, because everywhere else either everyone is on their own side
   or nobody is. Both are on the page all the same, set from anywhere, with
   the mode they belong to beside the name. */
function drawGamePanel(sh) {
  panelHead(sh, "GAME", null, "#ffe56d");
  setRow(sh, 0, {
    label: "CAMERA", value: cameraRotates ? "ROTATING" : "FIXED",
    colour: "#6dc8ff",
    note: cameraRotates ? "The ship stays pointed up."
                        : "The map stays north-up.",
    act: () => toggleCamera() });
  setRow(sh, 1, {
    label: "ZOOM", tag: "survey only", value: surveyZoomName(),
    colour: "#a08cff", act: cycleSurveyZoom });
  setRow(sh, 2, {
    label: "FRIENDLY FIRE", tag: "survival only",
    value: survivalFriendlyFire ? "ON" : "OFF",
    colour: survivalFriendlyFire ? "#ff8f77" : "#6dffbf",
    on: survivalFriendlyFire, act: toggleFriendlyFire });
  setRow(sh, 3, {
    label: "SCREEN", value: fullscreenLabel(),
    colour: "#ffe56d", on: !!fullscreenElement(),
    enabled: fullscreenSupported(),
    // Only when the button is dead, because then it owes you a reason.
    note: fullscreenSupported() ? null : "Not supported here.",
    act: toggleFullscreen });
}

/* ── what it sounds like ──────────────────────────────────────────────────
   The switch, then a master, then one dial per kind of sound. Each step
   plays a sound off the channel it just changed, so you hear the level you
   picked rather than guessing at a bar. With the sound off the dials still
   move and remember — they just have nothing to play through yet. */
const AUDIO_SAMPLE = { master: "laser", weapons: "laser", impacts: "rock",
                       ship: "pickup", ui: "start" };
function volumeStep(key, dir) {
  const v = audioVol[key];
  let i = 0;
  for (let k = 0; k < VOLUME_STEPS.length; k++) {
    if (Math.abs(VOLUME_STEPS[k] - v) < Math.abs(VOLUME_STEPS[i] - v)) i = k;
  }
  i = Math.max(0, Math.min(VOLUME_STEPS.length - 1, i + dir));
  setVolume(key, VOLUME_STEPS[i]);
  // A room with the volume at zero has nothing to say; it would only be the
  // same silence you just asked for.
  if (soundEnabled && audioVol[key] > 0 && audioVol.master > 0) {
    const kind = AUDIO_SAMPLE[key];
    playSfx(kind, 0, key !== "ui");
  }
}

function volumeRow(sh, i, label, key) {
  const y = setRowY(sh, i);
  const v = audioVol[key];
  const live = soundEnabled;
  const colour = live ? "#6dffbf" : "#ffcb42";
  text(label, sh.px, y + 6, 17, "#ffe56d", "left", live ? 1 : 0.6);
  const bw = 52, gap = 10;
  const right = sh.px + sh.pw;
  const plusX = right - bw / 2, minusX = right - bw - gap - bw / 2;
  const mw = Math.max(70, Math.min(220, sh.pw - 190 - 2 * bw - 3 * gap - 52));
  const mx = right - 2 * bw - 2 * gap - 52 - mw;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = live ? 0.6 : 0.3;
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, y - 7, mw, 14);
  ctx.fillStyle = colour;
  ctx.globalAlpha = live ? 0.85 : 0.35;
  ctx.fillRect(mx + 2, y - 5, (mw - 4) * v, 10);
  ctx.restore();
  text(v === 0 ? "OFF" : Math.round(v * 100) + "%", mx + mw + 44, y + 6, 15,
       colour, "right", live ? 1 : 0.6);
  panelButton("\u2212", minusX, y, bw, 40, colour, () => volumeStep(key, -1),
              i, 0, false, v > 0);
  panelButton("+", plusX, y, bw, 40, colour, () => volumeStep(key, 1),
              i, 1, false, v < 1);
}

function drawAudioPanel(sh) {
  panelHead(sh, "AUDIO", null, "#6dffbf");
  setRow(sh, 0, {
    label: "SOUND", value: soundEnabled ? "ON" : "OFF",
    colour: soundEnabled ? "#6dffbf" : "#ffcb42", on: soundEnabled,
    note: "You hear what is on the screen, and nothing that is not.",
    act: toggleSound });
  volumeRow(sh, 1, "MASTER", "master");
  AUDIO_CHANNELS.forEach((c, k) => volumeRow(sh, 2 + k, c.name, c.key));
}

/* ── you ──────────────────────────────────────────────────────────────────
   Who the game thinks you are and what it is keeping for you. Both answer
   the same question — what does this remember about me — which is why the
   one button that destroys hours of somebody's work sits here rather than
   three rows under a button that resets a keyboard. */
function drawAccountPanel(sh) {
  panelHead(sh, "ACCOUNT", null, "#a08cff");
  let row = 0;
  if (window.KondriteCloud) {
    /* The way in and the way back out, for somebody who chose guest at the
       door and has changed their mind — or who wants off this account. */
    const inAlready = !!(cloud && cloud.enabled() && cloud.session());
    setRow(sh, row++, {
      label: "ACCOUNT", value: inAlready ? "SIGN OUT" : "SIGN IN",
      colour: "#a08cff",
      // Signed out is the state somebody may not know they are in.
      note: inAlready ? null : "A guest — this machine only.",
      act: inAlready ? () => signOutNow(m => note(m)) : () => openAccount() });
  } else {
    text("This build has no accounts. Everything is kept on this machine.",
         sh.px, setRowY(sh, row++) + 6, 16, "#ffcb42", "left", 0.7);
  }
  setRow(sh, row, {
    label: "THE SECTOR", tag: "survey only", value: surveyResetLabel(),
    colour: surveyResetArmed() ? "#ff8f77" : "#a08cff",
    on: surveyResetArmed(), wide: true,
    note: "Wipes it all. Asks twice.",
    act: resetSurveyProgress });
}

const SET_PANELS = { controls: drawControlsPanel, game: drawGamePanel,
                     audio: drawAudioPanel, account: drawAccountPanel };

/* ── the rail ─────────────────────────────────────────────────────────────
   Left-aligned and full width, with a bar down the lit edge of whichever one
   you are in — a tab, not a button. The two at the foot are below a gap and
   a rule because they are not categories: they leave. */
function railRow(it, on, focused) {
  const c = it.colour || "#ffe56d";
  ctx.save();
  ctx.fillStyle = c;
  ctx.globalAlpha = on ? 0.16 : 0.05;
  ctx.fillRect(it.x, it.y, it.w, it.h);
  ctx.globalAlpha = on ? 1 : 0.28;
  ctx.fillRect(it.x, it.y, 3, it.h);
  ctx.restore();
  text(it.label, it.x + 16, it.y + it.h / 2 + 6, 16, c, "left", on ? 1 : 0.72);
  /* Pressing a rail entry is also moving to it: the keyboard's mark and the
     pointer's are the same mark, so a click must not leave the dashed ring
     sitting on whatever was open before. */
  const i = setRail.indexOf(it);
  pushTap({ x: it.x, y: it.y, w: it.w, h: it.h, label: it.label,
            act: () => { setFocus.where = "rail"; setFocus.i = i; it.act(); } });
  if (focused) focusRing(it.x, it.y, it.w, it.h, c);
}

function settingsHover(x, y) {
  const inside = r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (let i = 0; i < setRail.length; i++) {
    if (inside(setRail[i])) { setFocus.where = "rail"; setFocus.i = i; return; }
  }
  for (let i = 0; i < setItems.length; i++) {
    const t = setItems[i];
    if (!inside(t)) continue;
    setFocus.where = "panel";
    setFocus.i = i;
    if (t.cell) { binder.p = t.cell.p; binder.a = t.cell.a; }
    return;
  }
}

function drawControls() {
  const sh = settingsShell();
  setItems = [];
  setRail = [];

  /* A ground under the page. The idling asteroid field drifts behind every
     menu and used to drift straight through this one's type — which on the
     one screen made entirely of small print is the difference between a page
     and a transparency. Dark enough to read against, thin enough that the
     field is still visibly back there. */
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.76)";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.restore();

  text("SETTINGS", sh.x, 56, 34, "#ffe56d", "left");
  // Not every category has a line up here. THIS MODE does not, because the
  // panel under it already says the thing and saying it twice is saying it
  // once badly.
  const blurb = settingsCatNow().blurb;
  if (blurb) text(blurb, sh.x + sh.w, 56, 14, "#ffcb42", "right", 0.55);
  ctx.save();
  ctx.strokeStyle = "#ffcb42";
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sh.x, 72); ctx.lineTo(sh.x + sh.w, 72);
  ctx.stroke();
  // And the rule that separates the two columns, top to bottom.
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.moveTo(sh.px - SET_RAIL_GAP / 2, sh.top);
  ctx.lineTo(sh.px - SET_RAIL_GAP / 2, sh.bot + 30);
  ctx.stroke();
  ctx.restore();

  const cats = settingsCats();
  cats.forEach((c, i) => {
    setRail.push({ x: sh.railX, y: sh.top + i * 48, w: sh.railW, h: 42,
                   label: c.name, cat: c.key,
                   act: () => { settingsCat = c.key; } });
  });
  // The way out of the game, and the way out of this page. Armed before it
  // fires: one stray click should not close a run.
  setRail.push({ x: sh.railX, y: sh.bot - 58, w: sh.railW, h: 42,
                 label: exitLabel(), colour: exitArmed() ? "#ff8f77" : "#ffcb42",
                 act: exitToSite });
  setRail.push({ x: sh.railX, y: sh.bot - 4, w: sh.railW, h: 42,
                 label: "BACK", colour: "#ffcb42",
                 act: () => { binder.listening = false;
                              state = backFrom || "title"; } });

  ctx.save();
  ctx.strokeStyle = "#ffcb42";
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sh.railX, sh.bot - 76);
  ctx.lineTo(sh.railX + sh.railW, sh.bot - 76);
  ctx.stroke();
  ctx.restore();

  setRail.forEach((it, i) => railRow(it, it.cat === settingsCat,
                                     setFocus.where === "rail" &&
                                     setFocus.i === i));

  (SET_PANELS[settingsCat] || drawControlsPanel)(sh);

  /* The rail is drawn before the panel and the panel is what rebuilds
     `setItems`, so the focus can be pointing past the end of a list that has
     just got shorter — switch from KEYS to FLYING and twelve cells become
     two rows. Clamped here, once, rather than guessed at in four places. */
  if (setFocus.where === "panel") {
    if (!setItems.length) setFocus.where = "rail";
    else setFocus.i = Math.min(setFocus.i, setItems.length - 1);
  }
  if (setFocus.where === "rail") {
    setFocus.i = Math.max(0, Math.min(setFocus.i, setRail.length - 1));
  }
}

/* ── moving the pad ───────────────────────────────────────────────────────
   The one settings question that cannot be a row in a list: where the
   controls sit. The pad itself is floating over the top of this screen the
   whole time — the controls you are moving are the real ones, at the real
   size, and you can push the stick and watch the knob follow while you
   decide where it belongs.

   Which is why everything this screen has to say is kept in the top fifth of
   it. Below that is where thumbs live, and where the controls will be
   sitting. The old version put a mode band, a sound button and an EXIT down
   there with them, and the live thumbstick was drawn straight over the top
   of RESET SURVEY. */
function drawThumb() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, SCREEN_W, 150);
  ctx.restore();

  text("MOVE THE CONTROLS", SCREEN_W / 2, 56, 30, "#ffe56d");
  text("Drag any of them. They stay where you put them.",
       SCREEN_W / 2, 84, 16, "#ffcb42");

  tapButton("DONE", COLS(3, 0), 120, 240, 42, "#ffe56d",
            () => { state = "controls"; });
  tapButton("SWAP SIDES", COLS(3, 1), 120, 240, 42, "#ffe56d", padMirror);
  tapButton("RESET THE PAD", COLS(3, 2), 120, 240, 42, "#ffcb42", padReset);
}


function playCampaignLevel(levelKey) {
  // NEXT and RETRY both come through here — a continued war, so the ledger
  // carries. A fresh pick from the mission list goes via startGame instead.
  campContinue = true;
  startGame(levelKey, lastSetup.humans || 1, 0);
}

const CAMPAIGN_WIN_LINE = {
  convoy: "the transport is home — every crate intact",
  raid: "all three transports are wrecks — nothing got away",
  mothership: "the core is gone — the mothership is breaking apart"
};

// A ten-cell strength gauge, drawn in block characters so it needs no shapes.
function fleetBar(v) {
  const n = Math.max(0, Math.min(10, Math.round(v * 10)));
  return "█".repeat(n) + "░".repeat(10 - n);
}

function drawCampaignOver() {
  const win = outcome.kind === "victory";
  const m = MODES[outcome.levelKey];
  text(win ? "MISSION COMPLETE" : "MISSION FAILED", SCREEN_W / 2, 206, 52,
       win ? "#6dffbf" : "#ff8f77");
  text(m.name, SCREEN_W / 2, 248, 20, "#ffe56d");
  text(win ? (CAMPAIGN_WIN_LINE[outcome.levelKey] || "objective complete")
           : (outcome.reason || "the mission was lost"),
       SCREEN_W / 2, 280, 15, "#ffcb42");

  const kills = ships.filter(s => s.team === TEAM_ALLY)
                     .reduce((n, s) => n + s.kills, 0);
  text("ENEMY SHIPS DOWNED   " + kills + "        TIME   " + clockText(clock),
       SCREEN_W / 2, 318, 15, "#ffcb42");

  const idx = CAMPAIGN_ORDER.indexOf(outcome.levelKey);
  const hasNext = win && idx >= 0 && idx < CAMPAIGN_ORDER.length - 1;

  // The debrief: what this win banks for the war. It IS the campaign feel —
  // the fleet you finish with is the fleet you start the next mission with.
  const carry = win ? outcome.carry : null;
  let y = 356;
  if (carry) {
    const last = idx === CAMPAIGN_ORDER.length - 1;
    text(last ? "THE WAR IS WON"
              : "CARRIED INTO " + MODES[CAMPAIGN_ORDER[idx + 1]].name,
         SCREEN_W / 2, y, 16, "#6dffbf"); y += 30;
    text("FLEET STRENGTH  " + fleetBar(carry.fleet) + "  " +
         Math.round(carry.fleet * 100) + "%", SCREEN_W / 2, y, 16, "#ffe56d");
    y += 28;
    if (last) {
      text("MISSIONS WON  " + carry.missionsWon +
           "        ENEMIES DOWNED  " + carry.kills,
           SCREEN_W / 2, y, 15, "#ffcb42"); y += 26;
    } else {
      const vets = carry.survivorNames.length
        ? carry.survivorNames.join(", ") : "none — a fresh wing next time";
      text("RESERVE  +" + carry.bonusReserve + "        VETERANS  " + vets,
           SCREEN_W / 2, y, 15, "#ffcb42"); y += 26;
    }
    if (carry.acesKilled.length) {
      text("ACES DOWNED  " + carry.acesKilled.join(", "),
           SCREEN_W / 2, y, 14, "#ff8f77"); y += 26;
    }
    y += 14;
  }

  y = Math.max(y, 474);
  if (hasNext) {
    tapButton("NEXT MISSION  [N]", SCREEN_W / 2 - 150, y, 268, 46, "#6dffbf",
              () => playCampaignLevel(CAMPAIGN_ORDER[idx + 1]));
    tapButton("RETRY", SCREEN_W / 2 + 152, y, 196, 46, "#ffcb42",
              () => playCampaignLevel(outcome.levelKey));
  } else {
    tapButton("RETRY", SCREEN_W / 2 - 140, y, 240, 46, "#ffe56d",
              () => playCampaignLevel(outcome.levelKey));
    tapButton("MISSIONS", SCREEN_W / 2 + 140, y, 240, 46, "#ffcb42",
              () => { outcome = null; state = "levels"; });
  }
  tapButton(returnTo ? "BACK TO THE DOCK" : "MAIN MENU",
            SCREEN_W / 2, y + 60, 280, 44, "#ffcb42", leaveMatch);
}

function drawOver() {
  if (outcome && (outcome.kind === "victory" || outcome.kind === "defeat")) {
    drawCampaignOver();
    return;
  }
  const survived = "time survived " + clockText(clock);
  if (outcome && outcome.kind === "winner") {
    const s = outcome.ship;
    text(s.name + " WINS", SCREEN_W / 2, 270, 60, s.colour);
    text("last ship flying", SCREEN_W / 2, 326, 16, "#ffcb42");
    text("the map closed to " + Math.round((bounds.x1 - bounds.x0) / arena.w * 100) +
         "%", SCREEN_W / 2, 354, 15, "#ffcb42");

    const roster = [s, ...ships.filter(p => p !== s)];
    const xName = 180;
    const xKills = 450;
    const xDeaths = 545;
    const xEnv = 690;
    const xTime = 855;
    const y0 = 405;
    text("MATCH STATS", SCREEN_W / 2, y0 - 26, 14, "#ffcb42");
    text("PLAYER", xName, y0, 12, "#ffcb42", "left");
    text("KILLS", xKills, y0, 12, "#ffcb42");
    text("DEATHS", xDeaths, y0, 12, "#ffcb42");
    text("DEATHS BY ENV", xEnv, y0, 12, "#ffcb42");
    text("TIME SURVIVED", xTime, y0, 12, "#ffcb42");
    roster.forEach((p, i) => {
      const y = y0 + 26 + i * 27;
      const time = p.survivedFor == null ? clock : p.survivedFor;
      text(p.name, xName, y, 16, p.colour, "left");
      text(String(p.kills), xKills, y, 16, p.colour);
      text(String(p.deaths), xDeaths, y, 16, p.colour);
      text(String(p.envDeaths), xEnv, y, 16, p.colour);
      text(clockText(time), xTime, y, 16, p.colour);
    });
  } else if (outcome && outcome.kind === "draw") {
    text("NOBODY WINS", SCREEN_W / 2, 280, 54, "#ff8f77");
    text("you went out together", SCREEN_W / 2, 330, 18, "#ffcb42");
    text(survived, SCREEN_W / 2, 368, 15, "#ffcb42");
  } else {
    text("ALL HANDS LOST", SCREEN_W / 2, 260, 54, "#ff8f77");
    text("SCORE " + score, SCREEN_W / 2, 330, 30, "#ffe56d");
    text("REACHED WAVE " + wave, SCREEN_W / 2, 368, 18, "#ffcb42");
    text(survived, SCREEN_W / 2, 396, 15, "#ffcb42");
    if (ffCount > 0) {
      text(ffCount === 1 ? "one of those was you" : ffCount + " of those were you",
           SCREEN_W / 2, 424, 17, "#ff8f77", "center", 0.9);
    }
  }
  const actionY = outcome && outcome.kind === "winner" ? 636 : 520;
  const replayable = canPlayAgain();
  const replayLabel = net.role === "guest" ? "WAITING FOR HOST"
    : replayable ? "PLAY AGAIN" : "NEED ANOTHER PLAYER";
  tapButton(replayLabel, COLS(2, 0), actionY, 260, 44, "#ffe56d",
            playAgain, false, replayable);
  /* From inside a machine this is not a menu and must not say it is: it is
     the dock you walked away from, with your sector where you left it. */
  tapButton(returnTo ? "BACK TO THE DOCK" : "MAIN MENU",
            COLS(2, 1), actionY, 280, 44, "#ffcb42", leaveMatch);
}

/* Paused is where you end up when something needs sorting out, so it is
   where the things you might need to sort out live: the keys, and the way
   out. Both are a tap as well as a key, because a phone has neither. */
function drawPaused() {
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const mid = SCREEN_H / 2;
  const online = state === "menu";
  text(online ? "GAME MENU" : "PAUSED", SCREEN_W / 2, mid - 40, 46, "#ffe56d");

  tapText(online ? "[P / ESC]  RETURN" : "[P / ESC]  RESUME",
          SCREEN_W / 2, mid + 20, 22, "#ffe56d", () => {
    state = "playing";
    localPause = false;
  });
  tapText("[C]  SETTINGS", SCREEN_W / 2, mid + 66, 22, "#ffe56d", () => {
    state = openSettings(online ? "menu" : "paused");
  });
  tapButton("SOUND: " + (soundEnabled ? "ON" : "OFF"),
            COLS(2, 0), mid + 116, 260, 40, soundEnabled ? "#ffe56d" : "#ffcb42",
            toggleSound, soundEnabled);
  tapButton(fullscreenLabel(), COLS(2, 1), mid + 116, 260, 40, "#ffe56d",
            toggleFullscreen, !!fullscreenElement(), fullscreenSupported());
  /* Survey's own row. The pause screen is where somebody goes when they are
     about to stop playing, which is exactly the moment a save button is for —
     and the line under it is the only place the game says where the save
     actually lives. The quit row moves down to make room rather than the row
     being squeezed in beside something. */
  let quitY = mid + 170;
  if (mode && mode.survey && surv) {
    tapButton(saveLabel(), COLS(2, 0), quitY, 260, 40, "#a08cff", surveySaveNow);
    tapButton(accountLabel(), COLS(2, 1), quitY, 260, 40, "#a08cff", openAccount);
    const n = saveNote();
    if (n) text(n, SCREEN_W / 2, quitY + 34, 13, "#ffcb42", "center", 0.75);
    quitY += 78;
  }

  /* It does not go to a menu from inside a machine — it goes back to the
     dock you walked away from, and the line has to say which. */
  tapText(returnTo ? "[Q]  LEAVE THE MACHINE" : "[Q]  QUIT TO MENU",
          SCREEN_W / 2, quitY, 22, "#ffcb42", leaveMatch);
  if (net.on) {
    text("quitting drops the others too", SCREEN_W / 2, quitY + 28, 13,
         "#ffcb42", "center", 0.75);
  }
}

function pauseHere() {
  if (state !== "playing") return;
  state = net.on ? "menu" : "paused";
  localPause = true;
  // Pausing mid-thrust must not leave the host flying this ship on a key
  // nobody is holding any more.
  const me = ships[localSeat()];
  if (me) me.input.l = me.input.r = me.input.th = me.input.f = false;
}

/* Leaving for real: the online connection goes with it, or a host that has
   wandered back to the menu is still holding four people in a match. */
function leaveMatch() {
  if (mode && mode.survey && surv) saveSurveyBook();
  /* Out of a machine is not out of the game. Every path that used to end at
     the title checks this first — the result screen, the terminated card, the
     pause menu and an online disconnect all come through here — and a missed
     one would drop somebody on the front page with their sector saved but
     apparently gone, which reads like a crash. */
  if (owedReturn()) { backToSurvey(); return; }
  /* A coin that was put in and never spent — the campaign's mission list,
     backed out of by a route that did not clear it. Nothing is owed, and it
     must not be allowed to divert the front page. */
  cancelSim();
  // The front page is about to read the book again, and it has just changed.
  forgetTitleCard();
  if (net.on) netReset();
  localPause = false;
  banner = null;
  terminated = null;
  outcome = null;
  state = "title";
}

/* The other way out, and the reason it exists. `leaveMatch` is the match's
   own exit and every button on a result screen, a terminated card and the
   pause menu goes through it. Two exits do not belong to the match at all —
   the host going away while you are still in the game, and closing the lobby
   by hand — and both of them used to set the title directly. A cabinet is
   owed a return whoever ends the match, so they ask here instead. Neither is
   reachable from a machine today, because `startSim` only ever starts a solo
   game; they are written this way so that the list of exits is exhaustive
   rather than exhaustive-for-now, which is the difference between this being
   done and being done until somebody puts a multiplayer cabinet in. */
function toTitle() {
  if (owedReturn()) { backToSurvey(); return; }
  cancelSim();
  // The front page caches what the book says; it may have changed in here.
  forgetTitleCard();
  state = "title";
}

function canPlayAgain() {
  if (net.role === "guest") return false;
  if (net.role !== "host") return true;
  const N = window.KondriteNet;
  const connected = N ? N.host.links.filter(l => l.open && l.seat != null).length : 0;
  return 1 + connected >= MODES[lastSetup.modeKey].minPlayers;
}

function playAgain() {
  if (!canPlayAgain()) return;

  if (net.role !== "host") {
    startGame(lastSetup.modeKey, lastSetup.humans, lastSetup.bots);
    return;
  }

  const N = window.KondriteNet;
  const seated = N.host.links
    .filter(l => l.open && l.seat != null)
    .sort((a, b) => a.seat - b.seat);

  // A player may have left on the result screen. Compact the remaining
  // roster before rebuilding ships so every link still owns a valid index.
  const compactNames = [names[0], ...seated.map(l => names[l.seat])];
  const chosen = [skins[0], ...seated.map(l => skins[l.seat])];
  names = compactNames;
  // Who is in which seat, compacted with the names. See `hostMatchSeats`.
  hostMatchSeats(seated);
  skins = chosen.concat(PLAYERS.map((_, i) => i).filter(i => !chosen.includes(i)));
  seated.forEach((l, i) => { l.seat = i + 1; l.inputSeq = 0; });

  net.inputs = {};
  startGame(lastSetup.modeKey, 1 + seated.length, 0);
  ships.forEach((s, i) => { s.localKeys = i === 0 ? PLAYERS[0] : null; });
  seated.forEach(l => l.send(initPacket(l.seat), true));
}

/* The pad is a real thing sitting over the window, so the window has to know
   which of its three lives it is in: flying, being laid out, or neither —
   and "neither" means gone, because a stick over a menu is a stick eating
   taps meant for the menu. */
function padStage() {
  const b = document.body;
  const flying = state === "playing";
  const laying = state === "thumb";
  if (b.classList.contains("flying") && !flying) padRelease();
  b.classList.toggle("flying", flying);
  b.classList.toggle("arranging", laying);
  if (arranging !== laying) {
    arranging = laying;
    padDrag = null;
    // Sizes only settle once the pad is on screen, so this is the first
    // moment anything can be checked against the edges it must stay inside.
    if (laying) padApply();
  }
  /* The reverse button appears with the part and goes with it. Fitting and
     pulling call `padApply` themselves; this is the backstop for every other
     way the answer can change — a hull swap, a resumed sector, a reset. */
  if (revEl.hidden === revAvailable()) padApply();
  // And the device buttons, which change on their own every frame.
  padDevices();
}

function render(dt) {
  // A held + or - keeps firing while the finger is down. See `startHold`.
  stepHold();
  padStage();
  // Collected fresh: a menu line that isn't drawn this frame isn't tappable
  // this frame either, which is what keeps the two from drifting apart.
  taps = [];
  // And the same rule for the rectangles you can pick a part up from or drop
  // one onto. See `HUD.forgetCarryGeometry`.
  if (surveyHUD && surveyHUD.forgetCarryGeometry) surveyHUD.forgetCarryGeometry();
  ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

  /* Every screen you can reach without a match running gets the idling field
     behind it. Not the pause menu or the results, which have a real world of
     their own to sit over. */
  const menu = state === "title" || state === "count" ||
               state === "levels" || state === "controls" || state === "thumb" ||
               state === "board";

  /* A menu sits on a *lifted* black; flying sits on a true one. Out there the
     dark is the point and nothing should compete with a rock, but a front page
     filled with #000 is the same colour as the bezel around it and reads as a
     screen that has not come on yet — which is what it did. The lift is small
     and cool rather than grey, so the amber stays the warmest thing on it. */
  ctx.fillStyle = menu ? MENU_INK : "#000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (menu) drawDrift(dt || 0);

  /* ── the world behind a page ───────────────────────────────────────────
     The pages the clock keeps running behind are pages you are *flying*
     behind. That was a rule about time and not about sight: the world went on
     without you and you could not see any of it, so a rock arriving while your
     storage was open was a rock that hit you out of a black screen.

     So every page gets the world drawn underneath and a ground that is very
     nearly opaque over the top of it — enough to read type on, thin enough that
     an asteroid coming at you or a star you are drifting into is visible
     through it.

     *Every* page, now, not only the ones that keep the clock running. The shop
     and the shipyard were solid on the reasoning that a stopped world has
     nothing to show — which is wrong twice over: you can still see where you
     are parked and what is around you, and the rock that was already on its way
     is still on its way when you close the page.

     The one exception is the chart: it is a map, and a map you read through an
     asteroid field is a map you squint at. */
  if (surveyHUD) surveyHUD.pageGhost = false;
  /* The chart included. It was the one page drawn on a solid ground, on the
     reasoning that a map read through an asteroid field is a map you squint at
     — which is true, and beside the point: the chart is the page people sit in
     longest, and a page you cannot see past is a page you drift into a star
     behind. It is the map's own panel that goes translucent, not the marks on
     it, so the reading stays as good and the sector is visible through it. */
  if (surveyPage()) {
    drawSurveyBehind(dt);
    if (surveyHUD) surveyHUD.pageGhost = true;
  }

  if (state === "chart" && surv && surveyHUD) {
    surveyHUD.drawChart(surveyState(), dt || 0); return;
  }
  if (state === "almanac" && surv && surveyHUD) {
    surveyHUD.drawAlmanac(surveyState(), dt || 0); return;
  }
  if (state === "refit" && surv && surveyHUD) {
    surveyHUD.drawRefit(surveyState(), dt || 0); return;
  }
  // The station's two extra rooms. See `drawStationInv` and `drawWormhole`.
  if (state === "stationinv" && surv && surveyHUD) {
    surveyHUD.drawStationInv(surveyState(), dt || 0); return;
  }
  if (state === "wormhole" && surv && surveyHUD) {
    surveyHUD.drawWormhole(surveyState(), dt || 0); return;
  }
  if (state === "inventory" && surv && surveyHUD) {
    surveyHUD.drawInventory(surveyState(), dt || 0); return;
  }
  if (state === "record" && surv && surveyHUD) {
    surveyHUD.drawRecord(surveyState(), dt || 0); return;
  }
  if (state === "ship" && surv && surveyHUD) {
    surveyHUD.drawShip(surveyState(), dt || 0); return;
  }
  if (state === "loadout" && surv && surveyHUD) {
    // Anything still asking for the old page gets the one that replaced it.
    state = "inventory";
  }
  if (state === "craft" && surv && surveyHUD) {
    surveyHUD.drawCraft(surveyState(), dt || 0); return;
  }
  if (state === "hangar" && surv && surveyHUD) {
    surveyHUD.drawHangar(surveyState(), dt || 0); return;
  }
  if (state === "arcade" && surv && surveyHUD) {
    simBootTick(dt || 0);
    // The boot may have started the match on this very frame, and the room is
    // not there to be drawn over it.
    if (state !== "arcade") return;
    surveyHUD.drawArcade(surveyState(), dt || 0); return;
  }
  if (state === "missions" && surv && surveyHUD) {
    surveyHUD.drawMissions(surveyState(), dt || 0); return;
  }
  if (state === "lore" && surv && surveyHUD) {
    surveyHUD.drawLore(surveyState(), dt || 0); return;
  }
  if (state === "landed" && surv && surveyHUD) {
    surveyHUD.drawLanded(surveyState(), dt || 0); return;
  }
  if (state === "died" && surv && surveyHUD) {
    surveyHUD.drawDeath(surveyState(), dt || 0); return;
  }

  if (state === "title") { drawTitle(dt); return; }
  if (state === "modes") { drawModes(dt); return; }
  if (state === "board") { drawBoards(); return; }
  if (state === "levels") { drawLevels(); return; }
  if (state === "count") { drawCount(); return; }
  if (state === "controls") { drawControls(); return; }
  if (state === "thumb") { drawThumb(); return; }

  /* World space. The camera puts its centre in the middle of the screen; in
     Survival, that centre is the middle of the arena at a scale that
     fits it exactly, which is the old whole-map view falling out of the same
     maths. Anything off screen is skipped — on a sixteen-screen map most of
     the world is. */
  ctx.save();
  wScale = cam.scale;
  ctx.translate(SCREEN_W / 2, SCREEN_H / 2);
  // Screen shake — a jitter of the whole view on the big hits, in any mode
  // that asks for one. It decays in the world update, not here.
  if (shake > 0.5) {
    ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
  }
  ctx.rotate(cam.rot);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.x, -cam.y);

  drawArena();
  if (mode.survey) drawSurveyWorld();
  if (mode.campaign && camp && camp.planet) drawPlanet(camp.planet);
  drawMotes();
  for (const h of hazards) if (onScreen(h.x, h.y, h.reach)) drawHazard(h);
  for (const r of rocks) {
    if (onScreen(r.x, r.y, r.r + 20)) drawWrapped(r.x, r.y, r.r, () => drawRock(r));
  }
  for (const p of pickups) if (onScreen(p.x, p.y, 30)) drawPickup(p);
  for (const b of bullets) {
    if (onScreen(b.x, b.y, 40)) drawWrapped(b.x, b.y, 12 * U, () => drawBullet(b));
  }
  for (const s of ships) {
    // Capitals are wider than the cull pad, so give them their radius or they
    // vanish the moment their centre leaves the screen.
    const pad = s.radius ? s.radius + 60 : 60;
    if (onScreen(s.x, s.y, pad)) drawWrapped(s.x, s.y, SHIP_R * U, () => drawShip(s));
  }
  drawBits();
  ctx.restore();
  wScale = 1;

  drawHUD(dt || 0);
  // A banner's fade is driven by the clock, and the clock is what pausing
  // stops — so a banner caught mid-fade would sit under the pause menu for
  // as long as the pause lasts.
  if (state !== "over" && state !== "paused" && state !== "menu") {
    drawBanner();
    drawTerminated();
  }

  if (state === "paused" || state === "menu") drawPaused();
  if (state === "over") {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawOver();
  }
}
