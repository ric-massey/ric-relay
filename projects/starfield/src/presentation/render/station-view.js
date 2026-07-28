/* ══════════════════════════════════════════════════════════════════════
   station-view.js — the ISS, at 109 metres across, built here.

   Vertical Slice decision §19.1 sets the bar exactly: the start is the
   real ISS, but it only needs to be **recognisably** the ISS. Get the
   silhouette right — truss, arrays, module stack — and stop. This is a web
   page; replica fidelity is not the goal, and a downloaded model would
   bring a licence question (Data Sources §5) for something the player sees
   as a shape against Earth.

   So it is built from primitives, in-house, and the proportions are the
   published ones:

     · integrated truss           108.5 m, across the direction of travel
     · four solar array wings     34 m × 12 m each, in pairs, eight total
     · pressurised module stack    73 m, along the direction of travel
     · thermal radiators           three panels, edge-on to the Sun

   Attitude is the real flight attitude, and it is not decoration: the ISS
   flies "+XVV" — modules along the velocity vector, truss across it, one
   face permanently toward Earth. That is why the arrays are where they
   are, and it is the attitude the local orbital frame is defined in, so
   the station and the frame you fly relative to it agree by construction.

   Lighting is the project's usual: physical radiance out, the eye applied
   once by the tone mapper. Nothing here is emissive except the docking
   lights, and those are dim on purpose.
   ══════════════════════════════════════════════════════════════════════ */

import * as THREE from "../../../vendor/three/three.module.min.js";
import { STATION } from "../../simulation/world/station.js";

const LOGDEPTH_V_PARS = "#include <common>\n#include <logdepthbuf_pars_vertex>";
const LOGDEPTH_V = "#include <logdepthbuf_vertex>";
const LOGDEPTH_F_PARS = "#include <common>\n#include <logdepthbuf_pars_fragment>";
const LOGDEPTH_F = "#include <logdepthbuf_fragment>";
const OUTPUT = "#include <tonemapping_fragment>\n#include <colorspace_fragment>";

const VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  varying vec3 vNormalView;
  varying vec3 vViewDir;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
    ${LOGDEPTH_V}
  }
`;

const FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform vec3 albedo;
  uniform vec3 sunDirWorld;
  uniform vec3 earthDirWorld;      // toward Earth's centre, for the bounce
  uniform float sunIrradiance;
  uniform float earthAlbedoLight;  // irradiance reflected up off the planet
  uniform float gloss;
  uniform float emissive;

  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    ${LOGDEPTH_F}
    vec3 N = normalize(vNormalView);
    // Two-sided: solar arrays and radiators are thin panels, and half of
    // them face away from the camera at any moment. Without this they go
    // black from behind and the station loses its silhouette.
    if (!gl_FrontFacing) N = -N;

    vec3 L = normalize((viewMatrix * vec4(sunDirWorld, 0.0)).xyz);
    vec3 E = normalize((viewMatrix * vec4(earthDirWorld, 0.0)).xyz);
    vec3 V = normalize(vViewDir);

    const float INV_PI = 0.31830988618;

    // Direct sun, Lambertian, with the same 1/π every other surface here
    // takes. This is a radiance, not an exitance.
    vec3 colour = albedo * max(dot(N, L), 0.0) * sunIrradiance * INV_PI;

    // Earthshine. From 420 km the planet fills 140° of the sky below and
    // throws back a real fraction of the sunlight falling on it, which is
    // why the underside of the station is never black in photographs.
    colour += albedo * max(dot(N, E), 0.0) * earthAlbedoLight * INV_PI;

    // A tight specular lobe. The arrays and the foil are close to mirrors,
    // and the flash off them as the geometry lines up is most of what
    // makes the structure read as metal rather than as painted cardboard.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 60.0) * gloss * max(dot(N, L), 0.0);
    colour += vec3(1.0, 0.98, 0.94) * spec * sunIrradiance;

    colour += albedo * emissive;

    gl_FragColor = vec4(colour, 1.0);
    ${OUTPUT}
  }
`;

/* Albedos as linear reflectances, not as picked colours.
   The arrays are the odd one: ISS photovoltaic blankets look black-gold
   because they absorb most of what lands on them — that is their job. */
const MATERIALS = {
  module:   { albedo: [0.78, 0.76, 0.72], gloss: 0.10 },   // white thermal blanket
  truss:    { albedo: [0.42, 0.42, 0.44], gloss: 0.35 },   // bare aluminium
  array:    { albedo: [0.16, 0.10, 0.03], gloss: 0.55 },   // photovoltaic blanket
  radiator: { albedo: [0.85, 0.85, 0.86], gloss: 0.06 },   // white, high emissivity
  gold:     { albedo: [0.55, 0.40, 0.14], gloss: 0.45 },   // multi-layer insulation
  light:    { albedo: [0.9, 0.93, 1.0], gloss: 0.0, emissive: 0.004 },
};

function makeMaterial(kind) {
  const m = MATERIALS[kind];
  return new THREE.ShaderMaterial({
    uniforms: {
      albedo: { value: new THREE.Color(...m.albedo) },
      sunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
      earthDirWorld: { value: new THREE.Vector3(0, 0, -1) },
      sunIrradiance: { value: 1 },
      earthAlbedoLight: { value: 0.1 },
      gloss: { value: m.gloss },
      emissive: { value: m.emissive || 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
  });
}

/**
 * Build the station.
 *
 * Body axes match the flight attitude, so the group can be dropped
 * straight into the local orbital frame with no fudge rotation:
 *
 *     +x  direction of travel   (the module stack runs along it)
 *     +y  across track          (the truss runs along it)
 *     +z  nadir, toward Earth   (the radiators and the Earth-facing face)
 */
export function createStation(quality = "high") {
  const group = new THREE.Group();
  group.name = "station";

  const mats = {};
  const material = (kind) => (mats[kind] ||= makeMaterial(kind));

  const add = (geo, kind, pos, rot) => {
    const mesh = new THREE.Mesh(geo, material(kind));
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    group.add(mesh);
    return mesh;
  };

  const radial = quality === "low" ? 8 : quality === "medium" ? 12 : 20;

  /* ── the integrated truss ──
     108.5 m end to end, across the direction of travel. Segmented, because
     an unbroken bar reads as a girder and the real thing is visibly a
     series of bays. */
  const trussHalf = 108.5 / 2;
  add(new THREE.BoxGeometry(1.8, 108.5, 1.8), "truss");
  for (let i = -4; i <= 4; i++) {
    if (i === 0) continue;
    add(new THREE.BoxGeometry(4.4, 0.35, 4.4), "truss", [0, i * 11, 0]);
  }

  /* ── solar array wings ──
     Four pairs, 34 m long and 11.6 m wide, mounted outboard on rotary
     joints. Each pair straddles the truss, which is why they read as eight
     panels rather than four. They lie in the x–y plane, edge-on to nadir,
     and the real ones track the Sun about the truss axis — see
     `setArrayAngle` below. */
  const arrays = [];
  // Long fore-and-aft, wide across, and thin — so the blanket's normal is
  // ±z and the rotary joint below can sweep it through the x–z plane,
  // which is the axis the real joint turns about.
  const arrayGeo = new THREE.BoxGeometry(34, 11.6, 0.35);
  for (const side of [-1, 1]) {
    for (const pair of [0, 1]) {
      const y = side * (trussHalf - 6 - pair * 20);
      const pivot = new THREE.Group();
      pivot.position.set(0, y, 0);
      group.add(pivot);
      // Two wings per assembly, extending forward and aft from the mast.
      for (const x of [-18, 18]) {
        const wing = new THREE.Mesh(arrayGeo, material("array"));
        wing.position.set(x, 0, 0);
        pivot.add(wing);
      }
      // The mast the blankets are stretched along, running fore-and-aft.
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 6), material("truss"));
      mast.rotation.z = Math.PI / 2;
      pivot.add(mast);
      arrays.push(pivot);
    }
  }

  /* ── thermal radiators ──
     Three white panels near the centre of the truss, deployed toward
     nadir and held edge-on to the Sun. They are what stops the station
     cooking, and they are a big part of the silhouette from below. */
  for (let i = -1; i <= 1; i++) {
    add(new THREE.BoxGeometry(0.3, 12, 22), "radiator", [0, i * 14, 14], [0, 0, 0]);
  }

  /* ── the pressurised module stack ──
     73 m along the direction of travel: Zarya, Unity, Destiny, Harmony,
     Columbus, Kibo and the Russian segment, at 4.2 m diameter. Modelled as
     one run of cylinders with the two big side modules, because that is
     what survives at any distance you will actually see it from. */
  const moduleGeo = new THREE.CylinderGeometry(2.1, 2.1, 12, radial);
  for (let i = -3; i <= 2; i++) {
    add(moduleGeo, "module", [i * 11 + 5.5, 0, 3.5], [0, 0, Math.PI / 2]);
  }
  // Node connectors, slightly fatter, at the joins.
  for (let i = -2; i <= 2; i++) {
    add(new THREE.CylinderGeometry(2.4, 2.4, 2.4, radial), "module",
        [i * 11 + 5.5 + 5.5, 0, 3.5], [0, 0, Math.PI / 2]);
  }
  // Two side modules on the same node, which is what gives the stack its
  // recognisable T rather than a plain tube.
  add(new THREE.CylinderGeometry(2.1, 2.1, 10, radial), "module", [-16.5, 5, 3.5]);
  add(new THREE.CylinderGeometry(2.1, 2.1, 10, radial), "module", [-16.5, -5, 3.5]);
  // The forward node and its cupola blister — the window everyone knows.
  add(new THREE.SphereGeometry(1.6, radial, radial / 2), "gold", [30, 0, 3.5]);
  add(new THREE.CylinderGeometry(1.3, 1.6, 1.2, radial), "gold", [28, 0, 6.4], [0, 0, 0]);

  /* ── the mast joining stack to truss ── */
  add(new THREE.CylinderGeometry(1.4, 1.4, 6, radial), "truss", [-5.5, 0, 1.6]);

  /* ── navigation lights ──
     Dim, and dim deliberately: they are visible against a dark station on
     the night side and invisible in daylight, which is how running lights
     behave. */
  const lightGeo = new THREE.SphereGeometry(0.35, 6, 4);
  for (const p of [[0, trussHalf, 0], [0, -trussHalf, 0], [36, 0, 3.5], [-40, 0, 3.5]]) {
    add(lightGeo, "light", p);
  }

  return {
    group,
    arrays,
    materials: () => Object.values(mats),
    /**
     * Turn the array wings to face the Sun.
     *
     * The real joints rotate about the truss axis and track continuously,
     * which is why the arrays are edge-on at some points in the orbit and
     * flat-on at others. It is a one-axis approximation of a two-axis
     * system, and at the distances the slice is flown from that difference
     * is invisible — but the tracking itself is not, because the arrays
     * swinging is one of the few ways you can see the station is *working*.
     *
     * @param {THREE.Vector3} sunLocal the Sun's direction in station axes
     */
    setArrayAngle(sunLocal) {
      const angle = Math.atan2(sunLocal.x, sunLocal.z);
      for (const a of arrays) a.rotation.y = angle;
    },
  };
}

export { STATION };
