/* ══════════════════════════════════════════════════════════════════════
   The exhibit.

   One number runs this whole page: `t`, a position along the ladder from
   0 to 1. The arrows set it, a chip sets it, the arrow keys set it, the
   rail sets it, the tour sets it — and everything else on screen is
   derived. There is no second source of truth about where you are.

   Neither the wheel nor a drag sets it, deliberately: see the input
   section. Nothing you do *to the picture* moves you. You move with
   controls, and the picture only ever answers.

   From `t` comes exactly one quantity:

     cam.w   how wide the frame is, in metres

   That is the whole camera. **It never pans.** The frame is always
   centred on the same point in space, and moving the rail only changes
   how much of the world that frame is worth — so every object on screen
   grows or shrinks about the middle of the window and nothing ever
   slides sideways. It is a zoom, not a scroll.

   Which means every object needs somewhere to be, and the trick is that
   each one is parked at an offset **proportional to its own size**. Rung
   k sits about half its own width off-centre; rung k−1 is ten times
   smaller, so it sits ten times closer in. Zoom out one rung and the
   thing you were just looking at collapses toward the middle of the
   screen and turns into a speck while the next thing opens up around it.
   That collapse is the exhibit. Everything else is captions.

   The interpolation is logarithmic, so a constant drag is a constant
   number of decades per second — the zoom never speeds up or slows down,
   which is what makes the size of the gaps something you feel rather
   than something you read off an axis.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const L = window.LADDER, PAINT = window.PAINT, U = window.U, SKY = window.SKY;
  const $ = (id) => document.getElementById(id);
  const N = L.length;
  const KEY = "ric-scale-v1";
  const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  /* ── where each rung sits ──────────────────────────────────────────
     `extent` is the object's largest dimension; `size` is the dimension
     the caption is about. They differ for anything that is not square —
     DNA is measured across and drawn long — and the layout uses the
     first while the caliper uses the second.

     Each object is parked at an offset that is a fixed fraction OF ITS
     OWN EXTENT. That single choice is what makes this a zoom instead of
     a pan: because the offset scales with the object, a rung ten times
     smaller sits ten times closer to the middle, so zooming out drags
     everything you have already seen into a knot at the centre of the
     frame while the current rung opens up around it.

     The bearing steps by the golden angle, 137.5°, which is the standard
     trick for scattering a sequence of things around a point without any
     two of them ever lining up. Squashed on the vertical because a window
     is wider than it is tall.

     The offset is deliberately modest. A large one keeps neighbours from
     ever overlapping, but it also means an arriving rung swings in from a
     corner across half the screen, which reads as a pan — the exact thing
     this layout exists to avoid. Small offsets keep everything growing
     out of the middle, and the overlap that produces turns out to be
     worth having: the Moon's whole orbit sitting inside the Sun's disc is
     one of the better facts on the ladder, and it draws itself. */
  const GOLDEN = 2.399963229728653;
  const extent = L.map((o) => o.size * Math.max(o.box[0], o.box[1]));
  /* Bearings are fixed; the two magnitudes are not — computeFrames()
     rewrites them on every resize, because how far off-centre a rung
     should be parked depends on how much room there is to park it in.
     Mutated in place, never reassigned, since window.LAYOUT hands this
     same array to the painters. */
  const OFF = L.map(() => [0, 0]);
  /* Published because one painter needs to know where another rung is
     parked. The Great Lakes sit at a fixed offset from the Earth, and
     the Earth has to be turned so that the spot under that offset is
     the Great Lakes — otherwise you zoom out from Superior and it lands
     in the middle of an ocean. See P.earth. */
  window.LAYOUT = { off: OFF, extent };

  const W = new Array(N);          // frame width per rung — depends on the canvas
  let LOGW = new Array(N);

  /* ── how the rail is divided ───────────────────────────────────────
     Mostly by decades, so the rail is nearly honest: the empty three
     decades between the electron and the proton genuinely cost you three
     decades of dragging, and you feel them.

     Not *purely* by decades, because three pairs on this ladder are close
     together — a quark and an electron, you and an elephant, the Oort
     Cloud and the nearest star — and a strictly logarithmic rail gives
     those pairs a slice about two pixels wide, which is a rung you cannot
     stop on. The quark pair is the tightest of the three: seven
     hundredths of a decade, which without the padding below would be a
     rung a third of a pixel wide. So every gap gets a
     flat 0.45-decade allowance on top of its real width. Across the whole
     rail that is 9 decades of padding against 45 real ones: the shape is
     still overwhelmingly the true shape, and every rung is reachable. */
  const T = new Array(N);
  {
    const w = [0];
    let total = 0;
    for (let k = 1; k < N; k++) {
      w[k] = Math.log10(L[k].size) - Math.log10(L[k - 1].size) + 0.45;
      total += w[k];
    }
    let acc = 0;
    T[0] = 0;
    for (let k = 1; k < N; k++) { acc += w[k]; T[k] = acc / total; }
    T[N - 1] = 1;
  }

  const canvas = $("view");
  const ctx = canvas.getContext("2d");
  let cw = 0, ch = 0, dpr = 1;
  /* How much of the bottom of the canvas the dock is standing on. The
     calipers are drawn in the canvas and the dock is DOM on top of it, so
     without this the measurement under a frame-filling object lands
     behind the rail. Measured on resize; the dock's height only changes
     at a breakpoint. */
  let safeBottom = 0;
  /* The clear band: the strip of canvas that no instrument is standing on.
     On a wide window that is almost the whole thing, and objects sit in
     the middle of it. On a phone the left rail is the full width of the
     screen and the dock is under it, so the middle of the *canvas* is
     behind the fact card — objects have to be centred in what is left, and
     framed against its height rather than the window's. */
  let bandTop = 0, bandBot = 0;

  const S = {
    t: 0,
    target: null,          // a glide in progress, or null
    from: 0, glideStart: 0, glideMs: 0,
    lastInput: 0,
    settledOn: -1,
    wokeAt: -1e9,          // clock seconds at which the current rung settled
    started: 0,
    touring: false,
    tourTimer: 0,
  };

  /* ── the arrival beat ──────────────────────────────────────────────
     One bump, once, when the camera stops on a rung: up over a fifth of
     a second and gone inside two. Painters multiply their arrival
     flourish by it — the Sun throws a flare, the elephant's ear goes
     out, the electron's uncertainty surges and settles.

     It is zero before the rung is arrived at and zero again a couple of
     seconds later, which is the point: it can be added to a painter
     without disturbing either the approach or the loop it settles into.
     A destination that greeted you forever would just be a destination
     that never stops moving. */
  function wakeOf(clock) {
    const u = clock - S.wokeAt;
    if (u < 0 || u > 3) return 0;
    return clamp01(u / 0.2) * Math.exp(-Math.max(0, u - 0.2) * 1.6);
  }

  /* ── framing ───────────────────────────────────────────────────────
     A rung's frame is three times its own extent, and then opened up if
     that would push any part of the object — offset included — off an
     edge. A short wide window and a tall phone need genuinely different
     frames for the same object, so this is recomputed on every resize,
     and it is the only camera quantity that depends on the shape of the
     window. */
  function computeFrames() {
    const bandH = Math.max(60, bandBot - bandTop);

    /* How much room this window has to spend, 0 on a phone and 1 on a
       large desktop. Everything below is a straight interpolation on it.

       A fixed frame of three times the object meant the subject was the
       same *fraction* of the glass on a 27-inch monitor as on a phone —
       a third of the width, a little over half the clear band — so all a
       bigger screen bought you was more empty black around the same
       picture. A big screen should buy a bigger object.

       The vertical offset is the one that pays for most of it. It was
       costing a fifth of the frame's height in headroom on every rung,
       and on a wide window that headroom is the least useful space
       there is: flattening the offsets spends it on the subject and
       leans the scatter sideways, which is the direction a wide window
       has room in anyway. The bearings do not change, so neighbouring
       rungs stay as separated as they were. */
    const roomy = clamp01((Math.min(cw, bandH * 1.7) - 480) / 900);
    const offV = 0.22 - 0.12 * roomy;   // 0.22 → 0.10
    const fillX = 0.86 + 0.08 * roomy;  // 0.86 → 0.94
    const fillY = 0.80 + 0.14 * roomy;  // 0.80 → 0.94
    const mult = 3.0 - 0.8 * roomy;     // 3.0  → 2.2

    for (let k = 0; k < N; k++) {
      const o = L[k];
      OFF[k][0] = 0.38 * extent[k] * Math.cos(k * GOLDEN);
      OFF[k][1] = offV * extent[k] * Math.sin(k * GOLDEN);
      const reachX = Math.abs(OFF[k][0]) + (o.size * o.box[0]) / 2;
      const reachY = Math.abs(OFF[k][1]) + (o.size * o.box[1]) / 2;
      W[k] = Math.max(
        mult * extent[k],
        (2 * reachX) / fillX,                    // fits across
        ((2 * reachY) / fillY) * (cw / bandH)    // and fits down the clear band
      );
    }
    LOGW = W.map(Math.log10);
    // The globe is aimed from these offsets, so it has to be re-derived.
    if (PAINT.forget) PAINT.forget("earthaim");
  }

  function segment(t) {
    let k = 1;
    while (k < N - 1 && T[k] < t) k++;
    return k;
  }

  function camera(t) {
    t = clamp01(t);
    const k = segment(t);
    const span = T[k] - T[k - 1];
    const f = span > 0 ? (t - T[k - 1]) / span : 0;
    return { w: Math.pow(10, LOGW[k - 1] + f * (LOGW[k] - LOGW[k - 1])) };
  }

  /* How close the rail is to each rung, 0 to 1. Drives the animation
     amplitude in every painter, so an object wakes up as you arrive at it
     and settles again as you leave. */
  function focusOf(k, t) {
    const lo = T[k] - T[Math.max(0, k - 1)];
    const hi = T[Math.min(N - 1, k + 1)] - T[k];
    const h = 0.25 * ((lo || hi) + (hi || lo));
    if (h <= 0) return 0;
    const f = clamp01(1 - Math.abs(t - T[k]) / h);
    return f * f * (3 - 2 * f);
  }

  /* How far the rail has come toward this rung from the one below it: 0
     while you are still sitting on the previous rung, 1 from the moment
     you arrive, and it stays 1 forever after.

     This is what makes the page a zoom rather than a diagram. Rungs are
     not all equally far apart, and two of the pairs are very close: the
     Sun is only 1.8× the Moon's orbit, so at any framing that shows the
     Moon's orbit properly, the Sun is a wall of light behind it and the
     rung you are actually on is invisible. Fading the next rung up as you
     travel toward it means each thing arrives out of the dark exactly
     when it becomes the subject — and everything you have already passed
     stays at full strength, because that history collapsing into a knot
     at the centre of the frame is the exhibit. */
  function arriveOf(k, t) {
    if (k === 0) return 1;
    const span = T[k] - T[k - 1];
    if (span <= 0) return 1;
    const f = clamp01((t - T[k - 1]) / span);
    return f * f * (3 - 2 * f);
  }

  function nearestRung(t) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < N; k++) {
      const d = Math.abs(t - T[k]);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /* ── the canvas ────────────────────────────────────────────────────── */
  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = Math.max(1, Math.round(box.width));
    ch = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + "px";
    canvas.style.height = ch + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    measureBand();
  }

  /* Remeasured on resize and whenever the fact card appears or goes away,
     because that card is the thing that moves the band on a phone. Not
     every frame: this reads layout, and it changes a handful of times a
     visit. */
  function measureBand() {
    const bottom = document.querySelector(".hud-bottom");
    const scrub = document.querySelector(".scrub");
    safeBottom = (bottom ? bottom.getBoundingClientRect().height + 14 : 0) +
                 (scrub ? scrub.getBoundingClientRect().height : 0);
    bandBot = Math.max(80, ch - safeBottom - 10);
    if (cw > 900) {
      bandTop = 8;
    } else {
      const rail = document.querySelector(".rail-left").getBoundingClientRect();
      bandTop = Math.min(rail.bottom + 10, ch * 0.6, bandBot - 70);
    }
    computeFrames();
  }

  /* ── the decade grid ───────────────────────────────────────────────
     Lines one power of ten apart, in real metres, drawn at whichever two
     decades happen to be a comfortable spacing on screen right now. As
     you zoom out they slide together, fade, and are replaced by the next
     decade up, which springs back to full spacing.

     This is doing the work the numbers cannot. Between the Oort Cloud and
     the Milky Way there is nothing at all to look at for four and a half
     decades, and without the grid that stretch reads as the page having
     frozen rather than as an enormous amount of empty space. */
  function drawGrid(cam, scale) {
    const base = Math.pow(10, Math.floor(Math.log10(cam.w)));
    const midX = cw / 2, midY = (bandTop + bandBot) / 2;
    for (const e of [base / 10, base, base * 10]) {
      const step = e * scale;
      if (step < 16 || step > 1400) continue;
      // Brightest at a comfortable spacing; gone at both ends.
      const f = Math.min((step - 16) / 46, (1400 - step) / 700, 1);
      const a = 0.052 * Math.max(0, f);
      if (a < 0.002) continue;
      ctx.strokeStyle = "rgba(190,205,235," + a + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Anchored on the centre, because the centre is the one point the
      // camera never leaves. Lines converge on it as you zoom out, which
      // is the motion the objects are making too.
      const nx = Math.min(200, Math.ceil(cw / 2 / step));
      for (let i = -nx; i <= nx; i++) {
        const x = Math.round(midX + i * step) + 0.5;
        if (x < 0 || x > cw) continue;
        ctx.moveTo(x, 0); ctx.lineTo(x, ch);
      }
      const ny = Math.min(200, Math.ceil(ch / 2 / step));
      for (let i = -ny; i <= ny; i++) {
        const y = Math.round(midY + i * step) + 0.5;
        if (y < 0 || y > ch) continue;
        ctx.moveTo(0, y); ctx.lineTo(cw, y);
      }
      ctx.stroke();
    }
  }

  /* ── calipers ──────────────────────────────────────────────────────
     The rule Ric asked for: a measurement next to everything. Every object
     big enough to have a shape gets a bracket around the exact dimension
     its caption is quoting — the width for the lakes, the height for the
     tree, the diameter for a sphere, the gap for a distance.

     When the object is wider than the window the bracket runs off both
     sides and the ends become arrows, because a caliper that quietly
     stops at the edge of the screen is measuring the screen. */
  /* Where a horizontal caliper's line can go without landing on one that
     is already down.

     This used to be `row * 30` — the first caliper at its natural height,
     the second thirty pixels lower, and so on. That assumed every caliper
     starts from the same place, and they do not: each one hangs off the
     bottom edge of its own object, and a smaller object's edge is already
     higher up. At the Sun the Moon's orbit came out thirty-one pixels
     above the Sun, so adding thirty to it put it one pixel away — two
     names and two measurements printed on top of each other, and, now
     that the names are buttons, two tap targets in the same place.

     So: take the natural height, and step down until nothing is within
     `gap` of it. If that runs out of room before the dock, step up from
     the natural height instead. */
  function placeCaliper(base, taken, floor) {
    const gap = 40;
    const clear = (y) => !taken.some((t) => Math.abs(t - y) < gap);
    base = Math.min(base, floor);
    for (let y = base; y <= floor; y += gap) if (clear(y)) return y;
    for (let y = base - gap; y >= bandTop + 24; y -= gap) if (clear(y)) return y;
    return base;
  }

  function caliper(o, sx, sy, wpx, hpx, alpha, taken) {
    const vertical = o.box[1] === 1 && o.box[0] !== 1;
    const ink = (a) => "rgba(226,228,236," + a * alpha + ")";
    ctx.lineWidth = 1;
    ctx.font = "600 10px " + MONO;
    ctx.textBaseline = "alphabetic";

    if (!vertical) {
      // Never under the dock: a measurement you cannot read is decoration.
      const y = placeCaliper(sy + hpx / 2 + 18, taken, bandBot - 20);
      taken.push(y);
      let a = sx - wpx / 2, b = sx + wpx / 2;
      const clipA = a < 8, clipB = b > cw - 8;
      a = Math.max(a, 8); b = Math.min(b, cw - 8);
      if (b - a < 3) return null;
      ctx.strokeStyle = ink(0.55);
      ctx.beginPath();
      ctx.moveTo(a, y); ctx.lineTo(b, y);
      if (clipA) { ctx.moveTo(a + 7, y - 5); ctx.lineTo(a, y); ctx.lineTo(a + 7, y + 5); }
      else { ctx.moveTo(a, y - 6); ctx.lineTo(a, y + 6); }
      if (clipB) { ctx.moveTo(b - 7, y - 5); ctx.lineTo(b, y); ctx.lineTo(b - 7, y + 5); }
      else { ctx.moveTo(b, y - 6); ctx.lineTo(b, y + 6); }
      ctx.stroke();
      const mx = Math.min(cw - 8, Math.max(8, (a + b) / 2));
      ctx.textAlign = "center";
      ctx.fillStyle = ink(0.95);
      ctx.fillText(U.length(o.size) + "  " + o.dim, mx, y + 15);
      // The name is not painted. It is a button, placed here by syncHits().
      return [mx, y - 14, "center"];
    }

    let x = sx + wpx / 2 + 18;
    x = Math.min(x, cw - 120);
    let a = sy - hpx / 2, b = sy + hpx / 2;
    const clipA = a < bandTop, clipB = b > bandBot;
    a = Math.max(a, bandTop); b = Math.min(b, bandBot);
    if (b - a < 3) return null;
    ctx.strokeStyle = ink(0.55);
    ctx.beginPath();
    ctx.moveTo(x, a); ctx.lineTo(x, b);
    if (clipA) { ctx.moveTo(x - 5, a + 7); ctx.lineTo(x, a); ctx.lineTo(x + 5, a + 7); }
    else { ctx.moveTo(x - 6, a); ctx.lineTo(x + 6, a); }
    if (clipB) { ctx.moveTo(x - 5, b - 7); ctx.lineTo(x, b); ctx.lineTo(x + 5, b - 7); }
    else { ctx.moveTo(x - 6, b); ctx.lineTo(x + 6, b); }
    ctx.stroke();
    const my = (a + b) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = ink(0.95);
    ctx.fillText(U.length(o.size) + "  " + o.dim, x + 10, my + 4);
    return [x + 10, my - 14, "left"];
  }

  /* ── the names, which are also the way back ────────────────────────
     Every caliper the canvas draws gets a real <button> sitting on its
     name, so clicking "THE SUN" under the Sun's bracket flies you to the
     Sun. Most of the time the labels near the middle of the frame are
     rungs you have already passed, which makes this the fast way back —
     the arrows only walk.

     A pool, reused in place. The set of labelled rungs changes a few
     times a minute but their positions change every frame, so the text
     is only rewritten when the button changes which rung it stands for,
     and the per-frame work is one transform and one opacity each. No
     layout is read, and there are rarely more than three on screen.

     Painting the name into the canvas and hit-testing it would have been
     less code and worse: it would need its own hover state, its own
     cursor, its own rectangle arithmetic, and it would still be invisible
     to a keyboard and to a screen reader. */
  const hitPool = [];
  function syncHits(list) {
    for (let i = 0; i < list.length; i++) {
      let b = hitPool[i];
      if (!b) {
        b = document.createElement("button");
        b.type = "button";
        b.className = "hit";
        // stopTour() alongside glideTo(), the same pairing the chips, the
        // menu rows and the step arrows use: glideTo does not cancel the
        // tour on its own, and a tour you have to fight is worse than none.
        b.addEventListener("click", () => {
          const k = Number(b.dataset.k);
          if (k >= 0 && k < N) { stopTour(); glideTo(k); }
        });
        $("hits").appendChild(b);
        hitPool.push(b);
      }
      const [k, x, y, align, alpha] = list[i];
      if (b.dataset.k !== String(k)) {
        b.dataset.k = String(k);
        // Proper case in the DOM, uppercased in CSS: a screen reader
        // handed "THE SUN" is entitled to read it out as three letters.
        b.textContent = L[k].name;
        b.setAttribute("aria-label", "Zoom to " + L[k].name);
      }
      // The left-aligned anchor is where the glyphs start, and the button
      // carries 16px of padding in front of them.
      const ox = align === "center" ? x : x - 16;
      b.style.transform = "translate(" + Math.round(ox) + "px," + Math.round(y) + "px) " +
        (align === "center" ? "translate(-50%,-50%)" : "translate(0,-50%)");
      // Never fully faint: the label is a control, and a control you can
      // barely see is one nobody will try.
      b.style.opacity = Math.max(0.45, alpha).toFixed(2);
      b.hidden = false;
    }
    for (let i = list.length; i < hitPool.length; i++) hitPool[i].hidden = true;
  }

  /* ── the frame ─────────────────────────────────────────────────────── */
  function draw(clock) {
    const cam = camera(S.t);
    const scale = cw / cam.w;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, cw, ch);
    /* The sky first, and it converges on the same point the objects do —
       see src/sky.js. It goes under the grid rather than over it: the
       grid is faint enough already without a starfield competing with
       it for the same 5% of alpha. */
    SKY.draw(ctx, cw, ch, cw / 2, (bandTop + bandBot) / 2, cam.w, clock);
    drawGrid(cam, scale);

    /* Biggest first, so the smaller rungs land on top.
       This is not a detail. In a zoom that converges on the centre, every
       rung you have already visited ends up inside the one you are
       looking at now — so painting in ladder order buries the Earth under
       the Sun and the exhibit loses the only thing it was showing you.
       Reversed, the Earth stays a visible speck on the Sun's face, which
       is the correct picture and the whole point. */
    const labels = [];
    const wake = wakeOf(clock);
    for (let k = N - 1; k >= 0; k--) {
      const o = L[k];
      const wpx = o.size * o.box[0] * scale;
      const hpx = o.size * o.box[1] * scale;
      const dpx = o.size * scale;
      const big = Math.max(wpx, hpx);
      const sx = OFF[k][0] * scale + cw / 2;
      const sy = OFF[k][1] * scale + (bandTop + bandBot) / 2;
      if (big < 0.45) continue;
      if (sx + big / 2 < -80 || sx - big / 2 > cw + 80) continue;
      if (sy + big / 2 < -80 || sy - big / 2 > ch + 80) continue;
      // Larger than any canvas operation should be asked to handle, and by
      // then the object has already been culled for being off to one side.
      if (dpx > 26000) continue;

      const foc = focusOf(k, S.t);
      const arrive = arriveOf(k, S.t);
      const alpha = 0.06 + 0.94 * arrive;
      if (big < 3.5) {
        ctx.fillStyle = o.tint;
        ctx.globalAlpha = alpha * Math.min(1, 0.35 + big / 3.5);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.55, big / 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(sx, sy);
        ctx.scale(dpx, dpx);
        try { PAINT[o.id](ctx, clock, foc, k === S.settledOn ? wake : 0); }
        catch (e) { /* never kill the loop */ }
        ctx.restore();
      }

      // A caliper on a rung that has not arrived yet is a measurement of
      // something the visitor cannot see.
      const worth = arrive > 0.3 && (dpx >= 16 || (foc > 0.3 && dpx >= 5));
      if (worth) labels.push([o, sx, sy, wpx, hpx, Math.min(1, 0.3 + 0.7 * foc) * arrive, k]);
    }
    // Stacked rather than overlapped when two calipers land on the same
    // line, and the rung you are actually on gets the top row.
    labels.sort((a, b) => b[5] - a[5]);
    const taken = [];
    const hits = [];
    for (const [o, sx, sy, wpx, hpx, alpha, k] of labels) {
      const at = caliper(o, sx, sy, wpx, hpx, alpha, taken);
      if (at) hits.push([k, at[0], at[1], at[2], alpha]);
    }
    syncHits(hits);

    // A vignette, so the instruments have something to sit on at the edges.
    const my = (bandTop + bandBot) / 2;
    const v = ctx.createRadialGradient(cw / 2, my, Math.min(cw, ch) * 0.34, cw / 2, my, Math.max(cw, ch) * 0.78);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, cw, ch);
  }

  /* ── the readouts ────────────────────────────────────────────────────
     One line, always. Both of the numbers in the cluster change length as
     their unit rolls over — "865,000 km" becomes "20 AU" becomes
     "100 thousand light-years" — and a box that grows a row taller and
     shorter shifts the scale bar and the fact card under it every time.
     So: never wrap, and shrink the type instead.

     The refit only runs when the string changes length, because the face
     is monospaced with tabular figures: the same number of characters is
     the same number of pixels, exactly. The floor is the house minimum of
     11px, below which the clip would be the better outcome. */
  function setFitted(el, text, floor) {
    const key = text.length + ":" + el.clientWidth;
    if (el.dataset.fit === key) { el.textContent = text; return; }
    el.dataset.fit = key;
    el.textContent = text;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (size > floor && el.scrollWidth > el.clientWidth + 1) {
      size = Math.max(floor, size - 1);
      el.style.fontSize = size + "px";
    }
  }

  /* The round number is chosen from a target *pixel* length, not from a
     fraction of the frame. Both give a round number; only this one bounds
     how long the bar can come out. Aiming at 96 px, the 1-2-5-10 rounding
     can never land outside 55–137 px, which is what keeps the bar and its
     label inside the panel at every one of the forty-five decades. */
  function paintScaleBar(cam) {
    const want = (84 / cw) * cam.w;
    const e = Math.pow(10, Math.floor(Math.log10(want)));
    const m = want / e;
    const nice = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
    $("scalebar-fill").style.width = Math.round((nice / cam.w) * cw) + "px";
    $("scalebar-label").textContent = U.length(nice);
  }

  /* "This frame holds …" — the two comparisons that actually land. One is
     always you, because you are the only object on the ladder the visitor
     has a body-sense of. The other is whichever rung is coarse enough to
     be countable and fine enough not to be 1. */
  let compareKey = "";
  function paintCompare(cam) {
    const rows = [];
    const you = L.find((o) => o.id === "you");
    if (cam.w >= you.size) rows.push([U.count(cam.w / you.size), "of you, end to end"]);
    else rows.push([U.count(you.size / cam.w), "frames like this fit across you"]);

    let ref = null;
    for (const o of L) {
      if (o.id === "you") continue;
      if (o.size <= cam.w / 40 && (!ref || o.size > ref.size)) ref = o;
    }
    if (ref) rows.push([U.count(cam.w / ref.size), "× " + ref.name.replace(/^(The|An|A) /, "")]);

    // Rebuilt only when the words change. Both of these roll continuously
    // while you drag, and re-parsing HTML sixty times a second to move one
    // digit is how a page like this eats a laptop battery.
    const html = rows
      .map(([n, s]) => '<span class="row"><b class="num">' + n + "</b> " + s + "</span>")
      .join("");
    if (html === compareKey) return;
    compareKey = html;
    $("compare").innerHTML = html;
  }

  /* Which chip is lit, and — since the chip strip is a single sideways row
     of twenty-two — keeping the lit one in view. Guarded on the value, not
     run every frame: this touches 42 elements and forces a scroll, and the
     answer changes a few times a minute. */
  let markedRung = -2;
  function markRung(k) {
    if (k === markedRung) return;
    markedRung = k;
    const chips = $("rungs").children, rows = $("menu-list").children;
    for (let i = 0; i < chips.length; i++) {
      chips[i].setAttribute("aria-pressed", String(i === k));
      rows[i].setAttribute("aria-current", i === k ? "true" : "false");
    }
    if (k >= 0 && chips[k].scrollIntoView) {
      chips[k].scrollIntoView({ inline: "center", block: "nearest",
        behavior: reduced.matches ? "auto" : "smooth" });
    }
  }

  function paintReadouts() {
    const cam = camera(S.t);
    const k = nearestRung(S.t);
    const o = L[k];
    const foc = focusOf(k, S.t);

    $("obj-kicker").textContent = foc > 0.35 ? o.kicker : "Between rungs";
    $("obj-name").textContent = o.name;
    setFitted($("obj-measure"), U.length(o.size), 11);
    $("obj-dim").textContent = o.dim;
    $("obj-alt").textContent = o.alt;
    $("obj-name").style.opacity = $("obj-measure").style.opacity =
      $("obj-dim").style.opacity = $("obj-alt").style.opacity = (0.4 + 0.6 * foc).toFixed(2);

    $("power-out").textContent = U.decade(cam.w);
    $("power-near").textContent = foc > 0.3 ? "≈ " + o.name.toLowerCase() : "";

    paintScaleBar(cam);
    paintCompare(cam);
    markRung(foc > 0.5 ? k : -1);
    markSteps(k);

    if (foc > 0.5) {
      $("rung-lede").textContent = o.lede;
    } else {
      const seg = segment(S.t);
      $("rung-lede").textContent = "Between " + L[seg - 1].name.toLowerCase() + " and " + L[seg].name.toLowerCase() + ".";
    }
  }

  function collapseFact() {
    if ($("fact").hidden) return;
    $("fact").hidden = true;
    $("rung-note").setAttribute("aria-expanded", "false");
    measureBand();
  }

  /* The rest of the caption. Loaded when the rail actually stops — the
     rungs are close enough together that rewriting it on every one you
     pass through is a strobe rather than a caption, the same reasoning as
     the checkpoints on the speed exhibit.

     It loads but does not open. Arriving somewhere new should not shove a
     paragraph in front of the thing you just arrived at; the sentence
     under the arrows says where you are, and the paragraph is there for
     whoever wants it. */
  function paintFact(now) {
    const k = nearestRung(S.t);
    const foc = focusOf(k, S.t);
    const still = now - S.lastInput > 400;

    if (S.settledOn === k) {
      if (foc < 0.3) { S.settledOn = -1; collapseFact(); }
      return;
    }
    if (!(still && foc > 0.55)) return;

    const o = L[k];
    S.settledOn = k;
    S.wokeAt = (now - S.started) / 1000;
    $("fact-body").innerHTML = o.fact;
    const cav = $("fact-caveat");
    cav.hidden = !o.caveat;
    if (o.caveat) cav.textContent = o.caveat;
    // A new rung is a new caption, so it closes.
    collapseFact();
    $("live-region").textContent = o.name + ". " + U.length(o.size) + " " + o.dim + ". " + o.lede;
  }

  function wireFact() {
    $("rung-note").addEventListener("click", () => {
      const open = $("fact").hidden;
      $("fact").hidden = !open;
      $("rung-note").setAttribute("aria-expanded", String(open));
      measureBand();
    });
  }

  /* ── the loop ──────────────────────────────────────────────────────── */
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const clock = reduced.matches ? 0 : (now - S.started) / 1000;

    if (S.target !== null) {
      const f = S.glideMs > 0 ? clamp01((now - S.glideStart) / S.glideMs) : 1;
      const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      S.t = S.from + (S.target - S.from) * e;
      syncRail();
      if (f >= 1) { S.t = S.target; S.target = null; S.lastInput = now - 1000; }
    }

    if (reduced.matches && now - last < 60 && S.target === null && now - S.lastInput > 900) {
      paintFact(now);
      return;
    }
    last = now;
    draw(clock);
    paintReadouts();
    paintFact(now);
  }

  /* ── setting t ─────────────────────────────────────────────────────── */
  /* Every manual control writes `t` through here, which is why the tour
     is cancelled here rather than in each of them — the arrows, a chip,
     the rail and the arrow keys all mean "I am steering now". */
  function setT(t, why) {
    stopTour();
    S.t = clamp01(t);
    S.target = null;
    S.lastInput = performance.now();
    if (why !== "rail") syncRail();
    save();
  }

  function glideTo(k) {
    const decades = Math.abs(Math.log10(L[k].size) - Math.log10(camera(S.t).w / 3));
    S.from = S.t;
    S.target = T[k];
    S.glideStart = performance.now();
    S.glideMs = reduced.matches ? 1 : Math.max(480, Math.min(1700, 190 * decades + 320));
    S.lastInput = performance.now();
    save();
  }

  function syncRail() {
    const rail = $("zoom");
    rail.value = String(Math.round(S.t * 10000));
    rail.style.setProperty("--p", S.t.toFixed(4));
  }

  /* ── input ─────────────────────────────────────────────────────────
     Every way in writes the same `t`, and all of them are controls: the
     arrows, the chip strip, the rungs sheet, the arrow keys, the tour,
     and the rail along the bottom edge.

     THE PICTURE ITSELF IS NOT AN INPUT. Neither the wheel nor a drag
     moves you, and both were removed rather than never built, so it is
     worth writing down why.

     A scroll gesture over a picture means "I am reading this page" far
     more often than it means "take me forty decades outward", and a drag
     is worse: the natural thing to do with a wide-looking image is push
     it sideways, and this exhibit does not pan — so the gesture that
     feels like it should slide the view instead walked you off the rung
     you were reading about, with the fact card vanishing mid-sentence
     because it only shows once the rail has stopped. Two-finger drift on
     a trackpad was enough to do it with nobody meaning anything at all.

     So the field is inert on purpose, and the cursor over it stays a
     plain arrow: a grab cursor on a surface that cannot be grabbed is
     the interface telling a lie about itself. */
  function wireRail() {
    const rail = $("zoom");
    rail.addEventListener("input", () => {
      rail.style.setProperty("--p", (rail.value / 10000).toFixed(4));
      setT(rail.value / 10000, "rail");
    });
    rail.addEventListener("pointerdown", () => rail.classList.add("by-pointer"));
    rail.addEventListener("keydown", () => rail.classList.remove("by-pointer"));
    rail.addEventListener("blur", () => rail.classList.remove("by-pointer"));
  }

  function wireKeys() {
    document.addEventListener("keydown", (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!$("info-sheet").hidden || !$("welcome").hidden) return;
      const k = nearestRung(S.t);
      switch (e.key) {
        case "ArrowRight": case "ArrowUp": setT(S.t + (e.shiftKey ? 0.02 : 0.005)); break;
        case "ArrowLeft": case "ArrowDown": setT(S.t - (e.shiftKey ? 0.02 : 0.005)); break;
        case "PageDown": glideTo(Math.min(N - 1, (T[k] <= S.t + 1e-6 ? k + 1 : k))); break;
        case "PageUp": glideTo(Math.max(0, (T[k] >= S.t - 1e-6 ? k - 1 : k))); break;
        case "Home": glideTo(0); break;
        case "End": glideTo(N - 1); break;
        default: return;
      }
      e.preventDefault();
    });
  }

  /* ── the rung pickers ──────────────────────────────────────────────
     Two of them, and they are the same list twice: chips under the rail
     where there is room for twenty-two of them, and a sheet behind a
     button where there is not. Both call glideTo(), so picking a rung
     flies you there rather than cutting — the journey between two rungs
     is most of what this exhibit has to say. */
  function buildPickers() {
    const chips = $("rungs");
    const list = $("menu-list");
    L.forEach((o, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.k = k;
      b.textContent = o.name.replace(/^(The|An|A) /, "");
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => { stopTour(); glideTo(k); });
      chips.appendChild(b);

      const r = document.createElement("button");
      r.type = "button";
      r.dataset.k = k;
      r.className = "menu-row";
      r.innerHTML = '<span class="t">' + o.name + '</span><span class="m num">' +
        U.length(o.size) + "</span>";
      r.addEventListener("click", () => { stopTour(); glideTo(k); setMenu(false); });
      list.appendChild(r);
    });
  }

  /* ── stepping ──────────────────────────────────────────────────────
     One rung at a time, and always to a rung you are not already on.
     Sitting a hair past a rung's centre and pressing "next" should go to
     the next one, not snap backwards onto the one you can already see —
     hence the epsilon rather than a bare comparison. */
  function stepRung(dir) {
    const k = nearestRung(S.t);
    let next = k;
    if (dir > 0) next = (T[k] <= S.t + 1e-6) ? k + 1 : k;
    else next = (T[k] >= S.t - 1e-6) ? k - 1 : k;
    next = Math.max(0, Math.min(N - 1, next));
    if (next !== k || Math.abs(S.t - T[k]) > 1e-6) glideTo(next);
  }

  /* The arrows' own readout, on the widths where the chip strip is gone.
     Guarded on the value: this runs every frame and writes two text nodes,
     and the answer changes a few times a minute. */
  let steppedTo = -2;
  function markSteps(k) {
    $("step-prev").disabled = k <= 0 && S.t <= 1e-6;
    $("step-next").disabled = k >= N - 1 && S.t >= 1 - 1e-6;
    if (k === steppedTo) return;
    steppedTo = k;
    $("step-count").textContent = (k + 1) + " / " + N;
    $("step-name").textContent = L[k].name;
  }

  function wireSteps() {
    $("step-prev").addEventListener("click", () => { stopTour(); stepRung(-1); });
    $("step-next").addEventListener("click", () => { stopTour(); stepRung(1); });
  }

  /* ── scrolling the strip ───────────────────────────────────────────
     The chip strip is a horizontal scroller holding all twenty-two names,
     and browsing it is the one thing it could not do. A vertical wheel
     over a horizontally-overflowing box scrolls nothing in any browser,
     and a trackpad's sideways swipe is the only gesture that ever worked
     — so with a mouse the names past the edge of the strip were simply
     unreachable except by stepping the whole exhibit through them.

     Whichever axis the gesture is mostly on now moves the strip. This is
     not the wheel-to-zoom that was deliberately removed from the field:
     it never touches `t`, it never cancels the tour, and it only acts on
     a box that was already a scroll container. Scrolling a list is what
     the gesture means when it is over a list.

     preventDefault only when the strip actually moved, so a gesture at
     either end is left alone rather than swallowed. */
  function wireStrip() {
    const strip = $("rungs");
    strip.addEventListener("wheel", (e) => {
      if (e.ctrlKey) return;                       // leave browser zoom alone
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!raw) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? strip.clientWidth : 1;
      const before = strip.scrollLeft;
      strip.scrollLeft = before + raw * unit;
      if (strip.scrollLeft !== before) e.preventDefault();
    }, { passive: false });
  }

  /* ── the tour ──────────────────────────────────────────────────────
     Walks the ladder and waits at each rung. The wait is the point: the
     fact card only appears once the rail has actually stopped, and the
     arrival beat needs somewhere to happen, so a tour that slid
     continuously would show you none of what it came to show.

     Any manual input cancels it. A tour you have to fight is worse than
     no tour, and every other control on this page writes `t` directly —
     so rather than have each of them remember to stop, `setT` does it. */
  const TOUR_HOLD = 5200;
  function tourTick() {
    if (!S.touring) return;
    const k = nearestRung(S.t);
    if (k >= N - 1) { stopTour(); return; }
    glideTo(k + 1);
    S.tourTimer = setTimeout(tourTick, TOUR_HOLD + S.glideMs);
  }

  function startTour() {
    if (S.touring) return;
    S.touring = true;
    $("play").setAttribute("aria-pressed", "true");
    $("play").setAttribute("aria-label", "Pause the tour");
    // From the far end, a tour has nowhere to go but back to the start.
    if (nearestRung(S.t) >= N - 1) { glideTo(0); S.tourTimer = setTimeout(tourTick, TOUR_HOLD + S.glideMs); }
    else tourTick();
  }

  function stopTour() {
    if (!S.touring) return;
    S.touring = false;
    clearTimeout(S.tourTimer);
    $("play").setAttribute("aria-pressed", "false");
    $("play").setAttribute("aria-label", "Play the tour");
  }

  function wireTour() {
    $("play").addEventListener("click", () => (S.touring ? stopTour() : startTour()));
  }

  function setMenu(open) {
    $("menu").hidden = !open;
    $("menu-open").setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
    if (open) $("menu-list").firstChild.focus();
    else $("menu-open").focus();
  }

  function wireMenu() {
    $("menu-open").addEventListener("click", () => setMenu($("menu").hidden));
    $("menu-close").addEventListener("click", () => setMenu(false));
    $("menu").addEventListener("click", (e) => { if (e.target === $("menu")) setMenu(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("menu").hidden) { e.preventDefault(); setMenu(false); }
    });
  }

  /* ── the two sheets ────────────────────────────────────────────────── */
  function setWelcome(open) {
    $("welcome").hidden = !open;
    document.body.classList.toggle("welcome-open", open);
    if (open) $("welcome-go").focus();
    else { try { sessionStorage.setItem(KEY + ":seen", "1"); } catch (e) {} $("zoom").focus(); }
  }

  function wireWelcome() {
    $("welcome-go").addEventListener("click", () => setWelcome(false));
    $("welcome-x").addEventListener("click", () => setWelcome(false));
    $("welcome").addEventListener("click", (e) => { if (e.target === $("welcome")) setWelcome(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("welcome").hidden) { e.preventDefault(); setWelcome(false); }
    });
    let seen = false;
    try { seen = sessionStorage.getItem(KEY + ":seen") === "1"; } catch (e) {}
    if (!seen && !location.hash) setWelcome(true);
  }

  function setInfo(open) {
    $("info-sheet").hidden = !open;
    $("info-open").setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("sheet-open", open);
    if (open) $("info-close").focus(); else $("info-open").focus();
  }

  function wireInfo() {
    $("info-open").addEventListener("click", () => setInfo($("info-sheet").hidden));
    $("info-close").addEventListener("click", () => setInfo(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("info-sheet").hidden) { e.preventDefault(); setInfo(false); }
    });
    $("reset").addEventListener("click", () => {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      history.replaceState(null, "", location.pathname + location.search);
      setInfo(false);
      glideTo(0);
    });
  }

  /* The ladder printed out in full, in the info sheet. Every rung, its
     measurement in metres to three figures, and what that measurement is
     of — so anybody who wants to check the geometry against the drawing
     has the numbers the drawing was built from. */
  function buildTable() {
    const body = $("ladder-table");
    body.innerHTML = L.map((o, k) =>
      "<tr><th scope=\"row\">" + (k + 1) + "</th><td>" + o.name +
      "</td><td class=\"num\">" + U.sci(o.size, 3) + " m</td><td>" +
      U.length(o.size) + " " + o.dim + "</td></tr>").join("");
  }

  /* ── memory ────────────────────────────────────────────────────────── */
  function save() {
    try { sessionStorage.setItem(KEY, S.t.toFixed(5)); } catch (e) {}
  }

  function restore() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (id) {
      const k = L.findIndex((o) => o.id === id);
      if (k >= 0) { S.t = T[k]; return; }
    }
    let v = null;
    try { v = sessionStorage.getItem(KEY); } catch (e) {}
    const n = parseFloat(v);
    if (isFinite(n)) S.t = clamp01(n);
  }

  /* ── go ────────────────────────────────────────────────────────────── */
  function start() {
    // Pickers first: resize() measures the dock, and a dock with no chips
    // in it yet measures short.
    buildPickers();
    buildTable();
    resize();
    restore();
    syncRail();
    wireRail();
    wireSteps();
    wireStrip();
    wireTour();
    wireKeys();
    wireMenu();
    wireFact();
    wireWelcome();
    wireInfo();
    addEventListener("resize", resize);
    addEventListener("orientationchange", () => setTimeout(resize, 120));
    reduced.addEventListener("change", () => { S.lastInput = performance.now(); });
    S.started = performance.now();
    S.lastInput = performance.now();
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
