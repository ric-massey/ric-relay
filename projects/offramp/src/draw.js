/* ══════════════════════════════════════════════════════════════════════
   Drawing the world.

   One transform, applied once, at the top of this file and nowhere
   else. The car is nailed to a fixed spot on the screen pointing up,
   and everything else is expressed relative to that:

       d       = world point − car
       local   = d rotated by the car's heading
       screen  = (CX + local.x,  PY − local.y)

   The y flip lives on that last line. Below it, screen y grows
   downward like every other canvas; above it, world y grows the way
   north does. Mixing the two up is the single easiest way to break
   this file, so it happens once, here, and is never done again.

   ── how a road becomes pixels ───────────────────────────────────────
   For each station on a road we work out its position on screen and
   its right-hand normal on screen, and after that every band of the
   cross-section — gravel, hard shoulder, tarmac, barrier — is just a
   quad between two stations at two offsets. A hundred stations by a
   dozen bands is the whole road surface, and none of it needs to know
   that the road is curving, because the curve is already in where the
   stations are.

   Markings are done separately, walking along in dash-length steps
   rather than station steps, because a dashed line that snapped to a
   station grid would visibly stretch and squash as the road bent.

   ── the order of things ─────────────────────────────────────────────
     grass, and what grows on it
     every road, far ones first
     the gore of each ramp, painted over both roads that form it
     signs, signals, guardrails, lamps
     you
     particles, marks, then the light of whatever time it is

   Night is a wash over the finished frame plus additive glows, which
   is why it is last and why the lamps are drawn before it: a street
   light has to be a light *on* the scene, not a shape in it.
   ══════════════════════════════════════════════════════════════════════ */

const Draw = (() => {
  "use strict";

  const R = Road, X = Raster;

  /* A slightly larger buffer is still scaled into the same cabinet.
     Road dimensions stay in the same world pixels, so this is a true
     camera pullback rather than narrower lanes: about 16% more road is
     visible, with most of the gain placed ahead of the player. */
  const VW = 256, VH = 416;
  const CX = 128, PY = 320;              // where the car sits on screen
  const VIEW = 360;                      // nothing beyond this is drawn

  /* ── palette ────────────────────────────────────────────────────────
     Packed once. Small on purpose: the whole game is a dozen greys, a
     green, and the four colours road paint comes in. */
  const C = {};
  const pal = {
    grass: "#2c5a34", grassDk: "#245029", grassLt: "#357040",
    tree: "#16321d", treeDk: "#102416", bush: "#1d4526",
    gravel: "#6b5b45", gravelDk: "#5b4c39",
    asphalt: "#3a3a44", asphaltDk: "#33333d", patch: "#45454f", stain: "#2f2f38",
    shoulder: "#34343e",
    line: "#e8e2cc", lineDim: "#b8b2a0", yellow: "#f0b429",
    kerb: "#8a8a92", barrier: "#9aa0aa", barrierDk: "#4e535c",
    rail: "#8f949e", post: "#565b64",
    glass: "#1d2430", tail: "#ff5a3c", head: "#fff6c8", amber: "#ffb020",
    red: "#ff3b26", green: "#2fe07a",
    player: "#d94b3a", playerTrim: "#f2e6cf", playerDead: "#8e3128",
    cone: "#ff7a33", coneBand: "#f2e6cf",
    signGreen: "#1c5c34", signBlue: "#1d3f7a", signWhite: "#e8e2cc",
    smoke: "#7a7a86", fire: "#ffb020", shadow: "#0c0c10",
    dark: "#1a1a20",
  };
  for (const k in pal) C[k] = X.hex(pal[k]);

  /* ── camera ─────────────────────────────────────────────────────────
     Set once a frame. `sc` and `ss` are the cosine and sine of the
     car's heading; every projection below is two multiplies and an add. */
  let camX = 0, camY = 0, sc = 1, ss = 0, camH = 0;
  const nearScratch = new Map();
  function camera(x, y, h) {
    camX = x; camY = y; camH = h;
    sc = Math.cos(h); ss = Math.sin(h);
  }
  function sx(wx, wy) { return CX + ((wx - camX) * sc - (wy - camY) * ss); }
  function sy(wx, wy) { return PY - ((wx - camX) * ss + (wy - camY) * sc); }

  /* stable pseudo-random per world slot, so nothing twitches as it scrolls */
  function hash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = n + (n << 3);
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }
  const hash2 = (a, b) => hash(((a * 73856093) ^ (b * 19349663)) | 0);

  /* ── time of day ────────────────────────────────────────────────────
     Cycles on distance, not on the clock, because distance is the only
     thing in this game that only ever increases. */
  const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  let phase = 0;
  const setPhase = (p) => { phase = p % 1; };
  function night() {
    return Math.max(0, Math.min(1, smooth((phase - 0.30) / 0.14) - smooth((phase - 0.80) / 0.13)));
  }
  function warmth() {
    return Math.max(smooth((phase - 0.24) / 0.09) - smooth((phase - 0.36) / 0.08),
                    smooth((phase - 0.80) / 0.08) - smooth((phase - 0.93) / 0.08));
  }

  /* ── station scratch ────────────────────────────────────────────────
     Recomputed per road per frame. Screen position of the centreline
     and the screen-space right normal, which is all a quad needs. */
  const SX = new Float64Array(600), SY = new Float64Array(600);
  const NX = new Float64Array(600), NY = new Float64Array(600);
  const Q = new Float64Array(8);

  function band(a, b, uA, uB, col) {
    Q[0] = SX[a] + NX[a] * uA; Q[1] = SY[a] + NY[a] * uA;
    Q[2] = SX[a] + NX[a] * uB; Q[3] = SY[a] + NY[a] * uB;
    Q[4] = SX[b] + NX[b] * uB; Q[5] = SY[b] + NY[b] * uB;
    Q[6] = SX[b] + NX[b] * uA; Q[7] = SY[b] + NY[b] * uA;
    // cheap reject: entirely off one side of the screen
    if ((Q[0] < 0 && Q[2] < 0 && Q[4] < 0 && Q[6] < 0) ||
        (Q[0] > VW && Q[2] > VW && Q[4] > VW && Q[6] > VW) ||
        (Q[1] < 0 && Q[3] < 0 && Q[5] < 0 && Q[7] < 0) ||
        (Q[1] > VH && Q[3] > VH && Q[5] > VH && Q[7] > VH)) return;
    X.poly(Q, col);
  }

  /* ── markings ───────────────────────────────────────────────────────
     One quad between two points on the road, at a fixed offset across.

     `seg` is short by rule, and the rule matters: a quad is a straight
     line between its ends, so a marking drawn as one long quad is a
     CHORD, and on anything that curves it leaves the road entirely. An
     edge line drawn in a single piece down a ramp cuts the corner and
     lands in the grass, which is exactly the sort of bug that looks
     like a rendering glitch and is actually a geometry mistake. Solid
     lines are therefore chopped into short pieces and dashes are short
     enough to be pieces already. */
  const SEGQ = new Float64Array(8);
  function seg(r, a, b, u, w, col, u2) {
    const p = R.at(r, a, u), q = R.at(r, b, u2 == null ? u : u2);
    const x1 = sx(p.x, p.y), y1 = sy(p.x, p.y);
    const x2 = sx(q.x, q.y), y2 = sy(q.x, q.y);
    if ((x1 < 0 && x2 < 0) || (x1 > VW && x2 > VW) ||
        (y1 < 0 && y2 < 0) || (y1 > VH && y2 > VH)) return;
    /* A marking is a QUAD of constant perpendicular width, not a walked
       line of whole pixels.

       It used to be X.stroke, which stepped along laying down exactly
       `w` rounded pixels across, because a quad through the old poly()
       was thought to fatten on a diagonal — each scanline spanning
       w/cos θ instead of w. That reading was wrong: a one-pixel line at
       forty-five degrees really does cross 1.41 pixels of a row, and
       filling them is what makes it look one pixel wide. What actually
       went wrong was the ROUNDING — with no coverage, a 1.1-px line
       landed on one pixel or two depending where its edges fell, so it
       flickered as it scrolled, and the fix was to quantise the width
       and accept the staircase.

       poly() blends its span ends now, so the honest version works: lay
       the quad along the true normal and let coverage do the rest. The
       dashes bend with the road instead of stepping down it. */
    const dx = x2 - x1, dy = y2 - y1;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    const hx = (-dy / L) * w / 2, hy = (dx / L) * w / 2;
    SEGQ[0] = x1 - hx; SEGQ[1] = y1 - hy;
    SEGQ[2] = x1 + hx; SEGQ[3] = y1 + hy;
    SEGQ[4] = x2 + hx; SEGQ[5] = y2 + hy;
    SEGQ[6] = x2 - hx; SEGQ[7] = y2 - hy;
    X.poly(SEGQ, col);
  }

  const SOLID_SEG = 10;          // px of road per piece of a solid line

  function stripe(r, s0, s1, u, w, col, dashOn, dashOff) {
    const L = R.len(r);
    s0 = Math.max(s0, 0.5);
    s1 = Math.min(s1, L - 0.5);
    if (s1 <= s0) return;
    if (dashOff > 0) {
      const step = dashOn + dashOff;
      for (let s = Math.floor(s0 / step) * step; s < s1; s += step) {
        const a = Math.max(s0, s), b = Math.min(s1, s + dashOn);
        if (b > a) seg(r, a, b, u, w, col);
      }
    } else {
      for (let s = s0; s < s1; s += SOLID_SEG) seg(r, s, Math.min(s1, s + SOLID_SEG), u, w, col);
    }
  }

  /* A through-lane boundary exists only while there is pavement on
     both sides of it. This is the dashed line that grows into view as a
     fourth lane opens, or converges with the edge line as one drops. */
  function throughStripe(r, s0, s1, boundary, dirFwd) {
    const on = 17, cycle = 68;                 // MUTCD 10 ft / 30 ft
    for (let s = Math.floor(s0 / cycle) * cycle; s < s1; s += cycle) {
      const a = Math.max(s0, s), b = Math.min(s1, s + on);
      if (b <= a) continue;
      const count = dirFwd ? R.lanesAt(r, (a + b) / 2) : r.back;
      if (count <= boundary + 0.06) continue;
      const ua = dirFwd
        ? r.med + R.SH_IN + R.innerAt(r, a) + R.LANE * boundary
        : -(r.med + R.SH_IN + R.LANE * boundary);
      const ub = dirFwd
        ? r.med + R.SH_IN + R.innerAt(r, b) + R.LANE * boundary
        : ua;
      if (dirFwd && Math.abs(ub - ua) > R.LANE / 2) continue; // do not slash across a left-exit gore
      seg(r, a, b, ua, 1.1, C.line, ub);
    }
  }

  /* ── terrain ────────────────────────────────────────────────────────
     Grass everywhere, then tufts on a world grid so the ground has
     something to slide past. Drawn before the roads, so no tuft ever
     has to know it is standing on tarmac — the tarmac simply covers it. */
  function ground() {
    X.clear(C.grass);
    const cell = 19;
    const c0x = Math.floor((camX - VIEW) / cell), c1x = Math.ceil((camX + VIEW) / cell);
    const c0y = Math.floor((camY - VIEW) / cell), c1y = Math.ceil((camY + VIEW) / cell);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const h = hash2(cx, cy);
        if (h < 0.42) continue;
        const wx = cx * cell + hash2(cx, cy + 977) * cell;
        const wy = cy * cell + hash2(cx + 331, cy) * cell;
        const px = sx(wx, wy) | 0, py = sy(wx, wy) | 0;
        if (px < -3 || py < -3 || px > VW + 3 || py > VH + 3) continue;
        X.box(px, py, h > 0.9 ? 2 : 1, h > 0.9 ? 2 : 1, h > 0.72 ? C.grassLt : C.grassDk);
      }
    }
  }

  /* ── the surface of one road ────────────────────────────────────────
     Everything from the gravel outward to the paint. Stations first,
     then bands from the outside in, so each layer covers the seam left
     by the one before it. */
  /* Project the stations of one road into the scratch arrays. Every
     pass below reads these, so a road is projected once per frame no
     matter how many passes touch it. */
  function stations(r, i0, i1) {
    const st = r.st;
    for (let i = i0; i <= i1; i++) {
      const s = st[i];
      const k = i - i0;
      SX[k] = sx(s.x, s.y); SY[k] = sy(s.x, s.y);
      const th = s.h - camH;
      NX[k] = Math.cos(th); NY[k] = Math.sin(th);
    }
  }

  /* ── the verge, and why it is its own pass ──────────────────────────
     Gravel used to be laid by each road immediately before its own
     asphalt. Roads are drawn one after another, so the SECOND road's
     gravel went down on top of the FIRST road's tarmac — a brown band
     straight across a ramp, wherever two roads run near each other.

     `dress()` was supposed to prevent that, but it only ever suppressed
     the pairs the map builder explicitly handed it, over narrow windows.
     Any other two roads that happened to pass close by — a corridor
     beside a beltway, a ramp near an unrelated exit — were never dressed
     against each other at all, and 7.4% of all painted verge was sitting
     on somebody else's sealed surface.

     Ordering fixes it completely and costs nothing: every road's gravel
     goes down, then every road's asphalt covers it. Tarmac outranks
     verge everywhere, automatically, for every pair, without anybody
     having to have thought of that pair in advance. */
  function verge(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s), e2 = R.edges(r, s + R.STEP);
      const uL = Math.min(e.uL, e2.uL), uR = Math.max(e.uR, e2.uR);
      const skipL = R.suppressed(r.noL, i), skipR = R.suppressed(r.noR, i);
      // a bridge has no verge: the ground it would sit on is not there
      if (R.deckAt(r, s) > 0.5) continue;
      if (!skipL) {
        band(k, k + 1, uL - shL - R.VERGE, uL - shL, C.gravel);
        if (hash2(i, 17) > 0.55) band(k, k + 1, uL - shL - 5, uL - shL - 2, C.gravelDk);
      }
      if (!skipR) {
        band(k, k + 1, uR + shR, uR + shR + R.VERGE, C.gravel);
        if (hash2(i, 7) > 0.55) band(k, k + 1, uR + shR + 2, uR + shR + 5, C.gravelDk);
      }
    }
  }

  /* ── the shadow a bridge throws ─────────────────────────────────────
     Occlusion on its own does not read as height. Once a deck covers
     the road below correctly, it still looks like a road painted on top
     of another road — same asphalt, same width, no edge — and the
     picture is unreadable in a different way than before.

     So an elevated level drops its own footprint onto the level beneath
     it first, offset and darkened, in the same direction every car in
     this game already throws its shadow. It is two and a half pixels
     and it is the whole difference between "over" and "on". */
  const SHADOW_OFF = 2.5;
  function underside(entries) {
    for (const e of entries) {
      const r = e.r;
      if (r._i1 == null || r._i1 <= r._i0) continue;
      stations(r, r._i0, r._i1);
      const sh = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
      for (let k = 0; k < r._i1 - r._i0; k++) {
        const s = (r._i0 + k) * R.STEP;
        const ed = R.edges(r, s), e2 = R.edges(r, s + R.STEP);
        const uL = Math.min(ed.uL, e2.uL) - sh, uR = Math.max(ed.uR, e2.uR) + sh;
        Q[0] = SX[k] + NX[k] * uL + SHADOW_OFF; Q[1] = SY[k] + NY[k] * uL + SHADOW_OFF;
        Q[2] = SX[k] + NX[k] * uR + SHADOW_OFF; Q[3] = SY[k] + NY[k] * uR + SHADOW_OFF;
        Q[4] = SX[k + 1] + NX[k + 1] * uR + SHADOW_OFF; Q[5] = SY[k + 1] + NY[k + 1] * uR + SHADOW_OFF;
        Q[6] = SX[k + 1] + NX[k + 1] * uL + SHADOW_OFF; Q[7] = SY[k + 1] + NY[k + 1] * uL + SHADOW_OFF;
        if ((Q[0] < 0 && Q[2] < 0 && Q[4] < 0 && Q[6] < 0) ||
            (Q[0] > VW && Q[2] > VW && Q[4] > VW && Q[6] > VW) ||
            (Q[1] < 0 && Q[3] < 0 && Q[5] < 0 && Q[7] < 0) ||
            (Q[1] > VH && Q[3] > VH && Q[5] > VH && Q[7] > VH)) continue;
        X.shade(Q, C.shadow, 0.42);
      }
    }
  }

  function surface(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;

    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const e2 = R.edges(r, s + R.STEP);
      const uL = Math.min(e.uL, e2.uL), uR = Math.max(e.uR, e2.uR);
      // sealed, shoulders included
      band(k, k + 1, uL - shL, uR + shR, C.asphalt);

      // wear: patches, stains, and the odd transverse seam
      const hh = hash(i0 + k);
      if (hh > 0.90) band(k, k + 1, uL + hh * 40, uL + hh * 40 + 12 + hash2(i0 + k, 9) * 16, C.patch);
      else if (hh < 0.08) band(k, k + 1, uR - 10 - hh * 90, uR - 4 - hh * 90, C.stain);
      if (hh > 0.44 && hh < 0.47) band(k, k + 1, uL, uR, C.asphaltDk);
    }

  }

  /* ── what stands beside and between the lanes ───────────────────────
     The median barrier and the guardrails. Drawn after every road's
     asphalt for the same reason the verge is drawn before it: these are
     objects standing ON the ground, so nothing's tarmac may cover them
     and they may not be covered by a road laid down later. */
  function furniture(r, i0, i1) {
    stations(r, i0, i1);
    const n = i1 - i0;
    const ramp = r.kind === "ramp";
    const shL = ramp ? R.RAMP_SH : R.SH_OUT;
    const shR = ramp ? R.RAMP_SH : R.SH_OUT;

    if (!ramp && r.med > 0) {
      for (let k = 0; k < n; k++) {
        band(k, k + 1, -r.med, r.med, C.barrierDk);
        band(k, k + 1, -r.med, -r.med + 1.5, C.kerb);
        band(k, k + 1, r.med - 1.5, r.med, C.kerb);
        band(k, k + 1, -1.5, 1.5, C.barrier);
        if ((i0 + k) % 3 === 0) band(k, k + 1, -2.5, 2.5, C.post);
      }
    }

    /* A continuous rail with a post every third station, out past the
       gravel. Ramps get one on the outside of the curve only, which is
       both what happens in reality and half the drawing. */
    for (let k = 0; k < n; k++) {
      const i = i0 + k;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const gR = e.uR + shR + R.VERGE;
      const gL = e.uL - shL - R.VERGE;
      const skipL = R.suppressed(r.noL, i), skipR = R.suppressed(r.noR, i);
      /* On a deck the rail sits at the edge of the structure and is a
         solid concrete parapet, not a guardrail standing in gravel eight
         pixels out in a field that is not there. It also gives the
         bridge a hard rim, which is most of what tells you at a glance
         that the thing you are looking at has an edge to fall off. */
      if (R.deckAt(r, s) > 0.5) {
        band(k, k + 1, e.uR + shR, e.uR + shR + 3, C.barrier);
        band(k, k + 1, e.uR + shR + 3, e.uR + shR + 4, C.barrierDk);
        band(k, k + 1, e.uL - shL - 3, e.uL - shL, C.barrier);
        band(k, k + 1, e.uL - shL - 4, e.uL - shL - 3, C.barrierDk);
        continue;
      }
      if (!r.street && !skipR) {
        band(k, k + 1, gR, gR + 2.5, C.rail);
        if (i % 3 === 0) band(k, k + 1, gR + 0.5, gR + 2, C.post);
      }
      if (!ramp && !r.street && !skipL) {
        band(k, k + 1, gL - 2.5, gL, C.rail);
        if (i % 3 === 0) band(k, k + 1, gL - 2, gL - 0.5, C.post);
      }
    }
  }

  /* ── the paint ──────────────────────────────────────────────────────
     Edge lines solid, lane lines dashed, and the line beside a
     deceleration lane solid too — because on a real road that solid
     line is the instruction not to cross it once the gore has started,
     and it is the only warning the ramp gives you. */
  function markings(r, s0, s1) {
    if (r.kind === "ramp") {
      stripe(r, s0, s1, -R.LANE / 2 + 1, 1.6, C.line, 0, 0);
      // the right edge moves with the flare, so it is sampled per piece
      {
        const a0 = Math.max(s0, 0.5), a1 = Math.min(s1, R.len(r) - 8.5);
        for (let s = a0; s < a1; s += 8) {
          const b = Math.min(a1, s + 8);
          seg(r, s, b, R.edges(r, s).uR - 1, 1.6, C.line, R.edges(r, b).uR - 1);
        }
      }
      for (let l = 1; l < r.rampLanes; l++)
        stripe(r, s0, s1, (l - 0.5) * R.LANE, 1.1, C.line, 17, 51);
      return;
    }
    const inner = r.med + R.SH_IN;
    stripe(r, s0, s1, -(inner + r.back * R.LANE) + 1, 1.3, C.line, 0, 0);
    /* The right-hand edge line has to follow the deceleration lane out
       and back, so its offset is different at each end of every piece —
       that is what the second u is for. */
    {
      const a0 = Math.max(s0, 0.5), a1 = Math.min(s1, R.len(r) - 8.5);
      for (let s = a0; s < a1; s += 8) {
        const b = Math.min(a1, s + 8);
        seg(r, s, b, R.edges(r, s).uR - 1, 1.6, C.line, R.edges(r, b).uR - 1);
      }
    }
    // yellow follows the inside shoulder when a rare left exit consumes lanes
    for (let s = Math.max(s0, 0.5); s < s1; s += 8) {
      const b = Math.min(s1, s + 8);
      const ua = inner + R.innerAt(r, s), ub = inner + R.innerAt(r, b);
      if (Math.abs(ub - ua) <= R.LANE / 2) seg(r, s, b, ua, 1.25, C.yellow, ub);
    }
    stripe(r, s0, s1, -inner, 1.25, C.yellow, 0, 0);
    // MUTCD proportions: 10 ft line / 30 ft gap at freeway speeds
    for (let l = 1; l < 6; l++) throughStripe(r, s0, s1, l, true);
    for (let l = 1; l < r.back; l++) throughStripe(r, s0, s1, l, false);
    // 3 ft / 9 ft dotted lane line through a lane-add or lane-drop area
    for (let split = 0; split < 3; split++) {
      for (let s = Math.floor(s0 / 20) * 20; s < s1; s += 20) {
        const a = Math.max(s0, s), b = Math.min(s1, s + 5);
        if (b <= a || R.auxAt(r, (a + b) / 2) <= R.LANE * (split + 0.08)) continue;
        const ua = inner + R.innerAt(r, a) + (R.lanesAt(r, a) + split) * R.LANE;
        const ub = inner + R.innerAt(r, b) + (R.lanesAt(r, b) + split) * R.LANE;
        seg(r, a, b, ua, 1.25, C.line, ub);
      }
    }
  }

  /* ── the gore ───────────────────────────────────────────────────────
     The wedge of nothing between a freeway and the ramp leaving it,
     which in real life is hatched paint and a crash cushion and is the
     part of a junction people actually hit. Painted across both roads
     at once because it belongs to neither. */
  /* The wedge itself is SURFACE — it must be laid with the asphalt, in
     the surface pass, or it paints over the markings of whatever is
     drawn before it. The chevrons and the crash cushion on it are PAINT,
     and go down in the markings pass with everything else. */
  function gore(j, marks) {
    const ramp = j.ramp, par = j.from;
    const LEN = R.GORE;      // same span the two roads stop dressing
    /* The parent's *base* edge, not R.edges().uR — that one still has
       the deceleration lane in it at the gore station, which would put
       the near side of the wedge a full lane to the right of where the
       ramp actually begins and paint the first chevron inside out. The
       split happens where the lanes end, and the aux lane is the ramp. */
    const right = j.side > 0;
    const base = right
      ? j.startU - R.LANE / 2
      : j.startU + (j.lanes - 0.5) * R.LANE;
    /* ── the wedge spans the GAP, not the two centrelines' lane edges ──
       This used to run from the parent's lane edge to the ramp's lane
       edge, and both of those sit INSIDE sealed pavement — a lane edge
       has a ten-foot shoulder outside it. So the wedge was painted right
       across both roads' shoulders: at the near end, where the two
       pavements are still contiguous, that is a brown triangle laid over
       solid tarmac on both sides. Measured off the rendered frame, 52%
       of every brown pixel on screen was sitting on a sealed surface.

       Real gore only exists where the two roads have actually parted, so
       it is measured between the parent's outer SEALED edge and the
       ramp's, and nothing is drawn at all until that gap opens. */
    const sealPar = (s) => R.edges(par, s).uR + R.SH_OUT;
    const sealRamp = (d) => R.edges(ramp, d).uL - R.RAMP_SH;
    for (let d = 0; d < LEN; d += 10) {
      const a = R.at(ramp, d, right ? sealRamp(d) : R.edges(ramp, d).uR + R.RAMP_SH);
      const b = R.at(ramp, d + 10, right ? sealRamp(d + 10) : R.edges(ramp, d + 10).uR + R.RAMP_SH);
      const pu = right ? Math.max(base, sealPar(j.s + d)) : base;
      const pu2 = right ? Math.max(base, sealPar(j.s + d + 10)) : base;
      const pa = R.at(par, j.s + d, pu);
      const pb = R.at(par, j.s + d + 10, pu2);
      /* Nothing until the two sealed surfaces have parted — and nothing
         once they are properly apart either. A gore is the narrow
         triangle immediately after a split; sixty pixels out the two
         roads have their own verges and what lies between them is a
         field, which is green. Painting the full 360 px regardless meant
         a long brown slab thrown across open ground and, where the
         entrance ramp cuts back through, across its tarmac too. */
      if (right) {
        const gapA = Math.hypot(a.x - pa.x, a.y - pa.y);
        const gapB = Math.hypot(b.x - pb.x, b.y - pb.y);
        if (gapA < 2 && gapB < 2) continue;
        if (gapA > 60 && gapB > 60) break;
      }
      Q[0] = sx(pa.x, pa.y); Q[1] = sy(pa.x, pa.y);
      Q[2] = sx(a.x, a.y);   Q[3] = sy(a.x, a.y);
      Q[4] = sx(b.x, b.y);   Q[5] = sy(b.x, b.y);
      Q[6] = sx(pb.x, pb.y); Q[7] = sy(pb.x, pb.y);
      if (!marks) X.poly(Q, d < 110 ? C.asphaltDk : C.gravel);
      // chevrons up the middle of it
      if (marks && d < 110 && (d / 10) % 2 === 0) {
        const mx = (Q[0] + Q[2]) / 2, my = (Q[1] + Q[3]) / 2;
        const nx2 = (Q[4] + Q[6]) / 2, ny2 = (Q[5] + Q[7]) / 2;
        Q[0] = mx; Q[1] = my; Q[2] = mx + 1.6; Q[3] = my + 1.6;
        Q[4] = nx2 + 1.6; Q[5] = ny2 + 1.6; Q[6] = nx2; Q[7] = ny2;
        X.poly(Q, C.line);
      }
    }
    /* The nose: a striped crash cushion, deliberately the loudest
       object on the road. Seen from a car it is the only part of a
       junction that says "decide now", so it is drawn big enough to
       read at a glance rather than scaled to how much space it takes
       up in real life. */
    if (!marks) return;
    const n0 = R.at(par, j.s + 2, base + (right ? 4 : -4));
    const nx = sx(n0.x, n0.y), ny = sy(n0.x, n0.y);
    if (nx > -14 && ny > -14 && nx < VW + 14 && ny < VH + 14) {
      X.sprite(noseBmp(), nx, ny, n0.h - camH);
    }
  }

  let _nose = null;
  function noseBmp() {
    if (_nose) return _nose;
    _nose = X.bitmap(9, 13);
    _nose.fill(0, 0, 9, 13, C.dark);
    for (let i = 0; i < 4; i++) _nose.fill(1, 1 + i * 3, 7, 2, i % 2 ? C.dark : C.yellow);
    _nose.fill(3, 0, 3, 1, C.line);
    return _nose;
  }

  function blob(wx, wy, r, col) {
    const px = sx(wx, wy), py = sy(wx, wy);
    if (px < -8 || py < -8 || px > VW + 8 || py > VH + 8) return;
    X.box(px - r / 2, py - r / 2, r, r, col);
  }

  /* ── signs and signals ──────────────────────────────────────────────
     Seen from above a sign is an edge, which tells you nothing, so both
     of these cheat and show their faces. Every top-down game that has
     ever had a road sign in it cheats in exactly this way. */
  function exitSign(j) {
    const par = j.from;
    for (const back of [700, 320]) {
      const s = j.s - back;
      if (s < 0) continue;
      const e = R.edges(par, s);
      const u = j.side > 0 ? e.uR + R.SH_OUT + 6 : par.med + R.SH_IN - 8;
      const p = R.at(par, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -20 || py < -20 || px > VW + 20 || py > VH + 20) continue;
      const a = p.h - camH;
      X.sprite(signBmp(j.no, back === 320, j.side, j.lanes, j.type), px, py, a);
    }
  }

  const signCache = new Map();
  function signBmp(no, near, side, lanes, type) {
    const key = no + (near ? "n" : "f") + side + lanes + type;
    let b = signCache.get(key);
    if (b) return b;
    b = X.bitmap(20, 13);
    b.fill(0, 0, 20, 13, C.signWhite);
    b.fill(1, 1, 18, 11, C.signGreen);
    // mirrored turn arrow; left exits also carry the conspicuous plaque
    const left = side < 0;
    for (let i = 0; i < 6; i++) b.set(left ? 15 - i : 4 + i, 4, C.signWhite);
    for (let i = 0; i < 3; i++) b.set(left ? 8 - i : 9 + i, 5 + i, C.signWhite);
    b.fill(left ? 5 : 11, 7, 3, 1, C.signWhite);
    if (left) b.fill(1, 1, 5, 2, C.yellow);
    if (type === "signal") {
      b.fill(15, 2, 2, 2, C.red); b.fill(15, 5, 2, 2, C.green);
    } else if (type === "loop") {
      b.fill(14, 2, 3, 1, C.signWhite); b.set(16, 3, C.signWhite);
    }
    for (let i = 0; i < lanes; i++) b.fill(4 + i * 5, 9, near ? 3 : 2, 1, C.signWhite);
    b.fill(0, 12, 20, 1, C.post);
    signCache.set(key, b);
    return b;
  }

  function meter(r) {
    const m = r.meter;
    if (!m) return;
    // one stop bar across every lane at the surface-street intersection
    const e = R.edges(r, m.s);
    const a0 = R.at(r, m.s - 1.5, e.uL + 1), a1 = R.at(r, m.s + 1.5, e.uL + 1);
    const b0 = R.at(r, m.s - 1.5, e.uR - 1), b1 = R.at(r, m.s + 1.5, e.uR - 1);
    X.poly([sx(a0.x, a0.y), sy(a0.x, a0.y), sx(b0.x, b0.y), sy(b0.x, b0.y),
            sx(b1.x, b1.y), sy(b1.x, b1.y), sx(a1.x, a1.y), sy(a1.x, a1.y)], C.line);
    /* The head, on its post beside the lane. Drawn face-on and larger
       than scale, and glowing hard enough to be seen over the roof of
       a queue — because this is the one object on the road that has to
       be legible from four hundred pixels away, and a signal you spot
       late is a signal that has already cost you. */
    const nt = night();
    for (const u of [e.uL - 7, e.uR + 7]) {
      const h = R.at(r, m.s + 10, u);
      const hx = sx(h.x, h.y), hy = sy(h.x, h.y);
      X.sprite(m.red ? headRed() : headGreen(), hx, hy, h.h - camH);
      X.glow(hx, hy, m.red ? 22 : 17,
        m.red ? 190 : 34, m.red ? 30 : 190, m.red ? 20 : 90, 0.30 + 0.55 * nt);
    }
  }
  let _hr = null, _hg = null;
  function head(on) {
    const b = X.bitmap(9, 19);
    b.fill(3, 13, 3, 6, C.post);                 // the mast
    b.fill(0, 0, 9, 13, C.dark);                 // the housing
    b.fill(1, 1, 7, 5, on === "red" ? C.red : X.mix(C.red, C.dark, 0.72));
    b.fill(1, 7, 7, 5, on === "green" ? C.green : X.mix(C.green, C.dark, 0.75));
    return b;
  }
  const headRed = () => (_hr || (_hr = head("red")));
  const headGreen = () => (_hg || (_hg = head("green")));

  /* ── street lighting ────────────────────────────────────────────────
     Along the outside of every freeway, one side then the other. Lit
     only when there is something to light. */
  function lamps(r, i0, i1) {
    const nt = night();
    for (let i = i0; i <= i1; i += 7) {
      if (i % 7) continue;
      const s = i * R.STEP;
      const e = R.edges(r, s);
      const right = ((i / 7) | 0) % 2 === 0;
      const u = right ? e.uR + R.SH_OUT + R.VERGE + 5 : e.uL - R.SH_OUT - R.VERGE - 5;
      const p = R.at(r, s, u);
      const px = sx(p.x, p.y), py = sy(p.x, p.y);
      if (px < -24 || py < -24 || px > VW + 24 || py > VH + 24) continue;
      const nx = Math.cos(p.h - camH), ny = Math.sin(p.h - camH);
      const arm = right ? -7 : 7;
      X.poly([px - ny, py + nx, px + ny, py - nx,
              px + nx * arm + ny, py + ny * arm - nx,
              px + nx * arm - ny, py + ny * arm + nx], C.post);
      const lx = px + nx * arm, ly = py + ny * arm;
      X.box(lx - 1, ly - 1, 3, 3, nt > 0.22 ? C.head : C.rail);
      if (nt > 0.12) X.glow(lx, ly, 30, 255, 214, 140, 0.16 * nt);
    }
  }

  /* ── vehicles ───────────────────────────────────────────────────────
     Deleted along with traffic.js. `vehicleBmp` built a bitmap per type
     and colour from `Traffic.TYPES`, and `vehicle()` drew one with its
     shadow, indicator, beacon, brake lights and headlight throw. All of
     it comes back when traffic does; none of it can outlive the module
     that owned the dimensions.

     `beam()` below survives because the PLAYER still has headlights, and
     so does everything from here to the end of this comment — the car
     you drive was built in the middle of the traffic art and very nearly
     went out with it. */

  let playerBmp = null, playerWreck = null;
  function buildPlayer() {
    const w = 11, l = 26;
    const mk = (dead) => {
      const b = X.bitmap(w, l);
      const base = dead ? C.playerDead : C.player;
      b.fill(0, 0, w, l, base);
      b.fill(0, 0, 1, l, X.mix(base, C.shadow, 0.4));
      b.fill(w - 1, 0, 1, l, X.mix(base, X.rgb(255, 255, 255), 0.2));
      b.fill(4, 1, 3, l - 2, dead ? X.hex("#6d5f4e") : C.playerTrim);
      b.fill(2, 6, w - 4, 7, C.glass);
      b.fill(2, 5, w - 4, 1, X.mix(base, X.rgb(255, 255, 255), 0.24));
      b.fill(2, l - 10, w - 4, 4, C.glass);
      if (dead) { b.fill(3, 1, 3, 3, X.hex("#4a1f19")); b.fill(w - 6, 2, 3, 2, X.hex("#4a1f19")); }
      else {
        b.fill(1, 0, 2, 1, C.head); b.fill(w - 3, 0, 2, 1, C.head);
        b.fill(1, l - 1, 2, 1, C.tail); b.fill(w - 3, l - 1, 2, 1, C.tail);
      }
      return b;
    };
    playerBmp = mk(false);
    playerWreck = mk(true);
  }

  /* headlight throw — a pale wedge in front of anything moving */
  function beam(px, py, a, w, l) {
    const nt = night();
    const fx = Math.sin(a), fy = -Math.cos(a);
    const rx = Math.cos(a), ry = Math.sin(a);
    const tip = 54;
    X.shade([
      px + fx * l / 2 - rx * (w / 2 - 1), py + fy * l / 2 - ry * (w / 2 - 1),
      px + fx * l / 2 + rx * (w / 2 - 1), py + fy * l / 2 + ry * (w / 2 - 1),
      px + fx * tip + rx * (w / 2 + 9), py + fy * tip + ry * (w / 2 + 9),
      px + fx * tip - rx * (w / 2 + 9), py + fy * tip - ry * (w / 2 + 9),
    ], X.rgb(255, 242, 200), 0.11 * nt);
  }

  /* The camera rides the road's centreline, so the car is not pinned to
     the middle of the screen — it moves across a picture that stays
     put. Its angle is still zero: the car never turns, the road does. */
  function player(S, wrecked) {
    if (!playerBmp) buildPlayer();
    const b = wrecked ? playerWreck : playerBmp;
    const px = sx(S.x, S.y), py = sy(S.x, S.y);
    X.silhouette(b, px + 1.5, py + 1.5, 0, C.shadow, 0.4);
    X.sprite(b, px, py, 0);
    if (!wrecked && night() > 0.2) beam(px, py, 0, 11, 26);
  }

  /* When the player is on the lower road, the bridge must cover the
     solid car—but completely erasing it makes the game unreadable. This
     translucent locator is painted back over the deck only while that
     deck physically covers the car. On an upper road `upper` is empty at
     the crossing, so the normal solid car remains visibly on top. */
  function playerGhost(S, wrecked) {
    if (!playerBmp) buildPlayer();
    const b = wrecked ? playerWreck : playerBmp;
    const px = sx(S.x, S.y), py = sy(S.x, S.y);
    X.silhouette(b, px - 1, py, 0, C.playerTrim, 0.20);
    X.silhouette(b, px + 1, py, 0, C.playerTrim, 0.20);
    X.silhouette(b, px, py, 0, C.player, 0.48);
  }

  function deckCoversPlayer(r, S, seed) {
    const pr = World.locate(r, S.x, S.y, seed, r.hint);
    if (!pr || pr.s <= 0 || pr.s >= R.len(r)) return false;
    const e = R.edges(r, pr.s);
    const shoulder = r.kind === "ramp" ? R.RAMP_SH : R.SH_OUT;
    return pr.u >= e.uL - shoulder && pr.u <= e.uR + shoulder;
  }

  /* ── the frame ──────────────────────────────────────────────────────
     Roads furthest away first so that where two of them run close
     together the near one wins the seam. */
  /* cx, cy, ch are the CAMERA — a point on the centreline of the road
     under the car, not the car itself. See the note in offramp.js. */
  function world(cx, cy, ch, S) {
    camera(cx, cy, ch);
    ground();

    /* Which roads are even here. This used to walk every road in the
       world and project onto each; the map now holds two thousand of
       them, so it asks the spatial index instead — and the index hands
       back a station to start projecting from, which is what lets a road
       you have never seen before be projected in a narrow window rather
       than scanned end to end. */
    const near = [];
    for (const [r, seed] of World.nearby(cx, cy, VIEW + 300, nearScratch)) {
      const pr = World.locate(r, cx, cy, seed, r.hint);
      if (!pr || pr.dist > VIEW + 240) continue;
      near.push({ r, pr });
    }
    /* Paint order, and it must be STABLE. It used to be
       `b.pr.dist - a.pr.dist`, on the reasoning that the nearer
       centreline should win the seam. That is fine for two roads that
       never share a layer and fatal for two that do: as you drive past,
       their distances cross over and the pair swaps draw order from one
       frame to the next. Each paints its own asphalt and verge over the
       other in turn, and the gravel along the gore strobes. `layer` is
       unique per road and assigned parent-first, so every ramp paints
       on top of the road it came off and keeps doing so. */
    near.sort((a, b) => a.r.layer - b.r.layer || a.r.id - b.r.id);

    /* ── two passes, and this is not a detail ─────────────────────────
       Every road used to lay its own asphalt and then its own paint,
       one road after another. Where two roads overlap — which is every
       gore on the map, since a ramp runs inside the freeway's shoulder
       for a couple of hundred pixels after it leaves — the second road's
       ASPHALT covers the first road's PAINT. The freeway's right-hand
       edge line simply stopped existing for the length of every exit.

       Ordering the roads differently cannot fix it, only move it:
       whichever is drawn second wins. So surfaces go down for all roads
       first, and then markings for all roads on top. Paint is never
       erasable by tarmac, which is also true of roads. */
    function span(entry) {
      const { r, pr } = entry;
      const reach = Math.sqrt(Math.max(0, VIEW * VIEW - Math.min(pr.dist, VIEW) ** 2)) + 90;
      let i0 = Math.max(0, Math.floor((pr.s - reach) / R.STEP));
      let i1 = Math.min(r.st.length - 1, Math.ceil((pr.s + reach) / R.STEP));
      if (i1 - i0 > 560) i1 = i0 + 560;
      r._i0 = i0; r._i1 = i1;
      return i1 > i0;
    }

    function paintSurfaces(entries) {
      for (const e of entries) span(e);
      // gravel for everything, then tarmac over it, then what stands beside it
      for (const e of entries) if (e.r._i1 > e.r._i0) verge(e.r, e.r._i0, e.r._i1);
      for (const e of entries) {
        if (e.r._i1 <= e.r._i0) continue;
        surface(e.r, e.r._i0, e.r._i1);
        if (e.r.kind === "ramp" && e.r.junction) gore(e.r.junction, false);
      }
      for (const e of entries) if (e.r._i1 > e.r._i0) furniture(e.r, e.r._i0, e.r._i1);
    }

    function paintMarkings(entries) {
      for (const e of entries) {
        if (e.r._i1 == null || e.r._i1 <= e.r._i0) continue;
        markings(e.r, e.r._i0 * R.STEP, e.r._i1 * R.STEP);
        if (e.r.kind === "ramp" && e.r.junction) gore(e.r.junction, true);
      }
    }

    function fixtures(entries) {
      for (const { r } of entries) {
        if (r.kind === "freeway" && !r.street && r._i1 != null) lamps(r, r._i0, r._i1);
        if (r.meter) meter(r);
      }
    }

    /* ── one whole level at a time ────────────────────────────────────
       Surfaces for everything, then markings for everything, is right
       for roads lying in the same field: paint can never be erased by
       somebody else's tarmac. Across a bridge it is badly wrong, and it
       produced the single most confusing picture this game has ever
       drawn. Standing on an overpass, the deck's asphalt correctly
       covered the freeway below — and then the freeway's own lane lines
       were painted straight back over the deck, because markings ran as
       one pass for every road at or below the player. Six lines of
       somebody else's road, crossing the one you are driving on.

       So the unit is a LEVEL, not the whole scene. Everything at deck 0
       is finished — gravel, tarmac, furniture, paint — before anything
       at deck 1 begins, and a deck therefore hides what is under it
       completely, which is what being a bridge means. Within a level the
       two passes survive unchanged, because within a level they are
       still exactly right. */
    const playerDeck = S.road ? R.deckAt(S.road, S.s) : 0;
    const levels = new Map();
    for (const e of near) {
      const k = Math.round(R.deckAt(e.r, e.pr.s));
      let g = levels.get(k);
      if (!g) levels.set(k, g = []);
      g.push(e);
    }
    const order = [...levels.keys()].sort((a, b) => a - b);
    const playerLevel = Math.round(playerDeck);

    function onTheRoad() {
      // marks on the road, then whatever is on top of it
      for (const m of S.marks) {
        const x = sx(m.x, m.y), y = sy(m.x, m.y);
        if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
        const a = m.h - camH;
        X.shade([x - Math.cos(a), y - Math.sin(a), x + Math.cos(a), y + Math.sin(a),
                 x + Math.cos(a) + Math.sin(a) * 3, y + Math.sin(a) - Math.cos(a) * 3,
                 x - Math.cos(a) + Math.sin(a) * 3, y - Math.sin(a) - Math.cos(a) * 3],
                C.shadow, 0.42);
      }
      player(S, S.mode === "wreck");
    }

    let placed = false;
    for (const k of order) {
      const g = levels.get(k);
      for (const e of g) span(e);
      if (k > 0) underside(g);            // the shadow a deck throws on what it covers
      paintSurfaces(g);
      paintMarkings(g);
      fixtures(g);
      if (k === playerLevel) { onTheRoad(); placed = true; }
    }
    if (!placed) onTheRoad();

    const above = near.filter(({ r, pr }) => Math.round(R.deckAt(r, pr.s)) > playerLevel);
    if (above.some(({ r, pr }) => deckCoversPlayer(r, S, pr.i)))
      playerGhost(S, S.mode === "wreck");
    /* Signs for the exits on roads that are actually on screen. Looping
       every junction on the map to draw two sprites was affordable at
       thirty-four exits and is not at two thousand. */
    for (const { r } of near) {
      if (r.kind !== "freeway" || !r.exits.length) continue;
      for (const e of r.exits) {
        if (e.ramp.dead || !e.ramp.junction) continue;
        exitSign(e.ramp.junction);
      }
    }

    for (const p of S.parts) {
      const x = sx(p.x, p.y) | 0, y = sy(p.x, p.y) | 0;
      if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
      X.box(x, y, p.size, p.size, p.col);
    }

    // and finally, what time it is
    const nt = night(), wm = warmth();
    if (wm > 0.01) X.tint(255, 132, 40, 0.20 * wm);
    if (nt > 0.01) X.tint(10, 12, 38, 0.66 * nt);
    if (S.flash > 0.01) X.tint(255, 240, 220, 0.7 * S.flash);
    X.flush();
  }

  return {
    VW, VH, CX, PY, C,
    world, setPhase, night, camera, sx, sy,
    partCols: {
      dust: [C.gravel, C.gravelDk], debris: [C.cone, C.coneBand, C.asphalt],
      spark: [C.head, C.amber], smoke: [C.smoke], fire: [C.fire, C.tail, X.hex("#ffe089")],
    },
  };
})();
