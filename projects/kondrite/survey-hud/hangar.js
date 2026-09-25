"use strict";
/* KONDRITE — SURVEY INTERFACE: THE HANGAR
   ─────────────────────────────────────────────────────────────────────────────
   The hangar. */

/* ═══ THE HANGAR ══════════════════════════════════════════════════════════
   Twenty-five named hulls in eight categories, and the only page in the mode
   that is a *catalogue*. It
   is laid out like the almanac for the same reason the almanac is laid out
   that way: the picture is the point. Eight numbers tell you what a ship does
   and the silhouette tells you what it is, and nobody ever picked a ship off a
   table of numbers.

   One bar a stat, drawn against the best in the roster rather than
   against an absolute — "how does this compare to everything else I could
   buy" is the only question a shipyard is ever asked. */
const HANGAR_CATEGORIES = [
  { key: "MILITARY",   colour: "#ff8f77" },
  { key: "EXPLORER",   colour: "#87d8ff" },
  { key: "COMMUTER",   colour: "#6dffbf" },
  { key: "SPORT",      colour: "#ffe56d" },
  { key: "INDUSTRIAL", colour: "#c9a7ff" },
  { key: "CARGO",      colour: "#ffb56b" },
  { key: "UTILITY",    colour: "#72e6dc" },
  { key: "COURIER",    colour: "#f6a6d7" }
];
const categoryTone = key =>
  (HANGAR_CATEGORIES.find(c => c.key === key) || HANGAR_CATEGORIES[0]).colour;
let hangar = { pick: 0, scroll: 0, category: HANGAR_CATEGORIES[0].key, count: 0 };

const categoryShips = list => list
  .map((sh, index) => ({ sh, index }))
  .filter(x => x.sh.category === hangar.category);

function chooseHangarCategory(key, list, edge) {
  if (!HANGAR_CATEGORIES.some(c => c.key === key)) return;
  hangar.category = key;
  hangar.scroll = 0;
  const group = categoryShips(list);
  if (group.length) hangar.pick = group[edge === "last" ? group.length - 1 : 0].index;
  hangar.count = group.length;
}

HUD.hangarOpened = function (st) {
  const list = (st && st.ships) || [];
  const i = list.findIndex(sh => sh.flying);
  hangar.pick = i < 0 ? 0 : i;
  hangar.category = list[hangar.pick]
    ? list[hangar.pick].category
    : HANGAR_CATEGORIES[0].key;
  hangar.scroll = 0;
  hangar.count = categoryShips(list).length;
  keepShipVisible(list);
};

const SHIP_COLS = () => (api.touchOnly ? 2 : 4);
/* One category at a time means two rows hold every desktop group. Military
   needs one short swipe on a phone; everything else fits without scrolling. */
const SHIP_ROWS = () => 2;
const SHIP_CATEGORY_H = 44;
const SHIP_GRID_TOP = () => PAGE.TOP + SHIP_CATEGORY_H + 12;
function keepShipVisible(list) {
  const group = categoryShips(list);
  const local = Math.max(0, group.findIndex(x => x.index === hangar.pick));
  const cols = SHIP_COLS();
  const row = Math.floor(local / cols);
  if (row < hangar.scroll) hangar.scroll = row;
  if (row >= hangar.scroll + SHIP_ROWS()) hangar.scroll = row - SHIP_ROWS() + 1;
  const rows = Math.ceil(group.length / cols);
  hangar.scroll = Math.max(0, Math.min(Math.max(0, rows - SHIP_ROWS()), hangar.scroll));
  hangar.count = group.length;
}

/* The hangar scrolls too. Twenty-five hulls, and on a phone the grid is two
   across and two down — four visible of twenty-five, with the other twenty-one
   reachable only by arrow keys a phone does not have. Drag and wheel both move
   it, the way they already move the almanac. */
HUD.hangarDragBy = function (dy, n) {
  const rows = Math.ceil((hangar.count || n) / SHIP_COLS());
  hangar.scroll = Math.max(0, Math.min(Math.max(0, rows - SHIP_ROWS()),
                                       hangar.scroll + dy / 130));
};
HUD.hangarCanScroll = n =>
  Math.ceil((hangar.count || n) / SHIP_COLS()) > SHIP_ROWS();

HUD.hangarKey = function (code, st) {
  const list = (st && st.ships) || [];
  if (!list.length) return false;
  let group = categoryShips(list);
  let local = Math.max(0, group.findIndex(x => x.index === hangar.pick));
  const cols = SHIP_COLS();
  if (code === "ArrowLeft" && local === 0) {
    const at = HANGAR_CATEGORIES.findIndex(c => c.key === hangar.category);
    chooseHangarCategory(HANGAR_CATEGORIES[(at + HANGAR_CATEGORIES.length - 1) %
                                           HANGAR_CATEGORIES.length].key,
                         list, "last");
  } else if (code === "ArrowRight" && local === group.length - 1) {
    const at = HANGAR_CATEGORIES.findIndex(c => c.key === hangar.category);
    chooseHangarCategory(HANGAR_CATEGORIES[(at + 1) % HANGAR_CATEGORIES.length].key,
                         list);
  } else if (code === "ArrowLeft") {
    hangar.pick = group[Math.max(0, local - 1)].index;
  } else if (code === "ArrowRight") {
    hangar.pick = group[Math.min(group.length - 1, local + 1)].index;
  } else if (code === "ArrowUp") {
    hangar.pick = group[Math.max(0, local - cols)].index;
  } else if (code === "ArrowDown") {
    hangar.pick = group[Math.min(group.length - 1, local + cols)].index;
  }
  else if (code === "Enter" || code === "Space") {
    const sh = list[hangar.pick];
    if (sh && st.onBuyShip && (sh.owned || sh.afford)) st.onBuyShip(sh.key);
    return true;
  } else return false;
  keepShipVisible(list);
  return true;
};

/* One hull, drawn from the same polygon the world draws it with. Scaled to the
   box rather than to its real size, so a Skiff is not a speck beside an
   Tender on a page whose job is comparing them — the size bar says which is
   bigger, and the outline says what each one *is*. */
function drawHull(sh, cx, cy, box, colour, alpha) {
  const { ctx } = api;
  let far = 1;
  const reach = (x, y) => { far = Math.max(far, Math.hypot(x, y)); };
  for (const p of sh.art) reach(p[0], p[1]);
  for (const f of sh.fins || []) { reach(f[0][0], f[0][1]); reach(f[1][0], f[1][1]); }
  for (const g of sh.guns || []) reach(g[0] + (g[2] || 5), g[1]);
  // The jaws hang fifteen units off the nose, open.
  if (sh.weapon === "claw") reach((sh.noseX || 12) + 12, 13);
  const k = box / far;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  /* The same drawing the world uses, holds and windows and all. The page
     compares hulls, and a hull drawn with half its detail missing is not the
     hull you will be flying. */
  if (api.drawHullArt) {
    api.drawHullArt(sh, colour, 1 / k, alpha);
  } else {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6 / k;
    ctx.beginPath();
    sh.art.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

HUD.drawHangar = function (st, dt) {
  const { ctx, SCREEN_W } = api;
  st = st || {};
  const list = st.ships || [];
  if (!list.length) return;
  const cols = SHIP_COLS();
  hangar.pick = Math.max(0, Math.min(list.length - 1, hangar.pick));
  if (!HANGAR_CATEGORIES.some(c => c.key === hangar.category)) {
    hangar.category = list[hangar.pick].category;
  }
  let group = categoryShips(list);
  if (!group.some(x => x.index === hangar.pick)) {
    hangar.pick = group.length ? group[0].index : 0;
  }
  group = categoryShips(list);
  hangar.count = group.length;
  const tone = categoryTone(hangar.category);

  pageFrame("HANGAR",
            (st.shipName || "SKIFF") + "  \u00b7  " + hudMoney(st.cash),
            "");

  /* Eight colours, eight shelves. One category at a time is less to scan than
     twenty-five mixed cards, and colour makes the current shelf visible before
     its word has been read. */
  const tabGap = 4;
  const tabW = (SCREEN_W - PAGE.EDGE * 2 - tabGap * (HANGAR_CATEGORIES.length - 1)) /
               HANGAR_CATEGORIES.length;
  HANGAR_CATEGORIES.forEach((cat, i) => {
    const x = PAGE.EDGE + i * (tabW + tabGap);
    const y = PAGE.TOP;
    const on = cat.key === hangar.category;
    ctx.save();
    ctx.fillStyle = cat.colour;
    ctx.globalAlpha = on ? 0.18 : 0.035;
    ctx.fillRect(x, y, tabW, SHIP_CATEGORY_H);
    ctx.strokeStyle = cat.colour;
    ctx.globalAlpha = on ? 1 : 0.38;
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(x, y, tabW, SHIP_CATEGORY_H);
    ctx.restore();
    fitText(cat.key, x + tabW / 2, y + 28, SIZE.cap, cat.colour, "center",
            on ? 1 : 0.72, tabW - 10, "0.04em");
    tap({ x, y, w: tabW, h: SHIP_CATEGORY_H,
          act: () => chooseHangarCategory(cat.key, list) });
  });

  /* A catalogue, laid out like the almanac for the same reason the almanac is
     laid out that way: the picture is the point, and nobody ever picked a ship
     off a table of numbers. */
  /* `hangar.scroll` is a float — a wheel and a thumb both arrive as pixels, so
     it has to be — and `first` was `scroll * cols` straight off it. A
     fractional array index is `undefined`, so the moment anybody scrolled by
     anything other than a whole row the grid simply drew nothing and the page
     went blank. That is the bug behind "the scroll in the hangar doesn't work".

     So: floor for the index, and put the fraction back as an offset, which is
     how the almanac has always done it. The rows are clipped to their own area
     for the same reason — a card leaving the top has to be cut off by the list
     rather than drawn over the heading. */
  const cardH = 104, pitch = cardH + PAGE.STEP;
  const firstRow = Math.floor(hangar.scroll);
  const first = firstRow * cols;
  const rowsAll = Math.ceil(group.length / cols);
  const rowsShown = Math.min(SHIP_ROWS(), Math.max(1, rowsAll));
  const last = Math.min(group.length, first + (rowsShown + 1) * cols);
  const gridTop = SHIP_GRID_TOP();
  const viewTop = gridTop - 6;
  const viewH = rowsShown * pitch - PAGE.STEP + 12;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewTop, SCREEN_W, viewH);
  ctx.clip();
  tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });

  for (let j = first; j < last; j++) {
    const entry = group[j];
    const sh = entry && entry.sh;
    if (!sh) continue;
    const i = entry.index;
    const c = COL(cols, (j - first) % cols);
    const row = Math.floor((j - first) / cols);
    const y = gridTop + (row - (hangar.scroll - firstRow)) * pitch;
    const on = i === hangar.pick;
    const reach = sh.owned || sh.afford;
    const colour = sh.flying ? HUD_CASH : reach ? tone : WRECKC;

    ctx.save();
    ctx.fillStyle = sh.flying ? HUD_CASH : tone;
    ctx.globalAlpha = on ? 0.13 : 0.025;
    ctx.fillRect(c.x, y, c.w, cardH);
    ctx.strokeStyle = on ? (sh.flying ? HUD_CASH : tone) : tone;
    ctx.globalAlpha = on ? 1 : 0.35;
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(c.x, y, c.w, cardH);
    // A footing rule under the art, so the name sits on something.
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(c.x + PAGE.PAD, y + 62);
    ctx.lineTo(c.x + c.w - PAGE.PAD, y + 62);
    ctx.stroke();
    ctx.restore();

    drawHull(sh, c.x + c.w / 2, y + 32, 26, colour, reach ? 1 : 0.35);
    const bestShort = sh.best === "FIRE RATE" ? "RATE" : sh.best;
    const footW = c.w - PAGE.PAD * 2;
    fitText(sh.name, c.x + PAGE.PAD, y + 80, SIZE.cap, colour, "left",
            reach ? 1 : 0.7, footW * 0.6, "0.08em");
    fitText(bestShort + " ↑", c.x + PAGE.PAD, y + 98,
            SIZE.cap, colour, "left", reach ? 0.82 : 0.55,
            footW * 0.5, "0.04em");
    fitText(sh.flying ? "FLYING" : sh.owned ? "OWNED" : hudMoney(sh.cost),
            c.x + c.w - PAGE.PAD, y + 98, SIZE.cap,
            sh.flying ? HUD_CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
            "right", 0.85, footW * 0.45);
    /* The tap window trims this to whatever is inside the list — a card riding
       up under the page heading would be a ship you cannot see and can still
       buy, and `tap` is where that is decided now. */
    tap({ x: c.x, y, w: c.w, h: cardH, act: () => {
      if (hangar.pick === i && reach) {
        if (st.onBuyShip) st.onBuyShip(sh.key);
      } else hangar.pick = i;
    } });
  }
  ctx.restore();
  tapClipOff();

  if (rowsAll > SHIP_ROWS()) {
    const trackH = SHIP_ROWS() * (cardH + PAGE.STEP) - PAGE.STEP;
    const h = Math.max(26, trackH * (SHIP_ROWS() / rowsAll));
    const t = rowsAll - SHIP_ROWS() ? hangar.scroll / (rowsAll - SHIP_ROWS()) : 0;
    ctx.save();
    ctx.fillStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(SCREEN_W - 22, gridTop, 3, trackH);
    ctx.fillStyle = tone;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(SCREEN_W - 22, gridTop + t * (trackH - h), 3, h);
    ctx.restore();
  }

  /* ── the one you are looking at ────────────────────────────────────────
     Eight bars against the best in the roster rather than against an absolute:
     "how does this compare to everything else on the page" is the only
     question a shipyard is ever asked. */
  const sh = list[hangar.pick];
  /* **Against the one you are flying.** The bars say where a hull sits in the
     whole roster, which is a catalogue's question; the one you actually ask
     standing in a hangar is "is this better than what I have". So every stat
     carries the difference from your current hull, coloured by which way it
     goes, and a mark on its bar where your hull sits — and the line under the
     name counts them up, so the answer is readable before any number is. */
  const cur = list.find(o => o.flying) || null;
  const vs = cur && cur !== sh ? cur : null;
  const dy = gridTop + rowsShown * (cardH + PAGE.STEP);
  const best = k => list.reduce((m, o) => Math.max(m, o[k] || 0), 0.0001);
  /* [label, the field the bar compares, the number shown, how to print it].
     The bar reads the roster-relative field; the number and the difference
     are in the units you fly in. */
  const stats = [
    ["HULL",   "hull",  o => o.hull,             v => String(Math.round(v))],
    ["DAMAGE", "dmg",   o => o.dmg,              v => v.toFixed(2) + "x"],
    ["RATE",   "rate",  o => o.rate,             v => v.toFixed(2) + "x"],
    ["CARGO",  "cargo", o => o.cargo,            v => String(Math.round(v))],
    ["SPEED",  "speed", o => o.topSpeed || 0,    v => Math.round(v) + " u/s"],
    ["ACCEL",  "accel", o => o.push || 0,        v => Math.round(v) + " u/s²"],
    ["TURN",   "turn",  o => o.turnRate || 0,    v => Math.round(v) + "°/s"],
    /* GRIP: how hard the hull holds the line you point it on. More is more,
       like every other bar here. */
    ["GRIP",   "drag",  o => o.drag,             v => v.toFixed(2)]
  ];
  /* BURST only when it says something. It is three on nearly every hull, so
     it was a full bar on almost every card — a ninth thing to read that
     almost never changed the answer. */
  if ((sh.burst || 3) !== 3 || (vs && (vs.burst || 3) !== 3)) {
    stats.push(["BURST", "burst", o => o.burst || 3, v => String(Math.round(v))]);
  }
  const diff = st0 => {
    if (!vs) return 0;
    const d = st0[2](sh) - st0[2](vs);
    return Math.abs(d) < 1e-6 ? 0 : d;
  };
  const up = stats.filter(x => diff(x) > 0).length;
  const down = stats.filter(x => diff(x) < 0).length;

  const statCols = api.touchOnly ? 4 : stats.length;
  const statRows = Math.ceil(stats.length / statCols);
  const detailH = PANEL_H(Math.max(5, 1 + statRows * 3 + 1));
  panel(PAGE.EDGE, dy, SCREEN_W - PAGE.EDGE * 2, detailH,
        sh.flying ? HUD_CASH : tone, sh.name,
        vs ? "AGAINST YOUR " + vs.name
           : "BEST · " + (sh.best === "FIRE RATE" ? "RATE" : sh.best));

  ctx.save();
  ctx.fillStyle = sh.flying ? HUD_CASH : tone;
  ctx.globalAlpha = 0.75;
  ctx.fillRect(PAGE.EDGE, dy + PAGE.HEAD, 4, detailH - PAGE.HEAD);
  ctx.restore();
  const status = sh.flying ? "FLYING" : sh.owned ? "OWNED"
               : sh.afford ? "AFFORDABLE" : "LOCKED";
  label(status, PAGE.EDGE + PAGE.PAD, ROW(dy, 0), SIZE.cap,
        sh.flying ? HUD_CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
        "left", 0.8, "0.12em");
  if (vs) {
    /* The verdict, in two words and two colours. */
    const vx = PAGE.EDGE + PAGE.PAD + 150;
    label("BETTER AT " + up, vx, ROW(dy, 0), SIZE.cap, HUD_CASH, "left", 0.9, "0.08em");
    label("WORSE AT " + down, vx + 150, ROW(dy, 0), SIZE.cap, WARN, "left", 0.9, "0.08em");
    if (!api.touchOnly) {
      label("│ = YOUR " + vs.name, vx + 300, ROW(dy, 0), SIZE.cap, WRECKC, "left", 0.7);
    }
  }

  const statX = PAGE.EDGE + PAGE.PAD;
  const statArea = SCREEN_W - PAGE.EDGE * 2 - PAGE.PAD * 2;
  const gap = api.touchOnly ? 8 : 12;
  const sw = (statArea - gap * (statCols - 1)) / statCols;
  stats.forEach((row0, i) => {
    const [name, key, read, fmt] = row0;
    const row = Math.floor(i / statCols);
    const x = statX + (i % statCols) * (sw + gap);
    const y = ROW(dy, 1 + row * 3) - 4;
    const bar = sh.flying ? HUD_CASH : tone;
    fitText(name, x, y, SIZE.cap, tone, "left", 0.78, sw, "0.08em");
    const d = diff(row0);
    const val = fmt(read(sh));
    label(val, x, y + 18, SIZE.cap, WRECKC, "left", 0.95);
    if (d) {
      const dtext = (d > 0 ? "+" : "−") + fmt(Math.abs(d)).replace(/ .*$/, "")
                    .replace(/x$/, "");
      // Under the bar, on a line of its own, so it never fights the value.
      fitText(dtext, x, y + 50, SIZE.cap, d > 0 ? HUD_CASH : WARN, "left", 1, sw);
    }
    barAt(x, y + 25, sw, 7, (sh[key] || 0) / best(key), bar, false);
    if (vs) {
      // Where your hull sits on the same bar: a white tick through it.
      const mx = x + 1 + (sw - 2) * Math.min(1, (vs[key] || 0) / best(key));
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, y + 22); ctx.lineTo(mx, y + 35);
      ctx.stroke();
      ctx.restore();
    }
  });

  const reach = sh.owned || sh.afford;
  button(sh.flying ? "FLYING" : sh.owned ? "FLY" :
           sh.afford ? "BUY " + hudMoney(sh.cost) : "NEED " + hudMoney(sh.cost),
         SCREEN_W - PAGE.EDGE - 110, dy + detailH - 34, 200, 40,
         sh.flying ? VIOLET_LOW : reach ? HUD_CASH : WARN,
         sh.flying || !reach ? null
           : () => st.onBuyShip && st.onBuyShip(sh.key),
         false, !sh.flying && reach);

  pageNav(st, "hangar", PLACE_TABS, PLACE_TONE);
  closeButton(st.onClose || (() => {}));
};
