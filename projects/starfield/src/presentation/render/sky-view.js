/* ══════════════════════════════════════════════════════════════════════
   sky-view.js — the real sky, at real brightness.

   Design Bible §15.1, quoting Ric: "Movies make space black. It isn't — it
   is blazing with stars." That is the whole brief for this file.

   Two rules it follows that most space games do not:

   1. **Brightness is physical.** A star's size and intensity come from its
      catalogued apparent magnitude through the actual Pogson relation —
      each magnitude is a factor of 2.512 in flux — and then through the
      eye's adaptation state. Sirius is 25 times brighter than Polaris here
      because it is 25 times brighter than Polaris.

   2. **Colour is desaturated.** Visual Perception §3.3: at night-sky light
      levels the cones barely respond, so real stars are near-white with a
      hint of temperature. The saturated red and blue of space art is what
      a long exposure sees, not an eye.

   The stars are drawn on a shell, and **that is no longer a claim about
   where they are.** `setObserver` recomputes each star's apparent direction
   and apparent magnitude from its true range whenever the ship moves, so
   flying at one approaches it — the Phase 4 this header used to promise,
   landed 2026-07-28 for the 3 157 stars with a measured parallax.

   Inside the Earth–Moon volume nothing moves, and that is correct rather
   than lazy: the largest parallax any star has across that whole box is
   about 0.002 arcseconds, and the eye resolves 60. Ledger entry SF-L-007
   carries the rest, including why the 5 989 stars with no measured distance
   stay put.
   ══════════════════════════════════════════════════════════════════════ */

import * as THREE from "../../../vendor/three/three.module.min.js";
import {
  blackbodyRgb, spectralTypeToTemp, colourIndexToTemp, desaturate,
} from "./blackbody.js";
import { DEG, wrapDeg } from "../../simulation/core/linalg.js";
import { K } from "../../simulation/core/units.js";

/** Metres in a light-year. Exact — see K.LIGHT_YEAR. */
const LIGHT_YEAR_M = K.LIGHT_YEAR.value;

/**
 * Precession of the equinox from J2000 to the equinox of date — Meeus
 * (21.2)/(21.4). The catalogues are J2000; the simulation's frames are of
 * date. Between them lies about 0.36° by 2026, which is two-thirds of a
 * Moon's width — small, but not small enough to shrug at when the whole
 * project is about putting things where they really are.
 */
function precessionAngles(T) {
  const sec = 1 / 3600;
  return {
    zeta: (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * sec,
    z: (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * sec,
    theta: (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * sec,
  };
}

/** Apply precession to a J2000 right ascension/declination, degrees in and out. */
export function precess(raDeg, decDeg, T) {
  const { zeta, z, theta } = precessionAngles(T);
  const ra0 = raDeg * DEG, dec0 = decDeg * DEG;
  const zt = zeta * DEG, zz = z * DEG, th = theta * DEG;

  const A = Math.cos(dec0) * Math.sin(ra0 + zt);
  const B = Math.cos(th) * Math.cos(dec0) * Math.cos(ra0 + zt) - Math.sin(th) * Math.sin(dec0);
  const C = Math.sin(th) * Math.cos(dec0) * Math.cos(ra0 + zt) + Math.cos(th) * Math.sin(dec0);

  return {
    raDeg: wrapDeg((Math.atan2(A, B) + zz) * (180 / Math.PI)),
    decDeg: Math.asin(Math.max(-1, Math.min(1, C))) * (180 / Math.PI),
  };
}

/** Unit vector in the equatorial frame from right ascension and declination. */
export function radecToVector(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG;
  return new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec)
  );
}

/* Three does not append its output pipeline to a custom ShaderMaterial the
   way it does for the built-in materials. Without these two chunks the
   exposure the adaptation model computes is silently ignored, and linear
   radiance values are written straight to the framebuffer as though they
   were already sRGB — which leaves the entire scene several stops too dark
   and makes the eye model do nothing at all. Every fragment shader here
   ends with them. */
const OUTPUT = "#include <tonemapping_fragment>\n#include <colorspace_fragment>";

const VERT = /* glsl */ `
  attribute float magnitude;
  attribute vec3 tint;
  varying vec3 vTint;
  varying float vFlux;
  uniform float scale;         // fixed flux → radiance, NOT the adaptation state
  uniform float gamma;         // compressive response of the eye to point sources
  uniform float sizeGain;      // how much of the eye's adaptation goes into disc size
  uniform float pixelScale;    // device pixels per CSS pixel

  void main() {
    vTint = tint;

    // Pogson: flux ratio = 10^(−0.4 Δm). Magnitude 0 is the reference.
    float flux = pow(10.0, -0.4 * magnitude);

    /* The catalogue spans eight magnitudes — a factor of 1600 between the
       faintest star a dark-adapted eye can hold and Sirius. A display has
       nothing like that range, and rendering the ratio linearly meant the
       tone curve saturated everything above about magnitude 5 to the same
       flat white: eight magnitudes of real hierarchy arriving as under one
       and a half, which is why the sky read as confetti rather than as a
       sky, and why the measured B−V colours never survived to be seen.

       So the response is compressed, and compression is what the eye does
       here too — this is the same square-root-ish law that makes a star's
       *apparent* brightness step much more slowly than its flux. Declared
       as a presentation aid in ledger SF-L-021, with its exponent stated,
       rather than smuggled in as a tuning constant. */
    vFlux = scale * pow(flux, gamma);

    // Size is the other place a bright source shows itself: it saturates a
    // larger patch of retina, which is why Sirius looks like a disc and a
    // magnitude 6 star looks like a pinprick. The ramp is gentler than it
    // was — the old one gave a magnitude 6 star a three-pixel disc, so the
    // faint end of the sky arrived as a field of grey blobs.
    /* The floor is 1.8 px and it is not cosmetic. A point sprite smaller
       than about two pixels lands almost entirely between sample points:
       the Gaussian below is evaluated per fragment, not integrated over
       the pixel, so a one-pixel star is shaded at wherever its single
       fragment happens to fall on the curve rather than at its peak. The
       faint end of the catalogue was losing most of its light that way and
       simply not arriving. */
    float size = pixelScale * (0.7 + 0.59 * pow(flux * sizeGain, 0.38));
    gl_PointSize = clamp(size, 1.8, 12.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float exposure;      // the eye's current state, for the bleach point only
  varying vec3 vTint;
  varying float vFlux;

  void main() {
    /* A soft Gaussian core. Real point sources land on the eye as an Airy
       disc smeared by the lens; a hard square is the one thing that always
       reads as "computer graphics".

       The width is 12 rather than 26, and that is the difference between a
       bright star looking bright and merely being bright. At 26 the curve
       is a needle: full intensity is reached at the sprite's exact centre
       and has fallen by half two thirds of a pixel away, so a magnitude 0
       star put a single fragment near white and the rest of its disc in the
       greys. Measured over the frame, eight stars brighter than magnitude 2
       were producing three pixels above level 200 between them. Widening
       the core gives each one an actual core — which is also the more
       honest optics, since the eye's own point spread is dominated by
       scatter in the lens rather than by diffraction. */
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    float core = exp(-r2 * 12.0);
    if (core < 0.004) discard;

    /* Bright stars bleach toward white in the centre, exactly as an
       overexposed source does — which is why Sirius looks white-hot and a
       faint M dwarf keeps its colour.

       The bleach point is where the *displayed* value reaches one, so it
       has to be measured after exposure rather than against a fixed
       threshold. With a constant the sky bleached identically whether the
       eye was dark-adapted or staring at the Earth, which put white cores
       on stars that should not have been visible at all. */
    float bleach = clamp(vFlux * exposure * core, 0.0, 1.0);
    vec3 colour = mix(vTint, vec3(1.0), bleach);

    gl_FragColor = vec4(colour * core * vFlux, 1.0);
    ${OUTPUT}
  }
`;

/* ══════════════════════════════════════════════════════════════════════
   The Milky Way.

   Design Bible §15.1 requires it — "the Milky Way should emerge under
   sufficiently dark conditions" — and Visual Perception §5 is strict about
   what it may look like: **silver, white and grey, with dark dust lanes,
   genuinely bright and essentially colourless.** Not a Hubble palette.

   What this layer is: the *diffuse* band — the unresolved light of a
   hundred billion stars too faint and too close together to separate, plus
   the dust that blocks it. It is not the stars; those come from the
   catalogue and are drawn on top. The source panorama is downsampled hard
   precisely so its own point stars average away and only the diffuse
   structure survives, which is what makes the two layers complementary
   rather than a double exposure.

   The panorama is in **galactic** coordinates, so the shader rotates the
   view direction out of the equatorial frame before sampling. That matrix
   is built once, on the CPU, from the IAU-defined pole and centre.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Rotation from equatorial J2000 to galactic coordinates.
 * Defined by the IAU 1958 convention, in its J2000 form:
 *   north galactic pole  α = 192.85948°, δ = +27.12825°
 *   galactic centre      α = 266.40510°, δ = −28.936175°
 * Returned as a THREE.Matrix3 whose rows are the galactic x, y, z axes
 * expressed in equatorial coordinates.
 */
export function equatorialToGalacticMatrix() {
  const d2r = Math.PI / 180;
  const pole = { ra: 192.85948 * d2r, dec: 27.12825 * d2r };
  const centre = { ra: 266.40510 * d2r, dec: -28.936175 * d2r };

  const unit = (ra, dec) => new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.cos(dec) * Math.sin(ra),
    Math.sin(dec)
  );

  const z = unit(pole.ra, pole.dec);            // toward the north galactic pole
  const x = unit(centre.ra, centre.dec);        // toward the galactic centre
  // Re-orthogonalise: the two defining directions are not exactly 90° apart
  // once rounded to the published decimals.
  x.sub(z.clone().multiplyScalar(z.dot(x))).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);

  return new THREE.Matrix3().set(
    x.x, x.y, x.z,
    y.x, y.y, y.z,
    z.x, z.y, z.z
  );
}

const MW_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MW_FRAG = /* glsl */ `
  uniform sampler2D band;
  uniform mat3 toGalactic;
  uniform float intensity;
  uniform float pedestal;
  uniform float knee;
  varying vec3 vDir;

  void main() {
    vec3 g = normalize(toGalactic * normalize(vDir));

    // Galactic longitude and latitude, then the panorama's equirectangular
    // layout: the galactic centre sits at the middle of the image.
    float l = atan(g.y, g.x);
    float b = asin(clamp(g.z, -1.0, 1.0));
    vec2 uv = vec2(0.5 - l / 6.2831853, 0.5 + b / 3.1415927);

    // Linear already: bandTex is tagged SRGBColorSpace, so on WebGL2 the
    // sampler decodes it. Decoding again here is the bug that made the Earth
    // black — the same mistake, in the same shape, one pass earlier.
    vec3 c = texture2D(band, uv).rgb;

    // Visual Perception §5: to the naked eye this is silver and grey. The
    // source is a long exposure through colour filters, so almost all of
    // its saturation is removed rather than reproduced — the luminance
    // structure, the dust lanes and the brightness gradient toward
    // Sagittarius are the real information in it.
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));

    // Two-part tone curve, and both parts are load-bearing.
    //
    // The **pedestal** exists because downsampling the panorama smeared its
    // own stars into a faint mottle; amplified for a dark-adapted eye that
    // turns the gaps between stars into visible grain, which is precisely
    // the "ambient nebula fog" §9 forbids. Subtracting it puts genuinely
    // empty sky at black.
    //
    // The **knee** exists because the band's core near Sagittarius is two
    // orders of magnitude brighter than its faint reaches toward the
    // anti-centre. A linear scale either clips the core to a white blob or
    // loses everything else; v/(v+k) keeps both, which is the same reason
    // the eye's own response is compressive.
    float v = max(luma - pedestal, 0.0);
    v = v / (v + knee);

    vec3 grey = mix(vec3(v), c * (v / max(luma, 1e-4)), 0.12);

    gl_FragColor = vec4(grey * intensity, 1.0);
    ${OUTPUT}
  }
`;

/**
 * Planet colours, as an eye reports them rather than as a camera does.
 *
 * These are the naked-eye impressions the observing literature is
 * consistent about — Mars distinctly orange, Jupiter and Venus near-white
 * with a warm cast, Saturn faintly yellow, Uranus and Neptune the only two
 * that read as anything like blue-green, and only through optics. They are
 * deliberately undersaturated for the same reason the stars are: at these
 * light levels the cones are barely working.
 */
const PLANET_TINT = {
  mercury: [1.00, 0.97, 0.92],
  venus: [1.00, 0.99, 0.95],
  mars: [1.00, 0.82, 0.70],
  jupiter: [1.00, 0.96, 0.88],
  saturn: [1.00, 0.95, 0.83],
  uranus: [0.85, 0.95, 1.00],
  neptune: [0.82, 0.90, 1.00],
};

export class SkyView {
  /**
   * @param {Array} catalogue entries {name, ra, dec, v, sp, plx}
   */
  constructor(catalogue) {
    this.catalogue = catalogue;
    this.scene = new THREE.Scene();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        /* Two numbers, one calibration, and both ends of the sky are pinned
           by it:

             magnitude 6.5  →  0.05   the threshold of visibility, which is
                                      what the naked-eye limit means and
                                      what the catalogue's depth is for
             Sirius (−1.46) →  0.87   a white core, as the brightest star in
                                      the sky should be

           Both measured **after** the ACES curve, which is the only place
           worth measuring: the curve takes 0.03 down to 0.019, so anchoring
           ahead of it put the naked-eye limit at a twentieth of display
           white and the faint two-thirds of the catalogue below anything a
           screen resolves. The endpoints above are what leaves the shader.

           Those two requirements fix the exponent and the scale between
           them: γ = ln(33)/ln(1524) = 0.48, and the scale follows. Nothing
           here is dialled in by eye — move either endpoint and the other
           number is determined.

           They are anchored at an exposure of **1263**, which is what the
           eye actually settles at looking away from a lit planet from low
           orbit, rather than at the 6000 of the idealised starlight floor.
           That distinction turned out to matter: the floor is a state this
           scene almost never reaches, because in the Earth–Moon volume
           there is nearly always a lit world or a Sun somewhere in the
           field, so calibrating to it left the sky four stops under
           everywhere you would actually stand and look at it. Anchored
           here, the naked-eye limit lands at the naked-eye limit in the
           real scene — and out in genuinely empty space, where the eye does
           reach the floor, the whole sky comes up another two stops and
           blazes, which is §15.1's requirement and not an accident.

           The previous calibration put magnitude 6.5 at 54% grey and clipped
           everything above magnitude 5, which is the whole reason the sky
           looked like static. */
        scale: { value: 8.0e-4 },
        gamma: { value: 0.48 },
        exposure: { value: 1 },
        sizeGain: { value: 40 },
        pixelScale: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.points = null;
    this._builtForT = null;

    /* The diffuse band, drawn behind the stars. Its own sphere, inside-out,
       far enough back to sit behind everything in the sky pass. */
    const loader = new THREE.TextureLoader();
    const bandTex = loader.load("assets/textures/milkyway-galactic-1024.jpg");
    bandTex.colorSpace = THREE.SRGBColorSpace;
    bandTex.wrapS = THREE.RepeatWrapping;
    bandTex.minFilter = THREE.LinearFilter;      // no mipmaps: it is already the blur

    this.bandMaterial = new THREE.ShaderMaterial({
      uniforms: {
        band: { value: bandTex },
        toGalactic: { value: equatorialToGalacticMatrix() },
        intensity: { value: 0 },
        /* Calibrated against the panorama itself, in the units the shader
           now works in.

           Both were tuned while the band was being sRGB-decoded twice, so
           they were thresholds on a doubly-darkened luma, not on the
           panorama's real linear values. Removing the second decode moves
           the input without changing which texel is which, so the fix is to
           move the thresholds with it: srgbToLinear is monotonic, so
           encoding them back cuts exactly the same sky and half-saturates
           exactly the same core.

             pedestal  0.008 → 0.086   (sits just under the 99th percentile
                                        of the panorama's luma, which is what
                                        puts empty sky at black)
             knee      0.06  → 0.203   (half-saturation moves 0.068 → 0.289) */
        pedestal: { value: 0.086 },
        knee: { value: 0.203 },
      },
      vertexShader: MW_VERT,
      fragmentShader: MW_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    });

    this.band = new THREE.Mesh(new THREE.SphereGeometry(9e8, 48, 32), this.bandMaterial);
    this.band.frustumCulled = false;
    this.band.renderOrder = -1;                  // behind the stars
    this.scene.add(this.band);

    /* The planets, on the same shader and therefore the same calibration.
       That sharing is the point: a planet's magnitude means exactly what a
       star's magnitude means, so if Venus is drawn brighter than Sirius it
       is because it *is* brighter, not because two code paths were tuned by
       different hands on different days.

       Their own buffer because they move. The catalogue is built once per
       session against the equinox of date; the planets are rewritten every
       frame, and mixing the two would mean re-uploading nine thousand
       stationary stars to move seven points. */
    this._planetGeo = new THREE.BufferGeometry();
    this._planetGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 16), 3));
    this._planetGeo.setAttribute("magnitude", new THREE.BufferAttribute(new Float32Array(16), 1));
    this._planetGeo.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(3 * 16), 3));
    this.planets = new THREE.Points(this._planetGeo, this.material);
    this.planets.frustumCulled = false;
    this.scene.add(this.planets);
  }

  /**
   * Place the planets for this frame.
   *
   * Positions arrive Earth-centred and in metres, and are projected onto
   * the same shell the stars sit on. The shell is not a distance claim for
   * them either — but unlike the stars it is not even approximately their
   * distance, so this is a *direction* only, and the range the HUD quotes
   * comes from the simulation rather than from anything drawn here.
   *
   * @param {Array} planets  world.state.planets
   * @param {function} magnitudeOf  (planet) → apparent visual magnitude
   */
  setPlanets(planets, magnitudeOf) {
    const SHELL = 1e9;
    const pos = this._planetGeo.attributes.position;
    const mag = this._planetGeo.attributes.magnitude;
    const tint = this._planetGeo.attributes.tint;
    const n = Math.min(planets.length, pos.count);

    for (let i = 0; i < n; i++) {
      const p = planets[i];
      const d = Math.hypot(p.position.x, p.position.y, p.position.z) || 1;
      pos.setXYZ(i, (p.position.x / d) * SHELL, (p.position.y / d) * SHELL, (p.position.z / d) * SHELL);
      mag.setX(i, magnitudeOf(p));
      const c = PLANET_TINT[p.id] ?? [1, 1, 1];
      tint.setXYZ(i, c[0], c[1], c[2]);
    }
    // Anything unused is parked at the origin with a magnitude no eye reaches.
    for (let i = n; i < pos.count; i++) { pos.setXYZ(i, 0, 0, 0); mag.setX(i, 99); }

    pos.needsUpdate = true;
    mag.needsUpdate = true;
    tint.needsUpdate = true;
    this._planetGeo.setDrawRange(0, pos.count);
  }

  /**
   * Build (or rebuild) the geometry for the equinox of date.
   * Precession moves the whole sky by 50″ a year, so once per session is
   * plenty — this is not called per frame.
   */
  build(centuriesTt) {
    const n = this.catalogue.length;
    const positions = new Float32Array(n * 3);
    const magnitudes = new Float32Array(n);
    const tints = new Float32Array(n * 3);

    // Far enough to be unambiguously background, near enough to stay inside
    // any sane far plane. It is a shell, not a distance claim — see SF-L-007.
    const SHELL = 1e9;

    /* ── what `setObserver` needs to make these places ──────────────────
       The shell above is a *rendering* convenience and always was. What
       made the sky a backdrop was not the shell, it was that nothing ever
       recomputed which way a star lies once the ship moved.

       So keep the unit direction and the true range for every star that has
       one, and the magnitude the catalogue quotes at that range. Given the
       ship's position, the apparent direction and the apparent brightness
       both fall out — which is the whole of what an eye can tell. */
    this._dirs = new Float32Array(n * 3);
    this._distM = new Float64Array(n);         // 0 = no measured parallax
    this._baseMag = new Float32Array(n);
    this._measured = 0;

    this.catalogue.forEach((s, i) => {
      const { raDeg, decDeg } = precess(s.ra, s.dec, centuriesTt);
      const u = radecToVector(raDeg, decDeg);
      this._dirs[i * 3] = u.x;
      this._dirs[i * 3 + 1] = u.y;
      this._dirs[i * 3 + 2] = u.z;
      if (s.distanceLy > 0) { this._distM[i] = s.distanceLy * LIGHT_YEAR_M; this._measured++; }

      const v = u.clone().multiplyScalar(SHELL);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;

      magnitudes[i] = s.v ?? 6;
      this._baseMag[i] = magnitudes[i];

      // B−V is a measurement of the star's colour through two standard
      // filters; a spectral class is a human judgement binned into
      // letters. Where the catalogue gives the measurement, use it.
      const temp = s.bv !== null && s.bv !== undefined
        ? colourIndexToTemp(s.bv)
        : spectralTypeToTemp(s.spectralType || s.sp);

      // Faint stars lose their colour before bright ones do, because the
      // cones stop responding first: at the limit of vision everything is
      // grey. That is why a naked-eye sky looks so much less colourful
      // than a photograph of it (Visual Perception §3.3).
      const fade = Math.min(1, Math.max(0, (magnitudes[i] - 1.5) / 4));
      const c = desaturate(blackbodyRgb(temp), 0.45 + 0.5 * fade);
      tints[i * 3] = c.r;
      tints[i * 3 + 1] = c.g;
      tints[i * 3 + 2] = c.b;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("magnitude", new THREE.BufferAttribute(magnitudes, 1));
    geo.setAttribute("tint", new THREE.BufferAttribute(tints, 3));

    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this._builtForT = centuriesTt;
    this._observer = null;
    return this;
  }

  /**
   * Move the observer, and let the stars respond.
   *
   * ── Phase 4: the stars stop being wallpaper ─────────────────────────
   *
   * Ric's requirement, and the reason the project exists at all: *"you can
   * fly to the stars that you see so they don't feel like they were just
   * put on a wallpaper and you can never reach them."*
   *
   * Until now this file drew the sky with the camera's **rotation only and
   * no translation**, so flying 1.69 million light-years from Earth left
   * the view pixel-identical to the one from low orbit. Its own header
   * admitted the shell "goes away in Phase 4, when the stars get their real
   * distances and become places you can fly to". This is Phase 4 for the
   * 3 157 stars that now have a measured parallax.
   *
   * ── Why the shell stays anyway ───────────────────────────────────────
   *
   * Not laziness, and worth being clear about because it looks like a
   * shortcut. Real distances span 10¹⁶ to 10²⁰ m while the ship sits at
   * 10⁷; putting those in a float32 depth buffer produces a sky that
   * z-fights itself into confetti. But a star is an unresolved point, so
   * the *only* things an eye can extract from it are **which way it is**
   * and **how bright it is**. Both are computed here from the true range,
   * exactly, and the shell then carries the answer at a depth the GPU can
   * hold. Nothing perceivable is approximated: fly toward Sirius and it
   * moves against the background and brightens, because it really is
   * closer.
   *
   * Apparent magnitude follows the distance modulus, m = m₀ + 5·log₁₀(d/d₀),
   * which is the same Pogson relation the shader already uses — so a star
   * you approach brightens by exactly what it would.
   *
   * Stars with no measured parallax do not move. That is honest: their
   * distance is unknown, so inventing one to make them slide would be
   * fabricating an observation. They stay on the shell and the catalogue
   * records why.
   *
   * @param {{x:number,y:number,z:number}} position  observer, ECI metres
   */
  setObserver(position) {
    if (!this.points || !this._distM) return this;

    /* Recompute only when the ship has actually gone somewhere. The
       threshold is 10⁹ m — about 1/10 000 of a light-year — so the whole
       Earth–Moon slice never touches this loop (the largest parallax any
       star has across that volume is 0.002″ against a 60″ eye), and
       interstellar flight updates every frame. */
    const prev = this._observer;
    if (prev) {
      const moved = Math.hypot(position.x - prev.x, position.y - prev.y, position.z - prev.z);
      if (moved < 1e9) return this;
    }
    this._observer = { x: position.x, y: position.y, z: position.z };

    const SHELL = 1e9;
    const pos = this.points.geometry.attributes.position;
    const mag = this.points.geometry.attributes.magnitude;
    const dirs = this._dirs, distM = this._distM, baseMag = this._baseMag;

    for (let i = 0; i < distM.length; i++) {
      const d0 = distM[i];
      if (d0 === 0) continue;                    // unmeasured: it does not move

      // True position, then the vector from the observer to it.
      const rx = dirs[i * 3] * d0 - position.x;
      const ry = dirs[i * 3 + 1] * d0 - position.y;
      const rz = dirs[i * 3 + 2] * d0 - position.z;
      const d = Math.hypot(rx, ry, rz);
      if (!(d > 0)) continue;

      pos.setXYZ(i, (rx / d) * SHELL, (ry / d) * SHELL, (rz / d) * SHELL);

      /* The distance modulus. Clamped at the bright end because this
         renderer draws stars as points: approach one closely enough and it
         stops being a point and starts being a sun, which is a body with a
         disc and a light source, not a brighter pixel. Until that exists,
         −9 (about Venus at its best, and the brightest thing in this sky
         after the Sun and Moon) is where the honest model runs out. */
      const m = baseMag[i] + 5 * Math.log10(d / d0);
      mag.setX(i, Math.max(-9, m));
    }
    pos.needsUpdate = true;
    mag.needsUpdate = true;
    return this;
  }

  /** How many stars in this sky are places rather than directions. */
  get measuredCount() { return this._measured || 0; }

  /**
   * @param {number} adapted   the eye's adapted luminance
   * @param {number} dpr       device pixel ratio
   * @param {number} exposure  linear exposure the tone mapper will apply
   */
  update(adapted, dpr, exposure = 1) {
    this.material.uniforms.pixelScale.value = dpr;
    // Not for brightness — the tone mapper still owns that. The shader needs
    // it only to know where a star's core reaches white and starts to bleach.
    this.material.uniforms.exposure.value = exposure;
    // Only the disc size tracks adaptation; brightness is physical and is
    // handled by the tone mapper for the sky pass.
    this.material.uniforms.sizeGain.value = Math.min(4.2e-3 / Math.max(adapted, 1e-9), 90);

    // The band's brightness is a fixed surface radiance, not a function of
    // adaptation: it emerges as the eye adjusts because the tone mapper
    // brings it up, which is exactly how it emerges from a dark site on
    // Earth. Making it depend on adaptation as well produced a band that
    // brightened twice and blew out.
    this.bandMaterial.uniforms.intensity.value = 6.2e-5;
  }

  /** Star nearest to a view direction, for click-to-identify. */
  nearest(directionEci, maxAngleRad, centuriesTt) {
    let best = null, bestAngle = maxAngleRad;
    for (const s of this.catalogue) {
      const { raDeg, decDeg } = precess(s.ra, s.dec, centuriesTt);
      const v = radecToVector(raDeg, decDeg);
      const a = Math.acos(Math.max(-1, Math.min(1, v.dot(directionEci))));
      if (a < bestAngle) { bestAngle = a; best = s; }
    }
    return best ? { star: best, angle: bestAngle } : null;
  }
}
