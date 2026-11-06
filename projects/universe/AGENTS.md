# Rules for AI assistants working on Universe

Read this and `README.md` before touching anything in `projects/universe/`. The README is
the spec — what exists, the five laws and five structural facts, and what is deliberately absent.
[`THE-LAWS.md`](THE-LAWS.md) states each law, justifies it and says what breaks without it;
[`HOW-WE-DECIDED.md`](HOW-WE-DECIDED.md) is the record — every correction, every rejected
option, and the reasoning behind each open question; [`TWO-RUNS.md`](TWO-RUNS.md) is why the project runs twice. This file
is how to work here without wrecking the concept.

Relay's root `AGENTS.md` still applies in full (no build step, no dependencies, docs
updated in the same commit, a push to `main` is a publish). What follows is on top of it.

---

## 1. Credit everything

Ric's rule, 2026-11-03: **this is built on other people's work, so give them credit.**

Every borrowed idea, algorithm, result or technique goes in `SOURCES.md` — author, year,
title, link, and one line on what we took from it. **Add the entry before you use the
technique, not after.** If you catch yourself writing code based on something you read,
stop and record it first.

If you can't find who originated an idea, say so in the entry rather than leaving it
uncredited.

## 2. Never store what should emerge

No stored melting point, phase, density-as-given, `is_alive`, `species`, `organism`,
`fitness`. These are **computed for display or observed in output, never held as state.**

The README has the full list of things that must never be written. If you find yourself
adding a field from that list, you have taken a wrong turn — the thing you want is a
consequence of the laws, and if it isn't, that's a finding worth writing down rather than
a gap to patch.

## 3. No borrowed names

Nothing in this code is named after anything in our universe. No `water`, `carbon`,
`cell` (in the biological sense), `membrane`, `atom`, `molecule`. Primitives are
**numbered**, and clusters are identified by what they're made of.

The reason: every Earth-shaped name is a hint smuggled to the world, and it biases both
the design and what we notice in the output. If we start calling something "water" we
will start expecting it to behave like water.

Grid cells are `cell` in the lattice sense. That one is unavoidable; prefer `site` where
there's any chance of confusion.

## 4. No enumerated tables

No list of materials. No list of reactions. No lookup table of what combines with what.

If a table exists in this project, it was **measured by the Lab**, and it ships next to the
run that produced it with the constants that generated it. An enumerated feature set is the
exact disease that capped Avida, whose complexity saturates at a value set by the information
content of its niche because its feature set is fixed.

**A measured table is still a table, so it is never an input.** The Lab's output is the
dictionary you *read* the World with. The World simulates primitives under the same laws and forms
whatever they form, including composites the Lab never saw. If you ever find yourself making
the World instantiate species from a list, stop — that reintroduces the ceiling by a side door.

**And the pair force is the other loophole: watch its *form*.** `f(k₁, k₂, r)` could hold a
periodic table as a few hundred special cases and satisfy every rule on this page. So the
force law must come from a small fixed grammar of integer operations — sum, difference,
parity, gcd, divisibility, **remainder** — and **never a table of cases**. The test is description length:
*the law must be shorter than the table it produces.* Short does not mean weak (Rule 110 is a
few bits and is Turing-complete); it means the answer cannot have been written in. See law 2
in `THE-LAWS.md`.

**And `r` is gone from that signature.** As of 2026-11-04 law 2 is not a force: it is a binding
energy over two integers, `B(k₁, k₂) = 8 − |v(k₁) + v(k₂) − 8|` with `v(k) = k mod 8`, no
distance term, because
exclusion already repels and gravity already gathers. That narrows this loophole — a function of
two integers has less room to hide a table than one of two integers and a distance — but it does
not close it, so rule 12 still applies to any replacement. The slate, the screen and the three
retractions behind that decision are in `HOW-WE-DECIDED.md`.

## 5. Integers for anything conserved

Matter, energy and momentum are **integers**. Never floats.

For matter specifically, the conserved quantity is the **sum of primitive kinds**, not the
count of primitives — a kind is how much stuff a primitive is made of. Asserting a count
would forbid fusion; see law 1 in `THE-LAWS.md`.

Two reasons, both serious. Floats leak: over a billion steps, rounding quietly bleeds
mass and the conservation law breaks without ever throwing an error. And continuous
amounts make every site a unique snowflake, so "a region of the same stuff" stops being a
meaningful concept and the variance layer lights up uniformly, which destroys the only
instrument we have for finding structure.

Momentum is an **integer vector in cube coordinates** — two signed components at **±15**, on the
hex lattice's three axes — and **not** FHP's six occupancy channels, which are for a gas of
identical particles and would mean six kinds per hexagon here. Don't reintroduce channels.

*(Said ±3 until 2026-11-05. It was right until the word went to eight bytes on 2026-11-04 and
momentum got 10 bits; the range appears twice in this rule and the two had drifted apart, with the
stale one first. Worth a note rather than a silent fix, because a width is physics here — the
paragraphs below say so at length — so a rules file carrying two different answers is the hazard
those paragraphs are warning about.)*

**Momentum is never stored as a direction. Keep those two things apart.** Stepping rounds the
vector to the nearest of six hexagon directions; the vector itself is never rounded. That
separation is the entire reason option (B) works where (A) could not — under (A) the direction
*was* the momentum, so there was no way to round a path without breaking conservation, and no way
for a force to express a strength at all.

**A tie between two directions is a coin, never a fixed pick** *(adopted 2026-11-05, README item
21)*. Integer vectors tie often, and a fixed tie-break is a handedness that spiralled every orbit in
`orbit.mjs` into the centre. If you write a step function, check what it does on a tie.

**Speed is a rate, not a distance:** one hexagon every `k / |p|` ticks, capped at one per tick.
Never implement it as "move `p/k` hexagons" — that breaks the causal limit for light kinds and
freezes heavy ones. As a rate it does neither, and it yields 255 distinct speeds —
which is **exactly the kind count**, because there is always a momentum of magnitude 1 so every
kind `k` gives a step period of `k`. No momentum width adds a speed; width is headroom for
forces only. Measured in `budget.mjs`.

**Collisions conserve momentum exactly and the outcome is drawn, not computed.** Resolve them in
**Margolus blocks** rather than pairs, so conservation holds by construction. About 15 legal
outcomes exist for a typical pair; pick one at random.

**Kinetic energy is in, as of 2026-11-04, at `S = 64`.** *(A rule saying "do not try to add it"
stood here for about an hour that day and was wrong; it was then an open question until it was
adopted.)* It is **a whole number** — `floor(S · Q(p) / 2k)` with a scale constant, because the
exact fraction `p²/2m` cannot be conserved on this lattice and because with the constant too small
the heavy kinds read zero at any momentum. It is **derived, never stored**: the energy field holds
heat, `KE` is recomputed from `(p, k)`, and law 1's conserved total is `heat + Σ KE`. The window is
**2 to 291** at the current widths and law 1 says why 64 inside it. Then a collision conserves momentum exactly and moves whatever kinetic
energy changes by into or out of the heat field, so the total is exact by construction. **That
construction is also what makes it safe:** kinetic energy is a pure function of mass and momentum,
so a round trip through collision states returns exactly the energy it borrowed and no free-energy
pump exists — verified, zero gain over thousands of closed loops. `momentum.mjs` has the numbers.

**A width is not only a conservation hole — it constrains the physics.** The first real case:
bonds break when `e ≥ B · k`, energy was 11 bits, so a kind-255 primitive could never get hotter
than `2047 / 255 = 8`. That alone **caps law 2's binding energy at 8**, or heavy matter's bonds never
break and it leaves the world's economy for good. A field width reached into the laws and chose a
constant. Widen energy to 16 bits and the cap becomes 257 — so **changing a width is a physics
decision**, never a convenience. See law 2 in `HOW-WE-DECIDED.md`.

**And that is exactly what happened, which is why this paragraph exists.** At a cap of 8 a
kind-255 primitive had **eight** distinguishable temperatures and could not be heated past its own
strongest bond, so heavy matter was permanently inert and all real thermal chemistry happened among
the light kinds — a consequence that was computed, printed by `screen.mjs`, used to derive the cap,
and never written down. Energy went to **16 bits** on 2026-11-04 and the word to eight bytes; the
forced cap is now 257, so law 2's modulus is a choice rather than an artifact. README item 15.

**The rule cuts both ways, and that is the lesson to carry:** keeping a width that is constraining
the physics, for convenience, is the same error as widening one for convenience. A width that
silently picks a physics constant is the dangerous case, because it looks like a derivation.

**And widths are conservation holes too.** Kind is 8 bits, so it stops at
255; energy is 16 bits, so it stops at 65535. A fusion that would make a kind-400 primitive, or
a bond forming in a hexagon already at 65535, has nowhere to put the result — and a silent wrap
or clamp breaks conservation with no law having been violated. **Any operation that would
exceed a field must fail loudly**, exactly like a drift of 1. Don't clamp, don't saturate,
don't widen the field quietly: a world that keeps hitting the ceiling is telling you the
constants are wrong. (**Eight bytes as of 2026-11-04.** Kind 8 + bonds 6 +
energy 16 is 30 bits, and law 1's option (B) spends 10 more on a momentum vector — two signed
components at ±15, 5 bits each — for **40 of the 64**. The **24 spare bits are reserved**: nothing
goes in them without an entry in `THE-LAWS.md` and a reason, because the old four-byte word was
enforcing that by scarcity and no longer is. Never anything on the never-store list. **And not
gravity's remainder**: at a legal strength 12 bits a component rounds it away, and it needs 32.
See `orbit.mjs` Check 11 and README item 19.)

## 6. Assert conservation on every run

Matter, energy and momentum totals get checked every run. **A drift of 1 is a bug, not a
rounding issue.** Fail loudly, print the step it first went wrong, and don't paper over
it with a tolerance.

**Count what crosses the edge, or the assertion is worthless.** Energy leaves at the
boundary and the Lab's thermostat injects and removes it, so `world energy = constant` would
pass while the world quietly gained or lost energy at the border — which is the one place it
matters most. Keep two counters, **radiated-away** and **thermostat net**, and assert
`world energy + radiated-away − thermostat net = constant`.

**Energy in flight is a third term, and leaving it out looks exactly like a leak.** A quantum
crossing vacuum is inside the world and still owned by it, so the assertion is
`world energy + in flight + radiated-away − thermostat net = constant`. Count it by walking the
six direction bits of every empty hexagon. `radiate.mjs` closes this exactly in every run, so
there is a worked reference; if it ever fails to close, suspect emission that decrements the
emitter without setting a bit, or a quantum absorbed twice.

**Momentum needs the same treatment, for the same reason.** The hard floor and ceiling are a
momentum reservoir — a primitive that hits the floor either bounces or stops, and either way
the world's total changes. Keep **wall momentum** as an integer hex-vector and assert
`world momentum + wall momentum = constant`. Reality does exactly this and calls the reservoir
the Earth. See law 1 in `THE-LAWS.md`.

**In the Lab, two of these counters are zero by construction — assert that too.** The Lab loops
on itself (2026-11-05), so it has no wall and no boundary: assert `world momentum = constant`
exactly, and `radiated-away = 0` every step. A nonzero radiated-away in the Lab is not a small
leak, it is code that still thinks there is an edge. **And the seam is where a looped world
breaks quietly**: anything that reads a neighbour must wrap, and a neighbour lookup that forgets
to is a wall nobody wrote down. Test the seam on its own — a collision block, a bond and a
radiation line that each straddle it — before trusting a run.

**And watch the gravity solver specifically.** A pyramid approximation does not produce exactly
equal and opposite pair forces, so it leaks momentum every step and the world acquires a drift
that looks like a preferred direction in the physics. Compute each interaction once and apply
it to both sides. Law 3 has the detail.

**The Lab gets the strict equality. The World gets a weaker invariant**, because gravitational
potential is not stored anywhere — it is implicit in the arrangement, so collapse genuinely
appears to create thermal energy from nothing. That is correct physics and the whole energy
budget depends on it, but it means total energy is not conserved in the World. What is conserved
is energy plus potential, and since potential isn't represented, assert the monotonic form
instead: energy rises only through collapse, falls only through the boundary, both logged.

**Why this rule is strict: an accounting hole disguises itself as a discovery.** A structure
exploiting a momentum or energy leak looks exactly like emergent propulsion or emergent
metabolism, and it will be the most exciting thing you have ever seen. Both accounting bugs
this project has had so far — the momentum swap and comparing raw energy instead of
temperature — were of precisely that kind.

Also watch for **spurious** conservation. FHP needed a specific symmetric three-body
collision to avoid accidentally conserving a third component of momentum that shouldn't
exist. Naive local rules can conserve things you never intended, and a fake conservation
law will quietly constrain the dynamics in ways that take weeks to diagnose. Check that
we conserve exactly what we think and nothing else.

## 7. Five laws, and adding one requires a written reason

Five laws and five structural facts. The count is a design constraint, not an accident:
every law is a place where an answer could be smuggled in, so fewer laws means more of the
behavior belongs to the world rather than to us.

To add one: add an entry to `THE-LAWS.md` saying what it buys, and **why it could not have
emerged instead.**

**Prefer removing.** The list went from eleven to nine total — and nine laws to five — in a
single pass once Ric said it looked like a lot. Three conservation laws were one principle,
radiation was a T⁴ formula with no mechanism behind it, and mixtures and momentum channels
were artifacts of a representation that got deleted. `HOW-WE-DECIDED.md` has a *Rules that came off
the list* section; read it before adding anything, because the same two moves (pushing the floor
to primitives, one primitive per hexagon) deleted six rules between them.

Removing a law is easier and always worth trying.

**And when something genuinely new is needed, ask whether it is a law or a structural fact.**
Radiation is the one case so far. Settling law 5's sink on 2026-11-04 needed quanta crossing vacuum
in straight lines, which is new machinery — but *emission* is law 5 unchanged, and what the new
machinery describes is how energy crosses a gap, which is of a piece with the lattice and the speed
of light. So it went in as the **fifth structural fact** and the law count held at five. That
judgement is arguable and the argument against it is recorded next to it in `HOW-WE-DECIDED.md`.
The rule to take from it: **a law is something that acts; a structural fact is something that is
true of the world's construction.** Do not use the distinction to dodge this rule's accounting —
write the new thing down in full either way.

## 8. Every physics constant in one place

**Two of them are not independent, and both can be checked before anything runs.** Gravity between
adjacent primitives must be orders of magnitude below the weakest pair force, or gravity
contaminates chemistry. And the **clock rate must be strictly increasing in temperature and must
never saturate** — wherever it flattens, net radiative flow goes to zero and its direction becomes
a coin flip, so the second law switches off in the hottest part of the world. The rate is a
probability, so it clips at 1: with `rate(T) = floor + c · T`, assert **`floor + c · T_max ≤ 1`**.
Assert both at startup and refuse to run.

**And gravity has a floor as well as a ceiling** *(2026-11-05, README item 20)*. State its strength
as **ε**, the energy two kind-255 primitives release falling into contact over the weakest bond; the
ceiling above is ε ≪ 1. The floor is that collapse of the clumps the World can form must heat matter
past the weakest bond, or chemistry never runs — `orbit.mjs` Check 7 computes it from the World's
size. **At 4096² the floor is above the ceiling**, so as of this writing no strength passes both.
Do not loosen either check quietly to get a run going; that choice is Ric's and is item 20.

*(Corrected 2026-11-04. This said "the clock scale times the hottest reachable temperature must be
below 1", which at 11 bits of energy forces the scale under 1/2047 and so a **2047:1 spread in
update rates** — free in the Lab, close to fatal in the World, where the coldest matter would update once
in 2047 ticks and the cold edge is where the dissipative structures are meant to live. The
second-law argument only uses monotonicity, so `rate(T) = floor + c · T` is sound for **any** floor,
and a floor at `c · T_max / 16` buys a 16:1 spread at the cost of transport speed rather than
correctness. **Do not assert the old form — it would refuse to run a correct configuration.** See
the clock in `THE-LAWS.md`.)*

The constants are the search space. They live in one module, named, with their units and
plausible ranges. **No magic numbers inline, anywhere.** If a number appears in a rule
body, it should have come from that module.

## 9. Locality is absolute

Nothing reads past a site's immediate neighbors.

The gravity solver reads the pyramid, and **that is the only exception in the codebase.**
If you need a second one, something is wrong with the design — raise it rather than
adding it.

**And as of 2026-11-04 that exception may be removable, which changes how to read this rule.** Law
3 now has a local candidate: `∇²φ − m²φ = ρ`, relaxed by neighbour-averaging, with the force read
off as the gradient between neighbours. If it is adopted the pyramid goes and **nothing in the
codebase is non-local**, so the rule becomes absolute with no carve-out rather than
one-exception-only. Until then the pyramid stands and the count is one. Either way a *second*
exception means something is wrong with the design.

## 10. Write down what didn't work

A run that died, plateaued, produced nothing, or produced structure that turned out to be
a grid artifact gets recorded with the constants that produced it.

This is a **search**, and in a search negative results are most of the output. A log of
dead universes is the most valuable artifact this project will generate, and it's worth
more than any individual pretty run.

## 11. Don't trust a pretty picture

Structure in the output is not evidence of emergence until it survives the obvious
checks:

- Is it aligned with the lattice axes? Then it is probably a grid artifact.
- Is it periodic with the update scheme? Then it is probably a clock artifact —
  synchronous updating in particular is known to generate cyclic patterns that look like
  self-organization and aren't. (This is part of why every hexagon keeps its own
  clock.) In the World specifically, check whether the structure survives in the Lab's
  event-driven time, which has no tick to be periodic with.
- Does it survive a change of random seed? If one seed produces it and others don't, it
  isn't a property of the physics.
- Does it survive a small change of constants? Genuine structure should be robust over a
  region, not balanced on a point.
- **Does it balance the books?** Check matter, momentum and energy *including every edge
  counter* — radiated-away, thermostat net, wall momentum — over exactly the region the
  structure occupies. A thing exploiting an accounting leak looks precisely like emergent
  propulsion or emergent metabolism, and it is the single most likely way this project fools
  itself. If the structure sits against the floor, suspect the wall first.
- **Is it just a crystal?** The variance layer lights up for crystals, phase boundaries and
  ordinary clumping as well as for anything interesting. Variance tells you *where to look*
  and nothing more; the claim has to come from behavior.

Then check which rung of the acceptance ladder in `README.md` it actually reaches — rich
chemistry, catalysis (the structure must be **regenerated** afterward, not merely present),
accumulation, robustness. Name the rung rather than saying "something interesting happened."

Apply all of this before telling Ric something interesting happened.

## 12. Screen before you simulate

Five tools in this directory, and none of them is part of the engine. **The engine itself arrived
2026-11-05 and is `lab.mjs`, with `constants.mjs` and `lab-check.mjs`** — this rule is about the
five, and it still binds: screening is cheap and a run is not, so a candidate form goes through
`screen.mjs` before it goes through the Lab.

**What the Lab added to this rule rather than replacing.** It found eight things the five tools
could not, items 23 to 30, and three of them are about **time**, which the tools do not have: the
causal limit has no meaning without a tick (23), the Margolus offset has no step to happen on (24),
and radiation's "six bits are exact" holds only under lockstep (26). A stretched bond has no stated
fate (25). Law 2's formation probability is not in the search space (28). The hot band has a ceiling
and needs headroom under it (30). **None of those is visible to a tool that enumerates a table.**

Two more are worth reading as a pair, because the first one was wrong. Item 27 began as "nothing in
the Lab creates momentum", written as a hole in the laws — and Ric pointed out that the Lab is the
chemistry and gravity has no business in it, which is the design and not a gap. Measuring it
properly gave the real finding and then item **29**: chemistry runs perfectly with nothing moving
(12,222 bonds, zero steps), so momentum is a *mixing* condition — and **heat never becomes motion at
all**, because stepping is `min(1, |p|/k)` and reads no temperature. That makes the clock's fourth
claimed job, thermal pressure, not follow from the laws. A tool that enumerates a table cannot find
that either, and neither could the engine until somebody asked the right question about it.

So the lesson alongside "screen before you simulate": a screen cannot find a hole in the
*dynamics*, and the Lab's assertion can — two of the eight were caught by the ledger failing, at
18,541 and 34,864 units, not by anyone reading the law. **And a count from one run is not a
finding.** All eight were first written from a single seed and one unscreened constant set; they
are now measured over 8 seeds and 6 variations, and `lab-check.mjs` Checks 9 and 10 keep them that
way.

`screen.mjs` scores a candidate form for law 2 over all 65,025 pairs of kinds — binding-energy
spread, family structure, near-inert count, bonding degree spread — in milliseconds, with no
simulation.

**Add a candidate to its table before you run a universe with it.** Four of the first ten forms
were rejected on the screen alone, and one (`lcm`) was killed by overflowing the 11-bit energy
field rather than by anything about its structure. A form that screens badly will not be rescued
by a better engine.

It is a filter, not a verdict: it can show a form **cannot** work and never that one does. It
also measures a table of pair energies, not a world, so nothing about clusters, motion or
temperature is in it.

`radiate.mjs` checks law 5's radiation and the clock: sight-line reciprocity by brute force, net
flow over every visible pair, a flat-clock control, exact energy accounting over a dynamic run, a
blob-radius sweep for opacity, and a density stress pass. It settled open question 2 and produced the clock constraint in
rule 8.

`budget.mjs` enumerates every field allocation that fits in the hexagon's **four** bytes and
reports what each buys, including the number nobody had computed — the hottest temperature the
*heaviest* kind can reach, `energyMax / kinds`, which was **8** at the four-byte layout and is why
heavy matter was inert. It found that the layout left a bit unused, and that law 2's form is
scale-invariant in the kind count, so kind bits can be spent on energy without costing chemistry.
See README item 15.

*(Corrected 2026-11-05. This said 8 is the figure "at the documented layout", which stopped being
true when the documented layout became eight bytes on 2026-11-04 — **it is 257 now**, and heavy
matter is no longer inert, which was the entire point of the change. The tool still enumerates the
four-byte space, because that enumeration is what made the case for leaving it; its own output
called that layout "documented" until this pass and now says "to 2026-11-04". Read its four-byte
tables as history and its eight-byte section as the current word.)*

`momentum.mjs` settled law 1's option (A) versus (B): it enumerates collision outcomes with and
without kinetic energy, measures the speed spread by mass band, checks the bit budget, and finds
the scale factor that makes whole-number kinetic energy work. It is also the reason a phantom rule
was found — see rule 7. **Two of its nine checks are wrong and are labelled as such in the file
rather than deleted**; read the note above check 5 before quoting any number from it.

`orbit.mjs` settled item 16 — whether anything orbits, and what stops it — and, since 2026-11-05,
measures how strong gravity may be and where its remainder lives (items 19 to 21). It is the **only tool here that steps forward
in time**, which is allowed because two primitives under one law is a measurement, not a claimed
world; the viewer's refusal to animate is about something else, a whole lattice pretending to run
physics it has not been given. Checks 1–5 run a 2×2 — direction quantization on or off against
integer momentum on or off — under both rules for a sub-unit pull, plus a sweep of momentum range;
Checks 6–8 state gravity's strength as ε (rule 8) and find its floor, Check 10 sizes the
World that floor needs and the momentum width that World needs; Checks 11–12 measure the three
homes for a sub-unit pull (spare bits, a second array, a coin) at a legal strength; Check 9 keeps
the tie-break bug on show. **Its control is load-bearing**, and the file has had **four harness bugs**: a start
60° off tangent, an orbiter light enough to hit the speed cap, a start on the edge of the momentum
box, and a step tie always broken the same way. The first three made orbits fail; the fourth made
spirals pass a two-lap bar. **So it flies ten laps and reports each run's closest approach on its
first lap and its last** — equal is an ellipse, falling is a spiral. Read its own comments before
quoting a number: two predictions in it read as refuted for a day and were right.

**And a tool that solves for a constant has chosen one.** Checks 1–5 set gravity to whatever made
each start circular and never compared it with law 3's ceiling; it was hundreds to thousands of
times too strong. If a tool here derives a constant to make a scenario work, print it in the
constant's real unit next to the limit it must obey.

**Three lessons from these tools are worth more than the tools.** First, **the control run is where the result
was.** Checking a temperature-dependent clock showed the second law closing; running the *flat*
clock as a control showed that radiation transports exactly nothing without it — which was the
actual finding, and it only existed because the boring case got run too. Second, **an analytic
check and a dynamic run do not fail the same way.** The analytic pass reported the saturated pairs
as "flat", which read as harmless; the dynamic run showed their direction is a coin flip. And the
first four dynamic runs used one convex blob, which never absorbs anything — they reported
`absorbed by matter 0` and tested nothing at all about the objection they were written for. **If a
run reports zero of the thing you are measuring, the run is wrong, not the physics.**

Third, **check that a legal outcome still exists, not just that illegal ones are excluded.** The
momentum record claimed conservation in a Margolus block is free "by construction" because you
decline outcomes with the wrong total — which is true and says nothing about whether any outcome
survives. Counting them found 14.9 per collision. A constraint that is satisfiable in principle can
still be satisfiable almost nowhere, and only counting tells you.

Fourth, and this one cost the project a wrong law for an hour: **check what the measurement
assumed before believing what it says.** The same tool then reported that kinetic energy was
impossible, on two tests that were both rigged — one simulated *pairs* when collisions resolve in
three-cell blocks, contradicting the design two paragraphs above it, and the other required kinetic
energy to be the fraction `p²/2m` and then reported that a fraction will not fit in an integer
field. Both produced real numbers measuring the wrong thing, and neither looked wrong in the
output. What caught it was Ric saying the conclusion could not be right. Rule 11 says don't trust a
pretty picture; **don't trust a number either.**

---

## Working notes

- **Browser-native.** This runs in the browser because relay has no build step and
  because it means it works on Ric's phone off the live site. WebGL2 in a fragment shader
  is fine (no dependency). Figure a few million sites at interactive rates; do not design
  for more.
- **The phone is a viewing target, not a compute target.** *(Ric, 2026-11-04.)* the World computes on
  the PC and the phone only displays it. This matters because the phone was silently acting as a
  memory budget — it is what kept the hexagon at four bytes, and the four-byte word was choosing
  physics constants. Do not reintroduce a mobile compute constraint without saying so out loud; at
  4096² the hexagon is 134MB per buffer and about 268MB double-buffered, which is comfortable on
  the 4GB card and would not have been on a phone.
- **The Lab before the World.** The Lab is four laws on a 258 × 258 hexagonal torus (no gravity, no edge), in event-driven continuous time,
  on the CPU, and it answers "what is matter here." The World is all five at scale, in a
  shader, with per-tick update probability standing in for continuous clocks. Do not start
  the World until the Lab has produced a periodic table with some depth.
- **The two time schemes are a test, not a compromise to forget.** Run the same small
  configuration both ways and compare the species, binding energies and rates. That is how
  the World's approximation gets validated instead of assumed, and it's the only place in the
  project where the same physics is implemented twice.
- **The viewer is instrumentation, not decoration.** The pyramid with the variance layer
  is how structure gets found at all. It is not a polish task to do later.
- **Fail fast and cheap.** The whole reason the Lab is small is so a dead force law shows
  up in minutes. Resist making it bigger.
