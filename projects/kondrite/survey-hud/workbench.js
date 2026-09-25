"use strict";
/* KONDRITE — SURVEY INTERFACE: THE WORKBENCH
   ─────────────────────────────────────────────────────────────────────────────
   The inventory and loadout, carrying a part to a slot, the bench, and what a material looks like. */

/* ═══ THE INVENTORY ═══════════════════════════════════════════════════════
   One page that answers "what have I got". It existed in pieces before — cash
   in a corner of the flight panel, the refit only visible inside a shop, the
   verbs only mentioned when they arrived — which meant the answer was spread
   across three screens and one of them you had to fly somewhere to open.

   Reached from a button under the panel chart, or on `I`. */
/* ═══ THE LOADOUT ═════════════════════════════════════════════════════════
   Four slots, the same four on every hull, and the parts that go in them.

   This page is live — the world keeps running behind it — and the whole of the
   slot system depends on that. Fitting a part out in space takes time and the
   slot is dead until it lands; a page that paused the clock would turn that
   cost into a loading screen you wait out instead of a risk you take. So the
   page shows a countdown that is genuinely counting, and you can close it and
   keep flying while it does.

   At a station every fit is instant, which is why the page reads differently
   when you are docked: no timers, and a shelf to buy from. */
const RARITY = {
  common:   { name: "COMMON",   colour: VIOLET_DIM },
  uncommon: { name: "UNCOMMON", colour: ICE },
  rare:     { name: "RARE",     colour: HUD_CASH },
  exotic:   { name: "EXOTIC",   colour: AMBER }
};
const rarity = k => RARITY[k] || RARITY.common;

/* A list that scrolls with no sign it scrolls is a list people think is four
   items long. Three pixels of track and a thumb on it is enough to say so. */
function scrollHint(x, y, h, t) {
  const { ctx } = api;
  const knob = Math.max(24, h * 0.4);
  ctx.save();
  ctx.fillStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = VIOLET;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(x, y + Math.max(0, Math.min(1, t)) * (h - knob), 3, knob);
  ctx.restore();
}
let loadout = { slot: -1, scroll: 0 };
HUD.loadoutOpened = function () { loadout.slot = -1; };
HUD.loadoutDragBy = function (dy, rows) {
  const max = Math.max(0, rows - LOAD_ROWS);
  loadout.scroll = Math.max(0, Math.min(max, loadout.scroll + dy / PAGE.STEP));
};
HUD.loadoutCanScroll = rows => rows > LOAD_ROWS;
const LOAD_ROWS = 9;

/* One entry in a parts list: what it is, what it does, and the one thing you
   can do about it. Everything is on a single row because a part is a single
   decision — the note is the only part that has to shrink. */
function partRow(x, w, y, e, action) {
  const r = rarity(e.rarity);
  const nameW = 168;
  label(e.name, x + PAGE.PAD, y, SIZE.cap, r.colour, "left", 0.95);
  fitText(e.note, x + PAGE.PAD + nameW, y, SIZE.cap, VIOLET_DIM, "left", 0.62,
          w - PAGE.PAD * 2 - nameW - 118);
  if (action) {
    button(action.text, x + w - PAGE.PAD - 46, y - 5, 92, 22,
           action.colour, action.act, false, action.live !== false, "0.06em");
  }
}

/* ═══ THE WORKBENCH ═══════════════════════════════════════════════════════
   Flat builds. Ingredients in, part out, one step. No engineering interface,
   no nested trees to hold in your head — a row per build, what it wants,
   what you have of it, and one button.

   It works anywhere, which is the whole point: the ice melter's reason to
   exist is being the answer when there is no station for two hundred thousand
   units, and a workbench you have to dock at cannot be that. So the page is
   live, like the loadout, and the world keeps going behind it.

   The two things it must answer that a list of builds does not:

     · **what is this for** — the reverse lookup. You are carrying three
       reactor cores and no idea why until something tells you, so every
       material in the hold says what it is an ingredient for.
     · **the one step down** — a build that eats a finished part says whether
       you have that part, and offers to build it in the same action when you
       could. Nobody should have to work a chain out by hand. */
/* `pick` is a part *key*, not a row in the grid. The grid sorts what you can
   build right now to the front, and that order changes the moment a rock is
   cracked — so an index would sit still while the part under it changed, and
   the panel would be describing something you never clicked. */
let craftPg = { scroll: 0, pick: null, mat: null };

/* ── carrying a part from storage to a slot ───────────────────────────────
   Drag and drop, on a canvas, with no DOM to help. Three pieces:

     `slotBoxes`  where the four squares were drawn this frame
     `storeRows`  where each fittable row of storage was drawn this frame
     `carry`      what is in your hand, and where your hand is

   Both lists are rebuilt by the draw, which is the only way the thing you can
   drop onto stays the same rectangle as the thing you can see. A hit test
   against remembered geometry that the layout has since moved is the classic
   canvas bug, and the fix is never to remember it for longer than a frame.

   The gesture deliberately takes over the page while it is running: press on a
   part and the page stops scrolling until you let go. Anywhere else on the page
   still scrolls, and there is plenty of anywhere else. A press that never moves
   is still a tap, so the old click-to-fit keeps working and nobody has to learn
   a new gesture to do the thing they already did. */
let slotBoxes = [];
let storeRows = [];
/* Where the spares tray's window is, so a part dragged off the ship has
   somewhere to be dropped. The four squares were the only drop target and the
   gesture only ran one way: parts went on by dragging and came off by
   pressing, which are two different ideas about what a slot is. */
let trayBox = null;
let carry = null;
/* The part whose bubble is open on the inventory page, and where it was. A
   tile with a picture on it says *what kind* of thing it is; it cannot say what
   the thing does, and "+34% scan range" is the reason you own one. So pressing
   a tile opens a small card beside it, and pressing anywhere closes it. */
let bubble = null;
const DRAG_MIN = 6;          // screen units before a press becomes a drag

const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/* ── pressing anywhere else ───────────────────────────────────────────────
   A card that opens over a page has to shut when you press away from it, and
   neither of the two that do could: the ship's part bubble and the cargo
   grid's detail card each closed only on the card itself or on the tile that
   opened it. Everywhere else on the page did nothing, and a popup you have to
   find the way out of is a popup you resent.

   There is no full-screen rectangle *after* the page, and there cannot be: the
   tap list is last-drawn-first-served, so a catch-all registered last would
   swallow every press on the page under it — pressing a second part would
   close the first card instead of opening the second. That is the note this
   replaces, and it was right about the order and wrong about the conclusion.

   Registered *first* instead. Everything the page draws after this is found
   before it, so a tile, a slot, the strip along the top and the card itself
   all still win; only a press that lands on nothing at all reaches here. */
function closeOnMiss(act) {
  tap({ x: 0, y: 0, w: api.SCREEN_W, h: api.SCREEN_H, act });
}

/* Picked up, if there is anything under the point. Returns true when it took
   the gesture, so the page knows not to scroll with it. */
HUD.grabAt = function (x, y) {
  for (const r of storeRows) {
    if (!inBox(r, x, y)) continue;
    carry = { key: r.key, name: r.name, cat: r.cat, rarity: r.rarity,
              x, y, from: { x, y }, moved: false, over: -1, slot: -1 };
    return true;
  }
  /* And off the ship. A slot with something in it is as much a thing you can
     take hold of as a tile is, and the gesture reads the same in both
     directions — which is the point: a slot is a place a part *is*, not a
     button that ejects one. Pressing it without moving is still the pull it
     always was, because a press that never travels is a tap. */
  for (const b of slotBoxes) {
    if (!b.key || !inBox(b, x, y)) continue;
    carry = { key: b.key, name: b.name, cat: b.cat, rarity: b.rarity,
              x, y, from: { x, y }, moved: false, over: -1, slot: b.i };
    return true;
  }
  return false;
};

HUD.carryTo = function (x, y) {
  if (!carry) return false;
  carry.x = x; carry.y = y;
  if (Math.abs(x - carry.from.x) + Math.abs(y - carry.from.y) > DRAG_MIN) {
    carry.moved = true;
  }
  carry.over = -1;
  for (const b of slotBoxes) {
    // Not the one it came out of: dropping a part back where it started is
    // the cancel, and lighting that square up would call it a destination.
    if (b.i !== carry.slot && inBox(b, x, y)) carry.over = b.i;
  }
  // And the tray, which is where a part comes off to.
  carry.overTray = carry.slot >= 0 && !!trayBox && inBox(trayBox, x, y);
  return true;
};

/* Let go. Over a slot it fits there; over nothing it goes back, which is the
   correct answer to a drag somebody changed their mind about. A press that
   never moved is a tap and is left to the ordinary tap handling. */
HUD.dropAt = function (st, x, y) {
  if (!carry) return false;
  const held = carry;
  carry = null;
  if (!held.moved) return false;

  /* Off the ship. Dropped anywhere in the tray it comes off; dropped anywhere
     else — the hull, the page, the square it started in — it stays where it
     was, which is the right answer to a drag somebody thought better of. */
  if (held.slot >= 0) {
    if (trayBox && inBox(trayBox, x, y) && st && st.onPull) st.onPull(held.slot);
    return true;
  }

  for (const b of slotBoxes) {
    if (!inBox(b, x, y)) continue;
    if (st && st.onFit) st.onFit(b.i, held.key);
    return true;
  }
  return true;      // dropped on nothing: the gesture is spent, nothing fitted
};

/* Both lists are emptied at the top of every frame, the way the tap list is,
   and refilled only by the page that actually draws slots and a spares tray.

   They used to be cleared inside that page's own draw, which meant they went
   stale the moment you left it — the remembered rectangles stayed grabbable
   on a page that was not showing them, which is the bug the note above this
   block warns about in so many words. It also made the caller gate the
   gesture on a page name, and that list of names is what broke when the
   pages were split: the slots moved to SHIP and the grab was still asking
   for `inventory`, so nothing could be dragged into a slot at all.

   Emptied here, the rule needs no list. Whatever drew a rectangle this frame
   is what you can pick up this frame. */
HUD.forgetCarryGeometry = function () {
  slotBoxes.length = 0;
  storeRows.length = 0;
  trayBox = null;
};

HUD.carrying = () => !!(carry && carry.moved);
// What was drawn where, so a harness can press the same rectangles a thumb does.
HUD.slotBoxes = () => slotBoxes.map(b => ({ ...b }));
// Where a part dragged off the ship may be let go. Exposed for the same
// reason the other two are: a harness should press the rectangles a thumb does.
HUD.trayBox = () => (trayBox ? { ...trayBox } : null);
HUD.storeRows = () => storeRows.map(r => ({ ...r }));
HUD.craftPick = key => { craftPg.pick = key || null; };
// What the parts grid actually drew, which is not the same as what the game
// sent: the anomalies are kept out of it until you have one.
let partsShown = [];
HUD.partsShown = () => partsShown.slice();
HUD.cancelCarry = () => { carry = null; };

/* What is in your hand, drawn last so it is over everything. Deliberately a
   small thing under the finger rather than a full-size row: on a phone the
   hand is already covering most of what is underneath it. */
function drawCarry() {
  if (!carry || !carry.moved) return;
  const { ctx } = api;
  const col = rarity(carry.rarity).colour;
  const w = 150, h = 34;
  const x = carry.x - w / 2, yy = carry.y - h - 14;
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = INK;
  ctx.fillRect(x, yy, w, h);
  ctx.strokeStyle = carry.over >= 0 ? HUD_CASH : col;
  ctx.lineWidth = carry.over >= 0 ? 2 : 1.4;
  ctx.strokeRect(x, yy, w, h);
  ctx.restore();
  drawPartIcon(carry.cat, x + 20, yy + h / 2, 10, col, 1);
  fitText(carry.name, x + 38, yy + h / 2 + 5, SIZE.cap, col, "left", 1, w - 46,
          "0.04em");
}
const CRAFT_ROWS = 8;
HUD.craftOpened = function () { craftPg.pick = null; craftPg.mat = null; };
/* Pixels now rather than rows: the grid is boxes, and a box is not a row. */
HUD.craftDragBy = function (dy) {
  const max = Math.max(0, (HUD.craftHeight || 0) - (HUD.craftView || 1));
  craftPg.scroll = Math.max(0, Math.min(max, craftPg.scroll + dy));
};

/* ═══ THE BENCH ═══════════════════════════════════════════════════════════
   A wall of parts, the ones you can build lit and the rest down at a whisper.
   What you can make is the whole question and it is answered before you touch
   anything — by light, not by sentences.

   It was a list once, with every ingredient spelled out on every row and a
   SHORT button on each. That answered the question and buried it: fifteen
   rows of sums is a page you read rather than a page you glance at. The sums
   are still here, for one part at a time, in the panel underneath — which is
   the only place any of it has to be, because you only build one thing at a
   time and you have already chosen it by then. */
HUD.drawCraft = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const crafts = st.crafts || [];
  const hold = st.materials || [];
  const recOf = k => crafts.find(c => c.key === k) || null;
  const ready = p => { const r = recOf(p.key); return !!(r && r.ready); };

  /* A part is on this bench if it can be *built*. Nothing else.

     It used to carry anything you had laid eyes on as well, so a page called
     CRAFTING listed a dozen things it then had to explain you could not
     craft — "bought at a station", "found out there, not made". That is a
     catalogue wearing a workbench's name, and it makes the page a thing you
     read rather than a thing you use: every tile on it is now a plan, and the
     only question a tile can raise is whether you have the materials yet. */
  const shown = (st.parts || [])
    .filter(p => p.craftable)
    .map((p, i) => ({ p, i }))
    .sort((x, z) => (ready(z.p) - ready(x.p)) || (x.i - z.i))
    .map(e => e.p);
  partsShown = shown;

  pageFrame("CRAFTING", "", "", SHIP_TONE);

  /* What you are carrying, as marks and numbers. No names: six of them across
     the top is a caption, not a sentence, and every name is a click away on
     the part that wants it. */
  const mwide = Math.min(150, full.w / Math.max(1, hold.length));
  hold.forEach((m, i) => {
    const mx = full.x + i * mwide;
    drawMatIcon(m.key, mx + 8, PAGE.TOP - 1, 9, m.colour, m.n ? 0.95 : 0.25);
    label(String(m.n), mx + 24, PAGE.TOP + 4, SIZE.cap,
          m.n ? m.colour : VIOLET_LOW, "left", m.n ? 1 : 0.3);
  });

  const pick = shown.find(p => p.key === craftPg.pick) || null;
  const CARD = pick ? 132 : 0;
  const gTop = PAGE.TOP + 22;
  const gH = SCREEN_H - gTop - CARD - (pick ? PAGE.STEP : 0) - 20;

  /* The tile is a fixed size and the *columns* follow the width, not the
     other way round. Six across a 932-wide screen is right; six across a
     landscape phone at 1519 made them 245 square and fitted a row and a half
     on the page. A tile has to be big enough to hold a part's name — seven
     across a desk came out "LAYERED PL…" — and no bigger than a thumb needs. */
  const WANT = api.touchOnly ? 170 : 150;
  const CG = 10;
  const cols = Math.max(api.touchOnly ? 4 : 5, Math.round(full.w / WANT));
  const cell = Math.floor((full.w - (cols - 1) * CG) / cols);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, gTop, SCREEN_W, gH);
  ctx.clip();
  tapClip({ x: 0, y: gTop, w: SCREEN_W, h: gH });

  shown.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const bx = full.x + col * (cell + CG);
    const by = gTop + 6 + row * (cell + CG) - craftPg.scroll;
    if (by > gTop + gH || by + cell < gTop) return;
    const can = ready(p);
    const on = craftPg.pick === p.key;
    const rar = rarity(p.rarity);
    const mine = p.fitted || p.owned > 0;
    const tint = can ? AMBER : rar.colour;

    ctx.save();
    ctx.fillStyle = tint;
    ctx.globalAlpha = on ? 0.2 : can ? 0.12 : 0.03;
    ctx.fillRect(bx, by, cell, cell);
    ctx.strokeStyle = tint;
    ctx.globalAlpha = on ? 1 : can ? 0.85 : 0.28;
    ctx.lineWidth = on ? 2.5 : can ? 1.5 : 1;
    ctx.strokeRect(bx, by, cell, cell);
    ctx.restore();

    drawPartIcon(p.cat, bx + cell / 2, by + cell / 2 - 14, cell * 0.2, tint,
                 can ? 1 : 0.45);
    /* Wrapped, not shrunk. `fitText` clamps to 16px whatever size it is
       handed — so asking for 12 changed nothing and "DECOY LAUNCHER" came out
       "DECOY LAUNC…". A name you cannot read is a tile you have to press. */
    wrapLines(p.name, SIZE.cap, cell - 10, "0.02em").slice(0, 2)
      .forEach((ln, k, a) => {
        label(ln, bx + cell / 2, by + cell - 26 + k * 17 + (a.length === 1 ? 9 : 0),
              SIZE.cap, tint, "center", can ? 1 : 0.5, "0.02em");
      });
    // One mark for one fact: it is already yours.
    if (mine) {
      label(p.fitted ? "●" : "×" + p.owned, bx + cell - 6, by + 15,
            SIZE.cap, CASH_DIM, "right", 0.85);
    }

    tap({ x: bx, y: by, w: cell, h: cell,
          act: () => { craftPg.pick = on ? null : p.key; } });
  });

  ctx.restore();
  tapClipOff();

  const rows = Math.ceil(shown.length / cols);
  const total = rows * (cell + CG) + 12;
  craftPg.scroll = Math.max(0, Math.min(Math.max(0, total - gH), craftPg.scroll));
  HUD.craftHeight = total;
  HUD.craftView = gH;
  if (total > gH) {
    scrollHint(SCREEN_W - 14, gTop + 6, gH - 12,
               craftPg.scroll / Math.max(1, total - gH));
  }

  /* ── the one you picked ───────────────────────────────────────────────
     What it is, what it takes, and one button. Everything the grid does not
     say lives here, and it only has to say it about a single part. */
  if (pick) {
    const rec = recOf(pick.key);
    const cy = SCREEN_H - CARD - 20;
    const rar = rarity(pick.rarity);
    panel(full.x, cy, full.w, CARD, rar.colour, pick.name,
          pick.fitted ? "ON SHIP"
          : pick.owned ? "×" + pick.owned + " ABOARD" : "");
    fitText(pick.note || "", full.x + PAGE.PAD, cy + PAGE.HEAD + 12,
            SIZE.cap, VIOLET_DIM, "left", 0.85, full.w - PAGE.PAD * 2 - 210);

    if (rec) {
      // Named in full here, where there is room for it — this is the page's
      // one place for words.
      const bits = [];
      if (rec.part) {
        const sub = (st.parts || []).find(q => q.key === rec.part.key);
        bits.push({ part: true, cat: sub ? sub.cat : "odd", name: rec.part.name,
                    colour: VIOLET, have: rec.part.have ? 1 : 0, want: 1 });
      }
      for (const r of rec.rows) {
        bits.push({ key: r.key, name: r.name, colour: r.colour,
                    have: r.have, want: r.want });
      }
      const each = Math.min(190, (full.w - PAGE.PAD * 2 - 210) /
                                 Math.max(1, bits.length));
      bits.forEach((bit, i) => {
        const bxi = full.x + PAGE.PAD + i * each;
        const yy = cy + PAGE.HEAD + 46;
        const enough = bit.have >= bit.want;
        if (bit.part) drawPartIcon(bit.cat, bxi + 7, yy - 4, 8,
                                   enough ? bit.colour : WARN, 1);
        else drawMatIcon(bit.key, bxi + 7, yy - 4, 8,
                         enough ? bit.colour : WARN, enough ? 0.9 : 1);
        fitText(bit.name, bxi + 21, yy, SIZE.cap, enough ? CASH_DIM : WARN,
                "left", enough ? 0.8 : 1, each - 66, "0.04em");
        label(Math.min(bit.have, bit.want) + "/" + bit.want,
              bxi + each - 16, yy, SIZE.cap, enough ? CASH_DIM : WARN,
              "right", enough ? 0.85 : 1);
      });
    } else {
      /* Unreachable while the grid is only craftable parts, and kept as a
         guard rather than deleted: `crafts` and `parts` are two lists built
         from the same table, and the frame where they disagree should draw a
         line of explanation rather than an empty card. */
      fitText(pick.where || "not made here",
              full.x + PAGE.PAD, cy + PAGE.HEAD + 46, SIZE.cap,
              ICE, "left", 0.8, full.w - PAGE.PAD * 2 - 210);
    }

    // One button, and it says what it is rather than sitting there greyed.
    const canHere = rec && (pick.rarity === "common" || st.docked);
    const can = !!(rec && rec.ready && canHere);
    button(!rec ? "NOT BUILT HERE" : !canHere ? "AT A STATION"
             : rec.ready ? "BUILD IT" : "SHORT",
           full.x + full.w - PAGE.PAD - 95, cy + CARD / 2, 190, 40,
           can ? AMBER : VIOLET_LOW,
           can ? () => st.onCraft && st.onCraft(pick.key) : null, false, can);
  }

  pageNav(st, "craft", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose);
};

/* One picture per category of part. Not one per part: seventeen drawings would
   be seventeen things to get wrong, and what the grid has to answer at a glance
   is *what kind of thing is this* — an engine, a gun, a scanner. The rarity's
   colour carries the rest. */
/* ── what a material looks like ───────────────────────────────────────────
   Six of them, and they were six identical squares in six colours. Colour
   alone is a bad primary key: two of these are within a hue of each other on a
   dim phone screen, colour-blind players get nothing at all, and a swatch tells
   you it is *a material* rather than *which* one.

   So each gets a shape that says what it is — ice is a crystal, iron is rough
   ore, alloy is a milled bar, iridium is a cut gem, electronics is a board with
   legs, a core is a ring around a hot centre. Shape reads at any size and
   survives being drawn in the wrong colour. */
function drawMatIcon(key, cx, cy, r, colour, alpha) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.lineJoin = "round";
  const poly = (pts, fill) => {
    ctx.beginPath();
    pts.forEach((pt, i) => (i ? ctx.lineTo(cx + pt[0] * r, cy + pt[1] * r)
                              : ctx.moveTo(cx + pt[0] * r, cy + pt[1] * r)));
    ctx.closePath();
    fill ? ctx.fill() : ctx.stroke();
  };
  switch (key) {
    case "ice":
      // A crystal: a tall six-sided shard with a highlight down it.
      poly([[0, -1], [0.62, -0.4], [0.62, 0.45], [0, 1], [-0.62, 0.45],
            [-0.62, -0.4]]);
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy - r * 0.55);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.5);
      ctx.stroke();
      break;
    case "iron":
      // Rough ore: a lump with a fracture across it.
      poly([[-0.85, -0.2], [-0.35, -0.85], [0.5, -0.75], [0.9, -0.05],
            [0.55, 0.8], [-0.4, 0.85], [-0.9, 0.35]]);
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, cy + r * 0.1);
      ctx.lineTo(cx + r * 0.1, cy - r * 0.25);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.35);
      ctx.stroke();
      break;
    case "alloy":
      // A milled bar, drawn in perspective so it reads as a solid ingot.
      poly([[-0.9, 0.1], [-0.55, -0.5], [0.9, -0.5], [0.55, 0.1]]);
      poly([[-0.9, 0.1], [0.55, 0.1], [0.55, 0.72], [-0.9, 0.72]]);
      break;
    case "iridium":
      // A cut gem: a table and facets under it.
      poly([[-0.5, -0.55], [0.5, -0.55], [0.95, -0.05], [0, 0.95],
            [-0.95, -0.05]]);
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy - r * 0.05);
      ctx.lineTo(cx + r * 0.95, cy - r * 0.05);
      ctx.moveTo(cx - r * 0.5, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 0.95);
      ctx.moveTo(cx + r * 0.5, cy - r * 0.55);
      ctx.lineTo(cx, cy + r * 0.95);
      ctx.stroke();
      break;
    case "electronics":
      // A board with legs down both sides.
      ctx.strokeRect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1);
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(cx - r * 0.55, cy + i * r * 0.34);
        ctx.lineTo(cx - r * 0.95, cy + i * r * 0.34);
        ctx.moveTo(cx + r * 0.55, cy + i * r * 0.34);
        ctx.lineTo(cx + r * 0.95, cy + i * r * 0.34);
      }
      ctx.stroke();
      ctx.globalAlpha *= 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    default:
      // A reactor core: a containment ring with something lit inside it.
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        ctx.moveTo(cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46);
        ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
      }
      ctx.stroke();
  }
  ctx.restore();
}

function drawPartIcon(cat, cx, cy, r, colour, alpha) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = "round";
  const line = (x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(cx + x1 * r, cy + y1 * r);
    ctx.lineTo(cx + x2 * r, cy + y2 * r);
    ctx.stroke();
  };
  switch (cat) {
    case "engine":
      // A bell and a flame.
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.2, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.5, cy - r * 0.8);
      ctx.lineTo(cx + r * 0.9, cy);
      ctx.lineTo(cx + r * 0.5, cy + r * 0.8);
      ctx.lineTo(cx - r * 0.2, cy + r * 0.8);
      ctx.closePath();
      ctx.stroke();
      line(-0.25, -0.4, -0.9, -0.15);
      line(-0.25, 0, -1, 0);
      line(-0.25, 0.4, -0.9, 0.15);
      break;
    case "thruster":
      // Two small nozzles facing opposite ways.
      ctx.beginPath();
      ctx.rect(cx - r * 0.85, cy - r * 0.45, r * 0.7, r * 0.9);
      ctx.rect(cx + r * 0.15, cy - r * 0.45, r * 0.7, r * 0.9);
      ctx.stroke();
      line(-0.15, 0, 0.15, 0);
      break;
    case "scanner":
      // A dish and its beam.
      ctx.beginPath();
      ctx.arc(cx - r * 0.1, cy, r * 0.75, -1.1, 1.1);
      ctx.stroke();
      line(-0.1, 0, -0.9, 0);
      ctx.beginPath();
      ctx.arc(cx + r * 0.55, cy, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "armour":
      // A plate, layered.
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.9);
      ctx.lineTo(cx + r * 0.8, cy - r * 0.3);
      ctx.lineTo(cx + r * 0.55, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.55, cy + r * 0.85);
      ctx.lineTo(cx - r * 0.8, cy - r * 0.3);
      ctx.closePath();
      ctx.stroke();
      line(-0.45, 0.1, 0.45, 0.1);
      break;
    case "tractor":
      // A cone of pull.
      line(-0.85, -0.7, 0.85, -0.2);
      line(-0.85, 0.7, 0.85, 0.2);
      ctx.beginPath();
      ctx.arc(cx + r * 0.75, cy, r * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "weapon":
      // A barrel and a round leaving it.
      ctx.beginPath();
      ctx.rect(cx - r * 0.9, cy - r * 0.28, r * 1.15, r * 0.56);
      ctx.stroke();
      line(0.35, 0, 0.95, 0);
      ctx.beginPath();
      ctx.arc(cx + r * 0.95, cy, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "solar":
      /* Panels: two wings off a spine, with a sun's rays falling on them. The
         one part in the game whose picture has to say *what it feeds on*. */
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx, cy + r * 0.85);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.strokeRect(cx + side * r * 0.2, cy - r * 0.6,
                       side * r * 0.7, r * 1.2);
      }
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(cx - r * 0.9, cy + i * r * 0.5);
        ctx.lineTo(cx + r * 0.9, cy + i * r * 0.5);
      }
      ctx.stroke();
      break;
    case "device":
      /* A button under a cover, with the press coming off it. A device is the
         one class of part whose picture has to say *you do something with
         this* rather than what it is made of. */
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.1, r * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.1, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.95, cy - r * 0.55);
      ctx.lineTo(cx - r * 0.35, cy - r * 0.55);
      ctx.moveTo(cx + r * 0.95, cy - r * 0.55);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.55);
      ctx.stroke();
      break;
    default:
      // Odd: a shape that is not quite any of the others.
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const rr = r * (i % 2 ? 0.5 : 0.9);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
  }
  ctx.restore();
}


HUD.drawLoadout = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const slots = st.slots || [null, null, null, null];
  const docked = !!st.docked;

  pageFrame("LOADOUT",
            (st.shipName || "") + "  \u00b7  FOUR SLOTS, EVERY HULL",
            "", SHIP_TONE);

  /* ── the four ──────────────────────────────────────────────────────────
     Always four boxes, always the same four boxes. A hull with fewer would
     make "which ship" and "which parts" the same question, and they are not. */
    const slotH = PANEL_H(3);
  for (let i = 0; i < 4; i++) {
    const { x, w } = COL(4, i);
    const sl = slots[i];
    const fitting = !!sl && sl.fit > 0;
    const col = !sl ? VIOLET_LOW : fitting ? AMBER_DIM : rarity(sl.rarity).colour;
    const picked = loadout.slot === i;
    panel(x, PAGE.TOP, w, slotH, picked ? VIOLET : col,
          "SLOT " + (i + 1), sl ? "PULL" : picked ? "CHOSEN" : "EMPTY");

    if (!sl) {
      label("EMPTY", x + PAGE.PAD, ROW(PAGE.TOP, 0) + 4, SIZE.val,
            picked ? VIOLET : VIOLET_LOW, "left", picked ? 0.9 : 0.6);
      fitText(picked ? "pick a part below" : "tap to choose this slot",
              x + PAGE.PAD, ROW(PAGE.TOP, 1) + 2, SIZE.cap, VIOLET_DIM,
              "left", 0.55, w - PAGE.PAD * 2);
    } else {
      fitText(sl.name, x + PAGE.PAD, ROW(PAGE.TOP, 0) + 4, SIZE.val, col,
              "left", 1, w - PAGE.PAD * 2);
      fitText(sl.note, x + PAGE.PAD, ROW(PAGE.TOP, 1) + 2, SIZE.cap,
              VIOLET_DIM, "left", 0.6, w - PAGE.PAD * 2);
      if (fitting) {
        /* The cost, shown as a cost. A slot that is dead has to look dead, or
           the first time it matters is the time you needed it. */
        label("FITTING  " + Math.ceil(sl.fit) + "s", x + PAGE.PAD,
              ROW(PAGE.TOP, 2) + 2, SIZE.cap, AMBER_DIM, "left", 1, "0.1em");
        barAt(x + PAGE.PAD, ROW(PAGE.TOP, 2) + 8, w - PAGE.PAD * 2, 5,
              1 - sl.fit / Math.max(1, sl.of), AMBER_DIM);
      } else {
        label("WORKING", x + PAGE.PAD, ROW(PAGE.TOP, 2) + 2, SIZE.cap,
              HUD_CASH, "left", 0.9, "0.14em");
      }
    }
    tap({ x, y: PAGE.TOP, w, h: slotH, act: () => {
      if (sl) { if (st.onPull) st.onPull(i); }
      else loadout.slot = loadout.slot === i ? -1 : i;
    } });
  }

  /* ── what you have, and what is on the shelf ───────────────────────────
     Where a fit goes: the slot you picked, or the first empty one, so the
     common case is one tap and the deliberate case is two. */
  const target = () => {
    if (loadout.slot >= 0 && !slots[loadout.slot]) return loadout.slot;
    for (let i = 0; i < 4; i++) if (!slots[i]) return i;
    return -1;
  };
  const listY = PAGE.TOP + slotH + PAGE.GUTTER;
  const listH = PANEL_H(LOAD_ROWS);
  const L = COL(2, 0), R = COL(2, 1);

  const crate = st.store || [];
  const free = target() >= 0;
  panel(L.x, listY, L.w, listH, HUD_CASH, "STORAGE",
        crate.length ? crate.length + " KIND" + (crate.length > 1 ? "S" : "") : "EMPTY");
  if (!crate.length) {
    fitText("Nothing to fit. Stations sell parts; the strange ones are a long " +
            "way out.", L.x + PAGE.PAD, ROW(listY, 0) + 4, SIZE.cap,
            VIOLET_DIM, "left", 0.6, L.w - PAGE.PAD * 2);
  }
  crate.slice(0, LOAD_ROWS).forEach((e, i) => {
    const y = ROW(listY, i) + 4;
    const can = free && !e.fitted;
    partRow(L.x, L.w, y, e, {
      text: e.fitted ? "ON SHIP" : docked ? "FIT" : "FIT " + e.secs + "s",
      colour: e.fitted ? VIOLET_LOW : HUD_CASH,
      live: can,
      act: () => { const t = target(); if (t >= 0 && st.onFit) st.onFit(t, e.key); }
    });
    if (e.n > 1) {
      label("\u00d7" + e.n, L.x + L.w - PAGE.PAD - 104, y, SIZE.cap,
            VIOLET_DIM, "right", 0.7);
    }
  });

  /* The shelf. Only when docked, because a shop you can shop at from anywhere
     is not a place. What it stocks depends on how far out it is. */
  const shelf = st.forSale || [];
  if (docked) {
    const rows = Math.max(0, shelf.length - LOAD_ROWS);
    panel(R.x, listY, R.w, listH, AMBER, "ON THE SHELF",
          (st.cash || 0) + " CASH" + (rows ? "   \u00b7  " +
            (Math.floor(loadout.scroll) + 1) + "\u2013" +
            Math.min(shelf.length, Math.floor(loadout.scroll) + LOAD_ROWS) +
            " OF " + shelf.length : ""));
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x + 1, listY + PAGE.HEAD - 6, R.w - 2, listH - PAGE.HEAD + 2);
    ctx.clip();
    const first = Math.floor(loadout.scroll);
    shelf.slice(first, first + LOAD_ROWS + 1).forEach((e, k) => {
      const i = first + k;
      const y = ROW(listY, i - loadout.scroll) + 4;
      const afford = (st.cash || 0) >= e.cost;
      partRow(R.x, R.w, y, e, {
        text: e.cost + "",
        colour: afford ? AMBER : VIOLET_LOW,
        live: afford,
        act: () => st.onBuyPart && st.onBuyPart(e.key)
      });
      if (e.owned) {
        label("\u00d7" + e.owned, R.x + R.w - PAGE.PAD - 104, y, SIZE.cap,
              CASH_DIM, "right", 0.8);
      }
    });
    ctx.restore();
    if (rows) scrollHint(R.x + R.w - 8, listY + PAGE.HEAD, listH - PAGE.HEAD - 8,
                         loadout.scroll / rows);
  } else {
    panel(R.x, listY, R.w, listH, VIOLET_DIM, "WHERE PARTS COME FROM", "");
    [
      "Stations sell them. What a station stocks depends",
      "on how dangerous its sky is \u2014 the strange ones",
      "are sold where the biome is bad and nobody keeps",
      "the peace.",
      "",
      "Out here a fit takes time and the slot is dead",
      "until it lands. At a station it is instant.",
      "So changing your mind out here has a price, and",
      "planning ahead does not."
    ].forEach((ln, i) => {
      if (!ln) return;
      fitText(ln, R.x + PAGE.PAD, ROW(listY, i) + 4, SIZE.cap, VIOLET_DIM,
              "left", 0.6, R.w - PAGE.PAD * 2);
    });
  }

  /* ── what the four add up to ───────────────────────────────────────────
     The only number on the page, and it is a summary rather than a stat: this
     is what you are flying with right now, with anything still fitting left
     out of it, because it is not helping you yet. */
  const sum = [];
  const add = (v, txt) => { if (v) sum.push(txt); };
  let hull = 0, speed = 0, turn = 0, scan = 0, tract = false, rev = false;
  const guns = [];
  for (const sl of slots) {
    if (!sl || sl.fit > 0) continue;
    const e = st.effects && st.effects[sl.key];
    if (!e) continue;
    hull += e.hull || 0; speed += e.speed || 0; turn += e.turn || 0;
    scan += e.scan || 0;
    if (e.tractor) tract = true;
    if (e.reverse) rev = true;
    // A weapon is not a number, so it is named rather than totalled.
    if (e.weapon) guns.push(sl.name);
  }
  add(hull, "+" + hull + " HULL");
  add(speed, "+" + Math.round(speed * 100) + "% SPEED");
  add(turn, "+" + Math.round(turn * 100) + "% TURN");
  add(scan, "+" + Math.round(scan * 100) + "% SCAN");
  if (tract) sum.push("TRACTOR BEAM");
  if (rev) sum.push("REVERSE  [S]");
  for (const g of guns) sum.push(g);
  label("FLYING WITH", PAGE.EDGE, listY + listH + 34, SIZE.cap, VIOLET_DIM,
        "left", 0.55, "0.18em");
  fitText(sum.length ? sum.join("   \u00b7   ") : "four empty slots",
          PAGE.EDGE + 168, listY + listH + 34, SIZE.cap,
          sum.length ? HUD_CASH : VIOLET_LOW, "left", sum.length ? 0.9 : 0.5,
          SCREEN_W - PAGE.EDGE * 2 - 176);

  pageNav(st, "loadout", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose);
};
