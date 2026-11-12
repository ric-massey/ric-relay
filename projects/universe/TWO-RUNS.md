# Two Runs

Why this project runs twice instead of once, what each run is for, and — the question
worth taking seriously — **what it would be like if it were all one run.**

The short version: one run is the more honest design, and the split is what makes the
project possible at all. The split is a search strategy, not a permanent architecture.

---

## The structure

One engine. The law list does not change between runs. What changes is **what counts as an
individual.**

| | the Lab | the World |
|---|---|---|
| The individual is | **a primitive** | **a primitive** |
| Laws in play | 4 of the 5 (no gravity) | **4 of the 5 — also no gravity, since 2026-11-08** |
| Shape | a hexagonal torus: no edge | **a bounded sheet: edges, and light leaves through them** |
| Conditions | set and held — it's a laboratory | **nothing held: chemistry heats it, the edge cools it** |
| Size | ~256² (258 × 258, looped) | as large as the hardware allows |
| Length | minutes | long |
| How many | thousands | one at a time |
| Time | event-driven, continuous, stochastic | ticked, stochastic — an approximation |
| Runs on | CPU is fine | GPU, as a shader |
| The question | **what is matter here?** | **what can matter do here?** |
| Output | a table of species, measured | a world you look at |

**THE LAW LIST IS NOW THE SAME IN BOTH, AND THAT IS NOT A COLLAPSE OF THE SPLIT.** Gravity left the
World on 2026-11-08, because one hexagon was declared to be one atom and at that scale gravity is
10⁻²⁴ of a single bond (`THE-LAWS.md`, *One hexagon is one atom*). So the sentence this file opened
with for four days — four laws against five — is no longer what separates the two runs. What
separates them is the two rows now in bold: **the Lab holds its conditions still and has no edge; the
World holds nothing and has one.** A thermostat is apparatus, and the Lab is apparatus. The World's
temperature is whatever chemistry and its own perimeter leave it with.

That is a sharper distinction than the law count ever was, because it is the one that decides what
each run can answer. A held temperature is what makes a species measurement repeatable; an edge is
what lets a world have a history.

> **2026-11-09 — one held condition, when a run asks for it.** The World "holds nothing" is still
> true of every run that does not ask. A run that is meant to be left going for days may light one
> edge (`world.mjs` `receiveAtEdge`) and have that brightness steered toward a mean temperature
> (`world-stream.mjs --hold`). That is the Lab's kind of thing — an independent variable, not a law —
> and it is here because a World with one source and one sink can only run down. It acts only through
> light at the edge and never sets a temperature. `HOW-WE-DECIDED.md`, *A world that is left running*.

### Nothing is coarse-grained, and that is a correction

*(External review, 2026-11-03; see `SOURCES.md`.)* This file originally had the World's
individuals be *cluster species the Lab discovered*. That was a serious error. If the World can
only form species and reactions that the Lab's survey happened to find, **its chemistry has a
ceiling set by the survey** — which is the Avida disease, arriving by a side door, in the one
project that exists to avoid it. A measured table is still a table.

Keeping the primitive engine available for inspection, which is what this file previously
offered as mitigation, does not fix it either. Being able to look at a thing afterward does
not restore reaction pathways that were never available during the run.

**So the coarse-graining is gone.** Both runs simulate primitives under the same laws. The
Lab's table is never an input to the World; it is the **dictionary you read the World with.** The World
forms whatever its primitives form, including composites the Lab never saw, because the World is
running the physics rather than a summary of it.

The row that used to differ is now the row that doesn't, and the four remaining differences —
size, gravity, controlled conditions, ticked time — are all there is.

Gravity sits out of the Lab. The full reasoning is in `THE-LAWS.md`; the core
of it is that a measurement needs controlled conditions, and gravity makes conditions
depend on the whole mass distribution as it changes, so the same experiment run twice gives
two different tables.

## What the Lab produces

A data file. For each stable cluster species: what it is made of, its binding energy, its
leftover capacity, its density, and how it behaves when it meets each other species — all
of it **measured by running collisions**, not computed from a formula anybody wrote.

That file is this universe's periodic table. It is a *result*, and that distinction is the
whole reason the Lab exists. A hand-typed table of materials is arbitrary, and arbitrary
tables are the exact disease that capped every prior system in `SOURCES.md` — Avida's
complexity ceiling is literally computable from the size of its feature list. A table that
your own deeper physics handed you is not arbitrary. It is a measurement.

Deriving an effective theory at the scale you care about is what physics does. Nobody
simulates quarks to model water.

---

## What one run would actually be like

This deserves a real answer rather than a dismissal, because the one-run version is in
several ways the *better* design and it is worth knowing exactly what is being given up.

### The shape of it

Start with primitives spread out across a large world. All five laws. No table, no
measurement step, no seam. Run it from the beginning.

What happens, in order:

1. **Collapse.** Gravity pulls matter together. Falling converts potential energy to heat.
2. **The hot era.** At high temperature no bonds survive — thermal energy exceeds binding
   energy everywhere. The world is an unbonded soup of primitives. Nothing is stable,
   nothing accumulates, and this lasts until radiation has carried off enough energy.
3. **Recombination.** As it cools, clusters begin to survive. Chemistry starts to exist.
   Which species appear depends on the conditions the world happens to have produced.
4. **Chemistry, then whatever is above it.** Compounds. Then the ladder, if the constants
   allow it.

> **THAT CHRONOLOGY NEEDS A WORLD 10¹³ TIMES LARGER THAN THE HARDWARE, and it was written
> before anyone said what a hexagon was.** Steps 1 and 2 are gravity's, and at one atom per
> hexagon gravity cannot do them: a sheet of 4.26 million atoms has a self-gravity 10⁻²⁴ of
> one of its own bonds, and the crossing point is 3 × 10²² hexagons (`THE-LAWS.md`,
> *3. Gravity*). A World this project can run is a bacterium's footprint one atom thick, and
> a bacterium has no collapse and no hot era.
>
> **What a run has instead, measured 2026-11-08:** matter spread out at absolute zero, law 2
> forming bonds and releasing their binding energy as heat, that heat crossing the sheet as
> radiation, and leaving through the edge. A cold 96 × 96 sheet released 13,412 units of heat
> through chemistry, radiated 7,250 of them into the dark, and froze at 89.1% bonded. So the
> order is **chemistry, warming, cooling, and then whatever is above it** — the hot era is not
> skipped so much as supplied by chemistry rather than by falling, and recombination is what
> the whole run is.
>
> Steps 3 and 4 survive unchanged, which is the part that mattered. The rest of this section is
> kept because its argument — that one run is the more honest design — does not depend on where
> the heat came from.

### Why that is genuinely better

**It is the real thing.** One physics, one history, no coarse-graining, nothing baked in by
anybody. By this project's own standard — never write what should emerge — one run is the
pure version and the split is a compromise.

**The chronology is free and it is correct.** That sequence above is the actual history of
our universe: hot, no atoms, cooling, recombination, then chemistry. A one-run world gets an
era in which chemistry *cannot exist* and then an era in which it can, and the transition is
physics rather than a chapter heading. **This is the only real thing the split costs** — the
World starts from matter spread out rather than from a hot collapse, so it skips the era whose
whole content is "matter could not yet hold together." *(A second cost — species reachable only
under extreme compression never existing in the World — went when the World stopped reading the
table.)*

**There is no seam.** A measured table is still a snapshot taken under conditions a person
chose — which matters for how much you should trust the *dictionary*, even now that it isn't
feeding the world.

### Why it fails anyway

Five reasons, and the second is the one that decides it.

**1. Most of the compute goes to the boring part.** In our universe the hot,
no-chemistry era is the first few hundred thousand years out of 13.8 billion —
proportionally nothing. But a simulation pays per step, and the early era is the *most*
expensive part of the run: everything is hot, everything is moving fast, every site has
many interactions per tick. You would spend the bulk of your budget on a phase whose
entire output is "and then it cooled down."

**2. You could not iterate, and iteration is the whole method.** This is the decisive one.

The constants are unknown — seven of them (`README.md`, *The search space*), five of which the
Lab needs. Most settings give a dead universe — frozen solid or
boiling noise — and a narrow band gives one where things happen. You cannot reason your way
to that band, because you cannot tell from reading a rule set what it will do. That is
computational irreducibility, and it means **the only available method is search.**

With one run, each candidate physics costs a full cosmological history before you learn
whether its chemistry has any depth at all. If that is hours, a week of searching gets you
tens of samples in a five-dimensional space. With the Lab at 258², a candidate costs
minutes, so the same week gets you thousands.

**The split is what makes search possible, and search is the only way to find a physics
that works.** Without it the project is one guess, run slowly.

**3. You would not know what you were looking at.** If a one-run world produces something
structured, what is it? A cluster species? A compound? A dissipative pattern with no
chemistry in it? Something alive? You would have no reference to check against.

The Lab's table is not only cheaper — it is the **interpretive key**. It is the dictionary
you need to read the World at all. Without it you are watching a world in a language you do not
have, and "I think something interesting is happening" is as far as you can ever get.

**4. Failures would be undiagnosable.** One run produces mud. Is the *form* of the pair force
wrong, or one of the constants? Is the problem in the chemistry, the thermodynamics, or
the gravity? You would have one observation confounding all of it. The split isolates the
chemistry completely, which is ordinary experimental method: change one thing at a time. And if
the Lab comes back flat, law 2's form goes back on the table, and that needs somewhere cheap to
vary it.

**5. It would defeat the project's actual goal.** The README's aim is behavior you can
*trace* and still never have predicted — computational irreducibility, not mystery. One
run gives you nothing to trace *to*. With the Lab's table you can point at anything in the World
and ask which species that is and what it is made of, then go look at the primitive level
and check. That is what makes the World explicable all the way down.

---

## Keeping the dictionary honest

The Lab's table no longer feeds the world, so the question is not whether it is *complete* —
it is whether it is *trustworthy as a reference*.

**The Lab sweeps conditions; it does not pick one.** Measure across a range of temperatures and
pressures and record every species with the regime it exists in. A cluster that only forms
under high compression is then a known entry with a known condition rather than a gap in the
reference. The World may well produce it regardless, since the World isn't limited to the table — but
you would not recognize it.

**Log the gaps, and read them the right way round.** When the World does something the table
cannot explain, that is a finding about the *table* — a species the laboratory never reached —
not a bug in the world and not a failure of the physics. It goes in the notes (rule 10 of
`AGENTS.md`), and over time those entries are how the dictionary grows.

**Cross-validate the time scheme.** The two runs handle time differently — the Lab with
event-driven continuous time where nothing ever skips, the World with per-tick update
probability. Both are stochastic; only the time axis differs. The Lab's version is strictly
better physics and is affordable at 66,564 hexagons;
the World's is an approximation forced by needing millions of cells in a browser, where queue
churn and the loss of cache locality and parallelism cost more like 50–100× than 5–10×.

Because the Lab can do it properly, **the approximation can be tested rather than assumed.**
Take a small configuration, run it both ways, and compare the species that form, their
binding energies, and the rates. Agreement validates the World's compromise empirically.
Divergence is a finding about where the approximation fails, which is worth far more than
not knowing.

This is a concrete task on the list, not a reassurance. It is also the only place in the
project where the same physics is implemented twice, which makes it the one opportunity to
check an implementation against itself.

---

## One run is the eventual goal

The split is how you find a physics. One run is how you finally live in it.

Once the Lab has located a region of constant-space that produces a chemistry with real
depth, **the honest experiment is a single run from a hot start** — primitives spread out,
all five laws, collapse, the hot era, recombination, and then whatever follows, with no
table and no seam anywhere in it.

That is affordable at that point precisely because the searching is over. You are running
one universe instead of thousands, and you already know roughly where in constant-space you
are standing. You also, by then, have the table — not as an input to the world, but as the
dictionary for reading it. And if the single run grows species the table never contained,
that is not a failure of either run. **That is the most interesting result the project
could produce**, because it means the world found something the laboratory could not reach.

So: two runs now, one run later. The two-run structure is scaffolding, and it should be
described as scaffolding in anything written about this project, so nobody mistakes it for
a claim about how the universe is built.
