/* ══════════════════════════════════════════════════════════════════════
   photo-sky.js — one photographic sky, at every speed.

   The opening plate is not replaced when motion begins. It is the forward,
   high-resolution window into a full equirectangular sky. This shader runs
   every screen ray backwards through relativistic aberration, samples the
   same surrounding panorama, then applies a display-safe version of Doppler
   colour and beaming. The catalogue canvas is screen-blended over it for
   exact bright-star positions.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const HALF_V = 49 * Math.PI / 360;
  const TAN_HALF_V = Math.tan(HALF_V);

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

    uniform sampler2D uHero;
    uniform sampler2D uPanorama;
    uniform sampler2D uReturn;
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
    uniform vec3 uAnchorForward;
    uniform vec3 uAnchorRight;
    uniform vec3 uAnchorUp;
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

      // Inverse aberration: find the direction this arriving ray had in the
      // rest sky before the traveler moved. This is algebraically identical
      // to tan(theta'/2) = sqrt((1-beta)/(1+beta)) tan(theta/2).
      float cp = clamp(dot(observed, uVelocity), -1.0, 1.0);
      float denom = max(0.000001, 1.0 - uBeta * cp);
      float c = clamp((cp - uBeta) / denom, -1.0, 1.0);
      float s = sqrt(max(0.0, 1.0 - c * c));
      vec3 transverse = observed - uVelocity * cp;
      float tn = length(transverse);
      transverse = tn > 0.00001 ? transverse / tn : uRight;
      vec3 restRay = normalize(uVelocity * c + transverse * s);

      // Fixed coordinates in the surrounding photographic sphere.
      float lx = dot(restRay, uAnchorRight);
      float ly = dot(restRay, uAnchorUp);
      float lz = dot(restRay, uAnchorForward);

      // The panorama's Galactic plane is horizontal. Roll it once so its
      // central band continues the diagonal composition of the hero plate.
      const float roll = -0.35;
      float xr = lx * cos(roll) - ly * sin(roll);
      float yr = lx * sin(roll) + ly * cos(roll);
      vec2 panoUV = vec2(
        fract(atan(xr, lz) / TAU + 0.5),
        clamp(0.5 - asin(clamp(yr, -1.0, 1.0)) / PI, 0.001, 0.999)
      );
      /* None of the three sources was shot or graded with the others, so each
         one needs putting on the same exposure before it can be blended with
         the rest. These gains are least-squares fits taken over the band
         where the shader actually hands over (the "over" metric between 0.30
         and 1.10),
         sampled across the whole sphere — not at the middle of a plate, where
         the panorama's far lower resolution smooths the galactic core away
         and makes the comparison meaningless. The hero plate is the
         reference, because it is the opening frame and its exposure is the
         one thing here that must not move.

         The old gain matched the panorama to the hero and left the return
         plate alone, which was fine until you went fast enough to see it: at
         0.999 c the middle of the frame is a tall oval of panorama sitting
         inside the return plate, and that oval was up to 22% out in blue.
         It read as the picture glitching, because a soft-edged patch of sky
         at the wrong exposure is not something a sky does. */
      const vec3 panoGain = vec3(0.497, 0.506, 0.539);
      const vec3 returnGain = vec3(1.069, 1.113, 1.221);
      vec3 pano = texture2D(uPanorama, panoUV).rgb * panoGain;

      // The original plate is only the high-resolution outbound window. The
      // opposite direction must come from the opposite side of the full sky
      // panorama; mirroring this plate here made the 180-degree turn land on
      // the exact same stars.
      float heroMask = 0.0;
      vec3 hero = pano;
      if (lz > 0.0001) {
        float hx = lx / (lz * uTanHalfV * (16.0 / 9.0));
        float hy = ly / (lz * uTanHalfV);

        // At rest the plate maps one-to-one onto the frame, so cropping into
        // it threw away resolution for nothing: at 0.70 the visible sky was
        // the middle half of the photograph blown up by 1.4x, which is
        // exactly why it looked soft. Sitting just inside the edge keeps the
        // picture at its native scale and still leaves a margin to blend in.
        const float heroCrop = 0.95;
        vec2 heroCoord = vec2(hx, hy) * heroCrop;

        // How far outside the plate the sample fell. A sixth-power metric is
        // rectangular enough to use the whole photograph but has no corners
        // to catch the eye.
        vec2 edge = abs(heroCoord);
        float over = pow(pow(edge.x, 6.0) + pow(edge.y, 6.0), 1.0 / 6.0);

        // The width of the handover has to follow the speed. At rest the
        // plate covers the frame exactly, so any blending is pure loss of
        // sharpness — the feather stays right at the edge and never bites.
        // Once aberration starts pulling in light from outside the plate the
        // boundary moves into view, and a narrow feather there is exactly
        // what showed up as a rectangle drawn across the sky at 0.5 c. So it
        // widens until the handover is spread over most of the picture and
        // there is no edge left to find.
        float soft = clamp(uBeta * 3.0, 0.0, 1.0);
        heroMask = 1.0 - smoothstep(mix(0.97, 0.28, soft), 1.16, over);

        vec2 heroUV = vec2(0.5 + 0.5 * heroCoord.x, 0.5 - 0.5 * heroCoord.y);
        // Mirror the few pixels inside the feather that lie beyond the plate;
        // clamping would stretch the final row into a bright line.
        heroUV = 1.0 - abs(mod(heroUV, 2.0) - 1.0);
        hero = texture2D(uHero, clamp(heroUV, 0.001, 0.999)).rgb;
      }

      // A separate full-resolution plate covers the opposite hemisphere.
      // The panorama still fills the area outside the photographic window,
      // but the view straight toward Earth no longer enlarges a small crop
      // of that panorama across the whole screen.
      float returnMask = 0.0;
      vec3 returnSky = pano;
      if (lz < -0.0001) {
        float returnZ = -lz;
        float rx = -lx / (returnZ * uTanHalfV * (16.0 / 9.0));
        float ry = ly / (returnZ * uTanHalfV);
        const float returnCrop = 0.95;
        vec2 returnCoord = vec2(rx, ry) * returnCrop;
        vec2 rEdge = abs(returnCoord);
        float rOver = pow(pow(rEdge.x, 6.0) + pow(rEdge.y, 6.0), 1.0 / 6.0);
        float rSoft = clamp(uBeta * 3.0, 0.0, 1.0);
        returnMask = 1.0 - smoothstep(mix(0.97, 0.28, rSoft), 1.16, rOver);
        vec2 returnUV = vec2(
          0.5 + 0.5 * returnCoord.x,
          0.5 - 0.5 * returnCoord.y
        );
        returnUV = 1.0 - abs(mod(returnUV, 2.0) - 1.0);
        returnSky = texture2D(uReturn, clamp(returnUV, 0.001, 0.999)).rgb * returnGain;
      }

      vec3 color = mix(pano, hero, heroMask);
      color = mix(color, returnSky, returnMask);

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

  function PhotoSky(canvas, heroUrl, panoramaUrl, returnUrl, anchorForward, onReady, onFail) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: false,
    });
    this.ready = false;
    this.failed = false;
    this.W = 0;
    this.H = 0;
    this.anchorForward = anchorForward.slice();
    const ab = basis(this.anchorForward);
    this.anchorRight = ab.right;
    this.anchorUp = ab.up;

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
        "uHero", "uPanorama", "uReturn", "uResolution", "uForward", "uVelocity",
        "uRight", "uUp",
        "uAnchorForward", "uAnchorRight", "uAnchorUp", "uBeta", "uZoom",
        "uTanHalfV",
      ]) this.u[name] = gl.getUniformLocation(this.program, name);

      Promise.all([
        this._loadTexture(heroUrl, 0),
        this._loadTexture(panoramaUrl, 1),
        this._loadTexture(returnUrl, 2),
      ]).then(([hero, panorama, returnSky]) => {
        this.hero = hero;
        this.panorama = panorama;
        this.returnSky = returnSky;
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB,
          gl.UNSIGNED_BYTE, image);
        resolve(texture);
      };
      image.onerror = reject;
      image.src = url;
    });
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
    gl.uniform1i(this.u.uHero, 0);
    gl.uniform1i(this.u.uPanorama, 1);
    gl.uniform1i(this.u.uReturn, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.hero);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.panorama);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.returnSky);
    gl.uniform2f(this.u.uResolution, this.W, this.H);
    gl.uniform3fv(this.u.uForward, view);
    gl.uniform3fv(this.u.uVelocity, forward);
    gl.uniform3fv(this.u.uRight, b.right);
    gl.uniform3fv(this.u.uUp, b.up);
    gl.uniform3fv(this.u.uAnchorForward, this.anchorForward);
    gl.uniform3fv(this.u.uAnchorRight, this.anchorRight);
    gl.uniform3fv(this.u.uAnchorUp, this.anchorUp);
    gl.uniform1f(this.u.uBeta, beta);
    gl.uniform1f(this.u.uZoom, zoom);
    gl.uniform1f(this.u.uTanHalfV, TAN_HALF_V);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };

  window.HSAT_PhotoSky = PhotoSky;
})();
