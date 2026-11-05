# Universe

A physics, not a simulation.

A simulation models something that already exists. This doesn't. What lives here is a
**rule set** — five laws — and the world is whatever those laws do when you run them.
Nobody knows in advance what that is, including the person who wrote them. The only way to
find out is to run it.

The goal is a world deep enough that something intelligent *could* emerge from it. Not a
promise that it will, and not a prediction about when.

The motivation is narrower than it was first written, because the first version overreached.
It is **not** true that every prior attempt was structurally incapable of intelligence —
nothing in the literature establishes that, and `SOURCES.md` certainly doesn't. What *is*
documented is that several prior systems have **ceilings traceable to specific design
choices**: Avida's complexity saturates at a value set by the information content of its
niche, because its feature set is fixed; Tierra's interpretation machinery is hard-coded into
its virtual CPU and cannot evolve; the BFF soup cycles through replicator takeovers without
accumulating anything. This project tries to avoid those particular choices. That is a good
reason to run the experiment and not a claim that nobody else's substrate could ever work.

## Contents

[What this is not](#what-this-is-not) · [What exists](#what-exists) ·
[The five laws](#the-five-laws) · [The five structural facts](#the-five-structural-facts) ·
[What is never written](#what-is-never-written) · [The two runs](#the-two-runs) ·
[The search space](#the-search-space) · [Measurement](#measurement) ·
[**Open questions**](#open-questions) · [Roads not taken](#roads-not-taken)

**And the other files.** [`THE-LAWS.md`](THE-LAWS.md) states each law, justifies it and says what
breaks without it. [`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md) is the record: twelve corrections,
five retractions, every rejected option and the six rules that came off the list. [`TWO-RUNS.md`](TWO-RUNS.md) is why the project runs twice,
and what it would be like as one run. [`AGENTS.md`](AGENTS.md) is the rules for anyone — human or
otherwise — working on this. [`SOURCES.md`](SOURCES.md) credits everything borrowed, which is
rule 1 and Ric's.

**And five tools, none of which is an engine.** [`screen.mjs`](screen.mjs) scores candidate forms
for law 2 over all 65,025 pairs of kinds; [`budget.mjs`](budget.mjs) enumerates what fits in the
hexagon's word; [`momentum.mjs`](momentum.mjs) settled law 1's momentum representation and the
kinetic-energy scale; [`radiate.mjs`](radiate.mjs) settled law 5's radiation and the clock; and
[`orbit.mjs`](orbit.mjs) settled item 16 — things do orbit — and then measured how strong gravity
may be, which opened items 20 and 21. Four of the five answer a question by enumeration with **no simulation anywhere**;
`orbit.mjs` is the exception and the first thing here that steps forward in time, which it is
allowed to do because two primitives under one law is a measurement rather than a claimed world.
`AGENTS.md` rule 12 says what each one can and cannot tell you. [`viewer.html`](viewer.html)
renders.

*(Corrected 2026-11-05. This said `screen.mjs` was "the only code here so far," which was true
until 2026-11-04 and then stopped being true four times over that same day, as `radiate.mjs`, `budget.mjs`, `momentum.mjs` and the viewer landed. The corrected counts for the
record are from the same pass; it said eight and three.)*

If you read one thing past this file, read **Open questions**. It is the work list.

## What this is not

Not a model of our universe. Not a model of our chemistry. Not a model of life as we know
it. Any resemblance would be a result, not a target.

If this world grows something alive, it will probably not look like anything on Earth, and
that is the point. Every Earth-shaped thing built into the design is a hint smuggled to
the world, narrowing what it is permitted to find.

## What exists

**A hexagon is a primitive, a quantum of radiation in flight, or empty.** One per hexagon, never
more. *(It was two states until 2026-11-04; radiation is the third, and `THE-LAWS.md` has the
field-by-field table. Calling it two was the honest cost of settling law 5's sink.)*

A hexagon holds four things:

| | | bits |
|---|---|---|
| **kind** | how much stuff this primitive is made of — this universe's mass | 8 |
| **momentum** | an integer vector on the hex axes, two components at ±15; speed is `p/k` | 10 |
| **bonds** | which of its six neighbors it is bonded to | 6 |
| **energy** | how much it is carrying | 16 |

**Eight bytes.** That is the entire ontology — **40 bits of it, with 24 reserved.**

*(It was four bytes and 31 bits until 2026-11-04. The four-byte word was chosen for the GPU and
then turned out to be **choosing physics**: at 11 bits of energy the heaviest kind could not be
heated past its own strongest bond, so heavy matter was permanently inert, and law 2's cap of 8 was
an artifact of that width rather than the derivation it was presented as. `budget.mjs` enumerated
every allocation that fits in four bytes, and none gives 255 kinds, real thermal headroom **and** a
momentum vector with room to push — you can have two of the three. Eight bytes gives all three, and
the full argument is item 15.)*

**The 24 spare bits are reserved, and that has to be asserted rather than assumed.** The four-byte
word was doing real work as a **forcing function**: at 31 of 32 bits, adding anything meant taking
something away, and that pressure is what surfaced both the inert heavy matter and a bit nobody was
using. At 40 of 64 there is room to add a field without noticing — so the discipline that scarcity
used to enforce now has to be stated. See `AGENTS.md` rule 5.

Those widths are still limits: kind stops at 255 and energy at 65535. A fusion that would make a
kind-400 primitive, or a bond releasing energy into a hexagon already at 65535, has nowhere to
put the result — and silently wrapping or clamping would break conservation without any law
having been violated. So hitting a ceiling **fails loudly**; it is a signal that the constants
are wrong, not something to round off. `AGENTS.md` rule 5.

There are no materials in it, and no mixtures. Materials are what you go looking for. A
mixture is just a region where neighboring hexagons have different kinds — it needs no
representation at all.

The grid wraps left-right with a hard boundary top and bottom — a cylinder, so there is a
real *down* for dense things to settle into and a real *up* for energy to leave through.

### How big

- **The Lab**, 258 × 258 on a torus: 66,564 hexagons — 532 KB. Nothing. *(256² until 2026-11-05;
  a looped Lab needs a side divisible by 3.)*
- **The World**, 2048²: 4.2 million — 34 MB.
- **The World**, 4096²: **16.8 million hexagons — 134 MB.** The target as it stands; item 20 may
  change it, and a looped World would be 4095 or 4098 on a side.
- 8192²: 67 million — 537 MB. Heavy for a browser but possible.

*(The megabytes were four-byte figures until 2026-11-05 and are now eight bytes a hexagon, one
buffer.)*

For scale: the BFF soup used 131,000 programs and Hutton's grid was far smaller. Seventeen
million is large for this field.

### Why hexagons

On a square grid, diagonal neighbors are ~1.41× farther than side neighbors, so "one step"
is a different distance depending on direction. The world ends up with favorite directions
baked in: expanding ripples come out as expanding *squares*, growth locks to the axes, flow
acquires a grain that exists nowhere in the physics.

That is close to fatal for a project whose entire method is "look at the world and find
structure you didn't expect." You would find structure, and it would be your grid.

A hex grid puts all six neighbors at equal distance, so movement is isotropic. This is why
the original square lattice gas (HPP) was abandoned for the triangular one (FHP).

Six neighbors plus a bond limit also hands you molecular **shape** — angles, branching,
isomers — with no extra law. A square grid's four directions would give you much less.

## The five laws

In plain words, because the plain version is the real one:

1. Nothing is ever created or destroyed.
2. Bits of stuff that end up next to each other can hold hands, tightly or loosely depending
   on what they are. Heat shakes them loose.
3. All stuff pulls on all other stuff, however far away.
4. A bit of stuff can only hold hands with so many others at once.
5. Heat spreads toward wherever it's colder, and leaves at the edge of the world.

And precisely:

| # | Law | |
|---|-----|---|
| 1 | **Conservation** | Matter (the **sum of kinds**), energy and momentum are never created or destroyed. All three are integers, so this holds exactly — *inside* the world. At the edges it is counted: energy leaves at the boundary, and the hard floor and ceiling are a **momentum reservoir**, the way the Earth is when a ball bounces off it. **Momentum is an integer vector and speed is `p/k`** — settled 2026-11-04 as option (B). It is stored on the hex axes, two components at ±15, and is deliberately *not* the same field as where the primitive goes next: stepping rounds to the nearest of six directions, but the conserved vector is never rounded. **Speed is a rate** — one hexagon every `k/|p|` ticks, capped at one — which keeps everything inside the causal limit, gives 255 distinct speeds and makes heavy matter slow instead of frozen. That is real inertia, measured. **Motion carries kinetic energy**, as the whole number `floor(S · Q(p) / 2k)` with the scale constant `S = 64` — recomputed from `(p, k)` rather than stored, so law 1's conserved total is `heat + Σ KE`. *(Corrected 2026-11-05. This row said momentum was ±3 and that kinetic energy was "not represented yet — an open question"; both were overtaken on 2026-11-04, when the word went to eight bytes and kinetic energy was adopted. The row summarising law 1 was the last place in this file still *stating* the pre-2026-11-04 law — item 3 below still carried a retracted argument about ±3, marked on the same pass — and a summary table is the worst place for it, being the first form of law 1 a reader meets.)* |
| 2 | **Bonding** | Two adjacent primitives may bond, with binding energy **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, where **`v(k) = k mod 8`** is a valence — so a bond is strongest when the two valences are **complementary** and weakens by one for each step away. *(It was `min(gcd(k₁, k₂), 8)` until 2026-11-04, retracted on two measurements: `gcd` is three and a half times rougher under fusion, and `gcd(k, k) = k` makes every kind's best partner itself, which builds crystals rather than copies. See `HOW-WE-DECIDED.md`.)*. Formation is **rate-based** — a fixed probability when the hexagon's clock fires, never instant on contact, which is what makes catalysis possible. No temperature term: the clock carries that for every law at once. *(It said "falling as temperature rises" until 2026-11-04, which was backwards — heating speeds formation up in real chemistry. See `HOW-WE-DECIDED.md`.)* A bond breaks when **`e ≥ B · kind`** at either endpoint, which is temperature exceeding `B`. No distance term and no force: exclusion already repels, gravity already gathers. This was the biggest hole in the project and is now the version to build first rather than a settled truth; `THE-LAWS.md` has the slate, the screen and every wrong turn. |
| 3 | **Gravity** | All matter attracts all matter, falling off as 1/r², never cancelling. Acts on the sum of kinds and ignores how it's distributed. **The only non-local law, and the only remaining formula.** It earns both; see `THE-LAWS.md`. |
| 4 | **Capacity** | A primitive can be bonded to at most **`C`** of its six neighbors. *(Called *k* until 2026-11-04, which collided with `k` for kind in laws 1, 2 and 5.)* **This law does not originate distinct types** — with a global `C` every kind has identical capacity, so all differentiation comes from law 2. Its real job is saturation: it stops a never-filling attraction collapsing everything into one blob. |
| 5 | **Transport** | Energy hops toward any neighbor at a **lower temperature** — through matter or across empty space — and at the world's boundary it leaves forever. The one and only place anything exits the world. Temperature, not energy: a heavy cold primitive can hold more total energy than a light hot one, and comparing raw energy would move heat uphill. The comparison is `e₁·k₂` vs `e₂·k₁` — exact in integers, no division. Empty space has no kind, so it is absolute zero. That comparison is undefined against vacuum — it reads `0` vs `0` — so **crossing a gap is radiation**, a quantum in flight at one hexagon per step, which is the fifth structural fact rather than part of this law. Settled 2026-11-04. Net flow is downhill only because hotter matter acts more often, so this law places one hard constraint on the clock; see the search space. |

Every justification, what breaks without each one, and the record of what was merged or
rejected is in [`THE-LAWS.md`](THE-LAWS.md), and the full record of how each was arrived at —
including twelve corrections and five retractions — is in
[`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md).

## The five structural facts

True of how the world is built rather than things that happen, but **break any of them and
the world is as ruined as if a law had been dropped.**

- **Hexagonal grid, one primitive per hexagon.** Isotropy, and exclusion for free. **The Lab
  loops on itself** — a hexagonal torus, 258 × 258, no edge anywhere (2026-11-05); the World's
  shape is item 22.
- **Only neighbors interact.** This creates *elsewhere* — independent regions, parallel
  experiments, somewhere a rare thing can persist. It also hands you a **causal speed limit** —
  one hexagon per tick is the fastest anything can propagate, so cause has a finite reach and
  there is a light cone. Gravity is the single exception in the entire codebase.
- **Each hexagon keeps its own time, at a rate proportional to its temperature.** No global
  "now," which is real physics — relativity forbids universal simultaneity. The Lab realizes this as
  event-driven continuous time where nothing ever skips; the World approximates it with per-tick update
  probability, which is a hexagon's clock *rate*, not a hexagon skipping time. **The rate is the
  load-bearing part** and was decided only on 2026-11-04: hot matter acts often and cold matter
  rarely, which is what makes radiation carry heat at all, closes the second law exactly, supplies
  every reaction rate's temperature dependence so no law has to carry one, and is where thermal
  pressure comes from.
- **Bond energy accounting is exact.** A bond forming releases precisely its binding energy
  as heat; breaking absorbs precisely that much. This is not a law — it is what has to be
  true where laws 2 and 5 meet. Off by any amount and the world either runs away or dies
  cold, slowly and silently, with no error to find.
- **Radiation crosses vacuum in a straight line.** An empty hexagon holding energy and a direction
  *is* a quantum in flight — one unit, one hexagon per step, absorbed by the first matter it meets,
  counted by `radiated-away` if it leaves. Without it the transport comparison is undefined against
  vacuum, so the sink is unreachable and no gap can ever be crossed: every empty region would be a
  hole in the universe and gravity would be the world's only long-range channel.

## What is never written

Nothing here appears in the code as state, a formula, or a table. Each either happens or it
doesn't.

**Temperature** (energy per unit of kind) · **pressure** (gravity against capacity) ·
**phase** — solid, liquid, gas (thermal energy against binding energy) · **melting,
boiling, freezing** · **decay** (bonds break when hot enough) · **catalysis** (a third
primitive nearby reshapes the local energy landscape, making a bond easier to break — which
is mechanically what an enzyme does) · **mixtures** (neighboring hexagons of different
kinds) · **radiation** (energy hopping into empty space, which has none) · **a periodic
table** (which kinds form stable clusters, which are inert, which are promiscuous) ·
**chemistry** (how clusters bond through leftover capacity) · **convection, sedimentation,
weather, cores** · **a causal speed limit** · **life**, if it happens.

Five laws in, that list out.

Several of those started as rules and came off the list. Decay, catalysis and a whole
property function went when the floor was pushed down to primitives. Mixtures went when one
hexagon became one primitive. Radiation went when transport was allowed to cross empty
space — and that one also deleted a T⁴ emission curve, a formula with no mechanism behind
it.

## The two runs

**One engine, one physics, run twice. Nothing is coarse-grained.** Both runs simulate
primitives under the same laws. They differ in four things and nothing else:

| | the Lab | the World |
|---|---|---|
| Size | ~256² (258 × 258, looped) | ~4096² |
| Gravity | off | on |
| Conditions | set and held | emergent |
| Time | continuous, event-driven | ticked, with per-tick probability |

That is a correction, and an important one. The documents originally had the World's individuals
be *cluster species the Lab discovered*, which would have given the World a ceiling set by the Lab's
survey — **exactly the Avida disease this whole project exists to avoid.** A measured table
is still a table. (Found by external review, 2026-11-03; see `SOURCES.md`.)

So the Lab's table is never an input to the World. **It is the dictionary you read the World with.**
The World forms whatever composites its primitives form, including ones the Lab never saw, because
the World is running the same primitive physics rather than a summary of it.

[`TWO-RUNS.md`](TWO-RUNS.md) has the full argument, including what this would be like as a
single run, why that version is in several ways better, and why it still loses.

### The Lab — small and deep

**Four laws** — everything but gravity. The reason it's out isn't cost: a measurement needs
*controlled* conditions, and gravity makes pressure and temperature at every hexagon depend
on the whole mass distribution as it shifts, so the same experiment run twice gives two
different tables. The Lab sets a thermal gradient and holds it, the way a chemist works at
standard temperature and pressure. That is legitimate here because **the Lab isn't claiming
to be a world — it's an instrument.**

Time is **event-driven and continuous**, not probabilistic. At 65,000 hexagons a priority
queue is cheap and the GPU isn't needed, and an instrument should not carry a known artifact
when what it produces is a table of numbers everything downstream trusts.

Not looking for life. Asking one question: **what is matter in this universe?**

Output is a data file: the stable cluster species, what each is made of, its binding energy,
its leftover capacity, its density, and how each behaves when it meets another — not
calculated from a formula, **measured by running collisions.**

That file is this universe's periodic table, and it is a *result*, not a design.

The Lab also fails fast, which is the point of splitting it out. If no stable clusters form,
the force law is wrong, and at 258² you learn that in minutes.

### The World — large and free

**All five laws**, gravity included, same primitives, same physics. Time is ticked with
per-tick update probability — a stated approximation to the Lab's continuous clocks, because at
seventeen million hexagons in a browser the queue churn costs 50–100×, not 5–10×. Both
schemes are stochastic; only the time axis differs.

This is the world you zoom around in. Only initial condition: **matter, spread out, with
noise.** Gravity pulls it together, the falling makes heat, and the gradient appears by
itself with no boundary condition anywhere. Once everything has fallen in there is no
potential left to convert, and the world cools.

So the world has an arc, and the arc is not scheduled — it falls out of the physics. Early
is hot and violent and nothing persists. The middle is where structure can hold together
long enough to matter. Late is cold and still.

## The search space

The laws are fixed, and as of 2026-11-04 **so is the form of law 2.** What is searched is **five
numbers**, with the slate of alternative forms held in reserve if the Lab comes back flat.

*(It was seven numbers plus an unknown form. Law 2's rewrite deleted pair force **strength** and
**range** — a binding energy over two integers has neither — and folded a scale factor to 1 by
choice of units. The form itself was then settled, twice over, on measurement: see law 2 in
`HOW-WE-DECIDED.md`.)*

**It is seven now, and neither addition is new physics — both were being chosen by a field
width.** The cap of 8 on `B` was described as **derived** from the field widths rather
than searched. At eight bytes the forced cap is 257, so **law 2's modulus is a searched constant as
of 2026-11-04** (item 17) — that is the sixth. And settling bonded momentum (item 4) required
**kinetic energy**, whose construction carries a scale constant (`AGENTS.md` rule 5) — that is the
seventh, **adopted 2026-11-04 at `S = 64`**, with the measured window 2–291 in law 1. What both have in common: they looked free while a width was doing the
choosing, and counting the budget is what exposed them.

**The form.** Law 2 is a family, not a function, and which member you pick decides whether
chemistry is possible at all. Candidates are drawn from a small fixed grammar of operations
on the two integers — sum, difference, parity, greatest common divisor, divisibility, remainder — and
**never a table of cases**, because the form is itself a place to smuggle in a periodic table.
The constraint is description length, argued in `THE-LAWS.md` and `HOW-WE-DECIDED.md`: a law short enough to write on
one line cannot contain the answer. Note that short does not mean weak — Rule 110 is a few
bits and is Turing-complete. Shortness limits what can have been *written into* a law, not
what it can *produce*.

**The numbers**, within whichever form:

1. gravity strength
2. **gravity falloff exponent**
3. capacity `C`
4. transport rate
5. **clock scale** — the constant of proportionality between a hexagon's temperature and its clock
   rate. It was a flat global rate until 2026-11-04; making it state-dependent changed no count.

And **the form itself can be screened before anything runs.** `B` is a function of two 8-bit
integers over kinds 1–255, so its whole table is 65,025 entries and evaluating it costs
milliseconds. Four
diagnostics — the binding-energy histogram, the family structure of the bonding graph, the
count of near-inert kinds, and the spread of bonding degree — reject most candidate forms with
no simulation at all. **So the biggest hole in the project is also the cheapest part of the
search.** The screen can only prove a form *cannot* work; showing that one does still needs
the Lab.

**Two hard constraints, and both are free filters.** Each rejects a constant set without running
it.

**The clock rate must not clip, and must stay strictly increasing.** The rate is a probability, so
it saturates at 1 — and above the clip two hexagons at different temperatures act equally often,
net radiative flow falls to zero, and its direction becomes a **coin flip**: measured at ten seeds
in twenty running heat *uphill*. The second law does not degrade gracefully here, it switches off.
So with `rate(T) = floor + c · T`, assert `floor + c · T_max ≤ 1`. Measured in `radiate.mjs`; the
table is in `HOW-WE-DECIDED.md`.

*(Corrected 2026-11-04. The no-clip filter above is unchanged. What this used to add — that energy
being 11 bits forces the scale below 1/2047 and therefore a **2047:1 spread in update rates** —
does not follow from it. The spread is `(floor + c · T_max) / floor`, which only reaches 2047:1
when there is no floor and the coldest matter sits at `c · 1`. Put a floor in and the spread is
chosen: 1/16 gives 16:1 and clips at exactly the same place. So this is **no longer tied to item
13**, and the cost of a high floor is transport speed rather than correctness. **At 16 bits of
energy `T_max` is 65535 rather than 2047**, so the unfloored worst case is 32× worse than the
figure quoted here — the floored fix is unaffected, because it is expressed relative to `T_max`
rather than as an absolute constant.)*

**Gravity between two *adjacent* primitives must be negligible against the weakest pair force** — orders of magnitude, not a factor of two — because
in reality gravity has no effect on chemistry whatsoever and only reaches it through
temperature. Violate the ordering and which reactions run starts depending on where in the
world you are, which is the contamination the Lab exists to exclude. It is a free filter: any
constant set that breaks it can be rejected without being run. `THE-LAWS.md`, law 3.

**And gravity has a floor, which nobody had written down** *(2026-11-05, item 20)*: collapse has to
heat something past the weakest bond, or the energy budget law 3 exists for never reaches chemistry.
That is just as free to check — it is a function of the strength and the World's size — and **at
4096² it sits above the ceiling.** So the two filters together currently reject every gravity
strength. That is a finding, not a bug in the filters; `THE-LAWS.md` law 3 has the numbers and the
levers.

The exponent is the most consequential of the five: **strength sets how fast collapse
happens, the exponent sets whether collapse is local or global.** True 2D geometry gives 1/r;
we use 1/r² and `THE-LAWS.md` says why. It belongs in the search either way.

**So the first real finding may be which forms of interaction permit a chemistry at all** —
which would be a result worth having on its own, independent of anything further up the
ladder.

Most settings give a dead universe — frozen solid, or boiling noise. A narrow band gives one
where things happen. You are hunting that band, and it mirrors our own universe, where the
laws look fixed and the constants look arbitrary. The fine-tuning question is about exactly
this.

**And the search can test half of it.** *(Ric, 2026-11-05: "Can we test the Anthropic theory
through this? Technically?" — then, after talking it through, "Write it in. Just nervous about
it.")* The anthropic argument is two claims. **Fine-tuning** — only a narrow band of constants
gives complex structure — is measurable here, and nowhere else: sweep the constants, score every
universe on the acceptance ladder, and the shape of the band is the answer. Narrow or wide, one
band or several, a cliff at its edge or a slope. "Most settings give a dead universe" in the
paragraph above is an expectation, not a result, and this is how it becomes one. **Selection** —
we find ourselves in the band because nobody could exist outside it — is not testable: there are no
observers here, "reached rung N" is the only stand-in, and the person keeping the interesting
universes is the selection effect. Two limits to say every time a result is quoted: it is evidence
about **this** physics, never ours, so it can show fine-tuning happening and can never show that
our universe is tuned; and the ladder is our definition of interesting, so a band measured on it
is a band of what we were looking for. Record the dead universes with the rest (rule 10) — here
they are not the waste of the search, they are half of the measurement.

**This is why you search instead of design.** You cannot tell from reading a rule set what
it will do — that's computational irreducibility, and it isn't a limitation here, it's the
property we want. So: run thousands of short candidate universes, keep the ones that are
neither dead nor noise, run those long. The Lab is where the search lives, because that's
where it's cheap.

## Measurement

Without instrumentation you are staring at colored dots with an opinion, unable to tell
"alive and innovating" from "cycling in place." Two things, both needed:

**The variance layer** tells you *where to look*, and nothing more than that. The viewer
builds a pyramid of downsampled levels — which is also what makes zoom work, and also what
makes gravity affordable, so one structure does three jobs. At each level, show the
*variance* of kind rather than its average. You will never find emergent structure in a
seventeen-million-hexagon world by eye, but you don't have to: find the three bright spots on
an otherwise uniform field and zoom into those.

An earlier version of this file called that "how you find life without knowing what it looks
like," which oversold it. **Crystals, phase boundaries and ordinary clumping light up the
variance layer too.** It is a pointer, not a detector. What something *is* has to come from
the behavioral tests below.

**Evolutionary activity statistics** (Bedau). The field standard, and what Flow-Lenia's
authors actually used. Tracks whether genuinely new, persistent, non-neutral structure is
still appearing, or whether the world has settled.

### The acceptance ladder

Staged criteria, in order, each behavioral rather than visual. Nothing above a rung counts
until the rung below it holds. *(Adapted from external review, 2026-11-03.)*

| Stage | What would count as evidence |
|---|---|
| **Consistent mechanics** | Small isolated interactions balance matter, momentum and total energy, with every edge counter in the sum — radiated-away, thermostat net, and wall momentum — and no field ever hitting its width |
| **Rich chemistry** | Multiple persistent structures with *different*, *repeatable* reaction behavior |
| **Catalysis** | A structure accelerates a reaction and **is regenerated afterward** |
| **Accumulation** | Newly formed structures enable further reactions that weren't available before |
| **Heredity** | A structure's *arrangement* is copied, with variation, so differential persistence has something to act on |
| **Robustness** | All of the above recur statistically across seeds and across nearby settings, not at one point |

**Heredity was added 2026-11-04 and is the one rung that depends on a law rather than on luck.**
Copying needs the pair force's maximum to sit **off** the diagonal: if a kind's best partner is
itself, a pocket grips copies of its own lining and templates *sameness*, which carries no
information. That is crystal growth, and it is what `gcd` measured at 100% of kinds. It also needs
two tiers of bond strength at once — a backbone strong enough to survive while the cross-pairing is
weak enough for heat to separate the copy — which the 0–8 range supplies and `gcd`, whose values are
1 for most pairs and spike on the diagonal, does not. Both are reasons law 2 changed form.

Stage one is the one to be ruthless about, because **an accounting hole disguises itself as a
discovery.** A structure exploiting a momentum or energy leak looks exactly like emergent
propulsion or emergent metabolism. Both of this project's known accounting bugs — the
momentum swap and the energy-versus-temperature comparison — were of precisely that kind and
were caught by reading rather than by running.

## Open questions

The register — everything undecided, in one place, in the order it has to be settled, each with
**what would decide it.** Most of these are not arguments to win. They are experiments to run.

### Must be settled before any code is written

**1. ~~What is the form of the pair force?~~ Settled 2026-11-04 — `B = 8 − |v(k₁) + v(k₂) − 8|`
with `v(k) = k mod 8`, rate-based formation, breaking at `e ≥ B · kind`.** This was the biggest hole in the project and is
now the version to build first. What remains open is only whether it has *depth*, which is item 5.
How it was settled, because the route matters more than the answer:

- **It is probably not a force.** Exclusion already repels at short range and gravity already
  gathers at long range, so the only job left is which pairs bond and how strongly — and bonding
  is neighbour-only, so distance isn't a variable. Law 2 becomes a **binding energy over two
  integers**, `B(k₁, k₂)`. That removes two search constants, and it dissolves the
  momentum-conservation constraint entirely, because a binding rule doesn't move anything.
- **Ten candidate forms have been screened, and four are already dead.** `screen.mjs` evaluates
  each one over all 65,025 pairs of kinds and reports the binding-energy spread, the family
  structure, the near-inert count and the spread of bonding degree. `gcd` was the prediction;
  **`B = a AND b` won** — wider energy spread, 41 families against 25, the widest degree spread
  of any form, and genuine zeros, so some pairs truly do not bond. Rejected without a single
  simulation: divisibility (216 of 255 kinds near-inert, which is a gas), two crystal-makers
  identifiable by a degree spread of 0.5, and the control. `HOW-WE-DECIDED.md` has the table.

- **And reading law 2 back on 2026-11-04 found four problems with all of the above.** The
  simplification **breaks the stated argument for catalysis**, which relied on law 2 being a force
  with a local energy landscape — a pure pair function has neither. (Catalysis itself survives; see
  the next point.) **Nothing says when a bond forms**, and the
  obvious default glues everything on first contact with no reaction rates at all. The breaking
  condition is stated in raw energy where law 5 was corrected to temperature. And **`a AND b`
  depends on base 2**, which no physical law should, and which the screen cannot see — so
  `min(gcd, 16)` is probably the better choice despite scoring lower *(superseded later the same day —
  the whole `gcd` family went, see the next point)*. `HOW-WE-DECIDED.md` weighs
  two candidate formation rules and lands on the simpler one:
  **bonding is rate-based, not instant on contact.**
- **And catalysis survives, by geometry rather than by force.** It was written up twice as deleted
  — first by losing its force-based justification, then by a claim that no pure pair function could
  ever have a selective catalyst. Both wrong. A **cluster with a pocket** binds two reactants next
  to each other and holds them in contact longer than chance would; the pocket is selective because
  of which kinds line it, and it comes out unchanged. That is how real enzymes work — a protein is
  atoms interacting pairwise, with no three-body term underneath. It is also **why formation must be
  rate-based**: if bonds formed on contact, holding things together would buy nothing.

- **And the last two problems closed on 2026-11-04, as one question.** Stating the breaking
  condition properly — temperature, not raw energy, so `e ≥ B · k` — exposed a ceiling from the
  field widths: energy was 11 bits, so a kind-255 primitive could never get hotter than 8, and **`B`
  had to be capped at 8** or heavy matter's bonds never break and it becomes permanently inert.
  *(At 16 bits the forced cap is 257, so as of 2026-11-04 the cap of 8 is a choice, not a ceiling.)*
  Capping at 8 is **structurally free for `gcd`** (measured: identical families, inert count and
  degree spread from a cap of 4 to no cap at all, because gcd's 90th percentile is already 6) and
  **fatal for `a AND b`**, which collapses to 255 isolated kinds because its structure all lives
  above the cap. So `a AND b` won the uncapped screen and lost on physics.

- **And then `gcd` lost too, later the same day, on two measurements the screen could not see.**
  Both are about the **shape** of the table rather than its spread, and both were added to
  `screen.mjs`. **Roughness**: fusion grows kinds by *addition* while `gcd` reads *multiplicative*
  structure, so changing a kind by one unit moves its binding energies by 92% of their own mean —
  mass 60 a super-bonder, mass 61 near-inert, and all 48 near-inert kinds the large primes, which
  are chemically identical to one another. Nothing accumulates on a landscape that rough. The
  complementary form measures 0.259 against gcd's 0.916. **Diagonal maximum**: `gcd(k, k) = k` is
  always the maximum, so **100% of kinds bond best with themselves** — a pocket then grips copies
  of its own lining, which is crystal growth, and sameness carries no information for accumulation
  to work on. Under the complementary form 75% of kinds bond best with something else.

*What is left:* **writing down what the chosen form predicts before the first run** — its families,
its near-inert kinds — because that structure appearing in the output is not a finding, it is
confirmation the code works. `node screen.mjs` prints it.

**2. ~~How does energy get into empty space?~~ Settled 2026-11-04 — as radiation, and the clock is
what makes it work.** Energy entering an empty hexagon becomes **a quantum in flight**: one unit,
one direction, one hexagon per step, absorbed by the first matter it meets. Six bits in the bond
field an empty hexagon never uses, and those six bits are **exact rather than a cap** — nothing can
collide, because a quantum arriving in a given direction and an emission into that slot can only
come from the one neighbour behind it, which is matter or vacuum but never both. It is the **fifth
structural fact**, not a sixth law.

*How the second-law objection closed, because the route is the interesting part.* Sight lines on
this lattice are **exactly reciprocal** — if *i* sees *j* then *j* sees *i* down the opposite
direction, since the cells in between are the same either way. Verified by brute force in
`radiate.mjs` at densities from 2% to 40%: zero violations. That makes net flow between any two
visible hexagons downhill for *any* emission rate that rises with temperature, with **no T⁴ and no
statistics** — stronger than our own universe, which only closes this hole on average.

And reciprocity has a second edge nobody predicted: under a **flat** clock it makes the net flow
**exactly zero between every pair**, so radiation would transport no heat in either direction at
all. The temperature-dependent clock is therefore not a patch on radiation — it is what makes
radiation a channel. That is also why our own universe has a Stefan–Boltzmann law.

**What it cost:** a declared third hexagon state, radiation going as T¹ rather than T⁴, and a new
hard constraint on the search space (below). **What it did not buy:** interior cooling. Measured —
cooling tracks surface over volume, so a sixteenfold blob sheds a tenth as fast. That is opacity,
it is correct physics, and it leaves item 11 the only candidate.

**3. ~~Unweighted momentum now, or the momentum field straight away?~~ Settled 2026-11-04 — option
(B), and three separate arguments landed on it.** Momentum is an integer vector on the hex axes,
speed is `p/k`, collisions resolve in Margolus blocks. What decided it:

- **It is the real formula.** `p = mv` is the definition of momentum, and a force does not move
  things, it *adds* momentum. Option (A) is a universe where momentum and velocity are the same
  quantity, which is only true if everything weighs the same.
- **(A) has no way to express a force, and that is where the phantom rule came from.** Gravity
  produces a direction *and* a strength. Under (A) the strength has nowhere to go — a primitive
  either steps or it does not, so twice the gravity does exactly what half does. The documents had
  papered over this with "the deflection rule", referenced four times and defined nowhere. (B)
  deletes the need for it: gravity adds to the vector. **A rule removed, not added.**
- **(A) has one speed, so it has no tail.** Chemistry runs on the rare fast particle that clears a
  barrier, and heating a mixture works by making that tail bigger. With every primitive at exactly
  one hexagon per tick there is no spread at all. (B) gives 255 distinct speeds — and the spread
  comes mostly from *mass*, not from the momentum range, which is why ±3 is enough. *(That last
  clause is **retracted** — it is true of speed and false of headroom, and the two were conflated.
  ±3 does give all 255 speeds; what it does not give is room for a force to change a momentum,
  which is item 16. See law 1 in `THE-LAWS.md`. Marked 2026-11-05; the argument above is otherwise
  left as it was made.)*

**The cost, measured rather than assumed.** Speed had to become a **rate** (one step every `k/|p|`
ticks) and not a distance, or (B) breaks at both ends: as sketched it left kind-255 matter moving
one hexagon in 85 ticks and let kind-1 matter travel three hexagons per tick, through the causal
limit. As a rate, nothing is frozen and nothing exceeds the limit. `momentum.mjs` has it.

**7. ~~Motion carries no energy, so is there thermal pressure?~~ Settled 2026-11-04 — kinetic
energy adopted at `S = 64`, and thermal pressure exists either way.** Motion now carries energy:
`KE(p, k) = floor(S · Q(p) / 2k)`, derived from `(p, k)` rather than stored, with a collision moving
whatever it changes by into or out of the heat field. Law 1 in `THE-LAWS.md` states it and gives the
window it was picked from. The record of the question follows.

A direction and an energy were
unrelated numbers here; moving was free. In our universe heat *is* motion, which is where thermal
expansion comes from.

**This was briefly marked "answered — impossible" on 2026-11-04 and that is retracted**; the test
behind it was rigged two ways, and the full account is in `HOW-WE-DECIDED.md`. Kinetic energy
**can** be represented: define it as a whole number rather than as the fraction `p²/2m`, and a
collision moves whatever it changes by into or out of the heat field. Measured at a scale factor of
128 — 16 legal outcomes per collision, 0.5% with none, motion converting to heat in 88% of
collisions and back in 83%, and **zero** energy gained over closed loops of collisions, so there is
no free-energy pump. Every kind from 1 to 255 got a usable amount and nothing overflowed the
11-bit field.

*(Those figures were at `±3` and 11 bits. **`momentum.mjs` was brought to the eight-byte widths on
2026-11-04** and re-measured at `S = 64`: **329.5** legal outcomes per collision, **0.0%** with
none, motion converting to heat in **99%** of collisions and back in **99%** — against 16.2, 0.5%,
88% and 83% before. **Dead collisions are gone entirely**, which is a real gain from the wider
momentum range and not just more resolution. The window was re-solved in the file too, by solving
both edges rather than scanning: **`S` from 2 to 291**, against **29 to 227** at four bytes. Its old
printed conclusion "the window is 64 to 128" was wrong on two counts — stale, and always a
coarse-scan artifact, since it probed only `{1, 16, 64, 128, 256}` and reported the bracket between
the lowest probe that worked and the lowest that overflowed. The no-pump result is unchanged and
holds by construction: 22,215 closed loops at `±3` and 184 at `±15`, worst gain zero at both. Check
9 now runs at both ranges on purpose — a random walk rarely closes among 721 vectors, so running it
at `±15` alone would have quietly gutted the check.)*

So this was a live design choice rather than a dead end, and it was taken. What it cost: a **scale
constant** in the search space — the seventh. **It turned out not to touch law 5 after all:** the
energy field holds heat only and `KE` is derived from `(p, k)`, so temperature stays `e / kind` on
heat alone and a fast cold primitive stays cold. Had the two shared one number, moving would have
made a thing radiate.

**Thermal pressure exists either way.** It comes from the clock — hot matter acts more often, so it
moves more often, so hot regions push into cold ones — and that route needs no kinetic energy at
all.
*Decided by:* whether the Lab shows any pressure response to temperature without it. **And a
constraint that came with the clock:** an uneven clock means collisions are initiated unevenly, so
whatever the movement rule is, exact momentum conservation has to survive being driven from one
side.

**4. ~~What does momentum do when primitives are bonded?~~ Settled 2026-11-04 — shared along
bonds, one hop per clock fire.** The two candidates were joint motion or no constraint at all, and
neither is the answer. **Joint motion is illegal**: flipping every direction in a cluster at once is
information crossing the cluster in a single tick, which breaks the causal limit. Momentum instead
propagates along bonds, equal and opposite, so clusters are **elastic** with a speed of sound
bounded by the causal limit for free, and inertia comes out proportional to **total kind** rather
than primitive count. Shearing then needs no new rule: a collision's kinetic-energy change goes to
heat, and if it pushes an endpoint over `e ≥ B · kind` the bond breaks — so a soft strike moves a
cluster and a hard one shatters it, with chemistry deciding which. Both original options are
special cases of the one rule.
*What it depends on:* **kinetic energy must be represented**, or nothing about how hard a strike was
can reach a bond and structures can only melt, never break — no fracture, no erosion, no mechanical
weathering. **Satisfied 2026-11-04 — adopted at `S = 64`; see item 7.** That is the real dependency;
the old note said law 2, from a movement rule that no longer exists. See law 1 in `THE-LAWS.md`.

**15. ~~The heavy-matter temperature fork.~~ Settled 2026-11-04 — the word went to eight bytes
and energy to 16 bits.** The heaviest kind now reaches temperature 257, which is **32×** its
strongest bond instead of exactly 1×, so melting, boiling and graded stability have somewhere to
happen at every mass. Ric's call, on the grounds that wide dynamic range is what makes it like our
world, and that the World renders on the PC and is only *viewed* on the phone — which removed the
constraint that had been holding the word at four bytes. The record of the problem follows.

Energy was 11 bits and temperature is `e/kind`, so a
kind-1 primitive has 2047 distinguishable temperatures and a kind-255 primitive has **8** — and a
`B=8` bond between two heavy primitives breaks only at `e ≥ 2040` out of a possible 2047. The cap
on `B` was *derived* from this ceiling and `screen.mjs` has printed it all along, but the
consequence was never written down until 2026-11-04: **heavy matter is close to permanently cold
and permanently bonded.** Melting, graded stability, phase behaviour and anything with a measurable
reaction rate therefore live among the light kinds only — which is a real cost to law 1, whose
conservation story exists to make heavy matter possible in the first place.

A fixed-width **total**-energy field, a temperature of `e/kind`, and a uniform temperature range
across kinds cannot all three hold; this world has the first two.

**Storing temperature instead was the obvious second option, and it is dead on arithmetic.**
Transport moves energy in integer units of 1. If the field holds `T` and `e = T · kind`, a hexagon
of kind `k` can only represent energies that are multiples of `k` — so a single arriving unit has
nowhere to go unless a remainder `r < kind` is stored as well, and `(T, r)` is the same information
as `e` at the same width. Measured in `budget.mjs`: the saving is **−1 bit** at every kind count
and temperature ceiling tried. Drop the remainder and the smallest energy change to a kind-255
primitive becomes 255 units, so heat arriving at heavy matter either rounds away or stalls, and
conservation is what pays for it. **So the fork is not three ways but two: reallocate inside four
bytes, or widen the word.**

**And there is a third option, which `AGENTS.md` rule 5 already named and this item missed on
first writing: widen the field.** "Widen energy to 16 bits and the cap becomes 257" — that is
`65535 / 255`, so heavy kinds go from 8 distinguishable temperatures to 257 and the problem
substantially dissolves, with no change to any law and no rounding to place. It does not fit four
bytes: kind 8 + energy 16 + momentum 6 + bonds 6 is **36 bits**. At **eight bytes** it fits with 28
to spare — enough to also widen momentum to ±15 (10 bits instead of 6) and settle item 16 in the
same move. The World's cost at 4096² goes from 67MB to 134MB, which a browser holds comfortably, and 8
bytes is still a single native texel (`RG32UI` or `RGBA16UI`), so the shader structure survives.

So the four-byte word is the thing to interrogate, not just the two definitions of energy. The
project's own rule says changing a width is a physics decision and never a convenience — **and
keeping a width that is constraining the physics, for convenience, is the same error in the other
direction.** A field width is currently what makes heavy matter inert.

**And enumerating the budget turned this from a dilemma into a menu.** Bonds are always 6 bits, so
the four-byte constraint was `kind + energy + 2 × momentum + 6 ≤ 32`, and the heaviest kind's
hottest reachable temperature is `energyMax / kinds`. Every allocation that fit in four bytes:

| kinds | energy max | momentum | hottest heavy kind |
|---|---|---|---|
| 255 | 2047 | ±3 | **8** — the four-byte layout until 2026-11-04, *one bit unused* |
| 255 | 4095 | ±3 | 16 |
| 127 | 2047 | ±7 | 16 |
| 127 | 8191 | ±3 | 64 |
| **63** | **4095** | **±7** | **65** |
| 63 | 16383 | ±3 | 260 |
| 31 | 8191 | ±7 | 264 |
| *255, at 8 bytes* | *65535* | *±15* | *257* |

Two things fell straight out. **First, the four-byte layout wasted a bit** — 8 + 11 + 6 + 6 is 31
of 32, and giving that bit to energy would have doubled heavy matter's range from 8 to 16 at no
cost whatsoever. A law was being constrained by a width while a bit sat unused. **Second, the kind count is nearly
free for law 2**: the complementary form is scale-invariant, measuring roughness 0.259 / 0.257 /
0.251 / 0.241 and 8 columns at 255 / 127 / 63 / 31 kinds, because the modulus sets the columns and
the kind count only sets how many members each column has. Dropping to 63 kinds thins the columns
from 32 members to 8 and changes nothing structural.

**And the right measure is headroom, not levels.** What matters is how many times its *own
strongest bond* the heaviest kind can be heated — `hottest / 8`. Below 1× its bonds never break at
all. Below about 2× there is no hot phase for heavy matter, only "bonded" and "just barely not".
Eight times is where melting, boiling and graded stability have somewhere to happen:

| kinds | energy bits | momentum | headroom | speeds | |
|---|---|---|---|---|---|
| 255 | 11 | ±3 | **1×** | 255 | today — bonds break at the last representable value |
| 255 | 12 | ±3 | 2× | 255 | the free spare bit; still thin |
| 255 | 14 | ±1 | 8× | 255 | **but ±1 is option (A)**, the direction law 1 rejected |
| 255 | 10 | ±7 | 0.5× | 255 | heavy bonds unbreakable |
| **127** | **13** | **±3** | **8×** | **127** | |
| 63 | 12 | ±7 | 8.1× | 63 | |
| 63 | 14 | ±3 | 32.5× | 63 | |
| *255, 8 bytes* | *16* | *±15* | *32×* | *255* | *all three, at twice the bandwidth* |

**So: pick two.** At four bytes you can have any two of **255 kinds**, **real thermal headroom for
heavy matter**, and **a momentum vector with room to push** — never all three. The row that keeps
255 kinds and 8× headroom leaves four bits of momentum, which is ±1, which is the unweighted
direction option (A) that law 1 replaced for good reasons. That is the actual shape of this
decision, and it was invisible until the budget was enumerated.

**Recommended: 127 kinds, energy 13 bits, momentum ±3, bonds 6 — exactly 32 bits.** It fixes the
problem that was *measured* — heavy matter inert — and changes nothing else. Momentum stays at ±3,
so no claim about motion moves and the orbit question (item 16) stays genuinely open instead of
being pre-empted by a guess. **Buying momentum headroom now would be speculative**: nobody has run
the orbit test, so nobody knows whether ±3 was the culprit, and 63 kinds is a steep price for a
hypothesis. If the test later says width was the cause, the 63/±7 row is still there to move to.

The cost is 127 kinds and 127 speeds instead of 255, and one consequence that has to be recorded:
**`B`'s forced cap rises from 8 to 64, so the cap of 8 stops being an artifact of a width and
becomes a choice.** Defensible, since `k mod 8` produces 0–8 naturally — but a constant moves from
*forced* to *searchable*, and the search space entry says so.

***Superseded 2026-11-04 — never applied.*** The eight-byte word landed the same day and keeps 255
kinds *while* buying the headroom, so the 127-kind cost was never paid. What survives from this
entry is the method: enumerating the budget is what made the trilemma visible, and the trilemma is
what made eight bytes obvious. The sweep it called for — roughly eighty numbers across nine files,
`255`, `2047`, `11 bits`, `65,025 pairs`, `255 distinct speeds`, the `38-fold` spread — still
applies to the change that *did* land, and **that one went in piecemeal**: stale four-byte
references survived in this file, `THE-LAWS.md` and `AGENTS.md`, and were corrected separately. How rich the mass axis should be is also a judgement rather than a
measurement: 127 kinds over 8 valence columns is 16 members each, which is a legible periodic table,
but nothing measures whether 255 would have been better.
*Decided by:* settled by judgement rather than measurement — wide dynamic range, and the World
rendering on the PC. Both measurements that could have decided it are still unrun: whether the Lab's
table goes empty above some kind, and whether 8 bytes measurably hurts the World. The second is now a
cost already accepted rather than an open question.

**16. ~~Did momentum clipping defeat the orbits, or did the dimension?~~ Settled 2026-11-05 —
neither, and not integer momentum either. Things orbit.** The question had three answers on offer,
the measured one was not among them, and the first measured answer was wrong too. `orbit.mjs`, as
it now stands:

- **The control orbits, 6 of 6**, for ten laps. It reported zero twice before it was right: the
  start velocity was 60° off perpendicular (`[0,-1,1]` *looks* tangential and is not), and the
  orbiter was light enough that law 1's one-hexagon-per-tick cap clipped its speed. Both are in the
  file.
- **Direction quantization is not the cause.** Switched on by itself it orbits **6 of 6** — a
  visible zigzag, the radius wobbling by about a third, ten laps every time. The documents' old
  reason, that a primitive's path cannot curve on six directions, **is false.**
- **Integer momentum is not the cause either.** With the sub-unit pull **carried**, it orbits at
  ±15 at radii 20, 100 and 500, with the lattice on or off; the range sweep orbits from **±7 up**.
  Only ±3 fails, because half of ±3 is a momentum of about 1. For one day this bullet said "0 of 6
  with integer momentum… the integerisation itself" — every run had started on the **edge of the
  momentum box**, where the hexagon-shaped legal set shaves `|p|` at some headings and not others
  (Check 5).
- **What does decide it is two unwritten rules.** A pull under one unit, **rounded**, never acts:
  0 of 6 at every radius and range up to ±127 (item 19). And a step that ties between two directions,
  broken the same way every time, is a handedness that spirals every orbit inward — each of the
  three falls in within four laps (Check 9, item 21). Carry the pull and flip a coin on ties and orbits hold.

**What they are like** is in law 1 of `THE-LAWS.md`: eccentric, not permanent — the closest approach
random-walks lap to lap — and at a strength law 3 allows, only for the heaviest kinds around the
largest clumps (Check 8, item 20).

**And the harness lesson, the fourth in this file.** Four bugs, and the first three all pushed toward
"no orbits", the conclusion being tested. The fourth pushed the other way: a two-lap bar called a
spiral an orbit, and Check 1's "3 of 6" was spirals until the bar went to ten laps and every run
reported its closest approach on its first lap and its last.

**It also found an unwritten rule, which is the more useful half.** Law 3 says gravity falls off as
1/r² and adds to momentum. It does not say **what happens when the pull is smaller than one unit**,
and at every radius and range tested it is — between 0.00007 and 0.044 units per tick. Rounding it
switches gravity off below half a unit, which looked like a cutoff radius nobody chose — and at any
strength law 3 allows it is worse than that, gravity off everywhere (item 19). Carrying the remainder needs a per-primitive residual, which is a stored
field: the 24 spare bits exist, and `AGENTS.md` rule 5 says nothing goes in them without an entry in
`THE-LAWS.md` and a reason. **That is item 19.**

*And the old numbers were never reproducible.* "Nothing completed two laps at radii of 20, 100 or
500" cited a tool that did not exist; `orbit.mjs` is the first orbit code in this project. Two
conclusions rested on it and both are withdrawn — see item 14.

**17. What should law 2's modulus be, now that nothing forces it?** At 16 bits of energy the forced
cap on `B` is **257**, so the modulus of 8 stopped being an artifact of a field width on the same
day it stopped being load-bearing. **It is not a problem, and the first version of this item made it look like one.**

*(Retracted within hours of being written, 2026-11-04. This item said "wider is measurably better
on both metrics that killed `gcd`" and tabulated roughness falling from 0.259 at modulus 8 to 0.121
at 18. **Those numbers are real and the comparison is invalid.** Both metrics fall as `1/m` for
arithmetic reasons: roughness divides a fixed one-valence-unit step by a mean `B` that grows with
the modulus. Multiply either by the modulus and it goes flat — `roughness × m` sits at 2.05–2.18
and `selfBest × m` at ~1.98 across moduli 6 to 32, while the mean absolute step stays at ~1.4
throughout. Measured in `screen.mjs`.*

*So the metrics are valid for comparing **forms at the same `B` range**, which is what killed `gcd`
— `min(gcd,8)` and the complementary form both produce 0–8, and there the 0.916-against-0.259 gap
is a real difference in shape. They say nothing about which modulus to pick. This is `AGENTS.md`
rule 12's fourth lesson landing on the person who wrote the metric: check what the measurement
assumed before believing what it says.)*

**What is actually traded, with no measurement on either side yet.** A larger modulus gives finer
**gradation** — one unit of mass moves a bond by 1 of `m` rather than 1 of 8, so chemistry changes
more smoothly along the mass axis. A smaller one gives larger **families** — a column holds `255/m`
members that behave identically, and a periodic table with no families is not a table. At modulus =
kind count every kind is its own column and the structure is gone entirely. Reality's long periods
are 18, which is suggestive and is not evidence.

**So the modulus stays at 8.** It works, it is written down, chemistry exists under it, and it is
now a **searched constant** rather than a derived one — which is ordinary, since searching constants
is what the Lab is for.
*Decided by:* a sweep that scores gradation against family size, rather than one that rediscovers
`1/m`. Low urgency, and nothing is blocked on it.

**18. ~~May a bonded primitive fuse?~~ Not a question — there is no fusion.** *(Raised and
withdrawn on 2026-11-04, within minutes, after Ric asked whether it was a real hole before changing
anything. It was not.)* `B` is recomputed from the two kinds rather than stored, so it is stable
only while the kinds are — and **nothing in this world changes a primitive's kind.** Fusion is in
*Roads not taken*; law 1's `1 + 1 → 2` is a bookkeeping choice made so that road stays open, not a
mechanism that exists. The hole requires a feature the design does not have, so it is a
**precondition on the fusion road** and is recorded there instead.

**What the check did turn up, and this one is real: kind is immutable, and the kind distribution is
therefore an initial condition.** Nothing stated that out loud. Two consequences worth holding:

- **Law 1's prose over-claims.** It says heavy primitives are rare "since making one requires
  merging", and that the periodic table gets a reason to be structured — "light kinds common and
  everywhere, heavy kinds only where matter got crushed hard enough to make them." Nothing crushes
  anything into anything. With kind immutable, the distribution of kinds at the end is the
  distribution you seeded, everywhere, forever. That sentence describes the fusion road.
- **The tension with law 3 is real but small, and the project already answers it.** Law 3 earns
  its cost by making "the only initial condition becomes **matter, spread out** — barely a decision
  at all", and with kind immutable you must *also* seed a spread of kinds, since an all-kind-1
  start has one species and no chemistry. *(First written here as a collision with law 3's best
  argument. That was too strong.)* **`THE-LAWS.md` already declares this floor**, in *What reality
  has that this doesn't*: we "assume primitives exist rather than deriving them: that is where this
  physics stops asking why." A seeded distribution is that assumption made concrete, not a
  violation of it. And the never-written list asks for an emergent **cluster** chemistry — "which
  kinds form stable clusters, which are inert, which are promiscuous" — never an emergent primitive
  inventory. So nothing is broken. Law 3's sentence now says the only initial condition **for
  energy** is matter spread out, which is all gravity was bought for.

*Decided by:* nothing, as of the correction above — the floor is declared and consistent. What
remains is a **choice**: seed uniform random over 1–255 and accept that the population is given, or
take the fusion road, which is the only candidate that would let the distribution grow itself. Not
blocking either way, and worth deciding knowingly rather than discovering in the output.

**19. What does law 3 do when the pull is smaller than one unit of momentum?** *(Measured
2026-11-05, see the end of this item: it is stored, 32 bits a component, in a second array.
**Recommended, not adopted**, and that call is Ric's.)* Raised 2026-11-05 by
`orbit.mjs`, which could not run without answering it. Law 3 says gravity falls off as 1/r² and adds
to momentum; momentum is an integer; **nothing says what happens to the fraction**, and at every
radius and range that tool tested the whole pull *is* a fraction — 0.00007 to 0.044 units per tick.
That is not a corner case, it is the normal case at any distance.

Two rules are available and they are different physics, not different implementations:

- **Round it.** Below half a unit gravity does nothing at all, so there is a **cutoff radius beyond
  which gravity is simply off.** Nobody chose that radius; it falls out of a field width, exactly
  the way law 2's cap of 8 fell out of the energy width. `AGENTS.md` rule 5 is about precisely this,
  and says a width that silently picks a physics constant is the dangerous case because it looks
  like a derivation.
- **Carry the remainder** in a per-primitive residual and spend it in whole units. The impulse is
  then exact in the long run but arrives in lumps. It **needs a new stored field**: the 24 spare
  bits can hold it, and rule 5 says nothing goes in them without an entry in `THE-LAWS.md` and a
  reason. It also sits uncomfortably close to the never-store list, being state that exists only to
  patch a representation.

*Decided by:* a sweep over both rules. **This blocks writing law 3's solver** — gravity cannot be
coded without picking one, and picking one silently is how two constants have already been chosen
by accident here.

**Half settled 2026-11-05: rounding is out.** It is not a cutoff radius at a strength law 3 allows;
it is gravity off everywhere. The strongest pull in the World is on a kind-255 primitive at the rim
of a packed clump, and it reaches half a unit per tick only when ε (item 20) is **3.2** for the
whole World as one ball, 4.3 for a clump of radius 256 and 64 for two neighbours — gravity three to
sixty times stronger than the weakest bond, which law 3's ceiling forbids outright (`orbit.mjs`
Check 7). So law 3 carries the remainder. **What is still open is where it lives** — a residual in
the spare bits needs its entry in `THE-LAWS.md` and a reason, and is Ric's call. One thing to weigh:
at a legal strength the residual is the *whole* of gravity for almost every primitive almost every
tick, so it is not patching a representation at the margin; it is where the law lives.

**Measured 2026-11-05: where it can live** (`orbit.mjs` Checks 11 and 12). A residual is an
integer register, so it has a grain of its own, and a pull under half that grain is rounded away,
which is Check 7's failure again at a finer scale. So the question was first which home is
*fine enough*. Three homes were measured:

| home | stored | grain | at a legal ε | Check 8's heavy orbits, of 18 |
|---|---|---|---|---|
| exact carry, no grain (the reference) | — | 0 | — | 9 |
| **the spare bits**, 12 a component | 24 bits | 2⁻¹¹ | off for almost every pull | 3, none at ε = 0.01 |
| **a second array**, 32 a component | 64 bits | 2⁻³¹ | fine everywhere | 9, the same runs |
| **the coin**: draw the kick, store nothing | none | 2⁻³² | fine everywhere | **0** |

- **The spare bits are too coarse.** Legal pulls run from about 10⁻⁴ down to 10⁻⁹ a tick, and
  2⁻¹¹ is 0.0005. A residual there switches gravity off for all but the heaviest kinds in the
  deepest places, and where gravity does act its falloff comes in steps. No packing trick
  closes a gap of about 20 bits.
- **The coin is exact on average and wrong in its spread.** A whole kick drawn with probability f
  per tick is shot noise: a pull owed N units arrives as N ± √N. Over one lap of the best legal
  orbit that is 31 ± 5 units against a momentum of 4.9, so the orbit is gone inside a lap. A
  ±127 box at |p| ≈ 64 still lost two seeds of three. Worse, **spread is heat**. It adds to p²
  on anything coasting while the pull does no net work, so the coin is a heater that runs
  wherever there is gravity. That breaks the World's invariant that energy rises only through
  collapse, and the heat would look exactly like the collapse heating law 3 exists for, which
  is the hole `AGENTS.md` rule 6 warns about. It was the tempting option: no storage, and it
  matches the step tie-break of item 21. It is rejected on the measurement.
- **A second array of 32 bits a component** orbits exactly where grainless carry does, row for row
  and seed for seed. Its grain loses at most one unit of momentum in about four billion ticks.
  It only becomes a visible share of the pull for the lightest kinds thousands of hexagons from
  a small clump, where the pull is nearly nothing anyway.

**The recommendation**: law 3's remainder is **gravity's own state, in a second array beside the
eight-byte word**. That is 8 bytes a hexagon, two signed 32-bit components, and it moves with its
primitive when the primitive steps. It is the same kind of thing as the screened field's φ, which
already needs a second array (law 3, *Gravity can be made local*). It does not go in the spare bits,
which stay reserved. The cost is memory: at 4096², double-buffered, 268 MB becomes 537 MB, which
the 4 GB card holds. The bigger World of item 20 doubles with it.

**Two things it carries with it, if adopted.** The undelivered impulse is momentum, so
**`world momentum + wall momentum + Σ residual = constant`** is the assertion (`AGENTS.md`
rule 6). Leave the residual out and its fluctuation reads as a leak. The solver also has to give
each pair's pull, rounded once to the grain, to both sides with opposite signs, so the sum
is exact in grain units. **Still unmeasured:** what a residual does when its primitive bonds
(law 1 shares momentum along bonds; the residual presumably follows). Also unmeasured: whether
whole kicks delivered to matter *resting* on matter make heat with no fall. That hazard comes
from integer momentum, not from where the remainder lives, so it applies to every home.

**20. How strong is gravity — and is there any strength that does both its jobs?** Raised
2026-11-05 by Ric: *"I have a hunch gravity is too strong right now."* Measured in `orbit.mjs`
Checks 6 and 7; the full statement is under law 3 in `THE-LAWS.md`.

Gravity has never had a value. In the unit **ε** — the energy two kind-255 primitives release falling
into contact, over the weakest bond — it has a **ceiling** from the constraint above (ε ≪ 1: 0.01 for
two orders of magnitude) and a **floor** nobody wrote down: collapse has to heat something past the
weakest bond, or nothing ever reacts. At 4096² **the floor is above the ceiling.** At ε = 0.01 the
whole World collapsed into one ball reaches a tenth of the weakest bond; clumps of a few hundred
hexagons need ε near 1. The floor falls as 1/(clump radius), so the World's size is what is short.

**The hunch, checked.** The orbits `orbit.mjs` ran were set up at ε of 565 to 14,000 if the centre
is one primitive — far too strong, and never checked. But the plan as a whole cannot go weaker,
because the floor is already above the ceiling: the problem is not that gravity is too strong, it is
that one number is asked to be weak at arm's length and strong summed over a clump, and 4096² is not
enough clump.

*Decided by:* Ric. The levers, with what each costs, are in `THE-LAWS.md`: a bigger World, a looser
ceiling (gravity within one order of the weakest bond, accepting a little location-dependent
chemistry), a different exponent (unmeasured), or heat given at the start (which gives up law 3's
reason for existing). **This sharpens item 13** — it asked whether 4096² has the range for a
hierarchy of clumps, and the answer at ε = 0.01 is that it does not have the range for one.

**Ric leans toward a bigger World** (2026-11-05: *"I like the idea of a bigger world. I mean if you
think of each of the hexagons being so small that it's the size of an atom then we would need
billions for gravity to mean anything."*). `orbit.mjs` Check 10 says his figure is the measured
one. At ε = 0.01 a single clump that melts its weakest bond is radius ~16,500 — **about a billion
hexagons** — and a World with room for ten is ten billion, 160 GB double-buffered; at ε = 0.1 the
same clump is ten million and ten of them is roughly today's World. **And it forces a second
decision.** The infall speed at the rim of a clump that reaches temperature T depends on T alone —
not on ε, not on size — and at T = 1 it is faster than any kind above 110 can carry inside ±15
(81% of the seeded mass; at T = 8, kinds above 39 and 98%). The symmetric clamp declines the rest of
the pull, so that energy never becomes heat. A bigger World only pays off if momentum widens with
it: ±63 (14 bits) lets every kind carry the fall that melts the weakest bond, ±127 (16 bits) the
strongest, both inside the 24 spare bits — and either moves law 1's kinetic-energy window, so
`S = 64` would need re-measuring. **Not adopted**: the size, ε and the momentum width are one
decision now, and none of the three is set.

**The direction is set: a hierarchy shaped like ours.** *(Ric, 2026-11-05: "I kinda want it
similar to the universe I'm in. At least by ratio I feel like that's the most likely to cause
emergence and not stagnation.")* Our ratio itself is out of reach — in two dimensions a clump's
hexagon count grows as 1/ε², so 10⁻³⁶ would need some 10⁷⁷ per clump against a World of 10⁷. So
"like ours" means **the same direction, as far as the hardware allows, judged by what the ratio
buys rather than by the ratio**. Four separations, each a number a run can report:

1. **Chemistry ignores gravity locally** — ε itself; which reactions run must not depend on where.
2. **Structures are large against their parts** — primitives per clump; a big stage for chemistry.
3. **There are many structures** — clumps per World; *elsewhere*, the reason 1/r² was chosen.
4. **Timescales are far apart** — a clump's lifetime against a reaction's. Collapse must be slow
   next to chemistry, or nothing has time to build. Easiest to forget, and probably the one that
   decides stagnation.

**And Ric's hunch is a hypothesis, so it gets tested rather than assumed.** Run the World at the
smallest ε that fits — 10⁻¹, 10⁻², further if a machine allows — and look at whether emergence
climbs as the separations grow. If it does, more like ours is better, and that is evidence for his
hunch. If it peaks at a modest gap, that is a finding: in this physics, life does not need our
extreme. Either result is worth having, and it is also a measurement of the fine-tuning half of
the anthropic question above. **What is settled is the direction and the four yardsticks; ε, the
size and the momentum width stay open** until the Lab is running and this can be measured.

**21. ~~What does a step do when two directions tie?~~** Raised 2026-11-05 by `orbit.mjs` Check 9.
Law 1 rounds a step to the nearest of six directions and never said what happens when two are
exactly as near — which an integer vector is on 2 to 4 percent of an orbit's steps. Always taking
the same one is a handedness, and it spirals every orbit into the centre within a few laps; a fair
coin does not. **Settled 2026-11-05: a coin** (Ric: *"the coin flip is definitely the way to go"*),
from the draws the World already makes, stated in law 1 of `THE-LAWS.md`. The other fair rule,
alternation, was passed over because it needs a stored bit per primitive. It touches every movement
path, so the Lab's movement rule is written with it.

**22. What shape is the World?** Raised 2026-11-05 with the Lab's loop. The Lab is a hexagonal
torus (`THE-LAWS.md`, the hexagonal grid). The World could be one too — it is the most natural
choice, and our own universe may be a loop: a flat universe can be finite with no edge, and the
Planck satellite's search for the repeating circles that would show it found none smaller than the
visible universe, which limits the loop's size without ruling it out. But three things ride on it:
**the heat sink** (law 5's radiation leaves at the boundary; with none, the World fills with its
own light and evens out — in reality, expansion is what takes the heat away, so this ties to the
expanding world in *Roads not taken*); **down** (the World is described as a slice with a ground
for dense matter to settle on; looping only left–right keeps a floor and a ceiling, looping both
ways removes them); and **gravity across the seam** (a pairwise 1/r² sum has to count every copy of
the world; the screened local field in item 12 handles a loop with no extra work). *Decided by:*
not before the Lab, and together with item 20 — size, gravity's strength and shape are now one
choice.

**Direction, provisional\*: a looped World that grows, then stops.** *(Ric, 2026-11-05: "I think
for this thing a finite life is going to be the option but I think expansion will be the answer but
we will put a size limit on the world. Start with the world being smaller and slowly growing until
it maxes out at a certain size that would be too hard for my computer to run." Then, choosing
between the rules below: "Let's do yours.")* Three rules, each modelled on what expansion does in
reality, with the research behind them in `HOW-WE-DECIDED.md`:

1. **New space appears along a line that no bond crosses.** A new line of empty hexagons runs all
   the way round the loop, between two existing lines, wherever nothing on one side is bonded to
   anything on the other. Its neighbours may be empty or may hold unbonded matter — two unbonded
   primitives that were touching end up a hexagon apart, which is a gap opening in a gas. **Bound
   matter is never split**, because reality is all-or-nothing about this: tightly bound things keep
   their size and only unbound things follow the expansion (Price & Romano). Lines go in **threes**,
   so each side stays a multiple of 3 for the collision blocks; growth **alternates** between the
   lattice's directions so the loop stays near the same length every way; and **where** is drawn at
   random among the eligible places, so the World grows everywhere on average. Inserting a line
   looks non-local in memory and is not in the physics: the only thing that changes is that the
   hexagons either side of it stop being neighbours.
2. **Growth drains energy from what is not bound.** As the World grows, light in flight and the
   motion of free (unbonded) primitives lose energy in proportion — whole units removed by chance,
   matching the growth on average — into a counted **expansion loss**. Heat held in matter is not
   drained. That is the cold, dark sky a loop with no edge was missing, and it is how reality does
   it: light redshifts and free motion slows as space stretches. The invariant becomes
   `world energy + in flight + expansion loss = constant` (plus the thermostat terms where there
   is one), so the bug detector survives — energy is genuinely not conserved in an expanding
   universe, and the counter is the honest way to say so.
3. **The rate follows the World, not a clock, and stops at the hardware.** Fast while the World is
   hot and dense, slowing as it cools — the way our universe's rate is set by what it contains —
   and capped at the largest size Ric's computer runs, **measured by benchmark, not guessed.** After
   the cap the drain stops, and the World lives out a finite life.

**Not adopted yet, and it is law 6 if it is**, so `AGENTS.md` rule 7's written reason applies; the
reason is the loop itself — with no edge, nothing else takes heat away. Open inside it: the exact
drain (which quanta, which speeds, how a chance removal stays fair), the rate formula, and the
starting state, since a small dense World is a hot, dense beginning and law 3 has so far said the
only starting condition for energy is matter spread out. **A variant passed over:** prefer the
emptiest eligible lines, so space appears mostly in vacuum. Kept here because it may be worth a
comparison run. **A control to run:** the fixed-grid version every cosmology code uses — the same
hexagons with a scale factor saying how far apart they are — which costs full size from the start
but is simpler; if the two Worlds differ wildly, one has a bug or the difference is a finding.

\* *Provisional: written 2026-11-05 for Ric to check. Remove the asterisk when he has.*

### Settled by running the Lab

**5. Does the Lab produce a periodic table with any depth?** Unknown. Three stable clusters and
nothing else is a plausible outcome, and would mean the pair force needs more structure.

**6. Should capacity vary by kind?** `C` is one global number, so every kind has identical
capacity. **Law 4's claim to be the origin of distinct types is now retracted outright rather than
called overstated** — with a global `C` it contributes *nothing* to differentiation, and all of it
comes from law 2, which since 2026-11-04 carries the columns itself in `v(k) = k mod 8`. What law 4
does do is stop a never-saturating attraction collapsing everything into one blob, which is
load-bearing but is a different job than the one it was credited with. So this is no longer a
question about whether chemistry exists; it is a question about how much structure one law should
hold.
*Decided by:* whether `v(k)` alone produces depth. If the table comes out flat, vary this next.

**8. Does the floor bounce or absorb?** Both conserve momentum once the wall counter exists.
Bouncing keeps motion circulating through the dense regions; absorbing lets matter settle, and
sedimentation is one of the two candidate ratchets. **No longer a Lab question** — the Lab loops
and has no floor (2026-11-05). It stays open for the World only if the World keeps one (item 22).

### Open for the whole project

**9. What is the ratchet here?** The missing piece in all prior work is a reason the world cannot
retreat. Candidates: compound formation (you must pay back binding energy to undo it), and
sedimentation (burial is irreversible, and it gives the world *history* — a state depending on a
particular sequence of accidents that got frozen in). Hutton found compartmentalization was what
rescued his chemistry from parasite collapse, which is exactly what real life invented at the same
juncture.

**10. Can anything climb past rung two?** The ladder is convection → chemical oscillator →
autocatalytic cycle → compartment → replicator. Prior art reaches replicators from a random soup
(Hutton 2002; BFF 2024), but nothing has produced *cumulative* novelty afterward — BFF cycles
forever: takeover, stagnation, degradation, a new takeover.

**11. Does something have to stop gravity, and is it law 6?** Gravity never cancels, and this
world's orbits are too few to halt collapse — at a legal strength only the heaviest kinds orbit, only
around the largest clumps, and not for good (item 16) — so a static World plausibly ends as a single
clump, the end of *elsewhere*. *(Said "has no orbits" until 2026-11-05.)* **Item 20 cuts the other
way:** at the strength law 3's ceiling allows, collapse may be too slow and too cold to need
stopping at all. Two candidates in *Roads not taken*: true expansion with the loss counted, or
gravity weakening as the world cools. The second keeps strict conservation and is the one to try.
*Decided by:* not before the Lab. Adding law 6 before law 2 works would be choosing wallpaper before
there is a foundation.

**12. ~~Can gravity ever become local?~~ Settled as a candidate 2026-11-04 — yes, as a screened
field.** The old local candidate — matter slightly more likely to step toward wherever there is
more matter — fails for diffuse clouds with no local gradient to follow, and that still stands. But
it was trying to approximate the **sum**, and the sum is the wrong object: `∇²φ = ρ` is already a
local equation, relaxed by repeated neighbour-averaging, with the force read off as the gradient
between neighbours. On a 2D lattice that gives 1/r and the single global collapse this project
rejected, so take the screened form `∇²φ − m²φ = ρ` — still local, still relaxable, and decaying
like `e^(−mr)`, which is *faster* than 1/r² and therefore better at the "create elsewhere" job 1/r²
was chosen for. The screening length `m⁻¹` becomes the knob for how large an independent region is.
Costs one extra field per hexagon, outside the four bytes.
*Decided by:* a Lab comparison — does a screened field cluster matter the way the 1/r² sum does?

**13. Does 4096² have the range for gravity to build a hierarchy?** *(This item gained a second,
unrelated face on 2026-11-04: the temperature-proportional clock needs a 2047:1 spread in update
rates, so the World's coldest matter updates once in 2047 ticks. Same question — dynamic range — from a
different direction. **That half is largely relieved as of 2026-11-04**: the second law only needs
the clock rate to be strictly increasing and unsaturated, not to start from zero, so a floor in
`rate(T) = floor + c · T` buys a 16:1 spread instead of 2047:1 at the cost of transport speed
rather than correctness. See the clock in `THE-LAWS.md`.)* Our universe's structure spans
dust, planets, stars, clusters, galaxies, clusters of those. Four thousand hexagons across is three
or four orders of magnitude in total — ample for several separate clumps, and nowhere near enough
for clumps *of* clumps, which is where reality's interesting structure lives. If one level of
clumping is all this size permits, law 3 pays its full cost as the only non-local law for less than
its argument assumes.

*(2026-11-05: item 20 puts a number on this from the energy side, and it is harsher. The heat a clump
can make grows with its radius, and at the strength law 3's ceiling allows, even the whole World as
one clump does not heat anything past its weakest bond. So the question is no longer whether 4096²
has room for clumps of clumps; at ε = 0.01 it does not have room for one clump that matters.)*

**14. 2D is topologically poor, and that one is permanent — but it is one claim now, not two.**
*(2026-11-05: the absence of orbits was filed on this list as a second instance of the same
coarseness. It has been withdrawn — `orbit.mjs` shows the hexagon orbits fine and the cause is
integer momentum, which is not a fact about two dimensions at all. What remains below is the
original claim, which never depended on orbits and still stands.)* Enclosure is total — a closed loop
completely separates inside from outside, with no "mostly sealed." Since compartments are the
ratchet we care about most, membranes here are all-or-nothing rather than a matter of degree. Not
a decision; a limitation to design around.

## Roads not taken

**Reversible microphysics.** Fully reversible "conservative logic" models have much cleaner
analogues of heat and entropy, and would give a genuine arrow of time from statistics alone
— the most principled version of all of this. Also substantially harder to design and slower
to run.

**Symmetries instead of conservation.** In our universe laws of conservation aren't laws at
all: Noether's theorem derives them from symmetries (momentum from space being the same
everywhere, energy from time being the same at all times). So there is a level below where
law 1 stops, and writing symmetries would earn it for free. The payoff is elegance rather
than capability, and it is much harder to implement correctly.

**Gravitational time dilation.** Real, and in our universe causally irrelevant to life
(parts per billion at Earth's surface). Dense regions here already run at different rates
than sparse ones, because compression makes heat and heat speeds reactions — opposite sign
from relativity, same structural consequence, free. If true clock dilation ever goes in, it
goes in as *clock rate*, never as a scaled timestep, so integer conservation survives.

**A fusion analogue.** A second, much larger energy budget unlocked only under extreme
compression. Would stretch the world's arc enormously and give it real acts: collapse,
ignition, long burn, exhaustion, cold. Law 1 was specifically restated in terms of the sum
of kinds so that this stays possible — counting primitives would have forbidden it.

*Two preconditions, if it is ever taken.* First, **it would make kind mutable, and `B` is
recomputed from the two kinds rather than stored.** So a bonded primitive whose kind changes would
break its bond at a different `B` than it formed at, and the difference is energy created or
destroyed — silently, with no law violated, exactly the failure the *bond energy accounting is
exact* structural fact warns about. The fix is to break every bond on the changing primitive first,
paying each one's `B` at the **pre-change** kinds, then fuse: that makes fusion cost its bonds, so
tightly-bonded matter resists it, which is probably a feature. Second, **it is also what would make
the periodic table populate itself** rather than be seeded — see item 18, where the absence of any
kind-changing mechanism turns the kind distribution into an initial condition. That makes this road
less purely additive than this entry reads: it is the only candidate that would let law 3 keep its
claim that the only initial condition is matter, spread out.

**Spontaneous decay.** Slow transformation independent of local conditions — a source of
novelty that doesn't depend on surroundings, plus a long-term heat source. Radioactive decay
in Earth's interior is a serious part of why plate tectonics is *still running* four billion
years in. Late eras here may need something like it to stay interesting.

**An expanding world.** Ric's, 2026-11-03, and the most promising thing on this list. Reality's
global energy conservation fails *because* the universe expands, so the obvious question is what
happens if ours does too.

*(\*Provisionally superseded 2026-11-05 — item 22. The paragraph below rejected a growing grid; the
version now proposed is one, because inserting a line where no bond crosses touches no bond, adds
no seam to the lattice, and growing memory is the point — start small, stop at the hardware. The
old reasoning is kept, because it was right about inserting hexagons anywhere.)*

*The mechanism would not be a growing grid.* Inserting hexagons breaks the six-bit bond field,
puts seams in the lattice, and multiplies memory. It would be a single global **scale factor** —
the same hexagons, with the distance between them growing — which is also far closer to what
real expansion actually is. Gravity then weakens as 1/a², the pair force's reach in lattice
units shrinks, and nothing in the ontology changes at all.

*What it would buy — corrected, because the first version of this entry oversold it.* The
cooling argument is conditional, not decisive. Whether a static world can cool its interior
depends entirely on **which of law 5's three vacuum options gets chosen**, and that is still
open. If vacuum always takes energy and holds none, then every empty hexagon is a sink, cooling
is fast everywhere, and there is no heating problem for expansion to solve — if anything the
world would cool too fast. If vacuum holds energy and diffuses it onward, cooling works but
slowly. Only under the boundary-only option is the interior genuinely stuck. So expansion is
*one* fix for a problem that may not exist, and it should not be adopted on those grounds.

**The argument that survives is collapse.** Gravity never cancels and only ever adds, so a
finite static world plausibly ends as a single clump — one set of conditions, one experiment,
and the end of *elsewhere*, which is the property locality exists to create and the reason
1/r² was chosen over 1/r. Weakening gravity over time lets collapse halt partway and leaves
many separated structures standing. That holds whatever happens to the vacuum question, and it
is the real case for this.

*And collapse is a worse problem here than in reality — though not for the reason first written
here.* In our universe most collapse never finishes: things **orbit.** Angular momentum carries
the Earth past the Sun instead of into it, and that, not expansion, is what halts gravity at
planetary and stellar scales.

Ric's objection, 2026-11-03: angular momentum is real, so something moving sideways past a mass
should curve past rather than fall straight in. The premise is correct, and the first version of
this entry blamed the wrong thing — **the old unweighted momentum of option (A) was not what
prevented orbits.** A
large clump absorbing momentum one unit at a time would jitter internally while its centre
stayed put, which is close enough to "the Sun barely moves."

**Orbits do exist here, and they are too few to halt collapse.** *(Rewritten 2026-11-05; the
paragraph it replaces said "what prevents them is that momentum is an integer… 0 of 6 orbited", and
that was a harness bug — item 16.)* Gravity supplies the trade an orbit needs with no stored
potential: falling in adds momentum so a primitive speeds up, climbing out subtracts so it slows.
With the sub-unit pull carried and step ties broken by a coin, `orbit.mjs` orbits at ±7 and wider.
But at a strength law 3's ceiling allows, orbital speeds are tiny, and since momentum is speed times
kind only the heaviest kinds have enough momentum to steer with, only around the largest clumps —
and the orbits wander rather than close. So the argument above stands with a smaller premise: not
"no orbits", but **not nearly enough of them to stop the collapse.**

*(Every earlier explanation was wrong and is retracted, "integer momentum" — the paragraph this
replaced — last. Of the three before it, the first blamed unweighted
momentum; the second blamed kinetic energy being impossible, which it is not; **the third blamed
the hexagon, and that one stood as settled fact for a day.** It said a primitive travels in one of
six directions one whole hexagon at a time, so its path cannot curve and every lap leaks from the
rounding — "nothing completed two laps" at radii of 20, 100 and 500. `orbit.mjs` runs direction
quantization on its own: it orbits **6 of 6**, zigzag path, radius wobbling by about a quarter, two
laps closed every time. The hexagon was never the problem, and the old numbers had no tool behind
them in the first place.)*

*(A fourth explanation — that **momentum clipping** was the cause and a wider field would therefore
buy orbits back — is also dead, and it was item 16's own hypothesis. The sweep runs ±3 to ±255 and
nothing orbits anywhere on it. The range is not the lever. See item 16 for the whole result, and
item 19 for the unwritten rule it uncovered.)* *(That sweep was started on the edge of the momentum
box; started at half of it, carried gravity orbits from ±7 up. Item 16.)*

**It costs law 3 nothing.** Gravity's job is to pull matter together and make heat from the falling.
Falling in is the point; orbits were always a bonus.

*And whatever form it takes, it must not stretch what is bound.* Expansion does nothing to a
molecule or a solar system in reality — local binding beats it easily, which is why the Earth
isn't growing. If a scale factor multiplied every distance here, clusters included, bonds would
come apart as the world aged and **chemistry would die of geometry rather than of cold.** That
is fatal, and exempting bonded pairs by hand is exactly the kind of special case this project
refuses.

**Which points at a cheaper version worth trying first.** Two variants:

- **(a) True expansion.** Distances grow, energy redshifts into an `expansion loss` counter
  beside radiated-away and wall momentum, and the asserted invariant becomes the counted one.
  Physically faithful, and it would make our conservation behave exactly like reality's. Costs
  the strict assertion, needs the bonded exemption, and puts non-integer distances on a lattice.
- **(b) Gravity weakening as the world cools.** Gravity's strength derived from the world's own
  current energy density rather than scheduled — so rule 2 is satisfied and the cap still comes
  free. No stretched lattice, no broken bonds, the pair force and therefore all of chemistry
  untouched in every era, and **strict conservation survives intact.** Not expansion, but it
  delivers the one benefit that survived scrutiny: strong early gravity gives fast collapse into
  many clumps, weak late gravity lets them persist apart instead of merging into one.

**(b) first.** It is one line, it keeps the project's only bug detector, and it targets the
argument that actually held up. (a) is the honest full version if the counted invariant proves
sound.

*And the reason it is not taken yet is rule 2.* A scheduled a(t) is a boundary condition in
time — a designer deciding the world's history, the same objection that killed the uniform
downward pull in law 3. Real expansion isn't a schedule; it is a **consequence** of what the
universe contains. So the only defensible version derives the scale factor from the world's own
state, with the expansion rate set by current energy density, roughly the way Friedmann's
equations do it. That has a good side effect: **it gives Ric's cap for free.** A world expanding
fast while hot and slowing as it cools stops expanding by itself, with nobody choosing when. A
hand-set cap would be a second smuggled decision; a derived one is physics.

Either would be law 6, so rule 7's bar applies — a written reason, and why it could not have
emerged instead. Deriving the rate from the world's own state is the beginning of an answer to
the second half, and the one thing both variants must have: a number a person sets by hand on a
schedule is a boundary condition in time, whatever it is called.
