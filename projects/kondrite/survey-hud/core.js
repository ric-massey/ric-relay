"use strict";
/* KONDRITE — SURVEY INTERFACE
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

/* ── in files ────────────────────────────────────────────────────────────────
   This was one 8,000-line survey-hud.js wrapped in a function. It is the files
   in survey-hud/ now, one per page, cut where the page headings already were
   and loaded in the order they ran — so, like game/, they share the page's
   one top-level scope instead of a closure, and the same rules hold: code
   that runs at load sees only earlier files, and no two files (here or in
   game/) may declare the same top-level name. That is why three of this
   interface's names carry a prefix the game's do not: HUD_CASH, hudMoney and
   drawPanelDevices. They are the same things under the same meaning. */

const HUD = {};

/* ── palette ──────────────────────────────────────────────────────────────
   Survey takes a violet accent so it reads as its own mode at a glance and
   ties to the site's exploration room, but the chrome stays amber: this is
   still Kondrite's interface, not a different game's. */
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
const HUD_CASH       = "#6dffbf";
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
   that paid for it. See archive/SURVEY-BUILT.md, "The places", item E. */

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

/* Something picked up, as one line that counts: "ICE x3: put in CARGO". Salvage
   comes aboard a mote at a time, and a line per mote would be twenty lines for
   one broken rock — so a pickup of the same thing to the same place while its
   line is still up adds to the count instead of adding a line. Not written to
   the log per mote either; the log gets the line once, when it first appears. */
HUD.pickup = function (name, n, where, colour) {
  if (!name) return;
  const key = name + "|" + where;
  const span = 4.5;
  const had = notes.find(x => x.pick === key);
  if (had) {
    had.count += n || 1;
    had.text = name + " x" + had.count + ": put " + where;
    /* Held up rather than restarted: `life - t` is the fade-in, so resetting
       both to the same number would blink the line out and back on. */
    if (!had.open) { had.t = Math.max(had.t, 3); had.life = had.t + 1; }
    return;
  }
  const text = name + " x" + (n || 1) + ": put " + where;
  HUD.notify(text, "", colour, span);
  const made = notes.find(x => x.text === text && !x.pick);
  if (made) { made.pick = key; made.count = n || 1; }
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
const hudMoney = n => CASH_MARK + Math.round(Number(n) || 0).toLocaleString("en-US");
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
   arrived — and Kondrite's amber is the chrome, which is yours. Violet is a
   place. Amber is your ship. */
/* The station's own rooms. `stationinv` is the inventory wearing the shop's
   frame and `wormhole` is the mouth's map; both are places you are standing in
   rather than pages about your ship, which is why they belong on this strip
   and not on the amber one. See `HUD.drawStationInv`. */
const PLACE_TABS = ["refit", "hangar", "stationinv", "wormhole", "arcade"];
const SHIP_TABS  = ["ship", "inventory", "record", "sector", "craft", "chart"];
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
    /* The station's own copy of the inventory, and the mouth's map. Both are
       live only where you are standing in the place that has them: the
       inventory needs a counter to stand at, and a mouth needs a mooring at
       both ends.

       The mouth's tab used to not exist at all until it was open, on the
       argument that *a door to a thing you have not made is not navigation*.
       That was right for one tab on a station that worked. It is wrong now
       that six of the station's rooms are dark and each one is waiting on a
       named part, because with six the darkness **is** the objective — take
       them away and the place is a shop with two items and no reason to
       leave. It draws dim, like the berth beside it. */
    { key: "stationinv", name: "INVENTORY",
      live: !!(st.docked || st.landed), act: st.onStationInv },
    { key: "wormhole",  name: "WORMHOLE", live: !!(st.wormhole && st.docked),
      act: st.onWormhole },
    /* The machines in the corner. Live wherever you can trade — a station's
       counter or an inhabited world's surface — because a cabinet you can
       only find at some stations is a cabinet nobody finds. It is the one
       room here that is not about the sector at all. */
    { key: "arcade",    name: "SIMULATORS",
      live: !!(st.docked || st.landed), act: st.onArcade },
    /* Two pages, because they are two jobs. The ship is what you are flying
       and what is bolted to it; the cargo is everything that is merely inside
       it. They were one page called INVENTORY that did both and named one. */
    { key: "ship",      name: "SHIP",     live: true, act: st.onShip },
    { key: "inventory", name: "CARGO",    live: true, act: st.onInventory },
    { key: "record",    name: "RECORD",   live: true, act: st.onRecord },
    /* The living world's own page: the powers, what happened, who is
       wanted. It is yours wherever you are, like the record, and it is the
       thing the strip under the minimap opens. */
    { key: "sector",    name: "SECTOR",   live: true, act: st.onSector },
    { key: "craft",     name: "CRAFTING", live: true, act: st.onCraftPage },
    { key: "missions",  name: "MISSIONS", live: true, act: st.onMissions },
    { key: "chart",     name: "MAP",      live: true, act: st.onChart }
  ];
  /* `only` narrows the strip for a page that should not be offering all of it.
     The shop is the one that should not: a jobs board and a star chart are
     things you read on your own ship, not things the counter you are standing
     at hands you — and a place with three doors out of it stops feeling like
     somewhere you went to. */
  /* Nothing hides any more. `gone` was one flag for one tab and it is out
     with the jump gate — every door the station has is in the strip, in the
     same place, whether or not it opens yet. */
  const tabs = only ? all.filter(t => only.indexOf(t.key) >= 0) : all;
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
