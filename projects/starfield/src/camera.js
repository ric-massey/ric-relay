/* ══════════════════════════════════════════════════════════════════════
   camera.js — orientation, and the projection everything renders through.

   The original starfield had no orientation at all: steering translated the
   camera sideways, so aiming right *slid* you right, like a security camera
   on a rail. Then it grew yaw and pitch as Euler angles, which was fine
   while those were the only two axes.

   THE BASIS IS NOW INTEGRATED DIRECTLY, because roll is a player axis.
   Euler angles cannot survive that: yaw/pitch/roll gimbal-lock, and the old
   code had to clamp pitch to ±0.49π to stop the basis degenerating at the
   poles — a ceiling and a floor bolted onto a spaceship. Instead the ship
   carries an orthonormal body basis

     right r, up u, forward f        with  r × u = f

   and steering drives *body angular rates* that rotate the whole basis
   about a single combined axis (Rodrigues), re-orthonormalised each frame
   to stop numerical drift accumulating. There is no pole, no clamp, and no
   preferred "up" in the universe — you can loop, roll inverted, and keep
   going, which is the entire point of flying in space rather than in air.

     p_cam = Rᵀ · p_world
     screen = (F·p_cam.x / p_cam.z, −F·p_cam.y / p_cam.z)

   World axes are x right, y up, z forward-at-rest; screen y is flipped at
   the last step.

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

  /** Rodrigues: rotate `v` about a unit `axis` by `angle` radians. */
  function rotateAbout(v, axis, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const d = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return {
      x: v.x * c + (axis.y * v.z - axis.z * v.y) * s + axis.x * d * (1 - c),
      y: v.y * c + (axis.z * v.x - axis.x * v.z) * s + axis.y * d * (1 - c),
      z: v.z * c + (axis.x * v.y - axis.y * v.x) * s + axis.z * d * (1 - c),
    };
  }

  // The true body basis, before shake. Camera.forward/right/up are the
  // *rendered* basis and may carry a transient kick on top of these.
  let tF = { x: 0, y: 0, z: 1 };
  let tR = { x: 1, y: 0, z: 0 };
  let tU = { x: 0, y: 1, z: 0 };

  const Camera = SF.camera = {
    // Body angular rates, radians/sec. Positive: yaw right, pitch nose-down,
    // roll right-wing-down.
    yawRate: 0, pitchRate: 0, rollRate: 0,

    // Rendered basis, rebuilt once per frame.
    forward: { x: 0, y: 0, z: 1 },
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },

    // Screen geometry, in CSS pixels. `focal` is min(W,H)·0.82.
    W: 1, H: 1, cx: 0, cy: 0, focal: 1,

    // A transient kick, as a rotation vector in world coordinates, used for
    // near-misses and crashes. It shakes the view without touching where the
    // ship is actually pointing.
    shake: { x: 0, y: 0, z: 0 },

    get trueForward() { return tF; },
    get trueRight() { return tR; },
    get trueUp() { return tU; },

    reset() {
      tF = { x: 0, y: 0, z: 1 };
      tR = { x: 1, y: 0, z: 0 };
      tU = { x: 0, y: 1, z: 0 };
      Camera.yawRate = 0; Camera.pitchRate = 0; Camera.rollRate = 0;
      Camera.shake = { x: 0, y: 0, z: 0 };
      Camera.rebuild();
    },

    setViewport(w, h) {
      Camera.W = w; Camera.H = h;
      Camera.cx = w / 2; Camera.cy = h / 2;
      Camera.focal = Math.min(w, h) * SF.FOCAL;
    },

    /**
     * Point the nose at a direction, levelling the wings against world up.
     * Used at launch, and by anything that wants to snap onto a bearing.
     */
    lookAt(dir) {
      const f = v3.normalize(dir);
      // Any world axis not parallel to f will do as the levelling reference.
      const ref = Math.abs(f.y) > 0.999 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
      tF = f;
      tR = v3.normalize(v3.cross(ref, f));
      tU = v3.cross(f, tR);
      Camera.rebuild();
    },

    /**
     * Steering drives angular *rate*, not position. `sx`/`sy`/`sr` are the
     * normalised stick in [-1, 1] for yaw, pitch and roll; `dt` is real
     * seconds. The rates chase the stick rather than snapping to it, which
     * is what gives the ship mass.
     */
    steer(sx, sy, sr, dt, agility = 1) {
      const MAX_RATE = 1.15;        // radians per second at full deflection
      const MAX_ROLL = 1.9;         // roll is the fast axis on any real ship
      const RESPONSE = 5.0;         // how fast the rate chases the stick
      const k = 1 - Math.exp(-RESPONSE * dt);
      Camera.yawRate += (sx * MAX_RATE * agility - Camera.yawRate) * k;
      Camera.pitchRate += (sy * MAX_RATE * agility - Camera.pitchRate) * k;
      Camera.rollRate += (sr * MAX_ROLL * agility - Camera.rollRate) * k;
      Camera.integrate(dt);
    },

    /**
     * Rotate the basis by the current body rates. All three axes are folded
     * into one world-frame angular velocity and applied as a single rotation,
     * so combined inputs compose correctly instead of fighting each other the
     * way sequential Euler updates do.
     *
     * Sign conventions, checked against the old Euler basis so steering feels
     * identical on the two axes that already existed: yaw is a rotation about
     * +up (positive = nose right), pitch about +right (positive = nose down),
     * roll about −forward (positive = right wing down).
     */
    integrate(dt) {
      const wx = tR.x * Camera.pitchRate + tU.x * Camera.yawRate - tF.x * Camera.rollRate;
      const wy = tR.y * Camera.pitchRate + tU.y * Camera.yawRate - tF.y * Camera.rollRate;
      const wz = tR.z * Camera.pitchRate + tU.z * Camera.yawRate - tF.z * Camera.rollRate;
      const mag = Math.hypot(wx, wy, wz);
      if (mag > 1e-9) {
        const axis = { x: wx / mag, y: wy / mag, z: wz / mag };
        const angle = mag * dt;
        tF = rotateAbout(tF, axis, angle);
        tR = rotateAbout(tR, axis, angle);
        tU = rotateAbout(tU, axis, angle);
      }
      // Gram-Schmidt, with the nose authoritative. Rotating three vectors
      // independently lets rounding error creep the basis out of square over
      // a long flight; this puts it back every frame for a few flops.
      tF = v3.normalize(tF);
      const dot = v3.dot(tR, tF);
      tR = v3.normalize({ x: tR.x - tF.x * dot, y: tR.y - tF.y * dot, z: tR.z - tF.z * dot });
      tU = v3.cross(tF, tR);
    },

    kick(yaw, pitch, roll) {
      Camera.shake.x += tR.x * pitch + tU.x * yaw - tF.x * roll;
      Camera.shake.y += tR.y * pitch + tU.y * yaw - tF.y * roll;
      Camera.shake.z += tR.z * pitch + tU.z * yaw - tF.z * roll;
    },

    decayKick(dt) {
      const k = Math.exp(-7 * dt);
      Camera.shake.x *= k; Camera.shake.y *= k; Camera.shake.z *= k;
    },

    rebuild() {
      const s = Camera.shake;
      const mag = Math.hypot(s.x, s.y, s.z);
      if (mag < 1e-9) {
        Camera.forward = tF; Camera.right = tR; Camera.up = tU;
        return;
      }
      const axis = { x: s.x / mag, y: s.y / mag, z: s.z / mag };
      Camera.forward = rotateAbout(tF, axis, mag);
      Camera.right = rotateAbout(tR, axis, mag);
      Camera.up = rotateAbout(tU, axis, mag);
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
