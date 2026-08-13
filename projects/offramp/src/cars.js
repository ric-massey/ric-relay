/* ══════════════════════════════════════════════════════════════════════
   The traffic, on the road you can see.

   This file owns nothing about how anybody drives. `traffic.js` says how
   many vehicles there are and who is driving them, `sim.js` steps them
   and `motive.js` decides when one changes lane; all three are judged
   headless by `test/sim.test.js` and `test/motive.test.js`, and none of
   them has ever been allowed to know there is a screen. That separation
   is the point and it is worth restating here, because this is the file
   that would quietly undo it:

     TRAFFIC BEHAVIOUR IS NEVER DEBUGGED THROUGH THE GAME VIEWPORT.

   If the cars look wrong, the thing to change is a motive and the thing
   to check it with is the scoreboard. What belongs here is only the
   three jobs the harness cannot do because it has no map:

     · keep a band of simulated road travelling with the player
     · put each vehicle's (s, lane) onto the corridor's real geometry
     · hand the player back the other way, as one more vehicle

   ── the coordinate that joins the two halves ──────────────────────────
   Everything meets at CORRIDOR PIXELS. The sim measures `s` in metres
   from where its world was made; the road measures `s` in world pixels
   from where the current twenty-mile window begins; and the window is
   rebuilt out from under both of them every four miles. Corridor px is
   the only quantity that survives all of that, so it is the one this
   file converts through — never sim-s to road-s directly.

       corridor px  =  w.pxAt(v.s)                 (sim -> corridor)
       road s       =  corridor px − road.baseS    (corridor -> road)

   The window rebuild then costs nothing: `baseS` changes, the corridor
   px does not, and the traffic does not so much as flinch.

   ── the two carriageways ──────────────────────────────────────────────
   Two sim worlds, not one. They share a corridor and nothing else — the
   oncoming carriageway is a different direction, a different demand off
   the counters and a different set of drivers, and the median means the
   two populations can never interact. Running them as one world would
   have meant teaching sim.js about a median, which is a fact about a map.
   ══════════════════════════════════════════════════════════════════════ */
const Cars = (() => {
  "use strict";

  const M_PER_PX = 0.179;
  /* Lexical, not off globalThis: index.html loads these as classic
     scripts, and a top-level `const` there is a script-scope binding
     that never becomes a property of the global object. `typeof` is the
     only test that works in both places — which is why road.js and
     world.js have no module.exports and the tests load the lot into one
     vm context, exactly as the browser does. */
  const TR = typeof Traffic !== "undefined" ? Traffic : null;
  const SM = typeof Sim !== "undefined" ? Sim : null;
  const MO = typeof Motive !== "undefined" ? Motive : null;

  /* How much road is simulated around the player. The view is about 660
     px — 118 m — so both of these are far beyond anything drawn; what
     they are sized for is that traffic should already be doing whatever
     it is doing by the time it comes into sight. AHEAD is the larger
     because at 190 km/h the player closes on it at 50 m/s, and a car
     that appears 300 m ahead has appeared. */
  const BACK = 900, AHEAD = 1500;                  // metres

  /* The vehicle you drive, in metres and kilograms, and it is whatever
     is in the garage now rather than one car.

     It used to be the sprite: 26 x 11 world px at 0.179 m a px, and a
     flat 1500 kg. Both are properties of a specific vehicle, and there
     are ten. They are held here as mutable module state, set once when
     a run starts, because the traffic sim asks for the player's body
     several times a frame and threading three more arguments through
     `setPlayer` would put the garage inside a hot loop for no reason.

     It genuinely matters to the traffic, which is why it is not merely
     cosmetic: `len` decides what gap you fit into and when `room` will
     let somebody merge across you, and `m` is the mass `impact.js`
     solves every contact with. A 5.89 m pickup does not fit where a
     2.05 m motorcycle does, and nothing anywhere had to be told so.

     The defaults are the old sprite's dimensions written the old way —
     26 x 11 world px at 0.179 m a px — and NOT rounded to 4.65 x 1.97.
     Every scoreboard figure in sim.test.js is held to an
     eleven-configuration fingerprint, and 4 mm of vehicle length is
     enough to move one. A default has to reproduce, exactly. */
  const DEF_L = 26 * M_PER_PX, DEF_W = 11 * M_PER_PX, DEF_M = 1500;
  let PL = DEF_L, PW = DEF_W, PM = DEF_M;

  /* Called by offramp.js when the run's vehicle is chosen. Safe to call
     with nothing, which restores the old single car — the tests that
     predate the garage rely on that default. */
  function setVehicle(v) {
    PL = v && v.len  ? v.len  : DEF_L;
    PW = v && v.wide ? v.wide : DEF_W;
    PM = v && v.kg   ? v.kg   : DEF_M;
  }

  /* Corridor pixels to metres along `mine`'s own s. The one conversion
     everything in this file goes through — see the header. */
  const simS = (px) => (px - origin) * dirSign * M_PER_PX;

  /* The sim runs at a fixed 10 Hz, which is the rate both trajectory
     datasets were published at and the rate every number in
     BEHAVIOUR.md was measured against. The game does not, so time is
     accumulated and spent in whole ticks. Never step it at the frame
     rate: that would make the model's answers depend on the machine. */
  const TICK = 0.1;
  /* A frame that has been away — a tab in the background, a window
     rebuild, a breakpoint — must not be repaid in full. Sixty seconds of
     arrears at 10 Hz is six hundred steps in one frame, which is a
     freeze, and the traffic it produces is traffic nobody saw happen. */
  const MAX_CATCHUP = 6;                           // ticks per frame

  let mine = null, theirs = null;                  // the two sim worlds
  let acc = 0, origin = 0, dirSign = 1, ready = false;
  let lastPx = 0, lastV = 0;
  const out = [];                                  // drawables, reused

  /* ── starting ─────────────────────────────────────────────────────── */

  /* `px` is where on the corridor the run begins, `fwd` which way the
     sign said. Both worlds are anchored at the same origin so that one
     conversion serves both; the oncoming one simply counts its metres
     the other way, which is what `dir` has always meant in sim.js. */
  function start(px, fwd, when, state, seed) {
    if (!SM || !TR || !MO) { ready = false; return false; }
    origin = px;
    dirSign = fwd ? 1 : -1;
    lastPx = px; lastV = 0;
    acc = 0;
    passed = 0; wasAhead.clear();
    /* ── how many of them are leaving ─────────────────────────────────
       `sim.js` decides a tenth per junction, which is the usual planning
       figure for ramp volume against a mainline. That figure assumes an
       interchange every few miles. THIS corridor has one every 1,420 m,
       so a tenth means a tenth of the traffic peeling off every 0.88
       miles — and every one of them crossing to the outside lane to do
       it.

       It shows in the one number nothing in the model is told. Measured
       over the corridor's own junction spacing:

         exitShare 0.10 -> 0.509 lane changes per vehicle-km  (+38%)
         exitShare 0.06 -> 0.431                              (+17%)
         exitShare 0.05 -> 0.392                              ( +6%)
         exitShare 0.02 -> 0.320                              (-14%)

       against BEHAVIOUR.md's measured 0.37. So the share is not chosen
       by eye, it is the value at which the emergent rate lands on the
       drone's — a decided constant pinned by a measured one, which is
       the only way this project is allowed to set it. The share of
       drivers who get off, having tried, is unmoved at 81–85%.

       Reported from play as the traffic moving about too much, and it
       was: the road was changing lanes 38% more often than a real one.
       The harness keeps its own 0.10 — §8 passes it explicitly and every
       number there was measured with it. */
    const EXIT_SHARE = 0.05;

    const common = {
      px, when: when || clock(), state: state || null,
      decide: MO.decide, junctions: junctions(), exitShare: EXIT_SHARE,
      roam: { back: BACK, ahead: AHEAD, at: 0 },
    };
    mine = SM.world(Object.assign({}, common, {
      dir: dirSign, seed: seed == null ? 1 : seed,
      lanes: lanesAt(px, fwd),
    }));
    theirs = SM.world(Object.assign({}, common, {
      dir: -dirSign, seed: (seed == null ? 1 : seed) + 7919,
      lanes: lanesAt(px, !fwd),
    }));
    ready = true;
    return true;
  }

  function stop() { mine = theirs = null; ready = false; out.length = 0; }
  const running = () => ready;

  /* The corridor's own lane count where the run starts. sim.js holds the
     count fixed for the life of a world and this map does not — see
     `KNOWN GAPS` at the foot of this file. */
  function lanesAt(px, fwd) {
    const n = TR ? TR.lanes(px) : 4;
    return Math.max(2, Math.min(6, Math.round(n)));
  }

  /* Every interchange on the corridor, which is what `exit`, `merge` and
     `yield`'s merge half all read. Positions only — the harness has
     never needed ramp geometry and does not get it here either. */
  function junctions() {
    return (typeof I40 !== "undefined" && I40 && I40.exits)
      ? I40.exits.map((e) => e.px) : null;
  }

  /* Time of day and day of week are what `traffic.js` keys the counters
     on, so a run at five on a Friday really is Knoxville at five on a
     Friday. Taken from the wall clock, because the alternative is a
     number nobody chose. */
  function clock() {
    const d = new Date();
    return { dow: d.getDay(), hour: d.getHours(), month: d.getMonth() + 1 };
  }

  /* ── stepping ─────────────────────────────────────────────────────── */

  /* `px` is the player's position on the corridor, and that is all this
     is told. The band's speed is how fast it is travelling ALONG THE
     CORRIDOR, which is not the speedometer — on a ramp you can be doing
     100 km/h and gaining almost nothing on the freeway — so it is
     differenced here, where there is one answer instead of two that can
     drift apart. Smoothed over a third of a second because a single
     frame's difference is mostly jitter, and because how much traffic
     crosses an edge should not flicker. */
  const TAU_V = 0.3;                               // s
  /* ── the player, as one more vehicle ──────────────────────────────
     Handed to the sim before it steps, so every driver's picture of the
     road already has the player in it when they are asked what they
     want. `me` is null whenever the player is not on the mainline — down
     a ramp, at a truck stop, or wrecked off the carriageway — and the
     body is taken out of the index rather than left standing in a lane
     nobody can see them in. */
  /* ── and which carriageway they are actually on ───────────────────
     The player was piloted into `mine` and only `mine`, so the oncoming
     carriageway could not see them at all. Measured by driving the wrong
     way down it: **557 vehicle-frames with an oncoming car's body inside
     the player's, and not one contact registered.** You could drive
     through them.

     Both worlds get told, and which one holds the body is decided by
     the sign of `u`: the player's own carriageway is the positive-u side
     when they are going the way the road was built, and the negative one
     when they took the WEST sign. In the other world the same car is
     travelling BACKWARDS — its `s` counts the other way and so does its
     speed — which is what makes a head-on a head-on rather than a
     stationary obstacle. */
  /* ── and how fast they are crossing it ──────────────────────────────
     `vu` is the player's lateral velocity in road px/s — `S.vu`, the
     same number `scrapeWall` hands the barrier solver. The model wants
     it in metres per second along its own `lane` axis, and the
     conversion falls straight out of `laneAt`:

       lane = best + (u − c) / R.LANE × (dirFwd ? 1 : −1)

     so d(lane)/dt is `vu / R.LANE` signed by the direction, and a lane
     is `LANE_W` metres wide. R.LANE × M_PER_PX is that width to within
     0.8%, which leaves the whole conversion as `pxs2ms(vu)` with a
     sign — and the sign is whatever `laneAt` was passed for that world,
     which is `fwd` for mine and `!fwd` for theirs. */
  const pxs2ms = (v) => v * M_PER_PX;
  const ms2pxs = (v) => v / M_PER_PX;
  /* Which way round the carriageway was when the body was last handed
     over, so `contacts()` can undo the conversion `setPlayer` did. */
  let lastFwd = true;

  function setPlayer(road, rs, u, fwd, vms, braking, vu) {
    if (!ready) return;
    lastFwd = !!fwd;
    if (!road || rs == null) { mine.pilot(null); theirs.pilot(null); return; }
    const R = Road;
    const px = road.baseS + rs;
    const s = simS(px);
    const body = { len: PL, w: PW, m: PM, braking: !!braking };
    const lat = pxs2ms(vu || 0);
    /* Positive u is my side when I am going the way the road runs. */
    const onMine = (u > 0) === !!fwd;
    if (onMine) {
      mine.pilot(Object.assign({ s: s + PL / 2, v: vms,
        lane: laneAt(road, rs, u, fwd), vy: lat * (fwd ? 1 : -1) }, body));
      theirs.pilot(null);
    } else {
      mine.pilot(null);
      /* Their metres run the other way, so the nose is at the other end
         and the speed is negative — the player is going backwards
         through this world, which is exactly what they are doing. The
         lateral axis turns over with it. */
      theirs.pilot(Object.assign({ s: -s - PL / 2, v: -vms,
        lane: laneAt(road, rs, u, !fwd), vy: lat * (fwd ? -1 : 1) }, body));
    }
  }

  /* ── the road's own width, handed to both worlds ──────────────────
     The corridor changes lane count 732 times in 2,551 miles and used to
     do it without the traffic being told, so a vehicle the model had in
     lane 4 got drawn in lane 3 on a three-lane stretch — on top of
     whatever was already there. Called every step, and `setLanes`
     returns immediately when nothing has changed, which is almost
     always. */
  function fitLanes(road, rs, fwd) {
    if (!ready || !road || !road.corridor) return;
    const R = Road;
    mine.setLanes(R.laneCount(road, rs, fwd));
    theirs.setLanes(R.laneCount(road, rs, !fwd));
  }

  /* Anything the player was part of since the last call. The game
     decides what it costs them; this only carries it across. */
  function contacts() {
    if (!ready) return null;
    const a = mine.drainHits(), b = theirs.drainHits();
    /* A hit taken in the oncoming world is a head-on, whatever the
       geometry says. In that world's frame the player is travelling
       backwards, so a car coming straight at them arrives from BEHIND
       and `sim.js` honestly reports a rear-end — which is the right
       answer to the question it was asked and the wrong thing to tell
       the driver. Tagged here, where which carriageway it was is known. */
    if (b) for (const h of b) h.oncoming = true;
    /* ── and the sideways shove, back in the road's own units ─────────
       `setPlayer` turned `S.vu` into the model's lateral axis with a
       sign that depends on the carriageway; this is the same trip in
       reverse, with the same sign, so the two cannot drift apart. The
       game gets a px/s it can put straight into `S.vu` — which is
       exactly the shape `scrapeWall` already gets from the barrier. */
    const back = (list, sign) => {
      if (!list) return;
      for (const h of list) {
        if (typeof h.vyAfter === "number") h.vuAfter = ms2pxs(h.vyAfter) * sign;
        if (typeof h.dvLat === "number") h.dvu = ms2pxs(h.dvLat) * sign;
      }
    };
    back(a, lastFwd ? 1 : -1);
    back(b, lastFwd ? -1 : 1);
    return a && b ? a.concat(b) : (a || b);
  }

  function update(dt, px) {
    if (!ready) return;
    if (dt > 0) {
      const raw = Math.abs(px - lastPx) * M_PER_PX / dt;
      const a = Math.min(1, dt / TAU_V);
      lastV += (Math.min(raw, 90) - lastV) * a;
    }
    lastPx = px;
    const s = (px - origin) * dirSign * M_PER_PX;
    /* The oncoming world counts its metres the other way, so the same
       band travels BACKWARDS through it. Passing +lastV to both was the
       one sign error in this file and it emptied the 900 m behind the
       oncoming band while packing everything in from the front. */
    mine.follow(s, lastV);
    theirs.follow(-s, -lastV);

    acc += Math.min(dt, 0.5);
    let n = 0;
    while (acc >= TICK && n < MAX_CATCHUP) { mine.step(); theirs.step(); acc -= TICK; n++; }
    if (acc > TICK) acc = 0;                       // arrears written off
    countPasses();
  }

  /* ── how many you have got past ─────────────────────────────────────
     A run's tally of vehicles OVERTAKEN, counted on your own
     carriageway only. The oncoming side is excluded deliberately: on a
     divided highway you pass a thousand of those without doing
     anything, and a number that goes up while you sit still is not a
     number about you.

     Counted as a transition rather than a comparison — a vehicle has to
     have been genuinely ahead and then be genuinely behind — so a car
     sitting level with you at a closing speed of nothing cannot tick
     the counter over and over. `id` is the sim's own, stable for the
     life of a vehicle, and the set is pruned against `live` so that a
     vehicle which left the band cannot be counted if it comes back. */
  let passed = 0;
  const wasAhead = new Set();

  function countPasses() {
    const me = mine.live.find((v) => v.piloted);
    if (!me) return;
    const here = new Set();
    for (const v of mine.live) {
      if (v.piloted) continue;
      here.add(v.id);
      /* Nose to nose, so a lorry is not "passed" the moment its cab is
         level with you while thirteen metres of trailer still are not. */
      if (v.s - v.len > me.s) wasAhead.add(v.id);
      else if (v.s < me.s - me.len && wasAhead.has(v.id)) {
        passed++;
        wasAhead.delete(v.id);
      }
    }
    for (const id of wasAhead) if (!here.has(id)) wasAhead.delete(id);
  }

  /* ── putting them on the road ─────────────────────────────────────── */

  /* Everything the drawing needs and nothing it does not. Rebuilt into
     one reused array every frame: at four hundred vehicles a frame,
     sixty times a second, allocating a record each would be the most
     garbage this game makes by an order of magnitude. */
  /* ── between the ticks ────────────────────────────────────────────
     The model runs at 10 Hz because that is the rate its evidence was
     published at, and the game draws at 60. Left alone, every vehicle
     jumps 2.8 m and then stands still for five frames while the player's
     own car moves smoothly past it — which reads as the traffic
     stuttering, and it was.

     So the DRAWING carries each vehicle forward by however much of a
     tick has gone by. This is presentation and nothing else: it is
     applied on the way out, the model never sees it, and no decision
     anywhere is made on an extrapolated position. Forward rather than
     interpolated between two ticks, because interpolating means holding
     the picture a tick behind the simulation to have something to
     interpolate towards, and a tenth of a second of latency on the car
     you are about to hit is worse than the stutter was.

     Lateral is smoothed rather than extrapolated. A lane change is the
     one motion whose rate is not constant — it eases in and out — so
     running it forward at its current rate overshoots at exactly the
     moment the car is crossing the line in front of you. */
  const LAT_TAU = 0.06;                            // s
  const shownLane = new Map();

  function visible(road, fwd, reach, dt) {
    out.length = 0;
    if (!ready || !road || !road.corridor) return out;
    const R = Road;
    const half = reach || 1200;                    // world px either side
    const here = lastPx;
    /* How far into the current tick we are. Clamped because a frame that
       has been away must not fling everything down the road. */
    const alpha = Math.max(0, Math.min(TICK, acc));
    const k = Math.min(1, (dt || 1 / 60) / LAT_TAU);
    collect(mine, road, fwd, here, half, R, alpha, k);
    collect(theirs, road, !fwd, here, half, R, alpha, k);
    /* Anything that has left the road stops being remembered, or the map
       grows for the length of the drive. */
    if (shownLane.size > 4000) shownLane.clear();
    return out;
  }

  function collect(w, road, dirFwd, here, half, R, alpha, k) {
    const live = w.live;
    const lo = road.baseS, hi = lo + R.len(road);
    for (let i = 0; i < live.length; i++) {
      const v = live[i];
      /* The player's own body is in `live` — that is the entire point of
         it — and it must never be DRAWN, because offramp.js already
         draws the car it belongs to. Left in, it painted a second
         vehicle exactly on top of the player, shadow and all, which is
         what "a weird shadow on the car" turned out to be. */
      if (v.piloted) continue;
      /* ── `s` is the FRONT BUMPER, and a sprite is drawn about its
         CENTRE ──────────────────────────────────────────────────────
         sim.js measures a vehicle by its nose: `neigh` returns
         `lead.s - lead.len - s` for the gap, and `contact` takes
         `s - len/2` when it wants the middle. Handing `s` straight to
         the renderer therefore put every vehicle half a body-length too
         far forward — which is invisible between two cars, because they
         both move by the same 3 m, and glaring the moment two lengths
         differ.

         The drawn gap came out wrong by exactly (lenLead − lenMe)/2:
         measured live, −7.7 m to +7.8 m against a model gap that was
         correct throughout. An articulated lorry following a car was
         drawn seven and a half metres closer than it was, with its nose
         inside the car in front. That is "the cars touch each other a
         lot", and the traffic was never doing it — `stat.conflicts` is
         0 in the same runs. */
      const px = w.pxAt(v.s - v.len / 2 + v.v * alpha);
      if (px < here - half || px > here + half) continue;
      const rs = px - lo;
      if (rs < 1 || rs > hi - lo - 1) continue;

      /* The lane index is the one thing the two halves number
         differently, and it is worth being explicit rather than clever:
         sim.js counts lane 1 as the left-hand lane of the carriageway,
         road.js counts lane 0 as the one nearest the middle of the road.
         On a right-hand-drive corridor those are the same lane, so the
         conversion is a subtraction — and `v.lane` is FRACTIONAL while a
         manoeuvre is in progress, which is exactly what makes a lane
         change something you watch rather than something that happens
         between two frames. */
      /* A guard now rather than a correction: the world is told the
         road's own lane count every step, so nothing should be outside
         it. What is left is the half-lane either side of a manoeuvre. */
      const nLane = R.laneCount(road, rs, dirFwd);
      /* Eased toward where the model put it, so the ten-hertz steps
         across the road do not read as a twitch. The key carries the
         carriageway because the two worlds number their vehicles
         independently and ids collide. */
      const key = (dirFwd ? "m" : "t") + v.id;
      let sm = shownLane.get(key);
      if (sm == null || Math.abs(sm - v.lane) > 1.5) sm = v.lane;   // new, or teleported
      else sm += (v.lane - sm) * k;
      shownLane.set(key, sm);
      const lane = clamp(sm - 1, 0, Math.max(0, nLane - 1));
      const u = R.laneU(road, rs, lane, dirFwd);
      const p = R.at(road, rs, u);

      out.push({
        x: p.x, y: p.y,
        /* Facing along the road, and the oncoming carriageway faces the
           other way down the same centreline. */
        h: dirFwd ? p.h : p.h + Math.PI,
        kind: v.kind, len: v.len, w: v.w,
        /* Cosmetic: 0..1 of accumulated scraping and which flank took
           it. Carried so a carriageway that has been shunted around for
           ten minutes does not look showroom-fresh. */
        scuff: v.scuff || 0, scuffSide: v.scuffSide || 0,
        v: v.v, brake: v.a < -0.8 || !!v.wreck,
        /* Half of all lane changes are made with no indicator at all and
           half of the rest are late — measured (Ponziani 2012 and
           NHTSA), cited in BEHAVIOUR.md, and this is the only place in
           the game where any of it is ever visible. A late signal lights
           after the car has already started moving, which is what makes
           it worth distinguishing from no signal at all: you see the
           movement first and the lamp second.

           +1 is a lamp on the driver's right. `to > from` is a move
           outward on both carriageways, because sim.js numbers lanes
           from the left of the direction of travel either way. */
        blink: blinker(v),
        wreck: !!v.wreck, id: v.id, mine: dirFwd,
        deck: R.deckAt ? R.deckAt(road, rs) : 0,
      });
    }
  }

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

  /* DECIDED, and only this: a late signal comes on a third of the way
     through the manoeuvre. BEHAVIOUR.md's sources say how many drivers
     signal late and none of them says how late, because no trajectory
     set records a lamp. */
  const LATE = 0.33;
  function blinker(v) {
    if (!(v.phase > 0) || !v.signal || v.signal === "none") return 0;
    if (v.signal === "late" && v.phase < LATE) return 0;
    return v.to > v.from ? 1 : -1;
  }

  /* ── what the tests and the debug overlay ask ─────────────────────── */
  function stats() {
    if (!ready) return null;
    const b = mine.band();
    return {
      mine: mine.live.length, theirs: theirs.live.length,
      lanes: mine.nLanes, band: b, px: lastPx, v: lastV,
      shown: out.length,
    };
  }

  /* Which lane on the corridor a point across the road falls in, in the
     sim's numbering — 1 at the left of the direction of travel. The
     inverse of what `collect` does on the way out, and it has to be the
     inverse rather than an approximation of it: a player half a lane
     out is a player the traffic beside them can hit. */
  function laneAt(road, rs, u, dirFwd) {
    const R = Road;
    const n = R.laneCount(road, rs, dirFwd);
    let best = 1, bd = Infinity;
    for (let L = 0; L < n; L++) {
      const d = Math.abs(u - R.laneU(road, rs, L, dirFwd));
      if (d < bd) { bd = d; best = L + 1; }
    }
    /* Fractional, so straddling a line reads as straddling one — and
       DELIBERATELY NOT CLAMPED to [1, n].

       It used to be clamped, and that was the bug where you could not
       pass anybody on the left shoulder: out there your true position
       is below 1, the clamp reported it as exactly 1, and `sim.js`'s
       `index()` filed you squarely in lane 1. Traffic in lane 1 then
       treated a car that was not on the carriageway at all as an
       obstacle in its lane, and drove into it.

       Unclamped, `index()` already does the right thing with no change
       of its own, because it buckets a body into every lane its WIDTH
       overlaps rather than into the lane it rounds to:

         lane  0.3   half on the shoulder  → overlaps lane 1 only  ✓
         lane −0.5   fully on the shoulder → overlaps nothing      ✓
         lane  1.5   straddling 1 and 2    → overlaps both         ✓

       So being beside the road stops meaning being in the nearest lane,
       and half in still counts as half in. `pilot()` in sim.js is the
       other half of this and says so. */
    const c = R.laneU(road, rs, best - 1, dirFwd);
    const off = (u - c) / R.LANE * (dirFwd ? 1 : -1);
    return best + off;
  }

  return { start, stop, running, update, visible, stats,
           setPlayer, setVehicle, contacts, laneAt, fitLanes,
           passed: () => passed,
           BACK, AHEAD, TICK,
           origin: () => origin, dir: () => dirSign,
           simS,
           worlds: () => ({ mine, theirs }) };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Cars;

/* ── KNOWN GAPS, listed rather than papered over ───────────────────────
   · The lane count is fixed for the life of a sim world and the corridor
     changes its mind about it — 732 times over 2,551 miles. A vehicle in
     a lane the road does not have here is clamped to the outermost one
     that exists, which puts two cars in one lane rather than one car on
     the grass. The honest fix is `lane drop`, which is one of the three
     junction motives §5c has stubbed.
   · Nobody is on a ramp. The band is mainline only, so the traffic
     leaving at a gore vanishes at it and the traffic joining appears on
     the carriageway. `merge`'s remaining half is where that is fixed.
   · The player is not yet in either world — see task 5. Until then the
     traffic drives around a road with nobody on it, and `yield` has
     nothing to yield to.
   ─────────────────────────────────────────────────────────────────── */
