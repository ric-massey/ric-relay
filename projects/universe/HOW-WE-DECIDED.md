# How we decided

The record. Every correction, every retraction, every option weighed and rejected, and the
reasoning behind each open question — kept out of `THE-LAWS.md` so that document can say what the
laws **are** without saying how we got there.

Split out on 2026-11-04, at Ric's call: *"this document just needs to be what we decided; make
another document for why we decided these things and the record."* `THE-LAWS.md` had reached 1,593
lines, two thirds of it argument, and law 2 alone was 555 lines with the answer buried at line 438.
Nothing here was rewritten in the move — it is the original text, verbatim.

**This file is where `AGENTS.md` rule 10 lives.** "A run that died, plateaued or produced nothing
gets recorded with the constants that produced it… in a search, negative results are most of the
output." The same goes for reasoning: a wrong turn recorded next to its fix is worth more than a
clean document that hides it, because the next person — human or model — will otherwise take the
same turn.

## What is in here

- **Correction —** something these documents got wrong, with the wrong version kept beside the
  fix. There are **fourteen**, plus **five retractions** of claims made the same day they were
  written — four in law 2, and one in law 1 where a measurement was believed over an objection
  and turned out to be measuring the wrong thing.
- **Open —** the full argument behind an undecided question. `README.md` holds the register of
  which questions are open; this file holds the reasoning for each.
- **Rules that came off the list** — the six candidate laws that were deleted, and why. Read it
  before proposing a new law; `AGENTS.md` rule 7 requires it.

Several entries carry **measurements** rather than argument, from the five design tools:
`screen.mjs` for law 2's form, `radiate.mjs` for law 5's radiation and the clock,
`momentum.mjs` for law 1's momentum, `budget.mjs` for the hexagon's four bytes, and `orbit.mjs`
for whether anything orbits and how strong gravity may be. Where a number appears in this file it came from one of those
and can be reproduced.

Everything is grouped by the law it belongs to, in law order.

**Numbers in these entries are as-of.** The hexagon was **four bytes** — kind 8, energy 11,
momentum two components at ±3, bonds 6 — until 2026-11-04, when it went to **eight bytes** with
energy at 16 bits and momentum at ±15. Entries written before that cite `2047`, `11 bits`, `±3` and
`31 bits`, and **they are left as written**, because an entry that records why a decision was made
has to show the numbers it was made under. `README.md`'s *What exists* is the one authoritative
statement of the current layout; where an entry's reasoning was overturned by the change, it says
so in place.

---

## 1. Conservation

#### Correction — the momentum problem

*(Found by external review; see `SOURCES.md`. The first version of this law was
wrong and the first attempted fix was also wrong, so the reasoning is recorded in full.)*

**The original claim was that collisions swap directions and that this conserves momentum
with no arithmetic. That is false if momentum is mass-weighted.** A kind-2 heading east and
a kind-5 heading west total 3 units west. Swap their directions and the total is 3 units
east. Momentum was created. Worse, it is *exploitable*: a structure could discover a cycle
of collisions that pumps momentum out of nothing, and it would look like emergent
propulsion rather than a bug.

**The first fix was also wrong.** Storing momentum as integer tokens and redistributing
them at a collision does preserve the sum — but a primitive's direction has only seven
possible values (six neighbors or rest), and for mass-weighted momentum there is in general
**no pair of new directions** satisfying k₁d₁′ + k₂d₂′ = k₁d₁ + k₂d₂. The conservation
constraint has no solution in the available state space. This is exactly why FHP uses
identical particles: with unit masses, momentum-conserving collisions exist and can be
enumerated.

So there are only three honest options:

**(A) Unweighted momentum — what we use.** A moving primitive carries one unit of momentum
in its direction whatever its kind. The swap then conserves the vector sum exactly, by
construction, with no arithmetic. This is the FHP-faithful choice, and FHP is known to
recover Navier–Stokes, so it is sufficient for the fluid behavior this law exists to
provide.

The cost is real and must be stated: **mass and momentum are decoupled.** A heavy primitive
is as easy to deflect as a light one, so this universe has no inertia in the familiar sense.
Gravity still acts on kind, so mass still means something — it just doesn't resist being
pushed. That is a genuine departure from our own physics and it is a deliberate one.

**(B) Momentum as a separate field.** Keep mass-weighting by storing momentum as an integer
cube-coordinate triple per hexagon (hex's three axes, components summing to zero, closed
under addition) and deriving movement from accumulated momentum rather than from a stored
direction. Exactly conserving, genuinely mass-weighted, and considerably more machinery.

**(C) Approximate conservation.** Rejected. It violates rule 6 of `AGENTS.md`, and an
accounting hole is the one kind of bug that disguises itself as a discovery.

**We build (A) first and expect to end at (B).** (A) is simpler and the Lab does not need inertia
to measure a periodic table, so it is the right starting point. But the reasons to stay on it
have weakened — see *the best idea* below, which supersedes the fallback framing this paragraph
originally had.

##### Why reality manages what we can't

Worth stating, because it locates the problem correctly: **this is a discreteness problem, not
a physics problem.** Real matter has wildly different masses — a proton outweighs an electron
1836 to 1 — and mass-weighted momentum is conserved exactly anyway. Reality gets away with it
because velocity is a **continuous** vector. Whatever total you have to hit, there is always a
pair of outgoing velocities that hits it, and in fact a whole one-parameter family of them,
which is what a scattering angle *is*.

We have seven settings and no speed. There is no small adjustment available, so there is
usually no solution at all. Reality is not doing something cleverer than us; it has more room.

##### ~~Open — the best idea, and why the recommendation flipped~~

*(Ric asked what the best idea is, and whether something unrelated might open it up.
Something does.)*

**Make more room, in two independent ways, and the problem stops existing.**

**First: stop storing momentum as the direction.** The reason the constraint has no solutions is
that one 3-bit field is doing two jobs — it is the momentum *and* it is where the primitive goes
next. Separate them. A hexagon holds a momentum **vector** as integers in cube coordinates (the
hex's three axes, components summing to zero, so two independent numbers, closed under
addition). Movement is then *derived*: velocity is `p / k`, so a heavy primitive carrying the
same momentum moves slower. Collisions exchange tokens, and because an integer vector is not
confined to seven values, **a conserving exchange always exists.**

That is v = p/m, which is just momentum. And it pays for itself three times over: exact
unequal-mass conservation, **real inertia** (heavy things resist), and **variable speed**, which
is what the orbit problem turned out to need.

The bit arithmetic is better than expected. Dropping the 3-bit direction and adding two signed
components at ±3 costs 6 bits for 3, so the hexagon goes 28 → 31 bits and **still fits in four
bytes.** The apparent catch is that a small momentum range means a heavy primitive can barely
move, since `p/k` with k up to 255 and p up to 3 is tiny — but that *is* inertia, so it is the
feature rather than the cost. (Arithmetic sketched, not verified by implementation.)

**Second, the unrelated connection: collide blocks, not pairs.** From reversible computing
rather than fluid dynamics — the **Margolus neighbourhood**, where the lattice is partitioned
into blocks and each block is updated by a permutation of its own states, with the partition
offset each step. Conservation inside a block is free *by construction*: you enumerate the
block's states and simply decline to include outcomes with the wrong total. No algebra to
satisfy.

And a block has more degrees of freedom than two colliding primitives, so a conserving outcome
exists far more often. **This is the same move FHP already made** when it needed a specific
symmetric *three-body* collision to fix its spurious conservation — widening the interaction
until the constraint became satisfiable. Credited in `SOURCES.md`.

**So the recommendation is now (B) with block updates, not (A).** When (A) was chosen, (B) looked
like extra machinery bought for nothing in particular. Three things have changed since: the
search confirmed nobody has exact unequal-mass conservation on a lattice, so (A) is not dodging
a solved problem but it *is* giving up mass-weighting permanently; the orbit analysis showed
variable speed is needed for anything to orbit; and block updates make (B) tractable. (A)
remains the right thing to **build first**, because it is simpler and the Lab does not need
inertia to measure a periodic table. It is no longer the right thing to settle on.

#### Correction — momentum at the wall

*(Found by audit, prompted by Ric asking why momentum appears not to hold in the
real world. It is the same bug the external review caught in energy, sitting unfixed in
momentum.)*

The world wraps left to right but has a **hard floor and ceiling.** A primitive heading down
into the floor cannot go there. Whatever happens next, the world's momentum total changes:
reflect it and the total shifts by two units, stop it and by one. So the boundary is a
momentum source and sink exactly as it is an energy sink — and `world momentum = constant`
would be asserted, and would pass, while the floor manufactured momentum every time anything
landed on it.

**Reality has the identical problem and resolves it the same way.** A ball bouncing off the
ground does not create momentum; the Earth takes the equal and opposite share, and you never
notice because the Earth outweighs the ball by some twenty-five orders of magnitude. Momentum
conservation is exact, but only for a **closed** system, and a world with a floor is not
closed. This is also the whole answer to why momentum looks like it fails in everyday life:
friction and the ground carry it off into things you weren't counting.

So the floor and ceiling are a **momentum reservoir**, and it gets counted:

- **wall momentum** — an integer hex-vector accumulating every unit the floor or ceiling
  absorbed or returned.

and the invariant that gets asserted is `world momentum + wall momentum = constant`, never
`world momentum = constant`. Exactly parallel to **radiated-away** for energy in law 5.

##### Open — does the wall reflect or absorb?

Both conserve once counted, so the choice is about what kind of world you want — and it has a
real consequence:

- **Reflect** (the wall returns two units): matter bounces, the floor is springy, and motion
  keeps circulating through the densest part of the world, which is where most of the
  chemistry will be happening.
- **Absorb** (the wall takes one unit and the primitive comes to rest): matter settles and
  piles up. **Sedimentation is one of the two candidate ratchets** in the README's open
  questions, because burial is irreversible and gives the world a history. A springy floor
  may fight the one mechanism we most want.

Deliberately unresolved. The *bug* was the uncounted momentum and the counter fixes it; which
behavior to pick has consequences we cannot predict from here, so it belongs in the search
rather than in a guess made now.

#### ~~Open — motion carries no energy~~ Settled 2026-11-04: kinetic energy adopted at `S = 64`

**Briefly marked resolved-as-impossible on 2026-11-04, and that is retracted the same day** — see
*Retraction — kinetic energy is not impossible* at the end of this law. **It was then adopted the
same day**: `floor(S · Q(p) / 2k)` with `S = 64`, derived from `(p, k)` rather than stored, so no
field is added and law 1's conserved total becomes `heat + Σ KE`. Law 1 in `THE-LAWS.md` states it
and gives the measured window, `S` from 2 to 291 at the eight-byte widths. The entry below stands as
written, as the record of the question while it was open.

*(Audit.)* Nothing in these documents gives a moving primitive kinetic energy. A
primitive has a direction and it has an energy, and they are **unrelated numbers**: moving is
free, stopping refunds nothing, and the energy field is purely thermal.

In our universe heat *is* motion — temperature is the average kinetic energy of jiggling
particles, and that identity is where thermal pressure and thermal expansion come from. Here
the two are separate, which means **a hot region is not a region where things are moving
faster.** It is a region carrying a larger number in a different field.

Heat still reaches motion, but only by one indirect route: thermal energy exceeding binding
energy breaks bonds, and an unbonded primitive is free to be moved by the pair force and
gravity. So this world should get melting and freezing. What it may not get is thermal
pressure — a hot gas pushing outward purely because it is hot — and if that is missing then
convection, which the README lists as rung one of the ladder, may not work the way the
documents assume.

Left as an open question rather than patched. Giving motion an energy cost would couple laws 1
and 5 and is a substantial change; the cheap test is whether the Lab shows any pressure response
to temperature at all.

#### ~~Open — momentum in bonded groups~~ Settled: shared along bonds

*(Audit. Searched all five documents; there is nothing on this.)* Each primitive
carries its own direction, and bonds are a separate six-bit field. As written, **motion and
bonding are two unrelated systems** with no stated interaction, which leaves the central
question unanswered: when something strikes one end of a five-primitive cluster, does that
primitive deflect and tear its bond, or does the whole cluster turn?

The two answers give different universes.

- **Bonds enforce joint motion.** A cluster has to be deflected as a unit, so turning it means
  flipping every direction in it. Clusters then have an **emergent inertia proportional to how
  many primitives they contain** — not to their total kind, but close enough that heavy
  composites resist being pushed. The absence of inertia from option (A) above would then only
  bite at the single-primitive level, and might barely matter.
- **Bonds don't constrain motion.** Clusters cannot really travel as objects at all; they are
  patterns that happen to be adjacent, and a collision shears them. Structures would be far
  more fragile, and "a thing that moves around" might never exist.

This is as consequential as the pair force's form and it is a genuine unknown, not an
oversight to be quietly resolved — the joint-motion version is more appealing, which is exactly
why it shouldn't be assumed.

*(Re-read 2026-11-04, and the question is now **cleaner** than when it was written. The last
sentence used to say it was "entangled with law 2, since whatever moves a bonded primitive is the
pair force's movement rule" — but there is no movement rule. That was the phantom "deflection
rule", an artifact of option (A) storing momentum as a direction, and choosing option (B) deleted
the need for it rather than defining it. Gravity now adds to momentum directly and law 2 moves
nothing at all. So this is purely a question about whether the bond field constrains the momentum
field, it has no law-2 dependency, and it can therefore be decided today rather than waiting on
anything else.)*

##### Settled — momentum is shared along bonds, because joint motion is illegal

*(2026-11-04. Neither of the two options above is the answer, and the answer is **forced rather
than chosen**, which is why this could be settled in an afternoon after sitting open.)*

> **A bonded pair exchanges integer momentum toward equalizing their velocities, equal and
> opposite, one hop per clock fire.**

**Joint motion breaks the causal limit, and that decides it.** Deflecting a cluster as a unit means
flipping every direction in it at once — information crossing a 50-hexagon cluster in a single
tick. The locality fact asserts one hexagon per tick as the maximum rate anything can propagate,
and that limit is the light cone, which `THE-LAWS.md` calls relativity's single most important
feature acquired as a side effect. Joint motion spends it. Reality agrees from the other side:
perfect rigidity is an infinite speed of sound, and it is forbidden for the same reason.

So the entry above was wrong to frame this as *appealing but unproven*. It is not appealing. It is
**unavailable**, and the audit that opened this question had the pair of options one short.

**What the local rule gives instead.**

- **Clusters are elastic.** A strike travels through a cluster as a wave at no more than one
  hexagon per tick, so a cluster has a **speed of sound** bounded by the causal limit with nothing
  written down to bound it. Long clusters flex. This is strictly better physics than rigidity.
- **Inertia is proportional to total kind.** Once momentum has spread across a bonded group of
  total kind `K`, the group steps at `|p| / K` by law 1's own rate rule. The open entry guessed
  inertia would go as the primitive *count*; total kind is the same idea done consistently, through
  the quantity law 1 conserves and law 3 acts on.
- **Shearing is conditional and free.** A collision's kinetic-energy change goes to heat, and if
  that heat crosses `e ≥ B · kind` at either endpoint the bond breaks. Soft strike moves the
  cluster, hard strike shatters it. **Both of the original options are special cases of this one
  rule**, selected by binding energy and temperature — by chemistry, which is where it belongs.
- **It conserves exactly**, by the same construction as collisions: pairwise, equal and opposite,
  integer. No new invariant and no new counter.

**The dependency, which is the one real cost.** The shearing half needs **kinetic energy to be
represented.** Without it a collision moves momentum and produces no heat, so nothing about how
hard a strike was can reach a bond, and bonds break only from ambient warmth — a world where you
can melt a structure but never break one, with no fracture, no erosion and no mechanical
weathering. The construction is already in `AGENTS.md` rule 5 and measured in `momentum.mjs`:
`floor(C · p² / 2k)`, no free-energy pump over thousands of closed loops. It costs one constant,
and **the scale factor must be re-measured if the field widths change** — `momentum.mjs` already
sweeps ±3, ±7 and ±15, so that is a rerun rather than new code.

**One deviation, recorded rather than buried.** The sharing runs on the hexagon's clock, so hot
clusters redistribute internally faster than cold ones and a cluster's speed of sound rises with
temperature. Real solids do the opposite, mildly. Small, no new constant, and the price of having
exactly one clock in the design.

#### How option B was settled, and what it cost

*(2026-11-04. Ric: "it seems like b is the right way to go… b fixes a few issues so do it." The
decision was already leaning that way; what follows is what measurement added, including one
finding that closed a different question in the negative.)*

**Three independent arguments landed on (B), and only the first was already written down.**

**1. It is the real formula.** `p = mv` is the definition of momentum, and a force does not move
things — it *adds* momentum, which is all `F = dp/dt` says. Option (A) is a universe in which
momentum and velocity are the same quantity, and that is only true when everything weighs the same.

**2. Option (A) cannot express a force at all — and that is where the phantom rule came from.**
Gravity yields a direction *and* a strength. Under (A), momentum is a direction, so the strength
has nowhere to go: a primitive either steps one hexagon or it does not, and twice the gravity does
precisely what half the gravity does. Law 3's entire content, the 1/r², would be computed and then
discarded.

These documents had papered over that with **"the deflection rule"**, which was referenced four
times across two files — including one sentence stating a *consequence* of it — and **defined
nowhere.** A search of the whole working conversation found no definition either. It had entered as
a placeholder in an argument about orbits, where its details did not matter, and later sentences
began treating it as a thing that existed. Choosing (B) **deletes the need for it**: gravity adds
to the vector, strength and all. A rule removed rather than defined, which is what `AGENTS.md`
rule 7 asks for.

**3. Option (A) has one speed, so it has no tail.** This is the non-stagnation argument and it is
the one that should carry the most weight. Real chemistry runs on the **rare fast particle** that
clears a barrier; heating a mixture does not make every molecule react, it makes that tail bigger.
Under (A) every moving primitive moves at exactly one hexagon per tick — one speed, no spread, no
tail. Under (B) there are **255 distinct speeds**, and most of the spread comes from *mass* rather
than from the momentum range, which is why ±3 turns out to be enough.

##### The cost: speed has to be a rate, not a distance

The bit sketch in the entry above said a heavy primitive "can barely move, since `p/k` with k up to
255 and p up to 3 is tiny — but that *is* inertia, so it is the feature rather than the cost," and
flagged itself as not verified. **It was wrong, and in both directions.** Taking `p/k` as a
*distance per tick*:

- kind 255 at maximum momentum moves one hexagon in about **85 ticks** — not inertia, immobile;
- kind 1 at maximum momentum moves **three hexagons per tick**, straight through the causal limit.

The fix was already half-written in the README's orbit section as a parenthetical, and it fits the
clock decided a day earlier: **a hexagon already acts at a rate, so motion is one of the things it
does when it acts.** A primitive steps one hexagon every `k / |p|` ticks, capped at one step per
tick. Measured over all kinds and every momentum vector at ±3:

| | |
|---|---|
| distinct speeds | **255**, from every tick to one step in 255 |
| at the causal limit | 0.7% of (kind, momentum) pairs |
| effectively frozen | **0.0%** |
| kinds 1–16 | step about every **3rd** tick |
| kinds 100–150 | step about every **57th** tick |
| kinds 240–255 | step about every **114th** tick |

A 38-fold spread in speed from mass alone, with the same momentum distribution. **That is inertia,
and it needs no kinetic energy whatsoever** — which is worth knowing independently of whether
kinetic energy is ever added.

The cap is physically right rather than a fudge: nothing may exceed the causal limit, and reality
caps at `c` for the same reason. It does mean the lightest kinds pile up at the maximum and lose
differentiation at the very top, which is the same saturation the clock has.

##### The momentum range is ±3, and the field widths fix it

| momentum range | bits for two components | hexagon total | |
|---|---|---|---|
| ±3 | 6 | **31 bits** | fits, 1 spare |
| ±7 | 8 | 33 bits | does not fit |
| ±15 | 10 | 35 bits | does not fit |

Momentum replaces the 3-bit direction field, so the hexagon goes 28 → 31 bits. There is no room to
widen it — and no reason to, since ±3 already yields all 255 speeds. This is the third time a field
width has decided a question of physics rather than of storage, after law 2's cap of 8 and the
clock's 2047:1 spread.

##### Collisions exist in quantity, which was worth checking rather than assuming

The entry above claimed conservation inside a Margolus block is "free by construction: you
enumerate the block's states and simply decline to include outcomes with the wrong total." True,
but it does not establish that any outcome *remains*. If the only legal outcome were "nothing
happens", matter would pass through itself and the gas would be non-interacting — which is
stagnation of the most basic kind. Enumerated at ±3 over 4,000 random collisions: **a mean of 14.9
outcomes that actually change something**, and only 1.9% of collisions with no option but the
identity. At wider ranges it is better still. So the outcome is chosen at random from a healthy set.

##### ~~And the finding that closed another question: kinetic energy is impossible here~~

**Retracted within the hour. The whole subsection was wrong**; what it claimed, and why the claim
was false, is in *Retraction — kinetic energy is not impossible* below. The numbers it reported are
real but they measure the wrong thing. Kept here as a heading only, because the retraction is worth
more than the claim.

#### Retraction — kinetic energy is not impossible

*(2026-11-04, within an hour of the claim. Ric: "Kinetic energy. It needs to exist tho. Double
check that also… And orbits are needed I'm confused about that. Gravity fixes orbits." Both
objections were right and both of my explanations were wrong.)*

**The claim was that kinetic energy cannot exist here**, on the strength of two measurements: that
conserving momentum and kinetic energy together left no legal outcome in 66% of collisions, and
that routing the shortfall into heat left 48% dead with only 1% able to shed anything. The numbers
were real. **They measured the wrong thing twice over.**

**Rigged the first way: I tested pairs.** Collisions resolve in **Margolus blocks**, which hold
three cells, not two — a fact written two paragraphs above the claim. Three particles give far more
outcomes than two, and re-running it shows how much that mattered: **51% of pairs have no legal
outcome, against 12% of three-cell blocks.** Not a fix on its own, but the headline figure was
inflated by a setup that contradicted the design it was testing.

**Rigged the second way, and this is the real error: I demanded kinetic energy be a fraction, then
reported that a fraction will not fit in a whole-number field.** `p²/2m` is the formula in our
units. **We choose the units.** Define kinetic energy as a whole number and the problem does not
arise:

> **`KE(p, k) = floor(C · p² / 2k)`**, and a collision conserves momentum exactly while moving
> whatever `KE` changes by into or out of the heat field.

Total energy is then exact **by construction**, because the amount moved is the amount changed.
Measured at `S = 128`:

| | |
|---|---|
| mean legal outcomes per collision | **16.2** |
| collisions with no legal outcome | **0.5%** |
| motion → heat possible | **88%** of collisions |
| heat → motion possible | **83%** of collisions |
| energy gained over a closed loop of collisions | **0** |

**The last row is the one that matters**, because defining energy by a rounded formula invites
exactly the free-energy pump `AGENTS.md` rule 6 warns about. It cannot happen, and the reason is
structural rather than lucky: `KE` is a **pure function of mass and momentum**, so any path through
collision states that returns to its starting state returns precisely the energy it borrowed. Three
thousand random loops, worst gain **zero**.

**One trap found on the way, worth more than the headline.** The obvious version — `floor(p²/2k)`
with no scale factor — is useless: momentum reaches ±3, so `p²` reaches 18, and `18/2k` rounds to
zero for **every kind above 9**. Heavy matter would have had exactly zero kinetic energy whatever
its momentum, and nothing in the formula would have looked wrong. The scale factor has to sit
between 64 (where the last kind stops reading zero) and 256 (where the lightest kind overflows the
11-bit energy field). This is the **fourth** time a field width has decided a question of physics
here, after law 2's cap of 8, the clock's 2047:1 spread and momentum's ±3.

##### And orbits: two wrong explanations, and the real one

Ric's objection was that gravity ought to give orbits by itself. **It does supply the mechanism**,
and it needs no stored gravitational potential to do it: gravity adds momentum toward the mass, so
falling in speeds a primitive up and climbing out slows it down. That *is* the kinetic–potential
exchange, implemented as vector addition. Both of this project's previous explanations for the
absence of orbits were wrong — the first blamed unweighted momentum, the second blamed kinetic
energy being impossible.

**The real obstacle is the lattice.** A primitive travels in one of six directions, one whole
hexagon at a time, so its path is a hexagonal zigzag rather than a curve, and every lap leaks a
little energy through the rounding. Tested at the mathematically correct circular-orbit value
`G = p²r/k`, at radii of 20, 100 and 500 hexagons, at momentum ranges of ±3 and ±31, with the
sub-hexagon position error both discarded and carried: **of 96 settings, none stayed bound, and
nothing completed two laps.** Everything fell in or flew off.

So the absence of orbits belongs beside *2D is topologically poor* — a consequence of the grid, not
of the energy budget — and it costs law 3 nothing, because gravity's job is collapse and falling in
is the point.

***Superseded 2026-11-05, and the numbers above were never real.*** `orbit.mjs` is the first orbit
code this project has ever had, so the "96 settings" and the ±31 runs cited above came from
nowhere. When the measurement was actually made, direction quantization orbited **6 of 6** and the
conclusion inverted. What survives from this entry is its last clause — it costs law 3 nothing —
and that was never the part in doubt. See *Correction — the hexagon was never what stopped an
orbit* below.

##### What this says about the method

Three claims about this one question were made and two were wrong, inside a single day. The pattern
in both failures is the same: **a measurement was trusted because it produced a number.** The first
test contradicted the design two paragraphs above it; the second encoded an assumption about units
in its premise and then reported the assumption back as a result. Neither error was visible in the
output, and both outputs looked like findings.

What caught them was not a better test. It was Ric saying the conclusion could not be right.
`AGENTS.md` rule 11 says *don't trust a pretty picture*; the companion to it is **don't trust a
number either — check what the measurement assumed before believing what it says.**

##### What remains open in this law

Two items, both unchanged: whether the wall reflects or absorbs, and what momentum does in a
**bonded group**. The second cannot be deferred, because the Lab has both bonds and motion. Note that
(B) changes its terms — a struck cluster now has a real momentum vector to share out, so "turns as
a unit" and "shears apart" are both expressible, where under (A) the question was partly an
artifact of having only a direction to flip.

##### How it was checked

`momentum.mjs` (`node momentum.mjs`), dependency-free, no simulation: the speed spread over all
kinds and momenta; collision outcomes by enumeration, with and without kinetic energy; the inelastic
variant with the integer-shortfall test; the bit budget; and an inertia control measuring mean speed
by mass band. The three-tool pattern holds — `screen.mjs` for law 2's form, `radiate.mjs` for law
5's radiation, `momentum.mjs` for law 1's momentum. **None of these is part of the engine**, and
each settled a question that had been argued in prose for days.

---

#### Correction — the orbit result had two sufficient causes and measured neither

*(2026-11-04, from Ric's review of law 1.)*

**What it said.** That "±3 already gives all 255 speeds, so nothing is lost," and separately that
the reason there are no orbits is geometry: a primitive travels in one of six directions, one whole
hexagon at a time, so its path cannot curve and each lap leaks from the rounding. Filed under "2D
is topologically poor."

**What is wrong with it.** The first claim is true about **speed** and false about **headroom**, and
those are different quantities. ±3 covers every speed because speed is `|p|/kind` and kind runs to
255, so a small numerator over a large denominator spans the whole range. But an orbit does not
need a speed. It needs a **change** in speed, repeatedly and in both directions — faster falling
in, slower climbing out — and at ±3 there are three integers of room before the clamp. **The
velocity budget an orbit runs on cannot be represented**, whatever the path does.

So the orbit runs had **two** sufficient causes present at once, direction quantization and
momentum clipping, and measured only their sum. Attributing the result to geometry was an inference
dressed as a measurement, and it was then filed as a *permanent* limitation of two dimensions when
the real cause may be a field width — which is a four-byte budget decision, and reversible.

**The diagnostic, which is cheap.** Rerun the orbit test at ±7. That needs 8 bits of momentum and
makes the hexagon 33 bits, which does not fit in four bytes — but nothing needs to fit for a
measurement whose only job is to separate two causes. If laps appear, geometry was not the cause
and README item 14's "permanent" needs qualifying. If nothing changes, the original conclusion
stops being inference and becomes evidence.

Worth naming as a general trap, because this project will meet it again: **a result with two
sufficient causes measures neither.**

#### Correction — the hexagon was never what stopped an orbit

*(2026-11-05. `orbit.mjs`, written because README item 16 asked for it and because the entry above
admitted its own numbers could not be rerun.)*

**What it said.** Two things, in sequence, and both are now wrong. First, that what defeats an
orbit is the lattice — a primitive travels in one of six directions, one whole hexagon at a time,
so its path cannot curve and every lap leaks from the rounding. Then, correcting that, that the
result had two sufficient causes and the other one — **momentum clipping** — might be the real
cause, which would make the limitation a field width and therefore reversible.

**What the measurement says.** Switch direction quantization on by itself and it orbits **6 of 6**,
at radii 20, 100 and 500, at both momentum ranges. The path is a visible zigzag and the radius
wobbles by about a quarter of itself, and it closes two laps every time. **The zigzag is
survivable.** Switch integer momentum on by itself and it orbits **0 of 6**, under both of the two
available rules for a sub-unit pull. Then sweep the range from ±3 to ±255 — 85×, running far
outside the word's ten bits on purpose — and nothing orbits anywhere on it, including rows where
the per-tick pull is twelve whole units. **So it is not the range either.** It is the
integerisation itself, and *why* that is fatal is not established.

**Both failed explanations were inferences dressed as measurements**, and that is the third time in
this file. The first had no code behind it at all. The second had an argument that sounded
mechanical — three integers of room before the clamp — and the sweep refutes it directly.

**The control is the whole reason this is trustworthy, and it failed twice first.** `AGENTS.md`
rule 12 says a run reporting zero of the thing it measures is a broken run. The first version
reported zero orbits in every row including the control, which was two bugs in the harness and
nothing about the world: the start velocity was 60° off perpendicular, because `[0,-1,1]` reads as
tangential and is not, and the orbiter was light enough that law 1's one-hexagon-per-tick cap
clipped its speed, which silently breaks the circular condition the run was built on. **Had the
control not been in the table, both bugs would have been reported as findings** — and they would
have agreed with the conclusion this entry is correcting, which is exactly how the wrong answer
survived a day.

**And the tool refutes a prediction written into its own file**, which is kept beside the
refutation rather than deleted. It predicted orbits would appear once the range was wide enough for
the pull to reach one whole unit, at about ±sqrt(k·r). The sweep crosses that line and nothing
changes. Rule 12's fourth lesson, landing on the file that was written to apply it.

**What it opened.** Law 3 never says what happens when the pull is smaller than one unit of
momentum, and at every radius tested the whole pull is a fraction — 0.00007 to 0.044 per tick.
Rounding gives gravity a cutoff radius nobody chose; carrying the remainder needs a stored residual.
That is README item 19, and it blocks writing the solver.

***Superseded the same day, 2026-11-05, and the "0 of 6" above was the harness.*** Every run
started on the edge of the momentum box, which is a hexagon and not a circle, so the clamp shaved
`|p|` at some headings and not others and every orbit fell inward. Started at half the box, integer
momentum with the pull carried orbits at ±15 at all three radii, and the sweep orbits from ±7 up —
the prediction this entry called refuted was right. Recorded in the commit that fixed it; the
documents were left stale until the corrections below.

#### Correction — two laps called a spiral an orbit, and a tie-break was a handedness

*(2026-11-05, `orbit.mjs` Check 9.)*

**What it said.** After the start was moved off the clamp, "both, carry" — integer momentum on the
lattice, the case the World will actually run — reported **3 of 6 orbited**, and that went into the
commit message as the answer.

**What was wrong.** Two things, the second hidden by the first. The bar was **two laps**, which
cannot tell an ellipse from a slow spiral. Flown for twenty, every one of those runs fell into the
centre: closest approach 49, 49, 42, 0 hexagons at r = 100, lap by lap. And the cause was not
gravity, the integers or the range — it was **`nearestDir` keeping the first of two tied directions,
every time.** An integer vector lies exactly between two hexagon directions on 2 to 4 percent of an
orbit's steps, and always resolving the tie the same way leans the path the same way. Break ties
with a coin and the same runs hold for twenty laps; alternate them and they hold too.

**Why it matters beyond the tool.** Law 1 says a step rounds to the nearest of six directions and
says nothing about a tie, so an engine written from it would pick one silently — a **handedness in
the physics**, the exact failure `AGENTS.md` rule 6 names for the gravity solver, arriving by a
route nobody was watching. README item 21; the proposed rule is in law 1.

**And it is the first harness bug here that pushed against the conclusion being tested.** The three
before it all made orbits fail. This one made spirals pass. Rule 12 cuts both ways, and so do bugs.
The tool now flies ten laps and reports each run's closest approach on its first lap and its last.

#### Settled — what a force does to momentum that is already at the limit

*(2026-11-04. Nothing in these documents addressed it, and laws 1 and 3 contradicted each other on
it outright: law 1 says momentum is conserved exactly, law 3 says gravity adds to momentum, and
both cannot hold at ±3.)*

Three options:

1. **Clip the recipient.** Fails. Gravity is applied once per pair, equal and opposite, so if one
   side clips and the other does not, the pair's vector sum changes. The leak is small, constant
   and **directional**, so it shows up as a preferred direction in the physics — which is exactly
   the failure law 3 already rules out for the pyramid approximation, reached here a second way.
2. **Skip the pair if either side would clip.** Conserves exactly and is simple, but gravity then
   switches off abruptly for fast matter, which is the matter deepest in a well.
3. **Transfer as much as both sides can take, and no more.** Conserves exactly, degrades smoothly,
   and is one `min` in the solver. **Chosen.**

So if one side has room for 2 and the other for 1, the transfer is 1. **The clamp is symmetric or
it does not happen**, and law 1 stays exact by construction rather than by assertion.

**What this means for gravity, stated rather than left to be discovered.** Gravity has a terminal
velocity and it arrives in about three steps, so a primitive deep in a well and one at the rim move
at the same speed. For gravity's actual job — gather matter, convert arrangement into heat — that
is harmless: falling in is the point, and the heat comes from the arrival rather than from the
speed. For anything needing a velocity *budget* it is fatal, which is the orbit case above. Those
are one fact seen twice.

## 2. Bonding

#### How law 2 was settled, and everything that took

*(Raised by external review, and it is the most consequential thing the review
found.)*

"Attraction or repulsion as a function of their two kinds and their separation" does not
specify a physics. It specifies an enormous *family* of physics, and which member you pick
decides whether chemistry is possible at all. Bond formation and breaking conditions,
movement rules and event rates all live inside it.

**And if law 2 is a force, the movement rule inside it has to conserve momentum** — a hard
constraint the documents did not previously state. A force that simply sets a primitive's
direction toward whatever is attracting it **creates momentum out of nothing**, the same bug as
the wall and the pyramid, in the place it would be easiest to write by accident. Any candidate
force law would have to change two directions at once, paying for one with the other, or hand
the difference to a counter. That rules out a large share of the obvious implementations.

**Read that as diagnosis rather than as a live constraint.** It is the strongest argument for
*The simplification* below: the whole difficulty is an artifact of writing law 2 as a force. A
binding rule moves nothing, so it cannot create momentum, and the constraint disappears rather
than being satisfied.

Worse, and this is the part that indicts our own discipline: **the form of that function can
smuggle in exactly as much designer bias as a material table.** You could write a periodic
table directly into `f(k₁, k₂, r)` as a few hundred special cases and satisfy every other
rule in `AGENTS.md` while doing it. Rule 4 forbids enumerated tables and this law was a
loophole straight through it.

##### The constraint: description length

**The force law must be expressible in a handful of operations on the two integers** — their
sum, their difference, parity, a greatest common divisor, whether one divides the other, and
the like. Not a table of cases. Not a large piecewise function.

The reasoning is Kolmogorov's: a law short enough to write on one line **cannot contain** a
periodic table, because there isn't room in it. A lookup table can. So the operational test
is that *the force law's description must be shorter than the table it produces.* That is
checkable by construction — implement only laws drawn from a small fixed grammar of integer
operations — and it closes the loophole without pretending the function is already chosen.

One distinction worth keeping straight, because it is easy to get backwards: a short law is
**not** a weak law. Rule 110 is a few bits and is Turing-complete. Shortness doesn't limit
what a law can *produce*; it limits what can have been *written into* it. That is exactly the
property we want.

##### And it reshapes the search space

The search is therefore not a handful of numbers over one law. It is **a family of candidate force
laws, with constants inside each.** The form is a bigger degree of freedom than any constant,
and the documents were wrong to leave it out of the search entirely.

Which also means: **the first real finding of this project may be which forms of interaction
permit a chemistry at all.** That would be a result worth having on its own, independent of
anything above it on the ladder.

##### The simplification: law 2 is a condition, not a force

*(Worked out with Ric, 2026-11-03.)*

A pair potential in real physics does **three** jobs: it repels hard at very short range so
matter has volume, it attracts in a well at bonding range, and it fades to nothing far away.
Writing law 2 as a force means writing all three.

But two of them are already paid for:

- **Hard-core repulsion is free.** One primitive per hexagon *is* exclusion. Nothing can overlap,
  so nothing needs to push.
- **Long-range gathering is gravity's job**, and law 3 already does it.

What is left is the middle: *which pairs bond, and how strongly.* And since bonding only ever
happens between **adjacent** hexagons — locality demands it — the distance is always 1. It is not
a variable at all.

**So law 2 is not a force. It is a binding energy over two integers:** `B(k₁, k₂)`. No distance
function, no range, no force magnitude.

Four things follow, all of them improvements — and then three costs that the first version of
this section failed to mention, set out in *Open — what the simplification breaks* below. Read
both halves before treating this as settled.

**1. Two search constants disappear.** Pair force *strength* and pair force *range* both stop
existing. Seven numbers become five. (A scale factor relating `B` to thermal units is folded to 1
by choice of units — legitimate, and stated rather than hidden.)

**2. The momentum constraint dissolves.** The worry recorded above — that a force which points a
primitive at whatever attracts it creates momentum from nothing — stops applying, because **law 2
no longer moves anything.** Only collisions and gravity move matter, and both have defined
bookkeeping. The hardest constraint on the candidate forms was an artifact of writing law 2 as a
force.

**3. It becomes a condition rather than a formula**, which is exactly what *On math* names as the
goal and did not expect to reach.

**4. Melting points come out per pair, for free.** A bond survives while local thermal energy is
below `B` and breaks above it. So every pair of kinds has its own melting point, and a cluster's
melting point is a composite of the bonds holding it together and how many there are. **This is
the answer to the question that started the project** — why does metal melt at a certain
temperature — and nothing about it is written down. It is `B` and arithmetic.

**What it costs.** Nothing seeks anything at short range any more, so clusters assemble only when
thermal motion or gravity brings primitives into contact. In the Lab, which has no gravity, that is
a gas bonding on contact — ordinary gas-phase chemistry, and fine. The risk is that elaborate
structures never assemble because nothing draws their parts together. **The fallback, if clusters
will not form:** attraction at exactly r = 2, gated on `B > 1`. That is one bit of distance
dependence and one constant back, not the full potential.

##### The candidate slate, screened

Every candidate below is a single operation from the grammar rule 4 authorizes, so each passes
the description-length test trivially — which means **description length is not the
discriminator.** The screen is.

**And the screen has been run.** `screen.mjs` in this directory evaluates each form over all
65,025 ordered pairs of kinds 1–255 and reports: how many distinct binding energies it produces,
their 10th/50th/90th percentiles, what share sits at the single most common value, how many
families the strong-bond graph breaks into, how many kinds are near-inert, and the spread of
bonding degree. "Strong" is defined per-form as *above that form's own median*, so the
comparison is fair across forms with different scales.

| Form | distinct | p10 / median / p90 | modal share | families | near-inert | degree SD |
|---|---|---|---|---|---|---|
| **`B = a AND b`** | 256 | 1 / 40 / 160 | 9.3% | **41** | 40 | **66.0** |
| `B = lcm(a,b)` | 14584 | 528 / 7056 / 31620 | 0.1% | 28 | 30 | 67.4 |
| `B = gcd(a,b)` | 255 | 1 / 1 / 6 | 61.0% | 25 | 48 | 61.4 |
| `B = min(gcd(a,b), 16)` | 16 | 1 / 1 / 6 | 61.0% | 25 | 48 | 61.4 |
| `B = popcount(a AND b)` | 9 | 1 / 2 / 4 | 31.4% | 37 | 36 | 57.0 |
| `B = gcd + popcount(a AND b)` | 227 | 2 / 4 / 8 | 23.8% | 6 | 11 | 44.3 |
| `B = 255 − \|a − b\|` *(control)* | 255 | 81 / 180 / 242 | 0.8% | 1 | 0 | 24.6 |
| `B = 255 − (a XOR b)` | 256 | 25 / 128 / 230 | 0.4% | 2 | 0 | **0.5** |
| divisibility: high if `a \| b` or `b \| a` | 2 | 1 / 1 / 1 | 95.9% | 1 | **216** | 19.2 |
| `B` high iff `(a + b) mod 16 = 0` | 2 | 1 / 1 / 1 | 93.7% | 9 | 0 | **0.5** |

**What it said, and it was not what was predicted.**

**`a AND b` leads, and `gcd` was the prediction.** Binding strength is the bits two kinds have in
common, weighted by place value. It beats `gcd` on energy distribution (spread across the whole
range rather than 61% piled at 1), on family count (41 against 25) and on degree spread (66.0,
the widest of any form). It also produces **genuine zeros** — kinds with disjoint bit patterns do
not bond at all — where `gcd` never returns less than 1, so inertness is real rather than merely
weak. Prediction recorded as wrong; the measurement stands.

**But the measurement is not the whole judgement.** `a AND b` depends on the **base** the kinds
are written in, which `gcd` does not, and that is invisible to every diagnostic here. Point 4 of
*Open — what the simplification breaks* argues it, and the upshot is that `min(gcd, 16)` is
probably the strongest candidate overall despite scoring lower on this table.

**`gcd` is a solid second**, and `min(gcd, 16)` has *identical* structure — same families, same
degrees, same inert count — with only 16 distinct energies instead of 255. So capping is
structurally free, which matters because `gcd(a, a) = a` otherwise gives heavy kinds self-bonds
near 255 that may be unbreakable at any achievable temperature.

**Adding operations made it worse.** `gcd + popcount` collapsed families from 25 and 37 down to
6, and near-inert kinds from 48 and 36 down to 11. Two operations produced a flatter world than
either operation alone. Short is not only cheaper here; it is better.

**Regularity has a signature, and it is one number.** The two crystal-makers — `(a+b) mod 16` and
`255 − (a XOR b)` — both come out at degree SD **0.5**, meaning every kind has essentially the
same number of partners. No variation in degree means no columns, which means no periodic table.
That single statistic identifies them instantly.

**`lcm` is killed by the ontology, not by its structure.** Its diagnostics are fine — 28
families, degree SD 67.4 — but its values reach 64,770 and the energy field holds 2047. It
overflows on contact. A reminder that `AGENTS.md` rule 5's field widths are a live constraint on
the physics, not just on the code.

**The control failed, as designed.** `255 − |a − b|` gives one family, zero inert kinds, and
energies whose 10th percentile is already 81 — everything bonds strongly to everything, which is
the blob. Its failure is what licenses believing the rest of the column.

**Four of ten rejected without running anything.** `divisibility` (216 of 255 kinds near-inert —
that is a gas, not a chemistry), both crystal-makers, and the control. That is the screen earning
its keep.

**The honest limit.** These four diagnostics are our own invention, not a validated instrument,
and they measure **a table of pair energies, not a world.** Whether stable multi-primitive
clusters actually form under motion, capacity and temperature is not readable off this table at
all. The screen can show a form *cannot* work. Only the Lab can show that one does.

##### What the four diagnostics are, and why these four

- **Binding-energy distribution.** Want **wide and lumpy.** Narrow means everything melts at
  once, which is mud. All-or-nothing means crystal or gas with nothing in between. The *modal
  share* is the test: `a AND b` sits at 9.3%, the crystal-makers above 93%.
- **Family structure.** A graph on the 255 kinds with an edge wherever `B` is above that form's
  median, then its connected components. Want *several* families of differing size. One giant
  component means everything bonds to everything, which is a blob; 255 isolated nodes means
  nothing bonds, which is a gas. Note the components are threshold-dependent, so for a graded
  form like `gcd` or `a AND b` the families are really a **hierarchy** — raise the bar and they
  fragment further. That is richer than a fixed partition and the single number understates it.
- **Near-inert count.** How many kinds bond strongly with under 5% of the others. Want **some** —
  those are the noble gases — but not most. `divisibility` fails here on its own: 216 of 255.
- **Degree spread.** Want real variation: some promiscuous kinds, some picky. **This turned out
  to be the sharpest single statistic.** Uniform degree means no columns, and both crystal-makers
  land at SD 0.5 while the survivors are above 57.

**So the biggest hole in the project is also the cheapest part of the search.** Thousands of
candidate forms can be filtered before a single universe runs, and `screen.mjs` does 10 in
milliseconds.

##### And the warning that comes with any of these

`a AND b` will produce beautiful structure: bit-pattern families, truly inert kinds, high-bit
hubs that bond with everything. `gcd` would do the same with factors and primes. **It will look
like a discovery. It is not one.** That structure is in the *law*, so finding it in the output is
confirmation the code works and nothing more.

A finding is something the form does **not** predict — a stable cluster whose composition the
family structure does not explain, a reaction that crosses families, a melting point that is not
a composite of its bonds. So: **run `screen.mjs`, write down the families and the predicted
inert kinds, and keep that file** before the first simulation. Then there is something to be
surprised against. Without it this is the prettiest available way for the project to fool
itself, which is rule 11's entire subject.
##### What the simplification cost — four problems, all now closed

*(Found by reading law 2 back on Ric's instruction, 2026-11-04. The simplification above is
still right, but it was written up as though it cost nothing. It costs these.)*

**1. It breaks the stated argument for catalysis — though not catalysis itself.** *What came off
the list* argues catalysis needs no law because "a third primitive nearby exerts force on the
reactants, reshaping the local energy landscape." **That is a force argument**, and a pure pair
function `B(k₁, k₂)` has no force and no local landscape, so that particular mechanism is gone.

**But catalysis survives by a different route, which is the one reality uses:** a cluster's
*shape*. See *Catalysis is available after all* below — it took two wrong turns to get there, and
both are recorded. What this point costs is therefore the old *justification*, not the capability.

**2. Nothing says when a bond *forms*.** Breaking is specified — thermal energy above `B`. Formation
is specified nowhere in any of the five documents; the only mention is that the unspecified law
contains it. And the obvious default is a disaster: if a bond forms whenever two primitives are
adjacent and capacity allows, then **everything glues on first contact.** Every primitive
saturates immediately, the world sets into whatever arrangement happened to collide first, and
there are no reaction rates at all. That is not chemistry, it is glue. Real chemistry has
activation barriers, which is why a jar of hydrogen and oxygen sits there until you light it.

**One fix handles both, and it is real physics rather than a patch.**

In our universe two atoms colliding **cannot** form a molecule by themselves: the new bond's
energy has nowhere to go, so the pair flies apart again. A **third body** has to carry the excess
away. That is three-body recombination, it is why recombination rates depend on pressure, and it
is credited in `SOURCES.md`.

So: **a bond forms only if the released binding energy `B` has somewhere to go** — a neighbour
cool enough for law 5 to move it to. That single condition gives:

- **A formation rule** that is not arbitrary, so no instant gluing. In a hot region nothing can
  shed `B`, so nothing bonds; as the region cools, bonds become possible. The world gets a
  recombination era out of the same mechanism, which is what the one-run chronology in
  `TWO-RUNS.md` wanted anyway.
- **Reaction rates**, because formation now depends on the neighbourhood rather than only on the
  pair.
- **A third-primitive effect.** A cool neighbour makes a bond possible that was impossible
  without it, is left hotter, and returns to its former state once that heat diffuses away.
- **No new law.** It lives at the seam where laws 2 and 5 meet, exactly like the existing
  structural fact about bond energy being exact.

**But not catalysis, and the first version of this section said otherwise.** A third-body effect
is not a catalyst: the sink is *any* cold neighbour, indifferent to what kind it is, and a real
catalyst is **selective** — it lowers the barrier for one particular reaction because of what it
is. Selectivity is what makes pathways, and pathways are what autocatalytic cycles are made of.
Calling this rung three would be the self-deception rule 11 exists to prevent. The full weighing
is below, and it is not favourable.

###### Heat-sink formation, weighed properly

*(Ric asked for the positives and negatives, 2026-11-04. The negatives are heavier than the
first write-up of this idea suggested, and one of its claimed benefits has to be walked back.)*

**What it gets right**

- **A formation rule with a reason**, rather than "bonds form when adjacent," which glues
  everything on contact.
- **Reaction rates**, because formation depends on the neighbourhood and not only on the pair.
- **A recombination era for free.** Hot regions cannot shed `B`, so nothing bonds; as they cool,
  bonding switches on. That is the chronology `TWO-RUNS.md` wanted, falling out of the mechanism
  instead of being scheduled.
- **Pressure dependence, matching reality.** Real recombination rates rise with pressure because
  there are more third bodies about. Denser regions here have more neighbours and so more
  candidate sinks. An emergent match nobody designed.
- **No new law.** It sits at the law 2 / law 5 seam, like the existing bond-energy structural fact.

**What it gets wrong**

**1. It biases the world against exactly the bonds worth having.** A large `B` needs a bigger,
colder sink, so **the strongest bonds are the hardest to form.** The whole point of wanting a wide
binding-energy range is deep, varied, durable structure — and this rule means the realised
chemistry would be narrower than the available chemistry, weak bonds everywhere and strong ones
almost nowhere. That is a flattening, which is the failure mode the screen exists to avoid.

**2. The interior of a structure cannot bond.** Bonds forming nearby release heat, so the inside
of anything growing is hot and has no sink. Growth happens only at a surface with something cold
next to it. Real crystals do grow at their surfaces, so this is not obviously wrong — but it is a
strong constraint on what shapes are reachable, and it was not chosen deliberately.

**3. It is not catalysis, and saying so was overclaiming.** The "catalyst" is *any* cold
neighbour. A real catalyst is **selective** — it lowers the barrier for a particular reaction
because of what it is, which is what makes enzymes and therefore pathways possible. Here the
effect is indifferent to the third primitive's kind, beyond heavy cold primitives being slightly
better sinks because temperature is energy per unit of kind. So this buys a **third-body effect**
and not selectivity, and autocatalytic cycles need selectivity. Calling it rung three would be
precisely the self-deception rule 11 is about.

**4. It weakens the pre-screen, which was the cheap win.** `B` can be scored on its own; "can this
bond shed its energy" cannot. Whether a form works would then depend on the transport rate and the
thermal state too, so the screen stops being predictive and the form stops being separable from
two constants.

**5. It is entangled with the vacuum question, and the entanglement cuts both ways.** Vacuum is
the coldest thing there is and it surrounds almost everything, so if energy can enter vacuum
(law 5's option 4) then nearly every site has a perfect sink and **the barrier almost vanishes** —
back to gluing on contact. If energy cannot enter vacuum, the barrier is real but then only
matter-adjacent bonds form. **So this rule's entire strength is set by a decision that has not
been made.** It cannot be adopted before that one is.

**6. Formation and breaking would be asymmetric, and that may be fatal.** Formation needs a sink
for `B`. Breaking needs a *source* of `B` — and nothing says breaking is gated at all. Gate one
and not the other and the world ratchets: bonds break freely, form rarely, and everything drifts
to unbonded. The condition has to be symmetric, or the asymmetry has to be deliberate and argued.
This was introduced without being noticed, which is exactly what this section is for.

###### Catalysis is available after all, and the earlier claim was wrong twice

*(Ric asked whether law 2 really can't have catalysts, 2026-11-04. It can. This retracts both
the "the simplification deletes catalysis" framing above and the stronger claim that followed
it.)*

**The claim that was wrong:** that a pure pair function `B(k₁, k₂)` cannot produce a selective
catalyst, because selectivity has to come from what a third primitive *is* and a pair function
has no term for a third primitive.

**Why it is wrong: selectivity comes from geometry, not from a third-body term.** A pair function
fixes the binding energy between *two* primitives. A **cluster** is many primitives, and on a hex
lattice with capacity below 6 it has a shape. So a cluster can present a **pocket** — a concave
site where an arriving primitive is adjacent to several of the cluster's primitives at once, each
adjacency carrying its own `B`.

That pocket is selective, and nothing was added to the law to make it so. Under `gcd`, a pocket
lined with kinds 12, 18 and 30 grips a kind-6 primitive at three sites at once (`gcd` 6 with each
of them) and a kind-7 primitive at none. **Shape plus pair energies is selectivity**, and the
README already says hexagons hand us shape — angles, branching, isomers — with no extra law.

**And this is exactly how real enzymes work.** A protein is atoms interacting pairwise; there is
no three-body term anywhere in the underlying physics. An enzyme's selectivity is the shape and
composition of its active site, and a large part of its *acceleration* is the **proximity and
orientation effect** — it holds the reactants next to each other, correctly oriented, for a long
time, instead of waiting for them to collide by chance at the right angle. Credited in
`SOURCES.md`.

So the full rung-three mechanism, with no new law:

1. A cluster with a pocket binds two reactants **adjacent to each other**, and holds them.
2. Held in contact, they have far more opportunity to bond than they would get from a chance
   collision — so the reaction **goes faster**.
3. The pocket's own internal bonds are untouched by the guest, so once the product leaves it is
   **unchanged and ready again.**

Selective, accelerating, regenerated. That is rung three's definition exactly.

**This settles the formation-rule question too.** Step 2 only works if bonding is **rate-based**:
if a bond formed the instant two primitives touched, holding them together would buy nothing,
because they would have bonded on first contact anyway. **So probabilistic formation is not
merely the simpler option — it is the one that makes catalysis possible at all**, and the
heat-sink rule is not needed for this and loses its last advantage.

**What is not settled, and must not be assumed.** The *mechanism* is available; whether this
chemistry produces usable pockets is empirical and belongs to the Lab and the World. The specific real
failure mode to watch for is **product inhibition**: a pocket that binds its product more tightly
than its reactants never releases it and jams forever. For a product to leave, its kinds must
have lower `B` with the pocket's lining than the reactants did — a real constraint, satisfied by
some pockets and not others. **The ones that do not jam are the catalysts**, which makes this
something to search for rather than to expect.

**And the mistake is worth recording, because it is the one these documents exist to prevent.**
Both wrong versions came from looking for catalysis **in the law** instead of expecting it to
emerge from the law. That is rule 2 — never store what should emerge — failing in its mirror
form: not writing a feature in, but concluding it is impossible because the law does not contain
it. The original *What came off the list* entry had the right instinct and the wrong mechanism;
the instinct was what mattered.

###### The simpler alternative, which should be compared against it

**This is the one that won, and its temperature clause was then found to be backwards** — see
*Correction — formation getting slower when hot was backwards* at the end of this law. The rate is
now a fixed per-attempt probability, with the temperature dependence coming from the clock. The
text below is as written on 2026-11-03.

**Formation is probabilistic, at a rate set by temperature.** No sink requirement: two adjacent
primitives with capacity to spare bond with a probability that falls as local temperature rises.
Event-driven time is already built for exactly this.

It is **simpler**, it gives rates, it prevents instant gluing, it keeps `B` separable so the screen
stays predictive, and it does not touch the vacuum question. What it does **not** give is any
third-body effect at all, so catalysis stays deleted.

So the real choice is not "heat sink or nothing." It is:

| | Heat sink | Probabilistic rate |
|---|---|---|
| Formation barrier | Yes, thermodynamic | Yes, stochastic |
| Reaction rates | Yes | Yes |
| Third-body effect | Weak, non-selective | **None** |
| Biases against strong bonds | **Yes** | No |
| Screen stays predictive | **No** | Yes |
| Depends on the vacuum decision | **Yes** | No |
| New law needed | No | No |

Neither gives a selective catalyst *by itself* — and that was briefly written up here as proof
that a pure pair function could never have one. **That was wrong; see above.** Selectivity comes
from a cluster's **shape**, which is many pair interactions arranged in space, and needs no
third-body term in the law at all.

**Which decides this table.** Catalysis needs reactants to be *held in contact longer than chance
would hold them*, and that only buys something if bonding is rate-based — if a bond formed the
moment two primitives touched, a pocket would be useless. **So probabilistic formation wins**, and
the heat-sink rule, whose one remaining advantage was its third-body effect, no longer has it.

###### The last two questions, answered as one

*(Ric: fix the other two issues, 2026-11-04. Working the first one decided the second.)*

**The breaking condition is a temperature, not an energy.**

Breaking a bond *costs* `B` of energy — that part is already the structural fact about bond energy
being exact. What was unstated is the **condition**: how hot is hot enough. Stating it in raw
energy repeats law 5's bug exactly, because at the *same temperature* a heavy primitive holds more
total energy than a light one, so an energy threshold would make **heavy primitives break bonds
more readily than light ones**, which is backwards.

The right comparison is the one real physics makes — thermal energy per degree of freedom against
binding energy, `kT` against `B`. Our temperature is energy per unit of kind, so:

> **A bond breaks when `e / k ≥ B` at *either* endpoint.** In integers, with no division:
> **`e ≥ B · k`.** One multiplication, exact.

Either endpoint, because the bond is shared: if one end gets hot enough, the bond goes. And a
check that it behaves: at temperature 1 a kind-200 primitive (`e` = 200) needs `e ≥ 16 × 200`
to break a `B` = 16 bond, so it holds; so does a kind-1 primitive at the same temperature. Raise
both to temperature 20 and both break. Heavy and light now melt at the same temperature, which is
the whole point.

**And that exposed a hard ceiling nobody had noticed.** Energy was 11 bits, so the hottest a
kind-`k` primitive could ever get was `2047 / k`:

| kind | hottest reachable | so it can break bonds up to |
|---|---|---|
| 1 | 2047 | 2047 |
| 16 | 127 | 127 |
| 64 | 31 | 31 |
| 127 | 16 | 16 |
| 200 | 10 | 10 |
| **255** | **8** | **8** |

So **`B` must be capped at 8** for every kind to be able to break every bond. Above that, heavy
primitives physically cannot get hot enough, their bonds never break, and matter accumulates into
permanently inert lumps — removed from the world's economy forever. (That is *arguably* a ratchet,
open question 9's subject. It is more likely death by sedimentation, and it should be a decision
rather than a side effect of a field width.)

**Which decides the form, and not the way the screen did.**

Capping is **structurally free for `gcd`** — measured, not argued. `min(gcd, 4)` through uncapped
`gcd` all give *identical* families (25), near-inert count (48), degree spread (61.4) and modal
share (61.0%). Only the number of distinct energies changes. The reason is in the distribution:
**gcd's mass already sits below 8** — its median is 1 and its 90th percentile is 6 — so a cap at 8
barely clips anything.

**Capping destroys `a AND b` completely.** `min(a AND b, 8)` collapses to **255 families, 255
near-inert kinds, and a degree spread of 0.0** — every kind isolated, no bonding graph at all. Its
median is 40 and its 90th percentile is 160, so **its entire structure lives above the cap**, and
8 demolishes it.

So `a AND b` won the uncapped screen and **loses on physics**: it needs a binding range the energy
field cannot support without making heavy matter permanently inert.

> **`B = min(gcd(k₁, k₂), 8)`** — the form to build first.

Three independent arguments converge on it, which is why this is written as settled rather than as
another open item:

1. **Principle.** `gcd` is a property of the numbers; `a AND b` is a property of how they are
   written down. Kind *is* mass, and no law in our universe depends on the base its quantities are
   spelled in.
2. **Measurement.** Capping `gcd` costs nothing structurally. Capping `a AND b` costs everything.
3. **Arithmetic.** The field widths force a cap of 8, and only one of the two survives it.

**The honest caveats.** The cap of 8 leaves only 8 distinct binding energies, which is a narrow
palette — `min(gcd, 8)` keeps gcd's *topology* but compresses its thermal range, so bonds of
strength 7 and 8 melt at nearly the same temperature. Whether 8 levels is enough thermal
differentiation for a chemistry with depth is exactly what the Lab is for, and it is the first thing
to vary if the table comes out flat. And the 8 is a consequence of the **field widths**, not of the
physics: widen energy to 16 bits and the cap becomes 257. That is a representation decision with a
physics consequence, which `AGENTS.md` rule 5 warned about and this is the first case of it biting.

**3. ~~The breaking condition says "thermal energy" where law 5 was fixed to say temperature.~~**
**Resolved** — see *Settled* above; the condition is `e ≥ B · k`. The original statement of the
problem follows, kept because it is how the fix was found.
Law 5's whole correction was that comparing raw energy moves heat uphill, because a heavy cold
primitive holds more total energy than a light hot one. Bond breaking is stated in the
*unfixed* quantity — and it does not say **which** endpoint's energy counts, or whether it is one,
the larger, or the sum. As written, a heavy primitive breaks bonds more readily than a light one
at the same temperature, which is backwards.

There is a real question underneath, not just a wording slip: breaking a bond costs `B` of
**energy** regardless of how hot that is, so the *condition* is energetic — but the *rate* at
which it happens is set by temperature. Both belong in the final statement and neither is written
down. This is the same class of bug the external review caught, still open in a second place.

**4. ~~And `a AND b` has a problem the screen cannot see: it depends on base 2.~~**
**Resolved** — see *Settled* above; the form is `min(gcd(k₁, k₂), 8)`, and base-dependence turned
out to be the weaker of the three reasons. The original argument follows.

The screen scores `a AND b` top on every diagnostic. But kind *is mass* — law 1 made it "how much
stuff this primitive is made of" — and a law built on the **bit pattern** of a mass is a law about
how we chose to write the number down. Write kinds in base 3 and the physics changes. Mass 8 and
mass 16 have disjoint bits and so do not bond at all, while 8 and 24 bond at strength 8; nothing
about the quantities justifies that, only their binary spelling.

`gcd` has no such problem. Sharing a factor is a property of the numbers themselves and survives
any base. **No law in our universe depends on the base you write its quantities in**, and this
project's whole discipline is refusing to smuggle in designer choices — binary is a storage
decision, not a physics one. The hexagonal lattice is a representation choice too, but it is a
*declared* structural fact with isotropy as its reason; base 2 has no such argument.

So the screen and the principle disagree, and **the screen cannot settle it**, because
representation-dependence is invisible to a measurement of the table. On the metrics `a AND b`
wins; on principle `gcd` or `min(gcd, 16)` wins. That is unresolved, it is a genuine tension
rather than an oversight, and the honest reading is that `min(gcd, 16)` is the strongest candidate
once principle is weighted at all — it has gcd's representation-independence, identical structure
to plain gcd, and bounded energies that cannot produce unbreakable heavy self-bonds.

#### Correction — formation getting *slower* when hot was backwards

*(2026-11-04, found while settling the clock for law 5. Not caught by review — caught by having to
say what set the clock rate.)*

Law 2 said a bond **"forms at a rate that falls as local temperature rises."** That is the wrong way
round. In real chemistry heating speeds every elementary step **up**, in both directions — that is
what an Arrhenius rate is, and there is no reaction anywhere that forms more slowly because you
heated it. What *does* happen when you heat a mixture is that the **equilibrium** shifts away from
the bonded state, because the reverse step has the larger barrier and so gains more from the heat.

So the clause conflated a **rate** with an **equilibrium** — exactly the class of error the external
review caught in law 5, where a comparison of energies was standing in for a comparison of
temperatures. Twice now the mistake has been using the convenient quantity in place of the correct
one.

It mattered, and not only on paper:

- At low temperature formation would be *fastest* while breaking never fires, so a cold world sets
  solid on contact — which is the glue failure the rate was introduced to prevent, moved to the
  cold end instead of removed.
- Catalysis needs reactants held in contact **longer than chance would hold them**. If formation is
  quickest when cold, a pocket buys the least where chemistry is actually running.
- There is no temperature window. Real chemistry is interesting in a band where formation is fast
  enough to happen and breaking fast enough to stop everything jamming. Rates falling with heat and
  a hard breaking threshold give a cold glue regime and a hot gas regime with nothing in between.

**The fix removes the clause rather than inverting it.** The clock now runs at a rate proportional
to temperature, so the *attempt frequency* rises with heat for every law at once — that is the `A`
in an Arrhenius rate, supplied once and shared. Law 2 keeps a fixed per-attempt probability and
`e ≥ B · k` for breaking, and the temperature dependence that the clause was reaching for emerges:
net formation rises with heat, breaking bites above `T = B`, and the band between them is where
chemistry lives.

**Which makes law 2 shorter, and that is the point.** Temperature leaves the law's text entirely.
This is rule 2 — never store what should emerge — applied to a rate rather than to a structure, and
law 2 is now a binding energy, a fixed formation probability and a breaking threshold, with no
distance term and no temperature term in it.

*(Still open, and unchanged by this: the breaking **rate**. The condition `e ≥ B · k` says when a
bond may break; the clock says how often the question is asked. Whether that is the whole of it, or
whether breaking needs its own barrier, is not decided.)*

---

#### Retraction — `gcd` was the wrong class of function, and the screen could not see it

*(2026-11-04, hours after `min(gcd, 8)` was settled, from Ric's review. Fourth retraction in law 2,
and the only one driven by a measurement the screen was not previously making.)*

**What is retracted.** `B(k₁, k₂) = min(gcd(k₁, k₂), 8)`, chosen over `a AND b` on principle
(representation-independence) and on the cap being structurally free.

**Both of those grounds still hold, and neither saved it.** They were about `gcd` versus one rival,
and they were correct. The screen measured **spread** — distinct values, percentiles, modal share,
family count, near-inert count, degree spread — and every one of those is a property of the table's
*distribution*. Neither fault below is.

**Fault one: roughness.** Kinds grow by **addition** (fusion is `1 + 1 → 2`) and `gcd` reads
**multiplicative** structure. Addition and multiplication interact chaotically, which is roughly
the content of why primes are hard. Measured as mean `|B(k+1, b) − B(k, b)|` over all pairs,
divided by the form's own mean:

| form | roughness |
|---|---|
| `gcd`, uncapped | 1.340 |
| `min(gcd, 8)` | **0.916** |
| complementary, `v = k mod 8` | **0.259** |
| like-with-like control, `v = k mod 8` | 0.254 |

At 0.916, **changing a kind by one unit moves its binding energies by 92% of their own mean.** Mass
60 (2²·3·5) is a super-bonder; mass 61 is near-inert. All 48 near-inert kinds under `gcd` are the
large primes, and they are chemically identical to one another — 11, 13 and 251 all return `B=1`
against everything — so they are not 48 species but one species 48 times.

That matters because **accumulation needs small changes to usually produce small changes.** A
structure that cannot improve by one step cannot climb, and under `gcd` every step re-rolls the
chemistry. This is the rugged-landscape result from the fitness-landscape literature: a maximally
uncorrelated landscape is unsearchable in principle, not merely in practice. The control scoring
0.254 against the complementary form's 0.259 confirms the metric reads **shape** and not noise —
two forms with the same column structure score the same, as they should.

**Fault two, and the worse one: the maximum sits on the diagonal.** `gcd(k, k) = k` is the largest
value any row can hold, so **every kind's single best partner is itself — 100% of them, measured.**

The consequence runs straight into the catalysis argument settled earlier the same day. That
argument is right: a cluster presents a **pocket**, and shape plus pair energies is selectivity with
no third-body term needed. But a pocket lined with kinds whose best partner is themselves grips
**copies of its own lining.** That is crystal growth. It templates *sameness*, sameness carries no
information, and so there is nothing for accumulation to accumulate or for selection to select. The
hand-picked example in that section — a pocket of 12, 18 and 30 gripping a kind-6 — does work, but
the measurement says it is the exception and self-affinity is the rule.

This log had already half-caught the fault and misread it as thermal: *"`gcd(a, a) = a` otherwise
gives heavy kinds self-bonds [that cannot break]."* Unbreakable heavy self-bonds are the
**symptom**. The diagonal maximum is the **cause**, and capping at 8 treats the symptom while
leaving the cause untouched.

#### Settled — complementary valence, and why the class is the claim

> **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, where **`v(k) = k mod 8`**

Three variants were screened. `v = k mod 8` with a target of 8 wins on the diagonal measure, which
is the one that decides whether pockets copy or crystallize:

| form | best partner is itself | roughness | families | near-inert | degree spread |
|---|---|---|---|---|---|
| `min(gcd, 8)` | 100% | 0.916 | 25 | 48 | 61.4 |
| `v = k mod 8`, target 8 | **25%** | 0.259 | 1 | 0 | 21.9 |
| `v = 1 + (k−1) mod 8`, target 9 | 49% | 0.254 | 1 | 0 | 13.8 |
| `v = 1 + (k−1) mod 6`, target 7 | 66% | 0.220 | 1 | 0 | 19.8 |

What it buys beyond fixing those two faults:

- **Periodicity, which is what a real periodic table has.** Valence repeats every 8, so there are
  columns with **graded** members rather than isolated spikes. `gcd`'s families are a divisor
  hierarchy; these are columns.
- **Complementarity, which is base pairing.** `v=1` bonds best with `v=7`, `v=2` with `v=6`,
  `v=4` with itself. The maximum sits off the diagonal, which is the one thing a copy needs that a
  crystal does not.
- **Two tiers of bond strength at once.** `B` runs 0–8 densely, so a backbone at 8 can coexist with
  cross-pairing at 3: strong enough to hold a chain together, weak enough for heat to separate a
  copy from its template. That is the DNA architecture, and it is why a **heredity** rung was added
  to the acceptance ladder. Under `gcd` the values are 1 for most pairs and spike on the diagonal,
  so there is no usable second tier.
- **One connected chemistry.** A single family containing all 255 kinds and no near-inert kinds,
  where `gcd` fragments into 25 components with 48 kinds unable to participate at all.
- **Fusion moves a kind one column at a time**, because adding 1 to a kind adds 1 to its valence. So
  chemistry changes *gradually* as matter gets heavier, which is the correlated landscape the
  ladder needs.

**What it costs, honestly.** Pairing is specific at the level of the **valence class** rather than
the individual kind: 255 kinds over 8 columns means about 32 kinds tie for any given best partner,
against 22.5 under `min(gcd, 8)`. So this form is *less* specific per kind on that measure. That is
not a defect — it is what a column of a periodic table is, and it is why eight columns rather than
255 — but it is a real difference and it is recorded rather than buried. It also removes inertness
entirely, 0 near-inert kinds against gcd's 48, and some genuinely unreactive species would be
useful as scaffold; `v=0` kinds come closest, bonding at 0 with each other and only at 7 with
`v=7`.

**And the class is the claim, not the formula.** What is settled is that the pair force must be
**periodic in kind**, so the landscape is correlated under fusion, with its **maximum off the
diagonal**, so pockets copy rather than crystallize. Any form with those two properties is a
candidate, and `8 − |v₁ + v₂ − 8|` is the shortest one found so far.

**This also corrects a standing assumption about description length**, which `AGENTS.md` rule 7 and
law 2 both lean on. Short description is an **anti-smuggling** test, not a goodness test. Rule 110
proves a short rule *can* be rich; the overwhelming majority of short rules are dead. `gcd` passes
the length test as cleanly as the complementary form does, and the two differ by a factor of three
and a half in roughness and by 100 against 25 percent on the diagonal. So shortness belongs as a
**filter on a search over richness**, not as a proxy for it. This is the first case where that
distinction decided anything, and it is why the screen now measures shape as well as spread.

## 3. Gravity

#### Correction — a rule that was referenced four times and never existed

*(2026-11-04.)* These documents referred to **"the deflection rule"** — how gravity turns a
primitive — in four places across two files, one of which stated a *consequence* of it ("a heavy
primitive is as easy to deflect as a light one"). **It was never defined anywhere**, and a search
of the entire working conversation found no definition there either. It entered as a placeholder in
an argument about why orbits do not work, where its details did not matter, and later sentences
began treating it as a thing that existed.

The cause was structural rather than careless: **option (A) had no way to express a force.** Gravity
yields a direction and a strength, and when momentum *is* a direction the strength has nowhere to
go. Something had to stand in for it, so a bespoke turning rule was gestured at instead of written.

**The fix was to delete the need for it, not to define it.** Option (B) stores momentum as a vector,
so gravity simply adds to it — which is all `F = dp/dt` says — with no new rule, and the real
world has no deflection rule either. The full argument is under law 1, *How option B was settled*.

**The lesson is about these documents rather than the physics.** A placeholder phrase in a
side-argument got cited as established, and nothing caught it for a day because every citation was
consistent with every other. Naming a rule is not the same as having one — if a rule is referenced
and you cannot point at its statement, it does not exist.

#### Correction — gravity must never touch chemistry

*(Ric: is gravity plus an artificial chemistry too much, and is gravity simply too
weak to matter to it? The second question answers the first.)*

**In reality gravity has no effect on chemistry at all.** The gravitational attraction between
two atoms is on the order of 10⁻³⁶ of the electromagnetic force between them. Chemistry runs
identically on Earth, in orbit, and in the core of Jupiter. Gravity's whole contribution to
chemistry is *indirect* — it makes the stars that make heavy elements, it sets pressure and
temperature, it holds atmospheres, it drives convection and sedimentation. **It never touches a
bond.**

So the two laws are not competing, and this design is less tangled than it looks. **The
connection is thermodynamic, and the chain is already here**: gravity → compression → heat (this
law) → temperature (law 5) → bonds form or break (laws 2 and 4). Gravity reaches chemistry
through the energy budget and nowhere else, which is exactly what the justification above
claims.

**But nothing guarantees that separation, and something should.** Gravity strength and pair
force strength are two independent numbers in the search space with no stated relationship
between them. Set them to comparable magnitudes and gravity perturbs bonding directly — and then
**which reactions run depends on where in the world you are.** That is precisely the
contamination the Lab exists to exclude, walking back into the World through the front door.

So this is a constraint on the search space rather than a preference: **the gravitational force
between two adjacent primitives must be negligible against the weakest pair force.** Orders of
magnitude, not a factor of two. Reality's 10³⁶ is not required, but the ordering has to hold, or
the scales are not separated and the Lab's measurements stop meaning anything at scale.

It is also a cheap **filter**: any candidate constant set that violates it is dead before it
runs, and can be rejected without spending a universe on it.

#### Correction — the ceiling had no floor, and at 4096² there is no room between them

*(2026-11-05. Ric: "I have a hunch gravity is too strong right now." Measured in `orbit.mjs`
Checks 6 and 7. Open as README item 20.)*

**What it said.** The entry above set a ceiling — gravity at arm's length negligible against the
weakest bond, "orders of magnitude, not a factor of two" — and called it a free filter. Nothing set
a floor, and gravity was never given a value, so the ceiling read as the only constraint and
"weaker" looked like the safe direction.

**What was missing.** Law 3 exists because it is where the energy comes from. That is a
requirement on strength just as much as the ceiling is: collapse has to heat *something* past the
weakest bond, or the gradient it was bought to produce never reaches chemistry and the world is
frozen solid. So stated in one unit, ε — what two kind-255 primitives release falling into contact,
over the weakest bond — the ceiling is ε ≤ 0.01 and the floor is wherever a clump's binding energy,
shared over its kinds, reaches temperature 1. The binding energy was measured over real lattice
discs: mean pair potential **6.15 × radius**, linear from radius 64 to 256. At ε = 0.01 the whole
World collapsed into a single ball reaches **0.13**. A clump of radius 256 needs ε = 0.65; radius 64
needs 2.6.

**So the two constraints exclude each other at this size.** The entry above was right that reality
does not need its 10³⁶ — but reality *has* it, because a star is 10⁵⁷ atoms deep and the floor falls
as one over the depth. A World 2,151 hexagons in radius has about one order of magnitude to spend,
and only if all of it is one clump. That is item 13's worry made into a number, and it is worse than
item 13 guessed.

**What the hunch got right.** `orbit.mjs` had been choosing a strength silently, eighteen times —
whatever made each start circular — and never checked it against the ceiling. Treated as a point
mass the centre pulled at ε = 565 to 14,118. Those orbits were run at a gravity the laws forbid.

**What it also settled.** Item 19's rounding rule is not a physics choice. The strongest pull anywhere
in the World reaches half a unit per tick only at ε ≥ 3.2, so at any legal strength rounded gravity
is off everywhere, not beyond some radius. Law 3 carries the remainder; where it lives is still open.

**The levers**, recorded so nobody reaches for one without seeing the others: a bigger World; a
looser ceiling, accepting some location-dependent chemistry; a different falloff exponent (1/r's
logarithmic well is far deeper, and was rejected for global collapse — unmeasured here); or heat at
the start, which deletes the sentence law 3 was bought for. The screened field makes it worse.

#### Measured — where the remainder lives, and why not the coin

*(2026-11-05, `orbit.mjs` Checks 11 and 12. README item 19. Recommended, not adopted.)*

**What it said.** Check 7 had settled that law 3 carries a sub-unit pull instead of rounding it.
It left one question open: where to keep it. The framing was a residual in the 24 spare bits,
with an entry in `THE-LAWS.md` and a reason, as Ric's call.

**What the framing missed.** A residual is a register, and a register rounds. Twelve bits a
component in the spare 24 gives a step of 2⁻¹¹. Almost every pull at a legal strength (10⁻⁴ to
10⁻⁹ a tick) is under half of that. So the spare bits would have repeated Check 7's mistake
four thousand times further down. Gravity would be off for nearly everything, and the code would
look as though it carried the remainder. That is the trap rule 5 describes, a width quietly
choosing physics, and it was one sentence from being adopted.

**The tempting alternative, rejected on measurement.** Store nothing and draw each tick's whole
kick with the probability its fraction gives. This is stochastic rounding (Croci et al. 2022,
`SOURCES.md`), done on the triangular lattice of momentum vectors so that no axis is
preferred. It is exact on average, costs no memory, and matches the coin item 21 adopted for step
ties, so it looked like the house style. It completed **no** legal orbit of 18. The reason is shot
noise. A lap owes 2π|p| units and the coin delivers that ± its square root, so the scatter in a
lap is √(2π/|p|) of the momentum: 1.1 at |p| = 5, and 0.3 even at 64. That spread is heat on
anything coasting, with no fall to pay for it. It would read as collapse heating and break the
World's monotonic energy invariant everywhere. **The coin is right for ties and wrong for
gravity, and the difference is that a tie costs no momentum.** A tie picks between two equally
good steps, and the momentum is the same either way. Gravity's coin moves momentum itself, so
its noise accumulates.

**What works.** 32 bits a component in a second array. It matched the grainless carry on every run
and every seed, and loses at most one unit in about 2³² ticks. It is gravity's own state, like
φ, not the matter word's, and the residual joins the momentum assertion.

#### Open — a hierarchy like ours, and what that can mean here

*(2026-11-05. README item 20 holds the decision; this is the reasoning.)*

**Why our universe has the gap it has is not known.** Gravity between two protons is about 10³⁶
weaker than the electric force between them, and nothing in physics says why — the hierarchy
problem. What *is* known is that the sizes follow from the gap: a star is the size at which
gravity, summed over its atoms, squeezes them hot enough to fuse, which works out to roughly
(gravity's weakness)^(−3/2), about 10⁵⁷ atoms (Carr & Rees 1979 did this for planets, mountains
and living things too). Stars are huge *because* gravity is feeble. The explanations on offer for
the gap itself are a deeper theory not yet found, anthropic selection, and a multiverse.

**Here the hierarchy is a choice, and choosing ε is choosing it.** Clump size follows from it the
way 10⁵⁷ follows from ours — in two dimensions as 1/ε² rather than 3D's 1/ε^(3/2), so the price of
separation is steeper here than in reality. Ric wants it shaped like ours, on the hunch that it is
the most likely to give emergence rather than stagnation.

**Our ratio is overkill for everything it buys**, which is what makes the hunch workable. It buys
four separations — chemistry blind to gravity, structures vast against their parts, many
structures, and timescales far apart — and each of them could plausibly be had at a few orders of
magnitude. So the target is those four, not the number.

**What would change the decision:** the sweep in item 20. If emergence peaks at a modest gap rather
than climbing with it, "like ours" was the wrong yardstick and the record should say so beside this
entry, not instead of it.

**On the anthropic question it raised.** Of its two halves, fine-tuning is measurable here and
selection is not; the README's search section has why, and the two limits that go with any result
— evidence about this physics only, and a band defined by our own ladder.

#### Settled — the Lab loops, and the shape is a hexagonal torus

*(2026-11-05. Ric, asked whether walls should bounce or absorb: "Maybe having walls is a problem…
What if we made it loop on itself. People talk about the universe being a shape", then "Loop it…
can you research what shape would be best for our scenario?")*

**Only two shapes are on the table, and that is a theorem, not a shortlist.** The Lab has to be
flat everywhere — a curved surface cannot be tiled by identical hexagons, and every place the
tiling bends is a place where the physics differs. Gauss–Bonnet says a closed surface's total
curvature is 2π times its Euler characteristic, so a closed surface that is flat everywhere has
Euler characteristic zero, and the only two such surfaces are the **torus** and the **Klein
bottle**.

**Turned down:**

- **The sphere** — the shape of a closed universe. It cannot be tiled by hexagons alone: Euler's
  formula forces exactly twelve pentagons in (the soccer-ball and geodesic-dome pattern). That
  puts twelve hexagons in the world with five neighbours instead of six — twelve special places,
  which is the "favourite places baked in" problem hexagons were chosen to avoid.
- **The Klein bottle** — flat, closed, and one-sided: crossing one seam turns you into your mirror
  image. That breaks law 1. A momentum carried round that loop comes back reflected, so the
  component across the seam is not conserved — the symmetry that conservation of momentum comes
  from (Noether) is missing in that direction. It would also make handedness flip across the
  seam, on the day the tie rule was fixed precisely to keep the physics from having a handedness.
- **Hyperbolic shapes** (two or more holes) are curved the other way and tile with heptagons, not
  hexagons.
- **No loop at all** — walls — is what this replaced: a momentum reservoir to count, a floor that
  had to bounce or absorb (item 8), and an edge whose effects can look like structure.

**Which torus.** Every torus here is flat; what differs is how its copies sit when you unroll it,
and that decides how far something travels before meeting itself and whether that distance depends
on direction. A rectangle of hexagons has two different loop lengths and breaks the lattice's
six-fold symmetry — a favoured direction. The **hexagonal torus**, copies on an equilateral
triangle pattern, has the same loop length in all six directions, and because the triangular
lattice is the densest way to pack points in a plane (Lagrange 1773, Gauss 1831), it keeps a
world's copies furthest apart for a given area: about 7½% further than the best rectangle with the
same number of hexagons. Molecular simulation reached the same answer in 3D long ago: the rhombic
dodecahedron box is preferred to the cube because all its neighbouring images are the same
distance away, which saves about 29% of the volume for the same separation (GROMACS manual). And
it is the easiest to build here: axial `q mod N, r mod N`, an `N × N` array.

**The catch the research did not mention, found by checking.** Collisions resolve in three-hexagon
blocks, and those only tile across the seam when `N` is a multiple of 3. Brute force over every
site and all three partition offsets: 255, 258 and 4098 tile, and 256, 257 and 4096 break at the
seam. Had the Lab been written at 256 on a loop, the collision step would have double-counted or
skipped a band of hexagons along the seam every step — a conservation failure exactly where the
world has no edge to blame. So the Lab is 258 × 258.

**What it buys and what it costs.** Momentum is conserved exactly with no wall counter. Heat cannot
leave, so the thermostat is the only exchange with outside, which is what a laboratory is meant to
be. The cost is the World's question, not the Lab's: a looped World has no sink and no floor, and
our universe's answer to the first — expansion — is a road not yet taken. README item 22.

#### Correction — the pyramid leaks momentum

*(Found by audit; credited to Barnes & Hut in `SOURCES.md`.)*

Gravity conserves momentum for free **if** it is a sum of symmetric pair forces: A pulls B
exactly as hard as B pulls A, every pair cancels, and the total force on the world is zero. Add
up every pair and the world as a whole does not move.

A pyramid breaks that. The solver evaluates the pull of a coarse cell on one primitive, and —
separately, from the other side — the pull of that primitive on the cell's contents. Those two
are **not exactly equal and opposite**, because the coarse summary is different depending on
which side you are standing. Newton's third law fails by a little on every interaction, and the
world acquires a net drift that accumulates every step. This is a known property of
hierarchical N-body codes rather than anything peculiar to us.

It is the most dangerous class of bug available here: silent, slow, and it looks like physics. A
world with a steady drift appears to have a preferred direction, and you would go hunting for
that in the pair force or the lattice for a long time.

**So the solver computes each interaction once and applies it to both sides**, rather than
computing a force per primitive and trusting the sum to cancel. Rule 6's momentum assertion is
what catches this if we get it wrong, which is one more reason the assertion is not optional.

#### Open — can gravity ever become local?

Gravity is the last non-local law and the last formula, so removing it would be the biggest
remaining simplification. The local candidate: *a primitive is slightly more likely to step
toward whichever neighbor direction has more mass behind it.* Counting, no formula, no
pyramid.

**It doesn't work**, and the reason is worth recording so nobody re-proposes it. A diffuse
cloud has no local density gradient to follow, so local bias produces clumping — something
like surface tension — but never the collapse of spread-out matter. And collapse of spread-out
matter is exactly what manufactures the energy budget. You'd be trading the best idea in the
design for a smaller codebase.

A uniform downward pull (falling-sand style) is local, free, and gives you *down* and
settling — but it is a boundary condition wearing a force's clothes, and it makes no energy.
Still open, but not by either of these routes.

**Held out of the Lab** — see the end of this file.

---

#### Resolved — gravity can be local, as a field rather than as a sum

*(2026-11-04. README item 12 said no and that both candidate routes fail. They do. They were
approximating the wrong object.)*

**The mistake was in what the word "gravity" was naming.** Every local candidate so far
approximated the **sum over pairs**: matter slightly more likely to step toward wherever there is
more matter, and a pyramid approximation. The first fails for diffuse clouds, which have no local
gradient to follow. The second does not give exactly equal and opposite pair forces, so it leaks
momentum directionally. Both failures are real and both stand.

But Newton's `1/r²` sum is a **solution**, not a law. The law underneath it is

> **`∇²φ = ρ`**

which is local: `φ` at a hexagon is fixed by `φ` at its neighbours and the matter there. Relax it
by repeated neighbour-averaging — a few Jacobi passes per tick, multigrid if convergence matters —
and read the force off as the gradient of `φ` between neighbours. O(N) per pass, no sum over
distance, no formula over a separation, and shader-shaped, which is what the World needs.

**Why this is not just adopting 2D's own gravity.** Relaxing `∇²φ = ρ` on a 2D lattice converges to
a **1/r** force and a logarithmic potential, which is the single global collapse this project
rejected in favour of 1/r². So take the screened equation:

> **`∇²φ − m²φ = ρ`**

One extra term, still local, relaxed identically. Its potential decays like `e^(−mr)` — **faster**
than 1/r², and therefore *better* at the thing 1/r² was chosen for, which was keeping regions
independent so that elsewhere exists. And the screening length `m⁻¹` becomes a constant setting
**how large an independent region is**, which is a knob this project has wanted throughout and has
never had directly: strength sets how fast collapse happens, the exponent sets whether collapse is
local or global, and `m` sets *at what size*.

**Three costs, none of them hidden.**

1. **One extra field per hexagon.** `φ` does not fit in the four bytes, so it lives in a second
   array. The hexagon's own 31 bits are untouched.
2. **Gravity stops being the documented exception to neighbours-only and becomes no exception at
   all.** That reads as a pure gain and mostly is, but `THE-LAWS.md` uses "gravity is the only
   exception; a second one means something is wrong with the design" as a canary. Removing the first
   exception removes the canary, so the rule should be restated as *nothing here is non-local*
   rather than quietly dropped.
3. **It is further from Newton.** Already licensed: 1/r² in a 2D world is itself a departure from
   flux geometry, made for exactly this reason. This goes the same direction for the same stated
   purpose.

**Not yet a measurement.** Whether a screened field clusters matter the way the 1/r² sum does is a
the Lab comparison, and it is the kind of thing that fails quietly: with `m` set badly, everything
inside one screening length collapses together and nothing outside it interacts at all. Logged in
`README.md` item 12 as a candidate, not as a settled law.

## 4. Capacity

#### Open — capacity is one global number

*(Audit. Still open, and the conclusion below was right all along — it was `THE-LAWS.md` that
understated it as "weakens the claim" rather than "removes it". Corrected below.)* As written, capacity is a single constant — item 5 in the search space —
so **every primitive from kind 1 to kind 255 has the same capacity.** The paragraph above says
"how many can still fit" is the sole origin of distinct types, and with a global `C` that isn't
true: every kind tops out at the same number, so all the differentiation comes from the pair
force and capacity only prevents the blob.

The real exclusion principle doesn't work this way. **Valence differs per element**, and the
periodic table has structure because of it — that is what the columns *are*. A world where
every primitive has the same valence has a flatter chemistry than one where capacity varies.

So the honest reading is that law 4's claim is overstated and the law is doing one job
(preventing collapse) rather than two. The candidate fix is to make capacity a **short integer
function of kind** — the same description-length discipline as law 2, drawn from the same small
grammar, never a table of per-kind values. That adds no law and no state; it specifies one
constant more carefully.

Not yet decided, because it should be decided by what the Lab does with a global `C` first. If
the table comes out with three species and no depth, this is the thing to vary — though as of
2026-11-04 law 2 carries the columns itself in `v(k) = k mod 8`, so this is no longer the *only*
place valence could come from, and that lowers its urgency rather than closing it.

And there is independent theoretical support: Sayama's cardinality-leap argument is that
letting composites become units in their own right is the generalizable route to
open-endedness, by leaping the cardinality of the possibility space. Capacity-limited bonding
is precisely that mechanism.

---

#### Correction — law 4 does not originate distinct types

*(2026-11-04. `THE-LAWS.md` said a global capacity "weakens this law's claim to be the origin of
distinct types." It removes it, and the difference is not rhetorical. **This log already had it
right** — see *Open — capacity is one global number* above, which says plainly that all the
differentiation comes from the pair force and capacity only prevents the blob. The laws file was
the document out of step, which is the failure mode the split between these two files was supposed
to prevent.)*

**What law 4 was credited with.** Being the load-bearing law and the least obvious one: capacity is
the exclusion principle, "how many can still fit" is the sole origin of distinct types with
distinct behaviour, and that question is the whole of chemistry.

**Why that is wrong as written.** `C` is **one global number.** Every kind can be bonded to exactly
`C` of its six neighbours, so no two kinds differ in capacity, so capacity differentiates nothing.
A saturated primitive is inert and a nearly-empty one grabs — true, but that is a fact about a
primitive's *current state*, not about its kind. The argument conflated the two. Real chemistry has
columns because valence differs **by element**; here it does not differ at all.

**What law 4 actually does, which is still load-bearing.** Saturation. An attraction that never
fills up collapses everything into one undifferentiated blob, and capacity is the only thing
stopping it. That is why "no chemistry at all, ever, at any setting of any other constant" remains
the right answer to what breaks without it — not because capacity differentiates, but because
without it nothing survives to be differentiated.

**Where the differentiation went.** To law 2, the same day. `v(k) = k mod 8` **is** a valence that
varies by kind, in eight columns, which is the thing law 4 was credited with providing and never
did. The documents are now consistent: **law 2 differentiates, law 4 saturates.**

**What stays open.** Whether capacity should *also* vary by kind — `C(k)`, a second short integer
function — is README item 6, and it is now a question about how much structure one law should hold
rather than about whether chemistry exists. There is a real argument for keeping it global: two
independent per-kind functions are two places an answer can be smuggled in, and law 2's is already
carrying the columns.

**Also renamed.** Capacity was `k`, which collided with `k` for kind in laws 1, 2 and 5 — `v = p/k`
and `T = e/k` are about mass, and so was the `k` in `e ≥ B · k`. It is `C` now. A notation
collision in the one law whose failure mode is "no chemistry at all" is worth one rename.

**And the rename collided in turn, which took a second one.** Kinetic energy was adopted in law 1
later the same day with a scale constant also called `C`, so for a day `C` meant a bond count of 0
to 6 *and* a scale factor of 64 — one of them in the formula `floor(C · Q(p) / 2k)`, two characters
from the `k` that the first rename existed to get away from. **Settled 2026-11-05: law 1's scale is
`S`, capacity keeps `C`**, on the grounds that law 4 is the one named Capacity and the scale
constant has no claim on a letter. Propagated through all four documents and `momentum.mjs`.

**Worth naming the pattern rather than just the fix.** Both collisions were introduced by the
*repair* for a previous one, inside a day, because the constants are single letters drawn from a
26-letter pool and `AGENTS.md` rule 8 requires them to live in one module. The structural fix is
that module: the next constant gets checked against the ones already in it before it gets a letter,
and `v`, `B`, `C`, `S`, `k`, `p`, `Q`, `e`, `T`, `G`, `c` are taken.

## 5. Transport

#### Correction — it is temperature, not energy

*(Found by external review.)* The law originally said energy hops toward
whichever neighbor holds *less energy*. That is a second-law hole. Temperature is energy per
unit of kind, so **a heavy cold primitive can hold more total energy than a light hot one** —
and the original rule would then move energy from the colder body into the hotter one. Heat
flowing uphill, available as a free-energy exploit to anything that found it.

The comparison is `e₁/k₁` against `e₂/k₂`, which looks like it needs division. It doesn't:
cross-multiplying gives **`e₁·k₂` against `e₂·k₁`**, two integer multiplications, exact, no
rounding, valid because kind is at least 1 in any occupied hexagon.

An empty hexagon has no kind, so it has **no temperature — it is absolute zero.** Any matter
carrying energy is therefore hotter than vacuum, always, which is a cleaner account of why
radiation works than the T⁴ curve ever was: the gradient into empty space is permanently
maximal, so hot things dump heat fast purely because of what vacuum is.

##### ~~Open — energy cannot currently reach the vacuum~~

**Resolved 2026-11-04** — option 4, with the clock supplying what it was missing; see *How option 4
survived its own objections* below. The problem as first written follows, because the three wrong
ways out are worth keeping.

*(Audit, found while working out whether an expanding world could cool its
interior. This is a live bug, not a stylistic point.)*

Put an empty hexagon on the right-hand side of the comparison. Its kind is 0 and its energy is
0, so `e₁·k₂` against `e₂·k₁` reads **`0` against `0`** — and energy only moves toward strictly
lower temperature, so nothing flows. **Energy never enters empty space. The sink does not
work**, and law 5's load-bearing clause is unreachable.

The caveat two paragraphs up — "valid because kind is at least 1 in any occupied hexagon" — is
the admission, written down without the consequence being noticed: the comparison is undefined
in exactly the case the whole law depends on. And "no kind, so absolute zero" is the part that
isn't true in the arithmetic. `e/k` with `k = 0` is not zero; it is undefined.

Three ways out — and then a fourth, below, which is better than all three. Each is an
**ontology decision rather than a bug fix**, which is why they are flagged here rather than
quietly patched:

- **Special-case vacuum.** Energy always flows to an empty neighbor. One line, no new state.
  "Empty is the coldest thing" becomes asserted rather than derived — which is honest, because
  that is what this law intended all along.
- **Give vacuum a notional kind of 1.** The comparison then works unmodified and energy flows
  in whenever the source carries any. But the energy *sits* there and diffuses onward, which
  makes an empty-hexagon-with-energy a third state the four-byte ontology does not have.
- **Only boundary vacuum is a sink.** Interior empty hexagons take nothing. Clean, and it
  reinstates the problem that made expansion attractive: a large world's interior would have
  no way to cool.

Option 2 changes what a hexagon is and option 3 changes what the world can do, so neither is
mine to pick.

##### Option 4 — and why the other three were wrong

*(After Ric asked why the Sun is cooler further away — "so space holds heat,
and it does transfer, but not endlessly?")*

The answer is no, and it settles this choice. **Vacuum does not hold heat and does not conduct
it.** There is nothing in it to carry kinetic energy, which is exactly why a thermos flask works
and why the ISS struggles to *shed* heat rather than to stay warm — in vacuum, radiators are the
only way out. What vacuum does is **transmit radiation perfectly and indefinitely**: light from
a galaxy thirteen billion light years away arrives unabsorbed. The Sun is cooler at Pluto than
at Mercury purely because the same power is spread over a sphere whose area grows as r². That is
**geometry, not absorption**, and nothing ran out of capacity.

So the faithful behavior is neither "vacuum eats energy" nor "vacuum diffuses energy." It is:
**energy crosses vacuum in a straight line at one hexagon per step and is absorbed by the first
matter it meets.**

And that costs **nothing** to represent, because the fields already exist. An empty hexagon uses
neither its kind nor its bonds. Give it the energy field it already has, plus the **direction
field it already has**, and an empty hexagon carrying energy in a direction *is* a quantum of
radiation in flight — travelling one hexagon per step, which is the speed of light the structural
facts already assert. No new state and no fifth byte.

What it buys past correctness: **separated structures can reach each other.** Under option 1
every gap is a hole in the universe and no clump can ever warm another. Under this one a hot
region heats a cold one across empty space, the way a star warms a planet — and that is the only
long-range channel this world would have apart from gravity. For a project whose whole hope is
structures interacting in unplanned ways, losing that by accident would be expensive.

Conservation comes out cleaner too: energy in flight is still inside the world and still counted.
It leaves only at the boundary, where `radiated-away` takes it.

The costs, stated: it needs an **emission rule** — when matter sheds energy into an adjacent
empty hexagon, which direction does the quantum take? Random is the isotropic answer and is
probably right. It reintroduces something photon-shaped, which this project deleted once; what
was deleted then was the **T⁴ formula**, not radiation itself, and crossing a gap at the right
speed genuinely needs a carrier. And it may cool the world quickly, since radiation now escapes
efficiently in every direction.

##### The case against option 4

*(Ric asked for the devil's advocate. It is a better case than expected and the
option does not come out of it unharmed.)*

**1. It breaks the ontology, and "costs no bytes" was the wrong test.** The README's central
claim is *a hexagon is a primitive, or it is empty.* An empty hexagon carrying energy and a
direction is neither — it is a **third kind of thing**, and this project's discipline has always
been about kinds of things rather than byte counts. Reusing unused fields is an implementation
convenience; it does not make the new state conceptually free, and presenting it as free was
sleight of hand.

**2. Photons come back, and their absence was load-bearing.** *What came off the list* argues
radiation merged into transport because "T⁴ comes from photon statistics, and this universe has
no photons." Option 4 gives it photons. The justification for that merge is therefore void, and
radiation has a fair claim to being its own law again — **five back to six**, in a project whose
entire discipline is the count.

**3. It adds a constant and a free choice.** When does matter emit, and in which direction? The
emission *rate* is an eighth number in the search space, and every number multiplies the search.
"Random direction" is the isotropic answer but it is still a decision, not a derivation.

**4. The strongest objection: it reopens the second-law hole.** If a quantum is absorbed by the
first matter it meets, it is absorbed **regardless of that matter's temperature** — so a
lukewarm primitive can emit a quantum that travels and lands on a much hotter one. That is heat
flowing uphill, which is exactly the bug the external review caught in the original law 5,
returning by a different door. Reality closes it statistically: hotter things emit far more
often, so the net flow is downhill even though individual photons go both ways. Closing it here
means **emission probability must scale with temperature** — which is a temperature-dependent
emission rate, which is the deleted T⁴ curve's descendant walking back in. Getting radiation
right may re-derive the thing the project was pleased to have removed.

**5. Occupancy questions multiply.** Can a hexagon hold a quantum and a primitive at once? What
happens when matter moves into a hexagon with a quantum in it? After clumping, most of the world
is vacuum and most of that vacuum would be carrying radiation, so these are common cases, not
corners.

**6. And it does not solve the problem it was invoked for.** In a dense interior a quantum is
reabsorbed within a hexagon or two, so the interior still cannot cool. This is *correct* physics
— stellar interiors are opaque, and heat takes on the order of a hundred thousand years to leave
the Sun's centre by precisely this mechanism — but it means option 4 buys realistic opacity, not
interior cooling. The cooling argument has now failed twice.

**Where that leaves it.** Option 4 is still the most faithful of the four and the only one
derived from how radiation works rather than from what was cheap to compute. It is **not cheap**,
the "no new state" framing was wrong, and it cannot be adopted until objection 4 has an answer.
Its real appeal is the one thing none of the other three offer: separated structures able to
reach each other across empty space. Whether that is worth a sixth law is a judgement nobody has
made yet.

**And it is not ours to invent.** A search on 2026-11-03 found that carrying radiation along a
fixed set of lattice directions is an established method — **discrete ordinates** — used in
astrophysics with absorption, emission and scattering all handled (Weih et al. 2020; see
`SOURCES.md`). That removes the question of whether the approach is sound. It also confirms
objection 6 from the other side: those methods are tested in the **optically thick** regime
precisely because dense material reabsorbs radiation almost at once, which is realistic opacity
rather than interior cooling.

This does cost the project a claim. "Almost no arithmetic" was oversold — there are two
multiplications at every transport comparison. They are exact and cheap, but they are
arithmetic, and the honest version is in *On math* below.

##### How option 4 survived its own objections

*(2026-11-04. The blocker was objection 4 — unconditional absorption lets a cool body heat a hotter
one. The answer turned out to be in the time model, which had a gap nobody had looked at:
structural fact 3 says every hexagon's clock runs at its own rate and never said what sets the
rate. Written up after `radiate.mjs` checked it, not before.)*

**The lattice is exactly reciprocal, and that is the whole hinge.** If hexagon *i* sees hexagon *j*
along one of the six directions then *j* sees *i* along the opposite direction — necessarily, because
the cells in between are the same cells either way, so the first matter hit is the same from both
ends. `radiate.mjs` checks it by brute force at matter densities from 2% to 40%: **zero violations,
and the per-pair sight-line counts symmetric everywhere**, up to 5,388 sight lines in a world.

Reciprocity cuts both ways, and the second edge is the surprise:

- **It closes the second law exactly.** Net flow from *i* to *j* is `(p(T_i) − p(T_j)) · n_ij / 6`,
  and `n_ij = n_ji`, so the sign of the net is the sign of the temperature difference for **any**
  emission rate that rises with temperature. No T⁴ and no statistics. Reality closes this hole
  statistically — hotter things merely emit more often, and individual photons do go uphill. Here
  **no two hexagons ever exchange net energy uphill at all**, which is stronger than our own
  universe manages. Measured: 242 of 242 visible pairs downhill, at every constant tested.
- **And under a flat clock it kills radiation outright.** If every hexagon emits at the same rate
  then `p(T_i) = p(T_j)` and the net is **exactly zero between every pair** — measured, 242 flat
  pairs out of 242. Radiation would not be a weak channel or a slightly wrong one; it would
  transport no heat in either direction, ever. So the temperature-dependent clock is not a patch
  bolted on to fix objection 4 — **it is what makes radiation a channel at all**, and option 4
  without it is dead rather than merely leaky. That is also, in one line, why our own universe has
  a Stefan–Boltzmann law: detailed balance leaves radiation no other way to carry heat.

**The clock is therefore the decision**, and it is written up as part of structural fact 3 rather
than here, because it changes every law at once rather than only this one.

###### The constraint that came out of it, which was not predicted

Saturation. The rate is a probability, so it clips at 1, and above the clip two hexagons at
different temperatures act *equally* often. The analytic check called those pairs "flat" and that
read as harmless. The dynamic run showed flat is not what they are — 20 seeds, a hot blob at
temperature 30 against a cold one at 25:

| clock constant | p(30) | p(25) | mean net flow | seeds running uphill |
|---|---|---|---|---|
| 0.004 | 0.120 | 0.100 | **+22** | 0 / 20 |
| 0.008 | 0.240 | 0.200 | **+41** | 0 / 20 |
| 0.016 | 0.480 | 0.400 | **+71** | 0 / 20 |
| 0.0333 | 0.999 | 0.833 | **+157** | 0 / 20 |
| 0.05 | 1.000 | 1.000 | −3.5 | **10 / 20** |
| 0.1 | 1.000 | 1.000 | −3.5 | **10 / 20** |
| 0.4 | 1.000 | 1.000 | −3.5 | **10 / 20** |

**The second law does not degrade gracefully. It switches off.** Below the clip the net is downhill
on every seed and grows with the constant; at the clip it drops to statistical zero and the
direction becomes a **coin flip** — ten seeds in twenty running heat from the colder blob into the
hotter one, with nothing to correct them.

So: **the rate must not clip**, a hard filter on the search space of the same kind as
gravity-must-not-touch-chemistry, and like that one it rejects a constant set without running it.
With `rate(T) = floor + c · T` the filter is `floor + c · T_max ≤ 1`.

*(Corrected later the same day, and the filter above is the part that survives. This went on to say
the cost was that energy is 11 bits, so the constant must sit below 1/2047 and the clock therefore
needs a **2047:1 spread in clock rates** — free in the Lab, and in the World the coldest matter updating
once in 2047 ticks, "the dynamic-range question arriving from a direction nobody expected."
**The spread does not follow from the filter.** It is `(floor + c · T_max) / floor`, which reaches
2047:1 only when there is no floor and the coldest matter sits at `c · 1`. Put a floor in and the
spread is chosen rather than forced: a floor of 1/16 gives 16:1 and clips at exactly the same
point, because raising the floor spends the same headroom it frees. The second-law argument uses
monotonicity only — net flow is downhill for any rate that rises with temperature — so every floor
is sound, and a high one costs transport speed rather than correctness. That unties this from the
dynamic-range question it was thought to be a second face of.)*

The alternative is to clip deliberately and accept a second law that is slack above the clip. There
is a case for it: above temperature 8 no bond survives anyway, so slackness up there costs no
chemistry, only exact bookkeeping. **Not chosen** — a world with a region where heat flows uphill by
coin flip is a world whose energy numbers cannot be trusted, and the measurement run exists to
produce trustworthy numbers.

###### Objection by objection

**1. The ontology — conceded, and paid for openly.** An empty hexagon carrying energy and a
direction is a third kind of thing, and "it costs no bytes" was the wrong test. The fix is to stop
hiding it in a spare field: `THE-LAWS.md` now carries a **three-row table** saying a hexagon is a
primitive, a quantum in flight, or empty — and the README's "a primitive, or it is empty" was two
states where there are three. The objection was right, and the answer is a declaration rather than
a rebuttal.

**2. Five laws becoming six — a judgement, filed as a structural fact.** Emission needs no new rule,
being law 5 with vacuum asserted colder than anything; what is new is how energy crosses a gap,
which is of a piece with the lattice, locality and the speed of light. So it is the **fifth
structural fact**, not the sixth law. The objection still stands on its own terms: this does hand
the project photons back, and the stated reason for merging radiation into transport was that there
were none. Anyone is free to call it a sixth law. What matters is that it is written down in full
rather than smuggled into unused bits.

**3. A constant and a free choice — closed.** No number is added. The emission *rate* is the clock,
already number 5 in the search space; it stops being flat and becomes a function of local state,
and the count is unchanged. The *direction* is uniform over the six, and that is now **derived
rather than chosen**, because the reciprocity argument requires isotropy. The energy per quantum is
one unit, forced by the six-bit representation below.

**4. The second law — closed, and exactly.** Above.

**5. Occupancy — closed, with one rule covering every case.** A quantum is **one unit of energy, and
a hexagon holds at most one per direction**: six bits, which is exactly the bond field an empty
hexagon never uses. And the six bits are **exact rather than a cap**, which was not obvious. A
quantum arriving at a given hexagon travelling in a given direction, and a fresh emission into that
same slot, can only come from the one neighbour behind it — and that neighbour is either matter or
vacuum, never both, so there is no third source to collide with. Measured: **zero collisions across
every run**, up to 90% matter density with every clock saturated. Matter moving into a hexagon holding a
quantum absorbs it, exactly as a quantum flying into matter is absorbed: *whichever of the two
arrives, the matter absorbs.* One sentence answers all five occupancy questions.

**6. It still does not cool an interior — confirmed, and now measured rather than argued.** Equal
temperature, equal steps, varying blob radius:

| blob radius | temperature after 400 steps | shed |
|---|---|---|
| 1 | 28.46 | 5.1% |
| 2 | 29.01 | 3.3% |
| 4 | 29.45 | 1.8% |
| 8 | 29.71 | 1.0% |
| 16 | 29.85 | 0.5% |

Cooling tracks **surface over volume**, which is opacity and is correct physics — a sixteenfold
radius sheds a tenth as fast. Option 4 buys realistic opacity, not interior cooling. **The cooling
argument has now failed three times**, and law 6 (expansion, or gravity weakening with energy
density) is still the only candidate for it. Nothing here solved that.

###### What it costs, stated plainly

- **Radiation goes as T¹, not T⁴.** One unit per clock fire at a rate proportional to temperature is
  linear emission. The second law only needs monotonic, so this is sound — but it is **not**
  Stefan–Boltzmann, and hot bodies here shed heat far less aggressively, relative to cold ones,
  than real ones do. A declared deviation rather than a hidden one. Getting the exponent nearer 4
  means putting a curve back, which is the thing the project was pleased to have deleted.
- **The 2047:1 clock spread**, above.
- **Law 2 loses its temperature clause** — which turned out to be a fix rather than a cost; below.
- **Momentum under an uneven clock becomes a constraint on the movement rule** rather than a free
  choice: hot matter acts more often, so collisions are initiated unevenly, and exact momentum
  conservation has to survive that. Thermal pressure arrives free as the same side effect. Neither
  is solved here; both are recorded so the movement rule is not written in ignorance of them.
- **Conduction's temperature comparison is now redundant** for the second law — the clock alone
  would make matter-to-matter exchange net downhill even with a random direction. It is **kept**,
  because strictly-downhill conduction equilibrates far faster than a biased random walk and costs
  two multiplications. But its job is no longer the one law 5's correction gave it.

###### How it was checked

`radiate.mjs` (`node radiate.mjs`), dependency-free, with no simulation needed for the first three
of seven checks: sight-line reciprocity by brute force at four densities and three seeds; net flow
over every visible pair under a temperature-proportional clock at four constants; the same under a
flat clock as the control; a dynamic run using the six-bit representation and asserting `energy =
in world + in flight + radiated away` **exactly**, which closed in every run; two blobs across a
gap to exercise the absorption path; the blob-radius sweep above; and a stress pass at matter densities to 90% with
saturated clocks and 160,000 emissions, which is what backs the zero-collision claim.

**The saturation bug was only visible in the dynamic two-blob run.** The analytic check reported
those pairs as "flat", which read as harmless. And a single convex blob never absorbs anything — the
first four runs reported `absorbed by matter 0` and so tested nothing whatsoever about objection 4.
It took two blobs to see either problem.

#### Correction — the books have to be kept at the edges

*(Found by external review.)* Energy leaving at the boundary and the Lab's
thermostat both move energy across the world's edge, and nothing in these documents said we
*track* it. Without that, rule 6's conservation assertion is **meaningless wherever it
matters most** — it would pass happily while the world gained or lost energy at the border.

So two counters are mandatory, not optional:

- **radiated-away**, every unit that crossed the boundary outward
- **thermostat net**, every unit the Lab's held gradient injected or removed

and the invariant that gets asserted is `world energy + radiated-away − thermostat net =
constant`, not `world energy = constant`.

Binding energy is inside the world and already covered by the exact-accounting structural
fact. Gravitational potential is the subtle one: it is not stored anywhere, it is implicit in
the arrangement, so collapse appears to *create* thermal energy from nothing. That is correct
physics and it is what the whole energy budget depends on — but it means **total energy is
not the conserved quantity in the World.** What is conserved is energy plus gravitational
potential, and since the potential isn't represented, the World assertion has to be the
weaker one: energy only ever increases through collapse and only ever decreases through the
boundary, both monotonic and both logged. The Lab, which has no gravity, gets the strict
equality.

---

---

#### Correction — the clock constraint was stronger than its own argument needed

*(2026-11-04, the same day the temperature-proportional clock was settled.)*

**What it said.** "The clock constant times the hottest reachable temperature must be below 1." At
11 bits of energy that forces a constant under 1/2047 and a **2047:1 spread in clock rates** — free
in the Lab, where event times are drawn from distributions anyway, and close to fatal in the World, where
the coldest matter would update once in 2047 ticks. The cold edge is exactly where the dissipative
structures are meant to live, so that is not a performance detail. It is the sink going quiet.

**Why it is stronger than needed.** The second-law argument is: sight lines between two hexagons are
reciprocal, so the only asymmetry available is the rate, and therefore net flow is downhill for
**any rate that rises with temperature.** That argument uses monotonicity and nothing else.
`c · T_max < 1` is a statement about the rate's *floor*, not about its monotonicity, so it was never
what the argument required.

**The corrected constraint.** The rate must be **strictly increasing in temperature and must never
saturate.** With

> **`rate(T) = floor + c · T`**

the rate is strictly increasing for **any** floor, so net radiative flow between two hexagons that
can see each other is still downhill and its direction never flips. What a floor changes is the
**asymmetry**, `(r_hot − r_cold) / (r_hot + r_cold)`: with a high floor a great deal of energy
sloshes back and forth and only a little drifts downhill per exchange. Heat transport becomes
**diffusive rather than ballistic**, which is what conduction is in reality, and slow equilibration
helps structure persist rather than hurting it. A floor at `c · T_max / 16` buys a 16:1 spread
instead of 2047:1, at the cost of transport speed rather than correctness.

**What does still switch off abruptly is saturation, not spread.** If the rate flattens at the top,
two hexagons at different temperatures act equally often, net flow goes to zero, and its direction
becomes a coin flip — measured at 10 of 20 seeds running *uphill* in `radiate.mjs`. That number is
untouched by this correction and the warning stands: the second law does not degrade gracefully
here, it switches off. Keep the rate linear and unsaturated and it cannot happen at any floor.

**What is now worth measuring instead.** How small the asymmetry can get before radiative transport
is too slow to matter against the other laws' rates. Nobody has measured that, and it is the real
constraint on how high the floor can go.

#### Stated — heavy matter is thermally dead, and the cap on `B` was the clue

*(2026-11-04. Not a correction — nothing said anything false. This is a consequence that was
computed, printed, used to decide something, and never written down.)*

`screen.mjs` has printed this table all along, and the cap of 8 on `B` was **derived** from its
last line:

| kind | hottest reachable temperature | largest breakable bond |
|---|---|---|
| 1 | 2047 | 2047 |
| 16 | 127 | 127 |
| 64 | 31 | 31 |
| 255 | **8** | **8** |

Energy was 11 bits, so a hexagon held at most 2047, and temperature is `e/kind`. The cap existed so
every bond is breakable by every kind: `floor(2047/255) = 8`. That reasoning was correct and the cap
was right *for four bytes* — **and on 2026-11-04 the word went to eight bytes and energy to 16 bits,
so the cap stopped being forced at all.**

**What was never stated is what it costs.** A kind-255 primitive has **eight distinguishable
temperatures.** A `B=8` bond between two of them breaks only at `e ≥ 2040` out of a possible 2047 —
technically breakable, practically never. So heavy matter is close to permanently cold and
permanently bonded, and everything thermal this project cares about — melting, freezing, graded
stability, phase, any reaction rate with a temperature dependence worth measuring — lives among the
**light kinds only.**

That is a real cost to law 1, because the whole point of conserving the sum of kinds rather than the
count was to make heavy matter possible. It is possible. It is simply inert once it exists, which is
not what "light kinds common and everywhere, heavy kinds only where matter got crushed hard enough"
was promising.

**The fork, which has no free side.** These three cannot all hold:

1. a fixed-width field holding **total** energy,
2. temperature defined as `e/kind`,
3. a uniform temperature range across all kinds.

This world has 1 and 2, and 3 is what it loses. Storing **temperature** in the field instead, with
`T · kind` as the conserved quantity, looks like it would give every kind the full range — and
**that option is dead on arithmetic**, measured in `budget.mjs` on 2026-11-04.

Transport moves energy in integer units of 1. If the field holds `T` and `e = T · kind`, a hexagon
of kind `k` can only represent energies that are multiples of `k`, so a single arriving unit has
nowhere to go unless a remainder `r < kind` is stored too — and `(T, r)` is the *same information*
as `e`, needing the same width. The measured saving is **−1 bit** at every kind count and ceiling
tried: storing T alone is narrower only because it cannot represent the energies transport
delivers. Drop the remainder and the smallest energy change to a kind-255 primitive becomes 255
units, so heat arriving at heavy matter rounds away or stalls and **conservation pays** — exactly
the kind of place law 1's integers exist to protect.

So the fork has two sides, not three: **reallocate inside four bytes, or widen the word.**

Logged as README item 15, **the heavy-matter temperature fork**. It has to be settled before the
field layout is frozen, because it changes what the 11 bits mean.

##### And enumerating the budget turns the fork into a menu — plus one bit left on the floor

*(2026-11-04, `budget.mjs`. The fork above was written as a two-way choice between a total-energy
field and a temperature field. Enumerating what actually fits in four bytes found a third way and a
free win, and `AGENTS.md` rule 5 had already named the third way — "widen energy to 16 bits and the
cap becomes 257" — which the fork missed on first writing.)*

Bonds are always 6 bits and momentum is two signed components, so the constraint is
`kind + energy + 2 · momentumBits + 6 ≤ 32`, and the quantity nobody had computed is
`energyMax / kinds` — the hottest temperature the *heaviest* kind can reach, since temperature is
`e/kind`.

| kinds | energy max | momentum | hottest heavy kind |
|---|---|---|---|
| 255 | 2047 | ±3 | **8** — today, with one bit unused |
| 255 | 4095 | ±3 | 16 |
| 127 | 2047 | ±7 | 16 |
| 127 | 8191 | ±3 | 64 |
| **63** | **4095** | **±7** | **65** |
| 63 | 16383 | ±3 | 260 |
| 31 | 8191 | ±7 | 264 |
| *255, at eight bytes* | *65535* | *±15* | *257* |

**The four-byte layout wasted a bit.** 8 + 11 + 6 + 6 is 31 of 32. Handing that bit to energy would
have doubled the heaviest kind's range from 8 to 16 reachable temperatures at a cost of **nothing**
— a law was being constrained by a field width while a bit sat unused. That is the same class of error as
the other width findings, caught by enumeration rather than by argument.

**And the kind count is nearly free for law 2, measured.** The complementary form is
scale-invariant: roughness 0.259 / 0.257 / 0.251 / 0.241 and exactly 8 columns at 255 / 127 / 63 /
31 kinds, because the **modulus** sets the columns and the kind count only sets how many members
each column holds. Dropping to 63 thins columns from 32 members to 8 and changes nothing
structural — if anything 8 members per column is a more legible periodic table than 32. So spending
kind bits on energy buys heavy-matter chemistry at almost no cost in chemistry.

**Two further results came out of measuring the layouts properly, and the second changed the
recommendation.**

**Speeds always equals kinds, and no momentum width adds one.** There is always a momentum of
magnitude 1, so every kind `k` yields a step period of `k` ticks; a wider momentum field only adds
finer values that round onto periods already present. Measured: ±1, ±3, ±7 and ±15 all give exactly
255 speeds at 255 kinds. So law 1's "255 distinct speeds" is a **restatement of "255 kinds"** rather
than an independent feature, and **momentum width is purely headroom for forces.** That is the
same separation the orbit correction had to make, arrived at from the other direction — and it
means the earlier "±3 already gives all 255 speeds, so nothing is lost" was true, trivially, and
reassuring about the wrong quantity.

**Pick two.** The measure that matters for heavy matter is **headroom** — how many times its own
strongest bond the heaviest kind can be heated, `hottest / 8`. Below 1× its bonds never break;
below 2× there is no hot phase, only "bonded" and "just barely not"; 8× is where melting, boiling
and graded stability have room. At the documented layout the headroom is **1×** — the heaviest
kind's strongest bond breaks at the last representable energy and nowhere below it. And giving 255
kinds an 8× headroom needs 14 bits of energy, which leaves **four bits of momentum, or ±1 — option
(A), the unweighted direction law 1 replaced.** So at four bytes you may have any two of 255 kinds,
real thermal headroom, and a momentum vector with room to push. Never all three. That constraint
was invisible until the budget was enumerated, and it is the actual shape of this decision.

**The recommendation, revised: 127 kinds, energy 13 bits, momentum ±3, bonds 6 — exactly 32.** The
first version of this entry said 63 kinds with ±7, buying heavy-matter headroom and momentum
headroom together. **That was speculative spending.** Heavy matter being inert is measured; momentum
width being what defeated the orbits is a hypothesis nobody has tested, because the orbit test does
not exist (item 16). Fixing what was measured and leaving momentum alone is the project's own
method — change one thing at a time — and it keeps 127 kinds instead of 63. If the orbit test later
says width was the cause, the 63/±7 row is still there.

Eight bytes remains the only way to have all three, at twice the World's bandwidth. A real option, not
a better one.

**What it costs, and it must be recorded.** `B`'s forced cap rises from 8 to 65, so **the cap of 8
stops being an artifact of a width and becomes a choice.** It is a defensible one, because
`k mod 8` produces 0–8 naturally — but a constant has moved from *forced* to *searchable*, and the
search space entry has to say so rather than inheriting the old justification.

##### Settled — eight bytes, and the constraint that was really binding was the phone

*(Ric, 2026-11-04: "dont worry about it running on phone it can run on my computer and just be
visible on my phone. and im good with 8 bytes because that makes it more like our world anyways.")*

Both halves of that are right, and the second is the better argument. **Wide dynamic range is what
makes it like our world** — reality runs from 2.7 K to stellar cores, across a whole periodic
table — and a world whose heaviest matter has eight distinguishable temperatures and cannot be
heated past its own strongest bond is not like ours in the way that matters. The bits buy range,
and range is the resemblance.

And the first half dissolved the problem rather than solving it. **The four-byte word was being
held in place by a mobile memory budget**, from `AGENTS.md`'s working note that this has to work on
Ric's phone off the live site. The World computes on the PC and the phone only *views* it, so that
budget never applied to the lattice at all. At 4096² the hexagon is 134MB per buffer, about 268MB
double-buffered, comfortable on a 4GB card and impossible on a phone. **A constraint nobody had
examined was choosing physics constants**, which is the same shape as the width finding itself.

**The layout is now:** kind 8, energy 16, momentum two components at ±15 (10 bits), bonds 6 — **40
of 64 bits**, with 24 reserved. 255 kinds, thermal headroom of 32× for the heaviest kind, and a
momentum vector with room to accelerate. All three of the "pick two", which is what eight bytes
buys and four cannot.

**What it costs is a forcing function, and that is worth naming.** At 31 of 32 bits, adding anything
meant taking something away, and that pressure is what surfaced the inert heavy matter and the
unused bit in the first place. At 40 of 64 a field can be added without anyone noticing. The spare
bits are therefore **reserved and asserted** rather than available — `AGENTS.md` rule 5 — because
the discipline scarcity used to enforce now has to be written down. This is the one real argument
*against* the change and it is a discipline risk, not a performance one.

**And it freed law 2s modulus, though not in the way first claimed.** The forced cap on `B` went
from 8 to 257, so the modulus stopped being an artifact on the same day it stopped being
load-bearing — and measured over 255 kinds,
wider is better on both metrics that killed `gcd`: modulus 18 gives roughness 0.121 and 11%
self-affinity against modulus 8's 0.259 and 25%, and 18 is also reality's long period. That is
README item 17 — **and the claim that wider is better was retracted within hours**, because both
metrics fall as `1/m` for arithmetic reasons rather than for any reason about chemistry.
`roughness × m` is flat at 2.05–2.18 and `selfBest × m` flat at ~1.98 from modulus 6 to 32, with
the mean absolute step steady at ~1.4. Roughness divides a fixed one-valence-unit step by a mean
`B` that grows with the modulus, so a bigger modulus flatters itself. The metrics remain valid for
comparing **forms at one `B` range**, which is the comparison that killed `gcd` and which stands.
The modulus stays at 8. **Rule 12's fourth lesson, landing on the person who wrote the metric.**

*The sweep was not mechanical and was not done as one.* Roughly 140 occurrences of `2047`, `11
bits`, `four bytes`, `31 bits` and `±3` sit across the files, and most of them are in **this** file
recording what was true when a decision was made. Those stay. What changed is the live
specification — `README.md`'s *What exists*, law 1's momentum range, law 5's fork, `AGENTS.md` rule
5, and `screen.mjs`'s ceiling — plus the note above saying the history is as-of.

#### Open — how a looped World expands (provisional\*)

*(2026-11-05. Ric asked for the ideas to be researched, then: "Let's do yours." The direction is in
README item 22; this is the research and the reasoning. \*Written for Ric to check.)*

**Why a loop needs it.** With an edge, radiation left the World and the dark beyond was its cold
sink. A loop has no edge: light that leaves comes back, and a finite static loop fills with its own
glow until it is as bright as its hottest things — Olbers' puzzle about our own sky, whose answer is
partly that the universe expands. So the old verdict, that expansion's cooling argument had failed
three times, was reached with an edge in place. **Removing the edge reverses it.**

**What reality does, and what the research corrected.** Bound things do not grow with the universe,
but not because they are exempt: a classical atom in an expanding universe is all-or-nothing —
loosely bound, it follows the expansion; tightly bound, it settles at a fixed size and stops
responding, with no case in between (Price & Romano 2012). The solar system feels an effect that is
real and far too small to measure (Cooperstock, Faraoni & Vollick 1998). Light loses energy as it
crosses stretching space, and free motion slows; that energy goes nowhere, because energy
conservation comes from time-translation symmetry and an expanding universe has none (Carroll).

**The approaches found, and what each would mean here:**

- **A fixed grid with a scale factor** — every cosmology code (GADGET, Enzo, CosmoLattice): the grid
  never changes, one number says how far apart its points are, moving things feel a drag and light
  loses energy in step. Simpler than it sounds here, because law 2 has no distance term: chemistry
  only knows who is adjacent, so a "stretched atom" has no consequence anyone inside could detect.
  But it runs at full size from the first tick. **Kept as the control run.**
- **Space that comes into being piece by piece** — causal sets grow by elements "coming into being,
  one at a time", and one proposal from that growth puts the cosmological constant near the
  observed value (Ahmed, Dodelson, Greene & Sorkin); the Wolfram model grows space by adding nodes
  to a network; some cellular automata add a cell when activity reaches their edge. **The family
  the chosen rule belongs to.**
- **A mesh that moves with the matter** (AREPO) — cells drift with the flow. Incompatible with one
  fixed lattice of identical hexagons. **Set aside.**

**The step that made a growing grid workable.** The earlier entry rejected inserting hexagons because
it breaks the bond field, seams the lattice and grows memory. Inserting a **whole line round the
loop, where no bond crosses**, does none of the first two: in memory half the World shifts, but in
the physics the only change is that the hexagons either side of the new line are no longer
neighbours. And growing memory is what Ric asked for. A line cannot stop partway — that would leave a
hexagon with five or seven neighbours, a dislocation, which is a special place — so a line is the
smallest unit of new space this lattice has.

**Why bonds and not emptiness decide where.** Ric asked whether new hexagons should only sit next to
empty ones. That stricter rule needs a band empty all the way round, and early on, when the World is
dense, there would be none, so it could not grow at exactly the stage when reality grew fastest —
when everything was unbound gas being pulled apart. Requiring only that no bond crosses keeps the
all-or-nothing rule from Price & Romano: anything bound is never split, anything unbound may be.

**Still open:** the drain's exact form on integer quanta and speeds; the rate formula (CosmoLattice
offers the same two modes this project argued over — a fixed background, or expansion sourced by
the contents — and the second is the one rule 2 allows); the starting state; and whether law 6 earns
its place against rule 7.

## Rules that came off the list

The list stays short by things leaving it. This section is as important as the rest.

**Three conservation laws → one.** Matter, energy and momentum were three separate laws.
Noether's theorem already told us they're one thing: in our universe every conservation law
comes from a symmetry. Writing them as one law with three nouns is closer to the truth than
three rules, not a shortcut.

**Radiation → merged into transport, and a formula died with it.** Radiation was its own law
with a T⁴ emission curve. But T⁴ comes from photon statistics, and this universe has no
photons — so it was a formula with no mechanism behind it, which is the exact thing to avoid.
Let energy hop toward *any* neighbor with less, empty ones included, and radiation is free:
empty space holds zero energy, so the gradient into it is maximal, and hot things dump heat
fast because of the geometry rather than because of an exponent. **Pure counting.**

**Decay.** Taylor et al. name the absence of decay as a specific failure of existing artificial
life systems: digital physics usually has no rot, so organisms never need self-maintenance,
and self-maintenance is where a large fraction of real biology's complexity lives. So it looked
mandatory. It isn't a law because bonds break when thermal energy exceeds binding energy, which
laws 2 and 5 already imply.

**Catalysis.** Also looked mandatory, and at the *material* level it would have been — an
affinity function needs an explicit third-body term or there are no enzymes and the world caps
at weather. At the *primitive* level it's free: a third primitive nearby exerts force on the
reactants, reshaping the local energy landscape and making a bond easier to break. Which is
mechanically what an enzyme actually does.

**The mechanism above is wrong, but the entry stands.** A pure pair function has no local energy
landscape, so "a third primitive exerts force and reshapes it" cannot be how catalysis arrives.
The right account is **geometry**: a cluster with a pocket binds two reactants adjacent to each
other and holds them in contact longer than chance would, which is selective because the pocket's
lining is made of particular kinds, and leaves the pocket unchanged. That is how real enzymes do
it — a protein is atoms interacting pairwise, with no three-body term anywhere underneath.

So catalysis is still free, for a better reason than the one originally given. It does require
that bond formation be **rate-based** rather than instant-on-contact, which is now an argument for
that formation rule rather than an open choice. Law 2, *Catalysis is available after all*.

**A property function.** The original design had one piece of code mapping composition to
density, melting point and affinity, and it was the single largest design risk in the project —
it had to thread a needle between wild instability and undifferentiated mud. Pushing the floor
to primitives deleted it entirely. Properties are consequences, not mappings.

**Mixtures, and the slots that held them.** Hexagons were going to hold up to four components
with amounts, costing ~28 bytes each. Once one hexagon became one primitive, a mixture is just a
region where neighbors have different kinds — no representation at all. That took the hexagon
from ~28 bytes to **4**, which is seven times less state and bought back the resolution the slots
had cost.

**Six-channel momentum.** Borrowed from FHP, which uses it for a gas of identical particles
distinguished only by direction. These primitives have kinds, so per-channel kinds would have
meant six times the state. One primitive per hexagon with one direction is three bits, and
collisions conserve momentum exactly by **swapping directions** — which needs no arithmetic.

**A maximum occupancy rule.** Free from one-primitive-per-hexagon.

**Pressure.** Emerges from gravity compressing against capacity. Never written.

**The pair force's strength and range — two of the seven search constants.** Not a law, but the
same discipline, and worth recording here because the search space is where the real cost of a
design lives. If law 2 is a binding energy over two integers rather than a force, there is no
magnitude to scale and no range to set: exclusion supplies the short-range repulsion and gravity
the long-range gathering, so the only thing left is which pairs bond and how strongly. Seven
numbers became five, and the remaining scale factor is folded to 1 by choice of units.

Notice how many of these came off from the *same two moves*: pushing the floor down to
primitives, and putting one primitive in one hexagon. That is the strongest evidence available
that both decisions are right.

---


---

## The decisions of 2026-11-06

Five choices, made by Ric in one pass over the register, plus the two things they forced. Recorded
here because four of the five change a law, and a decision that is not written down is a decision
that will look derived a week later.

**Momentum to ±63** (item 20). Offered ±15, ±63 or ±127. What forced the question: gravity bolted
onto the Lab from outside had **562,344 pulls refused and none accepted**, because the symmetric
clamp had no room left. ±63 lets every kind carry the fall that melts the weakest bond; ±127 would
carry the strongest. **It forced `S` from 64 to 4**, because the largest legal `Q` rose 17.64× and
the window's ceiling fell with it, from 2–291 to 1–16. The re-measurement reproduced the documented
2–291 at ±15 before it was trusted at ±63 — rule 12's fourth lesson, applied to the measurement
rather than to the result.

**Heat connected to motion, in opposite-moving pairs** (item 29). Ric's own mechanism, and the
pairing is what makes it a law rather than a leak: *"can't just make one hexagon start moving. make
them move in pairs, in opposite directions. One goes left, its neighbour goes right. Add them up,
you get zero."* The world now steps with no momentum supplied, 0 → ~1,400 per run, and its net
momentum is still exactly (0, 0). This is the first piece of machinery this project has **added**
rather than deleted, and it cost a constant, which rule 7 said it would.

**Capacity per kind** (item 6), derived as `clamp(k mod 8, 1, 6)` from the same valence law 2
reads, so nothing is stored and no table is typed. It gives a monovalent `v = 0` that cannot bond
to its own kind, a tetravalent `v = 4` that is its own best partner, and a six-bonded `v = 7` whose
bonds are all weak. That was not put in. **It is candidate form one and has been screened by
nothing**, which is the same position law 2's form was in before `screen.mjs` ran.

**Formation probability as a constant of its own** (item 28), not a fold into the clock: the clock
sets how often a site acts, this sets which act happens. The searched list stayed at seven, because
capacity left it the same day.

**GAP 3 tested rather than ratified** (item 25): *"run it hot and run it cold. test both."* The
file's single rule — motion breaks a stretched bond at cost `B`, and what cannot pay does not move
— turns out to produce both candidate behaviours, rigid below a held temperature of about 1 and
shattering above it, with a sharp crossover and no wide middle.

**And the bill, which is item 31.** Testing hot and cold immediately after the width change showed
that the bond-quality peak measured at ±15 the day before **does not survive at ±63**, and that
standing bonds collapse 14× across the crossover. Three causes are tangled — the wider momentum,
an unscreened kick probability of 0.25, and GAP 3's reading — and separating them is the next
measurement. The honest summary of the day: four laws changed, every book still balances, and the
one number that had looked like progress was measured under a width that no longer exists.

### Later the same day: GAP 3, and three guesses in the wrong order

Ric said "sure" to separating item 31's three causes, and the 2×2×2 came back with the ranking
reversed. **`THERMAL_KICK_PROB` was the prime suspect and it is innocent** — a twelve-fold change
in how often the world is shaken moves the result by at most 0.15 and changes no ranking, so the
constant is not load-bearing and should not be searched hard. **±63 is guilty but secondary.**
**GAP 3's reading was the cause**, worth more than everything else together, and it is the one
thing of the three that is a choice rather than a number. That re-opened item 25 hours after it
had been settled.

Then he said: "fix them. And continue they should move as units if the bond is strong enough but
I don't want to write that in." He did not need to write it in. Law 1 already says both halves —
*a soft strike moves a cluster together*, and *the group steps at `|p| / K`* — and the Lab had
never implemented either, because it moves one hexagon at a time. Implementing them settled GAP 3
with no new law and no new constant: mean binding energy **7.03 against 5.26 for blind grabbing**,
the best this project has measured, where the two readings that had been argued over for two days
scored 6.70 and 7.04-but-frozen.

**His own condition is the part that did not survive, and it is worth recording why.** "If the
bond is strong enough" is the engine's `owed > energy` test, and that is what was built first. It
came last of the three readings that let a cluster move. At the temperatures where chemistry
happens almost every bond *is* affordable, so it snapped before the drag was reached — the drag
fired 572 times a run instead of thousands, and the gate was permitting exactly what it was meant
to prevent. What survives is the half doing the work, that a bond holds against motion; what went
is heat deciding it *there*, because **law 2 already owns breaking and owns it with a sharper
test.** Letting law 1 break bonds too was GAP 3's invention from the start.

**And the fix broke rule 9, which is recorded here rather than resolved.** Finding a cluster
reads past a hexagon's neighbours. Rule 9 allows one exception, has the gravity pyramid in it,
and says to raise a second rather than add it — so item 32 raises it, and the engine carries the
violation meanwhile. The argument against allowing it is in law 1's own wording: "once momentum
has *spread* across a bonded group" describes momentum diffusing along bonds, which is local,
with `|p| / K` as the outcome rather than the recipe. **Reading a description of an outcome as an
algorithm is what cost both the locality and the light cone**, and one local mechanism would buy
both back. The chemistry does not depend on the choice — the local-but-frozen reading ties on
every chemistry number — so what the exception buys is moving matter, not selectivity.

The lesson from the day, and it is the same one twice: **two of item 31's three causes were only
as large as they were because of the third, and the third was the one nobody suspected.** Guessing
the ranking of tangled causes went 0 for 3.

### And then: "How does reality resolve that issue?"

That question ended GAP 3, after two days in which it had been settled twice and re-opened twice.

The drag had just gone in and it broke rule 9 — finding a bonded cluster reads past a hexagon's
neighbours. Rule 9 allows one exception, spends it on the gravity pyramid, and says to raise a
second rather than add it, so it was raised as item 32 rather than ratified. Ric did not pick from
the three options offered. He asked how reality handles it.

**Reality does not have the problem.** There are no rigid bodies: push one end of a steel bar and
the far end does not know yet, because the push is a compression wave at the speed of sound —
about 5,900 m/s in steel, four to five orders of magnitude under light. A truly rigid body would
signal faster than light, so relativity *excludes* it rather than merely discouraging it (Born
rigidity; the Herglotz–Noether theorem leaves such a body three degrees of freedom of motion
instead of six). **And nothing computes a body's total mass** — each atom answers to its own
neighbours, and `F = Ma` for the whole object is a theorem out of Newton's third law rather than
an algorithm anything runs. There is not even a fact about which atoms are in the body.

So law 1's `|p| / K` describes an **outcome**, and the drag had read the description as the
recipe. That is the general error worth keeping: *a law that states a consequence is not handing
you an algorithm, and implementing the consequence directly is how a non-local read gets in
wearing a law's clothes.*

Ric said "Do it", and the local mechanism reality points at was built: momentum spreading bond by
bond, one unit per event, triggered by the refused step — `shareMomentum`'s own transfer with a
new trigger and direction. **It was then rejected by its own measurement.** It is internal
friction and not propulsion: every transfer is inelastic, so each one sheds kinetic energy into
heat and a cluster is damped by its own wave. A bonded pair alone in a vacuum travelled **56
hexagons instead of 115**, worse in all four orientations, and in a full world it was marginally
worse on chemistry too. It is kept in `rejected/push-along-bond.txt` with the table, and `wave.mjs`
injects it back into a copy of the engine so the run can be repeated. Rule 7 prefers removing;
here removing won on the numbers as well.

**What GAP 3 settled on is the shortest of the four readings and adds nothing: the bond holds and
the step does not happen.**

**And the two corrections are worth more than the decision.**

**"Refusing the step freezes clusters solid" was wrong every time this project said it** — in
items 25 and 31, in `THE-LAWS.md`, in two commit messages and in `lab.mjs`'s own comments. On a hex
lattice `i` and `i + d` share two common neighbours, so a bond within 60° of the direction of
travel survives the step; only 120° and 180° refuse. **Transverse motion was free the whole time.**
Bonded matter steps about 14,500 times per million events; a bonded pair alone in a vacuum carries
its centre of mass 115 hexagons. The claim stood for two days because nothing counted bonded
steps, and the 86,000–183,000 "blocked" counts that looked like frozen clusters were the
longitudinal refusals only. `lab-check.mjs` Check 9 now watches `bondedStepped`, chosen because it
is the effect this project had been wrong about.

**The drag's chemistry advantage is unexplained rather than beaten.** It scored 0.67 of mean `B`
above every other reading, and it carried law 1's `|p| / K` inertia, which came in with it and
went out with it. **Two variables moved at once and were never separated** — which is exactly the
error item 31 was written to record, made again, four items later, by the same hand. It is item 33
and it is cheap to settle.

A prediction was also wrong and the control was again where the result was. The prediction: a pair
whose bond lies along its travel cannot translate at all. It translates, at 56 hexagons against
115, because the pair **rotates** out of the locked geometry instead of stalling in it. And the
wave's control run — the identical engine with one line removed — is the only reason the wave was
caught: it looked perfectly reasonable, it conserved exactly, every check passed, and it was
making the world worse.
