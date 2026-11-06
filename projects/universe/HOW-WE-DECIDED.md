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

Four parts, in this order:

1. **The five laws, one section each** — every correction (the wrong version kept beside the fix),
   every retraction, and the options weighed for that law. Fourteen corrections and five
   retractions are headed as such here; more are inside part 4.
2. **Rules that came off the list** — the six candidate laws that were deleted, and why. Read it
   before proposing a new law; `AGENTS.md` rule 7 requires it.
3. **The decisions of 2026-11-06** — the day the Lab became an engine.
4. **The register in full** — the complete argument behind every numbered item in `README.md`
   (items 1–33) and every road not taken, moved here verbatim on 2026-11-06 when the README was
   cut to a short spec. The README keeps each item's number, status and what decides it; this keeps
   the reasoning. Add new reasoning here and update the README's summary.

**Where the numbers come from.** The screening tools — `screen.mjs` (law 2's form), `radiate.mjs`
(radiation and the clock), `momentum.mjs` (law 1's momentum), `budget.mjs` (the hexagon's word) and
`orbit.mjs` (orbits and gravity's strength) — and, since 2026-11-05, the Lab itself: `lab.mjs` with
`lab-check.mjs`, and `wave.mjs` for the runs that settled item 25 and measured item 33. Any number
here came from one of those and can be reproduced.

**Numbers are as-of, and left as written.** The hexagon was four bytes (kind 8, energy 11, momentum
±3, bonds 6) until 2026-11-04; then eight bytes with energy 16 and momentum ±15; and from 2026-11-06
momentum ±63 (44 of 64 bits used) with the kinetic-energy scale `S` forced from 64 to 4. An entry that
records why a decision was made has to show the numbers it was made under, so older entries cite
`2047`, `11 bits`, `±3`, `±15` or `S = 64`. **`constants.mjs` is the current word**, and `README.md`'s
*What exists* states it.

**Earlier versions of the other documents.** On 2026-11-06 `README.md`, `THE-LAWS.md` and `AGENTS.md`
were rewritten for clarity and stopped carrying superseded paragraphs beside their replacements. The
README's register moved here (part 4). The long forms of all three are in git at commit `59d5d928`
— for example `git show 59d5d928:projects/universe/THE-LAWS.md`.

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
with no new law and no new constant: at **±15**, mean binding energy 7.03 against 5.26 for blind
grabbing, where the two readings argued over for two days scored 6.70 and 7.04.

*(Every figure in this paragraph is a **±15** figure and the Lab ships at ±63, where the same
readings score 6.45, 5.83 and 6.44. Quoting them without the width is the error the end of this
section is about — left standing here, labelled, because the mistake is the record.)*

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

**The drag's chemistry advantage was claimed to be 0.67 and unexplained. Both halves were wrong,
and the same day's "Run it. Why not?" settled it.** The 0.67 came from putting a **±15** figure
beside **±63** figures from a different harness — the two-variables-at-once error, committed inside
the sentence complaining about two variables at once. Measured properly, all four arms at the
shipped width: neither 6.36, `|p| / K` only **6.44**, the drag only 6.38, both 6.45. **`|p| / K`
carries all of it and all of it is 0.08**; the drag alone is 0.02, inside the seed spread. The real
gap across every arm is 0.09, about 7% of the +1.10 the engine already has over blind grabbing.

So **the rule 9 exception would have bought 0.08 of mean `B`**, and removing it cost almost nothing
— which is the useful thing to know, and the opposite of what the previous paragraph feared. The
two runs cross-validate: the earlier harness's `rigid` and `hold` arms at ±63 are the same two
configurations and scored 6.44 and 6.45, reproduced to the second decimal by different code.

The lesson repeats rather than extends: **three times in two days, a number was quoted across a
change of conditions.** Item 31's three tangled causes, the drag arm's two variables, and then this
figure. The habit that catches it is cheap and was available every time — say which width, which
reading and which harness a number came from, in the sentence that quotes it.

A prediction was also wrong and the control was again where the result was. The prediction: a pair
whose bond lies along its travel cannot translate at all. It translates, at 56 hexagons against
115, because the pair **rotates** out of the locked geometry instead of stalling in it. And the
wave's control run — the identical engine with one line removed — is the only reason the wave was
caught: it looked perfectly reasonable, it conserved exactly, every check passed, and it was
making the world worse.


#### Correction — the Lab did not always start at zero momentum

Found 2026-11-06 in a frozen run's header, fixed the same day (Ric: "Yep"). `seedWorld` draws each
primitive's momentum independently and `cancelNetMomentum()` then hands the remainder back one unit
at a time. It **stopped after 1,000 passes and returned quietly**, with a comment saying "the
assertion will say so" — which it could not, because the conservation assertion checks that momentum
stays *constant*, not that it starts at zero. About 23,000 draws at ±6 can sum to more than 1,000, so
x reached zero and y did not: seed 7 started at **(0, −84)** and seed 107 at **(0, −656)**, a
built-in preferred direction of exactly the kind rule 6 warns about. It now runs until the total is
exactly zero and throws if nothing can take the next unit; `lab-check.mjs` Check 7 asserts a zero
start, on seeds 7 and 107 by name. *(The seed-107 figure came from a sweep of 21 seeds run to find
which were affected; nothing in the project uses 107.)*

**What it touched:** only the frozen `runs/last` snapshot (seed 7) — 4,372 standing bonds became
4,319. Every other seed the checks and tools use cancelled within the cap, consumes the same random
draws under the fix, and reproduced byte-for-byte; items 25 and 33 were measured by `wave.mjs` with no
seeded momentum at all. The lesson is the one item 25 taught: **a comment that says something else
will catch a failure is a claim, and it needs a check of its own.**


#### Settled — matter never reaches the speed limit

Asked 2026-11-06 whether anything moves at the information speed limit, the answer was radiation —
and the lightest matter: law 1's speed was `min(1, |p|/k)`, so any primitive whose momentum reached
its kind moved at exactly the limit, kinds 1–63 could, and a kind-1 primitive needed one unit.
Nothing in the laws forbade it. Ric: *"I don't want anything of matter to reach that speed."*

Two rules were offered: relativity's `|p| / √(k² + |p|²)`, or a ceiling `min(V_MAX, |p|/k)`. A
ceiling costs a searched constant (rule 7) and flattens everything above it to one speed; relativity
costs nothing, approaches the limit without arriving, and is how reality does it. **Ric chose
relativity.** It is `matterSpeed()` in `lab.mjs`, credited to Einstein (1905) in `SOURCES.md`, and
`lab-check.mjs` Check 12 holds every kind at every legal momentum below the limit — the fastest is
kind 1 at full momentum, 0.99987. Kinetic energy stays Newtonian; that mismatch is stated in law 1.

**What it moved, measured with `wave.mjs` before and after:** the shipped engine's best mean `B`
went from 6.36 to 6.41, bonded steps from 14,495 to 15,075 per million events, and the `|p| / K` arm's
advantage from +0.08 to +0.05, now inside the 0.06 seed spread. A lone bonded pair travels about 15%
less far, which is the slower speed and nothing else. **`momentum.mjs` and `orbit.mjs` were re-run under it the same day** (Ric: "Rerun them with the new
equation"), with every speed↔momentum relation made relativistic — the step, the circular-orbit
setup (a circle needs `GM = |p| v r / k`, which is `v² r` only when `p = k v`), the per-tick pull
`|p| v / r`, and Check 10's "heaviest kind that can carry it". What moved:

- **`momentum.mjs`:** no (kind, momentum) pair sits at the limit any more (0.7–3.5% did at ±3 to
  ±15); kinds 1–16 average 0.331 of the limit instead of 0.372; heavy kinds, the speed counts and
  every collision figure are unchanged.
- **`orbit.mjs` Check 4:** at r = 20 the rounding rule now first orbits between ±127 and ±255, not
  ±63 and ±127 — relativity flattens `v` as `|p|` nears `k`, so the same pull needs more momentum.
  The derivation in its comment changed with it: under the old cap the orbiter's kind was a hard
  ceiling on radius (`r0 ≤ k`); under relativity there is no cap, and the ceiling is the momentum
  width (`p0 > r0`). The carry column, where every conclusion about orbits lives, is unchanged.
- **`orbit.mjs` Check 10:** kind 255 needs `|p|` 36 to carry the fall that melts the weakest bond
  (was 35) and 107 for the strongest (was 98); the heaviest kinds that can carry those falls inside
  ±15 are 109 and 36 (were 110 and 39). ±63 still covers the weakest; the strongest still needs ±127.
- **`orbit.mjs` Checks 8 and 12 moved where they should not have,** and that is the finding. Their
  heavy orbiters run at `|p|/k ≈ 0.006`, where the two speed rules differ by about two parts in a
  hundred thousand — yet "1 of 3" became "0 of 3" in two rows, "2 of 3" became "3 of 3" in
  another, and Check 12's count of completed orbits went from 9 of 18 to 8. A perturbation that
  small flipping outcomes means those per-row counts are chaotic, not measurements: **read Checks 8
  and 12 for their pattern** — heavy orbiters around large clumps, the coin losing everything, the
  spare bits losing every orbit at ε = 0.01, the second array matching exact carry row for row
  — **never for a single row's count.** Three seeds per row was rule 11's minimum and it is not
  enough to quote a row.

#### Correction — "115 hexagons" was a lap position, and the wave's rejection lost its main reason

Found the same day, by the speed change: one figure dropped tenfold where the rule could only explain
17%. `wave.mjs` measured how far a bonded pair travelled as its centre's position at the end minus at
the start. The Lab is a loop 258 hexagons wide, and the pair takes about 3,500 steps in 200,000
events — **it laps the world about four times**, so the difference was only where on its last lap
the run stopped. Every distance in section A was that: item 25's "115 hexagons in 200,000 events",
"a longitudinal pair manages 56", and the table that rejected the momentum wave for damping the pair
"by two to five times". The centre was also computed without unwrapping, so a pair straddling the
seam averaged to the middle of the world.

Measured properly — sampled every 2,000 events, each step unwrapped, the path summed — **every
orientation travels about equally far** (1,043–1,079 hexagons), and **the wave carries the pair no
further and no less** (1,025–1,059). So the claims that a longitudinal pair is slowed and that the
wave damps motion are withdrawn. **The wave stays rejected**, on what remains: it is no better for
chemistry in a full world (6.39 against 6.41) and no different for bonded steps, and rule 7 prefers
removing fifty lines that buy nothing. `rejected/push-along-bond.txt` carries the corrected table
above its original one. **The lesson, now `AGENTS.md` rule 12's seventh: on a torus, a distance is a
path, not a difference.**


#### Open — motion on the lattice: six headings, a coin, and momentum too coarse to orbit (item 34)

Ric asked whether the orbits are like reality. Measured against it: the mechanism matches (gravity
adds momentum, falling speeds a body up), but circles go lopsided, orbits wander, only the heaviest
kinds orbit, orbits are rare, and single results are chaotic. Asked how to fix that with the least
added, the diagnosis was two root causes — whole-unit momentum is too coarse at legal strengths, and
position is snapped to the hexagon — and two additions: finer momentum units, and a position within
the hexagon. Then Ric found a third face of the second cause himself: *"if the direction of movement
is right on the corner ... it needs to actually be 50/50 on the first move but then every time needs
to be the opposite."* A coin on every tied step is a random walk off the line, and his alternation is
Bresenham's rule for a tie (credited in `SOURCES.md` before use).

**Measured, `orbit.mjs` Checks 13 and 14, 2026-11-06:**

| | coin (today) | Ric's alternation | tracked position |
|---|---|---|---|
| exact tie, off the line after 10,000 steps | 43 hexagons (worst 121) | 0 (worst 0.5) | 0.5 |
| 10° off a lattice direction | 1,736 — travels at 0° | 1,736 — travels at 0° | 0.17 |
| 20° off | 3,420 — travels at 0° | 3,420 — travels at 0° | 0.11 |

So Ric was right about ties and the problem is wider than ties: nearest-of-six gives the world six
headings outright, a grid artifact of exactly the kind hexagons were chosen to avoid. Alternation
fixes the tie; only tracking fixes the heading.

| orbits, ±63 | today | fine momentum | fine + alternation | fine + tracked position | control (Newton) |
|---|---|---|---|---|---|
| eccentricity from a circular start (r 20/100/500) | 0.47 / 0.30 / 0.38 | 0.32 / 0.20 / 0.19 | same as fine | 0.001 / 0 / 0 | 0.001 / 0 / 0 |
| angular momentum change per lap | +2.0% / +1.7% / +1.1% | −1.5% / −0.26% / −0.11% | same as fine | 0 | 0 |
| legal strength, kinds 255 / 64 / 1 orbit | 255 only, larger clumps only | all, every seed | all | all | all |
| Kepler, T²/r³ at 2× and 4× the radius | 1.048 / 1.198 | — | — | 0.9997 / 0.9996 | 0.9997 / 0.9996 |

**Fine momentum** alone fixes who can orbit; **the tracked position** fixes the shape and the
angular momentum; together they are indistinguishable from the continuous control in every row
measured. Alternation does nothing once momentum is fine, because exact ties stop occurring. The
angular momentum holds exactly because `orbit.mjs` updates momentum from the pull at the current
position and then position from the new momentum — symplectic Euler, which conserves it under any
central force (Hairer, Lubich & Wanner, credited). The lattice alone could never conserve it; this
update order does, by construction.

**Not adopted** — it is Ric's call and two pieces of stored state under rule 5 — and the README item
lists what must be settled before it can go into the engine: the tracked position under a blocked
step, scheduling an edge crossing in event-driven time, collisions over a fine outcome set, `S`, and
the Lab's chemistry re-checked.


#### Settled — tracked stepping goes into the Lab, fine momentum waits for gravity (item 34)

Ric, 2026-11-06: *"I'm fine with the added state it's not much."* Two decisions followed.

**Fine momentum is adopted for the World and not built into the Lab.** In the Lab every change to
momentum is whole units — collisions, sharing along a bond, the thermal kick — and only gravity's pull
makes fractions, and gravity is held out of the Lab. So fine units there would be a change of
representation with no change of behaviour. It goes in with law 3's solver, and item 19's residual
is part of it.

**Tracked stepping is built and is the default** (`SETTLED.STEPPING = "track"`). Simpler than first
proposed: a motion event moves the primitive into the hexagon its straight path enters next, at a
rate of speed over the distance to that edge, so timing needs no new machinery and at most one
hexagon is crossed per event. Each primitive starts at a random point in its hexagon, which is Ric's
"50/50 on the first move" done once — from a random point an exact tie has probability zero.

**The first version jammed the world, and the counter said why.** A path that clips a corner can be a
billionth of a spacing from its next edge; if a bond refuses that crossing the primitive retries a
billion times faster than anything else. 387,477 of 400,000 events were refusals. `LAB.TRACK_EDGE_FLOOR`
(1/16 of a spacing) floors the distance; a free primitive's speed is unharmed, within 1.2% on five
headings with heading error 0.00° (`lab-check.mjs` Check 13; nearest-of-six missed by 20–27°).

**What it moved, at equal simulated time** (three seeds, held T, mean `B`; nearest → tracked): T 0
5.56 → 5.57, T 2 5.80 → 5.82, **T 6 6.41 → 6.23**, T 20 5.36 → 5.42. The peak stays at T 6 and falls
by 0.18, beyond the 0.02–0.04 seed spread. Bonded steps rise about threefold — clusters move more —
and the run costs about 2.3× the events per unit of time, because a primitive that bounces back sits
on the edge it just crossed and re-crosses it at once. Distance travelled per unit time is still
right; it is hexagon crossings that multiply. `wave.mjs` under tracked stepping: shipped 6.27 at T 6,
`|p| / K` +0.07 inside a 0.08 spread (item 33).

**One reversal to flag rather than act on.** Under tracked stepping the rejected momentum wave
carries a lone bonded pair 10–25% further (1,026–1,051 hexagons against 824–978). Its rejection rested
on buying nothing; chemistry is still a tie (6.27 each), but motion now favours it. It stays in
`rejected/` until Ric says otherwise.

---

## The register in full

*Moved here from `README.md` on 2026-11-06, verbatim, when the README was cut down to a short spec
and work list (Ric: "They should be clear and concise"). The README keeps every item's number,
status and what decides it; this is the argument behind each, with the wrong turns and retractions
left where they were made. Item numbers are the ones every other file cites ("README item 20").
Edit the README's summary when an item moves; add the reasoning here.*

### Open questions

The register — everything undecided, in one place, in the order it has to be settled, each with
**what would decide it.** Most of these are not arguments to win. They are experiments to run.

#### Must be settled before any code is written

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
field: the spare bits exist (24 then, 20 since ±63), and `AGENTS.md` rule 5 says nothing goes in them without an entry in
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
  then exact in the long run but arrives in lumps. It **needs a new stored field**: the spare
  bits can hold it (24 then, 20 since ±63), and rule 5 says nothing goes in them without an entry in `THE-LAWS.md` and a
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

**20. How strong is gravity — and is there any strength that does both its jobs?** **The momentum
half is settled as of 2026-11-06: ±63.** *(Ric, choosing between ±15, ±63 and ±127.)* The width went
from 10 bits to 14, so the word is 44 of 64 with 20 spare, and `MOMENTUM_RANGE` is 63.

**What forced it, measured.** Gravity was bolted onto the Lab from outside and the symmetric clamp
refused **every pull it was offered — 562,344 attempts, not one impulse landed**, because the world
sat near ±15 already and every legal move was taken. At the strongest setting tried, gravity
produced output byte-identical to the no-gravity control. This item had predicted it from the
energy side; that is the same wall reached from the other direction.

**And it cost exactly what this item said it would** — "either moves law 1's kinetic-energy window,
so `S = 64` would need re-measuring." It does. The largest legal `Q` went from 450 to 7,938 at the
vector (−63, 0, 63), which is 17.64×, and the window's ceiling is the `S` at which a kind-1
primitive at full speed overflows the 16-bit energy field — so **the window fell from 2–291 to
1–16, and `S = 64` left it.** `S` is now **4**, picked by `S = 64`'s own three stated reasons: a
power of two, every kind gets a usable amount, and the largest kinetic energy stays a modest share
of the field (24.2% at ±63 with `S = 4`, against the 22% that `S = 64` gave at ±15 — the same
world, rescaled). `S = 16` is legal and sits at 96.9%, which is the failure the third reason
exists to prevent. The method was validated by reproducing the documented 2–291 before being
trusted on 1–16.

**The strength, the size and the shape are still open**, and they are still one decision. What
follows is the original item. Raised
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

*(**Where the numbers in items 23 to 30 come from.** Every count below was first written from a
single run on one seed with one unscreened constant set, which is not what rule 10 asks for and not
what rule 11 accepts. Ric asked. They were then measured across **8 seeds** at 400,000 events and
**6 variations of the constants** — capacity 1 and 6, formation probability 0.05 and 0.9, transport
rate 0.1, and a clock floor giving a 4:1 spread instead of 17:1. **Every effect is nonzero on every
seed and every variation**, and the spread across seeds is about 3%: cold-rigid steps 3,669-3,845,
emissions blocked 98-137, quanta waiting 171-231, bonds stretched 5,627-5,862. The magnitudes do
move with the constants, as they should — five times less formation probability gives four times
fewer bonds — so read any single number as "with `CANDIDATE_ZERO`, which is screened by nothing",
and the ranges as the thing that survived.)*

**23. What is the causal limit, in a world with no tick?** *(Raised 2026-11-05 by writing
`lab.mjs`, which could not start without an answer.)* Law 1 states speed as "one hexagon every
`k/|p|` **ticks**, capped at one per tick", and the locality fact states the limit as "one hexagon
per **tick**". The World is ticked, so both read straight across. **The Lab is not** — `TWO-RUNS.md`
puts it in event-driven continuous time on purpose, so "per tick" has no referent there and
something has to supply one.

What `lab.mjs` does, which is a choice and not a derivation: the causal limit is the rate of the
**fastest clock the world can have**, `clockRate(T_max)`. Then nothing outruns the hottest matter,
radiation rides exactly at the limit as the structural fact says, and no new constant is
introduced. Two things to weigh against it. It makes the causal limit depend on the **clock
constants**, so changing the clock changes the speed of light — which is either a deep feature or a
bug, and nothing here says which. And the limit is then set by a temperature nothing in the Lab
ever reaches, so in practice the cap almost never binds.

**24. What does "offset the partition each step" mean with no step?** *(Raised 2026-11-05 by
`lab.mjs`.)* Law 1 resolves collisions in Margolus blocks and says to "offset the partition each
step so information still crosses the whole lattice". The offset exists to stop a fixed block
boundary from becoming a feature of the physics. **In continuous time there is no step to offset
on.**

`lab.mjs` builds the block as the triangle of three mutually adjacent hexagons containing the
colliding pair — of which there are exactly two — and picks between them with a **coin**, which is
the answer law 1 already gives a tied direction, for the same reason. That makes the partition
fresh per collision rather than offset per step, so no boundary can persist. It is not obviously
equivalent to what the law asks for, and the equivalence has not been measured.

**25. ~~May a bonded primitive step, and what happens to a bond that motion stretches?~~ Settled
2026-11-06 — the file's reading stands, and it was tested rather than ratified.** *(Ric: "run it
hot and run it cold. test both.")*

The reading in `lab.mjs` is that the bond cannot stretch, so motion breaks it at its full cost of
`B`, and a primitive that cannot pay does not move. **That one rule produces both candidate
behaviours depending on temperature**, which is why hot-and-cold is the test and not a compromise:
cold clusters are rigid because nothing can afford to come apart, and hot ones shatter because
breaking is cheap. Measured over 3 seeds and 1M events each, with no momentum supplied so every
move is the new thermal kick:

| held T | steps | stretch-breaks | blocked, too cold | bonds standing |
|---|---|---|---|---|
| 0 | 34,908 | 4,563 | **56,308** | **14,180** |
| 2 | 408,822 | 10,755 | 7,266 | 991 |
| 6 | 413,750 | 8,173 | 2,761 | 717 |
| 60 | 412,926 | 6,403 | 475 | 506 |

**The crossover is real and it is sharp — it sits between 0 and 2.** Rigid below it, shattering
above it, with no wide middle.

**RE-OPENED THE SAME DAY, and the strikethrough above should be read as struck through again.**
The test above asked whether the file's reading produces both behaviours, and it does. It did not
ask whether a rival reading produces *better chemistry*, and item 31's 2×2×2 says one does, by a
wide margin. The rival: **a step that would stretch any bond simply does not happen**, at any
temperature — bonds are unbreakable by motion, and break only thermally at `e ≥ B·kind`. Against
the file's reading it roughly triples how much motion sorts bonds toward favoured pairings
(+1.46 against +0.54 at ±15, +0.93 against +0.05 at ±63) and keeps three to four times as many
bonds standing. **It is now the leading reading, and the file holds the other one.**

What it costs, and why this is not a one-line fix: the rival **contradicts law 1's elasticity**,
which says a strike travels through a cluster as a wave. Under it a bonded cluster cannot move at
all — the blocked-too-cold count runs to 86,000–183,000 per run, every one of them a bonded
primitive frozen in place — so clusters never move as units and never collide as units. Both
readings are therefore wrong about something, and **the third reading, which neither variant
implements, is the one law 1 actually describes: the cluster moves together.** That is real work
rather than a choice between two lines, because nothing in the engine can presently move more
than one hexagon at a time.

**SETTLED 2026-11-06 — the bond holds and the step does not happen. That is the whole answer, and
it adds nothing.** *(Ric: "fix them. And continue they should move as units if the bond is strong
enough but I don't want to write that in", then, told the drag broke rule 9 and asked how reality
resolves it, "Do it".)* Four readings were built and measured over two days. The shortest won, on
the measurement as well as on rule 7's preference for removing.

| reading | what happens to a stretched bond | mean `B` | over blind | clusters move? |
|---|---|---|---|---|
| **holds** | nothing happens; the step is refused | **6.36** | **+1.10** | **yes — 14,495 bonded steps** |
| drag | the whole bonded cluster translates at once | 6.38 | +1.12 | yes, but non-locally |
| wave | the momentum goes along the bond instead | 6.34 | +1.08 | yes |
| break | the bond breaks if the stepper can pay | 5.83 | +0.57 | yes |

**All four at the shipped momentum width, ±63, which the first version of this table got wrong —
see correction 2.** Blind grabbing is 5.26 and a perfect bond is 8. The whole table spans **0.09**,
against a seed-to-seed spread inside one arm of up to 0.04, so GAP 3's reading is worth very little
to the chemistry either way. What the reading decides is whether bonds survive at all, and `break`
is the one that answers differently: it is the only row below +1.0.

**Two corrections are more valuable than the decision, and both are retractions of things this
project said confidently.**

**1. "Refusing the step freezes clusters solid" was wrong every time it was said** — in items 25
and 31, in `THE-LAWS.md`, in two commit messages and in `lab.mjs`'s own comments. **Clusters were
never frozen.** On a hex lattice `i` and `i + d` share two common neighbours, so **a bond within
60° of the direction of travel survives the step** and the existing re-pointing code carries it;
only bonds at 120° and 180° refuse. Transverse motion was free the entire time. Measured once a
counter existed for it: bonded matter takes about **14,500 steps per million events** at the
temperature chemistry likes, and a bonded pair alone in a vacuum carries its centre of mass **115
hexagons in 200,000 events**. The claim went unchallenged for two days because `bondedStepped` did
not exist, and the 86,000–183,000 "blocked" counts that were read as frozen clusters were the
*longitudinal refusals only*. `lab-check.mjs` Check 9 now watches `bondedStepped` for exactly this
reason.

**2. The first version of this table said the drag scored 7.03 and that its 0.67 advantage was
unexplained. Both halves of that were wrong, and the error was mine twice over.** The 7.03 is a
**±15** figure and it was put beside **±63** figures from a different harness — so the "0.67 gap"
was mostly the momentum width, which is the two-variables-at-once mistake *inside the sentence
complaining about two variables at once*. And the drag arm also carried `|p| / K` inertia that no
other arm had, so even at one width it moved two things.

**Separated 2026-11-06** *(Ric: "Run it. Why not?")*, all four arms at ±63, in `wave.mjs` section D:

| arm | mean `B` | over blind | seed spread |
|---|---|---|---|
| neither — as it ships | 6.36 | +1.10 | 0.01 |
| `\|p\| / K` only | **6.44** | **+1.18** | 0.02 |
| the drag only | 6.38 | +1.12 | 0.01 |
| both, as it was removed | 6.45 | +1.19 | 0.04 |

**`|p| / K` carries essentially all of it, and all of it is 0.08.** The drag alone is worth 0.02,
inside the seed noise. The real gap was never 0.67; it is **0.09 across every arm**, about 7% of
the +1.10 the engine already has over blind grabbing. So nothing was given up by removing either:
**a rule 9 exception would have bought 0.08 of mean `B`.** Item 33 has what this does and does not
settle.

*(The two runs cross-validate, which is the reason to believe them: the earlier harness's `rigid`
and `hold` arms at ±63 scored 6.44 and 6.45, and they are the same two configurations as
`|p| / K only` and `both` here — reproduced to the second decimal by different code on different
seeds.)*

**What Ric asked for, and what he got.** He asked for clusters that move as units if the bond is
strong enough. They do move — he was right that it needed no writing in, and righter than the
implementation that was built for it. "If the bond is strong enough" is the engine's own
`owed > energy` test and it was built that way first; it is the `break` row, and the gate let
almost everything through, because at the temperatures where chemistry happens almost every bond
*is* affordable. What survives is the half doing the work: **a bond holds against motion.**
Breaking is law 2's, by the sharper test it already had — temperature at or above `B`. Letting law
1 break bonds as well was GAP 3's own invention from the start.

*Reproduce:* `node wave.mjs` for the pair runs and the world comparison;
`rejected/push-along-bond.txt` holds the mechanism that was almost adopted, with the numbers that
killed it.

*(Superseded framing follows.)* ~~Raised~~
2026-11-05 by `lab.mjs`.)* Law 1 settles that clusters are **elastic rather than rigid** — a strike
travels through one as a wave at no more than one hexagon per tick — so bonded primitives do move.
Nothing says what becomes of a bond whose partner is left out of reach.

`lab.mjs` takes it that a bond cannot stretch, so a step that would stretch one **breaks** it at
its proper cost of `B`. That keeps the light cone, keeps the accounting exact, and makes a hard
strike shatter a cluster, which is what law 1 says should happen.

**It also produced a consequence nobody wrote down, and this is the part worth reading.** Breaking
absorbs `B`, so a step that would stretch bonds has to be able to **pay** for them — and a cold
primitive cannot. So **cold clusters are rigid, and they are rigid because they cannot afford to
come apart**, not because any rule says so. Heat one and it can move again. That is melting
arriving out of laws 1 and 2 meeting, with nothing added. It fired 3,765 times in the first
400,000-event run.

**26. Radiation's six bits are exact only under lockstep.** *(Found 2026-11-05 by `lab.mjs`
crashing on its own assertion.)* The radiation fact argues the six direction bits are "exact rather
than a cap", because a quantum in a given slot "can only come from the one neighbour behind it —
and that neighbour is either matter or vacuum, never both. There is no third source to collide
with." **That argument assumes every quantum moves at the same moment.** `radiate.mjs` measures it
under ticked time and finds zero collisions, which is correct for ticked time.

In the Lab every hexagon propagates at its own drawn time, so a trailing quantum catches the one
ahead and finds the slot full — and one emitter can emit twice before its first quantum has moved
on. Of the ways out, dropping the quantum destroys energy, widening the field is what rule 5
forbids without a reason written here, and going synchronous abandons the Lab's time model. So
`lab.mjs` makes the **quantum wait**: nothing moves, nothing is lost, and the attempt is counted
(119 emissions blocked and 161 quanta waiting in 400,000 events). **What that costs is the claim
that radiation always travels at the causal limit and never slower**, which `THE-LAWS.md` makes
twice. Either that claim is ticked-time-only, or the Lab needs a different answer.

**27. Momentum is a mixing condition, not a chemistry one.** *(Raised 2026-11-05 by the first run
reporting kinetic energy of exactly zero. **Reframed the same day by Ric, and the first framing was
wrong enough to be worth keeping below.**)*

With gravity held out, **none of the four remaining laws can produce momentum where there was
none.** Law 1 conserves it; law 2 has no distance term and so no force; law 4 is a constraint; law 5
moves energy and not momentum. A collision can turn heat into motion, but a collision only happens
when something steps into something else, which needs momentum already.

*(This first said that made the Lab "frozen for ever" and treated it as a hole the laws had to fill.
Ric: "Gravity isn't in the lab..... lol. The lab is just the chemistry right? Gravity doesn't really
effect the chemistry..." That is correct and it is the whole design — law 3's own constraint is that
gravity stays orders of magnitude below the weakest pair force precisely so it cannot touch
chemistry, and `TWO-RUNS.md` has the Lab's conditions "set and held — it's a laboratory". A
laboratory you supply the conditions to is not a world with a missing law. The finding is smaller
and more useful than the one first written here.)*

**Chemistry does not need motion at all, measured.** With zero initial momentum, nothing in the
lattice ever steps — at a held temperature of 1, 64 or 200, through 6.4 million units of heat — and
**12,222 bonds still stand**. Bonding is driven by the clock and by `B`, and neither reads momentum.

So what motion buys the Lab is **mixing**, and that is a real need rather than a law's job: without
it only the pairs the seeding happened to place next to each other ever react, so the table measures
the initial arrangement instead of the chemistry. It also **costs** bonds — 4,653 standing with
±6 momentum against 12,222 with none, because stretched bonds break (item 25).

That makes initial momentum a **third held condition** beside the hot and cold bands, swept rather
than chosen, and the open question is only whether `TWO-RUNS.md` should name it as one. `lab.mjs`
draws it and then cancels the net to zero, because a looped world has no wall to absorb a drift and
a net drift would look exactly like "a preferred direction in the physics".

**28. ~~Law 2's formation probability is not among the search space's seven.~~ Settled 2026-11-06
— it is a searched constant in its own right, not a fold into the clock.** *(Ric: "make it
eighth".)* `BOND_FORM_PROB` keeps its name in `constants.mjs` and the engine still refuses to run
without it.

**Why not the clock:** the clock sets how *often* a site acts, and this sets *which* act happens
when it does — the same fire may bond, transport, share momentum or now kick. Folding them would
make one number do two jobs, and law 2 would have had to say so in writing.

**And the count did not actually go to eight**, which is worth stating so it does not look like a
coincidence later: law 4's `CAPACITY` left the searched set the same day (item 6), so one constant
became a form while a different one that had been running unnamed got a name. *Original text
follows.* *(Found 2026-11-05
while writing `constants.mjs`.)* Law 2 says "a bond forms with a fixed probability when the clock
fires — never instantly on contact." That is a number, it is derived from nothing, and *The search
space* above does not count it. Either it is an eighth searched constant, or it folds into the
clock and law 2 should say so. `constants.mjs` holds it as `BOND_FORM_PROB` with **no value**, and
the Lab refuses to run until it is given one.

**And two more conservation seams, both now closed.** The structural fact *Bond energy accounting
is exact* names the laws 2-and-5 seam as "the one place conservation is actually at risk". Building
the Lab found two more of exactly that shape, both caught by the assertion rather than by reading:

- **A standing bond holds negative potential.** Forming releases `B` into the heat field, so the
  bonded state is `B` lower than the unbonded one. Leave that term out of the ledger and a bond
  that forms and stays formed looks like heat arriving from nowhere — 18,541 units over 50,000
  events. The conserved total is `heat + Σ KE + in flight − Σ B over standing bonds`.
- **Momentum sharing along a bond is inelastic.** Law 1 says a bonded pair exchanges momentum
  "equal and opposite, one hop per clock fire. Nothing else is added." Momentum is linear and its
  sum is conserved by that construction — but **kinetic energy is quadratic**, so equalizing two
  velocities destroys some of it, and that has to go into the heat field exactly as a collision's
  does. 34,864 units over 50,000 events before it did. A cluster would have quietly cooled the
  world every time it flexed, which is precisely the slow, silent, physics-looking failure that
  structural fact warns about.

**29. ~~Heat never becomes motion, so the clock's fourth job does not follow.~~ Settled 2026-11-06
— connect them, in opposite-moving pairs.** *(Ric: "connect them. can't just make one hexagon start
moving. make them move in pairs, in opposite directions. One goes left, its neighbour goes right.
Add them up, you get zero.")*

**The pairing is the whole of it.** A single hexagon starting to move is momentum from nowhere,
which is law 1's one inviolable thing, and it would also be a preferred direction in the physics. A
pair moving oppositely sums to zero exactly, in integers, with nothing left over — the same
construction law 1 already uses for a bonded pair's exchange, and the reason that one conserves.
The kinetic energy is paid to or from the heat field, because momentum is linear and cancels while
KE is quadratic and does not; that seam cost 34,864 units the first time it was missed, so
`tryThermalKick` reuses `shareMomentum`'s accounting rather than inventing a second one.

**New machinery costs a constant, and rule 7's price is paid out loud:** `THERMAL_KICK_PROB`.

**Measured** in `lab-check.mjs` Check 10, which previously asserted the opposite: with no momentum
supplied at all, the world now steps 1,356 / 1,528 / 1,473 times at the three held bands where it
stepped **0 / 0 / 0** before — and the world's net momentum is still exactly **(0, 0)** at every
band. The old assertion is quoted in the check so the inversion is visible.

**What is NOT yet shown is thermal pressure itself.** Hot regions have to move *more* than cold
ones, and three bands on one seed cannot tell a trend from noise — the step counts were monotonic
at `KE_SCALE 64` and stopped being monotonic at 4. That needs a sweep. *Original text follows.*
*(Found 2026-11-05 by
measuring item 27 properly.)* The clock section of `THE-LAWS.md` credits the temperature-dependent
rate with four jobs, and the fourth is:

> **It is where thermal pressure comes from.** Hot matter moves more often, so hot regions expand
> against cold ones with nothing written down to make them.

**The middle clause is not true as the laws stand.** A hot hexagon's clock fires more often, so it
bonds, transports and shares momentum more often — but *stepping* is law 1's own rate,
`min(1, |p|/k)`, and it knows nothing about temperature. A hot primitive carrying no momentum does
not move, however hot it gets: **zero steps at every temperature tested, with 6.4 million units of
heat in the lattice.**

This is the one place the project has split something our own universe does not: here temperature
and kinetic energy are two separate fields, and in reality temperature *is* kinetic energy. The
other three of the clock's jobs are untouched — radiation, the second law and reaction rates all
only need the clock to act more often, and it does. But there is no thermal motion, no diffusion
and no Brownian mixing anywhere in this physics, and **this is a claim about the World as much as
the Lab**, because it is the clock that was supposed to supply it. Either the fourth job comes off
the list, or something has to couple heat to momentum — which would be new machinery, and rule 7
says what that costs.

**30. The held hot band has a ceiling, and it needs headroom.** *(Found 2026-11-05, twice, by
`lab.mjs` refusing to continue.)* Two separate loud failures, both of them rule 5 working:

- `HOT_T` x kind must fit the energy field. A band held at 4,096 is impossible the moment a kind-20
  primitive enters it: 81,920 over a 65,535 field. So the hottest holdable band is
  `ENERGY_MAX / heaviest kind present` — **257 with kind-255 matter around**, which is item 15's
  heavy-matter ceiling arriving as an experimental limit rather than a chemistry one.
- And it cannot sit *at* that ceiling either. A kind-255 primitive held at exactly 257 holds the
  whole field, so the next quantum of radiation to arrive has nowhere to go. The band needs room
  beneath the ceiling for whatever radiation can deliver.

Neither is a question about the physics; both are constraints on the sweep, and they belong wherever
the Lab's conditions get written down, because a sweep that walks `HOT_T` upward will hit them.

**Settled 2026-11-06** *(Ric: "Fix it please")*. Both bullets became code. The ceiling is derived,
`HOT_T_MAX = floor(ENERGY_MAX / KIND_MAX) − 1 = 256`, and `THERMOSTAT_SWEEP.HOT_T` reads it — it had
said `[4, 4096]`, so a sweep would have crashed at its first step past 257. `validateThermostat()`
refuses a band past it when the `Lab` is built, so the failure comes before the run, not thousands
of events in. The `− 1` is the headroom, and it was measured rather than assumed: the Lab records
the largest share of a held hexagon's room under the field that arriving energy used before the
thermostat refired, and at 256 on three seeds over 200,000 events that was **1.8%, 0.1% and 3.9%**
(`lab-check.mjs` Check 11, which fails above 50%). It is checked against kind 255 because the Lab
seeds every kind; a run that seeded only light kinds could hold a hotter band, and that would be a
separate experiment with its own stated limit.

**31. At ±63 with the kick on, motion destroys the chemistry — and the sweet spot found the day
before does not survive.** *(Found 2026-11-06 by testing item 25 hot and cold, immediately after
adopting ±63, `S = 4` and the thermal kick.)* **This is the bill for item 20's momentum decision
and nobody predicted it.**

On 2026-11-05, at ±15 with momentum supplied by hand, bond quality peaked at a held temperature
of 6: mean `B` of **5.93** against 5.26 for blind grabbing, about 40% of the way to a perfect 8,
and ten times the seed-to-seed spread. **That peak is gone.** At ±63 with the kick supplying the
motion, mean `B` reads 5.73 at `T = 0`, 5.54 at 2, 5.72 at 6 and 5.36 at 60 — no peak, and the
best figure is now at **zero temperature**.

Worse, the bonds themselves collapse: **14,180 standing at `T = 0` against 991 at `T = 2`**, a 14×
fall across the crossover, and 506 at `T = 60`. A world that moves this hard shatters everything
it builds. Three candidate causes, unseparated:

1. **±63 makes motion violent.** The largest `Q` is 17.64× what it was, so a stretched bond is
   broken by far more of the velocity distribution than before.
2. **`THERMAL_KICK_PROB = 0.25` is almost certainly far too high.** It is `CANDIDATE_ZERO`'s
   arbitrary value and it is offered at every clock fire, which may simply be a world being
   shaken to pieces on purpose.
3. **GAP 3's reading may be wrong after all** — `lab.mjs` says of it "the one most likely to be
   wrong in this file", and item 25 has just ratified it on a test that did not vary the width.

**SEPARATED 2026-11-06, the same day.** *(Ric: "sure".)* A 2×2×2 over the three causes, each arm
swept over held `T` of 0, 2, 6 and 20, 3 seeds and 1M events per point — 96 runs, in
`gap3-split.mjs`, which generated the four engine variants it needed into the OS temp directory
and never wrote to `lab.mjs`. **That file was deleted later the same day and this run reproduces at
commit `31517359`, not at HEAD** — it worked by patching GAP 3's branch, and settling GAP 3 removed
every anchor it patched, so it could only have been kept as a file that throws. `wave.mjs` is its
replacement for the engine as it stands. Everything else is the physics of 2026-11-06, `S = 4`
included, so
**the ±15 arm is not the 2026-11-04 world** — it is today's world with narrower momentum, which
is what isolates the width. "Gain" is the best mean `B` at any `T > 0` minus the frozen value,
which is the annealing claim stated as a number. Blind grabbing is 5.26.

| momentum | GAP 3 | kick | best mean `B` | gain over frozen | bonds kept |
|---|---|---|---|---|---|
| ±15 | rigid | 0.02 | **7.03** at T=6 | **+1.46** | 40% |
| ±15 | rigid | 0.25 | 7.01 at T=6 | +1.45 | 38% |
| ±63 | rigid | 0.02 | 6.50 at T=6 | +0.93 | 24% |
| ±63 | rigid | 0.25 | 6.36 at T=6 | +0.78 | 21% |
| ±15 | break | 0.02 | 6.30 at T=6 | +0.54 | 11% |
| ±15 | break | 0.25 | 6.32 at T=6 | +0.50 | 12% |
| ±63 | break | 0.02 | 5.67 at T=6 | +0.05 | 5% |
| **±63** | **break** | **0.25** | **5.74** at T=6 | **+0.03** | **5%** |

The bottom row is what ships. **The three causes are nowhere near comparable in size, and the
ranking is the reverse of the order they were guessed in.**

1. **GAP 3's reading is the cause.** It is worth +0.92 of gain at ±15 and +0.80 at ±63, which is
   more than everything else put together, and it is a *choice* rather than a constant. Item 25
   is re-opened on it.
2. **±63 is a real but secondary cause, and its cost depends on cause 1.** Under the rival
   reading the width costs 0.53 of gain; under the file's reading it costs 0.51 of a much smaller
   number, wiping out 94% of what is there. So ±63 does its damage mainly by making bonds
   breakable-and-broken, and **if GAP 3 is settled the other way, item 20's momentum decision
   costs far less than this item first claimed.**
3. **`THERMAL_KICK_PROB` is not a cause at all.** 0.02 against 0.25 — a 12× change in how often
   the world is shaken — moves the gain by at most 0.15 and the ranking not at all. **It was the
   prime suspect and it is exonerated**, which also says the constant is not load-bearing and
   should not be searched hard.

**The headline is better than this item was written to report.** The peak is not gone from the
physics, only from the configuration that shipped, and at ±15 under the rival reading mean `B`
reaches **7.03 against 5.26 blind** — the strongest selectivity this project has measured, where
2026-11-05 got 5.93. The crossover temperature never moved either: **all eight arms peak at
T = 6**, which is itself a result, because T = 6 was found at a different width, a different `S`,
and with momentum supplied by hand rather than by the kick.

Two cautions on the table. "Bonds kept" is partly tautological under the rival reading, since
that reading removes one of the ways a bond can die; mean `B` is not, and it is the column that
carries the argument. And a gain of +0.03 or +0.05 is noise, so the two bottom rows should be
read as **no peak**, not as a small one.

*What is left of this item:* nothing to separate. It is a pointer to item 25, which is where the
decision moved and was then settled the same day on a third reading neither of these arms
contained. Note what was never in doubt: momentum stayed exactly (0, 0) through all 96 runs — at
either width, under either reading, at either probability. The kick does not leak.

**One figure here is superseded and worth keeping visible.** This item's headline was that ±63
cost 94% of the annealing gain. That was measured with the shipped GAP 3 reading, and under the
reading adopted in item 25 the width costs **+1.77 → +1.19 over blind**, a third rather than
almost all of it. ±63 is still the more violent world; it is no longer the expensive mistake this
item made it look like. **The general lesson, which is the reason not to overwrite the paragraph
above:** two of the three causes in this item were only as large as they were *because of the
third*, and the third was the one nobody suspected.

**32. ~~The Lab now reads past a hexagon's neighbours, and rule 9 says that is Ric's call rather
than mine.~~ Closed the same day — the read is gone and rule 9 is back to one exception.** *(Ric,
told the drag broke rule 9 and asked how reality resolves it: "Do it".)* **Locality is absolute in
`lab.mjs` again.** `dragCluster`, `clusterOf`, `clusterTotalKind` and the cluster-walking
`motionRateAt` are all removed; the gravity pyramid is once more the only non-local read in the
codebase, and `wave.mjs`'s cluster walks are an **observer**, which rule 9 does not bind — it
constrains the laws, not the instruments.

**What reality's answer was, because it decided this and is worth keeping.** Reality does not have
the problem. **There are no rigid bodies:** push one end of a steel bar and the far end does not
know yet — the push is a compression wave at the speed of sound, about 5,900 m/s in steel, four to
five orders of magnitude under light. A truly rigid body would signal faster than light, so
relativity *excludes* it rather than merely discouraging it (Born rigidity; the Herglotz–Noether
theorem leaves such a body three degrees of freedom of motion instead of six). **And nothing
computes a body's total mass:** each atom answers to its own neighbours, and `F = Ma` for the whole
object is a *theorem* out of Newton's third law rather than an algorithm anything runs. There is
not even a fact about which atoms are in the body. So `|p| / K` is law 1 describing an **outcome**,
and the drag read the description as the recipe.

**The local mechanism reality points at was then built and rejected by its own measurement** —
momentum spreading bond by bond, which is `rejected/push-along-bond.txt`. It is internal friction
rather than propulsion: every transfer is inelastic, so a cluster is damped by its own wave, and a
bonded pair travelled **56 hexagons instead of 115**. See item 25.

**One thing from this is worth carrying past the item.** Reality's answer also argues against rule
9's *existing* exception. Gravity is local in reality — field equations, not action at a distance —
and Newton's instantaneous force is the approximation we inherited. Law 3 already has a local
candidate written down, `∇²φ − m²φ = ρ` relaxed by neighbour-averaging, which rule 9 itself notes
would leave nothing non-local at all. **Reality's answer to "how many exceptions" is zero, not
one.**

*(The original raising is kept below, because the argument in it is what produced the answer.)*
~~Rule 9 is three words and an instruction:~~ *"Locality is
absolute. Nothing reads past a site's immediate neighbors"*, the gravity pyramid is the one
exception, and **"if you need a second one, something is wrong with the design — raise it rather
than adding it."* This is the raising. The violation is in the engine in the meantime, because the
alternative was discarding the measurement in item 25.

**What reads too far.** `clusterOf` and `clusterTotalKind` walk the connected component over
bonds, so two things now depend on hexagons up to 29 sites away: the drag, which needs to know
who moves, and `motionRateAt`, which needs the group's total kind for law 1's `|p| / K`. The
second is the worse offender, because it runs on every rate computation rather than only on a
drag.

**The case for allowing it.** The walk only ever follows bonds, so it reads matter this hexagon
is physically attached to rather than anywhere in the world — a cluster is arguably one object
with one velocity, and asking what it weighs is not the same kind of reach as the gravity
pyramid's. It is also cheap: clusters measured 29 at the largest and 2 to 4 typically.

**The case against, which is stronger.** Law 1's actual words are *"once momentum has **spread**
across a bonded group of total kind K, the group steps at `|p| / K`"* — that describes momentum
diffusing along bonds, which is local, with `|p| / K` as the *outcome*. Reading a description of
an outcome as an algorithm is what cost the locality, and it cost the light cone in the same
stroke: a rigid translation moves information across n hexagons in one event where the speed of
sound says n ticks. **Both symptoms have one fix** — momentum spreading bond by bond, so the
cluster moves over several events and nothing reads past a neighbour. `shareMomentum` already
does the local transfer it would be built from. That is a wave rather than a drag, and it is real
work rather than a line.

~~*Decided by:* Ric, between three options.~~ **Decided: the second and the third at once.** The
wave was built, and the reading that keeps locality was kept — and the third option's stated cost,
"gives up clusters that move at all", **turned out not to be a cost, because it was not true.**
Clusters move under it. Nothing had counted them. That is item 25's first correction and it is the
most expensive mistake of the two days.

**33. Does law 1's `|p| / K` inertia emerge, now that nothing computes `K`?** *(Raised 2026-11-06,
when the cluster walk came out.)* Law 1 says a heavy composite resists being pushed, with `|p| / K`
as the rate. Nothing in the engine reads a cluster's total kind any more, so if the sentence is
right the slowness has to come from momentum having to reach all of a cluster before any of it
moves. **First evidence says it does not.** Momentum per member, measured across cluster sizes at
`T = 6`: **37.66** at size 2, **38.05** at 3–4, **39.17** at 5–8. If heavy clusters were resisting,
that should **fall**. It is flat to slightly rising, which is the wrong direction.

Read it as evidence and not a verdict: one seed, and a snapshot of *momentum* rather than a rate of
*movement*. **A real measurement needs clusters tracked through time, and the engine carries no
identity to track them by** — which is itself the finding, because rule 2 forbids storing a cluster
id, so the instrument has to re-identify clusters every sample and match them up. That is the work
this item is waiting on.

**Half of this item is now settled, and it is the half about whether the removal cost anything.**
*(Ric: "Run it. Why not?")* `|p| / K` was put back on its own, with no drag, at the shipped width —
item 25's correction 2 has the table. It is worth **+0.08 of mean `B`** (6.36 → 6.44), the drag
alone is worth 0.02 which is inside the seed noise, and the two together give 6.45. **So the
non-local read would have bought 0.08**, against the +1.10 the engine already has over blind
grabbing, and removing it cost almost nothing. It is real — 0.09 across the arms against a 0.04
seed spread — but it is small.

**What is NOT settled is whether it emerges, and the evidence still says no.** An inertia worth
+0.08 when imposed is not an inertia that appears on its own, and the momentum-per-member figures
above are flat to slightly rising where `|p| / K` predicts a fall. Two honest readings of that:
either the mechanism that should produce it is missing, or `|p| / K` is not a big enough effect in
this world to see at these cluster sizes — the largest cluster measured 29 hexagons, so the heaviest
`K` is only about 30× the lightest, and the momentum has nowhere far to spread.

*Decided by:* clusters tracked through time, which is what would turn a snapshot of momentum into a
rate of movement. **The engine carries no identity to track them by** — rule 2 forbids storing a
cluster id — so the instrument has to re-identify clusters every sample and match them across
samples. That is the work left, and it is now worth less than it looked, because the prize is 0.08.


#### Settled by running the Lab

**5. Does the Lab produce a periodic table with any depth?** Unknown. Three stable clusters and
nothing else is a plausible outcome, and would mean the pair force needs more structure.

**6. ~~Should capacity vary by kind?~~ Settled 2026-11-06 — yes, and it derives from the same
valence law 2 reads: `capacityOf(k) = clamp(k mod 8, 1, 6)`.** *(Ric: "per kind".)* `CAPACITY`
is no longer a searched constant; it is a form, in `constants.mjs`, and law 4 reads the kind.

**What came out of it unasked**, and is the argument for this form over an arbitrary one: `v = 0`
gets capacity 1 and `B(0,0) = 0`, so it is monovalent and cannot bond to its own kind at all, its
one good partner being `v = 7`. `v = 4` gets capacity 4 and `B(4,4) = 8`, so it is tetravalent
and its own best partner — the shape carbon chemistry is built on. `v = 7` gets capacity 6 but
`B(7,7) = 2`: many weak bonds, a gas-like corner. None of that was put in. Measured in
`lab-check.mjs` Check 6: all six capacities 1–6 are present across the 255 kinds, and no kind is
born inert.

**It is candidate form one and has been screened by nothing.** Law 2's form earned its place
against ten rivals in `screen.mjs` on measured spread, family count, roughness and the diagonal
maximum. This has earned nothing, and it belongs in the same harness before anyone calls it
settled. *The paragraph below is the superseded text, kept because its retraction of law 4's claim
still stands:*

~~`C` is one global number, so every kind has identical~~
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

#### Open for the whole project

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

### Roads not taken

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
