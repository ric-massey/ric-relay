/* ══════════════════════════════════════════════════════════════════════
   The network.

   road.js knows how to be one road. This file knows that there is more
   than one, where they meet, which of them still matter, and — the
   question the game actually asks sixty times a second — what is under
   the car.

   ── what an interchange is here ─────────────────────────────────────
   Every few kilometres the freeway you are on grows a deceleration
   lane group, and at the end a ramp usually peels right. Rare left
   lane-drop exits take existing inside lanes instead. The connector is
   selected from urban-system families: broad freeway flyovers, compact
   reversing loops, occasional signalized service diamonds, long C-D
   bypasses, and connectors back into established freeway corridors.

   Every arrival is a lane-add. The connector's lanes become permanent
   outside through lanes on the destination road, so a legal straight
   line cannot turn into grass after the handoff. Through lanes only
   widen between interchanges; a lane is allowed to disappear only when
   a visible lane-drop exit actually carries it onto another road.

   The network is persistent. Every road and every choice remains in the
   run's map; distant pieces simply sleep until their bounds come near
   the player again. Crossings receive stable paint layers, so a road
   never changes its mind about which overpass is on top.

   ── layer and deck ──────────────────────────────────────────────────
   Two different questions, and they were one field for a long time:

     r.layer      who paints over whom. Unique per road, so the order is
                  total and stable. Not a height.
     r.deck[i]    how high off the ground station i is, in bridge decks.
                  Shared by everything at grade, and it VARIES along a
                  road, because every flyover here is at grade at both
                  ends and only a bridge in the middle.

   Conflating them meant a road could not be lifted over one thing
   without claiming to be a bridge everywhere, which cost a reverted
   flyover, a clearance invariant that silently skipped nearly every
   pair it was meant to check, and a surface rescue that had to be given
   no height test at all. Anything asking "can I drive from here to
   there" wants deck. Anything asking "what colour is this pixel" wants
   layer.

   ── which road are you on ───────────────────────────────────────────
   Nothing tracks the player's road. There is no "you are now on the
   ramp" state to get wrong, no transfer to miss, no rails. The car has
   a position in the world and `surface()` asks every live road what it
   thinks of that position; the best answer wins. Drive onto the ramp
   and you are on the ramp because the ramp says you are, and for no
   other reason. That is what makes the exit free.

   The ranking, best to worst:

       lane      sealed, between the markings
       shoulder  sealed, but you are not supposed to be there
       gravel    not sealed; it drags, and it is loud
       grass     off the road entirely — this ends the run
       barrier   the middle of the freeway — this ends it faster

   Barrier beats everything, because the whole point of putting a
   barrier down the middle is that it is not a surface, it is a wall.
   ══════════════════════════════════════════════════════════════════════ */

const World = (() => {
  "use strict";

  const R = Road;
  const MAP_SEED = 0x4f465246;             // "OFRF" — the same map on every load
  let random = Math.random;
  const rnd = (a, b) => a + random() * (b - a);

  /* ── the units this map is planned in ───────────────────────────────
     One world pixel is 0.179 m, so a mile is 8,990 px and everything
     below that talks about spacing is a multiple of it. Stating it once
     here is the difference between "exits every 9000" — which means
     nothing — and "exits every mile", which is a thing you can check
     against a real map. */
  const MILE = 1609.34 / 0.179;            // 8,990 world px
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const K = 1000;                          // the unit the city plan is drawn in

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* A 1/3400 px maximum curvature is a radius of roughly 609 m at this
     world's 0.179 m/px scale: a broad high-speed freeway sweep, not a
     racetrack bend. road.js holds each target for 160–465 real metres
     and frequently chooses a tangent, so curvature arrives in long,
     map-like stretches. */
  const FREEWAY_CURVE = 1 / 3400;

  const W = {
    roads: [],
    main: null,          // the freeway the player most recently committed to
    junctions: [],       // every interchange in the fixed map
    exitNo: 1,
    nextLayer: 0,        // stable paint order for persistent crossings
    taken: 0,            // how many ramps the player has actually driven
    root: null,
    rootStart: 900,
    cities: [],          // fictional metro anchors used by the overview map
    mapStats: null,
    grid: new Map(),     // spatial index: cell → [{ r, i }]
    trunks: [],          // the numbered corridors, rings included; no ramps
    metered: [],         // the few roads carrying a traffic signal
    longOverlaps: [],    // crossings too shallow to bridge — see flyover()
  };

  /* ── the spatial index ──────────────────────────────────────────────
     Two things ask "which roads are near this point" sixty times a
     second: the renderer, and the surface test. Both used to answer it
     by walking every road in the world and projecting onto it. At forty-
     five roads that was merely wasteful. At two thousand — which is what
     an exit every mile costs — it is the whole frame budget.

     So every road is bucketed by the cells its centreline passes
     through, and each bucket entry remembers a station index inside that
     cell. That second half matters more than the first: it means a road
     you have never seen before arrives with a projection hint that is
     already correct, so `project` can use its narrow window instead of
     scanning seventy thousand stations to find you.

     A road re-entering a cell — which every beltway does — gets a second
     entry rather than being deduplicated away, because otherwise the far
     side of a ring would inherit the near side's hint and project onto
     completely the wrong part of itself.

     The cell is 1024 px, which bounds how stale a seed can be: any
     station in a cell is within about 1,450 px of any other point in it,
     so SEED_SPAN of 200 stations always brackets the truth. That number
     is the contract between this index and `locate` below; changing one
     without the other silently starts losing roads. */
  const CELL = 1024;                       // world px per cell
  const cellKey = (cx, cy) => (cx + 2048) * 8192 + (cy + 2048);

  function index(r) {
    const st = r.st;
    const seen = new Map();
    let last = -1;
    for (let i = 0; i < st.length; i++) {
      const k = cellKey(Math.floor(st[i].x / CELL), Math.floor(st[i].y / CELL));
      if (k === last) continue;
      last = k;
      const prev = seen.get(k);
      if (prev != null && i - prev < 400) continue;
      seen.set(k, i);
      let b = W.grid.get(k);
      if (!b) W.grid.set(k, b = []);
      b.push({ r, i });
    }
  }

  const SEED_SPAN = 200;

  /* ── where on this road am I ────────────────────────────────────────
     Given a road, a point, a seed station from the index and possibly a
     remembered one, return the projection — and this is fussier than it
     looks, because a remembered station is not necessarily anywhere near
     the truth.

     `r.hint` is written only for the road the car is currently on, and
     is never cleared. Drive a loop ramp to its end and that ramp keeps
     hint = 445 for the rest of the run. Come back past the same
     interchange twenty minutes later and every projection onto that ramp
     searches the far end of it, reports a distance of 811 px, and the
     renderer concludes the ramp is not on screen — so the exit you are
     about to take is simply not drawn, and the deceleration lane ends in
     grass. That was a real bug and this is the fix for it.

     The index seed cannot go stale that way: it is derived from the cell
     the point is actually in. So the seed is authoritative and the
     remembered station is only ever allowed to improve on it. */
  function locate(r, x, y, seed, hint) {
    const a = R.project(r, x, y, seed, SEED_SPAN);
    if (hint == null || hint === seed) return a;
    const b = R.project(r, x, y, hint);
    if (!a) return b;
    if (!b) return a;
    return b.dist < a.dist ? b : a;
  }

  /* Roads whose centreline passes within `pad` of (x, y), mapped to the
     station index to start projecting from. */
  const seedDist = new Map();
  function nearby(x, y, pad, out) {
    out = out || new Map();
    out.clear();
    const best = seedDist;
    best.clear();
    const c0x = Math.floor((x - pad) / CELL), c1x = Math.floor((x + pad) / CELL);
    const c0y = Math.floor((y - pad) / CELL), c1y = Math.floor((y + pad) / CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const b = W.grid.get(cellKey(cx, cy));
        if (!b) continue;
        for (let n = 0; n < b.length; n++) {
          const e = b[n];
          if (e.r.dead) continue;
          /* Keep the CLOSEST seed, not the first one found. A road that
             doubles back through the same neighbourhood — every beltway,
             and every cloverleaf loop, which is a circle 1,400 px across
             inside a 1,024 px grid — has several entries here, and the
             first one in cell order is regularly the far side of the
             curve. Taking it hands `locate` a seed 900 px out, the
             projection window never reaches the near side, and the ramp
             you are about to drive onto is reported as off screen. */
          const p = e.r.st[e.i];
          const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
          const had = best.get(e.r);
          if (had === undefined || d < had) { best.set(e.r, d); out.set(e.r, e.i); }
        }
      }
    }
    return out;
  }

  /* ── setup ──────────────────────────────────────────────────────────
     The player starts a long way into a road that already exists behind
     them. The first call also builds and freezes the entire map; later
     restarts reuse it without changing a station. */
  /* Where a run begins. Knoxville, because it is the stretch this was
     built against and the one with a known-good answer to hand: exit
     374 is Watt Road, 383 is Papermill. Mile 2050 puts you a few miles
     west of Watt with the city ahead of you. */
  const START_MI = 2050;

  /* Where a run begins, in corridor px. Set from the sign before the
     first frame; falls back to Knoxville. */
  let startPx = START_MI * MILE;
  function setStart(px) {
    startPx = clamp(+px || 0, 2 * MILE, I40.lengthPx - 2 * MILE);
  }

  function reset() {
    W.taken = 0;
    W.junctions.length = 0;
    W.metered.length = 0;
    const road = buildWindow(startPx);
    W.root = W.main = road;
    W.rootStart = startPx - road.baseS;
    for (const r of W.roads) r.hint = undefined;
    stats();
    return { road, s: W.rootStart, u: R.laneU(road, W.rootStart, 1, true) };
  }

  /* ══════════════════════════════════════════════════════════════════
     ONE ROAD

     What was here — twenty invented metros, sixteen invented corridors,
     a perimeter ring, beltways, and crossings found by spatial hash —
     built a NETWORK, and a network is a thing you navigate. This game
     does not navigate. It drives. So the map is now a single surveyed
     corridor and everything hangs off a distance along it.

     ── the window ────────────────────────────────────────────────────
     I-40 is 2,551 miles, which at one station every eight world pixels
     is 2.87 million stations and 392 MB of live objects. That is not
     going on a phone. But the renderer never asks for more than about
     165 stations at once, so only a stretch of the road is ever built:
     twenty miles of it, 22,500 stations, 25 MB, in 20 ms.

     This does not make the map procedural, and the distinction matters.
     Every exit, every lane count and every mile marker for the whole
     2,551 miles is known before you start — that is what `I40` is. Only
     the dense geometry is late, and it is late by twenty miles.

     `baseS` on the live road records where the window begins, so
     distance stays in CORRIDOR coordinates: mile 2062 is Papermill
     whichever window happens to be loaded.
     ══════════════════════════════════════════════════════════════════ */

  const WINDOW = 20 * MILE;          // how much road is live at once
  const MARGIN = 6 * MILE;           // rebuild before you get this close to an edge

  /* Lane counts come off the real road: `I40.lanes` is a list of
     [px, count] runs in the direction of travel. They are stepped in the
     source — a way either has four lanes or five — and stepping the
     asphalt edge by a whole 12-foot lane between two stations looks like
     a fault in the road, so each change is eased over the same distance
     road.js uses for a deliberate lane change. */
  function applyLanes(road) {
    const runs = I40.lanes;
    if (!runs || !runs.length) return;
    const TAPER = R.LANE_CHANGE;                  // stations
    const n = road.st.length;
    const at = (px) => {
      let lo = 0, hi = runs.length - 1, best = runs[0][1];
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        if (runs[m][0] <= px) { best = runs[m][1]; lo = m + 1; } else hi = m - 1;
      }
      return best;
    };
    for (let i = 0; i < n; i++) {
      const px = road.baseS + i * R.STEP;
      let v = at(px);
      // ease across a change by averaging the raw value over the taper
      let sum = 0, cnt = 0;
      for (let k = -TAPER; k <= TAPER; k += 8) {
        sum += at(px + k * R.STEP / 8); cnt++;
      }
      road.lanes[i] = clamp(sum / cnt, 2, 6);
    }
    road.fwd = Math.round(road.lanes[(n / 2) | 0]);
    road.back = road.fwd;
  }

  /* Exits that fall inside the live window, as the road's own list.
     Their `s` is window-local so everything downstream works unchanged,
     but `mi` and `ref` stay in corridor terms because that is what the
     signs say and what the player is really navigating by. */
  function applyExits(road) {
    const lo = road.baseS, hi = road.baseS + R.len(road);
    road.corridorExits = [];
    for (const e of I40.exits) {
      if (e.px < lo || e.px > hi) continue;
      road.corridorExits.push({ ref: e.ref, mi: e.mi, px: e.px, s: e.px - lo });
    }
  }

  /* ── mile markers ───────────────────────────────────────────────────
     Every post on the corridor, without a single one being stored.

     On an Interstate the exit number is the mile marker, so within a
     state `number − miles along` is a constant. `I40.states` carries
     that constant for each of the eight, and the marker at any point is
     just the corridor distance plus it. Two useful consequences: the
     markers agree with the exit numbers by construction rather than
     being a second opinion that can drift out of step, and the numbering
     resets at each border the way the real ones do — you leave Tennessee
     at 451 and enter North Carolina at 1. */
  function marker(px) {
    const st = I40.states;
    if (!st || !st.length) return null;
    let s = st[0];
    for (const q of st) if (px >= q.startPx - 4 * MILE) s = q;
    return { state: s.name, mile: px / MILE + s.residual };
  }

  /* ══════════════════════════════════════════════════════════════════
     REST AREAS AND TRUCK STOPS

     The simplest thing on an Interstate you can drive into and out of
     without ever turning: leave right, run beside the road past the
     parking, rejoin. Two hundred and thirty-four of them on I-40, with
     their real names on, and they are the first structure built because
     they are one shape repeated — if the leave-and-return loop works
     here it works for every ramp that follows.

     The centreline is sampled along the MAINLINE'S OWN FRAME, offset
     sideways by a bump that opens and closes. That is not a shortcut, it
     is the property that makes it correct: at both ends the offset is
     zero and its rate of change is zero, so the stop road leaves and
     rejoins exactly tangent to the road it came off, with no join to
     fudge. The bump plateaus in the middle, which is the bit you park
     on.

     What is surveyed is where it is, which side it serves and what it is
     called. The shape is not — OSM maps these as parking-lot outlines,
     which is not a drivable centreline. */
  const STOP_LEN = 0.62 * MILE;     // 1 km: decel, the frontage, accel
  const STOP_OFF = 74;              // px clear of the verge — 13 m
  const STOP_TAPER = 0.28;          // fraction of the length spent turning

  function stopBump(t) {
    if (t <= 0 || t >= 1) return 0;
    if (t < STOP_TAPER) return smooth(t / STOP_TAPER);
    if (t > 1 - STOP_TAPER) return smooth((1 - t) / STOP_TAPER);
    return 1;
  }

  /* ── an exit ────────────────────────────────────────────────────────
     Structurally identical to a truck stop, and that is the design
     rather than a shortcut. Every ramp on this corridor puts you back on
     the corridor — that is the rule the whole game is built on — so an
     exit IS a loop-back: leave right, run past whatever is out there,
     rejoin. What separates the two is length, how far out they swing,
     and what the sign says.

     A real interchange has a cross road at the far end with its own
     traffic on it. That is the next thing, and it hangs off this: the
     frontage road built here is where a cross street would attach. */
  const EXIT_LEN = 1.05 * MILE;
  const EXIT_OFF = 132;             // px clear of the verge — 24 m

  /* ── a real ramp ────────────────────────────────────────────────────
     Where the survey gives us the actual interchange, we drive the
     actual interchange. `I40.ramps` holds the walked geometry in the
     corridor's own plane, anchored at the node it leaves from, so both
     ends already sit on the road — nothing has to be stitched.

     This is the difference between an exit that looks like an exit and
     1,201 copies of the same bump. Exit 386 in Knoxville is not exit 407
     in the Smokies, and now it is not drawn as though it were. */
  function buildRealRamp(parent, spec) {
    const lo = parent.baseS, hi = lo + R.len(parent);
    if (spec.startPx < lo + 400 || spec.endPx > hi - 400) return null;
    const pts = spec.pts.map((p) => ({ x: p[0], y: p[1] }));
    if (pts.length < 3) return null;



    const road = R.makeRoute(pts, {
      polyline: true, kind: "ramp", fwd: 1, back: 0, lanes: 1,
      layer: ++W.nextLayer,
    });
    /* ── pin the ends to the deceleration lane ─────────────────────────
       Two corrections, and they have to happen AFTER the road is built,
       not before: makeRoute resamples and smooths, and the smoothing has
       no road beyond a ramp's ends to average against, so it pulls them
       inward. Warping the input and then letting it be smoothed put the
       ends back out by up to 64 px.

       The first correction is the big one. OSM splits a ramp off the
       CENTRELINE of the eastbound carriageway, and this game builds both
       carriageways from ONE centreline — so that same point is the
       middle of the road here, beside the barrier. Dropped in as
       surveyed, every real ramp began in the median and crossed four
       lanes to get out. The second is a couple of metres between the
       corridor as surveyed and as smoothed.

       Both are fixed by warping the built stations so each end lands on
       the centre of the aux lane, blending along the length so the
       middle keeps its surveyed shape. */
    {
      const sA = spec.startPx - lo, sB = spec.endPx - lo;
      const wantA = R.at(parent, sA, R.auxLaneU(parent, sA));
      const wantB = R.at(parent, sB, R.auxLaneU(parent, sB));
      const st = road.st, n = st.length - 1;
      const dxA = wantA.x - st[0].x, dyA = wantA.y - st[0].y;
      const dxB = wantB.x - st[n].x, dyB = wantB.y - st[n].y;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        st[i].x += dxA + (dxB - dxA) * t;
        st[i].y += dyA + (dyB - dyA) * t;
      }
      for (let i = 0; i <= n; i++) {
        const a = st[Math.max(0, i - 1)], b = st[Math.min(n, i + 1)];
        st[i].h = Math.atan2(b.x - a.x, b.y - a.y);
      }
      R.rebound ? R.rebound(road) : null;
    }
    road.kind = "ramp"; road.rampLanes = 1; road.med = 0; road.back = 0;
    road.parent = parent;
    road.routeType = "exit";
    road.real = true;
    road.exitRef = spec.ref || null;
    road.signTo = spec.to || null;
    road.signVia = spec.via || null;
    road.corridorPx = (spec.startPx + spec.endPx) / 2;
    road.baseS = 0;
    road.mirror = false;

    const s0 = spec.startPx - lo, s1 = spec.endPx - lo;
    const iOut = Math.round(s0 / R.STEP), iIn = Math.round(s1 / R.STEP);
    R.openAux(parent, iOut, 1, 150);
    R.closeAux(parent, Math.max(0, iIn - 26), 1, 150);

    road.merge = { into: parent, s: s1, i: iIn, u: R.auxLaneU(parent, s1),
                   lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: false };
    const entry = { i: iOut, ramp: road, s: s0, side: 1, lanes: 1,
                    startU: R.auxLaneU(parent, s0), mirror: false, from: parent };
    parent.exits.push(entry);
    road.junction = entry;

    /* The signal sits where the ramp is furthest from the road, which on
       a real interchange is the terminal — the intersection with the
       cross street the ramp was walked across. */
    const at = R.len(road) * 0.5;
    const phase0 = (spec.startPx / 977) % 11;
    road.meter = { i: Math.round(at / R.STEP), s: at, phase0,
                   t: phase0, red: phase0 < 4.2, wait: 0 };
    W.metered.push(road);
    return road;
  }

  function buildStop(parent, stop) {
    const isExit = stop.kind === "exit";
    const LEN = isExit ? EXIT_LEN : STOP_LEN;
    const OFF = isExit ? EXIT_OFF : STOP_OFF;
    const side = stop.side > 0 ? 1 : -1;
    const s0 = stop.px - parent.baseS - LEN / 2;
    const s1 = s0 + LEN;
    if (s0 < 400 || s1 > R.len(parent) - 400) return null;

    /* Widen the mainline FIRST. The stop's centreline is sampled from
       `R.edges(parent, s)`, and openAux moves that edge out by up to a
       full lane — sample before widening and the frontage road ends up
       sitting on the deceleration lane it is supposed to be fed by. */
    const iOut = Math.round(s0 / R.STEP);
    const iIn = Math.round(s1 / R.STEP);
    R.openAux(parent, iOut, 1, 150);
    R.closeAux(parent, iIn - 26, 1, 150);

    /* ── where the centreline starts, and why it is not "beside" ──────
       The first version put the stop road a fixed distance outside the
       verge and eased it further out. It looked right and it was
       undrivable: by the time you had steered across the shoulder the
       road had already peeled away, so there was thirteen pixels of
       grass between the gravel and the frontage, and steering right at
       a truck stop killed you.

       road.js already says how this is supposed to work, in the note on
       `aux`: a ramp's centreline starts exactly at the middle of the
       deceleration lane, so the two surfaces are contiguous because
       they were built from the same number. So that is where this
       starts too — ON the aux lane — and the bump carries it out from
       there and back. At both ends the offset is zero, which puts it
       back in the merge lane. Nothing is stitched. */
    const n = Math.max(8, Math.round(LEN / R.STEP));
    const pts = new Array(n + 1);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const s = s0 + LEN * t;
      const e = R.edges(parent, s);
      const sh = R.SH_OUT + R.VERGE;
      const near = side > 0 ? R.auxLaneU(parent, s) : -R.auxLaneU(parent, s);
      const far = (side > 0 ? e.uR + sh : e.uL - sh) + side * (OFF + R.LANE / 2);
      const b = stopBump(t);
      const u = near + (far - near) * b;
      const p = R.at(parent, s, u);
      pts[k] = { x: p.x, y: p.y };
    }

    /* A stop that serves WESTBOUND traffic is built running westbound.
       The corridor's stations increase eastward, so a left-side stop
       sampled in that order would be a road you drive backwards: its
       own `s` would fall as you advanced along it, and every merge and
       gore test in the game assumes s grows ahead of you. Reversing the
       points costs nothing and means a westbound stop is an ordinary
       forward road that happens to sit on the other side. */
    if (side < 0) pts.reverse();

    const road = R.makeRoute(pts, {
      polyline: true, kind: "ramp", fwd: 1, back: 0, lanes: 1,
      layer: ++W.nextLayer,
    });
    road.kind = "ramp";
    road.rampLanes = 1;
    road.med = 0;
    road.back = 0;
    road.parent = parent;
    road.routeType = isExit ? "exit" : stop.kind === "truck" ? "truckstop" : "rest";
    road.stopName = stop.name;
    road.exitRef = stop.ref || null;
    road.signTo = stop.to || null;
    road.signVia = stop.via || null;
    /* Where this sits on the corridor. Pulling into a truck stop does
       not move you along I-40, so the mile marker has to keep reading —
       it went blank the moment you left the mainline, which is exactly
       when a driver looks at it. */
    road.corridorPx = stop.px;
    road.baseS = 0;

    /* ── which end is the beginning ────────────────────────────────────
       `startU` is not a flag. handovers() does `S.u -= ex.startU` to
       convert the car from corridor coordinates into ramp coordinates,
       so it has to be the real offset at which this road's station zero
       sits on the parent — the centre of the deceleration lane, the same
       number the centreline was sampled from. A ±1 side flag here meant
       the commit test compared the car against an offset of one pixel,
       so nothing was ever committed however you steered.

       And for a westbound ramp station zero is at the OTHER END. The
       points were reversed above so the road runs the way its driver
       does, which means it starts at s1 and finishes at s0, and every
       offset is mirrored because the driver's right is negative u on a
       corridor that runs the other way. `mirror` tells handovers() which
       frame to convert in; without it a westbound car was only ever
       rescued onto the ramp by the surface test rather than handed over,
       which looked like it worked and was not the same thing. */
    const auxOut = R.auxLaneU(parent, s0);
    const auxIn = R.auxLaneU(parent, s1);
    road.mirror = side < 0;
    road.merge = side > 0
      ? { into: parent, s: s1, i: iIn, u: auxIn,
          lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: false }
      : { into: parent, s: s0, i: iOut, u: -auxOut,
          lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: true };
    const entry = {
      i: side > 0 ? iOut : iIn,
      ramp: road,
      s: side > 0 ? s0 : s1,
      side, lanes: 1,
      startU: side > 0 ? auxOut : -auxIn,
      mirror: side < 0,
      from: parent,
    };
    parent.exits.push(entry);

    /* ── the gore ──────────────────────────────────────────────────────
       The hatched wedge and the crash cushion where the ramp parts from
       the road. draw.js has drawn these since the fictional map and only
       draws them for a ramp carrying a `junction`, which nothing on the
       corridor was setting — so every exit here was a lane that quietly
       stopped being a lane, with no nose and no paint to say where the
       split was. Every ramp gets one, so they all read the same. */
    road.junction = entry;

    /* ── the signal ────────────────────────────────────────────────────
       An exit gets a light where its ramp reaches the cross road; a rest
       area and a truck stop do not, because the whole point of those is
       that you drive straight through. traffic.js used to queue against
       these and is gone, so for now the signal is scenery with a stop
       bar — but it is REAL scenery, on the right structures only, and it
       is what the queue will assemble against when traffic returns.

       `phase0` is derived from position rather than random so a given
       exit shows the same light every time you arrive at it. */
    if (isExit) {
      const at = R.len(road) * 0.5;
      const phase0 = ((stop.px / 977) % 11);
      road.meter = { i: Math.round(at / R.STEP), s: at, phase0,
                     t: phase0, red: phase0 < 4.2, wait: 0 };
      W.metered.push(road);
    }
    return road;
  }

  function buildWindow(centrePx) {
    const half = WINDOW / 2;
    let from = centrePx - half, to = centrePx + half;
    if (from < 0) { to -= from; from = 0; }
    if (to > I40.lengthPx) { from -= (to - I40.lengthPx); to = I40.lengthPx; }
    from = Math.max(0, from);
    /* The data ships waypoints as [x, y] pairs — half the size of
       {x, y} objects across 27,126 of them — and makeRoute wants
       objects. Converting here rather than at load keeps the file small
       and costs one pass per slide. */
    if (!W.pts) W.pts = I40.waypoints.map((p) => ({ x: p[0], y: p[1] }));
    const road = R.makeRoute(W.pts, {
      polyline: true, fromPx: from, toPx: to,
      fwd: 3, back: 3, layer: 0, maxCurv: FREEWAY_CURVE,
    });
    road.routeName = I40.name || "I-40";
    road.routeId = I40.id || "I-40";
    road.corridor = true;
    applyLanes(road);
    applyExits(road);
    W.roads.length = 0; W.grid.clear(); W.trunks.length = 0;
    W.roads.push(road);
    W.trunks.push(road);

    /* Stops inside the live window. They hang off the mainline, so they
       are built after it and before it is indexed — openAux() edits the
       parent's deceleration lanes and the index does not care, but the
       renderer reads them. */
    const lo = road.baseS, hi = road.baseS + R.len(road);
    for (const st of (I40.stops || [])) {
      if (st.px < lo || st.px > hi) continue;
      const r = buildStop(road, st);
      if (r) { W.roads.push(r); index(r); }
    }
    /* Every real exit in the window, both directions. Two ramps per exit
       number — one serving each carriageway — because that is what an
       Interstate has and because the sign has to be on your own side. */
    /* Real interchanges first. Where the survey has the shape, use it;
       the generated loop-back is only for exits the walk could not
       close, and for the westbound side, whose ramps rejoin a
       carriageway this corridor does not carry. */
    const realAt = [];
    for (const spec of (I40.ramps || [])) {
      if (spec.endPx < lo || spec.startPx > hi) continue;
      const r = buildRealRamp(road, spec);
      if (r) { W.roads.push(r); index(r); realAt.push(spec.startPx); }
    }
    const hasReal = (px) => realAt.some((q) => Math.abs(q - px) < 0.55 * MILE);

    let last = -1e9;
    for (const e of I40.exits) {
      if (e.px < lo || e.px > hi) continue;
      if (e.px - last < 0.34 * MILE) continue;   // A/B pairs share one structure
      last = e.px;
      for (const side of [1, -1]) {
        if (side > 0 && hasReal(e.px)) continue;   // the real one is already there
        const r = buildStop(road, { kind: "exit", px: e.px, side,
                                    name: (e.to && e.to[0]) || null,
                                    ref: e.ref, to: e.to, via: e.via });
        if (r) { W.roads.push(r); index(r); }
      }
    }
    index(road);
    return road;
  }

  /* Slide the window when the car nears an edge. Returns the new
     window-local `s` so the caller can re-base the car, or null if
     nothing moved. Corridor position is the invariant across a rebuild:
     you were at mile 2062 before and you are at mile 2062 after. */
  function slide(road, s) {
    if (!road || !road.corridor) return null;
    const corridorPx = road.baseS + s;
    const nearStart = road.baseS > 0 && s < MARGIN;
    const nearEnd = road.baseS + R.len(road) < I40.lengthPx && R.len(road) - s < MARGIN;
    if (!nearStart && !nearEnd) return null;
    const next = buildWindow(corridorPx);
    W.main = next;
    return { road: next, s: corridorPx - next.baseS };
  }


  function stats() {
    const miles = I40.lengthPx / MILE;
    W.mapStats = {
      route: I40.id || "I-40",
      corridorMiles: +miles.toFixed(0),
      exits: I40.exits.length,
      waypoints: I40.waypoints.length,
      windowMiles: +(WINDOW / MILE).toFixed(0),
      liveStations: W.roads[0] ? W.roads[0].st.length : 0,
      stops: (I40.stops || []).length,
      exitsPerMile: +(I40.exits.length / Math.max(1, miles)).toFixed(2),
    };
  }

  /* NOT CALLED any more, and deliberately kept. It froze the fictional
     map so accidental generation would fail loudly; the corridor window
     is rebuilt on purpose as the car moves, so freezing it would break
     the thing that replaced it. Left here because the moment ramps are
     attached to the corridor there will again be geometry that must not
     change after build, and this is how that was enforced.

     Make accidental future generation fail immediately rather than
     silently change the map. Runtime state — signal phases, projection
     hints, `used` flags — stays mutable; geometry does not. */
  function freeze() {
    for (const r of W.roads) {
      Object.freeze(r.st); Object.freeze(r.aux); Object.freeze(r.lanes);
      Object.freeze(r.inner); Object.freeze(r.deck);
      Object.freeze(r.exits); Object.freeze(r.laneChanges);
      Object.freeze(r.noL); Object.freeze(r.noR);
    }
    Object.freeze(W.roads);
    Object.freeze(W.junctions);
  }

  /* ── dressing ───────────────────────────────────────────────────────
     A road wears a gravel verge and a steel barrier down each side. Where
     another road is standing in that space, it must not — otherwise the
     freeway paints its shoulder over the ramp beside it, which is the
     brown band that wanders across the tarmac and then stops making
     sense.

     Rather than hard-coding "suppress twenty-six stations after a gore",
     this walks the stations in a window, samples the middle of each verge
     band, asks the other road whether that point is on its surface, and
     marks the ones that are. Generated from the shapes actually built,
     so it stays right when the shapes change. */
  function dress(a, b, i0, i1, seed) {
    const shL = a.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const shR = a.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const bSh = b.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const hitL = [], hitR = [];
    let hL = seed != null ? seed : null, hR = hL;
    i0 = Math.max(0, i0); i1 = Math.min(a.st.length - 1, i1);
    for (let i = i0; i <= i1; i++) {
      const s = i * R.STEP;
      const e = R.edges(a, s);
      const probe = (u, hint, out) => {
        const q = R.at(a, s, u);
        /* ±20 stations, not the default ±72. This walk moves one station
           at a time so the hint is never stale, and dress() is called
           eight times per interchange across a thousand of them — the
           window is the whole cost of building the map. */
        const pr = R.project(b, q.x, q.y, hint, hint == null ? 0 : 20);
        if (!pr) return hint;
        if (pr.s > 0 && pr.s < R.len(b)) {
          const eb = R.edges(b, pr.s);
          if (pr.u > eb.uL - bSh - 3 && pr.u < eb.uR + bSh + 3) out.push(i);
        }
        return pr.i;
      };
      /* Probe ACROSS the verge, not just down the middle of it. One
         sample at the centre line of the gravel band means a ramp that
         overlaps the band's inner or outer third is never detected, the
         verge is not suppressed, and the freeway paints a strip of brown
         straight over the ramp beside it. Three samples cover the band. */
      hL = probe(e.uL - shL - R.VERGE, hL, hitL);
      hL = probe(e.uL - shL - R.VERGE / 2, hL, hitL);
      hL = probe(e.uL - shL - 1, hL, hitL);
      hR = probe(e.uR + shR + 1, hR, hitR);
      hR = probe(e.uR + shR + R.VERGE / 2, hR, hitR);
      hR = probe(e.uR + shR + R.VERGE, hR, hitR);
    }
    addRanges(a.noL, hitL);
    addRanges(a.noR, hitR);
  }

  /* ── height ─────────────────────────────────────────────────────────
     `layer` says who paints over whom. `deck` says who is physically
     above whom, and until this pair was separated they were the same
     number — which meant a road could not be lifted over one thing
     without being declared a bridge along its whole length, including
     the quarter mile where it merges into a road at grade. That is why
     the cloverleaf flyover was reverted and why the surface rescue in
     offramp.js had to be given no height test at all.

     A deck profile is measured, not declared: walk the stations, ask the
     other road whether this point is standing on its sealed surface, and
     lift exactly those. Same method as dress(), and for the same reason
     — the shapes are rolled fresh at every junction and a fixed count of
     stations is only ever right for one of them. */

  /* Where a's centreline is over b's sealed surface, as station ranges.

     `seed` null means scan the whole of b for every station, which is
     what two SHORT roads crossing each other need. A carried hint tracks
     fine along two roads running roughly parallel — that is the case
     dress() has — and fails on a crossing near ninety degrees, because
     the projection onto b jumps further than the window in a single
     station of a, the hint sticks at the clamp, and the overlap is
     silently reported as empty. That is exactly what happened to the
     cloverleaf leaf: 39 of 40 sampled interchanges have their entrance
     ramp crossing their loop, and the windowed version found none. */
  function overlapRanges(a, b, i0, i1, seed) {
    const bSh = b.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const hit = [];
    let hint = seed;
    i0 = Math.max(0, i0); i1 = Math.min(a.st.length - 1, i1);
    for (let i = i0; i <= i1; i++) {
      const p = a.st[i];
      const pr = R.project(b, p.x, p.y, hint, hint == null ? 0 : 20);
      if (!pr) continue;
      if (seed != null) hint = pr.i;
      if (pr.s <= 0 || pr.s >= R.len(b)) continue;
      const eb = R.edges(b, pr.s);
      if (pr.u > eb.uL - bSh && pr.u < eb.uR + bSh) hit.push(i);
    }
    const out = [];
    addRanges(out, hit);
    return out;
  }

  /* Lift a station range to `level`, with an approach grade at each end.
     GRADE is 60 stations — 86 m, about a 6% climb to a standard 5 m
     clearance, which is steep for an Interstate and short enough that a
     road is unambiguously at one level or the other for most of its
     length. That second property is the one the consumers care about:
     everything asking about deck is really asking "are we on the same
     level as each other", and a long shallow approach makes half the
     map answer "sort of". */
  const GRADE = 60;
  function raise(r, ranges, level, grade) {
    const g0 = grade > 0 ? grade : GRADE;
    for (const g of ranges) {
      const a = Math.max(0, g.a), b = Math.min(r.deck.length - 1, g.b);
      for (let i = a; i <= b; i++) r.deck[i] = Math.max(r.deck[i], level);
      for (let k = 1; k <= g0; k++) {
        const t = smooth(1 - k / g0) * level;
        const lo = a - k, hi = b + k;
        if (lo >= 0) r.deck[lo] = Math.max(r.deck[lo], t);
        if (hi < r.deck.length) r.deck[hi] = Math.max(r.deck[hi], t);
      }
    }
  }

  /* Raise whichever of two crossing roads already paints on top, so the
     picture and the physics cannot disagree about which one is the
     bridge. Returns the road that was lifted.

     The EXTENT is walked outward from the crossing rather than assumed,
     and that is not fussiness. Two corridors meeting at right angles
     share tarmac for about two hundred pixels, so a fixed lift looks
     right — and then I-81 and I-79 meet at a shallow angle and stay
     inside each other's shoulders for THREE AND A QUARTER MILES. A
     ±26-station bridge over that leaves 600 sampled points of two
     Interstates occupying the same asphalt. The angle two roads happen
     to cross at is not something this function gets to assume. */
  const FLY_SPAN = 1080;        // 1.2 miles of stations; a real limit, see below
  function flyoverSpan(top, bot, i, j) {
    const sh = bot.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const on = (k, hint) => {
      const p = top.st[k];
      if (!p) return { hit: false, hint };
      const pr = R.project(bot, p.x, p.y, hint, 20);
      if (!pr || pr.s <= 0 || pr.s >= R.len(bot)) return { hit: false, hint };
      const e = R.edges(bot, pr.s);
      return { hit: pr.u > e.uL - sh && pr.u < e.uR + sh, hint: pr.i };
    };
    /* Tolerate a short gap before calling it the end: at a shallow angle
       the two centrelines weave in and out of each other's shoulders
       several times before finally parting. */
    const GAP = 40;
    let a = i, b = i, hint = j, miss = 0;
    for (let k = i; k >= Math.max(0, i - FLY_SPAN) && miss < GAP; k--) {
      const r = on(k, hint); hint = r.hint;
      if (r.hit) { a = k; miss = 0; } else miss++;
    }
    hint = j; miss = 0;
    for (let k = i; k <= Math.min(top.st.length - 1, i + FLY_SPAN) && miss < GAP; k++) {
      const r = on(k, hint); hint = r.hint;
      if (r.hit) { b = k; miss = 0; } else miss++;
    }
    return { a, b, capped: b - a >= FLY_SPAN * 1.9 };
  }

  function flyover(A, sA, B, sB) {
    const top = A.layer > B.layer ? A : B;
    const bot = top === A ? B : A;
    const i = Math.round((top === A ? sA : sB) / R.STEP);
    const j = Math.round((top === A ? sB : sA) / R.STEP);
    const g = flyoverSpan(top, bot, i, j);
    /* A capped span means these two never actually parted, so this is
       not a crossing and a bridge is the wrong answer to it — building
       one would put a two-mile viaduct over a forty-mile problem and
       make the map look as though somebody meant it. Two corridors
       sharing a route for tens of miles is a fault in the PLAN, not in
       the geometry, and it is recorded here so it is visible as one. */
    if (g.capped) { W.longOverlaps.push({ top: top.routeId, bot: bot.routeId, i }); return null; }
    raise(top, [g], 1);
    return top;
  }

  function addRanges(list, idx) {
    if (!idx.length) return;
    let a = idx[0], prev = idx[0];
    for (let k = 1; k < idx.length; k++) {
      if (idx[k] - prev > 3) { list.push({ a: a - 1, b: prev + 1 }); a = idx[k]; }
      prev = idx[k];
    }
    list.push({ a: a - 1, b: prev + 1 });
  }

  /* ── the invariant ──────────────────────────────────────────────────
     No two roads may have overlapping sealed surfaces anywhere except
     where they are deliberately joined. Returns the tightest clearance
     found, in world px; negative means two roads are sharing tarmac and
     the world is broken. Exposed so it can be asserted from outside
     rather than eyeballed in a screenshot. */
  function clearance(skipJoins) {
    let worst = Infinity, where = null;
    const half = (r, s, right) => {
      const e = R.edges(r, s);
      const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
      return right ? e.uR + sh : -(e.uL - sh);
    };
    for (let m = 0; m < W.roads.length; m++) {
      for (let n = m + 1; n < W.roads.length; n++) {
        const A = W.roads[m], B = W.roads[n];
        const joined = A.merge && A.merge.into === B || B.merge && B.merge.into === A
                    || A.parent === B || B.parent === A;
        for (let s = 0; s < R.len(A); s += 20) {
          const q = R.at(A, s, 0);
          const pr = R.project(B, q.x, q.y, null);
          if (!pr || pr.s <= 0 || pr.s >= R.len(B)) continue;
          /* A real overpass, not an overlap — and this test used to be
             `A.elev !== B.elev`, hoisted out of the loop. Since elev was
             unique per road that was true of very nearly every pair on
             the map, so the invariant skipped almost everything it was
             written to check. Deck is shared by everything at grade, so
             the question is now the one that was meant: are these two
             actually at the same height AT THE POINT THEY MEET. */
          if (Math.abs(R.deckAt(A, s) - R.deckAt(B, pr.s)) > 0.5) continue;
          // skip the few hundred px either side of a legitimate join
          if (joined && nearJoin(A, B, s, pr.s)) continue;
          const gap = Math.abs(pr.u) - (half(A, s, pr.u > 0) + half(B, pr.s, pr.u <= 0));
          if (gap < worst) { worst = gap; where = { A: A.kind + A.id, B: B.kind + B.id, sA: Math.round(s), sB: Math.round(pr.s) }; }
        }
      }
    }
    return { worst: worst === Infinity ? null : +worst.toFixed(1), where };
  }

  function nearJoin(A, B, sA, sB) {
    const P = 340;
    if (A.parent === B) return sA < P;                       // A is a ramp off B
    if (B.parent === A) return sB < P;
    if (A.merge && A.merge.into === B) return R.len(A) - sA < P || Math.abs(sB - A.merge.s) < P;
    if (B.merge && B.merge.into === A) return R.len(B) - sB < P || Math.abs(sA - B.merge.s) < P;
    return false;
  }

  /* ── per-frame upkeep ───────────────────────────────────────────────
     Only signals and route bookkeeping may change here. Map geometry is
     deliberately absent apart from the window slide below, and that
     rebuilds geometry it did not choose: which twenty miles are live
     changes, what is in them does not. */
  function update(px, py, dt, onRoad, onS) {
    for (const r of W.metered) {
      r.meter.t = (r.meter.t + dt) % 11;
      r.meter.red = r.meter.t < 4.2;
    }
    if (onRoad) onRoad.hint = Math.round(onS / R.STEP);
    /* Slide the live stretch of corridor if the car is nearing an edge.
       Returns a re-based position when it moves, because `s` is
       window-local and the window just changed underneath it. */
    return slide(onRoad, onS);
  }

  /* ── the surface question ───────────────────────────────────────────
     Ask every live road what is at this point and keep the best answer.
     Also reports the lateral offset and heading, because everything
     that wants to know "am I on the road" also wants to know "and how
     square am I to it". */
  const RANK = { barrier: 5, lane: 4, shoulder: 3, gravel: 2, grass: 0 };

  function classify(r, u, s) {
    const e = R.edges(r, s);
    if (r.kind === "freeway" && u > -r.med && u < r.med) return "barrier";
    if (r.kind === "freeway") {
      const innerL = -(r.med + R.SH_IN);
      const innerR = r.med + R.SH_IN + R.innerAt(r, s);
      if (u > innerL && u < innerR) return "shoulder";
      if (u >= e.uL && u <= e.uR) return "lane";
    } else if (u >= e.uL && u <= e.uR) return "lane";
    const shL = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const shR = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    if (u < e.uL && u >= e.uL - shL) return "shoulder";
    if (u > e.uR && u <= e.uR + shR) return "shoulder";
    if (u < e.uL && u >= e.uL - shL - R.VERGE) return "gravel";
    if (u > e.uR && u <= e.uR + shR + R.VERGE) return "gravel";
    return "grass";
  }

  /* `deck` is the level the asker is standing on; roads more than half a
     deck away from it are somebody else's problem. Pass null to mean
     "whatever is best here", which is what a fresh query wants. */
  const surfaceNear = new Map();
  function surface(x, y, hints, deck) {
    let best = null, bestRank = -1;
    for (const [r, seed] of nearby(x, y, 320, surfaceNear)) {
      const pr = locate(r, x, y, seed, hints ? hints.get(r.id) : undefined);
      if (!pr) continue;
      if (hints) hints.set(r.id, pr.i);
      // out past the ends of a road is nothing at all
      if (pr.s <= 0 || pr.s >= R.len(r)) continue;
      if (pr.dist > 260) continue;
      const d = R.deckAt(r, pr.s);
      // a deck overhead is scenery; a deck underfoot is not reachable
      if (deck != null && Math.abs(d - deck) > 0.5) continue;
      const what = classify(r, pr.u, pr.s);
      /* Height first, then how good the surface is. This used to be
         `r.elev * 10`, which — elev being unique per road — meant the
         highest-numbered road present always won outright, so a road
         reporting GRASS could beat a road reporting LANE purely for
         having been built later. The only thing keeping that honest was
         the 260 px range cut. Ranking on a real height means roads at
         the same level now compete on what they actually are. */
      const rank = d * 10 + RANK[what];
      if (rank > bestRank) {
        bestRank = rank;
        best = { what, road: r, s: pr.s, u: pr.u, h: pr.h, i: pr.i, deck: d,
                 onRoad: what === "lane" || what === "shoulder" };
      }
    }
    return best || { what: "grass", road: null, s: 0, u: 0, h: 0, i: 0, deck: 0, onRoad: false };
  }

  /* The interchange the car is approaching on the line, for the signs.
     Asked of the road's own exit list rather than of every junction on
     the map, which at two thousand of them is the difference between a
     lookup and a scan. */
  function nextExit(road, s) {
    let best = null;
    for (const e of road.exits) {
      const d = e.s - s;
      if (d < -120 || d > 1600) continue;
      if (!best || d < best.d) best = { j: e.ramp.junction, d };
    }
    return best && best.j ? best : null;
  }

  return {
    state: W,
    reset, update, surface, nextExit, clearance, nearby, locate, MILE,
    buildWindow, marker, setStart,
    corridorPx: (road, s) => (road && road.baseS || 0) + s,
    get roads() { return W.roads; },
    get main() { return W.main; },
    get junctions() { return W.junctions; },
  };
})();
