"use strict";
/* KONDRITE — SURVEY INTERFACE: THE PANEL
   ─────────────────────────────────────────────────────────────────────────────
   The thin panel you fly behind: what you are doing, static, running at light,
   what a scan came back with, the left column, and where you are. */

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
