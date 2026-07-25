/* ══════════════════════════════════════════════════════════════════════
   camera.js — orientation, and the projection everything renders through.

   The original starfield had no orientation at all: steering translated the
   camera sideways, so aiming right *slid* you right, like a security camera
   on a rail. Here the ship has a basis, steering drives angular rate, and
   the universe swings around you.

     yaw ψ, pitch θ  →  f = (sin ψ cos θ, −sin θ, cos ψ cos θ)
     p_cam = Rᵀ · p_world
     screen = (F·p_cam.x / p_cam.z, −F·p_cam.y / p_cam.z)

   World axes are x right, y up, z forward-at-rest; screen y is flipped at
   the last step. Roll banks the basis about f — bank into the turn is a
   small thing that does most of the work of making flight feel airborne.

   Projection takes a *direction*, not a position, because by the time a
   point reaches here it has been through relativistic aberration and only
   its apparent direction is meaningful. At β = 0 this is bit-for-bit the
   same pinhole projection the original had, including its focal length.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});

  const v3 = SF.v3 = {
    make(x = 0, y = 0, z = 0) { return { x, y, z }; },
    add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; },
    sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; },
    scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; },
    dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; },
    cross(a, b) {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      };
    },
    length(a) { return Math.hypot(a.x, a.y, a.z); },
    normalize(a) {
      const n = Math.hypot(a.x, a.y, a.z) || 1;
      return { x: a.x / n, y: a.y / n, z: a.z / n };
    },
    addScaled(a, b, s) {
      a.x += b.x * s; a.y += b.y * s; a.z += b.z * s;
      return a;
    },
  };

  const Camera = SF.camera = {
    yaw: 0, pitch: 0, roll: 0,
    yawRate: 0, pitchRate: 0,

    // Basis, rebuilt once per frame.
    forward: { x: 0, y: 0, z: 1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },

    // Screen geometry, in CSS pixels. `focal` is min(W,H)·0.82.
    W: 1, H: 1, cx: 0, cy: 0, focal: 1,

    // A transient kick, in radians, used for near-misses and crashes. It
    // shifts the basis without touching where the ship is actually pointing.
    shakeYaw: 0, shakePitch: 0, shakeRoll: 0,

    reset() {
      Camera.yaw = 0; Camera.pitch = 0; Camera.roll = 0;
      Camera.yawRate = 0; Camera.pitchRate = 0;
      Camera.shakeYaw = 0; Camera.shakePitch = 0; Camera.shakeRoll = 0;
      Camera.rebuild();
    },

    setViewport(w, h) {
      Camera.W = w; Camera.H = h;
      Camera.cx = w / 2; Camera.cy = h / 2;
      Camera.focal = Math.min(w, h) * SF.FOCAL;
    },

    /**
     * Steering drives angular *rate*, not position. `sx`/`sy` are the
     * normalised stick in [-1, 1]; `dt` is real seconds.
     */
    steer(sx, sy, dt, agility = 1) {
      const MAX_RATE = 1.15;        // radians per second at full deflection
      const RESPONSE = 5.0;         // how fast the rate chases the stick
      const targetYaw = sx * MAX_RATE * agility;
      const targetPitch = sy * MAX_RATE * agility;
      const k = 1 - Math.exp(-RESPONSE * dt);
      Camera.yawRate += (targetYaw - Camera.yawRate) * k;
      Camera.pitchRate += (targetPitch - Camera.pitchRate) * k;

      Camera.yaw += Camera.yawRate * dt;
      Camera.pitch += Camera.pitchRate * dt;
      // Keep the nose out of the poles so the basis never degenerates.
      const LIMIT = Math.PI * 0.49;
      if (Camera.pitch > LIMIT) { Camera.pitch = LIMIT; Camera.pitchRate = 0; }
      if (Camera.pitch < -LIMIT) { Camera.pitch = -LIMIT; Camera.pitchRate = 0; }
      if (Camera.yaw > Math.PI) Camera.yaw -= Math.PI * 2;
      if (Camera.yaw < -Math.PI) Camera.yaw += Math.PI * 2;

      // Bank into the turn: ~18° at full rate, eased.
      const targetRoll = -Camera.yawRate / MAX_RATE * 0.32;
      Camera.roll += (targetRoll - Camera.roll) * (1 - Math.exp(-4 * dt));
    },

    kick(yaw, pitch, roll) {
      Camera.shakeYaw += yaw;
      Camera.shakePitch += pitch;
      Camera.shakeRoll += roll;
    },

    decayKick(dt) {
      const k = Math.exp(-7 * dt);
      Camera.shakeYaw *= k;
      Camera.shakePitch *= k;
      Camera.shakeRoll *= k;
    },

    rebuild() {
      const yaw = Camera.yaw + Camera.shakeYaw;
      const pitch = Camera.pitch + Camera.shakePitch;
      const roll = Camera.roll + Camera.shakeRoll;
      const sy = Math.sin(yaw), cy = Math.cos(yaw);
      const sp = Math.sin(pitch), cp = Math.cos(pitch);
      const sr = Math.sin(roll), cr = Math.cos(roll);

      const f = { x: sy * cp, y: -sp, z: cy * cp };
      const r0 = { x: cy, y: 0, z: -sy };
      const u0 = { x: sp * sy, y: cp, z: sp * cy };   // = f × r0

      Camera.forward = f;
      Camera.right = { x: r0.x * cr + u0.x * sr, y: r0.y * cr + u0.y * sr, z: r0.z * cr + u0.z * sr };
      Camera.up = { x: u0.x * cr - r0.x * sr, y: u0.y * cr - r0.y * sr, z: u0.z * cr - r0.z * sr };
    },

    /**
     * Direction → camera coordinates. `z` is the component along the nose;
     * anything with z ≤ 0 is behind you.
     */
    toCamera(dir) {
      return {
        x: v3.dot(dir, Camera.right),
        y: v3.dot(dir, Camera.up),
        z: v3.dot(dir, Camera.forward),
      };
    },

    /**
     * Direction → screen. Returns null when the point is behind the ship or
     * so close to the horizon plane that the perspective divide blows up.
     * `radiusLy / distanceLy` is the object's angular radius; the screen
     * radius that comes back matches the original F·R/z projection exactly.
     */
    project(dir, angularRadius) {
      const p = Camera.toCamera(dir);
      if (p.z <= 1e-4) return null;
      const invZ = 1 / p.z;
      return {
        x: Camera.cx + Camera.focal * p.x * invZ,
        y: Camera.cy - Camera.focal * p.y * invZ,
        r: angularRadius ? Camera.focal * angularRadius * invZ : 0,
        z: p.z,
      };
    },

    /** Where the nose is pointing, in screen coordinates. Always the centre. */
    noseScreen() {
      return { x: Camera.cx, y: Camera.cy };
    },
  };
})();
