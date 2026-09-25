"use strict";
/* KONDRITE — SURVEY INTERFACE: THE RECORD
   ─────────────────────────────────────────────────────────────────────────────
   The record, the sector as a board, who is wanted, and what the station is short of. */

/* ═══ THE RECORD ══════════════════════════════════════════════════════════
   Everything the run has *accumulated*, as against everything it is carrying.
   These five bands used to sit under the cargo and the slots on one page,
   which made the inventory eight panels deep and buried the two numbers a
   player checks on every dock under four they read once a trip.

   They are one page now and they belong together: who you are to the powers,
   who knows your name, the book, what has happened, and the station you are
   putting back together. None of it is in the hold. */
let recPg = { scroll: 0 };
HUD.recordOpened = function () { recPg.scroll = 0; };
HUD.recordScrollBy = function (dy, total, view) {
  const max = Math.max(0, total - view);
  recPg.scroll = Math.max(0, Math.min(max, recPg.scroll + dy));
};

/* ── the sector, as a board ─────────────────────────────────────────────
   Three tiles and a triangle, and the only words on it are the three
   names. Each tile: the flag's square and name, then bars — how much
   fight it has left, how much of the sky around you it holds, and the
   three goods it trades in. The triangle at the right is who feels what
   about whom: an edge per pair, red and thick for a war, red-thin for bad
   blood, green for friends, dim for nothing much. (LIVING-WORLD.md, with
   Ric's rule that the visuals do the talking.) */
/* The three laws, as glyphs: letters of marque are the raid strike, a
   closed border is a barred gate, conscription is a chevron. Lit when the
   law is on, a ghost when it is off, so a tile reads at a glance. */
function lawGlyph(ctx, law, x, y, r) {
  switch (law) {
    case "privateers": markGlyph(ctx, "raid", x, y, r); break;
    case "borders":
      ctx.beginPath();
      ctx.moveTo(x - r, y - r); ctx.lineTo(x - r, y + r);
      ctx.moveTo(x + r, y - r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x - r * 1.3, y); ctx.lineTo(x + r * 1.3, y);
      ctx.stroke();
      break;
    case "conscription":
      ctx.beginPath();
      ctx.moveTo(x - r, y + r * 0.7); ctx.lineTo(x, y - r * 0.6); ctx.lineTo(x + r, y + r * 0.7);
      ctx.moveTo(x - r, y + r * 1.4); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r, y + r * 1.4);
      ctx.stroke();
      break;
  }
}
function sectorBoard(st, full, y0) {
  const { ctx } = api;
  const L = st.living;
  const rows = 6;
  const h = PANEL_H(rows);
  const here = L.here || {};
  const hereWord = here.owner
    ? (here.contested ? "CONTESTED" : here.control > 0.7 ? "HELD" : "LOOSELY HELD")
    : "NOBODY'S";
  panel(full.x, y0, full.w, h, VIOLET, "THE SECTOR", hereWord);
  const triW = 150, capW = 92;
  const tileW = Math.floor((full.w - PAGE.PAD * 2 - triW - capW) / L.powers.length);
  const bar = (x, y, w, v, colour, alpha) => {
    ctx.save();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = VIOLET_LOW; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 6);
    ctx.globalAlpha = alpha || 0.9; ctx.fillStyle = colour;
    ctx.fillRect(x + 1, y + 1, Math.max(1, (w - 2) * Math.max(0, Math.min(1, v))), 4);
    ctx.restore();
  };
  L.powers.forEach((pw, i) => {
    const x = full.x + PAGE.PAD + capW + i * tileW;
    const y = ROW(y0, 0);
    ctx.save();
    ctx.fillStyle = pw.colour; ctx.globalAlpha = 0.95;
    ctx.fillRect(x, y - 9, 9, 9);
    if (pw.cause && pw.fromColour) { ctx.fillStyle = pw.fromColour; ctx.fillRect(x + 3, y - 6, 3, 3); }
    ctx.restore();
    fitText(pw.short, x + 16, y, SIZE.cap, pw.colour, "left", 1, tileW - 40, "0.08em");
    if (pw.atWar) {
      ctx.save(); ctx.strokeStyle = WARN; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.9;
      markGlyph(ctx, "war", x + tileW - 30, y - 5, 5);
      ctx.restore();
    }
    const bw = tileW - 24;
    bar(x, ROW(y0, 1) - 6, bw, pw.strength, pw.colour);
    bar(x, ROW(y0, 2) - 6, bw, pw.holdings, pw.colour, 0.55);
    // The three goods, side by side, in the goods' own colours.
    const gw = Math.floor((bw - 8) / 3);
    pw.goods.forEach((g, k) => bar(x + k * (gw + 4), ROW(y0, 3) - 6, gw, g.v, g.colour, 0.8));
    // Who is in charge, and how much anybody wants them to be: the name in
    // the flag's colour, the popularity as a bar beside it (§7).
    if (pw.leader) {
      const nameW = Math.floor(bw * 0.62);
      fitText(pw.leader.name, x, ROW(y0, 4), 11, pw.colour, "left", 0.9, nameW, "0.04em");
      bar(x + nameW + 6, ROW(y0, 4) - 6, bw - nameW - 6, pw.leader.popularity, VIOLET, 0.85);
    }
    // The law (§6): three glyphs, lit or ghosted.
    (pw.laws || []).forEach((law, k) => {
      ctx.save();
      ctx.strokeStyle = law.on ? AMBER : VIOLET_LOW; ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = law.on ? 1.5 : 1; ctx.globalAlpha = law.on ? 0.95 : 0.3;
      lawGlyph(ctx, law.key, x + 7 + k * 22, ROW(y0, 5) - 6, 5);
      ctx.restore();
    });
  });
  // Row captions, once, small and dim, in their own column at the left.
  const cap = (row, word) =>
    label(word, full.x + PAGE.PAD, ROW(y0, row) - 1, 11, VIOLET_LOW, "left", 0.6, "0.12em");
  cap(1, "FIGHT"); cap(2, "SKY HELD"); cap(3, "GOODS"); cap(4, "LEADER"); cap(5, "LAWS");

  // The triangle.
  const cx = full.x + full.w - PAGE.PAD - triW / 2, cy = y0 + h / 2 + 6, r = 34;
  const pts = L.powers.map((pw, i) => {
    const a = -Math.PI / 2 + (i / L.powers.length) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, pw };
  });
  ctx.save();
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b2 = pts[j];
      const rel = ((a.pw.rel[b2.pw.key] || 0) + (b2.pw.rel[a.pw.key] || 0)) / 2;
      const war = a.pw.enemy === b2.pw.key;
      ctx.strokeStyle = war ? WARN : rel < -0.3 ? WARN : rel > 0.3 ? HUD_CASH : VIOLET_LOW;
      ctx.globalAlpha = war ? 0.95 : 0.35 + Math.min(0.5, Math.abs(rel));
      ctx.lineWidth = war ? 3 : 1 + Math.abs(rel) * 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }
  }
  for (const q of pts) {
    ctx.globalAlpha = 1; ctx.fillStyle = q.pw.colour;
    ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  return y0 + h;
}

/* ── what happened ─────────────────────────────────────────────────────
   The record, newest first, one line each: a glyph for the kind of thing,
   the flag's colour on the glyph, the line, and how long ago. The glyphs
   are the same ones the chart uses for the same things. */
function historyPanel(st, full, y0, rows) {
  const { ctx } = api;
  const L = st.living;
  const list = (L.history || []).slice(0, rows || 8);
  const h = PANEL_H(Math.max(1, list.length));
  panel(full.x, y0, full.w, h, AMBER, "HISTORY", "TURN " + (L.turn || 0));
  if (!list.length) {
    fitText("nothing has happened yet — give it a minute",
            full.x + PAGE.PAD, ROW(y0, 0) + 2, SIZE.cap, VIOLET_LOW, "left", 0.6,
            full.w - PAGE.PAD * 2);
    return y0 + h;
  }
  list.forEach((ev, i) => {
    const y = ROW(y0, i) + 2;
    ctx.save();
    ctx.strokeStyle = ev.actor || ev.colour; ctx.fillStyle = ev.actor || ev.colour;
    ctx.lineWidth = 1.4; ctx.globalAlpha = 0.95;
    markGlyph(ctx, ev.glyph, full.x + PAGE.PAD + 6, y - 5, 5);
    ctx.restore();
    fitText(ev.line, full.x + PAGE.PAD + 22, y, SIZE.cap, ev.colour, "left",
            0.5 + ev.importance * 0.5, full.w - PAGE.PAD * 2 - 110, "0.04em");
    const ago = ev.ago < 60 ? "just now" : ev.ago < 3600 ? Math.round(ev.ago / 60) + "m ago"
              : Math.round(ev.ago / 3600) + "h ago";
    label(ago, full.x + full.w - PAGE.PAD, y, SIZE.cap, VIOLET_LOW, "right", 0.6);
  });
  return y0 + h;
}

/* ═══ THE SECTOR ═════════════════════════════════════════════════════════
   The living world's page (LIVING-WORLD.md). Everything on it is drawn
   before it is said: the board of the three powers, the history as glyphs
   with one line each, and the bounties. It scrolls like the record does. */
let secPg = { scroll: 0 };
HUD.sectorOpened = function () { secPg.scroll = 0; };
HUD.sectorScrollBy = function (dy, total, view) {
  const max = Math.max(0, total - view);
  secPg.scroll = Math.max(0, Math.min(max, secPg.scroll + dy));
};
HUD.drawSector = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const L = st.living;
  const here = L && L.here;
  pageFrame("THE SECTOR",
            here && here.owner
              ? (here.contested ? "CONTESTED SKY" : here.control > 0.7 ? "HELD SKY" : "LOOSELY HELD SKY")
              : "NOBODY'S SKY",
            "", SHIP_TONE);
  const viewTop = PAGE.TOP - 4;
  const viewH = SCREEN_H - viewTop - 16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewTop, SCREEN_W, viewH);
  ctx.clip();
  tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });
  let y = PAGE.TOP - secPg.scroll;
  const gap = PAGE.STEP;
  if (!L) {
    fitText("the sector is still waking up", full.x + PAGE.PAD, y + 20, SIZE.cap,
            VIOLET_LOW, "left", 0.6, full.w);
    y += 40;
  } else {
    y = sectorBoard(st, full, y) + gap;
    y = historyPanel(st, full, y, 12) + gap;
    y = bountyPanel(st, full, y) + gap;
  }
  const total = (y + secPg.scroll) - PAGE.TOP;
  secPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH), secPg.scroll));
  HUD.sectorHeight = total;
  HUD.sectorView = viewH;
  tapClipOff();
  ctx.restore();
  if (total > viewH) {
    scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
               secPg.scroll / Math.max(1, total - viewH));
  }
  pageNav(st, "sector", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};

/* ── who is wanted ─────────────────────────────────────────────────────
   A name, a flag and a figure. Posted by a power when a raider got away
   from you in its sky; paid when you finish it. */
function bountyPanel(st, full, y0) {
  const { ctx } = api;
  const list = (st.living && st.living.bounties) || [];
  const h = PANEL_H(Math.max(1, list.length));
  panel(full.x, y0, full.w, h, WARN, "BOUNTIES", list.length ? "PAID ON THE KILL" : "");
  if (!list.length) {
    fitText("nobody is wanted yet — a raider that escapes you in held sky will be",
            full.x + PAGE.PAD, ROW(y0, 0) + 2, SIZE.cap, VIOLET_LOW, "left", 0.6,
            full.w - PAGE.PAD * 2);
    return y0 + h;
  }
  list.forEach((b, i) => {
    const y = ROW(y0, i) + 2;
    ctx.save();
    ctx.fillStyle = b.colour; ctx.globalAlpha = 0.9;
    ctx.fillRect(full.x + PAGE.PAD, y - 9, 9, 9);
    ctx.restore();
    fitText(b.name, full.x + PAGE.PAD + 18, y, SIZE.cap, WARN, "left", 0.95, 300, "0.06em");
    label(b.by, full.x + PAGE.PAD + 330, y, SIZE.cap, b.colour, "left", 0.8, "0.08em");
    label(hudMoney(b.amount), full.x + full.w - PAGE.PAD, y, SIZE.cap, HUD_CASH, "right", 0.95);
  });
  return y0 + h;
}

HUD.drawRecord = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const flags = st.standings || [];
  const others = st.others || [];

  pageFrame("RECORD",
            (st.shipName || "") + "   \u00b7   " + hudMoney(st.cash || 0), "",
            SHIP_TONE);

  const viewTop = PAGE.TOP - 4;
  const viewH = SCREEN_H - viewTop - 16;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, viewTop, SCREEN_W, viewH);
  ctx.clip();
  tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });

  let y = PAGE.TOP - recPg.scroll;
  const gap = PAGE.STEP;

  /* What you are building comes first. It is the only thing on this page you
     can act on — the rest is a record of what has already happened — and it
     used to be a door at the bottom of the scroll saying only that it was
     there. */
  y = missionBands(st, full, y) + gap;

  /* ── who you are to them ─────────────────────────────────────────────── */
  const repH = PANEL_H(flags.length * 2 + others.length);
  panel(full.x, y, full.w, repH, VIOLET, "REPUTATION",
        st.war ? st.war.a + " AT WAR WITH " + st.war.b : "NO WAR HERE");
  flags.forEach((f, i) => {
    const yTop = ROW(y, i * 2) + 2, yBot = ROW(y, i * 2 + 1) - 4;
    const bad = f.standing === "HUNTED" || f.standing === "WANTED";
    const warm = f.standing === "WELCOME" || f.standing === "TRUSTED";
    // Its own colour, which is the colour its ships are painted — so the board
    // and the sky agree about who is who.
    ctx.save();
    ctx.fillStyle = f.colour;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(full.x + PAGE.PAD, yTop - 9, 9, 9);
    ctx.restore();
    fitText(f.name, full.x + PAGE.PAD + 18, yTop, SIZE.cap, f.colour, "left",
            1, 260, "0.08em");
    label(f.standing, full.x + PAGE.PAD + 300, yTop, SIZE.cap,
          bad ? WARN : warm ? HUD_CASH : VIOLET_DIM, "left", bad ? 1 : 0.85, "0.1em");
    fitText(f.enemy ? "at war with " + f.enemy : "not fighting anybody",
            full.x + full.w - PAGE.PAD, yTop, SIZE.cap,
            f.enemy ? WARN : VIOLET_LOW, "right", f.enemy ? 0.85 : 0.5, 260);
    fitText(f.long || f.note, full.x + PAGE.PAD + 18, yBot, SIZE.cap,
            VIOLET_DIM, "left", 0.62, full.w - PAGE.PAD * 2 - 24);
  });
  others.forEach((f, i) => {
    const yy = ROW(y, flags.length * 2 + i) + 2;
    ctx.save();
    ctx.fillStyle = f.colour;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(full.x + PAGE.PAD, yy - 9, 9, 9);
    ctx.restore();
    fitText(f.short, full.x + PAGE.PAD + 18, yy, SIZE.cap, f.colour, "left",
            0.95, 120, "0.08em");
    fitText(f.long || f.note, full.x + PAGE.PAD + 146, yy, SIZE.cap,
            VIOLET_DIM, "left", 0.6, full.w - PAGE.PAD * 2 - 160);
  });
  y += repH + gap;

  /* ── who knows you by name ───────────────────────────────────────────────
     Almost nothing out here is named. Two kinds of ship earn one: the ones you
     pulled out of trouble, and the ones you shot and did not finish. This is
     where you read them back, because "a consequence you can name is a
     consequence you remember" is only true if you can still find the name.

     Never a count of anything. A tally would turn both lists into scores. */
  const friends = (st.whoKnows && st.whoKnows.friends) || [];
  const grudges = (st.whoKnows && st.whoKnows.grudges) || [];
  const knownRows = Math.max(1, friends.length + grudges.length);
  const knownH = PANEL_H(knownRows);
  panel(full.x, y, full.w, knownH, HUD_CASH, "WHO KNOWS YOU",
        grudges.length ? "SOMEBODY IS LOOKING FOR YOU" : "");
  if (!friends.length && !grudges.length) {
    fitText("nobody out here knows you by name yet — help somebody, " +
            "or let somebody get away",
            full.x + PAGE.PAD, ROW(y, 0) + 2, SIZE.cap, VIOLET_LOW, "left",
            0.6, full.w - PAGE.PAD * 2);
  }
  friends.forEach((f, i) => {
    const yy = ROW(y, i) + 2;
    fitText(f.name, full.x + PAGE.PAD, yy, SIZE.cap, HUD_CASH, "left", 0.95, 280,
            "0.06em");
    label(f.faction, full.x + PAGE.PAD + 300, yy, SIZE.cap, VIOLET_DIM,
          "left", 0.7, "0.08em");
    fitText(f.why === "water" ? (f.repaid ? "you gave them water · squared"
                                          : "you gave them water")
                              : (f.repaid ? "you got them out of it · squared"
                                          : "you got them out of it"),
            full.x + full.w - PAGE.PAD, yy, SIZE.cap,
            f.repaid ? VIOLET_LOW : HUD_CASH, "right", f.repaid ? 0.5 : 0.8, 300);
  });
  grudges.forEach((g, i) => {
    const yy = ROW(y, friends.length + i) + 2;
    fitText(g.name, full.x + PAGE.PAD, yy, SIZE.cap, WARN, "left", 1, 280,
            "0.06em");
    label("PIRATE", full.x + PAGE.PAD + 300, yy, SIZE.cap, VIOLET_DIM,
          "left", 0.7, "0.08em");
    fitText("got away from you · coming back", full.x + full.w - PAGE.PAD, yy,
            SIZE.cap, WARN, "right", 0.85, 300);
  });
  y += knownH + gap;

  /* ── the book ────────────────────────────────────────────────────────── */
  const bookH = PANEL_H(2);
  panel(full.x, y, full.w, bookH, AMBER, "THE ALMANAC",
        (st.found || 0) + " LOGGED");
  drawBookMark(full.x + PAGE.PAD + 22, y + PAGE.HEAD + 20, 20, AMBER);
  label("OPEN THE BOOK" + (api.touchOnly ? "" : "   [L]"),
        full.x + PAGE.PAD + 62, ROW(y, 0) + 2, SIZE.val, AMBER, "left");
  fitText("every strange thing you have seen, and the ones you have not",
          full.x + PAGE.PAD + 62, ROW(y, 1) + 2, SIZE.cap, VIOLET_DIM,
          "left", 0.6, full.w - PAGE.PAD * 2 - 80);
  tap({ x: full.x, y, w: full.w, h: bookH,
               act: st.onAlmanac || (() => {}) });
  y += bookH + gap;

  /* ── what has happened ───────────────────────────────────────────────
     The log. Everything the sector said, newest first, because it scrolled
     past the corner of the screen and was gone — and the interesting lines are
     usually about something somebody else did while you were reading a page. */
  const log = (api.logOf && api.logOf()) || HUD.log();
  const logRows = Math.min(10, Math.max(1, log.length));
  const logH = PANEL_H(logRows);
  panel(full.x, y, full.w, logH, VIOLET_DIM, "WHAT HAPPENED",
        log.length ? log.length + " LINES" : "QUIET SO FAR");
  if (!log.length) {
    fitText("Nothing has been said yet.", full.x + PAGE.PAD, ROW(y, 0) + 2,
            SIZE.cap, VIOLET_LOW, "left", 0.6, full.w - PAGE.PAD * 2);
  }
  log.slice(0, logRows).forEach((n, i) => {
    const yy = ROW(y, i) + 2;
    fitText(n.text + (n.n > 1 ? "   \u00d7" + n.n : ""),
            full.x + PAGE.PAD, yy, SIZE.cap, n.colour, "left", 0.85,
            full.w - PAGE.PAD * 2);
  });
  y += logH + gap;



  ctx.restore();
  tapClipOff();

  const total = (y + recPg.scroll) - PAGE.TOP;
  recPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH), recPg.scroll));
  HUD.recordHeight = total;
  HUD.recordView = viewH;
  if (total > viewH) {
    scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
               recPg.scroll / Math.max(1, total - viewH));
  }

  pageNav(st, "record", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};

/* A little closed book, for the panel that opens the almanac. Drawn rather than
   set as a glyph, for the same reason the warning triangle is. */
function drawBookMark(cx, cy, r, colour) {
  const { ctx } = api;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.7, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.7, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.7, cy + r * 0.8);
  ctx.lineTo(cx - r * 0.7, cy + r * 0.8);
  ctx.closePath();
  ctx.stroke();
  // A spine and two lines of type.
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.34, cy - r * 0.8);
  ctx.lineTo(cx - r * 0.34, cy + r * 0.8);
  ctx.moveTo(cx - r * 0.1, cy - r * 0.3);
  ctx.lineTo(cx + r * 0.45, cy - r * 0.3);
  ctx.moveTo(cx - r * 0.1, cy + r * 0.1);
  ctx.lineTo(cx + r * 0.45, cy + r * 0.1);
  ctx.stroke();
  ctx.restore();
}

function panel(x, y, w, h, colour, title, right) {
  const { ctx } = api;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.035;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.moveTo(x + PAGE.PAD, y + PAGE.HEAD - 8);
  ctx.lineTo(x + w - PAGE.PAD, y + PAGE.HEAD - 8);
  ctx.stroke();
  ctx.restore();
  label(title, x + PAGE.PAD, y + PAGE.HEAD - 16, SIZE.cap, colour, "left",
        0.9, "0.16em");
  if (right) {
    label(right, x + w - PAGE.PAD, y + PAGE.HEAD - 16, SIZE.cap, colour,
          "right", 0.6);
  }
}

/* A button in the module's own type rather than the engine's. `api.tapButton`
   draws its label at a hard 18px, which sat a pixel off every heading on every
   page — two "medium" sizes doing one job, one of them from a different file.
   Same rectangle, same tap registration, the pages' own scale. */
/* Every button in the mode goes through here, so this is the one place that
   can make all of them a thumb-sized target at once. A phone gets a quarter
   more height and a wider tap box than the drawn one — the box you press is
   allowed to be bigger than the box you see, and on a phone it should be. */
function button(text, cx, cy, w, h, colour, act, on, live, track, hold) {
  const { ctx } = api;
  const enabled = live === undefined ? true : !!live;
  /* Only buttons that have room to grow. A phone needs bigger targets, but the
     market is a list of rows 30 apart with a 26-high button on each, and
     inflating those made every row's target overlap the one below it — a
     target that overlaps its neighbour is worse than a small one, because now
     the press lands on the wrong thing instead of on nothing.

     The width is left alone for the same reason: six navigation tabs are laid
     out to fill the row exactly, so widening each one by six per cent makes
     every tab overlap both its neighbours. */
  if (api.touchOnly && h >= 30) h = Math.round(h * 1.2);
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = enabled ? (on ? 0.18 : 0.06) : 0.02;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeStyle = colour;
  // A 0.45 border is a suggestion of a button. It is a button.
  ctx.globalAlpha = enabled ? (on ? 1 : 0.8) : 0.3;
  ctx.lineWidth = on ? 2.5 : 1.5;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
  fitText(text, cx, cy + 6, SIZE.cap, colour, "center",
          enabled ? 1 : 0.5, w - 18, track === undefined ? "0.12em" : track);
  if (enabled && typeof act === "function") {
    // `hold` makes it fire on the press and keep firing. See `startHold` in
    // the game: it is how + and - reach a hundred without a hundred presses.
    tap({ x: cx - w / 2, y: cy - h / 2, w, h, act, hold: !!hold });
  }
}

function barAt(x, y, w, h, frac, colour, warn) {
  const { ctx } = api;
  ctx.save();
  ctx.strokeStyle = warn ? WARN : colour;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = warn ? WARN : colour;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.min(1, frac)), h - 2);
  ctx.restore();
}

/* ═══ WHAT THE STATION IS SHORT OF ════════════════════════════════════════
   Says what your own station still wants, what each part turns back on, and
   the clue for each one you have not brought in yet. The clue is the whole
   navigation system, so this is the page you come back to when you do not
   know where to go next.

   One page, two ways in. The station opens it because that is where the parts
   go; the strip opens it from anywhere because "what am I looking for" is a
   question you ask a long way from home, and the answer used to be a
   permanent band across the top of the flight screen. `atHomeDock` is the
   only difference: the same content, and a title that knows whether you are
   standing in the place it is about. */

/* ── the station, as bands ────────────────────────────────────────────────
   Drawn against a `y` you hand it rather than against the top of a page, so
   the same three panels can be the whole of the yard's page and the first
   thing on the record. They were one page and a door to it, which meant the
   one list telling you where to go next lived behind a panel that said only
   that it existed. Returns where it finished. */
function missionBands(st, full, y0) {
  const { ctx, SCREEN_W } = api;
  const b = st.builds || { name: "YOUR STATION", does: "", blurb: "" };
  const done = st.built || 0, need = st.needs || 6;
  const finished = done >= need;

  /* ── what is being built ───────────────────────────────────────────────
     The ring stays: it is the same shape the yard draws out in the world, one
     segment a part, and it is the only progress readout in the mode that is a
     picture of the thing rather than a bar. It sits at the end of the header
     row rather than in the middle of the page, so the words lead. */
  const headH = PANEL_H(2);
  panel(full.x, y0, full.w, headH, finished ? HUD_CASH : VIOLET,
        finished ? "WHOLE" : "BROKEN", done + " / " + need);
  fitText(b.name, full.x + PAGE.PAD, ROW(y0, 0) + 4, SIZE.head,
          finished ? HUD_CASH : VIOLET, "left", 1, full.w - 320, "0.12em");
  fitText(finished ? b.does : b.blurb, full.x + PAGE.PAD, ROW(y0, 1) + 6,
          SIZE.cap, finished ? CASH_DIM : VIOLET_DIM, "left", 0.8,
          full.w - 320);

  const rx = full.x + full.w - PAGE.PAD - 34;
  const ry = y0 + headH / 2, rr = 28;
  ctx.save();
  ctx.strokeStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < done; i++) {
    const a0 = (i / need) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / need) * Math.PI * 2 - Math.PI / 2;
    api.glow(HUD_CASH, 3.4, 0.95, () => {
      ctx.beginPath(); ctx.arc(rx, ry, rr, a0 + 0.06, a1 - 0.06); ctx.stroke();
    });
  }

  /* ── the manifest ──────────────────────────────────────────────────────
     One row a part: a mark, the name, the clue, and where it stands. The clue
     is the whole navigation system, so it gets the width — everything else on
     the line is as short as it can be. Alternate rows are banded, which is
     what lets an eye track a clue back to its name across 900 pixels. */
  const listY = y0 + headH + PAGE.STEP;
  /* Six rows that all say "fitted" is a monument, and the page has somewhere
     better to spend two hundred pixels once the station is whole — see the long
     list below, which is the thing that answers *what now* and needs the
     room. The manifest collapses to the one line that is still worth reading:
     that it is done. */
  const man = finished ? [] : (st.manifest || []);
  /* It says *parts*, in as many places as it takes. The page listed six names
     and six clues and never once said what the six things were or what you were
     supposed to do with them — so the manifest read as a set of riddles rather
     than as a shopping list with a delivery address. */
  panel(full.x, listY, full.w, PANEL_H(man.length + 1), VIOLET, "THE MANIFEST",
        finished ? "ALL SIX PARTS FITTED"
                 : (need - done) + " ROOMS STILL DARK");
  fitText(finished
            ? "every part is in. that was the tutorial."
            : "six parts, scattered across the sector. find one, fly it home, " +
              "and a room of your station comes back on.",
          full.x + PAGE.PAD, ROW(listY, 0) + 2, SIZE.cap, VIOLET_DIM, "left",
          0.7, full.w - PAGE.PAD * 2);
  man.forEach((m, i) => {
    const y = ROW(listY, i + 1);
    const have = m.have, aboard = m.carrying;
    const colour = have ? CASH_DIM : aboard ? HUD_CASH : VIOLET;
    if (i % 2 === 1) {
      ctx.save();
      ctx.fillStyle = VIOLET;
      ctx.globalAlpha = 0.03;
      ctx.fillRect(full.x + 1, y - 18, full.w - 2, PAGE.STEP);
      ctx.restore();
    }
    label(have ? "\u2713" : aboard ? "\u25b2" : "\u00b7",
          full.x + PAGE.PAD, y, SIZE.cap, colour, "left", have ? 0.7 : 1);
    fitText(m.name, full.x + PAGE.PAD + 22, y, SIZE.cap, colour, "left",
            have ? 0.6 : 1, 190, "0.08em");
    /* The clue keeps the width. It is the whole navigation system — a
       manifest row that names a part and cuts the sentence telling you where
       it is has given away the only thing on the page you cannot work out for
       yourself. */
    fitText(have ? "fitted" : aboard ? "aboard \u2014 take it home" : m.clue,
            full.x + 250, y, SIZE.cap,
            have ? CASH_DIM : aboard ? HUD_CASH : AMBER_DIM, "left",
            have ? 0.45 : 0.8, full.w - 444);
    /* And what it turns on, in the column that used to say WANTED, ABOARD or
       FITTED. Those three were the row's state said a second time — the mark
       at the head of it and the colour of the whole line already say it — and
       the state of a *room* is a better thing to spend the column on than the
       state of the errand. */
    fitText(m.service || "", full.x + full.w - PAGE.PAD, y, SIZE.cap,
            have ? CASH_DIM : aboard ? HUD_CASH : AMBER, "right",
            have ? 0.5 : 0.9, 160, "0.06em");
  });

  /* The yard's second project, shown only once the first is finished:
     offering it beside six parts you have not found would make the page a list
     of two things you cannot have. */
  const L = st.light;
  if (finished && L) {
    const ly = listY + PANEL_H(man.length + 1) + PAGE.STEP;
    panel(full.x, ly, full.w, PANEL_H(2), ICE,
          L.have ? L.name + " \u2014 FITTED" : L.name,
          L.have ? (api.touchOnly ? "READY" : "READY  \u00b7  [R] TO RUN")
                 : hudMoney(L.cost));
    fitText(L.have ? L.does : L.blurb, full.x + PAGE.PAD, ROW(ly, 0) + 2,
            SIZE.cap, L.have ? ICE : VIOLET_DIM, "left", 0.85,
            full.w - (L.have ? 280 : 320));
    if (!L.have) {
      /* Two hundred wide was not enough for "BUILD IT   ¤2,400" and the
         price is the half that got cut — the button read "BUILD IT ¤2,…",
         which is the one number on it anybody needs. Wider, and the blurb
         beside it gives up the room. */
      button("BUILD IT   " + hudMoney(L.cost), full.x + full.w - PAGE.PAD - 118,
             ly + PANEL_H(2) / 2, 236, 40, L.afford ? ICE : WARN,
             L.afford ? (st.onBuildLight || (() => {})) : null,
             false, !!L.afford);
    }
  }


  let tail = (finished && st.light)
    ? listY + PANEL_H(man.length + 1) + PAGE.STEP + PANEL_H(2)
    : listY + PANEL_H(man.length + 1);

  /* ── the long list ─────────────────────────────────────────────────────
     What the manifest becomes. Six parts you were told to fetch, then eleven
     you were never told existed: the two nobody sells and the nine kept on
     shelves hundreds of thousands of units out. None of them is on the
     workbench and none is on a shelf near home, so until this list there was
     no surface in the game where a player could *meet* the best part in any
     category — and a part you have never met is not a reason to fly anywhere.

     It is not a shop and it must not read as one: no prices, no buttons,
     nothing on it can be acted on from here. It is the same kind of object
     the manifest is, which is a list of things that are somewhere else.

     Two columns, because eleven rows down one column is two hundred and
     eighty pixels this page has not got, and the screen is a thousand wide at
     its narrowest. */
  const LL = st.longList || [];
  if (finished && LL.length) {
    const ly = tail + PAGE.STEP;
    const rows = Math.ceil(LL.length / 2);
    panel(full.x, ly, full.w, PANEL_H(rows), AMBER, "NOT FOR SALE HERE",
          LL.filter(p => p.have).length + " / " + LL.length);
    const colW = (full.w - PAGE.PAD * 2) / 2;
    LL.forEach((p, i) => {
      const col = i % 2, row = (i - col) / 2;
      const cx = full.x + PAGE.PAD + col * colW;
      const y = ROW(ly, row);
      /* Owning one greys it, the way a fitted manifest part greys. The row
         stays on the list afterwards: the list is a map of the sector's far
         shelves, and a map you delete the visited half of is a worse map. */
      const col0 = p.have ? CASH_DIM : p.seen ? AMBER : VIOLET;
      drawPartIcon(p.cat, cx + 6, y - 5, 8, col0, p.have ? 0.5 : 0.85);
      /* The names are the long half of this list — TRACTOR BEAM MK3 and
         REVERSE THRUSTERS both came out with an ellipsis at 150, and a list
         whose whole job is telling you a part exists cannot abbreviate the
         part. The address is the shorter half and gives the width up. */
      fitText(p.name, cx + 20, y, SIZE.cap, col0, "left",
              p.have ? 0.5 : 1, 196, "0.06em");
      /* The address. A band and a distance for the nine on far shelves, and
         for the two nobody sells, the fact that no shelf is the answer. */
      fitText(p.at || "", cx + 208, y, SIZE.cap,
              p.have ? CASH_DIM : AMBER_DIM, "left", p.have ? 0.4 : 0.7,
              colW - 222);
    });
    tail = ly + PANEL_H(rows);
  }
  return tail;
}

HUD.drawMissions = function (st, dt) {
  const { ctx, SCREEN_W } = api;
  st = st || {};
  const b = st.builds || { name: "YOUR STATION", does: "", blurb: "" };
  const done = st.built || 0, need = st.needs || 6;
  const finished = done >= need;
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };

  /* The subtitle counted parts, which stops being news the moment they are
     all in — "6 OF 6 PARTS FITTED" is a page telling you about yesterday. Once
     the station is whole it counts the thing that is still counting. */
  const LL = st.longList || [];
  pageFrame(st.atHomeDock ? "YOUR STATION" : "MISSIONS",
            finished
              ? (LL.length
                   ? LL.filter(p => p.have).length + " OF " + LL.length +
                     " HARD-TO-FIND PARTS"
                   : "THE STATION IS WHOLE")
              : done + " OF " + need + " ROOMS RUNNING",
            "", SHIP_TONE);

  missionBands(st, full, PAGE.TOP);
  pageNav(st, "missions", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};
