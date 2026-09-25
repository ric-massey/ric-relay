"use strict";

/* KONDRITE — SURVEY INTERFACE: THE PANEL'S STRIP
   ─────────────────────────────────────────────────────────────────────────────
   The powers at a glance and the strip along the bottom (the scan, device
   chips, prompts, the station door), the devices, edge arrows, and
   something picked off the chart. */

/* ── the powers, at a glance ────────────────────────────────────────────
   One strip along the foot of the minimap, and no words on it: three
   squares in the three flags' colours, each with a bar for how much fight
   that power has left, and a red tie under the two that are at war. If the
   province you are in is contested, a second colour sits inside its
   square. This is the living world's whole front-page presence in flight —
   the pages have the rest. */
function drawPowers(st) {
  const L = st.living;
  if (!L || !st.ship || !L.powers || !L.powers.length) return;
  const { ctx } = api;
  const b = panelBox();
  const y = b.y + b.h + 24;          // under the "charted" line
  const n = L.powers.length;
  const gw = Math.floor(b.w / n), sq = 8, barW = gw - sq - 8;
  const at = {};
  // Tap it and the sector page opens: the strip is the door, not a readout.
  if (st.onSector) tap({ x: b.x - 4, y: y - 4, w: b.w + 8, h: 22, act: st.onSector });
  ctx.save();
  ctx.lineWidth = 1;
  L.powers.forEach((pw, i) => {
    const x = b.x + i * gw;
    at[pw.key] = x + sq / 2;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = pw.colour;
    ctx.fillRect(x, y, sq, sq);
    // The province's second colour, if somebody else is in it too; a
    // freehold's square carries the flag it left inside it.
    if (L.here && L.here.contested === pw.key && L.here.contestedColour) {
      ctx.fillStyle = L.here.colour || VIOLET;
      ctx.fillRect(x + 2, y + 2, sq - 4, sq - 4);
    } else if (pw.cause && pw.fromColour) {
      ctx.fillStyle = pw.fromColour;
      ctx.fillRect(x + 3, y + 3, sq - 6, sq - 6);
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = VIOLET_LOW;
    ctx.strokeRect(x + sq + 4, y + 1.5, barW, 5);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pw.colour;
    ctx.fillRect(x + sq + 5, y + 2.5, Math.max(1, (barW - 2) * pw.strength), 3);
  });
  // The war, as a tie between the two fighting it.
  const fighting = L.powers.filter(pw => pw.atWar);
  if (fighting.length === 2) {
    const a = at[fighting[0].key], c = at[fighting[1].key];
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = WARN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a, y + sq + 3); ctx.lineTo(a, y + sq + 6);
    ctx.lineTo(c, y + sq + 6); ctx.lineTo(c, y + sq + 3);
    ctx.stroke();
  }
  ctx.restore();
}

/* Bottom centre: the one band a thumb never covers on a phone and a player
   never looks away from on a desk. The two things that must always be legible
   live here, and nothing else does. */
function drawStrip(st) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const ship = st.ship;
  if (!ship) return;
  const cx = SCREEN_W / 2;
  const y = SCREEN_H - (api.touchOnly ? 34 : 26);
  const w = 210, h = 9;
  const frac = Math.max(0, Math.min(1, ship.hull / (ship.maxHull || 1)));
  /* Standing in a star's light, *and* carrying something that can drink it.
     The two are separate facts now — the light is where you are, the panels are
     what you own — and the bar must not promise a repair the ship cannot do. */
  const lit = !!st.inStar && !!st.solar;
  const unlit = !!st.inStar && !st.solar;
  const critical = !!st.critical;

  // In a star's light the hull bar is the repair readout too, so there is one
  // thing to look at rather than two.
  ctx.save();
  ctx.strokeStyle = lit ? SOLAR : RULE;
  ctx.globalAlpha = lit ? 0.9 : 0.7;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, y - h, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = frac > 0.34 ? (lit ? SOLAR : AMBER) : WARN;
  ctx.fillRect(cx - w / 2 + 1, y - h + 1, Math.max(0, (w - 2) * frac), h - 2);
  ctx.restore();

  /* Bounded to the hull bar's own width. This line sits under the bar and the
     scan button sits off the bar's right shoulder, so a caption wider than the
     bar runs into it — which is what the bigger phone type did to "IN THE LIGHT
     — NO PANELS" the moment it was introduced. */
  fitText(lit ? "SOLAR — HULL RECOVERING"
            : unlit ? "IN THE LIGHT — NO PANELS"
            : critical ? "HULL GONE" : "HULL",
        cx, y + 20, SIZE.cap,
          lit ? SOLAR : unlit ? VIOLET_DIM : critical ? WARN : AMBER_DIM,
          "center", lit || critical ? 0.95 : unlit ? 0.8 : 0.6, w + 26);

  /* ── the scan ──────────────────────────────────────────────────────────
     On a phone this was a word beside the hull bar with an invisible rectangle
     over it, which is not a button: nothing about it said it could be pressed,
     and a word on a HUD is usually a readout. It is drawn as a button now — a
     box, a border, and a ring inside it that fills as the scanner charges, so
     "charging" is the same object rather than a different word somewhere else.

     On a keyboard it stays a label, because `F` is right there and a button
     nobody clicks is furniture. */
  const ready = st.scan && st.scan.charge >= 1;
  const chg = st.scan ? Math.max(0, Math.min(1, st.scan.charge)) : 0;
  if (api.touchOnly) {
    const bw = 104, bh = 46;
    const bx = cx + w / 2 + 18, by = y - 8;
    ctx.save();
    ctx.fillStyle = ready ? VIOLET : VIOLET_LOW;
    ctx.globalAlpha = ready ? 0.22 : 0.1;
    ctx.fillRect(bx, by - bh / 2, bw, bh);
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(bx, by - bh / 2, bw, bh);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 0.9 : 0.6;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx + 23, by, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chg);
    ctx.stroke();
    ctx.restore();
    label(ready ? "SCAN" : "WAIT", bx + 44, by + 6, SIZE.cap,
          ready ? VIOLET : VIOLET_DIM, "left", ready ? 1 : 0.6, "0.1em");
    if (ready) {
      tap({ x: bx, y: by - bh / 2, w: bw, h: bh,
            act: st.onScan || (() => {}) });
    }
  } else {
    label(ready ? "SCAN  [F]" : "CHARGING",
          cx + w / 2 + 16, y, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 1 : 0.5);
  }
  /* ── where the device chips go ─────────────────────────────────────────
     They were off the *left* shoulder of the hull bar, mirroring the scan
     button on the right, on the argument that a device and a scan are the
     same kind of thing. The argument was right and the placement was not: on
     a desk it put them across the middle of the screen, which is where you
     are looking when you fly, and it left the bottom-right corner — the one
     piece of the frame nothing else uses — empty.

     So: a desk stacks them into the bottom-right corner, out of the way of
     everything and in the place a hand already goes looking for a toolbar. A
     phone keeps them **beside the scan button**, because the scan is the one
     control on this panel a thumb already presses and a verb with a wait on
     it belongs next to the other verb with a wait on it. */
  if (api.touchOnly) {
    /* Stacked straight up from the scan button and right-aligned with it, so
       the column of verbs and the verb they sit on read as one control. Not
       *beside* it: three chips at their own width plus the scan button is
       wider than a landscape phone has to the right of the hull bar, and a
       chip half off the screen is a chip nobody can read. Clamped anyway. */
    const bw = 104, bh = 46;
    const right = Math.min(cx + w / 2 + 18 + bw, SCREEN_W - PAGE.EDGE - 4);
    drawPanelDevices(st, right, y - 8 - bh / 2 - 22);
  } else {
    drawPanelDevices(st, SCREEN_W - PAGE.EDGE - 6, SCREEN_H - 26);
  }

  // Saying the radius is what makes the scanner refit legible: the number
  // goes up when you buy a tier, and that is the whole purchase.
  if (ready && st.scanReach && !api.touchOnly) {
    label(Math.round(st.scanReach) + "u", cx + w / 2 + 16, y + 18, SIZE.cap,
          VIOLET_DIM, "left", 0.6);
  }
  if (!ready && st.scan) {
    ctx.save();
    ctx.strokeStyle = VIOLET_DIM;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - w / 2 - 26, y - h / 2, 9, -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * st.scan.charge);
    ctx.stroke();
    ctx.restore();
  }

  /* The line above the bar, which holds one thing at a time. Three things want
     it and they are in a strict order of importance: one hit from death beats
     a shop you are parked at, and a shop you are parked at beats a reminder of
     what M does. Anything else here would be two of them overlapping, which is
     what happened the first time the warning was put below the bar and landed
     on the scanner readout. */
  /* Four things want this line, in a strict order of importance. One hit from
     death beats a tank running out, a tank running out beats a shop you are
     parked at, and all three beat a reminder of what M does. */
  /* Above the scan button rather than beside it. The button is a real box now
     and it sits off the hull bar's right shoulder, so a line fitted to most of
     the screen's width ran straight through its edge. */
  /* ── one target for every prompt on this line ──────────────────────────
     There are four of them — docked, landed, somebody adrift, something with a
     name — they are mutually exclusive, they all draw at `y - 54`, and every
     one of them has to stop short of the scan button on its right. They had
     drifted into three different rectangles: 320 wide at `y - 62`, 260 wide at
     `y - 86`, and one that reached 37px into the scan target on a phone. Taps
     go to whoever registered last, so pressing the right-hand end of a prompt
     scanned instead.

     So: one function. It is bounded by where the scan button starts, which this
     function already knows, rather than by a number somebody hoped was small
     enough — and it sits *on* the words rather than above them. */
  const promptTap = (act) => {
    const right = cx + w / 2 + 10;
    const left = Math.max(PAGE.EDGE, cx - 170);
    tap({ x: left, y: y - 72, w: Math.max(120, right - left), h: 36,
          act: act || (() => {}) });
  };

  /* ── the station is the door ────────────────────────────────────────────
     Docking is a keypress, and on a phone the keypress is the prompt on this
     line — which four other things can outrank. At one hull point the line
     reads THE NEXT HIT KILLS YOU, correctly, and a phone was left with no way
     into the shop at exactly the moment it needed one most: you are docked, you
     are one hit from dead, the repair is twenty feet away and there is nothing
     to press.

     So the station itself is pressable whenever you are close enough to dock.
     It is where you are already looking, it is the thing you want, and it can
     never be crowded out by something more urgent because it is not on this
     line at all. */
  if (st.docked && st.dockAt && st.cam && st.ship) {
    const cam = st.cam;
    const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
    const dx = st.dockAt.x - cam.x, dy = st.dockAt.y - cam.y;
    const px = SCREEN_W / 2 + (dx * cos - dy * sin) * cam.scale;
    const py = SCREEN_H / 2 + (dx * sin + dy * cos) * cam.scale;
    const rr = 74;
    if (px > -rr && px < SCREEN_W + rr && py > -rr && py < SCREEN_H + rr) {
      const beat = 0.45 + 0.3 * Math.sin(clockish() * 3);
      ctx.save();
      ctx.strokeStyle = HUD_CASH;
      ctx.globalAlpha = beat;
      ctx.lineWidth = 2;
      ctx.setLineDash && ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.restore();
      label(api.touchOnly ? "TAP TO DOCK" : "DOCK  [E]", px, py + rr + 20,
            SIZE.cap, HUD_CASH, "center", 0.9, "0.1em");
      tap({ x: px - rr, y: py - rr, w: rr * 2, h: rr * 2,
            act: st.onRefit || (() => {}) });
    }
  }

  const dry = st.water && st.water.countdown > 0 ? st.water : null;
  const starving = st.food && st.food.countdown > 0 ? st.food : null;
  if (critical) {
    const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / (lit ? 480 : 170)));
    fitText(lit ? "MENDING — STAY IN THE LIGHT"
                : "THE NEXT HIT KILLS YOU",
            cx, y - 54, SIZE.val, lit ? SOLAR : WARN, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (dry || starving) {
    const m = dry || starving;
    const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 200));
    fitText((dry ? "NO WATER" : "NO FOOD") + " — " + fmtSecs(m.countdown) +
            " LEFT", cx, y - 54, SIZE.val, WARN, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (st.docked) {
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
    label(api.touchOnly ? "DOCKED — TAP TO REFIT" : "DOCKED — [E] REFIT",
          cx, y - 54, SIZE.val, HUD_CASH, "center", beat, "0.1em");
    promptTap(st.onRefit);
  } else if (st.landed) {
    // Somebody lives on the thing you are resting against, and they will sell
    // you water. Named, because the name is the point of naming them.
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
    fitText(st.landed.name + (api.touchOnly ? " — TAP TO TRADE" : " — [E] TRADE"),
            cx, y - 54, SIZE.val, st.landed.colour || HUD_CASH, "center", beat,
            SCREEN_W - 380, "0.08em");
    promptTap(st.onLand);
  } else if (st.helping) {
    /* Somebody out there has stopped. Above the name of a monument and above
       the drive, because it is the only line on this panel with a clock
       running on it — and the clock is stated, because "four minutes" is the
       difference between a decision and a thing you noticed too late. */
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 5);
    fitText(st.helping.flag + " HAULER ADRIFT — " + fmtSecs(st.helping.left) +
            (st.helping.can
               ? (api.touchOnly ? " — TAP: WATER" : " — [E] GIVE WATER")
               : " — NOT ENOUGH WATER"),
            cx, y - 54, SIZE.val, st.helping.can ? ICE : WARN, "center", beat,
            SCREEN_W - 380, "0.06em");
    if (st.helping.can) promptTap(st.onWater);
  } else if (st.near) {
    /* Something with a name on it, in reach. Above the light drive and above
       the key hints because it is the only line here that is about *where you
       are* — the drive will still be ready in a minute and this stone will be
       behind you. */
    const beat = 0.65 + 0.35 * Math.sin(clockish() * 3);
    fitText(st.near.name + (api.touchOnly ? " — TAP" : " — [E]"),
            cx, y - 54, SIZE.val, st.near.colour || VIOLET, "center", beat,
            SCREEN_W - 380, "0.08em");
    promptTap(st.onLook);
  } else if (st.light && st.light.have && st.light.run <= 0) {
    // Offered, quietly, whenever there is nothing more urgent to say. A drive
    // you have to remember you own is a drive you never use.
    label(api.touchOnly ? "LIGHT DRIVE READY" : "LIGHT DRIVE READY  —  [R]",
          cx, y - 30, SIZE.cap, ICE, "center", 0.55, "0.14em");
    if (api.touchOnly) promptTap(st.onLight);
  } else if (!st.scanTaught) {
    /* The one control nobody would guess. Survey has no tutorial, the scan is
       the verb the whole mode is built on, and a player who never presses it
       flies an empty sector wondering what the point is. So it is said, once,
       on the line the eye is already on — and it stops being said the moment you
       press it, because a hint that outlives its usefulness is clutter. */
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 2.6);
    fitText(api.touchOnly ? "PRESS SCAN"
                          : "PRESS  F  TO SCAN",
            cx, y - 54, SIZE.val, VIOLET, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (!api.touchOnly) {
    // The mode's three keys, stated once, quietly, where a new player is
    // already looking. Survey has no tutorial and should not need one.
    /* Above the bar, in the slot the docked prompt uses — the two are
       already mutually exclusive. It used to be drawn at `y + 38`, which is
       712 on a 700-tall canvas: the one line that tells a cold player what
       the mode's keys are had never been on screen at all. */
    /* Three keys, and they are the three doors: the chart, the page that holds
       every other page, and the scan. The almanac used to be named here and is
       not any more — it is a button inside the inventory now, so naming it
       alongside `I` would be pointing at the same door twice. `L` still opens
       it for anyone who already knows. */
    label("M CHART   ·   I INVENTORY   ·   F SCAN", cx, y - 30, SIZE.cap,
          VIOLET_LOW, "center", 0.8, "0.1em");
  }
}

/* ── the devices, on the flight panel ─────────────────────────────────────
   A chip a device, off the left shoulder of the hull bar, mirroring the scan
   button on the right — the two are the same kind of thing, a verb with a
   wait on it, and they should not be in two different places.

   Each chip is the whole state: what it is, which key or slot it answers to,
   and a bar that fills as the cooldown runs out, so "not yet" is the chip
   rather than a number somewhere else. Stacked upward in slot order, because
   the parts page lists them in slot order and nothing should renumber itself
   between two pages.

   It is a readout and not a button. On a phone the device buttons live on the
   thumb pad where the player put them, and a second live target up here would
   be a control nobody chose the position of. */
const DEV_W = 116;
function drawPanelDevices(st, right, y) {
  const list = st.devices || [];
  if (!list.length) return;
  const { ctx } = api;
  const w = DEV_W, h = 28, gap = 6;
  list.forEach((d, i) => {
    const x = right - w;
    /* Slot one at the top. The stack grows upward from the anchor, so the
       index has to be counted from the far end or the four would read
       4-3-2-1 down the screen while every other page lists them 1-2-3-4. */
    const cy = y - (list.length - 1 - i) * (h + gap);
    const ready = d.cd <= 0;
    const done = d.cool > 0 ? 1 - Math.max(0, Math.min(1, d.cd / d.cool)) : 1;

    ctx.save();
    ctx.fillStyle = VIOLET_LOW;
    ctx.globalAlpha = ready ? 0.18 : 0.1;
    ctx.fillRect(x, cy - h / 2, w, h);
    // The wait, as the chip filling back up rather than as a number.
    if (!ready) {
      ctx.fillStyle = VIOLET;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, cy - h / 2, w * done, h);
    }
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 0.9 : 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, cy - h / 2, w, h);
    ctx.restore();

    /* The key on a keyboard, the slot number on a phone. They are the same
       fact — which of the four this is — said in whichever way the player can
       act on: a phone has no [1] to press, and a desk has no thumb button. */
    const mark = api.touchOnly ? String(d.slot + 1) : (d.hint || "\u2014");
    label(mark, x + 9, cy + 5, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 0.95 : 0.55, "0.06em");
    fitText(d.tag, x + w - 8, cy + 5, SIZE.cap,
            ready ? VIOLET : VIOLET_DIM, "right", ready ? 0.95 : 0.55,
            w - 34);
  });
}

// The panel has no clock of its own and does not need a precise one.
const clockish = () => Date.now() / 1000;

/* Chevrons at the screen edge pointing at what the scan turned up and you
   have not reached yet. Spatial rather than a list: no text to be unreadable
   on a phone, and no hierarchy to collapse. The main view is player-up, so
   every bearing goes through the camera's rotation or the arrows point at the
   wrong sky. */
/* ── where an edge arrow is allowed to be ─────────────────────────────────
   Every arrow that points off screen used to pick its own spot, and both of
   them picked badly. The scan's arrows rode an ellipse inset by a flat 74 and
   62, which put the ones pointing up-and-right underneath the panel chart and
   the ones pointing down through the hull bar; one of them clamped its `x`
   against the panel and left its `y` to land wherever it liked.

   So there is one answer to "where does an edge arrow go" now: **a ring**. A
   circle centred on the ship, one radius for every bearing, and the arrow sits
   where the bearing crosses it.

   It was a rectangle first, on the argument that an arrow on a rectangle is
   actually at the edge of the screen where an ellipse floats a third of the
   way in at the corners. That argument was about *where the pixels are* and it
   cost the thing the arrow is for. On a rectangle an arrow's distance from the
   middle depends on its bearing — a corner is 1.6 times further out than
   straight up — so an arrow **slides and jumps as you turn** even though the
   thing it points at has not moved, it crowds into the four corners, which is
   where the HUD lives, and every fix for one of those made another worse.

   A ring has none of that. The arrow moves at a constant rate as the ship
   turns, it is the same size and the same distance out wherever it is, and the
   four corners are left to the interface. It reads as an instrument rather
   than as something stuck to the window.

   And a list of the places the HUD has already taken. If the point lands in
   one, it walks around the ring until it is clear, rather than being drawn
   under a chart where nobody will see it. */
HUD.hudBlocks = st => hudBlocks(st);

function hudBlocks(st) {
  const { SCREEN_W, SCREEN_H } = api;
  const b = panelBox();
  return [
    // Top right: the sector readout and the chart under it, as one column.
    { x: b.x - 12, y: 0, w: SCREEN_W - b.x + 12, h: b.y + b.h + 40 },
    // Top left: cash and storage.
    { x: 0, y: 0, w: 210, h: 118 },
    /* Bottom centre: the hull bar, and above it the one line that holds
       whichever of four warnings is loudest. That line is fitted to
       `SCREEN_W - 380`, so the box it can fill is most of the width — which is
       why arrows pointing down slide out to the sides rather than finding a gap
       in the middle. There is no gap in the middle. */
    { x: SCREEN_W / 2 - (SCREEN_W - 360) / 2, y: SCREEN_H - 78,
      w: SCREEN_W - 360, h: 78 }
  ];
}

function edgePoint(ang, inset) {
  const { SCREEN_W, SCREEN_H } = api;
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  /* The radius is set by the *shorter* half of the screen, so the ring is a
     circle on every shape of window rather than an ellipse that stretches on a
     wide one — the whole point is that a bearing means the same distance out
     whichever way it is pointing. */
  const r = Math.max(40, Math.min(cx, cy) - inset);
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
}

/* The arrow's spot, dragged around the ring until it is out from under the
   interface. Both directions are tried and the nearer answer wins, so an arrow
   never travels further than it has to and never crosses the screen to escape
   a panel it was only just touching. */
function edgeSpot(st, ang, inset) {
  const blocks = hudBlocks(st);
  const inside = p => blocks.some(b => p.x > b.x && p.x < b.x + b.w &&
                                       p.y > b.y && p.y < b.y + b.h);
  const first = edgePoint(ang, inset);
  if (!inside(first)) return { p: first, ang, moved: 0 };
  const STEP = 0.045;
  for (let k = 1; k <= 80; k++) {
    for (const dir of [1, -1]) {
      const a = ang + dir * k * STEP;
      const p = edgePoint(a, inset);
      if (!inside(p)) return { p, ang, moved: k * STEP * dir };
    }
  }
  return { p: first, ang, moved: 0 };
}

/* One arrow, drawn to be seen. Bigger than the old one, never dimmer than
   two thirds, with a tail so it reads as a direction rather than a speck, and
   the range printed *inboard* of it so the label cannot fall off the screen
   the arrow is sitting on the edge of. */
function edgeArrow(st, ang, colour, text, opts) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const o = opts || {};
  const inset = o.inset === undefined ? 46 : o.inset;
  const at = edgeSpot(st, ang, inset);
  /* Where every arrow ended up this frame. The one thing a screenshot cannot
     tell you is whether an arrow is *under* something, so the check for that
     reads this rather than trying to pick arrowheads out of the draw calls. */
  HUD.arrows.push({ x: at.p.x, y: at.p.y, ang, colour,
                    moved: at.moved, label: text || "" });
  const scale = o.scale || 1;
  const beat = o.beat ? 0.82 + 0.18 * Math.abs(Math.sin(Date.now() / 420)) : 1;
  ctx.save();
  ctx.translate(at.p.x, at.p.y);
  ctx.rotate(ang);
  api.glow(colour, 2.4, (o.alpha === undefined ? 1 : o.alpha) * beat, () => {
    const S = scale;
    /* A **V**, for the arrows you actually steer by. Two strokes meeting at a
       point and open behind, which is the shape every heads-up display in the
       world uses for "this way" — it reads as a direction at a glance and at a
       size, and it does not fill in a solid blob of colour over whatever it is
       sitting on at the edge of the screen.

       The barbed solid below is still what the quieter arrows use: a scan
       return is a dot with a direction, not something you are flying at, and
       eight solid chevrons round the ring would be a much louder thing than
       eight small darts. */
    if (o.vee || o.single) {
      ctx.lineWidth = Math.max(2.5, 3.4 * S);
      ctx.lineJoin = "miter";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9 * S, -12 * S);
      ctx.lineTo(15 * S, 0);
      ctx.lineTo(-9 * S, 12 * S);
      ctx.stroke();
      /* A second, smaller one behind it, so the shape has depth and reads as
         motion rather than as a static tick — but only when asked for. One V
         is the plain "that way"; two is the loud one. */
      if (o.vee) {
        ctx.globalAlpha *= 0.5;
        ctx.beginPath();
        ctx.moveTo(-18 * S, -9 * S);
        ctx.lineTo(-3 * S, 0);
        ctx.lineTo(-18 * S, 9 * S);
        ctx.stroke();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(16 * S, 0);            // the point
    ctx.lineTo(2 * S, -6 * S);
    ctx.lineTo(-4 * S, -13 * S);      // the upper barb, swept back
    ctx.lineTo(-6 * S, -5 * S);
    ctx.lineTo(-13 * S, -7 * S);      // and a second, further back again
    ctx.lineTo(-8 * S, 0);
    ctx.lineTo(-13 * S, 7 * S);
    ctx.lineTo(-6 * S, 5 * S);
    ctx.lineTo(-4 * S, 13 * S);
    ctx.lineTo(2 * S, 6 * S);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
  if (!text) return at;
  /* Inboard, along the line back to the middle: at the top of the screen the
     label sits below the arrow and at the bottom it sits above it, without
     either case being written down anywhere. */
  const lx = at.p.x - Math.cos(ang) * 26;
  const ly = at.p.y - Math.sin(ang) * 26 + 5;
  label(text, lx, ly, SIZE.cap, colour, "center", 0.95);
  return at;
}

/* What you are looking for, and which way it is. This is the arrow you fly by
   when the objective is off screen, so it is the loudest thing on the ring: full
   alpha, half again the size, and a range beside it. */
/* The objective's own colour. It was VIOLET, which is the colour of every
   panel, every border and half the interface — the one arrow you are actually
   flying by should not be the same colour as the furniture, and it should not
   be a warning colour either. A light blue nothing else on the flight screen
   uses. */
const OBJECTIVE = "#5fd8ff";

/* A scan is a *pulse*. What it turns up should fade with it rather than
   sitting on the edge of the screen for the rest of the run — an arrow that is
   always there stops being information and becomes furniture, and the one
   thing this ring must never become is furniture.

   So the objective's arrow comes up when you press scan and goes down when the
   returns do. The two things that outlive it are the two you *chose*: a
   a feature you tapped on the chart. */
function scanLit(st) {
  const lit = (st.scan && st.scan.lit) || 0;
  if (lit <= 0) return 0;
  return Math.max(0, Math.min(1, lit / 3));     // the last three seconds fade
}

function drawContacts(st) {
  const { SCREEN_W, SCREEN_H } = api;
  const lit = scanLit(st);
  if (!lit) return;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  /* `+rot`, not `-rot`. The world is drawn with `ctx.rotate(cam.rot)`, so a
     world vector at angle t appears on screen at t + rot; rotating by -rot is
     the screen-to-world direction and points every arrow the wrong way round
     the compass. It could never show while this module was being handed a
     camera of `rot: 0` — which it was, always, because the state never sent
     one — so the sign has been wrong since the arrows were written and this is
     the first frame it has ever mattered. */
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  let n = 0;
  for (const c of (st.contacts || [])) {
    if (c.resolved || n >= 4) continue;
    const wx = c.x - cam.x, wy = c.y - cam.y;
    const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
    const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
    if (px > 60 && px < SCREEN_W - 60 && py > 60 && py < SCREEN_H - 60) continue;
    n++;
    const ang = Math.atan2(sy, sx);
    const dist = Math.round(Math.hypot(wx, wy));
    /* One V, not two. The double is the loud one and it belongs to the
       arrow you *chose* — a thing picked off the chart, which you asked to
       be shown and which stays until you let it go. The manifest's arrow is
       the game telling you where to go next, which is a quieter thing, and
       two of them on the ring at once said they were the same kind of
       instruction. */
    /* A delivery gets a number and a search gets a band. The manifest's
       arrow is pointing at somewhere you are *taking* something, so the
       range is the useful fact; the book's arrow is pointing at somewhere
       you have never been, and a bearing plus an exact range is a position —
       which is the one thing this mode's navigation has never handed over.
       The state says which kind it is; the ring does not guess. */
    edgeArrow(st, ang, OBJECTIVE,
              c.vague ? (c.band || "") : fmtCells(dist) + "u",
              { scale: 1.35, beat: true, single: true, alpha: lit });
  }
}

/* And what a scan turned up. A return that is off screen used to be a dot on
   the panel chart and nothing else — which made the scan a thing you read
   rather than a thing you fly by. Each one gets an arrow in its own colour, on
   the same ring, smaller than the objective because it is a suggestion rather
   than the plan. */
function drawEchoArrows(st) {
  const { SCREEN_W, SCREEN_H } = api;
  if (!st.ship) return;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  let n = 0;
  for (const e of (st.echoes || [])) {
    if (n >= 8) break;
    const wx = e.x - cam.x, wy = e.y - cam.y;
    const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
    const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
    if (px > 60 && px < SCREEN_W - 60 && py > 60 && py < SCREEN_H - 60) continue;
    n++;
    // Fading with the return itself, so the ring empties as the scan goes cold
    // rather than all at once.
    const fade = Math.max(0.55, Math.min(1, (e.t || 0) / 4)) * scanLit(st);
    if (fade <= 0.02) continue;
    /* **The glyph says what kind of thing it is.** The barbed dart is a
       silhouette — it reads as a ship, because it is shaped like one — and
       every return on the ring was wearing it: a hulk, a cache, a gate and a
       pile of ore all pointed at you with a little ship. One shape for two
       dozen meanings teaches nothing, and the one meaning it does suggest was
       wrong for most of them.

       So a ship gets the ship, and a thing gets a V. */
    const isShip = e.kind === "traffic" || e.kind === "patrol" ||
                   e.kind === "hunter"  || e.kind === "distress";
    edgeArrow(st, Math.atan2(sy, sx), e.colour || VIOLET, null,
              { scale: 0.85, alpha: fade, inset: 74, single: !isShip });
  }
}


/* ── something you picked off the chart ───────────────────────────────────
   **The** arrow that stays, and the only one. "I want to know where that is" —
   a station you will need later, the well you are routing around, the memorial
   you mean to come back to. One at a time, in the blue the objective used to own
   outright, and it keeps its arrow until you pick another or tap it again to let
   it go. Everything else on the ring is a pulse and fades like one. */
function drawSelectedArrow(st) {
  const sel = st.selected;
  if (!sel || !st.ship) return;
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  const wx = sel.x - cam.x, wy = sel.y - cam.y;
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
  const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
  const dist = Math.round(Math.hypot(wx, wy));
  const name = shortName(sel.name || "", 14);

  if (px > 30 && px < SCREEN_W - 30 && py > 30 && py < SCREEN_H - 30) {
    // In front of you: say what it is rather than pointing at it.
    ctx.save();
    ctx.strokeStyle = OBJECTIVE;
    ctx.globalAlpha = 0.5 + 0.25 * Math.abs(Math.sin(Date.now() / 520));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    label(name, px, py - 22, SIZE.cap, OBJECTIVE, "center", 0.85);
    return;
  }
  edgeArrow(st, Math.atan2(sy, sx), OBJECTIVE,
            (name ? name + "  " : "") + fmtCells(dist) + "u",
            { scale: 1.2, vee: true, inset: 58 });
}

/* The pulse has no gameplay effect — the contacts are already in the list —
   but without it pressing the key feels like nothing happened, and this mode
   has no gunfire to confirm an input with. */
function drawPulse() {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  if (api.reduceMotion) return;
  const t = 1 - pulse / 1.6;
  ctx.save();
  api.glow(VIOLET, 2, (1 - t) * 0.5, () => {
    ctx.beginPath();
    ctx.arc(SCREEN_W / 2, SCREEN_H / 2,
            t * Math.hypot(SCREEN_W, SCREEN_H) * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/* The only moment the interface is allowed to be loud, and it is over in four
   seconds. Top centre, where the banner already lives. */
/* Drawn under the right-hand column, growing downward. Each line is a rule on
   its left edge and two rows of type — the same figure the logged cards used,
   because that one worked; it is only in a different corner and doing more. */
/* Press one to open it. Press it again to put it away.

   A notification is a line squeezed into the width of a column and shrunk until
   it fits, which is fine for "Cache open" and is a lie for anything with a
   sentence in it — `fitText` will take type down to the 16px floor and then cut
   it with an ellipsis, so the lines that were worth reading were exactly the
   ones you could not. Opening one wraps it properly on a ground you can read it
   against, and shows the detail line that the collapsed form has to abbreviate.

   An open one **stops counting down**. If you pressed it to read it, having it
   fade out from under you would be the interface taking it away mid-sentence —
   so it holds until you close it, and its clock starts again when you do.
   Everything below it shuffles down to make room, which is the same behaviour
   the stack already has when a new line arrives. */
const NOTE_W = () => panelBox().w + 120;

function drawNotes(st) {
  if (!notes.length) return;
  const { ctx } = api;
  const b = panelBox();
  const right = b.x + b.w;
  const wide = NOTE_W();
  // Below the chart, its label and the buttons under it, whichever are there.
  /* Below the chart, the region readout and the inventory button. The 52 is
     the button's own top — it moved down when the region line took a row above
     it, and this has to move with it or the first notification's target sits
     on top of the button's. There was a yard button under it once, and a row
     of height that came and went with it; there is one door into a station
     now and the row is gone with the yard. */
  let y = b.y + b.h + 52 + 30 + 34;
  for (const n of notes) {
    /* An open note is at full strength whatever its clock says — it is not
       fading, it is being read. */
    const a = n.open ? 1
            : Math.min(1, n.t * 2.2) * Math.min(1, (n.life - n.t) * 6);
    if (a <= 0.01) { y += n.sub ? 44 : 28; continue; }

    if (n.open) {
      const lines = wrapLines(n.text, SIZE.cap, wide - 24, "0.08em");
      const subs = n.sub ? wrapLines(n.sub, SIZE.cap, wide - 24) : [];
      const h = 16 + lines.length * 20 + (subs.length ? subs.length * 18 + 6 : 0);
      const x = right - wide;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = INK;
      ctx.fillRect(x, y - 18, wide, h);
      ctx.strokeStyle = n.colour;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 18, wide, h);
      ctx.restore();
      let ly = y;
      for (const line of lines) {
        label(line, x + 12, ly, SIZE.cap, n.colour, "left", 1, "0.08em");
        ly += 20;
      }
      if (subs.length) ly += 6;
      for (const line of subs) {
        label(line, x + 12, ly, SIZE.cap, VIOLET_DIM, "left", 0.85);
        ly += 18;
      }
      tap({ x, y: y - 18, w: wide, h, note: true,
            act: () => { n.open = false; } });
      y += h + 12;
      continue;
    }

    const h = n.sub ? 40 : 24;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = n.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(right, y - 14); ctx.lineTo(right, y - 14 + h);
    ctx.stroke();
    ctx.restore();
    fitText(n.text, right - 12, y, SIZE.cap, n.colour, "right", a, wide,
            "0.08em");
    if (n.sub) {
      fitText(n.sub, right - 12, y + 20, SIZE.cap, VIOLET_DIM, "right",
              a * 0.8, wide);
    }
    /* The whole line is the target, out to the full width the text is allowed
       to use — a right-aligned short line would otherwise be a two-word target
       floating in a column of empty space. */
    tap({ x: right - wide, y: y - 16, w: wide + 6, h: h + 4, note: true,
          act: () => { n.open = true; } });
    y += h + 10;
  }
}
