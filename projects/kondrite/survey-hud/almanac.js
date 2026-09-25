"use strict";
/* KONDRITE — SURVEY INTERFACE: THE ALMANAC
   ─────────────────────────────────────────────────────────────────────────────
   The almanac, scrolling it, and its pictures. */

/* ═══ THE ALMANAC ═════════════════════════════════════════════════════════
   A page of cards, each with a picture of the thing it is asking you to find.
   That is the whole point of it: a list of names tells you what you have not
   got, and a picture tells you what to look for. Found entries are in colour
   with their note; unfound ones keep the silhouette and lose the detail, and
   the two the sector never hints at lose their name as well — a redaction is
   an invitation and a blank line is not. */
// True when a detail card is open, so the page's own Escape does not close
// the whole almanac out from under it.
HUD.almanacDetailOpen = () => almanac.open >= 0;
HUD.almanacCloseDetail = () => { almanac.open = -1; };

HUD.almanacKey = function (code, entries) {
  const cols = api.touchOnly ? 1 : 3;
  const n = entries.length;
  if (almanac.open >= 0) {
    // Arrows page through entries with the card still open, which is how you
    // read a field guide — one after another, not back to the grid each time.
    if (code === "ArrowLeft" || code === "ArrowUp") {
      almanac.open = (almanac.open + n - 1) % n;
    } else if (code === "ArrowRight" || code === "ArrowDown") {
      almanac.open = (almanac.open + 1) % n;
    } else return false;
    almanac.pick = almanac.open;
    keepPickVisible(n, cols);
    return true;
  }
  if (code === "Enter" || code === "Space") { almanac.open = almanac.pick; return true; }
  if (code === "ArrowLeft")  { almanac.pick = (almanac.pick + n - 1) % n; }
  else if (code === "ArrowRight") { almanac.pick = (almanac.pick + 1) % n; }
  else if (code === "ArrowUp")   { almanac.pick = Math.max(0, almanac.pick - cols); }
  else if (code === "ArrowDown") { almanac.pick = Math.min(n - 1, almanac.pick + cols); }
  else return false;
  keepPickVisible(entries.length, cols);
  return true;
};

/* On the page's own columns and the page's own step, like every other page.
   It had its own margins, its own 14px gap and an 82px card that was not a
   multiple of anything — which looked fine here and stopped looking fine the
   moment you pressed I and the inventory's panels landed somewhere else. */
function almanacLayout() {
  const { SCREEN_H } = api;
  const cols = api.touchOnly ? 1 : 3;
  const c0 = COL(cols, 0);
  const cardH = api.touchOnly ? 78 : 78;
  const top = PAGE.TOP;
  const pitch = cardH + PAGE.STEP;
  const rows = Math.floor((SCREEN_H - top - 80) / pitch);
  return { cols, gap: PAGE.GUTTER, left: c0.x, cardW: c0.w, cardH, top, rows };
}

/* Driven by the arrows, the list snaps to whole rows — a keyboard is moving
   between entries, not between pixels, and a half-row offset left over from a
   drag would make every subsequent arrow press look like it moved twice. */
function keepPickVisible(n, cols) {
  const L = almanacLayout();
  const row = Math.floor(almanac.pick / L.cols);
  almanac.scroll = Math.round(almanac.scroll);
  if (row < almanac.scroll) almanac.scroll = row;
  if (row >= almanac.scroll + L.rows) almanac.scroll = row - L.rows + 1;
  almanac.scroll = Math.max(0, Math.min(maxScroll(n), almanac.scroll));
}

/* ── scrolling ────────────────────────────────────────────────────────────
   `almanac.scroll` is a row index and it used to be a whole number, which is
   why the only things that could move it were the arrow keys and two buttons:
   a wheel or a thumb produces pixels, and there was nowhere to put a fraction
   of a row. It is a float now. Everything that reads it either floors it for
   culling or uses it directly for placement, so a half-scrolled row is drawn
   half off the top rather than snapping.

   The page is clipped to its card area for the same reason — a row leaving
   the top of a scrolling list has to be cut off by the list, not drawn over
   the heading. */
const rowPitch = () => { const L = almanacLayout(); return L.cardH + L.gap; };

function maxScroll(n) {
  const L = almanacLayout();
  return Math.max(0, Math.ceil(n / L.cols) - L.rows);
}

HUD.almanacScrollBy = function (rows, n) {
  almanac.scroll = Math.max(0, Math.min(maxScroll(n), almanac.scroll + rows));
};
// A thumb and a wheel both arrive as pixels; one row is one pitch.
HUD.almanacDragBy = function (dy, n) { HUD.almanacScrollBy(dy / rowPitch(), n); };
HUD.almanacCanScroll = n => maxScroll(n) > 0;
HUD.almanacAt = () => almanac.scroll;

HUD.drawAlmanac = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  const entries = st.almanac || [];
  const found = entries.filter(e => e.found).length;
  const L = almanacLayout();
  const totalRows = Math.ceil(entries.length / L.cols);
  almanac.scroll = Math.max(0, Math.min(almanac.scroll, Math.max(0, totalRows - L.rows)));

  pageFrame("ALMANAC",
            found + " LOGGED" +
            (totalRows > L.rows ? (api.touchOnly ? "  ·  DRAG TO SCROLL"
                                                 : "  ·  SCROLL OR ARROWS") : ""),
            undefined, SHIP_TONE,
            "");   // the nav strip has the footer line

  const viewH = L.rows * (L.cardH + L.gap) - L.gap;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, L.top - 4, SCREEN_W, viewH + 8);
  ctx.clip();
  const first = Math.floor(almanac.scroll);
  const last = Math.ceil(almanac.scroll + L.rows);
  for (let i = 0; i < entries.length; i++) {
    const row = Math.floor(i / L.cols), col = i % L.cols;
    if (row < first || row >= last) continue;
    const x = L.left + col * (L.cardW + L.gap);
    const y = L.top + (row - almanac.scroll) * (L.cardH + L.gap);
    drawCard(entries[i], x, y, L.cardW, L.cardH, i === almanac.pick, i);
  }
  ctx.restore();

  // A scrollbar, because an almanac that scrolls with no sign it scrolls is
  // an almanac people think is twelve entries long.
  if (totalRows > L.rows) {
    const trackY = L.top, trackH = L.rows * (L.cardH + L.gap) - L.gap;
    const h = Math.max(24, trackH * (L.rows / totalRows));
    const t = totalRows - L.rows ? almanac.scroll / (totalRows - L.rows) : 0;
    ctx.save();
    ctx.fillStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(SCREEN_W - 28, trackY, 3, trackH);
    ctx.fillStyle = VIOLET;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(SCREEN_W - 28, trackY + t * (trackH - h), 3, h);
    ctx.restore();
    /* No scroll buttons on the footer line any more — the page navigation
       lives there now, and two arrows drawn through the STATION tab is worse
       than no arrows at all. Dragging scrolls the page and always has, which
       is the gesture a phone reaches for first anyway; the heading says so, so
       nobody has to discover it. */
  }
  if (almanac.open >= 0 && entries[almanac.open]) {
    drawEntryDetail(entries[almanac.open], st);
  } else {
    pageNav(st, "almanac", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
  }
};

/* One entry, given the room to be looked at. The picture is the reason the
   almanac exists and a 60px thumbnail is not looking at it, so here it is
   four times the size with the name and the note under it and nothing else
   competing. Tapping anywhere closes it — a detail view you have to find the
   exit of is a modal, and this is a card being turned over. */
function drawEntryDetail(e, st) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const on = !!e.found;
  const w = Math.min(560, SCREEN_W - 80), h = 400;
  const x = (SCREEN_W - w) / 2, y = (SCREEN_H - h) / 2;

  ctx.save();
  ctx.fillStyle = "rgba(5,5,10,0.86)";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // A ground dark enough that the type on it is type on a page rather than type
  // over an asteroid field.
  ctx.fillStyle = on ? "rgba(26,20,52,0.96)" : "rgba(16,16,24,0.96)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = on ? VIOLET : VIOLET_LOW;
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  const art = 190;
  ctx.save();
  ctx.strokeStyle = on ? VIOLET_LOW : "#24203f";
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + (w - art) / 2, y + 34, art, art);
  ctx.restore();
  drawIcon(e.key, x + w / 2, y + 34 + art / 2, art * 0.34, on);

  fitText(on || !e.secret ? e.name : "??????????",
          x + w / 2, y + art + 84, SIZE.big, on ? AMBER : AMBER_DIM,
          "center", on ? 1 : 0.92, w - 60, "0.1em");
  fitText(on ? e.note : (e.secret ? "not on any chart" : e.note),
          x + w / 2, y + art + 116, SIZE.val, on ? VIOLET : VIOLET_DIM,
          "center", on ? 0.95 : 0.85, w - 60);
  label(on ? "LOGGED" : "NOT YET FOUND", x + w / 2, y + art + 150, SIZE.cap,
        on ? HUD_CASH : VIOLET_LOW, "center", 0.8, "0.18em");

  label(api.touchOnly ? "TAP TO CLOSE" : "CLICK, OR ESC, TO CLOSE",
        x + w / 2, y + h - 22, SIZE.cap, VIOLET_LOW, "center", 0.8);
  tap({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H,
               act: () => { almanac.open = -1; } });
}

function drawCard(e, x, y, w, h, selected, index) {
  const { ctx } = api;
  const on = !!e.found;
  const art = h - 22;

  ctx.save();
  ctx.fillStyle = on ? "rgba(160,140,255,0.10)" : "rgba(255,255,255,0.05)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = selected ? VIOLET : (on ? VIOLET_DIM : VIOLET_LOW);
  ctx.globalAlpha = selected ? 1 : (on ? 0.85 : 0.7);
  ctx.lineWidth = selected ? 2 : 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  // The picture. Boxed, so an entry with a wide drawing and one with a narrow
  // one still line their names up.
  ctx.save();
  ctx.strokeStyle = on ? VIOLET_LOW : "#24203f";
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 11, y + 11, art, art);
  ctx.beginPath();
  ctx.rect(x + 11, y + 11, art, art);
  ctx.clip();
  ctx.globalAlpha = 1;
  drawIcon(e.key, x + 11 + art / 2, y + 11 + art / 2, art * 0.34, on);
  ctx.restore();

  const tx = x + art + PAGE.PAD;
  // The tick lives at the right edge, so the text stops before it rather than
  // running underneath it.
  const room = (x + w - 18) - tx - (on ? 20 : 4);
  /* Read at the same weight whether it is found or not. What an entry you have
     not got says is the whole reason to read the book, and it was the half
     printed at 0.4. The colour is what marks it as unfound — a dimmer amber and
     a dimmer violet — not the alpha. */
  const name = on || !e.secret ? e.name : "??????????";
  fitText(name, tx, y + 30, SIZE.cap, on ? AMBER : AMBER_DIM, "left",
          on ? 1 : 0.9, room, "0.08em");
  fitText(on ? e.note : (e.secret ? "not on any chart" : e.note),
          tx, y + 52, SIZE.cap, on ? VIOLET : VIOLET_DIM, "left",
          on ? 0.9 : 0.8, room);
  if (on) label("✓", x + w - 18, y + 30, SIZE.cap, VIOLET, "right", 0.9);

  /* Clicking an entry opens it. It used to only move the selection, which
     made every card in the book look like a button that did nothing —
     and the picture, which is the point of the almanac, was stuck at
     thumbnail size with no way to see it properly. */
  tap({ x, y, w, h, act: () => {
    almanac.open = (almanac.open === index) ? -1 : index;
    almanac.pick = index;
  } });
}

/* ── the pictures ─────────────────────────────────────────────────────────
   Twenty-five small drawings, in the same hairline vector as the game. They
   are what turns a checklist into a field guide: a name tells you what you
   have not got, a picture tells you what to go and look for. Unfound entries
   draw the same shape in grey rather than in colour — a silhouette, so the
   outline still says what kind of thing it is without giving away the detail.

   They used to be drawn at 0.3 alpha as well, which made the half of the book
   that is *supposed to be a lead* the half you cannot read. Grey is the signal;
   faintness on top of grey was just a page you squint at. */
function drawIcon(key, cx, cy, r, on) {
  const { ctx } = api;
  const lit = c => (on ? c : WRECKC);
  const a = on ? 1 : 0.82;
  const stroke = (colour, width, path) => api.glow(lit(colour), width, a, path);
  const disc = (x, y, rr, colour, alpha) => {
    ctx.save();
    ctx.fillStyle = lit(colour);
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * a;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  const ring = (x, y, rr, colour, w) => stroke(colour, w || 1.6, () => {
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
  });
  const star = (x, y, rr) => {
    disc(x, y, rr * 0.55, SOLAR);
    stroke(SOLAR, 1.4, () => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2;
        ctx.moveTo(x + Math.cos(t) * rr * 0.78, y + Math.sin(t) * rr * 0.78);
        ctx.lineTo(x + Math.cos(t) * rr * 1.15, y + Math.sin(t) * rr * 1.15);
      }
      ctx.stroke();
    });
  };
  const hole = (x, y, rr) => {
    disc(x, y, rr * 0.5, "#000");
    ring(x, y, rr * 0.5, WARN, 1.6);
    ring(x, y, rr * 0.95, WARN, 1);
  };
  const ship = (x, y, s, ang, flame) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang || 0); ctx.scale(s, s);
    stroke(AMBER, 1.6, () => {
      ctx.beginPath();
      ctx.moveTo(13, 0); ctx.lineTo(-9, 8); ctx.lineTo(-5, 0);
      ctx.lineTo(-9, -8); ctx.closePath(); ctx.stroke();
    });
    if (flame) stroke(WARN, 1.4, () => {
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-16, 0); ctx.stroke();
    });
    ctx.restore();
  };
  const planet = (x, y, rr, colour) => {
    ring(x, y, rr, colour || ICE, 1.6);
    stroke(colour || ICE, 1, () => {
      ctx.beginPath();
      for (const f of [-0.45, 0, 0.45]) {
        const yy = f * rr, half = Math.sqrt(Math.max(0, rr * rr - yy * yy));
        ctx.moveTo(x - half, y + yy); ctx.lineTo(x + half, y + yy);
      }
      ctx.stroke();
    });
  };
  const wreck = (x, y, s, ang) => {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang || 0); ctx.scale(s, s);
    stroke(WRECKC, 1.5, () => {
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-9, 7); ctx.lineTo(-5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-3, -2); ctx.stroke();
    });
    ctx.restore();
  };
  const grid = (frac) => {
    const n = 4, cell = (r * 1.7) / n, x0 = cx - r * 0.85, y0 = cy - r * 0.85;
    let k = 0;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++, k++) {
        const fill = k / (n * n) < frac;
        ctx.save();
        ctx.globalAlpha = a * (fill ? 0.85 : 0.22);
        ctx.fillStyle = lit(VIOLET);
        if (fill) ctx.fillRect(x0 + gx * cell + 1, y0 + gy * cell + 1, cell - 2, cell - 2);
        else {
          ctx.strokeStyle = lit(VIOLET);
          ctx.lineWidth = 1;
          ctx.strokeRect(x0 + gx * cell + 1, y0 + gy * cell + 1, cell - 2, cell - 2);
        }
        ctx.restore();
      }
    }
  };
  const dashBox = () => {
    ctx.save();
    ctx.strokeStyle = lit(VIOLET);
    ctx.globalAlpha = a * 0.8;
    ctx.lineWidth = 1.4;
    if (ctx.setLineDash) ctx.setLineDash([5, 5]);
    ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  };

  switch (key) {
    case "first-light":       star(cx, cy, r); break;
    case "event-horizon":     hole(cx, cy, r * 1.1); ship(cx, cy + r * 1.15, 0.5, -0.5, true); break;
    case "slingshot":
      hole(cx - r * 0.3, cy, r * 0.8);
      stroke(AMBER, 1.6, () => {
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy, r * 1.05, Math.PI * 0.55, Math.PI * 1.75);
        ctx.stroke();
      });
      ship(cx + r * 0.75, cy - r * 0.62, 0.42, -0.7, true);
      break;
    case "thread":
      hole(cx - r * 0.85, cy, r * 0.62); hole(cx + r * 0.85, cy, r * 0.62);
      stroke(AMBER, 1.5, () => {
        ctx.beginPath(); ctx.moveTo(cx, cy + r * 1.2); ctx.lineTo(cx, cy - r * 1.2); ctx.stroke();
      });
      break;
    case "close-pass":
      star(cx - r * 0.35, cy, r * 0.8);
      stroke(AMBER, 1.6, () => {
        ctx.beginPath();
        ctx.arc(cx - r * 0.35, cy, r * 1.1, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();
      });
      break;
    case "dead-stick":        ship(cx, cy, 1.05, -0.35, false); break;
    case "full-stop":
      ship(cx, cy, 0.95, -0.35, false);
      ring(cx, cy, r * 1.15, VIOLET, 1.2);
      break;
    case "terminal-velocity":
      ship(cx + r * 0.3, cy, 0.95, 0, true);
      stroke(AMBER, 1.2, () => {
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(cx - r * 1.3, cy + i * r * 0.5);
          ctx.lineTo(cx - r * 0.45, cy + i * r * 0.5);
        }
        ctx.stroke();
      });
      break;
    case "long-haul":
      ship(cx + r * 0.7, cy, 0.7, 0, true);
      ctx.save();
      ctx.strokeStyle = lit(AMBER); ctx.globalAlpha = a * 0.7; ctx.lineWidth = 1.4;
      if (ctx.setLineDash) ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cx - r * 1.2, cy); ctx.lineTo(cx + r * 0.2, cy); ctx.stroke();
      ctx.restore();
      break;
    case "deep-field":        dashBox(); ship(cx, cy, 0.5, -0.35, true); break;
    case "dark-run":
      ship(cx, cy, 0.7, -0.35, true);
      for (const [dx, dy] of [[-0.8, -0.7], [0.85, -0.5], [-0.6, 0.85], [0.7, 0.75]]) {
        disc(cx + dx * r, cy + dy * r, 1.1, VIOLET, 0.5);
      }
      break;
    case "cartographer-1":    grid(0.25); break;
    case "cartographer-2":    grid(0.55); break;
    case "cartographer-3":    grid(1); break;
    case "binary":
      star(cx - r * 0.6, cy, r * 0.62); star(cx + r * 0.6, cy, r * 0.62);
      stroke(SOLAR, 1, () => {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.42);
        ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
      break;
    case "double":
      hole(cx - r * 0.55, cy, r * 0.85); hole(cx + r * 0.55, cy, r * 0.85);
      break;
    case "eclipse":
      star(cx + r * 0.15, cy, r); disc(cx - r * 0.35, cy, r * 0.62, "#0a0a12");
      ring(cx - r * 0.35, cy, r * 0.62, ICE, 1.6);
      break;
    case "rogue":             planet(cx, cy, r * 0.9, "#8fa4c8"); break;
    case "pale-dot":          dashBox(); disc(cx, cy, 2.2, ICE); break;
    case "supernebula":
      for (let i = 0; i < 4; i++) {
        stroke(i % 2 ? VIOLET : VIOLET_DIM, 1.5, () => {
          ctx.beginPath();
          for (let k = 0; k <= 28; k++) {
            const t = (k / 28) * Math.PI * 2;
            const wob = 1 + Math.sin(t * 3 + i * 1.6) * 0.16;
            const rr = r * (0.4 + i * 0.22) * wob;
            const px = cx + Math.cos(t) * rr, py = cy + Math.sin(t) * rr * 0.74;
            k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath(); ctx.stroke();
        });
      }
      break;
    case "graveyard":
      wreck(cx - r * 0.6, cy - r * 0.5, 0.62, 0.5);
      wreck(cx + r * 0.55, cy - r * 0.15, 0.62, 2.4);
      wreck(cx - r * 0.1, cy + r * 0.7, 0.62, 3.8);
      break;
    case "last-transmission":
      wreck(cx - r * 0.2, cy, 0.85, 0.4);
      for (let i = 1; i <= 3; i++) {
        stroke(VIOLET, 1.2, () => {
          ctx.beginPath();
          ctx.arc(cx - r * 0.2, cy, r * (0.45 + i * 0.3), -0.85, 0.85);
          ctx.stroke();
        });
      }
      break;
    case "prospector":
      stroke(AMBER_DIM, 1.6, () => {
        ctx.beginPath();
        for (let i = 0; i <= 9; i++) {
          const t = (i / 9) * Math.PI * 2;
          const rr = r * (0.85 + ((i * 7) % 3) * 0.08);
          const px = cx + Math.cos(t) * rr, py = cy + Math.sin(t) * rr;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      });
      disc(cx, cy, r * 0.3, VIOLET);
      ring(cx, cy, r * 0.46, VIOLET, 1.2);
      break;
    case "vault":
      /* A sealed box with a ring inside it and one way in. The picture has to
         say "somebody built this and locked it", which is a square, a ring and
         a gap — not a wreck and not a rock. */
      ctx.strokeRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.44, 0.5, 0.5 + Math.PI * 1.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.85, cy - r * 0.2);
      ctx.lineTo(cx + r * 0.85, cy + r * 0.2);
      ctx.stroke();
      disc(cx, cy, r * 0.14, on ? AMBER : VIOLET_LOW);
      break;
    case "node-01":
      stroke(AMBER, 1.6, () => { ctx.strokeRect(cx - r, cy - r * 0.8, r * 2, r * 1.6); });
      stroke(AMBER, 1.3, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.65, cy - r * 0.3); ctx.lineTo(cx + r * 0.3, cy - r * 0.3);
        ctx.moveTo(cx - r * 0.65, cy + r * 0.05); ctx.lineTo(cx + r * 0.55, cy + r * 0.05);
        ctx.moveTo(cx - r * 0.65, cy + r * 0.4); ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
        ctx.stroke();
      });
      break;
    case "the-wall":
      /* A frame with a mouth that never opened. It used to be the dashed box
         and four dots and nothing else, which was an honest picture of an
         entry with nothing in it — the entry has something in it now, so the
         picture says what. Anchors at the corners, the frame between them, and
         a broken ring at the middle. */
      dashBox();
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        disc(cx + dx * r, cy + dy * r, 3, WARN);
      }
      stroke(WRECKC, 1.4, () => {
        for (const a0 of [0.5, Math.PI + 0.3]) {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.42, a0, a0 + 1.7);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.66, 2.4, 2.4 + 1.3);
        ctx.stroke();
      });
      stroke(WARN, 1.3, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.15, cy - r * 0.15); ctx.lineTo(cx + r * 0.15, cy + r * 0.15);
        ctx.moveTo(cx + r * 0.15, cy - r * 0.15); ctx.lineTo(cx - r * 0.15, cy + r * 0.15);
        ctx.stroke();
      });
      break;
    /* The six the world grew. Each one is the *shape of the thing*, not a
       symbol for it — a picture tells you what to go and look for, and a
       glyph only tells you it has a name. */
    case "leviathan":
      // The hull in plan: two flanks, a bow, and the stern gap you go in by.
      stroke(WRECKC, 1.7, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.52); ctx.lineTo(cx + r * 0.62, cy - r * 0.52);
        ctx.lineTo(cx + r, cy); ctx.lineTo(cx + r * 0.62, cy + r * 0.52);
        ctx.lineTo(cx - r * 0.2, cy + r * 0.52);
        ctx.stroke();
      });
      stroke(VIOLET, 1.3, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, cy); ctx.lineTo(cx + r * 0.5, cy);
        ctx.stroke();
      });
      disc(cx - r * 0.86, cy + r * 0.3, 2.2, VIOLET);
      break;
    case "hard-contact":
      // A hull, and the wall it found.
      stroke(WRECKC, 2, () => {
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.25, cy - r); ctx.lineTo(cx + r * 0.25, cy + r);
        ctx.stroke();
      });
      stroke(AMBER, 1.6, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.4); ctx.lineTo(cx + r * 0.1, cy);
        ctx.lineTo(cx - r, cy + r * 0.4);
        ctx.stroke();
      });
      for (let i = 0; i < 5; i++) {
        const t = -0.9 + i * 0.45;
        stroke(WARN, 1.2, () => {
          ctx.beginPath();
          ctx.moveTo(cx + r * 0.3, cy + Math.sin(t) * r * 0.6);
          ctx.lineTo(cx + r * 0.7, cy + Math.sin(t) * r * 0.85);
          ctx.stroke();
        });
      }
      break;
    case "through":
      // In one side and out the other: two mouths and the line between.
      ring(cx - r * 0.55, cy, r * 0.42, ICE, 1.6);
      ring(cx + r * 0.55, cy, r * 0.42, VIOLET, 1.6);
      stroke(VIOLET_DIM, 1.2, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.2, cy - r * 0.22);
        ctx.bezierCurveTo(cx, cy - r * 0.8, cx, cy + r * 0.8, cx + r * 0.2, cy + r * 0.22);
        ctx.stroke();
      });
      break;
    case "laden":
      // A hold with nothing left in it but salvage.
      stroke(CASH_DIM, 1.6, () => {
        ctx.strokeRect(cx - r * 0.8, cy - r * 0.6, r * 1.6, r * 1.2);
      });
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          disc(cx - r * 0.45 + i * r * 0.45, cy - r * 0.22 + j * r * 0.45,
               r * 0.13, HUD_CASH);
        }
      }
      break;
    case "refit":
      // Three tiers, two of them bought.
      for (let i = 0; i < 3; i++) {
        const bx = cx - r * 0.7 + i * r * 0.7;
        stroke(CASH_DIM, 1.4, () => {
          ctx.strokeRect(bx - r * 0.22, cy - r * 0.5 + i * r * 0.1,
                         r * 0.44, r * 1.0 - i * r * 0.2);
        });
        if (i < 2) {
          ctx.save();
          ctx.fillStyle = lit(HUD_CASH);
          ctx.globalAlpha = a;
          ctx.fillRect(bx - r * 0.14, cy - r * 0.42 + i * r * 0.1,
                       r * 0.28, r * 0.84 - i * r * 0.2);
          ctx.restore();
        }
      }
      break;
    case "grave-robber":
      // The cache, and the broken ring that was guarding it.
      stroke(HUD_CASH, 1.6, () => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const t = (i / 6) * Math.PI * 2;
          const px = cx + Math.cos(t) * r * 0.5, py = cy + Math.sin(t) * r * 0.5;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.stroke();
      });
      stroke(WARN, 1.3, () => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, 0.5, Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.88, Math.PI * 1.2, Math.PI * 1.75);
        ctx.stroke();
      });
      break;
    case "shipwright":
      /* An anvil, more or less: raw stock going in on the left and a finished
         shape coming out, over a bench. The one picture in here that is about
         making rather than finding. */
      stroke(HUD_CASH, 1.7, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.85, cy + r * 0.5);
        ctx.lineTo(cx + r * 0.85, cy + r * 0.5);
        ctx.stroke();
        // the finished part, standing on the bench
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.1, cy + r * 0.5);
        ctx.lineTo(cx + r * 0.1, cy - r * 0.2);
        ctx.lineTo(cx + r * 0.7, cy - r * 0.2);
        ctx.lineTo(cx + r * 0.7, cy + r * 0.5);
        ctx.stroke();
      });
      stroke(CASH_DIM, 1.3, () => {
        // three units of stock, waiting
        for (let i = 0; i < 3; i++) {
          const bx = cx - r * 0.75 + i * r * 0.26;
          ctx.beginPath();
          ctx.moveTo(bx, cy + r * 0.42);
          ctx.lineTo(bx + r * 0.1, cy + r * 0.16);
          ctx.lineTo(bx + r * 0.2, cy + r * 0.42);
          ctx.closePath();
          ctx.stroke();
        }
      });
      break;

    case "salvor":
      // A part, carried: the triangle the world draws one with, on its way.
      stroke(HUD_CASH, 1.7, () => {
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.62);
        ctx.lineTo(cx + r * 0.56, cy + r * 0.36);
        ctx.lineTo(cx - r * 0.56, cy + r * 0.36);
        ctx.closePath();
        ctx.stroke();
      });
      stroke(CASH_DIM, 1.3, () => {
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.9, cy + r * 0.72);
        ctx.lineTo(cx + r * 0.9, cy + r * 0.72);
        ctx.stroke();
      });
      break;
    case "finished":
      // The yard, closed: every segment of the ring filled in.
      ring(cx, cy, r * 0.86, HUD_CASH, 1.6);
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * Math.PI * 2 + 0.06;
        const a1 = ((i + 1) / 6) * Math.PI * 2 - 0.06;
        stroke(HUD_CASH, 3, () => {
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.56, a0, a1);
          ctx.stroke();
        });
      }
      disc(cx, cy, r * 0.2, HUD_CASH);
      break;
    default:                  ring(cx, cy, r * 0.8, VIOLET, 1.6);
  }
}

// Exposed so the game can draw the same picture anywhere else it wants one.
HUD.icon = drawIcon;
