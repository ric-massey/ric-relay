/* CROSSFIRE — SURVEY INTERFACE
   ─────────────────────────────────────────────────────────────────────────────
   Survey's whole interface: the thin panel you fly behind, the sector chart,
   and the almanac. Loaded like `net.js` — a script tag and one global, handed
   the engine's drawing primitives at startup so it can draw in the same voice
   as everything else without index.html growing a fourth mode's worth of UI.

   The chart and the almanac are *pages*, not overlays. They get the whole
   screen, the world stops being drawn behind them, and they are reached and
   left the way the title and settings screens are. A map you read through a
   half-transparent asteroid field is a map you squint at.

   ── the fog is unbounded ────────────────────────────────────────────────────
   Survey's sector has no edges, so the chart cannot be a fixed grid over a
   fixed arena. Charted space is a set of cells on an infinite lattice: a cell
   is CELL units square, its key packs the pair into one exact float, and only
   cells you have actually been near are ever stored. Nothing allocates for
   space you have not visited, which is the only way an infinite map costs
   anything less than infinite memory.

   That makes "percent charted" meaningless — every fraction of an infinite
   plane is zero — so the number the player is given is a *count* of cells, and
   the three CARTOGRAPHER entries are thresholds on it rather than percentages.

   ── one layout, two densities ───────────────────────────────────────────────
   The canvas is a fixed 1000×700 letterboxed to fit, so layout is already
   resolution-independent. What actually differs between a phone and a desk:

     1. Thumbs cover the bottom corners. `#pad` is fixed to the viewport with
        the stick near (0.16, 0.78) and fire near (0.88, 0.78), so the bottom
        corners of the canvas are held by a hand. The bottom *centre* is clear
        on both, and every persistent readout goes there.
     2. The pause button sits at viewport (0.95, 0.08) — inside where the panel
        chart would go. On touch the chart shifts left to leave it a gap.
     3. Type has a floor. The engine's `readableTextSize` clamps to 16px, so
        hierarchy written in point sizes below that silently does not arrive.
        This module keeps its own type scale and never goes under 16.

   `addTap` is a function rather than the engine's `taps` array because that
   array is replaced wholesale every frame; a reference captured once would be
   pushing into the previous frame's list, and a button would be drawn where
   nothing could be pressed.

   Nothing here uses shadowBlur, for the same reason `glow()` doesn't.        */

(function () {
  "use strict";

  const HUD = {};

  /* ── palette ──────────────────────────────────────────────────────────────
     Survey takes a violet accent so it reads as its own mode at a glance and
     ties to the site's exploration room, but the chrome stays amber: this is
     still Crossfire's interface, not a different game's. */
  const VIOLET     = "#a08cff";
  const VIOLET_DIM = "#6f5cc4";
  const VIOLET_LOW = "#3d3470";
  const AMBER      = "#ffe56d";
  const AMBER_DIM  = "#ffcb42";
  const RULE       = "#9a7a1f";
  const WARN       = "#ff8f77";
  const ICE        = "#87d8ff";
  const SOLAR      = "#ffd76d";
  const WRECKC     = "#7d8596";
  const INK        = "#05050a";

  /* Real steps only — anything below 16 is a lie on a phone. */
  const SIZE = { cap: 16, val: 19, head: 23, big: 30, huge: 40 };

  /* ── the lattice ──────────────────────────────────────────────────────────
     480 units a cell: coarse enough that revealing one is visible progress on
     the chart, fine enough that the shape you have flown reads as a shape. The
     key packs a signed pair into one exact float — ±1,000,000 cells is ±480
     million units in every direction, which is about fourteen hours of flight
     at full burn before the packing would need widening. */
  const CELL = 480;
  const KEY_BASE = 1e6, KEY_SPAN = 4e6;
  const cellKey = (cx, cy) => (cx + KEY_BASE) * KEY_SPAN + (cy + KEY_BASE);

  let api = null;
  let fog = new Set();
  let trail = [];            // where you have been, for the chart
  let toasts = [];
  let pulse = 0;
  let padGuard = { right: 0, bottom: 0 };

  // The chart page's own camera, so panning around it does not move the ship.
  let chart = { x: 0, y: 0, scale: 0.02, follow: true };
  let almanac = { scroll: 0, pick: 0 };

  HUD.init = function (deps) {
    api = deps;
    HUD.reset();
    measurePad();
    window.addEventListener("resize", measurePad);
    return HUD;
  };

  /* The pad is positioned against the viewport and the canvas is letterboxed
     inside it, so the only honest way to know whether a thumb is over the panel
     chart is to measure. On a desk it comes out zero. */
  function measurePad() {
    if (!api || !api.canvas) return;
    const r = api.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const toX = f => ((f * window.innerWidth) - r.left) / r.width * api.SCREEN_W;
    const toY = f => ((f * window.innerHeight) - r.top) / r.height * api.SCREEN_H;
    padGuard = api.touchOnly
      ? { right: Math.max(0, api.SCREEN_W - toX(0.95) + 46),
          bottom: Math.max(0, api.SCREEN_H - toY(0.72)) }
      : { right: 0, bottom: 0 };
  }

  HUD.reset = function () {
    fog = new Set();
    trail = [];
    toasts = [];
    pulse = 0;
    chart = { x: 0, y: 0, scale: 0.02, follow: true };
    almanac = { scroll: 0, pick: 0 };
  };

  /* ── revealing ────────────────────────────────────────────────────────────
     Called from update() with the ship's position and how far it can see. Work
     is proportional to the cells in range; all but the first frame in a new
     place finds them already lit and stores nothing. */
  HUD.reveal = function (x, y, sight) {
    const c0 = Math.floor((x - sight) / CELL), c1 = Math.floor((x + sight) / CELL);
    const r0 = Math.floor((y - sight) / CELL), r1 = Math.floor((y + sight) / CELL);
    const s2 = sight * sight;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = (c + 0.5) * CELL - x, dy = (r + 0.5) * CELL - y;
        if (dx * dx + dy * dy > s2) continue;
        fog.add(cellKey(c, r));
      }
    }
  };

  HUD.charted = () => fog.size;
  HUD.seen = (x, y) =>
    fog.has(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));

  /* Where you have been. Sampled by distance rather than by frame so the line
     is the same shape whether you flew it fast or slow, and capped so a very
     long survey cannot grow the save without limit — the oldest leg is the one
     you are least likely to be looking for. */
  const TRAIL_STEP = 900, TRAIL_MAX = 900;
  HUD.track = function (x, y) {
    const last = trail[trail.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < TRAIL_STEP) return;
    trail.push([Math.round(x), Math.round(y)]);
    if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
  };

  /* ── keeping the chart ────────────────────────────────────────────────────
     Run-length encoded by row before packing. A survey's charted cells are the
     shape of the path that made them — long horizontal runs — so RLE turns
     roughly three bytes a cell into well under one, and a long survey stays a
     sensible thing to put in local storage. */
  HUD.exportFog = function () {
    if (!fog.size) return "";
    const rows = new Map();
    for (const k of fog) {
      const cx = Math.floor(k / KEY_SPAN) - KEY_BASE;
      const cy = (k - (cx + KEY_BASE) * KEY_SPAN) - KEY_BASE;
      let row = rows.get(cy);
      if (!row) rows.set(cy, (row = []));
      row.push(cx);
    }
    const runs = [];
    for (const [cy, xs] of rows) {
      xs.sort((a, b) => a - b);
      let start = xs[0], len = 1;
      for (let i = 1; i < xs.length; i++) {
        if (xs[i] === start + len) { len++; continue; }
        runs.push(cy, start, len);
        start = xs[i]; len = 1;
      }
      runs.push(cy, start, len);
    }
    return packInts(runs);
  };

  HUD.importFog = function (s) {
    const runs = unpackInts(s);
    if (!runs || runs.length % 3 !== 0) return false;
    fog = new Set();
    for (let i = 0; i < runs.length; i += 3) {
      const cy = runs[i], start = runs[i + 1], len = runs[i + 2];
      if (!Number.isFinite(len) || len < 1 || len > 1e6) return false;
      for (let k = 0; k < len; k++) fog.add(cellKey(start + k, cy));
    }
    return true;
  };

  HUD.exportTrail = () => packInts(trail.flat());
  HUD.importTrail = function (s) {
    const flat = unpackInts(s);
    if (!flat || flat.length % 2 !== 0) return false;
    trail = [];
    for (let i = 0; i < flat.length; i += 2) trail.push([flat[i], flat[i + 1]]);
    return true;
  };

  function packInts(arr) {
    if (!arr || !arr.length) return "";
    const buf = new ArrayBuffer(arr.length * 4);
    new Int32Array(buf).set(arr);
    const bytes = new Uint8Array(buf);
    let s = "";
    // Chunked: String.fromCharCode.apply on a long array blows the stack.
    for (let i = 0; i < bytes.length; i += 4096) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    }
    try { return btoa(s); } catch (_) { return ""; }
  }

  function unpackInts(s) {
    if (typeof s !== "string" || !s) return null;
    let raw;
    try { raw = atob(s); } catch (_) { return null; }
    if (raw.length % 4 !== 0) return null;
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return Array.from(new Int32Array(bytes.buffer));
  }

  /* Two entries can tick at once — a slingshot out of a binary — so toasts
     stack rather than replace, capped because three cards is a celebration and
     six is a wall. */
  HUD.logged = function (entry) {
    toasts.unshift({ name: entry.name, note: entry.note || "",
                     n: entry.n || 0, of: entry.of || 25, t: 4.2 });
    if (toasts.length > 3) toasts.length = 3;
  };

  HUD.ping = function () { pulse = 1.6; };

  /* ── type ─────────────────────────────────────────────────────────────────
     The module keeps its own text helper rather than borrowing the engine's:
     the pages want tracked-out caps for headings, and letter-spacing is worth
     having where the browser supports it. Guarded, because it is ignored
     silently on the ones that don't rather than throwing. */
  function label(str, x, y, size, colour, align, alpha, track) {
    const ctx = api.ctx;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = colour;
    ctx.font = Math.max(16, size) +
      'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    if (track) { try { ctx.letterSpacing = track; } catch (_) {} }
    ctx.textAlign = align || "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function widthOf(str, size, track) {
    const ctx = api.ctx;
    ctx.save();
    ctx.font = Math.max(16, size) +
      'px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    if (track) { try { ctx.letterSpacing = track; } catch (_) {} }
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  /* A page's furniture: a ground, a title, a rule under it, and a footer. Both
     pages use it, so they cannot drift apart from each other. */
  function pageFrame(title, sub, footer) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();

    label(title, 34, 54, SIZE.head, VIOLET, "left", 1, "0.22em");
    if (sub) label(sub, SCREEN_W - 34, 54, SIZE.cap, AMBER_DIM, "right", 0.7);

    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(34, 70); ctx.lineTo(SCREEN_W - 34, 70);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(34, SCREEN_H - 56); ctx.lineTo(SCREEN_W - 34, SCREEN_H - 56);
    ctx.stroke();
    ctx.restore();

    if (footer) label(footer, 34, SCREEN_H - 30, SIZE.cap, VIOLET_DIM, "left", 0.75);
  }

  /* One way out, the same shape on both platforms: a key that is already muscle
     memory and a target big enough for a thumb, drawn as one thing. */
  function closeButton(act) {
    const { SCREEN_W, SCREEN_H } = api;
    api.tapButton(api.touchOnly ? "CLOSE" : "CLOSE  [ESC]",
                  SCREEN_W - 128, SCREEN_H - 30, 180, 38, VIOLET, act);
  }

  /* ═══ THE PANEL ═══════════════════════════════════════════════════════════
     What you fly behind. Deliberately thin: the mode is about looking at the
     world, so the resting state is a chart, two counters and a hull bar, and
     everything else blooms in when it has something to say. */
  HUD.drawPanel = function (st, dt) {
    if (!api) return;
    st = st || {};
    if (pulse > 0) pulse = Math.max(0, pulse - (dt || 0));
    for (const t of toasts) t.t -= (dt || 0);
    toasts = toasts.filter(t => t.t > 0);

    if (st.ship) {
      if (pulse > 0) drawPulse();
      drawContacts(st);
    }
    drawPanelChart(st);
    drawCounters(st);
    drawStrip(st);
    drawToasts();
  };

  function panelBox() {
    const W = api.SCREEN_W;
    const w = api.touchOnly ? 158 : 196;
    return { x: W - w - 18 - padGuard.right, y: 18, w, h: w * 0.7 };
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
    paintMarks(st, mx, my, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();

    label(fmtCells(HUD.charted()) + " CHARTED", b.x + b.w, b.y + b.h + 20,
          SIZE.cap, VIOLET, "right", 0.8);

    api.addTap({ x: b.x, y: b.y, w: b.w, h: b.h, act: st.onChart || (() => {}) });
  }

  const fmtCells = n => n >= 10000 ? (n / 1000).toFixed(1) + "K" : String(n);

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
  function paintMarks(st, mx, my, big) {
    const { ctx } = api;
    const R = big ? 1.7 : 1;

    for (const hz of (st.hazards || [])) {
      if (!HUD.seen(hz.x, hz.y)) continue;
      ctx.beginPath();
      ctx.arc(mx(hz.x), my(hz.y), (hz.kind === "hole" ? 3 : 4) * R, 0, Math.PI * 2);
      if (hz.kind === "hole") {
        ctx.fillStyle = "#000"; ctx.fill();
        ctx.strokeStyle = WARN; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = SOLAR; ctx.fill();
      }
    }

    for (const pl of (st.planets || [])) {
      if (!HUD.seen(pl.x, pl.y)) continue;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ICE;
      ctx.beginPath();
      ctx.arc(mx(pl.x), my(pl.y), 4 * R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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

  function drawCounters(st) {
    const found = st.found || 0, total = st.total || 25;
    label("ALMANAC", 24, 36, SIZE.cap, VIOLET, "left", 0.7, "0.18em");
    label(String(found).padStart(2, "0") + " / " + total, 24, 62,
          SIZE.head, found >= total ? AMBER : VIOLET, "left");
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
    const lit = !!st.inStar;

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

    label(lit ? "SOLAR — HULL RECOVERING" : "HULL", cx, y + 20, SIZE.cap,
          lit ? SOLAR : AMBER_DIM, "center", lit ? 0.95 : 0.6);

    const ready = st.scan && st.scan.charge >= 1;
    label(ready ? (api.touchOnly ? "SCAN" : "SCAN  [F]") : "CHARGING",
          cx + w / 2 + 16, y, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 1 : 0.5);
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
    if (api.touchOnly && ready) {
      api.addTap({ x: cx + w / 2 + 2, y: y - 26, w: 108, h: 52,
                   act: st.onScan || (() => {}) });
    }
  }

  /* Chevrons at the screen edge pointing at what the scan turned up and you
     have not reached yet. Spatial rather than a list: no text to be unreadable
     on a phone, and no hierarchy to collapse. The main view is player-up, so
     every bearing goes through the camera's rotation or the arrows point at the
     wrong sky. */
  function drawContacts(st) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
    const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
    const rx = cx - 74, ry = cy - 62;
    const cos = Math.cos(-cam.rot), sin = Math.sin(-cam.rot);
    let n = 0;
    for (const c of (st.contacts || [])) {
      if (c.resolved || n >= 6) continue;
      const wx = c.x - cam.x, wy = c.y - cam.y;
      const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
      const px = cx + sx * cam.scale, py = cy + sy * cam.scale;
      if (px > 40 && px < SCREEN_W - 40 && py > 40 && py < SCREEN_H - 40) continue;
      n++;
      const ang = Math.atan2(sy, sx);
      const dist = Math.hypot(wx, wy);
      const alpha = Math.max(0.22, Math.min(0.85, 900 / Math.max(1, dist)));
      ctx.save();
      ctx.translate(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry);
      ctx.rotate(ang);
      api.glow(VIOLET, 2, alpha, () => {
        ctx.beginPath();
        ctx.moveTo(-7, -8); ctx.lineTo(7, 0); ctx.lineTo(-7, 8);
        ctx.stroke();
      });
      ctx.restore();
    }
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
  function drawToasts() {
    if (!toasts.length) return;
    const { ctx, SCREEN_W } = api;
    toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 1.6) * Math.min(1, (4.2 - t.t) * 5);
      const y = 126 + i * 62, w = 360, x = SCREEN_W / 2 - w / 2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x, y - 30, w, 54);
      ctx.strokeStyle = VIOLET;
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 30); ctx.lineTo(x, y + 24);      // one edge, not a box
      ctx.stroke();
      ctx.restore();
      label("LOGGED  " + String(t.n).padStart(2, "0") + " / " + t.of,
            SCREEN_W / 2, y - 10, SIZE.cap, VIOLET, "center", a * 0.75, "0.16em");
      label(t.name, SCREEN_W / 2, y + 16, SIZE.head, AMBER, "center", a);
    });
  }

  /* ═══ THE CHART PAGE ══════════════════════════════════════════════════════
     Its own screen, with the world not drawn behind it. Space has no edges, so
     the chart has no extent either: it is a window you pan and zoom over an
     infinite lattice, and it opens centred on you. */
  const ZOOMS = [0.004, 0.008, 0.016, 0.032, 0.064];

  HUD.chartOpened = function (st) {
    if (st && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }
    chart.follow = true;
  };

  HUD.chartKey = function (code, st) {
    const step = 260 / chart.scale;
    if (code === "ArrowLeft")  { chart.x -= step; chart.follow = false; return true; }
    if (code === "ArrowRight") { chart.x += step; chart.follow = false; return true; }
    if (code === "ArrowUp")    { chart.y -= step; chart.follow = false; return true; }
    if (code === "ArrowDown")  { chart.y += step; chart.follow = false; return true; }
    if (code === "Equal" || code === "NumpadAdd")      { zoomChart(1); return true; }
    if (code === "Minus" || code === "NumpadSubtract") { zoomChart(-1); return true; }
    if (code === "KeyC") { HUD.chartOpened(st); return true; }
    return false;
  };

  function zoomChart(dir) {
    let i = ZOOMS.indexOf(chart.scale);
    if (i < 0) i = 2;
    chart.scale = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
  }

  HUD.drawChart = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    if (chart.follow && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }

    const span = SCREEN_W / chart.scale;
    pageFrame("SECTOR CHART",
              "SEED " + (st.seed || 0) + "  ·  " + fmtCells(HUD.charted()) + " CELLS CHARTED",
              api.touchOnly ? "DRAG TO PAN  ·  ± ZOOM  ·  C RECENTRE"
                            : "ARROWS PAN  ·  + / −  ZOOM  ·  C RECENTRE");

    const view = { x: 34, y: 86, w: SCREEN_W - 68, h: SCREEN_H - 86 - 70 };
    const mx = wx => view.x + view.w / 2 + (wx - chart.x) * chart.scale;
    const my = wy => view.y + view.h / 2 + (wy - chart.y) * chart.scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();

    ctx.fillStyle = "#07070e";
    ctx.fillRect(view.x, view.y, view.w, view.h);

    drawChartGrid(view, mx, my);
    paintFog(mx, my, chart.x, chart.y, span, chart.scale, chart.scale, 0.26);
    drawTrail(mx, my);
    paintMarks(st, mx, my, true);

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.lineWidth = 1;
    ctx.strokeRect(view.x, view.y, view.w, view.h);
    ctx.restore();

    drawScaleBar(view);
    drawChartReadout(view, st);

    // Off-view: where you are, if you have panned away from yourself.
    if (st.ship) {
      const px = mx(st.ship.x), py = my(st.ship.y);
      if (px < view.x || px > view.x + view.w || py < view.y || py > view.y + view.h) {
        const ang = Math.atan2(st.ship.y - chart.y, st.ship.x - chart.x);
        const ex = view.x + view.w / 2 + Math.cos(ang) * (view.w / 2 - 26);
        const ey = view.y + view.h / 2 + Math.sin(ang) * (view.h / 2 - 26);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(ang);
        api.glow(AMBER, 2, 0.9, () => {
          ctx.beginPath();
          ctx.moveTo(-8, -9); ctx.lineTo(8, 0); ctx.lineTo(-8, 9);
          ctx.stroke();
        });
        ctx.restore();
        label("YOU", ex, ey + 26, SIZE.cap, AMBER, "center", 0.8);
      }
    }

    if (api.touchOnly) {
      api.tapButton("−", 60, SCREEN_H - 30, 46, 38, VIOLET, () => zoomChart(-1));
      api.tapButton("+", 114, SCREEN_H - 30, 46, 38, VIOLET, () => zoomChart(1));
      api.tapButton("RECENTRE", 220, SCREEN_H - 30, 140, 38, VIOLET,
                    () => HUD.chartOpened(st));
    }
    closeButton(st.onClose || (() => {}));
  };

  /* A grid you can navigate by. Lines every chunk, and the coordinate is the
     chunk index rather than raw units — a number small enough to say out loud
     is a number you can use to tell somebody where you found something. */
  function drawChartGrid(view, mx, my) {
    const { ctx } = api;
    const CHUNK = 2600;
    const step = chart.scale < 0.01 ? CHUNK * 4 : CHUNK;
    const x0 = Math.floor((chart.x - view.w / 2 / chart.scale) / step) * step;
    const x1 = chart.x + view.w / 2 / chart.scale;
    const y0 = Math.floor((chart.y - view.h / 2 / chart.scale) / step) * step;
    const y1 = chart.y + view.h / 2 / chart.scale;

    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      ctx.moveTo(mx(x), view.y); ctx.lineTo(mx(x), view.y + view.h);
    }
    for (let y = y0; y <= y1; y += step) {
      ctx.moveTo(view.x, my(y)); ctx.lineTo(view.x + view.w, my(y));
    }
    ctx.stroke();

    // The origin is the one fixed point in an infinite plane; say so.
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = VIOLET_DIM;
    ctx.beginPath();
    ctx.moveTo(mx(0), view.y); ctx.lineTo(mx(0), view.y + view.h);
    ctx.moveTo(view.x, my(0)); ctx.lineTo(view.x + view.w, my(0));
    ctx.stroke();
    ctx.restore();

    if (chart.scale >= 0.008) {
      for (let x = x0; x <= x1; x += step) {
        label(String(Math.round(x / CHUNK)), mx(x) + 4, view.y + 16,
              SIZE.cap, VIOLET_DIM, "left", 0.5);
      }
      for (let y = y0; y <= y1; y += step) {
        label(String(Math.round(y / CHUNK)), view.x + 5, my(y) - 5,
              SIZE.cap, VIOLET_DIM, "left", 0.5);
      }
    }
  }

  /* The line you actually flew. It is the difference between a chart of a
     place and a chart of your time in it. */
  function drawTrail(mx, my) {
    if (trail.length < 2) return;
    const { ctx } = api;
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(mx(trail[0][0]), my(trail[0][1]));
    for (let i = 1; i < trail.length; i++) ctx.lineTo(mx(trail[i][0]), my(trail[i][1]));
    ctx.stroke();
    ctx.restore();
  }

  function drawScaleBar(view) {
    const { ctx } = api;
    // A round number of units that lands near 120px at the current zoom.
    const want = 120 / chart.scale;
    const pow = Math.pow(10, Math.floor(Math.log10(want)));
    const units = [1, 2, 5, 10].map(m => m * pow).find(v => v >= want * 0.6) || pow;
    const px = units * chart.scale;
    const x = view.x + 16, y = view.y + view.h - 22;
    ctx.save();
    ctx.strokeStyle = VIOLET_DIM;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5);
    ctx.stroke();
    ctx.restore();
    label(units >= 1000 ? (units / 1000) + "K UNITS" : units + " UNITS",
          x + px + 10, y, SIZE.cap, VIOLET_DIM, "left", 0.7);
  }

  function drawChartReadout(view, st) {
    if (!st.ship) return;
    const CHUNK = 2600;
    const cx = Math.round(st.ship.x / CHUNK), cy = Math.round(st.ship.y / CHUNK);
    const home = Math.round(Math.hypot(st.ship.x, st.ship.y));
    label("SECTOR " + cx + " , " + cy, view.x + view.w - 16, view.y + 24,
          SIZE.cap, AMBER, "right", 0.9);
    label(fmtCells(home) + " UNITS FROM ORIGIN", view.x + view.w - 16, view.y + 46,
          SIZE.cap, AMBER_DIM, "right", 0.6);
  }

  /* ═══ THE ALMANAC ═════════════════════════════════════════════════════════
     A page of cards, each with a picture of the thing it is asking you to find.
     That is the whole point of it: a list of names tells you what you have not
     got, and a picture tells you what to look for. Found entries are in colour
     with their note; unfound ones keep the silhouette and lose the detail, and
     the two the sector never hints at lose their name as well — a redaction is
     an invitation and a blank line is not. */
  HUD.almanacKey = function (code, entries) {
    const cols = api.touchOnly ? 1 : 3;
    const n = entries.length;
    if (code === "ArrowLeft")  { almanac.pick = (almanac.pick + n - 1) % n; }
    else if (code === "ArrowRight") { almanac.pick = (almanac.pick + 1) % n; }
    else if (code === "ArrowUp")   { almanac.pick = Math.max(0, almanac.pick - cols); }
    else if (code === "ArrowDown") { almanac.pick = Math.min(n - 1, almanac.pick + cols); }
    else return false;
    keepPickVisible(entries.length, cols);
    return true;
  };

  function almanacLayout() {
    const { SCREEN_W, SCREEN_H } = api;
    const cols = api.touchOnly ? 1 : 3;
    const gap = 14;
    const left = 34, right = SCREEN_W - 34;
    const cardW = (right - left - gap * (cols - 1)) / cols;
    const cardH = api.touchOnly ? 74 : 82;
    const top = 92;
    const rows = Math.floor((SCREEN_H - top - 74) / (cardH + gap));
    return { cols, gap, left, cardW, cardH, top, rows };
  }

  function keepPickVisible(n, cols) {
    const L = almanacLayout();
    const row = Math.floor(almanac.pick / L.cols);
    if (row < almanac.scroll) almanac.scroll = row;
    if (row >= almanac.scroll + L.rows) almanac.scroll = row - L.rows + 1;
    almanac.scroll = Math.max(0, almanac.scroll);
  }

  HUD.drawAlmanac = function (st, dt) {
    const { SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const entries = st.almanac || [];
    const found = entries.filter(e => e.found).length;
    const L = almanacLayout();
    const totalRows = Math.ceil(entries.length / L.cols);
    almanac.scroll = Math.max(0, Math.min(almanac.scroll, Math.max(0, totalRows - L.rows)));

    pageFrame("ALMANAC",
              found + " OF " + entries.length + " LOGGED",
              api.touchOnly ? "TAP AN ENTRY  ·  SWIPE TO SCROLL"
                            : "ARROWS MOVE  ·  L OR ESC CLOSES");

    for (let i = 0; i < entries.length; i++) {
      const row = Math.floor(i / L.cols), col = i % L.cols;
      if (row < almanac.scroll || row >= almanac.scroll + L.rows) continue;
      const x = L.left + col * (L.cardW + L.gap);
      const y = L.top + (row - almanac.scroll) * (L.cardH + L.gap);
      drawCard(entries[i], x, y, L.cardW, L.cardH, i === almanac.pick, i);
    }

    // A scrollbar, because an almanac that scrolls with no sign it scrolls is
    // an almanac people think is twelve entries long.
    if (totalRows > L.rows) {
      const { ctx } = api;
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
      if (api.touchOnly) {
        api.tapButton("▲", 60, SCREEN_H - 30, 46, 38, VIOLET,
                      () => { almanac.scroll = Math.max(0, almanac.scroll - 1); });
        api.tapButton("▼", 114, SCREEN_H - 30, 46, 38, VIOLET,
                      () => { almanac.scroll++; });
      }
    }
    closeButton(st.onClose || (() => {}));
  };

  function drawCard(e, x, y, w, h, selected, index) {
    const { ctx } = api;
    const on = !!e.found;
    const art = h - 20;

    ctx.save();
    ctx.fillStyle = on ? "rgba(160,140,255,0.07)" : "rgba(255,255,255,0.022)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = selected ? VIOLET : (on ? VIOLET_DIM : VIOLET_LOW);
    ctx.globalAlpha = selected ? 1 : (on ? 0.7 : 0.45);
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    // The picture. Boxed, so an entry with a wide drawing and one with a narrow
    // one still line their names up.
    ctx.save();
    ctx.strokeStyle = on ? VIOLET_LOW : "#24203f";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 10, y + 10, art, art);
    ctx.beginPath();
    ctx.rect(x + 10, y + 10, art, art);
    ctx.clip();
    ctx.globalAlpha = 1;
    drawIcon(e.key, x + 10 + art / 2, y + 10 + art / 2, art * 0.34, on);
    ctx.restore();

    const tx = x + art + 22;
    const name = on || !e.secret ? e.name : "??????????";
    label(name, tx, y + 30, SIZE.cap, on ? AMBER : AMBER_DIM, "left",
          on ? 1 : 0.45, "0.08em");
    label(on ? e.note : (e.secret ? "not on any chart" : e.note),
          tx, y + 52, SIZE.cap, on ? VIOLET : VIOLET_DIM, "left", on ? 0.85 : 0.4);
    if (on) label("✓", x + w - 18, y + 30, SIZE.cap, VIOLET, "right", 0.9);

    api.addTap({ x, y, w, h, act: () => { almanac.pick = index; } });
  }

  /* ── the pictures ─────────────────────────────────────────────────────────
     Twenty-five small drawings, in the same hairline vector as the game. They
     are what turns a checklist into a field guide: a name tells you what you
     have not got, a picture tells you what to go and look for. Unfound entries
     draw the same shape at low alpha in grey — a silhouette, so the outline
     still says what kind of thing it is without giving away the detail. */
  function drawIcon(key, cx, cy, r, on) {
    const { ctx } = api;
    const lit = c => (on ? c : WRECKC);
    const a = on ? 1 : 0.3;
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
        dashBox();
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          disc(cx + dx * r, cy + dy * r, 2.4, WARN);
        }
        break;
      default:                  ring(cx, cy, r * 0.8, VIOLET, 1.6);
    }
  }

  // Exposed so the game can draw the same picture anywhere else it wants one.
  HUD.icon = drawIcon;

  window.CrossfireSurveyHUD = HUD;
})();
