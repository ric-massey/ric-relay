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
   and the moment the ramp exists the freeway's aux drops back to zero.
   Nothing has to be stitched — the two surfaces are contiguous at the
   gore because they were built from the same number, and the gap that
   opens between them afterwards *is* the gore.

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
  const VERGE = 9;         // unsealed strip beyond the paved shoulder
  const RAMP_SH = 8;       // roughly 4.7 ft beside the ramp carriageway

  let nextId = 1;
  let random = Math.random;

  const rnd = (a, b) => a + random() * (b - a);
  const setRandom = (fn) => { random = typeof fn === "function" ? fn : Math.random; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

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
      med: kind === "ramp" ? 0 : MED,
      aux: [0],                         // deceleration-lane width per station
      lanes: [o.fwd != null ? o.fwd : 3],// retained per station for future lane changes
      inner: [0],                       // extra inside shoulder after a left lane-drop exit
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

  function nearBounds(r, x, y, pad) {
    const b = r.bounds;
    return x >= b.minX - pad && x <= b.maxX + pad
        && y >= b.minY - pad && y <= b.maxY + pad;
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
      r.lanes.push(r.lanes[n - 1]);
      r.inner.push(r.inner[n - 1]);
      r.deck.push(r.deck[n - 1]);
    }
  }

  /* Build a road backwards from a point, so a freeway you are about to
     merge onto already has a mile of itself behind you, with traffic on
     it. The stations come out in reverse and get flipped; headings turn
     round because travelling the other way is what "backwards" means. */
  /* `aim` bends the first stretch of that back-extension until it is
     running at a given heading, and it is the reason interchanges here
     don't tie themselves in knots. A ramp lands on the new freeway
     already turned thirty or forty degrees off the old one; extend that
     straight backwards and it drives through the road you just left. So
     the upstream end is aimed back parallel to the parent instead, and
     the new freeway resolves into what it would be in the real world —
     a second motorway running alongside the first, a few hundred pixels
     off, with a link road between them. */
  function growBack(r, dist, aim) {
    const head = [];
    let x = r.st[0].x, y = r.st[0].y, h = r.st[0].h;
    let curv = 0, curvT = 0, hold = rnd(900, 2600);
    const aimH = aim ? aim.h : null, aimLen = aim ? aim.len : 0;
    const h0 = h;
    for (let d = 0; d < dist; d += STEP) {
      let nh;
      if (aimH != null && d < aimLen) {
        // smoothstep the heading from where the ramp left it back to parallel
        const t = (d + STEP) / aimLen;
        nh = h0 + (aimH - h0) * (t * t * (3 - 2 * t));
      } else {
        hold -= STEP;
        if (hold <= 0) { hold = rnd(900, 2600); curvT = random() < 0.45 ? 0 : rnd(-r.maxCurv, r.maxCurv); }
        curv += (curvT - curv) * 0.035;
        nh = h - curv * STEP;
      }
      const m = (h + nh) / 2;
      x -= Math.sin(m) * STEP; y -= Math.cos(m) * STEP; h = nh;
      head.push({ x, y, h });
    }
    head.reverse();
    r.st = head.concat(r.st);
    rebound(r);
    r.aux = new Array(head.length).fill(0).concat(r.aux);
    r.lanes = new Array(head.length).fill(r.lanes[0]).concat(r.lanes);
    r.inner = new Array(head.length).fill(r.inner[0]).concat(r.inner);
    r.deck = new Array(head.length).fill(r.deck[0]).concat(r.deck);
    for (const e of r.exits) e.i += head.length;
    return head.length;              // how far every existing index shifted
  }

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
    const count = Math.max(1, Math.floor((s1 - s0) / STEP));

    const st = new Array(count + 1);
    let j = 1;
    for (let k = 0; k <= count; k++) {
      const target = s0 + k * STEP;
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
    const HEAD_SPAN = 96;
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

    const r = make("freeway", st[0].x, st[0].y, st[0].h, o);
    r.st = st;
    const L = st.length;
    r.aux = new Array(L).fill(0);
    r.lanes = new Array(L).fill(o.fwd != null ? o.fwd : 3);
    r.inner = new Array(L).fill(0);
    r.deck = new Array(L).fill(0);
    r.wrap = closed;
    r.baseS = s0;                 // where this window starts on the full route
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
    r.aux = new Array(sampled.length).fill(0);
    r.lanes = new Array(sampled.length).fill(o.fwd != null ? o.fwd : 3);
    r.inner = new Array(sampled.length).fill(0);
    r.deck = new Array(sampled.length).fill(0);
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
      h: a.h + (b.h - a.h) * t,
      i,
    };
  }

  /* a world point at distance s along, offset u across */
  function at(r, s, u) {
    const f = frame(r, s);
    return { x: f.x + Math.cos(f.h) * u, y: f.y - Math.sin(f.h) * u, h: f.h };
  }

  const auxAt = (r, s) => {
    const f = clamp(s / STEP, 0, r.aux.length - 1);
    const i = Math.min(r.aux.length - 2, Math.floor(f));
    if (r.aux.length < 2) return r.aux[0] || 0;
    return r.aux[i] + (r.aux[i + 1] - r.aux[i]) * (f - i);
  };
  const lanesAt = (r, s) => {
    const f = clamp(s / STEP, 0, r.lanes.length - 1);
    const i = Math.min(r.lanes.length - 2, Math.floor(f));
    if (r.lanes.length < 2) return r.lanes[0] || 1;
    return r.lanes[i] + (r.lanes[i + 1] - r.lanes[i]) * (f - i);
  };
  const innerAt = (r, s) => {
    const f = clamp(s / STEP, 0, r.inner.length - 1);
    const i = Math.min(r.inner.length - 2, Math.floor(f));
    if (r.inner.length < 2) return r.inner[0] || 0;
    return r.inner[i] + (r.inner[i + 1] - r.inner[i]) * (f - i);
  };
  /* How high this road is at this point, in decks. Interpolated rather
     than stepped, so a bridge approach is a grade you climb and not a
     cliff you teleport up: everything that asks this question is really
     asking "is that other road at my level", and a road halfway up its
     approach embankment is honestly answered by 0.5. */
  const deckAt = (r, s) => {
    if (!r.deck || r.deck.length < 2) return (r.deck && r.deck[0]) || 0;
    const f = clamp(s / STEP, 0, r.deck.length - 1);
    const i = Math.min(r.deck.length - 2, Math.floor(f));
    return r.deck[i] + (r.deck[i + 1] - r.deck[i]) * (f - i);
  };

  /* The sealed surface, as offsets. Everything outside is shoulder,
     then gravel, then grass, then something that ends your run.

     A ramp's cross-section hangs off its LEFT edge rather than being
     centred, so that lane 0 always sits exactly on the centreline. That
     matters where the terminal flares to two lanes: anchored left, the
     extra lane appears on the right and the merging lane runs dead
     straight through. Anchored centrally, the whole ramp would shuffle
     sideways by half a lane as it widened, and you would feel it. */
  function edges(r, s) {
    if (r.kind === "ramp") {
      return { uL: -LANE / 2, uR: (r.rampLanes - 0.5) * LANE };
    }
    const inside = innerAt(r, s);
    return {
      uL: -(r.med + SH_IN + r.back * LANE),
      uR: r.med + SH_IN + inside + lanesAt(r, s) * LANE + auxAt(r, s),
    };
  }

  /* Lane centres. `dirFwd` picks the carriageway; lane 0 is always the
     one nearest the middle of the road, so lane (count−1) is the one
     that exits, on either side. */
  function laneCount(r, s, dirFwd) {
    if (r.kind === "ramp") return r.rampLanes;
    return dirFwd ? Math.max(1, Math.round(lanesAt(r, s))) : r.back;
  }
  function laneU(r, s, lane, dirFwd) {
    if (r.kind === "ramp") return LANE * lane;
    return dirFwd
      ? r.med + SH_IN + innerAt(r, s) + LANE * (lane + 0.5)
      : -(r.med + SH_IN + LANE * (lane + 0.5));
  }
  /* Centre of the first auxiliary lane. More lanes can sit outside it,
     but lane zero must not slide sideways as they open. */
  const auxLaneU = (r, s) => r.med + SH_IN + innerAt(r, s) + lanesAt(r, s) * LANE
    + Math.min(LANE, auxAt(r, s)) / 2;

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
    for (let i = lo; i <= hi; i++) {
      const a = st[i], b = st[i + 1];
      const ex = b.x - a.x, ey = b.y - a.y;
      const L2 = ex * ex + ey * ey;
      let t = L2 > 0 ? ((x - a.x) * ex + (y - a.y) * ey) / L2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const cx = a.x + ex * t, cy = a.y + ey * t;
      const dx = x - cx, dy = y - cy;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; bi = i; bt = t; bx = cx; by = cy; }
    }
    if (bi < 0) return null;
    const a = st[bi], b = st[bi + 1];
    const h = a.h + (b.h - a.h) * bt;
    const u = (x - bx) * Math.cos(h) - (y - by) * Math.sin(h);
    return { i: bi, t: bt, s: (bi + bt) * STEP, u, h, dist: Math.sqrt(bd) };
  }

  /* ── the deceleration lanes ─────────────────────────────────────────
     Paint one to three aux lanes onto the full approach: each added
     lane gets a 92 m taper, then all run full width for 137 m before
     the gore. After the gore they are zero; from there on, those same
     strips of surface belong to the ramp.
     The arrival is deliberately longer still, because a parallel merge
     lane should feel like time to merge rather than a trapdoor. */
  const TAPER = 64;         // 92 m: the extra lane opens to full width
  const DECEL = 96;         // 137 m: full-width lane before the gore
  const EXIT_APPROACH = TAPER + DECEL;
  const MERGE = 150;        // 215 m: parallel acceleration/merge lane
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
  function openAux(r, i, lanes, over) {
    lanes = Math.max(1, Math.min(3, lanes | 0));
    const approach = over > 0 ? Math.round(over) : exitApproach(lanes);
    for (let k = 0; k <= approach; k++) {
      const j = i - approach + k;
      if (j < 0 || j >= r.aux.length) continue;
      const taper = over > 0 ? approach * 0.55 : TAPER;
      let width = 0;
      for (let lane = 0; lane < lanes; lane++) width += LANE * smooth((k - lane * taper) / taper);
      r.aux[j] = Math.max(r.aux[j], width);
    }
  }

  /* The mirror image, for the far end of a ramp: its one to three lanes
     arrive full width and thin away together, forcing traffic to merge
     rather than simply appearing in the destination carriageway. */
  function closeAux(r, i, lanes, over) {
    lanes = Math.max(1, Math.min(3, lanes | 0));
    const length = over > 0 ? Math.round(over) : mergeLength(lanes);
    for (let k = 0; k <= length; k++) {
      const j = i + k;
      if (j < 0 || j >= r.aux.length) continue;
      const t = 1 - k / length;
      r.aux[j] = Math.max(r.aux[j], lanes * LANE * smooth(t));
    }
  }

  /* A left exit takes the existing inside lanes. The continuing road's
     remaining lane centres stay exactly where they were; its inside
     shoulder simply becomes wider by the width of the lanes that left. */
  function dropLeft(r, i, count) {
    const from = Math.round(lanesAt(r, i * STEP));
    count = Math.max(1, Math.min(count | 0, from - 2));
    const width = count * LANE;
    for (let j = i; j < r.lanes.length; j++) {
      r.inner[j] += width;
      r.lanes[j] = Math.max(2, r.lanes[j] - count);
    }
    r.fwd = Math.max(2, r.fwd - count);
    return count;
  }

  /* Add or remove one outside through lane over a long taper. `lanes`
     stores a continuous lane-width count, so the asphalt edge and its
     paint move a fraction of a pixel per station rather than jumping a
     whole 12-foot lane at once. */
  const LANE_CHANGE = 120;                    // 172 m at 8 px/station
  function changeLanes(r, atS, to) {
    if (r.kind !== "freeway") return null;
    const i0 = Math.max(0, Math.round(atS / STEP));
    const from = lanesAt(r, i0 * STEP);
    to = clamp(Math.round(to), 2, 4);
    if (Math.abs(from - to) < 0.25) return null;
    grow(r, (i0 + LANE_CHANGE + 2) * STEP);
    for (let k = 0; k <= LANE_CHANGE; k++) {
      const t = k / LANE_CHANGE;
      r.lanes[i0 + k] = from + (to - from) * smooth(t);
    }
    for (let i = i0 + LANE_CHANGE + 1; i < r.lanes.length; i++) r.lanes[i] = to;
    r.fwd = to;                                // downstream default for future growth
    const change = { s0: i0 * STEP, s1: (i0 + LANE_CHANGE) * STEP, from, to };
    r.laneChanges.push(change);
    return change;
  }

  /* ── ramps ──────────────────────────────────────────────────────────
     A ramp is born tangent to its parent, at the centre of the aux lane
     that has just finished opening. It then turns through `sweep` at a
     radius the player can actually hold, eases back to straight, and
     runs on for a while so it can meet a long, parallel acceleration
     lane on the next freeway. */
  function makeRamp(parent, i, sweep, radius, options) {
    options = options || {};
    let side = options.side < 0 ? -1 : 1;
    let lanes = Math.max(1, Math.min(3, options.lanes | 0 || 1));
    const s = i * STEP;
    const before = Math.round(lanesAt(parent, s - STEP));
    if (side < 0 && before < 3) side = 1;
    if (side < 0) lanes = Math.min(lanes, before - 2);
    if (side > 0) openAux(parent, i, lanes);
    const inside = parent.med + SH_IN + innerAt(parent, s - STEP);
    const u = side > 0
      ? inside + before * LANE + LANE / 2
      : inside + LANE / 2;
    const p = at(parent, s, u);
    const r = make("ramp", p.x, p.y, p.h, { fwd: lanes, back: 0, lanes });
    r.parent = parent;
    r.side = side;
    r.startU = u;
    r.med = 0;
    /* A ramp paints over the road it left — it is drawn second so its
       gore reads cleanly. It does not thereby become a bridge: it leaves
       at grade and stays there unless somebody raises its deck. */
    r.layer = parent.layer + 1;

    if (side < 0) dropLeft(parent, i, lanes);

    sweep = Math.abs(sweep) * side;
    const dir = side;
    const k = dir / radius;                 // target curvature

    /* The transition into the turn is short on purpose.

       A real gore separates at something like one in twenty, which over
       the hundred-odd pixels you can actually see ahead of the car is
       three pixels of divergence — invisible. The exit would arrive as
       a lane that silently stopped being a lane. So the clothoid is
       compressed to about fifty pixels, which pulls the ramp clear of
       the carriageway by a readable amount while it is still on screen.
       This is the one place the road geometry is knowingly exaggerated,
       and it is exaggerated because the alternative is unreadable. */
    const easeIn = 90, easeOut = options.easeOut != null ? options.easeOut : 210;
    /* The clothoids contribute half their length at full curvature.
       Subtract that contribution so `sweep` is the actual total turn,
       rather than an underestimate that changes when easing is tuned. */
    const turnLen = Math.max(0, Math.abs(sweep) * radius - (easeIn + easeOut) / 2);
    /* How much straight to run after the turn. A connector heading off
       to meet a motorway wants a long one. A cloverleaf loop wants
       almost none: it has just turned three-quarters of a circle and is
       now pointing back across the road it left, so every pixel of
       straight drives it further into the carriageway it came from. */
    const TERM = options.term != null ? options.term : 520;
    r.terminalStart = easeIn + turnLen + easeOut;
    const total = easeIn + turnLen + easeOut + TERM;

    let travelled = 0, h = p.h, x = p.x, y = p.y;
    while (travelled < total) {
      const nh = h + curvAt(travelled) * STEP;
      const m = (h + nh) / 2;
      x += Math.sin(m) * STEP; y += Math.cos(m) * STEP; h = nh;
      const q = { x, y, h };
      r.st.push(q);
      note(r, q);
      travelled += STEP;
      r.aux.push(0);
      r.lanes.push(lanes);
      r.inner.push(0);
      r.deck.push(0);
    }
    /* Which stations stop wearing a verge is not decided here. It is
       measured off the finished shapes by World.dress(), because a
       fixed count of stations is only ever right for one sweep and one
       radius, and these are rolled fresh every junction. */
    r.startS = s;
    parent.exits.push({ i, ramp: r, s, side, lanes, startU: u });
    return r;

    function curvAt(d) {
      if (d < easeIn) return k * (d / easeIn);
      if (d < easeIn + turnLen) return k;
      if (d < easeIn + turnLen + easeOut) return k * (1 - (d - easeIn - turnLen) / easeOut);
      return 0;
    }
  }

  /* Join two roads that already exist. Unlike makeRamp(), which creates
     a free-running curve and lets World add a destination beneath its
     far end, this connector has two fixed endpoints and fixed tangents.
     It is used by the prebuilt urban map for C-D bypasses, for ramps
     that close loops between established freeway corridors, and for both
     halves of an ordinary diamond interchange.

     ── the two ways of arriving ────────────────────────────────────────
     A system connector arrives as a LANE-ADD: its lanes become permanent
     outside through lanes on the destination, so a driver who holds a
     straight line after the merge is still on tarmac a mile later. That
     is right for a freeway-to-freeway ramp carrying freeway volumes.

     It is wrong for a local onramp. Adding a permanent lane at every
     diamond means a road that gains a lane every mile, and after twenty
     junctions the freeway is thirty lanes wide. So a local entrance
     arrives on an ACCELERATION LANE instead: the pavement is there, full
     width, for two hundred metres, and then it tapers away and you are
     expected to have merged. Failing to is not instant — the taper hands
     you a shoulder, then gravel, then the verge — but it is a real
     freeway merge, which is the point.

     `options.accel` picks the second. */
  function makeLink(parent, i, target, targetS, options) {
    options = options || {};
    const lanes = Math.max(1, Math.min(2, options.lanes | 0 || 1));
    const s = i * STEP;
    const before = Math.round(lanesAt(parent, s - STEP));
    openAux(parent, i, lanes, options.approach);
    const startU = parent.med + SH_IN + innerAt(parent, s - STEP)
      + before * LANE + LANE / 2;
    const p = at(parent, s, startU);

    targetS = Math.round(targetS / STEP) * STEP;
    const accel = !!options.accel;
    const targetI = Math.round(targetS / STEP);
    const targetCount = laneCount(target, targetS, true);
    const baseLane = Math.max(0, targetCount - lanes);
    if (accel) closeAux(target, targetI, lanes, options.accelLen);
    const targetU = accel ? auxLaneU(target, targetS) : laneU(target, targetS, baseLane, true);
    const q = at(target, targetS, targetU);
    const ramp = make("ramp", p.x, p.y, p.h, { fwd: lanes, back: 0, lanes });
    ramp.parent = parent;
    ramp.side = 1;
    ramp.startU = startU;
    ramp.routeType = options.type || "link";

    const dx = q.x - p.x, dy = q.y - p.y;
    const direct = Math.hypot(dx, dy);
    /* A cubic that turns a quarter circle of radius R wants handles of
       about 0.552 R, and its endpoints are R√2 apart — so the handle is
       0.39 of the straight-line distance. The old 0.30-with-a-2400-ceiling
       was tuned for short C-D roads and, on a two-mile system connector,
       clipped the handles to a tenth of what the turn needed: the curve
       left its tangent almost immediately and cut the corner. */
    /* `options.lead` overrides it where the caller knows something this
       formula cannot: how much room there is to turn IN. A local
       entrance ramp leaves the cross street pointing across the freeway
       and has four hundred pixels of shoulder to get turned round in,
       while the distance to its merge point is four times that. Sizing
       the handle from the distance sends the curve five hundred pixels
       the wrong way first — straight across the carriageway — and it was
       drawing a ramp through the middle of the road you are driving on. */
    const lead = options.lead > 0 ? options.lead : clamp(direct * 0.39, 360, 20000);
    const bulge = options.bulge || 0;
    const c1 = { x: p.x + Math.sin(p.h) * lead, y: p.y + Math.cos(p.h) * lead };
    const c2 = { x: q.x - Math.sin(q.h) * lead, y: q.y - Math.cos(q.h) * lead };

    function pos(t) {
      const u = 1 - t, a = u * u * u, b = 3 * u * u * t;
      const c = 3 * u * t * t, d = t * t * t;
      let x = a * p.x + b * c1.x + c * c2.x + d * q.x;
      let y = a * p.y + b * c1.y + c * c2.y + d * q.y;
      if (bulge) {
        const h = p.h + (q.h - p.h) * smooth(t);
        const off = bulge * Math.sin(Math.PI * t) ** 2;
        x += Math.cos(h) * off;
        y -= Math.sin(h) * off;
      }
      return { x, y };
    }

    let estimate = 0, prev = pos(0);
    for (let k = 1; k <= 40; k++) {
      const v = pos(k / 40);
      estimate += Math.hypot(v.x - prev.x, v.y - prev.y);
      prev = v;
    }
    const count = Math.max(2, Math.ceil(estimate / STEP));
    for (let k = 1; k <= count; k++) {
      const t = k / count;
      const v = pos(t);
      const ahead = pos(Math.min(1, t + 1 / count / 8));
      const h = k === count ? q.h : Math.atan2(ahead.x - v.x, ahead.y - v.y);
      const station = { x: v.x, y: v.y, h };
      ramp.st.push(station);
      note(ramp, station);
      ramp.aux.push(0);
      ramp.lanes.push(lanes);
      ramp.inner.push(0);
      ramp.deck.push(0);
    }
    ramp.merge = { into: target, s: targetS, i: targetI,
      u: targetU, lanes, baseLane, laneAdd: !accel, accel, linked: true };
    parent.exits.push({ i, ramp, s, side: 1, lanes, startU });
    return ramp;
  }

  return {
    STEP, LANE, MED, SH_IN, SH_OUT, VERGE, RAMP_SH,
    TAPER, DECEL, EXIT_APPROACH, MERGE, GORE, LANE_CHANGE, exitApproach, mergeLength,
    suppressed,
    make, makeRoute, makeStreet, grow, growBack, len, nearBounds,
    frame, at, edges, laneU, laneCount, auxAt, auxLaneU, lanesAt, innerAt, deckAt,
    project, makeRamp, makeLink, openAux, closeAux, changeLanes, dropLeft, setRandom,
  };
})();
