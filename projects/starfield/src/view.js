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
    beta: 0,
    gamma: 1,
    forward: { x: 0, y: 0, z: 1 },
    // Set false inside an Alcubierre bubble, where the ship is locally at
    // rest and none of this applies.
    relativistic: true,

    setState(beta, gamma, forward, relativistic = true) {
      View.beta = beta;
      View.gamma = gamma;
      View.forward = forward;
      View.relativistic = relativistic;
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
      return {
        dir: out,
        cos: cosA,
        D: 1 / (View.gamma * (1 - beta * cosA)),
        mag: Math.sqrt((1 - beta * beta)) / denom,
      };
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
