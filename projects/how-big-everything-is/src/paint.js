/* ══════════════════════════════════════════════════════════════════════
   The painters.

   One per rung. Every one of them draws into the same normalized box:
   the context arrives already translated to the object's centre and
   scaled so that **1 unit is the dimension the caption is measuring.**
   So a painter never knows how many pixels it is being drawn at, never
   knows what the zoom is, and cannot cheat its own size — the caliper on
   screen and the shape under it are the same number by construction.

   That is the whole reason for the transform. If painters worked in
   pixels, every one of them would need its own "and this is roughly how
   big it should be" fudge, and twenty-four fudges is a diagram, not a
   measurement.

   Consequences worth stating, because they look like bugs and are not:
     · the nucleus in the hydrogen atom is drawn at true scale, which
       means it is invisible. That is what an atom is.
     · at Stephenson 2-18's frame the Sun is a quarter of a pixel, so it
       gets culled before it is drawn at all.
     · the planets in the solar system frame are smaller than the line
       weight of their own orbits. Every textbook diagram lies about this.

   ── the clock ───────────────────────────────────────────────────────
   `t` is seconds since the page opened, and it is the ONLY thing any
   motion here is allowed to read. It advances at one second per second
   whatever the rail is doing.

   `focus` — how near the rail is to this rung — is passed but must
   never touch anything that moves. It used to scale both the amplitude
   *and the rate* of every idle loop, on the theory that a frame already
   sliding sideways does not need a spinning galaxy in it. The theory
   was wrong and the implementation was worse: multiplying the argument
   of a sine by a number that is itself changing does not slow the sine
   down, it drags its phase around. Nudging the scroll wheel spun the
   Earth, whipped the DNA round, and skipped the Sun forward through its
   eruptions. The wheel was driving time.

   So: **nothing in this file multiplies `t` by anything but a
   constant.** If a rung ever needs to be quieter off-focus, dim it —
   do not slow it down.

   `wake` is the arrival beat: zero until the camera actually stops here,
   one bump, and zero again within two seconds. It is the difference
   between a destination and a slideshow — you arrive, the thing reacts
   to being arrived at, and then it settles into a loop slow enough to
   sit and watch. Painters that have nothing physical to do on arrival
   ignore it, which is most of them, and that is correct: an elephant
   flaps an ear when you walk up, a red blood cell does not know you are
   there.

   Every rung has an idle loop, and every loop is the motion the thing
   actually makes. Nothing here moves because a still picture looked
   dead — the atom's cloud shifts and does not orbit, the hypergiant
   convects and does not spin, the galaxies in the Local Group drift
   toward each other and not apart.

   Colour is the objects' alone. The interface around them is grey, white
   and black on purpose, the same rule the speed exhibit runs on: if the
   buttons are allowed to be blue, nobody can tell that the blue in the
   Earth means water.
   ══════════════════════════════════════════════════════════════════════ */
window.PAINT = (() => {
  "use strict";

  const TAU = Math.PI * 2;

  /* Deterministic noise. Every scattered field on this page — the stars in
     the galaxy, the specks in the Oort Cloud, the filaments of Laniakea —
     has to be in exactly the same place on every frame and on every visit,
     or the sky boils. Seeded, generated once, cached. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const cache = new Map();
  function once(key, build) {
    let v = cache.get(key);
    if (!v) { v = build(); cache.set(key, v); }
    return v;
  }
  /* Almost everything cached here is fixed for the life of the page. One
     thing is not: "earthaim" is derived from where the Lakes are parked
     relative to the Earth, and the parking moves when the window does —
     the layout flattens the offsets on a wide screen so the subject can
     fill more of it. Without this the globe would keep the orientation it
     was built with and Superior would drift into the Atlantic. */
  function forget(key) { cache.delete(key); }

  function ball(ctx, r, inner, mid, outer, lx, ly) {
    const g = ctx.createRadialGradient(lx * r, ly * r, 0, 0, 0, r);
    g.addColorStop(0, inner); g.addColorStop(0.55, mid); g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  }

  function glow(ctx, r, colour, stops) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [at, a] of stops) g.addColorStop(at, colour.replace("$", a));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  }

  function poly(ctx, pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) ctx.closePath();
  }

  /* A smooth closed curve through a ring of points. Used for anything with
     a coastline — the lakes, the continents — because a polygon with twelve
     vertices reads as a polygon and a spline through the same twelve reads
     as a shore. */
  function blob(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    let p0 = pts[n - 1], p1 = pts[0];
    ctx.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    ctx.closePath();
  }

  const P = {};

  /* ── 10⁻¹⁹ · a quark ─────────────────────────────────────────────────
     Same problem as the electron, and the same answer: no measured size,
     no known parts, so nothing inside. Drawn at its experimental bound
     with a dashed edge that means *we do not know where this stops*.

     What is different is the one thing worth drawing about a quark, and
     it is not the quark. Colour charge does not let go: pull on one and
     the field between it and whatever it was bound to stays taut, and
     keeps costing energy, until the energy is enough to make a fresh
     pair and you are left holding two ordinary particles instead of one
     free quark. So the tether is the picture — a flux tube running off
     the frame, always under tension, never slack, and never ending in a
     second quark you could point at. Nobody has ever seen the far end.

     The three-balls-in-a-bag version of this lives two rungs up and is
     exactly the thing that picture gets wrong. */
  P.quark = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const soft = 0.5 + 0.5 * (0.6 * Math.sin(t * 0.73) + 0.4 * Math.sin(t * 1.19 + 1.7));

    // The tube: taut, textured, and running out of the frame at both ends.
    ctx.save();
    ctx.rotate(0.55 + 0.06 * Math.sin(t * 0.21));
    const g = ctx.createLinearGradient(-2.6, 0, 2.6, 0);
    g.addColorStop(0.00, "rgba(190,140,255,0)");
    g.addColorStop(0.22, "rgba(190,140,255," + (0.16 + 0.07 * soft) + ")");
    g.addColorStop(0.50, "rgba(214,178,255," + (0.30 + 0.12 * soft + 0.2 * w) + ")");
    g.addColorStop(0.78, "rgba(190,140,255," + (0.16 + 0.07 * soft) + ")");
    g.addColorStop(1.00, "rgba(190,140,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-2.6, -0.035, 5.2, 0.07);
    // Tension, travelling along it. A string under load, not a beam.
    ctx.strokeStyle = "rgba(236,216,255," + (0.20 + 0.16 * soft) + ")";
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const x = -2.6 + (5.2 * i) / 90;
      const y = 0.016 * Math.sin(x * 5.5 - t * 1.6) * Math.exp(-Math.abs(x) * 0.34);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    glow(ctx, 0.5 * (0.94 + 0.09 * soft) * (1 + 0.5 * w), "rgba(198,150,255,$)",
      [[0, (0.66 + 0.16 * soft) * (1 + 0.4 * w)], [0.35, 0.36], [0.75, 0.10], [1, 0]]);
    const edge = 0.5 * (1 + 0.035 * Math.sin(t * 0.47 + 1.1) + 0.07 * w);
    ctx.setLineDash([0.035, 0.035]);
    ctx.lineDashOffset = -t * 0.02;
    ctx.strokeStyle = "rgba(214,186,255," + (0.40 + 0.10 * soft + 0.3 * w) + ")";
    ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.arc(0, 0, edge, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  };

  /* ── 10⁻¹⁸ · the electron ────────────────────────────────────────────
     **There is nothing inside an electron, so there is nothing inside
     this.** It is a point particle: it has charge, spin and mass and no
     measured size and no measured parts. Every experiment built to find
     an edge has come back empty, and the best of them can only say it
     is narrower than about 10⁻¹⁸ m.

     An earlier version of this had three rotating rings in it. They
     were decoration — they stood for nothing, there is no orbit, no
     shell and no axis in an electron — and drawing structure into the
     one object on the ladder that is known to have none is exactly the
     mistake the atom two rungs up refuses to make. They are gone.

     What is left is what can be said: a smudge, drawn at the
     experimental upper bound, with a dashed edge. The dashes mean *we
     do not know where this stops*, and the reason the boundary drifts
     a little is that it is a limit, not an edge — the number is where
     the experiments ran out, and a hard circle there would be a claim
     about the electron rather than a claim about the apparatus. */
  P.electron = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const soft = 0.5 + 0.5 * (
      0.55 * Math.sin(t * 0.61) + 0.30 * Math.sin(t * 0.97 + 1.1) + 0.15 * Math.sin(t * 1.53 + 2.4)
    );
    glow(ctx, 0.5 * (0.94 + 0.09 * soft) * (1 + 0.5 * w), "rgba(150,205,255,$)",
      [[0, (0.60 + 0.18 * soft) * (1 + 0.4 * w)], [0.35, 0.34], [0.75, 0.09], [1, 0]]);
    // The bound, and the fact that it is only a bound.
    const edge = 0.5 * (1 + 0.035 * Math.sin(t * 0.43 + 0.6) + 0.07 * w);
    ctx.setLineDash([0.035, 0.035]);
    ctx.lineDashOffset = t * 0.02;
    ctx.strokeStyle = "rgba(188,216,255," + (0.40 + 0.10 * soft + 0.3 * w) + ")";
    ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.arc(0, 0, edge, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  };

  /* ── 10⁻¹⁸ · a neutrino ──────────────────────────────────────────────
     The third and last of the bounds, so it gets the same grammar as the
     two beside it: a smudge at the experimental limit, a dashed edge that
     means *we do not know where this stops*, and nothing inside.

     But size is not the interesting thing about a neutrino, and drawing it
     the way the electron is drawn would say that it was. The interesting
     thing is that matter is not in its way — and the way to show that here
     is *not* to draw the matter. There is no atom that could be in this
     picture: an atom is eight decades wider than this frame, and a ring of
     them scattered round a neutrino would be the same lie as three little
     balls inside a proton. What can be drawn is the trajectory, because a
     trajectory has no size to get wrong.

     So the picture is tracks. Dead straight, all on one bearing, passing
     clean over the quark and the electron that really are in this frame at
     their real sizes, and not bending at either of them. Nothing here
     deflects, nothing collides, nothing gets absorbed. It is the only
     painter on this page that makes its point by leaving something out.

     The idle loop is the stream: a hundred trillion of these go through a
     person every second, so the frame is never down to one. Fresh tracks
     cross at odd intervals, and on arrival a whole sheet of them lights at
     once and thins back out. They are parallel because the ones going
     through you came from the Sun, and at this range the Sun is a bearing
     and not a place. */
  const NUBEAM = once("nubeam", () => {
    const r = rng(0x7a12), out = [];
    for (let i = 0; i < 16; i++) {
      out.push([(r() - 0.5) * 3.0, 0.55 + r() * 0.9, r(), 0.5 + r() * 0.7]);
    }
    return out;
  });
  P.neutrino = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const soft = 0.5 + 0.5 * (0.6 * Math.sin(t * 0.53) + 0.4 * Math.sin(t * 0.89 + 2.1));
    const AIM = 0.348;                       // the bearing they all travel on

    ctx.save();
    ctx.rotate(AIM);
    ctx.lineCap = "round";

    // The stream. Each track is a short streak running the width of the
    // frame at its own rate and wrapping on its own phase, so no two ever
    // fall into step and it never reads as a marching pattern.
    for (const [off, rate, ph, len] of NUBEAM) {
      const cyc = (t * rate * 0.06 + ph) % 1;
      const x = -2.4 + cyc * 4.8;
      const fade = Math.min(1, Math.min(cyc, 1 - cyc) * 6);
      const a = (0.06 + 0.16 * w) * fade;
      if (a < 0.004) continue;
      const g = ctx.createLinearGradient(x - len, 0, x, 0);
      g.addColorStop(0, "rgba(143,224,176,0)");
      g.addColorStop(1, "rgba(198,246,218," + a + ")");
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.004;
      ctx.beginPath(); ctx.moveTo(x - len, off); ctx.lineTo(x, off); ctx.stroke();
    }

    // The one this frame is about. Brightest where the particle is, and
    // exactly as bright on the far side as on the near one.
    const gt = ctx.createLinearGradient(-1.9, 0, 1.9, 0);
    gt.addColorStop(0.00, "rgba(143,224,176,0)");
    gt.addColorStop(0.34, "rgba(143,224,176," + (0.13 + 0.05 * soft + 0.12 * w) + ")");
    gt.addColorStop(0.50, "rgba(206,250,224," + (0.30 + 0.10 * soft + 0.22 * w) + ")");
    gt.addColorStop(0.66, "rgba(143,224,176," + (0.13 + 0.05 * soft + 0.12 * w) + ")");
    gt.addColorStop(1.00, "rgba(143,224,176,0)");
    ctx.strokeStyle = gt;
    ctx.lineWidth = 0.007;
    ctx.beginPath(); ctx.moveTo(-1.9, 0); ctx.lineTo(1.9, 0); ctx.stroke();
    ctx.restore();

    glow(ctx, 0.5 * (0.94 + 0.09 * soft) * (1 + 0.5 * w), "rgba(143,224,176,$)",
      [[0, (0.52 + 0.16 * soft) * (1 + 0.4 * w)], [0.35, 0.30], [0.75, 0.08], [1, 0]]);
    const edge = 0.5 * (1 + 0.035 * Math.sin(t * 0.37 + 2.2) + 0.07 * w);
    ctx.setLineDash([0.035, 0.035]);
    ctx.lineDashOffset = -t * 0.02;
    ctx.strokeStyle = "rgba(186,238,208," + (0.36 + 0.10 * soft + 0.3 * w) + ")";
    ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.arc(0, 0, edge, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  };

  /* ── 10⁻¹⁵ · the proton ─────────────────────────────────────────────
     **The three little balls are gone, and they should never have been
     there.** A proton does contain three valence quarks — but a quark
     is point-like, it is confined, it has never been seen on its own,
     and it does not have a position you could mark. Three coloured dots
     going round inside a circle is the same lie as an electron orbiting
     a nucleus like a planet: it draws trajectories for things that do
     not have them. The gluon strings between them were worse — flux
     tubes are real, but they are what forms between colour charges you
     are pulling *apart*, not a triangle of wires inside an intact
     proton.

     What is actually measured is this: the **charge distribution**.
     Elastic electron scattering gives the proton a dipole form factor,
     and a dipole form factor is the Fourier transform of an exponential
     — so the charge density really does fall off as e^(−Λr), and that
     is the curve drawn below, with Λ set from the measured radius by
     Λ = √12 / r_rms.

     Two consequences, and both of them are the point:

       · It has no edge. The density does not stop, it thins forever,
         which is why the caliper's ring sits well outside the bright
         part instead of around it.
       · The quoted 0.84 fm is a root-mean-square radius — a *moment*
         of that curve, not a boundary. At exactly that radius the
         density is down to about 3% of the value at the centre. The
         faint ring marks it, so you can see where the number the
         caption is quoting actually falls in the thing it describes. */
  const PCHARGE = (() => {
    // Λ·R in units where R is the glow radius drawn (0.92), and 0.5 is
    // the measured rms radius: Λ = √12 / 0.5, so Λ·R = 6.928 × 0.92.
    const LR = (Math.sqrt(12) / 0.5) * 0.92;
    const stops = [];
    for (let i = 0; i <= 12; i++) {
      const at = i / 12;
      stops.push([at, Math.exp(-LR * at)]);
    }
    stops[stops.length - 1][1] = 0;
    return stops;
  })();
  P.proton = (ctx, t, focus, wake) => {
    const w = wake || 0;
    /* It is not a static blob — most of a proton's mass is not the
       quarks at all, it is energy in a field that is never still. But
       that motion has no snapshot, so what breathes here is the whole
       distribution and nothing inside it. */
    const breath = 1 + 0.035 * Math.sin(t * 0.47) + 0.02 * Math.sin(t * 0.79 + 1.4);
    const lift = (1 + 0.35 * w);
    glow(ctx, 0.92 * breath, "rgba(255,140,90,$)",
      PCHARGE.map(([at, v]) => [at, Math.min(0.95, v * 0.9 * lift)]));
    // the measured radius, which is a moment and not a wall
    ctx.setLineDash([0.02, 0.02]);
    ctx.strokeStyle = "rgba(255,196,158," + (0.24 + 0.12 * w) + ")";
    ctx.lineWidth = 0.005;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  };

  /* ── 10⁻¹⁰ · the hydrogen atom ──────────────────────────────────────
     The nucleus is drawn at its true relative size, 1/63,000 of the
     width. On a 600-pixel atom that is a hundredth of a pixel. The
     crosshair is there so you can see where the thing you cannot see is.

     **There is no electron in this picture and there is not going to be
     one.** Every diagram that puts a ball on a ring around the nucleus
     is drawing a solar system, and a solar system is the one thing an
     atom is definitely not. What the electron has is a probability of
     being somewhere, so what moves here is the *somewhere*: five soft
     lobes of density, drifting against each other on periods that do
     not share a factor, so the cloud is never twice the same shape and
     never goes around.

     The lobes are kept inside the labelled diameter on purpose. The
     caliper is measuring the atom, and a cloud that bulged past it
     would be measuring something else. */
  const LOBES = (() => {
    const r = rng(17);
    return Array.from({ length: 5 }, () => [
      0.055 + r() * 0.115,          // how far off centre it wanders
      0.16 + r() * 0.36,            // its own rate
      r() * TAU,                    // its own phase
      0.20 + r() * 0.16,            // its own size
    ]);
  })();
  P.atom = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const b = 0.5 + 0.06 * Math.sin(t * 0.7);
    glow(ctx, b, "rgba(120,175,255,$)",
      [[0, 0.34 + 0.16 * w], [0.3, 0.22], [0.7, 0.10], [1, 0]]);
    // The shifting density. Additive, so where two lobes overlap is
    // brighter — which is what a probability density does.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const [amp, rate, ph, sz] of LOBES) {
      const d = amp;
      ctx.save();
      ctx.translate(Math.cos(t * rate + ph) * d, Math.sin(t * rate * 1.37 + ph * 1.6) * d);
      const pulse = 1 + 0.14 * Math.sin(t * rate * 2.1 + ph);
      glow(ctx, sz * b * 2 * pulse, "rgba(96,150,240,$)",
        [[0, (0.13 + 0.05 * w) * (0.7 + 0.3 * Math.sin(t * rate * 1.9 + ph))],
         [0.45, 0.06], [1, 0]]);
      ctx.restore();
    }
    ctx.restore();
    // Density contours, not orbits: they have no thickness and they
    // breathe with the cloud rather than holding a radius.
    ctx.strokeStyle = "rgba(150,190,255," + (0.11 + 0.09 * w) + ")";
    ctx.lineWidth = 0.003;
    for (let i = 1; i <= 3; i++) {
      const rr = (b * i) / 3.4 * (1 + 0.03 * Math.sin(t * 0.44 + i * 1.9));
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,150,120,.75)";
    ctx.lineWidth = 0.0035;
    ctx.beginPath();
    ctx.moveTo(-0.03, 0); ctx.lineTo(0.03, 0);
    ctx.moveTo(0, -0.03); ctx.lineTo(0, 0.03);
    ctx.stroke();
    // The nucleus itself. True scale: 1.68e-15 / 1.06e-10.
    ctx.fillStyle = "#ff8f6a";
    ctx.beginPath(); ctx.arc(0, 0, 1.585e-5 / 2, 0, TAU); ctx.fill();
  };

  /* ── 10⁻⁹ · DNA ─────────────────────────────────────────────────────
     Runs off the top and bottom of its own frame, which is correct: two
     nanometres wide and two metres long is not a shape that fits. */
  /* The idle loop is a slow rotation and a flex. Both are real: DNA in a
     cell is not a rigid rod standing to attention, it is a floppy
     polymer being shoved around by water, and it bends over lengths a
     few times its own width. The bend is deliberately kept small enough
     that the caliper still brackets the true width. */
  P.dna = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const spin = t * 0.5;
    const H = 1.9, N = 132;
    const flexA = (0.16 + 0.10 * w);
    const bend = (y) =>
      flexA * (Math.sin(y * 1.05 + t * 0.31) + 0.55 * Math.sin(y * 1.9 - t * 0.23 + 1.7));
    ctx.lineCap = "round";
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const y = -H + (2 * H * i) / N;
        const x = Math.sin(y * 5.2 + spin + s * Math.PI) * 0.5 + bend(y);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = s ? "rgba(150,130,235,.92)" : "rgba(90,215,200,.92)";
      ctx.lineWidth = 0.1;
      ctx.stroke();
    }
    for (let i = 0; i <= 44; i++) {
      const y = -H + (2 * H * i) / 44;
      const ph = y * 5.2 + spin;
      const x = Math.sin(ph) * 0.5, c = bend(y);
      if (Math.cos(ph) < -0.15) continue;    // behind the near strand
      ctx.strokeStyle = "rgba(226,232,255," + (0.2 + 0.42 * Math.cos(ph)) + ")";
      ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(-x + c, y); ctx.stroke();
    }
  };

  /* ── 10⁻⁷ · the virus ───────────────────────────────────────────────
     Suspended, so it turns. Nothing here is swimming: a virus has no
     means of moving itself at all, and every bit of motion it ever
     makes is water molecules hitting it from one side slightly more
     often than the other. Hence the drift, which has no direction it
     prefers, and the rotation, which is slower than it looks like it
     should be. */
  P.virus = (ctx, t, focus) => {
    const spikes = once("virus", () => {
      const r = rng(7);
      return Array.from({ length: 44 }, () => r() * TAU);
    });
    ctx.save();
    ctx.translate(0.028 * Math.sin(t * 0.21), 0.024 * Math.cos(t * 0.17 + 1.3));
    ctx.save();
    ctx.rotate(t * 0.16);
    ctx.strokeStyle = "rgba(210,120,110,.9)";
    ctx.lineWidth = 0.016;
    for (const th of spikes) {
      const c = Math.cos(th), s = Math.sin(th);
      ctx.beginPath();
      ctx.moveTo(c * 0.37, s * 0.37);
      ctx.lineTo(c * 0.47, s * 0.47);
      ctx.stroke();
      ctx.fillStyle = "rgba(224,140,124,.95)";
      ctx.beginPath(); ctx.arc(c * 0.485, s * 0.485, 0.018, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ball(ctx, 0.38, "#c9d6b4", "#8f9e78", "#4d5740", -0.35, -0.35);
    ctx.fillStyle = "rgba(60,70,50,.5)";
    const knots = once("virusk", () => {
      const r = rng(11);
      return Array.from({ length: 9 }, () => [(r() - 0.5) * 0.5, (r() - 0.5) * 0.5, 0.02 + r() * 0.03]);
    });
    for (const [x, y, rr] of knots) { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  /* ── 10⁻⁵ · the red blood cell ──────────────────────────────────────
     Dished, not round. That dent is the reason it works.

     Drifting and tumbling, and the tumble is what the squash is: this
     is one disc seen from an angle that keeps changing, not a disc
     being squeezed. The two periods are deliberately not the same, so
     the cell never returns to a pose it has already been in. */
  /* An actual surface, not a squashed circle. The profile is the
     biconcave disc the cell really is — dimpled to about a seventh of
     its width in the middle and bulging to a third at the shoulder —
     revolved, meshed, lit and depth-sorted, so that as it tumbles you
     see it go from a full round face to a dumbbell seen edge-on and
     back. That transition is the shape. A flat ellipse being squashed
     shows you an ellipse being squashed.

     The tumble is a nod about the horizontal, which is the one rotation
     that leaves the projected width **exactly** the diameter — the
     caliper under this frame is quoting that number, and a cell whose
     apparent width wandered with its pose would make the measurement a
     lie. The small in-plane roll on top costs about 3%, which is the
     same latitude the flat version took. */
  const RBC = (() => {
    // Enough facets that the silhouette is a curve and the flat shading
    // does not band. Under about thirty around, the dimple reads as a
    // paper fan.
    const NU = 12, NT = 36, quads = [];
    const h = (u) => 0.5 * Math.sqrt(Math.max(0, 1 - u * u)) *
      (0.13 + 1.4 * u * u - 1.533 * u * u * u * u);
    const at = (u, th, s) => [0.5 * u * Math.cos(th), 0.5 * u * Math.sin(th), s * h(u)];
    for (const s of [1, -1]) {
      for (let i = 0; i < NU; i++) {
        const u0 = i / NU, u1 = (i + 1) / NU;
        for (let j = 0; j < NT; j++) {
          const a0 = (j / NT) * TAU, a1 = ((j + 1) / NT) * TAU;
          const A = at(u0, a0, s), B = at(u1, a0, s), C = at(u1, a1, s), E = at(u0, a1, s);
          const e1 = [C[0] - B[0], C[1] - B[1], C[2] - B[2]];
          const e2 = [A[0] - B[0], A[1] - B[1], A[2] - B[2]];
          let nx = e1[1] * e2[2] - e1[2] * e2[1];
          let ny = e1[2] * e2[0] - e1[0] * e2[2];
          let nz = e1[0] * e2[1] - e1[1] * e2[0];
          const m = Math.hypot(nx, ny, nz) || 1;
          nx /= m; ny /= m; nz /= m;
          if (nz * s < 0) { nx = -nx; ny = -ny; nz = -nz; }   // point outward
          quads.push([A, B, C, E, nx, ny, nz]);
        }
      }
    }
    return quads;
  })();

  P.cell = (ctx, t, focus) => {
    // Two periods that do not share a factor, so it never repeats a pose.
    const phi = t * 0.30 + 0.6 * Math.sin(t * 0.11);
    const cf = Math.cos(phi), sf = Math.sin(phi);
    ctx.save();
    ctx.translate(0.030 * Math.sin(t * 0.19 + 0.9), 0.022 * Math.sin(t * 0.13));
    ctx.rotate(0.13 * Math.sin(t * 0.24));

    const front = [];
    for (const q of RBC) {
      const nY = q[5] * cf - q[6] * sf;
      const nZ = q[5] * sf + q[6] * cf;
      if (nZ <= 0) continue;                                  // facing away
      let z = 0;
      const pts = [];
      for (let i = 0; i < 4; i++) {
        const p = q[i];
        pts.push(p[0], -(p[1] * cf - p[2] * sf));
        z += p[1] * sf + p[2] * cf;
      }
      // Light from over the viewer's left shoulder. Screen y is down, so
      // "up" is negative — hence the sign on the middle term.
      const lam = Math.max(0, q[4] * -0.45 + -nY * -0.55 + nZ * 0.70);
      front.push([z, pts, lam]);
    }
    front.sort((p, q) => p[0] - q[0]);                        // far first

    for (const [, p, lam] of front) {
      const lum = 0.22 + 0.78 * lam;
      const spec = Math.pow(lam, 22) * 62;
      const r = Math.round(Math.min(255, 105 + 110 * lum + spec));
      const g = Math.round(Math.min(255, 22 + 40 * lum + spec));
      const b = Math.round(Math.min(255, 18 + 30 * lum + spec));
      const col = "rgb(" + r + "," + g + "," + b + ")";
      ctx.fillStyle = col;
      ctx.strokeStyle = col;                                  // seals the seams
      ctx.lineWidth = 0.0035;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]);
      ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  };

  /* ── 10⁰ · you ──────────────────────────────────────────────────────
     Off-white rather than any skin tone. This figure is whoever is
     reading, and a colour here would be a casting decision. */
  /* Breathing and a slow weight shift, which is the whole of what a
     person standing still actually does. Two periods, both taken from
     the real thing: a resting breath is about four seconds, and nobody
     stands on both feet evenly for longer than about fifteen.

     The feet do not move and the crown does not rise, because the
     caliper next to this figure is measuring its height and a person
     who breathes taller would make that number a lie. Breathing here
     is width and shoulder line only. */
  P.you = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const sway = 0.010 * Math.sin(t * 0.8);
    const breath = (0.5 + 0.5 * Math.sin(t * 1.55));
    // Weight on one hip, then the other, and the head leans the other way.
    const lean = (0.011 * Math.sin(t * 0.42) + 0.010 * w);
    const chest = 1 + 0.055 * breath;
    const rise = 0.005 * breath;
    ctx.save();
    ctx.translate(0, -0.5);              // head top at 0, feet at 1
    ctx.fillStyle = "#e9dfcd";
    ctx.strokeStyle = "#e9dfcd";
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(sway * 1.6 - lean * 0.7, 0.062 - rise, 0.062, 0, TAU); ctx.fill();
    // neck and torso, one path, so there is no seam at the collar
    ctx.beginPath();
    ctx.moveTo(-0.024 + sway * 1.4 - lean * 0.6, 0.118 - rise);
    ctx.lineTo(0.024 + sway * 1.4 - lean * 0.6, 0.118 - rise);
    ctx.lineTo(0.031 + sway * 1.3 - lean * 0.4, 0.168 - rise);
    ctx.quadraticCurveTo(0.086 * chest + sway, 0.188 - rise, 0.080 * chest + sway * 0.6, 0.30);
    ctx.quadraticCurveTo(0.066, 0.40, 0.074 + lean, 0.50);
    ctx.lineTo(-0.074 + lean, 0.50);
    ctx.quadraticCurveTo(-0.066, 0.40, -0.080 * chest + sway * 0.6, 0.30);
    ctx.quadraticCurveTo(-0.086 * chest + sway, 0.188 - rise, -0.031 + sway * 1.3 - lean * 0.4, 0.168 - rise);
    ctx.closePath(); ctx.fill();
    // arms, held just clear of the body so they read as arms
    ctx.lineWidth = 0.030;
    ctx.beginPath();
    ctx.moveTo(-0.079 * chest + sway, 0.205 - rise);
    ctx.quadraticCurveTo(-0.122 - 0.004 * breath, 0.31, -0.106 + lean * 0.7, 0.47);
    ctx.moveTo(0.079 * chest + sway, 0.205 - rise);
    ctx.quadraticCurveTo(0.122 + 0.004 * breath, 0.31, 0.106 + lean * 0.7, 0.47);
    ctx.stroke();
    // Legs from a hip that moves to a foot that does not.
    ctx.lineWidth = 0.052;
    ctx.beginPath();
    ctx.moveTo(-0.040 + lean, 0.49); ctx.lineTo(-0.038, 0.962);
    ctx.moveTo(0.040 + lean, 0.49); ctx.lineTo(0.038, 0.962);
    ctx.stroke();
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    ctx.moveTo(-0.040, 0.977); ctx.lineTo(-0.006, 0.977);
    ctx.moveTo(0.040, 0.977); ctx.lineTo(0.074, 0.977);
    ctx.stroke();
    ctx.restore();
  };

  /* ── 10⁰·⁸ · the elephant ───────────────────────────────────────────
     Four things move, on four unrelated periods, which is why it reads
     as an animal standing there rather than as a picture with a wobble
     applied to it: the ribcage breathes at about eight seconds, the ear
     fans, the trunk casts about, and the tail swings.

     The ear is the one that matters. An elephant's ear is a radiator —
     it is that size because six tonnes of animal has to dump heat
     through something, and fanning it is most of what an idle elephant
     is doing at any moment. It swings about its hinge at the skull, not
     about its own middle, so it opens away from the head. */
  P.elephant = (ctx, t, focus, wake) => {
    const w = wake || 0;
    ctx.save();
    ctx.translate(0, 0.1);

    // Breath: the ribcage, and only the ribcage. The length under the
    // caliper is fixed, so this is vertical.
    const breath = (0.5 + 0.5 * Math.sin(t * 0.78));
    ctx.save();
    ctx.translate(0, 0.13);
    ctx.scale(1, 1 + 0.035 * breath);
    ctx.translate(0, -0.13);
    ctx.fillStyle = "#8d8a86";
    blob(ctx, [
      [-0.10, -0.16], [0.14, -0.185], [0.30, -0.13], [0.36, 0.0],
      [0.34, 0.10], [0.16, 0.13], [-0.06, 0.13], [-0.17, 0.06], [-0.18, -0.06],
    ]);
    ctx.fill();
    ctx.restore();

    // head
    ctx.fillStyle = "#8d8a86";
    ctx.beginPath(); ctx.ellipse(-0.27, -0.06, 0.115, 0.125, -0.12, 0, TAU); ctx.fill();

    /* The ear, hinged at the skull. A slow fan with a bigger sweep every
       few cycles, and one full sweep on arrival — the animal noticing
       somebody has walked up. */
    const fan = (0.5 + 0.5 * Math.sin(t * 0.63)) * (0.7 + 0.3 * Math.sin(t * 0.19));
    const open = fan + 1.1 * w;
    ctx.save();
    ctx.translate(-0.245, -0.105);            // the hinge
    ctx.rotate(0.30 * open);
    ctx.fillStyle = "#7e7b77";
    ctx.beginPath();
    ctx.ellipse(0.028, 0.066, 0.085 * (1 + 0.10 * open), 0.115, 0.18, 0, TAU);
    ctx.fill();
    ctx.restore();

    // trunk
    const s = 0.05 * Math.sin(t * 1.1) + 0.02 * Math.sin(t * 0.37);
    ctx.strokeStyle = "#8d8a86"; ctx.lineCap = "round";
    ctx.lineWidth = 0.058;
    ctx.beginPath();
    ctx.moveTo(-0.345, -0.02);
    ctx.quadraticCurveTo(-0.44 + s * 0.4, 0.10, -0.42 + s, 0.235);
    ctx.stroke();
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(-0.42 + s, 0.20);
    ctx.quadraticCurveTo(-0.415 + s * 1.2, 0.27, -0.375 + s * 1.4, 0.285);
    ctx.stroke();
    // tusk
    ctx.strokeStyle = "#ded6c6"; ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(-0.33, 0.03); ctx.quadraticCurveTo(-0.38, 0.14, -0.355, 0.20);
    ctx.stroke();
    // legs — shifting weight, not walking
    ctx.strokeStyle = "#84817d"; ctx.lineWidth = 0.062;
    const step = 0.010 * Math.sin(t * 0.46);
    ctx.beginPath();
    ctx.moveTo(-0.10, 0.10); ctx.lineTo(-0.105 + step, 0.35);
    ctx.moveTo(0.02, 0.11); ctx.lineTo(0.022 - step, 0.35);
    ctx.moveTo(0.19, 0.11); ctx.lineTo(0.196 + step, 0.35);
    ctx.moveTo(0.30, 0.09); ctx.lineTo(0.305 - step, 0.35);
    ctx.stroke();
    // tail, on its own period
    const tail = 0.030 * Math.sin(t * 0.87 + 1.4);
    ctx.strokeStyle = "#8d8a86"; ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(0.355, -0.03);
    ctx.quadraticCurveTo(0.40 - tail, 0.08, 0.385 + tail * 1.6, 0.16);
    ctx.stroke();
    ctx.restore();
  };

  /* ── 10² · the redwood ──────────────────────────────────────────────*/
  /* Wind is gusty, not sinusoidal, so the sway runs under an envelope
     that comes and goes on a much longer period than the sway itself.
     Each bough then carries its own phase on top of that, which is the
     thing that makes a canopy read as a canopy: the crown is still
     moving when the lower boughs have stopped. */
  P.tree = (ctx, t, focus, wake) => {
    const gust = (0.55 + 0.45 * Math.sin(t * 0.15 + 0.8)) + 0.5 * (wake || 0);
    const sway = 0.006 * Math.sin(t * 0.5) * gust;
    ctx.save();
    ctx.translate(0, 0.5);              // base at the origin, crown at −1
    ctx.fillStyle = "#6d4230";
    ctx.beginPath();
    ctx.moveTo(-0.052, 0);
    ctx.quadraticCurveTo(-0.026, -0.5, -0.011 + sway, -0.94);
    ctx.lineTo(0.011 + sway, -0.94);
    ctx.quadraticCurveTo(0.026, -0.5, 0.052, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(40,24,17,.45)";
    ctx.beginPath();
    ctx.moveTo(-0.052, 0);
    ctx.quadraticCurveTo(-0.03, -0.5, -0.013 + sway, -0.94);
    ctx.lineTo(-0.004 + sway, -0.94);
    ctx.quadraticCurveTo(-0.012, -0.5, -0.022, 0);
    ctx.closePath(); ctx.fill();
    /* A redwood is a spire, not a lollipop: narrow, and foliage nearly all
       the way down the upper two thirds. More, smaller boughs than looks
       necessary — at fewer than about a hundred the silhouette reads as a
       stack of blobs rather than as a canopy. */
    const boughs = once("tree", () => {
      const r = rng(23);
      return Array.from({ length: 120 }, (_, i) => {
        const f = i / 119;
        return [f, r() < 0.5 ? -1 : 1, 0.45 + r() * 0.55, r() * TAU, r() - 0.5];
      });
    });
    for (const [f, side, len, ph, j] of boughs) {
      const y = -0.16 - f * 0.80 + j * 0.014;
      const taper = Math.pow(1 - f * 0.82, 1.25) * (1 - Math.pow(f, 9));
      const w = 0.118 * taper * len;
      const off = sway * (f * 2.6) + 0.004 * Math.sin(t * 0.75 + ph) * f * gust;
      ctx.fillStyle = f > 0.55 ? "#3d6d3d" : "#2c5030";
      ctx.beginPath();
      ctx.ellipse(side * w * 0.55 + off, y, w, 0.019 + 0.016 * taper, side * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  /* ── 10⁶ · the Great Lakes ──────────────────────────────────────────
     Traced from longitude and latitude, then projected the way a map is,
     so the shape you recognize is the shape the numbers give. The box is
     92.1°W to 76.0°W and 41.4°N to 49.0°N. */
  const LAKES = [
    [[-92.1, 46.75], [-91.0, 46.8], [-90.5, 46.6], [-88.9, 46.5], [-87.0, 46.5], [-85.5, 46.7],
     [-84.5, 46.5], [-84.4, 46.9], [-85.0, 47.2], [-86.0, 47.4], [-87.5, 48.0], [-88.5, 48.4],
     [-89.5, 48.1], [-90.8, 48.1], [-91.5, 47.4]],
    [[-87.9, 42.1], [-87.2, 42.3], [-86.5, 43.0], [-86.2, 44.0], [-85.6, 44.8], [-85.0, 45.8],
     [-85.5, 45.9], [-86.4, 45.4], [-87.0, 45.2], [-87.7, 44.6], [-87.5, 44.0], [-87.9, 43.0]],
    [[-84.7, 46.0], [-83.5, 46.1], [-82.5, 45.4], [-81.0, 45.2], [-80.0, 44.7], [-79.9, 44.5],
     [-81.0, 44.4], [-81.7, 44.5], [-81.7, 43.5], [-82.4, 43.0], [-82.6, 43.5], [-83.5, 44.2],
     [-84.0, 44.9], [-84.2, 45.7]],
    [[-83.5, 41.7], [-82.6, 41.5], [-81.0, 41.4], [-79.5, 42.1], [-78.9, 42.9], [-79.6, 42.8],
     [-81.0, 42.6], [-82.5, 42.0], [-83.2, 42.1]],
    [[-79.8, 43.3], [-78.5, 43.3], [-77.0, 43.3], [-76.3, 43.9], [-76.2, 44.2], [-77.5, 44.1],
     [-78.8, 43.9], [-79.7, 43.6]],
  ];
  P.lakes = (ctx, t, focus) => {
    const proj = once("lakes", () =>
      LAKES.map((lake) => lake.map(([lon, lat]) => [
        (lon + 92.1) / 16.1 - 0.5,
        ((49.0 - lat) * 111) / 1250 - 0.34,
      ])));
    // Land, as a wash that fades out rather than a rectangle. There is no
    // edge to the continent at this zoom, and drawing one puts a box on
    // the screen that the visitor spends a moment trying to interpret.
    const land = ctx.createRadialGradient(0, 0, 0.08, 0, 0, 0.66);
    land.addColorStop(0, "rgba(40,54,44,.95)");
    land.addColorStop(0.62, "rgba(28,38,31,.66)");
    land.addColorStop(1, "rgba(20,27,22,0)");
    ctx.fillStyle = land;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.66, 0.5, 0, 0, TAU); ctx.fill();
    for (const lake of proj) {
      blob(ctx, lake);
      const g = ctx.createLinearGradient(0, -0.34, 0, 0.34);
      g.addColorStop(0, "#4d90b8"); g.addColorStop(1, "#2b5f83");
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = "rgba(180,225,250,.30)"; ctx.lineWidth = 0.003; ctx.stroke();
    }
    // Light on the water, drifting.
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#dff0ff";
    for (const lake of proj) {
      blob(ctx, lake); ctx.save(); ctx.clip();
      ctx.fillRect(-0.6 + ((t * 0.03) % 1.2), -0.4, 0.06, 0.8);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    /* Weather, over the top of everything, because from this height the
       weather is in front of the ground. It moves west to east, which
       is the direction weather actually crosses this part of the world,
       and it moves at about the right speed for the scale: a system
       takes the best part of a minute to cross a frame that is 1,250
       kilometres wide, and a real one takes about a day.

       Each system drags a shadow slightly behind it. That is the thing
       that stops these reading as smudges on the lens — a cloud with no
       shadow is a mark on the glass, and a cloud with one is above
       something. */
    const sky = once("lakesky", () => {
      const r = rng(37), out = [];
      for (let i = 0; i < 16; i++) {
        out.push([r(), (r() - 0.5) * 0.72, 0.07 + r() * 0.16, 0.018 + r() * 0.05,
                  (r() - 0.5) * 0.5, 0.25 + r() * 0.6, 0.7 + r() * 0.6]);
      }
      return out;
    });
    for (const [u, y, rw, rh, rot, br, sp] of sky) {
      let f = (u + t * 0.011 * sp) % 1; if (f < 0) f += 1;
      const x = f * 1.5 - 0.75;
      ctx.fillStyle = "rgba(6,14,20," + 0.20 * br + ")";
      ctx.beginPath();
      ctx.ellipse(x + 0.020, y + 0.016, rw, rh, rot, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(244,249,255," + 0.26 * br + ")";
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, rot, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255," + 0.20 * br + ")";
      ctx.beginPath();
      ctx.ellipse(x - rw * 0.16, y - rh * 0.28, rw * 0.62, rh * 0.6, rot, 0, TAU); ctx.fill();
    }
  };

  /* ── 10⁷ · the Earth ────────────────────────────────────────────────*/
  /* Coastlines in (longitude, latitude) degrees — coarse, about twenty
     points a continent, which is enough to be recognized and nowhere near
     enough to be a dataset. Projected orthographically, the way a globe
     photographed from far away actually projects. */
  const LAND = [
    // North America
    [[-168, 66], [-160, 71], [-140, 70], [-125, 70], [-110, 68], [-95, 70], [-80, 73],
     [-64, 60], [-56, 51], [-66, 45], [-70, 41], [-76, 35], [-81, 25], [-84, 30],
     [-90, 29], [-97, 26], [-105, 23], [-114, 30], [-124, 40], [-130, 54], [-140, 60],
     [-150, 60], [-165, 62]],
    // South America
    [[-81, -4], [-75, 2], [-70, 11], [-62, 10], [-52, 4], [-44, -2], [-35, -6], [-39, -14],
     [-48, -25], [-54, -34], [-62, -40], [-66, -45], [-69, -53], [-73, -45], [-72, -35],
     [-71, -25], [-70, -18], [-75, -14], [-80, -6]],
    // Africa
    [[-17, 15], [-10, 28], [0, 32], [11, 34], [20, 32], [32, 31], [35, 22], [38, 15],
     [43, 11], [51, 12], [48, 2], [40, -8], [40, -16], [35, -24], [28, -33], [20, -34],
     [15, -25], [12, -16], [9, -1], [0, 5], [-8, 5], [-13, 9]],
    // Eurasia
    [[-9, 43], [0, 50], [5, 58], [15, 55], [20, 65], [30, 70], [50, 70], [70, 72],
     [90, 75], [110, 74], [130, 71], [160, 68], [178, 66], [160, 60], [142, 50],
     [130, 42], [122, 30], [110, 20], [100, 10], [95, 20], [88, 22], [80, 15],
     [72, 20], [65, 25], [58, 25], [50, 30], [45, 40], [35, 36], [28, 40], [18, 42], [10, 44]],
    // Australia
    [[113, -22], [122, -18], [130, -12], [137, -13], [143, -11], [146, -19], [153, -28],
     [150, -37], [140, -38], [130, -32], [120, -34], [115, -30]],
    // Greenland
    [[-45, 60], [-52, 68], [-55, 75], [-45, 80], [-30, 82], [-22, 73], [-25, 65], [-35, 60]],
  ];
  /* ── which way up the globe is ───────────────────────────────────────
     The rung below this one is the Great Lakes, and the layout parks
     each object at a fixed offset from the frame's centre — so at this
     frame the Lakes are a thirty-pixel patch sitting at a known spot on
     the Earth's disc. If the globe is turned any old way, that patch
     lands in the Pacific, and the one thing the ladder is supposed to
     make you feel — that the thing you were just looking at is *on*
     this — becomes a coincidence that never happens.

     So the globe is not turned any old way. It is turned so that
     45.5°N 84.2°W comes out exactly under the patch. `window.LAYOUT`
     hands over where the Lakes are parked; the rest is a rotation
     taking one unit vector to another, by the shortest path, which is
     Rodrigues' formula. Change the ladder or the golden-angle spacing
     and this re-derives itself.

     The consequence is that the Earth does not spin, and that is the
     honest trade. What you are looking at is the view from a point
     parked over Lake Huron, which is a real vantage — it is where the
     weather satellites sit. From there the planet turns underneath you
     and what you see change is the daylight and the cloud, both of
     which do move here. */
  const GLOBE = { lon: -84.2, lat: 45.5 };
  function sphere(lon, lat, D) {
    const cp = Math.cos(lat * D), sp = Math.sin(lat * D);
    return [cp * Math.sin(lon * D), sp, cp * Math.cos(lon * D)];
  }
  function aimRotation() {
    const D = Math.PI / 180;
    const src = sphere(GLOBE.lon, GLOBE.lat, D);
    let ax = 0, ay = 0;
    const LAY = window.LAYOUT, L = window.LADDER;
    if (LAY && L) {
      const ke = L.findIndex((o) => o.id === "earth");
      const kl = L.findIndex((o) => o.id === "lakes");
      if (ke >= 0 && kl >= 0) {
        // Where the Lakes sit relative to the Earth's centre, in units
        // of the Earth's radius. Screen y is down; sphere y is up.
        ax = ((LAY.off[kl][0] - LAY.off[ke][0]) / L[ke].size) * 2;
        ay = -((LAY.off[kl][1] - LAY.off[ke][1]) / L[ke].size) * 2;
      }
    }
    const rho = Math.hypot(ax, ay);
    if (rho > 0.94) { ax = (ax / rho) * 0.94; ay = (ay / rho) * 0.94; }
    const az = Math.sqrt(Math.max(0, 1 - ax * ax - ay * ay));
    const dst = [ax, ay, az];
    // Rodrigues, rotating src onto dst about their cross product.
    const kx = src[1] * dst[2] - src[2] * dst[1];
    const ky = src[2] * dst[0] - src[0] * dst[2];
    const kz = src[0] * dst[1] - src[1] * dst[0];
    const s = Math.hypot(kx, ky, kz);
    const c = src[0] * dst[0] + src[1] * dst[1] + src[2] * dst[2];
    if (s < 1e-9) return null;                    // already pointing there
    const ux = kx / s, uy = ky / s, uz = kz / s, k = 1 - c;
    return [
      c + ux * ux * k, ux * uy * k - uz * s, ux * uz * k + uy * s,
      uy * ux * k + uz * s, c + uy * uy * k, uy * uz * k - ux * s,
      uz * ux * k - uy * s, uz * uy * k + ux * s, c + uz * uz * k,
    ];
  }

  P.earth = (ctx, t, focus) => {
    const R = 0.5, D = Math.PI / 180;
    const M = once("earthaim", aimRotation);
    ball(ctx, R, "#4a8ccb", "#2a6199", "#0b2742", -0.32, -0.34);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();

    /* Libration: a degree or two of nod, on two long periods. The Earth
       really does wander against any fixed vantage, and without it a
       globe that has stopped turning reads as a decal. */
    const nod = 0.022 * Math.sin(t * 0.11), tip = 0.016 * Math.sin(t * 0.083 + 1.2);

    /* A point that has gone round the back is pushed out to the limb
       rather than dropped. Dropping it tears the outline; dropping the
       whole continent when half its points are round the back — which is
       what this used to do — makes Asia blink out of existence. */
    const project = (lon, lat) => {
      let v = sphere(lon, lat, D);
      if (M) {
        v = [M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
             M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
             M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
      }
      const vx = v[0] + nod * v[2], vy = v[1] + tip * v[2];
      let x = R * vx, y = -R * vy;
      if (v[2] <= 0) {
        const m = Math.hypot(x, y) || 1;
        x = (x / m) * R; y = (y / m) * R;
      }
      return [x, y, v[2]];
    };

    for (const shape of LAND) {
      const pts = [];
      let vis = false;
      for (const [lon, lat] of shape) {
        const p = project(lon, lat);
        if (p[2] > 0) vis = true;
        pts.push(p);
      }
      if (!vis) continue;
      blob(ctx, pts);
      ctx.fillStyle = "#48633a"; ctx.fill();
    }

    // The ice, projected like everything else rather than pasted on at
    // the top and bottom of the disc — with the globe turned, the poles
    // are not where the edge of the circle is.
    for (const [capLat, alpha] of [[79, 0.5], [-72, 0.72]]) {
      const ring = [];
      let vis = false;
      for (let lon = 0; lon < 360; lon += 24) {
        const p = project(lon, capLat);
        if (p[2] > 0) vis = true;
        ring.push(p);
      }
      if (!vis) continue;
      ctx.fillStyle = "rgba(226,238,250," + alpha + ")";
      blob(ctx, ring); ctx.fill();
    }

    /* Weather. Small and numerous, drawn wide and flat, because from orbit
       cloud is banded — the previous version used two dozen big round
       ellipses and read as smudges on the lens. This is now the fastest
       thing on the globe, which is right: from a fixed point above the
       Lakes the ground is still and the weather is not. */
    const clouds = once("cloud", () => {
      const r = rng(31), out = [];
      for (let i = 0; i < 90; i++) {
        const lat = (r() - 0.5) * 150;
        out.push([r() * 360, lat, 0.028 + r() * 0.055, 0.45 + r() * 0.45]);
      }
      return out;
    });
    const drift = t * 2.2;                    // degrees of longitude
    for (const [lon, lat, w, op] of clouds) {
      const p = project(lon + drift, lat);
      if (p[2] <= 0.1) continue;
      const cp = Math.cos(lat * D);
      ctx.fillStyle = "rgba(252,253,255," + op * 0.82 * Math.min(1, p[2] * 3) + ")";
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], w * p[2] * Math.max(0.35, cp), w * 0.3, 0, 0, TAU);
      ctx.fill();
    }

    /* Night, and it moves. The terminator sweeping round once a minute
       is the planet's rotation seen from a vantage that turns with it —
       the same fact as a spinning globe, told from where the ladder
       actually left you. */
    const sun = t * 0.105;
    ctx.save();
    ctx.rotate(sun);
    const sh = ctx.createLinearGradient(-0.12, 0, R, 0);
    sh.addColorStop(0, "rgba(0,0,10,0)"); sh.addColorStop(1, "rgba(0,0,12,.72)");
    ctx.fillStyle = sh; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    ctx.restore();
    // the atmosphere, at something close to its true thickness
    ctx.strokeStyle = "rgba(150,205,255,.45)"; ctx.lineWidth = 0.008;
    ctx.beginPath(); ctx.arc(0, 0, 0.504, 0, TAU); ctx.stroke();
  };

  /* ── 10⁸ · the Moon's orbit ─────────────────────────────────────────
     A distance. Earth and Moon are both drawn at true scale inside it,
     which is why they are specks: the gap is sixty Earths wide. */
  P.moon = (ctx, t, focus) => {
    ctx.setLineDash([0.014, 0.014]);
    ctx.strokeStyle = "rgba(190,200,220,.42)"; ctx.lineWidth = 0.0035;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    const ph = t * 0.28;
    const mx = Math.cos(ph) * 0.5, my = Math.sin(ph) * 0.5 * 0.35;
    ctx.save(); ctx.translate(0, 0); ctx.scale(0.01657, 0.01657);
    P.earth(ctx, t, focus);                    // 12,742 km / 768,800 km
    ctx.restore();
    ctx.fillStyle = "#c9c6c0";
    ctx.beginPath(); ctx.arc(mx, my, 0.00452 / 2, 0, TAU); ctx.fill();
    glow(ctx, 0.02, "rgba(220,220,230,$)", [[0, 0.0], [1, 0]]);
    ctx.save(); ctx.translate(mx, my);
    glow(ctx, 0.016, "rgba(225,225,235,$)", [[0, 0.5], [1, 0]]);
    ctx.restore();
  };

  /* ── 10⁹ · the Sun ──────────────────────────────────────────────────
     Four things, on four timescales, and all four are real:

       granulation   convection cells boiling at the surface. A real one
                     lasts about eight minutes and is roughly the width
                     of France, and there are a million of them.
       prominences   loops of plasma standing on the magnetic field at
                     the limb, which hold their shape for days.
       flares        a sudden brightening over a spot group. Minutes.
       eruptions     a lump of the corona leaving. Occasional, by which
                     the schedule below means every seventeen seconds,
                     each at a different bearing, none of them repeating
                     the last — the real rate is a few a day at solar
                     maximum and a few a week at minimum.

     Sitting and watching this is meant to be worth doing, so the beat
     the eye catches is spaced far enough apart that you have to stay
     for it. Arriving triggers one immediately, which is the one bit of
     stage management on the rung. */
  function limbLoop(ctx, th, span, h, colour, lw) {
    const a1 = th - span, a2 = th + span;
    ctx.strokeStyle = colour;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a1) * 0.49, Math.sin(a1) * 0.49);
    ctx.quadraticCurveTo(Math.cos(th) * (0.5 + h * 2.4), Math.sin(th) * (0.5 + h * 2.4),
                         Math.cos(a2) * 0.49, Math.sin(a2) * 0.49);
    ctx.stroke();
  }
  P.sun = (ctx, t, focus, wake) => {
    const w = wake || 0;
    glow(ctx, 1.4, "rgba(255,190,90,$)",
      [[0.34, 0.30 + 0.16 * w], [0.5, 0.13], [0.78, 0.03], [1, 0]]);
    const g = ctx.createRadialGradient(0, 0, 0.1, 0, 0, 0.5);
    g.addColorStop(0, "#fff6dc"); g.addColorStop(0.72, "#ffd066");
    g.addColorStop(0.94, "#f79c2e"); g.addColorStop(1, "#e07a1c");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.fill();
    // granulation
    const cells = once("gran", () => {
      const r = rng(41), out = [];
      for (let i = 0; i < 420; i++) {
        const th = r() * TAU, rr = Math.sqrt(r()) * 0.49;
        out.push([Math.cos(th) * rr, Math.sin(th) * rr, 0.006 + r() * 0.013, r() * TAU]);
      }
      return out;
    });
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.clip();
    for (const [x, y, rr, ph] of cells) {
      ctx.fillStyle = "rgba(255,246,214," + (0.03 + 0.055 * (0.5 + 0.5 * Math.sin(t * 0.9 + ph))) + ")";
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // Active regions: a spot group that darkens, then flares over it.
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.clip();
    for (let i = 0; i < 3; i++) {
      const th = i * 2.1 + t * 0.035, rr = 0.16 + i * 0.11;
      const x = Math.cos(th) * rr, y = Math.sin(th) * rr * 0.8;
      ctx.fillStyle = "rgba(120,52,10,.42)";
      ctx.beginPath(); ctx.ellipse(x, y, 0.030, 0.020, th, 0, TAU); ctx.fill();
      const fl = Math.max(0, Math.sin(t * 0.42 + i * 2.3)) ** 8;
      if (fl > 0.01) {
        ctx.save(); ctx.translate(x, y);
        glow(ctx, 0.11, "rgba(255,246,220,$)", [[0, 0.75 * fl], [0.3, 0.28 * fl], [1, 0]]);
        ctx.restore();
      }
    }
    ctx.restore();

    // prominences on the limb — standing, and slow
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const th = (i * TAU) / 5 + t * 0.06;
      const h = 0.020 + 0.024 * (0.5 + 0.5 * Math.sin(t * 0.31 + i * 2.4));
      limbLoop(ctx, th, 0.20 + 0.05 * i * 0.3, h, "rgba(255,140,60,.5)", 0.010);
    }

    /* The eruption. One every seventeen seconds, each at its own
       bearing, growing over three seconds and taking another nine to
       fade out and away — and one more the moment you arrive. */
    const erupt = (th, grow, e) => {
      if (e < 0.02) return;
      const h = 0.012 + 0.20 * grow;
      limbLoop(ctx, th, 0.30, h, "rgba(255,196,120," + 0.55 * e + ")", 0.020 * (1 + grow));
      limbLoop(ctx, th, 0.16, h * 1.25, "rgba(255,246,215," + 0.42 * e + ")", 0.009);
      ctx.save();
      ctx.translate(Math.cos(th) * 0.5, Math.sin(th) * 0.5);
      glow(ctx, 0.10 + 0.14 * grow, "rgba(255,210,140,$)",
        [[0, 0.5 * e], [0.35, 0.18 * e], [1, 0]]);
      ctx.restore();
    };
    const P17 = 17, n = Math.floor(t / P17), u = t / P17 - n;
    if (u <= 0.72) {
      const grow = Math.min(1, u / 0.18);
      const fade = 1 - Math.max(0, (u - 0.18) / 0.54);
      // Golden-angle bearings, so no two consecutive eruptions are near
      // each other and the sequence never settles into a rhythm.
      erupt((n * 2.399963229728653) % TAU, grow, grow * fade * fade);
    }
    // and one on arrival, riding the wake bump straight up and down
    if (w > 0.02) erupt(4.10, w, w * 0.9);
  };

  /* ── 10¹² · Stephenson 2-18 ─────────────────────────────────────────
     A hypergiant is not a ball, it is a hot atmosphere with no clear top.
     Painted with a ragged, breathing edge for that reason. */
  P.stephenson = (ctx, t, focus, wake) => {
    const w = wake || 0;
    // The whole star breathes. Red hypergiants really do pulsate, over
    // months to years, and it is one of the ways they are falling apart.
    const puls = 1 + 0.035 * Math.sin(t * 0.085);
    glow(ctx, 1.5 * puls, "rgba(220,80,50,$)",
      [[0.32, 0.28 + 0.10 * w], [0.5, 0.11], [0.8, 0.02], [1, 0]]);

    /* Plumes. On a star this size convection is not a fine boil, it is
       three or four cells covering the entire surface, and material
       comes up in columns wider than the orbit of Mars and falls back.
       They are drawn outside the photosphere because that is where they
       go — a hypergiant has no clear top, and the mass it is losing
       leaves through these. */
    const plumes = once("plume", () => {
      const r = rng(151), out = [];
      for (let i = 0; i < 4; i++) out.push([r() * TAU, 0.035 + r() * 0.05, 0.5 + r() * 0.9, r() * TAU]);
      return out;
    });
    for (const [th0, rate, sz, ph] of plumes) {
      const cyc = (0.5 + 0.5 * Math.sin(t * rate + ph));
      const th = th0 + t * 0.012;
      const h = (0.06 + 0.22 * cyc) * sz;
      const e = (0.10 + 0.22 * cyc * cyc) + 0.10 * w;
      ctx.save();
      ctx.translate(Math.cos(th) * (0.48 + h * 0.45), Math.sin(th) * (0.48 + h * 0.45));
      ctx.rotate(th);
      ctx.scale(1 + h * 2.6, 1);
      glow(ctx, 0.10 + 0.10 * sz, "rgba(226,104,58,$)",
        [[0, e * 0.9], [0.4, e * 0.35], [1, 0]]);
      ctx.restore();
    }
    // Evenly spaced bearings with a little jitter, not random ones. Random
    // bearings come out of the generator in random order, and a path that
    // walks them in that order is a shattered plate, not a star.
    const lumps = once("hyper", () => {
      const r = rng(53), out = [], n = 120;
      for (let i = 0; i < n; i++) {
        out.push([(i / n) * TAU + ((r() - 0.5) * TAU) / n * 0.7, 0.93 + r() * 0.11, r() * TAU]);
      }
      return out;
    });
    ctx.beginPath();
    for (let i = 0; i < lumps.length; i++) {
      const [th, base, ph] = lumps[i];
      const rr = 0.5 * base * puls * (1 + 0.035 * Math.sin(t * 0.25 + ph));
      const x = Math.cos(th) * rr, y = Math.sin(th) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-0.1, -0.12, 0.04, 0, 0, 0.55);
    g.addColorStop(0, "#ffb87a"); g.addColorStop(0.4, "#e0603a");
    g.addColorStop(0.82, "#a52f21"); g.addColorStop(1, "#5e1710");
    ctx.fillStyle = g; ctx.fill();
    // convection cells, which on a star this size are the size of orbits
    ctx.save(); ctx.clip();
    const conv = once("conv", () => {
      const r = rng(59), out = [];
      for (let i = 0; i < 26; i++) {
        const th = r() * TAU, rr = Math.sqrt(r()) * 0.44;
        out.push([Math.cos(th) * rr, Math.sin(th) * rr, 0.05 + r() * 0.1, r() * TAU]);
      }
      return out;
    });
    for (const [x, y, rr, ph] of conv) {
      ctx.fillStyle = "rgba(255,170,110," + (0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.4 + ph))) + ")";
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ── 10¹² · the solar system ────────────────────────────────────────
     Orbits at their real relative radii. The planets on them are drawn at
     true scale too, which is why you cannot see them: at this width the
     Earth is a ten-thousandth of a pixel. The markers are markers, and
     they are drawn a size that says so. */
  const ORBITS = [
    [0.387, "#a89b90", 0.9], [0.723, "#e6c68a", 0.62], [1.0, "#7fb4e6", 0.44],
    [1.524, "#d0785a", 0.35], [5.203, "#e3c39a", 0.16], [9.537, "#e6d5a8", 0.115],
    [19.19, "#a5d8de", 0.08], [30.07, "#7b9fe0", 0.064],
  ];
  P.solar = (ctx, t, focus) => {
    const sq = 0.42;
    ctx.save(); ctx.scale(1, sq);
    for (let i = 0; i < ORBITS.length; i++) {
      const [au, col, rate] = ORBITS[i];
      const r = au / 60.14;
      ctx.strokeStyle = "rgba(190,205,235," + (0.10 + (i > 3 ? 0.09 : 0.05)) + ")";
      ctx.lineWidth = 0.0022;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      const ph = t * rate * 0.12 + i * 1.7;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(Math.cos(ph) * r, Math.sin(ph) * r, i > 3 ? 0.006 : 0.0038, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, 0.05, "rgba(255,215,140,$)", [[0, 0.9], [0.25, 0.35], [1, 0]]);
    ctx.fillStyle = "#fff2cf";
    ctx.beginPath(); ctx.arc(0, 0, 1.548e-4 / 2, 0, TAU); ctx.fill();   // true scale
  };

  /* ── 10¹⁶ · the Oort Cloud ──────────────────────────────────────────
     Never photographed. Drawn as what the evidence is: a shell, brighter
     at the rim because a shell seen from inside has more of itself in the
     way at the edges. */
  P.oort = (ctx, t, focus) => {
    const shell = once("oort", () => {
      const r = rng(67), out = [];
      for (let i = 0; i < 900; i++) {
        // uniform on a sphere, projected — this is what makes the rim bright
        const u = r() * 2 - 1, th = r() * TAU;
        const rr = 0.30 + 0.20 * Math.cbrt(r());
        const s = Math.sqrt(1 - u * u);
        out.push([Math.cos(th) * s * rr, Math.sin(th) * s * rr, u * rr, r() * TAU]);
      }
      return out;
    });
    for (const [x, y, z, ph] of shell) {
      const depth = 0.55 + 0.45 * ((z + 0.5) / 1);
      ctx.fillStyle = "rgba(205,220,245," + (0.10 + 0.30 * depth * (0.6 + 0.4 * Math.sin(t * 0.6 + ph))) + ")";
      ctx.beginPath(); ctx.arc(x, y, 0.0022 + 0.0014 * depth, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = "rgba(170,190,225,.10)"; ctx.lineWidth = 0.0025;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();

    /* The comets, which are the only reason anybody thinks this shell is
       here. Three of them, on real Kepler orbits — the eccentric
       anomaly is solved from the mean anomaly by Newton's method, so
       they crawl at aphelion and whip through perihelion, which is the
       shape of the evidence: the long-period comets all turn around at
       about the same enormous distance, and that is what a shell looks
       like from the inside.

       The tail points away from the Sun rather than backwards along the
       path, because it is being blown off by sunlight, not left behind.
       A comet going home leads with its tail. */
    const comets = once("comet", () => {
      const r = rng(73), out = [];
      for (let i = 0; i < 3; i++) {
        out.push([0.30 + r() * 0.16, 0.80 + r() * 0.16, r() * TAU,
                  0.020 + r() * 0.020, r(), 0.55 + r() * 0.45]);
      }
      return out;
    });
    for (const [A, ec, rot, rate, ph, br] of comets) {
      const M = TAU * (((t * rate + ph) % 1 + 1) % 1);
      let E = M;
      for (let i = 0; i < 4; i++) E -= (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E));
      const px = A * (Math.cos(E) - ec), py = A * Math.sqrt(1 - ec * ec) * Math.sin(E);
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const x = px * cr - py * sr, y = (px * sr + py * cr) * 0.75;
      const d = Math.hypot(x, y) || 1e-6;
      const near = Math.min(1, (A * (1 - ec) * 2.2) / d);      // 1 at perihelion
      const tail = 0.02 + 0.16 * near * near;
      const e = (0.10 + 0.55 * near * near) * br;
      ctx.strokeStyle = "rgba(198,226,255," + 0.24 * e + ")";
      ctx.lineWidth = 0.004 + 0.006 * near;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x / d) * tail, y + (y / d) * tail);
      ctx.stroke();
      ctx.fillStyle = "rgba(232,244,255," + Math.min(0.95, 0.5 + e) + ")";
      ctx.beginPath(); ctx.arc(x, y, 0.0035 + 0.003 * near, 0, TAU); ctx.fill();
    }

    glow(ctx, 0.04, "rgba(255,225,170,$)", [[0, 0.85], [0.3, 0.28], [1, 0]]);
  };

  /* ── 10¹⁶ · the gap to the next star ────────────────────────────────
     Two lights and the distance between them, which is the honest shape
     of this fact. The tick near the left end is Voyager 1. */
  P.proxima = (ctx, t, focus) => {
    ctx.strokeStyle = "rgba(200,212,235,.30)"; ctx.lineWidth = 0.0018;
    ctx.setLineDash([0.012, 0.012]);
    ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.lineTo(0.5, 0); ctx.stroke();
    ctx.setLineDash([]);
    // the Sun's Oort shell, to the same scale — it nearly reaches
    ctx.strokeStyle = "rgba(150,170,210,.22)"; ctx.lineWidth = 0.0015;
    ctx.beginPath(); ctx.arc(-0.5, 0, 0.372, 0, TAU); ctx.stroke();
    ctx.save(); ctx.translate(-0.5, 0);
    glow(ctx, 0.05, "rgba(255,215,150,$)", [[0, 0.95], [0.25, 0.35], [1, 0]]);
    ctx.restore();
    // Voyager 1, 1/500th of the way
    const vx = -0.5 + 1.0 * 0.00196;
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(vx - 0.0008, -0.012, 0.0016, 0.024);
    // Alpha Centauri A and B, and Proxima out on its own
    ctx.save(); ctx.translate(0.5, 0);
    const w = 0.004 * Math.sin(t * 0.5);
    glow(ctx, 0.055, "rgba(255,240,205,$)", [[0, 0.9], [0.22, 0.3], [1, 0]]);
    ctx.save(); ctx.translate(0.014 + w, -0.008);
    glow(ctx, 0.035, "rgba(255,205,150,$)", [[0, 0.8], [0.25, 0.25], [1, 0]]);
    ctx.restore();
    ctx.save(); ctx.translate(-0.047, 0.048);
    glow(ctx, 0.03, "rgba(255,130,105,$)", [[0, 0.95], [0.3, 0.3], [1, 0]]);
    ctx.restore();
    ctx.restore();
  };

  /* ── 10¹⁶ · what a hypergiant would hold ────────────────────────────
     The Sun's cloud again, two and a half times out, around a star that
     has never been looked at for one. It is deliberately the same shell
     drawn by the same method, because the point of the frame is that
     only two things differ from the rung two back — the colour of the
     marker in the middle, and the fact that nothing is falling through
     it.

     No comets. That is not an omission. The comets on the Oort rung are
     the entire evidence that the Oort rung exists, and there is no
     equivalent here: nobody has ever seen anything fall in from around
     another star. An empty shell is the honest picture of a shell
     nobody has caught anything leaving.

     The rim is dashed, which on this page already means one specific
     thing — the electron, the quark and the neutrino are drawn that way
     — and it means it here too: nobody knows where this stops.

     The Sun's own cloud is NOT drawn by this painter. It does not need
     to be. The exhibit draws every rung at its own extent, so the oort
     rung lands inside this frame at 2.99/7.37 of the width, comets and
     all, for free and at the true ratio. Drawing a second one here
     would be a fudge sitting on top of a fact. */
  P.hyperoort = (ctx, t, focus) => {
    const shell = once("hyperoort", () => {
      const r = rng(211), out = [];
      for (let i = 0; i < 760; i++) {
        const u = r() * 2 - 1, th = r() * TAU;
        const rr = 0.31 + 0.19 * Math.cbrt(r());
        const s = Math.sqrt(1 - u * u);
        out.push([Math.cos(th) * s * rr, Math.sin(th) * s * rr, u * rr, r() * TAU]);
      }
      return out;
    });
    for (const [x, y, z, ph] of shell) {
      const depth = 0.55 + 0.45 * (z + 0.5);
      // Dimmer than the Sun's cloud, and warmer: ices this far from a red
      // hypergiant are lit by a star that puts out almost nothing blue.
      ctx.fillStyle = "rgba(228,205,214," + (0.09 + 0.28 * depth * (0.6 + 0.4 * Math.sin(t * 0.6 + ph))) + ")";
      ctx.beginPath(); ctx.arc(x, y, 0.0022 + 0.0014 * depth, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = "rgba(214,176,196,.22)";
    ctx.lineWidth = 0.0030;
    ctx.setLineDash([0.024, 0.024]);
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    /* The star. At this width Stephenson 2-18 is four hundredths of a
       thousandth of the frame — a fifteenth of a pixel — so this is a
       marker and not the star, exactly as the Sun's glint is on the Oort
       rung, and drawn at the same size for the same reason. Red, because
       that is the one thing that tells you whose cloud you are in. */
    glow(ctx, 0.04, "rgba(255,150,110,$)", [[0, 0.8], [0.3, 0.26], [1, 0]]);
  };

  /* ── 10²⁰ · the Milky Way ───────────────────────────────────────────*/
  P.galaxy = (ctx, t, focus) => {
    const stars = once("mw", () => {
      const r = rng(71), out = [];
      for (let i = 0; i < 2600; i++) {
        const arm = Math.floor(r() * 4);
        const f = Math.pow(r(), 0.62);
        const th = f * 4.6 + (arm * TAU) / 4 + (r() - 0.5) * 0.5;
        const rr = 0.06 + f * 0.44 + (r() - 0.5) * 0.05;
        out.push([th, rr, 0.0016 + r() * 0.0026, 0.25 + r() * 0.65]);
      }
      for (let i = 0; i < 700; i++) {
        const th = r() * TAU, rr = Math.pow(r(), 2.1) * 0.5;
        out.push([th, rr, 0.0012 + r() * 0.0018, 0.15 + r() * 0.4]);
      }
      return out;
    });
    /* Dust and the star-forming knots that sit next to it. Both go on
       the *inner* edge of an arm, which is where they are in a real
       spiral: the arm is a traffic jam, gas piles up as it enters, and
       what comes out the other side is new stars.

       They drift at a slightly different rate from the stars because
       the arms are a wave and the stars are not — the pattern turns
       once while the material at the Sun's radius laps it several
       times. Which is also why the Galaxy has not wound itself shut in
       the twenty times it has gone round since the Sun formed. */
    const lanes = once("mwdust", () => {
      const r = rng(89), dust = [], hii = [];
      for (let i = 0; i < 150; i++) {
        const arm = Math.floor(r() * 4), f = Math.pow(r(), 0.5);
        const th = f * 4.6 + (arm * TAU) / 4 + (r() - 0.5) * 0.16 - 0.13;
        const rr = 0.06 + f * 0.44 + (r() - 0.5) * 0.018 - 0.012;
        dust.push([th, rr, 0.012 + r() * 0.030, 0.006 + r() * 0.012, 0.3 + r() * 0.7]);
      }
      for (let i = 0; i < 26; i++) {
        const arm = Math.floor(r() * 4), f = 0.25 + Math.pow(r(), 0.7) * 0.72;
        const th = f * 4.6 + (arm * TAU) / 4 + (r() - 0.5) * 0.2 - 0.06;
        hii.push([th, 0.06 + f * 0.44, 0.006 + r() * 0.010, r() * TAU, 0.3 + r() * 0.7]);
      }
      return { dust, hii };
    });

    ctx.save();
    ctx.rotate(-0.36); ctx.scale(1, 0.45);
    const spin = t * 0.02;
    glow(ctx, 0.5, "rgba(205,185,150,$)", [[0, 0.42], [0.2, 0.2], [0.62, 0.06], [1, 0]]);
    for (const [th, rr, sz, br] of stars) {
      const A = th + spin * (0.2 / (rr + 0.1));
      ctx.fillStyle = "rgba(255,244,225," + br * 0.55 + ")";
      ctx.beginPath(); ctx.arc(Math.cos(A) * rr, Math.sin(A) * rr, sz, 0, TAU); ctx.fill();
    }
    for (const [th, rr, w1, h1, br] of lanes.dust) {
      const A = th + spin * (0.2 / (rr + 0.1)) * 0.62;
      ctx.fillStyle = "rgba(28,20,16," + 0.42 * br + ")";
      ctx.beginPath();
      ctx.ellipse(Math.cos(A) * rr, Math.sin(A) * rr, w1, h1, A + 1.2, 0, TAU);
      ctx.fill();
    }
    for (const [th, rr, sz, ph, br] of lanes.hii) {
      const A = th + spin * (0.2 / (rr + 0.1)) * 0.62;
      const tw = 0.6 + 0.4 * Math.sin(t * 0.5 + ph);
      ctx.fillStyle = "rgba(255,168,190," + 0.30 * br * tw + ")";
      ctx.beginPath(); ctx.arc(Math.cos(A) * rr, Math.sin(A) * rr, sz, 0, TAU); ctx.fill();
    }
    // the bar, and the core
    ctx.save(); ctx.rotate(0.4);
    glow(ctx, 0.1, "rgba(255,232,190,$)", [[0, 0.55], [0.4, 0.2], [1, 0]]);
    ctx.restore();
    // where the Sun is: 30,000 of 50,000 light-years out
    const sa = 1.9 + spin * 1.4;
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 0.0035;
    ctx.beginPath();
    ctx.arc(Math.cos(sa) * 0.30, Math.sin(sa) * 0.30, 0.017, 0, TAU);
    ctx.stroke();
    ctx.restore();
  };

  /* ── 10²² · the Local Group ─────────────────────────────────────────
     Andromeda is 220,000 light-years across in a frame ten million wide,
     so it is two per cent of one per cent. Galaxies are points of light
     here, which is exactly what they are from this far away. */
  P.localgroup = (ctx, t, focus) => {
    const dwarfs = once("lg", () => {
      const r = rng(83), out = [];
      for (let i = 0; i < 78; i++) {
        const th = r() * TAU, rr = Math.pow(r(), 0.7) * 0.46;
        const near = r() < 0.5 ? -0.16 : 0.16;   // clustered on the two big ones
        out.push([Math.cos(th) * rr * 0.6 + near, Math.sin(th) * rr * 0.42,
                  0.002 + r() * 0.004, 0.2 + r() * 0.5]);
      }
      return out;
    });
    ctx.strokeStyle = "rgba(150,165,200,.13)"; ctx.lineWidth = 0.002;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.375, 0, 0, TAU); ctx.stroke();
    for (const [x, y, r, br] of dwarfs) {
      ctx.fillStyle = "rgba(215,225,250," + br * 0.6 + ")";
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    // the two that matter, closing at 110 km/s
    const close = 0.006 * Math.sin(t * 0.22);
    for (const [x, y, s, c] of [[-0.17 + close, 0.03, 1, "rgba(230,225,200,$)"],
                                [0.17 - close, -0.04, 1.15, "rgba(215,225,255,$)"]]) {
      ctx.save(); ctx.translate(x, y);
      glow(ctx, 0.05 * s, c, [[0, 0.75], [0.22, 0.28], [0.6, 0.06], [1, 0]]);
      ctx.save(); ctx.rotate(0.5); ctx.scale(1, 0.4);
      ctx.strokeStyle = c.replace("$", "0.3"); ctx.lineWidth = 0.0025;
      ctx.beginPath(); ctx.arc(0, 0, 0.019 * s, 0, TAU); ctx.stroke();
      ctx.restore(); ctx.restore();
    }
  };

  /* ── 10²⁴ · Laniakea ────────────────────────────────────────────────
     Defined by motion, not by matter, so the streamlines are the object
     and the galaxies are what is being carried. */
  P.laniakea = (ctx, t, focus) => {
    /* Clumped around seeds and then linked to near neighbours, so what
       comes out is a web with knots and voids in it. The first version of
       this drew filaments radiating from the middle and read as an
       explosion — which is wrong twice over: superclusters are not
       centred on anything, and the thing that *is* central here is a
       destination, not a source. */
    const web = once("lani", () => {
      const r = rng(97), seeds = [], nodes = [], links = [];
      for (let i = 0; i < 15; i++) {
        const u = r() * 2 - 1, th = r() * TAU, rr = Math.pow(r(), 0.55) * 0.42;
        const s = Math.sqrt(1 - u * u);
        seeds.push([Math.cos(th) * s * rr, Math.sin(th) * s * rr * 0.86, u * rr]);
      }
      for (let i = 0; i < 330; i++) {
        const s = seeds[Math.floor(r() * seeds.length)];
        const sp = 0.06 + r() * 0.15;
        nodes.push([s[0] + (r() - 0.5) * sp, s[1] + (r() - 0.5) * sp * 0.8, s[2] + (r() - 0.5) * sp,
                    0.0016 + r() * 0.0034, 0.18 + r() * 0.6]);
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1], dz = nodes[i][2] - nodes[j][2];
          if (dx * dx + dy * dy + dz * dz < 0.0028) links.push([i, j]);
        }
      }
      return { nodes, links };
    });
    ctx.lineWidth = 0.0035;
    for (const [i, j] of web.links) {
      const p = web.nodes[i], q = web.nodes[j];
      const depth = 0.5 + 0.5 * ((p[2] + q[2]) / 0.84);
      ctx.strokeStyle = "rgba(150,132,205," + 0.10 * depth + ")";
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    for (const [x, y, z, sz, br] of web.nodes) {
      const depth = 0.45 + 0.55 * ((z + 0.42) / 0.84);
      ctx.fillStyle = "rgba(228,222,255," + br * 0.55 * depth + ")";
      ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
    }
    // The flow. Every galaxy in the supercluster is drifting toward the
    // same gravitational low, and that shared drift is the whole
    // definition of the boundary — so it is the thing that moves.
    ctx.lineCap = "round"; ctx.lineWidth = 0.0042;
    for (let i = 0; i < web.nodes.length; i += 5) {
      const n = web.nodes[i];
      const f = ((t * 0.06 + i * 0.0173) % 1 + 1) % 1;
      const s = 1 - f * 0.9, e = Math.max(0.04, s - 0.08);
      ctx.strokeStyle = "rgba(206,188,255," + 0.3 * (1 - f) + ")";
      ctx.beginPath(); ctx.moveTo(n[0] * s, n[1] * s); ctx.lineTo(n[0] * e, n[1] * e); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(150,130,200,.12)"; ctx.lineWidth = 0.002;
    ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.4, 0, 0, TAU); ctx.stroke();
    glow(ctx, 0.1, "rgba(255,228,196,$)", [[0, 0.34], [0.35, 0.11], [1, 0]]);
  };

  /* ── the real microwave background ───────────────────────────────────
     `cmb-wmap9.jpg` is the WMAP nine-year map of the whole sky, cropped
     out of NASA's own published figure (LAMBDA, nine-year basic results,
     figure 27, top panel). NASA / WMAP Science Team, public domain. It
     is a Mollweide projection: the entire celestial sphere flattened
     into an ellipse, ±200 microkelvin of temperature across a 2.7 kelvin
     background, which is one part in ten thousand.

     It is the oldest light there is and the furthest anything can be
     seen — which makes it the wall of the observable universe, and the
     right thing to paint on that shell. So it is not pasted in flat.
     The ellipse is unwrapped back onto the sphere it was flattened
     from, the near hemisphere of that sphere is what the frame shows,
     and the alpha runs from nothing at the middle to full at the limb,
     because a shell is transparent through the centre and edge-on at
     the rim.

     Done as a triangle mesh with `drawImage` rather than per-pixel with
     `getImageData` on purpose: reading pixels from an image taints the
     canvas under `file://`, and this site has to work opened straight
     off the disk. Drawing a tainted image is fine; only reading is not.
     Built once, on load, and blitted after that.

     If the file is missing the painter falls back to a seeded mottle,
     so the rung never depends on an asset having arrived. */
  const CMB = { img: null, tex: null, failed: false };
  (() => {
    if (typeof Image === "undefined") return;
    const img = new Image();
    img.onload = () => { CMB.img = img; };
    img.onerror = () => { CMB.failed = true; };
    img.src = "cmb-wmap9.jpg";
  })();

  /* Mollweide, forward. θ solves 2θ + sin 2θ = π sin φ, which has no
     closed form, so: Newton, from φ, four passes. The poles are the one
     place the derivative vanishes and are handled before the loop. */
  function mollweide(lon, lat, W, H) {
    let th;
    if (Math.abs(lat) > 1.5697) {
      th = lat > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      th = lat;
      for (let i = 0; i < 5; i++) {
        const den = 2 + 2 * Math.cos(2 * th);
        if (Math.abs(den) < 1e-9) break;
        const d = (2 * th + Math.sin(2 * th) - Math.PI * Math.sin(lat)) / den;
        th -= d;
        if (Math.abs(d) < 1e-7) break;
      }
    }
    return [(0.5 + 0.5 * (lon / Math.PI) * Math.cos(th)) * W,
            (0.5 - 0.5 * Math.sin(th)) * H];
  }

  function cmbShell() {
    if (CMB.tex || !CMB.img) return CMB.tex;
    const S = 512, R = S / 2, W = CMB.img.width, H = CMB.img.height;
    const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";

    /* 9° cells, chosen because 9 divides 90: the terminator at ±90° of
       longitude falls exactly on a grid line, so no cell ever straddles
       the limb and there is nothing to clip against the horizon. */
    const STEP = 9, D = Math.PI / 180;
    const node = (lonD, latD) => {
      const lon = lonD * D, lat = latD * D;
      const cp = Math.cos(lat);
      const nx = cp * Math.sin(lon), ny = Math.sin(lat), nz = cp * Math.cos(lon);
      const m = mollweide(lon, lat, W, H);
      // Pulled a hair off the ellipse's own edge; the source has white
      // outside it and a rounding error there shows as a white fleck.
      return [R + nx * R, R - ny * R, Math.min(W - 1, Math.max(1, m[0])),
              Math.min(H - 1, Math.max(1, m[1])), nz];
    };

    const tri = (p, q, r) => {
      const du1 = q[2] - p[2], dv1 = q[3] - p[3];
      const du2 = r[2] - p[2], dv2 = r[3] - p[3];
      const det = du1 * dv2 - du2 * dv1;
      if (!det) return;
      const dx1 = q[0] - p[0], dy1 = q[1] - p[1];
      const dx2 = r[0] - p[0], dy2 = r[1] - p[1];
      const a = (dx1 * dv2 - dx2 * dv1) / det, b = (dy1 * dv2 - dy2 * dv1) / det;
      const cc = (dx2 * du1 - dx1 * du2) / det, d = (dy2 * du1 - dy1 * du2) / det;
      const e = p[0] - a * p[2] - cc * p[3], f = p[1] - b * p[2] - d * p[3];
      // Grown a third of a pixel about the centroid, or the cells show
      // their seams as a lattice of hairlines.
      const gx = (p[0] + q[0] + r[0]) / 3, gy = (p[1] + q[1] + r[1]) / 3;
      const out = (v) => {
        const dxp = v[0] - gx, dyp = v[1] - gy;
        const l = Math.hypot(dxp, dyp) || 1;
        return [v[0] + (dxp / l) * 0.34, v[1] + (dyp / l) * 0.34];
      };
      const P = out(p), Q = out(q), Rr = out(r);
      g.save();
      g.beginPath();
      g.moveTo(P[0], P[1]); g.lineTo(Q[0], Q[1]); g.lineTo(Rr[0], Rr[1]);
      g.closePath(); g.clip();
      g.transform(a, b, cc, d, e, f);
      g.drawImage(CMB.img, 0, 0);
      g.restore();
    };

    for (let lat = -90; lat < 90; lat += STEP) {
      for (let lon = -90; lon < 90; lon += STEP) {
        const A = node(lon, lat), B = node(lon + STEP, lat);
        const C = node(lon + STEP, lat + STEP), E = node(lon, lat + STEP);
        tri(A, B, C); tri(A, C, E);
      }
    }

    // The shell: nothing through the middle, everything at the limb, and
    // no edge at the rim — a horizon is where seeing stops, not a wall.
    g.globalCompositeOperation = "destination-in";
    const rg = g.createRadialGradient(R, R, 0, R, R, R);
    rg.addColorStop(0.00, "rgba(0,0,0,0)");
    rg.addColorStop(0.26, "rgba(0,0,0,0)");
    rg.addColorStop(0.62, "rgba(0,0,0,.16)");
    rg.addColorStop(0.86, "rgba(0,0,0,.56)");
    rg.addColorStop(0.975, "rgba(0,0,0,1)");
    rg.addColorStop(1.00, "rgba(0,0,0,0)");
    g.fillStyle = rg;
    g.fillRect(0, 0, S, S);

    CMB.tex = c;
    return c;
  }

  /* ── 10²⁶ · the observable universe ─────────────────────────────────
     **There is no photograph of this and there cannot be one.** Nobody
     has ever stood outside it, and the thing has no outside to stand
     in. So this frame is a composite, assembled the way the real
     visualizations are assembled, and it is worth saying exactly what
     each part of it is standing in for:

       the galaxies   deep-field objects. Small, inclined at random,
                      and reddening with distance — because on this
                      diagram distance *is* lookback time, and the
                      furthest things visible are the youngest and the
                      most redshifted. That colour gradient is the one
                      piece of real physics in the picture.
       the web        survey-shaped structure. Filaments, knots and
                      voids, in the proportions the redshift surveys
                      find, drawn from a seed rather than from a
                      catalogue.
       the shell      the cosmic microwave background: the oldest light
                      there is, and the wall of the observable. Mottled,
                      because the real map is mottled at one part in
                      a hundred thousand, and the mottling is where
                      everything else in this exhibit came from.
       the rim        no edge. A gradient that runs out, because a
                      horizon is not a surface — it is just where we
                      stop being able to see, and it moves with you.

     The one thing here that never moves is the microwave background,
     and that is deliberate. It is a photograph of a single instant
     380,000 years after the beginning, it has been sitting there
     unchanged for 13.8 billion years, and animating it would be the
     one lie this frame cannot afford. Everything else drifts. */
  P.universe = (ctx, t, focus, wake) => {
    const w = wake || 0;
    const web = once("uni", () => {
      const r = rng(101), nodes = [], links = [];
      for (let i = 0; i < 400; i++) {
        const u = r() * 2 - 1, th = r() * TAU;
        const rr = Math.cbrt(r()) * 0.46, s = Math.sqrt(1 - u * u);
        nodes.push([Math.cos(th) * s * rr, Math.sin(th) * s * rr, u * rr,
                    0.0026 + r() * 0.0052,        // how big a smudge
                    0.3 + r() * 0.6,              // inclination, as a squash
                    r() * Math.PI, 0.3 + r() * 0.7]);
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1], dz = nodes[i][2] - nodes[j][2];
          if (dx * dx + dy * dy + dz * dz < 0.0075) links.push([i, j]);
        }
      }
      return { nodes, links };
    });
    // The mottled shell, built once and never touched again.
    const cmb = once("cmb", () => {
      const r = rng(103), out = [];
      for (let i = 0; i < 190; i++) {
        const th = r() * TAU, rr = 0.395 + Math.pow(r(), 0.6) * 0.105;
        out.push([Math.cos(th) * rr, Math.sin(th) * rr, 0.012 + r() * 0.036,
                  r() < 0.5 ? 1 : -1, 0.25 + r() * 0.75]);
      }
      return out;
    });

    glow(ctx, 0.5, "rgba(90,110,180,$)", [[0, 0.12], [0.6, 0.08], [0.9, 0.05], [1, 0]]);

    for (const [i, j] of web.links) {
      const p = web.nodes[i], q = web.nodes[j];
      const depth = 0.5 + 0.5 * ((p[2] + q[2]) / 2 / 0.46);
      ctx.strokeStyle = "rgba(160,175,235," + 0.085 * depth + ")";
      ctx.lineWidth = 0.0022;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }

    /* The deep field. Redshift with radius: near objects are drawn
       blue-white, far ones amber and then red, because the far ones are
       being seen as they were when the universe was a fifth its present
       size and every wavelength that left them has been stretched on
       the way here. */
    for (const n of web.nodes) {
      const depth = 0.45 + 0.55 * ((n[2] + 0.46) / 0.92);
      const z = Math.min(1, Math.hypot(n[0], n[1], n[2]) / 0.46);
      const R = Math.round(216 + 39 * z), G = Math.round(226 - 62 * z), B = Math.round(255 - 148 * z);
      const sz = n[3] * (1.25 - 0.5 * z);
      ctx.fillStyle = "rgba(" + R + "," + G + "," + B + "," + 0.30 * depth * n[6] + ")";
      ctx.beginPath();
      ctx.ellipse(n[0], n[1], sz * 1.7, sz * 1.7 * n[4], n[5], 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(" + R + "," + G + "," + B + "," + 0.55 * depth * n[6] + ")";
      ctx.beginPath();
      ctx.ellipse(n[0], n[1], sz * 0.7, sz * 0.7 * Math.max(0.5, n[4]), n[5], 0, TAU);
      ctx.fill();
    }

    /* Recession. Every one of these is moving away from every other
       one, so the flow runs outward — the opposite direction to
       Laniakea's, four rungs back, where everything was falling in
       toward one place. That difference is the whole of what changes
       between a supercluster and the universe. */
    ctx.lineCap = "round"; ctx.lineWidth = 0.0026;
    for (let i = 0; i < web.nodes.length; i += 6) {
      const n = web.nodes[i];
      const f = ((t * 0.035 + i * 0.0131) % 1 + 1) % 1;
      const s = 1 + f * 0.10, e = s + 0.055;
      ctx.strokeStyle = "rgba(196,206,255," + 0.20 * (1 - f) * (0.6 + 0.4 * w) + ")";
      ctx.beginPath();
      ctx.moveTo(n[0] * s, n[1] * s); ctx.lineTo(n[0] * e, n[1] * e);
      ctx.stroke();
    }

    /* The oldest light. Everything else in the frame grew out of the
       lumps in it, and this is the real measurement of them. */
    const shell = cmbShell();
    if (shell) {
      ctx.save();
      ctx.globalAlpha = 0.62 + 0.14 * w;
      ctx.drawImage(shell, -0.5, -0.5, 1, 1);
      ctx.restore();
    } else {
      // Seeded stand-in, for when the file has not arrived.
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.clip();
      for (const [x, y, rr, sign, br] of cmb) {
        ctx.fillStyle = sign > 0
          ? "rgba(255,146,86," + 0.055 * br + ")"
          : "rgba(96,128,225," + 0.050 * br + ")";
        ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    // A breath of the colour the thing actually is — 2.7 K, which is
    // microwave and has no colour at all, so this is the convention the
    // maps use and not a measurement.
    const g = ctx.createRadialGradient(0, 0, 0.34, 0, 0, 0.5);
    g.addColorStop(0, "rgba(255,150,90,0)");
    g.addColorStop(0.62, "rgba(255,150,90," + (0.030 + 0.015 * w) + ")");
    g.addColorStop(0.90, "rgba(255,178,120," + (0.075 + 0.03 * w) + ")");
    g.addColorStop(1, "rgba(255,120,70,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU); ctx.fill();
    // and no line at the edge, because there is no edge
  };

  P.forget = forget;
  return P;
})();
