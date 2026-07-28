# Starfield Documentation

This directory defines what Starfield is becoming and how to build it without
losing the original idea.

Starfield is currently in a **documentation and architecture phase**. The playable
prototype in the parent directory is valuable research, but it does not yet match
the target design. Read “current” and “target” carefully throughout these files.

## Start here

Read the documents in this order:

1. [Design Bible](DESIGN_BIBLE.md) — the complete product vision, design laws,
   non-goals, experience model, roadmap, and unresolved questions.
2. [Earth–Moon Vertical Slice](EARTH_MOON_VERTICAL_SLICE.md) — the first buildable
   product specification and its acceptance criteria.
3. [Technical Architecture](TECHNICAL_ARCHITECTURE.md) — the target system model,
   coordinate hierarchy, simulation boundaries, rendering strategy, and migration
   constraints.
4. [Scientific Standard](SCIENTIFIC_STANDARD.md) — how facts, calculations,
   approximations, procedural completion, and fictional technology are classified
   and communicated.
5. [Visual Perception](VISUAL_PERCEPTION.md) — what space actually looks like to a human
   eye, the adaptation model, stars, colour, the Earth limb, and what is forbidden.
6. [HUD and Cockpit](HUD_AND_COCKPIT.md) — the presets, the octagonal canopy, the
   on-glass information layer, labelling, warnings, damage, and photo mode.
7. [Controls](CONTROLS.md) — the flight-control model, default schemes for desktop,
   gamepad and touch, input feel, rebinding, and accessibility.
8. [Data Sources](DATA_SOURCES.md) — the manifest of every external dataset, catalogue,
   texture and model, with licence rules and a verification checklist.
9. [State of Play](STATE_OF_PLAY.md) — **what the game actually does today**, the
   honest distance from it to these documents, and the parity list that decides when
   `fly.html` is retired. Start here if you are asking "what needs to be done?"
10. [Implementation Audit](IMPLEMENTATION_AUDIT.md) — a file-by-file map of the
    current prototype: preserve, refactor, replace, or retire.
11. [Prototype README](../README.md) — what the existing prototype does and how to
    run it today.

## Authority

When documents or code disagree, use this order:

1. Ric's newest explicit decision.
2. `DESIGN_BIBLE.md` and amendments recorded there.
3. The focused specification responsible for the system in question.
4. `IMPLEMENTATION_AUDIT.md` for migration intent.
5. The prototype `README.md` for current behavior only.
6. Existing code behavior.

The code is not allowed to settle an open design question merely because it already
does something.

## Document roles

| Document | Answers | Does not answer |
|---|---|---|
| `DESIGN_BIBLE.md` | What game are we making, and why? | Exact module APIs or current code behavior |
| `EARTH_MOON_VERTICAL_SLICE.md` | What must the first complete experience do? | Galaxy-scale implementation details |
| `TECHNICAL_ARCHITECTURE.md` | How should the simulation be structured? | Final library choice without an architecture decision |
| `SCIENTIFIC_STANDARD.md` | What counts as honest, sourced, or fictional? | Art direction unrelated to scientific truth |
| `VISUAL_PERCEPTION.md` | What does space look like to a human eye? | Renderer implementation and asset pipeline |
| `HUD_AND_COCKPIT.md` | What does the player see, and where does information sit? | Simulation behavior behind the readouts |
| `CONTROLS.md` | How does the player fly, and how should it feel? | The physics being controlled |
| `DATA_SOURCES.md` | Where does every dataset come from, and may we use it? | How the data is rendered or simulated |
| `STATE_OF_PLAY.md` | What does the game do today, and what is missing? | The design itself — it reports, it does not decide |
| `IMPLEMENTATION_AUDIT.md` | What happens to each current file/system? | Permission to start a broad rewrite |
| Parent `README.md` | What runs today and how? | The final product vision |

## Requirement language

- **MUST / MUST NOT** — required by an adopted design decision.
- **SHOULD / SHOULD NOT** — preferred; deviation needs a written reason.
- **MAY** — allowed but not required.
- **OPEN** — Ric has not chosen the answer. Prototype work may explore options, but
  no option becomes permanent canon without a recorded decision.

## Current project phase

**Phase 1 — Earth–Moon vertical slice, Slices A and B delivered (2026-07-26)**

Phase 0 is complete and implementation has begun. [`slice.html`](../slice.html) now
carries both delivered slices, running beside the legacy prototype rather than
replacing it, per the migration rule in
[Technical Architecture §24](TECHNICAL_ARCHITECTURE.md).

**Slice A — the correct still universe**: real-scale Earth, Moon and Sun at the real
current date, a hierarchical frame graph with velocity-correct transforms, a floating
render origin, target inspection with provenance, and both honesty surfaces.

**Slice B — station-local flight**: a ship with six-degree-of-freedom thrust falling
through real gravity (Earth point mass, J₂, and lunisolar third bodies, integrated by
RK4); assisted and direct flight modes with a precision modifier; the station-relative
LVLH frame; match velocity, hold position and safe stop, each naming the frame it acts
in; proximity zones, closing-rate limits and collision warnings; and one action-based
input layer feeding desktop pointer, keyboard and two-thumb touch alike. The station is
a recognisable ISS built in-house at its real 109 m span.

Delivered against §17 of the slice spec:

- [x] **Slice A** — authoritative time, Earth/Moon/Sun state, frames, floating origin,
      real scale and lighting, target inspection, source metadata
- [x] **Slice B** — ship state and gravity, assisted and precision flight, the
      station-relative frame, match velocity, hold position and safe stop, collision
      and warnings, desktop and touch input
- [ ] **Slice C** — cislunar journey
- [ ] **Slice D** — lunar descent and landing
- [ ] **Slice E** — product pass

**Amended 2026-07-28 — the sky, the feel, and the reach.** A pass driven entirely by Ric
flying it, which changed four things worth knowing about before reading further:

- **The eye works.** Off-frame glare followed an inverse square in angle far past the
  range that relation is fitted for, which pinned adaptation at daylight almost everywhere
  in the Earth–Moon volume and left the sky empty. Corrected, and adaptation is now
  near-instant by decision rather than by simulation ([Visual Perception §2.1](VISUAL_PERCEPTION.md)).
- **The stars have a hierarchy again.** Eight magnitudes were collapsing to one and a half
  through the tone curve. Now compressed deliberately and declared (`SF-L-021`).
- **The throttle is a speed the ship holds**, not a stick position, and releasing a
  rotation key stops the rotation in direct mode too ([Controls §2.3–2.4](CONTROLS.md)).
- **The planets exist and the stars are places.** See `OPEN-019` below. The sky was
  missing the four brightest things a human eye ever sees in it.

Two things Slice A deliberately did **not** settle, because both are open decisions in
[Data Sources §5](DATA_SOURCES.md) and code must not answer those by picking one:

- the station is a **representative** low orbit, not a cached ISS element set
  (ledger `SF-L-008`) — blocked on decision 5, TLE redistribution;
- ~~the sky has 109 catalogued stars~~ — **resolved 2026-07-26**: the Yale Bright Star
  Catalogue now supplies the sky, 9 096 stars complete to about magnitude 6.5. The
  decision record is in [Data Sources §5](DATA_SOURCES.md). Share-alike licensing
  (decision 5) is still open and was deliberately not settled by this.

The architecture spike that [Technical Architecture §22.1](TECHNICAL_ARCHITECTURE.md)
requires before the Three.js decision is final is **partly** discharged: real-scale
Earth and Moon, floating-origin camera motion, a credible atmosphere limb and reliable
target picking all work. The **measured mobile load has not been done**, so the
decision remains conditional.

No galaxy-scale expansion should happen before the slice proves:

- real scale;
- stable hierarchical coordinates;
- satisfying precision flight;
- safe, interruptible autopilot;
- desktop and mobile controls;
- a readable map and target workflow;
- atmosphere-to-space transition;
- lunar orbit, descent, and landing;
- scientific provenance and honesty labels;
- acceptable browser performance.

## Settled foundations

The following are not open to casual reinterpretation:

- The universe retains real scale and stable geography.
- Everything you can see, you can go to. There is no skybox — every point of light is a
  real destination with a name, and worlds where real statistics say worlds should be.
- If a human could see it in space, it belongs in the game — depicted only to the limit
  of what we actually know about it.
- Generate abundantly where knowledge stops; label rigorously. An empty universe where
  nobody has looked yet would be less accurate than a generated one.
- The entire game is between the map and the universe; the map is a primary surface.
- The ship provides the capability needed to cross that scale.
- The player may fly manually with high precision.
- Autopilot is optional, capable, safe, and instantly interruptible.
- Fuel and routine life-support management are not gameplay.
- Extraordinary shielding handles routine radiation exposure.
- Extreme environments and collisions remain meaningful dangers.
- Risk is chosen, not ambient: normal travel is safe, deliberate hazards have real
  consequences, and danger is legible before it is fatal.
- Atmospheric drag and re-entry heating do not act on the ship (declared fiction).
- There are no checkpoints; death ends the run, and its cost is a selectable mode.
- Traveler time equals real play time and never scales; home time may diverge.
- The project is free and open source.
- Information deepens through exploration.
- The sky aims for believable human perception: space is not black, it blazes with
  stars, and the eye's adaptation is modeled rather than a fixed brightness chosen.
- Controls are a design law, not a late usability detail: the mouse aims, the keyboard
  moves, and nothing routine needs a chord.
- Scientific compromise and fictional technology are labeled honestly.
- Two honesty surfaces ship together: **Sources** ("what is real, and who measured it")
  and the **honesty ledger** ("what is not real, and why"). Credits are content, not a
  legal footer.
- The game runs in modern desktop and mobile browsers.
- Rendering quality may scale; scientific rules and destinations may not.

## Open decisions registry

These decisions are intentionally not buried inside implementation documents:

| ID | Decision | Needed by | Status |
|---|---|---|---|
| `OPEN-001` | Exact fictional FTL model and treatment of elapsed time | Interstellar/galactic phase | **Partly resolved 2026-07-26** — FTL is a **player-selected flight mode (4 · Interstellar)**, not a separate travel screen, and it is to be built into the new architecture rather than left in the prototype (Ric, 2026-07-26). The drive's internal model and its treatment of elapsed external time remain open. |
| `OPEN-016` | Speed control: continuous throttle versus selectable modes | Earth–Moon slice | **Resolved 2026-07-26** — five modes named for *where you are flying* (Local / Orbital / System / Interstellar / Intergalactic), each carrying its own speed range and control authority, with the throttle flying inside the selected mode, and a proximity governor that holds you to a speed you could stop from. Full stop is instant in modes 2+ and honest in mode 1 (ledger SF-L-019). Supersedes the provisional 2026-07-25 continuous-throttle model, which failed the feel test it was adopted pending. ([Controls](CONTROLS.md) §2.4) |
| `OPEN-017` | When the legacy prototype at `fly.html` is retired | After slice parity | **Direction set 2026-07-26** — there is to be exactly one game. The prototype is retired once the new app reaches parity, per [Implementation Audit](IMPLEMENTATION_AUDIT.md) §9.10; what "parity" must include is **now listed** — [State of Play](STATE_OF_PLAY.md) §4, eight capabilities (P1–P8). The prototype is retired when that table is empty. |
| `OPEN-002` | Meaningful consequence of ship destruction | Persistent damage phase | **Resolved 2026-07-25** — no checkpoints ever; death ends the run. Cost is a selectable mode: Hardcore / Standard / Expedition (default). |
| `OPEN-003` | Non-crafting repair behavior | Persistent damage phase | **Resolved 2026-07-25** — persistent hull damage from chosen physical hazards, repaired only at a habitable planet; routine radiation never damages the ship; fuel is never a concern. |
| `OPEN-004` | Guided expedition structure versus purely free exploration | Discovery-log design | Open |
| `OPEN-005` | Live ISS data versus cached/representative station by default | Earth–Moon slice | **Resolved 2026-07-25** — cached elements by default (offline-safe, kept current); optional live refresh; recognizable resemblance, as close as realistic. |
| `OPEN-006` | Pausing, time acceleration, and selectable historical epochs | Time-system design | **Mostly resolved 2026-07-25** — menus pause; two-clock rule adopted (traveler time never scales). Selectable historical epochs still open. |
| `OPEN-007` | Amount of visible procedural completion for unknown exoplanets | Nearby-star phase | **Resolved 2026-07-25** — generate abundantly, label rigorously. Every star gets a name; planets follow real occurrence rates (so some stars have none), deterministic and labelled as generated. Measured exoplanets are never overwritten. (Bible §7.4) |
| `OPEN-008` | Fully modeled cockpit versus minimal instrument view | Earth–Moon visual design | **Resolved 2026-07-25, built 2026-07-26** — three presets over a shared holographic on-glass layer with direct object selection. Renamed to **Clean / Luxury / Console** when Ric settled that his two reference images are *both* presets the player chooses between, rather than one house style ([HUD and Cockpit](HUD_AND_COCKPIT.md) §2.0). |
| `OPEN-009` | Multiplayer, shared routes, or shared observations | Post-core exploration | Open |
| `OPEN-010` | Permanent engine, renderer, and build toolchain | Architecture prototype | **Resolved 2026-07-25** — Three.js on WebGL 2, HUD/overlays as a DOM layer; WebGPU path preserved. **Conditional on the architecture spike** (Tech Arch §22.1). |
| `OPEN-011` | Permanent public name | Before broad public release | Open |
| `OPEN-015` | Which catalogue supplies the naked-eye sky | Earth–Moon slice | **Resolved 2026-07-26** — Yale Bright Star Catalogue (9 096 stars to mag ~6.5), chosen partly because it does not force the share-alike question. Depth beyond naked-eye stays open. |
| `OPEN-012` | Open-source licence for the repository itself | Before public release | **Resolved 2026-07-25** — MIT. |
| `OPEN-013` | Default cockpit preset | Earth–Moon slice | **Resolved 2026-07-25** — the octagonal canopy with no console, now named **Luxury**. Full spec in [HUD and Cockpit](HUD_AND_COCKPIT.md). |
| `OPEN-018` | How much of the map is built, and how it projects | Earth–Moon slice | **Direction set 2026-07-26** — the map is a full second surface on **Tab**, laid out from Ric's reference image, wired to the live ephemeris and the star catalogue at three linear scales. The projection is linear and zooms rather than log-compressed, and the accessible surface is the rail, not the canvas ([Design Bible §13.2](DESIGN_BIBLE.md)). Updated 2026-07-28: selecting a star or a planet on the map now yields a real destination with a route preview. Search, saved destinations and 3D orientation remain unbuilt. |
| `OPEN-019` | How far outside the Earth–Moon volume the slice's destinations reach | Reached it 2026-07-28 | **Direction set 2026-07-28** — Ric: the other planets and the stars *"need to be a destination you can go to."* The eight planets are placed and selectable; stars with a measured parallax are selectable and routable. This is the Bible's "everything you can see, you can go to" arriving earlier than the roadmap expected, and it is deliberately **destinations without arrivals**: routes are planned and previewed honestly, nothing yet flies one to completion, and the approximations that only matter on arrival (`SF-L-022`, `SF-L-023`) are recorded with that as their review condition. What remains open is whether the Earth–Moon slice should *complete* before interstellar flight is built, or whether reaching a star becomes part of it. |
| `OPEN-014` | Default lunar landing region | Earth–Moon slice (Slice D) | **Dissolved 2026-07-25** — the question no longer applies: the player lands anywhere. Measured global topography + generated local detail; landing is a low hover. |

An open decision should receive a short decision record when resolved: date,
options considered, chosen answer, reason, and documents affected. Resolved-decision
prose lives in the responsible spec; the [Design Bible change record](DESIGN_BIBLE.md)
holds the append-only log.

**Parked future idea (not an OPEN decision):** a fictional region *outside our
observable universe* (e.g. a *Star Wars*–style galaxy far away), reached only via the
fictional FTL drive and always labeled fictional — see Design Bible §8.5. Out of scope
for the Earth–Moon slice.

## Change discipline

When Ric changes the design:

1. Update the relevant focused document.
2. Update the Design Bible if a foundational rule changed.
3. Update the open-decision registry above.
4. Append an entry to the Design Bible's change record.
5. Update the prototype README only when current behavior changes.

Do not erase old reasoning. Mark it superseded so future contributors can understand
why the project changed.

## Instructions for implementation work

Before touching game code:

1. Name the vertical-slice requirement being implemented.
2. Read the corresponding architecture and scientific sections.
3. Consult the file-by-file audit.
4. Identify any open decision that the work could accidentally settle.
5. Define desktop, mobile, performance, and honesty checks.
6. Prefer a reversible, narrow migration over a repository-wide rewrite.

The repository-level `AGENTS.md` also applies. In particular, Starfield must retain a
visible route back to Ric's Terminal, remain safe to host publicly, and must not be
pushed or published unless Ric explicitly asks.
