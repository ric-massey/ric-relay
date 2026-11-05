# Sources

This project is built on other people's work. Everything borrowed is credited here —
author, year, title, link, and what we took.

Rule 1 of `AGENTS.md`: **add the entry before using the technique, not after.** If the
originator of an idea can't be established, say so in the entry rather than leaving it
uncredited.

Started 2026-11-03.

---

## Why prior systems plateau — the diagnosis this project is designed around

**Taylor, Bedau, Channon, Ackley, Banzhaf, Beslon, Dolson, Froese, Hickinbotham,
Ikegami, McMullin, Packard, Rasmussen, Virgo, Agmon, Clark, McGregor, Ofria, Ropella,
Spector, Stanley, Stanton, Timperley, Vostinar, Wiser (2015).** *Requirements for
Open-Ended Evolution in Natural and Artificial Systems.* arXiv:1507.07403.
<https://arxiv.org/abs/1507.07403>

The central document behind this design. Their five necessary conditions, and their list
of what existing systems are missing, shaped most of the law set. Specifically taken:

- **"No entropy or decay"** — digital physics typically lacks rot, so organisms never
  need self-maintenance. Law 6 and the bond-energy coupling exist because of this. (It
  later turned out decay is a *consequence* of laws 4 and 6, not a law, which is better.)
- **Hard-wired protection limits interaction** — Tierra and Avida buy robustness with
  write-locks, banning the richest class of interactions. Why nothing here is protected.
- **Non-evolvable interpretation machinery** — Tierra's virtual CPU can't evolve. Why the
  periodic table here is measured rather than written.
- **"Darwinian variation, reproduction and inheritance are not sufficient."** The field's
  hardest-won lesson, and the reason this project is world-first rather than
  organism-first.
- Their condition 3, **offspring more complex than parents** (von Neumann's dual use of
  heritable information) — the condition nearly everyone fails.
- The observation that **conservative logic models have cleaner analogues of heat and
  entropy**, which is the "reversible microphysics" road not taken in the README.

## Prior systems, and where each hit its ceiling

**Ray, Thomas S. (1991).** *Tierra.* Self-replicating assembly programs competing for
CPU and memory. <https://en.wikipedia.org/wiki/Tierra_(computer_simulation)>

Took: the demonstration that parasites, hyper-parasites and social cheaters emerge
without being designed — and the counter-evidence that it plateaus anyway.

**Standish, Russell K. (2002).** *Open-Ended Artificial Evolution.* arXiv:nlin/0210027.
<https://arxiv.org/abs/nlin/0210027>

Took: the measurement that Tierra's organism complexity **does not grow** — in
size-neutral runs complexity didn't increase at all. Also his argument that total
complexity is bounded by initial complexity plus the entropy source, which is why
`AGENTS.md` cares about the random number generator's period. The philosophical version
is arguable; the engineering version isn't.

**Standish, Russell K. (2006).** *The influence of parsimony and randomness on complexity
growth in Tierra.* arXiv:nlin/0604026. <https://arxiv.org/abs/nlin/0604026>

Took: with parsimony pressure relaxed, organisms grow larger but **not more complex** —
they fill with junk. A warning that size is not a complexity proxy.

**Adami, Christoph, and C. Titus Brown (1994).** *Evolutionary Learning in the 2D
Artificial Life System "Avida".* arXiv:adap-org/9405003.
<https://arxiv.org/abs/adap-org/9405003>

Took: Avida's complexity rises and then **saturates at a value determined by the maximum
information in the niche**, because the feature set is fixed. This is the single most
important negative result for this project — it is why rule 4 of `AGENTS.md` forbids
enumerated tables. Avida's ceiling is computable from the size of its own list.

**Hutton, Tim J. (2002).** *Evolvable Self-Replicating Molecules in an Artificial
Chemistry.* Artificial Life 8(4).
<https://faculty.cc.gatech.edu/~turk/bio_sim/articles/hutton_rep_molecules.pdf>

The closest prior art to this project, and the proof that the hard part is possible.
Squirm3: a 2D grid of atoms with type and state, a small set of bond/unbond reactions,
and **self-replicators emerge spontaneously from a random soup** — no seeded replicator.
Took:

- The whole shape of the approach: atoms with state, bonds, local reactions, template
  replication.
- **One atom per grid site.** Squirm3 puts a single atom in a cell rather than a mixture
  with slots, and so does every falling-sand engine. We arrived at a four-slot mixture
  design first and deleted it; this is the arrangement that was already right, and it is
  what took a hexagon from ~28 bytes to 4.
- The **global extinction** failure in his 13-reaction variant, diagnosed as replicators
  being unable to benefit *exclusively* from the enzyme they produce — the public-goods
  problem.
- That **membranes were the fix**: compartmentalization protected replicators from
  parasites. This is why compartment formation is a leading ratchet candidate in the
  README.
- That the discrete grid over-constrained molecular mobility, pushing him to continuous
  space in later work. A known cost of the lattice we are accepting.

**Hutton, Tim J. (2007).** *Evolvable Self-Reproducing Cells in a Two-Dimensional
Artificial Chemistry.* Artificial Life.
<https://www.semanticscholar.org/paper/7cfbe93e2bc0d5051ecec35266ff5e2b4c8a8e34>

**Chan, Bert Wang-Chak (2019).** *Lenia — Biology of Artificial Life.* Continuous
cellular automata producing self-organizing solitons. Took: the demonstration that
gorgeous life-like structure does not imply evolution. Lenia has no intrinsic evolution.

**Plantec, Erwan, Gautier Hamon, Mayalen Etcheverry, Pierre-Yves Oudeyer, Clément
Moulin-Frier, Bert Wang-Chak Chan (2022/2023).** *Flow-Lenia: Towards open-ended
evolution in cellular automata through mass conservation and parameter localization.*
arXiv:2212.07906, doi:10.1162/isal_a_00651. <https://arxiv.org/abs/2212.07906>

Took two things, one positive and one cautionary:

- **Parameter localization** — the rule parameters ride *inside* the matter rather than
  sitting outside it, which is what makes multi-species worlds possible. The same
  principle as primitives carrying their own integer kind.
- The warning that **mass conservation acts as a regularizer limiting what can emerge**,
  with patterns going static or near-static. Conservation alone makes a world tidy, not
  alive. This is why the draining energy budget (laws 3 and 7) matters as much as law 1.

**Plantec et al. (2025).** *Flow-Lenia: Emergent evolutionary dynamics in mass
conservative continuous cellular automata.* arXiv:2506.08569.
<https://arxiv.org/abs/2506.08569> — they analyse with the evolutionary activity
framework, which is where the README's measurement section points.

**Agüera y Arcas, Blaise, Jyrki Alakuijala, James Evans, Ben Laurie, Alexander
Mordvintsev, Eyvind Niklasson, Ettore Randazzo, Luca Versari (2024).** *Computational
Life: How Well-formed, Self-replicating Programs Emerge from Simple Interaction.*
arXiv:2406.19108. <https://arxiv.org/abs/2406.19108>

The BFF soup: ~131,000 random 64-byte Brainfuck-variant programs, pick two at random,
concatenate, run, split. No fitness function. Self-replicators emerge **with and without
background mutation** — mutation isn't even required, self-modification during execution
suffices. Took:

- Confirmation that replicators from nothing is a solved problem, which is why this
  project doesn't seed one.
- The crucial negative result: after takeover, **replication stagnates, complexity
  degrades, and another replicator overtakes** — repeatedly, forever. Novelty without
  accumulation. This is the ratchet problem the README is organized around.
- Compressed size of the soup as a cheap, effective proxy for detecting transitions.

**Alakuijala, Jyrki et al. (2026).** *BFF: Simple explanations for complex phenomena.*
arXiv:2607.01483. <https://arxiv.org/abs/2607.01483> — tests whether a plain random
mutation walk finds replicators about as easily as paired interaction, and the effect of
capping ancestry depth and width. A reminder to check whether a mechanism is doing the
work you think it is.

**Wang, Rui, Joel Lehman, Jeff Clune, Kenneth O. Stanley (2019).** *Paired Open-Ended
Trailblazer (POET).* arXiv:1901.01753. <https://arxiv.org/abs/1901.01753> — and
**Enhanced POET** (2020), arXiv:2003.08536. <https://arxiv.org/abs/2003.08536>

Took: coevolution's **balance problem** — the difficulty is finding a setting that avoids
either the collapse of one side or a stable equilibrium where both sides stop innovating.
This is why the drive here comes from the world (gravity, a draining budget) rather than
from arms races alone. Also the ANNECS metric as an example of measuring accumulated
novelty.

**Brant, Jonathan C., and Kenneth O. Stanley (2017).** *Minimal Criterion Coevolution.*
<https://www.researchgate.net/publication/318071708> — the minimal-criterion idea:
filter for what is neither trivial nor impossible at the current capability level.

**Sayama, Hiroki (2019).** *Cardinality Leap for Open-Ended Evolution: Theoretical
Consideration and Demonstration by "Hash Chemistry".* Artificial Life;
arXiv:1806.06628. <https://arxiv.org/abs/1806.06628>

Took: the argument that **facilitating the formation of higher-order entities** is a
generalizable, effective route to open-endedness, by leaping the cardinality of the
possibility space. This is independent theoretical support for law 4 (capacity) being the
load-bearing law — capacity-limited bonding is precisely the mechanism by which
composites become units in their own right.

**Dittrich, Peter, Jens Ziegler, Wolfgang Banzhaf (2001).** *Artificial Chemistries — A
Review.* Artificial Life 7(3).
<https://www.cs.mun.ca/~banzhaf/papers/alchemistry_review_MIT.pdf>

**And specifically their number-division chemistry**, which is the prior art for law 2's
candidate forms. Molecules are natural numbers, the reaction draws two at random and divides,
non-primes are filtered out over time until the reactor holds only primes, and the review notes
that the arrival of new molecule types is itself an **emergent phenomenon** rather than designed
in. They describe a number-*addition* chemistry too.

Taken: the demonstration that **arithmetic on integers is enough to produce a chemistry with
real structure**, which is what makes law 2's grammar (remainder, gcd, divisibility, parity) a serious
proposal rather than a cute one.

**Note the inversion, honestly.** In their model division *is* the reaction, so numbers decompose
and primes are the **atoms** — the things that cannot break down further. In law 2's proposal
arithmetic sets the *binding strength* between primitives that stay distinct, so primes come out
nearly **inert** instead, bonding weakly with everything that is not their own multiple. Same
number-theoretic insight, opposite role. We are not reproducing their result.

**Booker, Andrew R.** *Turing and the Primes.* <https://people.maths.bris.ac.uk/~maarb/papers/turingprimes.pdf>
— makes the same analogy in passing: numbers as molecules, multiplication as a chemical
reaction, primes as the atoms that cannot be broken down. Credited for the framing, which
arrived at the same place independently and is reassurance that the mapping is natural.

The field's canonical review. Took the general framing (molecules, reaction rules,
algorithm) and the lattice-with-bonding model class. Their note that bond *inhibition*
rules — not valence counts alone — determine whether self-repair is likely is worth
revisiting if the Lab produces clusters that can't maintain themselves.

**Fontana, Walter, and Leo Buss (1994).** *AlChemy* — lambda-calculus artificial
chemistry in which self-maintaining organizations emerge. See also **Return to AlChemy**
(2024), arXiv:2408.12137. <https://arxiv.org/abs/2408.12137>

**(2021).** *Emergence of Self-Reproducing Metabolisms as Recursive Algorithms in an
Artificial Chemistry.* Artificial Life 27(3–4).
<https://direct.mit.edu/artl/article/27/3-4/277/109957>

Took: the hypothesis that the key enabling property for self-reproducing metabolisms is
**an auto-catalyzed subset of Turing-complete reactions.** This is the reason the
substrate must be able to compute at all — if computation isn't physically possible in the
world, no amount of running produces a mind.

## The lattice — momentum, grid shape, and update timing

**Frisch, Uriel, Brosl Hasslacher, Yves Pomeau (1986).** The FHP lattice gas model.
*Lattice Gas Hydrodynamics in Two and Three Dimensions.*
<https://content.wolfram.com/sites/13/2018/02/01-4-7.pdf>

Law 1's momentum clause and the hex grid both come from here. Took:

- That the macroscopic equations of motion depend **only on which quantities are
  conserved**, not on the details of the interactions.
- That **mass, momentum and energy plus rotational invariance** are the minimum for fluid
  behavior. Without momentum conservation there is no flow, no convection, no mixing.
- **Momentum as a discrete direction** rather than as a vector, which is what keeps
  conservation integer-exact. **What we did not take:** FHP's six *occupancy channels* per
  site. Those are for a gas of identical particles distinguished only by direction;
  primitives here carry kinds, so channels would have meant six kinds per hexagon. We use
  one primitive per hexagon with one direction, and conserve momentum at a collision by
  swapping the two directions. The debt is to the idea of discretizing momentum into
  lattice directions, not to the representation.
- **And the reason the swap works at all: FHP's particles are identical.** With unit masses,
  momentum-conserving collisions exist and can be enumerated. That is why law 1 makes momentum
  **unweighted** here — swap a kind-2 and a kind-5 with mass-weighted momentum and the total
  changes, and in general *no* pair of lattice directions conserves it. FHP's recovery of
  Navier–Stokes is a result about this unit-mass regime, which is the regime we are therefore
  in. See *the momentum problem* in `HOW-WE-DECIDED.md`.
- That the **triangular/hex lattice is required for isotropy in 2D**, and that the earlier
  square HPP model was abandoned because of anisotropy.
- The warning that a specific symmetric three-body collision was needed to avoid a
  **spuriously conserved third momentum component.** Rule 6 of `AGENTS.md` exists because
  of this.

**Patel, Amit — Red Blob Games.** *Hexagonal Grids.*
<https://www.redblobgames.com/grids/hexagons/>

The hex coordinate machinery. Recorded 2026-11-05, before writing `orbit.mjs`, which is the first
file here to use it explicitly — though the representation it describes is already law 1's.
Took:

- **Cube coordinates** — three axes summing to zero, so a hex vector is two independent signed
  components and the third is forced. That is exactly how law 1 stores momentum, and the reason
  it costs 10 bits rather than 15.
- **Cube rounding** — rounding a continuous cube vector to the nearest hex by rounding each
  component and then repairing whichever one moved furthest, so the three still sum to zero.
  `orbit.mjs` uses it for the single thing law 1 asks for: round the **step** to the nearest of
  six directions while leaving the momentum vector itself unrounded.
- The **cube-to-cartesian** conversion, used here only for *measurement* — radius and accumulated
  angle in the lap counter. No law reads it, and nothing in the physics is allowed to.

**What we did not take:** the pathfinding, range, field-of-view or map-storage algorithms on the
same page. If one of those turns up here later it is a separate debt and gets its own line.

**Margolus, Norman; Toffoli, Tommaso; Fredkin, Edward.** Block (partitioning) cellular automata
and reversible computing — the **Margolus neighbourhood**, in which the lattice is partitioned
into blocks and each block is updated by a permutation of its own states, with the partition
offset each step so information still crosses the whole lattice.

Taken: the realisation that **conservation on a lattice is easier to arrange inside a block than
between a pair.** A permutation of a block's states conserves any quantity you like, exactly and
by construction, because you simply decline to include outcomes that don't. And a block holds
more degrees of freedom than two colliding primitives, so a momentum-conserving outcome exists
far more often. This is the same trick FHP used when it needed a specific symmetric *three-body*
collision, and it is the route by which law 1's option (B) becomes practical rather than
theoretical. See *the momentum problem* in `HOW-WE-DECIDED.md`.

Note that Nozawa & Kondo's reversible lattice molecular automata (below) almost certainly rests
on this machinery, which is a further reason to read it.

**Succi, Sauro et al. (2022).** *Lattice Fluid Dynamics: Thirty-five Years Down the Road.*
arXiv:2209.13436. <https://arxiv.org/abs/2209.13436> — the retrospective that states the
minimum conservation set plainly.

<https://en.wikipedia.org/wiki/Lattice_gas_automaton> — background, and the note that hex
does not suffer the anisotropy that plagues square HPP.

**Bays, Carter / various (1996).** *Anisotropy in cellular automata.* Physica D /
ScienceDirect. <https://www.sciencedirect.com/science/article/abs/pii/S0303264796016644>

Took: that local grid and neighborhood anisotropy causes **spherical wave fronts to be
replaced by expanding squares.** The concrete artifact that makes a square grid dangerous
for this project.

**Arote, Ashish et al. (2022).** *Grid anisotropy reduction method for cellular automata
based solidification models.*
<https://www.researchgate.net/profile/Ashish-Arote/publication/365151802>

Took: square grids as a source of **artificial (grid) anisotropy** producing "solid cells
along the axes," and the list of remedies — change the grid, the neighborhood, the local
function, or replace synchronous dynamics with asynchronous ones. The last is a second,
independent reason for law 8.

**(2024).** *The Cellular Potts Model on Disordered Lattices.* arXiv:2404.09055.
<https://arxiv.org/abs/2404.09055> — lattice artifacts visible on a square lattice
disappear on a disordered one. The better-but-harder option noted in the README.

**Cornforth, David, David G. Green, David Newth (2005) / and the survey literature.**
*Timing matters: Lessons From The CA Literature On Updating.* arXiv:1008.0941.
<https://arxiv.org/abs/1008.0941>

Took: that **some apparent self-organization is an artifact of the global clock**, and
that cyclic patterns in particular are inherent to synchronous updating. Rule 11 of
`AGENTS.md` and law 8 both come from this.

**Schönfisch, Birgitt, and André de Roos (1999).** *Synchronous and asynchronous updating
in cellular automata.* BioSystems.
<https://www.sciencedirect.com/science/article/abs/pii/S0303264799000258> — neither mode
is "correct"; asynchrony destroys some synchronous patterns and reveals others. A
deliberate modelling choice, not a fix.

**Baetens, Jan M. et al. (2012).** *Effect of asynchronous updating on the stability of
cellular automata.* Chaos, Solitons & Fractals.
<https://www.sciencedirect.com/science/article/abs/pii/S0960077912000185> — stationary
states don't depend on the update scheme, but **basins of attraction can differ
vastly.**

## Thermodynamics and self-organization

**Prigogine, Ilya.** Dissipative structures — the result that systems held far from
equilibrium by a throughput of energy spontaneously organize. The reason the ladder
(convection → oscillator → autocatalytic cycle → compartment → replicator) is treated as
one continuous thing rather than as separate phenomena.

**England, Jeremy.** Dissipative adaptation — driven matter is statistically pushed
toward configurations that are good at absorbing the drive. The justification for not
seeding a replicator: you drive the system until replication is the thing structures fall
into.

**(2023).** *On the Emergence of Autonomous Chemical Systems through Dissipation
Kinetics.* Life 13(11). <https://doi.org/10.3390/life13112171>

Took: the argument that self-organization in living systems cannot be explained without
coupling growth and evolution to **energy dissipation**, and that this coupling is what
lets selection uncover new function open-endedly. Law 7 earns its place here.

**Kauffman, Stuart** — autocatalytic sets; formalized as **RAF theory** by **Mike
Hordijk and Mike Steel.** The result that self-sustaining autocatalytic networks appear
*almost certainly* once catalytic density crosses a threshold, because the number of
possible reactions grows faster than the number of possible molecules. The reason
emergence of self-sustaining chemistry is treated as a tunable knob rather than a hope.

**von Neumann, John** — theory of self-reproducing automata, and specifically the dual
use of heritable information (read as instructions, and copied as data). Taylor et al.'s
condition 3.

**Bedau, Mark A.** — evolutionary activity statistics, the field-standard measure of
whether new persistent non-neutral structure is still appearing. The README's measurement
section.

## Method

**Wolfram, Stephen.** *A New Kind of Science*, and the earlier CA classification work.
Three things taken: **computational irreducibility** (the only way to know what a rule
set does is to run it — the property this project wants, not a limitation); the **class
1–4 behavioral classification**, with class 4 (the narrow band between frozen order and
noise) as the search target; and the **method itself** — he didn't derive Rule 110, he
swept the rule space and found it. This project searches constants for the same reason.

**Etcheverry, Mayalen, Clément Moulin-Frier, Pierre-Yves Oudeyer et al. (2025).**
*Exploring Flow-Lenia Universes with a Curiosity-driven AI Scientist: Discovering Diverse
Ecosystem Dynamics.* arXiv:2505.15998. <https://arxiv.org/abs/2505.15998> — automated
curiosity-driven search over universes. Precedent for the search methodology.

**Mendeleev, Dmitri (1869).** He *discovered* the periodic table; he didn't invent it. The
organizing principle of the Lab, and nearly the name of this project.

**Lehmer, D. H. (1949)**, the linear congruential generator, *Mathematical methods in large-scale
computing units*, Proc. 2nd Symposium on Large-Scale Digital Calculating Machinery; and **Press,
Teukolsky, Vetterling & Flannery**, *Numerical Recipes*, for the constants `1664525` and
`1013904223`. `orbit.mjs` uses it as a seeded dice cup — the coin that breaks a tie between two step
directions, and the sampler in Check 7 — so a run is reproducible. Not physics. **Recorded after the
code, not before**, on 2026-11-05; rule 1 says to say so. (Check 7 briefly used the ANSI C
`rand()` constants, `1103515245` and `12345`, from the same family, before both were made one
generator.)

## Materials-first simulation, from outside academia

**The Powder Toy**, **Noita** (Nolla Games), **Sandspiel** (Maxim Bode). Falling-sand
simulators, largely ignored by the artificial-life literature, and the most successful
material simulators ever built.

Took the positive lesson — materials-first, strictly local rules, real phase and state,
mobility by density, heat that is load-bearing, cheap enough to run at 60fps on anything —
and the negative one: every material and interaction was **typed in by a human**, so the
emergence is enormous but hard-bounded. The same disease as Avida in a different decade.
Making the material set *generative* instead of enumerated is the one change that
separates this project from a falling-sand game.

**Schmickl, Thomas, Martin Stefanec, Karl Crailsheim (2016).** *How a life-like system
emerges from a simplistic particle motion law.* Scientific Reports. The Primordial
Particle System — one motion rule producing cell-like structures that self-replicate and
maintain themselves. The benchmark for emergence-per-rule.

---

## Physics taken as background

**Carr, B. J. & Rees, M. J. (1979).** "The anthropic principle and the structure of the physical
world." *Nature* 278, 605–612. <https://doi.org/10.1038/278605a0> — that the sizes of planets,
stars and living things follow from a few dimensionless constants, the number of atoms in a star
going roughly as gravity's weakness to the −3/2. Taken for the argument in `HOW-WE-DECIDED.md`
(*a hierarchy like ours*) that a gap sets a structure's size, and that choosing ε here is choosing
that gap. (Splitting the anthropic argument into a fine-tuning half and a selection half is the
usual reading in the literature, not something we can pin on one author.) Recorded 2026-11-05, in the same change that uses it.

Textbook results rather than papers we lifted a technique from — but rule 1 says credit
everything, and these documents lean on every one of them by name. **All of them were used
before they were credited**, which is a rule 1 breach, found by audit on 2026-11-03 and
recorded rather than quietly fixed.

**Noether, Emmy (1918).** *Invariante Variationsprobleme.* Every continuous symmetry of the
action yields a conserved quantity: momentum from space being the same everywhere, energy
from time being the same at all times. Two uses — the reason three conservation laws
collapsed into one, and the reason *symmetries instead of conservation* sits in the README's
roads not taken as the more principled design we didn't take.

**The expanding universe, and why law 1 is stricter than reality's.** Standard general
relativity: stress-energy conservation holds **locally** (∇_μ T^μν = 0) and there is no
general *global* conservation law. An expanding FRW spacetime has no time-translation
symmetry for Noether's theorem to act on, so there is no conserved total energy — photon
energy redshifts away as space expands, and a massive particle's peculiar momentum decays
as 1/a. Comoving momentum is still conserved, because spatial homogeneity survives.

**And that energy does not turn into heat.** Worth spelling out, because it is the natural
first reading — it was Ric's, on being told. Three things get conflated:

- **Dilution.** The same photons spread through a growing volume. Not a loss at all, and it
  accounts for three of the four powers in a⁻⁴.
- **Absorption.** Light hitting dust or gas is converted to heat, with a recipient. Real,
  common, and a completely different process.
- **Redshift.** The remaining factor of 1/a. It happens to light crossing empty space with
  nothing there to absorb it, and it has **no destination.** Nothing warms, nothing
  accelerates, and there is no outside.

The demonstration is the cosmic microwave background: roughly 3000 K at release, 2.7 K now.
The heat did not move somewhere — the heat got colder, and nothing absorbed the difference.
Dark energy is the mirror case: constant density across a growing volume means the total
*increases*, so the same non-law creates energy as readily as it destroys it.

The facts are not in dispute; the phrasing is, and **Sean Carroll**'s version (*Energy Is Not
Conserved*, 2010) is the clearest popular statement of the one used here.

So our law 1 asserts, exactly and globally, something our own universe manages only locally.
That is a departure in the *strict* direction and worth knowing about. Raised by Ric,
2026-11-03; it corrects the audit table in `THE-LAWS.md`.

**Pauli, Wolfgang (1925).** The exclusion principle. Law 4 is its analogue and the audit in
`THE-LAWS.md` calls it the closest match on the list: exclusion is why electrons occupy
shells, which is why valence exists, which is why chemistry exists at all.

**Kolmogorov, Andrey / Solomonoff, Ray.** Algorithmic information — an object's complexity is
the length of the shortest program producing it. The description-length constraint on law 2 is
this argument: a law short enough to write in one line **cannot contain** a periodic table,
because there is not room in it. The direction matters and is easy to reverse — shortness
limits what can have been written *in*, never what can come *out*.

**Newton, Isaac (1687)** and **Einstein, Albert (1915).** Law 3's *why the force exists at
all*: Newton gave the inverse-square law and explicitly declined to invent a cause for it;
general relativity replaced the force with spacetime curvature and left *why mass curves
spacetime* open. Cited to establish that every physics has a floor, so ours is allowed one.

**The proximity and orientation effect** — standard enzymology. A large part of how a real enzyme
accelerates a reaction is simply **holding the reactants next to each other, in the right
orientation, for a long time**, instead of waiting for them to collide by chance at the right
angle. The active site's selectivity comes from the **shape and composition of a pocket**: it fits
one substrate and not others. An enzyme is a protein, and a protein is atoms interacting
pairwise — so **nothing in enzymatic selectivity requires a three-body term in the underlying
physics.** It is many two-body interactions arranged in space.

Taken as the correction to a claim these documents made twice and got wrong both times: that a
pure pair function cannot produce a selective catalyst. It can, through geometry. See law 2,
*Catalysis is available after all*. Also taken: **product inhibition**, the real failure mode
where a pocket binds its product too tightly to release it and jams — which is why only some
pockets are catalysts and why this has to be searched for rather than assumed.

**Three-body recombination.** Textbook gas kinetics: two atoms colliding **cannot** form a
diatomic molecule on their own. The new bond's energy has nowhere to go, so the pair flies apart
again; a **third body** must be present to carry the excess away. This is why recombination rates
depend on pressure and why the third body appears in the reaction as a spectator that leaves
unchanged.

Taken as the fix for two holes the law 2 simplification opened at once — a bond-formation
condition, and a third-primitive effect that restores catalysis as something emergent rather than
written. See law 2 in `HOW-WE-DECIDED.md`. Original authorship is diffuse
(it is standard kinetic theory, not one paper); recorded as textbook rather than attributed to
anyone in particular, per rule 1's instruction to say so.

**How vacuum actually handles heat.** Textbook thermal physics, prompted by Ric asking why the
Sun is cooler further away. Vacuum **holds** no heat (nothing in it to carry kinetic energy) and
**conducts** none — which is why a thermos flask works, and why spacecraft struggle to *shed*
heat rather than to stay warm, radiators being the only route out. What vacuum does is transmit
radiation perfectly and indefinitely. The inverse-square falloff of sunlight is the same flux
geometry as law 3's: fixed total power spread over a sphere whose area grows as r². **Dilution,
not absorption** — and the distinction is what chose the fourth vacuum option in law 5.

**Radiative transfer on a lattice.** Carrying energy across empty cells as quanta with fixed
lattice directions is structurally a **discrete ordinates** method — the standard family in
which radiation is tracked along a finite set of directions rather than solved as a continuous
field. **Updated the same day: a specific paper was then found** — Weih et al. (2020), in the
2026-11-03 search section below — so this is an established method with astrophysical pedigree
rather than a guess. The trick of reusing an empty hexagon's already-present direction and
energy fields still appears to be ours, but note that the devil's-advocate pass on law 5
establishes it is not therefore *free*: it adds a third kind of thing to a two-state ontology.

**Barnes, Josh, and Piet Hut (1986).** *A hierarchical O(N log N) force-calculation
algorithm.* Nature 324, 446–449. The tree approximation to an N-body sum, and the ancestor of
reading gravity off a pyramid.

**Taken as a warning, not a technique.** A hierarchical approximation evaluates the pull of a
coarse cell on a primitive differently from the pull of that primitive on the cell's contents,
so the two are **not exactly equal and opposite** — Newton's third law fails by a small amount
per pair, and total momentum leaks every step. This is a known property of tree codes. Our
gravity solver reads a pyramid and inherits the failure mode unless each interaction is
computed once and applied symmetrically to both sides. See law 3 in `HOW-WE-DECIDED.md`.

**Newton, Isaac (1687), on momentum.** `p = mv`, and a force does not move a body — it changes
its momentum, `F = dp/dt`. Both halves decided law 1 on 2026-11-04: momentum became an integer
vector with speed derived as `p/k` because that is the actual definition, and gravity's action on
matter became "add to the momentum" because that is what a force is. **It also deleted a rule.**
These documents had referred four times to "the deflection rule" for how gravity turns a primitive,
a rule never defined anywhere; there is no such thing in Newton either, and once momentum is a
vector none is needed.

**And the circular-orbit condition**, `v² = GM/r`, which is just the inverse-square law set equal
to the centripetal requirement. `orbit.mjs` uses it to pick the tangential speed that *should*
produce a closed orbit at a given radius, so the test starts from the best case Newton allows and
measures only what the lattice does to it. Taken 2026-11-05.

**Momentum without mass.** A photon has no mass and carries momentum anyway — `p = E/c` — which is
why radiation pressure is real and why solar sails work. Noted here because this project now has
massless quanta that carry **no** momentum at all: emission produces no recoil. That is internally
consistent (nothing is added, nothing removed, so conservation holds) but it is a real effect this
world does not have, and it is a deliberate omission rather than an oversight.

**On kinetic energy, `p²/2m`.** Claimed on 2026-11-04 to be unrepresentable here and **retracted
the same day**: the formula is a fraction, but the choice of units is ours, and a whole-number
definition `floor(C·p²/2k)` conserves total energy exactly when the change is moved into the heat
field. It is a function of state, so no cycle can extract energy from the rounding. Not yet
designed into the laws — only shown to be available. Law 1 in `HOW-WE-DECIDED.md` has the numbers
and the account of how the original measurement was rigged.

**Relativistic momentum** is `γmv` rather than `mv`, growing without bound as speed approaches the
causal limit. Not adopted: speeds here are a rate between one step per tick and one step in 255, and
the cap at the causal limit does the job `γ` does in reality — keeping anything from exceeding it —
without a formula.

**Kirchhoff, Gustav (1859), and detailed balance.** A body in thermal equilibrium must emit at
every wavelength exactly as readily as it absorbs, or it would spontaneously heat or cool a
neighbour at its own temperature. The argument is the one behind this project's clock. Radiative
exchange between two bodies is governed by **view factors, which are reciprocal** — `A₁F₁₂ = A₂F₂₁`
is textbook radiative heat transfer — so if two bodies absorb alike and emit alike, the net
exchange between them is exactly zero whatever their temperatures. **Net heat can therefore only
flow because emission depends on temperature.** That is why our universe has a Stefan–Boltzmann
law, and on 2026-11-04 it turned out to be why this one needs a temperature-dependent clock: the
hexagonal lattice makes the reciprocity *exact* rather than statistical, which closes the second
law exactly and simultaneously makes a flat clock transport precisely nothing. Credited after the
fact — the result was derived here and then recognised, which is worth admitting rather than
dressing up as a reading of Kirchhoff.

**Stefan, Josef (1879); Boltzmann, Ludwig (1884).** Radiated power goes as T⁴. **Deliberately not
adopted.** This project's emission is linear in temperature, because one unit per clock fire at a
rate proportional to temperature is what falls out of the clock, and the second law needs only a
*monotonic* rate rather than that specific exponent. A declared deviation from our own universe,
recorded under law 5 in `HOW-WE-DECIDED.md`: getting the exponent nearer 4 means putting back a
curve the project was pleased to have deleted.

**Arrhenius, Svante (1889).** A reaction rate is an attempt frequency times a Boltzmann factor,
`k = A·exp(−Eₐ/RT)` — so heating speeds every elementary step up, in both directions, and what
shifts with temperature is the **equilibrium**, not the direction of the rates. Used on 2026-11-04
to catch law 2 saying bonds form *more slowly* when hot, which conflated a rate with an
equilibrium. The clock supplies the `A` term once for every law, so no law carries a temperature
term of its own. **Van't Hoff (1884)** is the equilibrium half of the same picture.

**Lattice gas, and one bit per direction.** Representing a travelling population as an occupancy
bit per lattice direction per site is the defining move of lattice-gas automata and their
descendant Lattice Boltzmann — HPP (Hardy, Pomeau, de Pazzis, 1973) and FHP (Frisch, Hasslacher,
Pomeau, 1986), the latter on a **hexagonal** lattice for the same isotropy reason this project
chose one. Universe's quanta use exactly that representation in the six bond bits an empty hexagon
never uses. **Arrived at independently and recognised afterwards**, which is the same rule 1
breach as the entries above and is recorded the same way. The Weih et al. entry below is the
radiative-transfer member of this family.

---

## The search of 2026-11-03 — what was already solved, and what wasn't

Ric asked why this was so hard. The answer turned out to be that **some of it is hard because
nobody has solved it, and some of it was only hard because we were treating a solved problem as
novel.** Worth separating, and worth crediting the people who solved the solved parts.

### Already solved — adopt rather than invent

**Weih, L. R., A. Gabbana, D. Simeoni, L. Rezzolla, S. Succi, R. Tripiccione (2020).** *Beyond
moments: relativistic Lattice-Boltzmann methods for radiative transport in computational
astrophysics.* MNRAS 498(3); arXiv:2007.05718. <https://arxiv.org/abs/2007.05718>

Law 5's fourth vacuum option — radiation carried across empty cells along a finite set of
lattice directions — is **an established method**, not an invention of ours. This paper solves
the radiative-transfer equation by extending Lattice Boltzmann to it, with radiation interacting
with a background fluid through absorption, emission and scattering, and reports the first
self-consistent LB solution coupled to a relativistic hydrodynamic flow. It is tested in
optically thin, optically thick and intermediate regimes. The general family is **discrete
ordinates** — radiation tracked along a fixed direction set rather than solved as a continuous
field.

Taken: the reassurance that option 4's structure is sound and well-trodden, and the specific
warning implied by its optically-thick tests — in a dense region radiation is reabsorbed almost
immediately, which is why option 4 buys realistic **opacity** rather than interior cooling.
(Succi also appears above, for the lattice-gas retrospective.)

**Energy-based Artificial Chemistry Simulator.** An artificial chemistry whose energy model
conserves **kinetic plus potential energy together**, with reactions discovered during the run
rather than enumerated, explicitly prioritising artificial life over chemical fidelity. Prior
art for the open question of whether motion here should carry energy — somebody has already
built the version where it does. Original authorship not yet established from the search; to be
filled in before the idea is used.

### Close prior art we had missed entirely

**Nozawa, Takayuki, and Toshiyuki Kondo (2008).** *Construction of Reversible Lattice Molecular
Automata.* arXiv:0802.4365; DOI 10.1142/S0129183109014072.
<https://arxiv.org/abs/0802.4365>

The closest thing found to this project's actual goal, and it reaches it from the opposite
direction. A cellular-automaton model of molecular interaction and the **self-organization of
higher-order structures** — Sayama's cardinality leap by another name — which the authors
motivate by observing that earlier multilevel self-organization CAs **lack microscopic
reversibility and conservation laws.** Their central claim is that strict reversibility *yields*
physically meaningful conservation laws, which then lets statistical physics be applied to the
conditions for multilevel self-organization.

That is precisely the README's *Reversible microphysics* and *Symmetries instead of
conservation* roads-not-taken, **already built.** Our law 1 imposes conservation; theirs derives
it. This is the strongest argument yet that the reversible route is real rather than merely
elegant, and it deserves reading in full before law 1 is considered settled.

**On pattern formation in the thermodynamically-consistent variational Gray-Scott model (2024).**
arXiv:2409.04663. The classical Gray-Scott reaction-diffusion model can **violate the first and
second laws**, and the fix is to include the reverse reactions. Taken as context for this
project's own two accounting bugs: second-law holes in reaction-diffusion systems are a known,
recurring and published failure mode, not a sign of carelessness peculiar to us.

### Confirmed *not* solved

**Unequal masses with exact momentum conservation on a lattice.** Searched directly. The
multi-species lattice-gas tradition — **Rothman & Keller**'s immiscible model and its
descendants — tags particles with colours and conserves each colour's mass separately plus total
momentum, but the particles have **equal masses.** The unequal-mass case is handled only in
floating-point Lattice Boltzmann, by two strategies named **Different Lattice Speeds (DLS)** and
**Same Lattice Speeds (SLS)**, plus forcing-term approaches (**Vienne, Marié & Grasso**,
DynFluid/CNAM; **Lourenço, Constantino & Tavares**, 2025, Chem. Eng. Sci.). Two findings from
that literature matter here:

- **Even there it does not fully work.** Momentum conservation holds for the mixture as a whole
  but *not for each component separately*, and where there is a density contrast these
  second-order models are reported not to recover the linear momentum balance equation on their
  own. So the difficulty is real rather than self-inflicted. *(Law 1 took option (A), unweighted
  momentum, until 2026-11-04 on exactly this reasoning — that it was the only regime where
  conservation could be exact. Option (B) is now the decision: a momentum vector conserves
  exactly too. Note that this entry is about momentum conservation per component in a mixture,
  which is a different claim from anything about kinetic energy — a claim that kinetic energy was
  impossible here was made the same day and retracted. See law 1 in `HOW-WE-DECIDED.md`.)*
- **DLS is prior art for the variable-speed sketch.** Letting species move at different lattice
  speeds is an existing technique, which is encouragement for the "a primitive moves only every
  *N*th step" idea in the README's expansion entry.

(These are search-level findings from abstracts and snippets rather than full readings. The
derivations are in the arXiv versions and have not been checked line by line.)

---

## Review

**External LLM review of these documents, 2026-11-03.** Ric circulated all five files to
another model and brought its assessment back. Rule 1 applies to criticism as much as to
technique, so what it found is credited here.

It caught two outright bugs, both of the dangerous kind — accounting holes that a structure
could exploit while looking like a discovery:

- **The momentum swap does not conserve momentum** if momentum is mass-weighted. A kind-2
  heading east and a kind-5 heading west total 3 units west; swapping directions gives 3
  units east. Chasing the fix revealed something worse: mass-weighted momentum *cannot* be
  conserved on a seven-valued direction set at all, because the constraint generally has no
  solution there. *(Law 1 took unweighted momentum on this basis and has since moved to option
  (B) — momentum as an integer vector, which has the room to adjust that seven values never had.
  The review's point stands exactly as made: it is what killed the swap, and the swap is gone.)*
- **Energy must flow toward lower temperature, not lower energy.** Temperature is energy per
  unit of kind, so a heavy cold primitive can hold more total energy than a light hot one,
  and the original rule would have moved heat uphill. Law 5 now compares `e₁·k₂` against
  `e₂·k₁`.

And three structural criticisms that changed the design:

- **The pair force is unspecified, and its *form* can smuggle in as much designer bias as a
  material table.** The strongest point in the review. It made law 2 the acknowledged biggest
  hole in the project, introduced the description-length constraint, and moved the force law's
  form into the search space, where it is a larger degree of freedom than any constant. Its
  observation that *the first real finding may be which interaction rules permit chemistry at
  all* is now in both the README and `THE-LAWS.md`.
- **A measured table is still a table.** If the World could only form species the Lab surveyed, its
  chemistry would have a ceiling set by that survey — the Avida disease arriving by a side
  door. The coarse-graining was removed entirely: both runs simulate primitives, and the Lab's
  output is a dictionary for reading the World rather than an input to it.
- **Energy crossing the boundary needs explicit accounting**, or the conservation assertion is
  meaningless exactly where it matters.

Two corrections to the framing:

- **"Continuous, not probabilistic" is a category error.** Gillespie's algorithm is
  event-driven, continuous-time and thoroughly stochastic. Discrete-versus-continuous time and
  deterministic-versus-stochastic event selection are independent axes, and these documents had
  merged them. Both runs are stochastic; only the time axis differs.
- **"Every prior attempt was structurally incapable of intelligence" is unsupported.** Taylor
  et al. discuss requirements and limitations of open-ended evolution; nothing cited here
  establishes universal impossibility. The claim is now the defensible one: several systems have
  ceilings traceable to specific design choices, and this project avoids those choices.

Its five-stage acceptance ladder — consistent mechanics, rich chemistry, catalysis with the
structure regenerated, accumulation, robustness across seeds and nearby settings — is adopted
in the README's measurement section. So is its warning that the variance layer lights up for
crystals, boundaries and ordinary clumping, and is therefore a pointer rather than a detector.

## Not yet credited

Searched 2026-11-03 and **found no prior work combining self-gravity with an artificial
chemistry.** Law 3's role as the energy source appears to be unexplored. That cuts both
ways: novel, and no prior art to borrow from when it misbehaves. If something turns up,
add it here.

**Searched again 2026-11-03**, directly for cellular automata combining artificial chemistry
with gravity, and again found nothing. The results covered local-rule emergence, self-replicating
CA structures and protocell chemistry, but gravity appears in none of them. Two searches now
agree, which is weak evidence of a real gap rather than proof of one.

What the second search *did* close, so this section stops claiming it: **radiation across vacuum
on a lattice is solved** (discrete ordinates; see the 2026-11-03 search section), and **exact
integer momentum conservation with unequal masses is unsolved everywhere**, not just here.
