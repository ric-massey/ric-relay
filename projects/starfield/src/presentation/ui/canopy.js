/* ══════════════════════════════════════════════════════════════════════
   canopy.js — the three cockpit presets.

   HUD and Cockpit §2. Ric's specification, refined against the reference
   images in docs/UI:cockpit visuals/ (2026-07-26):

     · **clean**   — nothing at all. Glass and sky.
     · **luxury**  — the sleek canopy. Composite mullions, soft bevels, a
                     warm rim light. No console: the no-desk rule (§2.1)
                     is this preset's, and glass area is what it is
                     protecting.
     · **console** — the industrial canopy. Heavier structure, rivets,
                     stencilled labels, and the jet console below it
                     (§2.3, "because it's like a jet").

   Luxury and console are the *same window* in two finishes; the player
   picks one or the other. That is Ric's call, 2026-07-26: both reference
   images are presets, not a choice between them.

   ── the shape ────────────────────────────────────────────────────────
   The important correction against the reference images: the frame is
   **mullions across the glass**, not a border drawn around it. What makes
   the reference read as a cockpit rather than as a vignette is:

     · a **transom** running across the upper fifth, with a band of panes
       above it;
     · two **mullions converging downward** from the transom, framing one
       enormous forward pane;
     · **side panes** outboard of those, carrying the octagon's chamfer.

   The forward pane is the whole middle of the screen and nothing crosses
   it — §2.1's hard rule. The transom sits well above the crosshair and the
   upper verticals are placed either side of centre, so the column directly
   above the nose stays clear too.

   Struts are drawn as **filled quads**, not strokes. A stroke is a line; a
   quad can carry a gradient across its width, and that gradient is the
   entire reason the frame reads as a lit surface with thickness rather
   than as UI chrome. §22.2 of the architecture: this is a DOM layer, and
   with no geometry to model the frame is a styling problem.
   ══════════════════════════════════════════════════════════════════════ */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Everything below is in a 0..100 viewBox drawn with
 * `preserveAspectRatio="none"`, so the canopy always fills the window.
 * One x unit is therefore wider than one y unit on a landscape screen,
 * which is why widths are given per-axis rather than as one number.
 */
const GLASS = { halfW: 49.2, halfH: 50.5, chamferX: 9.5, chamferY: 8.5 };

/** The transom, and the band of panes above it. */
const TRANSOM = { y: 21.5, half: 1.9 };

/** The two mullions framing the forward pane. They converge downward. */
const MULLION = { topX: [25.5, 74.5], botX: [38.5, 61.5], half: 1.15 };

/** Verticals dividing the upper band — placed off-centre, never above the nose. */
const UPPER = { x: [34, 66], half: 0.7 };

/**
 * Where the glass stops.
 *
 * The console preset gives up the bottom sixth of the view and no more.
 * §11 leaves console density untuned and names the governing constraint:
 * this is the one preset allowed to trade view for presence, but the
 * reference image spends about this much and it still reads as a jet.
 */
const GLASS_BOTTOM = { luxury: 50 + GLASS.halfH, console: 84 };

function el(name, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

const toPath = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ") + " Z";

/**
 * The glass outline: an octagon, optionally with its bottom chamfer
 * removed where a console meets it square.
 */
function glassOutline(bottomY, chamferBottom = GLASS.chamferY) {
  const { halfW, halfH, chamferX, chamferY } = GLASS;
  const l = 50 - halfW, r = 50 + halfW, t = 50 - halfH, b = bottomY;
  const pts = [
    [l + chamferX, t],
    [r - chamferX, t],
    [r, t + chamferY],
  ];
  if (chamferBottom > 0) {
    pts.push([r, b - chamferBottom], [r - chamferX, b], [l + chamferX, b], [l, b - chamferBottom]);
  } else {
    pts.push([r, b], [l, b]);
  }
  pts.push([l, t + chamferY]);
  return pts;
}

/** A vertical-ish strut as a filled quad, so it can carry a gradient. */
const vBeam = (x1, y1, x2, y2, half) => [
  [x1 - half, y1], [x1 + half, y1], [x2 + half, y2], [x2 - half, y2],
];

/** A horizontal strut. */
const hBeam = (x1, x2, y, half) => [
  [x1, y - half], [x2, y - half], [x2, y + half], [x1, y + half],
];

/**
 * The line a strut's gradient must run along: **perpendicular to the
 * strut**, not horizontal.
 *
 * This is the whole reason the mullions have their own gradients. They
 * lean, so their bounding box is as wide as the lean is long; a gradient
 * laid across that box runs from the top of the strut to the bottom and
 * the cross-section — the thing that makes a flat quad read as a lit
 * extrusion — disappears entirely.
 *
 * The quad is offset along one axis only, so its true half-width is that
 * offset projected onto the normal.
 *
 * @param {'x'|'y'} offsetAxis  which way `half` was applied
 */
function crossAxis(x1, y1, x2, y2, half, offsetAxis) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dy / len, ny = -dx / len;
  const w = half * Math.abs(offsetAxis === "x" ? dy / len : dx / len);
  return [mx - nx * w, my - ny * w, mx + nx * w, my + ny * w];
}

/* ── gradients ─────────────────────────────────────────────────────────
   Two finishes, and they differ almost entirely here. Luxury is a dark
   composite with a cool sheen and one warm highlight along the top edge —
   the rim light in the reference image. Console is painted metal: flatter,
   greyer, dirtier, with the highlight closer to the middle so the strut
   reads as a rounded extrusion rather than a bevelled panel. */

/**
 * The cross-section of a strut, as gradient stops.
 *
 * Luxury is a dark composite: near-black through the body, with a narrow
 * cool highlight down one side where the light catches the bevel. Console
 * is painted metal — lighter overall, and its highlight sits nearer the
 * middle, so the strut reads as a rounded extrusion rather than a
 * bevelled panel. That one difference does most of the work of telling
 * the two finishes apart.
 */
const CROSS_SECTION = {
  luxury: [
    [0, "rgba(120,146,164,0.55)"],
    [0.1, "rgba(30,40,50,0.97)"],
    [0.45, "rgba(8,11,15,0.99)"],
    [0.86, "rgba(14,19,25,0.98)"],
    [1, "rgba(70,90,104,0.5)"],
  ],
  console: [
    [0, "rgba(48,54,58,0.97)"],
    [0.22, "rgba(104,113,117,0.97)"],
    [0.46, "rgba(78,86,91,0.98)"],
    [1, "rgba(22,27,31,0.98)"],
  ],
};

/**
 * The gradients that do not depend on a particular strut.
 *
 * The per-strut ones cannot live here: a leaning mullion's bounding box is
 * as wide as its lean, so an `objectBoundingBox` gradient runs *along* the
 * strut instead of across it and the whole thing washes out to one flat
 * tone. Each beam therefore gets its own `userSpaceOnUse` gradient, laid
 * on the axis across its width — see `beam()`.
 */
function defsFor(preset) {
  const defs = el("defs");

  const grad = (id, stops, x1, y1, x2, y2) => {
    const g = el("linearGradient", { id, x1, y1, x2, y2, gradientUnits: "objectBoundingBox" });
    for (const [offset, color] of stops) g.append(el("stop", { offset, "stop-color": color }));
    defs.append(g);
  };

  if (preset === "luxury") {
    grad("sf-surround", [[0, "rgba(13,18,24,0.98)"], [1, "rgba(4,6,9,0.99)"]], 0, 0, 0, 1);
  } else {
    grad("sf-surround", [[0, "rgba(40,45,49,0.97)"], [1, "rgba(15,19,22,0.99)"]], 0, 0, 0, 1);
    grad("sf-console", [
      [0, "rgba(112,120,124,0.98)"],
      [0.16, "rgba(72,80,84,0.99)"],
      [1, "rgba(18,23,27,1)"],
    ], 0, 0, 0, 1);
  }

  return defs;
}

/* ── the pieces ───────────────────────────────────────────────────── */

/**
 * Rivets along a line. Console preset only — they are the single cheapest
 * cue that the frame is a fabricated object rather than a drawn one.
 */
function rivets(svg, x1, y1, x2, y2, count) {
  for (let i = 1; i < count; i++) {
    const t = i / count;
    svg.append(el("rect", {
      x: x1 + (x2 - x1) * t - 0.22,
      y: y1 + (y2 - y1) * t - 0.22,
      width: 0.44, height: 0.44, rx: 0.22,
      class: "sf-rivet",
    }));
  }
}

/** A stencilled label, the way real hardware is marked up. */
function stencil(svg, x, y, text, anchor = "start") {
  svg.append(el("text", {
    x, y, class: "sf-stencil", "text-anchor": anchor,
  }, document.createTextNode(text)));
}

/**
 * The console. §2.3: it exists because the preset is meant to feel like a
 * jet, and it is the one preset allowed to trade view for presence — which
 * is exactly why it is not the only one.
 *
 * The silhouette rises toward the centre, the way a real instrument coaming
 * does, so the corners of the lower view survive.
 */
function buildConsole(svg) {
  const top = GLASS_BOTTOM.console;
  const face = [
    [-4, 101], [-4, top + 6],
    [10, top + 4.5], [30, top + 2.4],
    [40, top - 0.6], [60, top - 0.6],
    [70, top + 2.4], [90, top + 4.5],
    [104, top + 6], [104, 101],
  ];
  svg.append(el("path", { d: toPath(face), fill: "url(#sf-console)", class: "sf-console" }));
  // The coaming: the lip along the top of the console, catching light.
  svg.append(el("path", {
    d: face.slice(1, -1).map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" "),
    class: "sf-coaming", fill: "none",
  }));

  // Instrument bezels. Rectangles, not readouts: nothing here pretends to
  // display a value the simulation does not have.
  for (const [x, w] of [[13, 9], [24.5, 7], [66.5, 7], [77, 9]]) {
    svg.append(el("rect", {
      x, y: top + 7.5, width: w, height: 5.4, rx: 0.6, class: "sf-bezel",
    }));
  }
  // The centre stack, raised above the rest.
  svg.append(el("rect", { x: 41, y: top + 3.2, width: 18, height: 7.2, rx: 0.8, class: "sf-bezel sf-bezel--main" }));

  // Switch banks — small, dense, and at the very edge of the view.
  for (const base of [34.5, 61]) {
    for (let i = 0; i < 4; i++) {
      svg.append(el("rect", {
        x: base + i * 1.15, y: top + 8.4, width: 0.62, height: 2.1, rx: 0.3, class: "sf-switch",
      }));
    }
  }

  // The wiring loom, and the labels that name it. Straight from the
  // reference image, and the reason the preset reads as "lived in".
  svg.append(el("path", {
    d: `M-2 ${top + 12.6} C 14 ${top + 11.2}, 26 ${top + 13.4}, 36 ${top + 12.2}`,
    class: "sf-loom", fill: "none",
  }));
  svg.append(el("path", {
    d: `M102 ${top + 12.6} C 86 ${top + 11.2}, 74 ${top + 13.4}, 64 ${top + 12.2}`,
    class: "sf-loom", fill: "none",
  }));
  stencil(svg, 5.5, top + 15.6, "AUX PWR LOOM");
  stencil(svg, 94.5, top + 15.6, "SENSORS", "end");
}

/* ── the canopy ────────────────────────────────────────────────────── */

/**
 * The photographic canopies.
 *
 * Ric's reference images with the glass cut out of them, so the real sky
 * shows through the panes (decided 2026-07-26 — "green out the space and
 * put the actual picture as the overlay"). Resolved relative to this
 * module rather than to the document, so the page can move without the
 * cockpit going missing.
 *
 * They are the *preferred* canopy, not the only one: they are a fixed
 * 1.83:1 and there is no honest way to fit that to a phone held upright.
 * The SVG below is built alongside them and CSS chooses, so a viewport the
 * photograph cannot cover still gets a canopy rather than a stretched one.
 */
const PHOTO = {
  luxury: new URL("../../../assets/cockpit/luxury.webp", import.meta.url).href,
  console: new URL("../../../assets/cockpit/console.webp", import.meta.url).href,
};

/**
 * Build the canopy layer for a preset: the photograph, and the SVG that
 * stands in for it where it does not fit.
 *
 * @param {'clean'|'luxury'|'console'} preset
 * @returns {DocumentFragment}
 */
export function buildCanopy(preset = "luxury") {
  const frag = document.createDocumentFragment();
  if (PHOTO[preset]) {
    const img = document.createElement("img");
    img.className = "sf-canopy-photo";
    img.src = PHOTO[preset];
    img.alt = "";
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    frag.append(img);
  }
  frag.append(buildCanopySvg(preset));
  return frag;
}

/**
 * The drawn canopy. Still the whole cockpit on a narrow viewport, and
 * still the thing the damage and filter layers will attach to, because
 * both are styling operations and a photograph cannot be styled.
 *
 * @param {'clean'|'luxury'|'console'} preset
 * @returns {SVGElement}
 */
export function buildCanopySvg(preset = "luxury") {
  const svg = el("svg", {
    class: `sf-canopy sf-canopy--${preset}`,
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    focusable: "false",
  });

  if (preset === "clean") return svg;

  const gritty = preset === "console";
  const bottom = gritty ? GLASS_BOTTOM.console : GLASS_BOTTOM.luxury;
  const glass = glassOutline(bottom, gritty ? 0 : GLASS.chamferY);

  svg.append(defsFor(preset));

  /* The surround: everything outside the glass. Drawn as one even-odd path
     against a rectangle that bleeds past the viewBox, so the structure is
     cut off by the window edge the way it would be by your peripheral
     vision — not neatly terminated just inside it. */
  svg.append(el("path", {
    d: `${toPath([[-6, -6], [106, -6], [106, 106], [-6, 106]])} ${toPath(glass)}`,
    "fill-rule": "evenodd",
    fill: "url(#sf-surround)",
    class: "sf-surround",
  }));

  /* The inner edge of the surround. This one line does most of the work of
     making the frame feel like it has a machined edge. */
  svg.append(el("path", { d: toPath(glass), class: "sf-glass-edge", fill: "none" }));

  const mullionHalf = gritty ? MULLION.half * 1.5 : MULLION.half;
  const transomHalf = gritty ? TRANSOM.half * 1.25 : TRANSOM.half;

  /* Each beam carries its own gradient, laid across its width in user
     space. `axis` is the line the gradient runs along — for a mullion
     that is horizontal (across the strut) even though the strut leans,
     and for the transom it is vertical. */
  const beams = [];

  /* ── the transom ─────────────────────────────────────────────────── */
  beams.push({
    pts: hBeam(-6, 106, TRANSOM.y, transomHalf),
    axis: crossAxis(-6, TRANSOM.y, 106, TRANSOM.y, transomHalf, "y"),
    // The normal of a left-to-right beam points downward, so the highlight
    // would land on its underside. Light comes from above.
    flip: true,
  });

  /* ── the two converging mullions ─────────────────────────────────── */
  for (let i = 0; i < 2; i++) {
    const [x1, y1, x2, y2] =
      [MULLION.topX[i], TRANSOM.y - transomHalf, MULLION.botX[i], bottom + 1];
    beams.push({
      pts: vBeam(x1, y1, x2, y2, mullionHalf),
      axis: crossAxis(x1, y1, x2, y2, mullionHalf, "x"),
      // The lit side is the one facing the middle of the window.
      flip: i === 1,
    });
  }

  /* ── the upper band's verticals ──────────────────────────────────── */
  const upperHalf = gritty ? UPPER.half * 1.5 : UPPER.half;
  for (const x of UPPER.x) {
    beams.push({
      pts: vBeam(x, -1, x, TRANSOM.y - transomHalf, upperHalf),
      axis: crossAxis(x, -1, x, TRANSOM.y - transomHalf, upperHalf, "x"),
      flip: x > 50,
    });
  }

  const defs = svg.querySelector("defs");
  const stops = CROSS_SECTION[gritty ? "console" : "luxury"];
  beams.forEach((beam, i) => {
    const id = `sf-beam-${preset}-${i}`;
    const [x1, y1, x2, y2] = beam.axis;
    const g = el("linearGradient", {
      id, gradientUnits: "userSpaceOnUse",
      x1: beam.flip ? x2 : x1, y1: beam.flip ? y2 : y1,
      x2: beam.flip ? x1 : x2, y2: beam.flip ? y1 : y2,
    });
    for (const [offset, color] of stops) g.append(el("stop", { offset, "stop-color": color }));
    defs.append(g);

    svg.append(el("path", { d: toPath(beam.pts), fill: `url(#${id})`, class: "sf-beam" }));
    // A hairline down each side of every strut. Without it the gradient
    // fades into the sky and the frame loses its edge against a bright limb.
    svg.append(el("path", { d: toPath(beam.pts), class: "sf-beam-edge", fill: "none" }));
  });

  /* ── the finish ──────────────────────────────────────────────────── */
  if (gritty) {
    rivets(svg, 25.5, TRANSOM.y + 3, 38.5, bottom - 1, 7);
    rivets(svg, 74.5, TRANSOM.y + 3, 61.5, bottom - 1, 7);
    rivets(svg, 2, TRANSOM.y - 4.4, 98, TRANSOM.y - 4.4, 22);
    // No stencils on the glass. Markings belong on hardware; a label
    // floating over the view is exactly the clutter §2.1 rules out.
    buildConsole(svg);
  } else {
    /* The rim light: the warm line along the underside of the transom and
       the inboard edge of each mullion. It is the single detail that makes
       the reference image read as expensive rather than merely dark. */
    svg.append(el("path", {
      d: `M-6 ${TRANSOM.y + transomHalf} L106 ${TRANSOM.y + transomHalf}`,
      class: "sf-rim", fill: "none",
    }));
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      svg.append(el("path", {
        d: `M${MULLION.topX[i] + sign * mullionHalf} ${TRANSOM.y} ` +
           `L${MULLION.botX[i] + sign * mullionHalf} ${bottom + 1}`,
        class: "sf-rim", fill: "none",
      }));
    }
  }

  return svg;
}

/** The presets, in cycle order. Exported so nothing has to retype them. */
export const PRESETS = ["clean", "luxury", "console"];

/**
 * Migrate a stored preset name.
 *
 * The three presets used to be clean / frame / cockpit. Renaming them
 * would silently drop anyone back to the default, and "my cockpit reset
 * itself" is a bug report about something that was actually a rename.
 */
export function migratePreset(name) {
  if (name === "frame") return "luxury";
  if (name === "cockpit") return "console";
  return PRESETS.includes(name) ? name : "luxury";
}
