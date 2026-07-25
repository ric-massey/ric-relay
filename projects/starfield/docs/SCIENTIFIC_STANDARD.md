# Starfield Scientific Standard

> **Status:** Project-wide standard<br>
> **Applies to:** Data, simulation, rendering, education, interface, and fictional ship
> systems<br>
> **Product authority:** [Design Bible](DESIGN_BIBLE.md)

## 1. Purpose

Starfield's promise is not that every calculation is research grade. Its promise is
that the player can tell what is known, what is calculated, what is approximated, what
is generated, and what is fictional.

This standard defines how scientific claims enter the project, how they are transformed,
how accuracy is tested, and how compromises are communicated. It exists to prevent two
equal failures:

- silently changing reality to make the game easier;
- making the project impossible by treating every unmodeled detail as dishonesty.

The standard is:

> Use the best appropriate model, preserve the real relationship being taught, record
> uncertainty and compromise, and never present invention as observation.

---

## 2. Classification of every scientific value

Every material object property, environmental state, or educational claim should fit
one of these classes.

### 2.1 Measured (`M`)

Directly sourced from an observation, catalog, mission product, or institutionally
published constant.

Examples:

- a cataloged star position and parallax;
- a measured planetary radius;
- a lunar elevation sample;
- an ISS element set at a stated epoch.

Requirements:

- source and release/version;
- native units and frame;
- epoch where applicable;
- uncertainty where available;
- transformation record.

### 2.2 Calculated (`C`)

Derived from measured inputs using an identified equation or model.

Examples:

- Cartesian position converted from right ascension, declination, and distance;
- Moon phase calculated for the session epoch;
- surface gravity from mass and radius;
- blackbody color from effective temperature.

Requirements:

- input provenance;
- formula/model identifier;
- assumptions;
- units;
- test reference and tolerance.

### 2.3 Constrained model (`K`)

Not directly measured at the required place/time/detail, but bounded by known science.

Examples:

- a standard atmosphere between reference samples;
- an inferred temperature range;
- a simplified mass–radius relationship;
- unresolved lunar terrain between measured samples.

Requirements:

- known constraints;
- model and version;
- range or uncertainty;
- explanation of why direct data is unavailable or impractical.

### 2.4 Procedural completion (`P`)

Generated detail where observations do not determine a unique answer.

Examples:

- local terrain detail below dataset resolution;
- the appearance of an unobserved exoplanet surface;
- individual nearby ring particles generated from a measured density model.

Requirements:

- stable seed and object identity;
- generator version;
- measured/constrained inputs;
- no contradiction of known data;
- visible labeling at the appropriate information layer.

### 2.5 Fictional technology (`F`)

Invented to make the experience possible.

Examples:

- effectively unlimited ship power;
- extraordinary radiation shielding;
- fictional FTL drive;
- extreme structural capability.

Requirements:

- explicit fictional label;
- internally consistent behavior;
- clear boundary between fictional cause and real environmental response;
- no claim that the technology is established or imminent.

### 2.6 Presentation aid (`A`)

An interface or visualization that makes real information legible without changing
authoritative simulation state.

Examples:

- a target marker larger than the object's angular size;
- a schematic orbit line;
- exposure adjustment;
- false-color scientific visualization;
- sonification of electromagnetic or particle data.

Requirements:

- visually or contextually distinguishable from literal appearance;
- documented if it could be mistaken for physical geometry or perception;
- no effect on collision, navigation truth, or object position.

---

## 3. Scientific fidelity levels

Classification says where a value came from. Fidelity says how closely a subsystem
models the relevant reality.

### Level 0 — Fictional

No claim of physical possibility. Must remain internally consistent and labeled.

### Level 1 — Qualitative

Correct direction, relationship, or category, but not suitable for numerical inference.

Example: pressure rises continuously during a prototype gas-giant descent.

### Level 2 — Educational

Numerically and conceptually correct within a stated approximation for the intended
experience.

Example: a standard atmosphere suitable for entry warnings and an explanation of drag.

### Level 3 — Validated simulation

Compared against authoritative reference cases with recorded tolerances across the
supported domain.

Example: Earth/Moon positions and phase validated for the slice's supported date range.

### Level 4 — Research-oriented

Uses specialist models/data and validation appropriate to scientific analysis. This is
rarely required for the game and must not be implied casually.

Each subsystem declares its intended level. A Level 2 model is not a failure if Level 2
preserves the experience and is labeled accurately.

---

## 4. Accuracy priorities

When time, data size, or hardware prevents equal fidelity everywhere, prioritize:

1. **Identity and provenance** — the player is looking at the correct object.
2. **Position and relationship** — it is in the correct place relative to relevant
   bodies and frames.
3. **Scale** — radius, orbit, and distance are not altered for convenience.
4. **Motion and time** — rotation, orbit, velocity, and epoch are coherent.
5. **Causal physics** — light, gravity, atmosphere, collision, and hazards behave for
   the correct reason.
6. **Uncertainty** — unknowns are not converted into false precision.
7. **Appearance** — color, brightness, terrain, and detail match the best supported
   representation.
8. **Completeness** — more objects and finer detail come after the above.

A small truthful world is preferable to a vast misleading one.

---

## 5. Source policy

### 5.1 Preferred sources

Prefer, in order:

1. primary institutional data releases and mission archives;
2. standards bodies and official astronomical definitions;
3. peer-reviewed catalogs or papers;
4. maintained scientific databases that aggregate and cite primary work;
5. reputable educational summaries for prose context only.

Likely source families include NASA/JPL, ESA and Gaia releases, the IAU, planetary
mission archives, NASA's exoplanet resources, SIMBAD, VizieR, and peer-reviewed
literature. A name in this list is not blanket approval of every dataset; each imported
product still needs license, version, frame, units, and uncertainty review.

### 5.2 Prohibited sourcing behavior

Do not:

- treat a search snippet or uncited article as a data source;
- copy values without recording units and epoch;
- merge catalogs by display name alone;
- redistribute data or imagery without checking usage terms;
- claim live data when using a cache;
- retain more precision than the source justifies;
- use a generated value as the basis for a “measured” educational claim;
- allow an LLM's memory to become an uncited source of numeric constants.

### 5.3 Dataset record

Every imported dataset needs a record containing:

```text
Dataset ID
Title
Owning institution/authors
Primary source URL or publication identifier
Release/version
Retrieval date
License/usage terms
Coverage and intended use
Native coordinate frame and epoch
Native units
Fields retained and discarded
Transforms and filters applied
Known uncertainties and limitations
Generated runtime artifacts and hashes
Validation cases
Maintainer notes
```

---

## 6. Units, frames, epochs, and precision

### 6.1 Units

- Store or type units explicitly at module boundaries.
- Prefer SI in local physical simulation.
- Preserve source-native values in ingestion records when useful for audit.
- Convert once at a documented boundary rather than repeatedly throughout UI code.
- UI may choose human-friendly units but must retain the value's meaning.

### 6.2 Coordinate frames

A position without a frame is invalid scientific data. Record orientation convention,
origin, handedness, and transformation model. Velocity conversion must include moving
and rotating frame effects.

### 6.3 Epochs

Positions and orbital elements belong to a time. Store the source epoch, validity range,
and propagation model. “Current” must resolve to a timestamp and source state.

### 6.4 Significant figures

UI formatting should reflect uncertainty and purpose. Do not display ten decimal places
because a floating-point number contains them. Deep technical panels may expose source
precision and uncertainty separately.

---

## 7. Validation requirements

### 7.1 Numeric models

Each scientific model needs:

- a plain-language statement of scope;
- equations or authoritative algorithm reference;
- input domain;
- expected fidelity level;
- reference cases;
- numeric tolerances;
- failure/out-of-domain behavior;
- tests independent from the implementation when possible.

### 7.2 Cross-model consistency

The same property must not disagree across map, physics, rendering, and education. For
example, Earth radius should come from one authoritative body record even if each system
uses a different representation.

### 7.3 Visual validation

Visual review is appropriate for brightness transitions, atmosphere appearance, terrain
LOD seams, and interface distinctions. It is not enough for ephemerides, gravity,
reference-frame transforms, or collision energy.

### 7.4 Regression fixtures

Keep reference fixtures for:

- known dates and body positions;
- phases and illumination;
- coordinate conversions;
- orbital sanity cases;
- blackbody/color samples;
- relativistic formula cases;
- atmospheric values at selected altitudes;
- terrain sample points;
- collision-energy examples;
- catalog counts and identity joins.

When a source dataset updates, review changed fixtures rather than automatically blessing
new outputs.

---

## 8. Domain standards

### 8.1 Scale and geometry

- Authoritative physical radii and distances are real scale.
- UI icons and minimum marker sizes are presentation aids.
- Render LOD cannot modify collision or flight geometry.
- Terrain exaggeration is prohibited unless optional, labeled, and excluded from
  physical interaction.

### 8.2 Ephemerides and motion

- State the supported time range and expected accuracy.
- Use direct evaluation for large time jumps rather than accumulating small-step drift.
- Label live, cached, propagated, and representative station states.
- Never freeze an orbit merely because motion is inconvenient to render.

### 8.3 Gravity and flight

- Real gravitational relationships remain in effect.
- Ship assistance may apply fictional capability to counter gravity.
- Felt acceleration and gravitational free fall must not be conflated.
- Any maximum acceleration or structural protection is ship fiction, not a change to
  external gravity.

### 8.4 Relativity

The existing prototype's special-relativity work is scientifically important, but its
scope must be clear:

- reference frames are named;
- sublight `beta`, `gamma`, proper time, aberration, Doppler factor, and beaming use
  validated relationships;
- numerical clamps are documented as stability behavior;
- fictional FTL does not reuse sublight formulas as though they prove FTL physics;
- readouts distinguish coordinate distance per time, proper velocity, and ordinary
  relative speed.

### 8.5 Light and human vision

- Spectral class/effective temperature, luminosity, distance, extinction, atmosphere,
  exposure, and adaptation should drive appearance where supported.
- Screen limitations and tone mapping are presentation constraints.
- A label may reveal an object the eye cannot resolve; the object itself is not enlarged.
- False color and long-exposure views are useful but explicitly identified.

### 8.6 Atmospheres

- Composition, density, pressure, temperature, and optical behavior come from one
  versioned model per world/state.
- Live weather is not implied by a climatological or standard atmosphere.
- Unknown exoplanet atmospheres are constrained/procedural, never measured by default.
- Gas giants have continuous pressure/temperature progression, not a solid collision
  shell.

### 8.7 Terrain

- Elevation sources, horizontal/vertical datum, resolution, and error are recorded.
- Procedural refinement cannot overwrite known large-scale features.
- Collision terrain and visual terrain must agree within a declared tolerance.
- Generated detail remains stable between visits.

### 8.8 Rings, dust, and debris

- Distant appearance may use statistical density fields.
- Local particles may be deterministic realizations of that field.
- The game must not imply that every visible pixel is a cataloged physical rock.
- Collision outcomes use relative speed, representative mass/material, and uncertainty.

### 8.9 Radiation and shielding

- External radiation and particle environments remain physically motivated within the
  declared model.
- Cabin exposure is computed through fictional advanced shielding policy.
- The UI shows both when educationally useful.
- Routine exposure does not become a survival resource.
- Extreme failure thresholds are declared ship-design assumptions.

### 8.10 Black holes

- Mass, spin, charge, accretion state, and environment are not interchangeable.
- A bright accretion disk requires a reason.
- Approximate lensing must name its approximation and domain.
- The shadow, photon sphere, event horizon, and ISCO must not be presented as the same
  radius.

### 8.11 Sound

- Vacuum does not carry external sound to the ship.
- Hull-borne vibration, onboard machinery, atmosphere, radio, and warnings are valid.
- Sonification is labeled as data translated into sound.

---

## 9. Procedural-generation standard

Procedural generation fills uncertainty; it does not create conveniently placed
content.

Every generator must define:

- input facts and constraints;
- seed derivation;
- probability model and scientific basis;
- output classification;
- generator version;
- known failure modes;
- tests for constraint violations;
- policy for results created under an older model.

Procedural systems MUST NOT:

- spawn near the player's route;
- change when revisited without a versioned migration;
- contradict a known radius, orbit, mass, composition, or terrain feature;
- receive the same confidence language as measured systems;
- optimize the universe for encounter frequency.

When a later observation supersedes generated detail, the project should preserve the
old expedition record while updating the world's current scientific state and explaining
the change.

---

## 10. Honesty ledger

### 10.1 Purpose

The honesty ledger records material departures from literal reality, source limits, and
fictional enabling technology. It is both developer discipline and player education.

### 10.2 Required entry fields

```text
Ledger ID
Short title
Affected system/object
Classification: approximation, model limit, procedural completion, presentation aid,
or fiction
Real scientific understanding/value
Implemented behavior
Reason
Magnitude/domain of difference
Player-visible consequence
Scientific source or model record
Date introduced
Owner/status
Review trigger
```

### 10.3 What requires an entry

- altered scale, time, position, brightness, or physical behavior;
- simplified gravity, atmosphere, collision, or lensing with a material effect;
- visual exposure or false color that could be mistaken for naked-eye appearance;
- schematic geometry;
- generated terrain/world properties;
- cached/representative data presented in a current-time session;
- fictional drive, shielding, energy, acceleration, and structural capability;
- simulation caps or clamps that affect visible outcomes;
- lower-quality behavior that meaningfully changes presentation;
- **removed physical forces** — notably that atmospheric drag and re-entry heating do
  not act on the ship (Design Bible §10.2). The atmosphere is modeled and reported
  honestly; the ship's non-interaction with it is declared fiction (`F`);
- **recognizable-but-inexact object models**, such as the ISS resembling the real
  station without being a precise replica.

Routine numeric implementation details do not each need a player-facing entry, but
developer notes must cover stability choices with scientific impact.

### 10.4 Presentation

The player-facing ledger should lead with plain language and allow deeper detail. It
should never shame the project for modeling choices. The tone is: “Here is what reality
does, here is what we modeled, and here is why.”

---

## 11. Educational writing standard

### 11.1 Layering

Use four layers:

1. **Invitation:** one sentence explaining why the object or phenomenon is interesting.
2. **Observation:** what the player can see or measure now.
3. **Explanation:** the scientific relationship behind it.
4. **Technical/source detail:** equations, uncertainty, references, and model limits.

### 11.2 Language

- Use plain language before jargon.
- Define the reference frame when discussing speed.
- Distinguish “we observe,” “we infer,” “the model predicts,” and “the game generates.”
- Avoid false certainty and false mystery.
- Do not call an approximation “realistic” without saying in what respect.
- Do not describe fictional ship technology with authoritative scientific phrasing.

### 11.3 Progressive discovery

Information unlocked by approach may become more detailed, but basic identity, distance,
hazard, and a reason to visit must be available before departure. Science is a reward
for attention, not withheld bait.

---

## 12. Review process for new scientific content

Before merging a new dataset, model, or major claim:

1. Assign classification and target fidelity.
2. Record the primary source and usage terms.
3. Confirm units, frame, epoch, and uncertainty.
4. Document transformations.
5. Add independent reference tests.
6. Check cross-system consistency.
7. Add honesty-ledger entries where required.
8. Review player-facing language for classification clarity.
9. Test lower quality and offline behavior.
10. Update dataset/model versions and affected saves if necessary.

An LLM may help locate, transform, explain, or test data. It must not serve as the final
source of numeric truth.

---

## 13. Scientific definition of done

A feature is scientifically complete when:

- its values have classifications;
- its sources and versions are recorded;
- units, frames, and epochs are explicit;
- its intended fidelity and domain are stated;
- it has independent reference tests with tolerances;
- map, simulation, rendering, and education agree;
- uncertainty is preserved appropriately;
- procedural and fictional content is distinguishable;
- material compromises appear in the honesty ledger;
- its player-facing explanation is accurate at every information layer.

Scientific accuracy is not a final polish pass. It is part of the data model and
architecture from the first Earth–Moon slice onward.
