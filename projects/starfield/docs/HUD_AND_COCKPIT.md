# Starfield — HUD and Cockpit Specification

> **Status:** Target specification; not yet implemented<br>
> **Decided with Ric:** 2026-07-25<br>
> **Governs:** cockpit presets, the canopy frame, the on-glass information layer,
> labelling, warnings, damage presentation, and photo mode.

This document exists because the cockpit is the single thing the player looks at for
the entire game. Everything here serves one rule from the Design Bible:

> **The cockpit must never get in the way of the beauty.**

Read alongside [Design Bible §14](DESIGN_BIBLE.md) (interface and controls),
[Earth–Moon Vertical Slice §12](EARTH_MOON_VERTICAL_SLICE.md) (required readouts), and
[Technical Architecture §22.2](TECHNICAL_ARCHITECTURE.md) (why this is a DOM layer).

---

## 1. What "holographic" means here

The overlays are **flat 2D screen-space annotations that look as though they interact
with the world.** There is no volumetric rendering. A marker is anchored by projecting
an object's world position into screen space and drawing ordinary DOM/CSS at that point.

Canonical examples, in Ric's words:

- a **ring around a star** carrying its name and distance;
- a **route drawn to a destination** after the player enters it on the map;
- **speed and clocks**, which already work this way in the prototype.

This is a deliberate simplification. It keeps text crisp at any DPI, keeps it reachable
by screen readers, lets it be styled with plain CSS, and makes overlay cost scale with
the number of *visible annotations* rather than with scene complexity.

---

## 2. The three presets

All presets are first-person, inside the ship, and share one information layer. Only
the framing changes.

| Preset | Framing | Purpose |
|---|---|---|
| **Clean** | None — only the view and what the player summons. | Pure observation and photography. |
| **Luxury** ← **default** | Octagonal canopy in a sleek composite finish. No console. | The default flying experience. |
| **Console** | The same canopy in a heavier industrial finish, **plus a jet console**. | Maximum embodiment. |

**Luxury is the default preset** (resolves `OPEN-013`). Clean is the better screenshot
mode, but a new player facing a black sky with no framing may not register that they are
inside a ship at all. Luxury establishes the ship immediately while leaving the view open.

### 2.0 The two finishes (decided Ric, 2026-07-26)

Ric supplied two cockpit references, and the decision is that **both are presets the
player chooses between** — not a choice the project makes on their behalf:

- **Luxury** is the sleek reference: dark composite mullions, soft bevels, and a warm
  rim light along the underside of the transom and the inboard edge of each mullion.
  Nothing is bolted to anything. Read it as expensive.
- **Console** is the industrial reference: painted metal, rivets, exposed wiring looms,
  stencilled markings, brass switch banks, and the console of §2.3. Read it as lived-in.

They are the **same window** in two finishes. The geometry of §2.1 does not change
between them; only the material, the strut weight, and whether there is furniture below.

> Naming note: these were `frame` and `cockpit` until 2026-07-26. The stored preference
> is migrated (`migratePreset` in `canopy.js`), because a rename that silently resets
> somebody's cockpit arrives as a bug report about something that was never a bug.

### 2.1 The octagon (both framed presets)

Ric's specification: **an octagonal canopy, with the edges of the octagon carrying a
frame that wraps around you — the Millennium Falcon cockpit as the reference.**

Design intent:

- the view is a **faceted octagonal window**, not a rectangle with a border stuck on;
- **struts run along the octagon's edges** and read as structure the player sits inside,
  wrapping toward the periphery rather than lying flat on the screen;
- **segmented panes** — the canopy is divided into facets by ribs, so the player is
  looking out through a built structure;
- the frame should feel *built* — panelled, with visible thickness and joins — not like
  a UI chrome rectangle;
- the centre of the view is **always unobstructed**. The frame lives at the periphery,
  and no rib or hub crosses the middle of the screen.

#### The structure, as built (2026-07-26)

The reference images resolve the one thing "octagonal canopy with struts" left open,
and it is worth writing down because the first implementation got it wrong: **the frame
is mullions across the glass, not a border drawn around it.** A ring reads as a
vignette. What reads as a cockpit is:

- a **transom** running the full width at about a fifth of the way down, with a band of
  panes above it, divided by two verticals placed either side of centre;
- two **mullions converging downward** from the transom, framing one enormous forward
  pane — wide at the top, narrower at the bottom;
- **side panes** outboard of those, carrying the octagon's chamfered corners.

The forward pane is the whole middle of the screen and nothing crosses it. The transom
sits well above the crosshair, and the upper band's verticals are deliberately *not*
on the centre column, so the sightline directly above the nose stays clear.

Struts are drawn as **filled quads carrying a gradient across their width**, not as
strokes. A stroke is a line; a quad can be lit, and being lit is the only reason a flat
shape reads as an extrusion with thickness. The gradient must run **perpendicular to
the strut**, which for the leaning mullions is not the same as across their bounding
box — get that wrong and the cross-section runs top-to-bottom instead and the whole
frame washes out to one flat tone.

#### There is no desk — in Luxury (decided Ric, 2026-07-25)

Ric supplied the Millennium Falcon cockpit as reference and was explicit about what to
take from it: **the window, not the furniture.** This governs the **Luxury** preset;
Console is the opt-in exception, and §2.3 is where it is allowed.

- **No console, dashboard, or desk.** Nothing occupies the lower portion of the view.
- **No banks of switches, lights, or physical instrument panels.** The reference image's
  wall-to-wall controls are exactly what to leave out.
- **Far less clutter than the reference.** The canopy structure is the entire cockpit.
- The goal is stated plainly: **see as much of space as you possibly can.** Glass area is
  the thing being maximized; every element of framing must justify the view it costs.

All instrumentation therefore lives on the glass as overlay (§3) — which is why the
anchored vitals attach to the frame's edges rather than to any surface below.

#### The canopy is a photograph (decided Ric, 2026-07-26)

Ric's proposal, and it is the right one: **take the reference images, cut the space out
of them, and composite the picture itself over the canvas.** The panes become fully
transparent, the real sky shows through them, and the struts are the reference material
rather than an approximation of it.

How the cut is made, because it is not obvious and the method matters if it is ever
redone (`tools/` and the notes in `canopy.js`):

- the frame is described as **strut centre-lines with a width**, not as pane outlines.
  A band only has to *contain* the real strut, which is far more forgiving than tracing
  edges — and the edges are what a gradient-following segmentation gets wrong, because
  the strongest edge in the reference is the limb of a painted planet, not a strut;
- **GrabCut** then decides, inside that band, which pixels are metal and which are
  painted space. It fits colour models to each and adds a smoothness term, so the
  boundary is coherent instead of chasing wisps of nebula;
- the cockpit is symmetric, so **only the left half is traced and mirrored**. Nothing
  hand-placed can then drift out of symmetry;
- the cut is biased to run slightly **into** the struts, and the edge is feathered.
  Over-cutting thins a strut imperceptibly; under-cutting leaves a sliver of painted
  nebula, which is a fake view of space. The feather is honest besides — a canopy strut
  this close to the eye is out of focus in any real cockpit.

**The baked-in HUD had to come out.** The references carry `SPEED: 3200 u/s`,
`HDG: 185°`, `HULL: 96%`, `RADIATION: NOMINAL`, `EXPLORATION TARGET — 3.1 LY` and a
`MENU`/`MAP` cluster. Most sat on glass and vanished with the cut; the rest were
inpainted out of the metal. None of it could stay: a painted `HULL: 96%` is a readout
nothing in the simulation can back up, and §3 is the only place instrument values are
allowed to come from. The stencilled equipment markings — `AUX PWR LOOM`, `SENSORS` —
**stay**, because they label hardware rather than report a value.

#### The drawn canopy is still there

The photographs are a fixed **1.83:1**, and there is no honest way to fit that to a
phone held upright — `cover` would crop away most of the frame. So the SVG canopy is
built alongside the photograph and CSS chooses: below roughly 3:2 the drawing takes
over. This costs nothing that was not already planned, since §9 wanted mobile reduced
to thin edge struts anyway.

It also stays because **damage (§6) and instrument filters (§6.1) are styling
operations**, and a photograph cannot be styled. When those arrive they attach to the
drawn layer, or become their own composited layer above the photograph.

Implementation note: the drawn canopy is a single SVG shape composited over the canvas,
with depth suggested by shading rather than by geometry. It does **not** require 3D —
with no console to model, Luxury is almost entirely a styling problem, and Console adds
only more of the same styling.

### 2.2 Look behaviour

| Preset | Behaviour |
|---|---|
| **Luxury** | The frame is **fixed to the screen**. Looking around rotates the view behind a stationary canopy. Always legible, never obscures the thing being aimed at. |
| **Console** | The canopy **moves like a real cockpit**. Looking around pans the view across the struts, and the player can look *past* one. |

This split is deliberate: Luxury optimizes for legibility and is the default; Console
pays screen space and occlusion for physical realism, and players opt into that.

> **Not yet built.** Both presets are currently screen-fixed. The moving canopy needs
> the camera's attitude fed to the overlay and the struts offset against it, which is a
> real piece of work rather than a styling pass, and it is not done.

### 2.3 The Console preset has a console

Decided Ric, 2026-07-25: **Console includes a console, "because it's like a jet."** The
no-desk rule (§2.1) governs the **Luxury** preset only.

Console is the opt-in embodied mode, so the instrument surface belongs there: a jet-style
dashboard below the canopy, with the moving canopy of §2.2. It is the one preset allowed
to trade view area for presence — which is precisely why it is not the default.

**It occupies the bottom sixth of the view**, and no more (settles the open item in §11).
The reference image spends about that much and still reads unmistakably as a jet; past
that, the cost stops buying anything. Everything anchored low — the corner vitals, the
map and menu cluster — moves above the coaming rather than sitting on it, because a
readout printed on an instrument face is not legible at any preset.

**Nothing on the console displays a value.** Bezels, switch banks, the wiring loom and
the stencilled markings are hardware; none of them shows a number. The simulation has no
hull integrity and no power system, and putting a plausible-looking `HULL 96%` on the
coaming because the reference image has one would be a fabricated readout on the glass —
which the Scientific Standard forbids outright. When there is a damage model, §5's
warning language is where it goes.

Warnings, vitals, and object labels behave identically across presets; the console is
physical framing, not a second information system.

---

## 3. Information layout

**Vitals anchor to the frame. Labels float on the glass.**

### 3.1 Anchored to the frame (fixed position, always same place)

Core flight state the player must find instantly without hunting:

- current speed and named reference frame;
- **your clock** and **home clock** (Design Bible §7.3), clearly distinguished;
- altitude and vertical speed when near a body;
- hull integrity, with its warning indicator (§5);
- travel mode (Local…Intergalactic); precision mode;
- autopilot state and next action;
- selected target, with distance and closing/receding speed.

These never move. Position is muscle memory. Which *corner* each one lives in is not
fixed by this document — only that it stops moving once chosen. Speed sits top-right,
following the reference images, and the reference images are following forty years of
cockpit art that has trained everybody where to look for it.

Three marks come straight from the references and are built:

- **the crosshair** — a gapped cross with four ticks and a hole in the middle. The hole
  is the point: a solid reticle covers the one pixel being aimed at, which on a map of
  real objects is usually the thing the player was trying to look at;
- **the speed tape** — a ladder beside the speed readout, **one tick per decade**. It is
  a real readout, not decoration: its position is the order of magnitude, and the ticks
  visibly slide while the ship is accelerating. A linear tape is useless across the
  eleven decades of speed this game spans;
- **the corner cluster** — `MENU` and `MAP`, bottom right. The map is one of the game's
  two primary surfaces ([Design Bible §13](DESIGN_BIBLE.md)), so it gets a permanent
  visible way in rather than living only on a key nobody discovers.

### 3.2 Floating on the glass (anchored to world objects)

- object names and distances, drawn beside the object — the star-ring pattern;
- the route line to a selected destination;
- approach, orbit, and landing guidance;
- contextual environment readouts where they relate to a specific thing.

Floating elements must fade or reposition rather than overlap each other, and must never
stack over the frame's anchored vitals.

---

## 4. Labelling density

**Default: the selected target, plus a few genuinely notable nearby objects.**

Real catalogues could put thousands of labels on screen. That would destroy the emptiness
the project exists to convey. Therefore:

- the **selected target is always labelled**;
- a small number of **significant** nearby objects carry labels, chosen by significance
  and proximity, not by whatever happens to be in frame;
- everything else is labelled **on demand** — point at it, or select it;
- density is adjustable in settings, but the default is deliberately sparse.

The sky should look like real space. Information arrives when the player reaches for it.

---

## 5. Warnings

**Ric's specification: a triangle with an exclamation mark — yellow when damaged, red
when critical — sited next to the hull integrity readout.**

```text
HULL  87%   ⚠      ← yellow triangle: damaged
HULL  31%   ⚠      ← red triangle: critical
```

Rules:

- the indicator sits **directly beside the readout it describes**, so the warning and
  its cause are read together;
- **yellow = damaged / caution**, **red = critical / act now**;
- no warning state is silent about *why* — the cause is available next to it;
- warnings never rely on colour alone: the triangle's presence, and its text, carry the
  meaning for colour-blind players (§8).

**Confirmed by Ric (2026-07-25):** the triangle is the project's **general** warning
language, not a hull-only indicator. The same yellow/red triangle appears next to
whichever readout is in trouble — closing speed, terrain clearance, structural load —
so a warning always reads the same way wherever it occurs.

This satisfies the Design Bible law that **danger must be legible before it is fatal**:
the caution state exists precisely so the critical state is never the first notice.

---

## 6. Damage on the canopy

**Subtle only.** Hull damage is visible on the glass and struts — light scoring, faint
cracking, slight dimming of affected areas — but it **must never obscure the view or
impair the player's ability to fly**.

The purpose is to make the consequence of flying through Saturn's rings *felt* on the
long trip home, without a health bar and without punishing the player twice by taking
away their vision. Damage that would block sight is expressed in readouts instead.

---

## 6.1 Instrument filters

The canopy supports **selectable instrument filters** — infrared, ultraviolet, X-ray,
radio, narrowband, long exposure — applied as a "smart filter over the top of the glass"
(Ric, 2026-07-25). They are off by default, always visibly labelled while active, and
never presented as naked-eye appearance.

Presentation requirements:

- the active filter is named persistently on the glass, in a place the player cannot
  miss;
- the warning and vitals layer (§3.1, §5) stays legible through any filter — safety
  information is never filtered away;
- switching filters is a single quick control, not a menu dive;
- a photograph records which filter produced it (§7).

The full specification, including the constraint that filters must use real band data or
calculated physics rather than tinting the visible image, is in
[Visual Perception §8.1](VISUAL_PERCEPTION.md).

---

## 7. Photo mode

**The player chooses per shot** whether the frame and overlays appear.

- photography is a plain control: **zoom, then press capture** (Design Bible §12.4);
- a toggle in photo mode selects clean plate / frame only / everything;
- the choice persists between shots, so it is set once and forgotten;
- an optional **note** can be attached to any photograph;
- captures store what was photographed, the ship's position, and both clock readings.

---

## 8. Visual language

**Base: pale cyan / white, thin lines.** Chosen for legibility against both a black sky
and a bright Earth, and for staying out of the way of real astronomical colour.

| Colour | Meaning |
|---|---|
| White / pale cyan | Routine information |
| Yellow | Caution — damaged, approaching a limit |
| Red | Critical — act now |

Rules:

- lines are **thin and precise**; the overlay should read as light on glass, not as an
  opaque panel;
- colour **never carries meaning alone** — shape, position, and text must also convey it;
- the overlay must remain legible against a bright limb, so elements need their own
  contrast handling rather than assuming a dark background;
- real astronomical colour outranks interface colour. The HUD must not compete with it.

---

## 9. Mobile

**The octagon shrinks to thin edge struts.** The shape's identity survives; its screen
cost does not. At ~375 CSS px:

- struts thin substantially and pull to the extreme periphery;
- anchored vitals reduce to the essential set and must not overlap touch controls;
- floating labels thin out further than on desktop;
- the frame never occupies space that the two-thumb flight controls need.

The preset is never silently switched on the player's behalf.

---

## 10. Accessibility

- every overlay element is real DOM, reachable by assistive technology;
- warning states are conveyed by shape and text as well as colour;
- the player can scale overlay text independently of the frame;
- reduced-motion honours: no drifting, pulsing, or animated overlay decoration;
- the frame can be dimmed or disabled (Clean) without losing any information.

---

## 11. Still open

- Exact strut thickness, panel proportions, and the octagon's aspect at different
  viewports — a visual-tuning matter, best settled against a real prototype. The
  governing constraint is fixed: maximize glass.
- **The moving canopy** (§2.2). Both presets are screen-fixed today; Console is
  specified to pan with the view and does not yet.
- **Damage on the canopy** (§6) and **instrument filters** (§6.1) are specified and
  unbuilt. Neither has anything to attach to yet: there is no damage model, and the
  filters need real band data rather than a tint.
- **Photo mode** (§7) is unbuilt.

Settled since this document was written: the two finishes (§2.0), the mullion structure
(§2.1), and how much of the view the console may take (§2.3).
