# The Laws

Every rule in this universe, with the specific reason it earned its place and what breaks
without it. **Five laws and five structural facts.**

The count matters. Every rule is a place where an answer could be smuggled in, so the list
being short is the point rather than an aesthetic. **Nothing goes on it without a reason
written here, and nothing stays on it that turns out to be a consequence of something
else.** Six candidates have already come off — see *What came off the list*, which is the
most useful section in this file.

*(This file was `THE-ELEVEN.md` until 2026-11-03, when Ric's "11 or 9 seems like a lot"
turned out to be right: three of the eleven were restatements of one principle, one was a
formula with no mechanism, and two were artifacts of a representation we deleted. Renamed
to something that doesn't encode a number that moves.)*

## How to read this file

**This file says what the laws are. It does not say how we got there.** Every correction, every
retraction, every option weighed and rejected, and the reasoning behind each open question lives in
[`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md) — split out on 2026-11-04 because this file had reached
1,593 lines, two thirds of it argument, with law 2 alone running 555 lines and its answer buried at
line 438.

So each law here is **stated**, then **justified** (*Why it is a rule*), then closed with **what
breaks without it**, and those two brackets stay put — everything else goes between them, never
before or after, because a law whose justification sits behind its own argument reads as though
nobody knows why it is there.

Where a law is still undecided, it says so in a line or two and points at the record. `README.md`
holds the register of every open question in one place, with what would decide each.

### Contents

**The five laws** — [1. Conservation](#1-conservation) · [2. Bonding](#2-bonding-the-pair-force) ·
[3. Gravity](#3-gravity) · [4. Capacity](#4-capacity) · [5. Transport](#5-transport)

**And then** — [The five structural facts](#the-five-structural-facts) ·
[Does our own universe have these?](#does-our-own-universe-have-these) ·
[Why gravity is held out of Run A](#why-gravity-is-held-out-of-run-a)

---

## 1. Conservation

Matter — the **sum of all primitive kinds** — plus energy and momentum are never created or
destroyed. All three are integers.

**Momentum is an integer vector, and speed is derived from it: `v = p / k`.** Momentum is held
in cube coordinates on the hex lattice's three axes — two independent signed components, each in
±15 — and it is *not* the same thing as where the primitive goes next. That separation is the whole
point. Settled 2026-11-04 after measurement; it was "one unit in a direction, regardless of kind"
until then, which is option (A) in `HOW-WE-DECIDED.md`.

*(Said ±3 until 2026-11-05 — **in the headline statement of the law**, while the paragraph below
had already been updated to ±15 when the word went to eight bytes on 2026-11-04. The same drift was
in `README.md`'s five-law table and in `AGENTS.md` rule 5, and all three are corrected on the same
pass. Worth recording rather than fixing quietly: the eight-byte change went in piecemeal, and the
places it missed were the short authoritative statements rather than the long arguments — which are
exactly the lines someone implementing from these documents would read.)*

**Speed is a rate, not a distance.** A primitive steps **one hexagon every `k / |p|` ticks**, never
more than one per tick. So nothing outruns the causal limit by construction, heavy matter is slow
rather than frozen, and the lattice gets a real spread of speeds: **255 distinct ones**, from every
tick down to one step in 255. Mass alone gives a 38-fold spread — kinds 1–16 step about every third
tick, kinds 240–255 about every hundredth. **That is inertia**, and it needs no kinetic energy to
work. Measured in `momentum.mjs`.

*(One thing to know about that number, measured in `budget.mjs` on 2026-11-04: **the count of
distinct speeds is exactly the count of kinds**, and no momentum width changes it. There is always
a momentum of magnitude 1, so every kind `k` yields a step period of `k` ticks, and a wider
momentum field only adds finer values that round onto periods already present — ±1, ±3, ±7 and ±15
all give 255. So "255 distinct speeds" is a restatement of "255 kinds" rather than an independent
feature, and **momentum width is purely headroom for forces, never speed variety.** That is why the
momentum-range paragraph below has to keep those two apart.)*

**Collisions conserve momentum exactly, and the outcome is drawn rather than computed.** Any
redistribution with the same vector sum is legal; there are about 15 of them for a typical pair, so
one is chosen at random. Resolve them in **Margolus blocks** rather than pairs — partition the
lattice, update each block by a permutation of its own states, offset the partition each step — so
conservation holds by construction instead of by algebra.

**Rounding is now harmless, and that is the gain.** A momentum vector does not line up with one of
six hexagon directions, so stepping has to pick the nearest. Under option (A) that rounding *was*
the momentum, so it could not be done without breaking conservation. Here the vector is stored
untouched and the rounding only chooses a path, so nothing conserved is ever rounded.

**Motion carries kinetic energy, as a whole number, with one scale constant.** *(Adopted
2026-11-04. It was an open question until then, and briefly before that it was wrongly called a
measured impossibility — that retraction stands in `HOW-WE-DECIDED.md`.)*

*(The scale constant is **`S`**, and it was `C` until 2026-11-05 — which collided with law 4's
capacity, also `C`, and adopted the same day. Both are physics constants, so `AGENTS.md` rule 8
puts them in the same module, where one name cannot mean two things: capacity runs 0 to 6 and is a
count of bonds, this runs 2 to 291 and is a scale factor. This is the second rename in two days
caused by the same shortage of letters — capacity itself was `k` until 2026-11-04 — and law 4 keeps
`C`, since it is the law actually named Capacity.)*

> **`KE(p, k) = floor(S · Q(p) / 2k)`**, where **`Q(p) = x² + y² + z²`** is the *un-halved* squared
> length of the momentum vector on the cube axes — true `|p|²` is `Q/2`, and `Q` is carried to stay
> in integers — and **`S = 64`**.
>
> A collision conserves momentum exactly and moves whatever `KE` changes by **into or out of the
> heat field**, so total energy is exact by construction.

**The energy field holds heat only, and `KE` is derived rather than stored.** A primitive's kinetic
energy is recomputed from `(p, k)` whenever it is needed, so **no field is added**, the word stays
at eight bytes, and law 1's conserved total becomes **`heat + Σ KE(p, k)`** rather than the heat
field alone. The asserted invariant gains a term; it does not gain a mechanism.

**Why the construction is safe rather than merely convenient.** `KE` is a pure function of mass and
momentum, so any path returning a primitive to its starting state returns exactly the energy it
borrowed. That is a **structural guarantee, not a statistical one** — there is no free-energy pump
available to be found. `momentum.mjs` check 9 confirms it over 22,215 closed loops, worst gain zero.

**Temperature stays `e / kind` on the heat field alone, so motion does not radiate.** A fast cold
primitive is cold. This is the one place kinetic energy was expected to touch law 5, and the answer
is that it does not: transport compares heat, never heat plus motion. Were the two to share one
number, a thing would cool itself by moving and the second law would have a hole in it.

**`S = 64` is a searched constant, not a derived one, and the window is wide.** Below **`S = 2`**
the heaviest kinds read zero kinetic energy at any momentum — the heavy-matter failure arriving
through a second door — and above **`S = 291`** a kind-1 primitive at full speed overflows the
16-bit field. Inside that window 64 is chosen for three stated reasons: it is a power of two, every
kind from 1 to 255 gets a usable amount, and it caps the largest kinetic energy at **22% of the
energy field**, so a fast light primitive coming to a dead stop can dump its motion into a hexagon
that was already warm. At `S = 291` that figure is 99.9% and the dump always overflows.

| at `S = 64` | heaviest kind's KE levels | max KE as % of the energy field |
|---|---|---|
| ±3 momentum, 11-bit energy *(until 2026-11-04)* | 2 | 28% |
| **±15 momentum, 16-bit energy** *(now)* | **56** | **22%** |

So the eight-byte word bought the heaviest kind **28 times** the kinetic-energy resolution and
dropped the window's floor from 29 to 2, as a side effect nobody was tracking when it was decided.
The window itself is only about **1.5× wider** in absolute terms — 198 values against 289 — so the
gain is resolution and low-end freedom, not room to manoeuvre.

**What it buys is fracture.** Without kinetic energy a collision changes momenta and produces no
heat, so nothing about how hard a strike was can ever reach a bond: structures melt but never
break, and there is no erosion and no mechanical weathering anywhere. With it, **shearing needs no
new rule** — see *Shearing is automatic* below. That dependency is why this was adopted rather than
left open: it was blocking a question already settled.

**What it does not buy is heat that grows without bound with well depth.** Gravity adds momentum as
a primitive falls and `KE` rises with `Q`, but momentum saturates at ±15, so past that a deeper
well releases no more heat than one merely deep enough to saturate. The ceiling is higher than
chemistry's and it is still a ceiling. Law 3's prose should promise heat that **tracks** the fall,
not heat that scales with it.

**And the reason there are no orbits is geometry, not energy.** Gravity does supply the trade an
orbit needs, with no stored potential required: falling in adds momentum so a primitive speeds up,
climbing out subtracts so it slows. What defeats it is that a primitive travels in **one of six
directions, one whole hexagon at a time**, so its path cannot curve smoothly and each lap leaks a
little from the rounding. Tested at the mathematically correct orbit speed, at radii of 20, 100 and
500 hexagons and at two momentum ranges: **nothing completed two laps.** This belongs with "2D is
topologically poor" rather than with anything about energy, and it costs law 3 nothing — gravity's
job is to pull matter together and make heat from the falling, and falling in is the point.

**That diagnosis is now provisional, and the test that would settle it has not been run.** An orbit
runs on momentum *changing* as a primitive rises and falls, and at ±3 there are three integers of
room before the clamp below stops the change entirely — so the velocity budget an orbit needs
**cannot be represented**, whatever the path does. Direction quantization and momentum clipping
were both present in every run and nothing separated them, so the runs cannot tell us which one
defeated the orbits. The diagnostic is cheap: **rerun at ±7, breaking the four-byte budget for that
test only.** If laps appear, the cause is the field width and not the dimension, and a conclusion
filed as a settled fact about 2D has to come back off the list. Logged in `README.md`.

**The momentum range is ±15, and it used to be ±3 because of the field widths.** At four bytes two
components at ±7 already made the hexagon 33 bits and would not fit; the honest reading of that was
"±3 gives all 255 speeds, so **no speed is lost — but headroom is**", and running those two
together is what made the orbit result above look settled. **Settled 2026-11-04 by going to eight
bytes**, where momentum gets 10 bits and the trade disappears — see `README.md` item 15 for why the
four-byte word had to go, and note that momentum width was never about speed at all: the count of
distinct speeds is exactly the count of kinds, at every width.

**What happens when a force pushes on momentum already at ±3: the pair transfers as much as both
sides can take, and no more.** Gravity adds to momentum (law 3), applied once per pair, equal and
opposite. If one side has room for 2 and the other for 1, the transfer is 1. Clipping one side
without the other would leak momentum every step, asymmetrically, and an asymmetric leak looks like
a preferred direction in the physics — the same failure mode as the pyramid approximation law 3
rules out. So the clamp is **symmetric or it does not happen**, and law 1 stays exact by
construction rather than by assertion.

The honest consequence is that **gravity has a terminal velocity and it arrives in about three
steps.** A primitive deep in a well and one at the rim move at the same speed. That is fine for
gravity's actual job — gather matter, make heat from the falling — and it is not fine for anything
needing a velocity *budget*, which is the orbit case above.

**The edges are counted, not sealed.** Energy leaves at the boundary, and the hard floor and
ceiling are a **momentum reservoir** — a primitive that hits the floor either bounces or stops, and
either way the world's total changes. So the asserted invariants are
`world energy + radiated-away − thermostat net = constant` and
`world momentum + wall momentum = constant`, never the bare totals. Reality does exactly this and
calls the reservoir the Earth.

**Still undecided here**, with the argument in `HOW-WE-DECIDED.md`: whether the wall bounces or
absorbs. *(Three items came off this list on 2026-11-04: the option A/B fork is decided, "motion
carries no energy" turned out to be forced rather than open — and kinetic energy was then adopted
at `S = 64`, stated above — and bonded momentum is settled just below.)*

### What momentum does when primitives are bonded

**Momentum is shared along bonds — a bonded pair exchanges integer momentum toward equalizing
their velocities, equal and opposite, one hop per clock fire.** Nothing else is added.

*(Settled 2026-11-04. An audit found nothing on this in any of the five documents, and it could not
be deferred because Run A has both bonds and motion. Two options were on the table: bonds enforce
joint motion, or bonds do not constrain motion at all. Neither is the answer, and the answer turned
out to be **forced rather than chosen.**)*

**Joint motion is illegal, and that is what decides it.** Flipping every direction in a 50-hexagon
cluster at once is information crossing 50 hexagons in a single tick, which breaks the causal limit
the locality fact asserts — the light cone, the most valuable thing this project gets for nothing.
Perfect rigidity is an infinite speed of sound, and reality forbids it for exactly the same reason.
So joint motion was never the appealing option that shouldn't be assumed; it is the option that
cannot be built without giving up the light cone.

**What falls out instead: clusters are elastic, not rigid.** A strike at one end travels through a
cluster as a wave at no more than one hexagon per tick, so a cluster has a **speed of sound** and
it is bounded by the causal limit with nothing written down to bound it. Long clusters flex. That
is better physics than rigidity rather than a compromise with it.

**Inertia then comes out proportional to total kind, not to primitive count.** Once momentum has
spread across a bonded group of total kind `K`, the group steps at `|p| / K` by law 1's own rate
rule, so a heavy composite resists being pushed — and it resists through the same quantity law 1
conserves and law 3 acts on. The earlier sketch had inertia proportional to how many primitives a
cluster holds; total kind is that idea done consistently.

**Shearing is automatic, conditional, and needs no new rule.** A collision's kinetic-energy change
goes into the heat field, and if that heat pushes either endpoint over `e ≥ B · kind` the bond
breaks and the pieces separate carrying their own momentum. A soft strike moves a cluster together;
a hard one shatters it. **Both original options are special cases of this single rule**, and which
one you get depends on binding energy and temperature — that is, on chemistry, which is where the
answer belongs.

**The dependency this creates is real: kinetic energy has to be represented.** Without it a
collision changes momenta and produces no heat, so nothing about how hard a strike was can ever
reach a bond, and bonds break only from ambient warmth — you could melt a structure but never
break one, and there would be no fracture, no erosion and no mechanical weathering anywhere.
`AGENTS.md` rule 5 has the construction and `momentum.mjs` has it measured: `floor(S · Q(p) / 2k)`,
with no free-energy pump over thousands of closed loops. **Adopted 2026-11-04 at `S = 64`**, so
this dependency is satisfied rather than outstanding — law 1 states the definition. The scale
factor was re-measured when the widths changed and the window moved from 29–227 to **2–291**. **So
this is entangled with the kinetic-energy question, not with law 2** — the old note said law 2,
inherited from a movement rule that no longer exists.

**One deviation, recorded rather than buried.** Momentum sharing runs on the hexagon's clock, so
hot clusters redistribute internally faster than cold ones and a cluster's speed of sound rises
with temperature. Real solids do the opposite, mildly. The effect is small, it adds no constant,
and it is the price of having exactly one clock in the design.

**Why it is a rule.** Scarcity is what makes anything that happens *mean* something. If
matter is free then growth costs nothing, no structure ever has to be efficient, and there
is nothing for one arrangement to be better at than another. Conservation turns growth into
theft, and theft is what makes competition real. Every prior system in `SOURCES.md` has
this law; it is the field's one piece of universal agreement.

The integers are not a detail. Floats leak — over a billion steps, rounding quietly bleeds
mass and the law breaks without ever raising an error. Integers make the guarantee exact
forever. They also keep hexagons genuinely *identical* to one another, which is what makes
"a region of the same stuff" a meaningful idea and keeps the variance layer usable as an
instrument.

### Why the sum of kinds, and not the count of primitives

The law originally said "primitives are never created or destroyed," which conflicted with
the fusion analogue. The conflict at its simplest:

> Two primitives of kind 1 are squeezed until they merge into **one** primitive of kind 2,
> releasing energy. You had 2 primitives. Now you have 1. The law said primitives are never
> destroyed, and one just was.

Conserve the right quantity and it dissolves. Two kind-1s sum to 2; one kind-2 sums to 2.
Nothing was lost — **the bookkeeping unit was wrong.** Fusion: 1 + 1 → 2. Splitting: 4 → 2
+ 2. Ordinary bonding doesn't merge anything at all.

This is what our universe does. It is **baryon number**: a proton is 1, a helium nucleus is
4, and fusion conserves baryon number while emphatically not conserving particle count.

**And the fix was worth more than the bug.** Before it, a primitive's kind was an arbitrary
identity tag that meant nothing on its own. Now the kind is **how much stuff the primitive
is made of** — a mass. So law 3 is provably consistent with law 1, because the thing gravity
acts on and the thing being conserved are the same number. And a fixed matter budget buys **fewer
heavy primitives than light ones**, which is arithmetic rather than a mechanism: the sum of kinds
is conserved, so one kind-255 primitive costs exactly what 255 kind-1s would.

*(Two sentences came off here on 2026-11-04, after Ric asked whether the hole they implied was
real. They said heavy primitives are rare because "making one requires merging", and that the
periodic table gets a reason to be structured — "light kinds common and everywhere, heavy kinds
only where matter got crushed hard enough to make them. Which is our universe." **Nothing here
makes a primitive.** No law changes a kind, and fusion is in `README.md`'s roads-not-taken, so
**kind is immutable**: the distribution of kinds at the end of a run is the one seeded at the
start. That prose described the fusion road as though it had been built. What survives is the
rarity-by-arithmetic point above, and it is a weaker claim — heavy primitives are *expensive*,
which is not the same as something producing them.)*

**And that is where this physics stops asking why, which was already written down.** *What reality
has that this doesn't* states it outright: we **assume primitives exist rather than deriving
them.** A seeded distribution of kinds is that assumption made concrete rather than a gap in it.
What the project asks to emerge is the **cluster** chemistry — which kinds combine, which are
inert, which are promiscuous — not the inventory of primitives those clusters are built from.

**What breaks without it.** Matter accumulates until the world is full and nothing can move,
or drains until it's empty. Both are death, and both arrive slowly enough that you'd spend a
long time blaming something else.

## 2. Bonding (the pair force)

Two adjacent primitives may bond, with a **binding energy over their two kinds**:

> **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, where **`v(k) = k mod 8`**
>
> A bond **forms** with a fixed probability when the clock fires — never instantly on contact.
> A bond **breaks** when `e ≥ B · kind` at either endpoint, which is temperature exceeding `B`.
> `B = 0` means the pair cannot bond at all.

`v` is a **valence** — which of eight columns a kind sits in. A bond is strongest when the two
valences are **complementary**, meaning they sum to 8, and weakens by one for every step away from
that. So `v=1` pairs best with `v=7`, `v=2` with `v=6`, and `v=4` with itself. Fusion moves a kind
one column at a time, because adding 1 to a kind adds 1 to its valence.

No distance term, no force magnitude, no range: exclusion already supplies hard-core repulsion and
gravity already supplies long-range gathering, so the only job left is which pairs bond and how
strongly. **And no temperature term either** — the clock carries that, for every law at once.
*(Until 2026-11-04 this said formation happens "at a rate that falls as local temperature rises,"
which was backwards: in real chemistry heating speeds formation up. It is the breaking condition
that decides what survives. See `HOW-WE-DECIDED.md`.)* *(The original wording was "attraction or repulsion as a function of their two kinds and
their separation, short range" — a force. It was replaced over 2026-11-03 and -04; the whole
argument, and every wrong turn in it, is below.)*

**This is the version to build first, not a proof it is right.** The modulus of 8 is a **searched
constant**, and the slate of alternatives stays available if Run A comes back flat. What is
*settled* is the shape of the law: a rate-based binding energy over two integers, with no distance
in it.

*(Corrected 2026-11-05. This said "the cap of 8 is forced by the field widths," which was true at
eleven bits of energy and stopped being true on 2026-11-04. At 16 bits the forced cap on `B` is
**257**, so the 8 is chosen rather than derived — `README.md` item 17 retracts the one attempt to
improve on it and says why the choice stands anyway. Leaving it as "forced" is the exact error that
item 17 and `AGENTS.md` rule 12's fourth lesson are both about — a searched constant wearing a
derivation's clothes — which is why this is a note rather than a silent fix.)*

*(Until 2026-11-04 this law was `B = min(gcd(k₁, k₂), 8)`. **That is retracted on two measured
grounds**, both added to `screen.mjs` the same day, and both invisible to the screen as it stood
because both are about the **shape** of the table rather than its spread.*

*First, `gcd` is too rough to climb. Its **roughness is 0.916** — change a kind by one unit and its
binding energies move by 92% of their own mean — because fusion grows kinds by **addition** while
`gcd` reads **multiplicative** structure, and those two interact chaotically. Mass 60 is a
super-bonder, mass 61 is near-inert, and all 48 near-inert kinds are the large primes, which are
chemically identical to one another. Nothing accumulates on a landscape that rough, because a
structure cannot improve by a small step if every small step re-rolls its chemistry. The
complementary form measures **0.259** — three and a half times smoother — and the like-with-like
control measures 0.254, confirming the metric is reading shape and not noise.*

*Second, and worse: **`gcd(k, k) = k` is always the maximum, so under `gcd` every kind's single
best partner is itself — 100% of them, measured.** A pocket lined with kinds whose best partner is
themselves grips copies of its own lining, which is crystal growth: it templates **sameness**, and
sameness carries no information, so there is nothing for accumulation to accumulate. Under the
complementary form **75%** of kinds bond best with something other than themselves. This is the
same fault the log already half-caught as "unbreakable heavy self-bonds" — that was the thermal
symptom; the diagonal maximum is the cause. See `HOW-WE-DECIDED.md`.)*

> **If you only need the law, you have it — stop here and go to law 3.**
>
> Everything below is **how it was arrived at**, in the order it happened, and it is by far the
> longest section in this file because this law was the hardest. It contains **four retractions**,
> each kept beside its fix: that the momentum constraint on the movement rule mattered (it was an
> artifact of writing law 2 as a force), that the simplification deleted catalysis (it deleted the
> old *argument* for catalysis, not the capability), that no pure pair function could ever have
> a selective catalyst (wrong — selectivity comes from a cluster's shape), and that
> `min(gcd(k₁, k₂), 8)` was the form to build (retracted hours after it was settled, on two
> measurements about the table's *shape* that the screen could not see). Read it if you are about
> to change law 2 or re-propose something; skip it otherwise.
>
> *(Said **three** until 2026-11-05 and omitted the `gcd` one, which `HOW-WE-DECIDED.md` numbers as
> the fourth in this law.)*

**Any replacement form must still be short.** The constraint that outlives whatever happens to `B`
is **description length**: the law comes from a small fixed grammar of integer operations — sum,
difference, parity, gcd, divisibility, remainder — and never a table of cases, because the test is that *the
law's description is shorter than the table it produces.* A law short enough to write on one line
cannot contain a periodic table; there is not room in it. Short does not mean weak — Rule 110 is a
few bits and is Turing-complete. Shortness limits what can have been written **in**, not what can
come **out**.

**Why it is a rule.** It is the entire source of differentiation. Without it all matter is
identical and nothing can combine into anything in particular — "kinds" would be nominal, a
number carried around that never affects anything.

This law plus law 4 is the whole of chemistry, and between them they are why there is a
periodic table to *discover* rather than one to write. **Law 2 does the differentiating and law 4
does the saturating** — crediting law 4 with differentiation was wrong, and is corrected there.

**What breaks without it.** A featureless gas. Gravity compresses it, compression heats it,
transport cools it, and that is the entire history of the world.

## 3. Gravity

All matter attracts all matter, falling off as 1/r², never cancelling. Acts on the sum of
kinds and is indifferent to how that sum is distributed among primitives.

**What it does to matter: it adds to momentum.** That is all a force is — `F = dp/dt` — and since
law 1 now stores momentum as a vector, gravity's pull is simply added to it, strength and all. No
separate rule is needed and none exists. *(Until 2026-11-04 these documents referred four times to
"the deflection rule", a rule that was never defined anywhere. It was a placeholder invented
because option (A) stored momentum as a direction and so had no way to express a strength: a pull
could only turn a primitive, and twice the gravity would have done exactly the same thing as half.
Choosing option (B) deleted the need for it rather than defining it. See `HOW-WE-DECIDED.md`.)*

**The only non-local law and the only remaining formula in the project.** Both are real
costs and this is the one place they are earned — and both now have a candidate that removes them;
see *Gravity can be made local* below.

**Why it is a rule.** Because it is where the energy comes from, which is subtler than it
sounds.

Without gravity you must *hand* the world energy at the start, or pump it in at a boundary
forever. Both are arbitrary decisions by the designer, and both amount to choosing where in
the world life is permitted to live. With gravity the budget comes from the **arrangement**
of matter: spread-out matter holds gravitational potential, collapse converts it to heat,
and the gradient appears by itself with no boundary condition anywhere — hot where
compressed, cool at the edges.

So the only initial condition **for energy** becomes **matter, spread out.** That is barely a
decision at all, and it is the whole reason this law is worth its cost.

*(The two-word qualifier was added 2026-11-04. The **composition** of that matter — which kinds, in
what proportion — is a second initial condition, because kind is immutable and nothing here makes
one; see `README.md` item 18. Gravity makes the **energy** budget emergent, which is the entire
thing it was bought for and is untouched by this. It was never claiming to make the matter
inventory emergent, and the sentence read as though it were.)*

It also drains on its own. Once everything has fallen together there is no potential left to
convert and the world cools, so the world's arc is a consequence rather than a schedule.

And gravity is the only force that never cancels, which makes it the only one that can build
structure at scale. Electromagnetism is ~10³⁶ times stronger but comes in two signs, so bulk
matter neutralizes and it vanishes at distance. Gravity has one sign. It only ever adds.

**Two constraints on how it is implemented**, both from corrections recorded in
`HOW-WE-DECIDED.md`:

- **Gravity must never touch chemistry.** In reality gravity has no effect on bonding whatsoever;
  it reaches chemistry only through temperature. So gravity between two *adjacent* primitives must
  be negligible against the weakest pair force — orders of magnitude, not a factor of two. Violate
  the ordering and which reactions run starts depending on where in the world you are. It is also a
  free filter: any constant set that breaks it is dead before it runs.
- **The solver computes each interaction once and applies it to both sides.** A pyramid
  approximation does not give exactly equal and opposite pair forces, so it leaks momentum every
  step and the world drifts — which looks like a preferred direction in the physics.

### Gravity can be made local, and the old answer was reading the wrong formulation

*(Settled as a candidate 2026-11-04. This replaces "still undecided: whether gravity can ever be
made local. Both candidate routes fail." Both of those routes tried to approximate the **sum**.)*

Gravity as a **sum over pairs** is non-local and always will be. Gravity as a **field** is not:
`∇²φ = ρ` is a local equation, relaxed by repeated neighbour-averaging — a few Jacobi or multigrid
passes per tick — with the force read off as the gradient of `φ` between neighbours. That is O(N)
per pass, shader-shaped, and it is how reality does it; Poisson's equation is local, and the
non-locality in Newton's version is an artifact of having solved it.

The catch is that relaxing `∇²φ = ρ` on a 2D lattice gives the dimension's own falloff, **1/r**,
which is the single global collapse this project rejected. So take the **screened** equation:

> **`∇²φ − m²φ = ρ`**

Still one local equation, still relaxed the same way, and its potential decays like `e^(−mr)` —
**faster** than 1/r², and therefore *better* at the "create elsewhere" job that 1/r² was chosen for
in the first place. The screening length `m⁻¹` becomes a constant that sets **how large an
independent region is**, which is the knob this project wants most and currently has no direct
control over.

Departing from Newtonian geometry is already licensed here — 1/r² in a 2D world is itself a
departure, made for exactly this reason — so this goes the same direction, for the same stated
purpose, and buys locality with it. Two costs, both real: **one extra field per hexagon**, which
does not fit in the four bytes and so lives in a second array, and the fact that this would make
gravity no longer the single documented exception to neighbours-only, but **no exception at all**.

**It is a candidate, not a measurement.** Whether a screened field clusters matter the way the
1/r² sum does is a Run A comparison, logged in `README.md`.

### Why 1/r² and not the 1/r that 2D actually gives

In *d* dimensions gravity falls off as 1/r^(d-1), and the reason is flux geometry rather
than convention: total flux from a mass is fixed, and what you feel is its density — flux
divided by the area it has spread over. In 3D that's a sphere's 4πr², giving 1/r². In 2D
it's a circle's circumference 2πr, giving **1/r**. In 1D it's two points and gravity
wouldn't fall off at all.

The difference is not small. At distance 10, 1/r is ten times stronger than 1/r²; at 100, a
hundred times. Worse, the 2D potential goes as **ln(r)**, which grows without bound, where
the 3D potential decays to nothing. In a large 2D world with roughly even matter every
particle therefore feels a meaningful pull from *everything*.

**We use 1/r² anyway, and the reason isn't accuracy — it's that 1/r fights the
neighbors-only structural fact.**

Locality exists to create *elsewhere*: independent regions, parallel experiments, somewhere a
rare thing can persist while the rest of the world does something else. With 1/r and a
logarithmic potential, everything pulls meaningfully on everything, and the likely outcome is
a **single collapse** — one clump, one set of conditions, one experiment. That guts the thing
this project depends on most for diversity. With 1/r² you get **many local collapses**, which
is many independent regions, which is the point.

The justification for departing from the geometry is that this world is conceptually a
**slice** rather than a true two-dimensional cosmos — already baked in, since it has a real
up and down, a ground, and things that settle, none of which a genuine 2D universe has.

**The exponent is constant #2 in the search space** and was missing from the original list.
Strength and falloff do different jobs: strength sets how *fast* collapse happens, the
exponent sets whether collapse is *local or global*. The exponent is the more consequential.

### Why the force exists at all

It doesn't have an answer, and that is worth stating rather than leaving implied.

In our universe gravity is a brute fact at the floor of physics. Newton gave the formula in
1687 and said outright that he had not discovered its cause and would not invent one.
Einstein did better in 1915 — gravity is not a force but the curvature of spacetime, and
things moving straight through bent spacetime look like they are attracting. But *why* mass
bends spacetime is unknown, why there is spacetime is unknown, and reconciling gravity with
quantum mechanics has been the largest open problem in physics for a century.

Every physics has a floor and gravity is at this one's. The difference is that **ours exists
for a stated reason.** We can't say why it's there in any deeper sense, but we can say
exactly what it's *for*. That is more than our own universe offers about itself.

**What breaks without it.** A world with imposed energy and no large-scale structure, and no
*down*, which makes layering and sedimentation meaningless. You would be designing the
gradient instead of discovering it.

## 4. Capacity

A primitive can be bonded to at most **`C`** of its six neighbors.

*(Called *k* until 2026-11-04, which collided with `k` for kind in laws 1 and 5 — `v = p/k` and
`T = e/k` are both about mass, and `e ≥ B · k` in law 2 is too. Renamed before someone implemented
the wrong one. **Then `C` collided too**, with the kinetic-energy scale constant adopted in law 1
hours later: for a day `C` meant both "at most this many bonds" (0 to 6) and "multiply `Q/2k` by
this" (64). Resolved 2026-11-05 by renaming **law 1's** scale to `S` and leaving capacity alone,
because this is the law called Capacity. Two collisions in two days on one letter is what `AGENTS.md`
rule 8 is for: the constants share a module, so they cannot share a name.)*

**Why it is a rule.** This is the load-bearing one, and the least obvious.

Capacity is the exclusion principle, and it is what makes **"how many can still fit"** a
meaningful question. That question is the sole origin of distinct types with distinct
behavior: a saturated primitive is inert, a nearly-saturated one grabs, a nearly-empty one
gives away. *That is chemistry.* All of it. Everything about how our own elements behave is
"how far is the outer shell from full," and that question only exists because things cannot
share a state.

Saturation is also what makes **structures** instead of lumps — an attraction that never
saturates collapses everything into one undifferentiated blob.

**This law is not the origin of distinct types, and saying it was is now corrected.** `C` is one
global number, so every kind has identical capacity and **all** differentiation comes from law 2.
Earlier wording said a global `C` "weakens this law's claim to be the origin of distinct types" —
it does not weaken it, it removes it. What this law actually does is the saturation job above: it
stops an attraction that never fills up from collapsing everything into one blob. That is
load-bearing, and it is a different job than the one it was credited with.

Law 2 now carries the columns, in `v(k) = k mod 8`. Whether capacity should *also* vary by kind —
`C(k)`, a second short integer function — stays open, but it is now a question about how much
structure one law should hold rather than about whether chemistry exists at all.

**What breaks without it.** No chemistry at all, ever, at any setting of any other constant.
The most catastrophic omission available on this list.

## 5. Transport

Energy hops toward any neighbor at a **lower temperature** — through matter or across empty
space — and at the world's boundary it leaves forever.

**Temperature, not energy.** Temperature is energy per unit of kind, so a heavy cold primitive can
hold more total energy than a light hot one, and comparing raw energy would move heat *uphill*. The
comparison is `e₁·k₂` against `e₂·k₁` — two integer multiplications, exact, no division, valid
because kind is at least 1 in any occupied hexagon.

**What this cost heavy kinds, which was never written down.** *(Resolved 2026-11-04 — energy is 16
bits now and the heaviest kind reaches 257. The resolution is two paragraphs down; what follows is
the record of the problem, in the past tense because none of it is true any more.)* Energy was 11
bits, so a hexagon held at most 2047, and temperature is `e/kind` — so the hottest a kind-1
primitive could get was 2047 and the hottest a kind-255 primitive could get was **8**. The cap on
`B` was *derived* from exactly this (`floor(2047/255) = 8` is what made every bond breakable by
every kind, and `screen.mjs` had printed it all along), but the consequence was never stated:
**heavy kinds had eight distinguishable temperatures, and a `B=8` bond between two of them broke
only at `e ≥ 2040` out of a possible 2047.** Heavy matter was therefore close to permanently cold
and permanently bonded. Melting, graded stability, phase behaviour and anything with a measurable
reaction rate lived among the light kinds only — which is a real cost to the conservation story in law 1, whose whole purpose
was to make heavy matter possible.

The tension was structural and had no free fix *at four bytes*. A fixed-width **total**-energy
field, a temperature of `e/kind`, and a uniform temperature range across kinds cannot all three
hold at a fixed word size; this world had the first two. Storing **temperature** instead, with `T · kind` as the conserved
quantity, would give every kind the full range and make exact integer transport between unequal
kinds the hard part instead. Named as **the heavy-matter temperature fork** in `README.md` rather
than left implied.

**Resolved 2026-11-04: the word went to eight bytes and energy to 16 bits.** The heaviest kind can
now reach temperature 257, which is **32 times** its strongest bond rather than exactly once, so
melting, boiling and graded stability have somewhere to happen at every mass. Storing temperature
instead of total energy — the obvious alternative — turned out to be dead on arithmetic: `(T, r)`
is the same information as `e` at the same width, measured at **−1 bit**. And the cap on `B` is no
longer forced at all: at 16 bits of energy the forced cap is 257, so **law 2's modulus of 8 became a
choice the same day it stopped being an artifact.** Wider is measurably better — see `README.md`. An empty hexagon has no kind, so it is absolute
zero — the gradient into empty space is permanently maximal, which is why **nothing here needs a
T⁴ curve**: emission is one unit per clock fire, so radiated power is linear in temperature. That is
a real deviation from our own universe, where it goes as T⁴, and it is sound only because the second
law needs a *monotonic* emission rate and not that specific exponent. Stated as a deviation in
`HOW-WE-DECIDED.md` rather than claimed as a simplification.

**The books are kept at the edges.** Two counters are mandatory: **radiated-away**, every unit that
crossed the boundary outward, and **thermostat net**, every unit Run A's held gradient injected or
removed. Run A gets the strict equality. **Run B gets a weaker invariant**, because gravitational
potential is not stored anywhere, so collapse genuinely appears to create thermal energy from
nothing — assert instead that energy rises only through collapse and falls only through the
boundary, both logged.

**Across empty space it is radiation, and that is a structural fact rather than part of this law.**
The comparison above governs matter touching matter. Vacuum has no kind, so the comparison is
undefined there — it reads `0` against `0` — and the sink was unreachable until 2026-11-04. The fix
is not in this law: energy entering an empty hexagon becomes **a quantum in flight**, which travels
in a straight line until matter absorbs it or the boundary takes it. See *Radiation crosses vacuum
in a straight line* among the structural facts. Emission itself needs no new rule — it is this law,
with vacuum asserted to be colder than anything.

**One constraint this law now places on the clock.** Net radiative flow is downhill only because
hotter matter acts more often, and that fails the moment the clock rate saturates. The clock
constant times the hottest reachable temperature must stay **below 1**. Above it, radiative flow is
not merely slow — its direction becomes a coin flip. Measured in `radiate.mjs`; the numbers are in
`HOW-WE-DECIDED.md`.

**Why it is a rule.** Two jobs, and it used to be two laws.

Energy has to be a *local* quantity or nothing can be hot or cold *somewhere*, and a gradient
is meaningless. Movement toward less then couples regions thermally, so what happens here
reaches there; without it the world is a grid of sealed boxes.

And the clause about empty space is the **sink**, which is the most easily overlooked
requirement in the whole design. Thinking about a world's energy naturally means thinking
about where it comes *from*. But matter is conserved and bounded, so if energy could only
move through matter it would have nowhere to go. It accumulates. The world heats toward
uniform death and stays there forever. A gradient needs two ends, and this is the far one.

Note that this law is the single deliberate exception to "nothing is destroyed." It isn't
really destruction — it's loss to the outside — but it is the one place the books don't
balance inside the world, and it is load-bearing.

**What breaks without it.** Without the local-and-conducting half: temperature doesn't exist,
so phase doesn't, so melting and freezing and decay don't, and reaction rates have nothing to
depend on. **Every item on the README's "never written" list requires it.** Without the
empty-space half: no gradient, therefore no dissipative structures, therefore no ladder,
therefore nothing. The project fails at rung zero.

## The five structural facts

Not laws — true of how the world is built. But break any one and the world is as ruined as if
a law had been dropped, which is why they are documented here with the rest. *(It was four until
2026-11-04, when radiation was settled and filed here rather than as a sixth law.)*

### Hexagonal grid, one primitive per hexagon

Isotropy, for the reason in the README: a square grid has favorite directions baked in and
would hand you expanding squares and axis-locked growth, which a project whose method is
"find structure you didn't expect" cannot survive. Hex is a large improvement, not a cure —
some artifacts remain, and a fully disordered lattice is better still and much more work.

One primitive per hexagon gives exclusion and a hard occupancy limit for free, and makes
mixtures free as well: a region where neighboring hexagons have different kinds **is** a
mixture, needing no representation.

### Only neighbors interact

This creates *elsewhere*. If anything can affect anything there is one global state, one
attractor, one experiment. With locality, distant regions are genuinely independent —
thousands of parallel experiments, and a rare thing can survive in one corner while the rest
of the world does something else. **Niches exist because of this and nothing else.**

It also hands you a **causal speed limit** for nothing: one hexagon per tick is the maximum rate
anything can propagate, so cause has a finite reach and there is a light cone. That is relativity's
single most important feature, acquired as a side effect.

*(Called "a speed of light" here until 2026-11-04, when Ric pointed out the limit has nothing to do
with light — it is the fastest **information** can move, and it falls straight out of locality. Real
physics agrees: `c` is the causal limit, and light merely sits at it because photons are massless.
The same thing happened here by accident — radiation was added a day earlier and travels at exactly
one hexagon per tick, never slower, so this world now has something light-like riding its limit.
The limit came first and does not depend on it.)* And it is why the
thing can run at all — local rules are parallel, cache-friendly and shader-shaped.

**Gravity is the only exception in the entire codebase.** A second one means something is
wrong with the design.

### Each hexagon keeps its own time

There is no global synchronized "now," and that half is real physics: relativity is
unambiguous that simultaneity is relative, so "everything updates at once" is *provably* not
how anything works, because there is no "at once" to update at.

Two independent reasons it matters here:

**It stops the clock from lying to you.** Synchronous updating *manufactures* apparent
self-organization — cyclic patterns in particular are inherent to a global clock, an artifact
of scheduling rather than a property of the physics. For a project whose method is finding
unexpected structure, being fooled by your own update loop is fatal: you'd find something
beautiful, believe it, and be wrong.

**It independently reduces lattice anisotropy.** The CA literature lists replacing synchronous
with asynchronous dynamics as a standard remedy for grid artifacts, alongside changing the
grid. So this and the hex grid attack the same problem from two directions.

#### Event-driven in Run A, probabilistic in Run B

The original wording was "each cell updates with some probability per tick," and Ric's
objection to it was correct: **time doesn't skip.** Nothing in reality sits frozen while its
neighbor acts. Real time is continuous and local; every point has its own proper time flowing
without interruption.

The right framing is that a hexagon is not skipping time — **its clock is running at a
different rate.** One at probability 0.5 is not frozen half the time; over many ticks it is
experiencing time half as fast. That is a coherent notion of local proper time and is
genuinely *closer* to relativity than synchronous updating, where one universal clock is
asserted — the thing relativity forbids.

**Both schemes are stochastic. They differ only in whether time is ticked.**

*(Corrected after external review.)* An earlier version of this file said Run A
was "continuous, not probabilistic," which conflated two independent axes: discrete-versus-
continuous *time*, and deterministic-versus-stochastic *event selection*. Gillespie's
algorithm is the standard counterexample — event-driven, continuous-time, and thoroughly
stochastic. Run A draws event times from distributions; it is probabilistic throughout. What
it does not do is round those times onto a global tick.

**Run A uses event-driven continuous time**, where nothing ever skips at all. It is the
natural fit rather than a forced one, because the lattice is already fully discrete: every
change in this world is already an event. At 65,000 hexagons a priority queue is comfortably
affordable and the GPU isn't needed. And Run A's whole purpose is *measurement* — a known-wrong
time model inside the instrument is worse than one in the world, because every number in the
resulting table would carry the artifact.

**Run B does not.** At seventeen million hexagons in a browser, queue churn and the loss of
cache locality and parallelism cost more like 50–100× than 5–10×, and it destroys the
shader-shaped structure that lets this run in a browser at all.

**The approximation gets checked rather than assumed.** Run the same small configuration under
both schemes and compare the species, binding energies and rates. Agreement validates Run B's
compromise empirically; divergence is a finding about where it fails. A concrete task, not a
hope — and the only place in the project where the same physics is implemented twice.

#### What sets the rate: temperature

*(Decided 2026-11-04. The rate was a single global constant and nothing said what varied it.)*

**A hexagon's clock runs at a rate proportional to its own temperature**, with a floor so that cold
matter is slow rather than frozen. Hot matter therefore acts often and cold matter rarely, which is
one line of code and does four jobs:

- **It makes radiation work at all.** Sight lines on this lattice are exactly reciprocal, so under
  a flat clock every pair of hexagons exchanges energy at an identical rate and the **net flow is
  exactly zero** — radiation would transport no heat in either direction. A temperature-dependent
  rate is the only thing that unbalances it. This is why our own universe has a Stefan–Boltzmann
  law at all, and it is not a patch on radiation but the thing that makes it a channel.
- **It closes the second law exactly**, rather than statistically as reality does. Net flow between
  any two hexagons that can see each other is downhill for *any* rate that rises with temperature,
  because the sight lines between them are reciprocal and the only asymmetry left is the rate.
- **It gives reaction rates their temperature dependence for free**, so no law has to carry one.
  This is the attempt-frequency half of an Arrhenius rate; law 2's binding energy is the other half.
- **It is where thermal pressure comes from.** Hot matter moves more often, so hot regions expand
  against cold ones with nothing written down to make them.

**The hard constraint, stated correctly.** The rate must be **strictly increasing in temperature
and must never saturate.** That is all the second-law argument above uses, and it is weaker than
what this section demanded until 2026-11-04.

*(The old wording required the clock constant times the hottest reachable temperature to stay below
1. Energy was 11 bits, so that forced a constant under 1/2047 and a **2047:1 spread in clock rates** —
free in Run A, where event times are drawn anyway, and close to fatal in Run B, where the coldest
matter would update once in 2047 ticks. The cold edge is exactly where the dissipative structures
are meant to live, so that is not a performance detail.)*

The floor the rule already has is the knob:

> **`rate(T) = floor + c · T`**

This is strictly increasing for **any** floor, so net flow between two hexagons that can see each
other is still downhill and its direction never flips. Raising the floor shrinks the *asymmetry*
`(r_hot − r_cold) / (r_hot + r_cold)`, so heat moves slowly relative to how much energy sloshes
back and forth — **diffusive rather than ballistic, which is what conduction is in reality
anyway**, and slow equilibration helps structure persist rather than hurting it. A floor at
`c · T_max / 16` buys a **16:1** spread instead of 2047:1, and costs transport speed rather than
correctness.

What still switches off abruptly is **saturation, not spread.** If the rate flattens at the top,
two hexagons at different temperatures act equally often, net radiative flow goes to zero, and its
direction becomes a coin flip — measured at 10 of 20 seeds running *uphill*. The second law does
not degrade gracefully there; it switches off. Keep the rate linear and unsaturated and that cannot
happen at any floor.

**What breaks without it.** With a flat clock: radiation transports exactly nothing, so the sink is
dead even once the mechanism is right, and every reaction rate has to carry its own temperature
term. With a saturating clock: the second law is simply absent above the saturation point.

### Bond energy accounting is exact

A bond forming releases **precisely** its binding energy into the hexagon as heat. Breaking
absorbs precisely that much.

**Why it's here rather than in a comment.** This is the seam between laws 2 and 5, and the one
place conservation is actually at risk. Laws 1 and 5 are easy to satisfy in isolation; it is
the *conversion* between bonded energy and thermal energy that goes quietly wrong.

Release more than the binding energy and you have built a free-energy pump: structures form,
dump surplus heat, reform, and the world runs away. Release less and energy bleeds out of
existence every time chemistry happens, and the world dies cold on a timescale set by how
often bonds form.

The reason it earns a documented entry is the **failure mode**: both versions are slow, silent,
and look like physics. No error, no assertion, no obvious moment. You would watch a world get
steadily hotter or steadily deader and spend weeks adjusting the pair force, the capacity and
the transport rate before suspecting the seam.

Ric predicted this entry before reading it, asking whether one of the rules might "come from
how 2 others interact." That is exactly what it is, and exactly why it isn't a law.

**Why it cannot currently break, which is worth stating because it is load-bearing and invisible.**
The modulus is a global constant and `B` is **recomputed from the two kinds** every time a bond is
evaluated, never stored — the six bond bits record *which* neighbours, never *how strongly*. So `B`
is stable exactly as long as the kinds are, and **nothing in this world changes a primitive's kind.
Kind is immutable.** No law does it, and fusion — the only thing that would — is in *Roads not
taken*. A recomputed `B` therefore returns the same value forever, and this seam holds by
construction.

*(Said the other way round on 2026-11-04 and immediately retracted after Ric asked whether it was a
real hole: it is not. The claim was that a bonded primitive which fuses would break its bond at a
different `B` than it formed at. True, and unreachable, because there is no fusion. Law 1's talk of
`1 + 1 → 2` is a **bookkeeping choice** made so the fusion road stays open, not a mechanism that
exists — which is a justification being read as a specification. The real consequence is recorded
on the fusion entry in `README.md`'s roads-not-taken, where it belongs: anything that makes kind
mutable has to pay every affected bond's `B` at the pre-change kinds first.)*

### Radiation crosses vacuum in a straight line

An empty hexagon holding energy and a direction of travel **is** a quantum of radiation in flight.
It moves one hexagon per step — exactly the causal limit the locality fact already asserts, which
makes it the one thing in this world that always travels at the limit and never slower — and it
stops at the first matter it meets, which absorbs it. At the boundary it leaves forever and `radiated-away`
counts it.

**One unit of energy per quantum, and one quantum per direction per hexagon.** That is six bits,
and an empty hexagon's six bond bits are unused by definition, so it is the same four bytes. The
six bits are **exact rather than a cap**: a quantum arriving at a given hexagon travelling in a
given direction, and a fresh emission into that same slot, can only come from the one neighbour
behind it — and that neighbour is either matter or vacuum, never both. There is no third source to
collide with. Zero collisions in every run of `radiate.mjs`.

**Emission is law 5, not a new rule.** Matter sheds a unit toward a neighbour that is colder, and
vacuum is colder than anything. The direction is uniform over the six, and that is **forced, not
chosen** — the second-law argument below needs it.

**Why this is a fact and not a sixth law.** It says how energy crosses a gap, which is of a piece
with the lattice, locality and the causal limit; the force that moves it is still law 5. The
contrary case is fair and is recorded: this hands the project photons back, and the reason
radiation was merged into transport in the first place was that there were none. Call it a sixth
law if you prefer — what matters is that nothing here is hidden in a spare field.

**So a hexagon is one of three things**, and the README's "a primitive, or empty" was two:

| | kind | energy | momentum | bonds |
|---|---|---|---|---|
| **a primitive** | 1–255 | its heat | an integer vector; speed is `p/k` | who it is bonded to |
| **a quantum in flight** | 0 | — | — | one bit per direction in flight |
| **empty** | 0 | 0 | — | 0 |

**What breaks without it.** The sink is unreachable, because the transport comparison is undefined
against vacuum and energy never leaves matter. The world heats to uniform death and the ladder
never starts. And separated structures could never reach each other at all: every gap would be a
hole in the universe, and gravity would be the world's only long-range channel.

---

## Does our own universe have these?

Worth checking, since the list was reasoned out from "what would a world need" rather than
copied from physics. Audited 2026-11-03. **Four of the five laws are real laws of our
universe.**

| # | Here | In our universe |
|---|------|-----------------|
| 1 | Conservation of kinds, energy, momentum | **Matter: yes. Energy and momentum: locally yes, globally no.** Worth splitting, because lumping them invites the wrong conclusion. **Matter** is the solid one: it matches *baryon number* rather than mass (fusion converts mass to energy, which is why this law had to be restated), and no violation has ever been observed — though one must have happened very early, or there would be no matter/antimatter asymmetry and nothing here. **Energy and momentum** are exact in any local region and simply **not defined globally in an expanding universe**, because expansion removes the time-translation symmetry Noether's theorem runs on: photon energy redshifts away with no destination at all, and peculiar momentum decays as 1/a. Raised by Ric. See `SOURCES.md`. |
| 2 | Pair force by kind | **Yes** — electromagnetism. Charge-dependent, attractive or repulsive, and responsible for essentially all of chemistry. Technically long-range, but *effectively* short-range in bulk matter because charges cancel, which is what our short-range version is a shortcut to. |
| 3 | Gravity | **Yes**, though reality's is spacetime curvature rather than a force, and is 1/r² because space is 3D rather than because we chose it. |
| 4 | Capacity | **Yes, and the closest match on the list** — the Pauli exclusion principle, which does exactly the job claimed. It is why electrons occupy shells instead of collapsing into the ground state, which is why valence exists, which is why chemistry exists. |
| 5 | Transport | **Yes.** Heat conduction, and blackbody radiation for the empty-space half. Reality's emission goes as T⁴; ours gets the same steepness from geometry instead. |

### And none of that makes our law 1 wrong

It makes it **right for our world**, which is a different thing and the row above should not be
read as a confession.

Reality's global energy conservation fails for one specific reason: the universe expands, and
expansion is what destroys the time-translation symmetry Noether's theorem needs. **Our grid
does not expand.** The laws here are the same at all times, the lattice is the same everywhere,
and nothing stretches. The symmetries are intact, so the conservation laws are exactly what
Noether says you get — we are not asserting something reality denies, we are asserting what
holds in a universe that doesn't expand.

Two things follow. First, everything this project cares about is local anyway: chemistry,
structure, the ratchet, anything that could become alive. Local conservation is exact in
reality too, and has never been observed to fail. Second, **strictness is load-bearing here
regardless of what reality does**, because the assertion is the only bug detector the project
has. A world where energy can quietly appear is a world where the most exciting thing you ever
see is an accounting leak.

What *is* genuinely unknown in reality is not the mechanism — that part is a derived theorem —
but why there is expansion at all, and why it is accelerating. Dark energy is a name for the
observation, not an explanation of it.

Of the structural facts: locality is firmly real (nothing propagates faster than light;
entanglement is the apparent exception and transmits no information). No universal "now" is
real and relativistic, but discretizing it is ours, because this is a computation rather than
a world. The hexagonal lattice is entirely ours — reality has no lattice at all, which is the
single largest departure in the project.

That law 4 turns out to be a direct analogue of a fundamental law is the most reassuring result
in the audit. It went on the list because there would be no chemistry without it — which is
exactly why our universe has it too.

### What reality has that this doesn't

The **strong force**, which makes stable composite particles and therefore gives reality its
library of distinct primitives. We *assume* primitives exist rather than deriving them: that is
where this physics stops asking why. The **weak force** (identity change, slow decay).
**Fusion** as a second energy budget. **Three dimensions.** **Continuous space.** And quantum
mechanics generally — superposition, wave behavior. These primitives are classical.

### On math

A useful diagnostic rather than a rule, and Ric's point: **our universe does not do math.**
Nothing anywhere computes a gravitational formula. Equations are *our description* of what
happens; matter simply moves, and calculus was invented afterward to describe the moving.

So every time a formula gets written here, ask whether it is *describing* or *implementing*. A
formula that **is** the law is fine. A formula that **computes a result the world should have
produced** is a smuggled answer — which is what the deleted property function was, and what the
deleted T⁴ curve was.

Most of this design is token mechanics rather than equations: integer kinds, counting bonds
against capacity, a direction per primitive, collisions by swap.

But **"almost no math" was oversold**, and the honest inventory is three places:

1. **The pair force.** Still unspecified — see law 2 — but **the goal stated here has since been
   reached.** "Converting it to a pure condition on the two integers" is exactly what law 2's
   proposal does: `B(k₁, k₂)` with no distance term, one operation from a fixed grammar. That is
   still arithmetic (`mod` and absolute difference are arithmetic) but it is no longer a *formula* — there is no magnitude
   computed over a distance, only a number looked up from two integers by one operation. If the
   proposal is adopted this item shrinks to its smallest possible form rather than disappearing.
2. **Gravity.** A sum over distance, and the project's only non-local operation — though law 3
   now has a local candidate, a screened field relaxed by neighbour-averaging, which would remove
   the non-locality and the formula together and leave a constant in their place.
3. **The temperature comparison.** Two integer multiplications per transport step
   (`e₁·k₂` vs `e₂·k₁`). Exact, cheap, and unavoidable — comparing energy *per unit of kind*
   cannot be done by counting alone. Found by external review after the first version of law
   5 compared raw energy and opened a second-law hole.

Three places, named. That is the accurate answer to "is there still math in here," and it is
more than the documents previously claimed.

---

## Why gravity is held out of Run A

Run A uses four of the five laws. Gravity is deliberately absent, and this needs real
justification because it is load-bearing in the finished world.

The weak version of the argument is that it's expensive and buys little at 256². True, but not
the reason.

### Run A is a laboratory, and a laboratory controls its conditions

Run A's job is to **measure**: which clusters are stable, each one's binding energy, its
leftover capacity, how it behaves when it meets another. The output is a table of numbers Run B
will treat as fact.

A measurement is worth something only if the conditions it was taken under are known and held
still. **Gravity makes that impossible.** With gravity running, pressure and temperature at any
hexagon depend on the entire mass distribution, which is itself changing throughout the run. A
cluster's measured binding energy would be contaminated by where in the box it happened to form
and when, with no way to separate the two. Run the same experiment twice and get two different
tables.

That is not a periodic table. It is a travel diary.

Chemists work at standard temperature and pressure for precisely this reason, and so does Run A:
set a thermal gradient and hold it. Setting that gradient is legitimate here in a way it would
not be in Run B, because **Run A is not claiming to be a world.** It is an instrument, and a
thermostat in a laboratory is apparatus, not a smuggled answer.

### The supporting reasons

**Nothing to structure.** Gravity's second job is large-scale structure, and at 256² there is no
large scale. Its third is making *down* exist, which is irrelevant to which clusters are stable.

**The cost falls where it hurts most.** Gravity is the only non-local law and the most expensive
thing in the engine. Run A is where the *search* lives — thousands of short candidate universes —
so every cost there multiplies by thousands. Paying for the most expensive law for no measurement
benefit, thousands of times, is the worst possible place to spend.

**One variable at a time.** If Run A produced mud you would need to know whether the problem is
the chemistry or the cosmology. Holding gravity out isolates the chemistry completely. Ordinary
experimental method.

### What this costs, honestly

Species that only form under conditions the laboratory never sets will not appear in the table.
If the only route to some cluster runs through extreme gravitational compression, Run A will
never find it — silently.

**What that costs is the dictionary, not the world.** Since the coarse-graining was removed,
Run B runs the same primitive physics and forms whatever its primitives form, so an absent
species still *exists* there. You simply would not recognize it when you saw it. That is a
smaller cost than the one this section originally claimed, and the correction is recorded in
`TWO-RUNS.md`.

The mitigation: **Run A sweeps conditions rather than picking one.** Measure the table across a
range of temperatures and pressures, and record each species with the regime it exists in. A
cluster that only appears under high compression is then a known entry with a known condition
rather than an absence nobody notices.

`TWO-RUNS.md` covers the rest of this trade, including what the whole project would look like as a
single run.
