/* RADAR 3D — one radar's whole volume, turned in the hand
   ────────────────────────────────────────────────────────────────────────────
   Built 2026-10-24, the last of the outside review's specialist items Ric
   passed on ("3D radar"): GR2Analyst's volume explorer, in the browser.
   Nexrad.volumePoints puts every tilt's gates where their beams are; this
   draws them as points with WebGL (built into every browser — no library),
   over range rings on the ground, and lets the visitor turn it: drag to
   orbit, wheel or pinch to zoom, arrow keys too. Height can be stretched,
   because a storm is 15 km tall and 100 km wide and looks flat at true
   scale — the view always says by how much.

   The camera maths is pure and exported for the tests:
     perspective(fovy, aspect, near, far), lookAt(eye, target, up),
     multiply(a, b), apply(m, [x, y, z]) → clip [x, y, z, w],
     eyeOf(cam) the eye of an orbit camera { yaw (0 = looking north),
     pitch (degrees above the ground), dist (km), target [x, y, z] }.
   view(canvas, labels) the renderer; null when the browser has no WebGL. */
(function (root) {
  'use strict';
  const D = Math.PI / 180;
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy * D / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function lookAt(eye, target, up) {
    const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  }
  /* column-major, as WebGL takes them: (a × b) applies b first */
  function multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; }
    return o;
  }
  const apply = (m, p) => [0, 1, 2, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  function eyeOf(cam) {
    const y = cam.yaw * D, p = cam.pitch * D, t = cam.target;
    return [t[0] - cam.dist * Math.cos(p) * Math.sin(y), t[1] - cam.dist * Math.cos(p) * Math.cos(y), t[2] + cam.dist * Math.sin(p)];
  }

  const VS = `attribute vec3 p; attribute vec4 c; uniform mat4 m; uniform float ex; uniform float ps; varying vec4 vc;
    void main() { gl_Position = m * vec4(p.x, p.y, p.z * ex, 1.0); gl_PointSize = ps; vc = c; }`;
  const FS = `precision mediump float; varying vec4 vc; void main() { gl_FragColor = vc; }`;

  function view(canvas, labels) {
    const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('radar3d: ' + gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    gl.useProgram(prog);
    const aP = gl.getAttribLocation(prog, 'p'), aC = gl.getAttribLocation(prog, 'c'), uM = gl.getUniformLocation(prog, 'm'), uEx = gl.getUniformLocation(prog, 'ex'), uPs = gl.getUniformLocation(prog, 'ps');
    const buf = () => gl.createBuffer();
    const pts = { p: buf(), c: buf(), n: 0 }, lines = { p: buf(), c: buf(), n: 0 };
    const S = { cam: { yaw: 20, pitch: 35, dist: 420, target: [0, 0, 4] }, ex: 4, size: 2.5, rings: [], label: null };
    const load = (o, pos, col) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, o.p); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, o.c); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
      o.n = pos.length / 3;
    };
    const bindDraw = (o, mode) => {
      if (!o.n) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, o.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, o.c); gl.enableVertexAttribArray(aC); gl.vertexAttribPointer(aC, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.drawArrays(mode, 0, o.n);
    };
    function matrix() {
      const w = canvas.width, h = canvas.height;
      return multiply(perspective(45, w / h, 1, 5000), lookAt(eyeOf(S.cam), [S.cam.target[0], S.cam.target[1], S.cam.target[2] * S.ex], [0, 0, 1]));
    }
    function draw() {
      const dpr = root.devicePixelRatio || 1, w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; if (labels) { labels.width = w; labels.height = h; } }
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.03, 0.05, 0.08, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      const m = matrix();
      gl.uniformMatrix4fv(uM, false, m); gl.uniform1f(uEx, S.ex);
      gl.uniform1f(uPs, 1); bindDraw(lines, gl.LINES);
      gl.uniform1f(uPs, S.size * dpr); bindDraw(pts, gl.POINTS);
      if (labels) {
        const g = labels.getContext('2d');
        g.clearRect(0, 0, w, h);
        g.font = `${Math.round(11 * dpr)}px ui-monospace, monospace`; g.fillStyle = '#c8d0da'; g.textAlign = 'center';
        for (const L of S.rings) {
          const c = apply(m, [L.x, L.y, L.z * S.ex]);
          if (c[3] <= 0) continue;
          const sx = (c[0] / c[3] * 0.5 + 0.5) * w, sy = (1 - (c[1] / c[3] * 0.5 + 0.5)) * h;
          if (sx > 0 && sy > 0 && sx < w && sy < h) g.fillText(L.text, sx, sy);
        }
      }
    }
    let raf = 0;
    const soon = () => { if (!raf) raf = root.requestAnimationFrame(() => { raf = 0; draw(); }); };
    /* drag to orbit, wheel or pinch to zoom, arrows and +/- from the keyboard */
    const ptr = new Map();
    let pinch = 0;
    const onDown = (e) => { ptr.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
    const onMove = (e) => {
      if (!ptr.has(e.pointerId)) return;
      const [x0, y0] = ptr.get(e.pointerId);
      ptr.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptr.size === 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) S.cam.dist = Math.max(30, Math.min(1500, S.cam.dist * pinch / d)); pinch = d; }
      else { S.cam.yaw = (S.cam.yaw + (e.clientX - x0) * 0.4) % 360; S.cam.pitch = Math.max(3, Math.min(89, S.cam.pitch + (e.clientY - y0) * 0.3)); }
      soon();
    };
    const onUp = (e) => { ptr.delete(e.pointerId); if (ptr.size < 2) pinch = 0; };
    const onWheel = (e) => { e.preventDefault(); S.cam.dist = Math.max(30, Math.min(1500, S.cam.dist * Math.exp(e.deltaY * 0.001))); soon(); };
    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') S.cam.yaw -= 5; else if (k === 'ArrowRight') S.cam.yaw += 5;
      else if (k === 'ArrowUp') S.cam.pitch = Math.min(89, S.cam.pitch + 3); else if (k === 'ArrowDown') S.cam.pitch = Math.max(3, S.cam.pitch - 3);
      else if (k === '+' || k === '=') S.cam.dist = Math.max(30, S.cam.dist / 1.15); else if (k === '-') S.cam.dist = Math.min(1500, S.cam.dist * 1.15);
      else return;
      e.preventDefault(); soon();
    };
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('keydown', onKey);
    canvas.style.touchAction = 'none';
    return {
      /* the points: positions in km (x east, y north, z up) and RGBA bytes */
      points(pos, col) { load(pts, pos, col); soon(); },
      /* range rings every `every` km to `maxKm`, a north line, and their labels */
      ground(maxKm, every = 50) {
        const P = [], C = [], ring = [60, 72, 90, 255], north = [255, 212, 59, 255];
        S.rings = [];
        for (let r = every; r <= maxKm + 1e-9; r += every) {
          for (let k = 0; k < 128; k++) { const a = k / 128 * 2 * Math.PI, b = (k + 1) / 128 * 2 * Math.PI; P.push(r * Math.sin(a), r * Math.cos(a), 0, r * Math.sin(b), r * Math.cos(b), 0); C.push(...ring, ...ring); }
          S.rings.push({ x: r * Math.sin(Math.PI / 4), y: -r * Math.cos(Math.PI / 4), z: 0, text: r + ' km' });
        }
        P.push(0, 0, 0, 0, maxKm, 0); C.push(...north, ...north);
        S.rings.push({ x: 0, y: maxKm + 12, z: 0, text: 'N' });
        load(lines, new Float32Array(P), new Uint8Array(C)); soon();
      },
      set exaggeration(k) { S.ex = k; soon(); }, get exaggeration() { return S.ex; },
      set pointSize(k) { S.size = k; soon(); },
      reset() { S.cam = { yaw: 20, pitch: 35, dist: 420, target: [0, 0, 4] }; soon(); },
      get camera() { return S.cam; },
      draw,
      dispose() {
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('keydown', onKey);
        for (const o of [pts, lines]) { gl.deleteBuffer(o.p); gl.deleteBuffer(o.c); }
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    };
  }

  const api = { perspective, lookAt, multiply, apply, eyeOf, view };
  root.Radar3D = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
