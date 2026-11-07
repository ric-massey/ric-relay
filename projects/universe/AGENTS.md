# Rules for AI assistants working on Universe

Read this and [`README.md`](README.md) before touching anything in `projects/universe/`. The README
is the spec and the work list; [`THE-LAWS.md`](THE-LAWS.md) states and justifies each law;
[`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md) is the record of how each decision was made, including the
full argument behind every numbered item; [`TWO-RUNS.md`](TWO-RUNS.md) is why the project runs
twice. This file is how to work here without wrecking the concept.

Relay's root `AGENTS.md` still applies in full: no build step, no dependencies, docs updated in the
same commit as the code, and a push to `main` is a publish.

---

## 1. Credit everything

Ric's rule, 2026-11-03: **this is built on other people's work, so give them credit.**

Every borrowed idea, algorithm, result or technique goes in `SOURCES.md` — author, year, title,
link, and one line on what we took. **Add the entry before you use the technique.** If you can't
find who originated an idea, say so in the entry rather than leaving it uncredited.

## 2. Never store what should emerge

No stored melting point, phase, density, `is_alive`, `species`, `organism`, `fitness`, cluster id
or temperature field. These are **computed for display or observed in output, never held as
state.** The README's *What is never written* has the list.

If you find yourself adding one, you have taken a wrong turn: the thing you want is a consequence of
the laws, and if it isn't, that is a finding to write down rather than a gap to patch.

## 3. No borrowed names

Nothing is named after anything in our universe — no `water`, `carbon`, `cell` (biological),
`membrane`, `atom`, `molecule`. Primitives are **numbered**; clusters are identified by what they're
made of. Every Earth-shaped name is a hint smuggled into the world, and it biases what we notice.

Use `cell` only in the lattice sense, and prefer `site` or `hexagon` where there is any doubt.

## 4. No enumerated tables

No list of materials, no list of reactions, no lookup table of what combines with what. An
enumerated feature set is what capped Avida.

**A table the Lab measures is still never an input.** It is the dictionary you *read* the World
with. If the World ever instantiates species from a list, that reintroduces the ceiling by a side
door.

**Watch law 2's form for the same disease.** A function of two kinds could hold a periodic table as
special cases. So the form must come from a small fixed grammar of integer operations — sum,
difference, parity, gcd, divisibility, remainder — and **never a table of cases**. The test is
description length: *the law must be shorter than the table it produces.* Short is not weak: Rule
110 is a few bits and Turing-complete.

Law 2 is currently `B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`, `v(k) = k mod 8`, with no distance term.
Any replacement goes through `screen.mjs` first (rule 12).

## 5. Integers for anything conserved

Matter, energy and momentum are **integers**, never floats. Floats leak — over a billion steps
rounding bleeds mass with no error — and continuous amounts make every site unique, which blinds the
variance layer.

- **Matter** is the **sum of kinds**, not the count of primitives. Counting primitives would forbid
  fusion.
- **Momentum** is an integer vector in cube coordinates: two signed components at **±63** (since
  2026-11-06; ±15 before, ±3 before that). Not FHP's six occupancy channels — those are for a gas of
  identical particles.
- **Momentum is never stored as a direction, and a primitive goes where it points.** Since
  2026-11-06 (item 34) each primitive keeps its true position inside its hexagon and steps into the
  hexagon its straight path enters next; `SETTLED.STEPPING` is `"track"`. Don't go back to rounding
  to the nearest of six directions: it gave matter six headings and random-walked tied paths. If you
  touch stepping, `lab-check.mjs` Check 13 must still show every heading travelling true. Any tie
  that does arise is a coin, never a fixed pick — a fixed pick was a handedness that spiralled every
  orbit inward (item 21). **The position is new state, and so is fine momentum** (units of 2⁻³²),
  adopted for the World and built with gravity; both are Ric's call, written down in item 34.
- **Speed is a rate, not a distance, and matter never reaches the limit:** `matterSpeed(Q, k)` in
  `lab.mjs` is relativity's `|p| / √(k² + |p|²)` of the causal limit (Ric, 2026-11-06: "I don't want
  anything of matter to reach that speed"). Only radiation travels at the limit; `lab-check.mjs`
  Check 12 holds every kind at every momentum below it. Don't go back to `min(1, |p|/k)`, which let
  the lightest kinds hit it. "Move `p/k` hexagons" would break the causal limit and freeze heavy kinds.
- **Collisions** resolve in three-hexagon Margolus blocks, conserve momentum by construction, and
  draw their outcome at random from the legal ones.
- **Kinetic energy** is `floor(S · Q(p) / 2k)`, **derived from `(p, k)`, never stored**; the conserved
  total is heat + Σ KE. `S = 4`, inside the window 1–16 at ±63 — forced down from 64 when momentum
  widened. Because KE is a pure function of mass and momentum, no free-energy pump exists.

**A width is physics, not implementation.** At four bytes the 11-bit energy field silently capped
law 2's binding energy at 8 and made heavy matter permanently inert, and nobody wrote that down for
a day. Changing a width is a physics decision — and so is *keeping* one that constrains the physics.
The dangerous case is a width that silently picks a constant, because it looks like a derivation.

**Widths are conservation holes too.** Kind stops at 255, energy at 65535. **Any operation that
would exceed a field fails loudly** — never clamp, saturate or widen quietly. A world that keeps
hitting a ceiling is telling you the constants are wrong.

**The word is eight bytes: kind 8, bonds 6, energy 16, momentum 14 — 44 of 64 bits.** The **20
spare bits are reserved**: nothing goes in them without an entry in `THE-LAWS.md` and a reason, and
never anything on the never-store list. **Two pieces of state live beside the word** (item 34,
2026-11-06): each primitive's position inside its hexagon (Lab: `w.ox`, `w.oy`), and, in the World
only, fine momentum in units of 2⁻³² in a second array, which is where gravity's sub-unit pull is
held (item 19). **`constants.mjs` is what the engine runs on; if a document disagrees with it,
the document is the bug.** This rule has drifted from the code twice already.

## 6. Assert conservation on every run

Matter, energy and momentum totals are checked every run. **A drift of 1 is a bug, not rounding.**
Fail loudly, print the step it first went wrong, and never add a tolerance.

**Count everything that is not on the lattice, or the assertion is worthless.**

- Energy: `world energy + in flight + radiated-away − thermostat net = constant`. Energy in flight is
  counted by walking the direction bits of every empty hexagon; leaving it out looks exactly like a
  leak. `radiate.mjs` is a worked reference.
- **A standing bond holds −`B`**, so the Lab's total also subtracts Σ B over standing bonds. Leave
  it out and every bond that forms looks like heat from nowhere.
- **Equalizing momentum along a bond destroys kinetic energy** (momentum is linear, KE quadratic);
  the loss goes into heat exactly as a collision's does.
- Momentum at a wall or floor: keep **wall momentum** as an integer vector and assert
  `world momentum + wall momentum = constant`.

**In the Lab two of these are zero by construction — assert that too.** The Lab is a torus with no
edge, so `world momentum` is exactly constant and `radiated-away` is 0 every step. **The seam is
where a looped world breaks quietly:** every neighbour lookup must wrap. Test the seam on its own —
a collision block, a bond and a radiation line that each straddle it — before trusting a run
(`lab-check.mjs` Checks 1–5).

**Watch the gravity solver.** A pyramid approximation does not give equal and opposite pair forces,
so it leaks momentum and fakes a preferred direction. Compute each interaction once and apply it to
both sides.

**The World gets a weaker invariant.** Gravitational potential is not stored, so collapse genuinely
appears to create heat. Assert the monotonic form: energy rises only through collapse, falls only
through the boundary, both logged.

**Why this is strict: an accounting hole disguises itself as a discovery.** A structure exploiting a
leak looks exactly like emergent propulsion or metabolism, and it will be the most exciting thing
you have seen. Every accounting bug this project has had was of that kind. Watch for **spurious**
conservation too: naive local rules can conserve things you never intended (FHP needed a special
three-body collision to avoid it). Check that we conserve exactly what we think and nothing else.

## 7. Five laws; adding one needs a written reason

Five laws and five structural facts. Every law is a place an answer could be smuggled in, so fewer
laws means more of the behaviour belongs to the world.

To add one, write an entry in `THE-LAWS.md` saying what it buys and **why it could not have emerged
instead**. Read *Rules that came off the list* in `HOW-WE-DECIDED.md` first — the list went from
eleven rules to nine in one pass. **Prefer removing.**

**A law acts; a structural fact is true of how the world is built.** Radiation crossing vacuum went
in as the fifth structural fact rather than a sixth law (2026-11-04); the argument against that is
recorded beside it. Don't use the distinction to dodge this rule — write the new thing down in full
either way.

New machinery costs a constant, and the cost is stated out loud: the thermal kick (item 29) brought
`THERMAL_KICK_PROB`.

## 8. Every physics constant in one place

The constants are the search space. They live in `constants.mjs`, named, with units and ranges.
**No magic numbers inline, anywhere.** Searched constants are `null` until a caller supplies them,
and the engine refuses to run without them.

**Three filters, checked before a run.** The engine asserts the clock and refuses to run if it fails;
the gravity pair applies to the World, which is not built yet.

- **The clock never clips:** with `rate(T) = floor + c · T`, `floor + c · T_max ≤ 1`. The rate is a
  probability; where it saturates, radiation's direction becomes a coin flip and the second law
  switches off in the hottest part of the world. Only monotonicity matters, so any floor is sound —
  a floor at `c · T_max / 16` gives a 16:1 spread between hottest and coldest. *(An earlier form,
  "scale × hottest temperature < 1", forced a 2047:1 spread and would refuse a correct
  configuration. Don't assert it.)*
- **Gravity's ceiling:** between adjacent primitives it is orders of magnitude below the weakest
  bond, or gravity contaminates chemistry.
- **Gravity's floor:** collapse of the clumps the World can form must heat matter past the weakest
  bond. State strength as **ε**, the energy two kind-255 primitives release falling into contact,
  over the weakest bond. **At 4096² the floor is above the ceiling**, so no strength passes both.
  Don't loosen either check to get a run going; that is Ric's call (item 20).

## 9. Locality is absolute

Nothing reads past a site's immediate neighbours. **The gravity pyramid is the only exception, and
the honest target is zero** — gravity is local in reality, and law 3 has a local candidate
(`∇²φ − m²φ = ρ`, item 12) that would remove it.

If you need a second exception, **raise it rather than adding it.** That process worked on
2026-11-06: a cluster walk went into `lab.mjs` reading up to 29 sites away, was raised as item 32,
and came out when Ric asked how reality resolves it — there are no rigid bodies, and nothing
computes a body's total mass. `|p| / K` is law 1 describing an outcome, not a recipe.

**Instruments are not bound by this rule.** `wave.mjs` and the viewer may read the whole world, the
way a microscope sees more than a molecule does. Rule 9 binds the laws.

## 10. Write down what didn't work

A run that died, plateaued, produced nothing, or produced a grid artifact gets recorded with the
constants that produced it. A mechanism that comes out of the engine goes in `rejected/` with the
numbers that removed it. This is a search, and in a search negative results are most of the output.

## 11. Don't trust a pretty picture

Structure is not evidence of emergence until it survives the obvious checks:

- **Aligned with the lattice axes?** Probably a grid artifact.
- **Periodic with the update scheme?** Probably a clock artifact. Check it survives the Lab's
  event-driven time, which has no tick to be periodic with.
- **Survives a change of seed?** If one seed makes it, it isn't the physics.
- **Survives a small change of constants?** Real structure holds over a region.
- **Balances the books** over exactly the region it occupies, every edge counter included? If it
  sits against a wall, suspect the wall first.
- **Just a crystal?** The variance layer lights up for crystals and clumping too. It says where to
  look, never what something is.

Then name the rung of the README's acceptance ladder it reaches. **A count from one run is not a
finding**, and **a number quoted across a change of conditions is not a comparison**: say which
width, which reading and which harness a number came from in the sentence that quotes it. That
mistake was made three times on 2026-11-06.

Apply all of this before telling Ric something interesting happened.

## 12. Screen before you simulate

Screening is cheap and a run is not, so a candidate form goes through `screen.mjs` before it goes
through the Lab. The five screening tools — `screen.mjs`, `budget.mjs`, `momentum.mjs`,
`radiate.mjs`, `orbit.mjs` — are not part of the engine. There are two engines: the Lab is
`lab.mjs`, `constants.mjs` and `lab-check.mjs` (`node lab-check.mjs`, thirteen checks, ~30 s; also
in the repo's slow lane and in `simulations.yml`), and the World is `world.mjs`, `constants.mjs` and
`world-check.mjs` (`node world-check.mjs`, eleven checks, ~20 s). **A law settled in one engine is
not in the other until someone carries it across.** The World ran law 1's retired reading for a day
because nobody did — README item 37, and the reason `world-check.mjs` Check 9 exists. `world-run.mjs`
runs the World and reads the three eras off it; its gravity strength is a dial typed on the command
line, so nothing it prints is a result, and it writes every run to `runs/`. `wave.mjs`, `snapshot.mjs`, `census.mjs` and `collide.mjs` run the engine
without being it: `wave.mjs` compares the engine with and without the momentum wave, and injects
the removed cluster drag from `rejected/` to price it; `snapshot.mjs` freezes a run for the viewer;
`census.mjs` (`node census.mjs`, ~15 s) names every standing cluster by its valence multiset and
measures lifetimes and encounters over a free run; `collide.mjs` (`node collide.mjs`, ~100 s) aims
two chosen clusters at each other in an empty world, which is README item 5's "measured by running
collisions". Both import the one cluster walk in `clusters.mjs` and cross-check it against
`census(w).bondBits` every sample. They are instruments, so rule 9 does not bind them.

- **`screen.mjs`** scores a law-2 form over all 65,025 pairs of kinds: binding-energy spread, family
  structure, near-inert count, bonding-degree spread, roughness under a change of kind, and whether
  kinds bond best with themselves. **Add a candidate to its table before you run a universe with it.**
  It can show a form cannot work, never that one does.
- **`radiate.mjs`** checks radiation and the clock: sight-line reciprocity, net flow, a flat-clock
  control, exact accounting, opacity.
- **`budget.mjs`** enumerates field allocations. Its four-byte tables are history; its eight-byte
  section is the current word.
- **`momentum.mjs`** settled the momentum representation and the KE scale. **Two of its checks are
  labelled wrong in the file** — read the note above check 5 before quoting it.
- **`orbit.mjs`** settled that things orbit and measures gravity's strength and remainder; Checks 13
  and 14 measure how a step is chosen and the two additions of item 34. It flies ten laps and reports
  the closest approach on the first and last — equal is an ellipse, falling is a spiral. It has had
  four harness bugs; read its comments before quoting a number. About a minute to run.

**What the tools cannot see.** The Lab found eight things they could not (items 23–30), three of them
about time, which an enumeration does not have. A screen cannot find a hole in the *dynamics*; the
Lab's assertion can, and caught two seams by failing (18,541 and 34,864 units).

**Lessons worth more than the tools:**

1. **Run the control.** Radiation transporting nothing under a flat clock was the real finding, and
   it existed only because the boring case was run.
2. **An analytic check and a dynamic run fail differently.** And **if a run reports zero of the
   thing you are measuring, the run is wrong, not the physics.**
3. **Check that a legal outcome still exists**, not only that illegal ones are excluded. Counting
   found 14.9 per collision; a satisfiable constraint can be satisfiable almost nowhere.
4. **Check what a measurement assumed before believing it.** A rigged test once "proved" kinetic
   energy impossible, and only Ric saying the conclusion couldn't be right caught it.
5. **A tool that solves for a constant has chosen one.** Print any derived constant in its real unit
   next to the limit it must obey — `orbit.mjs` once used gravity thousands of times too strong.
6. **Count the thing a claim is about.** "Refusing the step freezes clusters solid" stood for two
   days because nothing counted bonded steps; there were 14,500 per million events.
7. **On a torus, a distance is a path, not a difference.** `wave.mjs` reported a bonded pair moving
   "115 hexagons" by subtracting its start from its end — and it had lapped the 258-wide Lab four
   times, so the figure was a lap position. It took the momentum wave's rejection with it, and the
   wave is back in the engine.
   Sample often enough that nothing moves half the world between samples, and sum the unwrapped
   steps.

---

## Working notes

- **Browser-native.** No build step, so it runs off the live site. WebGL2 in a fragment shader is
  fine (no dependency). Design for a few million sites at interactive rates.
- **The phone views; the PC computes** (Ric, 2026-11-04). The phone was silently acting as a memory
  budget and keeping the word at four bytes, which was choosing physics. Don't reintroduce a mobile
  compute constraint without saying so. At 4096², double-buffered, the World is about 268 MB.
- **The Lab before the World.** Don't start the World until the Lab has produced a periodic table
  with some depth.
- **The two time schemes are a test.** Run the same small configuration in both and compare species,
  binding energies and rates. That is how the World's approximation gets validated.
- **The viewer is instrumentation, not decoration.** It reads frozen runs: `node snapshot.mjs` writes
  `runs/current.*` and rotates the previous one to `runs/last.*`. The `.bin` is the raw arrays and
  nothing derived (rule 2). The header carries the seed, the settings, a hash of the engine (the page
  says when a run is older than the engine) and a `space` block whose wrapping is measured. **The
  page still reads the older `torus` flag, not `space`** — the open half of that work. Regenerate both
  runs whenever the engine changes.
- **Fail fast and cheap.** The Lab is small so a dead law shows up in minutes. Resist making it
  bigger.
