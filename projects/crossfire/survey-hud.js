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
  /* Lifted, both of them. The dim and the low were chosen against a bright
     monitor in a dark room; on a phone in daylight `#3d3470` on `#07070e` is
     about a 2:1 contrast ratio, which is not a colour, it is a rumour — and half
     the interface's secondary type was drawn in them at 0.5 alpha on top of that.
     Nothing in here should be hard to read. */
  const VIOLET_DIM = "#9d8ce0";
  const VIOLET_LOW = "#6f63a8";
  const AMBER      = "#ffe56d";
  const AMBER_DIM  = "#ffcb42";
  const RULE       = "#9a7a1f";
  const WARN       = "#ff8f77";
  const ICE        = "#87d8ff";
  const SOLAR      = "#ffd76d";
  const WRECKC     = "#99a2b5";
  const CASH       = "#6dffbf";
  const CASH_DIM   = "#5fc79b";
  const INK        = "#05050a";

  /* Real steps only — anything below 16 is a lie on a phone. */
  /* Type sizes, and they are bigger on a phone. The same 16px caption that reads
     comfortably on a monitor at arm's length is being looked at on a screen four
     inches wide held at the same distance, and it is the size *everything*
     secondary in this interface is drawn at.

     A function rather than a constant because the panel is built once and the
     device is known by then; every call site already reads `SIZE.cap` and gets
     the right number without knowing why. */
  const TOUCH_TYPE = 1.18;
  const SIZE = {
    get cap()  { return api && api.touchOnly ? 19 : 16; },
    get val()  { return api && api.touchOnly ? 22 : 19; },
    get head() { return api && api.touchOnly ? 26 : 23; },
    get big()  { return api && api.touchOnly ? 34 : 30; },
    get huge() { return api && api.touchOnly ? 44 : 40; }
  };

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
       mark: false,
       // Armed by the PIN button; the next tap on the map places one.
       pinning: false,
       /* Which kinds of mark are turned off. An hour into a sector the chart has
          several hundred things on it and most of them are not what you are
          looking for — turning a kind off is the difference between a map and a
          record of everything that has ever happened. */
       hide: {} });
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

  /* The most cells an import may expand to. A measured twenty round trips to
     the abyss charts about 46,000, so this is twenty times the largest chart
     anybody has actually made — it exists to stop a corrupt or hostile payload
     asking for a set with a hundred million entries in it, not to limit play. */
  const MAX_FOG_CELLS = 1e6;

  /* Decoded into a temporary set and only swapped in once the whole payload has
     passed. It used to clear `fog` on the first line and fill it as it went, so
     a payload whose third run was corrupt returned `false` having already wiped
     the chart the player was looking at — the failure path destroyed the thing
     it was refusing to replace.

     The bounds are checked too. Only `len` was, so a run could name a row
     outside the lattice `cellKey` can address, and a few short runs could still
     ask for more cells than there is memory to hold. */
  HUD.importFog = function (s) {
    const runs = unpackInts(s);
    if (!runs || runs.length % 3 !== 0) return false;
    const next = new Set();
    let total = 0;
    for (let i = 0; i < runs.length; i += 3) {
      const cy = runs[i], start = runs[i + 1], len = runs[i + 2];
      if (!Number.isInteger(cy) || !Number.isInteger(start) ||
          !Number.isInteger(len) || len < 1 ||
          cy < -KEY_BASE || cy > KEY_BASE ||
          start < -KEY_BASE || start + len > KEY_BASE) {
        return false;
      }
      total += len;
      if (total > MAX_FOG_CELLS) return false;
      for (let k = 0; k < len; k++) next.add(cellKey(start + k, cy));
    }
    fog = next;
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
  /* ── the log ──────────────────────────────────────────────────────────────
     Every line the sector says scrolls past the corner of the screen and is gone.
     Look away for ten seconds and whatever happened is unrecoverable — a bad deal
     in a mode where the interesting events are things somebody else did while you
     were reading a page.

     So it is kept. Forty lines, newest first, on the ship's page where the rest
     of the run's record already lives. */
  let logLines = [];
  const LOG_KEEP = 40;
  HUD.log = () => logLines;
  HUD.logAdd = function (text, colour) {
    if (!text) return;
    const last = logLines[0];
    // The same line twice running is one line with a count on it.
    if (last && last.text === text) { last.n = (last.n || 1) + 1; return; }
    logLines.unshift({ text: String(text), colour: colour || VIOLET_DIM, n: 1 });
    if (logLines.length > LOG_KEEP) logLines.length = LOG_KEEP;
  };
  HUD.logClear = function () { logLines = []; };
  // The live stack, so a harness can see what was said rather than only what was
  // written down — the two are deliberately not the same list.
  HUD.notes = () => notes;

  HUD.notify = function (text, sub, colour, life) {
    if (!text) return;
    // Everything that is said is also written down.
    HUD.logAdd(sub ? text + " \u2014 " + sub : text, colour);
    const span = life || 5.5;
    const had = notes.find(n => n.text === text && n.sub === (sub || ""));
    if (had) { had.t = span; had.life = span; return; }
    notes.unshift({ text: String(text), sub: sub ? String(sub) : "",
                    colour: colour || VIOLET, t: span, life: span });
    /* Four at a time, and the one being *read* is never the one dropped. Blind
       truncation meant that opening a line and then having three more things
       happen took it off the bottom of the stack mid-sentence — which is the
       interface deciding you had finished with it. */
    while (notes.length > 4) {
      let cut = -1;
      for (let i = notes.length - 1; i >= 0; i--) if (!notes[i].open) { cut = i; break; }
      if (cut < 0) break;                 // all four are open: leave them alone
      notes.splice(cut, 1);
    }
  };

  HUD.logged = function (entry) {
    HUD.notify(entry.name,
               "LOGGED  " + String(entry.n || 0).padStart(2, "0") + "   " +
               (entry.of || 25), AMBER, 6);
  };

  HUD.ping = function () { pulse = 1.6; };

  /* ── type ─────────────────────────────────────────────────────────────────
     The module keeps its own text helper rather than borrowing the engine's:
     the pages want tracked-out caps for headings, and letter-spacing is worth
     having where the browser supports it. Guarded, because it is ignored
     silently on the ones that don't rather than throwing. */
  function label(str, x, y, size, colour, align, alpha, track) {
    str = String(str);
    // A money string carries the mark as a sentinel; see `markedLabel`.
    if (str.indexOf(CASH_MARK) >= 0) {
      return markedLabel(str, x, y, size, colour, align, alpha, track);
    }
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

  /* ── prose ────────────────────────────────────────────────────────────────
     `fitText` shrinks one line until it fits. This is the other case: a
     paragraph, which has to break rather than shrink, because prose at 16px on a
     phone is already at the floor and there is nowhere smaller to go.

     Greedy word wrap, and it respects the floor by simply taking as many words as
     fit — a word longer than the whole column goes on its own line and overhangs,
     which cannot happen here and would still be more readable than a word cut in
     half. */
  function wrapLines(str, size, maxW, track) {
    const words = String(str).split(" ");
    const out = [];
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (line && widthOf(next, size, track) > maxW) { out.push(line); line = word; }
      else line = next;
    }
    if (line) out.push(line);
    return out;
  }

  /* ── money ────────────────────────────────────────────────────────────────
     Every number in this interface that is cash is marked as cash. There were four
     different conventions — a bare number, a number with CASH after it, a number
     with "cash" after it, and a number with nothing at all — so on any given page
     you had to work out from context whether 1,450 was a price, a distance, a
     count of rounds or a number of seconds. A currency mark answers that before
     you have finished reading the number.

     Grouped, too: 3600 and 36000 are the same shape at a glance, and 3,600 and
     36,000 are not — and the difference between them is most of a run.

     The mark is *drawn*, not typed. A character would have to exist in whatever
     monospace font the browser picked, and the failure mode when it does not is a
     hollow box — which is very nearly the mark itself, which is the worst possible
     way to be wrong. So the string carries a sentinel codepoint that is never
     rendered as text, and `label` swaps it for a path: a box with a C in it and a
     line struck through. One glyph, the same everywhere, at any size, in any font,
     including the one line of chatter that says what something cost. */
  const CASH_MARK = "¤";
  const money = n => CASH_MARK + Math.round(Number(n) || 0).toLocaleString("en-US");
  // How wide the mark is at a given type size, gap included.
  const markWidth = px => px * 0.82 + px * 0.14;

  function cashGlyph(x, y, size, colour, alpha) {
    const ctx = api.ctx;
    const s = size * 0.82;
    const top = y - s * 0.9;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.lineJoin = "miter";
    // The box.
    ctx.beginPath();
    ctx.rect(x + s * 0.05, top, s * 0.9, s * 0.9);
    ctx.stroke();
    // The C inside it — an arc with its opening on the right.
    ctx.beginPath();
    ctx.arc(x + s * 0.52, top + s * 0.45, s * 0.24, 0.7, -0.7);
    ctx.stroke();
    // And struck through, corner to corner.
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, top + s * 0.74);
    ctx.lineTo(x + s * 0.78, top + s * 0.16);
    ctx.stroke();
    ctx.restore();
  }

  /* A line with money in it: the text either side, and the mark drawn in the gap.
     Alignment is computed from the whole assembled width, which is why the mark
     cannot simply be a prefix somebody draws first — a right-aligned price has to
     know how wide its own mark is before it knows where to start. */
  function markedLabel(str, x, y, size, colour, align, alpha, track) {
    const px = Math.max(16, size);
    const gw = markWidth(px);
    const parts = str.split(CASH_MARK);
    const widths = parts.map(piece => (piece ? widthOf(piece, px, track) : 0));
    const total = widths.reduce((a, b) => a + b, 0) + gw * (parts.length - 1);
    let left = align === "right" ? x - total
             : align === "center" ? x - total / 2 : x;
    parts.forEach((piece, i) => {
      if (i) { cashGlyph(left, y, px, colour, alpha); left += gw; }
      if (piece) {
        label(piece, left, y, px, colour, "left", alpha, track);
        left += widths[i];
      }
    });
  }

  function widthOf(str, size, track) {
    const ctx = api.ctx;
    // The mark is a drawn box, not a character: measure it as one.
    if (str.indexOf(CASH_MARK) >= 0) {
      const parts = String(str).split(CASH_MARK);
      const px = Math.max(16, size);
      return parts.reduce((w, p) => w + (p ? widthOf(p, size, track) : 0), 0) +
             markWidth(px) * (parts.length - 1);
    }
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
    /* First row of content, clear of the navigation strip *and* the title rule
       under it. The strip used to be along the bottom, which on a phone is where
       a thumb rests and where the system gesture bar lives — you cannot put the
       way between pages under the operating system's own swipe. It is along the
       top now, so this moved down by sixteen and the whole of the old footer came
       back as content room. */
    TOP: 112,
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
  /* How solid a page's ground is. The pages the world keeps running behind get
     the world drawn under them, so their ground is very nearly opaque rather than
     opaque: enough to read type on, thin enough that a rock coming at you or a
     star you are drifting into shows through. The pages that stop the clock have
     nothing behind them and stay solid. */
  HUD.pageGhost = false;

  /* ── where a tap is allowed to land ───────────────────────────────────────
     A scrolling list clips its *drawing* to its own window, and until now nothing
     clipped its *taps*. A row scrolled up under the page heading was invisible
     and still pressable — which is the worst kind of control, because nothing
     about the screen says it is there.

     So every rectangle in this module goes through `tap`, and a page that scrolls
     sets a window first. Outside it the rectangle is dropped; straddling it, the
     rectangle is trimmed to the part you can actually see. */
  let tapWindow = null;
  const tapClip = r => { tapWindow = r; };
  const tapClipOff = () => { tapWindow = null; };

  function tap(rect) {
    if (tapWindow) {
      const y0 = Math.max(rect.y, tapWindow.y);
      const y1 = Math.min(rect.y + rect.h, tapWindow.y + tapWindow.h);
      const x0 = Math.max(rect.x, tapWindow.x);
      const x1 = Math.min(rect.x + rect.w, tapWindow.x + tapWindow.w);
      if (y1 - y0 < 6 || x1 - x0 < 6) return;     // nothing worth pressing
      rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, act: rect.act,
               card: rect.card, note: rect.note, hold: rect.hold };
    }
    api.addTap(rect);
  }

  /* ── two kinds of page ────────────────────────────────────────────────────
     A shop and a shipyard are somewhere you docked at. Your hold, your bench,
     your jobs and your chart are aboard the thing you flew there in. They were
     identical furniture, so a page about your own ship and a page about
     somebody else's shop could only be told apart by reading the title.

     They take different accents now, and the palette already had the right
     answer in it: Survey's violet is the mode — out there, somewhere you
     arrived — and Crossfire's amber is the chrome, which is yours. Violet is a
     place. Amber is your ship. */
  /* The station's own rooms. `stationinv` is the inventory wearing the shop's
     frame and `wormhole` is the gate's map; both are places you are standing in
     rather than pages about your ship, which is why they belong on this strip
     and not on the amber one. See `HUD.drawStationInv`. */
  const PLACE_TABS = ["refit", "hangar", "stationinv", "wormhole"];
  const SHIP_TABS  = ["ship", "inventory", "record", "craft", "chart"];
  const SHIP_TONE  = { bright: AMBER, dim: AMBER_DIM, low: RULE };
  const PLACE_TONE = { bright: VIOLET, dim: VIOLET_DIM, low: VIOLET_LOW };

  /* ── a page inside a page ─────────────────────────────────────────────────
     H1: "a browser inside a browser". The inventory pages are drawn whole —
     each paints its own ground, title, rule, navigation strip and close button —
     and the station wants the *body* of one under its own frame with a second
     row of tabs where BUY and SELL sit.

     Rather than fork five pages into embedded twins, or thread a flag through
     every one of them, the three things that draw a page's *furniture* check
     one counter and do nothing while it is up. The station raises it, pushes
     `PAGE.TOP` down by the height of its extra row, and calls the ordinary
     draw function — which lays itself out against the room it is given and
     otherwise cannot tell the difference. That is the "share rather than fork"
     the list asked for: there is exactly one inventory page and one copy of
     every rule in it.

     A counter rather than a flag so a page that ever embedded another could not
     half-unset it on the way back out. */
  let embedded = 0;
  const EMBED_BUMP = 44;

  function pageFrame(title, sub, footer, tone) {
    if (embedded) return;
    tone = tone || PLACE_TONE;
    const { ctx, SCREEN_W, SCREEN_H } = api;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.globalAlpha = HUD.pageGhost ? 0.88 : 1;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.restore();

    // Under the navigation strip: the title says where you are, and the strip
    // above it is how you leave.
    label(title, 34, 84, SIZE.head, tone.bright, "left", 1, "0.22em");
    if (sub) label(sub, SCREEN_W - 34, 84, SIZE.cap, tone.dim, "right", 0.7);

    ctx.save();
    ctx.strokeStyle = tone.low;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(34, 96); ctx.lineTo(SCREEN_W - 34, 96);
    ctx.stroke();
    ctx.restore();

    if (footer) label(footer, 34, SCREEN_H - 30, SIZE.cap, tone.dim, "left", 0.75);
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
  // Along the top. See `PAGE.TOP`.
  const NAV_Y = () => 32;

  function pageNav(st, here, only, tone) {
    if (embedded) return;
    tone = tone || PLACE_TONE;
    const { SCREEN_W, SCREEN_H } = api;
    /* Three, and it used to be six. The strip is for the pages you carry with
       you — the bench, the jobs and the chart are yours wherever you are, and
       they belong on every page because there is no other way to reach them on
       a phone.

       A *place* is not one of those. The station is somewhere you flew to and
       docked at, and your ship's hold is somewhere you are standing; putting
       them a tab apart made the station feel like a page of your ship rather
       than a place you had arrived at. They come off the strip, and each keeps
       the way in it already had:

         STATION  docking — `E`, or "DOCKED — TAP TO REFIT" on a phone
         SHIP     `I` or `G`, or the INVENTORY button on the flight panel
         SHIPS    a row in the home station's own market, where a hull is a
                  thing you buy rather than a page you visit

       So nothing became unreachable by thumb, which is the only reason the
       strip exists at all. */
    const all = [
      { key: "refit",     name: "SHOP",     live: !!(st.docked || st.landed),
        act: st.onStation },
      { key: "hangar",    name: "SHIPS",    live: !!st.atHome, act: st.onHangar },
      /* The station's own copy of the inventory, and the gate's map. Both are
         live only where you are standing in the place that has them: the
         inventory needs a counter to stand at, and a mouth needs a mooring at
         both ends. The wormhole tab does not exist at all until the gate is
         built — a door to a thing you have not made is not navigation. */
      { key: "stationinv", name: "INVENTORY",
        live: !!(st.docked || st.landed), act: st.onStationInv },
      { key: "wormhole",  name: "WORMHOLE", live: !!(st.wormhole && st.docked),
        act: st.onWormhole, gone: !st.wormhole },
      /* Two pages, because they are two jobs. The ship is what you are flying
         and what is bolted to it; the cargo is everything that is merely inside
         it. They were one page called INVENTORY that did both and named one. */
      { key: "ship",      name: "SHIP",     live: true, act: st.onShip },
      { key: "inventory", name: "CARGO",    live: true, act: st.onInventory },
      { key: "record",    name: "RECORD",   live: true, act: st.onRecord },
      { key: "craft",     name: "CRAFTING", live: true, act: st.onCraftPage },
      { key: "missions",  name: "MISSIONS", live: true, act: st.onMissions },
      { key: "chart",     name: "MAP",      live: true, act: st.onChart }
    ];
    /* `only` narrows the strip for a page that should not be offering all of it.
       The shop is the one that should not: a jobs board and a star chart are
       things you read on your own ship, not things the counter you are standing
       at hands you — and a place with three doors out of it stops feeling like
       somewhere you went to. */
    const tabs = (only ? all.filter(t => only.indexOf(t.key) >= 0) : all)
      .filter(t => !t.gone);
    if (!tabs.length) return;
    const gap = api.touchOnly ? 5 : 7;
    const span = SCREEN_W - PAGE.EDGE * 2 - NAV_CLOSE_W - 16;
    /* Capped, so a short strip is a row of buttons and not one banner stretched
       across the page. At three it divides to 250 and the cap changes nothing;
       at one it is still a button. */
    const w = Math.min(250,
      Math.floor((span - gap * (tabs.length - 1)) / tabs.length));
    tabs.forEach((t, i) => {
      const cx = PAGE.EDGE + w / 2 + i * (w + gap);
      const on = t.key === here;
      // Six tabs across a phone is the tightest row in the game; it gets the
      // height back that the width cannot give it.
      /* `live` stays true on the tab you are standing on. In `button` it means
         "enabled", not "pressable" — passing `!on` drew the current page with a
         disabled fill and half-strength type, so the page you were *not* on came
         out brighter than the one you were. It hid while the strip had three
         similar tabs; with two it is the first thing you see. */
      button(t.name, cx, NAV_Y(), w, api.touchOnly ? 46 : 38,
             on ? tone.bright : t.live ? tone.dim : tone.low,
             on || !t.live ? null : t.act, on, on || t.live, "0.04em");
    });
  }

  function closeButton(act, tone) {
    if (embedded) return;
    const { SCREEN_W, SCREEN_H } = api;
    /* "CLOSE", both platforms. It was "CLOSE  [ESC]" on a desk, and 150 wide
       leaves `fitText` 132 to say it in — the label needs about 138, so every
       page in the mode carried "CLOSE  [ES…" in the top right. The key still
       works; it just does not need announcing on a button that says what it
       does. */
    button("CLOSE",
           SCREEN_W - PAGE.EDGE - NAV_CLOSE_W / 2, NAV_Y(),
           NAV_CLOSE_W, 38, (tone || PLACE_TONE).bright, act);
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

    if (st.atYard) {
      ctx.save();
      ctx.strokeStyle = CASH;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, iy + 36, b.w, 30);
      ctx.restore();
      label(api.touchOnly ? "JUMP GATE" : "JUMP GATE  [E]", b.x + b.w / 2, iy + 56,
            SIZE.cap, CASH, "center", 1, "0.12em");
      tap({ x: b.x, y: iy + 36, w: b.w, h: 30, act: st.onYard || (() => {}) });
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
    boss:      { name: "BOSS",     colour: "#ff4dd2" }
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
      label("JUMP GATE  " + st.yard.built + "/" + st.yard.needs,
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
    label(money(st.cash), 24, 62, SIZE.head, CASH, "left");

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
      drawDevices(st, right, y - 8 - bh / 2 - 22);
    } else {
      drawDevices(st, SCREEN_W - PAGE.EDGE - 6, SCREEN_H - 26);
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
        ctx.strokeStyle = CASH;
        ctx.globalAlpha = beat;
        ctx.lineWidth = 2;
        ctx.setLineDash && ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash && ctx.setLineDash([]);
        ctx.restore();
        label(api.touchOnly ? "TAP TO DOCK" : "DOCK  [E]", px, py + rr + 20,
              SIZE.cap, CASH, "center", 0.9, "0.1em");
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
            cx, y - 54, SIZE.val, CASH, "center", beat, "0.1em");
      promptTap(st.onRefit);
    } else if (st.landed) {
      // Somebody lives on the thing you are resting against, and they will sell
      // you water. Named, because the name is the point of naming them.
      const beat = 0.6 + 0.4 * Math.sin(clockish() * 4);
      fitText(st.landed.name + (api.touchOnly ? " — TAP TO TRADE" : " — [E] TRADE"),
              cx, y - 54, SIZE.val, st.landed.colour || CASH, "center", beat,
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
  function drawDevices(st, right, y) {
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
    /* Below the chart, the region readout, the inventory button and the yard
       button, whichever are there. The 52 is the button's own top — it moved down
       when the region line took a row above it, and this has to move with it or
       the first notification's target sits on top of the button's. */
    let y = b.y + b.h + 52 + 30 + (st && st.atYard ? 36 : 0) + 34;
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
  /* The zoom ladder, and it has to reach as far as the sector does. The widest
     step was 0.00145, which shows about 690,000 units across — fine when the
     furthest landmark stood at 112,000 and useless now that the ladder runs to
     three and a half million and worlds are generated past seven. A chart that
     cannot be zoomed out far enough to contain the thing it is charting is not a
     chart of it.

     Six more steps at the wide end, each half the last, so the widest shows about
     forty million units. That is deliberately more than the sector needs: a
     world's distance is stretched by its sector's own `spread`, which runs to
     2.1, so the furthest landmark in the widest seed measured lands past seven
     million and the chart has to hold all of it with room to spare. */
  const ZOOMS = [0.000025, 0.00005, 0.0001, 0.0002, 0.0004, 0.0008,
                 0.00145, 0.0029, 0.0058, 0.0116, 0.0232,
                 0.0464, 0.0696, 0.0928, 0.12];


  /* A name long enough to be useful is too long to write across a chart, so it
     is cut to something that still reads as the same place. Word-wise first —
     "THE IRIDIUM FIELD" becomes "THE IRIDIUM…" rather than "THE IRIDIU…" —
     because a cut on a word boundary is a name and a cut mid-word is a typo. */
  function shortName(name, max) {
    const n = String(name || "").trim();
    if (n.length <= max) return n;
    const cut = n.slice(0, max);
    const sp = cut.lastIndexOf(" ");
    return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[ ,.:;-]+$/, "") + "…";
  }

  function drawPins(st, mx, my, big) {
    const { ctx } = api;
    for (const q of (st.pins || [])) {
      const spec = pinSpec(q.kind);
      const colour = q.colour || spec.colour;
      const x = mx(q.x), y = my(q.y);
      const r = big ? 7 : 4;
      ctx.save();
      ctx.strokeStyle = colour;
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
      /* **Its own name, or nothing.** It used to draw the name of its *kind* —
         and the first kind in the list is called CASH, so every pin anybody ever
         dropped said CASH on the chart, including the ones they had carefully
         typed a name into. A kind is not a label: a pin you did not name is a
         mark, and a mark with a word under it that you did not choose is worse
         than a mark with no word under it. */
      if (big && q.name) {
        label(shortName(q.name, 14), x, y + r * 3.4, SIZE.cap, colour,
              "center", 0.9);
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
  // How many units the chart is showing across, for anything checking that the
  // map can contain the sector it is a map of.
  /* How wide the *map* is, in units. It used to answer for the whole screen,
     which the map is not: the rail takes a quarter of it. The rail's own
     readout is drawn from this, so it was claiming a third more sky than it
     was showing, and disagreeing with the scale bar underneath it. */
  HUD.chartSpan = () => (chart.view ? chart.view.w : api.SCREEN_W) / chart.scale;

  HUD.chartZoomBy = function (dir) { zoomChart(dir); };
  /* By a factor, about a point on the screen: the wheel and a pinch. The
     buttons and keys step the ladder, which is right for a press; a wheel
     stepping the ladder once per event was not. A trackpad sends dozens of
     events in one flick, so one flick went from the widest view to the
     closest, and a sideways scroll (no vertical movement at all) counted as
     "in". Now it is as far as you turned it, and the point under the pointer
     stays under the pointer, which is what every other map does. */
  HUD.chartZoomAt = function (factor, sx, sy) {
    if (!(factor > 0) || factor === 1) return;
    const old = chart.scale;
    const next = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], old * factor));
    if (next === old) return;
    const v = chart.view;
    if (v && sx != null && sy != null) {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      const wx = chart.x + (sx - cx) / old, wy = chart.y + (sy - cy) / old;
      chart.x = wx - (sx - cx) / next;
      chart.y = wy - (sy - cy) / next;
      if (Math.abs(sx - cx) > 4 || Math.abs(sy - cy) > 4) chart.follow = false;
    }
    chart.scale = next;
  };
  HUD.chartView = () => ({ x: Math.round(chart.x), y: Math.round(chart.y),
                           scale: chart.scale, follow: chart.follow,
                           steps: ZOOMS.length,
                           // The map's own rectangle, so a harness can ask
                           // where on the screen a piece of sky is drawn.
                           view: chart.view ? { ...chart.view } : null });
  // Arming the pin tool, which the rail's button does by hand.
  HUD.chartPinArm = on => { chart.pinning = !!on; if (chart.pinning) chart.jump = false; };
  HUD.chartPinArmed = () => !!chart.pinning;

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

  /* ── borders you have mapped ──────────────────────────────────────────────
     Territory and biomes, drawn only over the region cells in `terrain.mapped`
     — the cells you flew through, and the patches a scan charted. A cell is a
     jittered Voronoi cell on the region lattice, so its outline is worked out
     once by clipping a square against the bisectors of its neighbours, and each
     edge remembers which neighbour made it. That is what lets a border be
     drawn exactly where two *different* recorded cells meet and nowhere else.

     Territory is a faint wash in its holder's colour with a solid line at its
     edge. A biome border is a dashed line, lighter, over the top. Names sit on
     one cell of each patch once the chart is close enough to read them. */
  const cellShapes = new Map();
  let cellShapesSeed = null;
  function cellShape(T, cx, cy) {
    const key = cx + "," + cy;
    let shape = cellShapes.get(key);
    if (shape) return shape;
    const s0 = T.site(cx, cy);
    const R = T.cell * 2;
    let pts = [[s0.x - R, s0.y - R], [s0.x + R, s0.y - R],
               [s0.x + R, s0.y + R], [s0.x - R, s0.y + R]];
    let labs = [null, null, null, null];
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        if (!i && !j) continue;
        const n = T.site(cx + i, cy + j);
        const nx = n.x - s0.x, ny = n.y - s0.y;
        const mxw = (n.x + s0.x) / 2, myw = (n.y + s0.y) / 2;
        const inside = p => (p[0] - mxw) * nx + (p[1] - myw) * ny <= 0;
        const nk = (cx + i) + "," + (cy + j);
        const outP = [], outL = [];
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k], b = pts[(k + 1) % pts.length];
          const ia = inside(a), ib = inside(b);
          const cut = () => {
            const da = (a[0] - mxw) * nx + (a[1] - myw) * ny;
            const db = (b[0] - mxw) * nx + (b[1] - myw) * ny;
            const t = da / (da - db);
            return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          };
          if (ia && ib) { outP.push(a); outL.push(labs[k]); }
          else if (ia && !ib) { outP.push(a); outL.push(labs[k]); outP.push(cut()); outL.push(nk); }
          else if (!ia && ib) { outP.push(cut()); outL.push(labs[k]); }
        }
        pts = outP; labs = outL;
      }
    }
    shape = { pts, labs, x: s0.x, y: s0.y };
    if (cellShapes.size > 12000) cellShapes.clear();
    cellShapes.set(key, shape);
    return shape;
  }

  function drawTerrain(st, view, mx, my) {
    const T = st.terrain;
    if (!T || !T.mapped || !T.mapped.size) return;
    const { ctx } = api;
    if (cellShapesSeed !== st.seed) { cellShapes.clear(); cellShapesSeed = st.seed; }
    const reach = T.cell * 1.5;
    const vis = (x, y) => mx(x + reach) >= view.x && mx(x - reach) <= view.x + view.w &&
                          my(y + reach) >= view.y && my(y - reach) <= view.y + view.h;
    const cellPx = T.cell * chart.scale;
    /* Biomes change from one cell to the next far more often than owners do,
       so their dashed edges only come in once a cell is big enough on screen
       to be a place rather than a speck — zoomed out, the map is territory. */
    const biomeAlpha = Math.max(0, Math.min(0.6, (cellPx - 28) / 60));
    const todo = [];
    for (const [key, rec] of T.mapped) {
      const comma = key.indexOf(",");
      const cx = +key.slice(0, comma), cy = +key.slice(comma + 1);
      const s0 = T.site(cx, cy);
      if (!vis(s0.x, s0.y)) continue;
      todo.push({ key, rec, cx, cy, shape: cellShape(T, cx, cy) });
    }
    const path = sh => {
      ctx.beginPath();
      sh.pts.forEach((p, i) => (i ? ctx.lineTo(mx(p[0]), my(p[1]))
                                  : ctx.moveTo(mx(p[0]), my(p[1]))));
      ctx.closePath();
    };

    ctx.save();
    // The wash. The Void is a darkening rather than a colour: it is an absence.
    for (const c of todo) {
      const h = T.holder(c.rec.o);
      if (!h) continue;
      path(c.shape);
      ctx.globalAlpha = c.rec.o === "void" ? 0.45 : h.power ? 0.13 : 0.08;
      ctx.fillStyle = c.rec.o === "void" ? "#000000" : h.colour;
      ctx.fill();
    }
    // Edges. Each shared edge is drawn once, from the lower key.
    for (const c of todo) {
      const h = T.holder(c.rec.o);
      const b = T.biome(c.rec.r);
      const pts = c.shape.pts;
      for (let k = 0; k < pts.length; k++) {
        const nk = c.shape.labs[k];
        if (!nk) continue;
        const other = T.mapped.get(nk);
        if (!other || nk < c.key) continue;
        const a = pts[k], e = pts[(k + 1) % pts.length];
        if (other.o !== c.rec.o && h) {
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 2;
          ctx.strokeStyle = h.power ? h.colour : (T.holder(other.o) || h).colour;
          ctx.beginPath(); ctx.moveTo(mx(a[0]), my(a[1])); ctx.lineTo(mx(e[0]), my(e[1]));
          ctx.stroke();
        }
        if (other.r !== c.rec.r && b && biomeAlpha > 0) {
          ctx.setLineDash([6, 5]);
          ctx.globalAlpha = biomeAlpha;
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = b.colour;
          ctx.beginPath(); ctx.moveTo(mx(a[0]), my(a[1])); ctx.lineTo(mx(e[0]), my(e[1]));
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
    ctx.restore();

    /* Names, once per patch, on the cell nearest the patch's middle. Patches
       are the mapped cells joined to a neighbour with the same answer, worked
       out again only when the record changes. Territory is named as soon as a
       patch is a few cells big on screen; a biome only once you are close. */
    /* And a name only where there is room for it. Nothing checked, so zoomed
       out the names of every small patch landed on top of each other: at one
       step a single frame wrote THE MURK four times and three other names three
       times each, most of them over something else. Biggest patch first, and
       a name that would touch one already written is left off until you zoom
       in far enough to separate them. */
    const groups = patchesOf(T, st.seed);
    const taken = [];
    const fits = (text, x, y) => {
      const w = String(text).length * SIZE.cap * 0.72 + 10, h = SIZE.cap + 6;
      const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y + 4 };
      for (const b of taken) {
        if (box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0) return false;
      }
      taken.push(box);
      return true;
    };
    ctx.save();
    for (const g of groups.o.slice().sort((a, b) => b.n - a.n)) {
      if (cellPx * Math.sqrt(g.n) < 90) continue;
      const h = T.holder(g.v);
      if (!h || !vis(g.x, g.y)) continue;
      if (!fits(h.name, mx(g.x), my(g.y))) continue;
      label(h.name, mx(g.x), my(g.y), SIZE.cap, h.colour, "center",
            g.v === "void" ? 0.55 : 0.85, "0.14em");
    }
    if (cellPx >= 60) {
      for (const g of groups.r.slice().sort((a, b) => b.n - a.n)) {
        const b = T.biome(g.v);
        if (!b || !vis(g.x, g.y)) continue;
        if (!fits(b.name, mx(g.x), my(g.y) + 18)) continue;
        label(b.name, mx(g.x), my(g.y) + 18, SIZE.cap, b.colour, "center", 0.6,
              "0.08em");
      }
    }
    ctx.restore();
  }

  let patchCache = null;
  function patchesOf(T, seed) {
    const stamp = seed + ":" + T.mapped.size + ":" + T.mappedStamp;
    if (patchCache && patchCache.stamp === stamp) return patchCache;
    const cells = [];
    for (const [key, rec] of T.mapped) {
      const comma = key.indexOf(",");
      cells.push({ key, rec, cx: +key.slice(0, comma), cy: +key.slice(comma + 1) });
    }
    const group = field => {
      const done = new Set(), out = [];
      for (const c of cells) {
        if (done.has(c.key)) continue;
        const v = c.rec[field], members = [];
        const queue = [c];
        done.add(c.key);
        while (queue.length) {
          const q = queue.pop();
          members.push(q);
          for (let j = -1; j <= 1; j++) {
            for (let i = -1; i <= 1; i++) {
              const k = (q.cx + i) + "," + (q.cy + j);
              if (done.has(k)) continue;
              const r = T.mapped.get(k);
              if (!r || r[field] !== v) continue;
              done.add(k);
              queue.push({ key: k, rec: r, cx: q.cx + i, cy: q.cy + j });
            }
          }
        }
        // The member whose site is closest to the patch's own middle.
        let sx = 0, sy = 0;
        const sites = members.map(m => T.site(m.cx, m.cy));
        for (const p of sites) { sx += p.x; sy += p.y; }
        sx /= sites.length; sy /= sites.length;
        let best = sites[0], bd = Infinity;
        for (const p of sites) {
          const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
        out.push({ v, n: members.length, x: best.x, y: best.y });
      }
      return out;
    };
    patchCache = { stamp, o: group("o"), r: group("r") };
    return patchCache;
  }

  HUD.drawChart = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    if (chart.follow && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }

    const span = SCREEN_W / chart.scale;
    pageFrame("SECTOR MAP",
              "SEED " + (st.seed || 0) +
              (st.world ? "  ·  " + st.world.name : "") +
              "  ·  " + fmtCells(HUD.charted()) + " CELLS CHARTED",
              undefined, SHIP_TONE,
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
    /* The map gives up a column on the right rather than a band at the bottom.
       Everything that decides *what the map does* lives in it — the filters, the
       two things you can place, the zoom — which is the difference between a map
       with controls and a map with a control panel underneath it that you have to
       look away from the map to read.

       It also means the map is as tall as the page, which on a phone held
       sideways is the whole of the screen. */
    const railW = Math.min(230, Math.max(170, SCREEN_W * 0.17));
    const view = { x: PAGE.EDGE, y: PAGE.TOP,
                   w: SCREEN_W - PAGE.EDGE * 2 - railW - PAGE.GUTTER,
                   h: SCREEN_H - PAGE.TOP - 26 };
    const rail = { x: view.x + view.w + PAGE.GUTTER, w: railW };
    // Kept, so a wheel or a pinch can zoom about the point under it.
    chart.view = view;
    const mx = wx => view.x + view.w / 2 + (wx - chart.x) * chart.scale;
    const my = wy => view.y + view.h / 2 + (wy - chart.y) * chart.scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();

    ctx.fillStyle = "#07070e";
    /* Not quite opaque, so the sector shows through the map the way it shows
       through every other page. A chart you cannot see past is still a screen you
       can drift into a star behind. */
    ctx.globalAlpha = HUD.pageGhost ? 0.86 : 1;
    ctx.fillRect(view.x, view.y, view.w, view.h);
    ctx.globalAlpha = 1;

    /* The chart used to draw no regions at all — BIOMES.md kept biomes off it.
       Ric reversed that: it draws the territory and biome borders you have
       mapped, and only those. See `drawTerrain`. Pins are still how you name a
       place yourself. */
    drawChartGrid(view, mx, my);
    paintFog(mx, my, chart.x, chart.y, span, chart.scale, chart.scale, 0.26);
    drawTerrain(st, view, mx, my);
    paintMarks(st, mx, my, true, chart.scale);
    paintEchoes(st, mx, my, true);
    drawPins(st, mx, my, true);
    /* What you are watching, and a flash when you pick it. A tap that changes
       something off in the corner of a map is a tap you are not sure landed; a
       ring that blooms where your finger went is the map saying yes. */
    if (st.selected) {
      const sx2 = mx(st.selected.x), sy2 = my(st.selected.y);
      const f = st.selectFlash || 0;
      ctx.save();
      ctx.strokeStyle = OBJECTIVE;
      ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(clockish() * 3));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx2, sy2, 13, 0, Math.PI * 2);
      ctx.stroke();
      if (f > 0) {
        ctx.globalAlpha = f * 0.8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx2, sy2, 13 + (1 - f) * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      label(shortName(st.selected.name || "", 16), sx2, sy2 - 22, SIZE.cap,
            OBJECTIVE, "center", 0.9);
    }

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

    tap({
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

    /* ── the rail ──────────────────────────────────────────────────────────
       What the map does, beside the map. */
    let ry = view.y;

    // What the next tap will leave, said once and in the colour of the thing.
    const verb = api.touchOnly ? "TAP" : "CLICK";
    const armed = chart.jump ? "jump" : chart.pinning ? "pin" : "";
    /* Wrapped to the rail rather than written across the map. These lines got
       longer when the pin gained a second meaning, and a `label` does not know
       how wide its column is — on a phone they ran clean off the right-hand edge
       of the screen. */
    const says = armed === "jump" ? verb + " A STATION"
               : armed === "pin"  ? verb + " ANYWHERE, OR A PIN TO REMOVE IT"
               : verb + " SOMETHING TO WATCH";
    const saysCol = armed === "jump" ? CASH
                  : armed === "pin" ? VIOLET : VIOLET_LOW;
    const saysLines = wrapLines(says, SIZE.cap, rail.w, "0.06em");
    saysLines.slice(0, 2).forEach((line, i) => {
      label(line, rail.x, ry + 6 + i * 18, SIZE.cap, saysCol, "left", 0.85,
            "0.06em");
    });
    ry += 20 + (saysLines.length > 1 ? 18 : 0);

    /* ── the one thing you place ─────────────────────────────────────────────
       There were two. The waypoint is gone, and it went because the thing that
       replaced it is strictly better at the same job: **tap anything on the chart
       and the ship points at it.** A waypoint was a coordinate you had to place
       by hand at a spot you were trying to hit by eye — you could not put one
       *on* a station, or a well, or a memorial, because the gesture had no idea
       what was under your finger. Selecting does, so the arrow on the flight
       screen is aimed at the thing rather than at somewhere near it, and it can
       carry the thing's name.

       A pin is the other half and does the other job: the waypoint could not be
       named, kept, coloured, or have a second one. */
    button(chart.pinning ? "CANCEL" : "PIN  ▸",
           rail.x + rail.w / 2, ry + 19, rail.w, 38,
           chart.pinning ? WARN : VIOLET,
           () => { chart.pinning = !chart.pinning; chart.jump = false; },
           chart.pinning);
    ry += 46;

    /* The colour used to be six swatches here, chosen *before* you placed
       anything — which is deciding what a mark will mean before you have seen
       where it is going, and on a phone it mostly meant every pin came out the
       first colour in the list. The prompt that opens when you place one asks
       for the colour and the name together, at the moment you know both. */
    if (canJump) {
      button(chart.jump ? "CANCEL" : "WORMHOLE  \u25b8",
             rail.x + rail.w / 2, ry + 19, rail.w, 38,
             chart.jump ? WARN : CASH,
             () => { chart.jump = !chart.jump; chart.pinning = false; },
             chart.jump);
      ry += 46;
    }

    /* ── the filters ───────────────────────────────────────────────────────
       An hour into a sector the chart has several hundred things on it and most
       of them are not what you are looking for. Turning a kind off is the
       difference between a map and a record of everything that has ever happened.

       One row per kind, in the kind's own colour and with its own glyph, so the
       list and the map say the same thing. */
    ry += 6;
    const kinds = Object.keys(CHART_MARKS);
    const filtH = PAGE.HEAD + kinds.length * 22 + 14;
    panel(rail.x, ry, rail.w, filtH, VIOLET, "SHOW", "");
    kinds.forEach((k, i) => {
      const spec = CHART_MARKS[k];
      const on = !chart.hide[k];
      const fy = ry + PAGE.HEAD + 6 + i * 22;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.3;
      ctx.strokeStyle = spec.colour;
      ctx.fillStyle = spec.colour;
      ctx.lineWidth = 1.2;
      markGlyph(ctx, k, rail.x + PAGE.PAD + 5, fy - 4, 5);
      ctx.restore();
      fitText(spec.name, rail.x + PAGE.PAD + 20, fy, SIZE.cap, spec.colour,
              "left", on ? 0.95 : 0.35, rail.w - 80, "0.04em");
      label(on ? "ON" : "OFF", rail.x + rail.w - PAGE.PAD, fy, SIZE.cap,
            on ? CASH_DIM : VIOLET_LOW, "right", on ? 0.85 : 0.5);
      tap({ x: rail.x, y: fy - 16, w: rail.w, h: 22,
            act: () => { chart.hide[k] = !chart.hide[k]; } });
    });
    ry += filtH + 8;

    /* Zoom, and how wide the view is, under the filters.

       The three of them used to be laid out against fixed offsets — the two
       zooms from the left, RECENTRE from the right — on the assumption that the
       rail was always wide enough to keep them apart. On a thousand-wide screen,
       which is most of them, the rail is 170 and it is not: RECENTRE's 112
       started at 848 and the `+` sat at 850, wholly underneath it. Tap targets
       are checked back to front, so the later rectangle won every press — you
       could not zoom the chart in at all, and nothing about the picture looked
       wrong, because both buttons drew perfectly.

       So it is measured. Three across while three fit, and RECENTRE drops to its
       own row when they do not. */
    const zoomW = 44, zoomGap = 6, recW = 112;
    const oneRow = rail.w >= 26 - zoomW / 2 + zoomW * 2 + zoomGap + recW + 12;
    button("\u2212", rail.x + 26, ry + 17, zoomW, 34, VIOLET, () => zoomChart(-1));
    button("+", rail.x + 26 + zoomW + zoomGap, ry + 17, zoomW, 34, VIOLET,
           () => zoomChart(1));
    if (oneRow) {
      button("RECENTRE", rail.x + rail.w - 62, ry + 17, recW, 34, VIOLET,
             () => HUD.chartOpened(st));
      ry += 42;
    } else {
      button("RECENTRE", rail.x + rail.w / 2, ry + 17 + 40, rail.w - 12, 34,
             VIOLET, () => HUD.chartOpened(st));
      ry += 82;
    }
    const step = ZOOMS.reduce((a, z, k) =>
      Math.abs(Math.log(z / chart.scale)) < Math.abs(Math.log(ZOOMS[a] / chart.scale))
        ? k : a, 0);
    /* Two facts, so two labels — one from each end of the rail. As one string
       fitted to 170 pixels it came out as "21.6K ACROSS · …", which drops the
       half a reader actually wants: which of the five steps they are on. */
    fitText(fmtCells(Math.round(view.w / chart.scale)) + " ACROSS",
            rail.x, ry + 20, SIZE.cap, VIOLET_DIM, "left", 0.7, rail.w - 46);
    label((step + 1) + "/" + ZOOMS.length, rail.x + rail.w - PAGE.PAD, ry + 20,
          SIZE.cap, VIOLET_DIM, "right", 0.7);

    pageNav(st, "chart", SHIP_TABS, SHIP_TONE);
    closeButton(st.onClose || (() => {}));
  };

  /* What a press on the map means, in world coordinates. A function rather
     than a closure inside the tap so the harness can drive the same body the
     pointer does — the jump was unreachable for a release precisely because
     nothing but a pointer could ever have reached it. */
  HUD.chartTapAt = function (st, wx, wy, snap) {
    if (chart.jump) { jumpNear(st, wx, wy, snap); return; }

    /* ── the whole of pinning, in one order ──────────────────────────────────
       Arm with PIN. The next tap on the map either lands on a pin you already
       have — in which case it asks whether to remove it, and takes a check mark
       for an answer — or it is somewhere new, and the prompt that opens asks for
       a name and a colour before anything is placed.

       Removal used to happen on *any* tap that landed near a pin, armed or not,
       which is an eraser you cannot switch off: panning a crowded map with a
       finger deleted your own marks, silently, with nothing to undo it. Now it
       takes arming the tool and then confirming, which is two deliberate acts for
       the one operation in the mode that destroys something you made. */
    if (chart.pinning) {
      chart.pinning = false;
      if (st && st.onPinNear && st.onPinNear(wx, wy, snap)) return;
      if (st && st.onPin) st.onPin(wx, wy, PIN_KINDS[chart.pin].key, snap);
      return;
    }
    if (!chart.pinning) {
      /* Nothing armed and no pin under the finger: you are pointing at something
         charted. Keeping an eye on it is the other thing that earns a permanent
         arrow, and it is the natural meaning of tapping a mark on a map. */
      if (st && st.onSelect) st.onSelect(wx, wy, snap);
      return;
    }
  };
  // The palette, so the engine can stamp a pin with its colour when it is made.
  HUD.pinKinds = () => PIN_KINDS.map(k => ({ ...k }));
  HUD.chartPinKind = i => { if (i >= 0 && i < PIN_KINDS.length) chart.pin = i; };
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
    label("SECTOR " + cx + ", " + cy, view.x + view.w - 16, view.y + 24,
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
          on ? CASH : VIOLET_LOW, "center", 0.8, "0.18em");

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
      case "shipwright":
        /* An anvil, more or less: raw stock going in on the left and a finished
           shape coming out, over a bench. The one picture in here that is about
           making rather than finding. */
        stroke(CASH, 1.7, () => {
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

  /* A shop opens on whichever half you need, not on whichever you left it on
     last time. Called wherever a shop is entered — a station or a world. */
  HUD.shopOpened = function () {
    shopTab = null; mkt.scroll = 0;
    sellQty = {}; sellEdit = null; sellPick = {};
    buyQty = {}; buyPick = {}; buyOpen = {};
  };
  HUD.refitOpened = function () { refit.pick = 0; HUD.shopOpened(); };

  /* The keyboard on the market page. It walks the shop's own list — there used
     to be a separate array of upgrade tiers for the arrows to walk,
     and the tiers are gone, so the arrows walk the thing that is actually on the
     screen. */
  HUD.refitKey = function (code, st) {
    const rows = (st && st.market) || [];
    if (code === "KeyS") { if (st && st.onSell) st.onSell(); return true; }
    if (!rows.length) return false;
    if (code === "ArrowUp")        refit.pick = (refit.pick + rows.length - 1) % rows.length;
    else if (code === "ArrowDown") refit.pick = (refit.pick + 1) % rows.length;
    else if (code === "Enter" || code === "Space") {
      const row = rows[refit.pick];
      if (row && st.onBuyRow) st.onBuyRow(row.kind, row.key, row.frac);
    } else return false;
    return true;
  };

  /* ═══ THE MARKET ══════════════════════════════════════════════════════════
     A station is a shop, so it looks like one. It was four panels — a sell strip,
     a supplies row, a refit column and a column of almanac unlocks that had
     nothing to do with buying anything — and finding out what this place would
     do for you meant reading all four.

     It is a list now, the way a market or a page you order from is a list: one
     row per thing, what it is, what it costs, and a button. Water and food by the
     quarter, half or the lot, because filling to the brim was the only option and
     five minutes of water to reach the next station is a perfectly sensible
     purchase. Repairs, parts and refits in the same list, because they are the
     same act.

     What is *not* here any more: the bars beside water and food, which were a
     second drawing of a number already on the line; and EARNED, NOT BOUGHT, which
     is the almanac's business and belongs with the almanac. */
  let mkt = { scroll: 0 };
  HUD.marketOpened = function () { mkt.scroll = 0; };
  HUD.marketScrollBy = function (dy, total, view) {
    mkt.scroll = Math.max(0, Math.min(Math.max(0, total - view), mkt.scroll + dy));
  };

  /* ── a place that trades ──────────────────────────────────────────────
     One page, two kinds of place. A station and an inhabited world are the same
     proposition from the cockpit — somewhere with people in it that will take
     what you are carrying and sell you what you are short of — and they used to
     be two entirely different screens, one a market and one a picture of a globe
     with two fill buttons under it. The globe was the nicer drawing and the
     worse page: you could not see what a world would pay you, because it would
     not pay you anything.

     So both are this, and what differs between them is the rows rather than the
     furniture. What a station has that a world has not — the shipyard, the hull
     repair, a shelf of parts — is simply absent from the list, the same way a
     station with nothing on its shelf shows an empty one. */
  /* Which half of the shop is open. A shop is two jobs — getting rid of what you
     are carrying, and picking up what you are not — and they used to be stacked
     on one page. That gave the selling a two-row grid with a single
     all-or-nothing button in the corner, and the buying whatever was left below
     it. Each is a tab now and each gets the page.

     `null` means "not chosen yet", and the first frame picks: you arrive at a
     shop with a full hold far more often than with an empty one, so a full hold
     opens on SELL and an empty one on BUY. */
  let shopTab = null;

  /* How many of each row is on the counter. Keyed by kind and key, so a material
     and a part of the same name could never share one. Cleared with the shop,
     because a quantity you set last time you docked is not a quantity you meant
     this time. */
  let sellQty = {};
  const qtyOf = (id, most) =>
    Math.max(1, Math.min(most, Math.floor(sellQty[id] || 1)));

  /* Typing a quantity. A keyboard says "60" in two presses where the stepper
     wants a lean on the plus, so the number is a field rather than a caption:
     click it and type. Desk only — a phone has no keys to offer, and the
     stepper's hold is the answer there.

     Nothing about it is modal. Enter puts the digits away, Escape abandons
     them, and pressing anything else on the row commits what has been typed so
     far, because a half-typed number that silently vanished would be worse than
     one that simply took. */
  let sellEdit = null;

  /* What is ticked to go. Separate from the quantity, because "none of it" and
     "one of it" are different answers and a quantity of zero cannot say the
     first one. */
  let sellPick = {};

  // The same two, for the other half of the shop.
  let buyQty = {}, buyPick = {}, buyOpen = {};
  const buyQtyOf = (id, most) =>
    Math.max(1, Math.min(most, Math.floor(buyQty[id] || 1)));

  /* What a given number of a row costs. Named once because three things need
     the same answer — the bill, the stepper's ceiling, and the quote on the
     row — and a stepper that lets you reach a quantity the bill then refuses
     to sell you is the bug this is here to prevent.

     `ceil` on a tankful because `buySupply` charges `ceil`: quoting a rounded
     price and taking a ceiled one is a button that lies by a credit. */
  const buyCostOf = (r, qty) =>
    r.kind === "supply" ? Math.max(1, Math.ceil(qty / 100 * r.tank))
    : r.kind === "repair" ? r.cost
    : qty * r.cost;

  /* The most of this row a given purse will stretch to — the inverse of the
     line above. Supplies are priced by the percent of a tank, everything else
     by the unit. */
  const buyMostFor = (r, budget) => {
    if (r.kind === "repair") return budget >= r.cost ? 1 : 0;
    if (r.kind === "supply") {
      return r.tank > 0 ? Math.floor((budget * 100) / r.tank) : 0;
    }
    return r.cost > 0 ? Math.floor(budget / r.cost) : 0;
  };

  HUD.shopKey = function (code) {
    if (!sellEdit) return false;
    const d = /^(?:Digit|Numpad)([0-9])$/.exec(code);
    if (d) {
      if (sellEdit.text.length < 4) sellEdit.text += d[1];
      return true;
    }
    if (code === "Backspace") {
      sellEdit.text = sellEdit.text.slice(0, -1);
      return true;
    }
    if (code === "Enter" || code === "NumpadEnter") {
      const v = parseInt(sellEdit.text, 10);
      if (v > 0) sellQty[sellEdit.id] = v;
      sellEdit = null;
      return true;
    }
    if (code === "Escape") { sellEdit = null; return true; }
    return false;
  };

  function marketPage(st, title, sub, footer, here, closeAct, only) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    const cash = st.cash || 0;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const rows = st.market || [];
    const mats = st.materials || [];
    const carried = st.carried || 0;
    const held = mats.filter(m => m.n > 0);

    pageFrame(title, sub, footer || "");

    if (!shopTab) shopTab = carried ? "sell" : "buy";

    /* ── the two halves ─────────────────────────────────────────────────────
       In the page's own colours rather than the strip's: buying is amber and
       selling is the colour money is, everywhere else in this mode. */
    const TAB_W = 180, TAB_H = 34, TAB_Y = PAGE.TOP + 4;
    [["buy", "BUY", AMBER], ["sell", "SELL", CASH]].forEach(([k, name, col], i) => {
      const on = shopTab === k;
      /* `live` stays true on the open one. In `button` it means "enabled", not
         "pressable", and passing `!on` drew the tab you are looking at with a
         disabled fill and half-strength type — the shut half of the shop came
         out brighter than the open half. */
      button(name, full.x + TAB_W / 2 + i * (TAB_W + 8), TAB_Y, TAB_W, TAB_H,
             col, on ? null : () => { shopTab = k; mkt.scroll = 0; }, on, true);
    });

    const bodyY = TAB_Y + TAB_H / 2 + PAGE.STEP;
    /* A page with a footer keeps its last row clear of it. Only a world has
       one — "the atmosphere can be skimmed for water" — and it was drawn along
       the bottom edge straight through SELL ALL CARGO, which is a collision
       that could only ever appear on a planet. */
    const bodyH = SCREEN_H - bodyY - (footer ? 44 : 22);

    if (shopTab === "sell") {
      /* ── what they will take off you ──────────────────────────────────────
         Everything aboard that anybody will buy, in one list: the hold, the
         tanks and the crate of spare parts. It used to be a grid of all six
         materials whatever you were carrying — four fifths of it greyed-out
         rows for things you had not got — with parts missing entirely and the
         tanks unsellable, which made a topped-up tank the one thing aboard you
         could not turn back into money.

         You tick what is going and set how much of it, and one button at the
         bottom does the selling. A SELL on every row put a button next to every
         number and made a page of eight things a page of eight decisions; this
         way the decisions are ticks and the transaction is one press. */
      const supplies = [["water", "WATER", ICE], ["food", "FOOD", AMBER_DIM]]
        .map(([k, name, col]) => {
          const t = st[k] || {};
          return { kind: "supply", id: "s:" + k, key: k, name, colour: col,
                   n: Math.floor((t.frac || 0) * 100), tank: t.sellFull || 0 };
        })
        .filter(r => r.n > 0 && r.tank > 0);

      const list = held.map(m => ({
        kind: "mat", id: "m:" + m.key, key: m.key, name: m.name,
        colour: m.colour, n: m.n,
        /* Nought when this place does not deal in it. The row already knows how
           to say so — it is the same line the find-only parts get. */
        each: m.buys === false ? 0
            : m.price == null ? m.value : m.price,
        base: m.value
      })).concat(supplies).concat(
        (st.store || []).filter(e => e.n > 0).map(e => ({
          kind: "part", id: "p:" + e.key, key: e.key, name: e.name,
          colour: VIOLET, n: e.n, each: e.sell || 0, base: e.sell || 0,
          cat: e.cat
        })));

      panel(full.x, bodyY, full.w, bodyH, CASH, "SELL",
            carried ? carried + " UNITS ABOARD" : "NOTHING ABOARD");

      if (!list.length) {
        fitText("Nothing aboard to sell.", full.x + PAGE.PAD,
                bodyY + PAGE.HEAD + 20, SIZE.cap, VIOLET_DIM, "left", 0.6,
                full.w - 60);
      }

      const x0 = full.x + PAGE.PAD;
      const right = full.x + full.w - PAGE.PAD;
      const going = [];          // what the SELL SELECTED button would do
      let takings = 0;

      /* ── what this place will not take, gathered at the bottom ───────────
         Every row a station does not deal in used to sit wherever the hold
         happened to put it, each one carrying "this place doesn't buy these"
         after its name — so the sentence appeared five times down a list you
         were trying to read, and the things you *could* sell were scattered
         between them.

         They go to the end now, under one heading that says it once. Nothing
         is hidden: an unsellable row still shows what it is and how much of it
         you have, because what a place refuses is worth knowing — it is the
         reason to carry it to the next one. */
      const isDud = r => r.kind !== "supply" && !r.each;
      const sellable = list.filter(r => !isDud(r));
      const duds = list.filter(isDud);
      const shown = duds.length
        ? sellable.concat([{ kind: "heading", id: "__nope" }], duds)
        : sellable;

      shown.forEach((r, i) => {
        const y = bodyY + PAGE.HEAD + 18 + i * 38;
        if (y > bodyY + bodyH - 74) return;    // the two buttons' room

        if (r.kind === "heading") {
          label("NOT PURCHASING TODAY", x0, y, SIZE.cap, VIOLET_LOW,
                "left", 0.75, "0.18em");
          ctx.save();
          ctx.strokeStyle = VIOLET_LOW;
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x0 + 250, y - 5);
          ctx.lineTo(right, y - 5);
          ctx.stroke();
          ctx.restore();
          return;
        }

        // Nothing anybody buys: said once, at the top of the group they are in.
        const dud = isDud(r);
        const picked = !dud && !!sellPick[r.id];

        /* Each thing wears the picture it wears everywhere else: a material its
           own mark, a part the icon its catalogue uses. A column of identical
           coloured squares is a list you have to read word by word. */
        const iconA = dud ? 0.4 : picked ? 1 : 0.7;
        if (r.kind === "part" && r.cat) {
          drawPartIcon(r.cat, x0 + 32, y - 5, 9, r.colour, iconA);
        } else if (r.kind === "mat") {
          drawMatIcon(r.key, x0 + 31, y - 4, 9, r.colour, iconA);
        } else {
          ctx.save();
          ctx.fillStyle = r.colour;
          ctx.globalAlpha = iconA;
          ctx.fillRect(x0 + 26, y - 9, 9, 9);
          ctx.restore();
        }

        // The tick. Filled when it is going, an empty box when it is not.
        if (!dud) {
          ctx.save();
          ctx.strokeStyle = CASH;
          ctx.globalAlpha = picked ? 1 : 0.45;
          ctx.lineWidth = picked ? 2 : 1;
          ctx.strokeRect(x0, y - 14, 15, 15);
          if (picked) {
            ctx.fillStyle = CASH;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(x0 + 4, y - 10, 7, 7);
          }
          ctx.restore();
        }

        fitText(r.name, x0 + 46, y, SIZE.cap, r.colour, "left",
                dud ? 0.4 : picked ? 1 : 0.75, 170, "0.06em");

        // A tank is a percentage of itself; everything else is a count.
        label(r.kind === "supply" ? r.n + "%" : "×" + r.n,
              x0 + 232, y, SIZE.cap, VIOLET_DIM, "left", dud ? 0.4 : 0.8);

        // The heading above says why; the row does not repeat it.
        if (dud) return;

        /* Gold when this place is paying over the odds, dim when it is paying
           the usual. No tag: the number is the message, and a word you have to
           learn before it means anything is worse than a colour you only have
           to notice. */
        const over = r.kind === "mat" && r.each > r.base;
        label(r.kind === "supply" ? money(r.tank) + " a tankful"
                                  : money(r.each) + " each",
              x0 + 310, y, SIZE.cap, over ? CASH : CASH_DIM, "left",
              over ? 1 : 0.7);

        /* ── how much of it ──────────────────────────────────────────────────
           Minus, a number, plus. Both steppers repeat while held, so a hundred
           of something is a lean rather than a hundred presses — and on a desk
           the number is a field you can click and type into. */
        const editing = !!(sellEdit && sellEdit.id === r.id);
        const typed = editing && sellEdit.text
          ? parseInt(sellEdit.text, 10) : null;
        const q = typed > 0 ? Math.max(1, Math.min(r.n, typed))
                            : qtyOf(r.id, r.n);
        const commit = () => {
          if (!editing) return;
          if (typed > 0) sellQty[r.id] = q;
          sellEdit = null;
        };
        const total = r.kind === "supply"
          ? Math.max(1, Math.round(q / 100 * r.tank))
          : q * r.each;
        if (picked) { going.push({ r, q }); takings += total; }

        const stepW = 38, boxW = 54;
        const plusCx = right - stepW / 2;
        const boxCx = plusCx - stepW / 2 - 6 - boxW / 2;
        const minusCx = boxCx - boxW / 2 - 6 - stepW / 2;
        const bump = d => () => {
          commit();
          sellQty[r.id] = Math.max(1, Math.min(r.n, qtyOf(r.id, r.n) + d));
          sellPick[r.id] = true;   // touching the number means you want it
        };
        button("−", minusCx, y - 5, stepW, 26, CASH,
               q > 1 ? bump(-1) : null, false, q > 1, "0.02em", true);
        button("+", plusCx, y - 5, stepW, 26, CASH,
               q < r.n ? bump(1) : null, false, q < r.n, "0.02em", true);

        // The number itself, in a box, so it reads as a field and not a caption.
        ctx.save();
        ctx.strokeStyle = CASH;
        ctx.globalAlpha = editing ? 1 : picked ? 0.7 : 0.4;
        ctx.lineWidth = editing ? 2 : 1;
        ctx.strokeRect(boxCx - boxW / 2, y - 18, boxW, 26);
        ctx.restore();
        label(editing ? (sellEdit.text || "") + "_" : String(q),
              boxCx, y, SIZE.cap, CASH, "center", picked ? 1 : 0.65);
        if (!api.touchOnly) {
          tap({ x: boxCx - boxW / 2, y: y - 18, w: boxW, h: 26,
                act: () => { sellEdit = { id: r.id, text: "" };
                             sellPick[r.id] = true; } });
        }

        /* The whole left of the row is the tick. A 15-pixel box is a mouse
           target and not a thumb one, and there is nothing else along there to
           press by accident. */
        tap({ x: x0 - 6, y: y - 20, w: minusCx - stepW / 2 - 12 - (x0 - 6), h: 30,
              act: () => {
                sellPick[r.id] = !sellPick[r.id];
                // Ticking a row means all of it unless you say otherwise.
                if (sellPick[r.id] && !sellQty[r.id]) sellQty[r.id] = r.n;
              } });
      });

      /* Two ways out of a full hold: the things you chose, or the cargo in one
         press. "CARGO", not "EVERYTHING" — it empties the hold of materials and
         leaves the tanks and the crate alone, because a button that sold the
         spare engine you went four sectors for would be the worst thing on this
         page. Anything beyond the materials goes through the ticks. */
      const btnY = bodyY + bodyH - 32;
      button(going.length ? "SELL SELECTED   " + money(takings)
                          : "NOTHING SELECTED",
             full.x + full.w / 2 - 156, btnY, 300, 36,
             going.length ? CASH : VIOLET_LOW,
             going.length ? () => {
               sellEdit = null;
               for (const g of going) {
                 if (g.r.kind === "mat") st.onSellOne && st.onSellOne(g.r.key, g.q);
                 else if (g.r.kind === "part") st.onSellPart && st.onSellPart(g.r.key, g.q);
                 else st.onSellSupply && st.onSellSupply(g.r.key, g.q / 100);
                 delete sellQty[g.r.id];
                 delete sellPick[g.r.id];
               }
             } : null, false, !!going.length);

      button(carried ? "SELL ALL CARGO   " + money(st.worth || 0)
                     : "NOTHING TO SELL",
             full.x + full.w / 2 + 156, btnY, 300, 36,
             carried ? CASH : VIOLET_LOW, carried ? st.onSell : null,
             false, !!carried);

      // Nothing to scroll: six materials, two tanks and a crate is the most.
      HUD.marketHeight = 0;
      HUD.marketView = 1;
      pageNav(st, here, only);
      closeButton(closeAct);
      return;
    }

    /* ── and what they will sell you ─────────────────────────────────────────
       Built the same way as the SELL tab, because it is the same act in the
       other direction: tick what is going in the hold, say how much of it, and
       one button at the bottom does the buying. It was a list with a button on
       every row and three rows a tank — QUARTER, HALF and FILL — which was a
       quantity control made out of buttons, next to a page that had a real one. */
    panel(full.x, bodyY, full.w, bodyH, AMBER, "BUY",
          rows.length + (rows.length === 1 ? " THING" : " THINGS"));

    if (!rows.length) {
      fitText("This one has nothing you need.", full.x + PAGE.PAD,
              bodyY + PAGE.HEAD + 20, SIZE.cap, VIOLET_DIM, "left", 0.6,
              full.w - 60);
    }

    const bx0 = full.x + PAGE.PAD;
    const bRight = full.x + full.w - PAGE.PAD;
    const basket = [];
    let bill = 0;

    /* ── the counter stops at what you can afford ─────────────────────────
       Ric: four cash, the counter stops. The catch is that this is a basket —
       what you can afford on one row depends on what the other ticked rows
       have already spoken for — and the rows draw one after another, so by the
       time a row is drawn `bill` only holds the ones above it. A row near the
       top would have been capped against an empty purse-worth of commitments
       and a row at the bottom against nearly all of them, which is not a rule
       anybody could learn.

       So the ticked total is worked out once, before any row draws, and each
       row is capped against the purse less *everything else* in the basket.
       Untick a row and the others can climb again, which is the behaviour the
       page already implies. */
    const committed = {};
    let ticketed = 0;
    rows.forEach(r => {
      const id = r.id || r.kind + ":" + r.key;
      if (!buyPick[id]) return;
      /* Bounded by the whole purse as well as by the stock. A stored quantity
         can outlive the cash that justified it — tick three of something, then
         spend — and an unbounded stale number here would quietly squeeze every
         other row. The row itself will draw the smaller figure; this only has
         to avoid claiming more than the purse ever held. */
      const cap = Math.max(1, Math.min(Math.max(1, r.most || 1),
                                       buyMostFor(r, Math.max(0, cash))));
      const c = buyCostOf(r, buyQtyOf(id, cap));
      committed[id] = c;
      ticketed += c;
    });

    const inner = { x: full.x + 1, y: bodyY + PAGE.HEAD - 8,
                    w: full.w - 2, h: bodyH - PAGE.HEAD - 46 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    tapClip(inner);

    /* Rows are laid out one after another rather than at `i * 34`, because an
       open description makes its row taller. `rowTop` is where the next one
       starts and `listH` is what the whole thing came to, which is what the
       scrollbar needs. */
    let rowTop = inner.y + 12;
    rows.forEach(r => {
      const id = r.id || r.kind + ":" + r.key;
      const open = !!buyOpen[id] && !!r.note;
      const noteLines = open
        ? wrapLines(r.note, SIZE.cap, full.w - PAGE.PAD * 2 - 60, "0.04em") : [];
      const rowH = 34 + (open ? noteLines.length * 20 + 8 : 0);
      const y = rowTop + 14 - mkt.scroll;
      rowTop += rowH;
      if (y < inner.y - rowH || y > inner.y + inner.h + rowH) return;

      const stocked = Math.max(1, r.most || 1);
      const picked = !!buyPick[id];
      /* The purse, less what the rest of the basket has already claimed. A row
         that is not ticked yet claims nothing, so it is capped against the
         whole remaining purse — tick it and the others tighten, which is the
         same arithmetic seen from the other side. */
      const spare = cash - (ticketed - (committed[id] || 0));
      /* Never below one: a row you cannot afford at all still shows a 1 and a
         dead `+`, because a stepper that reads 0 looks broken rather than
         unaffordable. The BUY button is what refuses. */
      const most = Math.max(1, Math.min(stocked, buyMostFor(r, Math.max(0, spare))));

      /* A part gets its own picture; everything else gets a swatch. A shelf of
         twenty-odd identical coloured squares is a list you read word by word. */
      const iconA = picked ? 1 : 0.7;
      if (r.kind === "part" && r.cat) {
        drawPartIcon(r.cat, bx0 + 32, y - 5, 9, r.colour, iconA);
      } else if (r.kind === "local") {
        drawMatIcon(r.key, bx0 + 31, y - 4, 9, r.colour, iconA);
      } else {
        ctx.save();
        ctx.fillStyle = r.colour;
        ctx.globalAlpha = iconA;
        ctx.fillRect(bx0 + 26, y - 9, 9, 9);
        ctx.restore();
      }

      // The tick.
      ctx.save();
      ctx.strokeStyle = AMBER;
      ctx.globalAlpha = picked ? 1 : 0.45;
      ctx.lineWidth = picked ? 2 : 1;
      ctx.strokeRect(bx0, y - 14, 15, 15);
      if (picked) {
        ctx.fillStyle = AMBER;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(bx0 + 4, y - 10, 7, 7);
      }
      ctx.restore();

      fitText(r.name, bx0 + 46, y, SIZE.cap, r.colour, "left",
              picked ? 1 : 0.75, 170, "0.06em");

      /* What this row is, in numbers: what it weighs, how many of it they have
         left. The *words* are in the description, which drops down — a note
         written to fit a column is a note written twice, once for the column
         and once for the truth. */
      const said = r.kind === "supply" ? r.have + "% aboard"
                 : r.kind === "repair" ? r.have + " hull"
                 : r.kind === "local" ? r.left + " left"
                 /* "8 CARGO SLOTS", not "8 OF HOLD": the old wording named the
                    thing it came out of but never said what the number counted,
                    and read as though "hold" were a unit. The full phrase every
                    time, because this ship also has four *slots* for the parts
                    it is flying, and those are a different thing entirely. */
                 : (r.weight ? r.weight + " CARGO SLOTS  ·  " : "") +
                   (r.left != null ? r.left + " left" : "");

      // How much one of it costs, in the same shape the sell side uses.
      const unit = r.kind === "supply" ? money(r.tank) + " a tankful"
                 : r.kind === "repair" ? money(r.cost)
                 : money(r.cost) + " each";

      const qty = r.kind === "repair" ? 1 : buyQtyOf(id, most);
      const cost = buyCostOf(r, qty);
      if (picked) { basket.push({ r, id, qty }); bill += cost; }

      const stepW = 38, boxW = 54;
      const plusCx = bRight - stepW / 2;
      const boxCx = plusCx - stepW / 2 - 6 - boxW / 2;
      const minusCx = boxCx - boxW / 2 - 6 - stepW / 2;

      // The chevron says there is more to read, and is the thing you press.
      if (r.note) {
        label(open ? "▾" : "▸", bx0 + 232, y, SIZE.cap, AMBER_DIM,
              "left", open ? 0.95 : 0.6);
      }
      fitText(said, bx0 + 250, y, SIZE.cap, VIOLET_DIM, "left", 0.62,
              minusCx - stepW / 2 - 186 - (bx0 + 250));
      label(unit, minusCx - stepW / 2 - 16, y, SIZE.cap, AMBER_DIM, "right",
            picked ? 0.95 : 0.7);

      /* Repairing a hull is one price for one job — there is no "how much of a
         mend" — so it keeps the row and loses the stepper. */
      if (r.kind !== "repair") {
        const bump = d => () => {
          buyQty[id] = Math.max(1, Math.min(most, buyQtyOf(id, most) + d));
          buyPick[id] = true;
        };
        button("−", minusCx, y - 5, stepW, 26, AMBER,
               qty > 1 ? bump(-1) : null, false, qty > 1, "0.02em", true);
        button("+", plusCx, y - 5, stepW, 26, AMBER,
               qty < most ? bump(1) : null, false, qty < most, "0.02em", true);
        ctx.save();
        ctx.strokeStyle = AMBER;
        ctx.globalAlpha = picked ? 0.7 : 0.4;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxCx - boxW / 2, y - 18, boxW, 26);
        ctx.restore();
        label(String(qty) + (r.kind === "supply" ? "%" : ""),
              boxCx, y, SIZE.cap, AMBER, "center", picked ? 1 : 0.65);
      }

      // The name end of the row ticks it; the middle opens what it is.
      tap({ x: bx0 - 6, y: y - 20, w: 232, h: 30,
            act: () => {
              buyPick[id] = !buyPick[id];
              if (buyPick[id] && !buyQty[id]) {
                // A tank fills; everything else starts at one.
                buyQty[id] = r.kind === "supply" ? most : 1;
              }
            } });
      if (r.note) {
        tap({ x: bx0 + 228, y: y - 20,
              w: minusCx - stepW / 2 - 12 - (bx0 + 228), h: 30,
              act: () => { buyOpen[id] = !buyOpen[id]; } });
      }

      // ── and what it actually does, once you have asked ──────────────────
      if (open) {
        noteLines.forEach((ln, k) => {
          label(ln, bx0 + 250, y + 22 + k * 20, SIZE.cap, AMBER_DIM, "left",
                0.85, "0.04em");
        });
      }
    });
    ctx.restore();
    tapClipOff();

    // What the list actually came to, open descriptions included.
    const total = (rowTop - inner.y) + 34;
    HUD.marketHeight = total;
    HUD.marketView = inner.h;
    if (total > inner.h) {
      scrollHint(full.x + full.w - 10, inner.y + 6, inner.h - 12,
                 mkt.scroll / Math.max(1, total - inner.h));
    }

    /* One press, and it says what it will cost before you make it. Red and dead
       when the purse will not cover it: a button that takes your money and buys
       you three of the five things you ticked is a button that lied. */
    const canPay = bill > 0 && cash >= bill;
    button(!basket.length ? "NOTHING SELECTED"
             : canPay ? "BUY SELECTED   " + money(bill)
             : "NOT ENOUGH CASH   " + money(bill),
           full.x + full.w / 2, bodyY + bodyH - 32, 320, 36,
           !basket.length ? VIOLET_LOW : canPay ? AMBER : WARN,
           canPay ? () => {
             for (const b of basket) {
               st.onBuyRow && st.onBuyRow(b.r.kind, b.r.key, b.qty);
               delete buyQty[b.id];
               delete buyPick[b.id];
             }
           } : null, false, canPay);

    pageNav(st, here, only);
    closeButton(closeAct);
  }

  HUD.drawRefit = function (st, dt) {
    st = st || {};
    marketPage(st, "SHOP",
               (st.place ? st.place.space.name + "   \u00b7   " : "") +
               (st.cash || 0) + " CASH", "", "refit",
               st.onUndock || st.onClose || (() => {}), PLACE_TABS);
  };

  /* ═══ THE STATION'S INVENTORY ═════════════════════════════════════════════
     H1. The inventory, wearing the shop's frame.

     The strip along the top is the station's — SHOP, SHIPS, INVENTORY and, once
     the gate is open, WORMHOLE — because those are rooms in the place you are
     standing in. The row where BUY and SELL sit belongs to your ship, so it is
     amber and it carries the pages the inventory already has. Below that is the
     inventory page itself, unchanged and unforked. See `embedded`.

     Why it is worth a page at all: docking used to be a dead end. You could see
     what a station sold and what it would buy, and to find out whether you
     already owned one you had to leave, open the inventory, and come back. */
  const STATION_PAGES = [
    ["ship",      "SHIP",     st => st.onShip],
    ["inventory", "CARGO",    st => st.onInventory],
    ["record",    "RECORD",   st => st.onRecord],
    ["craft",     "CRAFTING", st => st.onCraftPage],
    ["chart",     "MAP",      st => st.onChart]
  ];
  // Which of them the station is showing. Remembered, so leaving the shop and
  // coming back puts you where you were rather than back at the first tab.
  let stationTab = "ship";
  HUD.stationTab = () => stationTab;
  HUD.setStationTab = k => { stationTab = k; };

  HUD.drawStationInv = function (st, dt) {
    const { SCREEN_W } = api;
    st = st || {};
    const where = st.landed ? (st.landed.name || "SURFACE")
                : st.docked ? (st.docked.name || "STATION") : "INVENTORY";
    pageFrame(where, money(st.cash || 0), "", PLACE_TONE);

    /* The ship's pages, in the amber, exactly where the shop puts BUY and SELL —
       same row, same height, same width, because the whole point of the page is
       that it is the shop's frame and a frame you have to re-learn is a
       different frame. */
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const TAB_W = Math.min(180, (full.w - 32) / STATION_PAGES.length);
    const TAB_H = 34, TAB_Y = PAGE.TOP + 4;
    STATION_PAGES.forEach(([key, name, act], i) => {
      const on = stationTab === key;
      button(name, full.x + TAB_W / 2 + i * (TAB_W + 8), TAB_Y, TAB_W, TAB_H,
             on ? AMBER : AMBER_DIM,
             on ? null : () => { stationTab = key; }, on, true);
    });

    /* And the page itself, given the room under that row. `PAGE.TOP` is put
       back in a `finally` because a draw that threw halfway would otherwise
       leave every other page in the game laid out forty-four pixels low. */
    const base = PAGE.TOP;
    const body = { ship: HUD.drawShip, inventory: HUD.drawInventory,
                   record: HUD.drawRecord, craft: HUD.drawCraft,
                   chart: HUD.drawChart }[stationTab] || HUD.drawShip;
    embedded++;
    PAGE.TOP = base + EMBED_BUMP;
    try { body.call(HUD, st, dt); }
    finally { PAGE.TOP = base; embedded--; }

    pageNav(st, "stationinv", PLACE_TABS);
    closeButton(st.onUndock || st.onClose || (() => {}));
  };

  /* ═══ THE WORMHOLE ════════════════════════════════════════════════════════
     H3. A map, and only a map for one purpose: the mouths the gate can open.

     It is deliberately not the chart. The chart is where you read the sector —
     it pans, it zooms, it carries pins and hazards and the line you flew, and
     jumping is one armed mode among several things a tap can mean there. This
     answers one question, has one gesture, and shows nothing that is not an
     answer to it: every station you have charted, where it is, and how far.

     It fits itself to what you know rather than panning, because a map you have
     to navigate in order to navigate is a map with a map inside it — and the
     whole set is never more than a few dozen marks.

     Free, and any station you have *charted* counts. You still have to be
     docked somewhere to make the jump: the gate opens a mouth between two
     moorings, not between a patch of empty space and a mooring. */
  HUD.drawWormhole = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    /* Only the ones you have been to or swept. The gazetteer is written by
       exactly two things — flying inside the sight radius, and a scan return —
       so reading it *is* "passed or scanned at", and there is deliberately no
       second source: a station you have merely inferred from the shape of the
       sector is not a mooring you know how to open a mouth onto. */
    const stations = (st.known || []).filter(q => q.k === "station");
    const me = st.ship || { x: 0, y: 0 };
    const docked = !!(st.docked || st.landed);

    pageFrame("WORMHOLE", stations.length +
              (stations.length === 1 ? " MOORING KNOWN" : " MOORINGS KNOWN"),
              "", PLACE_TONE);

    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const top = PAGE.TOP + 6;
    const view = { x: full.x, y: top, w: full.w, h: SCREEN_H - top - 74 };
    panel(view.x, view.y, view.w, view.h, VIOLET, "THE MOUTHS",
          docked ? "TAP ONE TO OPEN IT" : "YOU MUST BE DOCKED TO JUMP");

    if (!stations.length) {
      fitText("No moorings yet. Fly past a station, or sweep one with a scan, " +
              "and it goes on this map.", view.x + PAGE.PAD,
              view.y + PAGE.HEAD + 24, SIZE.cap, VIOLET_DIM, "left", 0.7,
              view.w - PAGE.PAD * 2);
      pageNav(st, "wormhole", PLACE_TABS);
      closeButton(st.onUndock || st.onClose || (() => {}));
      return;
    }

    /* Fitted to everything you know, including where you are standing, so the
       jump you are about to make is always visible as a distance rather than as
       two names. A single mooring would divide by nothing, hence the floor. */
    const xs = stations.map(q => q.x).concat([me.x]);
    const ys = stations.map(q => q.y).concat([me.y]);
    const pad = 70;
    const inner = { x: view.x + pad, y: view.y + PAGE.HEAD + pad * 0.5,
                    w: view.w - pad * 2, h: view.h - PAGE.HEAD - pad };
    const spanX = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const spanY = Math.max(1, Math.max(...ys) - Math.min(...ys));
    const k = Math.min(inner.w / spanX, inner.h / spanY);
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
    const px = wx => inner.x + inner.w / 2 + (wx - midX) * k;
    const py = wy => inner.y + inner.h / 2 + (wy - midY) * k;

    // Where you are, so the map has a you on it.
    const mx = px(me.x), my = py(me.y);
    ctx.save();
    ctx.strokeStyle = AMBER;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 9, my); ctx.lineTo(mx + 9, my);
    ctx.moveTo(mx, my - 9); ctx.lineTo(mx, my + 9); ctx.stroke();
    ctx.restore();

    stations.forEach((q, i) => {
      const x = px(q.x), y = py(q.y);
      const away = Math.round(Math.hypot(q.x - me.x, q.y - me.y));
      const here = away < 400;
      const col = here ? CASH : docked ? VIOLET : VIOLET_LOW;
      // A line back to you, so the map reads as a set of routes from where you
      // are standing rather than as a constellation.
      if (!here && docked) {
        ctx.save();
        ctx.strokeStyle = VIOLET_LOW;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x, y); ctx.stroke();
        ctx.restore();
      }
      api.glow(col, 2.2, here ? 1 : 0.85, () => {
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
      });
      /* A distance, and nothing else. **Nothing out here is called anything** —
         that is the sector's oldest rule and the reason the chart labels cells
         by coordinate and lets you pin your own names on them. A station is
         written into the gazetteer with an empty name for exactly that reason,
         so this drew nothing in real play and only ever showed something when a
         harness invented one. The lookup is gone rather than left dormant: a
         line that would name a place if a name ever appeared is an invitation
         to add one. You tell these apart by where they are, which is what a map
         is for. */
      label(here ? "YOU ARE HERE" : fmtCells(away) + "u", x, y + 24,
            SIZE.cap, col, "center", here ? 0.95 : 0.7);
      /* The one gesture. Nothing else on this page does anything, which is the
         difference between it and the chart: there is no mode to be in and
         nothing to arm first. */
      if (!here && docked && st.onJump) {
        tap({ x: x - 26, y: y - 26, w: 52, h: 52,
              act: () => { if (st.onJump(q.x, q.y) !== false && st.onClose) st.onClose(); } });
      }
    });

    pageNav(st, "wormhole", PLACE_TABS);
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

  /* ═══ THE WORKBENCH ═══════════════════════════════════════════════════════
     Flat builds. Ingredients in, part out, one step. No engineering interface,
     no nested trees to hold in your head — a row per build, what it wants,
     what you have of it, and one button.

     It works anywhere, which is the whole point: the ice melter's reason to
     exist is being the answer when there is no station for two hundred thousand
     units, and a workbench you have to dock at cannot be that. So the page is
     live, like the loadout, and the world keeps going behind it.

     The two things it must answer that a list of builds does not:

       · **what is this for** — the reverse lookup. You are carrying three
         reactor cores and no idea why until something tells you, so every
         material in the hold says what it is an ingredient for.
       · **the one step down** — a build that eats a finished part says whether
         you have that part, and offers to build it in the same action when you
         could. Nobody should have to work a chain out by hand. */
  /* `pick` is a part *key*, not a row in the grid. The grid sorts what you can
     build right now to the front, and that order changes the moment a rock is
     cracked — so an index would sit still while the part under it changed, and
     the panel would be describing something you never clicked. */
  let craftPg = { scroll: 0, pick: null, mat: null };

  /* ── carrying a part from storage to a slot ───────────────────────────────
     Drag and drop, on a canvas, with no DOM to help. Three pieces:

       `slotBoxes`  where the four squares were drawn this frame
       `storeRows`  where each fittable row of storage was drawn this frame
       `carry`      what is in your hand, and where your hand is

     Both lists are rebuilt by the draw, which is the only way the thing you can
     drop onto stays the same rectangle as the thing you can see. A hit test
     against remembered geometry that the layout has since moved is the classic
     canvas bug, and the fix is never to remember it for longer than a frame.

     The gesture deliberately takes over the page while it is running: press on a
     part and the page stops scrolling until you let go. Anywhere else on the page
     still scrolls, and there is plenty of anywhere else. A press that never moves
     is still a tap, so the old click-to-fit keeps working and nobody has to learn
     a new gesture to do the thing they already did. */
  let slotBoxes = [];
  let storeRows = [];
  /* Where the spares tray's window is, so a part dragged off the ship has
     somewhere to be dropped. The four squares were the only drop target and the
     gesture only ran one way: parts went on by dragging and came off by
     pressing, which are two different ideas about what a slot is. */
  let trayBox = null;
  let carry = null;
  /* The part whose bubble is open on the inventory page, and where it was. A
     tile with a picture on it says *what kind* of thing it is; it cannot say what
     the thing does, and "+34% scan range" is the reason you own one. So pressing
     a tile opens a small card beside it, and pressing anywhere closes it. */
  let bubble = null;
  const DRAG_MIN = 6;          // screen units before a press becomes a drag

  const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  /* ── pressing anywhere else ───────────────────────────────────────────────
     A card that opens over a page has to shut when you press away from it, and
     neither of the two that do could: the ship's part bubble and the cargo
     grid's detail card each closed only on the card itself or on the tile that
     opened it. Everywhere else on the page did nothing, and a popup you have to
     find the way out of is a popup you resent.

     There is no full-screen rectangle *after* the page, and there cannot be: the
     tap list is last-drawn-first-served, so a catch-all registered last would
     swallow every press on the page under it — pressing a second part would
     close the first card instead of opening the second. That is the note this
     replaces, and it was right about the order and wrong about the conclusion.

     Registered *first* instead. Everything the page draws after this is found
     before it, so a tile, a slot, the strip along the top and the card itself
     all still win; only a press that lands on nothing at all reaches here. */
  function closeOnMiss(act) {
    tap({ x: 0, y: 0, w: api.SCREEN_W, h: api.SCREEN_H, act });
  }

  /* Picked up, if there is anything under the point. Returns true when it took
     the gesture, so the page knows not to scroll with it. */
  HUD.grabAt = function (x, y) {
    for (const r of storeRows) {
      if (!inBox(r, x, y)) continue;
      carry = { key: r.key, name: r.name, cat: r.cat, rarity: r.rarity,
                x, y, from: { x, y }, moved: false, over: -1, slot: -1 };
      return true;
    }
    /* And off the ship. A slot with something in it is as much a thing you can
       take hold of as a tile is, and the gesture reads the same in both
       directions — which is the point: a slot is a place a part *is*, not a
       button that ejects one. Pressing it without moving is still the pull it
       always was, because a press that never travels is a tap. */
    for (const b of slotBoxes) {
      if (!b.key || !inBox(b, x, y)) continue;
      carry = { key: b.key, name: b.name, cat: b.cat, rarity: b.rarity,
                x, y, from: { x, y }, moved: false, over: -1, slot: b.i };
      return true;
    }
    return false;
  };

  HUD.carryTo = function (x, y) {
    if (!carry) return false;
    carry.x = x; carry.y = y;
    if (Math.abs(x - carry.from.x) + Math.abs(y - carry.from.y) > DRAG_MIN) {
      carry.moved = true;
    }
    carry.over = -1;
    for (const b of slotBoxes) {
      // Not the one it came out of: dropping a part back where it started is
      // the cancel, and lighting that square up would call it a destination.
      if (b.i !== carry.slot && inBox(b, x, y)) carry.over = b.i;
    }
    // And the tray, which is where a part comes off to.
    carry.overTray = carry.slot >= 0 && !!trayBox && inBox(trayBox, x, y);
    return true;
  };

  /* Let go. Over a slot it fits there; over nothing it goes back, which is the
     correct answer to a drag somebody changed their mind about. A press that
     never moved is a tap and is left to the ordinary tap handling. */
  HUD.dropAt = function (st, x, y) {
    if (!carry) return false;
    const held = carry;
    carry = null;
    if (!held.moved) return false;

    /* Off the ship. Dropped anywhere in the tray it comes off; dropped anywhere
       else — the hull, the page, the square it started in — it stays where it
       was, which is the right answer to a drag somebody thought better of. */
    if (held.slot >= 0) {
      if (trayBox && inBox(trayBox, x, y) && st && st.onPull) st.onPull(held.slot);
      return true;
    }

    for (const b of slotBoxes) {
      if (!inBox(b, x, y)) continue;
      if (st && st.onFit) st.onFit(b.i, held.key);
      return true;
    }
    return true;      // dropped on nothing: the gesture is spent, nothing fitted
  };

  /* Both lists are emptied at the top of every frame, the way the tap list is,
     and refilled only by the page that actually draws slots and a spares tray.

     They used to be cleared inside that page's own draw, which meant they went
     stale the moment you left it — the remembered rectangles stayed grabbable
     on a page that was not showing them, which is the bug the note above this
     block warns about in so many words. It also made the caller gate the
     gesture on a page name, and that list of names is what broke when the
     pages were split: the slots moved to SHIP and the grab was still asking
     for `inventory`, so nothing could be dragged into a slot at all.

     Emptied here, the rule needs no list. Whatever drew a rectangle this frame
     is what you can pick up this frame. */
  HUD.forgetCarryGeometry = function () {
    slotBoxes.length = 0;
    storeRows.length = 0;
    trayBox = null;
  };

  HUD.carrying = () => !!(carry && carry.moved);
  // What was drawn where, so a harness can press the same rectangles a thumb does.
  HUD.slotBoxes = () => slotBoxes.map(b => ({ ...b }));
  // Where a part dragged off the ship may be let go. Exposed for the same
  // reason the other two are: a harness should press the rectangles a thumb does.
  HUD.trayBox = () => (trayBox ? { ...trayBox } : null);
  HUD.storeRows = () => storeRows.map(r => ({ ...r }));
  HUD.craftPick = key => { craftPg.pick = key || null; };
  // What the parts grid actually drew, which is not the same as what the game
  // sent: the anomalies are kept out of it until you have one.
  let partsShown = [];
  HUD.partsShown = () => partsShown.slice();
  HUD.cancelCarry = () => { carry = null; };

  /* What is in your hand, drawn last so it is over everything. Deliberately a
     small thing under the finger rather than a full-size row: on a phone the
     hand is already covering most of what is underneath it. */
  function drawCarry() {
    if (!carry || !carry.moved) return;
    const { ctx } = api;
    const col = rarity(carry.rarity).colour;
    const w = 150, h = 34;
    const x = carry.x - w / 2, yy = carry.y - h - 14;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = INK;
    ctx.fillRect(x, yy, w, h);
    ctx.strokeStyle = carry.over >= 0 ? CASH : col;
    ctx.lineWidth = carry.over >= 0 ? 2 : 1.4;
    ctx.strokeRect(x, yy, w, h);
    ctx.restore();
    drawPartIcon(carry.cat, x + 20, yy + h / 2, 10, col, 1);
    fitText(carry.name, x + 38, yy + h / 2 + 5, SIZE.cap, col, "left", 1, w - 46,
            "0.04em");
  }
  const CRAFT_ROWS = 8;
  HUD.craftOpened = function () { craftPg.pick = null; craftPg.mat = null; };
  /* Pixels now rather than rows: the grid is boxes, and a box is not a row. */
  HUD.craftDragBy = function (dy) {
    const max = Math.max(0, (HUD.craftHeight || 0) - (HUD.craftView || 1));
    craftPg.scroll = Math.max(0, Math.min(max, craftPg.scroll + dy));
  };

  /* ═══ THE BENCH ═══════════════════════════════════════════════════════════
     A wall of parts, the ones you can build lit and the rest down at a whisper.
     What you can make is the whole question and it is answered before you touch
     anything — by light, not by sentences.

     It was a list once, with every ingredient spelled out on every row and a
     SHORT button on each. That answered the question and buried it: fifteen
     rows of sums is a page you read rather than a page you glance at. The sums
     are still here, for one part at a time, in the panel underneath — which is
     the only place any of it has to be, because you only build one thing at a
     time and you have already chosen it by then. */
  HUD.drawCraft = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const crafts = st.crafts || [];
    const hold = st.materials || [];
    const recOf = k => crafts.find(c => c.key === k) || null;
    const ready = p => { const r = recOf(p.key); return !!(r && r.ready); };

    /* A part is on this bench if it can be *built*. Nothing else.

       It used to carry anything you had laid eyes on as well, so a page called
       CRAFTING listed a dozen things it then had to explain you could not
       craft — "bought at a station", "found out there, not made". That is a
       catalogue wearing a workbench's name, and it makes the page a thing you
       read rather than a thing you use: every tile on it is now a plan, and the
       only question a tile can raise is whether you have the materials yet. */
    const shown = (st.parts || [])
      .filter(p => p.craftable)
      .map((p, i) => ({ p, i }))
      .sort((x, z) => (ready(z.p) - ready(x.p)) || (x.i - z.i))
      .map(e => e.p);
    partsShown = shown;

    pageFrame("CRAFTING", "", "", SHIP_TONE);

    /* What you are carrying, as marks and numbers. No names: six of them across
       the top is a caption, not a sentence, and every name is a click away on
       the part that wants it. */
    const mwide = Math.min(150, full.w / Math.max(1, hold.length));
    hold.forEach((m, i) => {
      const mx = full.x + i * mwide;
      drawMatIcon(m.key, mx + 8, PAGE.TOP - 1, 9, m.colour, m.n ? 0.95 : 0.25);
      label(String(m.n), mx + 24, PAGE.TOP + 4, SIZE.cap,
            m.n ? m.colour : VIOLET_LOW, "left", m.n ? 1 : 0.3);
    });

    const pick = shown.find(p => p.key === craftPg.pick) || null;
    const CARD = pick ? 132 : 0;
    const gTop = PAGE.TOP + 22;
    const gH = SCREEN_H - gTop - CARD - (pick ? PAGE.STEP : 0) - 20;

    /* The tile is a fixed size and the *columns* follow the width, not the
       other way round. Six across a 932-wide screen is right; six across a
       landscape phone at 1519 made them 245 square and fitted a row and a half
       on the page. A tile has to be big enough to hold a part's name — seven
       across a desk came out "LAYERED PL…" — and no bigger than a thumb needs. */
    const WANT = api.touchOnly ? 170 : 150;
    const CG = 10;
    const cols = Math.max(api.touchOnly ? 4 : 5, Math.round(full.w / WANT));
    const cell = Math.floor((full.w - (cols - 1) * CG) / cols);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, gTop, SCREEN_W, gH);
    ctx.clip();
    tapClip({ x: 0, y: gTop, w: SCREEN_W, h: gH });

    shown.forEach((p, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = full.x + col * (cell + CG);
      const by = gTop + 6 + row * (cell + CG) - craftPg.scroll;
      if (by > gTop + gH || by + cell < gTop) return;
      const can = ready(p);
      const on = craftPg.pick === p.key;
      const rar = rarity(p.rarity);
      const mine = p.fitted || p.owned > 0;
      const tint = can ? AMBER : rar.colour;

      ctx.save();
      ctx.fillStyle = tint;
      ctx.globalAlpha = on ? 0.2 : can ? 0.12 : 0.03;
      ctx.fillRect(bx, by, cell, cell);
      ctx.strokeStyle = tint;
      ctx.globalAlpha = on ? 1 : can ? 0.85 : 0.28;
      ctx.lineWidth = on ? 2.5 : can ? 1.5 : 1;
      ctx.strokeRect(bx, by, cell, cell);
      ctx.restore();

      drawPartIcon(p.cat, bx + cell / 2, by + cell / 2 - 14, cell * 0.2, tint,
                   can ? 1 : 0.45);
      /* Wrapped, not shrunk. `fitText` clamps to 16px whatever size it is
         handed — so asking for 12 changed nothing and "DECOY LAUNCHER" came out
         "DECOY LAUNC…". A name you cannot read is a tile you have to press. */
      wrapLines(p.name, SIZE.cap, cell - 10, "0.02em").slice(0, 2)
        .forEach((ln, k, a) => {
          label(ln, bx + cell / 2, by + cell - 26 + k * 17 + (a.length === 1 ? 9 : 0),
                SIZE.cap, tint, "center", can ? 1 : 0.5, "0.02em");
        });
      // One mark for one fact: it is already yours.
      if (mine) {
        label(p.fitted ? "●" : "×" + p.owned, bx + cell - 6, by + 15,
              SIZE.cap, CASH_DIM, "right", 0.85);
      }

      tap({ x: bx, y: by, w: cell, h: cell,
            act: () => { craftPg.pick = on ? null : p.key; } });
    });

    ctx.restore();
    tapClipOff();

    const rows = Math.ceil(shown.length / cols);
    const total = rows * (cell + CG) + 12;
    craftPg.scroll = Math.max(0, Math.min(Math.max(0, total - gH), craftPg.scroll));
    HUD.craftHeight = total;
    HUD.craftView = gH;
    if (total > gH) {
      scrollHint(SCREEN_W - 14, gTop + 6, gH - 12,
                 craftPg.scroll / Math.max(1, total - gH));
    }

    /* ── the one you picked ───────────────────────────────────────────────
       What it is, what it takes, and one button. Everything the grid does not
       say lives here, and it only has to say it about a single part. */
    if (pick) {
      const rec = recOf(pick.key);
      const cy = SCREEN_H - CARD - 20;
      const rar = rarity(pick.rarity);
      panel(full.x, cy, full.w, CARD, rar.colour, pick.name,
            pick.fitted ? "ON SHIP"
            : pick.owned ? "×" + pick.owned + " ABOARD" : "");
      fitText(pick.note || "", full.x + PAGE.PAD, cy + PAGE.HEAD + 12,
              SIZE.cap, VIOLET_DIM, "left", 0.85, full.w - PAGE.PAD * 2 - 210);

      if (rec) {
        // Named in full here, where there is room for it — this is the page's
        // one place for words.
        const bits = [];
        if (rec.part) {
          const sub = (st.parts || []).find(q => q.key === rec.part.key);
          bits.push({ part: true, cat: sub ? sub.cat : "odd", name: rec.part.name,
                      colour: VIOLET, have: rec.part.have ? 1 : 0, want: 1 });
        }
        for (const r of rec.rows) {
          bits.push({ key: r.key, name: r.name, colour: r.colour,
                      have: r.have, want: r.want });
        }
        const each = Math.min(190, (full.w - PAGE.PAD * 2 - 210) /
                                   Math.max(1, bits.length));
        bits.forEach((bit, i) => {
          const bxi = full.x + PAGE.PAD + i * each;
          const yy = cy + PAGE.HEAD + 46;
          const enough = bit.have >= bit.want;
          if (bit.part) drawPartIcon(bit.cat, bxi + 7, yy - 4, 8,
                                     enough ? bit.colour : WARN, 1);
          else drawMatIcon(bit.key, bxi + 7, yy - 4, 8,
                           enough ? bit.colour : WARN, enough ? 0.9 : 1);
          fitText(bit.name, bxi + 21, yy, SIZE.cap, enough ? CASH_DIM : WARN,
                  "left", enough ? 0.8 : 1, each - 66, "0.04em");
          label(Math.min(bit.have, bit.want) + "/" + bit.want,
                bxi + each - 16, yy, SIZE.cap, enough ? CASH_DIM : WARN,
                "right", enough ? 0.85 : 1);
        });
      } else {
        /* Unreachable while the grid is only craftable parts, and kept as a
           guard rather than deleted: `crafts` and `parts` are two lists built
           from the same table, and the frame where they disagree should draw a
           line of explanation rather than an empty card. */
        fitText(pick.where || "not made here",
                full.x + PAGE.PAD, cy + PAGE.HEAD + 46, SIZE.cap,
                ICE, "left", 0.8, full.w - PAGE.PAD * 2 - 210);
      }

      // One button, and it says what it is rather than sitting there greyed.
      const canHere = rec && (pick.rarity === "common" || st.docked);
      const can = !!(rec && rec.ready && canHere);
      button(!rec ? "NOT BUILT HERE" : !canHere ? "AT A STATION"
               : rec.ready ? "BUILD IT" : "SHORT",
             full.x + full.w - PAGE.PAD - 95, cy + CARD / 2, 190, 40,
             can ? AMBER : VIOLET_LOW,
             can ? () => st.onCraft && st.onCraft(pick.key) : null, false, can);
    }

    pageNav(st, "craft", SHIP_TABS, SHIP_TONE);
    closeButton(st.onClose);
  };

  /* One picture per category of part. Not one per part: seventeen drawings would
     be seventeen things to get wrong, and what the grid has to answer at a glance
     is *what kind of thing is this* — an engine, a gun, a scanner. The rarity's
     colour carries the rest. */
  /* ── what a material looks like ───────────────────────────────────────────
     Six of them, and they were six identical squares in six colours. Colour
     alone is a bad primary key: two of these are within a hue of each other on a
     dim phone screen, colour-blind players get nothing at all, and a swatch tells
     you it is *a material* rather than *which* one.

     So each gets a shape that says what it is — ice is a crystal, iron is rough
     ore, alloy is a milled bar, iridium is a cut gem, electronics is a board with
     legs, a core is a ring around a hot centre. Shape reads at any size and
     survives being drawn in the wrong colour. */
  function drawMatIcon(key, cx, cy, r, colour, alpha) {
    const { ctx } = api;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.lineJoin = "round";
    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach((pt, i) => (i ? ctx.lineTo(cx + pt[0] * r, cy + pt[1] * r)
                                : ctx.moveTo(cx + pt[0] * r, cy + pt[1] * r)));
      ctx.closePath();
      fill ? ctx.fill() : ctx.stroke();
    };
    switch (key) {
      case "ice":
        // A crystal: a tall six-sided shard with a highlight down it.
        poly([[0, -1], [0.62, -0.4], [0.62, 0.45], [0, 1], [-0.62, 0.45],
              [-0.62, -0.4]]);
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.2, cy - r * 0.55);
        ctx.lineTo(cx - r * 0.2, cy + r * 0.5);
        ctx.stroke();
        break;
      case "iron":
        // Rough ore: a lump with a fracture across it.
        poly([[-0.85, -0.2], [-0.35, -0.85], [0.5, -0.75], [0.9, -0.05],
              [0.55, 0.8], [-0.4, 0.85], [-0.9, 0.35]]);
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.45, cy + r * 0.1);
        ctx.lineTo(cx + r * 0.1, cy - r * 0.25);
        ctx.lineTo(cx + r * 0.5, cy + r * 0.35);
        ctx.stroke();
        break;
      case "alloy":
        // A milled bar, drawn in perspective so it reads as a solid ingot.
        poly([[-0.9, 0.1], [-0.55, -0.5], [0.9, -0.5], [0.55, 0.1]]);
        poly([[-0.9, 0.1], [0.55, 0.1], [0.55, 0.72], [-0.9, 0.72]]);
        break;
      case "iridium":
        // A cut gem: a table and facets under it.
        poly([[-0.5, -0.55], [0.5, -0.55], [0.95, -0.05], [0, 0.95],
              [-0.95, -0.05]]);
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.95, cy - r * 0.05);
        ctx.lineTo(cx + r * 0.95, cy - r * 0.05);
        ctx.moveTo(cx - r * 0.5, cy - r * 0.55);
        ctx.lineTo(cx, cy + r * 0.95);
        ctx.moveTo(cx + r * 0.5, cy - r * 0.55);
        ctx.lineTo(cx, cy + r * 0.95);
        ctx.stroke();
        break;
      case "electronics":
        // A board with legs down both sides.
        ctx.strokeRect(cx - r * 0.55, cy - r * 0.55, r * 1.1, r * 1.1);
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(cx - r * 0.55, cy + i * r * 0.34);
          ctx.lineTo(cx - r * 0.95, cy + i * r * 0.34);
          ctx.moveTo(cx + r * 0.55, cy + i * r * 0.34);
          ctx.lineTo(cx + r * 0.95, cy + i * r * 0.34);
        }
        ctx.stroke();
        ctx.globalAlpha *= 0.7;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        // A reactor core: a containment ring with something lit inside it.
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          ctx.moveTo(cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.46);
          ctx.lineTo(cx + Math.cos(a) * r * 0.88, cy + Math.sin(a) * r * 0.88);
        }
        ctx.stroke();
    }
    ctx.restore();
  }

  function drawPartIcon(cat, cx, cy, r, colour, alpha) {
    const { ctx } = api;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = 1.7;
    ctx.lineJoin = "round";
    const line = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(cx + x1 * r, cy + y1 * r);
      ctx.lineTo(cx + x2 * r, cy + y2 * r);
      ctx.stroke();
    };
    switch (cat) {
      case "engine":
        // A bell and a flame.
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.2, cy - r * 0.8);
        ctx.lineTo(cx + r * 0.5, cy - r * 0.8);
        ctx.lineTo(cx + r * 0.9, cy);
        ctx.lineTo(cx + r * 0.5, cy + r * 0.8);
        ctx.lineTo(cx - r * 0.2, cy + r * 0.8);
        ctx.closePath();
        ctx.stroke();
        line(-0.25, -0.4, -0.9, -0.15);
        line(-0.25, 0, -1, 0);
        line(-0.25, 0.4, -0.9, 0.15);
        break;
      case "thruster":
        // Two small nozzles facing opposite ways.
        ctx.beginPath();
        ctx.rect(cx - r * 0.85, cy - r * 0.45, r * 0.7, r * 0.9);
        ctx.rect(cx + r * 0.15, cy - r * 0.45, r * 0.7, r * 0.9);
        ctx.stroke();
        line(-0.15, 0, 0.15, 0);
        break;
      case "scanner":
        // A dish and its beam.
        ctx.beginPath();
        ctx.arc(cx - r * 0.1, cy, r * 0.75, -1.1, 1.1);
        ctx.stroke();
        line(-0.1, 0, -0.9, 0);
        ctx.beginPath();
        ctx.arc(cx + r * 0.55, cy, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "armour":
        // A plate, layered.
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.9);
        ctx.lineTo(cx + r * 0.8, cy - r * 0.3);
        ctx.lineTo(cx + r * 0.55, cy + r * 0.85);
        ctx.lineTo(cx - r * 0.55, cy + r * 0.85);
        ctx.lineTo(cx - r * 0.8, cy - r * 0.3);
        ctx.closePath();
        ctx.stroke();
        line(-0.45, 0.1, 0.45, 0.1);
        break;
      case "tractor":
        // A cone of pull.
        line(-0.85, -0.7, 0.85, -0.2);
        line(-0.85, 0.7, 0.85, 0.2);
        ctx.beginPath();
        ctx.arc(cx + r * 0.75, cy, r * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "weapon":
        // A barrel and a round leaving it.
        ctx.beginPath();
        ctx.rect(cx - r * 0.9, cy - r * 0.28, r * 1.15, r * 0.56);
        ctx.stroke();
        line(0.35, 0, 0.95, 0);
        ctx.beginPath();
        ctx.arc(cx + r * 0.95, cy, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "solar":
        /* Panels: two wings off a spine, with a sun's rays falling on them. The
           one part in the game whose picture has to say *what it feeds on*. */
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx, cy + r * 0.85);
        ctx.stroke();
        for (const side of [-1, 1]) {
          ctx.strokeRect(cx + side * r * 0.2, cy - r * 0.6,
                         side * r * 0.7, r * 1.2);
        }
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(cx - r * 0.9, cy + i * r * 0.5);
          ctx.lineTo(cx + r * 0.9, cy + i * r * 0.5);
        }
        ctx.stroke();
        break;
      case "device":
        /* A button under a cover, with the press coming off it. A device is the
           one class of part whose picture has to say *you do something with
           this* rather than what it is made of. */
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.1, r * 0.52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy + r * 0.1, r * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.95, cy - r * 0.55);
        ctx.lineTo(cx - r * 0.35, cy - r * 0.55);
        ctx.moveTo(cx + r * 0.95, cy - r * 0.55);
        ctx.lineTo(cx + r * 0.35, cy - r * 0.55);
        ctx.stroke();
        break;
      default:
        // Odd: a shape that is not quite any of the others.
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const rr = r * (i % 2 ? 0.5 : 0.9);
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
    }
    ctx.restore();
  }


  HUD.drawLoadout = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const slots = st.slots || [null, null, null, null];
    const docked = !!st.docked;

    pageFrame("LOADOUT",
              (st.shipName || "") + "  \u00b7  FOUR SLOTS, EVERY HULL",
              "", SHIP_TONE);

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
      tap({ x, y: PAGE.TOP, w, h: slotH, act: () => {
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
    panel(L.x, listY, L.w, listH, CASH, "STORAGE",
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
        "on how dangerous its sky is \u2014 the strange ones",
        "are sold where the biome is bad and nobody keeps",
        "the peace.",
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

    pageNav(st, "loadout", SHIP_TABS, SHIP_TONE);
    closeButton(st.onClose);
  };

  /* ═══ THE SHIP ════════════════════════════════════════════════════════════
     Storage and the loadout were two pages about the same object, and reading one
     while deciding the other meant leaving and coming back. They are one page
     now, and it scrolls — which is the only honest way to fit four slots, a hold,
     a purse, three powers' opinions of you and a book on a phone.

     The order is deliberate and it is the order you ask the questions in:

       what am I flying      the four slots, and what is fitted in them
       what have I got       cash, storage, and what each thing is worth
       who am I to them      the three powers, explained
       what have I seen      the almanac, as a book you open

     Everything is a band the full width of the page rather than two columns,
     because a column that has to be read against another column is two things to
     read and a phone has room for one. */
  let shipPg = { scroll: 0 };
  HUD.shipScrollBy = function (dy, total, view) {
    const max = Math.max(0, total - view);
    shipPg.scroll = Math.max(0, Math.min(max, shipPg.scroll + dy));
  };
  HUD.shipOpened = function () { shipPg.scroll = 0; bubble = null; };

  /* ═══ THE SHIP ════════════════════════════════════════════════════════════
     What you are flying and what is bolted to it. Nothing else: no ore, no ice,
     none of the things that are merely *in* it. This page is one job — putting
     parts on a ship — and everything on it serves that job, which is why the
     spares are here too. You cannot drag a part into a slot from a page the
     slots are not on. */
  HUD.drawShip = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const cash = st.cash || 0, cap = st.hold || 1;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const slots = st.slots || [null, null, null, null];

    /* The hull's own name, where the word INVENTORY used to be. This page is
       about one particular ship and which one is the first thing it should
       say — and it is no longer the page the cargo lives on. */
    pageFrame(st.shipName || "SHIP", money(cash), "", SHIP_TONE);
    // Before anything else the page draws. See `closeOnMiss`.
    if (bubble) closeOnMiss(() => { bubble = null; });

    /* The ship does not scroll. It is what the page is *about* — the four
       squares you are dragging towards — and it used to slide off the top the
       moment you reached for anything in the second row of the tray, which is
       the one moment you need to see where you are aiming.

       So the hull and its slots are drawn first, pinned, outside any clip, and
       the tray below gets a scrolling window of its own. Scrolling this page
       means scrolling the parts aboard and nothing else. */
    let y = PAGE.TOP;
    const gap = PAGE.STEP;
    const used = st.carried || 0;
    const crate = st.store || [];
    const freeSlot = slots.findIndex(x => !x);
    /* The column count comes from the longest name in the tray, not from a
       constant. A name is centred under its picture and one word cannot be
       wrapped, so a fixed six columns cut REVERSE THRUSTERS to "REVERSE
       THRUS…" — and `fitText` will not go below 16px, so shrinking it was
       never on the table. Fewer, wider tiles instead: the same rule the cargo
       grid uses, for the same reason. */
    const longest = crate.reduce((w, e) => Math.max(w,
      String(e.name).split(" ").reduce(
        (m, word) => Math.max(m, widthOf(word, SIZE.cap, "0.04em")), 0)), 0);
    const want = Math.max(api.touchOnly ? 90 : 84, Math.ceil(longest) + 12);
    const cw = Math.max(2, Math.min(api.touchOnly ? 4 : 6,
                        Math.floor((full.w - PAGE.PAD * 2 + 10) / (want + 10))));
    const cCell = Math.floor((full.w - PAGE.PAD * 2 - (cw - 1) * 10) / cw);
    const cRows = Math.max(1, Math.ceil(crate.length / cw));
    const matsH = 0;
    /* 42 below a tile, not 26: a two-word name wraps onto a second line now
       rather than being cut, and the row has to make room for the line. */
    const NAME_H = 42;
    const holdH = 30 + cRows * (cCell + NAME_H) + 10 + PAGE.HEAD;

    /* ── the ship ─────────────────────────────────────────────────────────
       The page is a picture of the thing it is about. It used to be three
       stacked panels of rows — the same furniture the shop is built out of — so
       the one page that is unmistakably *yours* was laid out exactly like a page
       about somebody else's counter, and the only way to tell them apart was to
       read the title.

       The hull is drawn in the middle at whatever size the band has room for,
       with its four slots hung around it and a lead running from each one in. A
       slot stops being the fourth column of a table and becomes a place on the
       ship — which is what it always was, since you fit a part by dragging it
       there. The boxes are still remembered in `slotBoxes`, so what you can drop
       onto is the same rectangle you can see. */
    const cxShip = SCREEN_W / 2;
    const BAND = 244, SBOX = 72, ARM = 232;
    const cyShip = y + 118;
    const seats = [[-ARM, -112], [ARM, -112], [-ARM, 28], [ARM, 28]];
    const anyFitted = slots.some(x => !!x);

    slotBoxes.length = 0;
    for (let i = 0; i < 4; i++) {
      const real = slots[i];
      /* Lifted out of its square, it should not also be drawn sitting in it —
         the same rule the tray's tiles follow while one is in hand. Only the
         drawing sees the slot as empty; `slotBoxes` keeps the truth. */
      const lifting = !!(carry && carry.moved && carry.slot === i);
      const sl = lifting ? null : real;
      const bx = cxShip + seats[i][0] - SBOX / 2;
      const by = cyShip + seats[i][1];
      const fitting = !!sl && sl.fit > 0;
      /* An empty slot takes the dim violet rather than the low one. `VIOLET_LOW`
         is for a thing you cannot use — a tab that is not live, a part nobody
         sells — and an empty slot is the opposite of that: it is the one place
         on this page you are being invited to put something. Drawn at the same
         weight as "unavailable", four of them read as four refusals. */
      const col = !sl ? VIOLET_DIM : fitting ? AMBER_DIM : rarity(sl.rarity).colour;
      const over = carry && carry.over === i;
      /* What is in it travels with the rectangle, because a slot is now
         something you can pick *up* as well as drop onto — `grabAt` has to know
         what it would be taking hold of. */
      slotBoxes.push({ x: bx, y: by, w: SBOX, h: SBOX, i,
                       key: real ? real.key : null, name: real ? real.name : "",
                       cat: real ? real.cat : null,
                       rarity: real ? real.rarity : null });

      // The lead in to the hull, so a slot reads as part of the ship and not as
      // a box that happens to be near one.
      ctx.save();
      ctx.strokeStyle = sl ? col : VIOLET_DIM;
      ctx.globalAlpha = sl ? 0.4 : 0.34;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + (seats[i][0] < 0 ? SBOX : 0), by + SBOX / 2);
      ctx.lineTo(cxShip + (seats[i][0] < 0 ? -52 : 52), cyShip);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = over ? 0.22 : sl ? 0.1 : 0.07;
      ctx.fillStyle = over ? CASH : col;
      ctx.fillRect(bx, by, SBOX, SBOX);
      ctx.globalAlpha = over ? 1 : sl ? 0.85 : 0.62;
      ctx.strokeStyle = over ? CASH : col;
      ctx.lineWidth = over ? 2.5 : sl ? 1.5 : 1;
      // An empty slot is a dashed outline: an opening, rather than a box with
      // nothing in it.
      if (!sl && ctx.setLineDash) ctx.setLineDash([5, 4]);
      ctx.strokeRect(bx, by, SBOX, SBOX);
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.restore();

      if (sl) {
        drawPartIcon(sl.cat, bx + SBOX / 2, by + SBOX / 2, SBOX * 0.28,
                     fitting ? AMBER_DIM : col, fitting ? 0.6 : 1);
      } else {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = VIOLET_DIM;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx + SBOX / 2 - 8, by + SBOX / 2);
        ctx.lineTo(bx + SBOX / 2 + 8, by + SBOX / 2);
        ctx.moveTo(bx + SBOX / 2, by + SBOX / 2 - 8);
        ctx.lineTo(bx + SBOX / 2, by + SBOX / 2 + 8);
        ctx.stroke();
        ctx.restore();
      }

      fitText(sl ? sl.name : "EMPTY", bx + SBOX / 2, by + SBOX + 18, SIZE.cap,
              col, "center", sl ? 1 : 0.7, ARM - 30, "0.06em");
      if (fitting) {
        fitText("FITTING  " + Math.ceil(sl.fit) + "s", bx + SBOX / 2,
                by + SBOX + 36, SIZE.cap, AMBER_DIM, "center", 1, ARM - 30);
        barAt(bx - 10, by + SBOX + 44, SBOX + 20, 5,
              1 - sl.fit / Math.max(1, sl.of), AMBER_DIM);
      }
      if (sl) {
        tap({ x: bx, y: by, w: SBOX, h: SBOX,
              act: () => st.onPull && st.onPull(i) });
      }
    }

    // The hull last, over the leads.
    const flying = (st.ships || []).find(sh => sh.flying);
    if (flying) drawHull(flying, cxShip, cyShip, 50, AMBER, 0.95);
    /* One line, in the gap between the two lower slots. It has the width of
       that gap and no more, so it says one thing: the longer version ran out of
       room and ended in an ellipsis, which is the worst way for a hint to
       arrive. */
    fitText(anyFitted ? (api.touchOnly ? "TAP A SLOT TO PULL IT"
                                       : "CLICK A SLOT TO PULL IT")
                      : "DRAG A PART INTO A SLOT",
            cxShip, cyShip + 84, SIZE.cap, AMBER_DIM, "center", 0.6, ARM * 1.6);
    y += BAND;

    /* ── the tray's heading, pinned with the ship ─────────────────────────
       The rule, the words and the capacity all stay put. They are the label on
       the window rather than something inside it, and a heading that scrolls
       away takes the one number you are scrolling *because of* with it — the
       whole question is "have I room for this", and the answer was leaving the
       screen exactly when you started asking. */
    // The tray draws its own heading and rule; a panel round it was a second
    // one saying the same words directly above.
    /* A rule across the panel rather than a second frame: the parts are in the
       same hold, and two frames would say they were not. */
    const headY = y + matsH;
    ctx.save();
    ctx.strokeStyle = VIOLET_LOW;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(full.x + PAGE.PAD, headY + 2);
    ctx.lineTo(full.x + full.w - PAGE.PAD, headY + 2);
    ctx.stroke();
    ctx.restore();
    label("PARTS ABOARD", full.x + PAGE.PAD, headY + 20, SIZE.cap, CASH,
          "left", 0.8, "0.14em");
    /* What they are costing you, which is the whole reason they are on this
       panel. Not a count — a count is what the tiles already are. */
    /* "OR CLICK IT" was still here, on the desktop half of the line only, from
       when a press fitted the part. A press opens the tile's description now —
       see the tap below — so the line was promising a thing the page does not
       do, and somebody following it presses a tile, gets a card, and concludes
       the page is broken. One instruction, true on both. */
    label(crate.length
      ? (st.partWeight || 0) + " OF " + (st.hold || 0) + " CARGO SLOTS  \u00b7  " +
        "DRAG ONE INTO A SLOT"
      : "NONE",
      full.x + full.w - PAGE.PAD, headY + 20, SIZE.cap,
      crate.length ? CASH_DIM : VIOLET_LOW, "right", 0.75, "0.08em");

    /* ── and now the part that scrolls ────────────────────────────────────
       The tiles, and only the tiles, in a window that starts under the heading
       and runs to the bottom of the page.

       This is what the page is for: the ship is the thing you are aiming at and
       the tray is the thing you are looking through, so the ship stays and the
       tray moves. It was one scroll over the whole page — reach for anything in
       the second row and the four squares you were dragging towards slid off
       the top, which is the one moment you need to see where you are aiming. */
    /* ── what you own and are not flying ──────────────────────────────────────
       Boxes with pictures in them, laid out like the parts page, rather than a
       list of rows. Two reasons, and the second is the one that matters:

       A row is a *label*. The four slots above are squares with a picture in
       each, so the thing you are dragging and the place you are dragging it to
       were drawn in two completely different languages — you had to work out that
       the line of text and the empty square were the same kind of object.

       And a box is a thing you can pick up. A row with a button on the end of it
       says "press the button"; a tile with a picture on it says "this is an
       object, take it". The gesture was already there and nothing about the
       drawing invited it. */
    const viewTop = headY + 26;
    const viewH = SCREEN_H - viewTop - 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewTop, SCREEN_W, viewH);
    ctx.clip();
    tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });
    // Where a part dragged off the ship can be dropped. See `dropAt`.
    trayBox = { x: 0, y: viewTop, w: SCREEN_W, h: viewH };

    const partsY = headY - shipPg.scroll;
    y = partsY;
    storeRows.length = 0;
    crate.forEach((e, i) => {
      const col = i % cw, row = Math.floor(i / cw);
      const bx = full.x + PAGE.PAD + col * (cCell + 10);
      const by = partsY + 30 + row * (cCell + NAME_H);
      const can = freeSlot >= 0 && !e.fitted;
      const rar = rarity(e.rarity);

      /* Where this tile is, so a press on it can pick the part up. Only ones you
         could actually fit are draggable: dragging something already on the ship
         to a slot it is already in is a gesture with no meaning. */
      if (can) {
        storeRows.push({ x: bx, y: by, w: cCell, h: cCell + NAME_H - 8,
                         key: e.key, name: e.name, cat: e.cat,
                         rarity: e.rarity });
      }
      // Dragged out of its box, it should not also be drawn sitting in it.
      if (carry && carry.key === e.key && carry.moved) return;

      ctx.save();
      ctx.fillStyle = e.fitted ? VIOLET_LOW : rar.colour;
      ctx.globalAlpha = e.fitted ? 0.08 : 0.22;
      ctx.fillRect(bx, by, cCell, cCell);
      ctx.strokeStyle = e.fitted ? VIOLET_LOW : rar.colour;
      ctx.globalAlpha = e.fitted ? 0.5 : 0.95;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, cCell, cCell);
      ctx.restore();

      drawPartIcon(e.cat, bx + cCell / 2, by + cCell / 2, cCell * 0.3,
                   e.fitted ? VIOLET_LOW : rar.colour, e.fitted ? 0.5 : 1);
      if (e.n > 1) {
        label("×" + e.n, bx + cCell - 5, by + 16, SIZE.cap, CASH_DIM,
              "right", 0.9);
      }
      // What one of them costs the hold, bottom-left, opposite the count.
      if (e.weight) {
        label(String(e.weight), bx + 5, by + cCell - 5, SIZE.cap, VIOLET_DIM,
              "left", 0.75);
      }
      if (e.fitted) {
        label("ON SHIP", bx + cCell / 2, by + cCell - 8, SIZE.cap, VIOLET_LOW,
              "center", 0.8);
      }
      /* Wrapped, not cut. REVERSE THRUSTERS came out "REVERSE THRUS…" —
         `fitText` will not go below 16px, so a name too wide for its tile could
         only ever lose its end, and the end is the half that says which one it
         is. The tile is sized above to hold the longest single word; this puts
         the second word on its own line. */
      wrapLines(e.name, SIZE.cap, cCell + 8, "0.04em").slice(0, 2)
        .forEach((ln, k) => {
          label(ln, bx + cCell / 2, by + cCell + 15 + k * 17, SIZE.cap,
                e.fitted ? VIOLET_LOW : rar.colour, "center",
                e.fitted ? 0.6 : 0.95, "0.04em");
        });

      /* Pressing a tile says what it is. Fitting it is the *drag* — which is the
         gesture the four squares above are asking for — so a press is free to
         mean "tell me about this", which is the question a picture cannot answer
         on its own. */
      tap({ x: bx, y: by, w: cCell, h: cCell + NAME_H - 8,
            act: () => {
              bubble = (bubble && bubble.key === e.key)
                ? null
                : { key: e.key, x: bx + cCell / 2, y: by, e };
            } });
    });

    y += holdH - PAGE.HEAD + gap;

    ctx.restore();
    tapClipOff();

    /* ── what the part is ────────────────────────────────────────────────
       Outside the tray's scroll clip, so a card opened on the top row is not
       sliced off by the window its tile lives in — the same rule the cargo
       grid's card follows, and it became necessary here the moment the tray
       stopped being the whole page. The anchor still moves with the scroll,
       because the tile does. */
    if (bubble && crate.some(q => q.key === bubble.key)) {
      const e2 = crate.find(q => q.key === bubble.key);
      const bw2 = Math.min(360, full.w - PAGE.PAD * 2);
      const lines = wrapLines(e2.note || "", SIZE.cap, bw2 - 24);
      const bh2 = 44 + lines.length * 20 + 20;
      const bx2 = Math.max(full.x + PAGE.PAD,
                    Math.min(bubble.x - bw2 / 2, full.x + full.w - PAGE.PAD - bw2));
      const above = bubble.y - bh2 - 10 > PAGE.TOP;
      const by2 = above ? bubble.y - bh2 - 10 : bubble.y + cCell + 30;
      const rar2 = rarity(e2.rarity);
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = INK;
      ctx.fillRect(bx2, by2, bw2, bh2);
      ctx.strokeStyle = rar2.colour;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx2, by2, bw2, bh2);
      ctx.restore();
      fitText(e2.name, bx2 + 12, by2 + 24, SIZE.val, rar2.colour, "left", 1,
              bw2 - 120, "0.06em");
      label(e2.rarity.toUpperCase(), bx2 + bw2 - 12, by2 + 24, SIZE.cap,
            rar2.colour, "right", 0.8, "0.1em");
      lines.forEach((line, i) => {
        label(line, bx2 + 12, by2 + 48 + i * 20, SIZE.cap, VIOLET_DIM, "left", 0.9);
      });
      /* The foot of the card: what it costs the hold on the right, and what
         the part is doing — or how long it would take to fit — on the left.

         Two labels on one baseline in a 360-wide box, and they used to collide.
         "DRAG IT INTO A SLOT" and "3 CARGO SLOTS" want 348 of the 336 there
         are, so the two were drawn straight through each other. The instruction
         went: it is already printed along the top of this panel, two lines above
         the card, and the card's job is the things the panel cannot say. What is
         left is short — and measured anyway, because a longer weight line would
         put the collision back. */
      const foot = e2.weight
        ? e2.weight + " CARGO SLOTS" +
          (e2.n > 1 ? "  ·  " + e2.held + " ALL TOLD" : "")
        : "";
      const lead = e2.fitted ? "ON SHIP"
                 : st.docked ? "" : e2.secs + "s TO FIT";
      if (foot) {
        label(foot, bx2 + bw2 - 12, by2 + bh2 - 12, SIZE.cap, VIOLET_DIM,
              "right", 0.8, "0.08em");
      }
      if (lead && widthOf(lead, SIZE.cap, "0.08em") +
                  widthOf(foot, SIZE.cap, "0.08em") < bw2 - 32) {
        label(lead, bx2 + 12, by2 + bh2 - 12, SIZE.cap,
              e2.fitted ? VIOLET_LOW : CASH, "left", 0.85, "0.08em");
      }
      // The card itself closes it, the tile that opened it closes it, and so
      // does anywhere else on the page — see `closeOnMiss` at the top of this.
      tap({ x: bx2, y: by2, w: bw2, h: bh2, act: () => { bubble = null; } });
    }

    /* Measured from the top of the *tray's* window, not the page's. It used to
       be `- PAGE.TOP`, which was right while the whole page scrolled and is an
       over-count of one ship band now — the scrollbar would have claimed there
       was 244px more to see than there is, and the tray would have scrolled
       past its own last row. */
    const total = (y + shipPg.scroll) - viewTop;
    shipPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH), shipPg.scroll));
    HUD.shipHeight = total;
    HUD.shipView = viewH;
    if (total > viewH) {
      scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
                 shipPg.scroll / Math.max(1, total - viewH));
    }

    pageNav(st, "ship", SHIP_TABS, SHIP_TONE);
    closeButton(st.onClose || (() => {}));
    drawCarry();
  };

  /* ═══ THE CARGO ═══════════════════════════════════════════════════════════
     Everything aboard, in one grid of squares. A cell is a thing: its picture,
     how many of it, and what it is called. Ore and parts in the same frame,
     because they are in the same hold and weigh against the same number — that
     was settled a long time ago and the rows kept pretending otherwise.

     A part bolted to the ship is here too, and greyed, marked ATTACHED. It
     costs no room — fitting one takes it out of the hold — but leaving it off
     this page meant the only view of everything you own was missing the four
     things you chose most carefully. */
  let cargoPg = { scroll: 0 };
  /* Which cell is open, and where it was drawn so the card can sit against it.
     Matched back by `id` every frame rather than held as a reference: the hold
     changes under you — a mote picked up, a part fitted — and a card holding a
     stale object would go on describing something you no longer have. */
  let cargoPick = null;
  HUD.cargoOpened = function () { cargoPg.scroll = 0; cargoPick = null; };
  HUD.cargoScrollBy = function (dy, total, view) {
    const max = Math.max(0, total - view);
    cargoPg.scroll = Math.max(0, Math.min(max, cargoPg.scroll + dy));
  };

  HUD.drawInventory = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const cash = st.cash || 0, cap = st.hold || 1;
    const used = st.carried || 0;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const mats = (st.materials || []).filter(m => m.n > 0);
    const crate = (st.store || []).filter(e => e.n > 0);
    const slots = st.slots || [];

    pageFrame("CARGO", (st.shipName || "") + "   ·   " + money(cash), "",
              SHIP_TONE);
    // Before anything else the page draws. See `closeOnMiss`.
    if (cargoPick) closeOnMiss(() => { cargoPick = null; });

    // How full, as a bar. "41 / 60" is a fact; this is the feeling of it.
    const frac = Math.min(1, used / Math.max(1, cap));
    label(used + " / " + cap + "  CARGO SLOTS", full.x, PAGE.TOP + 8, SIZE.cap,
          frac > 0.92 ? AMBER : AMBER_DIM, "left", 0.9, "0.1em");
    barAt(full.x, PAGE.TOP + 18, full.w, 8, frac,
          frac > 0.92 ? AMBER : CASH, frac > 0.92);

    /* One list, three kinds of thing, in the order they matter: what you dug
       up, what you are carrying spare, and what is already on the ship. */
    const cells = mats.map(m => ({
      kind: "mat", id: "m:" + m.key, key: m.key, name: m.name,
      colour: m.colour, n: m.n, note: m.note, where: m.where,
      value: m.value, price: m.price, buys: m.buys
    })).concat(crate.map(e => ({
      kind: "part", id: "p:" + e.key, key: e.key, name: e.name, cat: e.cat,
      colour: rarity(e.rarity).colour, n: e.n, note: e.note,
      rarity: e.rarity, weight: e.weight, held: e.held, secs: e.secs
    }))).concat(slots.filter(sl => !!sl).map(sl => ({
      kind: "fitted", id: "f:" + sl.key, key: sl.key, name: sl.name,
      cat: sl.cat, colour: rarity(sl.rarity).colour, n: 1, note: sl.note,
      rarity: sl.rarity, attached: true, fit: sl.fit
    })));

    const viewTop = PAGE.TOP + 34;
    const viewH = SCREEN_H - viewTop - 20;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, viewTop, SCREEN_W, viewH);
    ctx.clip();
    tapClip({ x: 0, y: viewTop, w: SCREEN_W, h: viewH });

    /* The cell is square and its size is the content's, not a constant. A name
       is one or two words centred under the picture, and a word cannot be
       wrapped — so a cell narrower than the longest single word in the hold
       draws that word out through its own side. ELECTRONICS and OVERBURNER
       both did. The 16px floor is the whole module's rule and shrinking the
       caption would only move the lie somewhere else, so the square grows
       instead: every cell the same size, wide enough for the widest word
       aboard, and the row wraps sooner on a narrow screen.

       Squares, not just wide boxes — the grid reads as a grid. */
    const CGAP = 8;
    const widestWord = cells.reduce((w, c) => Math.max(w,
      String(c.name).split(" ").reduce(
        (m, word) => Math.max(m, widthOf(word, SIZE.cap, "0.02em")), 0)), 0);
    const CELL = Math.max(api.touchOnly ? 104 : 96, Math.ceil(widestWord) + 14);
    const cols = Math.max(1, Math.floor((full.w + CGAP) / (CELL + CGAP)));
    const lead = full.x + (full.w - (cols * CELL + (cols - 1) * CGAP)) / 2;

    if (!cells.length) {
      fitText("Nothing aboard.", full.x, viewTop + 34, SIZE.cap,
              VIOLET_DIM, "left", 0.6, full.w);
    }

    cells.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const bx = lead + col * (CELL + CGAP);
      const by = viewTop + 10 + row * (CELL + CGAP) - cargoPg.scroll;
      if (by > viewTop + viewH || by + CELL < viewTop) return;
      const on = c.kind === "fitted";

      ctx.save();
      ctx.fillStyle = c.colour;
      ctx.globalAlpha = on ? 0.05 : 0.12;
      ctx.fillRect(bx, by, CELL, CELL);
      ctx.strokeStyle = c.colour;
      ctx.globalAlpha = on ? 0.4 : 0.8;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, CELL, CELL);
      ctx.restore();

      /* Bolted on rather than stowed. Its own word along the top, so the cell
         can still say *which* part it is — the name is the thing you are
         looking for and ATTACHED is the thing you need to know about it. */
      if (on) {
        label("ATTACHED", bx + CELL / 2, by + 15, 11, VIOLET_LOW, "center",
              0.9, "0.1em");
      }

      // The picture, the way it is drawn everywhere else in the mode.
      if (c.kind === "mat") {
        drawMatIcon(c.key, bx + CELL / 2, by + CELL / 2 - 8, 13, c.colour,
                    on ? 0.4 : 1);
      } else {
        drawPartIcon(c.cat, bx + CELL / 2, by + CELL / 2 - 8, 13, c.colour,
                     on ? 0.4 : 1);
      }

      /* The count, top corner. It used to sit at the foot of the cell, on the
         same line the name starts on — so ELECTRONICS and REACTOR CORE were
         drawn straight through their own stack count. Up here it is clear of
         both the picture and the name however long the name runs. */
      if (c.n > 1) {
        label("×" + c.n, bx + CELL - 7, by + 16, SIZE.cap,
              c.colour, "right", on ? 0.5 : 1);
      }
      /* Wrapped onto a second line rather than shrunk: `fitText` will not go
         below 16px, so a long name inside a square can only ever be cut. The
         square is sized above to hold the longest word, so this always fits. */
      wrapLines(c.name, SIZE.cap, CELL - 10, "0.02em").slice(0, 2)
        .forEach((ln, k, a) => {
          label(ln, bx + CELL / 2, by + CELL - 24 + k * 17 + (a.length === 1 ? 9 : 0),
                SIZE.cap, on ? VIOLET_LOW : c.colour, "center",
                on ? 0.7 : 0.9, "0.02em");
        });

      /* Press it to find out what it is. A grid of pictures is only readable
         if the pictures can be asked what they mean — and the one place a
         player decides whether a thing is worth the room it takes is looking
         straight at it. */
      tap({ x: bx, y: by, w: CELL, h: CELL,
            act: () => {
              cargoPick = cargoPick && cargoPick.id === c.id
                ? null : { id: c.id, x: bx, y: by + cargoPg.scroll };
            } });
    });

    ctx.restore();
    tapClipOff();

    /* ── what it is ───────────────────────────────────────────────────────
       Outside the scroll clip, so a card opened on the bottom row is not cut
       in half by the window its cell lives in. */
    const open = cargoPick && cells.find(c => c.id === cargoPick.id);
    if (open) {
      const rar = open.kind === "mat" ? null : rarity(open.rarity);
      const tint = rar ? rar.colour : open.colour;
      const bw = Math.min(440, full.w - PAGE.PAD * 2);
      const lines = wrapLines(open.note || "", SIZE.cap, bw - 24);
      const extra = open.kind === "mat" && open.where
        ? wrapLines("Found: " + open.where, SIZE.cap, bw - 24) : [];
      const bh = 46 + (lines.length + extra.length) * 20 + 26;
      const cardX = Math.max(full.x, Math.min(cargoPick.x + CELL / 2 - bw / 2,
                                              full.x + full.w - bw));
      const anchorY = cargoPick.y - cargoPg.scroll;
      const below = anchorY + CELL + 8 + bh < SCREEN_H - 16;
      const cardY = below ? anchorY + CELL + 8 : Math.max(PAGE.TOP, anchorY - bh - 8);

      ctx.save();
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = INK;
      ctx.fillRect(cardX, cardY, bw, bh);
      ctx.strokeStyle = tint;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, bw, bh);
      ctx.restore();

      fitText(open.name, cardX + 12, cardY + 26, SIZE.val, tint, "left", 1,
              bw - 130, "0.06em");
      label(open.kind === "mat" ? "ORE" : (open.rarity || "").toUpperCase(),
            cardX + bw - 12, cardY + 26, SIZE.cap, tint, "right", 0.8, "0.1em");
      lines.concat(extra).forEach((ln, i) => {
        label(ln, cardX + 12, cardY + 50 + i * 20, SIZE.cap, VIOLET_DIM,
              "left", 0.9);
      });

      /* The bottom line is the one a player is actually here for: what it is
         worth, or what it is costing to carry. */
      const foot = open.kind === "mat"
        ? (open.buys === false ? "this place doesn't buy these"
           : (open.price == null ? open.value : open.price) + " each" +
             (open.price != null && open.price > open.value ? "  ·  over the odds" : ""))
        : open.kind === "fitted"
          ? (open.fit > 0 ? "FITTING  " + Math.ceil(open.fit) + "s"
                          : "on the ship  ·  takes no room")
          : open.weight + " CARGO SLOTS" +
            (open.n > 1 ? "  ·  " + open.held + " ALL TOLD" : "");
      label(foot, cardX + 12, cardY + bh - 13, SIZE.cap,
            open.kind === "fitted" ? VIOLET_LOW : CASH, "left", 0.9, "0.06em");
      if (open.n > 1) {
        label("×" + open.n, cardX + bw - 12, cardY + bh - 13, SIZE.cap,
              open.colour, "right", 0.85);
      }
      // The card closes itself; so does pressing its cell again.
      tap({ x: cardX, y: cardY, w: bw, h: bh, act: () => { cargoPick = null; } });
    }

    const rows = Math.ceil(cells.length / cols);
    const total = rows * (CELL + CGAP) + 20;
    cargoPg.scroll = Math.max(0, Math.min(Math.max(0, total - viewH),
                                          cargoPg.scroll));
    HUD.cargoHeight = total;
    HUD.cargoView = viewH;
    if (total > viewH) {
      scrollHint(SCREEN_W - 14, viewTop + 6, viewH - 12,
                 cargoPg.scroll / Math.max(1, total - viewH));
    }

    pageNav(st, "inventory", SHIP_TABS, SHIP_TONE);
    closeButton(st.onClose || (() => {}));
  };

  /* ═══ THE RECORD ══════════════════════════════════════════════════════════
     Everything the run has *accumulated*, as against everything it is carrying.
     These five bands used to sit under the cargo and the slots on one page,
     which made the inventory eight panels deep and buried the two numbers a
     player checks on every dock under four they read once a trip.

     They are one page now and they belong together: who you are to the powers,
     who knows your name, the book, what has happened, and the gate you are
     building. None of it is in the hold. */
  let recPg = { scroll: 0 };
  HUD.recordOpened = function () { recPg.scroll = 0; };
  HUD.recordScrollBy = function (dy, total, view) {
    const max = Math.max(0, total - view);
    recPg.scroll = Math.max(0, Math.min(max, recPg.scroll + dy));
  };

  HUD.drawRecord = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };
    const flags = st.standings || [];
    const others = st.others || [];

    pageFrame("RECORD",
              (st.shipName || "") + "   \u00b7   " + money(st.cash || 0), "",
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
            bad ? WARN : warm ? CASH : VIOLET_DIM, "left", bad ? 1 : 0.85, "0.1em");
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
    panel(full.x, y, full.w, knownH, CASH, "WHO KNOWS YOU",
          grudges.length ? "SOMEBODY IS LOOKING FOR YOU" : "");
    if (!friends.length && !grudges.length) {
      fitText("nobody out here knows you by name yet — help somebody, " +
              "or let somebody get away",
              full.x + PAGE.PAD, ROW(y, 0) + 2, SIZE.cap, VIOLET_LOW, "left",
              0.6, full.w - PAGE.PAD * 2);
    }
    friends.forEach((f, i) => {
      const yy = ROW(y, i) + 2;
      fitText(f.name, full.x + PAGE.PAD, yy, SIZE.cap, CASH, "left", 0.95, 280,
              "0.06em");
      label(f.faction, full.x + PAGE.PAD + 300, yy, SIZE.cap, VIOLET_DIM,
            "left", 0.7, "0.08em");
      fitText(f.why === "water" ? (f.repaid ? "you gave them water · squared"
                                            : "you gave them water")
                                : (f.repaid ? "you got them out of it · squared"
                                            : "you got them out of it"),
              full.x + full.w - PAGE.PAD, yy, SIZE.cap,
              f.repaid ? VIOLET_LOW : CASH, "right", f.repaid ? 0.5 : 0.8, 300);
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

  /* ═══ THE JUMP GATE ═══════════════════════════════════════════════════════
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

  /* ── the gate, as bands ───────────────────────────────────────────────────
     Drawn against a `y` you hand it rather than against the top of a page, so
     the same three panels can be the whole of the yard's page and the first
     thing on the record. They were one page and a door to it, which meant the
     one list telling you where to go next lived behind a panel that said only
     that it existed. Returns where it finished. */
  function missionBands(st, full, y0) {
    const { ctx, SCREEN_W } = api;
    const b = st.builds || { name: "THE JUMP GATE", does: "", blurb: "" };
    const done = st.built || 0, need = st.needs || 6;
    const finished = done >= need;

    /* ── what is being built ───────────────────────────────────────────────
       The ring stays: it is the same shape the yard draws out in the world, one
       segment a part, and it is the only progress readout in the mode that is a
       picture of the thing rather than a bar. It sits at the end of the header
       row rather than in the middle of the page, so the words lead. */
    const headH = PANEL_H(2);
    panel(full.x, y0, full.w, headH, finished ? CASH : VIOLET,
          finished ? "BUILT" : "BUILDING", done + " / " + need);
    fitText(b.name, full.x + PAGE.PAD, ROW(y0, 0) + 4, SIZE.head,
            finished ? CASH : VIOLET, "left", 1, full.w - 320, "0.12em");
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
      api.glow(CASH, 3.4, 0.95, () => {
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
       better to spend two hundred pixels once the gate is open — see the long
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
                   : (need - done) + " PARTS STILL OUT THERE");
    fitText(finished
              ? "every part is in. that was the tutorial."
              : "six parts, scattered across the sector. find one, fly it home to " +
                "the yard, and it goes into the gate.",
            full.x + PAGE.PAD, ROW(listY, 0) + 2, SIZE.cap, VIOLET_DIM, "left",
            0.7, full.w - PAGE.PAD * 2);
    man.forEach((m, i) => {
      const y = ROW(listY, i + 1);
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
      fitText(have ? "fitted" : aboard ? "aboard \u2014 take it to the gate" : m.clue,
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
      const ly = listY + PANEL_H(man.length + 1) + PAGE.STEP;
      panel(full.x, ly, full.w, PANEL_H(2), ICE,
            L.have ? L.name + " \u2014 FITTED" : L.name,
            L.have ? (api.touchOnly ? "READY" : "READY  \u00b7  [R] TO RUN")
                   : money(L.cost));
      fitText(L.have ? L.does : L.blurb, full.x + PAGE.PAD, ROW(ly, 0) + 2,
              SIZE.cap, L.have ? ICE : VIOLET_DIM, "left", 0.85,
              full.w - (L.have ? 280 : 320));
      if (!L.have) {
        /* Two hundred wide was not enough for "BUILD IT   ¤2,400" and the
           price is the half that got cut — the button read "BUILD IT ¤2,…",
           which is the one number on it anybody needs. Wider, and the blurb
           beside it gives up the room. */
        button("BUILD IT   " + money(L.cost), full.x + full.w - PAGE.PAD - 118,
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

  HUD.drawYardPage = function (st, dt) {
    const { ctx, SCREEN_W } = api;
    st = st || {};
    const b = st.builds || { name: "THE JUMP GATE", does: "", blurb: "" };
    const done = st.built || 0, need = st.needs || 6;
    const finished = done >= need;
    const full = { x: PAGE.EDGE, w: SCREEN_W - PAGE.EDGE * 2 };

    /* The subtitle counted parts, which stops being news the moment they are
       all in — "6 OF 6 PARTS FITTED" is a page telling you about yesterday. Once
       the gate is open it counts the thing that is still counting. */
    const LL = st.longList || [];
    pageFrame(st.atYard ? "THE JUMP GATE" : "MISSIONS",
              finished
                ? (LL.length
                     ? LL.filter(p => p.have).length + " OF " + LL.length +
                       " HARD-TO-FIND PARTS"
                     : "THE GATE IS OPEN")
                : done + " OF " + need + " PARTS FITTED",
              "", SHIP_TONE);

    missionBands(st, full, PAGE.TOP);
    pageNav(st, "missions", SHIP_TABS, SHIP_TONE);
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
      fitText("worth about " + money(d.worth), L.x + PAGE.PAD,
              ROW(by, carried.length), SIZE.cap, WARN, "left", 0.65,
              L.w - PAGE.PAD * 2);
    }

    panel(R.x, by, R.w, bh, CASH_DIM, "STILL YOURS", "NONE OF IT TAKEN");
    [d.cash + " CASH",
     d.found + " ALMANAC " + (d.found === 1 ? "ENTRY" : "ENTRIES"),
     fmtCells(d.charted) + " CELLS CHARTED",
     "the gate and everything fitted"
    ].forEach((k, i) => {
      label("·", R.x + PAGE.PAD, ROW(by, i), SIZE.cap, CASH_DIM, "left", 0.6);
      fitText(k, R.x + PAGE.PAD + 16, ROW(by, i), SIZE.cap, CASH_DIM, "left",
              0.8, R.w - PAGE.PAD * 2 - 20);
    });

    /* Not lost and not kept: still out there. A part you were carrying stays
       exactly where you died and is on the chart by name, and this is the line
       that says so — because a part that vanished from your hold with no
       explanation reads as a bug, and a trip you have to make reads as a trip
       only if somebody tells you to make it. */
    if (d.dropped && d.dropped.length) {
      const line = d.dropped.join("  \u00b7  ");
      label("STILL OUT THERE", cx, by + bh + 30, SIZE.cap, AMBER, "center",
            0.9, "0.2em");
      fitText(line + "  \u2014  where you fell, on the chart, waiting",
              cx, by + bh + 54, SIZE.cap, AMBER_DIM, "center", 0.85,
              SCREEN_W - PAGE.EDGE * 2);
    }

    /* Under whichever of the two lines above is showing, so the two cannot
       print through each other on a run where both are true. */
    if (st.deaths > 1) {
      const dy = (d.dropped && d.dropped.length) ? 82 : 28;
      label("DEATH " + st.deaths, cx, by + bh + dy, SIZE.cap, VIOLET_LOW,
            "center", 0.6, "0.2em");
    }

    button(api.touchOnly ? "BACK TO THE STATION"
                        : "BACK TO THE STATION   [ENTER]",
           cx, SCREEN_H - 44, 420, 46, CASH, st.onRespawn || (() => {}));
  };

  /* ═══ WHAT IS THIS ════════════════════════════════════════════════════════
     The card you get for pressing `E` on something with a name. The one page in
     this mode that is only words, and it is deliberately only words: the thing
     itself is out there on the screen behind it, drawn at the size it really is,
     so a picture of it here would be a worse copy of something you are already
     looking at.

     It is a card rather than a page — no navigation strip, no tabs, nothing to do
     on it. You asked a question and this is the answer, and anything you press
     closes it. A card with buttons on it is a page, and a page is a place you
     have to leave rather than something that gets out of your way.

     The world keeps running behind it, and at 0.88 alpha you can see it doing so.
     That is on purpose: this is read in flight, and a screen that hid the rock
     coming at you while it explained a monument would be a trap. */
  HUD.drawLore = function (st, dt) {
    const { ctx, SCREEN_W, SCREEN_H } = api;
    st = st || {};
    const card = st.lore;
    if (!card) return;
    const colour = card.colour || VIOLET;

    pageFrame(card.name, card.kind,
              api.touchOnly ? "TAP ANYWHERE TO CLOSE" : "E, OR ESC, CLOSES");

    /* One column, left-aligned, no wider than about seventy characters. Centred
       prose reads as a poem and full-width prose on a 1,680-wide screen is a line
       your eye loses its place in on the way back. */
    const colW = Math.min(SCREEN_W - PAGE.EDGE * 2, 860);
    const x = Math.round((SCREEN_W - colW) / 2);

    // The kind, stated once in its own colour, so the card is identifiable in
    // half a second by something other than reading it.
    label(card.kind, x, 150, SIZE.head, colour, "left", 1, "0.2em");
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 166); ctx.lineTo(x + colW, 166);
    ctx.stroke();
    ctx.restore();

    /* The first line of any card is the one-sentence answer — what this thing
       *is* — so it is drawn bigger than the rest. Everything after it is why you
       might care, and it reads at caption size like the rest of the interface.

       The whole block is measured before it is drawn and then floated in the
       space between the rule and the footer, because these cards run from three
       lines to eleven and a fixed top would leave the short ones stranded against
       the ceiling. */
    const lead = SIZE.head, body = SIZE.val;
    const leadStep = 30, bodyStep = 26, gap = 16;
    const blocks = (card.lines || []).map((t, i) => ({
      lines: wrapLines(t, i === 0 ? lead : body, colW),
      size: i === 0 ? lead : body,
      step: i === 0 ? leadStep : bodyStep
    }));
    /* A card with nothing to say draws its heading and stops. Every builder in
       the game supplies lines, so this is not reachable today — but the next one
       that forgets would not draw a short card, it would throw out of the render
       loop on `blocks[0]` and take the whole frame with it. A black screen is a
       long way to fall for a missing sentence. */
    if (!blocks.length) { closeButton(st.onClose); return; }
    const tall = blocks.reduce((h, b) => h + b.lines.length * b.step + gap, 0) - gap;
    const top = 196;
    const room = SCREEN_H - 76 - top;
    let y = top + Math.max(0, Math.round((room - tall) / 2)) + blocks[0].step;

    blocks.forEach((b, i) => {
      for (const line of b.lines) {
        label(line, x, y, b.size, i === 0 ? colour : VIOLET,
              "left", i === 0 ? 1 : 0.88);
        y += b.step;
      }
      y += gap;
    });

    // Anything at all. It is an answer, not a form.
    tap({ x: 0, y: 0, w: SCREEN_W, h: SCREEN_H, act: st.onClose || (() => {}) });
  };

  /* ═══ A WORLD YOU CAN LAND ON ═════════════════════════════════════════════
     About one world in twenty has somebody on it, and what they have is water
     and food. Deliberately not a station: no cargo bought, no refits sold, no
     almanac verbs — a station is a shipyard and this is a village with a well.
     Keeping the two apart is what makes finding a station matter.

     The page is small on purpose. It answers "can I fill up here, and what will
     it cost", and then it gets out of the way. */
  /* An inhabited world is a market with weather. Same page as a station, and
     deliberately so: what you want to know on arriving anywhere with people in
     it is what they will give you for the hold and what they have on the shelf.

     What the globe and the two fill buttons used to say is all still here, as
     rows — the water, the food, and the one thing this rock is made of — and the
     free option is the footer, because a player who cannot afford the water is
     the only one who needs it and they need one line, not a paragraph. */
  HUD.drawLanded = function (st, dt) {
    st = st || {};
    const w = st.landed;
    if (!w) return;
    marketPage(st, w.name,
               w.band + "   \u00b7   " + (st.cash || 0) + " CASH",
               w.air ? "the atmosphere can be skimmed for water \u2014 slow, and free"
                     : "airless, and lived in anyway",
               "refit", st.onClose || (() => {}), PLACE_TABS);
  };

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
              (st.shipName || "SKIFF") + "  \u00b7  " + money(st.cash),
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
      const colour = sh.flying ? CASH : reach ? tone : WRECKC;

      ctx.save();
      ctx.fillStyle = sh.flying ? CASH : tone;
      ctx.globalAlpha = on ? 0.13 : 0.025;
      ctx.fillRect(c.x, y, c.w, cardH);
      ctx.strokeStyle = on ? (sh.flying ? CASH : tone) : tone;
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
      fitText(sh.flying ? "FLYING" : sh.owned ? "OWNED" : money(sh.cost),
              c.x + c.w - PAGE.PAD, y + 98, SIZE.cap,
              sh.flying ? CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
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
    const dy = gridTop + rowsShown * (cardH + PAGE.STEP);
    const statCols = api.touchOnly ? 5 : 9;
    const detailH = PANEL_H(api.touchOnly ? 7 : 5);
    panel(PAGE.EDGE, dy, SCREEN_W - PAGE.EDGE * 2, detailH,
          sh.flying ? CASH : tone, sh.name,
          "BEST · " + (sh.best === "FIRE RATE" ? "RATE" : sh.best));

    /* The cards already identify each hull by silhouette. Repeating it here
       made the definition panel lopsided, so the category colour becomes a
       quiet rail and the information begins on one clean left edge. */
    ctx.save();
    ctx.fillStyle = sh.flying ? CASH : tone;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(PAGE.EDGE, dy + PAGE.HEAD, 4, detailH - PAGE.HEAD);
    ctx.restore();
    label(sh.flying ? "FLYING"
        : sh.owned ? "OWNED"
        : sh.afford ? "AFFORDABLE" : "LOCKED",
          PAGE.EDGE + PAGE.PAD, ROW(dy, 0), SIZE.cap,
          sh.flying ? CASH : sh.owned ? VIOLET_DIM : sh.afford ? CASH_DIM : WARN,
          "left", 0.8, "0.12em");

    const best = k => list.reduce((m, o) => Math.max(m, o[k]), 0.0001);
    const stats = [
      ["HULL",  sh.hull / best("hull"),   String(sh.hull)],
      ["DAMAGE", sh.dmg / best("dmg"), sh.dmg.toFixed(2) + "x"],
      ["RATE", sh.rate / best("rate"), sh.rate.toFixed(2) + "x"],
      ["CARGO", sh.cargo / best("cargo"), String(sh.cargo)],
      ["SPEED", sh.speed / best("speed"), sh.speed.toFixed(2) + "x"],
      ["ACCEL", sh.accel / best("accel"), sh.accel.toFixed(2) + "x"],
      ["TURN",  sh.turn / best("turn"),   sh.turn.toFixed(2) + "x"],
      /* "GRIP", and the bar runs the same way as every other bar on this page.
         It read DRAG with the fill inverted — longest for the *lowest* number —
         which was right while drag was friction and less of it was better. It
         is how hard the hull is glued to where you point it now, so more of it
         is more of something, and a bar that fills backwards next to seven that
         do not is a bar nobody reads correctly. */
      ["GRIP", sh.drag / best("drag"), sh.drag.toFixed(2)],
      /* What one pull of the trigger sends. Three on almost everything, so the
         bar is nearly always full and the two hulls that send four are the only
         thing on this row worth seeing — which is exactly what it is for. */
      ["BURST", (sh.burst || 3) / best("burst"), String(sh.burst || 3)]
    ];
    const statX = PAGE.EDGE + PAGE.PAD;
    const statArea = SCREEN_W - PAGE.EDGE * 2 - PAGE.PAD * 2;
    const gap = api.touchOnly ? 8 : 12;
    const sw = (statArea - gap * (statCols - 1)) / statCols;
    stats.forEach(([name, frac, val], i) => {
      const row = Math.floor(i / statCols);
      const x = statX + (i % statCols) * (sw + gap);
      const y = ROW(dy, 1 + row * 2) - 4;
      fitText(name, x, y, SIZE.cap, tone, "left", 0.78, sw, "0.08em");
      label(val, x, y + 18, SIZE.cap, WRECKC, "left", 0.95);
      barAt(x, y + 25, sw, 7, frac, sh.flying ? CASH : tone, false);
    });

    const reach = sh.owned || sh.afford;
    button(sh.flying ? "FLYING" : sh.owned ? "FLY" :
             sh.afford ? "BUY " + money(sh.cost) : "NEED " + money(sh.cost),
           SCREEN_W - PAGE.EDGE - 110, dy + detailH - 34, 200, 40,
           sh.flying ? VIOLET_LOW : reach ? CASH : WARN,
           sh.flying || !reach ? null
             : () => st.onBuyShip && st.onBuyShip(sh.key),
           false, !sh.flying && reach);

    pageNav(st, "hangar", PLACE_TABS, PLACE_TONE);
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
