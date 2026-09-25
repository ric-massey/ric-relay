"use strict";
/* KONDRITE — SURVEY INTERFACE: THE PANEL
   ─────────────────────────────────────────────────────────────────────────────
   The thin panel you fly behind: what you are doing, static, running at light,
   what a scan came back with, the left column, where you are, the powers at a
   glance, the devices, edge arrows, and something picked off the chart. */

/* ═══ THE PANEL ═══════════════════════════════════════════════════════════
   What you fly behind. Deliberately thin: the mode is about looking at the
   world, so the resting state is a chart, two counters and a hull bar, and
   everything else blooms in when it has something to say. */
HUD.arrows = [];

HUD.drawPanel = function (st, dt) {
  if (!api) return;
  st = st || {};
  HUD.arrows = [];
  if (pulse > 0) pulse = Math.max(0, pulse - (dt || 0));
  // An open one is being read, so its clock waits. See `drawNotes`.
  for (const n of notes) if (!n.open) n.t -= (dt || 0);
  notes = notes.filter(n => n.t > 0 || n.open);

  if (st.ship) {
    if (pulse > 0) drawPulse();
    drawContacts(st);
  }
  // Drawn under everything else: at zero hull the whole frame is edged in the
  // warning colour, so the state is visible without looking anywhere in
  // particular. The gravity band uses the same figure for the same reason.
  // Under everything the panel draws, over everything the world drew.
  drawStatic(st.grain || 0);
  if (st.critical) drawCriticalEdge(!!st.inStar && !!st.solar);
  else if ((st.water && st.water.countdown > 0) ||
           (st.food && st.food.countdown > 0)) drawCriticalEdge(false);
  if (st.ship) {
    drawEchoArrows(st);
    drawSelectedArrow(st);
  }
  drawSector(st);
  drawPanelChart(st);
  drawPowers(st);
  drawCounters(st);
  drawWarnBand(st);
  drawStrip(st);
  drawNotes(st);
};

/* ── what you are doing ───────────────────────────────────────────────────
   Survey went a long time without answering this. It had an almanac, which
   records what you happened to see, and a scan, which returned a number to a
   message feed — between them a new pilot could fly for an hour without the
   mode ever stating a goal. So the goal is on screen, always, in three lines
   at the top of the frame:

     what to find      the part the yard is short of
     where to look     the clue, which describes a kind of place
     which way         a bearing and a range band, never a position

   The bearing is here rather than behind the scan key for the same reason the
   rest of it is: a button you have to press to be told what you are doing is a
   button doing the interface's job. The scan is for what is *near* you now;
   this is for where you are going. */
/* The gravity warning. Loud, central, and above the objective — it is the one
   thing on this HUD that is about the next four seconds rather than the next
   four minutes, so it takes the position the eye goes to first and it is the
   only element allowed to move. */
function drawWarnBand(st) {
  const w = st.warn;
  if (!w) return;
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / (w.ratio >= 1 ? 160 : 280)));

  /* A border that closes in, rather than a box in the middle: the danger is
     out there, and framing the whole view says so without covering any of it.
     Nested strokes rather than a radial gradient — a gradient is an
     allocation every frame for something six rectangles do, and this module
     already refuses shadowBlur on the same grounds. */
  ctx.save();
  ctx.strokeStyle = w.colour;
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    ctx.globalAlpha = (0.16 + beat * 0.2 * Math.min(1, w.ratio)) *
                      (1 - i / bands) * 0.8;
    ctx.lineWidth = 3;
    const inset = 2 + i * 7;
    ctx.strokeRect(inset, inset, SCREEN_W - inset * 2, SCREEN_H - inset * 2);
  }
  ctx.restore();

  const y = SCREEN_H / 2 - 132;
  label(w.text, SCREEN_W / 2, y, SIZE.head, w.colour, "center", beat, "0.16em");
  /* Named where it has a name. "SUPERMASSIVE BLACK HOLE" is a category and
     "TORIS MAW" is a place — and the whole point of naming them was that the
     one you have to plan around becomes a thing you can talk about. */
  /* Held clear of the right-hand column. On a phone the panel chart is pushed
     left to leave the pause button room, and this line — the widest on the
     warning — was drawn straight through the minimap's border. */
  const clear = (panelBox().x - 30 - SCREEN_W / 2) * 2;
  fitText((w.name ? w.name + "   ·   " : "") +
          (w.big ? "SUPERMASSIVE " : "") +
          (w.kind === "hole" ? "BLACK HOLE" : "STAR") +
          "   ·   BEARING " + String(w.bearing).padStart(3, "0"),
          SCREEN_W / 2, y + 24, SIZE.cap, w.colour, "center", 0.85,
          Math.max(320, Math.min(SCREEN_W - 120, clear)), "0.1em");
  if (w.ratio >= 1) {
    label("BURN AWAY — YOUR DRIVE WILL NOT LIFT YOU OUT",
          SCREEN_W / 2, y + 46, SIZE.cap, w.colour, "center", beat);
  }
}

/* The same closing border the gravity warning uses, in the hull's colour. It
   is not competing with that warning: a well warns about the next four
   seconds and this warns about the whole rest of the run, so the hull edge is
   thinner, slower and never covers the middle of the screen. */
/* ── static ───────────────────────────────────────────────────────────────
   A region that interferes with sensors should *look* like it, and the thing
   that is being interfered with is the interface — so the interface is what
   goes wrong. Grain over the whole screen, thicker the deeper in you are, plus
   the occasional horizontal tear, which is what a picture does when it is not
   being received properly.

   Drawn with rectangles rather than per-pixel image data, because this runs
   every frame on a phone: a few hundred small blocks at random positions reads
   as noise at a glance and costs almost nothing. The count scales with how bad
   it is, so at the edge of a murk it is a faint crawl and in the middle of one
   it is most of what you can see.

   `reduceMotion` turns it off entirely — flickering noise across a whole screen
   is exactly what that setting exists for — and the region still cuts the scan,
   so the rule is intact for anybody who cannot look at this. */
let grainSeed = 1;
function drawStatic(amount) {
  if (!amount || api.reduceMotion) return;
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const n = Math.round(140 + amount * 1100);
  ctx.save();
  ctx.globalAlpha = 0.07 + amount * 0.46;
  ctx.fillStyle = "#c8d4e8";
  for (let i = 0; i < n; i++) {
    // A cheap integer hash rather than Math.random: the same crawl every frame
    // would read as a texture, and this is meant to be alive.
    grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
    const x = (grainSeed >>> 9) % SCREEN_W;
    grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
    const y = (grainSeed >>> 9) % SCREEN_H;
    const w = 1 + ((grainSeed >>> 4) & 3);
    ctx.fillRect(x, y, w, 1 + ((grainSeed >>> 6) & 1));
  }
  // And a tear or two, which is what a picture does when it is not arriving.
  if (amount > 0.35) {
    const tears = Math.round(amount * 3);
    for (let i = 0; i < tears; i++) {
      grainSeed = (grainSeed * 1664525 + 1013904223) >>> 0;
      const ty = (grainSeed >>> 7) % SCREEN_H;
      const th = 2 + ((grainSeed >>> 3) & 7);
      ctx.globalAlpha = 0.06 + amount * 0.2;
      ctx.fillRect(0, ty, SCREEN_W, th);
    }
  }
  ctx.restore();
}

function drawCriticalEdge(mending) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const beat = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / (mending ? 520 : 300)));
  ctx.save();
  ctx.strokeStyle = mending ? SOLAR : WARN;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = (0.1 + beat * 0.16) * (1 - i / 4);
    ctx.lineWidth = 3;
    const inset = 2 + i * 6;
    ctx.strokeRect(inset, inset, SCREEN_W - inset * 2, SCREEN_H - inset * 2);
  }
  ctx.restore();
}

/* ── running at light ─────────────────────────────────────────────────────
   Two things to draw and they are not the same job. The run itself is a state:
   streaks along the direction of travel, so the speed is legible without a
   number. The impact is an event with a deadline, and it gets the middle of the
   screen and a count, because five seconds is the whole of what you have and a
   player reading a corner of the HUD will spend two of them finding it. */
function drawLightRun(st) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const L = st.light;
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;

  if (!api.reduceMotion) {
    ctx.save();
    ctx.strokeStyle = ICE;
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 22; i++) {
      // Deterministic per streak, so they read as motion rather than as noise.
      const a = (i / 22) * Math.PI * 2 + (Date.now() / 900) % (Math.PI * 2);
      const spread = 120 + ((i * 137) % 220);
      const len = (60 + ((i * 91) % 180)) * L.run;
      const x0 = cx + Math.cos(a) * spread, y0 = cy + Math.sin(a) * spread;
      ctx.globalAlpha = 0.10 + 0.22 * L.run;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  label("LIGHT DRIVE  ·  " + Math.round(L.run * 100) + "%", cx, 44, SIZE.cap,
        ICE, "center", 0.6 + 0.4 * L.run, "0.2em");

  const hit = L.hit;
  if (!hit) return;
  /* The five-second warning. It counts, it names the thing, and it says what
     to do about it — which is the one instruction that works at this speed. */
  const t = Math.max(0, hit.eta);
  const close = t < 2;
  const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / (close ? 130 : 260)));
  const colour = close ? WARN : "#ffcb42";
  ctx.save();
  ctx.strokeStyle = colour;
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = (0.16 + beat * 0.2) * (1 - i / 6) * 0.85;
    ctx.lineWidth = 3;
    const inset = 2 + i * 7;
    ctx.strokeRect(inset, inset, SCREEN_W - inset * 2, SCREEN_H - inset * 2);
  }
  ctx.restore();

  const y = cy - 150;
  label("IMPACT IN " + t.toFixed(1) + "s", cx, y, SIZE.big, colour, "center",
        beat, "0.16em");
  fitText(hit.name, cx, y + 30, SIZE.head, colour, "center", 0.95,
          SCREEN_W - 200, "0.1em");
  label("TURN, OR CUT THE DRIVE" + (api.touchOnly ? "" : "  —  [R]"),
        cx, y + 58, SIZE.cap, colour, "center", beat, "0.14em");
}

/* There used to be an objective band across the top of the screen: the part
   the station wants, its clue, and an n/6 tally, all drawn every frame
   forever. It was the busiest thing on the HUD and it was answering a question
   nobody asks twice — "what am I looking for" is a thing you check when it
   changes and then not again for twenty minutes.

   So it is a notification now, fired when it changes, and the whole manifest
   lives on a page you can open. See `HUD.notify` and `HUD.drawMissions`. */

/* The chart sits below the sector readout rather than at the very top, so the
   right-hand column reads downward as one thing: where you are, the map around
   you, the way in to everything else, and then whatever just happened. */
function panelBox() {
  const W = api.SCREEN_W;
  const w = api.touchOnly ? 158 : 196;
  return { x: W - w - 18 - padGuard.right, y: 74, w, h: w * 0.7 };
}

/* The panel chart is a window on the lattice around the ship, not the whole
   sector — there is no whole sector. Its span is fixed so the scale never
   shifts under you mid-flight. */
const PANEL_SPAN = 14000;

function drawPanelChart(st) {
  const { ctx } = api;
  const b = panelBox();
  const ship = st.ship;
  if (!ship) return;
  const sx = b.w / PANEL_SPAN, sy = b.h / (PANEL_SPAN * 0.7);
  const mx = wx => b.x + b.w / 2 + (wx - ship.x) * sx;
  const my = wy => b.y + b.h / 2 + (wy - ship.y) * sy;

  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  paintFog(mx, my, ship.x, ship.y, PANEL_SPAN, sx, sy, 0.30);
  paintMarks(st, mx, my, false, sx);
  paintEchoes(st, mx, my, false);
  drawPins(st, mx, my, false);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.restore();

  /* There was a line here saying REGION UNKNOWN: the whole of the biome
     interface, back when a biome was never named. The top right names it now,
     so the line is gone rather than contradicting it. */
  label(fmtCells(HUD.charted()) + " CHARTED", b.x + b.w, b.y + b.h + 20,
        SIZE.cap, VIOLET, "right", 0.8);

  tap({ x: b.x, y: b.y, w: b.w, h: b.h, act: st.onChart || (() => {}) });

  /* Under the chart, where the eye already is once it has looked at the map.
     It is the way in to everything the flight HUD has no room for. */
  // Eight pixels lower than it was, for the one line above it: see the region
  // readout in `drawPanelChart`, which is where the button used to start.
  const iy = b.y + b.h + 52;
  ctx.save();
  ctx.strokeStyle = VIOLET;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x, iy, b.w, 30);
  ctx.restore();
  label(api.touchOnly ? "INVENTORY" : "INVENTORY  [I]", b.x + b.w / 2, iy + 20,
        SIZE.cap, VIOLET, "center", 0.95, "0.12em");
  tap({ x: b.x, y: iy, w: b.w, h: 30, act: st.onInventory || (() => {}) });

  /* There was a second button here, for the yard. The yard was a second
     place; the parts come home to the station now, and the way into a station
     is the way into a station — `E`, or the DOCKED prompt on a phone. One
     door, and nothing under the chart that only ever lit up in one spot a few
     hundred units from the origin. */
}

/* ── what a scan came back with ───────────────────────────────────────────
   A scan reaches 2,100 units and 3,885 once the scanner is refitted; the view
   is about 700 across. So almost everything a scan found was off screen, and
   the only answer the button gave you was a line of text — the returns were
   drawn in world space and nowhere else.

   They go on the chart now, for as long as they last, and hostile returns are
   drawn differently rather than merely in a different colour: a sentry gets a
   ring and a cross, everything else gets a filled dot. Shape first, because a
   player who cannot tell the two greens apart on a phone in daylight still has
   to be able to tell a shop from a gun. */
function paintEchoes(st, mx, my, big) {
  const list = st.echoes || [];
  if (!list.length) return;
  const { ctx } = api;
  const R = big ? 5 : 3.4;
  ctx.save();
  for (const e of list) {
    // Fades out over its last quarter, so a stale contact reads as stale.
    const a = Math.min(1, (e.t / Math.max(1, e.life)) * 4);
    const x = mx(e.x), y = my(e.y);
    ctx.globalAlpha = a * 0.95;
    ctx.strokeStyle = e.colour;
    ctx.fillStyle = e.colour;
    if (e.bad) {
      ctx.lineWidth = big ? 2 : 1.4;
      ctx.beginPath();
      ctx.arc(x, y, R + 1.5, 0, Math.PI * 2);
      ctx.stroke();
      const k = R * 0.8;
      ctx.beginPath();
      ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
      ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
    }
    /* The badge: in trouble is an amber triangle above the return, making
       trouble is a red slash through a ring beside it. Neither says a word;
       see `e.trouble` in the scan. */
    if (e.trouble === "in") {
      ctx.strokeStyle = AMBER; ctx.fillStyle = AMBER; ctx.lineWidth = 1.2;
      const s = big ? 5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(x, y - R - s * 2.2); ctx.lineTo(x + s, y - R - 3); ctx.lineTo(x - s, y - R - 3);
      ctx.closePath(); ctx.stroke();
    } else if (e.trouble === "making") {
      ctx.strokeStyle = WARN; ctx.lineWidth = 1.2;
      markGlyph(ctx, "raid", x + R + (big ? 8 : 6), y - R, big ? 4 : 3);
    }
  }
  ctx.restore();
}

/* A tenth of a thousand is worth reading at 12.4K and is noise at 2500.0K,
   where it also cost the word it sat next to: the chart's rail read
   "2500.0K ACR." because the number would not leave room for "ACROSS". */
const fmtCells = n => n >= 1000000 ? Math.round(n / 1000000) + "M"
                    : n >= 100000 ? Math.round(n / 1000) + "K"
                    : n >= 10000 ? (n / 1000).toFixed(1) + "K" : String(n);

/* Minutes and seconds, and never an hour: a tank is measured in minutes and a
   countdown in seconds, and both want the same shape so the readout does not
   change format under you as it empties. */
const fmtSecs = n => {
  const t = Math.max(0, Math.round(n));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
};

/* Charted cells, drawn as cells. The blockiness is the instrument reading —
   a scanned grid — not an artefact to smooth away, and it makes the count an
   exact thing rather than an estimate. Only cells inside the view are ever
   touched, so the cost is the window's size and not the survey's. */
function paintFog(mx, my, cxw, cyw, span, sx, sy, alpha) {
  const { ctx } = api;
  const halfX = span / 2, halfY = (span * 0.7) / 2;
  const c0 = Math.floor((cxw - halfX) / CELL), c1 = Math.ceil((cxw + halfX) / CELL);
  const r0 = Math.floor((cyw - halfY) / CELL), r1 = Math.ceil((cyw + halfY) / CELL);
  if ((c1 - c0) * (r1 - r0) > 40000) return;   // zoomed out past usefulness
  const w = Math.max(1, CELL * sx), h = Math.max(1, CELL * sy);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = VIOLET;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!fog.has(cellKey(c, r))) continue;
      ctx.fillRect(mx(c * CELL), my(r * CELL), w, h);
    }
  }
  ctx.restore();
}

/* Everything plotted on either chart. Objects appear only where you have
   actually charted — the chart is your record, not the sector's truth, and
   that distinction is most of the mode. */
/* Everything the chart can show, and how it shows it. One table so a legend
   can be drawn from the same source the marks are — a key that drifts from
   the map is worse than no key at all. */
const CHART_MARKS = {
  station:   { name: "STATION",  colour: "#6dffbf" },
  gate:      { name: "GATE",     colour: "#5ce1ff" },
  cache:     { name: "CACHE",    colour: "#ffe56d" },
  part:      { name: "COMPONENT", colour: "#a08cff" },
  leviathan: { name: "LEVIATHAN", colour: "#7d8596" },
  star:      { name: "STAR",     colour: "#ffd76d" },
  hole:      { name: "BLACK HOLE", colour: "#ff8f77" },
  planet:    { name: "WORLD",    colour: "#87d8ff" },
  // Two powers having it out, and where two powers finished having it out.
  battle:    { name: "BATTLE",   colour: "#ff8f77" },
  memorial:  { name: "MEMORIAL", colour: "#a08cff" },
  // A boss's sky, drawn to its size.
  boss:      { name: "BOSS",     colour: "#ff4dd2" },
  /* Things that happened, on the map where they happened. The living
     world writes these (living.js): a raid on a station, ground taken
     from somebody, a shortage you broke. */
  raid:      { name: "RAID",     colour: "#ff8f77" },
  taken:     { name: "TAKEN",    colour: "#ffcb42" },
  relief:    { name: "RELIEF",   colour: "#6dffbf" },
  cause:     { name: "WITHHELD", colour: "#ffb347" },
  secede:    { name: "SECESSION", colour: "#ffb347" }
};

function markGlyph(ctx, k, x, y, r) {
  switch (k) {
    case "station":
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.34, 0, Math.PI * 2); ctx.stroke();
      break;
    case "gate":
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      break;
    case "cache":
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
      break;
    case "part":
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.7);
      ctx.lineTo(x - r, y + r * 0.7); ctx.closePath(); ctx.stroke();
      break;
    case "leviathan":
      ctx.beginPath();
      ctx.moveTo(x - r * 1.6, y - r * 0.5); ctx.lineTo(x + r * 1.2, y - r * 0.5);
      ctx.lineTo(x + r * 1.7, y); ctx.lineTo(x + r * 1.2, y + r * 0.5);
      ctx.lineTo(x - r * 1.6, y + r * 0.5); ctx.closePath(); ctx.stroke();
      break;
    case "battle":
      // Crossed, because that is what it is.
      ctx.beginPath();
      ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
      ctx.stroke();
      break;
    case "boss":
      // Its sky, and a crown in the middle of it.
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 3); ctx.lineTo(x - 5, y - 3); ctx.lineTo(x - 2, y);
      ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y); ctx.lineTo(x + 5, y - 3);
      ctx.lineTo(x + 5, y + 3); ctx.closePath(); ctx.stroke();
      break;
    case "raid":
      // A strike: a slash through a ring.
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 1.3, y + r * 1.3); ctx.lineTo(x + r * 1.3, y - r * 1.3);
      ctx.stroke();
      break;
    case "taken":
      // A pennant on a pole.
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y + r); ctx.lineTo(x - r * 0.7, y - r);
      ctx.lineTo(x + r, y - r * 0.55); ctx.lineTo(x - r * 0.7, y - r * 0.1);
      ctx.stroke();
      break;
    case "relief":
      // A plus.
      ctx.beginPath();
      ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
      ctx.stroke();
      break;
    case "war":
      // Two bars crossed inside a ring: a fight that is a state, not a place.
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6);
      ctx.moveTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x - r * 0.6, y + r * 0.6);
      ctx.stroke();
      break;
    case "peace":
      // A ring, open at the top.
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI * 0.3, Math.PI * 1.3); ctx.stroke();
      break;
    case "trade":
      // Two arrows passing.
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.4); ctx.lineTo(x + r, y - r * 0.4);
      ctx.lineTo(x + r * 0.5, y - r * 0.9);
      ctx.moveTo(x + r, y + r * 0.4); ctx.lineTo(x - r, y + r * 0.4);
      ctx.lineTo(x - r * 0.5, y + r * 0.9);
      ctx.stroke();
      break;
    case "kill":
      // A small x.
      ctx.beginPath();
      ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      break;
    case "rescue":
      // A ring with a heart-beat dot: somebody kept.
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case "loss":
      // A V, pointing down: something went in and did not come out.
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.7); ctx.lineTo(x, y + r); ctx.lineTo(x + r, y - r * 0.7);
      ctx.stroke();
      break;
    case "vote":
      // A box with a tick in it.
      ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x - r * 0.1, y + r * 0.55); ctx.lineTo(x + r * 0.7, y - r * 0.6);
      ctx.stroke();
      break;
    case "fall":
      // A column going over.
      ctx.beginPath();
      ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y + r);
      ctx.moveTo(x - r * 0.4, y + r); ctx.lineTo(x + r * 0.8, y - r);
      ctx.stroke();
      break;
    case "law":
      // A tablet with two lines on it.
      ctx.beginPath(); ctx.rect(x - r * 0.8, y - r, r * 1.6, r * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, y - r * 0.35); ctx.lineTo(x + r * 0.4, y - r * 0.35);
      ctx.moveTo(x - r * 0.4, y + r * 0.25); ctx.lineTo(x + r * 0.4, y + r * 0.25);
      ctx.stroke();
      break;
    case "cause":
      // A ring broken open at the top: the people, and what is leaving it.
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI * 0.25, Math.PI * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.2); ctx.lineTo(x, y - r * 1.5); ctx.stroke();
      break;
    case "secede":
      // The pennant, turned the other way: a flag of their own.
      ctx.beginPath();
      ctx.moveTo(x + r * 0.7, y + r); ctx.lineTo(x + r * 0.7, y - r);
      ctx.lineTo(x - r, y - r * 0.55); ctx.lineTo(x + r * 0.7, y - r * 0.1);
      ctx.stroke();
      break;
    case "bounty":
      // A ring with a dot and the four ticks of a sight.
      ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - r * 1.3, y); ctx.lineTo(x - r * 0.5, y); ctx.moveTo(x + r * 0.5, y); ctx.lineTo(x + r * 1.3, y);
      ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x, y - r * 0.5); ctx.moveTo(x, y + r * 0.5); ctx.lineTo(x, y + r * 1.3);
      ctx.stroke();
      break;
    case "memorial":
      // A stone.
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y + r); ctx.lineTo(x - r * 0.4, y - r);
      ctx.lineTo(x + r * 0.4, y - r); ctx.lineTo(x + r * 0.6, y + r);
      ctx.closePath(); ctx.stroke();
      break;
    case "hole":
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "#000"; ctx.fill(); ctx.stroke();
      break;
    case "planet":
      ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.stroke();
      break;
    default:                              // star
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.fill();
      break;
  }
}

/* The record, drawn. This is the half of the chart that answers "where was
   that thing" — the live lists below only ever knew about the five chunks
   either side of the ship, so the map used to forget a station the moment you
   left it behind. */
const SIZED = { planet: 1, hole: 1, star: 1, boss: 1 };

function paintKnown(st, mx, my, big, scale) {
  const { ctx } = api;
  const R = big ? 5 : 3;
  ctx.save();
  ctx.lineWidth = big ? 1.6 : 1;
  for (const q of (st.known || [])) {
    const spec = CHART_MARKS[q.k];
    if (!spec) continue;
    if (chart.hide[q.k]) continue;          // turned off in the rail
    /* Worlds and wells go on the panel now as well as the full chart. They
       were filtered out of it — only stations, gates and parts were "things
       you navigate by" — which was written when a planet was 190 units across
       and nothing to steer around. A world can be 3,600 across and solid, and a
       supermassive well's reach is a piece of the sector you have to plan a
       route through; both of those are exactly what a minimap is for. */
    if (!big && q.k !== "station" && q.k !== "gate" && q.k !== "part" &&
        !SIZED[q.k]) continue;

    /* Drawn to scale where the thing has a scale. Every world used to be the
       same five-pixel circle whatever its size, so the chart could not tell you
       the one fact about a world you navigate by. The glyph size is a floor,
       not the size: something genuinely small still has to be findable. */
    const scaled = SIZED[q.k] && q.r && scale ? q.r * scale : 0;
    const gr = Math.max(R, scaled);

    ctx.strokeStyle = spec.colour;
    ctx.fillStyle = spec.colour;
    ctx.globalAlpha = scaled > R * 1.5 ? 0.75 : 0.9;
    markGlyph(ctx, q.k, mx(q.x), my(q.y), gr);
    /* A big one gets its own dot in the middle as well, so a world drawn as a
       wide ring still has a point you can aim at and still reads as a mark
       rather than as a stray circle on the grid. */
    if (scaled > R * 2.5) {
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(mx(q.x), my(q.y), big ? 2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    /* Its name, if it has one. Worlds and supermassive wells are the two kinds
       of thing in the sector that are *called* something, and a chart that knew
       the name and drew an anonymous glyph was throwing away the only reason
       the naming exists. Held back at the two widest zooms, where a sector's
       worth of labels would be a solid block of type rather than a map. */
    if (big && q.name && chart.scale >= 0.006) {
      ctx.globalAlpha = 1;
      label(q.name, mx(q.x) + R + 7, my(q.y) + 4, SIZE.cap, spec.colour,
            "left", 0.8);
      ctx.globalAlpha = 0.9;
    }
    // Armed for a jump, the stations are the only things you can hit, so
    // they are the only things drawn as though you could.
    if (big && chart.jump && q.k === "station") {
      ctx.strokeStyle = HUD_CASH;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx(q.x), my(q.y), R + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = big ? 1.6 : 1;
    }
  }
  ctx.restore();
}

function paintMarks(st, mx, my, big, scale) {
  const { ctx } = api;
  const R = big ? 1.7 : 1;

  paintKnown(st, mx, my, big, scale);

  // The yard is the one fixed place in the sector and the thing you keep
  // coming back to, so it is always on the chart whether or not it is loaded.
  /* Home, and what it is still short of. It sits on top of the station mark
     the gazetteer already draws rather than beside it, because it is the same
     place: the tally is what your own station still wants, not a second
     structure off the origin. */
  if (st.home && big && st.home.built < st.home.needs) {
    const x = mx(st.home.x), y = my(st.home.y);
    ctx.save();
    ctx.strokeStyle = VIOLET;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    label("YOUR STATION  " + st.home.built + "/" + st.home.needs,
          x + 14, y + 5, SIZE.cap, VIOLET, "left", 0.9);
  }

  // A found landmark keeps its mark for good — the chart is the record of
  // what you have done, and a mark you can see from a long way off is most of
  // why filling it in is worth doing.
  for (const s of (st.landmarks || [])) {
    if (!s.found && !HUD.seen(s.x, s.y)) continue;
    const px = mx(s.x), py = my(s.y), r = 5 * R;
    ctx.save();
    ctx.strokeStyle = s.found ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = s.found ? 1 : 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py - r); ctx.lineTo(px + r, py);
    ctx.lineTo(px, py + r); ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    if (big && s.found && s.name) {
      label(s.name, px + r + 8, py + 5, SIZE.cap, VIOLET, "left", 0.85);
    }
  }

  const beat = 0.5 + 0.5 * Math.sin((st.clock || 0) * 3.4);
  for (const c of (st.contacts || [])) {
    if (c.resolved) continue;
    ctx.save();
    ctx.strokeStyle = VIOLET;
    ctx.globalAlpha = 0.35 + 0.45 * beat;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(mx(c.x), my(c.y), (big ? 9 : 5) + beat * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (st.ship) {
    const px = mx(st.ship.x), py = my(st.ship.y);
    ctx.save();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(px, py, 3.5 * R, 0, Math.PI * 2);
    ctx.fill();
    // Which way you are pointed: on a mostly empty chart it is the only thing
    // that says which way "forward" fills it in.
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(st.ship.a || 0) * 12 * R,
               py + Math.sin(st.ship.a || 0) * 12 * R);
    ctx.stroke();
    ctx.restore();
  }
}

/* Top left, the two things that are actually accumulating. The almanac count
   was here from the start and the salvage count joins it, because a mode with
   two progression tracks has to show both or the player is only playing the
   one they can see.

   The count is also the *button*. It was reachable on `L` from the first day
   and almost nobody found it: a keybinding with nothing on screen pointing at
   it is a keybinding that does not exist. Naming the key next to the number
   is the whole fix, and making the number tappable is what makes it true on a
   phone as well. */
/* ── the left column ──────────────────────────────────────────────────────
   What you have, and what is running out. Four readouts and nothing else.

   The almanac count used to head this column and it has gone: it is a *total*,
   it changes about once every ten minutes, and there is a page for it — which
   is exactly the description of something that does not belong on a flight
   HUD. It lives on the inventory now, as a button, next to the missions.

   Water and food are percentages rather than minutes. Minutes were the more
   informative reading and that turned out to be the wrong trade: two m:ss
   clocks and their bars took four lines and a lot of width to say something a
   player checks with a glance, and a glance is all a percentage needs. */
function drawCounters(st) {
  const { ctx } = api;

  /* Money, then cargo — different things, and the panel used to show one
     number pretending to be both. Cash has no ceiling; the hold is a fraction
     of one, and the fraction is the part you make decisions about. */
  label("CASH", 24, 36, SIZE.cap, CASH_DIM, "left", 0.7, "0.18em");
  label(hudMoney(st.cash), 24, 62, SIZE.head, HUD_CASH, "left");

  /* "CARGO", the same word the page uses. It read STORAGE while there were
     two of these, and two names for one number is how a player ends up
     believing there are two — and then "HOLD", which is a word from a trade
     nobody here is in. Everything a ship carries is cargo. */
  if (st.hold) {
    const used = st.carried || 0, cap = st.hold;
    const full = used >= cap;
    label("CARGO", 24, 92, SIZE.cap, VIOLET_DIM, "left", 0.7, "0.18em");
    label(used + " / " + cap, 24, 114, SIZE.val, full ? WARN : VIOLET, "left");
    if (full) {
      label("FULL — SELL IT", 24, 136, SIZE.cap, WARN, "left",
            0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 400)));
    }
  }

  /* Life support: a name and a percentage. There were bars here and they have
     gone, along with the one under storage — a bar is a second drawing of a
     number that was already on the line beside it, and four of them made a
     corner that had to be read rather than glanced at. The percentage is the
     whole reading; the colour carries "getting low".

     An emptied tank is the exception: it says how long you have left instead,
     because 0% is the same picture whether you have a minute or a second. */
  ["water", "food"].forEach((key, i) => {
    const m = st[key];
    if (!m) return;
    const y = 172 + i * 26;
    const out = m.countdown > 0;
    const low = !out && m.frac < 0.2;
    const colour = out ? WARN : low ? "#ffcb42" : (key === "water" ? ICE : AMBER_DIM);
    const beat = out ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 220)) : 1;

    label(key.toUpperCase(), 24, y, SIZE.cap, colour, "left",
          out ? beat : 0.7, "0.14em");
    label(out ? fmtSecs(m.countdown) + " LEFT"
              : Math.round(m.frac * 100) + "%",
          108, y, out ? SIZE.cap : SIZE.val, colour, "left", out ? beat : 0.95);

    /* ── the low mark ───────────────────────────────────────────────────
       A tank quietly dropping is a tank you do not notice until it is a
       countdown. So it says so: the first couple of times a tank falls past
       half, the word WARNING appears beside it for ten seconds — and then the
       word goes and the triangle *slides in next to the number* and stays
       there while the tank is low.

       The slide is the point. It teaches what the mark means by showing them
       together, then leaves you the mark. After two lessons there is no word
       at all, just the triangle at each step down. */
    const w = m.warn;
    if (w && w.lit && !out) {
      const shout = w.shout || 0;
      /* Where the mark sits: out beside the word while it is shouting, tucked
         against the number once it is done. Eased, so it reads as one thing
         moving rather than two things blinking. */
      const numW = String(Math.round(m.frac * 100) + "%").length * 11 + 6;
      const home = 108 + numW;
      const away = 214;
      const t = shout > 0 ? shout * shout : 0;      // slow at first, then quick
      const mx = home + (away - home) * t;
      warnMark(mx, y - 5, 8, colour, out ? beat : 1);
      if (shout > 0) {
        label("WARNING", away + 18, y, SIZE.cap, WARN, "left",
              Math.min(1, shout * 4) *
              (0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 260))), "0.16em");
      }
    }
  });

  /* Two ways water arrives that are not a shop, and both say so in the same
     place. Skimming wins the line: you are flying through an atmosphere to do
     it, and the melter runs quietly on its own. */
  if (st.skimming || st.melting) {
    label(st.skimming ? "SKIMMING" : "MELTING ICE", 24, 250, SIZE.cap, ICE,
          "left", 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 260)), "0.14em");
  }
}

/* A warning triangle, drawn rather than typed. A glyph would be at the mercy of
   whatever the device has installed; this is the same hairline vector as
   everything else on the screen and it is the same shape at every size. */
function warnMark(cx, cy, r, colour, alpha) {
  const { ctx } = api;
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.92, cy + r * 0.72);
  ctx.lineTo(cx - r * 0.92, cy + r * 0.72);
  ctx.closePath();
  ctx.stroke();
  /* The bang inside it is always red, and always beating — whatever colour the
     triangle is drawn in. The triangle takes the colour of the thing it is
     warning about, which is the right way round for telling water from food at
     a glance and the wrong way round for being alarming: an amber bang inside
     an amber triangle is a symbol, and this needs to be an alarm. So the mark
     keeps the tank's colour and the bang does not.

     It beats on wall-clock time rather than on anything the simulation owns, so
     it goes on flashing on a page that has stopped the world. */
  const beat = 0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 260));
  ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * beat;
  ctx.strokeStyle = WARN;
  ctx.fillStyle = WARN;
  ctx.lineWidth = Math.max(1.8, r * 0.19);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.34);
  ctx.lineTo(cx, cy + r * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.46, Math.max(1.3, r * 0.11), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ── where you are ────────────────────────────────────────────────────────
   Top right, above the chart, because it is the same question the chart
   answers and the two belong together. It used to be a ring — HOME, OPEN,
   HOSTILE — because danger was a distance. It is two facts now, both in
   words: whose sky this is, and what kind of sky. Ric: *"it should tell you
   what ones your in on top right."* The bar under them is how dangerous the
   two are together, in the colour of whoever holds it. */
function drawSector(st) {
  const pl = st.place;
  if (!pl) return;
  const { ctx } = api;
  const b = panelBox();
  const right = b.x + b.w;
  const w = b.w + 40;
  fitText(pl.space.name, right, 30, SIZE.val, pl.space.colour || VIOLET,
          "right", 0.95, w, "0.06em");
  fitText(pl.biome.name, right, 50, SIZE.cap, pl.biome.colour || VIOLET_DIM,
          "right", 0.85, w, "0.1em");

  const bw = 108;
  ctx.save();
  ctx.strokeStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1;
  const barY = 58;
  ctx.strokeRect(right - bw, barY, bw, 5);
  ctx.fillStyle = pl.space.colour || VIOLET;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(right - bw + 1, barY + 1,
               Math.max(1, (bw - 2) * (pl.danger || 0)), 3);
  ctx.restore();
}

/* ── the powers, at a glance ────────────────────────────────────────────
   One strip along the foot of the minimap, and no words on it: three
   squares in the three flags' colours, each with a bar for how much fight
   that power has left, and a red tie under the two that are at war. If the
   province you are in is contested, a second colour sits inside its
   square. This is the living world's whole front-page presence in flight —
   the pages have the rest. */
function drawPowers(st) {
  const L = st.living;
  if (!L || !st.ship || !L.powers || !L.powers.length) return;
  const { ctx } = api;
  const b = panelBox();
  const y = b.y + b.h + 24;          // under the "charted" line
  const n = L.powers.length;
  const gw = Math.floor(b.w / n), sq = 8, barW = gw - sq - 8;
  const at = {};
  // Tap it and the sector page opens: the strip is the door, not a readout.
  if (st.onSector) tap({ x: b.x - 4, y: y - 4, w: b.w + 8, h: 22, act: st.onSector });
  ctx.save();
  ctx.lineWidth = 1;
  L.powers.forEach((pw, i) => {
    const x = b.x + i * gw;
    at[pw.key] = x + sq / 2;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = pw.colour;
    ctx.fillRect(x, y, sq, sq);
    // The province's second colour, if somebody else is in it too; a
    // freehold's square carries the flag it left inside it.
    if (L.here && L.here.contested === pw.key && L.here.contestedColour) {
      ctx.fillStyle = L.here.colour || VIOLET;
      ctx.fillRect(x + 2, y + 2, sq - 4, sq - 4);
    } else if (pw.cause && pw.fromColour) {
      ctx.fillStyle = pw.fromColour;
      ctx.fillRect(x + 3, y + 3, sq - 6, sq - 6);
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = VIOLET_LOW;
    ctx.strokeRect(x + sq + 4, y + 1.5, barW, 5);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = pw.colour;
    ctx.fillRect(x + sq + 5, y + 2.5, Math.max(1, (barW - 2) * pw.strength), 3);
  });
  // The war, as a tie between the two fighting it.
  const fighting = L.powers.filter(pw => pw.atWar);
  if (fighting.length === 2) {
    const a = at[fighting[0].key], c = at[fighting[1].key];
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = WARN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a, y + sq + 3); ctx.lineTo(a, y + sq + 6);
    ctx.lineTo(c, y + sq + 6); ctx.lineTo(c, y + sq + 3);
    ctx.stroke();
  }
  ctx.restore();
}

/* Bottom centre: the one band a thumb never covers on a phone and a player
   never looks away from on a desk. The two things that must always be legible
   live here, and nothing else does. */
function drawStrip(st) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const ship = st.ship;
  if (!ship) return;
  const cx = SCREEN_W / 2;
  const y = SCREEN_H - (api.touchOnly ? 34 : 26);
  const w = 210, h = 9;
  const frac = Math.max(0, Math.min(1, ship.hull / (ship.maxHull || 1)));
  /* Standing in a star's light, *and* carrying something that can drink it.
     The two are separate facts now — the light is where you are, the panels are
     what you own — and the bar must not promise a repair the ship cannot do. */
  const lit = !!st.inStar && !!st.solar;
  const unlit = !!st.inStar && !st.solar;
  const critical = !!st.critical;

  // In a star's light the hull bar is the repair readout too, so there is one
  // thing to look at rather than two.
  ctx.save();
  ctx.strokeStyle = lit ? SOLAR : RULE;
  ctx.globalAlpha = lit ? 0.9 : 0.7;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, y - h, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = frac > 0.34 ? (lit ? SOLAR : AMBER) : WARN;
  ctx.fillRect(cx - w / 2 + 1, y - h + 1, Math.max(0, (w - 2) * frac), h - 2);
  ctx.restore();

  /* Bounded to the hull bar's own width. This line sits under the bar and the
     scan button sits off the bar's right shoulder, so a caption wider than the
     bar runs into it — which is what the bigger phone type did to "IN THE LIGHT
     — NO PANELS" the moment it was introduced. */
  fitText(lit ? "SOLAR — HULL RECOVERING"
            : unlit ? "IN THE LIGHT — NO PANELS"
            : critical ? "HULL GONE" : "HULL",
        cx, y + 20, SIZE.cap,
          lit ? SOLAR : unlit ? VIOLET_DIM : critical ? WARN : AMBER_DIM,
          "center", lit || critical ? 0.95 : unlit ? 0.8 : 0.6, w + 26);

  /* ── the scan ──────────────────────────────────────────────────────────
     On a phone this was a word beside the hull bar with an invisible rectangle
     over it, which is not a button: nothing about it said it could be pressed,
     and a word on a HUD is usually a readout. It is drawn as a button now — a
     box, a border, and a ring inside it that fills as the scanner charges, so
     "charging" is the same object rather than a different word somewhere else.

     On a keyboard it stays a label, because `F` is right there and a button
     nobody clicks is furniture. */
  const ready = st.scan && st.scan.charge >= 1;
  const chg = st.scan ? Math.max(0, Math.min(1, st.scan.charge)) : 0;
  if (api.touchOnly) {
    const bw = 104, bh = 46;
    const bx = cx + w / 2 + 18, by = y - 8;
    ctx.save();
    ctx.fillStyle = ready ? VIOLET : VIOLET_LOW;
    ctx.globalAlpha = ready ? 0.22 : 0.1;
    ctx.fillRect(bx, by - bh / 2, bw, bh);
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(bx, by - bh / 2, bw, bh);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 0.9 : 0.6;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx + 23, by, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chg);
    ctx.stroke();
    ctx.restore();
    label(ready ? "SCAN" : "WAIT", bx + 44, by + 6, SIZE.cap,
          ready ? VIOLET : VIOLET_DIM, "left", ready ? 1 : 0.6, "0.1em");
    if (ready) {
      tap({ x: bx, y: by - bh / 2, w: bw, h: bh,
            act: st.onScan || (() => {}) });
    }
  } else {
    label(ready ? "SCAN  [F]" : "CHARGING",
          cx + w / 2 + 16, y, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 1 : 0.5);
  }
  /* ── where the device chips go ─────────────────────────────────────────
     They were off the *left* shoulder of the hull bar, mirroring the scan
     button on the right, on the argument that a device and a scan are the
     same kind of thing. The argument was right and the placement was not: on
     a desk it put them across the middle of the screen, which is where you
     are looking when you fly, and it left the bottom-right corner — the one
     piece of the frame nothing else uses — empty.

     So: a desk stacks them into the bottom-right corner, out of the way of
     everything and in the place a hand already goes looking for a toolbar. A
     phone keeps them **beside the scan button**, because the scan is the one
     control on this panel a thumb already presses and a verb with a wait on
     it belongs next to the other verb with a wait on it. */
  if (api.touchOnly) {
    /* Stacked straight up from the scan button and right-aligned with it, so
       the column of verbs and the verb they sit on read as one control. Not
       *beside* it: three chips at their own width plus the scan button is
       wider than a landscape phone has to the right of the hull bar, and a
       chip half off the screen is a chip nobody can read. Clamped anyway. */
    const bw = 104, bh = 46;
    const right = Math.min(cx + w / 2 + 18 + bw, SCREEN_W - PAGE.EDGE - 4);
    drawPanelDevices(st, right, y - 8 - bh / 2 - 22);
  } else {
    drawPanelDevices(st, SCREEN_W - PAGE.EDGE - 6, SCREEN_H - 26);
  }

  // Saying the radius is what makes the scanner refit legible: the number
  // goes up when you buy a tier, and that is the whole purchase.
  if (ready && st.scanReach && !api.touchOnly) {
    label(Math.round(st.scanReach) + "u", cx + w / 2 + 16, y + 18, SIZE.cap,
          VIOLET_DIM, "left", 0.6);
  }
  if (!ready && st.scan) {
    ctx.save();
    ctx.strokeStyle = VIOLET_DIM;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx - w / 2 - 26, y - h / 2, 9, -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * st.scan.charge);
    ctx.stroke();
    ctx.restore();
  }

  /* The line above the bar, which holds one thing at a time. Three things want
     it and they are in a strict order of importance: one hit from death beats
     a shop you are parked at, and a shop you are parked at beats a reminder of
     what M does. Anything else here would be two of them overlapping, which is
     what happened the first time the warning was put below the bar and landed
     on the scanner readout. */
  /* Four things want this line, in a strict order of importance. One hit from
     death beats a tank running out, a tank running out beats a shop you are
     parked at, and all three beat a reminder of what M does. */
  /* Above the scan button rather than beside it. The button is a real box now
     and it sits off the hull bar's right shoulder, so a line fitted to most of
     the screen's width ran straight through its edge. */
  /* ── one target for every prompt on this line ──────────────────────────
     There are four of them — docked, landed, somebody adrift, something with a
     name — they are mutually exclusive, they all draw at `y - 54`, and every
     one of them has to stop short of the scan button on its right. They had
     drifted into three different rectangles: 320 wide at `y - 62`, 260 wide at
     `y - 86`, and one that reached 37px into the scan target on a phone. Taps
     go to whoever registered last, so pressing the right-hand end of a prompt
     scanned instead.

     So: one function. It is bounded by where the scan button starts, which this
     function already knows, rather than by a number somebody hoped was small
     enough — and it sits *on* the words rather than above them. */
  const promptTap = (act) => {
    const right = cx + w / 2 + 10;
    const left = Math.max(PAGE.EDGE, cx - 170);
    tap({ x: left, y: y - 72, w: Math.max(120, right - left), h: 36,
          act: act || (() => {}) });
  };

  /* ── the station is the door ────────────────────────────────────────────
     Docking is a keypress, and on a phone the keypress is the prompt on this
     line — which four other things can outrank. At one hull point the line
     reads THE NEXT HIT KILLS YOU, correctly, and a phone was left with no way
     into the shop at exactly the moment it needed one most: you are docked, you
     are one hit from dead, the repair is twenty feet away and there is nothing
     to press.

     So the station itself is pressable whenever you are close enough to dock.
     It is where you are already looking, it is the thing you want, and it can
     never be crowded out by something more urgent because it is not on this
     line at all. */
  if (st.docked && st.dockAt && st.cam && st.ship) {
    const cam = st.cam;
    const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
    const dx = st.dockAt.x - cam.x, dy = st.dockAt.y - cam.y;
    const px = SCREEN_W / 2 + (dx * cos - dy * sin) * cam.scale;
    const py = SCREEN_H / 2 + (dx * sin + dy * cos) * cam.scale;
    const rr = 74;
    if (px > -rr && px < SCREEN_W + rr && py > -rr && py < SCREEN_H + rr) {
      const beat = 0.45 + 0.3 * Math.sin(clockish() * 3);
      ctx.save();
      ctx.strokeStyle = HUD_CASH;
      ctx.globalAlpha = beat;
      ctx.lineWidth = 2;
      ctx.setLineDash && ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.restore();
      label(api.touchOnly ? "TAP TO DOCK" : "DOCK  [E]", px, py + rr + 20,
            SIZE.cap, HUD_CASH, "center", 0.9, "0.1em");
      tap({ x: px - rr, y: py - rr, w: rr * 2, h: rr * 2,
            act: st.onRefit || (() => {}) });
    }
  }

  const dry = st.water && st.water.countdown > 0 ? st.water : null;
  const starving = st.food && st.food.countdown > 0 ? st.food : null;
  if (critical) {
    const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / (lit ? 480 : 170)));
    fitText(lit ? "MENDING — STAY IN THE LIGHT"
                : "THE NEXT HIT KILLS YOU",
            cx, y - 54, SIZE.val, lit ? SOLAR : WARN, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (dry || starving) {
    const m = dry || starving;
    const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 200));
    fitText((dry ? "NO WATER" : "NO FOOD") + " — " + fmtSecs(m.countdown) +
            " LEFT", cx, y - 54, SIZE.val, WARN, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (st.docked) {
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
    label(api.touchOnly ? "DOCKED — TAP TO REFIT" : "DOCKED — [E] REFIT",
          cx, y - 54, SIZE.val, HUD_CASH, "center", beat, "0.1em");
    promptTap(st.onRefit);
  } else if (st.landed) {
    // Somebody lives on the thing you are resting against, and they will sell
    // you water. Named, because the name is the point of naming them.
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
    fitText(st.landed.name + (api.touchOnly ? " — TAP TO TRADE" : " — [E] TRADE"),
            cx, y - 54, SIZE.val, st.landed.colour || HUD_CASH, "center", beat,
            SCREEN_W - 380, "0.08em");
    promptTap(st.onLand);
  } else if (st.helping) {
    /* Somebody out there has stopped. Above the name of a monument and above
       the drive, because it is the only line on this panel with a clock
       running on it — and the clock is stated, because "four minutes" is the
       difference between a decision and a thing you noticed too late. */
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 5);
    fitText(st.helping.flag + " HAULER ADRIFT — " + fmtSecs(st.helping.left) +
            (st.helping.can
               ? (api.touchOnly ? " — TAP: WATER" : " — [E] GIVE WATER")
               : " — NOT ENOUGH WATER"),
            cx, y - 54, SIZE.val, st.helping.can ? ICE : WARN, "center", beat,
            SCREEN_W - 380, "0.06em");
    if (st.helping.can) promptTap(st.onWater);
  } else if (st.near) {
    /* Something with a name on it, in reach. Above the light drive and above
       the key hints because it is the only line here that is about *where you
       are* — the drive will still be ready in a minute and this stone will be
       behind you. */
    const beat = 0.65 + 0.35 * Math.sin(clockish() * 3);
    fitText(st.near.name + (api.touchOnly ? " — TAP" : " — [E]"),
            cx, y - 54, SIZE.val, st.near.colour || VIOLET, "center", beat,
            SCREEN_W - 380, "0.08em");
    promptTap(st.onLook);
  } else if (st.light && st.light.have && st.light.run <= 0) {
    // Offered, quietly, whenever there is nothing more urgent to say. A drive
    // you have to remember you own is a drive you never use.
    label(api.touchOnly ? "LIGHT DRIVE READY" : "LIGHT DRIVE READY  —  [R]",
          cx, y - 30, SIZE.cap, ICE, "center", 0.55, "0.14em");
    if (api.touchOnly) promptTap(st.onLight);
  } else if (!st.scanTaught) {
    /* The one control nobody would guess. Survey has no tutorial, the scan is
       the verb the whole mode is built on, and a player who never presses it
       flies an empty sector wondering what the point is. So it is said, once,
       on the line the eye is already on — and it stops being said the moment you
       press it, because a hint that outlives its usefulness is clutter. */
    const beat = 0.6 + 0.4 * Math.sin(clockish() * 2.6);
    fitText(api.touchOnly ? "PRESS SCAN"
                          : "PRESS  F  TO SCAN",
            cx, y - 54, SIZE.val, VIOLET, "center", beat,
            SCREEN_W - 380, "0.08em");
  } else if (!api.touchOnly) {
    // The mode's three keys, stated once, quietly, where a new player is
    // already looking. Survey has no tutorial and should not need one.
    /* Above the bar, in the slot the docked prompt uses — the two are
       already mutually exclusive. It used to be drawn at `y + 38`, which is
       712 on a 700-tall canvas: the one line that tells a cold player what
       the mode's keys are had never been on screen at all. */
    /* Three keys, and they are the three doors: the chart, the page that holds
       every other page, and the scan. The almanac used to be named here and is
       not any more — it is a button inside the inventory now, so naming it
       alongside `I` would be pointing at the same door twice. `L` still opens
       it for anyone who already knows. */
    label("M CHART   ·   I INVENTORY   ·   F SCAN", cx, y - 30, SIZE.cap,
          VIOLET_LOW, "center", 0.8, "0.1em");
  }
}

/* ── the devices, on the flight panel ─────────────────────────────────────
   A chip a device, off the left shoulder of the hull bar, mirroring the scan
   button on the right — the two are the same kind of thing, a verb with a
   wait on it, and they should not be in two different places.

   Each chip is the whole state: what it is, which key or slot it answers to,
   and a bar that fills as the cooldown runs out, so "not yet" is the chip
   rather than a number somewhere else. Stacked upward in slot order, because
   the parts page lists them in slot order and nothing should renumber itself
   between two pages.

   It is a readout and not a button. On a phone the device buttons live on the
   thumb pad where the player put them, and a second live target up here would
   be a control nobody chose the position of. */
const DEV_W = 116;
function drawPanelDevices(st, right, y) {
  const list = st.devices || [];
  if (!list.length) return;
  const { ctx } = api;
  const w = DEV_W, h = 28, gap = 6;
  list.forEach((d, i) => {
    const x = right - w;
    /* Slot one at the top. The stack grows upward from the anchor, so the
       index has to be counted from the far end or the four would read
       4-3-2-1 down the screen while every other page lists them 1-2-3-4. */
    const cy = y - (list.length - 1 - i) * (h + gap);
    const ready = d.cd <= 0;
    const done = d.cool > 0 ? 1 - Math.max(0, Math.min(1, d.cd / d.cool)) : 1;

    ctx.save();
    ctx.fillStyle = VIOLET_LOW;
    ctx.globalAlpha = ready ? 0.18 : 0.1;
    ctx.fillRect(x, cy - h / 2, w, h);
    // The wait, as the chip filling back up rather than as a number.
    if (!ready) {
      ctx.fillStyle = VIOLET;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, cy - h / 2, w * done, h);
    }
    ctx.strokeStyle = ready ? VIOLET : VIOLET_DIM;
    ctx.globalAlpha = ready ? 0.9 : 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, cy - h / 2, w, h);
    ctx.restore();

    /* The key on a keyboard, the slot number on a phone. They are the same
       fact — which of the four this is — said in whichever way the player can
       act on: a phone has no [1] to press, and a desk has no thumb button. */
    const mark = api.touchOnly ? String(d.slot + 1) : (d.hint || "\u2014");
    label(mark, x + 9, cy + 5, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 0.95 : 0.55, "0.06em");
    fitText(d.tag, x + w - 8, cy + 5, SIZE.cap,
            ready ? VIOLET : VIOLET_DIM, "right", ready ? 0.95 : 0.55,
            w - 34);
  });
}

// The panel has no clock of its own and does not need a precise one.
const clockish = () => Date.now() / 1000;

/* Chevrons at the screen edge pointing at what the scan turned up and you
   have not reached yet. Spatial rather than a list: no text to be unreadable
   on a phone, and no hierarchy to collapse. The main view is player-up, so
   every bearing goes through the camera's rotation or the arrows point at the
   wrong sky. */
/* ── where an edge arrow is allowed to be ─────────────────────────────────
   Every arrow that points off screen used to pick its own spot, and both of
   them picked badly. The scan's arrows rode an ellipse inset by a flat 74 and
   62, which put the ones pointing up-and-right underneath the panel chart and
   the ones pointing down through the hull bar; one of them clamped its `x`
   against the panel and left its `y` to land wherever it liked.

   So there is one answer to "where does an edge arrow go" now: **a ring**. A
   circle centred on the ship, one radius for every bearing, and the arrow sits
   where the bearing crosses it.

   It was a rectangle first, on the argument that an arrow on a rectangle is
   actually at the edge of the screen where an ellipse floats a third of the
   way in at the corners. That argument was about *where the pixels are* and it
   cost the thing the arrow is for. On a rectangle an arrow's distance from the
   middle depends on its bearing — a corner is 1.6 times further out than
   straight up — so an arrow **slides and jumps as you turn** even though the
   thing it points at has not moved, it crowds into the four corners, which is
   where the HUD lives, and every fix for one of those made another worse.

   A ring has none of that. The arrow moves at a constant rate as the ship
   turns, it is the same size and the same distance out wherever it is, and the
   four corners are left to the interface. It reads as an instrument rather
   than as something stuck to the window.

   And a list of the places the HUD has already taken. If the point lands in
   one, it walks around the ring until it is clear, rather than being drawn
   under a chart where nobody will see it. */
HUD.hudBlocks = st => hudBlocks(st);

function hudBlocks(st) {
  const { SCREEN_W, SCREEN_H } = api;
  const b = panelBox();
  return [
    // Top right: the sector readout and the chart under it, as one column.
    { x: b.x - 12, y: 0, w: SCREEN_W - b.x + 12, h: b.y + b.h + 40 },
    // Top left: cash and storage.
    { x: 0, y: 0, w: 210, h: 118 },
    /* Bottom centre: the hull bar, and above it the one line that holds
       whichever of four warnings is loudest. That line is fitted to
       `SCREEN_W - 380`, so the box it can fill is most of the width — which is
       why arrows pointing down slide out to the sides rather than finding a gap
       in the middle. There is no gap in the middle. */
    { x: SCREEN_W / 2 - (SCREEN_W - 360) / 2, y: SCREEN_H - 78,
      w: SCREEN_W - 360, h: 78 }
  ];
}

function edgePoint(ang, inset) {
  const { SCREEN_W, SCREEN_H } = api;
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  /* The radius is set by the *shorter* half of the screen, so the ring is a
     circle on every shape of window rather than an ellipse that stretches on a
     wide one — the whole point is that a bearing means the same distance out
     whichever way it is pointing. */
  const r = Math.max(40, Math.min(cx, cy) - inset);
  return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
}

/* The arrow's spot, dragged around the ring until it is out from under the
   interface. Both directions are tried and the nearer answer wins, so an arrow
   never travels further than it has to and never crosses the screen to escape
   a panel it was only just touching. */
function edgeSpot(st, ang, inset) {
  const blocks = hudBlocks(st);
  const inside = p => blocks.some(b => p.x > b.x && p.x < b.x + b.w &&
                                       p.y > b.y && p.y < b.y + b.h);
  const first = edgePoint(ang, inset);
  if (!inside(first)) return { p: first, ang, moved: 0 };
  const STEP = 0.045;
  for (let k = 1; k <= 80; k++) {
    for (const dir of [1, -1]) {
      const a = ang + dir * k * STEP;
      const p = edgePoint(a, inset);
      if (!inside(p)) return { p, ang, moved: k * STEP * dir };
    }
  }
  return { p: first, ang, moved: 0 };
}

/* One arrow, drawn to be seen. Bigger than the old one, never dimmer than
   two thirds, with a tail so it reads as a direction rather than a speck, and
   the range printed *inboard* of it so the label cannot fall off the screen
   the arrow is sitting on the edge of. */
function edgeArrow(st, ang, colour, text, opts) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const o = opts || {};
  const inset = o.inset === undefined ? 46 : o.inset;
  const at = edgeSpot(st, ang, inset);
  /* Where every arrow ended up this frame. The one thing a screenshot cannot
     tell you is whether an arrow is *under* something, so the check for that
     reads this rather than trying to pick arrowheads out of the draw calls. */
  HUD.arrows.push({ x: at.p.x, y: at.p.y, ang, colour,
                    moved: at.moved, label: text || "" });
  const scale = o.scale || 1;
  const beat = o.beat ? 0.82 + 0.18 * Math.abs(Math.sin(Date.now() / 420)) : 1;
  ctx.save();
  ctx.translate(at.p.x, at.p.y);
  ctx.rotate(ang);
  api.glow(colour, 2.4, (o.alpha === undefined ? 1 : o.alpha) * beat, () => {
    const S = scale;
    /* A **V**, for the arrows you actually steer by. Two strokes meeting at a
       point and open behind, which is the shape every heads-up display in the
       world uses for "this way" — it reads as a direction at a glance and at a
       size, and it does not fill in a solid blob of colour over whatever it is
       sitting on at the edge of the screen.

       The barbed solid below is still what the quieter arrows use: a scan
       return is a dot with a direction, not something you are flying at, and
       eight solid chevrons round the ring would be a much louder thing than
       eight small darts. */
    if (o.vee || o.single) {
      ctx.lineWidth = Math.max(2.5, 3.4 * S);
      ctx.lineJoin = "miter";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-9 * S, -12 * S);
      ctx.lineTo(15 * S, 0);
      ctx.lineTo(-9 * S, 12 * S);
      ctx.stroke();
      /* A second, smaller one behind it, so the shape has depth and reads as
         motion rather than as a static tick — but only when asked for. One V
         is the plain "that way"; two is the loud one. */
      if (o.vee) {
        ctx.globalAlpha *= 0.5;
        ctx.beginPath();
        ctx.moveTo(-18 * S, -9 * S);
        ctx.lineTo(-3 * S, 0);
        ctx.lineTo(-18 * S, 9 * S);
        ctx.stroke();
      }
      return;
    }
    ctx.beginPath();
    ctx.moveTo(16 * S, 0);            // the point
    ctx.lineTo(2 * S, -6 * S);
    ctx.lineTo(-4 * S, -13 * S);      // the upper barb, swept back
    ctx.lineTo(-6 * S, -5 * S);
    ctx.lineTo(-13 * S, -7 * S);      // and a second, further back again
    ctx.lineTo(-8 * S, 0);
    ctx.lineTo(-13 * S, 7 * S);
    ctx.lineTo(-6 * S, 5 * S);
    ctx.lineTo(-4 * S, 13 * S);
    ctx.lineTo(2 * S, 6 * S);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
  if (!text) return at;
  /* Inboard, along the line back to the middle: at the top of the screen the
     label sits below the arrow and at the bottom it sits above it, without
     either case being written down anywhere. */
  const lx = at.p.x - Math.cos(ang) * 26;
  const ly = at.p.y - Math.sin(ang) * 26 + 5;
  label(text, lx, ly, SIZE.cap, colour, "center", 0.95);
  return at;
}

/* What you are looking for, and which way it is. This is the arrow you fly by
   when the objective is off screen, so it is the loudest thing on the ring: full
   alpha, half again the size, and a range beside it. */
/* The objective's own colour. It was VIOLET, which is the colour of every
   panel, every border and half the interface — the one arrow you are actually
   flying by should not be the same colour as the furniture, and it should not
   be a warning colour either. A light blue nothing else on the flight screen
   uses. */
const OBJECTIVE = "#5fd8ff";

/* A scan is a *pulse*. What it turns up should fade with it rather than
   sitting on the edge of the screen for the rest of the run — an arrow that is
   always there stops being information and becomes furniture, and the one
   thing this ring must never become is furniture.

   So the objective's arrow comes up when you press scan and goes down when the
   returns do. The two things that outlive it are the two you *chose*: a
   a feature you tapped on the chart. */
function scanLit(st) {
  const lit = (st.scan && st.scan.lit) || 0;
  if (lit <= 0) return 0;
  return Math.max(0, Math.min(1, lit / 3));     // the last three seconds fade
}

function drawContacts(st) {
  const { SCREEN_W, SCREEN_H } = api;
  const lit = scanLit(st);
  if (!lit) return;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  /* `+rot`, not `-rot`. The world is drawn with `ctx.rotate(cam.rot)`, so a
     world vector at angle t appears on screen at t + rot; rotating by -rot is
     the screen-to-world direction and points every arrow the wrong way round
     the compass. It could never show while this module was being handed a
     camera of `rot: 0` — which it was, always, because the state never sent
     one — so the sign has been wrong since the arrows were written and this is
     the first frame it has ever mattered. */
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  let n = 0;
  for (const c of (st.contacts || [])) {
    if (c.resolved || n >= 4) continue;
    const wx = c.x - cam.x, wy = c.y - cam.y;
    const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
    const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
    if (px > 60 && px < SCREEN_W - 60 && py > 60 && py < SCREEN_H - 60) continue;
    n++;
    const ang = Math.atan2(sy, sx);
    const dist = Math.round(Math.hypot(wx, wy));
    /* One V, not two. The double is the loud one and it belongs to the
       arrow you *chose* — a thing picked off the chart, which you asked to
       be shown and which stays until you let it go. The manifest's arrow is
       the game telling you where to go next, which is a quieter thing, and
       two of them on the ring at once said they were the same kind of
       instruction. */
    /* A delivery gets a number and a search gets a band. The manifest's
       arrow is pointing at somewhere you are *taking* something, so the
       range is the useful fact; the book's arrow is pointing at somewhere
       you have never been, and a bearing plus an exact range is a position —
       which is the one thing this mode's navigation has never handed over.
       The state says which kind it is; the ring does not guess. */
    edgeArrow(st, ang, OBJECTIVE,
              c.vague ? (c.band || "") : fmtCells(dist) + "u",
              { scale: 1.35, beat: true, single: true, alpha: lit });
  }
}

/* And what a scan turned up. A return that is off screen used to be a dot on
   the panel chart and nothing else — which made the scan a thing you read
   rather than a thing you fly by. Each one gets an arrow in its own colour, on
   the same ring, smaller than the objective because it is a suggestion rather
   than the plan. */
function drawEchoArrows(st) {
  const { SCREEN_W, SCREEN_H } = api;
  if (!st.ship) return;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  let n = 0;
  for (const e of (st.echoes || [])) {
    if (n >= 8) break;
    const wx = e.x - cam.x, wy = e.y - cam.y;
    const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
    const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
    if (px > 60 && px < SCREEN_W - 60 && py > 60 && py < SCREEN_H - 60) continue;
    n++;
    // Fading with the return itself, so the ring empties as the scan goes cold
    // rather than all at once.
    const fade = Math.max(0.55, Math.min(1, (e.t || 0) / 4)) * scanLit(st);
    if (fade <= 0.02) continue;
    /* **The glyph says what kind of thing it is.** The barbed dart is a
       silhouette — it reads as a ship, because it is shaped like one — and
       every return on the ring was wearing it: a hulk, a cache, a gate and a
       pile of ore all pointed at you with a little ship. One shape for two
       dozen meanings teaches nothing, and the one meaning it does suggest was
       wrong for most of them.

       So a ship gets the ship, and a thing gets a V. */
    const isShip = e.kind === "traffic" || e.kind === "patrol" ||
                   e.kind === "hunter"  || e.kind === "distress";
    edgeArrow(st, Math.atan2(sy, sx), e.colour || VIOLET, null,
              { scale: 0.85, alpha: fade, inset: 74, single: !isShip });
  }
}


/* ── something you picked off the chart ───────────────────────────────────
   **The** arrow that stays, and the only one. "I want to know where that is" —
   a station you will need later, the well you are routing around, the memorial
   you mean to come back to. One at a time, in the blue the objective used to own
   outright, and it keeps its arrow until you pick another or tap it again to let
   it go. Everything else on the ring is a pulse and fades like one. */
function drawSelectedArrow(st) {
  const sel = st.selected;
  if (!sel || !st.ship) return;
  const { ctx, SCREEN_W, SCREEN_H } = api;
  const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
  const wx = sel.x - cam.x, wy = sel.y - cam.y;
  const cos = Math.cos(cam.rot), sin = Math.sin(cam.rot);
  const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
  const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
  const dist = Math.round(Math.hypot(wx, wy));
  const name = shortName(sel.name || "", 14);

  if (px > 30 && px < SCREEN_W - 30 && py > 30 && py < SCREEN_H - 30) {
    // In front of you: say what it is rather than pointing at it.
    ctx.save();
    ctx.strokeStyle = OBJECTIVE;
    ctx.globalAlpha = 0.5 + 0.25 * Math.abs(Math.sin(Date.now() / 520));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    label(name, px, py - 22, SIZE.cap, OBJECTIVE, "center", 0.85);
    return;
  }
  edgeArrow(st, Math.atan2(sy, sx), OBJECTIVE,
            (name ? name + "  " : "") + fmtCells(dist) + "u",
            { scale: 1.2, vee: true, inset: 58 });
}

/* The pulse has no gameplay effect — the contacts are already in the list —
   but without it pressing the key feels like nothing happened, and this mode
   has no gunfire to confirm an input with. */
function drawPulse() {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  if (api.reduceMotion) return;
  const t = 1 - pulse / 1.6;
  ctx.save();
  api.glow(VIOLET, 2, (1 - t) * 0.5, () => {
    ctx.beginPath();
    ctx.arc(SCREEN_W / 2, SCREEN_H / 2,
            t * Math.hypot(SCREEN_W, SCREEN_H) * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/* The only moment the interface is allowed to be loud, and it is over in four
   seconds. Top centre, where the banner already lives. */
/* Drawn under the right-hand column, growing downward. Each line is a rule on
   its left edge and two rows of type — the same figure the logged cards used,
   because that one worked; it is only in a different corner and doing more. */
/* Press one to open it. Press it again to put it away.

   A notification is a line squeezed into the width of a column and shrunk until
   it fits, which is fine for "Cache open" and is a lie for anything with a
   sentence in it — `fitText` will take type down to the 16px floor and then cut
   it with an ellipsis, so the lines that were worth reading were exactly the
   ones you could not. Opening one wraps it properly on a ground you can read it
   against, and shows the detail line that the collapsed form has to abbreviate.

   An open one **stops counting down**. If you pressed it to read it, having it
   fade out from under you would be the interface taking it away mid-sentence —
   so it holds until you close it, and its clock starts again when you do.
   Everything below it shuffles down to make room, which is the same behaviour
   the stack already has when a new line arrives. */
const NOTE_W = () => panelBox().w + 120;

function drawNotes(st) {
  if (!notes.length) return;
  const { ctx } = api;
  const b = panelBox();
  const right = b.x + b.w;
  const wide = NOTE_W();
  // Below the chart, its label and the buttons under it, whichever are there.
  /* Below the chart, the region readout and the inventory button. The 52 is
     the button's own top — it moved down when the region line took a row above
     it, and this has to move with it or the first notification's target sits
     on top of the button's. There was a yard button under it once, and a row
     of height that came and went with it; there is one door into a station
     now and the row is gone with the yard. */
  let y = b.y + b.h + 52 + 30 + 34;
  for (const n of notes) {
    /* An open note is at full strength whatever its clock says — it is not
       fading, it is being read. */
    const a = n.open ? 1
            : Math.min(1, n.t * 2.2) * Math.min(1, (n.life - n.t) * 6);
    if (a <= 0.01) { y += n.sub ? 44 : 28; continue; }

    if (n.open) {
      const lines = wrapLines(n.text, SIZE.cap, wide - 24, "0.08em");
      const subs = n.sub ? wrapLines(n.sub, SIZE.cap, wide - 24) : [];
      const h = 16 + lines.length * 20 + (subs.length ? subs.length * 18 + 6 : 0);
      const x = right - wide;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = INK;
      ctx.fillRect(x, y - 18, wide, h);
      ctx.strokeStyle = n.colour;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y - 18, wide, h);
      ctx.restore();
      let ly = y;
      for (const line of lines) {
        label(line, x + 12, ly, SIZE.cap, n.colour, "left", 1, "0.08em");
        ly += 20;
      }
      if (subs.length) ly += 6;
      for (const line of subs) {
        label(line, x + 12, ly, SIZE.cap, VIOLET_DIM, "left", 0.85);
        ly += 18;
      }
      tap({ x, y: y - 18, w: wide, h, note: true,
            act: () => { n.open = false; } });
      y += h + 12;
      continue;
    }

    const h = n.sub ? 40 : 24;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = n.colour;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(right, y - 14); ctx.lineTo(right, y - 14 + h);
    ctx.stroke();
    ctx.restore();
    fitText(n.text, right - 12, y, SIZE.cap, n.colour, "right", a, wide,
            "0.08em");
    if (n.sub) {
      fitText(n.sub, right - 12, y + 20, SIZE.cap, VIOLET_DIM, "right",
              a * 0.8, wide);
    }
    /* The whole line is the target, out to the full width the text is allowed
       to use — a right-aligned short line would otherwise be a two-word target
       floating in a column of empty space. */
    tap({ x: right - wide, y: y - 16, w: wide + 6, h: h + 4, note: true,
          act: () => { n.open = true; } });
    y += h + 10;
  }
}
