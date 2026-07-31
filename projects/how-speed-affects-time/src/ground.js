/* ══════════════════════════════════════════════════════════════════════
   ground.js — the forest you leave, and the one you come back to.

   The exhibit is bookended. It opens on a dark hillside with trees against
   the sky, the way anyone who has ever looked up already knows it, and it
   ends in the same frame. Everything in between is what happens when you
   take the air away and then go fast.

   The through-line is that every stage removes one more thing standing
   between your eye and the universe:

     on the ground   haze, the glow of a town, air soft enough to blur stars
     3 km            the worst of the haze gone
     12 km           above the weather; the softness goes out of the stars
     30 km           the air stops moving the light around at all
     100 km          through the airglow, and the background is finally black

   Nobody expects the sky to get *denser* as you leave it — the intuition is
   that space is emptier — and that reversal is the best thing in the climb.

   What this file draws is a silhouette and some veils of light. It is
   scenery, not physics, and it says so: the star field behind it is the
   same catalogue and the same transform at every altitude. The only thing
   altitude changes is how much atmosphere is in the way.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const SPACE_KM = 100;      // through the airglow layer; the sky goes true black
  const TOP_KM = 120;        // where the climb is called finished

  /* ── the skyline ───────────────────────────────────────────────────
     Generated rather than hand-drawn, from a fixed seed, so it is a
     believable ragged treeline instead of a row of identical triangles —
     and so it is the *same* treeline every time, which is the whole point
     of a bookend. */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* ── one spruce, in its own coordinates ────────────────────────────
     Built with the base at the origin and growing along +y, then rotated
     into place. That is what lets the trees ring the frame and lean the way
     they do when you are lying on your back looking at the zenith.

     The tiers taper on a curve, so the lower skirts stay broad and the top
     closes into a leader. Stepping every tier in by the same fraction is
     what draws obelisks instead of trees. */
  function spruceLocal(w, h, rand) {
    // Many small irregular branch tips rather than a few big tiers. Six tiers
    // draws a pagoda; twenty ragged ones draws a tree.
    const n = 15 + Math.floor(rand() * 9);
    const lean = (rand() - 0.5) * w * 0.3;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const taper = Math.pow(1 - t, 1.2);
      const cx = lean * t * t;
      const y0 = h * t;
      const y1 = h * (t + 0.62 / n);
      left.push([cx - taper * (w / 2) * (0.68 + rand() * 0.62), y0],
                [cx - taper * (w / 2) * 0.26, y1]);
      right.push([cx + taper * (w / 2) * (0.68 + rand() * 0.62), y0],
                 [cx + taper * (w / 2) * 0.26, y1]);
    }
    const out = [[-w * 0.10, -h * 0.04]];
    for (const p of left) out.push(p);
    out.push([lean, h]);
    for (let i = right.length - 1; i >= 0; i--) out.push(right[i]);
    out.push([w * 0.10, -h * 0.04]);
    return out;
  }

  /* Rounder and scrubbier, for the near edges. A treeline of matched
     conifers reads as a pattern; a real one is several things at once. */
  function scrubLocal(w, h, rand) {
    const n = 9;
    const out = [[-w / 2, 0]];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n);
      out.push([-Math.cos(a) * w * (0.5 + rand() * 0.24),
                Math.sin(a) * h * (0.78 + rand() * 0.4)]);
    }
    out.push([w / 2, 0]);
    return out;
  }

  /* Plant a tree at a point on the frame's edge, tilted so it grows inward.
     angle 0 is straight up the screen; positive leans clockwise. */
  function plant(local, bx, by, angle, out) {
    const c = Math.cos(angle), s = Math.sin(angle);
    for (const [lx, ly] of local) {
      out.push([bx + lx * c + ly * s, by + lx * s - ly * c]);
    }
  }

  /* ── the clearing ──────────────────────────────────────────────────
     You are on your back looking straight up, so the trees are not a
     skyline along the bottom of the picture — they stand all around you and
     lean out of frame, and the sky is the hole they leave in the middle.
     Every trunk is tilted away from the centre by how far round the edge it
     stands, which is what a canopy does when you look up through it. */
  function skylinePath(W, H, seed) {
    const rand = rng(seed);
    const pts = [];
    const cx = W / 2;
    const splay = 0.62;                 // how hard the canopy leans outward

    // Along the bottom, all the way across and a little past both ends.
    let x = -W * 0.08;
    while (x < W * 1.08) {
      const w = 78 + rand() * 120;
      const near = rand() < 0.30;                  // a few stand right over you
      const h = (H * 0.30 + rand() * H * 0.34) * (near ? 1.7 : 1);
      const u = (x + w / 2 - cx) / (W / 2);        // −1 at the left edge
      const angle = u * splay + (rand() - 0.5) * 0.14;
      const local = rand() < 0.20
        ? scrubLocal(w * 0.9, h * 0.5, rand)
        : spruceLocal(w, h, rand);
      pts.push([x - w, H + H * 0.2]);
      plant(local, x + w / 2, H * 1.02, angle, pts);
      pts.push([x + w * 1.6, H + H * 0.2]);
      x += w * (0.30 + rand() * 0.30);
    }

    // Up both sides, leaning hard into frame, so the canopy closes around
    // the opening instead of stopping at the corners.
    for (const side of [-1, 1]) {
      let y = H * 1.02;
      while (y > H * 0.10) {
        const w = 70 + rand() * 90;
        const h = W * (0.13 + rand() * 0.16);
        const bx = side < 0 ? -W * 0.02 : W * 1.02;
        const angle = side * (1.06 + rand() * 0.32);
        pts.push([bx + side * w, y + h]);
        plant(spruceLocal(w, h, rand), bx, y, angle, pts);
        pts.push([bx + side * w, y - h]);
        y -= h * (0.42 + rand() * 0.34);
      }
    }

    // Close the shape below the frame so the fill is a solid mass of ground.
    pts.push([W + W * 0.2, H + H * 0.25], [-W * 0.2, H + H * 0.25]);
    return "M" + pts.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z";
  }

  /* ── how much air is left ──────────────────────────────────────────
     One number in, several veils out. Each of these fades on its own
     schedule because each of them physically stops at a different height:
     turbulence gives out long before airglow does. */
  function veils(altKm) {
    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    // A tree here is seventy feet — twenty-one metres — and that is the only
    // scale bar the opening frame has. Everything about how fast the canopy
    // leaves follows from it: eight tree-heights up, the leaders are already
    // below you and the forest is a texture on the ground rather than a
    // silhouette against the sky. Fading it over two kilometres meant that
    // half a mile up, thirty-eight tree-heights, you could still see branches.
    const TREE_KM = 70 * 0.3048 / 1000;
    const ground = clamp01(1 - altKm / (TREE_KM * 8));

    // Haze and the glow of a town on the horizon: the first thing to go, but
    // it survives a good deal higher than the trees do.
    const haze = clamp01(1 - altKm / 16);

    // Scintillation. Purely atmospheric, essentially gone by 30 km, and the
    // moment the stars lock still is the moment this stops being a picture
    // of the sky and starts being a place.
    const seeing = clamp01(1 - altKm / 26);

    // Airglow. Survives highest of all — it is why the background from low
    // orbit is not quite black, and it peaks in the layer you pass through
    // on the way out.
    const airglow = clamp01(1 - altKm / SPACE_KM);

    return { ground, haze, seeing, airglow };
  }

  function Ground(root) {
    this.root = root;
    this.el = {
      wrap: root.querySelector(".sky-ground"),
      trees: root.querySelector(".sky-trees"),
      haze: root.querySelector(".sky-haze"),
      glow: root.querySelector(".sky-glow"),
      heat: root.querySelector(".sky-heat"),
    };
    this.lastSig = "";
    // No silhouette in assets/ yet, or it failed to load: the climb still
    // works, you just start above the trees instead of under them. The
    // already-broken case has to be checked as well as the event, because
    // the image starts loading before this constructor runs.
    const trees = this.el.trees;
    if (trees && trees.tagName === "IMG") {
      const drop = () => { trees.style.display = "none"; };
      trees.addEventListener("error", drop);
      if (trees.complete && trees.naturalWidth === 0) drop();
    }
  }

  /**
   * @param {number} altKm      how high the ship is
   * @param {number} heat       0–1, re-entry glow
   */
  Ground.prototype.paint = function (altKm, heat) {
    const v = veils(altKm);
    // Only touch the DOM when something actually moved. At cruise this is a
    // no-op every frame, which is the common case.
    const sig = [v.ground, v.haze, v.seeing, v.airglow, heat]
      .map((n) => n.toFixed(3)).join(",");
    if (sig === this.lastSig) return;
    this.lastSig = sig;

    const e = this.el;
    e.wrap.style.opacity = v.ground > 0 || v.haze > 0 || heat > 0 ? "1" : "0";

    /* You are going straight up, so the canopy does not slide down the
       screen — it opens outward. Everything you are rising past spreads
       radially away from the middle of the view and leaves round the edges,
       which is what looking up out of a clearing actually does. */
    const away = 1 - v.ground;
    e.trees.style.transform = "scale(" + (1 + away * 2.6).toFixed(3) + ")";
    e.trees.style.opacity = Math.pow(v.ground, 0.75).toFixed(3);

    e.haze.style.opacity = (v.haze * 0.88).toFixed(3);
    e.glow.style.opacity = (v.airglow * 0.5).toFixed(3);
    e.heat.style.opacity = heat.toFixed(3);

  };

  Ground.SPACE_KM = SPACE_KM;
  Ground.TOP_KM = TOP_KM;
  Ground.veils = veils;
  window.HSAT_Ground = Ground;
})();
