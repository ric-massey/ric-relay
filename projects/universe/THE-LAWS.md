# The Laws

Every rule in this universe, the reason it earned its place, and what breaks without it. **Five laws
and five structural facts.**

The count matters. Every rule is a place where an answer could be smuggled in, so a short list is
the point, not an aesthetic. **Nothing goes on it without a reason written here, and nothing stays
on it that turns out to be a consequence of something else.** Six candidates have already come off
— see *Rules that came off the list* in `HOW-WE-DECIDED.md`. *(This file was `THE-ELEVEN.md` until
2026-11-03, when Ric's "11 or 9 seems like a lot" turned out to be right.)*

## How to read this file

**This file says what the laws are, not how we got there.** Corrections, retractions, rejected
options and the argument behind each numbered item are in [`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md).
Each law is **stated**, then **justified** (*Why it is a rule*), then closed with **what breaks
without it**. Where something is undecided, it says so in a line and gives the item number in
[`README.md`](README.md), which holds the work list.

**`constants.mjs` is the engine's source of truth for every number.** If this file disagrees with
it, this file is wrong. *(The long form of this file, with every superseded paragraph beside its
replacement, is at commit `59d5d928`: `git show 59d5d928:projects/universe/THE-LAWS.md`.)*

**Contents** — [1. Conservation](#1-conservation) · [2. Bonding](#2-bonding) ·
[3. Gravity](#3-gravity) · [4. Capacity](#4-capacity) · [5. Transport](#5-transport) ·
[The five structural facts](#the-five-structural-facts) ·
[Does our own universe have these?](#does-our-own-universe-have-these) ·
[Why gravity is held out of the Lab](#why-gravity-is-held-out-of-the-lab)

---

## 1. Conservation

Matter — the **sum of all primitive kinds** — energy and momentum are never created or destroyed.
All three are integers.

**Momentum is an integer vector, and speed is derived from it.** It is held in cube coordinates on
the hex lattice's three axes, two independent signed components each in **±63**, and it is *not*
where the primitive goes next. A step rounds the vector to the nearest of the six directions; the
vector itself is never rounded, so nothing conserved is ever rounded. **A tie between two directions
is broken by a fair coin** (item 21): an integer vector lies exactly between two directions on 2–4%
of an orbit's steps, and a fixed pick is a handedness that spiralled every orbit into the centre.
**Known flaw (item 34):** rounding to the nearest direction gives matter six headings — a primitive
heading 10° off a lattice direction travels at 0° for ever — and on a tie the coin random-walks the
path off its line. A tracked position within the hexagon fixes both; it is recommended, not adopted.

**Speed is a rate, not a distance, and matter never reaches the limit.** A primitive steps at

> **`v = |p| / √(k² + |p|²)`** of the causal limit

— special relativity's speed for a body of mass `k` and momentum `p`, with the limit as `c` (Ric,
2026-11-06: *"I don't want anything of matter to reach that speed"*). For slow matter it is `|p| / k`
to within half a percent at `|p| = k/10`, so heavy matter is slow rather than frozen and that is
inertia. As momentum grows the speed approaches the limit and never arrives: `|p| = k` gives 0.71,
and the fastest thing the field allows — kind 1 at full momentum — reaches 0.99987. **Only radiation
travels at the limit.** `lab-check.mjs` Check 12 checks every kind at every legal momentum. *(Until
2026-11-06 the rule was `min(1, |p|/k)`, which let kinds 1–63 move at exactly the limit, and gave
exactly 255 distinct speeds; the relativistic rule gives many more, so speed variety now comes from
momentum as well as mass.)*

**Kinetic energy stays Newtonian, and that is a stated mismatch.** Only the speed is relativistic.
`KE` below is still `floor(S · Q / 2k)`, the low-speed form; the relativistic `√(k² + |p|²) − k` would
not be a whole number. The two agree for slow matter, which is nearly all of it.

**Collisions conserve momentum exactly, and the outcome is drawn rather than computed.** They
resolve in three-hexagon Margolus blocks; any redistribution with the same vector sum is legal, and
one is picked at random, so conservation holds by construction. In the Lab, with no step to offset
a partition on, each collision's block is one of the two triangles containing the pair, chosen by a
coin (item 24).

**Motion carries kinetic energy, as a whole number.**

> **`KE(p, k) = floor(S · Q(p) / 2k)`**, where `Q(p) = x² + y² + z²` is the un-halved squared length
> of the momentum vector on the cube axes (true `|p|²` is `Q/2`), and **`S = 4`**.

- **It is derived, never stored.** The energy field holds heat only; law 1's conserved total is
  **heat + Σ KE**.
- **It cannot be pumped.** KE is a pure function of mass and momentum, so any path back to a
  starting state returns exactly the energy it borrowed — a structural guarantee, confirmed over
  thousands of closed loops in `momentum.mjs`.
- **Temperature stays `e / kind` on heat alone,** so a fast cold primitive is cold and motion does
  not radiate.
- **`S` is chosen inside a measured window,** 1–16 at ±63: below it the heaviest kinds read zero KE,
  above it a kind-1 primitive at full speed overflows the 16-bit energy field. 4 is a power of two,
  gives every kind a usable amount (235 levels for the heaviest), and keeps the largest KE at 24% of
  the energy field so a dead stop can dump into an already-warm hexagon. *(It was 64 inside 2–291 at
  ±15; widening momentum forced it down.)*

**What it buys is fracture.** A collision's KE change goes into heat, so how hard a strike was can
reach a bond. Without it structures could melt but never break — no erosion, no weathering.

**A force pushing on momentum near the limit transfers as much as both sides can take, and no
more.** Gravity is applied once per pair, equal and opposite. Clipping one side and not the other
would leak momentum asymmetrically, which looks like a preferred direction. So the clamp is
**symmetric or it does not happen**. Past the limit a deeper well releases no more heat, so law 3's
heat *tracks* the fall rather than scaling with it without bound.

**Heat becomes motion in opposite pairs** (item 29, Ric 2026-11-06: "make them move in pairs, in
opposite directions … Add them up, you get zero"). With probability `THERMAL_KICK_PROB` per clock
fire, a site and a neighbour get equal and opposite momentum, paid for from heat. A single site
starting to move would be momentum from nowhere; a pair sums to zero in integers.

**Things orbit.** Gravity supplies the trade an orbit needs with no stored potential: falling in adds
momentum, climbing out subtracts it. With the sub-unit pull carried and ties broken by a coin,
`orbit.mjs` orbits at ±7 and wider. Orbits here are eccentric and not permanent — the closest
approach random-walks lap to lap — and at a strength law 3 allows only the heaviest kinds orbit,
only around the largest clumps. Orbits were always a bonus; gravity's job is to gather and heat.

**Edges are counted, not sealed.** The Lab is a torus with no edge, so its momentum total is exact
with nothing to count, and its only exchange with outside is the thermostat. If the World keeps a
boundary, energy leaving is `radiated-away` and a floor is a momentum reservoir counted as wall
momentum — reality does this and calls the reservoir the Earth. Whether a floor bounces or absorbs
is open only if the World has one (items 8, 22).

### What momentum does when primitives are bonded

**A bonded pair exchanges integer momentum toward equal velocities, equal and opposite, one hop per
clock fire.** The kinetic energy that equalizing destroys goes into heat (momentum is linear, KE is
quadratic), exactly as a collision's does.

**Joint motion is illegal.** Moving a 50-hexagon cluster at once is information crossing 50
hexagons in one tick, which breaks the causal limit. Perfect rigidity is an infinite speed of sound,
and reality forbids it for the same reason.

**Motion never stretches a bond: a step that would stretch one does not happen** (item 25). Clusters
still move. On a hex lattice `i` and `i + d` share two neighbours, so a bond within 60° of the
direction of travel survives the step; only bonds at 120° and 180° refuse. Shear is cheap and
compression dear, which is the right way round for matter. Measured: bonded matter steps about
15,000 times per million events, and a lone bonded pair travels about 1,050 hexagons in 200,000 events
— four laps of the Lab — whatever the angle of its bond.

**Breaking is law 2's, by temperature.** A hard strike breaks a cluster by heating it: the
collision's KE change goes to heat, and if an endpoint reaches `e ≥ B · kind` the bond breaks. A soft
strike moves a cluster; a hard one shatters it; chemistry decides which.

**Claimed and not yet shown:** that a cluster has a speed of sound, and that a group of total kind
`K` steps at `|p| / K`. Nothing computes `K`, so this inertia has to emerge, and first evidence says
it does not (item 33).

**One deviation, recorded.** Sharing runs on the clock, so a hot cluster's speed of sound is faster
than a cold one's. Real solids do the opposite, mildly. It is the price of having one clock.

### Why the sum of kinds, and not the count of primitives

Conserve the count and fusion is forbidden: two kind-1s merging into one kind-2 destroys a
primitive. Conserve the sum and it is bookkeeping — 1 + 1 → 2, 4 → 2 + 2. This is **baryon number**
in our universe: fusion conserves it while not conserving particle count.

It also made kind mean something: **kind is how much stuff a primitive is made of** — a mass. So the
thing gravity acts on and the thing being conserved are the same number, and a fixed budget buys
fewer heavy primitives than light ones by arithmetic.

**Nothing here changes a kind.** Fusion is a road not taken, so the kinds seeded are the kinds there
are, forever (item 18). That is where this physics stops asking why: we assume primitives exist
rather than deriving them, and ask for the *cluster* chemistry to emerge, not the inventory.

**Why it is a rule.** Scarcity is what makes anything that happens mean something. If matter is free,
growth costs nothing and no structure has to be efficient. Conservation turns growth into theft, and
theft is what makes competition real. Every prior system in `SOURCES.md` has this law. **The integers
are not a detail:** floats leak, and over a billion steps rounding bleeds mass with no error.
Integers also keep hexagons genuinely identical, so "a region of the same stuff" means something.

**What breaks without it.** Matter accumulates until nothing can move, or drains until the world is
empty — both slowly enough that you blame something else first.

## 2. Bonding

Two adjacent primitives may bond, with a **binding energy over their two kinds**:

> **`B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|`**, where **`v(k) = k mod 8`**
>
> A bond **forms** with probability `BOND_FORM_PROB` when the clock fires — never instantly on contact.
> A bond **breaks** when `e ≥ B · kind` at either endpoint — temperature at or above `B`.
> `B = 0` means the pair cannot bond.

`v` is a **valence**, one of eight columns. A bond is strongest when the two valences are
**complementary** — sum to 8 — and weakens by one per step away. So `v = 1` pairs best with `v = 7`,
`v = 2` with `v = 6`, `v = 4` with itself. One unit of kind moves a kind one column.

**No distance term, no force, no range.** Exclusion already repels at short range and gravity already
gathers at long range, so the only job left is which pairs bond and how strongly. **No temperature
term either** — the clock carries that for every law at once.

**Formation is rate-based on purpose.** Catalysis here is geometric: a cluster with a pocket holds two
reactants in contact longer than chance, and is selective because of which kinds line it. That only
buys anything if bonds do not form on first contact. It is how real enzymes work — atoms interacting
pairwise, no three-body term underneath.

**Why this form.** Ten forms were screened (`screen.mjs`). `min(gcd, 8)` was the prediction and was
retracted on two measurements of the table's *shape*: changing a kind by one moved its binding
energies by 92% of their mean (roughness 0.916 against 0.259 here), and `gcd(k, k) = k` made every
kind its own best partner, which builds crystals rather than copies. Under this form 75% of kinds
bond best with something else. The modulus 8 is a searched constant carrying a chosen value (item
17), and the slate stays available if the Lab comes back flat.

**Any replacement must be short.** The form comes from a small fixed grammar of integer operations —
sum, difference, parity, gcd, divisibility, remainder — and never a table of cases: *the law's
description must be shorter than the table it produces.* A one-line law cannot contain a periodic
table. Short is not weak; Rule 110 is a few bits and Turing-complete.

**Why it is a rule.** It is the entire source of differentiation. Without it every kind is
chemically identical and "kinds" are a number carried around that never matters. Law 2 does the
differentiating; law 4 does the saturating.

**What breaks without it.** A featureless gas. Gravity compresses it, compression heats it, transport
cools it, and that is the whole history of the world.

## 3. Gravity

All matter attracts all matter, falling off as 1/r², never cancelling. It acts on the sum of kinds,
and **it adds to momentum** — that is all a force is, `F = dp/dt`. No separate deflection rule is
needed.

**The only non-local law.** That cost is earned here, and a local replacement is a candidate (below).
Not in the Lab.

**Why it is a rule: it is where the energy comes from.** Without it you must hand the world energy at
the start or pump it in at a boundary forever — both are the designer choosing where life may live.
With gravity, spread-out matter holds potential, collapse turns it into heat, and the gradient
appears by itself: hot where compressed, cool at the edges. **The only initial condition for energy
is matter, spread out.** (The *composition* of that matter is a second initial condition — item 18.)
It also drains on its own: once everything has fallen in the world cools, so its arc is a consequence
rather than a schedule. And gravity is the only force with one sign, so it is the only one that can
build structure at scale.

**Three constraints on the implementation:**

- **Gravity never touches chemistry.** Between two adjacent primitives it must be orders of magnitude
  below the weakest bond, or which reactions run depends on where you are.
- **Each interaction is computed once and applied to both sides.** A pyramid approximation does not
  give equal and opposite forces, so it leaks momentum and fakes a preferred direction.
- **A pull smaller than one unit of momentum is carried, never rounded.** At any legal strength the
  strongest pull anywhere is under half a unit a tick, so rounding switches gravity off everywhere.
  Where the remainder lives is item 19: a second array, 32 bits a component, is recommended and not
  adopted; the spare bits are too coarse, and a coin per tick heats matter and kills orbits.

### How strong — a ceiling, a floor, and no room between them at 4096²

*(2026-11-05. Ric: "I have a hunch gravity is too strong right now." Measured in `orbit.mjs` Checks
6–10. Open — item 20.)*

State the strength as **ε: the energy two kind-255 primitives release falling into contact, in units
of the weakest bond.**

- **The ceiling** is the first constraint above: ε ≪ 1 — 0.01 for two orders of magnitude, 0.1 for
  one.
- **The floor** is the reason the law exists: collapse must heat matter past the weakest bond, or
  nothing ever reacts. A clump of radius `a` can give heat growing as **6.15 × a** in pair sums
  (measured over real discs). Spread over its kinds:

| collapse into | temperature at ε = 0.01 | at ε = 0.1 | ε needed for T = 1 |
|---|---|---|---|
| a clump of radius 64 | 0.004 | 0.04 | 2.6 |
| a clump of radius 256 | 0.016 | 0.16 | 0.65 |
| a clump of radius 1024 | 0.06 | 0.62 | 0.16 |
| the whole World as one ball (radius 2151) | 0.13 | 1.3 | 0.08 |

These are upper bounds: they assume every unit of potential reaches the heat field.

**The ceiling and the floor do not overlap.** At ε = 0.01 even the whole World collapsing into one
ball reaches a tenth of the weakest bond. Clumps of a few hundred hexagons need gravity as strong as
the bonds, which the ceiling forbids. Reality affords 10³⁶ of separation because a star holds 10⁵⁷
atoms; 4096² affords about one order, for one clump. Ric's hunch was right about the evidence — the
first orbit runs used gravity about 560 to 14,000 times the weakest bond — but gravity cannot simply go
weaker, because the floor is already above the ceiling.

**The levers, none chosen.** A bigger World — the floor falls as 1/a; at ε = 0.01 a clump that melts
anything is about a billion hexagons (`orbit.mjs` Check 10). Ric leans this way. It also needs momentum wide
enough to carry the fall — one reason momentum went to ±63. A looser ceiling, accepting some location-dependent
chemistry. A different exponent — 1/r's logarithmic well is far deeper, though it was rejected below
for global collapse. Or heat given at the start, which gives up this law's reason to exist. The
screened field below makes it worse: screening shallows every well. **The direction is Ric's**: a
hierarchy shaped like ours, as far as the hardware allows, judged by the four yardsticks in item 20.

### Gravity can be made local

Gravity as a **sum over pairs** is non-local. Gravity as a **field** is not: `∇²φ = ρ` is a local
equation, relaxed by repeated neighbour-averaging, with the force read off as the gradient of `φ`
between neighbours. That is how reality does it; the non-locality in Newton's version is an artifact
of having solved the equation.

On a 2D lattice that gives 1/r and a single global collapse, so take the **screened** form:

> **`∇²φ − m²φ = ρ`**

Still local, and it decays like `e^(−mr)` — faster than 1/r², so better at creating *elsewhere*. The
screening length `m⁻¹` sets how large an independent region is, the knob this project most wants.
Costs: one extra field per hexagon in a second array. Gain: **nothing in the codebase non-local at
all**. A candidate, not a measurement (item 12).

### Why 1/r² and not the 1/r that 2D gives

In *d* dimensions gravity falls as 1/r^(d−1), because a mass's flux spreads over a sphere's area in
3D and a circle's circumference in 2D. So 2D gravity is 1/r, with a potential that grows as ln(r)
without bound: every particle pulls meaningfully on everything.

**We use 1/r² because 1/r fights locality.** Locality exists to create *elsewhere* — independent
regions where a rare thing can persist. Under 1/r the likely outcome is one collapse, one clump, one
experiment. Under 1/r² you get many local collapses. The departure is licensed by treating this world
as a slice of a larger one rather than a true 2D cosmos.

**The exponent is a searched constant** (`GRAVITY_FALLOFF`). Strength sets how *fast* collapse
happens; the exponent sets whether it is *local or global*, and is the more consequential.

### Why the force exists at all

There is no deeper answer, and it is worth saying so. Newton gave the formula and declined to invent
a cause; Einstein made gravity geometry, but why mass bends spacetime is unknown. Every physics has a
floor and gravity is at this one's — but **ours exists for a stated reason**, which is more than our
own universe offers about itself.

**What breaks without it.** A world with imposed energy and no large-scale structure. You would be
designing the gradient instead of discovering it.

## 4. Capacity

A primitive can be bonded to at most **`capacityOf(k) = clamp(v(k), 1, 6)`** of its six neighbours,
with `v(k) = k mod 8` — law 2's own valence, read by law 4 too, so nothing is stored and no table is
written. *(One global number until 2026-11-06; Ric: "per kind", item 6.)*

What falls out, unasked: `v = 0` holds one bond and cannot bond to its own kind (`B(0,0) = 0`);
`v = 4` holds four and is its own best partner (`B(4,4) = 8`) — the shape carbon chemistry is built
on; `v = 7` holds six, all weak. **This form has been screened by nothing** — law 2's form beat ten
rivals first, and this one should go through `screen.mjs` before anyone calls it settled.

**Why it is a rule.** Saturation. An attraction that never fills up collapses everything into one
undifferentiated blob; capacity makes **structures** instead of lumps, and makes "how many can still
fit" a real question — a saturated primitive is inert, a nearly-saturated one grabs. With capacity
read from valence, it also adds to differentiation, which a single global number did not.

**What breaks without it.** No chemistry, at any setting of any other constant. The most
catastrophic omission available on this list.

## 5. Transport

Energy hops toward any neighbour at a **lower temperature** — through matter, or across empty space
as radiation — and at the World's boundary, if it has one, it leaves for good.

**Temperature, not energy.** Temperature is energy per unit of kind, so a heavy cold primitive can
hold more energy than a light hot one, and comparing raw energy would move heat uphill. The
comparison is `e₁·k₂` against `e₂·k₁` — two integer multiplications, exact.

**The ceilings.** Energy is 16 bits, so a kind-1 primitive reaches temperature 65535 and a kind-255
one reaches 257 — 32 times its strongest bond, so heavy matter can melt and boil. *(At 11 bits it
reached 8, and heavy matter was permanently bonded — item 15.)*

**Radiation is linear in temperature, not T⁴.** Vacuum has no kind, so it is absolute zero, and
emission is one unit per clock fire. The second law needs only a *monotonic* emission rate, so this
is a deviation from our universe, not an error.

**The books are kept at the edges.** The Lab's only exchange with outside is its thermostat, counted
as **thermostat net**. If the World has a boundary, every unit crossing it is **radiated-away**.
The World gets a weaker invariant, because gravitational potential is not stored: energy rises only
through collapse and falls only through the boundary, both logged.

**Across empty space it is radiation** — a structural fact, not part of this law. Vacuum has no kind,
so the comparison reads `0` against `0`; energy entering an empty hexagon becomes a quantum in
flight. Emission itself is this law, with vacuum colder than anything.

**One constraint on the clock.** Net radiative flow is downhill only because hotter matter acts more
often, so the clock rate must never saturate (see *Each hexagon keeps its own time*).

**Why it is a rule.** Energy has to be local or nothing is hot or cold *somewhere*, and movement
toward less couples regions so what happens here reaches there. And the empty-space half is the
**sink**: matter is conserved, so if energy could only move through matter it would accumulate and
the world would heat to uniform death. A gradient needs two ends. This is the one place the books
don't balance inside the world — loss to the outside — and it is load-bearing.

**What breaks without it.** Without conduction, temperature doesn't exist, so phase, melting, decay
and every reaction rate go with it. Without the sink, no gradient, no dissipative structures, no
ladder. The project fails at rung zero.

## The five structural facts

Not laws — true of how the world is built. Break one and the world is as ruined as if a law had been
dropped.

### Hexagonal grid, one primitive per hexagon

Isotropy: a square grid has favourite directions and hands you expanding squares and axis-locked
growth, which a project whose method is "find structure you didn't expect" cannot survive. Hex is a
large improvement, not a cure; a fully disordered lattice would be better and much more work. One
primitive per hexagon gives exclusion and a hard occupancy limit for free, and mixtures need no
representation.

**The Lab loops on itself as a hexagonal torus** (2026-11-05; Ric: "What if we made it loop on
itself", then "Loop it"). In axial coordinates that is `q mod N, r mod N`: an `N × N` rhombus whose
copies tile the plane in a triangular pattern.

- **It is flat everywhere with no special place.** Every hexagon has the same six neighbours, so the
  shape cannot show up as structure.
- **The loop is the same length in all six directions.** Copies sit on a triangular lattice, which
  keeps them furthest apart for a given area — about 7½% further than a rectangle of hexagons, and
  without a rectangle's two loop lengths, which would be a favoured direction.
- **`N` must be a multiple of 3,** or the three-hexagon collision blocks don't tile across the seam —
  checked by brute force. So the Lab is **258 × 258**, 66,564 hexagons.

With no edge, momentum is conserved exactly with nothing to count, and a quantum on an empty line
goes round for ever, still counted as in flight. **The World's shape is open** (item 22): a loop
removes the heat sink, the floor that gives a *down*, and makes gravity sum across the seam.

### Only neighbours interact

This creates *elsewhere*. If anything can affect anything there is one global state and one
experiment. With locality, distant regions are independent — thousands of parallel experiments, and
a rare thing can survive in one corner. **Niches exist because of this and nothing else.**

It also gives a **causal speed limit** for nothing: one hexagon per tick is the fastest information
can move, so there is a light cone. *(Called "a speed of light" until Ric pointed out it is about
information, not light — as in reality, where light merely sits at the limit.)* And it is why the
thing runs at all: local rules are parallel and shader-shaped.

**Gravity is the only exception.** A second one means something is wrong with the design.

### Each hexagon keeps its own time

There is no global "now", and that is real physics: relativity makes simultaneity relative. It
matters here twice over. **It stops the clock lying to you** — synchronous updating manufactures
cyclic patterns that look like self-organization. And **it reduces lattice anisotropy**, a standard
remedy in the cellular-automaton literature.

**Event-driven in the Lab, probabilistic in the World.** Ric's objection to "each cell updates with
some probability per tick" was right: **time doesn't skip.** A hexagon is not frozen between
updates; its clock runs at a different rate. Both schemes are stochastic — Gillespie's algorithm is
event-driven, continuous-time and random — and differ only in whether time is ticked. The Lab uses
event-driven continuous time: every change is already an event, a priority queue is cheap at 66,000
hexagons, and an instrument should not carry a known artifact. The World cannot: at 17 million
hexagons in a browser a queue costs 50–100×. **The approximation gets checked**, by running one small
configuration both ways and comparing species, binding energies and rates.

**What sets the rate: temperature.**

> **`rate(T) = floor + c · T`**

Hot matter acts often and cold matter rarely. That one line does three jobs:

- **It makes radiation carry heat.** Sight lines here are exactly reciprocal, so under a flat clock
  every pair exchanges energy at the same rate and net flow is **exactly zero**. A temperature-
  dependent rate is the only thing that unbalances it — which is why our universe has a
  Stefan–Boltzmann law at all.
- **It closes the second law exactly**, not statistically: between any two hexagons that see each
  other, net flow is downhill for any rate that rises with temperature.
- **It gives reaction rates their temperature dependence**, the attempt-frequency half of an
  Arrhenius rate, so no law has to carry one.

A fourth job, thermal pressure — hot regions expanding against cold — **does not follow from the
clock alone**, because stepping reads momentum, not temperature. The thermal kick (law 1) now turns
heat into motion, and hot sites fire and kick more often. That hot regions actually expand is
**not yet measured** (item 29).

**The constraint: strictly increasing, never saturating.** The rate is a probability, so it clips at
1, and above the clip net radiative flow goes to zero and its direction becomes a coin flip —
measured at 10 seeds of 20 running heat *uphill*. So assert `floor + c · T_max ≤ 1`. Any floor
satisfies the second-law argument; a floor at `c · T_max / 16` gives a 16:1 spread between hottest
and coldest, which costs transport speed, not correctness. *(An older form forced a 2047:1 spread and
would refuse a correct configuration.)*

**What breaks without it.** Flat clock: radiation transports nothing, and every reaction rate needs
its own temperature term. Saturating clock: the second law is absent above the clip.

### Bond energy accounting is exact

A bond forming releases **precisely** `B` as heat; breaking absorbs precisely that much. This is the
seam between laws 2 and 5, and the conversion between bonded and thermal energy is where
conservation goes quietly wrong. Release more and you have a free-energy pump; release less and the
world bleeds energy every time chemistry happens. Both failures are slow, silent and look like
physics. *(Ric predicted this entry before reading it, asking whether a rule might "come from how 2
others interact". That is exactly what it is, and why it isn't a law.)*

**In the ledger, a standing bond holds −`B`.** The Lab's conserved total is
heat + Σ KE + in flight − Σ B over standing bonds; leave the last term out and every bond that forms
looks like heat from nowhere.

**Why it cannot currently break.** `B` is recomputed from the two kinds every time, never stored, and
**nothing changes a primitive's kind.** So a recomputed `B` is the same forever. Anything that ever
makes kind mutable (fusion) must first break every bond on the changing primitive at the old kinds.

### Radiation crosses vacuum in a straight line

An empty hexagon holding energy and a direction **is** a quantum in flight: one unit, one hexagon per
step, absorbed by the first matter it meets. At a boundary, if there is one, it leaves and
`radiated-away` counts it. Emission direction is uniform over the six — forced, because the
second-law argument needs it.

**Six bits, one per direction, in the bond field an empty hexagon never uses.** Under ticked time the
bits are exact rather than a cap: a quantum arriving in a slot and an emission into it can only come
from the one neighbour behind, which is matter or vacuum, never both. **Under the Lab's continuous
time they are not**: a trailing quantum can catch the one ahead, and the Lab makes it wait, so
radiation there can travel slower than the causal limit (item 26).

**Why a fact and not a sixth law.** It says how energy crosses a gap, of a piece with the lattice and
the causal limit; the force is still law 5. The case against — this hands the project photons back —
is fair and recorded in `HOW-WE-DECIDED.md`.

**So a hexagon is one of three things:**

| | kind | energy | momentum | bonds |
|---|---|---|---|---|
| **a primitive** | 1–255 | its heat | an integer vector | who it is bonded to |
| **a quantum in flight** | 0 | — | — | one bit per direction in flight |
| **empty** | 0 | 0 | — | 0 |

**What breaks without it.** The sink is unreachable, energy never leaves matter, and every gap is a
hole in the universe with gravity the only long-range channel.

---

## Does our own universe have these?

The list was reasoned from "what would a world need", not copied from physics. Audited 2026-11-03:
**four of the five laws are real laws of our universe.**

| # | Here | In our universe |
|---|------|-----------------|
| 1 | Conservation of kinds, energy, momentum | **Matter: yes** — it matches *baryon number*, never observed to be violated. **Energy and momentum: locally yes, globally no.** Expansion removes the time-translation symmetry Noether's theorem needs, so photon energy redshifts away and peculiar momentum decays as 1/a. Raised by Ric. |
| 2 | Bonding by kind | **Yes** — electromagnetism, effectively short-range in bulk matter because charges cancel. |
| 3 | Gravity | **Yes**, though reality's is spacetime curvature, and 1/r² because space is 3D. |
| 4 | Capacity | **Yes, the closest match** — the Pauli exclusion principle, which is why shells, valence and chemistry exist. |
| 5 | Transport | **Yes** — conduction, and blackbody radiation for the empty-space half (T⁴ there, linear here). |

**None of that makes our law 1 wrong.** Reality's global energy conservation fails because the
universe expands. The Lab does not expand: its laws are the same at all times, so Noether gives
exactly the conservation we assert. Everything this project cares about is local anyway, and local
conservation has never been seen to fail. And strictness is load-bearing regardless, because the
assertion is the project's only bug detector. *(If the World grows — item 22 — its expansion loss is
counted, which is how reality would say it too.)*

Of the structural facts, locality is firmly real, and no universal "now" is real but discretizing it
is ours. The hexagonal lattice is entirely ours — reality has no lattice, the single largest
departure here.

**What reality has that this doesn't:** the strong force, which builds distinct primitives (we assume
them); the weak force; fusion as a second energy budget; three dimensions; continuous space; quantum
mechanics.

### On math

Ric's point: **our universe does not do math.** Nothing computes a gravitational formula; equations
describe what happens. So for every formula here, ask whether it is *the law* or *a result the world
should have produced* — the second is a smuggled answer, like the deleted property function and T⁴
curve. The honest inventory is three places: law 2's binding energy (one operation on two integers,
no magnitude over a distance), gravity (a sum over distance, with a local candidate that would replace
it), and the temperature comparison (two integer multiplications, unavoidable).

---

## Why gravity is held out of the Lab

The Lab uses four laws. Cost is a reason but not *the* reason.

**The Lab controls its conditions, which is what makes it a laboratory.** Its job is to measure which
clusters are stable and how they behave. A measurement is worth something only if its conditions are
known and held still, and gravity makes that impossible: pressure and temperature everywhere depend
on the whole shifting mass, so the same experiment run twice gives two tables. That is not a periodic
table; it is a travel diary. Chemists work at standard temperature and pressure for this reason, and
the Lab holds a hot and a cold band. That is legitimate because **the Lab is not claiming to be a
world** — a thermostat in a laboratory is apparatus.

**Supporting reasons.** At 258² there is no large scale to structure. Gravity is the most expensive
law and the Lab is where the search runs thousands of universes. And holding it out means a Lab that
produces mud is a chemistry problem, not a cosmology one.

**What it costs.** A species that only forms under strong gravitational compression won't appear in
the table. Since the World runs the same primitive physics it still *exists* there; you just wouldn't
recognize it. The mitigation: **the Lab sweeps conditions rather than picking one**, and records each
species with the regime it was found in. `TWO-RUNS.md` covers the rest.
