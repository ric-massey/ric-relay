"use strict";
/* KONDRITE — SURVEY INTERFACE: TRANSMISSIONS
   ───────────────────────────────────────
   What has come in over the radio, newest first. */

/* ═══ TRANSMISSIONS ═════════════════════════════
   Ric, 2026-11-13: "a transmission page for big stuff like close wars and
   stuff and people trying to talk to you and you have to go to that page to
   see the information." (game/comms.js has the rest.)

   One item is two lines. The first is what was said — a headline out of the
   record, or a name and its one line. The second is the thing WORLD-IDEAS.md
   §3 insists on: where the ship heard it, and how long ago. Unread ones are
   bright; reading is opening the page. Nothing on it is a button. */

const COMMS_ROWS = 9;
const COMMS_CARD = 52;

const COMMS_SOURCE = {
  scan:        { word: "LOCAL SCAN",     colour: HUD_CASH },
  station:     { word: "STATION REPORT", colour: AMBER },
  unconfirmed: { word: "UNCONFIRMED",    colour: WARN },
  direct:      { word: "TO YOU",         colour: VIOLET }
};

const commsAgo = s => s < 60 ? "just now"
  : s < 3600 ? Math.round(s / 60) + "m ago"
  : Math.round(s / 3600) + "h ago";

HUD.drawComms = function (st, dt) {
  const { ctx, SCREEN_W } = api;
  st = st || {};
  const C = st.comms || { list: [], unread: 0 };
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const list = (C.list || []).slice(0, COMMS_ROWS);
  const fresh = list.filter(m => m.fresh).length;

  pageFrame("TRANSMISSIONS", fresh ? fresh + " NEW" : "NOTHING NEW", "", SHIP_TONE);

  const y0 = PAGE.TOP;
  const h = PAGE.HEAD + Math.max(1, list.length) * COMMS_CARD + PAGE.PAD - 6;
  panel(full.x, y0, full.w, h, AMBER, "RECEIVED", list.length ? "NEWEST FIRST" : "");
  if (!list.length) {
    fitText("nothing has come in. big changes near you and anybody with " +
            "something to tell you will be here.", full.x + PAGE.PAD,
            y0 + PAGE.HEAD + 24, SIZE.cap, AMBER_DIM, "left", 0.7,
            full.w - PAGE.PAD * 2);
  }
  list.forEach((m, i) => {
    const top = y0 + PAGE.HEAD + i * COMMS_CARD;
    const y1 = top + 16, y2 = top + 38;
    const x = full.x + PAGE.PAD;
    const a = m.fresh ? 1 : 0.55;
    if (m.fresh) {
      ctx.save();
      ctx.fillStyle = m.colour; ctx.globalAlpha = 0.06;
      ctx.fillRect(full.x + 1, top - 4, full.w - 2, COMMS_CARD);
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = m.colour; ctx.globalAlpha = a;
    // A message is a square, news is a diamond: who it is for, at a glance.
    if (m.kind === "msg") ctx.fillRect(x, y1 - 10, 10, 10);
    else {
      ctx.beginPath();
      ctx.moveTo(x + 5, y1 - 12); ctx.lineTo(x + 11, y1 - 5);
      ctx.lineTo(x + 5, y1 + 2);  ctx.lineTo(x - 1, y1 - 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (m.kind === "msg") {
      fitText(m.from, x + 22, y1, SIZE.cap, m.colour, "left", a, 200, "0.1em");
      fitText(m.text, x + 232, y1, SIZE.cap, AMBER, "left", a,
              full.w - PAGE.PAD * 2 - 232, "0.02em");
    } else {
      fitText(m.text, x + 22, y1, SIZE.cap, m.colour, "left", a,
              full.w - PAGE.PAD * 2 - 22, "0.06em");
    }
    const src = COMMS_SOURCE[m.source] || COMMS_SOURCE.unconfirmed;
    fitText(src.word + (m.source === "station" && m.by ? "  ·  " + m.by : ""),
            x + 22, y2, SIZE.cap, src.colour, "left", a * 0.85, 330, "0.08em");
    fitText(commsAgo(m.ago), x + 372, y2, SIZE.cap, AMBER_DIM, "left", a * 0.8, 110);
    if (m.dist >= 0) {
      fitText(m.dist.toLocaleString("en-US") + "  ·  " +
              String(m.bearing).padStart(3, "0") + "°",
              x + 500, y2, SIZE.cap, AMBER_DIM, "left", a * 0.8, 220);
    }
  });

  pageNav(st, "comms", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};
