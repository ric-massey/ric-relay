/* WORLD BUILDER — THE PHYSICS SANDBOX
   ────────────────────────────────────────────────────────────────────────
   A world made of hexagons, and a panel of settings that decide what its
   physics is. Every setting is a real term in the step below: turn gravity up
   and the pull between every pair of hexagons is that much stronger, turn
   chemistry off and nothing ever bonds. Nothing is scripted — a planet, a
   crystal or an orbit only turns up if the settings make one.

   What a hexagon is here: a body with a mass, a position, a velocity and some
   heat. Whether that is an atom or a planet is the visitor's choice of
   settings, not a different engine.

   This is a toy, not the Universe project (projects/universe/). That one runs
   on integers, asserts conservation to the unit and refuses a constant nobody
   chose. This one runs on floats and lets anybody choose anything, which is
   exactly what that project forbids — so it shares no code with it. Two ideas
   are borrowed from it, and credited in README.md: the bonding rule that reads
   a strength off two kinds by arithmetic rather than a table, and "matter is
   the sum of kinds", which is what lets two bodies fuse.

   One file, no dependencies, the same in a browser and in node (the tests in
   test/ run it there). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WBPhysics = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ── the settings ─────────────────────────────────────────────────────────
     One list. The page builds its controls from it, the engine reads the same
     keys, and the test walks every one — so a setting cannot exist on the page
     without doing something here. `say` turns a number into the words shown
     beside the slider. */
  const pct = v => Math.round(v * 100) + "%";
  const off = (words) => v => (v === 0 ? "off" : words(v));
  const SCHEMA = [
    { title: "The world", items: [
      { key: "size", label: "World size", type: "range", min: 40, max: 400, step: 10, def: 140,
        say: v => v + " hexagons across",
        help: "How wide the world is, measured in the smallest hexagon." },
      { key: "edge", label: "At the edge", type: "select", def: "wrap",
        options: [["wrap", "It loops round"], ["walls", "Walls — things bounce"], ["open", "Nothing — things leave"]],
        help: "What happens to something that reaches the side of the world." },
      { key: "seed", label: "Seed", type: "range", min: 1, max: 9999, step: 1, def: 7,
        say: v => "#" + v, help: "The same seed and settings start the same world." },
    ]},
    { title: "Matter", items: [
      { key: "count", label: "How many hexagons", type: "range", min: 2, max: 4000, step: 1, def: 900, curve: 2.2,
        say: v => v.toLocaleString("en-US"), help: "How many bodies the world starts with." },
      { key: "kinds", label: "How many kinds", type: "range", min: 1, max: 8, step: 1, def: 4,
        say: v => (v === 1 ? "one kind" : v + " kinds"),
        help: "Kind 1 is the lightest. A hexagon of kind 3 has three times its mass." },
      { key: "mix", when: s => s.kinds > 1, label: "Mix of kinds", type: "select", def: "light",
        options: [["equal", "Equal amounts"], ["light", "Mostly light"], ["heavy", "Mostly heavy"]] },
      { key: "sized", label: "Heavier is bigger", type: "toggle", def: true,
        help: "Off, every hexagon is the same size whatever it weighs." },
      { key: "layout", label: "How it starts", type: "select", def: "scatter",
        options: [["scatter", "Scattered everywhere"], ["cloud", "One cloud"], ["spin", "A spinning disc"],
                  ["two", "Two clouds on course to meet"], ["sun", "One big body and a ring of dust"]] },
      { key: "bigMass", when: s => s.layout === "sun", label: "The big body's mass", type: "range", min: 20, max: 3000, step: 10, def: 600, curve: 2,
        say: v => v + "× the smallest", help: "Only used when it starts as one big body and a ring." },
      { key: "spin", when: s => s.layout === "spin" || s.layout === "sun", label: "Starting spin", type: "range", min: 0, max: 1.5, step: 0.05, def: 1,
        say: v => (v === 0 ? "none" : v === 1 ? "just enough to orbit" : v < 1 ? pct(v) + " of orbit speed" : pct(v) + " — too fast to hold"),
        help: "For the disc and the ring. 100% is the speed at which gravity alone holds a circle." },
      { key: "startSpeed", label: "Starting speed", type: "range", min: 0, max: 12, step: 0.25, def: 1,
        say: off(v => v + " hexagons a second"), help: "Random motion every hexagon starts with." },
    ]},
    { title: "Gravity", items: [
      { key: "gravity", label: "Pull between hexagons", type: "range", min: 0, max: 60, step: 0.1, def: 0, curve: 2.5,
        say: off(v => (v < 1 ? "faint" : v < 6 ? "noticeable" : v < 20 ? "strong" : "crushing") + " (" + v + ")"),
        help: "Every hexagon pulls every other, in proportion to both masses." },
      { key: "reach", when: s => s.gravity > 0, label: "How far it reaches", type: "select", def: "far",
        options: [["far", "Far — fades slowly with distance"], ["near", "Near — fades quickly"]],
        help: "Far falls off as 1/distance, which is what gravity does in a flat world. Near falls off as 1/distance²." },
      { key: "fall", label: "Down", type: "range", min: 0, max: 30, step: 0.5, def: 0,
        say: off(v => v + " toward the bottom"), help: "A steady pull toward the bottom of the world, like standing on a planet. Give it walls." },
    ]},
    { title: "Collisions", items: [
      { key: "bounce", label: "Bounciness", type: "range", min: 0, max: 1, step: 0.05, def: 0.8,
        say: v => (v === 1 ? "perfect — nothing is lost" : v === 0 ? "none — a thud" : pct(v)),
        help: "What a collision does not give back as motion becomes heat." },
      { key: "fuse", label: "Fusing", type: "select", def: "never",
        options: [["never", "Never"], ["hard", "Only in a hard hit"], ["always", "Whenever two touch"]],
        help: "Two hexagons that fuse become one, with the mass of both." },
      { key: "fuseHit", when: s => s.fuse === "hard", label: "How hard a hit fuses", type: "range", min: 0.5, max: 200, step: 0.5, def: 20, curve: 2,
        say: v => v + " energy", help: "Only used when fusing needs a hard hit." },
    ]},
    { title: "Chemistry", items: [
      { key: "bonding", label: "What bonds", type: "select", def: "none",
        options: [["none", "Nothing — no chemistry"], ["any", "Anything with anything"],
                  ["sum", "Pairs that add up"], ["same", "Only the same kind"], ["other", "Only different kinds"]],
        help: "“Pairs that add up”: each kind has a number, and two bond most strongly when their numbers add up to one more than the number of kinds." },
      { key: "bondStrength", when: s => s.bonding !== "none", label: "Bond strength", type: "range", min: 0.2, max: 40, step: 0.2, def: 6, curve: 2,
        say: v => v + " energy", help: "The energy a full-strength bond gives off as heat when it forms, and takes to break." },
      { key: "bondChance", when: s => s.bonding !== "none", label: "How readily they bond", type: "range", min: 0.01, max: 1, step: 0.01, def: 0.4,
        say: pct, help: "The chance that two hexagons that could bond do, each time they touch." },
      { key: "maxBonds", when: s => s.bonding !== "none", label: "Bonds per hexagon", type: "range", min: 1, max: 6, step: 1, def: 3,
        say: v => "up to " + v, help: "One makes pairs, two makes chains and rings, three or more makes sheets." },
      { key: "bondSpeed", when: s => s.bonding !== "none", label: "Too fast to bond", type: "range", min: 0.5, max: 30, step: 0.5, def: 6,
        say: v => "over " + v + " a second", help: "Two hexagons meeting faster than this bounce instead." },
    ]},
    { title: "Heat", items: [
      { key: "startTemp", label: "Starting temperature", type: "range", min: 0, max: 40, step: 0.5, def: 0.5,
        say: v => (v === 0 ? "absolute zero" : String(v)), help: "Heat each hexagon starts with, per unit of mass." },
      { key: "shake", label: "Heat shakes things", type: "range", min: 0, max: 1, step: 0.05, def: 0.3,
        say: off(pct), help: "How quickly a hot hexagon turns its heat into motion. Off, heat is only a number." },
      { key: "conduct", label: "Heat spreads by touch", type: "range", min: 0, max: 1, step: 0.05, def: 0.4,
        say: off(pct), help: "How quickly heat moves between hexagons that touch or are bonded." },
      { key: "radiate", label: "Heat leaks away", type: "range", min: 0, max: 0.5, step: 0.005, def: 0.01, curve: 2,
        say: off(v => (v * 100).toFixed(1) + "% a second"), help: "How quickly every hexagon glows its heat off into nothing. This is how a world cools." },
      { key: "heater", label: "Something keeps it hot", type: "select", def: "none",
        options: [["none", "Nothing"], ["centre", "The middle of the world"], ["floor", "The bottom edge"]] },
      { key: "heaterTemp", when: s => s.heater !== "none", label: "How hot", type: "range", min: 1, max: 80, step: 1, def: 20,
        say: v => String(v), help: "The temperature the hot place is held at." },
    ]},
    { title: "Space and time", items: [
      { key: "drag", label: "Space is thick", type: "range", min: 0, max: 2, step: 0.02, def: 0, curve: 2,
        say: off(v => (v < 0.2 ? "a thin gas" : v < 0.8 ? "like water" : "like syrup")),
        help: "Slows everything down, all the time. The motion it takes is gone." },
      { key: "limit", label: "Speed limit", type: "range", min: 2, max: 200, step: 1, def: 60, curve: 2,
        say: v => v + " a second", help: "Nothing travels faster than this." },
      { key: "rate", label: "Clock", type: "range", min: 0.1, max: 4, step: 0.1, def: 1,
        say: v => v + "×", help: "How fast time runs. You can change this while it is running too." },
    ]},
  ];

  const DEFAULTS = {};
  for (const g of SCHEMA) for (const it of g.items) DEFAULTS[it.key] = it.def;

  /* Presets set only what they care about; everything else is the default.
     Each one is a set of ticked boxes a visitor could have ticked themselves. */
  const PRESETS = [
    { id: "gas", name: "A box of gas", note: "Nothing but motion and bouncing.",
      set: { count: 700, kinds: 2, edge: "walls", startSpeed: 6, bounce: 1, startTemp: 0, shake: 0, radiate: 0 } },
    { id: "crystals", name: "Chemistry", note: "Warm matter that bonds as it cools.",
      set: { count: 1300, size: 70, kinds: 5, sized: false, bonding: "sum", bondStrength: 8, maxBonds: 3,
             startTemp: 3, startSpeed: 1.5, radiate: 0.05, bounce: 0.6 } },
    { id: "planets", name: "Hexagons as planets", note: "One sun, a ring of bodies, gravity and nothing else.",
      set: { layout: "sun", count: 260, size: 300, kinds: 3, edge: "open", gravity: 4, reach: "near", bigMass: 900,
             spin: 1, startSpeed: 0, bounce: 0.5, fuse: "always", startTemp: 0, shake: 0, radiate: 0.05 } },
    { id: "accretion", name: "Dust into worlds", note: "A spinning disc under strong gravity, fusing where it meets.",
      set: { layout: "spin", count: 1500, size: 260, kinds: 2, edge: "open", gravity: 0.6, spin: 0.9, startSpeed: 0.4,
             fuse: "always", bounce: 0.3, startTemp: 0, shake: 0, radiate: 0.05 } },
    { id: "collide", name: "Two clouds collide", note: "Gravity holds each together until they meet.",
      set: { layout: "two", count: 1200, size: 240, kinds: 3, edge: "open", gravity: 0.5, startSpeed: 3, bounce: 0.4,
             fuse: "hard", fuseHit: 30, shake: 0.2 } },
    { id: "ground", name: "A world with a floor", note: "Down, walls, a hot floor and things that bond.",
      set: { count: 900, size: 90, kinds: 4, edge: "walls", fall: 3, bounce: 0.3, bonding: "any", bondStrength: 4,
             maxBonds: 2, heater: "floor", heaterTemp: 12, shake: 0.6, conduct: 0.6, radiate: 0.15, startSpeed: 2 } },
    { id: "all", name: "Everything on", note: "Gravity, chemistry, heat and fusing at once.",
      set: { layout: "cloud", count: 1400, size: 220, kinds: 6, edge: "wrap", gravity: 0.25, bonding: "sum",
             bondStrength: 10, maxBonds: 4, fuse: "hard", fuseHit: 60, startTemp: 4, startSpeed: 2, radiate: 0.01 } },
  ];

  function clean(input) {
    const S = {};
    for (const g of SCHEMA) for (const it of g.items) {
      let v = input && it.key in input ? input[it.key] : it.def;
      if (it.type === "range") {
        v = Number(v);
        if (!isFinite(v)) v = it.def;
        v = Math.min(it.max, Math.max(it.min, v));
      } else if (it.type === "toggle") {
        v = v === true || v === "true" || v === 1 || v === "1";
      } else if (!it.options.some(o => o[0] === v)) v = it.def;
      S[it.key] = v;
    }
    S.count = Math.round(S.count); S.kinds = Math.round(S.kinds);
    S.maxBonds = Math.round(S.maxBonds); S.seed = Math.round(S.seed);
    return S;
  }

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* How strongly two kinds bond, 0 to 1. Arithmetic on the two kinds, never a
     table of cases — the Universe project's rule 4, and its law 2 is where
     "sum" comes from: B = M − |v₁ + v₂ − M|. A fused body's kind is its mass,
     so it goes through the same arithmetic by remainder. */
  function affinity(rule, k1, k2, kinds) {
    if (rule === "none") return 0;
    if (rule === "any") return 1;
    const M = kinds + 1;
    const v1 = ((k1 - 1) % kinds) + 1, v2 = ((k2 - 1) % kinds) + 1;
    if (rule === "same") return v1 === v2 ? 1 : 0;
    if (rule === "other") return v1 !== v2 ? 1 : 0;
    return Math.max(0, (M - Math.abs(v1 + v2 - M)) / M);        // "sum"
  }

  const SOFT = 0.6;          // gravity's softening length, in hexagons
  /* The two reaches pull equally hard at this distance, so the one slider
     means about the same thing under either: beyond it "far" is the stronger,
     inside it "near" is. Without it "far" at any setting crushed the world. */
  const FAR_MATCH = 40;
  const BOND_K = 90;         // a bond's spring, per unit of the lighter mass
  const BOND_DAMP = 3;       // and what it loses to heat as it rings
  const BOND_SNAP = 1.7;     // times its rest length before it tears
  const BREAK_RATE = 3;      // attempts a second at shaking a bond loose
  const GRID = 16;           // gravity's coarse grid, cells a side
  const DIRECT_MAX = 500;    // bodies below which gravity is every pair exactly

  function create(input) {
    const S = clean(input);
    const R = rng(S.seed * 2654435761);
    const W = S.size, H = S.size;
    const wrap = S.edge === "wrap";
    const cap = S.count;

    const x = new Float64Array(cap), y = new Float64Array(cap);
    const vx = new Float64Array(cap), vy = new Float64Array(cap);
    const ax = new Float64Array(cap), ay = new Float64Array(cap);
    const m = new Float64Array(cap), r = new Float64Array(cap);
    const heat = new Float64Array(cap);
    const kind = new Int32Array(cap);
    const nb = new Uint8Array(cap);
    const alive = new Uint8Array(cap);
    const bonds = new Map();      // a * cap + b (a < b) → { a, b, B, rest }
    let n = 0;                    // slots used; dead ones stay where they are
    const tally = { time: 0, radiated: 0, dragged: 0, heated: 0, fused: 0, left: 0, bondsMade: 0, bondsBroken: 0 };

    const radiusOf = mass => (S.sized ? 0.5 * Math.sqrt(mass) : 0.5);

    function add(px, py, k, pvx, pvy, mass) {
      if (n >= cap) return -1;
      const i = n++;
      x[i] = px; y[i] = py; vx[i] = pvx || 0; vy[i] = pvy || 0;
      kind[i] = k; m[i] = mass || k; r[i] = radiusOf(m[i]);
      heat[i] = S.startTemp * m[i]; alive[i] = 1;
      return i;
    }

    function pickKind() {
      if (S.kinds === 1) return 1;
      if (S.mix === "equal") return 1 + Math.floor(R() * S.kinds);
      let total = 0;
      for (let k = 1; k <= S.kinds; k++) total += S.mix === "light" ? 1 / k : k;
      let roll = R() * total;
      for (let k = 1; k <= S.kinds; k++) {
        roll -= S.mix === "light" ? 1 / k : k;
        if (roll <= 0) return k;
      }
      return S.kinds;
    }

    /* ── the start ──────────────────────────────────────────────────────────
       Bodies are put on the points of a hexagonal lattice, so nothing starts
       inside anything else, and which points are used is the layout. */
    (function seedWorld() {
      const rmax = radiusOf(S.kinds);
      const gap = 2 * rmax * 1.08;
      const rowH = gap * Math.sqrt(3) / 2;
      const cx = W / 2, cy = H / 2;
      const jig = () => (R() - 0.5) * gap * 0.06;
      const thermal = () => {
        const a = R() * Math.PI * 2, s = S.startSpeed * (0.5 + R());
        return [Math.cos(a) * s, Math.sin(a) * s];
      };
      /* Speed of a circle at distance d from a centre holding `inside`. */
      const orbit = (inside, d) => {
        if (S.gravity <= 0 || d <= 0) return 0;
        const p = S.reach === "far" ? 1 : 2;
        const f = S.gravity * inside * d / Math.pow(d * d + SOFT * SOFT, (p + 1) / 2) / (p === 1 ? FAR_MATCH : 1);
        return Math.sqrt(f * d) * S.spin;
      };
      const sites = (inDisc, discR, ox, oy) => {
        const out = [];
        const rows = Math.floor(H / rowH), cols = Math.floor(W / gap);
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const px = (i + (j % 2 ? 0.5 : 0) + 0.25) * gap, py = (j + 0.5) * rowH;
          if (inDisc) {
            const d = Math.hypot(px - ox, py - oy);
            if (d > discR) continue;
            out.push([px, py, d]);
          } else out.push([px, py, 0]);
        }
        return out;
      };
      const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
      /* A disc just big enough to hold `count` at this loose a packing. */
      const discFor = (count, loose) => Math.min(W * 0.46, Math.sqrt(count * gap * rowH * loose / Math.PI) + gap);

      if (S.layout === "scatter") {
        const all = shuffle(sites(false));
        for (let i = 0; i < all.length && n < cap; i++) {
          const v = thermal();
          add(all[i][0] + jig(), all[i][1] + jig(), pickKind(), v[0], v[1]);
        }
      } else if (S.layout === "cloud" || S.layout === "spin") {
        const discR = discFor(cap, S.layout === "spin" ? 2.6 : 1.5);
        const all = shuffle(sites(true, discR, cx, cy)).slice(0, cap).sort((a, b) => a[2] - b[2]);
        const kinds = all.map(() => pickKind());
        let inside = 0;
        for (let i = 0; i < all.length; i++) {
          const s = all[i], v = thermal();
          let tx = 0, ty = 0;
          if (S.layout === "spin" && s[2] > 0) {
            const sp = orbit(inside, s[2]);
            tx = -(s[1] - cy) / s[2] * sp; ty = (s[0] - cx) / s[2] * sp;
          }
          inside += kinds[i];
          add(s[0] + jig(), s[1] + jig(), kinds[i], v[0] + tx, v[1] + ty);
        }
      } else if (S.layout === "two") {
        const each = Math.floor(cap / 2);
        const discR = Math.min(W * 0.2, discFor(each, 1.5));
        const closing = Math.max(1, S.startSpeed);
        for (const side of [-1, 1]) {
          const ox = cx + side * W * 0.27, oy = cy + side * discR * 0.5;
          const all = shuffle(sites(true, discR, ox, oy)).slice(0, each);
          for (const s of all) add(s[0] + jig(), s[1] + jig(), pickKind(), -side * closing, 0);
        }
      } else {                                                    // "sun"
        const big = add(cx, cy, Math.round(S.bigMass), 0, 0, S.bigMass);
        const inner = r[big] + 6 * rmax + 2, outer = Math.max(inner + gap * 3, W * 0.44);
        const all = shuffle(sites(true, outer, cx, cy).filter(s => s[2] >= inner)).slice(0, cap - 1);
        for (const s of all) {
          const sp = orbit(S.bigMass, s[2]), v = thermal();
          add(s[0] + jig(), s[1] + jig(), pickKind(),
              -(s[1] - cy) / s[2] * sp + v[0], (s[0] - cx) / s[2] * sp + v[1]);
        }
      }
      /* The world as a whole starts at rest, so a cloud does not drift off. */
      let px = 0, py = 0, mt = 0;
      for (let i = 0; i < n; i++) { px += m[i] * vx[i]; py += m[i] * vy[i]; mt += m[i]; }
      if (mt > 0 && S.layout !== "two") for (let i = 0; i < n; i++) { vx[i] -= px / mt; vy[i] -= py / mt; }
    })();

    const started = n;
    const startMass = (() => { let t = 0; for (let i = 0; i < n; i++) t += m[i]; return t; })();

    /* The shortest way from a to b, which in a looped world may be round the back. */
    function sep(d, span) {
      if (!wrap) return d;
      if (d > span / 2) return d - span;
      if (d < -span / 2) return d + span;
      return d;
    }

    /* ── gravity ───────────────────────────────────────────────────────────
       Every pair exactly while there are few enough; past that, bodies in the
       same or a neighbouring cell of a coarse grid pair exactly and each
       farther cell pulls as one lump at its centre of mass. The lump does not
       feel the pull back body by body, so the world's net force is taken out
       afterwards — otherwise it would slowly push itself across the screen. */
    const gm = new Float64Array(GRID * GRID), gx = new Float64Array(GRID * GRID), gy = new Float64Array(GRID * GRID);
    const gcell = new Int32Array(cap);
    let gridLists = null;
    function pull(i, dx, dy, mass, both, j) {
      const d2 = dx * dx + dy * dy + SOFT * SOFT;
      const f = S.reach === "far" ? S.gravity / (d2 * FAR_MATCH) : S.gravity / (d2 * Math.sqrt(d2));
      ax[i] += f * mass * dx; ay[i] += f * mass * dy;
      if (both) { ax[j] -= f * m[i] * dx; ay[j] -= f * m[i] * dy; }
    }
    function gravity() {
      if (S.gravity <= 0) return;
      let live = 0;
      for (let i = 0; i < n; i++) if (alive[i]) live++;
      if (live <= DIRECT_MAX) {
        for (let i = 0; i < n; i++) {
          if (!alive[i]) continue;
          for (let j = i + 1; j < n; j++) {
            if (!alive[j]) continue;
            pull(i, sep(x[j] - x[i], W), sep(y[j] - y[i], H), m[j], true, j);
          }
        }
        return;
      }
      /* The grid covers the world, or — in an open one — wherever things are. */
      let x0 = 0, y0 = 0, x1 = W, y1 = H;
      if (S.edge === "open") {
        x0 = y0 = Infinity; x1 = y1 = -Infinity;
        for (let i = 0; i < n; i++) if (alive[i]) {
          if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i];
          if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i];
        }
        x1 += 1e-6; y1 += 1e-6;
      }
      const cw = (x1 - x0) / GRID, ch = (y1 - y0) / GRID;
      gm.fill(0); gx.fill(0); gy.fill(0);
      if (!gridLists) { gridLists = []; for (let c = 0; c < GRID * GRID; c++) gridLists.push([]); }
      for (let c = 0; c < GRID * GRID; c++) gridLists[c].length = 0;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const ci = Math.min(GRID - 1, Math.max(0, Math.floor((x[i] - x0) / cw)));
        const cj = Math.min(GRID - 1, Math.max(0, Math.floor((y[i] - y0) / ch)));
        const c = cj * GRID + ci;
        gcell[i] = c; gm[c] += m[i]; gx[c] += m[i] * x[i]; gy[c] += m[i] * y[i];
        gridLists[c].push(i);
      }
      for (let c = 0; c < GRID * GRID; c++) if (gm[c] > 0) { gx[c] /= gm[c]; gy[c] /= gm[c]; }
      /* Written out flat, with nothing looked up inside the loop: this is the
         hottest code in the file by a wide margin. */
      const G = S.reach === "far" ? S.gravity / FAR_MATCH : S.gravity, far = S.reach === "far";
      const s2 = SOFT * SOFT, hW = W / 2, hH = H / 2;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const ci = gcell[i] % GRID, cj = (gcell[i] - ci) / GRID, xi = x[i], yi = y[i];
        let fxi = 0, fyi = 0;
        for (let c = 0; c < GRID * GRID; c++) {
          const mc = gm[c];
          if (mc === 0) continue;
          const di = c % GRID, dj = (c - di) / GRID;
          let ddi = di > ci ? di - ci : ci - di, ddj = dj > cj ? dj - cj : cj - dj;
          if (wrap) { if (ddi > GRID - ddi) ddi = GRID - ddi; if (ddj > GRID - ddj) ddj = GRID - ddj; }
          if (ddi <= 1 && ddj <= 1) {
            const list = gridLists[c];
            for (let q = 0; q < list.length; q++) {
              const j = list[q];
              if (j === i) continue;
              let dx = x[j] - xi, dy = y[j] - yi;
              if (wrap) { if (dx > hW) dx -= W; else if (dx < -hW) dx += W; if (dy > hH) dy -= H; else if (dy < -hH) dy += H; }
              const d2 = dx * dx + dy * dy + s2, f = (far ? G / d2 : G / (d2 * Math.sqrt(d2))) * m[j];
              fxi += f * dx; fyi += f * dy;
            }
          } else {
            let dx = gx[c] - xi, dy = gy[c] - yi;
            if (wrap) { if (dx > hW) dx -= W; else if (dx < -hW) dx += W; if (dy > hH) dy -= H; else if (dy < -hH) dy += H; }
            const d2 = dx * dx + dy * dy + s2, f = (far ? G / d2 : G / (d2 * Math.sqrt(d2))) * mc;
            fxi += f * dx; fyi += f * dy;
          }
        }
        ax[i] += fxi; ay[i] += fyi;
      }
      let fx = 0, fy = 0, mt = 0;
      for (let i = 0; i < n; i++) if (alive[i]) { fx += m[i] * ax[i]; fy += m[i] * ay[i]; mt += m[i]; }
      if (mt > 0) for (let i = 0; i < n; i++) if (alive[i]) { ax[i] -= fx / mt; ay[i] -= fy / mt; }
    }

    /* ── bonds ─────────────────────────────────────────────────────────────
       A bond is a spring at the distance the two were touching. Forming one
       gives off its energy as heat; breaking one takes it back, out of the
       pair's heat when heat shook it loose and out of thin air when it was
       torn (the tally counts that as work done on the world). */
    const key = (a, b) => (a < b ? a * cap + b : b * cap + a);
    function bondTemp(a, b) { return (heat[a] + heat[b]) / (m[a] + m[b]); }
    function unbond(k, bd) { bonds.delete(k); nb[bd.a]--; nb[bd.b]--; tally.bondsBroken++; }
    function bondForces(dt) {
      for (const [k, bd] of bonds) {
        const a = bd.a, b = bd.b;
        const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
        const d = Math.hypot(dx, dy) || 1e-9;
        if (d > bd.rest * BOND_SNAP) {
          const take = Math.min(bd.B, heat[a] + heat[b]);
          const share = heat[a] + heat[b] > 0 ? take / (heat[a] + heat[b]) : 0;
          heat[a] -= heat[a] * share; heat[b] -= heat[b] * share;
          tally.heated += bd.B - take;
          unbond(k, bd);
          continue;
        }
        const ux = dx / d, uy = dy / d;
        const mu = m[a] * m[b] / (m[a] + m[b]);
        const vn = (vx[b] - vx[a]) * ux + (vy[b] - vy[a]) * uy;
        const spring = BOND_K * mu * (d - bd.rest);
        /* What the damper takes out of the ringing goes into the pair as heat. */
        const damp = BOND_DAMP * mu * vn;
        const lost = damp * vn * dt;
        heat[a] += lost / 2; heat[b] += lost / 2;
        const f = spring + damp;
        ax[a] += f * ux / m[a]; ay[a] += f * uy / m[a];
        ax[b] -= f * ux / m[b]; ay[b] -= f * uy / m[b];
      }
    }
    function shakeBonds(dt) {
      if (!bonds.size) return;
      for (const [k, bd] of bonds) {
        const T = bondTemp(bd.a, bd.b);
        if (T <= 0) continue;
        if (R() < BREAK_RATE * dt * Math.exp(-bd.B / T)) {
          const have = heat[bd.a] + heat[bd.b];
          if (have < bd.B) continue;                 // not enough heat here to pay for it
          const share = bd.B / have;
          heat[bd.a] -= heat[bd.a] * share; heat[bd.b] -= heat[bd.b] * share;
          unbond(k, bd);
        }
      }
    }

    /* ── touching ──────────────────────────────────────────────────────────
       A uniform grid finds who is near whom. A body bigger than a cell is kept
       off the grid and tested against everybody, because there are never many
       of those and one in the grid would make every cell its neighbour. */
    let cs = 2, hw = 1, hh = 1, heads = new Int32Array(1), nexts = new Int32Array(cap);
    const bigs = [];
    function buildHash() {
      let x0 = 0, y0 = 0;
      if (S.edge === "open") {
        let x1 = -Infinity, y1 = -Infinity; x0 = y0 = Infinity;
        for (let i = 0; i < n; i++) if (alive[i]) {
          if (x[i] < x0) x0 = x[i]; if (x[i] > x1) x1 = x[i];
          if (y[i] < y0) y0 = y[i]; if (y[i] > y1) y1 = y[i];
        }
        if (x0 === Infinity) { x0 = y0 = 0; x1 = y1 = 1; }
        cs = Math.max(2.4 * radiusOf(S.kinds), (x1 - x0) / 300, (y1 - y0) / 300, 1.2);
        hw = Math.floor((x1 - x0) / cs) + 1; hh = Math.floor((y1 - y0) / cs) + 1;
      } else {
        cs = Math.max(2.4 * radiusOf(S.kinds), 1.2);
        hw = Math.max(3, Math.floor(W / cs)); hh = Math.max(3, Math.floor(H / cs));
        cs = W / hw;
      }
      if (heads.length < hw * hh) heads = new Int32Array(hw * hh);
      heads.fill(-1, 0, hw * hh);
      bigs.length = 0;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (r[i] > cs * 0.5) { bigs.push(i); continue; }
        const ci = Math.min(hw - 1, Math.max(0, Math.floor((x[i] - x0) / cs)));
        const cj = Math.min(hh - 1, Math.max(0, Math.floor((y[i] - y0) / (S.edge === "open" ? cs : H / hh))));
        const c = cj * hw + ci;
        nexts[i] = heads[c]; heads[c] = i;
      }
    }
    function eachPair(fn) {
      for (let cj = 0; cj < hh; cj++) for (let ci = 0; ci < hw; ci++) {
        for (let i = heads[cj * hw + ci]; i >= 0; i = nexts[i]) {
          for (let j = nexts[i]; j >= 0; j = nexts[j]) fn(i, j);
          /* Half the neighbouring cells, so each pair of cells is met once. */
          for (let q = 0; q < 4; q++) {
            let ni = ci + (q === 0 ? 1 : q === 1 ? -1 : q === 2 ? 0 : 1), nj = cj + (q === 0 ? 0 : 1);
            if (wrap) { ni = (ni + hw) % hw; nj = (nj + hh) % hh; }
            else if (ni < 0 || ni >= hw || nj >= hh) continue;
            if (wrap && (hw < 3 || hh < 3)) continue;
            for (let j = heads[nj * hw + ni]; j >= 0; j = nexts[j]) fn(i, j);
          }
        }
      }
      for (let b = 0; b < bigs.length; b++) {
        const i = bigs[b];
        if (!alive[i]) continue;
        for (let j = 0; j < n; j++) {
          if (!alive[j] || j === i) continue;
          if (r[j] > cs * 0.5 && j < i) continue;     // two bigs meet once
          fn(i, j);
        }
      }
    }

    function fuse(a, b) {
      /* The heavier one stays. Momentum is kept exactly; the motion the pair
         had relative to each other has nowhere to go but heat. */
      if (m[b] > m[a]) { const t = a; a = b; b = t; }
      const M = m[a] + m[b];
      const dx = sep(x[b] - x[a], W), dy = sep(y[b] - y[a], H);
      const rvx = vx[b] - vx[a], rvy = vy[b] - vy[a];
      const lost = 0.5 * (m[a] * m[b] / M) * (rvx * rvx + rvy * rvy);
      x[a] += dx * m[b] / M; y[a] += dy * m[b] / M;
      vx[a] = (m[a] * vx[a] + m[b] * vx[b]) / M; vy[a] = (m[a] * vy[a] + m[b] * vy[b]) / M;
      heat[a] += heat[b] + lost;
      m[a] = M; kind[a] = Math.max(1, Math.round(M)); r[a] = radiusOf(M);
      for (const [k, bd] of bonds) if (bd.a === b || bd.b === b || bd.a === a || bd.b === a) {
        heat[a] += 0; unbond(k, bd); tally.bondsBroken--;       // dissolved into the new body, not broken
      }
      alive[b] = 0; tally.fused++;
    }

    function touch(i, j, dt) {
      if (!alive[i] || !alive[j]) return;
      const dx = sep(x[j] - x[i], W), dy = sep(y[j] - y[i], H);
      const reach = r[i] + r[j];
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach * 1.21) return;
      const d = Math.sqrt(d2) || 1e-9;
      const ux = dx / d, uy = dy / d;
      /* Heat moves between anything close enough to be touching. */
      if (S.conduct > 0) {
        const Ti = heat[i] / m[i], Tj = heat[j] / m[j];
        const flow = Math.min(0.5, S.conduct * 6 * dt) * (Ti - Tj) * (m[i] * m[j] / (m[i] + m[j]));
        heat[i] -= flow; heat[j] += flow;
      }
      if (d > reach) return;
      const bonded = bonds.has(key(i, j));
      const vn = (vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy;
      const mu = m[i] * m[j] / (m[i] + m[j]);
      if (!bonded && S.fuse !== "never" && (S.fuse === "always" || (vn < 0 && 0.5 * mu * vn * vn > S.fuseHit))) {
        fuse(i, j);
        return;
      }
      if (bonded) return;                         // the spring is already holding these two apart
      /* Pushed apart so they do not sit inside each other, the lighter one
         moving most, and bounced if they were closing. */
      const over = (reach - d) * 0.5;
      const wi = m[j] / (m[i] + m[j]), wj = m[i] / (m[i] + m[j]);
      x[i] -= ux * over * 2 * wi; y[i] -= uy * over * 2 * wi;
      x[j] += ux * over * 2 * wj; y[j] += uy * over * 2 * wj;
      if (vn < 0) {
        const e = S.bounce;
        const jn = -(1 + e) * vn * mu;
        vx[i] -= jn * ux / m[i]; vy[i] -= jn * uy / m[i];
        vx[j] += jn * ux / m[j]; vy[j] += jn * uy / m[j];
        const lost = 0.5 * mu * vn * vn * (1 - e * e);
        heat[i] += lost * wj; heat[j] += lost * wi;
      }
      if (S.bonding !== "none" && nb[i] < S.maxBonds && nb[j] < S.maxBonds && Math.abs(vn) < S.bondSpeed) {
        const a = affinity(S.bonding, kind[i], kind[j], S.kinds);
        if (a > 0 && R() < S.bondChance * Math.min(1, dt * 30)) {
          const B = S.bondStrength * a;
          bonds.set(key(i, j), { a: Math.min(i, j), b: Math.max(i, j), B: B, rest: reach });
          nb[i]++; nb[j]++; tally.bondsMade++;
          heat[i] += B * wj; heat[j] += B * wi;
        }
      }
    }

    function heatStep(dt) {
      const cxm = W / 2, cym = H / 2, hot = S.heater, hr = W * 0.1;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (hot !== "none") {
          const inHot = hot === "centre" ? Math.hypot(x[i] - cxm, y[i] - cym) < hr : y[i] > H - 2.5;
          if (inHot) {
            const want = S.heaterTemp * m[i];
            if (heat[i] < want) { tally.heated += want - heat[i]; heat[i] = want; }
          }
        }
        if (S.radiate > 0 && heat[i] > 0) {
          const out = heat[i] * Math.min(1, S.radiate * dt);
          heat[i] -= out; tally.radiated += out;
        }
        /* Heat becomes a shove in a random direction, and is charged for
           exactly the motion the shove made — so energy is neither made nor
           lost here, only moved. */
        if (S.shake > 0 && heat[i] > 1e-9) {
          const dE = heat[i] * Math.min(0.5, S.shake * 2 * dt);
          const a = R() * 6.283185307, dv = Math.sqrt(2 * dE / m[i]);
          const kx = Math.cos(a) * dv, ky = Math.sin(a) * dv;
          const cost = m[i] * (vx[i] * kx + vy[i] * ky) + dE;
          if (cost <= heat[i]) { vx[i] += kx; vy[i] += ky; heat[i] -= cost; }
        }
      }
    }

    function edges() {
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        if (wrap) {
          if (x[i] < 0) x[i] += W; else if (x[i] >= W) x[i] -= W;
          if (y[i] < 0) y[i] += H; else if (y[i] >= H) y[i] -= H;
          if (!(x[i] >= 0 && x[i] < W)) x[i] = ((x[i] % W) + W) % W;
          if (!(y[i] >= 0 && y[i] < H)) y[i] = ((y[i] % H) + H) % H;
        } else if (S.edge === "walls") {
          const e = S.bounce;
          if (x[i] < r[i]) { x[i] = r[i]; if (vx[i] < 0) { heat[i] += 0.5 * m[i] * vx[i] * vx[i] * (1 - e * e); vx[i] = -vx[i] * e; } }
          if (x[i] > W - r[i]) { x[i] = W - r[i]; if (vx[i] > 0) { heat[i] += 0.5 * m[i] * vx[i] * vx[i] * (1 - e * e); vx[i] = -vx[i] * e; } }
          if (y[i] < r[i]) { y[i] = r[i]; if (vy[i] < 0) { heat[i] += 0.5 * m[i] * vy[i] * vy[i] * (1 - e * e); vy[i] = -vy[i] * e; } }
          if (y[i] > H - r[i]) { y[i] = H - r[i]; if (vy[i] > 0) { heat[i] += 0.5 * m[i] * vy[i] * vy[i] * (1 - e * e); vy[i] = -vy[i] * e; } }
        } else if (x[i] < -W * 2 || x[i] > W * 3 || y[i] < -H * 2 || y[i] > H * 3) {
          /* Gone for good: three worlds' width out and still going. */
          for (const [k, bd] of bonds) if (bd.a === i || bd.b === i) unbond(k, bd);
          alive[i] = 0; tally.left++;
        }
      }
    }

    /* Gravity is worked out once for each call to `step` and held through its
       substeps: the field changes slowly next to how fast two hexagons bounce,
       and working it out is most of what a big world costs. */
    const gax = new Float64Array(cap), gay = new Float64Array(cap);
    function substep(dt) {
      ax.set(gax); ay.set(gay);
      bondForces(dt);
      const lim = S.limit, keep = S.drag > 0 ? Math.exp(-S.drag * dt) : 1;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        vx[i] += ax[i] * dt; vy[i] += (ay[i] + S.fall) * dt;
        if (keep < 1) {
          const before = vx[i] * vx[i] + vy[i] * vy[i];
          vx[i] *= keep; vy[i] *= keep;
          tally.dragged += 0.5 * m[i] * before * (1 - keep * keep);
        }
        const sp = Math.hypot(vx[i], vy[i]);
        if (sp > lim) { vx[i] *= lim / sp; vy[i] *= lim / sp; }
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      }
      edges();
      buildHash();
      eachPair((i, j) => touch(i, j, dt));
      heatStep(dt);
      shakeBonds(dt);
      tally.time += dt;
    }

    /* One call advances `seconds` of the world's time. The step is kept short
       enough that the fastest thing in the world crosses less than a third of
       the smallest hexagon in one, so nothing tunnels through anything. */
    function step(seconds) {
      let fastest = 1;
      for (let i = 0; i < n; i++) if (alive[i]) {
        const sp = Math.abs(vx[i]) + Math.abs(vy[i]);
        if (sp > fastest) fastest = sp;
      }
      const parts = Math.min(8, Math.max(1, Math.ceil(seconds * fastest / 0.3), Math.ceil(seconds * 90)));
      const dt = seconds / parts;
      ax.fill(0); ay.fill(0);
      gravity();
      gax.set(ax); gay.set(ay);
      for (let p = 0; p < parts; p++) substep(dt);
    }

    /* What is in the world right now. Clusters are counted here, when asked,
       from the bonds — a cluster is never stored. */
    const parent = new Int32Array(cap);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function stats() {
      let count = 0, mass = 0, ke = 0, ht = 0, px = 0, py = 0, biggest = 0, heaviest = 0;
      for (let i = 0; i < n; i++) {
        parent[i] = i;
        if (!alive[i]) continue;
        count++; mass += m[i]; ht += heat[i];
        ke += 0.5 * m[i] * (vx[i] * vx[i] + vy[i] * vy[i]);
        px += m[i] * vx[i]; py += m[i] * vy[i];
        if (m[i] > heaviest) heaviest = m[i];
      }
      let be = 0;
      for (const bd of bonds.values()) { be += bd.B; const a = find(bd.a), b = find(bd.b); if (a !== b) parent[a] = b; }
      const sizes = new Map();
      for (const bd of bonds.values()) { const f = find(bd.a); sizes.set(f, 0); }
      let clustered = 0;
      for (let i = 0; i < n; i++) if (alive[i] && nb[i] > 0) { const f = find(i); sizes.set(f, (sizes.get(f) || 0) + 1); clustered++; }
      for (const s of sizes.values()) if (s > biggest) biggest = s;
      return {
        time: tally.time, count: count, started: started, mass: mass, startMass: startMass,
        motion: ke, heat: ht, bondEnergy: be, temperature: mass > 0 ? ht / mass : 0,
        momentumX: px, momentumY: py, bonds: bonds.size, clusters: sizes.size, biggest: biggest,
        clustered: clustered, heaviest: heaviest,
        radiated: tally.radiated, dragged: tally.dragged, heated: tally.heated,
        fused: tally.fused, left: tally.left, bondsMade: tally.bondsMade, bondsBroken: tally.bondsBroken,
      };
    }

    /* The body under a point, for the inspector. */
    function at(px, py) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < n; i++) {
        if (!alive[i]) continue;
        const d = Math.hypot(sep(px - x[i], W), sep(py - y[i], H)) - r[i];
        if (d < bd) { bd = d; best = i; }
      }
      return bd < 0.6 ? best : -1;
    }
    function describe(i) {
      if (i < 0 || !alive[i]) return null;
      const with_ = [];
      for (const bd of bonds.values()) if (bd.a === i || bd.b === i) with_.push({ other: bd.a === i ? bd.b : bd.a, strength: bd.B });
      return { id: i, kind: kind[i], mass: m[i], temperature: heat[i] / m[i], heat: heat[i],
               speed: Math.hypot(vx[i], vy[i]), bonds: with_ };
    }

    return {
      settings: S, width: W, height: H, cap: cap,
      x: x, y: y, vx: vx, vy: vy, m: m, r: r, heat: heat, kind: kind, nb: nb, alive: alive, bonds: bonds,
      get n() { return n; },
      step: step, stats: stats, at: at, describe: describe,
      /* The clock and a few others can be turned while it runs. */
      set: function (k, v) { const next = clean(Object.assign({}, S, { [k]: v })); S[k] = next[k]; },
    };
  }

  return { SCHEMA: SCHEMA, DEFAULTS: DEFAULTS, PRESETS: PRESETS, clean: clean, create: create, affinity: affinity };
});
