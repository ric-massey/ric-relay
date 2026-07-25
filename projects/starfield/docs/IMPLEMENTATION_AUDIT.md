# Starfield Current Implementation Audit

> **Status:** Documentation-only migration assessment<br>
> **Scope:** Every existing non-documentation file under `projects/starfield/`<br>
> **Target:** [Earth–Moon Vertical Slice](EARTH_MOON_VERTICAL_SLICE.md)

## 1. Purpose

This audit prevents two bad outcomes:

1. treating the current prototype as disposable and losing its strongest scientific and
   interaction work;
2. treating current behavior as the design and carrying its scale, framing, and gameplay
   conflicts into the new simulator.

The prototype is a sophisticated relativistic-flight experiment built as dependency-free
classic JavaScript and Canvas 2D. It contains valuable mathematics, visual ideas,
controls, and explanatory work. Its central world model, however, is not capable of the
target Earth–Moon-to-universe experience without substantial separation and migration.

No code changes are authorized by this audit. Each disposition describes future intent.

---

## 2. Disposition labels

- **PRESERVE** — behavior and implementation are strong enough to retain with tests and
  small interface changes.
- **EXTRACT** — preserve the underlying logic, but move it behind a new responsibility
  boundary.
- **REFACTOR** — retain significant ideas or code while changing ownership and APIs.
- **REPLACE** — current implementation conflicts with the target architecture; retain
  only reference cases or presentation lessons.
- **RETIRE** — remove after replacement is validated.
- **LEGACY** — keep runnable as the old prototype during migration; do not extend it as
  the target game.

Many files receive more than one label because a file currently owns unrelated systems.

---

## 3. Executive assessment

### 3.1 Strongest assets

- careful special-relativity math and numerical commentary;
- apparent-view aberration and Doppler work;
- blackbody-to-visible color model;
- six-degree-of-freedom orientation without Euler-angle lock;
- action-based, persistent, rebindable controls;
- relative-speed and reference-frame awareness in the HUD;
- source-like nearby-star and deep-sky data;
- physical-lighting intent;
- deterministic concepts in galaxy and stellar-population generation;
- mobile control and narrow-screen groundwork;
- detailed causal failure reports;
- the honesty-ledger concept;
- static, dependency-free deployment and a route back to Ric's Terminal.

### 3.2 Central architectural conflicts

- one global home/Sun frame owns nearly all world state;
- the ship is effectively the origin and world objects are translated around it;
- astronomical and local collision coordinates are mixed in light-years;
- game, physics, input, procedural spawning, collision, progression, and lifecycle are
  concentrated in `game.js`;
- render representation and simulation scale are tightly coupled;
- route-biased procedural encounters contradict stable real geography;
- the gear model mixes sublight relativity and declared FTL behavior;
- high-speed survival is coupled to hull invulnerability;
- radiation is a routine damage/death path;
- there is no Earth ephemeris start, hierarchy of frames, terrain, atmosphere, landing,
  or full autopilot;
- no automated test suite characterizes the valuable math before migration.

### 3.3 Migration rule

Do not rewrite the current files in place until their reusable behavior has reference
tests. New architecture should be developed beside the legacy prototype, then preserved
modules can move across one responsibility at a time.

---

## 4. Current loading and dependency model

`fly.html` loads classic deferred scripts in a strict order through a shared global
`window.SF` namespace:

```text
catalog data
→ constants
→ controls
→ color
→ relativity
→ camera
→ view
→ stars
→ black holes
→ systems
→ galaxies
→ renderer
→ audio
→ HUD
→ control UI
→ game orchestration
```

This is effective for `file://` compatibility but makes dependencies implicit and
encourages global ownership. The target may preserve static deployment without
preserving this global script architecture.

---

## 5. Root files

### `README.md`

**Current responsibility**

- product framing as a faster-than-light/relativistic explorer;
- instructions for running the prototype;
- current controls and gear behavior;
- explanation of physics, catalogs, cheats, structure, and roadmap.

**What is strong**

- unusually clear explanation of the prototype's intent and equations;
- honest discussion of compromises;
- accurate operational instructions;
- useful module map.

**Conflicts/risks**

- reads as the future product authority even though the new Design Bible supersedes it;
- contains tension between “nothing exceeds light speed” celerity framing and gears
  called faster-than-light elsewhere;
- centers the entire product on extreme relativity;
- describes inflated bodies/encounters that the target forbids;
- roadmap no longer matches the Earth–Moon-first plan.

**Disposition: REFACTOR as current-state documentation**

- keep run instructions and honest description of what works today;
- add a prominent current-prototype versus target-design distinction;
- link the docs index and Design Bible;
- move future roadmap authority to `docs/`;
- do not promise target systems as already implemented.

### `index.html`

**Current responsibility**

- standalone “how to fly” landing page;
- explains premise, momentum, gears, controls, and physics;
- links into `fly.html`;
- loads the shared Terminal return control.

**What is strong**

- self-contained and readable;
- establishes expectations before play;
- preserves a visible return route;
- works as a static file.

**Conflicts/risks**

- teaches the legacy control philosophy and gear model as the final game;
- lacks the future product's Earth–Moon entry, progressive discovery, and assisted
  flight framing;
- duplicates documentation that can drift from runtime controls.

**Disposition: LEGACY now; REPLACE for the new product shell**

- keep unchanged while the prototype remains available;
- new experience should teach contextually and generate control help from live bindings;
- retain the return-to-Terminal behavior and static-hosting resilience.

### `fly.html`

**Current responsibility**

- owns the canvas and all HUD/overlay markup;
- provides mobile thrust and joystick controls;
- provides pause, map, controls, sound, honesty ledger, and game-over surfaces;
- establishes classic-script load order;
- loads the Terminal return control.

**What is strong**

- semantic labels and several appropriate ARIA roles;
- comprehensive debug/flight instrumentation;
- functional overlays without a framework;
- explicit mobile surfaces;
- clear separation of markup from most runtime logic.

**Conflicts/risks**

- HUD hierarchy is dominated by relativistic readouts even during local flight;
- one canvas/render path cannot directly provide target terrain/atmosphere needs;
- “game over/relaunch” is broadly compatible with the resolved death rule, but it
  predates the selectable death modes and the two-clock reset, so its restart flow still
  needs to match the spec;
- mobile controls do not yet represent the target two-thumb/contextual design;
- static script order is the module system.

**Disposition: LEGACY; REPLACE markup incrementally**

- use its element inventory as a requirements reference;
- preserve accessibility intent and the return control;
- create a state-driven desktop/mobile shell for the slice;
- remove legacy markup only after the replacement has parity for prototype access or the
  legacy route is intentionally retired.

### `starfield.css`

**Current responsibility**

- full-screen canvas and instrument-panel visual system;
- overlay, map, bindings, warning, mobile joystick/throttle, and narrow-screen styles;
- reduced-motion accommodations.

**What is strong**

- cohesive instrument aesthetic;
- careful narrow/short viewport handling;
- touch-action rules and control hit areas;
- warning hierarchy and reduced-motion consideration;
- dependency-free delivery.

**Conflicts/risks**

- tightly coupled to legacy DOM IDs and HUD density;
- mobile layout is additive rather than a complete cockpit information redesign;
- CSS reduced motion cannot control JS camera/render effects on its own.

**Disposition: EXTRACT visual tokens and interaction lessons; REFACTOR UI styles**

- preserve palette, tone, warning grammar, and useful responsive patterns;
- rebuild around target view-model components and safe areas;
- test approximately 375 px width and short landscape viewports;
- keep accessibility policy coordinated with runtime state.

---

## 6. Data files

### `data/stars-near.js`

**Current responsibility**

- nearby-star records with names, positions described by right ascension/declination and
  distance, stellar properties, and notes.

**What is strong**

- real objects are permanent navigational furniture;
- compact browser-friendly representation;
- valuable test data for catalog-to-Cartesian conversion.

**Conflicts/risks**

- source, catalog release, uncertainty, epoch, license, and transforms are not represented
  as a formal dataset manifest;
- global variable delivery has no schema/version check;
- identities depend heavily on names.

**Disposition: PRESERVE records provisionally; MIGRATE through a provenance pipeline**

- verify each field against recorded sources;
- assign stable IDs and aliases;
- normalize units/frame/epoch;
- create schema and validation tests;
- do not expand the catalog manually until provenance exists.

### `data/stars-bright.js`

**Current responsibility**

- bright-star supplement for visually important objects beyond the nearby set.

**What is strong**

- complements proximity with naked-eye relevance;
- supports the real-sky visual goal.

**Conflicts/risks**

- same provenance, identity, schema, and version limitations as `stars-near.js`;
- merge/deduplication currently uses names.

**Disposition: PRESERVE provisionally; MIGRATE with catalog identity joins**

- record source release and observational fields;
- deduplicate using catalog IDs rather than display names;
- keep “near” and “bright” as query/index attributes rather than permanent incompatible
  data shapes.

### `data/deep-sky.js`

**Current responsibility**

- selected galaxies, nebulae, clusters, remnants, and black holes with catalog positions,
  sizes, styles, and notes.

**What is strong**

- curated real destinations;
- useful Local Group and galactic-context seed set;
- separates object kinds and selected visual parameters.

**Conflicts/risks**

- some render-oriented values sit beside scientific values without classification;
- provenance, uncertainty, and stable identifiers need formalization;
- approximate morphology/color can be mistaken for observed properties.

**Disposition: PRESERVE destination intent; REFACTOR schema and classifications**

- split measured catalog data from presentation hints;
- validate sizes, distances, frames, and object types;
- label constrained/render choices;
- defer wider expansion until the Earth–Moon and nearby-star data pipeline is established.

### `data/milestones.js`

**Current responsibility**

- distance/time milestones for the relativistic-flight experience.

**What is strong**

- converts abstract scale into meaningful human moments;
- supports educational progression during travel.

**Conflicts/risks**

- milestone assumptions are coupled to one-g acceleration, one frame, and the legacy
  travel model;
- not suitable as universal progression data.

**Disposition: EXTRACT the concept; REPLACE the data model**

- preserve validated relativity examples as scientific fixtures/content;
- create context-specific observation and journey milestones;
- calculate route-specific milestones from the actual selected travel regime.

---

## 7. Source files

### `src/constants.js`

**Current responsibility**

- `SF.K`: physical constants and astronomical values;
- `SF.FUDGE`: time, scale, gravity, gear, assist, encounter, and spawn tuning;
- central source for honesty-ledger magnitude.

**What is strong**

- makes a deliberate distinction between real constants and cheats;
- richly documents intent and numeric meaning;
- collects gear behavior rather than scattering it;
- supports a ledger generated from implementation values.

**Conflicts/risks**

- one `FUDGE` object combines presentation, simulation approximation, gameplay tuning,
  fictional technology, and procedural encounter policy;
- visual radii and gravity rules encode legacy scale compromises;
- gear model mixes proper velocity, FTL labels, ramp timing, and hull policy;
- some comments describe older behavior and are difficult to reconcile with later changes;
- global unit conventions rely on names/comments.

**Disposition: EXTRACT constants; REPLACE policy structure**

- verify physical constants and move them into typed/unit-aware scientific records;
- split presentation aids, model approximations, ship fiction, difficulty/accessibility,
  and performance settings;
- retire inflated radii, compressed/route encounter geometry, and legacy gear policy;
- preserve ledger generation through structured approximation records.

### `src/controls.js`

**Current responsibility**

- semantic action list;
- default key bindings and gear actions;
- persistent two-slot rebinding;
- reverse lookup, edge/held action behavior, key labels, and pressed state.

**What is strong**

- input is action-based rather than scattered key checks;
- bindings are saved and resettable;
- live help can derive from the same mapping;
- keyboard-layout awareness is better than character matching.

**Conflicts/risks**

- semantic actions are still legacy flight/gear actions;
- pressed-state ownership and browser event concerns remain close to the action map;
- no normalized axes for pointer, touch, or gamepad;
- storage schema is only implicit.

**Disposition: PRESERVE design; REFACTOR into device adapters plus action state**

- characterize load/save/rebind behavior with tests;
- retain semantic actions and generated help;
- replace legacy gear actions with target flight/autopilot actions;
- add pointer, touch, and gamepad adapters;
- version settings migrations explicitly.

### `src/controls-ui.js`

**Current responsibility**

- controls overlay rendering;
- binding capture and reset;
- dynamic control-hint line.

**What is strong**

- UI is generated from the action registry;
- rebinding cannot silently leave help text wrong;
- binding capture handles conflicts and cancellation.

**Conflicts/risks**

- direct DOM construction and overlay ownership are legacy-specific;
- keyboard capture does not cover touch/gamepad binding models;
- UI and simulation pause relationships are implicit.

**Disposition: EXTRACT interaction behavior; REFACTOR presentation**

- preserve generated bindings UI and live hints;
- adapt to new action/view-model architecture;
- add accessible focus flow and device-specific binding surfaces;
- keep binding capture isolated from flight commands.

### `src/color.js`

**Current responsibility**

- Planck-spectrum integration through approximate CIE 1931 observer curves;
- linear/sRGB conversion;
- log-spaced temperature lookup;
- visible-power fraction used for Doppler-shifted stars.

**What is strong**

- physically motivated rather than hand-picked star colors;
- reusable for stellar rendering and relativistic effects;
- clearly documented math and numeric domain;
- avoids a large static lookup table.

**Conflicts/risks**

- approximation and color-management assumptions need formal validation;
- screen tone mapping/exposure is outside this module and can defeat physical intent;
- runtime table construction and extreme-temperature clamps need characterized tests.

**Disposition: PRESERVE after scientific characterization; EXTRACT from globals**

- add reference samples, approximation citation, tolerance, and domain tests;
- define output color space and relationship to renderer tone mapping;
- keep it independent from engine choice.

### `src/relativity.js`

**Current responsibility**

- proper-acceleration and proper-velocity math;
- gravity adjustment in a weak-field/home-frame approximation;
- closed-form burn calculations;
- aberration/Doppler/environmental helper calculations;
- numerical stability around extreme gamma.

**What is strong**

- extensive reasoning about proper velocity, transverse acceleration, free fall, and
  numerical limits;
- closed-form reference behavior;
- potentially valuable scientific module independent of the legacy renderer;
- explicit attention to `beta` saturation and catastrophic cancellation.

**Conflicts/risks**

- assumes the legacy home-frame/time conventions in several APIs;
- combines dynamics, observation, and environmental-radiation calculations;
- high-gear usage can present FTL travel through sublight relationships;
- weak-field gravity integration is not a universal gravity system;
- lacks an external automated scientific test suite.

**Disposition: PRESERVE formulas; SPLIT and VALIDATE before migration**

- freeze reference cases first;
- separate special-relativity kinematics, apparent observation, rocket dynamics, and
  radiation helpers;
- require explicit frames and time domains;
- attach only to the sublight relativistic regime;
- never use it to justify fictional FTL.

### `src/camera.js`

**Current responsibility**

- vector math shared across the prototype;
- orthonormal ship/camera basis;
- body-axis yaw, pitch, and roll through Rodrigues rotation;
- projection and camera shake.

**What is strong**

- eliminates Euler gimbal lock and artificial pitch clamps;
- clean six-degree-of-freedom orientation concept;
- useful vector primitives;
- shake affects view without corrupting physical orientation.

**Conflicts/risks**

- ship orientation, camera view, projection, vector library, and shake share one module;
- projection is tailored to the Canvas 2D renderer;
- no explicit quaternion/frame type or numeric test suite;
- camera and ship may need separable look behavior under autopilot.

**Disposition: EXTRACT orientation math; REFACTOR camera responsibilities**

- preserve orientation behavior with loop/roll and drift tests;
- separate ship body pose, player look pose, render camera, and comfort effects;
- move general vector math into the selected math/type layer;
- support autopilot flight while the player looks independently.

### `src/view.js`

**Current responsibility**

- applies relativistic aberration to direction;
- calculates Doppler factor and angular magnification;
- projects apparent positioned objects through the camera;
- eases visible relativistic state transitions.

**What is strong**

- meaningful separation between world position and apparent observation;
- numerically aware Doppler calculation;
- reusable concept for the future relativistic regime.

**Conflicts/risks**

- assumes one global velocity forward direction and regime;
- combines scientific observation, smoothing, and screen projection;
- easing scientific state can temporarily make readout and appearance disagree unless
  explicitly treated as a visual transition;
- current comments state one regime even though future architecture separates FTL.

**Disposition: EXTRACT observation transform; REPLACE global/smoothing ownership**

- preserve validated aberration/Doppler mapping;
- make observer state and reference frame explicit inputs;
- keep comfort/crossfade policy in presentation;
- attach to render representations without owning camera projection.

### `src/stars.js`

**Current responsibility**

- main-sequence stellar interpolation;
- mass/luminosity/radius/temperature relationships;
- IMF-like star sampling;
- habitable-zone and frost-line helpers;
- legacy visual radius scaling.

**What is strong**

- scientifically motivated relationships for constrained/procedural systems;
- useful stable vocabulary for stellar properties;
- separates star-population logic from rendering.

**Conflicts/risks**

- sampled population and relationships need sources, model versions, domains, and tests;
- `visualRadiusLy` encodes forbidden size inflation;
- model approximations may be used as measured properties in current generated systems.

**Disposition: PRESERVE constrained-model concepts; RETIRE visual inflation**

- classify each relationship under the Scientific Standard;
- version and validate sampling;
- distinguish catalog measurements from interpolated/generated properties;
- use real radii in authoritative state;
- leave marker sizing to presentation aids.

### `src/blackhole.js`

**Current responsibility**

- selected black-hole catalog;
- Schwarzschild radius and related characteristic radii;
- simplified lensing and accretion-disk representation;
- black-hole system creation.

**What is strong**

- distinguishes shadow, photon sphere, and ISCO concepts;
- uses meaningful GR-inspired relationships;
- includes asymmetric relativistic beaming;
- provides compelling future destination research.

**Conflicts/risks**

- mixes catalog, physical model, render model, and procedural system creation;
- simplified thin-lens behavior has a limited domain;
- accretion visuals may appear for objects without supported accretion state;
- collision/hazard radii are tied to legacy scale policies;
- not needed for the Earth–Moon slice.

**Disposition: FREEZE as legacy; later SPLIT and VALIDATE**

- preserve formulas and visual references;
- separate catalog provenance, compact-object physics, lensing presentation, and
  environment;
- require evidence for accretion state;
- revisit only after nearby-star/galactic phases.

### `src/systems.js`

**Current responsibility**

- catalog coordinate conversion;
- catalog star construction;
- procedural star systems, planets, moons, comets, and classes;
- orbital layout and updates;
- encounter-gap and route-corridor generation.

**What is strong**

- current planet radii and AU orbit conversion have moved toward real scale;
- frost-line and habitable-zone constraints improve generated plausibility;
- orbits and body relationships are explicit;
- catalog coordinate conversion is reusable after validation.

**Conflicts/risks**

- procedural and measured systems share shapes without strong provenance separation;
- generated systems are nondeterministic under default `Math.random`;
- simplified orbital layout is not a general ephemeris;
- moon orbits and comet motion are approximate;
- route corridor generation directly violates stable universe geography;
- body/system state remains in the ship-translated global frame.

**Disposition: SPLIT; PRESERVE selected helpers; RETIRE encounter placement**

- extract and test catalog conversions;
- migrate real systems to world/ephemeris records;
- rebuild procedural generation as deterministic, versioned constrained completion;
- retire `nextGapLy`, `corridorOffset`, and route-spawn behavior;
- do not use this module for Earth/Moon authoritative state.

### `src/galaxy.js`

**Current responsibility**

- galaxy morphology and sampling;
- staged sprite/grain/resolved representations;
- logarithmic spiral geometry;
- galaxy movement/recycling rules and stellar realization.

**What is strong**

- understands that a galaxy needs representation transitions;
- uses physically motivated profiles and spiral structure;
- attempts continuity from distant object to fly-through population;
- useful future LOD research.

**Conflicts/risks**

- procedural realization and observed morphology/properties need classification;
- galaxy recycling is incompatible with permanent geography even when delayed;
- millions/billions of actual stars cannot be represented through one local array model;
- current global light-year coordinates will not scale to local surfaces.

**Disposition: FREEZE; later EXTRACT representation research; RETIRE recycling**

- preserve visual/profile prototypes and test scenes;
- rebuild against stable galaxy IDs and hierarchical streaming;
- classify generated internal stars;
- do not extend before the intergalactic roadmap phase.

### `src/render.js`

**Current responsibility**

- Canvas 2D initialization and resizing;
- CMB/background, sky field, stars, galaxies, planets, comets, black holes, labels,
  markers, reticle, waypoint, flashes, and legacy bubble rendering;
- some LOD/crossfade and physical-lighting behavior.

**What is strong**

- broad collection of successful visual experiments;
- camera-relative projection and apparent-view use;
- physical star-light direction for planets;
- labels/markers solve some real-angular-size legibility problems;
- galaxy LOD and black-hole presentation research;
- device-pixel-ratio and viewport handling.

**Conflicts/risks**

- one large renderer owns unrelated object types and UI-like labels;
- Canvas 2D cannot reasonably provide target terrain, atmosphere, and 3D station needs;
- some minimum visual radii and generated sky behavior blur presentation aid versus
  physical size;
- drawing and object lifecycle assumptions are entangled;
- performance policy is local rather than budget-driven.

**Disposition: PRESERVE reference scenes and algorithms; REPLACE backend structure**

- screenshot/characterize valuable effects before migration;
- extract label/marker behavior and physical-lighting logic conceptually;
- move to render representations sourced from authoritative state;
- select backend only through the architecture decision spike;
- keep Canvas 2D as a possible fallback/map layer, not automatically the main 3D engine.

### `src/audio.js`

**Current responsibility**

- lazy Web Audio initialization;
- procedural engine hum and noise;
- mute state;
- sound response to gamma and interstellar medium load.

**What is strong**

- respects browser gesture requirements;
- procedural audio avoids asset load;
- state-driven pitch and intensity are effective feedback;
- mute control is simple.

**Conflicts/risks**

- gamma-centric design does not fit most local flight;
- interstellar hiss may be heard as literal sound in vacuum;
- no broader audio priority, captions, or suspension recovery policy.

**Disposition: EXTRACT Web Audio patterns; REFRAME sound model**

- preserve lazy initialization and procedural techniques;
- drive local audio from ship-borne vibration, atmosphere, contact, and warnings;
- label scientific sonification;
- add accessibility equivalents and lifecycle handling.

### `src/hud.js`

**Current responsibility**

- formats ship/home clocks, speed, gamma, distance, radiation, hull, gear, target-relative
  state, notices, milestones, game-over detail, map rows, and honesty ledger.

**What is strong**

- excellent causal explanations and number formatting across huge ranges;
- explicit target-relative speed work;
- generated honesty ledger;
- loss reports explain physical causes;
- map/waypoint information exists.

**Conflicts/risks**

- one DOM module owns formatting, education, map, lifecycle, damage prose, and ledger;
- local flight priorities are buried under relativistic metrics;
- ledger reads from legacy `FUDGE` rather than a general provenance/approximation registry;
- game-over copy hardcodes current radiation and restart policy.

**Disposition: EXTRACT formatters and explanatory content; REPLACE HUD ownership**

- preserve/test scale-aware number formatting;
- split cockpit view model, map, education, failure report, and ledger;
- prioritize target, frame, closing rate, stopping distance, altitude, and autopilot locally;
- generate ledger from structured scientific records;
- remove final consequence assumptions until decided.

### `src/game.js`

**Current responsibility**

- session state and restart;
- world seeding;
- keyboard/touch input and DOM events;
- flight-assist/direct dynamics and gear drive;
- time advance;
- gravity, radiation, hull damage, collision, procedural spawning/recycling;
- milestones, map selection, overlays, rendering orchestration, and main loop.

**What is strong**

- integrates a genuinely playable prototype;
- contains useful relative-body, closing-rate, collision-sweep, input, and flight-assist
  work;
- comments document prior failure modes and reasoning;
- uses a bounded frame delta and separates some helpers.

**Conflicts/risks**

- primary monolith and largest migration risk;
- global mutable state is shared implicitly across modules;
- world translation around the ship replaces a frame graph;
- procedural route spawning and recycling break stable geography;
- radiation and high-gear hull fiction are embedded in the main loop;
- autopilot is mostly a velocity kill;
- gear, relativity, time, collision immunity, visuals, and progression are coupled;
- DOM, input, simulation, rendering, lifecycle, and content cannot be tested independently;
- start/restart hardcodes Sun-frame assumptions and casual relaunch.

**Disposition: LEGACY orchestration; EXTRACT characterized algorithms; REPLACE as architecture**

- do not incrementally turn this file into the new game loop;
- add tests around useful collision sweep, relative-state, and flight-assist behaviors before
  extracting them;
- build new session, time, frame, flight, autopilot, collision, and application services;
- keep the legacy game runnable until slice parity is proven;
- retire route spawning, hull-immunity coupling, and global object translation.

---

## 8. Cross-cutting preservation tests required before refactoring

### Math and science

- physical constants against authoritative values;
- catalog coordinate conversion reference cases;
- blackbody colors at representative temperatures;
- proper-velocity/beta/gamma round trips;
- closed-form one-g burn cases;
- aberration and Doppler reference angles;
- black-hole characteristic radii;
- stellar-model boundary values.

### Flight and input

- camera loops and rolls without singularity;
- orthonormal basis remains stable over long rotation sequences;
- direct thrust preserves momentum;
- assisted flight turns velocity toward intent at expected authority;
- rebind, collision resolution between keys, reset, and storage failure;
- touch pointer cancellation and orientation/resize behavior.

### Presentation

- screenshots of rest, relativistic starbow, physical planet phase, galaxy LOD stages,
  black-hole lensing, warning states, mobile HUD, map, and ledger;
- scale-aware formatting golden cases;
- death-report causal details for representative impacts/radiation states.

These tests preserve understanding, not necessarily pixel-identical final output.

---

## 9. Recommended implementation order by current file

1. **Do not change:** keep all existing files runnable while documentation and tests are
   established.
2. **Characterize first:** `constants.js`, `color.js`, `relativity.js`, `camera.js`,
   `controls.js`, catalog conversions in `systems.js`.
3. **Build new foundations beside legacy:** time, frame graph, units, identity/provenance,
   render-state boundary, normalized input.
4. **Migrate UI strengths:** binding behavior from `controls-ui.js`; formatters and ledger
   concepts from `hud.js`; responsive patterns from `starfield.css`.
5. **Build Earth–Moon state independently:** do not seed it through `systems.js` or
   `game.js`.
6. **Attach new local flight:** reuse characterized orientation/dynamics concepts behind
   new services.
7. **Replace presentation:** use the selected renderer while retaining reference scenes
   from `render.js`.
8. **Add autopilot/terrain/landing:** new systems, not branches inside legacy `game.js`.
9. **Reintroduce advanced science later:** validated relativity, color, star, galaxy, and
   black-hole modules in roadmap order.
10. **Retire legacy only after parity:** remove files or paths only when their preserved
    behavior and the route back to the Terminal are covered.

---

## 10. What not to do

- Do not add Earth and the Moon as two more generated systems in `game.js`.
- Do not solve precision by increasing rendered/collision radii.
- Do not add more special cases to the legacy gear array for atmosphere or landing.
- Do not make autopilot another boolean beside `assist` inside the current loop.
- Do not use current screen coordinates as the new collision system.
- Do not expand the hand-maintained catalogs before provenance/schema work.
- Do not delete the relativity and color work because it is not needed in Phase 1.
- Do not select a framework by rewriting first and measuring later.
- Do not replace the static deployment requirement with a server dependency.
- Do not update the prototype README to claim target systems already exist.

---

## 11. Audit conclusion

The prototype should survive as a working scientific sketch while a new foundation is
built beside it. Its best work is modular in concept even when not yet modular in code:
relativity, physical color, orientation, input mapping, relative-motion communication,
visual experiments, and honesty.

The migration succeeds when those strengths operate inside a frame-aware, real-scale,
data-provenance architecture—and when route-spawned geography, inflated interaction
scale, monolithic orchestration, routine radiation death, and ambiguous travel regimes
are no longer required to make the game playable.
