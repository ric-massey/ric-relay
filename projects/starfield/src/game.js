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
  const lightspeedEl = document.getElementById("lightspeed");
  const lightspeedTitleEl = document.getElementById("lightspeed-title");
  const lightspeedTextEl = document.getElementById("lightspeed-text");

  // β can only ever asymptote to 1 under thrust — nothing with mass crosses c —
  // so "near light speed" is a threshold we pick to start warning. The FTL
  // jump then steps outside real physics entirely, which the banner says.
  const LIGHT_SPEED_BETA = 0.99;
  let lightspeedMode = "none";   // "none" | "nearc" | "ftl"

  function setLightspeedAlert(mode) {
    if (!lightspeedEl) return;
    if (mode === "none") { lightspeedEl.hidden = true; return; }
    if (mode === "ftl") {
      lightspeedEl.dataset.mode = "ftl";
      if (lightspeedTitleEl) lightspeedTitleEl.textContent = "⚡ FASTER THAN LIGHT";
      if (lightspeedTextEl) lightspeedTextEl.textContent =
        "Real physics forbids this — nothing with mass crosses c. The galaxy is "
        + "just too big not to cheat, so the drive fakes it. Press J to drop back to sub-light.";
    } else {
      lightspeedEl.dataset.mode = "nearc";
      if (lightspeedTitleEl) lightspeedTitleEl.textContent = "⚠ NEAR LIGHT SPEED";
      if (lightspeedTextEl) lightspeedTextEl.textContent =
        "You cannot cross c under thrust. Your clock is falling behind home and the "
        + "sky is crushing forward. Brake (B) to slow, or press J to jump past light.";
    }
    lightspeedEl.hidden = false;
  }

  const state = {
    running: true,
    paused: false,
    eta: 0, beta: 0, gamma: 1,
    throttle: 0, throttleTarget: 0,
    shipYears: 0, homeYears: 0, distanceLy: 0,
    hull: 1,
    bubble: false,
    relativistic: true,
    ismDensity: K.ismLocalBubble,
    ismWattsPerM2: 0,
    cmbForwardK: K.tCMB,
    density: 1,
    milestoneIndex: 0,
    flash: 0, flashColour: "255,255,255",
    waypoint: null,   // { obj, name } chosen from the star chart
  };
  SF.state = state;

  let vdir = { x: 0, y: 0, z: 1 };
  const systems = [];
  const galaxies = [];
  // Exposed so the scene can be inspected from a console — handy when the
  // thing you want to look at is a black hole 1,560 light-years away.
  SF.world = { systems, galaxies, heading: () => vdir };
  let skyField = null;
  let milkyWay = null;
  let nextSystemAt = 0;
  let last = performance.now();
  let steerX = 0, steerY = 0;
  let joyX = 0, joyY = 0, joyActive = false;
  let keyThrust = 0, pointerThrust = 0, overburn = false;
  const pressed = new Set();

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
    state.relativistic = true;
    state.milestoneIndex = 0;
    state.flash = 0;
    steerX = 0; steerY = 0;
    joyX = 0; joyY = 0; joyActive = false;
    keyThrust = 0; pointerThrust = 0; overburn = false;
    lightspeedMode = "none";
    if (lightspeedEl) lightspeedEl.hidden = true;
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
      const target = SF.systems.catalogueToCartesian(proxima).pos;
      const dir = v3.normalize(target);
      SF.camera.yaw = Math.atan2(dir.x, dir.z);
      SF.camera.pitch = -Math.asin(Math.max(-1, Math.min(1, dir.y)));
      SF.camera.rebuild();
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

  function updateKeyThrust() {
    // Space accelerates, B brakes toward a full stop. The arrows are steering
    // now, so they no longer touch the throttle.
    const forward = pressed.has("Space");
    const back = pressed.has("KeyB");
    keyThrust = forward ? 1 : back ? -1 : 0;
    overburn = pressed.has("ShiftLeft") || pressed.has("ShiftRight");
  }

  addEventListener("keydown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement
      && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;

    const code = event.code;
    if (code === "Space" || code === "Tab") event.preventDefault();
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) event.preventDefault();
    pressed.add(code);
    updateKeyThrust();

    if (!state.running && (code === "KeyR" || code === "Space" || code === "Enter")) {
      restart();
      return;
    }
    if (code === "Tab") {
      toggleMap();
    } else if (code === "KeyM") {
      SF.hud.setSoundLabel(SF.audio.toggle());
    } else if (code === "KeyJ") {
      // The lightspeed jump: a Star-Wars-style faster-than-light drive. Real
      // physics forbids it, which is exactly why crossing to another galaxy
      // needs it — the banner says so while it is engaged.
      state.bubble = !state.bubble;
    } else if (code === "KeyP" || code === "Escape") {
      if (mapEl.hidden === false) { closeMap(); return; }
      if (ledgerEl.hidden === false) { ledgerEl.hidden = true; return; }
      togglePause();
    } else if (code === "KeyL") {
      ledgerEl.hidden = !ledgerEl.hidden;
      if (!ledgerEl.hidden && !state.paused) togglePause();
    }
  });

  addEventListener("keyup", (event) => {
    pressed.delete(event.code);
    updateKeyThrust();
  });

  addEventListener("blur", () => { pressed.clear(); keyThrust = 0; pointerThrust = 0; });

  // Arrow-key steering, applied as a stick each frame: left/right yaw the
  // nose, up/down pitch it. Up pitches the nose up (negative pitch in the
  // camera's convention).
  function keyboardStick() {
    let x = 0, y = 0;
    if (pressed.has("ArrowLeft")) x -= 1;
    if (pressed.has("ArrowRight")) x += 1;
    if (pressed.has("ArrowUp")) y -= 1;
    if (pressed.has("ArrowDown")) y += 1;
    return { x, y };
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

  /* ── physics ────────────────────────────────────────────────────────── */

  function stepEngine(dt) {
    // Throttle: 1 g by default, 3 g held down, negative for a retro burn.
    const raw = Math.max(-1, Math.min(1, keyThrust + pointerThrust));
    state.throttleTarget = raw * (overburn ? 3 : 1);
    state.throttle += (state.throttleTarget - state.throttle) * Math.min(1, dt * 6);

    // Time compression, but speed-scaled. Near a standstill the sim runs at a
    // small fraction of full rate, so a parked planet orbits at a rate you can
    // actually watch instead of strobing round every couple of seconds; by the
    // time you are moving at ~0.1c it is at full compression, so crossing
    // light-years still takes seconds, not hours. This is a wall-clock↔ship-
    // time mapping only — the ship/home clock ratio stays exactly γ.
    const timeScale = 0.08 + 0.92 * Math.min(1, Math.abs(state.beta) / 0.1);
    const dTau = F.shipYearsPerSecond * (state.bubble ? 1 : timeScale) * dt;
    state.shipYears += dTau;

    if (state.bubble) {
      // The lightspeed jump, framed as an Alcubierre bubble: space contracts
      // ahead and expands behind while the ship sits locally at rest. That is
      // a real solution to the field equations (with unphysical energy needs),
      // and it is the honest excuse for switching relativity off — inside the
      // bubble you are not moving, so nothing aberrates and no clock disagrees.
      //
      // Warp speed is throttled: hold Space to build it up, release and it
      // coasts back toward a hover as the throttle relaxes to zero. Collisions
      // are off in the bubble (handled in the loop) — you pass through normal
      // space rather than slamming into the first star on the way. This is fast
      // enough to cross between distant regions and galaxies; for hopping to a
      // nearby star and parking, sub-light flight is the precise tool.
      state.relativistic = false;
      const apparentC = Math.abs(state.throttle) * 6e4;   // ly per ship-year
      const dHome = apparentC * dTau;
      state.homeYears += dTau;
      state.distanceLy += dHome;
      state.beta = 0; state.gamma = 1;
      return dHome;
    }

    state.relativistic = true;
    const nose = SF.camera.forward;
    const sign = state.throttle >= 0 ? 1 : -1;
    const magnitude = Math.abs(state.throttle);
    const thrust = { x: nose.x * sign, y: nose.y * sign, z: nose.z * sign };

    const align = Math.max(-1, Math.min(1, v3.dot(thrust, vdir)));

    // Along the velocity: pure rapidity. dη/dτ = a‖/c.
    state.eta += SF.rel.rapidityStep(magnitude * align, dTau);
    if (state.eta < 0) {
      // Burned through zero — you are now going the other way.
      state.eta = -state.eta;
      vdir = { x: -vdir.x, y: -vdir.y, z: -vdir.z };
    }
    state.beta = Math.tanh(state.eta);
    state.gamma = Math.cosh(state.eta);

    // Across it: transverse proper acceleration turns the velocity vector at
    // dθ/dτ = a⊥/(γβ). The γ in that denominator is the whole story — at
    // γ = 100 a one-gravity burn bends your course by a hundredth of what it
    // would at rest. You commit to a heading long before you notice.
    const sinAngle = Math.sqrt(Math.max(0, 1 - align * align));
    if (magnitude > 0.01 && sinAngle > 1e-4) {
      const turnRate = magnitude * sinAngle
        / (state.gamma * Math.max(0.08, state.beta)) / K.gYears;
      const angle = Math.acos(align);
      const step = Math.min(angle, turnRate * dTau);
      const px = thrust.x - vdir.x * align;
      const py = thrust.y - vdir.y * align;
      const pz = thrust.z - vdir.z * align;
      const len = Math.hypot(px, py, pz) || 1;
      const c = Math.cos(step), s = Math.sin(step);
      vdir = v3.normalize({
        x: vdir.x * c + (px / len) * s,
        y: vdir.y * c + (py / len) * s,
        z: vdir.z * c + (pz / len) * s,
      });
    }

    const dHome = state.beta * state.gamma * dTau;
    state.homeYears += state.gamma * dTau;
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
    for (let i = systems.length - 1; i >= 0; i -= 1) {
      const system = systems[i];
      SF.systems.translate(system, vdir, dHome);
      if (system.hole) SF.blackhole.advance(system.hole, dHomeYears);
      SF.systems.layout(system, dHomeYears);

      // Real catalogued stars are the fixed furniture of the neighbourhood —
      // fly past one, turn around, and it must still be exactly where it was.
      // Only the procedural fly-by systems get recycled once behind you.
      if (system.catalogue) continue;
      const along = v3.dot(system.pos, vdir);
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
        && v3.dot(galaxy.pos, vdir) < 0 && measure.distanceLy > galaxy.diameterLy * 6) {
        galaxies[i] = spawnFieldGalaxy();
      }
    }

    // Spawning. The gap is real and Poisson; where it lands is the cheat.
    const spawnAhead = Math.max(
      F.spawnAheadLy,
      Math.min(F.spawnAheadLy * state.gamma, Math.max(F.spawnAheadMaxLy, dHome * 10)),
    );
    let guard = 0;
    while (state.distanceLy >= nextSystemAt && guard < 60) {
      guard += 1;
      nextSystemAt += SF.systems.nextGapLy();
      if (systems.filter((s) => !s.catalogue).length >= F.maxSystems) continue;
      const offset = SF.systems.corridorOffset(vdir);
      systems.push(SF.systems.create({
        pos: {
          x: vdir.x * spawnAhead + offset.x,
          y: vdir.y * spawnAhead + offset.y,
          z: vdir.z * spawnAhead + offset.z,
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
        if (previous === undefined || previous <= 0 || along > 0) continue;

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
        SF.render.drawPlanet(body, p, system.starScreen);
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
      if (!galaxy.name || !galaxy.screen) continue;
      if (galaxy.screen.r < 12) continue;
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
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    if (state.paused) return;

    const stick = keyboardStick();
    // Keyboard wins if a key is down, then the mobile joystick, then the
    // pointer/drag steer that touch and mouse-move feed.
    const sx = stick.x !== 0 ? stick.x : joyActive ? joyX : steerX;
    const sy = stick.y !== 0 ? stick.y : joyActive ? joyY : steerY;
    SF.camera.steer(state.running ? sx : 0, state.running ? sy : 0, dt);
    SF.camera.decayKick(dt);
    SF.camera.rebuild();

    let dHome = 0, dHomeYears = 0;
    if (state.running) {
      const before = state.homeYears;
      dHome = stepEngine(dt);
      dHomeYears = state.homeYears - before;
    } else {
      // Drift to a halt after a crash, so the wreck still moves a little.
      dHome = state.beta * state.gamma * F.shipYearsPerSecond * dt * 0.2;
      state.beta *= Math.max(0, 1 - dt * 1.6);
    }

    SF.view.setState(state.beta, state.gamma, vdir, state.relativistic);

    if (state.running) {
      applyEnvironment(dt);
      checkMilestones();
    }
    advanceWorld(dHome, dHomeYears);
    // No collisions inside the lightspeed bubble — you pass through normal
    // space, which is the only thing that makes a jump survivable.
    if (state.running && !state.bubble) collide();

    // The banner: an FTL notice while the lightspeed jump is engaged, else a
    // near-c warning once β climbs past the threshold, else nothing. It holds
    // until the condition clears rather than flashing once.
    let mode = "none";
    if (state.running && state.bubble) mode = "ftl";
    else if (state.running && state.relativistic && state.beta >= LIGHT_SPEED_BETA) mode = "nearc";
    if (mode !== lightspeedMode) {
      lightspeedMode = mode;
      setLightspeedAlert(mode);
      if (mode !== "none") SF.audio.blip(mode === "ftl" ? 300 : 180, 0.35, "square", 0.07);
    }

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

  SF.render.init(canvas);
  SF.hud.init();
  skyField = SF.render.makeSkyField(reducedMotion ? 700 : 1500);
  restart();
  requestAnimationFrame(frame);
})();
