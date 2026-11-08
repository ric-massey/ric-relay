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
of them on a small looped lattice and conserves exactly. Matter moves at its real heading, never at
the speed limit, and bonds push back when strained. It produces clusters in enormous variety
but, at the one point in the search space tried so far, **does not select between them** —
measured 2026-11-06, [item 5](#open-questions).
The World is built and runs: a bounded sheet, four laws, cooling through its edge. Everything open is in
[Open questions](#open-questions), which is the work list.

## Contents

[Files](#files) · [What exists](#what-exists) · [The five laws](#the-five-laws-four-of-which-run) ·
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
| **The World** — all five laws, ticked time, a space that grows | |
| [`world.mjs`](world.mjs) | The World: a bounded sheet of matter, the same four laws the Lab has, no thermostat, and an **edge that light leaves through** — its only energy sink. Six bytes a hexagon since gravity and expansion came out (2026-11-08). |
| [`world-run.mjs`](world-run.mjs) | Runs it and reads three things off the history — chemistry, cooling, and the temperature gradient from skin to core — three seeds by default, every run written to [`runs/`](runs/). |
| [`world-check.mjs`](world-check.mjs) | The World's pre-flight, eleven checks: the two exchanges, the heat seam, GAP 3's geometry, the density contrast against its own null, and the edge (light leaves and is counted, matter never does). |
| [`world-stream.mjs`](world-stream.mjs) | Serves a run that is still happening, on the wifi or through the site's Worker. See [`STREAMING.md`](STREAMING.md). |
| **Around the engine** | |
| [`snapshot.mjs`](snapshot.mjs) | Freezes a Lab run into [`runs/`](runs/) for the viewer. |
| [`viewer.html`](viewer.html) | Lattice inspector. Reads a frozen run and lets you open any hexagon. State, not dynamics. |
| [`wave.mjs`](wave.mjs) | Measurement harness over copies of the engine (items 25, 32, 33). |
| [`census.mjs`](census.mjs) | Every standing cluster in a Lab run, grouped by what it is made of: the first periodic table (item 5). |
| [`collide.mjs`](collide.mjs) | Aims two clusters at each other on purpose and reports what the meeting does. |
| [`clusters.mjs`](clusters.mjs) | The one connected-component walk both of those use, outside the engine where rule 9 does not bind it. |
| [`rejected/`](rejected/) | Mechanisms that came out of the engine, kept with the numbers that removed them — and one, the momentum wave, that has since come back and says why. |
| **Screening tools** — answer a question without running a world | |
| [`screen.mjs`](screen.mjs) | Scores candidate forms of law 2 over all 65,025 pairs of kinds. |
| [`budget.mjs`](budget.mjs) | Enumerates what fits in the hexagon's word. |
| [`momentum.mjs`](momentum.mjs) | Settled how momentum is stored and the kinetic-energy scale. |
| [`radiate.mjs`](radiate.mjs) | Settled radiation across vacuum and the clock. |
| [`orbit.mjs`](orbit.mjs) | Settled that things orbit; measures how strong gravity may be, and how motion on the lattice should be stepped (item 34). The only tool that steps in time — two primitives under one law is a measurement, not a world. |

`AGENTS.md` rule 12 says what each tool can and cannot tell you.

### Running it

```sh
node lab-check.mjs                     # the Lab's thirteen checks, ~30 s
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
more. Its word holds four things:

| | | bits |
|---|---|---|
| **kind** | how much stuff this primitive is made of — this universe's mass, 1–255 | 8 |
| **momentum** | an integer vector on the hex axes, two components at ±63; speed is `|p| / √(k² + |p|²)` of the limit | 14 |
| **bonds** | which of its six neighbours it is bonded to (in vacuum: a quantum's direction) | 6 |
| **energy** | heat it is carrying, 0–65535 | 16 |

**Eight bytes**, 44 bits used and **20 reserved** — nothing goes in the spare bits without an entry
in `THE-LAWS.md` and a reason (`AGENTS.md` rule 5). A width is physics here: the old four-byte word
made heavy matter permanently inert (item 15), and momentum went from ±15 to ±63 on 2026-11-06
(item 20). `constants.mjs` is the word the engine runs on.

**Beside the word, since 2026-11-06 (item 34; Ric: "I'm fine with the added state it's not much"):**

- **Position inside the hexagon** — where the primitive really is, two components. A step goes into
  the hexagon its straight path enters next, so matter travels at its real heading. In the Lab it is
  two float64s (`w.ox`, `w.oy`); the World's plan is two 32-bit components.
- ~~**Fine momentum, World only**~~ — momentum in units of 2⁻³², which is where gravity's sub-unit
  pull was held (item 19). **Out on 2026-11-08 with gravity**, and with it the last float in the
  World's state. Nothing else in this universe makes a fraction.

So the World's engine is **six bytes a hexagon** — kind, energy, two momentum components, bonds —
which is exactly what `snapshot.mjs` has always written to disk and the viewer has always read. At
six bytes the arithmetic of "how big" is: 17 million hexagons is 170 MB and runs at about 1.7 s a
tick, and the structural ceiling is **2.1 billion hexagons**, where the `Int32Array` of cell indices
runs out at 2³¹−1 and 24 GB of RAM runs out at the same moment. Time is the real limit long before
memory: three days of wall clock is ~155,000 ticks at 17 million hexagons and ~1,200 at two billion.
The Lab keeps its two float64 positions, where nothing is the size of a world.

**Hitting a ceiling fails loudly.** Kind stops at 255 and energy at 65535; anything that would
exceed a field is an error, never a wrap or a clamp, because either would break conservation with
no law violated.

There are no materials and no mixtures. Materials are what you go looking for; a mixture is just
neighbouring hexagons of different kinds.

**Shape.** The Lab is a hexagonal torus, 258 × 258, with no edge anywhere (a side divisible by 3,
for the collision blocks). **The World is a bounded sheet** — item 22, settled 2026-11-08 by what the
shape decides, which is the heat sink: a quantum that steps off an edge is gone and counted, and that
is the only way energy leaves a World run. An edge hexagon has fewer than six neighbours and an axial
corner has only two, so chemistry at the boundary is not chemistry in the middle.

**Size, and what it means as a physical object.** The Lab is 66,564 hexagons, 532 KB. One hexagon is
one atom at about 0.3 nm, so a 258² Lab is a flake 77 nm across — and the Worlds that matter are:
17 million hexagons (4128², 170 MB) is **1.2 µm square, a bacterium's footprint, one atom thick**,
and the 2.1-billion ceiling is **14 µm, a human cell's footprint**. For scale in the other direction,
the BFF soup used 131,000 programs, and gravity would need a sheet 54 metres across.

**Why hexagons.** On a square grid a diagonal step is 1.41× a side step, so the world gets
favourite directions — ripples come out square and growth locks to the axes. That is fatal when the
method is "look for structure you didn't expect": you would find your grid. A hexagon's six
neighbours are equidistant, which is why the square lattice gas HPP was abandoned for the triangular
FHP. Six neighbours plus a bond limit also give molecular **shape** — angles, branching, isomers —
with no extra law.

## The five laws, four of which run

**One hexagon is one atom** (Ric, 2026-11-08). That was never written down before, and law 3 is a
consequence of it: at one atom per hexagon the whole World's self-gravity is 10⁻²⁴ of one of its own
bonds, so gravity is **not in either engine**. It stays on the list because it is still true of the
universe and would run a World 10¹³ times larger. `THE-LAWS.md` has the arithmetic.

In plain words:

1. Nothing is ever created or destroyed.
2. Bits of stuff next to each other can hold hands, tightly or loosely depending on what they are.
   Heat shakes them loose.
3. All stuff pulls on all other stuff, however far away. *(Too weak to matter at this size.)*
4. A bit of stuff can only hold hands with so many others at once.
5. Heat spreads toward wherever it's colder, and leaves at the edge of the world.

Precisely:

| # | Law | |
|---|-----|---|
| 1 | **Conservation** | Matter (the **sum of kinds**), energy and momentum are integers and are never created or destroyed. Where something crosses an edge it is counted. **Momentum** is an integer vector and **speed is a rate** that never reaches the limit: `|p| / √(k² + |p|²)`, relativity's form (Ric: "I don't want anything of matter to reach that speed") — so heavy matter is slow rather than frozen and only radiation travels at the causal limit. A primitive keeps its true position inside its hexagon and steps into the hexagon its straight path enters next (item 34), so it travels at its real heading, not along one of six. **Kinetic energy** is the whole number `floor(S · Q(p) / 2k)` with `S = 4`, recomputed from `(p, k)` rather than stored, so the conserved total is heat + Σ KE. Collisions resolve in three-hexagon blocks, conserve momentum exactly, and draw their outcome at random. A **thermal kick** turns heat into motion in opposite-moving pairs, so momentum still sums to zero. |
| 2 | **Bonding** | Adjacent primitives may bond with binding energy **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, `v(k) = k mod 8` — strongest when the two valences are complementary. A bond forms with probability `BOND_FORM_PROB` when a clock fires, never instantly on contact, which is what makes catalysis possible. It breaks when **`e ≥ B · kind`** at either end — temperature at or above `B`. Motion never breaks a bond: a step that would stretch one does not happen, and the bond reacts — one unit of momentum passes along it to the partner, as a real bond's tension would. No distance term and no force — exclusion already repels and gravity already gathers. |
| 3 | **Gravity** | All matter attracts all matter as 1/r², never cancelling, acting on the sum of kinds. **Not in either engine since 2026-11-08, and the reason is arithmetic rather than taste:** one hexagon is one atom, a 4.26-million-hexagon sheet has a self-gravitational binding energy around 10⁻⁴² J against 5 × 10⁻¹⁹ J for one bond, and the crossing point is 3 × 10²² hexagons — a sheet of atoms 54 metres across, against the 14 µm the hardware holds. Swept first (item 20): at the strength every World run had used, 53% of pulls were refused at law 1's momentum range and chemistry lost 3.6× the bonds a control did. Its fine momentum and its potential field went with it, and with them every float in the state and three quarters of the cost of a tick. |
| 4 | **Capacity** | A primitive bonds to at most `capacityOf(k) = clamp(k mod 8, 1, 6)` neighbours — read from the same valence law 2 uses, so kinds have valences (item 6). Its job is saturation: without it attraction collapses everything into one blob. |
| 5 | **Transport** | **The World's only sink, and now the only one it has ever needed.** Energy hops toward a neighbour at a **lower temperature** — compared as `e₁·k₂` vs `e₂·k₁`, exact in integers. Temperature, not energy: comparing raw energy would move heat uphill into heavy cold matter. Across a gap it travels as radiation (the fifth structural fact). At the World's boundary it leaves for good — counted on the way out, and a cold 96 × 96 sheet radiated away 54% of everything law 2 ever gave it. |

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
| Size | 258 × 258, looped | as large as the clock allows — 4128² runs (item 20) |
| Laws | four — no gravity | **four — no gravity either, since 2026-11-08** |
| Shape | a torus: no edge | **a bounded sheet: light leaves through the edges** |
| Conditions | set and held, like a laboratory | **nothing held: law 2 heats it, the edge cools it** |
| Time | event-driven, continuous | ticked, with a per-tick probability |
| Question | **what is matter here?** | **what can matter do here?** |

**The Lab** holds a hot band and a cold band and measures. Gravity is out because a measurement
needs controlled conditions — with gravity, pressure and temperature everywhere depend on the whole
shifting mass, and the same experiment run twice gives two answers. Its output is meant to be this
universe's periodic table: the stable clusters, what each is made of, and how each behaves when it
meets another — **measured by running collisions**, not computed. It is small so a dead law shows up
in minutes.

**The World** starts as matter spread out with noise, and what happens then is no longer gravity's
(item 40 settled the scale, and item 20 settled gravity with it). Bonds form; law 2 releases their
binding energy as heat; the heat crosses the sheet as radiation; it leaves through the edge and is
counted. Early is bonding and warming, late is cold and still, and the arc is the sheet spending the
only energy it will ever have. Still nobody's schedule — and measured: 54% of that budget left a
96 × 96 sheet in 20,000 ticks, which ended frozen at 89.1% bonded.

**What the two runs now differ by is conditions and shape, not laws.** The Lab holds a temperature
because that is what makes a species measurement repeatable. The World holds nothing and has an edge,
because that is what lets it have a history. That is a sharper split than "four laws against five"
ever was.

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
  bug — item 20, and on 2026-11-08 it was settled by taking the law out rather than by finding a
  strength. `GRAVITY_EPS` and `GRAVITY_FALLOFF` are still `null` and are used by neither engine:
  **two of the seven searched constants are no longer part of the search.**

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

**5. Does the Lab produce a periodic table with any depth?** The central question. **Measured for
the first time 2026-11-06 by `census.mjs` and `collide.mjs`, at `CANDIDATE_ZERO` only, and the
answer there is variety without selection -- which is the OPPOSITE failure to the one this item
was watching for.** The item stays open, because one point in the search space is not the space.

*(The text this replaces said: "The central question, and unanswered. A handful of stable clusters
and nothing else would mean law 2 needs more structure." The fear was too few species. There are
too many, and they are not chosen.)*

- **Variety is enormous.** 3,911 distinct valence signatures over three seeds, 688 of them on every
  seed, clusters standing at every size from 2 to 26.
- **Selection is absent wherever it can be measured.** A signature count is not depth: a cluster of
  size `n` has `C(n + 7, 7)` possible valence multisets whether or not the laws do anything, so the
  count is compared against the distinct-signature count expected from drawing that many at random
  (Feller's occupancy problem, `SOURCES.md`). On **independent** clusters the ratio is **0.97 at
  size 2, 0.97 at size 3, 0.92 at size 4** — nearly every combination that could stand, does.
  Above size 5 there are fewer clusters than possible signatures, so the ratio is arithmetic and
  says nothing. **A periodic table needs some combinations stable and others not. This has no such
  discrimination at the sizes where the question can be asked.**
- **And the measurement caught itself.** Computed over all samples instead of independent ones, the
  same ratio reads 0.12 at size 8 and looks like strong selection. It is not: a cluster outlives
  about sixteen sample intervals, so its signature recurs because it is the same cluster. Rule 11,
  arriving through the statistics rather than through a picture.
- **The most abundant species is inert and fragile, and that is law 4 working.** `0-1` stands more
  often than anything else, and it has the **weakest bond the law can make** (`B = 1`) with
  **capacity 1 at both ends**, so it cannot bond to anything further. Across all fifteen collision
  cells it was given, it never once merged — it bounces, and at momentum 63 it shatters into free
  primitives. **Abundance here measures dead-endedness, not stability**, which is worth keeping in
  view when the sweep scores a run on how much matter is bound.
- **Collisions build slowly and break quickly.** Aiming two chosen clusters at each other
  (`collide.mjs`, bond across the line of travel, 25 pairs x 3 seeds): at momentum 4, **52% merge**;
  at 16, **16%**; at 63, **8% merge and 32% shatter**. Conservation closed and net momentum ended at
  exactly (0, 0) in all 450 collisions.
- **Lifetimes are long but only bounded below.** 69.7% of cluster instances last at least 50 time
  units; the longest-lived sizes are 3 to 5. More than half were still alive when the run ended, so
  the median of those that died is biased low and is a floor, not an estimate.
- **One finding about law 1, not law 2, fell out of building the harness** and may deserve an item
  of its own: a dimer whose bond lies **along** its line of travel records `stepped = 0` at momentum
  16 and above — its trailing member can only step into its own leader — so it cannot be aimed at
  all. With the bond across travel it moves freely. A control with one dimer alone also shows a
  cluster **colliding with itself** in both orientations, which is why `collided` cannot be used to
  detect an encounter.

*Decided by:* sweeping the search space and scoring each run on this census — which is the next
step, and the reason the census exists. What would count as depth is now a number rather than an
impression: a selectivity ratio well below 1 at sizes 2 to 4, where the measurement has power.

**9. What is the ratchet?** Prior systems lack a reason the world cannot retreat. Candidates:
compound formation (undoing it costs binding energy back) and sedimentation (burial is
irreversible, and gives the world a history).

**10. Can anything climb past rung two?** Prior work reaches replicators from a soup (Hutton 2002;
BFF 2024) but nothing has produced *cumulative* novelty afterwards.

**11. Does something have to stop gravity — a law 6?** ~~Orbits are too few to halt collapse (item
16), so a static World may end as one clump.~~ **Moot at this scale since 2026-11-08** (items 20, 40):
gravity does not run, so nothing has to stop it, and no law 6 is needed for that reason. The question
returns only for a World of 10²² hexagons, which is not a World anything here can run. Kept open
rather than settled because the answer is "the question does not arise", which is not the same as an
answer. Candidates are under *Roads not taken*.

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
Nothing computes `K` any more, so it would have to emerge. Without the wave, momentum per member was
flat with cluster size. **With the wave back it falls for the first time** — 37.2 at size 2, 37.6 at
3–4, 31.6 at 5–8 — but the last bin is five clusters on one seed: a hint, not a finding. Imposed by
hand, `|p| / K` is now worth +0.05 of mean `B`, inside the 0.10 spread between seeds. *Decided by:* tracking clusters through time, which needs re-identifying them every sample,
since rule 2 forbids storing a cluster id.

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
| 19 | Where gravity's sub-unit pull lives | In momentum itself: fine momentum, units of 2⁻³², two 32-bit components in a second array — adopted with item 34 (2026-11-06) and built with gravity's solver. Rounding switched gravity off everywhere; the spare bits were too coarse; a coin per tick heated matter and killed orbits |
| 21 | A step that ties two directions | A coin (Ric: "the coin flip is definitely the way to go", 2026-11-05). A fixed pick spiralled every orbit inward. Under tracked stepping (item 34) exact ties no longer arise, so the coin only serves `STEPPING: "nearest"` |
| 25 | A bond that motion would stretch | It holds, the step does not happen, and the bond reacts: one unit of momentum passes along it to the partner, as a real bond's tension would (the "wave", rejected and re-adopted the same day — Ric: "Closer to reality it is"). Clusters still move — bonds within 60° of travel survive a step (2026-11-06) |
| 28 | Law 2's formation probability | Its own searched constant, `BOND_FORM_PROB` (Ric: "make it eighth", 2026-11-06) |
| 29 | Heat never became motion | The thermal kick: heat becomes motion in opposite-moving pairs, summing to zero (Ric, 2026-11-06). Thermal pressure itself not yet shown — needs a sweep |
| 30 | The hot band's ceiling | `HOT_T_MAX = floor(65535 / 255) − 1 = 256`, derived in `constants.mjs`; the Lab refuses a hotter band at startup instead of throwing mid-run. The headroom is measured: arriving energy used at most 3.9% of it (`lab-check.mjs` Check 11, 3 seeds). `THERMOSTAT_SWEEP` said 4096 until then (2026-11-06) |
| 31 | Motion shattering chemistry at ±63 | Separated: GAP 3's reading was the main cause, the width secondary, the kick probability not a cause. Closed by item 25 |
| 32 | A cluster walk broke rule 9 | Removed. Reality has no rigid bodies, and nothing computes a body's total mass. The pyramid is again the only non-local read (2026-11-06) |
| 34 | Matter moved along six headings, and momentum was too coarse to orbit | **Tracked stepping adopted** (Ric: "I'm fine with the added state it's not much", 2026-11-06): each primitive keeps its position inside its hexagon and enters the hexagon its straight path enters next, at speed over the distance to that edge. Off-axis headings travel true (was up to 30° off) at the right speed (`lab-check.mjs` Check 13); orbits match Newton (`orbit.mjs` Checks 13–14). **Fine momentum** (units of 2⁻³²) is adopted for the World and built with gravity — nothing in the Lab makes fractions. Costs: about 2.3× the events per unit of time, and the T = 6 chemistry peak falls 6.41 → 6.23 at equal time |
| 37 | The World ran law 1's retired reading | **Ported 2026-11-07** (Ric: "Fix all 4"). `world.mjs` refused a step to *any* bonded primitive — a bond as a wall — which is the reading item 25 replaced on 2026-11-06 in the Lab and nobody carried across. So the two engines ran different physics while `TWO-RUNS.md` said they ran the same laws two ways. The World froze: 91.5% bonded by tick 1100, 19,389 steps in 1500 ticks against 2.6 million gravity carries, and no dial could move it. Now 60°-survival and `pushAlongBond` are both in, through the exchange seam the World already had. Measured on the same dial and conditions: steps 19,389 → **33,367, of which 11,895 by bonded matter**, 349,224 pushes along bonds, and collapse becomes visible for the first time (contrast 1.00 → 1.50, three seeds of three). `world-check.mjs` Check 9 holds the geometry |
| 38 | The expansion drain could create energy | **Fixed 2026-11-07.** It took a unit off whichever momentum axis was non-zero and recorded the difference only `if (lost > 0)`. On cube coordinates removing a unit can *raise* the kinetic energy — for `p = (1, −5)`, `Q` goes 42 → 50 — and the difference then existed in the world and in no counter. Invisible until the World could be seeded with momentum: the first `--p0 6` run broke the books by **60 units in 100 ticks**, which is rule 6 earning its keep. Now it is a dry run that takes a unit only if it sheds, and declines otherwise |
| 39 | The collapse statistic could not show a collapse | **Replaced 2026-11-07.** It was the *maximum* of (self + matter neighbours) over every seventh cell: an integer that cannot exceed 7. At fill 0.30 a full neighbourhood turns up about twice by chance in a sample that size, so it read 7 within a hundred ticks of every run; at fill 0.08 it sat at 6 for 1500 ticks and said NOT SEEN whatever gravity did. The whole evidence for collapse in the first World runs was "6 → 7", a saturated order statistic. Now it is the contrast against the null the configuration provides: conditional on a hexagon holding matter, each neighbour holds matter with probability `f` if matter is spread at random, so `(mean neighbourhood − 1) / 6f` is 1.0 for random and has no ceiling until `1/f`. Validated at 1.00 ± 0.02 at fills 0.10, 0.30 and 0.60, and 9.79 on a solid block (`world-check.mjs` Check 10). **It was confounded in a growing world, and that is measured, not suspected:** its null is "spread at random *at the current fill*", and a World that adds space faster than matter can spread into it leaves matter clumped against the new fill for nothing. Gravity on, `--grow 10`, reached contrast 7.33 while fill fell 0.301 → 0.050 — but the gravity-off control at the same growth reached **4.10**, so more than half of it was dilution. The honest column there was the raw mean neighbourhood, which **rose 2.810 → 3.198 with gravity and fell 2.810 → 2.229 without it**: a 1.8× effect and not a 7× one. *(Historical as of 2026-11-08: a World's space no longer grows, so the fill is fixed and the confound cannot arise — but the lesson generalises to any statistic whose null moves while the run does.)* |
| 20 | How strong is gravity, how big is the World, what shape is it? | **All three, 2026-11-08, and the scale answered them together** (item 40). *Strength:* zero — at one atom per hexagon the whole sheet's self-gravity is 10⁻²⁴ of one of its bonds, and the crossing point is 3 × 10²² hexagons. The 2026-11-07 sweep had already shown the dial every run used was above law 1's own momentum range (53% of pulls refused, 4,387 clamped) and cost chemistry 3.6× the bonds a control lost. *Shape:* a bounded sheet (item 22). *Size:* limited by time, not memory — six bytes a hexagon means 2.1 billion cells fit in 24 GB and the `Int32Array` of indices runs out at the same place, but three days of wall clock is 155,000 ticks at 17 million hexagons and 1,200 at two billion |
| 22 | What shape is the World? | **A bounded sheet** (Ric, 2026-11-08: "Edge it seems the way to go. No expansion and no gravity."). The shape decides the heat sink, and that is what settled it: a torus has none, measured — 815,538 of 820,195 quanta reabsorbed inside the loop, and the expansion drain that was to be the sink took 102,936 units against 23 million of heat before switching off at the cell cap. A quantum that steps off an edge is gone and counted. The growth machinery went with the torus: no `grow`, no drain, no cell cap, and the arrays stop being reallocated mid-run. An edge hexagon has fewer than six neighbours and an axial corner only two, which is a real asymmetry and is now checked (`world-check.mjs` Check 11) rather than discovered later |
| 35 | Gravity pays out with no floor | **Gone with the law, 2026-11-08.** It was never fixed, and it is worth keeping the number: a stream left running for 569,750 ticks manufactured **17,120,848 units** of kinetic energy, three quarters of everything the world contained, and the books closed throughout because the counter was defined as the complement of everything else. The question it raised — whether a force may pay out when nothing moves — is a real one and is now moot here |
| 36 | The World has exactly one energy sink, and it is far too small | **Answered by the shape, 2026-11-08.** Expansion drained 0.4% of the heat; the edge drains properly. Measured: a cold 96 × 96 sheet released 13,412 units through law 2 and **radiated 7,250 of them away, 54% of everything it ever had**, finishing frozen at 89.1% bonded. The sink costs nothing per tick, where the drain cost a whole-world reallocation. It is a SURFACE, so it scales as 1/side — 20,000 ticks shed 54% of the budget at 96² and 1.92% at 258² — and that is the finding rather than a limitation: it is why the World grows a cool skin |
| 40 | What is one hexagon? | **One atom** (Ric, 2026-11-08: "think about how much DNA gets affected by gravity. And how many atoms are in DNA"). **Nothing in this project had ever said**, which is why law 3's strength was a dial with no derivation for three days and why `world-run.mjs` had an `--eps` at all. With the scale written down, gravity is arithmetic rather than opinion (item 20), a bond is a chemical bond, and the World is a physical object of a known size: 17 million hexagons is a bacterium's footprint one atom thick, 2.1 billion is a human cell's. It also fixes what the project cannot ask for: a star needs 10⁵⁷ atoms, so no dial and no hardware will put one in this lattice |
| 41 | Does an edge actually cool a World, and what shape does the cooling have? | **Yes, and it is a skin effect.** Measured 2026-11-08, the run the rebuild rested on (`runs/world-edge-258-hot.json`): 258², seeded at temperature 4, 20,000 ticks, three seeds. Chemistry, cooling and a gradient on **3 of 3** — the skin reads **3.40 against the bulk's 3.67, so the interior is 1.077–1.088× hotter**, and the profile is one band deep with a flat interior rather than a smooth slope from edge to centre. It is a surface sink, so it scales as 1/side: 20,000 ticks shed **54% of the energy budget at 96²** (that sheet finished frozen at 89.1% bonded, mean temperature 0.000) against **1.92% at 258²**. The first statistic for this was wrong in the usual way — it compared the skin with the *innermost* band, which holds a fifteenth of the skin's matter and swings on noise, and it reported NO GRADIENT on a seed whose skin was plainly 7% cooler; the bulk is now the matter-weighted mean of every band but the skin. **Open underneath it:** whether the gradient steepens with size, which is the same run at a larger `--size` |

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
