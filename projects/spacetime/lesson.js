/* The Geometry of Spacetime — the lessons' shared toolkit.
   Every figure on the four lesson pages is a canvas drawn in CSS pixels
   (the backing store is scaled by devicePixelRatio here, once), so a page's
   own code never thinks about screen density: the old exhibits each did that
   by hand and got it wrong twice (bug sweep D3-12). Animation runs only for
   figures that are on screen, and nothing animates by itself under
   prefers-reduced-motion — a visitor can still press play. */
(function () {
  'use strict';
  const root = getComputedStyle(document.documentElement);
  const v = (n) => root.getPropertyValue(n).trim();
  const C = {
    bg: v('--bg'), bg2: v('--bg-2'), ink: v('--ink'), dim: v('--ink-dim'), accent: v('--accent'),
    light: v('--light'), reach: v('--reach'), else: v('--else'), other: v('--other'),
    line: v('--line'), grid: v('--grid'),
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const $ = (id) => document.getElementById(id);

  /* ── figures ── */
  const figs = [];
  function figure(canvas, draw, opt) {
    if (typeof canvas === 'string') canvas = $(canvas);
    const o = Object.assign({ ratio: 0.56, min: 240, max: 620 }, opt);
    const ctx = canvas.getContext('2d');
    const f = { canvas, ctx, w: 0, h: 0, visible: false, playing: false, step: null, draw };
    f.redraw = () => { if (f.w) { ctx.clearRect(0, 0, f.w, f.h); draw(ctx, f.w, f.h, f); } };
    let lastW = -1;
    function size() {
      const w = canvas.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      const r = typeof o.ratio === 'function' ? o.ratio(w) : o.ratio;
      const h = Math.round(clamp(w * r, o.min, o.max));
      canvas.style.height = h + 'px';
      const d = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      f.w = w; f.h = h;
      f.redraw();
    }
    new ResizeObserver(size).observe(canvas);
    new IntersectionObserver((es) => { f.visible = es[0].isIntersecting; if (f.visible) kick(); }, { rootMargin: '80px' }).observe(canvas);
    /* First drawn after the page's own setup has run, so a draw function may
       read sliders that are declared after the figure. */
    queueMicrotask(size);
    figs.push(f);
    return f;
  }

  /* One animation loop for every figure. `step(dt)` advances a figure's own
     clock in seconds; it is skipped while the figure is off screen, so a long
     page does not run nine simulations nobody is looking at. */
  let raf = 0, last = 0;
  function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let any = false;
    for (const f of figs) {
      if (!f.playing || !f.step) continue;
      any = true;
      if (!f.visible) continue;
      if (f.step(dt) === false) f.stop(); else f.redraw();
    }
    raf = any ? requestAnimationFrame(tick) : 0;
  }
  /* Make a figure animate. A button (optional) toggles it; `auto` starts it
     when reduced motion is off. */
  function animate(f, step, btn, auto) {
    f.step = step;
    const label = btn && btn.textContent;
    f.play = () => { f.playing = true; if (btn) { btn.textContent = '❚❚ Pause'; btn.setAttribute('aria-pressed', 'true'); } kick(); };
    f.stop = () => { f.playing = false; if (btn) { btn.textContent = label; btn.setAttribute('aria-pressed', 'false'); } f.redraw(); };
    if (btn) btn.addEventListener('click', () => (f.playing ? f.stop() : f.play()));
    if (auto && !reduced) f.play();
    return f;
  }

  /* Pointer on a canvas, in CSS pixels. `drag` makes the canvas grab touches
     (so a finger can drag on a phone) — only figures you drag get that. */
  function pointer(f, h) {
    const c = f.canvas; c.classList.add('drag');
    let down = false;
    const at = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', (e) => { down = true; c.setPointerCapture(e.pointerId); h.down && h.down(...at(e)); f.redraw(); });
    c.addEventListener('pointermove', (e) => { if (down && h.drag) { h.drag(...at(e)); f.redraw(); } else if (!down && h.hover) { h.hover(...at(e)); f.redraw(); } });
    const up = (e) => { if (!down) return; down = false; h.up && h.up(...at(e)); f.redraw(); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!down && h.leave) { h.leave(); f.redraw(); } });
  }

  /* A range input with an <output> beside it: `fmt` writes the output, `on`
     hears the value. Returns a getter. */
  function slider(id, fmt, on) {
    const el = $(id), out = document.querySelector('output[for="' + id + '"]');
    const read = () => parseFloat(el.value);
    const upd = () => { if (out) out.textContent = fmt ? fmt(read()) : el.value; on && on(read()); };
    el.addEventListener('input', upd);
    /* The output is written now; the page hears the first value once its own
       setup has finished, so a handler may use names declared after it. */
    if (out) out.textContent = fmt ? fmt(read()) : el.value;
    if (on) queueMicrotask(() => on(read()));
    const g = () => read();
    g.set = (x) => { el.value = x; upd(); };
    g.el = el;
    return g;
  }
  /* A group of buttons where one is chosen: data-v on each. */
  function choice(container, on) {
    const box = typeof container === 'string' ? $(container) : container;
    const bs = [...box.querySelectorAll('button[data-v]')];
    let cur = (bs.find((b) => b.getAttribute('aria-pressed') === 'true') || bs[0]).dataset.v;
    const mark = (val) => bs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === val)));
    const set = (val) => { cur = val; mark(val); on && on(val); };
    bs.forEach((b) => b.addEventListener('click', () => set(b.dataset.v)));
    mark(cur);
    if (on) queueMicrotask(() => on(cur));
    const g = () => cur; g.set = set; return g;
  }

  /* ── drawing ── */
  const font = (px, kind) => (kind === 'serif' ? px + 'px "Cormorant Garamond", Georgia, serif' : px + 'px "JetBrains Mono", Consolas, monospace');
  function text(ctx, s, x, y, o) {
    o = o || {};
    ctx.font = font(o.size || 12, o.serif ? 'serif' : 'mono');
    ctx.fillStyle = o.color || C.dim;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.base || 'alphabetic';
    if (o.bg) {
      const m = ctx.measureText(s), pw = m.width + 8, ph = (o.size || 12) + 6;
      const left = o.align === 'center' ? x - pw / 2 : o.align === 'right' ? x - pw + 4 : x - 4;
      const top = o.base === 'middle' ? y - ph / 2 : o.base === 'top' ? y - 3 : y - (o.size || 12) - 1;
      ctx.save(); ctx.fillStyle = o.bg; ctx.fillRect(left, top, pw, ph); ctx.restore();
      ctx.fillStyle = o.color || C.dim;
    }
    ctx.fillText(s, x, y);
  }
  function line(ctx, x1, y1, x2, y2, color, width, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width || 1; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
  }
  function dot(ctx, x, y, r, color, ring) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (ring) { ctx.strokeStyle = color; ctx.lineWidth = ring; ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
  }
  function arrow(ctx, x1, y1, x2, y2, color, width, head) {
    line(ctx, x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1), s = head || 7;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4));
    ctx.lineTo(x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)); ctx.closePath(); ctx.fill();
  }
  function poly(ctx, pts, fill, stroke, width) {
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); }
  }
  const alpha = (hex, a) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  /* A spacetime diagram: x across, t up, in the same units so light is 45°.
     `span` is how many units fit across the narrower side; `ox, oy` put the
     origin (fractions of the canvas). Returns the map both ways. */
  function mink(w, h, span, ox, oy) {
    const s = Math.min(w, h) / span;
    const X0 = w * (ox == null ? 0.5 : ox), Y0 = h * (oy == null ? 0.5 : oy);
    const m = {
      s, X0, Y0,
      X: (x) => X0 + x * s, Y: (t) => Y0 - t * s,
      x: (px) => (px - X0) / s, t: (py) => (Y0 - py) / s,
      P: (x, t) => [X0 + x * s, Y0 - t * s],
      xmin: -X0 / s, xmax: (w - X0) / s, tmin: (Y0 - h) / s, tmax: Y0 / s,
    };
    m.grid = (ctx, step, color) => {
      step = step || 1;
      ctx.lineWidth = 1; ctx.strokeStyle = color || C.grid; ctx.beginPath();
      for (let x = Math.ceil(m.xmin / step) * step; x <= m.xmax; x += step) { ctx.moveTo(m.X(x), 0); ctx.lineTo(m.X(x), h); }
      for (let t = Math.ceil(m.tmin / step) * step; t <= m.tmax; t += step) { ctx.moveTo(0, m.Y(t)); ctx.lineTo(w, m.Y(t)); }
      ctx.stroke();
    };
    m.axes = (ctx, xl, tl) => {
      line(ctx, 0, Y0, w, Y0, C.dim, 1); line(ctx, X0, 0, X0, h, C.dim, 1);
      text(ctx, tl || 'time ↑', X0 + 6, 16, { size: 11 });
      text(ctx, xl || 'space →', w - 6, Y0 - 6, { size: 11, align: 'right' });
    };
    /* A line through (x,t) at slope dt/dx, clipped generously. */
    m.ray = (ctx, x, t, dx, dt, color, width, dash, both) => {
      const k = 4 * Math.max(m.xmax - m.xmin, m.tmax - m.tmin) / Math.hypot(dx, dt);
      const [a, b] = m.P(x + dx * k, t + dt * k);
      const [c, d] = both ? m.P(x - dx * k, t - dt * k) : m.P(x, t);
      line(ctx, c, d, a, b, color, width, dash);
    };
    m.cone = (ctx, x, t, alphaF, alphaP) => {
      const k = 2 * Math.max(m.xmax - m.xmin, m.tmax - m.tmin);
      poly(ctx, [m.P(x, t), m.P(x - k, t + k), m.P(x + k, t + k)], alpha(C.light, alphaF == null ? 0.08 : alphaF));
      poly(ctx, [m.P(x, t), m.P(x - k, t - k), m.P(x + k, t - k)], alpha(C.reach, alphaP == null ? 0.08 : alphaP));
      m.ray(ctx, x, t, 1, 1, C.light, 1.5, null, true); m.ray(ctx, x, t, -1, 1, C.light, 1.5, null, true);
    };
    return m;
  }

  /* ── numbers ── */
  const gamma = (b) => 1 / Math.sqrt(1 - b * b);
  /* 1 − √(1−β²), accurate for tiny β (a car, a jet) where the plain form is
     all rounding error. */
  const lag = (b) => (b < 1e-3 ? b * b / 2 + b ** 4 / 8 : 1 - Math.sqrt(1 - b * b));
  function fmt(x, d) {
    if (!isFinite(x)) return '∞';
    const a = Math.abs(x);
    if (a !== 0 && (a < 1e-3 || a >= 1e7)) {
      const e = Math.floor(Math.log10(a)), m = x / 10 ** e;
      return m.toFixed(d == null ? 2 : d).replace(/\.?0+$/, '') + '×10' + sup(e);
    }
    return x.toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d });
  }
  const sup = (n) => String(n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] || (c === '-' ? '⁻' : c)).join('');
  /* Seconds as the friendliest unit. */
  function dur(s) {
    const a = Math.abs(s);
    /* three significant figures in whichever unit reads best */
    const n = (x) => fmt(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
    if (a === 0) return '0 s';
    if (a < 1e-6) return n(s * 1e9) + ' ns';
    if (a < 1e-3) return n(s * 1e6) + ' µs';
    if (a < 1) return n(s * 1e3) + ' ms';
    if (a < 120) return n(s) + ' s';
    if (a < 7200) return n(s / 60) + ' min';
    if (a < 172800) return n(s / 3600) + ' hours';
    if (a < 3.15576e7 * 2) return n(s / 86400) + ' days';
    return n(s / 3.15576e7) + ' years';
  }

  /* ── page furniture ── */
  /* The contents rail, from each section's own heading, with the part you are
     reading marked as you scroll. */
  function toc() {
    const nav = document.querySelector('.toc ol');
    if (!nav) return;
    const parts = [...document.querySelectorAll('section.part[id]')];
    const links = parts.map((s) => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + s.id; a.textContent = s.dataset.short || s.querySelector('h2').textContent;
      li.appendChild(a); nav.appendChild(li); return a;
    });
    let queued = false, was = -1;
    const spy = () => {
      queued = false;
      let on = 0;
      parts.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.35) on = i; });
      if (on === was) return;
      was = on;
      links.forEach((a, i) => { a.classList.toggle('on', i === on); if (i === on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();
  }
  /* "Check yourself": each .q has data-answer; its buttons carry data-k. */
  function quiz() {
    document.querySelectorAll('.check .q').forEach((q) => {
      const why = q.querySelector('.why');
      q.querySelectorAll('.opts button').forEach((b) => b.addEventListener('click', () => {
        const right = b.dataset.k === q.dataset.answer;
        q.querySelectorAll('.opts button').forEach((x) => x.classList.remove('right', 'wrong'));
        b.classList.add(right ? 'right' : 'wrong');
        if (right) q.querySelector('.opts button[data-k="' + q.dataset.answer + '"]').classList.add('right');
        if (why) { why.hidden = false; why.firstElementChild && (why.firstElementChild.textContent = right ? 'Right. ' : 'Not quite. '); }
      }));
    });
  }
  document.addEventListener('DOMContentLoaded', () => { toc(); quiz(); });

  window.ST = { C, reduced, clamp, $, figure, animate, pointer, slider, choice, text, line, dot, arrow, poly, alpha, mink, gamma, lag, fmt, dur, sup };
})();
