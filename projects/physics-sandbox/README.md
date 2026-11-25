# Physics Sandbox

A world of hexagons. You set how it works — gravity, chemistry, heat, what happens when two things
hit — run it, and reach in.

It was the physics half of World Builder (`projects/world-builder/`) until 2026-11-25, when Ric
asked for the two sandboxes to be separate projects: *"I need you to separate physics sim and
people sim into two separate projects."* The People sandbox kept World Builder's folder; this one
moved here with the Lab and the three probes. Nothing was shared between the two engines, so
nothing in `physics.js` changed. The page is World Builder's page with the People half and the
chooser taken out, so it opens straight on the settings.

Ric's first description of the whole thing, 2026-11-12, still holds for this half: *"You then can
choose options for the worlds. … How strong gravity is how the physics works. … Like tons of
settings. Then you hit run it opens the world."* Like World Builder before it, it is its own code
and imports nothing from KONDRITE or `projects/universe/`, and it must not: the Universe project
forbids a constant anybody can turn, and this page is nothing but.

Linked from Exploration (MODULE 004) and the terminal (`physics-sandbox`, or `chemistry`, `lab`).
The old addresses still work: `world-builder/index.html#physics…` and `world-builder/lab.html`
send you here. Not on the front door or in `latest.js` yet; that waits on Ric having looked at it.

## Files

| File | What it is |
|---|---|
| `index.html` | The page: settings → the running world. Styles and page script inline. |
| `test/physics.test.mjs` | Every setting does something, the same seed makes the same world, every preset stays sane, mass and energy keep their books, and the page loads what it should. Seconds; quick lane of `.github/checks.mjs`. |
| `physics.js` | The physics sandbox's engine. No DOM; runs the same in node. |
| `test/breakup.test.mjs` | Quick physics checks: fracture/shedding, mass, momentum, energy, large bodies, bonds, capacity and repeatable links. Runs in the quick lane of `.github/checks.mjs`. |
| `test/shape.test.mjs` | Quick checks on facings, slots, the angle spring's books, alignment, the sequence a chain reads as, and that a world with both new settings off is the world it always was. Quick lane. |
| `replication-probe.mjs` | Not a check — a measurement, run by hand. Seeds copies of a sequence, runs the identical world without them as a control, and counts only the copies made of fresh hexagons. |
| `test/chemistry.test.mjs` | Quick checks on valence and pull, that settling pays for every bond exactly, that heat thins bonds out, that a barrier is lower for pieces held lined up, that charge lands where the pulls say, keeps the books, and makes lopsided pairs stick, and that shape, sticking, ions, double bonds and energy-rich pieces each do what they say and pay exactly. Quick lane. |
| `chemistry-probe.mjs` | Not a check — a measurement, run by hand (a few minutes). Van 't Hoff, mass action, the barrier, hand-overs and energy-rich pieces, each against the number it should give. |
| `matter-probe.mjs` | Not a check — a measurement, run by hand (several minutes). Arrhenius (how fast bonds form against the barrier) and boiling against Clausius–Clapeyron. |
| `lab.html`, `lab.js` | The Lab: a hexagon grid to build one setup exactly, its kinds and rules, live runs and experiments. |
| `lab-core.js` | The Lab's core — building a world from a setup, its control, and judging an experiment. No DOM; the page and node both use it. |
| `test/lab.test.mjs` | Quick checks: typed-in kinds obeyed, setups built exactly, the control is the same hexagons loose, loaded setups checked, experiments report what they say. |

No build step and no dependencies. `python3 -m http.server 8912 --bind 127.0.0.1`, then open
`/projects/physics-sandbox/`.

## The two rules

1. **Every setting does something.** `physics.js` exports a `SCHEMA` — the groups, the settings,
   their ranges, the words shown beside a slider (`say`), and which other setting switches one off
   (`when`). The page builds its controls from that list and the engine reads the same keys, so a
   control cannot exist without an engine behind it, and `test/physics.test.mjs` walks every one
   and fails on a control that changes nothing. **To add a setting:** add it to `SCHEMA`, read
   `S.<key>` in the engine, run the test. Nothing in `index.html` changes.
2. **Nothing is scripted.** No rule makes a copier, rewards copying, or makes anything happen on a
   timer. If something you want never happens, change a pressure, not the outcome — and don't tune
   a constant until the thing appears on cue.

## The engine (`physics.js`)

A hexagon is a body with a mass, a position, a velocity and some heat. Whether that is an atom or
a planet is the visitor's settings — "Hexagons as planets" is a preset, not a mode.

36 settings in seven groups: the world (size, edge, seed), matter (how many, kinds, layout, spin),
gravity (strength, reach, a steady "down"), collisions (bounce, fusing, fracture, material strength,
smallest fragment), chemistry (what bonds, how
strongly, how many bonds each, whether a bond changes what it holds), heat (shaking, spreading, leaking, a heater) and space and time
(drag, a speed limit, the clock).

How it works, briefly:

- **Bodies are free particles, not lattice sites.** They start on a hexagonal lattice so nothing
  overlaps, and equal bodies pack back into one when they clump, but positions are continuous.
- **Gravity** is every pair exactly up to 500 bodies; above that, a 16 × 16 grid — neighbours
  exactly, farther cells as one lump — with the world's net force removed afterwards so it does
  not push itself across the screen. It is worked out once per frame and held through that
  frame's substeps, which is most of why 1,500 bodies run. "Far" falls as 1/distance and "near"
  as 1/distance²; `FAR_MATCH` makes them equal at 40 hexagons so one slider serves both.
- **Collisions** are impulses with the bounce setting as restitution; what a collision does not
  give back becomes heat, split by mass.
- **Bonds** are springs at touching distance. Forming one gives off its energy as heat; heat
  shakes one loose only if the pair has that much heat to pay for it.
- **Heat becomes motion** as a random shove charged for exactly the kinetic energy it made.

### Breaking apart

Ric, 2026-11-12, after asking whether heat and impacts could break up the large bodies:
*"yeah add it in please make sure it matches with the look of everytrhing else."* The four
controls use the existing Collisions and Heat groups, sliders and typed numbers. Fragments
are ordinary hexagons drawn by the same renderer. "Things that break" and "A hot body" are
settings presets; no outcome is scheduled.

- `breaking` is on by default. Off, neither impact fracture nor thermal shedding runs.
- `toughness` is fracture work per mass freed; `fragmentMass` is the minimum mass of **either**
  resulting piece. A body below twice that mass cannot split. Body size never triggers breakup.
- A hard hit may chip each body before fusing is considered. If half the normal impact energy,
  apportioned as collision heat, can pay for a minimum piece and its outward motion, restitution
  is reduced to at most √½. The lost collision motion becomes heat first. Once the collision
  walk finishes, that heat pays for a piece of at most half the body. This also lets a tiny
  impact chip a large body without destroying the whole large body. Gentle hits still bounce/fuse.
- Above `meltTemp`, **heat per mass** drives a gradual shedding flux. It accumulates across
  substeps, so small bodies can eventually free a minimum piece. A hotter body accumulates
  larger pieces faster. Only heat above the threshold may pay for thermal shedding.
- Each split spends `toughness × piece mass` as fracture work and the same amount on relative
  motion. Attached bonds must also be paid out of the available heat before they are removed.
  Positions and velocities preserve the centre of mass and momentum; remaining heat is divided
  by mass, and both pieces inherit the original material kind. No mass is deleted or invented.
- `breakWork` is cumulative, irreversible work, shown as **spent breaking** in the existing
  energy bar. It is not recovered by fusing. With gravity, drag, heating, radiation, shaking,
  speed clamps and bonds disabled, motion + heat + fracture work stays constant. External bonds
  use their existing negative potential convention (subtract `bondEnergy` in the books).
- A body splits at most once per outer `step()`; newborn fragments wait until the next step.
  This bounds the cascade within a frame. Breakup and hand placement share the fixed spare
  capacity; when full, the split waits without spending heat or changing mass, and the World
  tab says so. Dead slots are reused only after the spatial-hash walk ends. Pinned bodies stay
  whole, so a wall or anchor remains held.

`node projects/physics-sandbox/test/breakup.test.mjs`,
`node projects/physics-sandbox/test/shape.test.mjs` and
`node projects/physics-sandbox/test/chemistry.test.mjs` check these accounts quickly on every push;
`node projects/physics-sandbox/test/physics.test.mjs` also checks that each new setting changes a
world and each preset runs.

### Making emergence possible

Ric, 2026-11-13: *"how do we make it so emergence is something thats possible?"* The first version
could not get past clumps, because a bond meant only "these two stick": nothing a hexagon was
joined to changed what it did next. Three things were added for that, and none of them puts an
outcome in:

- **A bond changes what it holds** (`shift`, off by default). A hexagon bonds as its kind moved on
  by `shift` for every bond it already has, so what it is joined to decides what it joins next.
  `react()` re-reads each standing bond off its two ends as they are now: worth more, the
  difference comes out as heat; worth less, the pair's heat pays; worth nothing, it lets go. So a
  newcomer can knock an old neighbour off, and chains of that are reactions. It is still
  arithmetic on two kinds — no table of which reactions exist. Off, a world is byte for byte what
  it was before the setting existed.
- **A census** (`census()`, "What it has made" in the World tab). Every bonded thing named by the
  kinds in it, counted, with how many different things exist now and how many this world has ever
  made. Without it a world that keeps inventing looks the same as one stuck making pairs. Read
  off the bonds when asked; never stored.
- **Energy going through.** Reactions need heat arriving and leaving, so the "Things that react"
  preset has a hot middle and a leak. A sealed cold world reacts until it runs out and stops.

What this does **not** do, and should not be claimed: **self-replication remains an untested
possibility** (Ric, 2026-11-13). Nothing seeds a copier, no rule rewards copying, and a world has
never been run long enough to look properly — so a thing that makes more of itself is neither
claimed nor ruled out. The first version of this paragraph said flatly that nothing copies itself,
which was a claim nobody had measured either.

**Measured, 2026-11-13, before any of what the next section adds.** Three worlds of 1,200
hexagons, 400 simulated seconds each. The "things that react" preset, bonds up to three, coalesced
into one 1,319-hexagon blob and its count of different things fell 61 → 11. Chains (`maxBonds` 2,
breaking on, `shift` 1) settled instead: about 200 things and 130 different ones, the commonest
trimers sitting at 5–13 copies with no trend, and about 130 loose hexagons still spare the whole
time. `shift` 2 over a hotter middle did the same, 4–8 copies, flat. Nothing accelerated while
there was still material on the table, which is evidence against autocatalysis **in those
settings** and not proof against it anywhere.

Two things ruled replication out rather than leaving it untested, and both are gone as of
2026-11-14 — see the next section. Bonds held no angle, so a thing had connectivity and no shape:
a chain and a ring of the same kinds were one entry in the census, and there was nowhere for a
copy to lie alongside an original. And `affinity()` read only the two kinds and how many bonds
each end already held, so a structure carried nothing a passing hexagon could read.

### Shape, and a sequence that can be read

Ric, 2026-11-14, after reading the measurement above: *"can you also do give each hexagon a facing
so bonds hold an angle, and let affinity see one neighbour-of-neighbour"* — and, as the rule for
all of it, *"i doint need things replicating constantly i just want it possible."* So: three
settings, all **off by default**, which together make a copier arithmetically possible. None of
them makes one happen, and none of them is allowed to.

- **Bonds hold an angle** (`angles`, 0 = off). Every hexagon faces a way, and its six slots sit
  60° apart from that facing. A bond takes one slot at each end and a straightening spring turns
  each end until its slot points along the bond; **one slot holds one bond**, and a bond whose
  slot is taken does not form. That is the whole of what shape means here: a chain keeps its
  zig-zag, a ring closes, and two hexagons held against the same neighbour stay in step. Heat
  turns a hexagon as well as shoving it, or a free one could never bring a slot round to meet
  anything.
- **How closely they must line up** (`align`, 30° = anything, so the setting only ever tightens).
  A bond forms only if the slot each end would use is pointing within that angle. This is the
  knob that templating hangs on: at a few degrees a bond almost never happens by chance, while
  two hexagons that something else is already **holding in place** can still make one. A template
  is then nothing more than a neighbour that holds things still; no rule says it is a template.
- **A bond reads the next one along** (`look`, 0 = off). What a hexagon bonds *as* depends on the
  **kind** of the neighbour it already holds, not only on how many it holds. That is a readable
  sequence: the same kind offers a different site depending on what it sits next to, so a chain
  presents a different face along its length. Still arithmetic on kinds — no table of which
  reactions exist, which is the rule this project and the Universe project both keep.

What else changed with them:

- **The census reads a chain or a ring along itself.** `1-2-3` and `1-3-2` are different things;
  `3-2-1` is the same thing the other way round; a ring is read round its best rotation and
  written `1○2○3`. Anything that branches has no one way to read it and stays what it was, its
  kinds counted up (`1·2·3`). **Counts of "different things" before and after 2026-11-14 are not
  comparable** — the same world now reports more of them, because order is information it used to
  throw away. This is also the only place a replicator could show: a sequence whose count climbs.
- **A standing bond is re-read when `look` is on**, not only when `shift` is (`react()`). A bond's
  worth depends on what its ends hold, so a newcomer changes what the old bond is worth, which is
  what a reaction is here.
- **The books have two more terms.** `springEnergy` and `twistEnergy` are what the distance spring
  and the angle spring are holding right now, and a bond that lets go hands both back as heat.
  Before this, breaking a stretched bond quietly took that energy out of the world (measured: a
  shaken world lost about 0.1% of its energy an interaction).
- **The hexagon inspector shows a facing and takes one**, in degrees, like every other field.

**What it conserves, and what it does not** (the three limits above still stand; these are the new
ones, and they are measured, not assumed). The straightening spring leans on the line between the
two middles as hard as it turns the hexagon, equal and opposite, so **momentum is kept exactly**
(1e-16 over 100 seconds) and the spring is a real potential rather than a free source of spin —
without that lean a bonded world ran **560% hot**, which is how the bug was found. **Energy in a
bonded world closes to about a part in ten thousand, not to the last digit** — measured on a quiet
world; busy ones did worse until 2026-11-14, see *Motion and heat* below. The angular damper takes
spin out against nothing, so **angular momentum is not conserved** — the energy is, it becomes
heat. Heat's turning shove is exact.

**Is it possible, then, and has it happened?** Possible: a chain whose ends are held by a template
can make bonds that would essentially never form free, and `look` means the copy's sites depend on
the template's sequence. Not seen: `replication-probe.mjs` is the measurement, run by hand, and
the method is the control the physical-replicator people use — run the same world twice, once with
copies of a sequence dropped in and once with exactly the same hexagons scattered loose, and count
only the products made of fresh hexagons. At its own defaults, three runs of 180 seconds: 0–1 new
copies in the seeded world against 0–2 in the control. **No difference, so nothing copied
anything.** That is a null for those settings and that long, and it is the honest state: the
arithmetic no longer forbids a copier, and none has turned up.

**What is still given, and what is not.** One thing is handed to the world: a hexagon has a facing
and six slots. Every system that has ever managed this gives something — JohnnyVon gives its
codons a T-shape, Squirm3 gives a reaction table, the Sussex group cut their pucks out of plastic
to a particular shape. What this engine still refuses to give: which sequences bond, what counts
as a copy, when a thing splits in two. Separation here has to come out of heat against bonds of
different strengths, and nothing announces that a copy is finished. That is a harder road than
JohnnyVon took, and it may be why nothing has copied itself yet.

Two failure modes to watch for before believing anything, both from the Sussex work: a sequence
that was **assembled rather than copied** (which is why the probe runs a control at all), and the
**elongation catastrophe**, where strands join at staggered ends and simply get longer. A row
whose length keeps climbing is that, not a replicator.

### Chemistry with depth

Ric, 2026-11-14: *"its chemical context is shallow still how do we make it less"*. Three things
were shallow, and each is now a setting, **all off by default**. With all three off a world is
byte for byte what it was before — checked against the previous commit's engine across every
preset and two hand-built worlds on the day, and `test/chemistry.test.mjs` keeps the part of that
a test can keep.

- **Bonds per kind** (`bondsPer`: *the same for every kind* / *set by the kind*). A kind used to
  be one number and nothing else. Set by the kind, it has a **valence** and a **pull**, both worked
  out from its number — never looked up, so the no-table rule holds. Kinds run in rows of seven,
  the way the main groups of a row of the periodic table do: valence goes **1, 2, 3, 4, 3, 2, 1**
  along a row, which is the octet rule's shape (lithium to fluorine), so kind 1 caps a chain, kind
  2 carries it on and kinds 3 and 4 branch it. Pull rises along a row, the way electronegativity
  does, and a later row pulls a little less at each place, the way it does down a group. Two kinds
  that pull differently bond harder: **Pauling's rule** (1932), the bond worth the like-with-like
  strength plus a term in the *square* of the gap in pull. "Bond strength" stays the strongest bond
  there is — the most unlike pair in a row — and two that pull alike bond at about 40% of it.
  "Bonds per hexagon" still caps everything.
- **How hard a bond is to start** (`barrier`, 0 = none). Heat that has to be found before a bond
  can form *or* break, and is given straight back, so it moves how fast a world gets somewhere and
  not where it ends up. With bonds that hold an angle, each end's slot that already points at the
  other takes away its share (`cos 3e` per end: 1 lined up, 0 at 30° off), so **two hexagons that
  something is holding lined up have little or nothing left to climb**. That is the orientation
  part of catalysis — Page and Jencks (1971) put most of an enzyme's speed-up down to holding the
  reacting pieces close and lined up — and nothing in the code names a catalyst. Measured: pairs
  held lined up joined 879 times in two seconds against 42 for the same pairs turned 20° off, a
  barrier of 4.5; with no barrier, 879 and 879. This is what a copier needs: a template that holds
  the pieces is, here, a template that speeds up their joining.
- **Bonds settle with temperature** (`settle`). Before, bonds formed by chance on impact and broke
  on their own pair's heat, two mechanisms that knew nothing of each other, so a world settled
  wherever those two happened to meet. Now forming and breaking are one step and its reverse,
  accepted with the Boltzmann factor of what each has to find (the Metropolis rule, 1953, with a
  barrier in it, which is transition-state theory's shape — Eyring, 1935). The heat comes out of,
  and goes back into, everything around the bond — a circle holding about 60 mass, standing in
  for the solvent — and a step and its exact reverse are always judged at one temperature, the
  pool's with that bond not there. Attempts are made by pairs *nearly* touching, at any speed,
  because a place to be balances and an impact does not, so "Too fast to bond" is greyed out while this
  is on, and "How readily they bond" becomes how often a nearly-touching pair tries.
- **Charge from bonds** (`charge`, 0 = none; added the same day, Ric: *"a structure's arrangement
  changing how it attracts, positions, and interacts with other structures"*). A bond between two
  kinds that pull differently moves charge onto the harder puller, by the gap in their pulls: the
  textbook picture of partial charge from electronegativity. A thing's charges always add to
  nothing, a hexagon alone carries none, and kind 6 holding two kind 1s comes out −10/7 in the
  middle and +5/7 at each end, the shape of water. Charged hexagons not bonded to each other pull
  opposites together and push likes apart, Coulomb's 1/r cut off smoothly at three hexagons (the
  shifted-force cut-off simulations of liquids use, so the books still close), softened so two
  pressed together cannot pull without end. The number is the pull of the most unlike pair at
  touching. Bonded pairs are left out, as molecular simulations leave them out. Every bond made or
  broken pays for what its moved charge does to everyone near it, out of the pool when settling
  (so detailed balance still holds) and out of its own ends when not. It uses the kinds' pull
  whether or not "Bonds per kind" is on.

Five more the same day (Ric: *"do all 5"*), each off by default and byte-identical off — checked
against the previous commit's engine across every preset and three hand-built worlds, one of them
charged:

- **Shape set by the kind** (`shapeBy`, needs bonds that hold an angle). A kind's bonds spread as
  evenly as six slots allow, counting the room its spare electron pairs take up too — VSEPR
  (Gillespie and Nyholm, 1957), worked out from the same row position as valence, never looked
  up. Two places straight, three a Y, four the cross {0,1,3,4}. A kind with two spare pairs in a
  cross has them pushed to opposite sides, so its two bonds go straight: **kind 6 is straight in a
  flat world**, where real water is bent only because the real world has a third direction to bend
  into. Said plainly because it is the opposite of what one might expect.
- **Everything sticks a little** (`stick`). A short smooth pull between any two hexagons near
  touching, charged or not — London's dispersion force, reaching about half a hexagon past
  touching. Flat inside touching, so pushing two apart to touching costs nothing and a bond at
  rest feels none of it. The same for every kind; the real force grows with size, which is left out.
- **Whole charges can jump** (`ions`, needs charge). Two free hexagons nearly touching can pass a
  whole charge. Holding one costs a kind a fixed energy set by its pull — losing one dearer the
  harder it pulls, gaining one cheaper — so passing one costs nothing for the most unlike pair in a
  row and a lot for two alike, and the pull of the two new charges pays the rest. These are
  energies of a state, so every jump balances its reverse. Where it breaks even, a gap of about two
  thirds of a row, sits where real chemistry draws its line between ionic and covalent. An ion holds
  no bonds.
- **Pieces can be handed over** (`swap`, needs settling). A hexagon nearly touching one end of a
  bond takes that end in one step while the old partner lets go — the way most real reactions go,
  through one transition state instead of a full break and remake. Weighed as both together at the
  pool's temperature halfway between before and after, with the barrier the average of the two
  bonds'.
- **Double and triple bonds** (`order`, needs settling). A bond whose ends both have room can step
  up to double and triple and back: worth 1.75 and 2.4 times a single and 0.87 and 0.78 as long,
  from the textbook carbon-carbon figures (348, 614, 839 kJ/mol; 154, 134, 120 pm). Each step
  counts against both ends' bonds per kind; only a single bond comes apart.
- **Energy-rich pieces** (`fuel`, `fuelRate`). Free hexagons are charged up from outside now and
  then and spend it on their next bond: more given off and less barrier to climb, and nothing
  balancing it — that is the point. A sealed world always comes to rest, and at rest nothing can
  keep copying itself; this is the food. **It only does anything with a barrier.** Measured without
  one, charged-up pieces were a few dozen among bonds made and broken thousands of times a second,
  and the energy only warmed the world (K stayed where heat put it). With a barrier of 6, nothing
  else bonds at all (8 pairs of 300), and pieces charged with 6 at 0.01 a second, heat leaking at
  0.02, held about **170 pairs, 2.7 times what a world at rest holds at that temperature**, for as
  long as they were fed — more when fed faster. That is how real driven chemistry works: a barrier
  keeps what was made from coming undone, and only fed pieces get over it.

**Measured, 2026-11-14.** Every new step keeps the books exactly: a held world with all of them on,
making and breaking tens of thousands of bonds and hundreds to thousands of hand-overs, re-orderings and jumped
charges, came out within 2 parts in 10¹⁵. Hand-overs moved where A + B ⇌ AB settles by about 4%
across three seeds (K adjusted −0.38 against −0.34); a single run scatters by about ±0.15, and the probe on the day read −0.38 off and −0.18 on, so read it over several seeds. That is inside what the mass-action line
already shows. Kinds 1 and 7 ended 81% ions, kinds 2 and 6 63%, kinds 4 and 4 none. With
sticking at 0.5, uncharged hexagons touched 2.2 neighbours each against 0.83 with none. With shape
on no bond sat off its kind's pattern; with it off, some did.

**Measured, 2026-11-14** (`chemistry-probe.mjs`, run by hand; two kinds that pair and nothing else,
A + B ⇌ AB, in a sealed world). Each line is against a number worked out first:

| | the world before | settling on |
|---|---|---|
| **van 't Hoff**: slope of ln K against 1/T, should equal the bond energy (4) | 1.8 at first measure, 2.3 in the probe | **4.08** (102%), straight to r² 0.998; at bond energy 6, **6.11** — *right for the wrong reasons; see Motion and heat* |
| **Mass action**: K for a 3:1 mix against 1:1, should be equal | −17% | **−10%** (−5% at bond energy 6), and more A pulled B from 55% to 89% paired, as Le Chatelier says |
| **Barrier**: should change how fast, not where | barrier 3 cut K by a factor of 23 | K moved 6%; half-way took **16 s instead of 0.5 s** |

Two things that looked right and were not, both found by measuring. Paying for a bond out of its
own pair: a pair rarely holds a bond's worth of heat, and a new bond's heat landed in its own two
ends and shook it apart — slope 1.8. Judging each step at the pool's temperature of the moment:
a fresh bond's heat warmed the pool it was then judged against — slope 91%, and a barrier moved
the balance by a quarter.

**What it conserves.** Every make and break pays exactly: forming gives its worth less what the
springs now hold to the pool, breaking takes its worth back and hands the springs' energy over as
heat, and the test holds a world of held hexagons that made and broke hundreds of bonds to a part
in a billion. A *moving* bonded world used to gain energy slowly through the stepping rule and the
collision push-apart; that was fixed the same day — see *Motion and heat*.

**Charge, measured 2026-11-14.** The same four pieces wired two ways, 100 pairs at temperature
0.3: kind 1 with kind 7 twice (lopsided) against 1 with 1 and 7 with 7 (alike, no charge). At
charge 3 the lopsided pairs averaged **0.43 neighbours touching** against **0.13** for the alike
ones, and the alike ones did not notice the setting at all. That is HF boiling at 20 °C next to
H₂ at −253 and F₂ at −188: same atoms, different wiring. **What it does not do:** a straight
1–6–1 and a bent one (120°) came out equally sticky (1.85 against 1.88), and stayed equal with
the reach stretched to 6 and 10 hexagons. Flat hexagons leave the middle of a straight molecule
exposed at its sides, so its negative middle catches a neighbour's positive end as well as a bent
one's open side does. Real straight molecules hide their middles better. So here, **what is bonded
to what** changes how a thing attracts; **its bend alone** barely does. Saying so rather than
tuning until it did. Charge costs about twice the time of a world without it, with its own coarse
grid of only the charged.

What was read, and what was used. Pauling, *The Nature of the Chemical Bond. IV*, J. Am. Chem.
Soc. 54 (1932) 3570 — the square-of-the-gap rule. Metropolis, Rosenbluth, Rosenbluth, Teller and
Teller, J. Chem. Phys. 21 (1953) 1087 — the acceptance rule. Eyring, J. Chem. Phys. 3 (1935) 107 —
a barrier climbed both ways. van 't Hoff (1884) and Guldberg and Waage (1864) — the two lines the
probe checks against. Page and Jencks, PNAS 68 (1971) 1678 — holding pieces lined up as most of
catalysis. Gillespie and Nyholm, *Inorganic stereochemistry*, Q. Rev. Chem. Soc. 11 (1957) 339 —
bonds and spare pairs spreading out. London, *Trans. Faraday Soc.* 33 (1937) 8 — the pull between
uncharged things. Allen and Tildesley, *Computer Simulation of Liquids* (Oxford, 1987), for the
shifted-force cut-off and for leaving bonded pairs out. Dittrich, Ziegler and Banzhaf, *Artificial Chemistries — A Review*, Artificial Life 7
(2001) 225, and Fontana and Buss (1994) are the standard places to see where this sits among
artificial chemistries; nothing here was taken from them, and they were not read in full for it.
Hutton's Squirm3 (credited below) is the other road: it gives each atom states and a reaction
table, which this project refuses.

### Motion and heat

Ric, 2026-11-14: *"how close can we get this to real chemistry?"* — and then, to fixing the
foundation first and proving two more laws: *"do it"*. Four changes under everything, which
**change every world a little** (nothing here is off by default; it is how the world moves):

- **Velocity Verlet** (Verlet 1967; Swope et al. 1982), the stepping rule molecular simulation
  uses, in place of a kick-then-step. Only forces that hold energy go in the kicks; the step runs
  whole before collisions, bonds and heat see the world, so they see positions and velocities from
  the same moment, and the forces are worked out afresh each step.
- **Exact dampers.** A bond's damper used to pay heat on the speed it had before the step; now it
  counts the motion it actually took.
- **Collisions pay for their push.** Pushing two overlapping hexagons apart moves things that hold
  springs, charges and sticking with everyone near; what that changes is now paid from their heat.
  The push-apart's leak measures exactly zero.
- **One temperature.** "Heat shakes things" used to turn heat into motion and never back except
  by collision, so a world had two temperatures that disagreed — measured, heat 0.24 against motion
  anywhere from 0.18 to 0.59 in one sticky world — and bonds (judged by heat) and boiling (decided
  by motion) ran on different thermometers. Now each hexagon's motion is pulled towards its own
  heat's temperature and kicked in proportion, the Langevin equation (Langevin 1908; the exact
  step of Leimkuhler and Matthews 2013), and each bond's damper gets the matching kick
  (fluctuation-dissipation, as in dissipative particle dynamics: Español and Warren 1995). Every
  trade is paid from heat exactly. With perfectly bouncy collisions heat and motion agree to 5%;
  a collision that loses energy keeps motion a little cooler than heat, and that is left alone.

| measured, 2026-11-14 | before | after |
|---|---|---|
| energy gained in 5 s, 400 bonded hexagons (bonding on contact / everything on) | 2.8 / 9.7 | 0.015 / −0.015 |
| energy gained in 5 s, 800 hexagons reacting | 2.2 | 0.05, then 0.2 once bonds wiggle at the world's temperature (the stepping rule's own error, which grows with how hard things ring; every other rule adds nothing) |
| a single bonded pair, first second | 0.004 | 0.000006 |
| time per frame | — | about 10% more |

**What that did to the chemistry numbers, and why the old van 't Hoff was wrong.** The old 102%
was two errors cancelling. For two pieces joining in a flat world, ln K against 1/T should have
slope B − T/2, not B: a bond's own wiggling holds heat (classically K grows as √T·e^(B/T) from the
room a spring gives). With one temperature and fair dampers, `chemistry-probe.mjs` reads **3.54
against 3.36 (105%)** at bond energy 4 and **5.49 against 5.19 (106%)** at 6, straight to r² 0.999.
In between, with the Langevin step but the old dampers, it read 117% — bonds wiggling colder than
the world looked more comfortable than they are. Mass action came out −10% and +6%, a barrier of 3
moved the balance 6–9% while taking six times as long, hand-overs moved it 8–14% on single runs
(scatter is about ±15%), and energy-rich pieces still held a fed world well above rest.

**Two more laws** (`matter-probe.mjs`, run by hand):

- **Arrhenius.** How often A + B join per pair that could, at five temperatures: ln(rate) against
  1/T has slope **−1.98, −3.85 and −5.81 for barriers of 2, 4 and 6** — 96 to 99%.
- **Boiling** (Clausius–Clapeyron). A drop of 144 hexagons held by "Everything sticks a little",
  in a box it can boil into: ln(gas density) against 1/T has slope **−2.25**, against **2.31** for
  the energy to pull one hexagon out of the liquid (1.95, measured separately as the drop's sticking
  energy per hexagon, plus T for the push of the gas) — **97%**. Nothing was tuned to get it.

The gas has to be at balance for this to mean anything: in the first try, in a box 60 wide, a
hexagon took minutes to wander back to the drop, the gas was still filling, and the slope came
out twice the right size. A smaller box, run longer, and a fit that weights each temperature by how
much gas it saw, gave the line above.

### Form

Ric, 2026-11-14, five things for *"a convincing approximation"*: preferred bond angles that
depend on surroundings, flexible shapes, occupied space, charge distribution, and saturation —
*"when you're done analyze if this is worth it"*. Four of the five were already here; one needed a
rule. Each is now measured, in `test/chemistry.test.mjs`.

- **Preferred angles that follow the surroundings — new.** With shape set by the kind *and* double
  bonds on, a hexagon's shape follows what it holds: the second and third parts of a double or triple
  bond take no direction of their own, so each takes a direction away. Kind 4 with four singles is
  the cross; with one double, a flat Y; with two doubles or a triple, straight — methane's,
  ethylene's and acetylene's carbon, flattened. A bond may change order only if the bonds both ends
  already hold sit on both the old shape and the new, so the step and its reverse stay balanced, and
  a carbon held as a cross cannot go straight without first letting go of what is in the way.
  Measured: of kind 4s holding two bonds, every one with a double sat as a 120° Y and every one with a
  triple or two doubles sat straight.
- **Flexible shapes — already here.** Distance and angle springs ("Bonds hold an angle" is the
  stiffness), and since *Motion and heat* they wiggle at the world's own temperature.
- **Occupied space — already here, emergent.** A pinned hexagon with one open site, a gas that
  can bond to it, and non-bonding neighbours pinned round it: joinings in 45 seconds fell **173, 57,
  32, 16, 0** as the open sides went 6, 3, 2, 1, 0. Nothing in the code says "hindered"; the
  neighbours are simply in the way.
- **Charge distribution orients — already here, emergent.** Lopsided 1–7 pairs touching each
  other met positive end to negative end **95%** of the time with charge on, against **48%** (chance)
  with it off.
- **Saturation with exposed sites — already here.** Kinds 1 and 4 mixed, settling for a minute: 58
  molecules closed (the 1·1 pair, and 1·1·1·1·4, flattened methane) and 76 keeping open sites on
  the outside (1·4 with three, 1·1·4 with two, and so on).

### The Lab

Ric, 2026-11-14: *"a hexagon grid pops up. You place the hexagons, choose the rules for the
hexagons and the properties of them … then can run it. So you can try a bunch of different ones to
see if you can make a self replicating thing … so then we can test each individual property. …
It wouldn't be a sandbox right?"* — right: a sandbox is for playing, this is for finding out.
`lab.html`, linked from the top of the settings screen (it was under the two doors, before the split).

- **The grid.** Cells one hexagon wide, every other row shifted half, so each touches six others
  at the six directions a hexagon's bond slots point. Tools: **Place** (tap or drag; tap one to
  change its kind), **Bond** (tap one, then a touching one; again to unbond), **Pin**, **Erase**;
  a soup of any kind can be scattered on the empty cells.
- **Kinds typed in.** For each kind: bonds it holds (0–6), pull, mass, shape (anywhere, straight,
  bent at 120°, a Y, a cross), and a table of how strongly each pair bonds (0 = never; the two
  halves kept equal). This deliberately breaks the sandbox's rule that a kind is worked out from
  its number and never looked up — the sandbox stays honest by that rule, and the Lab exists to
  test one property at a time, which needs typing them in. The engine takes them as `kindsDef`;
  without it the sandbox is byte for byte what it was (tested).
- **Rules.** The sandbox's own settings, built from the same list, minus the ones the grid and the
  kinds decide. A Lab setup starts calm: looped edges, no gravity, nothing breaks, one size,
  bonds that hold an angle and settle with temperature. All of it can be changed.
- **Run** builds the world exactly as drawn (a drawn bond that the table, room or shape will not
  allow is skipped and said so) and runs it live.
- **Experiment.** The setup as built against a **control** — the same hexagons scattered loose,
  unbonded and unpinned — for the same seconds on the same world seeds, the method of
  `replication-probe.mjs` and for its reason (Virgo et al., ECAL 2011). For each thing the setup
  starts with: how many more the built world ends with, how many the control ends with, and the
  difference, which is the only part building it can claim. Optionally again with each rule that is
  on switched off in turn, so each rule's part shows on its own. It runs **on the grid, where you
  can watch it**: the built world and its control side by side, at the toolbar's speed (up to Max),
  one run after the next, the table filling in as each ends. (The first version ran it out of
  sight with a progress bar; Ric: *"that's stupid it just needs to be able to run"*.) The verdict
  says "no copying" or "a difference, not yet a finding", never more.
- **Keeping it.** Save in the browser, download or open a file, or copy a link (the setup in the
  address, up to about 60 kB). Anything loaded is checked: kinds clamped, cells kept to the grid
  and to kinds that exist, bonds only between neighbours.

Checked on the day in a browser at desktop and phone width: placing, bonding by tap-then-tap,
running, and a two-run experiment with every rule off in turn. The first replication probe on the
new chemistry (three setups, 1-2-3 chains in a soup) found no copying, which is what this is for:
trying many specific setups, not adding more rules.

### Hands

Ric, same day: *"i need a way to place them like place hexigons or give them stuff and modify
hexigons."* A running physics world has a tool row: **Look**, **Place** (tap or drag), **Throw**
(drag and let go), **Erase**, **Heat**, **Cool** and **Pin**. Place and Throw use a palette: a kind
and a typed mass multiplier. Tapping a hexagon in Look opens it in the Hexagon tab, where exact
mass, temperature and X/Y velocity can be typed; its kind, weight and
heat can be changed, it can be stopped, pinned, have its bonds broken, or be removed. "A blank
world" starts empty for building from nothing. The tools work while paused.

- A **pinned** hexagon is held where it is: collisions treat it as having no end of mass, heat
  still moves through it, and gravity still pulls on everything else from it. That is what makes
  walls, floors and anchors.
- A world has room for 3,000 extra hexagons (hand placements and fragments share it) on top of what it started with; a removed
  one's place is reused.
- **None of it is physics.** It is somebody reaching in, and the World tab counts how many were
  put in and taken out. Hand edits are not in a copied link — the link is the settings.

**What it conserves, and what it does not.** Mass exactly (fusing adds the two; breakup divides
it). Energy to nine digits when nothing is meant to take it — the test holds motion + heat +
leaked + fracture work to 1e-6 — and momentum through collisions, fusing and breakup. Three known limits, on purpose:

- Heat's shoves are one body at a time, so they keep energy exactly and momentum only on average.
- Gravity's potential energy is not tracked, so the energy bar says so when gravity is on.
- The speed limit is a clamp, which does not conserve anything.

This is a toy and says so. It is **not** the Universe project: that one runs on integers, asserts
conservation to the unit, and refuses to run on a constant nobody chose. Do not port code between
them in either direction.

**Credit.** Two ideas are borrowed from `projects/universe/` (and through it from the sources in
`projects/universe/SOURCES.md`): the bonding rule that reads a strength off two kinds by
arithmetic rather than from a table — "pairs that add up" is its law 2, `B = M − |v₁ + v₂ − M|` —
and "matter is the sum of kinds", which is what lets two bodies fuse into one.

Three more were read properly on 2026-11-14, before shape and sequences were built, because the
point of that work was to be right rather than to look right. Nothing was ported; each paper was
read and the mechanism written here from its description.

- **Smith, Arnold, Peter Turney and Robert Ewaschuk (2002).** *JohnnyVon: Self-Replicating
  Automata in Continuous Two-Dimensional Space.* National Research Council Canada, NRC/ERB-1099;
  arXiv [cs/0212010](https://arxiv.org/abs/cs/0212010). T-shaped "codons" in a virtual liquid,
  with arms that bond and a **straightening force** that twists two bonded codons until their
  arms lie along the line joining their middles — which is exactly the spring `angles` turns on.
  Took, as well: **two bond classes with very different angular tolerance** (π/256 for the
  backbone, π/3 for the cross-link), and the reason it works — a backbone bond is almost
  impossible by chance *and* easy once two codons are held side by side by something else. That
  is what `align` is, with one number instead of two classes. In their soup of 88 free codons a
  pair formed by chance at step 164,450 and replicated immediately.
  **Not** taken: their splitting. A finite state machine passes a signal down a finished double
  strand and a timed repulsive field shoves the copy off. This project does not script outcomes,
  so separation here has to come from heat against bonds of different strengths — a harder road,
  deliberately.
- **Hutton, Tim J. (2002).** *Evolvable Self-Replicating Molecules in an Artificial Chemistry.*
  Artificial Life 8(4)
  ([PDF](https://faculty.cc.gatech.edu/~turk/bio_sim/articles/hutton_rep_molecules.pdf)).
  Squirm3: atoms with a fixed **type** and a changing **state**, where what an atom will do next
  depends on what it is bonded to, and self-replicating strings emerge from a random soup. `look`
  is that idea and only that idea: a hexagon's site depends on the kind it holds. **Not** taken:
  the method. Squirm3's chemistry is a table of reactions on (type, state) pairs — `R1: e8 + e0
  → e4e3` and seven more — and an enumerated table is the one thing rule 4 of the Universe
  project forbids and this engine has never had.
- **Virgo, Nathaniel, Chrisantha Fernando, Bill Bigge and Phil Husbands (2011).** *The Elongation
  Catastrophe in Physical Self-Replicators.* ECAL 2011, MIT Press, pp. 828–835
  ([PDF](https://users.sussex.ac.uk/~philh/pubs/VIRGO.pdf)). Shaped plastic pucks with magnets on
  an air-hockey table. Took the **measurement**: run the system with and without a seed of the
  sequence, and only the difference is templated replication, because self-assembly of novel
  sequences is easier than copying and counts identically if you only look at the products. That
  is `replication-probe.mjs`. Took the two **failure modes** as the things to disbelieve first:
  non-templated ligation, and the elongation catastrophe — strands joining at staggered ends and
  growing without bound.

## The page

- **Physics numbers are editable beside their sliders** (Ric, 2026-11-12: "you can type one",
  after taking a particle above a billion in mass; "dont say this is a feature its intuitive").
  The page adds no announcement. Slider ranges and steps remain convenient sweeps; typed decimals
  retain their precision and can go beyond them. `SCHEMA.inputMin` / `inputMax` are the actual
  limits used by the fields and `clean()`, including when opening a shared link. Most physical
  quantities allow 0–10¹²; mass allows 10⁻⁶–10¹², fractions stay 0–1, and integral counts stay
  integral. World width is 4–1,000 and starting bodies 0–20,000 to bound browser work; kinds are
  1–64, bonds per body 0–255 (byte storage), seeds 0–2³²−1 and clock 0.001–100×. Layouts still
  place only as many bodies as fit. Invalid or unfinished setup fields block Run; changing
  presets or Reset replaces them. The particle inspector holds its fields while focused so
  the live redraw cannot eat an edit. Body kinds use float storage because a sun/fused body's
  kind follows its mass and must not overflow at 2³¹.
- **The settings screen is panels, not one long list** (2026-11-13). The starting points wrap
  into a grid instead of the row that scrolled sideways — a card off the end of a strip nobody
  thinks to drag may as well not be there — and each group is a panel, laid out in columns where
  there is room, so thirty-six settings are about two screens rather than six. A row is its label
  and its value on one line, the slider under that and the help under that; a value that only
  repeats the number in the box beside it is left out. A shut group carries a turned-down corner,
  which it had nothing of on a phone, where the first two open and the rest do not. Two starting
  points to a row there, with their notes held to two lines.
- **The running world's bar wraps rather than scrolling sideways**, and two things moved off it to
  keep it to one row: the tools are a rail on the stage, beside what they act on and above the
  kind and mass they place, and the clock sits in the corner of the world. Below 1,150px the
  title goes first — the world under it says what it is — and the group captions follow at
  1,100px. On a phone the bar and the rail both go down a size, because every row either takes
  comes straight off the world.
- **A world opened from a link fits itself once the stage has a size.** `fit()` scaled the camera
  to a canvas the browser had not laid out yet, which left the scale at zero and drew nothing at
  all — and every link "Copy link" makes opens that way, so a shared world was a black rectangle
  until you found "Whole world". It now reports failure on a stage with no size, retries on the
  next frame, and re-fits when the stage changes size unless the view has been taken hold of.
- **Two screens in one file.** The address carries only the settings that differ from the
  defaults (`#physics?gravity=2&kinds=3`), so a link stays short and still opens after a setting
  is added. `&run` goes straight to the world; "Copy link" makes one. The `#physics` stays in the
  address although there is only one sandbox here now, so links made before the split still open.
- **Settings that another setting switches off are greyed**, not hidden, so the list never jumps.
- **"Surprise me" draws every setting from its own range.** Most of those are bad worlds. That is
  the point.
- **A frame advances at most a tenth of a second of real time** rather than owing a growing
  backlog, so a slow phone runs slower instead of freezing; a note says when it is behind.

## Not done

- The front door and `latest.js`, as above.
- A share card. Add a row to `assets/og/build-og.py`'s manifest and run it with `--tags` from the
  Windows machine (it draws with Windows' own fonts).
- Bonds have no direction (see above), and a hand-built world is not saved or shared.
- No sound.
