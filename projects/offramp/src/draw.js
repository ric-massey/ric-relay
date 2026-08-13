/* ══════════════════════════════════════════════════════════════════════
   Drawing the world.

   One transform, applied once, at the top of this file and nowhere
   else. The car is nailed to a fixed spot on the screen pointing up,
   and everything else is expressed relative to that:

       d       = world point − car
       local   = d rotated by the car's heading
       screen  = (CX + local.x,  PY − local.y)

   The y flip lives on that last line. Below it, screen y grows
   downward like every other canvas; above it, world y grows the way
   north does. Mixing the two up is the single easiest way to break
   this file, so it happens once, here, and is never done again.

   ── how a road becomes pixels ───────────────────────────────────────
   For each station on a road we work out its position on screen and
   its right-hand normal on screen, and after that every band of the
   cross-section — gravel, hard shoulder, tarmac, barrier — is just a
   quad between two stations at two offsets. A hundred stations by a
   dozen bands is the whole road surface, and none of it needs to know
   that the road is curving, because the curve is already in where the
   stations are.

   Markings are done separately, walking along in dash-length steps
   rather than station steps, because a dashed line that snapped to a
   station grid would visibly stretch and squash as the road bent.

   ── the order of things ─────────────────────────────────────────────
     grass, and what grows on it
     every road, far ones first
     the gore of each ramp, painted over both roads that form it
     signs, signals, guardrails, lamps
     you
     particles, marks, then the light of whatever time it is

   Night is a wash over the finished frame plus additive glows, which
   is why it is last and why the lamps are drawn before it: a street
   light has to be a light *on* the scene, not a shape in it.
   ══════════════════════════════════════════════════════════════════════ */

const Draw = (() => {
  "use strict";

  const R = Road, X = Raster;

  /* ── the shape of the picture ───────────────────────────────────────
     The buffer was a fixed 256 × 416 letterboxed into whatever the page
     gave it. That is wrong twice over. On a monitor the cabinet is far
     wider than 256 world pixels, so the sides of the screen were bezel
     rather than ground. And on a PHONE — the narrower screen of the two
     — a fit that takes the SMALLER of the two ratios drew the whole
     game smaller than it drew it on a desktop, which is the opposite of
     what a small screen wants.

     So the buffer is no longer a fixed shape. `offramp.js` decides how
     many CSS pixels one world pixel is worth (see `fit`), and the
     buffer is however much world fits in the cabinet at that scale.
     Nothing is letterboxed on either axis, which means the edges of the
     screen are grass and trees instead of black, and the phone is
     zoomed in rather than out.

     Road dimensions never move: a lane is 20.5 world pixels here and on
     everything else. What changes is how much of the world you can see
     and how large a world pixel is drawn, which is what a camera does.

     Everything below follows from VW and VH:
       CX    dead centre, across
       PY    where the car sits along it — NOT a fixed fraction, see below
       VIEW  the far corner in world pixels, and therefore the radius
             outside which nothing needs projecting at all */
  let VW = 0, VH = 0, CX = 0, PY = 0, VIEW = 0;
  function resize(w, h) {
    VW = Math.max(64, Math.round(w));
    VH = Math.max(64, Math.round(h));
    CX = Math.round(VW / 2);
    /* The road ahead is worth more than the road behind: ahead is where
       the traffic you still have to do something about is. On a tall
       buffer the car sits at the old 77% and there is plenty of both.
       On a short one the FRONT is held at 300 px — the 54 m the old
       256 × 416 always gave — and the mirror gives way instead, down to
       a floor of 64 px, which is still three car lengths of it. */
    PY = Math.min(VH - 64, Math.max(Math.round(VH * 0.77), 300));
    if (PY < VH * 0.5) PY = Math.round(VH * 0.77);   // a cabinet too short for either rule
    VIEW = Math.ceil(Math.hypot(Math.max(CX, VW - CX), Math.max(PY, VH - PY))) + 16;
  }
  resize(256, 416);                      // the old shape, until `fit` says otherwise

  /* ── palette ────────────────────────────────────────────────────────
     Packed once. Small on purpose: the whole game is a dozen greys, a
     green, and the four colours road paint comes in. */
  const C = {};
  const pal = {
    grass: "#2c5a34", grassDk: "#245029", grassLt: "#357040",
    tree: "#16321d", treeDk: "#102416", bush: "#1d4526",
    gravel: "#6b5b45", gravelDk: "#5b4c39",
    /* Lifted 2026-08-12, on the report that the road and the cars were
       too dark to read. The surface was #3a3a44 — about 23% luma —
       under a night pass that lays 66% of a dark blue over it, so the
       picture spent most of the clock somewhere near black. These are
       roughly +12 luma each, which keeps the greys reading as tarmac
       rather than concrete while putting the paint and the vehicles
       clear of their background. The RELATIVE spacing is unchanged:
       shoulder still sits just under the running surface, patches just
       over it, stains under both. */
    asphalt: "#47474f", asphaltDk: "#3f3f48", patch: "#53535d", stain: "#3a3a43",
    shoulder: "#414149",
    line: "#e8e2cc", lineDim: "#b8b2a0", yellow: "#f0b429",
    kerb: "#8a8a92", barrier: "#9aa0aa", barrierDk: "#4e535c",
    rail: "#8f949e", post: "#565b64",
    glass: "#1d2430", tail: "#ff5a3c", head: "#fff6c8", amber: "#ffb020",
    red: "#ff3b26", green: "#2fe07a",
    player: "#d94b3a", playerTrim: "#f2e6cf", playerDead: "#8e3128",
    cone: "#ff7a33", coneBand: "#f2e6cf",
    signGreen: "#1c5c34", signBlue: "#1d3f7a", signWhite: "#e8e2cc",
    work: "#e8761c",            /* temporary traffic control orange */
    smoke: "#7a7a86", fire: "#ffb020", shadow: "#0c0c10",
    dark: "#1a1a20",
  };
  for (const k in pal) C[k] = X.hex(pal[k]);

  /* ── camera ─────────────────────────────────────────────────────────
     Set once a frame. `sc` and `ss` are the cosine and sine of the
     car's heading; every projection below is two multiplies and an add. */
  let camX = 0, camY = 0, sc = 1, ss = 0, camH = 0;
  const nearScratch = new Map();
  function camera(x, y, h) {
    camX = x; camY = y; camH = h;
    sc = Math.cos(h); ss = Math.sin(h);
  }
  function sx(wx, wy) { return CX + ((wx - camX) * sc - (wy - camY) * ss); }
  function sy(wx, wy) { return PY - ((wx - camX) * ss + (wy - camY) * sc); }

  /* stable pseudo-random per world slot, so nothing twitches as it scrolls */
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }
  const hash2 = (a, b) => hash(((a * 73856093) ^ (b * 19349663)) | 0);

  /* ── time of day ────────────────────────────────────────────────────
     Cycles on distance, not on the clock, because distance is the only
     thing in this game that only ever increases. */
  const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  let phase = 0;
  const setPhase = (p) => { phase = p % 1; };
  function night() {
    return Math.max(0, Math.min(1, smooth((phase - 0.30) / 0.14) - smooth((phase - 0.80) / 0.13)));
  }
  function warmth() {
    return Math.max(smooth((phase - 0.24) / 0.09) - smooth((phase - 0.36) / 0.08),
                    smooth((phase - 0.80) / 0.08) - smooth((phase - 0.93) / 0.08));
  }

  /* ── station scratch ────────────────────────────────────────────────
     Recomputed per road per frame. Screen position of the centreline
     and the screen-space right normal, which is all a quad needs. */
  const SX = new Float64Array(600), SY = new Float64Array(600);
  const NX = new Float64Array(600), NY = new Float64Array(600);
  const Q = new Float64Array(8);

  function band(a, b, uA, uB, col) {
    Q[0] = SX[a] + NX[a] * uA; Q[1] = SY[a] + NY[a] * uA;
    Q[2] = SX[a] + NX[a] * uB; Q[3] = SY[a] + NY[a] * uB;
    Q[4] = SX[b] + NX[b] * uB; Q[5] = SY[b] + NY[b] * uB;
    Q[6] = SX[b] + NX[b] * uA; Q[7] = SY[b] + NY[b] * uA;
    // cheap reject: entirely off one side of the screen
    if ((Q[0] < 0 && Q[2] < 0 && Q[4] < 0 && Q[6] < 0) ||
        (Q[0] > VW && Q[2] > VW && Q[4] > VW && Q[6] > VW) ||
        (Q[1] < 0 && Q[3] < 0 && Q[5] < 0 && Q[7] < 0) ||
        (Q[1] > VH && Q[3] > VH && Q[5] > VH && Q[7] > VH)) return;
    X.poly(Q, col);
  }

  /* ── markings ───────────────────────────────────────────────────────
     One quad between two points on the road, at a fixed offset across.

     `seg` is short by rule, and the rule matters: a quad is a straight
     line between its ends, so a marking drawn as one long quad is a
     CHORD, and on anything that curves it leaves the road entirely. An
     edge line drawn in a single piece down a ramp cuts the corner and
     lands in the grass, which is exactly the sort of bug that looks
     like a rendering glitch and is actually a geometry mistake. Solid
     lines are therefore chopped into short pieces and dashes are short
     enough to be pieces already. */
  const SEGQ = new Float64Array(8);
  function seg(r, a, b, u, w, u2) {
    /* ── nothing is painted through a junction ──────────────────────────
       Where an exit ramp crosses the street it serves, neither road
       marks: no edge line, no lane line and no centre line runs through
       the mouth of an intersection, and the absence is most of what
       says one is there. `World.terminal` measures where that mouth is
       on both roads and leaves the range here.

       It is checked in `seg` rather than in each marking because `seg`
       is the one funnel every piece of paint in this file goes through
       — the edge lines, the dotted lane, the yellow, the through
       stripes, the ramp's own two lines. Anywhere else it would be six
       tests that could drift apart, and the mouth would keep one line
       nobody remembered to suppress. A road with no junction on it
       reads one undefined property and leaves. */
    if (r.gap && R.suppressed(r.gap, Math.round((a + b) / (2 * R.STEP)))) return;
    const p = R.at(r, a, u), q = R.at(r, b, u2 == null ? u : u2);
    const x1 = sx(p.x, p.y), y1 = sy(p.x, p.y);
    const x2 = sx(q.x, q.y), y2 = sy(q.x, q.y);
    if ((x1 < 0 && x2 < 0) || (x1 > VW && x2 > VW) ||
        (y1 < 0 && y2 < 0) || (y1 > VH && y2 > VH)) return;
    /* A marking is a QUAD of constant perpendicular width, not a walked
       line of whole pixels.

       It used to be X.stroke, which stepped along laying down exactly
       `w` rounded pixels across, because a quad through the old poly()
       was thought to fatten on a diagonal — each scanline spanning
       w/cos θ instead of w. That reading was wrong: a one-pixel line at
       forty-five degrees really does cross 1.41 pixels of a row, and
       filling them is what makes it look one pixel wide. What actually
       went wrong was the ROUNDING — with no coverage, a 1.1-px line
       landed on one pixel or two depending where its edges fell, so it
       flickered as it scrolled, and the fix was to quantise the width
       and accept the staircase.

       poly() blends its span ends now, so the honest version works: lay
       the quad along the true normal and let coverage do the rest. The
       dashes bend with the road instead of stepping down it.

       ── a piece is not a shape ────────────────────────────────────────
       Span coverage fixed how a marking sits ACROSS a row and did
       nothing for where it starts and stops ALONG one, because a piece
       drawn straight onto the buffer has to claim whole rows to tile
       with the piece after it. So a dash 6.4 rows long drew as 6 or 7
       depending where it fell, and a line lying across the screen
       quantised in width.

       The fix is not to draw a piece at all. Every piece goes into the
       coverage mask, the pieces of one marking sum there — butted ends
       contributing 0.3 and 0.7 of a row make exactly the 1.0 an unbroken
       line would have — and `paint()` lays the finished thing down in a
       single pass. Joints cannot show, because no pixel is touched
       twice. See maskPoly in raster.js. */
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    if (w < MIN_W) w = MIN_W;             // see MARK_W: thinner than this flickers
    const hx = (-dy / L) * w / 2, hy = (dx / L) * w / 2;
    SEGQ[0] = x1 - hx; SEGQ[1] = y1 - hy;
    SEGQ[2] = x1 + hx; SEGQ[3] = y1 + hy;
    SEGQ[4] = x2 + hx; SEGQ[5] = y2 + hy;
    SEGQ[6] = x2 - hx; SEGQ[7] = y2 - hy;
    X.maskPoly(SEGQ);
  }

  /* One marking, finished and laid down. Every generator below builds
     its pieces and then calls this exactly once, with the one colour
     that marking is painted in. */
  const paint = (col) => X.maskDraw(col);

  const SOLID_SEG = 10;          // px of road per piece of a solid line

  /* ── how wide a marking has to be to hold still ─────────────────────
     Coverage conserves INK, and the eye does not read ink. It reads the
     brightest pixel and the number of pixels lit, and for a line
     narrower than two of them both of those depend on where the line
     happens to fall between pixel centres.

     A 1.1-px line, measured off the buffer on one row of one frame —
     two lane lines of the same paint, twenty pixels apart:

         x=176  0.44 0.65      peak 0.65, two pixels lit
         x=197  0.94 0.15      peak 0.94, one pixel lit

     Same marking, half the brightness and twice the width, side by side
     on the same road. And because the phase is a function of where the
     line sits on screen, every one of them slides through that whole
     range as the car steers, so the paint breathes. Then the buffer is
     shown at 2.79×, which turns the pair of greys into a smear about
     twice as wide as the crisp one, and that is what the road looked
     wrong as.

     Nothing about it is a rasteriser fault: the ink is exact to a
     hundredth everywhere, and the joints between pieces are invisible.
     It is the width. Below 2 px a line is not guaranteed a single fully
     covered pixel, so its peak is free to vary from w/2 to 1; at 2 px
     and above there is always a saturated core and only the fringe
     moves. raster.js measured that same threshold from the other side
     when the old rounding version was pulled out, and then the markings
     were left under it.

     So: two pixels is the floor, enforced here rather than trusted to
     every call site, and the paint scheme is built on it. On the real
     road an edge line and a lane line are the same 4 inches of white and
     a wide dotted line is twice that, which is what these are now — the
     old 1.1 / 1.25 / 1.6 / 2.2 was four different widths for three
     kinds of line, none of them thick enough to sit still. */
  const MARK_W = 2;              // lane line, edge line, yellow: one width
  const WIDE_W = 4;              // a wide line is twice a normal one
  const MIN_W = 2;               // nothing thinner than a whole pixel core

  function stripe(r, s0, s1, u, w, col, dashOn, dashOff) {
    const L = R.len(r);
    s0 = Math.max(s0, 0.5);
    s1 = Math.min(s1, L - 0.5);
    if (s1 <= s0) return;
    if (dashOff > 0) {
      const step = dashOn + dashOff;
      for (let s = Math.floor(s0 / step) * step; s < s1; s += step) {
        const a = Math.max(s0, s), b = Math.min(s1, s + dashOn);
        if (b > a) seg(r, a, b, u, w);
      }
    } else {
      for (let s = s0; s < s1; s += SOLID_SEG) seg(r, s, Math.min(s1, s + SOLID_SEG), u, w);
    }
    paint(col);
  }

  /* A through-lane boundary exists only while there is pavement on
     both sides of it. This is the dashed line that grows into view as a
     fourth lane opens, or converges with the edge line as one drops. */
  function throughStripe(r, s0, s1, boundary, dirFwd) {
    const on = 17, cycle = 68;                 // MUTCD 10 ft / 30 ft
    for (let s = Math.floor(s0 / cycle) * cycle; s < s1; s += cycle) {
      const a = Math.max(s0, s), b = Math.min(s1, s + on);
      if (b <= a) continue;
      const count = dirFwd ? R.lanesAt(r, (a + b) / 2) : R.backLanesAt(r, (a + b) / 2);
      if (count <= boundary + 0.06) continue;
      /* Measured at BOTH ends of the piece, on both carriageways. The
         oncoming one used to take its second offset from its first,
         which is a flat line and was fine while nothing could move that
         edge — and then exit 368 dropped two lanes off the inside of
         it, which is precisely a boundary that moves. */
      const ua = dirFwd
        ? R.insideAt(r, a) + R.innerAt(r, a) + R.LANE * boundary
        : -(R.insideAt(r, a) + R.innerAtL(r, a) + R.LANE * boundary);
      const ub = dirFwd
        ? R.insideAt(r, b) + R.innerAt(r, b) + R.LANE * boundary
        : -(R.insideAt(r, b) + R.innerAtL(r, b) + R.LANE * boundary);
      if (Math.abs(ub - ua) > R.LANE / 2) continue; // do not slash across a left-exit gore
      seg(r, a, b, ua, MARK_W, ub);
    }
    paint(C.line);
  }

  /* ── terrain ────────────────────────────────────────────────────────
     Grass everywhere, then tufts on a world grid so the ground has
     something to slide past. Drawn before the roads, so no tuft ever
     has to know it is standing on tarmac — the tarmac simply covers it. */
  function ground() {
    X.clear(C.grass);
    const cell = 19;
    const c0x = Math.floor((camX - VIEW) / cell), c1x = Math.ceil((camX + VIEW) / cell);
    const c0y = Math.floor((camY - VIEW) / cell), c1y = Math.ceil((camY + VIEW) / cell);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const h = hash2(cx, cy);
        if (h < 0.42) continue;
        const wx = cx * cell + hash2(cx, cy + 977) * cell;
        const wy = cy * cell + hash2(cx + 331, cy) * cell;
        const px = sx(wx, wy) | 0, py = sy(wx, wy) | 0;
        if (px < -3 || py < -3 || px > VW + 3 || py > VH + 3) continue;
        X.box(px, py, h > 0.9 ? 2 : 1, h > 0.9 ? 2 : 1, h > 0.72 ? C.grassLt : C.grassDk);
      }
    }
  }

  /* ── what grows beside a freeway ────────────────────────────────────
     The buffer is as wide as the screen now, so the ground either side
     of the road is most of the picture, and flat green with tufts on it
     is not what the edge of an Interstate looks like. The right-of-way
     is mown; past it there is scrub, and past that, trees.

     They are hung off the ROAD rather than scattered on a world grid,
     because the one thing a tree must not do is stand on tarmac, and a
     road is the only thing in this file that knows where its tarmac is.
     Every other station puts a clump out beyond its own verge on each
     side, at a distance that is a hash of the station index — so the
     treeline wanders in and out the way a real one does, and never
     twitches, because the hash is of the station and not of anything
     that moves.

     Drawn BEFORE the roads, for the same reason the verge is: where two
     roads run close enough that one road's trees land on the other
     one's surface, the surface simply covers them. Tarmac outranks
     scenery everywhere, automatically, for every pair, without anybody
     having to have thought of that pair in advance.

     A bridge grows nothing — the ground it would grow in is not there —
     and neither does a surface street, which by the time it has a name
     and a signal on it is running through somewhere built. */
  const CANOPY = new Float64Array(16);
  const COS8 = new Float64Array(8), SIN8 = new Float64Array(8);
  for (let i = 0; i < 8; i++) {
    COS8[i] = Math.cos(i * Math.PI / 4);
    SIN8[i] = Math.sin(i * Math.PI / 4);
  }
  /* An octagon, which at a radius of four to eleven pixels is a circle,
     and is convex, which is what poly() needs it to be. */
  function canopy(px, py, rad, col) {
    for (let i = 0; i < 8; i++) {
      CANOPY[i * 2] = px + COS8[i] * rad;
      CANOPY[i * 2 + 1] = py + SIN8[i] * rad;
    }
    X.poly(CANOPY, col);
  }

  /* OFF, on Ric's call, 2026-08-13. The edges of the screen are plain
     grass for now. Everything below is left standing rather than
     deleted because what it cost was not the drawing — it was working
     out that the walk over the stations must not depend on the camera,
     which took two separate bugs and a frame-by-frame instrumented
     count to pin down, and that reasoning is in the comments here. Flip
     this to bring the woods back; nothing else has to change. */
  const TREES = false;

  const TREE_STEP = 2;                   // stations between clumps: 16 px, 2.9 m
  /* How far off screen a station can still plant something visible, and
     it has to be the true worst case or a treeline blinks in at the
     edge of the glass instead of scrolling into it:

       184  the widest half-road on the corridor — an 88 ft median,
            its inside shoulder, and five lanes
        17  outside shoulder
         9  verge
        87  the furthest `gap` puts the fence line
        18  the depth of a clump behind it
        11  and a canopy on the far side of that                       */
  const TREE_MARGIN = 326;
  /* And the same margin as stations, which is how far past the drawn
     span the walk below has to keep going. */
  const TREE_OVERRUN = Math.ceil(TREE_MARGIN / R.STEP);

  /* ── nothing about the camera may decide which trees exist ──────────
     Every hash below is of the station index, so WHICH trees a road
     grows is a property of the road. Twice now the walk over those
     stations has quietly made it a property of the camera instead, and
     both times the whole treeline strobed:

     Stepping `k` from zero sampled i0, i0+2, i0+4 — and `i0` moves one
     station at a time as you drive, so every other frame the PARITY
     flipped and the treeline was replaced by the one growing between
     it. Anchoring the walk to a multiple of TREE_STEP fixes that.

     Then the ENDS. The drawn span runs 90 px of road past where the
     road leaves the view, which is plenty for tarmac and nowhere near
     enough for a tree: a station 90 px off the bottom of the glass
     plants things up to 326 px sideways, and those are on screen. So
     the last station in the span was contributing visible trees, and
     the span end moves a station at a time too — a couple of clumps
     blinking in and out at the edges, which measured as a 30% swing in
     how much of the picture was tree.

     The walk therefore overruns the span by TREE_MARGIN of road at each
     end, far enough that a station outside it cannot reach the glass,
     and the per-station screen test below is left as the only thing
     that decides. That test moves smoothly with the camera, which is
     the property this needed all along.

     It projects its own stations rather than using the shared scratch,
     because the overrun can push the range past the 600 that holds. */
  function trees(entries) {
    for (const e of entries) {
      const r = e.r;
      if (r._i1 == null || r._i1 <= r._i0 || r.street) continue;
      const st = r.st;
      const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
      const lo = Math.max(0, r._i0 - TREE_OVERRUN);
      const hi = Math.min(st.length - 1, r._i1 + TREE_OVERRUN);
      for (let i = Math.ceil(lo / TREE_STEP) * TREE_STEP; i <= hi; i += TREE_STEP) {
        /* One compare kills most of a long road before anything is
           measured on it. */
        const p = st[i];
        const bx = sx(p.x, p.y), by = sy(p.x, p.y);
        if (bx < -TREE_MARGIN || by < -TREE_MARGIN ||
            bx > VW + TREE_MARGIN || by > VH + TREE_MARGIN) continue;
        const th = p.h - camH;
        const nx = Math.cos(th), ny = Math.sin(th);
        const s = i * R.STEP;
        if (R.deckAt(r, s) > 0.5) continue;
        const ed = R.edges(r, s);
        for (let side = -1; side <= 1; side += 2) {
          // where another road is already using this side, it is not woods
          if (R.suppressed(side > 0 ? r.noR : r.noL, i)) continue;
          const h = hash2(i, side > 0 ? 4231 : 9377);
          if (h < 0.34) continue;        // the gaps, without which it is a hedge
          const outer = side > 0 ? ed.uR + sh + R.VERGE : ed.uL - sh - R.VERGE;
          /* Two to fifteen metres past the last gravel. Anything closer
             is inside the clear zone, where a state DOT would have cut
             it down for exactly the reason you are about to find out if
             you leave the road.

             SQUARED, so most of them are near the fence and a few are
             out in the field. Flat, the treeline sat in the middle of
             the grass and a phone — the screen with the least grass on
             it and the one that most needs something growing in it —
             cropped nearly all of it away. */
          const g = hash2(i + 1013, side);
          const gap = 9 + g * g * 78;
          const n = h > 0.86 ? 3 : h > 0.62 ? 2 : 1;
          for (let t = 0; t < n; t++) {
            const j = hash2(i * 7 + t, side * 31 + 5);
            /* The clump's own depth, and deliberately small next to
               `gap`. It used to be j*34, which put the furthest tree
               121 px past the verge — far enough out that on a wide
               road it sat beyond what the station cull below can
               promise to have considered, and blinked. `gap` already
               does the wandering; this only stops a clump being a row. */
            const u = outer + side * (gap + j * 18);
            const along = (t - (n - 1) / 2) * 9 + (j - 0.5) * 10;
            /* Along the road is the station normal turned a quarter
               turn, which in screen space is (−ny, nx). */
            const px = bx + nx * u - ny * along;
            const py = by + ny * u + nx * along;
            const rad = 4 + j * 7;
            if (px < -rad || py < -rad || px > VW + rad || py > VH + rad) continue;
            /* Two discs and not one: the lit crown lifted up and left
               off its own shade is the only thing that says a tree has
               height when you are looking straight down on it. */
            canopy(px + 1, py + 1, rad, C.treeDk);
            canopy(px - 0.5, py - 0.5, rad - 1.2, j > 0.34 ? C.tree : C.bush);
            if (rad > 8) X.px(px - rad * 0.4, py - rad * 0.4, C.bush);
          }
        }
      }
    }
  }

  /* ── the surface of one road ────────────────────────────────────────
     Everything from the gravel outward to the paint. Stations first,
     then bands from the outside in, so each layer covers the seam left
     by the one before it. */
  /* Project the stations of one road into the scratch arrays. Every
     pass below reads these, so a road is projected once per frame no
     matter how many passes touch it. */
  function stations(r, i0, i1) {
    const st = r.st;
    for (let i = i0; i <= i1; i++) {
      const s = st[i];
      const k = i - i0;
      SX[k] = sx(s.x, s.y); SY[k] = sy(s.x, s.y);
      const th = s.h - camH;
      NX[k] = Math.cos(th); NY[k] = Math.sin(th);
    }
  }

  /* ── the verge, and why it is its own pass ──────────────────────────
     Gravel used to be laid by each road immediately before its own
     asphalt. Roads are drawn one after another, so the SECOND road's
     gravel went down on top of the FIRST road's tarmac — a brown band
     straight across a ramp, wherever two roads run near each other.

     `dress()` was supposed to prevent that, but it only ever suppressed
     the pairs the map builder explicitly handed it, over narrow windows.
     Any other two roads that happened to pass close by — a corridor
     beside a beltway, a ramp near an unrelated exit — were never dressed
     against each other at all, and 7.4% of all painted verge was sitting
     on somebody else's sealed surface.

     Ordering fixes it completely and costs nothing: every road's gravel
     goes down, then every road's asphalt covers it. Tarmac outranks
     verge everywhere, automatically, for every pair, without anybody
     having to have thought of that pair in advance. */
  function verge(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s), e2 = R.edges(r, s + R.STEP);
      const uL = Math.min(e.uL, e2.uL), uR = Math.max(e.uR, e2.uR);
      const skipL = R.suppressed(r.noL, i), skipR = R.suppressed(r.noR, i);
      // a bridge has no verge: the ground it would sit on is not there
      if (R.deckAt(r, s) > 0.5) continue;
      if (!skipL) {
        band(k, k + 1, uL - shL - R.VERGE, uL - shL, C.gravel);
        if (hash2(i, 17) > 0.55) band(k, k + 1, uL - shL - 5, uL - shL - 2, C.gravelDk);
      }
      if (!skipR) {
        band(k, k + 1, uR + shR, uR + shR + R.VERGE, C.gravel);
        if (hash2(i, 7) > 0.55) band(k, k + 1, uR + shR + 2, uR + shR + 5, C.gravelDk);
      }
      /* A depressed median has two more edges in it, and they are edges
         of the same kind: sealed surface giving way to ground. Without
         these the inside shoulder stops in a hard line against grass,
         which is the one place on a road that never looks right. */
      const mw = ramp ? 0 : R.medAt(r, s);
      if (mw > R.MED_BARRIER + R.VERGE) {
        band(k, k + 1, mw - R.VERGE, mw, C.gravel);
        band(k, k + 1, -mw, -mw + R.VERGE, C.gravel);
      }
    }
  }

  /* ── the shadow a bridge throws ─────────────────────────────────────
     Occlusion on its own does not read as height. Once a deck covers
     the road below correctly, it still looks like a road painted on top
     of another road — same asphalt, same width, no edge — and the
     picture is unreadable in a different way than before.

     So an elevated level drops its own footprint onto the level beneath
     it first, offset and darkened, in the same direction every car in
     this game already throws its shadow. It is two and a half pixels
     and it is the whole difference between "over" and "on". */
  const SHADOW_OFF = 2.5;
  function underside(entries) {
    for (const e of entries) {
      const r = e.r;
      if (r._i1 == null || r._i1 <= r._i0) continue;
      stations(r, r._i0, r._i1);
      const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
      for (let k = 0; k < r._i1 - r._i0; k++) {
        const s = (r._i0 + k) * R.STEP;
        const ed = R.edges(r, s), e2 = R.edges(r, s + R.STEP);
        const uL = Math.min(ed.uL, e2.uL) - sh, uR = Math.max(ed.uR, e2.uR) + sh;
        Q[0] = SX[k] + NX[k] * uL + SHADOW_OFF; Q[1] = SY[k] + NY[k] * uL + SHADOW_OFF;
        Q[2] = SX[k] + NX[k] * uR + SHADOW_OFF; Q[3] = SY[k] + NY[k] * uR + SHADOW_OFF;
        Q[4] = SX[k + 1] + NX[k + 1] * uR + SHADOW_OFF; Q[5] = SY[k + 1] + NY[k + 1] * uR + SHADOW_OFF;
        Q[6] = SX[k + 1] + NX[k + 1] * uL + SHADOW_OFF; Q[7] = SY[k + 1] + NY[k + 1] * uL + SHADOW_OFF;
        if ((Q[0] < 0 && Q[2] < 0 && Q[4] < 0 && Q[6] < 0) ||
            (Q[0] > VW && Q[2] > VW && Q[4] > VW && Q[6] > VW) ||
            (Q[1] < 0 && Q[3] < 0 && Q[5] < 0 && Q[7] < 0) ||
            (Q[1] > VH && Q[3] > VH && Q[5] > VH && Q[7] > VH)) continue;
        X.shade(Q, C.shadow, 0.42);
      }
    }
  }

  function surface(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;

    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const e2 = R.edges(r, s + R.STEP);
      const uL = Math.min(e.uL, e2.uL), uR = Math.max(e.uR, e2.uR);
      /* ── one ribbon, or two roads ──────────────────────────────────
         With a barrier down the middle the two carriageways are a single
         sealed surface, and it is cheaper and cleaner to lay it as one
         band with the barrier going on top afterwards. Past the width
         where a barrier stops being built they are not one surface any
         more — they are two roads with a field between them — and
         painting straight across would tarmac sixty feet of grass. */
      const mw = ramp ? 0 : R.medAt(r, s);
      const split = mw > R.MED_BARRIER;
      if (split) {
        band(k, k + 1, uL - shL, -mw, C.asphalt);     // the other direction
        band(k, k + 1, mw, uR + shR, C.asphalt);      // yours
      } else {
        band(k, k + 1, uL - shL, uR + shR, C.asphalt);
      }

      // wear: patches, stains, and the odd transverse seam
      const hh = hash(i0 + k);
      if (hh > 0.90) band(k, k + 1, uL + hh * 40, uL + hh * 40 + 12 + hash2(i0 + k, 9) * 16, C.patch);
      else if (hh < 0.08) band(k, k + 1, uR - 10 - hh * 90, uR - 4 - hh * 90, C.stain);
      if (hh > 0.44 && hh < 0.47) {
        if (split) { band(k, k + 1, uL, -mw, C.asphaltDk); band(k, k + 1, mw, uR, C.asphaltDk); }
        else band(k, k + 1, uL, uR, C.asphaltDk);
      }
    }

  }

  /* ── what collects on a hard shoulder ───────────────────────────────
     Nobody drives on it, so everything that leaves a vehicle stays
     there: grit swept off the running lanes, gravel dragged out of the
     verge by tyres, and the black rags a retread leaves behind. It is
     the one thing on the sealed surface that is neither tarmac nor
     paint, and it is what makes a shoulder read as a shoulder rather
     than as spare road.

     Kept deliberately sparse — a speck every third station or so, never
     a scatter — because at 220 mph a busy shoulder turns into noise.
     Anchored to the station index through `hash2`, so a given bit of
     grit is always in the same place on the same stretch of road and
     slides past rather than twinkling, and drawn through the coverage
     mask like the paint is, so a one-pixel speck moves smoothly instead
     of snapping between pixels the way the grass tufts do. */
  const SPECK = new Float64Array(8);
  function debris(r, i0, i1) {
    const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    /* Two passes, because the mask carries coverage and not colour: all
       the grit, laid down at once, then all the gravel. */
    for (let pass = 0; pass < 2; pass++) {
      for (let i = i0; i < i1; i++) {
        if (hash2(i, 419) > 0.30) continue;             // most stations, nothing
        const g = hash2(i, 613);
        if ((g > 0.74) !== (pass === 1)) continue;
        const s = i * R.STEP + hash2(i, 71) * R.STEP;
        const e = R.edges(r, s);
        // the outside shoulder collects most of it; the median side some
        const right = hash2(i, 233) > 0.34;
        const t = 0.18 + hash2(i, 907) * 0.66;          // how far across
        const p = R.at(r, s, right ? e.uR + t * sh : e.uL - t * sh);
        const px = sx(p.x, p.y), py = sy(p.x, p.y);
        if (px < -4 || py < -4 || px > VW + 4 || py > VH + 4) continue;
        const w = (hash2(i, 1123) > 0.88 ? 1.9 : 1.15) / 2;
        SPECK[0] = px - w; SPECK[1] = py - w;
        SPECK[2] = px + w; SPECK[3] = py - w;
        SPECK[4] = px + w; SPECK[5] = py + w;
        SPECK[6] = px - w; SPECK[7] = py + w;
        X.maskPoly(SPECK);
      }
      paint(pass ? C.gravelDk : C.stain);
    }
  }

  /* ── what stands beside and between the lanes ───────────────────────
     The median barrier and the guardrails. Drawn after every road's
     asphalt for the same reason the verge is drawn before it: these are
     objects standing ON the ground, so nothing's tarmac may cover them
     and they may not be covered by a road laid down later. */
  function furniture(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;

    /* A barrier only where a barrier would actually be built. Sixty feet
       of grass gets nothing down the middle of it, which is both what the
       road looks like and the reason a wide median is survivable in a way
       a wall is not. */
    if (!ramp) {
      for (let k = 0; k < n; k++) {
        const i = i0 + k;
        const mw = R.medAt(r, i * R.STEP);
        if (mw <= 0) continue;
        if (mw <= R.MED_BARRIER) {
          band(k, k + 1, -mw, mw, C.barrierDk);
          band(k, k + 1, -mw, -mw + 1.5, C.kerb);
          band(k, k + 1, mw - 1.5, mw, C.kerb);
          band(k, k + 1, -1.5, 1.5, C.barrier);
          if (i % 3 === 0) band(k, k + 1, -2.5, 2.5, C.post);
        } else if (R.medRailAt(r, i * R.STEP) > 0) {
          /* Cable barrier: three strands on light posts, down the middle
             of the grass. Drawn thin on purpose — from above it is almost
             nothing, and that is exactly what it looks like from a car. */
          const w = R.MED_RAIL_W;
          band(k, k + 1, -w, w, C.rail);
          if (i % 2 === 0) band(k, k + 1, -w - 0.8, w + 0.8, C.post);
        }
      }
    }

    /* A continuous rail with a post every third station, out past the
       gravel. Ramps get one on the outside of the curve only, which is
       both what happens in reality and half the drawing. */
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const gR = e.uR + shR + R.VERGE;
      const gL = e.uL - shL - R.VERGE;
      const skipL = R.suppressed(r.noL, i), skipR = R.suppressed(r.noR, i);
      /* On a deck the rail sits at the edge of the structure and is a
         solid concrete parapet, not a guardrail standing in gravel eight
         pixels out in a field that is not there. It also gives the
         bridge a hard rim, which is most of what tells you at a glance
         that the thing you are looking at has an edge to fall off. */
      if (R.deckAt(r, s) > 0.5) {
        band(k, k + 1, e.uR + shR, e.uR + shR + 3, C.barrier);
        band(k, k + 1, e.uR + shR + 3, e.uR + shR + 4, C.barrierDk);
        band(k, k + 1, e.uL - shL - 3, e.uL - shL, C.barrier);
        band(k, k + 1, e.uL - shL - 4, e.uL - shL - 3, C.barrierDk);
        continue;
      }
      if (!r.street && !skipR) {
        band(k, k + 1, gR, gR + 2.5, C.rail);
        if (i % 3 === 0) band(k, k + 1, gR + 0.5, gR + 2, C.post);
      }
      if (!ramp && !r.street && !skipL) {
        band(k, k + 1, gL - 2.5, gL, C.rail);
        if (i % 3 === 0) band(k, k + 1, gL - 2, gL - 0.5, C.post);
      }
    }
  }

  /* ── the paint ──────────────────────────────────────────────────────
     Edge lines solid, lane lines dashed, and the line beside a
     deceleration lane solid too — because on a real road that solid
     line is the instruction not to cross it once the gore has started,
     and it is the only warning the ramp gives you. */
  /* ── an edge line only where there is an edge ───────────────────────
     A solid white line at the side of a road says the pavement stops
     here. Where it does not stop — where the road alongside is the same
     continuous tarmac, which is every gore and every merge on this
     corridor — there is nothing for the line to mark, and drawing it
     anyway drew TWO of them crossing: the freeway's running out along
     the deceleration lane while the ramp's ran in along its own, a lane
     apart, cutting straight through each other.

     A real gore has one line arriving and two leaving, and they meet at
     the nose. The nose is precisely where each line stops being inside
     the other road's surface, so suppressing the lines where they are
     inside it produces exactly that picture, at every junction, without
     anyone having to say where the nose is. World.dress() measures it. */
  /* The sealed edge — the outside of everything, auxiliary lane and all.
     This is where a ramp's edge line goes, and where the outside of a
     deceleration lane goes. */
  const sealedU = (r, s, right) => (right ? R.edges(r, s).uR : R.edges(r, s).uL);
  /* The edge of the THROUGH lanes, which is where a freeway's own edge
     line belongs and which does not move when a lane opens outside it. */
  const throughU = (r, s, right) => (right
    ? R.insideAt(r, s) + R.innerAt(r, s) + R.lanesAt(r, s) * R.LANE
    : -(R.insideAt(r, s) + R.innerAtL(r, s) + R.backLanesAt(r, s) * R.LANE));
  const NO_SKIP = [];

  /* `omit` is a second, per-station reason to leave a piece out, on top
     of the range list. The ranges say "another road is painting this";
     `omit` says "this stretch of the line is a different KIND of line" —
     which is how the solid pass and the dotted pass below divide one
     boundary between them without either drawing over the other. */
  function edgeLine(r, s0, s1, right, w, uAt, skipList, omit) {
    const a0 = Math.max(s0, 0.5), a1 = Math.min(s1, R.len(r) - 8.5);
    const skip = skipList || (right ? r.noPaintR : r.noPaintL);
    const off = right ? -1 : 1;
    const at = uAt || sealedU;
    for (let s = a0; s < a1; s += 8) {
      const b = Math.min(a1, s + 8);
      if (R.suppressed(skip, Math.round(s / R.STEP))) continue;
      if (omit && omit((s + b) / 2)) continue;
      seg(r, s, b, at(r, s, right) + off, w, at(r, b, right) + off);
    }
    paint(C.line);
  }

  /* ── the line you are allowed to cross ───────────────────────────────
     *"The merge lane needs dotted lines."* Right, and it is the single
     marking that says what an auxiliary lane IS.

     A freeway's right-hand boundary was drawn solid for the whole
     window, deceleration lane or no. On the road it is only solid where
     the pavement stops there. Where a lane opens outside it — a decel
     lane before an exit, an accel lane after an entrance — that
     boundary becomes a WIDE DOTTED line for exactly the length of the
     lane, and that dotting is the instruction: this lane beside you is
     one you may move into, and it is about to end. Painted solid, the
     game was telling a driver the opposite of what the geometry meant,
     at every exit and every entrance on the corridor.

     MUTCD 3 ft mark, 9 ft gap, at twice the width of an ordinary lane
     line. `throughStripe` already fixes the scale: it lays 10 ft as 17
     px, so a foot is 1.7 px. */
  const DOT_ON = 5, DOT_CYCLE = 20.5, DOT_W = WIDE_W;   // 3 ft / 12 ft, double width
  function dottedEdge(r, s0, s1, right, uAt, when) {
    const a0 = Math.max(s0, 0.5), a1 = Math.min(s1, R.len(r) - 8.5);
    const off = right ? -1 : 1;
    for (let s = Math.floor(a0 / DOT_CYCLE) * DOT_CYCLE; s < a1; s += DOT_CYCLE) {
      const a = Math.max(a0, s), b = Math.min(a1, s + DOT_ON);
      if (b <= a) continue;
      if (!when((a + b) / 2)) continue;
      seg(r, a, b, uAt(r, a, right) + off, DOT_W, uAt(r, b, right) + off);
    }
    paint(C.line);
  }

  /* Where the mainline has an auxiliary lane of its OWN outside this
     boundary — which is what makes the boundary dotted. Deliberately
     not the same test `auxEdge` uses: that one also stands down where
     the ramp is painting the outer line for it, and inboard of that the
     lane is still the mainline's decel lane and still crossable. The
     two agree on the part that matters, which is `auxTaken`. */
  const auxOwn = (r, side) => (s) =>
    (side > 0 ? R.auxAt(r, s) : R.auxAtL(r, s)) >= R.LANE * 0.34
    && !auxTaken(r, s, side);

  function markings(r, s0, s1) {
    if (r.kind === "ramp") {
      edgeLine(r, s0, s1, false, MARK_W);
      // the right edge moves with the flare, so it is sampled per piece
      edgeLine(r, s0, s1, true, MARK_W);
      for (let l = 1; l < r.rampLanes; l++)
        stripe(r, s0, s1, (l - 0.5) * R.LANE, MARK_W, C.line, 17, 51);
      return;
    }
    /* ── the edge line, and the lane that opens outside it ─────────────
       A freeway's right edge line marks the edge of the THROUGH LANES
       and it does not move. When a deceleration lane opens, it opens
       OUTSIDE that line: the line carries straight on, the new lane
       appears beside it, and the outside of that lane gets an edge line
       of its own which peels away and becomes the ramp. Two lines that
       separate — which is what a driver actually sees, and what makes
       the shape of a gore readable.

       This was ONE line, drawn at the sealed edge with the auxiliary
       lane included in it. So instead of separating, the single edge
       line SWUNG OUT across the opening and came back after it: nothing
       marked the through lanes through an exit at all, and the line
       appeared to wander sideways and then vanish where the gore
       suppression took it. Reported from play as the line "turning a
       little invisible weirdly", and as the arms of the gore pointing
       the wrong way.

       The through-lane line needs no gore suppression, because it is
       inboard of the ramp and never crosses anything. The auxiliary
       one does, and keeps it. */
    /* One boundary per carriageway, drawn in two passes that divide it
       on the same predicate: solid where the pavement stops there,
       wide dotted for the length of any auxiliary lane outside it. */
    const openR = auxOwn(r, 1), openL = auxOwn(r, -1);
    edgeLine(r, s0, s1, true, MARK_W, throughU, NO_SKIP, openR);
    edgeLine(r, s0, s1, false, MARK_W, throughU, NO_SKIP, openL);
    dottedEdge(r, s0, s1, true, throughU, openR);
    dottedEdge(r, s0, s1, false, throughU, openL);
    auxEdge(r, s0, s1, true);
    auxEdge(r, s0, s1, false);
    /* ── both yellow lines, per station ───────────────────────────────
       These mark the inside edge of each carriageway, so they sit at
       `insideAt`, and that is no longer one number for a window: the
       median opens from a barrier to sixty feet of grass along this road.
       Sampled once at the middle of the window — which is what this did
       while the median was constant — the line would leave the pavement
       at both ends of every window where the width changes.

       The far side's used to be a single `stripe` at a constant −inner,
       which cannot express a varying offset at all, so it is now the
       same per-piece walk as the near one. Both are the same yellow, so
       they accumulate into one mask pass and are laid down together. */
    for (let s = Math.max(s0, 0.5); s < s1; s += 8) {
      const b = Math.min(s1, s + 8);
      const ia = R.insideAt(r, s), ib = R.insideAt(r, b);
      const ua = ia + R.innerAt(r, s), ub = ib + R.innerAt(r, b);
      /* Yellow follows the inside shoulder when a rare left exit
         consumes lanes, on whichever carriageway it happened to. The
         far side used to be plain `-insideAt`, which was the same
         statement with the left-exit case left out of it — and I-40's
         one left exit is on that side. Both skip the piece that spans
         the drop, or the line slashes 41 px across eight of road. */
      const va = -(ia + R.innerAtL(r, s)), vb = -(ib + R.innerAtL(r, b));
      if (Math.abs(ub - ua) <= R.LANE / 2) seg(r, s, b, ua, MARK_W, ub);
      if (Math.abs(vb - va) <= R.LANE / 2) seg(r, s, b, va, MARK_W, vb);
    }
    paint(C.yellow);
    // MUTCD proportions: 10 ft line / 30 ft gap at freeway speeds
    for (let l = 1; l < 6; l++) throughStripe(r, s0, s1, l, true);
    for (let l = 1; l < 6; l++) throughStripe(r, s0, s1, l, false);
    /* The dotted lane line that used to be drawn here, at the edge of
       the through lanes wherever an auxiliary lane was open, has become
       the through-lane EDGE LINE above — continuous, and drawn whether
       or not a lane happens to be open outside it. It was always the
       same offset; what it was missing was the rest of the road. */
  }

  /* ── the outside of an auxiliary lane ───────────────────────────────
     A deceleration lane opens outside the through-lane edge line and
     carries its own edge line, which at the gore becomes the ramp's.
     An acceleration lane is the same thing run backwards. Drawn only
     where the lane is really there, so the two lines meet where it
     opens and part where it closes — which is the shape of the join.

     It stops at the NOSE. The mainline's auxiliary lane does not end at
     the gore: it closes over a wedge, so a tapering sliver survives for
     a few hundred pixels past the point where the ramp has taken the
     pavement. Drawn on, that sliver put a second line a few pixels
     outside the through edge, right where the ramp's own two lines are
     — four lines in the mouth of an exit that has three, and the near
     arm of the gore doubled. Past the nose the strip is not a lane and
     not the mainline's.

     ── and it starts at the merge nose, for the same reason ───────────
     The other end had the identical fault and nobody had looked at it.
     `closeAux` opens the acceleration lane 150 stations BEFORE the ramp
     arrives — on purpose, so a merge feels like room to merge — and
     over all 1,200 px of that the freeway painted the outer edge line
     of a lane while the ramp converging on it painted its own two.
     Four lines at the mouth of every entrance, measured at 109 of 109
     ramps, and at 70% of them two of the four came within 4 px and
     crossed. Real exit 196, eight-px pieces through its merge:

         thru   aux   rampL  rampR
           99   108    167    187
           99   112    145    165
           99   115    126    147
           99   117    117    138   ← 0.4 px apart, and then they swap

     Upstream of the merge nose that strip is pavement the ramp is
     about to land on, not a lane of the freeway, and the only lines
     that belong there are the ramp's. Downstream of it the two are one
     surface and the aux line is the outside of it, which is what makes
     the outer line continuous through the join.

     ── why the interior, rather than a distance from the nose ─────────
     The gore rule takes a window round its nose because the wedge it is
     suppressing is a fixed length. This end has no such length: the
     structure is sized to the room it was given, so the accel lane's
     run is whatever is left. What IS known is that between a
     structure's two noses every pixel of aux on that side belongs to
     that structure — the freeway grew it for this ramp and for nothing
     else. So the bound is the structure itself: `e.s` is the parent
     station its gore sits on and the merge nose is the other end. A
     genuine auxiliary lane running from one interchange's merge to the
     next one's gore lies OUTSIDE both intervals and keeps its line. */
  const auxTaken = (r, s, side) => {
    if (!r.exits) return false;
    for (const e of r.exits) {
      if ((e.side > 0 ? 1 : -1) !== side) continue;
      const n = e.nose;
      /* Only this junction's own aux run: the wedge it closes over,
         with slack. Two exits are never closer than MIN_EXIT_LEN, so
         this cannot reach a neighbour's lane. */
      if (n && Math.abs(s - n.s) <= R.WEDGE * R.STEP + R.GORE
          && (e.side > 0 ? s >= n.s : s <= n.s)) return true;
      /* The interior, back from the merge nose to this junction's own
         gore station. Eastbound the merge is the high end and the gore
         the low one; westbound the structure is driven the other way
         down the same stations and both swap. */
      const m = e.mergeNose;
      if (m && (e.side > 0 ? (s >= e.s && s <= m.s)
                           : (s <= e.s && s >= m.s))) return true;
    }
    return false;
  };

  function auxEdge(r, s0, s1, right) {
    const a0 = Math.max(s0, 0.5), a1 = Math.min(s1, R.len(r) - 8.5);
    const skip = right ? r.noPaintR : r.noPaintL;
    const side = right ? 1 : -1;
    const off = right ? -1 : 1;
    const aux = right ? R.auxAt : R.auxAtL;
    for (let s = a0; s < a1; s += 8) {
      const b = Math.min(a1, s + 8);
      const mid = (s + b) / 2;
      /* Below about a third of a lane it is a taper and not a lane, and
         an edge line on it is a hair beside the through line. */
      if (aux(r, mid) < R.LANE * 0.34) continue;
      if (auxTaken(r, mid, side)) continue;
      if (R.suppressed(skip, Math.round(s / R.STEP))) continue;
      seg(r, s, b, sealedU(r, s, right) + off, MARK_W, sealedU(r, b, right) + off);
    }
    paint(C.line);
  }

  /* ── the gore ───────────────────────────────────────────────────────
     The wedge of nothing between a freeway and the ramp leaving it,
     which in real life is hatched paint and a crash cushion and is the
     part of a junction people actually hit. Painted across both roads
     at once because it belongs to neither. */
  /* The wedge itself is SURFACE — it must be laid with the asphalt, in
     the surface pass, or it paints over the markings of whatever is
     drawn before it. The chevrons and the crash cushion on it are PAINT,
     and go down in the markings pass with everything else. */
  function gore(j, marks) {
    const ramp = j.ramp, par = j.from;
    const LEN = R.GORE;      // same span the two roads stop dressing
    /* The parent's *base* edge, not R.edges().uR — that one still has
       the deceleration lane in it at the gore station, which would put
       the near side of the wedge a full lane to the right of where the
       ramp actually begins and paint the first chevron inside out. The
       split happens where the lanes end, and the aux lane is the ramp. */
    /* ── which way is "out", on a road that may run either way ────────
       Two independent facts, and conflating them drew the gore inside
       out on half the exits. `right` is which SIDE of the corridor the
       ramp sits on. `mirror` is whether the ramp's own distance grows
       with the corridor's or against it — a westbound ramp is built
       running westbound, so its d increases as the parent's s falls.

       The edge of the ramp facing the mainline is therefore uL when
       those two agree and uR when they do not. */
    /* `right` is which way ACROSS the corridor the ramp leaves, which
       for every right-hand exit is also the carriageway it serves and
       for a left one is the opposite — a wye serves the −u carriageway
       and departs toward +u, so the wedge opens the other way from
       everything else on the road. */
    const right = (j.out != null ? j.out : j.side) > 0;
    const mir = !!j.mirror;
    const dir = mir ? -1 : 1;
    const nearIsL = right !== mir;
    /* Half the RAMP's width from its centreline, not half a lane. Two
       lanes leave at exit 368, so its nose is a lane and a half out. */
    const half = (Math.max(1, j.lanes) - 0.5) * R.LANE;
    const base = right ? j.startU - half : j.startU + half;
    /* ── the wedge is bounded by the two EDGE LINES ────────────────────
       Twice now this has been measured off the wrong pair of offsets.
       First off the two lane edges, which sit inside sealed pavement, so
       52% of every brown pixel was on tarmac. Then off the two outer
       SEALED edges — right while the deceleration lane vanished at the
       gore, wrong the moment it started tapering out over a wedge
       instead: the freeway's sealed edge is then still a full lane
       OUTSIDE the ramp for hundreds of pixels, so `max(base, sealPar)`
       reached past the ramp and dragged the brown back across
       everything. Measured again: 97% of the wedge on sealed pavement.

       The neutral area is the thing between the two solid white lines.
       That is what it is on a real road — the photograph is unambiguous
       — and those two lines are now computed, they meet at the nose, and
       they are what markings() paints. Bounding the wedge by them makes
       it exactly the shape it bounds, at every structure, and it cannot
       come apart from the paint again because it IS the paint. */
    /* The parent's line the wedge is bounded by. For a right-hand exit
       that is the corridor's outer edge line, which the ramp is leaving
       through. A left exit leaves through the YELLOW one instead — the
       edge of the inside shoulder — and bounding its wedge by the white
       line on the far side of the through lanes would have painted the
       hatching across all four of them. */
    const sealPar = (s) => (j.left
      ? (right ? -(R.insideAt(par, s) + R.innerAtL(par, s))
               : R.insideAt(par, s) + R.innerAt(par, s))
      : right ? R.edges(par, s).uR - 1
              : R.edges(par, s).uL + 1);
    const sealRamp = (d) => nearIsL ? R.edges(ramp, d).uL + 1
                                    : R.edges(ramp, d).uR - 1;
    for (let d = 0; d < LEN; d += 10) {
      const a = R.at(ramp, d, sealRamp(d));
      const b = R.at(ramp, d + 10, sealRamp(d + 10));
      /* No `base` clamp any more. It was holding the inner boundary out
         at the gore's lane edge because the old measurement collapsed
         without it; the edge line does not collapse, it tapers in with
         the pavement, which is the boundary the wedge actually has. */
      const pu = sealPar(j.s + dir * d);
      const pu2 = sealPar(j.s + dir * (d + 10));
      const pa = R.at(par, j.s + dir * d, pu);
      const pb = R.at(par, j.s + dir * (d + 10), pu2);
      /* Nothing until the two sealed surfaces have parted — and nothing
         once they are properly apart either. A gore is the narrow
         triangle immediately after a split; sixty pixels out the two
         roads have their own verges and what lies between them is a
         field, which is green. Painting the full 360 px regardless meant
         a long brown slab thrown across open ground and, where the
         entrance ramp cuts back through, across its tarmac too. */
      const gapA = Math.hypot(a.x - pa.x, a.y - pa.y);
      const gapB = Math.hypot(b.x - pb.x, b.y - pb.y);
      if (gapA < 2 && gapB < 2) continue;
      /* ── the wedge is the PAVED neutral area and nothing else ─────────
         It ends where the two shoulders stop meeting across it — the
         freeway's plus the ramp's, which are different widths, so it is
         not twice either. Past that the two roads have properly parted
         and what lies between them is a field: each road's own verge
         pass has already laid its gravel and the ground is already
         grass. Painting a brown slab across that span as well is how
         this ended up thrown over the tarmac of both roads — 97% of the
         wedge was on sealed surface when it was measured against the
         outer sealed edges, and even bounded correctly a filled span
         from line to line covers two paved shoulders that are not
         ground. So there is nothing to draw once it is wide. */
      if (gapA >= R.SH_OUT + R.RAMP_SH + 4) break;
      Q[0] = sx(pa.x, pa.y); Q[1] = sy(pa.x, pa.y);
      Q[2] = sx(a.x, a.y);   Q[3] = sy(a.x, a.y);
      Q[4] = sx(b.x, b.y);   Q[5] = sy(b.x, b.y);
      Q[6] = sx(pb.x, pb.y); Q[7] = sy(pb.x, pb.y);
      if (!marks) X.poly(Q, C.asphaltDk);
      /* ── the hatching is gone ────────────────────────────────────────
         A real gore is chevron-hatched, and this drew that hatching: a
         mark every twenty pixels down the middle of the neutral area.
         The trouble is the scale. A chevron here is 1.6 px of diagonal,
         which cannot read as a chevron — what it reads as is a dotted
         white line running down the gore, a third line between the two
         real ones, on a twenty-pixel cycle. Reported from play as dots
         that needed removing, and that is the right call: at this size
         the honest picture is the neutral area's darker asphalt between
         two solid white lines, which is legible and is not a lie.

         The wedge itself stays — that is the `X.poly` above, and it is
         what makes the gore read as a surface you are not meant to be
         on. Only the marks that were pretending to be chevrons go. */
    }
    /* The nose: a striped crash cushion, deliberately the loudest
       object on the road. Seen from a car it is the only part of a
       junction that says "decide now", so it is drawn big enough to
       read at a glance rather than scaled to how much space it takes
       up in real life. */
    /* ── nothing stands here ─────────────────────────────────────────
       A striped crash cushion was drawn on the nose, and then moved to
       where the two pavements part, and then out again to where the
       neutral area is wider than the unit. It is gone. An impact
       attenuator is a thing bolted to the end of a BARRIER RUN, and
       there is no barrier in the gore of an ordinary rural interchange
       — there is paint, and beyond the paint there is grass. Drawing
       one here was inventing furniture, and it was the only object on
       this road that could end a run without anything hitting it.

       The gore is therefore what it is in life: hatching you may drive
       over, with a verge past it that will take your speed and may take
       the car. `j.nose` is still measured and still used — it is where
       the auxiliary lane's edge line stops. */
  }

  /* `noseBmp()` was here — a grey crash-cushion body with a Type 3
     object marker across its face. Removed with the object; see gore(). */

  /* ── and the drums, which is where the barrels really live ───────────
     A channelizing drum, from above, is a ring: MUTCD asks for
     alternating orange and white circumferential stripes with the top
     one orange, so at this scale it is an orange pixel with white in the
     middle of it. They are put out in a row to take a lane or a ramp
     out of service, which on this corridor means one thing — the exits
     that are signed and have no ramp behind them. */
  let _drum = null;
  function drumBmp() {
    if (_drum) return _drum;
    _drum = X.bitmap(3, 3);
    _drum.fill(0, 0, 3, 3, C.cone);
    _drum.set(1, 1, C.coneBand);
    return _drum;
  }

  function blob(wx, wy, r, col) {
    const px = sx(wx, wy), py = sy(wx, wy);
    if (px < -8 || py < -8 || px > VW + 8 || py > VH + 8) return;
    X.box(px - r / 2, py - r / 2, r, r, col);
  }

  /* ── signs and signals ──────────────────────────────────────────────
     Seen from above a sign is an edge, which tells you nothing, so both
     of these cheat and show their faces. Every top-down game that has
     ever had a road sign in it cheats in exactly this way. */
  /* ── guide signs ────────────────────────────────────────────────────
     A real one carries three things: the exit number, the route you are
     joining, and the place it goes. All three are surveyed — OSM puts
     the number on the junction node and the other two on the ramp's own
     `destination` tags — so these signs say what the signs say.

     Drawn face-on rather than edge-on, which is a cheat every top-down
     game with a road sign in it makes: from above a sign is a line.

     Two of them, a mile out and a quarter mile out, on the side the exit
     leaves from. */
  function exitSigns(ramp, parent) {
    if (!ramp.exitRef && !ramp.signTo) return;
    const side = ramp.mirror ? -1 : 1;
    /* Where the ramp actually leaves, which the junction knows exactly.
       This used to be derived as `merge.s ∓ len(ramp)` — the merge point
       walked back by the ramp's own length — and that only holds for a
       loop-back whose corridor span IS its length. A surveyed ramp turns
       off, crosses a road and comes back, so its length has nothing to do
       with how far along the corridor it travelled: exit 369's signs were
       499 px from its gore. */
    const gore = ramp.junction ? ramp.junction.s
      : ramp.mirror ? ramp.merge.s + R.len(ramp) : ramp.merge.s - R.len(ramp);
    for (const back of [5400, 1900]) {
      const s = gore - side * back;
      if (s < 4 || s > R.len(parent) - 4) continue;
      const e = R.edges(parent, s);
      const u = side > 0 ? e.uR + R.SH_OUT + 14 : e.uL - R.SH_OUT - 14;
      const p = R.at(parent, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -34 || py < -34 || px > VW + 34 || py > VH + 34) continue;
      X.sprite(guideBmp(ramp, back < 3000), px, py, p.h - camH + (side < 0 ? Math.PI : 0));
    }
  }

  /* ── the sign itself ────────────────────────────────────────────────
     Built once per exit and cached. Green panel, white border, exit
     number on its own tab above it — where it goes on a real one.

     The first version was 44 px wide and chopped the destination at
     nine characters, so "A-1 Mountain Road" came out as "A-1 MOUNT"
     and Kingston Pike as "KINGSTON ". A sign you cannot read is not a
     sign. It is wider now, the name WRAPS onto a second line rather
     than being cut, and the words that appear on almost every American
     guide sign are abbreviated the way the real ones abbreviate them —
     ROAD to RD, MOUNTAIN to MTN — which is not a space-saving trick so
     much as what the signs actually say. */
  const SIGN_ABBR = [
    [/\bROAD\b/g, "RD"], [/\bSTREET\b/g, "ST"], [/\bAVENUE\b/g, "AVE"],
    [/\bDRIVE\b/g, "DR"], [/\bBOULEVARD\b/g, "BLVD"], [/\bPARKWAY\b/g, "PKWY"],
    [/\bHIGHWAY\b/g, "HWY"], [/\bMOUNTAIN\b/g, "MTN"], [/\bJUNCTION\b/g, "JCT"],
    [/\bCOUNTY\b/g, "CO"], [/\bNORTH\b/g, "N"], [/\bSOUTH\b/g, "S"],
    [/\bEAST\b/g, "E"], [/\bWEST\b/g, "W"], [/\bSAINT\b/g, "ST"],
    [/\bSECONDARY\b/g, ""], [/\bPRIMARY\b/g, ""],
  ];
  function signWords(str) {
    let t = String(str).toUpperCase();
    for (const [re, to] of SIGN_ABBR) t = t.replace(re, to);
    return t.replace(/\s+/g, " ").trim();
  }

  /* Break a name across lines that fit, on word boundaries. */
  function wrapSign(str, cols, maxLines) {
    const words = signWords(str).split(" ").filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (t.length <= cols) { cur = t; continue; }
      if (cur) lines.push(cur);
      cur = w.length <= cols ? w : w.slice(0, cols);
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines.slice(0, maxLines);
  }

  const guideCache = new Map();
  const CH = 4;                       // px per character, 3 wide + 1 gap
  function guideBmp(ramp, near) {
    const key = (ramp.exitRef || "") + "|" + (ramp.signVia || []).join(",")
              + "|" + (ramp.signTo || []).join(",") + "|" + (near ? "n" : "f")
              + (ramp.leftExit ? "|L" : "") + "|" + (ramp.services || []).join(",");
    let b = guideCache.get(key);
    if (b) return b;

    const cols = 13;                                  // characters per line
    const W2 = cols * CH + 6;                         // 58 px
    const via = (ramp.signVia || []).slice(0, 1)
      .flatMap((v) => wrapSign(v, cols, 1));
    const to = (ramp.signTo || []).slice(0, near ? 2 : 1)
      .flatMap((t) => wrapSign(t, cols, near ? 2 : 1));
    const rows = via.concat(to).slice(0, near ? 3 : 2);
    /* ── the blue panel, and why the travel centres live on it ─────────
       A truck stop at an interchange has no gore of its own on a real
       Interstate and never did: it is on the frontage, and what tells
       you it is there is the blue services assembly under the green
       guide sign. So that is where the corridor's 141 crowded-out
       travel centres went — see the note on `services` in world.js.
       Near sign only, because the blue panel is a decision sign and a
       mile out you are being told where the exit GOES, not what is on
       it. */
    const serve = near ? (ramp.services || []).slice(0, 1)
      .flatMap((s) => wrapSign(s, cols, 1)) : [];
    const tabH = 9;
    const H2 = tabH + 3 + rows.length * 6 + 4 + (serve.length ? serve.length * 6 + 3 : 0);

    b = X.bitmap(W2, H2);
    /* ── the exit tab ──────────────────────────────────────────────────
       Top right and reading EXIT <n>, because that is where an exit tab
       goes and what it says — except where the exit is on the left, and
       then two things change and the MUTCD is explicit about both. The
       tab carries a LEFT plaque, because the number alone tells a
       driver nothing about which way to look. And the tab moves to the
       top LEFT of the panel, over the side the ramp is on, which is the
       same rule that put it top right in the first place. */
    const left = !!ramp.leftExit;
    const tabTxt = (left ? "LEFT EXIT " : "EXIT ") + (ramp.exitRef || "");
    const tabW = Math.min(W2, tabTxt.length * CH + 5);
    const tabX = left ? 0 : W2 - tabW;
    b.fill(tabX, 0, tabW, tabH, C.signWhite);
    b.fill(tabX + 1, 1, tabW - 2, tabH - 2, C.signGreen);
    tinyText(b, tabTxt, tabX + 3, 2, C.signWhite);
    // the panel
    const greenH = 3 + rows.length * 6 + 1;
    b.fill(0, tabH - 1, W2, H2 - tabH - 1, C.signWhite);
    b.fill(1, tabH, W2 - 2, greenH, C.signGreen);
    let y = tabH + 2;
    for (let i = 0; i < rows.length; i++) {
      const wpx = rows[i].length * CH;
      tinyText(b, rows[i], Math.max(2, ((W2 - wpx) / 2) | 0), y, C.signWhite);
      y += 6;
    }
    if (serve.length) {
      b.fill(1, tabH + greenH + 1, W2 - 2, serve.length * 6 + 1, C.signBlue);
      y = tabH + greenH + 2;
      for (const t of serve) {
        tinyText(b, t, Math.max(2, ((W2 - t.length * CH) / 2) | 0), y, C.signWhite);
        y += 6;
      }
    }
    b.fill(0, H2 - 2, W2, 2, C.post);          // the gantry legs
    guideCache.set(key, b);
    return b;
  }

  /* ── an exit that is open and shut ──────────────────────────────────
     Different from the plaque below, and the difference is the whole
     point. That one says the exit is not there. This one says the exit
     is there, you may take it, and the road behind it is closed for
     construction — which is the arrangement at exit 368: I-40 west and
     I-75 south still part at the wye, and I-75 south is a work zone.

     Real closures are signed a long way out and coned even further,
     and the reason is not politeness. Two lanes of a four-lane
     carriageway are being taken out of service at seventy miles an
     hour, and everybody in them has to be somewhere else before the
     gore. So: orange at a mile and a half, orange again at three
     quarters, and a drum taper that starts a mile out and shuts the
     lanes across a thousand pixels — the taper first, then the tangent
     line of drums running down the gore line to the nose. That is the
     shape in the MUTCD and it is the shape you see from the car. */
  const worksCache = new Map();
  function worksBmp(legend, near) {
    const key = legend + (near ? "|n" : "|f");
    if (worksCache.has(key)) return worksCache.get(key);
    const rows = near ? [signWords(legend), "CLOSED"] : [signWords(legend), "CLOSED", "AHEAD"];
    const cols = Math.max(6, ...rows.map((t) => t.length));
    const w = cols * 4 + 6, h = 6 + rows.length * 8;
    const b = X.bitmap(w, h);
    b.fill(0, 0, w, h, C.dark);                       // black border
    b.fill(1, 1, w - 2, h - 2, C.work);               // orange face
    let y = 3;
    for (const t of rows) {
      tinyText(b, t, Math.max(2, ((w - t.length * 4) / 2) | 0), y, C.dark);
      y += 8;
    }
    worksCache.set(key, b);
    return b;
  }

  /* The advance signs and the drums, for a ramp that carries a closure.
     Both are laid out from the gore backwards in the direction the
     driver is coming from, which `side` carries — the same convention
     exitSigns() uses and for the same reason. */
  function worksSigns(ramp, parent) {
    const c = ramp.closure;
    if (!c) return;
    const side = ramp.mirror ? -1 : 1;
    const gore = ramp.junction ? ramp.junction.s : null;
    if (gore == null) return;
    for (const back of [c.warn, c.warn * 0.55]) {
      const s = gore - side * back;
      if (s < 4 || s > R.len(parent) - 4) continue;
      const e = R.edges(parent, s);
      const u = side > 0 ? e.uR + R.SH_OUT + 14 : e.uL - R.SH_OUT - 14;
      const p = R.at(parent, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -34 || py < -34 || px > VW + 34 || py > VH + 34) continue;
      X.sprite(worksBmp(c.legend, back < c.warn * 0.8), px, py,
               p.h - camH + (side < 0 ? Math.PI : 0));
    }
  }

  /* The drums. A taper that crosses the lanes being closed, then a
     tangent that runs down the line they are closed at. Both are placed
     against the CARRIAGEWAY'S own offsets rather than a fixed u, so
     they follow a median that is opening and a lane count that is about
     to change — a row of barrels sitting on the paint is the only kind
     worth drawing. */
  /* Far enough either side of the camera to cover the view and a
     margin, and no further. A closure is a mile of drums and a ramp
     lined down both sides — about 1,300 of them — and computing a world
     position for every one to throw all but a dozen away is 1,300
     frames, sines and cosines per drawn frame. Culling on DISTANCE
     ALONG the road first costs a subtraction. */
  const DRUM_SPACING = 26;
  function worksDrums(ramp, parent, camS, camD) {
    const c = ramp.closure;
    const j = ramp.junction;
    if (!c || !j) return;
    const DRUM_REACH = VIEW + 320;   // read per call: VIEW moves with the cabinet
    const side = j.side > 0 ? 1 : -1;
    const out = (j.out != null ? j.out : j.side) > 0 ? 1 : -1;
    const lanes = Math.max(1, j.lanes);
    /* Which two offsets the taper runs between: the edge the lanes are
       being closed FROM — the inside line at a left exit — across to
       the line the closure holds, which is the gore line. */
    const at = (s) => {
      const inside = out > 0 ? -(R.insideAt(parent, s) + R.innerAtL(parent, s))
                             : R.insideAt(parent, s) + R.innerAt(parent, s);
      return { a: inside, b: inside - out * lanes * R.LANE };
    };
    const total = c.taper;
    const taperLen = Math.min(total * 0.42, 1400);
    for (let d = 0; d <= total; d += DRUM_SPACING) {
      const s = j.s - side * d;
      if (s < 2 || s > R.len(parent) - 2) continue;
      if (camS != null && Math.abs(s - camS) > DRUM_REACH) continue;
      const o = at(s);
      /* Beyond the taper the drums sit on the gore line; inside it they
         walk across from the inside edge to it. */
      const t = d > total - taperLen ? (total - d) / taperLen : 1;
      const u = o.a + (o.b - o.a) * smooth01(clamp01(t));
      const p = R.at(parent, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -4 || py < -4 || px > VW + 4 || py > VH + 4) continue;
      X.sprite(drumBmp(), px, py, 0);
    }
    /* And down both sides of the ramp itself, past the gore, because
       from here on it is a work zone and not a road. */
    if (camD == null) return;                 // the ramp itself is not in view
    for (let d = 0; d < c.works; d += DRUM_SPACING) {
      if (Math.abs(d - camD) > DRUM_REACH) continue;
      const e = R.edges(ramp, d);
      for (const u of [e.uL - 2, e.uR + 2]) {
        const p = R.at(ramp, d, u);
        const px = sx(p.x, p.y), py = sy(p.x, p.y);
        if (px < -4 || py < -4 || px > VW + 4 || py > VH + 4) continue;
        X.sprite(drumBmp(), px, py, 0);
      }
    }
    /* The end of it: barrels right across the pavement. This is the
       thing you hit, and unlike the drums beside it, it is solid — the
       player update knows where it is. */
    if (Math.abs(c.works - camD) > DRUM_REACH) return;
    const e = R.edges(ramp, c.works);
    for (let u = e.uL; u <= e.uR; u += 5) {
      const p = R.at(ramp, c.works, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -4 || py < -4 || px > VW + 4 || py > VH + 4) continue;
      X.sprite(drumBmp(), px, py, 0);
    }
  }
  const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
  const smooth01 = (t) => t * t * (3 - 2 * t);

  /* ── the exits that are not there ───────────────────────────────────
     Half the exit numbers on this corridor are signed and unbuilt — the
     real exit list has 1,201 entries and only 350 ramps were surveyed.
     World.applyExits marks those, and this is what it looks like from
     the car: the orange plaque a real Interstate puts up when an exit is
     out of service.

     Orange and black, not green and white, and that is the whole point
     of drawing it at all. Guide signs are green because they tell you
     where you may go; temporary traffic control is orange because it
     tells you what has changed. A driver reads the colour before the
     words, so a closed exit has to be the wrong colour to be useful.

     One sign, closer in than a guide sign's mile board, because it is
     not helping you choose a route — it is stopping you slowing down
     for a ramp that is not coming. */
  const closedCache = new Map();
  function closedBmp(ref) {
    const key = String(ref);
    if (closedCache.has(key)) return closedCache.get(key);
    const txt = "EXIT " + key;
    const w = Math.max(30, 6 + txt.length * 4), h = 19;
    const b = X.bitmap(w, h);
    b.fill(0, 0, w, h, C.dark);                       // the black border
    b.fill(1, 1, w - 2, h - 2, C.work);               // orange face
    tinyText(b, txt, 3, 3, C.dark);
    tinyText(b, "CLOSED", Math.max(3, (w - 6 * 4) >> 1), 11, C.dark);
    closedCache.set(key, b);
    return b;
  }

  function closedSigns(r, fwd) {
    if (!r.corridorExits) return;
    const side = fwd ? 1 : -1;
    /* The exit list carries one entry per carriageway, so a closed exit
       number appears twice about six thousand pixels apart. Two identical
       plaques for one exit is not what a road does — take whichever comes
       first in the direction being driven and sign it once. */
    const seen = new Set();
    const list = side > 0 ? r.corridorExits : [...r.corridorExits].reverse();
    for (const e of list) {
      /* Per carriageway. The two sides of an interchange are built
         separately and either can be crowded off its ground while the
         other stands, so "is this exit shut" is a question with two
         answers and the driver only wants theirs. `closed` — both
         sides — is kept for anything that has no side to ask about. */
      const shut = side > 0
        ? (e.closedR != null ? e.closedR : e.closed)
        : (e.closedL != null ? e.closedL : e.closed);
      if (!shut) continue;
      if (seen.has(e.ref)) continue;
      seen.add(e.ref);
      const s = e.s - side * 2600;                    // one advance plaque
      if (s < 4 || s > R.len(r) - 4) continue;
      const ed = R.edges(r, s);
      const u = side > 0 ? ed.uR + R.SH_OUT + 14 : ed.uL - R.SH_OUT - 14;
      const p = R.at(r, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px > -34 && py > -34 && px < VW + 34 && py < VH + 34)
        X.sprite(closedBmp(e.ref), px, py, p.h - camH + (side < 0 ? Math.PI : 0));

      /* And the drums themselves, across the shoulder where the ramp
         would have left. A closure is a row of them on a taper, angled
         out of the running lane, so the line of drums is the instruction
         and the sign upstream is only the warning. */
      const skip = side > 0 ? r.noPaintR : r.noPaintL;
      const noSh = side > 0 ? r.noR : r.noL;
      for (let d = 0; d < 8; d++) {
        const ds = e.s + side * (d * 11 - 40);
        if (ds < 2 || ds > R.len(r) - 2) continue;
        /* A drum stands on the shoulder, so there has to be a shoulder
           under it. Where the pavement is shared with a ramp, crossed by
           another road, or carried on a deck, there is nothing to stand
           it on — and a row of drums marching across a cross street is
           worse than no drums at all. Same gates the edge line uses. */
        const i = Math.round(ds / R.STEP);
        if (R.suppressed(skip, i) || R.suppressed(noSh, i)) continue;
        if (R.deckAt(r, ds) > 0.5) continue;
        const ed0 = R.edges(r, ds);            // per drum, not once per exit
        const edge = side > 0 ? ed0.uR : ed0.uL;
        const across = edge + (side > 0 ? 1 : -1) * (2 + d * (R.SH_OUT - 3) / 7);
        const q = R.at(r, ds, across);
        const qx = sx(q.x, q.y), qy = sy(q.x, q.y);
        if (qx < -4 || qy < -4 || qx > VW + 4 || qy > VH + 4) continue;
        X.sprite(drumBmp(), qx, qy, 0);
      }
    }
  }

  /* ── a 3x5 alphabet ─────────────────────────────────────────────────
     Small enough that a place name fits on a sign forty-four pixels
     wide, which is what a sign is at this scale. Only the glyphs a road
     sign actually uses. */
  const GLYPHS = {
    A: "25752", B: "65652", C: "34443", D: "65556", E: "74741", F: "74744",
    G: "34564", H: "55755", I: "72227", J: "11152", K: "56655", L: "44447",
    M: "57555", N: "57755", O: "25552", P: "65744", Q: "25553", R: "65655",
    S: "34216", T: "72222", U: "55553", V: "55522", W: "55575", X: "55255",
    Y: "55222", Z: "71247",
    0: "25552", 1: "22227", 2: "61247", 3: "61232", 4: "55710", 5: "74216",
    6: "34652", 7: "71222", 8: "25252", 9: "25316",
    " ": "00000", "-": "00700", ".": "00002", "/": "11244",
  };
  function tinyText(b, str, x0, y0, col) {
    let x = x0;
    for (const ch of String(str)) {
      const g = GLYPHS[ch] || GLYPHS[" "];
      for (let r = 0; r < 5; r++) {
        const bits = +g[r];
        for (let c = 0; c < 3; c++) if (bits & (4 >> c)) b.set(x + c, y0 + r, col);
      }
      x += 4;
    }
    return x;
  }

  function meter(r) {
    const m = r.meter;
    if (!m) return;
    // one stop bar across every lane at the surface-street intersection
    const e = R.edges(r, m.s);
    const a0 = R.at(r, m.s - 1.5, e.uL + 1), a1 = R.at(r, m.s + 1.5, e.uL + 1);
    const b0 = R.at(r, m.s - 1.5, e.uR - 1), b1 = R.at(r, m.s + 1.5, e.uR - 1);
    X.poly([sx(a0.x, a0.y), sy(a0.x, a0.y), sx(b0.x, b0.y), sy(b0.x, b0.y),
            sx(b1.x, b1.y), sy(b1.x, b1.y), sx(a1.x, a1.y), sy(a1.x, a1.y)], C.line);
    /* The head, on its post beside the lane. Drawn face-on and larger
       than scale, and glowing hard enough to be seen over the roof of
       a queue — because this is the one object on the road that has to
       be legible from four hundred pixels away, and a signal you spot
       late is a signal that has already cost you. */
    const nt = night();
    for (const u of [e.uL - 7, e.uR + 7]) {
      const h = R.at(r, m.s + 10, u);
      const hx = sx(h.x, h.y), hy = sy(h.x, h.y);
      X.sprite(m.red ? headRed() : headGreen(), hx, hy, h.h - camH);
      X.glow(hx, hy, m.red ? 22 : 17,
        m.red ? 190 : 34, m.red ? 30 : 190, m.red ? 20 : 90, 0.30 + 0.55 * nt);
    }
  }
  let _hr = null, _hg = null;
  function head(on) {
    const b = X.bitmap(9, 19);
    b.fill(3, 13, 3, 6, C.post);                 // the mast
    b.fill(0, 0, 9, 13, C.dark);                 // the housing
    b.fill(1, 1, 7, 5, on === "red" ? C.red : X.mix(C.red, C.dark, 0.72));
    b.fill(1, 7, 7, 5, on === "green" ? C.green : X.mix(C.green, C.dark, 0.75));
    return b;
  }
  const headRed = () => (_hr || (_hr = head("red")));
  const headGreen = () => (_hg || (_hg = head("green")));

  /* ── street lighting ────────────────────────────────────────────────
     Along the outside of every freeway, one side then the other. Lit
     only when there is something to light. */
  function lamps(r, i0, i1) {
    const nt = night();
    for (let i = i0; i <= i1; i += 7) {
      if (i % 7) continue;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const right = ((i / 7) | 0) % 2 === 0;
      const u = right ? e.uR + R.SH_OUT + R.VERGE + 5 : e.uL - R.SH_OUT - R.VERGE - 5;
      const p = R.at(r, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -24 || py < -24 || px > VW + 24 || py > VH + 24) continue;
      const nx = Math.cos(p.h - camH), ny = Math.sin(p.h - camH);
      const arm = right ? -7 : 7;
      X.poly([px - ny, py + nx, px + ny, py - nx,
              px + nx * arm + ny, py + ny * arm - nx,
              px + nx * arm - ny, py + ny * arm + nx], C.post);
      const lx = px + nx * arm, ly = py + ny * arm;
      X.box(lx - 1, ly - 1, 3, 3, nt > 0.22 ? C.head : C.rail);
      if (nt > 0.12) X.glow(lx, ly, 30, 255, 214, 140, 0.16 * nt);
    }
  }

  /* ── vehicles ───────────────────────────────────────────────────────
     Back, and rebuilt rather than restored: the old `vehicleBmp` took
     its dimensions from `Traffic.TYPES`, which does not exist any more.
     Every dimension here is the one the model is actually simulating —
     `driver.length` off the measured length bins, `BODY.w` off the
     class — so a lorry is long on the screen because it is long in the
     arithmetic that put it there, and the gap in front of it is the gap
     the following model chose.

     ── one bitmap per shape, not per vehicle ─────────────────────────
     Lengths are drawn from a continuous distribution, so caching per
     vehicle would be a bitmap each for four hundred of them. They are
     cached per (class, length rounded to 2 px, colour) instead, which
     is a few dozen bitmaps for the whole corridor, and the rounding is
     invisible at 0.36 m.

     The LIGHTS are not in the bitmap. Brake lamps, indicators and the
     beacon change from frame to frame and baking them in would multiply
     the cache by every combination; they are four `X.box` calls over
     the sprite, in the vehicle's own frame. */
  /* ── and they have to be SEEN ─────────────────────────────────────
     The first palette here was a set of honest mid-tones — the colours
     cars are actually painted — and on this road they disappeared.
     Reported from play: "all the cars are dark, it's hard to see them."

     The road is `#3a3a44` and the night pass lays 66% of a dark blue
     over everything, so anything under about 55% luma is a dark shape on
     a dark shape. These are lifted well clear of the asphalt and kept
     saturated, which is what makes them read as VEHICLES rather than as
     patches — and a road full of white and silver cars, which is what a
     real one mostly is, is a road you cannot play on. That is a
     deliberate departure from the survey and it is the only one in the
     game: everything else here is measured. */
  const VEH_COL = {
    car: ["#8299bd", "#d8735f", "#71b28c", "#d9d3c4", "#a291d2",
          "#ecbc5e", "#72bcc8", "#d992b6"],
    moto: ["#efebe0", "#e46c5b", "#72a2e0"],
    rigid: ["#f2eee4", "#93b2d6", "#d1ba88", "#adb5c0"],
    artic: ["#f7f4ea", "#ecf0f5", "#c5ced8", "#f0ece0"],
  };
  const VEH_PACKED = {};
  for (const k in VEH_COL) VEH_PACKED[k] = VEH_COL[k].map((h) => X.hex(h));

  const vehCache = new Map();
  const PX_PER_M = 1 / 0.179;

  /* ── the marks a car is carrying ────────────────────────────────────
     (Ric, 2026-08-12: "cosmetic damage to me and the other vehicles".)

     Drawn OVER the sprite rather than baked into it, exactly as the
     lamps are and for the same reason: `vehicleBmp` is cached per shape
     and colour, and putting a damage level in that key would multiply a
     few dozen bitmaps by every state every vehicle can be in.

     Scraped paint is BARE METAL, not a shadow. That is what it looks
     like on a real wing and it is also the only choice that reads on
     this palette: a dark mark vanishes on the dark half of the cars and
     a light one vanishes on the white lorries, so the mark is a pale
     grey with a dark edge under it and one of the two always shows. */
  function scrapes(px, py, fx, fy, rx, ry, lenPx, wPx, scuff, side) {
    const marks = Math.min(5, 1 + (scuff * 5 | 0));
    const bare = X.rgb(198, 198, 204), edge = X.rgb(52, 52, 58);
    for (let m = 0; m < marks; m++) {
      const along = (m / Math.max(1, marks - 1) - 0.5) * (lenPx - 5);
      const across = side * (wPx / 2 - 0.5);
      const mx = px + fx * along + rx * across;
      const my = py + fy * along + ry * across;
      X.box(mx - rx * 0.5 - 0.5, my - ry * 0.5 - 0.5, 1.5, 1.5, edge);
      X.box(mx - 0.5, my - 0.5, 1.5, 1.5, bare);
    }
  }

  /* A vehicle is drawn nose-up, like the player: +y in the bitmap is
     forward, so a sprite rotated by (heading − camH) points where it is
     going. */
  function vehicleBmp(kind, lenPx, wPx, ci) {
    const key = kind + ":" + lenPx + ":" + wPx + ":" + ci;
    let b = vehCache.get(key);
    if (b) return b;
    const cols = VEH_PACKED[kind] || VEH_PACKED.car;
    const base = cols[ci % cols.length];
    const w = Math.max(3, wPx), l = Math.max(6, lenPx);
    b = X.bitmap(w, l);
    b.fill(0, 0, w, l, base);
    /* Both flanks, so a vehicle reads as a solid rather than a slab.
       The near side catches the sky and the off side falls away. */
    b.fill(0, 0, 1, l, X.mix(base, C.shadow, 0.42));
    b.fill(w - 1, 0, 1, l, X.mix(base, X.rgb(255, 255, 255), 0.16));

    if (kind === "moto") {
      /* Barely a shape at this scale — two wheels and a rider, and what
         actually identifies it is being narrow enough to see road either
         side of it inside one lane. */
      b.fill(0, 0, w, 2, C.dark);
      b.fill(0, l - 2, w, 2, C.dark);
      b.fill(Math.max(0, (w >> 1) - 1), 2, Math.min(w, 2), l - 4, X.hex("#1b1f26"));
    } else if (kind === "artic") {
      /* Tractor, gap, trailer. The gap is what makes it read as
         articulated at a glance and it is where the unit really is
         hinged. */
      const cab = Math.round(l * 0.22);
      b.fill(0, 0, w, cab, X.mix(base, C.shadow, 0.25));
      b.fill(1, 1, w - 2, Math.max(1, (cab >> 1)), C.glass);
      b.fill(0, cab, w, 1, C.dark);
      b.fill(1, cab + 1, w - 2, 1, X.mix(base, C.shadow, 0.5));
      /* A trailer's underside, and the rear doors. */
      b.fill(0, l - 2, w, 2, X.mix(base, C.shadow, 0.35));
    } else if (kind === "rigid") {
      const cab = Math.round(l * 0.3);
      b.fill(0, 0, w, cab, X.mix(base, C.shadow, 0.2));
      b.fill(1, 1, w - 2, Math.max(1, (cab >> 1)), C.glass);
      b.fill(0, cab, w, 1, C.dark);
      b.fill(0, l - 2, w, 2, X.mix(base, C.shadow, 0.35));
    } else {
      /* A car: windscreen, roof, rear window. The roof highlight is
         what stops a row of them reading as one long block. */
      const gh = Math.max(1, Math.round(l * 0.17));
      b.fill(1, Math.round(l * 0.2), w - 2, gh, C.glass);
      b.fill(1, Math.round(l * 0.2) + gh, w - 2, 1,
             X.mix(base, X.rgb(255, 255, 255), 0.2));
      b.fill(1, Math.round(l * 0.66), w - 2, gh, C.glass);
    }
    vehCache.set(key, b);
    return b;
  }

  /* One vehicle, from the record `cars.js` hands over. Nothing here
     decides anything: every field was settled by the model. */
  function vehicle(c, t) {
    const px = sx(c.x, c.y), py = sy(c.x, c.y);
    const lenPx = Math.max(6, Math.round(c.len * PX_PER_M / 2) * 2);
    const wPx = Math.max(3, Math.round(c.w * PX_PER_M));
    /* Off screen by more than its own length: not drawn. Checked on the
       long axis because an articulated lorry is 120 px and culling it on
       its centre pops it out of view while a third of it is still on. */
    const bail = lenPx;
    if (px < -bail || py < -bail || px > VW + bail || py > VH + bail) return;

    const ci = c.id % 8;
    const b = vehicleBmp(c.kind, lenPx, wPx, ci);
    const a = c.h - camH;
    X.silhouette(b, px + 1.5, py + 1.5, a, C.shadow, 0.4);
    X.sprite(b, px, py, a);

    /* The vehicle's own axes, so the lamps go on the corners of the
       thing rather than on the corners of the screen. */
    const fx = Math.sin(a), fy = -Math.cos(a);
    const rx = Math.cos(a), ry = Math.sin(a);
    const hl = lenPx / 2, hw = wPx / 2;
    const lamp = (along, across, col) => {
      const lx = px + fx * along + rx * across, ly = py + fy * along + ry * across;
      X.box(lx - 1, ly - 1, 2, 2, col);
      return [lx, ly];
    };

    /* ── the marks it is carrying ──────────────────────────────────
       Drawn OVER the sprite rather than baked into it, exactly as the
       lamps are, and for the same reason: `vehicleBmp` is cached per
       shape and colour, and a cache key with a damage level in it would
       multiply a few dozen bitmaps by every state every vehicle can be
       in. Scuffing is a handful of dark pixels down the flank that took
       it, so a road that has been shunted around stops looking
       showroom-fresh. Cosmetic only — nothing in the model reads it. */
    if (c.scuff > 0.05) scrapes(px, py, fx, fy, rx, ry, lenPx, wPx,
                                c.scuff, c.scuffSide || 1);

    const nt = night();
    if (c.wreck) {
      /* Stopped, in a live lane, for twenty minutes. It gets hazards,
         because that is what a wreck on a motorway has, and they are the
         warning the `avoid` motive is reacting to. */
      if ((t * 1.4 | 0) % 2 === 0) {
        lamp(hl - 1, -hw, C.amber); lamp(hl - 1, hw, C.amber);
        lamp(-hl + 1, -hw, C.amber); lamp(-hl + 1, hw, C.amber);
      }
      return;
    }

    /* Brake lamps, which is the one thing a vehicle broadcasts and the
       one thing the drivers behind it are modelled as watching. */
    if (c.brake) {
      lamp(-hl + 1, -hw, C.tail); lamp(-hl + 1, hw, C.tail);
    } else if (nt > 0.2) {
      lamp(-hl + 1, -hw, X.mix(C.tail, C.dark, 0.45));
      lamp(-hl + 1, hw, X.mix(C.tail, C.dark, 0.45));
    }

    /* The indicator. Half the traffic changes lane without one — that is
       measured, and it is only visible here. 1.5 Hz, which is what a
       flasher unit does. */
    if (c.blink && (t * 1.5 % 1) < 0.55) {
      const side = c.blink * hw;
      lamp(hl - 1, side, C.amber);
      lamp(-hl + 1, side, C.amber);
    }

    if (nt > 0.2) {
      lamp(hl - 1, -hw, C.head); lamp(hl - 1, hw, C.head);
      /* Only what is coming towards you throws a beam you can see; a
         vehicle going away shows you its tail lamps and nothing else,
         and drawing four hundred wedges would wash the road out.

         A glow was tried on the oncoming headlights and taken out
         again, measured rather than judged: `world()` lays 66% of a dark
         blue over the whole buffer as the last thing it does, so
         anything drawn before it is dimmed with everything else. The
         glow bought 5% of local brightness — 42 against 40 luma — for a
         per-vehicle cost, which is decoration that does not show. The
         street lamps and the player's own headlights live under exactly
         the same tint, so this is the game's night, not a bug in it. */
      if (!c.mine) beam(px, py, a, wPx, lenPx);
    }
  }

  /* Everything visible, at one deck level. Ordered far-to-near down the
     screen so that where two vehicles overlap — which happens on a
     curve, and constantly on the oncoming carriageway — the nearer one
     wins, the same rule the road surfaces use. */
  function traffic(list, level, t) {
    if (!list || !list.length) return;
    const shown = [];
    for (const c of list) if (Math.round(c.deck) === level) shown.push(c);
    shown.sort((a, b) => sy(a.x, a.y) - sy(b.x, b.y));
    for (const c of shown) vehicle(c, t);
  }

  /* `beam()` below survives because the PLAYER still has headlights, and
     so does everything from here to the end of this comment — the car
     you drive was built in the middle of the traffic art and very nearly
     went out with it. */

  /* ── the car you are actually in ────────────────────────────────────
     Was one 11 x 26 red car whatever the garage said. It is the chosen
     vehicle's REAL footprint now, off `data/garage.js`, at the same
     0.179 m a pixel everything else on this road uses:

       S1000RR    2.05 x 0.83 m  →  11 x  5 px
       Jetta      4.38 x 1.74    →  24 x 10
       F-150      5.89 x 2.03    →  33 x 11

     Three times the length between the bike and the pickup, which is
     the point — the thing you are looking at should be the thing the
     traffic model is solving, and `cars.js` already hands those same
     metres to the sim. The proportions inside the sprite are fractions
     of w and l rather than fixed offsets, so a shape this narrow still
     gets a windscreen and lamps rather than a stripe. */
  let playerBmp = null, playerWreck = null;
  let pW = 11, pL = 26, pPaint = null;

  function setPlayerVehicle(car) {
    const w = Math.max(4, Math.round((car && car.wide ? car.wide : 1.97) / 0.179));
    const l = Math.max(8, Math.round((car && car.len ? car.len : 4.65) / 0.179));
    const paint = car && car.paint ? X.hex(car.paint) : null;
    if (w === pW && l === pL && paint === pPaint) return;
    pW = w; pL = l; pPaint = paint;
    playerBmp = playerWreck = null;               // rebuilt on next draw
  }

  function buildPlayer() {
    const w = pW, l = pL;
    const mk = (dead) => {
      const b = X.bitmap(w, l);
      const live = pPaint === null ? C.player : pPaint;
      const base = dead ? C.playerDead : live;
      const inset = w >= 9 ? 2 : 1;               // a bike has no room for 2
      const stripe = Math.max(1, Math.round(w * 0.27));
      const wind = Math.max(2, Math.round(l * 0.27));
      const rear = Math.max(1, Math.round(l * 0.15));
      b.fill(0, 0, w, l, base);
      b.fill(0, 0, 1, l, X.mix(base, C.shadow, 0.4));
      b.fill(w - 1, 0, 1, l, X.mix(base, X.rgb(255, 255, 255), 0.2));
      b.fill((w - stripe) >> 1, 1, stripe, l - 2, dead ? X.hex("#6d5f4e") : C.playerTrim);
      b.fill(inset, Math.round(l * 0.23), w - inset * 2, wind, C.glass);
      b.fill(inset, Math.round(l * 0.23) - 1, w - inset * 2, 1,
             X.mix(base, X.rgb(255, 255, 255), 0.24));
      b.fill(inset, l - rear - 2, w - inset * 2, rear, C.glass);
      if (dead) { b.fill(1, 1, Math.min(3, w - 2), 3, X.hex("#4a1f19")); }
      else {
        const lamp = Math.max(1, Math.min(2, w - 2));
        b.fill(1, 0, lamp, 1, C.head); b.fill(w - 1 - lamp, 0, lamp, 1, C.head);
        b.fill(1, l - 1, lamp, 1, C.tail); b.fill(w - 1 - lamp, l - 1, lamp, 1, C.tail);
      }
      return b;
    };
    playerBmp = mk(false);
    playerWreck = mk(true);
  }

  /* headlight throw — a pale wedge in front of anything moving */
  function beam(px, py, a, w, l) {
    const nt = night();
    const fx = Math.sin(a), fy = -Math.cos(a);
    const rx = Math.cos(a), ry = Math.sin(a);
    const tip = 54;
    X.shade([
      px + fx * l / 2 - rx * (w / 2 - 1), py + fy * l / 2 - ry * (w / 2 - 1),
      px + fx * l / 2 + rx * (w / 2 - 1), py + fy * l / 2 + ry * (w / 2 - 1),
      px + fx * tip + rx * (w / 2 + 9), py + fy * tip + ry * (w / 2 + 9),
      px + fx * tip - rx * (w / 2 + 9), py + fy * tip - ry * (w / 2 + 9),
    ], X.rgb(255, 242, 200), 0.11 * nt);
  }

  /* The camera rides the road's centreline, so the car is not pinned to
     the middle of the screen — it moves across a picture that stays
     put. Its angle is `S.roll`, and while you are driving that is zero
     to the bit: the car never turns, the road does, and the whole feel
     of this game rests on that staying true.

     A wreck is the exception and the only one. `S.roll` is how far the
     failed corner has dragged the nose round, and the camera keeps
     facing down the road while it does — so the world holds still and
     the car goes round in front of it, which is how it looks from
     anywhere except inside the car. */
  function player(S, wrecked) {
    if (!playerBmp) buildPlayer();
    const b = wrecked ? playerWreck : playerBmp;
    const px = sx(S.x, S.y), py = sy(S.x, S.y);
    const a = S.roll || 0;
    X.silhouette(b, px + 1.5, py + 1.5, a, C.shadow, 0.4);
    X.sprite(b, px, py, a);
    /* Your own car wears it too — same marks, same reason. `dmg.pull`
       is which way a bent corner drags, so it is also the side the blow
       landed on; with no pull yet the scraping goes down the near side. */
    if (S.dmg && S.dmg.scuff > 0.05) {
      const fx = Math.sin(a), fy = -Math.cos(a);
      const rx = Math.cos(a), ry = Math.sin(a);
      scrapes(px, py, fx, fy, rx, ry, 26, 11,
              S.dmg.scuff, S.dmg.pull >= 0 ? 1 : -1);
    }
    if (!wrecked && night() > 0.2) beam(px, py, a, 11, 26);
  }

  /* When the player is on the lower road, the bridge must cover the
     solid car—but completely erasing it makes the game unreadable. This
     translucent locator is painted back over the deck only while that
     deck physically covers the car. On an upper road `upper` is empty at
     the crossing, so the normal solid car remains visibly on top. */
  function playerGhost(S, wrecked) {
    if (!playerBmp) buildPlayer();
    const b = wrecked ? playerWreck : playerBmp;
    const px = sx(S.x, S.y), py = sy(S.x, S.y);
    const a = S.roll || 0;
    X.silhouette(b, px - 1, py, a, C.playerTrim, 0.20);
    X.silhouette(b, px + 1, py, a, C.playerTrim, 0.20);
    X.silhouette(b, px, py, a, C.player, 0.48);
  }

  function deckCoversPlayer(r, S, seed) {
    const pr = World.locate(r, S.x, S.y, seed, r.hint);
    if (!pr || pr.s <= 0 || pr.s >= R.len(r)) return false;
    const e = R.edges(r, pr.s);
    const shoulder = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    return pr.u >= e.uL - shoulder && pr.u <= e.uR + shoulder;
  }

  /* ── the frame ──────────────────────────────────────────────────────
     Roads furthest away first so that where two of them run close
     together the near one wins the seam. */
  /* cx, cy, ch are the CAMERA — a point on the centreline of the road
     under the car, not the car itself. See the note in offramp.js. */
  function world(cx, cy, ch, S) {
    camera(cx, cy, ch);
    ground();

    /* Which roads are even here. This used to walk every road in the
       world and project onto each; the map now holds two thousand of
       them, so it asks the spatial index instead — and the index hands
       back a station to start projecting from, which is what lets a road
       you have never seen before be projected in a narrow window rather
       than scanned end to end. */
    const near = [];
    for (const [r, seed] of World.nearby(cx, cy, VIEW + 300, nearScratch)) {
      const pr = World.locate(r, cx, cy, seed, r.hint);
      if (!pr || pr.dist > VIEW + 240) continue;
      near.push({ r, pr });
    }
    /* Paint order, and it must be STABLE. It used to be
       `b.pr.dist - a.pr.dist`, on the reasoning that the nearer
       centreline should win the seam. That is fine for two roads that
       never share a layer and fatal for two that do: as you drive past,
       their distances cross over and the pair swaps draw order from one
       frame to the next. Each paints its own asphalt and verge over the
       other in turn, and the gravel along the gore strobes. `layer` is
       unique per road and assigned parent-first, so every ramp paints
       on top of the road it came off and keeps doing so. */
    near.sort((a, b) => a.r.layer - b.r.layer || a.r.id - b.r.id);

    /* Spans before scenery, because the treeline is hung off them — and
       scenery before everything else, so that every road on the map is
       still free to lay its tarmac straight over somebody's woods. */
    for (const e of near) span(e);
    if (TREES) trees(near);

    /* ── two passes, and this is not a detail ─────────────────────────
       Every road used to lay its own asphalt and then its own paint,
       one road after another. Where two roads overlap — which is every
       gore on the map, since a ramp runs inside the freeway's shoulder
       for a couple of hundred pixels after it leaves — the second road's
       ASPHALT covers the first road's PAINT. The freeway's right-hand
       edge line simply stopped existing for the length of every exit.

       Ordering the roads differently cannot fix it, only move it:
       whichever is drawn second wins. So surfaces go down for all roads
       first, and then markings for all roads on top. Paint is never
       erasable by tarmac, which is also true of roads. */
    function span(entry) {
      const { r, pr } = entry;
      const reach = Math.sqrt(Math.max(0, VIEW * VIEW - Math.min(pr.dist, VIEW) ** 2)) + 90;
      let i0 = Math.max(0, Math.floor((pr.s - reach) / R.STEP));
      let i1 = Math.min(r.st.length - 1, Math.ceil((pr.s + reach) / R.STEP));
      if (i1 - i0 > 560) i1 = i0 + 560;
      r._i0 = i0; r._i1 = i1;
      return i1 > i0;
    }

    function paintSurfaces(entries) {
      for (const e of entries) span(e);
      // gravel for everything, then tarmac over it, then what stands beside it
      for (const e of entries) if (e.r._i1 > e.r._i0) verge(e.r, e.r._i0, e.r._i1);
      for (const e of entries) {
        if (e.r._i1 <= e.r._i0) continue;
        surface(e.r, e.r._i0, e.r._i1);
        if (e.r.kind === "ramp" && e.r.junction) gore(e.r.junction, false);
      }
      // after every surface, so one road's tarmac never buries another's grit
      for (const e of entries) if (e.r._i1 > e.r._i0) debris(e.r, e.r._i0, e.r._i1);
      for (const e of entries) if (e.r._i1 > e.r._i0) furniture(e.r, e.r._i0, e.r._i1);
    }

    function paintMarkings(entries) {
      for (const e of entries) {
        if (e.r._i1 == null || e.r._i1 <= e.r._i0) continue;
        markings(e.r, e.r._i0 * R.STEP, e.r._i1 * R.STEP);
        if (e.r.kind === "ramp" && e.r.junction) gore(e.r.junction, true);
      }
    }

    function fixtures(entries) {
      for (const { r } of entries) {
        if (r.kind === "freeway" && !r.street && r._i1 != null) lamps(r, r._i0, r._i1);
        if (r.meter) meter(r);
      }
    }

    /* ── one whole level at a time ────────────────────────────────────
       Surfaces for everything, then markings for everything, is right
       for roads lying in the same field: paint can never be erased by
       somebody else's tarmac. Across a bridge it is badly wrong, and it
       produced the single most confusing picture this game has ever
       drawn. Standing on an overpass, the deck's asphalt correctly
       covered the freeway below — and then the freeway's own lane lines
       were painted straight back over the deck, because markings ran as
       one pass for every road at or below the player. Six lines of
       somebody else's road, crossing the one you are driving on.

       So the unit is a LEVEL, not the whole scene. Everything at deck 0
       is finished — gravel, tarmac, furniture, paint — before anything
       at deck 1 begins, and a deck therefore hides what is under it
       completely, which is what being a bridge means. Within a level the
       two passes survive unchanged, because within a level they are
       still exactly right. */
    const playerDeck = S.road ? R.deckAt(S.road, S.s) : 0;
    const levels = new Map();
    for (const e of near) {
      const k = Math.round(R.deckAt(e.r, e.pr.s));
      let g = levels.get(k);
      if (!g) levels.set(k, g = []);
      g.push(e);
    }
    const order = [...levels.keys()].sort((a, b) => a - b);
    const playerLevel = Math.round(playerDeck);

    function onTheRoad() {
      // marks on the road, then whatever is on top of it
      for (const m of S.marks) {
        const x = sx(m.x, m.y), y = sy(m.x, m.y);
        if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
        const a = m.h - camH;
        X.shade([x - Math.cos(a), y - Math.sin(a), x + Math.cos(a), y + Math.sin(a),
                 x + Math.cos(a) + Math.sin(a) * 3, y + Math.sin(a) - Math.cos(a) * 3,
                 x - Math.cos(a) + Math.sin(a) * 3, y - Math.sin(a) - Math.cos(a) * 3],
                C.shadow, 0.42);
      }
      player(S, S.mode === "wreck");
    }

    let placed = false;
    for (const k of order) {
      const g = levels.get(k);
      for (const e of g) span(e);
      if (k > 0) underside(g);            // the shadow a deck throws on what it covers
      paintSurfaces(g);
      paintMarkings(g);
      fixtures(g);
      /* The traffic at this level, before the car at this level. A
         vehicle is never allowed to cover the player: you have to be
         able to see what you are steering, and where two sprites
         genuinely overlap the interesting one is yours. */
      traffic(S.traffic, k, S.t);
      if (k === playerLevel) { onTheRoad(); placed = true; }
    }
    if (!placed) { traffic(S.traffic, playerLevel, S.t); onTheRoad(); }

    const above = near.filter(({ r, pr }) => Math.round(R.deckAt(r, pr.s)) > playerLevel);
    if (above.some(({ r, pr }) => deckCoversPlayer(r, S, pr.i)))
      playerGhost(S, S.mode === "wreck");
    /* Signs for the exits on the road under the car. Only the corridor
       carries them, and only the ones serving your direction — a sign
       for the other carriageway is not yours to read. */
    /* Where the camera falls on each road in view, so a closed ramp's
       drums can be culled by distance ALONG rather than by projecting
       all thirteen hundred of them and discarding the ones off screen.
       A ramp that is not in `near` at all is not in view, and gets
       none of its drums drawn — which is the same answer, reached
       without doing any of the work. */
    const camAt = new Map();
    for (const e of near) camAt.set(e.r, e.pr.s);
    for (const { r, pr } of near) {
      if (!r.corridor) continue;
      for (const e of r.exits) {
        if (e.ramp.dead) continue;
        /* ── drums are not signage ──────────────────────────────────
           A sign for the other carriageway is not yours to read, which
           is what the direction test below is for. A barrel is not a
           sign: it is an object standing on the road, it is there
           whichever way you are pointing, and the ones down the sides
           of a closed ramp are only ever seen from ON that ramp —
           where `S.fwd` is true because a ramp always runs the way you
           drive it, and the test would therefore have hidden every one
           of them from the only person who needed to see them. */
        worksDrums(e.ramp, r, pr.s, camAt.has(e.ramp) ? camAt.get(e.ramp) : null);
        if ((e.side > 0) !== S.fwd) continue;
        exitSigns(e.ramp, r);
        worksSigns(e.ramp, r);
      }
      // and the ones that are signed but have no ramp behind them
      closedSigns(r, S.fwd);
    }

    for (const p of S.parts) {
      const x = sx(p.x, p.y) | 0, y = sy(p.x, p.y) | 0;
      if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
      X.box(x, y, p.size, p.size, p.col);
    }

    // and finally, what time it is
    const nt = night(), wm = warmth();
    if (wm > 0.01) X.tint(255, 132, 40, 0.20 * wm);
    /* Night. 0.66 was enough to take the lifted palette above straight
       back down again, so it is 0.54 — still unmistakably night, and
       the one number to reach for first if the picture is ever called
       too dark or too washed out again. */
    if (nt > 0.01) X.tint(10, 12, 38, 0.54 * nt);
    if (S.flash > 0.01) X.tint(255, 240, 220, 0.7 * S.flash);
    X.flush();
  }

  return {
    /* Live, not copied: the cabinet is resized whenever the page is. */
    get VW() { return VW; }, get VH() { return VH; },
    get CX() { return CX; }, get PY() { return PY; },
    C, resize,
    world, setPhase, setPlayerVehicle, night, camera, sx, sy,
    partCols: {
      dust: [C.gravel, C.gravelDk], debris: [C.cone, C.coneBand, C.asphalt],
      spark: [C.head, C.amber], smoke: [C.smoke], fire: [C.fire, C.tail, X.hex("#ffe089")],
    },
  };
})();
