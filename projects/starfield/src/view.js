/* ══════════════════════════════════════════════════════════════════════
   view.js — where things actually appear, and what colour they are there.

   Everything drawn in this game goes through here first, because at these
   speeds "where the thing is" and "where you see the thing" are different
   questions. Given a direction in the frame where the object sits still,
   this returns:

     dir    the direction you actually see it, after aberration
     D      its Doppler factor, which shifts its blackbody temperature
     mag    how much its angular size is stretched or squashed

   The world is stored uncontracted — positions are home-frame, relative to
   the ship — so the direction handed in here is already the rest-frame one
   and aberration is a single application of

     cos θ' = (cos θ + β) / (1 + β cos θ)

   Sizes use the square root of the aberration Jacobian, so an object dead
   ahead at γ shrinks by ~2γ as the sky piles up in front of it, while its
   brightness climbs by D⁴. Those two fighting each other is the starbow.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const v3 = SF.v3;

  const View = SF.view = {
    // WHAT YOU SEE. These are the values the renderer aberrates by, and they
    // ease toward the ship's honest β so that an abrupt change of speed is a
    // short crossfade rather than a cut.
    //
    // THERE IS ONLY ONE REGIME. Every gear aberrates, from a standstill to the
    // top of the ladder, because β is continuous the whole way up: celerity has
    // no ceiling but β = u/√(1+u²) never reaches 1. The high gears used to
    // switch all of this off and paint a blue bubble wall instead, which is why
    // shifting into one rewrote the entire screen. Now they simply have a
    // larger γ, and the sky does what an enormous γ does — tightens the cone
    // toward a point and puts everything else in the dark.
    beta: 0,
    gamma: 1,
    forward: { x: 0, y: 0, z: 1 },
    relativistic: true,
    easeSeconds: 0.45,

    setState(beta, gamma, forward, relativistic = true, dt = 0) {
      View.forward = forward;
      // There is no second regime to cross any more: β is continuous from a
      // standstill to the top gear, so the easing is only here to smooth a
      // sudden change (a full stop, a relaunch) rather than to hide a switch.
      const target = relativistic ? beta : 0;
      if (dt > 0) {
        const k = 1 - Math.exp(-dt / View.easeSeconds);
        View.beta += (target - View.beta) * k;
        // Land exactly, so a coasting ship is not left aberrating by 10⁻⁵.
        if (Math.abs(target - View.beta) < 1e-4) View.beta = target;
      } else {
        View.beta = target;
      }
      // γ follows from the β actually being drawn, so the two never disagree.
      View.gamma = 1 / Math.sqrt(Math.max(1e-12, 1 - View.beta * View.beta));
      View.relativistic = View.beta > 1e-4;
      void gamma;
    },

    /** Snap to a state with no crossfade — for a relaunch. */
    reset(forward) {
      View.beta = 0;
      View.gamma = 1;
      View.relativistic = true;
      if (forward) View.forward = forward;
    },

    /**
     * Apparent direction, Doppler factor and angular magnification for a
     * rest-frame unit direction.
     */
    apparent(dir) {
      const beta = View.relativistic ? View.beta : 0;
      if (beta < 1e-6) {
        return { dir, cos: v3.dot(dir, View.forward), D: 1, mag: 1 };
      }
      const f = View.forward;
      const cosT = Math.max(-1, Math.min(1, v3.dot(dir, f)));
      const cosA = (cosT + beta) / (1 + beta * cosT);

      // Rebuild the direction: keep the azimuth about the flight axis,
      // replace the polar angle.
      let out;
      const px = dir.x - f.x * cosT;
      const py = dir.y - f.y * cosT;
      const pz = dir.z - f.z * cosT;
      const perpLen = Math.hypot(px, py, pz);
      if (perpLen < 1e-9) {
        out = { x: f.x, y: f.y, z: f.z };
      } else {
        const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA)) / perpLen;
        out = {
          x: f.x * cosA + px * sinA,
          y: f.y * cosA + py * sinA,
          z: f.z * cosA + pz * sinA,
        };
      }

      const denom = 1 + beta * cosT;
      // (1 − β cos θ′) via the stable split in relativity.js: past γ ≈ 10⁸ the
      // direct form cancels to exactly zero and every Doppler factor in the
      // sky comes back Infinity.
      const gam = View.gamma;
      const D = 1 / (gam * SF.rel.oneMinusBetaCos(cosA, beta, gam));
      // √(1−β²) is 1/γ exactly, and unlike the square root it does not
      // underflow to zero when β rounds to 1.
      return { dir: out, cos: cosA, D, mag: (1 / gam) / denom };
    },

    /**
     * Full treatment for a positioned object: apparent direction, distance,
     * Doppler, and the screen projection. Returns null when it is behind you.
     */
    project(pos, radiusLy) {
      const dist = Math.hypot(pos.x, pos.y, pos.z);
      if (dist < 1e-9) return null;
      const dir = { x: pos.x / dist, y: pos.y / dist, z: pos.z / dist };
      const app = View.apparent(dir);
      const angular = radiusLy ? (radiusLy / dist) * app.mag : 0;
      const screen = SF.camera.project(app.dir, angular);
      if (!screen) return null;
      screen.dist = dist;
      screen.D = app.D;
      screen.cos = app.cos;
      screen.mag = app.mag;
      return screen;
    },
  };
})();
