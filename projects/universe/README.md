# Universe

A physics, not a simulation.

A simulation models something that already exists. This doesn't. What lives here is a **rule
set** — five laws — and the world is whatever those laws do when you run them. Nobody knows in
advance what that is, including the person who wrote them. The only way to find out is to run it.

The goal is a world deep enough that something intelligent *could* emerge from it — not a promise
that it will, and not a prediction about when.

**Why bother.** Several earlier artificial-life systems have ceilings traceable to specific design
choices: Avida's complexity saturates at a value set by its fixed feature set; Tierra's
interpretation machinery is hard-coded and cannot evolve; the BFF soup cycles through replicator
takeovers without accumulating anything. This project tries to avoid those particular choices.
That is a reason to run the experiment, not a claim that nobody else's substrate could work
(`SOURCES.md` has the citations).

**Where it stands (2026-11-06).** The laws are written and the Lab — the first engine — runs four
of them on a small looped lattice and conserves exactly. It has not yet produced a periodic table.
The World, the large run with gravity, is not built. Everything open is in
[Open questions](#open-questions), which is the work list.

## Contents

[Files](#files) · [What exists](#what-exists) · [The five laws](#the-five-laws) ·
[The five structural facts](#the-five-structural-facts) ·
[What is never written](#what-is-never-written) · [The two runs](#the-two-runs) ·
[The search space](#the-search-space) · [Measurement](#measurement) ·
[**Open questions**](#open-questions) · [Roads not taken](#roads-not-taken)

## Files

| File | What it is |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Rules for anyone — human or AI — working here. Read it first. |
| [`THE-LAWS.md`](THE-LAWS.md) | Each law and structural fact: what it says, why, and what breaks without it. |
| [`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md) | The record: every correction, retraction and rejected option, and the full argument behind each numbered item below. |
| [`TWO-RUNS.md`](TWO-RUNS.md) | Why the project runs twice, and what one run would be like. |
| [`SOURCES.md`](SOURCES.md) | Credit for everything borrowed — Ric's rule. |
| **The engine** | |
| [`lab.mjs`](lab.mjs) | The Lab: four laws (no gravity) on a 258 × 258 hexagonal torus, event-driven continuous time, every conservation total asserted. |
| [`constants.mjs`](constants.mjs) | Every physics constant, with units and ranges. Refuses to run on an unchosen constant or a clock that clips. |
| [`lab-check.mjs`](lab-check.mjs) | The Lab's pre-flight: the seam, the books through a run, five seeds, five constant changes. |
| **Around the engine** | |
| [`snapshot.mjs`](snapshot.mjs) | Freezes a Lab run into [`runs/`](runs/) for the viewer. |
| [`viewer.html`](viewer.html) | Lattice inspector. Reads a frozen run and lets you open any hexagon. State, not dynamics. |
| [`wave.mjs`](wave.mjs) | Measurement harness over copies of the engine (items 25, 32, 33). |
| [`rejected/`](rejected/) | Mechanisms that came out of the engine, kept with the numbers that removed them. |
| **Screening tools** — answer a question without running a world | |
| [`screen.mjs`](screen.mjs) | Scores candidate forms of law 2 over all 65,025 pairs of kinds. |
| [`budget.mjs`](budget.mjs) | Enumerates what fits in the hexagon's word. |
| [`momentum.mjs`](momentum.mjs) | Settled how momentum is stored and the kinetic-energy scale. |
| [`radiate.mjs`](radiate.mjs) | Settled radiation across vacuum and the clock. |
| [`orbit.mjs`](orbit.mjs) | Settled that things orbit; measures how strong gravity may be, and how motion on the lattice should be stepped (item 34). The only tool that steps in time — two primitives under one law is a measurement, not a world. |

`AGENTS.md` rule 12 says what each tool can and cannot tell you.

### Running it

```sh
node lab-check.mjs                     # the Lab's eleven checks, ~30 s
node snapshot.mjs --seed 21 --hot 6    # freeze a run into runs/ for the viewer
node screen.mjs                        # any screening tool runs the same way
python3 -m http.server 8912 --bind 127.0.0.1   # then open /projects/universe/viewer.html
```

From the repo root, `node .github/checks.mjs --only universe --slow` runs the pre-flight, and
`simulations.yml` runs it in CI whenever this folder changes.

**The viewer** reads `runs/current.*` (the newest) and `runs/last.*` (the one before), or seeds a
lattice of its own. The `.bin` is the five raw world arrays and nothing derived — groups,
temperature and `B` are worked out in the page. The header records the seed, the settings, a hash
of `lab.mjs` and `constants.mjs` (the page re-hashes them and says when a run is older than the
engine) and a `space` block whose wrapping is measured by stepping off each edge. **Not done:** the
page still reads the older `torus` flag rather than `space`, so a run that wraps one axis only
would be drawn as a torus. Every number on it comes from `CANDIDATE_ZERO`, an unscreened test
point, and the page says so.

## What exists

**A hexagon is a primitive, a quantum of radiation in flight, or empty.** One per hexagon, never
more. It holds four things:

| | | bits |
|---|---|---|
| **kind** | how much stuff this primitive is made of — this universe's mass, 1–255 | 8 |
| **momentum** | an integer vector on the hex axes, two components at ±63; speed is `p/k` | 14 |
| **bonds** | which of its six neighbours it is bonded to (in vacuum: a quantum's direction) | 6 |
| **energy** | heat it is carrying, 0–65535 | 16 |

**Eight bytes**, 44 bits used and **20 reserved** — nothing goes in the spare bits without an entry
in `THE-LAWS.md` and a reason (`AGENTS.md` rule 5). A width is physics here: the old four-byte word
made heavy matter permanently inert (item 15), and momentum went from ±15 to ±63 on 2026-11-06
(item 20). `constants.mjs` is the word the engine runs on.

**Hitting a ceiling fails loudly.** Kind stops at 255 and energy at 65535; anything that would
exceed a field is an error, never a wrap or a clamp, because either would break conservation with
no law violated.

There are no materials and no mixtures. Materials are what you go looking for; a mixture is just
neighbouring hexagons of different kinds.

**Shape.** The Lab is a hexagonal torus, 258 × 258, with no edge anywhere (a side divisible by 3,
for the collision blocks). The World's shape is open — item 22.

**Size.** The Lab is 66,564 hexagons, 532 KB. The World's working target is 4096², 16.8 million
hexagons and 134 MB a buffer; item 20 may change it. For scale, the BFF soup used 131,000 programs.

**Why hexagons.** On a square grid a diagonal step is 1.41× a side step, so the world gets
favourite directions — ripples come out square and growth locks to the axes. That is fatal when the
method is "look for structure you didn't expect": you would find your grid. A hexagon's six
neighbours are equidistant, which is why the square lattice gas HPP was abandoned for the triangular
FHP. Six neighbours plus a bond limit also give molecular **shape** — angles, branching, isomers —
with no extra law.

## The five laws

In plain words:

1. Nothing is ever created or destroyed.
2. Bits of stuff next to each other can hold hands, tightly or loosely depending on what they are.
   Heat shakes them loose.
3. All stuff pulls on all other stuff, however far away.
4. A bit of stuff can only hold hands with so many others at once.
5. Heat spreads toward wherever it's colder, and leaves at the edge of the world.

Precisely:

| # | Law | |
|---|-----|---|
| 1 | **Conservation** | Matter (the **sum of kinds**), energy and momentum are integers and are never created or destroyed. Where something crosses an edge it is counted. **Momentum** is an integer vector and **speed is a rate** that never reaches the limit: `|p| / √(k² + |p|²)`, relativity's form (Ric: "I don't want anything of matter to reach that speed") — so heavy matter is slow rather than frozen and only radiation travels at the causal limit. A step rounds the vector to one of six directions; the vector itself is never rounded, and a tie is a coin. **Kinetic energy** is the whole number `floor(S · Q(p) / 2k)` with `S = 4`, recomputed from `(p, k)` rather than stored, so the conserved total is heat + Σ KE. Collisions resolve in three-hexagon blocks, conserve momentum exactly, and draw their outcome at random. A **thermal kick** turns heat into motion in opposite-moving pairs, so momentum still sums to zero. |
| 2 | **Bonding** | Adjacent primitives may bond with binding energy **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, `v(k) = k mod 8` — strongest when the two valences are complementary. A bond forms with probability `BOND_FORM_PROB` when a clock fires, never instantly on contact, which is what makes catalysis possible. It breaks when **`e ≥ B · kind`** at either end — temperature at or above `B`. Motion never breaks a bond: a step that would stretch one does not happen. No distance term and no force — exclusion already repels and gravity already gathers. |
| 3 | **Gravity** | All matter attracts all matter as 1/r², never cancelling, acting on the sum of kinds. The only non-local law. A pull smaller than one unit of momentum is carried, not rounded (item 19). A local screened-field version is the candidate replacement (item 12). Not in the Lab. |
| 4 | **Capacity** | A primitive bonds to at most `capacityOf(k) = clamp(k mod 8, 1, 6)` neighbours — read from the same valence law 2 uses, so kinds have valences (item 6). Its job is saturation: without it attraction collapses everything into one blob. |
| 5 | **Transport** | Energy hops toward a neighbour at a **lower temperature** — compared as `e₁·k₂` vs `e₂·k₁`, exact in integers. Temperature, not energy: comparing raw energy would move heat uphill into heavy cold matter. Across a gap it travels as radiation (the fifth structural fact). At the World's boundary it leaves for good. |

`THE-LAWS.md` justifies each law and says what breaks without it. `HOW-WE-DECIDED.md` has how each
was reached, including fourteen corrections and five retractions.

## The five structural facts

True of how the world is built rather than things that happen — but break one and the world is as
ruined as if a law had been dropped.

- **Hexagonal grid, one primitive per hexagon.** Isotropy, and exclusion for free.
- **Only neighbours interact.** This creates *elsewhere* — independent regions where a rare thing
  can persist — and a causal speed limit of one hexagon per tick. Gravity is the one exception.
- **Each hexagon keeps its own time, at a rate that rises with its temperature:**
  `rate(T) = floor + c · T`, strictly increasing and never clipping. No global "now". Hot matter
  acting more often is what makes radiation carry heat, closes the second law, and gives every
  reaction its temperature dependence. The Lab runs this as event-driven continuous time; the World
  will approximate it with a per-tick probability.
- **Bond energy accounting is exact.** Forming a bond releases exactly `B` as heat; breaking absorbs
  exactly `B`. Off by any amount and the world runs away or dies cold, silently.
- **Radiation crosses vacuum in a straight line.** An empty hexagon holding energy and a direction
  is a quantum in flight: one unit, one hexagon per step, absorbed by the first matter it meets.

## What is never written

None of these appears in the code as state, a formula or a table. Each happens or it doesn't.

**Temperature** (energy per unit of kind, read, never stored) · **pressure** · **phase** — solid,
liquid, gas · **melting, boiling, freezing** · **decay** · **catalysis** (a structure holding two
reactants in contact longer than chance, which is mechanically what an enzyme does) · **mixtures** ·
**radiation**'s spectrum · **a periodic table** (which kinds form stable clusters, which are inert,
which are promiscuous) · **chemistry** · **convection, sedimentation, weather, cores** · **life**, if
it happens.

Several of these began as rules and came off the list when the floor was pushed down to primitives
and one hexagon became one primitive — `HOW-WE-DECIDED.md`, *Rules that came off the list*.

## The two runs

**One engine, one physics, run twice. Nothing is coarse-grained** — both runs simulate primitives.

| | the Lab | the World |
|---|---|---|
| Size | 258 × 258, looped | ~4096² (item 20) |
| Laws | four — no gravity | all five |
| Conditions | set and held, like a laboratory | emergent |
| Time | event-driven, continuous | ticked, with a per-tick probability |
| Question | **what is matter here?** | **what can matter do here?** |

**The Lab** holds a hot band and a cold band and measures. Gravity is out because a measurement
needs controlled conditions — with gravity, pressure and temperature everywhere depend on the whole
shifting mass, and the same experiment run twice gives two answers. Its output is meant to be this
universe's periodic table: the stable clusters, what each is made of, and how each behaves when it
meets another — **measured by running collisions**, not computed. It is small so a dead law shows up
in minutes.

**The World** starts as matter spread out with noise. Gravity pulls it together, the falling makes
heat, and the gradient appears by itself. Early is hot and violent, the middle is where structure
can hold, late is cold and still — an arc nobody scheduled.

**The Lab's table is never an input to the World.** A measured table is still a table, and feeding
one in would cap the World at what the Lab surveyed — the Avida ceiling. The table is the dictionary
you *read* the World with. `TWO-RUNS.md` has the full argument.

## The search space

The laws are fixed. What is searched is seven constants, all in `constants.mjs` and all `null` until
a caller supplies them:

| constant | law | what it sets |
|---|---|---|
| `TRANSPORT_RATE` | 5 | chance a clock fire moves a unit of heat |
| `CLOCK_SCALE`, `CLOCK_FLOOR` | clock | `rate(T) = floor + c · T` |
| `BOND_FORM_PROB` | 2 | chance a clock fire forms a bond (item 28) |
| `THERMAL_KICK_PROB` | 1 | chance a clock fire turns heat into paired motion (item 29) |
| `GRAVITY_EPS`, `GRAVITY_FALLOFF` | 3 | strength and exponent — World only |

Two more carry chosen values in `SETTLED`: the kinetic-energy scale `S = 4` (forced by the momentum
width, window 1–16) and law 2's modulus 8 (item 17). If the Lab's table comes out flat, the
modulus and law 2's form are what to vary next; `screen.mjs` holds the slate of alternative forms.

**Law 2's form is guarded by its length.** Any form must come from a small fixed grammar — sum,
difference, parity, gcd, divisibility, remainder — and never a table of cases, because the form is
otherwise a place to hide a periodic table. A law short enough to write on one line cannot contain
the answer. Short does not mean weak: Rule 110 is a few bits and is Turing-complete.

**Free filters — reject a constant set without running it.**

- **The clock must not clip:** `floor + c · T_max ≤ 1`. Above the clip, hexagons at different
  temperatures act equally often and radiation's direction becomes a coin flip — measured running
  heat uphill in ten seeds of twenty. A floor sets the spread between hottest and coldest clocks;
  1/16 gives 16:1.
- **Gravity's ceiling:** between adjacent primitives it must be orders of magnitude below the
  weakest bond, or which reactions run depends on where you are.
- **Gravity's floor:** collapse must heat matter past the weakest bond, or chemistry never runs.
  **At 4096² the floor is above the ceiling**, so no strength passes both. That is a finding, not a
  bug — item 20.

**Why search instead of design.** You cannot tell from reading a rule set what it will do. So run
thousands of short candidate universes, keep the ones that are neither dead nor noise, and run those
long. Most settings should give a dead universe — frozen or boiling — and a narrow band one where
things happen.

**That makes half of the anthropic argument testable.** *(Ric, 2026-11-05: "Can we test the
Anthropic theory through this? Technically?" — then "Write it in. Just nervous about it.")*
**Fine-tuning** — only a narrow band of constants gives complex structure — can be measured here:
sweep the constants, score each universe on the acceptance ladder, and the shape of the band is the
answer. **Selection** — we are in the band because nobody could exist outside it — cannot: there are
no observers here. Two limits to state with any result: it is evidence about *this* physics, never
ours, and the ladder is our definition of interesting. Dead universes are half the measurement, so
record them (rule 10).

## Measurement

**The variance layer says where to look, and nothing more.** *Not built yet.* The plan is a pyramid
of downsampled levels — which also makes zoom work and gravity affordable — showing the *variance*
of kind at each level, so three bright spots on a uniform field tell you where to zoom. Crystals,
phase boundaries and ordinary clumping light it up too; what something *is* has to come from
behaviour.

**Evolutionary activity statistics** (Bedau) track whether new, persistent, non-neutral structure is
still appearing, or the world has settled.

### The acceptance ladder

Behavioural criteria, in order. Nothing above a rung counts until the rung below holds. *(Adapted
from external review, 2026-11-03.)*

| Stage | What counts as evidence |
|---|---|
| **Consistent mechanics** | Matter, momentum and energy balance exactly, every edge counter included, and no field hits its width |
| **Rich chemistry** | Several persistent structures with *different*, *repeatable* reaction behaviour |
| **Catalysis** | A structure accelerates a reaction and **is regenerated afterward** |
| **Accumulation** | New structures enable reactions that weren't available before |
| **Heredity** | A structure's arrangement is copied, with variation |
| **Robustness** | All of the above recur across seeds and nearby settings |

Heredity depends on a law: copying needs each kind's best partner to be *another* kind, or a pocket
templates sameness, which is crystal growth. Under law 2's form 75% of kinds bond best with
something else. Be ruthless about the first rung — **an accounting hole looks exactly like a
discovery** (`AGENTS.md` rule 6).

## Open questions

The work list. Each item keeps its number, because every other file cites it by number; the full
argument behind each — with the wrong turns — is in `HOW-WE-DECIDED.md`, *The register in full*.

### Open

**5. Does the Lab produce a periodic table with any depth?** The central question, and unanswered.
A handful of stable clusters and nothing else would mean law 2 needs more structure.
*Decided by:* sweeping the search space and measuring the cluster species.

**9. What is the ratchet?** Prior systems lack a reason the world cannot retreat. Candidates:
compound formation (undoing it costs binding energy back) and sedimentation (burial is
irreversible, and gives the world a history).

**10. Can anything climb past rung two?** Prior work reaches replicators from a soup (Hutton 2002;
BFF 2024) but nothing has produced *cumulative* novelty afterwards.

**11. Does something have to stop gravity — a law 6?** Orbits are too few to halt collapse (item
16), so a static World may end as one clump. But at the strength law 3's ceiling allows, collapse may
be too slow to need stopping (item 20). Candidates are under *Roads not taken*. Not before the Lab
works.

**12. Local gravity.** A screened field, `∇²φ − m²φ = ρ`, relaxed by neighbour-averaging, would make
gravity local and leave nothing non-local in the codebase; it decays faster than 1/r², and its
screening length sets how large an independent region is. Costs one extra field per hexagon.
*Decided by:* a Lab comparison — does it cluster matter the way the 1/r² sum does?

**13. Does the World have the range for a hierarchy?** Reality's interest lives in clumps of clumps.
At ε = 0.01, 4096² does not have the range for even one clump that heats anything (item 20).

**14. 2D enclosure is all-or-nothing.** A closed loop fully separates inside from outside, so
compartments cannot be "mostly sealed". A permanent limitation to design around.

**17. What should law 2's modulus be?** 8 works and is now a choice, not a width artifact. Larger
gives finer gradation along the mass axis; smaller gives bigger families. Low urgency.
*Decided by:* a sweep scoring gradation against family size.

**18. The kind distribution is an initial condition.** Nothing changes a primitive's kind (there is
no fusion), so the kinds you seed are the kinds there are, forever. Consistent with the declared
floor — primitives are assumed, not derived — but a choice to make knowingly: seed uniform kinds, or
take the fusion road.

**19. Where does gravity's sub-unit remainder live?** Rounding is out — at a legal strength it
switches gravity off everywhere. Measured: the spare bits are too coarse and a coin per tick heats
matter and kills orbits. **Recommended, not adopted:** a second array, two signed 32-bit components
a hexagon, moving with its primitive and counted in the momentum assertion. Ric's call.

**20. How strong is gravity, how big is the World, what shape is it?** One decision.
*Settled half:* momentum is ±63 (Ric, 2026-11-06), which forced `S` from 64 to 4. *Open:* the
strength, the size and the shape. The floor (collapse must melt the weakest bond) falls as
1/clump radius; at ε = 0.01 a clump that melts anything is ~a billion hexagons. Ric leans toward a
bigger World, and set the direction: **a hierarchy shaped like ours** — as much separation as the
hardware allows, judged by four yardsticks a run can report: chemistry ignoring gravity locally,
structures large against their parts, many structures, and timescales far apart. *Decided by:* runs
at the smallest ε that fits, checking whether emergence climbs as the separations grow.

**22. What shape is the World?** A torus, a cylinder (keeps a floor and a ceiling), or something
else. It decides the heat sink, whether there is a *down*, and how gravity crosses a seam.
**Provisional direction\*: a looped World that grows, then stops** (Ric, 2026-11-05). New space
appears along lines no bond crosses, three at a time; growth drains energy from light and free
motion into a counted expansion loss; the rate follows the World and stops at the size Ric's
computer can run, measured by benchmark. That would be law 6, so rule 7's written reason applies.
\* *Written 2026-11-05 for Ric to check. Remove the asterisk when he has.*

**23. The causal limit in a world with no tick.** Law 1 says "per tick" and the Lab has none.
`lab.mjs` takes the fastest clock the world can have, `clockRate(T_max)`. A choice, not a
derivation: it ties the speed of light to the clock constants, and in practice it almost never
binds.

**24. The Margolus offset with no step.** `lab.mjs` builds each collision block as one of the two
triangles containing the colliding pair, chosen by a coin. Fresh per collision, so no boundary
persists — but its equivalence to "offset each step" is unmeasured.

**26. Radiation's six bits are exact only under lockstep.** In continuous time a trailing quantum
can catch the one ahead. `lab.mjs` makes it wait, which loses nothing but contradicts the claim that
radiation always travels at the causal limit.

**27. Momentum is for mixing, not for chemistry.** With no motion at all, 12,222 bonds still form —
but only between pairs the seeding placed together. Motion is what lets the table measure chemistry
instead of the initial arrangement. Open: whether `TWO-RUNS.md` names initial momentum as a held
condition.

**33. Does law 1's `|p| / K` inertia emerge?** Law 1 says a heavy composite resists being pushed.
Nothing computes `K` any more, so it would have to emerge — and first evidence says it does not:
momentum per member is flat with cluster size. Imposed by hand it was worth +0.05 of mean `B`, inside
the 0.06 spread between seeds. *Decided by:* tracking clusters through time, which needs re-identifying them every sample,
since rule 2 forbids storing a cluster id.

**34. Motion on the lattice has six headings, and momentum is too coarse to orbit.** *(Raised
2026-11-06. Ric asked whether orbits are like reality and how to make them more so with the least
added; then found that a coin on every tied step makes a diagonal path random-walk off its line.)*
`orbit.mjs` Checks 13 and 14 measured it:

- **Rounding a step to the nearest of six directions gives the world six headings.** A primitive
  heading 10° or 20° off a lattice direction travels at exactly 0°, forever — 1,736 and 3,420
  hexagons off its true line after 10,000 steps. On an exact tie the coin is a random walk: 43
  hexagons off after 10,000 steps, worst 121. **Ric's rule** — a coin on the first tie, then the
  opposite every time — fixes ties exactly (never more than half a hexagon off) but not the
  off-axis headings. **Tracking a continuous position and occupying the hexagon it rounds to**
  (Bresenham's principle) fixes both: under 0.6 of a hexagon off at any heading, no coin anywhere.
- **Whole-unit momentum is what stops light kinds orbiting.** At strengths the filter allows, today's
  rule orbits only kind 255 around the larger clumps; kinds 64 and 1 never do. With momentum in units
  of 2⁻³² (still whole numbers, still exactly conserved) every kind orbits, every seed.
- **Together the two additions match Newton.** Fine momentum alone gives stable but lopsided orbits
  (eccentricity 0.19–0.32) that still lose 0.1–1.5% of their angular momentum a lap. Fine momentum
  plus a tracked position gives eccentricity 0 and **no** angular-momentum drift — identical to the
  continuous control in every row — and Kepler's third law to 0.9997, against 1.05–1.20 today.
  Ric's tie rule changes nothing once momentum is fine, because exact ties stop happening.

**Recommended, not adopted**, and it is two new pieces of stored state, so rule 5's written reason
applies. **Fine momentum** replaces the 14 momentum bits in the word with two 32-bit components in a
second array — the array item 19 already recommends for gravity's remainder, which this makes part
of momentum, settling item 19 too. **A position within the hexagon** is two more components. Together
about 24 bytes a hexagon against 8. Open before it can go in the engine: what happens to the tracked
position when the step it implies is blocked (the hexagon is occupied, or a bond holds); how the
Lab's event-driven time schedules a step at the moment the position crosses a hexagon's edge — which
would also make matter's speed limit hard rather than an average; collisions drawing an outcome
from a set too large to list; re-measuring `S`; and re-checking the Lab's chemistry, since stepping
would stop being random in time. *Decided by:* Ric, then a Lab run with both, compared with today's.

### Settled

| # | Question | Answer |
|---|---|---|
| 1 | The form of law 2 | `B = 8 − \|v(k₁) + v(k₂) − 8\|`, `v = k mod 8` — chosen over ten screened forms; `gcd` lost on roughness and on every kind bonding best with itself (2026-11-04) |
| 2 | How energy reaches empty space | As radiation — the fifth structural fact. Sight lines are exactly reciprocal, so the second law closes pairwise; a flat clock would make radiation carry nothing (2026-11-04) |
| 3 | How momentum is stored | Option (B): an integer vector, speed `p/k` as a rate, collisions in Margolus blocks (2026-11-04) |
| 4 | Momentum in bonded groups | Shared along bonds, equal and opposite, one hop per clock fire — joint motion would break the causal limit (2026-11-04) |
| 6 | Capacity by kind | `clamp(k mod 8, 1, 6)` (Ric: "per kind", 2026-11-06). **Unscreened** — belongs in `screen.mjs` before anyone calls it final |
| 7 | Kinetic energy | Adopted: a whole number recomputed from `(p, k)`, no free-energy pump. `S = 64`, then `S = 4` at ±63 |
| 8 | Floor bounce or absorb | Not a Lab question — the Lab has no floor. Returns only if the World keeps one (item 22) |
| 15 | Heavy matter inert at four bytes | The word went to eight bytes and energy to 16 bits; the heaviest kind now reaches 32× its strongest bond (2026-11-04) |
| 16 | Do things orbit? | Yes — with the sub-unit pull carried and step ties broken by a coin. Too few to halt collapse (2026-11-05) |
| 21 | A step that ties two directions | A coin (Ric: "the coin flip is definitely the way to go", 2026-11-05). A fixed pick spiralled every orbit inward |
| 25 | A bond that motion would stretch | It holds, and the step does not happen. Four readings measured; the shortest won. Clusters still move — bonds within 60° of travel survive a step (2026-11-06) |
| 28 | Law 2's formation probability | Its own searched constant, `BOND_FORM_PROB` (Ric: "make it eighth", 2026-11-06) |
| 29 | Heat never became motion | The thermal kick: heat becomes motion in opposite-moving pairs, summing to zero (Ric, 2026-11-06). Thermal pressure itself not yet shown — needs a sweep |
| 30 | The hot band's ceiling | `HOT_T_MAX = floor(65535 / 255) − 1 = 256`, derived in `constants.mjs`; the Lab refuses a hotter band at startup instead of throwing mid-run. The headroom is measured: arriving energy used at most 3.9% of it (`lab-check.mjs` Check 11, 3 seeds). `THERMOSTAT_SWEEP` said 4096 until then (2026-11-06) |
| 31 | Motion shattering chemistry at ±63 | Separated: GAP 3's reading was the main cause, the width secondary, the kick probability not a cause. Closed by item 25 |
| 32 | A cluster walk broke rule 9 | Removed. Reality has no rigid bodies, and nothing computes a body's total mass. The pyramid is again the only non-local read (2026-11-06) |

## Roads not taken

Each is written up in full in `HOW-WE-DECIDED.md`, *The register in full*.

- **Reversible microphysics.** Cleaner heat and entropy, a real arrow of time from statistics.
  Harder to design and slower.
- **Symmetries instead of conservation.** Noether derives conservation from symmetry, so there is a
  level below law 1. Elegance, not capability.
- **Gravitational time dilation.** Irrelevant to life in reality; dense regions here already run at
  different rates because compression makes heat. If it goes in, it goes in as clock rate.
- **A fusion analogue.** A second energy budget unlocked by extreme compression, giving the world
  ignition and burn. Law 1 counts the sum of kinds so this stays possible. It would make kind
  mutable, so every bond on a fusing primitive must be broken at the old kinds first.
- **Spontaneous decay.** A source of novelty and long-term heat independent of surroundings.
- **An expanding world** (Ric, 2026-11-03). The case that survives is collapse: gravity never
  cancels, so a static world may end as one clump. Two variants — true expansion with the loss
  counted, or gravity weakening as the world cools, which keeps strict conservation. Item 22's
  growing World is the current version of this road. Whatever form it takes, it must not stretch
  what is bound.
