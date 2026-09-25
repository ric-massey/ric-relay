"use strict";
/* KONDRITE — SURVEY INTERFACE: THE STATION
   ─────────────────────────────────────────────────────────────────────────────
   The station, the market, the station's inventory, and the wormhole. */

/* ═══ THE STATION ═════════════════════════════════════════════════════════
   Where salvage becomes a better ship. A page like the chart and the almanac
   rather than an overlay, for the same reason they are: a shop you read
   through a drifting asteroid field is a shop you misread.

   It shows both progression tracks side by side even though only one of them
   can be spent here. That is deliberate — the verbs are the reason to go
   looking rather than to keep grinding the same three rocks, and a player
   staring at a price list is exactly the player who should be able to see
   what looking would buy instead. */

/* A shop opens on whichever half you need, not on whichever you left it on
   last time. Called wherever a shop is entered — a station or a world. */
HUD.shopOpened = function () {
  shopTab = null; mkt.scroll = 0;
  sellQty = {}; sellEdit = null; sellPick = {};
  buyQty = {}; buyPick = {}; buyOpen = {};
};
HUD.refitOpened = function () { refit.pick = 0; HUD.shopOpened(); };

/* The keyboard on the market page. It walks the shop's own list — there used
   to be a separate array of upgrade tiers for the arrows to walk,
   and the tiers are gone, so the arrows walk the thing that is actually on the
   screen. */
HUD.refitKey = function (code, st) {
  const rows = (st && st.market) || [];
  if (code === "KeyS") { if (st && st.onSell) st.onSell(); return true; }
  if (!rows.length) return false;
  if (code === "ArrowUp")        refit.pick = (refit.pick + rows.length - 1) % rows.length;
  else if (code === "ArrowDown") refit.pick = (refit.pick + 1) % rows.length;
  else if (code === "Enter" || code === "Space") {
    const row = rows[refit.pick];
    if (row && st.onBuyRow) st.onBuyRow(row.kind, row.key, row.frac);
  } else return false;
  return true;
};

/* ═══ THE MARKET ══════════════════════════════════════════════════════════
   A station is a shop, so it looks like one. It was four panels — a sell strip,
   a supplies row, a refit column and a column of almanac unlocks that had
   nothing to do with buying anything — and finding out what this place would
   do for you meant reading all four.

   It is a list now, the way a market or a page you order from is a list: one
   row per thing, what it is, what it costs, and a button. Water and food by the
   quarter, half or the lot, because filling to the brim was the only option and
   five minutes of water to reach the next station is a perfectly sensible
   purchase. Repairs, parts and refits in the same list, because they are the
   same act.

   What is *not* here any more: the bars beside water and food, which were a
   second drawing of a number already on the line; and EARNED, NOT BOUGHT, which
   is the almanac's business and belongs with the almanac. */
let mkt = { scroll: 0 };
HUD.marketOpened = function () { mkt.scroll = 0; };
HUD.marketScrollBy = function (dy, total, view) {
  mkt.scroll = Math.max(0, Math.min(Math.max(0, total - view), mkt.scroll + dy));
};

/* ── a place that trades ──────────────────────────────────────────────
   One page, two kinds of place. A station and an inhabited world are the same
   proposition from the cockpit — somewhere with people in it that will take
   what you are carrying and sell you what you are short of — and they used to
   be two entirely different screens, one a market and one a picture of a globe
   with two fill buttons under it. The globe was the nicer drawing and the
   worse page: you could not see what a world would pay you, because it would
   not pay you anything.

   So both are this, and what differs between them is the rows rather than the
   furniture. What a station has that a world has not — the shipyard, the hull
   repair, a shelf of parts — is simply absent from the list, the same way a
   station with nothing on its shelf shows an empty one. */
/* Which half of the shop is open. A shop is two jobs — getting rid of what you
   are carrying, and picking up what you are not — and they used to be stacked
   on one page. That gave the selling a two-row grid with a single
   all-or-nothing button in the corner, and the buying whatever was left below
   it. Each is a tab now and each gets the page.

   `null` means "not chosen yet", and the first frame picks: you arrive at a
   shop with a full hold far more often than with an empty one, so a full hold
   opens on SELL and an empty one on BUY. */
let shopTab = null;

/* How many of each row is on the counter. Keyed by kind and key, so a material
   and a part of the same name could never share one. Cleared with the shop,
   because a quantity you set last time you docked is not a quantity you meant
   this time. */
let sellQty = {};
const qtyOf = (id, most) =>
  Math.max(1, Math.min(most, Math.floor(sellQty[id] || 1)));

/* Typing a quantity. A keyboard says "60" in two presses where the stepper
   wants a lean on the plus, so the number is a field rather than a caption:
   click it and type. Desk only — a phone has no keys to offer, and the
   stepper's hold is the answer there.

   Nothing about it is modal. Enter puts the digits away, Escape abandons
   them, and pressing anything else on the row commits what has been typed so
   far, because a half-typed number that silently vanished would be worse than
   one that simply took. */
let sellEdit = null;

/* What is ticked to go. Separate from the quantity, because "none of it" and
   "one of it" are different answers and a quantity of zero cannot say the
   first one. */
let sellPick = {};

// The same two, for the other half of the shop.
let buyQty = {}, buyPick = {}, buyOpen = {};
const buyQtyOf = (id, most) =>
  Math.max(1, Math.min(most, Math.floor(buyQty[id] || 1)));

/* What a given number of a row costs. Named once because three things need
   the same answer — the bill, the stepper's ceiling, and the quote on the
   row — and a stepper that lets you reach a quantity the bill then refuses
   to sell you is the bug this is here to prevent.

   `ceil` on a tankful because `buySupply` charges `ceil`: quoting a rounded
   price and taking a ceiled one is a button that lies by a credit. */
const buyCostOf = (r, qty) =>
  r.kind === "supply" ? Math.max(1, Math.ceil(qty / 100 * r.tank))
  : r.kind === "repair" ? r.cost
  : qty * r.cost;

/* The most of this row a given purse will stretch to — the inverse of the
   line above. Supplies are priced by the percent of a tank, everything else
   by the unit. */
const buyMostFor = (r, budget) => {
  if (r.kind === "repair") return budget >= r.cost ? 1 : 0;
  if (r.kind === "supply") {
    return r.tank > 0 ? Math.floor((budget * 100) / r.tank) : 0;
  }
  return r.cost > 0 ? Math.floor(budget / r.cost) : 0;
};

HUD.shopKey = function (code) {
  if (!sellEdit) return false;
  const d = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (d) {
    if (sellEdit.text.length < 4) sellEdit.text += d[1];
    return true;
  }
  if (code === "Backspace") {
    sellEdit.text = sellEdit.text.slice(0, -1);
    return true;
  }
  if (code === "Enter" || code === "NumpadEnter") {
    const v = parseInt(sellEdit.text, 10);
    if (v > 0) sellQty[sellEdit.id] = v;
    sellEdit = null;
    return true;
  }
  if (code === "Escape") { sellEdit = null; return true; }
  return false;
};

function marketPage(st, title, sub, footer, here, closeAct, only) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const cash = st.cash || 0;
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const rows = st.market || [];
  const mats = st.materials || [];
  const carried = st.carried || 0;
  const held = mats.filter(m => m.n > 0);

  pageFrame(title, sub, footer || "");

  if (!shopTab) shopTab = carried ? "sell" : "buy";

  /* ── the two halves ─────────────────────────────────────────────────────
     In the page's own colours rather than the strip's: buying is amber and
     selling is the colour money is, everywhere else in this mode. */
  const TAB_W = 180, TAB_H = 34, TAB_Y = PAGE.TOP + 4;
  [["buy", "BUY", AMBER], ["sell", "SELL", HUD_CASH]].forEach(([k, name, col], i) => {
    const on = shopTab === k;
    /* `live` stays true on the open one. In `button` it means "enabled", not
       "pressable", and passing `!on` drew the tab you are looking at with a
       disabled fill and half-strength type — the shut half of the shop came
       out brighter than the open half. */
    button(name, full.x + TAB_W / 2 + i * (TAB_W + 8), TAB_Y, TAB_W, TAB_H,
           col, on ? null : () => { shopTab = k; mkt.scroll = 0; }, on, true);
  });

  const bodyY = TAB_Y + TAB_H / 2 + PAGE.STEP;
  /* A page with a footer keeps its last row clear of it. Only a world has
     one — "the atmosphere can be skimmed for water" — and it was drawn along
     the bottom edge straight through SELL ALL CARGO, which is a collision
     that could only ever appear on a planet. */
  const bodyH = SCREEN_H - bodyY - (footer ? 44 : 22);

  if (shopTab === "sell") {
    /* ── what they will take off you ──────────────────────────────────────
       Everything aboard that anybody will buy, in one list: the hold, the
       tanks and the crate of spare parts. It used to be a grid of all six
       materials whatever you were carrying — four fifths of it greyed-out
       rows for things you had not got — with parts missing entirely and the
       tanks unsellable, which made a topped-up tank the one thing aboard you
       could not turn back into money.

       You tick what is going and set how much of it, and one button at the
       bottom does the selling. A SELL on every row put a button next to every
       number and made a page of eight things a page of eight decisions; this
       way the decisions are ticks and the transaction is one press. */
    const supplies = [["water", "WATER", ICE], ["food", "FOOD", AMBER_DIM]]
      .map(([k, name, col]) => {
        const t = st[k] || {};
        return { kind: "supply", id: "s:" + k, key: k, name, colour: col,
                 n: Math.floor((t.frac || 0) * 100), tank: t.sellFull || 0 };
      })
      .filter(r => r.n > 0 && r.tank > 0);

    const list = held.map(m => ({
      kind: "mat", id: "m:" + m.key, key: m.key, name: m.name,
      colour: m.colour, n: m.n,
      /* Nought when this place does not deal in it. The row already knows how
         to say so — it is the same line the find-only parts get. */
      each: m.buys === false ? 0
          : m.price == null ? m.value : m.price,
      base: m.value
    })).concat(supplies).concat(
      (st.store || []).filter(e => e.n > 0).map(e => ({
        kind: "part", id: "p:" + e.key, key: e.key, name: e.name,
        colour: VIOLET, n: e.n, each: e.sell || 0, base: e.sell || 0,
        cat: e.cat
      })));

    /* ── what everywhere else is paying ────────────────────────────────
       The ranging lens's room, and it only ever draws in one place: your own
       station, once the lens is in, with something aboard worth pricing. One
       row a material you are actually carrying — what the counter in front of
       you pays, the best standing price on the chart, and which way that is.

       It sits above the list rather than inside it because it is not part of
       the transaction: the rows underneath are what you are selling *here*,
       and this is the argument for not doing that. */
    const board = (st.payBoard || []).filter(r => r.best != null);
    let sellY = bodyY, sellH = bodyH;
    if (board.length) {
      const bh = PANEL_H(board.length);
      panel(full.x, bodyY, full.w, bh, ICE, "THE MARKET",
            "WHAT THE CHART IS PAYING");
      board.forEach((r, i) => {
        const y = ROW(bodyY, i);
        const up = r.best > r.here;
        ctx.save();
        ctx.fillStyle = r.colour;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(full.x + PAGE.PAD, y - 9, 9, 9);
        ctx.restore();
        fitText(r.name, full.x + PAGE.PAD + 18, y, SIZE.cap, r.colour, "left",
                0.9, 150, "0.08em");
        label(r.n + " ABOARD", full.x + PAGE.PAD + 180, y, SIZE.cap,
              VIOLET_LOW, "left", 0.7, "0.1em");
        label("HERE " + hudMoney(r.here), full.x + PAGE.PAD + 300, y, SIZE.cap,
              CASH_DIM, "left", 0.8);
        /* The number that is the point of the room, and it is only news when
           it is bigger: a board that shouts about a station paying less than
           the one you are standing in is a board you stop reading. */
        label("BEST " + hudMoney(r.best), full.x + PAGE.PAD + 430, y, SIZE.cap,
              up ? HUD_CASH : CASH_DIM, "left", up ? 1 : 0.6);
        fitText(r.bearing == null ? ""
                : String(r.bearing).padStart(3, "0") + "\u00b0  \u00b7  " + r.range,
                full.x + full.w - PAGE.PAD, y, SIZE.cap,
                up ? ICE : VIOLET_LOW, "right", up ? 0.9 : 0.55, 240);
      });
      sellY = bodyY + bh + PAGE.STEP;
      sellH = bodyH - bh - PAGE.STEP;
    }

    panel(full.x, sellY, full.w, sellH, HUD_CASH, "SELL",
          carried ? carried + " UNITS ABOARD" : "NOTHING ABOARD");

    if (!list.length) {
      fitText("Nothing aboard to sell.", full.x + PAGE.PAD,
              sellY + PAGE.HEAD + 20, SIZE.cap, VIOLET_DIM, "left", 0.6,
              full.w - 60);
    }

    const x0 = full.x + PAGE.PAD;
    const right = full.x + full.w - PAGE.PAD;
    const going = [];          // what the SELL SELECTED button would do
    let takings = 0;

    /* ── what this place will not take, gathered at the bottom ───────────
       Every row a station does not deal in used to sit wherever the hold
       happened to put it, each one carrying "this place doesn't buy these"
       after its name — so the sentence appeared five times down a list you
       were trying to read, and the things you *could* sell were scattered
       between them.

       They go to the end now, under one heading that says it once. Nothing
       is hidden: an unsellable row still shows what it is and how much of it
       you have, because what a place refuses is worth knowing — it is the
       reason to carry it to the next one. */
    const isDud = r => r.kind !== "supply" && !r.each;
    const sellable = list.filter(r => !isDud(r));
    const duds = list.filter(isDud);
    const shown = duds.length
      ? sellable.concat([{ kind: "heading", id: "__nope" }], duds)
      : sellable;

    shown.forEach((r, i) => {
      const y = sellY + PAGE.HEAD + 18 + i * 38;
      if (y > sellY + sellH - 74) return;    // the two buttons' room

      if (r.kind === "heading") {
        label("NOT PURCHASING TODAY", x0, y, SIZE.cap, VIOLET_LOW,
              "left", 0.75, "0.18em");
        ctx.save();
        ctx.strokeStyle = VIOLET_LOW;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 250, y - 5);
        ctx.lineTo(right, y - 5);
        ctx.stroke();
        ctx.restore();
        return;
      }

      // Nothing anybody buys: said once, at the top of the group they are in.
      const dud = isDud(r);
      const picked = !dud && !!sellPick[r.id];

      /* Each thing wears the picture it wears everywhere else: a material its
         own mark, a part the icon its catalogue uses. A column of identical
         coloured squares is a list you have to read word by word. */
      const iconA = dud ? 0.4 : picked ? 1 : 0.7;
      if (r.kind === "part" && r.cat) {
        drawPartIcon(r.cat, x0 + 32, y - 5, 9, r.colour, iconA);
      } else if (r.kind === "mat") {
        drawMatIcon(r.key, x0 + 31, y - 4, 9, r.colour, iconA);
      } else {
        ctx.save();
        ctx.fillStyle = r.colour;
        ctx.globalAlpha = iconA;
        ctx.fillRect(x0 + 26, y - 9, 9, 9);
        ctx.restore();
      }

      // The tick. Filled when it is going, an empty box when it is not.
      if (!dud) {
        ctx.save();
        ctx.strokeStyle = HUD_CASH;
        ctx.globalAlpha = picked ? 1 : 0.45;
        ctx.lineWidth = picked ? 2 : 1;
        ctx.strokeRect(x0, y - 14, 15, 15);
        if (picked) {
          ctx.fillStyle = HUD_CASH;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(x0 + 4, y - 10, 7, 7);
        }
        ctx.restore();
      }

      fitText(r.name, x0 + 46, y, SIZE.cap, r.colour, "left",
              dud ? 0.4 : picked ? 1 : 0.75, 170, "0.06em");

      // A tank is a percentage of itself; everything else is a count.
      label(r.kind === "supply" ? r.n + "%" : "×" + r.n,
            x0 + 232, y, SIZE.cap, VIOLET_DIM, "left", dud ? 0.4 : 0.8);

      // The heading above says why; the row does not repeat it.
      if (dud) return;

      /* Gold when this place is paying over the odds, dim when it is paying
         the usual. No tag: the number is the message, and a word you have to
         learn before it means anything is worse than a colour you only have
         to notice. */
      const over = r.kind === "mat" && r.each > r.base;
      label(r.kind === "supply" ? hudMoney(r.tank) + " a tankful"
                                : hudMoney(r.each) + " each",
            x0 + 310, y, SIZE.cap, over ? HUD_CASH : CASH_DIM, "left",
            over ? 1 : 0.7);

      /* ── how much of it ──────────────────────────────────────────────────
         Minus, a number, plus. Both steppers repeat while held, so a hundred
         of something is a lean rather than a hundred presses — and on a desk
         the number is a field you can click and type into. */
      const editing = !!(sellEdit && sellEdit.id === r.id);
      const typed = editing && sellEdit.text
        ? parseInt(sellEdit.text, 10) : null;
      const q = typed > 0 ? Math.max(1, Math.min(r.n, typed))
                          : qtyOf(r.id, r.n);
      const commit = () => {
        if (!editing) return;
        if (typed > 0) sellQty[r.id] = q;
        sellEdit = null;
      };
      const total = r.kind === "supply"
        ? Math.max(1, Math.round(q / 100 * r.tank))
        : q * r.each;
      if (picked) { going.push({ r, q }); takings += total; }

      const stepW = 38, boxW = 54;
      const plusCx = right - stepW / 2;
      const boxCx = plusCx - stepW / 2 - 6 - boxW / 2;
      const minusCx = boxCx - boxW / 2 - 6 - stepW / 2;
      const bump = d => () => {
        commit();
        sellQty[r.id] = Math.max(1, Math.min(r.n, qtyOf(r.id, r.n) + d));
        sellPick[r.id] = true;   // touching the number means you want it
      };
      button("−", minusCx, y - 5, stepW, 26, HUD_CASH,
             q > 1 ? bump(-1) : null, false, q > 1, "0.02em", true);
      button("+", plusCx, y - 5, stepW, 26, HUD_CASH,
             q < r.n ? bump(1) : null, false, q < r.n, "0.02em", true);

      // The number itself, in a box, so it reads as a field and not a caption.
      ctx.save();
      ctx.strokeStyle = HUD_CASH;
      ctx.globalAlpha = editing ? 1 : picked ? 0.7 : 0.4;
      ctx.lineWidth = editing ? 2 : 1;
      ctx.strokeRect(boxCx - boxW / 2, y - 18, boxW, 26);
      ctx.restore();
      label(editing ? (sellEdit.text || "") + "_" : String(q),
            boxCx, y, SIZE.cap, HUD_CASH, "center", picked ? 1 : 0.65);
      if (!api.touchOnly) {
        tap({ x: boxCx - boxW / 2, y: y - 18, w: boxW, h: 26,
              act: () => { sellEdit = { id: r.id, text: "" };
                           sellPick[r.id] = true; } });
      }

      /* The whole left of the row is the tick. A 15-pixel box is a mouse
         target and not a thumb one, and there is nothing else along there to
         press by accident. */
      tap({ x: x0 - 6, y: y - 20, w: minusCx - stepW / 2 - 12 - (x0 - 6), h: 30,
            act: () => {
              sellPick[r.id] = !sellPick[r.id];
              // Ticking a row means all of it unless you say otherwise.
              if (sellPick[r.id] && !sellQty[r.id]) sellQty[r.id] = r.n;
            } });
    });

    /* Two ways out of a full hold: the things you chose, or the cargo in one
       press. "CARGO", not "EVERYTHING" — it empties the hold of materials and
       leaves the tanks and the crate alone, because a button that sold the
       spare engine you went four sectors for would be the worst thing on this
       page. Anything beyond the materials goes through the ticks. */
    const btnY = sellY + sellH - 32;
    button(going.length ? "SELL SELECTED   " + hudMoney(takings)
                        : "NOTHING SELECTED",
           full.x + full.w / 2 - 156, btnY, 300, 36,
           going.length ? HUD_CASH : VIOLET_LOW,
           going.length ? () => {
             sellEdit = null;
             for (const g of going) {
               if (g.r.kind === "mat") st.onSellOne && st.onSellOne(g.r.key, g.q);
               else if (g.r.kind === "part") st.onSellPart && st.onSellPart(g.r.key, g.q);
               else st.onSellSupply && st.onSellSupply(g.r.key, g.q / 100);
               delete sellQty[g.r.id];
               delete sellPick[g.r.id];
             }
           } : null, false, !!going.length);

    button(carried ? "SELL ALL CARGO   " + hudMoney(st.worth || 0)
                   : "NOTHING TO SELL",
           full.x + full.w / 2 + 156, btnY, 300, 36,
           carried ? HUD_CASH : VIOLET_LOW, carried ? st.onSell : null,
           false, !!carried);

    // Nothing to scroll: six materials, two tanks and a crate is the most.
    HUD.marketHeight = 0;
    HUD.marketView = 1;
    pageNav(st, here, only);
    closeButton(closeAct);
    return;
  }

  /* ── what this station cannot do yet ──────────────────────────────────
     Only at home, and only while something is still dark. Every room the
     station has, named, with the part it is waiting for and the clue to where
     that part is kept — the same line the manifest carries, moved to the
     place it unlocks.

     It goes above the shelf rather than below it because it is the reason to
     leave: the shelf under it is water and food, and this is the list of
     everything the counter would be if you went and got it. When the sixth
     part is in, the panel is simply not there, and the shop is a shop. */
  const dark = st.atHomeDock ? (st.services || []).filter(s => !s.live) : [];
  let buyY = bodyY, buyH = bodyH;
  if (dark.length) {
    const dh = PANEL_H(dark.length);
    panel(full.x, bodyY, full.w, dh, VIOLET, "DARK",
          dark.length + (dark.length === 1 ? " ROOM" : " ROOMS") +
          "  \u00b7  EACH WANTS A PART");
    /* Four columns, and the order they give way in is the order they matter
       in. **What it wants and where that is** are the whole row — a row that
       names the part and drops the place is the failure that looks fine in a
       screenshot — so those two get their width first, off the right edge.
       The blurb takes whatever is left and is simply not drawn when what is
       left is not enough to read: at 800 across it goes, at 1200 it is
       there, and neither width ever prints half a sentence. */
    const dx0 = full.x + PAGE.PAD;
    const drx = full.x + full.w - PAGE.PAD;
    const WHERE_W = 230, PART_W = 220;
    const partX = drx - WHERE_W - 14 - PART_W;
    const doesX = dx0 + 176;
    const doesW = partX - 14 - doesX;
    dark.forEach((s, i) => {
      const y = ROW(bodyY, i);
      const col = s.carrying ? HUD_CASH : VIOLET;
      label(s.carrying ? "\u25b2" : "\u00b7", dx0, y, SIZE.cap, col, "left", 1);
      fitText(s.name, dx0 + 22, y, SIZE.cap, col, "left", 1, 146, "0.08em");
      if (doesW >= 200) {
        fitText(s.does, doesX, y, SIZE.cap, VIOLET_LOW, "left", 0.75, doesW);
      }
      fitText(s.carrying ? "ABOARD \u2014 " + s.part : "NEEDS " + s.part,
              partX, y, SIZE.cap, s.carrying ? HUD_CASH : AMBER, "left", 0.9,
              PART_W, "0.06em");
      fitText(s.where || s.clue || "", drx, y, SIZE.cap, AMBER_DIM, "right",
              0.7, WHERE_W);
    });
    buyY = bodyY + dh + PAGE.STEP;
    buyH = bodyH - dh - PAGE.STEP;
  }

  /* ── and what they will sell you ─────────────────────────────────────────
     Built the same way as the SELL tab, because it is the same act in the
     other direction: tick what is going in the hold, say how much of it, and
     one button at the bottom does the buying. It was a list with a button on
     every row and three rows a tank — QUARTER, HALF and FILL — which was a
     quantity control made out of buttons, next to a page that had a real one. */
  panel(full.x, buyY, full.w, buyH, AMBER, "BUY",
        rows.length + (rows.length === 1 ? " THING" : " THINGS"));

  if (!rows.length) {
    fitText(dark.length ? "Water and food. Everything else here is dark."
                        : "This one has nothing you need.",
            full.x + PAGE.PAD,
            buyY + PAGE.HEAD + 20, SIZE.cap, VIOLET_DIM, "left", 0.6,
            full.w - 60);
  }

  const bx0 = full.x + PAGE.PAD;
  const bRight = full.x + full.w - PAGE.PAD;
  const basket = [];
  let bill = 0;

  /* ── the counter stops at what you can afford ─────────────────────────
     Ric: four cash, the counter stops. The catch is that this is a basket —
     what you can afford on one row depends on what the other ticked rows
     have already spoken for — and the rows draw one after another, so by the
     time a row is drawn `bill` only holds the ones above it. A row near the
     top would have been capped against an empty purse-worth of commitments
     and a row at the bottom against nearly all of them, which is not a rule
     anybody could learn.

     So the ticked total is worked out once, before any row draws, and each
     row is capped against the purse less *everything else* in the basket.
     Untick a row and the others can climb again, which is the behaviour the
     page already implies. */
  const committed = {};
  let ticketed = 0;
  rows.forEach(r => {
    const id = r.id || r.kind + ":" + r.key;
    if (!buyPick[id]) return;
    /* Bounded by the whole purse as well as by the stock. A stored quantity
       can outlive the cash that justified it — tick three of something, then
       spend — and an unbounded stale number here would quietly squeeze every
       other row. The row itself will draw the smaller figure; this only has
       to avoid claiming more than the purse ever held. */
    const cap = Math.max(1, Math.min(Math.max(1, r.most || 1),
                                     buyMostFor(r, Math.max(0, cash))));
    const c = buyCostOf(r, buyQtyOf(id, cap));
    committed[id] = c;
    ticketed += c;
  });

  const inner = { x: full.x + 1, y: buyY + PAGE.HEAD - 8,
                  w: full.w - 2, h: buyH - PAGE.HEAD - 46 };
  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, inner.w, inner.h);
  ctx.clip();
  tapClip(inner);

  /* Rows are laid out one after another rather than at `i * 34`, because an
     open description makes its row taller. `rowTop` is where the next one
     starts and `listH` is what the whole thing came to, which is what the
     scrollbar needs. */
  let rowTop = inner.y + 12;
  rows.forEach(r => {
    const id = r.id || r.kind + ":" + r.key;
    const open = !!buyOpen[id] && !!r.note;
    const noteLines = open
      ? wrapLines(r.note, SIZE.cap, full.w - PAGE.PAD * 2 - 60, "0.04em") : [];
    const rowH = 34 + (open ? noteLines.length * 20 + 8 : 0);
    const y = rowTop + 14 - mkt.scroll;
    rowTop += rowH;
    if (y < inner.y - rowH || y > inner.y + inner.h + rowH) return;

    const stocked = Math.max(1, r.most || 1);
    const picked = !!buyPick[id];
    /* The purse, less what the rest of the basket has already claimed. A row
       that is not ticked yet claims nothing, so it is capped against the
       whole remaining purse — tick it and the others tighten, which is the
       same arithmetic seen from the other side. */
    const spare = cash - (ticketed - (committed[id] || 0));
    /* Never below one: a row you cannot afford at all still shows a 1 and a
       dead `+`, because a stepper that reads 0 looks broken rather than
       unaffordable. The BUY button is what refuses. */
    const most = Math.max(1, Math.min(stocked, buyMostFor(r, Math.max(0, spare))));

    /* A part gets its own picture; everything else gets a swatch. A shelf of
       twenty-odd identical coloured squares is a list you read word by word. */
    const iconA = picked ? 1 : 0.7;
    if (r.kind === "part" && r.cat) {
      drawPartIcon(r.cat, bx0 + 32, y - 5, 9, r.colour, iconA);
    } else if (r.kind === "local") {
      drawMatIcon(r.key, bx0 + 31, y - 4, 9, r.colour, iconA);
    } else {
      ctx.save();
      ctx.fillStyle = r.colour;
      ctx.globalAlpha = iconA;
      ctx.fillRect(bx0 + 26, y - 9, 9, 9);
      ctx.restore();
    }

    // The tick.
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = picked ? 1 : 0.45;
    ctx.lineWidth = picked ? 2 : 1;
    ctx.strokeRect(bx0, y - 14, 15, 15);
    if (picked) {
      ctx.fillStyle = AMBER;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(bx0 + 4, y - 10, 7, 7);
    }
    ctx.restore();

    fitText(r.name, bx0 + 46, y, SIZE.cap, r.colour, "left",
            picked ? 1 : 0.75, 170, "0.06em");

    /* What this row is, in numbers: what it weighs, how many of it they have
       left. The *words* are in the description, which drops down — a note
       written to fit a column is a note written twice, once for the column
       and once for the truth. */
    const said = r.kind === "supply" ? r.have + "% aboard"
               : r.kind === "repair" ? r.have + " hull"
               : r.kind === "local" ? r.left + " left"
               /* "8 CARGO SLOTS", not "8 OF HOLD": the old wording named the
                  thing it came out of but never said what the number counted,
                  and read as though "hold" were a unit. The full phrase every
                  time, because this ship also has four *slots* for the parts
                  it is flying, and those are a different thing entirely. */
               : (r.weight ? r.weight + " CARGO SLOTS  ·  " : "") +
                 (r.left != null ? r.left + " left" : "");

    // How much one of it costs, in the same shape the sell side uses.
    const unit = r.kind === "supply" ? hudMoney(r.tank) + " a tankful"
               : r.kind === "repair" ? hudMoney(r.cost)
               : hudMoney(r.cost) + " each";

    const qty = r.kind === "repair" ? 1 : buyQtyOf(id, most);
    const cost = buyCostOf(r, qty);
    if (picked) { basket.push({ r, id, qty }); bill += cost; }

    const stepW = 38, boxW = 54;
    const plusCx = bRight - stepW / 2;
    const boxCx = plusCx - stepW / 2 - 6 - boxW / 2;
    const minusCx = boxCx - boxW / 2 - 6 - stepW / 2;

    /* The chevron says there is more to read, and is the thing you press.
       Bigger and brighter than the row's text rather than dimmer than it:
       at `SIZE.cap` in `AMBER_DIM` it was the faintest mark on a busy row
       and read as punctuation, so nobody could tell the row opened. A
       control has to look like it does something. */
    if (r.note) {
      label(open ? "▾" : "▸", bx0 + 230, y + 1, SIZE.val, AMBER,
            "left", open ? 1 : 0.8);
    }
    fitText(said, bx0 + 250, y, SIZE.cap, VIOLET_DIM, "left", 0.62,
            minusCx - stepW / 2 - 186 - (bx0 + 250));
    label(unit, minusCx - stepW / 2 - 16, y, SIZE.cap, AMBER_DIM, "right",
          picked ? 0.95 : 0.7);

    /* Repairing a hull is one price for one job — there is no "how much of a
       mend" — so it keeps the row and loses the stepper. */
    if (r.kind !== "repair") {
      const bump = d => () => {
        buyQty[id] = Math.max(1, Math.min(most, buyQtyOf(id, most) + d));
        buyPick[id] = true;
      };
      button("−", minusCx, y - 5, stepW, 26, AMBER,
             qty > 1 ? bump(-1) : null, false, qty > 1, "0.02em", true);
      button("+", plusCx, y - 5, stepW, 26, AMBER,
             qty < most ? bump(1) : null, false, qty < most, "0.02em", true);
      ctx.save();
      ctx.strokeStyle = AMBER;
      ctx.globalAlpha = picked ? 0.7 : 0.4;
      ctx.lineWidth = 1;
      ctx.strokeRect(boxCx - boxW / 2, y - 18, boxW, 26);
      ctx.restore();
      label(String(qty) + (r.kind === "supply" ? "%" : ""),
            boxCx, y, SIZE.cap, AMBER, "center", picked ? 1 : 0.65);
    }

    // The name end of the row ticks it; the middle opens what it is.
    tap({ x: bx0 - 6, y: y - 20, w: 232, h: 30,
          act: () => {
            buyPick[id] = !buyPick[id];
            if (buyPick[id] && !buyQty[id]) {
              // A tank fills; everything else starts at one.
              buyQty[id] = r.kind === "supply" ? most : 1;
            }
          } });
    if (r.note) {
      tap({ x: bx0 + 228, y: y - 20,
            w: minusCx - stepW / 2 - 12 - (bx0 + 228), h: 30,
            act: () => { buyOpen[id] = !buyOpen[id]; } });
    }

    // ── and what it actually does, once you have asked ──────────────────
    if (open) {
      noteLines.forEach((ln, k) => {
        label(ln, bx0 + 250, y + 22 + k * 20, SIZE.cap, AMBER_DIM, "left",
              0.85, "0.04em");
      });
    }
  });
  ctx.restore();
  tapClipOff();

  // What the list actually came to, open descriptions included.
  const total = (rowTop - inner.y) + 34;
  HUD.marketHeight = total;
  HUD.marketView = inner.h;
  if (total > inner.h) {
    scrollHint(full.x + full.w - 10, inner.y + 6, inner.h - 12,
               mkt.scroll / Math.max(1, total - inner.h));
  }

  /* One press, and it says what it will cost before you make it. Red and dead
     when the purse will not cover it: a button that takes your money and buys
     you three of the five things you ticked is a button that lied. */
  const canPay = bill > 0 && cash >= bill;
  button(!basket.length ? "NOTHING SELECTED"
           : canPay ? "BUY SELECTED   " + hudMoney(bill)
           : "NOT ENOUGH CASH   " + hudMoney(bill),
         full.x + full.w / 2, buyY + buyH - 32, 320, 36,
         !basket.length ? VIOLET_LOW : canPay ? AMBER : WARN,
         canPay ? () => {
           for (const b of basket) {
             st.onBuyRow && st.onBuyRow(b.r.kind, b.r.key, b.qty);
             delete buyQty[b.id];
             delete buyPick[b.id];
           }
         } : null, false, canPay);

  pageNav(st, here, only);
  closeButton(closeAct);
}

HUD.drawRefit = function (st, dt) {
  st = st || {};
  marketPage(st, "SHOP",
             (st.place ? st.place.space.name + "   \u00b7   " : "") +
             (st.cash || 0) + " CASH", "", "refit",
             st.onUndock || st.onClose || (() => {}), PLACE_TABS);
};

/* ═══ THE STATION'S INVENTORY ═════════════════════════════════════════════
   H1. The inventory, wearing the shop's frame.

   The strip along the top is the station's — SHOP, SHIPS, INVENTORY and, once
   the mouth is open, WORMHOLE — because those are rooms in the place you are
   standing in. The row where BUY and SELL sit belongs to your ship, so it is
   amber and it carries the pages the inventory already has. Below that is the
   inventory page itself, unchanged and unforked. See `embedded`.

   Why it is worth a page at all: docking used to be a dead end. You could see
   what a station sold and what it would buy, and to find out whether you
   already owned one you had to leave, open the inventory, and come back. */
const STATION_PAGES = [
  ["ship",      "SHIP",     st => st.onShip],
  ["inventory", "CARGO",    st => st.onInventory],
  ["record",    "RECORD",   st => st.onRecord],
  ["sector",    "SECTOR",   st => st.onSector],
  ["craft",     "CRAFTING", st => st.onCraftPage],
  ["chart",     "MAP",      st => st.onChart]
];
// Which of them the station is showing. Remembered, so leaving the shop and
// coming back puts you where you were rather than back at the first tab.
let stationTab = "ship";
HUD.stationTab = () => stationTab;
HUD.setStationTab = k => { stationTab = k; };

HUD.drawStationInv = function (st, dt) {
  const { SCREEN_W } = api;
  st = st || {};
  const where = st.landed ? (st.landed.name || "SURFACE")
              : st.docked ? (st.docked.name || "STATION") : "INVENTORY";
  pageFrame(where, hudMoney(st.cash || 0), "", PLACE_TONE);

  /* The ship's pages, in the amber, exactly where the shop puts BUY and SELL —
     same row, same height, same width, because the whole point of the page is
     that it is the shop's frame and a frame you have to re-learn is a
     different frame. */
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const TAB_W = Math.min(180, (full.w - 32) / STATION_PAGES.length);
  const TAB_H = 34, TAB_Y = PAGE.TOP + 4;
  STATION_PAGES.forEach(([key, name, act], i) => {
    const on = stationTab === key;
    button(name, full.x + TAB_W / 2 + i * (TAB_W + 8), TAB_Y, TAB_W, TAB_H,
           on ? AMBER : AMBER_DIM,
           on ? null : () => { stationTab = key; }, on, true);
  });

  /* And the page itself, given the room under that row. `PAGE.TOP` is put
     back in a `finally` because a draw that threw halfway would otherwise
     leave every other page in the game laid out forty-four pixels low. */
  const base = PAGE.TOP;
  const body = { ship: HUD.drawShip, inventory: HUD.drawInventory,
                 record: HUD.drawRecord, sector: HUD.drawSector, craft: HUD.drawCraft,
                 chart: HUD.drawChart }[stationTab] || HUD.drawShip;
  embedded++;
  PAGE.TOP = base + EMBED_BUMP;
  try { body.call(HUD, st, dt); }
  finally { PAGE.TOP = base; embedded--; }

  pageNav(st, "stationinv", PLACE_TABS);
  closeButton(st.onUndock || st.onClose || (() => {}));
};

/* ═══ THE WORMHOLE ════════════════════════════════════════════════════════
   H3. A map, and only a map for one purpose: the mouths the station can open.

   It is deliberately not the chart. The chart is where you read the sector —
   it pans, it zooms, it carries pins and hazards and the line you flew, and
   jumping is one armed mode among several things a tap can mean there. This
   answers one question, has one gesture, and shows nothing that is not an
   answer to it: every station you have charted, where it is, and how far.

   It fits itself to what you know rather than panning, because a map you have
   to navigate in order to navigate is a map with a map inside it — and the
   whole set is never more than a few dozen marks.

   Free, and any station you have *charted* counts. You still have to be
   docked somewhere to make the jump: the mouth opens between two
   moorings, not between a patch of empty space and a mooring. */
HUD.drawWormhole = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  /* Only the ones you have been to or swept. The gazetteer is written by
     exactly two things — flying inside the sight radius, and a scan return —
     so reading it *is* "passed or scanned at", and there is deliberately no
     second source: a station you have merely inferred from the shape of the
     sector is not a mooring you know how to open a mouth onto. */
  const stations = (st.known || []).filter(q => q.k === "station");
  const me = st.ship || { x: 0, y: 0 };
  const docked = !!(st.docked || st.landed);

  pageFrame("WORMHOLE", stations.length +
            (stations.length === 1 ? " MOORING KNOWN" : " MOORINGS KNOWN"),
            "", PLACE_TONE);

  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const top = PAGE.TOP + 6;
  const view = { x: full.x, y: top, w: full.w, h: SCREEN_H - top - 74 };
  panel(view.x, view.y, view.w, view.h, VIOLET, "THE MOUTHS",
        docked ? "TAP ONE TO OPEN IT" : "YOU MUST BE DOCKED TO JUMP");

  if (!stations.length) {
    fitText("No moorings yet. Fly past a station, or sweep one with a scan, " +
            "and it goes on this map.", view.x + PAGE.PAD,
            view.y + PAGE.HEAD + 24, SIZE.cap, VIOLET_DIM, "left", 0.7,
            view.w - PAGE.PAD * 2);
    pageNav(st, "wormhole", PLACE_TABS);
    closeButton(st.onUndock || st.onClose || (() => {}));
    return;
  }

  /* Fitted to everything you know, including where you are standing, so the
     jump you are about to make is always visible as a distance rather than as
     two names. A single mooring would divide by nothing, hence the floor. */
  const xs = stations.map(q => q.x).concat([me.x]);
  const ys = stations.map(q => q.y).concat([me.y]);
  const pad = 70;
  const inner = { x: view.x + pad, y: view.y + PAGE.HEAD + pad * 0.5,
                  w: view.w - pad * 2, h: view.h - PAGE.HEAD - pad };
  const spanX = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const spanY = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const k = Math.min(inner.w / spanX, inner.h / spanY);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const px = wx => inner.x + inner.w / 2 + (wx - midX) * k;
  const py = wy => inner.y + inner.h / 2 + (wy - midY) * k;

  // Where you are, so the map has a you on it.
  const mx = px(me.x), my = py(me.y);
  ctx.save();
  ctx.strokeStyle = AMBER;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my);
  ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();
  ctx.restore();

  stations.forEach((q, i) => {
    const x = px(q.x), y = py(q.y);
    const away = Math.round(Math.hypot(q.x - me.x, q.y - me.y));
    const here = away < 400;
    const col = here ? HUD_CASH : docked ? VIOLET : VIOLET_LOW;
    // A line back to you, so the map reads as a set of routes from where you
    // are standing rather than as a constellation.
    if (!here && docked) {
      ctx.save();
      ctx.strokeStyle = VIOLET_LOW;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x, y); ctx.stroke();
      ctx.restore();
    }
    api.glow(col, 2.2, here ? 1 : 0.85, () => {
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
    });
    /* A distance, and nothing else. **Nothing out here is called anything** —
       that is the sector's oldest rule and the reason the chart labels cells
       by coordinate and lets you pin your own names on them. A station is
       written into the gazetteer with an empty name for exactly that reason,
       so this drew nothing in real play and only ever showed something when a
       harness invented one. The lookup is gone rather than left dormant: a
       line that would name a place if a name ever appeared is an invitation
       to add one. You tell these apart by where they are, which is what a map
       is for. */
    label(here ? "YOU ARE HERE" : fmtCells(away) + "u", x, y + 24,
          SIZE.cap, col, "center", here ? 0.95 : 0.7);
    /* The one gesture. Nothing else on this page does anything, which is the
       difference between it and the chart: there is no mode to be in and
       nothing to arm first. */
    if (!here && docked && st.onJump) {
      tap({ x: x - 26, y: y - 26, w: 52, h: 52,
            act: () => { if (st.onJump(q.x, q.y) !== false && st.onClose) st.onClose(); } });
    }
  });

  pageNav(st, "wormhole", PLACE_TABS);
  closeButton(st.onUndock || st.onClose || (() => {}));
};
