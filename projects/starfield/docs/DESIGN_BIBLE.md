# Starfield: Universe Exploration Simulator — Design Bible

> **Status:** Foundational specification<br>
> **Version:** 0.1<br>
> **Date:** 2026-07-25<br>
> **Project location:** `projects/starfield/`<br>
> **Audience:** Ric, future contributors, and any LLM asked to design or implement Starfield

---

## 1. Purpose of this document

This document is the source of truth for what Starfield is meant to become.
It translates the original design conversation into an actionable specification,
records which ideas are settled, distinguishes them from recommendations and open
questions, and explains how the current prototype should evolve without allowing
its existing limitations to redefine the project.

If the implementation and this document disagree, this document wins unless Ric
has explicitly changed the design and recorded that change here.

This is a living design bible, not a snapshot of the present code. The existing
prototype is evidence, research, and reusable groundwork. It is not the final
definition of the game.

### 1.1 Requirement language

The following terms are deliberate:

- **MUST / MUST NOT** — a settled project law.
- **SHOULD / SHOULD NOT** — the preferred design, changeable only for a documented
  reason.
- **MAY** — an allowed option, not a requirement.
- **OPEN** — not yet decided by Ric. Do not silently choose an answer in code.

### 1.2 Decision hierarchy

When sources conflict, use this order:

1. Ric's newest explicit decision.
2. This design bible and its recorded amendments.
3. Focused documents that may later be created under `docs/`.
4. The current `projects/starfield/README.md`.
5. Existing code behavior.

Implementation convenience is never a valid reason to silently reverse a design
law.

---

## 2. The game in one paragraph

Starfield is a browser-native, first-person universe exploration simulator. The
player pilots an extraordinarily capable spacecraft from near present-day Earth
to moons, planets, stars, black holes, nebulae, and galaxies. The universe keeps
its real scale, structure, and physical character; it is the ship that grants the
player better ways to cross it. The experience is built around wonder, freedom,
scientific honesty, precise flight, and discovery. It is not about fuel, crafting,
combat, trade, hunger, or repetitive survival chores. A player should be able to
hover beside a station, skim a mountain, thread Saturn's rings, descend into a gas
giant until the ship can take no more, and then travel across interstellar or
intergalactic distances—all from the same cockpit and on either a phone or a
computer.

### 2.1 The north-star question

Every feature must answer:

> **Does this move the player closer to experiencing the real universe?**

“Would this be a familiar game mechanic?” is not enough. Mechanics exist to make
the universe explorable, legible, and emotionally powerful.

### 2.2 The emotional promise

The player should regularly feel:

- “That object is really there.”
- “That distance is genuinely enormous.”
- “I chose to come here and I flew this ship here.”
- “I understand something I did not understand before.”
- “I have seen the universe from a point of view I could never reach in life.”

---

## 3. Foundational design laws

These laws are settled. Future work must preserve them.

### Law 1 — The universe is not miniaturized

Celestial bodies, orbits, and the distances between them MUST retain their real
scale in the simulation model. The project MUST NOT enlarge planets to make them
easier to hit, spread a planetary system across light-years, or move encounters
into the player's path.

The game makes reality navigable through:

- hierarchical coordinate spaces;
- local reference frames;
- floating origins;
- streaming and levels of detail;
- optical and map-based assistance;
- labels and targeting;
- a ship capable of multiple travel regimes.

The player's capability changes. The geography does not.

### Law 2 — The player may fly manually

Manual flight MUST remain available wherever the ship can physically operate.
The player MUST be able to fly slowly and precisely, including:

- station-keeping beside a spacecraft or station;
- moving at centimeters or meters per second;
- skimming terrain;
- flying through canyons;
- flying through ring systems;
- entering atmospheres;
- hovering and landing;
- approaching dangerous objects by choice.

Invisible barriers and scripted approach corridors SHOULD NOT replace real
piloting.

### Law 3 — Autopilot is optional, capable, and safe

Autopilot MUST be a major convenience feature, not the only way to travel and not
merely an emergency brake. It MUST:

- plan a safe route;
- avoid known terrain, planets, moons, stations, debris, and ring particles;
- accelerate, coast, brake, and match velocity;
- support hold-position, orbit, approach, landing, and point-to-point travel;
- warn about pressure, heat, radiation, gravity, and route uncertainty;
- avoid unsafe regions unless the player deliberately overrides the warning;
- be interruptible immediately by the player;
- never take away the option of manual flight.

Autopilot is the expert copilot that handles difficult calculations. It is not a
cutscene and it does not teleport the player.

### Law 4 — Fuel and routine survival are solved

Fuel MUST NOT be a resource the player buys, harvests, rations, or worries about.
The ship's power system provides effectively unlimited operational range.

Routine life support, navigation stabilization, and ordinary radiation protection
are also solved technologies. The cockpit MAY display power flow, shield load, or
system state because those readings communicate the environment, but these are not
resource-grind mechanics.

### Law 5 — Radiation informs more often than it kills

Radiation MUST remain scientifically present and visible. The game SHOULD teach
the player about radiation belts, solar storms, cosmic rays, pulsars, energetic
particle environments, and relativistic blueshift.

The ship, however, has exceptional protection. Typical presentation:

```text
External radiation: lethal to an unprotected human
Cabin exposure: nominal
Shielding load: 18%
```

Routine exploration MUST NOT become repeated radiation damage management. Only
deliberate exposure to truly extreme environments may overwhelm the ship.

### Law 6 — Scientific truth and declared fiction are kept separate

Known positions, scales, motion, light, and physical relationships SHOULD be as
accurate as the platform and available data allow. Fictional systems—especially
the drive, extraordinary shielding, power supply, and structural protection—MUST
be labeled as fictional rather than disguised as established science.

Every material approximation MUST be recorded in an honesty ledger with:

- what is altered or unknown;
- the real value or scientific understanding;
- the implemented approximation;
- why the approximation exists;
- its expected effect on the player's experience.

Scientific honesty does not mean that every system must be simulated at research
grade. It means the game never knowingly teaches a compromise as fact.

### Law 7 — Exploration reveals knowledge

Every destination MUST offer enough information at a distance to create curiosity,
but deeper knowledge SHOULD be earned through approach, observation, orbit, landing,
or sustained study.

The player is rewarded with understanding, not currency.

### Law 8 — The sky should look believable to a human observer

The visual target is not the exaggerated star field common to space games. It is
the feeling of looking up under a truly dark sky and recognizing that the same sky
continues around the ship.

From Earth-like viewing conditions, bright planets should be visible, the Milky
Way should emerge under sufficiently dark conditions, and thousands of stars may
be visible when exposure and atmosphere permit. The renderer MUST use physically
motivated brightness, exposure, adaptation, and atmospheric extinction rather
than simply making every star large and bright.

### Law 9 — The project is web-native

Starfield MUST run directly in modern browsers without an installation. It MUST be
playable on desktop and mobile, maintained in Git, and deployable from Ric's site.
The simulation and available destinations remain consistent across devices;
rendering quality and nearby simulation detail may adapt to hardware.

### Law 10 — The player remains inside the ship

The core experience is first-person spacecraft exploration. Landing does not
require an on-foot game. The player may touch down, observe, scan, and learn from
inside the ship. An on-foot mode is outside the current vision unless Ric later
adds it explicitly.

---

## 4. Non-goals

Starfield is not:

- a survival game;
- a crafting game;
- a fuel-management game;
- a hunger, thirst, or oxygen-management game;
- a military or dogfighting simulator;
- a trading or economy simulator;
- a colony or empire builder;
- a loot treadmill;
- a procedural sandbox with no scientific grounding;
- a miniature, compressed, or conveniently rearranged universe;
- a passive planetarium in which the player cannot truly fly;
- a relativistic-physics demonstration and nothing else;
- a desktop interface squeezed onto a phone;
- a promise to simulate every object in the observable universe at full detail.

The project MAY contain drama, danger, fictional technology, and procedurally
completed unknowns. Those elements must serve exploration rather than replacing it.

---

## 5. Player fantasy and point of view

The player commands humanity's ideal exploration spacecraft: a machine advanced
enough to remove tedious limits while still exposing the meaningful structure and
danger of space.

The ship solves:

- fuel and range;
- routine life support;
- routine radiation exposure;
- stabilization and difficult thrust calculations;
- long travel times through an explicitly fictional travel system;
- navigation across extreme scales.

The ship does not automatically solve:

- collision with matter;
- reckless atmospheric entry;
- extreme heat and pressure;
- overwhelming gravity or tidal forces;
- flying into a star;
- unsafe approaches to compact objects;
- poor piloting after safety systems are deliberately overridden.

The ship should feel extraordinary, reliable, and comprehensible—not fragile,
needy, or magical without explanation.

---

## 6. Core experience loop

The fundamental loop is:

1. **Observe** — notice an object in the sky, map, search, or contextual display.
2. **Become curious** — read a short, accurate reason that the object matters.
3. **Choose** — set it as a destination or decide to approach manually.
4. **Travel** — pilot directly or supervise interruptible autopilot.
5. **Arrive** — match velocity, orbit, descend, land, or hold a safe observation
   position.
6. **Experience** — see the environment from the correct scale and perspective.
7. **Learn** — unlock observations, measurements, history, and deeper science.
8. **Continue** — compare, revisit, or choose the next destination.

Travel is not dead time. The changing sky, clocks, scale, environmental readouts,
and approach sequence are part of the experience.

### 6.1 A representative first journey

The intended first-play experience is:

1. Begin near present-day Earth at the current date and approximate time.
2. Look down at Earth and recognize its curvature, light, atmosphere, and motion.
3. Station-keep near the ISS or an appropriately labeled representative station
   if exact live orbital data is unavailable.
4. Move slowly enough to understand translation, rotation, and relative velocity.
5. Select the Moon.
6. Accelerate through an appropriate local travel regime.
7. Watch distance, closing speed, and arrival guidance change.
8. Brake, enter lunar orbit, descend, and land while remaining in the ship.

If this journey does not feel extraordinary, adding millions of stars will not fix
the game's identity.

---

## 7. Universe model

### 7.1 Scale and coordinate architecture

A single ordinary floating-point scene cannot accurately contain a station, Earth,
the Solar System, nearby stars, the Milky Way, and Andromeda at once. The simulator
MUST use a hierarchy of frames.

Recommended conceptual hierarchy:

```text
Observable/cosmological frame
└── Local Group frame
    └── Galactic frame
        └── Stellar-system barycentric frame
            └── Planet/moon frame
                └── Surface/local navigation frame
                    └── Ship/cockpit frame
```

Authoritative positions should use the precision and units appropriate to their
frame. Rendering is always performed relative to a nearby floating origin. Moving
between levels changes representation and simulation detail, not the object's real
location or size.

### 7.2 Layered streaming

The browser MUST NOT download or simulate the entire universe at startup.

Data should stream in layers:

- an immediately playable Earth–Moon region;
- Solar System ephemerides and lightweight body metadata;
- nearby-star catalog points;
- wider galactic and deep-sky catalogs;
- destination-specific system data;
- high-detail terrain, atmospheres, rings, models, and audio only on approach.

The map may know about a very large number of objects as compact records while the
flight renderer maintains high-detail assets only for the current neighborhood.

### 7.3 Time and initial state

The default new session MUST begin near Earth using the actual startup date and
time. Earth, the Moon, planets, and major natural bodies SHOULD be positioned from
real ephemeris data or a documented approximation appropriate to the requested
accuracy.

The ISS SHOULD use current orbital elements when a network connection and reliable
source are available. The game MUST still work without a network. When exact live
data is unavailable, it must present a cached or representative station state with
an honesty label rather than pretending it is live.

### 7.4 Known, inferred, and generated worlds

Each fact about an object should carry an internal provenance class:

- **Measured** — based on an identified observation or catalog.
- **Calculated** — derived from measured values with a known model.
- **Constrained** — plausible within observational bounds.
- **Procedural** — generated where nature is not known.
- **Fictional** — invented for the ship or experience.

Procedural generation MAY complete unknown exoplanets, terrain, atmospheres, and
distant structures, but it MUST:

- respect known measurements;
- use reproducible seeds;
- remain stable between visits;
- never move a system toward the player's route;
- never present invented detail as observed fact;
- record the generative model version so regenerated worlds do not silently change.

The universe does not populate itself for the player's convenience. Search,
mapping, autopilot, and travel technology make emptiness usable.

---

## 8. Flight model

### 8.1 Design target

The flight model must support both immediate accessibility and meaningful physical
behavior. The default controls communicate intent; the flight computer performs
the difficult thrust allocation. A more direct inertial mode MAY expose Newtonian
control for players who want it.

Default assisted flight should support commands equivalent to:

- go where I am pointing;
- translate along this axis;
- hold position relative to this object;
- match this object's velocity;
- enter or leave orbit;
- maintain altitude;
- approach this point;
- land here;
- stop safely.

Turning the camera, rotating the ship, and changing the velocity vector are related
but distinct. The interface must make their relationship understandable rather than
punishing a new player for not already being an astronaut.

### 8.2 Travel regimes

The design MUST distinguish physical and fictional travel instead of feeding all
speeds through one ambiguous label.

#### A. Precision and surface flight

- centimeters per second through aircraft-like local speeds;
- close approach, station-keeping, formation flight, hovering, terrain following,
  rings, and canyons — but **no docking** (decided Ric, 2026-07-25) and no on-foot play;
- high control authority and fine input response;
- speed and velocity displayed relative to a relevant nearby body or target.

#### B. Orbital and interplanetary flight

- physical inertia, gravity, orbital motion, and relative velocity matter;
- flight assistance hides unnecessary burn-planning complexity by default;
- manual players may perform direct transfers and orbital maneuvers;
- autopilot can plot intercepts and arrival burns.

#### C. Relativistic flight

- sublight travel near `c` uses actual relativistic relationships;
- time dilation, aberration, Doppler shift, beaming, and environmental readings
  remain valuable scientific systems;
- the UI clearly states the selected reference frame;
- the player can inspect both traveler time and an appropriate external clock.

#### D. Fictional faster-than-light transit

- interstellar, galactic, and intergalactic travel use a declared fictional drive;
- the game MUST NOT describe FTL results as ordinary special relativity;
- engaging, steering, interrupting, and exiting the drive remain player actions;
- arrival safety, route clearance, and braking rules must be coherent;
- the real distance is retained even when the drive crosses it quickly.

The exact fictional drive model and its treatment of elapsed external time are
**OPEN**. Until decided, implementations may prototype it but must label assumptions
and must not make them permanent lore.

### 8.3 Speed selection

The player needs usable control from tiny local velocities to galaxy-scale transit.
A regime or gear system MAY provide this, but it must not imply that selecting a
gear erases momentum or silently changes the laws of physics.

The final control model SHOULD provide:

- direct access to precision speed;
- smooth acceleration and braking;
- an understandable current regime and target regime;
- closing-speed and stopping-distance guidance;
- automatic limits near terrain unless overridden;
- no accidental FTL activation from a small input mistake.

### 8.4 Reference frames and readouts

“Speed” without “relative to what?” is incomplete. The HUD should prefer the frame
most relevant to the current task and allow inspection of others:

- surface-relative near terrain;
- body-relative near a planet or moon;
- target-relative during intercept;
- system-barycentric during orbital navigation;
- galactic or cosmological frames only where useful.

The existing Sun-rest-frame model may remain as one scientific frame, but it MUST
NOT be the only frame or the default answer in every situation.

---

## 9. Autopilot and navigation computer

### 9.1 Autopilot actions

The long-term autopilot should offer:

- hold attitude;
- hold position relative to a target;
- match velocity;
- stop relative to the selected frame;
- approach to a chosen standoff distance;
- enter stable orbit;
- maintain orbit;
- descend and land;
- take off;
- follow terrain at a safe clearance;
- travel to a selected world, system, or deep-sky object;
- return to Earth or another saved location.

### 9.2 Safety behavior

Autopilot MUST continuously evaluate:

- collision trajectories;
- stopping distance;
- terrain clearance;
- ring and debris density;
- atmospheric heating;
- pressure and temperature;
- gravity and tidal stress;
- stellar heat;
- radiation and shielding load;
- uncertainty in source data.

It should explain route changes in plain language. “Unsafe” should never mean
“forbidden”: the player may take manual control or explicitly override protection,
except where a restriction exists solely to prevent a broken simulation state.

### 9.3 Manual interruption

Any meaningful manual flight input MUST immediately pause or disengage the relevant
autopilot action without a confirmation dialog. The interface should make the new
state unmistakable and preserve the selected destination when useful.

---

## 10. Celestial environments

### 10.1 Rocky bodies

Rocky planets and moons should support:

- correct global radius and gravity;
- meaningful terrain at multiple levels of detail;
- orbit, descent, hover, low flight, canyon flight, and landing;
- collision with the actual terrain surface;
- lighting based on real star direction and local time;
- known landmark data where licensing and performance permit;
- scientifically constrained procedural terrain where detailed measurements do
  not exist.

Terrain is not allowed to be scaled vertically merely to create drama without an
honesty entry.

### 10.2 Atmospheres

Atmospheric behavior should depend on composition, pressure, density, gravity,
altitude, entry velocity, and star light. At minimum it must communicate:

- drag and aerodynamic heating;
- changing visibility and scattering;
- temperature and pressure;
- safe or unsafe descent conditions;
- wind only when supported by data or explicitly modeled.

The ship may be extraordinarily capable, but high-speed entry remains dangerous.

### 10.3 Gas and ice giants

Gas giants MUST NOT have a fake solid surface. As the player descends:

- pressure increases;
- temperature changes;
- visibility and atmospheric appearance change;
- turbulence and vehicle stress may increase;
- warnings escalate;
- the ship eventually reaches and may exceed its design limits.

The failure state comes from the environment, not from colliding with an invisible
sphere. Autopilot avoids an unsafe descent unless deliberately overridden.

### 10.4 Rings and debris

The player MUST be able to enter and manually fly through ring systems. Rings are
not painted disks. Their large-scale density and appearance should be physically
motivated, while nearby hazards resolve into discrete particles or representative
collision geometry.

A collision at 30 m/s may damage the hull depending on the particle's mass, material,
shape, and impact geometry. A sufficiently energetic impact destroys the ship.
Autopilot routes around known threats or threads a conservative path through them.

The renderer need not instantiate every grain. Statistical fields and deterministic
local realization MAY preserve both performance and believable danger.

### 10.5 Stars

Stars should be light sources and physical environments, not decorative spheres.
Approach should communicate:

- apparent brightness and angular size;
- spectrum and color temperature;
- radiant heating;
- particle environment;
- stellar class, mass, radius, and age where known;
- increasing danger without arbitrary proximity walls.

### 10.6 Black holes and compact objects

Compact objects should retain the existing project's scientific ambition:

- gravitational lensing;
- photon-ring and shadow concepts;
- accretion behavior when matter is actually present;
- relativistic beaming and red/blueshift;
- tidal and radiation hazards appropriate to mass and environment.

Visual spectacle must be tied to an explained physical cause. A dormant black hole
should not automatically receive a bright movie-style accretion disk.

---

## 11. Damage, danger, and death

### 11.1 Primary dangers

Threats should be direct, legible consequences of the environment or piloting:

- collision at meaningful relative velocity;
- unsafe atmospheric entry;
- terrain impact;
- heat and pressure beyond design limits;
- overwhelming gravity or tidal force;
- entry into a star;
- extreme compact-object environments;
- exceptional radiation or particle loads;
- deliberate operation beyond the ship's protection envelope.

The game should show the causal chain: what happened, what warning was available,
what physical quantity exceeded the limit, and how the player could have avoided it.

### 11.2 Hull model

Hull damage should depend on energy and location rather than a generic collision
checkbox. Minor impacts may produce localized damage and degraded capability;
larger impacts may be catastrophic. Routine maintenance MUST NOT become a crafting
loop.

**Decided (Ric, 2026-07-25): hull damage is persistent and repaired only at Earth.**
Damage does not self-heal in flight; the player must return to Earth to get the hull
fixed. This is what bounds an expedition — you venture out as far as you can before
damage or a lethal event ends the run. There is no material gathering, repair currency,
or repair timer. **Fuel is never a concern.**

> **`OPEN` — hull/radiation interaction.** Ric's phrasing ("hull damage makes it so
> radiation can fix it, but you have to go back to Earth to get the hull fixed") is
> ambiguous; the most likely reading is that a *damaged* hull lets radiation become a
> threat (an intact hull shields normally), with Earth the only repair point. Confirm
> before implementing exact numbers.

### 11.3 Consequence of death

**Decided (Ric, 2026-07-25): death is permanent.** When the ship is destroyed the run
ends and the universe restarts — death is final, as in real life, and the player must
fly carefully. There is no progress-preserving respawn, durable-checkpoint recovery, or
casual instant restart as a shipped mechanic.

A clearly-labeled temporary reset MAY exist during development as a testing aid, but it
is scaffolding and not the rule. The earlier "OPEN" alternatives (return to last safe
arrival, durable checkpoint, optional consequence setting) are superseded by this
decision.

---

## 12. Discovery, education, and progression

### 12.1 Progressive information model

Information should unfold in layers:

1. **Distant awareness** — name or catalog identifier, object type, distance, and
   a short reason to care.
2. **Targeted study** — basic measured properties and a preview of what might be
   observed there.
3. **Approach** — changing apparent properties, environment, and mission guidance.
4. **Local observation** — composition, structure, motion, terrain, weather, or
   other relevant measurements.
5. **Context** — discovery history, scientific importance, comparisons, and open
   questions.
6. **Deep explanation** — optional models, diagrams, equations, and source notes.

Enough information must be available before travel to make the destination
interesting. The player should never have to fly blindly just to learn whether an
object matters.

### 12.2 Progression

Progression is primarily:

- places visited;
- observations completed;
- phenomena witnessed;
- scientific explanations unlocked;
- routes and perspectives saved;
- personal expedition history.

It is not an economy. Destinations, basic flight capability, and fuel MUST NOT be
locked behind grinding. Optional guided journeys MAY provide structure without
restricting free exploration.

### 12.3 Scientific presentation

Educational content should be layered so it never blocks flight:

- one-sentence insight first;
- expandable explanation second;
- deeper technical treatment on request;
- sources and data provenance available without cluttering the cockpit.

The game should distinguish observation from interpretation and established result
from active scientific uncertainty.

---

## 13. Map and destination discovery

The cosmic map is an essential instrument, not a separate abstract minigame. It
must remain understandable across planetary, stellar, galactic, and intergalactic
scales without implying that the universe itself changes scale.

The map should support:

- search by common name and catalog identifier;
- pan, zoom, rotate, and recenter;
- current position, orientation, velocity, and reference frame;
- real distances and scale indicators;
- filters by object type and data confidence;
- saved destinations and expedition history;
- route preview, hazards, ETA, and arrival conditions;
- comparison of traveler time and external time where relevant;
- clear transitions between map scale levels;
- a way to return instantly to the cockpit view without losing context.

The map should offer curated points of interest and short reasons to visit them.
It must not manufacture nearby encounters to prevent boredom.

---

## 14. Interface and controls

### 14.1 Cockpit information priorities

The default HUD should answer, in this order:

1. What am I looking at or flying toward?
2. How fast am I moving, and relative to what?
3. How far away is it?
4. Am I closing or receding?
5. Can I stop or turn safely?
6. What is the ship doing for me?
7. What environmental forces matter right now?
8. What can I learn here?

Advanced physics readouts remain available but should not bury the immediate flight
state.

### 14.2 Desktop controls

Desktop should support keyboard and mouse and SHOULD support common gamepads. The
final mapping is not yet fixed, but it needs:

- look and orientation;
- translation and thrust;
- precision modifier or precision regime;
- brake / hold position;
- target selection;
- map;
- autopilot action and disengage;
- information panel;
- optional roll;
- accessible rebinding.

The current “mouse does nothing on purpose” rule is not a project law and should be
reconsidered through usability testing.

### 14.3 Mobile controls

Mobile MUST receive a purpose-built interface. Recommended baseline:

- left thumb for translation or directional movement;
- right thumb for look and orientation;
- a vertical or contextual speed control;
- precision-flight control;
- brake / hold-position control;
- target and autopilot controls;
- map access;
- expandable information panels;
- safe-area support for notches and browser chrome;
- controller support when a controller is connected.

Touch targets must remain usable at approximately 375 CSS pixels wide. HUD density,
not scientific behavior, adapts to screen size.

### 14.4 Accessibility

The project SHOULD support:

- reduced motion without removing necessary information;
- remappable controls;
- scalable text;
- sufficient contrast;
- alternatives to color-only warnings;
- captions or visual equivalents for meaningful audio;
- adjustable camera shake;
- optional flight assistance;
- readable number formatting across extreme orders of magnitude.

---

## 15. Visual design

### 15.1 General principle

Reality is the art direction. The game should be beautiful because the universe is
beautiful, not because every scene receives artificial nebula fog, oversized stars,
or impossible ambient light.

### 15.2 Exposure and human vision

Rendering should model the practical consequences of human perception:

- dark adaptation;
- exposure changes near bright bodies;
- atmospheric extinction and scattering;
- loss of dim stars when a bright surface or cockpit display dominates vision;
- real angular size wherever possible;
- optical zoom or instrument views when the naked eye would see only a point.

Labels and sensor overlays may make small targets usable without physically
enlarging them.

### 15.3 Lighting

Stars are primary light sources. Planets and moons reflect or emit light according
to their materials and environment. Night sides should be dark unless illuminated
by atmosphere, nearby bodies, artificial lights, aurorae, thermal emission, or
other justified sources.

### 15.4 Adaptive quality

The same universe must operate across very different devices. Quality tiers MAY
adjust:

- internal render resolution;
- texture resolution;
- atmosphere sample count;
- shadow resolution;
- particle density;
- terrain detail distance;
- simultaneous resolved objects;
- post-processing quality.

Quality tiers MUST NOT change celestial positions, scientific facts, destination
availability, progression, or the underlying rules of flight.

---

## 16. Audio design

Space is silent outside the ship. The soundtrack of flight should come from:

- engines and structure transmitted through the hull;
- reaction-control and drive systems;
- warning tones and spoken/system feedback;
- air, vibration, stress, and impacts inside the craft;
- radio or sonification explicitly identified as data;
- restrained music, if used, that supports awe without hiding the environment.

The game MUST NOT imply that external explosions or passing objects naturally
carry sound through vacuum. Deliberate scientific sonification is encouraged when
clearly presented as an interpretation of data.

---

## 17. Web platform and technical architecture

### 17.1 Platform requirements

Starfield MUST:

- load from a normal web URL;
- work in current desktop and mobile browsers;
- use feature detection rather than browser-name assumptions;
- have a safe lower-quality fallback;
- avoid mandatory accounts;
- preserve a useful offline/static mode where practical;
- be deployable through Git-based static hosting;
- keep initial download size controlled through streaming and caching.

The project's current dependency-free implementation is valuable because it works
as static files. A future engine or build step MAY be introduced only after a
documented architecture decision shows that its benefits justify the cost. The
concept requires the web platform; it does not require a particular framework.

### 17.2 Rendering recommendation

A staged renderer should:

- prefer WebGPU when sufficiently supported and stable;
- provide a WebGL 2 fallback;
- degrade gracefully when advanced features are unavailable;
- separate simulation truth from render representation;
- keep catalog objects lightweight until resolution is required;
- use deterministic level-of-detail transitions without changing physical scale.

The exact library or custom-engine choice is **OPEN**. Do not adopt a framework,
bundler, CDN, or external runtime solely because an earlier conversation mentioned
one.

### 17.3 System boundaries

The long-term implementation should separate at least these responsibilities:

- authoritative time and reference frames;
- coordinate hierarchy and floating origins;
- ephemerides and catalog ingestion;
- procedural completion and provenance;
- gravity, atmosphere, collision, and damage;
- ship control and flight assistance;
- autopilot and route planning;
- travel-regime transitions;
- relativistic calculations and visual consequences;
- rendering and levels of detail;
- education and discovery state;
- input abstraction for desktop, touch, and controller;
- saves, settings, and expedition history;
- performance telemetry that does not transmit private data by default.

Simulation state must not be inferred from screen-space rendering shortcuts.

### 17.4 Persistence and privacy

The first persistence layer SHOULD be local to the browser and include settings,
visited destinations, unlocked observations, and expedition history. Export/import
SHOULD be supported before any account system is considered.

Cloud saves and cross-device synchronization are **OPEN**. They must not become a
prerequisite for play.

### 17.5 Performance budgets

Each milestone must define and test explicit budgets for:

- initial transfer size;
- time to first interactive cockpit;
- steady frame rate on a named mid-range phone and desktop;
- peak memory;
- long-frame frequency;
- thermal throttling during a sustained mobile session;
- cache size;
- network-free fallback behavior.

No universal numeric targets are yet settled. They should be chosen against actual
reference devices rather than guessed once and treated as timeless.

---

## 18. Scientific data and provenance

Likely authoritative source families include NASA, JPL, ESA, Gaia releases,
SIMBAD, VizieR, the IAU, exoplanet archives, planetary mission terrain products,
and other peer-reviewed or institutionally maintained catalogs. Every imported
dataset must be evaluated for:

- scientific scope and uncertainty;
- coordinate frame, epoch, and units;
- update cadence and version;
- license and redistribution permission;
- browser download size;
- transformation steps;
- citation and provenance requirements.

Do not copy a catalog into the project without recording where it came from and how
it was transformed.

Recommended metadata for each dataset:

```text
Name
Owning institution
Source URL or publication
Release/version and retrieval date
License/usage terms
Native frame, epoch, and units
Fields retained
Transforms applied
Known limitations
Generated output file(s)
```

The game should expose concise source notes to interested players without requiring
them to read the developer documentation.

---

## 19. Current prototype audit

The existing prototype should not be discarded. It contains useful research and
working systems. The following audit directs future refactoring.

### 19.1 Preserve and expand

| Existing capability | Direction |
|---|---|
| Nearby-star and deep-sky catalogs | Preserve; add provenance, versions, uncertainty, and scalable streaming. |
| Relativistic calculations | Preserve as the sublight relativistic regime, not the entire identity of the game. |
| Aberration, Doppler, beaming, and dual-clock displays | Preserve and validate; present with clear frame and regime labels. |
| Physical stellar lighting concepts | Preserve; extend to real-scale bodies, atmospheres, and exposure. |
| Velocity-vector and relative-motion work | Preserve as simulation groundwork and an optional direct-control mode. |
| Flight-assist groundwork | Expand into intent-based control and full autopilot. |
| Collision detection and detailed loss reports | Preserve conceptually; rebuild against real-scale local geometry and energy-based damage. |
| Mobile joystick and responsive HUD work | Preserve lessons; redesign as a complete mobile interface. |
| Procedural audio | Preserve where it represents ship-borne sound or labeled sonification. |
| Honesty ledger | Make permanent and data-driven across every approximation. |
| Static, browser-native delivery | Preserve as a platform requirement. |

### 19.2 Redesign or remove

| Current behavior | Conflict | Required direction |
|---|---|---|
| Celestial bodies and orbits are enlarged | Breaks real scale | Replace with hierarchical real-scale spaces, labels, zoom, and LOD. |
| Planetary systems can span light-years | Breaks real system geometry | Use real orbital scales inside stellar-system frames. |
| Procedural systems spawn near the flight path | Rearranges the universe for the player | Use stable real positions and scientifically constrained seeded worlds. |
| Relativity is framed as the whole game | Too narrow | Make it one truthful travel regime within broader exploration. |
| High gears mix FTL language with sublight celerity math | Internally contradictory | Define separate sublight relativistic and fictional FTL models. |
| Launch is at rest in a Sun-centered frame | Conflicts with near-Earth present-time start | Begin near Earth with relevant orbital motion and frames. |
| Radiation is a routine hull-death mechanic | Conflicts with exceptional shielding | Keep external measurements; reserve danger for extreme exposure. |
| The only “autopilot” is full stop | Does not meet the design law | Build safe routing, approach, velocity match, orbit, and landing. |
| Manual inertial flight is the mandatory experience | Too demanding as a default | Default to intent-based assistance; retain direct mode as an option. |
| No atmospheric, terrain, or landing model | Blocks core experiences | Add these after the Earth–Moon scale architecture is proven. |
| Gas giants would behave as enlarged colliders | Physically misleading | Model progressive atmosphere, pressure, heat, and eventual failure. |
| Instant relaunch is the only consequence | Does not make expeditions meaningful | Hold until the death/progression decision is settled. |

### 19.3 Existing documentation status

The current `projects/starfield/README.md` accurately describes the prototype as it
exists, but it is no longer the authority for the future design. Do not rewrite it
to promise unimplemented systems. Once implementation work resumes, it should link
to this bible and clearly distinguish “current prototype” from “target design.”

---

## 20. Development roadmap

Each phase must end in something playable. Do not build a massive catalog before
the act of local flight feels compelling.

### Phase 0 — Documentation and decisions

- Adopt this bible as the project authority.
- Resolve the minimum open questions needed for the first prototype.
- Define the scientific accuracy and honesty-ledger schema.
- Choose reference devices and measurable web performance budgets.
- Write a technical architecture decision for the renderer and build strategy.
- Map current modules to preserve, refactor, replace, or retire.

**Exit condition:** another contributor can explain the game, its non-goals, and
the first vertical slice without using the old README as the design authority.

### Phase 1 — Earth–Moon vertical slice

Build the identity-defining experience:

- real-scale Earth and Moon;
- present-date celestial positioning;
- near-Earth starting location;
- representative or current-data station;
- hierarchical frames and floating origin;
- first-person cockpit;
- accessible assisted flight plus a direct inertial option;
- desktop and mobile controls;
- precision station-keeping;
- local acceleration, braking, targeting, and relative-speed HUD;
- a basic map and Moon route;
- atmospheric edge and simple lunar landing;
- collisions and clear consequence reporting;
- layered educational panels;
- scalable quality settings.

**Exit condition:** a new player can start beside Earth, maneuver near a station,
travel to the Moon, enter orbit, descend, and land on both desktop and mobile.

### Phase 2 — Complete local flight

- robust autopilot actions;
- Earth atmospheric entry, controlled descent, hover, terrain flight, and landing;
- higher-detail terrain streaming;
- safe and unsafe approach prediction;
- energy-based collision damage;
- discovery log and local persistence;
- accessible control rebinding and reduced-motion behavior;
- performance tuning against reference devices.

**Exit condition:** both careful manual flight and hands-off safe arrival feel
trustworthy across orbit, atmosphere, and terrain.

### Phase 3 — Solar System

- real planetary ephemerides and reference frames;
- interplanetary navigation and route planning;
- major moons, rings, small bodies, and representative stations;
- gas-giant atmospheric descent model;
- stellar heat and radiation environment;
- progressive scientific content and provenance;
- stable seeded detail where observations are incomplete.

**Exit condition:** every major Solar System destination is correctly placed,
identifiable, reachable, and meaningfully distinct without changing real scale.

### Phase 4 — Nearby stars and relativistic flight

- validated local star catalogs;
- real interstellar spacing;
- sublight relativistic visual and time effects;
- destination streaming and star-system frame transitions;
- known exoplanet data plus clearly labeled constrained completion;
- interstellar autopilot, arrival, and return routing.

**Exit condition:** the player can leave the Solar System, experience truthful
relativistic effects, and arrive at a real nearby star without route-spawned content.

### Phase 5 — Fictional FTL and galactic exploration

- implement the explicitly chosen FTL model;
- galactic-scale map and routing;
- wider catalog ingestion and compact streaming;
- nebulae, clusters, stellar remnants, and the galactic center;
- transitions between catalog representation and local resolved environments;
- clear separation of observed, inferred, procedural, and fictional information.

**Exit condition:** galaxy-scale travel is fast and usable while real positions,
distances, and scientific labels remain intact.

### Phase 6 — Intergalactic scale

- Local Group and selected deeper structures;
- believable galaxies from within and without;
- cosmological distance and time explanations;
- intergalactic routing and representation;
- aggressive streaming and LOD appropriate to browser limits.

**Exit condition:** the player can meaningfully leave the Milky Way and understand
what has changed in scale, time, and certainty.

---

## 21. Acceptance tests for the concept

A feature-complete design must eventually satisfy these experience tests:

### Precision and control

- The player can hold position near a station without fighting the interface.
- The player can choose to fly manually through a canyon or ring system.
- A 30 m/s ring-particle collision produces a consequence based on impact energy.
- Autopilot can perform the same journey safely and can be interrupted instantly.

### Scale and truth

- Earth, the Moon, and their separation are not visually or physically enlarged.
- A distant planet remains a point until its real angular size makes it resolvable.
- Labels, zoom, and maps make that point usable without changing its geometry.
- No system is spawned near the route merely to create an encounter.
- Every significant compromise appears in the honesty ledger.

### Environment

- Atmospheric entry communicates heat, drag, and changing visibility.
- The player can hover, skim terrain, fly in a canyon, and land inside the ship.
- Descending into a gas giant produces pressure and temperature escalation, not a
  collision with an invisible surface.
- Routine space radiation shows high external danger and nominal cabin exposure.

### Knowledge

- A distant destination provides a truthful reason to visit before the trip.
- Closer observation reveals deeper information.
- Measured and procedurally completed facts are visibly distinguishable.
- Sources and data versions can be inspected.

### Platform

- The same save and universe rules work on desktop and mobile.
- Mobile uses a designed touch interface, not shrunken desktop controls.
- Lower quality changes rendering cost, not science or available places.
- A useful experience loads from static hosting without installation.

---

## 22. Open design decisions

These questions are intentionally unresolved. Future LLMs must ask Ric or propose
options with tradeoffs; they must not quietly decide them through implementation.

1. **FTL model:** What does the fictional drive do to traveler time, external time,
   causality, steering, and interruption?
2. **Death consequence:** What meaningful cost follows destruction, and can the
   player choose a gentler mode?
3. **Damage and repair:** Can damaged systems be repaired automatically, only at a
   safe location, or through another non-crafting mechanism?
4. **Progression structure:** Is free exploration sufficient, or should curated
   expeditions form an optional guided path?
5. **Starting station:** Must the ISS be live and exact, or is a clearly labeled
   representative/cached state preferable for reliable offline play?
6. **Time controls:** Does the simulator ever allow pausing, accelerating, or choosing
   a historical/future epoch outside travel effects?
7. **Unknown worlds:** How much procedural completion should be visible for poorly
   measured exoplanets?
8. **Cockpit embodiment:** Is the interior a visible modeled cockpit, a minimal
   instrument view, or selectable presentation modes?
9. **Multiplayer and sharing:** Is this permanently solitary, or may players share
   routes, observations, or sessions later?
10. **Technology stack:** How long should the dependency-free canvas prototype remain
    the base, and what evidence would justify an engine/build transition?
11. **Project name:** Is “Starfield” the permanent public name or a working title?

---

## 23. Instructions for future LLMs and contributors

Before changing code:

1. Read this document in full.
2. Read the repository-level `AGENTS.md`.
3. Inspect the current implementation; do not assume the README describes the target
   design.
4. Identify which design law the proposed change serves.
5. Check whether the change touches an open question.
6. If it does, stop and obtain a decision rather than embedding an assumption.
7. State which current behavior will be preserved, refactored, or removed.
8. Define a browser, mobile, scientific, and honesty-ledger test before implementation.

When implementing:

- Prefer a narrow vertical slice over a wide mock universe.
- Keep scientific state separate from visual representation.
- Preserve real scale and stable geography.
- Never add routine fuel, survival, crafting, combat, trade, or resource grind.
- Never make radiation a constant nuisance.
- Never use procedural encounters to fill empty space around the player.
- Never present fiction or generated data as observation.
- Never sacrifice manual precision flight to make autopilot easier.
- Never sacrifice mobile play to improve desktop-only visuals.
- Do not push or publish unless Ric explicitly asks.

After implementing:

- Test desktop and approximately 375 px mobile layouts.
- Test with reduced motion.
- Test the feature on a lower-capability quality tier.
- Verify internal links and static hosting behavior.
- Record new scientific compromises in the honesty ledger.
- Update this bible if Ric made a new design decision.
- Keep “implemented today” claims in the README accurate.

---

## 24. Design change record

Major design changes should be appended here. Do not erase old decisions; mark them
superseded so the project's reasoning remains understandable.

| Date | Decision | Status |
|---|---|---|
| 2026-07-25 | The universe retains real scale; travel capability changes instead of geometry. | Adopted |
| 2026-07-25 | The project is a browser-native desktop-and-mobile simulator maintained in Git. | Adopted |
| 2026-07-25 | Fuel, routine life support, and routine radiation exposure are solved technologies. | Adopted |
| 2026-07-25 | Radiation remains educational and environmental; only extreme exposure is a major threat. | Adopted |
| 2026-07-25 | Autopilot is optional, interruptible, collision-aware, and capable of complete routes. | Adopted |
| 2026-07-25 | Precision manual flight includes rings, mountains, canyons, atmosphere, and landing. | Adopted |
| 2026-07-25 | Gas giants use pressure and temperature progression rather than solid collision surfaces. | Adopted |
| 2026-07-25 | Information is progressively revealed, with enough distant context to motivate travel. | Adopted |
| 2026-07-25 | The sky aims for believable human perception rather than exaggerated star brightness. | Adopted |
| 2026-07-25 | Existing relativity, catalog, lighting, collision, mobile, and honesty-ledger work should be preserved as modules where compatible. | Adopted |
| 2026-07-25 | The exact death consequence, repair model, and FTL time model remain unresolved. | Open |

---

## 25. Final statement of intent

Starfield is not trying to make space busy. It is trying to make the real emptiness,
distance, danger, and beauty of the universe possible to inhabit.

The spacecraft removes the chores that would keep a human from exploring. It does
not erase the universe's identity. The player is free to move carefully or cross
impossible distances, to fly by hand or ask the ship for help, to look without
reading or to follow an observation all the way into the science behind it.

The standard is simple and demanding:

> Keep the universe honest. Give the player the ship required to experience it.
