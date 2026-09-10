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
  const CASH       = "#6dffbf";
  const CASH_DIM   = "#3f9d78";
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
  let notes = [];            // the top-right stack; see HUD.notify
  let pulse = 0;
  let padGuard = { right: 0, bottom: 0 };

  // The chart page's own camera, so panning around it does not move the ship.
  /* Built by a function rather than written out inline, because they used to be
     written out twice — once here and once inside `HUD.reset` — and the two
     copies drifted. The reset copy still carried the old opening zoom long after
     this one had moved on, and it had never learned about `pin` or `open` at
     all, so every fresh survey started with no pin kind selected and an almanac
     that could not remember which card was open. One source, so they cannot
     disagree again. */
  const freshChart = () =>
    ({ x: 0, y: 0, scale: 0.0232, follow: true, pin: 0, jump: false,
       mark: false });
  const freshAlmanac = () => ({ scroll: 0, pick: 0, open: -1 });

  let chart = freshChart();

  /* ── pins ─────────────────────────────────────────────────────────────────
     Endless space has no place names. Nothing out here is called anything, the
     chart labels sectors by chunk coordinate, and a coordinate is not a memory —
     so the only way anywhere gets a name is if the player gives it one.

     A pin is that. Six kinds, because "I found something here" and "do not come
     back here" are different notes and a chart covered in identical dots is a
     chart you stop reading. They are the player's own marks and are drawn in
     their own colours, distinct from anything the sector puts there itself. */
  const PIN_KINDS = [
    { key: "salvage", name: "CASH", colour: "#6dffbf" },
    { key: "cache",   name: "CACHE",   colour: "#ffe56d" },
    { key: "station", name: "STATION", colour: "#87d8ff" },
    { key: "gate",    name: "GATE",    colour: "#5ce1ff" },
    { key: "part",    name: "PART",    colour: "#a08cff" },
    { key: "danger",  name: "DANGER",  colour: "#ff8f77" }
  ];
  const pinSpec = k => PIN_KINDS.find(p => p.key === k) || PIN_KINDS[0];
  let almanac = freshAlmanac();
  let refit = { pick: 0 };
  let manifest = { pick: 0 };

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
    notes = [];
    pulse = 0;
    chart = freshChart();
    almanac = freshAlmanac();
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

  /* There used to be a trail here — every leg you had flown, kept and drawn on
     the chart as a line. It has gone. The chart already carried a grid, an
     origin cross, the fog lattice, typed marks, pins and a legend, and the
     trail was the line that tipped it from a map into a diagram — and it was
     saying something the fog said already, because the fog *is* the shape of
     where you have been. Two drawings of one fact, and the page was the thing
     that paid for it. See SURVEY-PLAN.md, "Next up — the places", item E. */

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

  /* ── notifications ────────────────────────────────────────────────────────
     One stack, top right, for everything that has just happened: an almanac
     entry logged, a new thing to go and find, a cache opened, a tank filled,
     radio. They used to be three separate systems in three places — cards top
     centre, an objective band across the top, radio lines above the hull bar —
     and between them the screen was never quiet.

     Top right, under the chart, because that is where the eye already goes for
     the chart and because it is the one corner nothing else needs. Right-aligned
     so a long line grows away from the middle of the screen rather than across
     it, and capped, because four is news and eight is a wall.

     A repeat refreshes the line it is already on instead of stacking a second
     copy — the same scan pressed twice should not read as two events. */
  HUD.notify = function (text, sub, colour, life) {
    if (!text) return;
    const span = life || 5.5;
    const had = notes.find(n => n.text === text && n.sub === (sub || ""));
    if (had) { had.t = span; had.life = span; return; }
    notes.unshift({ text: String(text), sub: sub ? String(sub) : "",
                    colour: colour || VIOLET, t: span, life: span });
    if (notes.length > 4) notes.length = 4;
  };

  HUD.logged = function (entry) {
    HUD.notify(entry.name,
               "LOGGED  " + String(entry.n || 0).padStart(2, "0") + " / " +
               (entry.of || 25), AMBER, 6);
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

  /* ── text that fits ───────────────────────────────────────────────────────
     Every caption in this interface was drawn at a fixed size into a box whose
     width depends on the layout, the platform and how many cards are in the
     row — so the long ones ran out of their boxes and over their neighbours.

     This shrinks a line until it fits, down to the 16px floor the whole module
     respects (anything under that is a lie on a phone), and only then clips it
     with an ellipsis. Shrink first, cut last: a name one size smaller is still
     the name, and a name cut in half is not. */
  function fitText(str, x, y, size, colour, align, alpha, maxW, track) {
    str = String(str);
    let px = Math.max(16, size);
    while (px > 16 && widthOf(str, px, track) > maxW) px -= 1;
    if (widthOf(str, px, track) > maxW) {
      let cut = str;
      while (cut.length > 1 && widthOf(cut + "…", px, track) > maxW) {
        cut = cut.slice(0, -1);
      }
      str = cut + "…";
    }
    label(str, x, y, px, colour, align, alpha, track);
    return px;
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

  /* ── the page grid ────────────────────────────────────────────────────────
     Every full-screen page is laid out from these six numbers and nothing else.

     They exist because the pages had drifted apart from one another in every
     dimension at once. Measured across six of them: content began at y 86, 88,
     90 or 92 depending which page you were on; panel padding was 14, 16, 18, 20
     or 34; the gutter between two columns was 12, 20 or 50; and rows in a list
     were spaced 26, 30, 32, 34, 38, 46 or 70 apart with no relationship between
     any of them. None of that is visible as a bug — each page looks fine on its
     own — and all of it is visible the moment you move between two, which is
     what "designed" actually means here.

     `STEP` is the unit everything vertical is a multiple of. A panel is
     `HEAD + n·STEP + PAD`, a list row is `STEP`, and a gap between panels is
     `STEP`. That is the whole system.

     `COL(n, i)` hands back the i-th of n equal columns inside the margins, so a
     two-column page and a four-column page put their edges in the same places as
     each other rather than each inventing a width. */
  const PAGE = {
    EDGE: 34,      // outer margin — the same one `pageFrame` rules to
    TOP: 92,       // first row of content, clear of the title rule at 70
    GUTTER: 22,    // between columns
    PAD: 20,       // inside a panel, on every side
    STEP: 26,      // the vertical unit: one list row, one gap
    HEAD: 34       // a panel's title band
  };
  const COL = (n, i) => {
    const W = api.SCREEN_W - PAGE.EDGE * 2 - PAGE.GUTTER * (n - 1);
    const w = W / n;
    return { x: PAGE.EDGE + i * (w + PAGE.GUTTER), w };
  };
  // A panel tall enough for `rows` rows of content under its title.
  const PANEL_H = rows => PAGE.HEAD + rows * PAGE.STEP + PAGE.PAD - 6;
  // The baseline of the i-th row inside a panel that starts at `y`.
  const ROW = (y, i) => y + PAGE.HEAD + i * PAGE.STEP + 12;

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
  /* ── moving between pages ─────────────────────────────────────────────────
     Six pages reachable only by flying back out to the sector and pressing a
     different key. That is fine on a keyboard and it is close to unusable on a
     phone, where the keys do not exist — the way into the almanac was a button
     inside the inventory, and the way into the inventory was a button on the
     flight panel, and the way out of both was the sector.

     So every page carries the same strip: where you can go from here, which one
     you are on, and the way out. It sits on the footer line because that is the
     one row every page already reserves and, on a phone, the row a thumb is
     already resting on.

     A destination you cannot reach from here is dimmed rather than removed —
     the strip has to be in the same order and the same places on every page, or
     it stops being navigation and becomes six different rows of buttons. */
  /* The row of tabs along the foot of every page, and the close button that
     shares it. The widths are computed rather than fixed: the row grew a seventh
     tab when parts got slots, and a hard-coded width meant every new page was a
     collision waiting to happen. Now adding one narrows them all evenly and
     `fitText` handles the type. */
  const NAV_CLOSE_W = 150;
  const NAV_Y = h => h - 30;

  function pageNav(st, here) {
    const { SCREEN_W, SCREEN_H } = api;
    const docked = !!st.docked;
    const tabs = [
      { key: "refit",     name: "STATION",  live: docked, act: st.onStation },
      { key: "hangar",    name: "HANGAR",   live: !!st.atHome, act: st.onHangar },
      { key: "loadout",   name: "LOADOUT",  live: true,   act: st.onLoadout },
      { key: "inventory", name: "STORAGE",  live: true,   act: st.onInventory },
      { key: "missions",  name: "MISSIONS", live: true,   act: st.onMissions },
      { key: "almanac",   name: "ALMANAC",  live: true,   act: st.onAlmanac },
      { key: "chart",     name: "CHART",    live: true,   act: st.onChart }
    ];
    const gap = 7;
    const span = SCREEN_W - PAGE.EDGE * 2 - NAV_CLOSE_W - 16;
    const w = Math.floor((span - gap * (tabs.length - 1)) / tabs.length);
    tabs.forEach((t, i) => {
      const cx = PAGE.EDGE + w / 2 + i * (w + gap);
      const on = t.key === here;
      button(t.name, cx, NAV_Y(SCREEN_H), w, 38,
             on ? VIOLET : t.live ? VIOLET_DIM : VIOLET_LOW,
             on || !t.live ? null : t.act, on, t.live && !on, "0.04em");
    });
  }

  function closeButton(act) {
    const { SCREEN_W, SCREEN_H } = api;
    button(api.touchOnly ? "CLOSE" : "CLOSE  [ESC]",
           SCREEN_W - PAGE.EDGE - NAV_CLOSE_W / 2, NAV_Y(SCREEN_H),
           NAV_CLOSE_W, 38, VIOLET, act);
  }

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
    for (const n of notes) n.t -= (dt || 0);
    notes = notes.filter(n => n.t > 0);

    if (st.ship) {
      if (pulse > 0) drawPulse();
      drawContacts(st);
    }
    // Drawn under everything else: at zero hull the whole frame is edged in the
    // warning colour, so the state is visible without looking anywhere in
    // particular. The gravity band uses the same figure for the same reason.
    if (st.critical) drawCriticalEdge(!!st.inStar);
    else if ((st.water && st.water.countdown > 0) ||
             (st.food && st.food.countdown > 0)) drawCriticalEdge(false);
    if (st.ship) { drawEchoArrows(st); drawWaypointArrow(st); }
    drawSector(st);
    drawPanelChart(st);
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
     the yard wants, its clue, and a YARD n/6 tally, all drawn every frame
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
    drawWaypoint(st, mx, my, false);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();

    label(fmtCells(HUD.charted()) + " CHARTED", b.x + b.w, b.y + b.h + 20,
          SIZE.cap, VIOLET, "right", 0.8);

    api.addTap({ x: b.x, y: b.y, w: b.w, h: b.h, act: st.onChart || (() => {}) });

    /* Under the chart, where the eye already is once it has looked at the map.
       It is the way in to everything the flight HUD has no room for. */
    const iy = b.y + b.h + 30;
    ctx.save();
    ctx.strokeStyle = VIOLET;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, iy, b.w, 30);
    ctx.restore();
    label(api.touchOnly ? "INVENTORY" : "INVENTORY  [I]", b.x + b.w / 2, iy + 20,
          SIZE.cap, VIOLET, "center", 0.95, "0.12em");
    api.addTap({ x: b.x, y: iy, w: b.w, h: 30, act: st.onInventory || (() => {}) });

    if (st.atYard) {
      ctx.save();
      ctx.strokeStyle = CASH;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, iy + 36, b.w, 30);
      ctx.restore();
      label(api.touchOnly ? "THE YARD" : "THE YARD  [E]", b.x + b.w / 2, iy + 56,
            SIZE.cap, CASH, "center", 1, "0.12em");
      api.addTap({ x: b.x, y: iy + 36, w: b.w, h: 30, act: st.onYard || (() => {}) });
    }
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
    }
    ctx.restore();
  }

  const fmtCells = n => n >= 10000 ? (n / 1000).toFixed(1) + "K" : String(n);

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
    memorial:  { name: "MEMORIAL", colour: "#a08cff" }
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
  const SIZED = { planet: 1, hole: 1, star: 1 };

  function paintKnown(st, mx, my, big, scale) {
    const { ctx } = api;
    const R = big ? 5 : 3;
    ctx.save();
    ctx.lineWidth = big ? 1.6 : 1;
    for (const q of (st.known || [])) {
      const spec = CHART_MARKS[q.k];
      if (!spec) continue;
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
        ctx.strokeStyle = CASH;
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
    if (st.yard && big) {
      const x = mx(st.yard.x), y = my(st.yard.y);
      ctx.save();
      ctx.strokeStyle = st.yard.built >= st.yard.needs ? CASH : VIOLET;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      label("THE YARD  " + st.yard.built + "/" + st.yard.needs,
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
    label(String(st.cash || 0), 24, 62, SIZE.head, CASH, "left");

    /* "STORAGE", not "hold". A hold is a part of a ship and this is the stuff in
       it, which is the thing you are actually reading — and there is a page
       called STORAGE now for the same reason. */
    if (st.hold) {
      const used = st.carried || 0, cap = st.hold;
      const full = used >= cap;
      label("STORAGE", 24, 92, SIZE.cap, VIOLET_DIM, "left", 0.7, "0.18em");
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
    });

    if (st.skimming) {
      label("SKIMMING", 24, 250, SIZE.cap, ICE, "left",
            0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 260)), "0.14em");
    }
  }

  /* ── where you are ────────────────────────────────────────────────────────
     Top right, above the chart, because it is the same question the chart
     answers and the two belong together. The curve behind it is smooth and has
     no thresholds, so this is the only place the sector is ever banded — and it
     is banded here because "UNSETTLED" is something you can make a decision
     about and 0.47 is not. */
  function drawSector(st) {
    if (!st.dangerBand) return;
    const { ctx } = api;
    const b = panelBox();
    const right = b.x + b.w;
    label("SECTOR", right, 28, SIZE.cap, VIOLET_DIM, "right", 0.65, "0.18em");
    label(st.dangerBand.name, right, 52, SIZE.val, st.dangerBand.colour,
          "right", 0.95);
    const bw = 108;
    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.strokeRect(right - bw, 58, bw, 5);
    ctx.fillStyle = st.dangerBand.colour;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(right - bw + 1, 59, Math.max(1, (bw - 2) * (st.danger || 0)), 3);
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
    const lit = !!st.inStar;
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

    label(lit ? "SOLAR — HULL RECOVERING" : critical ? "HULL GONE" : "HULL",
          cx, y + 20, SIZE.cap,
          lit ? SOLAR : critical ? WARN : AMBER_DIM, "center",
          lit || critical ? 0.95 : 0.6);

    const ready = st.scan && st.scan.charge >= 1;
    label(ready ? (api.touchOnly ? "SCAN" : "SCAN  [F]") : "CHARGING",
          cx + w / 2 + 16, y, SIZE.cap, ready ? VIOLET : VIOLET_DIM,
          "left", ready ? 1 : 0.5);
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
    if (api.touchOnly && ready) {
      api.addTap({ x: cx + w / 2 + 2, y: y - 26, w: 108, h: 52,
                   act: st.onScan || (() => {}) });
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
    const dry = st.water && st.water.countdown > 0 ? st.water : null;
    const starving = st.food && st.food.countdown > 0 ? st.food : null;
    if (critical) {
      const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / (lit ? 480 : 170)));
      fitText(lit ? "MENDING — STAY IN THE LIGHT"
                  : "THE NEXT HIT KILLS YOU",
              cx, y - 30, SIZE.val, lit ? SOLAR : WARN, "center", beat,
              SCREEN_W - 380, "0.08em");
    } else if (dry || starving) {
      const m = dry || starving;
      const beat = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 200));
      fitText((dry ? "NO WATER" : "NO FOOD") + " — " + fmtSecs(m.countdown) +
              " LEFT", cx, y - 30, SIZE.val, WARN, "center", beat,
              SCREEN_W - 380, "0.08em");
    } else if (st.docked) {
      const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
      label(api.touchOnly ? "DOCKED — TAP TO REFIT" : "DOCKED — [E] REFIT",
            cx, y - 30, SIZE.val, CASH, "center", beat, "0.1em");
      /* Stops exactly where the scan button starts. The prompt's box used to run
         to `y - 18`, which reached into the scan target on a phone — and taps go
         to whatever was registered last, so pressing the right-hand end of
         "DOCKED" scanned instead of docking. */
      api.addTap({ x: cx - 130, y: y - 62, w: 260, h: 36,
                   act: st.onRefit || (() => {}) });
    } else if (st.landed) {
      // Somebody lives on the thing you are resting against, and they will sell
      // you water. Named, because the name is the point of naming them.
      const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
      fitText(st.landed.name + (api.touchOnly ? " — TAP TO TRADE" : " — [E] TRADE"),
              cx, y - 30, SIZE.val, st.landed.colour || CASH, "center", beat,
              SCREEN_W - 380, "0.08em");
      api.addTap({ x: cx - 160, y: y - 62, w: 320, h: 36,
                   act: st.onLand || (() => {}) });
    } else if (st.light && st.light.have && st.light.run <= 0) {
      // Offered, quietly, whenever there is nothing more urgent to say. A drive
      // you have to remember you own is a drive you never use.
      label(api.touchOnly ? "LIGHT DRIVE READY" : "LIGHT DRIVE READY  —  [R]",
            cx, y - 30, SIZE.cap, ICE, "center", 0.55, "0.14em");
      if (api.touchOnly) {
        api.addTap({ x: cx - 130, y: y - 62, w: 260, h: 36,
                     act: st.onLight || (() => {}) });
      }
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
     the ones pointing down through the hull bar; the waypoint's clamped its `x`
     against the panel and left its `y` to land wherever it liked.

     So there is one answer to "where does an edge arrow go" now. A rectangle
     inset from the screen, a ray from the middle, and the point where the ray
     leaves the rectangle — a rectangle rather than an ellipse because an arrow
     on a rectangle is actually at the edge of the screen rather than floating a
     third of the way in at the corners.

     And a list of the places the HUD has already taken. If the point lands in
     one, it walks around the ring until it is clear, rather than being drawn
     under a chart where nobody will see it. */
  HUD.hudBlocks = st => hudBlocks(st);

  function hudBlocks(st) {
    const { SCREEN_W, SCREEN_H } = api;
    const b = panelBox();
    return [
      // Top right: the sector readout and the chart under it, as one column.
      { x: b.x - 12, y: 0, w: SCREEN_W - b.x + 12, h: b.y + b.h + 16 },
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
    const hx = cx - inset, hy = cy - inset;
    const c = Math.cos(ang), s = Math.sin(ang);
    /* Where the ray leaves the box: whichever axis it reaches first. This is the
       whole reason for a box instead of an ellipse — at 45 degrees an ellipse
       puts the arrow 30% of the way into the picture. */
    const t = Math.min(Math.abs(c) < 1e-6 ? Infinity : hx / Math.abs(c),
                       Math.abs(s) < 1e-6 ? Infinity : hy / Math.abs(s));
    return { x: cx + c * t, y: cy + s * t };
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
      // A solid head, so it is a shape rather than an outline at a distance.
      ctx.beginPath();
      ctx.moveTo(13 * scale, 0);
      ctx.lineTo(-9 * scale, -10 * scale);
      ctx.lineTo(-4 * scale, 0);
      ctx.lineTo(-9 * scale, 10 * scale);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.stroke();
      // And a stub of tail pointing back the way you would turn from.
      ctx.beginPath();
      ctx.moveTo(-10 * scale, 0);
      ctx.lineTo(-20 * scale, 0);
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
  function drawContacts(st) {
    const { SCREEN_W, SCREEN_H } = api;
    const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
    const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
    const cos = Math.cos(-cam.rot), sin = Math.sin(-cam.rot);
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
      edgeArrow(st, ang, VIOLET, fmtCells(dist) + "u",
                { scale: 1.35, beat: true });
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
    const cos = Math.cos(-cam.rot), sin = Math.sin(-cam.rot);
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
      const fade = Math.max(0.55, Math.min(1, (e.t || 0) / 4));
      edgeArrow(st, Math.atan2(sy, sx), e.colour || VIOLET, null,
                { scale: 0.85, alpha: fade, inset: 74 });
    }
  }

  /* ── the way to the waypoint ──────────────────────────────────────────────
     The whole point of setting one. An arrow at the edge of the screen pointing
     at it and the range beside it — the same figure the scan's contacts use,
     because it is the same question, and in the same colour the chart drew it
     in so the two are obviously one thing.

     Through the camera's rotation, like the contacts: the main view is
     player-up, and an arrow that ignored that would point at the wrong sky. */
  /* Yellow, on Ric's call, and it is the right choice: nothing else on the
     flight screen is this colour, so the one thing that means "you decided to go
     there" cannot be confused with a scan return, a material or a warning. */
  const WAYPOINT = "#ffd23f";

  function drawWaypointArrow(st) {
    const w = st.waypoint;
    if (!w) return;
    const { ctx, SCREEN_W, SCREEN_H } = api;
    const cam = st.cam || { x: st.ship.x, y: st.ship.y, rot: 0, scale: 1 };
    const cx = SCREEN_W / 2, cy = SCREEN_H / 2;
    const wx = w.x - cam.x, wy = w.y - cam.y;
    const cos = Math.cos(-cam.rot), sin = Math.sin(-cam.rot);
    const sx = wx * cos - wy * sin, sy = wx * sin + wy * cos;
    const px = cx + sx * cam.scale, py = cy + sy * cam.scale;

    // On screen already: mark the spot rather than pointing off at it.
    const here = px > 30 && px < SCREEN_W - 30 && py > 30 && py < SCREEN_H - 30;
    if (here) {
      ctx.save();
      ctx.strokeStyle = WAYPOINT;
      ctx.globalAlpha = 0.55 + 0.25 * Math.abs(Math.sin(Date.now() / 480));
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.moveTo(px - 26, py); ctx.lineTo(px - 8, py);
      ctx.moveTo(px + 8, py); ctx.lineTo(px + 26, py);
      ctx.moveTo(px, py - 26); ctx.lineTo(px, py - 8);
      ctx.moveTo(px, py + 8); ctx.lineTo(px, py + 26);
      ctx.stroke();
      ctx.restore();
      label(fmtCells(w.dist) + "u", px, py + 42, SIZE.cap, WAYPOINT, "center", 0.8);
      return;
    }

    /* On the same ring as everything else that points off screen, and clear of
       the interface for the same reason: this used to clamp its `x` against the
       panel column and leave its `y` to land wherever it liked, which put it
       under the hull bar every time the waypoint was behind you. */
    edgeArrow(st, Math.atan2(sy, sx), WAYPOINT, fmtCells(w.dist) + "u",
              { scale: 1.35, beat: true });
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
  function drawNotes(st) {
    if (!notes.length) return;
    const { ctx } = api;
    const b = panelBox();
    const right = b.x + b.w;
    // Below the chart, its label and the buttons under it, whichever are there.
    let y = b.y + b.h + 30 + 30 + (st && st.atYard ? 36 : 0) + 34;
    for (const n of notes) {
      const a = Math.min(1, n.t * 2.2) * Math.min(1, (n.life - n.t) * 6);
      if (a <= 0.01) { y += n.sub ? 44 : 28; continue; }
      const h = n.sub ? 40 : 24;
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = n.colour;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(right, y - 14); ctx.lineTo(right, y - 14 + h);
      ctx.stroke();
      ctx.restore();
      fitText(n.text, right - 12, y, SIZE.cap, n.colour, "right", a, b.w + 120,
              "0.08em");
      if (n.sub) {
        fitText(n.sub, right - 12, y + 20, SIZE.cap, VIOLET_DIM, "right",
                a * 0.8, b.w + 120);
      }
      y += h + 10;
    }
  }

  /* ═══ THE CHART PAGE ══════════════════════════════════════════════════════
     Its own screen, with the world not drawn behind it. Space has no edges, so
     the chart has no extent either: it is a window you pan and zoom over an
     infinite lattice, and it opens centred on you. */
  /* ── how far the chart can pull back ──────────────────────────────────────
     Five steps, and the widest of them showed 250,000 units across. That was
     fine when every sector's last landmark sat around 108,000 units out; it
     stopped being fine when worlds started rolling their own size, because a
     sprawling one now reaches past 180,000 in every direction — 360,000 across
     — and the map simply could not be pulled back far enough to show you the
     place you were flying around in.

     Nine steps now, from 690,000 units across down to 8,300. The widest fits
     any world this generator can roll with room to spare, and the closest is
     tight enough to pick one wreck out of a field. */
  const ZOOMS = [0.00145, 0.0029, 0.0058, 0.0116, 0.0232,
                 0.0464, 0.0696, 0.0928, 0.12];

  /* The waypoint, on a chart. A ring with a cross through it and a stem — not any
     of the six pin shapes, because it is not a note about somewhere you have
     been; it is the one place you are going. */
  function drawWaypoint(st, mx, my, big) {
    const w = st.waypoint;
    if (!w) return;
    const { ctx } = api;
    const x = mx(w.x), y = my(w.y), r = big ? 9 : 5;
    ctx.save();
    ctx.strokeStyle = WAYPOINT;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = big ? 2 : 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.moveTo(x - r * 1.7, y); ctx.lineTo(x + r * 1.7, y);
    ctx.moveTo(x, y - r * 1.7); ctx.lineTo(x, y + r * 1.7);
    ctx.stroke();
    ctx.restore();
    if (big) {
      label("WAYPOINT  " + fmtCells(w.dist) + "u", x, y + r * 2.6 + 12,
            SIZE.cap, WAYPOINT, "center", 0.8);
    }
  }

  function drawPins(st, mx, my, big) {
    const { ctx } = api;
    for (const q of (st.pins || [])) {
      const spec = pinSpec(q.kind);
      const x = mx(q.x), y = my(q.y);
      const r = big ? 7 : 4;
      ctx.save();
      ctx.strokeStyle = spec.colour;
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = big ? 2 : 1.4;
      // A dropped pin: a ring on a stem, so it reads as sitting on the map
      // rather than being a thing that is in the world.
      ctx.beginPath();
      ctx.arc(x, y - r * 1.6, r, 0, Math.PI * 2);
      ctx.moveTo(x, y - r * 0.6);
      ctx.lineTo(x, y + r * 1.2);
      ctx.stroke();
      ctx.restore();
      if (big) {
        label(spec.name, x, y + r * 3.4, SIZE.cap, spec.colour, "center", 0.7);
      }
    }
  }

  /* The key. Drawn from the same table the marks are, so it cannot drift from
     the map — a legend that disagrees with its chart is worse than none. Only
     the kinds you have actually found are listed: a key full of symbols you
     have never seen is a spoiler and a wall of text at the same time. */
  function drawChartLegend(view, st) {
    const { ctx } = api;
    const kinds = [];
    for (const q of (st.known || [])) {
      if (CHART_MARKS[q.k] && !kinds.includes(q.k)) kinds.push(q.k);
    }
    if (!kinds.length) return;
    kinds.sort();

    const w = 148, rowH = 19, pad = 10;
    const h = kinds.length * rowH + pad * 2;
    /* Below the readout, which shares this corner and is painted after the
       legend — so the sector coordinate and the range home used to print
       straight across the legend's first two rows. */
    const x = view.x + view.w - w - 12, y = view.y + 62;

    ctx.save();
    ctx.fillStyle = "rgba(5,5,10,0.78)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    kinds.forEach((k, i) => {
      const spec = CHART_MARKS[k];
      const cy = y + pad + i * rowH + 7;
      ctx.save();
      ctx.strokeStyle = spec.colour;
      ctx.fillStyle = spec.colour;
      ctx.lineWidth = 1.4;
      markGlyph(ctx, k, x + pad + 7, cy, 5);
      ctx.restore();
      const n = (st.known || []).filter(q => q.k === k).length;
      label(spec.name, x + pad + 22, cy + 5, SIZE.cap, spec.colour, "left", 0.9);
      label(String(n), x + w - pad, cy + 5, SIZE.cap, spec.colour, "right", 0.55);
    });
  }

  HUD.chartOpened = function (st) {
    if (st && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }
    chart.follow = true;
  };

  /* The chart had the same hole: arrows panned it and nothing else did, so on a
     phone the only way across a sector was the arrow keys it does not have. */
  HUD.chartDragBy = function (dx, dy) {
    chart.x -= dx / chart.scale;
    chart.y -= dy / chart.scale;
    chart.follow = false;
  };
  HUD.chartZoomBy = function (dir) { zoomChart(dir); };
  HUD.chartView = () => ({ x: Math.round(chart.x), y: Math.round(chart.y),
                           scale: chart.scale, follow: chart.follow,
                           steps: ZOOMS.length });

  HUD.chartKey = function (code, st) {
    const step = 260 / chart.scale;
    if (code === "ArrowLeft")  { chart.x -= step; chart.follow = false; return true; }
    if (code === "ArrowRight") { chart.x += step; chart.follow = false; return true; }
    if (code === "ArrowUp")    { chart.y -= step; chart.follow = false; return true; }
    if (code === "ArrowDown")  { chart.y += step; chart.follow = false; return true; }
    if (code === "Equal" || code === "NumpadAdd")      { zoomChart(1); return true; }
    if (code === "Minus" || code === "NumpadSubtract") { zoomChart(-1); return true; }
    if (code === "KeyC") { HUD.chartOpened(st); return true; }
    if (code === "KeyP") {
      chart.pin = (chart.pin + 1) % PIN_KINDS.length;
      chart.jump = false;
      return true;
    }
    return false;
  };

  /* Nearest step rather than exact match. The chart's opening scale used to be
     a number that was not in this list at all, so the first press fell through
     to a hard-coded index and jumped somewhere unrelated to where you were. */
  function zoomChart(dir) {
    let i = 0, best = Infinity;
    for (let k = 0; k < ZOOMS.length; k++) {
      const d = Math.abs(Math.log(ZOOMS[k] / chart.scale));
      if (d < best) { best = d; i = k; }
    }
    chart.scale = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
  }

  HUD.drawChart = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    if (chart.follow && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }

    const span = SCREEN_W / chart.scale;
    pageFrame("SECTOR CHART",
              "SEED " + (st.seed || 0) +
              (st.world ? "  ·  " + st.world.name : "") +
              "  ·  " + fmtCells(HUD.charted()) + " CELLS CHARTED",
              /* No footer any more: that line belongs to the navigation strip
                 now, the same as on every other page. The keys it used to name
                 are on the title line instead, where nothing else is. */
              "");


    /* The band under the map used to be 56px holding five things — a hint, a
       zoom readout, six palette buttons, the footer and CLOSE — all inside
       each other. The map gives up a row so each of them gets its own.

       It gives up a second one now, because the chart was the only page in the
       mode without the navigation strip: opening the map and wanting your
       storage meant closing the map, flying, and pressing another key. Its own
       three buttons moved up a row and the strip took the bottom, so the map is
       a page you can leave the way you leave every other one. */
    const view = { x: PAGE.EDGE, y: PAGE.TOP,
                   w: SCREEN_W - PAGE.EDGE * 2, h: SCREEN_H - PAGE.TOP - 162 };
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
    paintMarks(st, mx, my, true, chart.scale);
    paintEchoes(st, mx, my, true);
    drawPins(st, mx, my, true);
    drawWaypoint(st, mx, my, true);

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.lineWidth = 1;
    ctx.strokeRect(view.x, view.y, view.w, view.h);
    ctx.restore();

    drawScaleBar(view);
    drawChartLegend(view, st);
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

    /* Dropping a pin. The whole map is one tap target, registered *before* the
       palette and the buttons so anything drawn after it wins — the tap list is
       last-drawn-first-served, and a palette button sitting inside the map area
       would otherwise be unreachable.

       A tap here is a tap and not a drag: the page holds a press until release
       and only calls this if the pointer barely moved, so panning the chart
       never leaves a trail of pins behind it. */
    const canJump = !!st.wormhole && typeof st.onJump === "function";
    if (!canJump) chart.jump = false;
    if (chart.jump) chart.mark = false;

    api.addTap({
      x: view.x, y: view.y, w: view.w, h: view.h,
      act: (sx, sy) => {
        if (sx == null) return;
        const wx = chart.x + (sx - (view.x + view.w / 2)) / chart.scale;
        const wy = chart.y + (sy - (view.y + view.h / 2)) / chart.scale;
        // Fourteen screen pixels' worth of world, so lifting a pin is as easy
        // zoomed out as zoomed in.
        HUD.chartTapAt(st, wx, wy, 14 / chart.scale);
      }
    });

    /* What the next tap on the map will do. Left and right rather than one
       centred line and one right-aligned one on the same baseline, which is
       what they were: the two overlapped at every zoom step. */
    const verb = api.touchOnly ? "TAP" : "CLICK";
    label(chart.jump
            ? verb + " A STATION TO JUMP TO IT"
          : chart.mark
            ? verb + " ANYWHERE TO SET THE WAYPOINT"
            : verb + " THE MAP TO PIN  ·  " + verb + " A PIN TO LIFT IT",
          34, SCREEN_H - 148, SIZE.cap,
          chart.jump ? CASH : chart.mark ? WAYPOINT : VIOLET_LOW, "left", 0.8);

    /* Which step you are on, and how wide the view actually is. Zoom without a
       readout is a control you cannot tell is working — especially at the wide
       end, where a sector of empty space looks much the same at two scales. */
    const step = ZOOMS.reduce((a, z, k) =>
      Math.abs(Math.log(z / chart.scale)) < Math.abs(Math.log(ZOOMS[a] / chart.scale))
        ? k : a, 0);
    label("ZOOM " + (step + 1) + "/" + ZOOMS.length + "   ·   " +
          fmtCells(Math.round(SCREEN_W / chart.scale)) + " UNITS ACROSS",
          SCREEN_W - 34, SCREEN_H - 148, SIZE.cap, VIOLET_DIM, "right", 0.8);

    /* The palette. Which kind of note the next tap leaves — a row to itself, so
       nothing is drawn through it and nothing steals its taps, and on the page's
       own six columns so it lines up with the map above it rather than floating
       centred in the middle of nowhere. */
    const py = SCREEN_H - 138;
    PIN_KINDS.forEach((k, i) => {
      const on = i === chart.pin && !chart.jump;
      const c = COL(PIN_KINDS.length, i);
      const bx = c.x, pw = c.w;
      ctx.save();
      ctx.globalAlpha = chart.jump ? 0.35 : 1;
      ctx.fillStyle = k.colour;
      ctx.globalAlpha *= on ? 0.20 : 0.06;
      ctx.fillRect(bx, py, pw, 34);
      ctx.strokeStyle = k.colour;
      ctx.globalAlpha = (chart.jump ? 0.35 : 1) * (on ? 1 : 0.4);
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeRect(bx, py, pw, 34);
      ctx.restore();
      fitText(k.name, bx + pw / 2, py + 22, SIZE.cap, k.colour, "center",
              (chart.jump ? 0.35 : 1) * (on ? 1 : 0.6), pw - 12);
      api.addTap({ x: bx, y: py, w: pw, h: 34,
                   act: () => { chart.pin = i; chart.jump = false; } });
    });

    /* Below the rule: the buttons, each with its own stretch of the line. The
       zoom pair and RECENTRE used to sit on top of the palette's first two
       swatches, and CLOSE on top of its last — and taps go to whatever was
       drawn last, so those pin kinds could not be chosen on a phone at all. */
    if (api.touchOnly) {
      // On the row above the navigation strip, with the chart's own actions —
      // the strip owns the bottom line on every page now, this one included.
      button("−", 60, SCREEN_H - 74, 46, 38, VIOLET, () => zoomChart(-1));
      button("+", 114, SCREEN_H - 74, 46, 38, VIOLET, () => zoomChart(1));
      button("RECENTRE", 220, SCREEN_H - 74, 140, 38, VIOLET,
             () => HUD.chartOpened(st));
    }
    /* The manmade wormhole, which is what the yard was for. Six parts carried
       home for a reward that was wired up in the engine and never reached the
       interface — `onJump` existed, nothing called it. It arms here, and the
       next tap on a charted station opens the mouth. */
    /* Three buttons share the span between the footer on the left — or the zoom
       cluster, on a phone — and CLOSE on the right, which is 400 to 775. All
       three are optional and any combination can be up at once, so the places are
       fixed rather than packed: a button that moves depending on what else is
       there is a button you have to look for. */
    const actY = SCREEN_H - 74;
    /* The keys, on the actions row rather than the footer — the footer line is
       the navigation strip's now. On a phone this row holds the zoom cluster
       instead, and a phone has no keys to name. */
    if (!api.touchOnly) {
      label("ARROWS PAN  ·  ± ZOOM  ·  C", PAGE.EDGE, actY + 6, SIZE.cap,
            VIOLET_LOW, "left", 0.7);
    }
    if (st.waypoint && !chart.mark) {
      button("CLEAR", 450, actY, 96, 38, VIOLET_DIM,
                    () => { if (st.onWaypoint) st.onWaypoint(null); });
    }
    /* Somewhere to go. Pins are notes and there can be two hundred of them; a
       waypoint is the one place you have decided on, and the flight HUD points
       at it. Armed the same way the wormhole is, because that gesture is already
       learned by the time anyone has a wormhole. */
    button(chart.mark ? "CANCEL" : st.waypoint ? "MOVE  ▸" : "WAYPOINT  ▸",
                  560, actY, 130, 38, chart.mark ? WARN : WAYPOINT,
                  () => { chart.mark = !chart.mark; chart.jump = false; },
                  chart.mark);
    if (canJump) {
      button(chart.jump ? "CANCEL" : "WORMHOLE  ▸",
                    700, actY, 140, 38, chart.jump ? WARN : CASH,
                    () => { chart.jump = !chart.jump; chart.mark = false; },
                    chart.jump);
    }
    pageNav(st, "chart");
    closeButton(st.onClose || (() => {}));
  };

  /* What a press on the map means, in world coordinates. A function rather
     than a closure inside the tap so the harness can drive the same body the
     pointer does — the jump was unreachable for a release precisely because
     nothing but a pointer could ever have reached it. */
  HUD.chartTapAt = function (st, wx, wy, snap) {
    if (chart.jump) { jumpNear(st, wx, wy, snap); return; }
    if (chart.mark) {
      chart.mark = false;
      if (st && st.onWaypoint) st.onWaypoint(wx, wy);
      return;
    }
    if (st && st.onPin) st.onPin(wx, wy, PIN_KINDS[chart.pin].key, snap);
  };
  HUD.chartJumpArm = function (on) { chart.jump = !!on; };
  HUD.chartJumpArmed = () => !!chart.jump;

  /* Jumping to a place already written down. Stations only — this is fast
     travel across ground you have covered, never a way to skip covering it —
     and the nearest one inside the same finger-width the pins use, so the
     gesture is the one the page has already taught. */
  function jumpNear(st, wx, wy, snap) {
    let best = null, bestD = snap * snap;
    for (const q of (st.known || [])) {
      if (q.k !== "station") continue;
      const d = (q.x - wx) * (q.x - wx) + (q.y - wy) * (q.y - wy);
      if (d > bestD) continue;
      bestD = d; best = q;
    }
    // A miss leaves the arm on. Cancelling because a finger landed two pixels
    // wide of a station would be the page punishing you for its own tolerance.
    if (!best) return;
    chart.jump = false;
    if (st.onJump(best.x, best.y) !== false) {
      chart.x = best.x; chart.y = best.y; chart.follow = true;
      if (st.onClose) st.onClose();
    }
  }

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
              found + " OF " + entries.length + " LOGGED" +
              (totalRows > L.rows ? (api.touchOnly ? "  ·  DRAG TO SCROLL"
                                                   : "  ·  SCROLL OR ARROWS") : ""),
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
      pageNav(st, "almanac");
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
    ctx.fillStyle = on ? "rgba(160,140,255,0.06)" : "rgba(255,255,255,0.02)";
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
            "center", on ? 1 : 0.5, w - 60, "0.1em");
    fitText(on ? e.note : (e.secret ? "not on any chart" : e.note),
            x + w / 2, y + art + 116, SIZE.val, on ? VIOLET : VIOLET_DIM,
            "center", on ? 0.9 : 0.45, w - 60);
    label(on ? "LOGGED" : "NOT YET FOUND", x + w / 2, y + art + 150, SIZE.cap,
          on ? CASH : VIOLET_LOW, "center", 0.8, "0.18em");

    label(api.touchOnly ? "TAP TO CLOSE" : "CLICK, OR ESC, TO CLOSE",
          x + w / 2, y + h - 22, SIZE.cap, VIOLET_LOW, "center", 0.8);
    api.addTap({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H,
                 act: () => { almanac.open = -1; } });
  }

  function drawCard(e, x, y, w, h, selected, index) {
    const { ctx } = api;
    const on = !!e.found;
    const art = h - 22;

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
    const name = on || !e.secret ? e.name : "??????????";
    fitText(name, tx, y + 30, SIZE.cap, on ? AMBER : AMBER_DIM, "left",
            on ? 1 : 0.45, room, "0.08em");
    fitText(on ? e.note : (e.secret ? "not on any chart" : e.note),
            tx, y + 52, SIZE.cap, on ? VIOLET : VIOLET_DIM, "left",
            on ? 0.85 : 0.4, room);
    if (on) label("✓", x + w - 18, y + 30, SIZE.cap, VIOLET, "right", 0.9);

    /* Clicking an entry opens it. It used to only move the selection, which
       made every card in the book look like a button that did nothing —
       and the picture, which is the point of the almanac, was stuck at
       thumbnail size with no way to see it properly. */
    api.addTap({ x, y, w, h, act: () => {
      almanac.open = (almanac.open === index) ? -1 : index;
      almanac.pick = index;
    } });
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
                 r * 0.13, CASH);
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
            ctx.fillStyle = lit(CASH);
            ctx.globalAlpha = a;
            ctx.fillRect(bx - r * 0.14, cy - r * 0.42 + i * r * 0.1,
                         r * 0.28, r * 0.84 - i * r * 0.2);
            ctx.restore();
          }
        }
        break;
      case "grave-robber":
        // The cache, and the broken ring that was guarding it.
        stroke(CASH, 1.6, () => {
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
      case "salvor":
        // A part, carried: the triangle the world draws one with, on its way.
        stroke(CASH, 1.7, () => {
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
        ring(cx, cy, r * 0.86, CASH, 1.6);
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * Math.PI * 2 + 0.06;
          const a1 = ((i + 1) / 6) * Math.PI * 2 - 0.06;
          stroke(CASH, 3, () => {
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.56, a0, a1);
            ctx.stroke();
          });
        }
        disc(cx, cy, r * 0.2, CASH);
        break;
      default:                  ring(cx, cy, r * 0.8, VIOLET, 1.6);
    }
  }

  // Exposed so the game can draw the same picture anywhere else it wants one.
  HUD.icon = drawIcon;

  /* ═══ THE STATION ═════════════════════════════════════════════════════════
     Where salvage becomes a better ship. A page like the chart and the almanac
     rather than an overlay, for the same reason they are: a shop you read
     through a drifting asteroid field is a shop you misread.

     It shows both progression tracks side by side even though only one of them
     can be spent here. That is deliberate — the verbs are the reason to go
     looking rather than to keep grinding the same three rocks, and a player
     staring at a price list is exactly the player who should be able to see
     what looking would buy instead. */

  HUD.refitOpened = function () { refit.pick = 0; };

  HUD.refitKey = function (code, st) {
    const rows = (st && st.refit) || [];
    if (code === "KeyS") { if (st && st.onSell) st.onSell(); return true; }
    if (!rows.length) return false;
    if (code === "ArrowUp")        refit.pick = (refit.pick + rows.length - 1) % rows.length;
    else if (code === "ArrowDown") refit.pick = (refit.pick + 1) % rows.length;
    else if (code === "Enter" || code === "Space") {
      const row = rows[refit.pick];
      if (row && st.onBuy) st.onBuy(row.key);
    } else return false;
    return true;
  };

  HUD.drawRefit = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const rows = st.refit || [];
    const cash = st.cash || 0;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const L = COL(2, 0), R = COL(2, 1);

    pageFrame("STATION", "CASH  " + cash,
              "");   // the nav strip has the footer line

    /* ── what it pays ──────────────────────────────────────────────────────
       The selling half leads the page because it is what you came here to do.
       The price comes before the count, because the price is the half that
       differs between here and the next station. */
    const mats = st.materials || [];
    const carried = st.carried || 0;
    const buyH = PANEL_H(1);
    panel(full.x, PAGE.TOP, full.w, buyH, CASH, "THIS STATION BUYS",
          carried ? carried + " UNITS ABOARD" : "NOTHING ABOARD");
    const cellW = (full.w - PAGE.PAD * 2 - 230) / Math.max(1, mats.length);
    mats.forEach((m, i) => {
      const x = full.x + PAGE.PAD + i * cellW;
      const yy = ROW(PAGE.TOP, 0);
      fitText(m.name, x, yy, SIZE.cap, m.colour, "left", m.n ? 1 : 0.4,
              cellW - 78, "0.06em");
      label((m.price == null ? m.value : m.price) + "  \u00d7" + m.n,
            x + cellW - 22, yy, SIZE.cap, m.n ? CASH : VIOLET_LOW, "right",
            m.n ? 0.95 : 0.4);
    });
    /* Centred on the content row rather than on the panel, and short enough to
       clear the title band above it. Centred on the panel it sat 9px too high and
       its top edge ran straight through "N UNITS ABOARD". */
    button(carried ? "SELL ALL   " + (st.worth || 0) : "NOTHING TO SELL",
           full.x + full.w - 114, ROW(PAGE.TOP, 0) - 4, 200, 32,
           carried ? CASH : VIOLET_LOW, st.onSell, false, !!carried);

    /* ── the chandler ──────────────────────────────────────────────────────
       Priced on what is missing rather than a flat fee, and the button says the
       number: a shop that makes you press to find the price is a shop you do not
       use when you are down to four minutes of water. */
    const supY = PAGE.TOP + buyH + PAGE.STEP;
    panel(full.x, supY, full.w, buyH, ICE, "SUPPLIES");
    /* Two halves of the panel's inside width rather than a hard 300 apart. At 300
       the water block's FILL button ran to x 359 and the food block began at 354,
       so the button's edge was drawn through the word FOOD. Halves cannot
       overlap, whatever the panel is doing. */
    const supIn = full.w - PAGE.PAD * 2, supHalf = supIn / 2;
    [["water", "WATER", ICE], ["food", "FOOD", AMBER_DIM]].forEach(([k, name, col], i) => {
      const m = st[k] || {};
      const done = m.cost == null;
      const afford = !done && cash >= m.cost;
      const x = full.x + PAGE.PAD + i * supHalf;
      const yy = ROW(supY, 0);
      label(name, x, yy, SIZE.cap, m.countdown > 0 ? WARN : col, "left", 0.9, "0.14em");
      label(m.countdown > 0 ? fmtSecs(m.countdown)
                            : Math.round((m.frac || 0) * 100) + "%",
            x + 84, yy, SIZE.cap, m.countdown > 0 ? WARN : col, "left", 0.95);
      barAt(x + 142, yy - 9, 92, 8, m.frac || 0, col, m.countdown > 0);
      button(done ? "FULL" : "FILL  " + m.cost, x + supHalf - 82, yy - 4,
             130, 32, done ? VIOLET_LOW : afford ? col : WARN,
             done ? null : () => st.onBuySupply && st.onBuySupply(k),
             false, !done && afford);
    });

    /* ── the two tracks ────────────────────────────────────────────────────
       Two rows of the grid apiece: what it is and what it does above, the tier
       pips and the price below. */
    const colY = supY + buyH + PAGE.STEP;
    const refitH = PANEL_H(rows.length * 2);
    panel(L.x, colY, L.w, refitH, CASH, "REFIT", "PAID IN CASH");
    rows.forEach((r, i) => {
      const yTop = ROW(colY, i * 2), yBot = ROW(colY, i * 2 + 1) - 6;
      const sel = i === refit.pick;
      const maxed = r.cost == null;
      const afford = !maxed && cash >= r.cost;
      if (sel) {
        ctx.save();
        ctx.fillStyle = CASH;
        ctx.globalAlpha = 0.07;
        ctx.fillRect(L.x + 1, yTop - 18, L.w - 2, PAGE.STEP * 2);
        ctx.restore();
      }
      fitText(r.name, L.x + PAGE.PAD, yTop, SIZE.cap, maxed ? AMBER : CASH,
              "left", 1, L.w - 200, "0.08em");
      fitText(r.note, L.x + PAGE.PAD, yBot, SIZE.cap, VIOLET_DIM, "left", 0.7,
              L.w - 200);
      for (let t = 0; t < r.max; t++) {
        const px = L.x + L.w - PAGE.PAD - (r.max - t) * 16;
        ctx.save();
        ctx.fillStyle = t < r.tier ? CASH : VIOLET_LOW;
        ctx.globalAlpha = t < r.tier ? 0.9 : 0.35;
        ctx.fillRect(px, yTop - 9, 11, 9);
        ctx.restore();
      }
      label(maxed ? "MAX" : String(r.cost), L.x + L.w - PAGE.PAD, yBot,
            SIZE.cap, maxed ? AMBER_DIM : afford ? CASH : WARN, "right",
            maxed ? 0.6 : 1);
      if (!maxed) {
        api.addTap({ x: L.x, y: yTop - 18, w: L.w, h: PAGE.STEP * 2,
                     act: () => { refit.pick = i; if (st.onBuy) st.onBuy(r.key); } });
      }
    });

    const unlocks = st.unlocks || [];
    const earnH = PANEL_H(unlocks.length * 2);
    panel(R.x, colY, R.w, earnH, VIOLET, "EARNED, NOT BOUGHT", "PAID IN LOOKING");
    unlocks.forEach((u, i) => {
      const yTop = ROW(colY, i * 2), yBot = ROW(colY, i * 2 + 1) - 6;
      /* A locked one says its own name. Three rows all reading "LOCKED" told you
         there were three of something and nothing about what — and the only
         reason to show them at all is that they are a reason to go and look. */
      fitText(u.name, R.x + PAGE.PAD, yTop, SIZE.cap,
              u.have ? VIOLET : VIOLET_LOW, "left", u.have ? 1 : 0.55, R.w - 140,
              "0.08em");
      fitText(u.have ? u.note : "locked — find " + u.at + " almanac entries",
              R.x + PAGE.PAD, yBot, SIZE.cap, VIOLET_DIM, "left",
              u.have ? 0.75 : 0.5, R.w - 60);
      label(u.have ? "\u2713" : "\u00b7", R.x + R.w - PAGE.PAD, yTop, SIZE.cap,
            u.have ? CASH : VIOLET_LOW, "right", u.have ? 1 : 0.5);
    });

    /* The shipyard. A door rather than a panel: the hull is the bigger decision
       by an order of magnitude — a tier of drive costs a hundred and forty and a
       Cathedral costs a hundred and twelve thousand. */
    /* "HANGAR \u25b8 SKIFF" told you nothing: a SKIFF is a word you have never
       seen, and the button read as though the hangar were called one. It says
       what it is for, and what you are in, in that order. */
    const doorY = colY + earnH + PAGE.STEP + 10;
    const home = !!st.atHome;
    button(home ? "HANGAR  \u25b8    BUY A SHIP" : "HANGAR  \u00b7  HOME STATION ONLY",
           R.x + R.w / 2, doorY, R.w, 44, home ? VIOLET : VIOLET_LOW,
           home ? (st.onHangar || (() => {})) : null, false, home);
    label(home ? "you fly the " + (st.shipName || "SKIFF")
               : "you fly the " + (st.shipName || "SKIFF") +
                 "  \u00b7  ships change hands at home",
          R.x + R.w / 2, doorY + 40, SIZE.cap, VIOLET_DIM, "center", 0.6);

    label("ARROWS MOVE  \u00b7  ENTER BUYS  \u00b7  S SELLS  \u00b7  E UNDOCKS",
          SCREEN_W - PAGE.EDGE, SCREEN_H - 70, SIZE.cap, VIOLET_LOW, "right", 0.55);

    pageNav(st, "refit");
    closeButton(st.onUndock || st.onClose || (() => {}));
  };

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
    rare:     { name: "RARE",     colour: CASH },
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

  HUD.drawLoadout = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const slots = st.slots || [null, null, null, null];
    const docked = !!st.docked;

    pageFrame("LOADOUT",
              (st.shipName || "") + "  \u00b7  FOUR SLOTS, EVERY HULL",
              "");

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
                CASH, "left", 0.9, "0.14em");
        }
      }
      api.addTap({ x, y: PAGE.TOP, w, h: slotH, act: () => {
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
    panel(L.x, listY, L.w, listH, CASH, "IN THE CRATE",
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
        colour: e.fitted ? VIOLET_LOW : CASH,
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
        "on how far out it is \u2014 the strange ones are a long",
        "way from home, which is what the danger curve is",
        "for.",
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
            sum.length ? CASH : VIOLET_LOW, "left", sum.length ? 0.9 : 0.5,
            SCREEN_W - PAGE.EDGE * 2 - 176);

    pageNav(st, "loadout");
    closeButton(st.onClose);
  };

  HUD.drawInventory = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const cash = st.cash || 0, cap = st.hold || 1;
    const L = COL(2, 0), R = COL(2, 1);

    pageFrame("INVENTORY",
              (st.world ? st.world.name + "  \u00b7  " : "") + "SEED " + (st.seed || 0),
              "");

    /* ── the two doors ─────────────────────────────────────────────────────
       The almanac was a line of small type in the corner of a panel further down
       this page, and the manifest was a panel that only ever showed what it
       already knew. Both are pages, so both are doors, and doors go at the top
       where they are the first thing you see and unmistakably pressable. */
    const doorH = PANEL_H(2);
    [{ title: "ALMANAC", val: (st.found || 0) + " / " + (st.total || 0),
       sub: "what is out there, and what you have seen",
       key: api.touchOnly ? "" : "L", colour: VIOLET, act: st.onAlmanac, col: L },
     { title: "MISSIONS", val: (st.built || 0) + " / " + (st.needs || 6),
       sub: "what the yard wants, and where to look",
       key: "", colour: CASH, act: st.onMissions, col: R }
    ].forEach(d => {
      const { x, w } = d.col;
      panel(x, PAGE.TOP, w, doorH, d.colour,
            d.title + (d.key ? "   [" + d.key + "]" : ""),
            api.touchOnly ? "TAP" : "OPEN  \u25b8");
      label(d.val, x + PAGE.PAD, ROW(PAGE.TOP, 0) + 6, SIZE.big, d.colour, "left");
      fitText(d.sub, x + PAGE.PAD, ROW(PAGE.TOP, 1) + 8, SIZE.cap, VIOLET_DIM,
              "left", 0.7, w - PAGE.PAD * 2);
      api.addTap({ x, y: PAGE.TOP, w, h: doorH, act: d.act || (() => {}) });
    });

    /* Cash gets its own panel and its own line: it is the one number on this
       page with no ceiling and no second half. Everything else here is a
       fraction of something. */
    const y2 = PAGE.TOP + doorH + PAGE.STEP;
    const cashH = PANEL_H(1);
    panel(L.x, y2, L.w, cashH, CASH, "CASH");
    label(String(cash), L.x + PAGE.PAD, ROW(y2, 0) + 6, SIZE.big, CASH, "left");
    label("refits, supplies and ships", L.x + L.w - PAGE.PAD, ROW(y2, 0) + 4,
          SIZE.cap, CASH_DIM, "right", 0.55);

    // ── the ship, as four tracks of pips ──────────────────────────────────
    panel(R.x, y2, R.w, cashH, AMBER, "THE SHIP", st.shipName || "");
    const tracks = st.refit || [];
    tracks.forEach((r, i) => {
      const bw = (R.w - PAGE.PAD * 2 - 12 * (tracks.length - 1)) / tracks.length;
      const bx = R.x + PAGE.PAD + i * (bw + 12);
      const yy = ROW(y2, 0) - 2;
      fitText(r.name.split(" ")[0], bx, yy, SIZE.cap, AMBER_DIM, "left", 0.8,
              bw, "0.06em");
      for (let t = 0; t < r.max; t++) {
        const pw = (bw - (r.max - 1) * 4) / r.max;
        ctx.save();
        ctx.fillStyle = t < r.tier ? CASH : VIOLET_LOW;
        ctx.globalAlpha = t < r.tier ? 0.9 : 0.4;
        ctx.fillRect(bx + t * (pw + 4), yy + 8, pw, 6);
        ctx.restore();
      }
    });

    /* ── storage ───────────────────────────────────────────────────────────
       One row a material, on the same rhythm as every other list in the mode: a
       swatch, a name, a count, and what it is worth apiece. */
    const y3 = y2 + cashH + PAGE.STEP;
    const used = st.carried || 0;
    const mats = st.materials || [];
    const storeH = PANEL_H(mats.length + 1);
    panel(L.x, y3, L.w, storeH, VIOLET, "STORAGE", used + " / " + cap);
    barAt(L.x + PAGE.PAD, y3 + PAGE.HEAD + 2, L.w - PAGE.PAD * 2, 8,
          cap ? used / cap : 0, VIOLET, used >= cap);
    mats.forEach((m, i) => {
      const yy = ROW(y3, i + 1) - 4;
      ctx.save();
      ctx.fillStyle = m.colour;
      ctx.globalAlpha = m.n ? 0.9 : 0.22;
      ctx.fillRect(L.x + PAGE.PAD, yy - 9, 9, 9);
      ctx.restore();
      fitText(m.name, L.x + PAGE.PAD + 18, yy, SIZE.cap, m.colour, "left",
              m.n ? 0.95 : 0.35, L.w - 200, "0.06em");
      label(String(m.n), L.x + L.w - PAGE.PAD - 58, yy, SIZE.cap,
            m.n ? m.colour : VIOLET_LOW, "right", m.n ? 1 : 0.35);
      label("@" + m.value, L.x + L.w - PAGE.PAD, yy, SIZE.cap, VIOLET_DIM,
            "right", 0.5);
    });
    if (!used) {
      label("empty \u2014 go and break something", L.x + PAGE.PAD,
            ROW(y3, mats.length + 1) - 6, SIZE.cap, VIOLET_LOW, "left", 0.6);
    }

    // ── what the almanac has bought ───────────────────────────────────────
    const unlocks = st.unlocks || [];
    panel(R.x, y3, R.w, storeH, VIOLET, "EARNED, NOT BOUGHT",
          (st.found || 0) + " LOGGED");
    unlocks.forEach((u, i) => {
      const yy = ROW(y3, i);
      label(u.have ? "\u2713" : "\u00b7", R.x + PAGE.PAD, yy, SIZE.cap,
            u.have ? CASH : VIOLET_LOW, "left", u.have ? 1 : 0.5);
      fitText(u.have ? u.name : "locked", R.x + PAGE.PAD + 20, yy, SIZE.cap,
              u.have ? VIOLET : VIOLET_LOW, "left", u.have ? 0.95 : 0.5,
              R.w - 220, "0.06em");
      fitText(u.have ? u.note : u.at + " entries", R.x + R.w - PAGE.PAD, yy,
              SIZE.cap, VIOLET_DIM, "right", u.have ? 0.6 : 0.5, 190);
    });

    /* Reputation, one line, three flags, no numbers anywhere. It sits at the foot
       of the page rather than in a panel of its own because it is not a resource
       you manage — it is a fact about the world you go and read, the way you
       would read a room. Who is fighting whom sits under it, because your
       reputation with one power only means something next to who they are
       fighting. */
    const flags = st.standings || [];
    if (flags.length) {
      label("REPUTATION", PAGE.EDGE, SCREEN_H - 92, SIZE.cap, VIOLET_DIM,
            "left", 0.55, "0.18em");
      const cw = (SCREEN_W - PAGE.EDGE * 2) / flags.length;
      flags.forEach((f, i) => {
        const x = PAGE.EDGE + i * cw;
        const bad = f.standing === "HUNTED" || f.standing === "WANTED";
        const warm = f.standing === "WELCOME" || f.standing === "TRUSTED";
        fitText(f.short, x, SCREEN_H - 70, SIZE.cap, f.colour, "left",
                0.85, cw * 0.42, "0.12em");
        fitText(f.standing, x + cw * 0.44, SCREEN_H - 70, SIZE.cap,
                bad ? WARN : warm ? CASH : VIOLET_DIM, "left", bad ? 1 : 0.8,
                cw * 0.52, "0.1em");
        if (f.enemy) {
          fitText("at war with " + f.enemy, x, SCREEN_H - 54, SIZE.cap,
                  VIOLET_LOW, "left", 0.5, cw - 16);
        }
      });
    }

    pageNav(st, "inventory");
    closeButton(st.onClose || (() => {}));
  };

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
  function button(text, cx, cy, w, h, colour, act, on, live, track) {
    const { ctx } = api;
    const enabled = live === undefined ? true : !!live;
    ctx.save();
    ctx.fillStyle = colour;
    ctx.globalAlpha = enabled ? (on ? 0.18 : 0.06) : 0.02;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = colour;
    ctx.globalAlpha = enabled ? (on ? 1 : 0.45) : 0.16;
    ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    fitText(text, cx, cy + 6, SIZE.cap, colour, "center",
            enabled ? 1 : 0.35, w - 18, track === undefined ? "0.12em" : track);
    if (enabled && typeof act === "function") {
      api.addTap({ x: cx - w / 2, y: cy - h / 2, w, h, act });
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

  /* ═══ THE YARD ════════════════════════════════════════════════════════════
     Opened by docking at it. Says what is being built, what it will do, and
     which six things it is still short of — with the clue for each one you have
     not brought in yet. The clue is the whole navigation system, so this is the
     page you come back to when you do not know where to go next. */
  /* One page, two ways in. Docking at the yard opens it because that is where the
     parts go; the inventory opens it because "what am I looking for" is a
     question you ask a long way from the yard, and the answer used to be a
     permanent band across the top of the flight screen. `atYard` is the only
     difference: the same content, and a footer that names the key you arrived by. */
  HUD.drawMissions = function (st, dt) { HUD.drawYardPage(st, dt); };

  HUD.drawYardPage = function (st, dt) {
    const { ctx, SCREEN_W } = api;
    st = st || {};
    const b = st.builds || { name: "THE YARD", does: "", blurb: "" };
    const done = st.built || 0, need = st.needs || 6;
    const finished = done >= need;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };

    pageFrame(st.atYard ? "THE YARD" : "MISSIONS",
              done + " OF " + need + " FITTED",
              "");

    /* ── what is being built ───────────────────────────────────────────────
       The ring stays: it is the same shape the yard draws out in the world, one
       segment a part, and it is the only progress readout in the mode that is a
       picture of the thing rather than a bar. It sits at the end of the header
       row rather than in the middle of the page, so the words lead. */
    const headH = PANEL_H(2);
    panel(full.x, PAGE.TOP, full.w, headH, finished ? CASH : VIOLET,
          finished ? "BUILT" : "BUILDING", done + " / " + need);
    fitText(b.name, full.x + PAGE.PAD, ROW(PAGE.TOP, 0) + 4, SIZE.head,
            finished ? CASH : VIOLET, "left", 1, full.w - 320, "0.12em");
    fitText(finished ? b.does : b.blurb, full.x + PAGE.PAD, ROW(PAGE.TOP, 1) + 6,
            SIZE.cap, finished ? CASH_DIM : VIOLET_DIM, "left", 0.8,
            full.w - 320);

    const rx = full.x + full.w - PAGE.PAD - 34;
    const ry = PAGE.TOP + headH / 2, rr = 28;
    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    for (let i = 0; i < done; i++) {
      const a0 = (i / need) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / need) * Math.PI * 2 - Math.PI / 2;
      api.glow(CASH, 3.4, 0.95, () => {
        ctx.beginPath(); ctx.arc(rx, ry, rr, a0 + 0.06, a1 - 0.06); ctx.stroke();
      });
    }

    /* ── the manifest ──────────────────────────────────────────────────────
       One row a part: a mark, the name, the clue, and where it stands. The clue
       is the whole navigation system, so it gets the width — everything else on
       the line is as short as it can be. Alternate rows are banded, which is
       what lets an eye track a clue back to its name across 900 pixels. */
    const listY = PAGE.TOP + headH + PAGE.STEP;
    const man = st.manifest || [];
    panel(full.x, listY, full.w, PANEL_H(man.length), VIOLET, "THE MANIFEST",
          finished ? "COMPLETE" : (need - done) + " TO FIND");
    man.forEach((m, i) => {
      const y = ROW(listY, i);
      const have = m.have, aboard = m.carrying;
      const colour = have ? CASH_DIM : aboard ? CASH : VIOLET;
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
      fitText(have ? "fitted" : aboard ? "aboard \u2014 drop it at the yard" : m.clue,
              full.x + 250, y, SIZE.cap,
              have ? CASH_DIM : aboard ? CASH : AMBER_DIM, "left",
              have ? 0.45 : 0.8, full.w - 420);
      label(have ? "FITTED" : aboard ? "ABOARD" : "WANTED",
            full.x + full.w - PAGE.PAD, y, SIZE.cap, colour, "right",
            have ? 0.45 : 0.8, "0.14em");
    });

    /* The yard's second project, shown only once the first is finished:
       offering it beside six parts you have not found would make the page a list
       of two things you cannot have. */
    const L = st.light;
    if (finished && L) {
      const ly = listY + PANEL_H(man.length) + PAGE.STEP;
      panel(full.x, ly, full.w, PANEL_H(2), ICE,
            L.have ? L.name + " \u2014 FITTED" : L.name,
            L.have ? (api.touchOnly ? "READY" : "READY  \u00b7  [R] TO RUN")
                   : L.cost + " CASH");
      fitText(L.have ? L.does : L.blurb, full.x + PAGE.PAD, ROW(ly, 0) + 2,
              SIZE.cap, L.have ? ICE : VIOLET_DIM, "left", 0.85, full.w - 280);
      if (!L.have) {
        button("BUILD IT   " + L.cost, full.x + full.w - PAGE.PAD - 100,
               ly + PANEL_H(2) / 2, 200, 40, L.afford ? ICE : WARN,
               L.afford ? (st.onBuildLight || (() => {})) : null,
               false, !!L.afford);
      }
    }

    pageNav(st, "missions");
    closeButton(st.onClose || (() => {}));
  };

  /* ═══ YOU DIED ════════════════════════════════════════════════════════════
     The one page in the mode that is about what just happened rather than what
     to do next, and the only place a run's numbers are ever stated. It gets the
     whole screen and one way off it.

     Four facts, in the order you want them: what killed you, where you were,
     how long you had been out, and what went down with the ship. The last of
     those is the one that stings, so it is itemised — "you lost 43 units" is a
     number and "you lost 19 iridium" is a memory. */
  HUD.drawDeath = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const d = st.death;
    if (!d) return;

    ctx.save();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();

    // A border, closing in, the way the warning that failed to save you did.
    const beat = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 900));
    ctx.save();
    ctx.strokeStyle = WARN;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = (0.06 + beat * 0.08) * (1 - i / 5);
      ctx.lineWidth = 3;
      const inset = 2 + i * 8;
      ctx.strokeRect(inset, inset, SCREEN_W - inset * 2, SCREEN_H - inset * 2);
    }
    ctx.restore();

    const cx = SCREEN_W / 2;
    label("YOU DIED", cx, 148, SIZE.huge, WARN, "center", 1, "0.3em");
    fitText(d.reason, cx, 186, SIZE.val, AMBER, "center", 0.95, SCREEN_W - 200);

    /* The run, as three numbers on one line. Where, how far, how long — the
       three things you will want to say out loud about it. */
    /* The run, as three numbers on one line — the three things you will want to
       say out loud about it. On the page grid's columns rather than a width of
       their own, so they line up with the two panels beneath them. */
    const cols = [
      { cap: "HOW FAR OUT", val: fmtCells(d.dist) + " UNITS" },
      { cap: "SECTOR",      val: d.band },
      { cap: "LASTED",      val: fmtClock(d.lasted) }
    ];
    cols.forEach((c, i) => {
      const col = COL(3, i);
      const x = col.x + col.w / 2;
      label(c.cap, x, 252, SIZE.cap, VIOLET_DIM, "center", 0.7, "0.18em");
      fitText(c.val, x, 284, SIZE.head, VIOLET, "center", 1, col.w - 20);
    });

    /* Two columns, and they are the whole argument of the screen: this is what
       it cost, and this is what you still have. A death screen that lists only
       losses reads as a wipe, and this is not one — the almanac, the yard, the
       chart and the money all survive, and saying so is the difference between
       "start again" and "go back out".

       Each column gets its own half and neither may reach into the other, which
       is not a stylistic point: the worth line used to be right-aligned to the
       box's far edge and printed straight through the right column. */
    /* Two panels, and they are the whole argument of the screen: this is what it
       cost, and this is what you still have. A death screen that lists only
       losses reads as a wipe, and this is not one. They are the page's own two
       columns, so they sit under the three numbers above rather than beside
       them. */
    const carried = (d.hold || []).filter(m => m.n);
    const rowsN = Math.max(4, carried.length + 1);
    const by = 320, bh = PANEL_H(rowsN);
    const L = COL(2, 0), R = COL(2, 1);

    panel(L.x, by, L.w, bh, WARN, "LOST WITH THE SHIP",
          carried.length ? d.lost + " UNITS" : "");
    if (!carried.length) {
      fitText("empty storage — the one mercy", L.x + PAGE.PAD, ROW(by, 0),
              SIZE.cap, VIOLET_LOW, "left", 0.7, L.w - PAGE.PAD * 2);
    } else {
      carried.forEach((m, i) => {
        const y = ROW(by, i);
        ctx.save();
        ctx.fillStyle = m.colour;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(L.x + PAGE.PAD, y - 9, 9, 9);
        ctx.restore();
        fitText(m.name, L.x + PAGE.PAD + 18, y, SIZE.cap, m.colour, "left",
                0.9, L.w - 160, "0.08em");
        label(String(m.n), L.x + L.w - PAGE.PAD, y, SIZE.cap, m.colour, "right", 1);
      });
      fitText("worth about " + d.worth + " cash", L.x + PAGE.PAD,
              ROW(by, carried.length), SIZE.cap, WARN, "left", 0.65,
              L.w - PAGE.PAD * 2);
    }

    panel(R.x, by, R.w, bh, CASH_DIM, "STILL YOURS", "NONE OF IT TAKEN");
    [d.cash + " CASH",
     d.found + " ALMANAC " + (d.found === 1 ? "ENTRY" : "ENTRIES"),
     fmtCells(d.charted) + " CELLS CHARTED",
     "the yard and everything fitted"
    ].forEach((k, i) => {
      label("·", R.x + PAGE.PAD, ROW(by, i), SIZE.cap, CASH_DIM, "left", 0.6);
      fitText(k, R.x + PAGE.PAD + 16, ROW(by, i), SIZE.cap, CASH_DIM, "left",
              0.8, R.w - PAGE.PAD * 2 - 20);
    });

    if (st.deaths > 1) {
      label("DEATH " + st.deaths, cx, by + bh + 28, SIZE.cap, VIOLET_LOW,
            "center", 0.6, "0.2em");
    }

    button(api.touchOnly ? "BACK TO THE STATION"
                        : "BACK TO THE STATION   [ENTER]",
           cx, SCREEN_H - 44, 420, 46, CASH, st.onRespawn || (() => {}));
  };

  /* ═══ A WORLD YOU CAN LAND ON ═════════════════════════════════════════════
     About one world in twenty has somebody on it, and what they have is water
     and food. Deliberately not a station: no cargo bought, no refits sold, no
     almanac verbs — a station is a shipyard and this is a village with a well.
     Keeping the two apart is what makes finding a station matter.

     The page is small on purpose. It answers "can I fill up here, and what will
     it cost", and then it gets out of the way. */
  HUD.drawLanded = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const w = st.landed;
    if (!w) return;
    const colour = w.colour || CASH;

    pageFrame(w.name,
              w.band + "  ·  " + fmtCells(w.dist) + " UNITS FROM ORIGIN",
              api.touchOnly ? "CLOSE BELOW" : "E OR ESC LEAVES");

    label("INHABITED", SCREEN_W / 2, 132, SIZE.head, colour, "center", 1, "0.24em");
    fitText(w.air ? "there is air here, and people in it"
                  : "airless, and lived in anyway",
            SCREEN_W / 2, 162, SIZE.cap, VIOLET_DIM, "center", 0.8, SCREEN_W - 200);

    /* The world itself, drawn at the size the page has room for rather than the
       size it is — you are standing on it, so a to-scale drawing would be a
       straight line across the screen. */
    const cx = SCREEN_W / 2, cy = 268, r = 62;
    ctx.save();
    api.glow(colour, 2.4, 0.9, () => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    });
    if (w.air) {
      api.glow(colour, 2, 0.3, () => {
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2); ctx.stroke();
      });
    }
    api.glow(colour, 1.2, 0.5, () => {
      for (const f of [-0.5, -0.15, 0.2, 0.55]) {
        const yy = f * r, half = Math.sqrt(Math.max(0, r * r - yy * yy));
        ctx.beginPath();
        ctx.moveTo(cx - half, cy + yy); ctx.lineTo(cx + half, cy + yy);
        ctx.stroke();
      }
    });
    ctx.restore();

    // ── the well and the market ────────────────────────────────────────────
    label("CASH  " + (st.cash || 0), SCREEN_W / 2, 372, SIZE.val, CASH,
          "center", 1, "0.1em");

    [["water", "WATER", ICE], ["food", "FOOD", AMBER_DIM]].forEach(([k, name, col], i) => {
      const m = st[k] || {};
      const full = m.cost == null;
      const afford = !full && (st.cash || 0) >= m.cost;
      const x = SCREEN_W / 2 + (i === 0 ? -180 : 180);
      label(name, x, 424, SIZE.cap, m.countdown > 0 ? WARN : col, "center",
            0.85, "0.18em");
      label(m.countdown > 0 ? fmtSecs(m.countdown) : fmtSecs(m.left || 0),
            x, 456, SIZE.head, m.countdown > 0 ? WARN : col, "center", 1);
      barAt(x - 90, 470, 180, 9, m.frac || 0, col, m.countdown > 0);
      button(full ? "FULL" : "FILL  " + m.cost, x, 516, 200, 40,
             full ? VIOLET_LOW : afford ? col : WARN,
             full ? null : () => st.onBuySupply && st.onBuySupply(k),
             false, !full && afford);
    });

    /* The free option, stated where it is relevant. A player who cannot afford
       the water needs to be told there is another way, and this is the only
       screen that knows both facts at once. */
    if (w.air) {
      fitText("or fly through the atmosphere and skim it for nothing — " +
              "it is slow, and it is free",
              SCREEN_W / 2, 566, SIZE.cap, ICE, "center", 0.7, SCREEN_W - 160);
    }

    closeButton(st.onClose || (() => {}));
  };

  /* ═══ THE HANGAR ══════════════════════════════════════════════════════════
     Twenty-five hulls, and the only page in the mode that is a *catalogue*. It
     is laid out like the almanac for the same reason the almanac is laid out
     that way: the picture is the point. Five numbers tell you what a ship does
     and the silhouette tells you what it is, and nobody ever picked a ship off a
     table of numbers.

     One row of bars a stat, drawn against the best in the roster rather than
     against an absolute — "how does this compare to everything else I could
     buy" is the only question a shipyard is ever asked. */
  let hangar = { pick: 0, scroll: 0 };
  HUD.hangarOpened = function (st) {
    const list = (st && st.ships) || [];
    const i = list.findIndex(sh => sh.flying);
    hangar.pick = i < 0 ? 0 : i;
    hangar.scroll = 0;
    keepShipVisible(list.length);
  };

  const SHIP_COLS = () => (api.touchOnly ? 2 : 4);
  const SHIP_ROWS = 3;
  function keepShipVisible(n) {
    const cols = SHIP_COLS();
    const row = Math.floor(hangar.pick / cols);
    if (row < hangar.scroll) hangar.scroll = row;
    if (row >= hangar.scroll + SHIP_ROWS) hangar.scroll = row - SHIP_ROWS + 1;
    const rows = Math.ceil(n / cols);
    hangar.scroll = Math.max(0, Math.min(Math.max(0, rows - SHIP_ROWS), hangar.scroll));
  }

  /* The hangar scrolls too. Twenty-five hulls, and on a phone the grid is two
     across and three down — six visible of twenty-five, with the other nineteen
     reachable only by arrow keys a phone does not have. Drag and wheel both move
     it, the way they already move the almanac. */
  HUD.hangarDragBy = function (dy, n) {
    const rows = Math.ceil(n / SHIP_COLS());
    hangar.scroll = Math.max(0, Math.min(Math.max(0, rows - SHIP_ROWS),
                                         hangar.scroll + dy / 130));
  };
  HUD.hangarCanScroll = n => Math.ceil(n / SHIP_COLS()) > SHIP_ROWS;

  HUD.hangarKey = function (code, st) {
    const list = (st && st.ships) || [];
    if (!list.length) return false;
    const cols = SHIP_COLS();
    if (code === "ArrowLeft")       hangar.pick = Math.max(0, hangar.pick - 1);
    else if (code === "ArrowRight") hangar.pick = Math.min(list.length - 1, hangar.pick + 1);
    else if (code === "ArrowUp")    hangar.pick = Math.max(0, hangar.pick - cols);
    else if (code === "ArrowDown")  hangar.pick = Math.min(list.length - 1, hangar.pick + cols);
    else if (code === "Enter" || code === "Space") {
      const sh = list[hangar.pick];
      if (sh && st.onBuyShip && (sh.owned || sh.afford)) st.onBuyShip(sh.key);
      return true;
    } else return false;
    keepShipVisible(list.length);
    return true;
  };

  /* One hull, drawn from the same polygon the world draws it with. Scaled to the
     box rather than to its real size, so a Skiff is not a speck beside an
     Ossuary on a page whose job is comparing them — the size bar says which is
     bigger, and the outline says what each one *is*. */
  function drawHull(sh, cx, cy, box, colour, alpha) {
    const { ctx } = api;
    let far = 1;
    for (const p of sh.art) far = Math.max(far, Math.hypot(p[0], p[1]));
    if (sh.fins) {
      for (const f of sh.fins) {
        far = Math.max(far, Math.hypot(f[0][0], f[0][1]), Math.hypot(f[1][0], f[1][1]));
      }
    }
    const k = box / far;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6 / k;
    ctx.beginPath();
    sh.art.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.stroke();
    if (sh.fins) {
      ctx.globalAlpha = alpha * 0.8;
      ctx.lineWidth = 1.2 / k;
      ctx.beginPath();
      for (const f of sh.fins) {
        ctx.moveTo(f[0][0], f[0][1]);
        ctx.lineTo(f[1][0], f[1][1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  HUD.drawHangar = function (st, dt) {
    const { ctx, SCREEN_W } = api;
    st = st || {};
    const list = st.ships || [];
    if (!list.length) return;
    const cols = SHIP_COLS();
    hangar.pick = Math.max(0, Math.min(list.length - 1, hangar.pick));

    pageFrame("HANGAR",
              "YOUR SHIP: " + (st.shipName || "SKIFF") + "  \u00b7  CASH  " + (st.cash || 0),
              "");

    /* A catalogue, laid out like the almanac for the same reason the almanac is
       laid out that way: the picture is the point, and nobody ever picked a ship
       off a table of numbers. */
    const cardH = 104, first = hangar.scroll * cols;
    const last = Math.min(list.length, first + SHIP_ROWS * cols);

    for (let i = first; i < last; i++) {
      const sh = list[i];
      const c = COL(cols, (i - first) % cols);
      const row = Math.floor((i - first) / cols);
      const y = PAGE.TOP + row * (cardH + PAGE.STEP);
      const on = i === hangar.pick;
      const reach = sh.owned || sh.afford;
      const colour = sh.flying ? CASH : sh.owned ? VIOLET : reach ? VIOLET_DIM : WRECKC;

      ctx.save();
      ctx.fillStyle = sh.flying ? CASH : VIOLET;
      ctx.globalAlpha = on ? 0.1 : 0.03;
      ctx.fillRect(c.x, y, c.w, cardH);
      ctx.strokeStyle = on ? (sh.flying ? CASH : VIOLET) : colour;
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
      fitText(sh.name, c.x + PAGE.PAD, y + 80, SIZE.cap, colour, "left",
              reach ? 1 : 0.45, c.w - PAGE.PAD * 2 - 8, "0.08em");
      fitText(sh.cls, c.x + PAGE.PAD, y + 96, SIZE.cap, VIOLET_LOW, "left",
              0.6, c.w * 0.5, "0.12em");
      fitText(sh.flying ? "FLYING" : sh.owned ? "OWNED" : sh.cost + " CASH",
              c.x + c.w - PAGE.PAD, y + 96, SIZE.cap,
              sh.flying ? CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
              "right", 0.85, c.w * 0.5);
      api.addTap({ x: c.x, y, w: c.w, h: cardH, act: () => {
        if (hangar.pick === i && reach) {
          if (st.onBuyShip) st.onBuyShip(sh.key);
        } else hangar.pick = i;
      } });
    }

    const rowsAll = Math.ceil(list.length / cols);
    if (rowsAll > SHIP_ROWS) {
      const trackH = SHIP_ROWS * (cardH + PAGE.STEP) - PAGE.STEP;
      const h = Math.max(26, trackH * (SHIP_ROWS / rowsAll));
      const t = rowsAll - SHIP_ROWS ? hangar.scroll / (rowsAll - SHIP_ROWS) : 0;
      ctx.save();
      ctx.fillStyle = VIOLET_LOW;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(SCREEN_W - 22, PAGE.TOP, 3, trackH);
      ctx.fillStyle = VIOLET;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(SCREEN_W - 22, PAGE.TOP + t * (trackH - h), 3, h);
      ctx.restore();
    }

    /* ── the one you are looking at ────────────────────────────────────────
       Five bars against the best in the roster rather than against an absolute:
       "how does this compare to everything else on the page" is the only
       question a shipyard is ever asked. */
    const sh = list[hangar.pick];
    const dy = PAGE.TOP + SHIP_ROWS * (cardH + PAGE.STEP);
    const detailH = PANEL_H(4);
    panel(PAGE.EDGE, dy, SCREEN_W - PAGE.EDGE * 2, detailH,
          sh.flying ? CASH : VIOLET, sh.name, sh.cls);

    drawHull(sh, PAGE.EDGE + 70, dy + PAGE.HEAD + 44, 34,
             sh.flying ? CASH : VIOLET, 1);
    fitText(sh.note, PAGE.EDGE + 140, ROW(dy, 0), SIZE.cap, AMBER_DIM, "left",
            0.85, 260);
    label(sh.flying ? "YOU ARE FLYING THIS"
        : sh.owned ? "IN THE HANGAR"
        : sh.afford ? "YOU CAN AFFORD THIS" : "OUT OF REACH",
          PAGE.EDGE + 140, ROW(dy, 1), SIZE.cap,
          sh.flying ? CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
          "left", 0.8, "0.12em");

    const best = k => list.reduce((m, o) => Math.max(m, o[k]), 0.0001);
    const guns = o => o.dmg * o.rate;
    const stats = [
      ["HULL",  sh.hull / best("hull"),   String(sh.hull)],
      ["GUNS",  guns(sh) / list.reduce((m, o) => Math.max(m, guns(o)), 0.0001),
                guns(sh).toFixed(1) + "x"],
      ["CARGO", sh.cargo / best("cargo"), String(sh.cargo)],
      ["SPEED", sh.speed / best("speed"), sh.speed.toFixed(2) + "x"],
      ["TURN",  sh.turn / best("turn"),   sh.turn.toFixed(2) + "x"]
    ];
    const sw = 96;
    stats.forEach(([name, frac, val], i) => {
      const x = 430 + i * (sw + 12);
      label(name, x, ROW(dy, 0) - 4, SIZE.cap, VIOLET_DIM, "left", 0.65, "0.14em");
      label(val, x, ROW(dy, 1) - 4, SIZE.cap, VIOLET, "left", 0.95);
      barAt(x, ROW(dy, 1) + 4, sw, 7, frac, sh.flying ? CASH : VIOLET, false);
    });

    const reach = sh.owned || sh.afford;
    button(sh.flying ? "FLYING IT" : sh.owned ? "FLY IT" : "BUY   " + sh.cost,
           SCREEN_W - PAGE.EDGE - 110, dy + detailH - 34, 200, 40,
           sh.flying ? VIOLET_LOW : reach ? CASH : WARN,
           sh.flying || !reach ? null
             : () => st.onBuyShip && st.onBuyShip(sh.key),
           false, !sh.flying && reach);

    pageNav(st, "hangar");
    closeButton(st.onClose || (() => {}));
  };

  const fmtClock = s => {
    const t = Math.max(0, Math.round(s));
    const m = Math.floor(t / 60);
    if (m >= 60) return Math.floor(m / 60) + "h " + (m % 60) + "m";
    return m + "m " + String(t % 60).padStart(2, "0") + "s";
  };

  window.CrossfireSurveyHUD = HUD;
})();
