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
5. [Implementation Audit](IMPLEMENTATION_AUDIT.md) — a file-by-file map of the
   current prototype: preserve, refactor, replace, or retire.
6. [Prototype README](../README.md) — what the existing prototype does and how to
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
| `IMPLEMENTATION_AUDIT.md` | What happens to each current file/system? | Permission to start a broad rewrite |
| Parent `README.md` | What runs today and how? | The final product vision |

## Requirement language

- **MUST / MUST NOT** — required by an adopted design decision.
- **SHOULD / SHOULD NOT** — preferred; deviation needs a written reason.
- **MAY** — allowed but not required.
- **OPEN** — Ric has not chosen the answer. Prototype work may explore options, but
  no option becomes permanent canon without a recorded decision.

## Current project phase

**Phase 0 — Documentation and decisions**

The next implementation target is the Earth–Moon vertical slice. No galaxy-scale
expansion should happen before that slice proves:

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
- The sky aims for believable human perception.
- Scientific compromise and fictional technology are labeled honestly.
- The game runs in modern desktop and mobile browsers.
- Rendering quality may scale; scientific rules and destinations may not.

## Open decisions registry

These decisions are intentionally not buried inside implementation documents:

| ID | Decision | Needed by | Status |
|---|---|---|---|
| `OPEN-001` | Exact fictional FTL model and treatment of elapsed time | Interstellar/galactic phase | Open |
| `OPEN-002` | Meaningful consequence of ship destruction | Persistent damage phase | **Resolved 2026-07-25** — no checkpoints ever; death ends the run. Cost is a selectable mode: Hardcore / Standard / Expedition (default). |
| `OPEN-003` | Non-crafting repair behavior | Persistent damage phase | **Resolved 2026-07-25** — persistent hull damage from chosen physical hazards, repaired only at a habitable planet; routine radiation never damages the ship; fuel is never a concern. |
| `OPEN-004` | Guided expedition structure versus purely free exploration | Discovery-log design | Open |
| `OPEN-005` | Live ISS data versus cached/representative station by default | Earth–Moon slice | **Resolved 2026-07-25** — cached elements by default (offline-safe, kept current); optional live refresh; recognizable resemblance, as close as realistic. |
| `OPEN-006` | Pausing, time acceleration, and selectable historical epochs | Time-system design | **Mostly resolved 2026-07-25** — menus pause; two-clock rule adopted (traveler time never scales). Selectable historical epochs still open. |
| `OPEN-007` | Amount of visible procedural completion for unknown exoplanets | Nearby-star phase | Open |
| `OPEN-008` | Fully modeled cockpit versus minimal instrument view | Earth–Moon visual design | **Resolved 2026-07-25** — three presets (Clean / Frame / Cockpit) over a shared holographic on-glass layer with direct object selection. Default preset still to pick. |
| `OPEN-009` | Multiplayer, shared routes, or shared observations | Post-core exploration | Open |
| `OPEN-010` | Permanent engine, renderer, and build toolchain | Architecture prototype | **Resolved 2026-07-25** — Three.js on WebGL 2, HUD/overlays as a DOM layer; WebGPU path preserved. **Conditional on the architecture spike** (Tech Arch §22.1). |
| `OPEN-011` | Permanent public name | Before broad public release | Open |
| `OPEN-012` | Open-source licence for the repository itself | Before public release | **Resolved 2026-07-25** — MIT. |
| `OPEN-013` | Default cockpit preset | Earth–Moon slice | Open — Ric wants to discuss the HUD further |
| `OPEN-014` | Default lunar landing region | Earth–Moon slice (Slice D) | Open — Ric wants to discuss; needs a sourced elevation dataset |

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
