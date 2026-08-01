/* ══════════════════════════════════════════════════════════════════════
   exhibit.js — the clocks, the slider, and the trip out and back.

   The shape of the thing:

     out       coasting away. The slider is live and Earth's clock pulls ahead.
     stopping  you pressed return. The ship slows to a full stop.
     turning   the view swings 180°. Earth is ahead now.
     home      flying back. The distance you built up comes off again.
     arrived   both clocks in the same place. The gap is now a fact.

   You cannot change direction while moving, which is the best physics
   decision available here and also the simplest to build: with a stop
   between the legs, each leg is plain constant velocity and the visitor
   changes reference frames by pressing a button and watching it happen.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const P = window.HSAT_PHYSICS;
  const COL = window.HSAT_COLOUR;
  const G = window.HSAT_GLOSSARY;

  const $ = (id) => document.getElementById(id);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const YEAR = 365.25 * 86400;

  /* The sessionStorage key, up here rather than beside the code that uses it,
     and it has to stay up here.

     restore() is called from the setup run at the top of this IIFE, which is
     above the persistence section. A `const` declared down there is in its
     temporal dead zone at that point, so reading it throws — and the call site
     reads it inside a `try { … } catch {}` that exists to tolerate private mode
     and file:// origins, which swallowed the ReferenceError without a sound.
     The symptom was one-way persistence: every save wrote (save() runs later,
     once the declaration has been reached) and no load ever read. */
  const KEY = "hsat-trip";

  /* Direction of travel: the galactic centre (RA 17h45m40s, Dec −28°56′10″).
     Chosen because the Milky Way is a *shape*, and shapes show distortion far
     better than scattered points do — the band hinges and narrows long before
     anyone notices an individual star move. */
  function fromRaDec(raDeg, decDeg) {
    const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
    const cd = Math.cos(dec);
    return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
  }
  const OUTBOUND = fromRaDec(266.41684, -28.99361);

  /* What has happened at home, as Earth's clock crosses each threshold.
     These should land a little sad. The emotional core of the exhibit is
     that speed buys you the future at the cost of everyone in your past,
     and an exclamation point would undercut it. */
  const CALLOUTS = [
    [1 * YEAR, "One year", "A full year of seasons has passed at home."],
    [4 * YEAR, "Four years", "A child born the day you left has started school."],
    [18 * YEAR, "Eighteen years", "A child born the day you left is now an adult."],
    [22 * YEAR, "Twenty-two years", "A child born when you left has graduated college."],
    [30 * YEAR, "Thirty years", "Voyager 1 has travelled billions of miles further into interstellar space."],
    [50 * YEAR, "Fifty years", "The cities you knew have been rebuilt."],
    [80 * YEAR, "Eighty years", "Everyone you said goodbye to is likely gone."],
    [100 * YEAR, "A century", "Entire generations have lived and died."],
    [1000 * YEAR, "A thousand years", "Your language has drifted. You would struggle to be understood."],
    [10000 * YEAR, "Ten thousand years", "Written history is shorter than the time you have been away."],
  ];

  /* ── checkpoints ─────────────────────────────────────────────────────
     Distances out from Earth, in light-seconds, and what each one is.

     The comparison is deliberately "further from Earth than X is from the
     Sun" rather than "you passed Jupiter". The ship is flying at the galactic
     centre, not around the ecliptic, so it never goes near a planet — and an
     exhibit that spends its whole length refusing to fudge anything cannot
     start staging flybys at the end.

     One AU is 499.005 light-seconds. Orbital radii are semi-major axes. */
  const AU = 499.005;
  const MARKS = [
    { at: 1.282, k: "Checkpoint", t: "Past the Moon",
      n: "239,000 miles. Three days each way for Apollo; you did it just now." },
    { at: 0.387 * AU, k: "Checkpoint", t: "Mercury's orbit",
      n: "You are further from Earth than Mercury ever gets from the Sun." },
    { at: 1 * AU, k: "Checkpoint", t: "One astronomical unit",
      n: "As far from Earth as Earth is from the Sun. Light takes eight minutes to cross it." },
    { at: 5.203 * AU, k: "Checkpoint", t: "Jupiter's orbit",
      n: "Further out than Jupiter. Sunlight here is a twenty-seventh of what falls on Earth." },
    { at: 9.537 * AU, k: "Checkpoint", t: "Saturn's orbit",
      n: "Cassini took just under seven years to cover this." },
    { at: 30.07 * AU, k: "Checkpoint", t: "Neptune's orbit",
      n: "The edge of the planets. From here the Sun is the brightest star and nothing more." },
    { at: 120 * AU, k: "Checkpoint", t: "Through the heliopause",
      n: "Out of the Sun's wind and into interstellar space. Voyager 1 crossed this line in 2012." },
    { at: 170 * AU, k: "Checkpoint", t: "Past Voyager 1",
      n: "The furthest thing we have ever thrown. Forty-nine years to get this far." },
    { at: 1000 * AU, k: "Checkpoint", t: "A thousand astronomical units",
      n: "Nothing we have built has ever been here. Voyager is a sixth of the way out." },
  ];

  /* The one checkpoint that is about speed rather than distance. Alpha
     Centauri is 4.2465 light-years away; at the top of the rail the trip
     costs you a couple of days and costs Earth four years. */
  const ALPHA_LY = 4.2465;

  /* The rail's integer resolution. Ten thousand steps rather than a
     thousand: at a typical width that is more than one step per pixel, so
     the thumb tracks the pointer exactly instead of walking in visible
     quantised jumps at the fast end of the ladder. */
  const RAIL_MAX = 10000;
  function setRail(sliderPos) {
    const el = $("speed");
    el.value = Math.round(sliderPos * RAIL_MAX);
    paintRailFill();
  }
  /* The white part of the track is drawn by CSS from --p, and CSS cannot
     read an input's value. Anything that moves the thumb has to say so. */
  function paintRailFill() {
    const el = $("speed");
    el.style.setProperty("--p", Number(el.value) / RAIL_MAX);
  }

  /* ── state ───────────────────────────────────────────────────────── */
  const S = {
    phase: "out",
    beta: 0,
    targetBeta: 0,        // where the slider is pointing
    rampFrom: 0,
    rampTo: 0,
    rampStart: 0,
    rampMs: 0,
    tau: 0,               // your elapsed time, seconds — real, not simulated
    earth: 0,             // Earth's elapsed coordinate time, ∫γ dτ
    distLs: 0,            // how far out you are, in light-seconds
    altKm: 0,             // how far up you are — 0 is the forest floor
    turnStart: 0,
    landStart: 0,
    landFromKm: 0,        // the height the descent started from
    skipTurn: false,      // came down without ever turning around
    outboundTau: 0,
    outboundEarth: 0,
    returnBeta: 0,
    skipped: false,
    startWall: Date.now(),
    callout: -1,
    seen: [],             // checkpoints already shown, by key — one per trip
  };

  let sky, inset, insetSky, photoSky, photoInsetSky, ground;
  let forward = OUTBOUND.slice();
  /* Held, never toggled, and never saved. Looking over your shoulder is a
     thing you do for a moment — the exhibit should not be able to strand you
     facing backwards, and coming back to the tab should not either. */
  let lookBack = false;
  let dirty = true;
  let lastFrame = performance.now();
  let lastAnnounce = 0;
  let shake = 0;            // current rumble amplitude, px
  let shakeWritten = false; // whether an offset is currently on the frame
  let landingHeat = 0;      // 0–1, how hard the air is pushing back

  /* ── boot ────────────────────────────────────────────────────────── */
  const canvas = $("view");
  sky = new window.HSAT_Sky(canvas);
  sky.loadCatalogue(window.HSAT_STARS, window.HSAT_STARS_STRIDE);
  sky.showDiffuse = false;

  inset = $("inset");
  insetSky = new window.HSAT_Sky($("inset-canvas"));
  insetSky.stars = sky.stars;
  insetSky.count = sky.count;
  insetSky.showDiffuse = false;

  const photoReady = () => {
    if (photoSky && photoSky.ready) {
      $("rest-sky").hidden = true;
      dirty = true;
    }
  };

  /* No WebGL, or the plates would not load. Leaving the still photograph on
     screen would be the worst of both worlds — a sky that never answers the
     slider — so hand the Milky Way back to the modelled one in galaxy.js,
     which the catalogue renderer can draw on its own. It is softer and it is
     a model rather than a photograph, and it responds to every bit of the
     physics. */
  let photoFallbackDone = false;
  const photoFailed = () => {
    if (photoFallbackDone) return;
    photoFallbackDone = true;
    sky.showDiffuse = insetSky.showDiffuse = true;
    $("rest-sky").hidden = true;
    $("photo-view").hidden = true;
    $("photo-inset-canvas").hidden = true;
    dirty = true;
  };

  photoSky = new window.HSAT_PhotoSky(
    $("photo-view"),
    "assets/milky-way-rest.jpg",
    "assets/milky-way-panorama.jpg",
    "assets/milky-way-return.jpg",
    OUTBOUND,
    photoReady,
    photoFailed
  );
  photoInsetSky = new window.HSAT_PhotoSky(
    $("photo-inset-canvas"),
    "assets/milky-way-rest.jpg",
    "assets/milky-way-panorama.jpg",
    "assets/milky-way-return.jpg",
    OUTBOUND,
    photoReady
  );

  // The opening view is what a fully dark-adapted observer sees. Beginning
  // under-exposed and slowly revealing the Galaxy made the first, most
  // important frame physically unrepresentative and visually dead.
  sky.exposureScale = insetSky.exposureScale = 1;

  ground = new window.HSAT_Ground(document.querySelector(".stage-inner"));

  // Earth's photograph, if there is one. Without it the target falls back to
  // the shaded disc the stylesheet draws, which is still a great deal more
  // than the plain dot it used to be.
  (() => {
    const img = $("earth-photo");
    const drop = () => img.setAttribute("data-failed", "");
    img.addEventListener("error", drop);
    if (img.complete && img.naturalWidth === 0) drop();
  })();

  restore();
  buildDetents();
  wire();
  setWelcome(true);
  G.install(document);
  G.setValueSource(liveValues);
  resize();
  addEventListener("resize", () => { resize(); dirty = true; });
  requestAnimationFrame(loop);

  /* ── the loop ────────────────────────────────────────────────────── */
  function loop(now) {
    const dt = Math.max(0, (now - lastFrame) / 1000);
    lastFrame = now;

    stepRamp(now);
    stepClocks(dt);
    stepTurn(now);
    stepAltitude(dt);

    if (dirty) { draw(); dirty = false; }
    paintReadouts();
    announce(now);
    requestAnimationFrame(loop);
  }

  /* Accelerations are drawn as short ramps rather than as instant jumps.
     This costs nothing in honesty: Earth's elapsed time is ∫γ dτ, which is
     exact for any speed history at all, so the integral below is right
     whether β is holding still or sweeping. */
  function stepRamp(now) {
    if (!S.rampMs) return;
    const p = Math.min(1, (now - S.rampStart) / S.rampMs);
    const e = p * p * (3 - 2 * p);
    setBeta(S.rampFrom + (S.rampTo - S.rampFrom) * e);
    // The rail represents the ship's actual current speed. Keep its thumb
    // attached to beta while automatic slowing and acceleration are drawn;
    // previously only the number moved and the bar looked frozen.
    setRail(P.betaToSlider(S.beta));
    if (p >= 1) {
      S.rampMs = 0;
      if (S.phase === "stopping") beginTurn(now);
    }
  }

  function stepClocks(dt) {
    if (S.phase === "arrived" || dt <= 0) return;
    S.tau += dt;
    const g = P.gamma(S.beta);
    const dEarth = g * dt;
    S.earth += dEarth;

    // Distance in the Earth frame: dx = v dt_Earth, and in light-seconds
    // that is just β times the Earth-frame interval.
    const dDist = S.beta * dEarth;
    if (S.phase === "home") {
      S.distLs -= dDist;
      if (S.distLs <= 0) { S.distLs = 0; arrive(); }
      else updateHomeView();
    } else if (S.phase === "out" || S.phase === "stopping") {
      S.distLs += dDist;
    }
    checkCallouts();
    checkMarks();
    save();
  }

  /* ── the climb, and the way back down ──────────────────────────────
     You start in a forest at night and you have to fly out of the air before
     the sky is the sky. The clocks and the star field behave identically at
     every altitude; all height changes is how much air is in the way. */
  const TOP_KM = window.HSAT_Ground.TOP_KM;
  const KM_PER_LIGHT_SECOND = 299792.458;

  /* Altitude is not its own invented quantity. You are flying straight up,
     so how high you are *is* how far you have gone — the atmosphere is
     simply the first hundred kilometres of the trip.

     Deriving it rather than inventing a climb rate fixes three things at
     once. A walking pace genuinely never leaves the ground, because 1.4 m/s
     really does take twenty hours to reach space. Orbital speed clears the
     air in about thirteen seconds, which is what orbital speed means. And
     turning round while still inside the atmosphere brings you back *down*,
     because the distance you are unwinding is the altitude you climbed.

     The one concession: the transition is rate-limited so it takes a few
     seconds. At 0.9 c the real crossing of the atmosphere lasts about a
     third of a millisecond, and something you cannot see is not worth
     rendering. Everything else here is the honest number. */
  const ALT_RATE_LIMIT = TOP_KM / 3.5;      // km per second, seen not real

  /* Coming down is timed rather than rate-limited, so it takes the same few
     seconds whether you are dropping out of the airglow or out of the tops of
     the trees. The climb can afford to be a rate — you might genuinely be
     walking — but a descent that is over in a tenth of a second is not a
     landing, and nobody would ever read the warning sitting over it. */
  const LAND_MS = 3400;

  function stepAltitude(dt) {
    if (dt <= 0) return;

    if (S.phase === "landing") {
      stepDescent();
    } else {
      const target = Math.min(TOP_KM, S.distLs * KM_PER_LIGHT_SECOND);
      if (S.altKm !== target) {
        const step = ALT_RATE_LIMIT * dt;
        S.altKm = target > S.altKm
          ? Math.min(target, S.altKm + step)
          : Math.max(target, S.altKm - step);
      }
    }

    /* Rumble: air on the hull, and it needs both halves of that.

       No air, no shake — so it fades out across the climb and is exactly
       zero once you are above the atmosphere. And no motion, no shake:
       sitting in the forest with the slider at rest, nothing is hitting the
       hull at all, so the frame is perfectly still until you decide to go. */
    const air = Math.pow(Math.max(0, 1 - S.altKm / window.HSAT_Ground.SPACE_KM), 1.6);

    /* And air on the hull is ½ρv², not a switch. Fifteen metres up at five
       miles an hour there is nothing hitting you hard enough to feel, and the
       frame shaking anyway was the exhibit insisting on drama it had not
       earned.

       It saturates, though, and that matters as much as the ramp. Past a few
       hundred miles an hour the buffet is simply pinned at "loud", so the
       climb does not go on getting more violent the faster you set the
       slider. Going fast is supposed to feel like nothing; it is the air, not
       the speed, that you are allowed to feel. */
    const speed = S.phase === "landing"
      ? S.landFromKm * 1000 / (LAND_MS / 1000)     // how fast you are dropping
      : S.beta * P.C;
    const q = Math.min(1, Math.pow(speed / 120, 2));
    const push = S.phase === "landing" ? q * 1.3 : q;
    /* 1.2 px, not the 3.4 it was. The amplitude came down when the rumble
       stopped being applied to the whole stage: at 3.4 px it had to be big
       enough to read through a frame that was moving as one piece, and now
       that it is only the haze and the canopy — soft, low-contrast, edge-of-
       frame things — a third of that is plenty to feel and small enough that
       nothing crosses a pixel boundary hard enough to sparkle. */
    const want = reduceMotion ? 0 : air * push * 1.2;
    shake += (want - shake) * Math.min(1, dt * 9);

    /* Re-entry glow, scaled by how far up the fall started. Coming down from
       the airglow you arrive with a hundred kilometres of speed to shed and
       the hull lights up; stepping down from three kilometres you do not, and
       wrapping a fireball round a short hop out of the treetops made the
       gentlest version of the trip look like the most violent one. */
    const reentry = Math.min(1, S.landFromKm / window.HSAT_Ground.SPACE_KM);
    landingHeat = S.phase === "landing"
      ? Math.max(0, Math.min(1, (1 - S.altKm / 70) * 1.15)) * 0.9 * reentry
      : Math.max(0, landingHeat - dt * 1.6);

    /* Still written to .stage-inner, and still read by .sky-ground, which is
       the only element with a transform on it. Custom properties inherit, so
       the writer does not need to know which layer is currently listening. */
    const stage = document.querySelector(".stage-inner");
    if (shake > 0.02) {
      stage.style.setProperty("--shake-x", ((Math.random() - 0.5) * shake).toFixed(2) + "px");
      stage.style.setProperty("--shake-y", ((Math.random() - 0.5) * shake).toFixed(2) + "px");
      shakeWritten = true;
    } else if (shakeWritten) {
      // Park it back at zero exactly once. Skipping this when the amplitude
      // was already zero left the last random offset frozen on the frame,
      // so a reset could land the whole view a pixel off centre and stay
      // there.
      stage.style.setProperty("--shake-x", "0px");
      stage.style.setProperty("--shake-y", "0px");
      shakeWritten = false;
    }

    ground.paint(S.altKm, landingHeat);
    paintAltimeter();
    paintLandingWarning();
  }

  /* ── the way down ──────────────────────────────────────────────────
     One timeline drives the whole descent: the altitude falls to nothing on
     it, and — if there is one to undo — the turn comes off on it too, so the
     ship touches down facing exactly the way it was facing at the start and
     the two ends of the trip are the same frame. That identity is the whole
     point of the bookend: a changed sky in a changed view is just another
     picture, but a changed sky in the *same* view is what the trip cost you. */
  function stepDescent() {
    const p = Math.min(1, (performance.now() - S.landStart) / (reduceMotion ? 1 : LAND_MS));
    const e = p * p * (3 - 2 * p);
    S.altKm = S.landFromKm * (1 - e);

    if (!S.skipTurn) {
      const a = Math.PI * (1 - e);
      const side = perpendicular(OUTBOUND);
      forward = [
        OUTBOUND[0] * Math.cos(a) + side[0] * Math.sin(a),
        OUTBOUND[1] * Math.cos(a) + side[1] * Math.sin(a),
        OUTBOUND[2] * Math.cos(a) + side[2] * Math.sin(a),
      ];
      dirty = true;
    }

    if (p >= 1) settle();
  }

  /* Where you are in the air, in the terms the climb is actually about:
     not a number of kilometres so much as what has stopped being in the way. */
  const RUNGS = [
    [0, "a forest at night — haze, town glow, air moving every star"],
    [3, "above the worst of the haze"],
    [12, "above the weather"],
    [30, "the stars have stopped moving"],
    [100, "through the airglow — the background is finally black"],
  ];

  function paintAltimeter() {
    const el = $("altimeter");
    const done = S.altKm >= window.HSAT_Ground.SPACE_KM;
    if (done && S.phase !== "landing") { el.hidden = true; return; }
    el.hidden = false;
    let note = RUNGS[0][1];
    for (const r of RUNGS) if (S.altKm >= r[0]) note = r[1];
    const landing = S.phase === "landing";
    // Metres below the first kilometre. The trees are seventy feet tall and
    // they are gone by a hundred and seventy metres, so rounding that whole
    // stretch to "on the ground" hid the only part of the climb where the
    // number and the picture have anything to say to each other.
    const value = S.altKm < 0.003 ? "on the ground"
      : S.altKm < 1 ? Math.round(S.altKm * 1000) + " m up"
      : S.altKm.toFixed(0) + " km up";
    const label = landing ? (S.skipTurn ? "descending" : "re-entry") : "altitude";
    el.innerHTML =
      '<span class="k">' + label + "</span>" +
      "<b>" + value + "</b>" +
      (landing ? "" : '<span class="n">' + note + "</span>");
  }

  /* The one thing on the stage that ever shouts. It starts the moment the
     descent does — both kinds of descent — and it goes when you are down. */
  function paintLandingWarning() {
    const el = $("landing-warn");
    const on = S.phase === "landing";
    if (!on) { el.hidden = true; return; }
    el.hidden = false;
    $("landing-warn-note").textContent = S.skipTurn
      ? "you never left the air — coming straight back down"
      : "re-entry — through the atmosphere and down";
  }

  function stepTurn(now) {
    if (S.phase !== "turning") return;
    const dur = reduceMotion ? 1 : 2600;
    const p = Math.min(1, (now - S.turnStart) / dur);
    const e = p * p * (3 - 2 * p);
    // Swing horizontally through 180° rather than cutting. The interpolation
    // is a rotation, not a cross-fade — the sky is a real place.
    const a = Math.PI * e;
    const side = perpendicular(OUTBOUND);
    forward = [
      OUTBOUND[0] * Math.cos(a) + side[0] * Math.sin(a),
      OUTBOUND[1] * Math.cos(a) + side[1] * Math.sin(a),
      OUTBOUND[2] * Math.cos(a) + side[2] * Math.sin(a),
    ];
    dirty = true;
    if (p >= 1) {
      forward = [-OUTBOUND[0], -OUTBOUND[1], -OUTBOUND[2]];
      S.outboundTau = S.tau;
      S.outboundEarth = S.earth;
      S.targetBeta = S.returnBeta;
      setRail(P.betaToSlider(S.targetBeta));
      markDetent();
      updateHomeView();
      // The turnaround is the start of the return leg, not a second parked
      // screen. Resume at the outbound speed so distance immediately falls;
      // the live slider can still change that speed at any time inbound.
      //
      // Paint the new phase *before* trying to fly: beginHome() bails out
      // when there is no return speed to resume — which is exactly what
      // happens if you were at rest when you pressed return — and without
      // this the controls stayed frozen in the turning state forever, with
      // the slider disabled and no way out.
      S.phase = "choose";
      paintPhase();
      beginHome();
    }
  }

  function perpendicular(f) {
    const up = Math.abs(f[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    let x = up[1] * f[2] - up[2] * f[1];
    let y = up[2] * f[0] - up[0] * f[2];
    let z = up[0] * f[1] - up[1] * f[0];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }

  /* ── drawing ─────────────────────────────────────────────────────── */

  /* Where the camera points. The ship keeps going the way it was going —
     that is the whole point of the rear view, and why this is a separate
     vector from `forward` rather than a negated one. */
  function viewDir() {
    return lookBack ? [-forward[0], -forward[1], -forward[2]] : forward;
  }

  function draw() {
    const view = viewDir();
    photoSky.render(S.beta, forward, 1, view);
    sky.render(S.beta, forward, view);

    // The inset appears when the payoff stops being visible at true scale.
    // At the top of the ladder the entire sky is 0.16° across — about two
    // pixels — so without it the exhibit's best moment cannot be seen at all.
    // Not while you are looking astern: the inset exists to magnify the
    // forward cone, and there is nothing behind you that is too small to see.
    // Quite the opposite — the rear view is the emptiest the sky ever gets.
    const coneDeg = P.forwardHemisphereRadius(S.beta) * 360 / Math.PI;
    /* Hysteresis on the threshold: 20° to bring the panel in, 21° to send it
       away again. A single figure meant the rail had one position — β just
       either side of 0.98481 — where a jostled thumb could switch a 230 px
       panel in and out of the right rail frame after frame. The band is wider
       than any drag can chatter across, and the panel is only ever entering
       or leaving once. */
    const insetOn = !inset.hidden;
    if (S.beta > 0 && !lookBack && coneDeg < (insetOn ? 21 : 20)) {
      // Frame the cone at roughly a fifth of the inset's width. Half was too
      // tight: the glare around a sky's worth of stacked starlight bled the
      // disc out to the rim and the panel read as a plain white circle. The
      // blackness around it is the whole point — at the top of the ladder,
      // everything there is to see is inside that disc, and nothing is left
      // anywhere else.
      const zoom = Math.min(3000, Math.max(2, 11 / coneDeg));
      insetSky.zoom = zoom;
      insetSky.extras = sky.extras;
      photoInsetSky.render(S.beta, forward, zoom, view);
      insetSky.render(S.beta, forward, view);
      $("inset-tag").textContent = "×" + Math.round(zoom).toLocaleString() +
        "  ·  " + (coneDeg < 1 ? coneDeg.toFixed(2) : coneDeg.toFixed(1)) + "° of sky";
      inset.hidden = false;
      placeReticle(zoom);
    } else {
      inset.hidden = true;
      $("reticle").hidden = true;
    }
  }

  function placeReticle(zoom) {
    const box = canvas.getBoundingClientRect();
    const stage = canvas.parentElement.getBoundingClientRect();
    const halfV = Math.atan(Math.tan(49 * Math.PI / 360) / zoom);
    const pxPerTan = (box.height / 2) / Math.tan(49 * Math.PI / 360);
    // Never smaller than a box you can actually see. At the top of the ladder
    // the true reticle is about a pixel across, and an invisible reticle
    // would make the inset look like it came from nowhere.
    const half = Math.max(9, pxPerTan * Math.tan(halfV));
    const r = $("reticle");
    r.hidden = false;
    r.style.width = (half * 2) + "px";
    r.style.height = (half * 2) + "px";
    r.style.left = (box.left - stage.left + box.width / 2 - half) + "px";
    r.style.top = (box.top - stage.top + box.height / 2 - half) + "px";
  }

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    canvas.style.height = box.height + "px";
    sky.resize(box.width, box.height);
    photoSky.resize(box.width, box.height);
    const ib = $("inset-canvas").getBoundingClientRect();
    insetSky.resize(Math.max(80, ib.width), Math.max(80, ib.width));
    photoInsetSky.resize(Math.max(80, ib.width), Math.max(80, ib.width));
  }

  /* One line, always.

     "44 min 43.2 sec" becomes "2 hours 44.2 sec" becomes "706 years 39 days",
     and the string is long enough that the box wrapped it onto a second line
     for some of those and not others. Every rollover therefore grew and shrank
     the whole cluster by a row — which from any distance reads as flashing,
     and it is the number the exhibit is *for*.

     So: never wrap, and shrink the type instead when a string turns out to be
     too long for the box it is in. The refit only runs when the string changes
     length, because the face is monospaced with tabular figures — same number
     of characters is the same number of pixels, exactly — and the seconds digit
     changes ten times a second, which is not something to be measuring in.

     The floor is the house minimum of 11px. Below it the text would be
     unreadable, which is worse than the clip. */
  function setFitted(el, text, floor) {
    const key = text.length + ":" + el.clientWidth;
    if (el.dataset.fit === key) { el.textContent = text; return; }
    el.dataset.fit = key;
    el.textContent = text;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (size > floor && el.scrollWidth > el.clientWidth + 1) {
      size = Math.max(floor, size - 1);
      el.style.fontSize = size + "px";
    }
  }

  /* "144.65 million miles from Earth" does not fit a phone's cluster even at
     the 11px floor — it wants about twelve pixels more than there are. Rather
     than clip it mid-word, which reads as broken software, the suffix comes
     off and the number keeps its full size. The label two lines up already
     says what it is measured from.

     Decided once per (width, length) pair rather than per frame: the trial fit
     costs a layout read, and the distance's last digit changes ten times a
     second. */
  let distLong = true;
  let distKey = "";
  function paintDistance() {
    const el = $("distance-out");
    const miles = P.formatMiles(S.distLs);
    const key = el.clientWidth + ":" + miles.length;
    if (key !== distKey) {
      distKey = key;
      setFitted(el, miles + " from Earth", 11);
      distLong = el.scrollWidth <= el.clientWidth + 1;
    }
    setFitted(el, distLong ? miles + " from Earth" : miles, 11);
  }

  /* ── readouts ────────────────────────────────────────────────────── */
  function paintReadouts() {
    // The traveler's clock is the device clock. Never modified, never
    // lagged, never animated specially. If it stutters, the premise dies.
    const nowDate = new Date();
    $("tau-clock").textContent = nowDate.toLocaleTimeString();
    $("tau-elapsed").textContent = "elapsed " + P.formatDuration(S.tau);

    /* Earth's clock is your clock plus the gap, and it is defined that way
       rather than from a stored start time so the two faces can never drift
       apart from each other or from the difference readout underneath them.
       Anchoring it to a start timestamp meant that any hitch in the frame
       loop — a backgrounded tab, a reset landing on a stale frame — left the
       two clocks showing times that disagreed with their own elapsed counts. */
    const earthDate = new Date(nowDate.getTime() + (S.earth - S.tau) * 1000);
    const ec = $("earth-clock");
    ec.textContent = S.earth > 400 * YEAR
      ? "—" : earthDate.toLocaleTimeString();
    // Earth's clock is never blurred. Letting it smear was meant to show that
    // it had run past reading — but an unreadable clock just looks like
    // broken software, and the number underneath is doing that job already.
    $("earth-elapsed").textContent = "elapsed " + P.formatDuration(S.earth);

    setFitted($("gap"), P.formatDuration(S.earth - S.tau), 12);
    paintDistance();
    $("beta-out").textContent = P.formatBeta(S.beta);
    paintEarthTarget();
    paintEquations();

    if (S.phase === "choose" || S.phase === "home") paintReturnPreview();
  }

  function paintPhase() {
    const primary = $("act-primary");
    const secondary = $("act-secondary");
    const status = $("journey-status");
    const preview = $("journey-preview");
    const slider = $("speed");
    const gapHint = $("gap-hint");
    preview.hidden = true;
    secondary.hidden = true;
    slider.disabled = false;
    primary.disabled = false;

    switch (S.phase) {
      case "out":
        primary.textContent = "Return to Earth";
        status.textContent = "";
        gapHint.textContent = "";
        break;
      case "stopping":
        primary.disabled = true; slider.disabled = true;
        primary.textContent = "Slowing down";
        status.textContent = "Slowing to rest before the turn.";
        gapHint.textContent = "the gap stops growing, but it does not reset";
        break;
      case "turning":
        primary.disabled = true; slider.disabled = true;
        primary.textContent = "Turning";
        status.textContent = "Turning at rest. The clocks are ticking together again.";
        break;
      case "choose":
        primary.textContent = "Fly home";
        slider.disabled = false;
        status.textContent = S.distLs > 0.001
          ? P.formatDistance(S.distLs) + " out. Choose a return speed."
          : "You never left. Go again and set a speed first.";
        preview.hidden = false;
        gapHint.textContent = "held";
        break;
      case "home":
        primary.disabled = true;
        primary.textContent = "On the way home";
        secondary.hidden = false;
        preview.hidden = false;
        // Blanked, not deleted: paintPhase does not clear the status line
        // between phases, so dropping the assignment would leave the previous
        // phase's message stranded here. Empty, .dock .status collapses to
        // nothing — and the button underneath already says "On the way home".
        status.textContent = "";
        gapHint.textContent = "";
        break;
      case "landing":
        primary.disabled = true; slider.disabled = true;
        primary.textContent = "Coming down";
        status.textContent = S.skipTurn
          ? "You never left the air. Coming straight back down onto the hillside."
          : "Through the atmosphere. Hold on — this is the loud part.";
        gapHint.textContent = "held";
        break;
      case "arrived":
        primary.textContent = "Go again";
        primary.disabled = false;
        slider.disabled = true;
        secondary.hidden = true;
        status.textContent = arrivalSentence();
        gapHint.textContent = "and this one is a fact — both clocks are in the same place";
        break;
    }
    paintProse();
  }

  function arrivalSentence() {
    const gap = S.earth - S.tau;
    let s = "Home. You aged " + P.formatDuration(S.tau) +
      "; Earth aged " + P.formatDuration(S.earth) + ".";
    // A trip that never left the air ends with the two clocks together, and
    // that is worth saying out loud rather than leaving as two numbers that
    // happen to match — otherwise the ending reads as a bug.
    if (gap < 1) s += " No gap worth the name: you have to go far, and fast, before the clocks disagree.";
    if (S.skipped) s += " Part of your own elapsed time was fast-forwarded rather than lived.";
    return s;
  }

  function paintReturnPreview() {
    // Estimate against the speed the ship has been *told* to hold, not the
    // one it happens to be passing through. Reading the live value during the
    // acceleration ramp produced nonsense — "about 5 min 31 sec of your time
    // left" on a leg that finished in seven seconds — because for a moment
    // beta was still down near 0.04 c.
    const b = S.rampMs ? S.rampTo : (S.phase === "home" ? S.beta : S.targetBeta);
    const el = $("journey-preview");
    if (!(b > 0)) { el.innerHTML = "Pick a speed. At rest you never get home."; return; }
    const g = P.gamma(b);
    const earthLeg = S.distLs / b;           // seconds, Earth frame
    const yourLeg = earthLeg / g;
    if (S.phase === "choose") {
      const finalGap = (S.outboundEarth + earthLeg) - (S.outboundTau + yourLeg);
      el.innerHTML = "Your trip home: <b>" + P.formatDuration(yourLeg) + "</b> · " +
        "Earth will age: <b>" + P.formatDuration(earthLeg) + "</b> · " +
        "final gap: <b>" + P.formatDuration(finalGap) + "</b>";
    } else {
      const remainEarth = S.distLs / b;
      el.innerHTML = "Still to go: <b>" + P.formatDistance(S.distLs) + "</b> · " +
        "about <b>" + P.formatDuration(remainEarth / g) + "</b> of your time left";
    }
  }

  function paintProse() {
    $("view-prose").textContent = sky.describe(S.beta);
    const g = P.gamma(S.beta);
    const D = P.dopplerAhead(S.beta);
    const bits = [];

    /* Looking astern is the half of the effect nobody puts on a poster. The
       forward cone gets all the attention because it is spectacular, but the
       reason it is bright is that everything behind you has been robbed to
       pay for it — reddened, dimmed, and finally pushed out of the visible
       band altogether. The numbers say so in the same sentence. */
    if (lookBack) {
      const Db = P.dopplerBehind(S.beta);
      if (S.beta > 0) {
        bits.push("Astern. Light from dead behind you arrives with its temperature multiplied by " +
          Db.toFixed(Db < 0.01 ? 5 : 3) + " — everything back there is redder, dimmer, and past " +
          "a certain speed it stops being light you can see at all.");
      } else {
        bits.push("Astern. You are not moving, so this is simply the other half of the sky.");
      }
    }

    if (S.beta > 0) {
      bits.push("Light from dead ahead reaches you with its temperature multiplied by " +
        (D < 10 ? D.toFixed(2) : Math.round(D).toLocaleString()) + ".");
      const cmb = D * COL.CMB;
      if (cmb > 700) {
        bits.push("The microwave background ahead now reads " + Math.round(cmb).toLocaleString() +
          " K — hot enough to glow.");
      }
      bits.push("The journey is also " + (100 - 100 / g).toFixed(g > 1.01 ? 1 : 6) +
        "% shorter from where you are sitting, because space itself is contracted along the way you are going.");
    }
    $("view-detail").textContent = bits.join(" ");
  }

  /* ── the equation reference, live ────────────────────────────────────
     Every formula printed on the Info sheet is one this build actually runs,
     and each carries the value it is producing at this instant. That pairing
     is the whole point of the section: a page of algebra nobody can check
     against the thing it describes is decoration, and this exhibit's entire
     claim is that it is not doing that.

     Painted from P and COL directly rather than from liveValues(), which
     formats for the glossary's popovers and speaks in sentences. Both read
     the same functions, so they can differ in wording and never in physics.

     Nothing is computed while the sheet is shut. */
  let eqNodes = null;
  function setEq(name, text) {
    const el = eqNodes && eqNodes[name];
    if (el) el.textContent = text;
  }

  function paintEquations() {
    if ($("info-sheet").hidden) return;
    if (!eqNodes) {
      eqNodes = {};
      document.querySelectorAll("[data-eq]").forEach((el) => {
        eqNodes[el.getAttribute("data-eq")] = el;
      });
    }

    const b = S.beta;
    const g = P.gamma(b);
    const D = P.dopplerAhead(b);
    const Db = P.dopplerBehind(b);
    const k = P.aberrationK(b);
    const cone = P.forwardHemisphereRadius(b) * 180 / Math.PI;
    const frame = P.skyFractionInFrame(b, 39 * Math.PI / 180) * 100;
    const sig = (x, n) => Number(x.toPrecision(n)).toString();
    /* Beaming spans about twenty orders of magnitude across this rail, so no
       single format survives it: "10,220,186,170×" is ten digits nobody reads
       and "0.00×" at the other end is a rounding error pretending to be a
       value. Grouped digits in the middle, exponents at both ends. */
    const factor = (x) => {
      if (!(x > 0)) return "0";
      if (x >= 1e6 || x < 1e-3) return x.toExponential(2);
      if (x >= 100) return Math.round(x).toLocaleString();
      return Number(x.toPrecision(4)).toString();
    };

    setEq("beta", b === 0 ? "β = 0 — at rest" : "β = " + sig(b, 7));
    setEq("gamma", "γ = " + P.formatGamma(g));
    setEq("tau", P.formatDuration(S.tau) + " on your watch");
    setEq("t_earth", P.formatDuration(S.earth) + " at home");
    setEq("length", b === 0
      ? "no contraction — L = L₀"
      : "L = L₀ × " + sig(1 / g, 6) + " — the trip is " +
        (100 - 100 / g).toFixed(g > 1.01 ? 1 : 8) + "% shorter");
    setEq("ke", P.kineticEnergy(b, 1).toExponential(3) + " J per kilogram");
    setEq("p", P.momentum(b, 1).toExponential(3) + " kg·m/s per kilogram");
    setEq("e0", P.restEnergy(1).toExponential(3) + " J per kilogram — always");

    setEq("k", "k = " + sig(k, 7));
    setEq("cone", b === 0
      ? "180° — the forward half of the sky is still a hemisphere"
      : "the forward hemisphere fits inside " +
        (cone * 2 < 1 ? (cone * 2).toPrecision(3) : (cone * 2).toFixed(2)) + "° ahead");
    setEq("frame", frame.toFixed(2) + "% of the entire sky is inside the 78° frame");

    setEq("d_general", b === 0 ? "D = 1 in every direction" :
      "D runs from " + sig(Db, 5) + " dead astern to " + sig(D, 6) + " dead ahead");
    setEq("d_axis", "ahead D = " + sig(D, 6) + " · astern D = " + sig(Db, 5));
    setEq("blackbody", "the Sun's 5,778 K reads as " +
      Math.round(D * COL.T_SUN).toLocaleString() + " K ahead, " +
      Math.round(Db * COL.T_SUN).toLocaleString() + " K astern");
    setEq("beaming", b === 0 ? "no change — D = 1 everywhere" :
      factor(D * D * D * D) + "× brighter ahead, " +
      factor(Db * Db * Db * Db) + "× astern");
    setEq("cmb", (D * COL.CMB).toFixed(D * COL.CMB < 100 ? 4 : 0) + " K ahead" +
      (D * COL.CMB > 800 ? " — hot enough to glow" : " — still invisible"));
  }

  /* ── the speed control ───────────────────────────────────────────── */

  /* There used to be a resolution drop here: while the speed was changing the
     star layer rendered at 62% and came back to full a fifth of a second after
     it settled, on the theory that the frames you sweep through are not the
     ones anybody studies.

     It had to go, because it was not only changing sharpness. The renderer
     splats each star's light into an accumulation buffer and tone-maps per
     pixel, and that tone map is non-linear — so packing the same starlight
     into 38% of the pixels lands each star higher on the curve. The field
     genuinely got brighter while you moved the rail and dimmed 200 ms after
     you let go, which is a rendering artefact sitting on top of the one
     quantity this whole exhibit is calibrated to.

     It was also making the drag worse, not better. Every flip reallocated a
     Float32Array of W·H·3 — about 14 MB at full size — and re-rendered from
     scratch. Measured over a drag at 0.9861 c: 62% gave a 16.7 ms median
     frame and a 66.6 ms worst frame; full resolution gives 17.7 ms median and
     a 50 ms worst. One millisecond of median, in exchange for the buffer
     churn that was hitching the rail under the pointer. */
  function setBeta(b) {
    b = Math.min(0.999999, Math.max(0, b));
    if (b === S.beta) return;
    S.beta = b;
    dirty = true;
    paintProse();
  }

  function commandBeta(b, ms) {
    S.targetBeta = b;
    if (!ms) { setBeta(b); return; }
    S.rampFrom = S.beta; S.rampTo = b;
    S.rampStart = performance.now(); S.rampMs = ms;
  }

  function buildDetents() {
    const host = $("detents");
    P.LADDER.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = d.label;
      b.setAttribute("aria-pressed", "false");
      b.dataset.i = i;
      b.addEventListener("click", () => {
        if ($("speed").disabled) return;
        setRail(P.betaToSlider(d.beta));
        onSlider(d.beta);
      });
      host.appendChild(b);
    });
  }

  function markDetent() {
    const buttons = $("detents").children;
    let nearest = -1, best = Infinity;
    for (let i = 0; i < P.LADDER.length; i++) {
      const d = Math.abs(P.betaToSlider(P.LADDER[i].beta) - P.betaToSlider(S.targetBeta));
      if (d < best) { best = d; nearest = i; }
    }
    /* Tight, because the rail no longer snaps. The old window was 0.004 of
       the rail, which was fine while landing inside it rewrote your speed to
       the rung — the chip lit and the chip was telling the truth. Without the
       snap, that same window would light "0.9 c" while the readout said
       0.9018 c. A chip is lit now only when you are on the rung. */
    const on = S.targetBeta > 0 && best < 0.0005;
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", on && i === nearest ? "true" : "false");
    }

    /* "≈ ISS" under the readout. On a phone the chips are gone entirely and
       this is the whole ladder: it says what the number in front of you is
       roughly equivalent to without asking you to hit a target with a thumb.
       Wider than the chip's window on purpose — the point is recognition, not
       precision, and the ≈ is doing the honest work. */
    const near = $("speed-near");
    const label = nearest >= 0 ? P.LADDER[nearest].label : "";
    // The upper rungs are labelled with the speed itself, and the readout two
    // lines above already says it. Only the named ones are worth repeating.
    const named = label && !/^[0-9.]+ c$/.test(label);
    near.textContent = named && S.targetBeta > 0 && best < 0.02
      ? (on ? "" : "≈ ") + label
      : "";

    setFitted($("detent-note"), on && P.LADDER[nearest].note
      ? P.LADDER[nearest].note
      : (S.targetBeta > 0 ? gainSentence(S.targetBeta) : ""), 11);
  }

  /* The consequence, not the number. "0.99 c" means nothing to most people;
     "six years pass at home for every one of yours" does.

     Kept short deliberately. It sits on one line under the rail and it is
     rewritten on every step of a drag — at the old length it crossed the
     wrapping point somewhere around a day of gain, so the dock grew and shrank
     a row while you were dragging. Same meaning, eighteen fewer characters,
     and setFitted() holds it to the single line it now fits on. */
  function gainSentence(beta) {
    const g = P.gamma(beta);
    const gain = (g - 1) * YEAR;
    if (gain < 1e-6) return "Earth gains " + (gain * 1e9).toFixed(1) + " nanoseconds per year of yours.";
    if (gain < 1e-3) return "Earth gains " + (gain * 1e6).toFixed(1) + " microseconds per year of yours.";
    if (gain < 60) return "Earth gains " + gain.toFixed(2) + " seconds per year of yours.";
    return "Earth gains " + P.formatDuration(gain) + " per year of yours.";
  }

  /* One argument, and it is the reason the rail no longer catches.

     The old control snapped: any thumb position within 0.4% of a labelled
     speed was rewritten to that speed. Sixteen rungs meant sixteen dead
     patches about seven pixels wide where the thumb moved and the number
     did not — which is exactly what "it sticks" describes. Dragging is
     continuous now, with no quantisation of any kind.

     The labelled speeds are still exactly reachable, because the things that
     want an exact speed — the chips, Page Up, Page Down — pass it in here
     directly instead of setting the rail and reading a rounded value back
     off it. */
  function onSlider(exactBeta) {
    const s = Number($("speed").value) / RAIL_MAX;
    const b = exactBeta === undefined ? P.sliderToBeta(s) : exactBeta;
    S.targetBeta = b;
    if (S.phase === "out") {
      setBeta(b);
      syncUrl();
    } else if (S.phase === "choose") {
      // Compatibility for a trip saved by the earlier two-step return UI.
      if (b > 0) beginHome();
    } else if (S.phase === "home") {
      // Return-speed changes are real controls, not a preview. Apply them to
      // the renderer and clock integration immediately.
      S.rampMs = 0;
      setBeta(b);
    }
    markDetent();
    paintReturnPreview();
  }

  /* ── the journey ─────────────────────────────────────────────────── */
  function wire() {
    // Wrapped, not passed by reference: a listener is handed an Event, and
    // onSlider's one parameter is an exact speed.
    $("speed").addEventListener("input", () => { paintRailFill(); onSlider(); });

    /* Which ring the rail gets, if any.

       Browsers count a range input as focus-visible after an ordinary mouse
       click — unlike a button — so the white keyboard ring fired every time
       anyone grabbed the rail, and it is the widest object on the page. The
       ring itself has to stay: it is the only thing telling a keyboard visitor
       where they are. So the two cases get told apart by hand.

       Pointer focus is marked at pointerdown, before focus lands. Any key
       pressed on the rail afterwards clears the mark, because someone who
       grabbed it with a mouse and then reached for the arrow keys has become
       a keyboard visitor mid-interaction and needs the ring back. */
    $("speed").addEventListener("pointerdown", () => {
      $("speed").classList.add("by-pointer");
    });
    $("speed").addEventListener("keydown", () => {
      $("speed").classList.remove("by-pointer");
    });
    $("speed").addEventListener("blur", () => {
      $("speed").classList.remove("by-pointer");
    });
    /* Fine control, for settling on a speed rather than finding one.

       Even with the relativistic end given half the rail, ten orders of
       magnitude do not fit on a control you can reach across, and one pixel
       up at the top is still a real change in γ. The wheel moves the rail by
       a fraction of a pixel's worth at a time. Nothing is being stolen from
       the page — it does not scroll. */
    $("speed").addEventListener("wheel", (e) => {
      const el = $("speed");
      if (el.disabled) return;
      e.preventDefault();
      // deltaMode: 0 pixels, 1 lines, 2 pages.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const next = Number(el.value) - e.deltaY * unit * 0.25;
      setRail(Math.max(0, Math.min(1, next / RAIL_MAX)));
      onSlider();
    }, { passive: false });

    $("speed").addEventListener("keydown", (e) => {
      // Page Up / Page Down step between detents rather than by a raw amount.
      if (e.key !== "PageUp" && e.key !== "PageDown") return;
      e.preventDefault();
      const dir = e.key === "PageUp" ? 1 : -1;
      const here = P.betaToSlider(S.targetBeta);
      const rungs = P.LADDER
        .map((d) => ({ pos: P.betaToSlider(d.beta), beta: d.beta }))
        .sort((a, b) => a.pos - b.pos);
      const next = dir > 0
        ? rungs.find((r) => r.pos > here + 1e-4)
        : rungs.slice().reverse().find((r) => r.pos < here - 1e-4);
      const end = dir > 0 ? { pos: 1, beta: P.sliderToBeta(1) } : { pos: 0, beta: 0 };
      const rung = next === undefined ? end : next;
      setRail(rung.pos);
      onSlider(rung.beta);
    });

    $("act-primary").addEventListener("click", () => {
      if (S.phase === "out") { if (nearEarth()) beginDescent(); else beginStop(); }
      else if (S.phase === "choose") beginHome();
      else if (S.phase === "arrived") reset();
    });
    $("act-secondary").addEventListener("click", skipToArrival);
    $("reset").addEventListener("click", reset);
    wireLookBack();
    wireInfo();
    wireWelcome();
  }

  /* ── the front door ──────────────────────────────────────────────────
     One card, in front of everything, every single time this page opens. It
     is not a second Info sheet and must never grow into one: the sheet is
     for the visitor who wants to know how this is done, and this is for the
     visitor who does not yet know why they would want to look.

     Deliberately not remembered, which is the opposite of how the trip
     behind it works. This gets shown to a room — a queue of people taking a
     turn at the same tab, one after another, none of whom watched the last
     person read it. The second person through the door needs the opening
     sentence exactly as much as the first did. Someone visiting alone pays
     one press of a very large button for that; someone arriving cold and
     not getting it loses the entire point of the exhibit. */
  function setWelcome(open) {
    const card = $("welcome");
    if (card.hidden !== open) return;   // already in the requested state
    card.hidden = !open;
    document.querySelector(".stage").inert = open;
    document.body.classList.toggle("welcome-open", open);
    if (open) { $("welcome-go").focus(); return; }
    // Focus lands on the rail, not back on a button that no longer exists on
    // screen — the card's last line just said to move it, and for anyone on a
    // keyboard the arrow keys now do exactly that.
    $("speed").focus();
  }

  function wireWelcome() {
    $("welcome-go").addEventListener("click", () => setWelcome(false));
    $("welcome-x").addEventListener("click", () => setWelcome(false));
    // Same rule as the sheet: the backdrop is part of the dialog, so a click
    // that lands on it rather than on the card is a click outside.
    $("welcome").addEventListener("click", (e) => {
      if (e.target === $("welcome")) setWelcome(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || $("welcome").hidden) return;
      setWelcome(false);
    });
  }

  /* ── the info sheet ──────────────────────────────────────────────────
     Every word on this page lives behind one button in the corner. The four
     essays used to be a tab strip under the frame, which only worked because
     the frame was letterboxed; with the sky running to all four edges there
     is no "under", and prose parked over the view would be competing with
     the thing it is describing.

     The simulation keeps running behind it. It has to: Earth's clock is an
     integral over your elapsed time, and pausing it to read would put a hole
     in the one number the exhibit is for. */
  function setInfo(open) {
    const sheet = $("info-sheet");
    if (sheet.hidden !== open) return;   // already in the requested state
    sheet.hidden = !open;
    $("info-open").setAttribute("aria-expanded", open ? "true" : "false");
    // Nothing behind the sheet takes focus or a click while it is up — which
    // includes the return-to-terminal pill, whose z-index outranks everything.
    document.querySelector(".stage").inert = open;
    document.body.classList.toggle("sheet-open", open);
    if (open) {
      sheet.scrollTop = 0;
      // Fill the equation column before the sheet is on screen rather than on
      // the next frame, so it never opens showing a page of blank values.
      paintEquations();
      $("info-close").focus();
    } else {
      G.close();
      $("info-open").focus();
    }
  }

  function wireInfo() {
    $("info-open").addEventListener("click", () => setInfo($("info-sheet").hidden));
    $("info-close").addEventListener("click", () => setInfo(false));
    // The backdrop is part of the sheet, so a click that lands on the sheet
    // itself rather than on the card is a click outside the card.
    $("info-sheet").addEventListener("click", (e) => {
      if (e.target === $("info-sheet")) setInfo(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || $("info-sheet").hidden) return;
      setInfo(false);
    });
  }

  /* ── looking astern ──────────────────────────────────────────────────
     Held, not toggled. A latch would let someone wander off, forget which
     way round they are, and read the forward cone's numbers off a picture of
     the wake; holding it makes the two views a comparison you perform rather
     than a state you are in — press, look, let go, and the difference is
     still in your eye when the front of the sky comes back. */
  function setLookBack(on) {
    if (on === lookBack) return;
    lookBack = on;
    const b = $("look-back");
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("on", on);
    dirty = true;
    paintProse();
    paintEarthTarget();
  }

  function wireLookBack() {
    const b = $("look-back");

    // Pointer events cover mouse, pen and touch in one path. The release is
    // bound to the window rather than the button because a press that ends
    // with the cursor somewhere else still has to let go — otherwise you can
    // drag off the button and be stuck facing backwards.
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.focus();
      setLookBack(true);
    });
    for (const ev of ["pointerup", "pointercancel"]) {
      addEventListener(ev, () => setLookBack(false));
    }

    // Keyboard: the same hold, on the keys a button already answers to.
    // keydown repeats while held, which is harmless — setLookBack is a no-op
    // once it is already on.
    b.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      setLookBack(true);
    });
    b.addEventListener("keyup", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      setLookBack(false);
    });

    // Anything that takes the interaction away turns the head back round: a
    // lost focus, a hidden tab, a context menu over the top of the button.
    b.addEventListener("blur", () => setLookBack(false));
    addEventListener("blur", () => setLookBack(false));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) setLookBack(false);
    });
  }

  /* Everything you have flown so far still fits inside the climb: Earth is
     not behind you, it is underneath you. */
  function nearEarth() {
    return S.distLs * KM_PER_LIGHT_SECOND <= TOP_KM;
  }

  /* So there is nothing to turn around from. Stopping dead, swinging the
     whole sky through 180°, and then flying back the four kilometres you had
     climbed was a pantomime of a journey that had not happened yet — and it
     ended with the view swinging back again to undo a turn nobody needed.
     You cut the engine and you come down, and the warning says so. */
  function beginDescent() {
    S.skipTurn = true;
    arrive();
  }

  function beginStop() {
    S.returnBeta = S.targetBeta || S.beta;
    S.phase = "stopping";
    commandBeta(0, reduceMotion ? 1 : 2200);
    paintPhase();
  }

  function beginTurn(now) {
    S.phase = "turning";
    S.turnStart = now;
    paintPhase();
  }

  function beginHome() {
    if (!(S.targetBeta > 0)) return;
    if (S.distLs <= 0) { arrive(); return; }
    S.phase = "home";
    commandBeta(S.targetBeta, reduceMotion ? 1 : 1400);
    paintPhase();
  }

  function skipToArrival() {
    const b = S.beta > 0 ? S.beta : S.targetBeta;
    if (!(b > 0)) return;
    const g = P.gamma(b);
    const earthLeg = S.distLs / b;
    S.earth += earthLeg;
    S.tau += earthLeg / g;
    S.distLs = 0;
    S.skipped = true;
    arrive();
  }

  /* You do not simply appear back in the forest. Earth still has an
     atmosphere and you still have to come down through it, which is the
     loudest part of the whole trip and the bookend the exhibit is built
     around: the same hillside, the same trees, a different date. */
  function arrive() {
    S.beta = 0;
    S.targetBeta = 0;
    S.rampMs = 0;
    S.distLs = 0;
    setRail(0);
    markDetent();
    updateHomeView();
    dirty = true;
    S.landStart = performance.now();
    S.landFromKm = S.altKm;
    S.phase = S.altKm > 0.02 ? "landing" : "arrived";
    if (S.phase === "arrived") forward = OUTBOUND.slice();
    paintPhase();
    save();
  }

  function settle() {
    if (S.phase !== "landing") return;
    S.altKm = 0;
    S.phase = "arrived";
    landingHeat = 0;
    // Exactly the opening orientation, not merely close to it.
    forward = OUTBOUND.slice();
    dirty = true;
    paintPhase();
    save();
  }

  /* Keep the return view centred on an isolated Earth. The catalogue renderer
     no longer adds the Sun; the black Earth disc is a DOM layer so its edge
     stays clean at every canvas resolution. */
  function updateHomeView() {
    sky.extras = [];
    insetSky.extras = [];
    dirty = true;
  }

  function paintEarthTarget() {
    const earth = $("earth-target");
    // Only while you are still flying toward it. Once you are in the air
    // above the trees it is underneath you, not ahead, and once you have
    // landed you are standing on it — leaving the globe hanging in the sky
    // covered the one number the whole exhibit is for.
    // And not while you are looking the other way, or Earth hangs in the
    // middle of your own wake.
    const visible = (S.phase === "choose" || S.phase === "home") && !lookBack;
    earth.hidden = !visible;
    if (!visible) return;

    const stageHeight = canvas.getBoundingClientRect().height;
    const pxPerTan = (stageHeight / 2) / Math.tan(49 * Math.PI / 360);
    const earthRadiusKm = 6371;
    const rangeKm = Math.max(earthRadiusKm, S.distLs * P.C / 1000);
    const angularRadius = Math.asin(Math.min(0.999, earthRadiusKm / rangeKm));

    /* Earth is in the same sky as everything else, and it gets the same two
       transforms — which it did not before, and at 0.99 c it showed.

       Aberration first, on the same half-angle tangent every star goes
       through. Flying at something squeezes the whole forward sky toward the
       middle of the frame, Earth included: at 0.999 c it is forty-five times
       smaller than its plain geometric size. A globe swelling to fill the
       frame while the entire star field around it collapsed into a dot was
       the one object in view visibly exempt from the physics. */
    const seenRadius = 2 * Math.atan(P.aberrationK(S.beta) *
      Math.tan(angularRadius / 2));
    // Floored at a few pixels because at a light-minute out Earth is
    // genuinely smaller than one, and a target you cannot see is not a
    // target. Capped well short of the frame: physically it would swell to
    // fill the sky in the last moments, but a globe covering the readouts
    // reads as a glitch rather than as an arrival — and you are about to be
    // standing on it anyway.
    const diameter = Math.max(7, Math.min(stageHeight * 0.42,
      2 * pxPerTan * Math.tan(seenRadius)));
    earth.style.width = diameter + "px";
    earth.style.height = diameter + "px";

    /* Then the beaming. Earth is dead ahead, so its light arrives with the
       full forward Doppler factor on it — the same D that turns the sky in
       front of you white. Leaving the photograph at its daylight exposure
       meant that at 0.999 c the one thing you were flying at was a dark speck
       against a blazing cone: the only unlit object in a frame where the
       physics had brightened everything else by D⁴. */
    const D = P.dopplerAhead(S.beta);
    const beam = Math.min(5, Math.pow(D, 0.55));
    earth.style.filter = beam > 1.01 ? "brightness(" + beam.toFixed(2) + ")" : "";
    // A halo, because a disc this bright would not have a clean edge. It
    // grows with the beaming and is the only cue left once Earth is down to
    // the few pixels the floor holds it at.
    const halo = Math.min(1, Math.max(0, Math.log(Math.max(1, D)) / Math.log(60)));
    earth.style.boxShadow = halo > 0.01
      ? "0 0 " + (diameter * 0.5 + halo * 26).toFixed(1) + "px " +
        (diameter * 0.06).toFixed(1) + "px rgba(198,222,255," + (halo * 0.75).toFixed(2) + ")"
      : "";

    earth.setAttribute("aria-label", "Earth ahead, " + P.formatMiles(S.distLs) + " away");
  }

  /* ── checkpoints ─────────────────────────────────────────────────────
     Two kinds, both fired at most once per trip: a distance you have just
     put behind you, and — at the top of the rail — what that speed is
     actually good for. */
  function checkMarks() {
    if (S.phase !== "out" && S.phase !== "home") return;

    for (const m of MARKS) {
      if (S.distLs < m.at || S.seen.includes(m.t)) continue;
      S.seen.push(m.t);
      showMark(m.k, m.t, m.n);
    }

    // The top of the ladder. β = 0.999999 is where the rail stops, and the
    // question it invites is the one nobody has a feel for: what is this
    // speed *for*?
    if (S.beta >= 0.999999 && !S.seen.includes("alpha")) {
      S.seen.push("alpha");
      const g = P.gamma(S.beta);
      const yours = ALPHA_LY * YEAR / (S.beta * g);   // your own clock, one way
      const theirs = ALPHA_LY * YEAR / S.beta;        // Earth's clock, one way
      showMark("Top of the rail",
        "Alpha Centauri: " + P.formatDuration(yours),
        "The closest star to the Sun, 4.25 light-years out. At this speed the " +
        "crossing costs you that much — and Earth " + P.formatDuration(theirs) + ".");
    }
  }

  /* Queued, and only ever one on screen.

     At the top of the rail you cross the Moon, Mercury, Earth's own orbit,
     Jupiter and Saturn inside about ten seconds — Earth's clock runs seven
     hundred times yours up there, and the distance goes with Earth's clock.
     They come through one at a time, three seconds apart, in a single line
     that changes rather than a stack that grows. The sentence for each one
     is behind a tap. */
  const MARK_GAP = 3000;
  const MARK_LIFE = 11000;
  let markQueue = [];
  let markTimer = 0;
  let markLife = 0;
  let markLast = 0;

  function showMark(kicker, title, note) {
    markQueue.push({ kicker, title, note });
    drainMarks();
  }

  function drainMarks() {
    if (markTimer || !markQueue.length) return;
    const wait = Math.max(0, MARK_GAP - (performance.now() - markLast));
    markTimer = setTimeout(() => {
      markTimer = 0;
      const m = markQueue.shift();
      if (m) { paintMark(m); markLast = performance.now(); }
      drainMarks();
    }, wait);
  }

  function paintMark(m) {
    const host = $("marks");
    const el = document.createElement("button");
    el.type = "button";
    el.className = "mark";
    el.setAttribute("aria-expanded", "false");
    const k = document.createElement("span"); k.className = "k"; k.textContent = m.kicker;
    const t = document.createElement("span"); t.className = "t num"; t.textContent = m.title;
    const n = document.createElement("span"); n.className = "n"; n.textContent = m.note;
    el.append(k, t, n);

    /* Opened, it stops counting down. Someone who has just tapped it to read
       the sentence should not have it fade out from under them. */
    el.addEventListener("click", () => {
      const open = el.getAttribute("aria-expanded") === "true";
      el.setAttribute("aria-expanded", open ? "false" : "true");
      clearTimeout(markLife);
      if (open) markLife = setTimeout(() => retireMark(el), MARK_LIFE);
    });

    // Replaced, not stacked. Removed outright rather than through retireMark,
    // which only starts a fade — the old one has to be gone before the new one
    // lands or the rail jumps a row taller for the length of the crossfade.
    host.replaceChildren(el);
    clearTimeout(markLife);
    markLife = setTimeout(() => retireMark(el), MARK_LIFE);
  }

  function retireMark(el) {
    if (!el || !el.isConnected || el.classList.contains("out")) return;
    el.classList.add("out");
    // The class drives a fade; remove on its end, and on a timer as well so a
    // reduced-motion visitor — who gets no transition and therefore no
    // transitionend — does not leave a dead panel sitting in the rail.
    el.addEventListener("transitionend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
  }

  /* ── callouts ────────────────────────────────────────────────────── */
  function checkCallouts() {
    let hit = -1;
    for (let i = 0; i < CALLOUTS.length; i++) if (S.earth >= CALLOUTS[i][0]) hit = i;
    if (hit === S.callout) return;
    S.callout = hit;
    if (hit < 0) {
      $("callout-when").textContent = "Nothing yet";
      $("callout-text").textContent = "Get moving and Earth will start pulling ahead.";
    } else {
      $("callout-when").textContent = CALLOUTS[hit][1] + " at home";
      $("callout-text").textContent = CALLOUTS[hit][2];
    }
  }

  /* ── live values for the glossary popovers ───────────────────────── */
  function liveValues() {
    const g = P.gamma(S.beta);
    const D = P.dopplerAhead(S.beta);
    const cone = P.forwardHemisphereRadius(S.beta) * 180 / Math.PI;
    const KE = P.kineticEnergy(S.beta, 1);
    return {
      beta: P.formatBeta(S.beta),
      gamma: P.formatGamma(g),
      tau: P.formatDuration(S.tau),
      t_earth: P.formatDuration(S.earth),
      D_ahead: S.beta > 0 ? D.toFixed(D < 100 ? 3 : 0) + " looking ahead, " +
        P.dopplerBehind(S.beta).toFixed(4) + " looking back" : "1 — you are not moving",
      D4: S.beta > 0 ? Math.round(D * D * D * D).toLocaleString() + "× brighter ahead" : "no change",
      cone_angle: S.beta > 0
        ? "the forward half of the sky fits inside " + (cone * 2 < 1 ? (cone * 2).toFixed(3) : (cone * 2).toFixed(1)) + "° ahead of you"
        : "180° — the sky is where it has always been",
      L_contract: S.beta > 0
        ? "the trip is " + (100 - 100 / g).toFixed(g > 1.01 ? 1 : 8) + "% shorter from where you are"
        : "no contraction at rest",
      KE: KE.toExponential(2) + " joules per kilogram" +
        (KE > 6e19 ? " — more than a tenth of what humanity uses in a year, for one kilogram" : ""),
      p: P.momentum(S.beta, 1).toExponential(2) + " kg·m/s per kilogram",
      T_cmb: (D * COL.CMB).toFixed(D * COL.CMB < 100 ? 3 : 0) + " K ahead" +
        (D * COL.CMB > 800 ? " — visible" : " — still invisible"),
    };
  }

  /* ── screen reader ───────────────────────────────────────────────── */
  function announce(now) {
    if (now - lastAnnounce < 10000) return;
    lastAnnounce = now;
    $("live-region").textContent =
      "You: " + P.formatDuration(S.tau) + ". Earth: " + P.formatDuration(S.earth) +
      ". Earth is ahead by " + P.formatDuration(S.earth - S.tau) + ".";
  }

  /* ── persistence ─────────────────────────────────────────────────
     Not a gimmick, and not an approximation: Earth's elapsed time along your
     worldline is ∫γ dτ, so a running total accumulated across a whole
     session with the slider moving around is the real integral.

     KEY is declared at the top of this file, not here — see the note on it
     there. */
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        phase: S.phase, tau: S.tau, earth: S.earth, distLs: S.distLs,
        beta: S.beta, targetBeta: S.targetBeta, startWall: S.startWall,
        outboundTau: S.outboundTau, outboundEarth: S.outboundEarth,
        returnBeta: S.returnBeta, skipped: S.skipped, altKm: S.altKm,
        seen: S.seen,
      }));
    } catch (e) { /* private mode, or a file:// origin that refuses storage */ }
  }

  function restore() {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) {}
    if (stored && typeof stored.tau === "number") {
      Object.assign(S, stored);
      if (!(S.returnBeta >= 0)) S.returnBeta = S.targetBeta || S.beta || 0;
      if (!(S.altKm >= 0)) S.altKm = 0;
      if (!Array.isArray(S.seen)) S.seen = [];
      // A re-entry is a few seconds of noise, not a state worth resuming
      // into. Come back to a tab that was mid-landing and you are simply
      // home, in the forest, with the numbers intact.
      if (S.phase === "landing") { S.phase = "arrived"; S.altKm = 0; S.skipTurn = false; }
      if (S.phase === "stopping" || S.phase === "turning") S.phase = "choose";
      if (S.phase === "choose" || S.phase === "home" || S.phase === "arrived") {
        forward = [-OUTBOUND[0], -OUTBOUND[1], -OUTBOUND[2]];
      }
      if (S.phase === "arrived") {
        S.beta = 0;
        S.targetBeta = 0;
        S.rampMs = 0;
        S.distLs = 0;
      }
      // Older builds paused here waiting for a second click. A restored
      // return now resumes immediately, matching a fresh turnaround.
      if ((S.phase === "choose" || S.phase === "home") &&
          S.distLs > 0 && S.targetBeta > 0) {
        S.phase = "home";
        S.beta = S.targetBeta;
        S.rampMs = 0;
      }
      $("persist-note").textContent =
        "Picked up where you left off — you have been here " + P.formatDuration(S.tau) + ".";
    }
    const url = new URLSearchParams(location.search);
    const b = parseFloat(url.get("b"));
    if (isFinite(b) && b >= 0 && b < 1 && S.phase === "out") { S.beta = S.targetBeta = b; }
    setRail(P.betaToSlider(S.targetBeta || S.beta));
    markDetent();
    checkCallouts();
    updateHomeView();
    paintPhase();
  }

  function syncUrl() {
    if (!history.replaceState) return;
    const q = S.beta > 0 ? "?b=" + Number(S.beta.toPrecision(8)) : location.pathname;
    try { history.replaceState(null, "", S.beta > 0 ? q : location.pathname); } catch (e) {}
  }

  function reset() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    Object.assign(S, {
      phase: "out", beta: 0, targetBeta: 0, tau: 0, earth: 0, distLs: 0,
      rampMs: 0, skipped: false, startWall: Date.now(), callout: -1,
      outboundTau: 0, outboundEarth: 0,
      returnBeta: 0, altKm: 0, landFromKm: 0, skipTurn: false, seen: [],
    });
    markQueue = [];
    clearTimeout(markTimer); markTimer = 0;
    $("marks").replaceChildren();
    shake = 0;
    landingHeat = 0;
    // Start the clock from now, not from whenever the loop last ran. Without
    // this a reset arriving on a stale frame handed the next tick a dt of
    // however long the tab had been asleep.
    lastFrame = performance.now();
    forward = OUTBOUND.slice();
    sky.extras = []; insetSky.extras = [];
    setRail(0);
    $("persist-note").textContent = "This session is remembered while the tab is open.";
    sky.exposureScale = insetSky.exposureScale = 1;
    markDetent(); checkCallouts(); paintPhase();
    syncUrl();
    // Reset is a button on the sheet, and what it resets is behind the sheet.
    setInfo(false);
    dirty = true;
  }

  /* ── the validation checklist, runnable ──────────────────────────────
     Open the page with ?selftest and the numbers from the blueprint's §8.12
     get checked in the console against what this build actually computes.
     A checklist you cannot run is a wish. */
  if (/(\?|&)selftest/.test(location.search)) {
    const rows = [];
    const check = (what, got, want, tol) => rows.push({
      check: what, computed: got, expected: want,
      pass: typeof want === "number" ? Math.abs(got - want) <= tol : got === want,
    });
    check("Ballesteros at B−V = 0.65 → 5778 K", +COL.temperatureFromBV(0.65).toFixed(0), 5778, 1);
    check("γ at β = 0.9", +P.gamma(0.9).toFixed(4), 2.2942, 0.0001);
    check("D ahead at β = 0.9", +P.dopplerAhead(0.9).toFixed(3), 4.359, 0.001);
    check("forward hemisphere fits 78° at β = 0.7771",
      +(P.forwardHemisphereRadius(0.7771) * 360 / Math.PI).toFixed(1), 78.0, 0.3);
    check("half the whole sky inside a 78° frame at β = 0.7771",
      +(P.skyFractionInFrame(0.7771, 39 * Math.PI / 180) * 100).toFixed(1), 50.0, 0.3);
    check("96% of the sky inside a 78° frame at β = 0.99",
      +(P.skyFractionInFrame(0.99, 39 * Math.PI / 180) * 100).toFixed(0), 96, 1);
    check("70% of the sky inside a 78° frame at β = 0.9",
      +(P.skyFractionInFrame(0.9, 39 * Math.PI / 180) * 100).toFixed(0), 70, 1);
    check("LUT: 5778 K", COL.hexAt(5778), "#FFF1EA");
    check("LUT: 10,000 K", COL.hexAt(10000), "#CDD9FF");
    check("LUT: 20,000 K", COL.hexAt(20000), "#ABC1FF");
    check("LUT: 10⁵ K, one step off the Rayleigh–Jeans limit", COL.hexAt(1e5), "#98B3FF");
    check("the Sun does not render as pure white", COL.hexAt(5778) !== "#FFFFFF", true);
    check("colour at (T, D) equals colour at (T·D, 1)", COL.hexAt(3000 * 4.359), COL.hexAt(13077));
    check("CMB ahead at β = 0.99998 (K)",
      Math.round(P.dopplerAhead(0.99998) * COL.CMB), 862, 3);
    check("CMB ahead at β = 0.9999 (K)",
      Math.round(P.dopplerAhead(0.9999) * COL.CMB), 385, 2);
    check("KE of 1 kg at β = 0.999999 (J)",
      +P.kineticEnergy(0.999999, 1).toPrecision(3), 6.35e19, 1e17);
    check("flux range Sirius → V = 8",
      Math.round(COL.fluxFromMagnitude(-1.46) / COL.fluxFromMagnitude(8)), 6081, 2);
    check("stars loaded", sky.count, 9096, 0);
    for (const rung of P.LADDER) {
      check("slider round-trip: " + rung.label,
        +P.sliderToBeta(P.betaToSlider(rung.beta)).toPrecision(8),
        +rung.beta.toPrecision(8), Math.max(1e-12, rung.beta * 1e-7));
    }
    console.table(rows);
    const failed = rows.filter((r) => !r.pass);
    console.log(failed.length ? "FAILED: " + failed.length : "all checks pass");
  }
})();
