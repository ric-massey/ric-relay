/* ─── `coffee2`: the coffee in a real (shallow) cup — stage 1 ────────────
   The terminal's `coffee`, rebuilt by stages to the brief Ric wrote on
   2026-11-26 ("Interactive Coffee — Build Brief"; docs/coffee-egg-plan.md has
   the stages). Typed as `coffee2` until it is good enough to replace `coffee`.

   Stage 1 (this file, so far): on a computer, with plain shading, prove the
   cup - it fills from the stream, splashes, settles, and drains, and the
   amount of coffee is accounted for throughout. Phone movement comes last
   (Ric: "get it to work without my phone and the rotation stuff. Then add in
   the rotation"). Creamer, bubbles, foam and the coffee's real optics are
   later stages.

   The cup is three-dimensional and shallow: the screen is its front glass,
   it is DEPTH_MM deep, its top is open. It is seen nearly straight on, from
   an eye a little above the top of the screen and a normal viewing distance
   in front of it, so the top of the coffee shows as a thin strip receding
   into the cup - the surface the brief wants visible for its reflections.

   The liquid's motion is the 2D FLIP simulation in assets/coffee.js
   (createSim), the same physics as `coffee`. In a cup a centimetre or two
   deep, liquid moves almost entirely in the screen's plane - a wave across
   the narrow depth is short, fast and gone in a moment - so the depth adds
   the look and not the motion. (Simulated in 3D on the CPU, four cells deep
   would take about 137,000 particles on a laptop's screen: measured at the
   2D solver's cost per particle, over 100 ms a frame. If the look later
   needs real depth-wise motion, that is a GPU solver, decided then.)

   Drawn with WebGL2: the front face of the liquid against the glass from the
   simulation's density field, its edge resolved per screen pixel; the top
   surface as a strip of triangles from the front edge to the back glass; the
   stream as a round column in the middle of the depth. No library. Without
   WebGL2 it falls back to `coffee`. */
(function (root) {
  const DRAIN_AFTER = 5;          // seconds full before it drains (as `coffee`)
  const PHONE_HOLD = 40 * 60;     // a phone keeps it forty minutes (as `coffee`)
  const STEP = 1 / 60;            // the simulation's fixed step
  const MOST_STEPS = 3;           // at most this many a frame; a slower device loses time, not stability
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ─── shaders ──────────────────────────────────────────────────────── */

  // One projection for everything: a point (x, y, z) in px, z into the cup
  // from the front glass (z = 0), seen from an eye at (ex, ey, -Zv). The front
  // glass lands exactly on the screen; things further back draw toward the
  // eye's foot (above the top), so a level surface below the eye shows as a
  // strip rising behind its front edge.
  const PROJECT = `
    uniform vec2 uSize;      // the screen, px
    uniform vec3 uEye;       // eye x, y (px) and its distance in front of the glass (px)
    vec4 project(vec3 p) {
      float w = (uEye.z + p.z) / uEye.z;
      vec2 s = uEye.xy + (p.xy - uEye.xy) / w;
      vec2 ndc = vec2(s.x / uSize.x * 2.0 - 1.0, 1.0 - s.y / uSize.y * 2.0);
      return vec4(ndc * w, 0.0, w);
    }`;

  // The light, shared by everything (stage 2). Axes: x right, y down, z into
  // the cup. The room is dim, brighter overhead; one broad soft light - a
  // window, a lamp - hangs above and behind the cup, so it is what the top of
  // the coffee mirrors. Water's Fresnel reflectance (n = 1.33, F0 = 0.02 by
  // Schlick): little looking straight in, most of the light at a glancing
  // angle - and the top of the coffee is seen at a glancing angle.
  // Coffee absorbs by Beer-Lambert, per mm: red 0.35, green 0.5, blue 0.65
  // (chosen to land on brewed coffee's browns, as in `coffee`).
  const LIGHT = `
    uniform vec3 uEye;
    const vec3 MU = vec3(0.35, 0.5, 0.65);
    const vec3 SUN = vec3(1.0, 0.94, 0.84);
    const vec3 LDIR = vec3(0.12, -0.3, 0.95);           // toward the soft light: low, up and behind the cup - where the
                                                        // top of the coffee, seen at a glance, mirrors
    vec3 env(vec3 r) {
      float up = clamp(-r.y, 0.0, 1.0);
      vec3 c = mix(vec3(0.02, 0.018, 0.016), vec3(0.11, 0.105, 0.1), up * up);
      float l = max(dot(r, normalize(LDIR)), 0.0);
      c += SUN * (0.14 * pow(l, 10.0) + 3.0 * pow(l, 220.0)); // a soft glow round it, and the light itself
      return c;
    }
    float fresnel(float cosT, float f0) { return f0 + (1.0 - f0) * pow(1.0 - clamp(cosT, 0.0, 1.0), 5.0); }
    vec3 viewDir(vec3 p) { return normalize(p - vec3(uEye.xy, -uEye.z)); }   // from the eye to the point
    // light that has come through t mm of coffee
    vec3 through(float t) { return SUN * exp(-MU * t); }`;

  // the front of the coffee, against the glass: a screen quad over the
  // density field. The edge is where the density crosses one half,
  // anti-aliased by its own screen-space derivative, so it is sharp at any
  // resolution. Coffee in the main body is seen through the cup's whole depth
  // and is all but black: a deep red-brown, from the light that comes in at
  // the lit surface and scatters back out, fading with depth below it. A piece
  // in flight - a drop, a splash, a sheet - is only as thick as it is wide, so
  // warm light comes through it, and its rounded face catches reflections.
  const FRONT_VS = `#version 300 es
    in vec2 aPos; out vec2 vPx; uniform vec2 uSize;
    void main() { vPx = (aPos * 0.5 + 0.5) * uSize; vPx.y = uSize.y - vPx.y; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FRONT_FS = `#version 300 es
    precision highp float;
    in vec2 vPx; out vec4 o;
    uniform sampler2D uField;   // r: density / 2, g: distance to air / 64 field px, b: 1 if part of the main body
    uniform vec2 uFieldPx;      // the field's extent in screen px
    uniform vec2 uTexel;        // one field px in uv
    uniform float uMm;          // mm per screen px
    uniform float uMmPerField;  // mm per field px
    uniform float uDepth;       // the cup's depth, mm
    ${LIGHT}
    void main() {
      vec2 uv = vPx / uFieldPx;
      vec4 f = texture(uField, uv);
      float d = f.r * 2.0;
      float aa = max(fwidth(d), 1e-4);
      float a = clamp((d - 0.5) / aa + 0.5, 0.0, 1.0);
      if (a <= 0.0) discard;
      vec3 V = viewDir(vec3(vPx, 0.0));
      float below = f.g * 64.0 * uMmPerField;               // mm below the nearest air
      vec3 c;
      if (f.b > 0.5) {
        // the body: through uDepth mm of coffee there is nothing left; what is
        // seen is light scattered back, warmest just under the lit surface
        float lit = exp(-below / 18.0);
        c = mix(vec3(0.045, 0.024, 0.013), vec3(0.20, 0.105, 0.05), lit) + through(uDepth);
        // the glass in front mirrors the dim room, a little
        c += 0.04 * env(reflect(V, vec3(0.0, 0.0, -1.0)));
      } else {
        // a piece in flight: round, as thick as it is wide here
        float gx = texture(uField, uv + vec2(uTexel.x, 0.0)).r - texture(uField, uv - vec2(uTexel.x, 0.0)).r;
        float gy = texture(uField, uv + vec2(0.0, uTexel.y)).r - texture(uField, uv - vec2(0.0, uTexel.y)).r;
        vec3 n = normalize(vec3(-gx, -gy, -0.35));
        float t = min(uDepth, 2.0 * below);
        float F = fresnel(dot(-V, n), 0.02);
        c = (1.0 - F) * 0.75 * through(t) + F * env(reflect(V, n));
      }
      o = vec4(c * a, a);
    }`;

  // the top surface: a strip from each point of the front edge back to the
  // glass behind, its normal tipped by the surface's own slope there, so the
  // reflections move as the waves do. Mostly a mirror of the soft light and
  // the room (the glancing angle); what Fresnel lets through sees the body.
  const TOP_VS = `#version 300 es
    in vec3 aPos; in vec3 aNormal; out vec3 vN; out vec3 vP;
    ${PROJECT}
    void main() { vN = aNormal; vP = aPos; gl_Position = project(aPos); }`;
  const TOP_FS = `#version 300 es
    precision highp float;
    in vec3 vN; in vec3 vP; out vec4 o;
    ${LIGHT}
    void main() {
      vec3 n = normalize(vN), V = viewDir(vP);
      float F = fresnel(dot(-V, n), 0.02);
      vec3 body = vec3(0.20, 0.105, 0.05);
      vec3 c = (1.0 - F) * body + F * env(reflect(V, n));
      o = vec4(c, 1.0);
    }`;

  // the stream: a round column in the middle of the depth, drawn as a band
  // facing the eye and shaded as the cylinder it is - light through its
  // chord (amber at the edges, dark through the middle), and the soft light
  // and the room mirrored on its curve
  const STREAM_VS = `#version 300 es
    in vec3 aPos; in float aAcross; in float aWidth; out float vU; out vec3 vP; out float vW;
    ${PROJECT}
    void main() { vU = aAcross; vP = aPos; vW = aWidth; gl_Position = project(aPos); }`;
  const STREAM_FS = `#version 300 es
    precision highp float;
    in float vU; in vec3 vP; in float vW; out vec4 o;
    uniform float uCream;        // 1 for the creamer's stream
    ${LIGHT}
    void main() {
      float s = sqrt(max(0.0, 1.0 - vU * vU));
      vec3 n = vec3(vU, 0.0, -s), V = viewDir(vP);
      float F = fresnel(dot(-V, n), 0.02);
      vec3 inside = uCream > 0.5 ? vec3(0.86, 0.80, 0.71) * (0.6 + 0.4 * s) : 0.8 * through(vW * s);
      vec3 c = (1.0 - F) * inside + F * env(reflect(V, n));
      float edge = clamp((1.0 - abs(vU)) * 6.0, 0.0, 1.0);   // the band's edge, softened by a pixel or so
      o = vec4(c * edge, edge);
    }`;

  function program(gl, vs, fs) {
    const make = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, k = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < k; i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    return { p, u };
  }

  /* ─── the view ─────────────────────────────────────────────────────── */

  // Everything WebGL holds, made fresh (also after a lost context)
  function makeView(gl) {
    const v = {
      front: program(gl, FRONT_VS, FRONT_FS),
      top: program(gl, TOP_VS, TOP_FS),
      stream: program(gl, STREAM_VS, STREAM_FS),
      quad: gl.createBuffer(), topBuf: gl.createBuffer(), streamBuf: gl.createBuffer(),
      field: gl.createTexture(), fieldW: 0, fieldH: 0, pixels: null,
      vao: gl.createVertexArray(),
    };
    gl.bindVertexArray(v.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, v.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, v.field);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return v;
  }

  function attrib(gl, prog, name, size, stride, offset) {
    const loc = gl.getAttribLocation(prog.p, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
  }

  function render(gl, v, sim, cupView) {
    const { W, H, depth, eye } = cupView;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const F = sim.field(), sy = H / sim.Hs;

    // the stream(s) in the air, in the middle of the depth (drawn first: where
    // a stream goes into the coffee, the coffee in front of it covers it)
    const G = 9.81 * sim.PXM;
    for (const S of sim.streams) {
      if (S.start < 0 || S.head <= 0 || S.done) continue;
      const yTop = Math.max(0, S.tail), yEnd = Math.min(S.head, S.land + 2);
      if (yEnd <= yTop) continue;
      const steps = Math.max(2, Math.ceil((yEnd - yTop) / 6)), data = new Float32Array((steps + 1) * 2 * 5);
      for (let k = 0; k <= steps; k++) {
        const y = yTop + ((yEnd - yTop) * k) / steps, vel = Math.sqrt(S.v0 * S.v0 + 2 * G * y), r = S.Q / vel / 2, wmm = 2 * r * sim.MM;
        // the band is a pixel wider each side than the stream, so its edge can be softened
        const pad = 1;
        data.set([S.xNow - r - pad, y * sy, depth / 2, -1 - pad / r, wmm, S.xNow + r + pad, y * sy, depth / 2, 1 + pad / r, wmm], k * 10);
      }
      const P = v.stream; gl.useProgram(P.p);
      gl.uniform2f(P.u.uSize, W, H); gl.uniform3f(P.u.uEye, eye[0], eye[1], eye[2]);
      gl.uniform1f(P.u.uCream, S.c ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, v.streamBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
      attrib(gl, P, "aPos", 3, 20, 0); attrib(gl, P, "aAcross", 1, 20, 12); attrib(gl, P, "aWidth", 1, 20, 16);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, (steps + 1) * 2);
    }

    // the top surface: from each point of the body's front edge back to the
    // back glass (columns with no body have none)
    {
      // The front edge, exactly: down each column of the field to the first
      // run of liquid a few samples deep (so a flying drop is not taken for
      // the surface), and between the two samples there, where the density
      // crosses one half - the same crossing the front face draws, so the
      // strip and the face meet. Whole samples made the strip a staircase.
      const n = F.fx, data = new Float32Array(n * 2 * 6), surf = new Float32Array(n), { dens, fy, fr } = F;
      for (let i = 0; i < n; i++) {
        let y = H;
        for (let j = 1; j < fy - 3; j++) {
          const a = dens[(j - 1) * n + i], b = dens[j * n + i];
          if (a < 0.5 && b >= 0.5 && dens[(j + 1) * n + i] >= 0.5 && dens[(j + 3) * n + i] >= 0.5) {
            y = (j - 0.5 + (0.5 - a) / (b - a)) * fr * sy; break;
          }
          if (j === 1 && a >= 0.5 && b >= 0.5) { y = 0; break; }
        }
        surf[i] = y;
      }
      // The surface's slope, for its normals, smoothed over the capillary
      // length (sqrt(sigma / (rho g)) = 2.7 mm for coffee): ripples shorter than
      // that are flattened at once by surface tension and viscosity on real
      // coffee, and here they would only be the particles' grain. The strip's
      // place is not smoothed, so it still meets the front edge exactly.
      const lc = 2.7 / sim.MM, sig = Math.max(1, lc / F.fr), K = Math.ceil(2.5 * sig), sm = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let a = 0, w = 0;
        for (let k = -K; k <= K; k++) {
          const j = i + k; if (j < 0 || j >= n || surf[j] >= H - 0.5) continue;
          const g = Math.exp(-(k * k) / (2 * sig * sig)); a += surf[j] * g; w += g;
        }
        sm[i] = w ? a / w : surf[i];
      }
      let m = 0;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * F.fr, y = surf[i];
        const dy = (sm[Math.min(n - 1, i + 1)] - sm[Math.max(0, i - 1)]) / (2 * F.fr);
        const len = Math.hypot(dy, 1), nx = dy / len, ny = -1 / len;   // up, tipped with the slope
        const live = y < H - 0.5;
        data.set([x, live ? y : H, 0, nx, ny, 0, x, live ? y : H, depth, nx, ny, 0], m); m += 12;
      }
      const P = v.top; gl.useProgram(P.p);
      gl.uniform2f(P.u.uSize, W, H); gl.uniform3f(P.u.uEye, eye[0], eye[1], eye[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, v.topBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
      attrib(gl, P, "aPos", 3, 24, 0); attrib(gl, P, "aNormal", 3, 24, 12);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
    }

    // the front face, against the glass
    {
      const { fx, fy, dens, dist } = F, NF = fx * fy;
      if (v.fieldW !== fx || v.fieldH !== fy) { v.fieldW = fx; v.fieldH = fy; v.pixels = new Uint8Array(NF * 4); v.main = new Uint8Array(NF); v.stack = new Int32Array(NF); }
      // Which liquid is the main body: everything joined to the floor or the
      // walls. The rest is in flight - drops, splashes, sheets - and is only
      // as thick as it is wide, where the body is as thick as the cup is deep.
      const main = v.main, stack = v.stack;
      main.fill(0);
      let top = 0;
      const seed = (f) => { if (!main[f] && dens[f] >= 0.5) { main[f] = 1; stack[top++] = f; } };
      for (let i = 0; i < fx; i++) seed((fy - 1) * fx + i);
      for (let j = 0; j < fy; j++) { seed(j * fx); seed(j * fx + fx - 1); }
      while (top) {
        const f = stack[--top], i = f % fx;
        if (i > 0) seed(f - 1);
        if (i < fx - 1) seed(f + 1);
        if (f >= fx) seed(f - fx);
        if (f + fx < NF) seed(f + fx);
      }
      const px = v.pixels;
      for (let f = 0, o = 0; f < NF; f++, o += 4) {
        px[o] = Math.min(255, dens[f] * 127.5);
        px[o + 1] = Math.min(255, dist[f] * 4);
        // the edge's own pixels, just outside the half-density line, take the body's mark from a neighbour
        const i = f % fx;
        px[o + 2] = main[f] || (dens[f] > 0.1 && ((i > 0 && main[f - 1]) || (i < fx - 1 && main[f + 1]) || (f >= fx && main[f - fx]) || (f + fx < NF && main[f + fx]))) ? 255 : 0;
      }
      gl.bindTexture(gl.TEXTURE_2D, v.field);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fx, fy, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const P = v.front; gl.useProgram(P.p);
      gl.disableVertexAttribArray(1);
      gl.uniform2f(P.u.uSize, W, H);
      gl.uniform2f(P.u.uFieldPx, fx * F.fr, fy * F.fr * sy);
      gl.uniform2f(P.u.uTexel, 1 / fx, 1 / fy);
      gl.uniform3f(P.u.uEye, eye[0], eye[1], eye[2]);
      gl.uniform1f(P.u.uMm, sim.MM);
      gl.uniform1f(P.u.uDepth, cupView.depthMm);
      gl.uniform1f(P.u.uMmPerField, F.fr * sim.MM);
      gl.uniform1i(P.u.uField, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, v.quad);
      attrib(gl, P, "aPos", 2, 8, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /* ─── on the page ──────────────────────────────────────────────────── */

  let cup = null;

  function pour() {
    if (cup || !root.document) return false;
    if (!root.RELAY_COFFEE?.createSim) return false;
    const doc = root.document;
    const canvas = doc.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.coffee = "2";
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000";
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return root.RELAY_COFFEE.pour();          // no WebGL2: the first coffee
    doc.body.appendChild(canvas);

    const phone = !!root.matchMedia?.("(pointer: coarse)").matches && Math.min(root.screen?.width || 1e4, root.screen?.height || 1e4) < 600;
    const hold = phone ? PHONE_HOLD : DRAIN_AFTER;
    const mm = phone ? 68 / Math.min(root.screen.width, root.screen.height) : 0.2646;
    // The cup: as deep as a fifth of the screen's short side, 10 to 25 mm
    // (chosen: shallow enough to read as coffee behind glass, deep enough for
    // the top to show); seen from 300 mm (a phone in the hand) or 500 mm (a
    // computer), from an eye level with a point 15% of the height above the
    // top of the screen (chosen: high enough to look down on the surface).
    const debug = /coffeedebug/.test((root.location?.search || "") + (root.location?.hash || "")) || (() => { try { return root.localStorage.getItem("coffeedebug") === "1"; } catch { return false; } })();

    let view = null, sim = null, W = 0, H = 0, cupView = null, raf = 0, wall = 0, acc = 0, wake = 0, lost = false;
    let stats = { frames: 0, stepMs: 0, drawMs: 0 }, panel = null;
    const fit = () => {
      const w = canvas.clientWidth || root.innerWidth, hgt = canvas.clientHeight || root.innerHeight;
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
      if (!sim || Math.abs(w - W) > 1 || Math.abs(hgt - H) > 1) {
        // A new size is a new cup, already poured, holding what the old one held:
        // the level is the volume over the new floor (it can only be remapped, not kept
        // particle by particle, as the shape changed)
        const level = sim ? sim.level() : null;
        W = w; H = hgt;
        sim = root.RELAY_COFFEE.createSim(W, H, { hold, mm, cream: 0 });
        if (level !== null && level > 0.01) sim.still(level);
        const short = Math.min(W, H) * mm;
        const depthMm = clamp(short / 5, 10, 25);
        cupView = { W, H, depth: depthMm / mm, eye: [W / 2, -0.15 * H, (phone ? 300 : 500) / mm], depthMm };
      }
      if (view && !lost) paint();
    };
    const paint = () => { const a = performance.now(); render(gl, view, sim, cupView); stats.drawMs += performance.now() - a; };
    const resume = () => { root.clearTimeout(wake); if (!raf && cup && !lost && !doc.hidden) { wall = 0; raf = root.requestAnimationFrame(frame); } };
    const empty = () => {
      root.cancelAnimationFrame(raf); raf = 0; root.clearTimeout(wake);
      root.removeEventListener("resize", onResize);
      doc.removeEventListener("visibilitychange", onVisible);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove(); panel?.remove(); cup = null;
    };
    const frame = (now) => {
      raf = 0;
      let dt = wall ? (now - wall) / 1000 : STEP; wall = now;
      // Fixed steps: the same coffee at any frame rate. Back from a long gap
      // (asleep, a hidden tab), that time passed on the drain's clock, but
      // nothing moved in it.
      if (dt > 0.25) { sim.skip(dt); dt = STEP; }
      acc += dt;
      let steps = 0;
      const a = performance.now();
      while (acc >= STEP && steps < MOST_STEPS) { sim.step(STEP); acc -= STEP; steps++; }
      if (acc >= STEP) { sim.skip(acc); acc = 0; }   // too slow to keep up: lose the time, not the stability
      stats.stepMs += performance.now() - a;
      paint();
      if (debug) report();
      if (sim.done) return empty();
      if (sim.idle()) wake = root.setTimeout(resume, Math.max(0, (sim.fullAt + sim.hold - sim.t) * 1000) + 30);
      else raf = root.requestAnimationFrame(frame);
    };
    // what went in and where it went, and the frame's cost (?coffeedebug)
    const report = () => {
      stats.frames++;
      if (stats.frames % 15) return;
      if (!panel) {
        panel = doc.createElement("pre");
        panel.style.cssText = "position:fixed;right:8px;top:8px;z-index:2147483001;margin:0;padding:6px 8px;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.6);pointer-events:none";
        doc.body.appendChild(panel);
      }
      const ml = (area) => ((area * mm * mm * cupView.depthMm) / 1000).toFixed(0);
      const poured = (sim.emitted || 0) + (sim.cream.poured || 0) + (sim.dripped || 0);
      panel.textContent = [
        `step ${(stats.stepMs / 15).toFixed(1)} ms   draw ${(stats.drawMs / 15).toFixed(1)} ms`,
        `cup ${cupView.depthMm.toFixed(0)} mm deep`,
        `poured ${ml(poured)} ml`, `in the cup ${ml(sim.total())} ml`,
        `out the top ${ml(sim.spiltSum || 0)} ml`, `drained ${ml(sim.drainedSum || 0)} ml`,
      ].join("\n");
      stats.stepMs = stats.drawMs = 0;
    };
    const onResize = () => { fit(); resume(); };
    const onVisible = () => { if (doc.hidden) { root.cancelAnimationFrame(raf); raf = 0; } else resume(); };
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; root.cancelAnimationFrame(raf); raf = 0; });
    canvas.addEventListener("webglcontextrestored", () => { lost = false; view = makeView(gl); resume(); });
    root.addEventListener("resize", onResize);
    doc.addEventListener("visibilitychange", onVisible);

    try { view = makeView(gl); } catch (err) { canvas.remove(); return root.RELAY_COFFEE.pour(); }
    cup = { canvas };
    fit();
    raf = root.requestAnimationFrame(frame);
    return true;
  }

  root.RELAY_COFFEE2 = { pour, poured: () => !!cup };
})(typeof window !== "undefined" ? window : globalThis);
