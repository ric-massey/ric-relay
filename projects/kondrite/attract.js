/* KONDRITE — THE FRONT PAGE IS A RUN
   ═════════════════════════════════════════════════════════════════════════════
   The art behind the title. Not a diorama — `menu.js` says what one of those is
   and why, and the whole of that contract is *closed form*: every card scene is
   a function of one clock, nothing accumulates, nothing collides, nothing can
   get into a state. That is right for a picture 174 pixels tall behind a button.

   It is wrong for a whole page. Ric, on the version that came before this one:

     "the main page for Kondrite the backround needs an update i want it to be
      the starting ship flying around shooting astroids with the ocasional star
      slingshot or black hole slingshot. and maybe passing a station and a few
      other ships. flying around maybe getting into the fight."

   Every noun in that is a thing that has to *happen*, and none of them can be a
   sine. A rock you shoot has to break; a slingshot is a trajectory bent by a
   mass and there is no way to fake the moment it lets go; a fight has two sides
   that both have to decide something. So this file breaks the diorama rule on
   purpose and simulates: there is a ship out there with a position and a
   velocity, a field of rocks that can be destroyed, rounds in the air, a gravity
   well that pulls on all three, and a pilot flying it who wants things.

   ── it is the game's model, not a model of it ───────────────────────────────
   Every constant below is copied from index.html rather than invented, because
   the failure mode of art-that-looks-like-a-game is that it moves wrong and
   nobody can say why. TURN is 3.2 because a Kondrite ship turns at 3.2. Gravity
   is `mass / (d² + soft²)` with the star's own mass and softening, so a pass at
   a hundred and fifty units bends by exactly as much as it would if you flew it.
   The speed cap, the thrown-boost allowance and its slow bleed are the survey
   rules verbatim — which is what makes the slingshot read: you come out of a
   black hole at three times your engine's top speed and spend the next ten
   seconds coasting it off, and that is not a flourish, that is `THROWN_CEILING`.

   The hulls are the game's own. `init` is handed `drawHullArt` and the real
   `HULL_ART` table, so the ship on the front page is the Skiff — the one you
   actually start in — drawn by the same function that draws it in flight.

   ── the director ────────────────────────────────────────────────────────────
   A simulation left alone is a screensaver, which is the thing the last version
   was accused of being. So a pilot with goals, and a director handing out the
   goals from a shuffled bag: a star to whip round, a black hole to whip round,
   a station to call at, a fight to get into, with rock-breaking in between and
   traffic crossing the whole time. Every element Ric asked for is in the bag, so
   every element is guaranteed to turn up inside about a minute and a half rather
   than being left to dice that might never roll it.

   ── the rules it still keeps ────────────────────────────────────────────────
   No shadowBlur, same as `glow()`. Everything is strokes except a star's disc
   and a hole's, which are the only two fills in this game. And nothing here can
   die — not the pilot, whose hull mends and who breaks off a fight it is
   losing, and not the page, which has no state a reload would fix. A front page
   with a wreck on it is a front page that has gone wrong.                     */

(function () {
  "use strict";

  const A = {};
  let api = null;          // { ctx, glow, hull, hulls } — see `init`

  /* ── the palette, from the game ──────────────────────────────────────────── */
  const AMBER   = "#ffe56d";
  const AMBER_D = "#ffcb42";
  const FLASH   = "#fff2bf";
  const WARN    = "#ff8f77";
  const CASH    = "#6dffbf";
  const RAIDER  = "#ff3b6b";

  /* ── the game's flight model, verbatim ───────────────────────────────────── */
  const TURN       = 3.2;     // rad/s — not scaled; turning is ergonomic
  const THRUST     = 380;
  const DRAG       = 0.42;    // what an engine works against
  const COAST_DRAG = 0.13;    // and what a thrown ship bleeds, which is far less
  const MAX_SPEED  = 360;
  const THROWN_CEILING = 4;   // times your top speed, however deep the well
  const SHIP_R     = 12;
  /* And what it is drawn at, over and above the world scale. This is the one
     number on the page that is not the game's: at the zoom a title screen wants
     for its rock field, an honest Skiff is eighteen pixels of hairline and the
     subject of the picture is invisible. So the ship is heroic, and everything
     that has to agree with what you can see — where a round leaves the nose,
     what counts as wearing a boulder — is scaled with it, so nothing ever looks
     like it passed through something it did not. */
  const SHIP_ART   = 1.7;
  const HULL_R     = SHIP_R * SHIP_ART;
  const BULLET_SPD = 520;
  const BULLET_LIFE = 1.31;
  const BURST_SIZE = 3;
  const BURST_GAP  = 0.12;
  const FIRE_GAP   = 0.62;
  const RANGE      = BULLET_SPD * BULLET_LIFE;   // 681 units, and the pilot knows it

  /* Rocks, and what they break into. */
  const ROCK = {
    big:   { r: 54, spd: [40, 85],  next: "mid",   verts: 13, hp: 4 },
    mid:   { r: 30, spd: [70, 135], next: "small", verts: 11, hp: 2 },
    small: { r: 16, spd: [110, 195], next: null,   verts: 9,  hp: 1 }
  };

  /* Stars and black holes. `mass` is in the softened form a = mass/(d²+soft²);
     `kill` destroys what touches it and `reach` is where the pull stops.

     ── why these are bigger than the game's ──────────────────────────────────
     A sector star is forty-six units across the kill radius, which at the zoom
     this page uses is a thirty-pixel bead in the corner. It is the *subject* of
     a slingshot; a slingshot round a bead does not read. So every length here
     is the game's multiplied by `WELL_SCALE` — and the mass by `WELL_SCALE`
     too, which is not a typo and not a fudge. In a softened inverse square the
     acceleration at the matching point scales as mass over length squared, and
     the radius of a turn at a given speed goes as v² over acceleration: scale
     every length by λ and the mass by λ and every trajectory through the field
     is the same curve λ times bigger, flown at the same speed. A title star is
     a real star, drawn from further out. */
  const WELL_SCALE = 1.9;
  const well = (kind, kill, reach, mass, soft, peri, fill) => ({
    kind, fill,
    kill: kill * WELL_SCALE, reach: reach * WELL_SCALE,
    soft: soft * WELL_SCALE, mass: mass * WELL_SCALE,
    /* `peri` is not part of the game — it is the periapsis the pilot flies this
       pass at, in multiples of the kill radius: close enough to be worth
       watching, far enough to come out the other side.

       Measured over two hours of flying, the median pass lands at about three
       kill radii and nine in ten stay outside one and a half. The tail that
       does not is almost all black hole, and that is the game's own design
       rather than a bug in the pilot — `soft` is set so a well's pull peaks
       just under what an engine can beat, and for a hole "just under" is three
       hundred and sixty-eight against a thrust of three hundred and eighty. A
       ship that arrives with enough inward speed cannot be pulled out of one,
       and the sector says so: getting careless deep inside a hole is how you
       die out there. Here it costs nothing — nothing on this page can be
       destroyed, and the ship is drawn *over* the disc rather than behind it,
       so about once a quarter of an hour the front page shows a Skiff crossing
       an event horizon and coming out the far side at three times cruise. That
       is not a failure state. That is the best three seconds on the page. */
    peri: kill * WELL_SCALE * peri
  });
  const HAZARD = {
    star: well("star", 46, 380, 4.5e6, 120, 2.8, AMBER),
    hole: well("hole", 34, 650, 1.22e7, 132, 3.4, "#ff8f77")
  };

  /* How fast the run is flown, against the speed the same ship is flown at in
     the game. Ric: "if you could slow it all down like 20%". A front page is
     read at a glance and from across a room, and the sector's own pace — which
     is a pace for somebody with their hands on it — comes across as frantic
     when nobody is steering.

     It scales the step every moving thing is integrated by, so the flying, the
     gun's rhythm, the drift of the field and a manoeuvre's length all slow
     together. It deliberately does *not* scale the director — see `A.step`. */
  const PACE = 0.8;
  A.pace = PACE;

  const STATION_R = 132;
  const LAP_R     = STATION_R * 1.9;   // the ring the pilot holds while it calls

  /* ── a clock of its own ──────────────────────────────────────────────────
     Seeded rather than `Math.random`, so a run is reproducible and the test
     harness can fly the same ninety seconds twice and get the same tally. */
  let seed = 0x6d2b79f5;
  function rnd() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;  seed >>>= 0;
    return seed / 4294967296;
  }
  const between = (a, b) => a + (b - a) * rnd();

  const TAU = Math.PI * 2;
  const clampv = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  function wrapAngle(d) {
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }

  /* ═══ THE RUN ═════════════════════════════════════════════════════════════ */

  const W = {
    t: 0,              // seconds since the loop started
    last: -1,          // the wall clock, last frame — see `draw`
    cam: { x: 0, y: 0 },
    ship: null,
    rocks: [], shots: [], bits: [], others: [], motes: [],
    well: null, station: null,
    goal: null, bag: [],
    nextTraffic: 6,
    /* What actually happened. Read by test/attract.js, which is the only way to
       find out whether a front page is ever boring — see the header there. */
    tally: { broke: 0, slings: 0, ports: 0, brawls: 0, downed: 0,
             fired: 0, struck: 0, hurt: 0, saved: 0, eaten: 0 }
  };
  A.world = W;

  function newShip(x, y, a, kind) {
    // `course` is where it is going when nothing else is going on, and it is set
    // here rather than by whoever happens to need it: a raider that gives up on
    // a fight falls straight through to flying its course, and a course of
    // `undefined` is a heading of NaN.
    return { x, y, a, course: a, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
             thr: 0, boost: 0, cool: 0, burst: 0, gap: 0,
             hp: 1, flash: 0, kind: kind || "skiff", alive: true, angry: false };
  }

  /* `seedIn` is for the test: the front page a visitor sees always flies the
     same seed, but a property of the page — never quiet, everything turns up
     soon — is not a property of one run of it, so the suite flies several. */
  function start(seedIn) {
    seed = (seedIn >>> 0) || 0x6d2b79f5;
    W.t = 0;
    W.ship = newShip(0, 0, -0.6);
    W.cam.x = 0; W.cam.y = 0;
    W.rocks = []; W.shots = []; W.bits = []; W.others = []; W.motes = [];
    W.well = null; W.station = null;
    W.bag = [];
    W.nextTraffic = between(4, 8);
    /* It opens on a hunt rather than a set piece, because the first thing a
       page should show is the ordinary business of the game. */
    W.goal = { kind: "hunt", until: between(7, 11) };
    for (const k in W.tally) W.tally[k] = 0;
    W.told = 0; W.stage = ""; W.toldAt = 0;
  }
  A.start = start;
  start();

  /* ── debris ──────────────────────────────────────────────────────────────
     Short streaks that fade, the way `drawBits` draws them. Capped, because a
     page left open all afternoon must not grow a list. */
  function burst(x, y, colour, n, spread, life) {
    for (let i = 0; i < n; i++) {
      if (W.bits.length > 220) break;
      const a = rnd() * TAU, s = between(0.25, 1) * spread;
      W.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                    colour, life: life || between(0.35, 0.9), max: 1 });
      const b = W.bits[W.bits.length - 1];
      b.max = b.life;
    }
  }

  function newRock(size, x, y, vx, vy) {
    const spec = ROCK[size];
    const shape = [];
    for (let i = 0; i < spec.verts; i++) shape.push(between(0.74, 1.12));
    return { size, x, y, vx, vy, r: spec.r, shape,
             a: rnd() * TAU, spin: between(-0.7, 0.7),
             hp: spec.hp, flash: 0 };
  }

  function seedRock(x, y) {
    /* Weighted small. A field seeded evenly across the three sizes reads as
       four enormous polygons and nothing else, because a `big` is nearly three
       and a half times a `small` across and eleven times the area — and because
       the big ones are the ones that survive, every other size being one or two
       rounds from gone. The boulders are the punctuation. */
    const roll = rnd();
    const size = roll < 0.12 ? "big" : roll < 0.45 ? "mid" : "small";
    const spec = ROCK[size];
    const a = rnd() * TAU, s = between(spec.spd[0], spec.spd[1]);
    return newRock(size, x, y, Math.cos(a) * s, Math.sin(a) * s);
  }

  function breakRock(r) {
    W.tally.broke++;
    burst(r.x, r.y, AMBER_D, r.size === "big" ? 12 : r.size === "mid" ? 8 : 5,
          r.size === "big" ? 220 : 170);
    const next = ROCK[r.size].next;
    if (!next) return;
    const n = r.size === "big" ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, s = between(ROCK[next].spd[0], ROCK[next].spd[1]);
      W.rocks.push(newRock(next,
        r.x + Math.cos(a) * r.r * 0.5, r.y + Math.sin(a) * r.r * 0.5,
        r.vx + Math.cos(a) * s * 0.7, r.vy + Math.sin(a) * s * 0.7));
    }
  }

  /* ── gravity ─────────────────────────────────────────────────────────────
     One well at a time, and it pulls on everything with mass — ships, rocks and
     rounds alike, which is the sector's own rule and the reason a shot fired
     past a black hole does not go where it was aimed. Returns the pull, because
     the boost allowance is granted by how hard you were being pulled. */
  function gravity(o, dt) {
    const h = W.well;
    if (!h) return 0;
    const dx = h.x - o.x, dy = h.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > h.reach * h.reach) return 0;
    const d = Math.sqrt(d2) || 0.001;
    const a = h.mass / (d2 + h.soft * h.soft);
    o.vx += (dx / d) * a * dt;
    o.vy += (dy / d) * a * dt;
    return a;
  }

  /* The survey integrator, copied: drag is the resistance an engine works
     against, so being thrown by something that is not your engine bleeds at
     COAST_DRAG instead, and the cap lifts by whatever the well gave you. */
  function integrate(s, dt, pull) {
    if (s.thr > 0) {
      s.vx += Math.cos(s.a) * THRUST * s.thr * dt;
      s.vy += Math.sin(s.a) * THRUST * s.thr * dt;
    }
    const before = Math.hypot(s.vx, s.vy);
    s.boost = Math.max(0, s.boost * Math.exp(-COAST_DRAG * dt));
    const excess = before - MAX_SPEED;
    if (pull > 0.05 && excess > s.boost) {
      s.boost = Math.min(excess, MAX_SPEED * (THROWN_CEILING - 1));
    }
    const coasting = before > MAX_SPEED * 1.01;
    const damp = Math.exp(-(coasting ? COAST_DRAG : DRAG) * dt);
    s.vx *= damp; s.vy *= damp;
    const sp = Math.hypot(s.vx, s.vy);
    const max = MAX_SPEED + s.boost;
    if (sp > max) { s.vx *= max / sp; s.vy *= max / sp; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.flash > 0) s.flash -= dt;
    if (s.graze > 0) s.graze -= dt;
  }

  function steer(s, want, dt) {
    s.a += clampv(wrapAngle(want - s.a), -TURN * dt, TURN * dt);
  }

  /* Where to point to hit a thing that is moving, given that a round carries the
     firer's own velocity with it. Two passes of the time of flight is plenty at
     these speeds and is what the game's bots do. */
  function lead(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const rvx = (to.vx || 0) - from.vx, rvy = (to.vy || 0) - from.vy;
    let t = Math.hypot(dx, dy) / BULLET_SPD;
    for (let i = 0; i < 2; i++) {
      t = Math.min(1.2, Math.hypot(dx + rvx * t, dy + rvy * t) / BULLET_SPD);
    }
    return Math.atan2(dy + rvy * t, dx + rvx * t);
  }

  function fire(s, colour, foe) {
    if (W.shots.length > 40) return;
    W.shots.push({
      x: s.x + Math.cos(s.a) * HULL_R, y: s.y + Math.sin(s.a) * HULL_R,
      vx: Math.cos(s.a) * BULLET_SPD + s.vx,
      vy: Math.sin(s.a) * BULLET_SPD + s.vy,
      life: BULLET_LIFE, colour, foe: !!foe
    });
    if (!foe) W.tally.fired++;
  }

  /* Three rounds, then a recovery — which is the rhythm the gun actually has,
     and the reason a fight on this page is a sequence of exchanges rather than
     two hoses. The recovery is the part that is easy to drop: without the
     `cool` guard a burst simply restarts on the next 0.12s gap and the gun
     fires eight rounds a second forever, which is what it did the first time
     this was measured — eleven hundred hits on the pilot in five minutes. */
  function trigger(s, aligned, colour, foe, dt) {
    if (s.cool > 0) s.cool -= dt;
    if (s.gap > 0) s.gap -= dt;
    if (s.burst > 0) {
      if (s.gap <= 0) {
        fire(s, colour, foe);
        s.burst--;
        s.gap = BURST_GAP;
        if (s.burst <= 0) s.cool = FIRE_GAP;
      }
      return;
    }
    if (aligned && s.cool <= 0 && s.gap <= 0) {
      fire(s, colour, foe);
      s.burst = BURST_SIZE - 1;
      s.gap = BURST_GAP;
    }
  }

  /* ═══ THE PILOT ═══════════════════════════════════════════════════════════
     One hand on the stick. It has a goal from the director, a gun that fires at
     whatever happens to be in front of it, and one reflex it cannot override. */

  /* The reflex. Nothing on this page is allowed to fly into a star, so inside
     a little over twice the kill radius the pilot stops flying the goal and
     climbs straight out at full burn — which, because `soft` is set so the pull
     peaks below what an engine can beat, always works. Counted, because a page
     that spends its time being saved is a page with a badly aimed set piece. */
  /* How close this pass gets if nobody touches anything. Coarse on purpose —
     the step is a tenth of a second and it only has to be right to within a
     ship's length — and it never writes to `s`. */
  /* How close this pass gets if nobody touches anything: the next few seconds
     integrated under the same gravity everything else uses, reporting the
     smallest distance seen. It never writes to `s`.

     The step is adaptive, and that is not an optimisation — it is the whole
     accuracy of the thing. A fixed tenth of a second is a hundred and twenty
     units of travel for a ship coming out of a black hole, and a hundred and
     twenty units is nearly twice the radius of the hole: the forecast stepped
     clean over the miss and reported open space. Measured against where the
     ship actually went, a fixed step was out by hundreds of units on exactly
     the passes that mattered. Sized off distance over speed it lands within a
     ship's length. */
  function forecast(s, h) {
    let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
    const R = h.reach;
    const rx = x - h.x, ry = y - h.y;
    const v2 = vx * vx + vy * vy || 1;
    const rv = rx * vx + ry * vy;
    const here = Math.hypot(rx, ry);
    if (here > R) {
      /* Outside the reach the pull is exactly nought, so the run-in is a
         straight line and can be solved rather than stepped. This is not
         thrift — it is where the accuracy comes from. Stepping the approach
         spent the whole budget out in the empty part at a quarter of a second
         a step, and explicit steps that size in an inverse square drift
         outward: the forecast read a steady two hundred units all the way down
         from three thousand and then fell off a cliff to eight inside the last
         hundred, by which time there was nothing to be done about it. Skip to
         the edge of the reach and spend every step where the mass is. */
      if (rv >= 0) return here;                       // going away; it is past
      const disc = rv * rv - v2 * (rx * rx + ry * ry - R * R);
      if (disc <= 0) return Math.abs(rx * vy - ry * vx) / Math.sqrt(v2);
      const te = (-rv - Math.sqrt(disc)) / v2;
      x += vx * te; y += vy * te;
    }
    let min = Infinity, t = 0;
    for (let i = 0; i < 80 && t < 6; i++) {
      const dx = h.x - x, dy = h.y - y, d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2) || 0.001;
      if (d < min) min = d;
      if (t > 0 && d > R * 1.02) break;               // out the far side
      const step = clampv(d / ((Math.hypot(vx, vy) || 1) * 8), 0.008, 0.06);
      const a = h.mass / (d2 + h.soft * h.soft) * step;
      vx += (dx / d) * a; vy += (dy / d) * a;
      x += vx * step; y += vy * step;
      t += step;
    }
    return min;
  }
  /* Exported because it is the one thing in here worth measuring against
     reality: a harness can ask what the pilot thought was going to happen and
     compare it with what did. See test/attract.js. */
  A.forecast = forecast;

  /* Which way round the well this pass is going: the sign that, added to the
     velocity heading, opens the miss distance up. */
  function wellSide(s, h) {
    const rx = s.x - h.x, ry = s.y - h.y;
    const sp = Math.hypot(s.vx, s.vy) || 1;
    return (rx * s.vy - ry * s.vx) / sp >= 0 ? -1 : 1;
  }

  /* The reflex, and the one thing the pilot cannot override. Nothing on this
     page is allowed to fly into a star.

     Two lessons are baked into this, both of them measured rather than
     reasoned. The first: it has to be predictive, because at four hundred units
     a second it takes a second to swing the nose right round and a second is
     four hundred units. The second, and the one that took three goes: what it
     predicts has to be flown, not drawn. A straight line grazing a safety
     circle is a perfectly good construction and a black hole bends it into a
     direct hit — the worst pass in forty minutes of flying was eight
     hundredths of a kill radius, arrived at by a reflex doing exactly what it
     was told. So the quantity regulated here is `forecast`: integrate the next
     four seconds under the same gravity everything else uses, and lean off the
     velocity until the number it comes back with is big enough.

     How big depends on what the pilot is doing. Mid-slingshot it *wants* to be
     close and this is only a backstop; the rest of the time the well it whipped
     round a minute ago is just a hazard sitting in a rock field, and it gets a
     wide berth. */
  function escape(s, tight) {
    const h = W.well;
    if (!h) return null;
    const d = Math.hypot(h.x - s.x, h.y - s.y);
    if (d > h.reach * 1.15) { s.graze = 0; return null; }
    const safe = h.kill * (tight ? 2.6 : 4.5);
    // No room left for a curve: straight out, which the softening guarantees an
    // engine can always win — see the comment on HAZARD in index.html.
    if (d < safe) { flagGraze(s, h, d); return Math.atan2(s.y - h.y, s.x - h.x); }
    const fc = forecast(s, h);
    if (fc >= safe) { s.graze = 0; return null; }
    flagGraze(s, h, d);
    const err = clampv((safe - fc) / safe, 0, 1);
    return Math.atan2(s.vy, s.vx) + wellSide(s, h) * (0.35 + err * 1.1);
  }

  // Counted only when it was a real emergency, not every time the pilot leans
  // off a well it happens to be passing.
  function flagGraze(s, h, d) {
    if (!(s.graze > 0) && (d < h.kill * 2.5 || forecast(s, h) < h.kill * 2)) {
      W.tally.saved++;
    }
    s.graze = 1.5;
  }

  function nearestRock(s, maxD, ahead) {
    let best = null, score = Infinity;
    for (const r of W.rocks) {
      const dx = r.x - s.x, dy = r.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > maxD) continue;
      const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - s.a));
      // Cheap and honest: the rock that is least trouble to get to, which is a
      // trade between how far it is and how far round you have to swing.
      const sc = d / 600 + (ahead ? off * 1.35 : 0) - (r.size === "big" ? 0.3 : 0);
      if (sc < score) { score = sc; best = r; }
    }
    return best;
  }

  function nearestFoe(s, maxD) {
    let best = null, d2 = maxD * maxD;
    for (const o of W.others) {
      if (!o.alive || !o.angry) continue;
      const q = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
      if (q < d2) { d2 = q; best = o; }
    }
    return best;
  }

  /* Rock coming at you. Not a collision system — a shoulder-check, so the ship
     leans off a boulder it is about to wear rather than flying through it. */
  function dodge(s) {
    let worst = null, closest = Infinity;
    for (const r of W.rocks) {
      const dx = r.x - s.x, dy = r.y - s.y;
      const d = Math.hypot(dx, dy) - r.r;
      if (d > 90 || d > closest) continue;
      if (Math.abs(wrapAngle(Math.atan2(dy, dx) - s.a)) > 0.8) continue;
      closest = d; worst = r;
    }
    if (!worst) return null;
    const away = Math.atan2(worst.y - s.y, worst.x - s.x);
    const side = wrapAngle(s.a - away) >= 0 ? 1 : -1;
    return away + side * 1.25;
  }

  function pilot(dt) {
    const s = W.ship;
    const g = W.goal;
    let want = s.a, thr = 1, gunTarget = null;

    if (g.kind === "hunt" || g.kind === "cruise") {
      /* Let a rock go once it is behind or out of reach, rather than only when
         it is dead. Without this the pilot keeps a target it has already
         overflown: it rockets past at eight hundred, hauls round, comes back at
         seventy, hauls round again — measured, ten seconds of thrashing at a
         rock field with eight rocks in easy range and not one of them hit. */
      if (g.rock) {
        const i = W.rocks.indexOf(g.rock);
        const dx = g.rock.x - s.x, dy = g.rock.y - s.y;
        const off = Math.abs(wrapAngle(Math.atan2(dy, dx) - s.a));
        if (i < 0 || dx * dx + dy * dy > (RANGE * 1.7) ** 2 || off > 1.5) g.rock = null;
      }
      if (!g.rock) g.rock = nearestRock(s, RANGE * 1.5, true);
      if (g.rock) {
        want = lead(s, g.rock);
        gunTarget = g.rock;
      } else {
        want = s.a + Math.sin(W.t * 0.3) * 0.5;
      }
      /* Held at a cruise rather than run off the distance to the target. A
         standoff is what a careful player does and it is the wrong picture: the
         page wants a ship crossing a field and shooting things as it goes, not
         one parked in front of a boulder plinking at it. */
      thr = Math.hypot(s.vx, s.vy) < MAX_SPEED * 0.85 ? 1 : 0.25;

      /* And if something has decided about you while you were rock-breaking,
         that is the errand now. The director deals a fight every third or
         fourth set piece, but a raider left over from the last one — or one
         that wandered in — used to be flown straight past. */
      const near = nearestFoe(s, RANGE * 1.6);
      if (near) { want = lead(s, near); gunTarget = near; }

    } else if (g.kind === "sling") {
      const h = W.well;
      const d = Math.hypot(h.x - s.x, h.y - s.y);
      const rad = ((h.x - s.x) * s.vx + (h.y - s.y) * s.vy) / (d || 1);  // closing
      /* The brake has hysteresis. It used to be a bare threshold — burn
         retrograde whenever the speed was over 1.12× cruise and the well was
         still ahead — and the approach burn below pushes the speed to exactly
         that, so the pilot flipped: over the line, nose round, burn, under
         the line, nose back, burn, over the line. Measured on 2026-09-24 as
         eleven seconds of a ship turning in place a well's-reach-and-a-half
         out, not closing, not shooting — the longest silence on the page.
         Now a brake, once released, does not come back on for an ordinary
         approach speed: only for a real throw carried in from the last well. */
      const sp = Math.hypot(s.vx, s.vy);
      if (g.phase === "in" && d > h.reach * 1.1) {
        if (!g.brake && sp > MAX_SPEED * (g.braked ? 1.5 : 1.12)) g.brake = true;
        if (g.brake && sp < MAX_SPEED * 0.95) { g.brake = false; g.braked = true; }
      } else g.brake = false;
      if (g.phase === "in" && g.brake) {
        /* Coming off the gas to line it up. A pilot arriving at a black hole
           still carrying the throw from the last one has no authority to steer
           with: at six hundred and fifty units a second there is a quarter of a
           second between the guard firing and the bottom of the well, and the
           ship goes in whatever anybody does about it. It is also the wrong
           picture — the whole point of a slingshot is the speed you *leave*
           with, and arriving at twice cruise throws that away. Retrograde, then,
           which is the one manoeuvre in this game that looks like a decision. */
        want = Math.atan2(-s.vy, -s.vx);
        thr = 1;
      } else if (g.phase === "in") {
        /* What is steered is `forecast` — where this pass is actually going —
           and not a point beside the well or a perpendicular dropped on the
           line the ship is on. Both of those were tried and both were measured
           wrong: chasing an offset point is pure pursuit and pure pursuit
           converges *onto* the thing it is chasing, and a straight-line miss
           distance is a fiction in a well deep enough to bend it, which a black
           hole at this mass certainly is. Fly what will happen.

           Symmetric, unlike the reflex below: too wide is as wrong as too
           close, because turning towards a black hole on purpose is the errand
           here. */
        const err = clampv((h.peri - forecast(s, h)) / h.peri, -1, 1);
        want = Math.atan2(s.vy, s.vx) + wellSide(s, h) * err * 0.7;
        /* Far out — more than two reaches from the well — the pass
           cannot be arranged to better than the clamp above anyway, so a rock
           near the nose is worth a third of a radian of yaw, the way it is on
           a hunt. Without this an approach was the one stretch of the page
           where the ship flew through a field with the gun on nothing, and a
           long one — a boulder shove at the start of one was measured at
           twelve seconds of a wide arc under full burn, shooting nothing. */
        if (d > h.reach * 2) {
          const r = nearestRock(s, RANGE * 0.9, true);
          if (r) {
            const la = lead(s, r);
            if (Math.abs(wrapAngle(la - want)) < 0.35) want = la;
          }
        }
        /* The engine stays lit while the pass is still being arranged, and only
           then does it go quiet. Turning the nose with the throttle shut does
           not move the ship an inch — the first version cut thrust at eight
           tenths of the reach and then "steered", which is why the measured
           periapsis was inside the star. Correct first, coast second. */
        thr = Math.abs(err) > 0.1 || d > h.reach * 0.75 ? 1 : 0;
        if (d < h.reach) g.arrived = true;
        if (rad < 0 && g.arrived) { g.phase = "round"; g.kick = 1.15; W.tally.slings++; }
      } else if (g.phase === "round") {
        /* The Oberth burn: at the bottom of the well, along the velocity, which
           is where thrust is worth the most and is what makes this a slingshot
           and not a corner. */
        g.kick -= dt;
        want = Math.atan2(s.vy, s.vx);
        thr = 1;
        if (g.kick <= 0) g.phase = "out";
      } else {
        /* Riding it out. Short, and on a clock as well as a distance: a black
           hole's reach is twelve hundred units and a pass that came out slow
           spent nine seconds crossing it, nose along the velocity, not
           shooting at anything — measured, the longest silence on the whole
           front page. The throw is over the moment it is clear of the thing. */
        g.rideT = (g.rideT || 0) + dt;
        want = Math.atan2(s.vy, s.vx);
        thr = 0;
        if (d > h.reach * 0.75 || g.rideT > 3.5) endGoal();
      }
      gunTarget = nearestRock(s, RANGE, true);

    } else if (g.kind === "port") {
      const st = W.station;
      const d = Math.hypot(st.x - s.x, st.y - s.y);
      if (g.phase === "in") {
        want = Math.atan2(st.y - s.y, st.x - s.x);
        // Slowed on the way in, or the arrival is an overshoot: a ship still
        // doing three hundred and sixty at the dock ring is not calling here.
        thr = d > 900 ? 1 : d > 500 ? 0.4 : 0.12;
        if (d < LAP_R * 1.5) { g.phase = "lap"; g.lapT = 6; W.tally.ports++; }
      } else if (g.phase === "lap") {
        /* Round the ring, and it has to be an actual orbit. The first version
           steered at a tangent with the throttle at six tenths, which is a
           straight line leaving at five hundred units a second — measured, the
           station was off the side of the page before the lap was half done,
           so the one set piece with a landmark in it had no landmark.

           A point chased round the ring instead: a spot eight tenths of a
           radian further round at the radius it wants to hold, which pulls the
           ship back in when it is wide and lets it drift out when it is tight.
           The throttle holds a speed rather than a thrust, because the radius
           this keeps is a speed and nothing else. */
        g.lapT -= dt;
        const around = Math.atan2(s.y - st.y, s.x - st.x) + g.side * 0.8;
        want = Math.atan2(st.y + Math.sin(around) * LAP_R - s.y,
                          st.x + Math.cos(around) * LAP_R - s.x);
        thr = Math.hypot(s.vx, s.vy) > 190 ? 0 : 0.5;
        if (g.lapT <= 0) { g.phase = "out"; g.outA = s.a; }
      } else {
        want = g.outA;
        thr = 1;
        if (d > STATION_R * 8) endGoal();
      }
      gunTarget = nearestRock(s, RANGE, true);

    } else if (g.kind === "brawl") {
      const foe = nearestFoe(s, 4000);
      if (!foe) { endGoal(); return; }
      const d = Math.hypot(foe.x - s.x, foe.y - s.y);
      want = lead(s, foe);
      gunTarget = foe;
      thr = d > RANGE * 0.7 ? 1 : d > 220 ? 0.4 : 0;
      /* Broken off. Not a health bar — a decision: a pilot who is losing stops
         trying to win, and the page gets a ship that disengages, which reads. */
      if (s.hp < 0.4 && !g.won) {
        want = Math.atan2(s.y - foe.y, s.x - foe.x);
        thr = 1;
        gunTarget = null;
        if (d > 1800) endGoal();
      }
    }

    /* A floor under the throttle. Every goal here has a reason to come off the
       gas — standing off a rock, coasting into a well, holding a station's ring
       — and with DRAG at nearly half a second that adds up to a ship sitting
       almost still, which on a page whose whole subject is travelling is the
       worst thing it can do. Measured at twenty-eight units a second during a
       hunt: not flying, floating. */
    if (Math.hypot(s.vx, s.vy) < 150 && thr < 0.7) thr = 1;

    const duck = dodge(s);
    if (duck !== null) { want = duck; thr = Math.max(thr, 0.6); gunTarget = null; }
    // Tight only while the pass is being flown: once the ship is on its way out
    // there is no reason left to be anywhere near the thing.
    const out = escape(s, g.kind === "sling" && g.phase !== "out");
    if (out !== null) { want = out; thr = 1; gunTarget = null; }

    steer(s, want, dt);
    s.thr = thr;

    /* The gun is its own decision, but not a free one: anything shooting at
       you outranks a rock, always. Ric — "the player ship needs to focus on the
       enemies first" — and he was watching the pilot line up a boulder with a
       raider on its tail, because the fallback here reached for `nearestRock`
       whenever the goal had not named something. A rock is scenery. */
    const hostile = nearestFoe(s, RANGE * 1.3);
    if (hostile) gunTarget = hostile;
    if (!gunTarget) gunTarget = nearestRock(s, RANGE, true);
    let aligned = false;
    if (gunTarget) {
      const d = Math.hypot(gunTarget.x - s.x, gunTarget.y - s.y);
      const off = Math.abs(wrapAngle(lead(s, gunTarget) - s.a));
      aligned = d < RANGE * 0.95 && off < (gunTarget.r ? 0.16 : 0.1);
    }
    trigger(s, aligned, AMBER, false, dt);

    if (s.hp < 1) s.hp = Math.min(1, s.hp + 0.085 * dt);
  }

  /* ═══ EVERYBODY ELSE ══════════════════════════════════════════════════════
     Two kinds, and they are kinds for good — a trader is drawn in a courier's
     hull in the sector's own green and a raider in a corsair's in red, and
     neither ever becomes the other. What changes is `angry`: a raider that has
     given up stops hunting and leaves, still a raider. A trader is going
     somewhere and is not interested in you; an angry raider is interested in
     whatever is slowest, which is the trader until you turn up. Neither is
     clever — they do not need to be, they need to be legible from across a
     title screen. */
  function others(dt) {
    const me = W.ship;
    for (const o of W.others) {
      if (!o.alive) continue;
      let want = o.a, thr = 1, target = null;

      if (o.kind === "raider" && o.angry) {
        // Whichever of the two is nearer, with the prey preferred while it lasts.
        const prey = o.prey && o.prey.alive ? o.prey : null;
        const dp = prey ? Math.hypot(prey.x - o.x, prey.y - o.y) : Infinity;
        const dm = Math.hypot(me.x - o.x, me.y - o.y);
        target = dm < dp * 0.8 || dm < 700 ? me : prey;
        if (target) {
          const d = Math.hypot(target.x - o.x, target.y - o.y);
          /* Deliberately a worse shot than the pilot, and worse in the way a
             bad shot is actually bad: a bias that holds for a second or so and
             then re-rolls, so its rounds go consistently a few boat-lengths
             wide and then consistently wide the other way. Jitter re-rolled
             every frame would average out to a perfect aim. */
          o.aimT = (o.aimT || 0) - dt;
          if (o.aimT <= 0) { o.aimT = between(0.7, 1.4); o.aimErr = between(-0.13, 0.13); }
          want = lead(o, target) + o.aimErr;
          thr = d > RANGE * 0.6 ? 1 : d > 260 ? 0.35 : 0;
          const off = Math.abs(wrapAngle(want - o.a));
          trigger(o, d < RANGE * 0.85 && off < 0.07, RAIDER, true, dt);
        }
      } else {
        // Running, if something is chasing; otherwise holding its course.
        const hunter = o.fleeing && o.fleeing.alive ? o.fleeing : null;
        want = hunter ? Math.atan2(o.y - hunter.y, o.x - hunter.x) : o.course;
        thr = hunter ? 1 : 0.7;
      }

      const duck = dodge(o);
      if (duck !== null) want = duck;
      const out = escape(o, false);
      if (out !== null) { want = out; thr = 1; }

      steer(o, want, dt);
      o.thr = thr;
      integrate(o, dt, gravity(o, dt));

      // Gone over the horizon. Traffic is scenery; it is not kept alive off
      // screen so that it can be somewhere pointless later.
      if (Math.hypot(o.x - me.x, o.y - me.y) > 5200) o.alive = false;
    }
    for (let i = W.others.length - 1; i >= 0; i--) {
      if (!W.others[i].alive) W.others.splice(i, 1);
    }
  }

  function downed(o) {
    o.alive = false;
    W.tally.downed++;
    burst(o.x, o.y, o.kind === "raider" ? RAIDER : CASH, 18, 300, 1.1);
    burst(o.x, o.y, FLASH, 6, 150, 0.5);
  }

  /* ═══ THE DIRECTOR ════════════════════════════════════════════════════════
     What happens next, and where. Set pieces come out of a bag that is refilled
     and shuffled when it empties, so the page cannot go four minutes without a
     slingshot the way a weighted die can. Between every two of them is a stretch
     of ordinary hunting, because a page that is all set piece has no baseline to
     make a set piece read against.

     Everything is placed *ahead of the ship* at the moment it is called for,
     rather than existing somewhere in a world and being flown to. There is no
     world; there is a page, and what the page needs is for the next thing to
     arrive from the direction the ship is already pointing. */
  const BAG = ["sling:star", "brawl", "port", "sling:hole", "port", "brawl"];

  /* Placed down the ship's *track*, not its nose. A ship thrown out of a black
     hole is pointing wherever the last burn left it and travelling somewhere
     else entirely, and a set piece put in front of the nose in that moment is a
     set piece the run never reaches — measured, half the slingshots were duds
     that peaked a thousand units out. */
  function aheadOf(s, d, off) {
    const sp = Math.hypot(s.vx, s.vy);
    const a = sp > 40 ? Math.atan2(s.vy, s.vx) : s.a;
    return { x: s.x + Math.cos(a) * d - Math.sin(a) * off,
             y: s.y + Math.sin(a) * d + Math.cos(a) * off };
  }

  function endGoal() {
    W.goal = { kind: "hunt", until: W.t + between(6.5, 10.5) };
  }

  /* How long the page may go with nothing happening on it before the sector
     does something about it. "Nothing happening" is the tally's word, not a
     guess: the same counters and stage changes that test/attract.js reads as
     events. Five seconds is under half the twelve the test allows, so a machine
     whose floating point drifts the run differently — an x86 runner against an
     arm64 Mac, which is where 14.3s was measured against a Mac's 11.5s — still
     has the whole margin in hand. The slack lives here, in the game, and not in
     the number in the test. */
  const DEAD_AIR = 5;

  function noticed() {
    const t = W.tally;
    return t.broke + t.struck + t.hurt + t.ports + t.brawls + t.downed + t.slings + t.eaten;
  }

  function director(dt) {
    const s = W.ship;
    const g = W.goal;

    /* The dead-air clock. Reset by anything a viewer would have noticed — a
       counter moving or a set piece changing phase — and read below. */
    const told = noticed(), stage = g.kind + ":" + (g.phase || "");
    if (told !== W.told || stage !== W.stage) { W.told = told; W.stage = stage; W.toldAt = W.t; }
    if (W.t - W.toldAt > DEAD_AIR) {
      /* Wound back rather than reset: if the nudge below is not taken up —
         the nose swung off the rock, or the pilot was busy escaping a well —
         the next one comes two and a half seconds later, not five. */
      W.toldAt = W.t - DEAD_AIR + 2.5;
      if (g.kind === "brawl") {
        /* A fight in which nothing has landed for six seconds is two ships
           chasing each other round the page, and the raiders lose interest
           the same way they do when the clock runs out — measured, the longest
           silence on the whole front page was the back half of one of these. */
        g.until = W.t;
      } else if (g.kind !== "sling" || g.phase === "in") {
        /* Otherwise the sector puts a small rock across the nose, inside gun
           range, drifting slowly so it stays in the cone — something to shoot
           on the way to wherever the ship is going. The hunt already does this
           for itself when the field is thick; this is for when it is not, and
           for the long approach to a well, which is the one stretch the pilot
           flies through a field it is not steering towards. */
        if (W.rocks.length < 40) {
          /* On the NOSE, not the track, because the gun is on the nose and
             fires only inside a tenth of a radian of it — and nearly matching
             the ship's own velocity, so it hangs there long enough to be hit
             rather than being overtaken in the time a burst takes. */
          const d = RANGE * 0.5, off = between(-25, 25);
          const x = s.x + Math.cos(s.a) * d - Math.sin(s.a) * off;
          const y = s.y + Math.sin(s.a) * d + Math.cos(s.a) * off;
          const across = s.a + Math.PI / 2, sp = between(15, 35) * (rnd() < 0.5 ? 1 : -1);
          if (!(W.well && Math.hypot(x - W.well.x, y - W.well.y) < W.well.kill * 3)) {
            W.rocks.push(newRock("small", x, y,
              s.vx * 0.95 + Math.cos(across) * sp, s.vy * 0.95 + Math.sin(across) * sp));
          }
        }
      }
    }

    if (g.kind === "hunt" && W.t >= g.until) {
      if (!W.bag.length) {
        W.bag = BAG.slice();
        // Shuffled, and reshuffled if the draw would hand out the same set piece
        // the last bag ended on — two stations in a row is the one thing a
        // shuffle can do that a viewer reads as the page repeating itself.
        for (let pass = 0; pass < 6; pass++) {
          for (let i = W.bag.length - 1; i > 0; i--) {
            const j = (rnd() * (i + 1)) | 0;
            const tmp = W.bag[i]; W.bag[i] = W.bag[j]; W.bag[j] = tmp;
          }
          if (W.bag[W.bag.length - 1] !== W.lastPiece) break;
        }
        /* The FIRST bag deals each kind once before any repeat. The brief is
           that everything turns up inside a first look at the title screen,
           and a plain shuffle of six can put the star sling sixth — measured
           at 158s on one machine against 150s on the brief, with the same
           code at 140s on another. The bag is popped from the end, so the four
           distinct kinds go to the back, in the order the shuffle gave them,
           and the two repeats come out last. */
        if (!W.lastPiece) {
          const seen = new Set(), firsts = [], repeats = [];
          for (const k of W.bag) (seen.has(k) ? repeats : (seen.add(k), firsts)).push(k);
          W.bag = repeats.concat(firsts);
        }
      }
      const next = W.lastPiece = W.bag.pop();

      if (next === "sling:star" || next === "sling:hole") {
        const spec = HAZARD[next === "sling:star" ? "star" : "hole"];
        // Placed off its own reach rather than off a flat number, so a hole —
        // which grips more than three times as far as a star — still gets an
        // approach to arrange the pass in rather than arriving already inside.
        const at = aheadOf(s, spec.reach * between(2.2, 2.8), between(-300, 300));
        W.well = Object.assign({ x: at.x, y: at.y, phase: rnd() * TAU }, spec);
        W.motes = [];
        // A hole is nearly invisible and its debris stream is most of how you
        // find one, so it sheds half again what a star does.
        const n = W.well.kind === "hole" ? 30 : 20;
        for (let i = 0; i < n; i++) W.motes.push(newMote(W.well));
        W.goal = { kind: "sling", phase: "in", side: rnd() < 0.5 ? 1 : -1 };

      } else if (next === "port") {
        const at = aheadOf(s, between(1350, 1700), between(-280, 280));
        W.station = { x: at.x, y: at.y, r: STATION_R, phase: rnd() * TAU };
        W.goal = { kind: "port", phase: "in", side: rnd() < 0.5 ? 1 : -1 };
        // Somebody is always leaving a station.
        for (let i = 0; i < 2; i++) {
          const a = rnd() * TAU;
          const t = newShip(at.x + Math.cos(a) * STATION_R * 2.2,
                            at.y + Math.sin(a) * STATION_R * 2.2, a, "trader");
          t.course = a;
          W.others.push(t);
        }

      } else {
        /* A fight you arrive at rather than one that arrives at you. Two raiders
           already working on a trader who is already running: the scene has a
           side to take before the ship has fired a round, which is the whole
           difference between a dogfight and two triangles shooting. */
        /* Closer than the other two set pieces, and on purpose. A star is
           visible from two thousand units and a station from one; a fighter is
           twenty-eight units of hairline, and a fight staged at the distance a
           landmark is staged at is a fight nobody on the page can see. This is
           about a screen and a half out — close enough that the raiders are
           drawn within a second or two of being dealt. */
        const at = aheadOf(s, between(850, 1100), between(-200, 200));
        const run = Math.atan2(at.y - s.y, at.x - s.x) + between(-0.6, 0.6);
        const prey = newShip(at.x, at.y, run, "trader");
        prey.course = run;
        prey.hp = 4;             // it is meant to be saveable, not doomed
        W.others.push(prey);
        for (let i = 0; i < 2; i++) {
          const r = newShip(at.x - Math.cos(run) * (340 + i * 130),
                            at.y - Math.sin(run) * (340 + i * 130) + (i ? 110 : -110),
                            run, "raider");
          // Five, not three. A Skiff lands about a round and a half a second at
          // these ranges, and at three hull the whole scene was over in four —
          // the raiders were on screen for two of them.
          r.angry = true; r.hp = 5; r.prey = prey;
          prey.fleeing = r;
          W.others.push(r);
        }
        W.goal = { kind: "brawl", until: W.t + 26 };
        W.tally.brawls++;
      }
    }

    /* Ambient traffic, which is not a set piece and does not wait its turn:
       somebody crossing your path every ten or fifteen seconds is what stops the
       sector reading as empty between errands. */
    W.nextTraffic -= dt;
    if (W.nextTraffic <= 0) {
      W.nextTraffic = between(9, 16);
      if (W.others.length < 6) {
        const side = rnd() * TAU;
        const at = { x: s.x + Math.cos(side) * 1500, y: s.y + Math.sin(side) * 1500 };
        const course = side + Math.PI + between(-0.9, 0.9);
        const t = newShip(at.x, at.y, course, "trader");
        t.course = course;
        W.others.push(t);
      }
    }

    // A well or a station the run has finished with is let go of, or the page
    // accumulates furniture it is nowhere near.
    if (W.well && W.goal.kind !== "sling" &&
        Math.hypot(W.well.x - s.x, W.well.y - s.y) > W.well.reach + 2600) {
      W.well = null; W.motes = [];
    }
    if (W.station && W.goal.kind !== "port" &&
        Math.hypot(W.station.x - s.x, W.station.y - s.y) > 3400) W.station = null;

    /* A brawl is over when the raiders are — or when it has gone on long enough
       that it has stopped being an event and started being the weather. Nothing
       on a front page may run for a minute; the survivors lose interest and
       leave, which is also the only ending a losing raider ever gets. */
    if (W.goal.kind === "brawl") {
      if (W.t > W.goal.until) {
        for (const o of W.others) {
          if (!o.angry) continue;
          /* It gives up — it does not *defect*. An earlier version set `kind`
             to "trader" here, and `kind` is what picks the hull and the colour,
             so a raider that lost interest turned from a red corsair into a
             green courier in one frame, in front of you. Ric: "the ships
             randomly change teams". Whose side a ship is on is `angry`; what it
             is is `kind`; the two are not the same question. */
          o.angry = false;
          o.course = o.a;
        }
      }
      if (!nearestFoe(s, 6000)) endGoal();
    }
  }

  /* Debris falling into a well: the stream *is* the boundary marker — where you
     first see specks turning inward is where the pull begins to matter. Straight
     out of `newMote`. */
  function newMote(h) {
    const t = rnd() * TAU;
    const r = h.reach * between(0.88, 1);
    const tang = between(-1, 1) * (h.kind === "hole" ? 55 : 35);
    return { x: h.x + Math.cos(t) * r, y: h.y + Math.sin(t) * r,
             vx: -Math.sin(t) * tang, vy: Math.cos(t) * tang };
  }

  /* ═══ ONE FRAME OF THE WORLD ══════════════════════════════════════════════ */

  A.step = function (wall, rect) {
    if (!(wall > 0)) return;
    /* Two clocks, and the split is the whole of what PACE means. `wall` is real
       seconds and is what `W.t` counts, so everything about *when* — when the
       next set piece is dealt, when traffic crosses, how long a fight is
       allowed to run — happens exactly when it did before. `dt` is the slowed
       one and is what everything that moves is stepped by. Slowing both would
       have emptied the page by a fifth as well as calming it, which is not what
       was asked for: the flying is too fast, the page is not too busy. */
    const dt = wall * PACE;
    W.t += wall;
    const s = W.ship;

    director(wall);
    pilot(dt);
    integrate(s, dt, gravity(s, dt));
    others(dt);

    // ── rounds ──────────────────────────────────────────────────────────────
    for (let i = W.shots.length - 1; i >= 0; i--) {
      const b = W.shots[i];
      gravity(b, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) { W.shots.splice(i, 1); continue; }

      let spent = false;
      for (const r of W.rocks) {
        if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 > r.r * r.r) continue;
        r.hp--; r.flash = 0.12;
        burst(b.x, b.y, FLASH, 3, 120, 0.3);
        if (!b.foe) W.tally.struck++;
        spent = true;
        break;
      }
      if (!spent && b.foe) {
        if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < HULL_R ** 2) {
          s.hp -= 0.08; s.flash = 0.18; W.tally.hurt++;
          burst(s.x, s.y, WARN, 5, 160, 0.4);
          spent = true;
        }
      }
      if (!spent) {
        for (const o of W.others) {
          if (!o.alive) continue;
          if (b.foe && o.kind === "raider") continue;      // no friendly fire
          if ((b.x - o.x) ** 2 + (b.y - o.y) ** 2 > HULL_R ** 2) continue;
          o.hp -= 1; o.flash = 0.18;
          burst(b.x, b.y, FLASH, 4, 150, 0.35);
          /* The pilot's round landing on a hull is a round telling, and it is
             counted as one. It was not, until 2026-09-24: `struck` only ever
             counted rocks, so a fourteen-second stretch of a brawl in which the
             Skiff landed round after round on a raider without finishing it
             read, on the page's own tally, as nothing happening at all. */
          if (!b.foe) W.tally.struck++;
          if (o.hp <= 0) downed(o);
          spent = true;
          break;
        }
      }
      if (spent) W.shots.splice(i, 1);
    }
    for (let i = W.rocks.length - 1; i >= 0; i--) {
      if (W.rocks[i].hp <= 0) { breakRock(W.rocks[i]); W.rocks.splice(i, 1); }
    }

    // ── the field ───────────────────────────────────────────────────────────
    const h = W.well;
    for (let i = W.rocks.length - 1; i >= 0; i--) {
      const r = W.rocks[i];
      gravity(r, dt);
      r.x += r.vx * dt; r.y += r.vy * dt;
      r.a += r.spin * dt;
      if (r.flash > 0) r.flash -= dt;
      // A well eats the field around it, which is most of what makes one a
      // place rather than a circle.
      if (h && Math.hypot(h.x - r.x, h.y - r.y) < h.kill + r.r * 0.5) {
        burst(r.x, r.y, h.kind === "hole" ? WARN : AMBER, 7, 190);
        W.tally.eaten++;
        W.rocks.splice(i, 1);
        continue;
      }
      // Let go of it a little way past the frame, not a screen past it: a wide
      // margin means most of the field is somewhere nobody can see, and the
      // count that keeps it topped up is a count of the wrong thing.
      if (r.x < rect.x0 - 420 || r.x > rect.x1 + 420 ||
          r.y < rect.y0 - 420 || r.y > rect.y1 + 420) W.rocks.splice(i, 1);
    }
    /* Kept topped up to the area on screen rather than to a fixed count, so a
       phone and a desktop see the same field and not the same number of rocks.
       New ones arrive just outside the frame, weighted to the side the ship is
       heading, because a rock that arrives behind you is a rock nobody sees. */
    const area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0);
    const want = clampv(Math.round(area / 55000), 8, 26);
    for (let guard = 0; W.rocks.length < want && guard < 4; guard++) {
      const m = 220;
      let x, y;
      if (rnd() < 0.62) {
        /* Ahead: on the edge the ship is flying towards, found by walking a ray
           out of the middle of the frame until it leaves the box. The first
           version used a circle of a fixed radius instead, which is fine on a
           square page and wrong on every other: on a landscape phone the box is
           twice as wide as it is tall, so a circle big enough to clear the
           sides put most of the field a screen and a half above and below it.
           Measured on an 810 by 398 canvas — thirty-seven rocks in the world
           and six of them on the page. */
        const lead2 = Math.atan2(s.vy, s.vx) + between(-0.9, 0.9);
        const ca = Math.cos(lead2), sa = Math.sin(lead2);
        const hw = (rect.x1 - rect.x0) / 2 + m, hh = (rect.y1 - rect.y0) / 2 + m;
        const reach = Math.min(Math.abs(hw / (ca || 1e-6)),
                               Math.abs(hh / (sa || 1e-6)));
        x = (rect.x0 + rect.x1) / 2 + ca * reach;
        y = (rect.y0 + rect.y1) / 2 + sa * reach;
      } else if (rnd() < 0.5) {
        x = rnd() < 0.5 ? rect.x0 - m : rect.x1 + m;
        y = between(rect.y0 - m, rect.y1 + m);
      } else {
        x = between(rect.x0 - m, rect.x1 + m);
        y = rnd() < 0.5 ? rect.y0 - m : rect.y1 + m;
      }
      // Never on top of the pilot, and never inside a well that would eat it
      // before it was ever drawn.
      if (Math.hypot(x - s.x, y - s.y) < 420) continue;
      if (h && Math.hypot(x - h.x, y - h.y) < h.kill * 3) continue;
      W.rocks.push(seedRock(x, y));
    }

    // Wearing a boulder. Not fatal, never fatal — a shove, a flash and a mark.
    for (const r of W.rocks) {
      const d = Math.hypot(r.x - s.x, r.y - s.y);
      if (d > r.r + HULL_R) continue;
      const nx = (s.x - r.x) / (d || 1), ny = (s.y - r.y) / (d || 1);
      s.x = r.x + nx * (r.r + HULL_R); s.y = r.y + ny * (r.r + HULL_R);
      s.vx += nx * 130; s.vy += ny * 130;
      s.hp = Math.max(0.25, s.hp - 0.05);
      s.flash = 0.2; r.flash = 0.2;
      burst(s.x, s.y, AMBER_D, 6, 180, 0.4);
      break;
    }

    // ── motes, and the dust ─────────────────────────────────────────────────
    if (h) {
      for (let i = 0; i < W.motes.length; i++) {
        const m = W.motes[i];
        gravity(m, dt);
        m.x += m.vx * dt; m.y += m.vy * dt;
        if (Math.hypot(h.x - m.x, h.y - m.y) < h.kill * 0.8) W.motes[i] = newMote(h);
      }
    }
    for (let i = W.bits.length - 1; i >= 0; i--) {
      const p = W.bits[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.vy *= 0.985;
      p.life -= dt;
      if (p.life <= 0) W.bits.splice(i, 1);
    }

    /* ── the camera ────────────────────────────────────────────────────────
       Ahead of the ship rather than on it, so the page shows where the run is
       going. The lead is capped in world units so the ship can never be shoved
       off its corner of the page and into the wordmark, however fast a black
       hole just threw it. */
    let lx = s.vx * 0.5, ly = s.vy * 0.5;
    const ll = Math.hypot(lx, ly);
    if (ll > 150) { lx *= 150 / ll; ly *= 150 / ll; }
    const f = Math.min(1, dt * 2.3);
    W.cam.x += (s.x + lx - W.cam.x) * f;
    W.cam.y += (s.y + ly - W.cam.y) * f;
  };

  /* ═══ DRAWING IT ══════════════════════════════════════════════════════════
     Screen space, by hand, one object at a time. Not a canvas transform: the
     whole look of this game is a hairline that is the same width whatever the
     zoom, and a scaled context makes it a width that depends on the page. */

  A.init = function (deps) { api = deps; return A; };

  function hullOf(kind) {
    const table = api && api.hulls;
    if (!table) return null;
    // The Skiff is what a survey starts in. The other two are picked out of the
    // same roster so the sector's traffic is the sector's traffic.
    return table[kind === "raider" ? "vane" : kind === "trader" ? "runner" : "skiff"];
  }

  function drawShip(s, sx, sy, Z, colour, alpha) {
    const { ctx, glow } = api;
    const spec = hullOf(s.kind);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.a);
    ctx.scale(Z, Z);
    if (spec && api.hull) {
      api.hull(spec, s.flash > 0 ? FLASH : colour, 1 / Z, alpha, { line: 1.7 });
    } else {
      glow(s.flash > 0 ? FLASH : colour, 1.7 / Z, alpha, () => {
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-10, 8); ctx.lineTo(-6, 0); ctx.lineTo(-10, -8);
        ctx.closePath();
        ctx.stroke();
      });
    }
    // The flame, drawn exactly as `drawShip` draws one: a chevron off the tail
    // that flickers rather than a cone that does not.
    if (s.thr > 0.15 && rnd() > 0.25) {
      glow(colour, 1.4 / Z, alpha * 0.85, () => {
        ctx.beginPath();
        ctx.moveTo(-7, 4);
        ctx.lineTo(-10 - rnd() * 9 * (0.4 + s.thr * 0.6), 0);
        ctx.lineTo(-7, -4);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  A.draw = function (x, y, w, h, now) {
    if (!api || w < 8 || h < 8) return false;
    const { ctx, glow } = api;

    /* The wall clock, because `update` only runs while a match does and every
       diorama drawn off the game's own `clock` was a still frame until somebody
       pressed start. Clamped, because a backgrounded tab hands back minutes. */
    const dt = W.last < 0 ? 0 : Math.min(0.05, Math.max(0, now - W.last));
    W.last = now;

    const k = Math.min(w, h) / 700;
    /* World units → screen pixels, off the short side, so the picture is the
       same picture on a phone and on a monitor rather than the same number of
       pixels. Chosen from the rock rather than the ship: at this the biggest
       boulder in the game is about a fourteenth of the page, which is a field
       you fly *through*. Draw it closer and the same field is four grey blobs. */
    const Z = 0.95 * k;
    /* Low and left. The middle of this page is the wordmark and two buttons,
       and a ship flying under them competes with the only things anybody came
       here to read. */
    const ax = x + w * 0.24, ay = y + h * 0.68;
    const rect = { x0: W.cam.x - (ax - x) / Z, x1: W.cam.x + (x + w - ax) / Z,
                   y0: W.cam.y - (ay - y) / Z, y1: W.cam.y + (y + h - ay) / Z };

    A.step(dt, rect);

    const sx = wx => ax + (wx - W.cam.x) * Z;
    const sy = wy => ay + (wy - W.cam.y) * Z;

    /* How loud a thing is allowed to be where it is. The text column is narrow
       and it does not run the height of the page, so the quieting is the product
       of both — which leaves the top and the bottom of the middle free, and that
       is where most of a slingshot happens.

       Light, because drawTitle already lays a scrim and a pool under the words
       and two curtains is one too many: at half strength a star crossing behind
       the buttons came out olive, which is not a colour this game has. The
       words are legible over a sun; let the sun be a sun. */
    const cx = x + w / 2, band0 = y + h * 0.14, band1 = y + h * 0.80;
    const clear = (px, py) => {
      const fx = 1 - Math.min(1, Math.abs(px - cx) / (w * 0.27 + 70));
      const fy = py < band0 ? Math.max(0, 1 - (band0 - py) / 90)
               : py > band1 ? Math.max(0, 1 - (py - band1) / 90) : 1;
      return 1 - 0.32 * fx * fy;
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#05070c";
    ctx.fillRect(x, y, w, h);

    /* ── the sky ────────────────────────────────────────────────────────────
       Sparse, small and amber, the way the sector's own motes are, at three
       depths — the parallax is what says the ship is travelling rather than the
       field drifting past it. */
    const layer = (frac, n, colour, size, lo) => {
      const span = 1500;
      ctx.save();
      ctx.fillStyle = colour;
      for (let i = 0; i < n; i++) {
        const ox = (i * 733.7) % span, oy = (i * 941.3) % span;
        let px = (ox - W.cam.x * Z * frac) % span; if (px < 0) px += span;
        let py = (oy - W.cam.y * Z * frac) % span; if (py < 0) py += span;
        px += x - (span - w) / 2; py += y - (span - h) / 2;
        if (px < x || px > x + w || py < y || py > y + h) continue;
        ctx.globalAlpha = (lo + 0.34 * Math.abs(Math.sin(i * 2.1))) * clear(px, py);
        ctx.fillRect(px, py, size, size);
      }
      ctx.restore();
    };
    layer(0.06, 130, "#7a6a3a", 1.2, 0.10);
    layer(0.22, 64, AMBER_D, 1.4, 0.14);
    layer(0.55, 24, AMBER, 1.8, 0.22);

    // ── the well ────────────────────────────────────────────────────────────
    const hz = W.well;
    if (hz) {
      const hx = sx(hz.x), hy = sy(hz.y), R = hz.kill * Z;
      const near = hx > x - hz.reach * Z && hx < x + w + hz.reach * Z &&
                   hy > y - hz.reach * Z && hy < y + h + hz.reach * Z;
      if (near) {
        const a = clear(hx, hy);
        // The debris stream first, under everything, so the eye reads the
        // inward flow before it reads the thing pulling.
        ctx.save();
        ctx.fillStyle = hz.kind === "hole" ? WARN : AMBER_D;
        for (const m of W.motes) {
          const mx = sx(m.x), my = sy(m.y);
          if (mx < x || mx > x + w || my < y || my > y + h) continue;
          const d = Math.hypot(hz.x - m.x, hz.y - m.y) / hz.reach;
          ctx.globalAlpha = (0.62 - d * 0.42) * clear(mx, my);
          ctx.fillRect(mx, my, 1.7, 1.7);
        }
        ctx.restore();

        if (hz.kind === "star") {
          /* Drawn the way `drawHazard` draws one: a filled disc at seven tenths,
             a ring at the edge, another inside it, and a corona of twelve spokes
             of two lengths, turning. The only fill in the game, bar the hole. */
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = hz.fill;
          ctx.beginPath(); ctx.arc(hx, hy, R * 0.7, 0, TAU); ctx.fill();
          ctx.restore();
          glow(hz.fill, 1.6, a, () => {
            ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.stroke();
          });
          glow(hz.fill, 1.2, 0.55 * a, () => {
            ctx.beginPath(); ctx.arc(hx, hy, R * 0.6, 0, TAU); ctx.stroke();
          });
          glow(hz.fill, 1.3, 0.7 * a, () => {
            ctx.beginPath();
            const spin = W.t * 0.25 * PACE + hz.phase;
            for (let i = 0; i < 12; i++) {
              const t = spin + (i / 12) * TAU;
              const len = R * (i % 2 ? 1.5 : 1.28);
              ctx.moveTo(hx + Math.cos(t) * R * 1.08, hy + Math.sin(t) * R * 1.08);
              ctx.lineTo(hx + Math.cos(t) * len, hy + Math.sin(t) * len);
            }
            ctx.stroke();
          });
        } else {
          // The hole itself: solid black, so anything behind it is genuinely
          // gone. Then the accretion ring, squashed and turning.
          const spin = W.t * 0.6 * PACE + hz.phase;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = "#000";
          ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.fill();
          ctx.restore();
          /* Three rings rather than the game's one. Out there you meet a hole
             already knowing what it is and there is a HUD telling you; here it
             is a black disc on a black page, and one squashed ellipse round it
             reads as a smudge. Nested and counter-turning it reads as depth,
             which is the only way a hole is ever visible at all. */
          ctx.save();
          ctx.translate(hx, hy);
          ctx.rotate(spin * 0.35);
          ctx.scale(1, 0.42);
          for (let i = 0; i < 3; i++) {
            glow(WARN, 1.7 - i * 0.4, a * (0.95 - i * 0.28), () => {
              ctx.beginPath();
              ctx.arc(0, 0, R * (1.85 + i * 0.75), 0, TAU);
              ctx.stroke();
            });
          }
          ctx.restore();
          glow(WARN, 1.4, 0.85 * a, () => {
            ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.stroke();
          });
        }
      }
    }

    // ── the station ─────────────────────────────────────────────────────────
    const st = W.station;
    if (st) {
      const px = sx(st.x), py = sy(st.y), R = st.r * Z;
      if (px > x - R * 2 && px < x + w + R * 2 && py > y - R * 2 && py < y + h + R * 2) {
        const a = clear(px, py) * 0.9;
        const spin = W.t * 0.22 * PACE + st.phase;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(spin);
        // A ring on three struts: legible at a glance from any distance, and
        // unmistakably not a rock.
        glow(CASH, 2, a, () => {
          ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.stroke();
          for (let i = 0; i < 3; i++) {
            const t = (i / 3) * TAU;
            ctx.beginPath();
            ctx.moveTo(Math.cos(t) * R * 0.2, Math.sin(t) * R * 0.2);
            ctx.lineTo(Math.cos(t) * R * 0.62, Math.sin(t) * R * 0.62);
            ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(0, 0, R * 0.19, 0, TAU); ctx.stroke();
        });
        ctx.restore();
        // The dock ring, which the game only draws when somebody is close
        // enough for it to mean anything.
        const near = Math.hypot(st.x - W.ship.x, st.y - W.ship.y) < LAP_R * 2.4;
        if (near) {
          glow(CASH, 1.4, (0.34 + 0.2 * Math.sin(W.t * 3)) * a, () => {
            ctx.beginPath(); ctx.arc(px, py, 260 * Z, 0, TAU); ctx.stroke();
          });
        }
      }
    }

    // ── rock ────────────────────────────────────────────────────────────────
    for (const r of W.rocks) {
      const px = sx(r.x), py = sy(r.y), R = r.r * Z;
      if (px < x - R || px > x + w + R || py < y - R || py > y + h + R) continue;
      const a = clear(px, py);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(r.a);
      glow(r.flash > 0 ? FLASH : AMBER_D, r.flash > 0 ? 2 : 1.5, a, () => {
        ctx.beginPath();
        for (let i = 0; i < r.shape.length; i++) {
          const t = (i / r.shape.length) * TAU;
          const rr = R * r.shape[i];
          const qx = Math.cos(t) * rr, qy = Math.sin(t) * rr;
          i ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy);
        }
        ctx.closePath();
        ctx.stroke();
      });
      ctx.restore();
    }

    // ── debris ──────────────────────────────────────────────────────────────
    ctx.save();
    ctx.lineCap = "round";
    for (const p of W.bits) {
      const px = sx(p.x), py = sy(p.y);
      if (px < x || px > x + w || py < y || py > y + h) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max) * clear(px, py);
      ctx.strokeStyle = p.colour;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - p.vx * 0.012 * Z, py - p.vy * 0.012 * Z);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── rounds ──────────────────────────────────────────────────────────────
    for (const b of W.shots) {
      const px = sx(b.x), py = sy(b.y);
      if (px < x - 60 || px > x + w + 60 || py < y - 60 || py > y + h + 60) continue;
      glow(b.colour, 2.6, clear(px, py), () => {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - b.vx * 0.008 * Z, py - b.vy * 0.008 * Z);
        ctx.stroke();
      });
    }

    // ── everybody else, then the pilot ──────────────────────────────────────
    for (const o of W.others) {
      if (!o.alive) continue;
      const px = sx(o.x), py = sy(o.y);
      if (px < x - 60 || px > x + w + 60 || py < y - 60 || py > y + h + 60) continue;
      drawShip(o, px, py, Z * SHIP_ART, o.kind === "raider" ? RAIDER : CASH,
               clear(px, py) * (o.kind === "raider" ? 1 : 0.85));
    }

    const me = W.ship;
    const mx = sx(me.x), my = sy(me.y);
    drawShip(me, mx, my, Z * SHIP_ART, AMBER, 1);
    // Taken a round. A ring rather than a bar, because a front page has no HUD.
    if (me.flash > 0) {
      glow(WARN, 1.6, Math.min(1, me.flash * 4), () => {
        ctx.beginPath(); ctx.arc(mx, my, HULL_R * 1.5 * Z, 0, TAU); ctx.stroke();
      });
    }

    ctx.restore();
    return true;
  };

  window.KondriteAttract = A;
})();
