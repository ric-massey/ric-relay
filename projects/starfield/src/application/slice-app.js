/* ══════════════════════════════════════════════════════════════════════
   slice-app.js — Slice B: station-local flight.

   Earth–Moon Vertical Slice §17:

     Slice A — a correct still universe: time, ephemeris, frames, real
     scale, correct lighting, target inspection. Done, and everything below
     stands on it.

     Slice B — station-local flight: ship state; assisted and direct
     control modes; desktop and touch input; the station-relative frame;
     precision movement, match velocity, hold position and safe stop;
     collision and warnings.

     Proof: a new player can manoeuvre near the station on phone and
     desktop.

   The composition root, and the only file allowed to know about both the
   simulation and the presentation. Everything it does is wiring: the ship
   does not know what a key is, the renderer does not know what a ship is,
   and the flight model has never heard of a canvas.

   The frame loop is the one place the two halves meet, and it runs in a
   fixed order that is worth stating because getting it wrong is subtle:

     1. sample input          — what the player asked for, this frame
     2. assess the situation  — where the ship is and what it is near
     3. flight model          — turn intent into thrust
     4. step the ship         — fixed sub-steps, so a long browser frame
                                cannot let the ship tunnel or double its
                                acceleration (Technical Architecture §4.4)
     5. render, then HUD      — both reading the same assessment from (2),
                                so they cannot contradict each other
   ══════════════════════════════════════════════════════════════════════ */

import * as THREE from "../../vendor/three/three.module.min.js";
import { TimeService } from "../simulation/time/time-service.js";
import { WorldService } from "../simulation/world/world-service.js";
import { SceneRenderer, DEFAULT_FOV } from "../presentation/render/scene-renderer.js";
import { Overlay } from "../presentation/ui/overlay.js";
import { StarMap } from "../presentation/ui/map.js";
import { PRESETS, migratePreset } from "../presentation/ui/canopy.js";
import { OBSERVATION_ORBIT, ORBITAL_SPEED, PERIOD, MEAN_MOTION } from "../simulation/world/observation-point.js";
import { STATION, shipStartState } from "../simulation/world/station.js";
import { BODIES } from "../simulation/world/bodies.js";
import { Ship } from "../simulation/ship/ship.js";
import { FlightModel, targetSpeed } from "../simulation/ship/flight-model.js";
import { Autopilot, planRoute, destinationById } from "../simulation/ship/navigation.js";
import {
  assess, stationReference, inertialReference, bodyReference,
} from "../simulation/ship/flight-computer.js";
import { modeById } from "../simulation/ship/modes.js";
import { InputRouter } from "./input/input.js";
import { describeBindings } from "./input/bindings.js";
import { normalize } from "../simulation/core/linalg.js";
import { lorentzFactor } from "../simulation/core/units.js";

const SETTINGS_KEY = "starfield.slice.settings";

/** The simulation never takes a step longer than this. */
const MAX_SUBSTEP = 1 / 60;

/** Choose a quality tier from what the device tells us about itself. */
function detectQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 500;
  if (mem <= 2 || cores <= 2) return "low";
  if (narrow || mem <= 4) return "medium";
  return "high";
}

export class SliceApp {
  constructor({ canvas, overlayRoot, stars, onStage }) {
    this.onStage = onStage || (() => {});
    this.settings = this._loadSettings();
    /** Kept for the map, which plots the same catalogue the sky draws. */
    this.stars = stars || [];

    this.onStage("starting the clock");
    this.time = new TimeService();

    this.onStage("placing Earth, the Moon and the Sun");
    this.world = new WorldService(this.time);
    // The catalogue, so a selected star can be resolved as a destination.
    // Set before the first update, or the first frame's state has no sky.
    this.world.stars = this.stars;
    this.world.update();

    this.onStage("bringing the ship up");
    // Behind the station on the V-bar, already station-keeping — see the
    // note on shipStartState for why that particular spot.
    const start = shipStartState(this.time.tt);
    this.ship = new Ship(start);
    this.flight = new FlightModel();
    // Stopped. The throttle is a speed the ship holds now, so anything above
    // zero here would have the session open with the ship already leaving.
    this.flight.throttle = 0;
    this._aimShipAt(this.world.state.station.position);

    this.onStage("building the sky");
    this.renderer = new SceneRenderer(canvas, {
      quality: this.settings.quality || detectQuality(),
      starCatalogue: stars,
    });
    this.renderer.sky.build(this.time.centuriesTt);

    this.onStage("lighting the canopy");
    this.overlay = new Overlay(overlayRoot, {
      onSelect: (id) => this.select(id),
      onInfo: () => this._openTargetInfo(),
      onModal: (open) => this._setMenuPause(open),
      onPreset: (p) => this._saveSettings({ preset: p }),
      onMap: () => this._action("map"),
      onTouchAction: (id, value) => this._touchAction(id, value),
      getSettings: () => this.settings,
      getBindings: () => describeBindings(this.input.bindings),
      toggleSetting: (key) => {
        this._saveSettings({ [key]: !this.settings[key] });
        return this.settings[key];
      },
    });
    this.overlay.setPreset(migratePreset(this.settings.preset));

    /* The map is the game's other primary surface (Design Bible §13), not
       a panel inside the cockpit — so it is a sibling layer over the same
       root, and opening it pauses rather than unloading anything. §13's
       requirement is that returning to the view is instant and loses no
       context, and the cheapest way to guarantee that is to never take
       the context down. */
    this.map = new StarMap(overlayRoot.parentNode || document.body, {
      onSelect: (id) => { this.select(id); },
      onInspect: (star) => { this.map.close(); this._showStar({ star }); },
      onOpen: (open) => this._setMenuPause(open),
    });

    this.targetId = "station";
    /** Route execution. Separate from the flight model on purpose — the
        audit forbids autopilot becoming another flag inside the assist
        loop, so it commands acceleration the way the player's hands do. */
    this.autopilot = new Autopilot();
    /** Live preview of the route to the current target, or null. */
    this.route = null;
    this.paused = false;
    this._menuPaused = false;
    /** Latest situation assessment — the HUD and the flight model share it. */
    this.situation = null;

    this.input = new InputRouter({
      surface: canvas,
      settings: {
        lookSensitivity: this.settings.lookSensitivity ?? 1,
        invertY: this.settings.invertY ?? false,
        pointerSmoothing: this.settings.pointerSmoothing ?? 0,
      },
      onAction: (id, detail) => this._action(id, detail),
    });
    canvas.addEventListener("touchstart", () => this.overlay.enableTouch(), { once: true, passive: true });
    window.addEventListener("resize", () => this.renderer.resize());

    this._lastWall = performance.now() / 1000;
    this._frame = this._frame.bind(this);
    this._raf = null;
  }

  start() {
    this.onStage(null);
    this._raf = requestAnimationFrame(this._frame);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.input.dispose();
  }

  /* ── settings ─────────────────────────────────────────────────────── */

  _loadSettings() {
    const defaults = {
      invertY: false,
      lookSensitivity: 1,
      pointerSmoothing: 0,
      showVectors: true,
    };
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      /* `mode` was assisted-vs-direct and no longer exists (2026-07-28,
         one ship). Dropped rather than merged, because a stored "direct"
         is exactly how Ric ended up flying the worse of the two ships
         without knowing it — leaving the key in place would preserve the
         bug in every browser that already has it saved. */
      delete stored.mode;
      return { ...defaults, ...stored };
    } catch { return { ...defaults }; }
  }

  _saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); }
    catch { /* private browsing; settings simply do not persist */ }
  }

  /* ── actions ──────────────────────────────────────────────────────── */

  _action(id, detail) {
    switch (id) {
      /* ── flight ── */
      case "fullStop": {
        /* §6.5: the command must name its frame, and must say why it
           cannot run rather than silently doing nothing.

           Above Local this stops the ship outright rather than flying a
           braking burn — Ric, 2026-07-26, and ledger SF-L-019. In Local it
           falls through to the honest brake, which is the whole point of
           the exception: the mode you dock in is the mode that has to
           obey physics. */
        const instant = this.flight.instantStop(this.ship, this._reference());
        if (instant === null) break;
        const why = this.flight.request(this.flight.assist === "hold" ? "stop" : "hold", this.situation);
        if (why) this.overlay.flash?.(why);
        break;
      }
      case "matchVelocity":
        this.flight.request("match", this.situation);
        break;
      case "overrideSafety":
        // §6.2's final bullet, made explicit and reversible: the player
        // says "I know", assistance stops steering, and it stays off until
        // they are clear.
        this.flight.safetyOverridden = !this.flight.safetyOverridden;
        break;

      /* ── view ── */
      case "zoomIn": this._zoom(1 / 1.35); break;
      case "zoomOut": this._zoom(1.35); break;
      case "zoomReset": this._setFov(DEFAULT_FOV); break;
      case "zoom": this._zoom(detail.factor); break;
      case "mouseLook": this.input.toggleMouseLook(); break;
      case "pick": this._pick(detail.x, detail.y); break;

      case "autopilot": this._toggleAutopilot(); break;
      case "mode1": case "mode2": case "mode3": case "mode4": case "mode5":
        this.flight.setTravelMode(Number(id.slice(4)));
        break;

      /* ── information ── */
      case "cycleTarget": this._cycleTarget(); break;
      case "cyclePreset": this._cyclePreset(); break;
      case "targetInfo": this._openTargetInfo(); break;
      case "ledger": this.overlay.openPanel("ledger"); break;
      case "help": this.overlay.openPanel("help"); break;
      case "pause":
        this.paused = !this.paused;
        this.time.paused = this.paused || this._menuPaused;
        break;
      case "map": this.map.toggle(); break;
      case "menu":
        // One key that means "back". It closes whichever surface is in
        // front rather than closing everything, so Escape never dismisses
        // something the player was not looking at.
        if (this.map.isOpen) this.map.close();
        else this.overlay.closePanel();
        break;
      default: break;
    }
  }

  _touchAction(id, value) {
    if (id === "precision") { this.input.touchPrecision = !!value; return; }
    this._action(id);
  }

  /* ── aiming ───────────────────────────────────────────────────────── */

  /**
   * Point the ship's nose at a place in the world.
   *
   * Only used to set up the opening view. In flight the player aims, and
   * nothing in this file ever moves the ship's attitude behind their back
   * — Controls §6: releasing a control never produces a surprise, and
   * neither does holding one.
   */
  _aimShipAt(positionEci) {
    const dir = normalize({
      x: positionEci.x - this.ship.position.x,
      y: positionEci.y - this.ship.position.y,
      z: positionEci.z - this.ship.position.z,
    });
    // Celestial north as the reference up, the same convention the camera
    // used in Slice A, so the horizon does not arrive rolled.
    const up = Math.abs(dir.z) > 0.9995 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    const zAxis = new THREE.Vector3(-dir.x, -dir.y, -dir.z);
    const xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(up.x, up.y, up.z), zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    const q = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
    this.ship.attitude = { w: q.w, x: q.x, y: q.y, z: q.z };
  }

  /** The ship's attitude as a Three quaternion, for the camera. */
  get cameraQuaternion() {
    const a = this.ship.attitude;
    return new THREE.Quaternion(a.x, a.y, a.z, a.w);
  }

  _zoom(factor) {
    // The unzoomed view is the ceiling. Zoom here is an optical instrument
    // — it magnifies from what the eye already has — and widening past the
    // canopy's own geometry is a fish-eye, not a zoom.
    this._setFov(Math.max(0.6, Math.min(DEFAULT_FOV, this.renderer.camera.fov * factor)));
  }

  /**
   * Set the field of view and the look sensitivity together.
   *
   * They are one action, not two. At 0.6° the pointer must move a hundred
   * times less per pixel or the view is unusable, so any path that changes
   * one and not the other leaves the mouse calibrated for a magnification
   * the player is no longer looking through — which is what zoom-reset
   * used to do.
   */
  _setFov(deg) {
    this.renderer.setFov(deg);
    this.input.fovScale = deg / DEFAULT_FOV;
  }

  /* ── targeting ────────────────────────────────────────────────────── */

  _targets() { return ["station", "earth", "moon", "sun"]; }

  _cycleTarget() {
    const list = this._targets();
    this.select(list[(list.indexOf(this.targetId) + 1) % list.length]);
  }

  _cyclePreset() {
    /* Saves, which it did not until 2026-07-28. The preset buttons go
       through `onPreset` and persist; V went through here and did not, so
       the cockpit you chose with the keyboard reverted on reload while the
       one you chose with the mouse stuck. Two ways to set one setting and
       only one of them remembered. */
    const next = PRESETS[(PRESETS.indexOf(this.overlay.preset) + 1) % PRESETS.length];
    this.overlay.setPreset(next);
    this._saveSettings({ preset: next });
  }

  select(id) {
    this.targetId = id;
    // Changing target while a route is running abandons the route. Not
    // silently: §7.4 wants the state unmistakable, and the result note is
    // how the HUD says so.
    if (this.autopilot.engaged && this.autopilot.route.destinationId !== id) {
      this.autopilot.disengage("target changed");
    }
  }

  /* ── autopilot ────────────────────────────────────────────────────── */

  /**
   * Plan a route to the current target, every frame, whether or not one is
   * engaged. §7.2 wants the preview available before engagement, and
   * `planRoute` is pure, so there is nothing to be gained by caching it and
   * a stale route to be lost by trying.
   */
  _updateRoute() {
    const destination = destinationById(this.world.state, this.targetId);
    if (!destination) { this.route = null; return; }

    /* The route is planned in the **selected travel mode**, not in some
       unbounded ideal. navigation.js warns about exactly this: without a
       cruise cap a long enough route reaches a speed the simulation does
       not model, and a navigation computer quietly flying you past the
       physics it is drawn with is the kind of lie the Scientific Standard
       exists to prevent. Left uncapped, a route to Sirius came back at 5.2
       times the speed of light while the ship sat in Local.

       Passing the mode means the preview answers the question the player
       actually has, which is not "how long would this take at infinity" but
       "how long would this take in the mode I am in" — and switching mode
       re-plans, which is how you discover that Sirius needs Interstellar. */
    const travel = modeById(this.flight.travelMode);
    this.route = planRoute({
      ship: this.ship,
      destination,
      state: this.world.state,
      authority: travel.authority,
      cruiseSpeed: travel.topSpeed,
    });
  }

  _toggleAutopilot() {
    if (this.autopilot.engaged) {
      this.autopilot.disengage("disengaged");
      return;
    }
    if (!this.route) return;
    // engage() returns the reason it cannot run; the overlay reads
    // autopilot.result, so a refusal explains itself rather than doing
    // nothing and looking like a broken key.
    this.autopilot.engage(this.route);
  }

  _pick(clientX, clientY) {
    const hit = this.renderer.pick(clientX, clientY);
    if (hit) { this.select(hit.id); return; }
    const tolerance = (this.renderer.camera.fov * Math.PI / 180) * 0.02;
    const dir = this.renderer.rayDirection(clientX, clientY);
    const star = this.renderer.sky.nearest(dir, tolerance, this.time.centuriesTt);
    if (star) this._showStar(star);
  }

  _setMenuPause(open) {
    // Vertical slice §5.3 / decision §19.3: opening a normal menu pauses
    // local simulation. The ship does not keep moving while you read.
    this._menuPaused = open;
    this.time.paused = this.paused || open;
  }

  _openTargetInfo() {
    if (this.targetId === "station") { this._showStation(); return; }
    const o = this._observations?.find((x) => x.id === this.targetId);
    if (o) this.overlay.openPanel("info", o);
  }

  _showStation() {
    const o = this.overlay;
    o.openPanel("info", null);
    o.panelTitle.textContent = STATION.name;
    o.panelBody.replaceChildren();

    const p = document.createElement("p");
    p.innerHTML =
      `The truss is <b>${STATION.trussSpanM} m</b> across and the pressurised modules run ` +
      `<b>${STATION.moduleLengthM} m</b> along the direction of travel. Those are the real ` +
      "station's dimensions, and nothing here is enlarged — if it looks small at a kilometre, " +
      "that is what a hundred-metre object looks like at a kilometre.";
    o.panelBody.append(p);

    const orbit = document.createElement("p");
    orbit.innerHTML =
      `It is on a <b>${(OBSERVATION_ORBIT.altitudeM / 1000).toFixed(0)} km</b> orbit at ` +
      `<b>${(OBSERVATION_ORBIT.inclinationRad * 180 / Math.PI).toFixed(1)}°</b> inclination, ` +
      `going round once every <b>${(PERIOD / 60).toFixed(1)} minutes</b> at ` +
      `<b>${(ORBITAL_SPEED / 1000).toFixed(2)} km/s</b>. You are doing the same speed, which ` +
      "is why it is sitting still in front of you.";
    o.panelBody.append(orbit);

    const cite = document.createElement("p");
    cite.className = "sf-cite";
    cite.textContent =
      "Altitude, inclination and dimensions are the real station's. Where it is in that orbit " +
      "right now is representative, not a live track — see SF-L-008 in where we cheat.";
    o.panelBody.append(cite);
    o.panel.classList.add("is-open");
  }

  _showStar({ star }) {
    const o = this.overlay;
    o.openPanel("info", null);
    o.panelTitle.textContent = star.name;
    o.panelBody.replaceChildren();

    const bits = [];
    bits.push(`Apparent magnitude <b>${star.v.toFixed(2)}</b>`);
    if (star.v > 6.5) bits.push("— below the naked-eye limit; you are seeing it because the ship's optics are better than an eye");
    if (star.spectralType) bits.push(`. Spectral type <b>${star.spectralType}</b>`);
    if (star.bv !== null && star.bv !== undefined) {
      bits.push(`, colour index B−V <b>${star.bv.toFixed(2)}</b>`);
    }
    if (star.distanceLy) bits.push(`. About <b>${star.distanceLy.toFixed(1)} light years</b> away`);
    bits.push(".");
    if (star.note) bits.push(` ${star.note}.`);

    const p = document.createElement("p");
    p.innerHTML = bits.join("");
    o.panelBody.append(p);

    const how = document.createElement("p");
    how.innerHTML = star.properName
      ? "It has a proper name because people have been looking at it for thousands of years."
      : (star.designated
        ? "Its designation is Bayer or Flamsteed — a Greek letter or number within its " +
          "constellation, assigned centuries ago in rough order of brightness."
        : `Catalogued as <b>HR ${star.hr}</b> in the Bright Star Catalogue. Most stars have ` +
          "no name beyond a number in a list, which is not a gap — there are simply more " +
          "stars than there are names worth giving.");
    o.panelBody.append(how);

    const caveat = document.createElement("p");
    caveat.className = "sf-cite";
    caveat.innerHTML =
      "Direction and brightness are catalogued measurements. In this slice the star is " +
      "drawn on a distant shell with no parallax of its own — see SF-L-007 in " +
      "<em>where we cheat</em>. From Phase 4 it becomes somewhere you can go.";
    o.panelBody.append(caveat);

    o.panel.classList.add("is-open");
  }

  /* ── the reference frame speeds are quoted against ────────────────── */

  /**
   * Automatic relative-frame selection, with a visible label (§6.2).
   *
   * The rule is proximity: inside the station's outermost zone the frame
   * that matters is the station's, because that is the only frame in which
   * "holding at forty metres" is a sentence. Outside it, the ship is
   * flying an orbit, and the orbit is an ellipse in the inertial frame.
   *
   * This is a *suggestion made visible*, not a hidden switch — the label
   * changes on the glass at the same instant the frame does, and every
   * speed on the HUD carries it.
   */
  _reference() {
    const st = this.world.state.station;
    const range = Math.hypot(
      st.position.x - this.ship.position.x,
      st.position.y - this.ship.position.y,
      st.position.z - this.ship.position.z
    );
    if (range < 5000) return stationReference(this.world.state.t);
    return inertialReference();
  }

  _targetReference() {
    const id = this.targetId;
    if (id === "station") {
      const st = this.world.state.station;
      return bodyReference("station", STATION.name, st, STATION.radius);
    }
    // Read from the body records rather than from this frame's
    // observations: the flight loop runs before observations are taken,
    // and a target that exists only after the first render would leave
    // match-velocity silently unavailable on the frame it was asked for.
    const record = BODIES.find((b) => b.id === id);
    const state = this.world.state.bodies[id];
    if (!record || !state) return null;
    return bodyReference(id, record.name, state, record.radius.value);
  }

  /* ── the loop ─────────────────────────────────────────────────────── */

  _frame() {
    this._raf = requestAnimationFrame(this._frame);

    const wall = performance.now() / 1000;
    const dt = Math.min(wall - this._lastWall, 0.25);
    this._lastWall = wall;

    /* 1. what the player asked for */
    const { command } = this.input.sample(dt);

    /* The speed the ship is holding, moved by whichever way the player is
       pushing it. In *log* space, so the travel from a centimetre a second
       to the mode's ceiling is even end to end and the fine end — the end
       you need beside a truss — gets as much of the dial as the fast end.

       Full sweep in **0.6 s**, down from 2.5. Two and a half seconds of
       holding a key before the ship is doing what you asked is the second
       half of "why is it so slow to speed up" — the drive spool was the
       first — and it is felt every single time you touch the throttle
       rather than only on long trips. Precision mode restores the slow
       sweep, because that is the mode where you are placing the ship to the
       centimetre and want the dial to take its time.

       This lives here rather than in the input layer because this is where
       dt is, and on the flight model rather than in the input layer because
       "stop" has to be able to zero it. */
    if (this.input.throttleAxis) {
      const rate = this.flight.precision ? 0.4 : 1.7;
      const t = this.flight.throttle + this.input.throttleAxis * dt * rate;
      this.flight.throttle = Math.max(0, Math.min(1, t));
    }

    /* 2, 3 and 4. assess, thrust, and step — in matched sub-steps.

       The ship, the clock and the world advance *together*, inside the
       loop. Advancing the world at the top of the frame and the ship at
       the bottom is the obvious arrangement and it is wrong: it leaves the
       two a frame apart, and a frame apart at 7.6 km/s is 128 metres. The
       flight computer then reports the station 128 m further away than it
       is, and the HUD, the warnings and the braking assist are all wrong
       in the same direction at once.

       The *command* is sampled once per frame and reused across the
       sub-steps, which is correct and is not the same thing: it is what
       the player asked for across this whole frame. Re-sampling it per
       sub-step would let one 200 ms stall apply twelve separate control
       decisions nobody made. */
    let remaining = this.time.frameDelta(wall);
    let out = null;
    while (remaining > 1e-9) {
      const step = Math.min(remaining, MAX_SUBSTEP);

      const reference = this._reference();
      const target = this._targetReference();
      this.situation = assess({
        ship: this.ship,
        reference,
        target,
        precision: command.precision,
        safetyOverridden: this.flight.safetyOverridden,
        world: this.world.state,
        travel: this.flight.travel,
      });

      /* Once the danger has passed, the override lapses. It is a decision
         about this approach, not a setting the player can leave on and
         forget — the difference between informed consent and a seatbelt
         light someone has put tape over. */
      if (this.flight.safetyOverridden && this.situation.severity === "none") {
        this.flight.safetyOverridden = false;
      }

      out = this.flight.update({
        ship: this.ship, command, reference, situation: this.situation, target,
      });

      /* ── the autopilot's hands ──────────────────────────────────────
         §7.4: any meaningful manual thrust disengages the route at once,
         with no dialog. Look-only input does not — which falls out for
         free, because rotation never reaches this branch.

         When engaged, the route's acceleration *replaces* the flight
         model's rather than adding to it. Summing them would have the
         assisted-flight velocity controller and the route controller both
         steering, each fighting a disturbance the other is creating. */
      const manualThrust =
        Math.abs(command.translate.x) + Math.abs(command.translate.y) +
        Math.abs(command.translate.z) > 1e-4;
      if (this.autopilot.engaged && manualThrust) this.autopilot.disengage();

      const nav = this.autopilot.step({ ship: this.ship, state: this.world.state });
      if (nav) out = { ...out, accelEci: nav.accelEci, note: nav.note };

      this.ship.step(step, {
        accelEci: out.accelEci,
        angularAccelBody: out.angularAccelBody,
        thirdBody: {
          moon: this.world.state.bodies.moon.position,
          sun: this.world.state.bodies.sun.position,
        },
      });

      /* Time dilation, actually applied. The traveller's clock gets the
         honest second; home runs ahead by γ. Quoted against Earth, because
         "home" is Earth and a dilation without a named frame is not a
         quantity. Above c, γ is 1 by declared fiction — see `lorentzFactor`. */
      this.time.step(step, lorentzFactor(this.ship.speed));
      this.world.update();
      remaining -= step;
    }
    if (out) this._assistNote = out.note || this._assistResultNote();

    // The route preview is refreshed from the settled state, once, for the
    // same reason the observations below are.
    this._updateRoute();

    /* Observations are for the eye and the glass, not for flight, so they
       are computed once per frame from the settled state rather than once
       per sub-step. */
    this._observations = this.world.markOcclusions(
      ["earth", "moon", "sun"].map((id) => this.world.observe(id, {
        frame: "ECI", position: this.ship.position, velocity: this.ship.velocity,
      }))
    );
    if (!this.situation) {
      this.situation = assess({ ship: this.ship, reference: this._reference() });
    }

    /* 5. render, then the HUD — both from the same assessment */
    this.renderer.update({
      cameraEci: this.ship.position,
      orientation: this.cameraQuaternion,
      world: this.world.state,
      frames: this.world.frames,
      observations: this._observations,
      dt,
    });
    this.renderer.render();

    this.overlay.update({
      time: this.time,
      observations: this._observations,
      targetId: this.targetId,
      renderer: this.renderer,
      adaptation: this.renderer.adaptation,
      velocityEci: this.ship.velocity,
      showVectors: this.settings.showVectors,
      situation: this.situation,
      flight: {
        modeLabel: this.flight.label,
        precision: this.flight.precision,
        /* The mode has to be passed. `targetSpeed` defaults to Local, so
           without it the throttle readout topped out at 300 m/s in every
           mode — the dial said "300 m/s" while Interstellar flew 0.1 ly/s.
           A dial that does not describe the ship is worse than no dial. */
        targetSpeed: targetSpeed(this.flight.throttle, this.flight.precision, this.flight.travel),
        assistNote: this._assistNote,
      },
      ship: {
        speed: this.ship.speed,
        frameLabel: "Earth",
        altitude: this.world.altitudeAboveEarth(this.ship.position),
      },
    });

    /* The map reads the same settled state the canopy does, and only when
       it is open — it is a full second surface, not a widget, and drawing
       a few hundred stars behind a closed panel would be pure cost. */
    this.map.update({
      ship: this.ship,
      world: this.world.state,
      stars: this.stars,
      targetId: this.targetId,
      route: this.route,
      frameLabel: this.situation?.referenceLabel || "Earth",
      time: this.time,
    });
  }

  /** The last completed or refused assist, phrased for the glass. */
  _assistResultNote() {
    const r = this.flight.assistResult;
    if (!r) return "";
    return r.ok ? r.reason : `${r.action} — ${r.reason}`;
  }

  /** Facts about the start state, for the page's own copy. */
  static get observationSummary() {
    return {
      label: OBSERVATION_ORBIT.label,
      altitudeKm: OBSERVATION_ORBIT.altitudeM / 1000,
      speedKms: ORBITAL_SPEED / 1000,
      periodMinutes: PERIOD / 60,
      inclinationDeg: (OBSERVATION_ORBIT.inclinationRad * 180) / Math.PI,
    };
  }
}
