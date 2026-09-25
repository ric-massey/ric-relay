"use strict";
/* KONDRITE — SURVEY INTERFACE: THE SHIP
   ─────────────────────────────────────────────────────────────────────────────
   The ship page and the cargo page. */

/* ═══ THE SHIP ════════════════════════════════════════════════════════════
   Storage and the loadout were two pages about the same object, and reading one
   while deciding the other meant leaving and coming back. They are one page
   now, and it scrolls — which is the only honest way to fit four slots, a hold,
   a purse, three powers' opinions of you and a book on a phone.

   The order is deliberate and it is the order you ask the questions in:

     what am I flying      the four slots, and what is fitted in them
     what have I got       cash, storage, and what each thing is worth
     who am I to them      the three powers, explained
     what have I seen      the almanac, as a book you open

   Everything is a band the full width of the page rather than two columns,
   because a column that has to be read against another column is two things to
   read and a phone has room for one. */
let shipPg = { scroll: 0 };
HUD.shipScrollBy = function (dy, total, view) {
  const max = Math.max(0, total - view);
  shipPg.scroll = Math.max(0, Math.min(max, shipPg.scroll + dy));
};
HUD.shipOpened = function () { shipPg.scroll = 0; bubble = null; };

/* ═══ THE SHIP ════════════════════════════════════════════════════════════
   What you are flying and what is bolted to it. Nothing else: no ore, no ice,
   none of the things that are merely *in* it. This page is one job — putting
   parts on a ship — and everything on it serves that job, which is why the
   spares are here too. You cannot drag a part into a slot from a page the
   slots are not on. */
HUD.drawShip = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const cash = st.cash || 0, cap = st.hold || 1;
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const slots = st.slots || [null, null, null, null];

  /* The hull's own name, where the word INVENTORY used to be. This page is
     about one particular ship and which one is the first thing it should
     say — and it is no longer the page the cargo lives on. */
  pageFrame(st.shipName || "SHIP", hudMoney(cash), "", SHIP_TONE);
  // Before anything else the page draws. See `closeOnMiss`.
  if (bubble) closeOnMiss(() => { bubble = null; });

  /* The ship does not scroll. It is what the page is *about* — the four
     squares you are dragging towards — and it used to slide off the top the
     moment you reached for anything in the second row of the tray, which is
     the one moment you need to see where you are aiming.

     So the hull and its slots are drawn first, pinned, outside any clip, and
     the tray below gets a scrolling window of its own. Scrolling this page
     means scrolling the parts aboard and nothing else. */
  let y = PAGE.TOP;
  const gap = PAGE.STEP;
  const used = st.carried || 0;
  const crate = st.store || [];
  const freeSlot = slots.findIndex(x => !x);
  /* The column count comes from the longest name in the tray, not from a
     constant. A name is centred under its picture and one word cannot be
     wrapped, so a fixed six columns cut REVERSE THRUSTERS to "REVERSE
     THRUS…" — and `fitText` will not go below 16px, so shrinking it was
     never on the table. Fewer, wider tiles instead: the same rule the cargo
     grid uses, for the same reason. */
  const longest = crate.reduce((w, e) => Math.max(w,
    String(e.name).split(" ").reduce(
      (m, word) => Math.max(m, widthOf(word, SIZE.cap, "0.04em")), 0)), 0);
  const want = Math.max(api.touchOnly ? 90 : 84, Math.ceil(longest) + 12);
  const cw = Math.max(2, Math.min(api.touchOnly ? 4 : 6,
                      Math.floor((full.w - PAGE.PAD * 2 + 10) / (want + 10))));
  const cCell = Math.floor((full.w - PAGE.PAD * 2 - (cw - 1) * 10) / cw);
  const cRows = Math.max(1, Math.ceil(crate.length / cw));
  const matsH = 0;
  /* 42 below a tile, not 26: a two-word name wraps onto a second line now
     rather than being cut, and the row has to make room for the line. */
  const NAME_H = 42;
  const holdH = 30 + cRows * (cCell + NAME_H) + 10 + PAGE.HEAD;

  /* ── the ship ─────────────────────────────────────────────────────────
     The page is a picture of the thing it is about. It used to be three
     stacked panels of rows — the same furniture the shop is built out of — so
     the one page that is unmistakably *yours* was laid out exactly like a page
     about somebody else's counter, and the only way to tell them apart was to
     read the title.

     The hull is drawn in the middle at whatever size the band has room for,
     with its four slots hung around it and a lead running from each one in. A
     slot stops being the fourth column of a table and becomes a place on the
     ship — which is what it always was, since you fit a part by dragging it
     there. The boxes are still remembered in `slotBoxes`, so what you can drop
     onto is the same rectangle you can see. */
  const cxShip = SCREEN_W / 2;
  const BAND = 244, SBOX = 72, ARM = 232;
  const cyShip = y + 118;
  const seats = [[-ARM, -112], [ARM, -112], [-ARM, 28], [ARM, 28]];
  const anyFitted = slots.some(x => !!x);

  slotBoxes.length = 0;
  for (let i = 0; i < 4; i++) {
    const real = slots[i];
    /* Lifted out of its square, it should not also be drawn sitting in it —
       the same rule the tray's tiles follow while one is in hand. Only the
       drawing sees the slot as empty; `slotBoxes` keeps the truth. */
    const lifting = !!(carry && carry.moved && carry.slot === i);
    const sl = lifting ? null : real;
    const bx = cxShip + seats[i][0] - SBOX / 2;
    const by = cyShip + seats[i][1];
    const fitting = !!sl && sl.fit > 0;
    /* An empty slot takes the dim violet rather than the low one. `VIOLET_LOW`
       is for a thing you cannot use — a tab that is not live, a part nobody
       sells — and an empty slot is the opposite of that: it is the one place
       on this page you are being invited to put something. Drawn at the same
       weight as "unavailable", four of them read as four refusals. */
    const col = !sl ? VIOLET_DIM : fitting ? AMBER_DIM : rarity(sl.rarity).colour;
    const over = carry && carry.over === i;
    /* What is in it travels with the rectangle, because a slot is now
       something you can pick *up* as well as drop onto — `grabAt` has to know
       what it would be taking hold of. */
    slotBoxes.push({ x: bx, y: by, w: SBOX, h: SBOX, i,
                     key: real ? real.key : null, name: real ? real.name : "",
                     cat: real ? real.cat : null,
                     rarity: real ? real.rarity : null });

    // The lead in to the hull, so a slot reads as part of the ship and not as
    // a box that happens to be near one.
    ctx.save();
    ctx.strokeStyle = sl ? col : VIOLET_DIM;
    ctx.globalAlpha = sl ? 0.4 : 0.34;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + (seats[i][0] < 0 ? SBOX : 0), by + SBOX / 2);
    ctx.lineTo(cxShip + (seats[i][0] < 0 ? -52 : 52), cyShip);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = over ? 0.22 : sl ? 0.1 : 0.07;
    ctx.fillStyle = over ? HUD_CASH : col;
    ctx.fillRect(bx, by, SBOX, SBOX);
    ctx.globalAlpha = over ? 1 : sl ? 0.85 : 0.62;
    ctx.strokeStyle = over ? HUD_CASH : col;
    ctx.lineWidth = over ? 2.5 : sl ? 1.5 : 1;
    // An empty slot is a dashed outline: an opening, rather than a box with
    // nothing in it.
    if (!sl && ctx.setLineDash) ctx.setLineDash([5, 4]);
    ctx.strokeRect(bx, by, SBOX, SBOX);
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.restore();

    if (sl) {
      drawPartIcon(sl.cat, bx + SBOX / 2, by + SBOX / 2, SBOX * 0.28,
                   fitting ? AMBER_DIM : col, fitting ? 0.6 : 1);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = VIOLET_DIM;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + SBOX / 2 - 8, by + SBOX / 2);
      ctx.lineTo(bx + SBOX / 2 + 8, by + SBOX / 2);
      ctx.moveTo(bx + SBOX / 2, by + SBOX / 2 - 8);
      ctx.lineTo(bx + SBOX / 2, by + SBOX / 2 + 8);
      ctx.stroke();
      ctx.restore();
    }

    fitText(sl ? sl.name : "EMPTY", bx + SBOX / 2, by + SBOX + 18, SIZE.cap,
            col, "center", sl ? 1 : 0.7, ARM - 30, "0.06em");
    if (fitting) {
      fitText("FITTING  " + Math.ceil(sl.fit) + "s", bx + SBOX / 2,
              by + SBOX + 36, SIZE.cap, AMBER_DIM, "center", 1, ARM - 30);
      barAt(bx - 10, by + SBOX + 44, SBOX + 20, 5,
            1 - sl.fit / Math.max(1, sl.of), AMBER_DIM);
    }
    if (sl) {
      tap({ x: bx, y: by, w: SBOX, h: SBOX,
            act: () => st.onPull && st.onPull(i) });
    }
  }

  // The hull last, over the leads.
  const flying = (st.ships || []).find(sh => sh.flying);
  if (flying) drawHull(flying, cxShip, cyShip, 50, AMBER, 0.95);
  /* One line, in the gap between the two lower slots. It has the width of
     that gap and no more, so it says one thing: the longer version ran out of
     room and ended in an ellipsis, which is the worst way for a hint to
     arrive. */
  fitText(anyFitted ? (api.touchOnly ? "TAP A SLOT TO PULL IT"
                                     : "CLICK A SLOT TO PULL IT")
                    : "DRAG A PART INTO A SLOT",
          cxShip, cyShip + 84, SIZE.cap, AMBER_DIM, "center", 0.6, ARM * 1.6);
  y += BAND;

  /* ── the tray's heading, pinned with the ship ─────────────────────────
     The rule, the words and the capacity all stay put. They are the label on
     the window rather than something inside it, and a heading that scrolls
     away takes the one number you are scrolling *because of* with it — the
     whole question is "have I room for this", and the answer was leaving the
     screen exactly when you started asking. */
  // The tray draws its own heading and rule; a panel round it was a second
  // one saying the same words directly above.
  /* A rule across the panel rather than a second frame: the parts are in the
     same hold, and two frames would say they were not. */
  const headY = y + matsH;
  ctx.save();
  ctx.strokeStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(full.x + PAGE.PAD, headY + 2);
  ctx.lineTo(full.x + full.w - PAGE.PAD, headY + 2);
  ctx.stroke();
  ctx.restore();
  label("PARTS ABOARD", full.x + PAGE.PAD, headY + 20, SIZE.cap, HUD_CASH,
        "left", 0.8, "0.14em");
  /* What they are costing you, which is the whole reason they are on this
     panel. Not a count — a count is what the tiles already are. */
  /* "OR CLICK IT" was still here, on the desktop half of the line only, from
     when a press fitted the part. A press opens the tile's description now —
     see the tap below — so the line was promising a thing the page does not
     do, and somebody following it presses a tile, gets a card, and concludes
     the page is broken. One instruction, true on both. */
  label(crate.length
    ? (st.partWeight || 0) + " OF " + (st.hold || 0) + " CARGO SLOTS  \u00b7  " +
      "DRAG ONE INTO A SLOT"
    : "NONE",
    full.x + full.w - PAGE.PAD, headY + 20, SIZE.cap,
    crate.length ? CASH_DIM : VIOLET_LOW, "right", 0.75, "0.08em");

  /* ── and now the part that scrolls ────────────────────────────────────
     The tiles, and only the tiles, in a window that starts under the heading
     and runs to the bottom of the page.

     This is what the page is for: the ship is the thing you are aiming at and
     the tray is the thing you are looking through, so the ship stays and the
     tray moves. It was one scroll over the whole page — reach for anything in
     the second row and the four squares you were dragging towards slid off
     the top, which is the one moment you need to see where you are aiming. */
  /* ── what you own and are not flying ──────────────────────────────────────
     Boxes with pictures in them, laid out like the parts page, rather than a
     list of rows. Two reasons, and the second is the one that matters:

     A row is a *label*. The four slots above are squares with a picture in
     each, so the thing you are dragging and the place you are dragging it to
     were drawn in two completely different languages — you had to work out that
     the line of text and the empty square were the same kind of object.

     And a box is a thing you can pick up. A row with a button on the end of it
     says "press the button"; a tile with a picture on it says "this is an
     object, take it". The gesture was already there and nothing about the
     drawing invited it. */
  const viewTop = headY + 26;
  const viewH = SCREEN_H - viewTop - 16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewTop, SCREEN_W, viewH);
  ctx.clip();
  tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });
  // Where a part dragged off the ship can be dropped. See `dropAt`.
  trayBox = { x: 0, y: viewTop, w: SCREEN_W, h: viewH };

  const partsY = headY - shipPg.scroll;
  y = partsY;
  storeRows.length = 0;
  crate.forEach((e, i) => {
    const col = i % cw, row = Math.floor(i / cw);
    const bx = full.x + PAGE.PAD + col * (cCell + 10);
    const by = partsY + 30 + row * (cCell + NAME_H);
    const can = freeSlot >= 0 && !e.fitted;
    const rar = rarity(e.rarity);

    /* Where this tile is, so a press on it can pick the part up. Only ones you
       could actually fit are draggable: dragging something already on the ship
       to a slot it is already in is a gesture with no meaning. */
    if (can) {
      storeRows.push({ x: bx, y: by, w: cCell, h: cCell + NAME_H - 8,
                       key: e.key, name: e.name, cat: e.cat,
                       rarity: e.rarity });
    }
    // Dragged out of its box, it should not also be drawn sitting in it.
    if (carry && carry.key === e.key && carry.moved) return;

    ctx.save();
    ctx.fillStyle = e.fitted ? VIOLET_LOW : rar.colour;
    ctx.globalAlpha = e.fitted ? 0.08 : 0.22;
    ctx.fillRect(bx, by, cCell, cCell);
    ctx.strokeStyle = e.fitted ? VIOLET_LOW : rar.colour;
    ctx.globalAlpha = e.fitted ? 0.5 : 0.95;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, cCell, cCell);
    ctx.restore();

    drawPartIcon(e.cat, bx + cCell / 2, by + cCell / 2, cCell * 0.3,
                 e.fitted ? VIOLET_LOW : rar.colour, e.fitted ? 0.5 : 1);
    if (e.n > 1) {
      label("×" + e.n, bx + cCell - 5, by + 16, SIZE.cap, CASH_DIM,
            "right", 0.9);
    }
    // What one of them costs the hold, bottom-left, opposite the count.
    if (e.weight) {
      label(String(e.weight), bx + 5, by + cCell - 5, SIZE.cap, VIOLET_DIM,
            "left", 0.75);
    }
    if (e.fitted) {
      label("ON SHIP", bx + cCell / 2, by + cCell - 8, SIZE.cap, VIOLET_LOW,
            "center", 0.8);
    }
    /* Wrapped, not cut. REVERSE THRUSTERS came out "REVERSE THRUS…" —
       `fitText` will not go below 16px, so a name too wide for its tile could
       only ever lose its end, and the end is the half that says which one it
       is. The tile is sized above to hold the longest single word; this puts
       the second word on its own line. */
    wrapLines(e.name, SIZE.cap, cCell + 8, "0.04em").slice(0, 2)
      .forEach((ln, k) => {
        label(ln, bx + cCell / 2, by + cCell + 15 + k * 17, SIZE.cap,
              e.fitted ? VIOLET_LOW : rar.colour, "center",
              e.fitted ? 0.6 : 0.95, "0.04em");
      });

    /* Pressing a tile says what it is. Fitting it is the *drag* — which is the
       gesture the four squares above are asking for — so a press is free to
       mean "tell me about this", which is the question a picture cannot answer
       on its own. */
    tap({ x: bx, y: by, w: cCell, h: cCell + NAME_H - 8,
          act: () => {
            bubble = (bubble && bubble.key === e.key)
              ? null
              : { key: e.key, x: bx + cCell / 2, y: by, e };
          } });
  });

  y += holdH - PAGE.HEAD + gap;

  ctx.restore();
  tapClipOff();

  /* ── what the part is ────────────────────────────────────────────────
     Outside the tray's scroll clip, so a card opened on the top row is not
     sliced off by the window its tile lives in — the same rule the cargo
     grid's card follows, and it became necessary here the moment the tray
     stopped being the whole page. The anchor still moves with the scroll,
     because the tile does. */
  if (bubble && crate.some(q => q.key === bubble.key)) {
    const e2 = crate.find(q => q.key === bubble.key);
    const bw2 = Math.min(360, full.w - PAGE.PAD * 2);
    const lines = wrapLines(e2.note || "", SIZE.cap, bw2 - 24);
    const bh2 = 44 + lines.length * 20 + 20;
    const bx2 = Math.max(full.x + PAGE.PAD,
                  Math.min(bubble.x - bw2 / 2, full.x + full.w - PAGE.PAD - bw2));
    const above = bubble.y - bh2 - 10 > PAGE.TOP;
    const by2 = above ? bubble.y - bh2 - 10 : bubble.y + cCell + 30;
    const rar2 = rarity(e2.rarity);
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = INK;
    ctx.fillRect(bx2, by2, bw2, bh2);
    ctx.strokeStyle = rar2.colour;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx2, by2, bw2, bh2);
    ctx.restore();
    fitText(e2.name, bx2 + 12, by2 + 24, SIZE.val, rar2.colour, "left", 1,
            bw2 - 120, "0.06em");
    label(e2.rarity.toUpperCase(), bx2 + bw2 - 12, by2 + 24, SIZE.cap,
          rar2.colour, "right", 0.8, "0.1em");
    lines.forEach((line, i) => {
      label(line, bx2 + 12, by2 + 48 + i * 20, SIZE.cap, VIOLET_DIM, "left", 0.9);
    });
    /* The foot of the card: what it costs the hold on the right, and what
       the part is doing — or how long it would take to fit — on the left.

       Two labels on one baseline in a 360-wide box, and they used to collide.
       "DRAG IT INTO A SLOT" and "3 CARGO SLOTS" want 348 of the 336 there
       are, so the two were drawn straight through each other. The instruction
       went: it is already printed along the top of this panel, two lines above
       the card, and the card's job is the things the panel cannot say. What is
       left is short — and measured anyway, because a longer weight line would
       put the collision back. */
    const foot = e2.weight
      ? e2.weight + " CARGO SLOTS" +
        (e2.n > 1 ? "  ·  " + e2.held + " ALL TOLD" : "")
      : "";
    const lead = e2.fitted ? "ON SHIP"
               : st.docked ? "" : e2.secs + "s TO FIT";
    if (foot) {
      label(foot, bx2 + bw2 - 12, by2 + bh2 - 12, SIZE.cap, VIOLET_DIM,
            "right", 0.8, "0.08em");
    }
    if (lead && widthOf(lead, SIZE.cap, "0.08em") +
                widthOf(foot, SIZE.cap, "0.08em") < bw2 - 32) {
      label(lead, bx2 + 12, by2 + bh2 - 12, SIZE.cap,
            e2.fitted ? VIOLET_LOW : HUD_CASH, "left", 0.85, "0.08em");
    }
    // The card itself closes it, the tile that opened it closes it, and so
    // does anywhere else on the page — see `closeOnMiss` at the top of this.
    tap({ x: bx2, y: by2, w: bw2, h: bh2, act: () => { bubble = null; } });
  }

  /* Measured from the top of the *tray's* window, not the page's. It used to
     be `- PAGE.TOP`, which was right while the whole page scrolled and is an
     over-count of one ship band now — the scrollbar would have claimed there
     was 244px more to see than there is, and the tray would have scrolled
     past its own last row. */
  const total = (y + shipPg.scroll) - viewTop;
  shipPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH), shipPg.scroll));
  HUD.shipHeight = total;
  HUD.shipView = viewH;
  if (total > viewH) {
    scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
               shipPg.scroll / Math.max(1, total - viewH));
  }

  pageNav(st, "ship", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
  drawCarry();
};

/* ═══ THE CARGO ═══════════════════════════════════════════════════════════
   Everything aboard, in one grid of squares. A cell is a thing: its picture,
   how many of it, and what it is called. Ore and parts in the same frame,
   because they are in the same hold and weigh against the same number — that
   was settled a long time ago and the rows kept pretending otherwise.

   A part bolted to the ship is here too, and greyed, marked ATTACHED. It
   costs no room — fitting one takes it out of the hold — but leaving it off
   this page meant the only view of everything you own was missing the four
   things you chose most carefully. */
let cargoPg = { scroll: 0 };
/* Which cell is open, and where it was drawn so the card can sit against it.
   Matched back by `id` every frame rather than held as a reference: the hold
   changes under you — a mote picked up, a part fitted — and a card holding a
   stale object would go on describing something you no longer have. */
let cargoPick = null;
HUD.cargoOpened = function () { cargoPg.scroll = 0; cargoPick = null; };
HUD.cargoScrollBy = function (dy, total, view) {
  const max = Math.max(0, total - view);
  cargoPg.scroll = Math.max(0, Math.min(max, cargoPg.scroll + dy));
};

HUD.drawInventory = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const cash = st.cash || 0, cap = st.hold || 1;
  const used = st.carried || 0;
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const mats = (st.materials || []).filter(m => m.n > 0);
  const crate = (st.store || []).filter(e => e.n > 0);
  const slots = st.slots || [];

  pageFrame("CARGO", (st.shipName || "") + "   ·   " + hudMoney(cash), "",
            SHIP_TONE);
  // Before anything else the page draws. See `closeOnMiss`.
  if (cargoPick) closeOnMiss(() => { cargoPick = null; });

  // How full, as a bar. "41 / 60" is a fact; this is the feeling of it.
  const frac = Math.min(1, used / Math.max(1, cap));
  label(used + " / " + cap + "  CARGO SLOTS", full.x, PAGE.TOP + 8, SIZE.cap,
        frac > 0.92 ? AMBER : AMBER_DIM, "left", 0.9, "0.1em");
  barAt(full.x, PAGE.TOP + 18, full.w, 8, frac,
        frac > 0.92 ? AMBER : HUD_CASH, frac > 0.92);

  /* One list, three kinds of thing, in the order they matter: what you dug
     up, what you are carrying spare, and what is already on the ship. */
  const cells = mats.map(m => ({
    kind: "mat", id: "m:" + m.key, key: m.key, name: m.name,
    colour: m.colour, n: m.n, note: m.note, where: m.where,
    value: m.value, price: m.price, buys: m.buys
  })).concat(crate.map(e => ({
    kind: "part", id: "p:" + e.key, key: e.key, name: e.name, cat: e.cat,
    colour: rarity(e.rarity).colour, n: e.n, note: e.note,
    rarity: e.rarity, weight: e.weight, held: e.held, secs: e.secs
  }))).concat(slots.filter(sl => !!sl).map(sl => ({
    kind: "fitted", id: "f:" + sl.key, key: sl.key, name: sl.name,
    cat: sl.cat, colour: rarity(sl.rarity).colour, n: 1, note: sl.note,
    rarity: sl.rarity, attached: true, fit: sl.fit
  })));

  const viewTop = PAGE.TOP + 34;
  const viewH = SCREEN_H - viewTop - 20;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewTop, SCREEN_W, viewH);
  ctx.clip();
  tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });

  /* The cell is square and its size is the content's, not a constant. A name
     is one or two words centred under the picture, and a word cannot be
     wrapped — so a cell narrower than the longest single word in the hold
     draws that word out through its own side. ELECTRONICS and OVERBURNER
     both did. The 16px floor is the whole module's rule and shrinking the
     caption would only move the lie somewhere else, so the square grows
     instead: every cell the same size, wide enough for the widest word
     aboard, and the row wraps sooner on a narrow screen.

     Squares, not just wide boxes — the grid reads as a grid. */
  const CGAP = 8;
  const widestWord = cells.reduce((w, c) => Math.max(w,
    String(c.name).split(" ").reduce(
      (m, word) => Math.max(m, widthOf(word, SIZE.cap, "0.02em")), 0)), 0);
  const CELL = Math.max(api.touchOnly ? 104 : 96, Math.ceil(widestWord) + 14);
  const cols = Math.max(1, Math.floor((full.w + CGAP) / (CELL + CGAP)));
  const lead = full.x + (full.w - (cols * CELL + (cols - 1) * CGAP)) / 2;

  if (!cells.length) {
    fitText("Nothing aboard.", full.x, viewTop + 34, SIZE.cap,
            VIOLET_DIM, "left", 0.6, full.w);
  }

  cells.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const bx = lead + col * (CELL + CGAP);
    const by = viewTop + 10 + row * (CELL + CGAP) - cargoPg.scroll;
    if (by > viewTop + viewH || by + CELL < viewTop) return;
    const on = c.kind === "fitted";

    ctx.save();
    ctx.fillStyle = c.colour;
    ctx.globalAlpha = on ? 0.05 : 0.12;
    ctx.fillRect(bx, by, CELL, CELL);
    ctx.strokeStyle = c.colour;
    ctx.globalAlpha = on ? 0.4 : 0.8;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, CELL, CELL);
    ctx.restore();

    /* Bolted on rather than stowed. Its own word along the top, so the cell
       can still say *which* part it is — the name is the thing you are
       looking for and ATTACHED is the thing you need to know about it. */
    if (on) {
      label("ATTACHED", bx + CELL / 2, by + 15, 11, VIOLET_LOW, "center",
            0.9, "0.1em");
    }

    // The picture, the way it is drawn everywhere else in the mode.
    if (c.kind === "mat") {
      drawMatIcon(c.key, bx + CELL / 2, by + CELL / 2 - 8, 13, c.colour,
                  on ? 0.4 : 1);
    } else {
      drawPartIcon(c.cat, bx + CELL / 2, by + CELL / 2 - 8, 13, c.colour,
                   on ? 0.4 : 1);
    }

    /* The count, top corner. It used to sit at the foot of the cell, on the
       same line the name starts on — so ELECTRONICS and REACTOR CORE were
       drawn straight through their own stack count. Up here it is clear of
       both the picture and the name however long the name runs. */
    if (c.n > 1) {
      label("×" + c.n, bx + CELL - 7, by + 16, SIZE.cap,
            c.colour, "right", on ? 0.5 : 1);
    }
    /* Wrapped onto a second line rather than shrunk: `fitText` will not go
       below 16px, so a long name inside a square can only ever be cut. The
       square is sized above to hold the longest word, so this always fits. */
    wrapLines(c.name, SIZE.cap, CELL - 10, "0.02em").slice(0, 2)
      .forEach((ln, k, a) => {
        label(ln, bx + CELL / 2, by + CELL - 24 + k * 17 + (a.length === 1 ? 9 : 0),
              SIZE.cap, on ? VIOLET_LOW : c.colour, "center",
              on ? 0.7 : 0.9, "0.02em");
      });

    /* Press it to find out what it is. A grid of pictures is only readable
       if the pictures can be asked what they mean — and the one place a
       player decides whether a thing is worth the room it takes is looking
       straight at it. */
    tap({ x: bx, y: by, w: CELL, h: CELL,
          act: () => {
            cargoPick = cargoPick && cargoPick.id === c.id
              ? null : { id: c.id, x: bx, y: by + cargoPg.scroll };
          } });
  });

  ctx.restore();
  tapClipOff();

  /* ── what it is ───────────────────────────────────────────────────────
     Outside the scroll clip, so a card opened on the bottom row is not cut
     in half by the window its cell lives in. */
  const open = cargoPick && cells.find(c => c.id === cargoPick.id);
  if (open) {
    const rar = open.kind === "mat" ? null : rarity(open.rarity);
    const tint = rar ? rar.colour : open.colour;
    const bw = Math.min(440, full.w - PAGE.PAD * 2);
    const lines = wrapLines(open.note || "", SIZE.cap, bw - 24);
    const extra = open.kind === "mat" && open.where
      ? wrapLines("Found: " + open.where, SIZE.cap, bw - 24) : [];
    const bh = 46 + (lines.length + extra.length) * 20 + 26;
    const cardX = Math.max(full.x, Math.min(cargoPick.x + CELL / 2 - bw / 2,
                                            full.x + full.w - bw));
    const anchorY = cargoPick.y - cargoPg.scroll;
    const below = anchorY + CELL + 8 + bh < SCREEN_H - 16;
    const cardY = below ? anchorY + CELL + 8 : Math.max(PAGE.TOP, anchorY - bh - 8);

    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.fillStyle = INK;
    ctx.fillRect(cardX, cardY, bw, bh);
    ctx.strokeStyle = tint;
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX, cardY, bw, bh);
    ctx.restore();

    fitText(open.name, cardX + 12, cardY + 26, SIZE.val, tint, "left", 1,
            bw - 130, "0.06em");
    label(open.kind === "mat" ? "ORE" : (open.rarity || "").toUpperCase(),
          cardX + bw - 12, cardY + 26, SIZE.cap, tint, "right", 0.8, "0.1em");
    lines.concat(extra).forEach((ln, i) => {
      label(ln, cardX + 12, cardY + 50 + i * 20, SIZE.cap, VIOLET_DIM,
            "left", 0.9);
    });

    /* The bottom line is the one a player is actually here for: what it is
       worth, or what it is costing to carry. */
    const foot = open.kind === "mat"
      ? (open.buys === false ? "this place doesn't buy these"
         : (open.price == null ? open.value : open.price) + " each" +
           (open.price != null && open.price > open.value ? "  ·  over the odds" : ""))
      : open.kind === "fitted"
        ? (open.fit > 0 ? "FITTING  " + Math.ceil(open.fit) + "s"
                        : "on the ship  ·  takes no room")
        : open.weight + " CARGO SLOTS" +
          (open.n > 1 ? "  ·  " + open.held + " ALL TOLD" : "");
    label(foot, cardX + 12, cardY + bh - 13, SIZE.cap,
          open.kind === "fitted" ? VIOLET_LOW : HUD_CASH, "left", 0.9, "0.06em");
    if (open.n > 1) {
      label("×" + open.n, cardX + bw - 12, cardY + bh - 13, SIZE.cap,
            open.colour, "right", 0.85);
    }
    // The card closes itself; so does pressing its cell again.
    tap({ x: cardX, y: cardY, w: bw, h: bh, act: () => { cargoPick = null; } });
  }

  const rows = Math.ceil(cells.length / cols);
  const total = rows * (CELL + CGAP) + 20;
  cargoPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH),
                                        cargoPg.scroll));
  HUD.cargoHeight = total;
  HUD.cargoView = viewH;
  if (total > viewH) {
    scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
               cargoPg.scroll / Math.max(1, total - viewH));
  }

  pageNav(st, "inventory", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};
