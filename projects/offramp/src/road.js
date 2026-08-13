/* ══════════════════════════════════════════════════════════════════════
   One road.

   A road is a centreline and a cross-section. The centreline is a list
   of stations eight world-pixels apart, each holding a position and a
   heading; the cross-section says how much sealed surface sits either
   side of that line and where the lanes fall within it. Everything else
   in the game — where a car sits, whether you are on tarmac or grass,
   where the barrier is, where a ramp peels off — is a question about a
   distance along one of these and an offset across it.

   ── the three coordinates ───────────────────────────────────────────
       s   distance travelled along the centreline, world px
       u   offset across it, world px, POSITIVE TO THE RIGHT of travel
       deck how far off the ground, in bridge levels, per station

   The third one is newer than the other two and exists because they
   were not enough. A road used to carry a single `elev` number that was
   asked to be both its paint order and its height, and those are not
   the same quantity: paint order must be unique per road and totally
   ordered, height is shared by everything sitting in the same field and
   changes ALONG a road. Every flyover in this game is at grade at both
   ends. `layer` is now the first, `deck[]` the second.

   That sign convention is load-bearing and worth saying twice: u
   increases to the right. Traffic here drives on the right, so your
   carriageway is the positive-u side, the oncoming one is negative,
   and offramps leave from the largest u there is. If you ever flip the
   game to left-hand traffic, this is the line you flip.

   Heading is radians, measured from +y, increasing clockwise, so the
   direction of travel is (sin h, cos h) and the right-hand normal is
   (cos h, −sin h). World y is up. Screen y is not — that inversion
   happens once, in draw.js, and nowhere else.

   ── the cross-section ───────────────────────────────────────────────
   A freeway is two carriageways with paved inside shoulders and a
   barrier down the middle:

       u:  −outer … lanes … inside | barrier | inside … lanes … +outer

   `aux` is the deceleration lane, and it is the whole trick behind an
   offramp: it grows from nothing to a full lane over about two hundred
   pixels, the ramp's own centreline starts exactly at the middle of it,
   and once the ramp exists the freeway's aux tapers back to zero over a
   gore wedge. Nothing has to be stitched — the two surfaces are
   contiguous at the gore because they were built from the same number,
   and the gap that opens between them afterwards *is* the gore.

   There are TWO of these, one per carriageway: `aux` widens the +u edge
   and `auxL` the −u edge. That is not symmetry for its own sake. There
   was only ever `aux`, and since it is added to uR and nothing else, a
   westbound exit opened its deceleration lane on the eastbound side of
   the motorway and got none of its own. Measured on the Knoxville
   window: every one of the eighteen eastbound ramps started exactly on
   its aux lane, and the eighteen westbound ones started between 0 and 41
   px OUTSIDE the pavement, five of them detached from it entirely.

   A ramp is the degenerate case: no barrier, no oncoming side, one to
   three lanes. Lane zero is centred on its centreline and extra lanes
   sit to its right, so every lane remains geographically stable.
   ══════════════════════════════════════════════════════════════════════ */

const Road = (() => {
  "use strict";

  const STEP = 8;          // world px between stations

  /* One world pixel is 0.179 m. These are not eyeballed proportions:
     they are the Interstate cross-section, rounded only far enough for
     the rasterizer to keep clean pixel edges.

       12 ft travel lane       = 20.44 px
       10 ft outside shoulder  = 17.03 px
        4 ft inside shoulder   =  6.81 px

     The previous road had 4.65 m lanes and a 1.25 m hard shoulder. It
     looked like a five-lane ribbon, not a freeway. The shoulders now
     read as actual paved recovery space and the lanes fit the car. */
  const LANE = 20.5;
  const SH_IN = 7;         // paved shoulder between lane and median
  const SH_OUT = 17;       // paved shoulder outside each carriageway
  const MED = 2;           // half-width of a 0.72 m concrete barrier
  /* Above this half-width the middle of the road stops being a barrier
     and becomes a depressed median: grass, a shallow ditch, no wall. It
     is the line between "you hit something" and "you end up in the
     middle", and both the drawing and the surface query turn on it. */
  const MED_BARRIER = 4;
  /* What a depressed median actually measures on this corridor. Rural
     Interstate medians run 60 to 88 ft; these are half-widths, so 51 px
     is a 60 ft median and 75 px is 88 ft. */
  const MED_RURAL = 51, MED_SUBURB = 22;
  const VERGE = 9;         // unsealed strip beyond the paved shoulder
  const RAMP_SH = 8;       // roughly 4.7 ft beside the ramp carriageway

  let nextId = 1;
  let random = Math.random;

  const rnd = (a, b) => a + random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  /* Shortest signed way round from b to a.

     Written as `((a - b + 3π) % 2π) - π`, which is correct for any two
     angles and costs two float modulos. Both arguments here are always
     headings out of `Math.atan2`, so they are in (−π, π] and their
     difference is in (−2π, 2π) — one conditional wrap covers that
     range exactly, with no modulo at all. Same answer, and it is worth
     saying why: this is called once per frame() and once per project(),
     which put it at 8.7% of a window rebuild on the profile. */
  const TAU = Math.PI * 2;
  const angleDiff = (a, b) => {
    const d = a - b;
    return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
  };

  /* ── construction ───────────────────────────────────────────────────
     A road always starts as a single station and is grown on demand.
     `curv` is signed curvature in radians per world pixel; it wanders
     toward `curvT` so the road sweeps rather than kinks. */
  function make(kind, x, y, h, o) {
    o = o || {};
    const r = {
      id: nextId++,
      kind,                             // "freeway" | "ramp"
      st: [{ x, y, h }],
      fwd: o.fwd != null ? o.fwd : 3,   // lanes in the direction of travel
      back: o.back != null ? o.back : 2,// lanes against it (0 for a ramp)
      med: kind === "ramp" ? 0 : MED,   // the fallback, when no array is set
      /* ── the median, per station ──────────────────────────────────────
         This was one number for a whole road, and one number cannot
         describe an Interstate. Through a city the two carriageways are
         a concrete barrier apart — 0.72 m, which is what MED is. In open
         country they are not joined at all: I-40 across the desert runs
         its two directions sixty to ninety feet apart on separate
         alignments, with grass, a ditch and sometimes trees between
         them, and no barrier because nothing can reach.

         So the median half-width is per station like the lane counts
         are, and the inside shoulder with it — AASHTO asks for 4 ft
         beside a two-lane carriageway and 10 to 12 beside a six-lane
         one, which is a real difference you can see from the car. */
      medW: [kind === "ramp" ? 0 : MED],
      shIn: [kind === "ramp" ? 0 : SH_IN],
      /* Whether a rail runs down the median. A wide median is not
         automatically an empty one: cross-median crashes are what
         high-tension cable barrier was invented for, and states
         string it down grass medians up to about seventy feet — so
         most of rural Tennessee has one and most of the desert does
         not. Per station, because it runs in stretches. */
      medRail: [0],
      aux: [0],                         // deceleration-lane width per station, +u side
      auxL: [0],                        // the same, −u side: the other carriageway's exits
      /* Station ranges of `aux`/`auxL` that `settleAux` may not raise:
         the wedge each gore closes over. Every other taper on this road
         is a shape that may be talked out of happening — see the note
         on settleAux — but the wedge is where the pavement stops being
         the freeway's, and it has to reach zero whatever is downstream
         of it. */
      auxHold: [], auxHoldL: [],
      lanes: [o.fwd != null ? o.fwd : 3],// retained per station for future lane changes
      /* Lanes on the OTHER carriageway, per station. `back` below is the
         scalar it used to be and is still the default this is filled
         from; the array exists because a real corridor gains and loses
         lanes along its length in both directions, and a single number
         set once from the middle of a twenty-mile window is the wrong
         width for most of it. */
      bLanes: [o.back != null ? o.back : 2],
      inner: [0],                       // extra inside shoulder after a left lane-drop exit
      /* The same, for the other carriageway. A left exit happens on one
         side of the median at a time — I-40's is westbound — and the
         two carriageways no more share an inside shoulder than they
         share a lane count. */
      innerL: [0],
      /* How high off the ground each station is, in decks: 0 is grade,
         1 is one bridge up. See the note on `layer` below — this is the
         PHYSICAL one, and it has to be per-station because a flyover is
         only a flyover in the middle. */
      deck: [0],
      rampLanes: kind === "ramp" ? (o.lanes || o.fwd || 1) : 0,
      curv: 0,
      curvT: o.curv != null ? o.curv : 0,
      curvHold: rnd(900, 2600),
      /* Station ranges over which this road must not draw its verge,
         gravel or guardrail on a given side, because another road is
         there. Without this, a freeway paints a full gravel shoulder
         and a steel barrier straight across the ramp leaving it, eight
         pixels after they part company. */
      noL: [], noR: [],
      /* The same, for the EDGE LINE rather than the furniture: stations
         where this road's own edge line falls inside another road's
         sealed surface, and so is not an edge and must not be painted.

         Without it the two roads at a gore each paint their edge line
         straight through the other's pavement, and the lines CROSS: the
         freeway's line runs out along the deceleration lane while the
         ramp's runs in along its own, and they cut through each other a
         lane apart. A real gore has one line coming in and two going
         out, meeting at the nose — which is exactly the point where each
         of these lines leaves the other road's tarmac. */
      noPaintL: [], noPaintR: [],
      maxCurv: o.maxCurv != null ? o.maxCurv : 1 / 3400,
      exits: [],       // [{ i, ramp }] offramps leaving this road
      meter: null,     // ramp only: { i, red, t, wait }
      merge: null,     // ramp only: { into, s, lane } where it joins
      parent: null,    // ramp only: the freeway it left
      /* PAINT ORDER, and nothing else. Higher paints later, so higher
         wins the seam where two roads touch. It is unique per road by
         construction, which is what makes the order stable — and it is
         emphatically not a height. Two roads sitting in the same field
         at grade have different layers. That conflation used to live in
         a single `elev` field and cost this game a reverted flyover and
         1,774 lethal points; `deck` above is the height. */
      layer: o.layer != null ? o.layer : 0,
      bounds: { minX: x, maxX: x, minY: y, maxY: y },
      laneChanges: [],
      dead: false,
    };
    return r;
  }

  function note(r, p) {
    const b = r.bounds;
    if (p.x < b.minX) b.minX = p.x;
    if (p.x > b.maxX) b.maxX = p.x;
    if (p.y < b.minY) b.minY = p.y;
    if (p.y > b.maxY) b.maxY = p.y;
  }

  function rebound(r) {
    const a = r.st;
    const b = r.bounds = { minX: a[0].x, maxX: a[0].x, minY: a[0].y, maxY: a[0].y };
    for (let i = 1; i < a.length; i++) note(r, a[i]);
    return b;
  }

  const len = (r) => (r.st.length - 1) * STEP;

  /* Grow the centreline until it reaches `to` world px long. The
     curvature target is re-rolled every few hundred pixels and eased
     toward, which is what makes the horizon drift instead of snapping. */
  function grow(r, to) {
    while (len(r) < to) {
      const n = r.st.length;
      const last = r.st[n - 1];
      r.curvHold -= STEP;
      if (r.curvHold <= 0) {
        r.curvHold = rnd(900, 2600);
        // long tangents are common; a road that is always turning reads as a track
        r.curvT = random() < 0.45 ? 0 : rnd(-r.maxCurv, r.maxCurv);
      }
      r.curv += (r.curvT - r.curv) * 0.035;
      const h = last.h + r.curv * STEP;
      const m = (last.h + h) / 2;
      const p = { x: last.x + Math.sin(m) * STEP, y: last.y + Math.cos(m) * STEP, h };
      r.st.push(p);
      note(r, p);
      r.aux.push(0);
      r.auxL.push(0);
      r.lanes.push(r.lanes[n - 1]);
      r.bLanes.push(r.bLanes[n - 1]);
      r.inner.push(r.inner[n - 1]);
      r.innerL.push(r.innerL[n - 1]);
      r.deck.push(r.deck[n - 1]);
      /* ── the other three, which used to be left behind ────────────────
         `medW`, `shIn` and `medRail` were not extended here, so a road
         built by growing kept them one station long for its whole
         length. `sample()` reads a one-element array as a constant, so
         nothing was visibly wrong — the answer was the value at station
         zero everywhere, which for the only thing that grows now (a
         scenery cross street) is the same value it would have had.

         They are extended because `edges()` below now takes ONE station
         index and applies it to all eight arrays, which is only sound
         if they are all as long as the centreline. Keeping the three in
         step is what makes that true for every road rather than for
         most of them. */
      r.medW.push(r.medW[n - 1]);
      r.shIn.push(r.shIn[n - 1]);
      r.medRail.push(r.medRail[n - 1]);
    }
  }

  /* `growBack()` was here: it grew a freeway BACKWARDS from a point so
     that a road you were about to merge onto already had a mile of
     itself behind you, aiming the upstream end parallel to the parent
     so the two did not tie themselves in knots. Nothing has called it
     since the corridor arrived — I-40 is surveyed for its whole length
     and there is never a road that has to be invented behind you. */

  /* Build a complete, deterministic freeway from map-scale waypoints.
     Catmull-Rom keeps every waypoint on the route while smoothing the
     joins; the dense curve is then resampled into the same near-eight-
     pixel stations used everywhere else. Closed routes duplicate their
     first station at the end and set `wrap`, which makes them suitable
     for metropolitan beltways.

     ── `o.polyline`, and when the spline is the wrong tool ────────────
     Smoothing is right for INVENTED routes, where the waypoints are a
     dozen city centres eighty thousand pixels apart and the curve
     between them is ours to choose. It is wrong for a SURVEYED one.

     A Catmull-Rom through a set of points is longer than the polyline
     joining them, and on real geometry that error compounds: fed the
     27,126 surveyed waypoints of I-40, this returned a road 2,587.8
     miles long from a source measured at 2,551.45 — a 36-mile
     overshoot, which on a corridor whose exit numbers are mile markers
     puts the far end of the state in the wrong place. It also invents
     curvature the road does not have, by rounding off corners that were
     surveyed square.

     So imported geometry sets `polyline` and is resampled as it stands.
     The OSM points average 150 m apart, which is finer than the eight
     pixels (1.43 m) between stations can even express, so nothing is
     lost by not smoothing — the interpolation below does it anyway. */
  /* ── a surveyed route, resampled as it stands ───────────────────────
     Stations land at EXACTLY `STEP` apart, and the last one falls short
     rather than the spacing being stretched to fit. Everything in this
     engine finds a station by dividing s by STEP, so a spacing of
     "total/pieces, which is nearly STEP" quietly drifts: the index error
     grows with distance, and on a road with 2.9 million stations in it
     the far end is several stations from where the arithmetic says.

     `fromPx`/`toPx` materialise a WINDOW of the route instead of all of
     it. The whole of I-40 is 2.9M stations and 620 MB of live objects,
     which is not going on a phone; twenty miles is 22,500 and 5 MB.
     `baseS` records where the window starts along the full route, so
     distances stay in corridor coordinates and mile markers keep
     meaning what they say. */
  function fromPolyline(pts, closed, o) {
    const n = pts.length;
    const cum = new Float64Array(n);
    for (let i = 1; i < n; i++)
      cum[i] = cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const total = cum[n - 1];

    const s0 = clamp(o.fromPx > 0 ? o.fromPx : 0, 0, Math.max(0, total - STEP));
    const s1 = clamp(o.toPx > 0 ? o.toPx : total, s0 + STEP, total);

    /* ── the window is sampled WIDER than it is kept ───────────────────
       Smoothing needs real road on both sides of every station it
       touches. Without the margin the stations near an edge get a
       lopsided average, so the same piece of I-40 comes out slightly
       different depending on which window happens to hold it — and the
       car jumps by that difference every time the window slides. With
       it, geometry is a pure function of position on the corridor and
       two overlapping windows agree exactly. */
    const MARGIN = 160;                       // stations, > SMOOTH_SPAN + HEAD_SPAN
    const g0 = Math.max(0, Math.floor(s0 / STEP) - MARGIN) * STEP;
    const keep0 = Math.round((s0 - g0) / STEP);
    const total0 = Math.floor((Math.min(total, s1 + MARGIN * STEP) - g0) / STEP);
    const count = total0;
    const wantCount = Math.max(1, Math.floor((s1 - s0) / STEP));

    const st = new Array(count + 1);
    let j = 1;
    for (let k = 0; k <= count; k++) {
      const target = g0 + k * STEP;
      while (j < n - 1 && cum[j] < target) j++;
      const a = pts[j - 1], b = pts[j];
      const span = Math.max(1e-9, cum[j] - cum[j - 1]);
      const t = (target - cum[j - 1]) / span;
      st[k] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: 0 };
    }
    /* ── heading, and why it is smoothed when position is not ─────────
       A surveyed polyline is straight between its vertices and turns all
       at once AT them. Stations here are 8 px apart on a polyline whose
       own points average 840 px apart, so a hundred consecutive stations
       share one heading and then the next pair jumps by the whole bend.
       Measured on I-40 that reads as a 57-metre radius — tighter than
       any Interstate ever built, and the camera takes its heading from
       the road, so every one of those corners would snap the view.

       The answer is NOT to smooth the geometry. Splining the positions
       is what inflated this corridor by 36 miles and it would move the
       exits off their mile markers. Position stays exactly as surveyed;
       only the heading is filtered, over a span comparable to the vertex
       spacing, so the camera turns the way a car does while the road
       stays where the survey put it.

       HEAD_SPAN is in stations: 96 of them is 137 m, which is about a
       sixth of the average vertex gap — wide enough to bridge a corner,
       narrow enough that a real curve keeps its shape. */
    /* ── a DESIGNED curve is not a survey and must not be filtered ─────
       Everything below this line exists to get a usable road out of
       surveyed points: 840 px apart, straight between them, turning all
       at once at each one. A road we generated ourselves — the frontage
       of a rest area, the loop-back of an exit — has none of those
       problems. Its points are already eight pixels apart on a smooth
       curve, and its whole design is that the offset from the mainline
       and the RATE of that offset both reach zero at each end, so it
       leaves and rejoins exactly tangent with nothing to stitch.

       Filtering it broke precisely that. Both filters are one-sided at
       the ends — there is no road beyond a ramp to average against — so
       the last stations got bent, and the tangency the shape was built
       to have was gone: the heading at the merge was out by up to 10.8°.
       The car and the camera both take their heading from the road, so
       rejoining the freeway kicked the whole screen sideways.

       So a generated curve says `smooth: false` and keeps its own shape,
       with the heading read straight off its neighbours. A surveyed one
       says nothing and is filtered as before. */
    const raw = o.smooth === false;
    const HEAD_SPAN = raw ? 2 : 96;
    for (let i = 0; i <= count; i++) {
      const a = st[Math.max(0, i - HEAD_SPAN)];
      const b = st[Math.min(count, i + HEAD_SPAN)];
      let dx = b.x - a.x, dy = b.y - a.y;
      if (dx === 0 && dy === 0) {                 // degenerate: fall back to near
        const c = st[Math.max(0, i - 1)], d = st[Math.min(count, i + 1)];
        dx = d.x - c.x; dy = d.y - c.y;
      }
      st[i].h = Math.atan2(dx, dy);
    }

    /* ── and then the corners are taken out of the road itself ────────
       Smoothing the heading alone fixes the camera and leaves the road
       cornered, because the stations still sit on the raw polyline. The
       survey is straight between its vertices and turns all at once at
       them, and those vertices average 840 px apart — about one per
       screen — so a curve arrives as a straight, a kink, a straight.

       The first attempt integrated positions forward along the smoothed
       heading. Arc length came out exact, which is the property that
       matters, but absolute position drifted 534 m over a twenty-mile
       window — and the windows have to line up with each other, so the
       car would have jumped half a kilometre every time one slid.

       A SYMMETRIC filter cannot drift: every station is the average of
       real positions either side of it. It does cut corners, so the
       chain comes out a shade shorter, and that is why it is re-spaced
       afterwards — stations must be exactly STEP apart or `s / STEP`
       stops finding them. */
    const SMOOTH_SPAN = 40;
    if (!raw && count > SMOOTH_SPAN * 2) {
      const sx = new Float64Array(count + 1), sy = new Float64Array(count + 1);
      let ax = 0, ay = 0;
      // seed with [0, SPAN): the loop's first pass adds index SPAN itself
      for (let i = 0; i < SMOOTH_SPAN; i++) { ax += st[i].x; ay += st[i].y; }
      for (let i = 0; i <= count; i++) {
        const lo = i - SMOOTH_SPAN - 1, hi = i + SMOOTH_SPAN;
        if (hi <= count) { ax += st[hi].x; ay += st[hi].y; }
        if (lo >= 0) { ax -= st[lo].x; ay -= st[lo].y; }
        const n2 = Math.min(count, i + SMOOTH_SPAN) - Math.max(0, i - SMOOTH_SPAN) + 1;
        sx[i] = ax / n2; sy[i] = ay / n2;
      }
      for (let i = 0; i <= count; i++) { st[i].x = sx[i]; st[i].y = sy[i]; }
      // re-space: corner-cutting shortened the chain, so walk it again
      const cum2 = new Float64Array(count + 1);
      for (let i = 1; i <= count; i++)
        cum2[i] = cum2[i - 1] + Math.hypot(st[i].x - st[i - 1].x, st[i].y - st[i - 1].y);
      /* NOT re-spaced, deliberately.

         Re-spacing walks the smoothed chain from its own first station,
         so where that station happens to be changes every position
         downstream — two overlapping windows came out 9.9 px apart and
         the car jumped that far each time one slid.

         Left alone, every station's position depends only on the
         surveyed points within the smoothing window around it, which
         makes geometry a pure function of distance along the corridor:
         any window containing a given point puts it in exactly the same
         place. The price is that corner-cutting leaves stations a
         hair under STEP apart on curves — 0.0035% measured, which is
         nine centimetres in a mile — and everything here finds a station
         by dividing by STEP. That error is uniform, tiny, and buys an
         exact seam. */
      const fit = count;
      for (let i = 0; i <= fit; i++) {
        const A = st[Math.max(0, i - HEAD_SPAN)], B = st[Math.min(fit, i + HEAD_SPAN)];
        let dx2 = B.x - A.x, dy2 = B.y - A.y;
        if (dx2 === 0 && dy2 === 0) {
          const C = st[Math.max(0, i - 1)], D = st[Math.min(fit, i + 1)];
          dx2 = D.x - C.x; dy2 = D.y - C.y;
        }
        st[i].h = Math.atan2(dx2, dy2);
      }
    }

    /* Drop the margins now the smoothing has used them. */
    const kept = st.slice(keep0, Math.min(st.length, keep0 + wantCount + 1));
    const r = make(o.kind === "ramp" ? "ramp" : "freeway", kept[0].x, kept[0].y, kept[0].h, o);
    r.st = kept;
    const L = kept.length;
  /* ── the cross-section arrays are TYPED ─────────────────────────────
     Ten numbers per station, read by `sample()` below, which the
     profile puts at 31.6% of a window rebuild — not because it is
     slow but because of how often it is asked. `edges()` alone is
     eight of these lookups, and the dressing, the paint and the
     clearance invariant all call `edges()` once per station per road
     per pass.

     A Float64Array is a contiguous block of doubles; a plain Array of
     numbers is a heap object whose elements V8 has to keep proving are
     still numbers. Same values, same arithmetic, one indirection less
     per read.

     They can be fixed-length here because a road built from a
     polyline is built once, whole. `grow()` still pushes, so a road
     that grows — which now means only the scenery cross streets —
     keeps plain arrays, and `sample()` reads either without caring. */
    const zeros = () => new Float64Array(L);
    const filled = (v) => { const a = new Float64Array(L); a.fill(v); return a; };
    r.aux = zeros();
    r.auxL = zeros();
    r.lanes = filled(o.fwd != null ? o.fwd : 3);
    r.bLanes = filled(o.back != null ? o.back : 2);
    r.inner = zeros();
    r.innerL = zeros();
    r.medW = filled(MED);
    r.medRail = zeros();
    r.shIn = filled(SH_IN);
    r.deck = zeros();
    r.wrap = closed;
    /* Where station ZERO actually is, not where the window was asked to
       start. Sampling is quantised to the STEP grid, so those differ by
       up to 8 px — and since the quantisation depends on the requested
       start, two overlapping windows disagreed by that much about where
       a given piece of road was, which the car felt as a jump each time
       one slid. */
    r.baseS = g0 + keep0 * STEP;
    r.routePx = total;            // how long the whole route is
    rebound(r);
    return r;
  }

  function makeRoute(points, o) {
    o = o || {};
    const closed = !!o.closed;
    const pts = points.map((p) => ({ x: +p.x, y: +p.y }));
    if (pts.length < (closed ? 3 : 2)) throw new Error("A route needs more waypoints");

    if (o.polyline) return fromPolyline(pts, closed, o);

    const dense = [];
    const segs = closed ? pts.length : pts.length - 1;
    const get = (i) => closed
      ? pts[(i % pts.length + pts.length) % pts.length]
      : pts[clamp(i, 0, pts.length - 1)];
    function cat(a, b, c, d, t) {
      const t2 = t * t, t3 = t2 * t;
      return {
        x: 0.5 * ((2 * b.x) + (-a.x + c.x) * t
          + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2
          + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
        y: 0.5 * ((2 * b.y) + (-a.y + c.y) * t
          + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2
          + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
      };
    }
    for (let i = 0; i < segs; i++) {
      const a = get(i - 1), b = get(i), c = get(i + 1), d = get(i + 2);
      const direct = Math.hypot(c.x - b.x, c.y - b.y);
      /* Oversample the spline before resampling it to stations. The
         factor was 0.55 — four times finer than the stations it feeds —
         which on a map with three million stations in it is most of a
         second spent computing points that are then averaged away.
         Waypoints here are eighty thousand pixels apart; 1.1 is still
         twice the resolution the resample can carry. */
      const steps = Math.max(12, Math.ceil(direct / (STEP * 1.1)));
      for (let k = 0; k < steps; k++) dense.push(cat(a, b, c, d, k / steps));
    }
    dense.push(closed ? { ...pts[0] } : { ...pts[pts.length - 1] });

    const cum = new Float64Array(dense.length);
    for (let i = 1; i < dense.length; i++)
      cum[i] = cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y);
    const total = cum[cum.length - 1];
    const pieces = Math.max(2, Math.round(total / STEP));
    const sampled = [];
    let j = 1;
    for (let k = 0; k <= pieces; k++) {
      const target = total * k / pieces;
      while (j < cum.length - 1 && cum[j] < target) j++;
      const a = dense[j - 1], b = dense[j];
      const span = Math.max(1e-6, cum[j] - cum[j - 1]);
      const t = (target - cum[j - 1]) / span;
      sampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: 0 });
    }
    for (let i = 0; i < sampled.length; i++) {
      const a = sampled[i === sampled.length - 1 ? Math.max(0, i - 1) : i];
      const b = sampled[i === sampled.length - 1 ? i : i + 1];
      sampled[i].h = Math.atan2(b.x - a.x, b.y - a.y);
    }
    if (closed) sampled[sampled.length - 1].h = sampled[0].h;

    const r = make("freeway", sampled[0].x, sampled[0].y, sampled[0].h, o);
    r.st = sampled;
    const zeros = () => new Float64Array(sampled.length);
    const filled = (v) => { const a = new Float64Array(sampled.length); a.fill(v); return a; };
    r.aux = zeros();
    r.auxL = zeros();
    r.lanes = filled(o.fwd != null ? o.fwd : 3);
    r.bLanes = filled(o.back != null ? o.back : 2);
    r.inner = zeros();
    r.innerL = zeros();
    r.medW = filled(MED);
    r.medRail = zeros();
    r.shIn = filled(SH_IN);
    r.deck = zeros();
    r.wrap = closed;
    rebound(r);
    return r;
  }

  /* ── the surface street ─────────────────────────────────────────────
     The cross road of a diamond interchange, and the only road here that
     is not limited-access. It is built as a freeway with no barrier
     rather than as a wide ramp, and that is a deliberate choice with
     three consequences worth having:

       it has a `back` carriageway, so it is genuinely two-way;
       it has an `exits` array, so an onramp can leave it exactly the
         way a ramp leaves a motorway, using machinery that already
         works and is already tested;
       med = 0 means classify() can never call its middle a barrier,
         so the centre of a street is somewhere you may drive.

     What remains in the middle is SH_IN either side of nothing — a 2.5 m
     painted strip between the two directions. On an American arterial
     that is a two-way left-turn lane, which is precisely what belongs
     outside a diamond, so it is drawn and treated as one. */
  function makeStreet(x, y, h, o) {
    o = o || {};
    const r = make("freeway", x, y, h, {
      fwd: o.lanes || 1, back: o.lanes || 1, maxCurv: 0, layer: o.layer || 0,
    });
    r.med = 0;
    r.street = true;
    r.routeType = "cross-street";
    return r;
  }

  /* ── sampling the centreline ────────────────────────────────────────
     Stations are evenly spaced, so s → index is a divide. Headings are
     interpolated so a car crossing a station boundary doesn't twitch. */
  function frame(r, s) {
    const n = r.st.length;
    const f = clamp(s / STEP, 0, n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const t = n < 2 ? 0 : f - i;
    const a = r.st[i], b = r.st[Math.min(n - 1, i + 1)];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      /* ── the short way round, not the arithmetic mean ────────────────
         `a.h + (b.h - a.h) * t` is right for every heading except the
         one this road eventually points in. Headings come out of atan2
         and live in (−π, π]; a road heading due −y crosses that cut, so
         two ADJACENT stations read +3.141 and −3.141 — a tenth of a
         degree apart on the ground and 359.9 degrees apart as numbers.
         Interpolated linearly, the midpoint comes out at 0: exactly
         backwards.

         Nothing notices while the answer is only used for `x` and `y`,
         because those interpolate on their own. It matters the moment
         somebody asks for a point OFFSET from the centreline, which is
         how every ramp in this game is built: at() takes cos and sin of
         a heading pointing the wrong way and puts the point on the far
         side of the road, twice the offset out. One station in the
         middle of a generated exit at mile 2139 landed 511 px away, and
         the resampler then walked out to it and back — a hairpin in the
         centreline of a road you can drive, 134 px deep into the
         mainline, at the one interchange where I-40 happens to run due
         south through the Pigeon River Gorge. */
      h: a.h + angleDiff(b.h, a.h) * t,
      i,
    };
  }

  /* a world point at distance s along, offset u across */
  function at(r, s, u) {
    const f = frame(r, s);
    return { x: f.x + Math.cos(f.h) * u, y: f.y - Math.sin(f.h) * u, h: f.h };
  }

  /* Read a per-station array at a distance, interpolated. Every one of
     these used to be its own six-line copy of the same three lines, and
     the copies had already drifted — the fallback for a one-station road
     returned 0 in one and 1 in another. */
  const sample = (a, s, dflt) => {
    if (!a || !a.length) return dflt;
    if (a.length < 2) return a[0] != null ? a[0] : dflt;
    const f = clamp(s / STEP, 0, a.length - 1);
    const i = Math.min(a.length - 2, Math.floor(f));
    return a[i] + (a[i + 1] - a[i]) * (f - i);
  };

  const auxAt = (r, s) => sample(r.aux, s, 0);
  /* The same lane on the other carriageway. See the header: without it
     a westbound exit widened the eastbound side of the motorway. */
  const auxAtL = (r, s) => sample(r.auxL, s, 0);
  const lanesAt = (r, s) => sample(r.lanes, s, 1);
  /* Lanes against the direction of travel. `r.back` is the scalar this
     is seeded from and remains the default for roads that never vary;
     on the corridor it varies, and a single number taken from the middle
     of a twenty-mile window was the wrong width for most of it. */
  const backLanesAt = (r, s) => (r.bLanes ? sample(r.bLanes, s, r.back) : r.back);
  const innerAt = (r, s) => sample(r.inner, s, 0);
  const innerAtL = (r, s) => sample(r.innerL, s, 0);
  /* How high this road is at this point, in decks. Interpolated rather
     than stepped, so a bridge approach is a grade you climb and not a
     cliff you teleport up: everything that asks this question is really
     asking "is that other road at my level", and a road halfway up its
     approach embankment is honestly answered by 0.5. */
  const deckAt = (r, s) => sample(r.deck, s, 0);

  /* The sealed surface, as offsets. Everything outside is shoulder,
     then gravel, then grass, then something that ends your run.

     A ramp's cross-section hangs off its LEFT edge rather than being
     centred, so that lane 0 always sits exactly on the centreline. That
     matters where the terminal flares to two lanes: anchored left, the
     extra lane appears on the right and the merging lane runs dead
     straight through. Anchored centrally, the whole ramp would shuffle
     sideways by half a lane as it widened, and you would feel it. */
  /* ── the middle of the road, per station ─────────────────────────────
     `insideAt` is the offset from the centreline to the first lane edge:
     the median half-width plus the paved inside shoulder. Almost every
     caller wants exactly that sum, which is why it is one function and
     not two — the pair `r.med + SH_IN` appeared in fifteen places and
     every one of them had to change together or not at all.

     `medAt` is kept separate for the two questions that really are about
     the median itself: where to put a barrier, and whether a given point
     is standing in it. */
  const medAt = (r, s) =>
    r.kind === "ramp" ? 0 : sample(r.medW, s, r.med != null ? r.med : MED);
  const shInAt = (r, s) =>
    r.kind === "ramp" ? 0 : sample(r.shIn, s, SH_IN);
  const insideAt = (r, s) => medAt(r, s) + shInAt(r, s);
  /* Half-width of the median rail, or 0 where there is none. Only
     asked of a median too wide for a concrete barrier — inside that
     width the barrier IS the median. */
  const MED_RAIL_W = 1.5;
  const medRailAt = (r, s) =>
    r.kind !== "ramp" && medAt(r, s) > MED_BARRIER && sample(r.medRail, s, 0) > 0.5
      ? MED_RAIL_W : 0;

  /* ── one station index, eight arrays ────────────────────────────────
     `edges` is the hottest function in a window rebuild. It is asked
     once per station per road per pass by the dressing, the paint, the
     clearance invariant and the renderer, and it used to answer with
     eight separate `sample()` calls — eight function calls, eight
     divisions, eight clamps and eight floors, all computing the SAME
     station index from the same `s`.

     Profiled over five rebuilds, `sample` was 31.6% of the whole build
     and `dress`/`dressAll`/`noses` — which are almost entirely
     `edges` and `project` — were 57% between them.

     So the index is computed once here and applied to all eight. That
     is only sound while every array is as long as the centreline,
     which `fromPolyline`, `makeRoute` and now `grow` all guarantee;
     `fits` checks it rather than assuming it, once per road rather
     than once per call, and anything that does not fit falls back to
     the general path. Same arithmetic either way — `sample` clamps to
     `a.length - 1` and this clamps to `n - 1`, and when they are equal
     so are the answers. */
  function fits(r) {
    const n = r.st.length;
    if (r._fitN === n) return r._fit;
    r._fitN = n;
    r._fit = n > 1 && r.medW.length === n && r.shIn.length === n
          && r.inner.length === n && r.innerL.length === n
          && r.lanes.length === n && r.bLanes.length === n
          && r.aux.length === n && r.auxL.length === n;
    return r._fit;
  }

  function edges(r, s) {
    if (r.kind === "ramp") {
      return { uL: -LANE / 2, uR: (r.rampLanes - 0.5) * LANE };
    }
    if (fits(r)) {
      const n = r.st.length;
      const f = clamp(s / STEP, 0, n - 1);
      const i = Math.min(n - 2, Math.floor(f)), t = f - i;
      const med = r.medW[i] + (r.medW[i + 1] - r.medW[i]) * t
                + r.shIn[i] + (r.shIn[i + 1] - r.shIn[i]) * t;
      return {
        uL: -(med
          + r.innerL[i] + (r.innerL[i + 1] - r.innerL[i]) * t
          + (r.bLanes[i] + (r.bLanes[i + 1] - r.bLanes[i]) * t) * LANE
          + r.auxL[i] + (r.auxL[i + 1] - r.auxL[i]) * t),
        uR: med
          + r.inner[i] + (r.inner[i + 1] - r.inner[i]) * t
          + (r.lanes[i] + (r.lanes[i + 1] - r.lanes[i]) * t) * LANE
          + r.aux[i] + (r.aux[i + 1] - r.aux[i]) * t,
      };
    }
    const inside = innerAt(r, s);
    return {
      uL: -(insideAt(r, s) + innerAtL(r, s) + backLanesAt(r, s) * LANE + auxAtL(r, s)),
      uR: insideAt(r, s) + inside + lanesAt(r, s) * LANE + auxAt(r, s),
    };
  }

  /* Lane centres. `dirFwd` picks the carriageway; lane 0 is always the
     one nearest the middle of the road, so lane (count−1) is the one
     that exits, on either side. */
  function laneCount(r, s, dirFwd) {
    if (r.kind === "ramp") return r.rampLanes;
    return Math.max(dirFwd ? 1 : 0,
                    Math.round(dirFwd ? lanesAt(r, s) : backLanesAt(r, s)));
  }
  function laneU(r, s, lane, dirFwd) {
    if (r.kind === "ramp") return LANE * lane;
    return dirFwd
      ? insideAt(r, s) + innerAt(r, s) + LANE * (lane + 0.5)
      : -(insideAt(r, s) + innerAtL(r, s) + LANE * (lane + 0.5));
  }
  /* Centre of the first auxiliary lane. More lanes can sit outside it,
     but lane zero must not slide sideways as they open.

     `side` is which carriageway, and the return is ALREADY SIGNED — a
     left-hand aux lane comes back negative. Callers used to write
     `side > 0 ? auxLaneU(r, s) : -auxLaneU(r, s)`, which negated a
     number measured on the wrong side of the road: it put the westbound
     ramps up to 41 px off the pavement, and five of eighteen clean off
     it. There is only one right answer per side and this returns it. */
  const auxLaneU = (r, s, side) => (side < 0
    ? -(insideAt(r, s) + innerAtL(r, s) + backLanesAt(r, s) * LANE
        + Math.min(LANE, auxAtL(r, s)) / 2)
    : insideAt(r, s) + innerAt(r, s) + lanesAt(r, s) * LANE
      + Math.min(LANE, auxAt(r, s)) / 2);

  /* ── projection ─────────────────────────────────────────────────────
     Given a world point, where is it on this road? Used every frame for
     the player (what am I standing on) and for traffic that has drifted.

     `hint` is the last known station index. Scanning ±72 stations round
     it covers 1150 px of road, which nothing can cross in a frame, and
     keeps this O(1) instead of O(length of the motorway). Pass null and
     it scans the lot — fine at construction, not fine in the loop.

     `span` narrows that window. Callers that walk a road station by
     station carry a hint that is never more than a station or two stale,
     and at map-build scale the difference is not academic: dressing a
     thousand interchanges at ±72 is a hundred and fifty million segment
     tests, and at ±16 it is thirty. */
  function project(r, x, y, hint, span) {
    const st = r.st, n = st.length;
    if (n < 2) return null;
    let lo = 0, hi = n - 2;
    if (hint != null) {
      const w = span > 0 ? span : 72;
      lo = Math.max(0, (hint | 0) - w);
      hi = Math.min(n - 2, (hint | 0) + w);
    }
    let bi = -1, bt = 0, bd = Infinity, bx = 0, by = 0;
    /* The far end of one segment is the near end of the next, so the
       pair is carried rather than loaded twice.

       Mirroring these positions into flat Float64Arrays was tried here
       — `project` is the most expensive thing in a window rebuild and a
       station is an object, so the walk is a pointer chase. It was
       worth 1.5%, which does not pay for a second copy of every
       centreline and a cache that has to be invalidated whenever
       geometry settles. V8 keeps these objects monomorphic and packed
       and is already doing most of the work. */
    let ax = st[lo].x, ay = st[lo].y;
    for (let i = lo; i <= hi; i++) {
      const q = st[i + 1], nx = q.x, ny = q.y;
      const ex = nx - ax, ey = ny - ay;
      const L2 = ex * ex + ey * ey;
      let t = L2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / L2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const cx = ax + ex * t, cy = ay + ey * t;
      const dx = x - cx, dy = y - cy;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; bt = t; bx = cx; by = cy; }
      ax = nx; ay = ny;
    }
    if (bi < 0) return null;
    const a = st[bi], b = st[bi + 1];
    /* The short way round — the same trap frame() fell into, and this
       one is worse because `u` is what the whole game steers by. Two
       adjacent stations either side of the ±π cut read +3.141 and
       −3.141; interpolated linearly the heading here came out sideways,
       and `u` — which is the offset resolved along that heading — came
       back as its cosine. Measured at mile 2128, where I-40 runs due
       south through the gorge: two roads 268 px apart reported an offset
       of 62.7, because the heading was 76 degrees out. Everything that
       asks where you are across a road was reading that number. */
    const h = a.h + angleDiff(b.h, a.h) * bt;
    const u = (x - bx) * Math.cos(h) - (y - by) * Math.sin(h);
    return { i: bi, t: bt, s: (bi + bt) * STEP, u, h, dist: Math.sqrt(bd) };
  }

  /* ── the deceleration lanes ─────────────────────────────────────────
     Paint one to three aux lanes onto the full approach: each added
     lane gets a 92 m taper, then all run full width for 137 m before
     the gore. After the gore those same strips of surface belong to the
     ramp, so the freeway gives them up — over WEDGE, not at once.
     The arrival is deliberately longer still, because a parallel merge
     lane should feel like time to merge rather than a trapdoor.

     ── WEDGE, and the white line that jumped a lane ──────────────────
     These two functions used to write only the half of the shape they
     were named for: openAux ramped the lane up to full width and then
     stopped, and closeAux began at full width out of nothing. The
     stations either side of those points therefore held 0 and a full
     20.5 px lane, eight pixels apart.

     Nothing rounds that off downstream. The asphalt band is usually
     hidden under the ramp so the step in it does not read, but the edge
     line is drawn per eight-pixel piece from edges().uR and markings are
     a later pass, so the white line ran 20.5 px sideways in 8 px of
     road: a bar at 69° slashed across the exit. Thirty-six of them in a
     twenty-mile window, two per exit per direction.

     So both ends taper. 40 stations is 320 px, and what that buys is
     the width of the neutral area at the back of the gore: measured
     over 115 junctions, the two roads are a median 25 px apart 320 px
     past the gore, which on this scale is 4.5 m at 57 m — about four
     and a half degrees, and a real gore.

     It was claimed here that 320 px is close to the rate the ramp
     itself pulls away. Measured, it was not: the freeway contributed
     the whole 20.5 px of it and the ramp a median 4.9, and at the tenth
     percentile the ramp's near edge moved the wrong way and the freeway
     opened the gore on its own. That was a fact about the shape the
     generated exits were drawn with, not about this number, and it is
     mostly gone — the profile now comes off the survey and a generated
     ramp contributes a median 6.2 px here against a surveyed 11.7,
     matching from about 500 px on. What is left is inside the spiral's
     own 320 px, which is what a spiral is; see PLAN.md §7b. */
  const TAPER = 64;         // 92 m: the extra lane opens to full width
  const DECEL = 96;         // 137 m: full-width lane before the gore
  const EXIT_APPROACH = TAPER + DECEL;
  const MERGE = 150;        // 215 m: parallel acceleration/merge lane
  const WEDGE = 40;         // stations: the aux lane closing up again
  const exitApproach = (lanes) => TAPER * Math.max(1, lanes | 0) + DECEL;
  const mergeLength = (lanes) => MERGE * Math.max(1, lanes | 0);

  /* How far past a gore the two roads are still too close together to
     each have a verge. */
  const GORE = 360;

  const suppressed = (list, i) => {
    for (let k = 0; k < list.length; k++) if (i >= list[k].a && i <= list[k].b) return true;
    return false;
  };

  /* `over` shortens the whole approach. A motorway exit wants the full
     92 m taper and 137 m of full-width lane, because that is what it
     takes to shed sixty miles an hour. A right-turn bay on a surface
     street beside an interchange has neither the room nor the need, and
     forcing the freeway figure on it would run the bay back through the
     bridge it is standing on. */
  /* Which carriageway's aux array, given a side. `side < 0` is the
     oncoming one — the −u edge — and it exists because exits happen on
     both of them. */
  const auxSide = (r, side) => (side < 0 ? r.auxL : r.aux);

  /* Which way "upstream" is, in stations. The oncoming carriageway is
     driven against the corridor's own numbering, so its approach lane
     has to open at falling index and taper away at rising index — build
     it the other way round and the deceleration lane appears where a
     westbound driver has already gone past. */
  const auxDir = (side) => (side < 0 ? -1 : 1);

  function openAux(r, i, lanes, over, side) {
    lanes = Math.max(1, Math.min(3, lanes | 0));
    const a = auxSide(r, side);
    const d = auxDir(side);
    const approach = over > 0 ? Math.round(over) : exitApproach(lanes);
    const taper = over > 0 ? approach * 0.55 : TAPER;
    const width = (k) => {
      let w = 0;
      for (let lane = 0; lane < lanes; lane++) w += LANE * smooth((k - lane * taper) / taper);
      return w;
    };
    for (let k = 0; k <= approach; k++) {
      const j = i - d * (approach - k);
      if (j < 0 || j >= a.length) continue;
      a[j] = Math.max(a[j], width(k));
    }
    /* …and then it has to close up again. The lane the ramp took is not
       the freeway's any more, so the freeway's edge comes back in — over
       WEDGE, from exactly the width it had reached, so the two agree at
       the gore station and nothing steps. */
    const full = width(approach);
    for (let k = 1; k <= WEDGE; k++) {
      const j = i + d * k;
      if (j < 0 || j >= a.length) continue;
      a[j] = Math.max(a[j], full * smooth(1 - k / WEDGE));
    }
    /* And this closure is the one that is not negotiable. The gore
       station itself is left out of the range: it is the full-width end
       of the approach, and the lane arriving at it is exactly what
       settleAux has to be able to see. */
    const hold = side < 0 ? r.auxHoldL : r.auxHold;
    hold.push({ a: Math.min(i + d, i + d * WEDGE), b: Math.max(i + d, i + d * WEDGE) });
  }

  /* The mirror image, for the far end of a ramp: its one to three lanes
     arrive full width and thin away together, forcing traffic to merge
     rather than simply appearing in the destination carriageway. `i` is
     the station the ramp actually ARRIVES at — the lead-in below is what
     opens the pavement up to meet it, and callers that shifted `i`
     upstream to fake that lead-in should stop.

     ── the lead-in is an ACCELERATION LANE, not a wedge ────────────────
     It used to be WEDGE, the same 320 px the gore closes over, and that
     is far too short for this end. A ramp does not arrive at the
     freeway; it converges on it, over a fifteen-hundred-pixel taper, and
     for all but the last few of those the freeway had not opened its
     lane yet. So the ramp ran alongside with the two roads' edge lines
     three pixels apart, each painting a solid line, for a quarter of a
     mile before every merge.

     Opening it over the same distance the lane later closes makes the
     two ends of a merge symmetric and gives the thing its real shape:
     the pavement is there, full width, and then it tapers away and you
     are expected to have merged. */
  function closeAux(r, i, lanes, over, side) {
    lanes = Math.max(1, Math.min(3, lanes | 0));
    const a = auxSide(r, side);
    const d = auxDir(side);
    const length = over > 0 ? Math.round(over) : mergeLength(lanes);
    const full = lanes * LANE;
    for (let k = 1; k <= length; k++) {
      const j = i - d * k;
      if (j < 0 || j >= a.length) continue;
      a[j] = Math.max(a[j], full * smooth(1 - k / length));
    }
    for (let k = 0; k <= length; k++) {
      const j = i + d * k;
      if (j < 0 || j >= a.length) continue;
      a[j] = Math.max(a[j], full * smooth(1 - k / length));
    }
  }

  /* ── two tapers that meet in the middle are not two tapers ───────────
     openAux and closeAux each write their own shape and combine with
     Math.max, and where two structures are closer together than the
     lengths they are sized for, the max of a lane thinning away and a
     lane opening up is a DIP: full width, down to a trough, back to
     full width, and the edge line follows it exactly. Swept over 64
     windows: 283 of them, 9% of every station of open auxiliary lane,
     a median 4.1 px deep and the worst 13.5 — two thirds of a lane
     pinched out of the side of the road and put back over 1,100 px.

     It is not a taper rate that is wrong, it is the premise. An
     acceleration lane tapers away because there is nothing after it. If
     the next interchange's deceleration lane starts before that has
     finished, the honest thing on the ground is the thing that is
     actually built there: ONE auxiliary lane running from the merge to
     the next gore, full width, dotted on the inside — which is what an
     auxiliary lane between adjacent interchanges IS.

     So no taper is sized against a neighbour and no two tapers are
     blended. Each is written as if it were alone, and then the valleys
     between them are filled: inside a run of open lane, every station
     is raised to the lower of the highest lane behind it and the
     highest ahead of it. Rises and falls are untouched by construction
     — a station on a genuine flank is already the running max on that
     side — so a lane that really does open out of nothing still opens
     over the full taper, and only the crossings are removed. The result
     is unimodal per run: up, along, down, and never back up again.

     `auxHold` is the one exception, and it is why this is not simply a
     smoothing pass. See openAux. */
  function settleAux(r) {
    for (const side of [1, -1]) {
      const a = auxSide(r, side);
      const holds = side < 0 ? r.auxHoldL : r.auxHold;
      const n = a.length;
      /* Laid out flat rather than asked through `suppressed`, which
         scans the whole range list per call: this walks every station
         of a twenty-mile window, and there are thirty ranges. */
      const held = new Uint8Array(n);
      for (const h of holds)
        for (let k = Math.max(0, h.a); k <= Math.min(n - 1, h.b); k++) held[k] = 1;
      let p = 0;
      while (p < n) {
        if (a[p] <= 0 || held[p]) { p++; continue; }
        let q = p;
        while (q + 1 < n && a[q + 1] > 0 && !held[q + 1]) q++;
        /* min(highest behind, highest ahead), over [p, q] */
        const m = q - p + 1;
        const ahead = new Float64Array(m);
        let hi = 0;
        for (let k = m - 1; k >= 0; k--) { if (a[p + k] > hi) hi = a[p + k]; ahead[k] = hi; }
        let behind = 0;
        for (let k = 0; k < m; k++) {
          if (a[p + k] > behind) behind = a[p + k];
          const fill = behind < ahead[k] ? behind : ahead[k];
          if (fill > a[p + k]) a[p + k] = fill;
        }
        p = q + 1;
      }
    }
  }

  /* ── a lane drop ────────────────────────────────────────────────────
     A left exit takes the existing inside lanes. The continuing road's
     remaining lane centres stay exactly where they were; its inside
     shoulder simply becomes wider by the width of the lanes that left.
     That is the whole difference between a left exit and a right one,
     and it is why there is no deceleration lane on this side: there is
     nothing to decelerate into, because the lane you are in IS the
     ramp. Two lanes of I-40 west become two lanes of I-75 south at the
     Knoxville wye and they never come back.

     `side < 0` does it to the other carriageway, which on I-40 is where
     the only left exit actually is. The arrays are the mirror pair —
     bLanes and innerL — and "downstream" is falling index, because the
     oncoming carriageway is driven against the corridor's numbering.

     ── why the count is PINNED ahead of the nose ──────────────────────
     applyLanes() eases the surveyed count over ±120 stations, so a
     4-to-2 change reads 2.7 lanes a thousand pixels BEFORE the gore.
     For a taper that is right and for a drop it is not: at a wye you
     have all four lanes right up to the nose and then two of them are
     a different Interstate. Pinned, the outer edge holds and the paint
     stays straight into the gore.

     ── and why it heals ───────────────────────────────────────────────
     The corridor's centreline is I-40's own, so a mile past the wye the
     road is an ordinary symmetric two-lane carriageway again. Left
     displaced, it would run the rest of a twenty-mile window two lanes
     out from its own median. `heal: 0` — the default, and what the
     fictional map's makeRamp has always had — means never close up. */
  const DROP_PIN = 140;              // stations of full width before the nose
  function dropLeft(r, i, count, side, opts) {
    opts = opts || {};
    const back = side < 0;
    const arr = back ? r.bLanes : r.lanes;
    const inn = back ? r.innerL : r.inner;
    if (!arr || !arr.length || !inn) return 0;
    const d = back ? -1 : 1;                    // the way its driver goes
    const n = arr.length;
    const pin = opts.pin != null ? opts.pin : DROP_PIN;
    const upAt = clamp(i - d * pin, 0, n - 1);   // clear of the survey's taper
    const from = Math.round(sample(arr, upAt * STEP, back ? r.back : r.fwd));
    count = Math.max(1, Math.min(count | 0, from - 2));
    const width = count * LANE;
    const to = from - count;

    for (let k = 0; k <= pin; k++) {
      const j = i - d * k;                      // upstream: ahead of the nose
      if (j < 0 || j >= n) break;
      arr[j] = Math.max(arr[j], from);
      inn[j] = 0;
    }
    const hold = opts.hold != null ? opts.hold : Infinity;
    const heal = opts.heal != null ? opts.heal : 0;
    const last = hold + heal;
    for (let k = 1; k <= last; k++) {
      const j = i + d * k;                      // downstream: past it
      if (j < 0 || j >= n) break;
      arr[j] = Math.min(arr[j], to);
      const t = k > hold ? Math.max(0, 1 - (k - hold) / heal) : 1;
      inn[j] = Math.max(inn[j], width * smooth(t));
    }
    if (back) r.back = Math.max(2, r.back - count);
    else r.fwd = Math.max(2, r.fwd - count);
    return count;
  }

  /* How long a lane takes to appear or disappear: 120 stations, 172 m.
     A twelve-foot lane arriving in one station reads as a fault in the
     road rather than as a taper, and this is the distance over which it
     is spread instead.

     `changeLanes()` used to own this constant and is gone — it added or
     dropped one outside through lane on demand, which is a thing the
     fictional map's generator asked for and the corridor never does.
     The corridor's counts come off the survey, per station, and
     World.applyLanes eases them with a boxcar of this half-width. So
     the taper survives; only the function that used to request one has
     gone, and the number stays here because road.js is where the
     cross-section's dimensions live. */
  const LANE_CHANGE = 120;

  /* ── the two ramp builders that the corridor does not use ───────────
     `makeRamp()` and `makeLink()` were here, and PLAN.md §3 said to
     keep them because "these build the loop-backs". That stopped being
     true when the corridor did.

     makeRamp grew a free-running curve off a parent — a clothoid into
     a turn of a chosen radius, eased back to straight — and let World
     put a destination under its far end. makeLink joined two roads
     that already existed with a cubic and fixed tangents. Both were
     built for a map where the interchange was invented, and neither
     has been called since there was a survey to read one out of:
     buildRealRamp walks the geometry OSM recorded, and buildStop and
     buildLeftExit sample a shape off the mainline's own frame. All
     three go through makeRoute.

     What they knew that is worth not losing is written down elsewhere:
     the gore is deliberately exaggerated because one in twenty is
     invisible at the distance you can see (the note above openAux),
     and a ramp's centreline starts at the middle of the deceleration
     lane so the two surfaces are contiguous by construction (the note
     on `aux` at the top of this file). Those are the two ideas; the
     code around them was for a different map. */

  return {
    STEP, LANE, MED, MED_BARRIER, MED_RURAL, MED_SUBURB, SH_IN, SH_OUT, VERGE, RAMP_SH,
    medAt, shInAt, insideAt, medRailAt, MED_RAIL_W,
    TAPER, DECEL, EXIT_APPROACH, MERGE, WEDGE, GORE, LANE_CHANGE, exitApproach, mergeLength,
    suppressed,
    make, makeRoute, makeStreet, grow, len,
    frame, at, edges, laneU, laneCount, auxAt, auxAtL, auxLaneU,
    lanesAt, backLanesAt, innerAt, innerAtL, deckAt,
    rebound,
    project, openAux, closeAux, settleAux, dropLeft,
  };
})();
