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

  /* `MAP_SEED`, `seeded()` and `K` went with the fictional map. The
     seeded generator existed so twenty invented metros came out the
     same on every load; the corridor is surveyed, so there is nothing
     left to generate, and the one decision still made by chance —
     whether a two-mile block of median carries cable barrier — is
     hashed from its own position by `hashBlock` instead. That is the
     stronger property: a stretch of road looks the same every time you
     drive it without anything having to remember that it did. */

  /* A 1/3400 px maximum curvature is a radius of roughly 609 m at this
     world's 0.179 m/px scale: a broad high-speed freeway sweep, not a
     racetrack bend. road.js holds each target for 160–465 real metres
     and frequently chooses a tangent, so curvature arrives in long,
     map-like stretches. */
  const FREEWAY_CURVE = 1 / 3400;

  /* ── what is left of the fictional map ──────────────────────────────
     `cities`, `exitNo`, `trunks` and `longOverlaps` lived here to serve
     twenty invented metros, sixteen invented corridors and the
     crossing detection that found where they met. None of that exists
     any more — there is one surveyed corridor and everything hangs off
     a distance along it — and none of the four was read by anything.
     They are gone rather than kept, because a field nobody writes and
     nobody reads is a thing the next reader has to rule out. */
  const W = {
    roads: [],
    main: null,          // the freeway the player most recently committed to
    junctions: [],       // every interchange in the fixed map
    nextLayer: 0,        // stable paint order for persistent crossings
    taken: 0,            // how many ramps the player has actually driven
    root: null,
    rootStart: 900,
    mapStats: null,
    grid: new Map(),     // spatial index: cell → [{ r, i }]
    metered: [],         // the few roads carrying a traffic signal
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

  /* ── how wide a road is, and why one function ───────────────────────
     Half of everything sealed at a station plus the paved shoulder
     outside it: the ENVELOPE, which is what "these two roads are on
     top of each other" has to be measured between.

     Three things ask this and they were not all asking it the same
     way. clearance() compared envelope to envelope, correctly. The two
     places that decide which stations of a ramp have to be a BRIDGE
     asked only whether the ramp's CENTRELINE stood on the road below —
     a band narrower by the ramp's own half-width, about eighteen
     pixels at each edge.

     That difference is the abutment. A flyover was lifted over the
     ground its middle covered and allowed back down to grade while its
     flank was still inside the road underneath, so at every crossing
     there was a short stretch where the deck had not finished rising
     and the invariant could see two roads sharing tarmac. Swept across
     the whole corridor that put five windows in a reported overlap,
     the worst −16.8 px against a −17 px tolerance: the invariant was
     passing by two tenths of a pixel, and only ever asserted on the
     one window the car happened to be in.

     So it is one function now, and the builder and the check cannot
     drift apart again. */
  const halfWidth = (r, s, right) => {
    const e = R.edges(r, s);
    const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    return right ? e.uR + sh : -(e.uL - sh);
  };
  /* The widest that gets, either side — what a road standing beside
     another one can reach across with. */
  const reach = (r, s) => Math.max(halfWidth(r, s, true), halfWidth(r, s, false));

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
    /* Where the run starts, and deliberately NOT which lane. This used
       to hand back a `u` as well, computed with `dirFwd: true` — the
       eastbound carriageway — whichever way the sign had been set to.
       offramp.js overwrote it a line later with the same call against
       the direction actually chosen, so nothing was ever wrong; there
       was simply a westbound car's starting offset, measured on the
       eastbound side, sitting in the return value waiting for somebody
       to trust it. */
    return { road, s: W.rootStart };
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
  /* A stable 0..1 from an integer. Used for decisions that must be the
     same every time the same stretch of corridor is rebuilt — a window
     slides, and anything drawn from Math.random would change under the
     player as they drove back and forth across the same mile. */
  function hashBlock(n) {
    n = (n ^ 0x9e37) ^ (n >>> 15);
    n = Math.imul(n, 0x85ebca6b);
    n = n ^ (n >>> 13);
    n = Math.imul(n, 0xc2b2ae35);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  /* ── how much cable barrier a state actually strings ────────────────
     This was one number — 62% of every two-mile block with a wide
     median, for all 2,551 miles — and a single number cannot describe
     it, because cable barrier is a STATE PROGRAMME and the states do
     not agree. Tennessee and North Carolina were among the earliest and
     biggest adopters and have it down most of their rural mileage.
     California, Arizona and New Mexico have I-40 running through desert
     on very wide, very flat medians carrying very little traffic, and
     put almost nothing in them: the median is the recovery area, which
     is the whole reason it is that wide. At 62% everywhere the Mojave
     had a rail down the middle of it for two hundred miles, which is
     both wrong and — since the thing you can hit in a wide median is
     the rail and nothing else — the wrong hazard in the wrong place.

     These are honest approximations of deployment, not a citation.
     They are per state because that is the unit the decision is made
     in, and the two-mile hashing underneath them is unchanged, so a
     given stretch still looks the same every time you drive it. */
  const RAIL_RATE = { CA: 0.05, AZ: 0.08, NM: 0.08, TX: 0.24,
                      OK: 0.55, AR: 0.55, TN: 0.74, NC: 0.70 };

  /* ── which state a point on the corridor is in ──────────────────────
     Asked in three places — the mile marker, the cable-barrier rate,
     and the start picker — and each of them used to answer it for
     itself, with two different rules.

     `startPx` and `endPx` are the first and last EXIT in a state, not
     the border, so between one state's last exit and the next state's
     first there is a mile or two that belongs to neither. Something
     has to decide which side of that gap a point falls on.

     `marker` and the picker both said `px >= startPx - 4 * MILE`, and
     four miles is far wider than the gap: the last four miles of every
     state were handed to the NEXT one and given its residual. Since a
     residual is `number − miles along` for the state it belongs to,
     using the wrong one produced a NEGATIVE mile marker — 21 miles of
     corridor in six stretches, the worst of them 6.6 mi coming into
     Tennessee, where the HUD read a state you were not in and a mile
     post that does not exist. The picker made the same mistake and
     filed California's exit 153 under Arizona, whose own exits start
     at 1. `railRate` meanwhile used no window at all, so the three
     disagreed with each other about where a state ends.

     The border is not in the survey, so the midpoint of the gap is the
     honest place to put it: each state's numbering runs to the end of
     its own evidence and no further. One rule, one function, and the
     boundaries are computed once. */
  let stateBounds = null;
  function stateAt(px) {
    const st = I40.states;
    if (!st || !st.length) return null;
    if (!stateBounds) {
      stateBounds = [];
      for (let i = 1; i < st.length; i++)
        stateBounds.push((st[i - 1].endPx + st[i].startPx) / 2);
    }
    let i = 0;
    while (i < stateBounds.length && px >= stateBounds[i]) i++;
    return st[i];
  }

  function railRate(px) {
    const s = stateAt(px);
    const r = s ? RAIL_RATE[s.name] : null;
    return r != null ? r : 0.5;
  }

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
    /* ── the raw count, then a boxcar over ±TAPER STATIONS ─────────────
       Two things were wrong with the version this replaces. It sampled
       `at(px + k * R.STEP / 8)`, and since the stride was already 8 the
       divide cancelled the multiply: the smoothing window was ±120
       PIXELS, so a whole twelve-foot lane appeared over 248 px — forty-
       four metres — instead of the 960 the constant asks for. And it
       stepped through that window eight stations at a time, which turns
       a step change into a staircase of 31 jumps rather than a ramp; at
       one lane per change that is a 0.66 px jag in the asphalt edge and
       its paint every sixty-four pixels.

       A prefix sum gives the exact mean over every station in the window
       for the cost of one pass, so neither compromise is needed. */
    const raw = new Float64Array(n);
    for (let i = 0; i < n; i++) raw[i] = at(road.baseS + i * R.STEP);
    const cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + raw[i];
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - TAPER), b = Math.min(n - 1, i + TAPER);
      const v = clamp((cum[b + 1] - cum[a]) / (b - a + 1), 2, 6);
      road.lanes[i] = v;
      /* Both carriageways of a divided highway carry the same count, and
         the survey only gives us the one. Mirroring it per station is
         what `road.back = road.fwd` was reaching for; taken as a single
         scalar off the middle of the window it was the wrong width for
         most of the twenty miles, and every westbound ramp was anchored
         off it. Measured range across one window: 2.00 to 4.00 lanes. */
      road.bLanes[i] = v;

      /* ── the median and the inside shoulder, from the lane count ──────
         Neither is in the survey, and both are strongly determined by the
         thing that is. Lane count is what tells you whether a stretch of
         Interstate is running through a city or across a desert, and the
         cross-section follows from that in the standards:

           2 lanes each way   open country. 60 ft depressed median, no
                              barrier, and a 4 ft inside shoulder — the
                              AASHTO minimum, which is all a two-lane
                              carriageway is asked for.
           3 lanes each way   built-up. The median narrows to about 26 ft
                              and the inside shoulder widens toward 10 ft.
           4+ lanes each way   urban. Concrete barrier, no median left,
                              and a full 10 ft inside shoulder because at
                              this width AASHTO wants somewhere to stop
                              on the left as well as the right.

         `v` is already the SMOOTHED count — a real number, eased over a
         lane change — so both curves come out continuous for free. A
         stepped median would be worse than a constant one: the eye
         forgives a road that is the wrong width and does not forgive one
         that changes width in a single station. */
      road.medW[i] = v <= 2 ? R.MED_RURAL
        : v >= 4 ? R.MED
        : v <= 3 ? R.MED_RURAL + (R.MED_SUBURB - R.MED_RURAL) * (v - 2)
        : R.MED_SUBURB + (R.MED - R.MED_SUBURB) * (v - 3);
      road.shIn[i] = v <= 2 ? R.SH_IN
        : v >= 3 ? R.SH_OUT
        : R.SH_IN + (R.SH_OUT - R.SH_IN) * (v - 2);

      /* ── and whether there is a rail down the middle of it ────────────
         A wide median is not an empty one. Cable barrier exists because
         a car that crosses a grass median arrives in oncoming traffic
         head-on, and it is strung down medians up to roughly seventy
         feet — so a great deal of rural Tennessee has a rail in the
         grass and a great deal of the desert does not.

         Decided per two-mile block rather than per station, because
         that is how it is installed: in runs, with ends. Hashing the
         block index keeps a given stretch of road the same on every
         pass, so it does not flicker in and out as the window slides. */
      const block = Math.floor((road.baseS + i * R.STEP) / (2 * MILE));
      road.medRail[i] = road.medW[i] > R.MED_BARRIER
        && hashBlock(block) < railRate(road.baseS + i * R.STEP) ? 1 : 0;
    }
    road.fwd = Math.round(road.lanes[(n / 2) | 0]);
    road.back = road.fwd;
  }

  /* ── one interchange, one exit ──────────────────────────────────────
     The survey lists an interchange once per junction NODE, and a
     diamond has two of them on a carriageway: where the off-ramp
     leaves and where the on-ramp comes back, a few tenths of a mile
     apart and both carrying the same number. Read at face value that
     is two exits — 375 of them on the corridor — so exit 373 was two
     structures a median 0.64 mi apart, both signed 373, each with its
     own gore, its own merge and its own pair of tapers reaching into
     the other's. It is a third of what makes an interchange here not
     look like one, and it is most of what put a dip in the edge line
     between them.

     The thinning in buildWindow never caught it: that drops nodes
     closer together than MIN_EXIT_LEN, and every duplicate pair on the
     road is 0.50 mi or more apart.

     Clustered by number AND by distance, and the distance is what
     makes it safe. An exit number is unique within a state and a state
     is hundreds of miles of road, so the same ref twice inside three
     miles is always one interchange: measured over the whole corridor,
     two nodes of one interchange are 0.50 to 1.97 mi apart and the
     nearest two genuinely different exits sharing a number are 153 mi.

     The pair is not noise to be averaged away — it is the two ENDS.
     `a` and `b` bracket the ground the interchange stands on, which is
     what lets the structure put its gore on one node and its merge on
     the other instead of guessing a nominal mile. An interchange the
     survey knows only one node of has no such span, and keeps the
     nominal length it always had. */
  const SAME_EXIT = 3 * MILE;
  function interchanges(lo, hi) {
    const all = [];
    const open = new Map();
    /* Reached out past the window on both sides, or an interchange
       straddling the edge would be clipped to one of its nodes and
       come back as a half-length structure in the wrong place. */
    for (const e of I40.exits) {
      if (e.px < lo - SAME_EXIT) continue;
      if (e.px > hi + SAME_EXIT) break;
      const k = String(e.ref);
      const g = open.get(k);
      if (g && e.px - g.b <= SAME_EXIT) {
        g.b = e.px;
        /* Both ramps' destinations, because both are signed. The two
           nodes of exit 1 are Montara Avenue and East Main Street, and
           an EXIT 1 sign in Barstow names them both. */
        for (const t of (e.to || [])) if (!g.to.includes(t)) g.to.push(t);
        for (const v of (e.via || [])) if (!g.via.includes(v)) g.via.push(v);
      } else {
        const ng = { ref: e.ref, mi: e.mi, a: e.px, b: e.px,
                     to: (e.to || []).slice(), via: (e.via || []).slice() };
        open.set(k, ng);
        all.push(ng);
      }
    }
    const out = [];
    for (const g of all) {
      g.px = (g.a + g.b) / 2;
      g.span = g.b > g.a ? g.b - g.a : 0;
      /* `mi` moves with it. Both come off the same survey and both are
         linear in distance, so the mile at the middle of the pair is
         the first node's plus the offset — no second average to keep
         in step with the first. */
      g.mi += (g.px - g.a) / MILE;
      if (g.px >= lo && g.px <= hi) out.push(g);
    }
    return out;
  }

  /* Exits that fall inside the live window, as the road's own list.
     Their `s` is window-local so everything downstream works unchanged,
     but `mi` and `ref` stay in corridor terms because that is what the
     signs say and what the player is really navigating by. */
  /* ── which signed exits you can actually take ───────────────────────
     A road that promises a turn it does not have is worse than a road
     that says so, and real Interstates say so: an exit out of service
     gets an orange EXIT CLOSED plaque on the advance sign, because the
     alternative is people braking on the shoulder looking for it.

     The question is which exits those are, and it used to be answered
     from the SURVEY: only 350 of the 1,201 exit numbers have a walked
     ramp, so every other one was signed shut. That was right for
     exactly as long as a surveyed ramp was the only kind there was.

     It stopped being right when the generated loop-backs arrived.
     Those are built for every exit with room for one, surveyed or not,
     so the plaque went up over exits that had a working ramp behind
     it — measured across six windows, 61 of 84 CLOSED signs stood at
     the gore of an exit you could take, with a row of drums drawn
     across the shoulder of a ramp that then put you neatly back on
     I-40. The sign was describing the survey's coverage rather than
     the road, and the player cannot see the survey.

     So it is asked of the world instead, and asked LAST — after
     everything that is going to be built has been built, and after the
     ramps with no way back have been taken off the map. An exit is
     closed when nothing was built to serve it, which is a fact about
     the road the player is on. What remains genuinely is shut: an exit
     thinned out for sitting inside its neighbour, or crowded off its
     own ground by a structure that got there first.

     Per carriageway, because the two sides are built separately and a
     sign belongs to the driver who can read it. An exit served
     eastbound and crowded out westbound is signed shut westbound only,
     which is both what the data says and what a real closure looks
     like. */
  function applyExits(road) {
    const lo = road.baseS, hi = road.baseS + R.len(road);
    road.corridorExits = [];
    /* One per interchange, not one per survey node — the signs are the
       first place the duplicates showed, as two EXIT 373 boards two
       thirds of a mile apart with one interchange between them. */
    for (const e of interchanges(lo, hi)) {
      /* Closed until something is built for it — markClosed() runs at
         the end of the build and is what actually decides. Starting
         shut rather than open means a structure that fails to build
         leaves a warning behind it rather than a silent gap. */
      road.corridorExits.push({ ref: e.ref, mi: e.mi, px: e.px, s: e.px - lo,
                                to: e.to.length ? e.to : null,
                                closed: true, closedR: true, closedL: true });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WHERE THE NOSE OF A GORE ACTUALLY IS

     Not at the junction station. A ramp's station zero sits in the
     MIDDLE OF THE DECELERATION LANE — that is the whole "nothing has to
     be stitched" design at the top of road.js, and what it means is
     that at the junction station the ramp and the mainline are not two
     roads at all. They are one piece of pavement: measured at exit 374,
     the ramp's near edge is 20.5 px INSIDE the mainline's sealed
     surface and stays there for the next two hundred.

     The crash cushion was being put at that station, and so was the
     test that kills you for straddling it. So every exit on this
     corridor had a solid, run-ending object standing in the middle of
     a lane — at the one place a driver is entitled to move freely,
     because moving freely in and out of it is what a deceleration lane
     is FOR. Measured across 377 junctions the object stood 120 to 432
     px too early, median 248, about 44 m.

     The nose is where the two SEALED SURFACES part. That is a fact
     about the shapes, so it is measured off them the same way every
     other relationship on this map is: walk the ramp's parent-facing
     edge, project it back, and stop at the first station where it is
     outside the parent's pavement. In front of that point there is
     nothing to hit, which is correct. Behind it the two roads have
     their own edges and a hatched neutral area between them, which is
     where a crash cushion is bolted down in life.
     ══════════════════════════════════════════════════════════════════ */
  const NOSE_LIMIT = 4000;               // px: past this it is not a gore
  /* ── and it stands on the ground, not on the tarmac ──────────────────
     An impact attenuator is a unit bolted to a pad at the END OF A
     BARRIER RUN. It is not a free-standing object sitting out on the
     pavement, and the first version of this put it exactly there: at
     the seam, where the two sealed surfaces touch and the gap between
     them is zero by definition.

     So the nose is taken a little further on — far enough that the
     neutral area is wider than the thing standing in it, which is where
     there is ground to stand it on. In front of that the gore is paint,
     and paint is all a driver meets, which is correct: you may drive
     over a painted gore, and what stops you afterwards is the verge. */
  const NOSE_CLEAR = 12;                 // px of neutral area before the unit
  /* Walk one end of a ramp and find where its parent-facing edge leaves
     the parent's pavement. `d0` is the end to start from and `step` is
     which way along the ramp to walk from it: +1 from station zero is
     the gore, −1 from the far end is the merge. Everything else about
     the question is identical at the two ends, which is the point of
     asking it once. */
  function partsFrom(ramp, parent, out, d0, step, seed, clear) {
    const want = clear != null ? clear : NOSE_CLEAR;
    /* Which of the ramp's own edges faces the road it is leaving. A
       westbound ramp runs against the corridor's numbering, so its own
       left is the corridor's right — the same inversion `noses()` and
       the gore drawing both make. */
    const nearIsL = (out > 0) !== !!ramp.mirror;
    const len = R.len(ramp);
    const lim = Math.min(len, NOSE_LIMIT);
    let hint = seed;
    for (let k = 0; k <= lim; k += R.STEP) {
      const d = d0 + step * k;
      if (d < 0 || d > len) break;
      const e = R.edges(ramp, d);
      const p = R.at(ramp, d, nearIsL ? e.uL : e.uR);
      const pr = R.project(parent, p.x, p.y, hint, hint == null ? 0 : 60);
      if (!pr) continue;
      hint = pr.i;
      if (pr.s <= 0 || pr.s >= R.len(parent)) continue;
      const pe = R.edges(parent, pr.s);
      const gap = out > 0 ? pr.u - pe.uR : pe.uL - pr.u;
      /* `nearIsL` travels with the answer. Which of a ramp's own edges
         faces the road it left is a sign convention that has to be got
         right in three places — here, the paint in noses(), and the
         collision — and working it out separately in each is how they
         drift apart. */
      if (gap >= want) return { d, s: pr.s, i: pr.i, u: pr.u, gap, nearIsL, out };
    }
    return null;
  }

  const outOf = (entry) =>
    (entry.out != null ? entry.out : (entry.side > 0 ? 1 : -1));

  function noseOf(ramp, parent, entry) {
    return partsFrom(ramp, parent, outOf(entry), 0, 1, entry.i);
  }

  /* ── and the same point at the other end ────────────────────────────
     A merge is a gore run backwards, and it had no nose because nothing
     had ever needed one: the crash cushion goes at the gore, and the
     paint rule that stops the two edge lines crossing was written for
     the gore alone.

     It is needed for the paint. The mainline's acceleration lane opens
     over 150 stations BEFORE the ramp arrives — deliberately, so that a
     merge feels like room to merge — and for all of that distance the
     freeway is painting the outer edge line of a lane while the ramp
     converging on it paints its own two. Measured over 109 ramps: four
     white lines at every one of them, and on 70% two of the four came
     within 4 px of each other and crossed. Which is the same fault
     PLAN.md §6a fixed at the gore, at the end nobody looked at.

     Same measurement, same sign conventions, walked from the far end.

     ── and it is NOT NOSE_CLEAR ────────────────────────────────────────
     The gore nose is where a crash cushion can be bolted down, so it is
     taken 12 px into the neutral area — far enough that there is ground
     under the thing. This nose has no object to stand anywhere; it is
     only ever a paint boundary, and the paint on the other side of it
     is decided by `noses()`, which hands the line over the moment the
     ramp's near edge is outboard of the parent's sealed edge. Given the
     cushion's 12 px instead, the two disagreed over a 12 px band of
     separation — a few hundred px of road — and in it the mainline had
     stopped suppressing while the ramp had already started painting: 93
     stations across eight windows with two solid lines a median 0.8 px
     apart, which is worse than the crossing it replaced.

     So the threshold is the one `noses()` uses. If that test ever
     moves, this moves with it. */
  function mergeNoseOf(ramp, parent, entry) {
    if (!ramp.merge || ramp.merge.into !== parent) return null;
    /* One step in from the last station: `edges` at exactly len is the
       end of the array and the projection there has no segment beyond
       it to resolve against. */
    return partsFrom(ramp, parent, outOf(entry),
                     Math.max(0, R.len(ramp) - R.STEP), -1, ramp.merge.i, 0);
  }

  function markNoses(road) {
    for (const ex of road.exits) {
      if (!ex.ramp || ex.ramp.dead) continue;
      ex.nose = noseOf(ex.ramp, road, ex);
      ex.mergeNose = mergeNoseOf(ex.ramp, road, ex);
    }
  }

  /* Which exits ended up with a structure on them. `corridorSpan` is
     the stretch of corridor a structure occupies — the same figure the
     ground-claiming above is done in — so an exit is served when it
     falls inside one, with the thinning distance as slack at each end
     because that is exactly how far apart two exits have to be before
     they stop sharing a structure. */
  function markClosed(road) {
    if (!road.corridorExits) return;
    const built = [];
    for (const r of W.roads) {
      if (r.kind !== "ramp" || r.routeType !== "exit" || r.dead) continue;
      const span = r.corridorSpan;
      const mid = r.corridorPx;
      if (!span && mid == null) continue;
      built.push({
        side: r.junction && r.junction.side < 0 ? -1 : 1,
        a: (span ? span.a : mid) - MIN_EXIT_LEN,
        b: (span ? span.b : mid) + MIN_EXIT_LEN,
      });
    }
    for (const e of road.corridorExits) {
      /* ── a wye is not a closed exit on either carriageway ───────────
         Exit 368 is the I-40/I-75 split, and the survey lists it twice
         — the two carriageways' junction nodes, 0.74 mi apart. Left to
         the rule above it comes out shut in both the ways it can be
         wrong at once. Eastbound there is no exit 368 to be shut:
         you are not leaving I-40, I-75 is joining it, and an orange
         plaque over a merge is an invention. Westbound the structure
         IS built, so the first node is correctly open — and then the
         second node, a mile further on, has nothing of its own and
         signs the same junction a second time.

         `atLeftExit` already answers this question and the exit
         thinning in buildWindow already asks it, for the same reason:
         these two entries are one interchange. */
      if (atLeftExit(e.ref, e.px)) {
        e.closedR = e.closedL = e.closed = false;
        continue;
      }
      e.closedR = e.closedL = true;
      for (const b of built) {
        if (e.px < b.a || e.px > b.b) continue;
        if (b.side > 0) e.closedR = false; else e.closedL = false;
      }
      e.closed = e.closedR && e.closedL;
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
     at 451 and enter North Carolina at 1.

     Which state you are in is `stateAt`, and it is shared with the
     cable-barrier rate and the start picker so all three agree about
     where a border is. Clamped at zero because there is no mile −1
     post on any Interstate: the corridor's first two tenths of a mile
     fall a hair before California's own mile zero, which is inside the
     0.29 mi the survey's residual is good to, and a negative number on
     a green post would be a lie about the road rather than a fact
     about the data. */
  function marker(px) {
    const s = stateAt(px);
    return s ? { state: s.name, mile: Math.max(0, px / MILE + s.residual) } : null;
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
     Topologically identical to a truck stop — leave right, run past
     whatever is out there, rejoin — and that part is the design rather
     than a shortcut, because every ramp on this corridor puts you back
     on the corridor. What is NOT the same is the shape, and for a long
     time it was: 79% of the exits on this road went through `stopBump`,
     which is a rise, a flat and a fall, and the flat is a truck stop's
     parking apron. An interchange does not have one.

     ── what a real one does, measured ──────────────────────────────────
     349 of the interchanges on I-40 were walked by the survey, so the
     shape of an exit ramp is not a thing to invent. Their lateral offset
     from the corridor centreline, against the generated bump they were
     standing beside:

       | | surveyed | generated |
       | furthest from the corridor | p05 266, p50 497, p95 1153 px | 268 |
       | stations within 10% of that | 17.1% | 57.8% |

     Two separate faults and the table names both. Every generated exit
     on the corridor was built at the FIFTH PERCENTILE of the real
     distribution — 268 px against a median 497, so half the real
     interchanges are more than twice as deep as any of ours — and it
     then spent three and a half times as long as a real ramp sitting at
     its own maximum, which is the flat top reading as a frontage road.

     The reach correlates with nothing this map knows. Against the
     surveyed span between an interchange's two junction nodes r = 0.02,
     against the corridor's width there 0.01, against the ramp's own
     walked length 0.15. That is the honest answer rather than a missing
     regression: how far a ramp goes out is set by where the cross road
     happens to be, and the survey maps ramps, not streets. So it is
     DRAWN, from the surveyed distribution, hashed off the interchange's
     own position so a given exit is the same depth every time you drive
     it — the same property `hashBlock` gives the cable barrier.

     `RAMP_REACH` is that distribution as its own inverse CDF, in 5%
     steps from the minimum to the maximum. It is very close to
     lognormal — median 521 px, σ 0.442, quantiles agreeing within 6% —
     and the table is kept instead of the fit because there is no reason
     to prefer two constants over the measurement they were fitted to. */
  /* ── how long one is when the survey does not say ───────────────────
     This was 1.05 mi, and 1.05 mi is not what an interchange on this
     road measures. Where the survey gives both junction nodes the span
     between them is p05 2,723 px, p50 4,883, p95 6,652 — so the nominal
     was nearly TWICE the median, and every exit built on it was a mile
     of structure standing where half a mile of one belongs.

     It is not only a length. The lateral profile is walked as a fraction
     of it, so a structure twice as long diverges half as fast, and the
     near arm of every one of those gores came out at a third of the
     measured rate for that reason alone. Sized to the median span, the
     departure lands where the survey says without anything else being
     asked to correct it — and the ground it gives back is what lets the
     travel centres be built at all (see the note on `services`). */
  const EXIT_LEN = 4883;
  /* Px clear of the verge, the FLOOR now rather than the value. It comes
     out at about 268 px from the centreline, which is where every exit
     used to be and is also the surveyed p05 — so the truncation this
     imposes on the bottom of the distribution costs the lowest twentieth
     and nothing else. */
  const EXIT_OFF = 132;
  const RAMP_REACH = [
    179, 266, 303, 333, 360, 378, 413, 435, 456, 473, 497,
    520, 555, 599, 645, 704, 777, 884, 990, 1153, 1733,
  ];
  /* ── and no deeper than the interchange is long ─────────────────────
     A structure squeezed to MIN_EXIT_LEN by its neighbours cannot also
     be 1,733 px deep without becoming a hairpin. The measured envelope
     settles it without a taste call: over the surveyed ramps the apex
     against the corridor span the interchange occupies is p50 0.107,
     p90 0.192, p99 0.368. A ramp deeper than a third of its own span
     does not exist on this road. */
  const RAMP_SPAN_MAX = 0.37;
  /* The length the profile is walked at before a structure starts
     holding its terminal instead of stretching. The surveyed spans'
     p75 — three interchanges in four are shorter than this and get the
     table exactly as measured. */
  const PROF_SPAN = 5712;

  /* ── the lateral profile of a real ramp ─────────────────────────────
     The median of all 349 surveyed ramps, resampled to 41 points along
     each one and normalised so the apex is 1. This is the whole
     difference between an exit and a truck stop and it is measured, not
     drawn: what it says is that a ramp has an APEX — a terminal, the
     intersection with the cross road — and not a plateau.

     Two properties fall out of it rather than being aimed at. The curve
     spends 17.1% of its length within a tenth of its apex, against the
     17.7% measured directly on the ramps themselves and the 57.8% the
     flat-topped bump was giving. And its peak is at t = 0.475, not 0.5:
     a ramp gets away from the freeway slightly faster than it comes
     back, which is what a deceleration lane and an acceleration lane are
     — so the asymmetry is real and it is kept, driver-forwards, on both
     carriageways. */
  const RAMP_PROFILE = [
    0.000, 0.004, 0.019, 0.043, 0.079, 0.122, 0.166, 0.215, 0.273, 0.333,
    0.397, 0.477, 0.556, 0.640, 0.722, 0.801, 0.872, 0.937, 0.980, 1.000,
    0.999, 0.991, 0.968, 0.922, 0.860, 0.779, 0.694, 0.612, 0.531, 0.455,
    0.375, 0.308, 0.246, 0.196, 0.148, 0.107, 0.070, 0.039, 0.017, 0.003,
    0.000,
  ];

  /* ── and it has to be read as a curve, not as a polyline ────────────
     Linear interpolation between the table's samples was the first
     version and it built a road with a kink every 83 px, because that is
     what a straight line between two samples of a curve is. The kinks
     are not small: 41 samples across a 3,392 px structure 1,255 px deep
     put a **17° turn into one 8 px station** at the apex, which is a
     three-metre radius, and `relaxTurns` — the fold cap from §7a, which
     is supposed to be catching eight surveyed hairpins on the whole
     corridor — then found one in 54 ramps of 73 and spent **599 ms of a
     962 ms window rebuild** diffusing them back out. It also bulged
     every apex outward while doing it, which is why the built reach
     came out above the distribution it was drawn from.

     Catmull–Rom through the same samples. It costs four multiplies over
     the two the straight line needed, it passes through every measured
     point, and its first derivative is continuous — so there is no kink
     to find and nothing to relax. */
  function rawBump(t) {
    if (t <= 0 || t >= 1) return 0;
    const n = RAMP_PROFILE.length - 1;
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f)), x = f - i;
    const p1 = RAMP_PROFILE[i], p2 = RAMP_PROFILE[i + 1];
    const p0 = RAMP_PROFILE[i > 0 ? i - 1 : 0];
    const p3 = RAMP_PROFILE[i + 2 <= n ? i + 2 : n];
    return 0.5 * (2 * p1 + (p2 - p0) * x
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * x * x
      + (3 * p1 - 3 * p2 + p3 - p0) * x * x * x);
  }

  /* ── and a clothoid where it meets the freeway ──────────────────────
     The table above is the profile of ramps that have ALREADY BEEN
     PINNED — it was measured off the built roads, after pinEnds had
     matched their tangent and their curvature to the corridor. Fed
     straight back in as a target it therefore gets corrected twice, and
     the second correction lands exactly where the first one already did:
     over the first `CURVE_BLEND` stations, which is the 320 px past the
     gore where a driver decides whether they are leaving.

     Measured, that is not a subtlety. The table's own second derivative
     at t = 0 is a step in curvature, `pinEnds` removes it and pays it
     back over the blend, and the built ramp gained **0.0 px** of offset
     in its first 320 px against a surveyed 12.0 — so the freeway was
     still opening the whole gore by itself, which is the fault PLAN.md
     §6 left standing.

     The fix is to say what the first stretch of a ramp is. It is a
     transition curve: curvature zero at the join, growing. The quartic
     below is the lowest-order one with u = u' = u'' = 0 at the gore that
     still meets the table's own value and slope at the end of the blend,
     so the profile past the blend is untouched and the spiral finds
     nothing to take away. Both ends, because a merge is a gore run
     backwards and had the same fault at the same size. */
  function rampBump(t, ease) {
    if (t <= 0 || t >= 1) return 0;
    const e = ease > 0 && ease < 0.4 ? ease : 0;
    const near = t < e ? t : t > 1 - e ? 1 - t : 0;
    if (!near) return rawBump(t);
    const at = t < e ? e : 1 - e, h = e * 0.05, dir = t < e ? 1 : -1;
    const U = rawBump(at);
    /* Slope with respect to distance FROM THE JOIN, which on the merge
       side runs the other way down the table. */
    const V = dir * (rawBump(at + h) - rawBump(at - h)) / (2 * h);
    const x = near / e, c4 = V * e - 3 * U, c3 = 4 * U - V * e;
    return ((c4 * x + c3) * x * x * x);
  }

  /* How deep this interchange's ramp goes, on this carriageway. Hashed
     off the position so it is stable, and off the side as well so the
     two carriageways of one diamond are not the same depth — which they
     are not on any real one, because the cross road runs in both
     directions and the two terminals are wherever they are. */
  function rampReach(px, side) {
    const k = ((px / 64) | 0) ^ (side > 0 ? 0 : 0x5bf03635);
    const f = hashBlock(k) * (RAMP_REACH.length - 1);
    const i = Math.min(RAMP_REACH.length - 2, Math.floor(f));
    return RAMP_REACH[i] + (RAMP_REACH[i + 1] - RAMP_REACH[i]) * (f - i);
  }
  /* The shortest structure still worth calling an exit: enough for the
     gore, the frontage and the merge to be three distinguishable things
     rather than one continuous swerve. */
  const MIN_EXIT_LEN = 0.34 * MILE;
  /* Clear road wanted between one structure's merge and the next one's
     gore, so two neighbours never share pavement. */
  const GORE_KEEP = 0.06 * MILE;

  /* ── pin a built ramp's ends where they were asked to be ────────────
     makeRoute resamples and then smooths, and the smoothing has no road
     beyond a ramp's ends to average against, so it drags both ends
     inward along the curve. Measured on a generated loop-back: station
     zero came out 160 px — twenty stations — past the gore its junction
     records, which puts the ramp's first station where the deceleration
     lane has already tapered to half width, and leaves draw.js painting
     the gore wedge 160 px out of register with the ramp it belongs to.

     Both ends are warped back to the points they were sampled from, the
     correction blended along the length so the middle keeps its shape.
     buildRealRamp has done this since the surveyed ramps arrived; it is
     here now because the generated ones need it for the same reason. */
  /* ── and pin the TANGENTS too ────────────────────────────────────────
     Landing a ramp's ends on the right points is only half of a join.
     The other half is leaving at the right ANGLE, and until this was
     measured nothing anywhere made that true: a surveyed ramp met the
     corridor at up to 8.5° across, and the handover is instantaneous, so
     the car's heading — which is read straight off the road frame and is
     exact — was rotated eight and a half degrees inside one frame.

     What the player feels is a kick. The camera does not do it, because
     the camera has eased toward the car's heading since the flyovers
     went in for exactly this reason; the CAR does, and it cannot be
     eased the same way because its heading is not state, it is the road.
     So the road has to stop kinking.

     It is a sampling artefact and not the survey being right. OSM walks
     a ramp off the junction node at whatever angle its first fragment
     has, and the fragments average 497 ft — so a divergence that happens
     over a hundred metres of real road arrives as a step. The mainline
     end is then dragged sideways onto the deceleration lane by the
     position pin above, which skews that first segment further. Real
     ramps ARE tangent to the mainline at the gore. That is not a detail
     of how they are drawn, it is a design requirement of building one.

     The correction is the same shape as the position one: take the
     angle error at each end, spread it back along the road so it has
     died away by the middle, re-integrate, and put the ends back where
     they were. Re-integrating moves the far end, so the two corrections
     fight; three passes settle it, each taking about a tenth of what
     the last one left. The middle keeps its surveyed shape. */
  /* ── how far back the angle is spread, and why 24 ────────────────────
     Two things pull against each other and both were measured.

     Spread it far and the correction is gentle, but the first six
     hundred pixels of the ramp then run nearly PARALLEL to the mainline
     instead of pulling away from it — which is where an exit has to do
     its diverging, and road.js says at length that this map deliberately
     exaggerates that divergence because the honest one in twenty is
     invisible at the distance you can see. At 90 stations four windows
     of the corridor had a ramp back inside the carriageway's shoulder.

     Spread it close and the correction is a flick. The number that
     settles it is not clearance, it is CURVATURE, against the curvature
     the ramp already has: these ramps turn at a 444 px radius in their
     own middles, and the correction has to be looser than that or it
     becomes the tightest thing on the road and you feel the fix instead
     of the fault. At 16 stations it is 449 px — exactly as hard as the
     worst of the ramp, which is too hard. At 24 it is 659 px, half the
     turn the ramp is already asking for, and the clearance cost against
     no correction at all is about two pixels. */
  const TANGENT_BLEND = 24;              // stations, ≈ 192 px at each end
  /* ── and the CURVATURE, which is the third thing a join has ──────────
     Pinning the point and the tangent makes a join continuous to look
     at. It does not make it continuous to drive, and this was measured
     before it was fixed: across 523 gores and merges the heading error
     after the tangent pin is a median 0.002° — that part works — while
     the RATE of turn still steps by a median 1.84e-4 /px at the gore,
     and 5.9e-4 at the ninetieth.

     What that is, in the units the player feels: the car's heading is
     read straight off the road frame, so its yaw rate is the road's
     curvature times its speed. A step in curvature is therefore a step
     in lateral acceleration inside one frame — 0.87 m/s² at the median
     gore at 65 mph, 2.77 at the ninetieth. Nothing accelerates sideways
     that fast; it arrives as a tug on the whole picture, which is
     exactly the complaint that sent me looking.

     Real roads do not do this and there is a name for why: the spiral.
     A ramp does not leave a straight motorway on its final radius, it
     runs a transition whose curvature grows from the mainline's to its
     own, and AASHTO sizes that transition by limiting lateral JERK.
     So the fix is not a fudge, it is the missing piece of geometry:
     ease the ramp's curvature to its parent's at both ends, over a
     blend, so the road has a spiral where a spiral belongs.

     Why it does not simply reuse TANGENT_BLEND: that number was chosen
     against the ramp's own 444 px turning radius, and it is a rotation
     that dies away. This is an integral of one — the lateral cost grows
     as the square of the blend — so it is a different trade against the
     same divergence budget and it gets its own measurement. See the
     table in PLAN.md §6. */
  const CURVE_BLEND = 40;                // stations, ≈ 320 px at each end
  /* ── and the spiral has to give the road back ────────────────────────
     The first version of this simply eased the curvature error away
     over the blend, which is what a transition curve looks like drawn
     on its own. On a ramp that already exists it is wrong, and the
     corridor sweep said so in one line: clearance went from +2.9 px to
     −75.2 px at mile 2130, a ramp and the freeway sharing 75 px of
     sealed surface where they had been apart.

     The reason is that a one-sided correction has a net area. Adding
     curvature over a stretch and not taking it back rotates EVERYTHING
     past the blend — the whole body of the ramp, out where it is
     furthest from the road — and pinning the two ends afterwards then
     turns that rotation into a bulge in the middle. The join got
     smooth and the ramp moved.

     So the correction has to integrate to zero: full strength at the
     join, crossing over, and paid back by the end of the blend, which
     leaves the ramp's body exactly where the survey put it. The
     cubic below is the only one that can — 1 at t=0, 0 at t=1 with
     zero slope there, and zero area under it:

         payback(t) = (1−t)²(1−4t) = 1 − 6t + 9t² − 4t³

     It crosses zero a quarter of the way along and its counter-curve
     peaks at a quarter of the correction, so the road never bends back
     harder than the fault it is fixing. */
  const payback = (t) => (1 - t) * (1 - t) * (1 - 4 * t);
  const angleTo = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  /* ── no station turns harder than a car can turn ─────────────────────
     A separate fault from the join, found by the same measurement and
     much worse where it happens. Peak curvature present anywhere inside
     each of 769 built ramps: 96.7% are gentler than R=400 px, then
     there is a gap, and then eight ramps sit under R=80 px. The worst
     is exit 1 at **17 px — a three-metre radius**, which is not a road,
     it is a pivot.

     It is in the survey, not in the building of it. The walked polyline
     for exit 1 runs east to x=10524 and comes straight back thirty
     pixels — five metres — to the north of itself, a 150.6° turn
     between two segments each about seven metres long. Seven of the
     eight are the same shape. That is not coarse sampling; it is the
     walk going out to the cross road and back, which is exactly what
     this corridor says every ramp is, with nothing rounding the apex
     where the two legs meet at one node.

     So the fix is not to smooth the ramp — smoothing a fold just moves
     it — it is to say what the apex has to be. A vehicle turning round
     needs a radius, and the floor here is the AASHTO minimum for a
     20 mph ramp: 24.6 m at e=0.06, f=0.27, which is 138 px, rounded to
     150. The measured distribution leaves that unopposed — the tightest
     legitimate turn on the corridor is 191 px, so nothing that is
     already a road gets touched.

     The turn is REDISTRIBUTED, never discarded: a hairpin genuinely
     reverses direction and that 180° has to happen somewhere. Excess
     above the cap is pushed into the neighbouring stations and pushed
     again until every station is under it, which spreads the turn along
     the ramp and bulges the apex outward — the U-turn gets wider, which
     is the honest answer, rather than shorter, which would leave the
     ramp unable to reach its own far end. */
  const MIN_RAMP_R = 150;                // px — a 20 mph ramp, AASHTO

  const TURN_CAP = R.STEP / MIN_RAMP_R;
  const TURN_TAN = Math.tan(TURN_CAP);

  /* ── is there a fold in here at all, asked as cheaply as possible ────
     This runs on every station of every ramp, and it used to ask with
     `atan2` per segment — which put 39% on a window rebuild, most of a
     performance pass that had been fought for line by line (§7).

     The question does not need an angle. Between two segments a and b,
     the turn exceeds the cap exactly when the cross product outruns the
     dot product by more than its tangent, with an obtuse turn — dot at
     or below zero — over the cap by inspection. No transcendental, and
     the 96.7% of ramps with nothing wrong pay one multiply-add per
     station and leave. */
  function anyFold(st, n) {
    let ax = st[1].x - st[0].x, ay = st[1].y - st[0].y;
    for (let i = 1; i < n; i++) {
      const bx = st[i + 1].x - st[i].x, by = st[i + 1].y - st[i].y;
      const dot = ax * bx + ay * by;
      const cross = ax * by - ay * bx;
      if (dot <= 0 || Math.abs(cross) > TURN_TAN * dot) return true;
      ax = bx; ay = by;
    }
    return false;
  }

  function relaxTurns(road) {
    const st = road.st, n = st.length - 1;
    if (n < 4) return false;
    /* Almost every ramp leaves here. */
    if (!anyFold(st, n)) return false;
    const cap = TURN_CAP;
    const seg = new Array(n), turn = new Array(n);
    for (let i = 0; i < n; i++) {
      const dx = st[i + 1].x - st[i].x, dy = st[i + 1].y - st[i].y;
      seg[i] = { h: Math.atan2(dx, dy), len: Math.hypot(dx, dy) };
    }
    turn[0] = 0;
    for (let i = 1; i < n; i++) turn[i] = angleTo(seg[i].h, seg[i - 1].h);

    for (let pass = 0; pass < 400; pass++) {
      let worst = 0;
      for (let i = 1; i < n; i++) {
        const t = turn[i], a = Math.abs(t);
        if (a <= cap) continue;
        if (a > worst) worst = a;
        const spill = (a - cap) * Math.sign(t);
        turn[i] = cap * Math.sign(t);
        /* Into whichever neighbours exist; at the very ends there is
           only one, and it takes the lot. */
        const lo = i > 1, hi = i < n - 1;
        if (lo && hi) { turn[i - 1] += spill / 2; turn[i + 1] += spill / 2; }
        else if (lo) turn[i - 1] += spill;
        else if (hi) turn[i + 1] += spill;
        else return true;                // nowhere to put it; a 4-station ramp
      }
      if (worst === 0) break;
    }
    let h = seg[0].h;
    for (let i = 0; i < n; i++) {
      h += turn[i];
      seg[i].h = h;
    }
    let x = st[0].x, y = st[0].y;
    for (let i = 0; i < n; i++) {
      x += Math.sin(seg[i].h) * seg[i].len;
      y += Math.cos(seg[i].h) * seg[i].len;
      st[i + 1].x = x; st[i + 1].y = y;
    }
    return true;
  }

  /* Curvature of a built road at `s`, radians per px, signed the way
     its own stations run. Central difference over one station either
     side, which is what every measurement of this file uses. */
  function curveAt(r, s) {
    const h1 = R.frame(r, s - R.STEP).h, h2 = R.frame(r, s + R.STEP).h;
    return angleTo(h2, h1) / (2 * R.STEP);
  }

  function pinEnds(road, a, b, ha, hb, ka, kb) {
    const st = road.st, n = st.length - 1;
    if (n < 2) return;
    const slide = () => {
      const dxA = a.x - st[0].x, dyA = a.y - st[0].y;
      const dxB = b.x - st[n].x, dyB = b.y - st[n].y;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        st[i].x += dxA + (dxB - dxA) * t;
        st[i].y += dyA + (dyB - dyA) * t;
      }
    };
    slide();
    const m = Math.min(TANGENT_BLEND, (n / 2) | 0);
    const mk = Math.min(CURVE_BLEND, (n / 2) | 0);
    /* A ramp too short to hold a spiral does not get one. Below about
       six stations the blend is shorter than the smoothing that built
       the road and all it does is move the kink. */
    const spiral = (ka != null || kb != null) && mk >= 6;
    if ((ha != null || hb != null) && m >= 4) {
      const seg = new Array(n);
      const gA = new Array(n), gB = new Array(n);
      const measure = () => {
        for (let i = 0; i < n; i++) {
          const dx = st[i + 1].x - st[i].x, dy = st[i + 1].y - st[i].y;
          seg[i] = { h: Math.atan2(dx, dy), len: Math.hypot(dx, dy) };
        }
      };
      const rebuild = () => {
        let x = st[0].x, y = st[0].y;
        for (let i = 0; i < n; i++) {
          x += Math.sin(seg[i].h) * seg[i].len;
          y += Math.cos(seg[i].h) * seg[i].len;
          st[i + 1].x = x; st[i + 1].y = y;
        }
        slide();                          // the far end moved; put both back
      };
      /* ── the spiral first, then the tangent, and never together ──────
         Both corrections were applied in one step to begin with, added
         to a single measurement of the road, and they fought: the
         spiral moves the very segments the tangent error was read off,
         so a tangent correction computed before it lands is answering
         the wrong question. Measured, that cost the worst join 1.155°
         of the heading continuity the tangent pin exists to guarantee —
         a 24-fold regression on the very thing being protected.

         Correcting them in sequence, so the tangent always sees the
         road the spiral just made, is the whole fix, and it put the
         worst back to 0.049°. It costs one extra integration per pass,
         which is most of this function's 9.4% — see PLAN.md §7. Three
         passes still, not four: the fourth was measured and is idle,
         because the convergence test below already stops it. */
      /* A ramp with no fold in it on the first look will not grow one:
         the two corrections below are gentle and neither can bend a
         road past a 20 mph radius. So the check latches off, and only
         the handful that are actually folded keep paying for it. */
      let relaxing = true;
      for (let pass = 0; pass < 3; pass++) {
        /* ── relax inside the loop, not before it ────────────────────
           Relaxing a fold moves the far end a long way — that is what
           bulging the apex outward means — and `slide` then drags the
           whole ramp back with a shear proportional to how far along it
           you are, which lands squarely on an apex that sits at mid
           length and re-tightens most of what was just relaxed.
           Measured, relaxing once before the pins took exit 1 from
           R=17 px only to 41. Relaxing every pass, so the cap and the
           pins settle against each other, is what actually holds it. */
        if (relaxing) { if (relaxTurns(road)) slide(); else relaxing = false; }
        let dA = 0, dB = 0;
        if (spiral) {
          measure();
          /* The curvature error at each end, carried as the heading
             step per segment the road has and ought not to — the same
             units as `seg[].h`. */
          dA = ka == null ? 0 : ka * seg[0].len - angleTo(seg[1].h, seg[0].h);
          dB = kb == null ? 0 : kb * seg[n - 1].len - angleTo(seg[n - 1].h, seg[n - 2].h);
          /* Integrate each away from the end it pins, so it is zero AT
             that end and the tangent stays pinned. */
          gA[0] = 0;
          for (let i = 0; i < n - 1; i++)
            gA[i + 1] = gA[i] + (i < mk ? dA * payback(i / mk) : 0);
          gB[n - 1] = 0;
          for (let i = n - 1; i > 0; i--) {
            const q = n - 1 - i;
            gB[i - 1] = gB[i] - (q < mk ? dB * payback(q / mk) : 0);
          }
          for (let i = 0; i < n; i++) seg[i].h += gA[i] + gB[i];
          rebuild();
        }
        measure();
        const eA = ha == null ? 0 : angleTo(ha, seg[0].h);
        const eB = hb == null ? 0 : angleTo(hb, seg[n - 1].h);
        if (Math.abs(eA) < 1e-4 && Math.abs(eB) < 1e-4
            && Math.abs(dA) < 1e-5 && Math.abs(dB) < 1e-5) break;
        for (let i = 0; i < n; i++) {
          const wA = i < m ? 1 - smooth(i / m) : 0;
          const wB = i > n - 1 - m ? 1 - smooth((n - 1 - i) / m) : 0;
          seg[i].h += eA * wA + eB * wB;
        }
        rebuild();
      }
    }
    for (let i = 0; i <= n; i++) {
      const p = st[Math.max(0, i - 1)], q = st[Math.min(n, i + 1)];
      st[i].h = Math.atan2(q.x - p.x, q.y - p.y);
    }
    R.rebound(road);
  }

  /* How far along `road` it gets furthest from `from`, in its own s.
     A diamond's terminal, a loop's apex — whatever the walked shape
     actually did. Every eighth station is plenty at this scale. */
  function furthest(road, from, seed) {
    let best = 0, bestD = -1, hint = seed;
    for (let i = 0; i < road.st.length; i += 8) {
      const p = road.st[i];
      const pr = R.project(from, p.x, p.y, hint, 400);
      if (!pr) continue;
      hint = pr.i;
      if (pr.dist > bestD) { bestD = pr.dist; best = i * R.STEP; }
    }
    return best;
  }

  /* `furthest` answers WHERE ALONG A RAMP it gets furthest from the
     road it left. This answers where that point is on the CORRIDOR, and
     how far out — which together are the ramp's terminal, and therefore
     where the cross road has to be and how long it has to be to have a
     junction on it. Measured for every structure, generated or walked:
     a drawn reach says how deep the shape was asked to be and not where
     the built road ended up. */
  /* Seeded from the parent station the ramp's own gore stands on, which
     is written down in its junction, for the reason PLAN.md §7 gives
     about `dressAll` — a scan of the whole twenty-mile corridor to
     rediscover a number that is already recorded is most of what a
     rebuild used to spend its time on. Four stations of ramp move the
     projection about four stations of corridor, so the window after
     that only has to be wide enough for the apex, where the ramp is
     running out sideways and the projection barely moves at all. */
  function apexOf(road, from) {
    let bu = 0, bs = 0;
    let hint = road.junction ? road.junction.i : null;
    for (let i = 0; i < road.st.length; i += 4) {
      const p = road.st[i];
      const pr = R.project(from, p.x, p.y, hint, hint == null ? 0 : 24);
      if (!pr) continue;
      hint = pr.i;
      if (Math.abs(pr.u) > Math.abs(bu)) { bu = pr.u; bs = pr.s; }
    }
    return { s: bs, u: bu };
  }

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

    const s0 = spec.startPx - lo, s1 = spec.endPx - lo;
    const iOut = Math.round(s0 / R.STEP), iIn = Math.round(s1 / R.STEP);
    /* Widen the mainline FIRST, for the reason buildStop gives at length:
       the ends are about to be pinned to the centre of the deceleration
       lane, and until openAux has run there is no deceleration lane to
       pin them to. This used to happen the other way round, so every
       surveyed ramp was pinned half a lane inside the pavement it was
       supposed to leave from. Real ramps are all eastbound. */
    R.openAux(parent, iOut, 1, 150, 1);
    R.closeAux(parent, iIn, 1, 150, 1);

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
    /* Tangent to the mainline at both ends. Real ramps are all
       eastbound, so both target headings are the corridor's own. */
    pinEnds(road,
      R.at(parent, s0, R.auxLaneU(parent, s0, 1)),
      R.at(parent, s1, R.auxLaneU(parent, s1, 1)),
      R.frame(parent, s0).h, R.frame(parent, s1).h,
      curveAt(parent, s0), curveAt(parent, s1));
    road.kind = "ramp"; road.rampLanes = 1; road.med = 0; road.back = 0;
    road.parent = parent;
    road.routeType = "exit";
    road.real = true;
    road.exitRef = spec.ref || null;
    road.signTo = spec.to || null;
    road.signVia = spec.via || null;
    road.corridorPx = (spec.startPx + spec.endPx) / 2;
    /* The stretch of corridor this interchange occupies, in the same
       terms the generated structures record it and the ground-claiming
       below works in. A walked ramp's midpoint can be most of a mile
       from the junction node it leaves by, so `corridorPx` alone is not
       enough to tell whether a given exit number is served by it. */
    road.corridorSpan = { a: spec.startPx, b: spec.endPx };
    road.baseS = 0;
    road.mirror = false;

    /* ── the ones that go over ─────────────────────────────────────────
       A surveyed ramp is the interchange as it was walked, and real
       interchanges have ramps that cross the freeway: a connector to the
       far side, the second half of a cloverleaf, a left-side ramp coming
       back. This never lifted any of them. They were built at grade and
       driven at grade, straight through the mainline — exit 211B/211A at
       mile 1891 crosses the whole carriageway TWICE, from +111 px to
       −290 and back, and every station of it was on the road you were
       driving on. The clearance invariant said so all along; it is only
       ever asserted for the window the car is in, which is why 23 of 341
       ramps could sit on the corridor without anyone hearing about it.

       Measured, not declared, the same as every other bridge here: walk
       the ramp, ask the corridor whether this station is standing on its
       sealed surface, lift exactly those. The ends are excluded over the
       distance clearance() itself excuses around a join, because a ramp
       IS on the mainline at its gore and at its merge — that is what a
       gore and a merge are — and a bridge there would be a bridge over
       the road it is joining.

       A span has to be long enough to be a crossing before it is worth a
       deck. Most of those 23 are not crossings: they are a ramp running
       alongside and clipping a few pixels of shoulder, and putting a
       bridge over that would draw a parapet in the middle of a field. */
    /* ── which stations have to be a bridge, and which are just a gore ──
       Not "how far from the end is it". A gore is where a ramp shares
       pavement with the road it is leaving, and it is allowed to; the
       first version of this trimmed a fixed 85 stations at each end for
       that reason and exit 211 crossed to the far carriageway INSIDE
       that window, so it stayed at grade for the part that mattered.

       The question is not distance, it is which side of the road you are
       on. A ramp on its OWN side, near its own end, is at a gore. A ramp
       past the median is on the other carriageway and must be over it,
       however close to the gore it happens to be.

       Real ramps here are all eastbound, so their own side is +u. */
    const JOIN_KEEP = Math.round((R.GORE + R.WEDGE * R.STEP) / R.STEP);
    const CROSS_MIN = 20;                    // stations: shorter is a graze
    const last = road.st.length - 1;
    const need = [];
    let reachMin = 0, reachMax = 0, hint = null;
    for (let i = 0; i <= last; i++) {
      const p = road.st[i];
      const pr = R.project(parent, p.x, p.y, hint, hint == null ? 0 : 40);
      if (!pr) continue;
      hint = pr.i;
      if (pr.u < reachMin) reachMin = pr.u;
      if (pr.u > reachMax) reachMax = pr.u;
      if (pr.s <= 0 || pr.s >= R.len(parent)) continue;
      const e = R.edges(parent, pr.s);
      /* Envelope to envelope, not centreline to envelope — see reach().
         A ramp whose flank is inside the carriageway is on it, and has
         to be over it, however far its middle happens to be. */
      const w = reach(road, i * R.STEP);
      if (pr.u <= e.uL - R.SH_OUT - w || pr.u >= e.uR + R.SH_OUT + w) continue;
      const wrongSide = -pr.u > R.insideAt(parent, pr.s) + R.LANE / 2;
      const atEnd = i < JOIN_KEEP || i > last - JOIN_KEEP;
      if (wrongSide || !atEnd) need.push(i);
    }
    /* ── and which carriageways it is standing on ──────────────────────
       A ramp that crosses the freeway occupies BOTH sides of it, and the
       ground-claiming below only ever knew about the side it left from.
       So at exit 211 the survey's ramp swung out to −290 px — well past
       the median, across the westbound carriageway — and the generated
       westbound loop-back for the same exit number was then built into
       it, because as far as `roomAt` was concerned that ground was free.
       Two structures, one piece of tarmac, 35 px of overlap, and the
       deck above does not help: they are both at grade out there. */
    road.reach = { min: reachMin, max: reachMax };

    const grouped = [];
    addRanges(grouped, need, 1, 16);
    const spans = grouped.filter((g) => g.b - g.a >= CROSS_MIN);
    if (spans.length) raise(road, spans, 1, 30);

    road.merge = { into: parent, s: s1, i: iIn, u: R.auxLaneU(parent, s1, 1),
                   lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: false };
    const entry = { i: iOut, ramp: road, s: s0, side: 1, lanes: 1,
                    startU: R.auxLaneU(parent, s0, 1), mirror: false, from: parent };
    parent.exits.push(entry);
    road.junction = entry;

    /* The signal sits where the ramp is furthest from the road, which on
       a real interchange is the terminal — the intersection with the
       cross street the ramp was walked across. That is a place to be
       FOUND, not a fraction: a walked ramp is not symmetrical, and half
       way along one is simply half way along it. Exit 386's terminal is
       nowhere near its midpoint. */
    const at = furthest(road, parent, iOut);
    const phase0 = (spec.startPx / 977) % 11;
    road.meter = { i: Math.round(at / R.STEP), s: at, phase0,
                   t: phase0, red: phase0 < 4.2, wait: 0 };
    W.metered.push(road);
    return road;
  }

  /* ══════════════════════════════════════════════════════════════════
     THE LEFT EXITS

     Almost every offramp in America leaves from the right, and every
     one of the 350 surveyed on this corridor does. Three on I-40 do
     not, and the first of them is a different KIND of thing rather
     than the same thing on the other side.

     ── what a wye is ──────────────────────────────────────────────────
     Exit 368 is the I-40/I-75 wye west of Knoxville. The two routes run
     concurrent from here into the city; at this point they part, and
     AARoads signs it for westbound traffic as LEFT EXIT 368 —
     Chattanooga, I-75 south. What leaves is not a ramp off the side of
     I-40, it is two of I-40's own lanes: the inside pair BECOME I-75
     south and they do not come back. That is a lane DROP, which is why
     there is no deceleration lane here and nothing to decelerate into.
     You are already in the exit; the decision is whether to leave it.

     The survey agrees with the sign. I40.lanes carries 4 lanes east of
     18,409,031 px and 2 west of it, which is the concurrency ending —
     so the drop is real data, and all this has to do is make it happen
     on the INSIDE, at a nose, instead of tapering off the outside a
     thousand pixels early. R.dropLeft does that, and has been sitting
     unused since the fictional map: nothing had a left exit to give it.

     ── and what this map has to do to it ──────────────────────────────
     One thing about the real interchange cannot survive here, and it is
     the same thing that stops every other exit being real: the rule
     that an offramp on this corridor puts you back on this corridor.
     I-75 goes to Chattanooga. So the two lanes leave to the left, fly
     over the eastbound carriageway — which is what they genuinely do,
     the real ramp is a flyover — run past the frontage on the far side,
     and then come back across and rejoin I-40 west on an ordinary
     acceleration lane. The departure is true. The return is the game.

     ── why they are a table and not a case ────────────────────────────
     Because there are two more. Left Exit 206 is I-440 east at
     Nashville and there is a left-hand ramp to Sam Cooper Blvd where
     I-40 meets I-240 in Memphis. Both are a line in here when their
     geometry is settled. */
  /* ── and one of them is shut ────────────────────────────────────────
     `closure` says the exit is signed, open, and a trap: I-75 south is
     closed for construction beyond the gore. That is a real thing a
     real Interstate does and it is signed a particular way, which is
     what `warn` and `taper` are — orange plaques from a mile and a half
     out, then a drum taper that shuts the two left lanes long before
     you reach them, because the whole job of a lane closure is to move
     traffic over while there is still room to do it politely.

       warn    px before the gore the first orange plaque stands
       taper   px before the gore the drums start crossing
       works   fraction along the ramp where the pavement runs out

     You may still take it. Nothing stops you — that is also real, and
     it is what the drums are for. What you find is a ramp that gets
     worse and then ends, and by then your only way out is reverse. */
  const LEFT_EXITS = [
    { ref: "368", px: 18408779.7, lanes: 2, side: -1,
      to: ["Chattanooga"], via: ["I 75 S"],
      closure: { warn: 13500, taper: 9000, works: 0.62 } },
  ];
  /* How far a signed exit number has to be from a left exit before it
     is a DIFFERENT interchange rather than the other carriageway's
     entry for the same one. Exit 368 appears twice in the survey, 0.74
     mi apart, and neither of them is a second junction. */
  const LEFT_SAME = 1.5 * MILE;

  const leftExitsIn = (lo, hi) =>
    LEFT_EXITS.filter((e) => e.px > lo + 2 * MILE && e.px < hi - 2 * MILE);
  const atLeftExit = (ref, px) =>
    LEFT_EXITS.some((e) => e.ref === String(ref) && Math.abs(e.px - px) < LEFT_SAME);

  /* Clear of the corridor: how far from the mainline's own verge the
     frontage sits, measured to the ramp's NEAR edge rather than to its
     centreline, because a two-lane ramp is not a one-lane ramp shifted
     over. */
  const WYE_CLEAR = 96;
  /* Fractions of the structure spent leaving and rejoining. The
     departure is quick — a wye separates hard, and the sooner the ramp
     is off the carriageway the sooner it can be a bridge rather than
     two roads sharing tarmac. The return is the long one, because it
     has to cross back over everything and then still leave room for a
     merge you can actually make. */
  const WYE_OUT = 0.22, WYE_IN = 0.34;
  /* Stations of ramp left at grade at each end before the deck is
     allowed to lift. Both are inside the length World.clearance()
     excuses around a legitimate join, so the two roads are never both
     unexcused and at the same level. */
  const WYE_GRADE = 30;                     // stations of climb
  const WYE_FLAT_OUT = 70, WYE_FLAT_IN = 78;

  function buildLeftExit(parent, spec) {
    const side = spec.side > 0 ? 1 : -1;
    const lanes = Math.max(2, Math.min(3, spec.lanes | 0 || 2));
    /* Its own length, and not the diamonds'. This read `EXIT_LEN`, and
       when that was resized to the surveyed median interchange span the
       wye halved with it — which broke it, because everything else here
       is counted in STATIONS: `WYE_GRADE`, `WYE_FLAT_OUT` and
       `WYE_FLAT_IN` say where the deck lifts and drops, and on a
       structure half as long they no longer cover the crossing. Exit
       368 went over the eastbound carriageway 110 px at grade and the
       corridor sweep caught it. A wye is not a diamond and has no
       business sharing a number with one. */
    const LEN = 1.05 * MILE;
    /* The gore is at the junction the survey names, and the structure
       runs DOWNSTREAM from it — the way its driver is going. For the
       westbound carriageway that is falling s, so the gore is the east
       end and the merge the west one. */
    const sGore = spec.px - parent.baseS;
    const sMerge = sGore + side * LEN;
    if (Math.min(sGore, sMerge) < 600 || Math.max(sGore, sMerge) > R.len(parent) - 600) return null;
    const iGore = Math.round(sGore / R.STEP);
    const iMerge = Math.round(sMerge / R.STEP);

    /* ── the drop, before anything is measured off the road ────────────
       Every offset below is read from the parent, and dropLeft moves
       two of them: the lane count on this carriageway and the width of
       its inside shoulder. Sample first and the ramp is anchored to a
       cross-section that stops existing one station later. */
    const dropped = R.dropLeft(parent, iGore, lanes, side,
                               { hold: 90, heal: 210 });
    /* A wye has no cable barrier strung across its own gore. The median
       here is grass — 30 px of it at the nose, opening to 60 as the
       road narrows — and the rail that rural Tennessee otherwise gets
       is exactly the thing two lanes cannot leave through. */
    const railFrom = Math.min(iGore, iMerge) - 40, railTo = Math.max(iGore, iMerge) + 40;
    for (let i = Math.max(0, railFrom); i <= Math.min(parent.medRail.length - 1, railTo); i++)
      parent.medRail[i] = 0;

    /* The acceleration lane it comes back on. There is deliberately no
       matching openAux at the gore: the lane you leave in is a through
       lane, and giving it an auxiliary one as well would widen the road
       at the one place a wye narrows it. */
    R.closeAux(parent, iMerge, lanes, 0, side);

    /* ── the three anchors ─────────────────────────────────────────────
       Each is read from the parent at the station being sampled, so all
       three track a corridor that is changing width underneath them,
       and the profile is a blend of the three rather than a bump off
       one of them. `gore` is the middle of the lanes that leave — for
       two lanes that is one lane in from the median, which is where
       the ramp's own lane zero has to sit for the handover to line up.
       `far` is the frontage, on the far side of everything. `back` is
       the middle of the acceleration lane. */
    const goreU = (s) => side * (R.insideAt(parent, s) + R.LANE / 2);
    const farU = (s) => {
      const e = R.edges(parent, s);
      const near = side > 0 ? e.uL - R.SH_OUT - R.VERGE : e.uR + R.SH_OUT + R.VERGE;
      return near - side * (WYE_CLEAR + (lanes - 0.5) * R.LANE + R.RAMP_SH);
    };
    const backU = (s) => R.auxLaneU(parent, s, side);

    const n = Math.max(8, Math.round(LEN / R.STEP));
    const pts = new Array(n + 1);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const s = sGore + side * LEN * t;
      const w0 = t < WYE_OUT ? 1 - smooth(t / WYE_OUT) : 0;
      const w2 = t > 1 - WYE_IN ? smooth((t - (1 - WYE_IN)) / WYE_IN) : 0;
      const u = w0 * goreU(s) + w2 * backU(s) + (1 - w0 - w2) * farU(s);
      const p = R.at(parent, s, u);
      pts[k] = { x: p.x, y: p.y };
    }

    const road = R.makeRoute(pts, {
      polyline: true, kind: "ramp", fwd: lanes, back: 0, lanes,
      smooth: false, layer: ++W.nextLayer,
    });
    const turn = side > 0 ? 0 : Math.PI;
    /* Driving the corridor backwards reverses the sign of its turn, the
       same π that `turn` and `mirror` carry everywhere else. */
    const kw = side > 0 ? 1 : -1;
    pinEnds(road, R.at(parent, sGore, goreU(sGore)), R.at(parent, sMerge, backU(sMerge)),
            R.frame(parent, sGore).h + turn, R.frame(parent, sMerge).h + turn,
            kw * curveAt(parent, sGore), kw * curveAt(parent, sMerge));
    road.kind = "ramp";
    road.rampLanes = lanes;
    road.med = 0;
    road.back = 0;
    road.parent = parent;
    road.routeType = "exit";
    road.leftExit = true;
    road.exitRef = spec.ref;
    road.signTo = spec.to || null;
    road.signVia = spec.via || null;
    road.corridorPx = spec.px;
    road.corridorSpan = { a: Math.min(sGore, sMerge) + parent.baseS,
                          b: Math.max(sGore, sMerge) + parent.baseS };
    road.baseS = 0;
    road.mirror = side < 0;

    /* ── the flyover ───────────────────────────────────────────────────
       Measured, not declared, the same way every other bridge on this
       map is: walk the ramp, ask the corridor whether this station is
       standing on its sealed surface, and lift exactly those — minus
       the stations at each end, which are standing on it because that
       is what a gore and a merge ARE. */
    const over = overlapRanges(road, parent, 0, road.st.length - 1, null);
    const last = road.st.length - 1;
    const spans = [];
    for (const g of over) {
      const a = Math.max(g.a, WYE_FLAT_OUT), b = Math.min(g.b, last - WYE_FLAT_IN);
      if (b - a > WYE_GRADE) spans.push({ a, b });
    }
    raise(road, spans, 1, WYE_GRADE);

    road.merge = { into: parent, s: sMerge, i: iMerge, u: backU(sMerge),
                   lanes, baseLane: 0, laneAdd: false, accel: true, mirror: side < 0 };
    /* `out` is which way ACROSS the road the ramp leaves, and `side` is
       which carriageway it serves. On every other exit in the game they
       are the same number, which is why one field did for both until
       there was a left exit. Here they are opposite: it serves the −u
       carriageway and it leaves toward +u. */
    const entry = { i: iGore, ramp: road, s: sGore, side, out: -side, lanes,
                    startU: goreU(sGore), mirror: side < 0, left: true, from: parent };
    parent.exits.push(entry);
    road.junction = entry;
    road.dropped = dropped;

    /* ── the closure ───────────────────────────────────────────────────
       Recorded on the ramp, in the ramp's and the corridor's own
       coordinates, so nothing downstream has to know what a wye is.
       draw.js reads it to put the orange up and the drums out; the
       player update reads `works` and finds the end of the road there.

       `works` is a distance along the ramp, and it is measured from the
       fraction rather than stored as one because everything else that
       hits it is in px and a fraction is a number you have to convert
       at every use. */
    if (spec.closure) {
      const c = spec.closure;
      road.closure = {
        works: R.len(road) * clamp(c.works != null ? c.works : 0.62, 0.2, 0.9),
        warn: c.warn > 0 ? c.warn : 13500,
        taper: c.taper > 0 ? c.taper : 9000,
        /* What the orange says. The green sign above it still says
           Chattanooga, because the sign is the road's and the closure
           is temporary — which is exactly how it reads on the ground. */
        legend: (spec.via && spec.via[0]) || spec.ref,
      };
      /* A closed ramp still comes back. It has to: a ramp with no way
         back is a hole in the map, and the invariant that catches those
         cannot be taught to make exceptions for the ones we shut on
         purpose without stopping being an invariant. So the geometry
         loops to the merge exactly as it would have; what is different
         is that you cannot get down it. */
      road.closed = true;
    }
    return road;
  }

  /* ══════════════════════════════════════════════════════════════════
     THE CROSS ROAD

     What an exit is FOR, and until now the one part of an interchange
     this map did not draw. A structure that leaves the freeway, runs
     past a frontage and comes back reads as a bulge in the road; the
     same structure with a road bridged over it reads as a junction, and
     that is the whole difference at seventy miles an hour.

     ── it is scenery, and that is the point ───────────────────────────
     You cannot drive onto it. That is not a limitation of how it is
     built, it is the rule the corridor runs on: every exit here puts you
     back on I-40, so a road that leads somewhere else must not be
     reachable, or it is a hole in the map and the player will find it.

     Two things enforce that, and neither is a flag on a drawing. It
     carries `scenery`, which surface() refuses outright — the one
     function that decides what is under the wheels. And it is on a
     DECK: a bridge over the corridor is a different level, and the deck
     test has excluded other levels since the flyovers arrived. Drive at
     it and you leave the road, exactly as if it were a fence.

     ── why over, and not under ────────────────────────────────────────
     Both happen on I-40 and either would look right. Over is the one
     that costs nothing: the mainline stays at grade for its whole
     length, the player's own deck never changes, and draw.js already
     knows how to draw an elevated road — parapets instead of guardrails,
     no verge hanging in mid-air, and a shadow dropped on what is below.
     Under would mean lifting the freeway at every exit and taking the
     car with it. */
  /* ── long enough to have the junction on it ─────────────────────────
     3,200 px was a length picked to run off both sides of any view, and
     while every exit was a 268 px bump that was always true. It is not
     true of a road whose terminal can be 1,733 px out: the cross road
     would have ended 133 px past the intersection it exists to make, so
     the ramp met the road it serves at the very tip of it.

     Sized to the deeper of its two terminals now, with `CROSS_TAIL` of
     street carrying on past it — because what says "this is a junction
     and not the end of a road" is that the cross road keeps going. */
  const CROSS_LEN = 3200;         // px: runs off both sides of any view
  const CROSS_TAIL = 900;         // px of street past the furthest terminal
  /* ── how much of it is bridge ───────────────────────────────────────
     Only the mainline. Bridging the frontage as well is a real enough
     arrangement, and it was the first thing built here, but it puts the
     deck over the ramp's own junction — so the signal, which is the
     other half of what an interchange looks like, was drawn underneath
     a bridge and could not be seen at all.

     Coming back to grade before the frontage is both more visible and
     more accurate: it is a diamond. The cross road goes over the
     freeway, drops to the level of everything else, and the ramp meets
     it at a signalised junction, which is exactly the shape of the
     aerial photograph. The abutment is short — the corridor's sealed
     edge is a hundred pixels out and the frontage is a hundred and
     sixty — but this is a top-down game and a grade is a number, not a
     slope you can see. What you see is where the parapets stop. */
  const CROSS_DECK = 110;         // px each side of the corridor that is bridge
  const CROSS_GRADE = 6;          // stations of abutment at each end of it

  function buildCross(parent, px, name, reach) {
    const s = px - parent.baseS;
    if (s < 600 || s > R.len(parent) - 600) return null;
    const LEN = Math.max(CROSS_LEN, 2 * ((reach || 0) + CROSS_TAIL));
    /* Square to the corridor. A real cross road meets a freeway at
       whatever angle its own alignment gives it, and the survey does not
       tell us that angle — it maps the ramps, not the street. Square is
       the honest default rather than a rolled one, and it is what a
       diamond is built to anyway. */
    const start = R.at(parent, s, -LEN / 2);
    const road = R.makeStreet(start.x, start.y, R.frame(parent, s).h + Math.PI / 2,
                              { lanes: 1, layer: ++W.nextLayer });
    R.grow(road, LEN);
    road.scenery = true;
    road.crossName = name || null;
    road.corridorPx = px;
    road.baseS = 0;
    road.terminals = [];
    /* Up over the corridor and back down beyond it. The span is set from
       where the mainline actually is rather than a fixed count of
       stations, so it clears the road it crosses however wide that has
       become. */
    const mid = Math.round(R.len(road) / 2 / R.STEP);
    const half = Math.round(CROSS_DECK / R.STEP);
    raise(road, [{ a: mid - half, b: mid + half }], 1, CROSS_GRADE);
    return road;
  }

  /* ── the ramp terminal, which is the thing that was missing ─────────
     `buildCross` has drawn a street over every interchange since it went
     in, and the exit ramp has driven straight across it: measured over
     231 cross roads and 450 ramps, 447 of the pairs met AT GRADE, a
     median 4.2 px apart, and not one of them had a junction on it. Two
     roads crossing on the same tarmac with no stop line, no break in
     anybody's markings and nothing on the street to say a road joins
     here — which is why an exit read as a bulge with a bridge near it
     rather than as an interchange.

     This is the record of that meeting, and it is MEASURED rather than
     assumed: walk the ramp, project it onto the street, and take the
     station where it crosses the street's centreline. Both roads then
     stop painting through the mouth, the ramp's guardrail stands down
     across it, and the signal — which has always been here — finally has
     something under it.

     Note what is deliberately NOT built: a way onto the street. The
     corridor's one rule is that every ramp puts you back on the
     corridor, so the street stays `scenery` and stays refused by
     surface(). What changes is that the place you cross it looks like
     the place you cross it. */
  const TERM_CLEAR = 12;          // px of unpainted road past the far kerb
  function terminal(ramp, cross) {
    /* Coarse then fine. `pr.u` here is the ramp's distance ALONG the
       corridor from the street, so it falls at very nearly one pixel per
       pixel of ramp and the crossing cannot hide between two samples
       eight stations apart. Walking every station instead costs eight
       times as much for an answer that is already exact once the second
       pass has run. */
    const scan = (from, to, step, seed) => {
      let bd = Infinity, bi = -1, bxs = 0, bh = seed, hint = seed;
      for (let i = from; i <= to; i += step) {
        const p = ramp.st[i];
        if (!p) continue;
        const pr = R.project(cross, p.x, p.y, hint, hint == null ? 0 : 24);
        if (!pr) continue;
        hint = pr.i;
        if (pr.s <= 0 || pr.s >= R.len(cross)) continue;
        const d = Math.abs(pr.u);
        if (d < bd) { bd = d; bi = i; bxs = pr.s; bh = pr.i; }
      }
      return { bd, bi, bxs, bh };
    };
    const last = ramp.st.length - 1;
    const c = scan(0, last, 8, null);
    if (c.bi < 0) return null;
    const f = scan(Math.max(0, c.bi - 8), Math.min(last, c.bi + 8), 1, c.bh);
    const bd = f.bi < 0 ? c.bd : f.bd, bi = f.bi < 0 ? c.bi : f.bi;
    const bxs = f.bi < 0 ? c.bxs : f.bxs;
    const s = bi * R.STEP;
    /* ── two ways this is not a junction, and both are real ────────────
       A ramp that passes OVER the street is a flyover, and eight of the
       surveyed complexes on this corridor have one: exit 211B leaves the
       freeway, climbs, and crosses everything. There is no junction under
       a bridge, so there is no stop line, no break in the paint and no
       gap in the rail — the deck test that already decides what is over
       what decides this too.

       And a ramp that never reaches the street's centreline has not met
       it. Measured, the ramps that miss do not miss by a little: p50 is
       2.0 px and the ones that fail are hundreds out, because they are
       walked geometry that turns back before the street or that serves
       the far carriageway. A kerb's width of slack, and past that it is
       not a terminal and is not pretended to be. */
    if (Math.abs(R.deckAt(ramp, s) - R.deckAt(cross, bxs)) > 0.5) return null;
    if (bd > (R.edges(cross, bxs).uR - R.edges(cross, bxs).uL) / 2 + R.LANE) return null;
    /* How square the crossing is. A ramp at its apex runs parallel to
       the freeway and the street is built square to it, so this should
       be a right angle and the suite asserts that it is — but the mouth
       has to be widened by however far off square it comes out, or the
       paint gap is too short on a skewed one. */
    const skew = Math.abs(Math.cos(angleTo(R.frame(ramp, s).h, R.frame(cross, bxs).h)));
    const open = Math.max(0.35, Math.sqrt(Math.max(0, 1 - skew * skew)));
    const half = (r, at) => {
      const e = R.edges(r, at);
      return Math.max(e.uR, -e.uL) + (r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT);
    };
    const t = {
      ramp, cross, s, i: bi, xs: bxs, dist: bd,
      /* Degrees away from square, for the invariant. */
      skew: Math.abs(90 - Math.acos(Math.min(1, skew)) * 180 / Math.PI),
      /* Half the mouth, along each road. */
      wRamp: (half(cross, bxs) + TERM_CLEAR) / open,
      wCross: (half(ramp, s) + TERM_CLEAR) / open,
    };
    const range = (r, at, w) => ({
      a: Math.round((at - w) / R.STEP), b: Math.round((at + w) / R.STEP),
    });
    (ramp.gap || (ramp.gap = [])).push(range(ramp, s, t.wRamp));
    (cross.gap || (cross.gap = [])).push(range(cross, bxs, t.wCross));
    /* A guardrail across the mouth of a junction is a fence across a
       junction. The street has none to take down — furniture() skips
       every `street` — so this is only ever the ramp's. */
    const g = range(ramp, s, t.wRamp + R.VERGE);
    ramp.noL.push(g); ramp.noR.push(g);
    cross.terminals.push(t);
    ramp.terminal = t;
    return t;
  }

  function buildStop(parent, stop) {
    const isExit = stop.kind === "exit";
    /* ── as long as it can be, and no longer ───────────────────────────
       EXIT_LEN is what a loop-back wants: a mile of decel, frontage and
       accel. Half the exits on I-40 are closer together than that — the
       median gap is 1.02 mi and the tenth percentile is 0.51 — so a
       fixed length built each structure straight through its neighbour.
       Twenty-two pairs shared sealed surface in one window, and a car
       approaching one gore could be handed to a different exit's ramp.

       `room` is the distance to the nearest neighbour on this side, set
       by the caller, and the structure is sized to fit inside it.

       ── and as long as the interchange actually is ──────────────────
       EXIT_LEN is a guess, used because for most of this corridor a
       guess is all there is. Where the survey gave both junction nodes
       of an interchange it is not a guess: `span` is the distance from
       one to the other, so the structure is that long and its gore and
       merge land on the nodes the survey put them at. Median 0.64 mi
       against the 1.05 the nominal asks for, which is why the nominal
       ran every second interchange through its neighbour. */
    const room = stop.room > 0 ? stop.room : Infinity;
    const want = stop.span > 0 ? stop.span : (isExit ? EXIT_LEN : STOP_LEN);
    const LEN = clamp(Math.min(want, room - 2 * GORE_KEEP), MIN_EXIT_LEN, want);
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
    /* Which end you LEAVE from is a fact about the driver, not about the
       corridor's numbering. Eastbound traffic leaves at s0 and rejoins at
       s1; westbound traffic runs the other way down the same stations, so
       it leaves at s1 and rejoins at s0 — and it does it on the −u side,
       which is what the fourth argument is. Both were wrong: every
       westbound exit opened its deceleration lane on the eastbound
       carriageway, and had none of its own.

       `closeAux` is now given the station the ramp actually arrives at.
       It used to be handed `iIn - 26` so that something like a lead-in
       existed, which put a full-width lane 208 px upstream of anything —
       the second white-line cliff of every exit. */
    R.openAux(parent, side > 0 ? iOut : iIn, 1, 150, side);
    R.closeAux(parent, side > 0 ? iIn : iOut, 1, 150, side);

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
    /* ── how deep, and it is one number for the whole structure ────────
       A truck stop's apron sits a fixed distance outside the verge, so
       its far offset is measured per station against an edge that moves
       with the deceleration lane. An interchange's terminal is a PLACE —
       the junction with the cross road — so its offset is one number
       from the corridor's centreline, and the profile carries the ramp
       out to it and back.

       The floor is what the pavement requires, which is why the widest
       edge in the structure is what it is taken against rather than the
       edge at the apex: a five-lane section with a deceleration lane
       open is 40 px wider than the same road two hundred stations later,
       and a reach drawn below that would put the terminal on the hard
       shoulder. */
    const sh = R.SH_OUT + R.VERGE;
    let wide = 0;
    for (let k = 0; k <= n; k++) {
      const e = R.edges(parent, s0 + LEN * (k / n));
      wide = Math.max(wide, side > 0 ? e.uR : -e.uL);
    }
    const floor = wide + sh + EXIT_OFF + R.LANE / 2;
    const deep = isExit
      ? clamp(rampReach(stop.px, side), floor, Math.max(floor, RAMP_SPAN_MAX * LEN))
      : 0;
    /* ── a long interchange holds its terminal; it does not sag ────────
       The profile is a SHAPE, so walking it as a fraction of the length
       means a structure twice as long diverges half as fast — and the
       long ones on this road are long: the surveyed span runs to 1.97 mi
       where the median is 0.54. Stretched over 10,384 px, exit 235's
       return leg came back to within 18.8 px of the freeway's sealed
       edge and ran beside it, which took the corridor's tightest
       clearance from +2.9 px to −6.1, its two paved shoulders overlapping
       by six.

       That is the wrong emulation of a long interchange. A mile-long one
       does not have gentler ramps — it has a longer CONNECTOR out at the
       cross road. So the profile is walked at its own scale and the apex
       is held for whatever is left over, which is also what stops the
       flat top coming back: only the 5% of structures longer than the
       surveyed p75 get any hold at all, and on those the flat part is a
       real connector rather than the middle of every exit on the road. */
    const hold = isExit ? Math.max(0, LEN - PROF_SPAN) : 0;
    const P = LEN - hold;
    /* Where the table's own apex falls, so the hold is inserted there
       rather than at the arithmetic middle — the two arms are not the
       same length and the asymmetry is measured. */
    const apex = 0.475 * P;
    /* The transition curve at each join, as a fraction of the profile's
       own length. It is the same stretch pinEnds spirals over, and it
       has to be — a shorter one leaves a curvature step for the spiral
       to find and a longer one flattens road the spiral never touches. */
    const ease = clamp(CURVE_BLEND * R.STEP / P, 0, 0.2);
    const shape = (d) => (d < apex ? rampBump(d / P, ease)
                        : d > apex + hold ? rampBump((d - hold) / P, ease)
                        : rampBump(0.475, ease));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const s = s0 + LEN * t;
      const e = R.edges(parent, s);
      const near = R.auxLaneU(parent, s, side);
      /* The profile is walked in the DRIVER's direction. A westbound
         structure is sampled along the corridor's numbering and then
         reversed below, so it has to be read backwards here or the
         asymmetry — out fast, back slow — comes out the wrong way round
         on half the road. */
      const far = isExit
        ? side * deep
        : (side > 0 ? e.uR + sh : e.uL - sh) + side * (STOP_OFF + R.LANE / 2);
      const b = isExit ? shape(side > 0 ? LEN * t : LEN * (1 - t)) : stopBump(t);
      const u = near + (far - near) * b;
      const p = R.at(parent, s, u);
      pts[k] = { x: p.x, y: p.y };
    }
    /* How far out the terminal stands, so the cross road can be built
       long enough to have a junction on it rather than ending short of
       one. Signed the way the structure leaves. */
    const reachU = isExit ? side * deep : 0;

    /* A stop that serves WESTBOUND traffic is built running westbound.
       The corridor's stations increase eastward, so a left-side stop
       sampled in that order would be a road you drive backwards: its
       own `s` would fall as you advanced along it, and every merge and
       gore test in the game assumes s grows ahead of you. Reversing the
       points costs nothing and means a westbound stop is an ordinary
       forward road that happens to sit on the other side. */
    if (side < 0) pts.reverse();

    /* `smooth: false` — this centreline is ours, not a survey. See the
       note in road.js: filtering a designed curve bends its ends, and
       the ends are the whole point of this shape. */
    const road = R.makeRoute(pts, {
      polyline: true, kind: "ramp", fwd: 1, back: 0, lanes: 1,
      smooth: false, layer: ++W.nextLayer,
    });
    /* Station zero is the end the DRIVER starts from, which for a
       westbound structure is s1 — the points were reversed above. */
    /* A westbound structure runs against the corridor's numbering, so
       the heading it has to be tangent to is the corridor's reversed —
       the same π that `mirror` carries everywhere else. */
    const turn = side > 0 ? 0 : Math.PI;
    const kw = side > 0 ? 1 : -1;
    pinEnds(road,
      R.at(parent, side > 0 ? s0 : s1, R.auxLaneU(parent, side > 0 ? s0 : s1, side)),
      R.at(parent, side > 0 ? s1 : s0, R.auxLaneU(parent, side > 0 ? s1 : s0, side)),
      R.frame(parent, side > 0 ? s0 : s1).h + turn,
      R.frame(parent, side > 0 ? s1 : s0).h + turn,
      kw * curveAt(parent, side > 0 ? s0 : s1),
      kw * curveAt(parent, side > 0 ? s1 : s0));
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
    /* The stretch of corridor this structure occupies, so the next one
       along can be sized to keep off it. Its own length is not that —
       the ramp is longer than the span it covers. */
    road.corridorSpan = { a: s0 + parent.baseS, b: s1 + parent.baseS };
    /* Where this structure's terminal stands, across the corridor. The
       cross road is built to it — see buildCross — so an exit reaches
       the road it exists to reach rather than stopping short of it. */
    road.reachU = reachU;
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
    /* Signed by auxLaneU itself now, per carriageway. These used to be
       measured on the east side and negated, which is not the same
       number the moment the two carriageways differ — and with the
       oncoming aux lane finally existing, they differ at every exit. */
    const auxOut = R.auxLaneU(parent, s0, side);
    const auxIn = R.auxLaneU(parent, s1, side);
    road.mirror = side < 0;
    road.merge = side > 0
      ? { into: parent, s: s1, i: iIn, u: auxIn,
          lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: false }
      : { into: parent, s: s0, i: iOut, u: auxOut,
          lanes: 1, baseLane: 0, laneAdd: false, accel: true, mirror: true };
    const entry = {
      i: side > 0 ? iOut : iIn,
      ramp: road,
      s: side > 0 ? s0 : s1,
      side, lanes: 1,
      startU: side > 0 ? auxOut : auxIn,
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
    W.roads.length = 0; W.grid.clear();
    W.roads.push(road);

    const lo = road.baseS, hi = road.baseS + R.len(road);
    /* ── what ground is already spoken for ─────────────────────────────
       Corridor spans, per carriageway, of every structure built so far.
       Exit structures are a mile long and half the exits on I-40 are
       closer together than that, so without this the later ones were
       built straight through the earlier ones: twenty-two same-side
       pairs sharing sealed surface in one twenty-mile window, which is
       also why a car approaching one gore could be handed to a different
       exit's ramp. Surveyed things — the real interchanges, the rest
       areas and truck stops — are where they are; but only the real
       interchanges have a surveyed SHAPE, and the other two are a bump
       of our choosing round a surveyed point. So the order is: walked
       geometry first, then the generated loop-backs, then the stops,
       each sized to fit what the ones before it left. */
    const taken = { 1: [], "-1": [] };
    const claim = (side, a, b) => taken[side > 0 ? 1 : -1].push({ a, b });
    const roomAt = (side, px) => {
      let room = Infinity;
      for (const t of taken[side > 0 ? 1 : -1]) {
        if (px >= t.a && px <= t.b) return 0;         // the ground is gone
        room = Math.min(room, 2 * (px < t.a ? t.a - px : px - t.b));
      }
      return room;
    };

    /* Every real exit in the window, both directions. Two ramps per exit
       number — one serving each carriageway — because that is what an
       Interstate has and because the sign has to be on your own side. */
    /* Real interchanges first. Where the survey has the shape, use it;
       the generated loop-back is only for exits the walk could not
       close, and for the westbound side, whose ramps rejoin a
       carriageway this corridor does not carry. */
    /* ── and a number is not a name ─────────────────────────────────────
       The survey's ramps carry the junction ref OSM tagged the link way
       with, and around a system interchange every link in the complex
       gets the same one. Six separate ramps west of Greensboro are all
       tagged 227 and all signed Danville / Charlotte via I-85 south,
       spread over ten miles of I-40 — so a driver passed six EXIT 227s.
       Eight pairs of 350 surveyed ramps are like this.

       The geometry is walked and real and it is kept; the number is
       what is wrong, and after the first one it comes off. The ramp
       still signs where it goes, which is what its destination tags are
       for and what those six actually have in common. */
    const placed = new Map();
    for (const spec of (I40.ramps || [])) {
      if (spec.endPx < lo || spec.startPx > hi) continue;
      const r = buildRealRamp(road, spec);
      if (r) {
        if (r.exitRef != null) {
          const k = r.exitRef + (r.junction && r.junction.side < 0 ? "|W" : "|E");
          const prev = placed.get(k);
          if (prev != null && Math.abs(spec.startPx - prev) < SAME_EXIT) r.exitRef = null;
          else placed.set(k, spec.startPx);
        }
        W.roads.push(r); index(r);
        /* Real ramps are eastbound, and the ground they occupy is the
           span the survey walked, not a nominal exit length. Claiming it
           is also what stops the generated eastbound exit for the same
           number being built on top of it — which the old proximity test
           missed whenever the ramp's start and the junction node were
           more than half a mile apart, and there were three of those in
           this window alone, each drawn twice. */
        claim(1, spec.startPx - GORE_KEEP, spec.endPx + GORE_KEEP);
        /* …and the other carriageway too, if it went over there. See
           the note in buildRealRamp: a crossing ramp stands on both
           sides, and claiming only the side it left from let a
           generated loop-back be built straight through it. */
        if (r.reach && r.reach.min < -R.MED_RURAL)
          claim(-1, spec.startPx - GORE_KEEP, spec.endPx + GORE_KEEP);
      }
    }

    /* ── then the left exits ───────────────────────────────────────────
       Authored, not surveyed, but the same class of thing: a known
       shape at a known place, built before anything generated so the
       generated things have to fit around it. It claims BOTH
       carriageways. That is not caution — at a wye there is no exit on
       the other side to be crowded out. Eastbound at 368 you are not
       leaving I-40, you are being joined by I-75, and the ordinary
       loop-back this map would otherwise build there is an
       interchange that does not exist. */
    for (const spec of leftExitsIn(lo, hi)) {
      const r = buildLeftExit(road, spec);
      if (!r) continue;
      W.roads.push(r); index(r);
      claim(1, r.corridorSpan.a - GORE_KEEP, r.corridorSpan.b + GORE_KEEP);
      claim(-1, r.corridorSpan.a - GORE_KEEP, r.corridorSpan.b + GORE_KEEP);
    }

    /* A/B pairs share one structure, so the list is thinned first — and
       it has to be thinned BEFORE the gaps are measured, or every
       structure would be sized to fit against a neighbour that is never
       built. The two junction nodes of one interchange were already
       folded together upstream of this, by `interchanges`; what is left
       here is genuinely different numbers standing too close, which is
       what 147A and 147B are. */
    const wanted = [];
    let last = -1e9;
    for (const e of interchanges(lo, hi)) {
      if (e.px - last < MIN_EXIT_LEN) continue;
      /* An exit number that belongs to a left exit is already built,
         once, as the thing it actually is. Without this, exit 368 comes
         back as an ordinary right-hand exit a mile short of the real
         one, so a westbound driver passes two of them. */
      if (atLeftExit(e.ref, e.px)) continue;
      last = e.px;
      wanted.push(e);
    }
    for (let k = 0; k < wanted.length; k++) {
      const e = wanted[k];
      const before = k > 0 ? e.px - wanted[k - 1].px : Infinity;
      const after = k < wanted.length - 1 ? wanted[k + 1].px - e.px : Infinity;
      for (const side of [1, -1]) {
        /* Room to the nearer surviving neighbour on THIS carriageway, and
           to anything already standing on it. Zero means the exit is
           already served by a structure that is there — skip it rather
           than draw a second one through the first. */
        const room = Math.min(before, after, roomAt(side, e.px));
        if (room < MIN_EXIT_LEN) continue;
        /* ── and not if the survey already walked this one ─────────────
           `roomAt` answers a question about GROUND, and that is the
           wrong question when the number is what is duplicated. Exit
           341 has three junction nodes spanning 1.97 mi, so the middle
           of them is 1.28 mi from the surveyed ramp built for the same
           exit — clear of its claim, and built as a second exit 341 on
           the same carriageway. Asked by name as well as by place. */
        const key = e.ref + (side > 0 ? "|E" : "|W");
        const already = placed.get(key);
        if (already != null && Math.abs(e.px - already) < SAME_EXIT) continue;
        /* `span` is the two junction nodes, and it is the length the
           structure wants: gore on one, merge on the other. */
        const r = buildStop(road, { kind: "exit", px: e.px, side, room,
                                    span: e.span,
                                    name: e.to[0] || null,
                                    ref: e.ref, to: e.to, via: e.via });
        if (r) {
          W.roads.push(r); index(r);
          placed.set(key, e.px);
          claim(side, r.corridorSpan.a - GORE_KEEP, r.corridorSpan.b + GORE_KEEP);
        }
      }
    }

    /* ── and the pumps last, because the pumps are the scenery ─────────
       Rest areas and truck stops hang off the mainline, so they are
       built after it and before it is indexed: openAux() edits the
       parent's deceleration lanes and the index does not care, but the
       renderer reads them.

       They come after the interchanges, and they did not use to. A
       travel centre sits beside an interchange because that is where
       travel centres are, and the rule this file already stated is that
       where the two land on the same ground the stop is what yields —
       the exit is what the game is about. Built in the other order the
       stop got there first and the exit was skipped, and the only
       reason that never showed is that an interchange used to be built
       twice: the second copy landed clear and served the sign. Folding
       the pair into one structure took the spare copy away and left 38
       eastbound and 53 westbound exits signed CLOSED behind a set of
       fuel pumps. Sized against the exits now, and where there is no
       room left the stop is the thing that is not built. */
    /* ── and the ones with nowhere to stand get an address instead ─────
       Sizing the stops against the exits is right and it has a price
       this file recorded and then left: over a 159-window sweep, 227
       surveyed stop sites want to exist and 69 were built. The other 158
       were not moved or shrunk, they were dropped — a hundred and fifty
       named travel centres that the corridor simply does not have.

       That is the wrong answer for a truck stop, and it is wrong in a
       way that is obvious once said: **a travel centre is not a thing
       off the freeway, it is a thing off the interchange.** The Petro
       at exit 407 is on the frontage road, and you reach it by taking
       exit 407 — which is why it does not need a gore of its own and
       why one was never right. So where the ground is an interchange's,
       the stop becomes that interchange's, and the interchange's sign
       says so on the blue panel underneath, which is where a real one
       is advertised.

       A rest area is different and is deliberately not treated the
       same. It stands between interchanges by definition — that is
       what it is for — so one whose ground has been taken by an exit is
       a rest area that this corridor does not have, and it is counted
       rather than moved somewhere it would not be. */
    const SERVICE_REACH = 0.75 * MILE;
    const serve = (st) => {
      if (st.kind !== "truck") return false;
      const side = st.side > 0 ? 1 : -1;
      let best = null, bd = SERVICE_REACH;
      for (const q of W.roads) {
        if (q.routeType !== "exit" || q.parent !== road || !q.junction) continue;
        if ((q.junction.side > 0 ? 1 : -1) !== side) continue;
        const sp = q.corridorSpan;
        const d = sp && st.px >= sp.a && st.px <= sp.b ? 0
                : Math.abs(q.corridorPx - st.px);
        if (d < bd) { bd = d; best = q; }
      }
      if (!best) return false;
      (best.services || (best.services = [])).push(st.name);
      return true;
    };
    for (const st of (I40.stops || [])) {
      if (st.px < lo || st.px > hi) continue;
      const room = roomAt(st.side, st.px);
      const r = room < MIN_EXIT_LEN ? null : buildStop(road, Object.assign({ room }, st));
      if (r) {
        W.roads.push(r); index(r);
        claim(st.side, r.corridorSpan.a - GORE_KEEP, r.corridorSpan.b + GORE_KEEP);
      } else serve(st);
    }
    /* ── and now take the furniture off where they overlap ─────────────
       dress() has existed since the fictional map and the corridor build
       never called it, so noL/noR were empty on every road here and
       suppressed() always said no: the mainline painted its steel
       guardrail straight through every exit, inside the ramp's own
       sealed surface for 14.8% of all ramp stations. The verges survive
       on drawing order alone — every road's gravel goes down before any
       road's asphalt — but a guardrail is an object standing on the
       ground and is laid after all the tarmac, so ordering cannot save
       it. Only knowing what is there can. */
    /* ── every exit comes back ──────────────────────────────────────────
       The rule the whole game rests on: an offramp on this corridor puts
       you back on this corridor. A ramp that leads away — onto a cross
       street, onto another route, anywhere the map does not continue —
       is a hole you can drive into and not come out of, and it must not
       be enterable at all.

       Nothing here builds one on purpose. Both builders pin their far
       end to the mainline and set `merge`. But "nothing builds one on
       purpose" is not an invariant, it is a habit, and a surveyed ramp
       whose far end falls outside the live window is exactly the case
       that would produce one quietly. So a ramp without a way back is
       taken off the map before anything can steer onto it. */
    for (let k = W.roads.length - 1; k >= 1; k--) {
      const r = W.roads[k];
      if (r.parent !== road || r.merge) continue;
      r.dead = true;                          // handovers() already skips these
      const ex = road.exits.indexOf(r.junction);
      if (ex >= 0) road.exits.splice(ex, 1);
      W.roads.splice(k, 1);
      (W.oneWay || (W.oneWay = [])).push(r.exitRef || r.stopName || "?");
    }
    /* Every structure has written its own deceleration and acceleration
       lanes by now, each sized as if it were alone on the road, and
       where two of them reach into each other the max of the two is a
       dip. Settled here — after the last one and before anything
       measures the cross-section — so what dressAll, the noses and the
       car all see is the finished width. See R.settleAux. */
    R.settleAux(road);
    dressAll(road);

    /* ── and the road the exit exists to reach ─────────────────────────
       One per interchange, not one per ramp: an exit number is a place,
       and both carriageways' structures serve the same street. Rest
       areas and truck stops do not get one — nothing crosses there, and
       putting a bridge over a picnic table would be worse than leaving
       it out.

       Built last, after dressAll(), on purpose. It is scenery on another
       level and has no business in anybody's verge suppression: the
       roads underneath keep their own gravel and rails, which is what
       you see under a real overpass. */
    /* ── grouped by their TERMINALS, which is a change ──────────────────
       This used to walk the exits in build order and skip any within
       0.3 mi of a street already built, on the reading that two
       structures that close together are the two carriageways of one
       interchange. Half a mile is also the closest two GENUINELY
       DIFFERENT exits stand on this road, so the rule quietly made
       neighbours share a street — and the neighbour's ramp then met it
       2,094 px from its own terminal, 145 px off the pavement, while it
       was still up on the bridge deck. Sixteen exits in a 64-mile sweep.
       Nothing could see it while nothing measured the meeting.

       The street belongs at the ramp TERMINALS, so that is what it is
       positioned and grouped by: apexes within `CROSS_GROUP` are one
       interchange, and the street goes through the middle of them. The
       two carriageways of a generated diamond are about 250 px apart on
       that measure — the profile is asymmetric, so each apex sits a
       little downstream of its own driver — and the closest two real
       interchanges are five times that. */
    const CROSS_GROUP = 0.14 * MILE;
    const terms = [];
    for (const r of W.roads) {
      if (r.routeType !== "exit" || r.corridorPx == null) continue;
      /* Not at a wye. A cross road is what a diamond is FOR, and a wye
         has none — the two lanes that leave are another Interstate, not
         a street, and bridging one over the flyover would put a road
         nobody can drive on top of the one thing here that is real. */
      if (r.leftExit) continue;
      const a = apexOf(r, road);
      terms.push({ r, s: a.s, u: a.u });
    }
    terms.sort((a, b) => a.s - b.s);
    for (let k = 0; k < terms.length;) {
      let j = k + 1;
      while (j < terms.length && terms[j].s - terms[k].s < CROSS_GROUP) j++;
      const group = terms.slice(k, j);
      k = j;
      /* ── positioned by the ramps whose shape we chose ────────────────
         Where a walked ramp and a generated one serve the same number,
         averaging their two apexes puts the street between them — and
         a deep generated ramp is turning hard 500 px off its own apex,
         so exit 80 westbound met its street at 37° off square. The
         generated ones are the ones this map decides the shape of, so
         they are what the street is squared and centred on; a surveyed
         ramp meets it at whatever angle its own geometry gives, which
         is what a walked interchange does anyway. */
      const own = group.filter((g) => !g.r.real);
      const put = own.length ? own : group;
      let at = 0, deepest = 0;
      for (const g of put) at += g.s / put.length;
      for (const g of group) deepest = Math.max(deepest, Math.abs(g.u));
      const lead = group[0].r, to = lead.signTo;
      const x = buildCross(road, at + road.baseS,
                           lead.stopName || (Array.isArray(to) ? to[0] : to), deepest);
      if (!x) continue;
      /* ── and the junction on it ─────────────────────────────────────
         A signal belongs where the ramp meets the cross road, and until
         there was a cross road the best that could be said was "the far
         point of the ramp" for a surveyed one and "half way" for a
         loop-back. Half way along an arc is not half way along the
         corridor — the ramp bulges — so the light was standing a
         thousand pixels from the bridge it is supposed to be under.

         `terminal` measures it, and it does the rest of what a junction
         is at the same time: the paint stops on both roads and the
         ramp's guardrail stands down across the mouth. */
      for (const g of group) {
        const t = terminal(g.r, x);
        if (t && g.r.meter) { g.r.meter.s = t.s; g.r.meter.i = t.i; }
      }
      /* ── and if nothing met it, it is not a cross road ───────────────
         A street with no junction on it is a bridge over a freeway
         leading nowhere: scenery pretending to be an interchange, which
         is the exact fault this section is fixing. It happens where a
         group is nothing but walked flyovers — at Kingston, mile 2034,
         where every ramp of the complex passes over the street rather
         than meeting it — so the honest answer is not to build one.
         Nothing to undo: `terminal` makes its two refusals before it
         touches either road. */
      if (!x.terminals.length) continue;
      W.roads.push(x); index(x);
    }
    /* Last, because it is a statement about the finished world: which
       signed exits ended up with nothing behind them. See markClosed —
       asked any earlier and it is answering about a road that is still
       being built. */
    markClosed(road);
    /* After everything, because a nose is measured against the finished
       cross-section: openAux and closeAux are still widening the
       mainline while the structures go in, and the nose is exactly the
       point where the ramp gets outside that width. */
    markNoses(road);
    index(road);
    return road;
  }

  /* ── dress the mainline against its ramps, and back ─────────────────
     Both directions, but only over the stations where the two are close
     enough for either to be standing in the other's verge.

     Finding those first is what makes this affordable. Dressing every
     station of every structure both ways is 11.7 million segment tests
     per window and took a rebuild from 180 ms to 600 ms — half a second
     of frozen car every time the window slides, which happens every
     eight miles. For most of an exit's length the ramp is a hundred and
     thirty pixels clear of the verge and there is nothing to find.

     So one cheap pass walks the ramp, projects each station onto the
     parent, and records the pairs that come within reach. Everything
     after that is dressed over those ranges only, seeded with the
     matching index on the other road so no probe ever has to scan a
     twenty-mile corridor to find out where it is. */
  function dressAll(road) {
    /* How near the two centrelines must be for one road's furniture to
       reach the other's sealed surface: a shoulder, a verge, the widest
       half-section a ramp has, and slack for the angle between them. */
    const REACH = R.SH_OUT + R.VERGE + 2 * R.LANE + R.RAMP_SH + 24;
    for (let k = 1; k < W.roads.length; k++) {
      const r = W.roads[k];
      if (r.parent !== road) continue;
      const onRamp = [], onRoad = [];
      const rampAt = new Map();          // parent station → ramp station
      const roadAt = new Map();          // ramp station   → parent station
      /* ── where this ramp starts on the corridor, which we know ───────
         This used to be null, with a note explaining that a westbound
         ramp runs against the corridor's numbering so no end of the
         window is reliably the right seed, and that one full scan per
         ramp buys a hint that tracks the rest of the way. The premise
         is right and the conclusion was more expensive than it needed
         to be: `junction.i` IS the parent station this ramp's station
         zero sits on, whichever way it runs, because that is what the
         junction record means. A full scan is 22,477 segment tests
         against a number already written down. */
      let hint = r.junction ? r.junction.i : null;
      const roadLen = R.len(road);
      /* ±4 stations, and that is measured rather than chosen. This walk
         steps one ramp station at a time and both roads are stationed
         at the same 8 px, so the projection onto the corridor can only
         advance by the cosine of the angle between them — at most one
         station per step. Instrumented across nine windows and every
         ramp in them, the largest gap this projection ever had to close
         was TWO stations. Four is double that; twelve was three times
         what the case needs, on the most-called projection in the
         build. */
      for (let i = 0; i < r.st.length; i++) {
        const p = r.st[i];
        const pr = R.project(road, p.x, p.y, hint, hint == null ? 0 : 4);
        if (!pr) continue;
        hint = pr.i;
        if (pr.s <= 0 || pr.s >= roadLen) continue;
        const e = R.edges(road, pr.s);
        if (pr.u <= e.uL - REACH || pr.u >= e.uR + REACH) continue;
        onRamp.push(i);
        onRoad.push(pr.i);
        roadAt.set(i, pr.i);
        if (!rampAt.has(pr.i)) rampAt.set(pr.i, i);
      }
      if (!onRamp.length) continue;
      const nearest = (m, i) => {
        for (let d = 0; d < 8; d++) {
          if (m.has(i + d)) return m.get(i + d);
          if (m.has(i - d)) return m.get(i - d);
        }
        return null;                     // no pair to hand: let dress scan
      };
      /* Merged generously. These are the WINDOWS the dressing walks, and
         each window's results are turned into ranges on its own — so two
         windows split a station apart leave a one-station tooth of paint
         between them, which reads as a fleck of white dropped on the
         road. Sixteen stations of slack costs a little walking and keeps
         each overlap in one piece. */
      const aRanges = [], bRanges = [];
      addRanges(aRanges, onRamp, 1, 16);
      addRanges(bRanges, onRoad.slice().sort((p, q) => p - q), 1, 16);
      for (const g of aRanges) dress(r, road, g.a, g.b, nearest(roadAt, g.a));
      for (const g of bRanges) dress(road, r, g.a, g.b, nearest(rampAt, g.a));

      /* ── the paint ─────────────────────────────────────────────────
         Both lines of the pair go off together, up to the nose, and both
         come on together after it. The ramp's OTHER edge — the one
         facing away — is never suppressed: it is the outside of the
         whole pavement and it carries straight through the gore, which
         is what makes the outer line continuous. */
      const side = r.junction.side;
      /* ── a left exit takes no edge line with it ────────────────────
         A right-hand ramp leaves through the corridor's outer edge
         line, so the two lines have to stop at the nose and start
         again past it or they cross. A left-hand one leaves through
         the YELLOW line instead: the corridor's white outer edge is
         behind the through lanes it never touches, and carries on
         unbroken. Suppressing it here — which is what one shared
         `side` used to do — took the entire left edge of I-40 off for
         the length of the wye, because the ramp is nowhere near it and
         every station reads as "not yet separated". */
      const out = r.junction.out != null ? r.junction.out : side;
      /* `junction.i` is the parent station this ramp's station zero
         sits on, which is exactly the seed the first projection wants —
         without it that one call scans all 22,477 stations of the
         corridor looking for a point we already know the answer for. */
      const notSep = noses(r, road, out, !!r.junction.left, r.junction.i);
      /* An exit on the +u carriageway takes the corridor's right-hand
         edge line with it; one on the −u carriageway takes the left. */
      const near = out === side ? r.noPaintL : r.noPaintR;
      addRanges(near, notSep.map((x) => x.i), 0, 12, r.st.length - 1);
      if (out === side) {
        /* ── −1: the two lines OVERLAP at the handover, never abut ─────
           The mainline's outer line and the ramp's are one physical
           line taking turns, and each is laid in 8 px pieces on its own
           road's grid. Those grids do not align, so where the
           suppression starts is up to 8 px away from where the ramp's
           first piece does — and at exit 181 the mainline stopped at
           s=32900 while the ramp began at 32906.3, leaving a 6 px nick
           in the outer line at the gore. Reported from play as the
           lines not touching, and it is at every junction.

           A station of pad the other way makes the mainline paint one
           piece INTO the suppressed zone at each end. There the two
           lines are the same line — measured 121.0 against 121.0 — so
           the overlap cannot be seen and the hole cannot happen. */
        const parList = side > 0 ? road.noPaintR : road.noPaintL;
        addRanges(parList, notSep.map((x) => x.pi).sort((p, q) => p - q),
                  -1, 12, road.st.length - 1);
        r.noPaintR.length = 0;
      } else {
        r.noPaintL.length = 0;
      }
    }
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
  /* NOTE, if this is ever switched back on: the cross-section arrays —
     `aux`, `lanes`, `inner`, `deck` and the rest — are Float64Arrays on
     every road built from a polyline, which is every road on this
     corridor. `Object.freeze` THROWS on a typed array that has
     elements; it cannot make one immutable, because the elements live
     in a buffer rather than as properties. So they are not frozen here
     any more, and a run of this function would silently protect less
     than it reads as protecting. Freezing the buffer means handing out
     a read-only view instead, which is a different design. */
  function freeze() {
    for (const r of W.roads) {
      Object.freeze(r.st);
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
     so it stays right when the shapes change.

     Paint is NOT decided here — see `noses()`. Whether an edge line
     exists is a question about two lines relative to each other, not
     about one line against the other road's surface, and asking it the
     wrong way is what let the freeway's line and the ramp's cross. */
  function dress(a, b, i0, i1, seed) {
    const shL = a.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const shR = a.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const bSh = b.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    const hitL = [], hitR = [];
    let hL = seed != null ? seed : null, hR = hL;
    i0 = Math.max(0, i0); i1 = Math.min(a.st.length - 1, i1);
    const bLen = R.len(b);
    for (let i = i0; i <= i1; i++) {
      const s = i * R.STEP;
      const e = R.edges(a, s);
      /* ── the frame, once ────────────────────────────────────────────
         `R.at(a, s, u)` is the station frame plus an offset along its
         normal, and the frame does not depend on `u`. Called from
         inside the probe it was recomputed for all four of them — four
         heading interpolations and four pairs of trig per station,
         three of each wasted. The four probes differ only in how far
         across they sit, so the frame and its normal are lifted out
         and each probe is two multiplies and two adds. */
      const f = R.frame(a, s);
      const nx = Math.cos(f.h), ny = -Math.sin(f.h);
      const probe = (u, hint, out) => {
        const qx = f.x + nx * u, qy = f.y + ny * u;
        /* ±10 stations, not the default ±72. This walk moves one station
           at a time so the hint is never stale — the projection onto `b`
           can only run ahead of it by the ratio of the two roads' angles,
           which is under two stations even where a ramp is peeling hard
           away. Every ramp in a window is dressed both ways, so this
           window IS the cost of a window slide: at ±20 a rebuild took
           600 ms and the car froze mid-drive for half a second. */
        const pr = R.project(b, qx, qy, hint, hint == null ? 0 : 10);
        if (!pr) return hint;
        if (pr.s > 0 && pr.s < bLen) {
          const eb = R.edges(b, pr.s);
          if (pr.u > eb.uL - bSh - 3 && pr.u < eb.uR + bSh + 3) out.push(i);
        }
        return pr.i;
      };
      /* Probe ACROSS the verge, not just down the middle of it. One
         sample at the centre line of the gravel band means a ramp that
         overlaps the band's inner or outer third is never detected, the
         verge is not suppressed, and the freeway paints a strip of brown
         straight over the ramp beside it.

         The two ENDS of the band are enough, and they are enough for a
         reason rather than by luck: for the band to be covered without
         either end being covered, the other road's whole sealed surface
         would have to fit strictly inside nine pixels, and the narrowest
         thing on this map is a one-lane ramp thirty-six pixels wide.
         There used to be a third sample down the middle, which detects
         strictly less and cost a third of the dressing pass. */
      hL = probe(e.uL - shL - R.VERGE, hL, hitL);
      hL = probe(e.uL - shL - 1, hL, hitL);
      hR = probe(e.uR + shR + 1, hR, hitR);
      hR = probe(e.uR + shR + R.VERGE, hR, hitR);
    }
    addRanges(a.noL, hitL);
    addRanges(a.noR, hitR);
  }

  /* ── where the pavement actually parts ──────────────────────────────
     A gore has ONE line arriving and TWO leaving, and they meet at a
     point. Deciding each of those two lines separately cannot produce
     that: the freeway's line was suppressed while it lay inside the
     ramp, the ramp's while it lay inside the freeway, and those two
     conditions clear a few stations apart — so through the nose there
     was a stretch with both painted, a few pixels apart, crossing. 234
     of the 255 remaining bad stations in a window were exactly this.

     Whether there is a line is not a question about one line and a road.
     It is a question about the two lines: until the ramp's inner edge is
     outboard of the freeway's, they are the same edge of the same
     pavement and there is one line, owned by the ramp. The station where
     they part IS the nose, and suppressing both up to it puts both lines
     on it by construction, at every structure, without anyone measuring
     a nose. The far end is the same thing run backwards — that is the
     merge, where the two become one again.

     Returns the ramp stations where the two have NOT parted. */
  /* `out` is which way across the corridor the ramp leaves, which for
     every right-hand exit is also the carriageway it serves. `left`
     says the two disagree — the ramp is coming off the inside — and
     then the line it has to clear is the yellow one at the edge of the
     median, not the white one on the far side of the through lanes. */
  /* `seed` is where on the parent this ramp's station zero sits, so the
     first projection does not have to scan the whole corridor to find
     out. Everything after it tracks. */
  function noses(rr, par, out, left, seed) {
    const notSep = [];
    let hint = seed != null ? seed : null;
    /* A ramp's cross-section does not vary along it — `edges` returns
       the same two numbers for every station of one — so its own edge
       offset is computed once instead of per station. Anything else
       still asks per station. */
    const near = out > 0 !== rr.mirror;
    const flat = rr.kind === "ramp";
    const edgeOff = (d) => {
      const er = R.edges(rr, d);
      return near ? er.uL + 1 : er.uR - 1;
    };
    const off0 = edgeOff(0);
    const parLen = R.len(par);
    for (let i = 0; i < rr.st.length; i++) {
      const d = i * R.STEP;
      /* The ramp's parent-facing edge line, taken to the world and
         projected back, so no sign convention has to be reasoned about:
         a westbound ramp's own left is the corridor's right. */
      const q = R.at(rr, d, flat ? off0 : edgeOff(d));
      const pr = R.project(par, q.x, q.y, hint, hint == null ? 0 : 12);
      if (!pr) continue;
      hint = pr.i;
      if (pr.s <= 0 || pr.s >= parLen) continue;
      /* Only the line this ramp actually leaves through. `edges` was
         computed whole and then had one of its two halves thrown away
         — and for a left exit, both: the line there is the yellow one
         at the median, which comes from insideAt instead. */
      let parLine;
      if (left) {
        parLine = out > 0 ? -(R.insideAt(par, pr.s) + R.innerAtL(par, pr.s))
                          : R.insideAt(par, pr.s) + R.innerAt(par, pr.s);
      } else {
        const e = R.edges(par, pr.s);
        parLine = out > 0 ? e.uR - 1 : e.uL + 1;
      }
      const gap = out > 0 ? pr.u - parLine : parLine - pr.u;
      if (gap < 2) notSep.push({ i, pi: pr.i });
    }
    return notSep;
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
      /* a's own half-width counts. See reach(): the invariant compares
         envelopes, so a bridge measured on the centreline comes back
         down to grade while its flank is still over the road below. */
      const w = reach(a, i * R.STEP);
      if (pr.u > eb.uL - bSh - w && pr.u < eb.uR + bSh + w) hit.push(i);
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

  /* `flyover()` and `flyoverSpan()` were here, and PLAN.md §4 has
     listed them for deletion since the corridor rebuild began: they
     raised whichever of two CROSSING CORRIDORS painted on top, and
     there are no crossing corridors any more. Nothing has called
     either of them since the fictional map went. The bridges this road
     does have — a ramp over the carriageway, a cross street over the
     lot — are measured where they are built, by overlapRanges() and
     raise() above, against the road they actually stand on. */

  /* `pad` widens each run by a station at both ends, which is what a
     verge wants — better to stop the gravel a station early than to
     leave a tooth of it on somebody's tarmac. Paint wants the opposite
     and passes −1: an edge line that gives up two stations early leaves
     a visible nick in the outer line right at the gore, where the
     freeway's line has stopped and the ramp's has not yet started. */
  /* `pad` widens each run by a station at both ends, which is what a
     verge wants — better to stop the gravel a station early than to
     leave a tooth of it on somebody's tarmac. Paint wants the opposite
     and passes −1: an edge line that gives up two stations early leaves
     a visible nick in the outer line right at the gore, where the
     freeway's line has stopped and the ramp's has not yet started.

     `gap` is how far apart two runs have to be before they count as two.
     Paint wants that larger for the same reason: a line that goes out,
     comes back for half a car length and goes out again reads as a
     fleck of paint dropped on the road, not as a road marking. */
  /* `last` is the final station of the road these belong to, and it is
     what stops a shrink running off the end of one. A ramp's paint is
     suppressed from its station zero — the gore — and shrinking that run
     by a station exposed station zero again: one 8 px tick of white
     line, laid across the mainline it has not left yet, at the gore of
     every structure on the corridor. The same tick appeared at the last
     station, in the merge. A run that reaches the end of the road has no
     neighbour to hand the line to and must keep it. */
  function addRanges(list, idx, pad, gap, last) {
    if (!idx.length) return;
    const p = pad != null ? pad : 1;
    const g = gap != null ? gap : 3;
    const end = last != null ? last : Infinity;
    const push = (a, b) => list.push({
      a: a > 0 ? a - p : 0,
      b: b < end ? b + p : end,
    });
    let a = idx[0], prev = idx[0];
    for (let k = 1; k < idx.length; k++) {
      if (idx[k] - prev > g) { push(a, prev); a = idx[k]; }
      prev = idx[k];
    }
    push(a, prev);
  }

  /* ── the invariant ──────────────────────────────────────────────────
     No two roads may have overlapping sealed surfaces anywhere except
     where they are deliberately joined. Returns the tightest clearance
     found, in world px; negative means two roads are sharing tarmac and
     the world is broken. Exposed so it can be asserted from outside
     rather than eyeballed in a screenshot. */
  function clearance(skipJoins) {
    let worst = Infinity, where = null;
    /* The same envelope the bridge builders measure with — see
       reach(). It was a private copy here, and the copy was the only
       one of the three that was right. */
    const half = halfWidth;
    for (let m = 0; m < W.roads.length; m++) {
      for (let n = m + 1; n < W.roads.length; n++) {
        const A = W.roads[m], B = W.roads[n];
        /* A bridge is SUPPOSED to be over another road; that is what the
           deck test below is for. But scenery is skipped outright rather
           than left to it, because the ends of a cross road come back to
           grade and the invariant is about roads you can drive on. */
        if (A.scenery || B.scenery) continue;
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
          /* Skip the length either side of a legitimate join. Nothing
             useful can be asserted in there and this does not pretend
             otherwise: at a merge the ramp's lanes ARE the parent's
             acceleration lane — the same pavement, by construction —
             so any threshold that let a merge through would let a
             collision through beside it. The invariant is about the
             open road, and that is where it is enforced. */
          if (joined && nearJoin(A, B, s, pr.s)) continue;
          /* ── each road's own facing half, asked in its own frame ──────
             Both halves used to be picked from `pr.u`, which is A's
             centreline measured in B's frame — so B's side came out
             back to front, and A's was inferred from B's sign, which is
             only ever right when the two roads point the same way.

             It cost nothing for as long as a carriageway was symmetric:
             a freeway with the same width either side of its centreline
             returns the same number whichever half you ask for. An
             auxiliary lane makes it asymmetric, and then the test
             measures a ramp on the eastbound shoulder against the width
             of the westbound one. Exit 139B's surveyed ramp at mile
             1194 is 3.2 px clear of the pavement beside it and was
             reported as 17.2 px inside it, purely because a westbound
             deceleration lane had opened across the median.

             B's side is the sign of `pr.u` directly. A's is B's
             centreline resolved along A's own normal, which is one
             point and two trig calls and does not care which way either
             road is pointing. */
          const bq = R.at(B, pr.s, 0);
          const uB = (bq.x - q.x) * Math.cos(q.h) - (bq.y - q.y) * Math.sin(q.h);
          const gap = Math.abs(pr.u) - (half(A, s, uB > 0) + half(B, pr.s, pr.u > 0));
          if (gap < worst) { worst = gap; where = { A: A.kind + A.id, B: B.kind + B.id, sA: Math.round(s), sB: Math.round(pr.s) }; }
        }
      }
    }
    /* ── and nothing drives through the mainline ────────────────────────
       The gap test above cannot ask this, because near a join it has to
       stand down — a ramp at its own merge IS the parent's acceleration
       lane, the same pavement by construction, so no threshold there can
       tell a correct merge from a collision. Widening that window to the
       length the roads are really built alongside each other (see
       nearJoin) therefore buys accuracy at the price of blindness over
       fifteen hundred pixels, and this is what pays for it.

       The question it asks is the one that was actually going wrong: a
       ramp must stay on ITS OWN SIDE of the median unless it is on a
       bridge. Both of today's faults were exactly this and neither was a
       near miss — exit 211B/211A crossed the whole westbound carriageway
       at grade, and a bad heading interpolation threw a generated ramp
       five hundred pixels out and back through the middle of the road.
       Distance from a join says nothing about either. Which side of the
       road you are on says everything. */
    const crossed = [];
    for (const r of W.roads) {
      if (r.kind !== "ramp" || !r.junction || !r.junction.from) continue;
      const par = r.junction.from;
      const own = r.junction.startU > 0 ? 1 : -1;
      let hint = null, worstU = 0;
      for (let i = 0; i < r.st.length; i += 4) {
        const d = i * R.STEP;
        if (R.deckAt(r, d) > 0.5) continue;          // a bridge is allowed to
        const p = r.st[i];
        const pr = R.project(par, p.x, p.y, hint, hint == null ? 0 : 60);
        if (!pr) continue;
        hint = pr.i;
        if (pr.s <= 0 || pr.s >= R.len(par)) continue;
        /* How far onto the other side of the road it has got. Being
           there is not by itself wrong — a ramp that has crossed on a
           bridge comes back down in the field beyond the far verge and
           runs its frontage there, which is most of the interchanges on
           this corridor. What is wrong is being on the far carriageway's
           TRAVEL LANES, so both ends of that are tested: past the median
           and its inside shoulder, and still on sealed surface. Half a
           lane of slack at the near end, because a ramp crossing a
           barrier median passes through it and the median is 4 px wide
           where there is a barrier in it. */
        const far = -(own * pr.u);
        const e = R.edges(par, pr.s);
        const outer = (own > 0 ? -e.uL : e.uR) + R.SH_OUT;
        if (far < R.insideAt(par, pr.s) + R.LANE / 2 || far > outer) continue;
        if (far > worstU) worstU = far;
      }
      if (worstU > 2) crossed.push({ ramp: r.exitRef || r.stopName || (r.kind + r.id),
                                     px: Math.round(r.corridorPx || 0), by: Math.round(worstU) });
    }
    return { worst: worst === Infinity ? null : +worst.toFixed(1), where, crossed };
  }

  /* Every ramp here has TWO legitimate joins with its parent — the gore
     it leaves by and the merge it comes back on — and this used to
     return on the first condition that matched. Since `A.parent === B`
     matches at once, no ramp's merge end was ever excused, so the
     invariant reported the half-lane overlap that every merge is built
     to have as its worst clearance: −46 px, on a road that is correct.
     Both ends are tested now, on both roads' coordinates. */
  function nearJoin(A, B, sA, sB) {
    /* How long a ramp and its parent are BUILT to share pavement: the
       gore wedge, plus the stations over which the parent's own
       deceleration lane closes up behind it. It was a flat 340, which is
       less than R.GORE alone — so the last twenty pixels of every gore,
       and the whole of the wedge past it, were reported as two roads
       illegally sharing tarmac. Derived now, so it stays right if either
       constant moves.

       ── and the wedge was the wrong half of it ────────────────────────
       R.WEDGE is how fast the parent's auxiliary lane CLOSES. How long
       the two roads are actually built alongside each other is the
       auxiliary lane's own length, which is what both builders hand to
       openAux and closeAux: 150 stations, 1,200 px, a quarter of a mile
       of parallel merge. At the 680 px this used to be, three ramps on
       the corridor were still inside their parent's shoulder when the
       window ran out — at 692, 794 and 811 px — and were reported as
       faults for doing exactly what a gore is. Widening the window is
       not a loosening: inside it the pair is now asked the harder
       question, not excused the easy one. See clearance(). */
    const P = R.GORE + R.MERGE * R.STEP;
    const atGore = (r, other, sr, so) => r.parent === other
      && (sr < P || (r.junction && Math.abs(so - r.junction.s) < P));
    const atMerge = (r, other, sr, so) => r.merge && r.merge.into === other
      && (R.len(r) - sr < P || Math.abs(so - r.merge.s) < P);
    return atGore(A, B, sA, sB) || atGore(B, A, sB, sA)
        || atMerge(A, B, sA, sB) || atMerge(B, A, sB, sA);
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
    if (r.kind === "freeway") {
      const mw = R.medAt(r, s);
      /* A barrier median is something you hit; a wide one is something
         you end up in. Sixty feet of grass between the carriageways is
         not a wall, so past the width where a barrier stops being built
         the middle of the road answers as field. */
      if (u > -mw && u < mw) {
        if (mw <= R.MED_BARRIER) return "barrier";
        /* Grass, except for the rail down the middle of it if there
           is one — which is the whole reason cable barrier is there. */
        const rw = R.medRailAt(r, s);
        return rw > 0 && u > -rw && u < rw ? "barrier" : "grass";
      }
    }
    if (r.kind === "freeway") {
      /* Each carriageway's inside shoulder, plus anything a left exit
         has widened it by. Not symmetric: the lane drop happens on one
         side of the median, and on I-40 that side is westbound. */
      const innerL = -(R.insideAt(r, s) + R.innerAtL(r, s));
      const innerR = R.insideAt(r, s) + R.innerAt(r, s);
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
      /* Scenery is not a surface. A cross road is drawn so an exit looks
         like an interchange, and it leads off this corridor — which the
         whole game is built on you not being able to do. Refusing it
         here is the one place that has to hold: this function is what
         decides what is under the wheels, and everything else that could
         hand you a road (the gore and merge handovers) walks a parent's
         `exits`, which scenery is never in. Steer at it and you leave
         the road, which is what a fence would do. */
      if (r.scenery) continue;
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
      /* ── a road that is not there does not outrank one that is ───────
         `grass` is what a road says about a point that is not on it —
         past the verge, off the end of the section, in the field beside
         it. That is an absence, and an absence must not win on height:
         with `d * 10` below, a ramp on the approach to a flyover, half a
         deck up and eighty pixels sideways, reported grass with a rank
         of 4.2 and beat the carriageway underneath it reporting LANE at
         4.0. What the player felt was the road vanishing from under the
         car as a bridge went over. `best` already falls back to grass
         when nothing claims the point, so dropping these costs nothing
         and is the whole fix. */
      if (what === "grass") continue;
      /* Height first, then how good the surface is. This used to be
         `r.elev * 10`, which — elev being unique per road — meant the
         highest-numbered road present always won outright, so a road
         reporting GRASS could beat a road reporting LANE purely for
         having been built later. The only thing keeping that honest was
         the 260 px range cut. Ranking on a real height means roads at
         the same level now compete on what they actually are. */
      /* ── and the height is a LEVEL, not an altitude ──────────────────
         `d * 10` made a road on a grade beat everything under it in
         proportion to how far up the grade it was, which is not a
         question anybody is asking: the deck test one line above
         already treats 0.5 as the line between "same level as you" and
         "somebody else's problem", and this has to agree with it or the
         two disagree exactly on the approach to every flyover. A ramp
         two tenths of a deck up, still descending, with the car eight
         pixels inside its gravel, outranked the carriageway the car was
         actually driving on. Rounded, it is at the level it is nearer
         to, and it competes there on what it is. */
      const rank = Math.round(d) * 10 + RANK[what];
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
  /* `nextExit()` was here. It answered "which interchange is the car
     coming up on" and its only caller was traffic.js, deciding whether
     a car should start moving right — see PLAN.md §3, which records
     that traffic used exactly four things from this file and this was
     one of them. Traffic is coming back and will want it again; it is
     nine lines and it will be written against the exit list traffic
     actually needs, rather than kept warm for a year on the assumption
     that this shape was the right one. */

  return {
    state: W,
    reset, update, surface, clearance, nearby, locate, MILE,
    buildWindow, marker, stateAt, setStart,
    corridorPx: (road, s) => (road && road.baseS || 0) + s,
    get roads() { return W.roads; },
    get main() { return W.main; },
    get junctions() { return W.junctions; },
  };
})();
