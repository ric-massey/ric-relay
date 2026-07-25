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
    bubbleFade: 0,  // 0…1, the bubble wall crossfading in and out with it
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
    // How fast YOU are moving toward it, and what share of your speed that is.
    relClosingLySec: 0, relClosingFrac: 0,
  };
  SF.state = state;

  const CTRL = SF.controls;

  // THE SHIP'S ACTUAL STATE OF MOTION is this velocity vector, in the home
  // frame, in light-years per second of ship time (celerity — see the drive).
  // β, γ and the heading are all read off it; nothing else is authoritative,
  // and NOTHING outside the drive is allowed to rotate it, because that is
  // what momentum means. `vdir` is the unit heading, kept separately because a
  // dozen places want a direction and it has to hold its last value when the
  // ship comes to a complete stop.
  let vel = { x: 0, y: 0, z: 0 };
  let vdir = { x: 0, y: 0, z: 1 };
  // Thruster command in body axes, smoothed toward the stick so the engines
  // spool rather than snap. x = right, y = up, z = forward, in gravities.
  let thrustCmd = { x: 0, y: 0, z: 0 };

  const systems = [];
  const galaxies = [];
  // Exposed so the scene can be inspected from a console — handy when the
  // thing you want to look at is a black hole 1,560 light-years away.
  SF.world = { systems, galaxies, heading: () => vdir, velocity: () => vel };
  let skyField = null;
  let milkyWay = null;
  let nextSystemAt = 0;
  // The raw disk density at the launch point, so state.density can be quoted
  // as a multiple of the sky you started under rather than of the galactic
  // centre. Set once the world exists and the ship is still at the Sun.
  let skyDensityNorm = 1;
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
    state.bubbleFade = 0;
    state.warpLySec = 0;
    state.gear = 1;
    state.feltG = 0;
    state.relativistic = true;
    state.milestoneIndex = 0;
    state.flash = 0;
    vel = { x: 0, y: 0, z: 0 };
    thrustCmd = { x: 0, y: 0, z: 0 };
    joyX = 0; joyY = 0; joyActive = false;
    pointerThrust = 0;
    state.waypoint = null;
    if (mapEl) mapEl.hidden = true;

    systems.length = 0;
    galaxies.length = 0;
    SF.camera.reset();
    // No crossfade out of a dead ship's last frame — a relaunch starts flat.
    SF.view.reset();

    seedCatalogue();
    seedDeepSky();
    skyDensityNorm = milkyWay
      ? 1 / Math.max(1e-6, SF.galaxy.localDensity(milkyWay))
      : 1;

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

  /* ── are you closing on it? ──────────────────────────────────────────
     "Speed" on its own is meaningless, and the panel used to answer the
     wrong question. It quoted your speed relative to the nearest body
     INCLUDING that body's own orbital motion, so a ship sitting perfectly
     still read 88 km/s just because the planet it was watching was going
     round its star. At a standstill every speed on the panel should be zero,
     because you are not moving.

     So this reports the one number a pilot can act on: how fast YOU are
     travelling toward the nearest body, which is your own velocity projected
     onto the line of sight. Zero when you are parked, positive when you are
     closing, negative when you are pulling away, and it does not pretend to
     know what the planet is doing.                                        */

  function updateRelativeSpeed() {
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

    const speed = v3.length(vel);
    if (!best || bestD < 1e-12 || speed < 1e-30) {
      state.relClosingLySec = 0;
      state.relClosingFrac = 0;
      return;
    }
    // Body positions are already stored relative to the ship, so the unit
    // vector to it is the line of sight and the dot product is the closing
    // component of the ship's own velocity.
    const closing = (vel.x * best.p.x + vel.y * best.p.y + vel.z * best.p.z) / bestD;
    state.relClosingLySec = closing;
    // What fraction of the ship's speed is aimed at it — lets the HUD quote
    // the closing rate in the same honest units as the main speed readout.
    state.relClosingFrac = closing / speed;
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

    // ── the drive ──────────────────────────────────────────────────────
    // THE SHIP HAS MOMENTUM. `vel` is a real velocity VECTOR in the home frame
    // and it is the only thing that moves the world. Thrust adds to it along
    // the nose; nothing bleeds it away; turning the ship turns the NOSE and
    // nothing else. So you can point the camera anywhere while coasting at
    // speed, and the gap between the crosshair and the green heading marker is
    // the difference between where you are aimed and where you are going.
    //
    // A GEAR IS AN ACCELERATION, NOT A SPEED. Shifting never changes how fast
    // you are moving — it changes how hard the engine pushes (top ÷ ramp) and
    // how fast it is allowed to push you to. Drop into a low gear at speed and
    // you keep every bit of that speed; the engine simply stops being able to
    // add more. Kill velocity is the way out of that, and it works from any
    // speed at all.
    //
    // THE UNIT IS CELERITY: home light-years per second of YOUR life, not per
    // second of home time. That is the honest quantity for a rocket and it is
    // the one that matters to a pilot — at γ = 7 the distance ahead is
    // contracted sevenfold, so you cover seven light-years of home distance per
    // year you actually live through. It is why gear 2, capped at 99% of light,
    // crosses a solar system in about a minute instead of eight hours, and no
    // part of that is a cheat:
    //
    //     u = |vel| / c   (proper velocity, γβ)     β = u/√(1+u²)     γ = √(1+u²)
    //
    // β from that is always below 1, however hard you push — which is exactly
    // the point. Gears 3–6 abandon it and declare themselves faster-than-light.
    const gi = Math.max(0, Math.min(F.gears.length - 1, (state.gear | 0) - 1));
    const gear = F.gears[gi];
    const top = Math.min(F.warpMaxLySec, gear.topLySec);
    const pedal = Math.max(-1, Math.min(1, thrustCmd.z));
    const braking = state.running && CTRL.down("killVel");
    const boost = CTRL.down("boost") ? 2 : 1;
    state.throttle = pedal;
    state.throttleTarget = pedal;

    const before = { x: vel.x, y: vel.y, z: vel.z };
    const speedBefore = v3.length(vel);

    if (braking) {
      // The one autopilot, and the only thing that can rescue you from a speed
      // your current gear could never have produced. Geometric, so it works
      // from a thousand light-years a second as readily as from walking pace.
      const k = Math.exp(-dt / F.brakeSeconds);
      vel.x *= k; vel.y *= k; vel.z *= k;
      if (v3.length(vel) < top * 1e-6) { vel.x = 0; vel.y = 0; vel.z = 0; }
    } else if (Math.abs(pedal) > 0.02) {
      // W pushes your momentum the way the nose is pointing; S pushes it back
      // the other way. Fly forwards, spin round, and S is now an accelerator —
      // that is not a bug, it is what a thruster does.
      const nose = SF.camera.forward;
      const a = (top / gear.ramp) * pedal * boost * dt;
      vel.x += nose.x * a; vel.y += nose.y * a; vel.z += nose.z * a;

      // The ceiling caps what the ENGINE can add, never what you already have.
      // Turning at speed keeps |vel| unchanged and is always allowed.
      const speedAfter = v3.length(vel);
      const allowed = Math.max(top, speedBefore);
      if (speedAfter > allowed && speedAfter > 0) {
        const k = allowed / speedAfter;
        vel.x *= k; vel.y *= k; vel.z *= k;
      }
    }
    // Otherwise: coast. Momentum is conserved because nothing is acting on you.

    const speed = v3.length(vel);
    if (speed > 1e-30) vdir = { x: vel.x / speed, y: vel.y / speed, z: vel.z / speed };
    // At a dead stop vdir keeps its last value: there is no heading, but the
    // renderer still needs an axis and the last one you travelled is the honest
    // answer to "which way were you going".

    // Honest felt g-force: the proper acceleration an accelerometer bolted to
    // the ship would read for this frame's change of velocity — the magnitude
    // of the VECTOR change, so turning your velocity costs g just as speeding
    // up does. In the faster-than-light gears it is openly millions of g. That
    // is the whole bargain: the drive cheats, the readout does not.
    const dvMS = Math.hypot(vel.x - before.x, vel.y - before.y, vel.z - before.z) * K.lyM;
    state.feltG = dt > 1e-6 ? dvMS / (dt * K.g0) : 0;

    const cLySec = F.shipYearsPerSecond;              // c expressed in ly/s
    const dHome = speed * dt;                         // home ly this frame
    state.warpLySec = speed;                          // what the HUD quotes

    if (gear.honest) {
      // Real relativity. |vel| is celerity, so β stays under 1 no matter how
      // hard you push, γ climbs without limit, and the clocks split honestly.
      const u = speed / cLySec;
      const gamma = Math.sqrt(1 + u * u);
      state.relativistic = true;
      state.bubble = false;
      state.beta = u / gamma;
      state.gamma = gamma;
      state.eta = Math.asinh(u);                      // rapidity, exactly
      state.homeYears += gamma * dTau;
    } else {
      // The declared cheat: locally at rest in a bubble, so nothing aberrates
      // and the two clocks agree.
      state.relativistic = false;
      state.bubble = speed > 0;
      state.beta = 0; state.gamma = 1; state.eta = 0;
      state.homeYears += dTau;
    }
    state.distanceLy += dHome;
    return dHome;
  }

  /* ── the two walls ──────────────────────────────────────────────────── */

  function applyEnvironment(dt) {
    // The Local Bubble: a real ~300 ly cavity blown around the Sun by
    // ancient supernovae, twenty times thinner than the galactic average.
    // The first three hundred light-years are genuinely, physically safer.
    state.ismDensity = state.distanceLy < K.localBubbleLy
      ? K.ismLocalBubble
      : K.ismGalactic * (milkyWay
        ? Math.max(0.05, Math.min(2.2, SF.galaxy.localDensity(milkyWay) * skyDensityNorm))
        : 1);

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

  /* ── telling the pilot what is happening to them ──────────────────────
     Two moments in this game look exactly like a rendering fault unless
     somebody explains them, and both of them are real physics:

       the sky drains away   at 0.6c aberration has swept the stars forward
                             and Doppler has pushed most of what is left out
                             of the visible band. The sky really does go dark.
       the clocks split      at 0.99c your clock runs seven times slower than
                             home, and the distance ahead is contracted by the
                             same seven, which is why you are suddenly eating
                             a solar system in a minute.

     Each gets one card, once per session, on the left where the readout is
     not. The lamp then stays lit for as long as the condition holds, so the
     state is legible after the card is gone.                              */

  function checkSignals() {
    const beta = state.beta;
    if (state.bubble) {
      SF.hud.setLamp("ftl", "FASTER THAN LIGHT");
      SF.hud.notice("ftl",
        "You are past lightspeed",
        "Nothing with mass can do this, and the game says so: gears 3 and up are the one "
        + "declared cheat. Inside the bubble the ship counts as standing still, so the sky "
        + "stops aberrating, the clocks agree again, and nothing can hit you. Drop to gear 2 "
        + "to get the real physics back.");
    } else if (beta >= 0.99) {
      SF.hud.setLamp("light", "99% OF LIGHT");
      SF.hud.notice("lightspeed",
        "99% of light",
        "Your clock is now running about seven times slower than everyone at home — look at "
        + "the two times at the top. The road ahead is contracted by the same factor, which "
        + "is why you are crossing a solar system in a minute rather than eight hours. Push "
        + "harder and both effects grow without limit; you still never reach c.");
    } else if (beta >= 0.6) {
      SF.hud.setLamp("fast", "RELATIVISTIC");
      SF.hud.notice("darksky",
        "The sky is going dark",
        "Nothing has broken. At this speed aberration is sweeping the starlight into the cone "
        + "ahead of you, and the Doppler shift is dragging everything behind you into the "
        + "infrared, where your eyes cannot follow it. Slow down and the sky fills back in.");
    } else {
      SF.hud.setLamp("", "");
    }
  }

  /* ── world update ───────────────────────────────────────────────────── */

  function advanceWorld(dHome, dHomeYears) {
    // "Ahead" is the direction of TRAVEL, not the nose. Now that the ship has
    // momentum those are routinely different: fly one way, look another, and
    // the world still has to be born in front of where you are actually going.
    const travel = vdir;

    // The background sky moves too. It is the layer that carries the sense of
    // motion — the catalogued systems are sparse, and between them there was
    // previously nothing on screen that changed at all.
    SF.render.stepSkyField(skyField, travel, dHome);

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
    updateRelativeSpeed();

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

    // How thick the star field is here, as a MULTIPLE OF THE SKY YOU LAUNCHED
    // UNDER. The raw disk profile is normalised at the Sun's galactic radius
    // but not at its height above the plane, so sitting at the launch point it
    // returned 0.17 and the renderer quietly threw away two magnitudes of
    // stars — an empty black sky at a standstill, when what you should see
    // parked in space is the real naked-eye sky. Dividing by the value at the
    // launch point makes "1" mean "the sky from Earth's neighbourhood", and
    // leaving the disk still empties it exactly as it did.
    // The floor is not zero on purpose. Out beyond the disk the local star
    // density really does collapse, but the sky does not go black: the galaxy
    // is still behind you, its halo is all around you, and the rest of the
    // universe is still out there. A floor of 0.08 leaves a thin, real-looking
    // scatter of stars out there instead of an empty screen.
    state.density = milkyWay
      ? Math.max(0.08, Math.min(1.8, SF.galaxy.localDensity(milkyWay) * skyDensityNorm))
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

    if (state.bubbleFade > 0.01) SF.render.drawBubble(now, state.bubbleFade);
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
      // whatever it was doing. The wreck keeps its momentum and sheds it, which
      // is also why it keeps drifting in a faster-than-light gear where β is 0.
      const k = Math.max(0, 1 - dt * 1.6);
      vel.x *= k; vel.y *= k; vel.z *= k;
      state.warpLySec = v3.length(vel);
      dHome = state.warpLySec * dt * 0.2;
      state.beta *= k;
    }

    // Aberration is centred on the direction of TRAVEL, which is now the
    // velocity vector rather than the nose — that is exactly what lets you look
    // around at speed while the sky stays crushed toward where you are going.
    SF.view.setState(
      state.beta, state.gamma, vdir, state.relativistic,
      dt,     // the view eases across the lightspeed boundary; see view.js
    );
    // The bubble wall crossfades on the same clock as the aberration, so
    // crossing c is one continuous transition rather than three simultaneous
    // switches (sky, heat glow, wall) all thrown in the same frame.
    state.bubbleFade += ((state.bubble ? 1 : 0) - state.bubbleFade)
      * (1 - Math.exp(-dt / SF.view.easeSeconds));

    if (state.running) {
      applyEnvironment(dt);
      checkMilestones();
      checkSignals();
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
