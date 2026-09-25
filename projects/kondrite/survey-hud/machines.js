"use strict";
/* KONDRITE — SURVEY INTERFACE: THE MACHINES
   ─────────────────────────────────────────────────────────────────────────────
   The machines and the board under them. Last: it publishes window.KondriteSurveyHUD. */

/* ═══ THE MACHINES ════════════════════════════════════════════════════════
   H6. The cabinets in the corner of a station, and the one page in the mode
   that is not about the sector at all.

   The thing that stops this being a relabel is that it is drawn as a *room*
   rather than as four more cards: a frame round each machine in its own
   colours, its name on it, the attract loop running inside it, and — the part
   that makes it a machine — **the high score printed on the cabinet before
   you press anything**.

   The attract loop is the menu's own diorama. `menu.js` draws all five as
   closed-form functions of the clock, which is what they have always actually
   been; on a cabinet, that is what a diorama is for. It is reached as a
   global rather than through `api` because it is a sibling module the page
   loads either way, and a cabinet without its picture is still a cabinet. */
const cabinetArt = () =>
  (typeof window !== "undefined" && window.KondriteMenu) || null;

HUD.drawArcade = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const A = st.arcade;
  if (!A) { pageFrame("SIMULATORS", "", "", PLACE_TONE); return; }

  pageFrame("SIMULATORS", A.where + "  \u00b7  " + A.owner, "", PLACE_TONE);
  /* Said once, on the page that opens them, because a player who finds this
     out afterwards has been misled rather than surprised. */
  fitText("nothing in here pays. the score is the point, and the names beside " +
          "it are the sector's own.",
          34, 112, SIZE.cap, VIOLET_LOW, "left", 0.7, SCREEN_W - 68);

  const list = A.machines || [];
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
  const top = PAGE.TOP + 44;
  const space = SCREEN_H - top - 96;

  /* The room is two things: the machines, and the board of the one you are
     standing in front of. The board stands **beside** them rather than under
     them, and that is arithmetic rather than taste — `SCREEN_H` is a constant
     700, which leaves about 420 for this page, and three cabinets tall enough
     to read plus a dozen names is half as much again. Put under them the
     board came out at four rows and the cabinets drew over their own text.

     Sideways the width is there to spend: the page is between 1000 and 1680
     across, so a column on the right holds all thirteen rows at full height
     and the machines keep theirs. A room with machines along one wall and the
     board on the next one is also simply what the place is. */
  const B = A.board;
  const boardW = B ? Math.max(260, Math.min(420, Math.round(full.w * 0.34))) : 0;
  const gapB = B ? 24 : 0;
  const cabsW = full.w - boardW - gapB;
  const gap = api.touchOnly ? 10 : 16;
  const w = Math.floor((cabsW - gap * (list.length - 1)) / Math.max(1, list.length));
  /* The cabinets give up the foot of the page to the two doors under them —
     the people and the board — which arrived when the front page's SIMULATORS
     door came off and there was nowhere else for them to be. */
  const h = Math.min(392, Math.max(CAB_MIN, space - 96));
  const boardRows = B ? Math.max(4, Math.min(B.rows.length,
                        Math.floor((h - BOARD_HEAD_H) / BOARD_ROW_H))) : 0;

  list.forEach((m, i) => {
    const x = full.x + i * (w + gap);
    const on = A.pick === i;
    const booting = A.booting === m.key;
    /* The cabinet: a box in the machine's own colour, standing on a plinth.
       The one you are on is brighter and a shade taller, which is the whole
       of the selection — a row of boxes with one outlined is a menu. */
    ctx.save();
    ctx.fillStyle = m.colour;
    ctx.globalAlpha = booting ? 0.16 : on ? 0.12 : 0.06;
    ctx.fillRect(x, top, w, h);
    ctx.globalAlpha = booting ? 1 : on ? 0.9 : 0.5;
    ctx.fillRect(x, top, w, 4);
    ctx.strokeStyle = m.colour;
    ctx.globalAlpha = booting ? 1 : on ? 0.9 : 0.45;
    ctx.lineWidth = on || booting ? 2 : 1;
    ctx.strokeRect(x, top, w, h);
    // The plinth, so it reads as standing in a room rather than laid on a page.
    ctx.globalAlpha = on ? 0.5 : 0.28;
    ctx.beginPath();
    ctx.moveTo(x + 10, top + h + 7);
    ctx.lineTo(x + w - 10, top + h + 7);
    ctx.stroke();
    ctx.restore();

    /* The screen, inset, with the attract loop running in it. A cabinet's
       screen is not the cabinet, so it keeps its own border and its own
       black. */
    const pad = 12;
    const scr = { x: x + pad, y: top + pad, w: w - pad * 2,
                  h: Math.min(Math.round(h * 0.46), 150) };
    ctx.save();
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
    ctx.restore();
    const art = cabinetArt();
    // The attract loop runs off the wall clock: the room is a parked page,
    // so the match clock this panel usually reads is standing still.
    if (art) art.preview(m.art, scr.x, scr.y, scr.w, scr.h, clockish());
    ctx.save();
    ctx.strokeStyle = m.colour;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.strokeRect(scr.x, scr.y, scr.w, scr.h);
    ctx.restore();

    let y = scr.y + scr.h + 30;
    fitText(m.name, x + w / 2, y, SIZE.head, m.colour, "center", 1, w - 20,
            "0.08em");
    y += 24;
    /* One line of it on a short cabinet. The description is the first thing a
       machine can do without — the name says what it is and the picture above
       it is already running. */
    /* The cabinets are narrower since the board took the wall beside them, so
       the same sentence needs more lines rather than fewer — two of them cut
       every description off mid-clause. */
    const lines = h < 300 ? 1 : 4;
    wrapLines(m.line, SIZE.cap, w - 28, "0.02em").slice(0, lines)
      .forEach((ln, k) => {
        label(ln, x + w / 2, y + k * 17, SIZE.cap, VIOLET_DIM, "center", 0.75);
      });

    /* The high score, printed on the machine. It is the whole reason a
       cabinet is worth a second visit, and it is on it before you press
       anything — which is what a high score is for. */
    /* Placed under what comes before it and only *then* pushed to the foot
       of the box, so a cabinet shortened to make room for the board stacks
       instead of overlapping. */
    const scoreY = Math.max(y + lines * 17 + 22, top + h - 54);
    label(m.cap, x + w / 2, scoreY, SIZE.cap, VIOLET_LOW, "center", 0.7,
          "0.18em");
    fitText(m.best, x + w / 2, scoreY + 24, SIZE.val,
            m.best === "NOT PLAYED" ? VIOLET_LOW : m.colour, "center",
            m.best === "NOT PLAYED" ? 0.55 : 1, w - 20, "0.06em");

    /* And the coin going in. The room is a parked page and nothing on it
       moves, so this bar is the only thing that does: it is the machine
       coming up, and the match is on the other side of it. */
    if (booting) {
      ctx.save();
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(x + 1, top + 1, w - 2, h - 2);
      ctx.restore();
      label("COIN ACCEPTED", x + w / 2, top + h / 2 - 16, SIZE.cap, m.colour,
            "center", 1, "0.26em");
      const bw = w - 60;
      ctx.save();
      ctx.strokeStyle = m.colour;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 30, top + h / 2 + 4, bw, 8);
      ctx.fillStyle = m.colour;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x + 31, top + h / 2 + 5,
                   Math.max(0, (bw - 2) * Math.min(1, A.bootAt || 0)), 6);
      ctx.restore();
    }

    tap({ x, y: top, w, h,
          act: () => {
            if (st.simBooting) return;
            if (A.pick !== i && api.touchOnly) {
              // A thumb points first and plays second, the way the mode row
              // already works: one tap to choose a machine, one to feed it.
              st.onPickSim && st.onPickSim(i);
              return;
            }
            st.onPickSim && st.onPickSim(i);
            st.onPlaySim && st.onPlaySim(m.key);
          } });
  });

  label(api.touchOnly ? "TAP A MACHINE  \u00b7  TAP AGAIN TO PLAY"
                      : "CLICK ONE  \u00b7  OR ARROWS + ENTER  \u00b7  [E] LEAVES",
        full.x + cabsW / 2, top + h + 30, SIZE.cap, VIOLET_DIM, "center", 0.8,
        "0.14em");

  /* The two things that came in here when the front page's SIMULATORS door
     came off. A cabinet is somebody playing alone — but a station has people
     in it, and a board on the wall with other people's names on it, and after
     the door went there was nowhere else for either of them to be. */
  const by = top + h + 56, bw = Math.min(280, (cabsW - 16) / 2);
  tapWide(api.touchOnly ? "WITH OTHER PEOPLE" : "[P]  WITH OTHER PEOPLE",
          full.x, by, bw, "#87d8ff", st.onPeople);
  tapWide(api.touchOnly ? "THE REAL BOARD" : "[B]  THE REAL BOARD",
          full.x + bw + 16, by, bw, "#a08cff", st.onBoard);

  if (B) drawBoard(A, B, boardRows, full.x + cabsW + gapB, top, boardW, h);

  pageNav(st, "arcade", PLACE_TABS);
  closeButton(st.onClose || (() => {}));
};

/* ── the board under the machines ─────────────────────────────────────────
   A dozen of the sector's own people, and you among them. It is drawn as a
   ranked list and not as a table: a board is read down the left edge for a
   name and along one row for a number, and lines between the two would be
   furniture in the way of both.

   What it must do on every screen it is drawn on is show **the rung above
   you**. So it is a window rather than a page of twelve — when there is not
   room for the whole board it keeps you in it, one clear of the top, which is
   where the next name up lives. */
/* A plain wide button for the room. The page module has `tap` for rectangles
   and `label` for words; this is the two of them together, which the room
   needs twice and nothing else needs at all. */
function tapWide(text, x, y, w, colour, act) {
  if (!act) return;
  const { ctx } = api;
  const h = 34;
  ctx.save();
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
  fitText(text, x + w / 2, y + 22, SIZE.cap, colour, "center", 0.95, w - 16,
          "0.1em");
  tap({ x, y, w, h, act });
}

const BOARD_ROW_H = 21;
const BOARD_HEAD_H = 26;
/* What a cabinet needs to draw its own insides without them touching: the
   pad, a screen, the name, one line of description and the score. */
const CAB_MIN = 268;

function drawBoard(A, B, rows, x, y, w, h) {
  const { ctx } = api;
  const all = B.rows;
  const me = all.findIndex(r => r.you);
  const tint = A.colour || VIOLET_DIM;

  /* The panel, so it reads as a board on a wall rather than a list that fell
     off the machines. Its border is the *place's* colour, not a machine's:
     the twelve on it are this station's people, and they are the same twelve
     whichever cabinet you are standing at. */
  ctx.save();
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.05;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = tint;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x, y, w, 3);
  ctx.restore();

  /* The window. Anchored on you with one row showing above, which is the row
     this whole thing exists to show; if you are not on the board yet it is
     the top of it, because the top is what a machine is advertising. */
  let from = 0;
  if (rows < all.length) {
    from = me < 0 ? 0 : Math.min(all.length - rows, Math.max(0, me - 1));
  }
  const shown = all.slice(from, from + rows);

  const px = x + 14, pw = w - 28;
  label("THE BOARD  \u00b7  " + (A.boardOf || ""), px, y + 20, SIZE.cap,
        tint, "left", 0.85, "0.16em");
  /* Said plainly, once, and never anywhere else. A made-up board that did not
     admit it would be the one dishonest thing in the game. */
  /* Short, because `fitText` floors at 16px and `SIZE.cap` *is* 16 on a desk —
     so a long caption here cannot shrink, only lose its end to an ellipsis.
     The rest of what this board is gets said on the page's own line above,
     where there is a whole screen of width to say it in. */
  label("nobody is watching", px, y + 38, SIZE.cap, VIOLET_LOW, "left", 0.5);

  const rowTop = y + 52;
  const colScore = x + w - 14;
  shown.forEach((r, i) => {
    const ry = rowTop + i * BOARD_ROW_H + 12;
    const tone = r.you ? (A.youColour || "#ffe56d") : VIOLET_DIM;
    const a = r.you ? 1 : 0.8;
    if (r.you) {
      // The one row that is you, found without reading it.
      ctx.save();
      ctx.fillStyle = tone;
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x + 1, ry - 13, w - 2, BOARD_ROW_H);
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x + 1, ry - 13, 2, BOARD_ROW_H);
      ctx.restore();
    }
    label(String(r.rank), px, ry, SIZE.cap, r.you ? tone : VIOLET_LOW,
          "left", r.you ? 0.9 : 0.5);
    const said = A.say ? A.say(r.score) : String(r.score);
    fitText(r.name, px + 26, ry, SIZE.cap, tone, "left", a,
            pw - 40 - said.length * 7);
    label(said, colScore, ry, SIZE.cap, tone, "right", a);
  });

  /* A window that has scrolled past an end says so at that end, because a
     rank column starting at 3 is a thing to notice rather than to read. */
  const foot = rowTop + rows * BOARD_ROW_H + 13;
  if (from > 0) {
    label("\u2191 " + from + " above", px, y + h - 12, SIZE.cap, VIOLET_LOW,
          "left", 0.45);
  }
  if (from + rows < all.length) {
    label((all.length - from - rows) + " below \u2193", colScore, y + h - 12,
          SIZE.cap, VIOLET_LOW, "right", 0.45);
  }
  if (B.at < 0 && foot < y + h - 20) {
    label("you are not on this one yet", px, foot, SIZE.cap, VIOLET_LOW,
          "left", 0.5);
  }
}

const fmtClock = s => {
  const t = Math.max(0, Math.round(s));
  const m = Math.floor(t / 60);
  if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60) + "m";
  return m + "m " + String(t % 60).padStart(2, "0") + "s";
};

window.KondriteSurveyHUD = HUD;
