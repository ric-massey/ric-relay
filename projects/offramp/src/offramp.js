/* ══════════════════════════════════════════════════════════════════════
   OFFRAMP.

   The car, the rules, the loop, and the noise.

   ── what changed, and why it had to ─────────────────────────────────
   This started as a strip of road that scrolled downward past a car
   that could only slide left and right, and there is a version of that
   which is a perfectly good game. It is not this one. The moment the
   road is allowed to *go somewhere* — to bend, to fork, to hand you
   over to another road — the car needs a heading, and once the car has
   a heading the screen has to rotate, because a top-down car that
   points in forty different directions is unreadable and unsteerable.

   So: the car is bolted to one spot on the screen facing up, and the
   world turns underneath it. You are never steered. Not on the main
   line, not through a gore, not on a ramp, not past a red light. The
   ramp is a place the tarmac goes; taking it is a thing you do with
   the steering wheel and nothing else.

   ── nobody else is here ────────────────────────────────────────────
   Traffic existed, worked, and has been deleted — the map is being
   rebuilt from a fictional region into one real corridor, and cars
   that pick exits are worth nothing until the exits are the right
   ones. Signals, queues and everything you could hit come back with
   it. Until then the road itself is the whole opponent: the barrier,
   the gore, the verge, and how fast you are taking them.

   ── the camera is on the road, not on the car ──────────────────────
   This is the decision the whole feel hangs off, and it is worth being
   explicit about because the obvious alternative is wrong.

   The obvious version: give the car a heading, let steering turn it,
   and rotate the screen to keep the car pointing up. It works, and it
   feels awful. Every flick of the wheel to slip through a gap swings
   the entire world a few degrees, so a lane change — the most ordinary
   thing you do here, several times a second — reads as the horizon
   lurching. You end up fighting the picture instead of the traffic.

   What we do instead: the camera takes the heading of the *road under
   the car*. Left and right move you across that road and nothing else,
   exactly as they did when this game was a straight strip, and the car
   is drawn bolt upright at every moment. The view turns when the road
   turns, and at no other time.

   Freeways now carry broad, design-speed curves (see FREEWAY_CURVE in
   world.js), so the picture turns slowly through the long sweep of a
   main line and more decisively on a ramp. The rotation is not scenery
   — it is the thing that tells you the road itself changed direction.

   ── and the camera does not slide either ───────────────────────────
   Same argument, one axis over. The camera sits on the road's
   centreline, not on the car: it advances with you and turns with the
   road, but it does not track you across it. Steer right and the road
   stays exactly where it is on screen while the car moves over — which
   is what it did when this was a fixed strip, and it is right for the
   same reason. A road that shifts sideways every time you change lane
   is a road you cannot read a gap in.

   `camU` is where on the cross-section the camera sits, and the only
   time it moves is at a handover: peel onto a ramp and it slides over
   the width of the carriageway you just left, because the thing it is
   centred on has changed. That pan is the exit happening.

   ── so the car is tracked, not free ────────────────────────────────
   The player carries a road, a distance along it and an offset across
   it, the same three numbers every AI car carries. It is not on rails:
   `u` is yours, and the road only ever hands you to another road at a
   gore, and only if you were in the exit lane when you crossed it.
   Nothing steers for you. But the game does know which tarmac you are
   on, and it knows because it is written down rather than inferred.
   ══════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  const R = Road, X = Raster;

  /* ── the speed scale, which is not a feel setting ───────────────────
     One world pixel is 0.179 m, so one km/h is (1000/3600)/0.179 =
     1.55183 px/s. It was 1.55, which is 0.118% slow — 220 mph read as
     219.74. Nobody would ever notice, and it costs nothing to be right:
     the whole point of this corridor is that a distance in the game is
     the distance on the road. */
  const M_PER_PX = 0.179;
  const PX_PER_KMH = (1000 / 3600) / M_PER_PX;   // 1.55183
  const KMH_PER_MPH = 1.609344;
  const pxs = (kmh) => kmh * PX_PER_KMH;

  /* Once the top speed; now a fixed REFERENCE SPEED, and the difference
     matters enough to be worth the paragraph.

     There is a garage as of today (`data/cars.js`), so "top speed" is a
     property of what you are driving and lives on `S.car.vTop` — 193
     km/h in the Jetta, 330 in the built 911. But V_MAX was never only a
     ceiling: a dozen expressions in this file normalise on it to get a
     "how fast is this, roughly" fraction, and they feed the barrier
     drag, the wreck severity, the damage drag and the audio.

     Those are PHYSICAL rates and they must not become car-relative. A
     Jetta scraping a barrier at 100 mph has to lose paint at the same
     rate as a 911 scraping it at 100 mph, and if the normaliser were
     each car's own top speed the Jetta — at 83% of its maximum against
     the Porsche's 49% — would grind nearly twice as hard for the same
     collision. That is not a small tuning difference, it is the crash
     model quietly disagreeing with itself about what a speed is.

     So the value is unchanged at 220 mph and every existing use of it is
     unchanged with it, which is also why the crash suite and the sim
     fingerprints do not move. Only the throttle, the brakes, the
     ceiling and the steering scale read `S.car`.

     The scale itself is exact: held at 70 mph the car covers 70.000
     miles in a simulated hour. */
  const V_MAX = 220 * 1.609344, V_GRAVEL = 118;
  const LAT_MAX = 124;                   // px/s across the road, at low speed

  /* Reverse, which is a car park and not a freeway: about 15 mph, and
     reached briskly because the whole of reverse is a three-point turn
     on a hard shoulder. Held apart from V_MAX on purpose — a reverse
     scaled off the top speed of a car that does 220 would be absurd.
     REV_ACC is km/h per second, like every other longitudinal rate in
     this file, and the term it feeds asymptotes toward V_REVERSE rather
     than clipping at it, so backing up does not read as a limiter. */
  const V_REVERSE = 24, REV_ACC = 34;

  /* ══════════════════════════════════════════════════════════════════
     what a hit costs

     The old rule was that everything you could touch killed you. Kerb
     the median, put two wheels in the grass, clip the nose of a gore —
     same outcome, instantly, at any speed. What replaced that was four
     bespoke tests with four hand-tuned thresholds, one per thing you
     could hit, each fitted against feel on its own. They did not agree
     with each other and there was no way to add a fifth.

     Traffic needs a fifth — car into car — and then a sixth, car into
     car into barrier, and nobody can tune that. So the whole of it now
     goes through one solver in src/impact.js: planar impulse-momentum
     with Coulomb friction, in SI, checked against published crash
     figures in test/impact.test.js rather than against how it feels.

     A barrier is the case where the other mass is infinite. That is the
     entire trick, and the arithmetic needs no branch for it.

     ── the governing rule ───────────────────────────────────────────
     Realism beats interest. If the accurate answer is boring, the
     boring answer ships. The low end of every curve goes to ZERO, not
     to "a small chance": two wheels onto the grass at 40 mph is a
     non-event, because that is what it is in life. Nothing here is
     nudged to make it matter.

     ── what is left in this file ────────────────────────────────────
     The costs that are a RATE rather than an event — surface drag, the
     grind along a wall you are leaning on — because those are friction
     and not collisions. Every impact is one call to the solver, and
     everything that used to be a threshold is now a probability with
     the arithmetic printed on the panel afterwards.
     ══════════════════════════════════════════════════════════════════ */

  /* ── SI, at the boundary and nowhere else ───────────────────────────
     The solver is pure SI and never sees a pixel or a km/h. It has to
     be: the impulse-momentum equations have mass in them, and a mass
     has no meaning in a unit system whose length is a screen pixel.
     Convert on the way in, convert on the way out. */
  const IM = Impact;
  const pxs2ms = (v) => v * M_PER_PX;
  const ms2pxs = (v) => v / M_PER_PX;
  const kmh2ms = (v) => v / 3.6;
  const ms2kmh = (v) => v * 3.6;

  /* what the barrier costs while you are leaning on it, per second.
     Kept from the old model unchanged, because a sustained grind is
     friction rather than a collision and the solver has nothing to say
     about it. Worth more at speed because up there the wall is
     removing the car rather than the paint. The arrival — the bang, the
     bite, the redirect off the face — is now the solver's, once per
     contact, and BAR_BITE and BAR_KICK are gone with it. */
  const BAR_DRAG = 8, BAR_DRAG_V = 22;

  /* the field. Drag is km/h per second, and there is a second, harder
     figure above the speed at which soft ground starts to pile up in
     front of the wheels rather than pass under them. */
  const V_DIRT = 90;
  const DIRT_DRAG = 34, DIRT_PLOUGH = 60, DIRT_GRIP = 0.42;
  const GRAVEL_GRIP = 0.66;

  /* ══════════════════════════════════════════════════════════════════
     steering, and the section of the crash model that was rejected

     CRASH-MODEL.md §8 wanted the wheel to command an ACCELERATION
     bounded by a friction circle, on the grounds that the rate-chase
     below is asking for twenty-seven g and that no tyre can hold the
     forty-two degree slip angle LAT_MAX implies at 50 mph. Both of
     those observations are true.

     It was built, measured and thrown out, and the reason is the first
     paragraph of this file rather than anything about tyres. This car
     is bolted to one spot on the screen and the world turns underneath
     it; left and right are not a steering wheel, they are the only
     thing you have, and they have to answer like a rail. Under §8 the
     car took nine tenths of a second to change lane and carried on for
     most of another lane after you let go. It read as lag, because it
     was lag.

     So the steering is exactly what it was, and the numbers below are
     the numbers that were always here.

     ── which the crash model then has to live with ──────────────────
     §13 of the document lists "implementing §4 without §8" as a trap,
     and it is right about what happens: full lock at 220 mph puts
     52.7 km/h of sideways into the median and the solver calls that
     lethal, every time, because it is. That is not a regression — the
     old BAR_KILL threshold said exactly the same thing — but it does
     mean the document's headline claim, that the median becomes
     "usually survivable from the adjacent lane", does not hold here.
     Everything else in the model does, and what it buys is real: a
     graduated outcome instead of a threshold, an attenuator that is a
     crush stroke, a fence that is a fence, a rollover floor that is a
     hard zero, and one solver that traffic can be dropped straight
     into. See the verification note at the top of test/impact.test.js.

     ── and it is per-vehicle, because it has to become one ──────────
     A loaded truck does not change lane like a sports car. This was a
     pair of module constants when the player was the only thing on the
     road; it is a table now, keyed by what you are driving, so that
     traffic can carry its own and so the player's car can one day be
     a choice. `latMax` is the sideways rate at a standstill, `fade`
     how much of it the speed takes away, and `respond` how quickly the
     wheel is answered — 13 is a 77 ms time constant.

     The player's row is the old constants to the digit. Nothing about
     how the car drives today is a new decision.
     ══════════════════════════════════════════════════════════════════ */
  const STEER = {
    car:   { latMax: LAT_MAX, fade: 0.34, respond: 13 },
    // for traffic. Nothing reads these yet; they are here so that the
    // shape of the question is settled before there is an argument.
    suv:   { latMax: LAT_MAX * 0.86, fade: 0.38, respond: 10 },
    truck: { latMax: LAT_MAX * 0.55, fade: 0.42, respond: 5.5 },
    bike:  { latMax: LAT_MAX * 1.05, fade: 0.30, respond: 15 },
    /* A tall box on narrow wheels, and the row exists because the Type 2
       would otherwise fall back to `car` and change direction like a
       Civic. It sits between the SUV and the lorry: `latScale` off the
       skidpad already takes the grip away, so what this adds is the
       LAG — the thing leans, waits, and then goes. */
    van:   { latMax: LAT_MAX * 0.70, fade: 0.44, respond: 7 },
  };

  /* A garage row's steering, which is its CLASS's row scaled by the two
     figures data/cars.js derives — skidpad grip against a 0.85 g
     reference, and responsiveness off the square root of mass.

     The scaling is honest about being a modelling choice rather than
     physics: `latMax` is a lateral velocity the wheel commands, not an
     acceleration, so tying it to skidpad g asserts that a grippier car
     lets you ask for more sideways. Defensible; not derivable. The
     reference is set where the old single car sat, so a mid-pack row
     drives exactly as this game did before there was a choice. */
  function steerFor(car) {
    const base = STEER[car.klass] || STEER.car;
    return {
      latMax: base.latMax * car.latScale,
      fade: base.fade,
      respond: base.respond * car.respondScale,
    };
  }
  /* ── how far past the verge the right-of-way fence is, in px ────────
     28 px is 5 m of field, which puts the fence about 9.7 m out from
     the edge of the travelled way once the shoulder and the verge are
     counted — which is the clear zone a real Interstate is built with,
     and far enough that going off is a place you drive back from rather
     than an edge you fall off.

     It is also the furthest the picture can follow you, and that is the
     tighter of the two constraints. The camera rides the road's
     centreline biased toward YOUR carriageway so the whole six-lane
     cross-section stays readable, which crops the far verge on purpose
     — and leaves the near verge at 173 px across a 224 px screen, so
     there are about 45 px of visible field and no more. The far side is
     unreachable anyway now that the median does not let anything
     through it, so the near side is the only one that has to fit. */
  const DIRT_MAX = 28;

  /* ── digging a wheel in ─────────────────────────────────────────────
     Leaving the road is not a collision. It is a friction and moment
     problem, and it is genuinely stochastic: two identical cars leaving
     the road at the same speed and angle do not have the same outcome,
     and what differs is whether that particular wheel found a rut, a
     drain, a soft patch or a stone. That is unknowable, so a
     probability is the honest model and a threshold is not.

     The floor is not a probability, though. To roll, the CG has to be
     lifted over the outside tyre, and below 16.6 km/h of sideways there
     is not enough energy in the car to do it — ever, not rarely. See
     Impact.V_CRIT; it is an energy balance and not a tuning choice, and
     it is what makes a low-speed excursion the non-event it is in life.

     What replaced the old TRIP_KILL / V_TRIP / TRIP_DIG trio:

       - the dig timer is gone. It existed to stop the old test firing on
         tarmac-derived lateral speed on the first frame off the
         pavement; with the friction circle in place those speeds are
         physical and the window is unnecessary.
       - the risk is evaluated ONCE, on the frame the car crosses onto
         soil, and not again until it has been back on pavement. Rolling
         the dice sixty times a second makes any nonzero probability a
         certainty inside a fifth of a second, which is the single most
         likely way to get this wrong.
       - forward speed no longer decides WHETHER. Rollover initiation is
         a lateral phenomenon and is very nearly independent of how fast
         you are going. Forward speed decides how many times the car
         goes over, and therefore how it ends.

     SOIL is which ground you went off onto. There is one verge on this
     road so far and it is an ordinary one; the others are here because
     the fill slopes and the ploughed fields are coming. */
  const SOIL = IM.SOIL.verge;

  /* What a big slide costs when the dice come up in your favour, which
     is most of the time. It has to be violent: if the good outcome is
     calm and the bad one ends the run, the model reads as the game
     picking on you, and if both are violent and only one ends it, it
     reads as luck — which is exactly what it is. */
  const SLIDE_SCRUB = 0.45;              // fraction of speed a survived trip costs

  /* The impact attenuator was here, as a crush stroke on the nose of a
     gore. There is no attenuator on this road any more — see the note
     in handovers() — because one is bolted to the end of a barrier run
     and an ordinary interchange's gore has no barrier in it. The crush
     model itself is not gone: `Impact.crushStop` is what hitWorks()
     uses for the barrels across the closed ramp at exit 368, which are
     really there and really signed. */

  /* the wreck itself: a corner is on the ground and it is steering the
     car. `PULL` is the sideways acceleration it drags you off with,
     `TORQUE` the rate it spins you at, both scaled by how much speed
     is left to work with — a stopped wreck stops moving. */
  const WRECK_PULL = 120, WRECK_TORQUE = 6;

  /* ── it is always the middle of the morning ─────────────────────────
     Draw still carries the whole day: dawn warmth, dusk warmth, night,
     headlights, lit signs, the lot, cycling on distance — see the time
     of day block at the top of draw.js, none of which has been touched
     and all of which still works. This holds the clock at one hour of
     it, because a road you are learning to read should not go dark on
     you halfway through learning it.

     Set this to null and the cycle runs again exactly as it did. 0.10
     is mid-morning: night() and warmth() are both flat zero there, so
     the picture is the untinted one. */
  const DAY_LOCK = 0.10;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* Why a run ended. `traffic` and `queue` used to live here and went
     with traffic.js — nothing on this road moves but you, so the only
     things that can end a run are the geometry ones below. They come
     back with the cars. */
  const WHY = {
    barrier: ["you found the barrier", "the middle of the road is not a lane",
              "steel, and then nothing"],
    /* `gore` was here — "you split the difference", "the nose of the
       gore was there first". Nothing raises it any more: there is no
       object in a gore to be hit. Splitting the difference now puts you
       on the grass between two roads, and what that costs is `trip`. */
    /* Leaving the pavement is no longer a way to end a run — it is a
       surface, and a bad one. These two are what the field does to you
       if you take it badly enough, and they are not the same thing:
       `trip` is going sideways in soft ground at speed, which stands a
       car on its door handles, and `fence` is running out of right of
       way. */
    trip:    ["a wheel dug in", "soft ground took the front corner",
              "you tripped over your own tyre"],
    fence:   ["the right of way ended", "you found the fence line",
              "that field belongs to somebody"],
    /* A tyre that was damaged in an earlier impact letting go later,
       with no proximate cause, which is how they nearly always go. */
    blowout: ["a tyre let go", "the sidewall had been waiting",
              "it went at the worst possible moment"],
    /* Kept because a surface can still be missing under you in ways the
       verge model does not cover, and because it is the only sentence
       that reads right when it happens. */
    road:    ["you left the road", "the grass is not a lane",
              "the verge ran out"],
    /* Every road on this map hands on to another one — that is what the
       perimeter loop is for. Reaching the end of one anyway means you
       drove past the last interchange on a corridor and out the far
       side, which is a thing you can do and which has to mean
       something. It used to mean the picture froze while the odometer
       kept counting. */
    end:     ["the road ran out", "that was the end of it",
              "there is nothing past here"],
    /* An exit that was signed, coned and shut a mile and a half before
       you took it. There is no bad luck in this one and the wording
       says so. */
    works:   ["the road was closed", "they did warn you about this one",
              "barrels, and then the end of the pavement"],
    /* The fifth case impact.js was unified for. Split by who ran into
       whom, because on a motorway those are two different mistakes and
       the driver knows which one they made. */
    rearend: ["you ran out of room", "the traffic ahead did not move",
              "there was a car there a moment ago"],
    shunted: ["somebody else ran out of room", "you were hit from behind",
              "it came out of the mirror"],
    swipe:   ["you and somebody wanted the same lane",
              "the lane was taken", "you were already alongside"],
    /* The other carriageway. There is one thing on this road that is
       always your fault and this is it. */
    headon:  ["you were on the wrong side of the road",
              "both of you were going somewhere", "that side was taken"],
  };

  const S = {
    mode: "title",
    t: 0,
    /* where the car is: a road, how far along it, how far across it.
       x, y and h are derived from those three every frame and are for
       drawing and collisions only — never write to them. */
    road: null, s: 0, u: 0, vu: 0,
    /* Which way round the road you are pointing. Traffic has carried
       this since the day it was written — a vehicle is a road, a
       direction, a distance and an offset — and the player was the one
       thing on the map nailed to `fwd`. That is why there was no way to
       reach the opposite carriageway: not because the roads lacked one,
       but because the car could not face it. */
    fwd: true,
    x: 0, y: 0, h: 0, speed: 96,
    camU: 0, camX: 0, camY: 0, camH: 0,
    parts: [], marks: [],
    /* What `cars.js` handed over for this frame to draw. Never written
       by anything but the frame loop, and never read by anything that
       decides — the traffic model does not know there is a screen. */
    traffic: null,
    /* `score` mirrors score.js's carried pot for the HUD; the pot
       itself lives there. The old `mult`/`combo`/`comboT` trio went
       with the four-second exit combo it drove. */
    distPx: 0, score: 0,
    topSpeed: 0, exits: 0,
    shake: 0, flash: 0, wreckT: 0, why: "", cause: "road",
    gravelT: 0, newBest: false, hints: new Map(),
    onWhat: "lane", aimLane: 1,
    /* What is in the garage, and which row of STEER it drives like.
       `S.car` is a row out of data/cars.js and it owns four things and
       only four: the pull, the brakes, the top speed and the mass.
       Everything else about how the game behaves is unchanged by it.

       The comment that used to be here said this was "a lookup rather
       than a constant because ... the player may one day get a choice."
       That day is today; `setCar` below is where the choice lands. */
    car: Garage.get(Garage.DEFAULT),
    steer: steerFor(Garage.get(Garage.DEFAULT)),
    /* ── the car's own heading, and it is the only one there is ───────
       `S.h` is the ROAD's heading and stays exact — the camera turns to
       it and the wheels are tested against it. `roll` is how far the
       car is turned out of that, and outside a wreck it is zero, which
       is the whole argument in the header of this file: the car does
       not turn, the road does.

       A wreck is the one time that has to stop being true. A car
       dragging a corner along the tarmac is pointing somewhere other
       than where it is going, and that is most of what makes it read
       as a wreck rather than as a stall. The camera keeps facing down
       the road while it happens, so the world does not spin — only the
       car does, in front of you. */
    roll: 0, spin: 0, wreckSide: 1, panelShown: false,
    /* How long you have been grinding along the barrier, how long since
       you last touched it, and the sideways rate the barrier is
       commanding as it steers you off itself.

       Two timers rather than one because a grind is not continuous
       contact. The wall shoves you off, the wheel brings you back, and
       the car bounces along the face several times a second — so the
       plain "are we touching this frame" test called every one of those
       bounces a fresh impact, charged the full arrival cost for each,
       and fired the bang sound at machine-gun rate. `scrapeOff` is how
       the two are told apart: one contact, until you have been clear of
       it for a third of a second. */
    scrapeT: 0, scrapeOff: 9,
    /* ── the excursion latch ────────────────────────────────────────
       Whether the car is currently off the pavement on an excursion
       whose dice have already been rolled. The rollover risk is
       evaluated on the frame you cross onto soil and NOT again until
       you have been back on tarmac — at 120 Hz, re-rolling a 2%
       chance every frame is a certainty inside a second, which would
       make the honest low end of the curve read as a lie. */
    onSoil: false,
    /* And the same latch for a wreck piled against the median: the
       arrival is one impact, the grind afterwards is a rate. */
    wallT: 0,
    /* ── damage is a state, not an event ────────────────────────────
       The `damage` outcome band means the run continues with the car
       degraded, which is what makes this model produce degrees rather
       than a binary. `tyres` is FL FR RL RR, 0..1. `pull` is a bent
       corner, in px/s² of steering bias. `dragK` is bodywork you are
       no longer carrying. `blown` is the tyre that has actually
       failed, which happens LATER and usually with no warning. */
    dmg: null,
    /* What the last impact worked out to, kept so the wreck panel can
       print the arithmetic. Seeing the odds after the fact is how a
       probabilistic model stops reading as arbitrary. */
    report: null, dvTotal: 0,
    /* Book-keeping for the skill score. See src/skill.js. */
    sk: null,
  };

  /* A fresh damage record. Held in a function because reset() and the
     first run both need one and neither should know its shape. */
  const freshDamage = () => ({
    tyres: [0, 0, 0, 0], pull: 0, dragK: 0, blown: null,
    blownT: 0, blownFront: false, capped: false,
    wentOff: false, braked: false,
    /* Cosmetic only — 0..1 of accumulated scraping. Nothing reads it
       but the paintwork; `dragK` is what a scrape actually costs. */
    scuff: 0,
  });

  const BEST_KEY = "offramp.best.v2";
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { best = 0; }

  const keys = new Set();
  /* The four buttons and the drag, which are to `steerInput` and
     `throttleInput` what `keys` is: state, held, read once a frame. */
  const touch = { steer: 0, brake: false, gas: false, left: false, right: false,
                  active: false, lastX: 0 };
  /* Everything let go of at once — on a blur, on the map opening, on
     anything that takes the screen away mid-corner. A held button whose
     release lands somewhere else is a car that keeps turning. */
  function touchRelease() {
    touch.steer = 0; touch.brake = touch.gas = touch.left = touch.right = false;
    touch.active = false;
    for (const id of ["brake", "gas", "steer-l", "steer-r"]) {
      const b = document.getElementById(id);
      if (b) b.classList.remove("on");
    }
  }
  let isTouch = false;

  /* ── canvas, and how the buffer reaches the glass ───────────────────
     The buffer used to be a fixed 256 × 416 and the cabinet it has to
     fill is whatever the page gives us, which is never that shape. The
     old answer was to letterbox: scale by the SMALLER of the two ratios
     and leave bezel down the sides. Two things were wrong with it.

     The bars were black. On a monitor the cabinet is well over twice as
     wide as 256 world pixels, so a third of the screen was the inside
     of a television and not the outside of a road.

     And it made the game SMALLER on the smaller screen. A phone is the
     narrower of the two shapes, so on a phone the width won the `min`
     and the whole picture came out at 1.44 CSS px per world pixel where
     a desktop got 1.39 — near enough the same number on a screen a
     quarter of the size, held at arm's length. A car eleven pixels wide
     is fine on a monitor and a speck on a phone.

     So the buffer is not a fixed shape any more. We choose the SCALE
     first, and the buffer is whatever fits in the cabinet at that
     scale — nothing is letterboxed on either axis, and the edges of the
     screen are ground rather than bezel. `Draw.resize` takes the
     numbers; see the note there for what follows from them.

     ── choosing the scale ───────────────────────────────────────────
     The scale is the largest one at which you can still see everything
     you actually need to see, which is two separate things:

       WANT_W  200 world px across — your own carriageway, the median,
               and the first lane of the other one. Below this you are
               steering blind into your own blind spot.
       WANT_H  368 world px along — 300 ahead and 68 behind, which is
               the 54 m of lookahead the 256 × 416 buffer always gave
               and which is what a sign has to be readable within.

     Take the smaller of the two and a phone is limited by its width, a
     monitor by its height, and each gets the biggest picture its own
     shape allows: measured, a 375 px phone goes from 1.44 to 1.80 CSS
     px per world pixel (a quarter bigger, with the same road ahead) and
     a 1280 desktop from 1.39 to 1.52 with the black bars replaced by
     403 world pixels of width instead of 256.

     ── and then the scale reaches the glass ─────────────────────────
     Handing a fractional scale to a nearest-neighbour upscale is what
     made the lane markings pulse.

     Measured: the buffer was shown at 353×574 CSS px on a 2× display,
     which is 2.758 device pixels per buffer pixel. Nearest-neighbour
     cannot draw 2.758 of anything, so it drew 2 device pixels for some
     buffer pixels and 3 for others, in a pattern that shifts as the
     content moves underneath it. A one-pixel line therefore changed
     thickness by 50% depending on where it happened to land — on top of
     everything the rasteriser was already doing right.

     The fix is the standard one for pixel art at a fractional scale, and
     it is two draws instead of one:

       buffer ──nearest, ×K──▶ mid ──bilinear, ×(scale/K)──▶ screen

     K is the scale rounded UP, so the first step is a whole-number
     upscale — perfectly uniform, every source pixel exactly K device
     pixels — and the second is a mild DOWNscale, where bilinear costs a
     sub-pixel softening of the edges and nothing else. Every buffer
     pixel ends up the same 2.758 device pixels wide, which is the whole
     point. The chunky look survives because the pixel grid is still a
     grid; it is only the boundary between two of them that stops being
     a lie.

     The canvas itself is now sized in DEVICE pixels, so the browser does
     no resampling of its own on top of ours. */
  const cvs = document.getElementById("road");
  const ctx = cvs.getContext("2d", { alpha: false });

  const bufCvs = document.createElement("canvas");
  bufCvs.width = Draw.VW; bufCvs.height = Draw.VH;
  const bufCtx = bufCvs.getContext("2d", { alpha: false });
  X.attach(bufCtx, Draw.VW, Draw.VH);          // so there is a buffer even if `fit` bails

  const midCvs = document.createElement("canvas");
  const midCtx = midCvs.getContext("2d", { alpha: false });

  /* What you must be able to see, in world pixels.

     ACROSS, it is your own carriageway and no more: the median on one
     side, your verge on the other, and enough ground past both that the
     edge of the screen is grass rather than somebody else's tarmac.
     Three lanes with both shoulders and a verge is 94.5 px, four is
     115, so 130 frames the widest carriageway on the corridor with a
     little ground to spare and frames the usual one generously. What is
     going the other way is not part of driving and does not get a
     width allowance; on a screen with room for it, it comes along
     anyway — see `camTarget`.

     ALONG, it is 430 px. It was 368 — 300 ahead, the 54 m the old fixed
     buffer always gave — and the reason it can go up is that the title
     and the readouts moved off the top of the screen and the key hints
     came off the bottom, so the cabinet is most of the window's height
     now instead of two thirds of it. 430 is about 62 m of road in front
     of you at the framing below, which is a second and a half more than
     before at 70 mph. (Ric, 2026-08-13: "i want to lengthen how far you
     can see in front of you.") */
  const WANT_W = 130, WANT_H = 430;
  /* Except that a phone cannot have both. The two allowances are met by
     one scale, so the buffer is always the cabinet's own shape — and a
     phone is roughly twice as tall as it is wide, which means 368 px of
     road along it buys about 200 across whatever WANT_W says. The width
     never binds, the picture never zooms, and the carriageway you are
     driving on stays half the size it should be. That is the shape of
     the original complaint.

     So a TALL cabinet spends some of its lookahead on magnification and
     a wide one does not, which is also the honest answer physically: a
     phone is held at arm's length and a monitor is not. At 1.85:1 —
     any ordinary phone — the allowance is 330 px. That is still the
     cost of filling a tall screen with the road you are on, but a much
     smaller one than it was: the rail took two full-width bands off the
     top of the cabinet and the key hints off the bottom, so a phone has
     half the chrome to pay for and can afford 330 where it could only
     afford 276. */
  const WANT_H_TALL = 330, TALL_AT = 1.85;
  /* How large a world pixel is ever allowed to get. The page holds the
     whole cabinet to 640 CSS px wide, so on a desktop the width term is
     near enough a constant and it is the HEIGHT of the window that
     decides the scale — and a tall enough window would otherwise go on
     zooming past any of this. Past the cap the extra height buys road
     AHEAD instead of magnification, which is what a tall window is
     for. */
  const ZOOM_MAX = 2.5;
  /* And what the rasteriser is willing to pay for any of it. A pixel
     here is a pixel written by hand every frame, and the old fixed
     buffer was 106k of them. Past these the picture zooms in further
     rather than growing, which is also the right way round: a cabinet
     that large is not being looked at from further away. */
  const VW_MAX = 460, VH_MAX = 560;

  const stage = document.getElementById("stage");
  const frame = document.getElementById("frame");
  function fit() {
    /* The CONTENT box: clientWidth includes the stage's own padding, and
       counting it made the canvas overflow its bezel by the padding on
       every side, where `overflow: hidden` quietly cut the shadow off. */
    const cs = getComputedStyle(stage);
    const w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (!(w > 0) || !(h > 0)) return;

    /* Square or wider asks for the full 368 along; a phone asks for
       WANT_H_TALL; in between it slides, so that resizing a window
       never steps the picture. */
    const tall = Math.max(0, Math.min(1, (h / w - 1) / (TALL_AT - 1)));
    const wantH = WANT_H + (WANT_H_TALL - WANT_H) * tall;

    let s = Math.min(w / WANT_W, h / wantH, ZOOM_MAX);
    s = Math.max(s, w / VW_MAX, h / VH_MAX);   // never a buffer bigger than the ceiling
    const VW = Math.max(64, Math.round(w / s)), VH = Math.max(64, Math.round(h / s));
    /* Unconditional, so that `Draw` and the buffer can never disagree
       about the shape of the picture. Reallocating the buffer is not:
       resize fires in streams during a drag, and an ImageData and a
       coverage mask per event is a lot of garbage for no new pixels. */
    Draw.resize(VW, VH);
    if (VW !== bufCvs.width || VH !== bufCvs.height) {
      bufCvs.width = VW; bufCvs.height = VH;
      X.attach(bufCtx, VW, VH);
    }

    const cw = Math.round(VW * s), ch = Math.round(VH * s);
    cvs.style.width = cw + "px"; cvs.style.height = ch + "px";
    frame.style.width = cw + "px"; frame.style.height = ch + "px";

    const dpr = window.devicePixelRatio || 1;
    cvs.width = Math.max(1, Math.round(cw * dpr));
    cvs.height = Math.max(1, Math.round(ch * dpr));
    ctx.imageSmoothingEnabled = true;          // the gentle half of the pair
    ctx.imageSmoothingQuality = "high";

    /* Round the scale UP so the nearest-neighbour step never has to
       shrink anything — shrinking with nearest is how you drop whole
       rows of pixels. */
    const k = Math.max(1, Math.ceil(cvs.width / VW), Math.ceil(cvs.height / VH));
    /* The buffer can change shape without k changing with it, so the
       test is on the mid canvas itself and not only on k. */
    if (midCvs.width !== VW * k || midCvs.height !== VH * k) {
      midCvs.width = VW * k; midCvs.height = VH * k;
    }
    midCtx.imageSmoothingEnabled = false;      // resizing a canvas resets this
  }
  addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  fit();

  /* One finished frame, from the buffer to the glass. */
  function present() {
    midCtx.drawImage(bufCvs, 0, 0, midCvs.width, midCvs.height);
    ctx.drawImage(midCvs, 0, 0, cvs.width, cvs.height);
  }

  /* ══════════════════════════════════════════════════════════════════
     sound — one engine, some tyre noise, a horn, a crash. No files.
     ══════════════════════════════════════════════════════════════════ */
  const A = { ctx: null, muted: false, ready: false };

  function audioStart() {
    if (A.ctx || A.muted) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ac = new AC();
    A.ctx = ac;
    A.master = ac.createGain(); A.master.gain.value = 0.5; A.master.connect(ac.destination);

    /* ── the engine ───────────────────────────────────────────────────
       (Ric, 2026-08-13: "simulate them for what the engine is actually
       made like.")

       This was one sawtooth at 58 + v·0.62 Hz with a square an octave
       under it. Nothing in that is an engine — it is a note that goes up
       with road speed, so every car in the garage made the same noise
       and none of them changed gear.

       An engine is a series of BANGS. A four-stroke fires cyl/2 times
       per revolution, so what you hear has a fundamental of

           rpm/60 · cyl/2

       and that one expression is why a Harley and an S1000RR are not
       the same instrument: 2 cylinders to 5,500 rpm is 92 Hz at the
       limiter, 4 cylinders to 14,200 is 473. It is also why the rpm has
       to come from a GEARBOX and not from road speed — an engine that
       rises and drops back is the single most recognisable thing about
       one, and no amount of timbre substitutes for it.

       Four oscillators, because the harmonic that dominates is what
       separates the layouts:

         h1   the firing frequency itself
         h2   its second harmonic — the body of an inline engine
         h05  HALF of it, once per two revolutions: a V-twin's uneven
              315/405 interval and a flat-four's unequal headers both
              put real energy down here, and it is exactly the "potato"
              and the boxer rumble
         rasp a detuned partial up top, for the ones that have one

       `A.mix` below sets the four levels per layout. Nothing else about
       the sound is per-car; everything audible follows from the row. */
    A.eng = ac.createGain(); A.eng.gain.value = 0;
    A.engLP = ac.createBiquadFilter(); A.engLP.type = "lowpass"; A.engLP.frequency.value = 800;
    A.eng.connect(A.engLP); A.engLP.connect(A.master);

    A.part = {};
    const part = (name, type, gain) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = 80;
      const g = ac.createGain(); g.gain.value = gain;
      o.connect(g); g.connect(A.eng); o.start();
      A.part[name] = { o, g };
    };
    part("h05",  "square",   0.0);
    part("h1",   "sawtooth", 0.6);
    part("h2",   "square",   0.2);
    part("rasp", "sawtooth", 0.0);

    const len = ac.sampleRate * 2;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = ac.createBufferSource(); A.noise.buffer = buf; A.noise.loop = true;
    A.nBP = ac.createBiquadFilter(); A.nBP.type = "bandpass"; A.nBP.frequency.value = 1400; A.nBP.Q.value = 0.8;
    A.nG = ac.createGain(); A.nG.gain.value = 0;
    A.noise.connect(A.nBP); A.nBP.connect(A.nG); A.nG.connect(A.master);
    A.noise.start();
    A.ready = true;
  }

  /* ── how loud each partial is, per layout ───────────────────────────
     Four numbers each: [half-order, firing, second, rasp]. These are
     the only per-layout settings in the audio, and each one is a claim
     about the engine rather than a taste:

       i      an even-firing inline. Almost all of it is at the firing
              frequency and its second harmonic, and there is nothing at
              the half order because nothing happens once per two revs.
       flat   a boxer. The unequal-length headers put a real half-order
              component in — that IS the Subaru rumble, and it is why a
              flat-four does not sound like the inline-four it otherwise
              is on paper.
       v      a cross-plane V8. Its half order is the burble, and the
              rasp is the overlap you hear off the top of one.
       vtwin  45 degrees and a 315/405 firing interval, so it fires
              twice and then waits — the loudest thing in a Harley is
              the once-per-two-revs beat, not the firing frequency, and
              that inversion is the whole of the "potato". */
  const ENG_MIX = {
    i:     [0.00, 0.62, 0.24, 0.05],
    flat:  [0.26, 0.50, 0.16, 0.10],
    v:     [0.30, 0.46, 0.22, 0.16],
    vtwin: [0.60, 0.30, 0.10, 0.05],
  };
  const ENG_DEF = { cyl: 4, layout: "i", idle: 800, red: 6500 };

  /* ── a gearbox, for the sound and nothing else ──────────────────────
     No torque curve, no clutch and no effect on how the car moves: the
     physics is unchanged and this exists so the note DROPS when the
     revs run out.

     TOP GEAR IS LONG, and that is the part worth getting right rather
     than assuming. Six evenly spaced ratios across the whole speed
     range is the obvious model and it is audibly wrong: it put the
     Jetta at 4,500 rpm at 70 mph, where a real one sits near 2,800,
     because it had two more gears to go. Real gearing is five ratios to
     get you going and then one very long one to cruise in — top gear
     here starts at 45% of the car's top speed and stretches to the
     limiter, so 70 mph in a 120 mph car is a third of the way up top
     gear and sounds like it.

     The clamp at `frac` matters: past top speed — downhill, or with the
     speed the wreck code can hand it — the note would otherwise climb
     past the limiter forever. */
  const GEARS = 6, TOP_AT = 0.45;
  function engineRpm(v, car) {
    const e = (car && car.eng) || ENG_DEF;
    const vTop = car ? car.vTop : V_MAX;
    const frac = vTop > 0 ? Math.min(1, Math.abs(v) * (1 / PX_PER_KMH) / vTop) : 0;
    let within;
    if (frac >= TOP_AT) within = (frac - TOP_AT) / (1 - TOP_AT);
    else {
      const lower = (frac / TOP_AT) * (GEARS - 1);
      within = lower - Math.floor(lower);         // 0 at a change, 1 at the limiter
    }
    return e.idle + (e.red - e.idle) * (0.30 + 0.70 * within);
  }

  function audioFrame() {
    if (!A.ready || A.muted) return;
    const ac = A.ctx, now = ac.currentTime;
    const playing = S.mode === "play";
    const v = S.speed;
    const e = (S.car && S.car.eng) || ENG_DEF;
    const mix = ENG_MIX[e.layout] || ENG_MIX.i;
    A.eng.gain.setTargetAtTime(playing ? 0.05 : 0, now, 0.08);

    /* The one line the whole thing rests on: a four-stroke fires half
       its cylinders every revolution. */
    const rpm = engineRpm(v, S.car);
    const fire = Math.max(12, (rpm / 60) * (e.cyl / 2));
    /* A gear change is a step in `fire`, so the glide has to be short
       enough to be a change and not a swoop — 25 ms. */
    A.part.h05.o.frequency.setTargetAtTime(fire * 0.5, now, 0.025);
    A.part.h1.o.frequency.setTargetAtTime(fire, now, 0.025);
    A.part.h2.o.frequency.setTargetAtTime(fire * 2, now, 0.025);
    A.part.rasp.o.frequency.setTargetAtTime(fire * 3.02, now, 0.025);
    const load = playing ? 1 : 0.35;
    A.part.h05.g.gain.setTargetAtTime(mix[0] * load, now, 0.08);
    A.part.h1.g.gain.setTargetAtTime(mix[1] * load, now, 0.08);
    A.part.h2.g.gain.setTargetAtTime(mix[2] * load, now, 0.08);
    A.part.rasp.g.gain.setTargetAtTime(mix[3] * load, now, 0.08);
    /* Opens with the revs rather than with road speed, so a downchange
       shuts the engine up and picking it back up brightens it. */
    A.engLP.frequency.setTargetAtTime(360 + fire * 5.5, now, 0.1);
    const rough = S.gravelT > 0 ? 1 : 0;
    const scrub = Math.min(1, Math.abs(S.vu) / LAT_MAX);
    /* Grinding down the barrier is the loudest thing this car does and
       it is the wrong noise entirely — not tyres, but a long metal
       shriek off the top of the same band of static.

       Gated on the rub and not on the contact, for the reason
       grindRate() gives: a car stopped against the median is touching
       it, and touching it makes no noise. Below a twentieth of the
       grind the whole band hands back to ordinary road noise rather
       than sitting at the shriek's filter with the gain turned down —
       what you hear at a standstill should be the road, not a quiet
       scream. */
    const gr = S.mode === "play" && S.scrapeT > 0 ? grindRate() : 0;
    const grind = gr > 0.05;
    A.nG.gain.setTargetAtTime(
      !playing ? 0
        : grind ? (0.10 + v / V_MAX * 0.05) * gr
        : rough ? 0.062
        : 0.012 + v / V_MAX * 0.02 + scrub * 0.03, now, grind ? 0.02 : 0.05);
    A.nBP.frequency.setTargetAtTime(
      grind ? 3200 + v * 4 : rough ? 520 : 1500 + scrub * 900, now, grind ? 0.02 : 0.06);
    A.nBP.Q.setTargetAtTime(grind ? 5.5 : 0.8, now, 0.05);
  }

  function blip(type) {
    if (!A.ready || A.muted) return;
    const ac = A.ctx, now = ac.currentTime, g = ac.createGain();
    g.connect(A.master);
    if (type === "horn") {
      g.gain.value = 0; g.gain.linearRampToValueAtTime(0.16, now + 0.02);
      g.gain.setValueAtTime(0.16, now + 0.28); g.gain.linearRampToValueAtTime(0, now + 0.34);
      [370, 466].forEach((f) => {
        const o = ac.createOscillator(); o.type = "square"; o.frequency.value = f;
        o.connect(g); o.start(now); o.stop(now + 0.36);
      });
    } else if (type === "pass") {
      g.gain.value = 0.07; g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 900;
      o.frequency.exponentialRampToValueAtTime(1500, now + 0.11);
      o.connect(g); o.start(now); o.stop(now + 0.13);
    } else if (type === "exit") {
      // two notes, up — the only unambiguously good thing that happens
      [660, 990].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = f;
        const gg = ac.createGain(); gg.gain.value = 0;
        gg.gain.setValueAtTime(0, now + i * 0.09);
        gg.gain.linearRampToValueAtTime(0.1, now + i * 0.09 + 0.02);
        gg.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.22);
        o.connect(gg); gg.connect(A.master); o.start(now + i * 0.09); o.stop(now + i * 0.09 + 0.24);
      });
    } else if (type === "scrape") {
      // the first contact with the wall: a short, bright bang of metal
      const len = Math.floor(ac.sampleRate * 0.18);
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4);
      const src = ac.createBufferSource(); src.buffer = b;
      const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2200;
      g.gain.value = 0.2;
      src.connect(hp); hp.connect(g); src.start(now);
    } else if (type === "thud") {
      /* Crushable barrels doing what they are for: a lot of low noise
         and no ring to it at all. */
      const len = Math.floor(ac.sampleRate * 0.4);
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
      const src = ac.createBufferSource(); src.buffer = b;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
      g.gain.value = 0.42;
      src.connect(lp); lp.connect(g); src.start(now);
      const o = ac.createOscillator(); o.type = "sine"; o.frequency.value = 120;
      o.frequency.exponentialRampToValueAtTime(45, now + 0.34);
      const og = ac.createGain(); og.gain.value = 0.2;
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      o.connect(og); og.connect(A.master); o.start(now); o.stop(now + 0.39);
    } else if (type === "crash") {
      const len = Math.floor(ac.sampleRate * 0.7);
      const b = ac.createBuffer(1, len, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
      const src = ac.createBufferSource(); src.buffer = b;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
      g.gain.value = 0.5;
      src.connect(lp); lp.connect(g); src.start(now);
      const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = 180;
      o.frequency.exponentialRampToValueAtTime(38, now + 0.6);
      const og = ac.createGain(); og.gain.value = 0.22;
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      o.connect(og); og.connect(A.master); o.start(now); o.stop(now + 0.66);
    }
  }

  const muteBtn = document.getElementById("mute");
  function setMuted(m) {
    A.muted = m;
    muteBtn.setAttribute("aria-pressed", String(m));
    // the word is hidden on narrow screens by CSS; the glyph is not
    muteBtn.innerHTML = m ? '✕<span class="word"> MUTED</span>' : '♪<span class="word"> SOUND</span>';
    muteBtn.setAttribute("aria-label", m ? "Unmute sound" : "Mute sound");
    if (m && A.ready) { A.eng.gain.value = 0; A.nG.gain.value = 0; }
    if (!m) audioStart();
  }
  muteBtn.addEventListener("click", () => { setMuted(!A.muted); });

  /* ══════════════════════════════════════════════════════════════════
     particles and marks — both now live in the world, not on the
     screen, because the screen is no longer a fixed window onto it
     ══════════════════════════════════════════════════════════════════ */
  const PC = Draw.partCols;
  function puff(x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      const p = { x, y, life: 0, max: 0.5, size: 1, col: 0, vx: 0, vy: 0 };
      if (kind === "dust") { p.vx = rnd(-16, 16); p.vy = rnd(-16, 16); p.max = rnd(0.28, 0.6); p.col = pick(PC.dust); }
      /* Sparks are struck, not thrown: they leave the contact patch
         fast, live briefly and die where they land. */
      else if (kind === "spark") { p.vx = rnd(-95, 95); p.vy = rnd(-95, 95); p.max = rnd(0.09, 0.26); p.col = pick(PC.spark); }
      else if (kind === "debris") { p.vx = rnd(-70, 70); p.vy = rnd(-70, 70); p.max = rnd(0.35, 0.9); p.col = pick(PC.debris); }
      else if (kind === "smoke") { p.vx = rnd(-9, 9); p.vy = rnd(-9, 9); p.max = rnd(0.9, 1.9); p.col = pick(PC.smoke); p.size = 2; }
      else { p.vx = rnd(-30, 30); p.vy = rnd(-30, 30); p.max = rnd(0.3, 0.8); p.col = pick(PC.fire); p.size = 2; }
      S.parts.push(p);
    }
    if (S.parts.length > 340) S.parts.splice(0, S.parts.length - 340);
  }

  function updateParts(dt) {
    for (const p of S.parts) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.6 * dt;
    }
    if (S.parts.length) S.parts = S.parts.filter((p) => p.life < p.max);
    if (S.marks.length > 300) S.marks.splice(0, S.marks.length - 300);
  }

  /* Two black lines where the tyres are. The angle is an argument
     because a wreck lays them at the angle the CAR is pointing, which
     during a wreck is not the angle of the road — a car sliding
     sideways gouges across its own path, and that is most of what the
     mark is for. */
  /* ── and a bike lays ONE ──────────────────────────────────────────
     (Ric, 2026-08-13: "when breaking with the bike there are two tire
     tracks.") It laid two because the offsets here were the literal
     4 and 12 of the 11 x 26 car this game used to have and only ever
     have — the same hardcoded body that `draw.js` had to take out of
     the scrape marks and the headlight beam. On the S1000RR they put
     the tracks 1.4 m apart, which is wider than the motorcycle.

     A motorcycle's wheels are IN LINE. It leaves one black line, and
     that single line is most of what a locked bike looks like from
     above. So the track count is a property of the vehicle, and the
     offsets are fractions of its real body: the rear axle 6/13 of the
     length behind the middle and the tyre 4/11 of the width out from
     it. Those two fractions are written as fractions and not as 0.46
     and 0.36 because they are exactly the old hardcoded 12 and 4 over
     the old hardcoded 26 and 11 — so every car in the garage still
     lays its marks precisely where this game has always laid them, and
     only the bike changes. */
  const MARK_BACK = 6 / 13, MARK_HALF = 4 / 11;
  function mark(a) {
    const h = a === undefined ? S.h : a;
    const c = Math.cos(h), s = Math.sin(h);
    const lenPx = (S.car ? S.car.len : PL * M_PER_PX) / M_PER_PX;
    const widePx = (S.car ? S.car.wide : PW * M_PER_PX) / M_PER_PX;
    const back = lenPx * MARK_BACK;
    if (S.car && S.car.klass === "bike") {
      S.marks.push({ x: S.x - s * back, y: S.y - c * back, h });
      return;
    }
    const half = widePx * MARK_HALF;
    S.marks.push({ x: S.x - c * half - s * back, y: S.y + s * half - c * back, h });
    S.marks.push({ x: S.x + c * half - s * back, y: S.y - s * half - c * back, h });
  }

  /* ══════════════════════════════════════════════════════════════════
     the car
     ══════════════════════════════════════════════════════════════════ */
  const PW = 11, PL = 26;                 // 1.97 m × 4.65 m at road scale
  const HALF_L = PL * M_PER_PX / 2, HALF_W = PW * M_PER_PX / 2;    // m

  /* ══════════════════════════════════════════════════════════════════
     the impact pipeline

     Four things on this road can hit you and a fifth is coming. All
     five go through here, in this order, and the order is the point:

       build a body  →  solve  →  weigh  →  judge  →  land

     `weigh` turns a delta-v into an EFFECTIVE delta-v, which is the
     only currency the injury curves understand. `judge` rolls the dice
     once — once, not once per band — and `land` applies whatever came
     up. Nothing between here and impact.js knows what was hit.

     ── the frame ────────────────────────────────────────────────────
     Everything here works in the CAR's frame: +y straight ahead, +x
     out of the driver's right window, metres and seconds. `S.vu` is
     already the x of that and `S.speed` is already the y, which is why
     the conversion in and out is two multiplications and no rotation.
     ══════════════════════════════════════════════════════════════════ */
  const FWD = { x: 0, y: 1 };

  /* ── the one place the slip angle still has to be honest ────────────
     `S.vu` is how fast you cross the road, and it is a control
     abstraction rather than a velocity: the wheel commands it directly
     and it answers in 77 ms, which is what makes the car feel like it
     is on rails and which is the whole point of the thing. Nothing
     about that is going to change.

     But the solver is not an abstraction. Hand it 71 km/h of sideways
     at 113 km/h forward — which is what full lock at 70 mph asks for —
     and it is being told about a car at a 32° slip angle, which is a
     car that is already spinning and is not what is on the screen. The
     consequence was visible and plainly wrong: full lock into the
     median came out MORE lethal at 70 mph than at 220, because `want`
     fades with speed and nothing else bounded it.

     So the conversion into SI is also where the slip angle is made
     physical: no tyre holds much past twelve degrees, so no car under
     control arrives at anything faster than that fraction of its road
     speed. It costs nothing in feel — this is the boundary of the
     solver, not of the steering — and it restores the model's actual
     claim, which is that what hurts you is how much sideways you
     brought, bounded by how much sideways you could have had.

     A WRECK is exempt and must be: a car sliding broadside genuinely
     is going sideways at ninety degrees, and that is most of what
     makes the second impact the one that kills. The wreck path calls
     carBody() directly. */
  const SLIP_MAX = Math.tan(12 * Math.PI / 180);
  const underControl = (vu, speedKmh) => {
    const cap = pxs(Math.abs(speedKmh)) * SLIP_MAX;
    return clamp(vu, -cap, cap);
  };

  /* The player as a rigid body, and the mass is now whatever is in the
     garage. `impact.js` was already mass-general — it carries a BODIES
     table with a 1500 kg car, a 2270 kg SUV and a 36 tonne semi, and
     `solve()` takes the masses it is handed — so this is a lookup
     replacing a constant and not a change to the crash model.

     It is, however, the whole character of the motorcycle. 197 kg
     against a 2,400 kg pickup is a mass ratio of twelve, and every
     consequence of that — being thrown by contacts a car would not
     report, and taking a far larger share of the closing speed in any
     impact — falls out of the solver without one line anywhere that
     says "bike". */
  function carBody(vu, speedKmh, spin, r) {
    return {
      m: S.car ? S.car.kg : IM.CAR_MASS,
      Iz: S.car ? S.car.Iz : IM.CAR_IZ,
      v: { x: pxs2ms(vu), y: kmh2ms(speedKmh) },
      /* `roll` grows from +y toward +x, which is clockwise, and the
         solver's yaw is counter-clockwise positive. Hence the sign,
         and it is inverted again on the way back out. */
      w: -(spin || 0),
      r: r || { x: 0, y: 0 },
    };
  }

  /* ── where the blow landed, when the car is not pointing straight ───
     Whichever corner is furthest INTO the thing that was hit, which is
     the corner that reached it first. Only a wreck needs this — driving
     the car, `roll` is zero to the bit and the contact is a flat flank,
     which is exactly the mid-flank case the crash figures are quoted
     for. A spinning wreck is a different problem: the corner is off the
     centre of gravity, so the impulse yaws the car, which is most of
     what makes a wreck against a wall look like one. */
  function deepestCorner(out) {
    const c = Math.cos(S.roll), s = Math.sin(S.roll);
    const fx = s, fy = c, rx = c, ry = -s;         // forward and right, car frame
    let best = { x: 0, y: 0 }, deep = Infinity;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const p = { x: fx * HALF_L * a + rx * HALF_W * b,
                  y: fy * HALF_L * a + ry * HALF_W * b };
      const along = p.x * out;                     // n̂ is (out, 0)
      if (along < deep) { deep = along; best = p; }
    }
    return best;
  }

  /* ── the car, as something else could hit it ────────────────────────
     Nothing consumes this yet, and that is deliberate: traffic is next,
     a pileup is a chain of secondary impacts, and the shape of "what
     can be struck" should be settled before there is traffic arguing
     about it. Same body the solver takes, plus where it is. A wreck is
     a collidable thing on this road exactly as a moving car is. */
  function playerBody() {
    return {
      kind: "player", wrecked: S.mode === "wreck",
      road: S.road, s: S.s, u: S.u, fwd: S.fwd,
      x: S.x, y: S.y, h: S.h, roll: S.roll,
      halfL: HALF_L, halfW: HALF_W,
      body: carBody(S.vu, S.speed, S.spin),
    };
  }
  const bodies = () => [playerBody()];

  /* Delta-v in m/s, the bearing the blow arrived from, and optionally
     the mean deceleration if it was not an ordinary crush pulse. Out
     comes the number the curves are written against. */
  function weigh(dvMs, angleDeg, gMean) {
    const g = gMean === undefined || gMean === null
      ? dvMs / IM.CONTACT_T / IM.G : gMean;
    const dirF = IM.directionFactor(angleDeg);
    const ride = IM.rideDownFactor(g, dvMs);
    return {
      dv: ms2kmh(dvMs), angle: angleDeg, gMean: g,
      dirF, ride, dvEff: ms2kmh(dvMs) * dirF * ride,
    };
  }

  /* One uniform roll against cumulative thresholds. Rolling separately
     per band produces fatal-but-not-disabling, which is nonsense. */
  function judge(w) {
    /* Nothing to roll for down here. See Impact.SUPERFICIAL: the
       injury curves have a left tail that never quite reaches zero,
       and read outside the range they were fitted over it says a paint
       scrape kills one driver in a thousand. It does not. */
    if (w.dvEff <= IM.SUPERFICIAL) {
      w.pFatal = 0; w.pDisabling = 0; w.roll = null;
      w.outcome = "superficial";
      return w;
    }
    const sev = (w.dvEff - 25) / 55;
    w.pFatal = Skill.adjust(IM.pFatal(w.dvEff), sev);
    w.pDisabling = Skill.adjust(IM.pDisabling(w.dvEff), sev);
    w.roll = Math.random();
    w.outcome = w.roll < w.pFatal ? "fatal"
              : w.roll < w.pDisabling ? "disabling" : "damage";
    return w;
  }

  /* Apply it. Returns true if the run is over, so every caller can
     bail on the same line. */
  function land(w, cause, side, corner) {
    judge(w);
    S.report = w;
    S.dvTotal += w.dv;
    if (w.outcome === "fatal" || w.outcome === "disabling") {
      crash(cause, side, w);
      return true;
    }
    if (w.outcome === "damage") damage(w, !!corner);
    /* Nobody hurt is not nothing happened — see `scuff`. Barriers and
       fences come through here too and mark the car the same way, which
       is right: a wall takes paint off exactly like a wing does. */
    else if (scuff(w, !!corner)) note("SCRAPE");
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     a note on every pull figure below

     The specification quotes these as accelerations in px/s² — ±25,
     ±60, ±180 for a blowout — and an acceleration is the one thing a
     pull cannot be here. Steering commands a RATE: the wheel centred
     means "cross the road at zero", so the model actively corrects any
     acceleration you hand it and a dragging corner does nothing at
     all. Measured, with the literal figure: doing nothing about a
     blown front tyre recovered forty times out of forty.

     This file used to carry a long comment about exactly this on
     BAR_KICK — an impulse "is gone before it has moved the car a
     pixel" — and the kick was written as a rate for that reason. The
     kick was deleted with the rest of the old barrier code and the
     trap immediately caught the next thing that came past.

     So a pull is a commanded RATE too, quoted as a fraction of the
     car's own `latMax` so it scales with whatever is driving. That is
     the one frame in which "hold against it" means anything, and it
     puts a blowout at a little over half of full lock: hard, holdable,
     and lost the moment you touch the brake.
     ══════════════════════════════════════════════════════════════════ */
  const PULL_LIGHT = 0.10, PULL_HEAVY = 0.22;            // a bent corner
  const PULL_CAP = 0.45;                                 // however much you accumulate
  const PULL_BLOWN = 0.55, PULL_LIMP = 0.20;             // a failed tyre, and after

  /* ── what a survivable impact leaves behind ─────────────────────────
     Where the blow landed decides which corner is bent. A negative
     bearing is a blow from the car's right — see Impact.blowAngle — and
     a bent corner pulls the car toward the side that took it. */
  function damage(w, corner) {
    const d = S.dmg;
    const a = Math.abs(((w.angle + 180) % 360 + 360) % 360 - 180);
    const right = w.angle < 0;
    const i = (a <= 90 ? 0 : 2) + (right ? 1 : 0);        // FL FR RL RR
    const pull = right ? 1 : -1;
    if (w.dvEff < 25) {
      d.dragK += 0.04;                                   // bodywork. cosmetic.
      /* A corner hit loads the wheel behind it whatever band it lands
         in, and this band used to be the one place that was not true:
         `scuff` puts 0.09 into a tyre at 11.9 km/h and this put ZERO in
         at 12.1, so a harder blow did less damage than a softer one.
         Interpolated across the band instead, from `scuff`'s 0.09 where
         it hands over to the 0.35 of the band above, so the whole curve
         from a paint scrape to a folded corner is continuous. */
      if (corner) {
        const f = clamp((w.dvEff - IM.SUPERFICIAL) / (25 - IM.SUPERFICIAL), 0, 1);
        d.tyres[i] = Math.min(1, d.tyres[i] + 0.09 + (0.35 - 0.09) * f);
      }
    } else if (w.dvEff < 40) {
      d.tyres[i] = Math.min(1, d.tyres[i] + 0.35);
      d.pull += pull * PULL_LIGHT;
      d.dragK += 0.06;
    } else {
      d.tyres[i] = Math.min(1, d.tyres[i] + 0.70);
      d.pull += pull * PULL_HEAVY;
      d.dragK += 0.10;
      d.capped = true;                                   // 70% of top speed, now
    }
    d.pull = clamp(d.pull, -PULL_CAP, PULL_CAP);
    d.dragK = Math.min(0.5, d.dragK);
    note("DAMAGE");
  }

  /* ── and what a SCRAPE leaves behind ────────────────────────────────
     (Ric, 2026-08-12: "cosmetic damage to me and the other vehicles,
     sometimes a tyre blows out and totals you if you hit it just right.
     drag sure.. but keep the damage so it feels realistic to a real car
     at those speeds.")

     Everything under `IM.SUPERFICIAL` used to be free — and `land()` is
     right not to roll injury for it, because the injury curves read
     outside their range say a paint scrape kills one driver in a
     thousand. But "nobody is hurt" is not "nothing happened", and
     clipping corners down the carriageway at 70 costing precisely
     nothing is what made the traffic feel like scenery.

     The scale is the real thing at these speeds and deliberately small.
     A same-direction clip carries 1–4 km/h of effective delta-v: that
     is panels, a mirror, and a scrub of paint. So this is `damage()`'s
     own first band — the cosmetic one — scaled down by how far below
     superficial the blow was, and it takes a lot of clipping to reach
     anything you would notice in the drag.

     ── the tyre is the one that can end you, and only on a CORNER ────
     A blow across a door does not touch a wheel. One on the corner
     loads it, breaks the sidewall internally, and the tyre lets go
     later with no proximate cause — which is exactly the hazard model
     `blowoutRate` already implements and which nothing under 25 km/h
     could previously feed. `sim.js` now says whether only the corners
     were engaged, so "if you hit it just right" is a geometric fact
     about the impact rather than a dice roll.

     0.09 a clip against `blowoutRate`'s 0.25 floor means three good
     corner clips before a tyre is live at all, and it climbs from
     there. Nothing blows at the moment of contact — it is a rate, so it
     lands a minute later on an empty road, which is the whole point of
     modelling it that way. */
  function scuff(w, corner) {
    const d = S.dmg;
    const bite = clamp(w.dvEff / IM.SUPERFICIAL, 0, 1);
    if (bite < 0.08) return false;                 // a kiss. paint at most.
    const a = Math.abs(((w.angle + 180) % 360 + 360) % 360 - 180);
    const right = w.angle < 0;
    const i = (a <= 90 ? 0 : 2) + (right ? 1 : 0);        // FL FR RL RR
    d.dragK = Math.min(0.5, d.dragK + 0.012 * bite);
    d.scuff = Math.min(1, (d.scuff || 0) + 0.20 * bite);
    if (corner) d.tyres[i] = Math.min(1, d.tyres[i] + 0.09 * bite);
    return true;
  }

  /* What the engine can still reach — the CAR's top speed, not the
     reference. A car with a corner folded into the wheel arch does not
     do its own top speed either, and 70% of it is the same fraction it
     always was. */
  const vMax = () => {
    const vt = S.car ? S.car.vTop : V_MAX;
    return S.dmg && S.dmg.capped ? vt * 0.70 : vt;
  };

  /* ── tyres fail later, and that is the accurate part ────────────────
     A tyre damaged in an impact very often does not let go at the
     moment of impact. The sidewall breaks internally, the cords go, and
     it fails afterwards with no proximate cause at all — which is why
     this is a hazard rate and not a threshold. At full damage and 200
     km/h it is 0.0056 per second, a mean time to failure of about three
     minutes of driving, so it lands when you have stopped expecting it.
     That is the whole point of modelling it this way. */
  const blowoutRate = (dmg, v) => (dmg < 0.25 ? 0
    : 0.010 * (dmg - 0.25) ** 2 * (v / 200) ** 2);

  /* ── and a blowout is not a crash ───────────────────────────────────
     It is a loss of control with a correct response and a real window,
     and the correct response is the one that saves people in life: do
     not brake, do not lift hard, hold it straight and let the car slow
     itself. Braking inside the window is what puts the car off the
     road. You have 1.2 seconds. */
  const BLOW_WINDOW = 1.2;

  function blow(i) {
    const d = S.dmg;
    d.blown = i; d.blownT = 0; d.blownFront = i < 2;
    d.wentOff = false; d.braked = false;
    const left = i % 2 === 0;
    if (d.blownFront) {
      // a hard steering pull toward the failed side. Hold against it.
      d.pull = (left ? -1 : 1) * PULL_BLOWN;
    } else {
      // a yaw, not a pull — and the first time `roll` is nonzero
      // anywhere outside a wreck.
      S.spin += (left ? -1 : 1) * 1.2;
    }
    S.shake = Math.max(S.shake, 5);
    puff(S.x, S.y, 10, "debris");
    blip("thud");
    note(d.blownFront ? "FRONT TYRE" : "REAR TYRE");
  }

  function tyreCheck(dt) {
    const d = S.dmg;
    if (d.blown !== null) {
      d.blownT += dt;
      if (!(S.onWhat === "lane" || S.onWhat === "shoulder")) d.wentOff = true;
      if (throttleInput() < 0) {
        /* Braking on a failed tyre loads the corner that has already
           gone: it pulls harder, it starts to come round, and the
           friction circle has already taken the grip you would have
           steered out of it with. This is the mistake the mechanic
           exists to punish, and it is the mistake people make. */
        d.braked = true;
        d.pull = clamp(d.pull * (1 + 1.6 * dt), -3, 3);
        S.spin += (d.pull >= 0 ? 1 : -1) * 1.8 * dt;
      }
      if (d.blownT >= BLOW_WINDOW) {
        /* What is asked at the end of the window is not "is the car
           tidy" but "did you do the right thing" — keep it on the
           pavement and keep off the brake. Judging it on the tidiness
           of the lateral velocity punishes the over-correction a
           binary steering input forces on the player, and it hands the
           save to anyone who did nothing at all, because a wheel let
           go commands zero sideways and the model would obligingly
           deliver it. */
        if (!d.wentOff && !d.braked) {
          // caught it. The corner still drags, but the car is yours.
          d.tyres[d.blown] = 0;
          d.dragK = Math.min(0.5, d.dragK + 0.08);
          d.pull = clamp(d.pull, -PULL_LIMP, PULL_LIMP);
          d.blown = null; d.blownT = 0;
          note("HELD IT");
          Skill.saved();
        } else {
          crash("blowout", d.pull >= 0 ? 1 : -1);
        }
      }
      return;
    }
    for (let i = 0; i < 4; i++) {
      const rate = blowoutRate(d.tyres[i], S.speed);
      if (rate > 0 && Math.random() < rate * dt) { blow(i); return; }
    }
  }

  function steerInput() {
    if (isTouch) {
      /* A held button is an answer and beats the drag, which is still
         there for anyone who prefers it and which reads as zero the
         moment a finger leaves the road. Without the precedence the two
         fight: a thumb resting anywhere on the glass holds `steer` at
         whatever it last dragged to, and the button never wins. */
      const b = (touch.right ? 1 : 0) - (touch.left ? 1 : 0);
      return b !== 0 ? b : clamp(touch.steer, -1, 1);
    }
    let s = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) s -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) s += 1;
    return s;
  }
  function throttleInput() {
    /* Touch used to be `brake ? -1 : 1` — the throttle was pinned open
       and the one pedal was the brake. There is a gas button now, so a
       phone gets the same three states the keyboard has, and letting go
       of everything coasts rather than accelerating. */
    if (isTouch) return (touch.gas ? 1 : 0) - (touch.brake ? 1 : 0);
    let t = 0;
    if (keys.has("ArrowUp") || keys.has("KeyW")) t += 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) t -= 1;
    return t;
  }

  /* ── where the wheels are ───────────────────────────────────────────
     Asked of the road we are on and no other, so the answer is never
     ambiguous where two roads run alongside each other. */
  /* Where the flank of the car meets concrete. Wanted in two places
     now — the surface test below, and the scrape that puts you back
     against it — and it must be exactly one number or the car
     alternates between inside the wall and beside it. */
  /* The face of the median barrier, and ZERO where there is no barrier.
     This used to be `road.med + …` with med a constant, so it was always
     a wall. Now that a rural median is sixty feet of grass, keeping the
     old form would have stretched an invisible wall right across it —
     the car would scrape along nothing in the middle of a field. A wide
     median has no face, and the grass underneath does the slowing. */
  /* `s` is a parameter and not `S.s`, and that is not tidying. This read
     the car's own station whatever station it was asked about, so
     `underneath(road, s, u)` silently ignored its second argument for
     the barrier test and answered about somewhere else on the road.
     Every live caller happened to pass `S.s`, so the game agreed with
     itself and only an outside caller could see it — which is exactly
     the kind of agreement that stops holding the moment traffic asks
     the same question about a car that is not the player. */
  const wallFace = (road, s) => {
    const mw = R.medAt(road, s);
    if (mw <= R.MED_BARRIER) return mw + PW / 2 - 1.5;
    /* Wide median: the only thing to hit is the rail, if it is
       there, and it is at the centreline rather than at the edge of
       the median. Zero means there is nothing in the grass at all. */
    const rw = R.medRailAt(road, s);
    return rw > 0 ? rw + PW / 2 - 1.5 : 0;
  };

  /* How far past the gravel verge you are, in px, on whichever side you
     went off. Zero if you are still on the road or its shoulder. This is
     the only thing the field needs to know about itself. */
  function offBy(road, s, u) {
    const ramp = road.kind === "ramp";
    const sh = ramp ? R.RAMP_SH : R.SH_OUT;
    const e = R.edges(road, s);
    const gR = e.uR + sh + R.VERGE, gL = e.uL - sh - R.VERGE;
    return u > gR ? u - gR : u < gL ? gL - u : 0;
  }

  /* ── are you in the deceleration lane ───────────────────────────────
     The auxiliary lane that opens ahead of a gore and closes at it.
     Being in it is what "an exit attempted" means for the skill score:
     you committed to leaving, whether or not you then did. */
  function inAuxLane(road) {
    if (!road || road.kind === "ramp") return false;
    const aux = S.fwd ? R.auxAt(road, S.s) : R.auxAtL(road, S.s);
    if (aux < R.LANE * 0.5) return false;
    const e = R.edges(road, S.s);
    return S.fwd ? S.u > e.uR - aux : S.u < e.uL + aux;
  }

  function underneath(road, s, u) {
    const ramp = road.kind === "ramp";
    const e = R.edges(road, s);
    const shL = ramp ? R.RAMP_SH : R.SH_OUT, shR = ramp ? R.RAMP_SH : R.SH_OUT;
    if (!ramp && Math.abs(u) < wallFace(road, s)) return "barrier";
    /* ── the middle of the road is not pavement ──────────────────────
       This function decides what is under the wheels, and it had no
       median in it at all. It tested the wall — which correctly
       returns ZERO where a median is too wide to put one in — and then
       handed everything inside `insideAt` to the branch below as
       "shoulder". So sixty feet of grass between the carriageways came
       back as paved hard shoulder: full grip, no drag, no dust, and
       the rollover dice never rolled.

       Measured, inside lane at 200 km/h with the wheel on full lock:
       the car crossed 102 px of median in a second, GAINED 51 km/h
       doing it, and arrived in the oncoming lanes still reporting
       tarmac. World.classify — which the renderer and the surface
       rescue use — said grass the whole way, so the game was drawing
       one road and driving another. That is the exact fault the header
       of updatePlayer warns about, one function further down.

       1,419 of the corridor's 2,551 miles have a median with neither a
       barrier nor a cable rail in it: across the desert the two
       carriageways were freely interchangeable at speed.

       The order matters. A barrier median returns above, because
       `wallFace` is wider than the median itself there — it is the
       median plus the car's own flank. What reaches here is a median
       too wide for a wall, and that is a field. */
    if (!ramp) {
      const mw = R.medAt(road, s);
      if (u > -mw && u < mw) return "grass";
    }
    /* The inside shoulder, plus whatever a left exit has widened it by.
       The band a lane drop leaves behind is paved and it is not a lane —
       driving down it past the wye is exactly as legal as driving down
       any other hard shoulder, which is to say the game lets you and
       the paint tells you not to. Both carriageways, separately: the
       drop happens on one of them at a time. */
    if (!ramp && u > -(R.insideAt(road, s) + R.innerAtL(road, s))
        && u < R.insideAt(road, s) + R.innerAt(road, s)) return "shoulder";
    if (u >= e.uL && u <= e.uR) return "lane";
    if (u >= e.uL - shL && u <= e.uR + shR) return "shoulder";
    if (u >= e.uL - shL - R.VERGE && u <= e.uR + shR + R.VERGE) return "gravel";
    return "grass";
  }

  /* ── the nose of the gore ───────────────────────────────────────────
     The striped thing painted on the tarmac between a ramp and the road
     it leaves is a crash cushion, and a crash cushion is not a wall. It
     is a stack of crushable barrels or a sand array with a design
     speed, and inside that speed it does the job it was bought for: it
     takes the energy, it wrecks the front of the car, and it puts you
     back out on the through lanes going slowly enough to think.

     What decides the outcome is not a rating but a length: six metres
     of crush stroke, and the deceleration is whatever the arithmetic
     says it is over that distance. At the device's design speed that
     works out at 7.9 g mean over four tenths of a second — an enormous
     delta-v delivered gently enough that it is survivable, which is
     the entire reason the thing is bolted to the road.

     Past about 175 km/h the car runs out of barrels and reaches the
     rigid backing still moving, and THAT is the impact that kills. The
     old model had a hard 110 km/h line; the real device does not have
     one, it has a stroke, and the stroke is what is modelled.

     You are always put out on the MAINLINE side, never the ramp: the
     nose deflects, and the through lanes are the side with somewhere to
     go. Whether you have any speed left to be put out WITH is another
     question — a cushion that has done its job has taken all of it. */
  /* Which way across the road an exit leaves. The same as the
     carriageway it serves for every right-hand exit ever built here,
     and the opposite of it for a left one — see the note in
     handovers(). Defaulted rather than required so a junction entry
     that predates left exits still answers. */
  const exitOut = (ex) => (ex.out != null ? ex.out : (ex.side > 0 ? 1 : -1));

  /* `hitNose()` and `onTheWedge()` were here: the crash-cushion impact,
     its two-stage crush arithmetic and the test for standing on the
     neutral area. Removed with the object itself — see the note in
     handovers(). `Impact.crushStop` survives and is still used by
     hitWorks(), which is a real row of barrels across a closed ramp
     rather than invented furniture in a gore. */

  /* ── the end of a closed ramp ───────────────────────────────────────
     Barrels right across the pavement, and behind them a rigid backing
     that is not going anywhere: plant, a barrier wall, the edge of the
     excavation. Structurally the same event as the gore nose and
     modelled by the same two-stage arithmetic — the barrels take what
     they can over their stroke, and whatever is left arrives against
     something that does not move — but with a shorter stroke, because a
     row of drums across a ramp is not an engineered crash cushion. It
     is a warning that has run out of patience.

     There is nothing unfair about it. The exit is signed CLOSED from a
     mile and a half out, in orange, twice, and the lanes are coned shut
     across a thousand pixels before the gore. Arriving here means you
     read all of that and took it anyway, which is the whole point of
     leaving it open. */
  const WORKS_STROKE = 2.6;                  // m of barrel before the backing
  function hitWorks(ramp) {
    const c = ramp.closure;
    const crush = IM.crushStop(kmh2ms(Math.abs(S.speed)), WORKS_STROKE);
    let w = weigh(crush.dv, 0, crush.gMean);
    if (crush.exhausted) {
      const res = IM.solve(carBody(0, ms2kmh(crush.vOut), 0), IM.fixed(),
                           { n: { x: 0, y: -1 }, mu: IM.BODIES.concrete.mu });
      if (res) {
        const w2 = weigh(res.dvA, IM.blowAngle(res.J, FWD));
        if (w2.dvEff > w.dvEff) w = w2;
      }
    }
    w.what = "the end of the work zone";
    S.s = c.works - 0.5;                     // stopped AT it, not through it
    S.speed = 0; S.vu = 0; S.spin = 0; S.roll = 0;
    S.shake = 7; S.flash = 0.6;
    puff(S.x, S.y, 20, "debris");
    puff(S.x, S.y, 8, "dust");
    blip("thud");
    Skill.dirty();
    /* Survive it and you are stationary against the barrels with the
       ramp behind you, which is the situation the closure was built to
       produce: the way out is reverse. */
    land(w, "works", 0);
  }

  /* ── the two handovers ──────────────────────────────────────────────
     A gore, and a merge. Both keep `u` continuous by shifting it by the
     distance between the two centrelines, and both are safe to do mid-
     frame because the two roads share a heading at exactly that point —
     which is how the picture gets through a junction without a jump. */
  function handovers(prevS) {
    const road = S.road;

    if (road.kind === "freeway") {
      /* ── an exit you can only take going one way ────────────────────
         This used to test `prevS < ex.s && S.s >= ex.s`, which fires
         only while `s` is INCREASING — so a car driving the corridor
         westbound could never take any exit at all, whatever it did with
         the wheel. It was invisible while every run went one way and
         became half the game the moment the sign offered WEST.

         An exit serves the direction whose right-hand side it sits on,
         so `(ex.side > 0) === S.fwd`. And a westbound ramp lives in the
         mirrored frame: its `s` grows the way the driver is going, which
         is the way the corridor's shrinks, and its right is the
         corridor's left. Both conversions are below and both are exact
         inversions — drive in and straight back out and you land on the
         same pixel. */
      for (const ex of road.exits) {
        if (ex.ramp.dead) continue;
        if ((ex.side > 0) !== S.fwd) continue;        // serves the other direction
        const crossed = S.fwd ? (prevS < ex.s && S.s >= ex.s)
                              : (prevS > ex.s && S.s <= ex.s);
        if (!crossed) continue;
        /* ── the nose, for an exit of any width on either side ─────────
           Two things that were one number until exit 368. `side` is the
           carriageway the exit serves and decides whether it is yours
           at all. `out` is which way ACROSS the road it leaves, and on
           a left exit those are opposite: the wye serves westbound
           traffic and departs toward +u. And the nose is half the
           RAMP's width from its centreline, not half a lane — two lanes
           leave at 368, so the paint is a lane and a half out, and a
           driver in the second of them is already committed. */
        const out = exitOut(ex);
        const split = ex.startU - out * (Math.max(1, ex.lanes) - 0.5) * R.LANE;
        const committed = out > 0 ? S.u > split + 4 : S.u < split - 4;
        if (committed) {
          /* Which road you are TRACKED on, and nothing more. Nothing is
             decided here and nothing can be hit here: at this station
             the ramp and the mainline are the same pavement, so being
             handed from one to the other is a change of bookkeeping.
             The decision is at the nose, several hundred pixels on,
             where the two actually part — see the note on noseOf() in
             world.js and the test below. Steer back and the handover
             runs the other way; that is what a deceleration lane is. */
          if (ex.mirror) {
            S.u = ex.startU - S.u;
            S.camU = ex.startU - S.camU;
            S.s = ex.s - S.s;
          } else {
            S.u -= ex.startU;
            S.camU -= ex.startU;
            S.s -= ex.s;
          }
          S.road = ex.ramp;
          S.fwd = true;                 // a ramp always runs the way you drive it
          S.onRamp = true;
        }
        break;
      }
      /* ── and nothing is hit here ────────────────────────────────────
         There was a kill band at the junction station, and then a crash
         cushion and a kill band at the nose. Both are gone. An impact
         attenuator is bolted to the end of a barrier run; the gore of an
         ordinary interchange has no barrier in it, so there is nothing
         standing there to hit — there is hatched paint you may drive
         over, and a verge beyond it.

         Which means a gore now costs what it costs in life: you end up
         on the grass between two roads, at speed, sideways, and the
         soft-ground model in leftTheRoad() decides what that is worth.
         That is a better answer than a bespoke object, and it is the
         one the rest of this file already gives for leaving the road. */
      /* A closed road has no end to run out of, so the wrap has to be
         tested before the end, and the two must not share a branch: the
         last station of a beltway is `>= len - STEP` but not yet
         `>= len`, and an else-if put the ring roads in exactly that gap
         and wrecked you once a lap. */
      /* Both ends of the road are reachable now, because the car can
         face either way down it. */
      if (S.road === road && road.wrap) {
        const L = R.len(road);
        if (S.s >= L) S.s %= L;
        else if (S.s < 0) S.s += L;
      } else if (S.road === road
                 && (S.fwd ? S.s >= R.len(road) - R.STEP : S.s <= R.STEP)) {
        crash("end");
      }
    } else if (road.closure && prevS < road.closure.works
               && S.s >= road.closure.works) {
      hitWorks(road);                      // the pavement ends here
      return;
    } else if (S.s < 0 && road.junction && road.junction.from) {
      /* ── backing out of a gore ─────────────────────────────────────
         The inverse of taking the exit, and it exists because one exit
         on this corridor is a dead end on purpose. Reverse is already a
         real gear — `S.speed` is signed — so a car that stops against
         the barrels at exit 368 and backs up arrives here with `s` off
         the bottom of the ramp, on pavement it shares with I-40, and
         the only thing that was missing was somebody to hand it back.

         Every conversion is the exact opposite of the one in the gore
         handover above, including the mirror, so backing in and driving
         out again lands on the pixel you left from. It used to crash
         you for the crime of reversing, which was the right answer only
         while no ramp was worth reversing out of. */
      const ex = road.junction;
      const over = -S.s;
      if (ex.mirror) {
        S.u = ex.startU - S.u;
        S.camU = ex.startU - S.camU;
        S.s = ex.s + over;
        S.fwd = false;
      } else {
        S.u += ex.startU;
        S.camU += ex.startU;
        S.s = ex.s - over;
        S.fwd = true;
      }
      S.road = ex.from;
      S.onRamp = false;
      S.hints.clear();
    } else if (!S.fwd && S.s <= R.STEP) {
      crash("end");                        // a ramp driven backwards to its gore
    } else if (!road.merge && S.s >= R.len(road) - R.STEP) {
      crash("end");
    } else if (road.merge && S.s >= R.len(road)) {
      const m = road.merge;
      const routeType = road.routeType;
      const over = S.s - R.len(road);
      /* The exact inverse of the entry above. A mirrored ramp hands you
         back onto a corridor whose stations run the other way, so the
         overshoot is subtracted and the offset reflected. */
      if (m.mirror) {
        S.u = m.u - S.u;
        S.camU = m.u - S.camU;
        S.s = m.s - over;
        S.fwd = false;
      } else {
        S.u += m.u;
        S.camU += m.u;
        S.s = m.s + over;
        S.fwd = true;
      }
      S.road = m.into;
      S.onRamp = false;
      takeExit(routeType);
    }
  }

  /* ── grinding down the median ────────────────────────────────────────
     A Jersey barrier is shaped the way it is so that a car arriving at
     a shallow angle rides up the lower face, is turned back parallel,
     and comes off it still on its wheels and still in a lane. That is
     not a lucky outcome, it is the design brief, and it is what the
     wall should do here — because a median you can only die against is
     a median nobody drives near, and the inside lane is half the road.

     So: you cannot be inside it, and you are put back against its face
     rather than through it. What it takes and what it gives back are
     now both the solver's answer rather than two tuned constants — an
     impulse with a normal component that throws you off the face and a
     tangential one that saturates at the friction limit, which is
     exactly the shape of a real redirect. The old BAR_BITE and
     BAR_KICK were hand-fitted approximations of those two components
     and they are gone.

     There is no BAR_KILL any more either. Whether the wall has you is
     a probability now, and it is a probability that depends almost
     entirely on how much sideways speed you brought — full lock from
     the next lane over at 220 mph is about a one in nine chance of
     being killed and better than even odds of walking away, which is
     what a median barrier is FOR and what the old threshold could not
     express at any setting.

     One arrival per contact. A grind is not a fresh impact, and the
     wall shoving you off means the car bounces along the face several
     times a second — charging an arrival for each of those was worth
     three hundred km/h a second and turned the median into a brick
     wall. `scrapeOff` is what tells the two apart.

     Returns the surface to carry on with, which is the paved inner
     shoulder — you are, after all, standing on tarmac. */
  /* ── a car resting against a barrier is not scraping it ─────────────
     Reported from play, 2026-08-11: *"if touching the rail and not
     moving there should be no shake and sparks."*

     Right, and it is what a grind IS. The shake, the sparks and the
     shriek are friction work, and friction does no work at a
     standstill — but all three were unconditional on contact, so a car
     stopped against the median sat there shuddering, throwing sparks
     and screaming for as long as you held the wheel into it. The drag
     was the only part that was already honest, because it is a rate on
     speed and goes to zero on its own.

     Rubbing speed is not the car's forward speed, and the wreck path is
     exactly why: a wreck can be stationary and still spinning, and a
     corner of it against the wall is moving at ω·r whatever the middle
     is doing. Both terms, in km/h, so one number answers for the player
     and for the wreck and the two cannot drift apart.

     Faded rather than switched, and DECIDED at 12 km/h: nothing at
     rest, everything by a slow crawl, which puts the whole fade inside
     the range where a car is being nudged into a barrier rather than
     driven along one. */
  const GRIND_FULL = 12;                        // km/h of rub for full effect
  function grindRate() {
    const yaw = Math.abs(S.spin) * (PL / 2) / PX_PER_KMH;
    return clamp((S.speed + yaw) / GRIND_FULL, 0, 1);
  }

  function scrapeWall(road, dt) {
    const face = wallFace(road, S.s);
    const side = S.u >= 0 ? 1 : -1;         // which side of the median you are
    const dir = S.fwd ? 1 : -1;
    const out = side * dir;                 // the car's own way off the wall

    if (S.scrapeT <= 0) {
      /* The whole arrival, in one call. The solver's own separation
         test is the arrival test: drift into the face with no closing
         speed and it returns null, which is right — that is a car
         already riding the wall, not one hitting it. */
      const B = IM.BODIES.concrete;
      const res = IM.solve(carBody(underControl(S.vu, S.speed), S.speed, 0), IM.fixed(),
                           { n: { x: out, y: 0 }, mu: B.mu, eps: B.epsMax });
      if (res) {
        S.vu = ms2pxs(res.va.x);
        S.speed = Math.max(0, ms2kmh(res.va.y));
        if (S.shake < 2.4) S.shake = 2.4;
        blip("scrape");
        Skill.incident();
        const w = weigh(res.dvA, IM.blowAngle(res.J, FWD));
        w.what = "the median";
        if (land(w, "barrier", out)) return "barrier";
      }
    }

    S.u = side * face;
    // still trying to go through it? You are not going through it.
    if (out * S.vu < 0) S.vu = 0;
    S.scrapeT += dt;
    S.scrapeOff = 0;
    S.speed = Math.max(0, S.speed - (BAR_DRAG + BAR_DRAG_V * (S.speed / V_MAX)) * dt);
    /* Held rather than set, because the impact shake decays in a tenth
       of a second and a grind lasts as long as you hold the wheel — for
       as long as there is a grind. See grindRate: at a standstill there
       is no rub, so there is nothing to hold up. */
    const g = grindRate();
    if (S.shake < 1.5 * g) S.shake = 1.5 * g;
    /* Sparks come off the contact patch, which is the flank of the car
       nearest the wall, not its middle. `out` is in the car's frame and
       so is `S.h`, so this needs no second conversion. */
    if (Math.random() < 70 * dt * g) {
      const off = -out * (PW / 2 + 1);
      puff(S.x + Math.cos(S.h) * off + rnd(-2, 2),
           S.y - Math.sin(S.h) * off + rnd(-2, 2), 1, "spark");
    }
    return "shoulder";
  }

  /* ══════════════════════════════════════════════════════════════════
     leaving the road

     Called once, on the frame the car crosses onto soil, and not again
     until it has been back on tarmac. That "once" is the whole design:
     at 120 Hz, re-rolling a 2% chance every frame turns it into a
     certainty in under a second, and the entire honesty of this model
     is that the low end really is zero.

     Below 16.6 km/h of sideways there is not enough energy in the car
     to lift its own centre of gravity over the outside tyre, so this
     returns nothing at all and the excursion is a surface with bad
     manners and nothing more. That is not generosity — it is what
     happens to the great majority of the cars that leave a road every
     day, which is the whole basis of clear-zone design.

     Above it the dice are real, and the good outcome is deliberately
     as violent as the bad one. If a save were calm and only the wreck
     were loud, the model would read as the game picking on you; when
     both throw the car around and only one of them ends the run, it
     reads as luck, which is what it is.

     Returns true if the run is over.
     ══════════════════════════════════════════════════════════════════ */
  function leftTheRoad() {
    const vLat = Math.abs(S.vu) / PX_PER_KMH;              // km/h across
    const base = IM.rolloverRisk(vLat, SOIL);
    const side = S.vu >= 0 ? 1 : -1;
    /* Every excursion, whether or not anything came of it. This is the
       only way to see the shape of the distribution from outside — the
       interesting number is the one on the runs that were fine. */
    S.lastSoil = { vLat, vFwd: S.speed, p: base, rolled: false };
    if (base <= 0) return false;                           // and that is that

    Skill.incident();
    const sev = (vLat - IM.V_CRIT) / (2.5 * IM.V_CRIT);
    const p = Skill.adjust(base, sev);
    S.lastSoil.p = p;

    if (Math.random() >= p) {
      /* Not this time. A very large slide, most of the speed gone, the
         car light and squirming as it comes back on, and a tyre that
         will remember this later — see blowoutRate. */
      S.speed *= 1 - SLIDE_SCRUB;
      S.spin += side * rnd(0.8, 1.6);
      S.shake = Math.max(S.shake, 5);
      puff(S.x, S.y, 18, "dust");
      const i = (side > 0 ? 1 : 0) + (Math.random() < 0.5 ? 0 : 2);
      S.dmg.tyres[i] = Math.min(1, S.dmg.tyres[i] + 0.30);
      S.dmg.pull = clamp(S.dmg.pull + side * PULL_LIGHT, -PULL_CAP, PULL_CAP);
      mark(S.h);
      note("HELD ON");
      return false;
    }

    /* Over. How far over is a question of forward speed and nothing
       else: initiation is lateral, but the number of quarter-turns
       scales with the kinetic energy still in the car. A car that goes
       over at 60 km/h lands on its side and the run ends quietly; one
       that goes over at 250 rolls six times and it does not. */
    S.lastSoil.rolled = true;
    const turns = IM.quarterTurns(S.speed);
    const dvEff = IM.rollDv(turns);
    const w = {
      dv: dvEff, dvEff, angle: 0, dirF: 1, ride: 1, gMean: null,
      kind: "roll", turns, vLat, pRoll: base, what: "soft ground",
    };
    judge(w);
    S.report = w;
    S.dvTotal += dvEff;
    /* A rollover always ends the run, whatever the band says about the
       driver — the car is on its roof either way. The band decides
       what the panel is allowed to tell you afterwards. */
    crash("trip", side, w);
    return true;
  }

  function updatePlayer(dt) {
    const th = throttleInput();
    const road = S.road;

    /* ── what is under the wheels ────────────────────────────────────
       This asks the road you are TRACKED on, and that was the bug behind
       the invisible barriers. It is worth being precise about, because
       the game was drawing with one truth and killing with another.

       `underneath` knows about one road. `World.surface` asks every road
       near the point and keeps the best answer — and the renderer agrees
       with the second, because it draws every road near the camera. So
       anywhere two pavements meet without a handover firing — every
       gore, every merge taper, every stretch where a ramp runs alongside
       its parent — you could steer a pixel past your own road's verge,
       be standing in plain sight on somebody else's tarmac, and be told
       you had left the road. Sampled across the whole map: 6,655 such
       points, 6.3% of every road edge on it.

       So: ask your own road, and if it says you are in a field, ask the
       world before believing it. If the world says tarmac, it is tarmac,
       and you become that road's problem — which is what this game
       always claimed to do. The median is exempt: a barrier is not a
       surface, it is a wall, and nothing rescues you from it. */
    let what = underneath(road, S.s, S.u);
    if (what === "grass") {
      /* Only onto roads at your own height. This test could not be
         written while `elev` meant both draw layer and height: a system
         connector carries a high layer purely so it paints over the
         freeway it leaves, while physically sitting at grade for the
         quarter mile where it merges, so refusing to rescue onto
         anything "above" you condemned the merge lanes along with the
         real bridges — 1,774 lethal points where there had been 43. The
         stopgap was to do no height test at all and lean on
         World.surface's 260 px range cut to keep flyovers out, which
         works only for as long as no deck passes close overhead.

         `deck` is the real thing, per station, so the question can now
         be asked properly: a bridge above you is out of reach because it
         is a bridge, not because it happens to be far away. */
      const w = World.surface(S.x, S.y, S.hints, R.deckAt(road, S.s));
      if (w.road && w.road !== road && w.what !== "grass" && w.what !== "barrier") {
        const turn = Math.abs(((w.h - S.h + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        S.road = w.road; S.s = w.s; S.u = w.u;
        if (turn > Math.PI / 2) S.fwd = !S.fwd;
        S.camU = camTarget(S.road);
        what = w.what;
      }
    }
    /* ── the median ──────────────────────────────────────────────────
       You cannot be inside it, so you are put back against it, and it
       takes payment for that. See scrapeWall(); the only case that ends
       a run is the one that would end one. It hands back the surface you
       are actually standing on, which is the inner shoulder — so
       `onWhat` is recorded after this and never says "barrier", because
       by the time anything reads it you are beside the wall, not in it. */
    if (what === "barrier") {
      what = scrapeWall(road, dt);
      if (S.mode !== "play") return;
    } else {
      S.scrapeOff += dt;
      if (S.scrapeOff > 0.3) S.scrapeT = 0;
    }
    S.onWhat = what;

    /* ── the field ───────────────────────────────────────────────────
       Not a wall and not a rule. Two wheels off is a surface with bad
       manners: it drags hard, it gives you less than half the grip, and
       it throws a plume you can see from the road. Straighten up and
       lift and you drive back on, which is what a driver would do and
       what the physics now allows. */
    const dirt = what === "grass";
    const rough = dirt || what === "gravel";
    const paved = what === "lane" || what === "shoulder";
    S.gravelT = rough ? S.gravelT + dt : 0;
    /* The excursion latch. Cleared only by getting back on tarmac, so
       grass → gravel → grass without ever reaching pavement is still
       one excursion and still one roll of the dice. */
    if (paved) S.onSoil = false;

    if (dirt) {
      /* Soft ground grabs a sideways tyre and stands the car on its
         nose — and whether it does is not a threshold, it is a
         probability, because what actually decides it is whether that
         wheel found a rut or a stone. Evaluated ONCE, here, on the
         frame the car crosses onto soil. */
      if (!S.onSoil) {
        S.onSoil = true;
        if (leftTheRoad()) return;
      }
      /* and the field runs out before Tennessee does. The fence is a
         fence: forty kilos of post and wire, which takes a few km/h off
         the car and is destroyed. What ends the run is not the impact —
         it is that there is no more right of way, and until there is
         something on the far side of it worth hitting, going through it
         is a full stop and not a wreck. */
      if (offBy(road, S.s, S.u) > DIRT_MAX) {
        const off = (S.u >= 0 ? 1 : -1) * (S.fwd ? 1 : -1);
        const B = IM.BODIES.fence;
        const res = IM.solve(carBody(underControl(S.vu, S.speed), S.speed, 0),
                             { m: B.m, Iz: B.Iz, v: { x: 0, y: 0 }, w: 0, r: { x: 0, y: 0 } },
                             { n: { x: 0, y: -1 }, mu: B.mu, eps: B.eps });
        let w = null;
        if (res) {
          S.speed = Math.max(0, ms2kmh(res.va.y));
          S.dvTotal += ms2kmh(res.dvA);
          w = weigh(res.dvA, IM.blowAngle(res.J, FWD));
          w.what = "the fence";
        }
        S.u -= (S.u >= 0 ? 1 : -1) * (offBy(road, S.s, S.u) - DIRT_MAX);
        puff(S.x, S.y, 14, "debris");
        crash("fence", off, w, true);
        return;
      }
    }

    /* ── throttle, brake, reverse, coast ─────────────────────────────
       `S.speed` is signed now, and that is the whole of what reverse
       required — but it means every longitudinal term below has to be
       signed too. Written the old way, drag SUBTRACTS, which while
       going backwards is drag pointing the way you are already
       travelling: coast in reverse and the car accelerates away down
       the road on its own. So resistance is applied toward zero and
       never through it, which is what `drag()` is for.

       Down does two jobs, in the order a driver expects: stop the car,
       then back it up. There is no gear to select — you hold it, the
       car slows, it reaches nothing, and then it is reversing. */
    const top = vMax();
    /* Resistance, in km/h per second, applied against the direction of
       travel and clamped so it can never push the car past a standstill
       and out the other side. */
    const drag = (rate) => {
      const d = rate * dt;
      S.speed = Math.abs(S.speed) <= d ? 0 : S.speed - Math.sign(S.speed) * d;
    };

    if (th > 0) {
      /* Forward, and this is the car's own engine as of the garage.

           a(v) = a0 · (1 − (v/vTop)²)

         `a0` and `vTop` are derived in data/cars.js from a published
         0–60 and a published top speed; the square term is drag, and it
         takes the acceleration to exactly ZERO at the top speed rather
         than leaving it pulling hard into a clamp the way the old
         single car did. The last few mph therefore take real time to
         find — 23 seconds of them in the Jetta.

         IF THIS LINE CHANGES, test/garage.test.js §1 CHANGES WITH IT.
         That file duplicates this expression deliberately, because it
         cannot import a DOM module and a paraphrase would prove
         nothing. It stopwatches every vehicle at 60 fps against the
         figures its row claims.

         From a standstill or out of reverse this behaves as it always
         did — a negative `S.speed` simply means the first part of the
         pull is spent stopping. */
      const vt = S.car.vTop;
      S.speed += S.car.a0 * (1 - (clamp(S.speed, 0, vt) / vt) ** 2) * dt;
    } else if (th < 0) {
      /* The brakes, and the biggest single change the garage makes.
         This was 132 km/h/s for everything — 3.7 g, about triple what
         any tyre has ever managed. It is now the published 60–0
         distance, inverted, which is 0.86 g in the pickup and 1.20 in
         the built 911, so stopping distances are roughly THREE TIMES
         what they were. Arriving at the back of a queue is finally the
         hazard PLAN.md §2 wanted it to be. */
      if (S.speed > 0) S.speed -= S.car.brake * dt;
      else {
        /* Reverse gear: short, and geared for a car park rather than a
           freeway. It asymptotes rather than clipping so that backing
           out of somewhere does not read as a speed limiter. */
        S.speed -= REV_ACC * (1 - Math.abs(S.speed) / V_REVERSE) * dt;
        if (S.speed < -V_REVERSE) S.speed = -V_REVERSE;
      }
    } else drag(15);                                  // coast

    if (rough) {
      /* Both surfaces have a second, harder figure above the speed at
         which the loose stuff stops passing under the wheels and starts
         piling up in front of them. */
      if (dirt) {
        drag(DIRT_DRAG);
        if (Math.abs(S.speed) > V_DIRT) drag(DIRT_PLOUGH);
        if (Math.random() < 52 * dt) puff(S.x, S.y, 1, "dust");
      } else {
        drag(30);
        if (Math.abs(S.speed) > V_GRAVEL) drag(62);
        if (Math.random() < 26 * dt) puff(S.x, S.y, 1, "dust");
      }
    }
    // bodywork you are no longer carrying, and a corner that is folded
    if (S.dmg.dragK) drag(S.dmg.dragK * 60 * (Math.abs(S.speed) / V_MAX));
    S.speed = clamp(S.speed, -V_REVERSE, top);
    // a top speed is a forward figure; nobody's best run was backwards
    if (S.speed > S.topSpeed) S.topSpeed = S.speed;

    /* ── the car's own heading, outside a wreck ──────────────────────
       Zero to the bit for nearly the whole game — the car does not
       turn, the road does — and the two exceptions are a rear tyre
       letting go and a slide through soft ground that did not put the
       car over. Both are the car pointing somewhere other than where
       it is going, which is exactly what `roll` means. */
    if (S.spin || S.roll) {
      S.roll += S.spin * dt;
      S.spin *= Math.max(0, 1 - 3.2 * dt);
      S.roll *= Math.max(0, 1 - 2.6 * dt);
      if (Math.abs(S.roll) < 0.002 && Math.abs(S.spin) < 0.01) { S.roll = 0; S.spin = 0; }
    }

    /* Steering, and this is the whole of it: a sideways velocity across
       the road. Heavier the faster you are going, looser on gravel and
       looser again in the field. The car's heading is the road's
       heading and is not yours to change. */
    const st = S.steer;
    const grip = dirt ? DIRT_GRIP : rough ? GRAVEL_GRIP : 1;
    let want = steerInput() * st.latMax * (1 - st.fade * (S.speed / V_MAX)) * grip;
    /* A bent corner, or one that has let go, steers whether you do or
       not — and it has to be asked for HERE, alongside the wheel,
       rather than added to `vu` afterwards. The wheel commands a RATE,
       so anything handed to `vu` as an acceleration is corrected away
       before it has moved the car a pixel. That is the same trap the
       barrier's redirect fell into years ago; see the pull note. */
    want += S.dmg.pull * st.latMax;
    /* And a car pointed off its own path crosses the road at exactly
       v·sin(θ), which needs no coefficient and no apology. */
    if (S.roll) want += pxs(S.speed) * Math.sin(S.roll);
    /* Off the pavement the wheel also answers more slowly, which is
       what keeps the sideways speed you ARRIVED with — and which is
       what the rollover test above is measuring. Drift off gently and
       it has bled away before it matters; swerve off and it has not. */
    S.vu = lerp(S.vu, want, 1 - Math.exp(-(dirt ? 5 : rough ? 7 : st.respond) * dt));

    tyreCheck(dt);
    if (S.mode !== "play") return;

    /* Steering is in the CAR's frame, and `u` is in the road's. Facing
       back down the road, your right is the road's left, so both the
       offset and the distance run the other way. */
    const dir = S.fwd ? 1 : -1;
    S.u += dir * S.vu * dt;

    const step = pxs(S.speed) * dt;
    const prevS = S.s;
    S.s += dir * step;
    S.distPx += step;

    /* ── the score ────────────────────────────────────────────────────
       Was `step · M_PER_PX · S.mult`, with `mult` coming off a
       four-second exit combo. It is `score.js` now: distance and exits
       multiplied by how dangerous the driving actually is — the density
       around you, the hour, and how long you have held a speed that is
       high FOR THE CAR YOU ARE IN.

       The density handed over is the local one out of the band that
       travels with you, in vehicles per km per lane, which is the same
       quantity `sim.js` measures itself against. If the traffic is not
       running there is no density to report and the term falls to its
       floor, which is right: an empty road is an empty road. */
    S.score += Score.frame(dt, Math.abs(S.speed), localDensity());

    /* ── evidence for the skill score ────────────────────────────────
       Rates, not totals, so a long bad run cannot outrank a short
       brilliant one — the ratios live in skill.js and this only feeds
       it what happened. A frame is clean if nothing was touched and
       every wheel was on pavement; an incident is anything that could
       have ended the run and did not. */
    Skill.frame(dt, step * M_PER_PX / 1000, S.speed,
                paved && S.scrapeT <= 0 && S.dmg.blown === null,
                inAuxLane(road), S.onRamp === true, paved, Math.abs(S.vu) / PX_PER_KMH);

    handovers(prevS);
    if (S.mode !== "play") return;
    easeCamera(dt);
    place();

    if (th < 0 && S.speed > 90) mark();

    /* The four-second exit combo used to decay here. score.js owns the
       multiplier now and its decaying term is `pace`, which is stepped
       inside `Score.frame` — so there is nothing left to tick. */
  }

  /* ── where the camera sits across the road ──────────────────────────
     The subject of this picture is YOUR CARRIAGEWAY — the median on one
     side of it, your own verge on the other, and nothing about the
     traffic going the other way that you need in order to drive. So the
     camera's home is the middle of that strip, `myMid`, and on any
     cabinet too narrow to hold the whole highway, that is exactly where
     it sits: your lanes centred, grass or median at both edges, and the
     oncoming side cropped to whatever is left over.

     It slides back to the middle of the ROAD as the cabinet gets wide
     enough to hold all of it, and `f` is how much of the way there it
     has got: zero when the far edge is off the glass, one when it is
     comfortably on. That is not a second rule bolted on, it is the same
     rule at a different width — and it is where the old "sit right of
     centre, where a right-driving car belongs" comes from now, for
     free. Centre the whole road and your carriageway IS the right-hand
     half of it, so you end up six tenths across on a desktop without a
     bias constant asserting it.

     Two earlier versions of this were wrong in the same way, and the
     way is worth naming because the cabinet is the screen now and it
     will keep being a trap. `min(VW/2 − half, ownMiddle)` assumed the
     road always fits: its first term goes NEGATIVE the moment the
     cabinet is narrower than the road, was clamped at zero, and zero is
     the centreline of the whole highway — so on a phone at a rural
     median, sixty feet of grass between the carriageways, it centred
     the picture on the grass and cropped both sets of lanes. Replacing
     it with a fixed sixty-per-cent bias fixed that and bought a
     narrower one: a tenth of the cabinet to the left of your own middle
     spends the phone's whole width allowance on oncoming tarmac and
     leaves no grass on the side you are driving on.

     Lane counts come from `lanesAt`, which ignores a deceleration lane,
     and that is what stops the view sliding sideways every time an exit
     opens; the aux lane still fits on the glass because `myMid` leaves
     room for a verge that is wider than the lane is. Everything here is
     continuous in the median width and the lane count, so a median
     opening out slides the camera rather than snapping it. */
  function camTarget(road) {
    if (road.kind === "ramp") return 0;
    const mine = S.fwd ? R.lanesAt(road, S.s) : R.backLanesAt(road, S.s);
    const other = S.fwd ? R.backLanesAt(road, S.s) : R.lanesAt(road, S.s);
    const inside = R.insideAt(road, S.s);
    // your side of it: median edge, out to the far side of your own verge
    const myMid = (R.medAt(road, S.s) + inside + mine * R.LANE + R.SH_OUT + R.VERGE) / 2;
    // and the whole of it, to the outside edge of the far carriageway
    const half = inside + Math.max(mine, other) * R.LANE + R.SH_OUT;
    const f = Math.max(0, Math.min(1, (Draw.VW / 2 - half) / myMid));
    return (S.fwd ? 1 : -1) * myMid * (1 - f);
  }

  /* road coordinates → the world, once per frame, for drawing and for
     working out what you just hit */
  function place() {
    const f = R.frame(S.road, S.s);
    S.x = f.x + Math.cos(f.h) * S.u;
    S.y = f.y - Math.sin(f.h) * S.u;
    S.h = f.h + (S.fwd ? 0 : Math.PI);
    S.camX = f.x + Math.cos(f.h) * S.camU;
    S.camY = f.y - Math.sin(f.h) * S.camU;
  }

  /* shortest signed way round from b to a */
  const angleTo = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  /* ── the camera has its own heading ─────────────────────────────────
     `S.h` is the car's, read straight off the road frame, and it must
     stay exact — it is what the car drives along and what the wheels are
     tested against. The CAMERA does not have to be exact, and making it
     so is what made every junction kick.

     Two roads meeting at a merge agree on position to the pixel but not
     on heading: a generated loop-back rejoins within 1.8° and a surveyed
     ramp within about 6°. That is a small angle and a real one — it is
     the road — but applied to the camera in a single frame it rotates
     the entire screen instantly, and what the player feels is the car
     being hit sideways as it comes back on.

     So the camera turns TOWARD the car's heading rather than being set
     to it. At 14 per second it closes a six-degree step in about a sixth
     of a second, and on an ordinary curve — where an Interstate turns at
     three or four degrees a second — it trails by under a quarter of a
     degree, which is nothing you can see. */
  const CAM_TURN = 14;
  /* ── how fast the view may slide sideways ───────────────────────────
     The camera sits right of centre on a freeway so the whole six-lane
     cross-section stays visible, and dead centre on a ramp where there
     is no cross-section to show. Both are right, and the step between
     them is what a handover is.

     What was wrong is how fast it crossed. The offset was kept exactly
     continuous through the gore — the picture does not jump, which is
     the hard part and was already solved — and then chased its new
     target exponentially. On a freeway that ease is barely visible; at
     a junction it has forty to eighty pixels to make up, and it made
     them up at up to 192 px/s while the car itself was going straight.
     Measured against 96 px/s for the same camera settling during
     ordinary driving, the view was sliding twice as fast as it ever
     does, at the exact moment the player commits to an exit. It reads
     as the car being shoved.

     So the ease stays — it is right for small corrections — and a speed
     limit goes on top of it. Near the target the exponential is well
     under the cap and nothing changes; far from it the cap takes over
     and the view drifts across instead of being thrown. */
  const CAM_SLIDE = 62;                   // px per second, world
  function easeCamera(dt) {
    const t = camTarget(S.road);
    let step = (t - S.camU) * (1 - Math.exp(-3.4 * dt));
    const cap = CAM_SLIDE * dt;
    if (step > cap) step = cap; else if (step < -cap) step = -cap;
    S.camU += step;
    S.camH += angleTo(S.h, S.camH) * (1 - Math.exp(-CAM_TURN * dt));
  }

  /* ── the road slides under you ──────────────────────────────────────
     Only twenty miles of I-40 exist as geometry at any moment, and when
     the car nears an edge World.update() builds the next twenty and
     hands back where the car now sits on it. `s` is window-local, so it
     has to be re-based; nothing else changes, because the car's world
     position, heading and offset across the road are all identical
     either side of the swap — it is the same tarmac, freshly described.

     `hints` is cleared because every entry in it is a station index on a
     road that no longer exists. */
  function rebase(r) {
    if (!r) return;
    S.road = r.road;
    S.s = r.s;
    S.hints.clear();
    place();
  }

  /* ── there is nobody else on this road ──────────────────────────────
     Traffic was written, worked, and has been deleted. It went because
     the map is being rebuilt from a fictional region into one real
     corridor, and a car that decides which exit to take is worth
     nothing until the exits are the right exits in the right places.

     What went with it: car-following, lane changes, the exit-choosing
     AI, and a signal queue built out of a red light modelled as a
     stopped car of zero length — which is how queues assembled and
     overflowed backwards up a ramp without anybody writing that. It is
     worth rebuilding that way again.

     What went with it HERE: the separating-axis box test, contact
     detection, and pass scoring. `crash()` still exists and the barrier
     and the verge still use it, so leaving the road still ends a run;
     there is simply nothing left to hit that moves. Score currently
     comes from distance and from taking exits — see PLAN.md §2 for
     where it should come from once there is a corridor to score. */

  /* How many vehicles per km per lane are around the player right now.
     The band that travels with you is BACK + AHEAD metres long and
     `stats()` counts what is live in it, so this is a straight count
     over a known volume rather than an estimate. Zero when the traffic
     is not running, which the score reads as an empty road. */
  function localDensity() {
    if (typeof Cars === "undefined" || !Cars.running()) return 0;
    const st = Cars.stats();
    if (!st || !st.lanes) return 0;
    const km = (Cars.BACK + Cars.AHEAD) / 1000;
    return st.mine / (km * st.lanes);
  }

  /* ── taking an exit ─────────────────────────────────────────────────
     Paid at the far end of the ramp, not at the gore, because until you
     are down on the new motorway you have not been anywhere — and there
     is usually a queue between the two.

     The pot it pays into is only YOURS at a checkpoint, which is every
     tenth exit — so this is also where a run's winnings stop being at
     risk. See score.js on why it is ten and not one. */
  function takeExit(routeType) {
    if (S.mode !== "play") return;
    S.exits++;
    const r = Score.exit(routeType);
    S.score = Score.read().carried;
    blip("exit");
    if (r.checkpoint) {
      flashCheckpoint(r);
      blip("exit");
    } else flashExit(routeType);
  }

  /* A checkpoint is the best news in the game and it gets its own
     banner rather than sharing the exit's. */
  function flashCheckpoint(r) {
    banner.textContent = `CHECKPOINT · ${fmt(r.paid)} BANKED`;
    banner.classList.add("on");
    bannerT = 2.6;
  }

  /* ── a wreck is a thing that happens over several seconds ───────────
     It used to be a state change: the picture stopped, the car turned
     brown, a panel came up nine tenths of a second later. Every wreck
     in this game was the same wreck.

     What actually ends a car is mechanical and it is directional. A
     corner has failed — a wheel is off, or folded under, or the tyre is
     gone and the hub is in the tarmac — and that corner is now steering
     the car. It drags the nose round toward the side that failed, it
     hauls the whole car across the road in the same direction, and it
     scrubs speed off far faster the more sideways it gets, because a
     car travelling at ninety degrees to where it points is one enormous
     brake. Then it runs out of energy and sits there.

     `side` is which corner went, and every caller knows: the barrier
     throws you off itself, the field trips you toward the way you were
     already sliding, the gore nose deflects you toward the lanes. If
     nobody says, it is a coin toss.

     The wreck no longer ignores the world, though — see step(). A
     pileup IS a chain of secondary impacts and the secondary impact is
     what kills people, so a wreck that reaches the median hits it
     through the same solver everything else does.

     `report` is what the impact worked out to, if there was one, so
     the panel can print the arithmetic afterwards. `quiet` is for the
     things that end a run without wrecking the car — the fence is
     forty kilos of wire and going through it is a full stop, not a
     roll. */
  function crash(cause, side, report, quiet) {
    if (S.mode !== "play") return;
    S.mode = "wreck";
    S.cause = cause;
    S.why = pick(WHY[cause] || WHY.road);
    /* Cleared, not merely overwritten. Running off the end of the road
       is not an impact, and leaving the last one lying in `S.report`
       had the panel print the arithmetic of a scrape you survived four
       miles earlier as though it were what happened. */
    S.report = report || null;
    S.wreckT = 0; S.shake = quiet ? 3 : 7; S.flash = quiet ? 0.4 : 1;
    S.panelShown = false;
    S.quiet = !!quiet;
    S.wreckSide = side ? (side > 0 ? 1 : -1) : (Math.random() < 0.5 ? -1 : 1);
    S.roll = quiet ? S.roll : 0;
    /* The first snap of the corner letting go, before the drag takes
       over. Sharper the faster it happened. */
    S.spin = quiet ? 0
      : S.wreckSide * rnd(0.6, 1.5) * (0.4 + 0.6 * (S.speed / V_MAX));
    if (quiet) {
      S.speed = 0; S.vu = 0;
      blip("thud");
    } else {
      puff(S.x, S.y, 26, "debris");
      puff(S.x, S.y, 12, "fire");
      blip("crash");
    }
    if (A.ready) { A.eng.gain.value = 0; A.nG.gain.value = 0; }
    Skill.endRun();

    /* ── the books close ──────────────────────────────────────────────
       Everything carried since the last checkpoint is gone; everything
       banked at one is kept and goes to the permanent ledger, which is
       what may open a new vehicle. `S.run` is held for the wreck panel
       to report, because by the time it draws, score.js has forgotten. */
    S.run = Score.end(cause || "wreck");
    S.run.lostAt = S.exits;
    /* Read before anything stops the traffic, because `Cars.start`
       zeroes it and a restart would otherwise report the next run's
       tally on this run's panel. */
    S.run.passed = (typeof Cars !== "undefined" && Cars.passed) ? Cars.passed() : 0;
    S.opened = Progress.endRun({
      banked: S.run.banked, km: S.run.km, exits: S.run.exits,
    });
    drawBank();
    drawCarCard();

    S.newBest = S.run.banked > best;
    if (S.newBest) {
      best = Math.floor(S.run.banked);
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* private mode */ }
    }
    showWreck();
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD and panels
     ══════════════════════════════════════════════════════════════════ */
  const el = (id) => document.getElementById(id);
  const hudSpeed = el("hud-speed"), hudDist = el("hud-dist"),
        hudScore = el("hud-score"), hudBest = el("hud-best"),
        cellScore = el("cell-score"), hudMile = el("hud-mile"),
        hudBank = el("hud-bank");
  const panels = { title: el("panel-title"), pause: el("panel-pause"), wreck: el("panel-wreck") };
  const fmt = (n) => Math.floor(n).toLocaleString("en-US");
  const km = () => S.distPx * M_PER_PX / 1000;
  /* Declared here rather than beside drawHud() because the units
     block below resets it at load, and `let` in a temporal dead zone
     throws — which killed the whole module silently. */
  let hudTick = -1;

  /* ── units ──────────────────────────────────────────────────────────
     This is a road in Tennessee, so miles per hour is the default and
     km/h is the option, not the other way round. The choice sticks,
     because nobody wants to set it twice. */
  const UNIT_KEY = "offramp.units";
  let units = "mph";
  try { units = localStorage.getItem(UNIT_KEY) === "kmh" ? "kmh" : "mph"; } catch (e) {}
  const unitBtn = el("units");
  function paintUnits() {
    if (unitBtn) unitBtn.textContent = units === "mph" ? "MPH" : "KM/H";
    hudTick = -1;                       // force the readouts to redraw
  }
  function setUnits(u) {
    units = u === "kmh" ? "kmh" : "mph";
    try { localStorage.setItem(UNIT_KEY, units); } catch (e) {}
    paintUnits();
  }
  if (unitBtn) unitBtn.addEventListener("click", () => setUnits(units === "mph" ? "kmh" : "mph"));
  paintUnits();

  function drawHud() {
    const tick = Math.floor(S.t * 10);
    if (tick === hudTick) return;
    hudTick = tick;
    if (units === "mph") {
      hudSpeed.innerHTML = Math.round(S.speed / KMH_PER_MPH) + "<small> mph</small>";
      hudDist.innerHTML = (km() / KMH_PER_MPH).toFixed(2) + "<small> mi</small>";
    } else {
      hudSpeed.innerHTML = Math.round(S.speed) + "<small> km/h</small>";
      hudDist.innerHTML = km().toFixed(2) + "<small> km</small>";
    }
    /* SCORE is what you are CARRYING — not what you have won. It is at
       risk until the next checkpoint, which is what the second line
       counts down to, and showing the two together is the whole tension
       of the thing: a large number and how many exits until it is
       actually yours. BEST stays the best single run's banked total. */
    const sc = Score.read();
    /* The points, and only the points. The multiplier used to be
       printed beside them as "1,240  ×2.2" — two numbers in a cell four
       characters wide, on a phone, at a hundred miles an hour. The
       multiplier is still doing all of its work; you can just see what
       it is doing in the number going up, which is the only part of it
       anybody was reading. It still drives the cell going hot. */
    hudScore.textContent = fmt(sc.carried);
    // BEST is off the gantry now; it lives on the RECORD tab
    if (hudBest) hudBest.textContent = fmt(best);
    /* Hot above ×4, which needs at least two of the three terms to be
       doing something — it was ×1.5 when the multiplier could only ever
       reach ×2.8 off the exit combo. */
    cellScore.classList.toggle("hot", sc.mult > 4);
    /* The cell is already labelled "Bank in", so the value is a count
       and a noun and nothing else — it has to fit on one line beside
       four other cells. */
    if (hudBank) {
      hudBank.innerHTML = sc.toCheckpoint === 1
        ? "1<small> exit</small>" : `${sc.toCheckpoint}<small> exits</small>`;
    }
    /* Where you are on the real road, which is the one number on this
       machine that a driver would recognise: mile marker and state, the
       same pair painted on the little green posts. */
    if (hudMile) {
      /* On the mainline this is exact; on a ramp or a truck stop it is
         the corridor position that structure hangs off, which is right
         to within its own half mile and never blank. */
      const px = S.road
        ? (S.road.corridor ? S.road.baseS + S.s : S.road.corridorPx)
        : null;
      const mk = px != null ? World.marker(px) : null;
      hudMile.textContent = mk
        ? `${Math.floor(mk.mile)}` + `<small> ${mk.state}</small>` : "—";
      if (mk) hudMile.innerHTML = `${Math.floor(mk.mile)}<small> ${mk.state}</small>`;
    }
  }

  const banner = el("banner");
  let bannerT = 0;
  function flashExit(routeType) {
    banner.textContent = routeType === "loop" ? "LOOP COMPLETE"
      : routeType === "signal" ? "LIGHTS TO FREEWAY"
      : routeType === "beltway" ? "BELTWAY"
      : routeType === "radial" ? "RADIAL CONNECTOR"
      : "FREEWAY CONNECTOR";
    banner.classList.add("on");
    bannerT = 1.8;
  }
  /* A short word about something that just happened to the car, on the
     same strip the exit banner uses. Damage, a tyre, a save. */
  function note(text) {
    if (!banner) return;
    banner.textContent = text;
    banner.classList.add("on");
    bannerT = 1.4;
  }

  function showPanel(name) {
    for (const k in panels) panels[k].classList.toggle("on", k === name);
    /* The one funnel every panel goes through, which is the only place
       the gear's state can be kept honest — a run can come off pause by
       the key, by the gear, or by a tap on the road. */
    const sb = document.getElementById("settings-btn");
    if (sb) sb.setAttribute("aria-pressed", String(name === "pause"));
  }

  /* ── the arithmetic, printed ────────────────────────────────────────
     A probabilistic model that never shows its working reads as
     arbitrary — you died, and there is no way to tell whether you were
     unlucky or wrong. So the panel says what the impact actually was
     and what the odds actually were, in the units on the speedometer.
     Seeing "68 mph of sideways, about one in three" after the fact is
     how the curve gets learned. */
  const speedTxt = (kmh) => units === "mph"
    ? Math.round(kmh / KMH_PER_MPH) + " mph" : Math.round(kmh) + " km/h";
  const pctTxt = (p) => p >= 0.995 ? "almost certain"
    : p < 0.005 ? "under 1 in 200"
    : p > 0.5 ? Math.round(p * 100) + "%"
    : "about 1 in " + Math.max(2, Math.round(1 / p));

  function wreckSums() {
    const w = S.report;
    if (!w) return "";
    const line = [];
    if (w.kind === "roll") {
      line.push(`${speedTxt(w.vLat)} of sideways in soft ground`);
      line.push(`${w.turns} quarter-turn${w.turns === 1 ? "" : "s"} at ${speedTxt(S.topSpeed)}`);
      line.push(`the roll itself: ${pctTxt(w.pRoll)}`);
    } else {
      line.push(`${speedTxt(w.dv)} of delta-v into ${w.what || "it"}`);
      if (w.dirF > 1.2) line.push(`side-on, so it counts as ${speedTxt(w.dvEff)}`);
      else if (w.ride < 0.95) line.push(`spread over the stroke: counts as ${speedTxt(w.dvEff)}`);
    }
    if (w.pFatal !== undefined) {
      line.push(S.cause === "fence"
        ? "the fence was never the problem"
        : `fatal: ${pctTxt(w.pFatal)} · walking away: ${pctTxt(1 - w.pDisabling)}`);
    }
    if (S.dvTotal > w.dv * 1.2) line.push(`${speedTxt(S.dvTotal)} of delta-v in total`);
    return line.join("\n");
  }

  function showWreck() {
    el("wreck-why").textContent = S.why;
    /* `disabling` is not `fatal`, and the difference is the whole
       reason the model has bands at all. The run is over either way,
       but the panel is allowed to say which one it was. */
    const survived = S.report && S.report.outcome === "disabling";
    const wh = el("wreck-head");
    if (wh) wh.textContent = S.cause === "fence" ? "OUT OF ROAD"
      : survived ? "SURVIVED" : "WRECKED";
    const sums = el("wreck-sums");
    if (sums) {
      const t = wreckSums();
      sums.textContent = t;
      sums.hidden = !t;
    }
    el("w-dist").textContent = km().toFixed(2) + " km";
    /* Banked, then what the wreck cost. The second line is the point of
       the whole checkpoint scheme and it should sting to read. */
    const r = S.run || { banked: 0, lost: 0, exits: 0 };
    el("w-score").textContent = fmt(r.banked);
    if (el("w-lost")) {
      el("w-lost").textContent = r.lost > 0.5 ? `− ${fmt(r.lost)}` : "—";
      el("w-lost").classList.toggle("bad", r.lost > 0.5);
    }
    if (el("w-passed")) el("w-passed").textContent = fmt(r.passed || 0);
    if (el("w-exits")) {
      const since = r.exits % Score.CHECKPOINT_EVERY;
      el("w-exits").textContent = r.exits === 0 ? "none"
        : since === 0 ? `${r.exits} · all banked`
        : `${r.exits} · ${since} unbanked`;
    }
    el("w-top").textContent = Math.round(S.topSpeed) + " km/h";
    el("w-best").hidden = !S.newBest;

    /* And if the run opened a vehicle, that is the headline and not a
       footnote. */
    if (el("w-opened")) {
      const opened = (S.opened && S.opened.opened) || [];
      el("w-opened").hidden = !opened.length;
      if (opened.length) {
        el("w-opened").innerHTML = opened.length === 1
          ? `UNLOCKED · <b>${opened[0].make} ${opened[0].model}</b>`
          : `UNLOCKED · <b>${opened.length} VEHICLES</b>`;
      }
    }
    /* The panel is raised by the wreck update when the car has finished
       moving — see step(). Putting it on a timer here meant it landed
       on top of a car that was still travelling at 200 km/h. */
  }

  /* ══════════════════════════════════════════════════════════════════
     fixed-network map — drawn only when asked for

     This is the same road graph the player drives, reduced to a small
     pixel plot. It is not a second generated map and it does not alter
     the run. Opening it holds the simulation; closing it restores the
     exact mode it interrupted.
     ══════════════════════════════════════════════════════════════════ */
  const mapPanel = el("map-panel"), mapCanvas = el("map-canvas");
  const mapCtx = mapCanvas.getContext("2d", { alpha: false });
  const mapToggle = el("map-toggle"), mapClose = el("map-close");
  let mapOpen = false, mapReturnMode = "title";

  function mapLine(x0, y0, x1, y1, colour, width) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    mapCtx.fillStyle = colour;
    for (;;) {
      mapCtx.fillRect(x0 - (width >> 1), y0 - (width >> 1), width, width);
      if (x0 === x1 && y0 === y1) break;
      const e2 = err * 2;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /* ── the overview ───────────────────────────────────────────────────
     Drawn from LAT/LON, not from the world.

     The game world is I-40 developed onto a plane: every curve and every
     distance is true, and global orientation is allowed to drift,
     because you never see more than 660 px of it. Draw 2,551 miles of
     that and the road curls into a spiral. So the map uses `I40.map`,
     which is the real geography sampled every two miles — and because
     the samples are at fixed mileage, finding the car on it is a
     division rather than a search.

     This used to draw `World.roads`, which was the whole fictional
     network and is now the twenty live miles. It also read stats that
     no longer exist, and said "undefined METROS". */
  function renderMap() {
    const line = I40.map, stepPx = I40.mapStepMi * World.MILE;
    const w = mapCanvas.width, h = mapCanvas.height, pad = 10;

    let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
    for (const [la, lo] of line) {
      if (la < minLa) minLa = la; if (la > maxLa) maxLa = la;
      if (lo < minLo) minLo = lo; if (lo > maxLo) maxLo = lo;
    }
    // equirectangular, squeezed by cos(lat) so the shape is not stretched
    const kx = Math.cos((minLa + maxLa) / 2 * Math.PI / 180);
    const spanX = Math.max(1e-6, (maxLo - minLo) * kx), spanY = Math.max(1e-6, maxLa - minLa);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const mx = (lo) => (w - spanX * scale) / 2 + (lo - minLo) * kx * scale;
    const my = (la) => (h + spanY * scale) / 2 - (la - minLa) * scale;

    mapCtx.imageSmoothingEnabled = false;
    mapCtx.fillStyle = "#060b08";
    mapCtx.fillRect(0, 0, w, h);

    // the corridor
    for (let i = 1; i < line.length; i++)
      mapLine(mx(line[i - 1][1]), my(line[i - 1][0]),
              mx(line[i][1]), my(line[i][0]), "#56616a", 2);

    /* State lines, where the exit numbering resets — the one piece of
       structure this route has, and the reason exit 1 turns up eight
       times. Labelled, because "which state am I in" is most of what an
       overview of a 2,551-mile road is for. */
    mapCtx.font = "7px ui-monospace, Menlo, monospace";
    mapCtx.textAlign = "center";
    for (const st of I40.states) {
      const k = Math.round(st.startPx / stepPx);
      const p = line[Math.max(0, Math.min(line.length - 1, k))];
      if (!p) continue;
      const x = Math.round(mx(p[1])), y = Math.round(my(p[0]));
      mapCtx.fillStyle = "#7d8a94";
      mapCtx.fillRect(x, y - 5, 1, 11);
      const mid = Math.round(st.startPx / stepPx + (st.endPx - st.startPx) / stepPx / 2);
      const q = line[Math.max(0, Math.min(line.length - 1, mid))];
      if (q) {
        mapCtx.fillStyle = "#9fb0a6";
        mapCtx.fillText(st.name, Math.round(mx(q[1])), Math.round(my(q[0])) - 9);
      }
    }

    // every exit, one pixel each
    mapCtx.fillStyle = "#2f7d4e";
    for (const e of I40.exits) {
      const k = Math.round(e.px / stepPx);
      const p = line[Math.max(0, Math.min(line.length - 1, k))];
      if (p) mapCtx.fillRect(Math.round(mx(p[1])), Math.round(my(p[0])), 1, 1);
    }

    // the live window, in white: the stretch that actually exists as road
    if (S.road && S.road.corridor) {
      const k0 = Math.round(S.road.baseS / stepPx);
      const k1 = Math.round((S.road.baseS + R.len(S.road)) / stepPx);
      for (let i = Math.max(1, k0); i <= Math.min(line.length - 1, k1); i++)
        mapLine(mx(line[i - 1][1]), my(line[i - 1][0]),
                mx(line[i][1]), my(line[i][0]), "#e8e2cc", 2);
    }

    /* The player's marker is deliberately oversized: the map spans two
       and a half thousand miles and a scale-accurate car would be a
       thousandth of a pixel. */
    const corridorPx = S.road && S.road.corridor ? S.road.baseS + S.s : 0;
    const f = corridorPx / stepPx;
    const i0 = Math.max(0, Math.min(line.length - 1, Math.floor(f)));
    const i1 = Math.min(line.length - 1, i0 + 1);
    const t = f - i0;
    const la = line[i0][0] + (line[i1][0] - line[i0][0]) * t;
    const lo = line[i0][1] + (line[i1][1] - line[i0][1]) * t;
    const px = Math.round(mx(lo)), py = Math.round(my(la));
    mapCtx.fillStyle = "#1a0b08"; mapCtx.fillRect(px - 3, py - 3, 7, 7);
    mapCtx.fillStyle = "#ff6a4d"; mapCtx.fillRect(px - 2, py - 2, 5, 5);
    mapCtx.fillStyle = "#fff0d5"; mapCtx.fillRect(px, py, 1, 1);

    const mk = World.marker(corridorPx);
    const st = World.state.mapStats;
    el("map-status").innerHTML = mk
      ? `<b>■ YOU</b> · ${mk.state} MILE ${Math.floor(mk.mile)} · ` +
        `${st.route} · ${st.corridorMiles} MI · ${st.exits} EXITS`
      : `<b>■ YOU</b> · ${st.route}`;
  }

  function setMap(open) {
    if (open === mapOpen) return;
    mapOpen = open;
    mapToggle.setAttribute("aria-pressed", String(open));
    mapToggle.setAttribute("aria-label", open ? "Close freeway map" : "Open freeway map");
    if (open) {
      mapReturnMode = S.mode;
      S.mode = "map";
      keys.clear(); touchRelease();
      mapPanel.hidden = false;
      renderMap();
      mapClose.focus();
    } else {
      mapPanel.hidden = true;
      if (S.mode === "map") S.mode = mapReturnMode;
      mapToggle.focus();
    }
  }

  mapToggle.addEventListener("click", () => setMap(!mapOpen));
  mapClose.addEventListener("click", () => setMap(false));
  mapPanel.addEventListener("pointerdown", (e) => e.stopPropagation());

  /* ── settings, which is the same door as pause ──────────────────────
     There is nowhere else for it to go. Everything you might want to
     change mid-run — the sound, the units, leaving — is a thing you do
     while stopped, and the game already has a screen for being stopped
     with the one sentence on it that matters: what walking away costs.
     So the gear opens THAT, by the same `hold()` every other route in
     uses, and the settings sit on it.

     `touchRelease` because the thumb that pressed the gear is not the
     thumb that was on the gas, and the gas gets no `pointerup` once a
     panel is over it — without this you come back off pause with the
     throttle still open. */
  const settingsBtn = el("settings-btn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (S.mode === "play") { touchRelease(); hold(); }
      else if (S.mode === "pause") { S.mode = "play"; showPanel(null); }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     start and reset
     ══════════════════════════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════════════════════════
     THE GARAGE, on the title screen

     You cycle through the whole table and not only what you have
     earned, because a ladder you cannot see is not a ladder — the point
     of the Corvette being visible at 4,000 banked is that you know it
     is there. A locked row shows what it costs and refuses to start.
     ══════════════════════════════════════════════════════════════════ */
  let carIdx = 0;

  /* ── the vehicle, on the card ───────────────────────────────────────
     (Ric, 2026-08-13: "add so in the garage you can see what the car
     looks like.")

     The SAME sprite the game draws, not an illustration of it, so what
     you pick is what arrives — and so that a shape nobody thought to
     check shows up here the moment it is wrong.

     Blown up by a WHOLE number. A pixel-art sprite at 3.4× is a mess of
     uneven pixels, so the scale is floored and the bitmap is centred in
     whatever is left over; the canvas is square and generous enough for
     the longest thing in the garage, which is the F-150 at 33 px. */
  function drawCarShot(c) {
    const cvsEl = el("car-shot");
    if (!cvsEl || typeof Draw === "undefined" || !Draw.vehicleBitmap) return;
    const b = Draw.vehicleBitmap(c);
    if (!b) return;
    const g = cvsEl.getContext("2d");
    const W = cvsEl.width, H = cvsEl.height;
    g.clearRect(0, 0, W, H);
    const k = Math.max(1, Math.floor(Math.min(W / b.w, H / b.h)));
    /* Straight from the packed bitmap into an ImageData of its own size,
       then one scaled blit — rather than k² fillRects, which for the
       lorry-sized rows is a few thousand calls every time you press an
       arrow. */
    const img = g.createImageData(b.w, b.h);
    new Uint32Array(img.data.buffer).set(b.d);
    const tmp = document.createElement("canvas");
    tmp.width = b.w; tmp.height = b.h;
    tmp.getContext("2d").putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, Math.round((W - b.w * k) / 2), Math.round((H - b.h * k) / 2),
                b.w * k, b.h * k);
  }

  function drawCarCard() {
    const c = Garage.ALL[carIdx];
    if (!c || !el("car-model")) return;
    const open = Progress.isUnlocked(c.id);
    const card = el("car-card");
    card.classList.toggle("locked", !open);

    el("car-make").textContent = c.make.toUpperCase();
    el("car-model").textContent = c.model;
    el("car-spec").textContent =
      `${c.year} · ${c.hp} hp · ${c.kg.toLocaleString()} kg`;

    /* The three figures every other number in data/garage.js is derived
       from. Shown in the units they were published in. */
    el("car-figs").innerHTML =
      cell("0–60", c.t60.toFixed(1), "s") +
      cell("TOP", String(c.top), "mph") +
      cell("60–0", String(c.stop), "ft");

    el("car-note").textContent = c.note;
    drawCarShot(c);

    const lock = el("car-lock");
    lock.hidden = open;
    if (!open) {
      const need = c.cost - Progress.total;
      lock.innerHTML = `LOCKED · <b>${fmt(need)}</b> TO GO`;
    }
    el("title-go").textContent = open
      ? "press start to drive"
      : "that one is not yours yet";
    el("title-go").style.opacity = open ? "" : ".6";

    /* Only worth saying while there is still something to unlock. */
    const have = Progress.unlocked().length, all = Garage.ALL.length;
    const count = el("car-count");
    if (count) count.textContent = have >= all
      ? `all ${all} vehicles`
      : `${have} of ${all} — the rest are on RECORD`;
  }

  /* ── the ladder ─────────────────────────────────────────────────────
     Every vehicle and what it costs, in order, on the RECORD tab. This
     is where the locked half of the garage lives now that the arrows
     step past it: something to go and look at, which is what a ladder
     is for. */
  function drawLadder() {
    const box = el("ladder");
    if (!box) return;
    const nx = Progress.next();
    box.innerHTML = Garage.ALL.map((c) => {
      const got = Progress.isUnlocked(c.id);
      const isNext = nx && nx.car.id === c.id;
      const cls = "lrow" + (got ? " got" : " locked") + (isNext ? " now" : "");
      const at = got ? "✓" : isNext
        ? `${fmt(c.cost - Progress.total)} to go`
        : fmt(c.cost);
      return `<div class="${cls}"><span class="who">${c.make} ${c.model}</span>` +
             `<span class="at">${at}</span></div>`;
    }).join("");
  }

  const cell = (k, v, u) =>
    `<div><span class="k">${k}</span><span class="v">${v}<small>${u}</small></span></div>`;

  /* Step to the next vehicle YOU CAN DRIVE, not the next row in the
     table. Ric: "make the car change to the ones you can change to."

     Paging through cars you cannot have on the way to one you can is
     the thing this replaces; the locked ones are on the RECORD tab as a
     ladder instead, which is somewhere you go to look rather than
     something in your way. Walks rather than filtering into a new array
     so the order is still the table's, and gives up after a full lap —
     with one vehicle unlocked, ▲ and ▼ are simply no-ops. */
  function cycleCar(step) {
    const n = Garage.ALL.length;
    for (let k = 0; k < n; k++) {
      carIdx = ((carIdx + step) % n + n) % n;
      if (Progress.isUnlocked(Garage.ALL[carIdx].id)) break;
    }
    const c = Garage.ALL[carIdx];
    Progress.select(c.id);
    setCar(c.id);
    drawCarCard();
    blip("tick");
  }

  /* ── looking one up ─────────────────────────────────────────────────
     (Ric, 2026-08-13: "also add a search bar.")

     Sixteen rows is past what two arrows are pleasant for. Scored
     rather than filtered, because the answer has to be ONE vehicle —
     the card shows one — and "m5" should not lose to whichever row
     happens to sit earliest in the table and contain an m.

     It reaches LOCKED rows on purpose. The arrows skip them so that the
     thing you cannot have is never in your way, and the record tab has
     the ladder to look at; but if you type "corvette" you want to be
     shown the Corvette, not told it does not exist. Landing on a locked
     row shows it and does not select it — `drawCarCard` already refuses
     to start on one and says so. */
  function findCar(q) {
    const n = q.trim().toLowerCase();
    if (!n) return -1;
    let best = -1, score = 0;
    Garage.ALL.forEach((c, i) => {
      const model = c.model.toLowerCase(), make = c.make.toLowerCase();
      const id = c.id.toLowerCase();
      let s = 0;
      if (id === n || model === n) s = 100;
      else if (model.startsWith(n) || make.startsWith(n) || id.startsWith(n)) s = 80;
      else if (model.includes(n) || make.includes(n)) s = 60;
      else if (`${c.year}`.includes(n) || c.note.toLowerCase().includes(n)) s = 30;
      /* A tie goes to the cheaper row, which is the one further down the
         ladder and the one more likely to be meant. ALL is cost-sorted,
         so "first wins" is exactly that rule. */
      if (s > score) { score = s; best = i; }
    });
    return best;
  }

  function searchCar(q) {
    const found = el("car-found");
    const i = findCar(q);
    if (!q.trim()) { if (found) { found.textContent = ""; found.classList.remove("miss"); } return; }
    if (i < 0) {
      if (found) { found.textContent = `nothing called “${q.trim()}”`; found.classList.add("miss"); }
      return;
    }
    carIdx = i;
    const c = Garage.ALL[i];
    const open = Progress.isUnlocked(c.id);
    if (open) { Progress.select(c.id); setCar(c.id); }
    drawCarCard();
    if (found) {
      found.classList.remove("miss");
      found.textContent = open ? `${c.make} ${c.model}` : `${c.make} ${c.model} — locked`;
    }
  }

  /* What the progress bar and the banked total say. Redrawn whenever
     the ledger could have changed, which is at load and after a run. */
  function drawBank() {
    if (!el("bank-total")) return;
    el("bank-total").textContent = fmt(Progress.total);
    const nx = Progress.next();
    if (!nx) {
      el("bank-bar").style.width = "100%";
      el("bank-next").textContent = "the whole garage is yours";
      return;
    }
    el("bank-bar").style.width = `${(nx.fraction * 100).toFixed(1)}%`;
    el("bank-next").innerHTML =
      `next: ${nx.car.make} ${nx.car.model} · <b>${fmt(nx.need)}</b> to go`;
  }

  /* ── the tabs ───────────────────────────────────────────────────────
     Three pages, one shown. Nothing is destroyed or rebuilt — the
     controls are the same elements they always were, which is why the
     day and hour selects keep their values across a tab change. */
  const PAGES = ["route", "garage", "record"];
  let page = "route";

  function showPage(name) {
    if (!PAGES.includes(name)) return;
    page = name;
    for (const p of PAGES) {
      const tab = el("tab-" + p), pane = el("page-" + p);
      if (tab) { tab.classList.toggle("on", p === name); tab.setAttribute("aria-selected", String(p === name)); }
      if (pane) pane.classList.toggle("on", p === name);
    }
    if (name === "record") drawLadder();
    blip("tick");
  }

  function initGarage() {
    const chosen = Progress.chosen();
    const i = Garage.ALL.findIndex((c) => c.id === chosen);
    carIdx = i < 0 ? 0 : i;
    setCar(chosen);
    drawCarCard();
    drawBank();
    drawLadder();
  }

  /* ── choosing what to drive ─────────────────────────────────────────
     The only way `S.car` is ever written. It has to reach three places
     and they are easy to forget separately, so they are one call:

       · `S.car`   the pull, the brakes and the ceiling, in this file
       · `S.steer` the wheel, scaled off the row's grip and mass
       · `Cars`    the player's body in the traffic sim — length, width
                   and mass, which decide what gap you fit in and what
                   every contact costs

     Refuses an unknown id rather than throwing, because the id comes
     out of localStorage and a save written by an older build must not
     be able to stop the game from starting. */
  function setCar(id) {
    S.car = Garage.get(id);
    S.steer = steerFor(S.car);
    if (typeof Cars !== "undefined" && Cars.setVehicle) Cars.setVehicle(S.car);
    /* And what it looks like. The sprite is the row's real footprint at
       the road's own scale, so the thing on the screen is the thing the
       traffic model is solving rather than a fixed red car with a
       different name over it. */
    if (typeof Draw !== "undefined" && Draw.setPlayerVehicle) Draw.setPlayerVehicle(S.car);
    return S.car;
  }

  function reset(mode) {
    S.mode = mode;
    const p = World.reset();
    const map = World.state.mapStats;
    if (map) el("map-note").textContent = `${map.route} · ${map.corridorMiles} MI · ${map.exits} EXITS · ${map.stops} STOPS`;
    /* Which way you are pointing is chosen on the sign, not assumed.
       `fwd` has always existed — traffic has carried a direction since
       the day it was written, and the surface rescue can already flip
       you when you join a road facing the other way — so the title
       screen is not adding a mode, only picking a value that the whole
       game already understood. East is increasing s, which is how a
       west-to-east mainline is built. */
    S.road = p.road; S.s = p.s; S.vu = 0;
    S.fwd = heading === "E";
    S.u = R.laneU(p.road, p.s, 1, S.fwd);
    S.camU = camTarget(p.road);
    S.speed = mode === "title" ? 122 : 100;
    S.onRamp = false; S.aimLane = 1; S.steer = steerFor(S.car);
    S.parts.length = 0; S.marks.length = 0;
    S.distPx = 0; S.score = 0; S.run = null; S.opened = null;
    S.topSpeed = 0; S.exits = 0;
    S.shake = 0; S.flash = 0; S.wreckT = 0; S.gravelT = 0;
    S.roll = 0; S.spin = 0; S.wreckSide = 1;
    S.scrapeT = 0; S.scrapeOff = 9; S.wallT = 0; S.onSoil = false;
    S.panelShown = false; S.why = ""; S.quiet = false;
    /* A new car every run. Damage is per-run state and always has been
       — it is what the `damage` band spends, and carrying it across a
       restart would make the second run harder than the first for no
       reason anybody chose. */
    S.dmg = freshDamage();
    S.report = null; S.dvTotal = 0;
    Skill.beginRun();
    S.newBest = false; S.hints.clear();
    place();
    /* The traffic, built around wherever this run starts. It takes a
       moment — the band settles itself against the corridor's own
       density before the first frame, which is the only way it can start
       full rather than seep in over the following minute — and this is
       the one place in the game where that moment is free. */
    S.traffic = null;
    /* One `chosenWhen()` for the whole run. It has to be resolved once
       and shared: "any hour" re-rolls on every call, so asking twice
       would run the traffic at one time of day and score the night
       bonus off another. */
    const when = chosenWhen();
    Score.begin({ car: S.car, hour: when.hour });
    if (typeof Cars !== "undefined" && S.road && S.road.corridor) {
      Cars.stop();
      const px0 = S.road.baseS + S.s;
      const st = World.stateAt(px0);
      Cars.start(px0, S.fwd, when, st ? st.name : null,
                 (Math.random() * 1e9) | 0);
    }
    /* Snapped, not eased. Easing is for a junction the car drives
       through; a restart is not a place it drove from. */
    S.camH = S.h;
    World.update(S.x, S.y, 0.016, S.road, S.s);
    showPanel(mode === "title" ? "title" : null);
    banner.classList.remove("on");
    hudTick = -1;
  }

  /* ── the direction on the sign ──────────────────────────────────────
     "E" or "W". Held outside reset() so it survives a wreck and a
     restart: you chose a direction when you walked up to the machine,
     and R puts you back on the road you picked rather than silently
     turning you round. */
  let heading = "E";
  const dirBtns = [el("dir-west"), el("dir-east")].filter(Boolean);

  /* ── the exit you start from ────────────────────────────────────────
     Twelve hundred of them across eight states, so the list is grouped
     by state and labelled with the real exit number — which is also the
     mile marker, so "TN 383" reads as both "Papermill" and "three
     hundred and eighty-three miles into Tennessee".

     Populated once, from the corridor, because the corridor is the only
     thing that knows where the exits are. */
  const startSel = el("start-exit"), wreckSel = el("wreck-exit");
  function fillStarts() {
    /* `typeof`, not `window.I40`: the corridor is declared with `const`
       at the top level of a classic script, which creates a script-scope
       binding and NOT a property of window. Guarding on window.I40 was
       always false, so the picker silently stayed empty. */
    if (!startSel || typeof I40 === "undefined") return;
    const byState = new Map();
    for (const st of I40.states) byState.set(st.name, []);
    /* Which state an exit is in is World's question, not this file's.
       Asking it here — with a ±4 mile window and "last match wins" —
       filed six exits under the wrong state, California's exit 153
       among them, in a list where Arizona's own numbering starts at 1.
       See World.stateAt: one rule, shared with the mile marker. */
    for (const e of I40.exits) {
      const st = World.stateAt(e.px);
      if (!st || !byState.has(st.name)) continue;
      byState.get(st.name).push(e);
    }
    const frag = document.createDocumentFragment();
    for (const [state, list] of byState) {
      if (!list.length) continue;
      const g = document.createElement("optgroup");
      g.label = state;
      for (const e of list) {
        const o = document.createElement("option");
        o.value = e.px;
        o.textContent = `${state} · Exit ${e.ref}`;
        g.appendChild(o);
      }
      frag.appendChild(g);
    }
    /* Clone BEFORE appending: appending a DocumentFragment empties it,
       so cloning afterwards copied nothing and the wreck panel's picker
       came up with no options in it at all. */
    const copy = wreckSel ? frag.cloneNode(true) : null;
    startSel.appendChild(frag);
    if (wreckSel) wreckSel.appendChild(copy);
    // default to Knoxville, which is the stretch this was built against
    let best = null, want = 2050 * World.MILE;
    for (const o of startSel.options)
      if (!best || Math.abs(+o.value - want) < Math.abs(+best.value - want)) best = o;
    if (best) {
      startSel.value = best.value;
      if (wreckSel) wreckSel.value = best.value;
      World.setStart(+best.value);
    }
  }
  fillStarts();

  /* ══════════════════════════════════════════════════════════════════
     when you are driving

     `traffic.js` keys the counters on day of week and hour, so this is
     not a cosmetic setting: it is what decides how much traffic there
     is, how much of it is lorries, and how fast it is going. Knoxville
     at five on a Friday is 2,178 veh/h/lane and the Mojave at three on a
     Sunday morning is one vehicle every twenty-nine seconds, and those
     are the same model reading the same counters.

     NOW is the wall clock, which is what it did before this existed.
     ANY re-rolls on every run, and re-rolls the day and the hour
     independently — Sunday at eight in the morning is a different road
     from Sunday at six in the evening, and being able to get either is
     the point of asking for it.
     ══════════════════════════════════════════════════════════════════ */
  const daySel = el("start-day"), hourSel = el("start-hour");
  const whenNote = el("when-note");
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];

  function hourLabel(h) {
    const ampm = h < 12 ? "am" : "pm";
    const t = h % 12 === 0 ? 12 : h % 12;
    return `${t}${ampm}`;
  }

  function fillWhen() {
    const opts = (sel, list) => {
      if (!sel) return;
      const frag = document.createDocumentFragment();
      for (const [value, label] of list) {
        const o = document.createElement("option");
        o.value = value; o.textContent = label;
        frag.appendChild(o);
      }
      sel.appendChild(frag);
      sel.value = "now";
    };
    opts(daySel, [["now", "Today"], ["any", "Any day"]]
      .concat(DAYS.map((d, i) => [String(i), d])));
    opts(hourSel, [["now", "Now"], ["any", "Any hour"]]
      .concat(Array.from({ length: 24 }, (_, h) => [String(h), hourLabel(h)])));
  }
  fillWhen();

  /* ── the garage, wired ──────────────────────────────────────────────
     The two buttons and the card are the whole of it. `initGarage`
     runs once here and sets S.car before the first frame, so the title
     screen's idling car is already the one you chose last time. */
  function nudgeLocked() {
    const c = Garage.ALL[carIdx];
    const lock = el("car-lock");
    if (!lock) return;
    lock.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" },
       { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      { duration: 220, iterations: 1 });
    el("title-go").textContent = `${fmt(c.cost - Progress.total)} more to unlock that`;
    blip("thud");
  }

  for (const nm of ["route", "garage", "record"]) {
    const t = el("tab-" + nm);
    if (t) t.addEventListener("click", (e) => { e.stopPropagation(); showPage(nm); });
  }
  if (el("car-prev")) el("car-prev").addEventListener("click", () => cycleCar(-1));
  if (el("car-next")) el("car-next").addEventListener("click", () => cycleCar(1));
  if (el("car-search")) {
    const box = el("car-search");
    box.addEventListener("input", () => searchCar(box.value));
    /* Space is DRIVE and the arrows are the garage, so every key that
       reaches this field has to stop here — otherwise typing "boxster"
       starts a run on the "s". Enter gives the field up rather than
       submitting anything, which puts space and the arrows back. */
    box.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); box.blur(); }
    });
    box.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  /* ── the code box ───────────────────────────────────────────────────
     `unlock` opens the garage; anything else is tried as a save code.
     Both land in the same field because from the player's side they are
     the same action, and because a second box would need a second
     explanation on a screen that already has five controls on it. */
  function enterCode() {
    const input = el("code-in"), note = el("code-note");
    if (!input || !note) return;
    const raw = input.value.trim();
    const say = (msg, cls) => {
      note.textContent = msg;
      note.classList.toggle("good", cls === "good");
      note.classList.toggle("bad", cls === "bad");
    };
    if (!raw) { say("", null); return; }

    if (raw.toLowerCase() === "unlock") {
      Progress.unlockAll();
      initGarage();
      input.value = "";
      say("the whole garage is open", "good");
      blip("exit");
      return;
    }

    const r = Progress.importCode(raw);
    if (r.ok) {
      initGarage();
      input.value = "";
      say(`save loaded — ${fmt(r.total)} banked`, "good");
      blip("exit");
    } else {
      say(r.why, "bad");
      blip("thud");
    }
  }

  if (el("code-go")) el("code-go").addEventListener("click", (e) => {
    e.stopPropagation(); enterCode();
  });
  if (el("code-in")) {
    /* Enter submits. The click handler on the frame would otherwise
       read a click in the box as "start driving", so both are stopped
       here rather than relying on the panel to swallow them. */
    el("code-in").addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); enterCode(); }
    });
    el("code-in").addEventListener("pointerdown", (e) => e.stopPropagation());
    el("code-in").addEventListener("click", (e) => e.stopPropagation());
  }

  if (el("wreck-menu")) el("wreck-menu").addEventListener("click", (e) => {
    e.stopPropagation();
    toMenu();
  });
  if (el("pause-quit")) el("pause-quit").addEventListener("click", (e) => {
    /* Stop it reaching the frame's pointerdown, which would read as
       "unpause and keep driving" and undo the click. */
    e.stopPropagation();
    toMenu();
  });
  initGarage();

  /* Resolved at the moment a run starts, so ANY is a fresh roll each
     time rather than one chosen when the page loaded. */
  function chosenWhen() {
    const d = new Date();
    const pick = (sel, now, n) => {
      const v = sel ? sel.value : "now";
      if (v === "now") return now;
      if (v === "any") return (Math.random() * n) | 0;
      return +v;
    };
    return {
      dow: pick(daySel, d.getDay(), 7),
      hour: pick(hourSel, d.getHours(), 24),
      /* The month is not offered. It moves the counters by a few per
         cent and there is nothing to choose between one and another —
         unlike the hour, which moves them by a factor of ten. */
      month: d.getMonth() + 1,
    };
  }

  /* What the road will actually be carrying, said in vehicles rather
     than in settings, so the choice means something before you make it.
     Read straight off the same counters the traffic will use. */
  function describeWhen() {
    if (!whenNote) return;
    const anyDay = daySel && daySel.value === "any";
    const anyHour = hourSel && hourSel.value === "any";
    if (anyDay || anyHour) {
      whenNote.innerHTML = anyDay && anyHour
        ? "a day and an hour, drawn fresh each run"
        : anyDay ? "any day, drawn fresh each run" : "any hour, drawn fresh each run";
      return;
    }
    if (typeof Traffic === "undefined" || !startSel || !startSel.value) {
      whenNote.textContent = ""; return;
    }
    const px = +startSel.value;
    const w = chosenWhen();
    const lanes = Math.max(1, Traffic.lanes(px));
    const perLane = Traffic.demand(px, w, 1) / lanes;
    const busy = perLane > 1500 ? "nose to tail"
               : perLane > 900 ? "busy"
               : perLane > 400 ? "steady"
               : perLane > 120 ? "quiet" : "almost empty";
    whenNote.innerHTML = `${DAYS[w.dow]} ${hourLabel(w.hour)} · `
      + `<b>${Math.round(perLane)}</b> veh/h/lane · ${busy}`;
  }
  for (const s of [daySel, hourSel, startSel])
    if (s) s.addEventListener("change", describeWhen);
  describeWhen();

  /* Both pickers set the same thing and mirror each other, so the exit
     you chose on the sign is the one already selected when you wreck —
     and changing it there changes where R puts you back. */
  function wirePicker(sel, other) {
    if (!sel) return;
    sel.addEventListener("change", () => {
      World.setStart(+sel.value);
      if (other) other.value = sel.value;
    });
    // the panels swallow clicks to start or restart; the picker must not
    for (const ev of ["pointerdown", "click", "keydown"])
      sel.addEventListener(ev, (e) => e.stopPropagation());
  }
  wirePicker(startSel, wreckSel);
  wirePicker(wreckSel, startSel);

  function setHeading(d) {
    heading = d === "W" ? "W" : "E";
    for (const b of dirBtns) b.setAttribute("aria-checked", String(b.dataset.dir === heading));
  }

  for (const b of dirBtns) {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      setHeading(b.dataset.dir);
      if (S.mode === "title") startDriving();
    });
  }
  setHeading("E");

  /* The one gate on a locked vehicle, and it is HERE rather than at the
     three call sites — a key, a direction button and a tap on the road
     all arrive through this function, and a check repeated three times
     is a check that will be two next month. */
  /* ── leaving the road ───────────────────────────────────────────────
     Back to the menu from a pause, and it closes the books exactly the
     way a wreck does: whatever was banked at a checkpoint is kept and
     whatever is being carried is gone.

     That is deliberate and it is the reason this is a button with a
     warning on it rather than a quiet Escape. If quitting banked the
     pot, the optimal play would be to build a ×15, stop, and take it —
     and every decision the checkpoint scheme exists to create would be
     replaced by that one. See score.js on the same argument.

     `Skill.endRun()` too, because a run that ended by walking away is
     still evidence about how it was driven, and skill.js's window is
     distance-based rather than run-based — dropping it would quietly
     make the record favour people who quit.

     Reachable from a WRECK too, which is the other place you are stuck
     and the only way to change vehicle after one. `crash()` has already
     closed the books by then, so the ledger work is gated on the run
     still being live — calling `Progress.endRun` twice would bank the
     same points a second time and count the run twice. */
  function toMenu() {
    const live = S.mode === "play" || S.mode === "pause";
    if (live) {
      Skill.endRun();
      const run = Score.end("left");
      Progress.endRun({ banked: run.banked, km: run.km, exits: run.exits });
    }
    if (typeof Cars !== "undefined") Cars.stop();
    reset("title");
    initGarage();
    showPanel("title");
  }

  /* What the pause panel says walking away would cost. Recomputed each
     time it opens, because it is the number the decision turns on. */
  function drawPauseRisk() {
    const p = el("pause-risk");
    if (!p) return;
    const sc = Score.read();
    if (sc.carried < 1) {
      p.innerHTML = "nothing is at risk yet";
      return;
    }
    p.innerHTML =
      `leaving loses <b>${fmt(sc.carried)}</b> — ` +
      `${sc.toCheckpoint} more exit${sc.toCheckpoint === 1 ? "" : "s"} banks it`;
  }

  /* Every way into a pause goes through here — the key, losing focus,
     and the tab being hidden — so the panel can never come up without
     the line saying what leaving would cost. It was three copies of two
     statements, which is how the third one gets forgotten. */
  function hold() {
    S.mode = "pause";
    drawPauseRisk();
    showPanel("pause");
  }

  function startDriving() {
    if (S.mode === "title" && !Progress.isUnlocked(Garage.ALL[carIdx].id)) {
      nudgeLocked();
      return;
    }
    audioStart(); reset("play"); showPanel(null);
  }

  /* ══════════════════════════════════════════════════════════════════
     input
     ══════════════════════════════════════════════════════════════════ */
  const HELD = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.code === "KeyG") { e.preventDefault(); setMap(!mapOpen); return; }
    if (mapOpen) {
      if (e.code === "Escape") setMap(false);
      e.preventDefault();
      return;
    }
    if (HELD.has(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.code === "KeyM") { setMuted(!A.muted); return; }
    /* On the sign, left and right choose a direction instead of steering
       — they are the same two keys you will steer with a second later,
       which is the arcade convention and means nobody has to be told. */
    if (S.mode === "title") {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "ArrowLeft") { setHeading("W"); return; }
      if (e.code === "ArrowRight") { setHeading("E"); return; }
      /* Up and down go through the garage. They have to be caught here,
         above the fallthrough, because on this screen every other key
         starts the run — and the two directions are already spoken for
         by the sign. */
      if (e.code === "ArrowUp") { cycleCar(-1); return; }
      if (e.code === "ArrowDown") { cycleCar(1); return; }
      /* Tabs. Caught here for the same reason the arrows are: on this
         screen every key that is not spoken for starts the run. */
      if (e.code === "Digit1") { showPage("route"); return; }
      if (e.code === "Digit2") { showPage("garage"); return; }
      if (e.code === "Digit3") { showPage("record"); return; }
      if (e.code === "Tab") {
        e.preventDefault();
        const i = PAGES.indexOf(page);
        showPage(PAGES[(i + (e.shiftKey ? -1 : 1) + PAGES.length) % PAGES.length]);
        return;
      }
      /* A vehicle you have not earned is not a vehicle you can drive
         off in. Say so once rather than silently doing nothing. */
      if (!Progress.isUnlocked(Garage.ALL[carIdx].id)) { nudgeLocked(); return; }
      startDriving();
      return;
    }
    /* Escape out of a pause goes back to the menu. It is the only key
       that does, and it is not on the pause panel's own "press P" line,
       because leaving costs the pot — the button beside it is the
       signposted way and this is the shortcut for somebody who already
       knows what it costs. */
    if (e.code === "Escape" && (S.mode === "pause" || S.mode === "wreck")) { toMenu(); return; }
    if (e.code === "KeyP") {
      if (S.mode === "play") { hold(); }
      else if (S.mode === "pause") { S.mode = "play"; showPanel(null); }
      return;
    }
    if (S.mode === "wreck" && (e.code === "KeyR" || e.code === "Enter" || e.code === "Space")) { startDriving(); return; }
    if (e.code === "KeyR" && S.mode === "play") { startDriving(); return; }
    if (e.code === "KeyH" && S.mode === "play") blip("horn");
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => {
    keys.clear(); touchRelease();
    if (S.mode === "play") { hold(); }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && S.mode === "play") { hold(); }
  });

  function markTouch() {
    if (isTouch) return;
    isTouch = true;
    document.body.classList.add("touch");
    document.querySelector("#panel-title .keys.kb").style.display = "none";
    document.querySelector("#panel-title .keys.tp").style.display = "grid";
    /* Every panel's last line names a key. On a machine with no keys
       they all have to name the gesture instead, and they were three
       separate strings of which exactly one had been remembered — the
       pause panel still said PRESS P on a phone that has no P. */
    const say = { "title-go": "tap to drive",
                  "pause-go": "tap the road to keep driving",
                  "wreck-go": "tap to get back in" };
    for (const id in say) { const e = document.getElementById(id); if (e) e.textContent = say[id]; }
  }

  frame.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") markTouch();
    audioStart();
    /* ── a control is not the road ────────────────────────────────────
       Everything below treats a press anywhere in the frame as "get
       driving": on the title it starts the run, on a wreck it restarts,
       and on a pause it resumes. The panels sit INSIDE the frame, so
       every button on them was being answered by this handler before
       its own click could land — `pointerdown` fires first, the panel
       was dismissed, and the click arrived at nothing.

       That is the bug Ric hit as "leave the road button doesnt work
       when you hit pause", and it was never only that button: the three
       tabs, the garage arrows and BACK TO THE GARAGE were all being
       swallowed the same way. Stopping propagation on each of them is
       the fix that has to be remembered every time a control is added,
       so the test is here instead — anything interactive is not the
       road, and the road is what this handler is for. */
    if (e.target instanceof Element &&
        e.target.closest("button, input, select, textarea, label, a")) return;
    if (S.mode === "title") startDriving();
    else if (S.mode === "wreck") { if (S.wreckT > 0.9) startDriving(); return; }
    else if (S.mode === "pause") { S.mode = "play"; showPanel(null); }
    touch.active = true; touch.lastX = e.clientX;
    frame.setPointerCapture?.(e.pointerId);
  });
  frame.addEventListener("pointermove", (e) => {
    if (!touch.active) return;
    const dx = e.clientX - touch.lastX;
    touch.lastX = e.clientX;
    const scale = cvs.clientWidth / Draw.VW || 1;
    touch.steer = clamp(touch.steer + (dx / scale) * 0.19, -1, 1);
  });
  const endTouch = () => { touch.active = false; touch.steer = 0; };
  frame.addEventListener("pointerup", endTouch);
  frame.addEventListener("pointercancel", endTouch);

  /* ── the four buttons ───────────────────────────────────────────────
     Each one is a key that happens to be round: press sets its flag,
     release clears it, and `steerInput`/`throttleInput` read the flags
     exactly as they read `keys`.

     `setPointerCapture` is the whole reason this is pointer events and
     not click: without it, sliding a thumb off the edge of a button
     mid-corner never delivers the release and the input sticks on. With
     it the release lands on the button that took the press, wherever
     the thumb has got to by then. `pointercancel` covers the rest —
     the browser taking the gesture for a scroll or a system edge swipe.

     `preventDefault` on the press stops the double-tap-to-zoom and the
     press-and-hold text selection that otherwise arrive halfway through
     a corner. */
  function held(id, set) {
    const b = el(id);
    const go = (on) => { set(on); b.classList.toggle("on", on); };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); markTouch(); audioStart();
      go(true); b.setPointerCapture?.(e.pointerId);
    });
    b.addEventListener("pointerup", () => go(false));
    b.addEventListener("pointercancel", () => go(false));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    return b;
  }
  const brake = held("brake", (on) => { touch.brake = on; });
  held("gas", (on) => { touch.gas = on; });
  held("steer-l", (on) => { touch.left = on; });
  held("steer-r", (on) => { touch.right = on; });
  if (matchMedia("(any-pointer: coarse) and (any-hover: none)").matches) markTouch();

  /* ══════════════════════════════════════════════════════════════════
     attract mode

     Nobody is steering, so nothing has to: the car keeps its offset
     across a road that is already going where it goes, and drifts
     between lanes now and then so the screen isn't a still frame with
     scenery on it. It uses the same prebuilt road and will happily
     run past a real interchange.
     ══════════════════════════════════════════════════════════════════ */
  function autopilot(dt) {
    const lanes = R.laneCount(S.road, S.s, true);
    if (Math.random() < 0.4 * dt) S.aimLane = (Math.random() * lanes) | 0;
    const tu = R.laneU(S.road, S.s, Math.min(S.aimLane, lanes - 1), true);
    S.u += clamp(tu - S.u, -46 * dt, 46 * dt);
    S.s += pxs(S.speed) * dt;
    S.distPx += pxs(S.speed) * dt * 0.25;
    // the attract loop never leaves the main line, so it never wrecks
    if (S.s > R.len(S.road) - 400) reset("title");
    easeCamera(dt);
    place();
  }

  /* ══════════════════════════════════════════════════════════════════
     the loop — fixed steps, so physics does not change with framerate
     ══════════════════════════════════════════════════════════════════ */
  const STEP = 1 / 120;
  let acc = 0, last = performance.now();

  /* `difficulty()` was here — a 0..1 ramp on distance that traffic used
     to thicken itself with, and nothing has read it since traffic was
     deleted. Whatever difficulty means on this corridor is a question
     for PLAN.md §2, where the scoring is; a curve with no consumer is
     not an answer to it. */

  /* ── the traffic clock ──────────────────────────────────────────────
     Stepped from the fixed update rather than the frame, so the model
     runs at the same rate on every machine — `cars.js` accumulates and
     spends whole 10 Hz ticks, which is the rate BEHAVIOUR.md's two
     trajectory datasets were published at and every number in the
     scoreboard was measured against.

     It keeps running while you are wrecked. A motorway does not stop
     because you did, and the traffic arriving at the back of what is
     left of your car is the thing `avoid` was written for. */
  function stepTraffic(dt) {
    if (typeof Cars === "undefined" || !Cars.running() || !S.road) return;
    const px = S.road.corridor ? S.road.baseS + S.s : S.road.corridorPx;
    if (px == null) return;

    /* ── hand the car over before anybody is asked what they want ─────
       On the corridor the player is a body in the traffic's index, so
       the drivers behind follow them, the polite ones move over, and
       anybody can hit them. Off it — down a ramp, through a truck stop,
       or wrecked on the grass — the body is withdrawn rather than left
       standing in a lane the player is not in. */
    const root = World.state.root;
    const onMain = S.road.corridor && S.mode === "play";
    /* Before anything else: the traffic runs on as many lanes as the
       road has here, not as many as it had where the run started. */
    if (S.road.corridor) Cars.fitLanes(root, S.s, S.fwd);
    /* Where the car is on the road, and nothing more — which carriageway
       that puts it on, which lane, and how its nose relates to its
       middle are all `cars.js`'s to work out, because it is the file
       that has to agree with itself about them. */
    if (onMain) {
      /* `S.vu` last, because it is the newest of these and the traffic
         went without it for a long time: without a lateral velocity
         every sideswipe solved as though the player were tracking dead
         straight. */
      Cars.setPlayer(root, S.s, S.u, S.fwd, kmh2ms(S.speed),
                     keys.has("ArrowDown") || keys.has("KeyS"), S.vu);
    } else Cars.setPlayer(null);

    /* Position only. How fast the band is travelling ALONG THE CORRIDOR
       is not the speedometer — on a ramp you can be doing 100 km/h and
       barely moving along the freeway — so `cars.js` differences it and
       there is only one answer rather than two that can disagree. */
    Cars.update(dt, px);

    /* ── and answer for whatever hit us ───────────────────────────────
       `sim.js` computes the impulse with both real masses and hands back
       what it did to the player; what that COSTS them is this file's
       question, and `land()` is the same answer it gives for a barrier,
       a fence and a blowout. One model of what a crash does to a person,
       not two. */
    const hits = Cars.contacts();
    if (!hits || S.mode !== "play") return;
    for (const h of hits) {
      const w = weigh(h.dv, h.angle);
      const cause = h.oncoming ? "headon"
                  : h.rear ? (h.fromBehind ? "shunted" : "rearend") : "swipe";
      /* ── what it did to the car, before what it did to the driver ───
         (Ric, 2026-08-12: "i can push cars out of the way look at the
         crash mechanic.")

         He could. `sim.js` solved both bodies and applied only the
         other one, so running into somebody cost the player nothing at
         all: measured, 229 contacts in sixty seconds at 108 km/h
         without losing a single km/h, while every car hit was shoved
         out of the way. The car you drive was an immovable object with
         a 1500 kg label on it.

         This is the same line `scrapeWall` has run for the barrier
         since it was written — `S.speed = max(0, solver's answer)` —
         and it is here for the same reason: ONE model of what an
         impact does, not one for walls and a shrug for traffic. Rear-
         end a stationary car at 108 and you come out the other side at
         51; do it to a parked artic and you stop dead.

         Unclamped at the top because being shunted from behind should
         shove you FORWARD, which is the same equation with the sign
         the solver gives it. The driving update clamps to `top` on the
         next line it runs anyway. */
      if (h.dvAlong) S.speed = Math.max(0, S.speed + ms2kmh(h.dvAlong));
      /* ── and the sideways half of it ────────────────────────────────
         The same handoff across the road. `scrapeWall` has always done
         `S.vu = ms2pxs(res.va.x)` off the barrier solver and this is the
         identical line for traffic.

         This is a NUDGE and not a shove, which is the whole reason it
         does not fight §8's "steering commands a rate". Solved: a car
         drifting into your flank at 1 m/s leaves you crossing the road
         at 0.34 m/s — about 2 px/s, under half the rate of an ordinary
         lane change — and the wheel pulls it straight out again as soon
         as you ask. That is what a real sideswipe does: it is a
         correction you have to make, not a lane you get thrown into.
         The thing §8 rejected was the player being POSITIONED by the
         solver, and they still are not. */
      if (h.vuAfter != null) S.vu = h.vuAfter;
      /* A shove you can feel even when it does not end the run — the
         same treatment a barrier scrape gets. */
      S.shake = Math.max(S.shake, Math.min(2.4, h.eff / 14));
      blip("scrape");
      if (land(w, cause, Math.sign(h.theirLane - Cars.laneAt(root, S.s, S.u, S.fwd)) || 1,
               h.corner))
        return;                                    // that one ended it
    }
  }

  function step(dt) {
    S.t += dt;
    S.shake = Math.max(0, S.shake - dt * (S.mode === "wreck" ? 9 : 14));
    S.flash = Math.max(0, S.flash - dt * 3.4);
    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) banner.classList.remove("on");
    }

    if (S.mode === "title") {
      S.speed = 122;
      autopilot(dt);
      rebase(World.update(S.x, S.y, dt, S.road, S.s));
      updateParts(dt);
      return;
    }

    if (S.mode === "wreck") {
      S.wreckT += dt;
      const dir = S.fwd ? 1 : -1;
      /* How much is left to work with. A wreck is driven by the energy
         it still has: everything below scales by this, so the car
         spins hard and travels far while it is quick and then settles
         and stops rather than pirouetting forever at 3 km/h. */
      const bite = S.speed / V_MAX;

      /* the failed corner, dragging */
      S.spin += S.wreckSide * WRECK_TORQUE * bite * dt;
      S.spin *= Math.max(0, 1 - 2.2 * dt);
      S.roll += S.spin * dt;
      S.vu += S.wreckSide * WRECK_PULL * bite * dt;
      S.vu *= Math.max(0, 1 - 1.4 * dt);

      /* and scrubbing. The more sideways the car is, the more of it is
         facing the direction of travel, and the harder it slows —
         which is why a wreck that spins stops in half the distance of
         one that slides straight. */
      const scrub = 1 + 1.7 * Math.abs(Math.sin(S.roll));
      S.speed = Math.max(0, S.speed - (30 + 60 * bite) * scrub * dt);

      const stepPx = pxs(S.speed) * dt;
      S.u += dir * S.vu * dt;
      /* ── the wreck lives in the world ─────────────────────────────
         This used to ask nothing about surfaces, with one hard-coded
         exception clamping the car out of the median. That was a
         defensible simplification for a road with nothing on it and it
         stops being defensible the moment traffic exists, because a
         pileup IS a chain of secondary impacts and the secondary
         impact is what actually kills people.

         So the wall goes through the same solver as everything else,
         with the wreck's real velocity AND its yaw rate, and the
         contact point is whichever corner is deepest into the concrete
         — which is what turns a wreck that arrives spinning into one
         that arrives spinning the other way. The delta-v accumulates
         and the panel reports the total.

         The grind afterwards is charged PER SECOND, not per frame.
         Written as a multiplier it runs 120 times a second for as long
         as the car leans on the thing, and a wreck that touched a wall
         at 220 mph stopped dead inside a fifth of a second. */
      if (S.road.kind !== "ramp") {
        const face = wallFace(S.road, S.s);
        if (Math.abs(S.u) < face) {
          const side = S.u >= 0 ? 1 : -1;
          const out = side * dir;
          if (S.wallT <= 0) {
            const r = deepestCorner(out);
            const res = IM.solve(carBody(S.vu, S.speed, S.spin, r), IM.fixed(),
                                 { n: { x: out, y: 0 }, mu: IM.BODIES.concrete.mu,
                                   eps: IM.BODIES.concrete.epsMax });
            if (res) {
              S.vu = ms2pxs(res.va.x);
              S.speed = Math.max(0, ms2kmh(res.va.y));
              S.spin = -res.wa;
              S.dvTotal += ms2kmh(res.dvA);
              S.shake = Math.max(S.shake, 6);
              puff(S.x, S.y, 8, "debris");
              blip("scrape");
            }
          }
          S.wallT += dt;
          S.u = side * face;
          if (out * S.vu < 0) S.vu = 0;              // no longer crossing
          S.speed = Math.max(0, S.speed - 150 * dt);
          S.spin -= S.spin * Math.min(1, 3 * dt);
          /* A wreck that has come to rest against the wall is leaning on
             it, not grinding down it — and unlike the player's it can be
             stationary and still turning, which grindRate counts. */
          const g = grindRate();
          if (S.shake < 4 * g) S.shake = 4 * g;
          if (Math.random() < 60 * dt * g) puff(S.x, S.y, 1, "spark");
        } else S.wallT = 0;
      }
      /* Same argument at the other end of the cross-section. A wreck
         that slid a hundred metres out into a field would leave the
         picture — the camera stays on the road, and it is the road you
         are watching — and it would go through the same fence a car
         still on its wheels cannot. So the fence stops it, badly. */
      const past = offBy(S.road, S.s, S.u) - DIRT_MAX;
      if (past > 0) {
        S.u -= (S.u >= 0 ? 1 : -1) * past;
        if (S.u * S.vu * dir > 0) S.vu = -S.vu * 0.2;
        S.speed = Math.max(0, S.speed - 120 * dt);
        const g = grindRate();                   // the same argument as the wall
        if (S.shake < 4 * g) S.shake = 4 * g;
        if (Math.random() < 40 * dt * g) puff(S.x, S.y, 1, "debris");
      }
      S.s = clamp(S.s + dir * stepPx, 2, R.len(S.road) - 2);
      easeCamera(dt);
      place();

      /* Gouges, at the angle the car is actually pointing. Rate-limited
         rather than laid every step: the mark list is capped at 300, and
         two a step at 120 Hz burns the whole cap in a second and a
         quarter — so the trail behind a long slide would keep vanishing
         out of its own far end. */
      if (S.speed > 24 && Math.random() < 40 * dt) mark(S.h + S.roll);
      if (S.speed > 40 && Math.random() < 30 * dt)
        puff(S.x + rnd(-6, 6), S.y + rnd(-6, 6), 1, "debris");
      if (S.wreckT < 2.6 && Math.random() < 18 * dt) puff(S.x + rnd(-5, 5), S.y + rnd(-5, 5), 1, "smoke");
      if (S.wreckT < 0.8 && Math.random() < 12 * dt) puff(S.x + rnd(-4, 4), S.y + rnd(-4, 4), 1, "fire");

      /* The panel waits for the car, not for a stopwatch. A wreck that
         slides three hundred metres gets to slide them; the ceiling is
         only there so nothing can leave it hanging. */
      if (!S.panelShown && (S.speed < 14 || S.wreckT > 6)) {
        S.panelShown = true;
        showPanel("wreck");
      }
      rebase(World.update(S.x, S.y, dt, S.road, S.s));
      stepTraffic(dt);
      updateParts(dt);
      return;
    }

    if (S.mode !== "play") return;

    updatePlayer(dt);
    if (S.mode !== "play") return;         // updatePlayer may have ended it
    rebase(World.update(S.x, S.y, dt, S.road, S.s));
    stepTraffic(dt);
    updateParts(dt);
  }

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 40) { step(STEP); acc -= STEP; }

    /* The drawable traffic, rebuilt once per RENDERED frame rather than
       once per fixed step: it is a projection of state the step already
       settled, and doing it twice for one picture is work nobody sees. */
    /* Always the CORRIDOR, never whatever road the car is standing on:
       the traffic lives on the mainline and has to keep being drawn
       while you are down a ramp looking back at it. */
    S.traffic = (typeof Cars !== "undefined" && Cars.running())
      ? Cars.visible(World.state.root, S.fwd, 1200, dt) : null;
    Draw.setPhase(DAY_LOCK != null ? DAY_LOCK : S.distPx / 9000 + 0.06);
    const shx = S.shake > 0.05 ? rnd(-S.shake, S.shake) : 0;
    const shy = S.shake > 0.05 ? rnd(-S.shake, S.shake) : 0;
    Draw.world(S.camX + shx, S.camY + shy, S.camH, S);
    present();
    drawHud();
    audioFrame();
  }

  /* A handle on the car, for when something is wrong with the road and
     you need to know where you actually are. Off unless asked for. */
  if (location.search.includes("debug")) {
    window.OFFRAMP = {
      S, R, roads: World.roads, junctions: World.junctions,
      reset, startDriving,
      surface: () => World.surface(S.x, S.y, S.hints),
      drawHud,
      /* The render buffer, before it is scaled onto the glass. Anything
         measuring what the rasteriser actually produced has to read
         this and not the canvas: the canvas is in device pixels and has
         been through a resample, so a pixel there is not a pixel here. */
      buf: bufCvs, present,
      /* Drive the real update by hand. requestAnimationFrame is frozen
         whenever the page is not the foreground tab, so a test that sets
         the car down and waits is a test that measures nothing. */
      step: (n) => { for (let k = 0; k < (n | 0); k++) step(STEP); },
      /* Put the car in the world at whatever road coordinates you just
         set. Without it the world position is still wherever the car was
         and the surface rescue drags it back there on the first step —
         which looks exactly like a handover that did not fire. */
      place,
      underneath,
      /* The crash model, from the outside. `keys` because steering has
         to be held for whole seconds to reach a physical lateral speed
         now — a test that pokes `vu` directly is testing arithmetic
         rather than the friction circle, which is the one thing worth
         testing here. */
      keys, Impact, Skill, bodies, weigh, judge, inAuxLane, STEER,
    };
  }

  reset("title");
  if (location.search.includes("debug")) {
    /* Exercise the real player update and handoff—not a duplicate of
       the geometry formula—and leave the result where browser tests can
       read it without reaching into this module's private scope. */
    /* ── what these run against ────────────────────────────────────────
       All three of these used to walk `World.junctions`, which the
       corridor builder never pushes to and reset() clears — so every
       suite reported `checked: 0, failures: []` and went green on an
       empty set for as long as the surveyed map has existed. They walk
       the roads that are actually built now. */
    const liveRamps = () => World.roads.filter((r) => r.kind === "ramp" && r.junction);
    /* Where the car was before any of this, so the title screen it goes
       back to is the one the player chose. */
    const home = World.state.root.baseS + World.state.rootStart;
    /* Every ramp in the window, named by where it is on the CORRIDOR
       rather than by object identity — see the note on the loop test
       below: each of these re-centres the window, and a rebuild replaces
       every road object on the map. */
    const eachRamp = (fn) => {
      const targets = liveRamps().map((r) => ({ px: r.corridorPx, side: r.junction.side }));
      for (const t of targets) {
        World.setStart(t.px);
        World.reset();
        const ramp = liveRamps().find((r) => Math.abs(r.corridorPx - t.px) < 1
                                          && r.junction.side === t.side);
        if (ramp) fn(ramp);
      }
      World.setStart(home);
      World.reset();
    };

    const failures = [];
    let checked = 0;
    eachRamp((ramp) => {
      const m = ramp.merge;
      if (!m) return;
      for (let lane = 0; lane < m.lanes; lane++) {
        S.mode = "play";
        S.road = ramp;
        /* A ramp always runs the way you drive it — the handover says so
           when it hands you one. Left unset, this test inherited whichever
           direction the title screen happened to be facing, and with the
           sign on WEST it drove every ramp BACKWARDS: the car never
           reached the merge, and all twenty-eight reported a failure
           whose only symptom was being on the road it started on. */
        S.fwd = true;
        S.s = R.len(ramp) - 0.5;
        S.u = lane * R.LANE;
        S.vu = 0;
        S.speed = V_MAX;
        S.camU = 0;
        S.hints.clear();
        place();
        updatePlayer(STEP);
        const what = underneath(S.road, S.s, S.u);
        checked++;
        if (S.mode !== "play" || S.road !== m.into || what === "grass")
          failures.push({ exit: ramp.exitRef || ramp.stopName, lane, mode: S.mode, what });
      }
    });
    document.documentElement.dataset.offrampMergeTest = JSON.stringify({ checked, failures });

    /* Drive every exit in the window the whole way round — out of the
       deceleration lane, down the ramp, past the frontage and back onto
       the corridor — WITHOUT TOUCHING THE WHEEL. The merge test above
       only proves the last handover; this proves the structure holds
       together end to end, and it is the test that catches a ramp
       anchored beside the pavement rather than on it. */
    /* ── centre the window on each exit before driving it ─────────────
       The window slides whenever the car comes within six miles of an
       edge, and a slide REBUILDS EVERY ROAD OBJECT. A test that drops
       the car at an exit near either edge therefore has its world
       replaced underneath it on the very first step, and can never see
       the handover it was written to check — it just watches a stranger
       drive down a different freeway for a hundred seconds. Centring
       puts ten miles of corridor either side of the exit under test.
       That is what `eachRamp` above does, and this uses it too. */
    /* ── one ramp is shut, and the test has to be told which ──────────
       Exit 368 is signed CLOSED in orange from a mile and a half out,
       coned across a thousand pixels before the gore, and ends against
       barrels two thirds of the way down. Driving it flat out and
       arriving back on I-40 is exactly what it is built NOT to do, so
       asserting that it does would be asserting the closure is broken.

       It is excused from the loop and given a stricter pair of its own
       instead, because "this one is allowed to fail" is how a suite
       stops being worth running. A closed ramp must still MERGE — the
       map may not have a hole in it, closure or no closure — and it
       must still be reversible out of its own gore, because that is the
       only way out and if it does not work the exit is a trap with no
       floor rather than a closure. Both are checked below. */
    const loopFailures = [];
    let loopsChecked = 0;
    eachRamp((ramp) => {
      if (!ramp.merge || ramp.closure) return;
      const j = ramp.junction;
      const par = j.from;
      S.mode = "play"; S.road = par;
      S.fwd = j.side > 0;
      S.s = j.s - (S.fwd ? 420 : -420);
      S.u = j.startU; S.vu = 0;
      S.speed = V_MAX; S.camU = 0; S.onRamp = false; S.hints.clear();
      S.why = null;
      place();
      let onRamp = false, back = false, slid = false;
      for (let k = 0; k < 12000 && S.mode === "play"; k++) {
        S.speed = Math.max(S.speed, 150);
        step(STEP);
        if (World.roads[0] !== par) { slid = true; break; }
        if (S.road === ramp) onRamp = true;
        else if (onRamp && S.road === par) { back = true; break; }
      }
      loopsChecked++;
      if (!back) loopFailures.push({ exit: ramp.exitRef || ramp.stopName, side: j.side,
                                     onRamp, slid, mode: S.mode, why: S.why });
    });
    document.documentElement.dataset.offrampLoopTest =
      JSON.stringify({ checked: loopsChecked, failures: loopFailures });

    /* ── and what a closed ramp has to do instead ─────────────────────
       Take it, hit the barrels, and reverse out onto the corridor you
       came from. That is the whole contract of a closure: it stops you,
       it does not swallow you. Driven at the same speed the loop test
       uses, so "the warnings were adequate" is not an assumption. */
    const shutFailures = [];
    let shutChecked = 0;
    eachRamp((ramp) => {
      if (!ramp.closure) return;
      shutChecked++;
      const j = ramp.junction, par = j.from;
      if (!ramp.merge) { shutFailures.push({ exit: ramp.exitRef, why: "no way back at all" }); return; }
      S.mode = "play"; S.road = par;
      S.fwd = j.side > 0;
      S.s = j.s - (S.fwd ? 420 : -420);
      S.u = j.startU; S.vu = 0;
      S.speed = V_MAX; S.camU = 0; S.onRamp = false; S.hints.clear();
      S.why = null;
      place();
      let onRamp = false, stopped = false;
      for (let k = 0; k < 12000 && S.mode === "play"; k++) {
        S.speed = Math.max(S.speed, 150);
        step(STEP);
        if (World.roads[0] !== par) break;
        if (S.road === ramp) onRamp = true;
        if (onRamp && S.road === ramp && S.s >= ramp.closure.works - 2) { stopped = true; break; }
      }
      if (!onRamp) { shutFailures.push({ exit: ramp.exitRef, why: "could not take it" }); return; }
      if (!stopped && S.mode === "play")
        shutFailures.push({ exit: ramp.exitRef, why: "drove straight through the works" });
      /* Now back out of it, from wherever the barrels left the car. */
      S.mode = "play"; S.road = ramp; S.fwd = true;
      S.s = Math.min(S.s, ramp.closure.works - 1); S.u = 0; S.vu = 0;
      S.spin = 0; S.roll = 0; S.speed = 0; S.camU = 0; S.hints.clear();
      place();
      let out = false;
      for (let k = 0; k < 24000 && S.mode === "play"; k++) {
        S.speed = Math.min(S.speed, -20);        // hold it in reverse
        step(STEP);
        if (World.roads[0] !== par) break;
        if (S.road === par) { out = true; break; }
      }
      if (!out) shutFailures.push({ exit: ramp.exitRef, why: "could not reverse out",
                                    mode: S.mode, on: S.road === ramp ? "ramp" : "?",
                                    s: Math.round(S.s) });
    });
    document.documentElement.dataset.offrampShutTest =
      JSON.stringify({ checked: shutChecked, failures: shutFailures });

    /* The clearance invariant, asserted rather than eyeballed. World has
       been able to answer this since the fictional map and nothing ever
       asked it, so two roads could share tarmac anywhere off a join and
       the only symptom was a wreck the player could not explain.

       A few pixels of overlap where a ramp is still parting from its
       parent is the geometry doing what it is built to do, so the line
       is drawn at a paved shoulder: less than that and the two roads are
       touching at the edges, more and their travel lanes are in each
       other. */
    /* Two questions now, because one of them could not be asked where it
       mattered most. `worst` is the tightest two roads get out on the
       open road. `crossed` is every ramp that is on the wrong side of
       the median at grade — which the gap test is blind to, since it has
       to stand down inside a junction where a ramp and its parent share
       pavement by construction. */
    const clear = World.clearance(true);
    document.documentElement.dataset.offrampClearTest = JSON.stringify({
      checked: World.roads.length, worst: clear.worst, where: clear.where,
      failures: (clear.worst != null && clear.worst < -R.SH_OUT ? [clear.where] : [])
        .concat(clear.crossed || []),
    });

    /* No exit leads off the corridor. Every ramp you can steer onto has
       to put you back on I-40 — a ramp that ends anywhere else is a hole
       in the map, and the player finds holes. */
    const oneWay = World.roads.filter((r) => r.kind === "ramp" && !r.merge);
    /* Scenery must be unreachable. Stand on the centreline of every
       cross road in the window and ask the world what is under the
       wheels: it has to answer grass, because a cross road leads off
       the corridor and taking it is the one thing this map does not
       allow. This is the check that keeps `scenery` honest — it is a
       flag, and a flag is only worth what tests it. */
    const reachable = [];
    for (const x of World.roads.filter((r) => r.scenery)) {
      for (let s = 40; s < R.len(x) - 40; s += 160) {
        const p = R.at(x, s, 0);
        const w = World.surface(p.x, p.y, null, 0);
        if (w.onRoad && w.road === x) { reachable.push(x.crossName || "?"); break; }
      }
    }
    document.documentElement.dataset.offrampExitTest = JSON.stringify({
      checked: World.roads.filter((r) => r.kind === "ramp").length,
      scenery: World.roads.filter((r) => r.scenery).length,
      dropped: (World.state.oneWay || []).length,
      failures: oneWay.map((r) => r.exitRef || r.stopName || "?").concat(reachable),
    });
    reset("title");
  }
  drawHud();
  requestAnimationFrame(frameLoop);
})();
