# Starfield Technical Architecture

> **Status:** Target architecture and decision framework; not yet implemented<br>
> **Primary target:** [Earth–Moon Vertical Slice](EARTH_MOON_VERTICAL_SLICE.md)<br>
> **Product authority:** [Design Bible](DESIGN_BIBLE.md)

## 1. Purpose

This document describes the architecture required to build Starfield from local
surface flight to intergalactic exploration while remaining a browser application.
It is specific about responsibilities, state, precision, data flow, testing, and
migration. It deliberately does not declare a permanent library or build tool before
the project has measured the alternatives.

The architecture exists to protect four properties:

1. **Real scale** — geometry is not enlarged or rearranged for playability.
2. **Continuous experience** — changing scale or reference frame does not become a
   teleport, visible jump, or unrelated minigame.
3. **Scientific provenance** — the runtime knows which values are measured, derived,
   modeled, procedural, or fictional.
4. **Web reach** — the experience remains usable on desktop and mobile browsers with
   adaptive visual cost.

---

## 2. Architectural principles

### 2.1 Simulation truth is not render geometry

The authoritative radius, position, velocity, mass, time, and provenance of an object
must not be inferred from the mesh, sprite, canvas mark, label, or level of detail used
to draw it.

A planet may be:

- a catalog point in a distant map;
- a subpixel target with a label;
- a shaded sphere in orbit;
- a tiled terrain surface during descent.

All are representations of one object with one authoritative physical state.

### 2.2 Reference frames are explicit

Every position and velocity must carry or be owned by a known frame. APIs must not
accept an unlabeled vector whose frame has to be guessed from context.

### 2.3 Units are explicit

Authoritative local physics SHOULD use SI units. Catalog ingestion may use native
astronomical units, but conversion occurs at a defined boundary. Names such as
`distance`, `speed`, and `radius` are insufficient in persistent or cross-module data;
the schema or type must establish units.

### 2.4 Fidelity is layered

The universe is represented at different levels of computational detail, not different
physical scales. A distant object can be approximate to render while remaining correct
in authoritative position and identity.

### 2.5 Capabilities degrade, rules do not

Lower-quality modes may render less detail or update distant visual systems less often.
They may not move bodies, change gravity, alter collision results, remove destinations,
or create different scientific facts.

### 2.6 Network is optional

Network data may improve currency—such as recent station orbital elements—but the
core experience must start from bundled, versioned data when offline or blocked.

### 2.7 Open decisions stay configurable

If Ric has not settled a behavior, keep prototypes behind a narrow policy interface or
configuration. Do not spread an assumption through physics, UI, save data, and lore.

---

## 3. Proposed system layers

```text
Product/UI layer
├── Cockpit and HUD
├── Map and destination discovery
├── Education and source views
├── Settings, accessibility, and persistence UI
└── Scenario/tutorial orchestration

Application layer
├── Session lifecycle
├── Player commands
├── Autopilot mission execution
├── Discovery/progression
└── Save/load coordination

Simulation layer
├── Authoritative clock
├── Frame graph and transforms
├── Ephemeris/body state
├── Ship dynamics and flight assistance
├── Gravity, atmosphere, terrain contact, and damage
├── Collision broad/narrow phases
└── Relativistic and future FTL regimes

World-data layer
├── Catalog registry and provenance
├── Dataset adapters and validation
├── Object identity and metadata
├── Procedural completion
├── Asset manifest
└── Cache/version management

Presentation/platform layer
├── Render-scene construction and LOD
├── WebGPU/WebGL renderer adapters
├── Audio and sonification
├── Input adapters
├── Workers and scheduling
└── Browser capability and performance management
```

Dependencies should flow downward or through defined interfaces. The renderer must not
become the owner of orbital state. The HUD must not mutate physics directly. Catalog
parsers must not know about DOM elements.

---

## 4. Runtime state model

### 4.1 Immutable identity

Every persistent astronomical object needs a stable identifier independent of display
name. The record should include:

- internal stable ID;
- source catalog identifier(s);
- common names and aliases;
- object class;
- authoritative parent or barycentric relationship;
- provenance references;
- model/version identifiers for generated detail.

Names can change across catalog versions. Saves and route history must use stable IDs.

### 4.2 Authoritative dynamic state

At a given simulation time, dynamic state includes:

- owning reference frame;
- position and velocity in that frame;
- orientation and angular velocity where relevant;
- physical parameters needed by active simulation;
- uncertainty or source epoch when relevant;
- active level of simulation, separate from render LOD.

The ship also owns:

- physical pose and velocity;
- current reference-frame context;
- commanded versus actual acceleration;
- travel mode (Local…Intergalactic);
- autopilot state and route phase;
- contact/landed state;
- structural, thermal, pressure, and shielding state;
- selected target and target-relative solution.

### 4.3 Derived state

Distance, closing rate, altitude, orbit classification, stopping distance, apparent
brightness, and map projection are derived. Cache them only with explicit invalidation.
They must not become competing sources of truth.

### 4.4 Fixed simulation step

Ship dynamics, collision, and safety prediction SHOULD run on a bounded fixed or
semi-fixed simulation step independent of render frame rate. Long browser frames must
not let the ship tunnel through terrain or multiply acceleration.

Rendering interpolates between simulation states. Distant ephemeris evaluation may
run at a lower cadence when its error remains within a documented tolerance.

---

## 5. Time architecture

### 5.1 Internal time

Use a monotonic numerical time representation appropriate for ephemeris evaluation.
UTC is for display and input; it contains conventions that should not be mixed directly
into integration math.

The time service owns:

- session epoch;
- current simulation time;
- pause and time-rate policy;
- conversion for display;
- traveler/reference clocks;
- data epochs and validity windows;
- deterministic replay time when testing.

### 5.2 Time domains

Keep these distinct:

- wall-clock time;
- render-frame time;
- simulation coordinate time;
- ship proper time when relativity matters;
- external/reference-frame time;
- dataset epoch.

The current prototype's `shipYears`, `homeYears`, and frame delta logic should inform
this work, but the future API must not assume the Sun frame is universally “home.”

### 5.3 Large time changes

If future design allows time acceleration or epoch selection, the runtime must switch
from frame-by-frame orbit stepping to direct ephemeris evaluation or an integrator that
can safely reinitialize. This remains `OPEN-006`; the architecture must avoid baking in
the assumption that all bodies advance only by small deltas.

---

## 6. Coordinate and reference-frame architecture

### 6.1 Frame graph

Frames form a directed graph or tree with time-dependent transforms. Initial minimum:

```text
Solar System barycentric/ephemeris frame
└── Earth-centered inertial
    ├── Earth-fixed rotating
    │   └── local surface frame
    └── station orbital/local frame
└── Moon-centered inertial
    └── Moon-fixed rotating
        └── lunar local surface frame
└── ship body frame
└── floating render frame
```

Later additions include stellar-system barycentric, galactic, Local Group, and
cosmological frames.

Every transform must define:

- parent and child frame;
- valid time range;
- translation;
- rotation;
- relative linear and angular velocity;
- provenance/model;
- precision and error expectations.

### 6.2 Frame selection

The simulation chooses an active local frame based on task and precision, not only
distance. Examples:

- station-relative for proximity operations;
- Earth-fixed for terrain and atmosphere;
- Earth-centered inertial for orbit;
- Solar System ephemeris frame during cislunar transfer;
- Moon-centered inertial for arrival;
- Moon-fixed for descent and landing.

Frame changes require full position and velocity transforms. Changing position without
the corresponding velocity basis is a critical bug.

### 6.3 Floating render origin

The render camera remains near the numerical origin. When the ship moves beyond a
threshold, the presentation layer shifts nearby render representations while the
authoritative frame state remains unchanged.

An origin shift must:

- occur at a simulation boundary;
- preserve the camera-relative position of every active representation;
- preserve velocity and interpolation;
- not fire a collision or discovery event;
- be invisible in audio, HUD, and controls;
- be covered by regression tests.

### 6.4 Precision strategy

The project should not assume one numeric representation covers every scale. Recommended:

- SI floating-point vectors within local frames;
- high-precision or split representations for large inter-frame translations;
- direct ephemeris/catalog evaluation for distant positions;
- camera-relative single-precision data only at the rendering boundary where required;
- no multiplication of light-year-scale coordinates into local collision math.

The exact representation requires a spike and error measurements. “It looks stable” is
not sufficient validation.

---

## 7. World and ephemeris service

### 7.1 Responsibilities

The world service provides:

- object lookup by stable ID;
- state at a requested time and frame;
- hierarchy and relationships;
- physical parameters and uncertainty;
- provenance records;
- active-region streaming requests;
- event notification when data versions change.

### 7.2 Ephemeris adapters

Raw source formats must be converted by offline or build-time ingestion where practical.
Runtime code should consume compact, validated, versioned records rather than parse many
institution-specific formats during play.

Each adapter must test:

- units;
- coordinate frame;
- epoch;
- handedness and axis conventions;
- angle ranges;
- missing values;
- duplicate identities;
- expected position against reference cases.

### 7.3 Offline and live data

Bundled data establishes the reliable baseline. Optional live data uses:

```text
request
→ schema validation
→ plausibility/epoch checks
→ cache with source and retrieval time
→ use if valid
→ otherwise fall back without blocking play
```

The UI must know which branch was used.

---

## 8. Spatial streaming and simulation levels

### 8.1 Separate three kinds of detail

Do not conflate:

1. **Knowledge detail** — how much metadata is loaded.
2. **Simulation detail** — how accurately an object is dynamically evaluated.
3. **Render detail** — how many pixels, triangles, particles, or samples represent it.

A map can have knowledge of millions of objects with no local simulation or detailed
render representation.

### 8.2 Activation volumes

Active regions should be selected by predicted relevance, not just current distance.
Inputs include:

- current frame and location;
- velocity and stopping path;
- selected destination and autopilot route;
- camera direction and optical zoom;
- potential collision time;
- memory/performance budget.

This allows the Moon landing region to stream during the outbound trip and prevents
high-speed arrival before collision geometry is ready.

### 8.3 Handoff contract

When a catalog point resolves into a body, system, terrain, or particle field:

- identity remains the same;
- center, radius, orientation, and velocity agree within declared tolerance;
- brightness and angular size transition continuously;
- labels do not jump to a different object;
- collision becomes active before it can physically matter;
- lower detail remains available until higher detail is confirmed ready;
- failure to load degrades detail or blocks unsafe approach with an honest reason—it
  must not substitute invented geometry silently.

---

## 9. Ship dynamics and flight-control architecture

### 9.1 Command pipeline

```text
device input
→ normalized player action
→ flight-mode interpretation
→ requested motion/attitude
→ safety and assistance policy
→ thruster/drive command
→ physical integrator
→ authoritative ship state
```

Keyboard, mouse, touch, and gamepad must all produce the same normalized action model.
Physics must not read DOM events or key codes directly.

### 9.2 Flight modes

At minimum:

- **Assisted:** player commands intent; computer allocates thrust and stabilizes.
- **Direct:** player commands body-axis thrust and rotation; momentum is exposed.
- **Autopilot:** route executor owns motion commands until interrupted.
- **Contact/landed:** constraints and surface-relative state apply.

Mode changes are explicit events with visible state. Autopilot and assistance are not
the same boolean.

### 9.3 Dynamics modules

Keep separate:

- rigid-body orientation;
- translational dynamics;
- gravity;
- atmospheric forces and heating;
- contact and landing constraints;
- structural/thermal/shield response;
- sublight relativistic integration;
- fictional travel policy.

This prevents the current “one gear system controls physics, time, visuals, and hull
invulnerability” coupling from surviving the redesign.

### 9.4 Travel-regime interface

Every travel regime should expose a common contract:

- valid engagement conditions;
- controllable degrees of freedom;
- position/time advance policy;
- environmental effects;
- disengagement and arrival behavior;
- safety prediction;
- scientific/fictional classification.

The FTL implementation remains open. Its interface should exist only when required,
not as a false abstraction that delays the Earth–Moon slice.

---

## 10. Autopilot architecture

### 10.1 Separate planner, executor, and safety monitor

- **Planner:** creates route phases from current state to goal.
- **Executor:** converts the current route phase into ship commands.
- **Safety monitor:** independently checks collision, stopping distance, terrain,
  atmosphere, and data readiness.

The safety monitor also protects manual flight with warnings, but does not seize control
unless a user-enabled protection policy explicitly permits it.

### 10.2 Route representation

A route is not only a line. It should include:

- origin state and timestamp;
- target identity and arrival goal;
- ordered phases;
- frame for each phase;
- expected state transitions;
- constraints and hazards;
- uncertainty;
- replanning triggers;
- user overrides;
- provenance/model version used for the solution.

### 10.3 Interruption

Manual input publishes an interruption event before the next command application.
The executor releases control, the safety monitor remains active, and the planner marks
the route stale. Look input is not flight input.

### 10.4 Determinism and testing

For fixed initial state, time, data version, and command sequence, route execution
should be reproducible within stated numeric tolerance. Test scenarios must include:

- manual interruption during acceleration;
- target motion change;
- delayed terrain load;
- route obstruction;
- frame transition near a braking phase;
- browser long frame;
- quality-tier change;
- offline fallback data.

---

## 11. Collision, terrain, atmosphere, and damage

### 11.1 Collision layers

- catalog/map objects have no physical collision geometry;
- resolved bodies use analytic broad-phase bounds at their real radius;
- local terrain uses streamed collision tiles;
- stations and ships use simplified physical proxies distinct from render meshes;
- rings use a statistical far field and deterministic local particles/proxies;
- continuous or swept tests prevent high-speed tunneling.

Collision activation must be based on predicted time-to-contact and loaded fidelity.

### 11.2 Terrain

Terrain tiles need:

- stable spatial keys;
- source and model metadata;
- bounded height error;
- matching edges across LOD;
- independent render and collision resolution;
- deterministic procedural refinement where allowed;
- safe eviction outside the active region.

### 11.3 Atmosphere

The atmosphere service provides density, pressure, temperature, composition, optical
properties, and wind when modeled. Flight dynamics, rendering, safety, and education
consume the same underlying model instead of maintaining contradictory versions.

### 11.4 Damage

Damage inputs should be physical events:

- impact energy and location;
- heat flux and accumulated thermal load;
- pressure differential;
- structural acceleration/load;
- external radiation/particle flux and shielding response;
- tidal stress where relevant.

The consequence policy remains separate because repair and death are open decisions.

---

## 12. Rendering architecture

### 12.1 Backend abstraction

The presentation layer SHOULD support a preferred modern backend and a lower-feature
fallback through a narrow rendering interface. Feature detection selects capabilities;
browser names do not.

Do not promise identical effects. Promise equivalent information and coherent visual
meaning.

### 12.2 Render passes/concepts

Likely responsibilities include:

- star and deep-sky background;
- opaque local bodies and structures;
- terrain;
- atmospheres and volumetrics;
- rings/particles;
- stellar and reflected lighting;
- relativistic apparent-position/color transformation;
- optical exposure and adaptation;
- labels, markers, and route overlays;
- cockpit/HUD composition;
- accessibility adjustments.

### 12.3 Apparent versus geometric position

At ordinary local speeds, render state may closely track current geometric state. At
astronomical distance and relativistic speed, observed position and color involve light
travel time, aberration, Doppler shift, and exposure.

The view service should compute apparent observation state from authoritative world
state. The current `view.js`, `relativity.js`, and `color.js` are valuable prototypes of
this separation.

### 12.4 Picking and labels

Selection uses stable object identity. Screen-space picking must not rely only on the
drawn pixel size of a real-scale object; labels and sensor hit areas may be larger while
remaining explicitly interface elements.

### 12.5 Quality manager

The quality manager observes measured frame time, memory pressure signals available to
the platform, thermal symptoms such as sustained degradation, and selected user policy.
It may adjust presentation budgets gradually. It must not change simulation state.

---

## 13. Audio architecture

Audio begins only after a user gesture and must recover from browser suspension.
Inputs should come from authoritative or derived ship/environment state:

- engine and structure vibration;
- contact and impact;
- warning priority;
- atmosphere around the hull;
- optional music state;
- scientific sonification with an explicit label.

External vacuum sound is not an input. The existing procedural `audio.js` can inform a
future ship-audio service, but its interstellar-radiation hiss should be reframed as
structure/sensor sonification rather than literal external sound.

---

## 14. Input and UI architecture

### 14.1 Action model

Define semantic actions such as `look`, `translate`, `roll`, `precision`, `safeStop`,
`select`, `openMap`, and `interruptAutopilot`. Device adapters bind controls to actions.

Preserve the current prototype's strengths:

- rebinding;
- saved mappings;
- action-driven help text;
- no direct key checks scattered through the game loop.

Expand it to touch, pointer, and gamepad through the same action layer.

### 14.2 State projection

The UI reads a stable view model derived from simulation state. It sends commands; it
does not edit simulation objects. This makes desktop and mobile layouts different views
of one game rather than separate control implementations.

### 14.3 Accessibility

Accessibility settings belong in persistent application state and feed rendering,
audio, camera, input, and UI policies. Reduced motion cannot be implemented only as a
CSS query if camera shake and flight effects are produced by JavaScript.

---

## 15. Data, assets, and provenance architecture

### 15.1 Manifests

Every distributable dataset and large asset should appear in a versioned manifest with:

- stable ID;
- version/hash;
- size;
- source and license;
- coverage;
- required/optional status;
- dependencies;
- fallback;
- cache policy.

### 15.2 Dataset pipeline

Preferred flow:

```text
authoritative source
→ retained raw-source record outside runtime bundle when licensing permits
→ validation and unit/frame normalization
→ compact browser format
→ generated provenance report
→ tests against known reference values
→ versioned asset manifest
```

Runtime fetch code must not silently reinterpret missing units or malformed records.

### 15.3 Procedural determinism

Procedural completion is a pure function of stable object ID, model version, seed, and
known constraints. Save files record the model version. Upgrading a generator requires a
policy for existing discoveries rather than silently replacing them.

---

## 16. Persistence architecture

Separate stores for:

- settings and control bindings;
- accessibility and quality preferences;
- selected death mode and cockpit preset;
- expedition/discovery history, places seen, and photographs;
- the per-run expedition record (Expedition mode);
- content/data version metadata;
- cached optional network responses.

There is **no restorable flight-state checkpoint** (Design Bible §11.3): the persistence
layer must not be able to undo a death. Storage is limited to what the player has
learned, seen, configured, and recorded.

Each store needs schema versioning and migration. Corrupt or unavailable storage must
fall back safely without preventing play. Export/import should serialize player-owned
progress independently from large cached assets.

---

## 17. Browser scheduling and concurrency

The main thread must protect input, UI, and frame delivery. Candidates for workers
include:

- catalog search/indexing;
- route planning;
- terrain generation/decoding;
- dataset parsing;
- heavy ephemeris batches;
- procedural object generation.

Worker boundaries must use versioned messages and transferable data where useful.
Authoritative mutation still occurs at controlled simulation boundaries; workers return
results, not competing world states.

Loading, planning, and generation tasks require cancellation when the target or session
changes.

---

## 18. Error and fallback strategy

Failure categories should be visible and recoverable:

- optional live data unavailable → use bundled data and label it;
- high-detail asset unavailable → keep lower detail and prevent unsafe close approach
  only if collision truth is unavailable;
- preferred graphics backend unavailable → select fallback;
- storage unavailable → session-only progress with warning;
- route planning fails → explain why and preserve manual control;
- frame/data inconsistency → stop the affected transition safely and log a diagnostic;
- performance overload → reduce rendering cost, never physics truth.

A generic blank screen or silent substitute is unacceptable.

---

## 19. Testing strategy

### 19.1 Deterministic unit tests

Priority units:

- unit and frame conversions;
- ephemeris reference cases;
- frame position/velocity round trips;
- floating-origin invariance;
- gravity and orbit sanity cases;
- stopping-distance and collision prediction;
- terrain LOD edge agreement;
- atmosphere sample values;
- relativistic formulas;
- provenance classification;
- procedural repeatability;
- save migrations.

### 19.2 Scenario tests

- launch near station;
- hold and match velocity;
- manual interruption of autopilot;
- Earth–Moon route and lunar capture;
- lunar descent, touchdown, and takeoff;
- atmosphere-intersection warning;
- delayed asset load;
- offline startup;
- refresh/restore;
- origin shift during motion;
- background-tab pause/resume;
- device rotation during touch flight.

### 19.3 Scientific regression tests

Use published or independently computed reference values with stated tolerance. A visual
snapshot alone is insufficient for position, orbit, phase, gravity, or spectrum.

### 19.4 Visual and interaction tests

Capture named scenes across quality tiers and viewport classes. Test labels, target
selection, exposure, atmosphere, terrain transitions, warning hierarchy, and touch
occlusion.

### 19.5 Performance tests

Record named device/browser/version, dataset version, quality tier, scenario, duration,
frame-time distribution, memory behavior where measurable, transfer size, and thermal
degradation. Average FPS alone is insufficient.

---

## 20. Security and privacy

The core game needs no location permission, contacts, microphone, camera, account, or
personal telemetry. Do not add browser geolocation to choose an Earth viewpoint.

If analytics are ever proposed, they require a separate explicit decision and must not
be necessary for play. External data and assets need controlled origins, validation,
and a content-security approach compatible with static hosting.

---

## 21. Deployment architecture

The required outcome is a static web deployment reachable from Ric's site. The hosting
pipeline should eventually:

1. validate documentation and data manifests;
2. run deterministic tests;
3. build only if a build system is adopted;
4. verify internal paths under the actual deployment base;
5. report asset sizes and performance-budget changes;
6. publish only from an explicitly approved branch/workflow;
7. preserve a visible route back to Ric's Terminal.

In this repository, pushing `main` publishes the site. Documentation or implementation
work must not push unless Ric asks.

---

## 22. Technology selection decision

`OPEN-010` covers the permanent engine, renderer, language, and build toolchain. The
decision should compare at least:

- continuing/refactoring the dependency-free canvas prototype;
- native browser modules with a custom renderer;
- a focused 3D library with optional build tooling;
- a larger engine only if it can satisfy static hosting and mobile budgets.

Evaluation criteria:

- hierarchical precision and floating-origin support;
- WebGPU path and WebGL fallback;
- mobile memory and thermal behavior;
- terrain, atmosphere, particle, and picking needs;
- deterministic simulation independence;
- asset streaming;
- bundle and cache cost;
- accessibility and DOM integration;
- offline/static deployment;
- long-term maintainability by humans and LLMs;
- license and supply-chain risk;
- migration cost from useful prototype modules.

The selection process should build one measured architecture spike: real-scale Earth and
Moon, floating-origin camera movement, atmosphere limb, target picking, and a representative
mobile load. Do not choose based only on a feature list or a prior assistant's suggestion.

### 22.1 Decision (Ric, 2026-07-25): Three.js on WebGL 2, DOM overlay for the HUD

Ric's direction was explicit: *"I need a rendering stack that will work. I just care that
it works and looks good."* The choice below optimizes for exactly that — proven output
quality and low risk — rather than for novelty.

**Selected: [Three.js](https://threejs.org) (MIT) targeting WebGL 2, with the HUD and
all holographic overlays as a DOM/CSS layer composited over the canvas.**

**Options considered**

| Option | Verdict |
|---|---|
| Keep the 2D canvas prototype | **Rejected.** Cannot deliver terrain, atmosphere, real lighting, or 3D picking. The slice requires all four. |
| Raw WebGL 2 / custom renderer | **Rejected.** Maximum control, but months rebuilding what a library provides free. Directly contradicts "I just care that it works." |
| Babylon.js | **Viable, not chosen.** Capable and well-engineered, but a larger, more opinionated engine; Three's astronomy/space ecosystem and example base are materially richer. |
| WebGPU-only | **Rejected as a baseline.** Support is good by 2026 but not universal, and mobile behavior is the least predictable part. Shipping WebGPU-only would put the mobile mandate at risk. |
| **Three.js on WebGL 2** | **Selected.** Best quality-per-risk; universal target support including mobile Safari; migration path to WebGPU without rewriting scene code. |

**Why it satisfies the evaluation criteria**

- **Works everywhere that matters** — WebGL 2 is available across current desktop and
  mobile browsers, so the mobile mandate is met by the baseline rather than a fallback.
- **WebGPU path preserved** — Three's `WebGPURenderer` lets the backend change later
  behind the §12.1 interface without rewriting scene, camera, or material logic. Bible
  §17.2's "prefer WebGPU when stable" therefore stays achievable.
- **Licensing** — MIT, matching the repository's own licence, with no supply-chain or
  redistribution complication for an open-source project.
- **Static hosting** — ships as ES modules; no server, no build step required to run.
- **DOM integration and accessibility** — an explicit criterion, and the overlay
  decision below depends on it.
- **Migration** — the preserved prototype modules (`relativity.js`, `view.js`,
  `color.js`, catalogs) are pure math and data; they attach to any renderer.

**Honest costs, recorded rather than hidden**

- Three.js is a *library*, not an engine: terrain LOD, streaming, and the quality
  manager remain ours to build.
- It does **not** solve precision. Floating origin and the double-precision simulation
  layer (§6.3, §6.4) are still our responsibility — Three renders in `float32`.
- It adds a dependency and bundle weight where the prototype had none.

**Reversibility.** The choice sits behind the §12.1 backend abstraction. Simulation truth
stays renderer-independent (§2.1), so a future backend change is a presentation change.

**Still required before this is final.** Per the process above, the measured architecture
spike must still be built and must show: real-scale Earth and Moon, stable floating-origin
camera motion, a credible atmosphere limb, reliable target picking, and an acceptable
mobile load. **If the spike fails on mobile memory, thermals, or precision, this decision
is reopened** — selecting a presumptive stack does not waive the measurement.

### 22.2 Overlays and HUD are 2D DOM, not 3D geometry

Ric clarified (2026-07-25) that the "holographic" presentation is **2D screen-space
overlay that merely looks like it interacts with the world** — for example a ring drawn
around a star carrying its name and distance, or a route drawn to a destination punched
into the map. Speed, clocks, and similar readouts are already overlays of this kind.

There is no volumetric or true-3D holography. This is a significant simplification and
is adopted deliberately:

- markers/labels are positioned by **projecting world coordinates to screen space**, then
  drawn as ordinary DOM/CSS elements (or a 2D canvas) composited above the WebGL canvas;
- text stays crisp at any DPI, is selectable and screen-reader reachable, and is styled
  with normal CSS — all of which in-canvas text sacrifices;
- overlay cost scales with the number of *visible annotations*, not scene complexity;
- the three cockpit presets (Bible §14.1) become overlay/CSS variations rather than three
  different 3D interiors — only the **Cockpit** preset needs modeled geometry, and even
  that may be a framing image rather than a scene.

Picking still resolves against real object identity (§12.4), and hit areas may exceed the
drawn pixel size of a real-scale object.

---

## 23. Proposed target repository shape

This is a responsibility map, not permission to create tooling immediately:

```text
projects/starfield/
├── README.md                     current product/run status
├── docs/                         design and engineering authority
├── public-or-assets/             versioned runtime data/assets, name depends on toolchain
│   ├── manifests/
│   ├── catalogs/
│   ├── ephemerides/
│   ├── terrain/
│   ├── models/
│   └── audio/
├── src/
│   ├── application/
│   ├── simulation/
│   │   ├── time/
│   │   ├── frames/
│   │   ├── world/
│   │   ├── flight/
│   │   ├── autopilot/
│   │   ├── environment/
│   │   └── relativity/
│   ├── data/
│   ├── presentation/
│   │   ├── render/
│   │   ├── audio/
│   │   └── ui/
│   ├── input/
│   ├── persistence/
│   └── platform/
└── tests/
    ├── unit/
    ├── scientific/
    ├── scenarios/
    ├── visual/
    └── performance/
```

Names may change after the technology decision. The boundaries should remain.

---

## 24. Migration strategy from the current prototype

Avoid a big-bang rewrite.

### Stage 1 — Freeze and characterize

- Keep the current prototype runnable.
- Add numeric characterization tests around relativity, color, orientation, controls,
  and catalog conversion before moving them.
- Record known contradictions instead of fixing them opportunistically.

### Stage 2 — Create independent foundations

- time service;
- frame graph;
- unit policy;
- object identity/provenance schema;
- input action abstraction;
- render representation boundary.

These can initially drive a non-game test scene.

### Stage 3 — Build the Earth–Moon still universe

- load normalized data;
- evaluate state for a fixed epoch;
- render real-scale Earth/Moon/Sun;
- prove frame and floating-origin invariance;
- expose sources and labels.

### Stage 4 — Attach ship and local flight

- migrate camera orientation and useful dynamics behind new interfaces;
- implement the assisted flight model (direct mode removed 2026-07-28, Controls §2.3);
- add station-local state and collision;
- migrate control rebinding through normalized actions.

### Stage 5 — Add route, terrain, and landing

- planner/executor/safety separation;
- cislunar frame transitions;
- lunar terrain and contact;
- persistence and product UI.

### Stage 6 — Reintroduce preserved advanced systems

- relativity math;
- apparent-view transformations;
- physical color;
- deep-sky and galaxy representations;
- only after local architecture passes the slice criteria.

At every stage, the old game remains a reference until its preserved value is covered by
tests and migrated. Deletion is the last step, not the first.

---

## 25. Architecture completion criteria

The architecture is credible when:

- a frame round trip preserves position and velocity within defined tolerances;
- an origin shift is visually and physically invisible;
- the same Earth–Moon state drives map, cockpit, physics, and education;
- render LOD changes do not alter collision or orbit;
- a phone can use lower presentation quality without entering a different universe;
- optional network failure produces labeled fallback rather than failure to start;
- autopilot planning, execution, and safety can be tested separately;
- measured and procedural data remain traceable at runtime;
- preserved prototype math runs behind focused interfaces;
- another planet can be added without introducing another global coordinate hack.
