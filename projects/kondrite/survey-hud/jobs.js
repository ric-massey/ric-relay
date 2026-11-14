"use strict";
/* KONDRITE — SURVEY INTERFACE: JOBS
   ───────────────────────────────────────
   A station's job board, and the band of jobs you are carrying. */

/* ═══ THE BOARD ═════════════════════════════════
   What this dock is asking for (game/jobs.js). Every row is a real shortage
   at a real station, so the page has three honest states: rows, "nothing near
   here is short", and the row that asks you to bring something back *here*.

   No dialogue and nobody speaking (WORLD-IDEAS.md §3): a row is a quantity,
   a material, a dock, a flag, a bearing and a figure. The one sentence on it
   is the reason, and the reason is read off the record. */

const JOB_CARD = 52;      // one offer: two lines

/* The small map on a row: you in the middle, the dock out along its bearing.
   A picture of *which way*, which is the thing a list of names cannot say. */
function jobCompass(cx, cy, r, bearing, colour, here) {
  const { ctx } = api;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = colour;
  if (here) {
    // Here: the dock is the middle of the ring.
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  } else {
    const a = (bearing - 90) * Math.PI / 180;
    const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillRect(ex - 3, ey - 3, 6, 6);
    ctx.beginPath(); ctx.arc(cx, cy, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const jobRange = j => j.here ? "come back with it"
  : j.dist.toLocaleString("en-US") + "  ·  " +
    String(j.bearing).padStart(3, "0") + "°";

function jobReason(j) {
  if (j.lost > 1) return j.lost + " convoys lost";
  if (j.lost === 1) return "a convoy was lost";
  return "always short";
}

/* The jobs you have taken. Shared by the board and the missions page, so the
   two can never disagree about what you are carrying. */
function takenBand(st, full, y0) {
  const { ctx } = api;
  const J = st.jobs || { taken: [], max: 3 };
  const rows = Math.max(1, J.taken.length);
  const h = PANEL_H(rows);
  panel(full.x, y0, full.w, h, HUD_CASH, "YOUR JOBS", J.taken.length + " / " + J.max);
  if (!J.taken.length) {
    fitText("none taken", full.x + PAGE.PAD, ROW(y0, 0) + 2, SIZE.cap,
            CASH_DIM, "left", 0.6, full.w - PAGE.PAD * 2);
    return y0 + h;
  }
  J.taken.forEach((j, i) => {
    const y = ROW(y0, i) + 2;
    const x = full.x + PAGE.PAD;
    ctx.save();
    ctx.fillStyle = j.colour; ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y - 9, 9, 9);
    ctx.restore();
    fitText(j.left + " " + j.mat + "  →  " + j.name, x + 18, y, SIZE.cap,
            HUD_CASH, "left", 1, 300, "0.06em");
    // What is in the hold toward it: the number that says whether to go yet.
    fitText(j.aboard >= j.left ? "aboard" : j.aboard + " aboard",
            x + 330, y, SIZE.cap, j.aboard >= j.left ? HUD_CASH : AMBER_DIM,
            "left", 0.8, 110);
    fitText(jobRange(j), x + 450, y, SIZE.cap, AMBER_DIM, "left", 0.8, 180);
    label("+" + hudMoney(j.pay), full.x + full.w - PAGE.PAD - 96, y, SIZE.cap,
          HUD_CASH, "right", 0.95);
    button("DROP", full.x + full.w - PAGE.PAD - 38, y - 5, 76, 22, WARN,
           () => st.onDropJob && st.onDropJob(j.id), false, true, "0.08em");
  });
  return y0 + h;
}

HUD.drawJobs = function (st, dt) {
  const { ctx, SCREEN_W } = api;
  st = st || {};
  const J = st.jobs || { offers: [], taken: [], wanted: [], max: 3 };
  const here = J.here || { name: "", done: 0, units: 0 };
  const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };

  pageFrame("JOBS",
            here.name +
            (here.done
               ? "   ·   " + here.units + " UNITS BROUGHT HERE BY YOU"
               : ""),
            "", PLACE_TONE);

  /* ── what this dock knows is wanted ─────────────────────────── */
  const offers = J.offers || [];
  const y0 = PAGE.TOP;
  const cards = Math.max(1, offers.length);
  const h = PAGE.HEAD + cards * JOB_CARD + PAGE.PAD - 6;
  panel(full.x, y0, full.w, h, VIOLET, "WANTED NEAR HERE",
        offers.length ? "SELL IT THERE — THE FIGURE IS ON TOP" : "");
  if (!offers.length) {
    fitText("nothing this dock knows of is short of anything. a lost convoy " +
            "changes that.", full.x + PAGE.PAD, y0 + PAGE.HEAD + 24, SIZE.cap,
            VIOLET_DIM, "left", 0.7, full.w - PAGE.PAD * 2);
  }
  const full3 = J.taken.length >= J.max;
  offers.forEach((j, i) => {
    const top = y0 + PAGE.HEAD + i * JOB_CARD;
    const y1 = top + 16, y2 = top + 38;
    const x = full.x + PAGE.PAD;
    if (i % 2 === 1) {
      ctx.save();
      ctx.fillStyle = VIOLET; ctx.globalAlpha = 0.03;
      ctx.fillRect(full.x + 1, top - 4, full.w - 2, JOB_CARD);
      ctx.restore();
    }
    jobCompass(x + 18, top + 22, 16, j.bearing, j.flagColour, j.here);
    ctx.save();
    ctx.fillStyle = j.colour; ctx.globalAlpha = 0.9;
    ctx.fillRect(x + 50, y1 - 9, 9, 9);
    ctx.restore();
    fitText(j.n + " " + j.mat, x + 66, y1, SIZE.cap, j.colour, "left", 1, 170, "0.08em");
    fitText(j.here ? "BRING IT HERE" : "TO " + j.name, x + 250, y1, SIZE.cap,
            VIOLET, "left", 1, 220, "0.08em");
    ctx.save();
    ctx.fillStyle = j.flagColour; ctx.globalAlpha = 0.9;
    ctx.fillRect(x + 490, y1 - 9, 9, 9);
    ctx.restore();
    fitText(j.flag, x + 506, y1, SIZE.cap, j.flagColour, "left", 0.85, 120, "0.08em");
    fitText(jobReason(j), x + 66, y2, SIZE.cap, VIOLET_DIM, "left", 0.75, 180);
    fitText(jobRange(j) + (j.known || j.here ? "" : "   ·   not on your chart"),
            x + 250, y2, SIZE.cap, AMBER_DIM, "left", 0.8, 380);
    label("+" + hudMoney(j.pay), full.x + full.w - PAGE.PAD - 110, top + 28,
          SIZE.val, HUD_CASH, "right", 0.95);
    button(full3 ? "FULL" : "TAKE", full.x + full.w - PAGE.PAD - 46, top + 22,
           92, 34, full3 ? VIOLET_LOW : HUD_CASH,
           full3 ? null : () => st.onTakeJob && st.onTakeJob(j.id),
           false, !full3);
  });

  /* ── what you are carrying ──────────────────────────────────── */
  let y = takenBand(st, full, y0 + h + PAGE.STEP);

  /* ── who this flag wants ────────────────────────────────────────
     The same prices the SECTOR page lists, narrowed to whoever holds this
     dock. Not something you take: a bounty is paid on the kill. */
  const wanted = (J.wanted || []).slice(0, 3);
  if (wanted.length) {
    const wy = y + PAGE.STEP;
    panel(full.x, wy, full.w, PANEL_H(wanted.length), WARN, "WANTED BY THIS FLAG",
          "PAID ON THE KILL");
    wanted.forEach((b, i) => {
      const ry = ROW(wy, i) + 2;
      fitText(b.name, full.x + PAGE.PAD, ry, SIZE.cap, WARN, "left", 0.95, 400, "0.06em");
      label(hudMoney(b.amount), full.x + full.w - PAGE.PAD, ry, SIZE.cap,
            HUD_CASH, "right", 0.95);
    });
  }

  pageNav(st, "jobs", PLACE_TABS);
  closeButton(st.onUndock || st.onClose || (() => {}));
};
