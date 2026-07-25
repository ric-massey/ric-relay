/* ══════════════════════════════════════════════════════════════════════
   game.js — state, the loop, and everything wired together.

   THE WORLD IS STORED IN THE HOME FRAME. Positions are real light-years
   relative to the ship, uncontracted, so the direction to anything is the
   rest-frame direction that aberration wants, and a collision is a
   collision in every frame. Contraction is applied where it belongs — to
   how far ahead things are born, and to the odometer the HUD shows you.

   THE ENGINE IS THE THROTTLE. There is no warp speed setting. You choose a
   proper acceleration in g, and the rocket equations decide everything
   else: how fast you are going, how much time you have lived through, how
   much time has passed at home, how hot the microwave background is
   getting, and how hard the interstellar medium is hitting the hull.

   YOU CANNOT TURN AT SPEED. Thrust points along the nose, but the velocity
   vector only bleeds toward it at a/(γβ) — the real suppression of
   transverse acceleration. At γ = 100 the ship is committed. The prograde
   marker drifting away from the reticle is that fact, drawn.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const F = SF.FUDGE;
  const v3 = SF.v3;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // How much radiated power the hull shrugs off, in watts per square metre
  // per unit of integrity per second. Tuned; everything feeding it is not.
  const HULL_ISM_CAPACITY = 2.0e8;
  const HULL_CMB_CAPACITY = 6.0e8;

  // How far out a system's gravity is worth summing. Beyond this the pull is
  // below a millionth of a g and costs more to compute than it changes.
  const GRAVITY_REACH_LY = 40;

  const canvas = document.getElementById("sky");
  const gameOverEl = document.getElementById("game-over");
  const lossCode = document.getElementById("loss-code");
  const lossTitle = document.getElementById("loss-title");
  const lossDetail = document.getElementById("loss-detail");
  const restartButton = document.getElementById("restart");
  const pauseEl = document.getElementById("pause");
  const ledgerEl = document.getElementById("ledger");
  const mapEl = document.getElementById("map");
  const mapListEl = document.getElementById("map-list");

  const state = {
    running: true,
    paused: false,
    eta: 0, beta: 0, gamma: 1,
    throttle: 0, throttleTarget: 0,
    shipYears: 0, homeYears: 0, distanceLy: 0,
    hull: 1,
    bubble: false,
    // Drive speed, ly per REAL second. SIGNED: positive along the nose,
    // negative astern. It persists — releasing the pedal holds it.
    warpLySec: 0,
    gear: 1,        // 1 Sub-light … 6 Intergalactic, see F.gears
    feltG: 0,       // honest proper acceleration this frame, in gravities
    relativistic: true,
    ismDensity: K.ismLocalBubble,
    ismWattsPerM2: 0,
    cmbForwardK: K.tCMB,
    density: 1,
    milestoneIndex: 0,
    flash: 0, flashColour: "255,255,255",
    waypoint: null,   // { obj, name } chosen from the star chart
    // Gravity, and the distance that decides how calm the clock runs.
    gravityG: 0,
    nearestSystemLy: Infinity,
    // Speed measured against something you can see, rather than against the
    // Sun's rest frame. Zero when you are station-keeping with a world.
    relBody: null, relName: null, relDistLy: Infinity,
    relSpeedC: 0, relClosingC: 0,
  };
  SF.state = state;

  const CTRL = SF.controls;

  // THE SHIP'S ACTUAL STATE OF MOTION is the proper-velocity vector u = γβ,
  // in the home frame. β, γ and the heading are all read off it; nothing
  // else is authoritative. `vdir` is the unit heading, kept as a separate
  // variable because a dozen places want a direction and because it has to
  // hold its last value when u falls to exactly zero.
  let u = { x: 0, y: 0, z: 0 };
  let vdir = { x: 0, y: 0, z: 1 };
  // Thruster command in body axes, smoothed toward the stick so the engines
  // spool rather than snap. x = right, y = up, z = forward, in gravities.
  let thrustCmd = { x: 0, y: 0, z: 0 };

  const systems = [];
  const galaxies = [];
  // Exposed so the scene can be inspected from a console — handy when the
  // thing you want to look at is a black hole 1,560 light-years away.
  SF.world = { systems, galaxies, heading: () => vdir, velocity: () => u };
  let skyField = null;
  let milkyWay = null;
  let nextSystemAt = 0;
  let last = performance.now();
  let joyX = 0, joyY = 0, joyActive = false;
  let pointerThrust = 0;
  // Flight assist starts ON. The honest Newtonian model is one keypress away,
  // but it should not be what a first-time pilot is handed.
  let assist = true;
  state.assist = assist;

  /* ── world building ─────────────────────────────────────────────────── */

  function seedCatalogue() {
    const near = window.SF_STARS_NEAR || [];
    const bright = window.SF_STARS_BRIGHT || [];
    const seen = new Set();

    for (const entry of near.concat(bright)) {
      if (seen.has(entry.name)) continue;
      seen.add(entry.name);
      const { pos, distanceLy } = SF.systems.catalogueToCartesian(entry);
      const star = SF.systems.starFromCatalogue(entry, distanceLy);
      // Real stars keep their real light. Whether they have planets is our
      // guess — but the frost line decides what kind, from their luminosity.
      const system = SF.systems.create({
        pos, star, name: entry.name, note: entry.note,
        catalogue: true, allowBlackHole: false,
      });
      systems.push(system);
    }

    for (const entry of SF.blackhole.catalogue) {
      const { pos } = SF.systems.catalogueToCartesian(entry);
      systems.push(SF.blackhole.createSystem({
        pos, mass: entry.mass, name: entry.name, note: entry.note,
      }));
    }
  }

  function seedDeepSky() {
    const deep = window.SF_DEEP_SKY || [];
    for (const entry of deep) {
      const { pos } = SF.systems.catalogueToCartesian(entry);
      if (entry.kind === "blackhole") {
        systems.push(SF.blackhole.createSystem({
          pos, mass: entry.mass, name: entry.name, note: entry.note,
        }));
        continue;
      }
      const galaxy = SF.galaxy.create({
        pos,
        diameterLy: entry.dia,
        kind: entry.kind === "cluster" || entry.kind === "globular" || entry.kind === "nebula"
          || entry.kind === "remnant" ? "irregular" : entry.kind,
        n: entry.n,
        pitchDeg: entry.pitch,
        name: entry.m ? `${entry.name} (${entry.m})` : entry.name,
        note: entry.note,
        permanent: true,
      });
      galaxy.realKind = entry.kind;
      if (entry.hue != null) galaxy.tint = hslToRgb(entry.hue, 0.62, 0.66);
      galaxies.push(galaxy);
    }

    // The galaxy you are standing in. Its centre is where Sgr A* is, which
    // is why leaving it takes 12.3 ship-years at one gravity.
    const sgr = SF.systems.catalogueToCartesian({ ra: 266.417, dec: -29.008, dly: K.sgrADistanceLy });
    milkyWay = SF.galaxy.create({
      pos: sgr.pos,
      diameterLy: K.milkyWayDiameterLy,
      kind: "barred",
      n: 1,
      pitchDeg: K.milkyWayPitchDeg,
      name: "the Milky Way",
      note: "home",
      permanent: true,
    });
    // Line its disk up with the real galactic plane rather than a random one.
    milkyWay.normal = v3.normalize({ x: -0.4776, y: 0.7470, z: -0.4622 });
    const seed = Math.abs(milkyWay.normal.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    milkyWay.u = v3.normalize(v3.cross(seed, milkyWay.normal));
    milkyWay.w = v3.cross(milkyWay.normal, milkyWay.u);
    galaxies.push(milkyWay);

    // A handful of anonymous ones for the deep field. Most galaxies are
    // dwarfs, so most of these are too — that is the Schechter function.
    const count = reducedMotion ? 5 : 9;
    for (let i = 0; i < count; i += 1) galaxies.push(spawnFieldGalaxy());
  }

  function spawnFieldGalaxy() {
    const distance = 3e6 * Math.pow(10, Math.random() * 2.2);
    const dir = randomUnit();
    const kind = SF.galaxy.sampleKind();
    return SF.galaxy.create({
      pos: { x: dir.x * distance, y: dir.y * distance, z: dir.z * distance },
      diameterLy: SF.galaxy.sampleDiameterLy(),
      kind,
    });
  }

  function randomUnit() {
    const cosI = -1 + 2 * Math.random();
    const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
    const phi = Math.random() * Math.PI * 2;
    return { x: sinI * Math.cos(phi), y: cosI, z: sinI * Math.sin(phi) };
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = (h % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; } else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; } else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; } else { r = c; b = x; }
    const m = l - c / 2;
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }

  /* ── setup ──────────────────────────────────────────────────────────── */

  function restart() {
    state.running = true;
    state.paused = false;
    // Start at rest in the Sun's frame. Relativity scales with speed, so from
    // a standstill the sky sits still, planets orbit at their honest rate and
    // your clock keeps home time — and the aberration crush, the Doppler
    // starbow and the clock split only appear once you have actually built up
    // speed toward c. Nothing is "already fast" the moment you launch.
    state.eta = 0;
    state.beta = 0;
    state.gamma = 1;
    state.throttle = 0; state.throttleTarget = 0;
    state.shipYears = 0; state.homeYears = 0; state.distanceLy = 0;
    state.hull = 1;
    state.bubble = false;
    state.warpLySec = 0;
    state.gear = 1;
    state.feltG = 0;
    state.relativistic = true;
    state.milestoneIndex = 0;
    state.flash = 0;
    u = { x: 0, y: 0, z: 0 };
    thrustCmd = { x: 0, y: 0, z: 0 };
    joyX = 0; joyY = 0; joyActive = false;
    pointerThrust = 0;
    state.waypoint = null;
    if (mapEl) mapEl.hidden = true;

    systems.length = 0;
    galaxies.length = 0;
    SF.camera.reset();

    seedCatalogue();
    seedDeepSky();

    // Launch on a course for the nearest star. It is 4.246 light-years away
    // and, at one gravity, about three years of your life.
    const proxima = (window.SF_STARS_NEAR || [])[0];
    if (proxima) {
      SF.camera.lookAt(SF.systems.catalogueToCartesian(proxima).pos);
      vdir = { ...SF.camera.forward };
    } else {
      vdir = { x: 0, y: 0, z: 1 };
    }

    nextSystemAt = SF.systems.nextGapLy();
    gameOverEl.hidden = true;
    pauseEl.hidden = true;
    last = performance.now();
  }

  /* ── input ──────────────────────────────────────────────────────────── */

  // The mouse deliberately does nothing to flight — steering is the keyboard
  // (arrows) on desktop and the on-screen joystick on touch. All the canvas
  // still wants from the pointer is to swallow the right-click menu and to
  // unlock the audio context on the first tap.
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", () => SF.audio.resume());

  for (const button of document.querySelectorAll("[data-thrust]")) {
    const value = Number(button.dataset.thrust);
    const press = (event) => { event.preventDefault(); pointerThrust = value; SF.audio.resume(); };
    const release = (event) => { event.preventDefault(); pointerThrust = 0; };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }

  // Mobile steering stick. Its offset from centre is the steering vector, so
  // it reads exactly like the keyboard stick — same [-1, 1] range, same feed
  // into camera.steer — instead of the drag-the-whole-sky aiming that touch
  // fell back on before. The thumb is captured on pointerdown so a drag that
  // leaves the base still tracks.
  const joystick = document.getElementById("joystick");
  const joystickThumb = document.getElementById("joystick-thumb");
  let joyPointerId = null;

  function joyMove(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * 0.5 - 8;      // travel limit, px
    let dx = clientX - cx, dy = clientY - cy;
    const mag = Math.hypot(dx, dy);
    if (mag > max && mag > 0) { dx = (dx / mag) * max; dy = (dy / mag) * max; }
    joystickThumb.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const nx = dx / max, ny = dy / max;
    const nmag = Math.hypot(nx, ny);
    const dead = 0.12;
    if (nmag < dead) { joyX = 0; joyY = 0; return; }
    const k = Math.min(1, (nmag - dead) / (1 - dead)) / nmag;
    joyX = nx * k; joyY = ny * k;
  }

  if (joystick && joystickThumb) {
    joystick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      joyPointerId = event.pointerId;
      joyActive = true;
      joystick.classList.add("active");
      joystick.setPointerCapture(event.pointerId);
      SF.audio.resume();
      joyMove(event.clientX, event.clientY);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (joyPointerId !== event.pointerId) return;
      event.preventDefault();
      joyMove(event.clientX, event.clientY);
    });
    const joyEnd = (event) => {
      if (joyPointerId !== event.pointerId) return;
      joyPointerId = null;
      joyActive = false;
      joyX = 0; joyY = 0;
      joystick.classList.remove("active");
      joystickThumb.style.transform = "translate(0px, 0px)";
    };
    joystick.addEventListener("pointerup", joyEnd);
    joystick.addEventListener("pointercancel", joyEnd);
  }

  addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

    const code = event.code;
    // While the rebinding panel is listening, every key belongs to it.
    if (SF.bindings && SF.bindings.capture(code, event)) return;
    if (CTRL.shouldSwallow(code)) event.preventDefault();
    if (event.repeat) return;
    CTRL.press(code);

    const actions = CTRL.actionsFor(code);
    if (!state.running && (actions.includes("thrustFwd") || code === "Enter" || code === "KeyR")) {
      restart();
      return;
    }
    // Escape is hard-wired: it is the one key that must always back you out,
    // whatever the player has done to the rest of the map.
    if (code === "Escape") { escapeOut(); return; }
    for (const action of actions) {
      if (CTRL.isEdge(action)) fireAction(action);
    }
  });

  addEventListener("keyup", (event) => { CTRL.release(event.code); });
  addEventListener("blur", () => { CTRL.releaseAll(); pointerThrust = 0; });

  function escapeOut() {
    if (SF.bindings && SF.bindings.close()) return;
    if (mapEl && mapEl.hidden === false) { closeMap(); return; }
    if (ledgerEl && ledgerEl.hidden === false) { ledgerEl.hidden = true; return; }
    togglePause();
  }

  function setGear(n) {
    const g = Math.max(1, Math.min(F.gears.length, n | 0));
    if (g === state.gear) return;
    state.gear = g;
    const gear = F.gears[g - 1];
    // The note is the gear's own, out of constants.js, so adding a gear cannot
    // leave the announcement describing the one that used to be there.
    SF.hud.announce({ title: `Gear ${g} · ${gear.name}`, note: gear.note || "" });
    SF.audio.blip(200 + g * 55, 0.25, "square", 0.05);
  }

  function fireAction(action) {
    switch (action) {
      case "chart": toggleMap(); break;
      case "sound": SF.hud.setSoundLabel(SF.audio.toggle()); break;
      case "gearUp": setGear(state.gear + 1); break;
      case "gearDown": setGear(state.gear - 1); break;
      case "jump": setGear(F.gears.length); break;   // "punch it" — top gear
      case "pause": escapeOut(); break;
      case "ledger":
        ledgerEl.hidden = !ledgerEl.hidden;
        if (!ledgerEl.hidden && !state.paused) togglePause();
        break;
      case "bindings": SF.bindings?.open(); break;
      default:
        // "gear4" → gear 4, for however many gears constants.js declares.
        if (/^gear\d+$/.test(action)) setGear(Number(action.slice(4)));
        break;
    }
  }

  /**
   * The rotation stick: yaw, pitch and roll in [-1, 1]. The touch joystick
   * feeds the same two rotation axes, so both input paths land in one place.
   */
  function rotationStick() {
    let x = CTRL.axis("yawLeft", "yawRight");
    let y = CTRL.axis("pitchUp", "pitchDown");
    const roll = CTRL.axis("rollLeft", "rollRight");
    if (joyActive) { x = joyX; y = joyY; }
    return { x, y, roll };
  }

  /**
   * The translation stick: which way the thrusters are firing, in body axes.
   * Separate from rotation on purpose — pointing the nose somewhere and going
   * there are different actions, and the gap between them is the flight model.
   */
  function translationStick() {
    return {
      x: CTRL.axis("strafeLeft", "strafeRight"),
      y: CTRL.axis("thrustDown", "thrustUp"),
      z: CTRL.axis("thrustBack", "thrustFwd") + pointerThrust,
    };
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseEl.hidden = !state.paused;
    if (!state.paused) last = performance.now();
  }

  /* ── star chart ─────────────────────────────────────────────────────── */

  // Every named, permanent thing you could sensibly steer toward: the real
  // catalogued stars and black holes (they carry names; procedural fly-bys do
  // not) and the permanent galaxies. Nearest first, measured right now.
  function mapDestinations() {
    const items = [];
    for (const s of systems) {
      if (!s.name) continue;
      const kind = s.hole ? "black hole" : (s.star && s.star.type ? s.star.type : "star");
      items.push({ obj: s, name: s.name, kind });
    }
    for (const g of galaxies) {
      if (!g.name) continue;
      items.push({ obj: g, name: g.name, kind: g.realKind || g.type || "galaxy" });
    }
    for (const item of items) item.dist = v3.length(item.obj.pos);
    items.sort((a, b) => a.dist - b.dist);
    return items;
  }

  function buildMap() {
    if (!mapListEl) return;
    mapListEl.textContent = "";
    const items = mapDestinations();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "map-empty";
      empty.textContent = "No catalogued destinations in range.";
      mapListEl.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "map-row";
      if (state.waypoint && state.waypoint.obj === item.obj) row.classList.add("current");
      const name = document.createElement("span");
      name.className = "m-name";
      name.textContent = item.name;
      const kind = document.createElement("span");
      kind.className = "m-kind";
      kind.textContent = item.kind;
      const dist = document.createElement("span");
      dist.className = "m-dist";
      dist.textContent = SF.hud.formatDistance(item.dist);
      const meta = document.createElement("span");
      meta.className = "m-meta";
      meta.append(name, kind);
      row.append(meta, dist);
      row.addEventListener("click", () => {
        state.waypoint = { obj: item.obj, name: item.name };
        closeMap();
      });
      mapListEl.appendChild(row);
    }
  }

  function openMap() {
    if (!state.running || !mapEl) return;
    buildMap();
    mapEl.hidden = false;
    state.paused = true;
    pauseEl.hidden = true;      // the chart is the overlay; no pause card behind it
  }

  function closeMap() {
    if (!mapEl) return;
    mapEl.hidden = true;
    state.paused = false;
    last = performance.now();
  }

  function toggleMap() {
    if (mapEl && mapEl.hidden === false) closeMap();
    else openMap();
  }

  restartButton.addEventListener("click", restart);
  document.getElementById("resume")?.addEventListener("click", togglePause);
  document.getElementById("ledger-close")?.addEventListener("click", () => { ledgerEl.hidden = true; });
  document.getElementById("ledger-open")?.addEventListener("click", () => {
    ledgerEl.hidden = false;
    if (!state.paused) togglePause();
  });
  document.getElementById("map-open")?.addEventListener("click", openMap);
  document.getElementById("map-close")?.addEventListener("click", closeMap);
  document.getElementById("map-clear")?.addEventListener("click", () => {
    state.waypoint = null;
    buildMap();
  });
  document.getElementById("sound")?.addEventListener("click", () => {
    SF.hud.setSoundLabel(SF.audio.toggle());
  });
  addEventListener("resize", () => SF.render.resize());

  /* ── gravity ─────────────────────────────────────────────────────────
     The ship sits at the origin and the world moves around it, so a body's
     stored position *is* the vector from you to it. Summing GM/r² over
     everything nearby is therefore about as direct as this gets.

     Mass comes from what each body already knew about itself: stars carry a
     main-sequence mass, black holes carry theirs in solar masses, and a
     planet's follows from its radius by the usual rocky/giant scaling. The
     only invented number is the surface-gravity constant, which is in the
     ledger.                                                               */

  /** Effective GM in gravities·ly², from whatever the body is. */
  function bodyGM(body) {
    if (body.gmCache !== undefined) return body.gmCache;
    let solarMasses = 0;
    if (body.kind === "star") {
      solarMasses = body.system?.star?.mass ?? 1;
    } else if (body.kind === "blackhole") {
      solarMasses = body.massSolar || 10;
    } else if (body.kind === "planet") {
      // M/M⊕ ≈ (R/R⊕)^3.7 for rocky worlds, flattening for giants that are
      // mostly envelope. Earth masses → solar at 1/333,000.
      const r = Math.max(0.05, body.radiusEarth || 1);
      const earthMasses = r > 4 ? 8 * Math.pow(r / 4, 2.0) : Math.pow(r, 3.7);
      solarMasses = earthMasses / 333000;
    } else {
      return (body.gmCache = 0);       // moons and comets pull on nothing
    }
    // GM_eff = surfaceG · R_drawn², anchored on a 1 R☉ star. Scaling by mass
    // keeps the *ratios* between bodies real even though the constant is not.
    const refR = F.starRadiusLy;       // 1 R☉ as drawn
    return (body.gmCache = F.gravitySurfaceG * refR * refR * solarMasses);
  }

  /**
   * Net gravitational acceleration on the ship, in gravities, world frame.
   * Also records the distance to the nearest system, which is what the clock
   * uses to decide whether to calm down.
   */
  function gravityField() {
    let gx = 0, gy = 0, gz = 0;
    let nearest = Infinity;
    for (const system of systems) {
      // One cheap rejection per system before touching its bodies.
      const sp = system.pos;
      const sd = Math.hypot(sp.x, sp.y, sp.z);
      if (sd < nearest) nearest = sd;
      if (sd > GRAVITY_REACH_LY) continue;
      for (const body of system.bodies) {
        const gm = bodyGM(body);
        if (gm <= 0) continue;
        const p = body.p;
        const r2 = p.x * p.x + p.y * p.y + p.z * p.z;
        // Floor at the body's own radius: inside it the point-mass formula
        // diverges, and you are having a different problem by then anyway.
        const min = Math.max(1e-9, body.radiusLy * body.radiusLy);
        const rr = Math.max(r2, min);
        const r = Math.sqrt(rr);
        const mag = Math.min(F.gravityMaxG, gm / rr);
        gx += (p.x / r) * mag; gy += (p.y / r) * mag; gz += (p.z / r) * mag;
      }
    }
    state.nearestSystemLy = nearest;
    state.gravityG = Math.hypot(gx, gy, gz);
    return { x: gx, y: gy, z: gz };
  }

  /* ── speed relative to something real ────────────────────────────────
     "Speed" on its own is meaningless and the panel was quietly lying by
     omission: it quotes β, which is measured against the Sun's rest frame,
     so parking perfectly alongside a planet still read as a large number
     and matching orbits looked like nothing had happened.

     This measures the only speed a pilot actually wants: yours relative to
     the nearest large body. It comes from differencing that body's stored
     position, which is already relative to the ship, so it picks up both
     your motion and the body's own orbital motion for free — and it reads
     exactly zero when you are station-keeping with a world.               */

  let relRef = null;                 // the body we are quoting against
  const relPrev = { x: 0, y: 0, z: 0 };

  function updateRelativeSpeed(dHomeYears) {
    let best = null, bestD = Infinity;
    for (const system of systems) {
      // Cheap reject: nothing in a distant system can be the nearest body.
      const sd = Math.hypot(system.pos.x, system.pos.y, system.pos.z);
      if (sd - (F.orbitMaxLy + 1) > bestD) continue;
      for (const body of system.bodies) {
        if (body.kind === "moon" || body.kind === "comet") continue;
        const d = Math.hypot(body.p.x, body.p.y, body.p.z);
        if (d < bestD) { bestD = d; best = body; }
      }
    }

    state.relBody = best;
    state.relName = best ? (best.name || best.label || best.system?.name || "nearest body") : null;
    state.relDistLy = best ? bestD : Infinity;

    if (!best) { state.relSpeedC = 0; state.relClosingC = 0; return; }
    // A different body, or no elapsed time: seed and wait for the next frame
    // rather than reporting a difference against something else's position.
    if (relRef !== best || !(dHomeYears > 0)) {
      relRef = best;
      relPrev.x = best.p.x; relPrev.y = best.p.y; relPrev.z = best.p.z;
      state.relSpeedC = 0; state.relClosingC = 0;
      return;
    }
    const dx = best.p.x - relPrev.x, dy = best.p.y - relPrev.y, dz = best.p.z - relPrev.z;
    const prevDist = Math.hypot(relPrev.x, relPrev.y, relPrev.z);
    relPrev.x = best.p.x; relPrev.y = best.p.y; relPrev.z = best.p.z;

    // Closing rate is a *coordinate* rate — how fast the gap shrinks in the
    // home frame — and those are allowed to exceed c. Two ships approaching
    // head-on at 0.9c close at 1.8c and no physics is harmed.
    state.relClosingC = (prevDist - bestD) / dHomeYears;

    // RELATIVE SPEED IS NOT THAT. Differencing the position gave the
    // coordinate rate and printed "1877% of light", which is not a speed
    // anybody can have. What a pilot means by "my speed relative to that
    // planet" is the speed measured in the planet's own rest frame, and that
    // needs the relativistic composition:
    //
    //   v_rel = √( |u − v|² − |u × v|² ) / (1 − u·v)
    //
    // which is < c whenever both are, and reduces to |u − v| at low speed.
    const w = { x: dx / dHomeYears, y: dy / dHomeYears, z: dz / dHomeYears };
    const vs = { x: vdir.x * state.beta, y: vdir.y * state.beta, z: vdir.z * state.beta };
    // p is stored relative to the ship, so ẇ = v_body − v_ship.
    let vb = { x: w.x + vs.x, y: w.y + vs.y, z: w.z + vs.z };
    // The inflated orbital geometry can hand us a body moving faster than
    // light; clamp it rather than let it poison the formula. Flagged so the
    // HUD can admit the number is the geometry's fault, not the pilot's.
    const vbMag = Math.hypot(vb.x, vb.y, vb.z);
    state.relBodySuperluminal = vbMag >= 1;
    if (vbMag >= 0.999999) {
      const k = 0.999999 / vbMag;
      vb = { x: vb.x * k, y: vb.y * k, z: vb.z * k };
    }

    const diff = { x: vs.x - vb.x, y: vs.y - vb.y, z: vs.z - vb.z };
    const cross = {
      x: vs.y * vb.z - vs.z * vb.y,
      y: vs.z * vb.x - vs.x * vb.z,
      z: vs.x * vb.y - vs.y * vb.x,
    };
    const dot = vs.x * vb.x + vs.y * vb.y + vs.z * vb.z;
    const num = Math.max(0, v3.dot(diff, diff) - v3.dot(cross, cross));
    state.relSpeedC = Math.min(0.999999999, Math.sqrt(num) / Math.max(1e-9, 1 - dot));
  }

  /* ── physics ────────────────────────────────────────────────────────── */

  function stepEngine(dt) {
    // The stick is eased rather than applied raw so a tap is a nudge and the
    // drive feels like it has mass. The nose axis (thrustCmd.z) is the pedal:
    // +1 is the accelerator, −1 the brake. The other axes only aim.
    const stick = state.running ? translationStick() : { x: 0, y: 0, z: 0 };
    const ease = Math.min(1, dt * 6);
    thrustCmd.x += (Math.max(-1, Math.min(1, stick.x)) - thrustCmd.x) * ease;
    thrustCmd.y += (Math.max(-1, Math.min(1, stick.y)) - thrustCmd.y) * ease;
    thrustCmd.z += (Math.max(-1, Math.min(1, stick.z)) - thrustCmd.z) * ease;

    // The pilot's clock is honest: one real second is one ship second.
    const dTau = F.shipYearsPerSecond * dt;
    state.shipYears += dTau;

    // ── the gearbox ────────────────────────────────────────────────────
    // Space here is inflated to light-year scale — even the nearest body in a
    // system sits a couple of ly off — so at honest lightspeed it is a two-year
    // trip and every playable speed above gear 1 is faster than light. The
    // drive is that declared cheat, measured in ly per REAL second.
    //
    // IT BEHAVES LIKE A CAR. Speed is signed and it PERSISTS: the accelerator
    // climbs toward the gear's ceiling, the brake walks it back down through
    // zero and on into reverse, and letting go of both holds whatever speed you
    // have. Acceleration is the gear's ceiling divided by its ramp time, so the
    // gear you are in is the resolution you have. Travel always follows the
    // nose, so turning steers — including in reverse, where you back away from
    // wherever the crosshair is pointing.
    const gi = Math.max(0, Math.min(F.gears.length - 1, (state.gear | 0) - 1));
    const gear = F.gears[gi];
    const top = Math.min(F.warpMaxLySec, gear.topLySec);
    const floor = -top * F.reverseFraction;
    const pedal = Math.max(-1, Math.min(1, thrustCmd.z));
    const braking = state.running && CTRL.down("killVel");
    const boost = CTRL.down("boost") ? 2 : 1;
    state.throttle = pedal;
    state.throttleTarget = pedal;

    const prevLySec = state.warpLySec;
    if (braking) {
      // Kill velocity is the one autopilot: it brings you to a dead stop from
      // either direction and holds there. It does not run on into reverse, and
      // it lands exactly on zero — an exponential decay never quite does.
      const rate = (top / gear.ramp) * F.brakeBoost * dt;
      state.warpLySec = state.warpLySec > 0
        ? Math.max(0, state.warpLySec - rate)
        : Math.min(0, state.warpLySec + rate);
    } else if (Math.abs(pedal) > 0.02) {
      const rate = (top / gear.ramp) * pedal * boost;
      state.warpLySec = Math.max(floor, Math.min(top, state.warpLySec + rate * dt));
    }
    // Otherwise: coast. Nothing bleeds the speed away — releasing the pedal is
    // how you hold a speed, which is why the old speed lock is gone.

    // A downshift while running faster than the new gear brakes you back to its
    // ceiling rather than snapping. The ease is geometric, because the gears
    // span twelve orders of magnitude: shedding a factor of 10¹² per second
    // means gear 6 → gear 1 settles in the same couple of seconds as 3 → 2.
    const over = Math.abs(state.warpLySec);
    const ceiling = state.warpLySec < 0 ? -floor : top;
    if (over > ceiling && ceiling > 0) {
      const k = Math.exp(-dt / F.downshiftSeconds);
      const eased = ceiling * Math.pow(over / ceiling, k);
      state.warpLySec = Math.sign(state.warpLySec) * Math.max(ceiling, eased);
    }

    // Steer with the nose: no velocity vector to swing, so the whole sky wheels
    // to stream past wherever you point.
    const nose = SF.camera.forward;
    vdir = { x: nose.x, y: nose.y, z: nose.z };

    // Honest felt g-force: the proper acceleration an accelerometer bolted to
    // the ship would read for this frame's change of speed — Δv in m/s over dt,
    // in gravities. In the high gears it is openly millions of g. That is the
    // whole bargain: the drive cheats, the readout does not.
    const dvMS = Math.abs(state.warpLySec - prevLySec) * K.lyM;
    state.feltG = dt > 1e-6 ? dvMS / (dt * K.g0) : 0;

    // The two clocks stay honest. Below lightspeed the ship reads a real β and
    // γ, its clock falls behind home, and the sky aberrates — the signature
    // relativistic show. At and above c it is an openly faster-than-light
    // bubble: nothing aberrates and the clocks agree, exactly as an Alcubierre
    // warp (locally at rest) would behave. Given the scale you cross c almost
    // at once, so the honest regime is a bright sliver at the very bottom of
    // the throttle rather than a place you live.
    const cLySec = F.shipYearsPerSecond;              // c expressed in ly/s
    const dHome = state.warpLySec * dt;               // ly this frame, real secs
    // Direction is carried by vdir and by the sign of dHome; β is a magnitude,
    // so everything relativistic reads the speed, not the signed velocity.
    const speed = Math.abs(state.warpLySec);
    if (speed > 1e-30 && speed < cLySec) {
      const beta = speed / cLySec;
      state.relativistic = true;
      state.bubble = false;
      state.beta = beta;
      state.gamma = 1 / Math.sqrt(1 - beta * beta);
      state.eta = Math.atanh(Math.min(0.999999999, beta));
      state.homeYears += state.gamma * dTau;
    } else {
      state.relativistic = false;
      state.bubble = speed > 0;
      state.beta = 0; state.gamma = 1; state.eta = 0;
      state.homeYears += dTau;
    }
    // The odometer is path length, so backing up does not un-travel the trip.
    state.distanceLy += Math.abs(dHome);
    return dHome;
  }

  /* ── the two walls ──────────────────────────────────────────────────── */

  function applyEnvironment(dt) {
    // The Local Bubble: a real ~300 ly cavity blown around the Sun by
    // ancient supernovae, twenty times thinner than the galactic average.
    // The first three hundred light-years are genuinely, physically safer.
    state.ismDensity = state.distanceLy < K.localBubbleLy
      ? K.ismLocalBubble
      : K.ismGalactic * (milkyWay ? Math.max(0.05, Math.min(2.2, SF.galaxy.localDensity(milkyWay))) : 1);

    if (state.bubble) {
      state.ismWattsPerM2 = 0;
      state.cmbForwardK = K.tCMB;
      state.hull = Math.min(1, state.hull + dt * 0.05);
      return;
    }

    state.ismWattsPerM2 = SF.rel.ismPowerPerM2(state.ismDensity, state.beta, state.gamma);
    state.cmbForwardK = SF.rel.cmbTemperature(1, state.beta, state.gamma);

    const ismDamage = state.ismWattsPerM2 / HULL_ISM_CAPACITY;
    const cmbFlux = K.sigmaSB * Math.pow(state.cmbForwardK, 4);
    const cmbDamage = cmbFlux / HULL_CMB_CAPACITY;
    const total = ismDamage + cmbDamage;

    if (total < 0.004) {
      state.hull = Math.min(1, state.hull + dt * 0.03);
    } else {
      state.hull -= total * dt;
    }

    if (state.hull <= 0 && state.running) {
      state.hull = 0;
      crash({ type: cmbDamage > ismDamage ? "cmb" : "ism" });
    }
  }

  function checkMilestones() {
    const list = window.SF_MILESTONES || [];
    while (state.milestoneIndex < list.length
      && state.distanceLy >= list[state.milestoneIndex].ly) {
      const milestone = list[state.milestoneIndex];
      state.milestoneIndex += 1;
      SF.hud.announce(milestone);
      SF.audio.blip(520 + state.milestoneIndex * 24, 0.5, "sine", 0.06);
      if (milestone.mark === "horizon" || milestone.mark === "end") {
        crash({ type: "horizon" });
        return;
      }
    }
  }

  /* ── world update ───────────────────────────────────────────────────── */

  function advanceWorld(dHome, dHomeYears) {
    // WHICH WAY IS "AHEAD" IS THE SIGN OF dHome, not the nose. In reverse the
    // ship is travelling backwards along the nose, so the space that needs
    // populating — and the space it is safe to recycle out of — swap over. Get
    // this wrong and backing up empties the sky you are reversing into.
    const s = dHome < 0 ? -1 : 1;
    const travel = { x: vdir.x * s, y: vdir.y * s, z: vdir.z * s };

    // The background sky moves too. It is the layer that carries the sense of
    // motion — the catalogued systems are sparse, and between them there was
    // previously nothing on screen that changed at all.
    SF.render.stepSkyField(skyField, vdir, dHome);

    for (let i = systems.length - 1; i >= 0; i -= 1) {
      const system = systems[i];
      SF.systems.translate(system, vdir, dHome);
      if (system.hole) SF.blackhole.advance(system.hole, dHomeYears);
      SF.systems.layout(system, dHomeYears);

      // Real catalogued stars are the fixed furniture of the neighbourhood —
      // fly past one, turn around, and it must still be exactly where it was.
      // Only the procedural fly-by systems get recycled once behind you.
      if (system.catalogue) continue;
      const along = v3.dot(system.pos, travel);
      const distance = v3.length(system.pos);
      if (along < 0 && distance > Math.max(6, system.radiusLy * 40)) {
        systems.splice(i, 1);
      }
    }

    for (let i = galaxies.length - 1; i >= 0; i -= 1) {
      const galaxy = galaxies[i];
      SF.galaxy.translate(galaxy, vdir, dHome);
      const measure = SF.galaxy.measure(galaxy);
      galaxy.lastMeasure = measure;
      if (measure.stage === "inside" || measure.stage === "resolved") galaxy.entered = true;
      // Recycled only once it has been entered and left behind — never
      // because a raw distance threshold tripped.
      if (!galaxy.permanent && galaxy.entered
        && v3.dot(galaxy.pos, travel) < 0 && measure.distanceLy > galaxy.diameterLy * 6) {
        galaxies[i] = spawnFieldGalaxy();
      }
    }

    // Every position for this frame has settled, so the relative-speed
    // readout can be differenced against last frame's snapshot.
    updateRelativeSpeed(dHomeYears);

    // Spawning. The gap is real and Poisson; where it lands is the cheat.
    const spawnAhead = Math.max(
      F.spawnAheadLy,
      Math.min(F.spawnAheadLy * state.gamma, Math.max(F.spawnAheadMaxLy, Math.abs(dHome) * 10)),
    );
    let guard = 0;
    while (state.distanceLy >= nextSystemAt && guard < 60) {
      guard += 1;
      nextSystemAt += SF.systems.nextGapLy();
      if (systems.filter((s) => !s.catalogue).length >= F.maxSystems) continue;
      const offset = SF.systems.corridorOffset(travel);
      systems.push(SF.systems.create({
        pos: {
          x: travel.x * spawnAhead + offset.x,
          y: travel.y * spawnAhead + offset.y,
          z: travel.z * spawnAhead + offset.z,
        },
      }));
    }

    // How thick the star field is here. Leaving the disk empties the sky.
    state.density = milkyWay
      ? Math.max(0.015, Math.min(1.8, SF.galaxy.localDensity(milkyWay)))
      : 1;
  }

  /* ── collision ──────────────────────────────────────────────────────── */

  function collide() {
    if (!state.running) return;
    for (const system of systems) {
      for (const body of system.bodies) {
        const p = body.p;
        const along = p.x * vdir.x + p.y * vdir.y + p.z * vdir.z;
        const previous = body.prevAlong;
        body.prevAlong = along;
        // Closest approach is where `along` crosses zero — IN EITHER
        // DIRECTION. Testing only for front-to-back meant that in reverse the
        // bodies crossed the other way and you could back straight through a
        // planet without the game noticing.
        if (previous === undefined) continue;
        const crossed = (previous > 0 && along <= 0) || (previous < 0 && along >= 0);
        if (!crossed) continue;

        // Closest approach happens as `along` crosses zero, so the miss
        // distance is just the perpendicular component there.
        const distance2 = p.x * p.x + p.y * p.y + p.z * p.z;
        const perp = Math.sqrt(Math.max(0, distance2 - along * along));
        if (perp < body.radiusLy) {
          crash({ type: "impact", body });
          return;
        }
        if (perp < body.radiusLy * 3.4 && body.radiusLy > F.cometRadiusLy) {
          nearMiss(body, perp / body.radiusLy);
        }
      }
    }
  }

  function nearMiss(body, ratio) {
    const intensity = Math.max(0.15, 1 - (ratio - 1) / 2.4);
    if (!reducedMotion) {
      SF.camera.kick(
        (Math.random() - 0.5) * 0.05 * intensity,
        (Math.random() - 0.5) * 0.05 * intensity,
        (Math.random() - 0.5) * 0.09 * intensity,
      );
    }
    SF.audio.whoosh(intensity);
    void body;
  }

  function crash(cause) {
    if (!state.running) return;
    state.running = false;
    state.flash = cause.type === "impact" || cause.type === "cmb" ? 1 : 0.55;
    // At relativistic speed the honest version of a collision flash is a
    // gamma-ray burst, not a red one.
    state.flashColour = "255,255,255";
    if (!reducedMotion) {
      SF.camera.kick(
        (Math.random() - 0.5) * 0.55,
        (Math.random() - 0.5) * 0.55,
        (Math.random() - 0.5) * 0.8,
      );
    }
    SF.audio.blip(74, 1.4, "sawtooth", 0.16);
    SF.audio.stop();

    const message = SF.hud.describeDeath(cause, state);
    // Let the flash and the shake land before the modal takes the screen.
    setTimeout(() => {
      lossCode.textContent = message.code;
      lossTitle.textContent = message.title;
      lossDetail.textContent = message.detail;
      gameOverEl.hidden = false;
      restartButton.focus();
    }, reducedMotion ? 0 : 420);
  }

  /* ── drawing ────────────────────────────────────────────────────────── */

  function collectLenses() {
    const lenses = [];
    for (const system of systems) {
      if (!system.hole) continue;
      const p = SF.view.project(system.hole.p, system.hole.radiusLy);
      if (!p || p.r < 3) continue;
      lenses.push({ x: p.x, y: p.y, shadow: p.r, einstein: SF.blackhole.einsteinRadiusPx(p.r) });
      if (lenses.length >= 2) break;
    }
    return lenses;
  }

  function drawFrame(now) {
    const ctx = SF.render.ctx;
    SF.render.beginFrame();
    SF.render.drawCMB(state);

    const lenses = collectLenses();
    SF.render.drawSkyField(skyField, state, now, lenses.length ? lenses : null);

    // Galaxies, far to near.
    const visible = galaxies
      .map((galaxy) => ({ galaxy, measure: galaxy.lastMeasure || SF.galaxy.measure(galaxy) }))
      .sort((a, b) => b.measure.distanceLy - a.measure.distanceLy);
    for (const item of visible) SF.render.drawGalaxy(item.galaxy, item.measure);

    // Bodies, far to near. This is the depth sort the original never had:
    // it walked the array while z varied freely inside a system, so a
    // distant moon could paint on top of a near planet.
    const drawable = [];
    for (const system of systems) {
      for (const body of system.bodies) {
        const p = SF.view.project(body.p, body.radiusLy);
        if (!p) continue;
        const bound = Math.max(p.r * 2.6, 24);
        if (p.x < -bound || p.x > SF.render.W + bound
          || p.y < -bound || p.y > SF.render.H + bound) continue;
        drawable.push({ body, p, system });
      }
    }
    drawable.sort((a, b) => b.p.dist - a.p.dist);

    for (const item of drawable) {
      const { body, p, system } = item;
      if (body.kind === "star") {
        SF.render.drawStar(body, p);
      } else if (body.kind === "blackhole") {
        SF.render.drawBlackHole(body, p);
      } else if (body.kind === "comet") {
        SF.render.drawComet(body, p, system.starScreen);
      } else {
        SF.render.drawPlanet(body, p, system.starScreen, system.star && system.star.p);
      }
      if (body.kind === "star" || body.kind === "blackhole") system.starScreen = p;
    }

    drawLabels(drawable);

    if (state.bubble) SF.render.drawBubble(now);
    SF.render.drawReticle(state);
    if (state.waypoint && state.running) {
      SF.render.drawWaypoint(state.waypoint.name, state.waypoint.obj.pos);
    }

    if (state.flash > 0.002) {
      SF.render.flash(state.flash * (reducedMotion ? 0.35 : 1), `rgb(${state.flashColour})`);
    }
    void ctx;
  }

  function drawLabels(drawable) {
    const cx = SF.camera.cx, cy = SF.camera.cy;
    const reach = Math.min(SF.render.W, SF.render.H) * 0.44;
    let drawn = 0;
    for (const item of drawable) {
      if (drawn >= 5) break;
      const { body, p, system } = item;
      if (!system.name || (body.kind !== "star" && body.kind !== "blackhole")) continue;
      if (Math.hypot(p.x - cx, p.y - cy) > reach) continue;
      const near = Math.max(0, Math.min(1, 1 - (p.dist - 1) / 26));
      if (near < 0.05) continue;
      const sub = body.kind === "blackhole"
        ? `${p.dist.toFixed(2)} ly · ${body.massSolar >= 1e5 ? `${(body.massSolar / 1e6).toFixed(1)}e6` : body.massSolar.toFixed(1)} M☉`
        : `${p.dist.toFixed(2)} ly · ${system.star.type}`;
      SF.render.drawLabel(system.name, sub, p.x, p.y, near * 0.9);
      drawn += 1;
    }
    for (const galaxy of galaxies) {
      // galaxy.screen is this frame's projection or null — render.drawGalaxy
      // clears it on every path that does not draw. A label with no projection
      // behind it is the "Andromeda still on screen after you turned away" bug.
      if (!galaxy.name || !galaxy.screen) continue;
      if (galaxy.screen.r < 12) continue;
      // And it has to actually be on the canvas: a projection can land well
      // outside it, and a label pinned off-screen is just a lie about geometry.
      if (galaxy.screen.x < 0 || galaxy.screen.x > SF.render.W
        || galaxy.screen.y < 0 || galaxy.screen.y > SF.render.H) continue;
      if (Math.hypot(galaxy.screen.x - cx, galaxy.screen.y - cy) > reach * 1.4) continue;
      SF.render.drawLabel(
        galaxy.name,
        SF.hud.formatDistance(galaxy.screen.distanceLy),
        galaxy.screen.x, galaxy.screen.y, 0.55, "rgba(206,196,255,",
      );
    }
  }

  /* ── the loop ───────────────────────────────────────────────────────── */

  function frame(now) {
    requestAnimationFrame(frame);
    // Clamped at both ends. The upper bound stops a tab that was backgrounded
    // for a minute from integrating one enormous step; the lower bound is
    // because a NEGATIVE dt — which a hand-driven clock or a clock adjustment
    // can produce — runs the basis re-orthonormalisation backwards and poisons
    // every position in the world with NaN in a single frame.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0.016));
    last = now;

    if (state.paused) return;

    const stick = state.running ? rotationStick() : { x: 0, y: 0, roll: 0 };
    SF.camera.steer(stick.x, stick.y, stick.roll, dt);
    SF.camera.decayKick(dt);
    SF.camera.rebuild();

    let dHome = 0, dHomeYears = 0;
    if (state.running) {
      const before = state.homeYears;
      dHome = stepEngine(dt);
      dHomeYears = state.homeYears - before;
    } else {
      // Drift to a halt after a crash, so the wreck still carries a little of
      // whatever it was doing. Off the drive's own speed, not off β, because in
      // a faster-than-light gear β is zero and the wreck used to stop dead.
      state.warpLySec *= Math.max(0, 1 - dt * 1.6);
      dHome = state.warpLySec * dt * 0.2;
      state.beta *= Math.max(0, 1 - dt * 1.6);
    }

    // Aberration is centred on the direction of TRAVEL, not on the nose, so in
    // reverse the sky crushes toward the place you are backing into — and the
    // heading marker, which reads view.forward, follows it there.
    const vsign = state.warpLySec < 0 ? -1 : 1;
    SF.view.setState(
      state.beta, state.gamma,
      { x: vdir.x * vsign, y: vdir.y * vsign, z: vdir.z * vsign },
      state.relativistic,
    );

    if (state.running) {
      applyEnvironment(dt);
      checkMilestones();
    }
    advanceWorld(dHome, dHomeYears);
    // No collisions inside the lightspeed bubble — you pass through normal
    // space, which is the only thing that makes a jump survivable.
    if (state.running && !state.bubble) collide();

    // No speed banner. How fast you are going is meant to be read off the sky
    // itself — the stars crushing forward into a cone, the Doppler colours, the
    // two clocks pulling apart — not off a label. The overlay is gone.

    state.flash *= Math.exp(-3.4 * dt);
    drawFrame(now);
    SF.hud.update(state);
    SF.audio.update(
      state.gamma,
      Math.min(1, Math.abs(state.throttle) / 3),
      Math.min(1, state.ismWattsPerM2 / 4e7),
    );
  }

  /* ── go ─────────────────────────────────────────────────────────────── */

  CTRL.init();
  SF.bindings?.init();
  SF.render.init(canvas);
  SF.hud.init();
  skyField = SF.render.makeSkyField(reducedMotion ? 1500 : 3200);
  restart();
  requestAnimationFrame(frame);
})();
