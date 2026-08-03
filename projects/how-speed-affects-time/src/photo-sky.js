/* ══════════════════════════════════════════════════════════════════════
   photo-sky.js — one photographic sky, at every speed.

   One equirectangular all-sky photograph, sampled in galactic coordinates.
   This shader runs every screen ray backwards through relativistic
   aberration, samples the panorama where that ray really started, then
   applies a display-safe version of Doppler colour and beaming. The
   catalogue canvas is screen-blended over it for exact bright-star
   positions.

   ── what this file used to be, and why it is not that any more ──

   It used to composite three plates: a high-resolution "hero" window facing
   the way you were going, a second plate for the view back toward Earth, and
   a low-resolution panorama filling everything else — blended with fitted
   per-channel gains, a sixth-power edge metric and a feather that widened
   with speed to hide the seam.

   All of that machinery existed to work around one thing: the panorama was
   1774 × 887, roughly five pixels per degree, too soft to look at directly.
   None of it was physics. The gains were least-squares fits between images
   that were never shot together, and the feather was there because a
   soft-edged rectangle of differently-exposed sky is not something a sky does.

   Worse, the three plates did not agree with each other about where the sky
   was. The panorama was anchored to the direction of travel and then rolled
   by a hand-picked -0.35 rad so its band would line up with the hero plate's
   diagonal — a composition decision, not an astronomical one, and it left the
   photographed Milky Way 38.6 degrees away from where the star catalogue put
   it. Worst of all, measurement said the old panorama was not a photograph:
   its fine structure correlated with a real all-sky plate at r = 0.06, below
   the floor set by comparing a real plate against a *misaligned copy of
   itself*, and it contained no Magellanic Clouds and no star bright enough to
   show diffraction spikes.

   So it is one real photograph now, mapped by galactic longitude and latitude
   with no free rotation anywhere in it. The seam, the gains, the feather and
   the crops are all gone, and with them two of the display parameters this
   exhibit had to apologise for in Scope.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const HALF_V = 49 * Math.PI / 360;
  const TAN_HALF_V = Math.tan(HALF_V);

  /* ── the galactic frame, in equatorial J2000 ──────────────────────────
     Built from the two directions that define the system rather than from a
     chain of angles, exactly as galaxy.js does it: +z is the north galactic
     pole, +x is the galactic centre, +y follows.

     The panorama's own convention was not assumed. It was measured: sampling
     ESO's plate at the catalogue positions of the Magellanic Clouds finds the
     Large Cloud at 2.69x the surrounding sky under l increasing to the left,
     and 0.97x — nothing there at all — under the other handedness. */
  const GAL = (() => {
    const d2r = Math.PI / 180;
    const unit = (ra, dec) => {
      const a = ra * d2r, e = dec * d2r, c = Math.cos(e);
      return [c * Math.cos(a), c * Math.sin(a), Math.sin(e)];
    };
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const z = unit(192.85948, 27.12825);          // north galactic pole
    let x = unit(266.40510, -28.93617);           // galactic centre
    const d = dot(x, z);
    x = [x[0] - d * z[0], x[1] - d * z[1], x[2] - d * z[2]];
    const n = Math.hypot(x[0], x[1], x[2]);
    x = [x[0] / n, x[1] / n, x[2] / n];
    return { x, y: cross(z, x), z };
  })();

  function basis(f) {
    const pole = Math.abs(f[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
    let rx = pole[1] * f[2] - pole[2] * f[1];
    let ry = pole[2] * f[0] - pole[0] * f[2];
    let rz = pole[0] * f[1] - pole[1] * f[0];
    const n = Math.hypot(rx, ry, rz) || 1;
    rx /= n; ry /= n; rz /= n;
    return {
      right: [rx, ry, rz],
      up: [
        f[1] * rz - f[2] * ry,
        f[2] * rx - f[0] * rz,
        f[0] * ry - f[1] * rx,
      ],
    };
  }

  function shader(gl, kind, source) {
    const out = gl.createShader(kind);
    gl.shaderSource(out, source);
    gl.compileShader(out);
    if (!gl.getShaderParameter(out, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(out) || "photo sky shader failed");
    }
    return out;
  }

  function program(gl, vertex, fragment) {
    const out = gl.createProgram();
    gl.attachShader(out, shader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(out, shader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(out);
    if (!gl.getProgramParameter(out, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(out) || "photo sky link failed");
    }
    return out;
  }

  const VERTEX = `
    attribute vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;

  const FRAGMENT = `
    precision highp float;

    /* Three plates, tinted and added. This is how every colour picture of the
       sky has ever been made: a detector counts photons and has no idea what
       colour they were, so each exposure is grey, and the colour comes from
       deciding which band to send to which channel. JWST does exactly this —
       sort the filters by wavelength, shortest to blue, longest to red.

       Always three, never a count and a branch. An unused slot gets a tint of
       zero and contributes nothing, which costs two texture fetches and buys a
       shader with no divergence in it.

       A grey plate times a tint is that band in that colour. The visible plate
       is real RGB, and times a white tint it is itself, so the ordinary view
       falls out of the same expression as the composites. */
    uniform sampler2D uPanorama;
    uniform sampler2D uPlateB;
    uniform sampler2D uPlateC;
    uniform vec3 uTintA;
    uniform vec3 uTintB;
    uniform vec3 uTintC;
    /* The microwave background, as a 256-texel strip indexed by cos θ′.

       It is here as a lookup rather than as shader arithmetic because its
       brightness is an integral of Planck's law against the CIE curves, and
       colour.js is the only place in this exhibit allowed to do that. Working
       it out a second time in GLSL would mean two answers that have to be
       kept in agreement by hand; sampling the first one cannot drift.

       rgb  chromaticity, peak channel at 1
       a    log of the magnitude, over the range in uCmbRange — because the
            term spans about twenty decades along this rail and eight bits of
            linear would be either all zero or all saturated. */
    uniform sampler2D uCmb;
    uniform vec2 uCmbRange;   // x = log10 of the peak, y = decades below it
    /* The strip is indexed by log D, not by cos θ′.

       Indexing by cos θ′ is the obvious thing and it silently produces an
       empty strip at exactly the speeds this term exists for. At 0.99998 c
       the entire visible sky lies inside cos θ′ > 0.9999 — 256 uniform texels
       put the whole forward cone between the last two of them and sample the
       CMB nowhere near where it is bright. D is the variable the brightness
       actually depends on, it spans a bounded range from dead astern to dead
       ahead, and in log it is evenly conditioned across all of it. */
    uniform vec2 uCmbD;       // x = log10 D astern, y = the span up to ahead
    uniform vec2 uResolution;
    uniform vec3 uForward;
    // Where the ship is going, which is only the same thing as where the
    // camera is looking until the visitor glances over their shoulder.
    // Aberration and Doppler ride on this one; the projection rides on
    // uForward. Sharing a single vector for both is what would put a
    // blueshift behind you.
    uniform vec3 uVelocity;
    uniform vec3 uRight;
    uniform vec3 uUp;
    // The galactic frame, in equatorial J2000. The panorama is pinned to this
    // and to nothing else — there is no adjustable rotation left in the file.
    uniform vec3 uGalX;   // toward the galactic centre
    uniform vec3 uGalY;
    uniform vec3 uGalZ;   // north galactic pole
    uniform float uBeta;
    uniform float uZoom;
    uniform float uTanHalfV;

    const float PI = 3.141592653589793;
    const float TAU = 6.283185307179586;

    void main() {
      // Perspective ray in the traveler's frame. WebGL's y axis already
      // points upward, matching the camera basis.
      vec2 plane = (gl_FragCoord.xy - 0.5 * uResolution) /
                   (0.5 * uResolution.y);
      plane *= uTanHalfV / max(1.0, uZoom);
      vec3 observed = normalize(uForward + uRight * plane.x + uUp * plane.y);

      /* Inverse aberration: find the direction this arriving ray had in the
         rest sky before the traveler moved.

         cos θ = (cos θ′ − β) / (1 − β cos θ′). The minus belongs here, and it
         is the mirror of the plus in the forward relation printed on the page
         — θ′ is what you see, θ is where it started. */
      float cp = clamp(dot(observed, uVelocity), -1.0, 1.0);
      float denom = max(0.000001, 1.0 - uBeta * cp);
      float c = clamp((cp - uBeta) / denom, -1.0, 1.0);
      float s = sqrt(max(0.0, 1.0 - c * c));
      vec3 transverse = observed - uVelocity * cp;
      float tn = length(transverse);
      transverse = tn > 0.00001 ? transverse / tn : uRight;
      vec3 restRay = normalize(uVelocity * c + transverse * s);

      /* Where that ray points in galactic coordinates, and straight into the
         photograph. No anchor basis, no roll, no crop, no blend — longitude
         and latitude are the whole mapping.

         The horizontal wrap is handled by REPEAT on the texture rather than
         by fract() plus a clamp, so the seam at l = 180 degrees interpolates
         across instead of stopping dead. */
      float gx = dot(restRay, uGalX);
      float gy = dot(restRay, uGalY);
      float gz = dot(restRay, uGalZ);
      vec2 panoUV = vec2(
        0.5 - atan(gy, gx) / TAU,
        clamp(0.5 - asin(clamp(gz, -1.0, 1.0)) / PI, 0.0005, 0.9995)
      );
      vec3 color = texture2D(uPanorama, panoUV).rgb * uTintA
                 + texture2D(uPlateB, panoUV).rgb * uTintB
                 + texture2D(uPlateC, panoUV).rgb * uTintC;

      // D is the same Doppler factor used by the catalogue renderer. A
      // monitor cannot carry D^4 over this range, so its effect is rolled
      // into a photographic highlight curve: dim/red behind, bright/blue
      // ahead, with white saturation at the extreme instead of neon.
      float gamma = inversesqrt(max(0.000001, 1.0 - uBeta * uBeta));
      float D = 1.0 / max(0.000001, gamma * (1.0 - uBeta * cp));
      float shift = clamp(log(max(D, 0.00001)) / log(2.0) * 0.16, -0.9, 0.9);
      vec3 balance = vec3(exp(-0.72 * shift), 1.0, exp(0.82 * shift));
      float beam = clamp(pow(max(D, 0.00001), 1.28), 0.0, 60.0);
      vec3 linear = pow(max(color, 0.0), vec3(2.2)) * balance * beam;

      /* The microwave background goes in here — in linear light, before the
         shoulder, so that it saturates the same way everything else does.
         Below about 700 K the strip holds zero and this is exactly nothing,
         which is the honest answer for all but the last two rungs. */
      float logD = log(max(D, 1e-20)) / log(10.0);
      float cmbU = clamp((logD - uCmbD.x) / max(1e-9, uCmbD.y), 0.0, 1.0);
      vec4 cmb = texture2D(uCmb, vec2(cmbU, 0.5));
      if (cmb.a > 0.0) {
        linear += cmb.rgb *
          pow(10.0, uCmbRange.x - uCmbRange.y * (1.0 - cmb.a));
      }

      // One operator, at the end, and it never clips a channel.
      //
      // The previous clamp(linear, 0, 1) was the reason the forward cone
      // turned into a featureless white slab: every channel hit the ceiling
      // together and all the structure inside the cone — and all of its hue —
      // was thrown away at once. The magnified inset, which looks straight
      // down the brightest part of that cone, showed nothing but 255s.
      //
      // A hyperbolic shoulder leaves the resting sky alone (below the knee it
      // is the identity) and compresses everything above it asymptotically
      // toward white, so a hundredfold boost still reads as brighter than a
      // tenfold one instead of both reading as paper.
      const float knee = 0.75;
      linear = linear / (1.0 + max(vec3(0.0), linear - vec3(knee)));
      color = pow(max(linear, 0.0), vec3(1.0 / 2.2));

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function PhotoSky(canvas, panoramaUrl, onReady, onFail) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    this.ready = false;
    this.failed = false;
    this.W = 0;
    this.H = 0;

    // No WebGL at all. Say so loudly enough for the caller to switch to the
    // modelled sky rather than leaving a still photograph on screen that
    // never responds to the slider.
    if (!this.gl) {
      this.failed = true;
      if (onFail) setTimeout(onFail, 0);
      return;
    }

    try {
      const gl = this.gl;
      this.program = program(gl, VERTEX, FRAGMENT);
      gl.useProgram(this.program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1,
      ]), gl.STATIC_DRAW);
      const pos = gl.getAttribLocation(this.program, "aPosition");
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      this.u = {};
      for (const name of [
        "uPanorama", "uPlateB", "uPlateC", "uTintA", "uTintB", "uTintC",
        "uCmb", "uCmbRange", "uCmbD",
        "uResolution", "uForward", "uVelocity",
        "uRight", "uUp",
        "uGalX", "uGalY", "uGalZ", "uBeta", "uZoom",
        "uTanHalfV",
      ]) this.u[name] = gl.getUniformLocation(this.program, name);

      this._loadTexture(panoramaUrl, 1).then((panorama) => {
        this.panorama = panorama;
        // Slot 0, at full white — the single-band view is the one-layer case
        // of the composite, not a separate path through the shader.
        this.slots = [panorama, null, null];
        this._layerUrls = [panoramaUrl, null, null];
        this._tints = [[1, 1, 1], [0, 0, 0], [0, 0, 0]];
        this.ready = true;
        if (onReady) onReady(this);
      }).catch(() => {
        this.failed = true;
        if (onFail) onFail(this);
      });
    } catch (e) {
      this.gl = null;
      this.failed = true;
      if (onFail) setTimeout(onFail, 0);
    }
  }

  PhotoSky.prototype._loadTexture = function (url, unit) {
    const gl = this.gl;
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB,
          gl.UNSIGNED_BYTE, image);

        /* The panorama is 4096 × 2048 — both powers of two, which the old
           1774 × 887 plate was not, and that unlocks two things WebGL 1 will
           not give a non-power-of-two texture.

           REPEAT on S, so the seam at l = 180° wraps instead of clamping into
           a smeared column. And mipmaps, which matter more than they look:
           relativistic aberration *minifies* the sky, so at 0.99 c a single
           screen pixel covers a large patch of the photograph, and point
           sampling that is a shimmering mess. Trilinear filtering is what
           keeps the compressed sky looking like a sky.

           Latitude still clamps — the poles are the top and bottom rows and
           there is nothing beyond them to wrap to. */
        const pot = (n) => (n & (n - 1)) === 0;
        const repeatable = pot(image.naturalWidth) && pot(image.naturalHeight);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,
          repeatable ? gl.REPEAT : gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (repeatable) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
            gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        resolve(texture);
      };
      image.onerror = reject;
      image.src = url;
    });
  };

  /* Swap which all-sky plate the shader samples.

     Nothing else changes — and that is the point. Aberration is geometry and
     does not know what wavelength it is bending, so every plate goes through
     the identical transform the visible one does. The band control is a
     texture swap and not one line of new physics.

     The plate is fetched on demand, because thirteen of them is four
     megabytes and nobody looks at all thirteen. Until it arrives the old one
     stays on screen rather than blanking, which is why `ready` is not cleared
     — a half-second of the previous band beats a half-second of black. */
  /* Up to three layers, each {url, tint}. One layer with a white tint is the
     ordinary single-band view; two or three is a composite the visitor mixed.

     Slots are addressed by index rather than diffed, because the interesting
     case is a preset changing all three at once and any cleverness about
     "which of these did not move" would be cleverness about the rare case.
     Textures already loaded for the same url are kept, though — retinting a
     layer must not re-fetch a megabyte. */
  const SLOT_UNIT = [1, 4, 5];

  PhotoSky.prototype.setLayers = function (layers, done) {
    if (!this.gl || this.failed) return;
    const gl = this.gl;
    this._layerUrls = this._layerUrls || [];
    this._tints = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const token = (this._layerToken = (this._layerToken || 0) + 1);
    let pending = 0;

    for (let i = 0; i < 3; i++) {
      const layer = layers[i];
      this._tints[i] = layer ? layer.tint : [0, 0, 0];
      if (!layer) continue;
      if (this._layerUrls[i] === layer.url && this.slots && this.slots[i]) continue;
      pending++;
      const slot = i;
      const url = layer.url;
      this._loadTexture(url, SLOT_UNIT[slot]).then((tex) => {
        // A later selection may have landed while this was in flight.
        if (this._layerToken !== token) { gl.deleteTexture(tex); return; }
        this.slots = this.slots || [];
        if (this.slots[slot]) gl.deleteTexture(this.slots[slot]);
        this.slots[slot] = tex;
        this._layerUrls[slot] = url;
        if (slot === 0) this.panorama = tex;
        if (--pending === 0 && done) done(null);
      }).catch((e) => { if (done) done(e || new Error("plate failed")); });
    }
    if (pending === 0 && done) done(null);
  };

  /* ── the microwave background strip ──────────────────────────────────
     Rebuilt only when the speed changes, which is at most once a frame and
     usually not at all. 256 samples of colour.js across the whole sky, log-
     encoded so eight bits can carry a term that runs over twenty decades.

     Six decades of range below the peak is plenty: anything fainter than a
     millionth of the brightest point in the frame is not going to survive the
     tone curve, and spending the bits there instead would put visible steps
     in the part that does show. */
  const CMB_TEXELS = 256;
  const CMB_DECADES = 6;

  PhotoSky.prototype._updateCmb = function (beta) {
    if (beta === this._cmbBeta && this.cmbTex) return;
    this._cmbBeta = beta;
    const gl = this.gl;
    const COL = window.HSAT_COLOUR;

    if (!this.cmbTex) {
      this.cmbTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.cmbTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    const data = new Uint8Array(CMB_TEXELS * 4);
    this._cmbRange = [0, 1];
    this._cmbD = [0, 1];

    // Without colour.js there is nothing to sample and the strip stays empty,
    // which leaves the shader exactly where it was before this existed.
    if (COL && COL.cmbLuxPerSr) {
      // sky.js publishes the lux-per-steradian → display-linear conversion so
      // both skies put the glow at the same luminance.
      const toDisplay = (window.HSAT_Sky && window.HSAT_Sky.DIFFUSE_TO_DISPLAY) || 176;
      // D runs from dead astern to dead ahead and the strip spans exactly
      // that, evenly in log — see the note on uCmbD in the shader for why
      // this is not indexed by angle.
      const logLo = Math.log10(Math.sqrt((1 - beta) / (1 + beta)));
      const logHi = Math.log10(Math.sqrt((1 + beta) / (1 - beta)));
      const span = Math.max(1e-9, logHi - logLo);
      const mag = new Float64Array(CMB_TEXELS);
      const chroma = new Float32Array(CMB_TEXELS * 3);
      let peak = 0;

      for (let i = 0; i < CMB_TEXELS; i++) {
        // Texel centres, matching how the shader indexes with log D.
        const D = Math.pow(10, logLo + span * ((i + 0.5) / CMB_TEXELS));
        const lux = COL.cmbLuxPerSr(D) * toDisplay;
        if (!(lux > 0)) continue;
        const c = COL.chromaAt(D * COL.CMB);
        const Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        if (!(Y > 0)) continue;
        chroma[i * 3] = c[0];
        chroma[i * 3 + 1] = c[1];
        chroma[i * 3 + 2] = c[2];
        // Carry the magnitude the way the renderers do: chroma is normalised
        // to a peak channel of 1, so the scale that goes with it is lux ÷ Y.
        mag[i] = lux / Y;
        if (mag[i] > peak) peak = mag[i];
      }

      if (peak > 0) {
        const peakLog = Math.log10(peak);
        const floorLog = peakLog - CMB_DECADES;
        for (let i = 0; i < CMB_TEXELS; i++) {
          if (!(mag[i] > 0)) continue;
          const a = (Math.log10(mag[i]) - floorLog) / CMB_DECADES;
          if (!(a > 0)) continue;
          const o = i * 4;
          data[o] = Math.round(Math.min(1, chroma[i * 3]) * 255);
          data[o + 1] = Math.round(Math.min(1, chroma[i * 3 + 1]) * 255);
          data[o + 2] = Math.round(Math.min(1, chroma[i * 3 + 2]) * 255);
          data[o + 3] = Math.round(Math.min(1, a) * 255);
        }
        this._cmbRange = [peakLog, CMB_DECADES];
      }
      this._cmbD = [logLo, span];
    }

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.cmbTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CMB_TEXELS, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, data);
  };

  PhotoSky.prototype.resize = function (cssW, cssH) {
    if (!this.gl) return false;
    // Render at the full device resolution the plates can actually feed.
    // This shader is a single full-screen pass, so the extra pixels are
    // nearly free and the difference on a retina display is obvious.
    const maxPixels = 3.2e6;
    let dpr = Math.min(devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.round(cssW * dpr));
    let h = Math.max(2, Math.round(cssH * dpr));
    if (w * h > maxPixels) {
      const k = Math.sqrt(maxPixels / (w * h));
      w = Math.max(2, Math.round(w * k));
      h = Math.max(2, Math.round(h * k));
    }
    if (w === this.W && h === this.H) return false;
    this.W = this.canvas.width = w;
    this.H = this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    return true;
  };

  PhotoSky.prototype.render = function (beta, forward, zoom = 1, view) {
    if (!this.ready || !this.gl || !this.W) return false;
    const gl = this.gl;
    view = view || forward;
    const b = basis(view);
    gl.useProgram(this.program);
    this._updateCmb(beta);
    gl.uniform1i(this.u.uPanorama, 1);
    gl.uniform1i(this.u.uPlateB, 4);
    gl.uniform1i(this.u.uPlateC, 5);
    gl.uniform1i(this.u.uCmb, 3);
    gl.uniform2f(this.u.uCmbRange, this._cmbRange[0], this._cmbRange[1]);
    gl.uniform2f(this.u.uCmbD, this._cmbD[0], this._cmbD[1]);

    /* Every slot gets a live texture bound whether it is in use or not — a
       sampler left pointing at nothing reads as black on some drivers and
       throws an incomplete-texture warning on others. Unused slots point at
       slot 0 and are multiplied by a zero tint. */
    const slots = this.slots || [];
    const base = slots[0] || this.panorama;
    const tints = this._tints || [[1, 1, 1], [0, 0, 0], [0, 0, 0]];
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, base);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, slots[1] || base);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, slots[2] || base);
    gl.uniform3fv(this.u.uTintA, tints[0]);
    gl.uniform3fv(this.u.uTintB, tints[1]);
    gl.uniform3fv(this.u.uTintC, tints[2]);
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.cmbTex);
    gl.uniform2f(this.u.uResolution, this.W, this.H);
    gl.uniform3fv(this.u.uForward, view);
    gl.uniform3fv(this.u.uVelocity, forward);
    gl.uniform3fv(this.u.uRight, b.right);
    gl.uniform3fv(this.u.uUp, b.up);
    gl.uniform3fv(this.u.uGalX, GAL.x);
    gl.uniform3fv(this.u.uGalY, GAL.y);
    gl.uniform3fv(this.u.uGalZ, GAL.z);
    gl.uniform1f(this.u.uBeta, beta);
    gl.uniform1f(this.u.uZoom, zoom);
    gl.uniform1f(this.u.uTanHalfV, TAN_HALF_V);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };

  window.HSAT_PhotoSky = PhotoSky;
})();
