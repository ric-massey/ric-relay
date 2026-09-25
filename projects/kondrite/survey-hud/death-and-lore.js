"use strict";
/* KONDRITE — SURVEY INTERFACE: YOU DIED, AND WHAT IS THIS
   ─────────────────────────────────────────────────────────────────────────────
   The death page, asking what a thing is, and a world you can land on. */

/* ═══ YOU DIED ════════════════════════════════════════════════════════════
   The one page in the mode that is about what just happened rather than what
   to do next, and the only place a run's numbers are ever stated. It gets the
   whole screen and one way off it.

   Four facts, in the order you want them: what killed you, where you were,
   how long you had been out, and what went down with the ship. The last of
   those is the one that stings, so it is itemised — "you lost 43 units" is a
   number and "you lost 19 iridium" is a memory. */
HUD.drawDeath = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const d = st.death;
  if (!d) return;

  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.restore();

  // A border, closing in, the way the warning that failed to save you did.
  const beat = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 900));
  ctx.save();
  ctx.strokeStyle = WARN;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = (0.06 + beat * 0.08) * (1 - i / 5);
    ctx.lineWidth = 3;
    const inset = 2 + i * 8;
    ctx.strokeRect(inset, inset, SCREEN_W - inset * 2, SCREEN_H - inset * 2);
  }
  ctx.restore();

  const cx = SCREEN_W / 2;
  label("YOU DIED", cx, 148, SIZE.huge, WARN, "center", 1, "0.3em");
  fitText(d.reason, cx, 186, SIZE.val, AMBER, "center", 0.95, SCREEN_W - 200);

  /* The run, as three numbers on one line. Where, how far, how long — the
     three things you will want to say out loud about it. */
  /* The run, as three numbers on one line — the three things you will want to
     say out loud about it. On the page grid's columns rather than a width of
     their own, so they line up with the two panels beneath them. */
  const cols = [
    { cap: "HOW FAR OUT", val: fmtCells(d.dist) + " UNITS" },
    { cap: "SECTOR",      val: d.band },
    { cap: "LASTED",      val: fmtClock(d.lasted) }
  ];
  cols.forEach((c, i) => {
    const col = COL(3, i);
    const x = col.x + col.w / 2;
    label(c.cap, x, 252, SIZE.cap, VIOLET_DIM, "center", 0.7, "0.18em");
    fitText(c.val, x, 284, SIZE.head, VIOLET, "center", 1, col.w - 20);
  });

  /* Two columns, and they are the whole argument of the screen: this is what
     it cost, and this is what you still have. A death screen that lists only
     losses reads as a wipe, and this is not one — the almanac, the yard, the
     chart and the money all survive, and saying so is the difference between
     "start again" and "go back out".

     Each column gets its own half and neither may reach into the other, which
     is not a stylistic point: the worth line used to be right-aligned to the
     box's far edge and printed straight through the right column. */
  /* Two panels, and they are the whole argument of the screen: this is what it
     cost, and this is what you still have. A death screen that lists only
     losses reads as a wipe, and this is not one. They are the page's own two
     columns, so they sit under the three numbers above rather than beside
     them. */
  const carried = (d.hold || []).filter(m => m.n);
  const rowsN = Math.max(4, carried.length + 1);
  const by = 320, bh = PANEL_H(rowsN);
  const L = COL(2, 0), R = COL(2, 1);

  panel(L.x, by, L.w, bh, WARN, "LOST WITH THE SHIP",
        carried.length ? d.lost + " UNITS" : "");
  if (!carried.length) {
    fitText("empty storage — the one mercy", L.x + PAGE.PAD, ROW(by, 0),
            SIZE.cap, VIOLET_LOW, "left", 0.7, L.w - PAGE.PAD * 2);
  } else {
    carried.forEach((m, i) => {
      const y = ROW(by, i);
      ctx.save();
      ctx.fillStyle = m.colour;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(L.x + PAGE.PAD, y - 9, 9, 9);
      ctx.restore();
      fitText(m.name, L.x + PAGE.PAD + 18, y, SIZE.cap, m.colour, "left",
              0.9, L.w - 160, "0.08em");
      label(String(m.n), L.x + L.w - PAGE.PAD, y, SIZE.cap, m.colour, "right", 1);
    });
    fitText("worth about " + hudMoney(d.worth), L.x + PAGE.PAD,
            ROW(by, carried.length), SIZE.cap, WARN, "left", 0.65,
            L.w - PAGE.PAD * 2);
  }

  panel(R.x, by, R.w, bh, CASH_DIM, "STILL YOURS", "NONE OF IT TAKEN");
  [d.cash + " CASH",
   d.found + " ALMANAC " + (d.found === 1 ? "ENTRY" : "ENTRIES"),
   fmtCells(d.charted) + " CELLS CHARTED",
   "your station and everything fitted"
  ].forEach((k, i) => {
    label("·", R.x + PAGE.PAD, ROW(by, i), SIZE.cap, CASH_DIM, "left", 0.6);
    fitText(k, R.x + PAGE.PAD + 16, ROW(by, i), SIZE.cap, CASH_DIM, "left",
            0.8, R.w - PAGE.PAD * 2 - 20);
  });

  /* Not lost and not kept: still out there. A part you were carrying stays
     exactly where you died and is on the chart by name, and this is the line
     that says so — because a part that vanished from your hold with no
     explanation reads as a bug, and a trip you have to make reads as a trip
     only if somebody tells you to make it. */
  if (d.dropped && d.dropped.length) {
    const line = d.dropped.join("  \u00b7  ");
    label("STILL OUT THERE", cx, by + bh + 30, SIZE.cap, AMBER, "center",
          0.9, "0.2em");
    fitText(line + "  \u2014  where you fell, on the chart, waiting",
            cx, by + bh + 54, SIZE.cap, AMBER_DIM, "center", 0.85,
            SCREEN_W - PAGE.EDGE * 2);
  }

  /* Under whichever of the two lines above is showing, so the two cannot
     print through each other on a run where both are true. */
  if (st.deaths > 1) {
    const dy = (d.dropped && d.dropped.length) ? 82 : 28;
    label("DEATH " + st.deaths, cx, by + bh + dy, SIZE.cap, VIOLET_LOW,
          "center", 0.6, "0.2em");
  }

  button(api.touchOnly ? "BACK TO THE STATION"
                      : "BACK TO THE STATION   [ENTER]",
         cx, SCREEN_H - 44, 420, 46, HUD_CASH, st.onRespawn || (() => {}));
};

/* ═══ WHAT IS THIS ════════════════════════════════════════════════════════
   The card you get for pressing `E` on something with a name. The one page in
   this mode that is only words, and it is deliberately only words: the thing
   itself is out there on the screen behind it, drawn at the size it really is,
   so a picture of it here would be a worse copy of something you are already
   looking at.

   It is a card rather than a page — no navigation strip, no tabs, nothing to do
   on it. You asked a question and this is the answer, and anything you press
   closes it. A card with buttons on it is a page, and a page is a place you
   have to leave rather than something that gets out of your way.

   The world keeps running behind it, and at 0.88 alpha you can see it doing so.
   That is on purpose: this is read in flight, and a screen that hid the rock
   coming at you while it explained a monument would be a trap. */
HUD.drawLore = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const card = st.lore;
  if (!card) return;
  const colour = card.colour || VIOLET;

  pageFrame(card.name, card.kind,
            api.touchOnly ? "TAP ANYWHERE TO CLOSE" : "E, OR ESC, CLOSES");

  /* One column, left-aligned, no wider than about seventy characters. Centred
     prose reads as a poem and full-width prose on a 1,680-wide screen is a line
     your eye loses its place in on the way back. */
  const colW = Math.min(SCREEN_W - PAGE.EDGE * 2, 860);
  const x = Math.round((SCREEN_W - colW) / 2);

  // The kind, stated once in its own colour, so the card is identifiable in
  // half a second by something other than reading it.
  label(card.kind, x, 150, SIZE.head, colour, "left", 1, "0.2em");
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 166); ctx.lineTo(x + colW, 166);
  ctx.stroke();
  ctx.restore();

  /* The first line of any card is the one-sentence answer — what this thing
     *is* — so it is drawn bigger than the rest. Everything after it is why you
     might care, and it reads at caption size like the rest of the interface.

     The whole block is measured before it is drawn and then floated in the
     space between the rule and the footer, because these cards run from three
     lines to eleven and a fixed top would leave the short ones stranded against
     the ceiling. */
  const lead = SIZE.head, body = SIZE.val;
  const leadStep = 30, bodyStep = 26, gap = 16;
  const blocks = (card.lines || []).map((t, i) => ({
    lines: wrapLines(t, i === 0 ? lead : body, colW),
    size: i === 0 ? lead : body,
    step: i === 0 ? leadStep : bodyStep
  }));
  /* A card with nothing to say draws its heading and stops. Every builder in
     the game supplies lines, so this is not reachable today — but the next one
     that forgets would not draw a short card, it would throw out of the render
     loop on `blocks[0]` and take the whole frame with it. A black screen is a
     long way to fall for a missing sentence. */
  if (!blocks.length) { closeButton(st.onClose); return; }
  const tall = blocks.reduce((h, b) => h + b.lines.length * b.step + gap, 0) - gap;
  const top = 196;
  const room = SCREEN_H - 76 - top;
  let y = top + Math.max(0, Math.round((room - tall) / 2)) + blocks[0].step;

  blocks.forEach((b, i) => {
    for (const line of b.lines) {
      label(line, x, y, b.size, i === 0 ? colour : VIOLET,
            "left", i === 0 ? 1 : 0.88);
      y += b.step;
    }
    y += gap;
  });

  // Anything at all. It is an answer, not a form.
  tap({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, act: st.onClose || (() => {}) });
};

/* ═══ A WORLD YOU CAN LAND ON ═════════════════════════════════════════════
   About one world in twenty has somebody on it, and what they have is water
   and food. Deliberately not a station: no cargo bought, no refits sold, no
   almanac verbs — a station is a shipyard and this is a village with a well.
   Keeping the two apart is what makes finding a station matter.

   The page is small on purpose. It answers "can I fill up here, and what will
   it cost", and then it gets out of the way. */
/* An inhabited world is a market with weather. Same page as a station, and
   deliberately so: what you want to know on arriving anywhere with people in
   it is what they will give you for the hold and what they have on the shelf.

   What the globe and the two fill buttons used to say is all still here, as
   rows — the water, the food, and the one thing this rock is made of — and the
   free option is the footer, because a player who cannot afford the water is
   the only one who needs it and they need one line, not a paragraph. */
HUD.drawLanded = function (st, dt) {
  st = st || {};
  const w = st.landed;
  if (!w) return;
  marketPage(st, w.name,
             w.band + "   \u00b7   " + (st.cash || 0) + " CASH",
             w.air ? "the atmosphere can be skimmed for water \u2014 slow, and free"
                   : "airless, and lived in anyway",
             "refit", st.onClose || (() => {}), PLACE_TABS);
};
