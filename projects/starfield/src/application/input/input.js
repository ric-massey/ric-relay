/* ══════════════════════════════════════════════════════════════════════
   input.js — devices in, one command out.

   Controls §6 lists the feel requirements as *requirements*, and three of
   them decide the shape of this file:

     · **Input is sampled per frame and applied at the simulation step.**
       So held keys are flags, not events, and the frame loop integrates
       them. The prototype's cardinal sin was letting the operating
       system's key-repeat rate decide how fast the ship turned; a key here
       never produces a step of anything.

     · **Pointer input is raw.** No smoothing and no acceleration by
       default. Optional smoothing exists for players who want it, off
       unless asked for.

     · **Analog where the physical quantity is analog.** Aim and throttle
       are continuous; thrust on or off is not, and pretending otherwise
       would add lag to the one control that must not have any.

   Everything here produces the same normalised command object, so the
   flight model cannot tell a thumb from a mouse from a key — which is what
   makes §12.4's "two-thumb flight at 375 px" a UI problem rather than a
   physics one.
   ══════════════════════════════════════════════════════════════════════ */

import { loadBindings, saveBindings, resetBindings, codeIndex, ACTION_BY_ID } from "./bindings.js";
import { NEUTRAL_COMMAND } from "../../simulation/ship/flight-model.js";
import { SHIP } from "../../simulation/ship/ship.js";

/** Pointer movement is in CSS pixels; this turns it into radians of aim. */
const POINTER_RADIANS_PER_PIXEL = 0.0022;

export class InputRouter {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.surface     element that receives pointer and touch
   * @param {Function}    [opts.onAction]  called for edge-triggered actions
   * @param {object}      [opts.settings]  {lookSensitivity, invertY, pointerSmoothing}
   */
  constructor({ surface, onAction = () => {}, settings = {} } = {}) {
    this.surface = surface;
    this.onAction = onAction;
    this.settings = {
      lookSensitivity: 1,
      invertY: false,
      /** 0 = raw, which is the default and the requirement. */
      pointerSmoothing: 0,
      touchDeadZone: 0.12,
      ...settings,
    };

    this.bindings = loadBindings();
    this._index = codeIndex(this.bindings);

    /** Physical key codes currently down. */
    this.down = new Set();
    /** Accumulated pointer movement since the last sample, radians. */
    this._aim = { yaw: 0, pitch: 0 };
    this._aimSmoothed = { yaw: 0, pitch: 0 };

    /** Which way the throttle is being pushed this frame, −1…1. The value
        it is pushing lives on the flight model, which owns it. */
    this.throttleAxis = 0;
    /** Set by the touch layer; null when no virtual stick is engaged. */
    this.touchStick = null;
    this.touchPrecision = false;
    this.pointerLocked = false;

    this._bindKeyboard();
    this._bindPointer();
    this._bindTouch();
  }

  /* ── bindings ──────────────────────────────────────────────────────── */

  rebind(bindings) {
    this.bindings = bindings;
    this._index = codeIndex(bindings);
    saveBindings(bindings);
  }

  resetToDefaults() {
    this.rebind(resetBindings());
    return this.bindings;
  }

  /** Is the action's key held right now? */
  held(actionId) {
    for (const code of this.bindings[actionId] || []) {
      if (code && this.down.has(code)) return true;
    }
    return false;
  }

  /* ── keyboard ──────────────────────────────────────────────────────── */

  _bindKeyboard() {
    const isTyping = (e) =>
      e.target instanceof HTMLElement &&
      (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable);

    /* Tab is bound to the map (Controls §5) and it is also how a keyboard
       user moves between the overlay's controls. Both have to keep
       working, so the tie-breaker is where the focus already is: once it
       is on a control, the player is navigating the interface and Tab
       belongs to the browser. Click the sky and Tab opens the map again.
       Without this, binding Tab silently makes the whole HUD unreachable
       by keyboard — which HUD §10 does not allow. */
    const onControl = (e) =>
      e.target instanceof HTMLElement &&
      e.target.closest("button, a[href], input, select, textarea, summary, [tabindex]");

    this._onKeyDown = (e) => {
      if (isTyping(e)) return;
      if (e.code === "Tab" && onControl(e)) return;
      // Browser chords keep working: a modifier held with some *other* key
      // is the player talking to the browser, not to the ship. Ctrl alone
      // is exempt because Ctrl is bound to thrust-down.
      if (e.metaKey || (e.ctrlKey && !e.code.startsWith("Control"))) return;

      const action = this._index.get(e.code);
      if (!action) return;

      const def = ACTION_BY_ID.get(action);
      if (def.kind === "press") {
        if (!e.repeat) this.onAction(action);
      } else {
        this.down.add(e.code);
      }
      e.preventDefault();
    };

    this._onKeyUp = (e) => this.down.delete(e.code);
    // A tab switch eats the keyup and the ship thrusts forever. This is
    // not hypothetical; it is the single most common bug in browser games.
    this._onBlur = () => this.down.clear();

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);
  }

  /* ── pointer ───────────────────────────────────────────────────────── */

  _bindPointer() {
    const s = this.surface;
    if (!s) return;

    let dragging = false, moved = 0;

    this._onPointerDown = (e) => {
      if (e.pointerType === "touch") return;      // the touch layer owns those
      /* Touching the sky hands keyboard focus back to the ship.
​
         Without this, one click on a HUD button leaves focus on it for the
         rest of the session, and every keystroke afterwards is judged
         against a control the player stopped looking at ten minutes ago —
         which is how Tab silently stops opening the map (Controls §3.2).
         The canvas is not focusable, so clicking it does not move focus by
         itself; it has to be given back deliberately. */
      document.activeElement?.blur?.();
      dragging = true; moved = 0;
      s.setPointerCapture?.(e.pointerId);
    };

    this._onPointerMove = (e) => {
      // Two ways to aim, and both must work: pointer lock for players who
      // want mouse look, and drag for players who do not want their cursor
      // captured by a web page. §12.3 asks only that pointer aiming be
      // discoverable, not that it be modal.
      if (!this.pointerLocked && !dragging) return;
      const dx = this.pointerLocked ? e.movementX : e.movementX ?? 0;
      const dy = this.pointerLocked ? e.movementY : e.movementY ?? 0;
      moved += Math.abs(dx) + Math.abs(dy);
      this._addAim(dx, dy);
    };

    this._onPointerUp = (e) => {
      if (e.pointerType === "touch") return;
      // A click that did not drag is a selection, not an aim.
      if (dragging && moved < 6) this.onAction("pick", { x: e.clientX, y: e.clientY });
      dragging = false;
      s.releasePointerCapture?.(e.pointerId);
    };

    this._onWheel = (e) => {
      e.preventDefault();
      this.onAction("zoom", { factor: Math.exp(e.deltaY * 0.0012) });
    };

    this._onLockChange = () => {
      this.pointerLocked = document.pointerLockElement === s;
    };

    s.addEventListener("pointerdown", this._onPointerDown);
    s.addEventListener("pointermove", this._onPointerMove);
    s.addEventListener("pointerup", this._onPointerUp);
    s.addEventListener("pointercancel", () => { dragging = false; });
    s.addEventListener("wheel", this._onWheel, { passive: false });
    document.addEventListener("pointerlockchange", this._onLockChange);
  }

  /**
   * Accumulate pointer or touch movement as an aim delta, in radians.
   *
   * Sign convention, and it is the one every consumer downstream assumes:
   * **positive yaw is nose right, positive pitch is nose up.** Move the
   * mouse right, the ship goes right. This read `-= dx` and turned the
   * ship the wrong way, which is the sort of thing that is obvious the
   * instant somebody flies it and invisible in every test that checks
   * magnitudes.
   */
  _addAim(dx, dy) {
    // `this.fovScale`, the getter, not `this._fovScale`, the field. The
    // field is undefined until the player zooms for the first time, so
    // reading it directly made every pointer delta NaN — and NaN fails the
    // "is the player rotating?" test silently, so the mouse did nothing at
    // all and reported no error while doing it.
    const k = POINTER_RADIANS_PER_PIXEL * this.settings.lookSensitivity * this.fovScale;
    this._aim.yaw += dx * k;
    this._aim.pitch += (this.settings.invertY ? 1 : -1) * dy * k;
  }

  /** Aiming is finer when zoomed in, the way a long lens behaves. */
  set fovScale(v) { this._fovScale = v > 0 ? v : 1; }
  get fovScale() { return this._fovScale ?? 1; }

  toggleMouseLook() {
    if (!this.surface) return false;
    if (this.pointerLocked) { document.exitPointerLock?.(); return false; }
    this.surface.requestPointerLock?.();
    return true;
  }

  /* ── touch ─────────────────────────────────────────────────────────
     Controls §5: left thumb is a virtual stick for translation, and the
     right half of the screen is *anywhere* — drag to look, so aiming is
     never confined to a small pad. Full stop and precision are fixed
     buttons the steering thumb never has to move for; the overlay owns
     those and calls `press` directly. */

  _bindTouch() {
    const s = this.surface;
    if (!s) return;

    let stickId = null, stickOrigin = null;
    let lookId = null, lookLast = null;

    const width = () => s.clientWidth || window.innerWidth || 1;

    this._onTouchStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < width() * 0.4 && stickId === null) {
          // The stick appears where the thumb lands, rather than at a fixed
          // spot it then has to find. On a phone held two-handed there is
          // no fixed spot that is right for every hand.
          stickId = t.identifier;
          stickOrigin = { x: t.clientX, y: t.clientY };
          this.touchStick = { x: 0, y: 0 };
        } else if (lookId === null) {
          lookId = t.identifier;
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    };

    this._onTouchMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          const R = 56;   // thumb travel for full deflection, CSS px
          let x = (t.clientX - stickOrigin.x) / R;
          let y = (t.clientY - stickOrigin.y) / R;
          const m = Math.hypot(x, y);
          if (m > 1) { x /= m; y /= m; }
          // A dead zone, applied *radially* and rescaled, so the stick
          // still reaches full deflection and does not jump when it leaves
          // the zone. §6.4 calls this out by name: touch dead-zone drift.
          const dz = this.settings.touchDeadZone;
          const scaled = m <= dz ? 0 : (Math.min(m, 1) - dz) / (1 - dz);
          this.touchStick = m > 0 ? { x: (x / m) * scaled, y: (y / m) * scaled } : { x: 0, y: 0 };
        } else if (t.identifier === lookId) {
          this._addAim(t.clientX - lookLast.x, t.clientY - lookLast.y);
          lookLast = { x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    };

    this._onTouchEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.touchStick = null; }
        if (t.identifier === lookId) { lookId = null; }
      }
    };

    s.addEventListener("touchstart", this._onTouchStart, { passive: true });
    s.addEventListener("touchmove", this._onTouchMove, { passive: false });
    s.addEventListener("touchend", this._onTouchEnd);
    s.addEventListener("touchcancel", this._onTouchEnd);
  }

  /* ── sampling ──────────────────────────────────────────────────────── */

  /**
   * The command for this frame, and the aim delta that goes with it.
   *
   * Called once per frame and *consumes* the accumulated pointer movement,
   * so no aim input is ever applied twice or dropped — which is what keeps
   * the response identical at 30 and 144 fps.
   */
  sample(dt) {
    const axis = (neg, pos) => (this.held(pos) ? 1 : 0) - (this.held(neg) ? 1 : 0);

    const precision = this.held("precision") || this.touchPrecision;

    const translate = {
      x: axis("strafeLeft", "strafeRight"),
      y: axis("thrustDown", "thrustUp"),
      z: axis("thrustBack", "thrustForward"),
    };
    if (this.touchStick) {
      // Left thumb: horizontal strafes, vertical thrusts fore and aft —
      // the mapping that matches how the same stick behaves on a gamepad.
      translate.x += this.touchStick.x;
      translate.z += -this.touchStick.y;
    }

    /* Which way the player is pushing the speed, not what the speed is.
​
       The throttle used to live here *and* on the flight model, with the
       app copying one to the other every frame. That was survivable while
       it was only a dial; it stopped being survivable when the throttle
       became a speed the ship holds, because then "stop" has to be able to
       put it back to zero — and a value the input layer rewrites on the
       next frame cannot be put back to anything. So the model owns it and
       this reports the axis. Same reasoning the model already records for
       reading the throttle off the command instead of its own field.
​
       Forward and back drive it as well as the dedicated throttle keys:
       W is how anyone actually flies, and translate.z stays populated
       because direct mode still needs it as a raw thruster. */
    this.throttleAxis = axis("throttleDown", "throttleUp") + translate.z;

    // Arrow keys aim as an analog axis: rate per second, eased in over a
    // fifth of a second so a tap nudges and a hold sweeps.
    // Same convention as the pointer: right arrow is nose right, up arrow
    // is nose up. `axis(neg, pos)` returns +1 for the second one.
    const keyYaw = axis("yawLeft", "yawRight");
    const keyPitch = axis("pitchDown", "pitchUp");
    if (keyYaw || keyPitch) {
      this._keyRamp = Math.min(1, (this._keyRamp || 0) + dt / 0.2);
      // A held arrow asks for the ship's full turn rate. It used to ask for
      // 1.25 rad/s — a constant left over from the Slice A camera, which
      // had no ship and no rate limit — so the keys quietly commanded half
      // of what the ship could do and turning felt heavy for no reason.
      // Precision mode and optical zoom are what make aiming fine; the
      // default should not be permanently half-throttle.
      const rate = SHIP.maxAngularRate * this.fovScale * this._keyRamp *
        this.settings.lookSensitivity * (precision ? 0.18 : 1);
      this._aim.yaw += keyYaw * rate * dt;
      this._aim.pitch += keyPitch * rate * dt;
    } else {
      this._keyRamp = 0;
    }

    // Optional smoothing, off by default. When on it is a first-order lag
    // rather than an average, so it adds no latency to the first frame of
    // a movement — only to the tail.
    let aim;
    const sm = this.settings.pointerSmoothing;
    if (sm > 0) {
      const a = Math.min(1, dt / (sm * 0.15 + dt));
      this._aimSmoothed.yaw += (this._aim.yaw - this._aimSmoothed.yaw) * a;
      this._aimSmoothed.pitch += (this._aim.pitch - this._aimSmoothed.pitch) * a;
      aim = { ...this._aimSmoothed };
      this._aim.yaw = 0; this._aim.pitch = 0;
      this._aimSmoothed.yaw *= 1 - a; this._aimSmoothed.pitch *= 1 - a;
    } else {
      aim = { ...this._aim };
      this._aim.yaw = 0; this._aim.pitch = 0;
    }

    /* Aim is an angle; the flight model wants a rate command in −1…1.
​
       Dividing by dt and by the ship's rate limit is what makes the mouse
       feel raw: move it twice as fast and the ship turns twice as fast,
       one-to-one, right up to the point where the ship physically cannot
       turn any faster — and then it clamps, visibly, rather than banking
       the input and paying it out later. Anything cleverer here is the
       input lag §6 calls a bug rather than a tuning value. */
    const rateScale = 1 / Math.max(dt, 1e-4) / SHIP.maxAngularRate;
    const clamp1 = (v) => Math.max(-1, Math.min(1, v));

    return {
      command: {
        translate: clampBox(translate),
        rotate: {
          pitch: clamp1(aim.pitch * rateScale),
          yaw: clamp1(aim.yaw * rateScale),
          roll: axis("rollLeft", "rollRight"),
        },
        precision,
      },
      aim,
    };
  }

  /** Fire an action from a UI control — the touch buttons use this. */
  press(actionId, detail) { this.onAction(actionId, detail); }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    document.removeEventListener("pointerlockchange", this._onLockChange);
  }
}

/** Clamp each axis to −1…1 without renormalising: diagonals may exceed 1
    in length, and the flight model is what decides whether that is allowed. */
const clampBox = (v) => ({
  x: Math.max(-1, Math.min(1, v.x)),
  y: Math.max(-1, Math.min(1, v.y)),
  z: Math.max(-1, Math.min(1, v.z)),
});
