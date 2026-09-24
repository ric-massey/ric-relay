"use strict";

/* KONDRITE — POINTER AND TOUCH
   ─────────────────────────────────────────────────────────────────────────────
   Pointer and touch, flying with the mouse, pages that scroll, two fingers
   on a map, and a button you can lean on.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── pointer and touch ───────────────────────────────────────────────────
   Mouse clicks operate menus only. Touch controls feed the same four
   booleans as the keyboard, so physics never needs a separate mobile path. */
const touch = { l: false, r: false, th: false, f: false, rev: false };

/* A gun that runs on its own is the whole point of the setting: with it on
   there is no fire button to hold, which is what makes one-thumbed flying
   possible. Only for a device that has actually been touched — nobody at a
   keyboard should find their gun going off because of a phone setting. */
const autoFire = () =>
  (padCfg.scheme === "arrows" || padCfg.auto) &&
  document.body.classList.contains("touch");

const localSeat = () => (net.role === "guest" ? net.seat : 0);

// Where the pointer is in the 1000×700 layout the menus are drawn in.
function screenPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) / r.width * SCREEN_W,
           y: (clientY - r.top) / r.height * SCREEN_H };
}

/* Where the pointer is, in screen units, for as long as it is over the glass.
   Null when it has left, so flying with the mouse stops asking the ship to
   turn toward a cursor that is somewhere else entirely. */
let pointerAt = null;
canvas.addEventListener("mousemove", e => {
  const s = screenPoint(e.clientX, e.clientY);
  pointerAt = s;
  if (state === "controls") {
    binder.hover = cellAt(s.x, s.y);
    /* And the focus follows the pointer, so the page never shows two
       highlights arguing about which control you are on. Reading off the
       rectangles the page registered last frame rather than recomputing the
       layout here: a second copy of that arithmetic is a second copy to get
       wrong. */
    settingsHover(s.x, s.y);
  }
  /* Which card the pointer is over. Read off the tap rectangles the row drew
     last frame rather than recomputing the layout here — the widths are
     animating, so a second copy of that arithmetic would be a second copy
     that is wrong for one frame every time the row moves. */
  if (state === "modes") {
    modeHover = -1;
    for (const t of taps) {
      if (t.card == null) continue;
      if (s.x >= t.x && s.x <= t.x + t.w && s.y >= t.y && s.y <= t.y + t.h) {
        modeHover = t.card;
        break;
      }
    }
    // Keep the keyboard's focus under the pointer, so tabbing away from the
    // mouse carries on from where the mouse was rather than jumping home.
    if (modeHover >= 0) modePick = modeHover;
  }
  canvas.style.cursor = tapAt(s.x, s.y) ||
    (state === "controls" && cellAt(s.x, s.y)) ? "pointer" : "default";
});
canvas.addEventListener("mouseleave", () => {
  canvas.style.cursor = "default";
  pointerAt = null;
  mouseFiring = false;
});

/* ── flying it with the mouse ─────────────────────────────────────────────
   The nose comes about toward the pointer at the hull's own rate — the same
   `turnToward` the thumb stick uses, given the angle from the ship to the
   cursor instead of the angle of the stick. It is deliberately not a snap: a
   ship that tracked the cursor exactly would make the turn stat meaningless
   and every hull in the shipyard the same hull.

   The left button fires. Thrust stays on the keyboard, because a hand that is
   aiming is not also pushing a throttle. */
let mouseFiring = false;
canvas.addEventListener("mousedown", e => {
  if (e.button === 0) mouseFiring = true;
});
addEventListener("mouseup", e => {
  if (e.button === 0) mouseFiring = false;
});

/* True while the mouse is actually flying the ship: the setting is on, this
   is not a touch layout, and there is a pointer on the glass to fly toward. */
const flyingByMouse = () =>
  mouseFly && !thumbInput() && state === "playing" && pointerAt !== null;

/* A tap on a cell is the same thing as walking to it and pressing ENTER, so
   a rebind is one touch and one key on a laptop or a tablet alike. Pointer
   rather than mouse, or the touchscreen would have to use the keyboard grid
   it may not have. */
/* ── pages that scroll ────────────────────────────────────────────────────
   The almanac and the chart are longer than the screen, and until now the only
   things that could move either were the arrow keys and, on the almanac, two
   small buttons. A wheel did nothing at all — there was no wheel listener
   anywhere in the game — and the almanac's own footer promised a swipe that
   was never implemented.

   A drag is awkward here for one specific reason: every menu tap in this game
   fires on *pointerdown*, so the moment a thumb lands on a card, that card is
   already selected and any movement after it is too late to mean anything. On
   these two pages the press is therefore held rather than acted on, and it
   becomes a tap on release only if the pointer barely moved. Everywhere else
   keeps firing on the way down, where it belongs. */
let pageDrag = null;
const DRAG_SLOP = 7;          // screen units before a press becomes a drag
/* A part being carried from storage to a slot. While one is in hand the page
   does not scroll — the gesture belongs to the part — and letting go over a
   square fits it. See `HUD.grabAt`. */
let carrying = false;

const scrollingPage = () =>
  state === "almanac" || state === "chart" || state === "hangar" ||
  state === "inventory" || state === "craft" || state === "refit" ||
  state === "record" || state === "ship" ||
  // The wormhole map is not on this list: it does not scroll, and a page that
  // claims a drag is a page whose taps arrive as drags.
  state === "stationinv";
// How many rows the shelf on the loadout page has to scroll through.
const shelfRows = () => (surv && surv.docked ? MODULES.length : 0);

canvas.addEventListener("wheel", e => {
  if (!surv || !surveyHUD) return;
  // A wheel reports lines on some browsers and pixels on others.
  const px = e.deltaMode === 1 ? e.deltaY * 16
           : e.deltaMode === 2 ? e.deltaY * 400
           : e.deltaY;
  if (state === "almanac") {
    surveyHUD.almanacDragBy(px, SURVEY_TOTAL);
    e.preventDefault();
  } else if (state === "hangar") {
    surveyHUD.hangarDragBy(px, SHIPS.length);
    e.preventDefault();
  } else if (state === "ship") {
    surveyHUD.shipScrollBy(px, surveyHUD.shipHeight || 0,
                           surveyHUD.shipView || 1);
    e.preventDefault();
  } else if (state === "inventory") {
    surveyHUD.cargoScrollBy(px, surveyHUD.cargoHeight || 0,
                            surveyHUD.cargoView || 1);
    e.preventDefault();
  } else if (state === "record") {
    surveyHUD.recordScrollBy(px, surveyHUD.recordHeight || 0,
                             surveyHUD.recordView || 1);
    e.preventDefault();
  } else if (state === "craft") {
    surveyHUD.craftDragBy(px);
    e.preventDefault();
  } else if (state === "stationinv") {
    const sub = surveyHUD.stationTab ? surveyHUD.stationTab() : "ship";
    if (sub === "inventory") {
      surveyHUD.cargoScrollBy(px, surveyHUD.cargoHeight || 0,
                              surveyHUD.cargoView || 1);
    } else if (sub === "record") {
      surveyHUD.recordScrollBy(px, surveyHUD.recordHeight || 0,
                               surveyHUD.recordView || 1);
    } else if (sub === "ship") {
      surveyHUD.shipScrollBy(px, surveyHUD.shipHeight || 0,
                             surveyHUD.shipView || 1);
    } else if (sub === "craft") {
      surveyHUD.craftDragBy(px);
    } else if (sub === "chart") {
      wheelZoom(e, px);
    }
    e.preventDefault();
  } else if (state === "refit" || state === "landed") {
    surveyHUD.marketScrollBy(px, surveyHUD.marketHeight || 0,
                             surveyHUD.marketView || 1);
    e.preventDefault();
  } else if (state === "chart") {
    // On a map the wheel is zoom, not pan — that is what every map does.
    wheelZoom(e, px);
    e.preventDefault();
  }
}, { passive: false });

/* The map's wheel. As far as it was turned rather than a step an event, and
   about the pointer. A trackpad pinch arrives as a wheel with ctrl held and
   much smaller numbers, so it is read more strongly. A sideways scroll is
   not a zoom at all. See `chartZoomAt`. */
function wheelZoom(e, px) {
  if (!px) return;
  const p = screenPoint(e.clientX, e.clientY);
  surveyHUD.chartZoomAt(Math.exp(-px * (e.ctrlKey ? 0.012 : 0.0025)), p.x, p.y);
}

/* ── two fingers on a map ─────────────────────────────────────────────────
   The map had no pinch. On a phone the only zoom was the two buttons on the
   rail, a step a press, and two fingers did nothing but start a drag. Now
   two fingers zoom about the point between them and pan as they move, and
   the first finger's tap or drag is cancelled the moment the second lands. */
const mapPage = () => state === "chart" ||
  (state === "stationinv" && surveyHUD && surveyHUD.stationTab &&
   surveyHUD.stationTab() === "chart");
const fingers = new Map();
let pinch = null;
const pinchSpan = () => {
  const [a, b] = [...fingers.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};
const dropFinger = e => {
  fingers.delete(e.pointerId);
  if (fingers.size < 2) pinch = null;
};
canvas.addEventListener("pointerup", dropFinger);
canvas.addEventListener("pointercancel", dropFinger);

canvas.addEventListener("pointermove", e => {
  if (fingers.has(e.pointerId)) {
    fingers.set(e.pointerId, screenPoint(e.clientX, e.clientY));
    if (pinch && fingers.size === 2 && surveyHUD) {
      const now2 = pinchSpan();
      if (pinch.d > 0 && now2.d > 0) {
        surveyHUD.chartDragBy(now2.x - pinch.x, now2.y - pinch.y);
        surveyHUD.chartZoomAt(now2.d / pinch.d, now2.x, now2.y);
      }
      pinch = now2;
      e.preventDefault();
      return;
    }
  }
  if (!pageDrag || e.pointerId !== pageDrag.id || !surveyHUD) return;
  const p = screenPoint(e.clientX, e.clientY);
  const dx = p.x - pageDrag.x, dy = p.y - pageDrag.y;
  pageDrag.moved += Math.abs(dx) + Math.abs(dy);
  // Carrying a part: the gesture belongs to the part, and the page holds still
  // under it. Scrolling the list out from under the slot you were aiming at
  // would make the drop a moving target.
  if (carrying) {
    surveyHUD.carryTo(p.x, p.y);
    pageDrag.x = p.x; pageDrag.y = p.y;
    e.preventDefault();
    return;
  }
  // Content follows the finger: drag down and you see what was above.
  if (state === "almanac") surveyHUD.almanacDragBy(-dy, SURVEY_TOTAL);
  else if (state === "hangar") surveyHUD.hangarDragBy(-dy, SHIPS.length);
  else if (state === "ship") {
    surveyHUD.shipScrollBy(-dy, surveyHUD.shipHeight || 0,
                           surveyHUD.shipView || 1);
  }
  else if (state === "inventory") {
    surveyHUD.cargoScrollBy(-dy, surveyHUD.cargoHeight || 0,
                            surveyHUD.cargoView || 1);
  }
  else if (state === "record") {
    surveyHUD.recordScrollBy(-dy, surveyHUD.recordHeight || 0,
                             surveyHUD.recordView || 1);
  }
  else if (state === "craft") surveyHUD.craftDragBy(-dy);
  else if (state === "refit" || state === "landed") {
    surveyHUD.marketScrollBy(-dy, surveyHUD.marketHeight || 0,
                             surveyHUD.marketView || 1);
  }
  else if (state === "chart") surveyHUD.chartDragBy(dx, dy);
  /* The station page's tabs are the same pages, and dragging did nothing on
     any of them: the map would not pan and the lists would not scroll,
     which on a phone meant they could not be used at all. */
  else if (state === "stationinv") {
    const sub = surveyHUD.stationTab ? surveyHUD.stationTab() : "ship";
    if (sub === "chart") surveyHUD.chartDragBy(dx, dy);
    else if (sub === "inventory") {
      surveyHUD.cargoScrollBy(-dy, surveyHUD.cargoHeight || 0, surveyHUD.cargoView || 1);
    } else if (sub === "record") {
      surveyHUD.recordScrollBy(-dy, surveyHUD.recordHeight || 0, surveyHUD.recordView || 1);
    } else if (sub === "ship") {
      surveyHUD.shipScrollBy(-dy, surveyHUD.shipHeight || 0, surveyHUD.shipView || 1);
    } else if (sub === "craft") surveyHUD.craftDragBy(-dy);
  }
  pageDrag.x = p.x; pageDrag.y = p.y;
  e.preventDefault();
});

/* ── a button you can lean on ─────────────────────────────────────────────
   The shop's + and − step by one, and stepping to a hundred is a hundred
   presses — which on a phone is not a control at all. A rectangle marked
   `hold` fires on the *press* and then keeps firing, faster the longer it is
   held, until the finger comes up.

   Wall clock rather than the game clock: a shop is a page, the world behind
   it may be parked, and a repeat that stops because the simulation stopped
   would be a button that works in flight and not at a counter.

   Because the press spends the tap, `pageDrag.hit` is left null so the
   release does not spend it a second time. */
let holding = null;
function startHold(hit) {
  const now = performance.now();
  holding = { act: hit.act, next: now + 340, step: 340 };
  hit.act();
}
function stepHold() {
  if (!holding) return;
  const now = performance.now();
  // Guarded: a tab that was in the background must not come back to a
  // thousand queued presses.
  for (let i = 0; i < 24 && now >= holding.next; i++) {
    holding.act();
    holding.step = Math.max(45, holding.step * 0.7);
    holding.next += holding.step;
  }
}
const endHold = () => { holding = null; };

function endPageDrag(e, act) {
  endHold();
  if (!pageDrag || (e && e.pointerId !== pageDrag.id)) return;
  const d = pageDrag;
  pageDrag = null;
  /* Letting go of a part. Over a slot it is fitted; over anything else it goes
     back where it came from. `dropAt` answers whether the gesture was a drag at
     all — a press that never moved falls through to the ordinary tap below,
     which is the click-to-fit that was there before any of this. */
  if (carrying) {
    carrying = false;
    if (surveyHUD) {
      const took = act && e
        ? surveyHUD.dropAt(surveyState(), screenPoint(e.clientX, e.clientY).x,
                           screenPoint(e.clientX, e.clientY).y)
        : (surveyHUD.cancelCarry(), true);
      if (took) return;
    }
  }
  /* A press that never travelled was a tap all along. The release point goes
     with it, because a tap on a map means "here" and an `act` with no
     coordinates cannot know where here was. */
  if (act && d.moved < DRAG_SLOP && d.hit) d.hit.act(d.x, d.y);
}
canvas.addEventListener("pointerup", e => endPageDrag(e, true));
canvas.addEventListener("pointercancel", e => endPageDrag(e, false));

canvas.addEventListener("pointerdown", e => {
  // Suppress the compatibility mouse event emitted after a touchscreen tap.
  if (e.pointerType === "touch") e.preventDefault();

  const p = screenPoint(e.clientX, e.clientY);

  // A second finger on a map is a pinch, and the first one's gesture is over.
  if (!mapPage()) fingers.clear();
  else if (e.pointerType === "touch") {
    fingers.set(e.pointerId, p);
    if (fingers.size === 2) {
      pinch = pinchSpan();
      pageDrag = null;
      e.preventDefault();
      return;
    }
  }

  if (state === "controls") {
    const cell = cellAt(p.x, p.y);
    if (cell) {
      binder.p = cell.p; binder.a = cell.a; binder.listening = true;
      e.preventDefault();
      return;
    }
  }

  // Everything else on a menu screen registered itself while being drawn.
  const hit = tapAt(p.x, p.y);

  // A `hold` rectangle answers to the press and keeps answering. See `startHold`.
  if (hit && hit.hold && typeof hit.act === "function") {
    startHold(hit);
    pageDrag = { id: e.pointerId, x: p.x, y: p.y, moved: 0, hit: null };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    return;
  }

  /* A part being picked up out of storage. Asked before the page decides to
     scroll, because the same press means two different things depending on
     what is under it: on a part it is a carry, anywhere else it is a scroll.
     The tap that was already registered is kept, so a press that never moves
     is still the click-to-fit it always was. */
  /* No page name here. `grabAt` answers from the rectangles drawn this frame
     and there are none on a page without a spares tray, so asking it is both
     the check and the answer. The name that used to be here was `inventory`,
     and when the pages were split the tray moved to SHIP — so the gesture
     went looking for a page that no longer has one. */
  if (surveyHUD && surveyHUD.grabAt && surveyHUD.grabAt(p.x, p.y)) {
    carrying = true;
    pageDrag = { id: e.pointerId, x: p.x, y: p.y, moved: 0, hit };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    return;
  }

  if (scrollingPage()) {
    pageDrag = { id: e.pointerId, x: p.x, y: p.y, moved: 0, hit };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    return;
  }

  if (hit) {
    // A settings button is a decision to stop waiting for a replacement key.
    // Without this, Camera/Reset/Clear leave the next keypress captured.
    if (state === "controls") binder.listening = false;
    hit.act();
    e.preventDefault();
    return;
  }

  if (state === "controls") binder.listening = false;   // tapping off backs out
});

/* Which turn key to hold to end up pointing at `want`, and how far off the
   nose currently is. The thumb stick goes through ordinary turn input, so it
   cannot out-turn a keyboard. */
function turnToward(s, want) {
  let diff = want - s.a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Dead zone, or the ship shivers either side of where you're pointing.
  return { l: diff < -0.05, r: diff > 0.05, off: Math.abs(diff) };
}

function readSimulationInput() {
  // The host owns remote and bot input even while its own menu is open.
  // Otherwise the last received command sticks until the host resumes.
  if (net.role === "host") {
    for (const s of ships) {
      if (s.localKeys || s.bot) continue;
      const i = net.inputs[s.id];
      if (i) { s.input.l = i.l; s.input.r = i.r; s.input.th = i.th; s.input.f = i.f; }
    }
  }
  if (net.role !== "guest") {
    for (const s of ships) if (s.bot) driveBot(s, lastDt);
  }
}

function readLocalInput() {
  for (const s of ships) {
    if (!s.localKeys) continue;
    const k = s.localKeys;
    s.input.l = held(k.left);
    s.input.r = held(k.right);
    s.input.th = held(k.thrust);
    s.input.f = held(k.fire);
    s.input.rev = false;
  }

  /* Reverse. Not a bindable action — a Survey verb, like the scan and the
     light drive, on a fixed key, and only there at all if the part is bolted
     on and finished fitting. Backing off a rock without turning round is a
     thing your ship can suddenly do, which is what a part is supposed to
     feel like. */
  if (mode && mode.survey && modFitted("reverser")) {
    const me0 = ships[localSeat()];
    // A key on a keyboard, a button on the pad, and either will do — the same
    // rule the turn and the throttle already follow.
    if (me0 && me0.localKeys) {
      me0.input.rev = held(["KeyS", "ArrowDown"]) || touch.rev || gpad.rev;
    }
  }

  // Thumb controls drive whichever ship belongs to this machine, on top of
  // whatever the keyboard is doing.
  const me = ships[localSeat()];
  if (me && me.localKeys) {
    // The keys, the thumb pad and the gamepad, any of which will do.
    me.input.l = me.input.l || touch.l || gpad.l;
    me.input.r = me.input.r || touch.r || gpad.r;
    let stickGas = false;
    if (padCfg.scheme === "stick" && stick.on && me.alive) {
      // The stick points in screen space; undo the camera rotation to get
      // the corresponding direction in the world.
      const t = turnToward(me, stick.ang - cam.rot);
      me.input.l = me.input.l || t.l;
      me.input.r = me.input.r || t.r;
      /* With no gas button the stick is the throttle. The engine waits until
         the nose is roughly where you pushed, though: a flick across the
         stick would otherwise spend the whole turn burning you further into
         the direction you were trying to leave. Thrust only ever goes out of
         the nose, so holding it back until the nose has caught up can never
         cost you a burn you actually asked for. */
      stickGas = !padCfg.gas && stick.mag > 0.55 && t.off < 1.05;
    }
    /* The mouse, if that is how this is being flown. On top of the keys
       rather than instead of them: turning with A and D while the pointer
       sits somewhere is a fight nobody asked for, so the keys win — they are
       a deliberate press and the cursor is just wherever the hand left it. */
    if (flyingByMouse() && me.alive && !me.input.l && !me.input.r) {
      const sx = pointerAt.x - SCREEN_W / 2;
      const sy = pointerAt.y - SCREEN_H / 2;
      // Far enough out to mean something: a cursor on the ship has no bearing.
      if (Math.hypot(sx, sy) > 26) {
        const t = turnToward(me, Math.atan2(sy, sx) - cam.rot);
        me.input.l = t.l;
        me.input.r = t.r;
      }
    }
    me.input.th = me.input.th || touch.th || stickGas || gpad.th;
    me.input.f = me.input.f || touch.f || gpad.f || autoFire() ||
                 (flyingByMouse() && mouseFiring);
  }
  readSimulationInput();
}

let lastDt = 1 / 60;

function netPump(dt) {
  const N = window.KondriteNet;
  if (!N) return;
  if (net.role === "host") {
    net.sendAcc += dt;
    if (net.sendAcc >= 1 / SNAP_HZ) { net.sendAcc = 0; N.host.broadcast(snapshot(), false); }
    net.rockAcc += dt;
    if (net.rockAcc >= 1 / ROCK_HZ) { net.rockAcc = 0; N.host.broadcast(rockPacket(), false); }
  } else if (net.role === "guest") {
    net.inAcc += dt;
    if (net.inAcc >= 1 / INPUT_HZ) {
      net.inAcc = 0;
      const i = ships[net.seat] ? ships[net.seat].input : null;
      if (i) N.guest.send({ t: "in", q: ++net.outInputSeq,
                            l: !!i.l, r: !!i.r, th: !!i.th, f: !!i.f }, false);
    }
  }
}
