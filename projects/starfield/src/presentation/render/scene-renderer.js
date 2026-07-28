/* ══════════════════════════════════════════════════════════════════════
   scene-renderer.js — the presentation layer, and only the presentation.

   Technical Architecture §2.1 and §12.1. Nothing in this file is allowed
   to be the truth about anything. It receives world state in metres in the
   Earth-centred frame and turns it into pixels; if it were deleted the
   simulation would still know where everything is.

   The one hard problem it does own is precision. Three renders in float32,
   which has 24 bits of mantissa — about seven decimal digits. The Moon is
   4×10⁸ metres away, so a float32 position there resolves to roughly 30
   metres, and the ship's own position would resolve to metres while it is
   trying to hold station at centimetres per second.

   The fix is the floating origin (§6.3): the renderer keeps a
   double-precision origin in the authoritative frame, and every mesh is
   placed relative to it. The camera never wanders more than a kilometre
   from the numerical origin, so near-field precision is always
   millimetric. When the camera does pass that threshold the origin jumps
   and every representation is rebased in the same instant — which is why
   an origin shift is invisible (and why there is a test that proves it).
   ══════════════════════════════════════════════════════════════════════ */

import * as THREE from "../../../vendor/three/three.module.min.js";
import { createBodies } from "./bodies-view.js";
import { createStation } from "./station-view.js";
import { SkyView } from "./sky-view.js";
import { Adaptation } from "./adaptation.js";
import { sub, length } from "../../simulation/core/linalg.js";
import { apparentMagnitude } from "../../simulation/world/planets.js";
import { K } from "../../simulation/core/units.js";

/** How far the camera may drift from the render origin before it is rebased. */
export const ORIGIN_THRESHOLD_M = 1000;

/**
 * The unzoomed field of view, degrees.
 *
 * One number, exported, because four things have to agree about it: both
 * cameras, the zoom-reset key, the look-sensitivity scale that divides by
 * it, and the HUD readout. They were four literal 55s, which is three
 * opportunities for the view and the pointer to disagree about how wide
 * the world is.
 */
export const DEFAULT_FOV = 80;

export class SceneRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   * @param {'low'|'medium'|'high'} opts.quality
   * @param {Array} opts.starCatalogue
   */
  constructor(canvas, { quality = "high", starCatalogue = [] } = {}) {
    this.quality = quality;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== "low",
      // Without this, a scene spanning 420 km to 1 au z-fights itself apart.
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES is a film response curve. It is used here for its shoulder: it
    // rolls highlights off instead of clipping them to flat white, which is
    // what an overexposed sunlit limb needs.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 1, 6e11);

    // The sky is rendered with the camera's rotation only, so the stars
    // have no parallax and no depth interaction. Ledger SF-L-007.
    this.skyCamera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 0.1, 1e10);
    this.sky = new SkyView(starCatalogue);

    const built = createBodies(quality);
    this.bodies = built;
    this.scene.add(built.earth, built.atmosphere, built.moon, built.sun, built.sunGlare);

    this.station = createStation(quality);
    this.scene.add(this.station.group);

    this.adaptation = new Adaptation();

    /** Render origin, in the Earth-centred inertial frame, metres (doubles). */
    this.origin = { x: 0, y: 0, z: 0 };
    /** How many times the origin has been rebased this session. */
    this.originShifts = 0;

    this._raycaster = new THREE.Raycaster();
    this._pickables = [built.earth, built.moon, built.sun, this.station.group];

    this.resize();
  }

  resize() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    // Cap the pixel ratio: a 3× phone display costs nine times the fill rate
    // for a difference nobody can see through a canopy.
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === "low" ? 1 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.skyCamera.aspect = w / h;
    this.skyCamera.fov = this.camera.fov;
    this.skyCamera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
    this.dpr = dpr;
  }

  /** Field of view, degrees. Used by the optical-zoom control. */
  setFov(deg) {
    this.camera.fov = deg;
    this.camera.updateProjectionMatrix();
    this.skyCamera.fov = deg;
    this.skyCamera.updateProjectionMatrix();
  }

  /** Convert an Earth-centred position (metres, doubles) into render space. */
  toRender(eci) {
    return new THREE.Vector3(eci.x - this.origin.x, eci.y - this.origin.y, eci.z - this.origin.z);
  }

  /**
   * Rebase the render origin onto the camera if it has drifted too far.
   * Returns true if a shift happened — the tests watch this.
   */
  maybeShiftOrigin(cameraEci) {
    if (length(sub(cameraEci, this.origin)) < ORIGIN_THRESHOLD_M) return false;
    this.origin = { x: cameraEci.x, y: cameraEci.y, z: cameraEci.z };
    this.originShifts++;
    return true;
  }

  /**
   * Place everything for this frame.
   *
   * @param {object} view
   * @param {{x,y,z}} view.cameraEci      camera position, Earth-centred, metres
   * @param {THREE.Quaternion} view.orientation
   * @param {object} view.world           WorldService state
   * @param {object} view.frames          FrameGraph, for body orientations
   * @param {Array}  view.observations    WorldService.observe results
   * @param {number} view.dt              seconds since the last frame
   */
  update(view) {
    const { cameraEci, orientation, world, frames, observations, dt } = view;

    this.maybeShiftOrigin(cameraEci);

    this.camera.position.copy(this.toRender(cameraEci));
    this.camera.quaternion.copy(orientation);
    this.skyCamera.quaternion.copy(orientation);

    const sunEci = world.bodies.sun.position;
    const moonEci = world.bodies.moon.position;

    // Sun direction as a unit vector in render space — the same vector every
    // shader lights with, so nothing can disagree about where the Sun is.
    const sunDir = new THREE.Vector3(sunEci.x, sunEci.y, sunEci.z).normalize();

    /* ── Earth ── */
    this.bodies.earth.position.copy(this.toRender({ x: 0, y: 0, z: 0 }));
    this.bodies.earth.quaternion.copy(this._orientationOf(frames, "ECEF", world.t));
    this.bodies.earth.material.uniforms.sunDirWorld.value.copy(sunDir);

    /* ── Atmosphere ── */
    const atmo = this.bodies.atmosphere;
    atmo.position.copy(this.bodies.earth.position);
    atmo.material.uniforms.sunDirWorld.value.copy(sunDir);
    atmo.material.uniforms.cameraLocal.value
      .copy(this.camera.position)
      .sub(atmo.position);

    /* ── Moon ── */
    this.bodies.moon.position.copy(this.toRender(moonEci));
    this.bodies.moon.quaternion.copy(this._orientationOf(frames, "MCMF", world.t));
    const moonMat = this.bodies.moon.material;
    moonMat.uniforms.sunDirWorld.value
      .copy(new THREE.Vector3(sunEci.x - moonEci.x, sunEci.y - moonEci.y, sunEci.z - moonEci.z))
      .normalize();
    moonMat.uniforms.earthDirWorld.value
      .copy(new THREE.Vector3(-moonEci.x, -moonEci.y, -moonEci.z))
      .normalize();

    /* ── Sun ── */
    this.bodies.sun.position.copy(this.toRender(sunEci));
    // Irradiance falls off as 1/r². At Earth this is 1 by construction.
    const sunDistance = Math.hypot(sunEci.x, sunEci.y, sunEci.z);
    const irradiance = Math.pow(K.AU.value / sunDistance, 2);
    this.bodies.earth.material.uniforms.sunIrradiance.value = irradiance;
    this.bodies.atmosphere.material.uniforms.sunIntensity.value = irradiance;
    /* Earth and its air need no shadow term — each computes its own
       terminator from the surface normal, which is what a terminator is.
       Everything that is not the body casting the shadow does need one. */
    moonMat.uniforms.sunIrradiance.value = irradiance * (world.bodies.moon.sunlit ?? 1);

    /* ── The Sun's own brightness ──
       Its radiance is its irradiance divided by the solid angle it covers,
       which is the *same* quantity the adaptation model computes when it
       decides how blinding the Sun is. Both must come from this one
       calculation: a hand-picked brightness here and a physical one there
       is how you get a Sun that the eye model treats as dazzling while the
       renderer draws it as a dim grey dot. */
    const sunAngularRadius = Math.asin(
      Math.min(1, K.SUN_RADIUS.value / Math.max(sunDistance, 1))
    );
    const sunSolidAngle = 2 * Math.PI * (1 - Math.cos(sunAngularRadius));
    const sunRadiance = irradiance / Math.max(sunSolidAngle, 1e-12);
    this.bodies.sun.material.uniforms.intensity.value = sunRadiance;

    /* ── The Sun's glare ──
       Sized in world units so it sits at the Sun's own distance and is
       occluded by anything in front of it. The halo grows as the eye
       dark-adapts, because the same scatter spreads across a far larger
       apparent area when the pupil is open and the retina is sensitive. */
    const glare = this.bodies.sunGlare;
    const adapted = this.adaptation.adapted;
    // The halo is tens of degrees across, not a tight ring: veiling glare
    // from the Sun washes out a large part of the field, which is why you
    // cannot see anything near it even when the disc itself is small. At
    // 14× the Sun's diameter this is about 7°; dark-adapted it reaches
    // roughly 25°, and at that point the sky around it is simply gone.
    const spread = 14 + 36 * Math.min(1, Math.max(0, (Math.log10(0.1 / Math.max(adapted, 1e-9))) / 3.5));
    glare.position.copy(this.bodies.sun.position);
    glare.quaternion.copy(this.camera.quaternion);      // billboard
    glare.scale.setScalar(K.SUN_RADIUS.value * 2 * spread);
    // Scatter carries a small fraction of the source's light, spread over a
    // far larger area — so it is dim per unit area but impossible to ignore.
    // Divided by the spread squared because the same light is being smeared
    // across that much more sky.
    glare.material.uniforms.intensity.value = sunRadiance * 0.55 / (spread * spread);

    /* ── The station ──
       Placed at its own state and oriented into the local orbital frame,
       so the mesh's body axes and the frame the player flies relative to
       it are the same triad by construction rather than by coincidence.
       Get this wrong and the arrays point the wrong way, which sounds
       cosmetic until you notice the station is flying sideways. */
    if (world.station) {
      const st = world.station;
      const group = this.station.group;
      group.position.copy(this.toRender(st.position));

      const alongTrack = new THREE.Vector3(st.velocity.x, st.velocity.y, st.velocity.z).normalize();
      const nadir = new THREE.Vector3(-st.position.x, -st.position.y, -st.position.z).normalize();
      const crossTrack = new THREE.Vector3().crossVectors(nadir, alongTrack).normalize();
      const along = new THREE.Vector3().crossVectors(crossTrack, nadir).normalize();
      group.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(along, crossTrack, nadir)
      );

      // Sun direction in the station's own axes, so the arrays can track it.
      const sunLocal = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z)
        .applyQuaternion(group.quaternion.clone().invert());
      this.station.setArrayAngle(sunLocal);

      // Earthshine on the underside: the fraction of sunlight the planet
      // below throws back up, falling off with the station's altitude the
      // way any extended source does.
      const earthDir = new THREE.Vector3(-st.position.x, -st.position.y, -st.position.z).normalize();
      const sunUp = Math.max(0, -earthDir.dot(new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z)));
      /* Orbital night. For roughly a third of every 92-minute orbit the
         station is inside Earth's shadow, and until this was here it was
         not: it stayed in full sunlight while the eye model — which has
         always known, because markOcclusions told it — dark-adapted for a
         night sky, and drew the station as a clipped white shape against
         it. `sunlit` is a fraction rather than a flag so the penumbra
         crossing takes the second or two it really takes. */
      const stationSunlit = st.sunlit ?? 1;
      for (const mat of this.station.materials()) {
        mat.uniforms.sunDirWorld.value.copy(sunDir);
        mat.uniforms.earthDirWorld.value.copy(earthDir);
        mat.uniforms.sunIrradiance.value = irradiance * stationSunlit;
        // Earth's albedo × how lit the ground below is × how much of the
        // sky it fills from 420 km, which is most of the lower hemisphere.
        mat.uniforms.earthAlbedoLight.value = 0.0955 * sunUp * irradiance * 1.6;
      }
    }

    /* ── Exposure ── */
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(orientation);
    this.adaptation.estimate(observations, look, (this.camera.fov * Math.PI) / 180);
    const exposure = this.adaptation.update(dt);

    /* One exposure, for everything.
​
       Every shader in both passes emits *physical radiance*, so the eye is
       applied exactly once, in one place, by the tone mapper — and both
       passes must get the same eye, or the sky and the planet in front of
       it are being seen by two different observers.

       There were two separate caps here, and both were bandages over other
       bugs. The scene was clamped to 120 because the city lights were being
       emitted at a hand-picked radiance a hundred thousand times too high,
       so any more exposure than that turned the night side into a sheet of
       white; the sky was clamped to 3000 to keep the star calibration where
       it had been tuned. Neither cap is needed now, and neither was ever
       principled: exposure is already bounded, because adaptation cannot go
       below the starlight floor. 0.18 ÷ 3×10⁻⁵ is 6000, and that is the
       most the eye can ever open. */
    this.exposure = exposure;
    this.sky.update(this.adaptation.adapted, this.dpr, exposure);

    /* Where the stars are seen *from*. This is what ends Phase 4's wallpaper
       problem: the sky pass draws with the camera's rotation only, so
       without this the view a million light-years out is pixel-identical to
       the view from low orbit. `setObserver` recomputes apparent direction
       and apparent magnitude from each star's true range, and ignores the
       call until the ship has actually gone somewhere — so the entire
       Earth–Moon slice costs nothing. Same `cameraEci` the planets use. */
    this.sky.setObserver(cameraEci);

    /* The planets, every frame, because they are the only things in the sky
       pass that move. Their range is measured from the *camera*, not from
       Earth's centre: at 400 km that changes nothing, and the moment the
       ship is anywhere else it changes everything. */
    if (world?.planets) {
      this.sky.setPlanets(world.planets, (p) => {
        const range = length(sub(p.position, cameraEci));
        return apparentMagnitude(p, range);
      });
    }

    return { exposure, look };
  }

  /** Body-fixed orientation of a frame, as a render-space quaternion. */
  _orientationOf(frames, frameId, t) {
    const { R } = frames._transform(frameId, t);
    // R takes parent-axis vectors to child axes; the mesh needs the inverse.
    const m = new THREE.Matrix4().set(
      R[0], R[3], R[6], 0,
      R[1], R[4], R[7], 0,
      R[2], R[5], R[8], 0,
      0, 0, 0, 1
    );
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }

  render() {
    this.renderer.clear();
    this.renderer.toneMappingExposure = this.exposure ?? 1;
    this.renderer.render(this.sky.scene, this.skyCamera);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Project an Earth-centred position to screen coordinates for the HUD.
   * Returns null when the point is behind the camera.
   */
  project(eci) {
    const p = this.toRender(eci).project(this.camera);
    if (p.z > 1) return null;
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-p.y * 0.5 + 0.5) * this.height,
      behind: false,
    };
  }

  /**
   * Project a *direction* rather than a position — where on the glass a
   * given heading appears. Used for the prograde and retrograde markers,
   * which are directions, not places: they sit at infinity along the
   * velocity vector and do not move as the ship translates.
   *
   * @param {{x,y,z}} dirEci  need not be normalised
   * @returns {{x:number,y:number}|null} null when it is behind the camera
   */
  projectDirection(dirEci) {
    const d = new THREE.Vector3(dirEci.x, dirEci.y, dirEci.z).normalize();
    // Far enough that the camera's own position cannot bend the result,
    // near enough to stay well inside the far plane.
    const p = this.camera.position.clone().addScaledVector(d, 1e8).project(this.camera);
    if (p.z > 1) return null;
    return {
      x: (p.x * 0.5 + 0.5) * this.width,
      y: (-p.y * 0.5 + 0.5) * this.height,
    };
  }

  /**
   * What is under this screen point? Real geometry first, then the star
   * field. Hit areas may exceed an object's drawn size (§12.4, ledger
   * SF-L-010) — you must be able to select a body that is two pixels wide.
   */
  pick(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / this.width) * 2 - 1,
      -(clientY / this.height) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.camera);
    // Recursive, because the station is a group of a few dozen parts and
    // the player is picking "the station", not a radiator panel. The walk
    // up to the named ancestor is what turns a hit on a truss segment into
    // the selection the HUD can talk about.
    const hits = this._raycaster.intersectObjects(this._pickables, true);
    for (const hit of hits) {
      for (let o = hit.object; o; o = o.parent) {
        if (o.name) return { kind: "body", id: o.name };
      }
    }
    return null;
  }

  /** Unit view direction, Earth-centred, for a screen point. */
  rayDirection(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / this.width) * 2 - 1,
      -(clientY / this.height) * 2 + 1
    );
    this._raycaster.setFromCamera(ndc, this.camera);
    return this._raycaster.ray.direction.clone();
  }
}
