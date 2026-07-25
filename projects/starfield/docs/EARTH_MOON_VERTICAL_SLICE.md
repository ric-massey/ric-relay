# Earth–Moon Vertical Slice

> **Status:** Target specification; not yet implemented<br>
> **Phase:** First complete playable experience<br>
> **Depends on:** [Design Bible](DESIGN_BIBLE.md),
> [Technical Architecture](TECHNICAL_ARCHITECTURE.md), and
> [Scientific Standard](SCIENTIFIC_STANDARD.md)

## 1. Purpose

This document defines the first version of Starfield that can prove the game works.
It is deliberately smaller than the long-term universe: Earth, near-Earth space, a
station, the Moon, and the journey between them.

The slice is not a throwaway demo. It must establish the architecture and experience
that later scales to planets, stars, and galaxies.

The question it must answer is:

> Is slowly flying beside a station, looking down at a real-scale Earth, choosing the
> Moon, traveling there, entering orbit, descending, and landing already extraordinary?

If the answer is not yet yes, the team should improve this slice rather than add more
of the universe.

---

## 2. Product promise

A first-time player can open a URL on a computer or phone and, without an account or
installation:

1. begin near Earth at the current date;
2. recognize Earth, the Moon, the Sun, and the local sky;
3. maneuver slowly near an orbital station;
4. understand relative velocity and hold position;
5. select the Moon from the cockpit or map;
6. fly manually or engage an interruptible autopilot;
7. arrive without teleportation or scale compression;
8. enter lunar orbit;
9. descend and land while remaining in the ship;
10. learn why the journey and the objects encountered matter.

The same universe state and rules apply on desktop and mobile. The interface and
visual cost may adapt to the device.

---

## 3. Scope

### 3.1 Required space

The slice includes:

- the Sun as the correct primary light source;
- Earth at real global scale;
- Earth's rotation and orientation for the selected epoch;
- a visually and physically meaningful upper atmosphere;
- the Moon at real scale and real separation;
- the Moon's position and orbital motion for the selected epoch;
- a near-Earth station scenario;
- the space between Earth and the Moon;
- a local lunar surface region capable of approach, terrain flight, and landing;
- the real background sky at the fidelity allowed by the selected catalog.

### 3.2 Required player systems

- first-person ship view;
- assisted manual flight;
- optional direct inertial flight;
- precision translation and rotation;
- target selection;
- relevant-frame speed, distance, closing rate, and stopping guidance;
- hold position, match velocity, safe stop, approach, orbit, descent, and landing
  assistance;
- Earth–Moon route planning;
- desktop keyboard/mouse controls;
- touch controls designed for mobile;
- gamepad support SHOULD be included if it does not delay core touch usability;
- progressive object information;
- warnings and override flow;
- local settings and expedition persistence;
- adaptive rendering quality;
- honesty and source information.

### 3.3 Explicitly out of scope

The first slice does not need:

- other fully visitable planets;
- interstellar flight;
- FTL;
- a galaxy map;
- exoplanet generation;
- black holes;
- multiplayer;
- accounts or cloud saves;
- walking outside the ship;
- combat, trade, crafting, fuel, hunger, or resource gathering;
- a complete Earth terrain model;
- a complete high-resolution lunar terrain model;
- real-time weather everywhere on Earth;
- a research-grade simulation of every piece of orbital debris;
- a final decision about death or persistent repair.

Existing prototype systems outside this scope may remain in a legacy path while the
slice is developed, but they must not dictate the new architecture.

---

## 4. Default first session

### 4.1 Launch state

The default session SHOULD begin:

- at the device's current UTC date and time;
- in low Earth orbit;
- within approximately 1–5 km of the selected station scenario;
- already matching the station's velocity closely enough to prevent an immediate
  emergency;
- oriented so Earth and the station are both easy to find;
- with assisted flight enabled;
- at zero player-commanded thrust;
- with autopilot inactive;
- with a short contextual prompt rather than a modal tutorial.

The station state follows this fallback order:

1. reliable live orbital elements when available and successfully validated;
2. a bundled recent element set with its epoch shown;
3. a clearly labeled representative low-Earth-orbit station scenario.

Network access must never be required to start.

### 4.2 First five minutes

The experience should gently lead the player to:

1. look around;
2. identify Earth and the station;
3. translate a few meters;
4. stop relative to the station;
5. drift and see that relative motion matters;
6. engage “match velocity” or “hold position”;
7. open the Moon destination card;
8. understand that both manual flight and autopilot are available.

Prompts should disappear once demonstrated and remain recoverable from help. They
must not freeze the simulation or force a fixed sequence.

### 4.3 First complete journey

The intended journey is:

```text
Near-Earth station keeping
→ leave the station's safety envelope
→ target the Moon
→ preview route and arrival state
→ accelerate manually or engage autopilot
→ observe Earth recede and the sky change
→ perform or supervise the braking phase
→ match the Moon's motion
→ enter orbit
→ select a landing region
→ descend through local terrain LOD
→ hover or fly over the surface
→ land
→ receive the completed expedition record
```

The player may interrupt, reverse course, orbit Earth, explore near space, or fly the
entire route manually.

---

## 5. Physical and spatial model

### 5.1 Real scale

The authoritative model MUST use real values, with documented epochs and uncertainty,
for at least:

- mean and reference radii;
- Earth–Moon distance and relative position;
- gravitational parameters;
- Earth rotation;
- Moon orbital state;
- Sun direction;
- station state when presented as real;
- speed of light and time units.

Earth, the Moon, and their separation MUST NOT be enlarged, compressed, or moved for
playability. Labels, optical zoom, route visualization, and ship capability solve
legibility.

### 5.2 Coordinate frames

At minimum, the slice needs:

- a Solar System or ephemeris frame for Sun/Earth/Moon state;
- an Earth-centered inertial frame;
- an Earth-fixed rotating frame for atmosphere and terrain;
- a station local orbital frame;
- a Moon-centered inertial frame;
- a Moon-fixed surface frame;
- a ship local frame;
- a floating render origin.

Frame transitions must be continuous. Crossing a boundary may change numerical
representation and detail, but it must not visibly move the ship or bodies.

### 5.3 Time

Simulation time is authoritative and expressed in a monotonic internal time standard.
UTC is a display and input format, not the mathematical basis of orbital integration.

For the first slice:

- one real second SHOULD equal one simulation second during normal play;
- opening a normal menu **pauses** local simulation — the ship does not keep moving
  while a menu is open (decision §19.3); the same applies to accessibility pauses;
- large time acceleration is not required;
- relativistic clock divergence is not required at ordinary Earth–Moon velocities;
- the **two-clock rule** applies from the start (Design Bible §7.3): the traveler clock
  equals real elapsed play time and is never scaled, while the home/Earth clock is free
  to diverge later at relativistic speed. Both are visible and clearly distinguished,
  without dominating the local-flight HUD;
- on restart after death, both clocks reset to matching (§13).

### 5.4 Gravity

Gravity must be simulated sufficiently to support believable orbit, descent, hover,
and landing. It must not be weakened merely because the ship is powerful. Flight
assistance applies ship thrust to achieve player intent against real gravity.

The slice does not require a full n-body research integrator. The chosen model must be
documented, stable for the duration of a session, and accurate enough that:

- circular orbits remain stable within the stated tolerance;
- station-relative motion is coherent;
- Earth–Moon transfers do not visibly contradict the ephemeris;
- lunar descent behaves consistently;
- no frame transition introduces free energy or a velocity jump.

---

## 6. Ship behavior

### 6.1 Technology premise

The ship has:

- effectively unlimited operational energy;
- closed and reliable life support;
- exceptional routine radiation shielding;
- six-degree-of-freedom thrust;
- sufficient authority for hover, orbital maneuver, and Earth–Moon travel;
- a navigation computer that can plan and execute safe maneuvers;
- sensors capable of presenting useful targets before the naked eye resolves them.

The HUD may show power distribution, shield load, temperature, or structural load.
These are state and safety information, not consumable-resource mechanics.

### 6.2 Assisted flight — default

Assisted flight converts control intent into safe thrust. It SHOULD provide:

- attitude stability when rotational input is released;
- velocity-vector alignment when the player commands forward travel;
- local translation without requiring manual counter-thrust;
- a configurable speed or acceleration response appropriate to the current context;
- automatic gravity compensation during hover;
- automatic relative-frame selection with a visible label;
- predictive braking assistance near the target;
- terrain and collision warnings;
- no silent course correction after the player explicitly overrides safety.

Assistance is not autopilot. The player still chooses the direction and operates the
ship continuously.

### 6.3 Direct inertial flight — optional

Direct mode exposes the underlying velocity-vector behavior:

- rotating the ship does not rotate its current velocity;
- thrust changes velocity along the commanded body axis;
- releasing thrust preserves inertial motion except for gravity and environment;
- match-velocity and safe-stop commands remain available as emergency assistance;
- the prograde/retrograde markers and reference frame remain visible.

This mode preserves the strongest part of the current prototype without making it a
barrier to first-time players.

### 6.4 Precision regime

The player must be able to command motions small enough for station proximity and
landing. Precision mode SHOULD:

- allow centimeter- and meter-per-second target speeds;
- reduce translational and rotational response;
- show relative distance and closing rate prominently;
- avoid input noise and touch dead-zone drift;
- remain manually selectable;
- activate automatically only as a transparent suggestion, not a forced change.

### 6.5 Safe stop

“Stop” is incomplete without a reference frame. The command must display and use one
of:

- selected target;
- station;
- local surface;
- Earth center/inertial frame;
- Moon center/inertial frame;
- another explicitly selected frame.

The control should normally stop relative to the current target or local surface.
The system must show stopping time, distance, and any reason a safe stop cannot be
completed before impact.

---

## 7. Autopilot

### 7.1 Required actions

The vertical-slice autopilot MUST support:

- hold attitude;
- hold position relative to the station or selected body;
- match velocity;
- safe stop;
- approach to a selected standoff distance;
- leave the station safety envelope;
- route from near Earth to lunar arrival;
- enter and maintain lunar orbit;
- descend toward a selected landing region;
- hover;
- land;
- take off from the Moon;
- return to a stable orbit.

Earth atmospheric landing autopilot is a Phase 2 goal, not required for this slice.

### 7.2 Route plan

Before engagement, a route preview should show:

- destination;
- current and arrival reference frames;
- route phases;
- approximate duration;
- maximum planned acceleration;
- expected closest approaches;
- braking start;
- arrival velocity target;
- known uncertainties;
- safety overrides, if any.

The preview must communicate intent without requiring the player to understand an
orbital-mechanics plot.

### 7.3 Execution

During a route, autopilot must:

- perform continuous collision and stopping-distance checks;
- avoid Earth, the Moon, the station, known spacecraft, and loaded terrain;
- replan when the player's prior actions or updated data invalidate the route;
- state important phase changes;
- keep the cockpit active and look controls available;
- permit target inspection and educational panels;
- avoid turning travel into a black loading screen.

### 7.4 Interruption and override

- Significant manual thrust or translation input immediately suspends route execution.
- An explicit disengage control is always visible while autopilot is active.
- Look-only input does not disengage autopilot.
- The selected destination and route preview remain available after disengagement.
- Resuming requires an updated safety check.
- Unsafe overrides use a deliberate hold or second action, not an easily mis-tapped
  mobile button.

---

## 8. Station scenario

The station exists to teach relative motion and precision flight.

### 8.1 Representation

The station is the **real ISS** (decision §19.1) — not a fictional station — but it only
needs to be **recognizably the ISS**, not an exact replica. Ric's guidance: it should
resemble the ISS; this is a web page, so perfection is not the bar. Get the silhouette
right — truss, solar arrays, module layout — and stop there. The simulation must label
whether its orbit is live, cached, or representative. A detailed visual model must have a compatible license and a
recorded source. A simplified model is acceptable if silhouettes, scale, docking
structure, and collision geometry are honest enough for the intended distance. Note
that modeling the ISS's real docking ports as *structure* is expected; the game itself
has no docking mechanic (§8.2).

### 8.2 Safety envelope

The station scenario SHOULD define zones such as:

- observation distance;
- proximity-operation area;
- keep-out structures and solar arrays;
- departure clearance.

These are navigational guidance, not invisible walls. Manual flight remains possible,
and contact uses collision and damage rules.

**There is no docking** (decision §19.5). The station scenario is observation, station-
keeping, and precision close approach only; the player never docks and never leaves the
ship on foot. This is the deliberate scope of the slice, not a temporary limitation.

### 8.3 Learning outcomes

Without forcing a tutorial, the scenario should let the player discover:

- position and velocity are different;
- matching velocity is not the same as pointing at a target;
- orbital objects are moving rapidly even when they appear still relative to each
  other;
- tiny closing rates matter at close range;
- Earth fills the view because the player is actually near it.

---

## 9. Earth and atmosphere

### 9.1 Earth rendering

Earth needs to be convincing from the default start before it needs to be complete.
Required qualities:

- real angular size from the station region;
- correct day/night terminator for the epoch;
- physically motivated Sun lighting;
- atmosphere visible at the limb;
- clouds MAY use a documented static or time-appropriate dataset;
- city lights MAY appear where justified and must not light the whole night side;
- surface detail resolves progressively without an oversized proxy sphere.

### 9.2 Atmospheric boundary

The atmosphere has no hard shell. Density, scattering, and visibility change
continuously with altitude under the chosen atmospheric model.

**Drag and re-entry heating do not act on the ship** (decision §19.7). The ship's future
technology bypasses them, so the atmosphere is never an aerodynamic force, a braking
effect, or a burn-up hazard. This is declared fiction and requires an honesty-ledger
entry; the atmosphere itself is still modeled and reported honestly.

The first slice needs enough behavior to:

- show the atmospheric limb from orbit;
- report density, pressure, temperature, and composition truthfully with altitude;
- render scattering, limb colour, and visibility changes;
- describe, as education rather than damage, what entry would do to a *real* spacecraft.

Full Earth descent and landing are Phase 2, but the architecture must not make them
impossible.

---

## 10. Moon, terrain, and landing

### 10.1 Global Moon

The Moon must have:

- real radius and gravity;
- epoch-correct position and orientation within stated accuracy;
- correct illumination and phase;
- global low-detail terrain or displacement sufficient for orbit;
- named feature metadata where licensing and size allow;
- no atmosphere.

### 10.2 Landing region

At least one lunar region must support:

- progressive terrain refinement;
- collision at the visible surface;
- meaningful slopes and local relief;
- hover and lateral terrain flight;
- stable touchdown detection;
- a clearly sourced elevation model or clearly labeled procedural refinement;
- return to orbit without reloading the whole game.

The default region SHOULD be visually interesting and operationally forgiving. The
specific region is not yet canon: asked which lunar region should be default, Ric fixed
only the *start* — Earth and the ISS (decision §19.4) — and left the default lunar
landing region to the author for now.

### 10.3 Landing behavior

A safe landing requires:

- landing gear or an equivalent supported contact state;
- speed below configured vertical and lateral limits;
- slope and terrain clearance within ship limits;
- stable contact for a short confirmation interval;
- no invisible snap from high altitude;
- a clear transition to “landed” surface-relative state.

Hard contact may damage or destroy the ship according to impact energy. Destruction is
permanent (§13, decision §19.6): a lethal impact ends the run and restarts the universe
rather than resetting the approach. A labeled reset-to-approach MAY be used during
development as a testing aid only.

### 10.4 Landed experience

Landing is a viewpoint and discovery reward. From inside the ship, the player should
be able to:

- look around;
- see Earth in the lunar sky when geometrically appropriate;
- inspect the landing region;
- read local gravity, light, temperature model, and terrain information;
- record the visit;
- take off.

No on-foot system is required.

---

## 11. Map, targeting, and information

### 11.1 Targeting

The player can select the station, Earth, Moon, Sun, and visible/known reference
objects from either the cockpit or the map. Selection should show:

- name and object type;
- distance;
- relative speed and closing direction;
- current frame;
- short reason to care;
- available actions;
- data confidence and source status.

### 11.2 Earth–Moon map

The slice map needs:

- a real scale indicator;
- current ship state and velocity direction;
- Earth, Moon, station, and relevant orbit/path context;
- smooth transitions between station-local, Earth orbital, cislunar, lunar orbital,
  and surface-local views;
- target selection;
- route preview;
- readable labels on mobile;
- no implication that object sizes shown as icons are physical sizes.

Any schematic icon must be visually distinct from scaled geometry.

### 11.3 Progressive information

Examples of information progression:

| Context | Moon information |
|---|---|
| From start | Name, current distance, phase, one-sentence invitation |
| Targeted | Radius, gravity, orbital relationship, route estimate |
| En route | Changing angular size, arrival guidance, selected historical/scientific context |
| In orbit | Surface features, local measurements, landing regions |
| Landed | Regional geology, lighting, local gravity, observation history, deeper sources |

Information is never used as a paywall. The layers control presentation and reward
attention.

---

## 12. HUD and control surfaces

### 12.0 Presentation philosophy

Information is projected onto the canopy the way heads-up features "pop up on the glass"
in film — **holograms** that appear when relevant and clear when not, and that the
player can **select directly** (planets and other objects are picked on the glass). The
controls are the keyboard and equivalent physical inputs, not on-screen panels to hunt
through. The overriding rule: **the cockpit must never get in the way of the beauty.**

These "holograms" are **flat 2D overlays that look as though they interact with the
world** — a ring around a star showing its name and distance, a route drawn to a
destination entered on the map, the existing speed and clock readouts. They are drawn as
a DOM layer over the 3D canvas, anchored by projecting world positions to the screen; no
volumetric rendering is involved (Technical Architecture §22.2).

The slice ships **three presets** (decision §19.2, Design Bible §14.1):

| Preset | Look |
|---|---|
| **Clean** | No frame — only the view and what the player summons. |
| **Frame** | Bars/struts across the view, TIE-fighter style. |
| **Cockpit** | A jet-style cockpit interior. |

The holographic information layer is common to all three; only the physical framing
changes. All remain first-person and inside the ship. The default preset is still to be
chosen (see §19).

### 12.1 Always-important state

The default HUD should make these immediately readable:

- selected target;
- target distance;
- closing or receding speed;
- current speed and named reference frame;
- stopping distance or impact warning when relevant;
- assisted/direct flight mode;
- autopilot state and next action;
- environmental warning severity;
- precision mode;
- current quality/performance warning only when action is required.

### 12.2 Contextual state

Show when relevant:

- altitude and vertical speed;
- orbital state;
- surface-relative speed;
- atmosphere density and heating;
- gravity and felt acceleration;
- hull or structural state;
- external radiation and cabin exposure;
- route phase and ETA;
- traveler/reference clocks.

### 12.3 Desktop input baseline

The slice must test a default scheme supporting:

- mouse look or another discoverable pointer behavior;
- keyboard translation and thrust;
- roll;
- precision modifier;
- brake/hold position;
- target selection;
- map;
- autopilot action/disengage;
- information/help;
- rebinding and reset.

The exact mapping is a usability decision, not a design law.

### 12.4 Mobile input baseline

At approximately 375 CSS pixels wide:

- two-thumb flight remains possible;
- controls do not overlap critical warnings;
- a deliberate precision control is always reachable;
- brake/hold is reachable without moving the steering thumb;
- target, map, and autopilot are reachable but protected from accidental activation;
- information panels can be dismissed and scrolled;
- safe areas and browser UI are respected;
- orientation change does not corrupt the flight state.

---

## 13. Danger and failure in the slice

Required hazards:

- station collision;
- terrain collision;
- excessive lunar landing velocity;
- excessive acceleration or structural load if the chosen ship envelope includes those
  limits;
- impact damage from debris where the slice includes any.

Atmospheric drag and re-entry heating are **not** hazards (§9.2, decision §19.7).
Routine fuel depletion, oxygen depletion, and hunger are forbidden — **fuel is never a
concern**. Routine radiation never damages the ship (Design Bible Law 5).

**Danger is chosen, and it must be legible before it is fatal (decision §19.8).** Normal
flight around Earth, to the Moon, and down to a landing should be *safe*; the player
learns what is dangerous and avoids it. Warnings, environmental readouts, and stopping
distance must give the player a real chance to react. Death should be hard to reach by
accident and entirely reachable by recklessness.

**There are no checkpoints (decision §19.6).** Destruction ends the run; it is never
undone. What it *costs* is a mode the player selects:

| Mode | On death |
|---|---|
| **Hardcore** | Lose everything — discoveries, photos, records. |
| **Standard** | Restart at the ISS keeping all achievements and discoveries. |
| **Expedition (default)** | As Standard, plus a permanent record of every past run. |

Restarting returns the player to the ISS with **both clocks reset to matching** (§5.3).
The universe is real and catalogued — it does not reseed. A clearly-labeled temporary
reset MAY exist as a development testing aid, but it is scaffolding, not the rule.

**Hull damage is persistent and repaired only at a habitable planet (decision §19.6).**
Damage accumulates on the hull and does not self-heal in flight; the player must return
to a habitable world to get the hull fixed. Within this slice Earth is the only
habitable body, so in practice the slice's single repair point is Earth — but the rule
is written for habitable *planets* generally, not Earth specifically. This is what
bounds an expedition: you venture out as far as you can before damage or a lethal event
ends the run.

> **`OPEN` — hull/radiation interaction.** Ric's phrasing ("hull damage makes it so
> radiation can fix it, but you have to go back to Earth to get the hull fixed") is
> ambiguous; the most likely reading is that a damaged hull lets radiation become a
> threat, with Earth the only repair point. Confirm before implementing exact numbers.

Every destructive event should report:

- object or environment involved;
- relative speed or relevant physical load;
- warnings that were active;
- whether autopilot, assistance, or an override was active;
- that the outcome is permanent (run over, universe restart), or — if a development
  reset is in use — that the reset is temporary scaffolding.

---

## 14. Education and honesty requirements

The slice must demonstrate the scientific standard, not postpone it.

Minimum examples:

- Earth and Moon data show source/version access;
- station state is labeled live, cached, or representative;
- the player can learn why orbiting objects appear stationary relative to one another;
- the atmosphere panel distinguishes a model from live weather;
- terrain records distinguish measured elevation from generated refinement;
- ship propulsion, energy, and shielding are labeled fictional;
- all icons, visual exaggerations, and performance approximations appear in the
  honesty ledger.

---

## 15. Persistence

The vertical slice SHOULD save locally:

- settings and bindings;
- quality selection and cockpit preset (§12.0);
- accessibility settings;
- selected death mode (§13);
- completed first-flight prompts;
- visited/observed milestones and **places seen**;
- **photographs taken**, if photography lands in this slice;
- saved map targets or routes;
- the expedition record (per-run results) when in Expedition mode;
- source-data version associated with a session when relevant.

**No flight-state checkpoint is saved.** Persistence records what the player has
learned, seen, and photographed — never a restorable position that could undo a death
(§13). What survives a death is governed by the selected mode.

The player must be able to reset settings and expedition progress separately.
Account creation and cloud synchronization are not required.

---

## 16. Performance and loading

### 16.1 Loading behavior

- Show useful progress with named stages rather than an indeterminate blank screen.
- Load the near-Earth start before optional lunar high-detail assets.
- Begin interaction only when collision, frame, and minimum visual data are coherent.
- Continue streaming lunar assets during near-Earth play.
- Cache versioned assets when browser storage permits.
- Recover cleanly when optional network data fails.

### 16.2 Quality behavior

Quality adaptation may change visual resolution, terrain detail distance, atmospheric
sample count, texture resolution, shadows, particles, and post-processing. It must not
change body positions, gravity, route results, collision outcomes, information, or
progression.

### 16.3 Required test classes

Before the slice is considered complete, choose named reference devices representing:

- a mid-range current phone;
- a lower-capability supported phone;
- a typical integrated-GPU laptop;
- a modern desktop browser;
- WebGL 2 fallback;
- reduced-motion mode;
- touch-only input;
- keyboard-only input.

Numeric budgets for frame rate, memory, transfer size, and time-to-interactive must be
recorded after an architecture spike on real devices. Guessed budgets must not become
permanent requirements without measurement.

---

## 17. Delivery stages

### Slice A — Correct still universe

- authoritative time source;
- Earth, Moon, and Sun state;
- coordinate frames and floating render origin;
- real scale and correct lighting;
- target inspection and source metadata;
- no player movement required yet.

**Proof:** positions, sizes, and transitions remain stable under camera motion and
time advance.

### Slice B — Station-local flight

- ship state;
- assisted and direct control modes;
- desktop and touch input abstraction;
- station relative frame;
- precision movement, match velocity, hold position, and safe stop;
- collision and warnings.

**Proof:** a new player can maneuver near the station on phone and desktop.

### Slice C — Cislunar journey

- target and map workflow;
- Earth–Moon route;
- safe autopilot;
- manual interruption;
- streaming and frame transitions;
- Moon arrival and orbit.

**Proof:** the journey is continuous, correctly scaled, and recoverable from manual
interruption.

### Slice D — Lunar descent and landing

- lunar terrain LOD;
- surface frame;
- hover and terrain flight;
- collision and touchdown;
- landed information and takeoff.

**Proof:** the player can land manually or with assistance and return to orbit.

### Slice E — Product pass

- progressive discovery;
- honesty ledger;
- persistence;
- accessibility;
- loading and offline failure behavior;
- quality scaling and reference-device optimization;
- clear route back to Ric's Terminal.

**Proof:** the experience is understandable, stable, and compelling without developer
explanation.

---

## 18. Completion criteria

The Earth–Moon vertical slice is complete only when all of the following are true:

### Experience

- A first-time player reaches useful control without reading the old prototype README.
- Station-keeping is satisfying at very low relative speed.
- Earth looks convincing from the launch area.
- The Moon journey retains real distance and scale.
- Manual and autopilot travel are both viable.
- Lunar arrival, descent, landing, and takeoff form one continuous experience.

### Safety and agency

- Autopilot avoids known collisions and dangerous arrival states.
- Manual input interrupts autopilot immediately.
- The player may deliberately override safety and receives a clear warning.
- Failure reports physical causes rather than only “game over.”

### Science

- Required data has source/version records.
- Generated, modeled, and fictional information is visibly distinguished.
- The honesty ledger covers material visual and simulation compromises.
- Real scale, reference frames, lighting, and relative motion pass defined tests.

### Platform

- The slice works by URL on supported desktop and mobile browsers.
- It remains usable at approximately 375 CSS pixels wide.
- A WebGL 2 or otherwise declared lower-feature fallback is functional.
- Quality changes do not alter simulation outcomes.
- Optional network failure does not prevent a session.
- No account, installation, or fuel/resource loop is required.

### Architecture

- Earth, Moon, station, surface, and ship frames transition without visible jumps.
- Simulation truth is independent of render LOD.
- Adding another planet would extend the architecture rather than require replacing it.
- Existing preserved relativity systems can later attach as another travel regime.

---

## 19. Decisions from review with Ric

These were reviewed with Ric on 2026-07-25. They are now design intent for the slice.
Where a decision has game-wide consequences (death, docking, repair), the
[Design Bible](DESIGN_BIBLE.md) is updated to match.

1. **Station — recognizably the real ISS.** The start is the actual ISS, not a fictional
   station, but it only needs to *resemble* the ISS: get the silhouette right and stop
   there — though within that, get as close as is realistically achievable. This is a web
   page; exact replica fidelity is not the bar. **Its orbit defaults to cached elements**
   shipped with the game, so it works offline; live refresh is optional. State is always
   labeled live, cached, or representative per §8.1.
2. **Cockpit — three presets over a holographic glass layer.** Information is projected
   onto the canopy as holograms the player can select directly (planets and objects are
   picked on the glass). Three presets ship: **Clean** (no frame), **Frame**
   (TIE-fighter-style bars), and **Cockpit** (jet-style interior). The controls are the
   keyboard and equivalent physical inputs. The cockpit must never get in the way of the
   beauty. See §12.0.
3. **Menus pause the simulation.** Opening a normal menu pauses local simulation; the
   ship does not keep moving while a menu is open. See §5.3.
4. **Default start location is Earth and the ISS** — the one place every expedition
   begins. Ric did not fix a specific default *lunar* landing region; the slice must
   support at least one lunar landing region (§10.2), but which one is default remains
   the author's choice for now and is still not canon.
5. **No docking.** The game has no docking mechanic. The player may approach, station-
   keep, observe, and later *land on planetary and lunar surfaces*, but never docks and
   never leaves the spacecraft on foot. See §8.2.
6. **No checkpoints; death ends the run, and its cost is a selectable mode.** Death is
   never undone. The player chooses **Hardcore** (lose everything), **Standard**
   (restart at the ISS keeping achievements), or **Expedition** (Standard plus a
   permanent record of every run) — **Expedition is the default**. Restart returns the
   player to the ISS with both clocks reset to matching. Hull damage is persistent and
   repaired only at a **habitable planet** (within this slice, Earth). **Fuel is never a
   concern.** See §13 and the [Design Bible](DESIGN_BIBLE.md) §11.2–§11.3.
7. **Atmospheric drag and re-entry heating are removed.** The ship's future technology
   bypasses them, so air is never a force or a burn-up hazard. Declared fiction;
   honesty-ledger entry required. The atmosphere is still modeled and reported honestly.
   See §9.2.
8. **Risk is chosen, not ambient.** Normal travel is safe and death should be hard to
   reach by accident; deliberate hazards (rings, debris, reckless approach) carry real
   consequences, and every danger must be legible before it is fatal. Routine radiation
   never damages the ship. See §13 and Design Bible Law 5.
9. **Two clocks.** Traveler time equals real play time and never scales; home/Earth time
   diverges through real relativity. See §5.3 and Design Bible §7.3.
10. **Free and open source.** Nobody is ever charged for the game. Asset licences must
    still be compatible and attributed. See Design Bible §17.6.

11. **Rendering stack: Three.js on WebGL 2**, with the HUD and all overlays as a DOM
    layer above the canvas. Chosen for "works and looks good" per Ric; subject to the
    architecture spike. See [Technical Architecture §22.1–§22.2](TECHNICAL_ARCHITECTURE.md).
12. **Photography ships in this slice.** It is just a control: zoom, press the capture
    button, optionally attach a note. See Design Bible §12.4.
13. **Repository licence is MIT.**

**Still to decide for this slice:** which cockpit preset is the default (§12.0) and the
default lunar landing region (§10.2) — both flagged by Ric for further discussion.

During development, a clearly-labeled temporary reset MAY still be used as a testing
aid, but it is not the shipped rule and must be marked as scaffolding.
