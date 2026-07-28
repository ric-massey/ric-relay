/* ══════════════════════════════════════════════════════════════════════
   bodies-view.js — Earth, the Moon and the Sun, at the size they are.

   Design Bible Law 1: nothing here is enlarged. Earth's mesh is 6 378 137
   metres in radius, the Moon's is 1 737 400, and the gap between them is
   whatever the ephemeris says it is. If the Moon is a few pixels wide, the
   Moon is a few pixels wide, and the HUD's marker — not the geometry —
   is what makes it clickable.

   All four shaders here include Three's logarithmic-depth chunks. That is
   not decoration: a scene containing a 420 km altitude and a 150 million
   km Sun has a depth range of 3.6×10⁸:1, and a conventional depth buffer
   quantises that into visible sheets of z-fighting.
   ══════════════════════════════════════════════════════════════════════ */

import * as THREE from "../../../vendor/three/three.module.min.js";
import { K } from "../../simulation/core/units.js";

/* Shared GLSL: Three's log-depth support.

   There is deliberately no sRGB decode in any of these shaders. Three tags
   these textures SRGBColorSpace, and on WebGL2 that is not a shader
   annotation — it selects the SRGB8_ALPHA8 internal format, so the sampler
   itself decodes on every fetch and texture2D() already returns linear
   radiance. A srgbToLinear() here is therefore a *second* decode, and it is
   not a small error: it took the Atlantic from 0.033 to 0.0026, thirteen
   times too dark, and rendered a fully sunlit Earth as very nearly black.
   Bright texels lose about a factor of six and dark ones more than thirteen,
   so the ocean — most of the planet — collapses first, which is why the bug
   read as "the Earth is black" rather than "the Earth is dim".

   Decoding in hardware is also the only way to filter correctly. Bilinear
   and mipmap averaging must happen in linear light; a decode written into
   the fragment shader happens after the averaging, not before. */
const LOGDEPTH_V_PARS = "#include <common>\n#include <logdepthbuf_pars_vertex>";
const LOGDEPTH_V = "#include <logdepthbuf_vertex>";
const LOGDEPTH_F_PARS = "#include <common>\n#include <logdepthbuf_pars_fragment>";
const LOGDEPTH_F = "#include <logdepthbuf_fragment>";

/* Three does not append its output pipeline to a custom ShaderMaterial the
   way it does for the built-in materials. Without these two chunks the
   exposure the adaptation model computes is silently ignored, and linear
   radiance values are written straight to the framebuffer as though they
   were already sRGB — which leaves the entire scene several stops too dark
   and makes the eye model do nothing at all. Every fragment shader here
   ends with them. */
const OUTPUT = "#include <tonemapping_fragment>\n#include <colorspace_fragment>";

/* ══════════════════════════════════════════════════════════════════════
   Earth
   ══════════════════════════════════════════════════════════════════════ */

const EARTH_VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
    ${LOGDEPTH_V}
  }
`;

const EARTH_FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDirWorld;
  uniform float sunIrradiance;   // 1.0 = the solar constant at 1 au
  uniform float nightGain;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    ${LOGDEPTH_F}
    vec3 N = normalize(vNormalView);
    vec3 L = normalize((viewMatrix * vec4(sunDirWorld, 0.0)).xyz);
    float ndl = dot(N, L);

    // The terminator is not a line. The Sun is half a degree across, so its
    // penumbra alone spans about 0.27°, and refraction through the air
    // carries daylight roughly another 0.6° past the geometric edge. That
    // is what this smoothstep is — not an artistic soft edge.
    float lit = smoothstep(-0.021, 0.021, ndl);

    // Linear already — the sampler decoded them. See the note at the top.
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;

    // Lambertian radiance is albedo × irradiance × cos(incidence) ÷ π.
    // The 1/π is not a fudge and it is not optional: without it this
    // computes radiant exitance — the light leaving the surface summed
    // over the whole hemisphere — and calls it brightness, which is π
    // times too much.
    const float INV_PI = 0.31830988618;
    vec3 colour = day * max(ndl, 0.0) * sunIrradiance * INV_PI;

    // Ocean glint. Blue Marble's water is blue-dominant and dark, which
    // separates it from land well enough for a specular mask. Specular
    // reflection is not Lambertian, so it does not take the 1/π.
    float ocean = clamp((day.b - day.r) * 4.0, 0.0, 1.0);
    vec3 H = normalize(L + normalize(vViewDir));
    float spec = pow(max(dot(N, H), 0.0), 90.0) * ocean * max(ndl, 0.0);
    colour += vec3(1.0, 0.97, 0.9) * spec * 0.35 * sunIrradiance;

    // City lights, only where it is actually dark. The gain is a real
    // radiance, not a brightness dial — see the note where it is set.
    colour += night * (1.0 - lit) * nightGain;

    gl_FragColor = vec4(colour, 1.0);
    ${OUTPUT}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   Earth's atmosphere — single-scattering Rayleigh.

   Ledger SF-L-009. The wavelength dependence is the real 1/λ⁴ law
   evaluated at 680/550/440 nm, which is why the sky is that particular
   blue and the limb goes orange at grazing angles — those colours are
   computed, not chosen.
   ══════════════════════════════════════════════════════════════════════ */

const ATMO_VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  varying vec3 vLocal;
  void main() {
    vLocal = position;                       // sphere is built at the atmosphere radius
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    ${LOGDEPTH_V}
  }
`;

const ATMO_FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform vec3 cameraLocal;      // camera position relative to the planet centre, metres
  uniform vec3 sunDirWorld;
  uniform float planetRadius;
  uniform float atmoRadius;
  uniform float scaleHeight;
  uniform vec3 betaRayleigh;     // per metre
  uniform float sunIntensity;
  uniform int viewSamples;
  uniform int lightSamples;
  varying vec3 vLocal;

  /*
    Air in one segment of the ray, as a column density.

    Midpoint sampling cannot be used here. The atmosphere's scale height is
    8.5 km and an affordable number of samples makes each segment tens of
    kilometres long, so the density varies by an order of magnitude inside
    one step. Sampling the middle and multiplying by the length overstates
    the column near the ground several-fold, and the planet ends up wrapped
    in white haze.

    Height varies almost exactly linearly along a short segment, so the
    integral of exp(−h/H) along it has a closed form. This is that form,
    and it is why the atmosphere here is a thin skin rather than a fog.
  */
  float columnDensity(float hA, float hB, float len, float H) {
    float dh = hB - hA;
    if (abs(dh) < 1.0) return exp(-hA / H) * len;             // near-horizontal
    return len * H * (exp(-hA / H) - exp(-hB / H)) / dh;
  }

  // Returns (tNear, tFar) of a ray against a sphere at the origin, or
  // (1.0, -1.0) when it misses.
  vec2 raySphere(vec3 ro, vec3 rd, float r) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float d = b * b - c;
    if (d < 0.0) return vec2(1.0, -1.0);
    d = sqrt(d);
    return vec2(-b - d, -b + d);
  }

  void main() {
    ${LOGDEPTH_F}
    vec3 ro = cameraLocal;
    vec3 rd = normalize(vLocal - cameraLocal);

    vec2 atmo = raySphere(ro, rd, atmoRadius);
    if (atmo.y < 0.0 || atmo.y < atmo.x) discard;

    float tNear = max(atmo.x, 0.0);
    float tFar = atmo.y;

    // Stop at the ground if the ray hits it — the air in front of the
    // planet scatters, the air behind it is not visible.
    vec2 ground = raySphere(ro, rd, planetRadius);
    if (ground.y > 0.0 && ground.x > 0.0) tFar = min(tFar, ground.x);
    if (ground.y > 0.0 && ground.x <= 0.0) discard;   // camera underground

    float segment = (tFar - tNear) / float(viewSamples);
    vec3 accumulated = vec3(0.0);
    float opticalDepthView = 0.0;

    for (int i = 0; i < 32; i++) {
      if (i >= viewSamples) break;
      float t0 = tNear + segment * float(i);
      vec3 pA = ro + rd * t0;
      vec3 pB = ro + rd * (t0 + segment);
      vec3 p  = ro + rd * (t0 + segment * 0.5);

      float density = columnDensity(length(pA) - planetRadius,
                                    length(pB) - planetRadius, segment, scaleHeight);
      opticalDepthView += density;

      // Optical depth from this point out toward the Sun.
      vec2 lightHit = raySphere(p, sunDirWorld, atmoRadius);
      float lightSeg = lightHit.y / float(lightSamples);
      float opticalDepthLight = 0.0;
      bool shadowed = false;
      for (int j = 0; j < 16; j++) {
        if (j >= lightSamples) break;
        vec3 qA = p + sunDirWorld * (lightSeg * float(j));
        vec3 qB = p + sunDirWorld * (lightSeg * float(j + 1));
        float hA = length(qA) - planetRadius;
        float hB = length(qB) - planetRadius;
        if (hA < 0.0) { shadowed = true; break; }
        opticalDepthLight += columnDensity(hA, hB, lightSeg, scaleHeight);
      }
      if (shadowed) continue;

      vec3 transmittance = exp(-betaRayleigh * (opticalDepthView + opticalDepthLight));
      accumulated += transmittance * density;
    }

    // Rayleigh phase function: (3/16π)(1 + cos²θ). Scattering is symmetric
    // forward and back, which is why the limb glows on both sides.
    float mu = dot(rd, sunDirWorld);
    float phase = 0.05968310365 * (1.0 + mu * mu);

    vec3 colour = accumulated * betaRayleigh * phase * sunIntensity;
    float alpha = clamp(max(colour.r, max(colour.g, colour.b)), 0.0, 1.0);
    gl_FragColor = vec4(colour, alpha);
    ${OUTPUT}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   The Moon
   ══════════════════════════════════════════════════════════════════════ */

const MOON_VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  uniform sampler2D elevationMap;
  uniform float elevationScale;
  uniform float elevationOffset;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    // Real relief, at real amplitude: the 8-bit LOLA model spans the Moon's
    // published global elevation range. It is ±10 km on a 1 737 km radius,
    // so it reads on the limb and nowhere else — which is correct.
    float h = texture2D(elevationMap, uv).r * elevationScale + elevationOffset;
    vec3 displaced = position + normal * h;

    vNormalView = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
    ${LOGDEPTH_V}
  }
`;

const MOON_FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform sampler2D colourMap;
  uniform vec3 sunDirWorld;
  uniform vec3 earthDirWorld;
  uniform float sunIrradiance;
  uniform float earthshine;
  uniform float albedoScale;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    ${LOGDEPTH_F}
    vec3 N = normalize(vNormalView);
    vec3 L = normalize((viewMatrix * vec4(sunDirWorld, 0.0)).xyz);
    vec3 V = normalize(vViewDir);

    float mu0 = max(dot(N, L), 0.0);
    float mu = max(dot(N, V), 0.0);

    // Lunar regolith is not Lambertian. A Lambertian full moon would be
    // bright in the middle and dark at the edges; the real one is nearly
    // uniform, because light scatters between grains. Lommel-Seeliger
    // captures that, and the blend is the usual compromise for a surface
    // that is mostly, but not entirely, that kind of scatterer.
    float lommel = (mu0 + mu) > 0.0 ? mu0 / (mu0 + mu) : 0.0;
    float brdf = 1.35 * lommel * mu0 + 0.25 * mu0;

    // Same 1/π as Earth: this is a radiance, not an exitance.
    const float INV_PI = 0.31830988618;
    // The texture is a picture of the Moon, not a measurement of it: like
    // most published lunar maps it is brightened for legibility. Scaled
    // here so its mean matches the Moon's real albedo — see albedoScale.
    vec3 albedo = texture2D(colourMap, vUv).rgb * albedoScale;
    vec3 colour = albedo * brdf * sunIrradiance * INV_PI;

    // Earthshine: the night side of the Moon lit by a nearly-full Earth.
    // It is about ten thousand times fainter than sunlight, and it is the
    // reason you can see the whole disc of a crescent moon from the ground.
    vec3 E = normalize((viewMatrix * vec4(earthDirWorld, 0.0)).xyz);
    colour += albedo * max(dot(N, E), 0.0) * earthshine;

    gl_FragColor = vec4(colour, 1.0);
    ${OUTPUT}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   The Sun
   ══════════════════════════════════════════════════════════════════════ */

const SUN_FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform float intensity;
  void main() {
    ${LOGDEPTH_F}
    // A 5772 K blackbody is white. It looks yellow from the ground only
    // because the atmosphere has taken the blue end of it away.
    gl_FragColor = vec4(vec3(1.0, 0.985, 0.96) * intensity, 1.0);
    ${OUTPUT}
  }
`;

const SUN_VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    ${LOGDEPTH_V}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   Sun glare.

   The Sun is half a degree across, which at a 55° field of view is about
   seven pixels. Rendered as nothing but a disc it reads as a small white
   dot rather than as the thing lighting the entire scene — technically
   correct in angular size, and completely wrong in effect.

   What is missing is not bloom-as-decoration: it is **intraocular
   scatter**. Light entering the eye is scattered by the cornea, the lens
   and the vitreous into a halo around any bright source, and that halo is
   why the Sun is blinding rather than merely small. The same mechanism
   puts a glow around a streetlight at night and around headlights in rain.

   So the halo is scaled by the adaptation state: a dark-adapted eye
   scatters the same light across a far larger apparent glare than a
   squinting one. It is a billboard, always facing the camera, drawn after
   the Sun and occluded by anything in front of it — so it disappears
   correctly behind the limb of the Earth at orbital sunset.
   ══════════════════════════════════════════════════════════════════════ */

const GLARE_VERT = /* glsl */ `
  ${LOGDEPTH_V_PARS}
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    ${LOGDEPTH_V}
  }
`;

const GLARE_FRAG = /* glsl */ `
  ${LOGDEPTH_F_PARS}
  uniform float intensity;
  varying vec2 vUv;

  void main() {
    ${LOGDEPTH_F}
    vec2 d = vUv - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    // Two scales: a tight core that reads as the source itself, and a wide
    // skirt that is the scatter. Real glare falls off roughly as an inverse
    // power of angle, not as a Gaussian, which is why the skirt reaches so
    // much further than a blur would.
    float core = exp(-r * r * 22.0);
    float skirt = pow(max(0.0, 1.0 - r), 2.6) * 0.16;

    // Faint diffraction spikes, from the eyelashes and the eye's own
    // structure. Subtle enough to read as light rather than as a lens flare.
    float ang = atan(d.y, d.x);
    float spikes = pow(max(0.0, abs(cos(ang * 2.0))), 34.0) * pow(max(0.0, 1.0 - r), 3.0) * 0.09;

    float a = (core + skirt + spikes) * intensity;
    gl_FragColor = vec4(vec3(1.0, 0.985, 0.95) * a, 1.0);
    ${OUTPUT}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   Construction
   ══════════════════════════════════════════════════════════════════════ */

/**
 * A sphere whose pole points along +Z, not +Y.
 *
 * Three builds spheres pole-up on +Y and wraps an equirectangular texture
 * around that axis, because a renderer's world is conventionally Y-up. The
 * simulation's world is not: an Earth-centred equatorial frame has its pole
 * on +Z by definition, and that is not negotiable — it is what "equatorial
 * frame" means.
 *
 * Without this rotation the geometry and the body-fixed frame disagree by
 * 90°, the poles are placed on the equator, and Antarctica ends up in the
 * Indian Ocean — while every number in the HUD stays perfectly correct,
 * because the simulation was never wrong. Only the mesh was.
 */
export function sphereZUp(radius, widthSegments, heightSegments) {
  const geo = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function loadTexture(loader, url, { srgb = true } = {}) {
  const tex = loader.load(url);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/**
 * Build the three bodies. Segment counts scale with the quality tier —
 * Design Bible §15.4: quality changes rendering cost, never geometry's
 * meaning. A lower tier gets a coarser sphere, not a smaller planet.
 */
export function createBodies(quality = "high") {
  const loader = new THREE.TextureLoader();
  const seg = quality === "low" ? [64, 32] : quality === "medium" ? [96, 48] : [160, 80];

  /* ── Earth ── */
  const earthGeo = sphereZUp(K.EARTH_RADIUS_EQ.value, seg[0], seg[1]);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: loadTexture(loader, "assets/textures/earth-color-4096.jpg") },
      nightMap: { value: loadTexture(loader, "assets/textures/earth-night-2048.jpg") },
      sunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
      sunIrradiance: { value: 1 },
      /* City lights, as a radiance rather than as a dial.
​
         Everything else in this shader is in units of the solar constant
         per steradian — the same units the eye model adapts in — and this
         has to be too, or the night side is being lit by a number that
         means nothing.
​
         A bright urban core seen from orbit has a luminance of roughly half
         a candela per square metre. Broadband white light runs about 200
         cd/m² per W/m²/sr, so that is ~2.5×10⁻³ W/m²/sr, and dividing by
         the solar constant gives ~2×10⁻⁶ in these units. The sunlit side of
         the planet, for comparison, comes out at 0.097 — so daylight is
         about fifty thousand times brighter than the brightest city, which
         is why you cannot see one from the day side and why the night side
         needs a fully dark-adapted eye before it shows anything at all.
​
         The value it replaced was 0.9. That is not a small error: it made
         Tokyo brighter than the Sahara at noon, and it is why the night
         side rendered as a sheet of white — and why the exposure above it
         had to be clamped to hide that, which then took the stars with it.

         The shipped value is not 2×10⁻⁶ but a stated multiple of it, and
         that is a declared compression rather than an oversight — ledger
         SF-L-015. The eye model spans four decades of adaptation where the
         real eye spans ten, so every luminance below "sunlit surface" has
         already been pulled up into a much shorter ladder. Left at its
         physical radiance in that compressed ladder a city reads at 9/255
         — technically present, invisible in practice, and a worse lie than
         the compression is. The factor is stated, the physical figure is
         written above it, and the ordering is preserved: daylight is still
         thousands of times brighter than the brightest city.

         The multiple used to be about forty, and it is now about fourteen:
         a bright core in this texture is ~0.7 linear, so 4×10⁻⁵ puts it at
         2.8×10⁻⁵. The change is not a retune by eye. This texture was being
         sRGB-decoded twice (see the note at the top of this file), which
         squares the response and so crushes the faint end far harder than
         the bright end — the gain had been raised to bring the faint end
         back, and with the second decode gone that correction became a
         thirteen-fold overshoot: western Europe at local midnight rendered
         as a continuous sheet at 80/255 rather than as cities on black.
         Less compression is needed now because less was being destroyed. */
      nightGain: { value: 4e-5 },
    },
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  // Oblateness, at its real magnitude: 21.4 km of difference between the
  // equatorial and polar radii. Visible on the limb if you look for it.
  earth.scale.set(1, 1, K.EARTH_RADIUS_POLAR.value / K.EARTH_RADIUS_EQ.value);
  earth.name = "earth";

  /* ── Earth's atmosphere ── */
  const atmoRadius = K.EARTH_RADIUS_EQ.value + 100000; // the Kármán line
  const atmoGeo = sphereZUp(atmoRadius, seg[0], seg[1]);
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      cameraLocal: { value: new THREE.Vector3() },
      sunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
      planetRadius: { value: K.EARTH_RADIUS_EQ.value },
      atmoRadius: { value: atmoRadius },
      scaleHeight: { value: 8500 },
      // Rayleigh scattering coefficients at 680, 550 and 440 nm, per metre,
      // for Earth's sea-level air. The ratio between them is 1/λ⁴.
      betaRayleigh: { value: new THREE.Vector3(5.8e-6, 13.5e-6, 33.1e-6) },
      // The solar irradiance, and nothing else. Every other factor in the
      // scattering integral — the coefficients, the phase function, the
      // density profile — is already physical, so this is a driven value
      // rather than a dial: the renderer sets it to the same 1/r² figure
      // that lights the surface.
      sunIntensity: { value: 1 },
      viewSamples: { value: quality === "low" ? 6 : quality === "medium" ? 10 : 16 },
      lightSamples: { value: quality === "low" ? 3 : quality === "medium" ? 4 : 6 },
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    // Front faces, not back. The shell is a *proxy* — the shader does its
    // own ray marching and stops the integral at the ground — so all the
    // geometry has to do is cover the right pixels while being nearer to
    // the camera than the planet is. Draw the back faces instead and every
    // fragment over the disc fails the depth test against the Earth mesh,
    // which loses all the in-scattering above the surface and leaves only
    // a rim of light on the limb.
    //
    // When the camera descends below the top of the atmosphere (Phase 2)
    // this must become DoubleSide with the depth test off, because the
    // front faces will then be behind the viewer.
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
  atmosphere.name = "atmosphere";
  atmosphere.renderOrder = 2;

  /* ── Moon ── */
  const moonGeo = sphereZUp(K.MOON_RADIUS.value, seg[0], seg[1]);
  const moonMat = new THREE.ShaderMaterial({
    uniforms: {
      colourMap: { value: loadTexture(loader, "assets/textures/moon-color-1024.jpg") },
      elevationMap: {
        value: loadTexture(loader, "assets/textures/moon-ldem-1024.jpg", { srgb: false }),
      },
      // The 8-bit model spans the Moon's global elevation range,
      // −9 150 m to +10 760 m relative to the 1 737.4 km reference sphere.
      elevationScale: { value: 19910 },
      elevationOffset: { value: -9150 },
      sunDirWorld: { value: new THREE.Vector3(1, 0, 0) },
      earthDirWorld: { value: new THREE.Vector3(1, 0, 0) },
      sunIrradiance: { value: 1 },
      earthshine: { value: 0.0002 },
      /* The Moon is dark — Bond albedo 0.11, about the reflectance of worn
         asphalt. It looks bright to us only because it is lit by full
         sunlight and set against a black sky, and that contrast is one of
         the genuinely surprising facts about it.

         The shipped colour map does not agree: measured over the texture
         and weighted by cos(latitude), its mean linear reflectance is
         0.2986, because lunar maps are published to be looked at rather
         than to be integrated. Drawn as-is the Moon is 2.7 times too
         bright and the fact is lost. This restores it. */
      albedoScale: { value: 0.11 / 0.2986 },
    },
    vertexShader: MOON_VERT,
    fragmentShader: MOON_FRAG,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.name = "moon";

  /* ── Sun ── */
  const sunGeo = sphereZUp(K.SUN_RADIUS.value, 48, 24);
  const sunMat = new THREE.ShaderMaterial({
    uniforms: { intensity: { value: 30 } },
    vertexShader: SUN_VERT,
    fragmentShader: SUN_FRAG,
  });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  sun.name = "sun";

  /* ── The Sun's glare ── */
  const glareMat = new THREE.ShaderMaterial({
    uniforms: { intensity: { value: 1 } },
    vertexShader: GLARE_VERT,
    fragmentShader: GLARE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  // Unit quad; the renderer scales and billboards it each frame.
  const sunGlare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glareMat);
  sunGlare.name = "sunGlare";
  sunGlare.renderOrder = 3;
  sunGlare.frustumCulled = false;

  return {
    earth, atmosphere, moon, sun, sunGlare,
    materials: { earthMat, atmoMat, moonMat, sunMat, glareMat },
  };
}
