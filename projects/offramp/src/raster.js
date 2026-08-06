/* ══════════════════════════════════════════════════════════════════════
   The rasteriser.

   This file exists because the world turns.

   In the first version of OFFRAMP the road ran straight up the screen
   forever, so every single thing on it — asphalt, lane markings, kerbs,
   cars — was an axis-aligned rectangle, and `ctx.fillRect` with rounded
   coordinates gave a perfect pixel grid for free. That is no longer
   true. The car now holds still and points up the screen while the road
   sweeps, curves and rolls underneath it, which means almost nothing is
   axis-aligned any more.

   The obvious fix is `ctx.rotate` and `ctx.fill`. It is also the wrong
   one — canvas decides its own antialiasing, on everything, including
   the car. So we do it ourselves: one ImageData for the buffer, a
   Uint32Array view over it, and every pixel written deliberately.

     poly()    convex polygon, scanline filled. Interior is a memset;
               the two pixels at each end of a span are blended by how
               much of them the shape covers. SMOOTH EDGES.
     sprite()  a bitmap at an arbitrary angle, nearest-neighbour, so a
               rotated car is still made of squares. HARD EDGES.
     shade()   translucency, for shadows

   ── two kinds of edge, on purpose ───────────────────────────────────
   This file used to round every edge to a whole pixel and say so
   proudly: no half-covered pixels, no grey fringe, no AA. That was
   written when the buffer was blown up ×4 and a blended pixel became a
   four-pixel bruise. The buffer is now displayed at about 1.38×, where
   a blended pixel is just a blended pixel — and the cost of the old
   rule had become the thing you actually see: a 499-metre curve drawn
   as a staircase, the edge holding one x for six rows and then
   stepping.

   So the ROAD is smooth and the CAR is not. Anything through poly() —
   asphalt, verge, barrier, lane markings — gets coverage on its edges
   and bends properly. Anything through sprite() stays square. The look
   is the same look; the curves are curves.

   ── on speed ────────────────────────────────────────────────────────
   A frame is roughly a thousand small convex polygons and thirty
   sprites, which sounds alarming and is not: the spans go in with
   `Uint32Array.fill`, which is memset, and the sprites touch a few
   hundred pixels each. The whole buffer is 80,640 pixels — smaller
   than a single icon on the page that contains it.

   Colours are packed once, at load, into the 0xAABBGGRR that a
   little-endian Uint32Array view wants. Do not pack them in the loop.
   ══════════════════════════════════════════════════════════════════════ */

const Raster = (() => {
  "use strict";

  let W = 0, H = 0;
  let ctx = null, img = null, u32 = null, u8 = null;

  /* ── colour ─────────────────────────────────────────────────────────
     Everything downstream talks in packed uint32. `hex()` is the only
     place a "#rrggbb" string is ever parsed, and it is called at module
     load, never per frame. */
  function rgb(r, g, b) {
    return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  function hex(s) {
    const n = parseInt(s.slice(1), 16);
    return rgb((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }
  /* mix two packed colours, t=0 gives a, t=1 gives b */
  function mix(a, b, t) {
    const ar = a & 255, ag = (a >> 8) & 255, ab = (a >> 16) & 255;
    const br = b & 255, bg = (b >> 8) & 255, bb = (b >> 16) & 255;
    return rgb(
      (ar + (br - ar) * t) | 0,
      (ag + (bg - ag) * t) | 0,
      (ab + (bb - ab) * t) | 0
    );
  }

  function attach(context, w, h) {
    ctx = context; W = w; H = h;
    img = ctx.createImageData(w, h);
    u8 = img.data;
    u32 = new Uint32Array(u8.buffer);
  }

  const clear = (c) => u32.fill(c);
  const flush = () => ctx.putImageData(img, 0, 0);

  function px(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    u32[y * W + x] = c;
  }

  /* axis-aligned box, still the cheapest thing we can draw and still
     right for anything that lives in screen space rather than the world */
  function box(x, y, w, h, c) {
    let x0 = Math.round(x), y0 = Math.round(y);
    let x1 = x0 + Math.max(1, Math.round(w)), y1 = y0 + Math.max(1, Math.round(h));
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    if (x1 > W) x1 = W; if (y1 > H) y1 = H;
    for (let y = y0; y < y1; y++) u32.fill(c, y * W + x0, y * W + x1);
  }

  /* ── convex polygon, scanline ───────────────────────────────────────
     Points are a flat [x0,y0,x1,y1,…] array — flat because this is the
     hottest function in the game and allocating a nested array per quad
     per station per frame is how you get a garbage-collection stutter
     every two seconds.

     Sampling is at pixel centres (y+0.5), and the span is taken between
     the leftmost and rightmost crossing on that scanline. That is only
     correct for convex shapes, which is all we ever hand it: road
     surfaces are quads, gore chevrons are triangles. */
  function poly(p, c) {
    const n = p.length >> 1;
    if (n < 3) return;
    let ymin = p[1], ymax = p[1];
    for (let i = 1; i < n; i++) {
      const y = p[i * 2 + 1];
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    let y0 = Math.ceil(ymin - 0.5), y1 = Math.floor(ymax - 0.5);
    if (y0 < 0) y0 = 0;
    if (y1 > H - 1) y1 = H - 1;
    if (y1 < y0) return;

    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      let xa = 1e9, xb = -1e9;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const py = p[i * 2 + 1], qy = p[j * 2 + 1];
        if ((py <= sy && qy > sy) || (qy <= sy && py > sy)) {
          const t = (sy - py) / (qy - py);
          const x = p[i * 2] + (p[j * 2] - p[i * 2]) * t;
          if (x < xa) xa = x;
          if (x > xb) xb = x;
        }
      }
      if (xa >= xb) continue;
      const row = y * W;

      /* ── the ends of the span are where the curve lives ─────────────
         A road runs up the screen, so its edges are the LEFT and RIGHT
         ends of every scanline. Rounding those to whole pixels is what
         turns a 499-metre curve into a staircase: the edge holds one x
         for six rows, then steps, then holds again.

         So the interior is still a memset — it is most of the pixels and
         it is exact — and only the two boundary pixels are blended, by
         how much of them the span actually covers. That is enough to
         make a curve read as a curve, because the eye reads the edge and
         nothing else.

         Sprites do NOT come through here. The car is drawn by sprite(),
         which stays nearest-neighbour and hard-edged, so it remains a
         box on a smooth road — which is the look this is for. */
      const ix0 = Math.ceil(xa), ix1 = Math.floor(xb);

      if (ix1 <= ix0) {                       // span inside a single pixel
        const px = Math.floor(xa);
        if (px >= 0 && px < W) blend(row + px, c, xb - xa);
        continue;
      }
      if (ix1 > ix0) {
        const a = Math.max(0, ix0), b = Math.min(W, ix1);
        if (b > a) u32.fill(c, row + a, row + b);
      }
      const lp = ix0 - 1;                     // partial pixel on the left
      if (lp >= 0 && lp < W) blend(row + lp, c, ix0 - xa);
      const rp = ix1;                         // partial pixel on the right
      if (rp >= 0 && rp < W) blend(row + rp, c, xb - ix1);
    }
  }

  /* one pixel, `a` of the way from what is there to `c` */
  function blend(i, c, a) {
    if (a <= 0) return;
    if (a >= 1) { u32[i] = c; return; }
    const d = u32[i];
    u32[i] = rgb(
      ((d & 255) + (((c & 255) - (d & 255)) * a)) | 0,
      (((d >> 8) & 255) + ((((c >> 8) & 255) - ((d >> 8) & 255)) * a)) | 0,
      (((d >> 16) & 255) + ((((c >> 16) & 255) - ((d >> 16) & 255)) * a)) | 0
    );
  }

  const quad = (x0, y0, x1, y1, x2, y2, x3, y3, c) =>
    poly([x0, y0, x1, y1, x2, y2, x3, y3], c);

  /* ── stroke(), removed ──────────────────────────────────────────────
     Walked a line laying down exactly `w` whole pixels perpendicular to
     it, so a diagonal came out as a clean staircase and a marking never
     changed width with angle. That was the right trade when poly() had
     no coverage: the alternative was a 1.1-px line flickering between
     one and two pixels as it scrolled.

     poly() blends its span ends now, so markings are quads again and
     bend with the road — see `seg` in draw.js. Nothing calls this. */

  /* ── translucent polygon ────────────────────────────────────────────
     Shadows, and the wash under a bridge. Same scanline, but each pixel
     is read, mixed and written back, so it costs perhaps eight times a
     flat fill. Used sparingly and deliberately. */
  function shade(p, c, a) {
    const n = p.length >> 1;
    if (n < 3) return;
    const cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
    let ymin = p[1], ymax = p[1];
    for (let i = 1; i < n; i++) {
      const y = p[i * 2 + 1];
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    let y0 = Math.max(0, Math.ceil(ymin - 0.5));
    let y1 = Math.min(H - 1, Math.floor(ymax - 0.5));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      let xa = 1e9, xb = -1e9;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const py = p[i * 2 + 1], qy = p[j * 2 + 1];
        if ((py <= sy && qy > sy) || (qy <= sy && py > sy)) {
          const t = (sy - py) / (qy - py);
          const x = p[i * 2] + (p[j * 2] - p[i * 2]) * t;
          if (x < xa) xa = x;
          if (x > xb) xb = x;
        }
      }
      if (xa > xb) continue;
      let x0 = Math.max(0, Math.ceil(xa - 0.5));
      let x1 = Math.min(W - 1, Math.floor(xb - 0.5));
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const i = row + x, d = u32[i];
        u32[i] = rgb(
          ((d & 255) + (cr - (d & 255)) * a) | 0,
          (((d >> 8) & 255) + (cg - ((d >> 8) & 255)) * a) | 0,
          (((d >> 16) & 255) + (cb - ((d >> 16) & 255)) * a) | 0
        );
      }
    }
  }

  /* ── sprites ────────────────────────────────────────────────────────
     A sprite is { w, h, d } where d is a Uint32Array of packed colours
     and 0 means transparent. Cars are built once at start-up as flat
     bitmaps facing "up", then drawn at whatever angle the world has
     rotated them to.

     We walk the *destination* pixels and inverse-rotate each one back
     into sprite space, rather than walking source pixels and scattering
     them forward — forward mapping leaves holes wherever the rotation
     stretches. Nearest sampling, so the sprite stays made of squares
     instead of turning to soup. */
  function sprite(bmp, cx, cy, ang) {
    const w = bmp.w, h = bmp.h, d = bmp.d;
    const hw = w / 2, hh = h / 2;
    const co = Math.cos(ang), si = Math.sin(ang);
    // tight bounding box: the four rotated corners
    const ax = Math.abs(hw * co) + Math.abs(hh * si);
    const ay = Math.abs(hw * si) + Math.abs(hh * co);
    let x0 = Math.floor(cx - ax), x1 = Math.ceil(cx + ax);
    let y0 = Math.floor(cy - ay), y1 = Math.ceil(cy + ay);
    if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
    if (x1 > W - 1) x1 = W - 1; if (y1 > H - 1) y1 = H - 1;

    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, row = y * W;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const u = dx * co + dy * si;
        const v = -dx * si + dy * co;
        const sx = (u + hw) | 0, sy = (v + hh) | 0;
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        if (u + hw < 0 || v + hh < 0) continue;   // |0 truncates toward zero
        const c = d[sy * w + sx];
        if (c === 0) continue;
        u32[row + x] = c;
      }
    }
  }

  /* the same walk, but every opaque source pixel writes one flat colour.
     Cheaper and simpler than a second bitmap for every car shadow. */
  function silhouette(bmp, cx, cy, ang, c, a) {
    const w = bmp.w, h = bmp.h, d = bmp.d;
    const hw = w / 2, hh = h / 2;
    const co = Math.cos(ang), si = Math.sin(ang);
    const ax = Math.abs(hw * co) + Math.abs(hh * si);
    const ay = Math.abs(hw * si) + Math.abs(hh * co);
    let x0 = Math.max(0, Math.floor(cx - ax)), x1 = Math.min(W - 1, Math.ceil(cx + ax));
    let y0 = Math.max(0, Math.floor(cy - ay)), y1 = Math.min(H - 1, Math.ceil(cy + ay));
    const cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, row = y * W;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const u = dx * co + dy * si + hw;
        const v = -dx * si + dy * co + hh;
        if (u < 0 || v < 0) continue;
        const sx = u | 0, sy = v | 0;
        if (sx >= w || sy >= h) continue;
        if (d[sy * w + sx] === 0) continue;
        const i = row + x, s = u32[i];
        u32[i] = rgb(
          ((s & 255) + (cr - (s & 255)) * a) | 0,
          (((s >> 8) & 255) + (cg - ((s >> 8) & 255)) * a) | 0,
          (((s >> 16) & 255) + (cb - ((s >> 16) & 255)) * a) | 0
        );
      }
    }
  }

  /* ── additive glow ──────────────────────────────────────────────────
     Headlight throw, street lamps, the amber of a signal at night. A
     radial add with a quadratic falloff, clamped. Kept out of the
     canvas compositor for the same reason as everything else: it would
     bring its own antialiasing to the party. */
  function glow(cx, cy, r, cr, cg, cb, str) {
    let x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    let y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, row = y * W;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const f = (1 - d2 / r2);
        const k = f * f * str;
        const i = row + x, s = u32[i];
        let sr = (s & 255) + cr * k;
        let sg = ((s >> 8) & 255) + cg * k;
        let sb = ((s >> 16) & 255) + cb * k;
        u32[i] = rgb(sr > 255 ? 255 : sr | 0, sg > 255 ? 255 : sg | 0, sb > 255 ? 255 : sb | 0);
      }
    }
  }

  /* a whole-buffer wash — night, dusk, the white of an impact */
  function tint(cr, cg, cb, a) {
    if (a <= 0.002) return;
    const n = W * H;
    for (let i = 0; i < n; i++) {
      const s = u32[i];
      u32[i] = rgb(
        ((s & 255) + (cr - (s & 255)) * a) | 0,
        (((s >> 8) & 255) + (cg - ((s >> 8) & 255)) * a) | 0,
        (((s >> 16) & 255) + (cb - ((s >> 16) & 255)) * a) | 0
      );
    }
  }

  /* ── building sprites ───────────────────────────────────────────────
     A tiny painter so the vehicle art below reads as art and not as
     array indices. Origin is top-left, +y is toward the back of the
     vehicle; every sprite is drawn facing up the screen. */
  function bitmap(w, h) {
    return {
      w, h, d: new Uint32Array(w * h),
      set(x, y, c) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
        this.d[y * this.w + x] = c;
        return this;
      },
      fill(x, y, bw, bh, c) {
        const x1 = Math.min(this.w, x + bw), y1 = Math.min(this.h, y + bh);
        for (let yy = Math.max(0, y); yy < y1; yy++)
          for (let xx = Math.max(0, x); xx < x1; xx++) this.d[yy * this.w + xx] = c;
        return this;
      },
    };
  }

  return {
    attach, clear, flush, bitmap,
    rgb, hex, mix,
    px, box, poly, quad, shade, sprite, silhouette, glow, tint,
    get width() { return W; },
    get height() { return H; },
  };
})();
