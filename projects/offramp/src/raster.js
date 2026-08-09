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
               the pixels at each end of a span are blended by how much
               of them the shape covers, and with `vcov` the top and
               bottom rows are too. SMOOTH EDGES.
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

  /* ── the coverage mask ──────────────────────────────────────────────
     A second, single-channel buffer holding how much of each pixel the
     shape being painted covers. See maskPoly below for why the markings
     need one. `rowLo`/`rowHi` are the touched span of each row and
     `covY0`/`covY1` the touched rows, so flushing costs the marking's
     own pixels rather than a sweep of all eighty thousand. */
  let cov = null, rowLo = null, rowHi = null, covY0 = 0, covY1 = -1;

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
    cov = new Float32Array(w * h);
    rowLo = new Int32Array(h); rowHi = new Int32Array(h);
    rowLo.fill(w); rowHi.fill(-1);
    covY0 = h; covY1 = -1;
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

  /* ── one scanline of a shape ────────────────────────────────────────
     The span [xa,xb) laid into row `row`. Every pixel it touches is
     blended by how much of that pixel the span actually covers, and the
     whole lot is scaled by `vc` — how much of the ROW the shape covers,
     which is 1 for an interior row and a fraction at the top and bottom
     of a shape drawn with vertical coverage. The interior is still a
     memset whenever vc is 1, which is every row of every road surface.

     ── why this replaced a rounding version ────────────────────────────
     The old code rounded the span to whole pixels — fill [ceil(xa),
     floor(xb)), blend the pixel either side — with a separate branch for
     "the span lies inside a single pixel" that dumped the entire
     coverage into floor(xa). That branch is not a rare corner: a span
     narrower than two pixels straddles no pixel centre for most
     sub-pixel positions, so it was the branch a lane marking took 89% of
     the time. The line came out as ONE fully solid pixel, up to 0.94 px
     from where it really was, and it therefore SNAPPED from pixel to
     pixel as the road scrolled instead of sliding across them. Measured
     against sub-pixel position, nothing under 2 px wide anti-aliased at
     all; at exactly 2 px the artefact vanished. Markings are 1.1 px.

     Coverage here is exact at every width, so the branch is gone. */
  function span(row, xa, xb, c, vc) {
    const p0 = Math.floor(xa), p1 = Math.ceil(xb) - 1;
    if (p1 <= p0) {                           // the whole span is in one pixel
      if (p0 >= 0 && p0 < W) blend(row + p0, c, (xb - xa) * vc);
      return;
    }
    if (p0 >= 0 && p0 < W) blend(row + p0, c, (p0 + 1 - xa) * vc);
    const a = p0 + 1 < 0 ? 0 : p0 + 1, b = p1 > W ? W : p1;
    if (vc >= 1) {                            // the common case, and a memset
      if (b > a) u32.fill(c, row + a, row + b);
    } else {
      for (let x = a; x < b; x++) blend(row + x, c, vc);
    }
    if (p1 >= 0 && p1 < W) blend(row + p1, c, (xb - p1) * vc);
  }

  /* ── convex polygon, scanline ───────────────────────────────────────
     Points are a flat [x0,y0,x1,y1,…] array — flat because this is the
     hottest function in the game and allocating a nested array per quad
     per station per frame is how you get a garbage-collection stutter
     every two seconds.

     The span is taken between the leftmost and rightmost crossing on a
     scanline. That is only correct for convex shapes, which is all we
     ever hand it: road surfaces are quads, gore chevrons are triangles.

     Rows are claimed by CENTRE SAMPLING — a row belongs to the shape
     only if the shape reaches the row's middle — and that is deliberate,
     because it means shapes laid end to end tile exactly, sharing no row
     and skipping none. A hundred stations of tarmac go down with
     invisible joints and no grass showing between them. The cost is that
     a shape's top and bottom edge land on whole rows, which is nothing
     on a road surface and everything on a marking; markings therefore do
     not come through here at all. See maskPoly.

     Sprites do not either. The car is drawn by sprite(),
     nearest-neighbour and hard-edged, so it stays a box on a smooth
     road — which is the look this is for. */
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
      const sy = y + 0.5, vc = 1;
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
      span(y * W, xa, xb, c, vc);
    }
  }

  /* ── painting a marking, as one shape ───────────────────────────────
     A lane marking is not one quad. A solid line is a row of short ones
     laid end to end so it follows the curve, and drawing those straight
     onto the buffer forces a choice with no good answer:

       centre-sampled rows  — the pieces tile exactly and the joints are
                              invisible, but the top and bottom of the
                              whole line land on whole rows, so a line
                              lying ACROSS the screen quantises in width
                              exactly the way a thin one used to
                              quantise in position.
       vertical coverage    — the width is right, but each piece takes
                              part of the row it shares with the next,
                              and two partial coverages of the same white
                              composite to less than white: a 15% dark
                              notch at every joint.

     Both are the same mistake — compositing a shape onto the buffer
     before the shape is finished. So markings accumulate COVERAGE here
     first, and the accumulation is a SUM: butted pieces contributing
     0.3 and 0.7 of a row add to exactly the 1.0 that an unbroken line
     would have, which is the thing blending twice could never produce.
     Then maskDraw lays the finished coverage down in one pass, so every
     pixel is touched once and the joints cannot show.

     This assumes pieces BUTT rather than overlap — overlap would
     double-count — which is how every marking generator in draw.js
     already walks. Coverage is clamped at the end regardless. */
  function maskPoly(p) {
    const n = p.length >> 1;
    if (n < 3) return;
    let ymin = p[1], ymax = p[1];
    for (let i = 1; i < n; i++) {
      const y = p[i * 2 + 1];
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    let y0 = Math.floor(ymin), y1 = Math.ceil(ymax) - 1;
    if (y0 < 0) y0 = 0;
    if (y1 > H - 1) y1 = H - 1;
    if (y1 < y0) return;
    if (y0 < covY0) covY0 = y0;
    if (y1 > covY1) covY1 = y1;

    for (let y = y0; y <= y1; y++) {
      const t0 = ymin > y ? ymin : y;
      const t1 = ymax < y + 1 ? ymax : y + 1;
      let vc = t1 - t0;
      if (vc <= 0) continue;
      if (vc > 1) vc = 1;
      const sy = (t0 + t1) * 0.5;
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
      if (xa < 0) xa = 0;
      if (xb > W) xb = W;
      if (xa >= xb) continue;

      const row = y * W;
      let p0 = Math.floor(xa), p1 = Math.ceil(xb) - 1;
      if (p0 < 0) p0 = 0;
      if (p1 > W - 1) p1 = W - 1;
      if (p1 <= p0) {
        cov[row + p0] += (xb - xa) * vc;
      } else {
        cov[row + p0] += (p0 + 1 - xa) * vc;
        for (let x = p0 + 1; x < p1; x++) cov[row + x] += vc;
        cov[row + p1] += (xb - p1) * vc;
      }
      if (p0 < rowLo[y]) rowLo[y] = p0;
      if (p1 > rowHi[y]) rowHi[y] = p1;
    }
  }

  /* Lay the accumulated coverage down in `c` and wipe it, touching only
     the pixels the marking actually reached. */
  function maskDraw(c) {
    for (let y = covY0; y <= covY1; y++) {
      const lo = rowLo[y], hi = rowHi[y];
      if (hi < lo) continue;
      const row = y * W;
      for (let x = lo; x <= hi; x++) {
        const i = row + x, a = cov[i];
        if (a > 0) { blend(i, c, a); cov[i] = 0; }
      }
      rowLo[y] = W; rowHi[y] = -1;
    }
    covY0 = H; covY1 = -1;
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
    maskPoly, maskDraw,
    get width() { return W; },
    get height() { return H; },
  };
})();
